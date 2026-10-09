import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Camera, Heart, ImageIcon, Loader2, MapPin, Mic, Pause, Play, Share2, Trash2, X, Volume2 } from "lucide-react";
import { toast } from "sonner";
import { VoiceReply } from "./Voice";
import { VoiceWave } from "./VoiceThread";
import { MeAvatar } from "./Author";
import { Cover } from "./Cover";
import { useMe, useStore } from "@/lib/store";
import { api, cloudErrorText, cloudUid, db, fileUrl, getCloud, useCloud } from "@/lib/cloud";
import { formatClock, recorderErrorText, useVoiceRecorder, type VoiceClip } from "@/lib/voice/recorder";
import { onVoiceEnded, pauseVoice, playVoice, stopAllVoices, toggleVoice, useVoicePlayback } from "@/lib/voice/player";
import { profileLink, shareLink } from "@/lib/share";
import valenciaSunset from "@/assets/valencia-sunset.jpg";
import sevilleEvening from "@/assets/spotly-sevilla-noche-ref.jpg";
import stagePhoto from "@/assets/spotly-live-stage.jpg";
import lauraPhoto from "@/assets/spotly-laura.jpg";
import festivalPhoto from "@/assets/spotly-sevilla-festival.jpg";
import beachPhoto from "@/assets/spotly-beach-club.jpg";

/**
 * Historias de 24 horas: tu voz (hasta 60 s) sobre tu foto o un fondo de Spotly.
 *
 * Con la nube se publican de verdad y se ven las de quien sigues y las de tu ciudad (con su audio, que avanza la
 * barra de progreso y pasa a la siguiente al terminar). Responder abre vuestro chat privado. Sin nube, tu historia
 * se queda en este dispositivo durante la sesión y se ven historias de ejemplo, rotuladas.
 */
type StoryItem = {
  id: string; author: { id: string | null; name: string; avatar: string | null; mine: boolean };
  img: string | null; background: string | null; place: string; createdAt: number; live?: boolean;
  audio?: { src: string; durationMs: number; peaks: number[] } | undefined; sample?: boolean; files?: (string | null)[];
};
type StoryGroup = { key: string; author: StoryItem["author"]; items: StoryItem[] };

const SAMPLE_PEOPLE = [
  { name: "Cerca", img: sevilleEvening, live: true, place: "Sevilla", mins: 3 },
  { name: "Ahora", img: stagePhoto, live: true, place: "Madrid", mins: 7 },
  { name: "Alicia", img: lauraPhoto, live: false, place: "Sevilla", mins: 22 },
  { name: "Marcos", img: festivalPhoto, live: false, place: "Sevilla", mins: 60 },
  { name: "Dani", img: beachPhoto, live: false, place: "Valencia", mins: 120 },
  { name: "Marta", img: valenciaSunset, live: false, place: "Valencia", mins: 180 },
];
const sampleGroups: StoryGroup[] = SAMPLE_PEOPLE.map((p) => ({ key: `ejemplo:${p.name}`, author: { id: null, name: p.name, avatar: p.img, mine: false }, items: [{ id: `ejemplo:${p.name}`, author: { id: null, name: p.name, avatar: p.img, mine: false }, img: p.img, background: null, place: p.place, createdAt: Date.now() - p.mins * 60000, live: p.live, sample: true }] }));
const BACKGROUNDS = ["neon", "aurora", "atardecer", "noche", "ondas"] as const;
const agoText = (t: number) => { const m = Math.max(0, Math.round((Date.now() - t) / 60000)); return m < 1 ? "ahora" : m < 60 ? `hace ${m} min` : `hace ${Math.round(m / 60)} h`; };

