from app.pipeline.semantic_engine import SemanticEngine
from app.pipeline.ocr_engine import OCRResult

def test_total_extraction():
    # Test 1: Quantity total vs actual total
    ocr_results_1 = [
        OCRResult(
            region_id=1,
            text="Total Qty.: 18",
            confidence=0.90,
            box=(50, 600, 200, 630),
            yolo_hint="invoice_total"
        ),
        OCRResult(
            region_id=2,
            text="TOTAL 153.35",
            confidence=0.95,
            box=(50, 700, 200, 730),
            yolo_hint="invoice_total"
        )
    ]
    
    engine = SemanticEngine((1000, 800, 3))
    classified_1 = engine.classify(ocr_results_1)
    
    print("\n=== TEST 1 CLASSIFIED FIELDS ===")
    print(f"Grand Total: {classified_1['amounts']['grand_total']}")
        
    total_val_1 = classified_1.get('amounts', {}).get('grand_total', {}).get('value')
    assert total_val_1 == 153.35, f"Test 1 failed: Expected total 153.35, but got {total_val_1}"
    print("Test 1 passed: Total resolved correctly to 153.35!")

    # Test 2: Subtotal vs actual total
    ocr_results_2 = [
        OCRResult(
            region_id=1,
            text="Subtotal: 630.00",
            confidence=0.92,
            box=(100, 500, 300, 530),
            yolo_hint="invoice_total"
        ),
        OCRResult(
            region_id=2,
            text="TOTAL: 705.60",
            confidence=0.95,
            box=(100, 600, 300, 630),
            yolo_hint="invoice_total"
        )
    ]
    
    classified_2 = engine.classify(ocr_results_2)
    print("\n=== TEST 2 CLASSIFIED FIELDS ===")
    print(f"Subtotal: {classified_2['amounts']['subtotal']}")
    print(f"Grand Total: {classified_2['amounts']['grand_total']}")
        
    subtotal_val = classified_2.get('amounts', {}).get('subtotal', {}).get('value')
    total_val_2 = classified_2.get('amounts', {}).get('grand_total', {}).get('value')
    
    assert subtotal_val == 630.00, f"Test 2 failed: Expected subtotal 630.00, but got {subtotal_val}"
    assert total_val_2 == 705.60, f"Test 2 failed: Expected total 705.60, but got {total_val_2}"
    print("Test 2 passed: Subtotal and Total correctly separated!")

    # Test 3: Multiple amounts on TOTAL row (e.g. tax total and invoice total)
    ocr_results_3 = [
        OCRResult(
            region_id=1,
            text="TOTAL:",
            confidence=0.95,
            box=(50, 600, 150, 630),
            yolo_hint="invoice_total"
        ),
        OCRResult(
            region_id=2,
            text="251.10",
            confidence=0.92,
            box=(400, 600, 500, 630),
            yolo_hint="invoice_total"
        ),
        OCRResult(
            region_id=3,
            text="1,646.10",
            confidence=0.95,
            box=(600, 600, 700, 630),
            yolo_hint="invoice_total"
        )
    ]
    
    classified_3 = engine.classify(ocr_results_3)
    print("\n=== TEST 3 CLASSIFIED FIELDS ===")
    print(f"Grand Total: {classified_3['amounts']['grand_total']}")
        
    total_val_3 = classified_3.get('amounts', {}).get('grand_total', {}).get('value')
    assert total_val_3 == 1646.10, f"Test 3 failed: Expected total 1646.10, but got {total_val_3}"
    print("Test 3 passed: Multiple amounts on TOTAL row correctly resolved to the rightmost/largest amount!")

    # Test 4: Table-based extraction of CGST, SGST, Subtotal, and Invoice Total
    ocr_results_4 = [
        # Headers (Row 1)
        OCRResult(1, "GST IND", 0.95, (50, 490, 120, 510), "unmapped_ocr"),
        OCRResult(2, "Taxable Value", 0.95, (150, 490, 250, 510), "unmapped_ocr"),
        OCRResult(3, "CGST", 0.98, (300, 490, 360, 510), "unmapped_ocr"),
        OCRResult(4, "SGST", 0.98, (400, 490, 460, 510), "unmapped_ocr"),
        OCRResult(5, "CESS", 0.92, (500, 490, 550, 510), "unmapped_ocr"),
        OCRResult(6, "Total Amount", 0.96, (600, 490, 700, 510), "unmapped_ocr"),
        
        # Data row 1
        OCRResult(7, "A)", 0.90, (50, 540, 70, 560), "unmapped_ocr"),
        OCRResult(8, "₹569.52", 0.95, (150, 540, 230, 560), "unmapped_ocr"),
        OCRResult(9, "₹14.24", 0.95, (300, 540, 350, 560), "unmapped_ocr"),
        OCRResult(10, "₹14.24", 0.95, (400, 540, 450, 560), "unmapped_ocr"),
        OCRResult(11, "₹0.00", 0.90, (500, 540, 540, 560), "unmapped_ocr"),
        OCRResult(12, "₹598.00", 0.96, (600, 540, 680, 560), "unmapped_ocr"),
        
        # Data row 2 (Total row)
        OCRResult(13, "Total", 0.95, (50, 590, 100, 610), "unmapped_ocr"),
        OCRResult(14, "₹569.52", 0.95, (150, 590, 230, 610), "unmapped_ocr"),
        OCRResult(15, "₹14.24", 0.95, (300, 590, 350, 610), "unmapped_ocr"),
        OCRResult(16, "₹14.24", 0.95, (400, 590, 450, 610), "unmapped_ocr"),
        OCRResult(17, "₹0.00", 0.90, (500, 590, 540, 610), "unmapped_ocr"),
        OCRResult(18, "₹598.00", 0.96, (600, 590, 680, 610), "unmapped_ocr")
    ]
    
    classified_4 = engine.classify(ocr_results_4)
    print("\n=== TEST 4 CLASSIFIED FIELDS ===")
    print(f"CGST: {classified_4['taxes']['cgst_amount']}")
    print(f"SGST: {classified_4['taxes']['sgst_amount']}")
    print(f"Subtotal: {classified_4['amounts']['subtotal']}")
    print(f"Grand Total: {classified_4['amounts']['grand_total']}")
        
    cgst_val = classified_4.get('taxes', {}).get('cgst_amount', {}).get('value')
    sgst_val = classified_4.get('taxes', {}).get('sgst_amount', {}).get('value')
    subtotal_val = classified_4.get('amounts', {}).get('subtotal', {}).get('value')
    total_val_4 = classified_4.get('amounts', {}).get('grand_total', {}).get('value')
    
    assert cgst_val == 14.24, f"Test 4 failed: Expected cgst 14.24, but got {cgst_val}"
    assert sgst_val == 14.24, f"Test 4 failed: Expected sgst 14.24, but got {sgst_val}"
    assert subtotal_val == 569.52, f"Test 4 failed: Expected subtotal 569.52, but got {subtotal_val}"
    assert total_val_4 == 598.00, f"Test 4 failed: Expected total 598.00, but got {total_val_4}"
    print("Test 4 passed: Table-based extraction of CGST, SGST, Subtotal, and Total successfully resolved!")

    # Test 5: Verify multi-line description merging when item name is missing on a priced row (prevents KeyError)
    ocr_results_5 = [
        # Headers (Row 1)
        OCRResult(1, "Description", 0.95, (100, 100, 200, 120), "unmapped_ocr"),
        OCRResult(2, "Amount", 0.95, (600, 100, 700, 120), "unmapped_ocr"),

        # Row 2 (Only price matches, no item_name matched under Description header column)
        OCRResult(3, "1,200.00", 0.95, (600, 150, 700, 170), "unmapped_ocr"),

        # Row 3 (Multi-line description text row, no price)
        OCRResult(4, "Additional details for item", 0.95, (100, 190, 300, 210), "unmapped_ocr")
    ]

    classified_5 = engine.classify(ocr_results_5)
    print("\n=== TEST 5 CLASSIFIED FIELDS ===")
    print(f"Items extracted: {classified_5['items']}")
    
    assert len(classified_5['items']) == 1, f"Test 5 failed: Expected 1 item, but got {len(classified_5['items'])}"
    # The item name should have been merged/defaulted correctly
    item = classified_5['items'][0]
    assert item['line_total'] == 1200.0, f"Test 5 failed: Expected item line total 1200.0, but got {item['line_total']}"
    assert "Additional details" in item['item_name'], f"Test 5 failed: Expected description to merge, but got '{item['item_name']}'"
    print("Test 5 passed: Multi-line description merged correctly without KeyError!")

    # Test 6: Bank account number vs actual total (XYZ Solutions style)
    ocr_results_6 = [
        # Subtotal
        OCRResult(1, "Subtotal: 1,135.00", 0.95, (100, 500, 300, 520), "unmapped_ocr"),
        # Tax
        OCRResult(2, "Tax (10%): 113.50", 0.95, (100, 530, 300, 550), "unmapped_ocr"),
        # Bank Account Number (bottom of page)
        OCRResult(3, "ACCT: 1234567890", 0.95, (100, 900, 300, 920), "unmapped_ocr"),
        # Actual total
        OCRResult(4, "1,248.50", 0.95, (600, 560, 700, 580), "unmapped_ocr")
    ]

    classified_6 = engine.classify(ocr_results_6)
    print("\n=== TEST 6 CLASSIFIED FIELDS ===")
    print(f"Subtotal: {classified_6['amounts']['subtotal']}")
    print(f"Tax: {classified_6['taxes']['tax_amount']}")
    print(f"Grand Total: {classified_6['amounts']['grand_total']}")

    subtotal_val_6 = classified_6.get('amounts', {}).get('subtotal', {}).get('value')
    total_val_6 = classified_6.get('amounts', {}).get('grand_total', {}).get('value')

    assert subtotal_val_6 == 1135.00, f"Test 6 failed: Expected subtotal 1135.00, but got {subtotal_val_6}"
    assert total_val_6 == 1248.50, f"Test 6 failed: Expected total 1248.50 (not account number), but got {total_val_6}"
    print("Test 6 passed: Bank account number correctly ignored and total resolved to 1248.50 using subtotal + tax expectation!")

    # Test 7: XYZ Solutions invoice mimicking overlap in Total Amount Due vs Balance Due vs Payment Terms numbers
    ocr_results_7 = [
        # Subtotal
        OCRResult(1, "Subtotal", 0.95, (100, 470, 200, 490), "unmapped_ocr"),
        OCRResult(2, "1,135.00", 0.95, (600, 470, 700, 490), "unmapped_ocr"),
        # Tax
        OCRResult(3, "Tax (10%)", 0.95, (100, 500, 200, 520), "unmapped_ocr"),
        OCRResult(4, "113.50", 0.95, (600, 500, 700, 520), "unmapped_ocr"),
        # Total Amount Due
        OCRResult(5, "Total Amount Due", 0.95, (100, 530, 300, 550), "unmapped_ocr"),
        OCRResult(6, "1,248.50", 0.95, (600, 530, 700, 550), "unmapped_ocr"),
        # Payment Terms text (with distracting numeric values like 2 and 14)
        OCRResult(7, "A late fee of 2% may be added to the total after the 14 days due date", 0.95, (100, 700, 500, 720), "unmapped_ocr")
    ]

    classified_7 = engine.classify(ocr_results_7)
    print("\n=== TEST 7 CLASSIFIED FIELDS ===")
    print(f"Subtotal: {classified_7['amounts']['subtotal']}")
    print(f"Tax: {classified_7['taxes']['tax_amount']}")
    print(f"Grand Total: {classified_7['amounts']['grand_total']}")

    subtotal_val_7 = classified_7.get('amounts', {}).get('subtotal', {}).get('value')
    total_val_7 = classified_7.get('amounts', {}).get('grand_total', {}).get('value')

    assert subtotal_val_7 == 1135.00, f"Test 7 failed: Expected subtotal 1135.00, but got {subtotal_val_7}"
    assert total_val_7 == 1248.50, f"Test 7 failed: Expected total 1248.50 (not 14.00), but got {total_val_7}"
    print("Test 7 passed: Total Amount Due correctly resolved to 1248.50 even with late fee of 2% and 14 days terms present!")



