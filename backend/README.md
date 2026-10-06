# Backend: API de Cuenta Clara

API REST con **FastAPI** (Python 3.12), SQLAlchemy 2.x, Alembic y PostgreSQL 16.

Se implementa a partir de la **Fase 1**. Estructura prevista:

```
backend/
├─ app/
│  ├─ api/        # routers (auth, settings, incomes, expenses, fixed_expenses, categories, dashboard)
│  ├─ core/       # config, seguridad, rate limiting, logging
│  ├─ models/     # modelos SQLAlchemy
│  ├─ schemas/    # esquemas Pydantic
│  ├─ services/   # lógica de negocio (cálculos, proyecciones)
│  └─ main.py
├─ alembic/       # migraciones
├─ tests/
└─ pyproject.toml
```
