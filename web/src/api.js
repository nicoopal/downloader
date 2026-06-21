import { auth } from "./firebase";

// Backend principal (Oracle): TikTok, Twitter, Instagram, etc.
const ORACLE_BASE = import.meta.env.VITE_API_BASE;

// Detecta si un link es de YouTube (esos van al backend de la PC del usuario).
export function isYouTubeUrl(url) {
  return /(?:youtube\.com|youtu\.be|youtube-nocookie\.com)/i.test(url || "");
}

async function authHeader() {
  const user = auth.currentUser;
  if (!user) throw new Error("No autenticado");
  const token = await user.getIdToken();
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

export async function fetchInfo(url, base = ORACLE_BASE) {
  const res = await fetch(`${base}/api/info`, {
    method: "POST",
    headers: await authHeader(),
    body: JSON.stringify({ url }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "No se pudo leer el link");
  }
  return res.json();
}

// Descarga el archivo y dispara el guardado en el navegador.
export async function downloadFile(url, mode, quality, base = ORACLE_BASE) {
  const res = await fetch(`${base}/api/download`, {
    method: "POST",
    headers: await authHeader(),
    body: JSON.stringify({ url, mode, quality }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Falló la descarga");
  }

  // Nombre sugerido por el servidor.
  const disposition = res.headers.get("Content-Disposition") || "";
  const match = disposition.match(/filename="?([^"]+)"?/);
  const filename = match ? match[1] : "download";

  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(blobUrl);
}
