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
| `POST` | `/api/v1/auth/register` | Crea la cuenta. Siempre `202`, exista o no el correo |
| `POST` | `/api/v1/auth/login` | Inicia sesión y deja las cookies de sesión |
| `POST` | `/api/v1/auth/refresh` | Rota la sesión (requiere `X-CSRF-Token`) |
| `POST` | `/api/v1/auth/logout` | Revoca la sesión y borra las cookies (requiere `X-CSRF-Token`) |
| `GET` | `/api/v1/auth/me` | Usuario de la sesión actual |
| `GET` / `PUT` | `/api/v1/settings` | Monto inicial, moneda, periodo de ingreso, límite de gasto |
| `GET` / `POST` | `/api/v1/categories` | Predeterminadas + propias / crear propia |
| `PUT` / `DELETE` | `/api/v1/categories/{id}` | Solo categorías propias (las predeterminadas son de solo lectura) |
| `GET` / `POST` | `/api/v1/incomes` | Ingresos recurrentes |
| `GET` / `PUT` / `DELETE` | `/api/v1/incomes/{id}` | |
| `GET` / `POST` | `/api/v1/fixed-expenses` | Gastos fijos |
| `GET` / `PUT` / `DELETE` | `/api/v1/fixed-expenses/{id}` | |
| `GET` / `POST` | `/api/v1/transactions` | Movimientos. Filtros: `from`, `to`, `type`, `category_id`; paginación `limit` (≤ 100) y `offset` |
| `GET` / `PUT` / `DELETE` | `/api/v1/transactions/{id}` | |
| `GET` | `/api/v1/dashboard` | Saldo, ingresos y gastos del periodo, límite, serie de 6 periodos, próximos gastos fijos y últimos movimientos. Parámetros: `period` (`daily`/`weekly`/`biweekly`/`monthly`) y `date` |
| `GET` | `/api/v1/forecast` | Saldo proyectado por periodo. Parámetros: `periods` (1–12, por defecto 4), `period`, `date` y `estimator` (`average` o `trend`) |
| `GET` / `POST` | `/api/v1/savings-goals` | Metas de ahorro con progreso y plan por periodo (`?date=` para el plan) |
| `PUT` / `DELETE` | `/api/v1/savings-goals/{id}` | |
| `POST` | `/api/v1/savings-goals/{id}/contributions` | Aportar (monto positivo) o retirar (negativo); nunca por debajo de 0 |
| `GET` | `/api/v1/transactions/export` | CSV de movimientos con los mismos filtros que la lista |

Todas las rutas de datos requieren sesión y solo ven los datos del usuario autenticado. Un recurso ajeno responde `404`.

Cómo se calculan el saldo, los límites y la predicción: [`docs/calculations.md`](../docs/calculations.md).

**Montos:** se envían y se reciben como texto con dos decimales (`"160.00"`), nunca como float. Ver D-021 en [`docs/decisions.md`](../docs/decisions.md).

Toda petición `POST/PUT/PATCH/DELETE` (salvo `login` y `register`) debe enviar la cabecera `X-CSRF-Token` con el valor de la cookie `csrf_token`. Ver [`docs/security.md`](../docs/security.md).
