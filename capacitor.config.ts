import type { CapacitorConfig } from "@capacitor/cli";

// Wraps the deployed PWA for the App Store / Play Store later.
// Run: npx cap add ios && npx cap add android && npx cap sync
const config: CapacitorConfig = {
  appId: "org.conshybocce.shuffle",
  appName: "CBC Shuffle",
  webDir: "public",
  server: {
    url: process.env.CAPACITOR_SERVER_URL ?? "https://cbc-shuffle.vercel.app",
    cleartext: false,
  },
  ios: { contentInset: "automatic", backgroundColor: "#0b1f17" },
  android: { backgroundColor: "#0b1f17" },
};

export default config;
