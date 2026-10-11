# Despliegue a producción

Guía para publicar Cuenta Clara de forma segura. Las razones de cada punto están en `docs/security.md` y en las decisiones D-064 a D-069.

Hay dos formas de hacerlo:

- **Vercel**, la recomendada. No hay servidor que mantener. Ver la sección siguiente.
- **Docker Compose en un servidor propio**, detrás de Caddy o nginx. Ver más abajo.

## En Vercel

Es **un solo proyecto de Vercel con dos servicios**, definidos en `vercel.json` en la raíz del repositorio:

| Servicio | Carpeta | Qué atiende |
| --- | --- | --- |
| `backend` | `backend/` (FastAPI) | `/api/*`, la API |
| `frontend` | `frontend/` (Next.js) | todo lo demás, las páginas |

```
navegador ──▶ tu-dominio ──/api/*──▶ backend (FastAPI) ──▶ Neon (Postgres)
                     │                                  └─▶ Upstash (Redis)
                     └──/*──────▶ frontend (Next.js)
```

- **Un solo dominio.** Las cookies de sesión son de primera parte y no hace falta CORS.
- **Sin bindings.** Ningún servicio llama a otro: el navegador llama a `/api/*` y Vercel lo envía directo al backend.
- **La IP real.** Vercel reescribe `X-Forwarded-For` con la IP del visitante y descarta la que mande el cliente. Por eso `TRUSTED_PROXY_HOPS=1` es exacto.
- **Redis es obligatorio.** Cada petición puede caer en una instancia distinta, así que los contadores de intentos (login, registro, recuperación, Balbo) viven en Upstash.
- **Fallo seguro.** Con `APP_ENV=production` en Vercel, la API **no arranca** sin Redis o sin `TRUSTED_PROXY_HOPS`.

### 1. Genera la clave de sesión (en tu computadora)

```bash
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

Ese valor es `JWT_SECRET_KEY`. Guárdalo solo en Vercel (y en un gestor de contraseñas), nunca en el repositorio ni en un chat.

### 2. Crea el proyecto

1. En Vercel: **Add New › Project**, importa el repositorio y deja **Root Directory** en la raíz. Vercel lee `vercel.json` y crea los dos servicios.
2. En **Storage** (Marketplace), crea y conecta al proyecto:
   - **Neon (Postgres).** Usa la URL con `-pooler` como `DATABASE_URL`. Las URLs `postgres://` se aceptan tal cual.
   - **Upstash (Redis).** Usa su URL `rediss://…` como `RATE_LIMIT_STORAGE_URI` (también vale `REDIS_URL`).
3. En **Settings › Environment Variables**, solo para **Production**. Las comparten los dos servicios:

   | Variable | Valor |
   | --- | --- |
   | `APP_ENV` | `production` |
   | `DATABASE_URL` | la de Neon (con `-pooler`) |
   | `RATE_LIMIT_STORAGE_URI` | la de Upstash (`rediss://…`) |
   | `JWT_SECRET_KEY` | la del paso 1 |
   | `TRUSTED_PROXY_HOPS` | `1` |
   | `FRONTEND_ORIGIN` | `https://<tu dominio>` |
   | `NEXT_PUBLIC_PRIVACY_EMAIL` | el correo de contacto, p. ej. `cuenta_clara@outlook.com` |
   | `SMTP_HOST` / `SMTP_PORT` / `SMTP_USERNAME` / `SMTP_PASSWORD` / `SMTP_FROM` | el servicio de correo (ver «Correo para recuperar contraseñas») |
   | `GEMINI_API_KEY` | opcional (Balbo) |

   **No hacen falta** en este montaje: `API_INTERNAL_URL`, `PROXY_SECRET` ni `API_PROXY_SECRET`.
4. En **Settings › Functions**, pon la región en la misma que la base de Neon. Así cada consulta no cruza el continente.

### 3. Crea las tablas

Vercel no aplica migraciones al desplegar. Hazlo antes del primer deploy y cada vez que un cambio traiga una migración nueva. Hay dos formas:

- **Desde GitHub.**
  1. En **Settings › Environments**, crea `production` con el secreto `DATABASE_URL`. Usa la URL **directa** de Neon, sin `-pooler`.
  2. En **Actions › Migrate production database › Run workflow**, lánzalo.
- **Desde tu computadora:**

  ```bash
  cd backend
  DATABASE_URL="<url directa de Neon>" JWT_SECRET_KEY=solo-migraciones-no-firma-nada-xxxxx alembic upgrade head
  ```

