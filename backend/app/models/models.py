from sqlalchemy import Column, Integer, String, Float, Date, Boolean, DateTime, ForeignKey, Text, Enum
from sqlalchemy.orm import relationship, DeclarativeBase
from sqlalchemy.sql import func
import enum


class Base(DeclarativeBase):
    pass


class AssetType(str, enum.Enum):
    equity = "equity"
    mf_equity = "mf_equity"
    mf_debt = "mf_debt"
    etf = "etf"
    bond = "bond"


class GainType(str, enum.Enum):
    STCG = "STCG"
    LTCG = "LTCG"


class User(Base):
    __tablename__ = "users"
    id            = Column(Integer, primary_key=True, index=True)
    email         = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name     = Column(String(255))
    pan_number    = Column(String(10))
    is_active     = Column(Boolean, default=True)
    created_at    = Column(DateTime(timezone=True), server_default=func.now())
    portfolios    = relationship("Portfolio", back_populates="user", cascade="all, delete-orphan")


class Portfolio(Base):
    __tablename__ = "portfolios"
    id          = Column(Integer, primary_key=True, index=True)
    user_id     = Column(Integer, ForeignKey("users.id"), nullable=False)
    name        = Column(String(100), default="My Portfolio")
    broker      = Column(String(50))
    created_at  = Column(DateTime(timezone=True), server_default=func.now())
    updated_at  = Column(DateTime(timezone=True), onupdate=func.now())
    user        = relationship("User", back_populates="portfolios")
    holdings    = relationship("Holding", back_populates="portfolio", cascade="all, delete-orphan")
    transactions = relationship("Transaction", back_populates="portfolio", cascade="all, delete-orphan")


class Holding(Base):
    __tablename__ = "holdings"
    id           = Column(Integer, primary_key=True, index=True)
    portfolio_id = Column(Integer, ForeignKey("portfolios.id"), nullable=False)
    symbol       = Column(String(20), nullable=False, index=True)
    name         = Column(String(200))
    asset_type   = Column(Enum(AssetType), default=AssetType.equity)
    quantity     = Column(Float, nullable=False)
    avg_buy_price = Column(Float, nullable=False)
    buy_date     = Column(Date, nullable=False)
    current_price = Column(Float)
    isin         = Column(String(12))
    exchange     = Column(String(10), default="NSE")
    portfolio    = relationship("Portfolio", back_populates="holdings")


class Transaction(Base):
    __tablename__ = "transactions"
    id           = Column(Integer, primary_key=True, index=True)
    portfolio_id = Column(Integer, ForeignKey("portfolios.id"), nullable=False)
    symbol       = Column(String(20), nullable=False)
    txn_type     = Column(String(4), nullable=False)   # BUY / SELL
    quantity     = Column(Float, nullable=False)
    price        = Column(Float, nullable=False)
    date         = Column(Date, nullable=False)
    brokerage    = Column(Float, default=0.0)
    stt          = Column(Float, default=0.0)
    portfolio    = relationship("Portfolio", back_populates="transactions")


class TaxReport(Base):
    __tablename__ = "tax_reports"
    id             = Column(Integer, primary_key=True, index=True)
    user_id        = Column(Integer, ForeignKey("users.id"), nullable=False)
    fy             = Column(String(10), nullable=False)   # e.g. "2025-26"
    ltcg_gains     = Column(Float, default=0.0)
    stcg_gains     = Column(Float, default=0.0)
    ltcg_losses    = Column(Float, default=0.0)
    stcg_losses    = Column(Float, default=0.0)
    ltcg_tax       = Column(Float, default=0.0)
    stcg_tax       = Column(Float, default=0.0)
    total_tax      = Column(Float, default=0.0)
    generated_at   = Column(DateTime(timezone=True), server_default=func.now())
