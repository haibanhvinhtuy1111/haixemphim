"use client";
import { useState, useEffect, useRef } from "react";

function pickM3u8(ep) {
  if (!ep || typeof ep !== "object") return "";
  const cand = ep.link_m3u8 || ep.m3u8 || ep.url_m3u8 || ep.file || "";
  return typeof cand === "string" && cand.includes(".m3u8") ? cand.trim() : "";
}

function pickEmbed(ep) {
  if (!ep || typeof ep !== "object") return "";
  const cand = ep.link_embed || ep.embed || ep.url_embed || ep.link || ep.url || "";
  return typeof cand === "string" ? cand.trim() : "";
}

function getYoutubeEmbed(url) {
  if (!url || typeof url !== "string") return "";
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{6,})/);
  return m ? `https://www.youtube.com/embed/${m[1]}?autoplay=1` : "";
}

export default function Player({ servers = [], movie = null }) {
  const validServers = Array.isArray(servers)
    ? servers.filter((s) => Array.isArray(s?.server_data) && s.server_data.length > 0)
    : [];

  const [sIdx, setSIdx] = useState(0);
  const [eIdx, setEIdx] = useState(0);
  const [mode, setMode] = useState("auto"); // "auto" | "m3u8" | "embed" | "trailer"
  const [hideBurnIn, setHideBurnIn] = useState(false);
  const [lightsOff, setLightsOff] = useState(false);
  const [autoNext, setAutoNext] = useState(true);
  const [epSearch, setEpSearch] = useState("");
  const [watchedEps, setWatchedEps] = useState([]);
  const [isFav, setIsFav] = useState(false);
  const [resumeTime, setResumeTime] = useState(0);

  const videoRef = useRef(null);
  const storageKey = movie?.slug
    ? `hx_progress_${movie.slug}`
    : typeof window !== "undefined"
    ? `hx_progress_${window.location.pathname}`
    : "hx_progress_default";

  const currentServer = validServers[sIdx] || validServers[0];
  const episodes = currentServer?.server_data || [];
  const currentEp = episodes[eIdx] || episodes[0] || null;

  const m3u8Url = pickM3u8(currentEp);
  const embedUrl = pickEmbed(currentEp);
  const trailerEmbed = getYoutubeEmbed(movie?.trailer_url);

  const useM3u8 =
    mode === "trailer"
      ? false
      : mode === "m3u8"
      ? Boolean(m3u8Url)
      : mode === "embed"
      ? false
      : Boolean(m3u8Url);

  const isCleanServer = String(currentServer?.server_name || "").includes("Bản Sạch");

  // Khôi phục tập đang xem dở và trạng thái Yêu thích từ localStorage
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
      if (saved) {
        if (
          typeof saved.sIdx === "number" &&
          saved.sIdx >= 0 &&
          saved.sIdx < validServers.length
        ) {
          setSIdx(saved.sIdx);
        }
        if (typeof saved.eIdx === "number" && saved.eIdx >= 0) {
          setEIdx(saved.eIdx);
        }
        if (Array.isArray(saved.watched)) {
          setWatchedEps(saved.watched);
        }
        if (typeof saved.time === "number" && saved.time > 10) {
          setResumeTime(saved.time);
        }
      }

      if (movie?.slug) {
        const favs = JSON.parse(localStorage.getItem("hx_favorites") || "[]");
        setIsFav(favs.some((f) => f.slug === movie.slug));
      }
    } catch {}
  }, [storageKey, movie?.slug]);

  // Lưu lịch sử tập đang xem
  useEffect(() => {
    if (!currentEp) return;
    setMode((prev) => (prev === "trailer" ? "auto" : prev));
    setHideBurnIn(!isCleanServer);

    try {
      const epKey = `${sIdx}_${eIdx}`;
      const nextWatched = Array.from(new Set([...watchedEps, epKey]));
      setWatchedEps(nextWatched);

      const prevSaved = JSON.parse(localStorage.getItem(storageKey) || "{}");
      const isSameEp = prevSaved.sIdx === sIdx && prevSaved.eIdx === eIdx;

      localStorage.setItem(
        storageKey,
        JSON.stringify({
          sIdx,
          eIdx,
          epName: currentEp.name || `Tập ${eIdx + 1}`,
          watched: nextWatched,
          time: isSameEp ? prevSaved.time || 0 : 0,
          updatedAt: Date.now()
        })
      );

      if (movie?.slug) {
        const history = JSON.parse(localStorage.getItem("hx_history") || "[]");
        const item = {
          slug: movie.slug,
          name: movie.name || "",
          origin_name: movie.origin_name || "",
          poster_url: movie.poster_url || movie.thumb_url || "",
          thumb_url: movie.thumb_url || movie.poster_url || "",
          year: movie.year || "",
          quality: movie.quality || "",
          epName: currentEp.name || `Tập ${eIdx + 1}`,
          updatedAt: Date.now()
        };
        const filtered = history.filter((h) => h.slug !== movie.slug);
        localStorage.setItem("hx_history", JSON.stringify([item, ...filtered].slice(0, 24)));
      }
    } catch {}
  }, [sIdx, eIdx, isCleanServer]);

  // Khởi tạo trình phát HLS (.m3u8) + tự tua đến giây đang xem + tự chuyển tập
  useEffect(() => {
    if (!useM3u8 || !m3u8Url || !videoRef.current) return;
    const video = videoRef.current;
    let hls;

    const handleLoaded = () => {
      if (resumeTime > 10 && video.duration && resumeTime < video.duration - 15) {
        video.currentTime = resumeTime;
        setResumeTime(0);
      }
    };

    const handleTimeUpdate = () => {
      if (!video.currentTime || video.currentTime < 5) return;
      if (Math.floor(video.currentTime) % 5 === 0) {
        try {
          const saved = JSON.parse(localStorage.getItem(storageKey) || "{}");
          saved.time = Math.floor(video.currentTime);
          localStorage.setItem(storageKey, JSON.stringify(saved));
        } catch {}
      }
    };

    const handleEnded = () => {
      if (autoNext && eIdx + 1 < episodes.length) {
        setResumeTime(0);
        setEIdx((prev) => prev + 1);
      }
    };

    video.addEventListener("loadedmetadata", handleLoaded);
    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("ended", handleEnded);

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = m3u8Url;
    } else {
      const initHls = () => {
        if (window.Hls && window.Hls.isSupported()) {
          hls = new window.Hls();
          hls.loadSource(m3u8Url);
          hls.attachMedia(video);
          hls.on(window.Hls.Events.ERROR, (_, data) => {
            if (data?.fatal && embedUrl) {
              setMode("embed");
            }
          });
        }
      };

      if (window.Hls) {
        initHls();
      } else {
        const script = document.createElement("script");
        script.src = "https://cdn.jsdelivr.net/npm/hls.js@1.5.15/dist/hls.min.js";
        script.async = true;
        script.onload = initHls;
        document.head.appendChild(script);
      }
    }

    return () => {
      video.removeEventListener("loadedmetadata", handleLoaded);
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("ended", handleEnded);
      if (hls) hls.destroy();
    };
  }, [useM3u8, m3u8Url, embedUrl, autoNext, eIdx, episodes.length, resumeTime, storageKey]);

  const toggleFavorite = () => {
    if (!movie?.slug) return;
    try {
      const favs = JSON.parse(localStorage.getItem("hx_favorites") || "[]");
      let next;
      if (isFav) {
        next = favs.filter((f) => f.slug !== movie.slug);
        setIsFav(false);
      } else {
        const item = {
          slug: movie.slug,
          name: movie.name || "",
          origin_name: movie.origin_name || "",
          poster_url: movie.poster_url || movie.thumb_url || "",
          thumb_url: movie.thumb_url || movie.poster_url || "",
          year: movie.year || "",
          quality: movie.quality || ""
        };
        next = [item, ...favs.filter((f) => f.slug !== movie.slug)].slice(0, 48);
        setIsFav(true);
      }
      localStorage.setItem("hx_favorites", JSON.stringify(next));
    } catch {}
  };

  if (!validServers.length || !currentEp) {
    return <div className="notice">Phim hiện chưa có tập phát.</div>;
  }

  const filteredEpisodes = episodes
    .map((ep, idx) => ({ ep, idx }))
    .filter(({ ep, idx }) => {
      if (!epSearch.trim()) return true;
      const label = String(ep.name || idx + 1).toLowerCase();
      return label.includes(epSearch.trim().toLowerCase());
    });

  return (
    <div>
      {/* Lớp nền tối khi bật chế độ Rạp phim (Tắt đèn) */}
      {lightsOff && (
        <div
          onClick={() => setLightsOff(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.88)",
            zIndex: 90,
             transition: "opacity 0.25s ease"
          }}
        />
      )}

      <div
        style={{
          position: "relative",
          zIndex: lightsOff ? 95 : 1
        }}
      >
        {/* Khung phát video */}
        <div
          className="player"
          style={{
            position: "relative",
            width: "100%",
            aspectRatio: "16 / 9",
            background: "#000",
            borderRadius: 12,
            overflow: "hidden",
            boxShadow: lightsOff ? "0 0 60px rgba(0,0,0,0.9)" : "none"
          }}
        >
          {mode === "trailer" && trailerEmbed ? (
            <iframe
              key={trailerEmbed}
              src={trailerEmbed}
              style={{ width: "100%", height: "100%", border: 0 }}
              allowFullScreen
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            />
          ) : useM3u8 ? (
            <video
              ref={videoRef}
              controls
              playsInline
              style={{ width: "100%", height: "100%", background: "#000" }}
            />
          ) : embedUrl ? (
            <iframe
              key={embedUrl}
              src={embedUrl}
              style={{ width: "100%", height: "100%", border: 0 }}
              allowFullScreen
              referrerPolicy="no-referrer"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            />
          ) : (
            <div style={{ color: "#fff", padding: 24 }}>
              Không tìm thấy link phát cho tập này.
            </div>
          )}

          {/* Lớp phủ che dòng chữ quảng cáo vsbet ở mép trên và logo VSmov ở góc dưới */}
          {hideBurnIn && mode !== "trailer" && (
            <>
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  height: "14%",
                  background: "linear-gradient(to bottom, rgba(0,0,0,0.92) 60%, rgba(0,0,0,0))",
                  backdropFilter: "blur(10px)",
                  WebkitBackdropFilter: "blur(10px)",
                  pointerEvents: "none",
                  zIndex: 10
                }}
              />
              <div
                style={{
                  position: "absolute",
                  bottom: "7%",
                  right: "1.5%",
                  width: "14%",
                  height: "9%",
                  borderRadius: 6,
                  background: "rgba(15, 15, 15, 0.75)",
                  backdropFilter: "blur(12px)",
                  WebkitBackdropFilter: "blur(12px)",
                  pointerEvents: "none",
                  zIndex: 10
                }}
              />
            </>
          )}
        </div>

        {/* Thanh điều khiển Cinema Bar */}
        <div
          className="chips"
          style={{
            marginTop: 10,
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            alignItems: "center"
          }}
        >
          {episodes.length > 1 && (
            <>
              <button
                type="button"
                className="chip"
                disabled={eIdx <= 0}
                onClick={() => {
                  setResumeTime(0);
                  setEIdx((p) => Math.max(0, p - 1));
                }}
                style={{
                  cursor: eIdx > 0 ? "pointer" : "not-allowed",
                  opacity: eIdx > 0 ? 1 : 0.45
                }}
              >
                ⏮ Tập trước
              </button>

              <button
                type="button"
                className="chip"
                disabled={eIdx >= episodes.length - 1}
                onClick={() => {
                  setResumeTime(0);
                  setEIdx((p) => Math.min(episodes.length - 1, p + 1));
                }}
                style={{
                  cursor: eIdx < episodes.length - 1 ? "pointer" : "not-allowed",
                  opacity: eIdx < episodes.length - 1 ? 1 : 0.45
                }}
              >
                ⏭ Tập tiếp
              </button>

              <button
                type="button"
                className={`chip ${autoNext ? "active" : ""}`}
                onClick={() => setAutoNext((v) => !v)}
                style={{ cursor: "pointer" }}
              >
                🔁 Tự chuyển tập: {autoNext ? "Bật" : "Tắt"}
              </button>
            </>
          )}

          <button
            type="button"
            className={`chip ${lightsOff ? "active" : ""}`}
            onClick={() => setLightsOff((v) => !v)}
            style={{ cursor: "pointer" }}
          >
            💡 {lightsOff ? "Bật đèn" : "Tắt đèn"}
          </button>

          {movie?.slug && (
            <button
              type="button"
              className={`chip ${isFav ? "active" : ""}`}
              onClick={toggleFavorite}
              style={{ cursor: "pointer" }}
            >
              {isFav ? "❤️ Đã lưu" : "🤍 Lưu phim"}
            </button>
          )}

          {trailerEmbed && (
            <button
              type="button"
              className={`chip ${mode === "trailer" ? "active" : ""}`}
              onClick={() => setMode((m) => (m === "trailer" ? "auto" : "trailer"))}
              style={{ cursor: "pointer" }}
            >
              🎬 {mode === "trailer" ? "Quay lại Phim" : "Xem Trailer"}
            </button>
          )}

          <button
            type="button"
            className={`chip ${hideBurnIn ? "active" : ""}`}
            onClick={() => setHideBurnIn((v) => !v)}
            style={{ cursor: "pointer" }}
          >
            🛡️ Che QC: {hideBurnIn ? "Bật" : "Tắt"}
          </button>

          {m3u8Url && embedUrl && (
            <button
              type="button"
              className="chip"
              onClick={() => setMode(useM3u8 ? "embed" : "m3u8")}
              style={{ cursor: "pointer" }}
            >
              ⚙️ Luồng: {useM3u8 ? "M3U8" : "Embed"}
            </button>
          )}
        </div>
      </div>

      {/* Chọn Server */}
      {validServers.length > 1 && (
        <div className="chips" style={{ marginTop: 12 }}>
          {validServers.map((sv, i) => (
            <button
              key={i}
              type="button"
              className={`chip ${i === sIdx ? "active" : ""}`}
              onClick={() => {
                setSIdx(i);
                setResumeTime(0);
              }}
              style={{ cursor: "pointer" }}
            >
              {sv.server_name || `Server #${i + 1}`}
            </button>
          ))}
        </div>
      )}

      {/* Thanh tìm nhanh tập (hiện khi phim có trên 12 tập) */}
      {episodes.length > 12 && (
        <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 10 }}>
          <input
            type="text"
            placeholder={`Tìm tập (1 - ${episodes.length})...`}
            value={epSearch}
            onChange={(e) => setEpSearch(e.target.value)}
            style={{
              padding: "6px 12px",
              borderRadius: 999,
              border: "1px solid rgba(0,0,0,0.15)",
              fontSize: 14,
              width: 190,
              outline: "none"
            }}
          />
          <span style={{ fontSize: 13, opacity: 0.7 }}>
            Đang phát: <b>{currentEp.name || `Tập ${eIdx + 1}`}</b>
          </span>
        </div>
      )}

      {/* Danh sách tập (có đánh dấu tập đã xem và giới hạn chiều cao cuộn mượt) */}
      <div
        className="chips"
        style={{
          marginTop: 12,
          maxHeight: 210,
          overflowY: "auto",
          paddingRight: 4
        }}
      >
        {filteredEpisodes.map(({ ep, idx }) => {
          const isCurrent = idx === eIdx && mode !== "trailer";
          const isWatched = watchedEps.includes(`${sIdx}_${idx}`);
          return (
            <button
              key={ep.slug || ep.name || idx}
              type="button"
              className={`chip ${isCurrent ? "active" : ""}`}
              onClick={() => {
                setMode("auto");
                setResumeTime(0);
                setEIdx(idx);
              }}
              style={{
                cursor: "pointer",
                opacity: !isCurrent && isWatched ? 0.65 : 1,
                border:
                  !isCurrent && isWatched
                    ? "1px dashed rgba(31, 77, 54, 0.5)"
                    : undefined
              }}
              title={isWatched ? "Đã xem" : ""}
            >
              {ep.name || `Tập ${idx + 1}`}
            </button>
          );
        })}
      </div>
    </div>
  );
}
