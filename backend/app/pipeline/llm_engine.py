import os
import base64
import json
import logging
import re
from typing import Dict, Any, Optional
from huggingface_hub import InferenceClient
from app.core.config import HUGGINGFACE_API_KEY, HUGGINGFACE_MODEL
from app.pipeline.semantic_engine import (
    resolve_payment_status,
    normalize_date,
    normalize_gstin,
    normalize_invoice_number
)

logger = logging.getLogger(__name__)

def encode_image_to_base64(image_path: str) -> str:
    """Encode local image file to base64 string."""
    with open(image_path, "rb") as image_file:
        return base64.b64encode(image_file.read()).decode("utf-8")

def clean_and_parse_json(text: str) -> dict:
    """Extract and parse JSON from LLM response text."""
    text_clean = text.strip()
    
    # Strip markdown code blocks if present
    if text_clean.startswith("```"):
        # Find ending fence
        lines = text_clean.split("\n")
        if lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        text_clean = "\n".join(lines).strip()
    
    # Strip leading 'json' keyword
    if text_clean.lower().startswith("json"):
        text_clean = text_clean[4:].strip()
        
    # Use regex to find outer brackets if still failing to parse directly
    try:
        return json.loads(text_clean)
    except json.JSONDecodeError:
        match = re.search(r"(\{.*\}|\[.*\])", text_clean, re.DOTALL)
        if match:
            return json.loads(match.group(1))
        raise

