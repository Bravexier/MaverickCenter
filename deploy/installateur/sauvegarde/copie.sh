#!/usr/bin/env bash
# Copies locales de la base des deux instances (temps 1 des sauvegardes automatiques ; deploy/vps/README.md, « Sauvegardes »).
#
#   copie.sh horaire [prod] [dev]   copie seulement si db/ a changé depuis la dernière copie (minuteur maverick-sauvegarde-horaire)
#   copie.sh nuit    [prod] [dev]   copie toujours (minuteur maverick-sauvegarde-nuit, qui enchaîne l'envoi chiffré : envoi.sh)
#   copie.sh accepter <instance>    accepte la copie mise de côté la plus récente comme nouvelle référence (après une alerte jugée normale)
#   copie.sh etat                   réécrit seulement metriques/sauvegardes.json
#
# Ce que fait une copie, par instance :
#   - tout le dossier db/ de l'instance, hors metriques/ et essai-de-structure/ (l'échange avec le service pour l'essai d'une livraison, copies transitoires) : chaque base SQLite (.db, .sqlite, .sqlite3, hors archives/) par l'interface de sauvegarde de
#     SQLite (« .backup », connexion en lecture seule : cohérente même si le service écrit), les autres fichiers tels quels (un fichier identique à
#     celui de la copie précédente en est un lien dur : les archives ne coûtent la place qu'une fois) ; le contenu de db/ n'est jamais modifié et rien
#     n'y est créé (source_a_ouvrir : une base WAL sans écrivain est ouverte « immutable ») ;
#   - le contrôle de la copie : PRAGMA integrity_check, puis le nombre de lignes de chaque table (comptes.tsv) comparé à celui de la copie
#     précédente : une table qui avait au moins CHUTE_MIN_LIGNES lignes et en perd plus de CHUTE_POURCENT % est une « chute anormale » ;
#   - alerte (intégrité, chute, copie impossible) : la nouvelle copie est mise de côté dans suspectes/ et les copies précédentes ne sont ni remplacées
#     ni tournées ; l'alerte reste jusqu'à une copie saine ou « accepter » ;
#   - plafond : place prise par les copies (PLAFOND_MO) et espace libre minimal du disque (LIBRE_MIN_MO) ; au-delà, les copies les plus anciennes
#     (jamais les deux dernières de chaque sorte) sont d'abord retirées ; si cela ne suffit pas, rien n'est écrit et l'alerte le dit ;
#   - rotation : HORAIRES_GARDEES copies horaires, NUITS_GARDEES de nuit, SUSPECTES_GARDEES mises de côté, par instance (seulement après une
#     copie saine). Les copies mensuelles et par version sont celles de l'envoi extérieur (envoi.sh).
# Codes de sortie : 0 = rien à signaler, 3 = alerte ou copie refusée (l'état et le journal du minuteur le disent), 1 = erreur.
# Dossiers et réglages : lib.sh. Aucun secret n'est lu ni écrit ici.
set -euo pipefail
umask 077

ICI=$(cd "$(dirname "$0")" && pwd)
# shellcheck source=lib.sh
. "$ICI/lib.sh"

usage() { echo "Usage : copie.sh horaire|nuit [prod] [dev] | accepter <prod|dev> | etat" >&2; exit 2; }
MODE=${1:-}
[ -n "$MODE" ] || usage
shift
CIBLES=$*
[ -n "$CIBLES" ] || CIBLES=$INSTANCES
for c in $CIBLES; do case "$c" in prod|dev) ;; *) usage ;; esac; done

command -v sqlite3 >/dev/null 2>&1 || { echec "sqlite3 est absent (apt-get install sqlite3)"; exit 1; }
STATUT=0
charger_reglages
PLAFOND=$((PLAFOND_MO * 1048576))
LIBRE_MIN=$((LIBRE_MIN_MO * 1048576))
ATTENTE=${MAVERICK_SAUV_ATTENTE:-2}

mkdir -p "$SAUV" "$ETAT"
chmod 700 "$SAUV" "$ETAT"

alerter() { # instance code detail niveau(alerte|refusee)
  local etat=$ETAT/$1.env detail
  detail=$(nettoyer_detail "$3")
  etat_poser_tout "$etat" ALERTE_LE "$(instant)" ALERTE_CODE "$2" ALERTE_DETAIL "$detail" ALERTE_EN_COURS 1 VERIF_LE "$(instant)" VERIF_RESULTAT "${4:-alerte}"
  echec "$1 : $2 ($detail)"
  STATUT=3
}

