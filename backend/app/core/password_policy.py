"""Password rules for new accounts. Messages are user-facing, so they are in Spanish."""

import re

MIN_LENGTH = 12
# Upper bound keeps Argon2 work per request predictable
MAX_LENGTH = 128

# Base words of the most common passwords. A password is rejected when, after removing
# digits and symbols, it is one of these (catches "Password123!", "Qwerty2024!!", ...).
COMMON_BASE_WORDS = frozenset(
    {
        "abc", "abcdef", "admin", "administrator", "alejandro", "amor", "angel",
        "asdf", "asdfgh", "asdfghjkl", "baseball", "batman", "carlos", "changeme",
        "charlie", "contrasena", "contraseña", "cuentaclara", "daniel", "dragon",
        "football", "freedom", "hello", "iloveyou", "jesus", "letmein", "login",
        "master", "michael", "monkey", "mustang", "panama", "passwd",
        "password", "princess", "qazwsx", "qwerty", "qwertyuiop", "secret",
        "shadow", "sunshine", "superman", "teamo", "trustno", "welcome", "zxcvbnm",
    }
)  # fmt: skip


def password_problems(password: str, *, email: str = "", name: str = "") -> list[str]:
    """Return every rule the password breaks (empty list means it is acceptable)."""
    problems: list[str] = []

    if len(password) < MIN_LENGTH:
        problems.append(f"Debe tener al menos {MIN_LENGTH} caracteres.")
    if len(password) > MAX_LENGTH:
        problems.append(f"Debe tener como máximo {MAX_LENGTH} caracteres.")
    if not any(c.islower() for c in password):
        problems.append("Debe incluir al menos una letra minúscula.")
    if not any(c.isupper() for c in password):
        problems.append("Debe incluir al menos una letra mayúscula.")
    if not any(c.isdigit() for c in password):
        problems.append("Debe incluir al menos un número.")
    if all(c.isalnum() for c in password):
        problems.append("Debe incluir al menos un símbolo.")

    lowered = password.lower()
    base_word = re.sub(r"[^a-zñ]", "", lowered)
    if base_word in COMMON_BASE_WORDS:
        problems.append("Es demasiado común. Elige algo menos predecible.")

    personal = [email.split("@")[0].lower(), *name.lower().split()]
    if any(len(part) >= 4 and part in lowered for part in personal):
        problems.append("No debe contener tu nombre ni tu correo.")

    return problems
