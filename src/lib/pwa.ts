import { useEffect, useState } from "react";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
let deferred: InstallEvent | null = null;
const listeners = new Set<() => void>();

/** Registra el service worker (solo HTTPS/localhost y en producción). */
export function registerSW() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  if (!import.meta.env.PROD || !(location.protocol === "https:" || location.hostname === "localhost")) return;
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferred = e as InstallEvent; listeners.forEach((l) => l()); });
  window.addEventListener("appinstalled", () => { deferred = null; listeners.forEach((l) => l()); });
  void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
}

export type Platform = "windows" | "android" | "ios" | "other";
export function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  if (/Android/i.test(ua)) return "android";
  if (/Windows/i.test(ua)) return "windows";
  return "other";
}

export function useInstall() {
  const [, force] = useState(0);
  const [platform, setPlatform] = useState<Platform>("other");
  const [installed, setInstalled] = useState(false);
  useEffect(() => {
    setPlatform(detectPlatform());
    setInstalled(window.matchMedia?.("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true);
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);
  const canPrompt = !!deferred;
  const install = async () => {
    if (!deferred) return "manual" as const;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    deferred = null; force((n) => n + 1);
    return outcome;
  };
  return { platform, installed, canPrompt, install };
}
