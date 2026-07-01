import sys
import os

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.pipeline.ocr_engine import OCRResult
from app.pipeline.semantic_engine import SemanticEngine

def test_extract_payment_method_with_header():
    # 1. Setup mock OCRResults representing an invoice with a PAYMENT INFORMATION section
    ocr_results = [
        OCRResult(1, "PAYMENT INFORMATION", 0.99, (50, 800, 250, 825), "payment_info_header"),
        OCRResult(2, "Briard Bank", 0.95, (50, 835, 180, 855), "bank_name"),
        OCRResult(3, "Account Name: Samira Hadid", 0.97, (50, 865, 300, 885), "account_name"),
        OCRResult(4, "Account No.: 123-456-7890", 0.98, (50, 895, 320, 915), "account_no"),
        OCRResult(5, "Pay by: 5 July 2025", 0.96, (50, 925, 260, 945), "pay_by_date"),
        # Add unrelated text nearby horizontally (e.g. a signature on the right)
        OCRResult(6, "Samira Hadid", 0.95, (500, 885, 650, 910), "signature"),
        OCRResult(7, "123 Anywhere St., Any City", 0.95, (500, 920, 750, 945), "address")
    ]
    
    engine = SemanticEngine((1000, 800))
    payment_method, conf, reason = engine._extract_payment_method(ocr_results)
    
    print(f"Extracted payment method: {payment_method}")
    print(f"Confidence: {conf}")
    print(f"Reason: {reason}")
    
    # Assertions
    assert "Briard Bank" in payment_method
    assert "Account Name: Samira Hadid" in payment_method
    assert "Account No.: 123-456-7890" in payment_method
    assert "Pay by: 5 July 2025" in payment_method
    assert "123 Anywhere St." not in payment_method # Should exclude right-side text
    assert conf == 95
    print("[PASS] test_extract_payment_method_with_header")

def test_extract_payment_method_explicit_only():
    # 2. Setup mock OCRResults with only explicit account keywords and no header
    ocr_results = [
        OCRResult(1, "Payable to Samira Hadid", 0.95, (50, 800, 300, 825), "text"),
        OCRResult(2, "Bank Account: 123-456-7890", 0.98, (50, 835, 320, 855), "bank_account"),
        OCRResult(3, "IFSC Code: BRID0001234", 0.97, (50, 865, 300, 885), "ifsc")
    ]
    
    engine = SemanticEngine((1000, 800))
    payment_method, conf, reason = engine._extract_payment_method(ocr_results)
    
    print(f"Extracted payment method: {payment_method}")
    
    # Assertions
    assert "Bank Account: 123-456-7890" in payment_method
    assert "IFSC Code: BRID0001234" in payment_method
    assert conf == 95
    print("[PASS] test_extract_payment_method_explicit_only")

def test_extract_payment_method_fallback():
    # 3. Setup mock OCRResults with keyword matching fallback
    ocr_results = [
        OCRResult(1, "Payment via UPI / GPay accepted", 0.95, (50, 800, 300, 825), "text")
    ]
    
    engine = SemanticEngine((1000, 800))
    payment_method, conf, reason = engine._extract_payment_method(ocr_results)
    
    print(f"Extracted payment method: {payment_method}")
    
    # Assertions
    assert payment_method == "UPI"
    assert conf == 90
    print("[PASS] test_extract_payment_method_fallback")

def test_extract_payment_method_default():
    # 4. Setup mock OCRResults with no payment info (should default to Cash)
    ocr_results = [
        OCRResult(1, "Thank you for shopping with us", 0.95, (50, 800, 300, 825), "text")
    ]
    
    engine = SemanticEngine((1000, 800))
    payment_method, conf, reason = engine._extract_payment_method(ocr_results)
    
    print(f"Extracted payment method: {payment_method}")
    
    # Assertions
    assert payment_method == "Cash"
    assert conf == 50
    print("[PASS] test_extract_payment_method_default")

if __name__ == "__main__":
    test_extract_payment_method_with_header()
    test_extract_payment_method_explicit_only()
    test_extract_payment_method_fallback()
    test_extract_payment_method_default()
    print("All payment method extraction tests passed successfully!")
