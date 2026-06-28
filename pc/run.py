"""
Orquestador del mini-backend de YouTube en la PC.

Hace 3 cosas:
  1. Levanta el servidor FastAPI (youtube_server) en localhost.
  2. Abre un tunel HTTPS con cloudflared (URL publica, sin abrir puertos).
  3. Publica un "latido" en Firestore (config/pc_backend) con la URL del tunel,
     para que la web sepa que la PC esta prendida (indicador YouTube ON/OFF).

Watchdog: si se cae internet y vuelve, el tunel queda muerto (o cloudflared
reconecta con OTRA URL). Cada 30s chequeamos la salud del tunel publico y, si
no responde, lo reconstruimos solo con una URL nueva y re-publicamos el estado.

Se corta con Ctrl+C (o al cerrar la ventana): marca la PC como offline.
"""

import os
import re
import sys
import time
import signal
import threading
import subprocess
import urllib.request

# La consola de Windows suele ser cp1252; forzamos UTF-8 para no romper.
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

BASE = os.path.dirname(os.path.abspath(__file__))
BIN = os.path.join(BASE, "bin")
PORT = 8765

# ffmpeg / deno / cloudflared se buscan en pc/bin
os.environ["PATH"] = BIN + os.pathsep + os.environ.get("PATH", "")
os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = os.path.join(BASE, "secrets", "sa.json")

import firebase_admin
from firebase_admin import firestore

CLOUDFLARED = os.path.join(BIN, "cloudflared.exe")
URL_RE = re.compile(r"https://[-a-z0-9]+\.trycloudflare\.com")

# Cada cuanto chequear la salud del tunel y cuantas fallas seguidas toleramos
# antes de reconstruirlo.
HEALTH_EVERY = 30      # segundos
HEALTH_FAILS = 3       # fallas seguidas -> reconstruir

tunnel_url = None
tunnel_proc = None
_stop = threading.Event()


def start_server():
    return subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "youtube_server:app",
         "--host", "127.0.0.1", "--port", str(PORT)],
        cwd=BASE,
        env=os.environ.copy(),
    )


def _spawn_tunnel():
    return subprocess.Popen(
        [CLOUDFLARED, "tunnel", "--url", f"http://127.0.0.1:{PORT}", "--no-autoupdate"],
        stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
        text=True, bufsize=1,
    )


def drain_tunnel_output(proc):
    """Lee la salida de cloudflared y captura la URL publica (una sola vez)."""
    global tunnel_url
    for line in proc.stdout:
        if tunnel_url is None:
            m = URL_RE.search(line)
            if m:
                tunnel_url = m.group(0)
                print(f"\n  [OK] Tunel listo: {tunnel_url}\n", flush=True)
        if _stop.is_set():
            break


def launch_tunnel():
    """Arranca cloudflared y espera (hasta ~30s) a que aparezca la URL."""
    global tunnel_url, tunnel_proc
    tunnel_url = None
    tunnel_proc = _spawn_tunnel()
    threading.Thread(target=drain_tunnel_output, args=(tunnel_proc,), daemon=True).start()
    for _ in range(60):
        if tunnel_url or _stop.is_set():
            break
        time.sleep(0.5)
    return tunnel_proc


def tunnel_alive():
    """True si el tunel publico responde el health check."""
    if not tunnel_url:
        return False
    try:
        with urllib.request.urlopen(tunnel_url, timeout=8) as r:
            return r.status == 200
    except Exception:
        return False


def publish_status(db, online):
    try:
        doc = {"online": online, "updatedAt": firestore.SERVER_TIMESTAMP}
        if online and tunnel_url:
            doc["url"] = tunnel_url
        db.collection("config").document("pc_backend").set(doc, merge=True)
    except Exception as e:  # noqa: BLE001
        print(f"  [!] no se pudo publicar estado: {e}", flush=True)


def restart_tunnel(db):
    """Mata el tunel actual y levanta uno nuevo (URL nueva)."""
    global tunnel_proc
    print("\n  [!] Tunel caido. Reconstruyendo...", flush=True)
    publish_status(db, False)
    try:
        if tunnel_proc:
            tunnel_proc.terminate()
    except Exception:  # noqa: BLE001
        pass
    launch_tunnel()
    if tunnel_url:
        print(f"  [OK] Tunel nuevo: {tunnel_url}\n", flush=True)
        publish_status(db, True)
    else:
        print("  [!] Sin URL todavia (red caida?); reintento luego.\n", flush=True)


def heartbeat_loop(db):
    while not _stop.is_set():
        if tunnel_url:
            publish_status(db, True)
        _stop.wait(45)


def main():
    print("=" * 52, flush=True)
    print("  Pal's Downloader - YouTube en tu PC", flush=True)
    print("=" * 52, flush=True)

    if not os.path.exists(CLOUDFLARED):
        print(f"  [X] Falta {CLOUDFLARED}. Corre setup primero.", flush=True)
        sys.exit(1)

    firebase_admin.initialize_app()
    db = firestore.client()

    print("  > Iniciando servidor local...", flush=True)
    server = start_server()

    print("  > Abriendo tunel HTTPS (cloudflared)...", flush=True)
    launch_tunnel()
    if not tunnel_url:
        print("  [!] No se obtuvo la URL del tunel todavia; sigo igual.", flush=True)

    threading.Thread(target=heartbeat_loop, args=(db,), daemon=True).start()

    print("\n  ===> YouTube ACTIVO. Deja esta ventana abierta. <===", flush=True)
    print("       (Cerrala o Ctrl+C para apagar YouTube)\n", flush=True)

    def shutdown(*_):
        print("\n  > Apagando...", flush=True)
        _stop.set()
        try:
            db.collection("config").document("pc_backend").set(
                {"online": False, "updatedAt": firestore.SERVER_TIMESTAMP}, merge=True
            )
        except Exception:  # noqa: BLE001
            pass
        for p in (tunnel_proc, server):
            try:
                if p:
                    p.terminate()
            except Exception:  # noqa: BLE001
                pass
        sys.exit(0)

    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)

    fails = 0
    last_check = time.time()
    while True:
        # 1) El servidor local es critico: si muere, salimos (el .bat reinicia).
        if server.poll() is not None:
            print("  [!] El servidor se cerro. Saliendo.", flush=True)
            shutdown()

        # 2) Si cloudflared murio del todo, reconstruimos ya.
        if tunnel_proc is not None and tunnel_proc.poll() is not None:
            restart_tunnel(db)
            fails = 0
            last_check = time.time()

        # 3) Health check del tunel publico cada HEALTH_EVERY segundos.
        now = time.time()
        if tunnel_url and now - last_check >= HEALTH_EVERY:
            last_check = now
            if tunnel_alive():
                fails = 0
            else:
                fails += 1
                print(f"  [!] El tunel no responde ({fails}/{HEALTH_FAILS})", flush=True)
                if fails >= HEALTH_FAILS:
                    restart_tunnel(db)
                    fails = 0

        time.sleep(2)


if __name__ == "__main__":
    main()
