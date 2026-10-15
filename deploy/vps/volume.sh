#!/usr/bin/env bash
# Répartition du disque du serveur par type de données, vue de l'hôte (docs/serveur.md, « Jauge de l'espace disque » ; demande du propriétaire du
# 2026-10-15 : « la place occupée sur le serveur sur la place totale sous forme de jauge, colorée en fonction du type de données (DB, Code, Import
# images, etc.) »). Le service de chaque instance compte lui-même, depuis son conteneur, sa base, ses lots de mise à jour, le dossier des métriques
# et son site (serveur/metriques.mjs, REPARTITION) ; il ne voit ni l'autre instance, ni Docker, ni les journaux, ni les restes d'installation, qui
# tombent chez lui dans « Système et autres ». Ce script les mesure depuis l'hôte, avec LES MÊMES CLÉS et les mêmes règles de classement des
# fichiers du site (categorieDuFichierDuSite), plus trois clés que seul l'hôte voit (docker, journaux, installations), et écrit volume-hote.json
# dans le dossier des métriques que les deux instances montent (/metriques/volume-hote.json dans leur conteneur).
#
# Lancé toutes les 15 minutes par le minuteur systemd « maverick-volume.timer » que pose instances.sh ; à la main :
#   sudo bash volume.sh [--sortie <fichier>] [<dossier d'instance>...]      (défaut : /srv/maverick-center et /srv/maverick-center-test)
# Ne fait que lire, sauf le fichier de sortie, remplacé d'un coup (fichier temporaire puis renommage). Octets alloués sur le disque (blocs, comme
# df, du et le service), pas la taille apparente des fichiers.
set -euo pipefail
shopt -s nullglob

# Dossiers lus, changés seulement par les tests (client/test/deploy-volume.test.mjs).
VARLOG=${MAVERICK_DIR_VARLOG:-/var/log}
TMP_HOTE=${MAVERICK_DIR_TMP:-/tmp}
RACINE_ROOT=${MAVERICK_DIR_ROOT:-/root}
MAISONS=${MAVERICK_DIR_HOME:-/home}

SORTIE=
INSTANCES=()
while [ $# -gt 0 ]; do
  case "$1" in
    --sortie) [ $# -ge 2 ] || { echo "--sortie demande un fichier" >&2; exit 2; }; SORTIE=$2; shift 2 ;;
    -*) echo "Usage : sudo bash $0 [--sortie <fichier>] [<dossier d'instance>...]" >&2; exit 2 ;;
    *) INSTANCES+=("${1%/}"); shift ;;
  esac
