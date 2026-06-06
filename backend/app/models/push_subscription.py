"""PushSubscription model — GS-021 Web Push."""

from sqlalchemy import JSON, Column, DateTime, Integer, Text
from sqlalchemy.sql import func

from .base import Base


class PushSubscription(Base):
    __tablename__ = "push_subscriptions"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, nullable=True)
    endpoint = Column(Text, nullable=False, unique=True)
    keys = Column(JSON, nullable=False)
    created_at = Column(DateTime, server_default=func.now())

    def __repr__(self) -> str:
        return f"<PushSubscription id={self.id} user_id={self.user_id}>"
