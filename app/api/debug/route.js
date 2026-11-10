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
  const { searchParams } = new URL(req.url);
  const embed = searchParams.get("embed");

  // Chế độ Proxy cho link_embed (gắn Referer vsmov.com và bỏ X-Frame-Options)
  if (embed) {
    try {
      const target = new URL(embed);
      const r = await fetch(target.toString(), {
        headers: {
          "User-Agent": UA,
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          Referer: "https://vsmov.com/",
          Origin: "https://vsmov.com"
        },
        cache: "no-store",
        signal: AbortSignal.timeout(6000)
      });
      let html = await r.text();
      const baseTag = `<base href="${target.origin}/">`;
      if (/<head[^>]*>/i.test(html)) {
        html = html.replace(/<head[^>]*>/i, (m) => `${m}${baseTag}`);
      } else {
        html = `${baseTag}${html}`;
      }
      return new Response(html, {
        status: r.status,
        headers: { "content-type": "text/html; charset=utf-8" }
      });
    } catch {
      return new Response(
        `<html><body style="background:#111;color:#eee;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;text-align:center;margin:0;padding:20px;"><div>Máy chủ <b>s3.streamvsmov.com</b> hiện đang bảo trì hoặc từ chối kết nối.<br/><br/>Vui lòng bấm chọn <b>Server khác</b> ở ngay bên dưới khung xem phim.</div></body></html>`,
        { headers: { "content-type": "text/html; charset=utf-8" } }
      );
    }
  }

  const path = searchParams.get("path") || "/danh-sach/phim-moi-cap-nhat?page=1";
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
