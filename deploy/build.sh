#!/usr/bin/env bash
# Construit la version « à montrer » du site (sans les pages d'exemple) et l'empaquette pour le NAS.
# Résultat : deploy/site/ et deploy/maverick-center-nas.zip (site + docker-compose.yml + nginx.conf + README.md).
# Prérequis sur la machine qui construit : Node.js >= 22.12.
# Sous-chemin (proxy inversé sur /maverick/) : SITE_BASE=/maverick/ ./deploy/build.sh
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root/client"
npm ci
HIDE_EXAMPLES=1 SITE_BASE="${SITE_BASE:-/}" npm run build

cd "$root/deploy"
rm -rf site maverick-center-nas.zip maverick-center-nas.tar.gz
cp -r ../client/dist site

files=(site docker-compose.yml nginx.conf README.md update-nas.sh)
if command -v zip >/dev/null 2>&1; then
  zip -qr maverick-center-nas.zip "${files[@]}"
  echo "OK : deploy/maverick-center-nas.zip"
else
  tar czf maverick-center-nas.tar.gz "${files[@]}"
  echo "OK : deploy/maverick-center-nas.tar.gz (zip non installé)"
fi
