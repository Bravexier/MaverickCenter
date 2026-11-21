#!/usr/bin/env bash
# Répétition COMPLÈTE du jour J de la bascule 2, sur des COPIES (lot 11 du chantier, PR 3a, docs/chantier-base-de-dev.md ; docs/serveur.md, « Bascule 2 : préparation », « Répétition
# complète du jour J »). Livré par l'installateur de test à la racine de l'instance du site de dev, comme repetition-prod.sh ; lancé par le propriétaire, en root, sur le serveur, autant
# de fois qu'il veut. Il rejoue ce que fera la production le jour J, sans la toucher : sa base est lue en lecture seule (sqlite3 .backup) ou prise dans sa dernière copie locale, la base
# du site de dev n'est jamais écrite, et tout se passe dans un dossier de travail sous <dev>/var/, effacé à la fin.
#
# Usage : sudo bash /srv/maverick-center-test/repetition-bascule-2.sh [--dev <dossier>] [--prod <dossier>] [--depuis-la-sauvegarde] [--garder]
#   --depuis-la-sauvegarde  prendre la dernière copie locale de la production (/srv/maverick-sauvegardes/prod/…) au lieu d'une copie prise à l'instant
#   --garder                garder le dossier de travail (son chemin est dit à la fin ; à effacer soi-même : il contient les fiches de la production)
# Préalable (leçon 4 du jour J de la bascule 1) : la version installée du site de dev (<dev>/VERSION) est celle du kit de l'atelier (<dev>/atelier/kit/kit.json) ; sinon la répétition
#   dit les deux versions et le geste (code 2). Le site de dev doit voir l'attestation de la production (attestation-prod.json dans son dossier des métriques, un `stat`) ; sinon code 2
#   et le geste (MAVERICK_DOSSIER_METRIQUES de son .env). Elle ne tourne pas pendant une fabrication de l'atelier (verrou <dev>/atelier/.verrou).
# Étape A, dans un conteneur du code du site de dev (docker compose run du service « serveur » : son image, son site, sa base ; scripts/repetition-bascule-2.mjs) : le contenu à livrer,
#   fabriqué comme la simulation de mise à jour (un paquet), le contrôle du contenu (garde-fou 18), l'activation (garde-fou 17), puis la base de la production refaite avec ses fiches.
# Étape B, les pages : TOUT le site de la production fabriqué depuis ce paquet avec le kit de l'atelier, dans un conteneur de l'image du kit, sous les règles de l'atelier (aucun réseau,
#   système de fichiers en lecture seule, aucune capacité, utilisateur 65534, plafond de mémoire calculé comme l'atelier), SITE_MODE=prod, HIDE_EXAMPLES=1, l'étiquette de la production.
# Garde-fou 20 : root n'ouvre jamais un fichier que le service ou le conteneur peut toucher. Le paquet est copié par le conteneur ; root fait des `stat`, ne lit que des JSON plafonnés
#   après `docker rm`, et n'en garde que des chiffres.
# Sortie : des comptes seulement, jamais un nom de fiche. Dernière ligne « repetition-bascule-2 : == la bascule PASSERAIT » (code 0), « == REFUSEE : <raison> » (code 1 : elle serait
# refusée ; chiffres et geste dits) ou « == IMPOSSIBLE : <raison> » (code 2 : répétition impossible : usage, préalable, dossier, place, outil).
# Variables (tests) : MAVERICK_DIR_TEST, MAVERICK_DIR_NORMAL (instances), MAVERICK_SAUV_DOCKER (docker), MAVERICK_REPETITION_SAUVEGARDE (scripts des sauvegardes ; défaut <dev>/sauvegarde),
# MAVERICK_DIR_SAUVEGARDES (copies locales), MAVERICK_ESSAI=1 (root non exigé, aucun chown), MAVERICK_ATELIER_PROC, MAVERICK_ATELIER_CGROUP, MAVERICK_DIR_ETC_SYSTEMD, MAVERICK_ATELIER_INTERVALLE.
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

