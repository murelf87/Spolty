import { useEffect, useState } from "react";
import { AlertTriangle, Apple, Check, Clock, CreditCard, Crown, Flame, Ghost, History, Loader2, Plus, Store, Undo2, Users, X, Zap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { BottomSheet, Screen, StateCard, Trust } from "./kit";
import type { Sheet } from "./Extras";
import { addCredits, spendCredits, useStore, type TxKind } from "@/lib/store";
import { creditPacks, eur, eurToCredits, fmtCredits, commerce } from "@/lib/spotlyConfig";

type Kind = "digital" | "ads" | "physical";
type Method = "store" | "card" | "credits" | "venue";
type Phase = "choose" | "processing" | "success" | "pending" | "failed" | "cancelled";

const platform = () => (typeof navigator !== "undefined" && /android/i.test(navigator.userAgent) ? "Google" : "Apple");

const KIND_NOTE: Record<Kind, string> = {
  digital: "Compra digital dentro de la app: se cobra a través de Apple o Google, según tu dispositivo, como exigen las tiendas.",
  ads: "Servicio de publicidad comercial: se factura como servicio a negocios, separado de las compras digitales de la app.",
  physical: "Producto o servicio físico de un establecimiento: se paga en el propio local. Spotly no cobra esta compra.",
};

/**
 * Checkout nativo (iOS/Android). Contrato: POST /v1/checkout { kind, lines, method } →
 * { status: "succeeded" | "pending" | "failed" | "cancelled" }.
 * En esta versión NO hay cobro real: el resultado se puede simular.
 */
export function Checkout({ title, kind, lines, onClose, onPaid, onNeedCredits }: { title: string; kind: Kind; lines: { label: string; eur: number }[]; onClose: () => void; onPaid: () => void; onNeedCredits?: () => void }) {
  const { credits } = useStore();
  const total = lines.reduce((a, l) => a + l.eur, 0);
  const totalCr = eurToCredits(total);
  const methods: { id: Method; label: string; sub: string; icon: typeof Apple }[] = [
    ...(kind === "digital" ? [{ id: "store" as const, label: `${platform()} ${platform() === "Apple" ? "Pay · App Store" : "Pay · Google Play"}`, sub: "Compra dentro de la app", icon: Apple }] : []),
    ...(kind === "ads" ? [{ id: "card" as const, label: "Tarjeta de empresa", sub: "Factura con IVA", icon: CreditCard }] : []),
    ...(kind !== "physical" && total > 0 ? [{ id: "credits" as const, label: "Diamantes Spotly", sub: `Saldo: ${fmtCredits(credits)} · Total ${fmtCredits(totalCr)}`, icon: "diamond" as unknown as typeof Apple }] : []),
    ...(kind === "physical" ? [{ id: "venue" as const, label: "Pagar en el local", sub: "Sin cobro en la app", icon: Store }] : []),
  ];
  const [method, setMethod] = useState<Method>(methods.find((m) => m.id === "credits" && credits >= totalCr)?.id ?? methods[0]!.id);
  const [phase, setPhase] = useState<Phase>("choose");
  const [outcome, setOutcome] = useState<"success" | "pending" | "failed">("success");
  const short = method === "credits" && credits < totalCr;

  useEffect(() => {
    if (phase !== "processing") return;
    const t = setTimeout(() => {
      if (outcome === "success") {
        if (method === "credits" && !spendCredits(totalCr, title)) { setPhase("failed"); return; }
        setPhase("success");
        onPaid();
      } else setPhase(outcome);
    }, 1400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const close = () => { if (phase === "choose") toast("Pago cancelado. No se ha cobrado nada."); onClose(); };

  return (
    <BottomSheet title={phase === "choose" ? "Confirmar compra" : undefined} onClose={close} z={80}>
      {phase === "choose" && <>
        <p className="text-sm font-semibold">{title}</p>
        <div className="mt-3 divide-y divide-border rounded-2xl border border-border bg-background/40">
          {lines.map((l) => <p key={l.label} className="flex justify-between p-3 text-sm"><span>{l.label}</span><strong>{l.eur === 0 ? "Gratis" : eur(l.eur)}</strong></p>)}
          <p className="flex items-center justify-between p-3 font-bold"><span>Total</span><span className="text-right">{eur(total)}<small className="block text-[11px] font-normal text-muted-foreground">≈ {fmtCredits(totalCr)}</small></span></p>
        </div>
        <p className="mb-2 mt-4 text-xs font-semibold text-muted-foreground">FORMA DE PAGO</p>
        <div className="space-y-2">
          {methods.map((m) => <button key={m.id} onClick={() => setMethod(m.id)} aria-pressed={method === m.id} className={"flex w-full items-center gap-3 rounded-xl border p-3 text-left " + (method === m.id ? "border-primary bg-primary/10" : "border-border")}>{m.id === "credits" ? <span className="text-xl leading-none">💎</span> : <m.icon size={18} className="text-primary" />}<span className="flex-1"><strong className="block text-sm">{m.label}</strong><small className="text-muted-foreground">{m.sub}</small></span>{method === m.id && <Check size={16} className="text-primary" />}</button>)}
        </div>
        {short && <div className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-live/50 bg-live/10 p-3 text-xs"><span>Te faltan {fmtCredits(totalCr - credits)}.</span><Button size="sm" variant="secondary" onClick={() => { onClose(); onNeedCredits?.(); }}>Recargar</Button></div>}
        <div className="mt-3"><Trust>{KIND_NOTE[kind]}</Trust></div>
        <div className="mt-3 rounded-xl border border-dashed border-border p-3">
          <p className="text-[11px] font-semibold text-muted-foreground">DEMO · SIMULAR RESULTADO (no hay cobro real)</p>
          <div className="mt-2 grid grid-cols-3 gap-1">{([["success", "Correcto"], ["pending", "Pendiente"], ["failed", "Fallido"]] as const).map(([k, l]) => <button key={k} onClick={() => setOutcome(k)} aria-pressed={outcome === k} className={"rounded-lg py-1.5 text-xs " + (outcome === k ? "bg-primary text-primary-foreground" : "bg-secondary")}>{l}</button>)}</div>
        </div>
        <Button className="mt-4 h-12 w-full rounded-full bg-spot-gradient text-base text-foreground" disabled={short} onClick={() => setPhase("processing")}>{total === 0 ? "Confirmar" : kind === "physical" ? "Reservar" : `Pagar ${eur(total)}`}</Button>
        <Button variant="ghost" className="mt-1 w-full" onClick={close}>Cancelar</Button>
      </>}
      {phase === "processing" && <div className="py-8 text-center"><Loader2 size={44} className="mx-auto animate-spin text-primary" /><h3 className="mt-4 font-bold">Procesando el pago…</h3><p className="text-sm text-muted-foreground">No cierres la app.</p><Button variant="ghost" className="mt-4" onClick={() => setPhase("cancelled")}>Cancelar</Button></div>}
      {phase === "success" && <div className="py-4 text-center"><span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-spot-gradient shadow-glow"><Check size={30} /></span><h3 className="mt-3 text-xl font-bold">Pago correcto</h3><p className="text-sm text-muted-foreground">{title}</p><Button className="mt-5 w-full rounded-full" onClick={onClose}>Listo</Button></div>}
      {phase === "pending" && <StateCard icon={Clock} tone="premium" title="Pago pendiente" text="Tu banco o la tienda aún no lo han confirmado. Te avisaremos en cuanto llegue; no se activará nada hasta entonces." action="Entendido" onAction={onClose} />}
      {phase === "failed" && <StateCard icon={AlertTriangle} tone="live" title="Pago fallido" text="No se ha realizado ningún cargo. Revisa tu método de pago e inténtalo de nuevo." action="Reintentar" onAction={() => setPhase("choose")} secondary="Cerrar" onSecondary={onClose} />}
      {phase === "cancelled" && <StateCard icon={X} tone="muted" title="Pago cancelado" text="No se ha cobrado nada. Tu Spot y tus diamantes siguen igual." action="Volver" onAction={() => setPhase("choose")} secondary="Cerrar" onSecondary={onClose} />}
    </BottomSheet>
  );
}

const kindMeta: Record<TxKind, { label: string; cls: string }> = {
  purchase: { label: "Compra", cls: "text-primary" },
  spend: { label: "Consumo", cls: "text-muted-foreground" },
  bonus: { label: "Bonificación", cls: "text-premium" },
  refund: { label: "Reembolso / ajuste", cls: "text-primary" },
};

export function TxHistory({ onBack }: { onBack: () => void }) {
  const { history, credits } = useStore();
  const [f, setF] = useState<"all" | TxKind>("all");
  const list = history.filter((t) => f === "all" || t.kind === f);
  return (
    <Screen title="Historial de diamantes" sub={`Saldo actual: ${fmtCredits(credits)}`} onBack={onBack} z={60}>
      <div className="flex gap-1.5 overflow-x-auto pb-2">{([["all", "Todo"], ["purchase", "Compras"], ["spend", "Consumo"], ["bonus", "Bonos"], ["refund", "Reembolsos"]] as const).map(([k, l]) => <button key={k} onClick={() => setF(k)} aria-pressed={f === k} className={"shrink-0 rounded-full border px-3 py-1.5 text-xs " + (f === k ? "spot-active-pill border-transparent" : "border-border bg-card")}>{l}</button>)}</div>
      {list.length === 0 ? <StateCard icon={History} tone="muted" title="Sin movimientos" text="Aún no hay movimientos de este tipo." action="Ver todo" onAction={() => setF("all")} /> :
        <div className="divide-y divide-border rounded-2xl border border-border bg-card">{list.map((t) => <div key={t.id} className="flex items-center gap-3 p-3.5"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-secondary">{t.kind === "purchase" ? <Plus size={16} /> : t.kind === "refund" ? <Undo2 size={16} /> : t.kind === "bonus" ? <Flame size={16} /> : <Zap size={16} />}</span><span className="min-w-0 flex-1"><strong className="block truncate text-sm">{t.label}</strong><small className={kindMeta[t.kind].cls}>{kindMeta[t.kind].label} · {t.when}</small></span><strong className={t.amount > 0 ? "text-primary" : ""}>{t.amount > 0 ? "+" : ""}{t.amount.toLocaleString("es-ES")} 💎</strong></div>)}</div>}
      <p className="mt-3 text-[11px] text-muted-foreground">Historial de ejemplo. Los movimientos reales se sincronizarán con tu cuenta.</p>
    </Screen>
  );
}

function Premium({ onBack }: { onBack: () => void }) {
  const [buy, setBuy] = useState<null | { t: string; p: number }>(null);
  return (
    <Screen title="Spotly Premium" onBack={onBack} z={60}>
      <div className="rounded-3xl border border-premium/50 bg-spot-surface p-6 text-center"><Crown size={44} className="mx-auto text-premium" /><h3 className="mt-3 text-2xl font-bold">Premium</h3><p className="text-sm text-muted-foreground">Premium <b>no</b> es verificación ni compra reputación: son funciones extra.</p></div>
      <div className="mt-5 space-y-2 text-sm">{["Sin anuncios en el feed", "Ver quién escuchó tus Spots", "Audios de hasta 3 minutos", "200 💎 diamantes cada mes"].map((x) => <p key={x} className="flex gap-2"><Check size={16} className="shrink-0 text-premium" />{x}</p>)}</div>
      <div className="mt-5 grid grid-cols-2 gap-2">{([["Mensual", 4.99], ["Anual", 39.99]] as const).map(([p, v]) => <button key={p} onClick={() => setBuy({ t: `Suscripción Premium ${p.toLowerCase()}`, p: v })} className="rounded-2xl border border-border bg-card p-4 hover:border-premium"><strong className="block">{p}</strong><span className="text-premium">{eur(v)}</span></button>)}</div>
      <p className="mt-3 text-center text-[11px] text-muted-foreground">Se renueva automáticamente. Puedes cancelarla desde los ajustes de tu tienda.</p>
      {buy && <Checkout title={buy.t} kind="digital" lines={[{ label: buy.t, eur: buy.p }]} onClose={() => setBuy(null)} onPaid={() => toast.success("Premium activado (demostración)")} />}
    </Screen>
  );
}

export function Wallet({ onBack, onOpen }: { onBack: () => void; onOpen: (s: Sheet) => void }) {
  const { credits, history } = useStore();
  const [sub, setSub] = useState<null | "premium" | "history">(null);
  const [pack, setPack] = useState(creditPacks.find((p) => p.popular)?.id ?? creditPacks[0]!.id);
  const [buy, setBuy] = useState(false);
  const p = creditPacks.find((x) => x.id === pack)!;
  if (sub === "premium") return <Premium onBack={() => setSub(null)} />;
  if (sub === "history") return <TxHistory onBack={() => setSub(null)} />;
  const uses: [typeof Ghost, string, string, Sheet][] = [
    [Ghost, "Incógnito por tiempo", "Oculta tu identidad pública", "incognito"],
    [Zap, "Impulsar un Spot", "Más distribución, no más reputación", "impulso"],
    [Flame, "Top · Ahora en Spotly", "Franja superior rotatoria", "impulso"],
    [Users, "Promocionar perfil", "Más exposición ante personas reales", "promo-perfil"],
    [Store, "Spotly Local", "Campañas y ofertas para negocios", "local"],
  ];
  return (
    <Screen title="Diamantes Spotly" sub="Publicar y descubrir siempre gratis" onBack={onBack} z={50}>
      <div className="rounded-2xl bg-spot-gradient p-5 shadow-glow"><p className="text-sm opacity-90">Saldo disponible</p><p className="text-4xl font-extrabold">{credits.toLocaleString("es-ES")} <span className="text-base font-semibold">diamantes</span></p><p className="mt-1 text-xs opacity-90">≈ {eur(credits / commerce.creditsPerEur)}</p></div>
      <h3 className="mt-6 font-bold">Recargar</h3><p className="text-xs text-muted-foreground">Verás el precio exacto antes de confirmar.</p>
      <div className="mt-2 space-y-2">{creditPacks.map((c) => <button key={c.id} onClick={() => setPack(c.id)} aria-pressed={pack === c.id} className={"relative flex w-full items-center justify-between rounded-2xl border p-4 text-left " + (pack === c.id ? "border-primary bg-primary/10 shadow-glow" : "border-border bg-card")}>{c.popular && <span className="absolute -top-2 right-3 rounded bg-spot-gradient px-2 py-0.5 text-[10px] font-semibold">Más popular</span>}<span><strong className="block">{c.credits.toLocaleString("es-ES")} diamantes</strong><small className="text-muted-foreground">{c.bonus ? `incluye ${c.bonus} de bonificación 💎` : "sin bonificación"}</small></span><strong>{eur(c.priceEur)}</strong></button>)}</div>
      <Button className="mt-3 h-12 w-full rounded-full bg-spot-gradient text-foreground" onClick={() => setBuy(true)}>Comprar {p.credits.toLocaleString("es-ES")} 💎 · {eur(p.priceEur)}</Button>
      <h3 className="mt-6 font-bold">Qué puedes hacer con tus 💎</h3>
      <div className="mt-2 space-y-2">{uses.map(([I, t, d, s]) => <button key={t} onClick={() => onOpen(s)} className="flex w-full items-center gap-3 rounded-xl border border-border bg-card p-3.5 text-left"><span className="grid h-10 w-10 place-items-center rounded-full bg-secondary text-accent"><I size={18} /></span><span className="flex-1"><strong className="block text-sm">{t}</strong><small className="text-muted-foreground">{d}</small></span><span className="text-muted-foreground">›</span></button>)}</div>
      <button onClick={() => setSub("premium")} className="mt-4 flex w-full items-center gap-3 rounded-xl border border-premium/50 bg-card p-4 text-left"><Crown className="text-premium" /><div className="flex-1"><strong className="block text-sm">Spotly Premium</strong><small className="text-muted-foreground">Suscripción · funciones extra, no verificación</small></div><span className="text-sm text-premium">Ver ›</span></button>
      <div className="mt-6 flex items-center justify-between"><h3 className="font-bold">Últimos movimientos</h3><Button variant="ghost" size="sm" onClick={() => setSub("history")}><History size={14} />Ver todo</Button></div>
      <div className="mt-2 divide-y divide-border rounded-xl border border-border bg-card">{history.slice(0, 3).map((t) => <p key={t.id} className="flex items-center justify-between p-3 text-sm"><span className="truncate pr-2">{t.label}</span><strong className={t.amount > 0 ? "text-primary" : "text-muted-foreground"}>{t.amount > 0 ? "+" : ""}{t.amount} 💎</strong></p>)}</div>
      <div className="mt-4"><Trust>El dinero compra visibilidad adicional o privacidad. No compra reputación, seguidores, veracidad ni inmunidad frente a la moderación.</Trust></div>
      {buy && <Checkout title={`${p.credits.toLocaleString("es-ES")} 💎 Spotly`} kind="digital" lines={[{ label: `${p.credits.toLocaleString("es-ES")} 💎`, eur: p.priceEur }]} onClose={() => setBuy(false)} onPaid={() => { addCredits(p.credits, `Recarga ${p.credits.toLocaleString("es-ES")} créditos`); toast.success(`+${p.credits.toLocaleString("es-ES")} 💎 añadidos`); }} />}
    </Screen>
  );
}

