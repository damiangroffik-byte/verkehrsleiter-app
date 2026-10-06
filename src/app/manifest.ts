import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Verkehrsleiter",
    short_name: "Verkehrsleiter",
    description: "Abfahrtskontrolle, Führerscheinkontrolle und Unterweisungen",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f5f2",
    theme_color: "#0f227b",
    lang: "de",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
