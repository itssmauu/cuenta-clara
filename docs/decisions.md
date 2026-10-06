# Registro de decisiones

Decisiones menores tomadas durante el desarrollo. Cada entrada explica el contexto y el porqué, para poder revisarla después.

## D-001 · Repositorio público

**Fase 0.** El repositorio se crea público desde el inicio porque forma parte del portafolio. Esto refuerza la regla de no commitear secretos: solo `.env.example` con valores de relleno.

## D-002 · Docker Compose crece por fases

**Fase 0.** `docker-compose.yml` arranca solo con PostgreSQL 16. Los servicios `backend` y `frontend` se añaden en las fases 1 y 5, cuando exista código que levantar, para no tener servicios rotos en `main`.

## D-003 · Postgres expuesto solo en `127.0.0.1`

**Fase 0.** El puerto de la base de datos se publica en `127.0.0.1` y no en `0.0.0.0`, así no queda accesible desde otras máquinas de la red local.

## D-004 · Finales de línea LF

**Fase 0.** El desarrollo es en Windows pero CI y los contenedores son Linux. `.gitattributes` normaliza todo a LF en el repositorio (excepto scripts `.ps1`/`.bat`) y `.editorconfig` alinea los editores.

## D-005 · Python 3.12 como objetivo, 3.13 tolerado en local

**Fase 0.** El stack exige Python 3.12; Docker y CI usan 3.12. La máquina de desarrollo tiene 3.13, así que `pyproject.toml` declarará `requires-python = ">=3.12"` para permitir correr tests en local sin instalar otra versión. CI es la fuente de verdad.

## D-006 · CI en push a `main` y en pull requests

**Fase 0.** El workflow corre en cada push a `main` y en cada PR. No corre en push a ramas de funcionalidad para evitar ejecuciones duplicadas, ya que toda rama llega a `main` mediante un PR.

## D-007 · SQLAlchemy síncrono con psycopg 3

**Fase 1.** Se usa la API síncrona de SQLAlchemy con el driver `psycopg` 3. FastAPI ejecuta los endpoints síncronos en un pool de hilos, así que la app atiende peticiones concurrentes sin la complejidad de `async` (sesiones async, `await` en cada consulta, carga perezosa prohibida). Para el volumen de una app personal es más que suficiente. Si algún día hace falta, psycopg 3 también soporta async sin cambiar de driver.

## D-008 · Enums como `VARCHAR` + `CHECK`, no como tipos nativos de Postgres

**Fase 1.** Frecuencias y tipos de transacción se guardan como texto con una restricción `CHECK`. Los `ENUM` nativos de Postgres son difíciles de modificar en migraciones (no se pueden quitar valores ni usar uno nuevo en la misma transacción). Se guarda el **valor** (`"weekly"`), no el nombre del miembro (`"WEEKLY"`).

Autogenerate de Alembic duplica esas restricciones al crear la tabla; la migración inicial se revisó a mano para dejar una sola por columna.

## D-009 · `custom_period_days` también en ingresos y gastos fijos

**Fase 1.** El modelo original solo lo tenía en `user_settings`, pero ingresos y gastos fijos también aceptan frecuencia "personalizada" y sin el número de días no se puede proyectar. Las tres tablas llevan la regla `CHECK`: `custom_period_days` existe **si y solo si** la frecuencia es `custom`.

## D-010 · Categorías por defecto compartidas

**Fase 1.** Las 5 categorías por defecto (Transporte, Servicios, Comida, Ocio, Otros) son filas con `user_id NULL` creadas por una migración de datos, no copias por usuario. La restricción única `(user_id, name)` usa `NULLS NOT DISTINCT` (Postgres 15+) para que tampoco puedan duplicarse las compartidas. Sus colores salen de los tokens de diseño (Ocio usa el menta oscuro `#0F7A57` por contraste).

## D-011 · Versiones fijadas en `pyproject.toml`

**Fase 1.** Las dependencias directas se fijan con `==` y `pip-audit` las revisa en CI. Las transitivas no tienen lockfile todavía; si se vuelve un problema, se migra a `uv` con `uv.lock`.

## D-012 · Base de datos de tests separada y obligatoria

**Fase 1.** Los tests reconstruyen el esquema con las migraciones reales (`downgrade base` → `upgrade head`) y cada test corre dentro de una transacción que se revierte. Por eso exigen una `TEST_DATABASE_URL` explícita y fallan si no existe: nunca caen por defecto sobre la base de desarrollo. En Docker, un script de init crea `<POSTGRES_DB>_test` automáticamente.

## D-013 · Migraciones al arrancar el contenedor

**Fase 1.** El contenedor del backend ejecuta `alembic upgrade head` antes de `uvicorn`. Es simple y suficiente con una sola instancia. Con varias réplicas habría que moverlo a un paso de despliegue separado para evitar migraciones concurrentes.

## D-014 · Swagger desactivado en producción

**Fase 1.** `/docs` y `/openapi.json` están disponibles en desarrollo y tests, y se desactivan con `APP_ENV=production` para no publicar el mapa completo de la API.

