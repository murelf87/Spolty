import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Bell, Calendar, Compass, Download, Flame, Home, Mic, Plus, UserRound, Users } from "lucide-react";
import { Logo, SpotPin } from "@/components/spotly/Logo";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { ActivityView } from "@/components/spotly/Activity";
import { ExploreView } from "@/components/spotly/Explore";
import { ProfileView } from "@/components/spotly/Profile";
import { VoiceChats } from "@/components/spotly/VoiceChats";
import { Welcome, type Sheet } from "@/components/spotly/Extras";
import { Splash } from "@/components/spotly/Splash";
import { NewPassword } from "@/components/spotly/Auth";
import { Onboarding } from "@/components/spotly/Onboarding";
import { BoostFlow } from "@/components/spotly/BoostFlow";
import { Communities, Events, Privacy } from "@/components/spotly/Social";
import { AudioWallLive } from "@/components/spotly/AudioWallLive";
import { AppCtx, type AppActions } from "@/components/spotly/app-context";
import { HomeView, type MineSpot } from "@/components/spotly/Feed";
import { CreateSpot } from "@/components/spotly/CreateSpot";
import { Wallet, TxHistory } from "@/components/spotly/Credits";
import { Verification } from "@/components/spotly/Identity";
import { IncognitoBanner, IncognitoPublicProfile, IncognitoSheet } from "@/components/spotly/Incognito";
import { HotSpotView } from "@/components/spotly/HotSpots";
import { BusinessProfile, LocalDashboard } from "@/components/spotly/Local";
import { VoiceSearch } from "@/components/spotly/VoiceSearch";
import { OfflineBanner, PermissionsScreen } from "@/components/spotly/Status";
import { ProfilePromo, SuggestedPeople } from "@/components/spotly/PromoProfile";
import { SpainScreen } from "@/components/spotly/SpainMap";
import { PhotoWall } from "@/components/spotly/PhotoWall";
import { SafetyCenter } from "@/components/spotly/Safety";
import { getState, loadMe, setDemo, setIdentity, setIdTier, useStore } from "@/lib/store";
import { registerSW } from "@/lib/pwa";
import { enableDragScroll } from "@/lib/dragScroll";
import { supabase } from "@/integrations/supabase/client";
import { VoiceErrorToasts } from "@/components/spotly/VoiceThread";
import { stopAllVoices } from "@/lib/voice/player";
import { loadVoiceNotes } from "@/lib/voice/notes";
import { startCloud } from "@/lib/cloud";
import { SharedLink } from "@/components/spotly/SharedLink";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "Spotly — Tu ciudad, tu voz" },
    { name: "description", content: "Escucha y comparte lo que está pasando cerca de ti, en tiempo real." },
    { property: "og:title", content: "Spotly — Tu ciudad, tu voz" },
    { property: "og:description", content: "Personas reales, voces reales y lugares reales." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ]}),
  component: Index,
});

type Tab = "inicio" | "explorar" | "actividad" | "perfil";
const navItems: [Tab, typeof Home, string][] = [["inicio", Home, "Inicio"], ["explorar", Compass, "Explorar"], ["actividad", Bell, "Actividad"], ["perfil", UserRound, "Perfil"]];

