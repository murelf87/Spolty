import { useState } from "react";
import { ArrowLeft, BadgeCheck, Bookmark, Calendar, Heart, Lock, Store, Users, Wallet as WalletIcon, Check, Crown, Grid3x3, Mic, Pause, Pencil, Play, Settings, Square, Waves, X, Image as ImageIcon, Video } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Shell, type Sheet } from "./Extras";
import { usePos } from "@/lib/preview-context";
import sevilleNight from "@/assets/seville-night.jpg";
import valenciaSunset from "@/assets/valencia-sunset.jpg";

import festival from "@/assets/spotly-sevilla-festival.jpg";
import stage from "@/assets/spotly-live-stage.jpg";
import beach from "@/assets/spotly-beach-club.jpg";
import mePhoto from "@/assets/spotly-me.jpg";
import lauraPhoto from "@/assets/spotly-laura.jpg";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

const imgs = [festival, beach, stage, valenciaSunset, sevilleNight, festival];
const wall0 = [
  { u: "Laura", d: "0:18", t: "Hace 5 min", l: 12 },
  { u: "Carlos", d: "0:32", t: "Hace 20 min", l: 8 },
  { u: "Marta", d: "0:11", t: "Hace 1 h", l: 4 },
];
const badges = [["Voz top", Waves], ["Premium", Crown]] as const;

function Bars({ on }: { on?: boolean }) {
  return <span className="flex h-6 flex-1 items-center gap-[2px]">{Array.from({ length: 26 }, (_, i) => <span key={i} className={`w-[3px] rounded-full ${on ? "bg-primary" : "bg-muted-foreground/50"}`} style={{ height: `${25 + ((i * 37) % 70)}%` }} />)}</span>;
}

