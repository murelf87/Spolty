/**
 * La nube de Spotly dentro de la app (Lovable Cloud): decide si se trabaja contra el servidor o en este dispositivo.
 *
 * Se usa la nube cuando hay sesión iniciada, la migración de supabase/migrations está aplicada y no es el modo
 * demostración. Si la migración aún no está (o el servidor no responde), todo sigue funcionando en local como
 * antes y se vuelve a comprobar al recuperar la conexión. La vista previa y la PWA de prueba compilan con
 * VITE_SPOTLY_CLOUD=off y nunca llaman al servidor.
 *
 * Aquí viven también tu perfil (nombre, usuario, ciudad, foto, portada) sincronizado con la nube, a quién sigues,
 * tu Incógnito (lo concede el servidor tras el pago) y los avisos de tiempo real de cada conversación.
 */
import { useSyncExternalStore } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import * as api from "./api";
import { DEMO_AVATAR, getState, onMeSaved, saveMeQuiet, subscribeStore, type Me } from "../store";

export { api };
export type CloudStatus = "off" | "checking" | "ready" | "missing" | "error";
type CloudState = { status: CloudStatus; uid: string | null; incognito: boolean; following: string[]; profile: api.ProfileRow | null };

const ENABLED = import.meta.env["VITE_SPOTLY_CLOUD"] !== "off";
let cs: CloudState = { status: "off", uid: null, incognito: false, following: [], profile: null };
const listeners = new Set<() => void>();
function set(patch: Partial<CloudState>) { cs = { ...cs, ...patch }; listeners.forEach((l) => l()); }
const subscribe = (l: () => void) => { listeners.add(l); const off = subscribeStore(l); return () => { listeners.delete(l); off(); }; };

/** Cliente de Supabase sin los tipos generados (la migración aún no está en src/integrations/supabase/types.ts). */
export const db = () => supabase as unknown as SupabaseClient;
export const getCloud = () => cs;
/** ¿Se trabaja contra la nube ahora mismo? */
export const cloudOn = () => cs.status === "ready" && !!cs.uid && !getState().demo;
export const cloudUid = () => (cloudOn() ? cs.uid : null);

type CloudView = CloudState & { on: boolean };
let lastView: CloudView | null = null;
const view = (): CloudView => {
  const on = cloudOn();
  if (!lastView || lastView.on !== on || lastView.status !== cs.status || lastView.uid !== cs.uid || lastView.incognito !== cs.incognito || lastView.following !== cs.following || lastView.profile !== cs.profile) lastView = { ...cs, on };
  return lastView;
};
const offView: CloudView = { ...cs, on: false };
/** Estado de la nube para la interfaz (se actualiza al entrar, salir o cambiar el modo demostración). */
export function useCloud(): CloudView {
  return useSyncExternalStore(subscribe, view, () => offView);
}

/* ───────────── Arranque y sesión ───────────── */
let started = false;
let retry: ReturnType<typeof setTimeout> | null = null;
async function check(uid: string | null) {
  if (!uid) { set({ status: "off", uid: null, incognito: false, following: [], profile: null }); return; }
  if (cs.uid === uid && (cs.status === "ready" || cs.status === "checking")) return;
  set({ status: "checking", uid });
  const result = await api.probe(db()).catch(() => "error" as const);
  if (cs.uid !== uid) return;
  if (result !== "ready") {
    set({ status: result });
    if (result === "error") { if (retry) clearTimeout(retry); retry = setTimeout(() => { if (cs.status === "error") { set({ status: "off" }); void check(uid); } }, 20000); }
    return;
  }
  set({ status: "ready" });
  await Promise.all([syncProfile(uid), refreshFollowing(), refreshIncognito()]);
}

/** Se llama una vez al abrir la app. Devuelve la función para dejar de escuchar. */
export function startCloud(): () => void {
  if (started || !ENABLED || typeof window === "undefined") return () => undefined;
  started = true;
  const fromSession = (uid: string | null) => { setTimeout(() => void check(uid), 0); };
  void supabase.auth.getSession().then(({ data }) => fromSession(data.session?.user.id ?? null)).catch(() => set({ status: "error" }));
  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_OUT") fromSession(null);
    else if (session?.user && event !== "PASSWORD_RECOVERY") fromSession(session.user.id);
  });
  const again = () => { if (cs.uid && (cs.status === "error" || cs.status === "missing")) { const uid = cs.uid; set({ status: "off" }); void check(uid); } else if (cloudOn()) void refreshIncognito(); };
  window.addEventListener("online", again);
  const onVisible = () => { if (document.visibilityState === "visible") again(); };
  document.addEventListener("visibilitychange", onVisible);
  const offMe = onMeSaved((next, prev) => { if (cloudOn()) void pushProfile(next, prev); });
  return () => { started = false; subscription.unsubscribe(); window.removeEventListener("online", again); document.removeEventListener("visibilitychange", onVisible); offMe(); };
}

