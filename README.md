# Cuenta Clara

[![CI](https://github.com/itssmauu/cuenta-clara/actions/workflows/ci.yml/badge.svg)](https://github.com/itssmauu/cuenta-clara/actions/workflows/ci.yml)

Aplicación web de finanzas personales: registra tu monto inicial, tus gastos fijos y tus ingresos, y descubre cuánto te queda **antes** de gastarlo.

> 🚧 En construcción. Proyecto personal de portafolio.

## ¿Qué hace?

1. Te registras e indicas tu **monto inicial**.
2. Añades tus **gastos fijos** (internet, datos móviles, pasaje…).
3. Indicas cuánto **ingresas** y con qué frecuencia (diario, semanal, quincenal, mensual o personalizado).
4. La app te muestra tu saldo, una **proyección por periodo** y si vas dentro o por encima de tu **límite de gasto**.

Ejemplo: monto inicial $100, gasto semanal $30 → quedan $70. Si ese periodo ingresan $160 → saldo proyectado **$230**.

## Stack

| Capa | Tecnología |
| --- | --- |
| Frontend | Next.js (App Router), TypeScript, Tailwind CSS, React Hook Form + Zod, Recharts |
| Backend | Python 3.12, FastAPI, SQLAlchemy 2.x, Alembic, Pydantic v2 |
| Base de datos | PostgreSQL 16 |
| Infra local | Docker Compose |
| Calidad | pytest, Vitest + Testing Library, ruff, ESLint + Prettier, GitHub Actions |

## Cómo correrlo

Requisitos: [Docker Desktop](https://www.docker.com/products/docker-desktop/) y Git.

```bash
git clone https://github.com/itssmauu/cuenta-clara.git
cd cuenta-clara
cp .env.example .env   # edita los valores
docker compose up -d
```

Por ahora solo levanta PostgreSQL; el backend y el frontend se añaden en las siguientes fases.

## Variables de entorno

Definidas en [`.env.example`](.env.example). Nunca se commitea `.env`.

| Variable | Descripción |
| --- | --- |
| `POSTGRES_USER` | Usuario de la base de datos |
| `POSTGRES_PASSWORD` | Contraseña de la base de datos |
| `POSTGRES_DB` | Nombre de la base de datos |
| `POSTGRES_PORT` | Puerto del host (solo `127.0.0.1`), por defecto `5432` |

## Estructura

```
cuenta-clara/
├─ backend/            # API FastAPI (Fase 1+)
├─ frontend/           # App Next.js (Fase 5+)
├─ docs/               # arquitectura, decisiones, seguridad, capturas
├─ .github/workflows/  # CI
├─ docker-compose.yml
└─ .env.example
```

## Roadmap

- [x] **Fase 0:** base del repo, Docker Compose con Postgres, CI
- [ ] **Fase 1:** backend núcleo (config, BD, modelos, migraciones, salud)
- [ ] **Fase 2:** autenticación segura (Argon2id, JWT + refresh rotativo, rate limiting)
- [ ] **Fase 3:** datos financieros (ajustes, ingresos, gastos fijos, transacciones, categorías)
- [ ] **Fase 4:** dashboard y predicción
- [ ] **Fase 5:** frontend base (tokens de diseño, landing, login/registro)
- [ ] **Fase 6:** onboarding y dashboard
- [ ] **Fase 7:** resto de pantallas
- [ ] **Fase 8:** pulido, accesibilidad, E2E y documentación

Las decisiones de diseño se registran en [`docs/decisions.md`](docs/decisions.md).
