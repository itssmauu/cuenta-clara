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

## D-039 · Los datos de la app se cargan en el cliente

**Fase 6.** Como las cookies de sesión tienen `path=/api` (D-038), el servidor de Next no puede pedir datos en nombre del usuario. Las páginas privadas cargan sus datos en el navegador con un hook pequeño (`useResource`): estado de carga, error con reintento y recarga manual, conservando los datos previos mientras se actualizan. El estado de carga se *deriva* de qué petición terminó, en vez de marcarse dentro del efecto (regla `set-state-in-effect` de React 19). Si el proyecto crece, el siguiente paso natural es TanStack Query.

## D-040 · Onboarding: se guarda todo al final y sin duplicados

**Fase 6.** Los 4 pasos (monto inicial → gastos fijos → ingreso y frecuencia → límite) viven en el cliente y se guardan al terminar: gastos fijos, ingreso y, por último, los ajustes con `onboarding_completed: true`. Si algo falla a la mitad, el asistente recuerda qué ya se creó y el reintento no lo duplica. Hasta completar el onboarding, la app redirige a `/onboarding`; después, `/onboarding` redirige al dashboard.

- El **ingreso es opcional** (hay quien no tiene uno fijo), pero la **frecuencia es obligatoria**: define el periodo del usuario, con el que se miden el dashboard y el límite.
- `balance_as_of` es el día local del usuario al terminar el onboarding.

## D-041 · La gráfica sigue la skill de visualización de datos

**Fase 6.** Barras de máximo 24 px con esquinas de 4 px arriba y base recta; línea del límite punteada; etiqueta de valor solo en los periodos que se pasan (en color de tinta, nunca del color de la barra); eje Y con números redondos; tooltip al pasar el mouse o enfocar con teclado; leyenda visible. El validador de la skill marcó el coral con contraste 2.5:1 sobre blanco (WARN), lo que obliga a etiquetas visibles o vista de tabla: hay ambas ("Ver los datos como tabla"). El estado nunca depende solo del color: el chip y el medidor dicen "Te pasaste por $X" / "Dentro del límite" con icono.

Recharts funciona con la CSP estricta (D-033): la gráfica se renderiza en el cliente y React aplica sus estilos por el CSSOM, que la CSP no bloquea. Verificado en el navegador sin violaciones.

## D-042 · El periodo del dashboard vive en la URL

**Fase 6.** `/dashboard?period=monthly`: el selector Diario/Semanal/Quincenal/Mensual sobrevive a recargas, se puede compartir y el botón atrás funciona. Sin parámetro, se usa el periodo del usuario.

## D-043 · Secciones aún no construidas

**Fase 6.** Ingresos, Gastos, Gastos fijos, Predicción y Configuración ya tienen ruta con un estado vacío (Fase 7), así la navegación nunca lleva a un 404. Metas de ahorro y Reportes (Fase 9, pendientes de aprobación) se muestran deshabilitados con un icono de reloj y "(próximamente)" para lectores de pantalla.

## D-044 · Diálogos nativos para crear, editar y confirmar

**Fase 7.** Crear y editar se hacen en un `<dialog>` nativo (`components/ui/Dialog.tsx`): el navegador atrapa el foco, cierra con Esc, deja inerte la página de fondo y devuelve el foco al botón que lo abrió. El formulario se monta al abrir, así que siempre arranca con los valores del registro. Toda eliminación pasa por un `ConfirmDialog`; para ingresos y gastos fijos se sugiere **pausar** en vez de borrar.

## D-045 · Los cuerpos de las peticiones solo llevan campos aceptados

**Fase 7.** La API rechaza campos desconocidos (`extra="forbid"`, Fase 3). Al pausar un ingreso, el frontend enviaba la fila completa (con `id` y fechas de auditoría) y recibía 422; los tests no lo detectaron porque el mock aceptaba cualquier cosa y la aserción era parcial. Se encontró al probar en el navegador. Ahora `incomePayload` y `fixedExpensePayload` construyen el cuerpo explícitamente y los tests comparan el cuerpo **exacto**.

## D-046 · Filtros de movimientos en estado local