# Empreinte de db/ (noms, tailles, dates de modification) : ne lit aucun contenu, n'écrit rien.
signature_de() {
  (cd "$1" && find . -type f ! -path './metriques/*' ! -path './essai-de-structure/*' -printf '%P %s %T@\n' | sort | sha256sum | cut -d ' ' -f 1)
}

# Les dossiers (chemins complets) d'un dossier de copies, du plus ancien au plus récent.
dossiers_de() {
  [ -d "$1" ] || return 0
  find "$1" -mindepth 1 -maxdepth 1 -type d ! -name 'en-cours.*' | awk -F/ '{ print $NF "\t" $0 }' | sort | cut -f2
}

# Le plus ancien dossier qu'on peut retirer pour faire de la place : d'abord les copies mises de côté (sauf la dernière), puis les horaires, puis les
# nuits (sauf les deux dernières de chaque sorte, par instance). Jamais la dernière copie bonne.
candidat_a_rogner() {
  local categorie inst garde liste n premier meilleur
  for categorie in suspectes horaire nuit; do
    meilleur=''
    for inst in $INSTANCES; do
      garde=2
      [ "$categorie" = suspectes ] && garde=1
      liste=$(dossiers_de "$SAUV/$inst/$categorie")
      n=$(printf '%s' "$liste" | grep -c . || true)
      if [ "$n" -gt "$garde" ]; then
        premier=$(printf '%s\n' "$liste" | head -n 1)
        if [ -z "$meilleur" ] || [ "$(basename "$premier")" \< "$(basename "$meilleur")" ]; then meilleur=$premier; fi
      fi
    done
    if [ -n "$meilleur" ]; then printf '%s\n' "$meilleur"; return 0; fi
  done
  return 1
}

# Fait de la place pour `besoin` octets : 0 si le plafond et l'espace libre minimal tiennent, sinon 1 (code de la cause dans PLACE_CODE).
PLACE_CODE=''
faire_de_la_place() {
  local besoin=$1 occupe libre retire
  while :; do
    occupe=$(octets_de "$SAUV/prod" "$SAUV/dev")
    libre=$(libre_octets "$SAUV")
    PLACE_CODE=''
    [ $((occupe + besoin)) -le "$PLAFOND" ] || PLACE_CODE=plafond
    if [ -n "$libre" ] && [ $((libre - besoin)) -lt "$LIBRE_MIN" ]; then PLACE_CODE=${PLACE_CODE:-disque_plein}; fi
    [ -n "$PLACE_CODE" ] || return 0
    retire=$(candidat_a_rogner) || return 1
    journal "place insuffisante ($PLACE_CODE) : retrait de la plus ancienne copie, $retire"
    rm -rf "$retire"
  done
}

# Comment ouvrir une base source. Une base en mode WAL (octet 18 de son en-tête = 2) dont le -wal n'existe pas n'a aucun écrivain : même ouverte en
# lecture seule, SQLite y créerait un -wal et un -shm vides ; on l'ouvre donc « immutable » (URI), ce qui ne crée rien. Sinon (mode journal normal,
# celui du service, ou WAL tenue ouverte par lui, dont les fichiers existent) : ouverture en lecture seule ordinaire, qui ne crée rien non plus.
source_a_ouvrir() { # base : le nom à donner à sqlite3
  local base=$1 mode
  mode=$(od -An -tu1 -j18 -N1 "$base" 2>/dev/null | tr -d ' ' || true)
  if [ "$mode" = 2 ] && [ ! -e "$base-wal" ]; then
    printf 'file:%s?immutable=1' "$(printf '%s' "$base" | sed 's/%/%25/g; s/?/%3F/g; s/#/%23/g')"
  else
    printf '%s' "$base"
  fi
}

# Une base SQLite copiée par l'interface de sauvegarde (lecture seule côté source), jusqu'à 3 essais (une base occupée par une écriture).
sauvegarder_base() { # source cible
  local essai source
  case "$2" in *"'"*) return 1 ;; esac
  mkdir -p "$(dirname "$2")"
  source=$(source_a_ouvrir "$1")
  for essai in 1 2 3; do
    if sqlite3 -readonly -cmd '.timeout 10000' "$source" ".backup '$2'" >/dev/null 2>&1; then
      # Un écrivain a ouvert la base pendant la copie « immutable » (un -wal est apparu) : cette copie n'est pas sûre, on la refait par la voie ordinaire.
      if [ "$source" != "$1" ] && [ -e "$1-wal" ]; then rm -f "$2"; source=$1; continue; fi
      return 0
    fi
    rm -f "$2"
    [ "$essai" -lt 3 ] && sleep "$ATTENTE"
  done
  return 1
}

