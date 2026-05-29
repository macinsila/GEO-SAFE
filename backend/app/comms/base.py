"""
GS-095 — Transport soyutlama: CommsChannel arayüzü.

Mevcut kanallar:
  - SSEChannel  : tarayıcıda açık SSE bağlantısına anlık iletim
  - PushChannel : Web Push bildirimi (arka planda bile çalışır)

Gelecekte GS-110 (sohbet paneli) bu arayüzü kullanacak.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Optional


@dataclass
class CommsMessage:
    """Kanal bağımsız mesaj şeması."""

    event_type: str          # SSE event name veya push tag
    title: str               # Bildirim başlığı
    body: str                # Bildirim gövdesi
    url: Optional[str] = "/" # Tıklandığında açılacak URL
    data: dict[str, Any] = field(default_factory=dict)  # Ek payload


class CommsChannel(ABC):
    """Soyut iletişim kanalı. Her kanal bu sınıfı implement eder."""

    @property
    @abstractmethod
    def channel_name(self) -> str:
        """Kanal tanımlayıcısı (loglama, hata mesajları için)."""

    @abstractmethod
    async def send(self, message: CommsMessage) -> None:
        """Mesajı kanala ilet."""

    async def broadcast(self, message: CommsMessage) -> None:
        """send() için alias — çok-alıcılı kanallarda override edilebilir."""
        await self.send(message)
