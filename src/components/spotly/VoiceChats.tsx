import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, CornerDownRight, CornerUpLeft, Film, Ghost, ImagePlus, Loader2, Mic, MoreHorizontal, Pause, Play, Plus, Smile, Users, Volume2, VolumeX, WifiOff, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Shell } from "./Extras";
import { BottomSheet, TopBar } from "./kit";
import { AnonAvatar, MeAvatar } from "./Author";
import { FailedNote, VoiceComposer, VoiceWave, playNote, useVoiceName } from "./VoiceThread";
import { PersonAvatar } from "./CloudPeople";
import { useMe } from "@/lib/store";
import { addVoiceNote, useMyVoiceNotes, useThread, useThreadStatus, type ThreadNote } from "@/lib/voice/notes";
import { sampleThread, type SampleVoice } from "@/lib/voice/samples";
import { formatClock } from "@/lib/voice/recorder";
import { seekVoice, stopAllVoices, useVoicePlayback } from "@/lib/voice/player";
import { api, cloudErrorText, cloudUid, db, fileUrl, useCloud } from "@/lib/cloud";
import lauraPhoto from "@/assets/spotly-laura.jpg";

/**
 * Chats de voz (1 a 1 y de grupo, donde habla mucha gente): cada mensaje es una nota de voz real con su onda y su
 * progreso; se puede responder a un mensaje concreto («En respuesta a…», con el segundo exacto) y solo suena uno a
 * la vez. Grabar abre el panel común: escucha previa, descarte y envío explícito.
 *
 * Con la nube, los chats son los tuyos de verdad (privados: solo los oyen sus miembros), los grupos se crean con las
 * personas que sigues y las notas llegan en tiempo real. Sin nube se ven los chats de ejemplo y los que empiezas
 * desde un perfil, guardados en este dispositivo; ahí GIF, imágenes y reacciones viven solo en esta sesión.
 */
type ChatInfo = { id: string; threadId: string; name: string; group?: boolean; unread: boolean; samples: SampleVoice[]; avatar?: string | null | undefined; cloud?: ChatRowLite | undefined };
type ChatRowLite = { chatId: string; memberId: string | null; lastAt: string | null };
const ME = "__me__";
const sampleChats: ChatInfo[] = [
  { name: "María", unread: true, samples: [{ key: "1", name: "María", img: lauraPhoto, minsAgo: 30, dur: "0:12", likes: 0 }, { key: "2", name: ME, minsAgo: 28, dur: "0:28", likes: 0 }, { key: "3", name: "María", img: lauraPhoto, minsAgo: 20, dur: "0:15", likes: 0, replyTo: "2", replyAt: "0:19" }, { key: "4", name: ME, minsAgo: 18, dur: "0:09", likes: 0 }] },
  { name: "Carlos", unread: false, samples: [{ key: "1", name: "Carlos", img: lauraPhoto, minsAgo: 95, dur: "0:21", likes: 0 }] },
  { name: "Comunidad Triana", group: true, unread: true, samples: [{ key: "1", name: "Rocío", img: lauraPhoto, minsAgo: 50, dur: "1:05", likes: 0 }, { key: "2", name: "Anónimo", anon: true, minsAgo: 44, dur: "0:14", likes: 0 }, { key: "3", name: "Manu", img: lauraPhoto, minsAgo: 40, dur: "0:22", likes: 0, replyTo: "1", replyAt: "0:31" }] },
  { name: "Laura", unread: false, samples: [{ key: "1", name: "Laura", img: lauraPhoto, minsAgo: 160, dur: "0:09", likes: 0 }] },
].map((c) => ({ ...c, id: `ejemplo:${c.name}`, threadId: `chat:${c.name}`, avatar: lauraPhoto }));
const seedOf = (c: ChatInfo) => sampleThread(c.threadId, c.samples).map((n) => (n.author.name === ME ? { ...n, author: { name: "", mine: true } } : n));
const gifs = [{ title: "Corazón", emoji: "❤️" }, { title: "Onda", emoji: "🌊" }, { title: "Brillos", emoji: "✨" }];
type Extra = { id: string; kind: "image" | "reaction"; src?: string; value?: string; createdAt: number };
const ago = (iso: string | null) => { if (!iso) return ""; const m = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000)); return m < 1 ? "ahora" : m < 60 ? `hace ${m} min` : m < 1440 ? `hace ${Math.round(m / 60)} h` : `hace ${Math.round(m / 1440)} d`; };

