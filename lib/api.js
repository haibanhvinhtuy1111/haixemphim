const BASE = process.env.API_BASE || "https://vsmov.com/api";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

// Tự động biến mọi object rỗng {} từ API thành chuỗi rỗng "" để chống sập React Server Component
function sanitizeJson(v) {
  if (v === null || v === undefined) return "";
  if (Array.isArray(v)) {
    return v
      .map(sanitizeJson)
      .filter((x) => x !== "" && x !== null && x !== undefined);
  }
  if (typeof v === "object") {
    const keys = Object.keys(v);
    if (keys.length === 0) return "";
    const out = {};
    for (const k of keys) {
      out[k] = sanitizeJson(v[k]);
    }
    return out;
  }
  return v;
}

const str = (v) =>
  typeof v === "string" || typeof v === "number" ? String(v).trim() : "";

async function getUrl(url, revalidate = 300) {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      next: { revalidate },
      signal: AbortSignal.timeout(6000)
    });
    if (!res.ok) return null;
    const raw = await res.json();
    return sanitizeJson(raw);
  } catch {
    return null;
  }
}

async function get(path, revalidate = 300) {
  return getUrl(`${BASE}${path}`, revalidate);
}

function resolveImg(u, cdn = "") {
  if (!u || typeof u !== "string") return "";
  const s = u.trim();
  if (!s) return "";
  if (/^https?:\/\//i.test(s)) return s;

  const clean = s.replace(/^\/+/, "");
  if (clean.startsWith("upload/")) {
    const base = cdn ? cdn.replace(/\/+$/, "") : "https://phimimg.com";
    return `${base}/${clean}`;
  }
  if (clean.startsWith("uploads/")) {
    const base = cdn ? cdn.replace(/\/+$/, "") : "https://img.ophim.live";
    return `${base}/${clean}`;
  }
  if (cdn) {
    const base = cdn.replace(/\/+$/, "");
    if (base.includes("ophim") && !clean.startsWith("uploads/")) {
      return `${base}/uploads/movies/${clean}`;
    }
    return `${base}/${clean}`;
  }
  if (clean.startsWith("storage/")) return `https://vsmov.com/${clean}`;
  return `https://vsmov.com/storage/images/${clean}`;
}

export function img(u) {
  return resolveImg(u);
}

function normalizeItem(it, cdn = "") {
  if (!it || typeof it !== "object" || Array.isArray(it)) return null;
  const poster = resolveImg(it.poster_url, cdn);
  const thumb = resolveImg(it.thumb_url, cdn);
  const name = str(it.name);
  const slug = str(it.slug);
  if (!name || !slug) return null;

  return {
    ...it,
    _id: str(it._id || slug),
    name,
    slug,
    origin_name: str(it.origin_name || it.original_name),
    year: str(it.year),
    quality: str(it.quality),
    lang: str(it.lang),
    episode_current: str(it.episode_current),
    episode_total: str(it.episode_total),
    time: str(it.time),
    content: str(it.content),
    trailer_url: str(it.trailer_url),
    type: str(it.type),
    status: str(it.status),
    poster_url: poster || thumb,
    thumb_url: thumb || poster,
    category: Array.isArray(it.category)
      ? it.category.map((c) => ({
          id: str(c?.id),
          name: str(c?.name),
          slug: str(c?.slug)
        }))
      : [],
    country: Array.isArray(it.country)
      ? it.country.map((c) => ({
          id: str(c?.id),
          name: str(c?.name),
          slug: str(c?.slug)
        }))
      : [],
    actor: Array.isArray(it.actor) ? it.actor.map(str).filter(Boolean) : [],
    director: Array.isArray(it.director) ? it.director.map(str).filter(Boolean) : [],
    tmdb:
      it.tmdb && typeof it.tmdb === "object"
        ? {
            type: str(it.tmdb.type),
            id: str(it.tmdb.id),
            vote_average: str(it.tmdb.vote_average)
          }
        : {}
  };
}

function pickItems(j) {
  if (!j || typeof j !== "object") return [];
  const cands = [
    j.items,
    j.data?.items,
    j.data?.data,
    j.movies?.data,
    j.movies,
    j.results,
    j.data
  ];
  const arr = cands.find((c) => Array.isArray(c)) || [];
  const cdn = str(
    j.pathImage || j.data?.APP_DOMAIN_CDN_IMAGE || j.APP_DOMAIN_CDN_IMAGE
  );
  return arr.map((it) => normalizeItem(it, cdn)).filter(Boolean);
}

function pickPages(j) {
  if (!j || typeof j !== "object") return 1;
  const p =
    j?.pagination ||
    j?.data?.params?.pagination ||
    j?.paginate ||
    j?.data ||
    {};
  const total = Number(
    p.totalPages || p.total_pages || p.last_page || p.total_page
  );
  if (total && !Number.isNaN(total)) return Math.max(1, total);
  const items = Number(p.totalItems || p.total_items || p.total);
  const per = Number(p.totalItemsPerPage || p.per_page || p.limit || 24);
  if (items && per) return Math.max(1, Math.ceil(items / per));
  return 1;
}

export async function getList(type = "phim-moi-cap-nhat", page = 1) {
  const cleanType = str(type) || "phim-moi-cap-nhat";
  const pg = Math.max(1, Number(page) || 1);

  const vsmovPaths =
    cleanType === "phim-moi-cap-nhat"
      ? [`/danh-sach/phim-moi-cap-nhat?page=${pg}`]
      : [
          `/danh-sach/${cleanType}?page=${pg}`,
          `/the-loai/${cleanType}?page=${pg}`,
          `/v1/api/danh-sach/${cleanType}?page=${pg}`,
          `/v1/api/the-loai/${cleanType}?page=${pg}`
        ];

  for (const path of vsmovPaths) {
    const j = await get(path);
    const items = pickItems(j);
    if (items.length > 0) {
      return { items, totalPages: pickPages(j) };
    }
  }

  const fallbackUrls =
    cleanType === "phim-moi-cap-nhat"
      ? [
          `https://phimapi.com/danh-sach/phim-moi-cap-nhat?page=${pg}`,
          `https://ophim1.com/danh-sach/phim-moi-cap-nhat?page=${pg}`
        ]
      : [
          `https://phimapi.com/v1/api/danh-sach/${cleanType}?page=${pg}&limit=24`,
          `https://ophim1.com/v1/api/danh-sach/${cleanType}?page=${pg}`,
          `https://phimapi.com/v1/api/the-loai/${cleanType}?page=${pg}&limit=24`,
          `https://ophim1.com/v1/api/the-loai/${cleanType}?page=${pg}`
        ];

  for (const url of fallbackUrls) {
    const j = await getUrl(url, 300);
    const items = pickItems(j);
    if (items.length > 0) {
      return { items, totalPages: pickPages(j) };
    }
  }

  return { items: [], totalPages: 1 };
}

export async function search(keyword, page = 1) {
  const kw = str(keyword);
  if (!kw) return { items: [], totalPages: 1 };
  const pg = Math.max(1, Number(page) || 1);

  const [vs, kk, op] = await Promise.all([
    get(`/tim-kiem?keyword=${encodeURIComponent(kw)}&page=${pg}`, 60),
    getUrl(
      `https://phimapi.com/v1/api/tim-kiem?keyword=${encodeURIComponent(kw)}&page=${pg}&limit=24`,
      60
    ),
    getUrl(
      `https://ophim1.com/v1/api/tim-kiem?keyword=${encodeURIComponent(kw)}&page=${pg}`,
      60
    )
  ]);

  const vsItems = pickItems(vs);
  if (vsItems.length > 0) return { items: vsItems, totalPages: pickPages(vs) };

  const kkItems = pickItems(kk);
  if (kkItems.length > 0) return { items: kkItems, totalPages: pickPages(kk) };

  const opItems = pickItems(op);
  if (opItems.length > 0) return { items: opItems, totalPages: pickPages(op) };

  return { items: [], totalPages: 1 };
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
  if (!j || typeof j !== "object") return null;
  const cands = [j.movie, j.data?.movie, j.data?.item, j.item, j.data, j];
  const m =
    cands.find(
      (c) => c && typeof c === "object" && !Array.isArray(c) && str(c.name)
    ) || null;
  if (!m) return null;
  const cdn = str(
    j.pathImage || j.data?.APP_DOMAIN_CDN_IMAGE || j.APP_DOMAIN_CDN_IMAGE
  );
  return normalizeItem(m, cdn);
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
  if (a.tmdb?.id && b.tmdb?.id && str(a.tmdb.id) === str(b.tmdb.id)) {
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
          name: str(ep?.name || ep?.slug),
          slug: str(ep?.slug || ep?.name),
          link_m3u8: str(ep?.link_m3u8 || ep?.m3u8),
          link_embed: str(ep?.link_embed || ep?.embed)
        }))
        .filter((ep) => ep.link_m3u8 || ep.link_embed);

      return {
        server_name: `${labelPrefix}${str(s?.server_name || s?.name) || `Server #${idx + 1}`}`,
        server_data: normalized
      };
    })
    .filter((s) => s.server_data.length > 0);
}

