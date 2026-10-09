import { useState } from "react";
import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useApp } from "./app-context";
import { toggleFollow, useStore } from "@/lib/store";
import beach from "@/assets/spotly-beach-club.jpg";
import stage from "@/assets/spotly-live-stage.jpg";
import festival from "@/assets/spotly-sevilla-festival.jpg";
import { TopBar } from "./kit";

/* Últimos seguidores reales: cada persona decidió seguir voluntariamente. */
const people = [["Carlos", "Sevilla · Hace 2 min", stage], ["Sofía", "Triana · Hace 4 min", beach], ["Javi", "Cerca de ti · Hace 6 min", festival], ["Ana", "Sevilla · Hace 8 min", beach], ["Miguel", "A 3 km · Hace 10 min", stage]] as const;
export function NewFollowers({ onClose }: { onClose: () => void }) {
  const { following } = useStore();
  const [, force] = useState(0);
  return <div className="fixed inset-0 z-[70] overflow-y-auto bg-background">
    <TopBar title="Últimos seguidores" onBack={onClose} sticky />
    <div className="space-y-2 px-4 pb-[max(2rem,calc(env(safe-area-inset-bottom)+1rem))] pt-3">{people.map(([n, s, img]) => { const on = following.includes(n); return <div key={n} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3"><img src={img} alt="" className="h-11 w-11 rounded-full object-cover" /><div className="flex-1"><p className="text-sm font-semibold">{n} <span className="text-primary">✦</span></p><p className="text-xs text-muted-foreground">{s}</p></div><button onClick={() => { toggleFollow(n); force((x) => x + 1); }} className={"min-h-9 rounded-full px-4 py-1.5 text-xs font-semibold " + (on ? "border border-border" : "bg-spot-gradient")}>{on ? "Siguiendo" : "Seguir"}</button></div>; })}</div>
  </div>;
}

/* Promoción de perfil: se compra exposición, nunca seguidores. */
export function GrowCard() {
  const app = useApp();
  return (
    <div className="mx-3 rounded-lg border border-primary/40 bg-card p-4">
      <p className="flex items-center gap-2 text-sm font-bold"><Users size={17} className="text-primary" />Haz que más personas descubran tu perfil</p>
      <p className="mt-1 text-xs text-muted-foreground">Muestra tu perfil a más personas de tu zona. Ellas deciden si te siguen o no.</p>
      <Button className="mt-3 w-full" onClick={() => app.open("promo-perfil")}>Promocionar mi perfil</Button>
    </div>
  );
}
