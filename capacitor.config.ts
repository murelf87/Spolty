import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.lovable.fde3e514c2b943ef9f506758e588bf41",
  appName: "Spotly",
  webDir: "dist/client",
  server: {
    url: "https://id-preview--fde3e514-c2b9-43ef-9f50-6758e588bf41.lovable.app?forceHideBadge=true",
    cleartext: true,
  },
  ios: { contentInset: "always", backgroundColor: "#0b1020" },
  android: { backgroundColor: "#0b1020" },
};

export default config;
