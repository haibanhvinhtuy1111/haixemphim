const BASE = process.env.API_BASE || "https://vsmov.com/api";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

async function get(path, revalidate = 300) {
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      next: { revalidate }
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// Ảnh: chỉ nhận chuỗi; {} hoặc rỗng -> ""
export function img(u) {
  if (!u || typeof u !== "string") return "";
  if (/^https?:\/\//i.test(u)) return u;
  return `https://vsmov.com/${u.replace(/^\/+/, "")}`;
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

// Dò danh sách tập ở bất kỳ đâu: mảng có phần tử chứa server_data / items
function findEpisodes(o, depth = 0) {
  if (!o || depth > 5) return null;
  if (Array.isArray(o)) {
    if (o.length && o[0] && typeof o[0] === "object" && (o[0].server_data || o[0].items || o[0].episodes)) {
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

// Dò object phim: có name (và slug hoặc origin_name)
function findMovie(j) {
  const cands = [j.movie, j.data?.movie, j.data?.item, j.item, j.data, j];
  return cands.find((c) => c && typeof c === "object" && !Array.isArray(c) && c.name) || null;
}

export async function getMovie(slug) {
  const j = await get(`/phim/${encodeURIComponent(slug)}`, 600);
  if (!j || j.status === false) return null;
  const movie = findMovie(j);
  if (!movie) return null;
  const raw = findEpisodes(j) || [];
  const episodes = raw.map((s) => ({
    server_name: s.server_name || s.name || "",
    server_data: s.server_data || s.items || s.episodes || []
  }));
  return { movie, episodes };
}
