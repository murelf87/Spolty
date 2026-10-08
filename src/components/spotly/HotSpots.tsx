import { useMemo, useState } from "react";
import { Bookmark, Camera, Check, ChevronLeft, Flag, Flame, Heart, MapPin, Mic, Navigation, Share2, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Chip, Screen, Trust } from "./kit";
import { useApp } from "./app-context";
import { VoiceReply, useGate } from "./Voice";
import { VoiceThread } from "./VoiceThread";
import { useThread } from "@/lib/voice/notes";
import { sampleThread } from "@/lib/voice/samples";
import { addReport, toggleConfirm, useStore } from "@/lib/store";
import { fmtDist, hotspots, people, type HotSpot } from "@/lib/sampleData";
import { LocationOff } from "./Status";

/** Tarjeta de Hot Spot para el feed. */
export function HotSpotCard({ h = hotspots[0]! }: { h?: HotSpot }) {
  const app = useApp();
  const { demo } = useStore();
  return (
    <button onClick={() => app.openHot(h.id)} className="spot-feed-card mx-3 block overflow-hidden rounded-xl bg-card text-left" aria-label={`Abrir Hot Spot: ${h.title}`}>
      <span className="relative block aspect-[16/8]">
        <img src={h.img} alt="" loading="lazy" className="h-full w-full object-cover" />
        <span className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
        <span className="absolute left-3 top-3 flex items-center gap-1 rounded-md bg-live px-2 py-1 text-3xs font-bold"><Flame size={12} />HOT SPOT</span>
        <span className="absolute inset-x-3 bottom-2"><strong className="block text-base leading-tight">🔥 ESTÁ PASANDO A {fmtDist(h.distM).toUpperCase()}</strong><small className="text-foreground/85">{h.title}{!demo && " · ejemplo"}</small></span>
      </span>
      {demo && <span className="grid grid-cols-4 gap-1 px-3 py-2.5 text-center text-2xs">
        {[[Users, `${h.people}`, "hablando"], [Camera, `${h.photos}`, "fotos"], [Mic, `${h.audios}`, "audios"], [Flame, `${h.startedMin}′`, "desde hace"]].map(([I, v, l]) => { const Ic = I as typeof Users; return <span key={String(l)} className="rounded-lg bg-secondary py-1.5"><Ic size={13} className="mx-auto text-primary" /><strong className="block">{String(v)}</strong><small className="text-3xs text-muted-foreground">{String(l)}</small></span>; })}
      </span>}
    </button>
  );
}

/* Voces de ejemplo del Hot Spot (sin audio), con una respuesta encadenada: la conversación real llega del backend. */
const hotVoices = (id: string) => sampleThread(`hot:${id}`, [
  { key: "v1", name: "Laura", img: people.find((p) => p.name === "Laura")?.img, minsAgo: 2, dur: "0:18", likes: 21, verified: true },
  { key: "v2", name: "Carlos", img: people.find((p) => p.name === "Carlos")?.img, minsAgo: 4, dur: "0:12", likes: 9 },
  { key: "v3", name: "Ana", img: people.find((p) => p.name === "Ana")?.img, minsAgo: 3, dur: "0:24", likes: 5, replyTo: "v2", replyAt: "0:07" },
  { key: "v4", name: "Javi", img: people.find((p) => p.name === "Javi")?.img, minsAgo: 8, dur: "0:09", likes: 4 },
  { key: "v5", name: "Marta", img: people.find((p) => p.name === "Marta")?.img, minsAgo: 9, dur: "0:15", likes: 7 },
]);

