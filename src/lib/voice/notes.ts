/**
 * Notas de voz y conversaciones encadenadas.
 *
 * Cada voz pertenece a un hilo (`threadId`: el Spot, la foto, el chat o el grupo donde se dijo) y puede responder a
 * otra (`parentId`), anclada al segundo del audio original en el que se respondió (`replyAtMs`). Así una conversación
 * se reconstruye siempre igual: «En respuesta a este audio».
 *
 * Mientras no hay backend social, tus voces se guardan en este dispositivo (IndexedDB, con el audio) y sobreviven a
 * cerrar la app; las voces de ejemplo vienen marcadas `sample` y no tienen audio. La interfaz de este módulo es la
 * misma que tendrá la versión en la nube (docs/BACKEND_CONTRACT.md → voice_notes).
 */
import { useEffect, useMemo, useSyncExternalStore } from "react";
import type { VoiceClip } from "./recorder";
import { releaseVoice } from "./player";

export type VoiceAuthor = { name: string; avatar?: string | null | undefined; anon?: boolean | undefined; mine?: boolean | undefined; verified?: boolean | undefined };
export type VoiceNote = {
  id: string;
  threadId: string;
  parentId: string | null;
  /** Punto del audio original (ms) en el que se respondió. */
  replyAtMs?: number | undefined;
  author: VoiceAuthor;
  createdAt: number;
  durationMs: number;
  peaks: number[];
  /** URL reproducible (tus voces); las de ejemplo no tienen audio. */
  src?: string | undefined;
  likes: number;
  sample?: boolean | undefined;
};

type Stored = Omit<VoiceNote, "src"> & { blob: Blob; mimeType: string };

const DB_NAME = "spotly-voz", STORE = "notas", LIKES_KEY = "spotly-voz-likes";
let mine: VoiceNote[] = [];
let liked = new Set<string>();
let loaded = false;
let version = 0;
const listeners = new Set<() => void>();
const emit = () => { version++; listeners.forEach((l) => l()); };

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      if (typeof indexedDB === "undefined") return resolve(null);
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => { const os = req.result.createObjectStore(STORE, { keyPath: "id" }); os.createIndex("thread", "threadId"); };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch { resolve(null); }
  });
}

async function persist(rec: Stored) {
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try { const tx = db.transaction(STORE, "readwrite"); tx.objectStore(STORE).put(rec); tx.oncomplete = () => resolve(); tx.onerror = () => resolve(); tx.onabort = () => resolve(); }
    catch { resolve(); }
  });
  db.close();
}

async function unpersist(id: string) {
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try { const tx = db.transaction(STORE, "readwrite"); tx.objectStore(STORE).delete(id); tx.oncomplete = () => resolve(); tx.onerror = () => resolve(); }
    catch { resolve(); }
  });
  db.close();
}

/** Carga tus voces guardadas en el dispositivo (una vez por sesión). */
export async function loadVoiceNotes() {
  if (loaded) return;
  loaded = true;
  try { liked = new Set(JSON.parse(localStorage.getItem(LIKES_KEY) ?? "[]") as string[]); } catch { liked = new Set(); }
  const db = await openDb();
  if (!db) { emit(); return; }
  const rows = await new Promise<Stored[]>((resolve) => {
    try { const req = db.transaction(STORE, "readonly").objectStore(STORE).getAll(); req.onsuccess = () => resolve((req.result ?? []) as Stored[]); req.onerror = () => resolve([]); }
    catch { resolve([]); }
  });
  db.close();
  const known = new Set(mine.map((n) => n.id));
  mine = [...mine, ...rows.filter((r) => !known.has(r.id)).map(({ blob, mimeType: _m, ...rest }) => ({ ...rest, src: URL.createObjectURL(blob) }))];
  emit();
}

let seq = 0;
const newId = () => `voz-${Date.now().toString(36)}-${(seq++).toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

/** Publica una voz tuya en un hilo (como respuesta si lleva `parentId`). Devuelve la nota creada. */
export function addVoiceNote({ threadId, parentId = null, replyAtMs, clip, anon = false }: { threadId: string; parentId?: string | null; replyAtMs?: number | undefined; clip: VoiceClip; anon?: boolean }): VoiceNote {
  const note: VoiceNote = { id: newId(), threadId, parentId, replyAtMs, author: { name: "", mine: true, anon }, createdAt: Date.now(), durationMs: Math.round(clip.durationMs), peaks: clip.peaks, src: clip.url, likes: 0 };
  mine = [...mine, note];
  emit();
  const { src: _s, ...rest } = note;
  void persist({ ...rest, blob: clip.blob, mimeType: clip.mimeType });
  return note;
}

/** Borra una voz tuya (y su audio del dispositivo). */
export function removeVoiceNote(id: string) {
  const n = mine.find((x) => x.id === id);
  if (!n) return;
  releaseVoice(id);
  mine = mine.filter((x) => x.id !== id);
  if (n.src) URL.revokeObjectURL(n.src);
  emit();
  void unpersist(id);
}

export function toggleVoiceLike(id: string) {
  if (liked.has(id)) liked.delete(id); else liked.add(id);
  try { localStorage.setItem(LIKES_KEY, JSON.stringify([...liked])); } catch { /* sin almacenamiento: dura la sesión */ }
  emit();
}

const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
const getVersion = () => version;

/** Voces de un hilo: las de ejemplo (`seed`) más las tuyas, con me gusta y número de respuestas. */
export function useThread(threadId: string, seed: VoiceNote[] = []) {
  const v = useSyncExternalStore(subscribe, getVersion, getVersion);
  useEffect(() => { void loadVoiceNotes(); }, []);
  return useMemo(() => {
    const all = [...seed, ...mine.filter((n) => n.threadId === threadId)];
    const replies = new Map<string, number>();
    for (const n of all) if (n.parentId) replies.set(n.parentId, (replies.get(n.parentId) ?? 0) + 1);
    return all.map((n) => ({ ...n, liked: liked.has(n.id), likes: n.likes + (liked.has(n.id) ? 1 : 0), replies: replies.get(n.id) ?? 0 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId, seed, v]);
}
export type ThreadNote = ReturnType<typeof useThread>[number];

/** Todas tus voces (para el perfil). */
export function useMyVoiceNotes() {
  const v = useSyncExternalStore(subscribe, getVersion, getVersion);
  useEffect(() => { void loadVoiceNotes(); }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => [...mine].sort((a, b) => b.createdAt - a.createdAt), [v]);
}

/** Convierte "0:14" o "1:05" en milisegundos. */
export const clockToMs = (t: string) => { const [m, s] = t.split(":").map((x) => Number(x) || 0); return ((m ?? 0) * 60 + (s ?? 0)) * 1000; };