def map_llm_json_to_schema(llm_data: dict, raw_ocr_text: str) -> dict:
    """Map flat JSON output from LLM to the system's structured nested schema."""
    def sanitize_string(val):
        if not isinstance(val, str):
            return None
        stripped = val.strip()
        placeholders = {
            "n/a", "na", "none", "null", "unknown", "not detected", "not available", 
            "not applicable", "not found", "undefined", "-", "unspecified", "nil", ""
        }
        if stripped.lower() in placeholders:
            return None
        return stripped

    def sanitize_numeric(val):
        if val is None:
            return None
        if isinstance(val, (int, float)):
            return float(val)
        if isinstance(val, str):
            # Strip currency symbols and formatting commas
            cleaned = re.sub(r"[^\d.-]", "", val)
            try:
                return float(cleaned)
            except ValueError:
                return None
        return None

    def f(val, conf=95, src="", reas="Extracted via Qwen2.5-VL", is_num=False):
        if is_num:
            val = sanitize_numeric(val)
        else:
            val = sanitize_string(val)
            if isinstance(val, str) and len(val) > 250:
                val = val[:247] + "..."
        return {
            "value": val,
            "confidence": conf if val is not None else 0,
            "source_text": src or (str(val) if val is not None else ""),
            "reason": reas
        }

    # Extract fields with safe fallbacks
    raw_doc_type = sanitize_string(llm_data.get("document_type")) or "invoice"
    doc_type = raw_doc_type.lower()
    if doc_type not in ["invoice", "receipt", "other"]:
        text_lower = raw_ocr_text.lower()
        if "receipt" in text_lower or "sales slip" in text_lower or "ticket" in text_lower:
            doc_type = "receipt"
        elif "invoice" in text_lower or "bill" in text_lower:
            doc_type = "invoice"
        else:
            doc_type = "other"

    category = sanitize_string(llm_data.get("category")) or "Office Supplies"
    
    # Normalize keys where applicable
    raw_vendor_gstin = sanitize_string(llm_data.get("vendor_gstin"))
    vendor_gstin = normalize_gstin(raw_vendor_gstin) if raw_vendor_gstin else None
    
    raw_customer_gstin = sanitize_string(llm_data.get("customer_gstin"))
    customer_gstin = normalize_gstin(raw_customer_gstin) if raw_customer_gstin else None

    raw_inv_no = sanitize_string(llm_data.get("invoice_number"))
    inv_no = normalize_invoice_number(raw_inv_no) if raw_inv_no else None

    raw_inv_date = sanitize_string(llm_data.get("invoice_date"))
    inv_date = normalize_date(raw_inv_date) if raw_inv_date else None

    raw_due_date = sanitize_string(llm_data.get("due_date"))
    due_date = normalize_date(raw_due_date) if raw_due_date else None

    mapped = {
        "document_type": doc_type,
        "vendor": {
            "vendor_name": f(llm_data.get("vendor_name")),
            "vendor_address": f(llm_data.get("vendor_address")),
            "vendor_gstin": f(vendor_gstin),
            "vendor_email": f(llm_data.get("vendor_email")),
            "vendor_phone": f(llm_data.get("vendor_phone"))
        },
        "customer": {
            "customer_name": f(llm_data.get("customer_name")),
            "customer_company": f(llm_data.get("customer_company")),
            "customer_address": f(llm_data.get("customer_address")),
            "customer_gstin": f(customer_gstin)
        },
        "invoice_details": {
            "invoice_number": f(inv_no),
            "invoice_date": f(inv_date),
            "due_date": f(due_date)
        },
        "amounts": {
            "subtotal": f(llm_data.get("subtotal"), is_num=True),
            "grand_total": f(llm_data.get("grand_total"), is_num=True)
        },
        "taxes": {
            "cgst_amount": f(llm_data.get("cgst_amount"), is_num=True),
            "sgst_amount": f(llm_data.get("sgst_amount"), is_num=True),
            "igst_amount": f(llm_data.get("igst_amount"), is_num=True),
            "tax_amount": f(llm_data.get("tax_amount"), is_num=True)
        },
        "payment": {
            "payment_method": f(llm_data.get("payment_method")),
            "transaction_id": f(llm_data.get("transaction_id")),
            "payment_terms": f(llm_data.get("payment_terms")),
            "balance_due": f(llm_data.get("balance_due"), is_num=True),
            "amount_paid": f(llm_data.get("amount_paid"), is_num=True)
        },
        "payment_status": "UNPAID",
        "status_reason": "",
        "items": [],
        "category": category,
        "confidence": {
            "document_type": 95,
            "vendor_name": 95 if sanitize_string(llm_data.get("vendor_name")) else 0,
            "invoice_number": 95 if inv_no else 0,
            "invoice_date": 95 if inv_date else 0,
            "grand_total": 95 if sanitize_numeric(llm_data.get("grand_total")) is not None else 0
        },
        "warnings": []
    }

    # Format line items
    for item in llm_data.get("items", []):
        desc = sanitize_string(item.get("description"))
        qty = sanitize_numeric(item.get("quantity"))
        uprice = sanitize_numeric(item.get("unit_price"))
        tot = sanitize_numeric(item.get("total_amount"))
        
        # Heuristic recalculation of line total if missing
        if tot is None and qty is not None and uprice is not None:
            tot = qty * uprice

        mapped["items"].append({
            "description": desc,
            "quantity": qty,
            "unit_price": uprice,
            "total_amount": tot,
            "tax_rate": sanitize_numeric(item.get("tax_rate")),
            "hsn_code": sanitize_string(item.get("hsn_code"))
        })

    # Resolve payment status
    payment_status, status_reason = resolve_payment_status(
        raw_ocr_text,
        mapped["payment"]["balance_due"]["value"],
        mapped["payment"]["amount_paid"]["value"],
        mapped["amounts"]["grand_total"]["value"],
        mapped["invoice_details"]["due_date"]["value"]
    )
    mapped["payment_status"] = payment_status
    mapped["status_reason"] = status_reason

    return mapped

