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
          background:
            "radial-gradient(circle at 30% 20%, #0a1a15 0%, #000 60%)",
          borderRadius: 14,
        }}
      >
        <svg
          width="44"
          height="44"
          viewBox="0 0 44 44"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Stylized M with right-peak extending as an upward tick */}
          <path
            d="M 7 34 L 7 10 L 16 10 L 22 22 L 28 10 L 37 10 L 37 28 M 34 24 L 37 21 L 40 24"
            stroke="#7FFFD4"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          {/* Pulse dot */}
          <circle cx="38" cy="8" r="2.5" fill="#7FFFD4" />
        </svg>
      </div>
    ),
    { ...size },
  );
}
