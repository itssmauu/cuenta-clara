# Arquitectura

## Vista general

```mermaid
flowchart LR
    subgraph Cliente
        B[Navegador]
    end
    subgraph "Next.js 16 (frontend/)"
        P["proxy.ts<br/>CSP con nonce"]
        R["Páginas (App Router)<br/>React + Tailwind + Recharts"]
        RW["Rewrite /api/*"]
    end
    subgraph "FastAPI (backend/)"
        MW["Middlewares<br/>CORS · cabeceras · CSRF"]
        API["Routers /api/v1<br/>auth · settings · CRUD · dashboard"]
        S["Servicios<br/>auth · ownership · projections"]
    end
    DB[(PostgreSQL 16)]

    B --> P --> R
    B -- "fetch /api/v1/…<br/>cookies HttpOnly" --> RW --> MW --> API --> S --> DB
```

- **Un solo origen para el navegador.**
  - El navegador nunca habla directamente con FastAPI: Next.js reenvía `/api/*` (D-032).
  - Gracias a eso las cookies de sesión son de primera parte, no hace falta CORS en el navegador y en producción basta un dominio.
- **Datos en el cliente.**
  - Las cookies de sesión tienen `path=/api`, así que las páginas privadas piden sus datos desde el navegador (D-038, D-039).
  - El servidor de Next solo entrega HTML, cada página con su nonce de CSP.

## Backend por capas

| Capa | Carpeta | Responsabilidad |
| --- | --- | --- |
| HTTP | `app/api/` | Routers, cookies, dependencia de usuario actual. Sin lógica de negocio |
| Esquemas | `app/schemas/` | Validación de entrada/salida con Pydantic (`extra="forbid"`) |
| Servicios | `app/services/` | Reglas de negocio: autenticación, acceso por dueño (anti-IDOR), cálculos |
| Cálculos | `app/services/periods.py`, `projections.py` | **Funciones puras**, sin BD ni reloj: periodos, repeticiones, saldo, límite, predicción |
| Datos | `app/models/` + `alembic/` | Modelos SQLAlchemy y migraciones; invariantes también como `CHECK` en la BD |
| Núcleo | `app/core/` | Configuración, seguridad (hash, JWT), CSRF, cabeceras, rate limiting |

Que los cálculos sean funciones puras permite probarlos con tests unitarios rápidos y explicarlos en [`calculations.md`](calculations.md) sin hablar de la base de datos.

## Frontend

| Carpeta | Responsabilidad |
| --- | --- |
| `src/app/` | Rutas: públicas, `(auth)` (login/registro), `(app)` (privadas con barra lateral), `onboarding` |
| `src/components/` | `landing/`, `auth/`, `app/` (sesión, barra lateral), `dashboard/`, `finance/` (pantallas), `onboarding/`, `ui/` (primitivas) |
| `src/lib/` | Cliente de API tipado (CSRF y refresh automático), validaciones Zod, formato de dinero y fechas |
| `src/proxy.ts` | CSP con nonce por petición |
| `e2e/` | Pruebas end-to-end y auditoría de accesibilidad |

## Autenticación

```mermaid
sequenceDiagram
    participant B as Navegador
    participant W as Next.js
    participant A as FastAPI
    participant D as PostgreSQL

    B->>W: POST /api/v1/auth/login
    W->>A: (rewrite)
    A->>D: usuario + verificación Argon2id
    A->>D: guarda SHA-256 del refresh token
    A-->>B: Set-Cookie access_token (15 min, HttpOnly, path=/api)<br/>refresh_token (7 días, HttpOnly, path=/api/v1/auth)<br/>csrf_token (legible)
    B->>W: GET /api/v1/dashboard (cookie access_token)
    W->>A: (rewrite)
    A-->>B: 200
    Note over B,A: 15 minutos después
    B->>A: GET /api/v1/dashboard → 401
    B->>A: POST /auth/refresh + X-CSRF-Token
    A->>D: revoca el refresh usado, emite uno nuevo
    A-->>B: cookies nuevas
    B->>A: reintenta GET /api/v1/dashboard → 200
```

Si se reutiliza un refresh token ya rotado, el backend asume robo y revoca todas las sesiones del usuario. Detalle en [`security.md`](security.md).

## Modelo de datos

```mermaid
erDiagram
    users ||--|| user_settings : tiene
    users ||--o{ incomes : registra
    users ||--o{ fixed_expenses : registra
    users ||--o{ transactions : registra
    users ||--o{ categories : crea
    users ||--o{ refresh_tokens : "sesiones"
    categories |o--o{ fixed_expenses : clasifica
    categories |o--o{ transactions : clasifica

    users { uuid id string email "único, minúsculas" string password_hash "Argon2id" int failed_login_attempts timestamptz locked_until }
    user_settings { numeric initial_balance date balance_as_of string currency string income_period numeric spending_limit bool onboarding_completed }
    incomes { string label numeric amount string frequency date start_date bool is_active }
    fixed_expenses { string name numeric amount string frequency date start_date int due_day bool is_active }
    transactions { string type "income/expense" numeric amount date occurred_on string note }
    categories { uuid user_id "NULL = predeterminada" string name string color }
    refresh_tokens { string token_hash "SHA-256" timestamptz expires_at timestamptz revoked_at }
```

- Todos los montos son `NUMERIC(12,2)`. Todas las tablas usan `id` UUID con `created_at` y `updated_at`.
- Borrar un usuario borra sus datos en cascada. Borrar una categoría deja sus movimientos sin categoría (`ON DELETE SET NULL`).

## Infraestructura

- **Docker Compose:** `db` (Postgres 16), `backend` (aplica las migraciones al arrancar) y `frontend` (Next standalone). Los tres corren sin root y con healthchecks.
- **CI (GitHub Actions)**, tres jobs:
  - **backend:** ruff, pytest contra Postgres 16 y pip-audit.
  - **frontend:** ESLint, Prettier, tsc, Vitest, build y npm audit.
  - **infra:** compose completo, smoke tests y Playwright + axe contra ese stack.
