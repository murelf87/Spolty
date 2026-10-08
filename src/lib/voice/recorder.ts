/**
 * Grabación de voz real para toda la app: micrófono con MediaRecorder, nivel en vivo con un AnalyserNode (la onda que
 * se ve es la de tu voz), escucha previa, descarte y envío explícito.
 *
 * Protecciones: no se guarda nada por debajo de `minMs` (toques accidentales), se corta sola al llegar al máximo y
 * al desmontar la pantalla (cambiar de Spot, de ciudad o cerrar sesión) se cancela y se libera el micrófono.
 * Donde el navegador no deja usar el micrófono (p. ej. una vista previa incrustada) se puede elegir un audio del
 * dispositivo con `fromFile`, que pasa por las mismas validaciones.
 */
import { useCallback, useEffect, useRef, useState } from "react";

export type VoiceClip = { blob: Blob; url: string; durationMs: number; peaks: number[]; mimeType: string };
export type RecorderState = "idle" | "requesting" | "recording" | "recorded";
export type RecorderError = "denied" | "unsupported" | "short" | "too-long" | "invalid-file" | "failed";

export const PEAK_BARS = 56;
const SAMPLE_MS = 70;
const MAX_FILE_BYTES = 15 * 1024 * 1024;

export const formatClock = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/** Reduce (o estira) una serie de niveles a `n` barras normalizadas entre 0,08 y 1. */
export function resamplePeaks(levels: number[], n = PEAK_BARS): number[] {
  if (!levels.length) return Array.from({ length: n }, () => 0.08);
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = Math.floor((i * levels.length) / n), b = Math.max(a + 1, Math.floor(((i + 1) * levels.length) / n));
    let m = 0;
    for (let j = a; j < b && j < levels.length; j++) m = Math.max(m, levels[j] ?? 0);
    out.push(m);
  }
  const top = Math.max(...out, 0.0001);
  return out.map((v) => Math.max(0.08, Math.min(1, Math.sqrt(v / top))));
}

/** Onda estable para voces de ejemplo (sin audio): misma forma siempre para el mismo id. */
export function seededPeaks(seed: string, n = PEAK_BARS): number[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    h ^= h << 13; h ^= h >>> 17; h ^= h << 5;
    const r = ((h >>> 0) % 1000) / 1000;
    const envelope = 0.55 + 0.45 * Math.sin((i / n) * Math.PI);
    out.push(Math.max(0.12, Math.min(1, (0.25 + r * 0.75) * envelope)));
  }
  return out;
}

function pickMime() {
  if (typeof MediaRecorder === "undefined") return "";
  return ["audio/webm;codecs=opus", "audio/webm", "audio/mp4;codecs=mp4a.40.2", "audio/mp4", "audio/ogg;codecs=opus"].find((t) => {
    try { return MediaRecorder.isTypeSupported(t); } catch { return false; }
  }) ?? "";
}

export const micSupported = () => typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined";

type AudioCtxCtor = typeof AudioContext;
const audioCtx = (): AudioCtxCtor | undefined => (typeof window === "undefined" ? undefined : window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioCtxCtor }).webkitAudioContext);

/** Niveles de un archivo de audio (para la onda) y su duración real. */
async function analyseFile(blob: Blob): Promise<{ durationMs: number; levels: number[] }> {
  const Ctx = audioCtx();
  if (Ctx) {
    const ctx = new Ctx();
    try {
      const buf = await ctx.decodeAudioData(await blob.arrayBuffer());
      const data = buf.getChannelData(0), step = Math.max(1, Math.floor(data.length / 400)), levels: number[] = [];
      for (let i = 0; i < data.length; i += step) {
        let sum = 0;
        for (let j = i; j < Math.min(i + step, data.length); j++) sum += (data[j] ?? 0) ** 2;
        levels.push(Math.sqrt(sum / step));
      }
      return { durationMs: buf.duration * 1000, levels };
    } catch { /* formato que el navegador no decodifica: se mide con <audio> */ }
    finally { void ctx.close().catch(() => undefined); }
  }
  const url = URL.createObjectURL(blob);
  try {
    const durationMs = await new Promise<number>((resolve, reject) => {
      const el = new Audio();
      el.preload = "metadata";
      el.onloadedmetadata = () => resolve(Number.isFinite(el.duration) ? el.duration * 1000 : 0);
      el.onerror = () => reject(new Error("invalid"));
      el.src = url;
    });
    return { durationMs, levels: [] };
  } finally { URL.revokeObjectURL(url); }
}

