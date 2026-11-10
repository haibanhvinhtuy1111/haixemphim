const BASE = process.env.API_BASE || "https://vsmov.com/api";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

async function getUrl(url, revalidate = 300) {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      next: { revalidate },
      signal: AbortSignal.timeout(5000)
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function get(path, revalidate = 300) {
  return getUrl(`${BASE}${path}`, revalidate);
}

export function img(u) {
  if (!u || typeof u !== "string") return "";
  if (/^https?:\/\//i.test(u)) return u;
  const clean = u.replace(/^\/+/, "");
  if (clean.startsWith("storage/")) return `https://vsmov.com/${clean}`;
  return `https://vsmov.com/storage/images/${clean}`;
}

function pickItems(j) {
  if (!j) return [];
  const a = j.items || j.data?.items || (Array.isArray(j.data) ? j.data : null);
  return Array.isArray(a) ? a : [];
}

function pickPages(j) {
  const p = j?.pagination || j?.data?.params?.pagination || j?.paginate || {};
  const total = p.totalPages || p.total_pages || p.last_page;
  if (total) return Number(total);
  const items = p.totalItems || p.total_items || p.total;
  const per = p.totalItemsPerPage || p.per_page || p.limit;
  if (items && per) return Math.max(1, Math.ceil(items / per));
  return 1;
}

export async function getList(type = "phim-moi-cap-nhat", page = 1) {
  const j = await get(`/danh-sach/${type}?page=${page}`);
  return { items: pickItems(j), totalPages: pickPages(j) };
}

export async function search(keyword, page = 1) {
  const j = await get(
    `/tim-kiem?keyword=${encodeURIComponent(keyword)}&page=${page}`,
    60
  );
  return { items: pickItems(j), totalPages: pickPages(j) };
}

function findEpisodes(o, depth = 0) {
  if (!o || depth > 5) return null;
  if (Array.isArray(o)) {
    if (
      o.length &&
      o[0] &&
      typeof o[0] === "object" &&
      (o[0].server_data || o[0].items || o[0].episodes)
    ) {
      return o;
    }
    for (const v of o) {
      const r = findEpisodes(v, depth + 1);
      if (r) return r;
    }
    return null;
  }
  if (typeof o === "object") {
    for (const k of Object.keys(o)) {
      const r = findEpisodes(o[k], depth + 1);
      if (r) return r;
    }
  }
  return null;
}

function findMovie(j) {
  if (!j) return null;
  const cands = [j.movie, j.data?.movie, j.data?.item, j.item, j.data, j];
  return (
    cands.find((c) => c && typeof c === "object" && !Array.isArray(c) && c.name) ||
    null
  );
}

function norm(s) {
  return String(s || "").toLowerCase().trim();
}

function isSameMovie(a, b) {
  if (!a || !b) return false;
  if (a.tmdb?.id && b.tmdb?.id && String(a.tmdb.id) === String(b.tmdb.id)) return true;
  if (a.origin_name && b.origin_name && norm(a.origin_name) === norm(b.origin_name)) return true;
  if (a.name && b.name && norm(a.name) === norm(b.name)) return true;
  return false;
}

function formatServers(raw, labelPrefix = "") {
  return (Array.isArray(raw) ? raw : [])
    .map((s, idx) => ({
      server_name: `${labelPrefix}${s.server_name || s.name || `Server #${idx + 1}`}`,
      server_data: Array.isArray(s.server_data || s.items || s.episodes)
        ? s.server_data || s.items || s.episodes
        : []
    }))
    .filter((s) => s.server_data.length > 0);
}

// Tìm nguồn phát .m3u8 dự phòng từ KKPhim / OPhim khi s3.streamvsmov.com lỗi
async function getBackupEpisodes(slug, movie) {
  const [kk, op] = await Promise.all([
    getUrl(`https://phimapi.com/phim/${encodeURIComponent(slug)}`, 600),
    getUrl(`https://ophim1.com/phim/${encodeURIComponent(slug)}`, 600)
  ]);

  const servers = [];

  const kkMovie = findMovie(kk);
  if (kkMovie && isSameMovie(movie, kkMovie)) {
    servers.push(...formatServers(kk.episodes || findEpisodes(kk), "HLS · "));
  }

  const opMovie = findMovie(op);
  if (opMovie && isSameMovie(movie, opMovie)) {
    servers.push(...formatServers(op.episodes || findEpisodes(op), "OP · "));
  }

  // Nếu khác slug, tìm theo tên gốc hoặc tên tiếng Việt trên KKPhim
  if (!servers.length && (movie?.origin_name || movie?.name)) {
    const kw = movie.origin_name || movie.name;
    const sr = await getUrl(
      `https://phimapi.com/v1/api/tim-kiem?keyword=${encodeURIComponent(kw)}&limit=5`,
      600
    );
    const items = pickItems(sr);
    const matched = items.find((it) => isSameMovie(movie, it));
    if (matched?.slug) {
      const detail = await getUrl(
        `https://phimapi.com/phim/${encodeURIComponent(matched.slug)}`,
        600
      );
      if (detail) {
        servers.push(...formatServers(detail.episodes || findEpisodes(detail), "HLS · "));
      }
    }
  }

  return servers;
}

export async function getMovie(slug) {
  const cleanSlug = String(slug || "").trim();
  if (!cleanSlug) return null;

  const j = await get(`/phim/${encodeURIComponent(cleanSlug)}`, 600);
  if (!j || j.status === false) return null;

  const movie = findMovie(j);
  if (!movie) return null;

  const raw =
    j.episodes ||
    j.data?.item?.episodes ||
    j.movie?.episodes ||
    findEpisodes(j) ||
    [];

  const vsmovServers = formatServers(raw, "");

  // Tạo thêm bản Proxy cho các link_embed của vsmov để tránh lỗi X-Frame-Options
  const proxyServers = vsmovServers.map((s) => ({
    server_name: `${s.server_name} (Proxy)`,
    server_data: s.server_data.map((ep) => ({
      ...ep,
      link_embed: ep.link_embed
        ? `/api/debug?embed=${encodeURIComponent(ep.link_embed)}`
        : ""
    }))
  }));

  // Lấy thêm server có link_m3u8 dự phòng và ưu tiên xếp lên đầu
  const backupServers = await getBackupEpisodes(cleanSlug, movie);

  const episodes = [...backupServers, ...proxyServers, ...vsmovServers];

  return { movie, episodes };
}
