import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Film, ImagePlus, Mic, MoreHorizontal, Pause, Play, Plus, Smile, Volume2, VolumeX, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Shell } from "./Extras";
import { usePos } from "@/lib/preview-context";
import lauraPhoto from "@/assets/spotly-laura.jpg";
import mePhoto from "@/assets/spotly-me.jpg";

type Message = { id: number; who: "them" | "me"; kind: "voice" | "gif" | "image" | "reaction"; duration?: string; src?: string; value?: string };
type Chat = { name: string; unread: boolean; messages: Message[] };
const samples: Chat[] = [
  { name: "María", unread: true, messages: [
    { id: 1, who: "them", kind: "voice", duration: "0:12" }, { id: 2, who: "me", kind: "voice", duration: "0:28" },
    { id: 3, who: "them", kind: "voice", duration: "0:15" }, { id: 4, who: "me", kind: "voice", duration: "0:09" },
  ] },
  { name: "Carlos", unread: false, messages: [{ id: 5, who: "them", kind: "voice", duration: "0:21" }] },
  { name: "Comunidad Triana", unread: true, messages: [{ id: 6, who: "them", kind: "voice", duration: "1:05" }] },
  { name: "Laura", unread: false, messages: [{ id: 7, who: "them", kind: "voice", duration: "0:09" }] },
];
// GIFs como emojis inline (sin dependencia de CDN Lovable)
const gifs = [
  { title: "Corazón", emoji: "❤️", label: "Corazón" },
  { title: "Onda", emoji: "🌊", label: "Onda" },
  { title: "Brillos", emoji: "✨", label: "Brillos" },
];

function Waveform({ active = false }: { active?: boolean }) {
  return <span aria-hidden="true" className="flex h-7 min-w-0 flex-1 items-center justify-center gap-[2px] overflow-hidden">{Array.from({ length: 33 }, (_, i) => <span key={i} className={`voice-wave-line ${active ? "voice-wave-playing" : ""}`} style={{ height: `${22 + (i * 17 + i * i * 7) % 72}%`, animationDelay: `${i * 37}ms` }} />)}</span>;
}
function Avatar({ name, mine = false }: { name: string; mine?: boolean }) {
  return <img src={mine ? mePhoto : lauraPhoto} alt={mine ? "Tú" : name} className="h-9 w-9 shrink-0 rounded-full border border-primary/70 object-cover" />;
}