export function Index() {
  const [tab, setTab] = useState<Tab>("inicio");
  const [creating, setCreating] = useState(false);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [hotId, setHotId] = useState<string | null>(null);
  const [bizId, setBizId] = useState<string | null>(null);
  const [incogPublic, setIncogPublic] = useState(false);
  const [photoPlace, setPhotoPlace] = useState<string | undefined>();
  const [splash, setSplash] = useState(true); // Splash siempre primero, nivel raíz
  const [welcome, setWelcome] = useState(true);
  const [authReady, setAuthReady] = useState(false); // true cuando Supabase ha respondido
  const [onb, setOnb] = useState(false);
  const [recovery, setRecovery] = useState(false);
  const [mine, setMine] = useState<MineSpot>(null);
  const [accountEmail, setAccountEmail] = useState<string | null>(null);
  useEffect(() => { window.scrollTo(0, 0); }, [tab]);
  /* Cambiar de pestaña, abrir otra pantalla o salir de un Spot/negocio corta el audio que sonara (una sola voz a la vez). */
  useEffect(() => { stopAllVoices(); }, [tab, sheet, hotId, bizId, creating]);
  const close = useCallback(() => setSheet(null), []);
  /** Navegación de escritorio: cierra cualquier pantalla abierta y cambia de pestaña o abre una hoja. */
  const goTo = (t: Tab | null, sh: Sheet = null) => { setSheet(sh); setHotId(null); setBizId(null); setIncogPublic(false); setCreating(false); if (t) setTab(t); };

  useEffect(() => {
    loadMe(); // tu nombre y tu foto guardados en este dispositivo
    void loadVoiceNotes(); // tus voces guardadas en este dispositivo
    const offCloud = startCloud(); // con sesión y la migración aplicada: Spots, voces, seguidores y chats en la nube
    registerSW();
    const offDrag = enableDragScroll();
    const off = () => { offDrag(); offCloud(); };
    const a = new URLSearchParams(window.location.search).get("accion");
    if (a === "crear") setCreating(true);
    if (a === "buscar") setSheet("buscar");
    return off;
  }, []);

  useEffect(() => {
    let active = true;
    void supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      if (data.user) { setAccountEmail(data.user.email ?? "Cuenta Apple"); setWelcome(false); if (!data.user.user_metadata?.['onboarded']) setOnb(true); }
      setAuthReady(true); // auth resuelta → el Splash ya puede cerrarse
    }).catch(() => { if (active) setAuthReady(true); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === "SIGNED_OUT") { stopAllVoices(); setDemo(false); setAccountEmail(null); setWelcome(true); setTab("inicio"); }
      else if (event === "PASSWORD_RECOVERY") { setRecovery(true); setWelcome(false); }
      else if ((event === "SIGNED_IN" || event === "USER_UPDATED") && session?.user) { setDemo(false); setAccountEmail(session.user.email ?? "Cuenta Apple"); setWelcome(false); if (event === "SIGNED_IN" && !session.user.user_metadata?.['onboarded']) setOnb(true); }
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  const actions = useMemo<AppActions>(() => ({
    open: (s) => { if (s === "fotos" || s === "ciudad") setPhotoPlace(undefined); setSheet(s); },
    openHot: (id) => setHotId(id),
    openBiz: (id) => setBizId(id),
    openIncognitoSpot: () => setIncogPublic(true),
    openPhotoWall: (place) => { setPhotoPlace(place); setSheet("fotos"); },
    goMap: () => { setSheet(null); setHotId(null); setBizId(null); setTab("explorar"); },
    create: () => setCreating(true),
  }), []);

  const content = tab === "inicio" ? <HomeView mine={mine} onBell={() => setTab("actividad")} />
    : tab === "explorar" ? <ExploreView onOpen={setSheet} mine={!!mine} />
    : tab === "actividad" ? <ActivityView />
    : <ProfileView onOpen={setSheet} accountEmail={accountEmail} />;

  return (
    <AppCtx.Provider value={actions}>
      <NavGradients />
      <DesktopSidebars tab={tab} goTo={goTo} onCreate={() => setCreating(true)} onOpenHot={(id) => setHotId(id)} onPlace={(c) => actions.openPhotoWall(c)} />
      {/* overflow-x-clip (no hidden): recorta lo que sobresale a los lados sin romper las cabeceras sticky. */}
      <div className="mx-auto min-h-screen w-full max-w-[520px] overflow-x-clip bg-background text-foreground shadow-2xl sm:border-x sm:border-border">
        {content}
        <nav className="fixed inset-x-0 bottom-0 z-30 mx-auto grid min-[1100px]:hidden h-[var(--nav-h)] max-w-[520px] grid-cols-5 items-center border-t border-border bg-background/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur" aria-label="Navegación principal">
          {navItems.slice(0, 2).map(([id, Icon, label], i) => <NavButton key={id} n={i + 1} on={tab === id} Icon={Icon} label={id === "explorar" ? "Mapa" : label} onClick={() => setTab(id)} />)}
          <button onClick={() => setCreating(true)} className="spot-create-button mx-auto grid h-14 w-14 -translate-y-3 place-items-center rounded-full" aria-label="Crear Spot" title="Crear Spot"><SpotPin size={25} /></button>
          {navItems.slice(2).map(([id, Icon, label], i) => <NavButton key={id} n={i + 3} on={tab === id && id !== "actividad"} Icon={id === "actividad" ? Mic : Icon} label={id === "actividad" ? "Chats" : label} onClick={() => id === "actividad" ? setSheet("chats") : setTab(id)} />)}
        </nav>

        <IncognitoBanner onOpen={() => setSheet("incognito")} />
        {creating && <CreateSpot onClose={() => setCreating(false)} onPublished={(m) => { setMine(m); setTab("inicio"); window.scrollTo(0, 0); }} />}

        {sheet === "wallet" && <Wallet onBack={close} onOpen={setSheet} />}
        {sheet === "historial" && <TxHistory onBack={close} />}
        {sheet === "chats" && <VoiceChats onBack={close} onAudioWall={() => setSheet("audio-wall")} />}
        {sheet === "audio-wall" && <AudioWallLive onBack={() => setSheet("chats")} />}
        {sheet === "verificacion" && <Verification onBack={close} />}
        {sheet === "local" && <LocalDashboard onBack={close} />}
        {sheet === "comunidades" && <Communities onBack={close} />}
        {sheet === "eventos" && <Events onBack={close} />}
        {sheet === "crear-evento" && <Events onBack={close} create />}
        {(sheet === "ciudad" || sheet === "fotos") && <PhotoWall onBack={close} initialPlace={photoPlace} />}
        {sheet === "buscar" && <VoiceSearch onBack={close} />}
        {sheet === "privacidad" && <Privacy onBack={close} />}
        {sheet === "espana" && <SpainScreen onBack={close} />}
        {sheet === "permisos" && <PermissionsScreen onBack={close} />}
        {sheet === "seguridad" && <SafetyCenter onBack={close} />}
        {sheet === "promo-perfil" && <ProfilePromo onBack={close} />}
        {sheet === "personas" && <SuggestedPeople onBack={close} />}
        {sheet === "incognito" && <IncognitoSheet onClose={close} />}
        {sheet === "impulso" && <BoostFlow onBack={close} onDone={close} preview={undefined} />}

        {hotId && <HotSpotView id={hotId} onBack={() => setHotId(null)} />}
        {bizId && <BusinessProfile id={bizId} onBack={() => setBizId(null)} />}
        {incogPublic && <IncognitoPublicProfile onClose={() => setIncogPublic(false)} />}

        {splash && <Splash onDone={() => setSplash(false)} waitFor={authReady} />}
        {!splash && welcome && <Welcome onEnter={() => { setWelcome(false); setOnb(true); }} onAuthenticated={() => setWelcome(false)} onSkipAll={() => { setWelcome(false); setOnb(false); setDemo(true); setIdentity("approved"); setIdTier("premium"); toast("Modo demostración: todo desbloqueado para que lo pruebes.", { duration: 4000, position: "top-center" }); }} />}
        {onb && <Onboarding onBack={() => { setOnb(false); setWelcome(true); }} onDone={() => { setOnb(false); void supabase.auth.updateUser({ data: { onboarded: true } }).catch(() => undefined); if (getState().identity !== "approved") setSheet("verificacion"); }} />}
        {recovery && <NewPassword mode="recovery" onDone={() => setRecovery(false)} />}
        {!splash && !welcome && <SharedLink />}
        <OfflineBanner />
        <VoiceErrorToasts />
        <Toaster mobileOffset={{ top: "calc(env(safe-area-inset-top) + 0.625rem)", bottom: "calc(env(safe-area-inset-bottom) + 5.25rem)" }} />
      </div>
    </AppCtx.Provider>
  );
}

/** Degradados de los iconos de navegación (uno por pestaña). Se pintan una vez y los iconos los usan con stroke="url(#…)". */
function NavGradients() {
  return (
    <svg aria-hidden="true" focusable="false" width="0" height="0" style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}>
      <defs>
        {[1, 2, 3, 4].map((n) => (
          <linearGradient key={n} id={`spot-nav-g${n}`} className={`spot-nav-${n}`} gradientUnits="userSpaceOnUse" x1="2" y1="2" x2="22" y2="22">
            <stop offset="0" className="spot-nav-stop-from" />
            <stop offset="1" className="spot-nav-stop-to" />
          </linearGradient>
        ))}
      </defs>
    </svg>
  );
}