### 4. Despliega y protege

- **Despliega.** Si cambias el dominio (por ejemplo, a uno propio), actualiza `FRONTEND_ORIGIN` y vuelve a desplegar.
- **Variables solo en Production.** Así un deploy de prueba (preview) nunca toca la base real. Activa **Deployment Protection** para los previews.
- **Plan Hobby.** Es para uso no comercial. Si Cuenta Clara va a cobrar o tener fines comerciales, hace falta el plan Pro.
- **Firewall.** Si algún día hay un ataque, Vercel ofrece **Attack Challenge Mode** en Firewall.
- **Probar en local.** `vercel dev` arranca los dos servicios juntos, como en producción.

### 5. Comprueba que todo está en su sitio

- `https://<dominio>/api/v1/health` responde `200`.
- `https://<dominio>/api/v1/docs` responde `404`: la documentación de la API no se publica en producción.
- Crear una cuenta, iniciar sesión, completar el onboarding, responder «¿Ya pagaste?» y recuperar la contraseña funciona.
- La prueba de IP falsificada de más abajo da `429` antes del 7.º intento.

**Alternativa: dos proyectos separados** (la API con su propia URL). Si alguna vez se necesita, el código lo soporta:

- Se configura `PROXY_SECRET` en la API, y `API_PROXY_SECRET` y `API_INTERNAL_URL` en la web.
- La API solo responde a peticiones firmadas por la web y toma la IP de `X-Client-IP` (D-067).

## En un servidor propio (Docker Compose)

## Cómo queda montado

```
Internet ──HTTPS──▶ proxy HTTPS (Caddy, nginx o la plataforma)
                        │
                        ▼
                  frontend :3000  (Next.js; reenvía /api/* a la API)
                        │
                        ▼
                  backend :8000   (FastAPI; nunca expuesto a Internet)
                        │
                        ▼
                  PostgreSQL      (nunca expuesto a Internet; con backups)
```

- El navegador solo habla con un dominio. Las cookies de sesión son de primera parte.
- El **proxy HTTPS es obligatorio.** Las cookies son `Secure` y la API no arranca en producción sin un `FRONTEND_ORIGIN` con `https://`.
- **Una sola instancia de la API.** Los límites de intentos viven en memoria; con varias réplicas habría que pasarlos a Redis.
- Las migraciones se aplican solas al arrancar el contenedor del backend (`alembic upgrade head`).

## Variables de entorno

| Variable | Valor en producción | Notas |
| --- | --- | --- |
| `APP_ENV` | `production` | Desactiva `/docs` y `/openapi.json` y activa HSTS. |
| `JWT_SECRET_KEY` | 48+ caracteres aleatorios | `python -c "import secrets; print(secrets.token_urlsafe(48))"`. Nunca la de desarrollo. |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | credenciales nuevas y fuertes | Si la base es gestionada, usa la `DATABASE_URL` que te dé el proveedor. |
| `FRONTEND_ORIGIN` | `https://tu-dominio` | Si no empieza por `https://`, la API no arranca. |
| `COOKIE_SECURE` | `true` | Ya es el valor por defecto. |
| `TRUSTED_PROXY_HOPS` | normalmente `1` | Cuántos proxies delante añaden la IP del visitante. Ver abajo. |
| `GEMINI_API_KEY` | opcional | Sin ella, Balbo aparece como no disponible. Con el plan gratuito, Google puede usar los datos (la Política de privacidad lo dice). |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USERNAME` / `SMTP_PASSWORD` / `SMTP_FROM` | el correo que envía los códigos | Sin ellos no hay recuperación de contraseña. Ver «Correo para recuperar contraseñas». |
| `NEXT_PUBLIC_PRIVACY_EMAIL` | tu correo de privacidad | Se lee **al compilar** el frontend (build arg). |
| `API_INTERNAL_URL` | dirección interna de la API | También se lee al compilar. En Compose es `http://backend:8000`. |

Los secretos van en el `.env` del servidor o en el gestor de secretos de la plataforma, **nunca** en el repositorio.

### `TRUSTED_PROXY_HOPS`: la IP real del visitante

Los límites de intentos de login y registro van por IP. Next.js reenvía la cabecera `X-Forwarded-For` tal cual, así que la API solo confía en las entradas que añadieron **tus** proxies. Cada proxy añade una entrada por la derecha.

- **Caddy o nginx delante de la app web:** `1`.
  - Caddy reemplaza la cabecera con la IP real.
  - En nginx usa `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;` (o `$remote_addr`).