## D-015 · El registro no revela si un correo ya existe

**Fase 2.** `POST /auth/register` responde siempre `202` con el mismo mensaje, y no inicia sesión. Si el correo ya tenía cuenta no pasa nada (la cuenta original no se toca). El frontend, después de registrar, llama a `login` con las mismas credenciales: si la cuenta era nueva, entra; si no, recibe el error genérico de login. Así nadie puede usar el formulario de registro para averiguar quién usa la app.

El costo: sin verificación de correo, un usuario que olvidó que ya tenía cuenta solo ve "correo o contraseña incorrectos". Cuando haya envío de correos, el registro duplicado enviará un aviso "ya tienes una cuenta" al dueño del correo.

## D-016 · Refresh tokens opacos, no JWT

**Fase 2.** El access token es un JWT (se valida sin ir a la base en cada petición). El refresh token es un valor aleatorio guardado (hasheado) en `refresh_tokens`, porque necesita poder **revocarse** y **rotarse**, y detectar reutilización. Un JWT de refresh no se podría invalidar antes de que expire.

## D-017 · Bloqueo temporal por cuenta, con límite por correo

**Fase 2.** Tras 5 fallos la cuenta se bloquea 15 minutos. El riesgo conocido es que alguien bloquee a propósito la cuenta de otro (DoS). Se acepta porque el bloqueo es corto y se libera solo, y el límite por correo (10/hora) acota cuántas veces puede repetirse.

## D-018 · CSRF con double-submit cookie

**Fase 2.** Se eligió double-submit (cookie legible + cabecera) en vez de un token sincronizado en el servidor: no necesita estado y encaja con una API JSON que consume un SPA. Se compara en tiempo constante y se combina con `SameSite=Lax` y CORS restringido.

## D-019 · Mensajes de error de la API en español

**Fase 2.** Los textos que el usuario final puede ver (errores de login, problemas de la contraseña, rate limiting) vienen ya en español desde la API, para que el frontend los muestre tal cual. El código, los nombres y los logs siguen en inglés.

## D-020 · Rate limiting en memoria

**Fase 2.** `slowapi` y `limits` guardan los contadores en la memoria del proceso. Con una sola instancia es suficiente. Con varias réplicas, cada una contaría por separado y habría que usar Redis (ambas librerías lo soportan cambiando el *storage*).

## D-021 · Los montos viajan como texto en JSON

**Fase 3.** La API devuelve los montos como strings con dos decimales (`"160.00"`) y acepta strings o números. JSON no tiene tipo decimal, y si el frontend los leyera como `number` (float binario) aparecerían errores del tipo `0.1 + 0.2 = 0.30000000000000004`. El frontend formatea con `Intl.NumberFormat` y, si tiene que operar, lo hace sobre centavos enteros.

## D-022 · Recursos de otro usuario responden 404, no 403

**Fase 3.** Si Beto pide un ingreso de Ana por su id, recibe `404 No encontrado`, igual que si el id no existiera. Un `403` le confirmaría que ese id es válido y pertenece a alguien. Todas las consultas pasan por `services/ownership.py`, que siempre filtra por `user_id`, y `tests/test_idor.py` lo verifica para cada recurso. Se comprobó rompiendo el filtro a propósito: los tests fallan.

La única excepción son las categorías predeterminadas: son visibles para todos, así que intentar editarlas devuelve `403` con un mensaje claro.

## D-023 · `PUT` reemplaza el registro completo

**Fase 3.** Las actualizaciones usan `PUT` con el objeto entero en vez de `PATCH` parcial. Los formularios del frontend siempre envían todos los campos, y así las reglas que cruzan campos (frecuencia `custom` ⇔ días) se validan siempre sobre el estado final. Un campo opcional omitido vuelve a su valor por defecto.

## D-024 · Nombres de categoría únicos sin distinguir mayúsculas, incluidas las predeterminadas

**Fase 3.** Un usuario no puede crear "comida" porque ya existe la predeterminada "Comida". Ver dos categorías con el mismo nombre en un selector sería confuso. Al borrar una categoría propia, sus gastos y transacciones se conservan sin categoría (`ON DELETE SET NULL`).

## D-025 · Monto inicial no negativo

**Fase 3.** `initial_balance` acepta `0` o más. Empezar con saldo negativo (deudas) es un caso válido, pero complica la UI de onboarding y el mensaje "te quedan $X". Se puede relajar más adelante: la base no lo restringe, solo la validación de la API.

## D-026 · El saldo empieza en `balance_as_of`

**Fase 4.** Se añadió `user_settings.balance_as_of`: el día en que el monto inicial era cierto. Sin esa fecha no hay forma de saber qué movimientos ya están incluidos en el monto inicial. Nada anterior cuenta para el saldo, los límites ni los promedios. Detalle en [`calculations.md`](calculations.md).

## D-027 · Gastos fijos con `start_date`

