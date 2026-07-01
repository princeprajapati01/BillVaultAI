from typing import Optional
from pydantic import BaseModel

class BillUpdate(BaseModel):
    merchant_name: Optional[str] = None
    invoice_total: Optional[float] = None
    tax_amount: Optional[float] = None
    invoice_number: Optional[str] = None
    invoice_date: Optional[str] = None
    gst_number: Optional[str] = None
    subtotal: Optional[float] = None
    payment_method: Optional[str] = None
    transaction_id: Optional[str] = None
    notes: Optional[str] = None
    category: Optional[str] = None
    due_date: Optional[str] = None
    payment_terms: Optional[str] = None
    balance_due: Optional[float] = None
    amount_paid: Optional[float] = None
    payment_status: Optional[str] = None
    status_reason: Optional[str] = None
