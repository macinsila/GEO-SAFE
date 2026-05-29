"""
GS-011 — Asenkron e-posta servisi.

Ortam değişkenleri:
  SMTP_HOST      — SMTP sunucusu (boşsa e-posta atlanır)
  SMTP_PORT      — varsayılan 587
  SMTP_USER      — kullanıcı adı / gönderen adres
  SMTP_PASSWORD  — şifre
  SMTP_FROM      — gönderen adres (boşsa SMTP_USER kullanılır)
  APP_BASE_URL   — doğrulama/sıfırlama linklerinde kullanılır
"""

import asyncio
import logging
import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

logger = logging.getLogger(__name__)

APP_BASE_URL = os.getenv("APP_BASE_URL", "http://localhost:3000")


def _send_smtp(to: str, subject: str, html_body: str) -> None:
    host = os.getenv("SMTP_HOST", "")
    port = int(os.getenv("SMTP_PORT", "587"))
    user = os.getenv("SMTP_USER", "")
    password = os.getenv("SMTP_PASSWORD", "")
    from_addr = os.getenv("SMTP_FROM", user)

    if not host or not user:
        logger.warning("SMTP yapılandırılmamış — e-posta atlandı: %s", to)
        return

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = from_addr
    msg["To"] = to
    msg.attach(MIMEText(html_body, "html", "utf-8"))

    with smtplib.SMTP(host, port) as server:
        server.ehlo()
        server.starttls()
        server.login(user, password)
        server.sendmail(from_addr, to, msg.as_string())
        logger.info("E-posta gönderildi: %s → %s", from_addr, to)


async def send_email(to: str, subject: str, html_body: str) -> None:
    await asyncio.to_thread(_send_smtp, to, subject, html_body)


async def send_verification_email(to: str, token: str) -> None:
    link = f"{APP_BASE_URL}/verify-email?token={token}"
    html = f"""
    <h2>GeoSafe — E-posta Doğrulama</h2>
    <p>Hesabınızı doğrulamak için aşağıdaki bağlantıya tıklayın:</p>
    <p><a href="{link}">{link}</a></p>
    <p>Bu bağlantı 24 saat geçerlidir.</p>
    <p>Bu isteği siz yapmadıysanız bu e-postayı görmezden gelin.</p>
    """
    await send_email(to, "GeoSafe — E-posta Doğrulama", html)


async def send_password_reset_email(to: str, token: str) -> None:
    link = f"{APP_BASE_URL}/reset-password?token={token}"
    html = f"""
    <h2>GeoSafe — Şifre Sıfırlama</h2>
    <p>Şifrenizi sıfırlamak için aşağıdaki bağlantıya tıklayın:</p>
    <p><a href="{link}">{link}</a></p>
    <p>Bu bağlantı 1 saat geçerlidir.</p>
    <p>Bu isteği siz yapmadıysanız bu e-postayı görmezden gelin.</p>
    """
    await send_email(to, "GeoSafe — Şifre Sıfırlama", html)