/* ───────────── Perfil ───────────── */
export const fileUrl = (stored: string | null | undefined) => api.publicUrl(db(), stored);
const coverUrl = (cover: string | null | undefined) => (!cover ? null : cover.startsWith("preset:") ? cover : fileUrl(cover));
const isDataUrl = (v: string | null | undefined): boolean => !!v && v.startsWith("data:");
async function dataUrlToJpeg(dataUrl: string): Promise<Blob> { return (await fetch(dataUrl)).blob(); }

function applyProfile(p: api.ProfileRow) {
  const me = getState().me;
  const next: Me = { ...me, name: p.display_name || p.username, user: p.username, city: p.city || me.city, avatar: fileUrl(p.avatar_path), cover: coverUrl(p.cover) ?? me.cover ?? "preset:neon" };
  saveMeQuiet(next);
  set({ profile: p });
}

async function syncProfile(uid: string) {
  const c = db();
  let p = await api.fetchProfile(c, uid).catch(() => null);
  if (!p) { await api.ensureProfile(c).catch(() => undefined); p = await api.fetchProfile(c, uid).catch(() => null); }
  if (!p || cs.uid !== uid) return;
  // Primera vez en la nube: lo que elegiste en este dispositivo (ciudad, tu foto, tu portada) se sube.
  const me = getState().me;
  const patch: api.ProfilePatch = {};
  if (!p.city && me.city && hasSavedProfile()) patch.city = me.city;
  try {
    if (!p.avatar_path && isDataUrl(me.avatar)) patch.avatar_path = await api.uploadProfileImage(c, uid, "avatar", await dataUrlToJpeg(me.avatar!));
    if (!p.cover && isDataUrl(me.cover)) patch.cover = await api.uploadProfileImage(c, uid, "cover", await dataUrlToJpeg(me.cover!));
    else if (!p.cover && me.cover?.startsWith("preset:")) patch.cover = me.cover;
    if (Object.keys(patch).length) { await api.updateProfile(c, uid, patch); p = { ...p, ...patch }; }
  } catch { /* se reintenta al volver a entrar */ }
  applyProfile(p);
}
const hasSavedProfile = () => { try { return !!localStorage.getItem("spotly-perfil"); } catch { return false; } };

let pushing: Promise<void> = Promise.resolve();
/** Sube a la nube lo que cambiaste en tu perfil (en orden, uno detrás de otro). */
function pushProfile(next: Me, prev: Me) {
  pushing = pushing.then(async () => {
    const uid = cs.uid, p = cs.profile;
    if (!uid || !p) return;
    const c = db();
    const patch: api.ProfilePatch = {};
    if (next.name !== prev.name) patch.display_name = next.name.trim().slice(0, 40);
    if (next.user !== prev.user) patch.username = next.user.trim().toLowerCase();
    if (next.city !== prev.city) patch.city = next.city.slice(0, 80);
    try {
      if (next.avatar !== prev.avatar) patch.avatar_path = isDataUrl(next.avatar) ? await api.uploadProfileImage(c, uid, "avatar", await dataUrlToJpeg(next.avatar!)) : next.avatar === null || next.avatar === DEMO_AVATAR ? null : p.avatar_path;
      if (next.cover !== prev.cover) patch.cover = isDataUrl(next.cover) ? await api.uploadProfileImage(c, uid, "cover", await dataUrlToJpeg(next.cover!)) : next.cover?.startsWith("preset:") ? next.cover : p.cover;
      if (!Object.keys(patch).length) return;
      await api.updateProfile(c, uid, patch);
      const stale: string[] = [];
      if ("avatar_path" in patch && p.avatar_path && p.avatar_path !== patch.avatar_path) stale.push(p.avatar_path);
      if ("cover" in patch && p.cover?.startsWith("perfiles/") && p.cover !== patch.cover) stale.push(p.cover);
      applyProfile({ ...p, ...patch });
      if (stale.length) void api.removeFiles(c, stale);
    } catch (e) {
      toast.error(cloudErrorText(e));
      applyProfile(p); // vuelve a lo que hay en la nube
    }
  });
  return pushing;
}
/** Vuelve a pedir tu perfil (contadores de seguidores, etc.). */
export async function refreshProfile() { if (cloudOn() && cs.uid) { const p = await api.fetchProfile(db(), cs.uid).catch(() => null); if (p) set({ profile: p }); } }

