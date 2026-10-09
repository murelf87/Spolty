import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Compilación de las apps nativas (Capacitor, iPhone y Android): la misma app de producción como web estática que se
 * empaqueta dentro de la app, con la nube ACTIVADA (mismas cuentas y datos que la web).
 * Necesita VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY (de un .env o del entorno); la clave publicable no es
 * secreta (ya viaja en la web), pero no se guarda en el repositorio.
 * Uso: npx vite build -c vite.app.config.ts  →  dist-app/  y después  npx cap sync  (ver docs/APPS_NATIVAS.md)
 */

/** Iconos de la app junto al index (Capacitor sirve dist-app tal cual). */
function appIcons(): Plugin {
  return {
    name: "spotly-app:icons",
    generateBundle() {
      for (const icon of ["icon-192.png", "icon-512.png", "favicon.png"]) {
        this.emitFile({ type: "asset", fileName: icon, source: readFileSync(path.resolve(__dirname, "public", icon)) });
      }
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), "VITE_"), ...process.env };
  const url = env["VITE_SUPABASE_URL"];
  const key = env["VITE_SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) {
    throw new Error("Faltan VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY para compilar las apps nativas (docs/APPS_NATIVAS.md).");
  }
  return {
    root: "app",
    base: "./",
    publicDir: false,
    plugins: [react(), tailwindcss(), appIcons()],
    resolve: { alias: { "@": path.resolve(__dirname, "src") } },
    define: {
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(url),
      "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(key),
      "import.meta.env.VITE_SPOTLY_CLOUD": JSON.stringify("on"),
    },
    build: { outDir: "../dist-app", emptyOutDir: true, chunkSizeWarningLimit: 4000 },
  };
});
