import io
import base64
import qrcode
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_

from backend.app.core.database import get_db
from backend.app.core.config import settings
from backend.app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    verify_admin_totp,
    get_totp_provisioning_uri,
    get_current_user
)
from backend.app.models.user import User
from backend.app.schemas.auth_schema import (
    UserRegisterRequest,
    UserLoginRequest,
    ForgotPasswordResetRequest,
    TokenResponse,
    UserResponse,
    TOTPSetupResponse
)

router = APIRouter(prefix="/auth", tags=["Authentication & Gatekeeper"])

@router.get("/totp-setup", response_model=TOTPSetupResponse)
def get_totp_setup(current_user: User = Depends(get_current_user)):
    """
    Returns the Master Secret Key and a QR code strictly to authenticated administrators.
    """
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrative privileges required to access 2FA setup."
        )
    uri = get_totp_provisioning_uri(account_name="Owner")
    
    # Generate QR Code in-memory
    qr = qrcode.QRCode(version=1, box_size=8, border=2)
    qr.add_data(uri)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    qr_b64 = base64.b64encode(buf.getvalue()).decode("utf-8")
    
    return TOTPSetupResponse(
        secret=settings.MASTER_ADMIN_TOTP_SECRET,
        otpauth_uri=uri,
        qr_code_base64=f"data:image/png;base64,{qr_b64}",
        instructions="Open Google Authenticator on your phone, tap '+' -> 'Scan a QR code' to link your Master Key."
    )

@router.post("/signup", response_model=TokenResponse)
def signup(payload: UserRegisterRequest, db: Session = Depends(get_db)):
    """
    Register a new user account.
    AIRTIGHT GATEKEEPER: Requires the live 6-digit Google Authenticator code from the software owner!
    """
    # 1. Verify Google Authenticator TOTP Code
    if not verify_admin_totp(payload.admin_totp_code):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid or expired Admin Authorization Code. Please obtain the live 6-digit code from the system administrator's Google Authenticator."
        )
    
    # 2. Check if username or email already exists
    existing_user = db.query(User).filter(
        or_(User.email == payload.email.lower().strip(), User.username == payload.username.lower().strip())
    ).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email or username already exists."
        )
        
    # Check if this is the very first user in the system -> make them admin
    total_users = db.query(User).count()
    assigned_role = "admin" if total_users == 0 else (payload.role or "candidate")
    
    # 3. Hash password and persist user
    clean_gemini_key = payload.gemini_api_key.strip() if (payload.gemini_api_key and payload.gemini_api_key.strip()) else None
    new_user = User(
        email=payload.email.lower().strip(),
        username=payload.username.lower().strip(),
        full_name=payload.full_name or payload.username,
        hashed_password=hash_password(payload.password),
        role=assigned_role,
        is_active=True,
        gemini_api_key=clean_gemini_key
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    # 4. Generate JWT access token
    access_token = create_access_token(
        data={"sub": str(new_user.id), "email": new_user.email, "role": new_user.role}
    )
    
    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse.model_validate(new_user)
    )

@router.post("/login", response_model=TokenResponse)
def login(payload: UserLoginRequest, db: Session = Depends(get_db)):
    """Log in with email or username and password to obtain a JWT access token."""
    login_id = payload.email_or_username.lower().strip()
    user = db.query(User).filter(
        or_(User.email == login_id, User.username == login_id)
    ).first()
    
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username/email or password."
        )
        
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This user account has been disabled."
        )
        
    access_token = create_access_token(
        data={"sub": str(user.id), "email": user.email, "role": user.role}
    )
    
    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse.model_validate(user)
    )

@router.post("/forgot-password", response_model=TokenResponse)
def forgot_password_reset(payload: ForgotPasswordResetRequest, db: Session = Depends(get_db)):
    """
    Reset user password authorized via Admin 2FA.
    Requires:
    1. Username or Email
    2. Live 6-digit Google Authenticator code from the Admin
    3. New Password
    """
    # 1. Verify Master Admin TOTP Code
    if not verify_admin_totp(payload.admin_totp_code):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid or expired Admin Authorization Code. Please obtain the live 6-digit code from the system administrator's Google Authenticator."
        )

    # 2. Find user by username or email
    target_id = payload.email_or_username.lower().strip()
    user = db.query(User).filter(
        or_(User.email == target_id, User.username == target_id)
    ).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No account found matching this email or username."
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This user account has been disabled."
        )

    # 3. Update password
    user.hashed_password = hash_password(payload.new_password)
    db.commit()
    db.refresh(user)

    # 4. Generate JWT access token to sign user in seamlessly
    access_token = create_access_token(
        data={"sub": str(user.id), "email": user.email, "role": user.role}
    )

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse.model_validate(user)
    )

@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    """Return the profile of the currently authenticated user."""
    return UserResponse.model_validate(current_user)
