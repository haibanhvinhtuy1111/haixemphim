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
  const [mode, setMode] = useState("auto");
  const [hideBurnIn, setHideBurnIn] = useState(false);
  const videoRef = useRef(null);

  const currentServer = validServers[sIdx] || validServers[0];
  const episodes = currentServer?.server_data || [];
  const currentEp = episodes[eIdx] || episodes[0] || null;

  const m3u8Url = pickM3u8(currentEp);
  const embedUrl = pickEmbed(currentEp);

  const useM3u8 =
    mode === "m3u8" ? Boolean(m3u8Url) : mode === "embed" ? false : Boolean(m3u8Url);

  // Tự động bật che quảng cáo in cứng nếu đang phát server của vsmov (không phải Bản Sạch)
  const isCleanServer = String(currentServer?.server_name || "").includes("Bản Sạch");

  useEffect(() => {
    setMode("auto");
    setHideBurnIn(!isCleanServer);
  }, [sIdx, eIdx, isCleanServer]);

  useEffect(() => {
    if (!useM3u8 || !m3u8Url || !videoRef.current) return;
    const video = videoRef.current;
    let hls;

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

        {/* Lớp phủ làm mờ/che dòng chữ vsbet ở mép trên và logo VSmov ở góc dưới phải khi video bị in cứng */}
        {hideBurnIn && (
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

      {/* Thanh công cụ chuyển đổi nhanh */}
      <div className="chips" style={{ marginTop: 10 }}>
        <button
          type="button"
          className={`chip ${hideBurnIn ? "active" : ""}`}
          onClick={() => setHideBurnIn((v) => !v)}
          style={{ cursor: "pointer" }}
        >
          {hideBurnIn ? "Đang bật: Che QC in cứng" : "Che QC in cứng (Tắt)"}
        </button>

        {m3u8Url && embedUrl && (
          <button
            type="button"
            className="chip"
            onClick={() => setMode(useM3u8 ? "embed" : "m3u8")}
            style={{ cursor: "pointer" }}
          >
            Đổi trình phát ({useM3u8 ? "M3U8" : "Embed"})
          </button>
        )}
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
