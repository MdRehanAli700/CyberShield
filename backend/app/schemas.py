from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class CheckCreate(BaseModel):
    source_type: Literal["file", "text", "url"]
    content: str = Field(min_length=1, max_length=12000)


class CheckRead(BaseModel):
    id: int
    source_type: str
    input_label: str
    risk_level: str
    risk_score: int
    explanation: str
    created_at: datetime
    ocr_text_preview: str | None = None
    detected_amount: str | None = None
    recipient_guess: str | None = None
    trusted_payee_match: str | None = None
    link_domain: str | None = None
    link_domains: list[str] = Field(default_factory=list)
    findings: list[str] = Field(default_factory=list)
    recommended_action: str | None = None

    model_config = {"from_attributes": True}


class PayeeCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    payment_identifier: str = Field(min_length=1, max_length=240)
    identifier_type: Literal["UPI ID", "Bank Account", "Contact"] = "Contact"
    category: Literal["Business", "Personal", "Bills"] = "Personal"
    notes: str | None = Field(default=None, max_length=160)


class PayeeRead(BaseModel):
    id: int
    name: str
    payment_identifier: str
    identifier_type: str = "Contact"
    category: str
    notes: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class AuthCredentials(BaseModel):
    email: str = Field(min_length=5, max_length=254)
    password: str = Field(min_length=10, max_length=128)


class UserRead(BaseModel):
    id: int
    email: str
    display_name: str | None = None
    phone_number: str | None = None
    theme: Literal["dark", "light"] = "dark"
    language: str = "en"
    currency: str = "INR"
    email_verified: bool = True
    totp_enabled: bool = False

    model_config = {"from_attributes": True}


class ProfileUpdate(BaseModel):
    display_name: str = Field(min_length=1, max_length=120)
    phone_number: str | None = Field(default=None, max_length=40)


class PreferencesUpdate(BaseModel):
    theme: Literal["dark", "light"]
    language: Literal["en"] = "en"
    currency: Literal["INR"] = "INR"


class AuthRead(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserRead


class MFALoginChallengeRead(BaseModel):
    mfa_required: bool = True
    challenge_token: str


class MFALoginChallengeComplete(BaseModel):
    challenge_token: str = Field(min_length=20, max_length=200)
    code: str = Field(min_length=6, max_length=20)


class TOTPEnable(BaseModel):
    code: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")


class TOTPDisable(BaseModel):
    current_password: str = Field(min_length=10, max_length=128)
    code: str = Field(min_length=6, max_length=20)


class PasswordChange(BaseModel):
    current_password: str = Field(min_length=10, max_length=128)
    new_password: str = Field(min_length=10, max_length=128)


class PasswordVerify(BaseModel):
    current_password: str = Field(min_length=10, max_length=128)


class PasswordResetRequest(BaseModel):
    email: str = Field(min_length=5, max_length=254)


class PasswordResetComplete(BaseModel):
    token: str = Field(min_length=20, max_length=200)
    new_password: str = Field(min_length=10, max_length=128)


class EmailVerificationComplete(BaseModel):
    token: str = Field(min_length=20, max_length=200)


class OAuthHandoffExchange(BaseModel):
    code: str = Field(min_length=20, max_length=200)
