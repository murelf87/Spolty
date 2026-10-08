# Spotly original — avance móvil de voz (8 octubre 2026)

## Base y alcance
- Fuente: `murelf87/Spolty`, React 19 / TanStack Start / Tailwind / Supabase / Capacitor.
- Base: `main@e1403391841d9260bb936a8cc32e66c1d3537599`.
- Rama de desarrollo: `work/spotly-mobile-voice-mini-ready-20261008`. No modificar `main`.
- Se descarta como base la serie alternativa de ZIPs HTML/CSS/JS de Library.

## Cambios integrados en la rama
1. `src/lib/voice/player.ts`: pausa/reanudación sin descartar la cola de voces, salto a la siguiente, estado global observable y contador de pendientes.
2. `src/components/spotly/MiniVoicePlayer.tsx`: mini reproductor sobre la barra de navegación móvil, con progreso, pausa, siguiente y cierre; utiliza el único audio compartido.
3. `src/routes/index.tsx`: montaje del mini reproductor en la app React original; no se crean rutas ni pantallas alternativas.

## Auditoría puntual
- `VoiceThread.tsx`: las respuestas son de voz, hay grabación y onda; no se ha verificado pixel-perfect con capturas aprobadas.
- `AudioWallLive.tsx`: contiene salas y oyentes **de ejemplo** y declara que no hay transmisión real. No se debe presentar como directo operativo en producción.
- `player.ts`: la cola existe pero no había mini reproductor integrado ni se conservaba al reanudar.
- `VoiceThread.tsx`: falta aún incorporar y validar el botón visible «Reproducir todos los audios» dentro del hilo.
- `index.tsx`: el comportamiento existente llama `stopAllVoices()` al cambiar pestaña, hoja o Spot; la reproducción no continúa entre esas transiciones.

## Verificaciones
- GitHub confirma la rama con tres cambios de código respecto de `main@e140339`: 1 componente nuevo y 2 archivos modificados.
- Archivos recuperados desde la rama y hashes Git verificados por lectura.
- No se han ejecutado `npm run build`, `npm run lint`, SQL/API/E2E ni QA visual en dispositivo en esta ejecución.
- Pendiente probar 360×800, 390×844, 393×852, 430×932 y comprobar grabación, reproducción, navegación, privacidad y Supabase reales.

## Siguientes pasos
- Integrar botón «Reproducir todos los audios» en `VoiceThread.tsx` y cubrir cola con pruebas automatizadas.
- Corregir o deshabilitar salas simuladas de `AudioWallLive` en modo producción hasta tener streaming auténtico.
- Compilar y ejecutar pruebas con dependencias del repositorio original; comprobar las referencias visuales aprobadas en móvil.
- No fusionar, publicar ni declarar producción hasta superar gates completos.