TRAVAIL=''
GARDE_DIT=0
dire() { echo "repetition-bascule-2 : $*"; }
# le dossier gardé (--garder) se dit AVANT le verdict : la dernière ligne reste toujours le verdict
dire_le_dossier_garde() {
  if [ "$GARDER" -eq 1 ] && [ -n "$TRAVAIL" ] && [ "$GARDE_DIT" -eq 0 ]; then
    GARDE_DIT=1
    dire "dossier de travail gardé : $TRAVAIL (il contient les fiches de la production : rm -rf $TRAVAIL une fois lu)"
  fi
}
impossible() { dire_le_dossier_garde >&2; echo "repetition-bascule-2 : == IMPOSSIBLE : $*" >&2; exit 2; }
refusee() { dire_le_dossier_garde; dire "== REFUSEE : $*"; exit 1; }
# root ne source ni ne lit que ce qui est à lui (comme lancer.sh) : propriétaire root (uid 0) et, hors essai, aucun droit d'écriture pour le groupe ni les autres.
# MAVERICK_REPETITION_PROPRIETAIRE (l'uid attendu) ne vaut QUE sous MAVERICK_ESSAI=1 (tests) : hors essai elle est ignorée, l'uid attendu reste 0.
verifier_a_root() { # chemin…
  if [ "${MAVERICK_ESSAI:-0}" = 1 ] && [ -z "${MAVERICK_REPETITION_PROPRIETAIRE:-}" ]; then return 0; fi
  attendu=0
  if [ "${MAVERICK_ESSAI:-0}" = 1 ]; then attendu=${MAVERICK_REPETITION_PROPRIETAIRE:-0}; fi
  for chemin in "$@"; do
    proprietaire=$(stat -c '%u' "$chemin" 2>/dev/null || echo x)
    [ "$proprietaire" = "$attendu" ] || impossible "$chemin n'appartient pas à root : refus (les outils sont posés par l'installateur de test)"
    if [ "${MAVERICK_ESSAI:-0}" != 1 ]; then
      droits=$(stat -c '%a' "$chemin" 2>/dev/null || echo 777)
      [ $((0$droits & 022)) -eq 0 ] || impossible "$chemin est modifiable par un autre que root : refus (les outils sont posés par l'installateur de test)"
    fi
  done
}
[ "${MAVERICK_ESSAI:-0}" = 1 ] || [ "$(id -u)" -eq 0 ] || impossible "à lancer en root : sudo bash $0"

DEV=${DEV%/}
PROD=${PROD%/}
mode_de() { sed -n 's/^mode=//p' "$1/VERSION" 2>/dev/null | head -n 1 || true; }
[ -f "$DEV/VERSION" ] && [ "$(mode_de "$DEV")" = test ] || impossible "$DEV n'est pas le site de dev (fichier VERSION, mode test) : --dev <dossier>"
[ -f "$PROD/VERSION" ] && [ "$(mode_de "$PROD")" = prod ] || impossible "$PROD n'est pas la production (fichier VERSION, mode prod) : --prod <dossier>"
[ "$(cd "$DEV" && pwd -P)" != "$(cd "$PROD" && pwd -P)" ] || impossible "--dev et --prod désignent le même dossier"
[ -f "$DEV/db/vivante.db" ] || impossible "$DEV/db/vivante.db est absente : pas de contenu à essayer"

SCRIPTS=${MAVERICK_REPETITION_SAUVEGARDE:-$DEV/sauvegarde}
[ -f "$SCRIPTS/lib.sh" ] || impossible "scripts des sauvegardes introuvables ($SCRIPTS) : l'installateur du site de dev les pose dans sauvegarde/"
verifier_a_root "$SCRIPTS" "$SCRIPTS/lib.sh"
export MAVERICK_DIR_TEST=$DEV MAVERICK_DIR_NORMAL=$PROD
# shellcheck source=sauvegarde/lib.sh
. "$SCRIPTS/lib.sh"
charger_reglages
DOCKER=${MAVERICK_SAUV_DOCKER:-docker}
compose() { (cd "$DEV" && "$DOCKER" compose "$@"); }
mo() { awk -v n="${1:-0}" 'BEGIN { printf "%.1f Mo", n / 1048576 }'; }
ko_en_mo() { awk -v n="${1:-0}" 'BEGIN { printf "%d Mo", n / 1024 }'; }

# ---------------------------------------------------------------- l'atelier : ses outils, son kit, sa version (préalable de la leçon 4)
ATELIER=$DEV/atelier
OUTILS=$ATELIER/outils
[ -f "$ATELIER/reglages.env" ] || impossible "l'atelier du site de dev n'est pas installé ($ATELIER/reglages.env absent) : sudo sh $ATELIER/installer.sh, puis refaire cette répétition"
if [ ! -f "$OUTILS/lib.sh" ] || [ ! -f "$OUTILS/conteneur.sh" ]; then
  impossible "les outils de l'atelier sont absents ($OUTILS/lib.sh, conteneur.sh) : l'installateur de test les pose à chaque installation ; sudo sh $DEV/mise-a-jour.sh, puis refaire cette répétition"
fi
verifier_a_root "$ATELIER" "$OUTILS" "$OUTILS/lib.sh" "$OUTILS/conteneur.sh"
if ! grep -q 'MODE_REPETITION' "$OUTILS/conteneur.sh"; then
  impossible "les outils de l'atelier installés ($OUTILS/conteneur.sh) sont plus anciens que cette répétition : attendre l'installation de la dernière livraison (au plus 5 min) ou sudo sh $DEV/mise-a-jour.sh, puis la refaire"
