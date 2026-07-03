import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Generated apple-touch-icon (180×180) — the Chehia zellige mark on cream. */
export default function AppleIcon() {
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
          <div
            style={{
              position: "absolute",
              left: 33,
              top: 33,
              width: 54,
              height: 54,
              background: "#FFFFFF",
              borderRadius: 9,
              display: "flex",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: 33,
              top: 33,
              width: 54,
              height: 54,
              background: "#FFFFFF",
              borderRadius: 9,
              transform: "rotate(45deg)",
              display: "flex",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: 50,
              top: 50,
              width: 20,
              height: 20,
              background: "#BC4B26",
              borderRadius: 999,
              display: "flex",
            }}
          />
        </div>
      </div>
    ),
    { ...size },
  );
}
