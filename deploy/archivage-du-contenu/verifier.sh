#!/usr/bin/env bash
# Vérifie une archive faite par archiver.sh contre ses manifestes (lot 12, R296 ; docs/chantier-base-de-dev.md, « Le jour J du lot 12 »). Lecture seule.
#
#   verifier.sh <dossier> [--commit <commit>]
#
# <dossier> est un contenu-<commit>-<date>/ (ARCHIVE.txt, une archive et un manifeste par catégorie, SHA256SUMS) ou un publications-<date>/ (publications.manifeste).
# Contrôles : SHA256SUMS ; pour chaque catégorie annoncée, la présence de l'archive et de son manifeste, le sha256 de l'archive, le commit identique partout (et
# égal à --commit s'il est donné), le nombre de fichiers et d'octets, et, après dépaquetage dans un dossier temporaire, chaque fichier (chemin, taille, sha256), sans
# fichier de trop ni manquant ; pour les publications, chaque fichier (présence, taille, sha256) et le nombre de publications et de fichiers.
# Code de sortie : 0 = aucun écart ; 1 = au moins un écart (chacun est écrit) ; 2 = usage. Rien n'est écrit hors d'un dossier temporaire effacé à la fin.
set -uo pipefail
umask 077

usage() { sed -n '2,6p' "$0" | sed 's/^# \{0,1\}//' >&2; exit 2; }
DOSSIER='' COMMIT=''
while [ $# -gt 0 ]; do
  case $1 in
    --commit) [ $# -ge 2 ] || usage; COMMIT=$2; shift ;;
    -h|--help) usage ;;
    -*) echo "verifier : option inconnue : $1" >&2; usage ;;
    *) [ -z "$DOSSIER" ] || usage; DOSSIER=$1 ;;
  esac
  shift
done
[ -n "$DOSSIER" ] || usage
[ -d "$DOSSIER" ] || { echo "verifier : dossier introuvable : $DOSSIER" >&2; exit 2; }
DOSSIER=$(cd "$DOSSIER" && pwd -P)
for outil in sha256sum tar stat find sort; do command -v "$outil" >/dev/null 2>&1 || { echo "verifier : $outil est absent" >&2; exit 2; }; done

ECARTS=0
ecart() { ECARTS=$((ECARTS + 1)); echo "verifier : ÉCART : $*"; }
TEMP=$(mktemp -d)
trap 'rm -rf "$TEMP"' EXIT

valeur() { sed -n "s/^$2=//p" "$1" | head -n 1; } # fichier clé
lignes_du() { sed '1,/^---$/d' "$1"; }           # les lignes de fichiers d'un manifeste (après « --- »)
FICHIERS_VERIFIES=0
ARCHIVES_VERIFIEES=0

