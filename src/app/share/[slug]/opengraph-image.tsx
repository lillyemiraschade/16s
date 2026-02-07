import { ImageResponse } from "@vercel/og";
import { createClient } from "@/lib/supabase/server";

export const runtime = "edge";
export const alt = "Built with 16s";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: project } = await supabase
    .from("projects")
    .select("name")
    .eq("public_slug", slug)
    .eq("is_public", true)
    .single();

  const title = project?.name || "Untitled Project";

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
          background: "linear-gradient(135deg, #0a0a0b 0%, #1a1a2e 50%, #0a0a0b 100%)",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {/* Green glow */}
        <div
          style={{
            position: "absolute",
            width: 400,
            height: 400,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(34,197,94,0.15) 0%, transparent 70%)",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
          }}
        />

        {/* Logo */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 72,
            height: 72,
            borderRadius: 18,
            background: "#22c55e",
            marginBottom: 32,
            fontSize: 32,
            fontWeight: 700,
            color: "white",
          }}
        >
          16s
        </div>

        {/* Project name */}
        <div
          style={{
            fontSize: 52,
            fontWeight: 700,
            color: "white",
            maxWidth: 800,
            textAlign: "center",
            lineHeight: 1.2,
            marginBottom: 16,
          }}
        >
          {title}
        </div>

        {/* Subtitle */}
        <div
          style={{
            fontSize: 24,
            color: "rgba(255,255,255,0.5)",
          }}
        >
          Built with 16s AI Web Designer
        </div>
      </div>
    ),
    { ...size }
  );
}