fi
# Les règles de l'atelier : calculer_le_plafond, champ_du_fichier, mesurer_le_disque, meminfo_ko, MOTIF_IMAGE… sont celles de outils/lib.sh, sourcé tel qu'il est installé : rien n'est recopié.
# shellcheck source=atelier/lib.sh
. "$OUTILS/lib.sh"
ETC_SYSTEMD=${MAVERICK_DIR_ETC_SYSTEMD:-/etc/systemd/system}
INTERVALLE=${MAVERICK_ATELIER_INTERVALLE:-1}
REGLAGES=$ATELIER/reglages.env
reglage() { # nom défaut (comme lancer.sh)
  valeur=$(champ_du_fichier "$REGLAGES" "$1")
  if entier_positif "$valeur"; then printf '%s' "$valeur"; else printf '%s' "$2"; fi
}
MEMOIRE_MAX_KO=$(reglage MEMOIRE_MAX_KO "$DEFAUT_MEMOIRE_MAX_KO")
BESOIN_KO=$(reglage BESOIN_KO "$DEFAUT_BESOIN_KO")
DISQUE_MIN_KO=$(reglage DISQUE_MIN_KO "$DEFAUT_DISQUE_MIN_KO")
DELAI_S=$(reglage DELAI_S "$DEFAUT_DELAI_S")
CPUS=$(champ_du_fichier "$REGLAGES" CPUS)
valide_cpus "$CPUS" 2>/dev/null || CPUS=$DEFAUT_CPUS
GOOGLE=$(champ_du_fichier "$REGLAGES" GOOGLE_CLIENT_ID | tr -cd 'A-Za-z0-9._-' | cut -c1-128 || true)

# le kit : sa version, son image, sa structure (le PRAGMA user_version de son schema.sql) ; la version installée est celle de VERSION (« version=X.Y.Z », comme la marque de l'atelier)
VERSION_KIT=$(sed -n 's/.*"version": *"\([0-9][0-9]*\.[0-9][0-9]*\.[0-9][0-9]*\)".*/\1/p' "$ATELIER/kit/kit.json" 2>/dev/null | head -n 1 || true)
IMAGE=$(sed -n 's/.*"image": *"\([^"]*\)".*/\1/p' "$ATELIER/kit/kit.json" 2>/dev/null | head -n 1 || true)
VERSION_INSTALLEE=$(sed -n 's/^version=\([0-9][0-9]*\.[0-9][0-9]*\.[0-9][0-9]*\)$/\1/p' "$DEV/VERSION" | head -n 1 || true)
TAG_INSTALLE=$(sed -n 's/^tag=\([vV][0-9][0-9A-Za-z.-]*\)$/\1/p' "$DEV/VERSION" | head -n 1 || true)
GESTE_INSTALLATION="attendre l'installation de la dernière livraison (au plus 5 min), ou sudo sh $DEV/mise-a-jour.sh"
if [ -z "$VERSION_KIT" ] || [ ! -f "$ATELIER/kit/client/package.json" ]; then
  impossible "pas de kit dans $ATELIER/kit (kit.json) : le kit est posé par l'installateur de test à chaque installation ; installer l'atelier (sudo sh $ATELIER/installer.sh) puis $GESTE_INSTALLATION, et refaire cette répétition"
fi
[ -n "$VERSION_INSTALLEE" ] || impossible "$DEV/VERSION ne dit pas sa version (version=X.Y.Z)"
if [ "$VERSION_KIT" != "$VERSION_INSTALLEE" ]; then
  impossible "la version installée du site de dev est la V$VERSION_INSTALLEE (${TAG_INSTALLE:-étiquette inconnue}), le kit de l'atelier est celui de la V$VERSION_KIT : la répétition essaie le code du kit sur le contenu du site installé. Pour lever ce refus : $GESTE_INSTALLATION, puis refaire cette répétition"
fi
printf '%s\n' "$IMAGE" | grep -Eq "$MOTIF_IMAGE" || impossible "l'image du kit n'est pas une image de l'atelier (kit.json : « $(printf '%s' "$IMAGE" | tr -cd 'A-Za-z0-9._:/-' | cut -c1-60) »)"
STRUCTURE_KIT=$(sed -n 's/^PRAGMA user_version *= *\([0-9][0-9]*\).*/\1/p' "$ATELIER/kit/data/schema.sql" 2>/dev/null | head -n 1 || true)
[ -n "$STRUCTURE_KIT" ] || impossible "la structure du kit est illisible ($ATELIER/kit/data/schema.sql : PRAGMA user_version) : le kit est incomplet, $GESTE_INSTALLATION"
dire "préalable : site de dev V$VERSION_INSTALLEE = kit V$VERSION_KIT (structure $STRUCTURE_KIT, image $IMAGE)."

