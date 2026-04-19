import { ImageResponse } from "next/og";
import { headers } from "next/headers";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default async function AppleIcon() {
  const h = await headers();
  const host = (h.get("host") ?? "").toLowerCase();
  const isWealth = host.startsWith("wealth.");

  const glyph = isWealth ? (
    <div
      style={{
        fontSize: 88,
        fontWeight: 700,
        letterSpacing: "-0.04em",
        lineHeight: 1,
        color: "#7FFFD4",
        textShadow:
          "0 0 18px rgba(127,255,212,0.55), 0 0 40px rgba(127,255,212,0.3)",
      }}
    >
      W
    </div>
  ) : (
    <div
      style={{
        fontSize: 130,
        fontWeight: 700,
        letterSpacing: "-0.04em",
        lineHeight: 1,
        color: "#ffffff",
        marginTop: -22,
      }}
    >
      m
    </div>
  );

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#000",
          borderRadius: 38,
        }}
      >
        {glyph}
      </div>
    ),
    { ...size },
  );
}
