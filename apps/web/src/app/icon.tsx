import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

/** Generated favicon — the Chehia "Scan & Fork" mark (cream fork on harissa). */
export default function Icon() {
  const tine = (left: number) => ({
    position: "absolute" as const,
    left,
    top: 5,
    width: 2.6,
    height: 12,
    background: "#FFFFFF",
    borderRadius: 1.3,
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
          background: "#BC4B26",
          borderRadius: 8,
        }}
      >
        <div style={{ position: "relative", width: 22, height: 24, display: "flex" }}>
          <div style={tine(5)} />
          <div style={tine(9.7)} />
          <div style={tine(14.4)} />
          <div style={{ position: "absolute", left: 5, top: 15, width: 12, height: 2.8, background: "#FFFFFF", borderRadius: 1.4, display: "flex" }} />
          <div style={{ position: "absolute", left: 9.7, top: 17, width: 2.6, height: 9, background: "#FFFFFF", borderRadius: 1.3, display: "flex" }} />
        </div>
      </div>
    ),
    { ...size },
  );
}
