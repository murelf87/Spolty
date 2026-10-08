import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, AtSign, Check, Eye, EyeOff, KeyRound, Loader2, Lock, Mail, MailCheck, ShieldCheck, X } from "lucide-react";
import { siApple, siGoogle } from "simple-icons";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { auth as authCfg } from "@/lib/spotlyConfig";
import { api, db } from "@/lib/cloud";
import { Logo } from "./Logo";
import { BottomSheet } from "./kit";

/**
 * Acceso a Spotly: correo + contraseña (Supabase Auth), Apple y Google.
 * Pantallas: login · register · verify (código de 6 cifras) · forgot · sent · reset · changed.
 * Seguridad: nunca se revela si un correo existe al recuperar contraseña, bloqueo temporal
 * tras varios fallos, contraseña mínima de 8 con letra y número, sin guardar nada en claro.
 */

type View = "login" | "register" | "verify" | "forgot" | "sent";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const USER_RE = /^[a-z][a-z0-9_.]{2,19}$/;

export const passwordChecks = (p: string) => [
  { ok: p.length >= authCfg.minPassword, label: `${authCfg.minPassword} caracteres o más` },
  { ok: /[A-Za-zÀ-ÿ]/.test(p), label: "Una letra" },
  { ok: /\d/.test(p), label: "Un número" },
];
const strength = (p: string) => {
  if (!p) return 0;
  let s = 0;
  if (p.length >= authCfg.minPassword) s++;
  if (/[a-z]/.test(p) && /[A-Z]/.test(p)) s++;
  if (/\d/.test(p)) s++;
  if (/[^A-Za-z0-9]/.test(p) || p.length >= 14) s++;
  return s;
};
export const passwordOk = (p: string) => passwordChecks(p).every((c) => c.ok);

/** Traduce los errores del servidor a mensajes claros; nunca muestra el texto técnico. */
function friendly(e: unknown): { msg: string; code: "creds" | "unconfirmed" | "exists" | "weak" | "rate" | "net" | "user" | "other" } {
  const m = String((e as { message?: string } | null)?.message ?? e ?? "").toLowerCase();
  /* El servidor crea tu perfil al registrarte: si falla es porque el usuario se acaba de coger. */
  if (m.includes("database error saving new user") || m.includes("username_taken")) return { msg: "Ese nombre de usuario ya está cogido. Prueba otro.", code: "user" };
  if (m.includes("invalid login") || m.includes("invalid credentials")) return { msg: "Correo o contraseña incorrectos.", code: "creds" };
  if (m.includes("not confirmed")) return { msg: "Aún no has confirmado tu correo.", code: "unconfirmed" };
  if (m.includes("already registered") || m.includes("already been registered")) return { msg: "Ya existe una cuenta con ese correo. Inicia sesión o recupera tu contraseña.", code: "exists" };
  if (m.includes("weak") || m.includes("password should")) return { msg: "Esa contraseña es demasiado débil o muy conocida. Prueba otra.", code: "weak" };
  if (m.includes("rate") || m.includes("too many") || m.includes("seconds")) return { msg: "Demasiados intentos. Espera un momento e inténtalo otra vez.", code: "rate" };
  if (m.includes("expired") || m.includes("invalid") && m.includes("token")) return { msg: "El código no es válido o ha caducado.", code: "other" };
  if (m.includes("fetch") || m.includes("network") || m.includes("failed") || (typeof navigator !== "undefined" && !navigator.onLine)) return { msg: "No se pudo conectar con el servidor. Comprueba tu conexión.", code: "net" };
  return { msg: "Algo ha fallado. Inténtalo de nuevo en unos segundos.", code: "other" };
}

/* ───────── Piezas visuales ───────── */

function Shell({ onBack, children, back = true }: { onBack?: (() => void) | undefined; children: ReactNode; back?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 mx-auto flex max-w-[520px] flex-col overflow-y-auto bg-background px-6 pb-[max(2rem,calc(env(safe-area-inset-bottom)+1rem))] pt-[max(1.25rem,env(safe-area-inset-top))]">
      <div className="flex items-center justify-between">
        {back && onBack ? <button aria-label="Volver" onClick={onBack} className="-ml-1 grid h-10 w-10 place-items-center rounded-full"><ChevronLeft size={24} /></button> : <span className="h-10 w-10" />}
        <Logo compact />
        <span className="h-10 w-10" />
      </div>
      {children}
    </div>
  );
}

