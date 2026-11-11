import Link from "next/link";
import { img } from "../lib/api";

const str = (v) =>
  typeof v === "string" || typeof v === "number" ? String(v).trim() : "";

export default function MovieCard(props) {
  try {
    const m =
      props?.item || props?.movie || props?.m || props?.data || props || {};
    if (!m || typeof m !== "object") return null;

    const slug = str(m.slug);
    const name = str(m.name) || "Đang cập nhật";
    if (!slug) return null;

    const originName = str(m.origin_name || m.original_name);
    const year = str(m.year);
    const quality = str(m.quality);
    const epCurrent = str(m.episode_current);
    const pic = img(m.poster_url) || img(m.thumb_url);

    return (
      <Link href={`/phim/${encodeURIComponent(slug)}`} className="card">
        <div className="pic" style={{ position: "relative" }}>
          {pic ? <img src={pic} alt={name} loading="lazy" /> : null}
          {(epCurrent || quality) && (
            <span
              style={{
                position: "absolute",
                top: 8,
                left: 8,
                background: "rgba(0, 0, 0, 0.75)",
                color: "#fff",
                fontSize: 11,
                fontWeight: 600,
                padding: "2px 8px",
                borderRadius: 6
              }}
            >
              {[epCurrent, quality].filter(Boolean).join(" · ")}
            </span>
          )}
        </div>
        <div>
          <h3>{name}</h3>
          <p className="sub">
            {originName}
            {year ? ` · ${year}` : ""}
          </p>
        </div>
      </Link>
    );
  } catch {
    return null;
  }
}
