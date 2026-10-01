import { useEffect, useState } from "react";
import { ChevronLeft, MapPin, Mic, Pause, Phone, Play, RotateCw, Star, TrendingUp, Zap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import salon from "@/assets/spotly-salon.jpg";
import beach from "@/assets/spotly-beach-club.jpg";
import stage from "@/assets/spotly-live-stage.jpg";
import festival from "@/assets/spotly-sevilla-festival.jpg";

/* Lámina 9: ejemplo de comercio local patrocinado */
export function LocalAdCard() {
  const [play, setPlay] = useState(false);
  return <article className="spot-feed-card mx-3 overflow-hidden rounded-2xl bg-card">
    <img src={salon} alt="Peluquería Carmen" width={1024} height={640} loading="lazy" className="aspect-[16/9] w-full object-cover" />
    <div className="p-3">
      <div className="flex items-center gap-2"><img src={beach} alt="" className="h-10 w-10 rounded-full object-cover" /><div className="flex-1"><p className="flex items-center gap-2 text-sm font-bold">Peluquería Carmen <span className="rounded bg-accent px-1.5 py-0.5 text-[9px] font-semibold">Patrocinado</span></p><p className="flex items-center gap-1 text-xs text-muted-foreground"><MapPin size={11} />A 320 m · Abierto</p><p className="flex items-center gap-1 text-xs"><Star size={11} className="text-premium" fill="currentColor" />4.8 <span className="text-muted-foreground">(321)</span></p></div></div>
      <div className="mt-2 flex items-center gap-2 rounded-full border border-border bg-secondary p-1"><button aria-label={play ? "Pausar oferta" : "Escuchar oferta"} onClick={() => setPlay(!play)} className="grid h-8 w-8 place-items-center rounded-full bg-primary text-primary-foreground">{play ? <Pause size={13} fill="currentColor" /> : <Mic size={14} />}</button><span className="flex h-6 flex-1 items-center gap-[3px]">{[6, 12, 17, 9, 14, 19, 8, 13, 16, 7, 12, 18].map((h, i) => <span key={i} className={play ? "bg-primary" : "bg-muted-foreground"} style={{ height: h, width: 3, borderRadius: 3 }} />)}</span><span className="text-xs">0:28</span><button aria-label="Repetir" onClick={() => setPlay(true)} className="grid h-8 w-8 place-items-center rounded-full bg-card"><RotateCw size={14} /></button></div>
      <p className="mt-2 text-sm">Corte + peinado por 18 € esta semana. ¡Pide tu cita ahora!</p>
      <div className="mt-3 grid grid-cols-3 gap-2 text-xs font-semibold">
        <button onClick={() => toast("Llamando a Peluquería Carmen")} className="flex items-center justify-center gap-1 rounded-full bg-primary/20 py-2 text-primary"><Phone size={13} />Llamar</button>
        <button onClick={() => toast("Ruta abierta en el mapa")} className="rounded-full bg-primary/20 py-2 text-primary">Cómo llegar</button>
        <button onClick={() => toast.success("Cita solicitada")} className="rounded-full bg-spot-gradient py-2">Reservar</button>
      </div>
    </div>
  </article>;
}

/* Lámina 11: últimos seguidores reales */
const people = [["Carlos", "Sevilla · Hace 2 min", stage], ["Sofía", "Triana · Hace 4 min", beach], ["Javi", "Cerca de ti · Hace 6 min", festival], ["Ana", "Sevilla · Hace 8 min", beach], ["Miguel", "A 3 km · Hace 10 min", stage]] as const;
export function NewFollowers({ onClose }: { onClose: () => void }) {
  const [f, setF] = useState<string[]>([]);
  return <div className="fixed inset-0 z-[70] overflow-y-auto bg-background">
    <header className="flex items-center gap-2 p-3"><Button variant="ghost" size="icon" aria-label="Volver" onClick={onClose}><ChevronLeft /></Button><h2 className="text-lg font-bold">Últimos seguidores</h2></header>
    <div className="space-y-2 px-4 pb-8">{people.map(([n, s, img]) => { const on = f.includes(n); return <div key={n} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3"><img src={img} alt="" className="h-11 w-11 rounded-full object-cover" /><div className="flex-1"><p className="text-sm font-semibold">{n} <span className="text-primary">✦</span></p><p className="text-xs text-muted-foreground">{s}</p></div><button onClick={() => setF(on ? f.filter(x => x !== n) : [...f, n])} className={"rounded-full px-4 py-1.5 text-xs font-semibold " + (on ? "border border-border" : "bg-spot-gradient")}>{on ? "Siguiendo" : "Seguir"}</button></div>; })}</div>
  </div>;
}

/* Lámina 8: zona superior rotatoria (Spots impulsados que se turnan) */
const top = [
  { n: "Beach Club", t: "Fiesta al atardecer", img: beach, x: "x10" },
  { n: "Sala Malandar", t: "Concierto esta noche", img: stage, x: "x5" },
  { n: "Feria de Triana", t: "Casetas abiertas", img: festival, x: "x5" },
];
export function TopZone() {
  const [i, setI] = useState(0);
  useEffect(() => { const id = setInterval(() => setI((v) => (v + 1) % top.length), 3500); return () => clearInterval(id); }, []);
  return (
    <section className="spot-now mx-3 overflow-hidden rounded-lg border border-accent/50 p-2 shadow-glow">
      <div className="mb-2 flex items-center justify-between"><h2 className="flex items-center gap-1 text-xs font-bold"><Zap size={16} className="text-live" />AHORA EN SPOTLY</h2><Button variant="ghost" size="icon" className="h-6 w-6" aria-label="Siguiente destacado" onClick={() => setI((i + 1) % top.length)}>›</Button></div>
      <div className="flex gap-2 overflow-x-auto pb-1">{[...top.slice(i), ...top.slice(0,i), {n:"Festival Sevilla",t:"En directo",img:festival,x:"LIVE"}].map((s,k) => <Button key={`${s.n}-${k}`} variant="ghost" onClick={() => setI((i + 1) % top.length)} aria-label={`${s.n} destacado`} className="spot-now-tile relative aspect-[3/4] h-auto w-[29%] shrink-0 overflow-hidden rounded-lg border p-0 text-left"><img src={s.img} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover"/><span className="absolute inset-0 bg-gradient-to-t from-background/90 via-transparent to-transparent"/><span className="absolute left-1 top-1 rounded bg-accent px-1 text-[8px] font-bold">{s.x === "LIVE" ? "EN DIRECTO" : "IMPULSADO"}</span><span className="absolute bottom-2 left-1 right-1 text-[10px] font-semibold"><strong className="block truncate">{s.n}</strong><small className="block truncate font-normal text-foreground/80">{s.t}</small></span></Button>)}</div>
    </section>
  );
}

/* Lámina 10: ganar seguidores */
export function GrowCard({ onBoost }: { onBoost: () => void }) {
  return (
    <div className="mx-3 rounded-lg border border-primary/40 bg-card p-4">
      <p className="flex items-center gap-2 text-sm font-bold"><TrendingUp size={17} className="text-primary" />Gana seguidores reales</p>
      <p className="mt-1 text-xs text-muted-foreground">Impulsa tu próximo Spot y llega a personas cerca de ti que comparten tus intereses.</p>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">{[["+120", "x2"], ["+480", "x5"], ["+1,2K", "x10"]].map(([f, x]) => <span key={x} className="rounded-lg bg-secondary py-2"><strong className="block text-sm text-primary">{f}</strong><small className="text-[10px] text-muted-foreground">seguidores · {x}</small></span>)}</div>
      <Button className="mt-3 w-full" onClick={onBoost}><Zap size={15} />Impulsar mi perfil</Button>
    </div>
  );
}
