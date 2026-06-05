"""Chat read receipt model — GS-112.

Stores the last message ID a user has read in each room.
Used to compute the unread badge count on the frontend.
"""

from sqlalchemy import Column, DateTime, ForeignKey, Index, Integer, String, UniqueConstraint
from sqlalchemy.sql import func

from .base import Base


class ChatReadReceipt(Base):
    __tablename__ = "chat_read_receipts"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    room = Column(String(50), nullable=False)
    last_read_message_id = Column(Integer, nullable=False, default=0, server_default="0")
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("user_id", "room", name="uq_chat_read_user_room"),
        Index("ix_chat_read_receipts_user_room", "user_id", "room"),
    )