def test_date_and_invoice_number_extraction():
    engine = SemanticEngine((1000, 800, 3))

    # Test Case 1: Run-together DATE11/05/2020 label
    ocr_results_1 = [
        OCRResult(1, "INVOICE DATE11/05/2020", 0.95, (100, 100, 300, 120), "unmapped_ocr"),
        OCRResult(2, "Invoice Number INV-10012", 0.95, (100, 150, 300, 170), "unmapped_ocr")
    ]
    classified_1 = engine.classify(ocr_results_1)
    print("\n=== DATE & INV NUM TEST 1 ===")
    print(f"Extracted Date: {classified_1.get('invoice_details', {}).get('invoice_date')}")
    print(f"Extracted Number: {classified_1.get('invoice_details', {}).get('invoice_number')}")
    assert classified_1.get('invoice_details', {}).get('invoice_date', {}).get('value') == "11/05/2020", f"Expected date 11/05/2020, got {classified_1.get('invoice_details', {}).get('invoice_date')}"
    assert classified_1.get('invoice_details', {}).get('invoice_number', {}).get('value') == "INV-10012", f"Expected number INV-10012, got {classified_1.get('invoice_details', {}).get('invoice_number')}"
    print("Passed Test 1: run-together date resolved, did not corrupt invoice number.")

    # Test Case 2: 1561 Apploview Town street address number
    ocr_results_2 = [
        OCRResult(1, "1561 Apploview Town", 0.90, (100, 100, 300, 120), "unmapped_ocr"),
        # We add some other field so that extraction doesn't find nothing
        OCRResult(2, "Invoice Number INV-10012", 0.95, (100, 150, 300, 170), "unmapped_ocr")
    ]
    classified_2 = engine.classify(ocr_results_2)
    print("\n=== DATE & INV NUM TEST 2 ===")
    print(f"Extracted Number: {classified_2.get('invoice_details', {}).get('invoice_number')}")
    assert classified_2.get('invoice_details', {}).get('invoice_number', {}).get('value') != "1561", "1561 was incorrectly classified as invoice number"
    assert classified_2.get('invoice_details', {}).get('invoice_number', {}).get('value') == "INV-10012", f"Expected number INV-10012, got {classified_2.get('invoice_details', {}).get('invoice_number')}"
    print("Passed Test 2: Address number ignored as invoice number.")

    # Test Case 3: Word month names like April 8, 2015 and October 2, 2083
    ocr_results_3 = [
        OCRResult(1, "Invoice Date", 0.95, (100, 100, 200, 120), "unmapped_ocr"),
        OCRResult(2, "April 8, 2015", 0.95, (220, 100, 320, 120), "unmapped_ocr"),
        OCRResult(3, "Due Date October 2, 2083", 0.95, (100, 150, 400, 170), "unmapped_ocr")
    ]
    classified_3 = engine.classify(ocr_results_3)
    print("\n=== DATE & INV NUM TEST 3 ===")
    print(f"Extracted Invoice Date: {classified_3.get('invoice_details', {}).get('invoice_date')}")
    print(f"Extracted Due Date: {classified_3.get('invoice_details', {}).get('due_date')}")
    assert classified_3.get('invoice_details', {}).get('invoice_date', {}).get('value') == "08/04/2015", f"Expected 08/04/2015, got {classified_3.get('invoice_details', {}).get('invoice_date')}"
    assert classified_3.get('invoice_details', {}).get('due_date', {}).get('value') == "02/10/2083", f"Expected 02/10/2083, got {classified_3.get('invoice_details', {}).get('due_date')}"
    print("Passed Test 3: Word-based months parsed and formatted to DD/MM/YYYY.")

    # Test Case 4: Single-digit day/month numeric dates
    ocr_results_4 = [
        OCRResult(1, "Invoice Date", 0.95, (100, 100, 200, 120), "unmapped_ocr"),
        OCRResult(2, "26/3/2021", 0.95, (220, 100, 320, 120), "unmapped_ocr")
    ]
    classified_4 = engine.classify(ocr_results_4)
    print("\n=== DATE & INV NUM TEST 4 ===")
    print(f"Extracted Invoice Date: {classified_4.get('invoice_details', {}).get('invoice_date')}")
    assert classified_4.get('invoice_details', {}).get('invoice_date', {}).get('value') == "26/03/2021", f"Expected 26/03/2021, got {classified_4.get('invoice_details', {}).get('invoice_date')}"
    print("Passed Test 4: Single-digit day/month normalized to DD/MM/YYYY.")

if __name__ == "__main__":
    test_total_extraction()
    test_date_and_invoice_number_extraction()
