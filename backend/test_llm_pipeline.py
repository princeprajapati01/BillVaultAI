import sys
import os
import json
from unittest.mock import MagicMock, patch

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.pipeline.llm_engine import clean_and_parse_json, map_llm_json_to_schema, extract_with_huggingface
from app.pipeline.pipeline import IDPPipeline
from app.pipeline.ocr_engine import OCRResult

def test_clean_and_parse_json():
    # Test case 1: clean json
    raw = '{"document_type": "invoice"}'
    assert clean_and_parse_json(raw) == {"document_type": "invoice"}

    # Test case 2: markdown code block
    raw_md = '```json\n{"document_type": "invoice", "vendor_name": "Acme Inc"}\n```'
    assert clean_and_parse_json(raw_md) == {"document_type": "invoice", "vendor_name": "Acme Inc"}

    # Test case 3: raw text prefix
    raw_prefix = 'Here is the JSON you requested: \n```\n{"grand_total": 125.50}\n```'
    assert clean_and_parse_json(raw_prefix) == {"grand_total": 125.50}
    
    print("[PASS] test_clean_and_parse_json")

def test_map_llm_json_to_schema():
    llm_output = {
        "document_type": "invoice",
        "vendor_name": "Briard Bank",
        "vendor_address": "123 Main St",
        "vendor_gstin": "GST12345",
        "vendor_email": "info@briard.com",
        "vendor_phone": "1234567890",
        "customer_name": "Imani Olowe",
        "customer_company": "Hawkville Corp",
        "customer_address": "63 Ivy Road",
        "customer_gstin": "GST67890",
        "invoice_number": "12345",
        "invoice_date": "16/06/2025",
        "due_date": "05/07/2025",
        "subtotal": 500.0,
        "grand_total": 500.0,
        "cgst_amount": 0.0,
        "sgst_amount": 0.0,
        "igst_amount": 0.0,
        "tax_amount": 0.0,
        # Long payment method string (should be truncated to 250 chars)
        "payment_method": "Briard Bank, Account Name: Samira Hadid, Account No.: 123-456-7890, 123 Anywhere St., Any City, ST 12345, Pay by: 5 July 2025" * 3,
        "transaction_id": "TXN987",
        "payment_terms": "Net 30",
        "balance_due": 500.0,
        "amount_paid": 0.0,
        "items": [
            {
                "description": "Consulting Services",
                "quantity": 5.0,
                "unit_price": 100.0,
                "total_amount": 500.0,
                "tax_rate": 0.0,
                "hsn_code": "HSN123"
            }
        ],
        "category": "Office Supplies"
    }
    
    raw_ocr = "INVOICE\nBriard Bank\nSamira Hadid"
    mapped = map_llm_json_to_schema(llm_output, raw_ocr)
    
    # Assert type formatting and field extraction
    assert mapped["document_type"] == "invoice"
    assert mapped["vendor"]["vendor_name"]["value"] == "Briard Bank"
    assert mapped["amounts"]["grand_total"]["value"] == 500.0
    assert len(mapped["payment"]["payment_method"]["value"]) <= 250
    assert mapped["payment"]["payment_method"]["value"].endswith("...")
    assert len(mapped["items"]) == 1
    assert mapped["items"][0]["description"] == "Consulting Services"
    assert mapped["payment_status"] in ["UNPAID", "OVERDUE"] # Resolved based on execution date
    print("[PASS] test_map_llm_json_to_schema")

@patch('app.pipeline.llm_engine.InferenceClient')
@patch('app.pipeline.llm_engine.HUGGINGFACE_API_KEY', 'mock_api_key')
@patch('app.pipeline.llm_engine.HUGGINGFACE_MODEL', 'Qwen/Qwen2.5-VL-72B-Instruct')
def test_extract_with_huggingface_multimodal(mock_client_class):
    # Setup mock client response
    mock_client = MagicMock()
    mock_client_class.return_value = mock_client
    
    mock_response = MagicMock()
    mock_response.choices = [MagicMock(message=MagicMock(content='{"document_type": "invoice", "vendor_name": "Mock Vendor"}'))]
    mock_client.chat.completions.create.return_value = mock_response
    
    # Create dummy image file to prevent FileNotFoundError during encoding
    with open("temp_dummy_img.png", "wb") as f:
        f.write(b"dummy image bytes")
        
    try:
        result = extract_with_huggingface("temp_dummy_img.png", "Mock OCR text")
        
        # Verify result is mapped properly
        assert result is not None
        assert result["vendor"]["vendor_name"]["value"] == "Mock Vendor"
        
        # Verify InferenceClient was called with multimodal content (image + text)
        mock_client.chat.completions.create.assert_called_once()
        call_kwargs = mock_client.chat.completions.create.call_args[1]
        assert call_kwargs["model"] == "Qwen/Qwen2.5-VL-72B-Instruct"
        messages = call_kwargs["messages"]
        assert len(messages) == 2
        assert messages[1]["role"] == "user"
        # Check that user message is list content (multimodal)
        assert isinstance(messages[1]["content"], list)
        assert messages[1]["content"][0]["type"] == "image_url"
        
    finally:
        if os.path.exists("temp_dummy_img.png"):
            os.remove("temp_dummy_img.png")
            
    print("[PASS] test_extract_with_huggingface_multimodal")

