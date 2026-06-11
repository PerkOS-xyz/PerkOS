import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt =
  "PerkOS — Your business just hired its first team. They draft, you approve.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#0e0716",
          backgroundImage:
            "radial-gradient(ellipse 60% 50% at 50% 100%, rgba(236,27,105,0.45) 0%, rgba(236,27,105,0.12) 45%, transparent 80%)",
          padding: "80px",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            color: "#ec1b69",
            fontSize: "20px",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.15em",
          }}
        >
          PerkOS
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            flex: 1,
            gap: "24px",
          }}
        >
          <div
            style={{
              fontSize: "84px",
              fontWeight: 700,
              color: "#ececff",
              lineHeight: 1.05,
              letterSpacing: "-0.02em",
            }}
          >
            Your business just hired
          </div>
          <div
            style={{
              fontSize: "84px",
              fontWeight: 700,
              backgroundImage:
                "linear-gradient(to right, #ec1b69, #fbbf24)",
              backgroundClip: "text",
              color: "transparent",
              lineHeight: 1.05,
              letterSpacing: "-0.02em",
            }}
          >
            its first team.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: "32px",
            color: "#7975a8",
            fontSize: "24px",
            fontWeight: 500,
          }}
        >
          <span>They draft</span>
          <span style={{ color: "#1b1833" }}>·</span>
          <span>You approve</span>
          <span style={{ color: "#1b1833" }}>·</span>
          <span>No tech skills</span>
        </div>
      </div>
    ),
    { ...size }
  );
}
