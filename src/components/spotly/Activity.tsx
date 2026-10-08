import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { AudioLines, BadgeCheck, Bell, Calendar, Heart, Loader2, Mic, Sparkles, UserPlus, Volume2, WifiOff, Zap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useApp } from "./app-context";
import { AnonAvatar } from "./Author";
import { FollowButton, PersonAvatar } from "./CloudPeople";
import { AuthorProfile, SpotDetail } from "./SpotDetail";
import { spotData, type SpotData } from "./spotData";
import { VoiceReply } from "./Voice";
import { VoiceThread } from "./VoiceThread";
import { BottomSheet } from "./kit";
import { toggleFollow, useMe, useStore } from "@/lib/store";
import { api, db, fileUrl, useCloud } from "@/lib/cloud";
import { loadCloudSpot } from "@/lib/spots";
import { formatClock } from "@/lib/voice/recorder";
import festival from "@/assets/spotly-sevilla-festival.jpg";
import stage from "@/assets/spotly-live-stage.jpg";
import beach from "@/assets/spotly-beach-club.jpg";
import mePhoto from "@/assets/spotly-me.jpg";

/**
 * Notificaciones. Con tu cuenta en la nube son de verdad: quién empezó a seguirte, quién respondió con su voz a tus
 * Spots o te dejó una voz en tu muro y las notas que te llegan a tus chats (con punto en lo nuevo desde tu última
 * visita). En la demostración se ven avisos de ejemplo; sin cuenta no hay avisos que inventar.
 */
const ago = (iso: string) => {
  const m = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  return m < 1 ? "Ahora" : m < 60 ? `Hace ${m} min` : m < 1440 ? `Hace ${Math.round(m / 60)} h` : m < 2880 ? "Ayer" : `Hace ${Math.round(m / 1440)} días`;
};
const seenKey = (uid: string) => `spotly-avisos-vistos:${uid}`;
const SEEN_EVENT = "spotly-avisos-vistos";
const readSeen = (uid: string) => { try { return Number(localStorage.getItem(seenKey(uid)) ?? 0) || 0; } catch { return 0; } };
const writeSeen = (uid: string, t: number) => { try { localStorage.setItem(seenKey(uid), String(t)); } catch { /* sin almacenamiento */ } window.dispatchEvent(new Event(SEEN_EVENT)); };

