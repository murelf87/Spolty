import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AudioLines, BadgeCheck, CornerDownRight, FileAudio, Heart, Loader2, MessageCircle, Mic, MoreVertical, Pause, Play, Send, Share2, Square, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { AnonAvatar, MeAvatar, SignAsChip } from "./Author";
import { BottomSheet } from "./kit";
import { useGate } from "./Gate";
import { addReport, useMe, useStore } from "@/lib/store";
import { commerce } from "@/lib/spotlyConfig";
import { formatClock, recorderErrorText, useVoiceRecorder, type VoiceClip } from "@/lib/voice/recorder";
import { onVoiceError, playVoice, releaseVoice, seekVoice, stopAllVoices, toggleVoice, useVoicePlayback } from "@/lib/voice/player";
import { addVoiceNote, removeVoiceNote, toggleVoiceLike, useThread, type ThreadNote, type VoiceNote } from "@/lib/voice/notes";

/**
 * Voz en toda la app con un mismo diseño:
 *  - VoiceItem: avatar con aro, play, onda con el progreso real, tiempo actual y total, me gusta, respuestas,
 *    compartir y opciones; si responde a otra voz, «En respuesta a este audio».
 *  - VoiceComposer: «Respondiendo a…» con el minuto del audio original, grabar/parar, onda en vivo, tiempo y enviar.
 *  - VoiceThread: un hilo (Spot, foto, Hot Spot, chat de grupo, comunidad, evento…) con las respuestas encadenadas.
 * Todo es voz: no hay comentarios escritos.
 */

const rel = (t: number) => {
  const m = Math.max(0, Math.round((Date.now() - t) / 60000));
  return m < 1 ? "ahora" : m < 60 ? `hace ${m} min` : m < 1440 ? `hace ${Math.round(m / 60)} h` : `hace ${Math.round(m / 1440)} d`;
};

/** Onda de un audio: barras con la forma real; lo escuchado con el degradado de marca y un punto en la posición. */
export function VoiceWave({ peaks, progress = 0, playhead = false, onSeek, className = "", label }: { peaks: number[]; progress?: number; playhead?: boolean; onSeek?: ((ratio: number) => void) | undefined; className?: string; label?: string }) {
  const n = peaks.length || 1;
  const p = Math.max(0, Math.min(1, progress));
  return (
    <div role={onSeek ? "slider" : undefined} aria-label={label} aria-valuemin={onSeek ? 0 : undefined} aria-valuemax={onSeek ? 100 : undefined} aria-valuenow={onSeek ? Math.round(p * 100) : undefined} tabIndex={onSeek ? 0 : undefined}
      onClick={onSeek ? (e) => { const r = e.currentTarget.getBoundingClientRect(); onSeek((e.clientX - r.left) / r.width); } : undefined}
      onKeyDown={onSeek ? (e) => { if (e.key === "ArrowRight") onSeek(Math.min(1, p + 0.05)); else if (e.key === "ArrowLeft") onSeek(Math.max(0, p - 0.05)); } : undefined}
      className={"relative flex h-9 min-w-0 items-center justify-between gap-[0.125rem] " + (onSeek ? "cursor-pointer touch-manipulation " : "") + className}>
      {peaks.map((h, i) => {
        const played = (i + 0.5) / n <= p;
        return <span key={i} aria-hidden="true" className="spot-voice-bar" style={{ height: `${Math.round(h * 100)}%`, background: played ? `color-mix(in oklab, var(--wave-from) ${Math.round(100 - (i / n) * 100)}%, var(--wave-to))` : undefined }} data-played={played || undefined} />;
      })}
      {playhead && p > 0 && <span aria-hidden="true" className="spot-voice-head" style={{ left: `${p * 100}%` }} />}
    </div>
  );
}

/** Avatar del autor con el aro de marca (fantasma si es anónimo; tu foto si es tuyo). */
function VoiceAvatar({ author, size = "h-12 w-12" }: { author: VoiceNote["author"]; size?: string }) {
  if (author.anon) return <span className={"spot-voice-ring shrink-0 rounded-full p-[0.125rem] " + size}><AnonAvatar className="h-full w-full" size={18} /></span>;
  return (
    <span className={"spot-voice-ring shrink-0 rounded-full p-[0.125rem] " + size}>
      {author.mine ? <MeAvatar className="h-full w-full text-sm" /> : author.avatar
        ? <img src={author.avatar} alt="" className="h-full w-full rounded-full border-2 border-card object-cover" />
        : <span className="grid h-full w-full place-items-center rounded-full border-2 border-card bg-secondary text-sm font-bold">{(author.name.trim()[0] ?? "?").toUpperCase()}</span>}
    </span>
  );
}

