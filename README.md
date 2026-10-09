# Spotly

Red social **solo de voz** para enterarte de lo que pasa en tu ciudad o tu pueblo, en toda España. Se escribe solo
el título del Spot y los nombres; todo lo demás (respuestas, chats, presentación del perfil, búsqueda) es voz.

Proyecto conectado a [Lovable](https://lovable.dev): lo que se sube a `main` aparece en el editor de Lovable. No se
reescribe el historial publicado (sin force push ni rebase de commits subidos). Las decisiones del producto están en
`AGENTS.md`.

## Estado

| Parte | Estado |
|---|---|
| Cuentas (correo con código, Apple y Google en la web) | Real (Lovable Cloud) |
| Spots con voz, foto o vídeo; respuestas de voz encadenadas; me gusta, guardados, vistas | Real con la nube activada; si no, en el propio móvil |
| Seguidores, chats de voz 1 a 1 y de grupo, historias, comunidades, eventos, avisos, bloqueos, denuncias, borrar cuenta | Real con la nube activada |
| Pagos (Impulsar, Promocionar, Premium, créditos), audio en directo, Spotly Local, verificación con documento, push | Demostración rotulada: no cobra ni envía nada |

La nube se activa una sola vez aplicando la migración en Lovable Cloud: **[docs/ACTIVAR_NUBE.md](docs/ACTIVAR_NUBE.md)**.
Mientras tanto la app funciona igual, pero cada móvil guarda lo suyo.

## Desarrollo

Requisitos: Node.js 22 y npm.

```sh
npm ci
npm run dev        # servidor de desarrollo (Lovable inyecta VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY)
```

Sin esas variables (o con `VITE_SPOTLY_CLOUD=off`) la app no llama al servidor y guarda todo en el dispositivo.
«Saltar todo» en la bienvenida abre el modo demostración, con contenido y cifras de ejemplo.

## Compilaciones

| Qué | Comando | Salida |
|---|---|---|
| Web de producción (Lovable / Cloudflare) | `npm run build` | `.output/` |
| Apps nativas iPhone y Android (Capacitor, nube activada) | `npx vite build -c vite.app.config.ts` y `npx cap sync` | `dist-app/` · guía: [docs/APPS_NATIVAS.md](docs/APPS_NATIVAS.md) |
| Vista previa interactiva de un solo archivo (artifact) | `VITE_SPOTLY_CLOUD=off npx vite build -c vite.preview.config.ts` | `dist-preview/index.html` → `preview.html` |
| Versión instalable de prueba (PWA de demostración) | `VITE_SPOTLY_CLOUD=off npx vite build -c vite.mobile.config.ts` | `dist-mobile/` → rama `gh-pages` ([enlace](https://murelf87.github.io/Spolty/)) |

## Pruebas

Necesitan PostgreSQL 16, PostgREST 14 y, para la de navegador, Python 3 con Playwright y Chromium.

```sh
# Reglas de la base de datos (RLS, vistas anónimas, almacenamiento, límites): 97 comprobaciones
PGHOST=… PGPORT=… PGUSER=postgres supabase/tests/run-sql-tests.sh
# API real a través de PostgREST: 75 comprobaciones
PGHOST=… PGPORT=… PGUSER=postgres POSTGREST_BIN=/ruta/postgrest supabase/tests/run-api-tests.sh
# Dos personas en dos navegadores contra un Supabase local: 23 pasos
PGHOST=… PGPORT=… PGUSER=postgres POSTGREST_BIN=/ruta/postgrest OUT_DIR=/ruta/capturas supabase/tests/run-e2e.sh
# La misma prueba contra la web empaquetada de las apps nativas
E2E_APP_BUILD=app … supabase/tests/run-e2e.sh
```

Además: `npx tsc --noEmit` y `npm run lint`.

## Estructura

- `src/routes/index.tsx`: la app (una sola pantalla con pestañas por estado, pensada para móvil).
- `src/components/spotly/`: pantallas. `VoiceThread.tsx` es el motor de todas las voces; `kit.tsx`, las piezas comunes
  (cabecera, hojas, botones).
- `src/lib/voice/`: grabación real, reproductor (una voz a la vez) y notas de voz.
- `src/lib/cloud/`: la nube (solo con sesión, migración aplicada y fuera del modo demostración).
- `src/styles.css`: colores, degradados y medidas de la marca (los componentes solo usan esos tokens).
- `supabase/migrations/`: el esquema de la nube. `supabase/tests/`: sus pruebas.
- `docs/`: activar la nube, apps nativas y el contrato de backend.

Hecho con TanStack Start, React 19, TypeScript, Tailwind CSS 4, Vite, Lovable Cloud (Supabase) y Capacitor.