@patch('app.pipeline.llm_engine.InferenceClient')
@patch('app.pipeline.llm_engine.HUGGINGFACE_API_KEY', 'mock_api_key')
@patch('app.pipeline.llm_engine.HUGGINGFACE_MODEL', 'Qwen/Qwen2.5-72B-Instruct')
def test_extract_with_huggingface_text_only(mock_client_class):
    mock_client = MagicMock()
    mock_client_class.return_value = mock_client
    
    mock_response = MagicMock()
    mock_response.choices = [MagicMock(message=MagicMock(content='{"document_type": "receipt", "vendor_name": "Mock Retail"}'))]
    mock_client.chat.completions.create.return_value = mock_response
    
    result = extract_with_huggingface("dummy_img.png", "Mock OCR text")
    
    assert result is not None
    assert result["document_type"] == "receipt"
    assert result["vendor"]["vendor_name"]["value"] == "Mock Retail"
    
    mock_client.chat.completions.create.assert_called_once()
    call_kwargs = mock_client.chat.completions.create.call_args[1]
    messages = call_kwargs["messages"]
    # Check that user message is a simple string content (text-only model)
    assert isinstance(messages[1]["content"], str)
    print("[PASS] test_extract_with_huggingface_text_only")

@patch('app.pipeline.pipeline.YOLODetector')
@patch('app.pipeline.pipeline.OCREngine')
@patch('app.pipeline.pipeline.HUGGINGFACE_API_KEY', '')
def test_pipeline_fallback_no_key(MockOCREngine, MockYOLODetector):
    # Setup mock instances
    mock_detector = MagicMock()
    mock_ocr = MagicMock()
    MockYOLODetector.return_value = mock_detector
    MockOCREngine.return_value = mock_ocr
    
    # If no key, pipeline should fall back to SemanticEngine immediately without calling LLM
    pipeline = IDPPipeline("best.pt")
    
    # Mock region detection and OCR output
    mock_detector.detect.return_value = []
    mock_ocr_res = OCRResult(1, "Briard Bank", 0.95, (50, 100, 200, 150), "text")
    mock_ocr.extract_all_regions.return_value = [mock_ocr_res]
    
    # Create dummy image to load
    with open("temp_pipeline_img.png", "wb") as f:
        import numpy as np
        import cv2
        img = np.ones((100, 100, 3), dtype=np.uint8) * 255
        cv2.imwrite("temp_pipeline_img.png", img)
        
    try:
        with patch('app.pipeline.pipeline.SemanticEngine') as MockSemanticEngine:
            mock_engine = MagicMock()
            MockSemanticEngine.return_value = mock_engine
            mock_engine.classify.return_value = {"vendor": {"vendor_name": {"value": "Rule Engine Output"}}}
            
            res = pipeline.process("temp_pipeline_img.png")
            
            # Verify it fell back to SemanticEngine
            MockSemanticEngine.assert_called_once()
            assert res["fields"]["vendor"]["vendor_name"]["value"] == "Rule Engine Output"
            
    finally:
        if os.path.exists("temp_pipeline_img.png"):
            os.remove("temp_pipeline_img.png")
            
    print("[PASS] test_pipeline_fallback_no_key")

def test_llm_sanitization_and_fallbacks():
    llm_output_junk = {
        "document_type": "cash bill receipt", 
        "vendor_name": "N/A", 
        "vendor_address": "none", 
        "vendor_gstin": "07AAAAA1111A1Z1", 
        "vendor_email": "Not Available", 
        "invoice_number": "inv-o0100", 
        "invoice_date": "16 June 2025", 
        "subtotal": "$1,200.50", 
        "grand_total": "₹ 1,200.50", 
        "items": [
            {
                "description": "Item 1",
                "quantity": "2.0",
                "unit_price": "600.25",
                "total_amount": None 
            }
        ]
    }
    raw_ocr = "TAX INVOICE receipt cashier store"
    mapped = map_llm_json_to_schema(llm_output_junk, raw_ocr)
    
    assert mapped["document_type"] == "receipt"
    assert mapped["vendor"]["vendor_name"]["value"] is None
    assert mapped["vendor"]["vendor_address"]["value"] is None
    assert mapped["vendor"]["vendor_email"]["value"] is None
    assert mapped["vendor"]["vendor_gstin"]["value"] == "07AAAAA1111A1Z1"
    assert mapped["invoice_details"]["invoice_number"]["value"] == "inv-00100"
    assert mapped["invoice_details"]["invoice_date"]["value"] == "16/06/2025"
    assert mapped["amounts"]["subtotal"]["value"] == 1200.50
    assert mapped["amounts"]["grand_total"]["value"] == 1200.50
    assert mapped["items"][0]["total_amount"] == 1200.50
    
    print("[PASS] test_llm_sanitization_and_fallbacks")

if __name__ == "__main__":
    test_clean_and_parse_json()
    test_map_llm_json_to_schema()
    test_llm_sanitization_and_fallbacks()
    test_extract_with_huggingface_multimodal()
    test_extract_with_huggingface_text_only()
    test_pipeline_fallback_no_key()
    print("All LLM pipeline tests passed successfully!")
