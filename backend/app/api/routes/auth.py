import logging
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import get_password_hash, verify_password
from app.core.jwt_handler import create_access_token
from app.database.database import get_db
from app.database.models.user import User
from app.database.models.invoice import Bill
from app.database.models.system_activity import SystemActivity
from app.database.schemas.auth_schema import UserLogin, Token
from app.database.schemas.user_schema import UserRegister, UserResponse
from app.api.dependencies import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/auth", tags=["auth"])

import re

def validate_password(password: str):
    if len(password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters long.")
    if not re.search(r"[A-Z]", password):
        raise HTTPException(status_code=400, detail="Password must contain at least one uppercase letter (A-Z).")
    if not re.search(r"[a-z]", password):
        raise HTTPException(status_code=400, detail="Password must contain at least one lowercase letter (a-z).")
    if not re.search(r"\d", password):
        raise HTTPException(status_code=400, detail="Password must contain at least one number (0-9).")
    if not re.search(r"[^A-Za-z\d]", password):
        raise HTTPException(status_code=400, detail="Password must contain at least one special character.")

@router.post("/register", response_model=Token)
async def register(user_data: UserRegister, db: Session = Depends(get_db)):
    # Validate password requirements
    validate_password(user_data.password)

    # Check if user already exists
    existing_user = db.query(User).filter(User.email == user_data.email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    try:
        new_user = User(
            name=user_data.name,
            email=user_data.email,
            password_hash=get_password_hash(user_data.password),
            plan="Free",
            is_admin=False,
            status="active"
        )
        db.add(new_user)
        db.commit()
        db.refresh(new_user)

        # Create activity log
        activity = SystemActivity(
            user_id=new_user.id,
            user_name=new_user.name,
            activity_type="info",
            message=f"User {new_user.name} registered a new account."
        )
        db.add(activity)
        db.commit()

        # Generate JWT token
        token_data = {"sub": new_user.email}
        token = create_access_token(data=token_data)

        return {
            "access_token": token,
            "token_type": "bearer",
            "user": {
                "id": new_user.id,
                "name": new_user.name,
                "email": new_user.email,
                "plan": new_user.plan,
                "is_admin": new_user.is_admin
            }
        }
    except Exception as e:
        db.rollback()
        logger.error(f"Error registering user: {e}")
        raise HTTPException(status_code=500, detail="Internal server error during registration")


@router.post("/login", response_model=Token)
async def login(login_data: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == login_data.email).first()
    if not user or not verify_password(login_data.password, user.password_hash):
        raise HTTPException(status_code=400, detail="Incorrect email or password")

    if user.status != "active":
        raise HTTPException(status_code=403, detail="Your account has been suspended.")

    # Create token
    token_data = {"sub": user.email}
    token = create_access_token(data=token_data)

    # Log activity
    activity = SystemActivity(
        user_id=user.id,
        user_name=user.name,
        activity_type="info",
        message=f"User {user.name} logged in."
    )
    db.add(activity)
    db.commit()

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "plan": user.plan,
            "is_admin": user.is_admin
        }
    }


from pydantic import BaseModel

class GoogleLoginRequest(BaseModel):
    access_token: str

