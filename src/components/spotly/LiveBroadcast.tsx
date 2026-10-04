import { useEffect, useState } from "react";
import { Camera, CameraOff, Check, ChevronLeft, Eye, Flashlight, Hand, MapPin, Mic, MicOff, Radio, RefreshCw, Settings2, Share2, Shield, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import sevilleEvening from "@/assets/spotly-sevilla-noche-ref.jpg";
import { TopBar } from "./kit";

type Stage = "prepare" | "live" | "confirm" | "ended";
type Audience = "Todos" | "Cerca" | "Seguidores";
type Panel = "audience" | "requests" | "people" | "settings" | "share" | null;
const topics = ["¿Qué pasa cerca?", "Música y cultura", "Plan improvisado", "Opiniones en voz"];
const places = ["Sevilla · Triana", "Sevilla · Centro", "Ubicación oculta"];

export function LiveBroadcast({ onClose }: { onClose: () => void }) {
  const [stage, setStage] = useState<Stage>("prepare");
  const [audience, setAudience] = useState<Audience>("Todos");
  const [camera, setCamera] = useState(false);
  const [mic, setMic] = useState(true);
  const [front, setFront] = useState(false);
  const [flash, setFlash] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [panel, setPanel] = useState<Panel>(null);
  const [topic, setTopic] = useState(topics[0]);
  const [place, setPlace] = useState(places[0]);
  const [participation, setParticipation] = useState(true);
  const [reactions, setReactions] = useState(true);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (stage !== "live" || paused) return;
    const timer = window.setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [stage, paused]);

  const duration = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  const selectButton = (label: string, selected: boolean, onClick: () => void) => <Button key={label} variant="secondary" onClick={onClick} className={`h-10 min-w-0 rounded-full px-3 text-xs ${selected ? "spot-active-pill text-foreground" : "text-foreground"}`}>{label}</Button>;
  const switchRow = (label: string, description: string, checked: boolean, onClick: () => void, Icon: typeof Mic) => <Button variant="secondary" onClick={onClick} aria-pressed={checked} className="flex h-auto w-full items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-3 text-left"><Icon size={19} className="shrink-0 text-primary"/><span className="min-w-0 flex-1"><strong className="block text-sm">{label}</strong><small className="block whitespace-normal font-normal text-muted-foreground">{description}</small></span><span className={`relative h-6 w-11 shrink-0 rounded-full ${checked ? "bg-primary" : "bg-muted"}`}><span className={`absolute top-0.5 h-5 w-5 rounded-full bg-foreground transition-all ${checked ? "left-[1.375rem]" : "left-0.5"}`}/></span></Button>;

  if (stage === "ended") return <div className="fixed inset-0 z-[70] flex flex-col items-center bg-background px-6 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(6rem,calc(env(safe-area-inset-top)+3rem))] text-center text-foreground">
    <div className="grid h-24 w-24 place-items-center rounded-full bg-spot-gradient shadow-glow"><Check size={42}/></div>
    <h2 className="mt-7 text-2xl font-bold">Directo finalizado</h2><p className="mt-2 text-sm text-muted-foreground">{topic} · {duration}</p>
    <div className="mt-8 w-full max-w-sm divide-y divide-border border-y border-border text-sm"><div className="flex justify-between py-4"><span className="flex items-center gap-2"><Eye size={18} className="text-primary"/> Espectadores</span><strong>0</strong></div><div className="flex justify-between py-4"><span className="flex items-center gap-2"><Hand size={18} className="text-primary"/> Participantes de voz</span><strong>0</strong></div></div>
    <p className="mt-4 text-xs text-muted-foreground">Vista de ejemplo · no se ha emitido ni guardado audio o vídeo.</p>
    <Button className="mt-auto w-full max-w-sm bg-spot-gradient" onClick={onClose}>Volver a Inicio</Button>
  </div>;

  if (stage === "prepare") return <div className="fixed inset-0 z-[70] flex flex-col bg-background text-foreground">
    <TopBar title={<span className="flex items-center gap-2"><Radio size={18} className="shrink-0 text-live"/>Preparar directo</span>} onBack={onClose} />
    <main className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
      <div className="relative mt-4 h-36 overflow-hidden rounded-lg border border-border bg-spot-surface">{camera ? <img src={sevilleEvening} alt="Imagen de ejemplo, no cámara real" className="h-full w-full object-cover"/> : <div className="flex h-full items-center justify-center gap-4"><Mic className="text-primary" size={38}/><div><strong className="block">Directo de voz</strong><small className="text-muted-foreground">Tu voz es la protagonista</small></div></div>}<span className="absolute bottom-2 right-2 rounded bg-background/85 px-2 py-1 text-3xs">VISTA DE EJEMPLO</span></div>
      <h3 className="mt-5 text-lg font-bold">¿De qué vais a hablar?</h3><p className="mt-1 text-xs text-muted-foreground">Elige un tema para que te descubran.</p>
      <div className="mt-3 flex flex-wrap gap-2">{topics.map((value) => selectButton(value, topic === value, () => setTopic(value)))}</div>
      <h3 className="mt-6 text-sm font-bold">Formato</h3><div className="mt-2 grid grid-cols-2 gap-2">{selectButton("Solo voz", !camera, () => setCamera(false))}{selectButton("Voz + cámara", camera, () => setCamera(true))}</div>
      <h3 className="mt-6 text-sm font-bold">¿Quién puede escucharte?</h3><div className="mt-2 grid grid-cols-3 gap-2">{(["Todos", "Cerca", "Seguidores"] as const).map((value) => selectButton(value, audience === value, () => setAudience(value)))}</div>
      <h3 className="mt-6 text-sm font-bold">Zona visible</h3><div className="mt-2 flex flex-wrap gap-2">{places.map((value) => selectButton(value, place === value, () => setPlace(value)))}</div>
      <div className="mt-6 space-y-2">{switchRow("Pedir la palabra", "Escuchas las solicitudes antes de dejar hablar", participation, () => setParticipation(!participation), Hand)}{switchRow("Reacciones", "Permitir reacciones durante el directo", reactions, () => setReactions(!reactions), Shield)}</div>
      <p className="mt-4 text-xs text-muted-foreground">No se conectan micrófono, cámara ni espectadores reales en esta demostración.</p>
    </main>
    <footer className="shrink-0 border-t border-border bg-background px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3"><Button className="w-full bg-spot-gradient" onClick={() => { setSeconds(0); setStage("live"); }}>Iniciar directo de ejemplo</Button></footer>
  </div>;

  return <div className="fixed inset-0 z-[70] flex flex-col overflow-hidden bg-background text-foreground">
    <div className="relative min-h-0 flex-1 overflow-hidden">{camera ? <img src={sevilleEvening} alt="Imagen de ejemplo, no cámara real" className="absolute inset-0 h-full w-full object-cover"/> : <div className="absolute inset-0 flex flex-col items-center justify-center bg-spot-surface"><div className="spot-pulse grid h-28 w-28 place-items-center rounded-full border border-primary bg-primary/15"><Mic className="text-primary" size={48}/></div><p className="mt-6 text-lg font-bold">{topic}</p><p className="mt-1 text-sm text-muted-foreground">Directo de voz · {place}</p></div>}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-background/80 via-transparent to-background/95"/>
      <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 px-4 pt-[var(--safe-header)]"><Button variant="icon" size="icon" aria-label="Volver" onClick={() => setStage("confirm")} className="bg-background/70"><ChevronLeft size={21}/></Button><div className="min-w-0 text-center"><p className="flex items-center justify-center gap-1.5 text-sm font-bold"><Radio size={16} className="text-live"/> {paused ? "EN PAUSA" : "EN DIRECTO"}</p><p className="mt-1 text-2xs text-foreground/80">Vista de ejemplo · sin emisión real</p></div><Button variant="outline" size="sm" onClick={() => setStage("confirm")} className="h-10 bg-background/70 px-3">Finalizar</Button></div>
      <div className="absolute inset-x-4 bottom-4"><div className="mb-4 flex items-center gap-2 text-xs"><span className="rounded bg-live px-2 py-1 font-bold">● {paused ? "PAUSA" : "EN DIRECTO"}</span><span className="rounded bg-background/75 px-2 py-1">{duration}</span><span className="ml-auto flex items-center gap-1 rounded bg-background/75 px-2 py-1"><Eye size={13}/> 0</span></div><div className="flex items-center gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-primary bg-spot-gradient font-bold">T</span><div className="min-w-0"><p className="truncate text-sm font-bold">Tú · {topic}</p><p className="flex items-center gap-1 text-xs text-foreground/80"><MapPin size={12}/> {place} · {audience}</p></div></div><p className="mt-3 text-xs text-foreground/80">{mic ? "Micrófono activo" : "Micrófono silenciado"} · {camera ? front ? "Cámara frontal" : "Cámara trasera" : "Solo voz"}</p></div>
    </div>
    <div className="shrink-0 border-t border-border bg-background px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3"><div className="flex justify-between gap-1">{[
      [mic ? Mic : MicOff, mic ? "Silenciar micrófono" : "Activar micrófono", () => setMic(!mic), !mic],
      [camera ? Camera : CameraOff, camera ? "Apagar cámara" : "Encender cámara", () => setCamera(!camera), false],
      [RefreshCw, "Cambiar cámara", () => setFront(!front), front],
      [Flashlight, "Flash", () => setFlash(!flash), flash],
      [Share2, "Compartir directo", () => setPanel("share"), false],
    ].map(([Icon, label, action, active]) => { const I = Icon as typeof Mic; return <Button key={label as string} variant="icon" size="icon" aria-label={label as string} title={label as string} disabled={(label === "Cambiar cámara" && !camera) || (label === "Flash" && (!camera || front))} onClick={action as () => void} className={active ? "border-primary text-primary" : ""}><I size={19}/></Button>; })}</div>
      <div className="mt-3 grid grid-cols-3 gap-2">{[[Hand, "Solicitudes", "requests"], [Users, "Personas", "people"], [Settings2, "Opciones", "settings"]].map(([Icon, label, value]) => { const I = Icon as typeof Hand; return <Button key={value as string} variant="secondary" className="h-10 min-w-0 gap-1 px-1 text-xs" onClick={() => setPanel(value as Panel)}><I size={15}/>{label as string}</Button>; })}</div>
      <p className="mt-2 text-center text-2xs text-muted-foreground">0 oyentes · 0 solicitudes · sin transmisión real</p>
    </div>
    {panel && <div className="absolute inset-0 z-10 flex items-end bg-background/75" onClick={() => setPanel(null)}><div className="w-full rounded-t-lg border-t border-border bg-card p-5 pb-[max(2rem,env(safe-area-inset-bottom))]" onClick={(event) => event.stopPropagation()}><div className="flex items-center justify-between"><h3 className="font-bold">{{ audience: "Público del directo", requests: "Solicitudes de voz", people: "Personas en la sala", settings: "Opciones del directo", share: "Compartir directo" }[panel]}</h3><Button variant="ghost" size="icon" aria-label="Cerrar" onClick={() => setPanel(null)}><X size={19}/></Button></div>
      {panel === "requests" && <div className="py-8 text-center"><Hand className="mx-auto text-primary" size={32}/><p className="mt-3 text-sm font-semibold">Nadie ha pedido la palabra</p><p className="mt-1 text-xs text-muted-foreground">{participation ? "Aquí aparecerían las solicitudes para aceptar o rechazar." : "Activa «Pedir la palabra» en Opciones para permitirlas."}</p></div>}
      {panel === "people" && <div className="py-8 text-center"><Users className="mx-auto text-primary" size={32}/><p className="mt-3 text-sm font-semibold">Todavía no hay oyentes</p><p className="mt-1 text-xs text-muted-foreground">En esta vista de ejemplo no se conectan personas reales.</p></div>}
      {panel === "share" && <p className="mt-4 text-sm text-muted-foreground">Este directo de ejemplo no tiene enlace público. Compartirlo estará disponible cuando se habiliten los directos reales.</p>}
      {panel === "settings" && <div className="mt-4 space-y-2">{switchRow("Pedir la palabra", "Permitir solicitudes de voz", participation, () => setParticipation(!participation), Hand)}{switchRow("Reacciones", "Permitir reacciones", reactions, () => setReactions(!reactions), Shield)}{switchRow("Pausar la sala", "Detener el contador de esta vista", paused, () => setPaused(!paused), Radio)}<Button variant="secondary" className="w-full justify-between" onClick={() => setPanel("audience")}>Público · {audience}<Users size={17}/></Button></div>}
      {panel === "audience" && <div className="mt-4 space-y-2">{(["Todos", "Cerca", "Seguidores"] as const).map((choice) => <Button key={choice} variant="secondary" className="w-full justify-between" onClick={() => { setAudience(choice); setPanel(null); }}>{choice}{audience === choice && <Check size={17} className="text-primary"/>}</Button>)}</div>}
    </div></div>}
    {stage === "confirm" && <div className="absolute inset-0 z-20 flex items-end bg-background/80" onClick={() => setStage("live")}><div className="w-full rounded-t-lg border-t border-border bg-card p-5 pb-[max(2rem,env(safe-area-inset-bottom))]" onClick={(event) => event.stopPropagation()}><h3 className="text-lg font-bold">¿Finalizar el directo?</h3><p className="mt-2 text-sm text-muted-foreground">La vista de ejemplo dejará de mostrarse. No se ha grabado ni transmitido nada.</p><Button className="mt-5 w-full bg-live bg-none text-foreground" onClick={() => setStage("ended")}>Finalizar directo</Button><Button variant="secondary" className="mt-2 w-full" onClick={() => setStage("live")}>Seguir en directo</Button></div></div>}
  </div>;
}
