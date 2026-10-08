#!/usr/bin/env bash
# Construit le site à la main (sans GitHub). Prérequis sur la machine qui construit : Node.js >= 22.12.
#
# Avant la 1.0 (fonctionnement actuel) : ./deploy/build.sh
#   version « à montrer » du site (sans les pages d'exemple), empaquetée pour le NAS :
#   deploy/site/ et deploy/maverick-center-nas.zip (site + docker-compose.yml + nginx.conf + README.md + update-nas.sh).
# À partir de la 1.0 : ./deploy/build.sh prod   ou   ./deploy/build.sh test
#   un installateur autonome, comme .github/workflows/livraison.yml après une fusion :
#   deploy/sortie/maverick-center-vX.Y.Z-local-install.sh (ou vX.Y.Z-test-local), à lancer sur le serveur (deploy/README.md).
# Sous-chemin (proxy inversé sur /maverick/) : SITE_BASE=/maverick/ ./deploy/build.sh
set -euo pipefail

mode="${1:-site}"
case "$mode" in site|prod|test) ;; *) echo "Usage : ./deploy/build.sh [prod|test]" >&2; exit 2 ;; esac

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root/client"
npm ci

if [ "$mode" = site ]; then
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
  exit 0
fi

version="$(node -p "require('./package.json').version")"
if [ "$mode" = prod ]; then tag="v$version-local"; else tag="v$version-test-local"; fi
sha="$(git -C "$root" rev-parse HEAD 2>/dev/null || echo local)"
HIDE_EXAMPLES=1 SITE_MODE="$mode" SITE_TAG="$tag" SITE_BASE="${SITE_BASE:-/}" npm run build
node "$root/deploy/fabriquer-installateur.mjs" --mode "$mode" --site dist --tag "$tag" --version "$version" --sha "$sha" --sortie "$root/deploy/sortie"
