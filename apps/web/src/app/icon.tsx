import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

/** Generated favicon — the Chehia zellige mark on harissa (mirrors opengraph-image.tsx). */
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#BC4B26",
        }}
      >
        <div style={{ position: "relative", width: 32, height: 32, display: "flex" }}>
          <div
            style={{
              position: "absolute",
              left: 9,
              top: 9,
              width: 14,
              height: 14,
              background: "#FFFFFF",
              borderRadius: 3,
              display: "flex",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: 9,
              top: 9,
              width: 14,
              height: 14,
              background: "#FFFFFF",
              borderRadius: 3,
              transform: "rotate(45deg)",
              display: "flex",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: 13,
              top: 13,
              width: 6,
              height: 6,
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
