import os
import uuid
import shutil
import logging
import asyncio
import threading
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks
from starlette.concurrency import run_in_threadpool
from sqlalchemy.orm import Session

from app.core.config import UPLOADS_DIR, MAX_CONCURRENT_JOBS
from app.core import pipeline_state
from app.database.database import get_db, SessionLocal
from app.database.models.user import User
from app.database.models.invoice import Bill
from app.database.models.system_activity import SystemActivity
from app.database.schemas.invoice_schema import BillUpdate
from app.api.dependencies import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(tags=["invoices"])

_pipeline_semaphore = threading.Semaphore(max(1, int(MAX_CONCURRENT_JOBS)))


def detect_currency(raw_ocr: str = "") -> str:
    text = raw_ocr or ""
    if "$" in text or "USD" in text.upper():
        return "USD"
    if "₹" in text or "INR" in text.upper() or "Rs." in text or "Rs " in text:
        return "INR"
    if "€" in text or "EUR" in text.upper():
        return "EUR"
    if "£" in text or "GBP" in text.upper():
        return "GBP"
    return "INR"

def process_bill_in_background(bill_id: int, permanent_file_path: str, save_filename: str, user_id: int):
    # Retrieve a new database session
    db = SessionLocal()
    try:
        if pipeline_state.pipeline is None:
            raise Exception("IDP Pipeline is not loaded. Please check model path configuration.")

        # Run AI Pipeline with thread semaphore
        with _pipeline_semaphore:
            result = pipeline_state.pipeline.process(permanent_file_path)

        bill = db.query(Bill).filter(Bill.id == bill_id).first()
        if not bill:
            logger.error(f"Bill ID {bill_id} not found in database for background processing.")
            return

        # Extract classification fields from nested structure
        fields = result.get("fields", {})
        vendor = fields.get("vendor", {}).get("vendor_name", {}).get("value") or "Unknown Merchant"
        
        try:
            total_val = float(fields.get("amounts", {}).get("grand_total", {}).get("value") or 0.0)
        except Exception:
            total_val = 0.0
            
        try:
            cgst = float(fields.get("taxes", {}).get("cgst_amount", {}).get("value") or 0.0)
            sgst = float(fields.get("taxes", {}).get("sgst_amount", {}).get("value") or 0.0)
            igst = float(fields.get("taxes", {}).get("igst_amount", {}).get("value") or 0.0)
            tax = float(fields.get("taxes", {}).get("tax_amount", {}).get("value") or 0.0)
        except Exception:
            cgst = sgst = igst = tax = 0.0

        if tax == 0.0:
            tax = cgst + sgst + igst

        inv_no = fields.get("invoice_details", {}).get("invoice_number", {}).get("value") or "Not detected"
        inv_date = fields.get("invoice_details", {}).get("invoice_date", {}).get("value") or "Not detected"
        gst_no = fields.get("vendor", {}).get("vendor_gstin", {}).get("value") or None
        
        try:
            sub_total = fields.get("amounts", {}).get("subtotal", {}).get("value")
            if sub_total is not None:
                sub_total = float(sub_total)
            else:
                sub_total = total_val - tax
        except Exception:
            sub_total = total_val - tax

        pay_method = fields.get("payment", {}).get("payment_method", {}).get("value") or None
        tx_id = fields.get("payment", {}).get("transaction_id", {}).get("value") or None
        cat_val = fields.get("category") or "Office"

        # Calculate average confidence from the engine's confidence dictionary
        conf_dict = fields.get("confidence", {})
        conf_values = [v for v in conf_dict.values() if v is not None]
        avg_conf = (sum(conf_values) / len(conf_values) / 100.0) if conf_values else 1.0

        due_date_val = fields.get("invoice_details", {}).get("due_date", {}).get("value") or None
        payment_terms_val = fields.get("payment", {}).get("payment_terms", {}).get("value") or None
        
        try:
            balance_due_val = fields.get("payment", {}).get("balance_due", {}).get("value")
            balance_due_val = float(balance_due_val) if balance_due_val is not None else None
        except Exception:
            balance_due_val = None

        try:
            amount_paid_val = fields.get("payment", {}).get("amount_paid", {}).get("value")
            amount_paid_val = float(amount_paid_val) if amount_paid_val is not None else None
        except Exception:
            amount_paid_val = None

        if total_val > 0:
            if balance_due_val is None and amount_paid_val is not None:
                balance_due_val = max(0.0, total_val - amount_paid_val)
            elif amount_paid_val is None and balance_due_val is not None:
                amount_paid_val = max(0.0, total_val - balance_due_val)

        payment_status_val = fields.get("payment_status") or "UNKNOWN"
        status_reason_val = fields.get("status_reason") or "No payment information was found."

        # Update db_bill fields
        bill.merchant_name = vendor
        bill.invoice_total = total_val
        bill.tax_amount = tax
        bill.cgst_amount = cgst
        bill.sgst_amount = sgst
        bill.igst_amount = igst
        bill.invoice_number = inv_no
        bill.invoice_date = inv_date
        bill.gst_number = gst_no
        bill.subtotal = sub_total
        bill.payment_method = pay_method
        bill.transaction_id = tx_id
        bill.confidence_score = avg_conf
        bill.raw_ocr = result.get("raw_ocr", "")
        bill.category = cat_val
        bill.due_date = due_date_val
        bill.payment_terms = payment_terms_val
        bill.balance_due = balance_due_val
        bill.amount_paid = amount_paid_val
        bill.payment_status = payment_status_val
        bill.status_reason = status_reason_val
        bill.status = "processed"

        db.commit()

        # Log system activity
        user = db.query(User).filter(User.id == user_id).first()
        user_name = user.name if user else f"User {user_id}"
        activity = SystemActivity(
            user_id=user_id,
            user_name=user_name,
            activity_type="success",
            message=f"User {user_name} processed invoice '{inv_no}' from {vendor} for ₹{total_val:,.2f}"
        )
        db.add(activity)
        db.commit()

    except Exception as e:
        logger.error(f"Error processing document in background: {str(e)}", exc_info=True)
        # Update bill status to failed
        try:
            bill = db.query(Bill).filter(Bill.id == bill_id).first()
            if bill:
                bill.status = "failed"
                db.commit()
        except Exception as db_err:
            logger.error(f"Failed to update bill status to failed: {str(db_err)}")
        
        # Cleanup file if processing failed
        if os.path.exists(permanent_file_path):
            try:
                os.remove(permanent_file_path)
            except Exception:
                pass
    finally:
        db.close()


