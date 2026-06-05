"""
Mahalle / alan kanalları — GS-111.

ChatChannel        : bir coğrafi alanı temsil eden sohbet kanalı (merkez + yarıçap).
ChatChannelMembership : kullanıcı ↔ kanal üyeliği (mute durumu dahil).
ChatMessageReport  : bir mesajın moderasyon için bildirilmesi.

Mesajlar mevcut `chat_messages` tablosunda saklanır (room = kanal slug'ı). Bu sayede
canlı SSE yayını (broadcast_chat_message) ve ChatPanel olduğu gibi yeniden kullanılır.
"""

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.sql import func

from .base import Base


class ChatChannel(Base):
    __tablename__ = "chat_channels"

    id = Column(Integer, primary_key=True)
    slug = Column(String(50), nullable=False, unique=True, index=True)
    name = Column(String(120), nullable=False)
    # Alan merkezi + yarıçap (km) — konuma göre otomatik öneri için.
    center_lat = Column(Float, nullable=True)
    center_lon = Column(Float, nullable=True)
    radius_km = Column(Float, nullable=False, default=5.0)
    created_at = Column(DateTime, server_default=func.now())


class ChatChannelMembership(Base):
    __tablename__ = "chat_channel_memberships"

    id = Column(Integer, primary_key=True)
    channel_id = Column(
        Integer, ForeignKey("chat_channels.id", ondelete="CASCADE"), nullable=False
    )
    user_id = Column(Integer, nullable=False)
    muted = Column(Boolean, nullable=False, default=False)
    joined_at = Column(DateTime, server_default=func.now())

    __table_args__ = (
        UniqueConstraint("channel_id", "user_id", name="uq_channel_membership"),
    )


class ChatMessageReport(Base):
    __tablename__ = "chat_message_reports"

    id = Column(Integer, primary_key=True)
    message_id = Column(
        Integer, ForeignKey("chat_messages.id", ondelete="CASCADE"), nullable=False
    )
    reporter_user_id = Column(Integer, nullable=True)
    reason = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
