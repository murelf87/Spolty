/**
 * Notas de voz y conversaciones encadenadas.
 *
 * Cada voz pertenece a un hilo (`threadId`: el Spot, la foto, el chat o el grupo donde se dijo) y puede responder a
 * otra (`parentId`), anclada al segundo del audio original en el que se respondió (`replyAtMs`). Así una conversación
 * se reconstruye siempre igual: «En respuesta a este audio».
 *
 * Con sesión y la nube lista (lib/cloud) los hilos se guardan en el servidor y se comparten entre iPhone, Android y
 * web: se piden al abrirlos, se actualizan en tiempo real y lo que envías aparece al momento («Enviando…») hasta que
 * el servidor lo confirma; si falla, se puede reintentar sin volver a grabar. Sin nube (o en el modo demostración)
 * tus voces se guardan en este dispositivo (IndexedDB, con el audio) y sobreviven a cerrar la app. Las voces de
 * ejemplo vienen marcadas `sample` y no tienen audio.
 */
import { useEffect, useMemo, useSyncExternalStore } from "react";
import { toast } from "sonner";
import type { VoiceClip } from "./recorder";
import { releaseVoice } from "./player";
import { api, cloudErrorText, cloudOn, cloudUid, db, fileUrl, useCloud, watchThread } from "../cloud";

