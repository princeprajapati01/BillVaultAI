import re

PATTERNS = {
    'invoice_number': [
        re.compile(r'\b(?:proforma(?:\s*invoice)?|challan|order|p\.?o\.?|p\.?i\.?)\s*(?:no\.?|#|number)\s*:?\s*([A-Za-z0-9][A-Za-z0-9\-/]*)', re.IGNORECASE),
        re.compile(r'\b[i1l]?nvoice(?:\s*(?:details|number|no\.?|id|#))?\s*:?\s*(?!\b(?:no\s+signature|signature|required|validity|needed|computer)\b)([A-Z0-9][A-Z0-9\-/]+)\b', re.IGNORECASE),
        re.compile(r'\b[i1l]?nv\s*no\.?\s*:?\s*([A-Z0-9][A-Z0-9\-/]+)\b', re.IGNORECASE),
        re.compile(r'\bbill\s*no\.?\s*:?\s*([A-Z0-9][A-Z0-9\-/]+)\b', re.IGNORECASE),
        re.compile(r'\b([I1l]N?V?-[A-Z0-9\-/]+)\b', re.IGNORECASE),
        re.compile(r'\b([ILl]N?V?\d{3,})\b', re.IGNORECASE),
        re.compile(r'\b(1[NV][NV]?\d{3,})\b', re.IGNORECASE),
    ],
    'date': [
        re.compile(r'(?<!\d)(\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4})(?!\d)', re.IGNORECASE),
        re.compile(r'(?<!\d)(\d{4}[/\-.]\d{1,2}[/\-.]\d{1,2})(?!\d)', re.IGNORECASE),
        re.compile(r'\b(\d{1,2}(?:st|nd|rd|th)?[-\s/.](?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[-\s/.]\d{2,4})\b', re.IGNORECASE),
        re.compile(r'\b((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[-\s/.]\d{1,2}(?:st|nd|rd|th)?[-\s/.]\d{2,4})\b', re.IGNORECASE),
    ],
    'gst_number': [
        re.compile(r'([0-9OI]{2}[A-Z10I]{5}[0-9OI]{4}[A-Z10I]{1}[A-Z0-9]{1}[Z2Ss]{1}[A-Z0-9]{1})', re.IGNORECASE),
        re.compile(r'GSTIN\s*:?\s*([A-Z0-9]{14,16})', re.IGNORECASE),
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
    'total': ['total amount after tax', 'total', 'grand total', 'amount due', 'net payable', 'total amount', 'balance due'],
    'subtotal': ['taxable amount', 'taxable value', 'subtotal', 'sub total', 'net amount'],
    'tax': ['total tax', 'tax', 'gst', 'vat', 'cgst', 'sgst', 'igst', 'cess'],
    'company': ['pvt ltd', 'private limited', 'ltd', 'llp', 'inc', 'corporation', 'corp', 'enterprises', 'solutions', 'services', 'technologies', 'industries', 'ventures', 'group', 'holdings', 'agency', 'stores', 'bazaar', 'mart', 'supermarket', 'gmbh', 'company', 'tools', 'freight', 'works', 'motors', 'engineering', 'manufacturing', 'logistics', 'hardware', 'supplies', 'systems', 'consultants'],
    'invoice': ['invoice', 'tax invoice', 'proforma', 'bill', 'receipt'],
    'date': ['date', 'dated', 'issue date', 'invoice date', 'bill date', 'proforma date'],
}