/** Botón de la barra inferior: icono con su degradado de marca; la pestaña activa brilla y su nombre toma el degradado. */
function NavButton({ n, on, Icon, label, onClick }: { n: number; on: boolean; Icon: typeof Home; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} aria-current={on ? "page" : undefined} className={`spot-nav-${n} grid place-items-center gap-1 ${on ? "spot-nav-on" : ""}`}>
      <Icon size={21} color={`url(#spot-nav-g${n})`} className="spot-nav-icon" />
      <span className="spot-nav-label text-3xs">{label}</span>
    </button>
  );
}

/* Versión web/escritorio (Windows, macOS, navegador): la app móvil se centra y aparecen barra lateral y panel derecho. */
function DesktopSidebars({ tab, goTo, onCreate, onOpenHot, onPlace }: { tab: Tab; goTo: (t: Tab | null, sh?: Sheet) => void; onCreate: () => void; onOpenHot: (id: string) => void; onPlace: (c: string) => void }) {
  const nav: [string, typeof Home, () => void, boolean][] = [
    ["Inicio", Home, () => goTo("inicio"), tab === "inicio"], ["Explorar", Compass, () => goTo("explorar"), tab === "explorar"], ["Comunidades", Users, () => goTo(null, "comunidades"), false],
    ["Eventos", Calendar, () => goTo(null, "eventos"), false], ["Mensajes de voz", Mic, () => goTo(null, "chats"), false], ["Notificaciones", Bell, () => goTo("actividad"), tab === "actividad"], ["Perfil", UserRound, () => goTo("perfil"), tab === "perfil"],
  ];
  const { demo } = useStore();
  const live = [["Festival Sevilla", "1,2K escuchando"], ["DJ Sunset · Barcelona", "2,4K"], ["Charla viajera · Madrid", "1,2K"], ["Sesión acústica · Valencia", "980"]];
  return (
    <>
      <aside aria-label="Navegación" className="fixed inset-y-0 z-[80] hidden w-[18.75rem] flex-col gap-1 border-r border-border bg-background px-5 py-6 min-[1100px]:flex" style={{ left: "calc(50% - 560px)" }}>
        <Logo className="mb-6 self-start" />
        {nav.map(([l, I, f, on], i) => { const n = (i % 4) + 1; return <button key={l} onClick={f} aria-current={on ? "page" : undefined} className={`spot-nav-${n} flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold ` + (on ? "spot-active-pill" : "text-foreground/80 hover:bg-secondary")}><I size={18} color={on ? "currentColor" : `url(#spot-nav-g${n})`} className={on ? undefined : "spot-nav-icon"} />{l}</button>; })}
        <button onClick={onCreate} className="mt-4 flex h-12 items-center justify-center gap-2 rounded-full bg-spot-gradient font-bold text-foreground shadow-glow"><Plus size={18} />Crear Spot</button>
        <button onClick={() => goTo(null, "permisos")} className="mt-auto flex items-center gap-2 rounded-xl px-3 py-2 text-xs text-muted-foreground hover:bg-secondary"><Download size={14} />Instalar la app de Spotly</button>
      </aside>
      <aside aria-label="Ahora en Spotly" className="fixed inset-y-0 z-[80] hidden w-[18.75rem] flex-col gap-5 overflow-y-auto border-l border-border bg-background px-5 py-6 min-[1100px]:flex" style={{ left: "calc(50% + 260px)" }}>
        <section><h2 className="mb-2 flex items-center gap-1.5 text-sm font-bold"><Flame size={15} className="text-live" />En directo ahora</h2>
          <div className="space-y-1">{live.map(([t, n]) => <button key={t} onClick={() => goTo(null, "audio-wall")} className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-secondary"><span className="grid h-10 w-10 place-items-center rounded-lg bg-live/20 text-live"><Mic size={16} /></span><span className="min-w-0 flex-1"><strong className="block truncate text-sm">{t}</strong><small className="text-muted-foreground">{demo ? n : "Sala de demostración"}</small></span></button>)}</div></section>
        <section><h2 className="mb-2 text-sm font-bold">Hot Spots cerca</h2>
          <div className="space-y-1">{[["h1", "Concierto en la calle Betis", "420 m"], ["h2", "Cola en el Mercado de Triana", "800 m"], ["h3", "Corte de tráfico junto al Puente", "1,6 km"]].map(([id, t, d]) => <button key={id} onClick={() => onOpenHot(id!)} className="flex w-full items-center gap-2 rounded-xl p-2 text-left text-sm hover:bg-secondary"><Flame size={14} className="shrink-0 text-live" /><span className="min-w-0 flex-1 truncate">{t}</span><small className="text-muted-foreground">{d}</small></button>)}</div></section>
        <section><h2 className="mb-2 text-sm font-bold">Ciudades populares</h2>
          <div className="flex flex-wrap gap-2">{["Madrid", "Barcelona", "Valencia", "Sevilla", "Málaga"].map((c) => <button key={c} onClick={() => onPlace(c)} className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold hover:bg-secondary">{c}</button>)}</div></section>
        <p className="mt-auto text-2xs text-muted-foreground">Spotly · Less typing. More talking. Solo personas verificadas.</p>
      </aside>
    </>
  );
}
