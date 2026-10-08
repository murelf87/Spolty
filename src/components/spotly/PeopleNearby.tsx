import { useEffect, useState } from "react";
import { api, cloudUid, db, fileUrl, useCloud } from "@/lib/cloud";
import { useMe } from "@/lib/store";
import { FollowButton, PersonAvatar } from "./CloudPeople";
import { AuthorProfile } from "./SpotDetail";

/** Con la nube: personas reales de tu ciudad y las últimas en llegar a Spotly (encima de las de ejemplo). */
export function CloudPeopleNearby() {
  const cloud = useCloud();
  const me = useMe();
  const [city, setCity] = useState<api.ProfileRow[] | null>(null);
  const [fresh, setFresh] = useState<api.ProfileRow[] | null>(null);
  const [open, setOpen] = useState<api.ProfileRow | null>(null);
  useEffect(() => {
    if (!cloud.on) return;
    const uid = cloudUid() ?? undefined;
    void api.discoverPeople(db(), { city: me.city, exclude: uid, limit: 20 }).then(setCity).catch(() => setCity([]));
    void api.discoverPeople(db(), { exclude: uid, limit: 12 }).then(setFresh).catch(() => setFresh([]));
  }, [cloud.on, me.city]);
  if (!cloud.on) return null;
  const row = (p: api.ProfileRow) => (
    <div key={p.id} className="flex w-full items-center gap-3 rounded-xl border border-border bg-card p-3">
      <button onClick={() => setOpen(p)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <div className="h-12 w-12 shrink-0 rounded-full bg-spot-gradient p-[0.125rem]"><PersonAvatar p={p} className="h-full w-full text-base" /></div>
        <div className="min-w-0"><p className="truncate font-semibold">{p.display_name || p.username}</p><p className="truncate text-xs text-muted-foreground">@{p.username}{p.city ? ` · ${p.city}` : ""} · {p.spots} Spots</p></div>
      </button>
      <FollowButton id={p.id} />
    </div>
  );
  const others = (fresh ?? []).filter((p) => !(city ?? []).some((c) => c.id === p.id));
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold">En {me.city || "tu ciudad"}</h3>
      {!city && <p className="py-3 text-center text-xs text-muted-foreground">Buscando…</p>}
      {city && !city.length && <p className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">Aún no hay nadie más de {me.city || "tu ciudad"} en Spotly. ¡Invita a tu gente!</p>}
      {city?.map(row)}
      {others.length > 0 && <><h3 className="pt-2 text-sm font-bold">Nuevas en Spotly</h3>{others.map(row)}</>}
      {open && <AuthorProfile name={open.display_name || open.username} id={open.id} avatar={fileUrl(open.avatar_path)} onClose={() => setOpen(null)} />}
    </div>
  );
}
