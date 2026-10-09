import { useEffect, useState } from "react";
import { Ban, EyeOff, Flag, ShieldCheck, Trash2, Undo2, UserX } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Chip, Screen, StateCard, Trust } from "./kit";
import { unblockUser, useStore } from "@/lib/store";
import { api, cloudErrorText, cloudUid, db, useCloud } from "@/lib/cloud";
import { PersonAvatar } from "./CloudPeople";

const statusMeta = { review: ["En revisión", "bg-premium/20 text-premium"], resolved: ["Resuelta", "bg-primary/20 text-primary"], removed: ["Contenido eliminado", "bg-live/20 text-live"] } as const;

const TARGET = { spot: "Spot", voice: "Voz", profile: "Perfil", chat: "Chat" } as Record<string, string>;
const agoText = (iso: string) => { const d = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 86400000)); return d === 0 ? "Hoy" : d === 1 ? "Ayer" : `Hace ${d} días`; };

export function SafetyCenter({ onBack }: { onBack: () => void }) {
  const store = useStore();
  const cloud = useCloud();
  const [tab, setTab] = useState<"Bloqueados" | "Denuncias" | "Normas">("Bloqueados");
  /* Con la nube: a quién has bloqueado de verdad y el estado real de tus denuncias. */
  const [cloudBlocked, setCloudBlocked] = useState<api.ProfileRow[] | null>(null);
  const [cloudReports, setCloudReports] = useState<api.ReportRow[] | null>(null);
  useEffect(() => {
    const uid = cloudUid();
    if (!cloud.on || !uid) return;
    void api.fetchBlocked(db(), uid).then(setCloudBlocked).catch(() => setCloudBlocked([]));
    void api.fetchMyReports(db(), uid).then(setCloudReports).catch(() => setCloudReports([]));
  }, [cloud.on]);
  const unblockCloud = (p: api.ProfileRow) => {
    const uid = cloudUid();
    if (!uid) return;
    void api.block(db(), uid, p.id, false).then(() => { setCloudBlocked((l) => (l ?? []).filter((x) => x.id !== p.id)); toast(`${p.display_name || p.username} desbloqueado`); }).catch((e) => toast.error(cloudErrorText(e)));
  };
  const blocked = cloud.on ? (cloudBlocked ?? []).map((p) => p.display_name || `@${p.username}`) : store.blocked;
  const reports = cloud.on ? (cloudReports ?? []).map((r) => ({ id: r.id, what: `${TARGET[r.target_type] ?? "Contenido"} denunciado`, reason: r.reason, status: r.status, when: agoText(r.created_at) })) : store.reports;
  return (
    <Screen title="Bloqueos y denuncias" sub="Seguridad y normas" onBack={onBack} z={60}>
      <div className="flex gap-2">{(["Bloqueados", "Denuncias", "Normas"] as const).map((t) => <Chip key={t} active={tab === t} onClick={() => setTab(t)}>{t}{t === "Bloqueados" ? ` · ${blocked.length}` : t === "Denuncias" ? ` · ${reports.length}` : ""}</Chip>)}</div>
      {tab === "Bloqueados" && <div className="mt-3">{blocked.length === 0 ? <StateCard icon={UserX} tone="muted" title="No has bloqueado a nadie" text="Puedes bloquear desde el menú ⋯ de cualquier Spot o perfil, incluidos autores incógnito." /> : <div className="divide-y divide-border rounded-2xl border border-border bg-card px-3">{cloud.on ? (cloudBlocked ?? []).map((p) => <div key={p.id} className="flex items-center gap-3 py-3"><PersonAvatar p={p} className="h-10 w-10" /><span className="min-w-0 flex-1"><span className="block truncate text-sm">{p.display_name || p.username}</span><small className="block truncate text-xs text-muted-foreground">@{p.username}</small></span><Button size="sm" variant="outline" onClick={() => unblockCloud(p)}><Undo2 size={13} />Desbloquear</Button></div>)
        : blocked.map((b) => <div key={b} className="flex items-center gap-3 py-3"><span className="grid h-10 w-10 place-items-center rounded-full bg-secondary font-bold">{b[0]}</span><span className="flex-1 truncate text-sm">{b}</span><Button size="sm" variant="outline" onClick={() => { unblockUser(b); toast(`${b} desbloqueado`); }}><Undo2 size={13} />Desbloquear</Button></div>)}</div>}<p className="mt-3 text-xs text-muted-foreground">Las personas bloqueadas no pueden escucharte, responderte ni verte en el mapa.</p></div>}
      {tab === "Denuncias" && <div className="mt-3 space-y-2">{reports.length === 0 ? <StateCard icon={Flag} tone="muted" title="Sin denuncias" text="Las denuncias que envíes aparecerán aquí con su estado." /> : reports.map((r) => <div key={r.id} className="rounded-xl border border-border bg-card p-3"><div className="flex items-center justify-between gap-2"><strong className="truncate text-sm">{r.what}</strong><span className={"shrink-0 rounded-full px-2 py-0.5 text-3xs font-bold " + statusMeta[r.status][1]}>{statusMeta[r.status][0]}</span></div><p className="mt-1 text-xs text-muted-foreground">{r.reason} · {r.when}</p></div>)}<p className="text-xs text-muted-foreground">Tu denuncia es anónima para el autor. Revisamos cada caso, también los de autores incógnito.</p></div>}
      {tab === "Normas" && <div className="mt-3 space-y-2">{[[ShieldCheck, "Todas las cuentas entran con Apple, Google o un correo confirmado."], [EyeOff, "Incógnito oculta tu identidad pública, no tu responsabilidad."], [Ban, "Pagar no elimina las normas ni evita la moderación."], [Trash2, "Contenido que incumpla las normas se elimina y puede limitar la cuenta."], [Flag, "Denunciar, bloquear y limitar el acoso o el spam siempre es gratis."]].map(([I, t]) => { const Ic = I as typeof Flag; return <p key={String(t)} className="flex items-start gap-3 rounded-xl border border-border bg-card p-3 text-sm"><Ic size={16} className="mt-0.5 shrink-0 text-primary" />{String(t)}</p>; })}<Trust>El dinero compra visibilidad o privacidad pública. No compra reputación, seguidores, veracidad ni inmunidad.</Trust></div>}
    </Screen>
  );
}

/** Estados de tarjeta: contenido eliminado, denunciado o de usuario bloqueado. */
export function ContentState({ kind, who, onUndo }: { kind: "deleted" | "reported" | "blocked"; who: string; onUndo?: () => void }) {
  const m = { deleted: [Trash2, "Contenido eliminado", "Este Spot ya no está disponible."], reported: [Flag, "Spot denunciado", "Gracias. Lo revisaremos y no lo verás mientras tanto."], blocked: [UserX, "Usuario bloqueado", `Has bloqueado a ${who}. No verás sus Spots.`] } as const;
  const [I, t, d] = m[kind];
  return <div className="mx-3 flex items-center gap-3 rounded-xl border border-dashed border-border bg-card/60 p-4"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-secondary text-muted-foreground"><I size={18} /></span><span className="min-w-0 flex-1"><strong className="block text-sm">{t}</strong><small className="text-muted-foreground">{d}</small></span>{onUndo && <Button size="sm" variant="ghost" onClick={onUndo}>Deshacer</Button>}</div>;
}
