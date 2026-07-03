import { ImageResponse } from "next/og";

export const alt = "Chehia — Scannez. Commandez. Régalez-vous.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Branded social-share card (1200×630) in the Chehia palette. */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 26,
          background: "#FAF6EF",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ position: "relative", width: 128, height: 128, background: "#BC4B26", borderRadius: 34, display: "flex" }}>
          <div style={{ position: "absolute", left: 35, top: 35, width: 58, height: 58, background: "#FFFFFF", borderRadius: 9, display: "flex" }} />
          <div style={{ position: "absolute", left: 35, top: 35, width: 58, height: 58, background: "#FFFFFF", borderRadius: 9, transform: "rotate(45deg)", display: "flex" }} />
          <div style={{ position: "absolute", left: 53, top: 53, width: 22, height: 22, background: "#BC4B26", borderRadius: 999, display: "flex" }} />
        </div>
        <div style={{ display: "flex", fontSize: 104, fontWeight: 800, color: "#221A13", letterSpacing: -2 }}>
          chehia<span style={{ color: "#BC4B26" }}>.</span>
        </div>
        <div style={{ display: "flex", fontSize: 34, fontWeight: 700, color: "#6E6257" }}>
          Scannez. Commandez. Régalez-vous.
        </div>
        <div style={{ display: "flex", fontSize: 22, fontWeight: 600, color: "#9A8D80" }}>
          Commande à table par QR · cafés &amp; restaurants tunisiens
        </div>
      </div>
    ),
    { ...size },
  );
}
