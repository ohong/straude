import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
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
          backgroundColor: "#000",
          borderRadius: 36,
        }}
      >
        <svg width="120" height="120" viewBox="0 0 32 32">
          <polygon points="6.4,0 25.6,0 32,32 0,32" fill="#DF561F" />
        </svg>
      </div>
    ),
    { ...size }
  );
}
