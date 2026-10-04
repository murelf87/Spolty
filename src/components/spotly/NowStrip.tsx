import { useEffect, useState } from "react";
import { Flame, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useApp } from "./app-context";
import { BoostedTag } from "./kit";
import { fmtRemaining, useNow, useStore } from "@/lib/store";
import stage from "@/assets/spotly-live-stage.jpg";
import beach from "@/assets/spotly-beach-club.jpg";
import festival from "@/assets/spotly-sevilla-festival.jpg";
import valencia from "@/assets/valencia-sunset.jpg";
import { commerce } from "@/lib/spotlyConfig";

type Tile = { key: string; title: string; sub: string; img: string; tag: "HOT SPOT" | "EN DIRECTO" | "VIRAL" | "IMPULSADO"; go: () => void };

/**
 * Franja rotatoria “Ahora en Spotly”: mezcla contenido orgánico y de pago.
 * Lo pagado rota (no se fija), respeta el límite de frecuencia y va marcado “Impulsado”.
 */
export function NowStrip() {
  const app = useApp();
  const { topNow } = useStore();
  const now = useNow();
  const [shift, setShift] = useState(0);
  useEffect(() => { const t = setInterval(() => setShift((s) => s + 1), 4500); return () => clearInterval(t); }, []);
  const mine = topNow.filter((t) => t.endsAt > now);
  const tiles: Tile[] = [
    { key: "h1", title: "Concierto en calle Betis", sub: "A 420 m", img: stage, tag: "HOT SPOT", go: () => app.openHot("h1") },
    ...mine.map((t, i): Tile => ({ key: "mine" + i, title: t.title, sub: `Tuyo · ${fmtRemaining(t.endsAt - now)}`, img: valencia, tag: "IMPULSADO", go: () => app.openPhotoWall("Sevilla") })),
    { key: "live", title: "Festival Sevilla", sub: "1,2K escuchando", img: festival, tag: "EN DIRECTO", go: () => app.open("audio-wall") },
    { key: "sala", title: "Sala X", sub: "A 1,1 km", img: beach, tag: "IMPULSADO", go: () => app.openBiz("salax") },
    { key: "viral", title: "Triana ahora", sub: "A 1,1 km", img: stage, tag: "VIRAL", go: () => app.openPhotoWall("Sevilla") },
  ];
  const k = tiles.length ? shift % tiles.length : 0;
  const ordered = [...tiles.slice(k), ...tiles.slice(0, k)];
  return (
    <section className="spot-now mx-3 rounded-lg border border-border p-2" aria-label="Ahora en Spotly">
      <div className="mb-2 flex items-center justify-between"><h2 className="flex items-center gap-1 text-xs font-bold"><Flame size={17} className="text-live" /> AHORA EN SPOTLY</h2><Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Siguiente" onClick={() => setShift((s) => s + 1)}>›</Button></div>
      <div className="flex gap-2 overflow-x-auto pb-1">{ordered.slice(0, 4).map((t) => (
        <Button key={t.key} variant="ghost" onClick={t.go} aria-label={`${t.title}, ${t.tag.toLowerCase()}`} className="spot-now-tile relative aspect-[3/4] h-auto w-[calc((100%-1rem)/3)] min-w-0 shrink-0 overflow-hidden rounded-lg border p-0 text-left">
          <img src={t.img} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" /><span className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
          <span className="absolute left-1 top-1">{t.tag === "IMPULSADO" ? <BoostedTag /> : <span className={"rounded px-1 py-0.5 text-4xs font-bold " + (t.tag === "VIRAL" ? "bg-accent" : "bg-live")}>{t.tag}</span>}</span>
          <span className="absolute bottom-1 left-1 right-1 text-3xs font-semibold leading-tight">{t.title}<small className="mt-0.5 flex items-center gap-0.5 font-normal text-foreground/80"><MapPin size={10} />{t.sub}</small></span>
        </Button>))}</div>
      <p className="mt-1 text-3xs text-muted-foreground">Lo impulsado rota y se marca. Máx. {commerce.frequencyCapPerUserPerDay} veces por persona y día.</p>
    </section>
  );
}
