import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AuthorProfile, SpotDetail } from "./SpotDetail";
import { spotData, type SpotData } from "./spotData";
import { api, db, fileUrl, useCloud } from "@/lib/cloud";
import { loadCloudSpot } from "@/lib/spots";
import { useMe } from "@/lib/store";

/**
 * Abre lo que llega en un enlace compartido: ?spot=<id> (ese Spot) o ?perfil=<usuario> (ese perfil). Espera a que
 * haya sesión y nube; después quita el parámetro de la dirección para no volver a abrirlo.
 */
export function SharedLink() {
  const cloud = useCloud();
  const me = useMe();
  const [spot, setSpot] = useState<SpotData | null>(null);
  const [person, setPerson] = useState<api.ProfileRow | null>(null);
  useEffect(() => {
    if (!cloud.on || typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const spotId = url.searchParams.get("spot"), username = url.searchParams.get("perfil");
    if (!spotId && !username) return;
    url.searchParams.delete("spot"); url.searchParams.delete("perfil");
    window.history.replaceState(null, "", url.pathname + (url.search ? url.search : "") + url.hash);
    if (spotId && /^[0-9a-f-]{36}$/i.test(spotId)) {
      void loadCloudSpot(spotId).then((m) => { if (m) setSpot(spotData(m, me.name)); else toast("Ese Spot ya no está disponible."); }).catch(() => toast.error("No se pudo abrir el enlace."));
    } else if (username) {
      void api.fetchProfileByUsername(db(), username).then((p) => { if (p) setPerson(p); else toast("Ese perfil no existe."); }).catch(() => toast.error("No se pudo abrir el enlace."));
    }
  }, [cloud.on, me.name]);
  if (spot) return <SpotDetail s={spot} onClose={() => setSpot(null)} onAuthor={() => setSpot(null)} />;
  if (person) return <AuthorProfile name={person.display_name || person.username} id={person.id} avatar={fileUrl(person.avatar_path)} onClose={() => setPerson(null)} />;
  return null;
}
