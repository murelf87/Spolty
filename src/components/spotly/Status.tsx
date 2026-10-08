import { useEffect, useState } from "react";
import { Bell, Camera, Download, MapPin, Mic, Monitor, Moon, Smartphone, Sun, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Screen, StateCard, Toggle, Trust } from "./kit";
import { setOffline, setPerm, useStore } from "@/lib/store";
import { useInstall } from "@/lib/pwa";

export function LocationOff({ compact }: { compact?: boolean }) {
  if (compact) return <div className="flex items-center gap-3 rounded-xl border border-live/50 bg-live/10 p-3 text-xs"><MapPin size={16} className="shrink-0 text-live" /><span className="flex-1">Ubicación desactivada: no podemos saber si estás cerca.</span><Button size="sm" onClick={() => setPerm("location", true)}>Activar</Button></div>;
  return <StateCard icon={MapPin} tone="live" title="Ubicación desactivada" text="Actívala para ver lo que pasa cerca de ti." action="Activar ubicación" onAction={() => setPerm("location", true)} />;
}

/** Aviso global sin conexión. */
export function OfflineBanner() {
  const { offline } = useStore();
  if (!offline) return null;
  return (
    <div role="alert" className="fixed inset-x-0 top-0 z-[90] mx-auto flex max-w-[520px] items-center gap-2 bg-live px-4 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))] text-xs font-semibold text-foreground">
      <WifiOff size={14} /><span className="flex-1">Sin conexión. Verás lo último que cargó; publicar y pagar no está disponible.</span>
      <button className="rounded-full bg-background/30 px-3 py-1" onClick={() => { setOffline(false); toast.success("Conexión recuperada"); }}>Reintentar</button>
    </div>
  );
}

const isLight = () => typeof document !== "undefined" && document.documentElement.classList.contains("light");
const THEME_KEY = "spotly-tema";
/** Vuelve a poner el tema que elegiste (se guarda en este dispositivo). */
export function restoreTheme() {
  try { const v = localStorage.getItem(THEME_KEY); if (v) document.documentElement.classList.toggle("light", v === "claro"); } catch { /* sin almacenamiento */ }
}
export function useTheme() {
  const [light, setLight] = useState(false);
  useEffect(() => setLight(isLight()), []);
  const set = (l: boolean) => { document.documentElement.classList.toggle("light", l); setLight(l); try { localStorage.setItem(THEME_KEY, l ? "claro" : "oscuro"); } catch { /* sin almacenamiento */ } };
  return { light, set };
}
export function ThemeSwitch() {
  const { light, set } = useTheme();
  return (
    <div className="grid grid-cols-2 gap-2">{([[false, "Oscuro", Moon], [true, "Perla claro", Sun]] as const).map(([v, l, I]) => <button key={l} onClick={() => set(v)} aria-pressed={light === v} className={"flex min-h-12 items-center justify-center gap-2 rounded-xl border text-sm font-semibold " + (light === v ? "spot-active-pill border-transparent" : "border-border bg-card")}><I size={16} />{l}</button>)}</div>
  );
}

export function PermissionsScreen({ onBack }: { onBack: () => void }) {
  const { perms, offline } = useStore();
  const rows = [
    ["mic", Mic, "Micrófono", "Grabar Spots, responder y buscar con la voz"],
    ["location", MapPin, "Ubicación", "Ver lo que pasa cerca y fijar la zona de tus Spots"],
    ["camera", Camera, "Cámara", "Hacer fotos y vídeos para tus Spots y verificarte"],
    ["notifications", Bell, "Notificaciones", "Respuestas de voz, Hot Spots y ofertas cercanas"],
  ] as const;
  return (
    <Screen title="Permisos" sub="Tú decides qué comparte Spotly" onBack={onBack} z={60}>
      <div className="space-y-2">{rows.map(([k, I, t, d]) => <div key={k} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3.5"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-secondary text-primary"><I size={18} /></span><span className="min-w-0 flex-1"><strong className="block text-sm">{t}</strong><small className="text-muted-foreground">{d}</small><small className={"mt-0.5 block text-2xs font-semibold " + (perms[k] ? "text-primary" : "text-live")}>{perms[k] ? "Permitido" : "Denegado"}</small></span><Toggle on={perms[k]} onChange={(v) => { setPerm(k, v); toast(v ? `${t} permitido` : `${t} denegado`); }} label={t} /></div>)}</div>
      <p className="mt-2 text-2xs text-muted-foreground">En el móvil, este interruptor te llevará a los ajustes de iOS o Android para cambiar el permiso del sistema.</p>
      <h3 className="mb-2 mt-6 text-sm font-bold">Instalar la app</h3>
      <InstallCard />
      <h3 className="mb-2 mt-6 text-sm font-bold">Apariencia</h3>
      <ThemeSwitch />
      <h3 className="mb-2 mt-6 text-sm font-bold">Probar estados de la app</h3>
      <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3.5"><WifiOff size={18} className="text-primary" /><span className="flex-1 text-sm">Simular sin conexión</span><Toggle on={offline} onChange={(v) => setOffline(v)} label="Simular sin conexión" /></div>
      <div className="mt-4"><Trust>Ubicación y micrófono nunca se usan en segundo plano sin avisarte. Los negocios no reciben tu identidad ni tu ubicación individual.</Trust></div>
    </Screen>
  );
}

/** Instalación como app: iOS y Android (Capacitor / añadir a inicio) y Windows (app instalable desde Edge/Chrome). */
export function InstallCard() {
  const { platform, installed, canPrompt, install } = useInstall();
  const how: Record<string, string> = {
    windows: "En Windows: pulsa Instalar (o el icono ⊕ de la barra de direcciones de Edge/Chrome). Se abre en su propia ventana, con acceso en el menú Inicio y la barra de tareas.",
    android: "En Android: pulsa Instalar o, en el menú ⋮ de Chrome, “Instalar aplicación”. También disponible como app nativa desde Google Play.",
    ios: "En iPhone/iPad: en Safari pulsa Compartir y luego “Añadir a pantalla de inicio”. También disponible como app nativa desde App Store.",
    other: "Desde Edge o Chrome pulsa el icono de instalar de la barra de direcciones. En móvil, usa las apps de App Store y Google Play.",
  };
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-spot-gradient"><Download size={20} /></span><span className="min-w-0 flex-1"><strong className="block text-sm">Instalar Spotly</strong><small className="text-muted-foreground">iPhone · Android · Windows</small></span>{installed && <span className="rounded-full bg-primary/20 px-2 py-0.5 text-3xs font-bold text-primary">INSTALADA</span>}</div>
      <p className="mt-3 text-xs text-muted-foreground">{how[platform]}</p>
      <div className="mt-3 flex gap-2">
        <Button className="flex-1" disabled={installed} onClick={async () => { const r = await install(); if (r === "manual") toast(platform === "ios" ? "Safari → Compartir → Añadir a pantalla de inicio" : "Usa el icono de instalar de tu navegador"); else if (r === "accepted") toast.success("Spotly instalada"); }}>{canPrompt ? <><Download size={15} />Instalar ahora</> : <><Monitor size={15} />Cómo instalar</>}</Button>
        <Button variant="secondary" className="flex-1" onClick={() => toast("Apps nativas iOS y Android: se publican desde este mismo código con Capacitor")}><Smartphone size={15} />Apps móvil</Button>
      </div>
    </div>
  );
}
