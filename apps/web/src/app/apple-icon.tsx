import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Generated apple-touch-icon (180×180) — Chehia "Scan & Fork" on harissa/cream. */
export default function AppleIcon() {
  const tine = (left: number) => ({
    position: "absolute" as const,
    left,
    top: 48,
    width: 5.5,
    height: 28,
    background: "#FFFFFF",
    borderRadius: 2.5,
    display: "flex" as const,
  });
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#FAF6EF",
        }}
      >
        <div style={{ position: "relative", width: 120, height: 120, background: "#BC4B26", borderRadius: 34, display: "flex" }}>
          {/* "scan" QR finder, top-left */}
          <div style={{ position: "absolute", left: 24, top: 24, width: 30, height: 30, borderRadius: 8, border: "7px solid #FFFFFF", display: "flex" }} />
          {/* fork */}
          <div style={tine(62)} />
          <div style={tine(70.5)} />
          <div style={tine(79)} />
          <div style={{ position: "absolute", left: 62, top: 71, width: 22.5, height: 6, background: "#FFFFFF", borderRadius: 3, display: "flex" }} />
          <div style={{ position: "absolute", left: 70.5, top: 75, width: 6, height: 26, background: "#FFFFFF", borderRadius: 3, display: "flex" }} />
        </div>
      </div>
    ),
    { ...size },
  );
}
