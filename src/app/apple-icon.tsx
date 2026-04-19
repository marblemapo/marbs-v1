import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

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
          background: "#000",
          borderRadius: 38,
        }}
      >
        <div
          style={{
            fontSize: 124,
            fontWeight: 700,
            letterSpacing: "-0.04em",
            lineHeight: 1,
            color: "#7FFFD4",
            textShadow:
              "0 0 18px rgba(127,255,212,0.55), 0 0 40px rgba(127,255,212,0.3)",
          }}
        >
          m
        </div>
      </div>
    ),
    { ...size },
  );
}
