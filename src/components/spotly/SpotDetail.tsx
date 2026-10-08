import { useState, useRef, useEffect, useMemo } from "react";
import { ChevronLeft, Bookmark, Check, ChevronRight, Heart, ListMusic, MapPin, Mic, MoreHorizontal, Pause, Play, RotateCcw, RotateCw, Share2, UserPlus, X, AlignJustify, Music, Map, Flag, BellOff, Navigation } from "lucide-react";
import { toast } from "sonner";
import { NewFollowers } from "./LocalAd";
import { useApp } from "./app-context";
import { BottomSheet } from "./kit";
import { MediaViewer } from "./MediaViewer";
import { sampleMedia } from "@/lib/media";
import { addReport, toggleFollow, useStore, useMe } from "@/lib/store";
import { VoiceReply } from "./Voice";
import { TalkBar, VoiceComposer, VoiceItem, VoiceThread, type ReplyTarget } from "./VoiceThread";
import { addVoiceNote, clockToMs, useThread } from "@/lib/voice/notes";
import { sampleThread, type SampleVoice } from "@/lib/voice/samples";
import { formatClock } from "@/lib/voice/recorder";
import { playVoiceQueue, seekVoice, toggleVoice, useVoicePlayback } from "@/lib/voice/player";
import { AnonAvatar, MeAvatar } from "./Author";
import { Button } from "@/components/ui/button";
import festival from "@/assets/spotly-sevilla-festival.jpg";
import stage from "@/assets/spotly-live-stage.jpg";
import beach from "@/assets/spotly-beach-club.jpg";
import lauraPhoto from "@/assets/spotly-laura.jpg";

/* ── Waveform coloreada igual que el mockup ── */
function ColorWave({ active, big = false }: { active: boolean; big?: boolean }) {
  const count = big ? 38 : 26;
  return (
    <div className={`flex items-center gap-[0.15625rem] ${big ? "h-12 flex-1" : "h-8 flex-1"}`}>
      {Array.from({ length: count }, (_, i) => {
        const pct = 20 + ((i * 19 + i * i * 6) % 72);
        // degradado morado→azul como en el mockup
        const hue = active ? `hsl(${250 + (i / count) * 60}, 80%, 65%)` : `hsl(240,10%,45%)`;
        return (
          <span
            key={i}
            className="rounded-full transition-colors"
            style={{ width: big ? 3.5 : 3, height: `${pct}%`, background: hue }}
          />
        );
      })}
    </div>
  );
}

/* ── Datos de muestra: comentarios de voz de ejemplo (sin audio) con alguna respuesta encadenada ── */
const SAMPLE_COMMENTS: SampleVoice[] = [
  { key: "c1", name: "Carlos", img: stage, minsAgo: 64, dur: "0:12", likes: 16, verified: true },
  { key: "c2", name: "María", img: lauraPhoto, minsAgo: 58, dur: "0:08", likes: 8, replyTo: "c1", replyAt: "0:05" },
  { key: "c3", name: "Javi", img: festival, minsAgo: 121, dur: "0:20", likes: 12 },
  { key: "c4", name: "Ana", img: beach, minsAgo: 125, dur: "0:15", likes: 5, replyTo: "c3", replyAt: "0:11" },
  { key: "c5", name: "Lucía", img: lauraPhoto, minsAgo: 130, dur: "0:10", likes: 7, verified: true },
  { key: "c6", name: "David", img: stage, minsAgo: 140, dur: "0:18", likes: 9 },
  { key: "c7", name: "Elena", img: beach, minsAgo: 185, dur: "0:09", likes: 4 },
];
/** Comentarios de voz de ejemplo de un Spot (ids propias de ese Spot para que los me gusta no se mezclen). */
export const spotCommentSeed = (spotKey: string) => sampleThread(`spot:${spotKey}`, SAMPLE_COMMENTS);
/** Clave estable de un Spot para su conversación de voz. */
export const spotKeyOf = (s: { id?: string | undefined; text: string }) => s.id ?? s.text.toLowerCase().replace(/[^a-z0-9áéíóúñü]+/gi, "-").slice(0, 40);
const EXTRA_TAGS = [["🌙", "Noche"], ["🎶", "Música en vivo"], ["📍", "Plan cerca"]];
const copyLink = async (path: string) => {
  const url = `https://spotly.app/${path}`;
  try { if (navigator.share) { await navigator.share({ url }); return; } await navigator.clipboard?.writeText(url); toast("Enlace copiado"); } catch { toast("Enlace copiado"); }
};
const MORE_SPOTS = [
  { title: "Atardecer en Triana", author: "Laura", dur: "0:58", img: festival },
  { title: "Puente de Triana",    author: "Laura", dur: "0:42", img: stage },
  { title: "Calle Betis",         author: "Laura", dur: "1:15", img: beach },
  { title: "Feria de Abril",      author: "Laura", dur: "0:36", img: festival },
];
const MORE_LAURA = [
  { title: "Noche en Sevilla", dur: "1:03", img: stage },
  { title: "Plaza de España",  dur: "0:48", img: festival },
  { title: "Semana Santa",     dur: "1:22", img: beach },
];
const ALSO_LISTENED = [
  { name: "María",  img: lauraPhoto },
  { name: "Carlos", img: stage },
  { name: "Ana",    img: beach },
  { name: "Javi",   img: festival },
  { name: "Lucía",  img: lauraPhoto },
];

