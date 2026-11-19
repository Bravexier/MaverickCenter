#!/bin/sh
# Mise à jour automatique d'une instance posée par un installateur (docs/flux-git.md et README.md à côté).
# Chaque fusion dans master publie un installateur du serveur normal (VX.Y, puis VX.Y-hotfix.N), chaque fusion dans dev un
# installateur du serveur de test (VX.Y.Z, la version de dev). Ce script prend le plus récent pour le mode de l'instance (lu dans son fichier
# VERSION) et l'exécute s'il n'est pas déjà installé. Aucune installation ne touche à db/ (la base de l'instance, celle du serveur de test
# comprise). Le serveur de test refuse une livraison plus ancienne que celle installée (--force pour un retour en arrière voulu).
# (Le paquet du NAS a la sienne : deploy/update-site.sh, qui suit la branche « site », que la livraison ne reconstruit plus.)
#
# Connexions SORTANTES uniquement : aucun port à ouvrir.
# Prérequis : sh, curl, tar, gzip. Pas de Node, pas de Docker requis pour ce script.
# Jeton GitHub : fichier .github-token dans le dossier de l'instance (droits 600). Jeton « fine-grained » limité à CE dépôt,
# permission « Contents : Read-only ». Il n'apparaît jamais dans la ligne de commande de curl (donc pas dans `ps`).
#
# Usage : sh mise-a-jour.sh [--force]     (--force réinstalle même si la livraison est déjà installée, ou plus ancienne que celle installée : test)
# Planification toutes les 5 minutes, une par instance, par exemple : */5 * * * * sh /srv/maverick-center/mise-a-jour.sh
# Réglages facultatifs : fichier mise-a-jour.env à côté du script. MODE (prod ou test ; défaut : celui de VERSION), REPO, GITHUB_API,
#   BASE_DIR (dossier de l'instance ; défaut : celui du script), TOKEN_FILE, LOG_FILE.
# Suspendre les mises à jour (retour à une version précédente, intervention) : créer un fichier GELER dans le dossier de l'instance
#   (ou GELER=1 dans mise-a-jour.env) ; le supprimer pour reprendre.
set -eu
umask 022

# Tout le script est dans une fonction appelée à la dernière ligne : le shell lit le fichier en entier avant d'exécuter quoi que ce
# soit, même si l'installateur qu'il lance remplace ce fichier entre-temps.
principal() {

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
# shellcheck disable=SC1091
if [ -f "$SCRIPT_DIR/mise-a-jour.env" ]; then . "$SCRIPT_DIR/mise-a-jour.env"; fi

REPO=${REPO:-Bravexier/MaverickCenter}
GITHUB_API=${GITHUB_API:-https://api.github.com}
BASE_DIR=${BASE_DIR:-$SCRIPT_DIR}
if [ -z "${MODE:-}" ]; then MODE=$(sed -n 's/^mode=//p' "$BASE_DIR/VERSION" 2>/dev/null | head -n 1); fi
TOKEN_FILE=${TOKEN_FILE:-$BASE_DIR/.github-token}
LOG_FILE=${LOG_FILE:-$BASE_DIR/mise-a-jour.log}
LOCK_DIR=${LOCK_DIR:-$BASE_DIR/.mise-a-jour.lock}

FORCE=0
case "${1:-}" in
  "") ;;
  --force) FORCE=1 ;;
  *) echo "Usage : sh mise-a-jour.sh [--force]" >&2; exit 2 ;;
esac

# Rotation simple du journal (garde les 500 dernières lignes au-delà de 200 Ko)
if [ -f "$LOG_FILE" ] && [ "$(wc -c < "$LOG_FILE")" -gt 200000 ]; then
  tail -n 500 "$LOG_FILE" > "$LOG_FILE.tmp" && mv "$LOG_FILE.tmp" "$LOG_FILE"
fi

log() {
  line="$(date '+%Y-%m-%d %H:%M:%S') [${MODE:-?}] $*"
  echo "$line"
  echo "$line" >> "$LOG_FILE" 2>/dev/null || true
}
die() { log "ERREUR : $*"; exit 1; }

case "$BASE_DIR" in /?*) ;; *) die "BASE_DIR doit être un chemin absolu (reçu « $BASE_DIR »)" ;; esac
case "$MODE" in
  prod|test) ;;
  "") die "mode inconnu : $BASE_DIR/VERSION absent (ce dossier n'a pas été posé par un installateur) ; MODE=prod ou MODE=test pour forcer" ;;
  *) die "MODE doit valoir prod ou test (reçu « $MODE »)" ;;
