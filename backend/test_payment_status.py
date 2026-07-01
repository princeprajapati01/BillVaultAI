import sys
import os
import datetime

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.pipeline.semantic_engine import parse_payment_terms_days, resolve_due_date, resolve_payment_status

def test_parse_payment_terms():
    assert parse_payment_terms_days("Net 30") == 30
    assert parse_payment_terms_days("30 Days") == 30
    assert parse_payment_terms_days("Net 15 days") == 15
    assert parse_payment_terms_days("Due on receipt") is None
    assert parse_payment_terms_days(None) is None
    print("[PASS] test_parse_payment_terms")

def test_resolve_due_date():
    # If due_date exists, use it
    assert resolve_due_date("15/12/2026", "Net 30", "01/12/2026") == "15/12/2026"
    
    # Due on Receipt -> same as invoice date
    assert resolve_due_date(None, "Due on receipt", "10/05/2026") == "10/05/2026"
    
    # Net 10 -> invoice date + 10 days
    assert resolve_due_date(None, "Net 10", "10/05/2026") == "20/05/2026"
    assert resolve_due_date("Not detected", "Net 10", "10/05/2026") == "20/05/2026"
    
    # No payment terms / invalid
    assert resolve_due_date(None, None, "10/05/2026") is None
    print("[PASS] test_resolve_due_date")

def test_resolve_payment_status():
    # Cancelled / Void
    status, reason = resolve_payment_status("This invoice is cancelled", 100.0, 0.0, 100.0, "15/12/2026")
    assert status == "CANCELLED"
    
    # Paid (balance_due = 0)
    status, reason = resolve_payment_status("Normal invoice", 0.0, 100.0, 100.0, "15/12/2026")
    assert status == "PAID"
    
    # Paid (amount_paid >= total)
    status, reason = resolve_payment_status("Normal invoice", None, 120.0, 100.0, "15/12/2026")
    assert status == "PAID"

    # Unpaid (balance_due == total)
    status, reason = resolve_payment_status("Normal invoice", 100.0, 0.0, 100.0, "15/12/2030")
    assert status == "UNPAID"

    # Partially Paid (0 < balance < total)
    status, reason = resolve_payment_status("Normal invoice", 40.0, 60.0, 100.0, "15/12/2030")
    assert status == "UNPAID"

    # Overdue (balance > 0 and due date in past)
    past_date = (datetime.date.today() - datetime.timedelta(days=5)).strftime("%d/%m/%Y")
    status, reason = resolve_payment_status("Normal invoice", 50.0, 50.0, 100.0, past_date)
    assert status == "OVERDUE"

    # Unknown (missing details, but due date is present in future -> Unpaid)
    status, reason = resolve_payment_status("Normal invoice", None, None, 100.0, "15/12/2030")
    assert status == "UNPAID"

    # Unknown (missing details, but due date is present in past -> Overdue)
    past_date = (datetime.date.today() - datetime.timedelta(days=1)).strftime("%d/%m/%Y")
    status, reason = resolve_payment_status("Normal invoice", None, None, 100.0, past_date)
    assert status == "OVERDUE"

    # Unknown (no due date at all -> UNKNOWN)
    status, reason = resolve_payment_status("Normal invoice", None, None, 100.0, None)
    assert status == "UNKNOWN"

    status, reason = resolve_payment_status("Normal invoice", None, None, 100.0, "Not detected")
    assert status == "UNKNOWN"

    print("[PASS] test_resolve_payment_status")

if __name__ == "__main__":
    test_parse_payment_terms()
    test_resolve_due_date()
    test_resolve_payment_status()
    print("All tests passed successfully!")