@router.post("/process/document")
async def process_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if pipeline_state.pipeline is None:
        raise HTTPException(
            status_code=503,
            detail="IDP Pipeline is not loaded. Please check model path configuration."
        )

    # 1. Validate file type
    if not file.filename.lower().endswith(('.png', '.jpg', '.jpeg', '.bmp', '.tiff')):
        raise HTTPException(
            status_code=400,
            detail="Unsupported file type. Please upload a valid image (PNG, JPG, JPEG, BMP, TIFF)."
        )

    # 2. Check upload limits for free users
    if current_user.plan == "Free":
        bill_count = db.query(Bill).filter(Bill.user_id == current_user.id).count()
        if bill_count >= 10:
            activity = SystemActivity(
                user_id=current_user.id,
                user_name=current_user.name,
                activity_type="warning",
                message=f"User {current_user.name} hit the Free tier upload limit of 10 bills."
            )
            db.add(activity)
            db.commit()
            raise HTTPException(
                status_code=403,
                detail="Free tier limit of 10 uploads reached. Please upgrade to Pro for unlimited uploads."
            )

    # 3. Generate secure local file path
    job_id = str(uuid.uuid4())
    file_ext = os.path.splitext(file.filename)[1] or ".png"
    save_filename = f"{job_id}{file_ext}"
    permanent_file_path = os.path.join(UPLOADS_DIR, save_filename)

    try:
        # Save file permanently on disk
        with open(permanent_file_path, "wb") as f:
            shutil.copyfileobj(file.file, f)

        # Construct public URL
        image_web_url = f"http://localhost:8000/uploads/{save_filename}"

        # Create placeholder Bill record in database
        db_bill = Bill(
            user_id=current_user.id,
            merchant_name="Processing...",
            invoice_total=0.0,
            tax_amount=0.0,
            cgst_amount=0.0,
            sgst_amount=0.0,
            igst_amount=0.0,
            invoice_number="Processing...",
            invoice_date="Processing...",
            gst_number=None,
            subtotal=0.0,
            payment_method=None,
            transaction_id=None,
            notes=None,
            confidence_score=0.0,
            image_url=image_web_url,
            raw_ocr="",
            category="Office",
            status="processing"
        )
        db.add(db_bill)
        db.commit()
        db.refresh(db_bill)

        # Queue the background task
        background_tasks.add_task(
            process_bill_in_background,
            db_bill.id,
            permanent_file_path,
            save_filename,
            current_user.id
        )

        # Format and return standard JSON response immediately
        return {
            "id": db_bill.id,
            "merchant": db_bill.merchant_name,
            "amount": db_bill.invoice_total,
            "gst": db_bill.tax_amount,
            "invoiceNumber": db_bill.invoice_number,
            "date": db_bill.invoice_date,
            "gstNumber": db_bill.gst_number,
            "subtotal": db_bill.subtotal,
            "paymentMethod": db_bill.payment_method,
            "transactionId": db_bill.transaction_id,
            "notes": db_bill.notes,
            "confidence": 0,
            "imageUrl": db_bill.image_url,
            "rawOCR": db_bill.raw_ocr,
            "category": db_bill.category,
            "status": db_bill.status,
            "dueDate": db_bill.due_date,
            "paymentTerms": db_bill.payment_terms,
            "balanceDue": db_bill.balance_due,
            "amountPaid": db_bill.amount_paid,
            "paymentStatus": db_bill.payment_status,
            "statusReason": db_bill.status_reason,
            "fields": {},  # Backward compatibility
            "job_id": job_id
        }

    except Exception as e:
        logger.error(f"Error processing document: {str(e)}", exc_info=True)
        # Cleanup file if processing failed
        if os.path.exists(permanent_file_path):
            try:
                os.remove(permanent_file_path)
            except Exception:
                pass
        raise HTTPException(status_code=500, detail=f"Internal processing error: {str(e)}")