async function getBackupData(slug, baseMovie = null) {
  const baseSlug = str(slug).replace(/-\d{5,}$/, "");
  const candidateSlugs = [...new Set([baseSlug, slug].filter(Boolean))];

  const servers = [];
  let foundMovie = baseMovie;

  for (const s of candidateSlugs) {
    const [kk, op, nc] = await Promise.all([
      getUrl(`https://phimapi.com/phim/${encodeURIComponent(s)}`, 600),
      getUrl(`https://ophim1.com/v1/api/phim/${encodeURIComponent(s)}`, 600),
      getUrl(`https://phim.nguonc.com/api/film/${encodeURIComponent(s)}`, 600)
    ]);

    const kkMovie = findMovie(kk);
    const opMovie = findMovie(op);
    const ncMovie = findMovie(nc);

    if (!foundMovie) {
      foundMovie = kkMovie || opMovie || ncMovie || null;
    }

    if (kkMovie && (!foundMovie || isSameMovie(foundMovie, kkMovie))) {
      servers.push(...formatServers(kk?.episodes || findEpisodes(kk), "Bản Sạch KK · "));
    }
    if (opMovie && (!foundMovie || isSameMovie(foundMovie, opMovie))) {
      servers.push(
        ...formatServers(op?.data?.item?.episodes || findEpisodes(op), "Bản Sạch OP · ")
      );
    }
    if (ncMovie && (!foundMovie || isSameMovie(foundMovie, ncMovie))) {
      servers.push(
        ...formatServers(nc?.movie?.episodes || findEpisodes(nc), "Bản Sạch NC · ")
      );
    }

    if (servers.length > 0) return { movie: foundMovie, servers };
  }

  const keywords = [foundMovie?.name, foundMovie?.origin_name]
    .map(str)
    .filter(Boolean);

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

    const kkMatch = pickItems(kkSr).find((it) => isSameMovie(foundMovie, it));
    const opMatch = pickItems(opSr).find((it) => isSameMovie(foundMovie, it));
    const ncMatch = pickItems(ncSr).find((it) => isSameMovie(foundMovie, it));

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

  return { movie: foundMovie, servers };
}

export async function getMovie(slug) {
  const cleanSlug = str(slug);
  if (!cleanSlug) return null;

  const j = await get(`/phim/${encodeURIComponent(cleanSlug)}`, 600);
  const vsMovie = j && j.status !== false ? findMovie(j) : null;

  const raw = vsMovie
    ? j.episodes ||
      j.data?.item?.episodes ||
      j.movie?.episodes ||
      findEpisodes(j) ||
      []
    : [];

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

  const { movie: backupMovie, servers: backupServers } = await getBackupData(
    cleanSlug,
    vsMovie
  );

  const finalMovie = vsMovie || backupMovie;
  if (!finalMovie) return null;

  const episodes = [...backupServers, ...proxyServers, ...vsmovServers];

  return { movie: finalMovie, episodes };
}
