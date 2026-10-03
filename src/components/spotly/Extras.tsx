import { AuthFlow } from "./Auth";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { siApple, siGoogle, siX } from "simple-icons";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Logo } from "./Logo";
import welcomeEarth from "@/assets/spotly-welcome-earth.jpg";
import { lovable } from "@/integrations/lovable";

export type Sheet =
  | "wallet" | "chats" | "audio-wall" | "verificacion" | "local" | "comunidades" | "eventos" | "ciudad" | "buscar" | "privacidad"
  | "incognito" | "impulso" | "promo-perfil" | "personas" | "hotspot" | "permisos" | "seguridad" | "fotos" | "historial" | "espana"
  | null;

export function Shell({ title, onBack, children }: { title: string; onBack: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-40 mx-auto max-w-[520px] overflow-y-auto bg-background">
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-background/95 p-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur">
        <Button variant="ghost" size="icon" onClick={onBack} aria-label="Volver"><ArrowLeft /></Button>
        <h2 className="font-bold">{title}</h2>
      </header>
      <main className="p-4 pb-24">{children}</main>
    </div>
  );
}

export function Welcome({ onEnter, onAuthenticated, onSkipAll }: { onEnter: () => void; onAuthenticated: () => void; onSkipAll: () => void }) {
  const [acc, setAcc] = useState<null | "login" | "register">(null);
  const [busy, setBusy] = useState(false);
  const signIn = async (provider: "apple" | "google") => {
    setBusy(true);
    try {
      const result = await lovable.auth.signInWithOAuth(provider, { redirect_uri: window.location.origin });
      if (result.error) toast.error("No se pudo iniciar sesión. Inténtalo de nuevo.");
      else if (!result.redirected) onAuthenticated();
    } catch { toast.error("No se pudo iniciar sesión. Inténtalo de nuevo."); }
    finally { setBusy(false); }
  };
  if (acc) return <AuthFlow initial={acc} onBack={() => setAcc(null)} onDemo={onSkipAll} onSignedIn={(isNew) => (isNew ? onEnter() : onAuthenticated())} />;
  return (
     <div className="spot-welcome fixed inset-0 z-50 mx-auto flex max-w-[520px] flex-col items-center overflow-hidden px-6 text-center">
       <img src={welcomeEarth} alt="La Tierra de noche con señales de voz sobre Europa" width={1024} height={1536} className="spot-welcome-earth pointer-events-none absolute inset-x-0 w-full object-cover" />
       <div className="spot-welcome-overlay pointer-events-none absolute inset-0" />
       <button onClick={onSkipAll} aria-label="Saltar todo y ver la demostración" className="absolute right-4 top-[max(1rem,env(safe-area-inset-top))] z-20 flex items-center gap-1.5 rounded-full border border-primary/50 bg-background/70 px-4 py-2 text-[13px] font-semibold text-foreground shadow-glow backdrop-blur">Saltar todo<span aria-hidden="true">›</span></button>
       <div className="relative z-10 mt-[max(7rem,calc(env(safe-area-inset-top)+5rem))] flex flex-col items-center">
         <div className="spot-welcome-logo"><Logo /></div>
         <p className="mt-9 text-[10px] font-semibold text-foreground/85 tracking-[0.24em]">LESS TYPING. MORE TALKING.</p>
       </div>
       <div className="relative z-10 mt-auto w-full max-w-[390px] pb-[max(1.25rem,env(safe-area-inset-bottom))]">
         <p className="mx-auto mb-5 max-w-[265px] text-sm leading-5 font-medium text-foreground">Descubre gente cerca de ti<br />a través de su voz.</p>
         <Button className="h-12 w-full rounded-full border border-primary/50 bg-spot-gradient text-sm font-bold text-foreground shadow-glow" onClick={() => setAcc("register")}>Crear cuenta</Button>
         <Button variant="outline" className="mt-2 h-12 w-full rounded-full border border-border/50 bg-secondary/65 text-foreground backdrop-blur" onClick={() => setAcc("login")}>Iniciar sesión</Button>
         <div className="mt-4 flex items-center justify-center gap-7" aria-label="Acceso con redes sociales">
           <Button variant="ghost" size="icon" className="text-foreground" aria-label="Continuar con Apple" title="Continuar con Apple" disabled={busy} onClick={() => void signIn("apple")}><svg viewBox="0 0 24 24" className="h-6 w-6 fill-current" aria-hidden="true"><path d={siApple.path} /></svg></Button>
           <Button variant="ghost" size="icon" className="text-foreground" aria-label="Continuar con Google" title="Continuar con Google" disabled={busy} onClick={() => void signIn("google")}><svg viewBox="0 0 24 24" className="h-6 w-6 fill-current" aria-hidden="true"><path d={siGoogle.path} /></svg></Button>
           <Button variant="ghost" size="icon" className="text-foreground" aria-label="Acceso con X no disponible" title="Acceso con X no disponible" onClick={() => toast.info("El acceso con X todavía no está disponible. Puedes usar Apple o Google.")}><svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true"><path d={siX.path} /></svg></Button>
         </div>
       </div>
     </div>
  );
}
