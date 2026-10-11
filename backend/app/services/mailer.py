"""Outgoing email over SMTP (any provider: Gmail, Outlook, Brevo, Resend...).

Only transactional messages: password-reset codes and "your password changed" notices.
Uses the standard library, so there is no extra dependency or vendor lock-in.
"""

import logging
import smtplib
import ssl
from dataclasses import dataclass
from email.message import EmailMessage
from email.utils import formatdate, make_msgid, parseaddr
from typing import Protocol

from app.core.config import Settings

logger = logging.getLogger(__name__)

SMTP_TIMEOUT_SECONDS = 15


@dataclass(frozen=True)
class Email:
    to: str
    subject: str
    text: str
    html: str


class Mailer(Protocol):
    def send(self, email: Email) -> None: ...


class SmtpMailer:
    """Port 465 speaks TLS from the start; any other port (587) upgrades with STARTTLS."""

    def __init__(self, host: str, port: int, username: str, password: str, sender: str) -> None:
        self.host = host
        self.port = port
        self.username = username
        self.password = password
        self.sender = sender

    def send(self, email: Email) -> None:
        message = EmailMessage()
        message["From"] = self.sender
        message["To"] = email.to
        message["Subject"] = email.subject
        message["Date"] = formatdate(usegmt=True)
        # Headers spam filters look for on real mail
        domain = parseaddr(self.sender)[1].rpartition("@")[2] or None
        message["Message-ID"] = make_msgid(domain=domain)
        message["Auto-Submitted"] = "auto-generated"
        message.set_content(email.text)
        message.add_alternative(email.html, subtype="html")

        context = ssl.create_default_context()
        if self.port == 465:
            server: smtplib.SMTP = smtplib.SMTP_SSL(
                self.host, self.port, timeout=SMTP_TIMEOUT_SECONDS, context=context
            )
        else:
            server = smtplib.SMTP(self.host, self.port, timeout=SMTP_TIMEOUT_SECONDS)
        with server:
            if self.port != 465:
                server.starttls(context=context)
            if self.username:
                server.login(self.username, self.password)
            server.send_message(message)


class LogMailer:
    """Development only: prints the email to the log instead of sending it."""

    def send(self, email: Email) -> None:
        logger.warning("[dev, not sent] Email to %s: %s\n%s", email.to, email.subject, email.text)


def mailer_from_settings(settings: Settings) -> Mailer | None:
    """The SMTP mailer when configured; in development, the log; otherwise none."""
    if settings.smtp_host and settings.smtp_from:
        password = settings.smtp_password.get_secret_value() if settings.smtp_password else ""
        return SmtpMailer(
            settings.smtp_host,
            settings.smtp_port,
            settings.smtp_username,
            password,
            settings.smtp_from,
        )
    if settings.app_env == "development":
        return LogMailer()
    return None
