import { ImageResponse } from "next/og";

export const alt = "Marbs — Your net worth, private by default";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background:
            "radial-gradient(ellipse 80% 55% at 18% 8%, rgba(127,255,212,0.22), transparent 60%),radial-gradient(ellipse 70% 55% at 88% 92%, rgba(127,255,212,0.14), transparent 60%),#000",
          color: "#fff",
          fontFamily: "Inter, sans-serif",
        }}
      >
        {/* Top: mark + wallet pill */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 20,
            }}
          >
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: 16,
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(127,255,212,0.3)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg
                width="48"
                height="48"
                viewBox="0 0 44 44"
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
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 18px",
                borderRadius: 100,
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.1)",
                fontSize: 20,
                color: "#ebebf5",
                fontFamily: "monospace",
                letterSpacing: "0.04em",
              }}
            >
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: "#7FFFD4",
                  boxShadow: "0 0 16px #7FFFD4",
                }}
              />
              Marbs · V1
            </div>
          </div>
          <div
            style={{
              fontSize: 22,
              color: "#8e8e93",
              fontFamily: "monospace",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
            }}
          >
            wealth.marbs.io
          </div>
        </div>

        {/* Middle: hero */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div
            style={{
              fontSize: 110,
              fontWeight: 700,
              lineHeight: 1,
              letterSpacing: "-0.035em",
              color: "#fff",
            }}
          >
            Your net worth,
          </div>
          <div
            style={{
              fontSize: 110,
              fontWeight: 700,
              lineHeight: 1,
              letterSpacing: "-0.035em",
              color: "#7FFFD4",
            }}
          >
            private by default.
          </div>
        </div>

        {/* Bottom: subcopy */}
        <div
          style={{
            fontSize: 30,
            color: "#8e8e93",
            fontFamily: "monospace",
          }}
        >
          // self-custody your numbers · stocks, crypto, cash · no bank logins
        </div>
      </div>
    ),
    { ...size },
  );
}