export function ProfileView({ onOpen, accountEmail }: { onOpen: (s: Sheet) => void; accountEmail: string | null }) {
  const [tab, setTab] = useState("Spots");
  const [edit, setEdit] = useState(false);
  const [me, setMe] = useState({ name: "Tú", user: "tu.spotly", bio: "Contando Sevilla con mi voz 🎙️" });
  const [wall, setWall] = useState(wall0);
  const [playing, setPlaying] = useState<number | null>(null);
  const [badgesOpen, setBadgesOpen] = useState(false);
  const [rec, setRec] = useState(false);
  const [settings, setSettings] = useState(false);
  if (badgesOpen) return <Badges onBack={() => setBadgesOpen(false)} />;

  return (
    <main className="pb-24">
       <div className="relative px-4 pb-4 pt-[max(2.75rem,calc(env(safe-area-inset-top)+0.5rem))]">
         <div className="relative flex items-center justify-between gap-1"><h2 className="text-sm font-bold">Tu perfil</h2><div className="flex gap-1">
          <Button variant="ghost" size="icon" aria-label="Editar perfil" onClick={() => setEdit(true)}><Pencil size={18} /></Button>
          <Button variant="ghost" size="icon" aria-label="Ajustes" onClick={() => setSettings(true)}><Settings size={18} /></Button>
         </div></div>
        <div className="relative text-center">
           <div className="mx-auto mt-3 h-24 w-24 rounded-full bg-spot-gradient p-[3px] shadow-glow"><img src={mePhoto} alt={me.name} className="h-full w-full rounded-full object-cover" /></div>
           <h1 className="mt-2 text-xl font-bold">{me.name}</h1>
           <p className="text-xs text-muted-foreground">@{me.user}</p>
           <div className="mx-auto mt-4 grid max-w-sm grid-cols-3"><div><strong>248</strong><small className="block text-[11px] text-muted-foreground">Spots</small></div><div><strong>12,4K</strong><small className="block text-[11px] text-muted-foreground">Seguidores</small></div><div><strong>680</strong><small className="block text-[11px] text-muted-foreground">Siguiendo</small></div></div>
        </div>
      </div>
       <div className="grid grid-cols-5 gap-1 px-3 py-2">
         {([["Spots", Grid3x3], ["Fotos", ImageIcon], ["Vídeos", Video], ["Voz", Waves], ["Guardados", Bookmark]] as const).map(([l, I]) => <Button key={l} size="sm" variant={(tab === l || (l === "Voz" && tab === "Audio Wall")) ? "default" : "secondary"} onClick={() => setTab(l === "Voz" ? "Audio Wall" : l)} className={`h-8 min-w-0 gap-1 rounded-full px-1 text-[10px] ${(tab === l || (l === "Voz" && tab === "Audio Wall")) ? "spot-active-pill" : ""}`}><I size={12} />{l}</Button>)}
      </div>
      {tab !== "Audio Wall" ? (
        <section className="grid grid-cols-3 gap-1 p-1">
           {tab === "Spots" && <div className="relative"><img src={valenciaSunset} alt="Tu último Spot" className="aspect-[3/4] w-full rounded-md object-cover ring-2 ring-primary" /><span className="absolute bottom-1 left-1 flex items-center gap-0.5 text-[10px] font-semibold text-foreground"><Heart size={10} fill="currentColor" className="text-live"/>1,2K</span></div>}
           {Array.from({ length: tab === "Spots" ? 8 : tab === "Guardados" ? 4 : 6 }, (_, i) => <div key={tab + i} className="relative"><img src={imgs[(i + (tab === "Vídeos" ? 2 : tab === "Fotos" ? 1 : 0)) % imgs.length]} alt="Spot" loading="lazy" className="aspect-[3/4] w-full rounded-md object-cover" /><span className="absolute bottom-1 left-1 flex items-center gap-0.5 text-[10px] text-foreground"><Heart size={10} fill="currentColor" className="text-live"/>{["842","1,1K","854","376"][i%4]}</span>{tab === "Vídeos" && <Video size={12} className="absolute right-1 top-1 text-foreground"/>}</div>)}
        </section>
      ) : (
        <section className="space-y-3 p-4">
          <p className="text-xs text-muted-foreground">Tus visitas te dejan mensajes de voz aquí.</p>
          <Button variant="secondary" className="w-full rounded-lg border border-primary/50" onClick={() => onOpen("audio-wall")}><Mic size={17} className="text-primary" />Explorar Audio Wall en directo</Button>
          {wall.map((w, i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-spot-gradient font-bold">{w.u[0]}</div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{w.u} <span className="text-xs font-normal text-muted-foreground">· {w.t}</span></p>
                <button onClick={() => setPlaying(playing === i ? null : i)} className="mt-1 flex w-full items-center gap-2">{playing === i ? <Pause size={14} className="text-primary" /> : <Play size={14} className="text-primary" />}<Bars on={playing === i} /><span className="text-xs">{w.d}</span></button>
              </div>
            </div>
          ))}
          <button onClick={() => { if (rec) { setWall([{ u: me.name, d: "0:07", t: "Ahora", l: 0 }, ...wall]); toast.success("Mensaje añadido a tu Audio Wall"); } setRec(!rec); }} className="flex w-full items-center justify-center gap-2 rounded-full bg-spot-gradient py-3 font-semibold shadow-glow">{rec ? <Square size={16} /> : <Mic size={18} />}{rec ? "Grabando… pulsa para publicar" : "Dejar mensaje de voz"}</button>
        </section>
      )}
       <div className="px-4 py-5"><Button variant="secondary" className="w-full" onClick={() => onOpen("verificacion")}><BadgeCheck size={16} className="text-primary" />Verificación · ver ejemplo</Button><Button variant="ghost" className="mt-2 w-full" onClick={() => setBadgesOpen(true)}>{badges.map(([l, I]) => <span key={l} className="flex items-center gap-1 text-[10px] text-muted-foreground"><I size={11} className="text-primary" />{l}</span>)}</Button><div className="mt-3 grid grid-cols-3 gap-2">{([["wallet", "Wallet", WalletIcon], ["chats", "Chats de voz", Mic], ["local", "Panel Local", Store], ["comunidades", "Comunidades", Users], ["eventos", "Eventos", Calendar], ["privacidad", "Privacidad", Lock]] as [Sheet, string, typeof Mic][]).map(([k, l, I]) => <Button key={l} variant="secondary" onClick={() => onOpen(k)} className="flex h-16 flex-col gap-1 rounded-lg border border-border text-[11px]"><I size={18} className="text-primary" />{l}</Button>)}</div><Button variant="ghost" onClick={() => toast("Reproduciendo tu presentación de voz")} className="mt-3 w-full"><Play size={14} className="text-primary" /><Bars on /><span className="text-xs">0:09</span></Button></div>
       {edit && <EditProfile me={me} onSave={(v) => { setMe(v); setEdit(false); toast.success("Perfil actualizado"); }} onClose={() => setEdit(false)} />}
       {settings && <SettingsScreen accountEmail={accountEmail} onBack={() => setSettings(false)} onOpen={(s) => { setSettings(false); onOpen(s); }} />}
    </main>
  );
}

