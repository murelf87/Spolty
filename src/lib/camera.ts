/**
 * Cámara real para Crear Spot: vista previa en vivo, foto (fotograma a JPEG), vídeo corto con MediaRecorder,
 * cámara frontal/trasera, linterna y zoom cuando el dispositivo los ofrece. Se apaga al salir de la pantalla.
 * Si el navegador no deja usar la cámara (permiso denegado, sin cámara o vista previa incrustada), devuelve el
 * estado para que la pantalla ofrezca la galería o publicar solo con voz.
 */
import { useCallback, useEffect, useRef, useState } from "react";

export type CameraState = "idle" | "starting" | "live" | "denied" | "unsupported" | "error";
type Caps = { torch: boolean; zoom: { min: number; max: number } | null };
type TrackCaps = MediaTrackCapabilities & { torch?: boolean; zoom?: { min: number; max: number } };

export const VIDEO_MAX_MS = 15_000;

function pickVideoMime() {
  if (typeof MediaRecorder === "undefined") return "";
  return ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm", "video/mp4"].find((t) => { try { return MediaRecorder.isTypeSupported(t); } catch { return false; } }) ?? "";
}

export function useCamera(active: boolean, facing: "user" | "environment") {
  const video = useRef<HTMLVideoElement | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const rec = useRef<MediaRecorder | null>(null);
  const [state, setState] = useState<CameraState>("idle");
  const [caps, setCaps] = useState<Caps>({ torch: false, zoom: null });
  const [recording, setRecording] = useState(false);
  const [recMs, setRecMs] = useState(0);

  const stop = useCallback(() => {
    if (rec.current && rec.current.state !== "inactive") rec.current.stop();
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    if (video.current) video.current.srcObject = null;
  }, []);

  useEffect(() => {
    if (!active) { stop(); setState("idle"); return; }
    let cancelled = false;
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) { setState("unsupported"); return; }
      setState("starting");
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, width: { ideal: 1080 }, height: { ideal: 1920 } }, audio: false });
        if (cancelled) { s.getTracks().forEach((t) => t.stop()); return; }
        stream.current = s;
        if (video.current) { video.current.srcObject = s; await video.current.play().catch(() => undefined); }
        const track = s.getVideoTracks()[0];
        const c = (track?.getCapabilities?.() ?? {}) as TrackCaps;
        setCaps({ torch: !!c.torch, zoom: c.zoom && c.zoom.max > c.zoom.min ? { min: c.zoom.min, max: c.zoom.max } : null });
        setState("live");
      } catch (e) {
        if (cancelled) return;
        setState(e instanceof DOMException && (e.name === "NotAllowedError" || e.name === "SecurityError") ? "denied" : e instanceof DOMException && e.name === "NotFoundError" ? "unsupported" : "error");
      }
    })();
    return () => { cancelled = true; stop(); };
  }, [active, facing, stop]);

  /** Foto del fotograma actual (espejada como se ve si es la cámara frontal). */
  const takePhoto = useCallback(async (): Promise<Blob | null> => {
    const v = video.current;
    if (!v || !v.videoWidth) return null;
    const c = document.createElement("canvas");
    c.width = v.videoWidth; c.height = v.videoHeight;
    const ctx = c.getContext("2d");
    if (!ctx) return null;
    if (facing === "user") { ctx.translate(c.width, 0); ctx.scale(-1, 1); }
    ctx.drawImage(v, 0, 0);
    return new Promise((resolve) => c.toBlob((b) => resolve(b), "image/jpeg", 0.9));
  }, [facing]);

  /** Graba un vídeo corto (máx. 15 s); `onDone` recibe el archivo al parar. */
  const startVideo = useCallback((onDone: (b: Blob) => void) => {
    const s = stream.current;
    if (!s || typeof MediaRecorder === "undefined") return false;
    const type = pickVideoMime();
    let r: MediaRecorder;
    try { r = type ? new MediaRecorder(s, { mimeType: type }) : new MediaRecorder(s); } catch { return false; }
    const chunks: BlobPart[] = [];
    const started = performance.now();
    const timer = window.setInterval(() => { const t = performance.now() - started; setRecMs(t); if (t >= VIDEO_MAX_MS && r.state !== "inactive") r.stop(); }, 200);
    r.ondataavailable = (ev) => { if (ev.data.size) chunks.push(ev.data); };
    r.onstop = () => { window.clearInterval(timer); setRecording(false); setRecMs(0); rec.current = null; if (chunks.length) onDone(new Blob(chunks, { type: r.mimeType || type || "video/webm" })); };
    rec.current = r;
    r.start(250);
    setRecording(true);
    return true;
  }, []);
  const stopVideo = useCallback(() => { if (rec.current && rec.current.state !== "inactive") rec.current.stop(); }, []);

  const setTorch = useCallback(async (on: boolean) => {
    const track = stream.current?.getVideoTracks()[0];
    try { await track?.applyConstraints({ advanced: [{ torch: on } as MediaTrackConstraintSet] }); return true; } catch { return false; }
  }, []);
  const setZoom = useCallback(async (z: number) => {
    const track = stream.current?.getVideoTracks()[0];
    try { await track?.applyConstraints({ advanced: [{ zoom: z } as MediaTrackConstraintSet] }); return true; } catch { return false; }
  }, []);

  return { video, state, caps, recording, recMs, takePhoto, startVideo, stopVideo, setTorch, setZoom };
}
