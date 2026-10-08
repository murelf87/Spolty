import { useEffect, useMemo, useRef, useState } from "react";
import { BadgeCheck, Flame, MapPin, Mic, MicOff, Search, Store } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Chip, Screen, SponsoredTag, StateCard, Trust } from "./kit";
import { SponsoredSpot } from "./Local";
import { HotSpotCard } from "./HotSpots";
import { useApp } from "./app-context";
import { setPerm, toggleFollow, useStore } from "@/lib/store";
import { businesses, campaignEligible, fmtDist, hotspots, parseIntent, people, type Business } from "@/lib/sampleData";
import { useMe, useNow } from "@/lib/store";
import { api, cloudUid, db, fileUrl, useCloud } from "@/lib/cloud";
import { searchCloudSpots, type MySpot } from "@/lib/spots";
import { FollowButton, PersonAvatar } from "./CloudPeople";
import { AuthorProfile, SpotDetail, type SpotInfo } from "./SpotDetail";
import { spotData } from "./spotData";

/** De una frase hablada, lo que interesa buscar: el lugar («… en Triana») o el nombre («busco a Laura»). */
const placeOf = (q: string) => /\b(?:en|de|por)\s+([a-záéíóúñü][\wáéíóúñü\s-]{2,40})/i.exec(q.replace(/[¿?¡!.,]/g, " "))?.[1]?.trim();
const nameOf = (q: string) => q.replace(/[¿?¡!.,]/g, " ").replace(/\b(busco|buscar|quiero|encontrar|encuentra|ver|perfil|el|la|los|las|a|al|de|del|a la|persona|usuario|usuaria|llamad[oa]|que se llama)\b/gi, " ").replace(/\s+/g, " ").trim();

const trends: [string, string, string][] = [["Triana ahora", "¿Qué está pasando en Triana?", "2,1K"], ["Dónde cenar", "¿Dónde puedo cenar?", "1,8K"], ["Copas en el centro", "Quiero tomar una copa en el centro", "1,3K"], ["Peluquerías abiertas", "Quiero una peluquería abierta", "940"], ["Farmacia de guardia", "Busco una farmacia abierta", "720"]];
const examples = ["¿Qué está pasando en Triana?", "Quiero una peluquería cerca", "¿Dónde puedo cenar?", "Busco una farmacia abierta", "Quiero tomar una copa", "Necesito una peluquería que pueda atenderme ahora"];

type SR = { start: () => void; stop: () => void; lang: string; interimResults: boolean; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onerror: ((e: { error: string }) => void) | null; onend: (() => void) | null };

