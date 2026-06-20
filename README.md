# Pals Downloader

Descargador web de audio/video basado en [yt-dlp](https://github.com/yt-dlp/yt-dlp).
Login con Google, acceso por allowlist controlada desde un panel de administrador,
e historial de descargas (link + nombre) en Firestore.

🌐 **App en producción:** https://pals-downloader.web.app

## Arquitectura

```
Navegador → Firebase Hosting (web React, gratis)
              │ HTTPS + ID token de Firebase Auth
              ▼
        VM Oracle Cloud Always Free ($0, 24/7)
        ┌─────────────────────────────────────┐
        │ Caddy (HTTPS automático, Let's Encrypt)
        │   └─► API FastAPI (yt-dlp + ffmpeg + Deno)
        └─────────────────────────────────────┘
              │ service account key
              ▼
        Firestore (allowlist + historial, gratis)
```

- **Frontend** (`web/`): React + Vite en **Firebase Hosting**.
- **Backend** (`server/`): FastAPI + yt-dlp + ffmpeg + Deno, en **Oracle Cloud (Always Free)** vía Docker.
- **HTTPS**: Caddy con certificado Let's Encrypt automático sobre un dominio `sslip.io`.
- **Auth**: Firebase Auth (Google OAuth). **Datos**: Firestore (`allowed_users`, `downloads`).
- **Costo total: $0/mes** (capa gratuita de Oracle + Firebase).

El backend valida el token de Firebase, comprueba la allowlist, descarga con yt-dlp
y devuelve el archivo al navegador. El admin se siembra solo al arrancar (env `ADMIN_EMAIL`).

## Estructura

```
firebase.json, firestore.rules, .firebaserc   # Config Firebase
web/                # Frontend React + Vite
server/             # Backend: main.py, Dockerfile, requirements.txt
deploy/oracle/      # Despliegue del backend en Oracle (compose, Caddy, setup.sh, GUIDE.md)
```

## Despliegue

### Frontend (Firebase Hosting)
```bash
firebase deploy --only firestore:rules,firestore:indexes   # reglas (una vez)
cd web && npm install && npm run build
firebase deploy --only hosting
```
Configurá `web/.env` con la config de Firebase y `VITE_API_BASE` (URL del backend).

### Backend (Oracle Cloud)
Guía completa paso a paso en [`deploy/oracle/GUIDE.md`](deploy/oracle/GUIDE.md).
Resumen: VM Ubuntu → subir `server/` y `deploy/` + `secrets/sa.json` → `./setup.sh`
(instala Docker, abre firewall, levanta Caddy + API).

Para actualizar el backend:
```bash
scp -r server deploy ubuntu@<IP>:~/pals-downloader/
ssh ubuntu@<IP> "cd ~/pals-downloader/deploy/oracle && sudo docker compose up -d --build"
```

## YouTube

YouTube requiere **cookies** (sortea "Sign in to confirm you're not a bot" por IP de
datacenter) y un **runtime JS** (Deno, ya incluido en el Dockerfile, resuelve el desafío
de firma). Ver [`deploy/oracle/GUIDE.md`](deploy/oracle/GUIDE.md) y la
[wiki EJS de yt-dlp](https://github.com/yt-dlp/yt-dlp/wiki/EJS).
Las cookies (de una cuenta **descartable**) van en `deploy/oracle/secrets/cookies.txt`
y se renuevan cada algunas semanas. Otras plataformas (TikTok, Twitter, Instagram) no
necesitan cookies ni Deno.

## Gestión de usuarios

Entrá a la web como admin → pestaña **Admin** → agregás/quitás emails.

## Secretos (no se versionan)

`*.env`, `*firebase-adminsdk*.json`, `*cookies*.txt` y `deploy/oracle/secrets/*` están
en `.gitignore`. Nunca subas la service account ni las cookies al repo.
