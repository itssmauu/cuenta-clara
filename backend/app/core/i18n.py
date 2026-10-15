"""The language the user reads the app in: Spanish (the source) or English.

The web app sends it in `Accept-Language` with every request (the visitor's choice in the
language switcher). Only what the API writes in its own words follows it: emails and
Balbo's replies. Error messages stay in Spanish and the web app translates them where it
shows them, so every client gets the same, stable messages.
"""

from typing import Annotated, Literal

from fastapi import Depends, Request

Language = Literal["es", "en"]
DEFAULT_LANGUAGE: Language = "es"


def parse_language(header: str | None) -> Language:
    """The first supported language in an Accept-Language header; Spanish otherwise."""
    for part in (header or "").split(","):
        code = part.split(";")[0].strip()[:2].lower()
        if code == "es":
            return "es"
        if code == "en":
            return "en"
    return DEFAULT_LANGUAGE


def request_language(request: Request) -> Language:
    return parse_language(request.headers.get("accept-language"))


RequestLanguage = Annotated[Language, Depends(request_language)]
