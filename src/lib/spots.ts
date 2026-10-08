/**
 * Spots: título (lo único escrito), voz grabada, foto o vídeo opcional y ajustes de publicación.
 *
 * Con sesión y la nube lista (lib/cloud) se publican en el servidor y se ven en el feed de todo el mundo (por
 * pestaña: Todo, Cerca = tu ciudad, Suscrito = a quien sigues, España = lo más escuchado de la semana), con scroll
 * infinito, me gusta, respuestas y vistas reales (una por persona y día; las tuyas no cuentan). Sin nube (o en el
 * modo demostración) tus Spots se guardan en este dispositivo (IndexedDB, con el audio y la imagen) y sus vistas
 * valen 0, porque nadie más puede escucharlos.
 */
import { useEffect, useMemo, useSyncExternalStore } from "react";
import { toast } from "sonner";
import type { VoiceClip } from "./voice/recorder";
import { releaseVoice } from "./voice/player";
import { api, cloudErrorText, cloudOn, cloudUid, db, fileUrl, getCloud, useCloud } from "./cloud";

export type SpotMedia = { kind: "photo" | "video"; src: string; mimeType: string };
export type SpotAuthor = { id: string | null; name: string; username: string | null; avatar: string | null };
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
  /** Solo en la nube: autor, me gusta, respuestas y rutas de los archivos. */
  cloud?: { author: SpotAuthor; mine: boolean; likes: number; liked: boolean; replies: number; saved: boolean; audioPath: string; mediaPath: string | null } | undefined;
};
type Stored = Omit<MySpot, "media" | "audio" | "cloud"> & { audioBlob: Blob; audioMime: string; durationMs: number; peaks: number[]; mediaBlob?: Blob | undefined; mediaKind?: "photo" | "video" | undefined; mediaMime?: string | undefined };

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

export type NewSpot = Omit<MySpot, "id" | "createdAt" | "media" | "audio" | "views" | "cloud"> & { clip: VoiceClip; mediaFile?: Blob | undefined; mediaKind?: "photo" | "video" | undefined };

/* ───────────── Nube ───────────── */
const byId = new Map<string, MySpot>();
const ownFiles = new Map<string, { audio: string; media?: string | undefined }>(); // id → URLs locales de lo que acabas de publicar
let mineIds: string[] = [];
let mineStatus: "idle" | "loading" | "ready" | "error" = "idle";
let mineUid: string | null = null;

const visibilityOf = (label: string): api.SpotRow["visibility"] => (/cerca/i.test(label) ? "nearby" : /seguidores/i.test(label) ? "followers" : "public");
const visibilityLabel = (v: api.SpotRow["visibility"]) => (v === "nearby" ? "Solo cerca (tu ciudad)" : v === "followers" ? "Solo seguidores" : "Todos (público)");
function fromRow(r: api.SpotRow): MySpot {
  const own = ownFiles.get(r.id);
  const mediaSrc = own?.media ?? fileUrl(r.media_path);
  return {
    id: r.id, title: r.title, city: r.city, zone: r.zone, topic: r.topic, visibility: visibilityLabel(r.visibility), precision: r.location_hidden ? "Oculta" : "Aproximada",
    anon: r.anon, boosted: false, happeningNow: r.happening_now, repliesAllowed: r.replies_allowed, createdAt: Date.parse(r.created_at), views: r.views,
    audio: { src: own?.audio ?? fileUrl(r.audio_path) ?? "", durationMs: r.duration_ms, peaks: r.peaks?.length ? r.peaks : [] },
    media: r.media_kind && mediaSrc ? { kind: r.media_kind, src: mediaSrc, mimeType: r.media_kind === "photo" ? "image/jpeg" : "video/mp4" } : undefined,
    cloud: { author: { id: r.author_id, name: r.author_name || (r.author_username ? `@${r.author_username}` : "Anónimo"), username: r.author_username, avatar: fileUrl(r.author_avatar) }, mine: r.mine, likes: r.likes, liked: r.liked, replies: r.replies, saved: r.saved, audioPath: r.audio_path, mediaPath: r.media_path },
  };
}
const keep = (rows: api.SpotRow[]) => rows.map((r) => { const s = fromRow(r); const prev = byId.get(s.id); if (prev?.cloud && pendingLike.has(s.id)) s.cloud = { ...s.cloud!, liked: prev.cloud.liked, likes: prev.cloud.likes }; byId.set(s.id, s); return s.id; });

