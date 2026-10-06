#!/bin/sh
# Runs once, when the Postgres volume is first initialized.
# Creates the disposable database used by the backend test suite.
set -eu

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -c "CREATE DATABASE \"${POSTGRES_DB}_test\" OWNER \"$POSTGRES_USER\";"
