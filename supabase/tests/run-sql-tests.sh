#!/usr/bin/env bash
# Prueba la migración de Spotly en un PostgreSQL local (≥ 15) con un entorno tipo Supabase.
# Uso: PGHOST=… PGPORT=… PGUSER=postgres supabase/tests/run-sql-tests.sh [nombre_bd]
# Crea la base de datos desde cero (la borra si existe), aplica stub + migración y ejecuta las pruebas.
set -euo pipefail
cd "$(dirname "$0")"
DB="${1:-spotly_test}"
psql -v ON_ERROR_STOP=1 -q -d postgres -c "drop database if exists \"$DB\" with (force)" -c "create database \"$DB\""
psql -v ON_ERROR_STOP=1 -q -d "$DB" -f supabase_stub.sql
for f in ../migrations/*.sql; do psql -v ON_ERROR_STOP=1 -q -d "$DB" -f "$f"; done
psql -v ON_ERROR_STOP=1 -q -d "$DB" -f fake_api.sql
psql -v ON_ERROR_STOP=1 -d "$DB" -f spotly_social.test.sql 2>&1 | tee /dev/stderr | grep -q SPOTLY_SQL_TESTS_OK
# Base limpia para las pruebas de la API (fake-supabase.mjs): misma migración, sin datos de prueba.
psql -v ON_ERROR_STOP=1 -q -d postgres -c "drop database if exists \"${DB}_api\" with (force)" -c "create database \"${DB}_api\""
psql -v ON_ERROR_STOP=1 -q -d "${DB}_api" -f supabase_stub.sql
for f in ../migrations/*.sql; do psql -v ON_ERROR_STOP=1 -q -d "${DB}_api" -f "$f"; done
psql -v ON_ERROR_STOP=1 -q -d "${DB}_api" -f fake_api.sql
echo "SQL OK · base ${DB}_api lista para las pruebas de la API"