export function useVoiceRecorder({ maxSeconds = 30, minMs = 800 }: { maxSeconds?: number; minMs?: number } = {}) {
  const [state, setState] = useState<RecorderState>("idle");
  const [elapsedMs, setElapsed] = useState(0);
  const [live, setLive] = useState<number[]>([]);
  const [clip, setClip] = useState<VoiceClip | null>(null);
  const [error, setError] = useState<RecorderError | null>(null);
  const r = useRef<{ stream?: MediaStream | undefined; rec?: MediaRecorder | undefined; ctx?: AudioContext | undefined; raf?: number | undefined; started: number; levels: number[]; lastSample: number; cancelled: boolean; alive: boolean; pending: boolean; clipUrl?: string | undefined }>({ started: 0, levels: [], lastSample: 0, cancelled: false, alive: true, pending: false });
  const maxMs = maxSeconds * 1000;

  const release = useCallback(() => {
    const s = r.current;
    if (s.raf) cancelAnimationFrame(s.raf);
    s.raf = undefined;
    s.stream?.getTracks().forEach((t) => t.stop());
    s.stream = undefined;
    if (s.ctx) void s.ctx.close().catch(() => undefined);
    s.ctx = undefined;
  }, []);

  const dropClip = useCallback(() => {
    const s = r.current;
    if (s.clipUrl) URL.revokeObjectURL(s.clipUrl);
    s.clipUrl = undefined;
    setClip(null);
  }, []);

  const stop = useCallback(() => {
    const s = r.current;
    if (s.rec && s.rec.state !== "inactive") s.rec.stop();
    else if (s.pending) { s.cancelled = true; s.pending = false; release(); setState("idle"); }
  }, [release]);

  const cancel = useCallback(() => {
    const s = r.current;
    s.cancelled = true;
    if (s.rec && s.rec.state !== "inactive") s.rec.stop();
    s.pending = false;
    release();
    dropClip();
    setElapsed(0); setLive([]); setState("idle");
  }, [dropClip, release]);

  const start = useCallback(async () => {
    const s = r.current;
    if (s.pending || (s.rec && s.rec.state === "recording")) return;
    setError(null);
    if (!micSupported()) { setError("unsupported"); return; }
    dropClip();
    s.cancelled = false; s.pending = true; s.levels = []; s.lastSample = 0;
    setElapsed(0); setLive([]); setState("requesting");
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    } catch (e) {
      s.pending = false;
      if (s.alive) { setState("idle"); setError(e instanceof DOMException && (e.name === "NotAllowedError" || e.name === "SecurityError") ? "denied" : "failed"); }
      return;
    }
    // Se soltó el botón, se cerró la pantalla o se canceló mientras el navegador pedía permiso: no se graba nada.
    if (!s.alive || s.cancelled || !s.pending) { stream.getTracks().forEach((t) => t.stop()); s.pending = false; return; }
    s.pending = false;
    s.stream = stream;
    const mimeType = pickMime();
    let rec: MediaRecorder;
    try { rec = mimeType ? new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 48000 }) : new MediaRecorder(stream); }
    catch { release(); setState("idle"); setError("unsupported"); return; }
    s.rec = rec;
    const chunks: BlobPart[] = [];
    rec.ondataavailable = (ev) => { if (ev.data.size) chunks.push(ev.data); };
    rec.onstop = () => {
      const durationMs = Math.min(maxMs, performance.now() - s.started);
      release();
      s.rec = undefined;
      if (!s.alive) return;
      if (s.cancelled) { setState("idle"); return; }
      if (durationMs < minMs || !chunks.length) { setError("short"); setElapsed(0); setLive([]); setState("idle"); return; }
      const type = rec.mimeType || mimeType || "audio/webm";
      const blob = new Blob(chunks, { type });
      const url = URL.createObjectURL(blob);
      s.clipUrl = url;
      setClip({ blob, url, durationMs, peaks: resamplePeaks(s.levels), mimeType: type });
      setElapsed(durationMs);
      setState("recorded");
    };
    // Nivel de la voz en directo para la onda.
    const Ctx = audioCtx();
    let analyser: AnalyserNode | null = null, data: Float32Array<ArrayBuffer> | null = null;
    if (Ctx) {
      try {
        const ctx = new Ctx();
        s.ctx = ctx;
        const src = ctx.createMediaStreamSource(stream);
        analyser = ctx.createAnalyser();
        analyser.fftSize = 1024;
        src.connect(analyser);
        data = new Float32Array(new ArrayBuffer(analyser.fftSize * 4));
        void ctx.resume().catch(() => undefined);
      } catch { analyser = null; }
    }
    s.started = performance.now();
    rec.start(250);
    setState("recording");
    const loop = () => {
      const now = performance.now(), t = now - s.started;
      if (now - s.lastSample >= SAMPLE_MS) {
        s.lastSample = now;
        let level = 0;
        if (analyser && data) {
          analyser.getFloatTimeDomainData(data);
          let sum = 0;
          for (let i = 0; i < data.length; i++) sum += (data[i] ?? 0) ** 2;
          level = Math.sqrt(sum / data.length);
        }
        s.levels.push(level);
        setLive(s.levels.slice(-PEAK_BARS));
        setElapsed(t);
      }
      if (t >= maxMs) { stop(); return; }
      s.raf = requestAnimationFrame(loop);
    };
    s.raf = requestAnimationFrame(loop);
  }, [dropClip, maxMs, minMs, release, stop]);

  /** Usa un audio del dispositivo en lugar del micrófono (mismas reglas de duración). */
  const fromFile = useCallback(async (file: File) => {
    setError(null);
    if (!file.type.startsWith("audio/") || file.size > MAX_FILE_BYTES) { setError("invalid-file"); return; }
    try {
      const { durationMs, levels } = await analyseFile(file);
      if (!r.current.alive) return;
      if (durationMs > maxMs + 1000) { setError("too-long"); return; }
      if (durationMs > 0 && durationMs < minMs) { setError("short"); return; }
      dropClip();
      const url = URL.createObjectURL(file);
      r.current.clipUrl = url;
      setClip({ blob: file, url, durationMs: durationMs || 1000, peaks: resamplePeaks(levels), mimeType: file.type });
      setElapsed(durationMs);
      setState("recorded");
    } catch { setError("invalid-file"); }
  }, [dropClip, maxMs, minMs]);

  /** Tira lo grabado y vuelve al principio. */
  const discard = useCallback(() => { dropClip(); setElapsed(0); setLive([]); setError(null); setState("idle"); }, [dropClip]);

  /** Entrega lo grabado y se olvida de él (quien lo recibe se encarga de liberar la URL). */
  const take = useCallback((): VoiceClip | null => {
    const c = clip;
    r.current.clipUrl = undefined;
    setClip(null); setElapsed(0); setLive([]); setState("idle");
    return c;
  }, [clip]);

  useEffect(() => {
    const s = r.current;
    s.alive = true;
    return () => {
      s.alive = false; s.cancelled = true;
      if (s.rec && s.rec.state !== "inactive") s.rec.stop();
      release();
      if (s.clipUrl) URL.revokeObjectURL(s.clipUrl);
    };
  }, [release]);

  return { state, elapsedMs, live, clip, error, maxMs, start, stop, cancel, discard, take, fromFile, supported: micSupported() };
}

/** Mensaje claro para cada error de grabación. */
export function recorderErrorText(e: RecorderError, maxSeconds: number) {
  return {
    denied: "Spotly necesita el micrófono para grabar tu voz. Actívalo en los permisos del navegador o del móvil.",
    unsupported: "Este navegador no permite grabar audio. Elige un audio de tu dispositivo.",
    short: "Mantén la grabación al menos un segundo.",
    "too-long": `El audio dura más de ${maxSeconds} s.`,
    "invalid-file": "Elige un archivo de audio (hasta 15 MB).",
    failed: "No se pudo abrir el micrófono. Inténtalo de nuevo.",
  }[e];
}
