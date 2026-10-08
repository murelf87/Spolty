import { useEffect, useMemo, useRef, useState } from "react";
import { CornerDownRight, CornerUpLeft, Film, Ghost, ImagePlus, Loader2, Mic, MoreHorizontal, Pause, Play, Plus, Smile, Volume2, VolumeX, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Shell } from "./Extras";
import { TopBar } from "./kit";
import { AnonAvatar, MeAvatar } from "./Author";
import { VoiceComposer, VoiceWave, playNote, useVoiceName } from "./VoiceThread";
import { useMe } from "@/lib/store";
import { addVoiceNote, useMyVoiceNotes, useThread, type ThreadNote } from "@/lib/voice/notes";
import { sampleThread, type SampleVoice } from "@/lib/voice/samples";
import { formatClock } from "@/lib/voice/recorder";
import { seekVoice, stopAllVoices, useVoicePlayback } from "@/lib/voice/player";
import lauraPhoto from "@/assets/spotly-laura.jpg";

/**
 * Chats de voz (1 a 1 y de grupo, donde habla mucha gente): cada mensaje es una nota de voz real con su onda y su
 * progreso; se puede responder a un mensaje concreto («En respuesta a…», con el segundo exacto) y solo suena uno a
 * la vez. Grabar abre el panel común: escucha previa, descarte y envío explícito. GIF, imágenes y reacciones se
 * envían como antes y viven en esta sesión.
 */
type ChatInfo = { name: string; group?: boolean; unread: boolean; samples: SampleVoice[] };
const ME = "__me__";
const sampleChats: ChatInfo[] = [
  { name: "María", unread: true, samples: [{ key: "1", name: "María", img: lauraPhoto, minsAgo: 30, dur: "0:12", likes: 0 }, { key: "2", name: ME, minsAgo: 28, dur: "0:28", likes: 0 }, { key: "3", name: "María", img: lauraPhoto, minsAgo: 20, dur: "0:15", likes: 0, replyTo: "2", replyAt: "0:19" }, { key: "4", name: ME, minsAgo: 18, dur: "0:09", likes: 0 }] },
  { name: "Carlos", unread: false, samples: [{ key: "1", name: "Carlos", img: lauraPhoto, minsAgo: 95, dur: "0:21", likes: 0 }] },
  { name: "Comunidad Triana", group: true, unread: true, samples: [{ key: "1", name: "Rocío", img: lauraPhoto, minsAgo: 50, dur: "1:05", likes: 0 }, { key: "2", name: "Anónimo", anon: true, minsAgo: 44, dur: "0:14", likes: 0 }, { key: "3", name: "Manu", img: lauraPhoto, minsAgo: 40, dur: "0:22", likes: 0, replyTo: "1", replyAt: "0:31" }] },
  { name: "Laura", unread: false, samples: [{ key: "1", name: "Laura", img: lauraPhoto, minsAgo: 160, dur: "0:09", likes: 0 }] },
];
const seedOf = (c: ChatInfo) => sampleThread(`chat:${c.name}`, c.samples).map((n) => (n.author.name === ME ? { ...n, author: { name: "", mine: true } } : n));
const gifs = [{ title: "Corazón", emoji: "❤️" }, { title: "Onda", emoji: "🌊" }, { title: "Brillos", emoji: "✨" }];
type Extra = { id: string; kind: "image" | "reaction"; src?: string; value?: string; createdAt: number };

function ChatAvatar({ note, chat }: { note: ThreadNote; chat: string }) {
  if (note.author.anon) return <AnonAvatar className="h-9 w-9" size={16} />;
  if (note.author.mine) return <MeAvatar className="h-9 w-9 border border-primary/70 text-xs" />;
  return note.author.avatar ? <img src={note.author.avatar} alt={note.author.name || chat} className="h-9 w-9 shrink-0 rounded-full border border-primary/70 object-cover" /> : <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-secondary text-xs font-bold">{(note.author.name || chat)[0]}</span>;
}

