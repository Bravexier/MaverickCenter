#!/bin/sh
# Mise à jour automatique du site Maverick Center sur le NAS (deploy/README.md, docs/flux-git.md).
# Deux fonctionnements, selon la version (la 1.0 est le signal du propriétaire) :
#   AVANT LA 1.0 (MODE=site, le fonctionnement actuel) : le site suit la branche « site » du dépôt GitHub privé, reconstruite
#     depuis dev après chaque fusion par .github/workflows/livraison.yml ; le script télécharge cette version et remplace site/.
#   À PARTIR DE LA 1.0 (MODE=prod ou test) : l'instance a été posée par un installateur (fichier VERSION). Le script prend
#     le dernier installateur publié pour son mode (production : vX.Y.Z ; test : vX.Y.Z-test, qui copie la base de la
#     production) et l'exécute s'il n'est pas déjà installé.
# Le mode est celui inscrit dans le fichier VERSION de l'instance ; sans ce fichier (installation d'avant la 1.0), « site ».
#
# Le NAS ne fait que des connexions SORTANTES : aucun port à ouvrir.
# Prérequis : sh, curl, tar (gzip à partir de la 1.0 ; rsync est utilisé s'il est présent). Pas de Node, pas de Docker requis pour ce script.
# Jeton GitHub : fichier .github-token à côté du script (droits 600). Jeton « fine-grained » limité à CE dépôt,
# permission « Contents : Read-only ». Il n'apparaît jamais dans la ligne de commande de curl (donc pas dans `ps`).
#
# Usage : sh update-nas.sh [--force]     (--force réinstalle même si la version installée est déjà la dernière)
# Planification toutes les 5 minutes :
#   Synology : Panneau de configuration > Planificateur de tâches > Script défini par l'utilisateur, exécuté en root
#   Autres   : crontab -e  puis  */5 * * * * sh /chemin/vers/update-nas.sh
# Réglages facultatifs : fichier update-nas.env à côté du script. Communs : MODE, REPO, BASE_DIR, TOKEN_FILE, LOG_FILE.
#   Avant la 1.0 : BRANCH, SITE_DIR, MIN_PAGES, USE_RSYNC.   Serveur de test : DOSSIER_PROD (production dont il copie la base,
#   défaut : le dossier voisin « maverick-center »).
# Aucun redémarrage de nginx n'est nécessaire : les fichiers statiques sont relus à chaque requête.
set -eu
umask 022

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
# shellcheck disable=SC1091
if [ -f "$SCRIPT_DIR/update-nas.env" ]; then . "$SCRIPT_DIR/update-nas.env"; fi

REPO=${REPO:-Bravexier/MaverickCenter}
GITHUB_API=${GITHUB_API:-https://api.github.com}
BASE_DIR=${BASE_DIR:-$SCRIPT_DIR}
# Mode : celui de l'instance (fichier VERSION, posé par un installateur à partir de la 1.0), sinon « site » (avant la 1.0).
if [ -z "${MODE:-}" ]; then MODE=$(sed -n 's/^mode=//p' "$BASE_DIR/VERSION" 2>/dev/null | head -n 1); fi
MODE=${MODE:-site}
BRANCH=${BRANCH:-site}
SITE_DIR=${SITE_DIR:-$BASE_DIR/site}
TOKEN_FILE=${TOKEN_FILE:-$BASE_DIR/.github-token}
STATE_FILE=${STATE_FILE:-$BASE_DIR/.installed-sha}
LOG_FILE=${LOG_FILE:-$BASE_DIR/update.log}
LOCK_DIR=${LOCK_DIR:-$BASE_DIR/.update.lock}
MIN_PAGES=${MIN_PAGES:-20}      # avant la 1.0 : une archive avec moins de pages est refusée, le site en place n'est alors pas touché
USE_RSYNC=${USE_RSYNC:-auto}
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
  line="$(date '+%Y-%m-%d %H:%M:%S') $*"
  echo "$line"
  echo "$line" >> "$LOG_FILE" 2>/dev/null || true
}
die() { log "ERREUR : $*"; exit 1; }

case "$MODE" in site|prod|test) ;; *) die "MODE doit valoir site, prod ou test (reçu « $MODE »)" ;; esac

