import { useEffect, useState } from "react";
import { Loader2, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BottomSheet } from "./kit";
import { api, cloudUid, db, fileUrl, followId, useCloud } from "@/lib/cloud";

/** Foto de una persona de la nube, o su inicial si no tiene. */
export function PersonAvatar({ p, className = "h-11 w-11" }: { p: { display_name?: string; username?: string; name?: string; avatar_path?: string | null; avatar?: string | null }; className?: string }) {
  const src = p.avatar ?? fileUrl(p.avatar_path ?? null);
  const who = p.display_name || p.name || p.username || "?";
  return src
    ? <img src={src} alt="" className={"shrink-0 rounded-full object-cover " + className} />
    : <span aria-hidden="true" className={"grid shrink-0 place-items-center rounded-full bg-spot-gradient font-bold text-foreground " + className}>{(who.replace("@", "").trim()[0] ?? "?").toUpperCase()}</span>;
}

/** Botón Seguir / Siguiendo para una persona de la nube. */
export function FollowButton({ id, className = "" }: { id: string; className?: string }) {
  const { following, uid } = useCloud();
  const [busy, setBusy] = useState(false);
  if (!uid || id === uid) return null;
  const on = following.includes(id);
  return <Button size="sm" variant={on ? "secondary" : "default"} disabled={busy} className={"shrink-0 rounded-full " + className} onClick={() => { setBusy(true); void followId(id, !on).finally(() => setBusy(false)); }}>{on ? "Siguiendo" : "Seguir"}</Button>;
}

/** Seguidores y Siguiendo de una persona (tú o cualquiera), con su perfil público. */
export function CloudPeopleSheet({ userId, kind, onSwitch, onClose, onOpen }: { userId: string; kind: "Seguidores" | "Siguiendo"; onSwitch: (k: "Seguidores" | "Siguiendo") => void; onClose: () => void; onOpen: (p: api.ProfileRow) => void }) {
  const [list, setList] = useState<api.ProfileRow[] | null>(null);
  const [error, setError] = useState(false);
  const [tick, setTick] = useState(0);
  const mine = userId === cloudUid();
  useEffect(() => {
    let alive = true;
    setList(null); setError(false);
    api.fetchPeople(db(), userId, kind === "Seguidores" ? "followers" : "following").then((l) => { if (alive) setList(l); }).catch(() => { if (alive) setError(true); });
    return () => { alive = false; };
  }, [userId, kind, tick]);
  return (
    <BottomSheet title={kind} onClose={onClose} z={75}>
      <div className="mb-3 grid grid-cols-2 gap-1 rounded-xl bg-secondary p-1">
        {(["Seguidores", "Siguiendo"] as const).map((k) => <button key={k} onClick={() => onSwitch(k)} aria-pressed={k === kind} className={"rounded-lg py-2 text-xs font-semibold " + (k === kind ? "spot-active-pill text-foreground" : "text-muted-foreground")}>{k}</button>)}
      </div>
      {error && <div className="py-6 text-center"><WifiOff className="mx-auto text-muted-foreground" size={24} /><p className="mt-2 text-sm text-muted-foreground">No se pudo cargar.</p><Button variant="secondary" size="sm" className="mt-3" onClick={() => setTick((t) => t + 1)}>Reintentar</Button></div>}
      {!error && !list && <div className="grid place-items-center py-8"><Loader2 className="animate-spin text-primary" size={24} /></div>}
      {list && list.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">{kind === "Siguiendo" ? (mine ? "Aún no sigues a nadie. Sigue a personas desde sus Spots o su perfil." : "Aún no sigue a nadie.") : mine ? "Aún no tienes seguidores. Cuando alguien te siga, aparecerá aquí." : "Aún no tiene seguidores."}</p>}
      <div className="space-y-1">
        {list?.map((p) => (
          <div key={p.id} className="flex items-center gap-3 rounded-xl px-1 py-2">
            <button onClick={() => onOpen(p)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
              <PersonAvatar p={p} />
              <span className="min-w-0"><strong className="block truncate text-sm">{p.display_name || p.username}</strong><small className="block truncate text-xs text-muted-foreground">@{p.username}{p.city ? ` · ${p.city}` : ""}</small></span>
            </button>
            <FollowButton id={p.id} />
          </div>
        ))}
      </div>
    </BottomSheet>
  );
}
