import { useEffect, useRef, useState, useCallback } from "react";
import { ArrowLeft, Camera, Download, Film, ImagePlus, MapPin, Mic, Pause, Play, Scan, Search, Send, Share2, Smile, Users, Volume2, VolumeX, X, ZoomIn, ZoomOut } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Chip, StateCard } from "./kit";
import { Shell } from "./Extras";
import lauraPhoto from "@/assets/spotly-laura.jpg";
import mePhoto from "@/assets/spotly-me.jpg";
import streetPhoto from "@/assets/seville-night.jpg";
import thumbPhoto from "@/assets/spotly-sevilla-festival.jpg";
import heartGif from "@/assets/spotly-corazon.gif.asset.json";
import waveGif from "@/assets/spotly-onda.gif.asset.json";
import sparkleGif from "@/assets/spotly-brillo.gif.asset.json";

type Message = { id: number; who: "them" | "me"; kind: "voice" | "gif" | "image" | "reaction" | "text" | "location"; duration?: string; src?: string; value?: string; place?: string; away?: string };
type Chat = { name: string; unread: boolean; group?: boolean; online: boolean; lastSeen: string; time: string; messages: Message[] };
const samples: Chat[] = [
  { name: "Laura", unread: false, online: true, lastSeen: "", time: "18:45", messages: [
    { id: 1, who: "them", kind: "voice", duration: "0:24" }, { id: 2, who: "me", kind: "voice", duration: "0:24" },
    { id: 3, who: "them", kind: "voice", duration: "0:06" }, { id: 4, who: "them", kind: "location", place: "Gran Vía", away: "A 5 min de aquí" },
  ] },
  { name: "María", unread: true, online: true, lastSeen: "", time: "18:42", messages: [
    { id: 5, who: "them", kind: "voice", duration: "0:12" }, { id: 6, who: "me", kind: "voice", duration: "0:28" },
    { id: 7, who: "them", kind: "voice", duration: "0:15" }, { id: 8, who: "me", kind: "voice", duration: "0:09" },
  ] },
  { name: "Carlos", unread: false, online: false, lastSeen: "Últ. vez hoy a las 17:10", time: "17:10", messages: [{ id: 9, who: "them", kind: "voice", duration: "0:21" }] },
  { name: "Comunidad Triana", unread: true, group: true, online: true, lastSeen: "", time: "16:03", messages: [{ id: 10, who: "them", kind: "voice", duration: "1:05" }] },
];
const replies = ["0:04", "0:07", "0:05", "0:09"];
const gifs = [{ title: "Corazón", asset: heartGif }, { title: "Onda", asset: waveGif }, { title: "Brillos", asset: sparkleGif }];

