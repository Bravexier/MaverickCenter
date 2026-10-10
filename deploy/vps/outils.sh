#!/usr/bin/env bash
# Installe ce qu'il faut pour héberger Maverick Center : Docker (+ compose) et Caddy (HTTPS automatique), depuis les paquets de la distribution.
# À lancer en root, après durcir.sh :   sudo bash outils.sh
# Sûr à relancer.
set -euo pipefail

[ "$(id -u)" -eq 0 ] || { echo "À lancer en root : sudo bash $0" >&2; exit 1; }
command -v apt-get >/dev/null 2>&1 || { echo "Ubuntu ou Debian attendu (apt-get introuvable)." >&2; exit 1; }
export DEBIAN_FRONTEND=noninteractive

apt-get update -y
apt-get install -y docker.io docker-compose-v2 caddy
systemctl enable --now docker

# robots.txt servi par Caddy sur les deux adresses (en plus de l'en-tête X-Robots-Tag) : rien ne doit être indexé.
mkdir -p /srv/maverick-racine
printf 'User-agent: *\nDisallow: /\n' > /srv/maverick-racine/robots.txt

docker --version
docker compose version
caddy version
echo
echo "Terminé. Étape suivante : sudo bash instances.sh"