# Un fichier ordinaire : lien dur sur le fichier identique de la copie précédente, sinon copie.
copier_simple() { # source cible fichier_de_reference
  mkdir -p "$(dirname "$2")"
  if [ -f "$3" ] && [ ! -L "$3" ] && cmp -s "$1" "$3" && ln "$3" "$2" 2>/dev/null; then return 0; fi
  cp -p "$1" "$2"
}

# Les chutes de lignes de `nouveau` par rapport à `reference` (fichiers comptes.tsv) : « base:table avant>après », une par ligne.
chutes() {
  [ -s "$1" ] || return 0
  awk -F'\t' -v pct="$CHUTE_POURCENT" -v min="$CHUTE_MIN_LIGNES" '
    NR == FNR { ref[$1 "\t" $2] = $3; next }
    { nouv[$1 "\t" $2] = $3 }
    END {
      for (k in ref) {
        r = ref[k] + 0; n = (k in nouv) ? nouv[k] + 0 : 0
        if (r >= min && n * 100 < r * (100 - pct)) { split(k, a, "\t"); printf "%s:%s %d>%d\n", a[1], a[2], r, n }
      }
    }' "$1" "$2" | sort
}

garder_les() { # dossier nombre : ne garde que les `nombre` plus récents
  local n=$2 total liste
  [ "$n" -ge 1 ] || n=1
  liste=$(dossiers_de "$1")
  total=$(printf '%s' "$liste" | grep -c . || true)
  if [ "$total" -gt "$n" ]; then printf '%s\n' "$liste" | head -n "$((total - n))" | while IFS= read -r d; do rm -rf "$d"; done; fi
}
rotation() {
  garder_les "$SAUV/$1/horaire" "$HORAIRES_GARDEES"
  garder_les "$SAUV/$1/nuit" "$NUITS_GARDEES"
  garder_les "$SAUV/$1/suspectes" "$SUSPECTES_GARDEES"
}

