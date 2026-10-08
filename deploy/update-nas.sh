#!/bin/sh
# Mise à jour automatique d'une instance Maverick Center (production ou test) depuis les livraisons GitHub du dépôt privé.
# Chaque fusion dans master publie un installateur de production (vX.Y.Z), chaque fusion dans dev un installateur de test
# (vX.Y.Z-test) : voir docs/flux-git.md. Ce script prend le plus récent pour son mode et l'exécute s'il n'est pas déjà installé.
#
# Le NAS ne fait que des connexions SORTANTES : aucun port à ouvrir.
# Prérequis : sh, curl, tar, gzip. Pas de Node, pas de Docker requis pour ce script.
# Jeton GitHub : fichier .github-token à côté du script (droits 600). Jeton « fine-grained » limité à CE dépôt,
# permission « Contents : Read-only ». Il n'apparaît jamais dans la ligne de commande de curl (donc pas dans `ps`).
#
# Usage : sh update-nas.sh [--force]     (--force réinstalle même si la livraison est déjà installée)
# Réglages : fichier update-nas.env à côté du script, par exemple pour le serveur de test :
#   MODE=test
#   DOSSIER_PROD=/volume1/docker/maverick-center     (instance de production dont le test copie la base ; défaut : le voisin maverick-center)
# Autres réglages : REPO, GITHUB_API, BASE_DIR (dossier de l'instance, défaut : celui du script), TOKEN_FILE, LOG_FILE.
# Planification toutes les 5 minutes :
#   Synology : Panneau de configuration > Planificateur de tâches > Script défini par l'utilisateur, exécuté en root
#   Autres   : crontab -e  puis  */5 * * * * sh /chemin/vers/update-nas.sh
set -eu
umask 022

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
# shellcheck disable=SC1091
if [ -f "$SCRIPT_DIR/update-nas.env" ]; then . "$SCRIPT_DIR/update-nas.env"; fi

MODE=${MODE:-prod}
REPO=${REPO:-Bravexier/MaverickCenter}
GITHUB_API=${GITHUB_API:-https://api.github.com}
BASE_DIR=${BASE_DIR:-$SCRIPT_DIR}
TOKEN_FILE=${TOKEN_FILE:-$BASE_DIR/.github-token}
LOG_FILE=${LOG_FILE:-$BASE_DIR/update.log}
LOCK_DIR=${LOCK_DIR:-$BASE_DIR/.update.lock}
DOSSIER_PROD=${DOSSIER_PROD:-}

FORCE=0
case "${1:-}" in
  "") ;;
  --force) FORCE=1 ;;
  *) echo "Usage : sh update-nas.sh [--force]" >&2; exit 2 ;;
esac

# Rotation simple du journal (garde les 500 dernières lignes au-delà de 200 Ko)
if [ -f "$LOG_FILE" ] && [ "$(wc -c < "$LOG_FILE")" -gt 200000 ]; then
  tail -n 500 "$LOG_FILE" > "$LOG_FILE.tmp" && mv "$LOG_FILE.tmp" "$LOG_FILE"
fi

log() {
  line="$(date '+%Y-%m-%d %H:%M:%S') [$MODE] $*"
  echo "$line"
  echo "$line" >> "$LOG_FILE" 2>/dev/null || true
}
die() { log "ERREUR : $*"; exit 1; }

case "$MODE" in prod|test) ;; *) die "MODE doit valoir prod ou test (reçu « $MODE »)" ;; esac
case "$BASE_DIR" in /?*) ;; *) die "BASE_DIR doit être un chemin absolu (reçu « $BASE_DIR »)" ;; esac

[ -r "$TOKEN_FILE" ] || die "jeton GitHub introuvable ou illisible : $TOKEN_FILE"
TOKEN=$(tr -d ' \r\n\t' < "$TOKEN_FILE")
case "$TOKEN" in
  ""|*[!A-Za-z0-9_-]*) die "le fichier $TOKEN_FILE ne contient pas un jeton GitHub valide" ;;
esac

# Un seul exemplaire à la fois ; un verrou laissé par un processus mort est nettoyé
if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  OLD_PID=$(cat "$LOCK_DIR/pid" 2>/dev/null || true)
  if [ -n "$OLD_PID" ] && kill -0 "$OLD_PID" 2>/dev/null; then
    log "Une mise à jour est déjà en cours (PID $OLD_PID) : rien à faire."
    exit 0
  fi
  log "Verrou périmé détecté : nettoyage."
  rm -rf "$LOCK_DIR"
  mkdir "$LOCK_DIR" || die "impossible de créer le verrou $LOCK_DIR"
