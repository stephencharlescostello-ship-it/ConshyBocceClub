import { ImageResponse } from "next/og";
import { ShuffleMark } from "@/components/ui/logo";

export const dynamic = "force-static";

export function generateStaticParams() {
  return [{ size: "192" }, { size: "512" }, { size: "maskable-512" }, { size: "apple-180" }];
}

// PWA icons rendered from the same SVG mark the header uses (no binary assets to manage).
export async function GET(_req: Request, ctx: RouteContext<"/icons/[size]">) {
  const { size } = await ctx.params;
  const maskable = size.startsWith("maskable");
  const px = Number(size.replace(/\D/g, "")) || 192;
  const pad = maskable ? px * 0.18 : px * 0.1;
  return new ImageResponse(
    (
      <div style={{ width: px, height: px, display: "flex", alignItems: "center", justifyContent: "center", background: "#0b1f17", borderRadius: maskable ? 0 : px * 0.2 }}>
        <div style={{ display: "flex", width: px - pad * 2, height: px - pad * 2 }}>
          <ShuffleMark size={px - pad * 2} />
        </div>
      </div>
    ),
    { width: px, height: px },
  );
}
