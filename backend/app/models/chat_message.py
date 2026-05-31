"""
Chat message model — GS-110.
Stores ops-room messages. user_id is SET NULL on user deletion (preserves history).
"""

from sqlalchemy import Column, DateTime, ForeignKey, Index, Integer, String
from sqlalchemy.sql import func

from .base import Base


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    user_name = Column(String(255), nullable=False)
    room = Column(String(50), nullable=False, default="ops")
    body = Column(String(1000), nullable=False)
    created_at = Column(DateTime, server_default=func.now())

    __table_args__ = (
        Index("ix_chat_messages_room_created", "room", "created_at"),
    )
