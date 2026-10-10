# Backend: API de Cuenta Clara

API REST con **FastAPI** (Python 3.12), SQLAlchemy 2.x, Alembic y PostgreSQL 16.

## Estructura

```
backend/
├─ app/
│  ├─ api/        # routers HTTP, cookies y dependencias (usuario actual)
│  ├─ core/       # config, BD, seguridad (hash, JWT), CSRF, cabeceras, rate limiting, logging
│  ├─ models/     # modelos SQLAlchemy
│  ├─ schemas/    # esquemas Pydantic de request/response
│  ├─ services/   # lógica de negocio (auth; cálculos y proyecciones en la Fase 4)
│  └─ main.py     # fábrica de la app FastAPI
├─ alembic/       # migraciones
├─ tests/
└─ pyproject.toml
```

## Desarrollo local (sin Docker)

Requiere Python 3.12+ y un PostgreSQL accesible. Las variables se leen del `.env` de la raíz del repo (ver [`.env.example`](../.env.example)).

```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -e ".[dev]"

alembic upgrade head             # aplica migraciones a DATABASE_URL
uvicorn app.main:app --reload    # http://localhost:8000/docs
```

## Calidad

```bash
ruff format .        # formatea
ruff check .         # lint (incluye reglas de seguridad de bandit)
pytest               # requiere TEST_DATABASE_URL: una base desechable
pip-audit --skip-editable
```

Los tests reconstruyen el esquema con las migraciones reales y verifican que los modelos y las migraciones coincidan. **`TEST_DATABASE_URL` debe apuntar a una base distinta de la de desarrollo**: se borra en cada corrida.

## Migraciones

```bash
alembic revision --autogenerate -m "describe the change"   # revisa el archivo generado
alembic upgrade head
alembic downgrade -1
```

Nunca se modifica la base a mano: todo cambio de esquema es una migración.

## Endpoints

