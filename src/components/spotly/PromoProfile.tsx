import { useState } from "react";
import { BadgeCheck, Eye, Sparkles, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Chip, Screen, SponsoredTag, StateCard, Trust } from "./kit";
import { Checkout } from "./Credits";
import { useApp } from "./app-context";
import { AuthorProfile } from "./SpotDetail";
import { useGate } from "./Voice";
import { fmtRemaining, setProfilePromo, toggleFollow, useNow, useStore } from "@/lib/store";
import { boostRadii, eur, eurToCredits, promoIntensities } from "@/lib/spotlyConfig";
import { people } from "@/lib/sampleData";
import { useCloud } from "@/lib/cloud";
import { CloudPeopleNearby } from "./PeopleNearby";

/** Promoción de perfil: se compra EXPOSICIÓN. Nunca seguidores ni follows automáticos. */
export function ProfilePromo({ onBack }: { onBack: () => void }) {
  const { profilePromo, credits } = useStore();
  const app = useApp();
  const now = useNow();
  const [level, setLevel] = useState("mid");
  const [radius, setRadius] = useState("5");
  const [buy, setBuy] = useState(false);
  const gate = useGate({ verified: true, online: true });
  const it = promoIntensities.find((i) => i.id === level)!;
  const active = !!profilePromo?.active && profilePromo.endsAt > now;
  const ended = !!profilePromo && !active && now > 0;

  if (active) {
    const p = promoIntensities.find((i) => i.id === profilePromo!.intensity)!;
    return (
      <Screen title="Resultados de tu promoción" sub={`Intensidad ${p.label.toLowerCase()} · termina en ${fmtRemaining(profilePromo!.endsAt - now)}`} onBack={onBack} z={55}>
        <div className="rounded-2xl border border-primary/40 bg-primary/10 p-4 text-sm"><b>Tu perfil se está mostrando</b> a personas reales y verificadas de tu zona. Ellas deciden si te siguen.</div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">{[[Users, "3,2K", "Personas alcanzadas"], [Eye, "412", "Visitas al perfil"], [UserPlus, "38", "Nuevos seguidores"]].map(([I, v, l]) => { const Ic = I as typeof Eye; return <div key={String(l)} className="rounded-xl border border-border bg-card p-3"><Ic size={16} className="mx-auto text-primary" /><strong className="block text-lg">{String(v)}</strong><small className="text-3xs text-muted-foreground">{String(l)}</small></div>; })}</div>
        <p className="mt-2 text-2xs text-muted-foreground">Cifras de ejemplo. En producción solo se mostrarán métricas realmente medidas; los seguidores obtenidos son personas que decidieron seguirte.</p>
        <Button variant="outline" className="mt-4 w-full" onClick={() => { setProfilePromo(null); toast("Promoción detenida"); }}>Detener promoción</Button>
        <Button variant="secondary" className="mt-2 w-full" onClick={() => app.open("personas")}>Ver cómo aparezco en “Personas sugeridas”</Button>
      </Screen>
    );
  }

  return (
    <Screen title="Promocionar perfil" sub="Haz que más personas descubran tu perfil" onBack={onBack} z={55}
      footer={<Button className="h-12 w-full rounded-full bg-spot-gradient text-base text-foreground" disabled={!!gate} onClick={() => setBuy(true)}>Promocionar · {eur(it.priceEur)} · {eurToCredits(it.priceEur)} cr</Button>}>
      {ended && <div className="mb-3"><StateCard icon={Sparkles} tone="muted" title="Tu promoción ha finalizado" text="Ya no se muestra tu perfil de forma destacada. Puedes lanzar otra cuando quieras." /></div>}
      {gate ?? <>
        <div className="rounded-2xl bg-spot-surface p-4 text-center"><span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-spot-gradient shadow-glow"><Users size={26} /></span><h3 className="mt-2 font-bold">Más exposición, decisión libre</h3><p className="mt-1 text-sm text-muted-foreground">Pagas para que Spotly muestre tu perfil a más personas reales. <b>No compras seguidores</b>: cada persona decide Seguir o No seguir.</p></div>
        <h4 className="mb-2 mt-4 text-sm font-bold">Intensidad</h4>
        <div className="space-y-2">{promoIntensities.map((i) => <button key={i.id} onClick={() => setLevel(i.id)} aria-pressed={level === i.id} className={"flex w-full items-center gap-3 rounded-xl border p-3 text-left " + (level === i.id ? "border-primary bg-primary/10 shadow-glow" : "border-border bg-card")}><span className="flex-1"><strong className="block text-sm">{i.label} · {i.hours >= 24 ? `${i.hours / 24} día${i.hours > 24 ? "s" : ""}` : `${i.hours} h`}</strong><small className="text-muted-foreground">{i.sub}</small></span><strong className="text-sm">{eur(i.priceEur)}</strong></button>)}</div>
        <h4 className="mb-2 mt-4 text-sm font-bold">Zona</h4>
        <div className="flex flex-wrap gap-2">{boostRadii.map((r) => <Chip key={r.id} active={radius === r.id} onClick={() => setRadius(r.id)}>{r.label}</Chip>)}</div>
        <p className="mt-3 text-xs text-muted-foreground">Al terminar verás: personas alcanzadas, visitas al perfil y nuevos seguidores obtenidos.</p>
        <div className="mt-3"><Trust>Tu perfil promocionado aparecerá marcado como “Promocionado” en “Personas que quizá te interesen” y “Descubre gente cerca”. Saldo: 💎 {credits.toLocaleString("es-ES")}</Trust></div>
      </>}
      {buy && <Checkout title={`Promoción de perfil · ${it.label}`} kind="digital" lines={[{ label: `Exposición de perfil · ${it.label} · ${boostRadii.find((r) => r.id === radius)!.label}`, eur: it.priceEur }]} onClose={() => setBuy(false)} onNeedCredits={() => app.open("wallet")} onPaid={() => { setProfilePromo({ active: true, endsAt: Date.now() + it.hours * 3_600_000, intensity: level }); toast.success("Promoción activada"); }} />}
    </Screen>
  );
}

