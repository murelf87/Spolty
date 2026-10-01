/**
 * Prueba de vida en el dispositivo (selfie en tiempo real).
 *
 * Usa la cámara frontal y un detector facial ligero (tiny face detector + 68 puntos, ~270 KB)
 * que se ejecuta en local: el vídeo NO sale del dispositivo. Mide:
 *  - presencia de UNA cara, bien encuadrada y de tamaño suficiente
 *  - giro de cabeza (yaw) a partir de la posición de la nariz entre los extremos de la mandíbula
 *  - parpadeo, con la relación de aspecto del ojo (EAR) frente a su línea base
 *
 * Es un primer filtro anti-bots. La prueba de vida definitiva (anti-deepfake, pantalla o foto impresa)
 * debe hacerla un proveedor KYC en servidor: POST /v1/identity/sessions (ver docs/BACKEND_CONTRACT.md).
 */
import tinyManifest from "@/assets/models/tiny_face_detector_model-weights_manifest.json";
import tinyBin from "@/assets/models/tiny_face_detector_model.bin?url";
import lmManifest from "@/assets/models/face_landmark_68_tiny_model-weights_manifest.json";
import lmBin from "@/assets/models/face_landmark_68_tiny_model.bin?url";

type FaceApi = typeof import("@vladmandic/face-api");
let api: FaceApi | null = null;
let loading: Promise<FaceApi> | null = null;

type Manifest = { weights: unknown[] }[];

/** Carga (una sola vez) el motor y los modelos. Lanza si falla. */
export function loadLiveness(): Promise<FaceApi> {
  if (api) return Promise.resolve(api);
  if (loading) return loading;
  loading = (async () => {
    const faceapi = await import("@vladmandic/face-api");
    const tf = faceapi.tf as unknown as { setBackend(n: string): Promise<boolean>; ready(): Promise<void>; io: { decodeWeights(b: ArrayBuffer, specs: never): never } };
    try { await tf.setBackend("webgl"); } catch { await tf.setBackend("cpu"); }
    await tf.ready();
    const weights = async (manifest: Manifest, url: string) => {
      const buf = await (await fetch(url)).arrayBuffer();
      return tf.io.decodeWeights(buf, manifest[0]!.weights as never);
    };
    faceapi.nets.tinyFaceDetector.loadFromWeightMap(await weights(tinyManifest as unknown as Manifest, tinyBin));
    faceapi.nets.faceLandmark68TinyNet.loadFromWeightMap(await weights(lmManifest as unknown as Manifest, lmBin));
    api = faceapi;
    return faceapi;
  })().catch((e) => { loading = null; throw e; });
  return loading;
}

export type Reading =
  | { kind: "none" }
  | { kind: "many" }
  | { kind: "face"; /** 0..1 del ancho del vídeo */ size: number; /** centro normalizado -1..1 */ cx: number; cy: number; /** ~0.5 de frente; <0.5 = giro a SU derecha */ yaw: number; ear: number };

const d = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
const eye = (p: { x: number; y: number }[]) => (d(p[1]!, p[5]!) + d(p[2]!, p[4]!)) / (2 * d(p[0]!, p[3]!));

export async function readFace(video: HTMLVideoElement): Promise<Reading> {
  const faceapi = await loadLiveness();
  const opts = new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.45 });
  const all = await faceapi.detectAllFaces(video, opts).withFaceLandmarks(true);
  if (all.length === 0) return { kind: "none" };
  if (all.length > 1) return { kind: "many" };
  const f = all[0]!;
  const pts = f.landmarks.positions;
  const jaw = pts.slice(0, 17);
  const left = jaw[0]!, right = jaw[16]!, nose = pts[30]!;
  const span = Math.max(1, right.x - left.x);
  const yaw = (nose.x - left.x) / span;
  const ear = (eye(pts.slice(36, 42)) + eye(pts.slice(42, 48))) / 2;
  const box = f.detection.box;
  const w = video.videoWidth || 1, h = video.videoHeight || 1;
  return { kind: "face", size: box.width / w, cx: ((box.x + box.width / 2) / w) * 2 - 1, cy: ((box.y + box.height / 2) / h) * 2 - 1, yaw, ear };
}

/** Captura el fotograma actual (espejado como lo ve la persona) como URL de objeto local. */
export function grabFrame(video: HTMLVideoElement, mirror = true): Promise<string | null> {
  const w = video.videoWidth, h = video.videoHeight;
  if (!w || !h) return Promise.resolve(null);
  const c = document.createElement("canvas");
  const s = Math.min(1, 480 / Math.max(w, h));
  c.width = Math.round(w * s); c.height = Math.round(h * s);
  const ctx = c.getContext("2d");
  if (!ctx) return Promise.resolve(null);
  if (mirror) { ctx.translate(c.width, 0); ctx.scale(-1, 1); }
  ctx.drawImage(video, 0, 0, c.width, c.height);
  return new Promise((res) => c.toBlob((b) => res(b ? URL.createObjectURL(b) : null), "image/jpeg", 0.85));
}

/** Umbrales (ajustables). */
export const LIVE = { minSize: 0.22, maxOffset: 0.45, frontal: [0.4, 0.6] as const, turn: 0.34, blinkDrop: 0.78, blinkRecover: 0.9, hold: 3, stepTimeoutMs: 20000 };