/* ───────────── Seguidos e Incógnito ───────────── */
async function refreshFollowing() { if (!cs.uid) return; const ids = await api.fetchFollowingIds(db(), cs.uid).catch(() => null); if (ids) set({ following: ids }); }
async function refreshIncognito() { if (!cs.uid) return; const on = await api.hasIncognito(db()).catch(() => false); if (on !== cs.incognito) set({ incognito: on }); }
export const isFollowingId = (id: string | null | undefined) => !!id && cs.following.includes(id);
/** Seguir o dejar de seguir (al momento en pantalla; si el servidor falla, se deshace). */
export async function followId(id: string, on: boolean): Promise<boolean> {
  const uid = cloudUid();
  if (!uid || id === uid) return false;
  const before = cs.following;
  set({ following: on ? [...new Set([...before, id])] : before.filter((x) => x !== id) });
  try { await api.setFollow(db(), uid, id, on); void refreshProfile(); return true; }
  catch (e) { set({ following: before }); toast.error(cloudErrorText(e)); return false; }
}

/* ───────────── Tiempo real ───────────── */
/**
 * Avisa cuando hay voces nuevas (o borradas) en un hilo. Usa el tiempo real de Supabase sobre thread_events (sin
 * datos personales) y, por si el tiempo real no llega, vuelve a preguntar cada 30 s mientras el hilo está abierto.
 */
export function watchThread(threadId: string, onChange: () => void): () => void {
  if (!cloudOn()) return () => undefined;
  let alive = true;
  const fire = () => { if (alive) onChange(); };
  let channel: ReturnType<SupabaseClient["channel"]> | null = null;
  try {
    channel = db().channel(`hilo:${threadId}:${Math.random().toString(36).slice(2, 8)}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "thread_events", filter: `thread_id=eq.${threadId}` }, fire)
      .subscribe();
  } catch { channel = null; }
  const poll = setInterval(fire, 30000);
  const onFocus = () => { if (document.visibilityState === "visible") fire(); };
  document.addEventListener("visibilitychange", onFocus);
  return () => {
    alive = false; clearInterval(poll); document.removeEventListener("visibilitychange", onFocus);
    if (channel) void db().removeChannel(channel).catch(() => undefined);
  };
}

/* ───────────── Errores ───────────── */
/** Mensaje claro para cada error de la nube (nunca el texto técnico). */
export function cloudErrorText(e: unknown): string {
  const code = e instanceof api.CloudError ? e.code : "";
  const msg = String((e as { message?: string } | null)?.message ?? "");
  const texts: Record<string, string> = {
    incognito_required: "Para salir como «Anónimo» necesitas Incógnito activo en tu cuenta. Las compras se activarán con App Store y Google Play.",
    replies_closed: "Su autor ha cerrado las respuestas de este Spot.",
    not_a_member: "Ya no formas parte de este chat.",
    blocked: "No puedes hablar con esta persona.",
    rate_limited: "Vas muy rápido. Espera un minuto y vuelve a intentarlo.",
    username_taken: "Ese nombre de usuario ya está cogido. Prueba otro.",
    username_unavailable: "Ese nombre de usuario ya está cogido. Prueba otro.",
    anon_followers: "Un Spot anónimo no puede ser solo para tus seguidores: delataría quién eres.",
    upload_failed: "No se pudo subir el archivo. Comprueba tu conexión e inténtalo de nuevo.",
    not_allowed: "No tienes permiso para hacer esto.",
    not_your_thread: "Eso solo lo puede grabar su dueño.",
    user_not_found: "Esa cuenta ya no existe.",
    invalid_title: "Ponle un nombre al grupo.",
  };
  if (texts[code]) return texts[code]!;
  if (/fetch|network|Failed to|Load failed/i.test(msg) || (typeof navigator !== "undefined" && !navigator.onLine)) return "Sin conexión con Spotly. Inténtalo de nuevo.";
  return "No se pudo completar. Inténtalo de nuevo en unos segundos.";
}