/** Búsqueda principalmente por voz. La entrada escrita es accesoria. */
export function VoiceSearch({ onBack }: { onBack: () => void }) {
  const app = useApp();
  const { perms, bizCampaign, bizAvailability, following, offline } = useStore();
  const now = useNow();
  const me = useMe();
  const cloud = useCloud();
  /* Con la nube: personas y Spots reales que coinciden con lo que has dicho. */
  const [people2, setPeople2] = useState<api.ProfileRow[] | null>(null);
  const [spots2, setSpots2] = useState<MySpot[] | null>(null);
  const [openSpot, setOpenSpot] = useState<SpotInfo | null>(null);
  const [openPerson, setOpenPerson] = useState<api.ProfileRow | null>(null);
  const [q, setQ] = useState("");
  const [typed, setTyped] = useState("");
  const [listening, setListening] = useState(false);
  const [kind, setKind] = useState<"Lugares" | "Creadores">("Lugares");
  const [onlyVerified, setOnlyVerified] = useState(false);
  const recRef = useRef<SR | null>(null);
  useEffect(() => () => recRef.current?.stop(), []);

  const intent = useMemo(() => (q ? parseIntent(q) : null), [q]);
  useEffect(() => {
    if (!cloud.on) return;
    let alive = true;
    if (kind === "Creadores") {
      setPeople2(null);
      const who = nameOf(q);
      (who ? api.searchPeople(db(), who) : api.discoverPeople(db(), { city: me.city, exclude: cloudUid() ?? undefined })).then((l) => { if (alive) setPeople2(l); }).catch(() => { if (alive) setPeople2([]); });
    } else if (q && intent && intent.kind !== "local") {
      setSpots2(null);
      void searchCloudSpots(intent.place ?? placeOf(q) ?? q).then((l) => { if (alive) setSpots2(l); }).catch(() => { if (alive) setSpots2([]); });
    } else setSpots2(null);
    return () => { alive = false; };
  }, [cloud.on, kind, q, intent, me.city]);

  const run = (text: string) => { setQ(text); setTyped(""); };
  const speak = () => {
    if (!perms.mic) { toast.error("Micrófono denegado"); return; }
    if (listening) { recRef.current?.stop(); setListening(false); return; }
    const W = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR };
    const Ctor = W.SpeechRecognition ?? W.webkitSpeechRecognition;
    if (!Ctor) { // sin reconocimiento en este navegador: se ofrece un ejemplo hablado
      setListening(true);
      window.setTimeout(() => { setListening(false); run(examples[1]!); toast("Este navegador no dicta: uso un ejemplo"); }, 1400);
      return;
    }
    const r = new Ctor(); r.lang = "es-ES"; r.interimResults = false;
    r.onresult = (e) => run(e.results[0]![0]!.transcript);
    r.onerror = (e) => { setListening(false); if (e.error === "not-allowed") { setPerm("mic", false); toast.error("Micrófono denegado"); } else toast.error("No te he entendido. Inténtalo otra vez."); };
    r.onend = () => setListening(false);
    recRef.current = r; setListening(true); r.start();
  };

  const results = useMemo(() => {
    if (!intent || intent.kind !== "local") return null;
    const d = new Date(now || 0);
    const cat = businesses.filter((b) => b.category === intent.category && (!intent.openNow || b.open || !/abiert/.test(intent.raw.toLowerCase())));
    const sponsored: Business[] = [];
    const organic: Business[] = [];
    for (const b of cat.sort((a, c) => a.distM - c.distM)) {
      const isOther = b.paidBy === "other";
      const isMine = b.mine && bizCampaign && campaignEligible(bizCampaign, b.distM, d);
      (isOther || isMine ? sponsored : organic).push(b);
    }
    const avNow = (b: Business) => (b.mine ? !!bizAvailability?.on && bizAvailability.until > now : !!b.slots);
    const s = intent.availableNow ? [...sponsored].sort((a, c) => Number(avNow(c)) - Number(avNow(a))) : sponsored;
    return { sponsored: s, organic, anyAvail: cat.some(avNow) };
  }, [intent, now, bizCampaign, bizAvailability]);

  return (
    <Screen title="Buscar con la voz" sub="Menos escribir, más hablar" onBack={onBack} z={50}>
      <div className="rounded-3xl bg-spot-surface p-5 text-center">
        <button onClick={speak} aria-label={listening ? "Detener búsqueda por voz" : "Buscar con la voz"} className={(listening ? "spot-pulse " : "") + "mx-auto grid h-28 w-28 place-items-center rounded-full bg-spot-gradient shadow-glow"}>{perms.mic ? <Mic size={46} /> : <MicOff size={46} />}</button>
        <p className="mt-3 min-h-10 text-sm text-muted-foreground">{!perms.mic ? "Micrófono denegado: escribe o permite el micrófono" : listening ? "Escuchando… habla ahora" : q ? `«${q}»` : "Pulsa y di lo que buscas"}</p>
        <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (typed.trim()) run(typed.trim()); }}>
          <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="…o escríbelo aquí (opcional)" aria-label="Búsqueda escrita" className="h-11 min-w-0 flex-1 rounded-full border border-border bg-background px-4 text-sm text-foreground" />
          <Button type="submit" size="icon" variant="secondary" aria-label="Buscar"><Search size={16} /></Button>
        </form>
      </div>
      {!perms.mic && <div className="mt-3"><StateCard icon={MicOff} tone="live" title="Micrófono denegado" text="Para buscar hablando necesitas permitir el micrófono." action="Permitir micrófono" onAction={() => setPerm("mic", true)} secondary="Abrir permisos" onSecondary={() => app.open("permisos")} /></div>}

      <div className="mt-4 flex gap-2"><Chip active={kind === "Lugares"} onClick={() => setKind("Lugares")}>Lugares y negocios</Chip><Chip active={kind === "Creadores"} onClick={() => setKind("Creadores")}>Personas</Chip></div>

      {kind === "Creadores" && cloud.on && <div className="mt-3 space-y-2">
        <p className="text-xs font-semibold text-muted-foreground">{nameOf(q) ? `Personas que coinciden con «${nameOf(q)}»` : `Personas en ${me.city || "tu ciudad"}`}</p>
        {!people2 && <p className="py-4 text-center text-xs text-muted-foreground">Buscando…</p>}
        {people2?.length === 0 && <p className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">No hay nadie con ese nombre. Prueba a decirlo de otra forma.</p>}
        {people2?.map((p) => <div key={p.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3"><button onClick={() => setOpenPerson(p)} className="flex min-w-0 flex-1 items-center gap-3 text-left"><PersonAvatar p={p} /><span className="min-w-0"><strong className="block truncate text-sm">{p.display_name || p.username}</strong><small className="block truncate text-xs text-muted-foreground">@{p.username}{p.city ? ` · ${p.city}` : ""}</small></span></button><FollowButton id={p.id} /></div>)}
      </div>}
      {kind === "Creadores" && !cloud.on && <div className="mt-3 space-y-2">
        <Chip active={onlyVerified} onClick={() => setOnlyVerified(!onlyVerified)}><BadgeCheck size={12} className="mr-1 inline" />Solo verificados</Chip>
        {people.filter((p) => !onlyVerified || p.verified).map((p) => <div key={p.name} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3"><img src={p.img} alt="" className="h-11 w-11 rounded-full object-cover" /><span className="min-w-0 flex-1"><strong className="flex items-center gap-1 text-sm">{p.name}<BadgeCheck size={13} className="text-primary" /></strong><small className="text-muted-foreground">{p.note} · {p.dist}</small></span><Button size="sm" variant={following.includes(p.name) ? "secondary" : "default"} onClick={() => toggleFollow(p.name)}>{following.includes(p.name) ? "Siguiendo" : "Seguir"}</Button></div>)}
      </div>}

      {kind === "Lugares" && !q && <>
        <h3 className="mb-2 mt-5 flex items-center gap-1.5 text-sm font-bold"><Flame size={15} className="text-live" />Tendencias en Sevilla</h3>
        <div className="flex flex-wrap gap-2">{trends.map(([l, query, n], i) => <button key={l} onClick={() => run(query)} className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold hover:border-primary"><span className="text-primary">{i + 1}</span>{l}<small className="font-normal text-muted-foreground">{n}</small></button>)}</div>
        <p className="mt-1 text-3xs text-muted-foreground">Cifras de ejemplo. Las tendencias reales salen de búsquedas y actividad verificadas, no de pagos.</p>
        <h3 className="mb-2 mt-5 text-sm font-bold">Prueba a decir</h3>
        <div className="space-y-2">{examples.map((s) => <button key={s} onClick={() => run(s)} className="min-h-11 w-full rounded-xl border border-border bg-card p-3 text-left text-sm hover:border-primary">«{s}»</button>)}</div>
      </>}

      {kind === "Lugares" && q && offline && <div className="mt-4"><StateCard icon={Search} tone="muted" title="Sin conexión" text="Necesitamos internet para buscar cerca de ti." action="Reintentar" onAction={() => toast.error("Sigues sin conexión")} /></div>}

      {kind === "Lugares" && q && !offline && intent && <div className="mt-4 space-y-3">
        <p className="rounded-xl bg-secondary p-3 text-xs"><b>He entendido:</b> {intent.kind === "happening" ? "qué está pasando" : intent.category ?? "sin categoría"}{intent.place ? ` · ${intent.place}` : " · cerca de ti"}{intent.openNow ? " · abierto ahora" : ""}{intent.availableNow ? " · con disponibilidad ahora" : ""}</p>

        {cloud.on && intent.kind !== "local" && <>
          <h3 className="flex items-center gap-2 text-sm font-bold"><Mic size={15} className="text-primary" />Spots que coinciden</h3>
          {!spots2 && <p className="py-3 text-center text-xs text-muted-foreground">Buscando…</p>}
          {spots2?.length === 0 && <p className="rounded-xl border border-dashed border-border p-3 text-center text-xs text-muted-foreground">Aún no hay Spots sobre esto. ¡Cuéntalo tú con tu voz!</p>}
          {spots2?.map((m) => { const d = spotData(m, me.name); return <button key={m.id} onClick={() => setOpenSpot(d)} className="flex w-full items-center gap-3 rounded-xl border border-border bg-card p-3 text-left">{d.img ? <img src={d.img} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover" /> : <span className="flex h-14 w-14 shrink-0 items-center justify-center gap-[0.125rem] rounded-lg bg-spot-surface px-1.5" aria-hidden="true">{m.audio.peaks.filter((_, k) => k % 4 === 0).map((h, k) => <i key={k} className="w-[0.1875rem] rounded-full bg-spot-gradient" style={{ height: `${Math.round(h * 70)}%` }} />)}</span>}<span className="min-w-0 flex-1"><strong className="block truncate text-sm">{d.text}</strong><small className="block truncate text-xs text-muted-foreground">{d.incognito ? "Anónimo" : d.name} · {d.city} · {d.dur}</small></span></button>; })}
        </>}
        {intent.kind === "happening" && <>
          <h3 className="flex items-center gap-2 text-sm font-bold"><Flame size={15} className="text-live" />Lo que se cuenta{intent.place ? ` en ${intent.place}` : " cerca"}</h3>
          {hotspots.filter((h) => !intent.place || h.place === intent.place || intent.place === "Triana").map((h) => <HotSpotCard key={h.id} h={h} />)}
          <Button variant="secondary" className="w-full" onClick={() => app.openPhotoWall(intent.place)}>Ver muro de fotos {intent.place ? `de ${intent.place}` : "cercano"}</Button>
        </>}

        {intent.kind === "unknown" && !(cloud.on && spots2?.length) && <StateCard icon={Search} tone="muted" title="No te he entendido" text="Prueba con “Quiero una peluquería cerca” o “¿Qué está pasando en Triana?”." action="Ver ejemplos" onAction={() => setQ("")} />}

        {results && <>
          {results.sponsored.length > 0 && <>
            <h3 className="flex items-center gap-2 text-sm font-bold">DESTACADOS CERCA DE TI <SponsoredTag label="Patrocinados" /></h3>
            {results.sponsored.map((b, i) => <SponsoredSpot key={b.id} b={b} label={i === 0 ? "Patrocinado" : "Destacado"} />)}
            <p className="text-2xs text-muted-foreground">Estos negocios han contratado publicidad compatible con tu búsqueda. Pagar da visibilidad; no significa que sean los mejores.</p>
          </>}
          {intent.availableNow && !results.anyAvail && <StateCard icon={Store} tone="muted" title="Nadie indica disponibilidad ahora" text="Ningún negocio de esta categoría ha marcado huecos libres ahora mismo. Te mostramos los resultados normales." />}
          <h3 className="text-sm font-bold">Resultados cercanos</h3>
          {results.organic.length === 0 && results.sponsored.length === 0 && <StateCard icon={Search} tone="muted" title="Sin resultados" text="No hemos encontrado negocios de esta categoría en tu radio." />}
          {results.organic.map((b) => <button key={b.id} onClick={() => app.openBiz(b.id)} className="flex w-full items-center gap-3 rounded-xl border border-border bg-card p-3 text-left"><img src={b.img} alt="" className="h-14 w-14 rounded-lg object-cover" /><span className="min-w-0 flex-1"><strong className="block truncate text-sm">{b.name}</strong><small className="flex items-center gap-1 text-muted-foreground"><MapPin size={11} />{fmtDist(b.distM)} · <span className={b.open ? "text-primary" : ""}>{b.open ? "Abierto" : "Cerrado"}</span></small><small className="text-3xs text-muted-foreground">{b.hours}</small></span><span className="text-xs text-primary">Ver ›</span></button>)}
        </>}
        <Trust>La búsqueda por voz interpreta intención, categoría, lugar, momento y disponibilidad. Hoy el reconocimiento es un ejemplo del navegador; el servidor lo hará en producción.</Trust>
      </div>}
      {openSpot && <SpotDetail s={openSpot} onClose={() => setOpenSpot(null)} onAuthor={() => setOpenSpot(null)} />}
      {openPerson && <AuthorProfile name={openPerson.display_name || openPerson.username} id={openPerson.id} avatar={fileUrl(openPerson.avatar_path)} onClose={() => setOpenPerson(null)} />}
    </Screen>
  );
}
