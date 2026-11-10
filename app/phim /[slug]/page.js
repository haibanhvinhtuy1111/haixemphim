import { notFound } from "next/navigation";
import Player from "../../../components/Player";
import { getMovie, img } from "../../../lib/api";

export const revalidate = 600;

export async function generateMetadata({ params }) {
  const data = await getMovie(params.slug);
  return { title: data?.movie?.name || "Phim" };
}

const strip = (s = "") => String(s).replace(/<[^>]+>/g, "");

export default async function MoviePage({ params }) {
  const data = await getMovie(params.slug);
  if (!data) notFound();
  const { movie: m, episodes } = data;
  const pic = img(m.poster_url || m.thumb_url);
  const tags = [...(m.category || []), ...(m.country || [])].map((c) => c.name).filter(Boolean);

  return (
    <main className="wrap">
      <Player servers={episodes} />

      <div className="card detail" style={{ marginTop: 24 }}>
        <div className="pic">{pic && <img src={pic} alt={m.name} />}</div>
        <div>
          <h1>{m.name}</h1>
          <p className="sub">{m.origin_name}{m.year ? ` · ${m.year}` : ""}{m.quality ? ` · ${m.quality}` : ""}</p>
          <div className="chips" style={{ marginTop: 0, marginBottom: 12 }}>
            {tags.map((c) => <span key={c} className="chip">{c}</span>)}
          </div>
          <p>{strip(m.content) || "Chưa có mô tả."}</p>
        </div>
      </div>
    </main>
  );
}
