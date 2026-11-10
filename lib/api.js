// Gọi API phía server (không dính CORS). Cache 5 phút để nhẹ cho nguồn API.
const BASE = process.env.API_BASE || "https://vsmov.com/api";

async function get(path, revalidate = 300) {
  try {
    const res = await fetch(`${BASE}${path}`, { next: { revalidate } });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// Ảnh có thể là đường dẫn tương đối -> ghép domain nguồn
export function img(u = "") {
  if (!u) return "";
  if (/^https?:\/\//i.test(u)) return u;
  return `https://vsmov.com/${String(u).replace(/^\/+/, "")}`;
}

// Chuẩn hoá nhiều dạng JSON thường gặp: {items}, {data:{items}}, {data:[...]}
function pickItems(j) {
  if (!j) return [];
  return j.items || j.data?.items || (Array.isArray(j.data) ? j.data : []) || [];
}
function pickPages(j) {
  const p = j?.pagination || j?.data?.params?.pagination || j?.paginate || {};
  return p.totalPages || p.total_pages || p.last_page || 1;
}

export async function getList(type = "phim-moi-cap-nhat", page = 1) {
  const j = await get(`/danh-sach/${type}?page=${page}`);
  return { items: pickItems(j), totalPages: pickPages(j) };
}

export async function search(keyword, page = 1) {
  const j = await get(`/tim-kiem?keyword=${encodeURIComponent(keyword)}&page=${page}`, 60);
  return { items: pickItems(j), totalPages: pickPages(j) };
}

export async function getMovie(slug) {
  const j = await get(`/phim/${encodeURIComponent(slug)}`, 600);
  if (!j) return null;
  const movie = j.movie || j.data?.item || j.data || j.item || null;
  const episodes = j.episodes || movie?.episodes || j.data?.item?.episodes || [];
  return movie ? { movie, episodes } : null;
}
