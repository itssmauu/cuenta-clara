# Seguridad

Cuenta Clara guarda información financiera personal. Este documento explica cada medida de seguridad, **dónde está implementada** y **qué test la cubre**. Las decisiones con sus alternativas están en [`decisions.md`](decisions.md).

| # | Requisito | Estado |
| --- | --- | --- |
| 1 | Contraseñas (Argon2id + política) | ✅ Fase 2 |
| 2 | Sesiones (JWT corto + refresh rotativo en cookies) | ✅ Fase 2 |
| 3 | Protección contra abuso (rate limiting, bloqueo, errores genéricos) | ✅ Fase 2 |
| 4 | CSRF | ✅ Fase 2 |
| 5 | Validación estricta y SQL parametrizado | ✅ Backend · Zod en Fase 5 |
| 6 | Autorización por recurso (anti-IDOR) | 🟡 Base en Fase 2 · CRUD en Fase 3 |
| 7 | CORS y cabeceras de seguridad | ✅ Fase 2 |
| 8 | Secretos y logs | ✅ |
| 9 | Auditoría de dependencias | ✅ Backend · npm en Fase 5 |

---

## 1. Contraseñas

- **Hash con Argon2id** (`argon2-cffi`, perfil RFC 9106: 64 MiB de memoria, 3 iteraciones, 4 hilos), con sal aleatoria por contraseña. Si en el futuro se suben los parámetros, el hash se recalcula de forma transparente en el siguiente login.
  → `app/core/security.py` · `tests/test_security.py`
- **Política** (`app/core/password_policy.py`):
  - 12 a 128 caracteres. El máximo evita que alguien mande contraseñas enormes para saturar el hashing.
  - Al menos una mayúscula, una minúscula, un número y un símbolo (cualquier carácter que no sea letra ni número, incluidos `¡ ¿ €`).
  - **Contraseñas comunes:** se quitan números y símbolos y se compara la palabra base contra una lista. Así `Password123!` o `Qwerty2026!!` se rechazan aunque cumplan las reglas de forma.
  - No puede contener el nombre ni la parte local del correo.
  - El backend devuelve **todas** las reglas incumplidas a la vez (`422` con `problems`), para que el formulario las muestre juntas.
  → `tests/test_password_policy.py`

> **Mejora futura:** consultar la API de *Have I Been Pwned* por k-anonimato (solo se envían los 5 primeros caracteres del SHA-1) para rechazar contraseñas filtradas.

## 2. Sesiones

| Cookie | Contenido | Flags | Path | Vida |
| --- | --- | --- | --- | --- |
| `access_token` | JWT HS256 firmado | `HttpOnly; Secure; SameSite=Lax` | `/api` | 15 min |
| `refresh_token` | 256 bits aleatorios (opaco) | `HttpOnly; Secure; SameSite=Lax` | `/api/v1/auth` | 7 días |
| `csrf_token` | 256 bits aleatorios | `Secure; SameSite=Lax` (legible por JS a propósito) | `/` | 7 días |

- **Nunca en `localStorage`:** una cookie `HttpOnly` no es accesible desde JavaScript, así que un XSS no puede robar la sesión.
- **El refresh token solo viaja a `/api/v1/auth`**, no a cada petición de la API.
- **JWT:** se fija el algoritmo al verificar (`algorithms=["HS256"]`), así un token con `alg: none` o firmado con otra clave se rechaza. También se exigen `exp`, `iat`, `iss` y `type=access`.
- **Refresh rotativo:** cada refresh token sirve **una sola vez**. Al usarlo se revoca y se emite uno nuevo.
- **Detección de robo:** si llega un refresh token **ya rotado**, alguien tiene una copia. Se revocan **todas** las sesiones de ese usuario, la del atacante y la legítima, y el usuario tiene que volver a iniciar sesión.
- **En la base solo se guarda el SHA-256** del refresh token. Con un volcado de la base no se pueden secuestrar sesiones. SHA-256 sin sal basta aquí porque el token es aleatorio de 256 bits y no se puede adivinar como una contraseña.
- **Logout** revoca el refresh token en la base y borra las tres cookies. El access token sigue siendo válido hasta que expira (≤ 15 min); es el compromiso habitual de los JWT sin estado.
  → `app/services/auth.py`, `app/api/cookies.py` · `tests/test_auth.py` (sección Refresh/Logout)

## 3. Protección contra abuso