done
[ ${#INSTANCES[@]} -gt 0 ] || INSTANCES=("${MAVERICK_DIR_NORMAL:-/srv/maverick-center}" "${MAVERICK_DIR_TEST:-/srv/maverick-center-test}")
PREMIERE=${INSTANCES[0]}
[ -d "$PREMIERE" ] || { echo "Dossier d'instance introuvable : $PREMIERE" >&2; exit 1; }

debut_ns=$(date +%s%N)

# Valeur d'un réglage dans le .env d'une instance (vide s'il n'y est pas).
reglage() { [ -f "$1/.env" ] && sed -n "s/^$2=//p" "$1/.env" | tail -n 1 || true; }

# Dossier des métriques : celui que le .env de la première instance (le serveur normal) donne aux conteneurs, sinon metriques/ de l'instance,
# sinon db/metriques/ (défaut du service, quand aucun dossier n'est réglé).
METRIQUES=$(reglage "$PREMIERE" MAVERICK_DOSSIER_METRIQUES)
if [ -z "$METRIQUES" ]; then
  if [ -d "$PREMIERE/metriques" ]; then METRIQUES=$PREMIERE/metriques; else METRIQUES=$PREMIERE/db/metriques; fi
fi
METRIQUES=${METRIQUES%/}
[ -n "$SORTIE" ] || SORTIE=$METRIQUES/volume-hote.json
[ -d "$(dirname "$SORTIE")" ] || { echo "Dossier de sortie introuvable : $(dirname "$SORTIE") (lancez d'abord instances.sh)" >&2; exit 1; }

# Octets alloués à des chemins (fichiers ou dossiers), sans changer de disque ni compter deux fois un même fichier ; 0 si rien n'existe.
occupe() {
  local existants=() c n
  for c in "$@"; do
    if [ -e "$c" ]; then existants+=("$c"); fi
  done
  if [ ${#existants[@]} -eq 0 ]; then echo 0; return; fi
  n=$( { du -s -c -x -B1 -- "${existants[@]}" 2>/dev/null || true; } | tail -n 1 | cut -f1)
  echo "${n:-0}"
}

# Octets alloués aux fichiers d'un dossier que désignent les critères de find qui suivent (blocs de 512 octets, comme du).
occupe_fichiers() {
  local dossier=$1
  shift
  if [ ! -d "$dossier" ]; then echo 0; return; fi
  { find "$dossier" -xdev -type f \( "$@" \) -printf '%b\n' 2>/dev/null || true; } | awk '{ s += $1 } END { printf "%.0f\n", s * 512 }'
}

# Les fichiers d'un site par clé, avec les règles de serveur/metriques.mjs#categorieDuFichierDuSite (à garder d'accord : le test les compare) ;
# les blocs des dossiers eux-mêmes (le site compris) vont avec les autres fichiers du site, comme chez le service ; les liens symboliques ne sont
# jamais comptés. Sortie : « site-code site-donnees site-images site-autres images ».
fichiers_du_site() {
  if [ ! -d "$1" ]; then echo 0 0 0 0 0; return; fi
  { find "$1" -xdev \( -type f -o -type d \) -printf '%y\t%P\t%b\n' 2>/dev/null || true; } | awk -F '\t' '
    {
      p = $2; nom = p; sub(/.*\//, "", nom)
      e = ""
      if (match(nom, /\.[^.]+$/) && RSTART > 1) e = tolower(substr(nom, RSTART + 1))
      image = (e ~ /^(png|webp|jpg|jpeg|gif|svg|ico|avif)$/)
      if ($1 == "d") c = "site-autres"
      else if (p ~ /^_serveur\//) c = "site-code"
      else if (image && p ~ /(^|\/)portraits\//) c = "images"
      else if ((p ~ /^donnees\// && e != "html") || e == "db" || nom == "search-index.json" || p == "fiche/regles.json") c = "site-donnees"
      else if (image) c = "site-images"
      else if (e ~ /^(html|js|mjs|cjs|css|json|map)$/) c = "site-code"
      else c = "site-autres"
      s[c] += $3 * 512
    }
    END { printf "%.0f %.0f %.0f %.0f %.0f\n", s["site-code"], s["site-donnees"], s["site-images"], s["site-autres"], s["images"] }'
}

# Un chemin est-il sous un dossier (ou ce dossier lui-même) ?
sous() { case "$1/" in "$2"/*) return 0 ;; *) return 1 ;; esac; }
positif() { if [ "$1" -gt 0 ]; then echo "$1"; else echo 0; fi; }

# Le disque des instances : celui de la jauge (le même que le service voit sous /db). Une mesure faite sur un autre disque est rangée à part
# (hors_disque), jamais dans la jauge.
read -r DISQUE_TOTAL DISQUE_UTILISE DISQUE_LIBRE DISQUE_MONTAGE < <(df -P -B1 "$PREMIERE" | awk 'NR == 2 { print $2, $3, $4, $6 }')
APPAREIL=$(stat -c %d "$PREMIERE")

ELEMENTS=()   # cle|nom|instance|chemin|octets
HORS=()       # cle|nom|instance|chemin|octets
# ajouter <cle> <nom> <instance> <chemin> <octets> : un élément de la jauge (rien s'il est vide).
ajouter() {
  local octets=$5
  [ "$octets" -gt 0 ] || return 0
  local appareil
  appareil=$(stat -c %d "$4" 2>/dev/null || echo "$APPAREIL")
  if [ "$appareil" = "$APPAREIL" ]; then ELEMENTS+=("$1|$2|$3|$4|$octets"); else HORS+=("$1|$2|$3|$4|$octets"); fi
}

# Les instances, chacune sous son nom (MAVERICK_INSTANCE de son .env : prod, dev ; celui que le service donne à ses propres mesures) : base vivante
# et archives, lots de mise à jour, fichiers du site par clé ; le reste du dossier (docker-compose.yml, nginx.conf, .env, scripts, dossiers) va
# avec les autres fichiers du site, les journaux des scripts et les restes d'une installation à part.
for R in "${INSTANCES[@]}"; do
  [ -d "$R" ] || continue
  nom=$(reglage "$R" MAVERICK_INSTANCE)
  [ -n "$nom" ] || nom=$(basename "$R")
  total=$(occupe "$R")
  # « db/ » : un lien vers un autre dossier est suivi (installateur.sh l'accepte) ; il ne compte alors pas dans le total du dossier de l'instance.
  db=$(occupe "$R/db/")
  db_dans_total=$db
  if [ -L "$R/db" ]; then db_dans_total=0; fi
  vivante=$(occupe "$R"/db/vivante.db "$R"/db/vivante.db-wal "$R"/db/vivante.db-shm)
  archives=$(occupe "$R/db/archives")
  lots=$(occupe "$R/db/mise-a-jour")
  metriques_db=0
  metriques_dossier=0
  if sous "$METRIQUES" "$R/db"; then metriques_db=$(occupe "$METRIQUES"); elif sous "$METRIQUES" "$R"; then metriques_dossier=$(occupe "$METRIQUES"); fi
  read -r code donnees images_site autres_site portraits < <(fichiers_du_site "$R/site")
  site=$((code + donnees + images_site + autres_site + portraits))
  journaux=$(occupe "$R"/*.log)
  restes=$(occupe "$R"/.installation.* "$R"/.db.copie.*)
  ajouter base "base vivante" "$nom" "$R/db/vivante.db" "$vivante"
  ajouter base "archives de la base vivante" "$nom" "$R/db/archives" "$archives"
  ajouter base "autres fichiers de db/" "$nom" "$R/db" "$(positif $((db - vivante - archives - lots - metriques_db)))"
  ajouter images "portraits publiés du site" "$nom" "$R/site" "$portraits"
  ajouter mises-a-jour "lots figés de la mise à jour" "$nom" "$R/db/mise-a-jour" "$lots"
  ajouter site-code "code du site" "$nom" "$R/site" "$code"
  ajouter site-donnees "données du site" "$nom" "$R/site" "$donnees"
  ajouter site-images "images du site" "$nom" "$R/site" "$images_site"
  ajouter site-autres "autres fichiers du site" "$nom" "$R/site" "$autres_site"
  ajouter site-autres "réglages, scripts et dossiers de l'instance" "$nom" "$R" \
    "$(positif $((total - db_dans_total - metriques_dossier - site - journaux - restes)))"
  ajouter journaux "journaux des scripts (*.log)" "$nom" "$R" "$journaux"
  ajouter installations "installation en cours ou interrompue" "$nom" "$R" "$restes"
done

# Les métriques des deux instances (prod.db, dev.db et ce fichier), une seule fois.
ajouter metriques "bases des métriques" "" "$METRIQUES" "$(occupe "$METRIQUES")"

# Docker : images et conteneurs (tout son dossier, sans changer de disque : ni les montages des conteneurs, ni leurs dossiers), journaux à part.
DOCKER=${MAVERICK_DIR_DOCKER:-}
if [ -z "$DOCKER" ] && command -v docker >/dev/null 2>&1; then
  DOCKER=$( { timeout 20 docker info --format '{{.DockerRootDir}}' 2>/dev/null || true; } | head -n 1)
fi
[ -n "$DOCKER" ] || DOCKER=/var/lib/docker
if [ -d "$DOCKER" ]; then
  docker_total=$(occupe "$DOCKER")
  docker_journaux=$(occupe_fichiers "$DOCKER/containers" -name '*-json.log*')
  ajouter docker "images, conteneurs et volumes" "" "$DOCKER" "$(positif $((docker_total - docker_journaux)))"
  ajouter journaux "journaux des conteneurs (docker logs)" "" "$DOCKER/containers" "$docker_journaux"
fi

# Le reste de l'hôte qu'on sait nommer : journaux du système (journal de systemd, Caddy, mises à jour), téléchargements des mises à jour
# automatiques, installateurs copiés à la main, sauvegardes de la base vivante faites à la main (deploy/vps/README.md, « Sauvegardes »).
ajouter journaux "journaux du système" "" "$VARLOG" "$(occupe "$VARLOG")"
ajouter installations "téléchargements de mise-a-jour.sh et update-site.sh" "" "$TMP_HOTE" \
  "$(occupe "$TMP_HOTE"/maverick-mise-a-jour.* "$TMP_HOTE"/maverick-update.*)"
ajouter installations "installateurs copiés à la main" "" "$MAISONS" \
  "$(occupe "$RACINE_ROOT"/maverick-center-*-install.sh "$MAISONS"/*/maverick-center-*-install.sh)"
ajouter base "sauvegardes à la main (vivante-*.db)" "" "$RACINE_ROOT" "$(occupe "$RACINE_ROOT"/vivante-*.db)"

# ---------------------------------------------------------------------------------------------------------------------------------------------
# Écriture. « repartition » : les clés dans l'ordre de la jauge ; « autres » = total − libre − réserve − les clés comptées (système, paquets,
# Caddy…), « reserve » = la réserve de root, comme chez le service ; la somme fait exactement « total », sauf si les clés comptées dépassent la
# place prise (« depasse »).
# ---------------------------------------------------------------------------------------------------------------------------------------------
json() {
  local s=${1//\\/\\\\}
  s=${s//\"/\\\"}
  printf '"%s"' "$(printf '%s' "$s" | tr -d '\000-\037')"
}
element() {
  local cle nom inst chemin octets
  IFS='|' read -r cle nom inst chemin octets <<< "$1"
  printf '{ "cle": "%s", "nom": %s, "instance": %s, "chemin": %s, "octets": %s }' "$cle" "$(json "$nom")" \
    "$(if [ -n "$inst" ]; then json "$inst"; else printf null; fi)" "$(json "$chemin")" "$octets"
}
CLES=(base images mises-a-jour metriques site-code site-donnees site-images site-autres docker journaux installations)
declare -A LIBELLES=(
  [base]="Base de données" [images]="Images importées" [mises-a-jour]="Mises à jour" [metriques]="Métriques" [site-code]="Code du site"
  [site-donnees]="Données du site" [site-images]="Images du site" [site-autres]="Autres fichiers du site"
  [docker]="Docker (images et conteneurs)" [journaux]="Journaux" [installations]="Installations et copies"
  [autres]="Système et autres" [reserve]="Réservé au système" [libre]="Libre"
)
declare -A SOMMES=()
for e in "${ELEMENTS[@]}"; do
  IFS='|' read -r cle _ _ _ octets <<< "$e"
  SOMMES[$cle]=$(( ${SOMMES[$cle]:-0} + octets ))
done
compte=0
for cle in "${CLES[@]}"; do compte=$(( compte + ${SOMMES[$cle]:-0} )); done
# la réserve de root (blocs libres que le système de fichiers garde : df ne les compte ni dans Used ni dans Avail) à part, comme chez le service :
# la place prise est alors celle de df (Used)
DISQUE_RESERVE=$(positif $((DISQUE_TOTAL - DISQUE_UTILISE - DISQUE_LIBRE)))
occupe_disque=$(positif $((DISQUE_TOTAL - DISQUE_LIBRE - DISQUE_RESERVE)))
SOMMES[autres]=$(positif $((occupe_disque - compte)))
SOMMES[reserve]=$DISQUE_RESERVE
SOMMES[libre]=$DISQUE_LIBRE
duree_ms=$(( ($(date +%s%N) - debut_ns) / 1000000 ))

provisoire="$SORTIE.$$.tmp"
trap 'rm -f "$provisoire"' EXIT
{
  printf '{\n  "format": 1,\n  "instant": "%s",\n  "duree_ms": %s,\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$duree_ms"
  printf '  "disque": { "dossier": %s, "point_de_montage": %s, "total": %s, "utilise": %s, "libre": %s, "reserve": %s },\n' \
    "$(json "$PREMIERE")" "$(json "$DISQUE_MONTAGE")" "$DISQUE_TOTAL" "$DISQUE_UTILISE" "$DISQUE_LIBRE" "$DISQUE_RESERVE"
  if [ "$compte" -gt "$occupe_disque" ]; then
    printf '  "depasse": { "compte": %s, "occupe": %s },\n' "$compte" "$occupe_disque"
  else
    printf '  "depasse": null,\n'
  fi
  printf '  "repartition": ['
  separateur=
  for cle in "${CLES[@]}" autres reserve libre; do
    printf '%s\n    { "cle": "%s", "libelle": %s, "octets": %s }' "$separateur" "$cle" "$(json "${LIBELLES[$cle]}")" "${SOMMES[$cle]:-0}"
    separateur=,
  done
  printf '\n  ],\n  "elements": ['
  separateur=
  for e in "${ELEMENTS[@]}"; do
    printf '%s\n    %s' "$separateur" "$(element "$e")"
    separateur=,
  done
  if [ -n "$separateur" ]; then printf '\n  '; fi
  printf '],\n  "hors_disque": ['
  separateur=
  for e in "${HORS[@]}"; do
    printf '%s\n    %s' "$separateur" "$(element "$e")"
    separateur=,
  done
  if [ -n "$separateur" ]; then printf '\n  '; fi
  printf ']\n}\n'
} > "$provisoire"
chmod 644 "$provisoire"
mv -f "$provisoire" "$SORTIE"
trap - EXIT
