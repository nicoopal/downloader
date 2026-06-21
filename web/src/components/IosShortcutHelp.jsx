import { useState } from "react";

// Detecta iPhone/iPad (incluye iPad que se hace pasar por Mac con touch).
function isIOS() {
  const ua = navigator.userAgent || "";
  return (
    /iPhone|iPad|iPod/i.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

// Atajo de Apple ya armado y firmado (se importa sin "Atajos no confiables").
const SHORTCUT_URL = "/pals-downloader.shortcut";
const SHARE_BASE = "https://pals-downloader.web.app/share?url=";

// En iOS no existe Web Share Target: la forma de "compartir → abrir la app" es
// un Atajo de Apple. Ofrecemos descargar el atajo ya hecho; el instructivo
// manual queda como alternativa. Solo aparece en iPhone/iPad.
export default function IosShortcutHelp() {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!isIOS()) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(SHARE_BASE);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* sin clipboard: el usuario lo escribe a mano */
    }
  };

  return (
    <>
      <button className="btn ios-btn" onClick={() => setOpen(true)} title="Compartir a la app desde iPhone">
        📲 Atajo para iPhone
      </button>

      {open && (
        <div className="modal-back" onClick={() => setOpen(false)}>
          <div className="modal glass" onClick={(e) => e.stopPropagation()}>
            <h2>Descargar desde «Compartir» en iPhone</h2>
            <p className="modal-lede">
              iPhone no deja que la app aparezca sola en el menú Compartir. Instalá este
              <b> Atajo de Apple</b> (una sola vez) y listo:
            </p>

            <a className="btn-gel sm shortcut-dl" href={SHORTCUT_URL} download="Pal's Downloader.shortcut">
              <span>⬇️ Descargar el atajo</span>
            </a>
            <p className="modal-note">
              Se guarda en <b>Archivos</b> (carpeta Descargas) → tocá el archivo
              <b> Pal&apos;s Downloader.shortcut</b> ahí para importarlo en la app Atajos. Después, en
              YouTube/Instagram/etc. hacés <b>Compartir → Bajar con Pal&apos;s</b> y se abre la web con
              el link cargado. (Abre en Safari; la primera vez quizá tengas que loguearte ahí.)
            </p>

            <details className="manual">
              <summary>¿No te funciona? Armalo a mano</summary>
              <ol className="steps">
                <li>Abrí la app <b>Atajos</b> → tocá <b>+</b>.</li>
                <li>Agregá estas acciones en orden:
                  <ol type="a">
                    <li><b>Obtener URLs de la entrada</b></li>
                    <li><b>Codificar URL</b> (que diga «Codificar»)</li>
                    <li><b>Texto</b>: pegá el link de abajo + la variable <b>Texto codificado</b></li>
                    <li><b>Abrir URLs</b></li>
                  </ol>
                </li>
                <li>Detalles → activá <b>Mostrar en la hoja para compartir</b> (URLs, Páginas web, Texto).</li>
                <li>Guardá como <b>«Bajar con Pal&apos;s»</b>.</li>
              </ol>
              <div className="copy-row">
                <code>{SHARE_BASE}</code>
                <button className="btn-sm" onClick={copy}>{copied ? "¡Copiado!" : "Copiar"}</button>
              </div>
            </details>

            <button className="btn-gel sm modal-close" onClick={() => setOpen(false)}>
              <span>Entendido</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
