import { useState } from "react";
import { ChevronLeft, Heart, MapPin, Mic, Pause, Play, Share2, UserPlus, Check } from "lucide-react";
import { toast } from "sonner";
import { NewFollowers } from "./LocalAd";
import { Button } from "@/components/ui/button";
import festival from "@/assets/spotly-sevilla-festival.jpg";
import stage from "@/assets/spotly-live-stage.jpg";
import beach from "@/assets/spotly-beach-club.jpg";

const bars = [6, 12, 18, 9, 15, 20, 8, 14, 17, 7, 13, 19, 10, 6];
function Bars({ on }: { on: boolean }) {
  return <div className="flex h-6 flex-1 items-center gap-[3px]">{bars.map((h, i) => <span key={i} className={on ? "bg-primary" : "bg-muted-foreground"} style={{ height: h, width: 3, borderRadius: 3 }} />)}</div>;
}

function VoiceRow({ id, name, img, dur, ago, play, setPlay }: { id: string; name: string; img: string; dur: string; ago: string; play: string | null; setPlay: (v: string | null) => void }) {
  const on = play === id;
  return <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
    <img src={img} alt="" className="h-10 w-10 rounded-full object-cover" />
    <div className="min-w-0 flex-1"><p className="text-sm font-semibold">{name} <small className="font-normal text-muted-foreground">· {ago}</small></p>
      <div className="mt-1 flex items-center gap-2"><button aria-label={on ? "Pausar respuesta" : "Escuchar respuesta"} onClick={() => setPlay(on ? null : id)} className="grid h-7 w-7 place-items-center rounded-full bg-primary text-primary-foreground">{on ? <Pause size={12} fill="currentColor" /> : <Play size={12} fill="currentColor" />}</button><Bars on={on} /><span className="text-xs text-muted-foreground">{dur}</span></div></div>
  </div>;
}

export type SpotInfo = { name: string; city: string; ago: string; text: string; img: string; dur: string; dist: string };