export function HotSpotView({ id, onBack }: { id: string; onBack: () => void }) {
  const h = hotspots.find((x) => x.id === id) ?? hotspots[0]!;
  const { confirmed, perms, identity, demo } = useStore();
  const app = useApp();
  const mine = confirmed.includes(h.id);
  const [tab, setTab] = useState<"Audios" | "Fotos">("Audios");
  const [reply, setReply] = useState(false);
  const seed = useMemo(() => hotVoices(h.id), [h.id]);
  const thread = useThread(`hot:${h.id}`, seed);
  const gate = useGate({ verified: true });
  const total = h.confirmedBase + (mine ? 1 : 0);
  const photos = [h.img, people[0]!.img, people[1]!.img, people[2]!.img, people[3]!.img, people[4]!.img];
  return (
    <div className="fixed inset-0 z-[55] mx-auto flex max-w-[520px] flex-col overflow-hidden bg-black">
      {/* Foto fullscreen */}
      <div className="relative w-full bg-black" style={{ aspectRatio: "9/14", maxHeight: "68vh" }}>
        <img src={h.img} alt={h.title} className="h-full w-full object-cover" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-black/20" />
        {/* Botón atrás */}
        <button onClick={onBack} aria-label="Volver" className="absolute left-3 grid h-10 w-10 place-items-center rounded-full bg-black/50 text-white backdrop-blur-sm" style={{ top: "var(--safe-header)" }}><ChevronLeft size={24} /></button>
        {/* Badge HOT */}
        <span className="absolute flex items-center gap-1 rounded-md bg-live px-2 py-1 text-3xs font-bold text-white" style={{ top: "var(--safe-header)", right: "0.75rem" }}><Flame size={12} />HOT SPOT</span>
        {/* Acciones laterales derecha */}
        <div className="absolute bottom-24 right-3 flex flex-col items-center gap-5">
          <button onClick={() => toast("Me gusta")} aria-label="Me gusta" className="flex flex-col items-center gap-1">
            <Heart size={28} className="text-white" />
            <span className="text-xs font-bold text-white">{demo ? h.people : "Me gusta"}</span>
          </button>
          <button onClick={() => toast("Compartir Hot Spot")} aria-label="Compartir" className="flex flex-col items-center gap-1">
            <Share2 size={26} className="text-white" />
            <span className="text-xs font-bold text-white">Enviar</span>
          </button>
          <button onClick={() => toast("Hot Spot guardado")} aria-label="Guardar" className="flex flex-col items-center gap-1">
            <Bookmark size={26} className="text-white" />
            <span className="text-xs font-bold text-white">{demo ? h.photos : "Guardar"}</span>
          </button>
        </div>
        {/* Chip lugar + título */}
        <div className="absolute bottom-5 left-3 right-16">
          <div className="mb-1 flex items-center gap-1.5 rounded-full bg-black/55 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm" style={{ width: "fit-content" }}>
            <MapPin size={12} />{h.place} · {fmtDist(h.distM)}
          </div>
          <strong className="block text-base leading-tight text-white drop-shadow">🔥 ESTÁ PASANDO</strong>
          <small className="text-white/80">{h.title}{!demo && " · ejemplo"}</small>
        </div>
      </div>

      {/* Contenido scrollable */}
      <div className="flex-1 overflow-y-auto bg-background px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-4">
        {demo && <div className="grid grid-cols-4 gap-2 text-center">{[[`${h.people}`, "personas"], [`${h.photos}`, "fotos"], [`${h.audios}`, "audios"], [`${h.startedMin} min`, "de inicio"]].map(([v, l]) => <div key={l} className="rounded-xl border border-border bg-card py-2"><strong className="block text-sm">{v}</strong><small className="text-3xs text-muted-foreground">{l}</small></div>)}</div>}

      <div className="mt-4 rounded-2xl border border-primary/40 bg-primary/5 p-4">
        <p className="text-sm font-bold">{demo ? `${total} personas cercanas lo han confirmado` : mine ? "Has confirmado que está pasando" : "¿Lo estás viendo? Confírmalo"}</p>
        {!perms.location ? <div className="mt-2"><LocationOff compact /></div> : gate ? <div className="mt-2">{gate}</div> : (
          <Button variant={mine ? "secondary" : "default"} className="mt-2 w-full" onClick={() => { toggleConfirm(h.id); toast(mine ? "Has retirado tu confirmación" : "Gracias: has confirmado que está pasando"); }}>{mine ? <><Check size={16} />Confirmado · toca para retirar</> : <><Flame size={16} />Confirmo que está pasando</>}</Button>
        )}
        <p className="mt-2 text-2xs text-muted-foreground">Es una señal comunitaria de personas próximas. <b>Spotly no certifica que la información sea verdadera.</b></p>
      </div>

      <div className="mt-4 flex gap-2"><Chip active={tab === "Audios"} onClick={() => setTab("Audios")}>Audio Wall · {thread.length}</Chip><Chip active={tab === "Fotos"} onClick={() => setTab("Fotos")}>{demo ? `Fotos · ${h.photos}` : "Fotos"}</Chip></div>
      {tab === "Audios" ? <div className="mt-3"><VoiceThread threadId={`hot:${h.id}`} seed={seed} root={{ name: h.title, atMs: 0, durationMs: 0 }} emptyText="Aún no hay voces aquí. Cuenta lo que ves." /></div>
        : <div className="mt-3 grid grid-cols-3 gap-1.5">{photos.map((p, i) => <button key={i} onClick={() => toast("Foto " + (i + 1) + " · con audio del autor")} className="overflow-hidden rounded-lg"><img src={p} alt={`Foto ${i + 1} del Hot Spot`} loading="lazy" className="aspect-square w-full object-cover" /></button>)}</div>}

      <div className="mt-4 grid grid-cols-2 gap-2"><Button variant="secondary" onClick={() => { onBack(); app.goMap(); }}><MapPin size={16} />Ver en el mapa</Button><Button variant="secondary" onClick={() => { addReport(`Hot Spot: ${h.title}`, "Información falsa"); toast.success("Denuncia enviada"); }}><Flag size={16} />Denunciar</Button></div>
      <div className="mt-3"><Trust>Un Hot Spot agrupa Spots sobre el mismo acontecimiento cuando muchas personas hablan de él. {identity !== "approved" && "Para responder o confirmar necesitas verificar tu identidad."}</Trust></div>
      </div>

      {/* Footer */}
      <div className="absolute inset-x-0 bottom-0 border-t border-border bg-background/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-sm">
        <Button className="h-12 w-full rounded-full bg-spot-gradient text-base text-foreground" onClick={() => setReply(true)}><Mic size={18} />Responder con tu voz</Button>
      </div>

      {reply && <VoiceReply name={h.title} threadId={`hot:${h.id}`} onClose={() => setReply(false)} />}
    </div>
  );
}
