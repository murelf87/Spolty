import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Build instalable (PWA) para probar Spotly en un móvil real, en modo demostración y sin backend.
 * Rutas relativas para que funcione en cualquier subcarpeta (p. ej. https://murelf87.github.io/Spolty/).
 * No forma parte de la app de producción (que se compila con vite.config.ts).
 * Uso: npx vite build -c vite.mobile.config.ts  →  dist-mobile/
 */

/** Los pesos del detector facial no se usan en la demo (face-api está sustituido por un stub). */
function skipFaceModels(): Plugin {
  return {
    name: "spotly-mobile:skip-face-models",
    enforce: "pre",
    load(id) { return /[\\/]assets[\\/]models[\\/].*\.bin(\?|$)/.test(id) ? 'export default ""' : null; },
  };
}

const manifest = {
  id: "./",
  name: "Spotly",
  short_name: "Spotly",
  description: "Less typing. More talking. Descubre lo que pasa cerca de ti con tu voz.",
  start_url: "./",
  scope: "./",
  display: "standalone",
  orientation: "portrait",
  background_color: "#0b1020",
  theme_color: "#0b1020",
  lang: "es",
  categories: ["social", "lifestyle"],
  icons: [
    { src: "icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
    { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
  ],
  shortcuts: [
    { name: "Crear Spot", url: "./?accion=crear", icons: [{ src: "icon-192.png", sizes: "192x192" }] },
    { name: "Buscar con la voz", url: "./?accion=buscar", icons: [{ src: "icon-192.png", sizes: "192x192" }] },
  ],
};

/* Red primero y caché de respaldo, todo relativo al alcance del service worker. Los vídeos (peticiones con
   Range) los gestiona el navegador directamente. */
const serviceWorker = `const CACHE = "spotly-movil-v1";
const BASE = new URL("./", self.location).href;
const SHELL = ["./", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png", "./favicon.png"].map((p) => new URL(p, BASE).href);
self.addEventListener("install", (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || !req.url.startsWith(BASE) || req.headers.has("range")) return;
  e.respondWith(fetch(req).then((res) => {
    if (res.status === 200) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => undefined); }
    return res;
  }).catch(() => caches.match(req).then((r) => r || caches.match(BASE))));
});
`;

/* Proyecto mínimo de Expo para abrir esta misma web dentro de Expo Go (Snack con sourceUrl a este archivo). */
const expoApp = `import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

// Spotly (versión de demostración) dentro de Expo Go: muestra la web instalable a pantalla completa.
const SPOTLY = 'https://murelf87.github.io/Spolty/';

export default function App() {
  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <StatusBar style="light" />
        <WebView
          source={{ uri: SPOTLY }}
          style={styles.web}
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          mediaCapturePermissionGrantType="grant"
          pullToRefreshEnabled
          startInLoadingState
          renderLoading={() => (
            <View style={styles.loading}>
              <ActivityIndicator size="large" color="#22d3ee" />
            </View>
          )}
        />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0b1020' },
  web: { flex: 1, backgroundColor: '#0b1020' },
  loading: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0b1020' },
});
`;

/** Manifiesto, service worker, iconos, .nojekyll y el App.js de Expo Go para GitHub Pages. */
function pwaFiles(): Plugin {
  return {
    name: "spotly-mobile:pwa-files",
    generateBundle() {
      this.emitFile({ type: "asset", fileName: "manifest.webmanifest", source: JSON.stringify(manifest, null, 2) });
      this.emitFile({ type: "asset", fileName: "sw.js", source: serviceWorker });
      this.emitFile({ type: "asset", fileName: ".nojekyll", source: "" });
      this.emitFile({ type: "asset", fileName: "expo/App.js", source: expoApp });
      for (const icon of ["icon-192.png", "icon-512.png", "favicon.png"]) {
        this.emitFile({ type: "asset", fileName: icon, source: readFileSync(path.resolve(__dirname, "public", icon)) });
      }
    },
  };
}

export default defineConfig({
  root: "mobile",
  base: "./",
  publicDir: false,
  plugins: [skipFaceModels(), react(), tailwindcss(), pwaFiles()],
  resolve: { alias: { "@": path.resolve(__dirname, "src"), "@vladmandic/face-api": path.resolve(__dirname, "src/lib/face-api-stub.ts") } },
  define: {
    "import.meta.env.VITE_SUPABASE_URL": JSON.stringify("https://preview.invalid"),
    "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify("preview"),
  },
  build: { outDir: "../dist-mobile", emptyOutDir: true, chunkSizeWarningLimit: 4000 },
});