verifier_les_lignes() { # étiquette racine lignes : chaque ligne « sha256 TAB taille TAB chemin [TAB …] » existe sous racine, à la bonne taille et au bon sha256
  local etiquette=$1 racine=$2 lignes=$3 h t c autres
  while IFS=$'\t' read -r h t c autres; do
    [ -n "$c" ] || continue
    case $c in /*|*..*) ecart "$etiquette : chemin refusé dans le manifeste : $c"; continue ;; esac
    if [ ! -f "$racine/$c" ]; then ecart "$etiquette : $c manque"; continue; fi
    [ "$(stat -c %s "$racine/$c")" = "$t" ] || ecart "$etiquette : $c : taille $(stat -c %s "$racine/$c"), le manifeste dit $t"
    [ "$(sha256sum "$racine/$c" | cut -d' ' -f1)" = "$h" ] || ecart "$etiquette : $c : sha256 différent de celui du manifeste"
    FICHIERS_VERIFIES=$((FICHIERS_VERIFIES + 1))
  done < "$lignes"
}

verifier_les_fichiers_en_trop() { # étiquette racine lignes
  local etiquette=$1 racine=$2 lignes=$3 c
  ( cd "$racine" && find . -type f -print | sed 's#^\./##' | LC_ALL=C sort ) > "$TEMP/presents"
  cut -f3 "$lignes" | LC_ALL=C sort > "$TEMP/attendus"
  while IFS= read -r c; do ecart "$etiquette : $c n'est pas au manifeste"; done < <(LC_ALL=C comm -23 "$TEMP/presents" "$TEMP/attendus")
}

verifier_une_categorie() { # dossier nom commit_de_l_archive
  local dossier=$1 nom=$2 sha=$3 m=$1/$2.manifeste
  if [ ! -f "$m" ]; then ecart "$nom : manifeste absent"; return; fi
  local archive; archive=$(valeur "$m" archive)
  if [ "$archive" != "$nom.tar.gz" ] || [ ! -f "$dossier/$archive" ]; then ecart "$nom : archive absente ($nom.tar.gz)"; return; fi
  [ "$(valeur "$m" categorie)" = "$nom" ] || ecart "$nom : le manifeste porte une autre catégorie ($(valeur "$m" categorie))"
  [ "$(valeur "$m" commit)" = "$sha" ] || ecart "$nom : commit du manifeste $(valeur "$m" commit), celui de l'archive $sha"
  [ "$(sha256sum "$dossier/$archive" | cut -d' ' -f1)" = "$(valeur "$m" archive_sha256)" ] || ecart "$nom : sha256 de $archive différent de celui du manifeste"
  lignes_du "$m" > "$TEMP/$nom.lignes"
  local n; n=$(wc -l < "$TEMP/$nom.lignes" | tr -d ' ')
  [ "$n" = "$(valeur "$m" fichiers)" ] || ecart "$nom : $n fichiers listés, le manifeste en annonce $(valeur "$m" fichiers)"
  [ "$(awk -F'\t' '{ s += $2 } END { print s + 0 }' "$TEMP/$nom.lignes")" = "$(valeur "$m" octets)" ] || ecart "$nom : le total d'octets listés diffère de celui du manifeste"
  # des noms sûrs dans l'archive avant de la dépaquer
  # la liste d'abord dans un fichier, puis grep (un grep -q qui sort tôt ferait échouer tar par SIGPIPE sous pipefail)
  tar -tzf "$dossier/$archive" > "$TEMP/$nom.noms" 2> "$TEMP/tar.err" || true
  if grep -Eq '^/|(^|/)\.\.(/|$)' "$TEMP/$nom.noms"; then ecart "$nom : l'archive contient un chemin absolu ou remontant"; return; fi
  if [ -s "$TEMP/tar.err" ]; then ecart "$nom : archive illisible : $(tr '\n' ' ' < "$TEMP/tar.err" | cut -c1-200)"; return; fi
  rm -rf "${TEMP:?}/extrait-$nom"
  mkdir "$TEMP/extrait-$nom"
  tar -xzf "$dossier/$archive" -C "$TEMP/extrait-$nom" --no-same-owner 2>/dev/null || { ecart "$nom : dépaquetage impossible"; return; }
  verifier_les_lignes "$nom" "$TEMP/extrait-$nom" "$TEMP/$nom.lignes"
  verifier_les_fichiers_en_trop "$nom" "$TEMP/extrait-$nom" "$TEMP/$nom.lignes"
  rm -rf "${TEMP:?}/extrait-$nom"
  ARCHIVES_VERIFIEES=$((ARCHIVES_VERIFIEES + 1))
}

verifier_le_contenu() {
  local d=$DOSSIER a=$DOSSIER/ARCHIVE.txt
  local sha; sha=$(valeur "$a" commit)
  case $sha in *[!0-9a-f]*|'') ecart "ARCHIVE.txt : commit illisible ($sha)" ;; esac
  [ ${#sha} -eq 40 ] || ecart "ARCHIVE.txt : le commit n'a pas 40 caractères ($sha)"
  if [ -n "$COMMIT" ]; then
    case $sha in "$COMMIT"*) [ ${#COMMIT} -ge 7 ] || ecart "--commit trop court ($COMMIT) : 7 caractères au moins" ;; *) ecart "commit de l'archive $sha, attendu $COMMIT" ;; esac
  fi
  if [ ! -f "$d/SHA256SUMS" ]; then ecart "SHA256SUMS absent"
  elif ! ( cd "$d" && sha256sum -c --quiet SHA256SUMS > "$TEMP/sums" 2>&1 ); then
    while IFS= read -r l; do ecart "SHA256SUMS : $l"; done < "$TEMP/sums"
  fi
  local categories; categories=$(valeur "$a" categories)
  [ -n "$categories" ] || ecart "ARCHIVE.txt : aucune catégorie annoncée"
  local nom
  for nom in rows migrations-donnees sources-raw; do
    case " $categories " in *" $nom "*) ;; *) ecart "$nom : catégorie absente de l'archive (ARCHIVE.txt : $categories)" ;; esac
  done
  [ "$(valeur "$a" avec_mixtes)" != 1 ] || case " $categories " in *" migrations-mixtes "*) ;; *) ecart "migrations-mixtes : annoncée par avec_mixtes=1, absente de l'archive" ;; esac
  for nom in $categories; do verifier_une_categorie "$d" "$nom" "$sha"; done
  local f
  for f in "$d"/*.tar.gz "$d"/*.manifeste; do
    [ -e "$f" ] || continue
    nom=$(basename "$f"); nom=${nom%.tar.gz}; nom=${nom%.manifeste}
    case " $categories " in *" $nom "*) ;; *) ecart "$(basename "$f") : fichier d'une catégorie que ARCHIVE.txt n'annonce pas" ;; esac
  done
  SOMMAIRE="contenu : $ARCHIVES_VERIFIEES archives, $FICHIERS_VERIFIES fichiers, commit $sha"
}

verifier_les_publications() {
  local d=$DOSSIER m=$DOSSIER/publications.manifeste
  lignes_du "$m" > "$TEMP/publications.lignes"
  local n; n=$(wc -l < "$TEMP/publications.lignes" | tr -d ' ')
  [ "$n" = "$(valeur "$m" fichiers)" ] || ecart "publications : $n fichiers listés, le manifeste en annonce $(valeur "$m" fichiers)"
  [ "$(awk -F'\t' '{ s += $2 } END { printf "%.0f", s }' "$TEMP/publications.lignes")" = "$(valeur "$m" octets)" ] || ecart "publications : le total d'octets listés diffère de celui du manifeste"
  if [ ! -f "$d/releases.tsv" ]; then ecart "releases.tsv absent"
  else
    [ "$(sha256sum "$d/releases.tsv" | cut -d' ' -f1)" = "$(valeur "$m" releases_sha256)" ] || ecart "releases.tsv : sha256 différent de celui du manifeste"
    [ "$(wc -l < "$d/releases.tsv" | tr -d ' ')" = "$(valeur "$m" publications)" ] || ecart "releases.tsv : $(wc -l < "$d/releases.tsv" | tr -d ' ') publications, le manifeste en annonce $(valeur "$m" publications)"
  fi
  if [ ! -f "$d/releases.json" ]; then ecart "releases.json absent"
  else [ "$(sha256sum "$d/releases.json" | cut -d' ' -f1)" = "$(valeur "$m" releases_json_sha256)" ] || ecart "releases.json : sha256 différent de celui du manifeste"
  fi
  verifier_les_lignes publications "$d" "$TEMP/publications.lignes"
  # releases.tsv, releases.json et le manifeste sont les seuls fichiers de ce dossier qui ne sont pas des publications
  ( cd "$d" && find . -type f -print | sed 's#^\./##' | LC_ALL=C sort ) | grep -vxE 'releases.tsv|releases.json|publications.manifeste' > "$TEMP/presents"
  cut -f3 "$TEMP/publications.lignes" | LC_ALL=C sort > "$TEMP/attendus"
  local c
  while IFS= read -r c; do ecart "publications : $c n'est pas au manifeste"; done < <(LC_ALL=C comm -23 "$TEMP/presents" "$TEMP/attendus")
  SOMMAIRE="publications : $n fichiers, $(valeur "$m" publications) publications"
}

SOMMAIRE=''
RIEN=1
if [ -f "$DOSSIER/ARCHIVE.txt" ]; then RIEN=0; verifier_le_contenu; fi
if [ -f "$DOSSIER/publications.manifeste" ]; then RIEN=0; verifier_les_publications; fi
if [ "$RIEN" -eq 1 ]; then ecart "ni ARCHIVE.txt ni publications.manifeste dans $DOSSIER : ce n'est pas une archive d'archiver.sh"; fi

if [ "$ECARTS" -eq 0 ]; then
  echo "verifier : OK — $SOMMAIRE"
  exit 0
fi
echo "verifier : $ECARTS écart(s) — l'archive n'est pas bonne"
exit 1
