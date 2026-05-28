"""TransferRequest model — GS-052 inter-warehouse supply transfers."""

from sqlalchemy import Column, DateTime, Integer, String, Text
from sqlalchemy.sql import func

from .base import Base


class TransferRequest(Base):
    __tablename__ = "transfer_requests"

    id = Column(Integer, primary_key=True)
    from_warehouse_id = Column(Integer, nullable=False)
    to_warehouse_id = Column(Integer, nullable=False)
    item_id = Column(Integer, nullable=False)
    quantity = Column(Integer, nullable=False)
    requested_by = Column(Integer, nullable=True)
    approved_by = Column(Integer, nullable=True)
    status = Column(String(50), nullable=False, default="pending")
    note = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    def __repr__(self) -> str:
        return f"<TransferRequest id={self.id} status='{self.status}'>"