/* ── Sheet de opciones (columna central del mockup) ── */
function OptionsSheet({ onClose, city, name }: { onClose: () => void; city: string; name: string }) {
  const items = [
    { icon: <AlignJustify size={19} />, label: "Descripción de este sonido" },
    { icon: <Bookmark size={19} />,     label: "Guardar en mis sonidos" },
    { icon: <Navigation size={19} />,   label: "Compartir" },
    { icon: <Map size={19} />,          label: "Ver en el mapa" },
    { icon: <Music size={19} />,        label: `Ver más sonidos de ${city}` },
    { icon: <ListMusic size={19} />,    label: "Añadir a una lista" },
    { icon: <BellOff size={19} />,      label: `Silenciar a ${name}` },
  ];
  return (
    <BottomSheet onClose={onClose} z={70}>
      {items.map(it => (
        <button key={it.label} onClick={() => { toast(it.label); onClose(); }}
          className="flex w-full items-center gap-4 rounded-xl px-3 py-3.5 text-left text-[0.9375rem] text-foreground hover:bg-secondary/60">
          <span className="text-muted-foreground">{it.icon}</span>{it.label}
        </button>
      ))}
      <button onClick={() => { toast.error("Denuncia enviada"); onClose(); }}
        className="flex w-full items-center gap-4 rounded-xl px-3 py-3.5 text-[0.9375rem] text-live hover:bg-secondary/60">
        <Flag size={19} className="text-live" />Denunciar sonido
      </button>
    </BottomSheet>
  );
}

/* ── Panel de comentarios de voz: el hilo del Spot con respuestas encadenadas, solo voz ── */
function CommentsPanel({ spotKey, root, onClose }: { spotKey: string; root: ReplyTarget; onClose: () => void }) {
  const threadId = `spot:${spotKey}`;
  const seed = useMemo(() => spotCommentSeed(spotKey), [spotKey]);
  const notes = useThread(threadId, seed);
  const [talk, setTalk] = useState(false);
  const [fresh, setFresh] = useState<string | null>(null);
  return (
    <div className="fixed inset-0 z-[70]" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div className="absolute inset-x-0 bottom-0 mx-auto flex h-[90vh] max-w-[520px] flex-col overflow-hidden rounded-t-3xl bg-background" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Comentarios de voz">
        <div className="flex shrink-0 justify-center pt-2.5"><div className="h-1 w-10 rounded-full bg-border" /></div>
        <div className="flex shrink-0 items-center justify-between px-4 py-3">
          <span className="text-base font-bold">Comentarios de voz <span className="ml-1 font-normal text-muted-foreground">{notes.length}</span></span>
          <button onClick={onClose} aria-label="Cerrar comentarios" className="grid h-9 w-9 place-items-center rounded-full"><X size={20} /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
          <VoiceThread threadId={threadId} seed={seed} root={root} freshId={fresh} emptyText="Aún no hay voces. Sé la primera en comentar este Spot." />
        </div>
        <div className="shrink-0 border-t border-border bg-card/95 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
          {talk
            ? <VoiceComposer autoFocus target={root} onClose={() => setTalk(false)} onSend={(clip, anon) => { const n = addVoiceNote({ threadId, parentId: null, replyAtMs: root.atMs, clip, anon }); setFresh(n.id); setTalk(false); toast.success(anon ? "Voz enviada como «Anónimo»" : "Voz enviada"); }} />
            : <TalkBar onTalk={() => setTalk(true)} label="Añade un comentario de voz…" />}
        </div>
      </div>
    </div>
  );
}

