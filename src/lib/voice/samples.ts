/**
 * Voces de ejemplo para el modo demostración (sin audio): se convierten al mismo formato que las voces reales para
 * que el hilo, las respuestas encadenadas y los contadores funcionen igual. Van marcadas como `sample` y la interfaz
 * las rotula «ejemplo»; al conectar el backend se sustituyen por las voces de la conversación real.
 */
import { clockToMs, type VoiceNote } from "./notes";
import { seededPeaks } from "./recorder";

export type SampleVoice = { key: string; name: string; img?: string | undefined; minsAgo: number; dur: string; likes: number; verified?: boolean | undefined; anon?: boolean | undefined; replyTo?: string | undefined; replyAt?: string | undefined };

const cache = new Map<string, VoiceNote[]>();

/** Hilo de ejemplo estable (mismas ids y misma forma de onda en cada render) para `threadId`. */
export function sampleThread(threadId: string, list: SampleVoice[]): VoiceNote[] {
  const hit = cache.get(threadId);
  if (hit) return hit;
  const now = Date.now();
  const notes: VoiceNote[] = list.map((v) => ({
    id: `${threadId}#${v.key}`,
    threadId,
    parentId: v.replyTo ? `${threadId}#${v.replyTo}` : null,
    replyAtMs: v.replyAt ? clockToMs(v.replyAt) : undefined,
    author: { name: v.name, avatar: v.img, verified: v.verified, anon: v.anon },
    createdAt: now - v.minsAgo * 60_000,
    durationMs: clockToMs(v.dur),
    peaks: seededPeaks(`${threadId}#${v.key}`),
    likes: v.likes,
    sample: true,
  }));
  cache.set(threadId, notes);
  return notes;
}