export function VoiceChats({ onBack, onAudioWall }: { onBack: () => void; onAudioWall: () => void }) {
  const pos = usePos();
  const [chats, setChats] = useState(samples);
  const [open, setOpen] = useState<number | null>(null);
  const [menu, setMenu] = useState<"attach" | "gifs" | "reactions" | "options" | null>(null);
  const [playing, setPlaying] = useState<number | null>(null);
  const [recording, setRecording] = useState(false);
  const [muted, setMuted] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const starting = useRef(false);
  const pressed = useRef(false);
  const audio = useRef<HTMLAudioElement | null>(null);
  const input = useRef<HTMLInputElement | null>(null);
  const urls = useRef<string[]>([]);
  const selected = open === null ? undefined : chats[open];

  useEffect(() => { if (!recording) return; const timer = window.setInterval(() => setSeconds(v => v + 1), 1000); return () => window.clearInterval(timer); }, [recording]);
  useEffect(() => () => { recorder.current?.stop(); stream.current?.getTracks().forEach(t => t.stop()); audio.current?.pause(); urls.current.forEach(URL.revokeObjectURL); }, []);

  function append(message: Omit<Message, "id" | "who">, target = open) {
    if (target === null) return;
    setChats(prev => prev.map((chat, i) => i === target ? { ...chat, messages: [...chat.messages, { ...message, id: Date.now() + Math.random(), who: "me" }] } : chat));
    setMenu(null);
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
    next.onended = () => setPlaying(null);
    next.onerror = () => { setPlaying(null); toast.error("No se pudo reproducir la nota de voz."); };
    void next.play().catch(() => { setPlaying(null); toast.error("No se pudo reproducir la nota de voz."); });
  }
  function choosePhoto(file?: File) {
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 8 * 1024 * 1024) { toast.error("Elige una imagen de hasta 8 MB."); return; }
    const src = URL.createObjectURL(file); urls.current.push(src);
    append({ kind: "image", src }); if (input.current) input.current.value = "";
  }
  function leaveChat() { stopRecording(); audio.current?.pause(); setPlaying(null); setMenu(null); setOpen(null); }

  if (!selected || open === null) return <Shell title="Chats de voz" onBack={onBack}>
    <Button className="mb-4 w-full bg-spot-gradient" onClick={onAudioWall}><Mic size={18} />Audio Wall en directo</Button>
    <div className="space-y-2">{chats.map((chat, index) => <Button key={chat.name} variant="secondary" onClick={() => { setOpen(index); setChats(prev => prev.map((v, i) => i === index ? { ...v, unread: false } : v)); }} className="h-auto w-full justify-start gap-3 rounded-lg border border-border bg-card p-3 text-left">
      <Avatar name={chat.name}/><span className="min-w-0 flex-1"><span className="block font-semibold">{chat.name}{chat.unread && <span className="ml-2 text-live">●</span>}</span><span className="flex items-center gap-1 text-xs font-normal text-muted-foreground"><Mic size={12} className="text-primary"/> {chat.messages.at(-1)?.kind === "voice" ? `Nota de voz · ${chat.messages.at(-1)?.duration}` : "Nuevo mensaje"}</span></span>
    </Button>)}</div>
  </Shell>;

  return <div className={pos + " inset-0 z-40 mx-auto flex max-w-[520px] flex-col bg-background text-foreground"}>
    <header className="shrink-0 border-b border-border px-4 pb-3 pt-[max(2.75rem,calc(env(safe-area-inset-top)+0.5rem))]">
      <div className="flex items-center gap-3"><Button variant="ghost" size="icon" aria-label="Volver a chats" onClick={leaveChat}><ArrowLeft size={20}/></Button><h1 className="min-w-0 flex-1 text-sm font-bold">Chat de voz</h1><Button variant="ghost" size="icon" aria-label="Opciones del chat" onClick={() => setMenu(menu === "options" ? null : "options")}><MoreHorizontal size={20}/></Button></div>
      <div className="mt-1 flex items-center gap-3 pl-2"><Avatar name={selected.name}/><div className="min-w-0"><h2 className="text-sm font-semibold">{selected.name}</h2><p className="text-xs text-muted-foreground">En línea · ejemplo</p></div></div>
    </header>
    {menu === "options" && <div className="absolute right-4 top-28 z-20 flex flex-col rounded-lg border border-border bg-popover p-2 shadow-glow"><Button variant="ghost" onClick={() => { setMuted(!muted); setMenu(null); toast(muted ? "Avisos activados en esta vista" : "Avisos silenciados en esta vista"); }}>{muted ? <Volume2 size={17}/> : <VolumeX size={17}/>} {muted ? "Activar avisos" : "Silenciar avisos"}</Button><Button variant="ghost" onClick={() => setMenu(null)}><X size={17}/> Cerrar</Button></div>}
    <main className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-5" aria-label="Mensajes de voz">
      {selected.messages.map(message => <div key={message.id} className={`flex items-end gap-2 ${message.who === "me" ? "flex-row-reverse" : ""}`}>
        <Avatar name={message.who === "me" ? "Tú" : selected.name} mine={message.who === "me"}/>
        {message.kind === "voice" ? <Button variant="ghost" onClick={() => playMessage(message)} aria-label={`${playing === message.id ? "Pausar" : "Reproducir"} nota de voz de ${message.who === "me" ? "Tú" : selected.name}, ${message.duration}${message.src ? "" : ", ejemplo sin audio"}`} className={`voice-chat-bubble ${message.who === "me" ? "voice-chat-bubble-me" : "voice-chat-bubble-them"} h-12 min-w-0 max-w-[70%] flex-1 gap-2 rounded-xl px-2 text-foreground`}>
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-foreground text-background">{playing === message.id ? <Pause size={14} fill="currentColor"/> : <Play size={14} fill="currentColor"/>}</span><Waveform active={playing === message.id}/><span className="text-xs font-normal">{message.duration}</span>
        </Button> : message.kind === "reaction" ? <span className="rounded-full border border-border bg-card px-4 py-2 text-2xl" aria-label={`Reacción ${message.value}`}>{message.value}</span> : <img src={message.src} alt={message.kind === "gif" ? "GIF animado enviado" : "Imagen enviada"} className="max-h-48 max-w-[65%] rounded-lg border border-border object-contain"/>}
      </div>)}
    </main>
    <footer className="voice-chat-footer shrink-0 rounded-t-lg border border-primary/20 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3">
      {menu === "attach" && <div className="mb-3 grid grid-cols-3 gap-2"><Button variant="secondary" className="h-16 flex-col gap-1 border border-border text-xs" onClick={() => setMenu("gifs")}><Film size={20} className="text-primary"/> GIF</Button><Button variant="secondary" className="h-16 flex-col gap-1 border border-border text-xs" onClick={() => input.current?.click()}><ImagePlus size={20} className="text-primary"/> Imagen</Button><Button variant="secondary" className="h-16 flex-col gap-1 border border-border text-xs" onClick={() => setMenu("reactions")}><Smile size={20} className="text-primary"/> Reacción</Button></div>}
      {menu === "gifs" && <div className="mb-3"><div className="mb-2 flex items-center justify-between"><span className="text-xs font-semibold">Reacciones Spotly</span><Button variant="ghost" size="icon" aria-label="Cerrar GIF" className="h-7 w-7" onClick={() => setMenu(null)}><X size={16}/></Button></div><div className="grid grid-cols-3 gap-2">{gifs.map(gif => <Button key={gif.title} variant="secondary" className="h-20 p-1 flex-col gap-1" aria-label={`Enviar ${gif.label}`} onClick={() => append({ kind: "reaction", value: gif.emoji })}><span className="text-4xl leading-none">{gif.emoji}</span><span className="text-[10px] text-muted-foreground">{gif.label}</span></Button>)}</div></div>}
      {menu === "reactions" && <div className="mb-3 flex justify-around">{["❤️", "👏", "😂", "🔥", "🙌"].map(value => <Button key={value} variant="ghost" size="icon" aria-label={`Enviar reacción ${value}`} className="text-2xl" onClick={() => append({ kind: "reaction", value })}>{value}</Button>)}</div>}
      <input ref={input} type="file" accept="image/*" className="hidden" aria-label="Seleccionar imagen" onChange={event => choosePhoto(event.target.files?.[0])}/>
      <p className="text-center text-xs text-muted-foreground">{recording ? `Hablando ${format(seconds)}...` : "Mantén pulsado para hablar"}</p>
      <div className="mt-2 flex items-end justify-between gap-3">
        <Button variant="icon" size="icon" aria-label={menu ? "Cerrar adjuntos" : "Añadir GIF, imagen o reacción"} className="h-11 w-11 shrink-0" onClick={() => setMenu(menu ? null : "attach")}>{menu ? <X size={20}/> : <Plus size={22}/>}</Button>
        <Button variant="icon" size="icon" aria-label={recording ? "Soltar para enviar nota de voz" : "Mantener pulsado para grabar nota de voz"} className={`voice-chat-mic h-[70px] w-[70px] touch-none text-primary ${recording ? "spot-pulse" : ""}`} onPointerDown={event => { if (event.pointerType !== "mouse" || event.button === 0) { event.currentTarget.setPointerCapture(event.pointerId); void startRecording(); } }} onPointerUp={stopRecording} onPointerCancel={stopRecording} onKeyDown={event => { if ((event.key === " " || event.key === "Enter") && !event.repeat) { event.preventDefault(); if (recording) stopRecording(); else void startRecording(); } }}><Mic size={32}/></Button>
        <Button variant="icon" size="icon" aria-label="Abrir reacciones GIF" className="h-11 w-11 shrink-0" onClick={() => setMenu(menu === "gifs" ? null : "gifs")}><Film size={20}/></Button>
      </div>
      <p className="mt-2 text-center text-[10px] text-muted-foreground">Conversación de ejemplo · tus envíos no se guardan al salir</p>
    </footer>
  </div>;
}