function EditProfile({ me, onSave, onClose }: { me: { name: string; user: string; bio: string }; onSave: (v: typeof me) => void; onClose: () => void }) {
  const pos = usePos();
  const [v, setV] = useState(me);
  const [rec, setRec] = useState(false);
  return (
    <div className={pos + " inset-0 z-50 mx-auto max-w-[520px] overflow-y-auto bg-background p-4"}>
      <div className="flex items-center justify-between"><button aria-label="Cerrar" onClick={onClose}><X /></button><h2 className="font-bold">Editar perfil</h2><Button size="sm" onClick={() => onSave(v)}>Guardar</Button></div>
      <div className="mx-auto mt-6 grid h-24 w-24 place-items-center rounded-full bg-spot-gradient text-3xl font-bold">{v.name[0] || "?"}</div>
      {(["name", "user", "bio"] as const).map((k) => (
        <label key={k} className="mt-4 block text-xs text-muted-foreground">{k === "name" ? "Nombre" : k === "user" ? "Usuario" : "Descripción"}
          <input value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-3 text-sm text-foreground outline-none focus:border-primary" /></label>
      ))}
      <p className="mt-5 text-xs text-muted-foreground">Presentación de voz</p>
      <button onClick={() => { setRec(!rec); if (rec) toast.success("Presentación de voz guardada"); }} className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-primary/40 bg-card py-4 text-sm">{rec ? <Square size={16} className="text-live" /> : <Mic size={18} className="text-primary" />}{rec ? "Grabando… pulsa para terminar" : "Regrabar presentación"}</button>
    </div>
  );
}

