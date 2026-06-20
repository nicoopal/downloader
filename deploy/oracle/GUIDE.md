# Despliegue en Oracle Cloud Always Free ($0/mes)

Backend (yt-dlp) en una VM gratuita de Oracle + HTTPS automático con DuckDNS.
La web sigue en Firebase Hosting y Firestore en capa gratis.

Pasos en orden. Los marcados con 🧑 los hacés vos (interactivos); el resto los corre el script.

---

## 1. 🧑 Crear la VM en Oracle Cloud

1. Cuenta en https://www.oracle.com/cloud/free/ (pide tarjeta para verificación; la capa Always Free **no cobra**).
2. Console → **Compute → Instances → Create instance**.
3. Imagen: **Canonical Ubuntu 22.04**.
4. Shape: **Ampere (ARM) VM.Standard.A1.Flex** con 1 OCPU / 6 GB (entra en Always Free).
   - Si dice *"out of capacity"* (común en ARM), probá otra región/AD, o usá **VM.Standard.E2.1.Micro** (AMD, 1 GB — el script crea swap para compensar).
5. **Add SSH keys**: generá un par o subí tu clave pública. Guardá la privada.
6. Create. Anotá la **IP pública**.

### Abrir puertos en la red (Security List)
Console → Networking → **Virtual Cloud Networks** → tu VCN → Subnet → **Security List** →
**Add Ingress Rules** (dos veces):
- Source `0.0.0.0/0`, IP Protocol TCP, Destination Port **80**
- Source `0.0.0.0/0`, IP Protocol TCP, Destination Port **443**

---

## 2. 🧑 Dominio gratis con DuckDNS

1. Entrá a https://www.duckdns.org y logueate (Google/GitHub).
2. Creá un subdominio, ej. `pals-downloader` → te queda `pals-downloader.duckdns.org`.
3. En el campo **current ip**, poné la **IP pública de la VM** y "update ip".

---

## 3. 🧑 Clave de service account de Firebase

1. https://console.firebase.google.com/project/pals-downloader/settings/serviceaccounts/adminsdk
2. **Generate new private key** → descarga un `.json`.
3. Renombralo a `sa.json`. Lo vas a subir a la VM en el paso 5.

> ⚠️ Esta clave da acceso de admin a tu proyecto. No la subas a Git ni la compartas.

---

## 4. 🧑 Habilitar login con Google

https://console.firebase.google.com/project/pals-downloader/authentication/providers
→ Sign-in method → **Google** → Enable → Save.

---

## 5. Subir el código y los secretos a la VM

Desde tu PC (PowerShell), reemplazá IP y ruta de tu clave SSH:

```powershell
# Subir solo lo necesario para el backend:
scp -i C:\ruta\a\tu_clave -r C:\apps\pals-downloader\server ubuntu@TU_IP:~/pals-downloader/server
scp -i C:\ruta\a\tu_clave -r C:\apps\pals-downloader\deploy ubuntu@TU_IP:~/pals-downloader/deploy
# La clave de Firebase:
scp -i C:\ruta\a\tu_clave C:\ruta\a\sa.json ubuntu@TU_IP:~/pals-downloader/deploy/oracle/secrets/sa.json
```

---

## 6. Configurar y arrancar (en la VM)

```bash
ssh -i C:\ruta\a\tu_clave ubuntu@TU_IP

cd ~/pals-downloader/deploy/oracle
cp .env.example .env
nano .env          # poné tu DOMAIN=pals-downloader.duckdns.org y tu email
chmod +x setup.sh
./setup.sh
```

El script instala Docker, crea swap, abre el firewall interno y levanta todo.
Esperá 1-2 min a que Caddy emita el certificado. Verificá:

```bash
sudo docker compose logs -f
curl https://TU_DOMINIO.duckdns.org/      # debe responder {"ok":true,...}
```

---

## 7. Conectar la web al backend

En tu PC, editá `web/.env`:

```
VITE_API_BASE=https://TU_DOMINIO.duckdns.org
```

Y desplegá la web:

```powershell
cd C:\apps\pals-downloader\web
npm run build
firebase deploy --only hosting
```

Tu app queda en https://pals-downloader.web.app 🎉

---

## Actualizar el backend más adelante

```bash
cd ~/pals-downloader && git pull   # o re-scp los archivos
cd deploy/oracle && sudo docker compose up -d --build
```
