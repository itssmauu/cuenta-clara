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
