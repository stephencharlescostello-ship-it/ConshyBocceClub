import { NextResponse, type NextRequest } from "next/server";

/** GIF search, only available when GIPHY_API_KEY is set (the chat hides the button otherwise). */
export async function GET(request: NextRequest) {
  const key = process.env.GIPHY_API_KEY;
  if (!key) return NextResponse.json({ enabled: false, results: [] });
  const q = request.nextUrl.searchParams.get("q")?.slice(0, 60) ?? "";
  const url = q ? `https://api.giphy.com/v1/gifs/search?api_key=${key}&q=${encodeURIComponent(q)}&limit=18&rating=pg-13` : `https://api.giphy.com/v1/gifs/trending?api_key=${key}&limit=18&rating=pg-13`;
  const res = await fetch(url, { next: { revalidate: 60 } });
  if (!res.ok) return NextResponse.json({ enabled: true, results: [] });
  const json = (await res.json()) as { data: { id: string; title: string; images: { fixed_height: { url: string }; downsized: { url: string } } }[] };
  return NextResponse.json({ enabled: true, results: json.data.map((g) => ({ id: g.id, title: g.title, preview: g.images.fixed_height.url, url: g.images.downsized.url })) });
}