**Fase 7.** En `/gastos` los filtros (fechas, tipo, categoría) y la página viven en el estado del componente, no en la URL como el periodo del dashboard (D-042). Cualquier cambio de filtro vuelve a la primera página. Si se necesita compartir una búsqueda, se pasan a la URL.

## D-047 · Predicción: línea, cifra destacada y tabla

**Fase 7.** El saldo proyectado es un cambio en el tiempo de una sola serie: línea de 2 px con marcadores de 8 px, guía vertical y tooltip, sin leyenda (el título nombra la serie). La cifra principal ("saldo proyectado en N periodos") va como número destacado y el detalle completo en una tabla visible. Un saldo negativo se marca con icono y texto ("saldo negativo"), no solo con el color del punto.

## D-048 · Pruebas E2E con Playwright y auditoría de accesibilidad con axe

**Fase 8.** Las E2E corren contra el stack real (web + API + BD): en CI, contra Docker Compose. Cada pantalla, pública y privada, pasa por axe-core con las reglas WCAG 2.2 AA, y cualquier violación hace fallar el CI. En la primera corrida axe no encontró violaciones. Los fallos iniciales eran todos de selectores de los propios tests (textos repetidos a propósito, el anunciador de rutas de Next con `role="alert"`). Se usa un solo worker porque la API limita los logins por IP.

## D-049 · Enlace "Saltar al contenido" y páginas de error propias

**Fase 8.** El primer elemento enfocable de cada página es "Saltar al contenido", que lleva a `#contenido` (el `<main>` de cada layout). Hay páginas propias para 404 y para errores inesperados (`error.tsx`): no muestran detalles técnicos, solo un código de referencia y la opción de reintentar.

## D-050 · Selector de periodo en grilla en móviles

**Fase 8.** En 375 px los cuatro botones Diario/Semanal/Quincenal/Mensual se partían en dos líneas. En pantallas pequeñas se muestran como una grilla de 4 columnas a todo el ancho, y desde `sm` vuelven a ser píldoras en línea. El problema apareció al revisar las capturas generadas por Playwright.

## D-051 · Metas de ahorro: seguimiento, no movimiento de saldo

**Fase 9.** Una meta registra cuánto se apartó para algo, pero **aportar no resta del saldo disponible**: el dinero apartado sigue siendo del usuario y suele estar en la misma cuenta. Así no hay doble conteo con las transacciones. Cada meta muestra su progreso y, si tiene fecha objetivo, **cuánto apartar por periodo** (el periodo del usuario) para llegar a tiempo: lo que falta dividido entre los periodos restantes, contando el actual y redondeando hacia arriba al centavo. Se calcula en el backend con una función pura (`services/savings.py`). Retirar más de lo ahorrado se rechaza con 422.

## D-052 · Alerta al 80 % del límite

**Fase 9.** `/dashboard` devuelve `limit_status`: `none`, `ok`, `warning` (80 % o más del límite usado) u `over`. Con `warning` u `over`, el dashboard muestra un aviso con `role="status"`, icono y texto ("Atención: llevas el 85 % de tu límite semanal. Te quedan $6.00"). El umbral está en una constante (`WARNING_PERCENT`).

## D-053 · Comparación con el periodo anterior

**Fase 9.** `/dashboard` incluye ingresos y gasto del periodo anterior. Las tarjetas muestran la diferencia con flecha y palabras ("$15.00 menos que la semana anterior"), sin colores de "bueno/malo": gastar más no siempre es malo y el color solo confundiría. La resta se hace en centavos enteros (`subtractMoney`) para no usar floats con dinero.

## D-054 · Gasto por categoría con barras de un solo color

**Fase 9.** Suma gastos fijos y variables del periodo por categoría, de mayor a menor ("Sin categoría" al final en empates). Las barras horizontales son todas del mismo color porque comparan magnitudes; la identidad la da el nombre, y el color de cada categoría aparece como punto en la tabla. Valor al final de cada barra y tabla equivalente.

## D-055 · Exportar a CSV de forma segura

**Fase 9.** `GET /transactions/export` devuelve los movimientos del usuario con los mismos filtros que la lista (máximo 10 000 filas). Para que un archivo abierto en Excel no ejecute nada, cualquier texto del usuario que empiece con `= + - @`, tabulación o retorno se prefija con `'` (*CSV/formula injection*). Los montos son números con signo (gastos negativos), no texto del usuario. Lleva BOM UTF-8 para que Excel muestre bien las tildes.

