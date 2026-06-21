import { useEffect, useState } from "react";

// Botón propio de instalación de la PWA. Chrome ya casi no muestra el banner
// automático: lo recomendado es capturar `beforeinstallprompt` y ofrecer el
// botón nosotros. Solo aparece en navegadores Chromium (Chrome, Samsung
// Internet, Brave, Edge); Firefox no dispara el evento.
export default function InstallButton() {
  const [deferred, setDeferred] = useState(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    // Si ya está corriendo como app instalada, no mostramos nada.
    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      window.navigator.standalone === true;
    if (standalone) setInstalled(true);

    const onPrompt = (e) => {
      e.preventDefault(); // evita el mini-infobar y nos guardamos el evento
      setDeferred(e);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed || !deferred) return null;

  const install = async () => {
    deferred.prompt();
    try {
      await deferred.userChoice;
    } finally {
      setDeferred(null);
    }
  };

  return (
    <button className="btn install-btn" onClick={install} title="Instalar Pal's en tu teléfono">
      ⬇ Instalar app
    </button>
  );
}
