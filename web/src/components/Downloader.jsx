import { useState, useEffect } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { fetchInfo, downloadFile, isYouTubeUrl } from "../api";

// Plataformas soportadas (solo informativo, para mostrar bajo la barra)
const PLATFORMS = [
  { name: "YouTube", dot: "#ff3b30" },
  { name: "Instagram", dot: "#e1306c" },
  { name: "TikTok", dot: "#00d1d1" },
  { name: "X", dot: "#222" },
  { name: "Dailymotion", dot: "#0a6efb" },
  { name: "Vimeo", dot: "#17b6ea" },
  { name: "BitChute", dot: "#ef4b34" },
  { name: "Odysee", dot: "#c4137a" },
  { name: "Rumble", dot: "#6bbf2a" },
  { name: "Archive.org", dot: "#3a83c4" },
  { name: "9GAG", dot: "#16d05a" },
  { name: "Imgur", dot: "#1bb76e" },
  { name: "Coub", dot: "#3f5fd6" },
  { name: "Bandcamp", dot: "#1da0c3" },
  { name: "SoundCloud", dot: "#ff5500" },
  { name: "Apple Podcasts", dot: "#9b51e0" },
  { name: "Audiomack", dot: "#f5a200" },
  { name: "Mixcloud", dot: "#2475f0" },
  { name: "Beatport", dot: "#8bd400" },
];

function fmtDuration(s) {
  if (!s) return "";
  const m = Math.floor(s / 60);
  const sec = String(s % 60).padStart(2, "0");
  return `${m}:${sec}`;
}

