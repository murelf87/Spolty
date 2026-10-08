import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AlertCircle, AudioLines, BadgeCheck, CornerDownRight, FileAudio, Forward, Heart, Loader2, MessageCircle, Mic, MoreVertical, Pause, Play, RotateCcw, Send, Square, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { AnonAvatar, MeAvatar, SignAsChip, useAnonAllowed } from "./Author";
import { BottomSheet } from "./kit";
import { useGate } from "./Gate";
import { addReport, useMe, useStore } from "@/lib/store";
import { commerce } from "@/lib/spotlyConfig";
import { formatClock, recorderErrorText, useVoiceRecorder, type VoiceClip } from "@/lib/voice/recorder";
import { onVoiceError, playVoice, releaseVoice, seekVoice, stopAllVoices, toggleVoice, useVoicePlayback } from "@/lib/voice/player";
import { addVoiceNote, removeVoiceNote, retryVoiceNote, toggleVoiceLike, useThread, useThreadStatus, type ThreadNote, type VoiceNote } from "@/lib/voice/notes";
import { api, cloudErrorText, cloudUid, db } from "@/lib/cloud";
import { appUrl, shareLink, spotLink } from "@/lib/share";

/**
 * Voz en toda la app con el diseño de las respuestas de voz de Spotly:
 *  - VoiceItem (una fila): avatar con aro, play, onda con el progreso real, tiempo actual y total, me gusta,
 *    respuestas, compartir y opciones; si responde a otra voz, «En respuesta a este audio» debajo.
 *  - VoiceComposer (una fila, con borde degradado y pico hacia la voz a la que respondes): «Respondiendo a» con su
 *    foto y el minuto del audio original | parar · onda en vivo · tiempo · enviar.
 *  - VoiceThread: un hilo (Spot, foto, Hot Spot, chat de grupo, comunidad, evento…) con las respuestas encadenadas.
 * Todo es voz: no hay comentarios escritos. El micrófono solo aparece para grabar; para escuchar, play o altavoz.
 */

const rel = (t: number) => {
  const m = Math.max(0, Math.round((Date.now() - t) / 60000));
  return m < 1 ? "ahora" : m < 60 ? `hace ${m} min` : m < 1440 ? `hace ${Math.round(m / 60)} h` : `hace ${Math.round(m / 1440)} d`;
};

/** Cuántas barras caben de verdad (barra mínima de 0,125rem y hueco de 0,125rem): la onda nunca se sale de su sitio. */
function useBarSlots() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [slots, setSlots] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      setSlots(Math.max(6, Math.floor((el.clientWidth + rem * 0.125) / (rem * 0.25))));
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, slots] as const;
}
/** Reduce la forma de onda a `n` barras quedándose con el pico de cada tramo (así no se pierden los golpes de voz). */
function fitPeaks(peaks: number[], n: number): number[] {
  if (!n || peaks.length <= n) return peaks;
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = Math.floor((i * peaks.length) / n), b = Math.max(a + 1, Math.floor(((i + 1) * peaks.length) / n));
    let m = 0;
    for (let j = a; j < b; j++) m = Math.max(m, peaks[j] ?? 0);
    out.push(m);
  }
  return out;
}

