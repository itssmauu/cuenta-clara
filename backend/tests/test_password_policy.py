import pytest

from app.core.password_policy import MAX_LENGTH, password_problems

STRONG = "Lluvia-Verde-2026!"


def test_strong_password_passes() -> None:
    assert password_problems(STRONG) == []


def test_non_ascii_symbols_count_as_symbols() -> None:
    assert password_problems("Lluvia¡Verde¿2026") == []


@pytest.mark.parametrize(
    ("password", "expected"),
    [
        ("Ab1!short", "al menos 12 caracteres"),
        ("SOLOMAYUSCULAS123!", "minúscula"),
        ("solominusculas123!", "mayúscula"),
        ("SinNumerosAqui!!", "número"),
        ("SinSimbolos2026Aqui", "símbolo"),
        ("Aa1!" + "x" * MAX_LENGTH, "como máximo"),
    ],
)
def test_each_rule_is_reported(password: str, expected: str) -> None:
    problems = password_problems(password)

    assert any(expected in problem for problem in problems), problems


@pytest.mark.parametrize("password", ["Password123!", "Qwerty2026!!", "Contraseña123!"])
def test_common_passwords_are_rejected_even_with_decoration(password: str) -> None:
    assert any("común" in problem for problem in password_problems(password))


def test_password_must_not_contain_name_or_email() -> None:
    assert password_problems("Mariela-2026!xy", name="Mariela Pérez")
    assert password_problems("Xy!2026-jperez", email="jperez@example.com")
