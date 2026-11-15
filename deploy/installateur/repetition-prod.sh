#!/usr/bin/env bash
# Répétition, sur une COPIE, de la dernière mise à jour de la production par l'ancien circuit (lot 8 du chantier, docs/chantier-base-de-dev.md ; docs/serveur.md,
# « Répétition de la mise à jour de la production »). Livré par l'installateur de test à la racine de l'instance du site de dev ; lancé par le propriétaire,
# en root, sur le serveur, autant de fois qu'il veut. La vraie production n'est JAMAIS touchée : sa base est lue en lecture seule (sqlite3 .backup, comme les
# sauvegardes) ou prise dans sa dernière copie locale, puis tout se passe dans un dossier de travail sous <dev>/var/, effacé à la fin.
#
# Usage : sudo bash /srv/maverick-center-test/repetition-prod.sh [--dev <dossier>] [--prod <dossier>] [--depuis-la-sauvegarde] [--garder]
#   --depuis-la-sauvegarde  prendre la dernière copie locale de la production (/srv/maverick-sauvegardes/prod/…) au lieu d'une copie prise à l'instant
#   --garder                garder le dossier de travail (son chemin est dit à la fin ; à effacer soi-même : il contient les fiches de la production)
# Ce qui est fait, DANS un conteneur du code du site de dev (docker compose run du service « serveur » de son instance : son image, son site, sa base) :
#   le contenu à venir est l'extrait du contenu de la base du site de dev ; le service de la production, à son installation, ferait de sa base ce que fait
#   preparerBaseVivante (fiches recopiées, conversions, retraits R42, contrôle des fiches) : c'est ce qui est joué sur la copie (scripts/repetition-prod.mjs).
# Sortie : des comptes seulement, jamais un nom de fiche. Code 0 : la production PASSERA ; 1 : elle GARDERAIT SA BASE (le rapport dit pourquoi) ; 2 : répétition
# impossible (usage, dossier, place, outil).
# Variables (tests) : MAVERICK_DIR_TEST, MAVERICK_DIR_NORMAL (instances), MAVERICK_SAUV_DOCKER (docker), MAVERICK_REPETITION_SAUVEGARDE (scripts des sauvegardes ;
# défaut <dev>/sauvegarde), MAVERICK_DIR_SAUVEGARDES (copies locales), MAVERICK_ESSAI=1 (root non exigé).
set -euo pipefail
umask 077

usage() { echo "Usage : sudo bash $0 [--dev <dossier>] [--prod <dossier>] [--depuis-la-sauvegarde] [--garder]" >&2; exit 2; }
DEV=${MAVERICK_DIR_TEST:-/srv/maverick-center-test}
PROD=${MAVERICK_DIR_NORMAL:-/srv/maverick-center}
DEPUIS_LA_SAUVEGARDE=0
GARDER=0
while [ $# -gt 0 ]; do
  case "$1" in
    --dev) [ $# -ge 2 ] || usage; DEV=$2; shift 2 ;;
    --prod) [ $# -ge 2 ] || usage; PROD=$2; shift 2 ;;
    --depuis-la-sauvegarde) DEPUIS_LA_SAUVEGARDE=1; shift ;;
    --garder) GARDER=1; shift ;;
    *) usage ;;
  esac
done

dire() { echo "repetition : $*"; }
impossible() { echo "repetition : IMPOSSIBLE : $*" >&2; exit 2; }
[ "${MAVERICK_ESSAI:-0}" = 1 ] || [ "$(id -u)" -eq 0 ] || impossible "à lancer en root : sudo bash $0"

DEV=${DEV%/}
PROD=${PROD%/}
mode_de() { sed -n 's/^mode=//p' "$1/VERSION" 2>/dev/null | head -n 1; }
[ -f "$DEV/VERSION" ] && [ "$(mode_de "$DEV")" = test ] || impossible "$DEV n'est pas le site de dev (fichier VERSION, mode test) : --dev <dossier>"
[ -f "$PROD/VERSION" ] && [ "$(mode_de "$PROD")" = prod ] || impossible "$PROD n'est pas la production (fichier VERSION, mode prod) : --prod <dossier>"
[ "$(cd "$DEV" && pwd -P)" != "$(cd "$PROD" && pwd -P)" ] || impossible "--dev et --prod désignent le même dossier"
[ -f "$DEV/db/vivante.db" ] || impossible "$DEV/db/vivante.db est absente : pas de contenu à essayer"

SCRIPTS=${MAVERICK_REPETITION_SAUVEGARDE:-$DEV/sauvegarde}
[ -f "$SCRIPTS/lib.sh" ] || impossible "scripts des sauvegardes introuvables ($SCRIPTS) : l'installateur du site de dev les pose dans sauvegarde/"
export MAVERICK_DIR_TEST=$DEV MAVERICK_DIR_NORMAL=$PROD
# shellcheck source=sauvegarde/lib.sh
. "$SCRIPTS/lib.sh"
charger_reglages
DOCKER=${MAVERICK_SAUV_DOCKER:-docker}
compose() { (cd "$DEV" && "$DOCKER" compose "$@"); }
mo() { awk -v n="${1:-0}" 'BEGIN { printf "%.1f Mo", n / 1048576 }'; }