## D-056 · Predicción con regresión lineal, opcional y explicable

**Fase 9.** El "aprendizaje automático sencillo" es una regresión lineal por mínimos cuadrados (`services/trend.py`, sin dependencias) sobre el gasto variable de hasta 8 periodos completos. Se proyecta la línea hacia adelante, nunca por debajo de 0. Es **opcional** (`estimator=trend`) y la página explica qué encontró: cuánto sube o baja el gasto por periodo y el R². Con menos de 3 periodos completos usa el promedio y lo dice. Se eligió algo pequeño y explicable en vez de un modelo opaco: con el historial de una persona, una línea es honesta sobre lo poco que se puede predecir.

## D-057 · Animaciones de la landing

**Fase 9 (ajuste de diseño).** Solo en la landing, que es una página de marketing que se ve pocas veces. La app de uso diario no se anima así.

- **Hero:** entra con un desvanecido hacia arriba escalonado, hecho solo con CSS, para que no parpadee al cargar.
- **Secciones:** aparecen con un desvanecido al llegar a la pantalla (`ScrollReveal.tsx`, con `IntersectionObserver`), una sola vez.
- **Estadísticas:** las barras crecen de izquierda a derecha (con `clip-path`, que no deforma los bordes redondeados) y las cifras cuentan desde 0.
- **Botones:** crecen un 4 % al pasar el mouse. El `hover:` de Tailwind solo aplica en dispositivos con puntero.
- **Accesibilidad y robustez:**
  - Sin JavaScript, con `prefers-reduced-motion` o en contenido ya visible al cargar, no se oculta nada.
  - Los lectores de pantalla oyen la cifra final una sola vez; los dígitos en movimiento están ocultos para ellos.
  - Saltar con Fin o con un enlace revela también lo que quedó atrás.
- Sin librerías nuevas: transiciones CSS y un `requestAnimationFrame` para el conteo.

## D-058 · Pulido de interacción en la app (filosofía de Emil Kowalski)

**Fase 9 (ajuste de diseño).** La app se usa a diario, así que cada animación debe tener un propósito y ser corta. Lo que se usa muchas veces al día apenas se mueve.

| Antes | Después | Por qué |
| --- | --- | --- |
| Aviso verde que empujaba el contenido hacia abajo | *Toast* oscuro flotante abajo: sube en 400 ms, sale por donde entró en 200 ms, no bloquea clics | Sin saltos de diseño; la salida es más rápida que la entrada |
| El periodo activo cambiaba de color de golpe | Una "píldora" se desliza a la opción elegida (capa duplicada recortada con `clip-path`, 260 ms) | Muestra de dónde a dónde cambió y el color del texto cambia sin mezclas |
| Fondo activo del menú saltaba de página en página | Indicador que se desliza a la nueva página (`transform`, 260 ms) | Continuidad espacial al navegar |
| Diálogos que aparecían de golpe | Escala 0.96→1 con opacidad (220 ms) y salida en 150 ms, con `@starting-style` | Los modales no tienen origen, por eso escalan desde el centro |
| Botones con `scale(0.98)` y la curva `ease-out` del navegador | `scale(0.97)` al presionar, curva `cubic-bezier(0.23, 1, 0.32, 1)` | Respuesta inmediata al toque |
| Barras de medidores animando `width` | `clip-path` sobre una barra completa: crecen al aparecer y se deslizan al cambiar | Solo propiedades baratas; el borde redondeado no se deforma |
| Cifras que cambiaban de golpe al cambiar de periodo | Entran con un leve desenfoque (280 ms) | El desenfoque une el valor viejo y el nuevo |
| Gráficas de Recharts animando 1.5 s | 600 ms con *ease-out* | Una pantalla diaria no puede hacer esperar |
| "Dashboard / Resumen de tus finanzas" | "Hola, Ana · Tu resumen de esta semana · 5 oct – 11 oct" e iconos en cada tarjeta | Menos genérico y con más contexto |

