/**
 * Estado global de Spotly (cliente).
 *
 * Centraliza lo que varias pantallas comparten: créditos, Incógnito,
 * verificación de identidad, permisos, conectividad y lo que crea el negocio
 * (campaña, oferta flash, disponibilidad). Está pensado para sustituirse por
 * llamadas a la API (ver docs/BACKEND_CONTRACT.md) manteniendo esta interfaz.
 */
import { useEffect, useState, useSyncExternalStore } from "react";
import { commerce, eurToCredits, incognitoOptions, type Precision } from "./spotlyConfig";

export type TxKind = "purchase" | "spend" | "bonus" | "refund";
export type Tx = { id: string; label: string; amount: number; kind: TxKind; when: string };
export type IdTier = "basic" | "premium" | "creator";
export type IdentityStatus = "none" | "pending" | "review" | "approved" | "rejected" | "invalid" | "duplicate";
export type Incognito = { active: boolean; until: number | null; permanent: boolean; protectVoice: boolean; precision: Precision; onExpire: "archive" | "hide" | "keep" };
export type Campaign = { id: string; radiusId: string; from: string; to: string; days: string[]; budgetPerDay: number; totalDays: number; message: string; status: "active" | "paused" | "exhausted" | "ended"; startedAt: number };
export type FlashOffer = { id: string; title: string; discount: number; endsAt: number };
export type Availability = { on: boolean; slots: number; until: number; radiusKm: number };
export type Report = { id: string; what: string; reason: string; status: "review" | "resolved" | "removed"; when: string };

type State = {
  credits: number;
  history: Tx[];
  incognito: Incognito;
  identity: IdentityStatus;
  idTier: IdTier;
  perms: { location: boolean; mic: boolean; camera: boolean; notifications: boolean };
  offline: boolean;
  bizCampaign: Campaign | null;
  bizOffers: FlashOffer[];
  bizAvailability: Availability | null;
  profilePromo: { active: boolean; endsAt: number; intensity: string } | null;
  topNow: { title: string; endsAt: number }[];
  blocked: string[];
  reports: Report[];
  confirmed: string[];
  following: string[];
  incognitoNote: string | null;
};

let state: State = {
  credits: 250,
  history: [
    { id: "t1", label: "Recarga 💎 550 diamantes", amount: 550, kind: "purchase", when: "Hace 3 días" },
    { id: "t2", label: "Impulso x2 · Feria de Triana", amount: -99, kind: "spend", when: "Hace 2 días" },
    { id: "t3", label: "Bono de bienvenida", amount: 100, kind: "bonus", when: "Hace 3 días" },
    { id: "t4", label: "Ajuste: impulso interrumpido", amount: 49, kind: "refund", when: "Ayer" },
    { id: "t5", label: "Incógnito 1 hora", amount: -59, kind: "spend", when: "Ayer" },
  ],
  incognito: { active: false, until: null, permanent: false, protectVoice: true, precision: "approx", onExpire: "keep" },
  identity: "none",
  idTier: "basic",
  perms: { location: true, mic: true, camera: true, notifications: true },
  offline: false,
  bizCampaign: null,
  bizOffers: [],
  bizAvailability: null,
  profilePromo: null,
  topNow: [],
  blocked: ["Usuario_spam23", "Pedro R.", "Fiesta Promo SL"],
  reports: [
    { id: "r1", what: "Spot de @promo_gratis", reason: "Spam o engaño", status: "removed", when: "Hace 4 días" },
    { id: "r2", what: "Audio de @anon_4821", reason: "Acoso o insultos", status: "review", when: "Ayer" },
  ],
  confirmed: [],
  following: [],
  incognitoNote: null,
};

const listeners = new Set<() => void>();
export const getState = () => state;
export function setState(patch: Partial<State> | ((s: State) => Partial<State>)) {
  state = { ...state, ...(typeof patch === "function" ? patch(state) : patch) };
  listeners.forEach((l) => l());
}
const subscribe = (l: () => void) => (listeners.add(l), () => listeners.delete(l));
export function useStore() {
  return useSyncExternalStore(subscribe, getState, getState);
}

let seq = 0;
const id = () => `x${Date.now().toString(36)}${seq++}`;

