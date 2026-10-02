import { useState } from "react";
import { ArrowLeft, Headphones, MapPin, Mic, MicOff, Radio, Search, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import portraits from "@/assets/audio-wall-portraits.jpg";
import { usePos } from "@/lib/preview-context";

type Filter = "En directo" | "Cerca" | "Tendencias";

const rooms: Record<Filter, { title: string; area: string; listeners: number; image: number }> = {
  "En directo": { title: "Sevilla centro · En directo", area: "Sevilla centro", listeners: 248, image: 2 },
  Cerca: { title: "Voces de Triana · En directo", area: "A 1,2 km", listeners: 86, image: 0 },
  Tendencias: { title: "La noche en Sevilla · En directo", area: "Sevilla", listeners: 1234, image: 3 },
};

function Portrait({ person, className = "" }: { person: number; className?: string }) {
  return <span className={`audio-wall-portrait ${className}`}><img src={portraits} alt="" width={1024} height={1024} className={`audio-wall-crop audio-wall-crop-${person}`} /></span>;
}

export function AudioWallLive({ onBack }: { onBack: () => void }) {
  const pos = usePos();
  const [filter, setFilter] = useState<Filter>("En directo");
  const [joined, setJoined] = useState(false);
  const [muted, setMuted] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const room = rooms[filter];
  const visible = !query || `${room.title} ${room.area}`.toLocaleLowerCase("es").includes(query.toLocaleLowerCase("es"));

  return <div className={pos + " inset-0 z-50 mx-auto flex w-full max-w-[520px] flex-col overflow-y-auto bg-background px-2 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(2.75rem,calc(env(safe-area-inset-top)+0.5rem))] text-foreground"}>
    <div className="mb-2 px-4 text-[11px] font-bold uppercase text-primary">Audio Wall (en directo)</div>
    <div className="audio-wall-frame flex flex-col rounded-[24px] p-3">
      <header className="grid h-9 shrink-0 grid-cols-[36px_1fr_36px] items-center">
        <Button variant="ghost" size="icon" className="h-9 w-9" aria-label={joined ? "Salir de la sala" : "Volver"} onClick={() => joined ? setJoined(false) : onBack()}><ArrowLeft size={22} /></Button>
        <h1 className="text-center text-base font-bold">Audio Wall</h1>
        <Button variant="ghost" size="icon" className="h-9 w-9" aria-label="Buscar salas de voz" onClick={() => setSearchOpen(!searchOpen)}><Search size={20} /></Button>
      </header>
      {searchOpen && <div className="mt-2 flex items-center gap-2 rounded-lg border border-border bg-card px-3"><Search size={16} className="text-muted-foreground" /><input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar salas" aria-label="Buscar salas" className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" /><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setQuery(""); setSearchOpen(false); }} aria-label="Cerrar búsqueda"><X size={16} /></Button></div>}
      <div className="mt-3 grid shrink-0 grid-cols-3 gap-1.5" role="tablist" aria-label="Filtrar salas">
        {(["En directo", "Cerca", "Tendencias"] as const).map(name => <Button key={name} role="tab" aria-selected={filter === name} variant="secondary" className={`h-9 min-w-0 rounded-full border px-1 text-xs ${filter === name ? "spot-active-pill border-primary text-foreground" : "border-border bg-card/80 text-foreground/85"}`} onClick={() => { setFilter(name); setJoined(false); }}>{name}</Button>)}
      </div>
      {visible ? <>
        <div className="audio-wall-stage relative mx-auto mt-3 min-h-[260px] w-full max-w-[370px] flex-1" aria-label="Personas en el Audio Wall">
          <span className="audio-wall-link audio-wall-link-a" /><span className="audio-wall-link audio-wall-link-b" /><span className="audio-wall-link audio-wall-link-c" /><span className="audio-wall-link audio-wall-link-d" />
          <Portrait person={0} className="audio-wall-person audio-wall-p1" /><Portrait person={1} className="audio-wall-person audio-wall-p2" />
          <Portrait person={2} className="audio-wall-person audio-wall-p3" /><Portrait person={3} className="audio-wall-person audio-wall-p4" /><Portrait person={0} className="audio-wall-person audio-wall-p5" />
          <span className="audio-wall-note audio-wall-note-a"><Headphones size={17} /></span><span className="audio-wall-note audio-wall-note-b"><Headphones size={17} /></span>
          <span className="audio-wall-note audio-wall-note-c"><Headphones size={18} /></span>
          <span className="audio-wall-center" aria-hidden="true"><Mic size={39} /></span>
        </div>
        <div className="audio-wall-room mt-2 flex shrink-0 items-center gap-3 rounded-2xl border border-primary/50 p-2.5">
          <Portrait person={room.image} className="h-[88px] w-[76px] shrink-0 rounded-xl border-0" />
          <div className="min-w-0 flex-1"><p className="flex items-center gap-1.5 text-xs font-semibold"><Users size={14} className="text-primary" />{room.listeners.toLocaleString("es-ES")} escuchando</p><p className="mt-0.5 truncate text-xs text-muted-foreground">{room.title}</p>
            <Button onClick={() => setJoined(!joined)} className="mt-2 h-9 w-full rounded-full bg-spot-gradient font-bold text-foreground">{joined ? "Salir de la sala" : "Unirte"}</Button>
          </div>
        </div>
        {joined && <div className="mt-2 flex shrink-0 items-center justify-between gap-2 rounded-xl border border-border bg-card px-3 py-2"><div className="min-w-0"><p className="flex items-center gap-1 text-xs font-semibold"><Radio size={13} className="text-live" /> Escuchando · ejemplo</p><p className="flex items-center gap-1 truncate text-[11px] text-muted-foreground"><MapPin size={11} />{room.area} · No hay audio en directo</p></div><Button variant="secondary" size="icon" aria-label={muted ? "Solicitar turno de voz" : "Cancelar solicitud de voz"} onClick={() => setMuted(!muted)} className="h-10 w-10 shrink-0 rounded-full">{muted ? <MicOff size={19} /> : <Mic size={19} className="text-primary" />}</Button></div>}
      </> : <div className="grid flex-1 place-items-center text-center text-sm text-muted-foreground">No hay salas de ejemplo con ese nombre.</div>}
      <p className="mt-2 text-center text-[10px] text-muted-foreground">Salas y oyentes de ejemplo · no hay transmisión real</p>
    </div>
  </div>;
}