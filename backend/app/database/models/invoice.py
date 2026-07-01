import datetime
from sqlalchemy import Column, Integer, String, Float, Text, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from app.database.database import Base

class Bill(Base):
    __tablename__ = "bills"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    merchant_name = Column(String(150), nullable=True)
    invoice_total = Column(Float, nullable=True, default=0.0)
    tax_amount = Column(Float, nullable=True, default=0.0)
    cgst_amount = Column(Float, nullable=True, default=0.0)
    sgst_amount = Column(Float, nullable=True, default=0.0)
    igst_amount = Column(Float, nullable=True, default=0.0)
    invoice_number = Column(String(100), nullable=True)
    invoice_date = Column(String(100), nullable=True)
    gst_number = Column(String(100), nullable=True)
    subtotal = Column(Float, nullable=True, default=0.0)
    payment_method = Column(String(100), nullable=True)
    transaction_id = Column(String(100), nullable=True)
    notes = Column(Text, nullable=True)
    confidence_score = Column(Float, nullable=True, default=1.0)
    image_url = Column(Text, nullable=True)
    raw_ocr = Column(Text, nullable=True)
    category = Column(String(100), default="Office")
    status = Column(String(50), default="processed")
    due_date = Column(String(100), nullable=True)
    payment_terms = Column(String(100), nullable=True)
    balance_due = Column(Float, nullable=True, default=0.0)
    amount_paid = Column(Float, nullable=True, default=0.0)
    payment_status = Column(String(50), default="UNKNOWN")
    status_reason = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="bills")