**Landing:** brillos de marca y una cuadrícula tenue dan profundidad al hero. El titular entra enfocándose (desenfoque → nítido) y el teléfono flota (CSS) y se inclina hacia el cursor con un resorte (inercia, no seguimiento rígido), solo con mouse o trackpad.

**Accesibilidad:**
- Con `prefers-reduced-motion` no hay desplazamientos ni flotación.
- Las copias decorativas (la píldora y el indicador) están ocultas a lectores de pantalla y no reciben clics.
- La auditoría axe sigue pasando en todas las pantallas.

## D-059 · Inicio de sesión y registro con una proyección animada

**Fase 9 (ajuste de diseño).** El panel oscuro tenía solo texto. Ahora muestra lo que hace el producto: predecir.

- **Proyección ilustrativa:** usa las cifras del ejemplo del producto (100 − 30 + 160 = 230, luego +130 por semana) y lleva la etiqueta "Ejemplo", así que no pretende ser información real del visitante.
  - La línea se dibuja de izquierda a derecha.
  - La franja de estimación "respira", porque el futuro es una estimación, no un hecho.
  - "Hoy" late como un marcador en vivo.
  - Un punto recorre la predicción.
  - Las cifras cuentan desde 0 con `@property` y `counter()`, solo con CSS.
  - Dos tarjetas flotan con las entradas del cálculo.
- **Barras de fondo:** suben en ola detrás del mensaje "Tu semana, bajo control" y siguen moviéndose suavemente.
- **Sin JavaScript:** todo es SVG y CSS, así que se renderiza en el servidor con la CSP de nonce. En celulares se oculta la gráfica para no empujar el formulario hacia abajo.
- **Pestañas:** pasaron al *layout* compartido. Como no se desmontan al cambiar de página, la píldora activa se desliza entre "Iniciar sesión" y "Registrarme" (`clip-path` sobre una copia, 320 ms).
- **Botón principal:**
  - Al pasar el mouse se eleva 2 px con un brillo de su color y la flecha avanza.
  - Se aprieta al presionarlo.
  - Mientras espera, el texto se difumina y aparece un indicador de carga.
- **Formulario:**
  - Los campos entran escalonados.
  - Cada requisito de contraseña cumplido hace "pop".
  - Un error del servidor llega con una sacudida corta.
  - El borde del campo activo se vuelve violeta.
- **Corrección:** en Tailwind v4, `scale-*` y `translate-*` usan sus propias propiedades CSS. La transición de los botones solo listaba `transform`, así que la presión y el crecimiento al pasar el mouse saltaban sin animarse. Ahora se listan `scale` y `translate`.
- **Movimiento reducido:** con `prefers-reduced-motion` no hay bucles (franja, pulso, flotación, punto viajero ni barras): solo el estado final.

## D-060 · Sin testimonio por ahora: demos de lo que hace la app

**Fase 9 (ajuste de diseño).** La landing tenía un hueco de testimonio con texto de relleno. Inventar uno sería engañoso, y el proyecto aún no tiene usuarios a quienes citar. Se reemplazó por "Te acompaña toda la semana":

- **Tres mini-demos que se reproducen al llegar a la pantalla**, con cifras ilustrativas y la etiqueta "Ejemplo":
  - la alerta al 80 % (la barra se llena y aparece el aviso);
  - una meta de ahorro (el anillo se llena y aparece el plan semanal);
  - la tendencia (la línea se dibuja y aparece la frase que la explica).
- **Una franja con todo lo que incluye la app**, en desplazamiento continuo.
  - Como es contenido que se mueve más de 5 segundos junto a otro contenido, tiene un botón "Pausar animación" (WCAG 2.2.2). También se detiene bajo el puntero.
  - Con `prefers-reduced-motion` es una lista estática y el botón desaparece.

Los testimonios reales quedan para el futuro, cuando haya personas que den su consentimiento.

**Lección técnica:** los estilos de `@layer components` pierden contra las utilidades de Tailwind (`flex`, `[mask-image:…]`). Para ocultar algo con movimiento reducido hay que usar las variantes `motion-reduce:`, no reglas en ese *layer*. Lo detectó la prueba E2E.

## D-061 · Varias cuentas por usuario

