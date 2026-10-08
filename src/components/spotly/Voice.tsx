import { useEffect, useRef, useState } from "react";
import { BadgeCheck, Camera, Check, MapPin, Mic, MicOff, ShieldAlert, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { BottomSheet, StateCard, Waveform } from "./kit";
import { useApp } from "./app-context";
import { setPerm, useMe, useStore } from "@/lib/store";
import { VoiceComposer, type ReplyTarget } from "./VoiceThread";
import { addVoiceNote, type VoiceNote } from "@/lib/voice/notes";
import { api, cloudErrorText, cloudOn, db } from "@/lib/cloud";
import { formatClock } from "@/lib/voice/recorder";
import { commerce } from "@/lib/spotlyConfig";

export { useGate } from "./Gate";

/**
 * Responder (o mandar un mensaje) con tu voz desde cualquier sitio, en una hoja inferior con el panel de grabación
 * común. La voz se guarda en su conversación: `threadId` (comentarios de un Spot, una foto, un Hot Spot…) o, para
 * un mensaje a una persona, su chat de voz (con la nube, `toUserId` abre o reutiliza el chat privado real con ella).
 * Firma con tu nombre, o «Anónimo» con Incógnito de pago.
 */
export function VoiceReply({ name, onClose, onSent, mode = "reply", threadId, target, toUserId }: {
  name: string; onClose: () => void; onSent?: ((r: { anon: boolean; dur: string; note: VoiceNote }) => void) | undefined;
  mode?: "reply" | "message"; threadId?: string | undefined; target?: ReplyTarget | undefined; toUserId?: string | null | undefined;
}) {
  const me = useMe();
  const [sent, setSent] = useState<{ anon: boolean } | null>(null);
  const direct = !!toUserId && cloudOn();
  const where = threadId ?? `chat:${name}`;
  return (
    <BottomSheet title={sent ? undefined : mode === "message" ? `Mensaje de voz para ${name}` : `Responder a ${name}`} onClose={onClose} z={70}>
      {sent ? (
        <div className="py-4 text-center"><div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-spot-gradient"><Check size={30} /></div><h3 className="mt-4 text-lg font-bold">{mode === "message" ? "Mensaje enviado" : "Respuesta enviada"}</h3><p className="text-sm text-muted-foreground">{sent.anon ? "Ha salido como «Anónimo» 👻." : `Ha salido con tu nombre: ${me.name}.`} {mode === "message" ? `Está en tu chat de voz con ${name}.` : "Ya aparece en la conversación, enlazada a su audio."}</p><Button className="mt-5 w-full" onClick={onClose}>Listo</Button></div>
      ) : (
        <VoiceComposer autoFocus target={target ?? (mode === "reply" ? { name, atMs: 0, durationMs: 0 } : undefined)} sendLabel={mode === "message" ? "Enviar mensaje de voz" : "Enviar respuesta de voz"}
          allowAnon={!direct}
          onSend={async (clip, anon) => {
            let thread = where;
            if (direct) {
              try { thread = `chat:${await api.openDirectChat(db(), toUserId!)}`; }
              catch (e) { toast.error(cloudErrorText(e)); return false; }
            }
            const note = addVoiceNote({ threadId: thread, parentId: target?.id ?? null, replyAtMs: target?.atMs, clip, anon: direct ? false : anon });
            setSent({ anon: direct ? false : anon });
            onSent?.({ anon, dur: formatClock(clip.durationMs), note });
            return true;
          }} />
      )}
    </BottomSheet>
  );
}

/** Grabadora mínima (temporizador) para mensajes de voz de negocios y formularios. */
export function useRecorder(max = commerce.voiceMaxSeconds) {
  const [rec, setRec] = useState(false);
  const [secs, setSecs] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);
  const stop = () => { if (timer.current) clearInterval(timer.current); setRec(false); };
  const toggle = () => {
    if (rec) return stop();
    setSecs(0); setRec(true);
    timer.current = setInterval(() => setSecs((s) => { if (s + 1 >= max) { stop(); return max; } return s + 1; }), 1000);
  };
  const reset = () => { stop(); setSecs(0); };
  return { rec, secs, toggle, reset, label: `0:${String(secs).padStart(2, "0")}` };
}