/** Onda de un audio: barras con la forma real; lo escuchado con el degradado de marca y un punto en la posición. */
export function VoiceWave({ peaks, progress = 0, playhead = false, onSeek, className = "", label }: { peaks: number[]; progress?: number; playhead?: boolean; onSeek?: ((ratio: number) => void) | undefined; className?: string; label?: string }) {
  const [ref, slots] = useBarSlots();
  const bars = useMemo(() => fitPeaks(peaks, slots), [peaks, slots]);
  const n = bars.length || 1;
  const p = Math.max(0, Math.min(1, progress));
  return (
    <div ref={ref} role={onSeek ? "slider" : undefined} aria-label={label} aria-valuemin={onSeek ? 0 : undefined} aria-valuemax={onSeek ? 100 : undefined} aria-valuenow={onSeek ? Math.round(p * 100) : undefined} tabIndex={onSeek ? 0 : undefined}
      onClick={onSeek ? (e) => { const r = e.currentTarget.getBoundingClientRect(); onSeek((e.clientX - r.left) / r.width); } : undefined}
      onKeyDown={onSeek ? (e) => { if (e.key === "ArrowRight") onSeek(Math.min(1, p + 0.05)); else if (e.key === "ArrowLeft") onSeek(Math.max(0, p - 0.05)); } : undefined}
      className={"relative flex h-9 min-w-0 items-center justify-between gap-[0.125rem] " + (slots ? "" : "overflow-hidden ") + (onSeek ? "cursor-pointer touch-manipulation " : "") + className}>
      {bars.map((h, i) => {
        const played = (i + 0.5) / n <= p;
        return <span key={i} aria-hidden="true" className="spot-voice-bar" style={{ height: `${Math.round(h * 100)}%`, background: played ? `color-mix(in oklab, var(--wave-from) ${Math.round(100 - (i / n) * 100)}%, var(--wave-to))` : undefined }} data-played={played || undefined} />;
      })}
      {playhead && p > 0 && <span aria-hidden="true" className="spot-voice-head" style={{ left: `${p * 100}%` }} />}
    </div>
  );
}

/**
 * Onda mientras grabas: crece de izquierda a derecha con el nivel real de tu voz (los silencios, en puntos; lo que
 * falta, en puntos grises) y, al llenarse, avanza con lo último que dices.
 */
