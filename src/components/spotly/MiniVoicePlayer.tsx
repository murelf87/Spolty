import { AudioLines, Pause, Play, SkipForward, X } from "lucide-react";
import { formatClock } from "@/lib/voice/recorder";
import { pauseVoice, resumeVoice, seekVoice, skipVoice, stopAllVoices, useGlobalVoicePlayback } from "@/lib/voice/player";

/** Controles del reproductor único; no crea un segundo elemento de audio. */
export function MiniVoicePlayer() {
  const playback = useGlobalVoicePlayback();
  if (!playback.id) return null;
  const duration = Math.max(0, playback.durationMs);
  const position = Math.max(0, Math.min(duration || playback.positionMs, playback.positionMs));
  const remaining = playback.queueRemaining;
  return (
    <section aria-label="Mini reproductor de voz"
      className="fixed bottom-[var(--nav-h)] left-1/2 z-30 w-[calc(100%-1rem)] max-w-[504px] -translate-x-1/2 rounded-2xl border border-primary/30 bg-background/95 px-3 py-2 text-foreground shadow-2xl backdrop-blur min-[1100px]:bottom-5">
      <div className="flex items-center gap-2">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-spot-gradient" aria-hidden="true"><AudioLines size={18} /></span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold">Nota de voz</p>
          <p className="text-3xs tabular-nums text-muted-foreground">{formatClock(position)} / {formatClock(duration)}{remaining > 0 ? ` · ${remaining} en cola` : ""}</p>
        </div>
        <button type="button" onClick={() => playback.playing ? pauseVoice() : resumeVoice()}
          aria-label={playback.playing ? "Pausar audio" : "Reanudar audio"}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-secondary text-foreground">
          {playback.playing ? <Pause size={19} fill="currentColor" /> : <Play size={19} fill="currentColor" />}
        </button>
        {remaining > 0 && <button type="button" onClick={() => skipVoice()} aria-label="Siguiente audio"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-secondary text-foreground"><SkipForward size={19} /></button>}
        <button type="button" onClick={stopAllVoices} aria-label="Cerrar reproductor"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-muted-foreground hover:text-foreground"><X size={20} /></button>
      </div>
      <input type="range" min={0} max={Math.max(1, duration)} step={100} value={position}
        onChange={(event) => { if (playback.id) seekVoice(playback.id, Number(event.currentTarget.value)); }}
        aria-label="Posición del audio" className="mt-1 block h-4 w-full accent-primary" />
    </section>
  );
}
