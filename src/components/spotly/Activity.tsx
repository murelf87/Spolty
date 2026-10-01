import { useState } from "react";
import { BadgeCheck, Calendar, Heart, Mic, Pause, Play, Sparkles, UserPlus, Zap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import festival from "@/assets/spotly-sevilla-festival.jpg";
import stage from "@/assets/spotly-live-stage.jpg";
import beach from "@/assets/spotly-beach-club.jpg";
import mePhoto from "@/assets/spotly-me.jpg";

type N = { id: number; k: "like" | "voz" | "follow" | "hito" | "evento" | "impulso"; u: string; t: string; time: string; today: boolean; read: boolean; img?: string; group: "Menciones" | "Seguidores" | "Sistema" };
const init: N[] = [
  { id: 1, k: "voz", u: "María", t: "ha escuchado tu Spot", time: "2 min", today: true, read: false, img: festival, group: "Menciones" },
  { id: 2, k: "like", u: "Carlos", t: "ha reaccionado", time: "3 min", today: true, read: false, img: beach, group: "Menciones" },
  { id: 3, k: "follow", u: "Sofía", t: "ha compartido tu Spot", time: "5 min", today: true, read: false, group: "Seguidores" },
  { id: 4, k: "hito", u: "Spotly", t: "Tu Spot tiene más de 1.000 vistas", time: "10 min", today: true, read: true, img: festival, group: "Sistema" },
  { id: 5, k: "evento", u: "Spotly", t: "12 personas están hablando en este lugar", time: "8 min", today: true, read: true, img: stage, group: "Sistema" },
  { id: 6, k: "impulso", u: "Spotly", t: "Tu impulso x5 termina en 2 h", time: "2 h", today: true, read: true, group: "Sistema" },
  { id: 7, k: "follow", u: "Javi", t: "ha empezado a seguirte", time: "Ayer", today: false, read: true, group: "Seguidores" },
  { id: 8, k: "voz", u: "Lucía", t: "te ha mencionado en un Spot", time: "Ayer", today: false, read: true, img: beach, group: "Menciones" },
];
const icon = { like: Heart, voz: Mic, follow: UserPlus, hito: Sparkles, evento: Calendar, impulso: Zap };
const tint = { like: "bg-live", voz: "bg-primary", follow: "bg-primary", hito: "bg-accent", evento: "bg-accent", impulso: "bg-live" };

export function ActivityView() {
  const [tab, setTab] = useState("Todas");
  const [list, setList] = useState(init);
  const [fol, setFol] = useState<number[]>([]);
  const [playing, setPlaying] = useState<number | null>(null);
  const shown = list.filter((n) => tab === "Todas" || (tab === "Eventos" ? n.k === "evento" || n.k === "hito" : tab === "Menciones" ? n.group === "Menciones" : n.group === tab));
  const unread = list.filter((n) => !n.read).length;

  const row = (n: N) => {
    const I = icon[n.k];
    return (
      <div key={n.id} onClick={() => setList(list.map((x) => (x.id === n.id ? { ...x, read: true } : x)))} className={`flex items-center gap-3 border-b border-border/40 py-3 ${n.read ? "opacity-75" : ""}`}>
        <span className="relative shrink-0">
          {n.u === "Spotly"
            ? <span className="grid h-11 w-11 place-items-center rounded-full bg-spot-gradient text-lg font-bold text-primary-foreground">{n.k === "evento" ? <Zap size={23} /> : n.k === "hito" ? <Sparkles size={23} /> : "S"}</span>
            : <img src={[festival, mePhoto, beach, mePhoto, stage][n.id % 5]} alt={n.u} className="h-11 w-11 rounded-full object-cover ring-2 ring-primary/40" />}
          <span className={`absolute -bottom-0.5 -right-0.5 grid h-5 w-5 place-items-center rounded-full ${tint[n.k]} text-primary-foreground ring-2 ring-background`}><I size={11} /></span>
        </span>
        <span className="min-w-0 flex-1 text-sm">
          {n.u !== "Spotly" && <><strong>{n.u}</strong>{n.k === "follow" && <BadgeCheck size={12} className="ml-1 inline text-primary" />} </>}{n.t}
           {n.k === "voz" && playing === n.id && (
            <span className="mt-1.5 flex items-center gap-2">
              <button aria-label={playing === n.id ? "Pausar" : "Escuchar respuesta"} onClick={(e) => { e.stopPropagation(); setPlaying(playing === n.id ? null : n.id); }} className="grid h-7 w-7 place-items-center rounded-full bg-primary text-primary-foreground">
                {playing === n.id ? <Pause size={13} /> : <Play size={13} />}
              </button>
              <span className="flex h-5 flex-1 items-center gap-[2px]">{Array.from({ length: 22 }, (_, i) => <span key={i} className={`w-[3px] rounded-full ${playing === n.id ? "bg-primary animate-pulse" : "bg-muted-foreground/50"}`} style={{ height: `${30 + ((i * 37) % 70)}%` }} />)}</span>
              <span className="text-[10px] text-muted-foreground">0:12</span>
            </span>
          )}
          <span className="block text-xs text-muted-foreground">{n.time === "Ayer" ? "Ayer" : `Hace ${n.time}`}</span>
        </span>
        {n.k === "follow" && <Button size="sm" variant={fol.includes(n.id) ? "secondary" : "default"} onClick={(e) => { e.stopPropagation(); setFol(fol.includes(n.id) ? fol.filter((f) => f !== n.id) : [...fol, n.id]); }}>{fol.includes(n.id) ? "Siguiendo" : "Seguir"}</Button>}
        {n.k === "voz" && <Button size="icon" variant="secondary" aria-label="Responder con tu voz" onClick={(e) => { e.stopPropagation(); toast(`Grabando respuesta para ${n.u}…`); }}><Mic size={16} /></Button>}
        {n.img && n.k !== "voz" && <img src={n.img} alt="" className="h-11 w-11 shrink-0 rounded-lg object-cover" />}
        {!n.read && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />}
      </div>
    );
  };

  const today = shown.filter((n) => n.today), before = shown.filter((n) => !n.today);
  return (
    <main className="px-4 pb-24 pt-[max(2.75rem,calc(env(safe-area-inset-top)+0.5rem))]">
       <div className="flex items-center justify-center">
         <h1 className="text-base font-bold">Notificaciones{unread > 0 && <span className="sr-only"> · {unread} sin leer</span>}</h1>
      </div>
       <div className="mt-4 grid grid-cols-4 gap-1">{["Todas", "Menciones", "Seguidores", "Eventos"].map((x) => <Button key={x} size="sm" variant={tab === x ? "default" : "secondary"} onClick={() => setTab(x)} className={`h-8 min-w-0 rounded-full px-1 text-[10px] ${tab === x ? "spot-active-pill" : "text-foreground"}`}>{x}</Button>)}</div>
      {shown.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">Nada por aquí todavía</p>}
       {today.length > 0 && <div className="mt-5 space-y-0">{today.map(row)}</div>}
       {before.length > 0 && <div className="space-y-0">{before.map(row)}</div>}
    </main>
  );
}
