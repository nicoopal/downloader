"""
Pals Downloader - Backend (Cloud Run)

Servicio que:
  - Valida el ID token de Firebase Auth.
  - Comprueba que el usuario esté en la allowlist de Firestore.
  - Usa yt-dlp (+ ffmpeg) para descargar audio/video.
  - Devuelve el archivo al navegador (streaming) y borra el temporal.
  - Registra en Firestore solo el link y el nombre del video.
"""

import os
import re
import glob
import tempfile
import shutil
import logging

from fastapi import FastAPI, Depends, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from starlette.background import BackgroundTask
from pydantic import BaseModel

import firebase_admin
from firebase_admin import auth as fb_auth, firestore

import yt_dlp

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("pals-downloader")

# --- Config ---------------------------------------------------------------

ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "nico.palermo@gmail.com").lower()

# Orígenes permitidos para CORS (la web en Firebase Hosting).
ALLOWED_ORIGINS = [
    o.strip()
    for o in os.environ.get(
        "ALLOWED_ORIGINS",
        "https://pals-downloader.web.app,https://pals-downloader.firebaseapp.com,"
        "https://ieeworld.web.app,https://ieeworld.firebaseapp.com,http://localhost:5173",
    ).split(",")
    if o.strip()
]

# Cookies para sortear el "confirm you're not a bot" de YouTube.
# Se montan read-only; las copiamos a una ruta escribible porque yt-dlp
# reescribe el archivo de cookies al cerrar (refresca la sesión).
COOKIES_SRC = os.environ.get("COOKIES_FILE", "/secrets/cookies.txt")
COOKIES_WORK = "/tmp/cookies.txt"

# Tope de tamaño para evitar sorpresas de egress/memoria (en MB). 0 = sin tope.
MAX_FILESIZE_MB = int(os.environ.get("MAX_FILESIZE_MB", "0"))

# --- Firebase Admin -------------------------------------------------------

firebase_admin.initialize_app()
db = firestore.client()


def ensure_admin_seeded():
    """Crea el doc del admin en allowed_users si no existe (bootstrap)."""
    try:
        ref = db.collection("allowed_users").document(ADMIN_EMAIL)
        if not ref.get().exists:
            ref.set(
                {
                    "email": ADMIN_EMAIL,
                    "isAdmin": True,
                    "addedBy": "system",
                    "addedAt": firestore.SERVER_TIMESTAMP,
                }
            )
            log.info("Admin sembrado: %s", ADMIN_EMAIL)
    except Exception as e:  # noqa: BLE001
        log.warning("No se pudo sembrar el admin: %s", e)


# --- App ------------------------------------------------------------------

app = FastAPI(title="Pals Downloader")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
    # Necesario para que el navegador pueda leer el nombre real del archivo.
    expose_headers=["Content-Disposition"],
)


def prepare_cookies():
    """Copia las cookies montadas (ro) a una ruta escribible para yt-dlp."""
    try:
        if os.path.exists(COOKIES_SRC):
            shutil.copyfile(COOKIES_SRC, COOKIES_WORK)
            log.info("Cookies preparadas en %s", COOKIES_WORK)
    except Exception as e:  # noqa: BLE001
        log.warning("No se pudieron preparar las cookies: %s", e)


@app.on_event("startup")
def _startup():
    ensure_admin_seeded()
    prepare_cookies()


# --- Auth -----------------------------------------------------------------

class User(BaseModel):
    uid: str
    email: str
    is_admin: bool


def get_current_user(authorization: str = Header(default="")) -> User:
    """Valida el ID token y que el usuario esté habilitado."""
    if not authorization.startswith("Bearer "):
        raise HTTPException(401, "Falta el token de autenticación")
    token = authorization.split(" ", 1)[1]
    try:
        decoded = fb_auth.verify_id_token(token)
    except Exception:  # noqa: BLE001
        raise HTTPException(401, "Token inválido")

    email = (decoded.get("email") or "").lower()
    if not email:
        raise HTTPException(403, "La cuenta no tiene email")

    doc = db.collection("allowed_users").document(email).get()
    if not doc.exists:
        raise HTTPException(403, "No tenés acceso. Pedile al administrador que te habilite.")

    data = doc.to_dict() or {}
    return User(uid=decoded["uid"], email=email, is_admin=bool(data.get("isAdmin")))


