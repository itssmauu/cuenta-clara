# Frontend: app web de Cuenta Clara

**Next.js 16** (App Router, Turbopack) + TypeScript + Tailwind CSS v4, con React Hook Form + Zod y Recharts.

## Estructura

```
frontend/
├─ src/
│  ├─ app/                 # rutas públicas: /, /login, /register, /recuperar-contrasena
│  │  ├─ (auth)/           # layout compartido de login y registro
│  │  ├─ (app)/            # rutas privadas con barra lateral: /dashboard, /ingresos, /gastos…
│  │  ├─ onboarding/       # asistente de 4 pasos del primer ingreso
│  │  ├─ globals.css       # tokens de diseño (@theme) y estilos base
│  │  └─ layout.tsx        # fuentes Sora + Manrope (next/font)
│  ├─ components/
│  │  ├─ landing/          # secciones de la landing (componentes de servidor)
│  │  ├─ auth/             # formularios de acceso (componentes de cliente)
│  │  ├─ app/              # sesión, barra lateral, encabezado de página
│  │  ├─ dashboard/        # tarjetas, gráfica gasto vs. límite, tabla de gastos del periodo
│  │  ├─ finance/          # Ingresos, Gastos, Gastos fijos, Predicción, Configuración y sus diálogos
│  │  ├─ onboarding/       # pasos del asistente
│  │  └─ ui/               # botones, campos, diálogos, avisos, estados vacíos
│  ├─ lib/
│  │  ├─ api.ts            # cliente de la API (CSRF, refresh automático, errores)
│  │  ├─ finance-api.ts    # llamadas tipadas: ajustes, categorías, movimientos, dashboard
│  │  ├─ format.ts         # dinero ($1,234.50) y fechas locales
│  │  ├─ use-resource.ts   # carga de datos en el cliente con estados de carga y error
│  │  └─ validation.ts     # esquemas Zod (reflejan la política del backend)
│  └─ proxy.ts             # Content-Security-Policy con nonce por petición
├─ next.config.ts          # proxy /api → FastAPI, cabeceras de seguridad
└─ Dockerfile              # build standalone, usuario sin privilegios
```

## Desarrollo local

Requiere Node 24 y la API corriendo en `http://localhost:8000` (ver [`backend/README.md`](../backend/README.md)).

```bash
cd frontend
npm install
npm run dev          # http://localhost:3000
```

El navegador solo habla con `localhost:3000`: Next.js reenvía `/api/*` al backend (`API_INTERNAL_URL`, por defecto `http://localhost:8000`). Así las cookies de sesión son del mismo origen y no hace falta CORS.

## Calidad

```bash
npm run lint           # ESLint (reglas de Next + core web vitals)
npm run format:check   # Prettier (ordena también las clases de Tailwind)
npm run typecheck      # tsc --noEmit
npm test               # Vitest + Testing Library
npm run build
```

## Diseño

- Basado en el wireframe del proyecto (landing, acceso y dashboard).
- **Tokens:** todos los colores, fuentes y radios están en `@theme` de [`src/app/globals.css`](src/app/globals.css). Cambiar un color ahí lo cambia en toda la app.
- **Accesibilidad:**
  - `label` real en cada campo y errores enlazados con `aria-describedby`.
  - Resumen de errores que recibe el foco.
  - Foco visible.
  - Objetivos táctiles de 44 px como mínimo.
  - Contraste AA.
  - Se respeta `prefers-reduced-motion`.
- **Seguridad:**
  - Los tokens de sesión viven en cookies `HttpOnly`: JavaScript nunca los ve.
  - La CSP solo permite scripts con el nonce de cada petición.
  - Detalle en [`docs/security.md`](../docs/security.md).
