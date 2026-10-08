#!/usr/bin/env bash
# Fabrique À LA MAIN un installateur du site (sans GitHub) : la même chose que .github/workflows/livraison.yml après une fusion.
#   ./deploy/build.sh          installateur de production   → deploy/sortie/maverick-center-vX.Y.Z-local-install.sh
#   ./deploy/build.sh test     installateur du serveur de test (bandeau TEST, copie de la base de la production à l'installation)
# Prérequis sur la machine qui construit : Node.js >= 22.12. Sous-chemin (proxy inversé sur /maverick/) : SITE_BASE=/maverick/ ./deploy/build.sh
# Puis, sur le serveur : sh maverick-center-…-install.sh --dossier <dossier de l'instance>   (voir deploy/README.md)
set -euo pipefail

mode="${1:-prod}"
case "$mode" in prod|test) ;; *) echo "Usage : ./deploy/build.sh [prod|test]" >&2; exit 2 ;; esac

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root/client"
version="$(node -p "require('./package.json').version")"
if [ "$mode" = prod ]; then tag="v$version-local"; else tag="v$version-test-local"; fi
sha="$(git -C "$root" rev-parse HEAD 2>/dev/null || echo local)"

npm ci
HIDE_EXAMPLES=1 SITE_MODE="$mode" SITE_TAG="$tag" SITE_BASE="${SITE_BASE:-/}" npm run build
node "$root/deploy/fabriquer-installateur.mjs" --mode "$mode" --site dist --tag "$tag" --version "$version" --sha "$sha" --sortie "$root/deploy/sortie"
