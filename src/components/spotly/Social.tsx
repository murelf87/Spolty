import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Calendar, Camera, CheckCircle2, ChevronLeft, Eye, EyeOff, Flame, Heart, Loader2, MapPin, MessageCircle, Mic, Music, Radio, Share2, ShieldCheck, Sparkles, Trash2, Trophy, Users, Utensils, WifiOff, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Shell } from "./Extras";
import { useApp } from "./app-context";
import sevilleNight from "@/assets/seville-night.jpg";
import valenciaSunset from "@/assets/valencia-sunset.jpg";
import festival from "@/assets/spotly-sevilla-festival.jpg";
import stage from "@/assets/spotly-live-stage.jpg";
import beach from "@/assets/spotly-beach-club.jpg";
import lauraPhoto from "@/assets/spotly-laura.jpg";
import { TopBar } from "./kit";
import { TalkBar, VoiceComposer, VoiceItem, VoiceThread } from "./VoiceThread";
import { VoiceRecordTile } from "./VoiceRecord";
import { FollowButton, PersonAvatar } from "./CloudPeople";
import { AuthorProfile, SpotDetail } from "./SpotDetail";
import { spotData, type SpotData } from "./spotData";
import { MeAvatar } from "./Author";
import { addVoiceNote, useThread, type ThreadNote } from "@/lib/voice/notes";
import { sampleThread } from "@/lib/voice/samples";
import type { VoiceClip } from "@/lib/voice/recorder";
import { detachClip } from "@/lib/voice/recorder";
import { useMe, useStore } from "@/lib/store";
import { api, cloudErrorText, cloudUid, db, fileUrl, useCloud } from "@/lib/cloud";
import { fetchTopicSpots, type MySpot } from "@/lib/spots";
import { addLocalCommunity, addLocalEvent, localNameTaken, removeLocalEvent, toggleLocalGoing, toggleLocalJoined, useLocalGatherings } from "@/lib/gatherings";
import { appUrl, shareLink } from "@/lib/share";

/**
 * Comunidades y eventos. Con tu cuenta en la nube son de verdad y compartidos (crear, unirse, apuntarse, quién va,
 * Spots del tema y conversaciones de voz). Sin nube se ven los de ejemplo (sus cifras solo en la demostración) y lo
 * que creas se guarda en este dispositivo. Lo único escrito son los títulos: nombre, título del evento y lugar.
 */

/** Los mismos temas que al publicar un Spot, así la pestaña «Spots» de una comunidad enseña los de su tema. */
const TOPICS = [["Música", Music], ["Comida", Utensils], ["Planes", Trophy], ["Opiniones", MessageCircle], ["¿Qué está pasando?", Flame], ["Algo que contar", Sparkles]] as const;
const topicIcon = (t: string) => TOPICS.find(([n]) => n === t)?.[1] ?? Users;
const topicImg = (t: string) => ({ "Música": stage, "Comida": festival, "Planes": beach, "Opiniones": sevilleNight, "¿Qué está pasando?": festival, "Algo que contar": valenciaSunset } as Record<string, string>)[t] ?? sevilleNight;

/** Conversación de voz de un grupo (comunidad o evento): todos pueden hablar y responderse, solo con voz. */
function GroupVoices({ threadId, title, root, seedNames = [] }: { threadId: string; title: string; root: { name: string; durationMs: number }; seedNames?: string[] }) {
  const seed = useMemo(() => (seedNames.length ? sampleThread(threadId, seedNames.map((name, i) => ({ key: `g${i}`, name, img: [lauraPhoto, stage, beach, festival][i % 4], minsAgo: 6 + i * 11, dur: `0:${String(9 + ((i * 7) % 20)).padStart(2, "0")}`, likes: 3 + ((i * 5) % 17), ...(i === 2 ? { replyTo: "g0", replyAt: "0:06" } : {}) }))) : []), [threadId, seedNames]);
  const [talk, setTalk] = useState(false);
  const [fresh, setFresh] = useState<string | null>(null);
  return (
    <section className="mt-4">
      <h3 className="mb-2 text-sm font-bold">{title}</h3>
      <div className="mb-3">{talk
        ? <div className="pt-2"><VoiceComposer autoFocus target={{ name: root.name, atMs: 0, durationMs: root.durationMs }} onClose={() => setTalk(false)} onSend={(clip, anon) => { const n = addVoiceNote({ threadId, clip, anon }); setFresh(n.id); setTalk(false); if (!n.pending) toast.success(anon ? "Voz enviada como «Anónimo»" : "Voz enviada al grupo"); }} /></div>
        : <TalkBar onTalk={() => setTalk(true)} label="Habla al grupo…" />}</div>
      <VoiceThread threadId={threadId} seed={seed} freshId={fresh} emptyText="Aún no ha hablado nadie. Rompe el hielo con tu voz." />
    </section>
  );
}

