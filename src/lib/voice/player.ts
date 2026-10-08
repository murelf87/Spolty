/**
 * Reproductor de voz único de Spotly: en toda la app solo suena un audio a la vez.
 *
 * Un solo <audio> compartido (en iOS, reutilizar el mismo elemento evita bloqueos de reproducción). Cada voz se
 * identifica por su id; al darle a otra, la anterior se pausa. El progreso se publica con requestAnimationFrame
 * para que la onda avance suave. `stopAllVoices()` se llama al cambiar de pantalla, ciudad, Spot o sesión.
 */
import { useSyncExternalStore } from "react";

export type PlaybackSnapshot = { id: string | null; playing: boolean; positionMs: number; durationMs: number; loading: boolean };

const IDLE: PlaybackSnapshot = { id: null, playing: false, positionMs: 0, durationMs: 0, loading: false };
let snap: PlaybackSnapshot = IDLE;
let audio: HTMLAudioElement | null = null;
let fallbackDuration = 0;
let frame = 0;
/** Cola de «Reproducir todos»: al terminar una voz suena la siguiente. */
let queue: { id: string; src: string; durationMs: number }[] = [];
const listeners = new Set<() => void>();
const errorListeners = new Set<(message: string) => void>();
const endListeners = new Set<(id: string) => void>();

function emit(next: Partial<PlaybackSnapshot>) {
  snap = { ...snap, ...next };
  listeners.forEach((l) => l());
}

function durationOf(el: HTMLAudioElement) {
  // Los WebM grabados en el navegador no siempre traen duración (Infinity): se usa la medida al grabar.
  return Number.isFinite(el.duration) && el.duration > 0 ? el.duration * 1000 : fallbackDuration;
}

function tick() {
  if (!audio) return;
  emit({ positionMs: audio.currentTime * 1000, durationMs: durationOf(audio) });
  if (!audio.paused) frame = requestAnimationFrame(tick);
}

function element() {
  if (audio) return audio;
  audio = new Audio();
  audio.preload = "auto";
  audio.addEventListener("playing", () => { emit({ playing: true, loading: false }); cancelAnimationFrame(frame); frame = requestAnimationFrame(tick); });
  audio.addEventListener("pause", () => { cancelAnimationFrame(frame); if (audio) emit({ playing: false, positionMs: audio.currentTime * 1000 }); });
  audio.addEventListener("ended", () => {
    cancelAnimationFrame(frame);
    const ended = snap.id;
    emit({ playing: false, positionMs: 0 });
    if (ended) endListeners.forEach((l) => l(ended));
    const next = queue.shift();
    if (next) playVoice(next.id, next.src, next.durationMs, undefined, true);
  });
  audio.addEventListener("loadedmetadata", () => { if (audio) emit({ durationMs: durationOf(audio) }); });
  audio.addEventListener("error", () => {
    cancelAnimationFrame(frame);
    emit({ playing: false, loading: false });
    errorListeners.forEach((l) => l("No se pudo reproducir este audio."));
  });
  return audio;
}

/** Reproduce (o reanuda) la voz `id`; si sonaba otra, la pausa. `startMs` permite empezar en un punto. */
export function playVoice(id: string, src: string, durationMs = 0, startMs?: number, fromQueue = false) {
  if (!fromQueue) queue = [];
  const el = element();
  if (snap.id !== id) {
    el.pause();
    fallbackDuration = durationMs;
    el.src = src;
    emit({ id, playing: false, positionMs: startMs ?? 0, durationMs, loading: true });
    if (startMs) el.currentTime = startMs / 1000;
  } else if (startMs !== undefined) {
    el.currentTime = startMs / 1000;
  }
  void el.play().catch((e: unknown) => {
    emit({ playing: false, loading: false });
    // NotAllowedError: el navegador pide un toque antes de sonar; AbortError: se cambió de audio a mitad.
    if (!(e instanceof DOMException && e.name === "AbortError")) errorListeners.forEach((l) => l("Toca de nuevo para escuchar."));
  });
}

export function pauseVoice() { audio?.pause(); }

/** Reproduce varias voces seguidas (solo las que tienen audio). Devuelve cuántas van a sonar. */
export function playVoiceQueue(items: { id: string; src?: string | undefined; durationMs: number }[]) {
  const playable = items.filter((i): i is { id: string; src: string; durationMs: number } => !!i.src);
  const first = playable[0];
  if (!first) return 0;
  playVoice(first.id, first.src, first.durationMs);
  queue = playable.slice(1);
  return playable.length;
}

/** Play/pausa de la voz `id`. */
export function toggleVoice(id: string, src: string, durationMs = 0) {
  if (snap.id === id && snap.playing) pauseVoice();
  else playVoice(id, src, durationMs);
}

/** Salta a una posición (ms) de la voz que está cargada. */
export function seekVoice(id: string, ms: number) {
  if (!audio || snap.id !== id) return;
  const max = durationOf(audio);
  audio.currentTime = Math.max(0, Math.min(max || ms, ms)) / 1000;
  emit({ positionMs: audio.currentTime * 1000 });
}

/** Para cualquier audio (al cambiar de pantalla, ciudad, Spot o al cerrar sesión). */
export function stopAllVoices() {
  queue = [];
  if (audio) { audio.pause(); audio.removeAttribute("src"); audio.load(); }
  cancelAnimationFrame(frame);
  fallbackDuration = 0;
  emit(IDLE);
}

/** Si la voz que suena es `id`, libera el audio (p. ej. al borrar esa nota o al cerrar su panel). */
export function releaseVoice(id: string) { if (snap.id === id) stopAllVoices(); }

/** Id de la voz cargada en el reproductor (o null). */
export const currentVoiceId = () => snap.id;

const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
const get = () => snap;
const getServer = () => IDLE;

/** Estado del reproductor para una voz concreta (si no es la que suena, devuelve reposo). */
export function useVoicePlayback(id: string) {
  const s = useSyncExternalStore(subscribe, get, getServer);
  const mine = s.id === id;
  return { playing: mine && s.playing, loading: mine && s.loading, positionMs: mine ? s.positionMs : 0, durationMs: mine ? s.durationMs : 0, active: mine };
}

/** Aviso cuando una voz termina de sonar (las historias pasan a la siguiente). */
export function onVoiceEnded(listener: (id: string) => void) {
  endListeners.add(listener);
  return () => { endListeners.delete(listener); };
}

/** Avisos de error del reproductor (la app los muestra como toast). */
export function onVoiceError(listener: (message: string) => void) {
  errorListeners.add(listener);
  return () => { errorListeners.delete(listener); };
}