copier_instance() { # instance type
  local inst=$1 type=$2 dossier db etat maintenant sig precedente refcomptes tmp nom rel besoin total version detail lignes
  dossier=$(dossier_de "$inst")
  db=$dossier/db
  etat=$ETAT/$inst.env
  maintenant=$(instant)
  mkdir -p "$SAUV/$inst/horaire" "$SAUV/$inst/nuit" "$SAUV/$inst/suspectes"
  chmod 700 "$SAUV/$inst" "$SAUV/$inst/horaire" "$SAUV/$inst/nuit" "$SAUV/$inst/suspectes"
  rm -rf "$SAUV/$inst"/en-cours.*
  precedente=$(derniere_copie "$inst")
  refcomptes=''
  if [ -n "$precedente" ]; then refcomptes=$SAUV/$inst/$precedente/comptes.tsv; fi

  # Pas de db/, ou un db/ sans aucun fichier : rien à copier (une alerte si une copie précédente existe : une base ne disparaît pas toute seule).
  if [ ! -d "$db" ] || [ -z "$(find "$db" -type f ! -path "$db/metriques/*" ! -path "$db/essai-de-structure/*" -print -quit)" ]; then
    if [ -n "$precedente" ]; then alerter "$inst" base_absente "le dossier db/ de l'instance est absent ou vide" alerte
    else etat_poser_tout "$etat" VERIF_LE "$maintenant" VERIF_RESULTAT sans_base; journal "$inst : pas de base dans db/, rien à copier"; fi
    return 0
  fi

  sig=$(signature_de "$db")
  if [ "$type" = horaire ] && { [ "$sig" = "$(etat_lire "$etat" COPIE_SIGNATURE)" ] || [ "$sig" = "$(etat_lire "$etat" SUSPECTE_SIGNATURE)" ]; }; then
    etat_poser_tout "$etat" VERIF_LE "$maintenant" VERIF_RESULTAT inchangee
    journal "$inst : db/ n'a pas changé depuis la dernière copie"
    return 0
  fi

  # La place : la taille de db/ (borne haute : les liens durs ne la prendront pas tous).
  besoin=$( { du -s -B1 --exclude=metriques --exclude=essai-de-structure "$db" 2>/dev/null || echo 0; } | cut -f1)
  if ! faire_de_la_place "$besoin"; then
    alerter "$inst" "$PLACE_CODE" "copie non écrite : $((besoin / 1048576)) Mo à copier, plafond $PLAFOND_MO Mo, libre minimal $LIBRE_MIN_MO Mo" refusee
    return 0
  fi

  nom=$(nom_de_copie "$maintenant")
  tmp=$SAUV/$inst/en-cours.$$
  EN_COURS=$tmp
  mkdir -p "$tmp/db"
  : > "$tmp/comptes.tsv"
  bases_de "$db" > "$tmp/bases.liste"
  # 1. les bases SQLite
  while IFS= read -r rel; do
    [ -n "$rel" ] || continue
    if ! sauvegarder_base "$db/$rel" "$tmp/db/$rel"; then
      rm -rf "$tmp"
      alerter "$inst" copie_impossible "la sauvegarde SQLite de $rel a échoué" alerte
      return 0
    fi
    detail=$(controle_integrite "$tmp/db/$rel")
    if [ "$detail" != ok ]; then
      mettre_de_cote "$inst" "$nom" "$tmp" "$sig"
      alerter "$inst" integrite "$rel : $detail" alerte
      return 0
    fi
    comptes_de "$tmp/db/$rel" "$rel" >> "$tmp/comptes.tsv"
  done < "$tmp/bases.liste"
  # (le contrôle a pu ouvrir une copie en mode WAL : ses -wal et -shm ne font pas partie de la copie)
  find "$tmp/db" -type f \( -name '*-wal' -o -name '*-shm' -o -name '*-journal' \) -delete
  # 2. tous les autres fichiers, tels quels
  (cd "$db" && find . -type f ! -path './metriques/*' ! -path './essai-de-structure/*' ! -name '*-wal' ! -name '*-shm' ! -name '*-journal' -print | sed 's|^\./||' | sort) > "$tmp/fichiers.liste"
  while IFS= read -r rel; do
    [ -n "$rel" ] || continue
    if grep -qxF -- "$rel" "$tmp/bases.liste"; then continue; fi
    copier_simple "$db/$rel" "$tmp/db/$rel" "${precedente:+$SAUV/$inst/$precedente/db/$rel}"
  done < "$tmp/fichiers.liste"
  rm -f "$tmp/bases.liste" "$tmp/fichiers.liste"

  total=$(awk -F'\t' '{ s += $3 } END { print s + 0 }' "$tmp/comptes.tsv")
  lignes=$(chutes "$refcomptes" "$tmp/comptes.tsv" | head -n 3 | tr '\n' ';')
  if [ -n "$lignes" ]; then
    detail="$(chutes "$refcomptes" "$tmp/comptes.tsv" | wc -l | tr -d ' ') table(s) : $lignes plus de $CHUTE_POURCENT % de lignes en moins"
    mettre_de_cote "$inst" "$nom" "$tmp" "$sig"
    alerter "$inst" chute_de_lignes "$detail" alerte
    return 0
  fi

  version=''
  [ -f "$dossier/VERSION" ] && version=$(sed -n 's/^tag=//p' "$dossier/VERSION" | head -n 1)
  { echo "INSTANCE=$inst"; echo "TYPE=$type"; echo "INSTANT=$maintenant"; echo "VERSION=$version"; echo "SIGNATURE=$sig"; echo "LIGNES=$total"; } > "$tmp/copie.meta"
  if [ -e "$SAUV/$inst/$type/$nom" ]; then nom=$nom-$$; fi
  mv "$tmp" "$SAUV/$inst/$type/$nom"
  etat_poser_tout "$etat" COPIE_LE "$maintenant" COPIE_TYPE "$type" COPIE_NOM "$nom" COPIE_OCTETS "$(octets_de "$SAUV/$inst/$type/$nom")" \
    COPIE_LIGNES "$total" COPIE_SIGNATURE "$sig" VERIF_LE "$maintenant" VERIF_RESULTAT copiee ALERTE_EN_COURS 0 SUSPECTE_SIGNATURE ''
  rotation "$inst"
  journal "$inst : copie $type $nom, $total lignes"
}

# La copie refusée est gardée à part (suspectes/), jamais mêlée aux bonnes ; la signature de db/ est notée pour ne pas la refaire à l'heure suivante.
mettre_de_cote() { # instance nom tmp signature
  local dest=$SAUV/$1/suspectes/$2
  [ -e "$dest" ] && dest=$dest-$$
  { echo "INSTANCE=$1"; echo "TYPE=suspecte"; echo "INSTANT=$(instant)"; echo "SIGNATURE=$4"; echo "LIGNES=$(awk -F'\t' '{ s += $3 } END { print s + 0 }' "$3/comptes.tsv")"; } > "$3/copie.meta"
  mv "$3" "$dest"
  etat_poser "$ETAT/$1.env" SUSPECTE_SIGNATURE "$4"
  garder_les "$SAUV/$1/suspectes" "$SUSPECTES_GARDEES"
}

accepter() { # instance
  local inst=$1 etat=$ETAT/$1.env dernier nom
  dernier=$(dossiers_de "$SAUV/$inst/suspectes" | tail -n 1)
  [ -n "$dernier" ] || { echec "$inst : aucune copie mise de côté à accepter"; STATUT=1; return 0; }
  nom=$(basename "$dernier")
  [ -e "$SAUV/$inst/horaire/$nom" ] && nom=$nom-$$
  mv "$dernier" "$SAUV/$inst/horaire/$nom"
  # les autres copies mises de côté sont plus anciennes que celle qu'on vient d'accepter : elles n'ont plus de raison d'être
  rm -rf "$SAUV/$inst/suspectes"/*
  etat_poser_tout "$etat" COPIE_LE "$(etat_lire "$SAUV/$inst/horaire/$nom/copie.meta" INSTANT)" COPIE_TYPE horaire COPIE_NOM "$nom" \
    COPIE_OCTETS "$(octets_de "$SAUV/$inst/horaire/$nom")" COPIE_LIGNES "$(etat_lire "$SAUV/$inst/horaire/$nom/copie.meta" LIGNES)" \
    COPIE_SIGNATURE "$(etat_lire "$SAUV/$inst/horaire/$nom/copie.meta" SIGNATURE)" ALERTE_EN_COURS 0 SUSPECTE_SIGNATURE '' VERIF_LE "$(instant)" VERIF_RESULTAT copiee
  rotation "$inst"
  journal "$inst : la copie mise de côté $nom devient la référence"
}

ENFANT=${MAVERICK_SAUV_ENFANT:-0}
EN_COURS=''
# Une copie provisoire ne survit à rien : quoi qu'il arrive (erreur, signal), elle est effacée.
nettoyer_en_cours() { [ -z "$EN_COURS" ] || rm -rf "$EN_COURS"; }
trap nettoyer_en_cours EXIT

case "$MODE" in
  horaire|nuit)
    if [ "$ENFANT" = 1 ]; then
      # Un traitement d'UNE instance, lancé par le traitement principal (qui tient le verrou et écrit l'état).
      copier_instance "${CIBLES%% *}" "$MODE"
      exit "$STATUT"
    fi
    # Le verrou : une copie à la fois (l'envoi de nuit tient le même). La copie de nuit attend plus longtemps l'horaire en cours.
    if [ "$MODE" = nuit ]; then attente=900; else attente=300; fi
    prendre_le_verrou "$attente" || exit 0
    # Chaque instance dans son propre processus : l'échec inattendu de l'une (base trop abîmée, erreur de sqlite3…) ne laisse rien derrière elle
    # (copie provisoire effacée), est noté en alerte, et ne prive jamais l'autre de sa copie.
    for inst in $CIBLES; do
      rc=0
      MAVERICK_SAUV_ENFANT=1 bash "$ICI/copie.sh" "$MODE" "$inst" || rc=$?
      case "$rc" in
        0) ;;
        3) STATUT=3 ;;
        *)
          rm -rf "$SAUV/$inst"/en-cours.*
          alerter "$inst" erreur_interne "le traitement de la copie s'est arrêté de façon inattendue (code $rc) ; voir le journal du minuteur" alerte
          ;;
      esac
    done
    if [ -n "$REGLAGES_ILLISIBLES" ]; then STATUT=3; fi
    ecrire_json
    ;;
  accepter)
    [ "$CIBLES" != "$INSTANCES" ] && [ "$(echo "$CIBLES" | wc -w | tr -d ' ')" = 1 ] || usage
    prendre_le_verrou 300 || exit 0
    accepter "$CIBLES"
    ecrire_json
    ;;
  etat) ecrire_json ;;
  *) usage ;;
esac
exit "$STATUT"