/** Burbuja de voz del chat: diseño de bocadillo con la onda real, el progreso y el botón de responder. */
function VoiceBubble({ note, mine, who, parentName, onReply, onJump }: { note: ThreadNote; mine: boolean; who: string; parentName?: string | undefined; onReply: (atMs: number) => void; onJump?: (() => void) | undefined }) {
  const pb = useVoicePlayback(note.id);
  const total = pb.active && pb.durationMs ? pb.durationMs : note.durationMs;
  return (
    <div className={`flex min-w-0 flex-1 flex-col ${mine ? "items-end" : "items-start"}`}>
      <span className="mb-1 flex max-w-full items-center gap-1 px-1 text-3xs font-semibold text-muted-foreground">{note.author.anon && <Ghost size={11} className="shrink-0" />}<span className="truncate">{who}</span>{mine && !note.author.anon && <span className="shrink-0 font-normal">· tú</span>}{note.sample && <span className="shrink-0 font-normal">· ejemplo</span>}</span>
      {note.parentId && <button type="button" onClick={onJump} className="mb-1 flex max-w-[80%] items-center gap-1 rounded-full border border-border bg-card/70 px-2 py-0.5 text-3xs text-muted-foreground"><CornerDownRight size={11} className="shrink-0" /><span className="truncate">En respuesta a {parentName ?? "este audio"}{note.replyAtMs ? ` · ${formatClock(note.replyAtMs)}` : ""}</span></button>}
      <div className={`flex w-full items-center gap-1.5 ${mine ? "flex-row-reverse" : ""}`}>
        <div id={`voz-${note.id}`} className={`voice-chat-bubble ${mine ? "voice-chat-bubble-me" : "voice-chat-bubble-them"} flex h-12 w-[80%] min-w-0 max-w-[17rem] items-center gap-2 rounded-xl px-2 text-foreground`}>
          <button type="button" onClick={() => playNote(note)} aria-label={`${pb.playing ? "Pausar" : "Reproducir"} la nota de voz de ${who}, ${formatClock(note.durationMs)}${note.src ? "" : ", ejemplo sin audio"}`} className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-foreground text-background">
            {pb.loading ? <Loader2 size={13} className="animate-spin" /> : pb.playing ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" className="ml-0.5" />}
          </button>
          <VoiceWave peaks={note.peaks.filter((_, i) => i % 2 === 0)} progress={pb.active && total ? pb.positionMs / total : 0} playhead={pb.active} className="h-7 flex-1" label={`Nota de voz de ${who}`} onSeek={note.src ? (r) => (pb.active ? seekVoice(note.id, r * total) : playNote(note, r)) : undefined} />
          <span className="shrink-0 text-xs tabular-nums">{formatClock(pb.active ? pb.positionMs : note.durationMs)}</span>
        </div>
        <button type="button" onClick={() => onReply(pb.active ? pb.positionMs : 0)} aria-label={`Responder a esta nota de ${who}`} className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"><CornerUpLeft size={16} /></button>
      </div>
    </div>
  );
}

function ChatRoom({ chat, onBack }: { chat: ChatInfo; onBack: () => void }) {
  const threadId = `chat:${chat.name}`;
  const seed = useMemo(() => seedOf(chat), [chat]);
  const notes = useThread(threadId, seed);
  const nameOf = useVoiceName();
  const [menu, setMenu] = useState<"attach" | "gifs" | "reactions" | "options" | null>(null);
  const [muted, setMuted] = useState(false);
  const [talk, setTalk] = useState(false);
  const [replyTo, setReplyTo] = useState<{ note: ThreadNote; atMs: number } | null>(null);
  const [extras, setExtras] = useState<Extra[]>([]);
  const input = useRef<HTMLInputElement | null>(null);
  const list = useRef<HTMLElement | null>(null);
  const urls = useRef<string[]>([]);
  useEffect(() => () => { stopAllVoices(); urls.current.forEach(URL.revokeObjectURL); }, []);
  const byId = useMemo(() => new Map(notes.map((n) => [n.id, n])), [notes]);
  const items = useMemo(() => [...notes.map((n) => ({ t: n.createdAt, note: n as ThreadNote | null, extra: null as Extra | null })), ...extras.map((e) => ({ t: e.createdAt, note: null, extra: e }))].sort((a, b) => a.t - b.t), [notes, extras]);
  useEffect(() => { list.current?.scrollTo({ top: list.current.scrollHeight, behavior: "smooth" }); }, [items.length]);
  const whoOf = (n: ThreadNote) => (n.author.anon ? "Anónimo" : n.author.mine ? nameOf(n.author) : n.author.name || chat.name);
  const addExtra = (e: Omit<Extra, "id" | "createdAt">) => { setExtras((l) => [...l, { ...e, id: `x${Date.now()}${Math.random()}`, createdAt: Date.now() }]); setMenu(null); };
  const choosePhoto = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 8 * 1024 * 1024) { toast.error("Elige una imagen de hasta 8 MB."); return; }
    const src = URL.createObjectURL(file); urls.current.push(src);
    addExtra({ kind: "image", src }); if (input.current) input.current.value = "";
  };
  const send = (clip: Parameters<typeof addVoiceNote>[0]["clip"], anon: boolean) => {
    addVoiceNote({ threadId, parentId: replyTo?.note.id ?? null, replyAtMs: replyTo?.atMs, clip, anon: !!chat.group && anon });
    setTalk(false); setReplyTo(null);
  };
  const jump = (id: string) => document.getElementById(`voz-${id}`)?.scrollIntoView({ block: "center", behavior: "smooth" });

  return <div className="fixed inset-0 z-40 mx-auto flex max-w-[520px] flex-col bg-background text-foreground">
    <div className="relative z-20 shrink-0">
      <TopBar title={chat.name} sub={chat.group ? <span>Grupo de voz · todos pueden hablar</span> : <span className="inline-flex items-center gap-1"><span className="h-2 w-2 shrink-0 rounded-full bg-online" aria-hidden="true" /><span className="font-semibold text-online">En línea</span><span>· chat de voz</span></span>}
        leading={<img src={lauraPhoto} alt={chat.name} className="h-9 w-9 shrink-0 rounded-full border border-primary/70 object-cover" />} onBack={onBack} backLabel="Volver a chats"
        right={<Button variant="ghost" size="icon" className="text-foreground" aria-label="Opciones del chat" onClick={() => setMenu(menu === "options" ? null : "options")}><MoreHorizontal size={20} /></Button>} />
      {menu === "options" && <div className="absolute right-3 top-full z-20 mt-1 flex flex-col rounded-lg border border-border bg-popover p-2 shadow-glow"><Button variant="ghost" onClick={() => { setMuted(!muted); setMenu(null); toast(muted ? "Avisos activados en este chat" : "Avisos silenciados en este chat"); }}>{muted ? <Volume2 size={17} /> : <VolumeX size={17} />} {muted ? "Activar avisos" : "Silenciar avisos"}</Button><Button variant="ghost" onClick={() => setMenu(null)}><X size={17} /> Cerrar</Button></div>}
    </div>
    <main ref={list} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-5" aria-label="Mensajes de voz">
      {items.map(({ note, extra }) => {
        if (note) {
          const mine = !!note.author.mine;
          const parent = note.parentId ? byId.get(note.parentId) : undefined;
          return <div key={note.id} className={`flex items-end gap-2 ${mine ? "flex-row-reverse" : ""}`}>
            <ChatAvatar note={note} chat={chat.name} />
            <VoiceBubble note={note} mine={mine} who={whoOf(note)} parentName={parent ? whoOf(parent) : undefined} onJump={parent ? () => jump(parent.id) : undefined} onReply={(atMs) => { setReplyTo({ note, atMs }); setTalk(true); }} />
          </div>;
        }
        const e = extra!;
        return <div key={e.id} className="flex flex-row-reverse items-end gap-2"><MeAvatar className="h-9 w-9 border border-primary/70 text-xs" />
          {e.kind === "reaction" ? <span className="rounded-full border border-border bg-card px-4 py-2 text-2xl" aria-label={`Reacción ${e.value}`}>{e.value}</span> : <img src={e.src} alt="Imagen enviada" className="max-h-48 max-w-[80%] rounded-lg border border-border object-contain" />}</div>;
      })}
    </main>
    <footer className="voice-chat-footer shrink-0 rounded-t-lg border border-primary/20 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3">
      {talk ? <VoiceComposer autoStart={!replyTo} autoFocus allowAnon={!!chat.group} target={replyTo ? { id: replyTo.note.id, name: whoOf(replyTo.note), author: replyTo.note.author, atMs: replyTo.atMs, durationMs: replyTo.note.durationMs } : undefined} sendLabel="Enviar nota de voz" onClose={() => { setTalk(false); setReplyTo(null); }} onSend={send} />
        : <>
          {menu === "attach" && <div className="mb-3 grid grid-cols-3 gap-2"><Button variant="secondary" className="h-16 flex-col gap-1 border border-border text-xs" onClick={() => setMenu("gifs")}><Film size={20} className="text-primary" /> GIF</Button><Button variant="secondary" className="h-16 flex-col gap-1 border border-border text-xs" onClick={() => input.current?.click()}><ImagePlus size={20} className="text-primary" /> Imagen</Button><Button variant="secondary" className="h-16 flex-col gap-1 border border-border text-xs" onClick={() => setMenu("reactions")}><Smile size={20} className="text-primary" /> Reacción</Button></div>}
          {menu === "gifs" && <div className="mb-3"><div className="mb-2 flex items-center justify-between"><span className="text-xs font-semibold">Reacciones Spotly</span><Button variant="ghost" size="icon" aria-label="Cerrar GIF" className="h-7 w-7" onClick={() => setMenu(null)}><X size={16} /></Button></div><div className="grid grid-cols-3 gap-2">{gifs.map((g) => <Button key={g.title} variant="secondary" className="h-20 flex-col gap-1 p-1" aria-label={`Enviar ${g.title}`} onClick={() => addExtra({ kind: "reaction", value: g.emoji })}><span className="text-4xl leading-none">{g.emoji}</span><span className="text-3xs text-muted-foreground">{g.title}</span></Button>)}</div></div>}
          {menu === "reactions" && <div className="mb-3 flex justify-around">{["❤️", "👏", "😂", "🔥", "🙌"].map((v) => <Button key={v} variant="ghost" size="icon" aria-label={`Enviar reacción ${v}`} className="text-2xl" onClick={() => addExtra({ kind: "reaction", value: v })}>{v}</Button>)}</div>}
          <input ref={input} type="file" accept="image/*" className="hidden" aria-label="Seleccionar imagen" onChange={(event) => choosePhoto(event.target.files?.[0])} />
          <p className="text-center text-xs text-muted-foreground">Toca para hablar · escúchate antes de enviar</p>
          <div className="mt-2 flex items-end justify-between gap-3">
            <Button variant="icon" size="icon" aria-label={menu ? "Cerrar adjuntos" : "Añadir GIF, imagen o reacción"} className="h-11 w-11 shrink-0" onClick={() => setMenu(menu ? null : "attach")}>{menu ? <X size={20} /> : <Plus size={22} />}</Button>
            <Button variant="icon" size="icon" aria-label="Grabar una nota de voz" className="voice-chat-mic h-[4.375rem] w-[4.375rem] text-primary" onClick={() => { setMenu(null); setReplyTo(null); setTalk(true); }}><Mic size={32} /></Button>
            <Button variant="icon" size="icon" aria-label="Abrir reacciones GIF" className="h-11 w-11 shrink-0" onClick={() => setMenu(menu === "gifs" ? null : "gifs")}><Film size={20} /></Button>
          </div>
        </>}
      <p className="mt-2 text-center text-3xs text-muted-foreground">Tus notas de voz se guardan en este dispositivo · las de ejemplo no tienen audio</p>
    </footer>
  </div>;
}