function LiveWave({ levels }: { levels: number[] }) {
  const [ref, slots] = useBarSlots();
  const n = slots || 24;
  const shown: (number | undefined)[] = levels.length >= n ? levels.slice(-n) : [...levels, ...Array.from({ length: n - levels.length }, () => undefined)];
  return (
    <div ref={ref} className="flex h-9 min-w-0 items-center justify-between gap-[0.125rem] overflow-hidden" aria-hidden="true">
      {shown.map((v, i) => v === undefined
        ? <span key={i} className="h-[0.1875rem] w-[0.1875rem] shrink-0 rounded-full bg-muted-foreground/30" />
        : v * 9 < 0.06
          ? <span key={i} className="h-[0.1875rem] w-[0.1875rem] shrink-0 rounded-full" style={{ background: "var(--wave-from)" }} />
          : <span key={i} className="spot-voice-bar" style={{ height: `${Math.round(Math.min(1, v * 9) * 100)}%`, background: `color-mix(in oklab, var(--wave-from) ${Math.round(100 - (i / n) * 45)}%, var(--wave-to))` }} />)}
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

/** Botón de la fila de una voz: el icono a la altura de la onda y la cifra debajo, a la altura de los tiempos. */
function VoiceAction({ label, onClick, count, pressed, narrow = false, className = "", children }: { label: string; onClick: () => void; count?: number | undefined; pressed?: boolean | undefined; narrow?: boolean; className?: string; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} aria-pressed={pressed}
      className={"flex shrink-0 flex-col items-center rounded-xl transition hover:text-foreground active:scale-95 " + (narrow ? "w-6 " : "w-8 ") + (className || "text-muted-foreground")}>
      <span className="h-4" aria-hidden="true" />
      <span className="grid h-8 place-items-center">{children}</span>
      <span className="h-3.5 text-3xs leading-[0.875rem] tabular-nums">{count ?? ""}</span>
    </button>
  );
}

/**
 * Una voz con el diseño de Spotly, todo en una fila: avatar con aro, play, onda con el progreso real y los tiempos
 * (actual y total), me gusta, respuestas, compartir y opciones. Encima de la onda, su autor; si responde a otra voz,
 * debajo «En respuesta a este audio».
 */
export function VoiceItem({ note, onReply, onMore, parentName, highlight = false, compact = false, right }: {
  note: ThreadNote; onReply?: ((atMs: number) => void) | undefined; onMore?: (() => void) | undefined; parentName?: string | undefined; highlight?: boolean; compact?: boolean; right?: ReactNode;
}) {
  const name = useVoiceName()(note.author);
  const { demo } = useStore();
  const pb = useVoicePlayback(note.id);
  const total = pb.active && pb.durationMs ? pb.durationMs : note.durationMs;
  const progress = pb.active && total ? pb.positionMs / total : 0;
  /* Las cifras de las voces de ejemplo solo se enseñan en la demostración; con tu cuenta, solo tu me gusta. */
  const likes = note.sample && !demo ? (note.liked ? 1 : 0) : note.likes;
  const reply = () => onReply?.(pb.active ? pb.positionMs : 0);
  /* Una voz se comparte con el enlace de la conversación donde está (el Spot); las de chats son privadas. */
  const privateThread = note.threadId.startsWith("chat:") || note.threadId.startsWith("soporte:");
  const share = async () => {
    const spot = note.threadId.startsWith("spot:") ? note.threadId.slice(5) : null;
    if (privateThread) { toast("Las voces de un chat son privadas: no se comparten."); return; }
    await shareLink({ title: `Voz de ${name} en Spotly`, url: spot && !note.sample ? spotLink(spot) : appUrl() });
  };
  return (
    <article id={`voz-${note.id}`} className={"spot-voice-card rounded-2xl py-2 pl-2.5 pr-1 transition-shadow " + (highlight ? "spot-voice-highlight" : "")} aria-label={`Voz de ${name}, ${formatClock(note.durationMs)}`}>
      <div className="flex items-center gap-2">
        <VoiceAvatar author={note.author} size={compact ? "h-11 w-11" : "h-12 w-12"} />
        <button type="button" onClick={() => playNote(note)} aria-label={`${pb.playing ? "Pausar" : "Escuchar"} la voz de ${name}`}
          className="mt-3 grid h-10 w-10 shrink-0 place-items-center self-start rounded-full bg-secondary text-foreground transition active:scale-95">
          {pb.loading ? <Loader2 size={16} className="animate-spin" /> : pb.playing ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" className="ml-0.5" />}
        </button>
        <div className="min-w-0 flex-1">
          <p className="flex h-4 min-w-0 items-center gap-1 text-3xs text-muted-foreground">
            <strong className="max-w-[65%] shrink-0 truncate text-2xs font-semibold text-foreground/90">{name}</strong>
            {note.author.verified && !note.author.anon && <BadgeCheck size={11} className="shrink-0 text-primary" aria-label="Verificado" />}
            <span className="min-w-0 truncate">· {note.pending ? <><Loader2 size={10} className="mr-0.5 inline animate-spin" />enviando…</> : note.failed ? <span className="text-live">no enviada</span> : note.sample && !demo ? "ejemplo" : rel(note.createdAt)}</span>
            {right && <span className="ml-auto shrink-0 pl-1">{right}</span>}
          </p>
          <VoiceWave peaks={note.peaks} progress={progress} playhead={pb.active} className="h-8" label={`Posición en la voz de ${name}`} onSeek={note.src ? (r) => (pb.active ? seekVoice(note.id, r * total) : playNote(note, r)) : undefined} />
          <p className="flex h-3.5 items-center justify-between text-3xs tabular-nums text-muted-foreground"><span>{formatClock(pb.active ? pb.positionMs : 0)}</span><span>{formatClock(total)}</span></p>
        </div>
        <div className="flex shrink-0 self-start">
          <VoiceAction label={`Me gusta (${likes})`} pressed={note.liked} onClick={() => toggleVoiceLike(note.id)} count={likes} className={note.liked ? "text-live" : ""}><Heart size={20} fill={note.liked ? "currentColor" : "none"} /></VoiceAction>
          {onReply && <VoiceAction label={`Responder con tu voz (${note.replies} respuestas)`} onClick={reply} count={note.replies}><MessageCircle size={20} /></VoiceAction>}
          {!privateThread && <VoiceAction label="Compartir" onClick={() => void share()}><Forward size={21} /></VoiceAction>}
          {onMore && <VoiceAction label={`Opciones de la voz de ${name}`} onClick={onMore} narrow><MoreVertical size={19} /></VoiceAction>}
        </div>
      </div>
      {note.parentId && <p className="mt-1 flex min-w-0 items-center gap-1.5 pl-1.5 text-2xs text-muted-foreground"><CornerDownRight size={15} className="shrink-0" />{parentName ? <span className="min-w-0 truncate">En respuesta a <strong className="font-semibold text-foreground/80">{parentName}</strong>{note.replyAtMs ? ` · ${formatClock(note.replyAtMs)}` : ""}</span> : "En respuesta a este audio"}</p>}
      {note.failed && <FailedNote id={note.id} />}
    </article>
  );
}

/** Voz que no llegó a enviarse: reintentar sin volver a grabar, o descartarla. */
export function FailedNote({ id, className = "" }: { id: string; className?: string }) {
  return (
    <div className={"mt-1.5 flex items-center gap-2 rounded-xl bg-live/10 px-2 py-1 text-2xs " + className}>
      <AlertCircle size={14} className="shrink-0 text-live" />
      <span className="min-w-0 flex-1 truncate text-live">No se pudo enviar</span>
      <button type="button" onClick={() => retryVoiceNote(id)} className="flex min-h-8 items-center gap-1 rounded-full px-2 font-semibold text-primary"><RotateCcw size={13} />Reintentar</button>
      <button type="button" onClick={() => removeVoiceNote(id)} className="flex min-h-8 items-center gap-1 rounded-full px-2 font-semibold text-muted-foreground"><Trash2 size={13} />Descartar</button>
    </div>
  );
}

export type ReplyTarget = { id?: string | undefined; name: string; author?: VoiceNote["author"] | undefined; atMs: number; durationMs: number };

/** Foto de a quién respondes (sin aro, como en el diseño); fantasma si es anónimo, onda si no hay foto. */
function TargetAvatar({ target }: { target: ReplyTarget }) {
  const a = target.author;
  if (a?.anon) return <AnonAvatar className="h-9 w-9 shrink-0" size={15} />;
  if (a?.mine) return <MeAvatar className="h-9 w-9 shrink-0 text-xs" />;
  if (a?.avatar) return <img src={a.avatar} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />;
  if (a?.name) return <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-secondary text-xs font-bold">{(a.name.replace("@", "").trim()[0] ?? "?").toUpperCase()}</span>;
  return <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-secondary text-primary"><AudioLines size={16} /></span>;
}

/**
 * Panel para responder (o hablar) con tu voz, en una fila como el diseño: «Respondiendo a» con su foto y el minuto
 * del audio original | parar (grabando) · onda en vivo · tiempo · enviar. Al abrirlo ya está grabando (el toque que
 * lo abrió cuenta como gesto del usuario); parar deja escucharte antes de enviar, y enviar mientras grabas termina y
 * envía. Graba con el micrófono real; nada se envía sin pulsar enviar ni un toque accidental (< 0,8 s). La «×» de la
 * esquina cancela la respuesta o descarta la grabación.
 */
export function VoiceComposer({ target, onSend, onClose, maxSeconds: maxProp, pointer = false, autoFocus = false, autoStart = true, allowAnon = true, sendLabel = "Enviar voz" }: {
  /** Si devuelve una promesa, la grabación se conserva hasta que se resuelve; con `false` no se pierde (se puede reintentar). */
  target?: ReplyTarget | undefined; onSend: (clip: VoiceClip, anon: boolean) => void | boolean | Promise<boolean | void>; onClose?: (() => void) | undefined; maxSeconds?: number | undefined; pointer?: boolean; autoFocus?: boolean; autoStart?: boolean; allowAnon?: boolean; sendLabel?: string;
}) {
  const anonAllowed = useAnonAllowed();
  const maxSeconds = maxProp ?? commerce.voiceMaxSeconds;
  const rec = useVoiceRecorder({ maxSeconds });
  const [anon, setAnon] = useState(allowAnon && anonAllowed.active);
  const [pendingSend, setPendingSend] = useState(false);
  const [sending, setSending] = useState(false);
  const previewId = useRef(`preview-${Math.random().toString(36).slice(2)}`).current;
  const pb = useVoicePlayback(previewId);
  const file = useRef<HTMLInputElement | null>(null);
  const main = useRef<HTMLButtonElement | null>(null);
  const gate = useGate({ verified: true, online: true });
  const send = useCallback(() => {
    if (sending) return;
    if (rec.state === "recording") { setPendingSend(true); rec.stop(); return; }
    if (rec.state !== "recorded" || !rec.clip) return;
    if (pb.active) stopAllVoices();
    /* La grabación se entrega antes de enviar (así no se libera si el panel se cierra al momento) y vuelve si el envío falla. */
    const clip = rec.take();
    if (!clip) return;
    const r = onSend(clip, anon);
    if (r instanceof Promise) { setSending(true); void r.then((ok) => { if (ok === false) rec.restore(clip); }).finally(() => setSending(false)); }
    else if (r === false) rec.restore(clip);
  }, [anon, onSend, pb.active, rec, sending]);
  useEffect(() => { if (pendingSend && rec.state === "recorded") { setPendingSend(false); send(); } else if (pendingSend && rec.state === "idle") setPendingSend(false); }, [pendingSend, rec.state, send]);
  useEffect(() => { if (rec.error) toast.error(recorderErrorText(rec.error, maxSeconds)); }, [rec.error, maxSeconds]);
  useEffect(() => { if (autoFocus) main.current?.focus(); }, [autoFocus]);
  /* Como en el diseño, el panel se abre grabando (si hay que verificar la cuenta o falta conexión, primero el aviso). */
  const blocked = !!gate;
  useEffect(() => { if (autoStart && !blocked) void rec.start(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => releaseVoice(previewId), [previewId]);

  const recording = rec.state === "recording", clip = rec.state === "recorded" ? rec.clip : null;
  const canSend = recording ? rec.elapsedMs >= 800 : !!clip;
  const noMic = rec.state === "idle" && (rec.error === "denied" || rec.error === "unsupported" || rec.error === "failed" || !rec.supported);
  const mainAction = () => {
    if (rec.state === "idle") void rec.start();
    else if (recording) rec.stop();
    else if (clip) toggleVoice(previewId, clip.url, clip.durationMs);
  };
  /* «×»: cancela la respuesta (si se puede cerrar) o tira lo grabado para volver a empezar. */
  const canCancel = !!onClose || recording || !!clip;
  const cancel = () => { if (pb.active) stopAllVoices(); rec.cancel(); onClose?.(); };
  const time = clip ? formatClock(pb.active ? pb.positionMs : clip.durationMs) : formatClock(rec.elapsedMs);

  return (
    <div className="relative">
      {pointer && <span aria-hidden="true" className="spot-voice-pointer" />}
      <div className="spot-voice-composer rounded-2xl p-[0.09375rem]">
        <div className="rounded-[calc(1rem-0.09375rem)] bg-card py-2 pl-2 pr-2">
          {gate ? <div className="p-1">{gate}</div> : (
            <div className="flex items-center gap-1.5">
              {target && <>
                <TargetAvatar target={target} />
                <div className="shrink-0">
                  <p className="text-3xs leading-4 text-foreground/80">Respondiendo a<span className="sr-only"> {target.name}</span></p>
                  <p className="flex items-center gap-1 text-3xs leading-4 tabular-nums text-muted-foreground"><AudioLines size={13} className="shrink-0 text-foreground/75" />{target.durationMs > 0 ? `${formatClock(target.atMs)} / ${formatClock(target.durationMs)}` : <span className="max-w-[4rem] truncate">{target.name}</span>}</p>
                </div>
                <span aria-hidden="true" className="mx-1 h-9 w-px shrink-0 bg-border" />
              </>}
              <button ref={main} type="button" onClick={mainAction} disabled={rec.state === "requesting"}
                aria-label={rec.state === "idle" ? "Grabar con el micrófono" : recording ? "Parar y escuchar antes de enviar" : rec.state === "requesting" ? "Permite el micrófono" : pb.playing ? "Pausar la escucha" : "Escuchar tu grabación"}
                className={"grid h-11 w-11 shrink-0 place-items-center rounded-full text-white transition active:scale-95 " + (recording ? "spot-voice-stop" : clip ? "bg-secondary text-foreground" : "spot-voice-send")}>
                {rec.state === "requesting" ? <Loader2 size={20} className="animate-spin" /> : recording ? <Square size={17} fill="currentColor" className="rounded-[0.1875rem]" /> : clip ? (pb.playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />) : <Mic size={21} />}
              </button>
              <div className="min-w-0 flex-1">
                {clip
                  ? <VoiceWave peaks={clip.peaks} progress={pb.active && clip.durationMs ? pb.positionMs / clip.durationMs : 0} playhead={pb.active} label="Tu grabación" onSeek={(r) => playVoice(previewId, clip.url, clip.durationMs, r * clip.durationMs)} />
                  : noMic
                    ? <button type="button" onClick={() => file.current?.click()} className="flex h-9 w-full items-center justify-center gap-1 rounded-full bg-secondary px-2 text-2xs font-semibold text-primary"><FileAudio size={14} className="shrink-0" /><span className="truncate">Elegir audio</span></button>
                    : <LiveWave levels={rec.live} />}
              </div>
              <span className="w-8 shrink-0 text-right text-xs font-semibold tabular-nums" aria-live="polite">{time}</span>
              <button type="button" onClick={send} disabled={!canSend || sending} aria-label={sendLabel} className="spot-voice-send grid h-11 w-11 shrink-0 place-items-center rounded-full text-white transition active:scale-95 disabled:opacity-35">
                {pendingSend || sending ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} className="-ml-0.5" />}
              </button>
            </div>
          )}
        </div>
      </div>
      {canCancel && !gate && <button type="button" onClick={cancel} aria-label={onClose ? "Cancelar respuesta" : "Descartar la grabación"} className="absolute -top-2 right-3 z-[2] grid h-5 w-5 place-items-center rounded-full border border-border bg-card text-muted-foreground shadow hover:text-foreground"><X size={12} /></button>}
      {allowAnon && anonAllowed.active && !gate && <div className="mt-1.5 flex"><SignAsChip anon={anon} onChange={setAnon} /></div>}
      <input ref={file} type="file" accept="audio/*" className="hidden" aria-label="Elegir un audio del dispositivo" onChange={(e) => { const f = e.target.files?.[0]; if (f) void rec.fromFile(f); e.target.value = ""; }} />
    </div>
  );
}

/** Opciones de una voz: responder, borrar (si es tuya o te la dejaron en tu muro) o denunciar. */
function VoiceMenu({ note, name, onReply, onClose }: { note: ThreadNote; name: string; onReply: () => void; onClose: () => void }) {
  const uid = cloudUid();
  const onMyWall = !!uid && note.threadId === `muro:${uid}` && !note.author.mine && !note.sample;
  const reportIt = () => {
    addReport(`Voz de ${name}`, "Denunciada desde una conversación de voz");
    if (uid && note.serverLiked !== undefined) void api.report(db(), uid, "voice", note.id, "Denunciada desde una conversación").catch((e) => toast.error(cloudErrorText(e)));
    toast("Gracias. Revisaremos esta voz.");
    onClose();
  };
  return (
    <BottomSheet title={`Voz de ${name}`} onClose={onClose} z={90}>
      <button onClick={() => { onClose(); onReply(); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm hover:bg-secondary"><Mic size={18} className="text-primary" />Responder con tu voz</button>
      {(note.author.mine || onMyWall) && <button onClick={() => { removeVoiceNote(note.id); toast(note.author.mine ? "Voz eliminada" : "Voz quitada de tu muro"); onClose(); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm text-live hover:bg-secondary"><Trash2 size={18} />{note.author.mine ? "Eliminar mi voz" : "Quitar de mi muro"}</button>}
      {!note.author.mine && <button onClick={reportIt} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm text-live hover:bg-secondary"><X size={18} />Denunciar esta voz</button>}
    </BottomSheet>
  );
}

/**
 * Hilo de voces con respuestas encadenadas. `root` es el audio principal (el Spot, la foto…) al que se responde
 * desde el botón inferior; cada voz tiene su propio «Responder» que abre el panel justo debajo.
 */
export function VoiceThread({ threadId, seed, root, emptyText = "Sé la primera voz de esta conversación.", composerOpen = false, onComposerClose, maxSeconds, freshId, order = "newest", allowAnon = true }: {
  threadId: string; seed?: VoiceNote[] | undefined; root?: ReplyTarget | undefined; emptyText?: string; composerOpen?: boolean; onComposerClose?: (() => void) | undefined; maxSeconds?: number | undefined; freshId?: string | null | undefined;
  /** «newest»: lo último arriba (comentarios); «oldest»: en orden de llegada, lo último abajo (grupos de voz). */
  order?: "newest" | "oldest"; allowAnon?: boolean;
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
    return notes.filter((n) => !n.parentId || !byId.has(n.parentId)).sort((a, b) => (order === "oldest" ? a.createdAt - b.createdAt : b.createdAt - a.createdAt)).map((r) => ({ root: r, replies: (map.get(r.id) ?? []).sort((a, b) => a.createdAt - b.createdAt) }));
  }, [notes, byId, order]);

  const status = useThreadStatus(threadId);
  const publish = (clip: VoiceClip, anon: boolean, parent: { note: ThreadNote; atMs: number } | null) => {
    const n = addVoiceNote({ threadId, parentId: parent?.note.id ?? null, replyAtMs: parent?.atMs, clip, anon });
    if (!n.pending) toast.success(anon ? "Voz enviada como «Anónimo»" : "Voz enviada");
    setFresh(n.id);
    setReplyTo(null); setRootOpen(false); onComposerClose?.();
  };
  const composerFor = (note: ThreadNote) => replyTo?.note.id === note.id && (
    <div className="mt-2"><VoiceComposer pointer autoFocus allowAnon={allowAnon} maxSeconds={maxSeconds} target={{ id: note.id, name: nameOf(note.author), author: note.author, atMs: replyTo.atMs, durationMs: note.durationMs }} onClose={() => setReplyTo(null)} onSend={(c, a) => publish(c, a, replyTo)} /></div>
  );
  /* Responder abre el panel justo debajo de esa voz (con el pico apuntando a su foto); volver a tocar lo cierra. */
  const replyHere = (note: ThreadNote) => (atMs: number) => { setRootOpen(false); setReplyTo((cur) => (cur?.note.id === note.id ? null : { note, atMs })); };

  return (
    <div className="space-y-3">
      {rootOpen && <div className="pt-2"><VoiceComposer autoFocus allowAnon={allowAnon} maxSeconds={maxSeconds} target={root} onClose={() => { setRootOpen(false); onComposerClose?.(); }} onSend={(c, a) => publish(c, a, null)} /></div>}
      {groups.length === 0 && !rootOpen && status === "loading" && <div className="grid place-items-center rounded-3xl border border-dashed border-border p-6" aria-busy="true"><Loader2 className="animate-spin text-primary" size={24} /></div>}
      {groups.length === 0 && !rootOpen && status === "error" && <div className="rounded-3xl border border-dashed border-border p-6 text-center"><AlertCircle className="mx-auto text-live" size={26} /><p className="mt-2 text-sm text-muted-foreground">No se pudo cargar la conversación. Comprueba tu conexión.</p></div>}
      {groups.length === 0 && !rootOpen && (status === "ready" || status === "local") && <div className="rounded-3xl border border-dashed border-border p-6 text-center"><Mic className="mx-auto text-primary" size={28} /><p className="mt-2 text-sm text-muted-foreground">{emptyText}</p></div>}
      {/* Como en el diseño: cada respuesta, del mismo tamaño, justo debajo, con «En respuesta a este audio». */}
      {groups.map(({ root: r, replies }) => (
        <div key={r.id} className="space-y-2">
          <VoiceItem note={r} highlight={fresh === r.id} onReply={replyHere(r)} onMore={() => setMenu(r)} />
          {composerFor(r)}
          {replies.map((n) => {
            const parent = n.parentId ? byId.get(n.parentId) : undefined;
            return (
              <div key={n.id}>
                <VoiceItem note={n} highlight={fresh === n.id} parentName={parent && parent.id !== r.id ? nameOf(parent.author) : undefined} onReply={replyHere(n)} onMore={() => setMenu(n)} />
                {composerFor(n)}
              </div>
            );
          })}
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
