/**
 * Tus Spots publicados: título (lo único escrito), voz grabada, foto o vídeo opcional y ajustes de publicación.
 *
 * Hasta que el backend social esté activo se guardan en este dispositivo (IndexedDB, con el audio y la imagen), así
 * siguen en Inicio y en tu perfil al volver a abrir la app. Las vistas solo cuentan reproducciones de otras personas:
 * en este modo local valen 0 hasta que el Spot se publique en la nube (docs/BACKEND_CONTRACT.md → spots).
 */
import { useEffect, useMemo, useSyncExternalStore } from "react";
import type { VoiceClip } from "./voice/recorder";
import { releaseVoice } from "./voice/player";

export type SpotMedia = { kind: "photo" | "video"; src: string; mimeType: string };
export type MySpot = {
  id: string;
  title: string;
  city: string;
  zone: string;
  topic: string;
  visibility: string;
  precision: string;
  anon: boolean;
  boosted: boolean;
  happeningNow: boolean;
  repliesAllowed: boolean;
  createdAt: number;
  media?: SpotMedia | undefined;
  audio: { src: string; durationMs: number; peaks: number[] };
  views: number;
};
type Stored = Omit<MySpot, "media" | "audio"> & { audioBlob: Blob; audioMime: string; durationMs: number; peaks: number[]; mediaBlob?: Blob | undefined; mediaKind?: "photo" | "video" | undefined; mediaMime?: string | undefined };

const DB = "spotly-spots", STORE = "spots";
let spots: MySpot[] = [];
let loaded = false;
let version = 0;
const listeners = new Set<() => void>();
const emit = () => { version++; listeners.forEach((l) => l()); };

function open(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      if (typeof indexedDB === "undefined") return resolve(null);
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => { req.result.createObjectStore(STORE, { keyPath: "id" }); };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch { resolve(null); }
  });
}
async function tx(mode: IDBTransactionMode, run: (os: IDBObjectStore) => void) {
  const db = await open();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try { const t = db.transaction(STORE, mode); run(t.objectStore(STORE)); t.oncomplete = () => resolve(); t.onerror = () => resolve(); t.onabort = () => resolve(); }
    catch { resolve(); }
  });
  db.close();
}

export async function loadMySpots() {
  if (loaded) return;
  loaded = true;
  const db = await open();
  if (!db) { emit(); return; }
  const rows = await new Promise<Stored[]>((resolve) => {
    try { const req = db.transaction(STORE, "readonly").objectStore(STORE).getAll(); req.onsuccess = () => resolve((req.result ?? []) as Stored[]); req.onerror = () => resolve([]); }
    catch { resolve([]); }
  });
  db.close();
  const known = new Set(spots.map((s) => s.id));
  const restored = rows.filter((r) => !known.has(r.id)).map(({ audioBlob, audioMime: _a, durationMs, peaks, mediaBlob, mediaKind, mediaMime, ...rest }): MySpot => ({
    ...rest,
    audio: { src: URL.createObjectURL(audioBlob), durationMs, peaks },
    media: mediaBlob && mediaKind ? { kind: mediaKind, src: URL.createObjectURL(mediaBlob), mimeType: mediaMime ?? mediaBlob.type } : undefined,
  }));
  spots = [...spots, ...restored].sort((a, b) => b.createdAt - a.createdAt);
  emit();
}

export type NewSpot = Omit<MySpot, "id" | "createdAt" | "media" | "audio" | "views"> & { clip: VoiceClip; mediaFile?: Blob | undefined; mediaKind?: "photo" | "video" | undefined };

/** Publica un Spot tuyo (se guarda con su audio y su imagen en el dispositivo). */
export function publishSpot({ clip, mediaFile, mediaKind, ...info }: NewSpot): MySpot {
  const id = `spot-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const spot: MySpot = {
    ...info, id, createdAt: Date.now(), views: 0,
    audio: { src: clip.url, durationMs: Math.round(clip.durationMs), peaks: clip.peaks },
    media: mediaFile && mediaKind ? { kind: mediaKind, src: URL.createObjectURL(mediaFile), mimeType: mediaFile.type } : undefined,
  };
  spots = [spot, ...spots];
  emit();
  const { media: _m, audio: _au, ...rest } = spot;
  void tx("readwrite", (os) => os.put({ ...rest, audioBlob: clip.blob, audioMime: clip.mimeType, durationMs: spot.audio.durationMs, peaks: spot.audio.peaks, mediaBlob: mediaFile, mediaKind, mediaMime: mediaFile?.type } satisfies Stored));
  return spot;
}

/** Elimina un Spot tuyo (y su audio e imagen del dispositivo). */
export function deleteSpot(id: string) {
  const s = spots.find((x) => x.id === id);
  if (!s) return;
  releaseVoice(`spot-audio:${id}`);
  spots = spots.filter((x) => x.id !== id);
  URL.revokeObjectURL(s.audio.src);
  if (s.media) URL.revokeObjectURL(s.media.src);
  emit();
  void tx("readwrite", (os) => os.delete(id));
}

const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
const getVersion = () => version;

export function useMySpots() {
  const v = useSyncExternalStore(subscribe, getVersion, getVersion);
  useEffect(() => { void loadMySpots(); }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => [...spots], [v]);
}