@router.get("/api/bills")
async def get_bills(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    bills = db.query(Bill).filter(Bill.user_id == current_user.id).order_by(Bill.id.desc()).all()
    formatted = []
    for bill in bills:
        formatted.append({
            "id": bill.id,
            "merchant": bill.merchant_name or "Unknown Merchant",
            "amount": bill.invoice_total or 0.0,
            "gst": bill.tax_amount or 0.0,
            "cgst": bill.cgst_amount or 0.0,
            "sgst": bill.sgst_amount or 0.0,
            "igst": bill.igst_amount or 0.0,
            "gstNumber": bill.gst_number,
            "subtotal": bill.subtotal or 0.0,
            "paymentMethod": bill.payment_method,
            "transactionId": bill.transaction_id,
            "notes": bill.notes,
            "date": bill.invoice_date or "Not detected",
            "category": bill.category,
            "status": bill.status,
            "dueDate": bill.due_date,
            "paymentTerms": bill.payment_terms,
            "balanceDue": bill.balance_due or 0.0,
            "amountPaid": bill.amount_paid or 0.0,
            "paymentStatus": bill.payment_status or "UNKNOWN",
            "statusReason": bill.status_reason,
            "imageUrl": bill.image_url,
            "invoiceNumber": bill.invoice_number,
            "confidence": int(bill.confidence_score * 100),
            "rawOCR": bill.raw_ocr,
            "currency": detect_currency(bill.raw_ocr or ""),
            "thumbnail": "📄"
        })
    return formatted


@router.get("/api/bills/{bill_id}")
async def get_bill_detail(bill_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    bill = db.query(Bill).filter(Bill.id == bill_id, Bill.user_id == current_user.id).first()
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")
        
    return {
        "id": bill.id,
        "merchant": bill.merchant_name or "Unknown Merchant",
        "amount": bill.invoice_total or 0.0,
        "gst": bill.tax_amount or 0.0,
        "cgst": bill.cgst_amount or 0.0,
        "sgst": bill.sgst_amount or 0.0,
        "igst": bill.igst_amount or 0.0,
        "gstNumber": bill.gst_number or "",
        "subtotal": bill.subtotal or 0.0,
        "paymentMethod": bill.payment_method or "",
        "transactionId": bill.transaction_id or "",
        "notes": bill.notes or "",
        "invoiceNumber": bill.invoice_number or "Not detected",
        "date": bill.invoice_date or "Not detected",
        "category": bill.category,
        "status": bill.status,
        "dueDate": bill.due_date or "",
        "paymentTerms": bill.payment_terms or "",
        "balanceDue": bill.balance_due or 0.0,
        "amountPaid": bill.amount_paid or 0.0,
        "paymentStatus": bill.payment_status or "UNKNOWN",
        "statusReason": bill.status_reason or "",
        "confidence": int(bill.confidence_score * 100),
        "imageUrl": bill.image_url,
        "rawOCR": bill.raw_ocr or "No raw OCR text available.",
        "currency": detect_currency(bill.raw_ocr or ""),
        "metadata": {
            "uploadDate": bill.created_at.strftime("%B %d, %Y"),
            "processingTime": "1.8 seconds",
            "category": bill.category
        }
    }


@router.put("/api/bills/{bill_id}")
async def update_bill(
    bill_id: int, 
    bill_data: BillUpdate, 
    current_user: User = Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    bill = db.query(Bill).filter(Bill.id == bill_id, Bill.user_id == current_user.id).first()
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")

    try:
        if bill_data.merchant_name is not None:
            bill.merchant_name = bill_data.merchant_name
        if bill_data.invoice_total is not None:
            bill.invoice_total = bill_data.invoice_total
        if bill_data.tax_amount is not None:
            bill.tax_amount = bill_data.tax_amount
        if bill_data.invoice_number is not None:
            bill.invoice_number = bill_data.invoice_number
        if bill_data.invoice_date is not None:
            bill.invoice_date = bill_data.invoice_date
        if bill_data.gst_number is not None:
            bill.gst_number = bill_data.gst_number
        if bill_data.subtotal is not None:
            bill.subtotal = bill_data.subtotal
        if bill_data.payment_method is not None:
            bill.payment_method = bill_data.payment_method
        if bill_data.transaction_id is not None:
            bill.transaction_id = bill_data.transaction_id
        if bill_data.notes is not None:
            bill.notes = bill_data.notes
        if bill_data.category is not None:
            bill.category = bill_data.category
        if bill_data.due_date is not None:
            bill.due_date = bill_data.due_date
        if bill_data.payment_terms is not None:
            bill.payment_terms = bill_data.payment_terms
        if bill_data.balance_due is not None:
            bill.balance_due = bill_data.balance_due
        if bill_data.amount_paid is not None:
            bill.amount_paid = bill_data.amount_paid
        if bill_data.payment_status is not None:
            bill.payment_status = bill_data.payment_status
        if bill_data.status_reason is not None:
            bill.status_reason = bill_data.status_reason

        # Recalculate due date if not explicitly set
        if bill_data.due_date is None:
            from app.pipeline.semantic_engine import resolve_due_date
            bill.due_date = resolve_due_date(
                due_date_str=bill.due_date,
                payment_terms_str=bill.payment_terms,
                invoice_date_str=bill.invoice_date
            )

        # Recalculate payment status and reason if not explicitly set
        if bill_data.payment_status is None:
            from app.pipeline.semantic_engine import resolve_payment_status
            status, reason = resolve_payment_status(
                full_text=bill.raw_ocr or "",
                balance_due=bill.balance_due,
                amount_paid=bill.amount_paid,
                total_amount=bill.invoice_total,
                due_date_str=bill.due_date
            )
            bill.payment_status = status
            bill.status_reason = reason

        db.commit()
        db.refresh(bill)

        # Log activity
        activity = SystemActivity(
            user_id=current_user.id,
            user_name=current_user.name,
            activity_type="info",
            message=f"User {current_user.name} updated bill fields for Invoice {bill.invoice_number}."
        )
        db.add(activity)
        db.commit()

        return {"message": "Bill updated successfully", "id": bill.id}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/api/bills/{bill_id}")
async def delete_bill(bill_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    bill = db.query(Bill).filter(Bill.id == bill_id, Bill.user_id == current_user.id).first()
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")

    try:
        # Delete image from disk if possible
        if bill.image_url:
            filename = bill.image_url.split("/")[-1]
            filepath = os.path.join(UPLOADS_DIR, filename)
            if os.path.exists(filepath):
                try:
                    os.remove(filepath)
                except Exception:
                    pass

        inv_num = bill.invoice_number
        db.delete(bill)

        # Log activity
        activity = SystemActivity(
            user_id=current_user.id,
            user_name=current_user.name,
            activity_type="warning",
            message=f"User {current_user.name} deleted Invoice {inv_num}."
        )
        db.add(activity)
        db.commit()

        return {"message": "Bill deleted successfully"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

from app.database.models.feedback import Feedback

@router.post("/api/feedback")
async def create_feedback(data: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rating = data.get("rating")
    comment = data.get("comment")
    
    if rating is None:
        raise HTTPException(status_code=400, detail="Rating is required")
    try:
        rating_int = int(rating)
        if rating_int < 1 or rating_int > 5:
            raise ValueError()
    except ValueError:
        raise HTTPException(status_code=400, detail="Rating must be an integer between 1 and 5")
        
    feedback = Feedback(
        user_id=current_user.id,
        user_name=current_user.name,
        user_email=current_user.email,
        rating=rating_int,
        comment=comment
    )
    db.add(feedback)
    
    # Log activity
    activity = SystemActivity(
        user_id=current_user.id,
        user_name=current_user.name,
        activity_type="success",
        message=f"User {current_user.name} submitted a {rating_int}-star rating feedback."
    )
    db.add(activity)
    
    db.commit()
    db.refresh(feedback)
    return {"message": "Feedback submitted successfully", "id": feedback.id}
