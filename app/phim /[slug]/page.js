import Player from "../../../components/Player";
import { getMovie, img } from "../../../lib/api";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const data = await getMovie(slug);
  return { title: data?.movie?.name || "Phim" };
}

const strip = (s) => String(s || "").replace(/<[^>]+>/g, "");

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
  const tags = [...(m.category || []), ...(m.country || [])]
    .map((c) => c?.name)
    .filter(Boolean);

  return (
    <main className="wrap">
      <Player servers={episodes} />

      <div className="card detail" style={{ marginTop: 24 }}>
        <div className="pic">{pic && <img src={pic} alt={m.name} />}</div>
        <div>
          <h1>{m.name}</h1>
          <p className="sub">
            {m.origin_name}
            {m.year ? ` · ${m.year}` : ""}
            {m.quality ? ` · ${m.quality}` : ""}
          </p>
          <div className="chips" style={{ marginTop: 0, marginBottom: 12 }}>
            {tags.map((c) => (
              <span key={c} className="chip">{c}</span>
            ))}
          </div>
          <p>{strip(m.content) || "Chưa có mô tả."}</p>
        </div>
      </div>
    </main>
  );
}