export default function Downloader() {
  const [url, setUrl] = useState("");
  const [info, setInfo] = useState(null);
  const [mode, setMode] = useState("video");
  const [quality, setQuality] = useState("best");
  const [status, setStatus] = useState("");
  const [statusKind, setStatusKind] = useState(""); // "", "ok", "err"
  const [busy, setBusy] = useState(false);
  const [pc, setPc] = useState({ online: false, url: null });
  const [pcLoaded, setPcLoaded] = useState(false);
  const [pendingShared, setPendingShared] = useState(null);

  // Estado de la PC de YouTube (heartbeat en Firestore → indicador ON/OFF).
  useEffect(() => {
    return onSnapshot(
      doc(db, "config", "pc_backend"),
      (snap) => {
        const d = snap.data();
        const fresh = d?.updatedAt?.toMillis ? Date.now() - d.updatedAt.toMillis() < 120000 : false;
        setPc({ online: !!(d?.online && fresh), url: d?.url || null });
        setPcLoaded(true);
      },
      () => {
        setPc({ online: false, url: null });
        setPcLoaded(true);
      }
    );
  }, []);

  // Web Share Target: al compartir un link a la PWA, Android abre /share?url=&text=&title=.
  // Extraemos el link, limpiamos la barra de direcciones y marcamos para auto-buscar.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const raw = p.get("url") || p.get("text") || p.get("title") || "";
    const m = raw.match(/https?:\/\/[^\s]+/);
    const shared = (m ? m[0] : raw).trim();
    if (shared) {
      setUrl(shared);
      setPendingShared(shared);
      window.history.replaceState({}, "", "/");
    }
  }, []);

  // Dispara la búsqueda automática del link compartido. Si es YouTube esperamos
  // a saber si la PC está online (pcLoaded) para no mostrar "OFF" por error.
  useEffect(() => {
    if (!pendingShared) return;
    if (isYouTubeUrl(pendingShared) && !pcLoaded) return;
    setPendingShared(null);
    onInfo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingShared, pcLoaded]);

  const onInfo = async () => {
    const u = url.trim();
    if (!u) return;
    if (isYouTubeUrl(u) && !pc.online) {
      setStatus("⚠️ Para bajar de YouTube tenés que encender la PC de Pal's (mirá la badge: YouTube OFF).");
      setStatusKind("err");
      return;
    }
    setBusy(true);
    setStatus("");
    setStatusKind("");
    setInfo(null);
    try {
      const base = isYouTubeUrl(u) ? pc.url : undefined;
      const data = await fetchInfo(u, base);
      setInfo(data);
      // YouTube en 4K es muy pesado para la VM: por defecto 1080p.
      const isYouTube = (data.extractor || "").toLowerCase().includes("youtube");
      setQuality(isYouTube ? "1080" : "best");
      setStatus("");
    } catch (e) {
      setStatus(`⚠️ ${e.message}`);
      setStatusKind("err");
    } finally {
      setBusy(false);
    }
  };

  const onDownload = async () => {
    const u = url.trim();
    if (isYouTubeUrl(u) && !pc.online) {
      setStatus("⚠️ Para bajar de YouTube tenés que encender la PC de Pal's (badge: YouTube OFF).");
      setStatusKind("err");
      return;
    }
    setBusy(true);
    setStatus("Procesando tu archivo…");
    setStatusKind("");
    try {
      const base = isYouTubeUrl(u) ? pc.url : undefined;
      await downloadFile(u, mode, mode === "video" ? quality : null, base);
      setStatus("✅ ¡Listo! Revisá tus descargas.");
      setStatusKind("ok");
    } catch (e) {
      setStatus(`⚠️ ${e.message}`);
      setStatusKind("err");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="hero">
      <span
        className={`eyebrow ${pc.online ? "on" : "off"}`}
        title={pc.online
          ? "La PC de Pal's está encendida: YouTube disponible"
          : "La PC está apagada: YouTube no disponible por ahora (el resto sí)"}
      >
        <span className="led" />YouTube: {pc.online ? "ON" : "OFF"}
      </span>
      <h1 className="title">Bajá lo que quieras.</h1>
      <p className="lede">
        Pegá un link de cualquier lado y llevátelo en segundos. Audio o video, la calidad la elegís vos.
      </p>

      <div className="searchbar glass">
        <span className="link-ic">🔗</span>
        <input
          placeholder="https://…"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onInfo()}
        />
        <button className="btn-gel" onClick={onInfo} disabled={busy || !url.trim()}>
          <span>Buscar</span>
        </button>
      </div>

      {!info && !busy && (
        <div className="platforms">
          <div className="plabel">Bajá de cualquiera de estos</div>
          <div className="pills">
            {PLATFORMS.map((p) => (
              <span className="pill" key={p.name}>
                <span className="dot" style={{ background: p.dot }} />
                {p.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {busy && !info && (
        <div className="skel glass">
          <div className="skel-thumb" />
          <div className="skel-body">
            <div className="skel-line a" />
            <div className="skel-line b" />
            <div className="skel-line c" />
          </div>
        </div>
      )}

      {!busy && status && !info && <p className={`status ${statusKind}`} style={{ marginTop: 18 }}>{status}</p>}

      {info && (
        <div className="result glass">
          <div className="thumb">
            {info.thumbnail && <img src={info.thumbnail} alt="" />}
            {info.extractor && <span className="badge-plat">{info.extractor}</span>}
            {info.duration ? <span className="badge-dur">{fmtDuration(info.duration)}</span> : null}
            <div className="play"><span>▶</span></div>
          </div>

          <div className="result-body">
            <h3>{info.title}</h3>
            <p className="meta">
              {info.uploader}
              {info.uploader && info.extractor ? " · " : ""}
              {info.extractor}
            </p>

            <div className="modes">
              <button className={`mode${mode === "video" ? " on" : ""}`} onClick={() => setMode("video")}>
                🎬 Video · MP4
              </button>
              <button className={`mode${mode === "audio" ? " on" : ""}`} onClick={() => setMode("audio")}>
                🎵 Audio · MP3
              </button>

              {mode === "video" && (
                <div className="quality">
                  <select value={quality} onChange={(e) => setQuality(e.target.value)}>
                    <option value="best">Mejor calidad</option>
                    <option value="1080">1080p</option>
                    <option value="720">720p</option>
                    <option value="480">480p</option>
                  </select>
                  <span className="caret">▾</span>
                </div>
              )}
            </div>

            <div className="actions">
              <button className="btn-gel" onClick={onDownload} disabled={busy}>
                <span>
                  {busy && <span className="spinner" />}
                  {busy ? "Procesando…" : "Descargar"}
                </span>
              </button>
              {status && <span className={`status ${statusKind}`}>{status}</span>}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
