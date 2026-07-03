import type { Metadata } from "next";
import { Landing } from "./landing";

export const metadata: Metadata = {
  title: "Chehia — Commande à table par QR pour cafés & restaurants tunisiens",
  description:
    "Chehia : la commande à table par QR code, sans application. Menu trilingue, cuisine en temps réel et recommandations intelligentes pour les cafés et restaurants tunisiens.",
};

/** chehia.app root — marketing landing. app.chehia.app maps to the consumer app,
 *  business.chehia.app to the portal, admin.chehia.app to the admin (see middleware). */
export default function Home() {
  return <Landing />;
}
