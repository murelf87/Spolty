/**
 * Comunidades y eventos cuando no hay nube (demostración o sin cuenta): los que creas, a cuáles te unes y a qué
 * eventos vas se guardan en este dispositivo. Su voz (presentación de la comunidad, audio-flyer del evento y las
 * conversaciones) va por las voces normales (lib/voice/notes.ts). Con la nube se usa la API (lib/cloud/api.ts).
 */
import { useSyncExternalStore } from "react";

export type LocalCommunity = { id: string; name: string; topic: string; city: string; createdAt: number };
export type LocalEvent = { id: string; title: string; place: string; city: string; startsAt: string; createdAt: number };
type Saved = { communities: LocalCommunity[]; joined: string[]; events: LocalEvent[]; going: string[] };

const KEY = "spotly-comunidades-eventos";
const empty: Saved = { communities: [], joined: [], events: [], going: [] };
let state: Saved = empty;
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "null") as Partial<Saved> | null;
    if (raw) state = { communities: raw.communities ?? [], joined: raw.joined ?? [], events: raw.events ?? [], going: raw.going ?? [] };
  } catch { /* sin almacenamiento: dura la sesión */ }
}
function set(next: Saved) {
  state = next;
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* sin almacenamiento: dura la sesión */ }
  listeners.forEach((l) => l());
}
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
const get = () => { load(); return state; };

export function useLocalGatherings() { return useSyncExternalStore(subscribe, get, () => empty); }
const id = () => (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`);

export function addLocalCommunity(c: Omit<LocalCommunity, "id" | "createdAt">): LocalCommunity {
  const s = get();
  const created = { ...c, id: `local-${id()}`, createdAt: Date.now() };
  set({ ...s, communities: [created, ...s.communities], joined: [...s.joined, created.id] });
  return created;
}
export const localNameTaken = (name: string) => get().communities.some((c) => c.name.toLowerCase() === name.trim().toLowerCase());
export function toggleLocalJoined(key: string) { const s = get(); set({ ...s, joined: s.joined.includes(key) ? s.joined.filter((k) => k !== key) : [...s.joined, key] }); }
export function addLocalEvent(e: Omit<LocalEvent, "id" | "createdAt">): LocalEvent {
  const s = get();
  const created = { ...e, id: `local-${id()}`, createdAt: Date.now() };
  set({ ...s, events: [created, ...s.events], going: [...s.going, created.id] });
  return created;
}
export function removeLocalEvent(eventId: string) { const s = get(); set({ ...s, events: s.events.filter((e) => e.id !== eventId), going: s.going.filter((g) => g !== eventId) }); }
export function toggleLocalGoing(key: string) { const s = get(); set({ ...s, going: s.going.includes(key) ? s.going.filter((k) => k !== key) : [...s.going, key] }); }