/** Sala en directo: el audio en directo aún no existe, así que se ve y se rotula como demostración. */
function LiveRoom({ room, onLeave }: { room: string; onLeave: () => void }) {
  const { demo } = useStore();
  const [hand, setHand] = useState(false);
  const [muted, setMuted] = useState(true);
  const [speaking, setSpeaking] = useState(false);
  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-background">
      <TopBar title={room} sub={<><span className="mr-1.5 rounded bg-live px-1.5 py-px text-4xs font-bold text-foreground">● EN DIRECTO</span>{demo ? "24 escuchando" : "Sala de demostración"}</>} right={<Button variant="outline" size="sm" onClick={onLeave}>Salir</Button>} />
      <main className="flex-1 overflow-y-auto p-5">
        <p className="mb-4 rounded-xl border border-border bg-card p-3 text-xs text-muted-foreground"><Radio size={13} className="mr-1 inline text-live" />Demostración: el audio en directo llegará pronto. Mientras, habla en la conversación de voz del grupo.</p>
        <p className="text-xs font-bold tracking-wider text-muted-foreground">HABLANDO</p>
        <div className="mt-3 grid grid-cols-3 gap-4">
          {["Laura", "Carlos", ...(speaking ? ["Tú"] : [])].map((n, i) => (
            <div key={n} className="text-center"><span className={i === 0 ? "spot-pulse mx-auto grid h-16 w-16 place-items-center rounded-full bg-spot-gradient text-lg font-bold shadow-glow" : "mx-auto grid h-16 w-16 place-items-center rounded-full bg-spot-gradient text-lg font-bold"}>{n[0]}</span><small className="mt-1 block">{n}</small></div>
          ))}
        </div>
        <p className="mt-8 text-xs font-bold tracking-wider text-muted-foreground">ESCUCHANDO</p>
        <div className="mt-3 grid grid-cols-4 gap-3">
          {["Marta", "Sergio", "Ana", "Pablo", "Lucía", "Diego", "Eva", "Iván"].map((n) => (
            <div key={n} className="text-center"><span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-secondary font-semibold">{n[0]}</span><small className="mt-1 block text-3xs text-muted-foreground">{n}</small></div>
          ))}
        </div>
      </main>
      <footer className="flex items-center justify-around border-t border-border p-4 pb-8">
        {speaking ? (
          <button onClick={() => setMuted(!muted)} aria-label={muted ? "Activar micrófono" : "Silenciar micrófono"} className={muted ? "grid h-16 w-16 place-items-center rounded-full bg-secondary" : "spot-pulse grid h-16 w-16 place-items-center rounded-full bg-spot-gradient shadow-glow"}><Mic size={26} /></button>
        ) : (
          <Button onClick={() => { setHand(!hand); toast.success(hand ? "Has bajado la mano" : "Has pedido la palabra (demostración)"); if (!hand) setTimeout(() => { setSpeaking(true); toast.success("Te han dado la palabra (demostración)"); }, 2000); }} variant={hand ? "secondary" : "primary"}><Mic size={18} />{hand ? "Esperando turno…" : "Pedir la palabra"}</Button>
        )}
        {speaking && <Button variant="outline" onClick={() => { setSpeaking(false); setHand(false); setMuted(true); }}>Volver a escuchar</Button>}
      </footer>
    </div>
  );
}

