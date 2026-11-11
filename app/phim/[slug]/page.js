import Player from "../../../components/Player";
import MovieCard from "../../../components/MovieCard";
import { getMovie, getList, img } from "../../../lib/api";

export const dynamic = "force-dynamic";

const str = (v) =>
  typeof v === "string" || typeof v === "number" ? String(v).trim() : "";

const strip = (s) => str(s).replace(/<[^>]+>/g, "").trim();

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const data = await getMovie(slug);
  return { title: str(data?.movie?.name) || "Phim" };
}

export default async function MoviePage({ params }) {
  const { slug } = await params;
  const data = await getMovie(slug);

  if (!data) {
    return (
      <main className="wrap" style={{ paddingBottom: 100 }}>
        <h1>Không tải được phim</h1>
        <div className="notice">
          Không lấy được dữ liệu cho “{String(slug)}”. Mở{" "}
          <a href={`/api/debug?path=/phim/${encodeURIComponent(String(slug))}`}>
            trang kiểm tra API
          </a>{" "}
          để xem nguồn trả về gì.
        </div>
      </main>
    );
  }

  const { movie: m, episodes } = data;
  const pic = img(m.poster_url) || img(m.thumb_url);

  const categories = Array.isArray(m.category) ? m.category : [];
  const countries = Array.isArray(m.country) ? m.country : [];
  const tags = [...categories, ...countries]
    .map((c) => str(c?.name))
    .filter(Boolean);

  const actors = Array.isArray(m.actor)
    ? m.actor.map((a) => str(a)).filter(Boolean).slice(0, 8)
    : [];
  const directors = Array.isArray(m.director)
    ? m.director.map((d) => str(d)).filter(Boolean)
    : [];

  const name = str(m.name) || "Đang cập nhật";
  const originName = str(m.origin_name);
  const year = str(m.year);
  const quality = str(m.quality);
  const lang = str(m.lang);
  const epCurrent = str(m.episode_current);
  const duration = str(m.time);
  const vote = str(m.tmdb?.vote_average);
  const content = strip(m.content) || "Chưa có mô tả.";

  // Lấy danh sách phim đề xuất cùng phân loại
  const listType =
    m.type === "series"
      ? "phim-bo"
      : m.type === "hoathinh"
      ? "hoat-hinh"
      : "phim-moi-cap-nhat";
  const relatedData = await getList(listType, 1);
  const related = (relatedData?.items || [])
    .filter((it) => it?.slug && it.slug !== slug)
    .slice(0, 8);

  return (
    <main className="wrap" style={{ paddingBottom: 100 }}>
      <Player servers={episodes} movie={{ ...m, slug }} />

      <div className="card detail" style={{ marginTop: 24 }}>
        <div className="pic">{pic && <img src={pic} alt={name} />}</div>
        <div>
          <h1>{name}</h1>
          <p className="sub">
            {originName}
            {year ? ` · ${year}` : ""}
            {quality ? ` · ${quality}` : ""}
            {lang ? ` · ${lang}` : ""}
            {epCurrent ? ` · ${epCurrent}` : ""}
            {duration ? ` · ${duration.includes("phút") ? duration : `${duration} phút`}` : ""}
            {vote && vote !== "0" && vote !== "0.0" ? ` · ⭐ ${vote}` : ""}
          </p>

          <div className="chips" style={{ marginTop: 0, marginBottom: 12 }}>
            {tags.map((c, idx) => (
              <span key={`${c}-${idx}`} className="chip">
                {c}
              </span>
            ))}
          </div>

          <p style={{ lineHeight: 1.6 }}>{content}</p>

          {directors.length > 0 && (
            <p style={{ fontSize: 14, opacity: 0.85, marginTop: 10 }}>
              <b>Đạo diễn:</b> {directors.join(", ")}
            </p>
          )}

          {actors.length > 0 && (
            <p style={{ fontSize: 14, opacity: 0.85, marginTop: 6 }}>
              <b>Diễn viên:</b> {actors.join(", ")}
            </p>
          )}
        </div>
      </div>

      {/* Mục Phim đề xuất */}
      {related.length > 0 && (
        <section style={{ marginTop: 32 }}>
          <h2 style={{ fontSize: 20, marginBottom: 16 }}>Phim đề xuất cho bạn</h2>
          <div className="grid">
            {related.map((item, i) => (
              <MovieCard key={item.slug || i} item={item} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