| Método | Ruta | Descripción |
| --- | --- | --- |
| `GET` | `/api/v1/health` | Estado de la API y de la base de datos (`503` si la BD no responde) |
| `POST` | `/api/v1/auth/register` | Crea la cuenta. Requiere `accept_terms: true`. Siempre `202`, exista o no el correo |
| `POST` | `/api/v1/auth/login` | Inicia sesión y deja las cookies de sesión |
| `POST` | `/api/v1/auth/refresh` | Rota la sesión (requiere `X-CSRF-Token`) |
| `POST` | `/api/v1/auth/logout` | Revoca la sesión y borra las cookies (requiere `X-CSRF-Token`) |
| `GET` | `/api/v1/auth/me` | Usuario de la sesión actual, con `terms_accepted` (si aceptó la versión vigente) |
| `POST` | `/api/v1/me/consent` | Acepta la versión vigente de los Términos y la Política de privacidad. Cuerpo: `terms_version` |
| `GET` | `/api/v1/me/export` | Todos los datos del usuario en JSON (derecho de acceso y portabilidad), sin hashes ni tokens |
| `POST` | `/api/v1/me/delete` | Elimina la cuenta y todos sus datos. Cuerpo: `password`. Borra las cookies (`204`) |
| `GET` / `PUT` | `/api/v1/settings` | Fecha desde la que se llevan las cuentas, moneda, periodo de ingreso, límite de gasto |
| `GET` / `POST` | `/api/v1/accounts` | Cuentas (nombre, tipo, saldo inicial, principal) con su saldo a `?date=`; máximo 10 |
| `PUT` / `DELETE` | `/api/v1/accounts/{id}` | Cambiar la principal pasa el rol; no se borra la principal ni una cuenta con datos |
| `GET` / `POST` | `/api/v1/transfers` | Dinero movido entre dos cuentas propias (`?account_id=` para filtrar) |
| `DELETE` | `/api/v1/transfers/{id}` | |
| `GET` / `POST` | `/api/v1/categories` | Predeterminadas + propias / crear propia |
| `PUT` / `DELETE` | `/api/v1/categories/{id}` | Solo categorías propias (las predeterminadas son de solo lectura) |
| `GET` / `POST` | `/api/v1/incomes` | Ingresos recurrentes |
| `GET` / `PUT` / `DELETE` | `/api/v1/incomes/{id}` | |
| `GET` / `POST` | `/api/v1/fixed-expenses` | Gastos fijos |
| `GET` | `/api/v1/fixed-expenses/pending` | Pagos de gastos fijos que vencieron hasta `?date=` (hoy del usuario) y aún no se confirman. No cuentan en el saldo hasta responder |
| `POST` | `/api/v1/fixed-expenses/check-ins` | Responde "¿lo pagaste?": `answers` (1–400) con `fixed_expense_id`, `occurs_on` y `paid`. Se puede volver a responder para cambiarlo |
| `GET` / `PUT` / `DELETE` | `/api/v1/fixed-expenses/{id}` | |
| `GET` / `POST` | `/api/v1/transactions` | Movimientos. Filtros: `from`, `to`, `type`, `category_id`, `account_id`; paginación `limit` (≤ 100) y `offset` |
| `GET` / `PUT` / `DELETE` | `/api/v1/transactions/{id}` | |
| `GET` | `/api/v1/dashboard` | Saldo, ingresos y gastos del periodo, límite, serie de 6 periodos, próximos gastos fijos y últimos movimientos. Parámetros: `period` (`daily`/`weekly`/`biweekly`/`monthly`) y `date` |
| `GET` | `/api/v1/forecast` | Saldo proyectado por periodo. Parámetros: `periods` (1–12, por defecto 4), `period`, `date`, `estimator` (`average` o `trend`) y `account` (id o `all`; por defecto la principal) |
| `GET` / `POST` | `/api/v1/savings-goals` | Metas de ahorro con progreso y plan por periodo (`?date=` para el plan) |
| `PUT` / `DELETE` | `/api/v1/savings-goals/{id}` | |
| `POST` | `/api/v1/savings-goals/{id}/contributions` | Aportar (monto positivo) o retirar (negativo); nunca por debajo de 0. Con `from_account_id` el dinero se mueve entre esa cuenta y la de la meta |
| `GET` | `/api/v1/transactions/export` | CSV de movimientos con los mismos filtros que la lista |
| `GET` | `/api/v1/assistant` | Nombre de Balbo, si está disponible (hay `GEMINI_API_KEY`) y si el usuario lo activó (`consented`) |
| `POST` / `DELETE` | `/api/v1/assistant/consent` | Activa o desactiva Balbo. Sin consentimiento, `chat` responde `403` y no se envía nada a Gemini |
| `POST` | `/api/v1/assistant/chat` | Pregunta a Balbo. Cuerpo: `messages` (hasta 12 turnos `user`/`assistant`, el último del usuario). Responde `reply` y `on_topic`. Máximo `ASSISTANT_MESSAGES_PER_HOUR` por usuario |
| `GET` | `/api/v1/reports/export` | Reporte completo (movimientos, cada ingreso y gasto fijo, transferencias). `format` (`csv` o `pdf`), `from`, `to`, `type`, `account` (id o `all`). Sin fechas: desde `balance_as_of` hasta hoy |

Todas las rutas de datos requieren sesión y solo ven los datos del usuario autenticado. Un recurso ajeno responde `404`.

Cómo se calculan el saldo, los límites y la predicción: [`docs/calculations.md`](../docs/calculations.md).

**Montos:** se envían y se reciben como texto con dos decimales (`"160.00"`), nunca como float. Ver D-021 en [`docs/decisions.md`](../docs/decisions.md).

Toda petición `POST/PUT/PATCH/DELETE` (salvo `login` y `register`) debe enviar la cabecera `X-CSRF-Token` con el valor de la cookie `csrf_token`. Ver [`docs/security.md`](../docs/security.md).