esac
if [ -e "$BASE_DIR/GELER" ] || [ "${GELER:-0}" = 1 ]; then
  log "Mises à jour suspendues (GELER) : rien à faire."
  exit 0
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

TMP=$(mktemp -d "${TMPDIR:-/tmp}/maverick-mise-a-jour.XXXXXX") || die "impossible de créer un dossier temporaire"
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

# Forme des étiquettes de livraison (tools/flux-git/regles.mjs) : la version complète de dev, VX.Y.Z (puis VX.Y.Z-rebuild.N), pour le
# serveur de test ; VX.Y (puis VX.Y-hotfix.N) pour la production.
FORME_TEST='^[vV][0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?$'
FORME_PROD='^[vV][0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?$'
# L'étiquette de version la plus haute parmi celles lues sur l'entrée (une par ligne). L'ordre de la liste de GitHub n'est pas celui des
# versions (V0.3.99 avant V0.3.100) : on compare X, Y, Z puis le numéro final de la régénération (VX.Y.Z-rebuild.N ; sans suffixe : 0).
AWK_CLE='function cle(t,  s, p) { s = t; sub(/^[vV]/, "", s); split(s, p, /[^0-9]+/); kx = p[1] + 0; ky = p[2] + 0; kz = p[3] + 0; kw = p[4] + 0 }'
la_plus_haute() {
  awk "$AWK_CLE"'{
    cle($0); x = kx; y = ky; z = kz; w = kw
    if (!ok || x > bx || (x == bx && (y > by || (y == by && (z > bz || (z == bz && w > bw)))))) {
      ok = 1; best = $0; bx = x; by = y; bz = z; bw = w
    }
  } END { if (ok) print best }'
}
# Écrit « plus_ancienne », « egale » ou « plus_recente » : la première étiquette par rapport à la seconde (même clé que la_plus_haute).
comparer() {
  awk -v a="$1" -v b="$2" "$AWK_CLE"'BEGIN {
    cle(a); ax = kx; ay = ky; az = kz; aw = kw
    cle(b)
    if (ax != kx) r = ax < kx; else if (ay != ky) r = ay < ky; else if (az != kz) r = az < kz; else if (aw != kw) r = aw < kw; else { print "egale"; exit }
    print (r ? "plus_ancienne" : "plus_recente")
  }'
}
mode_de_etiquette() {
  if printf '%s\n' "$1" | grep -Eq "$FORME_TEST"; then echo test
  elif printf '%s\n' "$1" | grep -Eq "$FORME_PROD"; then echo prod
  fi
}

# Production : la dernière livraison publiée (« latest ») ; test : la plus récente dont l'étiquette porte la version complète (VX.Y.Z).
if [ "$MODE" = prod ]; then
  gh_curl -H 'Accept: application/vnd.github+json' -o "$TMP/livraison.json" "$GITHUB_API/repos/$REPO/releases/latest" ||
    die "impossible de lire la dernière livraison de production de $REPO (jeton invalide ou expiré, aucune livraison encore publiée, réseau ?)"
else
  gh_curl -H 'Accept: application/vnd.github+json' -o "$TMP/liste.json" "$GITHUB_API/repos/$REPO/releases?per_page=30" ||
    die "impossible de lire les livraisons de $REPO (jeton invalide ou expiré, réseau ?)"
  TAG_TEST=$(champ tag_name < "$TMP/liste.json" | grep -E "$FORME_TEST" | la_plus_haute || true)
  [ -n "$TAG_TEST" ] || die "aucune livraison de test publiée pour l'instant"
  gh_curl -H 'Accept: application/vnd.github+json' -o "$TMP/livraison.json" "$GITHUB_API/repos/$REPO/releases/tags/$TAG_TEST" ||
    die "impossible de lire la livraison $TAG_TEST"
fi
TAG=$(champ tag_name < "$TMP/livraison.json" | head -n 1)
case "$(mode_de_etiquette "$TAG")" in
  "$MODE") ;;
  test) die "la livraison $TAG est une livraison de test, pas de production" ;;
  prod) die "la livraison $TAG n'est pas une livraison de test" ;;
  *) die "réponse inattendue de GitHub (étiquette « $TAG »)" ;;
esac

