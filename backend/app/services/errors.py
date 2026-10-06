"""Domain errors raised by services and mapped to HTTP responses in app/main.py."""


class DomainError(Exception):
    status_code = 400
    message = "Solicitud inválida."

    def __init__(self, message: str | None = None) -> None:
        super().__init__(message or self.message)
        self.message = message or self.message


class NotFoundError(DomainError):
    """Also used when the resource exists but belongs to someone else (never confirm it exists)."""

    status_code = 404
    message = "No encontrado."


class ForbiddenError(DomainError):
    status_code = 403
    message = "No tienes permiso para hacer esto."


class ConflictError(DomainError):
    status_code = 409
    message = "Ya existe un registro con esos datos."


class InvalidReferenceError(DomainError):
    status_code = 422
    message = "El registro relacionado no existe."