function Waveform({ active = false }: { active?: boolean }) {
  return <span aria-hidden="true" className="flex h-7 min-w-0 flex-1 items-center justify-center gap-[2px] overflow-hidden">{Array.from({ length: 33 }, (_, i) => <span key={i} className={`voice-wave-line ${active ? "voice-wave-playing" : ""}`} style={{ height: `${22 + (i * 17 + i * i * 7) % 72}%`, animationDelay: `${i * 37}ms` }} />)}</span>;
}
const tints = ["from-cyan-400 to-blue-600", "from-fuchsia-500 to-purple-700", "from-amber-400 to-rose-500", "from-emerald-400 to-teal-600"];
/** Cada persona tiene su propio avatar: Laura y tú con foto; el resto, iniciales de color; los grupos, icono de grupo. */
function Avatar({ name, mine = false, group = false, online, size = 36 }: { name: string; mine?: boolean; group?: boolean; online?: boolean | undefined; size?: number }) {
  const tint = tints[name.charCodeAt(0) % tints.length]!;
  const box = { width: size, height: size };
  const face = mine ? mePhoto : name === "Laura" ? lauraPhoto : null;
  return <span className="relative shrink-0" style={box}>
    {face ? <img src={face} alt={mine ? "Tú" : name} className="h-full w-full rounded-full border border-primary/70 object-cover" />
      : <span role="img" aria-label={name} className={`grid h-full w-full place-items-center rounded-full border border-primary/40 bg-gradient-to-br text-xs font-bold text-white ${tint}`}>{group ? <Users size={size * 0.45} /> : name[0]}</span>}
    {online !== undefined && <span aria-hidden="true" className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background ${online ? "bg-emerald-400" : "bg-muted-foreground/60"}`} />}
  </span>;
}
function preview(m?: Message) {
  if (!m) return "Sin mensajes";
  if (m.kind === "voice") return `Nota de voz · ${m.duration}`;
  if (m.kind === "text") return m.value ?? "";
  if (m.kind === "location") return `Ubicación · ${m.place}`;
  if (m.kind === "image") return "Imagen"; if (m.kind === "gif") return "GIF"; return `Reacción ${m.value}`;
}
function Typing() { return <span aria-label="escuchando" className="inline-flex items-center gap-1">{[0, 1, 2].map(i => <span key={i} className="spot-typing-dot h-1.5 w-1.5 rounded-full bg-current" style={{ animationDelay: `${i * 160}ms` }} />)}</span>; }

function Lightbox({ src, onClose }: { src: string; onClose: () => void }) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const lastDist = useRef<number | null>(null);
  const lastPos = useRef<{ x: number; y: number } | null>(null);
  const isDragging = useRef(false);

  const clampScale = (s: number) => Math.min(Math.max(s, 1), 5);

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setScale(s => clampScale(s - e.deltaY * 0.005));
  }, []);

  const onPtrDown = (e: React.PointerEvent<HTMLDivElement>) => {
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    lastPos.current = { x: e.clientX, y: e.clientY };
    isDragging.current = false;
  };
  const onPtrMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!lastPos.current) return;
    const dx = e.clientX - lastPos.current.x; const dy = e.clientY - lastPos.current.y;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) isDragging.current = true;
    if (scale > 1) setOffset(o => ({ x: o.x + dx, y: o.y + dy }));
    lastPos.current = { x: e.clientX, y: e.clientY };
  };
  const onPtrUp = () => { lastPos.current = null; };

  const onTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0]!.clientX - e.touches[1]!.clientX;
      const dy = e.touches[0]!.clientY - e.touches[1]!.clientY;
      const dist = Math.hypot(dx, dy);
      if (lastDist.current !== null) setScale(s => clampScale(s * (dist / lastDist.current!)));
      lastDist.current = dist;
    }
  };
  const onTouchEnd = () => { lastDist.current = null; };

  const reset = () => { setScale(1); setOffset({ x: 0, y: 0 }); };

  useEffect(() => { if (scale === 1) setOffset({ x: 0, y: 0 }); }, [scale]);

  return <div className="fixed inset-0 z-[80] flex flex-col bg-black select-none" onWheel={onWheel} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
    {/* Toolbar */}
    <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-4 py-[max(0.75rem,env(safe-area-inset-top))] bg-gradient-to-b from-black/60 to-transparent">
      <button aria-label="Cerrar" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white backdrop-blur"><X size={20}/></button>
      <div className="flex items-center gap-2">
        <button aria-label="Alejar" onClick={() => setScale(s => clampScale(s - 0.5))} className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white backdrop-blur"><ZoomOut size={18}/></button>
        <span className="min-w-[3rem] text-center text-sm font-bold text-white tabular-nums">{Math.round(scale * 100)}%</span>
        <button aria-label="Acercar" onClick={() => setScale(s => clampScale(s + 0.5))} className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white backdrop-blur"><ZoomIn size={18}/></button>
        <button aria-label="Restablecer zoom" onClick={reset} className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white backdrop-blur text-xs font-bold">1:1</button>
      </div>
      <button aria-label="Compartir" onClick={() => { void navigator.share?.({ url: src }).catch(() => navigator.clipboard?.writeText(src)); toast("Enlace copiado"); }} className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white backdrop-blur"><Share2 size={18}/></button>
    </div>
    {/* Image canvas */}
    <div className="flex flex-1 items-center justify-center overflow-hidden"
      onPointerDown={onPtrDown} onPointerMove={onPtrMove} onPointerUp={onPtrUp}
      onDoubleClick={() => scale === 1 ? setScale(2.5) : reset()}
      style={{ cursor: scale > 1 ? "grab" : "zoom-in" }}>
      <img src={src} alt="Imagen en grande" draggable={false}
        style={{ transform: `scale(${scale}) translate(${offset.x / scale}px, ${offset.y / scale}px)`, transformOrigin: "center", transition: isDragging.current ? "none" : "transform 0.15s ease", maxWidth: "100%", maxHeight: "100dvh", objectFit: "contain", userSelect: "none" }} />
    </div>
    {/* Hint */}
    {scale === 1 && <p className="absolute bottom-[max(1.5rem,env(safe-area-inset-bottom))] inset-x-0 text-center text-[11px] text-white/40 pointer-events-none">Doble toque para acercar · Pellizca para zoom</p>}
  </div>;
}

export function VoiceChats({ onBack, onAudioWall }: { onBack: () => void; onAudioWall: () => void }) {
  const [chats, setChats] = useState(samples);
  const [open, setOpen] = useState<number | null>(null);
  const [tab, setTab] = useState<"Todos" | "No leídos" | "Grupos">("Todos");
  const [q, setQ] = useState("");
  const [menu, setMenu] = useState<"attach" | "gifs" | "reactions" | "options" | null>(null);
  const [playing, setPlaying] = useState<number | null>(null);
  const [recording, setRecording] = useState(false);
  const [muted, setMuted] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [typing, setTyping] = useState<number | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [audioProgress, setAudioProgress] = useState<Record<number, number>>({});
  const [audioDuration, setAudioDuration] = useState<Record<number, number>>({});
  const timers = useRef<number[]>([]);
  const listEnd = useRef<HTMLDivElement | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const starting = useRef(false);
  const pressed = useRef(false);
  const audio = useRef<HTMLAudioElement | null>(null);
  const input = useRef<HTMLInputElement | null>(null);
  const urls = useRef<string[]>([]);
  const selected = open === null ? undefined : chats[open];

  useEffect(() => { if (!recording) return; const timer = window.setInterval(() => setSeconds(v => v + 1), 1000); return () => window.clearInterval(timer); }, [recording]);
  useEffect(() => () => { recorder.current?.stop(); stream.current?.getTracks().forEach(t => t.stop()); audio.current?.pause(); urls.current.forEach(URL.revokeObjectURL); timers.current.forEach(window.clearTimeout); }, []);

  function append(message: Omit<Message, "id" | "who">, target = open) {
    if (target === null) return;
    setChats(prev => prev.map((chat, i) => i === target ? { ...chat, messages: [...chat.messages, { ...message, id: Date.now() + Math.random(), who: "me" }] } : chat));
    setMenu(null);
    if (message.kind === "reaction" || !chats[target]?.online) return;
    // Demo: la otra persona muestra «escuchando…» y responde con una nota de voz de ejemplo.
    timers.current.push(window.setTimeout(() => setTyping(target), 700));
    timers.current.push(window.setTimeout(() => {
      setTyping(null);
      setChats(prev => prev.map((chat, i) => i === target ? { ...chat, messages: [...chat.messages, { id: Date.now() + Math.random(), who: "them", kind: "voice", duration: replies[Math.floor(Math.random() * replies.length)]! }] } : chat));
    }, 2900));
  }
  function format(s: number) { return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; }
  async function startRecording() {
    if (starting.current || recorder.current) return;
    pressed.current = true;
    starting.current = true;
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") throw new Error("unsupported");
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!pressed.current) { media.getTracks().forEach(track => track.stop()); return; }
      stream.current = media;
      const currentChat = open;
      const rec = new MediaRecorder(media);
      const chunks: BlobPart[] = [];
      rec.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      rec.onstop = () => {
        media.getTracks().forEach(track => track.stop()); stream.current = null; recorder.current = null;
        if (!chunks.length) return;
        const src = URL.createObjectURL(new Blob(chunks, { type: rec.mimeType || "audio/webm" }));
        urls.current.push(src);
        const duration = format(Math.max(1, Math.round((Date.now() - startedAt) / 1000)));
        append({ kind: "voice", duration, src }, currentChat);
      };
      const startedAt = Date.now();
      rec.start(); recorder.current = rec; setSeconds(0); setRecording(true); setMenu(null);
    } catch { toast.error("No se pudo acceder al micrófono. Comprueba el permiso del navegador."); }
    finally { starting.current = false; }
  }
  function stopRecording() { pressed.current = false; if (recorder.current?.state === "recording") recorder.current.stop(); setRecording(false); }
  function playMessage(message: Message) {
    if (!message.src) { toast.info("Audio de ejemplo: no hay grabación disponible."); return; }
    if (playing === message.id) { audio.current?.pause(); setPlaying(null); return; }
    audio.current?.pause();
    const next = new Audio(message.src); audio.current = next; setPlaying(message.id);
    next.ontimeupdate = () => setAudioProgress(p => ({ ...p, [message.id]: next.currentTime }));
    next.onloadedmetadata = () => setAudioDuration(d => ({ ...d, [message.id]: next.duration }));
    next.onended = () => { setPlaying(null); setAudioProgress(p => ({ ...p, [message.id]: 0 })); };
    next.onerror = () => { setPlaying(null); toast.error("No se pudo reproducir la nota de voz."); };
    void next.play().catch(() => { setPlaying(null); toast.error("No se pudo reproducir la nota de voz."); });
  }
  function seekAudio(message: Message, pct: number) {
    if (playing !== message.id || !audio.current) return;
    const dur = audio.current.duration; if (!dur || !isFinite(dur)) return;
    audio.current.currentTime = pct * dur;
    setAudioProgress(p => ({ ...p, [message.id]: pct * dur }));
  }
  function choosePhoto(file?: File) {
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 8 * 1024 * 1024) { toast.error("Elige una imagen de hasta 8 MB."); return; }
    const src = URL.createObjectURL(file); urls.current.push(src);
    append({ kind: "image", src }); if (input.current) input.current.value = "";
  }
  function leaveChat() { stopRecording(); audio.current?.pause(); setPlaying(null); setMenu(null); setOpen(null); setTyping(null); timers.current.forEach(window.clearTimeout); timers.current = []; }
  useEffect(() => { listEnd.current?.scrollIntoView?.({ block: "end" }); }, [chats, typing, open]);

  if (!selected || open === null) {
    const list = chats.map((c, i) => ({ c, i })).filter(({ c }) => (tab === "Todos" || (tab === "No leídos" ? c.unread : !!c.group)) && c.name.toLowerCase().includes(q.trim().toLowerCase()));
    return <Shell title="Chats de voz" onBack={onBack}>
      <Button className="mb-3 w-full bg-spot-gradient" onClick={onAudioWall}><Mic size={18} />Audio Wall en directo</Button>
      <label className="mb-3 flex items-center gap-2 rounded-full border border-border bg-card px-3"><Search size={15} className="text-muted-foreground" /><input value={q} onChange={e => setQ(e.target.value)} aria-label="Buscar chats" placeholder="Buscar chats" className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />{q && <button aria-label="Borrar búsqueda" onClick={() => setQ("")}><X size={14} /></button>}</label>
      <div className="mb-3 flex gap-2">{(["Todos", "No leídos", "Grupos"] as const).map(t => <Chip key={t} active={tab === t} onClick={() => setTab(t)}>{t}{t === "No leídos" ? ` · ${chats.filter(c => c.unread).length}` : ""}</Chip>)}</div>
      {list.length === 0 ? <StateCard icon={tab === "Grupos" ? Users : Mic} tone="muted" title="Nada por aquí" text={q ? "Ningún chat coincide con tu búsqueda." : tab === "No leídos" ? "Estás al día: no tienes notas sin escuchar." : "Aún no tienes chats de este tipo."} /> :
      <div className="space-y-2">{list.map(({ c: chat, i: index }) => <Button key={chat.name} variant="secondary" onClick={() => { setOpen(index); setChats(prev => prev.map((v, i) => i === index ? { ...v, unread: false } : v)); }} className="h-auto w-full justify-start gap-3 rounded-lg border border-border bg-card p-3 text-left">
        <Avatar name={chat.name} group={!!chat.group} online={chat.online} size={44} /><span className="min-w-0 flex-1"><span className="flex items-center gap-1 font-semibold"><span className="truncate">{chat.name}</span>{chat.group && <Users size={12} className="shrink-0 text-muted-foreground" />}</span><span className="flex items-center gap-1 text-xs font-normal text-muted-foreground">{typing === index ? <span className="text-emerald-400">escribiendo… </span> : <><Mic size={12} className="text-primary"/> {preview(chat.messages.at(-1))}</>}</span></span>
        <span className="flex shrink-0 flex-col items-end gap-1 text-[11px] font-normal text-muted-foreground">{chat.time}{chat.unread && <span aria-label="Sin leer" className="h-2.5 w-2.5 rounded-full bg-live" />}</span>
      </Button>)}</div>}
    </Shell>;
  }

  const status = typing === open ? <span className="flex items-center gap-1 text-emerald-400">escuchando <Typing /></span> : selected.online ? <span className="text-emerald-400">En línea</span> : <span className="text-muted-foreground">{selected.lastSeen}</span>;
  return <div className="fixed inset-0 z-40 mx-auto flex max-w-[520px] flex-col bg-background text-foreground">
    <header className="shrink-0 border-b border-border px-4 pb-3 pt-[max(2.75rem,calc(env(safe-area-inset-top)+0.5rem))]">
      <div className="flex items-center gap-3"><Button variant="ghost" size="icon" aria-label="Volver a chats" onClick={leaveChat}><ArrowLeft size={22}/></Button>
        <Avatar name={selected.name} group={!!selected.group} online={selected.online} size={48} />
        <div className="min-w-0 flex-1"><h1 className="truncate text-base font-bold leading-tight">{selected.name}</h1><p className="text-xs font-semibold" aria-live="polite">{selected.group && selected.online ? <span className="text-emerald-400">Grupo · activo ahora</span> : status}</p></div>
        <Button variant="ghost" size="icon" aria-label="Opciones del chat" onClick={() => setMenu(menu === "options" ? null : "options")}><Scan size={20}/></Button></div>
    </header>
    {menu === "options" && <div className="absolute right-4 top-28 z-20 flex flex-col rounded-lg border border-border bg-popover p-2 shadow-glow"><Button variant="ghost" onClick={() => { setMuted(!muted); setMenu(null); toast(muted ? "Avisos activados en esta vista" : "Avisos silenciados en esta vista"); }}>{muted ? <Volume2 size={17}/> : <VolumeX size={17}/>} {muted ? "Activar avisos" : "Silenciar avisos"}</Button><Button variant="ghost" onClick={() => setMenu(null)}><X size={17}/> Cerrar</Button></div>}
    <main className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-5" aria-label="Mensajes">
      {selected.messages.map(message => { const mine = message.who === "me"; return <div key={message.id} className={`flex items-end gap-2 ${mine ? "flex-row-reverse" : ""}`}>
        <Avatar name={mine ? "Tú" : selected.name} mine={mine} group={!mine && !!selected.group} size={38}/>
        <div className={`flex min-w-0 max-w-[76%] flex-col ${mine ? "items-end" : "items-start"}`}>
          {message.kind === "voice" ? <div className={`voice-chat-bubble ${mine ? "voice-chat-bubble-me" : "voice-chat-bubble-them"} w-64 max-w-full rounded-2xl px-3 py-2`}>
            <div className="flex items-center gap-2">
              <button onClick={() => playMessage(message)} aria-label={playing === message.id ? "Pausar" : "Reproducir"} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-[oklch(0.45_0.22_295)]">
                {playing === message.id ? <Pause size={15} fill="currentColor"/> : <Play size={15} fill="currentColor" className="ml-0.5"/>}
              </button>
              <div className="min-w-0 flex-1">
                {/* Scrubber */}
                <div className="relative h-2 w-full cursor-pointer rounded-full bg-white/25" role="slider" aria-label="Posición del audio" aria-valuenow={Math.round((audioProgress[message.id] ?? 0) / (audioDuration[message.id] ?? 1) * 100)} aria-valuemin={0} aria-valuemax={100}
                  onClick={e => { const r = e.currentTarget.getBoundingClientRect(); seekAudio(message, (e.clientX - r.left) / r.width); }}
                  onPointerMove={e => { if (e.buttons !== 1) return; const r = e.currentTarget.getBoundingClientRect(); seekAudio(message, Math.max(0, Math.min(1, (e.clientX - r.left) / r.width))); }}>
                  <div className="absolute inset-y-0 left-0 rounded-full bg-white transition-all" style={{ width: `${((audioProgress[message.id] ?? 0) / (audioDuration[message.id] ?? 1)) * 100}%` }} />
                  <div className="absolute top-1/2 -translate-y-1/2 h-3.5 w-3.5 rounded-full bg-white shadow" style={{ left: `calc(${((audioProgress[message.id] ?? 0) / (audioDuration[message.id] ?? 1)) * 100}% - 7px)` }} />
                </div>
                <div className="mt-1 flex justify-between text-[10px] opacity-70 tabular-nums">
                  <span>{format(Math.round(audioProgress[message.id] ?? 0))}</span>
                  <span>{message.duration}</span>
                </div>
              </div>
            </div>
          </div>
          : message.kind === "text" ? <p className={`rounded-2xl border px-4 py-3 text-[15px] ${mine ? "border-[var(--spot-blue)]/60 bg-[oklch(0.3_0.12_255)]" : "border-primary/30 bg-card/80"}`}>{message.value}</p>
          : message.kind === "location" ? <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((message.place ?? "") + " España")}`} target="_blank" rel="noopener noreferrer" aria-label={`Abrir ${message.place} en Google Maps`} className="block w-64 max-w-full overflow-hidden rounded-2xl border border-primary/30 bg-card/80 active:opacity-80"><img src={streetPhoto} alt={`Foto de ${message.place}`} className="h-28 w-full object-cover"/><div className="flex items-center gap-3 p-2"><img src={thumbPhoto} alt="" className="h-14 w-14 rounded-xl object-cover"/><span className="min-w-0 flex-1"><strong className="flex items-center gap-1 text-base"><MapPin size={14} className="text-primary"/>{message.place}</strong><small className="block text-muted-foreground">{message.away}</small></span><span className="shrink-0 rounded-lg bg-primary/15 px-2 py-1 text-[11px] font-bold text-primary">Abrir mapa →</span></div></a>
          : message.kind === "reaction" ? <span className="rounded-full border border-border bg-card px-4 py-2 text-2xl" aria-label={`Reacción ${message.value}`}>{message.value}</span>
          : <button onClick={() => message.src && setLightbox(message.src)} aria-label="Ver imagen en grande" className="cursor-zoom-in overflow-hidden rounded-2xl border border-border"><img src={message.src} alt={message.kind === "gif" ? "GIF animado enviado" : "Imagen enviada"} className="max-h-56 max-w-full object-cover" /></button>}
        </div>
      </div>; })}
      {typing === open && <div className="flex items-end gap-2"><Avatar name={selected.name} group={!!selected.group} size={38}/><span className="rounded-2xl border border-primary/30 bg-card/80 px-4 py-3 text-muted-foreground"><Typing /></span></div>}
      <div ref={listEnd} />
    </main>
    <footer className="shrink-0 border-t border-border/50 bg-background/95 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
      {/* GIF picker */}
      {menu === "gifs" && <div className="mb-3"><div className="mb-2 flex items-center justify-between"><span className="text-xs font-semibold">GIF de Spotly</span><Button variant="ghost" size="icon" aria-label="Cerrar GIF" className="h-7 w-7" onClick={() => setMenu(null)}><X size={16}/></Button></div><div className="grid grid-cols-3 gap-2">{gifs.map(gif => <Button key={gif.title} variant="secondary" className="h-20 p-1" aria-label={`Enviar GIF ${gif.title}`} onClick={() => append({ kind: "gif", src: gif.asset.url })}><img src={gif.asset.url} alt={gif.title} className="h-full w-full object-contain"/></Button>)}</div></div>}
      {/* Reaction picker */}
      {menu === "reactions" && <div className="mb-3 flex justify-around rounded-2xl border border-border bg-card/80 py-3">{["❤️", "👏", "😂", "🔥", "🙌"].map(value => <Button key={value} variant="ghost" size="icon" aria-label={`Enviar reacción ${value}`} className="text-2xl" onClick={() => append({ kind: "reaction", value })}>{value}</Button>)}</div>}
      <input ref={input} type="file" accept="image/*" className="hidden" aria-label="Seleccionar imagen" onChange={event => choosePhoto(event.target.files?.[0])}/>
      {/* Recording indicator */}
      {recording && <div className="mb-2 flex items-center justify-center gap-2 text-sm font-semibold" aria-live="polite"><span className="spot-pulse h-2.5 w-2.5 rounded-full bg-[var(--spot-fuchsia)]"/><span>{format(seconds)} · suelta para enviar</span></div>}
      {/* Symmetric icon bar — 2 left | MIC center | 2 right */}
      <div className="flex items-center justify-center gap-3">
        {/* Left side: GIF + Imagen */}
        <Button variant="secondary" size="icon" aria-label="Enviar GIF" className={`h-12 w-12 rounded-full border border-border ${menu === "gifs" ? "border-primary bg-primary/20" : ""}`} onClick={() => setMenu(menu === "gifs" ? null : "gifs")}><Film size={20} className="text-primary"/></Button>
        <Button variant="secondary" size="icon" aria-label="Enviar imagen" className="h-12 w-12 rounded-full border border-border" onClick={() => input.current?.click()}><ImagePlus size={20} className="text-primary"/></Button>
        {/* Center: Mic */}
        <Button variant="icon" size="icon" aria-label={recording ? "Soltar para enviar nota de voz" : "Mantener pulsado para grabar nota de voz"} className={`h-16 w-16 shrink-0 touch-none rounded-full border-0 bg-[var(--spot-fuchsia)] text-white shadow-[0_0_22px_var(--spot-fuchsia)] ${recording ? "spot-pulse" : ""}`} onPointerDown={event => { if (event.pointerType !== "mouse" || event.button === 0) { event.currentTarget.setPointerCapture(event.pointerId); void startRecording(); } }} onPointerUp={stopRecording} onPointerCancel={stopRecording} onKeyDown={event => { if ((event.key === " " || event.key === "Enter") && !event.repeat) { event.preventDefault(); if (recording) stopRecording(); else void startRecording(); } }}><Mic size={28}/></Button>
        {/* Right side: Reacción + Ubicación */}
        <Button variant="secondary" size="icon" aria-label="Enviar reacción" className={`h-12 w-12 rounded-full border border-border ${menu === "reactions" ? "border-primary bg-primary/20" : ""}`} onClick={() => setMenu(menu === "reactions" ? null : "reactions")}><Smile size={20} className="text-primary"/></Button>
        <Button variant="secondary" size="icon" aria-label="Compartir ubicación" className="h-12 w-12 rounded-full border border-border" onClick={() => append({ kind: "location", place: "Gran Vía", away: "A 5 min de aquí" })}><MapPin size={20} className="text-primary"/></Button>
      </div>
      {!recording && <p className="mt-2 text-center text-[11px] text-muted-foreground">Mantén pulsado el micrófono para hablar</p>}
    </footer>
    {/* Lightbox con pinch-to-zoom */}
    {lightbox && <Lightbox src={lightbox} onClose={() => setLightbox(null)} />}
  </div>;
}
