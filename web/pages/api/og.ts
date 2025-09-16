// web/pages/api/og.ts
/* eslint-disable react/jsx-key */
import { ImageResponse } from "next/og";
import { getArticleBySlug } from "../../lib/content";

// Use the Edge runtime for next/og
export const config = { runtime: "edge" };

export default async function handler(req: Request) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug") || "";
  const art = slug ? await getArticleBySlug(slug) : null;

  const title = art?.title ?? "H4C: Web Overview";
  const subtitle = art?.description ?? "Learn about $MemO and the H4C ecosystem.";

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
}
