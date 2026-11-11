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

async function handleProxy(req, proxyUrl, refUrl) {
  try {
    const target = new URL(proxyUrl);
    const ref = refUrl || `${target.origin}/`;
    const refOrigin = new URL(ref).origin;
    const reqOrigin = new URL(req.url).origin;

    const reqHeaders = {
      "User-Agent": UA,
      Accept: req.headers.get("accept") || "*/*",
      "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
      Referer: ref,
      Origin: refOrigin
    };

    const ctReq = req.headers.get("content-type");
    if (ctReq) reqHeaders["Content-Type"] = ctReq;
    const xrw = req.headers.get("x-requested-with");
    if (xrw) reqHeaders["X-Requested-With"] = xrw;
    const range = req.headers.get("range");
    if (range) reqHeaders["Range"] = range;

    const fetchOpts = {
      method: req.method,
      headers: reqHeaders,
      cache: "no-store",
      redirect: "follow",
      signal: AbortSignal.timeout(10000)
    };

    if (req.method !== "GET" && req.method !== "HEAD") {
      fetchOpts.body = await req.arrayBuffer();
    }

    const r = await fetch(target.toString(), fetchOpts);
    const buf = await r.arrayBuffer();
    const ct = r.headers.get("content-type") || "application/octet-stream";

    const headStr = new TextDecoder().decode(buf.slice(0, 16)).trimStart();
    if (headStr.startsWith("#EXTM3U")) {
      const baseForM3u8 = r.url || target.toString();
      const text = new TextDecoder().decode(buf);
      const rewritten = text
        .split(/\r?\n/)
        .map((line) => {
          const trimmed = line.trim();
          if (!trimmed) return line;
          if (trimmed.startsWith("#")) {
            return line.replace(/URI="([^"]+)"/g, (_, uri) => {
              try {
                const abs = new URL(uri, baseForM3u8).toString();
                return `URI="${reqOrigin}/api/debug?proxy=${encodeURIComponent(abs)}&ref=${encodeURIComponent(ref)}"`;
              } catch {
                return `URI="${uri}"`;
              }
            });
          }
          try {
            const abs = new URL(trimmed, baseForM3u8).toString();
            return `${reqOrigin}/api/debug?proxy=${encodeURIComponent(abs)}&ref=${encodeURIComponent(ref)}`;
          } catch {
            return line;
          }
        })
        .join("\n");

      return new Response(rewritten, {
        status: r.status,
        headers: {
          "content-type": "application/vnd.apple.mpegurl; charset=utf-8",
          "access-control-allow-origin": "*"
        }
      });
    }

    const resHeaders = {
      "content-type": ct,
      "access-control-allow-origin": "*"
    };
    const cr = r.headers.get("content-range");
    if (cr) resHeaders["content-range"] = cr;

    return new Response(buf, { status: r.status, headers: resHeaders });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 502,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "access-control-allow-origin": "*"
      }
    });
  }
}

