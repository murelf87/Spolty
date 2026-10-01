import { useState } from "react";
import { Bell, Camera, Check, ChevronLeft, MapPin, Mic, Music, Utensils, PartyPopper, Trophy, Palette, Briefcase, Heart, Store, User, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "./Logo";

const interests = [["Música", Music], ["Comida", Utensils], ["Fiesta", PartyPopper], ["Deporte", Trophy], ["Arte", Palette], ["Trabajo", Briefcase], ["Planes", Heart], ["Comercio", Store]] as const;
const perms = [["Micrófono", "Para crear y responder Spots con tu voz", Mic], ["Ubicación", "Para ver lo que pasa cerca de ti", MapPin], ["Cámara", "Para añadir foto o vídeo a tus Spots", Camera], ["Notificaciones", "Para enterarte de respuestas y directos", Bell]] as const;
const cities = ["Sevilla", "Valencia", "Madrid", "Barcelona", "Málaga", "Carmona", "Cullera"];
const modes = [["Personal", "Descubre y comparte lo que pasa", User], ["Creador", "Haz crecer tu audiencia local", Users], ["Negocio", "Ofertas de voz y Panel Local", Store]] as const;

export function Onboarding({ onDone }: { onDone: () => void }) {
  const [s, setS] = useState(0);
  const [picked, setPicked] = useState<string[]>([]);
  const [ok, setOk] = useState<string[]>([]);
  const [city, setCity] = useState("Sevilla");
  const [mode, setMode] = useState("Personal");
  const [rec, setRec] = useState(false);
  const titles = ["¿Qué te interesa?", "Permisos", "Tu ciudad", "¿Cómo usarás Spotly?", "Preséntate con tu voz"];
  const can = [picked.length >= 3, ok.includes("Micrófono") && ok.includes("Ubicación"), true, true, rec][s];
  const toggle = (arr: string[], set: (v: string[]) => void, v: string) => set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  return (
    <div className="fixed inset-0 z-50 mx-auto flex max-w-[520px] flex-col bg-background px-5 pb-6 pt-5">
      <div className="flex items-center justify-between">
        <button aria-label="Atrás" onClick={() => s && setS(s - 1)} className={s ? "" : "invisible"}><ChevronLeft /></button>
        <Logo compact />
        <button onClick={onDone} className="text-xs text-muted-foreground">Saltar</button>
      </div>
      <div className="mt-4 flex gap-1.5">{titles.map((_, i) => <span key={i} className={`h-1 flex-1 rounded-full ${i <= s ? "bg-spot-gradient" : "bg-secondary"}`} />)}</div>
      <h1 className="mt-6 text-2xl font-bold">{titles[s]}</h1>
      <div className="mt-5 flex-1 overflow-y-auto">
        {s === 0 && <><p className="mb-4 text-sm text-muted-foreground">Elige al menos 3 para personalizar tu Inicio</p><div className="grid grid-cols-2 gap-3">{interests.map(([n, I]) => { const on = picked.includes(n); return <button key={n} onClick={() => toggle(picked, setPicked, n)} className={`flex items-center gap-3 rounded-xl border p-4 text-sm font-semibold ${on ? "border-primary bg-primary/10 text-primary shadow-glow" : "border-border bg-card"}`}><I size={20} />{n}{on && <Check size={16} className="ml-auto" />}</button>; })}</div></>}
        {s === 1 && <div className="space-y-3">{perms.map(([n, d, I]) => { const on = ok.includes(n); return <div key={n} className="flex items-center gap-3 rounded-xl border border-border bg-card p-4"><span className="grid h-11 w-11 place-items-center rounded-full bg-spot-gradient text-primary-foreground"><I size={20} /></span><span className="flex-1"><strong className="block text-sm">{n}{(n === "Micrófono" || n === "Ubicación") && <span className="ml-1 text-[10px] text-live">necesario</span>}</strong><span className="text-xs text-muted-foreground">{d}</span></span><Button size="sm" variant={on ? "secondary" : "default"} onClick={() => !on && setOk([...ok, n])}>{on ? <Check size={14} /> : "Permitir"}</Button></div>; })}</div>}
        {s === 2 && <><p className="mb-4 flex items-center gap-2 text-sm text-primary"><MapPin size={16} /> Detectada: Sevilla</p><div className="space-y-2">{cities.map((c) => <button key={c} onClick={() => setCity(c)} className={`flex w-full items-center justify-between rounded-xl border p-4 text-sm ${city === c ? "border-primary bg-primary/10 font-semibold" : "border-border bg-card"}`}>{c}{city === c && <Check size={16} className="text-primary" />}</button>)}</div></>}
        {s === 3 && <div className="space-y-3">{modes.map(([n, d, I]) => <button key={n} onClick={() => setMode(n)} className={`flex w-full items-center gap-4 rounded-xl border p-5 text-left ${mode === n ? "border-primary bg-primary/10 shadow-glow" : "border-border bg-card"}`}><I size={24} className="text-primary" /><span><strong className="block">{n}</strong><span className="text-xs text-muted-foreground">{d}</span></span></button>)}</div>}
        {s === 4 && <div className="grid place-items-center pt-6 text-center"><p className="mb-8 text-sm text-muted-foreground">Graba unos segundos: tu nombre y qué te gusta de {city}</p><button aria-label="Grabar presentación" onClick={() => setRec(true)} className={`grid h-28 w-28 place-items-center rounded-full bg-spot-gradient text-primary-foreground shadow-glow ${rec ? "" : "spot-pulse"}`}><Mic size={44} /></button><p className="mt-6 text-sm font-semibold">{rec ? "¡Presentación grabada! 0:08" : "Toca para grabar"}</p></div>}
      </div>
      <Button size="lg" className="mt-4 w-full bg-spot-gradient text-primary-foreground" disabled={!can} onClick={() => (s < 4 ? setS(s + 1) : onDone())}>{s < 4 ? "Continuar" : "Entrar en Spotly"}</Button>
    </div>
  );
}