/** Nombre visible de una voz: «Anónimo» con Incógnito de pago, tu nombre si es tuya. */
export function useVoiceName() {
  const me = useMe();
  return useCallback((a: VoiceNote["author"]) => (a.anon ? "Anónimo" : a.mine ? me.name : a.name), [me.name]);
}

/** Reproduce una voz (o avisa si es de ejemplo y no tiene audio). */
export function playNote(note: Pick<VoiceNote, "id" | "src" | "durationMs">, atRatio?: number) {
  if (!note.src) { toast("Voz de ejemplo: no tiene audio. Las voces reales se escuchan aquí mismo."); return; }
  if (atRatio === undefined) toggleVoice(note.id, note.src, note.durationMs);
  else playVoice(note.id, note.src, note.durationMs, atRatio * note.durationMs);
}

/** Tarjeta de una voz con el diseño de Spotly. */
export function VoiceItem({ note, onReply, onMore, parentName, highlight = false, compact = false, right }: {
  note: ThreadNote; onReply?: ((atMs: number) => void) | undefined; onMore?: (() => void) | undefined; parentName?: string | undefined; highlight?: boolean; compact?: boolean; right?: ReactNode;
}) {
  const name = useVoiceName()(note.author);
  const pb = useVoicePlayback(note.id);
  const total = pb.active && pb.durationMs ? pb.durationMs : note.durationMs;
  const progress = pb.active && total ? pb.positionMs / total : 0;
  const reply = () => onReply?.(pb.active ? pb.positionMs : 0);
  const share = async () => {
    const url = `https://spotly.app/voz/${note.id}`;
    try { if (navigator.share) { await navigator.share({ title: `Voz de ${name} en Spotly`, url }); return; } await navigator.clipboard?.writeText(url); toast("Enlace copiado"); } catch { toast("Enlace copiado"); }
  };
  return (
    <article id={`voz-${note.id}`} className={"spot-voice-card rounded-3xl p-3 transition-shadow " + (highlight ? "spot-voice-highlight " : "")} aria-label={`Voz de ${name}, ${formatClock(note.durationMs)}`}>
      <div className="flex gap-3">
        <VoiceAvatar author={note.author} size={compact ? "h-10 w-10" : "h-12 w-12"} />
        <div className="min-w-0 flex-1">
          <div className="flex min-h-6 items-center gap-1">
            <strong className="truncate text-sm">{name}</strong>
            {note.author.verified && !note.author.anon && <BadgeCheck size={14} className="shrink-0 text-primary" aria-label="Verificado" />}
            {note.author.mine && !note.author.anon && <span className="shrink-0 rounded-full bg-primary/15 px-1.5 text-4xs font-bold text-primary">TÚ</span>}
            <span className="shrink-0 truncate text-2xs text-muted-foreground">· {rel(note.createdAt)}</span>
            {note.sample && <span className="ml-1 shrink-0 rounded-full border border-border px-1.5 text-4xs text-muted-foreground">ejemplo</span>}
            {onMore && <button type="button" onClick={onMore} aria-label={`Opciones de la voz de ${name}`} className="-mr-1 ml-auto grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted-foreground hover:text-foreground"><MoreVertical size={17} /></button>}
          </div>
          <div className="mt-1 flex items-center gap-2.5">
            <button type="button" onClick={() => playNote(note)} aria-label={`${pb.playing ? "Pausar" : "Escuchar"} la voz de ${name}`}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-secondary text-foreground transition active:scale-95">
              {pb.loading ? <Loader2 size={16} className="animate-spin" /> : pb.playing ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" className="ml-0.5" />}
            </button>
            <div className="min-w-0 flex-1">
              <VoiceWave peaks={note.peaks} progress={progress} playhead={pb.active} label={`Posición en la voz de ${name}`} onSeek={note.src ? (r) => (pb.active ? seekVoice(note.id, r * total) : playNote(note, r)) : undefined} />
              <div className="mt-0.5 flex justify-between text-3xs tabular-nums text-muted-foreground"><span>{formatClock(pb.active ? pb.positionMs : 0)}</span><span>{formatClock(total)}</span></div>
            </div>
          </div>
          <div className="mt-1 flex items-center gap-1 text-muted-foreground">
            <button type="button" onClick={() => toggleVoiceLike(note.id)} aria-pressed={note.liked} aria-label={`Me gusta (${note.likes})`} className={"flex min-h-9 items-center gap-1.5 rounded-full px-2 text-xs " + (note.liked ? "text-live" : "hover:text-foreground")}>
              <Heart size={18} fill={note.liked ? "currentColor" : "none"} /><span className="tabular-nums">{note.likes}</span>
            </button>
            {onReply && <button type="button" onClick={reply} aria-label={`Responder con tu voz (${note.replies} respuestas)`} className="flex min-h-9 items-center gap-1.5 rounded-full px-2 text-xs hover:text-foreground">
              <MessageCircle size={18} /><span className="tabular-nums">{note.replies}</span>
            </button>}
            <button type="button" onClick={() => void share()} aria-label="Compartir" className="grid min-h-9 min-w-9 place-items-center rounded-full hover:text-foreground"><Share2 size={17} /></button>
            {right && <span className="ml-auto">{right}</span>}
          </div>
          {note.parentId && <p className="mt-0.5 flex items-center gap-1.5 text-2xs text-muted-foreground"><CornerDownRight size={14} className="shrink-0" />{parentName ? <>En respuesta a <strong className="truncate font-semibold text-foreground/80">{parentName}</strong>{note.replyAtMs ? ` · ${formatClock(note.replyAtMs)}` : ""}</> : "En respuesta a este audio"}</p>}
        </div>
      </div>
    </article>
  );
}

export type ReplyTarget = { id?: string | undefined; name: string; author?: VoiceNote["author"] | undefined; atMs: number; durationMs: number };

/**
 * Panel para responder (o hablar) con tu voz. Graba con el micrófono real; mientras grabas puedes parar para
 * escucharte o enviar directamente. Nada se envía sin pulsar enviar y nunca un toque accidental (< 1 s).
 */
export function VoiceComposer({ target, onSend, onClose, maxSeconds: maxProp, pointer = false, autoFocus = false, autoStart = false, allowAnon = true, sendLabel = "Enviar voz" }: {
  target?: ReplyTarget | undefined; onSend: (clip: VoiceClip, anon: boolean) => void; onClose?: (() => void) | undefined; maxSeconds?: number | undefined; pointer?: boolean; autoFocus?: boolean; autoStart?: boolean; allowAnon?: boolean; sendLabel?: string;
}) {
  const { incognito } = useStore();
  const maxSeconds = maxProp ?? commerce.voiceMaxSeconds;
  const rec = useVoiceRecorder({ maxSeconds });
  const [anon, setAnon] = useState(allowAnon && incognito.active);
  const [pendingSend, setPendingSend] = useState(false);
  const previewId = useRef(`preview-${Math.random().toString(36).slice(2)}`).current;
  const pb = useVoicePlayback(previewId);
  const file = useRef<HTMLInputElement | null>(null);
  const main = useRef<HTMLButtonElement | null>(null);
  const gate = useGate({ verified: true, online: true });
  const send = useCallback(() => {
    if (rec.state === "recording") { setPendingSend(true); rec.stop(); return; }
    if (rec.state !== "recorded") return;
    if (pb.active) stopAllVoices();
    const clip = rec.take();
    if (clip) onSend(clip, anon);
  }, [anon, onSend, pb.active, rec]);
  useEffect(() => { if (pendingSend && rec.state === "recorded") { setPendingSend(false); send(); } else if (pendingSend && rec.state === "idle") setPendingSend(false); }, [pendingSend, rec.state, send]);
  useEffect(() => { if (rec.error) toast.error(recorderErrorText(rec.error, maxSeconds)); }, [rec.error, maxSeconds]);
  useEffect(() => { if (autoFocus) main.current?.focus(); }, [autoFocus]);
  /* Empezar a grabar nada más abrir (chats): el toque que abrió el panel cuenta como gesto del usuario. */
  useEffect(() => { if (autoStart) void rec.start(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => releaseVoice(previewId), [previewId]);

  const recording = rec.state === "recording", recorded = rec.state === "recorded" && rec.clip;
  const canSend = recording ? rec.elapsedMs >= 800 : !!recorded;
  const mainAction = () => {
    if (rec.state === "idle") void rec.start();
    else if (recording) rec.stop();
    else if (recorded && rec.clip) toggleVoice(previewId, rec.clip.url, rec.clip.durationMs);
  };
  const time = recorded && rec.clip ? (pb.active ? `${formatClock(pb.positionMs)}` : formatClock(rec.clip.durationMs)) : formatClock(rec.elapsedMs);
  const liveBars = Array.from({ length: 40 }, (_, i) => rec.live[rec.live.length - 40 + i]);

  return (
    <div className="relative">
      {pointer && <span aria-hidden="true" className="spot-voice-pointer" />}
      <div className="spot-voice-composer rounded-3xl p-[0.09375rem]">
        <div className="rounded-[calc(1.5rem-0.09375rem)] bg-card px-3 pb-2.5 pt-3">
          {target && <div className="flex items-center gap-2.5 border-b border-border/50 pb-2.5">
            {target.author ? <VoiceAvatar author={target.author} size="h-9 w-9" /> : <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-secondary text-primary"><AudioLines size={16} /></span>}
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs text-muted-foreground">Respondiendo a <strong className="font-semibold text-foreground">{target.name}</strong></p>
              <p className="flex items-center gap-1.5 text-2xs tabular-nums text-muted-foreground"><AudioLines size={14} className="text-primary" />{target.durationMs > 0 ? `${formatClock(target.atMs)} / ${formatClock(target.durationMs)}` : "Tu voz quedará enlazada a su audio"}</p>
            </div>
            {onClose && <button type="button" onClick={() => { rec.cancel(); onClose(); }} aria-label="Cancelar respuesta" className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted-foreground hover:text-foreground"><X size={18} /></button>}
          </div>}
          {gate ? <div className="pt-3">{gate}</div> : <>
            <div className={"flex items-center gap-3 " + (target ? "pt-3" : "")}>
              <button ref={main} type="button" onClick={mainAction} disabled={rec.state === "requesting"}
                aria-label={rec.state === "idle" ? "Grabar con el micrófono" : recording ? "Parar y escuchar antes de enviar" : pb.playing ? "Pausar la escucha" : "Escuchar tu grabación"}
                className={"grid h-[3.25rem] w-[3.25rem] shrink-0 place-items-center rounded-full text-white transition active:scale-95 " + (recording ? "spot-voice-stop" : recorded ? "bg-secondary text-foreground" : "spot-voice-send")}>
                {rec.state === "requesting" ? <Loader2 size={22} className="animate-spin" /> : recording ? <Square size={20} fill="currentColor" /> : recorded ? (pb.playing ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-0.5" />) : <Mic size={24} />}
              </button>
              <div className="min-w-0 flex-1">
                {recorded && rec.clip
                  ? <VoiceWave peaks={rec.clip.peaks} progress={pb.active && rec.clip.durationMs ? pb.positionMs / rec.clip.durationMs : 0} playhead={pb.active} label="Tu grabación" onSeek={(r) => playVoice(previewId, rec.clip!.url, rec.clip!.durationMs, r * rec.clip!.durationMs)} />
                  : <div className="flex h-9 items-center justify-between gap-[0.125rem]" aria-hidden="true">{liveBars.map((v, i) => v === undefined
                      ? <span key={i} className="h-1 w-1 shrink-0 rounded-full bg-muted-foreground/35" />
                      : <span key={i} className="spot-voice-bar" style={{ height: `${Math.round(Math.max(0.1, Math.min(1, v * 9)) * 100)}%`, background: `color-mix(in oklab, var(--wave-from) ${Math.round(100 - (i / 40) * 60)}%, var(--wave-to))` }} />)}</div>}
              </div>
              <span className="w-10 shrink-0 text-right text-sm font-semibold tabular-nums" aria-live="polite">{time}</span>
              <button type="button" onClick={send} disabled={!canSend} aria-label={sendLabel} className="spot-voice-send grid h-[3.25rem] w-[3.25rem] shrink-0 place-items-center rounded-full text-white transition active:scale-95 disabled:opacity-35">
                {pendingSend ? <Loader2 size={22} className="animate-spin" /> : <Send size={22} className="-ml-0.5" />}
              </button>
            </div>
            <div className="mt-2 flex min-h-8 items-center gap-2">
              {allowAnon ? <SignAsChip anon={anon} onChange={setAnon} /> : null}
              <span className="ml-auto truncate text-3xs text-muted-foreground">
                {rec.state === "idle" && `Pulsa el micrófono y habla · máx. ${maxSeconds} s`}
                {rec.state === "requesting" && "Permite el micrófono…"}
                {recording && "Grabando… ■ para escucharte"}
              </span>
              {recorded && <button type="button" onClick={() => { if (pb.active) stopAllVoices(); rec.discard(); }} className="flex min-h-8 shrink-0 items-center gap-1 rounded-full px-2 text-2xs font-semibold text-live"><Trash2 size={14} />Descartar</button>}
              {rec.state === "idle" && (rec.error === "denied" || rec.error === "unsupported" || rec.error === "failed" || !rec.supported) && <button type="button" onClick={() => file.current?.click()} className="flex min-h-8 shrink-0 items-center gap-1 rounded-full px-2 text-2xs font-semibold text-primary"><FileAudio size={14} />Elegir audio</button>}
              <input ref={file} type="file" accept="audio/*" className="hidden" aria-label="Elegir un audio del dispositivo" onChange={(e) => { const f = e.target.files?.[0]; if (f) void rec.fromFile(f); e.target.value = ""; }} />
            </div>
          </>}
        </div>
      </div>
    </div>
  );
}

/** Opciones de una voz: responder, borrar (si es tuya) o denunciar. */
function VoiceMenu({ note, name, onReply, onClose }: { note: ThreadNote; name: string; onReply: () => void; onClose: () => void }) {
  return (
    <BottomSheet title={`Voz de ${name}`} onClose={onClose} z={90}>
      <button onClick={() => { onClose(); onReply(); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm hover:bg-secondary"><Mic size={18} className="text-primary" />Responder con tu voz</button>
      {note.author.mine
        ? <button onClick={() => { removeVoiceNote(note.id); toast("Voz eliminada"); onClose(); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm text-live hover:bg-secondary"><Trash2 size={18} />Eliminar mi voz</button>
        : <button onClick={() => { addReport(`Voz de ${name}`, "Denunciada desde una conversación de voz"); toast("Gracias. Revisaremos esta voz."); onClose(); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm text-live hover:bg-secondary"><X size={18} />Denunciar esta voz</button>}
    </BottomSheet>
  );
}

/**
 * Hilo de voces con respuestas encadenadas. `root` es el audio principal (el Spot, la foto…) al que se responde
 * desde el botón inferior; cada voz tiene su propio «Responder» que abre el panel justo debajo.
 */
export function VoiceThread({ threadId, seed, root, emptyText = "Sé la primera voz de esta conversación.", composerOpen = false, onComposerClose, maxSeconds, freshId }: {
  threadId: string; seed?: VoiceNote[] | undefined; root?: ReplyTarget | undefined; emptyText?: string; composerOpen?: boolean; onComposerClose?: (() => void) | undefined; maxSeconds?: number | undefined; freshId?: string | null | undefined;
}) {
  const notes = useThread(threadId, seed);
  const nameOf = useVoiceName();
  const [replyTo, setReplyTo] = useState<{ note: ThreadNote; atMs: number } | null>(null);
  const [rootOpen, setRootOpen] = useState(composerOpen);
  const [menu, setMenu] = useState<ThreadNote | null>(null);
  const [fresh, setFresh] = useState<string | null>(null);
  useEffect(() => { setRootOpen(composerOpen); }, [composerOpen]);
  useEffect(() => { if (freshId) setFresh(freshId); }, [freshId]);
  useEffect(() => () => stopAllVoices(), []);
  useEffect(() => { if (!fresh) return; const t = window.setTimeout(() => setFresh(null), 2400); document.getElementById(`voz-${fresh}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" }); return () => window.clearTimeout(t); }, [fresh]);

  const byId = useMemo(() => new Map(notes.map((n) => [n.id, n])), [notes]);
  /* Raíces (lo más nuevo arriba) y, debajo de cada una, toda su conversación en orden. */
  const groups = useMemo(() => {
    const rootOf = (n: ThreadNote): ThreadNote => { let cur = n; const seen = new Set<string>(); while (cur.parentId && byId.has(cur.parentId) && !seen.has(cur.id)) { seen.add(cur.id); cur = byId.get(cur.parentId)!; } return cur; };
    const map = new Map<string, ThreadNote[]>();
    for (const n of notes) { const r = rootOf(n); if (r.id !== n.id) map.set(r.id, [...(map.get(r.id) ?? []), n]); }
    return notes.filter((n) => !n.parentId || !byId.has(n.parentId)).sort((a, b) => b.createdAt - a.createdAt).map((r) => ({ root: r, replies: (map.get(r.id) ?? []).sort((a, b) => a.createdAt - b.createdAt) }));
  }, [notes, byId]);

  const publish = (clip: VoiceClip, anon: boolean, parent: { note: ThreadNote; atMs: number } | null) => {
    const n = addVoiceNote({ threadId, parentId: parent?.note.id ?? null, replyAtMs: parent?.atMs, clip, anon });
    toast.success(anon ? "Voz enviada como «Anónimo»" : "Voz enviada");
    setFresh(n.id);
    setReplyTo(null); setRootOpen(false); onComposerClose?.();
  };
  const composerFor = (note: ThreadNote) => replyTo?.note.id === note.id && (
    <div className="mt-2"><VoiceComposer pointer autoFocus maxSeconds={maxSeconds} target={{ id: note.id, name: nameOf(note.author), author: note.author, atMs: replyTo.atMs, durationMs: note.durationMs }} onClose={() => setReplyTo(null)} onSend={(c, a) => publish(c, a, replyTo)} /></div>
  );

  return (
    <div className="space-y-3">
      {rootOpen && <VoiceComposer autoFocus maxSeconds={maxSeconds} target={root} onClose={() => { setRootOpen(false); onComposerClose?.(); }} onSend={(c, a) => publish(c, a, null)} />}
      {groups.length === 0 && !rootOpen && <div className="rounded-3xl border border-dashed border-border p-6 text-center"><Mic className="mx-auto text-primary" size={28} /><p className="mt-2 text-sm text-muted-foreground">{emptyText}</p></div>}
      {groups.map(({ root: r, replies }) => (
        <div key={r.id} className="space-y-2">
          <VoiceItem note={r} highlight={fresh === r.id} onReply={(atMs) => { setRootOpen(false); setReplyTo({ note: r, atMs }); }} onMore={() => setMenu(r)} />
          {composerFor(r)}
          {replies.length > 0 && <div className="space-y-2 border-l-2 border-border/60 pl-3">
            {replies.map((n) => {
              const parent = n.parentId ? byId.get(n.parentId) : undefined;
              return (
                <div key={n.id}>
                  <VoiceItem note={n} compact highlight={fresh === n.id} parentName={parent && parent.id !== r.id ? nameOf(parent.author) : undefined} onReply={(atMs) => { setRootOpen(false); setReplyTo({ note: n, atMs }); }} onMore={() => setMenu(n)} />
                  {composerFor(n)}
                </div>
              );
            })}
          </div>}
        </div>
      ))}
      {menu && <VoiceMenu note={menu} name={nameOf(menu.author)} onClose={() => setMenu(null)} onReply={() => setReplyTo({ note: menu, atMs: 0 })} />}
    </div>
  );
}

/** Botón «Habla en esta conversación» (barra inferior de los hilos). */
export function TalkBar({ onTalk, label = "Responde con tu voz…" }: { onTalk: () => void; label?: string }) {
  return (
    <div className="flex items-center gap-3">
      <MeAvatar className="h-9 w-9 text-xs" />
      <button type="button" onClick={onTalk} className="flex min-h-11 flex-1 items-center gap-2 rounded-full bg-secondary px-4 text-left text-sm text-muted-foreground">
        <Mic size={16} className="shrink-0 text-primary" />{label}
      </button>
    </div>
  );
}

/** Muestra como aviso los errores del reproductor único (se monta una vez en la raíz de la app). */
export function VoiceErrorToasts() {
  useEffect(() => onVoiceError((m) => toast.error(m)), []);
  return null;
}
