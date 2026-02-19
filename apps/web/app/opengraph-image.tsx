import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const alt = "Straude — Strava for Claude Code";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  const [interBold, interMedium, bgImageData] = await Promise.all([
    readFile(join(process.cwd(), "assets/Inter-Bold.ttf")),
    readFile(join(process.cwd(), "assets/Inter-Medium.ttf")),
    readFile(join(process.cwd(), "public/hero-bg.jpg")),
  ]);

  const bgBase64 = `data:image/jpeg;base64,${bgImageData.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          overflow: "hidden",
          backgroundColor: "#000",
        }}
      >
        {/* Background image */}
        <img
          src={bgBase64}
          alt=""
          width={1200}
          height={630}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            opacity: 0.7,
          }}
        />

        {/* Gradient overlay for text legibility */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            display: "flex",
            background:
              "radial-gradient(ellipse 80% 60% at 50% 90%, rgba(223,86,31,0.25) 0%, transparent 70%), linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.2) 40%, rgba(0,0,0,0.6) 100%)",
          }}
        />

        {/* Content */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
            zIndex: 1,
          }}
        >
          {/* Logo: orange trapezoid */}
          <svg
            width="56"
            height="56"
            viewBox="0 0 32 32"
            style={{ marginBottom: 24 }}
          >
            <polygon points="6.4,0 25.6,0 32,32 0,32" fill="#DF561F" />
          </svg>

          {/* Title */}
          <div
            style={{
              fontSize: 96,
              fontFamily: "Inter",
              fontWeight: 700,
              color: "#ffffff",
              letterSpacing: "-0.03em",
              lineHeight: 1,
            }}
          >
            STRAUDE
          </div>

          {/* Tagline */}
          <div
            style={{
              fontSize: 32,
              fontFamily: "Inter",
              fontWeight: 500,
              color: "rgba(255,255,255,0.75)",
              marginTop: 16,
              letterSpacing: "-0.01em",
            }}
          >
            Strava for Claude Code
          </div>
        </div>

        {/* URL bottom-right */}
        <div
          style={{
            position: "absolute",
            bottom: 32,
            right: 40,
            fontSize: 20,
            fontFamily: "Inter",
            fontWeight: 500,
            color: "rgba(255,255,255,0.4)",
          }}
        >
          straude.com
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Inter", data: interBold, style: "normal", weight: 700 },
        { name: "Inter", data: interMedium, style: "normal", weight: 500 },
      ],
    }
  );
}