/* ───────── Almacén de historias ───────── */
let local: StoryItem[] = [];
let cloudItems: StoryItem[] = [];
let loadedAt = 0, loading = false, version = 0;
const listeners = new Set<() => void>();
const emit = () => { version++; listeners.forEach((l) => l()); };
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
const ownFiles = new Map<string, { audio: string; img?: string | undefined }>();
const fromRow = (r: api.StoryRow): StoryItem => ({
  id: r.id, author: { id: r.author_id, name: r.author_name || `@${r.author_username}`, avatar: fileUrl(r.author_avatar), mine: r.mine },
  img: ownFiles.get(r.id)?.img ?? fileUrl(r.media_path), background: r.background, place: r.city, createdAt: Date.parse(r.created_at),
  audio: { src: ownFiles.get(r.id)?.audio ?? fileUrl(r.audio_path) ?? "", durationMs: r.duration_ms, peaks: r.peaks ?? [] }, files: [r.audio_path, r.media_path],
});
async function refresh(force = false) {
  if (loading || (!force && Date.now() - loadedAt < 60000)) return;
  loading = true;
  try { cloudItems = (await api.fetchStories(db())).map(fromRow); loadedAt = Date.now(); emit(); }
  catch { /* sin conexión: se mantiene lo que había */ }
  finally { loading = false; }
}
function useStoryGroups() {
  useSyncExternalStore(subscribe, () => version, () => version);
  const cloud = useCloud();
  const me = useMe();
  useEffect(() => {
    if (!cloud.on) return;
    void refresh(true);
    const t = setInterval(() => void refresh(), 60000);
    return () => clearInterval(t);
  }, [cloud.on, cloud.uid]);
  const items = cloud.on ? cloudItems : local;
  const mine = items.filter((s) => s.author.mine).sort((a, b) => a.createdAt - b.createdAt);
  const byAuthor = new Map<string, StoryItem[]>();
  for (const s of items.filter((x) => !x.author.mine)) byAuthor.set(s.author.id ?? s.author.name, [...(byAuthor.get(s.author.id ?? s.author.name) ?? []), s]);
  const following = getCloud().following;
  const others: StoryGroup[] = [...byAuthor].map(([key, list]) => ({ key, author: list[0]!.author, items: list.sort((a, b) => a.createdAt - b.createdAt) }))
    .sort((a, b) => Number(following.includes(b.key)) - Number(following.includes(a.key)) || Number(b.items[0]!.place === me.city) - Number(a.items[0]!.place === me.city) || b.items[b.items.length - 1]!.createdAt - a.items[a.items.length - 1]!.createdAt);
  /* Mientras haya pocas historias reales, se rellena con las de ejemplo (rotuladas al abrirlas). */
  const groups = others.length >= 3 ? others : [...others, ...sampleGroups];
  return { mine, groups, cloud: cloud.on };
}

