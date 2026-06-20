import { useState } from "react";
import { fetchInfo, downloadFile } from "../api";

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
  const [busy, setBusy] = useState(false);

  const onInfo = async () => {
    if (!url.trim()) return;
    setBusy(true);
    setStatus("Leyendo link…");
    setInfo(null);
    try {
      const data = await fetchInfo(url.trim());
      setInfo(data);
      // YouTube en 4K es muy pesado para la VM: por defecto 1080p.
      const isYouTube = (data.extractor || "").toLowerCase().includes("youtube");
      setQuality(isYouTube ? "1080" : "best");
      setStatus("");
    } catch (e) {
      setStatus(`⚠️ ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  const onDownload = async () => {
    setBusy(true);
    setStatus("Descargando… (puede tardar según el tamaño)");
    try {
      await downloadFile(url.trim(), mode, mode === "video" ? quality : null);
      setStatus("✅ ¡Listo! Revisá tus descargas.");
    } catch (e) {
      setStatus(`⚠️ ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="panel">
      <h2>Descargar</h2>
      <div className="row">
        <input
          className="input"
          placeholder="Pegá un link de YouTube, Instagram, TikTok, X…"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onInfo()}
        />
        <button className="btn" onClick={onInfo} disabled={busy || !url.trim()}>
          Buscar
        </button>
      </div>

      {info && (
        <div className="info card">
          {info.thumbnail && <img className="thumb" src={info.thumbnail} alt="" />}
          <div>
            <h3>{info.title}</h3>
            <p className="muted">
              {info.uploader} · {fmtDuration(info.duration)} · {info.extractor}
            </p>

            <div className="row wrap">
              <label className={`chip ${mode === "video" ? "on" : ""}`}>
                <input type="radio" name="mode" checked={mode === "video"} onChange={() => setMode("video")} />
                🎬 Video (mp4)
              </label>
              <label className={`chip ${mode === "audio" ? "on" : ""}`}>
                <input type="radio" name="mode" checked={mode === "audio"} onChange={() => setMode("audio")} />
                🎵 Audio (mp3)
              </label>

              {mode === "video" && (
                <select className="input small" value={quality} onChange={(e) => setQuality(e.target.value)}>
                  <option value="best">Mejor calidad</option>
                  <option value="1080">1080p</option>
                  <option value="720">720p</option>
                  <option value="480">480p</option>
                </select>
              )}
            </div>

            <button className="btn primary" onClick={onDownload} disabled={busy}>
              {busy ? "Procesando…" : "Descargar"}
            </button>
          </div>
        </div>
      )}

      {status && <p className="status">{status}</p>}
    </div>
  );
}