# l'attestation de la production, telle que le service du site de dev la lit (incident du 2026-11-19) : sans elle, « Copier vers le dépôt », la Simulation et la mise à jour
# sont refusées. Son dossier des métriques est celui que monte son conteneur (docker inspect), sinon celui de son .env (metriques_de_l_instance, sauvegarde/lib.sh). Garde-fou 20 :
# un `stat` seulement, jamais une ouverture.
METRIQUES_DU_DEV=$(metriques_de_l_instance dev)
METRIQUES_DU_DEV=${METRIQUES_DU_DEV#* }
METRIQUES_DE_PROD=$(metriques_de_l_instance prod)
METRIQUES_DE_PROD=${METRIQUES_DE_PROD#* }
ATTESTATION_DU_DEV=$METRIQUES_DU_DEV/attestation-prod.json
ATTESTATION_DE_PROD=$METRIQUES_DE_PROD/attestation-prod.json
if ! { [ -f "$ATTESTATION_DU_DEV" ] && [ ! -L "$ATTESTATION_DU_DEV" ]; }; then
  if [ "$METRIQUES_DU_DEV" != "$METRIQUES_DE_PROD" ] && [ -f "$ATTESTATION_DE_PROD" ] && [ ! -L "$ATTESTATION_DE_PROD" ]; then
    impossible "le site de dev ne lit pas l'attestation de la production : il lit $METRIQUES_DU_DEV, la production écrit dans $METRIQUES_DE_PROD (« Copier vers le dépôt », la Simulation et la mise à jour seraient refusées). Pour lever ce refus : ajouter la ligne MAVERICK_DOSSIER_METRIQUES=$METRIQUES_DE_PROD à $DEV/.env, puis cd $DEV && sudo docker compose up -d, et refaire cette répétition"
  fi
  impossible "l'attestation de la production est introuvable ($ATTESTATION_DU_DEV ; la production écrit la sienne dans $ATTESTATION_DE_PROD à son démarrage, puis toutes les heures) : « Copier vers le dépôt », la Simulation et la mise à jour seraient refusées. Pour lever ce refus : vérifier que la production tourne (sudo docker ps), puis que la ligne MAVERICK_DOSSIER_METRIQUES de $DEV/.env désigne le dossier des métriques de la production (cd $DEV && sudo docker compose up -d après l'avoir changée), et refaire cette répétition"
fi
dire "préalable : attestation de la production lue par le site de dev ($ATTESTATION_DU_DEV, écrite il y a $(( ($(date +%s) - $(stat -c %Y "$ATTESTATION_DU_DEV")) / 60 )) min)."

# une seule fabrication à la fois : le verrou de l'atelier est pris pour toute la répétition (lancer.sh, qui le prend sans attendre, refuse alors de démarrer)
command -v flock >/dev/null 2>&1 || impossible "flock est absent (util-linux)"
exec 9>"$ATELIER/.verrou"
if ! flock -n 9; then
  impossible "une fabrication de l'atelier est en cours (le verrou $ATELIER/.verrou est pris$([ -e "$ATELIER/rapports/en-cours.json" ] && echo ' ; rapports/en-cours.json présent')) : attendre sa fin (une dizaine de minutes au plus ; sudo sh $ATELIER/installer.sh --etat), puis refaire cette répétition"
fi
[ ! -e "$ATELIER/rapports/en-cours.json" ] || dire "note : $ATELIER/rapports/en-cours.json traîne sans fabrication vivante (verrou libre) : ignoré, lancer.sh l'efface à sa prochaine fabrication."
MARQUE_AVANT=$(cat "$ATELIER/declencheur/marque" 2>/dev/null || true)

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

# ---------------------------------------------------------------- le dossier de travail (place : étape A comme repetition-prod.sh, plus deux fois le kit, plus le minimum de l'atelier)
taille_prod=$(octets_de "$ORIGINE/vivante.db")
taille_dev=$(octets_de "$DEV/db/vivante.db")
taille_kit=$(octets_de "$ATELIER/kit")
besoin=$((4 * taille_prod + 2 * taille_dev + 2 * taille_kit + DISQUE_MIN_KO * 1024 + 64 * 1048576))
mkdir -p "$DEV/var"
libre=$(libre_octets "$DEV/var")
if [ -n "$libre" ] && [ "$libre" -lt "$besoin" ] 2>/dev/null; then
  impossible "place insuffisante sous $DEV/var : $(mo "$libre") libres, $(mo "$besoin") nécessaires (4 fois la base de la production, 2 fois celle du site de dev, 2 fois le kit, le minimum de l'atelier, 64 Mo) : libérer de la place"
fi
TRAVAIL=$(mktemp -d "$DEV/var/repetition-bascule-2.XXXXXX")
case "$TRAVAIL" in *"'"*|*:*) rm -rf "$TRAVAIL"; impossible "chemin de travail inattendu ($TRAVAIL)" ;; esac
chmod 700 "$TRAVAIL"
CID=''
nettoyer() {
  if [ -n "$CID" ]; then "$DOCKER" rm -f "$CID" >/dev/null 2>&1 || true; fi
  if [ "$GARDER" -ne 1 ]; then rm -rf "$TRAVAIL"; fi
}
trap nettoyer EXIT
trap 'exit 1' INT TERM HUP
mkdir "$TRAVAIL/prod"
rm -f "$DEV/var/repetition-bascule-2-journal-du-conteneur.txt"
if [ "$DEPUIS_LA_SAUVEGARDE" -eq 1 ]; then
  cp "$ORIGINE/vivante.db" "$TRAVAIL/prod/vivante.db" || impossible "copie de la sauvegarde impossible"
else
  sqlite3 -readonly -cmd '.timeout 10000' "$ORIGINE/vivante.db" ".backup '$TRAVAIL/prod/vivante.db'" >/dev/null 2>&1 || impossible "copie de la base de la production impossible (sqlite3 .backup)"
fi
[ ! -f "$ORIGINE/vivante.json" ] || cp "$ORIGINE/vivante.json" "$TRAVAIL/prod/vivante.json"
dire "copie posée dans $TRAVAIL ($(mo "$(octets_de "$TRAVAIL/prod/vivante.db")")) ; $(mo "$libre") libres avant la répétition."

# ---------------------------------------------------------------- étape A : le contenu à livrer et la base de la production, dans le conteneur du code du site de dev
dire "étape A : dans un conteneur du site de dev (version $VERSION_INSTALLEE) : le paquet, le contrôle du contenu, l'activation, la base de la production refaite…"
debut=$SECONDS
rc=0
sortie=$(compose run --rm --no-deps -T -v "$TRAVAIL:/repetition" -v "$PROD/site:/production:ro" serveur \
  node /site/_serveur/scripts/repetition-bascule-2.mjs --source /db/vivante.db --travail /repetition --production /production --kit-version "$VERSION_KIT" --kit-structure "$STRUCTURE_KIT" \
  --chute-pourcent "$CHUTE_POURCENT" --chute-min "$CHUTE_MIN_LIGNES" 9>&- 2>&1) || rc=$?
printf '%s\n' "$sortie" | grep -v '^@@version-paquet=' | sed 's/^/repetition-bascule-2 : /' || true
duree_a=$((SECONDS - debut))
case "$rc" in
  0) ;;
  1) dire "durée totale $((SECONDS - debut)) s."; refusee "étape A : le contenu à livrer ou la base de la production ne passeraient pas (raisons plus haut) ; les pages n'ont pas été fabriquées" ;;
  *) impossible "l'étape A n'a pas abouti dans le conteneur (code $rc)" ;;
