# Seguridad

Cuenta Clara guarda información financiera personal. Este documento explica cada medida de seguridad, **dónde está implementada** y **qué test la cubre**. Las decisiones con sus alternativas están en [`decisions.md`](decisions.md).

| # | Requisito | Estado |
| --- | --- | --- |
| 1 | Contraseñas (Argon2id + política) | ✅ Fase 2 |
| 2 | Sesiones (JWT corto + refresh rotativo en cookies) | ✅ Fase 2 |
| 3 | Protección contra abuso (rate limiting, bloqueo, errores genéricos) | ✅ Fase 2 |
| 4 | CSRF | ✅ Fase 2 |
| 5 | Validación estricta y SQL parametrizado | ✅ Fases 2–5 |
| 6 | Autorización por recurso (anti-IDOR) | ✅ Fase 3 |
| 7 | CORS, cabeceras y CSP | ✅ API (Fase 2) · Web (Fase 5) |
| 8 | Secretos y logs | ✅ |
| 9 | Auditoría de dependencias | ✅ pip-audit y npm audit |

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

> Los contadores viven en memoria del proceso. Con varias réplicas de la API habría que moverlos a Redis.

**¿Qué IP se cuenta?** Next.js reenvía `X-Forwarded-For` tal cual y nunca añade la IP del visitante. Por eso la API no deja que uvicorn lo interprete (`--no-proxy-headers`) y elige ella misma la entrada fiable (`client_ip` en `app/core/rate_limit.py`):

- Con `TRUSTED_PROXY_HOPS=N` usa la N-ésima entrada desde la derecha, la que añadió el proxy HTTPS propio. Lo que el cliente escribió a la izquierda se ignora.
- Con `0` (sin proxy) usa la dirección de la conexión.

Cubierto por `test_an_invented_forwarded_for_does_not_escape_the_ip_limit`, `test_behind_a_proxy_only_the_address_it_appended_counts` y `test_client_ip_reads_only_the_trusted_entries`. Ver D-066 y `docs/deploy.md`.

## 4. CSRF

Se usa el patrón **double-submit cookie**. Toda petición que cambia estado (`POST/PUT/PATCH/DELETE`) debe llevar la cabecera `X-CSRF-Token` con el mismo valor que la cookie `csrf_token`. Un sitio malicioso puede hacer que el navegador *envíe* nuestras cookies, pero no puede *leerlas*, así que no puede copiar el valor a la cabecera. La comparación usa `secrets.compare_digest` (tiempo constante).

Exentos: `login` y `register`, que crean la sesión y por eso aún no hay cookie. `SameSite=Lax` añade una segunda capa.
→ `app/core/http_security.py` · `tests/test_auth.py`, `tests/test_http_security.py`

## 5. Validación y SQL

- **Pydantic** valida cada request con `extra="forbid"`: un campo inesperado (por ejemplo `is_active`) devuelve `422` y no puede colarse en el modelo (*mass assignment*). Los correos se normalizan a minúsculas y la base lo garantiza con un `CHECK`.
- **Restricciones en la base:** montos `> 0`, `NUMERIC(12,2)` (nunca float) y frecuencias válidas. Aunque la API tuviera un bug, la base rechaza datos inválidos.
- **Sin SQL concatenado:** todas las consultas usan el ORM o parámetros de SQLAlchemy. Ruff con las reglas de bandit (`S`) alerta en CI si aparece SQL construido con strings.
- **Zod en el frontend** (`frontend/src/lib/validation.ts`) da respuesta inmediata en los formularios. Es solo UX: **el backend nunca confía en el cliente** y valida todo de nuevo (además rechaza contraseñas comunes, que el cliente no comprueba).

## 6. Autorización (anti-IDOR)

