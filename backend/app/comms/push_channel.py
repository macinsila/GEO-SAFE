"""Web Push kanalı — pywebpush üzerine kurulu CommsChannel impl."""

from sqlalchemy.ext.asyncio import AsyncSession

from app.comms.base import CommsChannel, CommsMessage


class PushChannel(CommsChannel):
    channel_name = "push"

    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def send(self, message: CommsMessage) -> None:
        from app.api.push import _send_push_to_all_subscriptions

        await _send_push_to_all_subscriptions(
            db=self._db,
            title=message.title,
            body=message.body,
            url=message.url or "/",
            tag=message.event_type,
        )
