/**
 * Acceso a la nube de Spotly (Lovable Cloud / Supabase) sin dependencias de React: tablas y funciones de la
 * migración supabase/migrations/20261008140000_spotly_social.sql. Cada función recibe el cliente, así se prueba
 * contra un Supabase local (supabase/tests/api.test.ts) y la app le pasa el suyo (lib/cloud/index.ts).
 *
 * Las rutas de archivos se guardan como «cubo/ruta»: voces/<uid>/…, voces/anon/…, media/<uid>/…, media/anon/…,
 * perfiles/<uid>/…, chats/<chat>/<uid|anon>/… (este último privado: se reproduce con URL firmada).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type Client = SupabaseClient;
export type NoteRow = {
  id: string; thread_id: string; parent_id: string | null; reply_at_ms: number | null;
  author_id: string | null; author_name: string | null; author_username: string | null; author_avatar: string | null;
  anon: boolean; mine: boolean; audio_path: string; duration_ms: number; peaks: number[] | null; created_at: string; likes: number; liked: boolean;
};
export type SpotRow = {
  id: string; author_id: string | null; author_name: string | null; author_username: string | null; author_avatar: string | null;
  anon: boolean; mine: boolean; title: string; city: string; zone: string; topic: string; visibility: "public" | "nearby" | "followers"; location_hidden: boolean;
  happening_now: boolean; replies_allowed: boolean; audio_path: string; duration_ms: number; peaks: number[] | null; media_path: string | null; media_kind: "photo" | "video" | null;
  views: number; created_at: string; likes: number; liked: boolean; replies: number; saved: boolean;
};
export type ProfileRow = { id: string; username: string; display_name: string; city: string; avatar_path: string | null; cover: string | null; created_at: string; followers: number; following: number; spots: number };
export type ChatMember = { id: string; name: string; username: string; avatar: string | null };
export type ChatRow = { id: string; is_group: boolean; title: string; created_at: string; members: ChatMember[]; last_at: string | null };

/** Códigos de error de las reglas del servidor, para dar un aviso claro en la app. */
export const SERVER_RULES = ["incognito_required", "replies_closed", "not_a_member", "blocked", "username_taken", "username_unavailable", "author_mismatch", "parent_not_in_thread", "not_allowed", "readonly_fields", "not_your_thread", "rate_limited", "invalid_path", "anon_followers", "invalid_title", "user_not_found", "invalid_chat"] as const;
export type ServerRule = (typeof SERVER_RULES)[number];

export class CloudError extends Error {
  code: string;
  constructor(code: string, message: string) { super(message); this.name = "CloudError"; this.code = code; }
}
const fail = (e: { code?: string; message?: string } | null, fallback: string): never => {
  const msg = e?.message ?? fallback;
  const known = SERVER_RULES.find((k) => msg.includes(k));
  throw new CloudError(known ?? (e?.code === "23505" ? "duplicate" : e?.code === "42501" ? "not_allowed" : fallback), msg);
};

/** ¿Está aplicada la migración? `missing` si las tablas aún no existen en este proyecto. */
export async function probe(client: Client): Promise<"ready" | "missing" | "error"> {
  const { error } = await client.from("profiles_public").select("id").limit(1);
  if (!error) return "ready";
  if (error.code === "42P01" || error.code === "PGRST205" || error.code === "PGRST202" || error.code === "PGRST106" || /does not exist|schema cache|Could not find/i.test(error.message)) return "missing";
  return "error";
}

