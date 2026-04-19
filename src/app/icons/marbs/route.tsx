import { ImageResponse } from "next/og";

export const runtime = "edge";
export const contentType = "image/png";

export function GET() {
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
      </div>
    ),
    { width: 64, height: 64 },
  );
}