**Fase 4.** Los ingresos ya tenían `start_date`; los gastos fijos no, y sin ella un gasto semanal no tiene un día de la semana definido. Ahora es obligatoria en ambos (coherente con D-023: editar un gasto no reinicia su fecha en silencio).

## D-028 · Lo recurrente se cuenta solo; las transacciones son lo variable

**Fase 4.** Los ingresos recurrentes y los gastos fijos se suman y restan automáticamente en sus fechas. Las transacciones son para lo que no se repite. Si el usuario registrara también su sueldo como transacción, contaría doble. La interfaz lo explicará en el formulario de transacciones (Fase 7).

## D-029 · El límite de gasto incluye los gastos fijos

**Fase 4.** "Te pasaste" se calcula sobre todo lo que salió en el periodo (fijos + variables), porque la pregunta del usuario es "¿me alcanza?". El límite se define por el periodo de ingreso y se convierte a otros periodos por duración promedio.

## D-030 · La fecha de referencia la envía el cliente

**Fase 4.** `/dashboard` y `/forecast` aceptan `?date=YYYY-MM-DD` (por defecto, la fecha del servidor). Así "hoy" coincide con la zona horaria del usuario sin guardar zonas horarias en el backend, y los tests son deterministas.

## D-031 · Desactivar un ingreso o gasto fijo lo quita también del pasado

**Fase 4.** No se guarda cuándo estuvo activo cada registro. Desactivarlo lo excluye de todos los cálculos, incluidos los periodos anteriores. Es una simplificación aceptable para un presupuesto personal; si molesta, se añade `end_date`.

## D-032 · El frontend hace de proxy de `/api`

**Fase 5.** El navegador solo habla con el origen de Next.js; `next.config.ts` reescribe `/api/*` hacia FastAPI. Así las cookies de sesión son de primera parte (`SameSite=Lax` funciona sin excepciones), el navegador nunca hace peticiones cross-origin y en producción basta un solo dominio. El CORS restringido del backend se mantiene como segunda barrera.

El proxy reenvía `X-Forwarded-For` y uvicorn lo usa para el rate limiting por IP, pero solo si la petición viene de una IP en `FORWARDED_ALLOW_IPS`. En Docker Compose se confía en la red interna (`*`); en producción debe ser la IP del proxy.

## D-033 · CSP con nonce: todas las páginas se renderizan por petición

**Fase 5.** `src/proxy.ts` genera un nonce por petición y una CSP estricta (`script-src 'nonce-…' 'strict-dynamic'`, sin `unsafe-inline`). El nonce solo llega a páginas renderizadas dinámicamente, así que el layout raíz llama a `connection()`. El costo (sin HTML estático pre-generado) es irrelevante para esta app y a cambio un XSS no puede ejecutar scripts inyectados. Consecuencia: no se usan atributos `style` en línea; los tamaños de las barras de ejemplo son clases de Tailwind.

## D-034 · `npm audit` bloquea solo dependencias de producción

**Fase 5.** Las dependencias de producción tienen 0 vulnerabilidades. Hay 5 avisos altos en herramientas de lint (`eslint-config-next → fast-glob → micromatch → braces`, sin versión corregida); el "arreglo" de npm bajaría `eslint-config-next` a la v14. El CI falla con `npm audit --omit=dev` y muestra el audit completo como informativo.

## D-035 · Tokens de diseño en `@theme` (Tailwind v4)

**Fase 5.** Tailwind v4 se configura en CSS, no en `tailwind.config.js`. Todos los tokens (colores, fuentes, radios) están en `@theme` dentro de `src/app/globals.css`, que genera a la vez las variables CSS y las utilidades (`bg-primary`, `rounded-card`…). Los componentes nunca usan hexadecimales sueltos.

## D-036 · Tokens del proyecto por encima de la recomendación de ui-ux-pro-max

**Fase 5.** La skill de diseño sugirió IBM Plex y una paleta dorada para fintech. Se mantuvieron Sora/Manrope y la paleta del prompt maestro (también usadas en el wireframe). De la skill se adoptaron el patrón "confianza y autoridad", las reglas de formularios (validación al salir del campo, error junto al campo con `aria-describedby`, resumen de errores enfocable, mostrar contraseña, permitir pegar), el uso de `next/font`, componentes de servidor por defecto y el checklist de entrega (contraste, foco visible, objetivos de 44 px, `prefers-reduced-motion`, sin scroll horizontal en móvil).

## D-037 · Login y registro son rutas, no pestañas en JavaScript

**Fase 5.** El wireframe muestra una tarjeta con pestañas. Se implementaron como enlaces a `/login` y `/register` con `aria-current`: cada formulario tiene su URL, el botón atrás funciona y la landing enlaza directo al registro.

## D-038 · La sesión se comprueba contra la API, no en el `proxy`

**Fase 5.** Las cookies de sesión tienen `path=/api`, así que no viajan al pedir `/dashboard` y el `proxy` de Next no puede saber si hay sesión. Las páginas privadas llaman a `/api/v1/auth/me` (renovando con el refresh token si hace falta) y redirigen a `/login` con 401. La API sigue siendo la única que decide.