function ChatAvatar({ note, chat }: { note: ThreadNote; chat: ChatInfo }) {
  if (note.author.anon) return <AnonAvatar className="h-9 w-9" size={16} />;
  if (note.author.mine) return <MeAvatar className="h-9 w-9 border border-primary/70 text-xs" />;
  return note.author.avatar ? <img src={note.author.avatar} alt={note.author.name || chat.name} className="h-9 w-9 shrink-0 rounded-full border border-primary/70 object-cover" /> : <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-secondary text-xs font-bold">{(note.author.name || chat.name).replace("@", "")[0]?.toUpperCase()}</span>;
}

/** Burbuja de voz del chat: diseño de bocadillo con la onda real, el progreso y el botón de responder. */
function VoiceBubble({ note, mine, who, parentName, onReply, onJump }: { note: ThreadNote; mine: boolean; who: string; parentName?: string | undefined; onReply: (atMs: number) => void; onJump?: (() => void) | undefined }) {
  const pb = useVoicePlayback(note.id);
  const total = pb.active && pb.durationMs ? pb.durationMs : note.durationMs;
  return (
    <div className={`flex min-w-0 flex-1 flex-col ${mine ? "items-end" : "items-start"}`}>
      <span className="mb-1 flex max-w-full items-center gap-1 px-1 text-3xs font-semibold text-muted-foreground">{note.author.anon && <Ghost size={11} className="shrink-0" />}<span className="truncate">{who}</span>{mine && !note.author.anon && <span className="shrink-0 font-normal">· tú</span>}{note.sample && <span className="shrink-0 font-normal">· ejemplo</span>}{note.pending && <span className="flex shrink-0 items-center gap-0.5 font-normal"><Loader2 size={10} className="animate-spin" />enviando…</span>}</span>
      {note.parentId && <button type="button" onClick={onJump} className="mb-1 flex max-w-[80%] items-center gap-1 rounded-full border border-border bg-card/70 px-2 py-0.5 text-3xs text-muted-foreground"><CornerDownRight size={11} className="shrink-0" /><span className="truncate">En respuesta a {parentName ?? "este audio"}{note.replyAtMs ? ` · ${formatClock(note.replyAtMs)}` : ""}</span></button>}
      <div className={`flex w-full items-center gap-1.5 ${mine ? "flex-row-reverse" : ""}`}>
        <div id={`voz-${note.id}`} className={`voice-chat-bubble ${mine ? "voice-chat-bubble-me" : "voice-chat-bubble-them"} flex h-12 w-[80%] min-w-0 max-w-[17rem] items-center gap-2 rounded-xl px-2 text-foreground ${note.pending ? "opacity-70" : ""}`}>
          <button type="button" onClick={() => playNote(note)} aria-label={`${pb.playing ? "Pausar" : "Reproducir"} la nota de voz de ${who}, ${formatClock(note.durationMs)}${note.src ? "" : ", ejemplo sin audio"}`} className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-foreground text-background">
            {pb.loading ? <Loader2 size={13} className="animate-spin" /> : pb.playing ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" className="ml-0.5" />}
          </button>
          <VoiceWave peaks={note.peaks.filter((_, i) => i % 2 === 0)} progress={pb.active && total ? pb.positionMs / total : 0} playhead={pb.active} className="h-7 flex-1" label={`Nota de voz de ${who}`} onSeek={note.src ? (r) => (pb.active ? seekVoice(note.id, r * total) : playNote(note, r)) : undefined} />
          <span className="shrink-0 text-xs tabular-nums">{formatClock(pb.active ? pb.positionMs : note.durationMs)}</span>
        </div>
        {!note.pending && !note.failed && <button type="button" onClick={() => onReply(pb.active ? pb.positionMs : 0)} aria-label={`Responder a esta nota de ${who}`} className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"><CornerUpLeft size={16} /></button>}
      </div>
      {note.failed && <FailedNote id={note.id} className="w-[80%] max-w-[17rem]" />}
    </div>
  );
}

function ChatRoom({ chat, onBack, onLeft }: { chat: ChatInfo; onBack: () => void; onLeft?: (() => void) | undefined }) {
  const threadId = chat.threadId;
  const seed = useMemo(() => (chat.cloud ? [] : seedOf(chat)), [chat]);
  const notes = useThread(threadId, seed);
  const status = useThreadStatus(threadId);
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
  const leave = async () => {
    const uid = cloudUid();
    if (!uid || !chat.cloud) return;
    try { await api.leaveChat(db(), uid, chat.cloud.chatId); toast(`Has salido de ${chat.name}`); onLeft?.(); onBack(); }
    catch (e) { toast.error(cloudErrorText(e)); }
  };
  const blockMember = async () => {
    const uid = cloudUid();
    if (!uid || !chat.cloud?.memberId) return;
    try { await api.block(db(), uid, chat.cloud.memberId, true); toast(`Has bloqueado a ${chat.name}`); onLeft?.(); onBack(); }
    catch (e) { toast.error(cloudErrorText(e)); }
  };
  const extrasOn = !chat.cloud;

  return <div className="fixed inset-0 z-40 mx-auto flex max-w-[520px] flex-col bg-background text-foreground">
    <div className="relative z-20 shrink-0">
      <TopBar title={chat.name} sub={chat.group ? <span>Grupo de voz · todos pueden hablar</span> : chat.cloud ? <span>Chat de voz privado</span> : <span className="inline-flex items-center gap-1"><span className="h-2 w-2 shrink-0 rounded-full bg-online" aria-hidden="true" /><span className="font-semibold text-online">En línea</span><span>· chat de voz</span></span>}
        leading={chat.group && chat.cloud ? <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-primary/70 bg-spot-gradient"><Users size={16} /></span> : chat.avatar ? <img src={chat.avatar} alt={chat.name} className="h-9 w-9 shrink-0 rounded-full border border-primary/70 object-cover" /> : <PersonAvatar p={{ name: chat.name }} className="h-9 w-9 border border-primary/70 text-xs" />} onBack={onBack} backLabel="Volver a chats"
        right={<Button variant="ghost" size="icon" className="text-foreground" aria-label="Opciones del chat" onClick={() => setMenu(menu === "options" ? null : "options")}><MoreHorizontal size={20} /></Button>} />
      {menu === "options" && <div className="absolute right-3 top-full z-20 mt-1 flex flex-col rounded-lg border border-border bg-popover p-2 shadow-glow">
        <Button variant="ghost" onClick={() => { setMuted(!muted); setMenu(null); toast(muted ? "Avisos activados en este chat" : "Avisos silenciados en este chat"); }}>{muted ? <Volume2 size={17} /> : <VolumeX size={17} />} {muted ? "Activar avisos" : "Silenciar avisos"}</Button>
        {chat.cloud && chat.group && <Button variant="ghost" className="text-live" onClick={() => { setMenu(null); void leave(); }}><X size={17} /> Salir del grupo</Button>}
        {chat.cloud && !chat.group && chat.cloud.memberId && <Button variant="ghost" className="text-live" onClick={() => { setMenu(null); void blockMember(); }}><X size={17} /> Bloquear a {chat.name}</Button>}
        <Button variant="ghost" onClick={() => setMenu(null)}><X size={17} /> Cerrar</Button>
      </div>}
    </div>
    <main ref={list} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-5" aria-label="Mensajes de voz">
      {status === "loading" && !items.length && <div className="grid h-full place-items-center" aria-busy="true"><Loader2 className="animate-spin text-primary" size={26} /></div>}
      {status === "error" && !items.length && <div className="grid h-full place-items-center text-center"><div><WifiOff className="mx-auto text-muted-foreground" size={26} /><p className="mt-2 text-sm text-muted-foreground">No se pudo cargar el chat. Comprueba tu conexión.</p></div></div>}
      {status === "ready" && !items.length && <div className="grid h-full place-items-center text-center"><div><Mic className="mx-auto text-primary" size={28} /><p className="mt-2 text-sm text-muted-foreground">{chat.group ? "Aún no ha hablado nadie. Rompe el hielo con tu voz." : `Empieza la conversación con ${chat.name} con tu voz.`}</p></div></div>}
      {items.map(({ note, extra }) => {
        if (note) {
          const mine = !!note.author.mine;
          const parent = note.parentId ? byId.get(note.parentId) : undefined;
          return <div key={note.id} className={`flex items-end gap-2 ${mine ? "flex-row-reverse" : ""}`}>
            <ChatAvatar note={note} chat={chat} />
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
          {extrasOn && menu === "attach" && <div className="mb-3 grid grid-cols-3 gap-2"><Button variant="secondary" className="h-16 flex-col gap-1 border border-border text-xs" onClick={() => setMenu("gifs")}><Film size={20} className="text-primary" /> GIF</Button><Button variant="secondary" className="h-16 flex-col gap-1 border border-border text-xs" onClick={() => input.current?.click()}><ImagePlus size={20} className="text-primary" /> Imagen</Button><Button variant="secondary" className="h-16 flex-col gap-1 border border-border text-xs" onClick={() => setMenu("reactions")}><Smile size={20} className="text-primary" /> Reacción</Button></div>}
          {extrasOn && menu === "gifs" && <div className="mb-3"><div className="mb-2 flex items-center justify-between"><span className="text-xs font-semibold">Reacciones Spotly</span><Button variant="ghost" size="icon" aria-label="Cerrar GIF" className="h-7 w-7" onClick={() => setMenu(null)}><X size={16} /></Button></div><div className="grid grid-cols-3 gap-2">{gifs.map((g) => <Button key={g.title} variant="secondary" className="h-20 flex-col gap-1 p-1" aria-label={`Enviar ${g.title}`} onClick={() => addExtra({ kind: "reaction", value: g.emoji })}><span className="text-4xl leading-none">{g.emoji}</span><span className="text-3xs text-muted-foreground">{g.title}</span></Button>)}</div></div>}
          {extrasOn && menu === "reactions" && <div className="mb-3 flex justify-around">{["❤️", "👏", "😂", "🔥", "🙌"].map((v) => <Button key={v} variant="ghost" size="icon" aria-label={`Enviar reacción ${v}`} className="text-2xl" onClick={() => addExtra({ kind: "reaction", value: v })}>{v}</Button>)}</div>}
          <input ref={input} type="file" accept="image/*" className="hidden" aria-label="Seleccionar imagen" onChange={(event) => choosePhoto(event.target.files?.[0])} />
          <p className="text-center text-xs text-muted-foreground">Toca para hablar · escúchate antes de enviar</p>
          <div className="mt-2 flex items-end justify-between gap-3">
            {extrasOn ? <Button variant="icon" size="icon" aria-label={menu ? "Cerrar adjuntos" : "Añadir GIF, imagen o reacción"} className="h-11 w-11 shrink-0" onClick={() => setMenu(menu ? null : "attach")}>{menu ? <X size={20} /> : <Plus size={22} />}</Button> : <span className="h-11 w-11 shrink-0" aria-hidden="true" />}
            <Button variant="icon" size="icon" aria-label="Grabar una nota de voz" className="voice-chat-mic h-[4.375rem] w-[4.375rem] text-primary" onClick={() => { setMenu(null); setReplyTo(null); setTalk(true); }}><Mic size={32} /></Button>
            {extrasOn ? <Button variant="icon" size="icon" aria-label="Abrir reacciones GIF" className="h-11 w-11 shrink-0" onClick={() => setMenu(menu === "gifs" ? null : "gifs")}><Film size={20} /></Button> : <span className="h-11 w-11 shrink-0" aria-hidden="true" />}
          </div>
        </>}
      <p className="mt-2 text-center text-3xs text-muted-foreground">{chat.cloud ? "Notas de voz privadas: solo las oye quien está en el chat" : "Tus notas de voz se guardan en este dispositivo · las de ejemplo no tienen audio"}</p>
    </footer>
  </div>;
}

/** Crear un grupo de voz con personas que sigues (el nombre del grupo es un título: lo único escrito). */
function NewGroup({ onClose, onCreated }: { onClose: () => void; onCreated: (chat: ChatInfo) => void }) {
  const [title, setTitle] = useState("");
  const [people, setPeople] = useState<api.ProfileRow[] | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => { const uid = cloudUid(); if (!uid) return; api.fetchPeople(db(), uid, "following").then(setPeople).catch(() => setPeople([])); }, []);
  const create = async () => {
    setBusy(true);
    try {
      const id = await api.createGroupChat(db(), title.trim(), picked);
      onCreated({ id, threadId: `chat:${id}`, name: title.trim(), group: true, unread: false, samples: [], cloud: { chatId: id, memberId: null, lastAt: null } });
    } catch (e) { toast.error(cloudErrorText(e)); setBusy(false); }
  };
  return (
    <BottomSheet title="Nuevo grupo de voz" onClose={onClose} z={70}>
      <label className="block text-xs text-muted-foreground">Nombre del grupo
        <input value={title} onChange={(e) => setTitle(e.target.value.slice(0, 60))} maxLength={60} placeholder="Ej.: Vecinos de Triana" className="mt-1 h-12 w-full rounded-xl border border-border bg-card px-3 text-base text-foreground outline-none placeholder:text-muted-foreground focus:border-primary" />
      </label>
      <p className="mb-2 mt-4 text-xs font-semibold text-muted-foreground">Personas que sigues</p>
      {!people && <div className="grid place-items-center py-6"><Loader2 className="animate-spin text-primary" size={22} /></div>}
      {people && !people.length && <p className="py-4 text-center text-sm text-muted-foreground">Sigue a alguien para poder añadirle a un grupo. También puedes crearlo solo y compartirlo después.</p>}
      <div className="max-h-[40vh] space-y-1 overflow-y-auto">
        {people?.map((p) => {
          const on = picked.includes(p.id);
          return (
            <button key={p.id} onClick={() => setPicked((l) => (on ? l.filter((x) => x !== p.id) : [...l, p.id]))} aria-pressed={on} className="flex w-full items-center gap-3 rounded-xl px-1 py-2 text-left">
              <PersonAvatar p={p} />
              <span className="min-w-0 flex-1"><strong className="block truncate text-sm">{p.display_name || p.username}</strong><small className="block truncate text-xs text-muted-foreground">@{p.username}</small></span>
              <span className={"grid h-6 w-6 shrink-0 place-items-center rounded-full border " + (on ? "border-transparent bg-spot-gradient" : "border-border")}>{on && <Check size={14} />}</span>
            </button>
          );
        })}
      </div>
      <Button className="mt-4 w-full" disabled={busy || !title.trim()} onClick={() => void create()}>{busy ? <Loader2 size={16} className="animate-spin" /> : <Users size={16} />}Crear grupo{picked.length ? ` con ${picked.length}` : ""}</Button>
    </BottomSheet>
  );
}

/** Tus chats en la nube (se refrescan al abrir, al volver a la app y cada 30 s). */
function useCloudChats(enabled: boolean) {
  const [chats, setChats] = useState<api.ChatRow[] | null>(null);
  const [error, setError] = useState(false);
  const load = useCallback(() => { api.fetchChats(db()).then((c) => { setChats(c); setError(false); }).catch(() => setError(true)); }, []);
  useEffect(() => {
    if (!enabled) return;
    load();
    const t = setInterval(load, 30000);
    const onVisible = () => { if (document.visibilityState === "visible") load(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", onVisible); };
  }, [enabled, load]);
  return { chats, error, reload: load };
}
const chatFromRow = (c: api.ChatRow): ChatInfo => {
  const other = c.members[0];
  const name = c.is_group ? c.title || "Grupo de voz" : other ? other.name || `@${other.username}` : "Chat";
  return { id: c.id, threadId: `chat:${c.id}`, name, group: c.is_group, unread: false, samples: [], avatar: c.is_group ? null : fileUrl(other?.avatar ?? null), cloud: { chatId: c.id, memberId: c.is_group ? null : other?.id ?? null, lastAt: c.last_at } };
};

export function VoiceChats({ onBack, onAudioWall }: { onBack: () => void; onAudioWall: () => void }) {
  const me = useMe();
  const cloud = useCloud();
  const mineNotes = useMyVoiceNotes();
  const remote = useCloudChats(cloud.on);
  const [open, setOpen] = useState<ChatInfo | null>(null);
  const [read, setRead] = useState<string[]>([]);
  const [newGroup, setNewGroup] = useState(false);
  /* Sin nube: chats de ejemplo + los que has empezado tú (mensajes de voz desde un perfil). */
  const local = useMemo(() => {
    const extra = Array.from(new Set(mineNotes.filter((n) => n.threadId.startsWith("chat:")).map((n) => n.threadId.slice(5)))).filter((name) => !sampleChats.some((c) => c.name === name));
    return [...extra.map((name): ChatInfo => ({ id: `local:${name}`, threadId: `chat:${name}`, name, unread: false, samples: [] })), ...sampleChats];
  }, [mineNotes]);
  const chats = cloud.on ? (remote.chats ?? []).map(chatFromRow) : local;
  const last = (c: ChatInfo) => {
    if (c.cloud) return c.cloud.lastAt ? `Nota de voz · ${ago(c.cloud.lastAt)}` : "Sin mensajes todavía";
    const mine = mineNotes.filter((n) => n.threadId === c.threadId)[0];
    return mine ? `Tú · nota de voz · ${formatClock(mine.durationMs)}` : c.samples.length ? `Nota de voz · ${c.samples[c.samples.length - 1]!.dur}` : "Sin mensajes";
  };
  if (open) return <ChatRoom chat={open} onBack={() => { setOpen(null); remote.reload(); }} onLeft={remote.reload} />;
  return <Shell title="Chats de voz" onBack={onBack}>
    <div className="mb-4 grid gap-2" style={{ gridTemplateColumns: cloud.on ? "1fr auto" : "1fr" }}>
      <Button className="w-full bg-spot-gradient" onClick={onAudioWall}><Mic size={18} />Audio Wall en directo</Button>
      {cloud.on && <Button variant="secondary" className="border border-border" onClick={() => setNewGroup(true)}><Users size={17} />Grupo</Button>}
    </div>
    {cloud.on && !remote.chats && !remote.error && <div className="grid place-items-center py-10"><Loader2 className="animate-spin text-primary" size={24} /></div>}
    {cloud.on && remote.error && !remote.chats && <div className="py-8 text-center"><WifiOff className="mx-auto text-muted-foreground" size={24} /><p className="mt-2 text-sm text-muted-foreground">No se pudieron cargar tus chats.</p><Button variant="secondary" size="sm" className="mt-3" onClick={remote.reload}>Reintentar</Button></div>}
    {cloud.on && remote.chats?.length === 0 && <div className="rounded-2xl border border-dashed border-border p-6 text-center"><Mic className="mx-auto text-primary" size={28} /><p className="mt-2 text-sm text-muted-foreground">Aún no tienes chats de voz. Manda un mensaje de voz desde el perfil de alguien o crea un grupo.</p></div>}
    <div className="space-y-2">{chats.map((c) => <Button key={c.id} variant="secondary" onClick={() => { setOpen(c); setRead((r) => [...r, c.id]); }} className="h-auto w-full justify-start gap-3 rounded-lg border border-border bg-card p-3 text-left">
      {c.group && c.cloud ? <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-primary/70 bg-spot-gradient"><Users size={16} /></span> : c.avatar ? <img src={c.avatar} alt="" className="h-9 w-9 shrink-0 rounded-full border border-primary/70 object-cover" /> : <PersonAvatar p={{ name: c.name }} className="h-9 w-9 border border-primary/70 text-xs" />}
      <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{c.name}{c.group && <span className="ml-1.5 rounded-full bg-primary/15 px-1.5 text-4xs font-bold text-primary">GRUPO</span>}{!c.cloud && c.samples.length > 0 && <span className="ml-1.5 text-4xs font-normal text-muted-foreground">ejemplo</span>}{c.unread && !read.includes(c.id) && <span className="ml-2 text-live">●</span>}</span><span className="flex items-center gap-1 truncate text-xs font-normal text-muted-foreground"><Mic size={12} className="shrink-0 text-primary" /> {last(c)}</span></span>
    </Button>)}</div>
    <p className="mt-4 text-center text-2xs text-muted-foreground">Hablas como {me.name}. En los grupos, con Incógnito de pago puedes salir como «Anónimo».</p>
    {newGroup && <NewGroup onClose={() => setNewGroup(false)} onCreated={(c) => { setNewGroup(false); remote.reload(); setOpen(c); }} />}
  </Shell>;
}