/* ---------- Comunidades de voz ---------- */
type CommunityView = { key: string; id: string | null; name: string; topic: string; city: string; members: number | null; live: number; joined: boolean; mine: boolean; sample: boolean; local: boolean; img: string };
const SAMPLE_COMMUNITIES = [
  { name: "Música en directo", topic: "Música", members: 12400, live: 3 },
  { name: "Gastronomía local", topic: "Comida", members: 8100, live: 1 },
  { name: "Deporte y quedadas", topic: "Planes", members: 5700, live: 0 },
  { name: "Cultura y barrio", topic: "Algo que contar", members: 3900, live: 2 },
];
const fmtK = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1).replace(".", ",").replace(",0", "")}K` : String(n));
const threadOf = (c: CommunityView) => (c.id ? `group:${c.id}` : `group:${c.name}`);

/** Crear una comunidad: nombre (un título), tema y su presentación con tu voz. */
function CreateCommunity({ onCreated }: { onCreated: (c: CommunityView) => void }) {
  const me = useMe();
  const cloud = useCloud();
  const [name, setName] = useState("");
  const [topic, setTopic] = useState<string>(TOPICS[0][0]);
  const [clip, setClip] = useState<VoiceClip | null>(null);
  const [busy, setBusy] = useState(false);
  const clean = name.trim().replace(/\s+/g, " ");
  const ok = clean.length >= 3 && clean.length <= 40 && !!clip && !busy;
  const create = async () => {
    if (!ok || !clip) return;
    const uid = cloudUid();
    if (!uid) {
      if (localNameTaken(clean)) { toast.error("Ya tienes una comunidad con ese nombre."); return; }
      const c = addLocalCommunity({ name: clean, topic, city: me.city });
      addVoiceNote({ threadId: `group:${c.id}`, clip: detachClip(clip) });
      toast.success("¡Comunidad creada en este móvil!");
      onCreated({ key: c.id, id: c.id, name: c.name, topic: c.topic, city: c.city, members: 1, live: 0, joined: true, mine: true, sample: false, local: true, img: topicImg(c.topic) });
      return;
    }
    setBusy(true);
    try {
      const id = await api.createCommunity(db(), uid, { name: clean, topic, city: me.city });
      addVoiceNote({ threadId: `group:${id}`, clip: detachClip(clip) });
      toast.success("¡Comunidad creada!");
      onCreated({ key: id, id, name: clean, topic, city: me.city, members: 1, live: 0, joined: true, mine: true, sample: false, local: false, img: topicImg(topic) });
    } catch (e) {
      toast.error(e instanceof api.CloudError && e.code === "name_taken" ? "Ya existe una comunidad con ese nombre. Prueba otro." : cloudErrorText(e));
      setBusy(false);
    }
  };
  return (
    <div>
      <label className="block text-sm font-semibold" htmlFor="comunidad-nombre">Nombre de la comunidad</label>
      <input id="comunidad-nombre" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder="Ej.: Runners de Triana" className="mt-2 h-12 w-full rounded-xl border border-border bg-card px-4 text-base outline-none focus:border-primary" />
      <p className="mb-2 mt-4 text-sm font-semibold">Tema</p>
      <div className="flex flex-wrap gap-2">{TOPICS.map(([t, I]) => <button key={t} type="button" onClick={() => setTopic(t)} aria-pressed={topic === t} className={"flex min-h-10 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold " + (topic === t ? "spot-active-pill border-transparent" : "border-border bg-card text-muted-foreground")}><I size={14} />{t}</button>)}</div>
      <p className="mt-5 text-sm font-semibold">Preséntala con tu voz</p>
      <p className="text-xs text-muted-foreground">Cuenta de qué va y a quién buscas. Será la primera voz de la comunidad.</p>
      <VoiceRecordTile maxSeconds={60} onChange={setClip} idleText="Grabar presentación" />
      <Button className="mt-4 w-full" disabled={!ok} onClick={() => void create()}>{busy ? <Loader2 size={16} className="animate-spin" /> : <Users size={16} />}Crear comunidad</Button>
      {!cloud.on && <p className="mt-2 text-center text-2xs text-muted-foreground">Sin cuenta, la comunidad se guarda en este móvil.</p>}
    </div>
  );
}

function CommunityMembers({ c }: { c: CommunityView }) {
  const { demo } = useStore();
  const me = useMe();
  const [list, setList] = useState<api.ProfileRow[] | null>(null);
  const [person, setPerson] = useState<api.ProfileRow | null>(null);
  useEffect(() => { if (!c.id || c.local) return; let alive = true; api.fetchCommunityMembers(db(), c.id).then((l) => { if (alive) setList(l); }).catch(() => { if (alive) setList([]); }); return () => { alive = false; }; }, [c.id, c.local]);
  if (c.sample || c.local) {
    const names = c.sample && demo ? ["Laura · Admin", "Carlos", "Marta", "Sergio"] : [];
    return <div className="mt-4 space-y-2">
      {c.joined && <div className="flex items-center gap-3 rounded-xl bg-card p-3"><MeAvatar className="h-10 w-10 text-sm" /><span className="flex-1 text-sm">{me.name} · tú</span></div>}
      {names.map((m) => <div key={m} className="flex items-center gap-3 rounded-xl bg-card p-3"><span className="grid h-10 w-10 place-items-center rounded-full bg-spot-gradient font-bold">{m[0]}</span><span className="flex-1 text-sm">{m} <ShieldCheck size={13} className="inline text-primary" /></span></div>)}
      {!c.joined && !names.length && <p className="py-8 text-center text-sm text-muted-foreground">Únete para aparecer aquí.</p>}
    </div>;
  }
  return <div className="mt-4 space-y-2">
    {list === null && <div className="grid place-items-center py-8"><Loader2 className="animate-spin text-primary" size={22} /></div>}
    {list?.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Aún no hay nadie.</p>}
    {list?.map((p) => <div key={p.id} className="flex items-center gap-3 rounded-xl bg-card p-3"><button type="button" onClick={() => setPerson(p)} className="flex min-w-0 flex-1 items-center gap-3 text-left"><PersonAvatar p={p} className="h-10 w-10 text-sm" /><span className="min-w-0"><strong className="block truncate text-sm">{p.display_name || `@${p.username}`}</strong><small className="text-muted-foreground">@{p.username}</small></span></button><FollowButton id={p.id} /></div>)}
    {person && <AuthorProfile name={person.display_name || person.username} id={person.id} avatar={fileUrl(person.avatar_path)} onClose={() => setPerson(null)} />}
  </div>;
}

function CommunitySpots({ c }: { c: CommunityView }) {
  const { demo } = useStore();
  const me = useMe();
  const cloud = useCloud();
  const [spots, setSpots] = useState<MySpot[] | null>(null);
  const [open, setOpen] = useState<SpotData | null>(null);
  useEffect(() => { if (!cloud.on) return; let alive = true; setSpots(null); fetchTopicSpots(c.topic, c.sample ? undefined : c.city).then((l) => { if (alive) setSpots(l); }).catch(() => { if (alive) setSpots([]); }); return () => { alive = false; }; }, [cloud.on, c.topic, c.city, c.sample]);
  if (!cloud.on) return demo && c.sample
    ? <div className="mt-4"><div className="grid grid-cols-3 gap-1">{[festival, stage, beach, sevilleNight, valenciaSunset, festival].map((img, i) => <span key={i} className="relative"><img src={img} alt="Spot de ejemplo" loading="lazy" className="aspect-square w-full rounded-lg object-cover" /></span>)}</div><p className="mt-2 text-2xs text-muted-foreground">Spots de ejemplo</p></div>
    : <p className="py-8 text-center text-sm text-muted-foreground">Aquí saldrán los Spots de «{c.topic}» cuando entres con tu cuenta.</p>;
  return <div className="mt-4">
    {spots === null && <div className="grid place-items-center py-8"><Loader2 className="animate-spin text-primary" size={22} /></div>}
    {spots?.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Aún no hay Spots de «{c.topic}»{c.city && !c.sample ? ` en ${c.city}` : ""}. Publica el primero con ese tema.</p>}
    <div className="grid grid-cols-3 gap-1">{spots?.map((m) => { const d = spotData(m, me.name); return <button key={m.id} onClick={() => setOpen(d)} aria-label={`Escuchar ${m.title}`} className="relative overflow-hidden rounded-lg">{d.img ? <img src={d.img} alt="" loading="lazy" className="aspect-square w-full object-cover" /> : <span className="grid aspect-square w-full place-items-center bg-spot-surface text-primary"><Music size={20} /></span>}<span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-background/90 to-transparent px-1.5 pb-1 pt-4 text-left text-3xs">{m.title}</span></button>; })}</div>
    {open && <SpotDetail s={open} onClose={() => setOpen(null)} onAuthor={() => setOpen(null)} />}
  </div>;
}

export function Communities({ onBack }: { onBack: () => void }) {
  const { demo } = useStore();
  const cloud = useCloud();
  const local = useLocalGatherings();
  const [rows, setRows] = useState<api.CommunityRow[] | null>(null);
  const [error, setError] = useState(false);
  const [open, setOpen] = useState<CommunityView | null>(null);
  const [room, setRoom] = useState<string | null>(null);
  const [tab, setTab] = useState<"Descubrir" | "Mis comunidades">("Descubrir");
  const [inner, setInner] = useState<"Voces" | "Salas" | "Spots" | "Miembros">("Voces");
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => { if (!cloud.on) return; api.fetchCommunities(db()).then((l) => { setRows(l); setError(false); }).catch(() => setError(true)); }, [cloud.on]);
  useEffect(() => { load(); }, [load]);

  const all: CommunityView[] = useMemo(() => {
    if (cloud.on) return (rows ?? []).map((r) => ({ key: r.id, id: r.id, name: r.name, topic: r.topic, city: r.city, members: r.members, live: 0, joined: r.joined, mine: r.mine, sample: false, local: false, img: topicImg(r.topic) }));
    const mine = local.communities.map((c): CommunityView => ({ key: c.id, id: c.id, name: c.name, topic: c.topic, city: c.city, members: 1, live: 0, joined: local.joined.includes(c.id), mine: true, sample: false, local: true, img: topicImg(c.topic) }));
    const samples = SAMPLE_COMMUNITIES.map((c, i): CommunityView => ({ key: `ejemplo:${c.name}`, id: null, name: c.name, topic: c.topic, city: "", members: c.members, live: c.live, joined: local.joined.includes(`ejemplo:${c.name}`), mine: false, sample: true, local: false, img: [stage, festival, beach, sevilleNight][i % 4]! }));
    return [...mine, ...samples];
  }, [cloud.on, rows, local]);
  const current = open ? all.find((c) => c.key === open.key) ?? open : null;
  const toggleJoin = async (c: CommunityView) => {
    const uid = cloudUid();
    if (c.local || c.sample || !uid || !c.id) { toggleLocalJoined(c.key); toast.success(c.joined ? "Has salido de la comunidad" : "Te has unido a la comunidad"); return; }
    setBusy(true);
    try { await api.setCommunityMember(db(), uid, c.id, !c.joined); toast.success(c.joined ? "Has salido de la comunidad" : "Te has unido a la comunidad"); load(); }
    catch (e) { toast.error(cloudErrorText(e)); }
    finally { setBusy(false); }
  };
  const membersText = (c: CommunityView) => c.sample ? (demo ? `${fmtK(c.members ?? 0)} miembros${c.live > 0 ? ` · ${c.live} en directo` : ""}` : "Comunidad de ejemplo") : `${c.members ?? 1} ${c.members === 1 ? "miembro" : "miembros"}${c.city ? ` · ${c.city}` : ""}${c.local ? " · en este móvil" : ""}`;

  if (creating) return <Shell title="Nueva comunidad" onBack={() => setCreating(false)}><CreateCommunity onCreated={(c) => { setCreating(false); setTab("Mis comunidades"); load(); setInner("Voces"); setOpen(c); }} /></Shell>;

  if (current) {
    const c = current;
    const Icon = topicIcon(c.topic);
    return (
      <Shell title={c.name} onBack={() => setOpen(null)}>
        <div className="relative overflow-hidden rounded-2xl">
          <img src={c.img} alt="" className="h-28 w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent" />
        </div>
        <div className="relative -mt-8 flex items-end gap-3 px-2">
          <span className="grid h-16 w-16 place-items-center rounded-2xl border-4 border-background bg-spot-gradient"><Icon size={26} /></span>
          <div className="min-w-0 flex-1 pb-1"><strong className="block truncate">{c.name}</strong><small className="text-muted-foreground">{c.topic} · {membersText(c)}</small></div>
        </div>
        <Button className="mt-4 w-full" variant={c.joined ? "secondary" : "primary"} disabled={busy} onClick={() => void toggleJoin(c)}>
          {busy ? <Loader2 size={16} className="animate-spin" /> : null}{c.joined ? "Miembro ✓ · Salir" : "Unirme"}
        </Button>
        <div className="mt-5 grid grid-cols-4 gap-1 rounded-full bg-secondary p-1">
          {(["Voces", "Salas", "Spots", "Miembros"] as const).map((t) => <button key={t} onClick={() => setInner(t)} className={inner === t ? "rounded-full bg-primary py-1.5 text-xs font-semibold text-primary-foreground" : "py-1.5 text-xs text-muted-foreground"}>{t}</button>)}
        </div>
        {inner === "Voces" && <GroupVoices threadId={threadOf(c)} title="Conversación del grupo" root={{ name: c.name, durationMs: 0 }} seedNames={c.sample && demo ? ["Laura", "Carlos", "Marta", "Sergio"] : []} />}
        {inner === "Salas" && <div className="mt-4 space-y-2">
          <p className="text-2xs text-muted-foreground">Salas en directo: demostración, el audio en directo llegará pronto.</p>
          {["Quedada de esta noche", "Recomendaciones del barrio"].map((r, i) => (
            <button key={r} onClick={() => i === 0 ? setRoom(r) : toast("Sala de demostración: los avisos de salas llegarán con el audio en directo.")} className="flex w-full items-center gap-3 rounded-xl border border-border bg-card p-4 text-left hover:border-primary">
              <span className={i === 0 ? "spot-pulse grid h-10 w-10 place-items-center rounded-full bg-live/20 text-live" : "grid h-10 w-10 place-items-center rounded-full bg-secondary text-primary"}><Radio size={18} /></span>
              <span className="flex-1"><strong className="block text-sm">{r}</strong><small className="text-muted-foreground">{i === 0 ? (demo ? "En directo · 24 escuchando" : "Sala de demostración") : "Programada · 20:00 · demostración"}</small></span>
              <span className="text-xs text-primary">{i === 0 ? "Entrar" : "Ver"}</span>
            </button>
          ))}
        </div>}
        {inner === "Spots" && <CommunitySpots c={c} />}
        {inner === "Miembros" && <CommunityMembers c={c} />}
        {room && <LiveRoom room={room} onLeave={() => setRoom(null)} />}
      </Shell>
    );
  }

  const list = tab === "Descubrir" ? all : all.filter((c) => c.joined || c.mine);
  return (
    <Shell title="Comunidades" onBack={onBack}>
      <div className="grid grid-cols-2 gap-1 rounded-full bg-secondary p-1">
        {(["Descubrir", "Mis comunidades"] as const).map((t) => <button key={t} onClick={() => setTab(t)} className={tab === t ? "rounded-full bg-primary py-1.5 text-xs font-semibold text-primary-foreground" : "py-1.5 text-xs text-muted-foreground"}>{t}</button>)}
      </div>
      <div className="mt-4 space-y-2">
        {cloud.on && rows === null && !error && <div className="grid place-items-center py-10"><Loader2 className="animate-spin text-primary" size={24} /></div>}
        {cloud.on && error && rows === null && <div className="py-8 text-center"><WifiOff className="mx-auto text-muted-foreground" size={24} /><p className="mt-2 text-sm text-muted-foreground">No se pudieron cargar las comunidades.</p><Button variant="secondary" size="sm" className="mt-3" onClick={load}>Reintentar</Button></div>}
        {(!cloud.on || rows !== null) && list.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">{tab === "Descubrir" ? "Aún no hay comunidades. Crea la primera con tu voz." : "Aún no te has unido a ninguna comunidad."}</p>}
        {list.map((c) => {
          const Icon = topicIcon(c.topic);
          return (
            <button key={c.key} onClick={() => { setOpen(c); setInner("Voces"); }} className="flex w-full items-center gap-3 rounded-xl border border-border bg-card p-4 text-left hover:border-primary">
              <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl"><img src={c.img} alt="" className="h-full w-full object-cover" /><span className="absolute bottom-0.5 right-0.5 grid h-5 w-5 place-items-center rounded-full bg-background/80 text-primary"><Icon size={11} /></span></span>
              <span className="min-w-0 flex-1"><strong className="block truncate text-sm">{c.name}</strong><small className="text-muted-foreground">{membersText(c)}</small></span>
              {demo && c.sample && c.live > 0 && <span className="rounded-md bg-live px-2 py-1 text-3xs font-bold">EN DIRECTO</span>}
              {(c.joined || c.mine) && <CheckCircle2 size={18} className="shrink-0 text-primary" />}
            </button>
          );
        })}
      </div>
      <Button className="mt-5 w-full" onClick={() => setCreating(true)}><Mic size={18} />Crear comunidad con tu voz</Button>
    </Shell>
  );
}

/* ---------- Eventos locales ---------- */
type EventView = { key: string; id: string | null; title: string; place: string; city: string; startsAt: string | null; when: string; filter: "Hoy" | "Fin de semana" | "Próximos"; img: string; by: string; byAvatar: string | null; byId: string | null; going: number; attending: boolean; mine: boolean; sample: boolean; local: boolean; flyer: ThreadNote | null; files: (string | null)[] };
const SAMPLE_EVENTS = [
  { title: "Concierto flamenco en Triana", when: "Hoy · 21:00", place: "Sevilla · Triana", filter: "Hoy", img: stage, by: "Peña Flamenca Triana" },
  { title: "Mercado de productores", when: "Sábado · 10:00", place: "Sevilla · Alameda", filter: "Fin de semana", img: valenciaSunset, by: "Asociación Alameda Viva" },
  { title: "Ruta al atardecer", when: "Domingo · 19:30", place: "Valencia · Malvarrosa", filter: "Fin de semana", img: beach, by: "Marta · Runners Valencia" },
  { title: "Feria de barrio", when: "12 de octubre", place: "Sevilla · Macarena", filter: "Próximos", img: festival, by: "Vecinos de la Macarena" },
] as const;
const DAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
/** «Hoy · 21:00», «Mañana · 19:30», «Sábado · 10:00» o «12 de octubre · 20:00», y en qué pestaña cae. */
function whenOf(iso: string): { when: string; filter: EventView["filter"] } {
  const d = new Date(iso), now = new Date();
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(d) - day(now)) / 86400000);
  const hm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  const label = diff <= 0 ? "Hoy" : diff === 1 ? "Mañana" : diff < 7 ? DAYS[d.getDay()]! : `${d.getDate()} de ${MONTHS[d.getMonth()]}`;
  const weekend = diff < 7 && (d.getDay() === 6 || d.getDay() === 0 || (d.getDay() === 5 && d.getHours() >= 18));
  return { when: `${label} · ${hm}`, filter: diff <= 0 ? "Hoy" : weekend ? "Fin de semana" : "Próximos" };
}
const flyerNote = (id: string, author: { name: string; avatar?: string | null | undefined; id?: string | null | undefined; mine?: boolean }, a: { src?: string | null | undefined; durationMs: number; peaks: number[]; createdAt: number; sample?: boolean }): ThreadNote => ({
  id: `flyer:${id}`, threadId: `event:${id}`, parentId: null, author: { name: author.name, avatar: author.avatar ?? undefined, id: author.id ?? undefined, mine: author.mine }, createdAt: a.createdAt,
  durationMs: a.durationMs, peaks: a.peaks.length ? a.peaks : sampleThread(`event-pres:${id}`, [{ key: "p", name: author.name, minsAgo: 180, dur: "0:22", likes: 0 }])[0]!.peaks, likes: 0, liked: false, replies: 0,
  ...(a.src ? { src: a.src } : {}), ...(a.sample ? { sample: true } : {}),
});

/** Audio-flyer de un evento creado en este móvil (la primera voz de su hilo de flyer). */
function useLocalFlyer(eventId: string | null) {
  const notes = useThread(eventId ? `evento-flyer:${eventId}` : "");
  return notes[0] ?? null;
}

/** Crear un evento: audio-flyer con tu voz, título, cuándo y dónde (y una foto si quieres, con tu cuenta). */
function CreateEvent({ onCreated }: { onCreated: (key: string) => void }) {
  const me = useMe();
  const cloud = useCloud();
  const [clip, setClip] = useState<VoiceClip | null>(null);
  const [title, setTitle] = useState("");
  const [place, setPlace] = useState("");
  const [at, setAt] = useState(() => { const d = new Date(Date.now() + 3 * 3600000); d.setMinutes(0, 0, 0); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); });
  const [photo, setPhoto] = useState<{ blob: Blob; url: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement | null>(null);
  useEffect(() => () => { if (photo) URL.revokeObjectURL(photo.url); }, [photo]);
  const startsAt = at ? new Date(at) : null;
  const dateOk = !!startsAt && !Number.isNaN(startsAt.getTime()) && startsAt.getTime() > Date.now() - 3600000 && startsAt.getTime() < Date.now() + 365 * 86400000;
  const ok = !!clip && title.trim().length >= 3 && place.trim().length >= 2 && dateOk && !busy;
  const publish = async () => {
    if (!ok || !clip || !startsAt) return;
    const uid = cloudUid();
    if (!uid) {
      const e = addLocalEvent({ title: title.trim(), place: place.trim(), city: me.city, startsAt: startsAt.toISOString() });
      addVoiceNote({ threadId: `evento-flyer:${e.id}`, clip: detachClip(clip) });
      toast.success("¡Evento creado en este móvil!");
      onCreated(e.id); return;
    }
    setBusy(true);
    try {
      const r = await api.publishEvent(db(), uid, { title, place, city: me.city, startsAt: startsAt.toISOString(), audio: clip.blob, audioMime: clip.mimeType, durationMs: clip.durationMs, peaks: clip.peaks, photo: photo?.blob });
      toast.success("¡Evento publicado!");
      onCreated(r.id);
    } catch (e) { toast.error(cloudErrorText(e)); setBusy(false); }
  };
  return (
    <div>
      <p className="text-sm font-semibold">Tu audio-flyer</p>
      <p className="text-xs text-muted-foreground">Cuenta qué es, dónde y cuándo, con tu voz (hasta 1 minuto).</p>
      <VoiceRecordTile maxSeconds={60} onChange={setClip} idleText="Grabar audio-flyer" />
      <label className="mt-2 block text-sm font-semibold" htmlFor="evento-titulo">Título</label>
      <input id="evento-titulo" value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} placeholder="Ej.: Quedada de guitarras" className="mt-2 h-12 w-full rounded-xl border border-border bg-card px-4 text-base outline-none focus:border-primary" />
      <label className="mt-3 block text-sm font-semibold" htmlFor="evento-cuando">Cuándo<input id="evento-cuando" type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} className="mt-2 h-12 w-full rounded-xl border border-border bg-card px-3 text-base font-normal outline-none focus:border-primary" /></label>
      <label className="mt-3 block text-sm font-semibold" htmlFor="evento-donde">Dónde<input id="evento-donde" value={place} maxLength={80} onChange={(e) => setPlace(e.target.value)} placeholder="Ej.: Alameda de Hércules" className="mt-2 h-12 w-full rounded-xl border border-border bg-card px-4 text-base font-normal outline-none focus:border-primary" /></label>
      {!dateOk && at && <p className="mt-1 text-xs text-live">Elige una fecha a partir de ahora y en menos de un año.</p>}
      {cloud.on && <>
        <input ref={file} type="file" accept="image/*" className="hidden" aria-label="Elegir una foto del evento" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (!f) return; if (!f.type.startsWith("image/") || f.size > 15 * 1024 * 1024) { toast.error("Elige una foto de hasta 15 MB."); return; } setPhoto({ blob: f, url: URL.createObjectURL(f) }); }} />
        <button type="button" onClick={() => file.current?.click()} className="mt-3 flex w-full items-center gap-3 rounded-xl border border-dashed border-border p-3 text-left text-sm text-muted-foreground">{photo ? <img src={photo.url} alt="" className="h-12 w-12 rounded-lg object-cover" /> : <span className="grid h-12 w-12 place-items-center rounded-lg bg-secondary text-primary"><Camera size={18} /></span>}{photo ? "Cambiar la foto" : "Añadir una foto (opcional)"}</button>
      </>}
      <Button className="mt-4 w-full" disabled={!ok} onClick={() => void publish()}>{busy ? <Loader2 size={16} className="animate-spin" /> : <Calendar size={16} />}Publicar evento</Button>
      <p className="mt-2 text-center text-2xs text-muted-foreground">{cloud.on ? `Aparecerá en Eventos para todo el mundo · ${me.city || "tu ciudad"}` : "Sin cuenta, el evento se guarda en este móvil."}</p>
    </div>
  );
}

function EventDetail({ e, onBack, onToggle, onDelete, busy }: { e: EventView; onBack: () => void; onToggle: () => void; onDelete?: (() => void) | undefined; busy: boolean }) {
  const localFlyer = useLocalFlyer(e.local ? e.id : null);
  const flyer = e.local ? localFlyer : e.flyer;
  const share = () => void shareLink({ title: e.title, text: `${e.title} · ${e.when} · ${e.place}`, url: e.sample || e.local ? null : appUrl() });
  return (
    <div className="fixed inset-0 z-[60] mx-auto flex max-w-[520px] flex-col overflow-hidden bg-black">
      <div className="relative w-full bg-black" style={{ aspectRatio: "9/14", maxHeight: "60vh" }}>
        <img src={e.img} alt={e.title} className="h-full w-full object-cover" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-black/20" />
        <button onClick={onBack} aria-label="Volver" className="absolute left-3 grid h-10 w-10 place-items-center rounded-full bg-black/50 text-white backdrop-blur-sm" style={{ top: "var(--safe-header)" }}><ChevronLeft size={24} /></button>
        <div className="absolute bottom-24 right-3 flex flex-col items-center gap-5">
          <button onClick={onToggle} disabled={busy} aria-pressed={e.attending} aria-label={e.attending ? "Ya no asistiré" : "Asistiré"} className="flex flex-col items-center gap-1">
            <Heart size={28} className={e.attending ? "text-accent" : "text-white"} fill={e.attending ? "currentColor" : "none"} />
            <span className="text-xs font-bold text-white">{e.going}</span>
          </button>
          <button onClick={share} aria-label="Compartir" className="flex flex-col items-center gap-1"><Share2 size={26} className="text-white" /><span className="text-xs font-bold text-white">Enviar</span></button>
          {onDelete && <button onClick={onDelete} aria-label="Borrar mi evento" className="flex flex-col items-center gap-1"><Trash2 size={24} className="text-white" /><span className="text-xs font-bold text-white">Borrar</span></button>}
        </div>
        <div className="absolute bottom-5 left-3"><div className="mb-1 flex items-center gap-1.5 rounded-full bg-black/55 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm" style={{ width: "fit-content" }}><MapPin size={12} />{e.place}</div></div>
      </div>
      <div className="flex-1 overflow-y-auto bg-background px-4 pb-[calc(7rem+env(safe-area-inset-bottom))] pt-4">
        <p className="flex items-center gap-2 text-xs text-primary"><Calendar size={13} />{e.when}</p>
        <h2 className="mt-1 text-2xl font-bold">{e.title}</h2>
        <p className="text-sm text-muted-foreground">{e.place}{e.sample ? " · evento de ejemplo" : e.local ? " · en este móvil" : ""}</p>
        <p className="mt-3 text-xs text-muted-foreground">{e.going} {e.going === 1 ? "persona va" : "personas van"}{e.attending ? " · tú también" : ""}</p>
        <div className="mt-4">{flyer ? <VoiceItem note={{ ...flyer, liked: false, replies: 0, author: { ...flyer.author, name: flyer.author.mine ? flyer.author.name : e.by } }} social={false} right={<span className="text-2xs text-muted-foreground">Audio-flyer</span>} /> : <p className="text-xs text-muted-foreground">Sin audio-flyer.</p>}</div>
        <GroupVoices threadId={e.id ? `event:${e.id}` : `event:${e.title}`} title="Preguntas y voces de quien va" root={{ name: e.by, durationMs: flyer?.durationMs ?? 0 }} seedNames={e.sample ? ["Rocío", "Manu", "Lucía"] : []} />
      </div>
      <div className="absolute inset-x-0 bottom-0 border-t border-border bg-background/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-sm">
        <div className="grid grid-cols-2 gap-2">
          <Button variant={e.attending ? "secondary" : "default"} disabled={busy} onClick={onToggle}>{busy ? <Loader2 size={16} className="animate-spin" /> : null}{e.attending ? "Ya asistes" : "Asistiré"}</Button>
          <Button variant="secondary" onClick={share}>Compartir</Button>
        </div>
      </div>
    </div>
  );
}

export function Events({ onBack, create = false }: { onBack: () => void; create?: boolean }) {
  const { demo } = useStore();
  const me = useMe();
  const cloud = useCloud();
  const local = useLocalGatherings();
  const [filter, setFilter] = useState<EventView["filter"]>("Hoy");
  const [rows, setRows] = useState<api.EventRow[] | null>(null);
  const [error, setError] = useState(false);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [creating, setCreating] = useState(create);
  const [busy, setBusy] = useState(false);
  const [sampleGoing, setSampleGoing] = useState<string[]>([]);
  const load = useCallback(() => { if (!cloud.on) return; api.fetchEvents(db()).then((l) => { setRows(l); setError(false); }).catch(() => setError(true)); }, [cloud.on]);
  useEffect(() => { load(); }, [load]);

  const all: EventView[] = useMemo(() => {
    if (cloud.on) return (rows ?? []).map((r): EventView => ({ key: r.id, id: r.id, title: r.title, place: r.place, city: r.city, startsAt: r.starts_at, ...whenOf(r.starts_at), img: fileUrl(r.media_path) ?? stage, by: r.author_name || `@${r.author_username}`, byAvatar: fileUrl(r.author_avatar), byId: r.author_id, going: r.going, attending: r.attending, mine: r.mine, sample: false, local: false, files: [r.audio_path, r.media_path],
      flyer: flyerNote(r.id, { name: r.author_name || `@${r.author_username}`, avatar: fileUrl(r.author_avatar), id: r.author_id, mine: r.mine }, { src: fileUrl(r.audio_path), durationMs: r.duration_ms, peaks: r.peaks ?? [], createdAt: Date.parse(r.created_at) }) }));
    const mine = local.events.filter((e) => Date.parse(e.startsAt) > Date.now() - 12 * 3600000).map((e): EventView => ({ key: e.id, id: e.id, title: e.title, place: e.place, city: e.city, startsAt: e.startsAt, ...whenOf(e.startsAt), img: stage, by: me.name, byAvatar: me.avatar, byId: null, going: local.going.includes(e.id) ? 1 : 0, attending: local.going.includes(e.id), mine: true, sample: false, local: true, files: [], flyer: null }));
    const samples = SAMPLE_EVENTS.map((e): EventView => {
      const going = sampleGoing.includes(e.title);
      return { key: `ejemplo:${e.title}`, id: null, title: e.title, place: e.place, city: "", startsAt: null, when: e.when, filter: e.filter, img: e.img, by: e.by, byAvatar: e.img, byId: null, going: (demo ? 48 : 0) + (going ? 1 : 0), attending: going, mine: false, sample: true, local: false, files: [],
        flyer: flyerNote(`ejemplo-${e.title}`, { name: e.by, avatar: e.img }, { durationMs: 22000, peaks: [], createdAt: Date.now() - 3 * 3600000, sample: true }) };
    });
    return [...mine, ...samples];
  }, [cloud.on, rows, local, demo, me.name, me.avatar, sampleGoing]);
  const current = openKey ? all.find((e) => e.key === openKey) ?? null : null;
  const list = all.filter((e) => e.filter === filter);
  const toggle = async (e: EventView) => {
    if (e.sample) { setSampleGoing((g) => (g.includes(e.title) ? g.filter((t) => t !== e.title) : [...g, e.title])); toast.success(e.attending ? "Has cancelado tu asistencia" : "¡Asistencia confirmada!"); return; }
    if (e.local || !e.id) { toggleLocalGoing(e.key); toast.success(e.attending ? "Has cancelado tu asistencia" : "¡Asistencia confirmada!"); return; }
    const uid = cloudUid();
    if (!uid) return;
    setBusy(true);
    try { await api.setAttending(db(), uid, e.id, !e.attending); toast.success(e.attending ? "Has cancelado tu asistencia" : "¡Asistencia confirmada!"); load(); }
    catch (err) { toast.error(cloudErrorText(err)); }
    finally { setBusy(false); }
  };
  const remove = async (e: EventView) => {
    if (e.local && e.id) { removeLocalEvent(e.id); setOpenKey(null); toast("Evento borrado"); return; }
    if (!e.id) return;
    setBusy(true);
    try { await api.deleteEvent(db(), e.id, e.files); setOpenKey(null); toast("Evento borrado"); load(); }
    catch (err) { toast.error(cloudErrorText(err)); }
    finally { setBusy(false); }
  };

  if (current) return <EventDetail e={current} busy={busy} onBack={() => setOpenKey(null)} onToggle={() => void toggle(current)} onDelete={current.mine ? () => void remove(current) : undefined} />;
  if (creating) return <Shell title="Crear evento" onBack={() => setCreating(false)}><CreateEvent onCreated={(key) => { setCreating(false); load(); const e = all.find((x) => x.key === key); if (e) setFilter(e.filter); setOpenKey(key); }} /></Shell>;
  return (
    <Shell title="Eventos cerca" onBack={onBack}>
      <Button className="mb-3 w-full" onClick={() => setCreating(true)}><Mic size={16} />Crear evento con tu voz</Button>
      <div className="grid grid-cols-3 gap-1 rounded-xl bg-secondary p-1">
        {(["Hoy", "Fin de semana", "Próximos"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={filter === f ? "rounded-lg bg-primary px-1 py-2 text-xs font-semibold text-primary-foreground" : "px-1 py-2 text-xs text-muted-foreground"}>{f}</button>
        ))}
      </div>
      <div className="mt-4 space-y-3">
        {cloud.on && rows === null && !error && <div className="grid place-items-center py-10"><Loader2 className="animate-spin text-primary" size={24} /></div>}
        {cloud.on && error && rows === null && <div className="py-8 text-center"><WifiOff className="mx-auto text-muted-foreground" size={24} /><p className="mt-2 text-sm text-muted-foreground">No se pudieron cargar los eventos.</p><Button variant="secondary" size="sm" className="mt-3" onClick={load}>Reintentar</Button></div>}
        {(!cloud.on || rows !== null) && list.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">No hay eventos en este periodo. ¡Crea el primero con tu voz!</p>}
        {list.map((e) => (
          <article key={e.key} className="overflow-hidden rounded-2xl border border-border bg-card">
            <button className="block w-full text-left" onClick={() => setOpenKey(e.key)}><img src={e.img} alt={e.title} loading="lazy" className="aspect-[16/9] w-full object-cover" /></button>
            <div className="p-4">
              <p className="flex items-center gap-2 text-xs text-primary"><Calendar size={13} />{e.when}</p>
              <button onClick={() => setOpenKey(e.key)} className="mt-1 text-left font-semibold">{e.title} ›</button>
              <p className="text-xs text-muted-foreground">{e.place}{e.sample && !demo ? " · ejemplo" : e.local ? " · en este móvil" : ""}</p>
              <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">{e.byAvatar ? <img src={e.byAvatar} alt="" className="h-7 w-7 rounded-full object-cover" /> : <span className="grid h-7 w-7 place-items-center rounded-full bg-spot-gradient text-3xs font-bold text-foreground">{(e.by[0] ?? "?").toUpperCase()}</span>}<span className="min-w-0 truncate"><strong className="text-foreground">{e.by}</strong> · organiza{e.going ? ` · ${e.going} van` : ""}</span></div>
              <Button className="mt-3 w-full" variant={e.attending ? "secondary" : "primary"} disabled={busy} onClick={() => void toggle(e)}>{e.attending ? "Ya asistes" : "Asistiré"}</Button>
            </div>
          </article>
        ))}
      </div>
    </Shell>
  );
}

/* ---------- Privacidad ---------- */
/**
 * Privacidad sin interruptores de mentira: lo que Spotly hace siempre con tus datos y accesos directos a lo que sí
 * puedes cambiar (bloqueos y denuncias, Incógnito, permisos del móvil, descargar o borrar tus datos en Ajustes).
 */
export function Privacy({ onBack }: { onBack: () => void }) {
  const app = useApp();
  const facts: [typeof MapPin, string, string][] = [
    [MapPin, "Tu ubicación, siempre aproximada", "Nadie ve tu dirección exacta: cada Spot lleva la zona que eliges al publicarlo, y puedes ocultarla."],
    [EyeOff, "Quién te escucha es privado", "Nadie ve la lista de quién escucha tus Spots; solo ves cuántas vistas tienen."],
    [Mic, "Tus chats de voz son privados", "Las notas de voz de un chat solo las oyen quienes están en él."],
    [ShieldCheck, "Bloquear es para los dos lados", "Si bloqueas a alguien, dejáis de veros y de oíros, y deja de seguirte."],
  ];
  const links: [typeof Users, string, string, () => void][] = [
    [Users, "Bloqueos y denuncias", "Personas bloqueadas y el estado de tus denuncias", () => app.open("seguridad")],
    [Eye, "Incógnito", "Publica como «Anónimo» con Incógnito de pago", () => app.open("incognito")],
    [ShieldCheck, "Permisos del móvil", "Micrófono, cámara, ubicación y avisos", () => app.open("permisos")],
  ];
  return (
    <Shell title="Privacidad" onBack={onBack}>
      <div className="space-y-2">
        {facts.map(([I, t, d]) => <div key={t} className="flex items-start gap-3 rounded-xl border border-border bg-card p-4"><I size={19} className="mt-0.5 shrink-0 text-primary" /><span><strong className="block text-sm">{t}</strong><small className="text-muted-foreground">{d}</small></span></div>)}
      </div>
      <div className="mt-4 divide-y divide-border rounded-xl border border-border bg-card px-4">
        {links.map(([I, t, d, go]) => <button key={t} onClick={go} className="flex w-full items-center gap-3 py-3 text-left"><I size={18} className="shrink-0 text-primary" /><span className="min-w-0 flex-1"><strong className="block text-sm">{t}</strong><small className="text-muted-foreground">{d}</small></span><span className="text-muted-foreground">›</span></button>)}
      </div>
      <p className="mt-4 text-xs text-muted-foreground">Para descargar todos tus datos o borrar tu cuenta, ve a Perfil › Ajustes › Cuenta y datos.</p>
    </Shell>
  );
}
