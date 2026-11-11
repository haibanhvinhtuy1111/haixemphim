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
    const pic = img(m.thumb_url) || img(m.poster_url);

    return (
      <Link
        href={`/phim/${encodeURIComponent(slug)}`}
        className="card"
        style={{
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          borderRadius: 14,
          textDecoration: "none",
          color: "inherit",
          height: "100%",
          minWidth: 0
        }}
      >
        <div
          className="pic"
          style={{
            position: "relative",
            width: "100%",
            aspectRatio: "2 / 3",
            overflow: "hidden",
            background: "#1c222b",
            borderRadius: 10,
            flexShrink: 0
          }}
        >
          {pic ? (
            <img
              src={pic}
              alt={name}
              loading="lazy"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                objectPosition: "center",
                display: "block"
              }}
            />
          ) : null}

          {(epCurrent || quality) && (
            <span
              style={{
                position: "absolute",
                top: 8,
                left: 8,
                background: "rgba(0, 0, 0, 0.78)",
                color: "#fff",
                fontSize: 11,
                fontWeight: 600,
                padding: "3px 8px",
                borderRadius: 6,
                zIndex: 2,
                maxWidth: "88%",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis"
              }}
            >
              {[epCurrent, quality].filter(Boolean).join(" · ")}
            </span>
          )}
        </div>

        <div style={{ padding: "10px 4px 4px", minWidth: 0 }}>
          <h3
            style={{
              fontSize: 15,
              fontWeight: 700,
              margin: "0 0 4px",
              lineHeight: 1.35,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden"
            }}
          >
            {name}
          </h3>
          <p
            className="sub"
            style={{
              fontSize: 12,
              margin: 0,
              opacity: 0.75,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis"
            }}
          >
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
