#!/usr/bin/env bash
# Setup del backend Pals Downloader en una VM Ubuntu de Oracle Cloud (Always Free).
# Ejecutar DESDE la carpeta deploy/oracle del repo, ya con:
#   - secrets/sa.json  (clave de service account de Firebase)
#   - .env             (copiado de .env.example y completado)
set -euo pipefail

echo "==> 1/5 Comprobando archivos requeridos"
[ -f .env ] || { echo "FALTA .env (copialo de .env.example y completalo)"; exit 1; }
[ -f secrets/sa.json ] || { echo "FALTA secrets/sa.json (clave de Firebase)"; exit 1; }

echo "==> 2/5 Instalando Docker (si falta)"
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sudo sh
  sudo usermod -aG docker "$USER" || true
fi

echo "==> 3/5 Creando swap de 2G (ayuda en VMs chicas de 1GB)"
if [ ! -f /swapfile ]; then
  sudo fallocate -l 2G /swapfile || sudo dd if=/dev/zero of=/swapfile bs=1M count=2048
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
fi

echo "==> 4/5 Abriendo puertos 80 y 443 en el firewall de la VM"
# Oracle Ubuntu trae iptables con un REJECT general. Hay que insertar los ACCEPT
# JUSTO ANTES de ese REJECT, si no quedan después y no sirven.
REJ=$(sudo iptables -L INPUT --line-numbers -n | awk '/REJECT/{print $1; exit}')
REJ=${REJ:-6}
sudo iptables -C INPUT -m state --state NEW -p tcp --dport 80 -j ACCEPT 2>/dev/null || \
  sudo iptables -I INPUT "$REJ" -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -C INPUT -m state --state NEW -p tcp --dport 443 -j ACCEPT 2>/dev/null || \
  sudo iptables -I INPUT "$REJ" -m state --state NEW -p tcp --dport 443 -j ACCEPT
# Persistir
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y iptables-persistent >/dev/null 2>&1 || true
sudo netfilter-persistent save >/dev/null 2>&1 || sudo bash -c 'iptables-save > /etc/iptables/rules.v4' || true

echo "==> 5/5 Levantando los contenedores (build + run)"
sudo docker compose --env-file .env up -d --build

echo ""
echo "✅ Listo. Verificá con:  sudo docker compose logs -f"
echo "   Tu API quedará en:    https://$(grep ^DOMAIN .env | cut -d= -f2)"
echo ""
echo "RECORDÁ: abrir también 80 y 443 en la Security List de la VCN (consola de Oracle)."