/** ¿Hay avisos nuevos desde tu última visita? (el punto de la campana). En la demostración siempre hay de ejemplo. */
export function useActivityDot(): boolean {
  const { demo } = useStore();
  const cloud = useCloud();
  const [dot, setDot] = useState(false);
  useEffect(() => {
    if (demo || !cloud.on || !cloud.uid) { setDot(false); return; }
    const uid = cloud.uid;
    let alive = true;
    const check = () => { api.fetchActivity(db(), uid, 5).then((l) => { if (alive) setDot(l.some((i) => Date.parse(i.at) > readSeen(uid))); }).catch(() => undefined); };
    check();
    const t = setInterval(check, 120000);
    const onVisible = () => { if (document.visibilityState === "visible") check(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener(SEEN_EVENT, check);
    return () => { alive = false; clearInterval(t); document.removeEventListener("visibilitychange", onVisible); window.removeEventListener(SEEN_EVENT, check); };
  }, [demo, cloud.on, cloud.uid]);
  return demo || dot;
}

export function ActivityView() {
  const { demo } = useStore();
  const cloud = useCloud();
  if (demo) return <DemoActivity />;
  if (cloud.on && cloud.uid) return <CloudActivity uid={cloud.uid} />;
  return (
    <Frame>
      <div className="mt-16 text-center">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-secondary text-primary"><Bell size={28} /></span>
        <p className="mx-auto mt-4 max-w-xs text-sm text-muted-foreground">{cloud.status === "missing" || cloud.status === "error" ? "Los avisos llegarán en cuanto tu cuenta conecte con Spotly." : "Aquí verás quién te sigue, quién responde a tus Spots con su voz y quién te manda notas de voz. Entra con tu cuenta para recibirlos."}</p>
      </div>
    </Frame>
  );
}

function Frame({ children, tabs }: { children: ReactNode; tabs?: ReactNode }) {
  return (
    <main className="px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-[var(--safe-header)]">
      <div className="flex min-h-10 items-center"><h1 className="text-lg font-bold">Notificaciones</h1></div>
      {tabs}
      {children}
    </main>
  );
}

function Tabs<T extends string>({ list, tab, onTab }: { list: readonly T[]; tab: T; onTab: (t: T) => void }) {
  return <div className="mt-4 grid grid-cols-4 gap-1">{list.map((x) => <Button key={x} size="sm" variant={tab === x ? "default" : "secondary"} onClick={() => onTab(x)} className={`h-8 min-w-0 rounded-full px-1 text-3xs ${tab === x ? "spot-active-pill" : "text-foreground"}`}>{x}</Button>)}</div>;
}

/* ───────── Avisos de verdad (nube) ───────── */
const CLOUD_TABS = ["Todas", "Respuestas", "Seguidores", "Mensajes"] as const;
type CloudTab = (typeof CLOUD_TABS)[number];

function CloudActivity({ uid }: { uid: string }) {
  const app = useApp();
  const me = useMe();
  const [items, setItems] = useState<api.ActivityItem[] | null>(null);
  const [error, setError] = useState(false);
  const [tab, setTab] = useState<CloudTab>("Todas");
  const [seen] = useState(() => readSeen(uid));
  const [spot, setSpot] = useState<SpotData | null>(null);
  const [person, setPerson] = useState<api.ActivityWho | null>(null);
  const [wall, setWall] = useState(false);
  const [opening, setOpening] = useState<string | null>(null);
  const load = useCallback(() => { api.fetchActivity(db(), uid).then((l) => { setItems(l); setError(false); }).catch(() => setError(true)); }, [uid]);
  useEffect(() => {
    load();
    const t = setInterval(load, 60000);
    const onVisible = () => { if (document.visibilityState === "visible") load(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", onVisible); };
  }, [load]);
  /* Lo que ves ahora queda como visto para la próxima vez (el punto se mantiene mientras sigues aquí). */
  useEffect(() => { if (items?.length) writeSeen(uid, Math.max(...items.map((i) => Date.parse(i.at)))); }, [items, uid]);

  const shown = useMemo(() => (items ?? []).filter((i) => tab === "Todas" || (tab === "Respuestas" ? i.kind === "reply" || i.kind === "wall" : tab === "Seguidores" ? i.kind === "follow" : i.kind === "chat")), [items, tab]);
  const open = (i: api.ActivityItem) => {
    if (i.kind === "follow") { setPerson(i.who); return; }
    if (i.kind === "chat") { app.open("chats"); return; }
    if (i.kind === "wall") { setWall(true); return; }
    if (!i.spotId) return;
    setOpening(i.id);
    void loadCloudSpot(i.spotId).then((m) => { if (m) setSpot(spotData(m, me.name)); else toast("Ese Spot ya no está disponible."); }).catch(() => toast.error("No se pudo abrir el Spot.")).finally(() => setOpening(null));
  };
  const text = (i: api.ActivityItem) => i.kind === "follow" ? "ha empezado a seguirte"
    : i.kind === "reply" ? <>ha respondido con su voz a «{i.spotTitle}»</>
    : i.kind === "wall" ? "te ha dejado una voz en tu muro"
    : i.group ? <>ha hablado en «{i.chatTitle || "tu grupo"}»</> : "te ha enviado una nota de voz";

  return (
    <Frame tabs={<Tabs list={CLOUD_TABS} tab={tab} onTab={setTab} />}>
      {items === null && !error && <div className="grid place-items-center py-16" aria-busy="true"><Loader2 className="animate-spin text-primary" size={26} /></div>}
      {items === null && error && <div className="py-12 text-center"><WifiOff className="mx-auto text-muted-foreground" size={26} /><p className="mt-2 text-sm text-muted-foreground">No se pudieron cargar tus avisos.</p><Button variant="secondary" size="sm" className="mt-3" onClick={load}>Reintentar</Button></div>}
      {items !== null && shown.length === 0 && <p className="py-12 text-center text-sm text-muted-foreground">{tab === "Todas" ? "Aún no tienes avisos. Cuando alguien te siga, responda a tus Spots o te escriba, lo verás aquí." : "Nada por aquí todavía."}</p>}
      <div className="mt-3">
        {shown.map((i) => {
          const unread = Date.parse(i.at) > seen;
          return (
            <div key={i.id} className="flex items-center gap-3 border-b border-border/40 py-3">
              <button type="button" onClick={() => open(i)} className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-label={`${i.who.name} ${typeof text(i) === "string" ? text(i) : ""}`.trim()}>
                <span className="relative shrink-0">
                  {i.who.anon ? <AnonAvatar className="h-11 w-11" /> : <PersonAvatar p={{ name: i.who.name, avatar_path: i.who.avatar }} className="h-11 w-11 ring-2 ring-primary/40" />}
                  <span className={`absolute -bottom-0.5 -right-0.5 grid h-5 w-5 place-items-center rounded-full ${i.kind === "follow" ? "bg-primary" : "bg-accent"} text-primary-foreground ring-2 ring-background`}>{i.kind === "follow" ? <UserPlus size={11} /> : <AudioLines size={11} />}</span>
                </span>
                <span className="min-w-0 flex-1 text-sm">
                  <strong>{i.who.name}</strong> {text(i)}
                  <span className="block text-xs text-muted-foreground">{ago(i.at)}{i.durationMs ? ` · nota de voz de ${formatClock(i.durationMs)}` : ""}</span>
                </span>
              </button>
              {i.kind === "follow" && i.who.id
                ? <FollowButton id={i.who.id} />
                : <button type="button" onClick={() => open(i)} aria-label="Escuchar" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-secondary text-primary">{opening === i.id ? <Loader2 size={16} className="animate-spin" /> : <Volume2 size={17} />}</button>}
              {unread && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" aria-label="Nuevo" />}
            </div>
          );
        })}
      </div>
      {spot && <SpotDetail s={spot} onClose={() => setSpot(null)} onAuthor={() => setSpot(null)} />}
      {person && <AuthorProfile name={person.name} id={person.id} avatar={fileUrl(person.avatar)} onClose={() => setPerson(null)} />}
      {wall && <BottomSheet title="Tu muro de voz" onClose={() => setWall(false)} z={70}><VoiceThread threadId={`muro:${uid}`} emptyText="Aún no te han dejado voces en tu muro." /></BottomSheet>}
    </Frame>
  );
}

/* ───────── Avisos de ejemplo (solo en la demostración) ───────── */
type N = { id: number; k: "like" | "voz" | "follow" | "hito" | "evento" | "impulso"; u: string; t: string; time: string; today: boolean; read: boolean; img?: string; group: "Menciones" | "Seguidores" | "Sistema" };
const init: N[] = [
  { id: 1, k: "voz", u: "María", t: "ha escuchado tu Spot", time: "2 min", today: true, read: false, img: festival, group: "Menciones" },
  { id: 2, k: "like", u: "Carlos", t: "ha reaccionado", time: "3 min", today: true, read: false, img: beach, group: "Menciones" },
  { id: 3, k: "follow", u: "Sofía", t: "ha compartido tu Spot", time: "5 min", today: true, read: false, group: "Seguidores" },
  { id: 4, k: "hito", u: "Spotly", t: "Tu Spot tiene más de 1.000 vistas", time: "10 min", today: true, read: true, img: festival, group: "Sistema" },
  { id: 5, k: "evento", u: "Spotly", t: "12 personas están hablando en este lugar", time: "8 min", today: true, read: true, img: stage, group: "Sistema" },
  { id: 6, k: "impulso", u: "Spotly", t: "Tu impulso x5 termina en 2 h", time: "2 h", today: true, read: true, group: "Sistema" },
  { id: 7, k: "follow", u: "Javi", t: "ha empezado a seguirte", time: "Ayer", today: false, read: true, group: "Seguidores" },
  { id: 8, k: "voz", u: "Lucía", t: "te ha mencionado en un Spot", time: "Ayer", today: false, read: true, img: beach, group: "Menciones" },
];
const icon = { like: Heart, voz: AudioLines, follow: UserPlus, hito: Sparkles, evento: Calendar, impulso: Zap };
const tint = { like: "bg-live", voz: "bg-primary", follow: "bg-primary", hito: "bg-accent", evento: "bg-accent", impulso: "bg-live" };
const DEMO_TABS = ["Todas", "Menciones", "Seguidores", "Eventos"] as const;

function DemoActivity() {
  const { following } = useStore();
  const [tab, setTab] = useState<(typeof DEMO_TABS)[number]>("Todas");
  const [list, setList] = useState(init);
  const [reply, setReply] = useState<string | null>(null);
  const shown = list.filter((n) => tab === "Todas" || (tab === "Eventos" ? n.k === "evento" || n.k === "hito" : tab === "Menciones" ? n.group === "Menciones" : n.group === tab));
  const row = (n: N) => {
    const I = icon[n.k];
    const follows = following.includes(n.u);
    return (
      <div key={n.id} onClick={() => setList(list.map((x) => (x.id === n.id ? { ...x, read: true } : x)))} className={`flex items-center gap-3 border-b border-border/40 py-3 ${n.read ? "opacity-75" : ""}`}>
        <span className="relative shrink-0">
          {n.u === "Spotly"
            ? <span className="grid h-11 w-11 place-items-center rounded-full bg-spot-gradient text-lg font-bold text-primary-foreground">{n.k === "evento" ? <Zap size={23} /> : n.k === "hito" ? <Sparkles size={23} /> : "S"}</span>
            : <img src={[festival, mePhoto, beach, mePhoto, stage][n.id % 5]} alt={n.u} className="h-11 w-11 rounded-full object-cover ring-2 ring-primary/40" />}
          <span className={`absolute -bottom-0.5 -right-0.5 grid h-5 w-5 place-items-center rounded-full ${tint[n.k]} text-primary-foreground ring-2 ring-background`}><I size={11} /></span>
        </span>
        <span className="min-w-0 flex-1 text-sm">
          {n.u !== "Spotly" && <><strong>{n.u}</strong>{n.k === "follow" && <BadgeCheck size={12} className="ml-1 inline text-primary" />} </>}{n.t}
          <span className="block text-xs text-muted-foreground">{n.time === "Ayer" ? "Ayer" : `Hace ${n.time}`}</span>
        </span>
        {n.k === "follow" && <Button size="sm" variant={follows ? "secondary" : "default"} onClick={(e) => { e.stopPropagation(); toggleFollow(n.u); }}>{follows ? "Siguiendo" : "Seguir"}</Button>}
        {n.k === "voz" && <Button size="icon" variant="secondary" aria-label={`Responder a ${n.u} con tu voz`} onClick={(e) => { e.stopPropagation(); setReply(n.u); }}><Mic size={16} /></Button>}
        {n.img && n.k !== "voz" && <img src={n.img} alt="" className="h-11 w-11 shrink-0 rounded-lg object-cover" />}
        {!n.read && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />}
      </div>
    );
  };
  const today = shown.filter((n) => n.today), before = shown.filter((n) => !n.today);
  return (
    <Frame tabs={<Tabs list={DEMO_TABS} tab={tab} onTab={setTab} />}>
      <p className="mt-3 text-2xs text-muted-foreground">Avisos de ejemplo de la demostración</p>
      {shown.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">Nada por aquí todavía</p>}
      {today.length > 0 && <div className="mt-2">{today.map(row)}</div>}
      {before.length > 0 && <div>{before.map(row)}</div>}
      {reply && <VoiceReply name={reply} mode="message" onClose={() => setReply(null)} />}
    </Frame>
  );
}
