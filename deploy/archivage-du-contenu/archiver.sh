#!/usr/bin/env bash
# Archive de ce qui sort du dépôt au lot 12 (R296 ; docs/chantier-base-de-dev.md, « Le jour J du lot 12 »). ÉTEINT : rien ne se fait sans --jour-j.
#
#   archiver.sh --jour-j --depot <clone git> --commit <commit> --vers <dossier> [--avec-mixtes] [--liste <fichier>] [--publications]
#   archiver.sh --jour-j --vers <dossier> --publications-seules [--depot-github <proprietaire/nom>]
#
# Le contenu : une archive par catégorie (lignes des tables, migrations de données, exports des sources ; avec --avec-mixtes, les migrations qui mêlent DDL et
# données, à part) dans <vers>/contenu-<commit>-<date>/, lue DANS LE COMMIT (git archive : jamais l'arbre de travail), avec un manifeste par archive (chemin,
# taille, sha256), le commit source et la date, puis contrôlée par verifier.sh. Les catégories et leurs règles sont celles de l'inventaire
# (client/scripts/lister-ce-qui-sort.mjs, qui lit client/scripts/inventaire-sortie-du-contenu-lib.mjs) : node ≥ 22.13 est requis, et le clone doit être posé sur le
# commit (git -C <clone> checkout --detach <commit>) pour que l'outil de liste soit celui du commit. Sans node sur la machine : --liste <fichier>, la sortie de cet outil
# faite ailleurs (mêmes options : --ref <commit>, et --avec-mixtes si besoin) ; seuls data/rows/, data/migrations/ et sources/raw/ sont acceptés, et chaque fichier est
# recompté dans le commit.
# Les publications (--publications, ou --publications-seules sans clone) : les fichiers de chaque publication GitHub (GET seulement : gh api), dans
# <vers>/publications-<date>/<étiquette>/, avec leur sha256 (comparé à celui que GitHub donne quand il en donne un). Volumineuses (de l'ordre de 10 Go) : à part.
#
# Garde-fous : rien sans --jour-j ; une archive qui échoue est effacée (la relance n'est pas refusée) ; la destination est un dossier existant, hors du dépôt, donné à chaque fois (jamais de défaut ; ex. /srv/maverick-archives) ;
# aucune écriture dans le dépôt (le clone n'est que lu) ; aucun appel réseau autre que « gh api » en GET ; une destination déjà utilisée n'est pas réécrite.
# Réglages de test : MAVERICK_ARCHIVAGE_LISTE (chemin d'un autre outil de liste), MAVERICK_ARCHIVAGE_GH (la commande gh).
# Codes de sortie : 0 fait, 1 échec, 2 refus ou usage.
set -euo pipefail
umask 077

ICI=$(cd "$(dirname "$0")" && pwd)
GH=${MAVERICK_ARCHIVAGE_GH:-gh}
DEPOT_GITHUB_PAR_DEFAUT=Bravexier/MaverickCenter

usage() { sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//' >&2; exit 2; }
refuser() { echo "archiver : refus : $*" >&2; exit 2; }
echouer() { echo "archiver : $*" >&2; exit 1; }

JOUR_J=0 DEPOT='' COMMIT='' VERS='' LISTE_FOURNIE='' MIXTES=0 PUBLICATIONS=0 SEULES=0 DEPOT_GITHUB=$DEPOT_GITHUB_PAR_DEFAUT
while [ $# -gt 0 ]; do
  case $1 in
    --jour-j) JOUR_J=1 ;;
    --depot) [ $# -ge 2 ] || usage; DEPOT=$2; shift ;;
    --commit) [ $# -ge 2 ] || usage; COMMIT=$2; shift ;;
    --vers) [ $# -ge 2 ] || usage; VERS=$2; shift ;;
    --avec-mixtes) MIXTES=1 ;;
    --liste) [ $# -ge 2 ] || usage; LISTE_FOURNIE=$2; shift ;;
    --publications) PUBLICATIONS=1 ;;
    --publications-seules) PUBLICATIONS=1; SEULES=1 ;;
    --depot-github) [ $# -ge 2 ] || usage; DEPOT_GITHUB=$2; shift ;;
    -h|--help) usage ;;
    *) echo "archiver : option inconnue : $1" >&2; usage ;;
  esac
  shift
