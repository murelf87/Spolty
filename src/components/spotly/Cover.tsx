/** Portada del perfil: tu foto o uno de los fondos de Spotly. */
export function Cover({ cover, className = "" }: { cover?: string | null | undefined; className?: string }) {
  if (cover && !cover.startsWith("preset:")) return <img src={cover} alt="" className={"object-cover " + className} />;
  const name = cover?.slice(7) || "neon";
  return <div aria-hidden="true" className={`spot-cover-${name} ` + className} />;
}