def extract_with_huggingface(image_path: str, raw_ocr_text: str) -> Optional[dict]:
    """Query Hugging Face Inference API with Qwen2.5-VL to extract invoice info."""
    if not HUGGINGFACE_API_KEY:
        logger.info("Hugging Face API key not configured. Using rule-based SemanticEngine.")
        return None

    try:
        logger.info(f"Initializing Hugging Face InferenceClient with model: {HUGGINGFACE_MODEL}")
        client = InferenceClient(token=HUGGINGFACE_API_KEY)
        
        # Determine if the model is a VL (vision) model
        is_vl = "vl" in HUGGINGFACE_MODEL.lower()
        
        system_prompt = (
            "You are an advanced Invoice and Receipt Information Extraction AI.\n"
            "Your task is to extract structured information from the provided document and return it as a valid JSON object.\n"
            "Do not include any chat formatting, markdown code blocks (like ```json), or explanatory text. Return ONLY the JSON object itself.\n\n"
            "CRITICAL EXTRACTION INSTRUCTIONS:\n"
            "1. If any field or value is missing, not mentioned, or not applicable in the document, you MUST set its value to JSON null. Do NOT use placeholder strings like 'N/A', 'None', 'not detected', 'unknown', 'nil', or '-'.\n"
            "2. For all float or numeric fields (e.g., grand_total, subtotal, taxes, balance_due, amount_paid, unit_price, qty), return a clean float or integer value. DO NOT include currency symbols (like $, Rs., Rs, ₹, €), commas, formatting, or letters. If it's not a valid number, return null.\n"
            "3. Strictly categorize 'document_type' as either 'invoice' (bills, invoices, credit memos), 'receipt' (small cash slips, POS receipts, tickets), or 'other'.\n"
            "4. Provide the exact text matches for GSTINs (must be 15-character alphanumeric values if possible) and dates.\n\n"
            "The JSON schema must be exactly:\n"
            "{\n"
            '  "document_type": "invoice" | "receipt" | "other",\n'
            '  "vendor_name": string or null,\n'
            '  "vendor_address": string or null,\n'
            '  "vendor_gstin": string or null,\n'
            '  "vendor_email": string or null,\n'
            '  "vendor_phone": string or null,\n'
            '  "customer_name": string or null,\n'
            '  "customer_company": string or null,\n'
            '  "customer_address": string or null,\n'
            '  "customer_gstin": string or null,\n'
            '  "invoice_number": string or null,\n'
            '  "invoice_date": string or null,\n'
            '  "due_date": string or null,\n'
            '  "subtotal": float or null,\n'
            '  "grand_total": float or null,\n'
            '  "cgst_amount": float or null,\n'
            '  "sgst_amount": float or null,\n'
            '  "igst_amount": float or null,\n'
            '  "tax_amount": float or null,\n'
            '  "payment_method": string or null (IMPORTANT: if the document contains detailed bank details like Bank Name, Account Number/Name, IFSC, write out the details here, do not default to generic labels. Max 250 chars),\n'
            '  "transaction_id": string or null,\n'
            '  "payment_terms": string or null,\n'
            '  "balance_due": float or null,\n'
            '  "amount_paid": float or null,\n'
            '  "items": [\n'
            "    {\n"
            '      "description": string or null,\n'
            '      "quantity": float or null,\n'
            '      "unit_price": float or null,\n'
            '      "total_amount": float or null,\n'
            '      "tax_rate": float or null,\n'
            '      "hsn_code": string or null\n'
            "    }\n"
            "  ],\n"
            '  "category": "Office Supplies" | "Travel" | "Fuel" | "Food" | "Medical" | "Software" | "Marketing" | "Utilities" | "Electronics" | "Subscription" | "Entertainment"\n'
            "}\n"
        )
        
        user_prompt = f"Here is the OCR extracted text from the document to ensure exact values and spelling:\n\n{raw_ocr_text}\n\nPlease extract and return the structured JSON."
        
        if is_vl:
            logger.info("Using Multimodal (Vision-Language) prompt with base64 image")
            try:
                base64_image = encode_image_to_base64(image_path)
                # Detect format from extension
                ext = os.path.splitext(image_path)[1].lower().replace(".", "")
                mime_type = f"image/{ext}" if ext in ["png", "jpg", "jpeg", "webp"] else "image/jpeg"
                image_url = f"data:{mime_type};base64,{base64_image}"
                
                messages = [
                    {
                        "role": "system",
                        "content": system_prompt
                    },
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "image_url",
                                "image_url": {"url": image_url}
                            },
                            {
                                "type": "text",
                                "text": user_prompt
                            }
                        ]
                    }
                ]
            except Exception as img_err:
                logger.warning(f"Failed to prepare image base64, falling back to text-only mode: {img_err}")
                messages = [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ]
        else:
            logger.info("Using text-only prompt (model does not support vision or is configured for text)")
            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ]

        # Call the chat completion endpoint
        response = client.chat.completions.create(
            model=HUGGINGFACE_MODEL,
            messages=messages,
            max_tokens=2000
        )
        
        response_text = response.choices[0].message.content
        logger.info(f"Successfully received response from Hugging Face: {response_text[:300]}...")
        
        parsed_json = clean_and_parse_json(response_text)
        mapped_result = map_llm_json_to_schema(parsed_json, raw_ocr_text)
        return mapped_result

    except Exception as e:
        logger.error(f"Hugging Face Extraction failed: {e}. Falling back to rule-based SemanticEngine.")
        return None