export function SpotDetail({ s, onClose, onAuthor }: { s: SpotInfo; onClose: () => void; onAuthor: () => void }) {
  const [play, setPlay] = useState<string | null>(null);
  const [rec, setRec] = useState(false);
  const [mine, setMine] = useState(0);
  const [liked, setLiked] = useState(false);
  const replies = [["Laura", beach, "0:12", "3 min"], ["Carlos", stage, "0:08", "10 min"], ["María", festival, "0:21", "25 min"]] as const;
  return <div className="fixed inset-0 z-50 overflow-y-auto bg-background pb-32">
    <div className="relative aspect-[4/5] max-h-[60vh] w-full">
      <img src={s.img} alt={s.text} className="h-full w-full object-cover" />
      <span className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-background/40" />
      <Button variant="icon" size="icon" aria-label="Volver" onClick={onClose} className="absolute left-3 top-3 bg-background/75"><ChevronLeft /></Button>
      <span className="absolute right-3 top-4 flex items-center gap-1 rounded-md bg-background/80 px-2 py-1 text-xs"><MapPin size={12} />{s.dist}</span>
      <button onClick={onAuthor} className="absolute bottom-3 left-3 flex items-center gap-2 text-left" aria-label={"Ver perfil de " + s.name}><img src={beach} alt="" className="h-11 w-11 rounded-full border border-accent object-cover" /><span><strong className="block text-sm">{s.name} <span className="text-accent">✦</span></strong><small className="text-foreground/80">{s.city} · Hace {s.ago}</small></span></button>
    </div>
    <div className="space-y-4 px-4 pt-3">
      <div className="flex items-center gap-2 rounded-full border border-border bg-secondary p-1"><button aria-label={play === "main" ? "Pausar audio" : "Reproducir audio"} onClick={() => setPlay(play === "main" ? null : "main")} className="grid h-9 w-9 place-items-center rounded-full bg-primary text-primary-foreground">{play === "main" ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" />}</button><Bars on={play === "main"} /><span className="pr-3 text-xs">{s.dur}</span></div>
      <p className="font-medium">{s.text}</p>
      <div className="flex gap-5 text-sm"><button onClick={() => setLiked(!liked)} className={"flex items-center gap-1 " + (liked ? "text-accent" : "")}><Heart size={18} fill={liked ? "currentColor" : "none"} />Me gusta</button><button onClick={() => toast("Enlace del Spot copiado")} className="flex items-center gap-1"><Share2 size={18} />Compartir</button></div>
      <h3 className="pt-2 text-sm font-bold">Respuestas de voz · {replies.length + mine}</h3>
      <div className="space-y-2">
        {Array.from({ length: mine }).map((_, i) => <VoiceRow key={"m" + i} id={"m" + i} name="Tú" img={festival} dur="0:06" ago="ahora" play={play} setPlay={setPlay} />)}
        {replies.map(([n, img, d, a]) => <VoiceRow key={n} id={n} name={n} img={img} dur={d} ago={a} play={play} setPlay={setPlay} />)}
      </div>
    </div>
    <div className="fixed inset-x-0 bottom-0 border-t border-border bg-card/95 p-4 text-center backdrop-blur">
      <p className="mb-2 text-xs text-muted-foreground">{rec ? "Grabando… toca para enviar" : "Responde con tu voz"}</p>
      <button aria-label={rec ? "Enviar respuesta de voz" : "Grabar respuesta"} onClick={() => { if (rec) { setMine(mine + 1); toast("Respuesta de voz enviada"); } setRec(!rec); }} className={(rec ? "spot-pulse " : "") + "mx-auto grid h-14 w-14 place-items-center rounded-full bg-spot-gradient shadow-glow"}><Mic size={24} /></button>
    </div>
  </div>;
}

export function AuthorProfile({ name, onClose }: { name: string; onClose: () => void }) {
  const [follow, setFollow] = useState(false);
  const [play, setPlay] = useState(false);
  const [list, setList] = useState(false);
  if (list) return <NewFollowers onClose={() => setList(false)} />;
  return <div className="fixed inset-0 z-[60] overflow-y-auto bg-background pb-10">
    <div className="relative h-40"><img src={stage} alt="" className="h-full w-full object-cover" /><span className="absolute inset-0 bg-gradient-to-t from-background to-transparent" />
      <Button variant="icon" size="icon" aria-label="Volver" onClick={onClose} className="absolute left-3 top-3 bg-background/75"><ChevronLeft /></Button></div>
    <div className="-mt-12 px-4 text-center">
      <img src={beach} alt="" className="relative mx-auto h-24 w-24 rounded-full border-4 border-background object-cover" />
      <h2 className="mt-2 text-xl font-bold">{name} <span className="text-primary">✦</span></h2>
      <p className="text-xs text-muted-foreground">Sevilla · Verificado</p>
      <div className="mt-4 grid grid-cols-3 rounded-2xl border border-border bg-card py-3 text-sm">{[["128", "Spots"], [follow ? "4.822" : "4.821", "Seguidores"], ["312", "Siguiendo"]].map(([a, b]) => <div key={b} onClick={() => b === "Seguidores" && setList(true)} className={b === "Seguidores" ? "cursor-pointer" : ""}><strong className="block">{a}</strong><small className="text-muted-foreground">{b}</small></div>)}</div>
      <div className="mt-4 flex items-center gap-2 rounded-full border border-border bg-secondary p-1 text-left"><button aria-label={play ? "Pausar presentación" : "Escuchar presentación"} onClick={() => setPlay(!play)} className="grid h-9 w-9 place-items-center rounded-full bg-primary text-primary-foreground">{play ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" />}</button><Bars on={play} /><span className="pr-3 text-xs">0:15</span></div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button onClick={() => { setFollow(!follow); toast(follow ? "Has dejado de seguir a " + name : "Ahora sigues a " + name); }} variant={follow ? "secondary" : "default"}>{follow ? <><Check size={16} />Siguiendo</> : <><UserPlus size={16} />Seguir</>}</Button>
        <Button variant="secondary" onClick={() => toast("Nota de voz enviada a " + name)}><Mic size={16} />Mensaje de voz</Button>
      </div>
      <h3 className="mt-6 text-left text-sm font-bold">Sus Spots</h3>
      <div className="mt-2 grid grid-cols-3 gap-1">{[festival, stage, beach, stage, beach, festival].map((p, i) => <img key={i} src={p} alt="" className="aspect-square w-full rounded-md object-cover" />)}</div>
    </div>
  </div>;
}