@router.post("/google", response_model=Token)
async def google_login(payload: GoogleLoginRequest, db: Session = Depends(get_db)):
    if not payload.access_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Access token is required"
        )

    # 1. Call Google API to verify access token
    import httpx
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"https://www.googleapis.com/oauth2/v3/userinfo?access_token={payload.access_token}"
            )
            if response.status_code != 200:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid Google access token"
                )
            user_info = response.json()
            email = user_info.get("email")
            name = user_info.get("name", email.split("@")[0].title() if email else "User")
            if not email:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Google account must have an email address"
                )
    except httpx.RequestError as e:
        logger.error(f"Error calling Google UserInfo API: {e}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to contact Google identity provider"
        )


    # 3. Check if user exists, else register them
    user = db.query(User).filter(User.email == email).first()
    if not user:
        # Create a new user with random password
        import secrets
        random_password = secrets.token_urlsafe(32)
        try:
            user = User(
                name=name,
                email=email,
                password_hash=get_password_hash(random_password),
                plan="Free",
                is_admin=False,
                status="active"
            )
            db.add(user)
            db.commit()
            db.refresh(user)

            # Create activity log
            activity = SystemActivity(
                user_id=user.id,
                user_name=user.name,
                activity_type="info",
                message=f"User {user.name} registered via Google OAuth."
            )
            db.add(activity)
            db.commit()
        except Exception as e:
            db.rollback()
            logger.error(f"Error registering user via Google: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Database error during Google user registration"
            )

    if user.status != "active":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has been suspended."
        )

    # 4. Generate local JWT access token
    token_data = {"sub": user.email}
    token = create_access_token(data=token_data)

    # Log login activity
    activity = SystemActivity(
        user_id=user.id,
        user_name=user.name,
        activity_type="info",
        message=f"User {user.name} logged in via Google OAuth."
    )
    db.add(activity)
    db.commit()

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "plan": user.plan,
            "is_admin": user.is_admin
        }
    }


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    uploads_used = db.query(Bill).filter(Bill.user_id == current_user.id).count()
    uploads_limit = 10 if current_user.plan == "Free" else 1000000

    return {
        "id": current_user.id,
        "name": current_user.name,
        "email": current_user.email,
        "plan": current_user.plan,
        "is_admin": current_user.is_admin,
        "status": current_user.status,
        "uploads_used": uploads_used,
        "uploads_limit": uploads_limit
    }


@router.post("/upgrade")
async def upgrade_plan(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        current_user.plan = "Pro"
        db.commit()

        # Log activity
        activity = SystemActivity(
            user_id=current_user.id,
            user_name=current_user.name,
            activity_type="success",
            message=f"User {current_user.name} upgraded to Premium Pro."
        )
        db.add(activity)
        db.commit()

        return {"message": "Success", "plan": "Pro"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


import random
import datetime
import smtplib
from email.mime.text import MIMEText
from app.core.config import SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM

class ForgotPasswordRequest(BaseModel):
    email: str

class ResetPasswordRequest(BaseModel):
    email: str
    otp_code: str
    new_password: str

@router.post("/forgot-password")
async def forgot_password(payload: ForgotPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user:
        # Return standard message to prevent email enumeration
        return {"message": "If this email is registered, an OTP code has been sent."}

    # Generate 6-digit numeric OTP code
    otp = f"{random.randint(100000, 999999)}"
    user.otp_code = otp
    user.otp_expires_at = datetime.datetime.utcnow() + datetime.timedelta(minutes=10)
    db.commit()

    logger.info(f"Generated password reset OTP for {payload.email}")


    # Send via SMTP if configured
    if SMTP_USER and SMTP_PASS:
        try:
            msg = MIMEText(f"Your OTP code for resetting your password on BillVault AI is: {otp}. This code expires in 10 minutes.")
            msg['Subject'] = 'BillVault AI - Password Reset OTP'
            msg['From'] = SMTP_FROM or SMTP_USER
            msg['To'] = payload.email

            with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
                server.starttls()
                server.login(SMTP_USER, SMTP_PASS)
                server.sendmail(msg['From'], [payload.email], msg.as_string())
            logger.info(f"OTP email sent successfully to {payload.email}")
        except Exception as e:
            logger.error(f"Failed to send SMTP email: {e}")

    return {"message": "If this email is registered, an OTP code has been sent."}

@router.post("/reset-password")
async def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)):
    # Validate password strength first
    validate_password(payload.new_password)

    user = db.query(User).filter(User.email == payload.email).first()
    if not user:
        raise HTTPException(status_code=400, detail="Invalid email or password reset request.")

    if not user.otp_code or user.otp_code != payload.otp_code:
        raise HTTPException(status_code=400, detail="Invalid OTP code.")

    if not user.otp_expires_at or user.otp_expires_at < datetime.datetime.utcnow():
        raise HTTPException(status_code=400, detail="OTP has expired. Please request a new one.")

    # Reset password
    user.password_hash = get_password_hash(payload.new_password)
    user.otp_code = None
    user.otp_expires_at = None
    db.commit()

    # Log activity
    activity = SystemActivity(
        user_id=user.id,
        user_name=user.name,
        activity_type="success",
        message=f"User {user.name} reset their password via Email OTP."
    )
    db.add(activity)
    db.commit()

    return {"message": "Password reset successful. You can now login."}