# Les trois derniers installateurs installés sont gardés dans installateur-courant/ (garde-fou 19 de la bascule 2 : de quoi revenir de plusieurs versions en
# arrière, hors de GitHub) : l'envoi chiffré de nuit des sauvegardes automatiques les joint à la copie extérieure (deploy/vps/README.md, « Sauvegardes »), de quoi
# remonter un site à partir de rien. Le plus récent (par date de pose) d'abord ; au-delà de INSTALLATEURS_GARDES, les plus anciens sont retirés. Place : ~97 Mo
# par installateur de test (kit compris), ~35 Mo par installateur de production.
INSTALLATEURS_GARDES=${INSTALLATEURS_GARDES:-3}
case "$INSTALLATEURS_GARDES" in ""|*[!0-9]*|0) INSTALLATEURS_GARDES=3 ;; esac
GARDE_DIR="$BASE_DIR/installateur-courant"
GARDE="$GARDE_DIR/maverick-center-$TAG-install.sh"
garder_installateur() {
  mkdir -p "$GARDE_DIR" || return 0
  if cp "$1" "$GARDE_DIR/.nouveau.$$" 2>/dev/null && mv -f "$GARDE_DIR/.nouveau.$$" "$GARDE"; then
    # l'installateur qui vient d'être posé n'est jamais retiré ; parmi les autres, les INSTALLATEURS_GARDES - 1 plus récents restent
    ls -t "$GARDE_DIR"/maverick-center-*-install.sh 2>/dev/null | grep -vxF "$GARDE" | tail -n "+$INSTALLATEURS_GARDES" |
      while IFS= read -r ancien; do rm -f "$ancien"; done
  else
    rm -f "$GARDE_DIR/.nouveau.$$"
    log "Avertissement : l'installateur $TAG n'a pas pu être gardé dans installateur-courant/."
  fi
}
ASSET=$(grep -o '"url": *"[^"]*/releases/assets/[0-9]*"' "$TMP/livraison.json" | head -n 1 | sed 's/^.*: *"//; s/"$//')

INSTALLE=$(sed -n 's/^tag=//p' "$BASE_DIR/VERSION" 2>/dev/null | head -n 1 || true)
if [ "$FORCE" -eq 0 ] && [ "$INSTALLE" = "$TAG" ] && [ -f "$BASE_DIR/site/index.html" ]; then
  # À jour : si l'installateur de cette livraison n'est pas gardé (livraison installée à la main), il l'est une fois ; l'installation ne change pas.
  if [ ! -f "$GARDE" ] && [ -n "$ASSET" ] &&
    gh_curl -H 'Accept: application/octet-stream' -o "$TMP/installateur.sh" "$ASSET" 2>/dev/null &&
    sh "$TMP/installateur.sh" --verifier >/dev/null 2>&1; then
    garder_installateur "$TMP/installateur.sh"
    log "Installateur $TAG gardé dans installateur-courant/."
  fi
  log "À jour ($TAG)."
  exit 0
fi

# Serveur de test : jamais en arrière sans l'avoir demandé (--force). Une livraison plus ancienne que celle installée vient d'une erreur (livraison
# retirée, étiquette mal posée), pas d'une volonté : le minuteur la réinstallerait toutes les 5 minutes, et le site de dev, source de ce qu'il
# modifie, doit rester sur la version la plus récente. Production : « latest » est choisi par GitHub, un retour en arrière s'y fait en
# publiant la version voulue ; pas de contrôle ici.
# Pas de VERSION ni de tag= : première installation, on installe (une installation ne touche pas à db/).
if [ "$MODE" = test ] && [ "$FORCE" -eq 0 ] && [ -n "$INSTALLE" ]; then
  [ "$(mode_de_etiquette "$INSTALLE")" = test ] ||
    die "l'étiquette installée « $INSTALLE » n'a pas la forme d'une livraison de test (VX.Y.Z) : refus de la comparer à $TAG ; « sh mise-a-jour.sh --force » installe $TAG"
  if [ "$(comparer "$TAG" "$INSTALLE")" = plus_ancienne ]; then
    die "la livraison $TAG est plus ancienne que $INSTALLE, déjà installée : refus ; « sh mise-a-jour.sh --force » pour revenir en arrière, ou un fichier GELER pour suspendre les mises à jour"
  fi
fi

