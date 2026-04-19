import { ImageResponse } from "next/og";
import { headers } from "next/headers";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default async function Icon() {
  const h = await headers();
  const host = (h.get("host") ?? "").toLowerCase();
  const isWealth = host.startsWith("wealth.");

  const glyph = isWealth ? (
    <div
      style={{
        fontSize: 30,
        fontWeight: 700,
        letterSpacing: "-0.04em",
        lineHeight: 1,
        color: "#7FFFD4",
        textShadow:
          "0 0 6px rgba(127,255,212,0.6), 0 0 14px rgba(127,255,212,0.35)",
      }}
    >
      W
    </div>
  ) : (
    <div
      style={{
        fontSize: 46,
        fontWeight: 700,
        letterSpacing: "-0.04em",
        lineHeight: 1,
        color: "#ffffff",
        marginTop: -8,
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
          borderRadius: 14,
        }}
      >
        {glyph}
      </div>
    ),
    { ...size },
  );
}