esac
VERSION_PAQUET=$(printf '%s\n' "$sortie" | sed -n 's/^@@version-paquet=\([0-9][0-9]*\.[0-9][0-9]*\)$/\1/p' | tail -n 1 || true)
[ -n "$VERSION_PAQUET" ] || impossible "l'étape A n'a pas donné la version du paquet"
PAQUET=$TRAVAIL/contenu/paquet.db
# root ne fait qu'un `stat` du paquet (fichier régulier non lien, plafond de l'atelier) ; c'est le conteneur sans privilège qui l'ouvre
[ -f "$PAQUET" ] && [ ! -L "$PAQUET" ] || impossible "le paquet n'est pas un fichier régulier ($PAQUET)"
taille_paquet=$(stat -c '%s' "$PAQUET" 2>/dev/null || echo 0)
{ [ "$taille_paquet" -gt 0 ] && [ "$taille_paquet" -le "$PLAFOND_EXTRAIT" ]; } || impossible "le paquet a une taille inattendue ($taille_paquet octets)"

# ---------------------------------------------------------------- étape B : les pages de la production, depuis ce paquet, avec le kit de l'atelier
dire "étape B : les pages de la production (V$VERSION_PAQUET), fabriquées depuis le paquet avec le kit V$VERSION_KIT…"
MEM_TOTAL_KO=$(meminfo_ko MemTotal)
MEM_DISPO_KO=$(meminfo_ko MemAvailable)
case "$MEM_TOTAL_KO$MEM_DISPO_KO" in ''|*[!0-9]*) refusee "étape B : la mémoire du serveur est illisible ($PROC/meminfo) : la fabrication serait refusée (memoire_insuffisante)" ;; esac
calculer_le_plafond "$MEM_TOTAL_KO" "$MEM_DISPO_KO" "$MEMOIRE_MAX_KO" "$BESOIN_KO"
if [ -n "$MOTIF_REFUS" ]; then
  refusee "étape B : les pages ne se fabriqueraient pas, l'atelier les refuserait. $(dire_la_memoire "$MEM_TOTAL_KO" "$MEM_DISPO_KO" "$BESOIN_KO" "$ATELIER/installer.sh" "$MEMOIRE_MAX_KO")"