**Por qué.** Mucha gente separa su dinero como en el banco: una cuenta para los gastos del día y otra para el ahorro, a veces una de fondos. Con un solo saldo, los $400 ahorrados se veían como dinero para gastar y los gastos del día caían sobre el ahorro. Ahora cada usuario tiene de 1 a 10 cuentas.

- **Solo un nombre y un tipo** (gastos del día, ahorro, fondos o inversión, otro). Nunca número de cuenta, banco, tarjeta ni clave: la app necesita distinguirlas, no acceder a ellas.
  - Como protección extra, un nombre con más de 5 dígitos se rechaza tanto en el formulario como en la API ("no escribas números de cuenta").
- **Una cuenta principal, siempre exactamente una** (índice único parcial en la BD).
  - Es la de gastos del día: el dashboard abre en ella y el límite de gasto se mide ahí.
  - El registro la crea ("Cuenta principal").
  - Se cambia marcando otra como principal; no se puede quitar el rol sin dárselo a otra ni borrarla.
- **El saldo inicial pasó de los ajustes a cada cuenta.**
  - `balance_as_of` sigue siendo uno solo: el día desde el que se llevan las cuentas.
  - La migración le da a cada usuario existente su "Cuenta principal" con el saldo que tenía y le asigna todos sus datos.
- **Cada movimiento, ingreso y gasto fijo pertenece a una cuenta.**
  - Si no se indica, va a la principal al crear y no cambia al editar.
  - Una cuenta ajena da 404, igual que un id inexistente.
- **Transferencias entre cuentas.** Cambian el saldo de ambas, pero no son ingreso ni gasto: no cuentan para el límite ni para las categorías. Vistas en "Todas", se anulan.
- **Dashboard, predicción y reportes por cuenta** (`?account=<id>` o `?account=all`).
  - El dashboard muestra arriba una tarjeta por cuenta con su saldo, y el filtro queda en la URL.
  - En una cuenta de ahorro no se muestra el límite de gasto, que pertenece a la principal.
- **Metas ligadas a una cuenta.** Aportar mueve el dinero de verdad: una transferencia desde la cuenta elegida (por defecto la principal) a la cuenta de la meta, en la misma transacción que actualiza lo ahorrado. Retirar lo devuelve. También se puede "solo registrar" sin mover dinero.
- **Borrar una cuenta** solo se permite si no tiene movimientos, ingresos, gastos fijos, metas ni transferencias. Así nunca se pierde historial sin querer.
- **Onboarding:**
  - El paso 1 pregunta por las cuentas (nombre, tipo, saldo de hoy) y cuál es la de gastos del día.
  - El ingreso pregunta a qué cuenta llega.
  - Los gastos fijos salen de la principal, y se puede cambiar después.

## D-062 · Reporte de movimientos en CSV o PDF

**El problema.** El CSV de Reportes salía vacío. Había dos causas:

- Solo exportaba **transacciones sueltas**, y la mayor parte del dinero de un usuario se mueve con ingresos y gastos fijos (beca, pasaje, datos…), que nunca aparecían.
- Al elegir un rango corto, como 7 oct – 7 oct, no quedaba nada.

**La solución.** `GET /reports/export` arma un reporte como el estado de cuenta de un banco:

- Incluye las transacciones del rango, **cada ocurrencia** de los ingresos y gastos fijos activos (desde `balance_as_of`) y las transferencias de las cuentas elegidas.
- Las mismas filas alimentan los dos formatos, así que nunca se contradicen.
- Sin fechas, va desde que el usuario empezó a llevar sus cuentas hasta hoy.
- Se puede filtrar por tipo (ingresos o gastos) y por cuenta, o pedir todas.

**Dos formatos, a elección del usuario:**

- **CSV** para Excel o Google Sheets, con columnas `fecha, cuenta, tipo, concepto, categoria, monto, nota`.
  - El monto lleva signo.
  - Cada texto del usuario pasa por la protección contra inyección de fórmulas.
- **PDF** para leer, imprimir o compartir.
  - Encabezado con la cuenta y el rango, resumen (ingresos, gastos, transferencias, neto) y una tabla que repite su encabezado en cada página, con número de página.
  - Al pie aclara que lo generó el usuario y no es un documento bancario.

**Por qué `fpdf2` y en el servidor:**

