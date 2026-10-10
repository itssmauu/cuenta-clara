# Despliegue a producción

Guía para publicar Cuenta Clara de forma segura. Las razones de cada punto están en `docs/security.md` y en las decisiones D-064 a D-066.

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

## Limitaciones conocidas

- **No hay recuperación de contraseña.** Necesita envío de correo, que la API todavía no tiene. Quien la olvide no puede recuperar su cuenta.
- **Límites de intentos en memoria:** se reinician si se reinicia la API y no sirven con varias réplicas.
- **Revisión legal:** los textos de las páginas legales deberían pasar por un abogado antes del lanzamiento (D-064).
