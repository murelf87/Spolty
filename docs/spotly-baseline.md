# Spotly — auditoría de la aplicación original (2026-10-08)

Base: repositorio murelf87/Spolty, commit 9c109ddbc2af6ccb36ffd92dd2a6a9ca78697e2e. Esta rama de trabajo no modifica main.

## Arquitectura inspeccionada
- React 19, TanStack Start, Tailwind 4, Supabase y Capacitor 8.
- Ruta principal: src/routes/index.tsx; componentes en src/components/spotly.
- Poppins local con cinco pesos (400, 500, 600, 700, 800).
- Datos: 52 provincias y 8.131 municipios contados en los JSON originales.
- SpainMap incorpora SVG interactivo, zoom y navegación.
- SpotDetail incorpora foto, controles flotantes y comentarios de audio.
- VoiceReply utiliza un temporizador en lugar de grabar audio real.
- AudioWallLive representa salas de ejemplo, no una transmisión conectada.
- VoiceChats puede grabar audios locales; falta confirmar su entrega remota.

## Prioridades
Validar referencias móviles a 390x844, 393x852, 430x932 y 360x800. Conservar logo, tipografía, temas oscuro/perla y navegación. Respuestas solo por voz, sin caja de texto. Integrar captura, preescucha, envío confirmado y reproducción secuencial antes de habilitar publicaciones.

## Validación pendiente
No se han ejecutado npm ci, lint, build, pruebas de micrófono o comparación visual real. No se certifica producción. Los ZIP HTML/CSS/JS de checkpoints alternativos no son la fuente del proyecto.
