import { useEffect, useRef } from "react";
import { Loader2, Mic, Pause, Play, Square, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { VoiceWave } from "./VoiceThread";
import { formatClock, recorderErrorText, useVoiceRecorder, type VoiceClip } from "@/lib/voice/recorder";
import { releaseVoice, stopAllVoices, toggleVoice, useVoicePlayback } from "@/lib/voice/player";

/**
 * Grabar un mensaje de voz real fuera de las conversaciones (anuncios y ofertas de negocios, formularios): micrófono
 * de verdad, onda en vivo, escucha previa y repetir. Devuelve la grabación con `onChange` (null si se borra).
 */
export function VoiceRecordTile({ maxSeconds = 30, variant = "big", onChange, idleText = "Grabar mensaje" }: { maxSeconds?: number; variant?: "big" | "row"; onChange?: ((clip: VoiceClip | null) => void) | undefined; idleText?: string }) {
  const rec = useVoiceRecorder({ maxSeconds });
  const previewId = useRef(`grabacion-${Math.random().toString(36).slice(2)}`).current;
  const pb = useVoicePlayback(previewId);
  const changed = useRef(onChange);
  changed.current = onChange;
  useEffect(() => { changed.current?.(rec.state === "recorded" ? rec.clip : null); }, [rec.state, rec.clip]);
  useEffect(() => { if (rec.error) toast.error(recorderErrorText(rec.error, maxSeconds)); }, [rec.error, maxSeconds]);
  useEffect(() => () => releaseVoice(previewId), [previewId]);
  const recording = rec.state === "recording", clip = rec.state === "recorded" ? rec.clip : null;
  const main = () => {
    if (rec.state === "idle") void rec.start();
    else if (recording) rec.stop();
    else if (clip) toggleVoice(previewId, clip.url, clip.durationMs);
  };
  const again = () => { if (pb.active) stopAllVoices(); rec.discard(); };
  const icon = rec.state === "requesting" ? <Loader2 className="animate-spin" size={variant === "big" ? 34 : 16} /> : recording ? <Square size={variant === "big" ? 30 : 14} fill="currentColor" /> : clip ? (pb.playing ? <Pause size={variant === "big" ? 32 : 15} fill="currentColor" /> : <Play size={variant === "big" ? 32 : 15} fill="currentColor" className="ml-0.5" />) : <Mic size={variant === "big" ? 36 : 16} />;
  const label = rec.state === "idle" ? idleText : recording ? "Parar la grabación" : pb.playing ? "Pausar la escucha" : "Escuchar tu mensaje";
  const live = Array.from({ length: 34 }, (_, i) => rec.live[rec.live.length - 34 + i]);
  const wave = clip
    ? <VoiceWave peaks={clip.peaks} progress={pb.active ? pb.positionMs / clip.durationMs : 0} playhead={pb.active} className="h-10 flex-1" label="Tu mensaje de voz" />
    : <div className="flex h-10 flex-1 items-center justify-between gap-[0.125rem]" aria-hidden="true">{live.map((v, i) => v === undefined ? <span key={i} className="h-1 w-1 shrink-0 rounded-full bg-muted-foreground/35" /> : <span key={i} className="spot-voice-bar" style={{ height: `${Math.round(Math.max(0.1, Math.min(1, v * 9)) * 100)}%` }} />)}</div>;
  if (variant === "row") return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center gap-3">
        <button type="button" onClick={main} disabled={rec.state === "requesting"} aria-label={label} className={(recording ? "spot-pulse " : "") + "grid h-10 w-10 shrink-0 place-items-center rounded-full bg-spot-gradient"}>{icon}</button>
        {rec.state === "idle" ? <span className="flex-1 text-sm">{idleText}</span> : wave}
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{clip ? formatClock(pb.active ? pb.positionMs : clip.durationMs) : formatClock(rec.elapsedMs)}</span>
        {clip && <Button variant="ghost" size="icon" aria-label="Borrar y repetir" onClick={again}><Trash2 size={15} /></Button>}
      </div>
    </div>
  );
  return (
    <div className="text-center">
      <div className="mx-auto my-6 flex h-10 max-w-xs">{wave}</div>
      <button type="button" onClick={main} disabled={rec.state === "requesting"} aria-label={label} className={(recording ? "spot-pulse " : "") + "mx-auto grid h-24 w-24 place-items-center rounded-full bg-spot-gradient shadow-glow"}>{icon}</button>
      <p className="mt-3 font-semibold tabular-nums">{clip ? formatClock(pb.active ? pb.positionMs : clip.durationMs) : formatClock(rec.elapsedMs)} / {formatClock(maxSeconds * 1000)}</p>
      <p className="text-xs text-muted-foreground">{recording ? "Grabando… pulsa para terminar" : clip ? "Mensaje grabado · pulsa para escucharlo" : rec.state === "requesting" ? "Permite el micrófono…" : "Pulsa para empezar"}</p>
      {clip && <Button variant="ghost" className="mt-2" onClick={again}><Trash2 size={14} />Repetir</Button>}
    </div>
  );
}