- `get_current_user` (`app/api/deps.py`) obtiene el usuario **solo** del JWT firmado, nunca de un parámetro de la petición.
- Un usuario no puede hacerse pasar por otro editando su token: cambiar `sub` rompe la firma. Cubierto en `test_user_cannot_impersonate_another_by_editing_their_token`.
- **Todas las consultas de datos financieros pasan por `app/services/ownership.py`**, que siempre añade `WHERE user_id = <usuario autenticado>`. Si el recurso es de otro usuario, la respuesta es `404`, idéntica a la de un id inexistente, para no confirmar que existe.
- **Ningún request acepta `user_id` ni `id`** (`extra="forbid"`): el dueño siempre sale de la sesión.
- **Referencias cruzadas:** un gasto o transacción solo puede apuntar a una categoría predeterminada o propia. Usar la categoría de otro usuario da `422 La categoría no existe.`
- **Cuentas:** cada `account_id` que llega (en movimientos, ingresos, gastos fijos, metas, transferencias o en `?account=` del dashboard) se comprueba contra las cuentas del usuario. Una cuenta ajena da `404`. Cubierto por `test_another_users_account_is_invisible`, que intenta ocho usos distintos de la cuenta de otra persona y verifica que su saldo no cambia.
- **Sin datos bancarios:** las cuentas guardan solo un nombre y un tipo. Nunca número de cuenta, tarjeta ni clave. Un nombre con más de 5 dígitos se rechaza en el formulario y en la API, para que nadie guarde un número de cuenta por error.
- **`tests/test_idor.py`** prueba, para cada recurso, que otro usuario no puede leerlo, editarlo, borrarlo ni verlo en listados, y que el original queda intacto. También cubre filtrar por la categoría de otro y enviar un `user_id` ajeno.
- **Los tests se validaron rompiendo el filtro a propósito:** sin `user_id` en la consulta, los tests de IDOR fallan.

## 7. CORS y cabeceras

