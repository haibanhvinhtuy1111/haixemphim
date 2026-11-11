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
  const a =
    j.items ||
    j.data?.items ||
    j.movies ||
    (Array.isArray(j.data) ? j.data : null);
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

function cleanTitle(s) {
  if (!s || typeof s !== "string") return "";
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/\([^)]*\)/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function isSameMovie(a, b) {
  if (!a || !b) return false;
  if (a.tmdb?.id && b.tmdb?.id && String(a.tmdb.id) === String(b.tmdb.id)) {
    return true;
  }

  const nameA = cleanTitle(a.name);
  const nameB = cleanTitle(b.name);
  const origA = cleanTitle(a.origin_name || a.original_name);
  const origB = cleanTitle(b.origin_name || b.original_name);

  if (origA && origB && (origA === origB || origA.includes(origB) || origB.includes(origA))) {
    return true;
  }
  if (nameA && nameB && (nameA === nameB || nameA.includes(nameB) || nameB.includes(nameA))) {
    return true;
  }
  if (nameA && origB && nameA === origB) return true;
  if (origA && nameB && origA === nameB) return true;

  return false;
}

function formatServers(raw, labelPrefix = "") {
  return (Array.isArray(raw) ? raw : [])
    .map((s, idx) => {
      const list = s.server_data || s.items || s.episodes || [];
      const normalized = (Array.isArray(list) ? list : [])
        .map((ep) => ({
          ...ep,
          name: ep.name || ep.slug || "",
          link_m3u8: ep.link_m3u8 || ep.m3u8 || "",
          link_embed: ep.link_embed || ep.embed || ""
        }))
        .filter((ep) => ep.link_m3u8 || ep.link_embed);

      return {
        server_name: `${labelPrefix}${s.server_name || s.name || `Server #${idx + 1}`}`,
        server_data: normalized
      };
    })
    .filter((s) => s.server_data.length > 0);
}

async function getBackupEpisodes(slug, movie) {
  // Bỏ đuôi số ngẫu nhiên của vsmov (ví dụ: -179431894733747)
  const baseSlug = String(slug || "").replace(/-\d{5,}$/, "");
  const candidateSlugs = [...new Set([baseSlug, slug].filter(Boolean))];

  const servers = [];

  for (const s of candidateSlugs) {
    const [kk, op, nc] = await Promise.all([
      getUrl(`https://phimapi.com/phim/${encodeURIComponent(s)}`, 600),
      getUrl(`https://ophim1.com/v1/api/phim/${encodeURIComponent(s)}`, 600),
      getUrl(`https://phim.nguonc.com/api/film/${encodeURIComponent(s)}`, 600)
    ]);

    const kkMovie = findMovie(kk);
    if (kkMovie && isSameMovie(movie, kkMovie)) {
      servers.push(...formatServers(kk.episodes || findEpisodes(kk), "Bản Sạch KK · "));
    }

    const opMovie = findMovie(op);
    if (opMovie && isSameMovie(movie, opMovie)) {
      servers.push(
        ...formatServers(op.data?.item?.episodes || findEpisodes(op), "Bản Sạch OP · ")
      );
    }

    const ncMovie = findMovie(nc);
    if (ncMovie && isSameMovie(movie, ncMovie)) {
      servers.push(
        ...formatServers(nc.movie?.episodes || findEpisodes(nc), "Bản Sạch NC · ")
      );
    }

    if (servers.length > 0) return servers;
  }

  // Nếu khác slug, tìm kiếm theo tên tiếng Việt và tên gốc
  const keywords = [movie?.name, movie?.origin_name]
    .filter((k) => typeof k === "string" && k.trim())
    .map((k) => k.trim());

  for (const kw of keywords) {
    const [kkSr, opSr, ncSr] = await Promise.all([
      getUrl(
        `https://phimapi.com/v1/api/tim-kiem?keyword=${encodeURIComponent(kw)}&limit=8`,
        600
      ),
      getUrl(
        `https://ophim1.com/v1/api/tim-kiem?keyword=${encodeURIComponent(kw)}`,
        600
      ),
      getUrl(
        `https://phim.nguonc.com/api/films/search?keyword=${encodeURIComponent(kw)}`,
        600
      )
    ]);

    const kkMatch = pickItems(kkSr).find((it) => isSameMovie(movie, it));
    const opMatch = pickItems(opSr).find((it) => isSameMovie(movie, it));
    const ncMatch = pickItems(ncSr).find((it) => isSameMovie(movie, it));

    const [kkDetail, opDetail, ncDetail] = await Promise.all([
      kkMatch?.slug
        ? getUrl(`https://phimapi.com/phim/${encodeURIComponent(kkMatch.slug)}`, 600)
        : null,
      opMatch?.slug
        ? getUrl(
            `https://ophim1.com/v1/api/phim/${encodeURIComponent(opMatch.slug)}`,
            600
          )
        : null,
      ncMatch?.slug
        ? getUrl(
            `https://phim.nguonc.com/api/film/${encodeURIComponent(ncMatch.slug)}`,
            600
          )
        : null
    ]);

    if (kkDetail) {
      servers.push(
        ...formatServers(kkDetail.episodes || findEpisodes(kkDetail), "Bản Sạch KK · ")
      );
    }
    if (opDetail) {
      servers.push(
        ...formatServers(
          opDetail.data?.item?.episodes || findEpisodes(opDetail),
          "Bản Sạch OP · "
        )
      );
    }
    if (ncDetail) {
      servers.push(
        ...formatServers(
          ncDetail.movie?.episodes || findEpisodes(ncDetail),
          "Bản Sạch NC · "
        )
      );
    }

    if (servers.length > 0) break;
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

  const proxyServers = vsmovServers.map((s) => ({
    server_name: `${s.server_name} (Proxy)`,
    server_data: s.server_data.map((ep) => ({
      ...ep,
      link_embed: ep.link_embed
        ? `/api/debug?embed=${encodeURIComponent(ep.link_embed)}`
        : ""
    }))
  }));

  const backupServers = await getBackupEpisodes(cleanSlug, movie);

  const episodes = [...backupServers, ...proxyServers, ...vsmovServers];

  return { movie, episodes };
}