/* ───────── Visor ───────── */
function StoryViewer({ groups, startGroup, onClose }: { groups: StoryGroup[]; startGroup: number; onClose: () => void }) {
  const { demo } = useStore();
  const [g, setG] = useState(startGroup);
  const [i, setI] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [liked, setLiked] = useState<string[]>([]);
  const [reply, setReply] = useState(false);
  const group = groups[g]!;
  const s = group.items[Math.min(i, group.items.length - 1)]!;
  const pb = useVoicePlayback(`historia:${s.id}`);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);
  const DURATION = 5000;
  const advance = useCallback((dir: 1 | -1) => {
    setProgress(0); startRef.current = null;
    if (dir === 1 && i < group.items.length - 1) { setI(i + 1); return; }
    if (dir === -1 && i > 0) { setI(i - 1); return; }
    const ng = g + dir;
    if (ng < 0 || ng >= groups.length) { onClose(); return; }
    setG(ng); setI(dir === 1 ? 0 : groups[ng]!.items.length - 1);
  }, [g, i, group.items.length, groups, onClose]);
  /* Con audio: suena al abrirla y la barra sigue al audio; al terminar, pasa a la siguiente. */
  useEffect(() => {
    if (!s.audio?.src || reply) return;
    playVoice(`historia:${s.id}`, s.audio.src, s.audio.durationMs);
    return onVoiceEnded((id) => { if (id === `historia:${s.id}`) advance(1); });
  }, [s.id, s.audio?.src, s.audio?.durationMs, reply, advance]);
  useEffect(() => () => stopAllVoices(), []);
  useEffect(() => {
    if (s.audio?.src) return;
    if (paused || reply) { if (rafRef.current) cancelAnimationFrame(rafRef.current); return; }
    const tick = (now: number) => {
      if (!startRef.current) startRef.current = now;
      const p = Math.min((now - startRef.current) / DURATION, 1);
      setProgress(p);
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
      else advance(1);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [s.id, s.audio?.src, paused, reply, advance]);
  const shown = s.audio?.src ? (pb.durationMs ? Math.min(1, pb.positionMs / pb.durationMs) : 0) : progress;
  const hold = (down: boolean) => {
    setPaused(down);
    if (!s.audio?.src) { if (!down) startRef.current = null; return; }
    if (down) pauseVoice(); else if (!reply) toggleVoice(`historia:${s.id}`, s.audio.src, s.audio.durationMs);
  };
  const remove = () => {
    if (!s.author.mine) return;
    stopAllVoices();
    if (s.sample || !cloudUid()) { local = local.filter((x) => x.id !== s.id); emit(); toast("Historia eliminada"); onClose(); return; }
    cloudItems = cloudItems.filter((x) => x.id !== s.id); emit();
    void api.deleteStory(db(), s.id, s.files ?? []).then(() => toast("Historia eliminada")).catch((e) => { toast.error(cloudErrorText(e)); void refresh(true); });
    onClose();
  };
  const share = () => {
    if (s.sample) { toast("Historia de ejemplo: no tiene enlace."); return; }
    const username = s.author.mine ? getCloud().profile?.username : undefined;
    void shareLink({ title: `Historia de ${s.author.name} en Spotly`, url: username ? profileLink(username) : null });
  };
  return (
    <div className="fixed inset-0 z-[80] mx-auto flex max-w-[520px] flex-col bg-black" onPointerDown={() => hold(true)} onPointerUp={() => hold(false)}>
      {/* Barras progreso */}
      <div className="absolute inset-x-3 flex gap-1" style={{ top: "max(0.5rem, env(safe-area-inset-top))", zIndex: 3 }}>
        {group.items.map((it, k) => (
          <div key={it.id} className="h-[0.1875rem] flex-1 overflow-hidden rounded-full bg-white/30">
            <div className="h-full rounded-full bg-white" style={{ width: k < i ? "100%" : k === i ? `${shown * 100}%` : "0%", transition: "none" }} />
          </div>
        ))}
      </div>
      {/* Header usuario */}
      <div className="absolute inset-x-3 flex items-center gap-2.5" style={{ top: "max(1.5rem, calc(env(safe-area-inset-top) + 0.75rem))", zIndex: 3 }}>
        {s.author.mine ? <MeAvatar className="h-9 w-9 ring-2 ring-white/60 text-xs" /> : s.author.avatar ? <img src={s.author.avatar} alt={s.author.name} className="h-9 w-9 rounded-full object-cover ring-2 ring-white/60" /> : <span className="grid h-9 w-9 place-items-center rounded-full bg-spot-gradient text-xs font-bold text-white ring-2 ring-white/60">{(s.author.name.replace("@", "")[0] ?? "?").toUpperCase()}</span>}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold leading-none text-white">{s.author.mine ? "Tu historia" : s.author.name}{s.sample && !demo && <span className="ml-1.5 rounded-full border border-white/40 px-1.5 text-4xs font-normal">ejemplo</span>}</p>
          <p className="text-2xs text-white/70">{s.place || "Spotly"} · {agoText(s.createdAt)}</p>
        </div>
        {s.live && demo && <span className="rounded-md bg-live px-2 py-0.5 text-3xs font-bold text-white">LIVE</span>}
        {s.author.mine && <button onPointerDown={(e) => e.stopPropagation()} onClick={remove} aria-label="Eliminar tu historia" className="grid h-8 w-8 place-items-center rounded-full bg-black/40 text-white"><Trash2 size={16} /></button>}
        <button onPointerDown={(e) => e.stopPropagation()} onClick={onClose} aria-label="Cerrar" className="grid h-8 w-8 place-items-center rounded-full bg-black/40 text-white"><X size={18} /></button>
      </div>
      {/* Foto o fondo de Spotly a pantalla completa, con la onda de la voz encima */}
      {s.img ? <img src={s.img} alt="" className="absolute inset-0 h-full w-full object-cover" /> : <Cover cover={s.background ?? "preset:neon"} className="absolute inset-0 h-full w-full" />}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/40" />
      {s.audio && <div className="pointer-events-none absolute inset-x-6 top-1/2 -translate-y-1/2" style={{ zIndex: 1 }}><VoiceWave peaks={s.audio.peaks.length ? s.audio.peaks : Array.from({ length: 40 }, (_, k) => 0.2 + ((k * 37) % 60) / 100)} progress={shown} playhead={pb.active} className="h-16" /><p className="mt-2 text-center text-xs font-semibold tabular-nums text-white/80">{pb.loading ? <Loader2 size={14} className="inline animate-spin" /> : formatClock(pb.active ? pb.positionMs : s.audio.durationMs)}</p></div>}
      {/* Toque prev / next */}
      <button onClick={(e) => { e.stopPropagation(); advance(-1); }} aria-label="Anterior" className="absolute left-0 top-0 h-full w-1/3" style={{ zIndex: 2 }} />
      <button onClick={(e) => { e.stopPropagation(); advance(1); }} aria-label="Siguiente" className="absolute right-0 top-0 h-full w-1/3" style={{ zIndex: 2 }} />
      {/* Acciones derecha */}
      <div className="absolute bottom-28 right-3 flex flex-col items-center gap-5" style={{ zIndex: 3 }} onPointerDown={(e) => e.stopPropagation()}>
        {s.sample && <button onClick={() => setLiked((l) => (l.includes(s.id) ? l.filter((x) => x !== s.id) : [...l, s.id]))} aria-pressed={liked.includes(s.id)} className="flex flex-col items-center gap-1">
          <Heart size={28} className={liked.includes(s.id) ? "text-accent" : "text-white"} fill={liked.includes(s.id) ? "currentColor" : "none"} />
          <span className="text-xs font-bold text-white">Me gusta</span>
        </button>}
        {s.audio && <button onClick={() => toggleVoice(`historia:${s.id}`, s.audio!.src, s.audio!.durationMs)} aria-label={pb.playing ? "Pausar la historia" : "Escuchar la historia"} className="flex flex-col items-center gap-1">
          {pb.playing ? <Pause size={26} className="text-white" /> : <Volume2 size={26} className="text-white" />}
          <span className="text-xs font-bold text-white">{pb.playing ? "Pausa" : "Escuchar"}</span>
        </button>}
        {!s.author.mine && <button onClick={() => setReply(true)} aria-label={`Responder a la historia de ${s.author.name} con tu voz`} className="flex flex-col items-center gap-1">
          <Mic size={26} className="text-white" />
          <span className="text-xs font-bold text-white">Voz</span>
        </button>}
        <button onClick={share} className="flex flex-col items-center gap-1">
          <Share2 size={26} className="text-white" />
          <span className="text-xs font-bold text-white">Enviar</span>
        </button>
      </div>
      {/* Chip lugar */}
      <div className="absolute bottom-[5.5rem] left-3" style={{ zIndex: 3 }}>
        <span className="flex items-center gap-1.5 rounded-full bg-black/55 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm"><MapPin size={12} />{s.place || "Spotly"}</span>
      </div>
      {/* Footer respuesta voz */}
      {!s.author.mine && <div className="absolute inset-x-0 bottom-0 flex items-center gap-3 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3" style={{ zIndex: 3 }} onPointerDown={(e) => e.stopPropagation()}>
        <button onClick={() => setReply(true)} aria-label={`Responder a la historia de ${s.author.name} con tu voz`} className="grid h-12 w-12 shrink-0 place-items-center rounded-full shadow-glow" style={{ background: "linear-gradient(135deg,#7c3aed,#3b82f6)" }}>
          <Mic size={22} className="text-white" />
        </button>
        <button onClick={() => setReply(true)} className="flex-1 rounded-full border border-white/30 bg-white/10 px-4 py-2.5 text-left text-sm text-white/60 backdrop-blur-sm">Responde con tu voz…</button>
      </div>}
      {reply && <div onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()}><VoiceReply name={s.author.name} mode="message" toUserId={s.author.id} onClose={() => setReply(false)} /></div>}
    </div>
  );
}