- **CORS:** solo `FRONTEND_ORIGIN` puede llamar a la API con credenciales. Los métodos y las cabeceras permitidas están listados explícitamente.
- **Cabeceras en todas las respuestas:** `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `Permissions-Policy` restrictiva y `Cache-Control: no-store`, para que datos financieros no queden en cachés.
- **CSP** `default-src 'none'; frame-ancestors 'none'` en la API, que solo devuelve JSON. Swagger (`/docs`) queda excluido porque carga sus propios recursos, y además está desactivado en producción.
- **HSTS** (2 años) solo con `APP_ENV=production`. En local fijaría HTTPS en `localhost` durante meses.
  → `app/core/http_security.py`, `app/main.py` · `tests/test_http_security.py`

### En la app web (Next.js)

- **CSP estricta con nonce por petición** (`frontend/src/proxy.ts`):
  - Scripts: `script-src 'nonce-…' 'strict-dynamic'`, sin `unsafe-inline`, así que un XSS no puede ejecutar código inyectado.
  - Estilos: `style-src 'self' 'nonce-…'`.
  - Además: `object-src 'none'`, `frame-ancestors 'none'`, `form-action 'self'` y `base-uri 'self'`.
  - `unsafe-eval` solo en desarrollo.
- **Cabeceras** (`frontend/next.config.ts`): `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy` y `Permissions-Policy`. Sin `X-Powered-By`.
- **Mismo origen:** el navegador solo habla con la app web, y Next.js reenvía `/api/*` a FastAPI.
  - Las cookies de sesión son de primera parte y JavaScript solo puede leer `csrf_token`. Verificado en el navegador: `document.cookie` no muestra `access_token` ni `refresh_token`.
  - El proxy reenvía `X-Forwarded-For` sin tocarlo. La API solo confía en las entradas que añadieron los proxies propios (`TRUSTED_PROXY_HOPS`, sección 3).
- **Fuentes self-hosted** con `next/font`: ninguna petición a terceros al cargar la página.

## 8. Secretos y logs

- Toda la configuración sale de variables de entorno (`app/core/config.py`). `JWT_SECRET_KEY` es obligatoria y debe tener al menos 32 caracteres.
- `.env` está en `.gitignore`. Solo se versiona `.env.example`, con valores de relleno.
- En producción la app **no arranca** si `COOKIE_SECURE=false`.
- Los logs registran **IDs de usuario**, nunca correos, contraseñas ni tokens. El healthcheck no devuelve detalles de conexión a la base.

### Exportación a CSV (Fase 9)

- Solo exporta los movimientos del usuario autenticado. Cubierto por `test_export_only_includes_the_callers_data`.
- **Protección contra inyección de fórmulas:** cualquier texto del usuario (notas, nombres de categoría) que empiece con `= + - @`, tabulación o retorno se prefija con `'`. Así una nota como `=HYPERLINK(...)` no se ejecuta al abrir el archivo en Excel o Google Sheets.
  → `app/services/export.py` · `tests/test_phase9_api.py`

### Reporte en CSV o PDF

- Solo incluye datos y cuentas del usuario autenticado. Una cuenta ajena en `?account=` da `404`. Cubierto por `test_only_the_callers_data_and_accounts`.
- **CSV:** todas las celdas de texto (cuenta, concepto, categoría, nota) pasan por `safe_cell`, contra la inyección de fórmulas.
- **PDF:** se genera en el servidor dibujando texto plano con `fpdf2`. No se interpreta HTML ni nada que el usuario escriba, así que no hay inyección posible.
- El rango (máximo 3 años) y las filas (máximo 10 000) están limitados, para que nadie pida un archivo enorme.

### Balbo, el asistente con IA

- **La clave de Gemini solo existe en el backend** (`GEMINI_API_KEY`, nunca en el navegador ni en el repo). Es opcional: sin ella el asistente se desactiva.
- **Solo los datos del usuario autenticado** se usan para el resumen que recibe el modelo. Cubierto por `test_only_the_callers_data_is_sent`.
- **Qué sale hacia Google:** un resumen financiero (saldos, ingresos y gastos fijos con el nombre que el usuario les dio, predicción, metas) y el primer nombre. Nunca el correo, contraseñas ni números de cuenta. `store=False`, así que Google no conserva la conversación. La interfaz lo avisa.
- **Inyección de instrucciones:** los datos y la conversación van delimitados como información, separados de las instrucciones del sistema. Las instrucciones tratan cualquier intento de cambiar las reglas como fuera de tema. Ante un fuera de tema, el servidor responde un texto fijo. Cubierto por `test_data_and_conversation_are_fenced_off_from_the_instructions` y `test_off_topic_questions_get_a_fixed_refusal`.
- **Abuso y costo:** máximo 30 mensajes por usuario por hora (`429`), 12 turnos de hasta 1 000 caracteres, timeout de 25 s y un solo intento. Los roles distintos de `user`/`assistant` se rechazan (`422`).
- **Nada se guarda:** la conversación no se escribe en la base de datos y los logs no registran su contenido.
- **Salida:** la respuesta se muestra como texto plano. Las viñetas se convierten en una lista con React, sin interpretar HTML.
- **Consentimiento previo:** Balbo está apagado hasta que el usuario lo activa. Sin consentimiento, `POST /assistant/chat` responde `403` sin llamar al modelo. Cubierto por `test_nothing_is_sent_without_explicit_consent`.

### Datos personales (Ley 81 de 2019)

- **Consentimiento registrado:** el registro exige `accept_terms: true` (la casilla nunca viene marcada) y se guarda la versión y la fecha. Si los documentos cambian (`TERMS_VERSION`), la app bloquea el acceso hasta que el usuario acepte de nuevo, sin impedirle descargar o borrar sus datos.
- **Acceso y portabilidad:** `GET /me/export` devuelve todo en JSON, solo del usuario de la sesión, sin `password_hash`, `token_hash` ni ids internos de otros usuarios. Cubierto por `test_the_export_has_all_the_users_data_and_no_secrets` y `test_the_export_only_has_the_callers_data`.
- **Cancelación:** `POST /me/delete` pide la contraseña, tiene el mismo límite de intentos que el login y borra en cascada todas las filas del usuario. Cubierto por `test_deleting_the_account_needs_the_password_and_removes_everything`.
- **Cookies:** solo las tres técnicas de sesión y CSRF. No hay analítica ni terceros, así que el aviso es informativo y no pide elegir.

## 9. Dependencias

- Versiones exactas: `==` en `pyproject.toml` y sin rangos en `package.json`, más `package-lock.json`.
- En cada PR y cada push a `main`:
  - `pip-audit` revisa el backend.
  - `npm audit --omit=dev` bloquea si las dependencias de producción del frontend tienen vulnerabilidades altas.
  - El audit completo, que incluye herramientas de desarrollo, se muestra como informativo. Ver D-034.

---

## Cómo reportar un problema

Si encuentras una vulnerabilidad, no abras un issue público: escribe al autor del repositorio.
