# Pruebas

Cuatro niveles. Los tres primeros corren en cada PR y en cada push a `main`. Los niveles se complementan: cada uno atrapa errores que los otros no pueden atrapar.

| Nivel | Dónde | Herramienta | Corre contra |
| --- | --- | --- | --- |
| Backend | `backend/tests/` | pytest | Postgres real (base desechable) |
| Frontend | `frontend/src/**/*.test.ts(x)` | Vitest + Testing Library | jsdom, API simulada |
| End-to-end | `frontend/e2e/` | Playwright | Stack completo (web + API + BD) |
| Accesibilidad | dentro de las E2E | axe-core | Cada pantalla en Chromium real |

## Backend (pytest)

```bash
cd backend
pytest                   # requiere TEST_DATABASE_URL (se borra en cada corrida)
```

- **Cálculos puros** (`test_periods.py`, `test_projections.py`): periodos, meses cortos, bisiestos, saldo que se arrastra entre periodos, límite, predicción y el ejemplo 100 − 30 + 160 = 230.
- **API** de cada recurso, con validación y casos borde.
- **Seguridad:** tokens falsificados, sin firma o expirados; CSRF; rate limiting; bloqueo temporal; reutilización de refresh tokens; cabeceras y CORS.
- **Fase 9** (`test_phase9_calculations.py`, `test_phase9_api.py`): plan de metas por periodo, alerta al 80 %, periodo anterior, gasto por categoría, regresión lineal (pendiente, R², mínimo de puntos, nunca negativa) y CSV con inyección de fórmulas neutralizada.
- **Anti-IDOR** (`test_idor.py`): otro usuario no puede leer, editar, borrar ni listar recursos ajenos. Se verificó rompiendo el filtro a propósito y viendo fallar los tests.
- **Migraciones:** los modelos coinciden con las migraciones, y estas se pueden revertir y volver a aplicar.

## Frontend (Vitest)

```bash
cd frontend
npm test
```

- Validaciones Zod, cliente de API (CSRF, refresh automático, errores), formularios de acceso, onboarding, dashboard y cada pantalla.
- **El cuerpo enviado a la API se compara completo, no parcialmente.** Así se detecta si se envían campos de más, que la API rechazaría (D-045).
- Las consultas usan roles y nombres accesibles (`getByRole`, `getByLabel`). Un test que no encuentra un botón por su nombre suele revelar un problema real de accesibilidad: así apareció el "8periodos" de la Fase 7.

## End-to-end y accesibilidad (Playwright + axe)

```bash
cd frontend
npx playwright install chromium     # la primera vez
E2E_BASE_URL=http://localhost:3000 npm run e2e
```

- **Recorrido de un usuario nuevo:**
  - Registro → onboarding → el dashboard muestra $230.
  - Añade un gasto y aparece "Te pasaste por $15.00".
  - El periodo elegido queda en la URL.
  - Pausar un ingreso actualiza el saldo.
  - Crea una meta de ahorro, aporta y ve el progreso; retirar de más muestra el error de la API.
  - En Reportes compara periodos y descarga un CSV cuyo contenido se verifica.
  - La predicción cambia a "Tendencia" y explica el resultado.
  - Visita todas las pantallas y cierra sesión.
- **Seguridad en el navegador real:**
  - JavaScript no puede leer las cookies de sesión.
  - Cada página lleva su CSP con nonce.
  - Credenciales incorrectas muestran un error genérico.
- **Accesibilidad:**
  - `expectAccessible()` corre axe con las reglas WCAG 2.0/2.1/2.2 A y AA en todas las pantallas, públicas y privadas, y falla ante cualquier violación.
  - Antes de auditar se espera a que la red quede inactiva y terminen las transiciones finitas: así axe no mide un color a mitad de animación.
  - Además se prueba el enlace "Saltar al contenido" con teclado y que en un ancho de 375 px no haya scroll horizontal.
- Las pruebas crean sus propios usuarios con correos únicos y usan un solo worker, porque la API limita los logins por IP.

### Capturas del README

```bash
E2E_BASE_URL=http://localhost:3000 npm run screenshots   # escribe docs/screenshots/*.png
```

## Qué no cubren (todavía)

- **Navegadores:** solo Chromium. Firefox y WebKit se añaden con dos líneas en `playwright.config.ts`.
- **Lectores de pantalla:** axe detecta problemas automáticos, cerca de la mitad de los criterios WCAG. La prueba manual con NVDA o VoiceOver sigue siendo necesaria.
- **Carga y rendimiento:** no hay pruebas de carga.
