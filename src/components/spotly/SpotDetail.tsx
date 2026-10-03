import { useState, useRef, useEffect } from "react";
import { ArrowLeft, Bookmark, Check, ChevronRight, Heart, ListMusic, MapPin, Mic, MoreHorizontal, Pause, Play, RotateCcw, RotateCw, Share2, UserPlus, X, AlignJustify, Music, Map, Flag, BellOff, Navigation } from "lucide-react";
import { toast } from "sonner";
import { NewFollowers } from "./LocalAd";
import { VoiceReply } from "./Voice";
import { Button } from "@/components/ui/button";
import festival from "@/assets/spotly-sevilla-festival.jpg";
import stage from "@/assets/spotly-live-stage.jpg";
import beach from "@/assets/spotly-beach-club.jpg";
import lauraPhoto from "@/assets/spotly-laura.jpg";
import mePhoto from "@/assets/spotly-me.jpg";

/* ── Waveform coloreada igual que el mockup ── */
function ColorWave({ active, big = false }: { active: boolean; big?: boolean }) {
  const count = big ? 38 : 26;
  return (
    <div className={`flex items-center gap-[2.5px] ${big ? "h-12 flex-1" : "h-8 flex-1"}`}>
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

/* ── Datos de muestra ── */
const AUDIO_COMMENTS = [
  { id: "c1", name: "Carlos",  img: stage,     ago: "Hace 1 h", dur: "0:12", likes: 16, text: "Qué ambiente más increíble 😄" },
  { id: "c2", name: "María",   img: lauraPhoto, ago: "Hace 1 h", dur: "0:08", likes: 8,  text: "Se nota la magia de Sevilla..." },
  { id: "c3", name: "Javi",    img: festival,   ago: "Hace 2 h", dur: "0:20", likes: 12, text: "Ese sonido me trae muchos recuerdos ❤️" },
  { id: "c4", name: "Ana",     img: beach,      ago: "Hace 2 h", dur: "0:15", likes: 5,  text: "Precioso... parece que estoy allí 🎉" },
  { id: "c5", name: "Lucía",   img: lauraPhoto, ago: "Hace 2 h", dur: "0:10", likes: 7,  text: "Qué ganas de volver a Triana!" },
  { id: "c6", name: "David",   img: stage,      ago: "Hace 2 h", dur: "0:18", likes: 9,  text: "La mejor ciudad del mundo 🔥" },
  { id: "c7", name: "Elena",   img: beach,      ago: "Hace 3 h", dur: "0:09", likes: 4,  text: "Ambiente único, se vive de otra forma." },
];
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

/* ── Fila comentario de audio ── */
function AudioCommentRow({ c, playing, onPlay }: { c: typeof AUDIO_COMMENTS[0]; playing: boolean; onPlay: () => void }) {
  const [liked, setLiked] = useState(false);
  return (
    <div className="flex items-start gap-3 py-3 border-b border-border/40 last:border-0">
      <img src={c.img} alt={c.name} className="h-10 w-10 shrink-0 rounded-full object-cover" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1">
          <span className="text-sm font-semibold">{c.name}</span>
          <span className="text-xs text-muted-foreground">· {c.ago}</span>
          <button className="ml-auto text-muted-foreground"><MoreHorizontal size={15} /></button>
        </div>
        {/* player pill */}
        <div className="mt-1.5 flex items-center gap-2 rounded-full bg-[#1a1a2e] px-2 py-1.5">
          <button onClick={onPlay} className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary" aria-label="Reproducir">
            {playing ? <Pause size={13} fill="white" className="text-white" /> : <Play size={13} fill="white" className="text-white" />}
          </button>
          <ColorWave active={playing} />
          <span className="pr-1 text-xs text-muted-foreground">{c.dur}</span>
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground leading-snug">{c.text}</p>
      </div>
      <button onClick={() => setLiked(l => !l)} className={`flex shrink-0 flex-col items-center gap-0.5 pt-7 ${liked ? "text-red-400" : "text-muted-foreground"}`}>
        <Heart size={14} fill={liked ? "currentColor" : "none"} />
        <span className="text-[10px]">{c.likes + (liked ? 1 : 0)}</span>
      </button>
    </div>
  );
}

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
    <div className="fixed inset-0 z-[70]" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div className="absolute inset-x-0 bottom-0 rounded-t-3xl bg-card" onClick={e => e.stopPropagation()}>
        {/* handle */}
        <div className="flex justify-center pt-2.5 pb-1"><div className="h-1 w-10 rounded-full bg-border" /></div>
        <div className="pb-6">
          {items.map(it => (
            <button key={it.label} onClick={() => { toast(it.label); onClose(); }}
              className="flex w-full items-center gap-4 px-6 py-3.5 text-[15px] text-foreground hover:bg-secondary/60 text-left">
              <span className="text-muted-foreground">{it.icon}</span>{it.label}
            </button>
          ))}
          <button onClick={() => { toast.error("Denuncia enviada"); onClose(); }}
            className="flex w-full items-center gap-4 px-6 py-3.5 text-[15px] text-live hover:bg-secondary/60">
            <Flag size={19} className="text-live" />Denunciar sonido
          </button>
        </div>
        <div className="h-[env(safe-area-inset-bottom,16px)]" />
      </div>
    </div>
  );
}