fi
echo "$$" > "$LOCK_DIR/pid"

TMP=$(mktemp -d "${TMPDIR:-/tmp}/maverick-update.XXXXXX") || die "impossible de créer un dossier temporaire"
cleanup() { rm -rf "$TMP" "$LOCK_DIR"; }
trap cleanup EXIT
trap 'exit 1' INT TERM HUP

# curl authentifié : le jeton est passé par l'entrée standard (-K -), pas en argument
gh_curl() {
  printf 'header = "Authorization: Bearer %s"\n' "$TOKEN" |
    curl -sS -f -L --retry 2 --connect-timeout 15 --max-time 600 -K - -H 'X-GitHub-Api-Version: 2022-11-28' "$@"
}
# Champs d'une réponse JSON de GitHub (compacte ou indentée), sans jq : une valeur texte par ligne.
champ() { grep -o "\"$1\": *\"[^\"]*\"" | sed 's/^.*: *"//; s/"$//'; }

# Production : la dernière livraison publiée (« latest ») ; test : la plus récente dont l'étiquette porte « -test ».
if [ "$MODE" = prod ]; then
  gh_curl -H 'Accept: application/vnd.github+json' -o "$TMP/livraison.json" "$GITHUB_API/repos/$REPO/releases/latest" ||
    die "impossible de lire la dernière livraison de production de $REPO (jeton invalide ou expiré, aucune livraison encore publiée, réseau ?)"
else
  gh_curl -H 'Accept: application/vnd.github+json' -o "$TMP/liste.json" "$GITHUB_API/repos/$REPO/releases?per_page=30" ||
    die "impossible de lire les livraisons de $REPO (jeton invalide ou expiré, réseau ?)"
  TAG_TEST=$(champ tag_name < "$TMP/liste.json" | grep -- '-test' | head -n 1 || true)
  [ -n "$TAG_TEST" ] || die "aucune livraison de test publiée pour l'instant"
  gh_curl -H 'Accept: application/vnd.github+json' -o "$TMP/livraison.json" "$GITHUB_API/repos/$REPO/releases/tags/$TAG_TEST" ||
    die "impossible de lire la livraison $TAG_TEST"
fi
TAG=$(champ tag_name < "$TMP/livraison.json" | head -n 1)
case "$TAG" in
  v[0-9]*) ;;
  *) die "réponse inattendue de GitHub (étiquette « $TAG »)" ;;
esac
case "$TAG" in
  *-test*) [ "$MODE" = test ] || die "la livraison $TAG est une livraison de test, pas de production" ;;
  *) [ "$MODE" = prod ] || die "la livraison $TAG n'est pas une livraison de test" ;;
esac

INSTALLE=$(sed -n 's/^tag=//p' "$BASE_DIR/VERSION" 2>/dev/null | head -n 1 || true)
if [ "$FORCE" -eq 0 ] && [ "$INSTALLE" = "$TAG" ] && [ -f "$BASE_DIR/site/index.html" ]; then
  log "À jour ($TAG)."
  exit 0
fi

# Une livraison ne porte qu'un fichier joint : son installateur. On le télécharge par l'API (dépôt privé).
ASSET=$(grep -o '"url": *"[^"]*/releases/assets/[0-9]*"' "$TMP/livraison.json" | head -n 1 | sed 's/^.*: *"//; s/"$//')
[ -n "$ASSET" ] || die "la livraison $TAG n'a pas encore d'installateur joint (construction en cours ?)"
log "Nouvelle livraison $TAG (installée : ${INSTALLE:-aucune}) : téléchargement."
gh_curl -H 'Accept: application/octet-stream' -o "$TMP/installateur.sh" "$ASSET" || die "téléchargement de l'installateur $TAG impossible"
sh "$TMP/installateur.sh" --verifier >/dev/null 2>&1 || die "installateur $TAG refusé (archive corrompue ou incomplète) : rien n'a été modifié"

set -- --dossier "$BASE_DIR"
if [ "$MODE" = test ] && [ -n "$DOSSIER_PROD" ]; then set -- "$@" --dossier-prod "$DOSSIER_PROD"; fi
if sh "$TMP/installateur.sh" "$@" >> "$LOG_FILE" 2>&1; then
  log "Installé : $TAG."
else
  die "l'installateur $TAG a échoué (détail ci-dessus dans $LOG_FILE)"
fi