# --- yt-dlp helpers -------------------------------------------------------

def _base_opts() -> dict:
    opts = {
        "quiet": True,
        "no_warnings": True,
        "noplaylist": True,
        "restrictfilenames": True,
    }
    if os.path.exists(COOKIES_WORK):
        opts["cookiefile"] = COOKIES_WORK
    return opts


class InfoRequest(BaseModel):
    url: str


class DownloadRequest(BaseModel):
    url: str
    mode: str = "video"          # "video" | "audio"
    quality: str | None = None   # "720", "1080", "best" (solo video)


@app.get("/")
def health():
    return {"ok": True, "service": "pals-downloader"}


@app.post("/api/info")
def info(req: InfoRequest, user: User = Depends(get_current_user)):
    """Devuelve metadata (título, miniatura, duración) sin descargar."""
    try:
        with yt_dlp.YoutubeDL(_base_opts()) as ydl:
            data = ydl.extract_info(req.url, download=False)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(400, f"No se pudo leer el link: {e}")

    return {
        "title": data.get("title"),
        "uploader": data.get("uploader") or data.get("channel"),
        "duration": data.get("duration"),
        "thumbnail": data.get("thumbnail"),
        "extractor": data.get("extractor_key"),
        "webpage_url": data.get("webpage_url", req.url),
    }


@app.post("/api/download")
def download(req: DownloadRequest, user: User = Depends(get_current_user)):
    tmpdir = tempfile.mkdtemp(prefix="dl_")
    opts = _base_opts()
    opts["outtmpl"] = os.path.join(tmpdir, "%(title).200s.%(ext)s")

    if MAX_FILESIZE_MB > 0:
        opts["max_filesize"] = MAX_FILESIZE_MB * 1024 * 1024

    if req.mode == "audio":
        opts["format"] = "bestaudio/best"
        opts["postprocessors"] = [
            {
                "key": "FFmpegExtractAudio",
                "preferredcodec": "mp3",
                "preferredquality": "192",
            }
        ]
    else:
        q = (req.quality or "best").lower()
        if q.isdigit():
            opts["format"] = f"bv*[height<={q}]+ba/b[height<={q}]"
        else:
            opts["format"] = "bv*+ba/b"
        opts["merge_output_format"] = "mp4"

    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            data = ydl.extract_info(req.url, download=True)
    except Exception as e:  # noqa: BLE001
        shutil.rmtree(tmpdir, ignore_errors=True)
        raise HTTPException(400, f"Falló la descarga: {e}")

    files = [f for f in glob.glob(os.path.join(tmpdir, "*")) if os.path.isfile(f)]
    if not files:
        shutil.rmtree(tmpdir, ignore_errors=True)
        raise HTTPException(500, "No se generó ningún archivo")

    filepath = max(files, key=os.path.getsize)
    filename = os.path.basename(filepath)

    # Registrar SOLO link + nombre (+ quién y cuándo) en Firestore.
    try:
        db.collection("downloads").add(
            {
                "url": data.get("webpage_url", req.url),
                "title": data.get("title"),
                "mode": req.mode,
                "userEmail": user.email,
                "uid": user.uid,
                "createdAt": firestore.SERVER_TIMESTAMP,
            }
        )
    except Exception as e:  # noqa: BLE001
        log.warning("No se pudo registrar la descarga: %s", e)

    cleanup = BackgroundTask(shutil.rmtree, tmpdir, ignore_errors=True)
    return FileResponse(
        filepath,
        filename=_safe_ascii(filename),
        media_type="application/octet-stream",
        background=cleanup,
    )


def _safe_ascii(name: str) -> str:
    """Nombre de archivo seguro para el header Content-Disposition."""
    return re.sub(r"[^\w.\- ]", "_", name) or "download"


@app.exception_handler(HTTPException)
def http_exc_handler(_, exc: HTTPException):
    return JSONResponse(status_code=exc.status_code, content={"error": exc.detail})
