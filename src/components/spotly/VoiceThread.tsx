import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { AlertCircle, AudioLines, CornerDownRight, FileAudio, Heart, Loader2, Mic, Pause, Play, RotateCcw, Send, Trash2, Volume2, X } from "lucide-react";
import { toast } from "sonner";
import { AnonAvatar, MeAvatar, SignAsChip, useAnonAllowed } from "./Author";
import { BottomSheet } from "./kit";
import { useGate } from "./Gate";
import { addReport, useMe, useStore } from "@/lib/store";
import { commerce } from "@/lib/spotlyConfig";
import { formatClock, recorderErrorText, useVoiceRecorder, type VoiceClip } from "@/lib/voice/recorder";
import { onVoiceError, playVoice, playVoiceQueue, releaseVoice, seekVoice, stopAllVoices, toggleVoice, useCurrentVoice, useVoicePlayback, voicePosition } from "@/lib/voice/player";
import { addVoiceNote, removeVoiceNote, retryVoiceNote, toggleVoiceLike, useThread, useThreadStatus, type ThreadNote, type VoiceNote } from "@/lib/voice/notes";
import { api, cloudErrorText, cloudUid, db } from "@/lib/cloud";
import { appUrl, shareLink, spotLink } from "@/lib/share";

/**
 * Mensajes de voz en toda la app, calcados del diseño de las respuestas de voz de Spotly:
 *  - VoiceRow / VoiceItem (una fila): avatar con aro, play, onda con el progreso real y los tiempos (actual y total),
 *    me gusta, respuestas, compartir y opciones; si responde a un audio, «↳ En respuesta a este audio» debajo.
 *  - VoiceComposer (una fila, con borde degradado y un pico que señala el audio al que respondes): foto y
 *    «Respondiendo a» con el minuto del audio original | parar · onda en vivo · tiempo · enviar.
 *  - VoiceThread: la conversación (Spot, foto, Hot Spot, grupo, comunidad, evento…) con las respuestas encadenadas.
 * Todo es voz: no hay comentarios escritos. El micrófono solo aparece para grabar; para escuchar, play o altavoz.
 */

/* ───────── Iconos del diseño (altavoz de las respuestas, flecha de compartir y tres puntos), a su medida ─────────
   El globo de respuestas del diseño se cambió por un altavoz: en Spotly no hay bocadillos de chat escritos, y las
   respuestas se escuchan. */