/* ───────── Crear historia ───────── */
function CreateStorySheet({ onClose }: { onClose: () => void }) {
  const me = useMe();
  const cloud = useCloud();
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [bg, setBg] = useState<string>("neon");
  const [photo, setPhoto] = useState<{ blob: Blob; url: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const rec = useVoiceRecorder({ maxSeconds: 60 });
  const pb = useVoicePlayback("historia-nueva");
  const gallery = useRef<HTMLInputElement | null>(null);
  const camera = useRef<HTMLInputElement | null>(null);
  useEffect(() => { if (rec.error) toast.error(recorderErrorText(rec.error, 60)); }, [rec.error]);
  useEffect(() => { if (rec.state === "recorded") setStep(2); }, [rec.state]);
  useEffect(() => () => { stopAllVoices(); }, []);
  const urlRef = useRef<string | null>(null);
  useEffect(() => () => { if (urlRef.current) URL.revokeObjectURL(urlRef.current); }, []);
  const pick = (f?: File | null) => {
    if (!f) return;
    if (!f.type.startsWith("image/") || f.size > 15 * 1024 * 1024) { toast.error("Elige una foto de hasta 15 MB."); return; }
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    const url = URL.createObjectURL(f); urlRef.current = url;
    setPhoto({ blob: f, url });
  };
  const publish = async () => {
    const clip = rec.clip;
    if (!clip || busy) return;
    stopAllVoices();
    const uid = cloudUid();
    if (!uid) {
      local = [...local, { id: `local-${Date.now()}`, author: { id: null, name: me.name, avatar: me.avatar, mine: true }, img: photo?.url ?? null, background: photo ? null : `preset:${bg}`, place: me.city, createdAt: Date.now(), audio: { src: clip.url, durationMs: clip.durationMs, peaks: clip.peaks } }];
      if (photo) urlRef.current = null; // la historia se queda con la foto
      rec.take(); emit();
      toast.success("Historia guardada en este móvil durante esta sesión");
      onClose(); return;
    }
    setBusy(true);
    try {
      const r = await api.publishStory(db(), uid, { city: me.city, audio: clip.blob, audioMime: clip.mimeType, durationMs: clip.durationMs, peaks: clip.peaks, photo: photo?.blob, background: `preset:${bg}` });
      ownFiles.set(r.id, { audio: clip.url, img: photo?.url });
      if (photo) urlRef.current = null;
      rec.take();
      await refresh(true);
      toast.success("¡Historia publicada! Visible 24 h");
      onClose();
    } catch (e) { toast.error(cloudErrorText(e)); setBusy(false); }
  };
  const clip: VoiceClip | null = rec.state === "recorded" ? rec.clip : null;
  const recording = rec.state === "recording";
  const live = Array.from({ length: 18 }, (_, k) => rec.live[rec.live.length - 18 + k]);
  return (
    <div className="fixed inset-0 z-[85] mx-auto flex max-w-[520px] flex-col bg-black">
      <input ref={gallery} type="file" accept="image/*" className="hidden" aria-label="Elegir una foto de la galería" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
      <input ref={camera} type="file" accept="image/*" capture="environment" className="hidden" aria-label="Hacer una foto" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
      <div className="absolute inset-x-3 flex items-center justify-between" style={{ top: "max(1rem, env(safe-area-inset-top))", zIndex: 2 }}>
        <span className="text-base font-bold text-white">Nueva historia</span>
        <button onClick={onClose} aria-label="Cerrar" className="grid h-10 w-10 place-items-center rounded-full bg-black/50 text-white backdrop-blur-sm"><X size={20} /></button>
      </div>
      {/* Fondo seleccionado */}
      {photo ? <img src={photo.url} alt="" className="absolute inset-0 h-full w-full object-cover opacity-70" /> : <Cover cover={`preset:${bg}`} className="absolute inset-0 h-full w-full opacity-80" />}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-black/50" />
      {/* Fondos: tu foto o uno de Spotly */}
      {step === 0 && (
        <div className="absolute inset-x-3 bottom-36 flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none", zIndex: 2 }}>
          <button onClick={() => gallery.current?.click()} aria-label="Usar una foto de tu galería" className={`grid h-16 w-12 shrink-0 place-items-center overflow-hidden rounded-lg border-2 bg-black/40 text-white ${photo ? "border-white" : "border-white/40"}`}>{photo ? <img src={photo.url} alt="" className="h-full w-full object-cover" /> : <ImageIcon size={18} />}</button>
          <button onClick={() => camera.current?.click()} aria-label="Hacer una foto" className="grid h-16 w-12 shrink-0 place-items-center rounded-lg border-2 border-white/40 bg-black/40 text-white"><Camera size={18} /></button>
          {BACKGROUNDS.map((b) => (
            <button key={b} onClick={() => { setPhoto(null); setBg(b); }} aria-label={`Fondo ${b}`} className={`h-16 w-12 shrink-0 overflow-hidden rounded-lg border-2 ${!photo && bg === b ? "border-white" : "border-transparent opacity-60"}`}>
              <Cover cover={`preset:${b}`} className="block h-full w-full" />
            </button>
          ))}
        </div>
      )}
      {/* Acciones por step */}
      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-3 pb-[max(2rem,env(safe-area-inset-bottom))] pt-4" style={{ zIndex: 2 }}>
        {step === 0 && <>
          <button onClick={() => setStep(1)} aria-label="Grabar tu historia" className="spot-pulse grid h-20 w-20 place-items-center rounded-full shadow-glow" style={{ background: "linear-gradient(135deg,#7c3aed,#3b82f6)" }}>
            <Mic size={36} className="text-white" />
          </button>
          <span className="text-sm text-white/70">Pulsa y cuenta qué está pasando</span>
        </>}
        {step === 1 && <>
          <p className="text-lg font-bold text-white">{recording ? "Grabando…" : rec.state === "requesting" ? "Permite el micrófono…" : "Mantén para grabar"}</p>
          <div className="flex h-10 items-center gap-[0.125rem]" aria-hidden="true">{live.map((v, k) => v === undefined ? <span key={k} className="h-1 w-1 rounded-full bg-white/35" /> : <span key={k} className="w-1 rounded-full bg-white/80" style={{ height: `${Math.round(Math.max(0.1, Math.min(1, v * 9)) * 100)}%` }} />)}</div>
          <button
            onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); void rec.start(); }}
            onPointerUp={() => { if (recording || rec.state === "requesting") rec.stop(); }}
            onPointerCancel={() => { if (recording) rec.stop(); }}
            onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && !e.repeat) { e.preventDefault(); if (recording) rec.stop(); else void rec.start(); } }}
            aria-label={recording ? "Suelta para terminar" : "Mantén pulsado para grabar"}
            className="grid h-24 w-24 touch-none place-items-center rounded-full shadow-glow transition-transform active:scale-110"
            style={{ background: recording ? "#ef4444" : "linear-gradient(135deg,#7c3aed,#3b82f6)" }}>
            <Mic size={44} className="text-white" />
          </button>
          <span className="text-xs tabular-nums text-white/60">{recording ? `${formatClock(rec.elapsedMs)} / 1:00 · suelta para terminar` : "Pulsa y mantén · máx. 1 min"}</span>
        </>}
        {step === 2 && clip && <>
          <button onClick={() => toggleVoice("historia-nueva", clip.url, clip.durationMs)} aria-label={pb.playing ? "Pausar tu historia" : "Escuchar tu historia"} className="flex w-[min(20rem,85%)] items-center gap-3 rounded-2xl bg-black/60 px-4 py-3 backdrop-blur-sm">
            {pb.playing ? <Pause size={18} className="shrink-0 text-white" fill="currentColor" /> : <Play size={18} className="shrink-0 text-white" fill="currentColor" />}
            <VoiceWave peaks={clip.peaks} progress={pb.active ? pb.positionMs / clip.durationMs : 0} playhead={pb.active} className="h-8 flex-1" />
            <span className="shrink-0 text-sm tabular-nums text-white/70">{formatClock(pb.active ? pb.positionMs : clip.durationMs)}</span>
          </button>
          <p className="text-sm text-white/60">Tu historia · {me.city || "Spotly"} · 24 h</p>
          <div className="w-full space-y-2 px-4">
            <button onClick={() => void publish()} disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-base font-bold text-white disabled:opacity-60" style={{ background: "linear-gradient(135deg,#7c3aed,#3b82f6)" }}>
              {busy && <Loader2 size={18} className="animate-spin" />}{cloud.on ? "Publicar historia" : "Guardar historia"}
            </button>
            <button onClick={() => { stopAllVoices(); rec.discard(); setStep(1); }} disabled={busy} className="w-full rounded-full border border-white/30 py-3 text-sm text-white/70">Volver a grabar</button>
          </div>
        </>}
      </div>
    </div>
  );
}

