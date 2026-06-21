"""
Orquestador del mini-backend de YouTube en la PC.

Hace 3 cosas:
  1. Levanta el servidor FastAPI (youtube_server) en localhost.
  2. Abre un tunel HTTPS con cloudflared (URL publica, sin abrir puertos).
  3. Publica un "latido" en Firestore (config/pc_backend) con la URL del tunel,
     para que la web sepa que la PC esta prendida (indicador YouTube ON/OFF).

Se corta con Ctrl+C (o al cerrar la ventana): marca la PC como offline.
"""

import os
import re
import sys
import time
import signal
import threading
import subprocess

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

tunnel_url = None
_stop = threading.Event()


def start_server():
    return subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "youtube_server:app",
         "--host", "127.0.0.1", "--port", str(PORT)],
        cwd=BASE,
        env=os.environ.copy(),
    )


def start_tunnel():
    return subprocess.Popen(
        [CLOUDFLARED, "tunnel", "--url", f"http://127.0.0.1:{PORT}", "--no-autoupdate"],
        stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
        text=True, bufsize=1,
    )


def drain_tunnel_output(proc):
    global tunnel_url
    for line in proc.stdout:
        if tunnel_url is None:
            m = URL_RE.search(line)
            if m:
                tunnel_url = m.group(0)
                print(f"\n  [OK] Tunel listo: {tunnel_url}\n", flush=True)
        if _stop.is_set():
            break


def heartbeat_loop(db):
    ref = db.collection("config").document("pc_backend")
    while not _stop.is_set():
        if tunnel_url:
            try:
                ref.set({
                    "url": tunnel_url,
                    "online": True,
                    "updatedAt": firestore.SERVER_TIMESTAMP,
                })
            except Exception as e:  # noqa: BLE001
                print(f"  [!] heartbeat fallo: {e}", flush=True)
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
    tunnel = start_tunnel()
    threading.Thread(target=drain_tunnel_output, args=(tunnel,), daemon=True).start()

    for _ in range(60):
        if tunnel_url:
            break
        time.sleep(0.5)
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
        for p in (tunnel, server):
            try:
                p.terminate()
            except Exception:  # noqa: BLE001
                pass
        sys.exit(0)

    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)

    while True:
        if server.poll() is not None:
            print("  [!] El servidor se cerro. Saliendo.", flush=True)
            shutdown()
        time.sleep(2)


if __name__ == "__main__":
    main()
