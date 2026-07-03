import type { MetadataRoute } from "next";

// PWA manifest — served at /manifest.webmanifest and auto-linked by Next.
// Makes "Chehia" the name when the site is added to a home screen.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Chehia — Scannez. Commandez. Régalez-vous.",
    short_name: "Chehia",
    description: "Commande à table par QR code pour les cafés et restaurants tunisiens.",
    start_url: "/",
    display: "standalone",
    background_color: "#FAF6EF",
    theme_color: "#FAF6EF",
    lang: "fr",
    icons: [
      { src: "/favicon.ico", sizes: "any", type: "image/x-icon" },
      // Generated icon routes (see app/icon.tsx, app/apple-icon.tsx).
      { src: "/icon", sizes: "32x32", type: "image/png" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png", purpose: "any" },
    ],
  };
}
