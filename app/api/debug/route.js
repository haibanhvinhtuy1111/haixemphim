export const dynamic = "force-dynamic";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

export async function GET(req) {
  const path =
    new URL(req.url).searchParams.get("path") ||
    "/danh-sach/phim-moi-cap-nhat?page=1";

  if (!path.startsWith("/")) {
    return new Response("bad path", { status: 400 });
  }

  const url = (process.env.API_BASE || "https://vsmov.com/api") + path;

  try {
    const r = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      cache: "no-store"
    });
    const text = await r.text();
    return new Response(
      JSON.stringify(
        {
          url,
          status: r.status,
          contentType: r.headers.get("content-type"),
          preview: text.slice(0, 1500)
        },
        null,
        2
      ),
      { headers: { "content-type": "application/json; charset=utf-8" } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ url, error: String(e) }, null, 2), {
      headers: { "content-type": "application/json; charset=utf-8" }
    });
  }
}