- **Plataforma más tu propio proxy:** cuenta los dos.
- **Sin proxy (solo en local):** `0`.

**Nunca pongas más saltos de los que hay.** Con uno de más, el cliente vuelve a poder inventarse la IP. Compruébalo después de desplegar con la prueba de abajo.

## Ejemplo con Docker Compose y Caddy en un servidor

1. Apunta el DNS del dominio a la IP del servidor.
2. Crea el `.env` del servidor a partir de `.env.example`, con los valores de la tabla.
3. Añade Caddy en la misma red de Compose:

   ```
   # Caddyfile: Caddy obtiene y renueva el certificado HTTPS por su cuenta
   tu-dominio {
       reverse_proxy frontend:3000
   }
   ```

   Caddy debe ser lo único que escucha en los puertos 80 y 443. El `docker-compose.yml` ya publica frontend, backend y base de datos solo en `127.0.0.1`.
4. Arranca con `docker compose up -d --build`.

## Después de desplegar: comprobaciones

- `https://tu-dominio/api/v1/health` responde `200` y `https://tu-dominio/api/v1/docs` responde `404`.
- Las cabeceras de la página incluyen `Strict-Transport-Security`, `Content-Security-Policy` con `nonce` y `X-Frame-Options: DENY`.
- Crear una cuenta, iniciar sesión, completar el onboarding y cerrar sesión funciona.
- **La IP no se puede falsificar.** Envía 7 logins fallidos, cada uno con un `X-Forwarded-For` inventado distinto. Antes del 7.º tiene que aparecer un `429`:

  ```bash
  for i in 1 2 3 4 5 6 7; do curl -s -o /dev/null -w "%{http_code} " -H "Content-Type: application/json" -H "X-Forwarded-For: 203.0.113.$i" -d '{"email":"nadie@example.com","password":"Nope-Nope-2026!"}' https://tu-dominio/api/v1/auth/login; done
  ```

  Si todos son `401`, `TRUSTED_PROXY_HOPS` es demasiado alto.
- **Backups.** Programa copias diarias de PostgreSQL (`pg_dump`) fuera del servidor y prueba a restaurar una al menos una vez.

## Correo para recuperar contraseñas

La recuperación de contraseña envía un código de 6 números por correo. Sirve cualquier proveedor SMTP. Lo más simple es una cuenta de Gmail creada solo para esto:

1. Crea la cuenta, por ejemplo `cuentaclara.soporte@gmail.com`. No uses tu correo personal.
2. Activa la **Verificación en dos pasos** en https://myaccount.google.com/security.
3. Crea una **contraseña de aplicación** en https://myaccount.google.com/apppasswords con el nombre «Cuenta Clara». Google muestra 16 letras: esa es `SMTP_PASSWORD`. No es la contraseña normal de la cuenta, y se puede revocar en cualquier momento.
4. Configura las variables `SMTP_*` (tabla de arriba): en las variables del proyecto en Vercel y, en local, en tu `.env`.
5. Prueba que puede enviar, sin mostrar la contraseña a nadie:

   ```bash
   cd backend
   python -m app.mail_check tu-correo-personal@ejemplo.com
   ```

   Si falla, el comando explica qué revisar. Después, en `/recuperar-contrasena`, pide un código para tu propia cuenta. Si no llega, revisa spam y los logs de la API («Password reset email failed»).

Ten en cuenta:

- **Outlook.com y Hotmail personales no sirven para enviar.** Microsoft ya no acepta contraseñas (ni contraseñas de aplicación) para SMTP en esas cuentas: responde `535 5.7.139 basic authentication is disabled`. Solo admite OAuth2. Un Outlook sí sirve como correo de **contacto** (`NEXT_PUBLIC_PRIVACY_EMAIL`), donde la gente escribe.

- **Límite de Gmail:** unos 500 correos al día, de sobra para empezar.
- **Para que no caigan en spam con más usuarios,** usa un dominio propio con un servicio de envío (Brevo, Resend, Amazon SES). Basta cambiar las variables `SMTP_*`.
- **Sin `SMTP_*` configurado,** la página de recuperación dice que no está disponible. En desarrollo, los correos se escriben en el log de la API en vez de enviarse.

## Limitaciones conocidas

- **Límites de intentos en memoria:** se reinician si se reinicia la API y no sirven con varias réplicas.
- **Revisión legal:** los textos de las páginas legales deberían pasar por un abogado antes del lanzamiento (D-064).
