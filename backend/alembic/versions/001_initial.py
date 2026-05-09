"""Initial schema

Revision ID: 001_initial
Revises: 
Create Date: 2026-04-07
"""
from alembic import op
import sqlalchemy as sa

revision = "001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("email", sa.String(255), nullable=False, unique=True, index=True),
        sa.Column("hashed_password", sa.String(255), nullable=False),
        sa.Column("full_name", sa.String(255)),
        sa.Column("pan_number", sa.String(10)),
        sa.Column("is_active", sa.Boolean(), default=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_table(
        "portfolios",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(100), default="My Portfolio"),
        sa.Column("broker", sa.String(50)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), onupdate=sa.func.now()),
    )
    op.create_table(
        "holdings",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("portfolio_id", sa.Integer(), sa.ForeignKey("portfolios.id", ondelete="CASCADE"), nullable=False),
        sa.Column("symbol", sa.String(20), nullable=False, index=True),
        sa.Column("name", sa.String(200)),
        sa.Column("asset_type", sa.String(20), default="equity"),
        sa.Column("quantity", sa.Float(), nullable=False),
        sa.Column("avg_buy_price", sa.Float(), nullable=False),
        sa.Column("buy_date", sa.Date(), nullable=False),
        sa.Column("current_price", sa.Float()),
        sa.Column("isin", sa.String(12)),
        sa.Column("exchange", sa.String(10), default="NSE"),
        sa.Column("last_price_updated", sa.DateTime(timezone=True)),
    )
    op.create_table(
        "transactions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("portfolio_id", sa.Integer(), sa.ForeignKey("portfolios.id", ondelete="CASCADE"), nullable=False),
        sa.Column("symbol", sa.String(20), nullable=False, index=True),
        sa.Column("txn_type", sa.String(4), nullable=False),
        sa.Column("quantity", sa.Float(), nullable=False),
        sa.Column("price", sa.Float(), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("brokerage", sa.Float(), default=0.0),
        sa.Column("stt", sa.Float(), default=0.0),
    )
    op.create_table(
        "tax_reports",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("fy", sa.String(10), nullable=False),
        sa.Column("ltcg_gains", sa.Float(), default=0.0),
        sa.Column("stcg_gains", sa.Float(), default=0.0),
        sa.Column("ltcg_losses", sa.Float(), default=0.0),
        sa.Column("stcg_losses", sa.Float(), default=0.0),
        sa.Column("ltcg_tax", sa.Float(), default=0.0),
        sa.Column("stcg_tax", sa.Float(), default=0.0),
        sa.Column("total_tax", sa.Float(), default=0.0),
        sa.Column("generated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_table(
        "price_alerts",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("symbol", sa.String(20), nullable=False),
        sa.Column("alert_type", sa.String(30), nullable=False),
        sa.Column("threshold", sa.Float()),
        sa.Column("triggered", sa.Boolean(), default=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("triggered_at", sa.DateTime(timezone=True)),
    )


def downgrade() -> None:
    op.drop_table("price_alerts")
    op.drop_table("tax_reports")
    op.drop_table("transactions")
    op.drop_table("holdings")
    op.drop_table("portfolios")
    op.drop_table("users")
