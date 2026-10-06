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
docker compose up -d --build
```

Esto levanta PostgreSQL 16 y la API, que aplica las migraciones al arrancar:

- API: <http://localhost:8000/api/v1/health>
- Documentación interactiva (Swagger): <http://localhost:8000/docs>

El frontend se añade en la Fase 5. Para trabajar en el backend sin Docker, ver [`backend/README.md`](backend/README.md).

> **¿Ya tienes PostgreSQL instalado en tu máquina?** Ocupa el puerto 5432. Cambia `POSTGRES_PORT=5433` en `.env` (y el puerto en `DATABASE_URL` / `TEST_DATABASE_URL`).

## Variables de entorno

Definidas en [`.env.example`](.env.example). Nunca se commitea `.env`.

| Variable | Descripción |
| --- | --- |
| `POSTGRES_USER` | Usuario de la base de datos |
| `POSTGRES_PASSWORD` | Contraseña de la base de datos |
| `POSTGRES_DB` | Nombre de la base de datos |
| `POSTGRES_PORT` | Puerto del host (solo `127.0.0.1`), por defecto `5432` |
| `APP_ENV` | `development`, `test` o `production` (en producción se desactiva `/docs`) |
| `LOG_LEVEL` | `DEBUG`, `INFO`, `WARNING` o `ERROR` |
| `BACKEND_PORT` | Puerto del host para la API, por defecto `8000` |
| `DATABASE_URL` | Conexión de la API cuando corre fuera de Docker |
| `TEST_DATABASE_URL` | Base **desechable** para los tests (se borra en cada corrida) |
| `JWT_SECRET_KEY` | Clave para firmar los tokens (≥ 32 caracteres aleatorios) |
| `ACCESS_TOKEN_TTL_MINUTES` / `REFRESH_TOKEN_TTL_DAYS` | Duración de la sesión (15 min / 7 días) |
| `COOKIE_SECURE` | Cookies solo por HTTPS; obligatorio `true` en producción |
| `LOGIN_RATE_LIMIT` / `REGISTER_RATE_LIMIT` / `EMAIL_RATE_LIMIT` | Límites por IP y por correo |
| `MAX_FAILED_LOGINS` / `LOCKOUT_MINUTES` | Bloqueo temporal tras intentos fallidos |
| `FRONTEND_ORIGIN` | Único origen permitido por CORS |

## Estructura

```
cuenta-clara/
├─ backend/            # API FastAPI
├─ frontend/           # App Next.js (Fase 5+)
├─ infra/              # scripts de infraestructura (init de Postgres)
├─ docs/               # arquitectura, decisiones, seguridad, capturas
├─ .github/workflows/  # CI
├─ docker-compose.yml
└─ .env.example
```

## Roadmap

- [x] **Fase 0:** base del repo, Docker Compose con Postgres, CI
- [x] **Fase 1:** backend núcleo (config, BD, modelos, migraciones, salud)
- [x] **Fase 2:** autenticación segura (Argon2id, JWT + refresh rotativo, rate limiting)
- [ ] **Fase 3:** datos financieros (ajustes, ingresos, gastos fijos, transacciones, categorías)
- [ ] **Fase 4:** dashboard y predicción
- [ ] **Fase 5:** frontend base (tokens de diseño, landing, login/registro)
- [ ] **Fase 6:** onboarding y dashboard
- [ ] **Fase 7:** resto de pantallas
- [ ] **Fase 8:** pulido, accesibilidad, E2E y documentación

## Seguridad

La app maneja información financiera, así que la seguridad es un requisito central: Argon2id, sesiones en cookies `HttpOnly` con refresh rotativo y detección de robo, CSRF, rate limiting, bloqueo temporal y errores que no revelan qué correos existen. Detalle completo, con dónde está implementada cada medida y qué test la cubre, en [`docs/security.md`](docs/security.md).

Las decisiones de diseño se registran en [`docs/decisions.md`](docs/decisions.md).
