import { useState } from "react";
import { Headphones, MapPin, Mic, MicOff, Radio, Search, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TopBar } from "./kit";
import portraits from "@/assets/audio-wall-portraits.jpg";

type Filter = "En directo" | "Cerca" | "Tendencias";

const rooms: Record<Filter, { title: string; area: string; listeners: number; image: number }> = {
  "En directo": { title: "Sevilla centro · En directo", area: "Sevilla centro", listeners: 248, image: 2 },
  Cerca: { title: "Voces de Triana · En directo", area: "A 1,2 km", listeners: 86, image: 0 },
  Tendencias: { title: "La noche en Sevilla · En directo", area: "Sevilla", listeners: 1234, image: 3 },
};

const speakers = ["Álex", "Noa", "Dani", "Sam"];

function Portrait({ person, className = "", onClick, selected = false }: { person: number; className?: string; onClick?: () => void; selected?: boolean }) {
  const img = <img src={portraits} alt="" width={1024} height={1024} className={`audio-wall-crop audio-wall-crop-${person}`} />;
  if (!onClick) return <span className={`audio-wall-portrait ${className}`}>{img}</span>;
  return <button type="button" onClick={onClick} aria-pressed={selected} aria-label={`Escuchar a ${speakers[person]}`} className={`audio-wall-portrait ${className} ${selected ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""}`}>{img}</button>;
}

export function AudioWallLive({ onBack }: { onBack: () => void }) {
  const [filter, setFilter] = useState<Filter>("En directo");
  const [joined, setJoined] = useState(false);
  const [muted, setMuted] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [speaker, setSpeaker] = useState<number | null>(null);
  const base = rooms[filter];
  const room = speaker === null ? base : { ...base, title: `${speakers[speaker]} está hablando · En directo`, listeners: 40 + speaker * 23, image: speaker };
  const pick = (p: number) => { setSpeaker(speaker === p ? null : p); setJoined(false); };
  const visible = !query || `${room.title} ${room.area}`.toLocaleLowerCase("es").includes(query.toLocaleLowerCase("es"));

  return <div className="fixed inset-0 z-50 mx-auto flex w-full max-w-[520px] flex-col bg-background text-foreground">
    <TopBar title="Audio Wall" sub="En directo · salas de voz cerca de ti" onBack={() => joined ? setJoined(false) : onBack()} backLabel={joined ? "Salir de la sala" : "Volver"} right={<Button variant="ghost" size="icon" className="text-foreground" aria-label="Buscar salas de voz" aria-pressed={searchOpen} onClick={() => setSearchOpen(!searchOpen)}><Search size={20} /></Button>} />
    <main className="flex flex-1 flex-col overflow-y-auto px-3 pb-[max(1rem,calc(env(safe-area-inset-bottom)+0.5rem))] pt-3">
    <div className="audio-wall-frame flex flex-col rounded-[1.5rem] p-3">
      {searchOpen && <div className="mb-3 flex items-center gap-2 rounded-lg border border-border bg-card px-3"><Search size={16} className="text-muted-foreground" /><input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar salas" aria-label="Buscar salas" className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" /><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setQuery(""); setSearchOpen(false); }} aria-label="Cerrar búsqueda"><X size={16} /></Button></div>}
      <div className="grid shrink-0 grid-cols-3 gap-1.5" role="tablist" aria-label="Filtrar salas">
        {(["En directo", "Cerca", "Tendencias"] as const).map(name => <Button key={name} role="tab" aria-selected={filter === name} variant="secondary" className={`h-9 min-w-0 rounded-full border px-1 text-xs ${filter === name ? "spot-active-pill border-primary text-foreground" : "border-border bg-card/80 text-foreground/85"}`} onClick={() => { setFilter(name); setJoined(false); setSpeaker(null); }}>{name}</Button>)}
      </div>
      {visible ? <>
        <div className="audio-wall-stage relative mx-auto mt-3 min-h-[16.25rem] w-full max-w-[23.125rem] flex-1" aria-label="Personas en el Audio Wall">
          <span className="audio-wall-link audio-wall-link-a" /><span className="audio-wall-link audio-wall-link-b" /><span className="audio-wall-link audio-wall-link-c" /><span className="audio-wall-link audio-wall-link-d" />
          <Portrait person={0} className="audio-wall-person audio-wall-p1" onClick={() => pick(0)} selected={speaker === 0} /><Portrait person={1} className="audio-wall-person audio-wall-p2" onClick={() => pick(1)} selected={speaker === 1} />
          <Portrait person={2} className="audio-wall-person audio-wall-p3" onClick={() => pick(2)} selected={speaker === 2} /><Portrait person={3} className="audio-wall-person audio-wall-p4" onClick={() => pick(3)} selected={speaker === 3} /><Portrait person={0} className="audio-wall-person audio-wall-p5" onClick={() => pick(0)} selected={speaker === 0} />
          <span className="audio-wall-note audio-wall-note-a"><Headphones size={17} /></span><span className="audio-wall-note audio-wall-note-b"><Headphones size={17} /></span>
          <span className="audio-wall-note audio-wall-note-c"><Headphones size={18} /></span>
          <span className="audio-wall-center" aria-hidden="true"><Mic size={39} /></span>
        </div>
        <div className="audio-wall-room mt-2 flex shrink-0 items-center gap-3 rounded-2xl border border-primary/50 p-2.5">
          <Portrait person={room.image} className="h-[5.5rem] w-[4.75rem] shrink-0 rounded-xl border-0" onClick={() => setJoined(true)} selected={joined} />
          <div className="min-w-0 flex-1"><p className="flex items-center gap-1.5 text-xs font-semibold"><Users size={14} className="text-primary" />{room.listeners.toLocaleString("es-ES")} escuchando</p><p className="mt-0.5 truncate text-xs text-muted-foreground">{room.title}</p>
            <Button onClick={() => setJoined(!joined)} className="mt-2 h-9 w-full rounded-full bg-spot-gradient font-bold text-foreground">{joined ? "Salir de la sala" : "Unirte"}</Button>
          </div>
        </div>
        {joined && <div className="mt-2 flex shrink-0 items-center justify-between gap-2 rounded-xl border border-border bg-card px-3 py-2"><div className="min-w-0"><p className="flex items-center gap-1 text-xs font-semibold"><Radio size={13} className="text-live" /> Escuchando · ejemplo</p><p className="flex items-center gap-1 truncate text-2xs text-muted-foreground"><MapPin size={11} />{room.area} · No hay audio en directo</p></div><Button variant="secondary" size="icon" aria-label={muted ? "Solicitar turno de voz" : "Cancelar solicitud de voz"} onClick={() => setMuted(!muted)} className="h-10 w-10 shrink-0 rounded-full">{muted ? <MicOff size={19} /> : <Mic size={19} className="text-primary" />}</Button></div>}
      </> : <div className="grid flex-1 place-items-center text-center text-sm text-muted-foreground">No hay salas de ejemplo con ese nombre.</div>}
      <p className="mt-2 text-center text-3xs text-muted-foreground">Salas y oyentes de ejemplo · no hay transmisión real</p>
    </div>
    </main>
  </div>;
}