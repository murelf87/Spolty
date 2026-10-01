import { useState, type ReactNode } from "react";
import { Bell, Bookmark, Check, Compass, Flame, Heart, Linkedin, MoreHorizontal, Mic, Pause, Play, Search, Share2, WifiOff, Ghost, RefreshCw } from "lucide-react";
import { siX, siFacebook, siInstagram, siWhatsapp, siTelegram, siTiktok, siSnapchat, siMessenger, siReddit, siPinterest, siThreads, siBluesky } from "simple-icons";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Logo } from "./Logo";
import { useApp } from "./app-context";
import { AuthorProfile, SpotDetail } from "./SpotDetail";
import { VoiceReply } from "./Voice";
import { NowStrip } from "./NowStrip";
import { HotSpotCard } from "./HotSpots";
import { FlashOfferCard, SponsoredSpot, getBiz } from "./Local";
import { IncognitoExpiredNote, IncognitoSpotCard } from "./Incognito";
import { GrowCard } from "./LocalAd";
import { PeopleStrip } from "./PromoProfile";
import { BoostedTag, IncognitoTag, Skeleton, StateCard } from "./kit";
import { ContentState } from "./Safety";
import { addReport, blockUser, toggleFollow, unblockUser, useNow, useStore } from "@/lib/store";
import { campaignEligible, hotspots } from "@/lib/sampleData";
import valenciaSunset from "@/assets/valencia-sunset.jpg";
import sevilleEvening from "@/assets/spotly-sevilla-noche-ref.jpg";
import stagePhoto from "@/assets/spotly-live-stage.jpg";
import lauraPhoto from "@/assets/spotly-laura.jpg";
import mePhoto from "@/assets/spotly-me.jpg";
import festivalPhoto from "@/assets/spotly-sevilla-festival.jpg";
import beachPhoto from "@/assets/spotly-beach-club.jpg";

export type MineSpot = { boosted: boolean; incognito: boolean; text: string; visibility: string } | null;

/* ---------- Stories strip ---------- */
const storyPeople = [
  { name: "Cerca", img: sevilleEvening, live: true },
  { name: "Ahora", img: stagePhoto, live: true },
  { name: "Alicia", img: lauraPhoto, live: false },
  { name: "Marcos", img: festivalPhoto, live: false },
  { name: "Dani", img: beachPhoto, live: false },
  { name: "Marta", img: valenciaSunset, live: false },
];

function StoriesStrip({ onOpenCreate }: { onOpenCreate: () => void }) {
  const [viewed, setViewed] = useState<string[]>([]);
  return (
    <div className="flex gap-3 overflow-x-auto px-3 pb-2 pt-1 scrollbar-none" style={{ scrollbarWidth: "none" }}>
      {/* Tu historia */}
      <button onClick={onOpenCreate} className="flex shrink-0 flex-col items-center gap-1.5" aria-label="Crear tu historia">
        <span className="relative grid h-16 w-16 place-items-center rounded-full border-2 border-dashed border-primary/60 bg-secondary">
          <img src={mePhoto} alt="Tú" className="h-full w-full rounded-full object-cover opacity-60" />
          <span className="absolute bottom-0 right-0 grid h-5 w-5 place-items-center rounded-full bg-primary text-primary-foreground shadow"><svg viewBox="0 0 16 16" className="h-3 w-3 fill-current"><path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg></span>
        </span>
        <span className="text-[11px] text-muted-foreground">Tu historia</span>
      </button>
      {/* Historias de otros */}
      {storyPeople.map((p) => {
        const seen = viewed.includes(p.name);
        return (
          <button key={p.name} onClick={() => { setViewed((v) => [...v, p.name]); toast(`Historia de ${p.name}`); }} className="flex shrink-0 flex-col items-center gap-1.5" aria-label={`Historia de ${p.name}`}>
            <span className={`relative h-16 w-16 rounded-full p-[2.5px] ${seen ? "bg-secondary" : "bg-spot-gradient"}`}>
              <img src={p.img} alt={p.name} className="h-full w-full rounded-full object-cover" />
              {p.live && !seen && <span className="absolute -top-0.5 left-1/2 -translate-x-1/2 rounded-full bg-live px-1.5 py-0 text-[8px] font-bold leading-4 text-white">LIVE</span>}
            </span>
            <span className={`text-[11px] ${seen ? "text-muted-foreground" : "font-semibold"}`}>{p.name}</span>
          </button>
        );
      })}
    </div>
  );
}

