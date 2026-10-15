from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from .database import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class PaymentCheck(Base):
    __tablename__ = "payment_checks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    owner_key: Mapped[str] = mapped_column(String(80), index=True, default="local-demo")
    source_type: Mapped[str] = mapped_column(String(20))
    input_label: Mapped[str] = mapped_column(String(240))
    risk_level: Mapped[str] = mapped_column(String(20), default="medium")
    risk_score: Mapped[int] = mapped_column(Integer, default=42)
    explanation: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(254), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(256))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class UserSession(Base):
    __tablename__ = "user_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class TrustedPayee(Base):
    __tablename__ = "trusted_payees"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    owner_key: Mapped[str] = mapped_column(String(80), index=True, default="local-demo")
    name: Mapped[str] = mapped_column(String(120))
    payment_identifier: Mapped[str] = mapped_column(String(240))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
