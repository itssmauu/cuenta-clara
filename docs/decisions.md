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