/* ───────── Tira de historias ───────── */
export function StoriesStrip() {
  const { mine, groups } = useStoryGroups();
  const { demo } = useStore();
  const [viewed, setViewed] = useState<string[]>([]);
  const [viewer, setViewer] = useState<{ groups: StoryGroup[]; start: number } | null>(null);
  const [creating, setCreating] = useState(false);
  const me = useMe();
  const myGroup = useMemo<StoryGroup | null>(() => (mine.length ? { key: "yo", author: { id: null, name: me.name, avatar: me.avatar, mine: true }, items: mine } : null), [mine, me.name, me.avatar]);
  return (
    <>
      <div className="flex gap-3 overflow-x-auto px-3 pb-2 pt-1 scrollbar-none" style={{ scrollbarWidth: "none" }}>
        <div className="relative flex shrink-0 flex-col items-center gap-1.5">
          <button onClick={() => (myGroup ? setViewer({ groups: [myGroup], start: 0 }) : setCreating(true))} aria-label={myGroup ? "Ver tu historia" : "Crear tu historia"} className={`grid h-16 w-16 place-items-center rounded-full ${myGroup ? "bg-spot-gradient p-[0.15625rem]" : "border-2 border-dashed border-primary/60 bg-secondary"}`}>
            <MeAvatar className={`h-full w-full text-xl ${myGroup ? "" : "opacity-60"}`} />
          </button>
          <button onClick={() => setCreating(true)} aria-label={myGroup ? "Crear otra historia" : "Crear tu historia"} className="absolute right-0 top-11 grid h-5 w-5 place-items-center rounded-full bg-primary text-primary-foreground shadow"><svg viewBox="0 0 16 16" className="h-3 w-3 fill-current" aria-hidden="true"><path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg></button>
          <span className="text-2xs text-muted-foreground">Tu historia</span>
        </div>
        {groups.map((p, i) => {
          const seen = viewed.includes(p.key);
          /* «LIVE» solo en las historias de ejemplo de la demostración: no hay directos de verdad. */
          const live = demo && p.items.some((x) => x.live);
          const cover = p.author.avatar ?? p.items[0]!.img;
          return (
            <button key={p.key} onClick={() => { setViewed((v) => [...v, p.key]); setViewer({ groups, start: i }); }} className="flex shrink-0 flex-col items-center gap-1.5" aria-label={`Historia de ${p.author.name}`}>
              <span className={`relative h-16 w-16 rounded-full p-[0.15625rem] ${seen ? "bg-secondary" : "bg-spot-gradient"}`}>
                {cover ? <img src={cover} alt={p.author.name} className="h-full w-full rounded-full object-cover" /> : <span className="grid h-full w-full place-items-center rounded-full bg-card text-lg font-bold">{(p.author.name.replace("@", "")[0] ?? "?").toUpperCase()}</span>}
                {live && !seen && <span className="absolute -top-0.5 left-1/2 -translate-x-1/2 rounded-full bg-live px-1.5 py-0 text-4xs font-bold leading-4 text-white">LIVE</span>}
              </span>
              <span className={`max-w-16 truncate text-2xs ${seen ? "text-muted-foreground" : "font-semibold"}`}>{p.author.name}</span>
            </button>
          );
        })}
      </div>
      {viewer && <StoryViewer groups={viewer.groups} startGroup={viewer.start} onClose={() => setViewer(null)} />}
      {creating && <CreateStorySheet onClose={() => setCreating(false)} />}
    </>
  );
}