function SettingsScreen({ onBack, onOpen, accountEmail }: { onBack: () => void; onOpen: (s: Sheet) => void; accountEmail: string | null }) {
  const pos = usePos();
  const queryClient = useQueryClient();
  const [t, setT] = useState(() => ({ notif: true, auto: true, dark: typeof document === "undefined" || !document.documentElement.classList.contains("light") }));
  const [help, setHelp] = useState(false); const [out, setOut] = useState(false); const [del, setDel] = useState(false);
  const [n, setN] = useState(["Me gusta", "Respuestas de voz", "Seguidores"]); const [r, setR] = useState("5 km"); const [l, setL] = useState("Español");
  const toggle = (k: keyof typeof t) => {
    const v = !t[k]; setT({ ...t, [k]: v });
    if (k === "dark") { document.documentElement.classList.toggle("light", !v); toast(v ? "Tema oscuro activado" : "Tema claro activado"); }
  };
  const Row = ({ k, l }: { k: keyof typeof t; l: string }) => (
    <button onClick={() => toggle(k)} className="flex w-full items-center justify-between py-3 text-sm">{l}<span className={`h-6 w-11 rounded-full p-0.5 transition ${t[k] ? "bg-primary" : "bg-secondary"}`}><span className={`block h-5 w-5 rounded-full bg-foreground transition ${t[k] ? "translate-x-5" : ""}`} /></span></button>
  );
  return (
    <Shell title="Ajustes" onBack={onBack}>
      <div className="divide-y divide-border rounded-xl border border-border bg-card px-4">
        <Row k="notif" l="Notificaciones" /><Row k="auto" l="Reproducir audio automáticamente" /><Row k="dark" l="Tema oscuro" />
      </div>
      {t.notif && <><p className="mb-1 mt-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Avisarme de</p>
      <div className="flex flex-wrap gap-2">{["Me gusta", "Respuestas de voz", "Seguidores", "Eventos cerca", "Ofertas locales"].map((x) => <button key={x} onClick={() => setN(n.includes(x) ? n.filter((y) => y !== x) : [...n, x])} className={n.includes(x) ? "spot-active-pill rounded-full px-3 py-1.5 text-xs font-semibold" : "rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground"}>{x}</button>)}</div></>}
      <p className="mb-1 mt-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Distancia para descubrir</p>
      <div className="grid grid-cols-4 gap-2">{["1 km", "5 km", "10 km", "Ciudad"].map((x) => <button key={x} onClick={() => { setR(x); toast(`Descubrirás Spots a ${x}`); }} className={r === x ? "rounded-lg bg-primary py-2 text-xs font-semibold text-primary-foreground" : "rounded-lg bg-secondary py-2 text-xs"}>{x}</button>)}</div>
      <p className="mb-1 mt-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Idioma</p>
      <div className="grid grid-cols-3 gap-2">{["Español", "Català", "English"].map((x) => <button key={x} onClick={() => setL(x)} className={l === x ? "rounded-lg bg-primary py-2 text-xs font-semibold text-primary-foreground" : "rounded-lg bg-secondary py-2 text-xs"}>{x}</button>)}</div>
      <div className="mt-4 divide-y divide-border rounded-xl border border-border bg-card px-4">
        {([["privacidad", "Privacidad e incógnito"], ["verificacion", "Verificación"], ["wallet", "Wallet y Premium"]] as [Sheet, string][]).map(([k, l]) => <button key={l} onClick={() => onOpen(k)} className="flex w-full justify-between py-3 text-sm">{l}<span className="text-muted-foreground">›</span></button>)}
        <button onClick={() => setHelp(true)} className="flex w-full justify-between py-3 text-sm">Ayuda y soporte<span className="text-muted-foreground">›</span></button>
      </div>
      <p className="mb-1 mt-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Cuenta y datos</p>
      <div className="divide-y divide-border rounded-xl border border-border bg-card px-4">
        <button onClick={() => toast.info("La descarga de datos aún no está disponible")} className="flex w-full justify-between py-3 text-sm">Descargar mis datos · próximamente<span className="text-muted-foreground">›</span></button>
        <button onClick={() => toast.info("Pausar cuenta aún no está disponible")} className="flex w-full justify-between py-3 text-sm">Pausar cuenta · próximamente<span className="text-muted-foreground">›</span></button>
        <button onClick={() => setDel(true)} className="flex w-full justify-between py-3 text-sm text-live">Eliminar cuenta<span>›</span></button>
      </div>
      <p className="mt-4 text-center text-xs text-muted-foreground">{accountEmail ? `Sesión iniciada: ${accountEmail}` : "Explorando la demostración sin cuenta"}</p>
      <Button variant="outline" className="mt-2 w-full" onClick={() => setOut(true)}>{accountEmail ? "Cerrar sesión" : "Entrar con Apple o Google"}</Button>
      {help && <Help onBack={() => setHelp(false)} />}
      {del && <div className={pos + " inset-0 z-50 grid place-items-center bg-background/70 p-6 backdrop-blur-sm"} onClick={() => setDel(false)}><div className="w-full max-w-xs rounded-2xl border border-border bg-card p-5 text-center" onClick={e => e.stopPropagation()}><h3 className="font-bold">Eliminar cuenta</h3><p className="mt-1 text-sm text-muted-foreground">Esta opción aún no está disponible. No se ha enviado ninguna solicitud de eliminación.</p><Button className="mt-5 w-full bg-live text-primary-foreground" onClick={() => { setDel(false); }}>Volver</Button><Button variant="ghost" className="mt-2 w-full" onClick={() => setDel(false)}>Cancelar</Button></div></div>}
      {out && <div className={pos + " inset-0 z-50 grid place-items-center bg-background/70 p-6 backdrop-blur-sm"} onClick={() => setOut(false)}><div className="w-full max-w-xs rounded-2xl border border-border bg-card p-5 text-center" onClick={e => e.stopPropagation()}><h3 className="font-bold">{accountEmail ? "¿Cerrar sesión?" : "Entrar en Spotly"}</h3><p className="mt-1 text-sm text-muted-foreground">{accountEmail ? "Volverás a la pantalla de bienvenida." : "Podrás acceder con Apple o Google."}</p><Button className="mt-5 w-full" onClick={async () => { if (accountEmail) { await queryClient.cancelQueries(); queryClient.clear(); const { error } = await supabase.auth.signOut(); if (error) { toast.error("No se pudo cerrar sesión"); return; } } else window.location.reload(); setOut(false); }}>{accountEmail ? "Cerrar sesión" : "Ir al acceso"}</Button><Button variant="ghost" className="mt-2 w-full" onClick={() => setOut(false)}>Cancelar</Button></div></div>}
    </Shell>
  );
}

const faqs = [
  ["¿Qué es un Spot?", "Un audio corto, con foto o sin ella, ligado al lugar donde estás. Lo escuchan las personas cercanas."],
  ["¿Por qué no puedo escribir?", "Spotly es voz: publicas, respondes y buscas hablando. Así todo suena real y cercano."],
  ["¿Quién ve mi ubicación?", "Solo la zona aproximada. Con el modo incógnito dejas de aparecer en el mapa durante 1, 4 o 24 horas."],
  ["¿Qué significa verificado?", "Que confirmaste tu identidad con teléfono, documento y selfie. No es lo mismo que Premium."],
  ["¿Cómo funciona impulsar?", "Usas créditos de tu Wallet para que tu Spot llegue a más gente cerca durante un tiempo."],
];

