import Link from "next/link";
import { img } from "../lib/api";

export default function MovieCard({ m }) {
  const pic = img(m.thumb_url || m.poster_url);
  return (
    <Link href={`/phim/${m.slug}`} className="poster">
      <div className="pic">{pic && <img src={pic} alt={m.name} loading="lazy" />}</div>
      <div className="meta">
        <div className="t">{m.name}</div>
        <div className="s">{m.origin_name}{m.year ? ` (${m.year})` : ""}</div>
        {m.episode_current && <span className="tag">{m.episode_current}</span>}
      </div>
    </Link>
  );
}