# Un installateur de production refusé faute d'activation-par-paquet (marque posée plus bas) n'est pas retéléchargé toutes les 5 minutes : tant que la marque de cette étiquette est là
# et que le fichier manque toujours, rien à faire (la ligne d'erreur a été écrite une fois). --force passe outre ; le fichier posé, ou une autre étiquette, relance l'installation.
if [ "$FORCE" -eq 0 ] && [ -f "$BASE_DIR/.refus-$TAG" ] && ! { [ -f "$BASE_DIR/activation-par-paquet" ] && [ ! -L "$BASE_DIR/activation-par-paquet" ]; }; then exit 0; fi
# Un installateur « kit seul » de production dont l'activation n'a pas passé (code 4 plus bas) laisse VERSION à l'étiquette d'avant et pose .activation-refusee-<étiquette> : l'activer
# gèle les écritures et fabrique tout le site, elle ne se rejoue pas toutes les 5 minutes. Pas de nouvelle tentative tant que l'étiquette ne change pas ; --force passe outre ;
# la reprise est `sudo bash activer.sh --reprendre`, qui écrit VERSION et efface la marque s'il passe.
if [ "$FORCE" -eq 0 ] && [ -f "$BASE_DIR/.activation-refusee-$TAG" ]; then exit 0; fi

# Une livraison ne porte qu'un fichier joint : son installateur. On le télécharge par l'API (dépôt privé).
[ -n "$ASSET" ] || die "la livraison $TAG n'a pas encore d'installateur joint (construction en cours ?)"
log "Nouvelle livraison $TAG (installée : ${INSTALLE:-aucune}) : téléchargement."
gh_curl -H 'Accept: application/octet-stream' -o "$TMP/installateur.sh" "$ASSET" || die "téléchargement de l'installateur $TAG impossible"
sh "$TMP/installateur.sh" --verifier >/dev/null 2>&1 || die "installateur $TAG refusé (archive corrompue ou incomplète) : rien n'a été modifié"

# Aucune option de base : un installateur de test ne copie la production que si on le lui demande à la main (--copier-base-prod).
CODE_INSTALLATEUR=0
sh "$TMP/installateur.sh" --dossier "$BASE_DIR" >> "$LOG_FILE" 2>&1 || CODE_INSTALLATEUR=$?
if [ "$CODE_INSTALLATEUR" -eq 0 ]; then
  rm -f "$BASE_DIR"/.refus-* "$BASE_DIR"/.activation-refusee-*
  log "Installé : $TAG."
  garder_installateur "$TMP/installateur.sh"
elif [ "$CODE_INSTALLATEUR" -eq 3 ] && [ "$MODE" = prod ] && sed -n '1,/^__ARCHIVE__$/p' "$TMP/installateur.sh" | grep -qx 'KIT_SEUL=1'; then
  # le code 3 ne vaut refus « pas d'activation-par-paquet » QUE pour un installateur « kit seul » (ligne KIT_SEUL=1 dans sa partie script) : un installateur complet qui sortirait
  # en 3 par accident (une commande ajoutée un jour sans garde) tombe dans l'erreur ordinaire, jamais dans une marque qui gèlerait la livraison
  # code 3 : l'installateur « kit seul » de production a refusé faute d'activation-par-paquet : une marque, et plus de téléchargement tant que l'étiquette et l'interrupteur ne changent pas
  : > "$BASE_DIR/.refus-$TAG"
  die "l'installateur $TAG a été refusé : $BASE_DIR/activation-par-paquet n'existe pas (détail dans $LOG_FILE). Il ne sera pas retenté tant que l'étiquette ne change pas ni que ce fichier n'existe : sudo touch $BASE_DIR/activation-par-paquet, ou sudo sh $0 --force"
elif [ "$CODE_INSTALLATEUR" -eq 4 ] && [ "$MODE" = prod ] && sed -n '1,/^__ARCHIVE__$/p' "$TMP/installateur.sh" | grep -qx 'KIT_SEUL=1'; then
  # code 4 : l'installateur « kit seul » de production a posé son kit, mais l'activation n'a pas passé : VERSION garde l'étiquette d'avant (la production n'est pas « à jour »), et la marque
  # est posée (par lui ; ici si elle manque). Sa ligne ERREUR (détail et geste) est déjà au journal : pas de seconde ligne ERREUR ici. Sortie 1 : le passage n'a pas abouti.
  [ -f "$BASE_DIR/.activation-refusee-$TAG" ] || : > "$BASE_DIR/.activation-refusee-$TAG"
  log "L'installateur $TAG a posé son kit mais l'activation n'a pas passé : VERSION reste ${INSTALLE:-inconnue}, marque .activation-refusee-$TAG (détail et geste dans $LOG_FILE). Pas de nouvelle tentative tant que l'étiquette ne change pas ; sudo sh $0 --force passe outre."
  exit 1
else
  die "l'installateur $TAG a échoué (détail ci-dessus dans $LOG_FILE)"
fi
}

principal "$@"