- **Rate limiting por IP** (`slowapi`): login 5/min, registro 3/min. Al pasarse se devuelve `429` con `Retry-After`.
- **Rate limiting por email** (`limits`): 10 intentos/hora por correo, sumando todas las IPs. Frena los ataques distribuidos contra una misma cuenta.
- **Bloqueo temporal:** tras 5 contraseñas incorrectas seguidas la cuenta se bloquea 15 min. Durante el bloqueo **ni la contraseña correcta funciona**. Un login exitoso reinicia el contador. La fila del usuario se bloquea (`SELECT … FOR UPDATE`) para que peticiones simultáneas no se salten el contador.
- **Errores genéricos:**
  - Login: el mismo `401` y el mismo mensaje si el correo no existe, la contraseña es incorrecta, la cuenta está bloqueada o está desactivada.
  - Registro: siempre `202` con el mismo mensaje, exista o no el correo. Si ya existía, la cuenta original no se toca.
  - **Tiempo constante:** si el correo no existe, igual se verifica la contraseña contra un hash ficticio. En el registro se hashea antes de comprobar si el correo existe. Así el tiempo de respuesta tampoco delata qué correos tienen cuenta.
  → `app/core/rate_limit.py`, `app/services/auth.py` · `tests/test_auth.py` (sección Login)

> Los contadores viven en memoria del proceso. Con varias réplicas de la API habría que moverlos a Redis. Detrás de un proxy, `uvicorn --proxy-headers` es necesario para ver la IP real.

## 4. CSRF

Se usa el patrón **double-submit cookie**. Toda petición que cambia estado (`POST/PUT/PATCH/DELETE`) debe llevar la cabecera `X-CSRF-Token` con el mismo valor que la cookie `csrf_token`. Un sitio malicioso puede hacer que el navegador *envíe* nuestras cookies, pero no puede *leerlas*, así que no puede copiar el valor a la cabecera. La comparación usa `secrets.compare_digest` (tiempo constante).

Exentos: `login` y `register`, que crean la sesión y por eso aún no hay cookie. `SameSite=Lax` añade una segunda capa.
→ `app/core/http_security.py` · `tests/test_auth.py`, `tests/test_http_security.py`

## 5. Validación y SQL

- **Pydantic** valida cada request con `extra="forbid"`: un campo inesperado (por ejemplo `is_active`) devuelve `422` y no puede colarse en el modelo (*mass assignment*). Los correos se normalizan a minúsculas y la base lo garantiza con un `CHECK`.
- **Restricciones en la base:** montos `> 0`, `NUMERIC(12,2)` (nunca float) y frecuencias válidas. Aunque la API tuviera un bug, la base rechaza datos inválidos.
- **Sin SQL concatenado:** todas las consultas usan el ORM o parámetros de SQLAlchemy. Ruff con las reglas de bandit (`S`) alerta en CI si aparece SQL construido con strings.
- Zod en el frontend llega en la Fase 5. Es una ayuda de UX: **el backend nunca confía en el cliente**.

## 6. Autorización (anti-IDOR)

- `get_current_user` (`app/api/deps.py`) obtiene el usuario **solo** del JWT firmado, nunca de un parámetro de la petición.
- Un usuario no puede hacerse pasar por otro editando su token: cambiar `sub` rompe la firma. Cubierto en `test_user_cannot_impersonate_another_by_editing_their_token`.
- **Fase 3:** cada consulta de datos financieros filtra por `user_id` del usuario autenticado y devuelve `404` (no `403`) si el recurso es de otro, para no confirmar que existe. Habrá un test de IDOR por cada endpoint.

## 7. CORS y cabeceras

- **CORS:** solo `FRONTEND_ORIGIN` puede llamar a la API con credenciales. Los métodos y las cabeceras permitidas están listados explícitamente.
- **Cabeceras en todas las respuestas:** `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `Permissions-Policy` restrictiva y `Cache-Control: no-store`, para que datos financieros no queden en cachés.
- **CSP** `default-src 'none'; frame-ancestors 'none'` en la API, que solo devuelve JSON. Swagger (`/docs`) queda excluido porque carga sus propios recursos, y además está desactivado en producción.
- **HSTS** (2 años) solo con `APP_ENV=production`. En local fijaría HTTPS en `localhost` durante meses.
  → `app/core/http_security.py`, `app/main.py` · `tests/test_http_security.py`

## 8. Secretos y logs

- Toda la configuración sale de variables de entorno (`app/core/config.py`). `JWT_SECRET_KEY` es obligatoria y debe tener al menos 32 caracteres.
- `.env` está en `.gitignore`. Solo se versiona `.env.example`, con valores de relleno.
- En producción la app **no arranca** si `COOKIE_SECURE=false`.
- Los logs registran **IDs de usuario**, nunca correos, contraseñas ni tokens. El healthcheck no devuelve detalles de conexión a la base.

## 9. Dependencias

- Versiones fijadas con `==` en `pyproject.toml`.
- `pip-audit` corre en cada PR y en cada push a `main`. `npm audit` se añade con el frontend en la Fase 5.

---

## Cómo reportar un problema

Si encuentras una vulnerabilidad, no abras un issue público: escribe al autor del repositorio.