const waves = [5, 9, 14, 22, 13, 7, 19, 11, 25, 16, 9, 18, 27, 12, 7, 21, 15, 10, 23, 14, 8, 19, 26, 11, 6, 16, 24, 12, 7, 20, 13, 9, 17, 25, 11, 6, 15, 21, 9, 5];


export function Wave({ active }: { active: boolean }) {
  return <div className="spot-wave flex h-7 min-w-0 flex-1 items-center justify-center gap-[2px] overflow-hidden" aria-label="Forma de onda de audio">{waves.map((h, i) => <span key={i} className={active ? "spot-wave-active" : "spot-wave-idle"} style={{ height: h, width: 2, borderRadius: 4 }} />)}</div>;
}
type Net = { name: string; icon?: { path: string }; hex: string; dark?: boolean; custom?: ReactNode };
const nets: Net[] = [
  { name: "X", icon: siX, hex: "#000000" },
  { name: "Instagram", icon: siInstagram, hex: "#FF0069" },
  { name: "Facebook", icon: siFacebook, hex: "#0866FF" },
  { name: "WhatsApp", icon: siWhatsapp, hex: "#25D366" },
  { name: "Telegram", icon: siTelegram, hex: "#26A5E4" },
  { name: "TikTok", icon: siTiktok, hex: "#000000" },
  { name: "Snapchat", icon: siSnapchat, hex: "#FFFC00", dark: true },
  { name: "Messenger", icon: siMessenger, hex: "#0866FF" },
  { name: "LinkedIn", hex: "#0A66C2", custom: <Linkedin size={20} strokeWidth={2.4}/> },
  { name: "Reddit", icon: siReddit, hex: "#FF4500" },
  { name: "Pinterest", icon: siPinterest, hex: "#BD081C" },
  { name: "Threads", icon: siThreads, hex: "#000000" },
  { name: "Bluesky", icon: siBluesky, hex: "#1185FE" },
  { name: "Mensajes", hex: "#34C759", custom: <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current"><path d="M12 1C5.92 1 1 5.35 1 10.72c0 2.9 1.44 5.49 3.69 7.2v3.6c0 .32.38.48.6.25l2.62-2.77c1.26.42 2.64.64 4.09.64 6.08 0 11-4.35 11-9.92S18.08 1 12 1zm5.5 8.98-2.6 4.13c-.2.32-.63.4-.93.18l-2.05-1.54-1.17 1.13c-.13.12-.23.22-.47.22l.17-2.4 4.37-3.95c.19-.17-.04-.25-.29-.1l-5.4 3.4-2.32-.73c-.5-.16-.51-.5.11-.75l9.08-3.5c.42-.16.79.1.65.75z"/></svg> },
  { name: "Correo", hex: "#0A84FF", custom: <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/></svg> },
];

function ShareSheet({ s, onClose }: { s: SpotData; onClose: () => void }) {
  const [sent, setSent] = useState<string[]>([]);
  const people = ["Laura","Carlos","Marta","Javi","Lucía"];
  const act = (m: string) => { toast(m); onClose(); };
  return <div className="fixed inset-0 z-50 flex items-end bg-background/70 backdrop-blur-sm" onClick={onClose}><div className="mx-auto w-full max-w-[520px] rounded-t-3xl border-t border-border bg-card p-4 pb-8" onClick={e=>e.stopPropagation()}>
    <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border"/>
    <div className="flex items-center gap-3 rounded-2xl bg-secondary p-2"><img src={s.img} alt="" className="h-14 w-14 rounded-xl object-cover"/><div className="min-w-0"><p className="text-sm font-semibold">Spot de {s.name}</p><p className="truncate text-xs text-muted-foreground">{s.text}</p></div></div>
    <p className="mt-4 px-1 text-xs font-semibold text-muted-foreground">ENVIAR EN SPOTLY</p>
    <div className="mt-2 flex gap-4 overflow-x-auto pb-1">{people.map(p=>{const on=sent.includes(p);return <button key={p} onClick={()=>{if(!on){setSent([...sent,p]);toast("Spot enviado a "+p)}}} className="flex w-14 shrink-0 flex-col items-center gap-1"><span className={"grid h-14 w-14 place-items-center rounded-full text-lg font-bold "+(on?"bg-primary text-primary-foreground":"bg-secondary")}>{on?<Check size={20}/>:p[0]}</span><span className="text-[11px]">{on?"Enviado":p}</span></button>})}</div>
    <p className="mt-4 px-1 text-xs font-semibold text-muted-foreground">COMPARTIR FUERA</p>
    <div className="mt-2 grid grid-cols-4 gap-y-3">{nets.map(n=><button key={n.name} onClick={()=>act(n.name==="Correo"?"Abriendo tu correo…":"Abriendo "+n.name+"…")} className="flex flex-col items-center gap-1 rounded-xl py-1 hover:bg-secondary"><span className="grid h-12 w-12 place-items-center rounded-full" style={{ background: n.hex, color: n.dark ? "#000000" : "#FFFFFF" }}>{n.custom ?? (n.icon ? <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current"><path d={n.icon.path}/></svg> : null)}</span><span className="text-[11px]">{n.name}</span></button>)}
      <button onClick={()=>act("Elige dónde compartir…")} className="flex flex-col items-center gap-1 rounded-xl py-1 hover:bg-secondary"><span className="grid h-12 w-12 place-items-center rounded-full bg-secondary text-foreground"><MoreHorizontal size={20}/></span><span className="text-[11px]">Más</span></button></div>
    <Button variant="secondary" className="mt-4 w-full" onClick={()=>act("Enlace del Spot copiado")}>Copiar enlace</Button>
  </div></div>;
}

type SpotData = { id: string; name: string; city: string; ago: string; img: string; tag: string; dist: string; text: string; dur: string; likes: number; boosted?: boolean; incognito?: boolean; own?: boolean };
const spots: Record<string, SpotData> = {
  laura: { id: "laura", name: "Laura", city: "Sevilla", ago: "5 min", img: sevilleEvening, tag: "● EN DIRECTO", dist: "320 m", text: "Ambiente increíble en Sevilla esta noche 🔥", dur: "0:28", likes: 2400 },
  marta: { id: "marta", name: "Marta", city: "Valencia", ago: "12 min", img: valenciaSunset, tag: "CERCA DE TI", dist: "1,2 km", text: "Este atardecer se tenía que compartir 🌅", dur: "0:18", likes: 1800, boosted: true },
  dani: { id: "dani", name: "Dani", city: "Triana", ago: "2 min", img: stagePhoto, tag: "A 150 m", dist: "150 m", text: "Música en directo en la calle Betis, venid 🎸", dur: "0:22", likes: 312 },
  carlos: { id: "carlos", name: "Carlos", city: "Alameda", ago: "Ahora", img: stagePhoto, tag: "● EN DIRECTO", dist: "800 m", text: "Cola enorme en el mercado, mejor venid más tarde", dur: "0:15", likes: 96 },
};
export const feedTabs = ["Para todos", "Cerca", "Ahora", "Siguiendo"] as const;
type FeedTab = (typeof feedTabs)[number];

function SpotMenu({ s, onClose, onStatus }: { s: SpotData; onClose: () => void; onStatus: (v: "ok" | "reported" | "deleted" | "hidden") => void }) {
  const app = useApp();
  const { following } = useStore();
  const [view, setView] = useState<"menu" | "report" | "sent">("menu");
  const [reason, setReason] = useState("");
  const follows = following.includes(s.name);
  const copy = () => { try { void navigator.clipboard?.writeText(`https://spotly.app/spot/${s.id}`); } catch { /* sin permiso de portapapeles */ } toast("Enlace copiado"); onClose(); };
  const row = "w-full rounded-xl px-4 py-3 text-left text-sm hover:bg-secondary";
  return <div className="fixed inset-0 z-[70] flex items-end bg-background/70 backdrop-blur-sm" onClick={onClose}><div className="mx-auto w-full max-w-[520px] space-y-1 rounded-t-3xl border-t border-border bg-card p-4 pb-8" onClick={(e) => e.stopPropagation()}>
    {view === "menu" && <>
      {s.own ? <>
        <button className={row} onClick={() => { onClose(); app.open("impulso"); }}>Impulsar este Spot</button>
        <button className={row} onClick={copy}>Copiar enlace</button>
        <button className={row + " text-live"} onClick={() => { onStatus("deleted"); toast("Spot eliminado"); onClose(); }}>Eliminar Spot</button>
      </> : <>
        {!s.incognito && <button className={row} onClick={() => { toggleFollow(s.name); toast(follows ? `Has dejado de seguir a ${s.name}` : `Ahora sigues a ${s.name}`); onClose(); }}>{follows ? "Dejar de seguir" : "Seguir al autor"}</button>}
        <button className={row} onClick={() => { onStatus("hidden"); toast("Verás menos Spots así", { action: { label: "Deshacer", onClick: () => onStatus("ok") } }); onClose(); }}>No me interesa</button>
        <button className={row} onClick={copy}>Copiar enlace</button>
        <button className={row} onClick={() => { blockUser(s.incognito ? "Incógnito #4821" : s.name); toast(`Has bloqueado a ${s.incognito ? "este autor incógnito" : s.name}`); onClose(); }}>Bloquear {s.incognito ? "autor incógnito" : "a " + s.name}</button>
        <button className={row + " text-live"} onClick={() => setView("report")}>Denunciar</button>
      </>}
      <Button variant="ghost" className="w-full" onClick={onClose}>Cancelar</Button></>}
    {view === "report" && <><h3 className="px-2 pb-1 text-lg font-bold">¿Por qué denuncias este Spot?</h3><p className="px-2 pb-2 text-xs text-muted-foreground">Tu denuncia es anónima. El autor no sabrá quién la envió.</p>
      {["Spam o engaño", "Acoso o insultos", "Contenido sexual", "Violencia o peligro", "Información falsa", "Suplantación de identidad"].map((r) => <button key={r} onClick={() => setReason(r)} className={"flex w-full items-center justify-between rounded-xl px-4 py-3 text-left text-sm " + (reason === r ? "bg-secondary text-foreground" : "hover:bg-secondary")}>{r}{reason === r && <Check size={16} className="text-primary" />}</button>)}
      <div className="flex gap-2 pt-3"><Button variant="ghost" className="flex-1" onClick={() => setView("menu")}>Atrás</Button><Button className="flex-1 bg-live text-foreground hover:bg-live/90" disabled={!reason} onClick={() => { addReport(`Spot de ${s.incognito ? "autor incógnito" : s.name}`, reason); onStatus("reported"); setView("sent"); }}>Enviar denuncia</Button></div></>}
    {view === "sent" && <div className="flex flex-col items-center gap-3 py-6 text-center"><div className="grid h-16 w-16 place-items-center rounded-full bg-primary/15 text-primary"><Check size={30} /></div><h3 className="text-lg font-bold">Gracias por avisarnos</h3><p className="text-sm text-muted-foreground">Revisaremos “{reason}”. Ya no verás este Spot. Sigue el estado en Bloqueos y denuncias.</p><Button className="mt-2 w-full" onClick={onClose}>Entendido</Button></div>}
  </div></div>;
}

export function SpotCard({ s }: { s: SpotData }) {
  const { blocked } = useStore();
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [reply, setReply] = useState(false);
  const [share, setShare] = useState(false);
  const [menu, setMenu] = useState(false);
  const [detail, setDetail] = useState(false);
  const [author, setAuthor] = useState(false);
  const [status, setStatus] = useState<"ok" | "reported" | "deleted" | "hidden">("ok");
  const fmt = (n: number) => n >= 1000 ? (n / 1000).toFixed(1).replace(".", ",") + "K" : String(n);
  const who = s.incognito ? "Incógnito #4821" : s.name;
  if (status === "hidden") return null;
  if (status === "deleted") return <ContentState kind="deleted" who={s.name} />;
  if (status === "reported") return <ContentState kind="reported" who={s.name} onUndo={() => setStatus("ok")} />;
  if (!s.own && blocked.includes(who)) return <ContentState kind="blocked" who={s.incognito ? "este autor incógnito" : s.name} onUndo={() => { unblockUser(who); toast(`${s.name} desbloqueado`); }} />;
  return <article className="spot-feed-card mx-3 overflow-hidden rounded-xl bg-card">
    <div className="relative aspect-[5/4] max-h-[420px] bg-muted">
      <img src={s.img} alt={s.text} width={1024} height={1280} className="h-full w-full cursor-pointer object-cover" loading="lazy" onClick={() => setDetail(true)} />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background via-background/10 to-transparent" />
      <span className="absolute left-3 top-3 flex items-center gap-1.5"><span className="rounded-md bg-live px-2 py-1 text-[10px] font-bold text-foreground">{s.tag}</span>{s.boosted && <BoostedTag />}{s.incognito && <IncognitoTag />}</span>
      <span className="absolute right-3 top-3 rounded-md bg-background/85 px-2 py-1 text-[10px] font-semibold text-foreground">{s.dist}</span>
      <div className="absolute inset-x-3 bottom-2 flex items-end justify-between gap-2">
        <button className="flex min-w-0 items-center gap-2 text-left" onClick={() => !s.incognito && !s.own && setAuthor(true)} aria-label={s.incognito ? "Autor incógnito verificado" : `Ver perfil de ${s.name}`}>
          {s.incognito ? <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-accent bg-background/80"><Ghost size={18} className="text-accent" /></span> : <img src={s.own ? valenciaSunset : s.img} alt="" className="h-10 w-10 shrink-0 rounded-full border border-accent object-cover" />}
          <span className="min-w-0"><span className="block truncate text-sm font-bold">{s.incognito ? "Voz protegida" : s.name} <span className="text-accent">✦</span></span><span className="block truncate text-xs text-foreground/80">{s.city} · Hace {s.ago}</span></span></button>
        <Button variant="icon" size="icon" aria-label="Más opciones" onClick={() => setMenu(true)} className="h-8 w-8 shrink-0 bg-background/75"><MoreHorizontal size={18} /></Button>
      </div>
    </div>
    <div className="px-3 pb-3 pt-1">
      <div className="flex items-center gap-2 rounded-full border border-border bg-secondary px-1 py-1"><Button variant="icon" size="icon" onClick={() => setPlaying(!playing)} aria-label={playing ? "Pausar audio" : "Reproducir audio"} className="h-8 w-8 shrink-0 bg-primary text-primary-foreground">{playing ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}</Button><Wave active={playing} /><span className="pr-2 text-xs text-foreground">{s.dur}</span>{!s.own && <Button variant="icon" size="icon" aria-label="Responder con voz" onClick={() => setReply(true)} className="h-8 w-8 shrink-0 text-accent"><Mic size={16} /></Button>}</div>
      <p className="mt-2 text-sm font-medium">{s.text}</p>
      <div className="mt-2 flex items-center gap-5 text-foreground/80"><Button variant="ghost" size="sm" onClick={() => setLiked(!liked)} className="h-7 gap-1 px-0 text-accent" aria-label="Me gusta"><Heart size={20} fill={liked ? "currentColor" : "none"} /><span className="text-xs text-foreground">{fmt(s.likes + (liked ? 1 : 0))}</span></Button><Button variant="ghost" size="sm" onClick={() => setReply(true)} className="h-7 gap-1 px-0" aria-label="Responder con voz"><Mic size={20} /><span className="text-xs">{s.own ? 0 : 312}</span></Button><Button variant="ghost" size="sm" onClick={() => setShare(true)} className="h-7 gap-1 px-0" aria-label="Compartir"><Share2 size={19} /><span className="text-xs">{s.own ? 0 : 98}</span></Button><Button variant="ghost" size="icon" onClick={() => { setSaved(!saved); toast(saved ? "Quitado de guardados" : "Guardado en tu perfil"); }} className={saved ? "ml-auto h-7 w-7 text-primary" : "ml-auto h-7 w-7"} aria-label="Guardar"><Bookmark size={20} fill={saved ? "currentColor" : "none"} /></Button></div>
    </div>
    {reply && <VoiceReply name={s.incognito ? "esta persona" : s.name} onClose={() => setReply(false)} />}
    {share && <ShareSheet s={s} onClose={() => setShare(false)} />}
    {menu && <SpotMenu s={s} onClose={() => setMenu(false)} onStatus={setStatus} />}
    {detail && <SpotDetail s={s} onClose={() => setDetail(false)} onAuthor={() => setAuthor(true)} />}
    {author && <AuthorProfile name={s.name} onClose={() => setAuthor(false)} />}
  </article>;
}

const mineData = (m: NonNullable<MineSpot>): SpotData => ({ id: "mine", name: "Tú", city: "Sevilla", ago: "1 min", img: valenciaSunset, tag: "EN DIRECTO", dist: "Aquí", text: m.text, dur: "0:12", likes: 0, boosted: m.boosted, incognito: m.incognito, own: true });

export function HomeView({ mine, onBell }: { mine: MineSpot; onBell: () => void }) {
  const app = useApp();
  const { bizCampaign, offline, following } = useStore();
  const now = useNow();
  const [filter, setFilter] = useState<FeedTab>("Para todos");
  const [phase, setPhase] = useState<"ok" | "loading" | "error">("ok");
  const load = (t: FeedTab) => {
    setFilter(t);
    if (offline) { setPhase("error"); return; }
    setPhase("loading");
    window.setTimeout(() => setPhase("ok"), 450);
  };
  const mineCard = mine ? <SpotCard key="mine" s={mineData(mine)} /> : null;
  const carmenOn = !!bizCampaign && now > 0 && campaignEligible(bizCampaign, getBiz("carmen").distM, new Date(now));
  const sponsor = <SponsoredSpot key="sp" b={getBiz(carmenOn ? "carmen" : "trinche")} />;
  const feed: Record<FeedTab, ReactNode[]> = {
    "Para todos": [mineCard, <SpotCard key="l" s={spots["laura"]!} />, <HotSpotCard key="h1" h={hotspots[0]!} />, sponsor, <SpotCard key="m" s={spots["marta"]!} />, <IncognitoSpotCard key="inc" />, <PeopleStrip key="pp" />, <FlashOfferCard key="fo" />, <GrowCard key="gc" />],
    Cerca: [mineCard, <SpotCard key="d" s={spots["dani"]!} />, <HotSpotCard key="h1" h={hotspots[0]!} />, <SpotCard key="l" s={spots["laura"]!} />, sponsor, <FlashOfferCard key="fo" />],
    Ahora: [mineCard, <HotSpotCard key="h1" h={hotspots[0]!} />, <SpotCard key="c" s={spots["carlos"]!} />, <HotSpotCard key="h2" h={hotspots[1]!} />, <HotSpotCard key="h3" h={hotspots[2]!} />, <FlashOfferCard key="fo" />],
    Siguiendo: [mineCard, ...Object.values(spots).filter((x) => following.includes(x.name)).map((x) => <SpotCard key={x.id} s={x} />)],
  };
  const items = feed[filter].filter(Boolean);
  const empty = filter === "Siguiendo" && items.length === 0;
  return <>
    <header className="sticky top-0 z-20 bg-background/95 px-3 pb-2 pt-[max(2.75rem,calc(env(safe-area-inset-top)+0.5rem))] backdrop-blur"><div className="grid grid-cols-[1fr_auto_1fr] items-center"><div className="flex min-w-0"><Button variant="ghost" size="icon" aria-label="Buscar con la voz" onClick={() => app.open("buscar")}><Search size={19} /></Button><Button variant="ghost" size="icon" aria-label="Muro de fotos por ciudades" onClick={() => app.open("ciudad")}><Compass size={18} /></Button></div><Logo className="justify-self-center" /><div className="flex justify-end"><Button variant="ghost" size="icon" aria-label="Chats de voz" onClick={() => app.open("chats")}><Mic size={19} /></Button><Button variant="ghost" size="icon" aria-label="Notificaciones" onClick={onBell} className="relative"><Bell size={19} /><span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-live" /></Button></div></div>
      <div className="mt-3 grid grid-cols-4 gap-1" role="tablist">{feedTabs.map((item) => <Button key={item} role="tab" aria-selected={filter === item} size="sm" variant={filter === item ? "default" : "secondary"} onClick={() => load(item)} className={filter === item ? "spot-active-pill h-8 rounded-full px-1 text-[11px] font-semibold text-foreground" : "h-8 rounded-full px-1 text-[11px] text-foreground/80"}>{item}</Button>)}</div></header>
    <main className="space-y-3 pb-32 pt-1">
      <StoriesStrip onOpenCreate={() => app.open("crear")} />
      <NowStrip />
      <IncognitoExpiredNote />
      {phase === "loading" && <div className="space-y-3 px-3" aria-busy="true" aria-label="Cargando"><Skeleton className="h-72" /><Skeleton className="h-24" /><Skeleton className="h-56" /></div>}
      {phase === "error" && <div className="px-3"><StateCard icon={WifiOff} tone="muted" title="No se pudo cargar el feed" text="Sin conexión. Vuelve a intentarlo cuando recuperes la red." action="Reintentar" onAction={() => { if (offline) toast.error("Sigues sin conexión"); else load(filter); }} /></div>}
      {phase === "ok" && (empty
        ? <div className="mx-3 rounded-2xl border border-dashed border-border p-8 text-center"><Bell className="mx-auto text-primary" size={36} /><h3 className="mt-3 font-bold">Aún no sigues a nadie</h3><p className="mt-1 text-sm text-muted-foreground">Descubre personas cerca de ti y escucha sus Spots aquí.</p><Button className="mt-5" onClick={() => app.open("personas")}>Descubrir personas</Button></div>
        : items.map((n, i) => <div key={filter + i}>{n}</div>))}
      {phase === "ok" && filter === "Siguiendo" && !empty && <PeopleStrip />}
      {phase === "ok" && <p className="px-6 pb-2 pt-2 text-center text-[11px] text-muted-foreground"><Flame size={12} className="mr-1 inline text-live" />Lo pagado se etiqueta “Impulsado” o “Patrocinado”. Nunca sustituye a las personas reales.<button onClick={() => load(filter)} className="ml-2 inline-flex items-center gap-1 text-primary"><RefreshCw size={11} />Actualizar</button></p>}
    </main></>;
}