/* ── Panel comentarios (columna derecha del mockup) ── */
function CommentsPanel({ onClose }: { onClose: () => void }) {
  const [playing, setPlaying] = useState<string | null>(null);
  const [replying, setReplying] = useState(false);
  return (
    <div className="fixed inset-0 z-[70]" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div className="absolute inset-x-0 bottom-0 h-[90vh] rounded-t-3xl bg-card flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* handle */}
        <div className="flex justify-center pt-2.5 shrink-0"><div className="h-1 w-10 rounded-full bg-border" /></div>
        {/* header */}
        <div className="flex items-center justify-between px-4 py-3 shrink-0">
          <span className="text-base font-bold">Comentarios de audio <span className="ml-1 font-normal text-muted-foreground">24</span></span>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        {/* lista */}
        <div className="flex-1 overflow-y-auto px-4 min-h-0">
          {AUDIO_COMMENTS.map(c => (
            <AudioCommentRow key={c.id} c={c} playing={playing === c.id} onPlay={() => setPlaying(playing === c.id ? null : c.id)} />
          ))}
          {/* escuchar más */}
          <button className="flex w-full items-center justify-center gap-2 rounded-full border border-border py-3 my-3 text-sm text-muted-foreground">
            <AlignJustify size={16} className="text-primary" /> Escuchar más comentarios
          </button>
          {/* mini-playlist */}
          <div className="rounded-2xl bg-secondary/50 p-3 mb-4">
            <p className="text-xs font-semibold mb-2.5 text-muted-foreground">Reproduciendo todos los audios (12)</p>
            {MORE_SPOTS.map((sp, i) => (
              <div key={sp.title} className="flex items-center gap-3 py-1.5">
                <img src={sp.img} alt="" className="h-10 w-10 rounded-lg object-cover shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{sp.title}</p>
                  <p className="text-[10px] text-muted-foreground">{sp.author} · {sp.dur}</p>
                </div>
                {i === 0
                  ? <ColorWave active={true} />
                  : <AlignJustify size={14} className="text-muted-foreground" />}
              </div>
            ))}
          </div>
        </div>
        {/* reply bar */}
        <div className="shrink-0 border-t border-border flex items-center gap-3 px-4 py-3">
          <img src={mePhoto} alt="Tú" className="h-9 w-9 rounded-full object-cover shrink-0" />
          <button onClick={() => setReplying(true)} className="flex-1 flex items-center gap-2 rounded-full bg-secondary px-4 py-2.5 text-sm text-muted-foreground text-left">
            <Mic size={15} className="text-primary shrink-0" />Añade un comentario de voz…
          </button>
        </div>
        <div className="h-[env(safe-area-inset-bottom,0px)] shrink-0" />
        {replying && <VoiceReply name="este Spot" onClose={() => setReplying(false)} />}
      </div>
    </div>
  );
}

/* ── SpotDetail principal ── */
export type SpotInfo = { name: string; city: string; ago: string; text: string; img: string; dur: string; dist: string };

