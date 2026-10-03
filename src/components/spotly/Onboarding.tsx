import { useState } from "react";
import { Bell, Camera, Check, ChevronLeft, MapPin, Mic, Search, Music, Utensils, PartyPopper, Trophy, Palette, Heart, Store, User, Users, Plane, Landmark, Trees, Cpu, PawPrint, Clapperboard, Disc3, MessageSquare, Antenna, Gamepad2, Flower2, Image as ImageIcon, Sprout, Crosshair, X } from "lucide-react";
import { toast } from "sonner";
import sevilleNight from "@/assets/seville-night.jpg";
import valenciaSunset from "@/assets/valencia-sunset.jpg";
import { searchPlaces, provinceOfPlace } from "@/lib/geo";
import { Button } from "@/components/ui/button";
import { Logo } from "./Logo";
import { BottomSheet } from "./kit";
import { PlaceBrowser } from "./Places";

const interests = [["Música", Music], ["Deportes", Trophy], ["Gastronomía", Utensils], ["Viajes", Plane], ["Cultura", Landmark], ["Naturaleza", Trees], ["Arte", Palette], ["Fiestas", PartyPopper], ["Tecnología", Cpu], ["Mascotas", PawPrint], ["Cine", Clapperboard], ["Planes", Heart]] as const;
/* Lámina 2: 3×3 de losetas de neón; forma (círculo / cuadrado redondeado) y color alternos. */
const introTiles = [
  [Disc3, "#7c5cff", true], [Mic, "#ff3fa8", false], [MessageSquare, "#d63cff", false],
  [Antenna, "#19d3ff", true], [MapPin, "#1ea7ff", false], [Gamepad2, "#ff4fd8", false],
  [Flower2, "#ff9a2e", true], [ImageIcon, "#8b5cff", false], [Sprout, "#22e28a", true],
] as const;
const perms = [["Micrófono", "Para crear y responder Spots con tu voz", Mic], ["Cámara", "Para añadir foto o vídeo a tus Spots", Camera], ["Notificaciones", "Para enterarte de respuestas y directos", Bell]] as const;
const cities = ["Sevilla", "Valencia", "Madrid", "Barcelona", "Málaga", "Carmona", "Cullera"];
const cityImg: Record<string, string> = { Sevilla: sevilleNight, Valencia: valenciaSunset };
const TOTAL = 7;

function NeonTile({ Icon, color, round, delay, size = 90, on = true }: { Icon: typeof Mic; color: string; round: boolean; delay: number; size?: number; on?: boolean }) {
  return (
    <span aria-hidden="true" className={`spot-rise relative grid place-items-center transition-all duration-300 ${round ? "rounded-full" : "rounded-[26px]"}`}
      style={{ width: size, height: size, animationDelay: `${delay}ms`, border: `1.5px solid ${color}${on ? "cc" : "55"}`, background: `radial-gradient(circle at 50% 35%, ${color}${on ? "44" : "1a"}, color-mix(in oklab, ${color} ${on ? 14 : 6}%, var(--background)) 70%)`, boxShadow: on ? `0 0 20px ${color}66, inset 0 0 18px ${color}44` : "none", color: on ? color : `${color}aa` }}>
      <Icon size={Math.round(size * 0.44)} strokeWidth={2} style={{ filter: on ? `drop-shadow(0 0 5px ${color})` : "none" }} />
    </span>
  );
}
const interestColors = ["#7c5cff", "#ff3fa8", "#d63cff", "#19d3ff", "#1ea7ff", "#ff4fd8", "#ff9a2e", "#8b5cff", "#22e28a", "#ffd23f", "#ff6b6b", "#3fe0c5"];

function CityAvatar({ name, size = 40 }: { name: string; size?: number }) {
  const img = cityImg[name];
  return img ? <img src={img} alt="" style={{ width: size, height: size }} className="shrink-0 rounded-full object-cover" /> : <span style={{ width: size, height: size }} className="grid shrink-0 place-items-center rounded-full bg-spot-gradient text-sm font-bold text-primary-foreground">{name.slice(0, 1)}</span>;
}

