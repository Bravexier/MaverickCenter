#!/usr/bin/env bash
# Fabrique À LA MAIN un installateur autonome (sans GitHub), comme .github/workflows/livraison.yml après une fusion à partir de la 1.0.
#   ./deploy/installateur/fabriquer.sh prod   installateur du serveur normal → deploy/installateur/sortie/maverick-center-vX.Y-local-install.sh
#   ./deploy/installateur/fabriquer.sh test   installateur du serveur de test, vX.Y.Z-local (bandeau TEST ; copie la base du serveur normal à l'installation)
# Prérequis sur la machine qui construit : Node.js >= 22.12. Sous-chemin (proxy inversé sur /maverick/) : SITE_BASE=/maverick/ …
# « Exporter » de la fiche (feuille Google Sheets) : SITE_GOOGLE_CLIENT_ID=<identifiant client OAuth> ./deploy/installateur/fabriquer.sh prod
# (sans lui, le bouton reste grisé ; deploy/vps/README.md, « Export vers Google Sheets »).
# (Le paquet du NAS d'avant la 1.0 se construit avec ./deploy/build.sh.)
set -euo pipefail

mode="${1:-}"
case "$mode" in prod|test) ;; *) echo "Usage : ./deploy/installateur/fabriquer.sh prod|test" >&2; exit 2 ;; esac

ici="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$ici/../.." && pwd)"
cd "$root/client"
version="$(node -p "require('./package.json').version")"
# Même forme que les livraisons (tools/flux-git/regles.mjs) : vX.Y pour la production, la version complète vX.Y.Z pour le test.
if [ "$mode" = prod ]; then tag="v${version%.*}-local"; else tag="v$version-local"; fi
sha="$(git -C "$root" rev-parse HEAD 2>/dev/null || echo local)"

npm ci
HIDE_EXAMPLES=1 SITE_MODE="$mode" SITE_TAG="$tag" SITE_BASE="${SITE_BASE:-/}" npm run build
node "$ici/fabriquer.mjs" --mode "$mode" --site dist --tag "$tag" --version "$version" --sha "$sha" --sortie "$ici/sortie"