export function SpotDetail({ s, onClose, onAuthor }: { s: SpotInfo; onClose: () => void; onAuthor: () => void }) {
  const [playing,     setPlaying]     = useState(false);
  const [progress,    setProgress]    = useState(0);
  const [liked,       setLiked]       = useState(false);
  const [saved,       setSaved]       = useState(false);
  const [replying,    setReplying]    = useState(false);
  const [options,     setOptions]     = useState(false);
  const [comments,    setComments]    = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const TOTAL = 58;

  useEffect(() => {
    if (playing) {
      timer.current = setInterval(() => setProgress(p => { if (p >= TOTAL) { setPlaying(false); return 0; } return p + 1; }), 1000);
    } else {
      if (timer.current) clearInterval(timer.current);
    }
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [playing]);

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-background">
      {/* ── FOTO con acciones laterales ── */}
      <div className="relative w-full bg-black" style={{ aspectRatio: "9/14", maxHeight: "68vh" }}>
        <img src={s.img} alt={s.text} className="h-full w-full object-cover" />
        {/* gradiente inferior */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-black/20" />

        {/* ← atrás */}
        <button onClick={onClose} aria-label="Volver"
          className="absolute left-3 top-[max(2.75rem,calc(env(safe-area-inset-top)+0.5rem))] grid h-9 w-9 place-items-center rounded-full bg-black/50 text-white">
          <ArrowLeft size={20} />
        </button>
        {/* ⋮ opciones */}
        <button onClick={() => setOptions(true)} aria-label="Opciones"
          className="absolute right-3 top-[max(2.75rem,calc(env(safe-area-inset-top)+0.5rem))] grid h-9 w-9 place-items-center rounded-full bg-black/50 text-white">
          <MoreHorizontal size={20} />
        </button>

        {/* Acciones verticales derecha — EXACTAMENTE como el mockup */}
        <div className="absolute right-3 bottom-24 flex flex-col items-center gap-5">
          <button onClick={() => setLiked(l => !l)} className="flex flex-col items-center gap-1">
            <Heart size={28} fill={liked ? "#ff4d6d" : "none"} className={liked ? "text-[#ff4d6d]" : "text-white"} />
            <span className="text-xs font-bold text-white drop-shadow">{128 + (liked ? 1 : 0)}</span>
          </button>
          <button onClick={() => toast("Enlace copiado")} className="flex flex-col items-center gap-1">
            <Navigation size={26} className="text-white" />
            <span className="text-xs font-bold text-white drop-shadow">24</span>
          </button>
          <button onClick={() => { setSaved(v => !v); toast(saved ? "Quitado de guardados" : "Guardado"); }} className="flex flex-col items-center gap-1">
            <Bookmark size={26} fill={saved ? "white" : "none"} className="text-white" />
            <span className="text-xs font-bold text-white drop-shadow">56</span>
          </button>
        </div>

        {/* 📍 Chip ciudad — esquina inferior izquierda de la foto */}
        <button className="absolute left-3 bottom-5 flex items-center gap-1.5 rounded-full bg-black/55 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm">
          <MapPin size={12} />{s.city} <ChevronRight size={12} />
        </button>
      </div>

      {/* ── CONTENIDO DEBAJO DE LA FOTO ── */}
      <div className="px-4 pt-4 pb-32 space-y-5 bg-background">

        {/* Título grande */}
        <div>
          <h1 className="text-[26px] font-extrabold leading-tight tracking-tight">{s.text}</h1>
          {/* Autor */}
          <button onClick={onAuthor} className="mt-2.5 flex items-center gap-2.5 text-left">
            <img src={s.img} alt={s.name} className="h-11 w-11 rounded-full border-2 border-primary object-cover" />
            <div>
              <div className="flex items-center gap-1 text-sm font-semibold">
                {s.name} <span className="text-primary text-base">✓</span>
              </div>
              <div className="text-xs text-muted-foreground">{s.dist} · Hace {s.ago}</div>
            </div>
          </button>
        </div>

        {/* ── PLAYER GRANDE ── fondo oscuro como el mockup */}
        <div className="rounded-2xl p-4 space-y-3" style={{ background: "#0f0f1e" }}>
          {/* waveform + botón central grande */}
          <div className="flex items-center gap-3">
            <ColorWave active={playing} big />
            <button
              onClick={() => setPlaying(p => !p)}
              aria-label={playing ? "Pausar" : "Reproducir"}
              className="shrink-0 grid h-[60px] w-[60px] place-items-center rounded-full"
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
              setProgress(Math.round(((e.clientX - rect.left) / rect.width) * TOTAL));
            }}>
            <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${(progress / TOTAL) * 100}%`, background: "linear-gradient(90deg,#7c3aed,#3b82f6)" }} />
            <div className="absolute top-1/2 -translate-y-1/2 h-3.5 w-3.5 rounded-full bg-white shadow-md"
              style={{ left: `calc(${(progress / TOTAL) * 100}% - 7px)` }} />
          </div>

          {/* tiempos DEBAJO de la barra */}
          <div className="flex justify-between text-xs px-0.5" style={{ color: "rgba(255,255,255,0.5)" }}>
            <span>{fmt(progress)}</span>
            <span>{fmt(TOTAL)}</span>
          </div>

          {/* ↺15  15↻ */}
          <div className="flex items-center justify-between px-4">
            <button onClick={() => setProgress(p => Math.max(0, p - 15))} className="flex flex-col items-center" style={{ color: "rgba(255,255,255,0.6)" }} aria-label="Retroceder 15s">
              <RotateCcw size={22} /><span className="text-[9px] -mt-0.5">15</span>
            </button>
            <button onClick={() => setProgress(p => Math.min(TOTAL, p + 15))} className="flex flex-col items-center" style={{ color: "rgba(255,255,255,0.6)" }} aria-label="Avanzar 15s">
              <RotateCw size={22} /><span className="text-[9px] -mt-0.5">15</span>
            </button>
          </div>

          {/* Reproducir todos los audios */}
          <button
            onClick={() => setPlaying(p => !p)}
            className="w-full flex items-center justify-center gap-2.5 rounded-full py-3.5 text-sm font-bold text-white"
            style={{ background: "linear-gradient(90deg,#7c3aed,#3b82f6)" }}
          >
            {playing ? <Pause size={17} fill="white" /> : <Play size={17} fill="white" />}
            {playing ? "Pausar todos los audios" : "Reproducir todos los audios"}
            <AlignJustify size={17} />
          </button>
        </div>

        {/* ── Tags ── */}
        <div className="flex flex-wrap gap-2">
          {[["🌅", "Atardecer"], ["👥", "Ambiente"], ["🎵", "Sevilla"]].map(([emoji, label]) => (
            <button key={label}
              className="flex items-center gap-1.5 rounded-full border border-border bg-secondary px-3.5 py-1.5 text-xs font-medium"
              onClick={() => toast(`#${label}`)}>
              {emoji} {label}
            </button>
          ))}
          <button className="rounded-full border border-border bg-secondary px-3.5 py-1.5 text-xs font-medium">···</button>
        </div>

        {/* ── Más sonidos de Sevilla ── */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[15px] font-bold">Más sonidos de {s.city}</h3>
            <button className="flex items-center gap-0.5 text-xs text-primary font-medium">Ver todos <ChevronRight size={13} /></button>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {MORE_SPOTS.map((sp, i) => (
              <div key={sp.title}>
                <div className="relative aspect-square rounded-xl overflow-hidden" style={i === 0 ? { outline: "2px solid #7c3aed" } : {}}>
                  <img src={sp.img} alt={sp.title} className="h-full w-full object-cover" />
                  <div className="absolute inset-0 bg-black/35" />
                  <div className="absolute bottom-1.5 left-1.5 flex items-center gap-0.5">
                    <div className="grid h-4 w-4 place-items-center rounded-full bg-white/90">
                      <Play size={8} fill="#7c3aed" className="text-[#7c3aed] ml-px" />
                    </div>
                    <span className="text-[9px] text-white font-semibold drop-shadow">{sp.dur}</span>
                  </div>
                </div>
                <p className="mt-1 text-[10px] text-muted-foreground leading-tight line-clamp-2">{sp.title}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Personas que también escucharon ── */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[15px] font-bold">Personas que también escucharon</h3>
            <button className="flex items-center gap-0.5 text-xs text-primary font-medium">Ver todos <ChevronRight size={13} /></button>
          </div>
          <div className="flex gap-4">
            {ALSO_LISTENED.map(p => (
              <div key={p.name} className="flex flex-col items-center gap-1 shrink-0">
                <div className="relative">
                  <img src={p.img} alt={p.name} className="h-13 w-13 rounded-full object-cover border-2 border-border" style={{ height: 52, width: 52 }} />
                  <span className="absolute -bottom-0.5 -right-0.5 grid h-5 w-5 place-items-center rounded-full text-[10px] font-bold text-white" style={{ background: "linear-gradient(135deg,#7c3aed,#3b82f6)" }}>+</span>
                </div>
                <span className="text-[10px] text-muted-foreground">{p.name}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ── Más de Laura ── */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[15px] font-bold">Más de {s.name}</h3>
            <button className="flex items-center gap-0.5 text-xs text-primary font-medium">Ver todos <ChevronRight size={13} /></button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {MORE_LAURA.map(sp => (
              <div key={sp.title}>
                <div className="relative aspect-square rounded-xl overflow-hidden">
                  <img src={sp.img} alt={sp.title} className="h-full w-full object-cover" />
                  <div className="absolute inset-0 bg-black/30" />
                  <div className="absolute bottom-1.5 left-1.5 flex items-center gap-0.5">
                    <div className="grid h-4 w-4 place-items-center rounded-full bg-white/90">
                      <Play size={8} fill="#7c3aed" className="text-[#7c3aed] ml-px" />
                    </div>
                    <span className="text-[9px] text-white font-semibold drop-shadow">{sp.dur}</span>
                  </div>
                </div>
                <p className="mt-1 text-[10px] text-muted-foreground leading-tight">{sp.title}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* ── FOOTER FIJO ── */}
      <div className="fixed inset-x-0 bottom-0 z-10 bg-card/95 backdrop-blur border-t border-border px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3">
        <div className="flex items-center gap-3">
          <img src={mePhoto} alt="Tú" className="h-9 w-9 rounded-full object-cover shrink-0" />
          <button onClick={() => setReplying(true)}
            className="flex flex-1 items-center gap-2 rounded-full bg-secondary px-4 py-2.5 text-sm text-muted-foreground text-left">
            <Mic size={15} className="text-primary shrink-0" />Responde con tu voz…
          </button>
          <button onClick={() => setComments(true)} className="flex items-center gap-1.5 text-muted-foreground">
            <Mic size={19} className="text-primary" />
            <span className="text-sm font-semibold text-foreground">24</span>
          </button>
        </div>
      </div>

      {replying && <VoiceReply name={s.name} onClose={() => setReplying(false)} />}
      {options  && <OptionsSheet name={s.name} city={s.city} onClose={() => setOptions(false)} />}
      {comments && <CommentsPanel onClose={() => setComments(false)} />}
    </div>
  );
}

/* ── AuthorProfile ── */
export function AuthorProfile({ name, onClose }: { name: string; onClose: () => void }) {
  const [follow, setFollow] = useState(false);
  const [play,   setPlay]   = useState(false);
  const [list,   setList]   = useState(false);
  if (list) return <NewFollowers onClose={() => setList(false)} />;
  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-background pb-10">
      <div className="relative h-40">
        <img src={stage} alt="" className="h-full w-full object-cover" />
        <span className="absolute inset-0 bg-gradient-to-t from-background to-transparent" />
        <Button variant="icon" size="icon" aria-label="Volver" onClick={onClose} className="absolute left-3 top-3 bg-background/75"><ArrowLeft /></Button>
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
        <div className="mt-4 flex items-center gap-2 rounded-full border border-border bg-secondary p-1 text-left">
          <button onClick={() => setPlay(!play)} className="grid h-9 w-9 place-items-center rounded-full bg-primary text-white">
            {play ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" />}
          </button>
          <ColorWave active={play} />
          <span className="pr-3 text-xs">0:15</span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button onClick={() => { setFollow(!follow); toast(follow ? "Has dejado de seguir a " + name : "Ahora sigues a " + name); }} variant={follow ? "secondary" : "default"}>
            {follow ? <><Check size={16} />Siguiendo</> : <><UserPlus size={16} />Seguir</>}
          </Button>
          <Button variant="secondary" onClick={() => toast("Nota de voz enviada a " + name)}><Mic size={16} />Mensaje de voz</Button>
        </div>
        <h3 className="mt-6 text-left text-sm font-bold">Sus Spots</h3>
        <div className="mt-2 grid grid-cols-3 gap-1">
          {[festival, stage, beach, stage, beach, festival].map((p, i) => (
            <img key={i} src={p} alt="" className="aspect-square w-full rounded-md object-cover" />
          ))}
        </div>
      </div>
    </div>
  );
}
