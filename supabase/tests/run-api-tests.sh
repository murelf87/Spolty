#!/usr/bin/env bash
# Prueba la capa de nube de la app (src/lib/cloud/api.ts) contra un Supabase local:
# PostgreSQL con la migración + PostgREST real + fake-supabase.mjs (auth y storage con las políticas RLS reales).
#
# Uso: PGHOST=… PGPORT=… PGUSER=postgres POSTGREST_BIN=/ruta/postgrest supabase/tests/run-api-tests.sh
# Con KEEP=1 los servidores siguen encendidos al terminar (para las pruebas de extremo a extremo de la app):
#   URL http://127.0.0.1:${FAKE_PORT:-54321} y la anon key en $WORK_DIR/keys.json.
set -euo pipefail
cd "$(dirname "$0")"
: "${POSTGREST_BIN:?Indica POSTGREST_BIN (binario de PostgREST 12 o superior)}"
: "${PGHOST:?Indica PGHOST}" "${PGPORT:=5432}"
export JWT_SECRET="${JWT_SECRET:-spotly-local-test-secret-0123456789abcdef}"
export FAKE_PORT="${FAKE_PORT:-54321}" PGRST_PORT="${PGRST_PORT:-3010}"
export PGRST_URL="http://127.0.0.1:${PGRST_PORT}"
WORK="${WORK_DIR:-$(mktemp -d)}"
mkdir -p "$WORK"
export KEYS_FILE="$WORK/keys.json"

./run-sql-tests.sh spotly_test > "$WORK/sql.log" 2>&1 || { tail -20 "$WORK/sql.log"; exit 1; }
echo "SQL: $(grep -c 'NOTICE:  ok' "$WORK/sql.log") comprobaciones correctas"

cat > "$WORK/pgrst.conf" <<EOF
db-uri = "postgres://authenticator@/spotly_test_api?host=${PGHOST}&port=${PGPORT}"
db-schemas = "public,test_api"
db-anon-role = "anon"
jwt-secret = "${JWT_SECRET}"
server-host = "127.0.0.1"
server-port = ${PGRST_PORT}
log-level = "error"
EOF
"$POSTGREST_BIN" "$WORK/pgrst.conf" > "$WORK/pgrst.log" 2>&1 &
PG_PID=$!
node fake-supabase.mjs > "$WORK/fake.log" 2>&1 &
FAKE_PID=$!
echo "$PG_PID $FAKE_PID" > "$WORK/pids"
if [ "${KEEP:-0}" != "1" ]; then trap 'kill $PG_PID $FAKE_PID 2>/dev/null || true' EXIT; fi
for _ in $(seq 1 100); do
  if curl -sf "http://127.0.0.1:${PGRST_PORT}/" > /dev/null 2>&1 && curl -sf "http://127.0.0.1:${FAKE_PORT}/__health" > /dev/null 2>&1; then break; fi
  sleep 0.2
done
npx --no-install tsx api.test.ts