function Help({ onBack }: { onBack: () => void }) {
  const [open, setOpen] = useState<number | null>(0);
  const [rec, setRec] = useState(false); const [sent, setSent] = useState(false);
  return (
    <Shell title="Ayuda y soporte" onBack={onBack}>
      <h3 className="mb-2 text-xs font-bold tracking-wider text-muted-foreground">PREGUNTAS FRECUENTES</h3>
      <div className="divide-y divide-border rounded-xl border border-border bg-card px-4">
        {faqs.map(([q, a], i) => <div key={q}><button onClick={() => setOpen(open === i ? null : i)} className="flex w-full justify-between py-3 text-left text-sm font-medium">{q}<span className="text-primary">{open === i ? "−" : "+"}</span></button>{open === i && <p className="pb-3 text-sm text-muted-foreground">{a}</p>}</div>)}
      </div>
      <div className="mt-5 rounded-2xl border border-primary/30 bg-card p-5 text-center">
        {sent ? <><Check className="mx-auto text-primary" size={32} /><p className="mt-2 font-bold">Mensaje enviado</p><p className="text-sm text-muted-foreground">Te responderemos con una nota de voz en 24 h.</p></> : <>
          <p className="font-bold">¿No encuentras la respuesta?</p><p className="text-sm text-muted-foreground">Cuéntanos tu problema con tu voz</p>
          <button onClick={() => setRec(!rec)} aria-label={rec ? "Detener grabación" : "Grabar mensaje"} className={(rec ? "spot-pulse " : "") + "mx-auto mt-4 grid h-16 w-16 place-items-center rounded-full bg-spot-gradient shadow-glow"}><Mic size={26} /></button>
          <p className="mt-2 text-sm">{rec ? "0:09" : "0:00"}</p>
          <Button className="mt-3 w-full" disabled={!rec} onClick={() => setSent(true)}>Enviar a soporte</Button></>}
      </div>
    </Shell>
  );
}

/* Lámina 12: insignias */
const allBadges = [
  { n: "Verificado", d: "Pendiente de comprobar tu identidad en la próxima fase", I: BadgeCheck, on: false, p: 0 },
  { n: "Voz top", d: "Tus Spots superan 10.000 escuchas", I: Waves, on: true, p: 100 },
  { n: "Premium", d: "Miembro Spotly Premium", I: Crown, on: true, p: 100 },
  { n: "Local de Sevilla", d: "30 Spots publicados en tu ciudad", I: Store, on: false, p: 70 },
  { n: "Organizador", d: "Crea 5 eventos con asistentes", I: Calendar, on: false, p: 40 },
  { n: "Comunidad", d: "Modera una comunidad activa", I: Users, on: false, p: 20 },
];
export function Badges({ onBack }: { onBack: () => void }) {
  const [sel, setSel] = useState<number | null>(null);
  const got = allBadges.filter((b) => b.on).length;
  return (
    <Shell title="Insignias" onBack={onBack}>
      <p className="text-sm text-muted-foreground">Ejemplo de insignias · {got} de {allBadges.length} ilustradas. Tu identidad no está verificada.</p>
      <div className="mt-4 grid grid-cols-3 gap-3">
        {allBadges.map((b, i) => (
          <button key={b.n} onClick={() => setSel(i)} className={`flex flex-col items-center gap-2 rounded-xl border p-3 text-center ${sel === i ? "border-primary" : "border-border"} ${b.on ? "bg-card" : "opacity-50"}`}>
            <span className={`grid h-12 w-12 place-items-center rounded-full ${b.on ? "bg-spot-gradient shadow-glow" : "bg-secondary"}`}>{b.on ? <b.I size={22} /> : <Lock size={18} />}</span>
            <span className="text-[11px] font-semibold leading-tight">{b.n}</span>
          </button>
        ))}
      </div>
      {sel !== null && (() => { const b = allBadges[sel]!; return (
        <div className="mt-5 rounded-xl border border-border bg-card p-4">
          <p className="flex items-center gap-2 font-bold"><b.I size={18} className="text-primary" />{b.n}</p>
          <p className="mt-1 text-sm text-muted-foreground">{b.d}</p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary"><div className="h-full bg-spot-gradient" style={{ width: `${b.p}%` }} /></div>
          <p className="mt-1 text-xs text-muted-foreground">{b.on ? "Conseguida" : `${b.p}% completado`}</p>
        </div>); })()}
    </Shell>
  );
}
