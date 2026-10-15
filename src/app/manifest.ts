import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "CBC Shuffle — Conshohocken Bocce Club Shuffleboard",
    short_name: "CBC Shuffle",
    description: "Live scores, standings, schedule and trash talk for the Conshohocken Bocce Club shuffleboard league.",
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0b1f17",
    theme_color: "#0b1f17",
    categories: ["sports", "social"],
    icons: [
      { src: "/icons/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Keep Score", url: "/?shortcut=score", icons: [{ src: "/icons/192", sizes: "192x192" }] },
      { name: "Standings", url: "/standings" },
      { name: "Trash Talk", url: "/chat" },
    ],
  };
}
