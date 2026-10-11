"""Send a test email with the SMTP_* settings, to check them before relying on them.

    python -m app.mail_check tu-correo@ejemplo.com

Reads the same settings as the API (.env or environment variables) and never prints the
password. When sending fails, it says in plain words what is most likely wrong.
"""

import smtplib
import socket
import sys

from app.core.config import get_settings
from app.services.mailer import Email, SmtpMailer

HINTS = [
    (
        "5.7.139",
        "El proveedor ya no acepta contraseñas para enviar desde apps (pasa con Outlook.com y "
        "Hotmail personales). Usa una cuenta de Gmail con contraseña de aplicación u otro "
        "proveedor SMTP.",
    ),
    (
        "535",
        "Usuario o contraseña rechazados. En Gmail, SMTP_PASSWORD debe ser la contraseña de "
        "aplicación de 16 letras (con la Verificación en dos pasos activada), no la contraseña "
        "normal, y SMTP_USERNAME el correo completo.",
    ),
    (
        "534",
        "El proveedor pide iniciar sesión de otra forma: activa la Verificación en dos pasos y "
        "crea una contraseña de aplicación.",
    ),
]


def explain(error: Exception) -> str:
    text = str(error)
    for code, hint in HINTS:
        if code in text:
            return hint
    if isinstance(error, (socket.gaierror, ConnectionRefusedError, TimeoutError)):
        return "No se pudo conectar: revisa SMTP_HOST y SMTP_PORT (Gmail: smtp.gmail.com y 587)."
    if isinstance(error, smtplib.SMTPSenderRefused):
        return (
            "El proveedor rechazó el remitente: SMTP_FROM debe usar el mismo correo de la cuenta."
        )
    return "Error inesperado; el mensaje del servidor está arriba."


def main(argv: list[str]) -> int:
    if len(argv) != 2 or "@" not in argv[1]:
        print("Uso: python -m app.mail_check tu-correo@ejemplo.com")
        return 2
    settings = get_settings()
    missing = [
        name
        for name, value in (
            ("SMTP_HOST", settings.smtp_host),
            ("SMTP_USERNAME", settings.smtp_username),
            ("SMTP_PASSWORD", settings.smtp_password),
            ("SMTP_FROM", settings.smtp_from),
        )
        if not value
    ]
    if missing:
        print("Faltan en el .env:", ", ".join(missing))
        return 1

    password = settings.smtp_password.get_secret_value() if settings.smtp_password else ""
    mailer = SmtpMailer(
        settings.smtp_host,
        settings.smtp_port,
        settings.smtp_username,
        password,
        settings.smtp_from,
    )
    print(f"Enviando una prueba a {argv[1]} por {settings.smtp_host}:{settings.smtp_port}…")
    try:
        mailer.send(
            Email(
                to=argv[1],
                subject="Prueba de correo de Cuenta Clara",
                text="Si lees esto, Cuenta Clara ya puede enviar códigos de recuperación.",
                html="<p>Si lees esto, Cuenta Clara ya puede enviar códigos de recuperación.</p>",
            )
        )
    except Exception as error:  # noqa: BLE001 - report any failure in plain words
        print(f"No se envió. Servidor: {error}")
        print("Qué revisar:", explain(error))
        return 1
    print("Enviado. Revisa la bandeja de entrada (y spam) de", argv[1])
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