function PersonRow({ p, tag }: { p: (typeof people)[number]; tag?: string | undefined }) {
  const { following } = useStore();
  const on = following.includes(p.name);
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
      <img src={p.img} alt="" className="h-12 w-12 shrink-0 rounded-full object-cover ring-2 ring-primary/40" />
      <span className="min-w-0 flex-1"><strong className="flex items-center gap-1 text-sm">{p.name}{p.verified && <BadgeCheck size={13} className="text-primary" />}{tag && <SponsoredTag label={tag} />}</strong><small className="text-muted-foreground">{p.note} · {p.dist}</small></span>
      <Button size="sm" variant={on ? "secondary" : "default"} className="min-h-9" onClick={() => { toggleFollow(p.name); toast(on ? `Has dejado de seguir a ${p.name}` : `Ahora sigues a ${p.name}`); }}>{on ? "Siguiendo" : "Seguir"}</Button>
    </div>
  );
}

export function SuggestedPeople({ onBack }: { onBack: () => void }) {
  const { profilePromo, demo } = useStore();
  const cloud = useCloud();
  const now = useNow();
  const mine = !!profilePromo && profilePromo.endsAt > now;
  const sections: [string, typeof people][] = [
    ["Personas que quizá te interesen", people.slice(0, 3)], ["Descubre gente cerca", people.slice(2, 5)], ["Personas activas ahora", [people[5]!, people[1]!]], ["Voces de tu ciudad", [people[0]!, people[3]!]],
  ];
  if (cloud.on) return (
    <Screen title="Personas sugeridas" sub="Gente real de Spotly" onBack={onBack} z={55}>
      <CloudPeopleNearby />
      <Trust>Seguir es siempre una decisión tuya; nunca se generan follows automáticos.</Trust>
    </Screen>
  );
  return (
    <Screen title="Personas sugeridas" sub={demo ? "Personas reales y verificadas" : "Personas de ejemplo"} onBack={onBack} z={55}>
      {sections.map(([t, list], si) => <section key={t} className="mb-5"><h3 className="mb-2 text-sm font-bold">{t}</h3><div className="space-y-2">{si === 0 && mine && <div className="flex items-center gap-3 rounded-xl border border-accent/50 bg-accent/10 p-3"><span className="grid h-12 w-12 place-items-center rounded-full bg-spot-gradient font-bold">Tú</span><span className="flex-1"><strong className="flex items-center gap-2 text-sm">Tu perfil <SponsoredTag label="Promocionado" /></strong><small className="text-muted-foreground">Así te ven los demás</small></span></div>}{list.map((p, i) => <PersonRow key={p.name + si} p={p} tag={si === 0 && i === 1 ? "Promocionado" : undefined} />)}</div></section>)}
      <Trust>Las personas marcadas “Promocionado” han pagado por más exposición de perfil. Seguir es siempre una decisión tuya; nunca se generan follows automáticos.</Trust>
    </Screen>
  );
}

export function PeopleStrip() {
  const app = useApp();
  const { following } = useStore();
  const [profile, setProfile] = useState<string | null>(null);
  return (<>
    <section className="mx-3 rounded-xl border border-border bg-card p-3">
      <div className="mb-2 flex items-center justify-between"><h3 className="text-sm font-bold">Voces de tu ciudad</h3><button onClick={() => app.open("personas")} className="text-xs text-primary">Ver más ›</button></div>
      <div className="flex gap-3 overflow-x-auto pb-1">{people.slice(0, 5).map((p, i) => <div key={p.name} className="flex w-24 shrink-0 flex-col items-center text-center"><button onClick={() => setProfile(p.name)} aria-label={`Ver perfil de ${p.name}`} className="flex flex-col items-center"><img src={p.img} alt="" className="h-16 w-16 rounded-full object-cover ring-2 ring-primary/50" /><strong className="mt-1 flex items-center gap-0.5 text-xs">{p.name}<BadgeCheck size={11} className="text-primary" /></strong></button>{i === 1 && <SponsoredTag label="Promocionado" />}<Button size="sm" variant={following.includes(p.name) ? "secondary" : "default"} className="mt-1 h-8 px-3 text-2xs" onClick={() => { toggleFollow(p.name); toast(following.includes(p.name) ? "Dejaste de seguir" : `Sigues a ${p.name}`); }}>{following.includes(p.name) ? "Siguiendo" : "Seguir"}</Button></div>)}</div>
    </section>
    {profile && <AuthorProfile name={profile} onClose={() => setProfile(null)} />}
  </>);
}