export function VoiceChats({ onBack, onAudioWall }: { onBack: () => void; onAudioWall: () => void }) {
  const me = useMe();
  const mineNotes = useMyVoiceNotes();
  const [open, setOpen] = useState<string | null>(null);
  const [read, setRead] = useState<string[]>([]);
  /* Chats de ejemplo + los que has empezado tú (mensajes de voz desde un perfil). */
  const chats = useMemo(() => {
    const extra = Array.from(new Set(mineNotes.filter((n) => n.threadId.startsWith("chat:")).map((n) => n.threadId.slice(5)))).filter((name) => !sampleChats.some((c) => c.name === name));
    return [...extra.map((name): ChatInfo => ({ name, unread: false, samples: [] })), ...sampleChats];
  }, [mineNotes]);
  const last = (c: ChatInfo) => { const mine = mineNotes.filter((n) => n.threadId === `chat:${c.name}`)[0]; return mine ? `Tú · nota de voz · ${formatClock(mine.durationMs)}` : c.samples.length ? `Nota de voz · ${c.samples[c.samples.length - 1]!.dur}` : "Sin mensajes"; };
  const chat = chats.find((c) => c.name === open);
  if (chat) return <ChatRoom chat={chat} onBack={() => setOpen(null)} />;
  return <Shell title="Chats de voz" onBack={onBack}>
    <Button className="mb-4 w-full bg-spot-gradient" onClick={onAudioWall}><Mic size={18} />Audio Wall en directo</Button>
    <div className="space-y-2">{chats.map((c) => <Button key={c.name} variant="secondary" onClick={() => { setOpen(c.name); setRead((r) => [...r, c.name]); }} className="h-auto w-full justify-start gap-3 rounded-lg border border-border bg-card p-3 text-left">
      <img src={lauraPhoto} alt="" className="h-9 w-9 shrink-0 rounded-full border border-primary/70 object-cover" />
      <span className="min-w-0 flex-1"><span className="block font-semibold">{c.name}{c.group && <span className="ml-1.5 rounded-full bg-primary/15 px-1.5 text-4xs font-bold text-primary">GRUPO</span>}{c.unread && !read.includes(c.name) && <span className="ml-2 text-live">●</span>}</span><span className="flex items-center gap-1 truncate text-xs font-normal text-muted-foreground"><Mic size={12} className="shrink-0 text-primary" /> {last(c)}</span></span>
    </Button>)}</div>
    <p className="mt-4 text-center text-2xs text-muted-foreground">Hablas como {me.name}. En los grupos, con Incógnito de pago puedes salir como «Anónimo».</p>
  </Shell>;
}