async function loadMine(force = false) {
  const uid = cloudUid();
  if (!uid) return;
  if (!force && mineUid === uid && (mineStatus === "loading" || mineStatus === "ready")) return;
  mineUid = uid; mineStatus = "loading"; emit();
  try { mineIds = keep(await api.fetchMySpots(db())); mineStatus = "ready"; }
  catch { mineStatus = mineIds.length ? "ready" : "error"; }
  emit();
}

/** Publica un Spot tuyo: en la nube si hay sesión (si falla, lanza el error y no se pierde nada), si no en el dispositivo. */
export async function publishSpot({ clip, mediaFile, mediaKind, ...info }: NewSpot): Promise<MySpot> {
  const uid = cloudUid();
  if (uid) {
    const visibility = visibilityOf(info.visibility);
    const r = await api.publishSpot(db(), uid, {
      title: info.title, city: info.city, zone: info.zone, topic: info.topic, visibility, locationHidden: info.precision === "Oculta", anon: info.anon,
      happeningNow: info.happeningNow, repliesAllowed: info.repliesAllowed, audio: clip.blob, audioMime: clip.mimeType, durationMs: clip.durationMs, peaks: clip.peaks,
      media: mediaFile, mediaKind,
    });
    const mediaUrl = mediaFile && mediaKind ? URL.createObjectURL(mediaFile) : undefined;
    ownFiles.set(r.id, { audio: clip.url, media: mediaUrl });
    const me = getCloud().profile;
    const spot: MySpot = {
      ...info, id: r.id, createdAt: Date.now(), views: 0, visibility: visibilityLabel(visibility),
      audio: { src: clip.url, durationMs: Math.round(clip.durationMs), peaks: clip.peaks },
      media: mediaUrl && mediaKind ? { kind: mediaKind, src: mediaUrl, mimeType: mediaFile!.type } : undefined,
      cloud: { author: { id: info.anon ? null : uid, name: me?.display_name || me?.username || "", username: me?.username ?? null, avatar: fileUrl(me?.avatar_path) }, mine: true, likes: 0, liked: false, replies: 0, saved: false, audioPath: r.audioPath, mediaPath: r.mediaPath },
    };
    byId.set(spot.id, spot);
    mineIds = [spot.id, ...mineIds.filter((x) => x !== spot.id)];
    for (const f of feeds.values()) if (f.kind === "recent" && !f.city && !f.following && (!f.media || spot.media)) f.ids = [spot.id, ...f.ids.filter((x) => x !== spot.id)];
    emit();
    return spot;
  }
  const id = `spot-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const spot: MySpot = {
    ...info, id, createdAt: Date.now(), views: 0,
    audio: { src: clip.url, durationMs: Math.round(clip.durationMs), peaks: clip.peaks },
    media: mediaFile && mediaKind ? { kind: mediaKind, src: URL.createObjectURL(mediaFile), mimeType: mediaFile.type } : undefined,
  };
  spots = [spot, ...spots];
  emit();
  const { media: _m, audio: _au, cloud: _c, ...rest } = spot;
  void tx("readwrite", (os) => os.put({ ...rest, audioBlob: clip.blob, audioMime: clip.mimeType, durationMs: spot.audio.durationMs, peaks: spot.audio.peaks, mediaBlob: mediaFile, mediaKind, mediaMime: mediaFile?.type } satisfies Stored));
  return spot;
}

/** Elimina un Spot tuyo (y su audio e imagen). */
export function deleteSpot(id: string) {
  releaseVoice(`spot-audio:${id}`);
  const c = byId.get(id);
  if (c?.cloud) {
    mineIds = mineIds.filter((x) => x !== id);
    for (const f of feeds.values()) f.ids = f.ids.filter((x) => x !== id);
    emit();
    void api.deleteSpot(db(), id, c.cloud.mine && !c.anon ? [c.cloud.audioPath, c.cloud.mediaPath] : []).then(() => { byId.delete(id); }).catch((e) => { toast.error(cloudErrorText(e)); void loadMine(true); });
    return;
  }
  const s = spots.find((x) => x.id === id);
  if (!s) return;
  spots = spots.filter((x) => x.id !== id);
  URL.revokeObjectURL(s.audio.src);
  if (s.media) URL.revokeObjectURL(s.media.src);
  emit();
  void tx("readwrite", (os) => os.delete(id));
}

const pendingLike = new Set<string>();
/** Me gusta en un Spot de la nube (al momento en pantalla; si el servidor falla, se deshace). */
export function toggleSpotLike(id: string) {
  const s = byId.get(id), uid = cloudUid();
  if (!s?.cloud || !uid) return;
  const on = !s.cloud.liked;
  const apply = (liked: boolean) => { const cur = byId.get(id); if (cur?.cloud) byId.set(id, { ...cur, cloud: { ...cur.cloud, liked, likes: Math.max(0, cur.cloud.likes + (liked === cur.cloud.liked ? 0 : liked ? 1 : -1)) } }); emit(); };
  apply(on);
  pendingLike.add(id);
  void api.setSpotLike(db(), uid, id, on).catch((e) => { apply(!on); toast.error(cloudErrorText(e)); }).finally(() => pendingLike.delete(id));
}
/** Guardar un Spot de la nube para escucharlo luego (privado). */
export function toggleSpotSaved(id: string): boolean | null {
  const s = byId.get(id), uid = cloudUid();
  if (!s?.cloud || !uid) return null;
  const on = !s.cloud.saved;
  const apply = (saved: boolean) => { const cur = byId.get(id); if (cur?.cloud) byId.set(id, { ...cur, cloud: { ...cur.cloud, saved } }); savedIds = saved ? [id, ...savedIds.filter((x) => x !== id)] : savedIds.filter((x) => x !== id); emit(); };
  apply(on);
  void api.setSaved(db(), uid, id, on).catch((e) => { apply(!on); toast.error(cloudErrorText(e)); });
  return on;
}
let savedIds: string[] = [];
let savedStatus: "idle" | "loading" | "ready" | "error" = "idle";
/** Tus Spots guardados (perfil → Guardados). */
export function useSavedSpots(enabled: boolean) {
  const v = useSyncExternalStore(subscribe, getVersion, getVersion);
  const { on, uid } = useCloud();
  useEffect(() => {
    if (!enabled || !on || !uid) return;
    savedStatus = savedIds.length ? "ready" : "loading"; emit();
    void api.fetchSaved(db(), uid).then((rows) => { savedIds = keep(rows); savedStatus = "ready"; emit(); }).catch(() => { savedStatus = savedIds.length ? "ready" : "error"; emit(); });
  }, [enabled, on, uid]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => ({ spots: savedIds.map((id) => byId.get(id)).filter((x): x is MySpot => !!x && !!x.cloud?.saved), status: savedStatus }), [v]);
}
const viewed = new Set<string>();
/** Cuenta una vista (una por persona y día en el servidor; las tuyas no cuentan). */
export function recordSpotView(id: string) {
  const s = byId.get(id);
  if (!s?.cloud || s.cloud.mine || viewed.has(id) || !cloudOn()) return;
  viewed.add(id);
  void api.recordView(db(), id).then((counted) => { if (counted) { const cur = byId.get(id); if (cur) { byId.set(id, { ...cur, views: cur.views + 1 }); emit(); } } });
}
/** Actualiza el número de respuestas de un Spot cuando su conversación cambia. */
export function setSpotReplies(id: string, replies: number) {
  const s = byId.get(id);
  if (s?.cloud && s.cloud.replies !== replies) { byId.set(id, { ...s, cloud: { ...s.cloud, replies } }); emit(); }
}
export const cloudSpot = (id: string) => byId.get(id);
/** Busca Spots de la nube por título, ciudad o zona (búsqueda por voz). */
export async function searchCloudSpots(text: string): Promise<MySpot[]> {
  const rows = await api.searchSpots(db(), text);
  const ids = keep(rows);
  emit();
  return ids.map((id) => byId.get(id)).filter((x): x is MySpot => !!x);
}
/** Trae un Spot concreto de la nube (enlaces compartidos). */
export async function loadCloudSpot(id: string): Promise<MySpot | null> {
  const row = await api.fetchSpot(db(), id);
  if (!row) return null;
  keep([row]);
  emit();
  return byId.get(id) ?? null;
}

const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
const getVersion = () => version;

/** Tus Spots (perfil): de la nube con sesión; si no, los guardados en este dispositivo. */
export function useMySpots() {
  const v = useSyncExternalStore(subscribe, getVersion, getVersion);
  const { on, uid } = useCloud();
  useEffect(() => { if (on) void loadMine(); else void loadMySpots(); }, [on, uid]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => (on ? mineIds.map((id) => byId.get(id)).filter((x): x is MySpot => !!x) : [...spots]), [v, on]);
}

/* ───────────── Feed de la nube ───────────── */
export type FeedKind = "recent" | "trending";
type Feed = { kind: FeedKind; city?: string | undefined; following?: boolean | undefined; media?: boolean | undefined; ids: string[]; status: "idle" | "loading" | "ready" | "error"; more: boolean; busy: boolean; seq: number; at: number };
const feeds = new Map<string, Feed>();
const PAGE = 8;
async function loadFeed(key: string, reset: boolean) {
  const f = feeds.get(key);
  if (!f || (f.busy && !reset) || (!reset && !f.more)) return;
  const mySeq = ++f.seq;
  f.busy = true;
  if (reset || !f.ids.length) f.status = "loading";
  emit();
  try {
    const following = f.following ? getCloud().following : undefined;
    const last = f.ids.length && !reset ? byId.get(f.ids[f.ids.length - 1]!) : undefined;
    const rows = await api.fetchFeed(db(), { city: f.city, authorIds: following, withMedia: f.media, trending: f.kind === "trending", offset: reset ? 0 : f.ids.length, before: f.kind === "recent" && last ? new Date(last.createdAt).toISOString() : undefined, limit: PAGE });
    if (f.seq !== mySeq) return;
    const ids = keep(rows);
    f.ids = reset ? ids : [...f.ids, ...ids.filter((id) => !f.ids.includes(id))];
    f.more = rows.length === PAGE;
    f.status = "ready";
    f.at = Date.now();
  } catch {
    if (f.seq === mySeq) f.status = f.ids.length ? "ready" : "error";
  } finally {
    if (f.seq === mySeq) f.busy = false;
    emit();
  }
}
/**
 * Spots de la nube para una pestaña del feed, con scroll infinito (`loadMore`) y `refresh`. `following` usa a quien
 * sigues; `city` filtra por ciudad; `trending` ordena por escuchas de la última semana.
 */
export function useCloudFeed(opts: { kind: FeedKind; city?: string | undefined; following?: boolean | undefined; media?: boolean | undefined; enabled: boolean }) {
  const v = useSyncExternalStore(subscribe, getVersion, getVersion);
  const followingKey = opts.following ? getCloud().following.join(",") : "";
  const key = `${opts.kind}|${opts.city ?? ""}|${opts.following ? `f:${followingKey}` : ""}|${opts.media ? "m" : ""}`;
  useEffect(() => {
    if (!opts.enabled) return;
    let f = feeds.get(key);
    if (!f) { f = { kind: opts.kind, city: opts.city, following: opts.following, media: opts.media, ids: [], status: "idle", more: true, busy: false, seq: 0, at: 0 }; feeds.set(key, f); }
    if (f.status === "idle" || Date.now() - f.at > 60000) void loadFeed(key, true);
  }, [key, opts.enabled, opts.kind, opts.city, opts.following, opts.media]);
  return useMemo(() => {
    const f = feeds.get(key);
    return {
      spots: (f?.ids ?? []).map((id) => byId.get(id)).filter((x): x is MySpot => !!x),
      status: f?.status ?? "idle",
      hasMore: f?.more ?? false,
      loadMore: () => void loadFeed(key, false),
      refresh: () => void loadFeed(key, true),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, v]);
}
/** Spots de una persona (su perfil). */
export function useAuthorSpots(authorId: string | null | undefined) {
  useSyncExternalStore(subscribe, getVersion, getVersion);
  const { on } = useCloud();
  const key = `author|${authorId ?? ""}`;
  useEffect(() => {
    if (!on || !authorId) return;
    if (!feeds.has(key)) feeds.set(key, { kind: "recent", ids: [], status: "idle", more: false, busy: false, seq: 0, at: 0 });
    const f = feeds.get(key)!;
    const mySeq = ++f.seq;
    f.status = f.ids.length ? "ready" : "loading";
    emit();
    void api.fetchFeed(db(), { authorId, limit: 60 }).then((rows) => { if (f.seq !== mySeq) return; f.ids = keep(rows); f.status = "ready"; emit(); }).catch(() => { if (f.seq === mySeq) { f.status = f.ids.length ? "ready" : "error"; emit(); } });
  }, [on, authorId, key]);
  const f = feeds.get(key);
  return { spots: (f?.ids ?? []).map((id) => byId.get(id)).filter((x): x is MySpot => !!x), status: f?.status ?? (on && authorId ? "loading" : "idle") };
}
