#!/usr/bin/env bash
# Prueba de extremo a extremo de la app real contra un Supabase local (dos personas, dos navegadores).
#
# Uso: PGHOST=… PGPORT=… PGUSER=postgres POSTGREST_BIN=/ruta/postgrest OUT_DIR=/ruta/capturas supabase/tests/run-e2e.sh
# Requisitos: Python 3 con Playwright y Chromium. Arranca PostgreSQL→PostgREST→fake-supabase y el servidor de
# desarrollo de la app apuntando a ese Supabase, crea a Ana y Beto y ejecuta e2e_cloud.py.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
: "${POSTGREST_BIN:?Indica POSTGREST_BIN}" "${PGHOST:?Indica PGHOST}" "${PGPORT:=5432}"
export JWT_SECRET="${JWT_SECRET:-spotly-local-test-secret-0123456789abcdef}"
export FAKE_PORT="${E2E_FAKE_PORT:-54322}" PGRST_PORT="${E2E_PGRST_PORT:-3011}" APP_PORT="${E2E_APP_PORT:-8790}"
export PGRST_URL="http://127.0.0.1:${PGRST_PORT}"
WORK="${WORK_DIR:-$(mktemp -d)}"; OUT="${OUT_DIR:-$WORK/capturas}"
mkdir -p "$WORK" "$OUT"
export KEYS_FILE="$WORK/keys.json"
DB=spotly_e2e

psql -v ON_ERROR_STOP=1 -q -d postgres -c "drop database if exists $DB with (force)" -c "create database $DB"
psql -v ON_ERROR_STOP=1 -q -d $DB -f "$HERE/supabase_stub.sql"
for f in "$ROOT"/supabase/migrations/*.sql; do psql -v ON_ERROR_STOP=1 -q -d $DB -f "$f"; done
psql -v ON_ERROR_STOP=1 -q -d $DB -f "$HERE/fake_api.sql"

cat > "$WORK/pgrst.conf" <<EOF
db-uri = "postgres://authenticator@/${DB}?host=${PGHOST}&port=${PGPORT}"
db-schemas = "public,test_api"
db-anon-role = "anon"
jwt-secret = "${JWT_SECRET}"
server-host = "127.0.0.1"
server-port = ${PGRST_PORT}
log-level = "error"
EOF
"$POSTGREST_BIN" "$WORK/pgrst.conf" > "$WORK/pgrst.log" 2>&1 & PG_PID=$!
node "$HERE/fake-supabase.mjs" > "$WORK/fake.log" 2>&1 & FAKE_PID=$!
APP_PID=""
trap 'kill $PG_PID $FAKE_PID ${APP_PID:-} 2>/dev/null || true' EXIT
for _ in $(seq 1 100); do curl -sf "http://127.0.0.1:${FAKE_PORT}/__health" > /dev/null 2>&1 && curl -sf "http://127.0.0.1:${PGRST_PORT}/" > /dev/null 2>&1 && break; sleep 0.2; done
ANON=$(python3 -c "import json,sys;print(json.load(open(sys.argv[1]))['anonKey'])" "$KEYS_FILE")

cd "$ROOT"
VITE_SUPABASE_URL="http://127.0.0.1:${FAKE_PORT}" VITE_SUPABASE_PUBLISHABLE_KEY="$ANON" npx vite dev --port "$APP_PORT" --strictPort --host 127.0.0.1 > "$WORK/app.log" 2>&1 & APP_PID=$!
for _ in $(seq 1 200); do curl -sf "http://127.0.0.1:${APP_PORT}/" > /dev/null 2>&1 && break; sleep 0.5; done
python3 -I "$HERE/e2e_cloud.py" "http://127.0.0.1:${APP_PORT}/" "http://127.0.0.1:${FAKE_PORT}" "$KEYS_FILE" "$OUT"