function ShareArrowIcon({ size = 22 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinejoin="round" aria-hidden="true"><path d="M12.7 3.4 23 13.2l-10.3 9.8v-6.1c-5.2-.3-8.4 1.5-10.9 5.4.6-7.6 4.6-11.8 10.9-12.5z" /></svg>;
}
function DotsIcon({ size = 20 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="3.96" r="1.74" /><circle cx="12" cy="12" r="1.74" /><circle cx="12" cy="20.04" r="1.74" /></svg>;
}

/* ───────── Onda ───────── */
/* Barras de 0,1875 rem con huecos de 0,15625 rem (proporción del diseño: barra y hueco casi iguales). */
const BAR = 0.1875, GAP = 0.15625;
/** Cuántas barras caben de verdad y el alto de la onda: nunca se sale de su sitio y el degradado va por su altura. */
function useWaveBox() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [box, setBox] = useState({ slots: 0, h: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      const slots = Math.max(6, Math.floor((el.clientWidth + rem * GAP) / (rem * (BAR + GAP))));
      const h = el.clientHeight;
      setBox((b) => (b.slots === slots && b.h === h ? b : { slots, h }));
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, box] as const;
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
const SILENCE = 0.14;
const waveStyle = (h: number) => (h ? ({ "--wave-h": `${h}px` } as CSSProperties) : undefined);

/**
 * Onda de un audio como en el diseño: barras con la forma real (los silencios, en puntos); lo escuchado, en fucsia
 * arriba y violeta abajo hasta el punto de reproducción, y lo que falta, en gris.
 */
export function VoiceWave({ peaks, progress = 0, playhead = false, onSeek, className = "", label }: { peaks: number[]; progress?: number; playhead?: boolean; onSeek?: ((ratio: number) => void) | undefined; className?: string; label?: string }) {
  const [ref, box] = useWaveBox();
  const bars = useMemo(() => fitPeaks(peaks, box.slots), [peaks, box.slots]);
  const n = bars.length || 1;
  const p = Math.max(0, Math.min(1, progress));
  const under = playhead ? Math.min(n - 1, Math.floor(p * n)) : -1;
  return (
    <div ref={ref} role={onSeek ? "slider" : undefined} aria-label={label} aria-valuemin={onSeek ? 0 : undefined} aria-valuemax={onSeek ? 100 : undefined} aria-valuenow={onSeek ? Math.round(p * 100) : undefined} tabIndex={onSeek ? 0 : undefined}
      onClick={onSeek ? (e) => { const r = e.currentTarget.getBoundingClientRect(); onSeek((e.clientX - r.left) / r.width); } : undefined}
      onKeyDown={onSeek ? (e) => { if (e.key === "ArrowRight") onSeek(Math.min(1, p + 0.05)); else if (e.key === "ArrowLeft") onSeek(Math.max(0, p - 0.05)); } : undefined}
      style={waveStyle(box.h)}
      className={"relative flex h-9 min-w-0 items-center justify-between " + (box.slots ? "" : "overflow-hidden ") + (onSeek ? "cursor-pointer touch-manipulation " : "") + className}>
      {bars.map((h, i) => {
        const played = (i + 0.5) / n <= p || undefined;
        const hidden = i === under || undefined;
        return h < SILENCE
          ? <span key={i} aria-hidden="true" className="spot-voice-dot" data-played={played} data-under={hidden} />
          : <span key={i} aria-hidden="true" className="spot-voice-bar" style={{ height: `${Math.round(h * 100)}%` }} data-played={played} data-under={hidden} />;
      })}
      {playhead && <span aria-hidden="true" className="spot-voice-head" style={{ left: `calc(${BAR / 2}rem + (100% - ${BAR}rem) * ${n > 1 ? under / (n - 1) : 0})` }} />}
    </div>
  );
}

/** Forma de onda «fantasma» para lo que aún no has grabado (como en el diseño, barras tenues al final). */
const ghost = (i: number) => 0.3 + (((i * 37) % 11) / 11) * 0.5;
/**
 * Onda mientras grabas: crece de izquierda a derecha con el nivel real de tu voz, en rosa (los silencios, en
 * puntos); lo que falta, en barras que pasan de rosa apagado a gris. Al llenarse, avanza con lo último que dices.
 */
function LiveWave({ levels }: { levels: number[] }) {
  const [ref, box] = useWaveBox();
  const n = box.slots || 16;
  /* Como en el diseño, el último 28 % queda siempre para las barras tenues: lo grabado corre por el resto. */
  const room = Math.max(1, Math.round(n * 0.72));
  const recent = levels.slice(-room);
  const shown: (number | undefined)[] = [...recent, ...Array.from({ length: n - recent.length }, () => undefined)];
  const filled = recent.length;
  return (
    <div ref={ref} className="flex h-9 min-w-0 items-center justify-between overflow-hidden" aria-hidden="true">
      {shown.map((v, i) => {
        if (v === undefined) {
          const t = (i - filled) / Math.max(1, n - filled);
          return <span key={i} className="spot-voice-bar" style={{ height: `${Math.round(ghost(i) * 72)}%`, background: `color-mix(in oklab, var(--wave-live) ${Math.round((1 - t) * 55)}%, var(--wave-rest))`, opacity: 0.9 - t * 0.35 }} />;
        }
        const level = Math.min(1, v * 9);
        return level < 0.1 ? <span key={i} className="spot-voice-dot spot-voice-live" /> : <span key={i} className="spot-voice-bar spot-voice-live" style={{ height: `${Math.round(level * 100)}%` }} />;
      })}
    </div>
  );
}

/* ───────── Fila de un mensaje de voz ───────── */
/** Avatar del autor con el aro de marca (fantasma si es anónimo; tu foto si es tuyo). */
function VoiceAvatar({ author, size = "h-12 w-12" }: { author: VoiceNote["author"]; size?: string }) {
  if (author.anon) return <span className={"spot-voice-ring shrink-0 rounded-full p-[0.125rem] " + size}><AnonAvatar className="spot-voice-gap h-full w-full" size={18} /></span>;
  return (
    <span className={"spot-voice-ring shrink-0 rounded-full p-[0.125rem] " + size}>
      {author.mine ? <MeAvatar className="spot-voice-gap h-full w-full text-sm" /> : author.avatar
        ? <img src={author.avatar} alt="" className="spot-voice-gap h-full w-full rounded-full object-cover" />
        : <span className="spot-voice-gap grid h-full w-full place-items-center rounded-full bg-secondary text-sm font-bold">{(author.name.trim()[0] ?? "?").toUpperCase()}</span>}
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

/** Cifras cortas como en el diseño: 142, 1,2 K, 3,4 M. */
const compact = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1).replace(".", ",").replace(",0", "")} M` : n >= 1e3 ? `${(n / 1e3).toFixed(1).replace(".", ",").replace(",0", "")} K` : String(n));

/**
 * Botón de la fila como en el diseño: me gusta y respuestas con la cifra debajo (el icono, algo por encima del centro);
 * compartir y opciones, sin cifra y centrados. Toda la columna mide 2,75 rem para que se pueda tocar bien.
 */
function VoiceAction({ label, onClick, count, pressed, narrow = false, active = false, activeTone = "text-live", lift = "pb-1", children }: { label: string; onClick: () => void; count?: number | undefined; pressed?: boolean | undefined; narrow?: boolean; active?: boolean; activeTone?: string; lift?: string; children: ReactNode }) {
  const withCount = count !== undefined;
  return (
    <button type="button" onClick={onClick} aria-label={label} aria-pressed={pressed}
      className={"flex h-11 shrink-0 flex-col items-center rounded-xl transition active:scale-95 " + (narrow ? "w-6 " : "w-[2.125rem] ") + (withCount ? "pt-[0.21875rem] " : "justify-center " + lift + " ") + (active ? activeTone : "text-foreground/95 hover:text-foreground")}>
      <span className="grid h-6 place-items-center">{children}</span>
      {withCount && <span className="mt-px h-3 whitespace-nowrap text-3xs leading-3 text-foreground/90">{compact(count)}</span>}
    </button>
  );
}

export type VoiceRowProps = {
  id: string; author: VoiceNote["author"]; name: string; src?: string | undefined; durationMs: number; peaks: number[];
  likes?: { count: number; liked: boolean; onToggle: () => void } | undefined;
  /** Altavoz con el número de respuestas: las escucha seguidas (`active` mientras suena alguna de ellas). */
  listen?: { count: number; active?: boolean | undefined; onListen: () => void } | undefined;
  onShare?: (() => void) | undefined; onMore?: (() => void) | undefined;
  /** Al empezar a escucharlo (p. ej., para contar la escucha de un Spot). */
  onPlay?: (() => void) | undefined;
  /** «En respuesta a este audio» (o a quién responde): la marca de que es una respuesta. */
  answer?: ReactNode; highlight?: boolean; compact?: boolean; pending?: boolean | undefined; note?: ReactNode; footer?: ReactNode;
};
/**
 * La fila del diseño, para cualquier audio (un mensaje de voz o el audio original de un Spot o una foto): avatar con
 * aro, play, onda con los tiempos debajo, me gusta, altavoz con las respuestas (para escucharlas), compartir y
 * opciones (responder con tu voz, borrar, denunciar); si es una respuesta, «↳ En respuesta a este audio» debajo.
 */
export function VoiceRow({ id, author, name, src, durationMs, peaks, likes, listen, onShare, onMore, onPlay, answer, highlight = false, compact = false, pending = false, note, footer }: VoiceRowProps) {
  const pb = useVoicePlayback(id);
  /* El total es el medido al grabar (los WebM del navegador no siempre traen duración): así no cambia al escuchar. */
  const total = durationMs || (pb.active ? pb.durationMs : 0);
  const progress = pb.active && total ? pb.positionMs / total : 0;
  const play = (atRatio?: number) => { if (src && !pb.playing) onPlay?.(); playNote({ id, src, durationMs }, atRatio); };
  const extra = !!(answer || note || footer);
  return (
    <article id={`voz-${id}`} className={"spot-voice-card rounded-[0.9375rem] pl-3.5 pr-1.5 pt-[0.6875rem] transition-shadow " + (extra ? "pb-[0.625rem] " : "pb-[0.6875rem] ") + (highlight ? "spot-voice-highlight" : "")} aria-label={`Voz de ${name}, ${formatClock(durationMs)}`}>
      <div className="flex items-center">
        <VoiceAvatar author={author} size={compact ? "h-11 w-11" : "h-12 w-12"} />
        <button type="button" onClick={() => play()} aria-label={`${pb.playing ? "Pausar" : "Escuchar"} la voz de ${name}`} disabled={pending}
          className="spot-voice-play ml-2 grid h-[2.5625rem] w-[2.5625rem] shrink-0 place-items-center rounded-full transition active:scale-95">
          {pending || pb.loading ? <Loader2 size={17} className="animate-spin" /> : pb.playing ? <Pause size={17} fill="currentColor" strokeWidth={0} /> : <Play size={19} fill="currentColor" strokeWidth={0} className="ml-[0.125rem]" />}
        </button>
        <div className="ml-[0.5625rem] min-w-0 flex-1 translate-y-[0.1875rem] pr-3">
          <VoiceWave peaks={peaks} progress={progress} playhead={pb.active} className="h-[1.9375rem]" label={`Posición en la voz de ${name}`} onSeek={src ? (r) => (pb.active ? seekVoice(id, r * total) : play(r)) : undefined} />
          <p className="mt-px flex h-3.5 items-center justify-between text-[0.65rem] leading-none tabular-nums text-foreground/90"><span>{formatClock(pb.active ? pb.positionMs : 0)}</span><span>{formatClock(total)}</span></p>
        </div>
        {likes && <VoiceAction label={`Me gusta (${likes.count})`} pressed={likes.liked} active={likes.liked} onClick={likes.onToggle} count={likes.count}><Heart size={21} strokeWidth={1.6} fill={likes.liked ? "currentColor" : "none"} /></VoiceAction>}
        {listen && <VoiceAction label={`${listen.active ? "Parar" : "Escuchar"} las respuestas de voz (${listen.count})`} pressed={!!listen.active} active={!!listen.active} activeTone="text-[var(--wave-head)]" onClick={listen.onListen} count={listen.count}><Volume2 size={22} strokeWidth={1.6} /></VoiceAction>}
        {onShare && <VoiceAction label="Compartir" onClick={onShare}><ShareArrowIcon /></VoiceAction>}
        {onMore && <VoiceAction label={`Opciones de la voz de ${name}`} onClick={onMore} narrow lift="pb-0.5"><DotsIcon /></VoiceAction>}
      </div>
      {answer && <p className="mt-[0.3125rem] flex h-3 min-w-0 items-center gap-[0.375rem] pl-[0.1875rem] text-3xs leading-3 text-foreground/80"><CornerDownRight size={19} strokeWidth={1.6} className="-my-1 shrink-0 text-foreground/70" /><span className="min-w-0 truncate">{answer}</span></p>}
      {note && <p className="mt-1.5 pl-1 text-3xs text-muted-foreground">{note}</p>}
      {footer}
    </article>
  );
}

/**
 * Un mensaje de voz con el diseño de Spotly. `answersRoot`: responde al audio de arriba (el del Spot o la foto), así
 * que lleva «↳ En respuesta a este audio»; si responde a otra voz, a quién responde y en qué segundo.
 */
export function VoiceItem({ note, listen, onMore, parentName, answersRoot = false, highlight = false, compact = false, right, social = true }: {
  note: ThreadNote; onMore?: (() => void) | undefined; parentName?: string | undefined; answersRoot?: boolean; highlight?: boolean; compact?: boolean;
  /** Escuchar sus respuestas (en una conversación); sin esto, el altavoz avisa de cuántas tiene. */
  listen?: VoiceRowProps["listen"];
  /** Etiqueta pequeña bajo la fila (p. ej., «Presentación» o «Audio-flyer»). */
  right?: ReactNode;
  /** false: un audio suelto (audio-flyer, presentación…) sin me gusta ni compartir; solo play, onda y tiempos. */
  social?: boolean;
}) {
  const name = useVoiceName()(note.author);
  const { demo } = useStore();
  /* Las cifras de las voces de ejemplo solo se enseñan en la demostración; con tu cuenta, solo tu me gusta. */
  const likes = note.sample && !demo ? (note.liked ? 1 : 0) : note.likes;
  /* Una voz se comparte con el enlace de la conversación donde está (el Spot); las de chats son privadas. */
  const privateThread = note.threadId.startsWith("chat:") || note.threadId.startsWith("soporte:");
  const share = async () => {
    const spot = note.threadId.startsWith("spot:") ? note.threadId.slice(5) : null;
    await shareLink({ title: `Voz de ${name} en Spotly`, url: spot && !note.sample ? spotLink(spot) : appUrl() });
  };
  const answer = note.parentId
    ? (parentName ? <>En respuesta a <strong className="font-semibold text-foreground/85">{parentName}</strong>{note.replyAtMs ? ` · ${formatClock(note.replyAtMs)}` : ""}</> : "En respuesta a este audio")
    : answersRoot ? "En respuesta a este audio" : null;
  return (
    <VoiceRow id={note.id} author={note.author} name={name} src={note.src} durationMs={note.durationMs} peaks={note.peaks} pending={note.pending}
      likes={social ? { count: likes, liked: !!note.liked, onToggle: () => toggleVoiceLike(note.id) } : undefined}
      listen={social && listen ? listen : undefined}
      onShare={social && !privateThread ? () => void share() : undefined}
      onMore={social ? onMore : undefined}
      answer={answer} highlight={highlight} compact={compact} note={right}
      footer={note.failed ? <FailedNote id={note.id} /> : null} />
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
  const size = "h-8 w-8 shrink-0";
  if (a?.anon) return <AnonAvatar className={size} size={14} />;
  if (a?.mine) return <MeAvatar className={size + " text-xs"} />;
  if (a?.avatar) return <img src={a.avatar} alt="" className={size + " rounded-full object-cover"} />;
  if (a?.name) return <span className={size + " grid place-items-center rounded-full bg-secondary text-xs font-bold"}>{(a.name.replace("@", "").trim()[0] ?? "?").toUpperCase()}</span>;
  return <span className={size + " grid place-items-center rounded-full bg-secondary text-primary"}><AudioLines size={15} /></span>;
}

/** Pico del panel (como en el diseño): sube desde el borde degradado hasta debajo de la foto del audio de arriba. */
function VoicePointer() {
  return (
    <svg aria-hidden="true" className="spot-voice-pointer" viewBox="0 0 18 13" preserveAspectRatio="none">
      <path d="M0 13 .3 12.5 7.6 1.4Q9-.6 10.4 1.4L17.7 12.5 18 13z" fill="var(--voice-card-a)" />
      <path d="M.3 12.5 7.6 1.4Q9-.6 10.4 1.4L17.7 12.5" fill="none" stroke="color-mix(in oklab, var(--wave-edge) 70%, var(--wave-to))" strokeWidth={1} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/**
 * Panel para responder (o hablar) con tu voz, en una fila como el diseño: foto y «Respondiendo a» con el minuto del
 * audio original | parar (grabando) · onda en vivo · tiempo · enviar. Al abrirlo ya está grabando (el toque que lo
 * abrió cuenta como gesto del usuario); parar deja escucharte antes de enviar, y enviar mientras grabas termina y
 * envía. Graba con el micrófono real; nada se envía sin pulsar enviar ni un toque accidental (< 0,8 s). Mientras
 * grabas se ve como el diseño, sin nada más; al parar aparece la «×» para descartar (o cancelar la respuesta).
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
  /* «×»: cancela la respuesta (si se puede cerrar) o descarta lo grabado. Mientras grabas no se ve, como en el diseño:
     primero se para con el botón rosa. */
  const canCancel = !recording && rec.state !== "requesting" && (!!clip || !!onClose);
  const cancel = () => { if (pb.active) stopAllVoices(); rec.cancel(); onClose?.(); };
  const time = clip ? formatClock(pb.active ? pb.positionMs : clip.durationMs) : formatClock(rec.elapsedMs);

  return (
    <div className="relative">
      {pointer && <VoicePointer />}
      <div className="spot-voice-composer @container rounded-2xl py-[0.9375rem] pl-3 pr-3">
        {gate ? <div className="p-1">{gate}</div> : (
          <div className="flex items-center">
            {target && <>
              <TargetAvatar target={target} />
              {/* En móviles muy estrechos (320 px) queda la foto con el pico: así la onda en vivo sigue teniendo sitio. */}
              <div className="ml-2 shrink-0 @max-[20.5rem]:sr-only">
                <p className="text-[0.65625rem] leading-4 text-foreground/90">Respondiendo a<span className="sr-only"> {target.name}</span></p>
                <p className="mt-[0.1875rem] flex h-[1.125rem] items-center gap-1.5 text-[0.65625rem] leading-none tabular-nums text-muted-foreground"><AudioLines size={17} strokeWidth={1.8} className="shrink-0 text-foreground/80" />{target.durationMs > 0 ? `${formatClock(target.atMs)} / ${formatClock(target.durationMs)}` : <span className="max-w-[4.5rem] truncate">{target.name}</span>}</p>
              </div>
              <span aria-hidden="true" className="mx-2.5 h-11 w-px shrink-0 bg-[var(--voice-divider)] @max-[20.5rem]:mx-2" />
            </>}
            <button ref={main} type="button" onClick={mainAction} disabled={rec.state === "requesting"}
              aria-label={rec.state === "idle" ? "Grabar con el micrófono" : recording ? "Parar y escuchar antes de enviar" : rec.state === "requesting" ? "Permite el micrófono" : pb.playing ? "Pausar la escucha" : "Escuchar tu grabación"}
              className={"grid h-[2.75rem] w-[2.75rem] shrink-0 place-items-center rounded-full text-white transition active:scale-95 " + (recording ? "spot-voice-stop" : clip ? "spot-voice-play" : "spot-voice-send")}>
              {rec.state === "requesting" ? <Loader2 size={20} className="animate-spin" /> : recording ? <span className="h-[0.9375rem] w-[0.9375rem] rounded-[0.1875rem] bg-white" /> : clip ? (pb.playing ? <Pause size={17} fill="currentColor" strokeWidth={0} /> : <Play size={19} fill="currentColor" strokeWidth={0} className="ml-[0.125rem]" />) : <Mic size={21} />}
            </button>
            <div className="mx-2.5 min-w-0 flex-1">
              {clip
                ? <VoiceWave peaks={clip.peaks} progress={pb.active && clip.durationMs ? pb.positionMs / clip.durationMs : 0} playhead={pb.active} label="Tu grabación" onSeek={(r) => playVoice(previewId, clip.url, clip.durationMs, r * clip.durationMs)} />
                : noMic
                  ? <button type="button" onClick={() => file.current?.click()} className="flex h-9 w-full items-center justify-center gap-1 rounded-full bg-secondary px-2 text-2xs font-semibold text-primary"><FileAudio size={14} className="shrink-0" /><span className="truncate">Elegir audio</span></button>
                  : <LiveWave levels={rec.live} />}
            </div>
            <span className="min-w-[1.5rem] shrink-0 text-right text-[0.6875rem] font-medium tabular-nums text-foreground" aria-live="polite">{time}</span>
            <button type="button" onClick={send} disabled={!canSend || sending} aria-label={sendLabel} className="spot-voice-send ml-2.5 grid h-[2.75rem] w-[2.75rem] shrink-0 place-items-center rounded-full text-white transition active:scale-95 disabled:opacity-35">
              {pendingSend || sending ? <Loader2 size={20} className="animate-spin" /> : <Send size={22} strokeWidth={1.7} className="-ml-[0.0625rem] mt-[0.0625rem]" />}
            </button>
          </div>
        )}
      </div>
      {canCancel && !gate && <button type="button" onClick={cancel} aria-label={onClose ? "Cancelar respuesta" : "Descartar la grabación"} className="absolute -top-2 right-3 z-[3] grid h-5 w-5 place-items-center rounded-full border border-border bg-card text-muted-foreground shadow hover:text-foreground"><X size={12} /></button>}
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

/** Las voces de una conversación en el orden en que se ven: cada primera voz y, debajo, toda su conversación. */
export function threadGroups(notes: ThreadNote[], order: "newest" | "oldest" = "newest") {
  const byId = new Map(notes.map((n) => [n.id, n]));
  const rootOf = (n: ThreadNote): ThreadNote => { let cur = n; const seen = new Set<string>(); while (cur.parentId && byId.has(cur.parentId) && !seen.has(cur.id)) { seen.add(cur.id); cur = byId.get(cur.parentId)!; } return cur; };
  const map = new Map<string, ThreadNote[]>();
  for (const n of notes) { const r = rootOf(n); if (r.id !== n.id) map.set(r.id, [...(map.get(r.id) ?? []), n]); }
  return notes.filter((n) => !n.parentId || !byId.has(n.parentId)).sort((a, b) => (order === "oldest" ? a.createdAt - b.createdAt : b.createdAt - a.createdAt)).map((r) => ({ root: r, replies: (map.get(r.id) ?? []).sort((a, b) => a.createdAt - b.createdAt) }));
}

/**
 * Escucha seguidas unas voces (las respuestas a un audio). Si ya está sonando alguna, para. Las de ejemplo no
 * tienen audio: se avisa en vez de no hacer nada.
 */
export function listenToVoices(voices: { id: string; src?: string | undefined; durationMs: number }[], playing: boolean) {
  if (playing) { stopAllVoices(); return; }
  if (!voices.length) { toast("Aún no hay respuestas a este audio."); return; }
  const n = playVoiceQueue(voices);
  if (!n) toast("Son voces de ejemplo: no tienen audio. Las de verdad se escuchan seguidas aquí.");
}

/**
 * Conversación de mensajes de voz con respuestas encadenadas. `root` es el audio original (el del Spot, la foto…):
 * si tiene audio, cada mensaje responde a él y lo dice («↳ En respuesta a este audio»). El altavoz de cada voz
 * escucha seguidas sus respuestas; «Responder con tu voz» (en ⋮) abre el panel justo debajo con el pico
 * señalándola; `rootPointer` hace lo mismo con el audio de arriba (el panel del audio original se abre pegado a él,
 * a 0,3125 rem, como en el diseño).
 */
export function VoiceThread({ threadId, seed, root, emptyText = "Sé la primera voz de esta conversación.", composerOpen = false, onComposerClose, maxSeconds, freshId, order = "newest", allowAnon = true, rootPointer = false, closed = false, onSent }: {
  threadId: string; seed?: VoiceNote[] | undefined; root?: ReplyTarget | undefined; emptyText?: string; composerOpen?: boolean; onComposerClose?: (() => void) | undefined; maxSeconds?: number | undefined; freshId?: string | null | undefined;
  /** «newest»: lo último arriba (mensajes de un Spot); «oldest»: en orden de llegada, lo último abajo (grupos de voz). */
  order?: "newest" | "oldest"; allowAnon?: boolean; rootPointer?: boolean;
  /** Respuestas cerradas por el autor: se escucha todo, pero no se puede responder. */
  closed?: boolean;
  /** Tras enviar una voz (p. ej., para subir el contador de respuestas del Spot). */
  onSent?: ((note: VoiceNote) => void) | undefined;
}) {
  const notes = useThread(threadId, seed);
  const nameOf = useVoiceName();
  const { demo } = useStore();
  const now = useCurrentVoice();
  const [replyTo, setReplyTo] = useState<{ note: ThreadNote; atMs: number } | null>(null);
  const [rootOpen, setRootOpen] = useState(composerOpen && !closed);
  const [menu, setMenu] = useState<ThreadNote | null>(null);
  const [fresh, setFresh] = useState<string | null>(null);
  useEffect(() => { setRootOpen(composerOpen && !closed); if (composerOpen) setReplyTo(null); }, [composerOpen, closed]);
  useEffect(() => { if (freshId) setFresh(freshId); }, [freshId]);
  useEffect(() => () => stopAllVoices(), []);
  useEffect(() => { if (!fresh) return; const t = window.setTimeout(() => setFresh(null), 2400); document.getElementById(`voz-${fresh}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" }); return () => window.clearTimeout(t); }, [fresh]);

  const byId = useMemo(() => new Map(notes.map((n) => [n.id, n])), [notes]);
  const groups = useMemo(() => threadGroups(notes, order), [notes, order]);
  /* Todas las respuestas que cuelgan de cada voz (directas y de las respuestas), en orden de llegada. */
  const below = useMemo(() => {
    const map = new Map<string, ThreadNote[]>();
    for (const n of [...notes].sort((a, b) => a.createdAt - b.createdAt)) {
      let cur = n.parentId ? byId.get(n.parentId) : undefined; const seen = new Set<string>();
      while (cur && !seen.has(cur.id)) { seen.add(cur.id); map.set(cur.id, [...(map.get(cur.id) ?? []), n]); cur = cur.parentId ? byId.get(cur.parentId) : undefined; }
    }
    return map;
  }, [notes, byId]);
  const listenFor = (note: ThreadNote) => {
    const voices = below.get(note.id) ?? [];
    const active = !!now.id && voices.some((v) => v.id === now.id);
    return { count: voices.length, active, onListen: () => listenToVoices(voices, active) };
  };
  const answersRoot = !!root && root.durationMs > 0;
  const samples = !demo && notes.some((n) => n.sample);

  const status = useThreadStatus(threadId);
  const publish = (clip: VoiceClip, anon: boolean, parent: { note: ThreadNote; atMs: number } | null) => {
    const n = addVoiceNote({ threadId, parentId: parent?.note.id ?? null, replyAtMs: parent ? parent.atMs : root?.atMs, clip, anon });
    if (!n.pending) toast.success(anon ? "Voz enviada como «Anónimo»" : "Voz enviada");
    setFresh(n.id);
    setReplyTo(null); setRootOpen(false); onComposerClose?.();
    onSent?.(n);
  };
  /* El panel va pegado a la voz a la que respondes (0,3125 rem, con el pico subiendo hasta su foto). */
  const composerFor = (note: ThreadNote) => replyTo?.note.id === note.id && (
    <div className="-mt-[0.1875rem]"><VoiceComposer pointer autoFocus allowAnon={allowAnon} maxSeconds={maxSeconds} target={{ id: note.id, name: nameOf(note.author), author: note.author, atMs: replyTo.atMs, durationMs: note.durationMs }} onClose={() => setReplyTo(null)} onSend={(c, a) => publish(c, a, replyTo)} /></div>
  );
  /* «Responder con tu voz» (en ⋮) abre el panel justo debajo de esa voz, desde el segundo en que la escuchas. */
  const replyHere = (note: ThreadNote) => {
    if (closed) { toast("Su autor ha cerrado las respuestas."); return; }
    setRootOpen(false); onComposerClose?.(); setReplyTo({ note, atMs: voicePosition(note.id) });
  };

  return (
    <div className="flex flex-col gap-2">
      {rootOpen && <div className={rootPointer ? "-mt-[0.1875rem]" : "pt-1"}><VoiceComposer pointer={rootPointer} autoFocus allowAnon={allowAnon} maxSeconds={maxSeconds} target={root} onClose={() => { setRootOpen(false); onComposerClose?.(); }} onSend={(c, a) => publish(c, a, null)} /></div>}
      {samples && <p className="px-1 text-3xs text-muted-foreground">Mensajes de voz de ejemplo (sin audio)</p>}
      {groups.length === 0 && !rootOpen && status === "loading" && <div className="grid place-items-center rounded-[0.9375rem] border border-dashed border-border p-6" aria-busy="true"><Loader2 className="animate-spin text-primary" size={24} /></div>}
      {groups.length === 0 && !rootOpen && status === "error" && <div className="rounded-[0.9375rem] border border-dashed border-border p-6 text-center"><AlertCircle className="mx-auto text-live" size={26} /><p className="mt-2 text-sm text-muted-foreground">No se pudo cargar la conversación. Comprueba tu conexión.</p></div>}
      {groups.length === 0 && !rootOpen && (status === "ready" || status === "local") && <div className="rounded-[0.9375rem] border border-dashed border-border p-6 text-center"><Mic className="mx-auto text-primary" size={28} /><p className="mt-2 text-sm text-muted-foreground">{emptyText}</p></div>}
      {groups.map(({ root: r, replies }) => (
        <div key={r.id} className="flex flex-col gap-2">
          <VoiceItem note={r} answersRoot={answersRoot} highlight={fresh === r.id} listen={listenFor(r)} onMore={() => setMenu(r)} />
          {composerFor(r)}
          {replies.map((n) => {
            const parent = n.parentId ? byId.get(n.parentId) : undefined;
            return (
              <div key={n.id} className="flex flex-col gap-2">
                <VoiceItem note={n} highlight={fresh === n.id} parentName={parent ? nameOf(parent.author) : undefined} listen={listenFor(n)} onMore={() => setMenu(n)} />
                {composerFor(n)}
              </div>
            );
          })}
        </div>
      ))}
      {menu && <VoiceMenu note={menu} name={nameOf(menu.author)} onClose={() => setMenu(null)} onReply={() => replyHere(menu)} />}
    </div>
  );
}

/** Botón para hablar en una conversación sin audio de arriba (grupos, lugares…): un botón de voz, no una caja de texto. */
export function TalkBar({ onTalk, label = "Grabar mensaje de voz" }: { onTalk: () => void; label?: string }) {
  return (
    <button type="button" onClick={onTalk} className="spot-voice-send flex min-h-12 w-full items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold text-white transition active:scale-[0.98]">
      <Mic size={18} />{label}
    </button>
  );
}

/** Muestra como aviso los errores del reproductor único (se monta una vez en la raíz de la app). */
export function VoiceErrorToasts() {
  useEffect(() => onVoiceError((m) => toast.error(m)), []);
  return null;
}
