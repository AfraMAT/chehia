import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Generated apple-touch-icon (180×180) — Chehia steaming-cup mark on harissa/cream. */
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
        <div
          style={{
            width: 120,
            height: 120,
            background: "#BC4B26",
            borderRadius: 34,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg width="76" height="76" viewBox="0 0 100 100">
            <g transform="translate(50,52) scale(0.62)" fill="#FFFFFF">
              <path d="M -44 -4 h 70 v 20 a 35 35 0 0 1 -70 0 z" />
              <path d="M 26 2 h 14 a 17 17 0 0 1 0 34 h -8 v -12 h 6 a 5 5 0 0 0 0 -10 h -12 z" />
              <g stroke="#FFFFFF" strokeWidth="6.5" strokeLinecap="round" fill="none">
                <path d="M -22 -20 q 8 -11 0 -24" />
                <path d="M -1 -20 q 8 -11 0 -24" />
                <path d="M 19 -20 q 8 -11 0 -24" />
              </g>
            </g>
          </svg>
        </div>
      </div>
    ),
    { ...size },
  );
}