if [ "$MODE" = site ]; then
  # Garde-fous sur les chemins : la copie de secours supprime le contenu de SITE_DIR
  case "$SITE_DIR" in /?*) ;; *) die "SITE_DIR doit être un chemin absolu (reçu « $SITE_DIR »)" ;; esac
  if [ "$(basename "$SITE_DIR")" != "site" ] && [ "${SITE_DIR_UNSAFE_OK:-0}" != "1" ]; then
    die "SITE_DIR doit se terminer par « /site » (reçu : « $SITE_DIR ») : refus par prudence"
  fi
else
  case "$BASE_DIR" in /?*) ;; *) die "BASE_DIR doit être un chemin absolu (reçu « $BASE_DIR »)" ;; esac
fi

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

if [ "$MODE" = site ]; then
# ================================================================ AVANT LA 1.0 : la branche « site » (fonctionnement inchangé)
REMOTE_SHA=$(gh_curl -H 'Accept: application/vnd.github.sha' "$GITHUB_API/repos/$REPO/commits/$BRANCH") ||
  die "impossible de lire la dernière version de la branche « $BRANCH » de $REPO (jeton invalide ou expiré, branche pas encore créée, réseau ?)"
case "$REMOTE_SHA" in
  ""|*[!0-9a-f]*) die "réponse inattendue de GitHub pour la version de la branche « $BRANCH »" ;;
esac
[ "${#REMOTE_SHA}" -eq 40 ] || die "réponse inattendue de GitHub pour la version de la branche « $BRANCH »"

INSTALLED=$(cat "$STATE_FILE" 2>/dev/null || true)
if [ "$FORCE" -eq 0 ] && [ "$INSTALLED" = "$REMOTE_SHA" ] && [ -f "$SITE_DIR/index.html" ]; then
  log "À jour (version $(echo "$REMOTE_SHA" | cut -c1-7))."
  exit 0
fi

log "Nouvelle version $(echo "$REMOTE_SHA" | cut -c1-7) : téléchargement."
# On télécharge la version précise (SHA), pas la branche : l'archive correspond exactement à ce qu'on vient de lire
gh_curl -H 'Accept: application/vnd.github+json' -o "$TMP/site.tar.gz" "$GITHUB_API/repos/$REPO/tarball/$REMOTE_SHA" ||
  die "téléchargement de l'archive impossible"

mkdir "$TMP/extract"
tar -xzf "$TMP/site.tar.gz" -C "$TMP/extract" || die "archive illisible"
# L'archive GitHub contient un unique dossier racine « <propriétaire>-<dépôt>-<sha> »
[ "$(ls -1 "$TMP/extract" | wc -l)" -eq 1 ] || die "archive inattendue (dossier racine unique attendu)"
STAGE="$TMP/extract/$(ls -1 "$TMP/extract")"

[ -f "$STAGE/index.html" ] || die "archive refusée : pas de index.html (le site en place n'a pas été modifié)"
PAGES=$(find "$STAGE" -name index.html | wc -l | tr -d ' ')
[ "$PAGES" -ge "$MIN_PAGES" ] || die "archive refusée : $PAGES page(s) seulement, $MIN_PAGES attendues (le site en place n'a pas été modifié)"

mkdir -p "$SITE_DIR"
if [ "$USE_RSYNC" != "0" ] && command -v rsync >/dev/null 2>&1; then
  # --checksum : comparaison par contenu. Par défaut rsync saute un fichier de même taille et même date, ce qui ignorerait
  # une page modifiée dont la longueur n'a pas changé (les dates de l'archive GitHub sont celles du commit).
  rsync -a --delete --checksum "$STAGE/" "$SITE_DIR/" || die "synchronisation (rsync) impossible"
else
  # Copie de secours : on conserve le dossier lui-même (nginx le monte tel quel) et on remplace son contenu
  rm -rf "$SITE_DIR"/*
  cp -a "$STAGE/." "$SITE_DIR/" || die "copie impossible"
fi

echo "$REMOTE_SHA" > "$STATE_FILE"
log "Installé : version $(echo "$REMOTE_SHA" | cut -c1-7), $PAGES pages."
exit 0
fi

# ================================================================ À PARTIR DE LA 1.0 : les livraisons (installateurs)
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