fi
mesurer_le_disque "$DEV/var"
if [ -z "$DISQUE_LIBRE_KO" ] || [ "$DISQUE_LIBRE_KO" -lt "$DISQUE_MIN_KO" ]; then
  refusee "étape B : disque insuffisant sous $DEV/var : $(ko_en_mo "${DISQUE_LIBRE_KO:-0}") libres, le minimum de l'atelier est $(ko_en_mo "$DISQUE_MIN_KO") (disque_insuffisant) : libérer de la place, ou baisser le minimum par « sudo sh $ATELIER/installer.sh --disque-min <taille> »"
fi
dire "mémoire : $(ko_en_mo "$MEM_DISPO_KO") disponibles sur $(ko_en_mo "$MEM_TOTAL_KO") ; plafond du conteneur $(ko_en_mo "$PLAFOND_KO") (besoin $(ko_en_mo "$BESOIN_KO"), marge laissée à la production $(ko_en_mo "$MARGE_KO")) ; $CPUS processeur(s)."

if ! "$DOCKER" image inspect "$IMAGE" >/dev/null 2>&1; then
  "$DOCKER" pull "$IMAGE" >/dev/null 2>&1 || impossible "l'image $IMAGE est absente et ne se télécharge pas (image_absente) : vérifier la connexion du serveur, puis refaire cette répétition"
fi
# les dossiers du conteneur : neufs, donnés à l'utilisateur 65534 (le dossier lui-même), comme preparer_un_dossier de l'atelier. Le travail est sur le MÊME montage que le kit copié (leçon EXDEV :
# Astro déplace ses fichiers par rename) ; le paquet est monté en lecture seule, le conteneur le copie lui-même.
for d in fabrique resultats; do
  mkdir "$TRAVAIL/$d"
  if [ "${MAVERICK_ESSAI:-0}" != 1 ]; then chown 65534:65534 "$TRAVAIL/$d"; fi
  chmod 755 "$TRAVAIL/$d"
done
{ [ -d "$TRAVAIL/contenu" ] && [ ! -L "$TRAVAIL/contenu" ]; } || impossible "le dossier du paquet n'est pas un dossier ordinaire ($TRAVAIL/contenu)"
chmod 755 "$TRAVAIL/contenu"
PARENT_DU_CGROUP=''
if [ -f "$ETC_SYSTEMD/maverick-atelier.slice" ]; then PARENT_DU_CGROUP='--cgroup-parent maverick-atelier.slice'; fi
# les règles de l'atelier (lancer.sh) : aucun réseau, lecture seule, aucune capacité, aucun nouveau privilège, utilisateur 65534, mémoire plafonnée sans échange
if ! CID=$("$DOCKER" run -d --name "maverick-repetition-bascule-2-$$" \
  --network none --read-only --cap-drop ALL --security-opt no-new-privileges --user 65534:65534 --pids-limit 1024 \
  --cpus "$CPUS" --cpu-shares 128 --memory "${PLAFOND_KO}k" --memory-swap "${PLAFOND_KO}k" --oom-score-adj 500 \
  -e HOME=/travail/home -e TMPDIR=/travail/tmp -e HIDE_EXAMPLES=1 -e SITE_MODE=prod -e "SITE_TAG=v$VERSION_PAQUET" -e SITE_BASE=/ -e "SITE_GOOGLE_CLIENT_ID=$GOOGLE" \
  -e MODE_REPETITION=1 -e CONTENU_FICHIER=/contenu/paquet.db \
  -v "$ATELIER/kit:/kit:ro" -v "$TRAVAIL/contenu:/contenu:ro" -v "$OUTILS/conteneur.sh:/conteneur.sh:ro" \
  -v "$TRAVAIL/fabrique:/travail" -v "$TRAVAIL/resultats:/resultats" \
  $PARENT_DU_CGROUP "$IMAGE" sh /conteneur.sh 9>&- 2>/dev/null); then
  CID=''
  refusee "étape B : Docker refuse de lancer le conteneur (docker_refuse) : voir « journalctl -u docker » ; rien n'a été fabriqué"
fi

