import { BadgeCheck, Camera, MapPin, MicOff, ShieldAlert, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { StateCard } from "./kit";
import { useApp } from "./app-context";
import { setPerm, useStore } from "@/lib/store";
import { useCloud } from "@/lib/cloud";

/**
 * Puerta común para cualquier acción que exige cuenta verificada, micrófono,
 * cámara, ubicación o conexión. Devuelve `null` si se puede continuar, o el
 * estado a mostrar. Así ninguna pantalla “finge” que funciona sin permisos.
 */
export function useGate(need: { verified?: boolean; mic?: boolean; camera?: boolean; location?: boolean; online?: boolean }) {
  const { identity, perms, offline } = useStore();
  const cloud = useCloud();
  const app = useApp();
  /* Con una cuenta real en la nube basta con haber entrado (Apple, Google o correo): la verificación de identidad
     es un paso aparte e ilustrativo hasta que se elija un proveedor (AGENTS.md). */
  if (need.verified && identity !== "approved" && !cloud.on) {
    const pending = identity === "pending" || identity === "review";
    return <StateCard icon={pending ? ShieldAlert : BadgeCheck} tone={pending ? "premium" : "primary"} title={pending ? "Verificación en curso" : "Verifica tu identidad"} text={pending ? "Estamos revisando tu identidad. Mientras tanto puedes escuchar y explorar, pero no publicar ni responder." : "En Spotly todas las cuentas son de personas verificadas. Completa la verificación para publicar y responder."} action={pending ? "Ver estado" : "Verificarme"} onAction={() => app.open("verificacion")} />;
  }
  if (need.online && offline) return <StateCard icon={WifiOff} tone="muted" title="Sin conexión" text="No podemos enviar esto ahora. Recupera la conexión e inténtalo de nuevo." action="Reintentar" onAction={() => toast.error("Sigues sin conexión")} />;
  if (need.mic && !perms.mic) return <StateCard icon={MicOff} tone="live" title="Micrófono denegado" text="Spotly funciona con tu voz. Permite el micrófono para grabar." action="Permitir micrófono" onAction={() => { setPerm("mic", true); toast.success("Micrófono permitido"); }} secondary="Abrir permisos" onSecondary={() => app.open("permisos")} />;
  if (need.camera && !perms.camera) return <StateCard icon={Camera} tone="live" title="Cámara denegada" text="Necesitamos la cámara para esta acción. Puedes usar la galería o permitir la cámara." action="Permitir cámara" onAction={() => { setPerm("camera", true); toast.success("Cámara permitida"); }} secondary="Abrir permisos" onSecondary={() => app.open("permisos")} />;
  if (need.location && !perms.location) return <StateCard icon={MapPin} tone="live" title="Ubicación desactivada" text="Sin ubicación no podemos mostrarte lo que pasa cerca ni fijar la zona del Spot." action="Activar ubicación" onAction={() => { setPerm("location", true); toast.success("Ubicación activada"); }} secondary="Abrir permisos" onSecondary={() => app.open("permisos")} />;
  return null;
}

