import { ImageResponse } from "next/og";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

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
          background: "#000",
          borderRadius: 14,
        }}
      >
        <div
          style={{
            fontSize: 44,
            fontWeight: 700,
            letterSpacing: "-0.04em",
            lineHeight: 1,
            color: "#7FFFD4",
            textShadow:
              "0 0 6px rgba(127,255,212,0.6), 0 0 14px rgba(127,255,212,0.35)",
          }}
        >
          m
        </div>
      </div>
    ),
    { ...size },
  );
}