# le suivi (comme lancer.sh) : le pic de mémoire (cgroup, sinon docker stats), l'espace libre (sous le minimum, le conteneur est arrêté), le délai
PIC_KO=''
SOURCE_DU_PIC=''
releve_du_conteneur() {
  trouve=0
  for base in "$CGROUP/maverick-atelier.slice/docker-$CID.scope" "$CGROUP/maverick-atelier.slice/$CID" "$CGROUP/system.slice/docker-$CID.scope" "$CGROUP/docker/$CID"; do
    [ -d "$base" ] || continue
    trouve=1
    if [ -f "$base/memory.peak" ]; then octets=$(cat "$base/memory.peak" 2>/dev/null || true); source=cgroup
    elif [ -f "$base/memory.current" ]; then octets=$(cat "$base/memory.current" 2>/dev/null || true); source=cgroup_echantillonne
    else octets=''; source=''
    fi
    case "$octets" in
      ''|*[!0-9]*) ;;
      *) ko=$((octets / 1024)); if [ -z "$PIC_KO" ] || [ "$ko" -gt "$PIC_KO" ]; then PIC_KO=$ko; SOURCE_DU_PIC=$source; fi ;;
    esac
    break
  done
  if [ "$trouve" -eq 0 ]; then
    utilisee=$("$DOCKER" stats --no-stream --format '{{.MemUsage}}' "$CID" 2>/dev/null | awk '{ print $1 }' || true)
    ko=$(printf '%s\n' "$utilisee" | awk '
      match($0, /^[0-9.]+/) { v = substr($0, 1, RLENGTH) + 0; u = substr($0, RLENGTH + 1)
        if (u == "GiB" || u == "GB") printf "%d\n", v * 1048576; else if (u == "MiB" || u == "MB") printf "%d\n", v * 1024; else if (u == "KiB" || u == "kB" || u == "KB") printf "%d\n", v; else if (u == "B") printf "%d\n", v / 1024 }')
    case "$ko" in ''|*[!0-9]*) ;; *) if [ -z "$PIC_KO" ] || [ "$ko" -gt "$PIC_KO" ]; then PIC_KO=$ko; SOURCE_DU_PIC=docker_stats; fi ;; esac
  fi
}
DEPASSE=0
DISQUE_COUPE=0
depart=$(date +%s)
while :; do
  en_marche=$("$DOCKER" inspect -f '{{.State.Running}}' "$CID" 2>/dev/null || echo false)
  releve_du_conteneur
  [ "$en_marche" = true ] || break
  mesurer_le_disque "$DEV/var"
  if [ -n "$DISQUE_LIBRE_KO" ] && [ "$DISQUE_LIBRE_KO" -lt "$DISQUE_MIN_KO" ]; then DISQUE_COUPE=1; "$DOCKER" kill "$CID" >/dev/null 2>&1 || true; break; fi
  if [ $(($(date +%s) - depart)) -ge "$DELAI_S" ]; then DEPASSE=1; "$DOCKER" kill "$CID" >/dev/null 2>&1 || true; break; fi
  sleep "$INTERVALLE"
done
duree_b=$(($(date +%s) - depart))
OOM=$("$DOCKER" inspect -f '{{.State.OOMKilled}}' "$CID" 2>/dev/null || echo false)
CODE_SORTIE=$("$DOCKER" inspect -f '{{.State.ExitCode}}' "$CID" 2>/dev/null || echo '')
case "$CODE_SORTIE" in ''|*[!0-9]*) CODE_SORTIE='' ;; esac
# le journal du conteneur (docker logs : la fin, 200 Ko au plus) est gardé AVANT sa suppression, pour lire l'erreur d'un échec ; jamais interprété
JOURNAL=$DEV/var/repetition-bascule-2-journal-du-conteneur.txt
{ timeout 30 "$DOCKER" logs "$CID" 2>&1 | tail -c "$PLAFOND_JOURNAL" > "$TRAVAIL/journal-du-conteneur.txt"; } 2>/dev/null || : > "$TRAVAIL/journal-du-conteneur.txt"
# le conteneur est supprimé AVANT de toucher à ce qu'il a laissé : plus aucun processus ne peut changer un fichier entre le contrôle de son type et sa lecture
"$DOCKER" rm -f "$CID" >/dev/null 2>&1 || true
CID=''

