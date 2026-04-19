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
          background:
            "radial-gradient(circle at 28% 18%, #0d1f1a 0%, #000 65%)",
          borderRadius: 38,
        }}
      >
        <svg
          width="124"
          height="124"
          viewBox="0 0 44 44"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M 7 34 L 7 10 L 16 10 L 22 22 L 28 10 L 37 10 L 37 28 M 34 24 L 37 21 L 40 24"
            stroke="#7FFFD4"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <circle cx="38" cy="8" r="2.5" fill="#7FFFD4" />
        </svg>
      </div>
    ),
    { ...size },
  );
}
