import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";

export const config = { runtime: "edge" };

export default async function handler(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const title = searchParams.get("title") || "H4C: Crypto Guide";
    const subtitle = searchParams.get("subtitle") || "Learn about crypto and blockchain";

    return new ImageResponse(
      (
        <div
          style={{
            height: "100%",
            width: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            background: "linear-gradient(135deg, #0a0f2c 0%, #29115E 60%, #4C1D95 100%)",
            color: "white",
            padding: 48,
            fontSize: 48,
            fontWeight: 800
          }}
        >
          <div style={{ fontSize: 64, marginBottom: 12 }}>{title}</div>
          <div style={{ fontSize: 32, fontWeight: 500, opacity: 0.9 }}>{subtitle}</div>
        </div>
      ),
      { width: 1200, height: 630 }
    );
  } catch (e) {
    console.error("OG image generation failed:", e);
    return new Response("Failed to generate image", { status: 500 });
  }
}