export type VoiceAuthor = { id?: string | null | undefined; name: string; avatar?: string | null | undefined; anon?: boolean | undefined; mine?: boolean | undefined; verified?: boolean | undefined };
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
  /** URL reproducible; las de ejemplo no tienen audio. */
  src?: string | undefined;
  likes: number;
  sample?: boolean | undefined;
  /** Nube: se está enviando (aún no confirmada) o no se pudo enviar (se puede reintentar). */
  pending?: boolean | undefined;
  failed?: boolean | undefined;
  /** Nube: ruta del audio en el almacenamiento («cubo/ruta»). */
  audioPath?: string | undefined;
  /** Nube: me gusta tuyo según el servidor. */
  serverLiked?: boolean | undefined;
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
const newId = (prefix = "voz") => `${prefix}-${Date.now().toString(36)}-${(seq++).toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

/* ───────────── Hilos en la nube ───────────── */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** ¿Este hilo se guarda en la nube? Spots, chats, muros, presentaciones y soporte necesitan su id real. */
export function isCloudThread(threadId: string) {
  const i = threadId.indexOf(":");
  if (i < 1) return false;
  const kind = threadId.slice(0, i), rest = threadId.slice(i + 1);
  if (!rest || rest.length > 120) return false;
  if (kind === "spot" || kind === "chat" || kind === "muro" || kind === "presentacion" || kind === "soporte") return UUID.test(rest);
  return kind === "photo" || kind === "hot" || kind === "group" || kind === "event";
}
/** Hilos tuyos: con la nube van con tu id; sin ella, con el nombre antiguo de este dispositivo. */
export const myThreadId = (kind: "presentacion" | "muro" | "soporte", local: string) => { const uid = cloudUid(); return uid ? `${kind}:${uid}` : local; };
export function useMyThreadId(kind: "presentacion" | "muro" | "soporte", local: string) { const c = useCloud(); return c.on && c.uid ? `${kind}:${c.uid}` : local; }

type CloudThread = { notes: VoiceNote[]; status: "loading" | "ready" | "error"; refs: number; stop?: (() => void) | undefined; fetchSeq: number };
const threads = new Map<string, CloudThread>();
const pending = new Map<string, VoiceNote[]>(); // hilo → voces que se están enviando o fallaron
const retryData = new Map<string, { clip: VoiceClip; threadId: string; parentId: string | null; replyAtMs?: number | undefined; anon: boolean }>();
const ownSrc = new Map<string, string>(); // id en la nube → URL local de tu grabación (no hace falta descargarla)
const likeOverride = new Map<string, boolean>();
const signed = new Map<string, { url: string; until: number }>();

async function chatUrls(rows: api.NoteRow[]) {
  const now = Date.now();
  const need = rows.filter((r) => r.audio_path.startsWith("chats/") && !ownSrc.has(r.id) && (signed.get(r.audio_path)?.until ?? 0) < now + 5 * 60000).map((r) => r.audio_path);
  if (need.length) {
    const urls = await api.signMany(db(), need, 3600).catch(() => new Map<string, string>());
    for (const [p, u] of urls) signed.set(p, { url: u, until: now + 3600000 });
  }
}
const noteFromRow = (r: api.NoteRow): VoiceNote => ({
  id: r.id, threadId: r.thread_id, parentId: r.parent_id, replyAtMs: r.reply_at_ms ?? undefined, createdAt: Date.parse(r.created_at), durationMs: r.duration_ms, peaks: r.peaks ?? [],
  author: { id: r.author_id, name: r.author_name || (r.author_username ? `@${r.author_username}` : r.anon ? "Anónimo" : "Spotly"), avatar: fileUrl(r.author_avatar), anon: r.anon, mine: r.mine },
  src: ownSrc.get(r.id) ?? (r.audio_path.startsWith("chats/") ? signed.get(r.audio_path)?.url : fileUrl(r.audio_path) ?? undefined),
  likes: r.likes, serverLiked: r.liked, audioPath: r.audio_path,
});

async function fetchThread(threadId: string) {
  const t = threads.get(threadId) ?? { notes: [], status: "loading" as const, refs: 0, fetchSeq: 0 };
  threads.set(threadId, t);
  const mySeq = ++t.fetchSeq;
  try {
    const rows = await api.fetchThread(db(), threadId);
    await chatUrls(rows);
    if (t.fetchSeq !== mySeq) return;
    t.notes = rows.map(noteFromRow);
    t.status = "ready";
    for (const n of t.notes) if (likeOverride.get(n.id) === n.serverLiked) likeOverride.delete(n.id);
  } catch {
    if (t.fetchSeq === mySeq) t.status = t.notes.length ? "ready" : "error";
  }
  emit();
}
/** Mantiene un hilo de la nube al día mientras haya alguien mirándolo. */
function retain(threadId: string) {
  const t = threads.get(threadId) ?? { notes: [], status: "loading" as const, refs: 0, fetchSeq: 0 };
  threads.set(threadId, t);
  t.refs++;
  if (t.refs === 1) {
    void fetchThread(threadId);
    t.stop = watchThread(threadId, () => void fetchThread(threadId));
  }
  return () => { t.refs--; if (t.refs <= 0) { t.refs = 0; t.stop?.(); t.stop = undefined; } };
}
const cloudNote = (id: string) => { for (const t of threads.values()) { const n = t.notes.find((x) => x.id === id); if (n) return { t, n }; } return null; };
const pendingNote = (id: string) => { for (const [threadId, list] of pending) { const n = list.find((x) => x.id === id); if (n) return { threadId, n }; } return null; };
const setPending = (threadId: string, list: VoiceNote[]) => { if (list.length) pending.set(threadId, list); else pending.delete(threadId); emit(); };

async function sendToCloud(tmpId: string) {
  const req = retryData.get(tmpId), uid = cloudUid();
  if (!req) return;
  const list = pending.get(req.threadId) ?? [];
  setPending(req.threadId, list.map((n) => (n.id === tmpId ? { ...n, pending: true, failed: false } : n)));
  if (!uid) { markFailed(req.threadId, tmpId); return; }
  try {
    const { id } = await api.postNote(db(), uid, { threadId: req.threadId, parentId: req.parentId, replyAtMs: req.replyAtMs, blob: req.clip.blob, mime: req.clip.mimeType, durationMs: req.clip.durationMs, peaks: req.clip.peaks, anon: req.anon });
    ownSrc.set(id, req.clip.url);
    retryData.delete(tmpId);
    await fetchThread(req.threadId);
    setPending(req.threadId, (pending.get(req.threadId) ?? []).filter((n) => n.id !== tmpId));
  } catch (e) {
    markFailed(req.threadId, tmpId);
    toast.error(cloudErrorText(e));
  }
}
const markFailed = (threadId: string, id: string) => setPending(threadId, (pending.get(threadId) ?? []).map((n) => (n.id === id ? { ...n, pending: false, failed: true } : n)));
/** Vuelve a enviar una voz que no salió (sin grabarla otra vez). */
export const retryVoiceNote = (id: string) => void sendToCloud(id);

/** Publica una voz tuya en un hilo (como respuesta si lleva `parentId`). Devuelve la nota creada. */
export function addVoiceNote({ threadId, parentId = null, replyAtMs, clip, anon = false }: { threadId: string; parentId?: string | null; replyAtMs?: number | undefined; clip: VoiceClip; anon?: boolean }): VoiceNote {
  const cloud = cloudOn() && isCloudThread(threadId);
  const note: VoiceNote = { id: newId(cloud ? "enviando" : "voz"), threadId, parentId, replyAtMs, author: { name: "", mine: true, anon }, createdAt: Date.now(), durationMs: Math.round(clip.durationMs), peaks: clip.peaks, src: clip.url, likes: 0, pending: cloud || undefined };
  if (cloud) {
    retryData.set(note.id, { clip, threadId, parentId, replyAtMs, anon });
    setPending(threadId, [...(pending.get(threadId) ?? []), note]);
    void sendToCloud(note.id);
    return note;
  }
  mine = [...mine, note];
  emit();
  const { src: _s, pending: _p, ...rest } = note;
  void persist({ ...rest, blob: clip.blob, mimeType: clip.mimeType });
  return note;
}

/** Borra una voz tuya (o, en tu muro, una que te dejaron). */
export function removeVoiceNote(id: string) {
  releaseVoice(id);
  const p = pendingNote(id);
  if (p) { retryData.delete(id); if (p.n.src) URL.revokeObjectURL(p.n.src); setPending(p.threadId, (pending.get(p.threadId) ?? []).filter((n) => n.id !== id)); return; }
  const c = cloudNote(id);
  if (c) {
    c.t.notes = c.t.notes.filter((n) => n.id !== id);
    emit();
    void api.deleteNote(db(), id, c.n.author.mine ? c.n.audioPath : undefined).catch((e) => { toast.error(cloudErrorText(e)); void fetchThread(c.n.threadId); });
    return;
  }
  const n = mine.find((x) => x.id === id);
  if (!n) return;
  mine = mine.filter((x) => x.id !== id);
  if (n.src) URL.revokeObjectURL(n.src);
  emit();
  void unpersist(id);
}

export function toggleVoiceLike(id: string) {
  const c = cloudNote(id), uid = cloudUid();
  if (c && uid) {
    const now = !(likeOverride.get(id) ?? c.n.serverLiked ?? false);
    likeOverride.set(id, now);
    emit();
    void api.setNoteLike(db(), uid, id, now).catch((e) => { likeOverride.delete(id); emit(); toast.error(cloudErrorText(e)); });
    return;
  }
  if (liked.has(id)) liked.delete(id); else liked.add(id);
  try { localStorage.setItem(LIKES_KEY, JSON.stringify([...liked])); } catch { /* sin almacenamiento: dura la sesión */ }
  emit();
}

const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
const getVersion = () => version;

/** Voces de un hilo: las de ejemplo (`seed`) más las reales, con me gusta y número de respuestas. */
export function useThread(threadId: string, seed: VoiceNote[] = []) {
  const v = useSyncExternalStore(subscribe, getVersion, getVersion);
  const { on } = useCloud();
  const cloud = on && isCloudThread(threadId);
  useEffect(() => { void loadVoiceNotes(); }, []);
  useEffect(() => (cloud ? retain(threadId) : undefined), [cloud, threadId]);
  return useMemo(() => {
    const real = cloud ? [...(threads.get(threadId)?.notes ?? []), ...(pending.get(threadId) ?? [])] : mine.filter((n) => n.threadId === threadId);
    const all = [...seed, ...real];
    const replies = new Map<string, number>();
    for (const n of all) if (n.parentId) replies.set(n.parentId, (replies.get(n.parentId) ?? 0) + 1);
    return all.map((n) => {
      if (n.serverLiked !== undefined) {
        const isLiked = likeOverride.get(n.id) ?? n.serverLiked;
        return { ...n, liked: isLiked, likes: n.likes + (isLiked === n.serverLiked ? 0 : isLiked ? 1 : -1), replies: replies.get(n.id) ?? 0 };
      }
      return { ...n, liked: liked.has(n.id), likes: n.likes + (liked.has(n.id) ? 1 : 0), replies: replies.get(n.id) ?? 0 };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId, seed, v, cloud]);
}
export type ThreadNote = ReturnType<typeof useThread>[number];
/** Estado de carga de un hilo de la nube (para mostrar «cargando» o «sin conexión»). */
export function useThreadStatus(threadId: string): "local" | "loading" | "ready" | "error" {
  useSyncExternalStore(subscribe, getVersion, getVersion);
  const { on } = useCloud();
  if (!on || !isCloudThread(threadId)) return "local";
  return threads.get(threadId)?.status ?? "loading";
}

/** Todas tus voces guardadas en este dispositivo (para el perfil y los chats locales). */
export function useMyVoiceNotes() {
  const v = useSyncExternalStore(subscribe, getVersion, getVersion);
  useEffect(() => { void loadVoiceNotes(); }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => [...mine].sort((a, b) => b.createdAt - a.createdAt), [v]);
}

/** Convierte "0:14" o "1:05" en milisegundos. */
export const clockToMs = (t: string) => { const [m, s] = t.split(":").map((x) => Number(x) || 0); return ((m ?? 0) * 60 + (s ?? 0)) * 1000; };