const Head = ({ title, sub }: { title: string; sub?: ReactNode }) => (
  <div className="mt-5 text-center">
    <h1 className="text-[1.875rem] font-semibold leading-tight tracking-tight">{title}</h1>
    {sub && <p className="mx-auto mt-2 max-w-[18.75rem] text-[0.9375rem] leading-snug text-muted-foreground">{sub}</p>}
  </div>
);

function Field({ id, label, icon: Icon, error, hint, right, ...rest }: { id: string; label: string; icon: typeof Mail; error?: string | undefined; hint?: string | undefined; right?: ReactNode } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "id">) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[0.8125rem] font-medium text-foreground/80">{label}</label>
      <div className={`flex h-14 items-center gap-3 rounded-2xl border bg-card px-4 transition focus-within:shadow-glow ${error ? "border-live" : "border-border focus-within:border-primary"}`}>
        <Icon size={18} className="shrink-0 text-muted-foreground" />
        <input id={id} aria-invalid={!!error} aria-describedby={error ? `${id}-e` : undefined} {...rest} className="h-full min-w-0 flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground/70" />
        {right}
      </div>
      {error ? <p id={`${id}-e`} role="alert" className="mt-1.5 text-xs text-live">{error}</p> : hint ? <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function PasswordField({ id, label, value, onChange, error, autoComplete, placeholder }: { id: string; label: string; value: string; onChange: (v: string) => void; error?: string | undefined; autoComplete: string; placeholder?: string }) {
  const [show, setShow] = useState(false);
  const [caps, setCaps] = useState(false);
  return (
    <Field id={id} label={label} icon={Lock} type={show ? "text" : "password"} value={value} autoComplete={autoComplete} placeholder={placeholder ?? "••••••••"}
      onChange={(e) => onChange(e.target.value)} onKeyUp={(e) => setCaps(e.getModifierState("CapsLock"))} error={error} hint={caps ? "Tienes las mayúsculas activadas." : undefined}
      right={<button type="button" aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"} onClick={() => setShow(!show)} className="grid h-8 w-8 place-items-center text-muted-foreground">{show ? <EyeOff size={18} /> : <Eye size={18} />}</button>} />
  );
}

function Strength({ value }: { value: string }) {
  const s = strength(value);
  const colors = ["bg-secondary", "bg-live", "bg-amber-400", "bg-emerald-400", "bg-emerald-400"];
  const names = ["", "Débil", "Mejorable", "Buena", "Muy fuerte"];
  return (
    <div className="mt-2" aria-live="polite">
      <div className="flex gap-1.5">{[1, 2, 3, 4].map((i) => <span key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i <= s ? colors[s] : "bg-secondary"}`} />)}</div>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        {passwordChecks(value).map((c) => <span key={c.label} className={`flex items-center gap-1 ${c.ok ? "text-emerald-400" : "text-muted-foreground"}`}>{c.ok ? <Check size={12} /> : <X size={12} />}{c.label}</span>)}
        {value && <span className="ml-auto font-semibold text-foreground/80">{names[s]}</span>}
      </div>
    </div>
  );
}

const Cta = ({ children, busy, ...p }: { busy?: boolean } & React.ComponentProps<typeof Button>) => (
  <Button size="lg" className="h-[3.25rem] w-full rounded-full bg-spot-gradient text-[0.9375rem] font-semibold text-white shadow-glow" disabled={busy || p.disabled} {...p}>{busy ? <Loader2 className="animate-spin" size={18} /> : children}</Button>
);

const ErrorBox = ({ children }: { children: ReactNode }) => <div role="alert" className="rounded-xl border border-live/50 bg-live/10 px-3 py-2.5 text-[0.8125rem] text-live">{children}</div>;
const LinkBtn = ({ children, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button type="button" {...p} className={`font-semibold text-primary disabled:text-muted-foreground ${p.className ?? ""}`}>{children}</button>;

function Social({ onDone, disabled }: { onDone: () => void; disabled?: boolean }) {
  const [busy, setBusy] = useState(false);
  const go = async (provider: "apple" | "google") => {
    setBusy(true);
    try {
      const r = await lovable.auth.signInWithOAuth(provider, { redirect_uri: window.location.origin });
      if (r.error) toast.error("No se pudo iniciar sesión. Inténtalo de nuevo.");
      else if (!r.redirected) onDone();
    } catch { toast.error("No se pudo conectar con el servidor."); } finally { setBusy(false); }
  };
  const icon = (p: string) => <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true"><path d={p} /></svg>;
  return (
    <div>
      <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />o continúa con<span className="h-px flex-1 bg-border" /></div>
      <div className="grid grid-cols-2 gap-3">
        <Button variant="outline" disabled={busy || disabled} onClick={() => void go("apple")} className="h-12 rounded-full border-border bg-card text-sm font-semibold">{icon(siApple.path)}Apple</Button>
        <Button variant="outline" disabled={busy || disabled} onClick={() => void go("google")} className="h-12 rounded-full border-border bg-card text-sm font-semibold">{icon(siGoogle.path)}Google</Button>
      </div>
    </div>
  );
}

/** Cuenta atrás para reenvíos / bloqueos. */
function useCountdown(start = 0) {
  const [n, setN] = useState(start);
  useEffect(() => { if (n <= 0) return; const t = window.setTimeout(() => setN(n - 1), 1000); return () => window.clearTimeout(t); }, [n]);
  return [n, setN] as const;
}

/* ───────── Textos legales (borrador) ───────── */

function Legal({ kind, onClose }: { kind: "terms" | "privacy"; onClose: () => void }) {
  const terms: [string, string][] = [
    ["Quién puede usar Spotly", `Personas de ${authCfg.minAge} años o más. Una cuenta por persona; tu cuenta es tuya y no se puede vender ni ceder.`],
    ["Qué publicas", "Eres responsable de tus Spots y audios. No se permite acoso, amenazas, suplantación, contenido sexual explícito ni datos personales de terceros (direcciones, teléfonos, imágenes privadas)."],
    ["Verificación", "Para publicar debes verificar tu identidad. El pago nunca compra reputación, seguidores, veracidad ni inmunidad de moderación."],
    ["Moderación", "Podemos retirar contenido y suspender cuentas que incumplan estas normas. Puedes denunciar y bloquear desde cualquier Spot o perfil."],
    ["Pagos", "Los 💎 diamantes y boosts se muestran siempre con su precio antes de pagar. Consulta la política de reembolsos en el checkout."],
  ];
  const priv: [string, string][] = [
    ["Datos que tratamos", "Correo, nombre de usuario, audios y fotos que publicas, ubicación aproximada si la activas y datos técnicos del dispositivo."],
    ["Ubicación", "Nunca mostramos tu ubicación exacta a otras personas. Puedes elegir precisión, modo Incógnito o desactivarla."],
    ["Identidad", "Los documentos de verificación los procesa un proveedor especializado y no se muestran a nadie en Spotly."],
    ["Tus derechos (RGPD)", "Acceso, rectificación, supresión, portabilidad y oposición desde Ajustes → Cuenta y datos, o escribiendo a nuestro contacto de privacidad."],
  ];
  const list = kind === "terms" ? terms : priv;
  return (
    <BottomSheet title={kind === "terms" ? "Términos de uso" : "Política de privacidad"} onClose={onClose} z={90}>
      <p className="mb-3 rounded-lg border border-dashed border-border p-2 text-2xs text-muted-foreground">Resumen orientativo. El texto legal definitivo debe revisarlo asesoría jurídica antes de publicar.</p>
      <div className="space-y-3">{list.map(([t, d]) => <section key={t}><h4 className="text-sm font-semibold">{t}</h4><p className="mt-0.5 text-[0.8125rem] leading-snug text-muted-foreground">{d}</p></section>)}</div>
    </BottomSheet>
  );
}

/* ───────── Flujo principal ───────── */

export function AuthFlow({ initial, onBack, onDemo, onSignedIn }: { initial: "login" | "register"; onBack: () => void; onDemo: () => void; onSignedIn: (isNew: boolean) => void }) {
  const [view, setView] = useState<View>(initial);
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [pass2, setPass2] = useState("");
  const [username, setUsername] = useState("");
  const [terms, setTerms] = useState(false);
  const [age, setAge] = useState(false);
  const [touched, setTouched] = useState<{ email?: boolean; username?: boolean; pass?: boolean; pass2?: boolean }>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [legal, setLegal] = useState<null | "terms" | "privacy">(null);
  const [code, setCode] = useState("");
  const [wait, setWait] = useCountdown(0);
  const [lock, setLock] = useCountdown(0);
  const fails = useRef(0);
  const touch = (k: "email" | "username" | "pass" | "pass2") => setTouched((t) => ({ ...t, [k]: true }));
  const go = (v: View) => { setView(v); setErr(null); setTouched({}); setCode(""); };

  const emailErr = touched.email && !EMAIL_RE.test(email.trim()) ? "Introduce un correo válido, por ejemplo nombre@correo.com." : undefined;
  const userErr = touched.username && !USER_RE.test(username) ? "De 3 a 20 caracteres: minúsculas, números, punto o guion bajo. Debe empezar por letra." : undefined;
  const passErr = touched.pass && !passwordOk(pass) ? "La contraseña no cumple los requisitos." : undefined;
  const pass2Err = touched.pass2 && pass2 !== pass ? "Las contraseñas no coinciden." : undefined;

  const login = async () => {
    setTouched({ email: true, pass: true });
    if (!EMAIL_RE.test(email.trim()) || !pass) return;
    if (lock > 0) return;
    setBusy(true); setErr(null);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: pass }).catch((e: unknown) => ({ error: e }));
    setBusy(false);
    if (!error) { onSignedIn(false); return; }
    const f = friendly(error);
    if (f.code === "unconfirmed") { void supabase.auth.resend({ type: "signup", email: email.trim() }).catch(() => undefined); setWait(authCfg.resendSeconds); go("verify"); return; }
    if (f.code === "creds" && ++fails.current >= authCfg.maxFails) { fails.current = 0; setLock(authCfg.lockSeconds); setErr(`Demasiados intentos fallidos. Espera ${authCfg.lockSeconds} s o recupera tu contraseña.`); return; }
    setErr(f.msg);
  };

  const register = async () => {
    setTouched({ email: true, username: true, pass: true, pass2: true });
    if (!EMAIL_RE.test(email.trim()) || !USER_RE.test(username) || !passwordOk(pass) || pass !== pass2) return;
    if (!terms || !age) { setErr("Acepta los términos y confirma tu edad para continuar."); return; }
    setBusy(true); setErr(null);
    try {
      /* Los usuarios son públicos: se comprueba antes de crear la cuenta (si la nube aún no responde, decide el servidor). */
      if (!(await api.usernameAvailable(db(), username).catch(() => true))) { setErr("Ese nombre de usuario ya está cogido. Prueba otro."); return; }
      const { data, error } = await supabase.auth.signUp({ email: email.trim(), password: pass, options: { emailRedirectTo: window.location.origin, data: { username, accepted_terms_at: new Date().toISOString(), min_age_confirmed: authCfg.minAge } } });
      if (error) { setErr(friendly(error).msg); return; }
      if (data.user && (data.user.identities?.length ?? 1) === 0) { setErr(friendly({ message: "already registered" }).msg); return; }
      if (data.session) { onSignedIn(true); return; }
      setWait(authCfg.resendSeconds); go("verify");
    } catch (e) { setErr(friendly(e).msg); } finally { setBusy(false); }
  };

  const verify = async (token: string) => {
    setBusy(true); setErr(null);
    try {
      const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token, type: "signup" });
      if (error) { setErr(friendly(error).msg); setCode(""); return; }
      toast.success("Correo confirmado");
      onSignedIn(true);
    } catch (e) { setErr(friendly(e).msg); } finally { setBusy(false); }
  };

  const resend = async () => {
    if (wait > 0) return;
    setWait(authCfg.resendSeconds);
    try {
      const { error } = view === "sent" ? await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin }) : await supabase.auth.resend({ type: "signup", email: email.trim() });
      if (error) { setErr(friendly(error).msg); return; }
      toast.success("Enviado de nuevo");
    } catch (e) { setErr(friendly(e).msg); }
  };

  const forgot = async () => {
    setTouched({ email: true });
    if (!EMAIL_RE.test(email.trim())) return;
    setBusy(true); setErr(null);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin });
      if (error && friendly(error).code !== "other") { setErr(friendly(error).msg); return; }
      setWait(authCfg.resendSeconds); go("sent");
    } catch (e) { setErr(friendly(e).msg); } finally { setBusy(false); }
  };

  const onCode = (v: string) => { const d = v.replace(/\D/g, "").slice(0, 6); setCode(d); if (d.length === 6 && !busy) void verify(d); };

  /* ——— Iniciar sesión ——— */
  if (view === "login") return (
    <Shell onBack={onBack}>
      <Head title="Bienvenido de nuevo" sub="Inicia sesión para seguir escuchando lo que pasa cerca de ti." />
      <form className="mt-7 space-y-4" noValidate onSubmit={(e) => { e.preventDefault(); void login(); }}>
        <Field id="email" label="Correo electrónico" icon={Mail} type="email" inputMode="email" autoComplete="email" autoCapitalize="none" placeholder="nombre@correo.com" value={email} onChange={(e) => setEmail(e.target.value)} onBlur={() => touch("email")} error={emailErr} />
        <PasswordField id="pass" label="Contraseña" value={pass} onChange={setPass} autoComplete="current-password" error={touched.pass && !pass ? "Escribe tu contraseña." : undefined} />
        <div className="text-right text-[0.8125rem]"><LinkBtn onClick={() => go("forgot")}>¿Olvidaste tu contraseña?</LinkBtn></div>
        {err && <ErrorBox>{err}</ErrorBox>}
        <Cta type="submit" busy={busy} disabled={lock > 0}>{lock > 0 ? `Espera ${lock} s` : "Iniciar sesión"}</Cta>
      </form>
      <Social onDone={() => onSignedIn(false)} />
      <p className="mt-6 text-center text-sm text-muted-foreground">¿No tienes cuenta? <LinkBtn onClick={() => go("register")}>Crear cuenta</LinkBtn></p>
      <button onClick={onDemo} className="mx-auto mt-4 py-2 text-[0.8125rem] font-medium text-foreground/70">Saltar todo y ver la demostración</button>
    </Shell>
  );

  /* ——— Crear cuenta ——— */
  if (view === "register") return (
    <Shell onBack={onBack}>
      <Head title="Crea tu cuenta" sub="Voces reales de personas verificadas, sin postureo." />
      <form className="mt-6 space-y-4" noValidate onSubmit={(e) => { e.preventDefault(); void register(); }}>
        <Field id="username" label="Nombre de usuario" icon={AtSign} autoComplete="username" autoCapitalize="none" spellCheck={false} placeholder="tu_usuario" value={username} onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, ""))} onBlur={() => touch("username")} error={userErr} hint="Así te verán en Spotly. Podrás cambiarlo más adelante." maxLength={20} />
        <Field id="email" label="Correo electrónico" icon={Mail} type="email" inputMode="email" autoComplete="email" autoCapitalize="none" placeholder="nombre@correo.com" value={email} onChange={(e) => setEmail(e.target.value)} onBlur={() => touch("email")} error={emailErr} />
        <div><PasswordField id="pass" label="Contraseña" value={pass} onChange={(v) => { setPass(v); touch("pass"); }} autoComplete="new-password" error={passErr && pass ? undefined : undefined} /><Strength value={pass} /></div>
        <PasswordField id="pass2" label="Repite la contraseña" value={pass2} onChange={(v) => { setPass2(v); touch("pass2"); }} autoComplete="new-password" error={pass2Err} />
        <div className="space-y-3 pt-1">
          <label className="flex items-start gap-3 text-[0.8125rem] leading-snug text-foreground/85"><input type="checkbox" checked={age} onChange={(e) => setAge(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--primary)]" />Tengo {authCfg.minAge} años o más.</label>
          <label className="flex items-start gap-3 text-[0.8125rem] leading-snug text-foreground/85"><input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--primary)]" /><span>Acepto los <LinkBtn onClick={() => setLegal("terms")}>Términos de uso</LinkBtn> y la <LinkBtn onClick={() => setLegal("privacy")}>Política de privacidad</LinkBtn>.</span></label>
        </div>
        {err && <ErrorBox>{err}</ErrorBox>}
        <Cta type="submit" busy={busy}>Crear cuenta</Cta>
      </form>
      <Social onDone={() => onSignedIn(true)} disabled={!terms || !age} />
      {(!terms || !age) && <p className="mt-2 text-center text-2xs text-muted-foreground">Acepta los términos y confirma tu edad para usar Apple o Google.</p>}
      <p className="mt-6 text-center text-sm text-muted-foreground">¿Ya tienes cuenta? <LinkBtn onClick={() => go("login")}>Iniciar sesión</LinkBtn></p>
      {legal && <Legal kind={legal} onClose={() => setLegal(null)} />}
    </Shell>
  );

  /* ——— Verificar correo ——— */
  if (view === "verify") return (
    <Shell onBack={() => go(initial === "register" ? "register" : "login")}>
      <div className="mt-8 grid place-items-center"><span className="spot-pin-glow grid h-24 w-24 place-items-center rounded-full border-2 border-primary/60 bg-card/70 text-primary"><MailCheck size={42} /></span></div>
      <Head title="Revisa tu correo" sub={<>Hemos enviado un código de 6 cifras a <strong className="text-foreground">{email}</strong>.</>} />
      <div className="relative mt-7">
        <div className="grid grid-cols-6 gap-2" aria-hidden="true">{[0, 1, 2, 3, 4, 5].map((i) => <span key={i} className={`grid h-14 place-items-center rounded-xl border text-2xl font-semibold ${i === code.length ? "border-primary shadow-glow" : "border-border"} bg-card`}>{code[i] ?? ""}</span>)}</div>
        <input value={code} onChange={(e) => onCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code" autoFocus maxLength={6} aria-label="Código de 6 cifras" className="absolute inset-0 h-full w-full cursor-text opacity-0" />
      </div>
      {err && <div className="mt-4"><ErrorBox>{err}</ErrorBox></div>}
      <div className="mt-6"><Cta busy={busy} disabled={code.length < 6} onClick={() => void verify(code)}>Confirmar</Cta></div>
      <p className="mt-5 text-center text-sm text-muted-foreground">¿No ha llegado? <LinkBtn disabled={wait > 0} onClick={() => void resend()}>{wait > 0 ? `Reenviar en ${wait} s` : "Reenviar código"}</LinkBtn></p>
      <p className="mt-2 text-center text-xs text-muted-foreground">Mira también en spam. <LinkBtn onClick={() => go("register")}>Cambiar correo</LinkBtn></p>
    </Shell>
  );

  /* ——— Recuperar contraseña ——— */
  if (view === "forgot") return (
    <Shell onBack={() => go("login")}>
      <div className="mt-8 grid place-items-center"><span className="grid h-24 w-24 place-items-center rounded-full border-2 border-[var(--spot-fuchsia)]/60 bg-card/70 text-[var(--spot-fuchsia)] shadow-[0_0_24px_var(--spot-fuchsia)]"><KeyRound size={40} /></span></div>
      <Head title="Recupera tu contraseña" sub="Escribe tu correo y te enviaremos un enlace para crear una nueva." />
      <form className="mt-7 space-y-4" noValidate onSubmit={(e) => { e.preventDefault(); void forgot(); }}>
        <Field id="email" label="Correo electrónico" icon={Mail} type="email" inputMode="email" autoComplete="email" autoCapitalize="none" placeholder="nombre@correo.com" value={email} onChange={(e) => setEmail(e.target.value)} onBlur={() => touch("email")} error={emailErr} />
        {err && <ErrorBox>{err}</ErrorBox>}
        <Cta type="submit" busy={busy}>Enviar enlace</Cta>
      </form>
      <p className="mt-6 text-center text-sm"><LinkBtn onClick={() => go("login")}>Volver a iniciar sesión</LinkBtn></p>
    </Shell>
  );

  /* ——— Enlace enviado ——— */
  return (
    <Shell onBack={() => go("login")}>
      <div className="mt-8 grid place-items-center"><span className="spot-pin-glow grid h-24 w-24 place-items-center rounded-full border-2 border-emerald-400/60 bg-card/70 text-emerald-400"><MailCheck size={42} /></span></div>
      <Head title="Enlace enviado" sub={<>Si existe una cuenta con <strong className="text-foreground">{email}</strong>, recibirás un correo con las instrucciones. El enlace caduca pronto.</>} />
      {err && <div className="mt-4"><ErrorBox>{err}</ErrorBox></div>}
      <div className="mt-8"><Cta onClick={() => go("login")}>Volver a iniciar sesión</Cta></div>
      <p className="mt-5 text-center text-sm text-muted-foreground">¿No llega? <LinkBtn disabled={wait > 0} onClick={() => void resend()}>{wait > 0 ? `Reenviar en ${wait} s` : "Reenviar enlace"}</LinkBtn></p>
      <p className="mx-auto mt-6 flex max-w-[18.75rem] items-start gap-2 text-2xs text-muted-foreground"><ShieldCheck size={14} className="mt-0.5 shrink-0" />Por seguridad no indicamos si un correo está registrado o no.</p>
    </Shell>
  );
}

/* ───────── Nueva contraseña (enlace de recuperación o Ajustes) ───────── */

export function NewPassword({ mode, onDone, onCancel }: { mode: "recovery" | "change"; onDone: () => void; onCancel?: () => void }) {
  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const [t, setT] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const submit = async () => {
    setT(true);
    if (!passwordOk(p1) || p1 !== p2) return;
    setBusy(true); setErr(null);
    try {
      const { error } = await supabase.auth.updateUser({ password: p1 });
      if (error) { setErr(friendly(error).msg); return; }
      setOk(true);
    } catch (e) { setErr(friendly(e).msg); } finally { setBusy(false); }
  };
  if (ok) return (
    <Shell back={false}>
      <div className="mt-10 grid place-items-center"><span className="spot-pin-glow grid h-24 w-24 place-items-center rounded-full border-2 border-emerald-400/60 bg-card/70 text-emerald-400"><Check size={44} strokeWidth={3} /></span></div>
      <Head title="Contraseña actualizada" sub="Ya puedes seguir usando Spotly con tu nueva contraseña." />
      <div className="mt-8"><Cta onClick={onDone}>Continuar</Cta></div>
    </Shell>
  );
  return (
    <Shell onBack={mode === "change" ? onCancel : undefined} back={mode === "change"}>
      <div className="mt-8 grid place-items-center"><span className="grid h-24 w-24 place-items-center rounded-full border-2 border-primary/60 bg-card/70 text-primary shadow-glow"><Lock size={40} /></span></div>
      <Head title="Crea una nueva contraseña" sub={mode === "recovery" ? "Elige una contraseña segura que no uses en otros sitios." : "Te pediremos la nueva la próxima vez que inicies sesión."} />
      <form className="mt-7 space-y-4" noValidate onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        <div><PasswordField id="np1" label="Nueva contraseña" value={p1} onChange={setP1} autoComplete="new-password" /><Strength value={p1} /></div>
        <PasswordField id="np2" label="Repite la contraseña" value={p2} onChange={setP2} autoComplete="new-password" error={t && p2 !== p1 ? "Las contraseñas no coinciden." : undefined} />
        {err && <ErrorBox>{err}</ErrorBox>}
        <Cta type="submit" busy={busy} disabled={!passwordOk(p1)}>Guardar contraseña</Cta>
      </form>
    </Shell>
  );
}
