import { useState } from "react";

// Detecta iPhone/iPad (incluye iPad que se hace pasar por Mac con touch).
function isIOS() {
  const ua = navigator.userAgent || "";
  return (
    /iPhone|iPad|iPod/i.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

const SHARE_BASE = "https://pals-downloader.web.app/share?url=";

// En iOS no existe Web Share Target: la única forma de "compartir → abrir la
// app" es un Atajo de Apple que el usuario arma a mano. Este botón le muestra
// el instructivo. Solo aparece en iPhone/iPad.
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
            <h2>Compartir a Pal&apos;s desde iPhone</h2>
            <p className="modal-lede">
              iPhone no deja que la app aparezca sola en el menú Compartir. Se arregla con un
              <b> Atajo de Apple</b> (se hace una sola vez):
            </p>

            <ol className="steps">
              <li>Abrí la app <b>Atajos</b> → tocá <b>+</b> para crear uno nuevo.</li>
              <li>Agregá estas acciones en orden (buscalas por nombre):
                <ol type="a">
                  <li><b>Obtener URLs de la entrada</b></li>
                  <li><b>Codificar URL</b> (que diga «Codificar»)</li>
                  <li><b>Texto</b>: pegá el link de abajo y al final insertá la variable <b>Texto codificado</b></li>
                  <li><b>Abrir URLs</b></li>
                </ol>
              </li>
              <li>Tocá el nombre arriba → <b>Detalles</b> → activá <b>Mostrar en la hoja para compartir</b> (tipos: URLs, Páginas web, Texto).</li>
              <li>Guardá con el nombre <b>«Bajar con Pal&apos;s»</b>.</li>
            </ol>

            <div className="copy-row">
              <code>{SHARE_BASE}</code>
              <button className="btn-sm" onClick={copy}>{copied ? "¡Copiado!" : "Copiar"}</button>
            </div>

            <p className="modal-note">
              Listo: en YouTube/Instagram/etc. tocás <b>Compartir → Bajar con Pal&apos;s</b> y se abre la
              web con el link cargado. (Abre en Safari; la primera vez quizá tengas que loguearte ahí.)
            </p>

            <button className="btn-gel sm modal-close" onClick={() => setOpen(false)}>
              <span>Entendido</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