const modes = [["Personal", "Descubre y comparte lo que pasa", User], ["Creador", "Haz crecer tu audiencia local", Users], ["Negocio", "Ofertas de voz y Panel Local", Store]] as const;

export function Onboarding({ onDone, onBack }: { onDone: () => void; onBack?: (() => void) | undefined }) {
  const [s, setS] = useState(0);
  const [picked, setPicked] = useState<string[]>([]);
  const [ok, setOk] = useState<string[]>([]);
  const [loc, setLoc] = useState<"idle" | "asking" | "granted" | "denied">("idle");
  const [city, setCity] = useState("Sevilla");
  const [cityPick, setCityPick] = useState(false);
  const [q, setQ] = useState("");
  const [mode, setMode] = useState("Personal");
  const [rec, setRec] = useState(false);
  const titles = ["Conecta de forma real", "Activa tu ubicación", "Elige tus intereses", "Tu ciudad", "Permisos", "¿Cómo usarás Spotly?", "Preséntate con tu voz"];
  const can = [true, true, picked.length >= 3, true, ok.includes("Micrófono"), true, rec][s];
  const toggle = (arr: string[], set: (v: string[]) => void, v: string) => set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const next = () => (s < TOTAL - 1 ? setS(s + 1) : onDone());

  /* Ubicación real del navegador; si no hay permiso o API, se sigue sin ella (nunca bloquea). */
  const askLocation = () => {
    if (!("geolocation" in navigator)) { setLoc("denied"); toast("Tu dispositivo no ofrece ubicación. Puedes elegir tu ciudad a mano."); next(); return; }
    setLoc("asking");
    navigator.geolocation.getCurrentPosition(
      () => { setLoc("granted"); toast.success("Ubicación activada"); setS(2); },
      () => { setLoc("denied"); toast("Sin ubicación: elige tu ciudad a mano."); setS(2); },
      { timeout: 8000, maximumAge: 600000 },
    );
  };
  const hits = q.trim().length >= 2 ? searchPlaces(q, 8) : [];
  const shown = cities.includes(city) ? cities : [city, ...cities];

  return (
    <div className="fixed inset-0 z-50 mx-auto flex max-w-[520px] flex-col overflow-hidden bg-background px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,calc(env(safe-area-inset-top)+0.5rem))]">
      {s === 0 ? (
        <div className="flex items-center justify-between">
          <button aria-label="Atrás" onClick={() => onBack?.()} className={onBack ? "" : "invisible"}><ChevronLeft /></button>
        </div>
      ) : (<>
        <div className="flex items-center justify-between">
          <button aria-label="Atrás" onClick={() => setS(s - 1)}><ChevronLeft /></button>
          <Logo compact />
          <button onClick={onDone} className="text-xs text-muted-foreground">Omitir</button>
        </div>
        <div className="mt-4 flex gap-1.5" aria-label={`Paso ${s + 1} de ${TOTAL}`}>{titles.map((_, i) => <span key={i} className={`h-1 flex-1 rounded-full ${i <= s ? "bg-spot-gradient" : "bg-secondary"}`} />)}</div>
      </>)}

      {s === 0 && (
        <div className="flex flex-1 flex-col items-center pt-4 text-center">
          <h1 className="text-[34px] font-semibold leading-[1.12] tracking-tight">Conecta<br />de forma real</h1>
          <p className="mt-4 max-w-[270px] text-[16px] leading-snug text-muted-foreground">Lugares, personas y experiencias cerca de ti.</p>
          <div className="mt-8 grid grid-cols-3 gap-x-4 gap-y-6">{introTiles.map(([I, c, r], i) => <NeonTile key={i} Icon={I} color={c} round={r} delay={i * 70} />)}</div>
        </div>
      )}

      {s === 1 && (
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <div className="relative grid h-56 w-56 place-items-center" aria-hidden="true">
            {[0, 1, 2].map((i) => <span key={i} className="spot-ripple absolute h-24 w-24 rounded-full spot-radar" style={{ animationDelay: `${i * 0.8}s`, animationDuration: "2.4s" }} />)}
            <span className="spot-pin-glow relative grid h-24 w-24 place-items-center rounded-full border-2 border-primary/60 bg-card/70"><MapPin size={44} className="text-primary" /></span>
          </div>
          <h1 className="mt-6 text-[30px] font-semibold leading-tight">Activa tu ubicación</h1>
          <p className="mt-3 max-w-[290px] text-[15px] leading-snug text-muted-foreground">Para ver lo que pasa cerca de ti: Spots, Hot Spots y personas de tu zona. Tu ubicación exacta nunca se muestra a otros.</p>
          {loc === "denied" && <p className="mt-3 text-xs text-live">Sin ubicación. Podrás elegir tu ciudad a mano.</p>}
        </div>
      )}

      {s >= 2 && (
        <>
          <h1 className="mt-6 text-center text-[30px] font-semibold leading-tight tracking-tight">{titles[s]}</h1>
          <div className="mt-4 flex-1 overflow-y-auto">
            {s === 2 && <>
              <p className="mb-5 text-center text-[15px] text-muted-foreground">Elige al menos 3 para tu Inicio <span className={picked.length >= 3 ? "font-semibold text-emerald-400" : "font-semibold text-primary"}>({picked.length}/3)</span></p>
              <div className="grid grid-cols-3 gap-x-3 gap-y-5">{interests.map(([n, I], i) => { const on = picked.includes(n); const c = interestColors[i % interestColors.length] ?? "#7c5cff"; return (
                <button key={n} aria-pressed={on} onClick={() => toggle(picked, setPicked, n)} className="flex flex-col items-center gap-2 active:scale-95">
                  <span className="relative"><NeonTile Icon={I} color={c} round={i % 3 === 0} delay={i * 40} size={76} on={on} />{on && <span className="absolute -right-1 -top-1 grid h-6 w-6 place-items-center rounded-full bg-emerald-400 text-background shadow-[0_0_10px_#22e28a]"><Check size={14} strokeWidth={3} /></span>}</span>
                  <span className={`text-[13px] font-medium ${on ? "text-foreground" : "text-foreground/70"}`}>{n}</span>
                </button>); })}</div>
            </>}

            {s === 3 && <>
              <label className="flex h-12 items-center gap-2 rounded-full border border-border bg-card px-4"><Search size={18} className="text-muted-foreground" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar ciudad…" aria-label="Buscar ciudad o pueblo" className="min-w-0 flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground" />{q && <button aria-label="Borrar búsqueda" onClick={() => setQ("")}><X size={16} /></button>}</label>
              <button onClick={() => { if (loc === "granted") { setCity("Sevilla"); toast.success("Ciudad detectada (DEMO): Sevilla"); } else { askLocation(); } }} className="mt-3 flex w-full items-center gap-3 rounded-2xl border border-primary/50 bg-primary/5 p-3 text-left text-sm font-semibold text-primary"><Crosshair size={18} />Usar mi ubicación actual<span className="ml-auto text-[10px] font-normal text-muted-foreground">{loc === "granted" ? "Activada" : "Permitir"}</span></button>
              <div className="mt-3 space-y-2">
                {(q.trim().length >= 2 ? hits.map((h) => h.name) : shown).map((c) => <button key={c} onClick={() => { setCity(c); setQ(""); }} className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left text-sm ${city === c ? "border-primary bg-primary/10 font-semibold" : "border-border bg-card"}`}><CityAvatar name={c} /><span className="min-w-0 flex-1"><span className="block truncate">{c}</span><span className="block truncate text-[11px] font-normal text-muted-foreground">{provinceOfPlace(c)?.n ?? "España"}</span></span>{city === c && <Check size={16} className="text-primary" />}</button>)}
                {q.trim().length >= 2 && hits.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">No encontramos «{q}». Prueba con otro nombre.</p>}
                <button onClick={() => setCityPick(true)} className="flex w-full items-center justify-between rounded-2xl border border-dashed border-primary/60 p-3.5 text-sm font-semibold text-primary">Explorar por provincias (8.131 municipios)<Search size={16} /></button>
              </div>
              {cityPick && <BottomSheet title="Tu ciudad o pueblo" onClose={() => setCityPick(false)} z={80}><PlaceBrowser allowProvince={false} selected={city} onPick={(n) => { setCity(n); setCityPick(false); }} /></BottomSheet>}
            </>}

            {s === 4 && <div className="space-y-3">{perms.map(([n, d, I]) => { const on = ok.includes(n); return <div key={n} className="flex items-center gap-3 rounded-xl border border-border bg-card p-4"><span className="grid h-11 w-11 place-items-center rounded-full bg-spot-gradient text-primary-foreground"><I size={20} /></span><span className="flex-1"><strong className="block text-sm">{n}{n === "Micrófono" && <span className="ml-1 text-[10px] text-live">necesario</span>}</strong><span className="text-xs text-muted-foreground">{d}</span></span><Button size="sm" variant={on ? "secondary" : "default"} onClick={() => !on && setOk([...ok, n])}>{on ? <Check size={14} /> : "Permitir"}</Button></div>; })}</div>}

            {s === 5 && <div className="space-y-3">{modes.map(([n, d, I]) => <button key={n} onClick={() => setMode(n)} className={`flex w-full items-center gap-4 rounded-xl border p-5 text-left ${mode === n ? "border-primary bg-primary/10 shadow-glow" : "border-border bg-card"}`}><I size={24} className="text-primary" /><span><strong className="block">{n}</strong><span className="text-xs text-muted-foreground">{d}</span></span></button>)}</div>}

            {s === 6 && <div className="grid place-items-center pt-6 text-center"><p className="mb-8 text-sm text-muted-foreground">Graba unos segundos: tu nombre y qué te gusta de {city}</p><button aria-label="Grabar presentación" onClick={() => setRec(true)} className={`grid h-28 w-28 place-items-center rounded-full bg-spot-gradient text-primary-foreground shadow-glow ${rec ? "" : "spot-pulse"}`}><Mic size={44} /></button><p className="mt-6 text-sm font-semibold">{rec ? "¡Presentación grabada! 0:08" : "Toca para grabar"}</p></div>}
          </div>
        </>
      )}

      {s === 1 ? (
        <div className="mt-4 space-y-2">
          <Button size="lg" className="w-full rounded-full bg-spot-gradient text-white" disabled={loc === "asking"} onClick={askLocation}>{loc === "asking" ? "Esperando permiso…" : "Permitir ubicación"}</Button>
          <button onClick={() => { setLoc("denied"); setS(2); }} className="w-full py-2 text-[15px] font-medium text-foreground/80">Ahora no</button>
        </div>
      ) : s === 2 ? (
        <div className="mt-4 space-y-2">
          <Button size="lg" className="w-full rounded-full bg-spot-gradient text-white" disabled={!can} onClick={next}>Siguiente</Button>
          <button onClick={() => setS(3)} className="w-full py-2 text-[15px] font-medium text-foreground/80">Más adelante</button>
        </div>
      ) : s === 0 ? (
        <div className="mt-4 space-y-2">
          <Button size="lg" className="w-full rounded-full bg-spot-gradient text-white" onClick={next}>Siguiente</Button>
          <button onClick={onDone} className="w-full py-2 text-[15px] font-medium text-foreground/80">Omitir</button>
        </div>
      ) : (
        <Button size="lg" className="mt-4 w-full rounded-full bg-spot-gradient text-white" disabled={!can} onClick={next}>{s < TOTAL - 1 ? "Continuar" : "Entrar en Spotly"}</Button>
      )}
    </div>
  );
}