/* ---------- Créditos ---------- */
export function addCredits(amount: number, label: string, kind: TxKind = "purchase") {
  setState((s) => ({ credits: s.credits + amount, history: [{ id: id(), label, amount, kind, when: "Ahora" }, ...s.history] }));
}
/** Devuelve false si no hay saldo suficiente (nunca deja saldo negativo). */
export function spendCredits(amount: number, label: string): boolean {
  if (state.credits < amount) return false;
  setState((s) => ({ credits: s.credits - amount, history: [{ id: id(), label, amount: -amount, kind: "spend", when: "Ahora" }, ...s.history] }));
  return true;
}
export const canAfford = (eurPrice: number) => state.credits >= eurToCredits(eurPrice);

/* ---------- Incógnito ---------- */
export function startIncognito(optId: string, patch?: Partial<Incognito>) {
  const opt = incognitoOptions.find((o) => o.id === optId);
  if (!opt) return;
  setState((s) => ({ incognito: { ...s.incognito, ...patch, active: true, permanent: opt.minutes === null, until: opt.minutes === null ? null : Date.now() + opt.minutes * 60_000 }, incognitoNote: null }));
}
export function extendIncognito(optId: string) {
  const opt = incognitoOptions.find((o) => o.id === optId);
  if (!opt || opt.minutes === null) return;
  setState((s) => ({ incognito: { ...s.incognito, active: true, until: Math.max(s.incognito.until ?? Date.now(), Date.now()) + opt.minutes! * 60_000 } }));
}
export function stopIncognito(expired = false) {
  setState((s) => ({
    incognito: { ...s.incognito, active: false, until: null, permanent: false },
    incognitoNote: expired ? "Tu Incógnito ha terminado. Tu identidad NO se ha revelado: solo tú decides si mostrarla." : null,
  }));
}
export const setIncognito = (p: Partial<Incognito>) => setState((s) => ({ incognito: { ...s.incognito, ...p } }));
/** Para la demo: acorta el Incógnito activo para poder ver el aviso de fin. */
export function demoShortenIncognito(minutes = 9) {
  setState((s) => (s.incognito.active ? { incognito: { ...s.incognito, permanent: false, until: Date.now() + minutes * 60_000 } } : {}));
}

/* ---------- Verificación / permisos / red ---------- */
export const setIdTier = (idTier: IdTier) => setState({ idTier });
export const setIdentity = (identity: IdentityStatus) => setState({ identity });
export const setPerm = (k: keyof State["perms"], v: boolean) => setState((s) => ({ perms: { ...s.perms, [k]: v } }));
export const setOffline = (offline: boolean) => setState({ offline });
/** Una cuenta solo es plenamente operativa con identidad aprobada. */
export const isVerified = () => state.identity === "approved";

/* ---------- Social ---------- */
export const toggleFollow = (name: string) => setState((s) => ({ following: s.following.includes(name) ? s.following.filter((n) => n !== name) : [...s.following, name] }));
export const toggleConfirm = (hotId: string) => setState((s) => ({ confirmed: s.confirmed.includes(hotId) ? s.confirmed.filter((n) => n !== hotId) : [...s.confirmed, hotId] }));
export const blockUser = (name: string) => setState((s) => ({ blocked: s.blocked.includes(name) ? s.blocked : [name, ...s.blocked] }));
export const unblockUser = (name: string) => setState((s) => ({ blocked: s.blocked.filter((n) => n !== name) }));
export const addReport = (what: string, reason: string) => setState((s) => ({ reports: [{ id: id(), what, reason, status: "review", when: "Ahora" }, ...s.reports] }));

/* ---------- Negocio ---------- */
export const setCampaign = (c: Campaign | null) => setState({ bizCampaign: c });
export const addOffer = (o: Omit<FlashOffer, "id">) => setState((s) => ({ bizOffers: [{ ...o, id: id() }, ...s.bizOffers] }));
export const removeOffer = (oid: string) => setState((s) => ({ bizOffers: s.bizOffers.filter((o) => o.id !== oid) }));
export const setAvailability = (a: Availability | null) => setState({ bizAvailability: a });
export const setProfilePromo = (p: State["profilePromo"]) => setState({ profilePromo: p });
export const addTopNow = (title: string, minutes: number) => setState((s) => ({ topNow: [{ title, endsAt: Date.now() + minutes * 60_000 }, ...s.topNow] }));

/* ---------- Tiempo ---------- */
/** Reloj compartido. Empieza en 0 para no romper la hidratación (SSR). */
export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(0);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}
export function fmtRemaining(ms: number) {
  if (ms <= 0) return "0:00";
  const s = Math.floor(ms / 1000), d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  if (d > 0) return `${d} d ${h} h`;
  if (h > 0) return `${h} h ${String(m).padStart(2, "0")} min`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}
export { commerce };