# ---------------------------------------------------------------- la base de la production à copier
if [ "$DEPUIS_LA_SAUVEGARDE" -eq 1 ]; then
  copie=$(derniere_copie prod)
  [ -n "$copie" ] || impossible "aucune copie locale de la production dans $SAUV/prod (sauvegardes installées ?)"
  ORIGINE="$SAUV/prod/$copie/db"
  [ -f "$ORIGINE/vivante.db" ] || impossible "la copie $copie n'a pas de vivante.db"
  dire "base de la production : dernière copie locale ($copie, $(iso_de "$(etat_lire "$SAUV/prod/$copie/copie.meta" INSTANT)" 2>/dev/null || echo 'date inconnue'))."
else
  command -v sqlite3 >/dev/null 2>&1 || impossible "sqlite3 est absent (apt-get install sqlite3), ou --depuis-la-sauvegarde"
  ORIGINE="$PROD/db"
  [ -f "$ORIGINE/vivante.db" ] || impossible "$ORIGINE/vivante.db est absente : la production n'a pas de base"
  dire "base de la production : copie prise à l'instant ($ORIGINE/vivante.db, lue en lecture seule)."
fi

# ---------------------------------------------------------------- le dossier de travail (place : 4 × la production + la base du site de dev + 64 Mio)
taille_prod=$(octets_de "$ORIGINE/vivante.db")
taille_dev=$(octets_de "$DEV/db/vivante.db")
besoin=$((4 * taille_prod + taille_dev + 64 * 1048576))
mkdir -p "$DEV/var"
libre=$(libre_octets "$DEV/var")
if [ -n "$libre" ] && [ "$libre" -lt "$besoin" ] 2>/dev/null; then
  impossible "place insuffisante sous $DEV/var : $(mo "$libre") libres, $(mo "$besoin") nécessaires"
fi
TRAVAIL=$(mktemp -d "$DEV/var/repetition-prod.XXXXXX")
case "$TRAVAIL" in *"'"*|*:*) rm -rf "$TRAVAIL"; impossible "chemin de travail inattendu ($TRAVAIL)" ;; esac
chmod 700 "$TRAVAIL"
nettoyer() { if [ "$GARDER" -eq 1 ]; then dire "dossier de travail gardé : $TRAVAIL (il contient les fiches de la production : rm -rf $TRAVAIL une fois lu)"; else rm -rf "$TRAVAIL"; fi; }
trap nettoyer EXIT
mkdir "$TRAVAIL/prod"

if [ "$DEPUIS_LA_SAUVEGARDE" -eq 1 ]; then
  cp "$ORIGINE/vivante.db" "$TRAVAIL/prod/vivante.db" || impossible "copie de la sauvegarde impossible"
else
  sqlite3 -readonly -cmd '.timeout 10000' "$ORIGINE/vivante.db" ".backup '$TRAVAIL/prod/vivante.db'" >/dev/null 2>&1 || impossible "copie de la base de la production impossible (sqlite3 .backup)"
fi
[ ! -f "$ORIGINE/vivante.json" ] || cp "$ORIGINE/vivante.json" "$TRAVAIL/prod/vivante.json"
dire "copie posée dans $TRAVAIL ($(mo "$(octets_de "$TRAVAIL/prod/vivante.db")")) ; $(mo "$libre") libres avant la répétition."

# ---------------------------------------------------------------- la répétition, dans le conteneur du code du site de dev
dire "répétition dans un conteneur du site de dev (version $(sed -n 's/^tag=//p' "$DEV/VERSION" | head -n 1)) : contenu à venir tiré de sa base, puis la préparation de la production…"
debut=$SECONDS
rc=0
sortie=$(compose run --rm --no-deps -T -v "$TRAVAIL:/repetition" serveur \
  node /site/_serveur/scripts/repetition-prod.mjs --source /db/vivante.db --travail /repetition --chute-pourcent "$CHUTE_POURCENT" --chute-min "$CHUTE_MIN_LIGNES" 2>&1) || rc=$?
printf '%s\n' "$sortie" | sed 's/^/repetition : /'
dire "place : dossier de travail $(mo "$(octets_de "$TRAVAIL")") au plus fort ; durée totale $((SECONDS - debut)) s."
case "$rc" in
  0) dire "== la production PASSERA : sa base sera refaite avec le contenu du site de dev, ses fiches adaptées comme dit plus haut." ;;
  1) dire "== la production GARDERAIT SA BASE : le nouveau service démarrerait sur l'ancienne base (rien de perdu, contenu non appliqué) ; voir les problèmes plus haut."; exit 1 ;;
  *) impossible "la répétition n'a pas abouti dans le conteneur (code $rc)" ;;
esac
exit 0
