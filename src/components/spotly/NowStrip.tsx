import { useEffect, useState } from "react";
import { Flame, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useApp } from "./app-context";
import { BoostedTag } from "./kit";
import { SpotDetail, type SpotInfo } from "./SpotDetail";
import { spotData } from "./spotData";
import { fmtRemaining, useMe, useNow, useStore } from "@/lib/store";
import { useCloud } from "@/lib/cloud";
import { useCloudFeed } from "@/lib/spots";
import stage from "@/assets/spotly-live-stage.jpg";
import beach from "@/assets/spotly-beach-club.jpg";
import festival from "@/assets/spotly-sevilla-festival.jpg";
import valencia from "@/assets/valencia-sunset.jpg";
import { commerce } from "@/lib/spotlyConfig";

type Tag = "HOT SPOT" | "EN DIRECTO" | "VIRAL" | "IMPULSADO" | "AHORA" | "TENDENCIA";
type Tile = { key: string; title: string; sub: string; img: string | null; peaks?: number[] | undefined; tag: Tag; go: () => void };

/**
 * Franja rotatoria “Ahora en Spotly”: mezcla contenido orgánico y de pago.
 * Lo pagado rota (no se fija), respeta el límite de frecuencia y va marcado “Impulsado”.
 * Con la nube muestra lo más escuchado de la semana (TENDENCIA) y lo que está pasando (AHORA) de verdad; mientras
 * no haya bastante, o sin cuenta, enseña ejemplos (en la demostración, con sus cifras de muestra).
 */
export function NowStrip() {
  const app = useApp();
  const { topNow, demo } = useStore();
  const me = useMe();
  const cloud = useCloud();
  const now = useNow();
  const [shift, setShift] = useState(0);
  const [open, setOpen] = useState<SpotInfo | null>(null);
  const trending = useCloudFeed({ kind: "trending", enabled: cloud.on });
  useEffect(() => { const t = setInterval(() => setShift((s) => s + 1), 4500); return () => clearInterval(t); }, []);
  const mine = topNow.filter((t) => t.endsAt > now);
  const real: Tile[] = trending.spots.slice(0, 8).map((m, i) => {
    const d = spotData(m, me.name);
    return { key: m.id, title: m.title, sub: m.city, img: d.img || null, peaks: m.audio.peaks, tag: m.happeningNow && Date.now() - m.createdAt < 3 * 3600000 ? "AHORA" : i === 0 && m.views >= 50 ? "VIRAL" : "TENDENCIA", go: () => setOpen(d) };
  });
  const samples: Tile[] = [
    { key: "h1", title: "Concierto en calle Betis", sub: demo ? "A 420 m" : "Ejemplo", img: stage, tag: "HOT SPOT", go: () => app.openHot("h1") },
    { key: "live", title: "Festival Sevilla", sub: demo ? "1,2K escuchando" : "Ejemplo", img: festival, tag: "EN DIRECTO", go: () => app.open("audio-wall") },
    { key: "sala", title: "Sala X", sub: demo ? "A 1,1 km" : "Ejemplo", img: beach, tag: "IMPULSADO", go: () => app.openBiz("salax") },
    { key: "viral", title: "Triana ahora", sub: demo ? "A 1,1 km" : "Ejemplo", img: stage, tag: "VIRAL", go: () => app.openPhotoWall("Sevilla") },
  ];
  const tiles: Tile[] = [
    ...mine.map((t, i): Tile => ({ key: "mine" + i, title: t.title, sub: `Tuyo · ${fmtRemaining(t.endsAt - now)}`, img: valencia, tag: "IMPULSADO", go: () => app.openPhotoWall("Sevilla") })),
    ...real,
    ...(real.length >= 3 ? [] : samples),
  ];
  const k = tiles.length ? shift % tiles.length : 0;
  const ordered = [...tiles.slice(k), ...tiles.slice(0, k)];
  return (
    <section className="spot-now mx-3 rounded-lg border border-border p-2" aria-label="Ahora en Spotly">
      <div className="mb-2 flex items-center justify-between"><h2 className="flex items-center gap-1 text-xs font-bold"><Flame size={17} className="text-live" /> AHORA EN SPOTLY</h2><Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Siguiente" onClick={() => setShift((s) => s + 1)}>›</Button></div>
      <div className="flex gap-2 overflow-x-auto pb-1">{ordered.slice(0, 4).map((t) => (
        <Button key={t.key} variant="ghost" onClick={t.go} aria-label={`${t.title}, ${t.tag.toLowerCase()}`} className="spot-now-tile relative aspect-[3/4] h-auto w-[calc((100%-1rem)/3)] min-w-0 shrink-0 overflow-hidden rounded-lg border p-0 text-left">
          {t.img ? <img src={t.img} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" /> : <span className="absolute inset-0 flex items-center justify-center gap-[0.125rem] bg-spot-surface px-2" aria-hidden="true">{(t.peaks?.length ? t.peaks : [0.3, 0.6, 0.9, 0.5, 0.7, 0.4]).filter((_, i) => i % 4 === 0).map((h, i) => <i key={i} className="w-[0.1875rem] rounded-full bg-spot-gradient" style={{ height: `${Math.round(h * 60)}%` }} />)}</span>}
          <span className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
          <span className="absolute left-1 top-1">{t.tag === "IMPULSADO" ? <BoostedTag /> : <span className={"rounded px-1 py-0.5 text-4xs font-bold " + (t.tag === "VIRAL" || t.tag === "TENDENCIA" ? "bg-accent" : "bg-live")}>{t.tag}</span>}</span>
          <span className="absolute bottom-1 left-1 right-1 text-3xs font-semibold leading-tight"><span className="line-clamp-2">{t.title}</span><small className="mt-0.5 flex items-center gap-0.5 font-normal text-foreground/80"><MapPin size={10} className="shrink-0" /><span className="truncate">{t.sub}</span></small></span>
        </Button>))}</div>
      <p className="mt-1 text-3xs text-muted-foreground">Lo impulsado rota y se marca. Máx. {commerce.frequencyCapPerUserPerDay} veces por persona y día.</p>
      {open && <SpotDetail s={open} onClose={() => setOpen(null)} onAuthor={() => setOpen(null)} />}
    </section>
  );
}
