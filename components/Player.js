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

export default function Player({ servers = [] }) {
  const validServers = Array.isArray(servers)
    ? servers.filter((s) => Array.isArray(s?.server_data) && s.server_data.length > 0)
    : [];

  const [sIdx, setSIdx] = useState(0);
  const [eIdx, setEIdx] = useState(0);
  const [mode, setMode] = useState("auto"); // "auto" | "m3u8" | "embed"
  const videoRef = useRef(null);

  const currentServer = validServers[sIdx] || validServers[0];
  const episodes = currentServer?.server_data || [];
  const currentEp = episodes[eIdx] || episodes[0] || null;

  const m3u8Url = pickM3u8(currentEp);
  const embedUrl = pickEmbed(currentEp);

  const useM3u8 =
    mode === "m3u8" ? Boolean(m3u8Url) : mode === "embed" ? false : Boolean(m3u8Url);

  useEffect(() => {
    setMode("auto");
  }, [sIdx, eIdx]);

  useEffect(() => {
    if (!useM3u8 || !m3u8Url || !videoRef.current) return;
    const video = videoRef.current;
    let hls;

    // Nếu trình duyệt hỗ trợ HLS tự nhiên (Safari / iOS)
    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = m3u8Url;
      return;
    }

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

    return () => {
      if (hls) hls.destroy();
    };
  }, [useM3u8, m3u8Url, embedUrl]);

  if (!validServers.length || !currentEp) {
    return <div className="notice">Phim hiện chưa có tập phát.</div>;
  }

  return (
    <div>
      <div
        className="player"
        style={{
          position: "relative",
          width: "100%",
          aspectRatio: "16 / 9",
          background: "#000",
          borderRadius: 12,
          overflow: "hidden"
        }}
      >
        {useM3u8 ? (
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
      </div>

      {/* Thanh đổi chế độ phát nếu tập phim có cả 2 link */}
      {m3u8Url && embedUrl && (
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <button
            type="button"
            className="chip"
            onClick={() => setMode(useM3u8 ? "embed" : "m3u8")}
            style={{ cursor: "pointer" }}
          >
            Đang dùng: {useM3u8 ? "Trình phát M3U8" : "Trình phát Embed"} (Bấm để đổi)
          </button>
        </div>
      )}

      {/* Chọn Server (nếu có nhiều server) */}
      {validServers.length > 1 && (
        <div className="chips" style={{ marginTop: 12 }}>
          {validServers.map((sv, i) => (
            <button
              key={i}
              type="button"
              className={`chip ${i === sIdx ? "active" : ""}`}
              onClick={() => {
                setSIdx(i);
                setEIdx(0);
              }}
              style={{ cursor: "pointer" }}
            >
              {sv.server_name || `Server #${i + 1}`}
            </button>
          ))}
        </div>
      )}

      {/* Danh sách tập */}
      <div className="chips" style={{ marginTop: 12 }}>
        {episodes.map((ep, i) => (
          <button
            key={ep.slug || ep.name || i}
            type="button"
            className={`chip ${i === eIdx ? "active" : ""}`}
            onClick={() => setEIdx(i)}
            style={{ cursor: "pointer" }}
          >
            {ep.name || `Tập ${i + 1}`}
          </button>
        ))}
      </div>
    </div>
  );
}