/* ───────────── Archivos ───────────── */
const EXT: Record<string, string> = { "audio/webm": "webm", "audio/ogg": "ogg", "audio/mp4": "m4a", "audio/x-m4a": "m4a", "audio/mpeg": "mp3", "audio/aac": "aac", "audio/wav": "wav", "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic", "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov" };
export const baseMime = (mime: string) => mime.split(";")[0]!.trim().toLowerCase();
export const extOf = (mime: string) => EXT[baseMime(mime)] ?? "bin";
const rnd = () => (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`);
export type Bucket = "voces" | "media" | "perfiles" | "chats";

export async function upload(client: Client, bucket: Bucket, path: string, blob: Blob, contentType: string): Promise<string> {
  const type = baseMime(contentType || blob.type || "application/octet-stream");
  // El tipo va en el propio archivo: storage-js lo envía como multipart y el servidor lo valida con la lista del cubo.
  const file = blob.type && baseMime(blob.type) === type ? blob : new Blob([blob], { type });
  const { error } = await client.storage.from(bucket).upload(path, file, { contentType: type, upsert: false, cacheControl: "31536000" });
  if (error) throw new CloudError("upload_failed", error.message);
  return `${bucket}/${path}`;
}
/** Sube un audio de voz: tu carpeta, «anon/» si es anónimo (la ruta no delata a nadie) o la carpeta del chat. */
export function uploadVoice(client: Client, uid: string, blob: Blob, mime: string, opts: { anon?: boolean | undefined; chatId?: string | undefined } = {}) {
  const name = `${rnd()}.${extOf(mime)}`;
  const folder = opts.anon ? "anon" : uid;
  if (opts.chatId) return upload(client, "chats", `${opts.chatId}/${folder}/${name}`, blob, mime);
  return upload(client, "voces", `${folder}/${name}`, blob, mime);
}
const split = (stored: string) => { const i = stored.indexOf("/"); return { bucket: stored.slice(0, i) as Bucket, path: stored.slice(i + 1) }; };
/** URL reproducible de un archivo guardado como «cubo/ruta» (firmada si es de un chat). */
export async function fileUrl(client: Client, stored: string, expiresIn = 3600): Promise<string> {
  const { bucket, path } = split(stored);
  if (bucket === "chats") {
    const { data, error } = await client.storage.from(bucket).createSignedUrl(path, expiresIn);
    if (error || !data) throw new CloudError("sign_failed", error?.message ?? "sin URL");
    return data.signedUrl;
  }
  return client.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}
/** URL pública (sin red) de un archivo de un cubo público; null si es de un chat. */
export function publicUrl(client: Client, stored: string | null | undefined): string | null {
  if (!stored) return null;
  const { bucket, path } = split(stored);
  if (bucket === "chats") return null;
  return client.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}
/** URLs firmadas de varios audios de chat a la vez (una sola petición). */
export async function signMany(client: Client, stored: string[], expiresIn = 3600): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const paths = stored.filter((s) => s.startsWith("chats/")).map((s) => split(s).path);
  if (!paths.length) return out;
  const { data, error } = await client.storage.from("chats").createSignedUrls(paths, expiresIn);
  if (error) throw new CloudError("sign_failed", error.message);
  for (const d of data ?? []) if (d.path && d.signedUrl) out.set(`chats/${d.path}`, d.signedUrl);
  return out;
}
/** Borra archivos tuyos (después de borrar el Spot o la voz que los usaba). Los anónimos y ajenos se ignoran. */
export async function removeFiles(client: Client, stored: (string | null | undefined)[]) {
  const byBucket = new Map<Bucket, string[]>();
  for (const s of stored) { if (!s) continue; const { bucket, path } = split(s); byBucket.set(bucket, [...(byBucket.get(bucket) ?? []), path]); }
  await Promise.all([...byBucket].map(([b, paths]) => client.storage.from(b).remove(paths).catch(() => undefined)));
}

/* ───────────── Voces ───────────── */
const NOTE_COLS = "id, thread_id, parent_id, reply_at_ms, author_id, author_name, author_username, author_avatar, anon, mine, audio_path, duration_ms, peaks, created_at, likes, liked";
export async function fetchThread(client: Client, threadId: string, limit = 300): Promise<NoteRow[]> {
  const { data, error } = await client.from("voice_notes_public").select(NOTE_COLS).eq("thread_id", threadId).order("created_at", { ascending: true }).limit(limit);
  if (error) fail(error, "thread_failed");
  return (data ?? []) as NoteRow[];
}
export type NewNote = { threadId: string; parentId?: string | null | undefined; replyAtMs?: number | undefined; blob: Blob; mime: string; durationMs: number; peaks: number[]; anon?: boolean | undefined };
const packPeaks = (peaks: number[]) => peaks.slice(0, 128).map((v) => Math.round(Math.max(0, Math.min(1, v)) * 1000) / 1000);
export async function postNote(client: Client, uid: string, n: NewNote): Promise<{ id: string; audioPath: string }> {
  const chatId = n.threadId.startsWith("chat:") ? n.threadId.slice(5) : undefined;
  const audio_path = await uploadVoice(client, uid, n.blob, n.mime, { anon: n.anon, chatId });
  const { data, error } = await client.from("voice_notes").insert({
    thread_id: n.threadId, parent_id: n.parentId ?? null, reply_at_ms: n.replyAtMs ? Math.round(n.replyAtMs) : null, author_id: uid, anon: !!n.anon,
    audio_path, duration_ms: Math.round(n.durationMs), peaks: packPeaks(n.peaks),
  }).select("id").single();
  if (error || !data) { await removeFiles(client, [audio_path]); fail(error, "post_failed"); }
  return { id: (data as { id: string }).id, audioPath: audio_path };
}
export async function deleteNote(client: Client, id: string, audioPath?: string | undefined) {
  const { data, error } = await client.rpc("delete_voice_note", { p_id: id });
  if (error) fail(error, "delete_failed");
  if (data === true && audioPath) await removeFiles(client, [audioPath]);
}
export async function setNoteLike(client: Client, uid: string, noteId: string, on: boolean) {
  const { error } = on ? await client.from("voice_likes").insert({ note_id: noteId, user_id: uid }) : await client.from("voice_likes").delete().eq("note_id", noteId).eq("user_id", uid);
  if (error && error.code !== "23505") fail(error, "like_failed");
}

/* ───────────── Spots ───────────── */
const SPOT_COLS = "id, author_id, author_name, author_username, author_avatar, anon, mine, title, city, zone, topic, visibility, location_hidden, happening_now, replies_allowed, audio_path, duration_ms, peaks, media_path, media_kind, views, created_at, likes, liked, replies, saved";
export type FeedQuery = { city?: string | undefined; before?: string | undefined; authorId?: string | undefined; authorIds?: string[] | undefined; trending?: boolean | undefined; offset?: number | undefined; limit?: number | undefined };
/**
 * Página del feed. Por defecto lo más reciente primero y `before` (fecha del último Spot cargado) para el scroll
 * infinito; `trending`: lo más escuchado de la última semana, paginado con `offset`.
 */
export async function fetchFeed(client: Client, opts: FeedQuery = {}): Promise<SpotRow[]> {
  const limit = opts.limit ?? 10;
  if (opts.authorIds && !opts.authorIds.length) return [];
  let q = client.from("spots_public").select(SPOT_COLS);
  if (opts.city) q = q.eq("city", opts.city);
  if (opts.authorId) q = q.eq("author_id", opts.authorId);
  if (opts.authorIds) q = q.in("author_id", opts.authorIds.slice(0, 200));
  if (opts.trending) {
    const since = new Date(Date.now() - 7 * 86400000).toISOString();
    const from = opts.offset ?? 0;
    const { data, error } = await q.gt("created_at", since).order("views", { ascending: false }).order("created_at", { ascending: false }).range(from, from + limit - 1);
    if (error) fail(error, "feed_failed");
    return (data ?? []) as SpotRow[];
  }
  if (opts.before) q = q.lt("created_at", opts.before);
  const { data, error } = await q.order("created_at", { ascending: false }).limit(limit);
  if (error) fail(error, "feed_failed");
  return (data ?? []) as SpotRow[];
}
export async function fetchSpot(client: Client, id: string): Promise<SpotRow | null> {
  const { data, error } = await client.from("spots_public").select(SPOT_COLS).eq("id", id).maybeSingle();
  if (error) fail(error, "spot_failed");
  return (data as SpotRow | null) ?? null;
}
export async function fetchMySpots(client: Client): Promise<SpotRow[]> {
  const { data, error } = await client.from("spots_public").select(SPOT_COLS).eq("mine", true).order("created_at", { ascending: false }).limit(300);
  if (error) fail(error, "spots_failed");
  return (data ?? []) as SpotRow[];
}
export type NewSpot = { title: string; city: string; zone: string; topic: string; visibility: SpotRow["visibility"]; locationHidden: boolean; anon: boolean; happeningNow: boolean; repliesAllowed: boolean; audio: Blob; audioMime: string; durationMs: number; peaks: number[]; media?: Blob | undefined; mediaKind?: "photo" | "video" | undefined };
export async function publishSpot(client: Client, uid: string, s: NewSpot): Promise<{ id: string; audioPath: string; mediaPath: string | null }> {
  const audio_path = await uploadVoice(client, uid, s.audio, s.audioMime, { anon: s.anon });
  let media_path: string | null = null;
  try {
    media_path = s.media && s.mediaKind ? await upload(client, "media", `${s.anon ? "anon" : uid}/${rnd()}.${extOf(s.media.type)}`, s.media, s.media.type) : null;
  } catch (e) { await removeFiles(client, [audio_path]); throw e; }
  const { data, error } = await client.from("spots").insert({
    author_id: uid, title: s.title.trim(), city: s.city, zone: s.zone, topic: s.topic, visibility: s.visibility, location_hidden: s.locationHidden, anon: s.anon,
    happening_now: s.happeningNow, replies_allowed: s.repliesAllowed, audio_path, duration_ms: Math.round(s.durationMs), peaks: packPeaks(s.peaks),
    media_path, media_kind: media_path ? s.mediaKind : null,
  }).select("id").single();
  if (error || !data) { await removeFiles(client, [audio_path, media_path]); fail(error, "publish_failed"); }
  return { id: (data as { id: string }).id, audioPath: audio_path, mediaPath: media_path };
}
export async function deleteSpot(client: Client, id: string, files: (string | null | undefined)[] = []) {
  const { error } = await client.from("spots").delete().eq("id", id);
  if (error) fail(error, "delete_failed");
  await removeFiles(client, files);
}
export async function setSaved(client: Client, uid: string, spotId: string, on: boolean) {
  const { error } = on ? await client.from("saved_spots").insert({ user_id: uid, spot_id: spotId }) : await client.from("saved_spots").delete().eq("user_id", uid).eq("spot_id", spotId);
  if (error && error.code !== "23505") fail(error, "save_failed");
}
/** Tus guardados, del último al primero. */
export async function fetchSaved(client: Client, uid: string): Promise<SpotRow[]> {
  const { data, error } = await client.from("saved_spots").select("spot_id").eq("user_id", uid).order("created_at", { ascending: false }).limit(200);
  if (error) fail(error, "saved_failed");
  const ids = ((data ?? []) as { spot_id: string }[]).map((r) => r.spot_id);
  if (!ids.length) return [];
  const { data: rows, error: e2 } = await client.from("spots_public").select(SPOT_COLS).in("id", ids);
  if (e2) fail(e2, "saved_failed");
  const order = new Map(ids.map((id, i) => [id, i]));
  return ((rows ?? []) as SpotRow[]).sort((x, y) => (order.get(x.id) ?? 0) - (order.get(y.id) ?? 0));
}
export async function recordView(client: Client, spotId: string): Promise<boolean> {
  const { data, error } = await client.rpc("record_spot_view", { p_spot: spotId });
  if (error) return false;
  return data === true;
}
export async function setSpotLike(client: Client, uid: string, spotId: string, on: boolean) {
  const { error } = on ? await client.from("spot_likes").insert({ spot_id: spotId, user_id: uid }) : await client.from("spot_likes").delete().eq("spot_id", spotId).eq("user_id", uid);
  if (error && error.code !== "23505") fail(error, "like_failed");
}

/* ───────────── Perfiles y seguidores ───────────── */
const PROFILE_COLS = "id, username, display_name, city, avatar_path, cover, created_at, followers, following, spots";
export async function ensureProfile(client: Client) {
  const { error } = await client.rpc("ensure_my_profile");
  if (error) fail(error, "profile_failed");
}
export async function fetchProfile(client: Client, id: string): Promise<ProfileRow | null> {
  const { data, error } = await client.from("profiles_public").select(PROFILE_COLS).eq("id", id).maybeSingle();
  if (error) fail(error, "profile_failed");
  return (data as ProfileRow | null) ?? null;
}
/** Personas de una ciudad (o las últimas en llegar), para descubrir gente. */
export async function discoverPeople(client: Client, opts: { city?: string | undefined; exclude?: string | undefined; limit?: number } = {}): Promise<ProfileRow[]> {
  let q = client.from("profiles_public").select(PROFILE_COLS);
  if (opts.city) q = q.eq("city", opts.city);
  if (opts.exclude) q = q.neq("id", opts.exclude);
  const { data, error } = await q.order("created_at", { ascending: false }).limit(opts.limit ?? 30);
  if (error) fail(error, "people_failed");
  return (data ?? []) as ProfileRow[];
}
export async function fetchProfileByUsername(client: Client, username: string): Promise<ProfileRow | null> {
  const { data, error } = await client.from("profiles_public").select(PROFILE_COLS).eq("username", username.toLowerCase()).maybeSingle();
  if (error) fail(error, "profile_failed");
  return (data as ProfileRow | null) ?? null;
}
/** ¿Está libre este nombre de usuario? (los usuarios son públicos, así que no revela nada nuevo). */
export async function usernameAvailable(client: Client, username: string): Promise<boolean> {
  const { data, error } = await client.from("profiles_public").select("id").eq("username", username.toLowerCase()).limit(1);
  if (error) return true;
  return !(data ?? []).length;
}
export type ProfilePatch = Partial<Pick<ProfileRow, "username" | "display_name" | "city" | "avatar_path" | "cover">>;
export async function updateProfile(client: Client, uid: string, patch: ProfilePatch) {
  const { error } = await client.from("profiles").update(patch).eq("id", uid);
  if (error?.code === "23505") throw new CloudError("username_taken", error.message);
  if (error) fail(error, "profile_update_failed");
}
/** Sube tu foto de perfil o tu portada (JPEG) y devuelve la ruta guardada. */
export function uploadProfileImage(client: Client, uid: string, kind: "avatar" | "cover", jpeg: Blob) {
  return upload(client, "perfiles", `${uid}/${kind}-${rnd()}.jpg`, jpeg, "image/jpeg");
}
export async function setFollow(client: Client, uid: string, otherId: string, on: boolean) {
  const { error } = on ? await client.from("follows").insert({ follower_id: uid, followee_id: otherId }) : await client.from("follows").delete().eq("follower_id", uid).eq("followee_id", otherId);
  if (error && error.code !== "23505") fail(error, "follow_failed");
}
/** A quién sigo (ids). */
export async function fetchFollowingIds(client: Client, uid: string): Promise<string[]> {
  const { data, error } = await client.from("follows").select("followee_id").eq("follower_id", uid).limit(2000);
  if (error) fail(error, "people_failed");
  return ((data ?? []) as { followee_id: string }[]).map((r) => r.followee_id);
}
/** Seguidores (quién me sigue) o seguidos (a quién sigo), con su perfil público. */
export async function fetchPeople(client: Client, uid: string, kind: "followers" | "following"): Promise<ProfileRow[]> {
  const col = kind === "followers" ? "follower_id" : "followee_id", other = kind === "followers" ? "followee_id" : "follower_id";
  const { data, error } = await client.from("follows").select(col).eq(other, uid).order("created_at", { ascending: false }).limit(500);
  if (error) fail(error, "people_failed");
  const ids = ((data ?? []) as Record<string, string>[]).map((r) => r[col]!).filter(Boolean);
  if (!ids.length) return [];
  const { data: profiles, error: e2 } = await client.from("profiles_public").select(PROFILE_COLS).in("id", ids);
  if (e2) fail(e2, "people_failed");
  const order = new Map(ids.map((id, i) => [id, i]));
  return ((profiles ?? []) as ProfileRow[]).sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}
export async function isFollowing(client: Client, uid: string, otherId: string) {
  const { data } = await client.from("follows").select("followee_id").eq("follower_id", uid).eq("followee_id", otherId).maybeSingle();
  return !!data;
}

/* ───────────── Chats, bloqueos, denuncias y cuenta ───────────── */
export async function fetchChats(client: Client): Promise<ChatRow[]> {
  const { data, error } = await client.from("my_chats").select("id, is_group, title, created_at, members, last_at").order("last_at", { ascending: false, nullsFirst: false }).limit(200);
  if (error) fail(error, "chats_failed");
  return (data ?? []) as ChatRow[];
}
export async function openDirectChat(client: Client, otherId: string): Promise<string> {
  const { data, error } = await client.rpc("open_direct_chat", { p_other: otherId });
  if (error || !data) fail(error, "chat_failed");
  return data as string;
}
export async function createGroupChat(client: Client, title: string, members: string[]): Promise<string> {
  const { data, error } = await client.rpc("create_group_chat", { p_title: title, p_members: members });
  if (error || !data) fail(error, "chat_failed");
  return data as string;
}
export async function leaveChat(client: Client, uid: string, chatId: string) {
  const { error } = await client.from("chat_members").delete().eq("chat_id", chatId).eq("user_id", uid);
  if (error) fail(error, "chat_failed");
}
export async function block(client: Client, uid: string, otherId: string, on: boolean) {
  const { error } = on ? await client.from("blocks").insert({ blocker_id: uid, blocked_id: otherId }) : await client.from("blocks").delete().eq("blocker_id", uid).eq("blocked_id", otherId);
  if (error && error.code !== "23505") fail(error, "block_failed");
}
export async function fetchBlocked(client: Client, uid: string): Promise<ProfileRow[]> {
  const { data, error } = await client.from("blocks").select("blocked_id").eq("blocker_id", uid).limit(1000);
  if (error) fail(error, "blocks_failed");
  const ids = ((data ?? []) as { blocked_id: string }[]).map((r) => r.blocked_id);
  if (!ids.length) return [];
  const { data: profiles } = await client.from("profiles_public").select(PROFILE_COLS).in("id", ids);
  return (profiles ?? []) as ProfileRow[];
}
export type ReportRow = { id: string; target_type: string; target_id: string; reason: string; status: "review" | "resolved" | "removed"; created_at: string };
export async function fetchMyReports(client: Client, uid: string): Promise<ReportRow[]> {
  const { data, error } = await client.from("reports").select("id, target_type, target_id, reason, status, created_at").eq("reporter_id", uid).order("created_at", { ascending: false }).limit(100);
  if (error) fail(error, "reports_failed");
  return (data ?? []) as ReportRow[];
}
export async function report(client: Client, uid: string, targetType: "spot" | "voice" | "profile" | "chat", targetId: string, reason: string) {
  const { error } = await client.from("reports").insert({ reporter_id: uid, target_type: targetType, target_id: targetId, reason: reason.slice(0, 60) });
  if (error && error.code !== "23505") fail(error, "report_failed");
}
export async function hasIncognito(client: Client): Promise<boolean> {
  const { data, error } = await client.rpc("has_incognito");
  return !error && data === true;
}
/** Todos tus datos (derecho de acceso): perfil, Spots, voces, seguidores, guardados, chats, bloqueos y denuncias. */
export async function exportMyData(client: Client, uid: string) {
  const q = async <T,>(p: PromiseLike<{ data: T | null; error: { message: string } | null }>) => { const { data, error } = await p; if (error) throw new CloudError("export_failed", error.message); return data; };
  const [profile, spots, notes, following, followers, saved, chats, blocks, reports] = await Promise.all([
    fetchProfile(client, uid),
    q(client.from("spots").select("*").eq("author_id", uid).order("created_at", { ascending: false })),
    q(client.from("voice_notes").select("id, thread_id, parent_id, reply_at_ms, anon, audio_path, duration_ms, created_at").eq("author_id", uid).order("created_at", { ascending: false })),
    fetchPeople(client, uid, "following"),
    fetchPeople(client, uid, "followers"),
    q(client.from("saved_spots").select("spot_id, created_at").eq("user_id", uid)),
    fetchChats(client),
    q(client.from("blocks").select("blocked_id, created_at").eq("blocker_id", uid)),
    q(client.from("reports").select("target_type, target_id, reason, status, created_at").eq("reporter_id", uid)),
  ]);
  const people = (l: ProfileRow[]) => l.map((p) => ({ id: p.id, username: p.username, name: p.display_name }));
  return { exported_at: new Date().toISOString(), profile, spots, voice_notes: notes, following: people(following), followers: people(followers), saved, chats: chats.map((c) => ({ id: c.id, group: c.is_group, title: c.title, members: c.members.map((m) => m.username) })), blocks, reports };
}
/**
 * Borra tu cuenta: primero tus archivos (fotos, voces, vídeos) y después la cuenta, que arrastra todo lo demás.
 * Devuelve `deleted` si se borró al momento o `requested` si queda solicitada para el equipo.
 */
export async function deleteMyAccount(client: Client, uid: string): Promise<"deleted" | "requested"> {
  for (const bucket of ["voces", "media", "perfiles"] as const) {
    for (let page = 0; page < 20; page++) {
      const { data } = await client.storage.from(bucket).list(uid, { limit: 100, offset: 0 });
      const names = (data ?? []).filter((f) => f.id).map((f) => `${uid}/${f.name}`);
      if (!names.length) break;
      const { data: removed } = await client.storage.from(bucket).remove(names);
      if (!removed?.length) break;
    }
  }
  const { data, error } = await client.rpc("delete_my_account");
  if (error) fail(error, "delete_account_failed");
  return data === true ? "deleted" : "requested";
}
