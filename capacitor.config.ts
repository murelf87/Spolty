import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Apps de iPhone y Android. La app va empaquetada dentro (no depende de una URL de vista previa):
 *   1. npx vite build -c vite.app.config.ts   (con VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY)
 *   2. npx cap sync   →   npx cap open ios | android
 * Para probar contra un servidor de desarrollo con recarga en vivo, exporta CAP_SERVER_URL=http://<tu-ip>:<puerto>.
 * Guía completa, permisos y lo que falta para las tiendas: docs/APPS_NATIVAS.md
 */
const devServer = process.env["CAP_SERVER_URL"];

const config: CapacitorConfig = {
  appId: "app.lovable.fde3e514c2b943ef9f506758e588bf41",
  appName: "Spotly",
  webDir: "dist-app",
  ...(devServer ? { server: { url: devServer, cleartext: devServer.startsWith("http://") } } : {}),
  ios: { contentInset: "always", backgroundColor: "#0b1020" },
  android: { backgroundColor: "#0b1020" },
};

export default config;
