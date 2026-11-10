export const dynamic = "force-dynamic";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

function shape(v, d = 0) {
  if (Array.isArray(v)) {
    return v.length ? [`len=${v.length}`, d < 5 ? shape(v[0], d + 1) : "..."] : [];
  }
  if (v && typeof v === "object") {
    if (d >= 5) return "{...}";
    const o = {};
    for (const k of Object.keys(v).slice(0, 30)) o[k] = shape(v[k], d + 1);
    return o;
  }
  return typeof v === "string" ? v.slice(0, 80) : v;
}

export async function GET(req) {
  const path =
    new URL(req.url).searchParams.get("path") ||
    "/danh-sach/phim-moi-cap-nhat?page=1";
  if (!path.startsWith("/")) return new Response("bad path", { status: 400 });

  const url = (process.env.API_BASE || "https://vsmov.com/api") + path;
  const headers = { "content-type": "application/json; charset=utf-8" };

  try {
    const r = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      cache: "no-store"
    });
    const text = await r.text();
    let body;
    try {
      body = { shape: shape(JSON.parse(text)) };
    } catch {
      body = { rawStart: text.slice(0, 600) };
    }
    return new Response(JSON.stringify({ url, status: r.status, ...body }, null, 2), { headers });
  } catch (e) {
    return new Response(JSON.stringify({ url, error: String(e) }, null, 2), { headers });
  }
}
