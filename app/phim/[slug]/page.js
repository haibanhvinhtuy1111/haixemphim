import Player from "../../../components/Player";
import { getMovie, img } from "../../../lib/api";

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
      <main className="wrap">
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

  const name = str(m.name) || "Đang cập nhật";
  const originName = str(m.origin_name);
  const year = str(m.year);
  const quality = str(m.quality);
  const content = strip(m.content) || "Chưa có mô tả.";

  return (
    <main className="wrap">
      <Player servers={episodes} />

      <div className="card detail" style={{ marginTop: 24 }}>
        <div className="pic">{pic && <img src={pic} alt={name} />}</div>
        <div>
          <h1>{name}</h1>
          <p className="sub">
            {originName}
            {year ? ` · ${year}` : ""}
            {quality ? ` · ${quality}` : ""}
          </p>
          <div className="chips" style={{ marginTop: 0, marginBottom: 12 }}>
            {tags.map((c, idx) => (
              <span key={`${c}-${idx}`} className="chip">
                {c}
              </span>
            ))}
          </div>
          <p>{content}</p>
        </div>
      </div>
    </main>
  );
}