- Es Python puro, sin navegador ni dependencias de sistema, y `pip-audit` no reporta vulnerabilidades.
- Generarlo en el backend reutiliza el mismo cálculo que el CSV y no añade JavaScript pesado al frontend.
- La licencia es LGPL‑3.0; la usamos como dependencia, sin modificarla.
- Las fuentes integradas cubren Latin‑1 (tildes, ñ, ¿, ¡). Algunos símbolos se sustituyen (→ por », guiones largos por -) y un emoji se vuelve "?" en lugar de romper el archivo.

**Límites:**

- El rango es de hasta 3 años y el reporte trae como máximo 10 000 filas, con un aviso si se recortó.
- "Desde" no puede ser posterior a "Hasta" (422).
- Una transferencia entre dos cuentas incluidas en el reporte suma 0, y la nota dice cuánto se movió.

La pantalla Movimientos conserva su propio CSV, que es exactamente la tabla filtrada.

## D-063 · Balbo, el copiloto financiero (Gemini)

**Qué es.** Un asistente en todas las páginas después de iniciar sesión: un botón redondo con forma de mensaje abajo a la derecha que abre un chat. Responde preguntas sobre las finanzas del usuario ("¿me alcanza para una PS5?", "dame un plan para ahorrar") con sus propios números.

**El nombre.** *Balbo*, por el balboa, la moneda de Panamá: corto, fácil de recordar, propio, y combina con "Cuenta Clara". Lema: "tu copiloto financiero".

**Cómo responde:**

1. El servidor arma un resumen de las finanzas del usuario autenticado: cuentas y saldos, periodo actual, límite, ingresos y gastos fijos, próximos pagos, predicción y metas. Usa las mismas funciones que el dashboard, así Balbo nunca contradice las pantallas.
2. Ese resumen y la conversación van al modelo **delimitados como datos** (`<<< >>>`), separados de las instrucciones del sistema.
3. **Regla de negocio:** las instrucciones limitan a Balbo a las finanzas personales. Si la pregunta es de otro tema, el modelo responde un marcador fijo (`FUERA_DE_TEMA`) y el servidor contesta con un rechazo amable escrito en el código, sin depender de cómo lo redacte el modelo.
4. Ante una compra, da un veredicto claro ("Sí, puedes", "Mejor espera" o "No te conviene ahora") con 2 o 3 razones basadas en sus datos. No inventa cifras y no recomienda productos financieros concretos.

**Por qué Gemini con el SDK oficial:**

- El usuario pidió Gemini o un modelo de aprendizaje automático. Un modelo de lenguaje es lo que permite conversar y razonar sobre una compra concreta, algo que un modelo entrenado aquí no lograría con el historial de una sola persona.
- Se usa `google-genai`, el SDK oficial (Apache‑2.0, `pip-audit` limpio), con la Interactions API. La documentación REST no confirmaba todos los campos, así que se verificaron en los tipos del propio SDK.
- El modelo es configurable (`GEMINI_MODEL`, por defecto `gemini-3.8-flash`). `store=False`: Google no guarda la conversación entre mensajes.

**Privacidad y límites:**

- La clave vive **solo en el backend** y es **opcional**. Sin ella, Balbo aparece como "no disponible" y el resto de la app funciona igual.
- La conversación existe solo en la pestaña del navegador: no se guarda en la base de datos. Se envían como máximo 12 turnos de hasta 1 000 caracteres.
- Se envía a Google el resumen financiero y el primer nombre, nunca el correo. Las cuentas no tienen números (D-061). El panel lo avisa: "Balbo usa IA (Gemini de Google) con un resumen de tus finanzas. Es orientación, no asesoría financiera profesional."
- Hay un máximo de 30 mensajes por usuario por hora (configurable) y un timeout de 30 s. Si el modelo falla, la respuesta es 503 con un mensaje claro.

**Interfaz:**

- El panel crece desde el botón, con origen abajo a la derecha. Entra en 220 ms y sale en 150 ms.
- Las respuestas suben con una animación corta y "escribiendo…" son tres puntos en ola, que no se mueven con movimiento reducido.
- Tiene sugerencias para empezar y convierte las viñetas "- " en una lista real. El texto nunca se interpreta como HTML.
- Escape cierra el panel desde cualquier lugar y devuelve el foco al botón.
