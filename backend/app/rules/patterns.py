import re

PATTERNS = {
    'invoice_number': [
        re.compile(r'[i1l]?nvoice(?:\s*details|\s*number|\s*no\.?|\s*id)?\s*#?\s*:?\s*([A-Z0-9][A-Z0-9\-/]{3,})', re.IGNORECASE),
        re.compile(r'[i1l]?nv\s*no\.?\s*:?\s*([A-Z0-9][A-Z0-9\-/]*)', re.IGNORECASE),
        re.compile(r'bill\s*no\.?\s*:?\s*([A-Z0-9][A-Z0-9\-/]*)', re.IGNORECASE),
        re.compile(r'\b([I1l]N?V?-[A-Z0-9\-/]+)\b', re.IGNORECASE),
        re.compile(r'\b([ILl]N?V?\d{3,})\b', re.IGNORECASE),
        re.compile(r'\b(1[NV][NV]?\d{3,})\b', re.IGNORECASE),
    ],
    'date': [
        re.compile(r'(?<!\d)(\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4})(?!\d)', re.IGNORECASE),
        re.compile(r'(?<!\d)(\d{4}[/\-.]\d{1,2}[/\-.]\d{1,2})(?!\d)', re.IGNORECASE),
        re.compile(r'\b(\d{1,2}(?:st|nd|rd|th)?\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4})\b', re.IGNORECASE),
        re.compile(r'\b((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2}(?:st|nd|rd|th)?\s*,?\s*\d{4})\b', re.IGNORECASE),
    ],
    'gst_number': [
        re.compile(r'([0-9OI]{2}[A-Z10I]{5}[0-9OI]{4}[A-Z10I]{1}[A-Z0-9]{1}[Z2Ss]{1}[A-Z0-9]{1})', re.IGNORECASE),
        re.compile(r'GSTIN\s*:?\s*([A-Z0-9]{15})', re.IGNORECASE),
    ],
    'amount': [
        re.compile(r'(?:Rs\.?|INR|₹|\$|USD)?\s*(\b\d+(?:[.,]\d+)*\b)'),
        re.compile(r'(\b\d+(?:[.,]\d+)*\b)\s*(?:Rs\.?|INR|₹|\$)'),
    ],
    'email': [
        re.compile(r'\b([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})\b'),
    ],
    'phone': [
        re.compile(r'(?:Tel|Ph|Phone|Mobile|Mob)\.?\s*:?\s*([\+\d\s\-\(\)]{10,15})', re.IGNORECASE),
        re.compile(r'\b(\+?91[-\s]?\d{10})\b'),
    ],
    'pan_number': [
        re.compile(r'\b([A-Z]{5}[0-9]{4}[A-Z]{1})\b', re.IGNORECASE),
    ],
}

KEYWORDS = {
    'total': ['total', 'grand total', 'amount due', 'net payable', 'total amount', 'balance due'],
    'subtotal': ['subtotal', 'sub total', 'taxable amount', 'net amount'],
    'tax': ['tax', 'gst', 'vat', 'cgst', 'sgst', 'igst', 'cess'],
    'company': ['pvt ltd', 'private limited', 'ltd', 'llp', 'inc', 'corporation', 'enterprises', 'solutions'],
    'invoice': ['invoice', 'tax invoice', 'proforma', 'bill', 'receipt'],
    'date': ['date', 'dated', 'issue date', 'invoice date', 'bill date'],
}
