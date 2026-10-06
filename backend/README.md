# Backend: API de Cuenta Clara

API REST con **FastAPI** (Python 3.12), SQLAlchemy 2.x, Alembic y PostgreSQL 16.

## Estructura

```
backend/
├─ app/
│  ├─ api/        # routers (hoy: health; próximamente auth, settings, incomes, ...)
│  ├─ core/       # configuración, conexión a BD, logging
│  ├─ models/     # modelos SQLAlchemy
│  ├─ schemas/    # esquemas Pydantic (Fase 2+)
│  ├─ services/   # lógica de negocio: cálculos y proyecciones (Fase 4)
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