export async function POST(req) {
  const { searchParams } = new URL(req.url);
  const proxy = searchParams.get("proxy");
  const ref = searchParams.get("ref");
  if (proxy) return handleProxy(req, proxy, ref);
  return new Response("Not allowed", { status: 405 });
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const proxy = searchParams.get("proxy");
  const ref = searchParams.get("ref");

  if (proxy) {
    return handleProxy(req, proxy, ref);
  }

  const embed = searchParams.get("embed");
  if (embed) {
    try {
      const target = new URL(embed);
      const r = await fetch(target.toString(), {
        headers: {
          "User-Agent": UA,
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
          "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
          Referer: "https://vsmov.com/",
          "Sec-Fetch-Dest": "iframe",
          "Sec-Fetch-Mode": "navigate",
          "Sec-Fetch-Site": "cross-site"
        },
        cache: "no-store",
        signal: AbortSignal.timeout(8000)
      });

      let html = await r.text();

      const injectScript = `<script>
(function() {
  var TARGET_ORIGIN = ${JSON.stringify(target.origin)};
  var TARGET_HREF = ${JSON.stringify(target.toString())};
  var TARGET_PATH = ${JSON.stringify(target.pathname + target.search)};
  var APP_ORIGIN = window.location.origin;

  try {
    history.replaceState(null, "", TARGET_PATH);
  } catch (e) {}

  try {
    Object.defineProperty(document, "referrer", {
      get: function() { return "https://vsmov.com/"; }
    });
  } catch (e) {}

  var base = document.createElement("base");
  base.href = TARGET_ORIGIN + "/";
  (document.head || document.documentElement).appendChild(base);

  // CSS tự động ẩn toàn bộ logo / watermark của trình phát
  var style = document.createElement("style");
  style.textContent = [
    '.jw-logo, .jw-logo-bar, .jw-controlbar-logo, .jw-rightclick-logo,',
    '.vjs-logo, .vjs-brand-container, .art-layer-logo, .plyr__logo,',
    '[class*="logo" i], [id*="logo" i], [class*="watermark" i], [id*="watermark" i],',
    'a[href*="vsmov" i], img[src*="vsmov" i], img[src*="logo" i], img[alt*="vsmov" i], img[alt*="logo" i] {',
    '  display: none !important;',
    '  opacity: 0 !important;',
    '  visibility: hidden !important;',
    '  width: 0 !important;',
    '  height: 0 !important;',
    '  pointer-events: none !important;',
    '}'
  ].join("\\n");
  (document.head || document.documentElement).appendChild(style);

  // Quét và ẩn các thẻ ảnh/khối chứa logo được tạo động bằng JS
  function removeLogos() {
    var imgs = document.querySelectorAll("img");
    for (var i = 0; i < imgs.length; i++) {
      var img = imgs[i];
      var src = (img.currentSrc || img.src || "").toLowerCase();
      var cls = (img.className || "").toLowerCase();
      var id = (img.id || "").toLowerCase();
      if (cls.indexOf("thumb") !== -1 || cls.indexOf("preview") !== -1) continue;
      var w = img.clientWidth || img.naturalWidth || 0;
      var h = img.clientHeight || img.naturalHeight || 0;
      if (
        src.indexOf("logo") !== -1 ||
        src.indexOf("vsmov") !== -1 ||
        src.indexOf("watermark") !== -1 ||
        cls.indexOf("logo") !== -1 ||
        id.indexOf("logo") !== -1 ||
        (w > 20 && w < 300 && h > 8 && h < 120)
      ) {
        img.style.setProperty("display", "none", "important");
        if (img.parentElement && img.parentElement.tagName === "A") {
          img.parentElement.style.setProperty("display", "none", "important");
        }
      }
    }

    var els = document.querySelectorAll("div, span, a");
    for (var j = 0; j < els.length; j++) {
      var el = els[j];
      var clsEl = String(el.className || "").toLowerCase();
      if (clsEl.indexOf("thumb") !== -1 || clsEl.indexOf("preview") !== -1) continue;
      var bg = "";
      try {
        bg = (el.style.backgroundImage || window.getComputedStyle(el).backgroundImage || "").toLowerCase();
      } catch (e) {}
      if (
        bg.indexOf("logo") !== -1 ||
        bg.indexOf("vsmov") !== -1 ||
        bg.indexOf("watermark") !== -1
      ) {
        el.style.setProperty("display", "none", "important");
      }
    }
  }

  setInterval(removeLogos, 400);
  window.addEventListener("DOMContentLoaded", removeLogos);
  window.addEventListener("load", removeLogos);

  function toProxy(u) {
    try {
      if (!u || typeof u !== "string") return u;
      if (u.indexOf("blob:") === 0 || u.indexOf("data:") === 0) return u;
      if (u.indexOf("/api/debug?") !== -1) return u;
      var resolved = new URL(u, TARGET_HREF);
      if (resolved.origin === APP_ORIGIN) {
        var t = new URL(TARGET_ORIGIN);
        resolved.protocol = t.protocol;
        resolved.host = t.host;
      }
      if (/jsdelivr\\.net|cdnjs\\.cloudflare\\.com|jwpcdn\\.com|googleapis\\.com/i.test(resolved.hostname)) {
        return resolved.toString();
      }
      return APP_ORIGIN + "/api/debug?proxy=" + encodeURIComponent(resolved.toString()) + "&ref=" + encodeURIComponent(TARGET_HREF);
    } catch (e) {
      return u;
    }
  }

  var origFetch = window.fetch;
  if (origFetch) {
    window.fetch = function(input, init) {
      if (typeof input === "string") {
        input = toProxy(input);
      } else if (input && typeof input === "object" && input.url) {
        input = new Request(toProxy(input.url), input);
      }
      return origFetch.call(this, input, init);
    };
  }

  var origOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url) {
    var args = Array.prototype.slice.call(arguments);
    args[1] = toProxy(String(url));
    return origOpen.apply(this, args);
  };
})();
</script>`;

      if (/<head[^>]*>/i.test(html)) {
        html = html.replace(/<head[^>]*>/i, (m) => `${m}${injectScript}`);
      } else {
        html = `${injectScript}${html}`;
      }

      return new Response(html, {
        status: r.status,
        headers: { "content-type": "text/html; charset=utf-8" }
      });
    } catch {
      return new Response(
        `<html><body style="background:#111;color:#eee;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;text-align:center;margin:0;padding:20px;"><div>Máy chủ <b>s3.streamvsmov.com</b> hiện không phản hồi.<br/><br/>Vui lòng chọn <b>Server khác</b> ở bên dưới khung xem phim.</div></body></html>`,
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