# ce que root garde du conteneur : des chiffres, d'un fichier régulier non lien de 256 Ko au plus (jamais le texte)
nombre_de() { # fichier expression_sed -> un entier, ou vide
  [ -f "$1" ] && [ ! -L "$1" ] || return 0
  [ "$(stat -c '%s' "$1" 2>/dev/null || echo 999999999)" -le "$PLAFOND_RESULTAT" ] || return 0
  head -c "$PLAFOND_RESULTAT" "$1" | sed -n "$2" | head -n 1 || true
}
PAGES=$(nombre_de "$TRAVAIL/resultats/pages.txt" 's/^\([0-9][0-9]*\)$/\1/p')
FICHIERS=$(nombre_de "$TRAVAIL/resultats/fabrication.json" 's/^ *"fichiers": *\([0-9][0-9]*\).*/\1/p')
PIC_PROCESSUS_KO=$(nombre_de "$TRAVAIL/resultats/fabrication.json" 's/^ *"pic_ko": *\([0-9][0-9]*\).*/\1/p')
DUREE_FABRICATION_MS=$(nombre_de "$TRAVAIL/resultats/fabrication.json" 's/^  "duree_ms": *\([0-9][0-9]*\).*/\1/p')
pourcent=''
if [ -n "$PIC_KO" ] && [ "$PLAFOND_KO" -gt 0 ]; then pourcent=" ($((PIC_KO * 100 / PLAFOND_KO)) % du plafond)"; fi
texte_pic='non relevé'
if [ -n "$PIC_KO" ]; then texte_pic="$(ko_en_mo "$PIC_KO")$pourcent ($SOURCE_DU_PIC)"; fi
texte_pic_processus='inconnu'
if [ -n "$PIC_PROCESSUS_KO" ]; then texte_pic_processus=$(ko_en_mo "$PIC_PROCESSUS_KO"); fi
texte_duree='inconnue'
if [ -n "$DUREE_FABRICATION_MS" ]; then texte_duree="$((DUREE_FABRICATION_MS / 1000)) s"; fi
dire "pages fabriquées : ${PAGES:-inconnu} page(s) HTML, ${FICHIERS:-inconnu} fichier(s) ; durée de la fabrication $texte_duree ; durée de l'étape B $duree_b s."
dire "pic de mémoire : $texte_pic ; pic d'un processus (mesure interne) : $texte_pic_processus ; plafond $(ko_en_mo "$PLAFOND_KO")."

echec_de_l_etape_b() { # raison
  tail -c "$PLAFOND_JOURNAL" "$TRAVAIL/journal-du-conteneur.txt" > "$JOURNAL" 2>/dev/null || true
  dire "journal du conteneur (les 15 dernières lignes, sans caractère de contrôle ; la fin de 200 Ko est dans $JOURNAL) :"
  tail -n 15 "$TRAVAIL/journal-du-conteneur.txt" 2>/dev/null | LC_ALL=C tr -d '\000-\010\013-\037\177' | cut -c1-200 | sed 's/^/repetition-bascule-2 :   /' || true
  refusee "$1"
}
if [ "$DISQUE_COUPE" -eq 1 ]; then echec_de_l_etape_b "étape B : le disque est tombé sous le minimum de l'atelier pendant la fabrication (disque_insuffisant) : le conteneur a été arrêté ; libérer de la place sous $DEV/var puis refaire cette répétition"
elif [ "$DEPASSE" -eq 1 ]; then echec_de_l_etape_b "étape B : la fabrication a dépassé le délai de ${DELAI_S} s (delai) : le conteneur a été arrêté ; le serveur est trop lent (--cpus 2 au geste de l'atelier : sudo sh $ATELIER/installer.sh --cpus 2) ou trop juste"
elif [ "$OOM" = true ]; then echec_de_l_etape_b "étape B : la fabrication a dépassé le plafond de mémoire de $(ko_en_mo "$PLAFOND_KO") (oom : OOMKilled), les pages ne se refont pas : un serveur avec plus de mémoire, ou plus de mémoire disponible (la production et le site de dev en consomment $(ko_en_mo $((MEM_TOTAL_KO - MEM_DISPO_KO))))"
elif [ "$CODE_SORTIE" = 73 ] || [ "$CODE_SORTIE" = 74 ] || [ "$CODE_SORTIE" = 75 ]; then echec_de_l_etape_b "étape B : le conteneur a refusé le paquet (code $CODE_SORTIE : pas un fichier régulier, taille inattendue ou copie trop lente) : refaire cette répétition ; si le refus revient, c'est un défaut à corriger avant la bascule"
elif [ "$CODE_SORTIE" != 0 ]; then echec_de_l_etape_b "étape B : la fabrication des pages a échoué (code ${CODE_SORTIE:-inconnu}) : voir le journal du conteneur plus haut ; c'est un défaut à corriger avant la bascule"
fi
{ [ -n "$PAGES" ] && [ "$PAGES" -gt 0 ]; } || echec_de_l_etape_b "étape B : la fabrication a réussi mais aucune page HTML n'a été comptée : défaut à corriger avant la bascule"

if [ "$(cat "$ATELIER/declencheur/marque" 2>/dev/null || true)" != "$MARQUE_AVANT" ]; then
  dire "note : une livraison est arrivée pendant la répétition ; l'atelier l'a refusée (verrou pris) : la fabriquer avec « sudo systemctl start maverick-atelier.service » (ou la fabrication de nuit)."
fi
dire "durée totale $((SECONDS - debut)) s (étape A $duree_a s, étape B $duree_b s) ; place : dossier de travail $(mo "$(octets_de "$TRAVAIL")") au plus fort."
dire_le_dossier_garde
dire "== la bascule PASSERAIT : le contenu à livrer (V$VERSION_PAQUET) passe les contrôles, la base de la production se refait avec ses fiches, ${PAGES} pages se fabriquent."
exit 0