/* ── Personas que también escucharon ── */
function ListenersSheet({ onClose, onPerson }: { onClose: () => void; onPerson: (name: string) => void }) {
  const { following } = useStore();
  return (
    <BottomSheet title="Personas que también escucharon" onClose={onClose} z={70}>
      <div className="space-y-1">
        {ALSO_LISTENED.map((p) => {
          const on = following.includes(p.name);
          return (
            <div key={p.name} className="flex items-center gap-3 py-2">
              <button onClick={() => onPerson(p.name)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                <img src={p.img} alt="" className="h-11 w-11 shrink-0 rounded-full object-cover" />
                <span className="truncate text-sm font-semibold">{p.name}</span>
              </button>
              <Button size="sm" variant={on ? "secondary" : "default"} className="shrink-0 rounded-full" onClick={() => { toggleFollow(p.name); toast(on ? `Dejaste de seguir a ${p.name}` : `Sigues a ${p.name}`); }}>{on ? "Siguiendo" : "Seguir"}</Button>
            </div>
          );
        })}
      </div>
    </BottomSheet>
  );
}

/* ── SpotDetail principal ── */
/** Datos que necesita el detalle. `incognito`: autor con Incógnito de pago (sale «Anónimo»); `own`: es tu Spot. */
export type SpotInfo = { id?: string | undefined; name: string; city: string; ago: string; text: string; img: string; dur: string; dist: string; incognito?: boolean | undefined; own?: boolean | undefined;
  /** Audio real del Spot (tus Spots grabados con el micrófono); los de ejemplo no tienen. */
  audio?: { src: string; durationMs: number; peaks: number[] } | undefined };

export function SpotDetail({ s: initial, onClose, onAuthor }: { s: SpotInfo; onClose: () => void; onAuthor: () => void }) {
  const app = useApp();
  const [s,           setSpot]        = useState(initial);
  const me = useMe();
  const anon = !!s.incognito;
  const shownName = anon ? "Anónimo" : s.own ? me.name : s.name;
  const [person,      setPerson]      = useState<string | null>(null);
  const [listeners,   setListeners]   = useState(false);
  const [allTags,     setAllTags]     = useState(false);
  const scroller = useRef<HTMLDivElement | null>(null);
  const openSpot = (next: SpotInfo) => { setSpot(next); scroller.current?.scrollTo({ top: 0 }); };
  const toCity = () => { onClose(); app.openPhotoWall(s.city); };
  const [liked,       setLiked]       = useState(false);
  const [saved,       setSaved]       = useState(false);
  const [replying,    setReplying]    = useState(false);
  const [options,     setOptions]     = useState(false);
  const [comments,    setComments]    = useState(false);
  /* Audio del Spot en el reproductor único: progreso, tiempos y saltos reales. Los Spots de ejemplo no tienen audio. */
  const spotKey = spotKeyOf(s);
  const audioId = `spot-audio:${spotKey}`;
  const pb = useVoicePlayback(audioId);
  const totalMs = s.audio?.durationMs ?? clockToMs(s.dur);
  const posMs = pb.active ? pb.positionMs : 0;
  const ratio = totalMs ? Math.min(1, posMs / totalMs) : 0;
  const threadId = `spot:${spotKey}`;
  const seed = useMemo(() => spotCommentSeed(spotKey), [spotKey]);
  const thread = useThread(threadId, seed);
  const noAudio = () => toast("Spot de ejemplo: no tiene audio. Los Spots grabados con tu voz se escuchan aquí.");
  const togglePlay = () => { if (!s.audio) { noAudio(); return; } toggleVoice(audioId, s.audio.src, s.audio.durationMs); };
  const seekTo = (ms: number) => { if (!s.audio) { noAudio(); return; } if (pb.active) seekVoice(audioId, ms); else toggleVoice(audioId, s.audio.src, s.audio.durationMs); };
  const playAll = () => {
    const n = playVoiceQueue([...(s.audio ? [{ id: audioId, src: s.audio.src, durationMs: s.audio.durationMs }] : []), ...thread.map((x) => ({ id: x.id, src: x.src, durationMs: x.durationMs }))]);
    if (!n) toast("Aquí aún no hay voces con audio. Responde con la tuya y se escuchará en este hilo.");
    else toast(`Reproduciendo ${n} ${n === 1 ? "audio" : "audios"} seguidos`);
  };
  const playing = pb.playing;
  const root: ReplyTarget = { name: shownName, author: { name: s.name, avatar: s.img, anon, mine: s.own }, atMs: posMs, durationMs: totalMs };

  return (
    <div ref={scroller} className="fixed inset-0 z-50 overflow-y-auto bg-background">
      {/* ── FOTO con acciones laterales ── */}
      <div className="relative w-full bg-black" style={{ aspectRatio: "9/14", maxHeight: "68vh" }}>
        <img src={s.img} alt={s.text} className="h-full w-full object-cover" />
        {/* gradiente inferior */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-black/20" />

        {/* ← atrás */}
        <button onClick={onClose} aria-label="Volver"
          className="absolute left-3 top-[var(--safe-header)] grid h-10 w-10 place-items-center rounded-full bg-black/50 text-white backdrop-blur-sm">
          <ChevronLeft size={24} />
        </button>
        {/* ⋮ opciones */}
        <button onClick={() => setOptions(true)} aria-label="Opciones"
          className="absolute right-3 top-[var(--safe-header)] grid h-10 w-10 place-items-center rounded-full bg-black/50 text-white backdrop-blur-sm">
          <MoreHorizontal size={20} />
        </button>

        {/* Acciones verticales derecha — EXACTAMENTE como el mockup */}
        <div className="absolute right-3 bottom-24 flex flex-col items-center gap-5">
          <button onClick={() => setLiked(l => !l)} className="flex flex-col items-center gap-1">
            <Heart size={28} fill={liked ? "#ff4d6d" : "none"} className={liked ? "text-[#ff4d6d]" : "text-white"} />
            <span className="text-xs font-bold text-white drop-shadow">{128 + (liked ? 1 : 0)}</span>
          </button>
          <button onClick={() => void copyLink(`spot/${encodeURIComponent(s.text.slice(0, 24))}`)} aria-label="Compartir" className="flex flex-col items-center gap-1">
            <Navigation size={26} className="text-white" />
            <span className="text-xs font-bold text-white drop-shadow">24</span>
          </button>
          <button onClick={() => { setSaved(v => !v); toast(saved ? "Quitado de guardados" : "Guardado"); }} className="flex flex-col items-center gap-1">
            <Bookmark size={26} fill={saved ? "white" : "none"} className="text-white" />
            <span className="text-xs font-bold text-white drop-shadow">56</span>
          </button>
        </div>

        {/* 📍 Chip ciudad — esquina inferior izquierda de la foto */}
        <button onClick={toCity} aria-label={`Ver más de ${s.city}`} className="absolute left-3 bottom-5 flex items-center gap-1.5 rounded-full bg-black/55 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm">
          <MapPin size={12} />{s.city} <ChevronRight size={12} />
        </button>
      </div>

      {/* ── CONTENIDO DEBAJO DE LA FOTO ── */}
      <div className="px-4 pt-4 pb-[calc(8rem+env(safe-area-inset-bottom))] space-y-5 bg-background">

        {/* Título grande */}
        <div>
          <h1 className="text-[1.625rem] font-extrabold leading-tight tracking-tight">{s.text}</h1>
          {/* Autor */}
          {anon
            ? <div className="mt-2.5 flex items-center gap-2.5">
                <AnonAvatar className="h-11 w-11" size={20} />
                <div>
                  <div className="text-sm font-semibold">Anónimo</div>
                  <div className="text-xs text-muted-foreground">{s.dist} · Hace {s.ago} · Incógnito verificado</div>
                </div>
              </div>
            : <button onClick={onAuthor} className="mt-2.5 flex items-center gap-2.5 text-left">
                {s.own ? <MeAvatar className="h-11 w-11 border-2 border-primary text-base" /> : <img src={s.img} alt={s.name} className="h-11 w-11 rounded-full border-2 border-primary object-cover" />}
                <div>
                  <div className="flex items-center gap-1 text-sm font-semibold">
                    {shownName} <span className="text-primary text-base">✓</span>
                  </div>
                  <div className="text-xs text-muted-foreground">{s.dist} · Hace {s.ago}</div>
                </div>
              </button>}
        </div>

        {/* ── PLAYER GRANDE ── fondo oscuro como el mockup */}
        <div className="rounded-2xl p-4 space-y-3" style={{ background: "#0f0f1e" }}>
          {/* waveform + botón central grande */}
          <div className="flex items-center gap-3">
            <ColorWave active={playing} big />
            <button
              onClick={togglePlay}
              aria-label={playing ? "Pausar" : "Reproducir"}
              className="shrink-0 grid h-[3.75rem] w-[3.75rem] place-items-center rounded-full"
              style={{ background: "linear-gradient(135deg,#7c3aed,#3b82f6)" }}
            >
              {playing
                ? <Pause size={24} fill="white" className="text-white" />
                : <Play size={24} fill="white" className="text-white ml-0.5" />}
            </button>
            <ColorWave active={playing} big />
          </div>

          {/* barra de progreso */}
          <div className="relative h-1 rounded-full cursor-pointer" style={{ background: "rgba(255,255,255,0.15)" }}
            onClick={e => {
              const rect = e.currentTarget.getBoundingClientRect();
              seekTo(((e.clientX - rect.left) / rect.width) * totalMs);
            }}>
            <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${ratio * 100}%`, background: "linear-gradient(90deg,#7c3aed,#3b82f6)" }} />
            <div className="absolute top-1/2 -translate-y-1/2 h-3.5 w-3.5 rounded-full bg-white shadow-md"
              style={{ left: `calc(${ratio * 100}% - 7px)` }} />
          </div>

          {/* tiempos DEBAJO de la barra */}
          <div className="flex justify-between text-xs px-0.5" style={{ color: "rgba(255,255,255,0.5)" }}>
            <span>{formatClock(posMs)}</span>
            <span>{formatClock(totalMs)}</span>
          </div>

          {/* ↺15  15↻ */}
          <div className="flex items-center justify-between px-4">
            <button onClick={() => seekTo(Math.max(0, posMs - 15000))} className="flex flex-col items-center" style={{ color: "rgba(255,255,255,0.6)" }} aria-label="Retroceder 15s">
              <RotateCcw size={22} /><span className="text-4xs -mt-0.5">15</span>
            </button>
            <button onClick={() => seekTo(Math.min(totalMs, posMs + 15000))} className="flex flex-col items-center" style={{ color: "rgba(255,255,255,0.6)" }} aria-label="Avanzar 15s">
              <RotateCw size={22} /><span className="text-4xs -mt-0.5">15</span>
            </button>
          </div>

          {/* Reproducir todos los audios */}
          <button
            onClick={playAll}
            className="w-full flex items-center justify-center gap-2.5 rounded-full py-3.5 text-sm font-bold text-white"
            style={{ background: "linear-gradient(90deg,#7c3aed,#3b82f6)" }}
          >
            <Play size={17} fill="white" />
            Reproducir todos los audios
            <AlignJustify size={17} />
          </button>
        </div>

        {/* ── Tags ── */}
        <div className="flex flex-wrap gap-2">
          {[["🌅", "Atardecer"], ["👥", "Ambiente"], ["🎵", s.city], ...(allTags ? EXTRA_TAGS : [])].map(([emoji, label]) => (
            <button key={label}
              className="flex items-center gap-1.5 rounded-full border border-border bg-secondary px-3.5 py-1.5 text-xs font-medium"
              onClick={() => toast(`#${label}`)}>
              {emoji} {label}
            </button>
          ))}
          <button onClick={() => setAllTags(!allTags)} aria-label={allTags ? "Ver menos etiquetas" : "Ver más etiquetas"} className="rounded-full border border-border bg-secondary px-3.5 py-1.5 text-xs font-medium">{allTags ? "−" : "···"}</button>
        </div>

        {/* ── Más sonidos de Sevilla ── */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[0.9375rem] font-bold">Más sonidos de {s.city}</h3>
            <button onClick={toCity} className="flex items-center gap-0.5 text-xs text-primary font-medium">Ver todos <ChevronRight size={13} /></button>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {MORE_SPOTS.map((sp, i) => (
              <button key={sp.title} onClick={() => openSpot({ name: sp.author, city: s.city, ago: `${i + 1} h`, text: sp.title, img: sp.img, dur: sp.dur, dist: "a 300 m" })} aria-label={`Escuchar ${sp.title}`} className="text-left">
                <div className="relative aspect-square rounded-xl overflow-hidden" style={i === 0 ? { outline: "2px solid #7c3aed" } : {}}>
                  <img src={sp.img} alt={sp.title} className="h-full w-full object-cover" />
                  <div className="absolute inset-0 bg-black/35" />
                  <div className="absolute bottom-1.5 left-1.5 flex items-center gap-0.5">
                    <div className="grid h-4 w-4 place-items-center rounded-full bg-white/90">
                      <Play size={8} fill="#7c3aed" className="text-[#7c3aed] ml-px" />
                    </div>
                    <span className="text-4xs text-white font-semibold drop-shadow">{sp.dur}</span>
                  </div>
                </div>
                <p className="mt-1 text-3xs text-muted-foreground leading-tight line-clamp-2">{sp.title}</p>
              </button>
            ))}
          </div>
        </section>

        {/* ── Personas que también escucharon ── */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[0.9375rem] font-bold">Personas que también escucharon</h3>
            <button onClick={() => setListeners(true)} className="flex items-center gap-0.5 text-xs text-primary font-medium">Ver todos <ChevronRight size={13} /></button>
          </div>
          <div className="flex gap-4">
            {ALSO_LISTENED.map(p => (
              <button key={p.name} onClick={() => setPerson(p.name)} aria-label={`Ver perfil de ${p.name}`} className="flex flex-col items-center gap-1 shrink-0">
                <div className="relative">
                  <img src={p.img} alt={p.name} className="h-13 w-13 rounded-full object-cover border-2 border-border" />
                  <span className="absolute -bottom-0.5 -right-0.5 grid h-5 w-5 place-items-center rounded-full text-3xs font-bold text-white" style={{ background: "linear-gradient(135deg,#7c3aed,#3b82f6)" }}>+</span>
                </div>
                <span className="text-3xs text-muted-foreground">{p.name}</span>
              </button>
            ))}
          </div>
        </section>

        {/* ── Más de Laura ── (no se muestra si el autor es anónimo) */}
        {!anon && <section>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[0.9375rem] font-bold">Más de {shownName}</h3>
            <button onClick={onAuthor} className="flex items-center gap-0.5 text-xs text-primary font-medium">Ver todos <ChevronRight size={13} /></button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {MORE_LAURA.map((sp, i) => (
              <button key={sp.title} onClick={() => openSpot({ ...s, ago: `${i + 2} d`, text: sp.title, img: sp.img, dur: sp.dur })} aria-label={`Escuchar ${sp.title}`} className="text-left">
                <div className="relative aspect-square rounded-xl overflow-hidden">
                  <img src={sp.img} alt={sp.title} className="h-full w-full object-cover" />
                  <div className="absolute inset-0 bg-black/30" />
                  <div className="absolute bottom-1.5 left-1.5 flex items-center gap-0.5">
                    <div className="grid h-4 w-4 place-items-center rounded-full bg-white/90">
                      <Play size={8} fill="#7c3aed" className="text-[#7c3aed] ml-px" />
                    </div>
                    <span className="text-4xs text-white font-semibold drop-shadow">{sp.dur}</span>
                  </div>
                </div>
                <p className="mt-1 text-3xs text-muted-foreground leading-tight">{sp.title}</p>
              </button>
            ))}
          </div>
        </section>}
      </div>

      {/* ── FOOTER FIJO ── */}
      <div className="fixed inset-x-0 bottom-0 z-10 bg-card/95 backdrop-blur border-t border-border px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3">
        <div className="flex items-center gap-3">
          <MeAvatar className="h-9 w-9 text-xs" />
          <button onClick={() => setReplying(true)}
            className="flex flex-1 items-center gap-2 rounded-full bg-secondary px-4 py-2.5 text-sm text-muted-foreground text-left">
            <Mic size={15} className="text-primary shrink-0" />Responde con tu voz…
          </button>
          <button onClick={() => setComments(true)} aria-label={`Ver comentarios de voz (${thread.length})`} className="flex min-h-10 items-center gap-1.5 px-1 text-muted-foreground">
            <Mic size={19} className="text-primary" />
            <span className="text-sm font-semibold text-foreground">{thread.length}</span>
          </button>
        </div>
      </div>

      {replying && <VoiceReply name={shownName} threadId={threadId} target={root} onClose={() => setReplying(false)} />}
      {options  && <OptionsSheet name={shownName} city={s.city} onClose={() => setOptions(false)} />}
      {comments && <CommentsPanel spotKey={spotKey} root={root} onClose={() => setComments(false)} />}
      {listeners && <ListenersSheet onClose={() => setListeners(false)} onPerson={(n) => { setListeners(false); setPerson(n); }} />}
      {person && <AuthorProfile name={person} onClose={() => setPerson(null)} />}
    </div>
  );
}

/* ── AuthorProfile ── */
const AUTHOR_SPOTS = [festival, stage, beach, stage, beach, festival];

export function AuthorProfile({ name, onClose }: { name: string; onClose: () => void }) {
  const [viewer, setViewer] = useState<number | null>(null);
  const [follow, setFollow] = useState(false);
  const [voice,  setVoice]  = useState(false);
  const [list,   setList]   = useState(false);
  const presentation = useMemo(() => sampleThread(`presentacion:${name}`, [{ key: "p", name, img: beach, minsAgo: 60 * 24 * 3, dur: "0:15", likes: 42, verified: true }])[0]!, [name]);
  if (list) return <NewFollowers onClose={() => setList(false)} />;
  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-background pb-[max(2.5rem,calc(env(safe-area-inset-bottom)+1rem))]">
      <div className="relative h-40">
        <img src={stage} alt="" className="h-full w-full object-cover" />
        <span className="absolute inset-0 bg-gradient-to-t from-background to-transparent" />
        <Button variant="icon" size="icon" aria-label="Volver" onClick={onClose} className="absolute left-3 top-[var(--safe-header)] bg-background/75"><ChevronLeft size={24} /></Button>
      </div>
      <div className="-mt-12 px-4 text-center">
        <img src={beach} alt="" className="relative mx-auto h-24 w-24 rounded-full border-4 border-background object-cover" />
        <h2 className="mt-2 text-xl font-bold">{name} <span className="text-primary">✦</span></h2>
        <p className="text-xs text-muted-foreground">Sevilla · Verificado</p>
        <div className="mt-4 grid grid-cols-3 rounded-2xl border border-border bg-card py-3 text-sm">
          {[["128", "Spots"], [follow ? "4.822" : "4.821", "Seguidores"], ["312", "Siguiendo"]].map(([a, b]) => (
            <div key={b} onClick={() => b === "Seguidores" && setList(true)} className={b === "Seguidores" ? "cursor-pointer" : ""}>
              <strong className="block">{a}</strong><small className="text-muted-foreground">{b}</small>
            </div>
          ))}
        </div>
        <div className="mt-4 text-left"><VoiceItem compact note={{ ...presentation, liked: false, replies: 0 }} onReply={() => setVoice(true)} right={<span className="text-2xs text-muted-foreground">Presentación</span>} /></div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button onClick={() => { setFollow(!follow); toast(follow ? "Has dejado de seguir a " + name : "Ahora sigues a " + name); }} variant={follow ? "secondary" : "default"}>
            {follow ? <><Check size={16} />Siguiendo</> : <><UserPlus size={16} />Seguir</>}
          </Button>
          <Button variant="secondary" className="whitespace-nowrap px-3" onClick={() => setVoice(true)}><Mic size={16} />Mensaje de voz</Button>
        </div>
        <h3 className="mt-6 text-left text-sm font-bold">Sus Spots</h3>
        <div className="mt-2 grid grid-cols-3 gap-1">
          {AUTHOR_SPOTS.map((p, i) => (
            <button key={i} onClick={() => setViewer(i)} aria-label={`Ver Spot ${i + 1} de ${name}`} className="overflow-hidden rounded-md"><img src={p} alt="" className="aspect-square w-full rounded-md object-cover" /></button>
          ))}
        </div>
      </div>
      {voice && <VoiceReply name={name} mode="message" onClose={() => setVoice(false)} />}
      {viewer !== null && <MediaViewer start={viewer} onClose={() => setViewer(null)} items={AUTHOR_SPOTS.map((img, k) => {
        const m = sampleMedia.find((x) => x.img === img);
        return { kind: "foto" as const, src: img, caption: m?.caption ?? `Spot de ${name}`, place: m?.place ?? "Sevilla", likes: (m?.likes ?? 120) + k * 7 };
      })} />}
    </div>
  );
}
