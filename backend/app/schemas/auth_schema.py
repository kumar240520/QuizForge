from typing import Optional
from datetime import datetime
from pydantic import BaseModel, EmailStr, Field

class UserRegisterRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(..., min_length=6)
    full_name: Optional[str] = None
    admin_totp_code: str = Field(..., min_length=6, max_length=6, description="Live 6-digit Google Authenticator code from system owner")
    role: Optional[str] = "candidate"
    gemini_api_key: Optional[str] = Field(None, description="Optional Google Gemini API Key provided during registration")

class UserLoginRequest(BaseModel):
    email_or_username: str
    password: str

class ForgotPasswordResetRequest(BaseModel):
    email_or_username: str = Field(..., min_length=3, description="Username or email address of the account")
    admin_totp_code: str = Field(..., min_length=6, max_length=6, description="Live 6-digit Google Authenticator code from system owner")
    new_password: str = Field(..., min_length=6, description="New password for the user account")

class UserResponse(BaseModel):
    id: int
    email: str
    username: str
    full_name: Optional[str] = None
    role: str
    is_active: bool
    created_at: datetime
    is_gemini_configured: bool = False
    masked_gemini_key: Optional[str] = None

    class Config:
        from_attributes = True

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

class TOTPSetupResponse(BaseModel):
    secret: str
    otpauth_uri: str
    qr_code_base64: str
    instructions: str
