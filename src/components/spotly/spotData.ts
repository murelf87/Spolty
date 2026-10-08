/**
 * Un Spot tal como lo pintan el feed, el detalle y los perfiles: los de ejemplo (sin audio), los tuyos guardados en
 * el dispositivo y los de la nube (con autor, me gusta y respuestas reales).
 */
import type { MySpot } from "@/lib/spots";
import { formatClock } from "@/lib/voice/recorder";

export type SpotData = { id: string; name: string; handle?: string | undefined; city: string; province?: string; ago: string; img: string; tag: string; tagLive?: boolean; dist: string; text: string; dur: string; likes: number; replies?: number; shares?: number; hashtag?: string; tags?: string[]; verified?: boolean; boosted?: boolean; incognito?: boolean; own?: boolean;
  /** Audio real (tus Spots y los de la nube); los de ejemplo no tienen. */ audio?: MySpot["audio"] | undefined; /** Vídeo real del Spot. */ video?: string | undefined;
  /** Spot de la nube: autor real (id y foto), tu me gusta y si admite respuestas. */ cloud?: boolean; authorId?: string | null | undefined; avatar?: string | null | undefined; liked?: boolean; saved?: boolean; repliesAllowed?: boolean };

/** Etiqueta del Spot según su tema. */
export const TOPIC_TAG: Record<string, string> = { "¿Qué está pasando?": "Cotilleo", Planes: "Planes", Música: "Música", Comida: "Comida", Opiniones: "Opinión", "Algo que contar": "Historia" };
export const agoOf = (t: number) => { const m = Math.max(0, Math.round((Date.now() - t) / 60000)); return m < 1 ? "Ahora" : m < 60 ? `${m} min` : m < 1440 ? `${Math.round(m / 60)} h` : `${Math.round(m / 1440)} d`; };
/** Un Spot real (tuyo o de la nube) en el formato del feed: título, voz, foto o vídeo (sin foto, la tarjeta pinta su
 *  onda) y, en la nube, autor, me gusta y respuestas de verdad. */
export const spotData = (m: MySpot, myName = "Tú"): SpotData => {
  const c = m.cloud, own = c ? c.mine : true;
  return {
    id: m.id, name: own ? myName : m.anon ? "Anónimo" : c!.author.name, handle: c?.author.username ?? undefined, avatar: c?.author.avatar, authorId: c?.author.id ?? null,
    city: m.city, ago: agoOf(m.createdAt), img: m.media?.kind === "photo" ? m.media.src : "", video: m.media?.kind === "video" ? m.media.src : undefined,
    tag: m.happeningNow ? "Está pasando" : own ? "Tuyo" : "Spot", tagLive: m.happeningNow, dist: m.zone || m.city, text: m.title, dur: formatClock(m.audio.durationMs),
    likes: c?.likes ?? 0, liked: c?.liked ?? false, replies: c?.replies ?? 0, shares: 0, hashtag: TOPIC_TAG[m.topic] ?? "Spot", tags: [m.city, m.zone].filter((x, i, a) => x && a.indexOf(x) === i),
    boosted: m.boosted, incognito: m.anon, own, audio: m.audio, cloud: !!c, saved: c?.saved ?? false, repliesAllowed: m.repliesAllowed,
  };
};

