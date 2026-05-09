"""
Email Notification Service
============================
Sends tax alerts, harvest deadline reminders, and weekly summaries.

Configure in .env:
  SMTP_HOST=smtp.gmail.com
  SMTP_PORT=587
  SMTP_USER=your@gmail.com
  SMTP_PASSWORD=app-password   (Gmail App Password, not account password)
  FROM_EMAIL=noreply@taxoptimizer.in
"""

import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import List
from datetime import date

logger = logging.getLogger(__name__)


class EmailService:
    def __init__(self, host: str, port: int, user: str, password: str, from_email: str):
        self.host       = host
        self.port       = port
        self.user       = user
        self.password   = password
        self.from_email = from_email

    def _send(self, to: str, subject: str, html_body: str):
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"]    = self.from_email
        msg["To"]      = to
        msg.attach(MIMEText(html_body, "html"))
        try:
            with smtplib.SMTP(self.host, self.port) as server:
                server.ehlo()
                server.starttls()
                server.login(self.user, self.password)
                server.sendmail(self.from_email, to, msg.as_string())
            logger.info(f"Email sent to {to}: {subject}")
        except Exception as e:
            logger.error(f"Email send failed: {e}")

    # ── Templates ─────────────────────────────────────────────────────────────

    def send_harvest_alert(self, to: str, user_name: str, alerts: List[dict]):
        subject = f"⚡ Tax-loss harvest alert — {len(alerts)} action(s) needed"
        rows = "".join(
            f"<tr><td style='padding:10px;border-bottom:1px solid #eee'><strong>{a['symbol'] or 'Portfolio'}</strong></td>"
            f"<td style='padding:10px;border-bottom:1px solid #eee'>{a['title']}</td>"
            f"<td style='padding:10px;border-bottom:1px solid #eee;color:#991b1b'>{a['body'][:80]}...</td></tr>"
            for a in alerts[:5]
        )
        html = f"""
        <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto">
          <div style="background:#534AB7;padding:24px;border-radius:12px 12px 0 0">
            <h1 style="color:#fff;margin:0;font-size:20px">TaxOptimizer India</h1>
            <p style="color:#CECBF6;margin:4px 0 0;font-size:13px">Tax action alert</p>
          </div>
          <div style="background:#fff;border:1px solid #e5e5e5;padding:24px">
            <p>Hi {user_name},</p>
            <p>You have <strong>{len(alerts)} tax action item(s)</strong> that need attention:</p>
            <table style="width:100%;border-collapse:collapse;margin:16px 0">
              <thead><tr style="background:#f7f7f5">
                <th style="padding:10px;text-align:left;font-size:12px">Stock</th>
                <th style="padding:10px;text-align:left;font-size:12px">Alert</th>
                <th style="padding:10px;text-align:left;font-size:12px">Detail</th>
              </tr></thead>
              <tbody>{rows}</tbody>
            </table>
            <a href="http://localhost:3000/harvest"
               style="display:inline-block;background:#534AB7;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:500">
              View harvest recommendations →
            </a>
          </div>
          <div style="padding:16px;font-size:11px;color:#888;text-align:center">
            TaxOptimizer India · This is an automated alert. Not financial advice.
          </div>
        </div>"""
        self._send(to, subject, html)

    def send_weekly_summary(self, to: str, user_name: str, tax_summary: dict):
        total = tax_summary.get("total_tax", 0)
        saving = tax_summary.get("harvest_tax_saving", 0)
        fy_end = date(date.today().year if date.today().month < 4 else date.today().year + 1, 3, 31)
        days_left = (fy_end - date.today()).days

        html = f"""
        <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto">
          <div style="background:#534AB7;padding:24px;border-radius:12px 12px 0 0">
            <h1 style="color:#fff;margin:0;font-size:20px">Weekly Tax Summary</h1>
            <p style="color:#CECBF6;margin:4px 0 0;font-size:13px">FY 2025–26 · {days_left} days to 31 March</p>
          </div>
          <div style="background:#fff;border:1px solid #e5e5e5;padding:24px">
            <p>Hi {user_name}, here's your weekly tax snapshot:</p>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:16px 0">
              <div style="background:#FCEBEB;border-radius:8px;padding:16px">
                <div style="font-size:11px;color:#991b1b;margin-bottom:4px">ESTIMATED TAX</div>
                <div style="font-size:24px;font-weight:500;color:#7f1d1d">₹{int(total):,}</div>
              </div>
              <div style="background:#E1F5EE;border-radius:8px;padding:16px">
                <div style="font-size:11px;color:#065f46;margin-bottom:4px">HARVEST SAVING</div>
                <div style="font-size:24px;font-weight:500;color:#064e3b">₹{int(saving):,}</div>
              </div>
            </div>
            <a href="http://localhost:3000"
               style="display:inline-block;background:#534AB7;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:500">
              Open dashboard →
            </a>
          </div>
          <div style="padding:16px;font-size:11px;color:#888;text-align:center">
            TaxOptimizer India · Unsubscribe
          </div>
        </div>"""
        self._send(to, f"Your weekly tax summary — ₹{int(total):,} estimated", html)

    def send_fy_deadline_reminder(self, to: str, user_name: str, days_left: int, actions: int):
        subject = f"⏰ {days_left} days to FY end — {actions} tax action(s) pending"
        html = f"""
        <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto">
          <div style="background:#D97706;padding:24px;border-radius:12px 12px 0 0">
            <h1 style="color:#fff;margin:0;font-size:20px">FY Deadline Alert</h1>
            <p style="color:#FDE68A;margin:4px 0 0;font-size:13px">Only {days_left} days until 31 March</p>
          </div>
          <div style="background:#fff;border:1px solid #e5e5e5;padding:24px">
            <p>Hi {user_name},</p>
            <p>Financial Year 2025–26 ends on <strong>31 March 2026</strong> — that's <strong>{days_left} days away</strong>.</p>
            <p>You have <strong>{actions} pending tax action(s)</strong>. After 31 March:</p>
            <ul style="color:#666;line-height:2">
              <li>Unrealised losses cannot be harvested for this FY</li>
              <li>The ₹1,25,000 LTCG exemption resets — unused benefit is lost</li>
              <li>STCG losses cannot offset this year's LTCG gains</li>
            </ul>
            <a href="http://localhost:3000/harvest"
               style="display:inline-block;background:#D97706;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:500">
              Review harvest opportunities →
            </a>
          </div>
        </div>"""
        self._send(to, subject, html)


def get_email_service() -> EmailService | None:
    """Factory — returns None if SMTP not configured."""
    try:
        from app.core.config import settings
        if not getattr(settings, "SMTP_HOST", None):
            return None
        return EmailService(
            host=settings.SMTP_HOST,
            port=getattr(settings, "SMTP_PORT", 587),
            user=settings.SMTP_USER,
            password=settings.SMTP_PASSWORD,
            from_email=getattr(settings, "FROM_EMAIL", settings.SMTP_USER),
        )
    except Exception:
        return None