done

# Éteint : le geste du jour J se dit en toutes lettres.
[ "$JOUR_J" -eq 1 ] || refuser "ce script est éteint hors du jour J du lot 12 : sans --jour-j, il ne fait rien (docs/chantier-base-de-dev.md, « Le jour J du lot 12 »)"
[ -n "$VERS" ] || refuser "--vers <dossier> est obligatoire (aucune destination par défaut ; ex. /srv/maverick-archives)"
case $VERS in /*) ;; *) refuser "--vers doit être un chemin absolu : $VERS" ;; esac
[ -d "$VERS" ] || refuser "la destination n'existe pas : $VERS (le dossier se crée avant, par le propriétaire)"
VERS=$(cd "$VERS" && pwd -P)
if [ "$SEULES" -eq 0 ]; then
  [ -n "$DEPOT" ] || refuser "--depot <clone git> est obligatoire (ou --publications-seules)"
  [ -n "$COMMIT" ] || refuser "--commit <commit> est obligatoire : l'archive est lue dans un commit, jamais dans l'arbre de travail"
  [ -d "$DEPOT" ] || refuser "le clone n'existe pas : $DEPOT"
  DEPOT=$(cd "$DEPOT" && pwd -P)
fi

# La destination n'est jamais dans un dépôt git (ni le clone, ni celui de ces scripts) : aucune écriture dans le dépôt.
dans_un_depot() { git -C "$1" rev-parse --show-toplevel >/dev/null 2>&1; }
dans_un_depot "$VERS" && refuser "la destination est dans un dépôt git ($VERS) : une archive ne s'écrit jamais dans le dépôt"
[ -z "$DEPOT" ] || case "$VERS/" in "$DEPOT"/*) refuser "la destination est dans le clone ($VERS)" ;; esac
ICI_DEPOT=$(git -C "$ICI" rev-parse --show-toplevel 2>/dev/null || true)
[ -z "$ICI_DEPOT" ] || case "$VERS/" in "$ICI_DEPOT"/*) refuser "la destination est dans le dépôt de ces scripts ($ICI_DEPOT)" ;; esac

for outil in sha256sum tar gzip df stat find sort xargs; do command -v "$outil" >/dev/null 2>&1 || echouer "$outil est absent"; done
DATE=$(date -u +%Y%m%d)
HORODATAGE=$(date -u +%Y-%m-%dT%H:%M:%SZ)
EN_COURS=$(mktemp -d "$VERS/.archivage-en-cours.XXXXXX")
# DEST_EN_COURS : le dossier d'archive que CE passage est en train d'écrire (jamais une archive déjà complète). S'il échoue, il est effacé : une archive à demi
# faite ne reste pas, et la relance n'est pas refusée (« existe déjà »). Il est vidé de cette variable dès que l'archive est complète et vérifiée.
DEST_EN_COURS=''
nettoyer() { rm -rf "$EN_COURS"; [ -z "$DEST_EN_COURS" ] || rm -rf "$DEST_EN_COURS"; }
trap nettoyer EXIT

libre_en_octets() { df -Pk "$VERS" | awk 'NR==2 { print $4 * 1024 }'; }
exiger_de_la_place() { # besoin_en_octets
  local libre; libre=$(libre_en_octets)
  [ "$libre" -ge "$1" ] || echouer "place insuffisante sur $VERS : $libre octets libres, $1 nécessaires"
}

# ───────────────────────────── le contenu ─────────────────────────────
archiver_le_contenu() {
  command -v git >/dev/null 2>&1 || echouer "git est absent"
  [ -n "$LISTE_FOURNIE" ] || command -v node >/dev/null 2>&1 || echouer "node (≥ 22.13) est absent : il classe les migrations (l'outil de liste est celui de l'inventaire) ; ou --liste <fichier>"
  local sha lister
  sha=$(git -C "$DEPOT" rev-parse --verify --quiet "$COMMIT^{commit}") || refuser "commit introuvable dans $DEPOT : $COMMIT"
  if [ -n "$LISTE_FOURNIE" ]; then
    [ -f "$LISTE_FOURNIE" ] || refuser "la liste n'existe pas : $LISTE_FOURNIE"
    lister=''
  elif [ -n "${MAVERICK_ARCHIVAGE_LISTE:-}" ]; then
    lister=$MAVERICK_ARCHIVAGE_LISTE
  else
    lister=$DEPOT/client/scripts/lister-ce-qui-sort.mjs
    [ "$(git -C "$DEPOT" rev-parse HEAD)" = "$sha" ] || refuser "le clone n'est pas posé sur $sha : git -C $DEPOT checkout --detach $sha"
  fi
  [ -z "$lister" ] || [ -f "$lister" ] || echouer "outil de liste introuvable : $lister"

  local dest=$VERS/contenu-${sha:0:12}-$DATE
  [ ! -e "$dest" ] || refuser "$dest existe déjà : une archive n'est jamais réécrite"
  local liste=$EN_COURS/liste.tsv
  local options=(--racine "$DEPOT" --ref "$sha")
  [ "$MIXTES" -eq 0 ] || options+=(--avec-mixtes)
  if [ -n "$LISTE_FOURNIE" ]; then
    cp "$LISTE_FOURNIE" "$liste"
    [ "$MIXTES" -eq 0 ] || grep -q '^migrations_mixtes'$'\t' "$liste" || refuser "--avec-mixtes : la liste fournie ne porte aucune migration mixte (la refaire avec --avec-mixtes)"
    [ "$MIXTES" -eq 1 ] || ! grep -q '^migrations_mixtes'$'\t' "$liste" || refuser "la liste fournie porte des migrations mixtes : --avec-mixtes les demande en toutes lettres"
    awk -F'\t' '$1 !~ /^(rows|migrations_donnees|migrations_mixtes|sources_raw)$/ || $2 !~ /^(data\/rows\/|data\/migrations\/|sources\/raw\/)/ || $3 !~ /^[0-9]+$/ { exit 1 }' "$liste" || refuser "la liste fournie porte une ligne hors des trois catégories (ou hors de data/rows/, data/migrations/, sources/raw/)"
  else
    node --no-warnings "$lister" "${options[@]}" > "$liste" || echouer "la liste de ce qui sort n'a pas pu être établie"
  fi
  [ -s "$liste" ] || refuser "rien à archiver dans $sha (le contenu est-il déjà sorti du dépôt ?)"
  if grep -q $'\r' "$liste"; then echouer "un chemin contient un retour chariot"; fi
  local total; total=$(awk -F'\t' '{ s += $3 } END { print s + 0 }' "$liste")
  exiger_de_la_place $((total * 3 + 10485760))

  mkdir "$dest"
  DEST_EN_COURS=$dest
  chmod 700 "$dest"
  local categories=''
  local cat
  for cat in rows migrations_donnees migrations_mixtes sources_raw; do
    awk -F'\t' -v c="$cat" '$1 == c' "$liste" > "$EN_COURS/$cat.tsv"
    [ -s "$EN_COURS/$cat.tsv" ] || continue
    local nom=${cat//_/-}
    local chemins=()
    mapfile -t chemins < <(cut -f2 "$EN_COURS/$cat.tsv")
    git --literal-pathspecs -C "$DEPOT" archive --format=tar "$sha" -- "${chemins[@]}" | gzip -n -9 > "$dest/$nom.tar.gz"
    # Le manifeste est écrit d'après ce que l'archive contient vraiment : elle est dépaquetée, chaque fichier est compté, pesé et haché.
    local extrait=$EN_COURS/extrait-$nom
    mkdir "$extrait"
    tar -xzf "$dest/$nom.tar.gz" -C "$extrait" --no-same-owner
    local lignes=$EN_COURS/$nom.lignes
    ( cd "$extrait" && find . -type f -print0 | LC_ALL=C sort -z | xargs -0 sha256sum ) | while IFS= read -r l; do
      local h=${l%% *} c=${l#*  }
      c=${c#./}
      printf '%s\t%s\t%s\n' "$h" "$(stat -c %s "$extrait/$c")" "$c"
    done > "$lignes"
    # Contrôle croisé avec la liste du commit : mêmes chemins, mêmes tailles (une conversion de fin de ligne par git archive se verrait ici).
    LC_ALL=C sort -t $'\t' -k3,3 "$lignes" | cut -f2,3 > "$EN_COURS/$nom.vu"
    awk -F'\t' '{ print $3 "\t" $2 }' "$EN_COURS/$cat.tsv" | LC_ALL=C sort -t $'\t' -k2,2 > "$EN_COURS/$nom.attendu"
    cmp -s "$EN_COURS/$nom.vu" "$EN_COURS/$nom.attendu" || echouer "$nom : l'archive ne contient pas exactement ce que le commit liste (chemins ou tailles différents)"
    local n; n=$(wc -l < "$lignes" | tr -d ' ')
    local octets; octets=$(awk -F'\t' '{ s += $2 } END { print s + 0 }' "$lignes")
    {
      echo "# manifeste d'une archive du contenu (verifier.sh le relit)"
      echo "categorie=$nom"
      echo "commit=$sha"
      echo "date=$HORODATAGE"
      echo "archive=$nom.tar.gz"
      echo "archive_sha256=$(sha256sum "$dest/$nom.tar.gz" | cut -d' ' -f1)"
      echo "fichiers=$n"
      echo "octets=$octets"
      echo '---'
      cat "$lignes"
    } > "$dest/$nom.manifeste"
    categories="$categories $nom"
    rm -rf "$extrait"
    echo "archiver : $nom : $n fichiers, $octets octets"
  done

  {
    echo "# archive du contenu sorti du dépôt (lot 12, R296)"
    echo "commit=$sha"
    echo "commit_date=$(git -C "$DEPOT" show -s --format=%cI "$sha")"
    echo "date=$HORODATAGE"
    echo "categories=${categories# }"
    echo "avec_mixtes=$MIXTES"
  } > "$dest/ARCHIVE.txt"
  ( cd "$dest" && sha256sum -- *.tar.gz *.manifeste ARCHIVE.txt > SHA256SUMS )
  echo "archiver : contenu rangé dans $dest (commit $sha)"
  bash "$ICI/verifier.sh" "$dest" --commit "$sha" || echouer "la vérification de l'archive vient d'échouer : $dest est effacé"
  DEST_EN_COURS=''
}

# ───────────────────────────── les publications ─────────────────────────────
# Seul appel réseau du script : gh api en lecture (GET). Un argument qui ferait écrire sur GitHub est refusé avant l'appel.
gh_lire() {
  local a
  for a in "$@"; do
    case $a in -X|--method|-f|-F|--field|--raw-field|--input|--method=*) echouer "gh_lire : $a écrirait sur GitHub : refusé" ;; esac
  done
  "$GH" api "$@"
}

archiver_les_publications() {
  command -v "$GH" >/dev/null 2>&1 || echouer "gh est absent (GET des publications : gh api ; GH_TOKEN dans l'environnement, jamais en argument)"
  local dest=$VERS/publications-$DATE
  [ ! -e "$dest" ] || refuser "$dest existe déjà : une archive n'est jamais réécrite"
  local releases=$EN_COURS/releases.tsv assets=$EN_COURS/assets.tsv
  gh_lire --paginate "repos/$DEPOT_GITHUB/releases?per_page=100" \
    --jq '.[] | [.id, .tag_name, (.prerelease|tostring), (.draft|tostring), (.assets|length), .created_at] | @tsv' > "$releases" || echouer "la liste des publications n'a pas pu être lue"
  gh_lire --paginate "repos/$DEPOT_GITHUB/releases?per_page=100" \
    --jq '.[] | . as $r | .assets[] | [$r.id, $r.tag_name, (.id|tostring), .name, (.size|tostring), (.digest // "")] | @tsv' > "$assets" || echouer "la liste des fichiers des publications n'a pas pu être lue"
  gh_lire --paginate "repos/$DEPOT_GITHUB/releases?per_page=100" > "$EN_COURS/releases.json" || echouer "la description des publications n'a pas pu être lue"
  [ -s "$releases" ] || refuser "aucune publication sur $DEPOT_GITHUB"
  local etiquette
  while IFS=$'\t' read -r _ etiquette _; do
    case $etiquette in */*|*..*|'') echouer "étiquette de publication refusée : $etiquette" ;; esac
  done < "$releases"
  local total; total=$(awk -F'\t' '{ s += $5 } END { printf "%.0f", s }' "$assets")
  exiger_de_la_place $((total + total / 20 + 104857600))
  echo "archiver : $(wc -l < "$releases" | tr -d ' ') publications, $(wc -l < "$assets" | tr -d ' ') fichiers, $total octets à télécharger"

  mkdir "$dest"
  DEST_EN_COURS=$dest
  chmod 700 "$dest"
  local lignes=$EN_COURS/publications.lignes
  : > "$lignes"
  local rid tag asset nom taille digest fichier h
  while IFS=$'\t' read -r rid tag asset nom taille digest; do
    case $nom in */*|*..*|'') echouer "nom de fichier refusé : $nom" ;; esac
    mkdir -p "$dest/$tag"
    fichier=$dest/$tag/$nom
    gh_lire -H 'Accept: application/octet-stream' "repos/$DEPOT_GITHUB/releases/assets/$asset" > "$fichier.partiel" || echouer "$tag/$nom : téléchargement impossible"
    [ "$(stat -c %s "$fichier.partiel")" = "$taille" ] || echouer "$tag/$nom : $(stat -c %s "$fichier.partiel") octets reçus, $taille annoncés"
    mv "$fichier.partiel" "$fichier"
    h=$(sha256sum "$fichier" | cut -d' ' -f1)
    if [ -n "$digest" ]; then
      [ "sha256:$h" = "$digest" ] || echouer "$tag/$nom : sha256 différent de celui que GitHub annonce ($digest)"
      printf '%s\t%s\t%s/%s\t%s\t%s\n' "$h" "$taille" "$tag" "$nom" "$rid" "annonce" >> "$lignes"
    else
      printf '%s\t%s\t%s/%s\t%s\t%s\n' "$h" "$taille" "$tag" "$nom" "$rid" "non-annonce" >> "$lignes"
    fi
  done < "$assets"
  cp "$releases" "$dest/releases.tsv"
  cp "$EN_COURS/releases.json" "$dest/releases.json"
  local n; n=$(wc -l < "$lignes" | tr -d ' ')
  {
    echo "# manifeste des publications GitHub (verifier.sh le relit) ; releases.tsv : id, étiquette, pré-publication, brouillon, nombre de fichiers, date ; releases.json : la réponse complète de l'API (titres, descriptions)"
    echo "depot_github=$DEPOT_GITHUB"
    echo "date=$HORODATAGE"
    echo "publications=$(wc -l < "$releases" | tr -d ' ')"
    echo "fichiers=$n"
    echo "octets=$total"
    echo "releases_sha256=$(sha256sum "$dest/releases.tsv" | cut -d' ' -f1)"
    echo "releases_json_sha256=$(sha256sum "$dest/releases.json" | cut -d' ' -f1)"
    echo '---'
    cat "$lignes"
  } > "$dest/publications.manifeste"
  echo "archiver : publications rangées dans $dest"
  bash "$ICI/verifier.sh" "$dest" || echouer "la vérification des publications vient d'échouer : $dest est effacé"
  DEST_EN_COURS=''
}

[ "$SEULES" -eq 1 ] || archiver_le_contenu
[ "$PUBLICATIONS" -eq 0 ] || archiver_les_publications
echo "archiver : fait. Le propriétaire garde et vérifie : verifier.sh <dossier>."
