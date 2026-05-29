"""
Web Push emergency alerts — GS-021.

POST /api/v1/push/subscribe    — save a push subscription (authenticated)
DELETE /api/v1/push/subscribe  — remove subscription
POST /api/v1/push/send         — broadcast to all subscribers (admin)
GET  /api/v1/push/vapid-public — return the VAPID public key (no auth)

Env:
  VAPID_PUBLIC_KEY   — base64url-encoded VAPID public key
  VAPID_PRIVATE_KEY  — base64url-encoded VAPID private key
  VAPID_SUBJECT      — mailto: or https: contact (required by web-push spec)

Generate keys once:  python -c "from py_vapid import Vapid; v=Vapid(); v.generate_keys(); print(v.public_key, v.private_key)"
"""

import json
import os
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import get_current_user, require_roles
from app.api.response import success_response
from app.db import get_db
from app.models.push_subscription import PushSubscription
from app.models.user import User

router = APIRouter(tags=["push"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class PushSubscriptionPayload(BaseModel):
    endpoint: str
    keys: dict  # {auth: str, p256dh: str}


class PushSendPayload(BaseModel):
    title: str
    body: str
    url: Optional[str] = "/"
    tag: Optional[str] = "geosafe-alert"


# ── Helpers ───────────────────────────────────────────────────────────────────

def _vapid_configured() -> bool:
    return bool(
        os.getenv("VAPID_PUBLIC_KEY")
        and os.getenv("VAPID_PRIVATE_KEY")
        and os.getenv("VAPID_SUBJECT")
    )


async def _send_one(sub: PushSubscription, payload: dict) -> bool:
    """Send a push message to one subscription. Returns True on success."""
    try:
        from pywebpush import webpush, WebPushException  # type: ignore

        webpush(
            subscription_info={
                "endpoint": sub.endpoint,
                "keys": sub.keys if isinstance(sub.keys, dict) else json.loads(sub.keys),
            },
            data=json.dumps(payload),
            vapid_private_key=os.getenv("VAPID_PRIVATE_KEY"),
            vapid_claims={
                "sub": os.getenv("VAPID_SUBJECT", "mailto:admin@geosafe.app"),
                "exp": int(datetime.utcnow().timestamp()) + 12 * 3600,
            },
            ttl=86400,
        )
        return True
    except Exception:
        return False


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/vapid-public")
async def vapid_public():
    key = os.getenv("VAPID_PUBLIC_KEY", "")
    return success_response(
        data={"vapid_public_key": key, "configured": bool(key)},
        message="VAPID public key",
    )


@router.post("/subscribe", status_code=201)
async def subscribe(
    payload: PushSubscriptionPayload,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(PushSubscription).where(
            PushSubscription.endpoint == payload.endpoint
        )
    )
    existing = result.scalar_one_or_none()
    if existing:
        existing.user_id = current_user.id
        existing.keys = payload.keys
        await db.commit()
        return success_response(data={"updated": True}, message="Push aboneliği güncellendi")

    sub = PushSubscription(
        user_id=current_user.id,
        endpoint=payload.endpoint,
        keys=payload.keys,
    )
    db.add(sub)
    await db.commit()
    return success_response(data={"subscribed": True}, message="Push aboneliği kaydedildi")


@router.delete("/subscribe")
async def unsubscribe(
    endpoint: str = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(PushSubscription).where(
            PushSubscription.endpoint == endpoint,
            PushSubscription.user_id == current_user.id,
        )
    )
    sub = result.scalar_one_or_none()
    if sub:
        await db.delete(sub)
        await db.commit()
    return success_response(data={"unsubscribed": True}, message="Push aboneliği iptal edildi")


async def _send_push_to_all_subscriptions(
    db: AsyncSession,
    title: str,
    body: str,
    url: str = "/",
    tag: str = "geosafe-alert",
) -> dict:
    """Broadcast a push notification to all stored subscriptions."""
    result = await db.execute(select(PushSubscription))
    subs = result.scalars().all()

    if not subs:
        return {"sent": 0, "failed": 0, "removed_stale": 0}

    message = {"title": title, "body": body, "url": url, "tag": tag}
    sent, failed = 0, 0
    dead_endpoints: list[str] = []

    for sub in subs:
        ok = await _send_one(sub, message)
        if ok:
            sent += 1
        else:
            failed += 1
            dead_endpoints.append(sub.endpoint)

    for ep in dead_endpoints:
        r = await db.execute(select(PushSubscription).where(PushSubscription.endpoint == ep))
        dead_sub = r.scalar_one_or_none()
        if dead_sub:
            await db.delete(dead_sub)
    if dead_endpoints:
        await db.commit()

    return {"sent": sent, "failed": failed, "removed_stale": len(dead_endpoints)}


@router.post("/send")
async def send_push(
    payload: PushSendPayload,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles("admin")),
):
    if not _vapid_configured():
        raise HTTPException(
            status_code=503,
            detail="VAPID anahtarları yapılandırılmamış (VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT)",
        )

    stats = await _send_push_to_all_subscriptions(
        db=db,
        title=payload.title,
        body=payload.body,
        url=payload.url or "/",
        tag=payload.tag or "geosafe-alert",
    )
    return success_response(
        data=stats,
        message=f"Push bildirimi gönderildi: {stats['sent']} başarılı, {stats['failed']} başarısız",
    )
