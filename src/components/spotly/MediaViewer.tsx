import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";
import { ChevronLeft, ChevronRight, Heart, MapPin, Pause, Play, Share2, X } from "lucide-react";
import { toast } from "sonner";
import { useStore } from "@/lib/store";

export type MediaItem = {
  kind: "foto" | "video";
  /** Imagen (foto) o archivo de vídeo. */
  src: string;
  /** Portada del vídeo mientras carga. */
  poster?: string;
  caption: string;
  place: string;
  likes: number;
};

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const count = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1).replace(".0", "").replace(".", ",")}K` : String(n));

/**
 * Visor a pantalla completa de fotos y vídeos: deslizar o flechas para pasar, tocar el vídeo para pausarlo,
 * barra para avanzar, Escape para cerrar. Los vídeos empiezan solos y en silencio, como en cualquier red social.
 */
export function MediaViewer({ items, start = 0, onClose }: { items: MediaItem[]; start?: number; onClose: () => void }) {
  /* Las fotos y vídeos de ejemplo solo enseñan «me gusta» inventados en la demostración. */
  const { demo } = useStore();
  const [index, setIndex] = useState(Math.min(Math.max(start, 0), items.length - 1));
  const [liked, setLiked] = useState<number[]>([]);
  const [paused, setPaused] = useState(false);
  const [time, setTime] = useState({ now: 0, total: 0 });
  const [dragX, setDragX] = useState(0);
  const drag = useRef<number | null>(null);
  const video = useRef<HTMLVideoElement | null>(null);
  const item = items[index];

  const go = useCallback((step: number) => setIndex((i) => Math.min(items.length - 1, Math.max(0, i + step))), [items.length]);

  useEffect(() => { setPaused(false); setTime({ now: 0, total: 0 }); }, [index]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, onClose]);

  if (!item) return null;
  const isLiked = liked.includes(index);

  const togglePlay = () => {
    const v = video.current;
    if (!v) return;
    if (v.paused) { void v.play().catch(() => undefined); setPaused(false); } else { v.pause(); setPaused(true); }
  };
  const share = async () => {
    const url = `https://spotly.app/perfil/tu.spotly/${index + 1}`;
    try {
      if (navigator.share) { await navigator.share({ title: item.caption, url }); return; }
      await navigator.clipboard?.writeText(url);
      toast("Enlace copiado");
    } catch { toast("Enlace copiado"); }
  };
  const onDown = (e: PointerEvent<HTMLDivElement>) => { drag.current = e.clientX; e.currentTarget.setPointerCapture(e.pointerId); };
  const onMove = (e: PointerEvent<HTMLDivElement>) => { if (drag.current !== null) setDragX(e.clientX - drag.current); };
  const onUp = () => {
    if (drag.current === null) return;
    const dx = dragX;
    drag.current = null;
    setDragX(0);
    if (dx < -50) go(1);
    else if (dx > 50) go(-1);
    else if (Math.abs(dx) < 8 && item.kind === "video") togglePlay();
  };

  return (
    <div role="dialog" aria-modal="true" aria-label={item.kind === "video" ? "Vídeo" : "Foto"} className="fixed inset-0 z-[75] mx-auto flex max-w-[520px] flex-col bg-black text-white">
      <header className="relative z-10 flex items-center justify-between px-3 pb-2 pt-[var(--safe-header)]">
        <button onClick={onClose} aria-label="Cerrar" className="grid h-10 w-10 place-items-center rounded-full bg-white/10"><X size={20} /></button>
        <span className="text-sm font-semibold tabular-nums">{index + 1} / {items.length}</span>
        <button onClick={() => void share()} aria-label="Compartir" className="grid h-10 w-10 place-items-center rounded-full bg-white/10"><Share2 size={18} /></button>
      </header>

      <div className="relative min-h-0 flex-1 touch-none select-none overflow-hidden" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
        <div className="absolute inset-0" style={{ transform: `translateX(${dragX}px)`, transition: dragX ? "none" : "transform 0.2s ease-out" }}>
          {item.kind === "video" ? (
            <video
              key={item.src}
              ref={(el) => { video.current = el; if (el) { el.muted = true; el.defaultMuted = true; } }}
              src={item.src}
              poster={item.poster}
              autoPlay
              muted
              playsInline
              loop
              onTimeUpdate={(e) => setTime({ now: e.currentTarget.currentTime, total: e.currentTarget.duration || 0 })}
              className="h-full w-full object-contain"
            />
          ) : (
            <img src={item.src} alt={item.caption} draggable={false} className="h-full w-full object-contain" />
          )}
        </div>
        {item.kind === "video" && paused && <span className="pointer-events-none absolute left-1/2 top-1/2 grid h-16 w-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-black/55"><Play size={30} fill="currentColor" /></span>}
        {index > 0 && <button onClick={() => go(-1)} onPointerDown={(e) => e.stopPropagation()} aria-label="Anterior" className="absolute left-2 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-black/45"><ChevronLeft size={24} /></button>}
        {index < items.length - 1 && <button onClick={() => go(1)} onPointerDown={(e) => e.stopPropagation()} aria-label="Siguiente" className="absolute right-2 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-black/45"><ChevronRight size={22} /></button>}
      </div>

      <footer className="relative z-10 space-y-3 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
        {item.kind === "video" && (
          <div className="flex items-center gap-3 text-xs tabular-nums">
            <button onClick={togglePlay} aria-label={paused ? "Reproducir" : "Pausar"} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/10">{paused ? <Play size={16} fill="currentColor" /> : <Pause size={16} fill="currentColor" />}</button>
            <span className="w-8">{clock(time.now)}</span>
            <input type="range" min={0} max={time.total || 1} step={0.1} value={time.now} aria-label="Avanzar en el vídeo"
              onChange={(e) => { const v = video.current; if (v) v.currentTime = Number(e.target.value); }}
              className="h-1.5 min-w-0 flex-1 cursor-pointer accent-primary" />
            <span className="w-8 text-right">{clock(time.total)}</span>
          </div>
        )}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold">{item.caption}</p>
            <p className="mt-1 flex items-center gap-1 text-xs text-white/70"><MapPin size={12} />{item.place}</p>
          </div>
          <button onClick={() => setLiked(isLiked ? liked.filter((i) => i !== index) : [...liked, index])} aria-label="Me gusta" aria-pressed={isLiked} className="flex shrink-0 flex-col items-center gap-0.5 text-xs font-semibold">
            <Heart size={24} className={isLiked ? "text-live" : ""} fill={isLiked ? "currentColor" : "none"} />{demo ? count(item.likes + (isLiked ? 1 : 0)) : null}
          </button>
        </div>
        {items.length > 1 && (
          <div className="flex justify-center gap-1.5">
            {items.map((m, i) => <button key={m.src + i} onClick={() => setIndex(i)} aria-label={`Ir a ${m.kind === "video" ? "vídeo" : "foto"} ${i + 1}`} className={"h-1.5 rounded-full transition-all " + (i === index ? "w-5 bg-white" : "w-1.5 bg-white/40")} />)}
          </div>
        )}
      </footer>
    </div>
  );
}
