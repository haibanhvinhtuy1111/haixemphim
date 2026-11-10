"use client";
import { useEffect, useRef, useState } from "react";

export default function Player({ servers = [] }) {
  const [si, setSi] = useState(0);
  const [ei, setEi] = useState(0);
  const videoRef = useRef(null);

 const list = servers[si]?.server_data || [];
  const ep = list[ei];
  const m3u8 = ep?.link_m3u8;
  const embed = ep?.link_embed;

  useEffect(() => {
    const v = videoRef.current;
    if (!m3u8 || !v) return;
    let hls;
    (async () => {
      if (v.canPlayType("application/vnd.apple.mpegurl")) {
        v.src = m3u8;
      } else {
        const Hls = (await import("hls.js")).default;
        if (Hls.isSupported()) {
          hls = new Hls();
          hls.loadSource(m3u8);
          hls.attachMedia(v);
        }
      }
    })();
    return () => hls?.destroy();
  }, [m3u8]);

  if (!servers.length) return <p className="sub">Phim này chưa có tập để phát.</p>;

  return (
    <div>
      <div className="player">
        {m3u8 ? (
          <video ref={videoRef} controls playsInline />
        ) : embed ? (
          <iframe src={embed} allowFullScreen title={ep?.name || "Player"} />
        ) : null}
      </div>

      {servers.length > 1 && (
        <div className="eps" aria-label="Server">
          {servers.map((s, i) => (
            <button key={i} className={`ep ${i === si ? "on" : ""}`} onClick={() => { setSi(i); setEi(0); }}>
              {s.server_name || `Server ${i + 1}`}
            </button>
          ))}
        </div>
      )}

      <div className="eps">
        {list.map((e, i) => (
          <button key={i} className={`ep ${i === ei ? "on" : ""}`} onClick={() => setEi(i)}>
            {e.name || `Tập ${i + 1}`}
          </button>
        ))}
      </div>
    </div>
  );
}
