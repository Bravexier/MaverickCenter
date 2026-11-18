#!/usr/bin/env bash
# Le contrôle d'égalité du déménagement du serveur (DEMENAGEMENT.md). À lancer des DEUX côtés, puis à comparer :
#   sudo bash controle-demenagement.sh bilan [--contenu-seulement] [--sortie <fichier>]
#   bash controle-demenagement.sh comparer <bilan-ancien> <bilan-nouveau>       (EGALITE, code 0 ; DIFFERENCE, code 1 ; usage, code 2)
#
# Le bilan est un texte lisible, une ligne « clé=valeur » par constat ; il ne contient AUCUN secret ni aucun contenu (des empreintes, des nombres, « present »
# ou « absent »). Un secret ne se compare que par sa présence, ses droits et sa taille : son contenu est déjà garanti par le manifeste de l'archive
# (demenagement.sh). Pour chaque instance (normal, test) :
#   fichier.<instance>.<chemin>   empreinte SHA-256 et taille de chaque fichier de db/ (copie « repliée » : voir plus bas)
#   integrite.<instance>          PRAGMA integrity_check de db/vivante.db
#   fiches.<instance>, comptes.<instance>, lignes.<instance>.<table>   nombre de fiches de personnages, de comptes, et de lignes de chaque table
#   contenu.<instance>, logique.<instance>   les empreintes du site lui-même (client/serveur/empreintes.mjs : celles de l'attestation de la production et du
#                                 constat de bascule.sh) : `contenu` = tables de contenu (règles), `logique` = schéma et lignes de TOUTES les tables, fiches
#                                 comprises. Calculées par le service lui-même, dans un conteneur (`docker compose run`, comme bascule.sh), sur la copie
#   marqueur.<instance>           db/source (la base source du site de dev) : présent ou absent, et son contenu dans les lignes « info. »
#   secret.<instance>.<nom>       présent/absent, droits, taille
#   etc.sauvegardes.<nom>, fichier.caddy.certificats, fichier.metriques.nombre, fichier.copies.nombre
#   info.*                        version installée, date, marqueur : lues, jamais comparées
# --contenu-seulement : pour un service EN MARCHE (instantané SQLite, pas de copie d'octets) : sans « fichier.* », « lignes.* » ni « logique.* » (fichiers, sessions et journaux
#                       bougent dès le démarrage) ; restent intégrité, fiches, comptes, `contenu` (les règles), marqueur et secrets. `comparer` n'oppose alors que ces lignes.
#
# Aucune base n'est modifiée : le bilan travaille sur une COPIE de db/ (la « WAL » d'une base arrêtée y est repliée dans le fichier principal, de la même façon des
# deux côtés : deux serveurs au contenu identique ont alors des fichiers identiques, octet pour octet).
# Variables (tests) : MAVERICK_ESSAI=1 (root non exigé), MAVERICK_DIR_NORMAL, MAVERICK_DIR_TEST, MAVERICK_DIR_ETC_SAUVEGARDES, MAVERICK_DIR_SAUVEGARDES,
# MAVERICK_DIR_CADDY_DATA, MAVERICK_SQLITE3 (sqlite3), MAVERICK_DOCKER (docker), MAVERICK_CONTROLE_NODE (une commande node de l'hôte au lieu du conteneur),
# MAVERICK_CONTROLE_EMPREINTES (chemin de empreintes.mjs pour cette commande).
set -euo pipefail
umask 077

NORMAL=${MAVERICK_DIR_NORMAL:-/srv/maverick-center}
TEST=${MAVERICK_DIR_TEST:-/srv/maverick-center-test}
ETC_SAUV=${MAVERICK_DIR_ETC_SAUVEGARDES:-/etc/maverick-sauvegardes}
SAUV=${MAVERICK_DIR_SAUVEGARDES:-/srv/maverick-sauvegardes}
CADDY_DATA=${MAVERICK_DIR_CADDY_DATA:-/var/lib/caddy/.local/share/caddy}
SQLITE3=${MAVERICK_SQLITE3:-sqlite3}
DOCKER=${MAVERICK_DOCKER:-docker}

die() { echo "controle : REFUS : $*" >&2; exit 1; }
usage() {
  echo "Usage : sudo bash $0 bilan [--contenu-seulement] [--sortie <fichier>]" >&2
  echo "        bash $0 comparer <bilan-ancien> <bilan-nouveau>" >&2
  exit 2
}
racine() { [ "${MAVERICK_ESSAI:-0}" = 1 ] || [ "$(id -u)" -eq 0 ] || die "à lancer en root : sudo bash $0 $ACTION"; }

# Copie de db/ : $1 = db/ d'origine, $2 = destination (créée), $3 = « arrete » (défaut : service arrêté, copie « repliée » : le -wal fondu dans le fichier)
# ou « vivant » (service en marche : instantané SQLite de chaque base). Lit l'origine, ne l'écrit jamais.
copier_db() {
  local source=$1 dest=$2 mode=${3:-arrete} f
  mkdir -p "$dest"
  [ -d "$source" ] || return 0
  [ -z "$(find "$source/" -type l -print -quit)" ] || die "$source contient des liens symboliques : copie refusée"
  if [ "$mode" = vivant ]; then
    # Le service tourne : jamais de copie d'octets (une écriture en cours, un -wal à moitié lu). Chaque base est lue par SQLite lui-même, en lecture seule
    # (« .backup » : un instantané cohérent) ; seule vivante.db est lue, aucun fichier n'est créé dans db/.
    while IFS= read -r f; do
      case "$f" in *"'"*) die "nom de fichier refusé : $f" ;; esac
      mkdir -p "$(dirname "$dest/${f#"$source"/}")"
      "$SQLITE3" -readonly "$f" ".backup '$dest/${f#"$source"/}'" || die "la base $(basename "$f") n'a pas pu être lue de façon cohérente"
    done < <(find "$source/" -maxdepth 1 -type f -name vivante.db)   # la base vivante SEULE : ouvrir une archive (db/archives/) créerait des -shm et -wal à côté d'elle, sur un serveur en marche
    return 0
  fi
  cp -a "$source/." "$dest/"
  rm -rf "$dest/essai-de-structure"
  while IFS= read -r f; do
    if [ -e "$f-wal" ] || [ -e "$f-shm" ]; then
      "$SQLITE3" "$f" 'PRAGMA wal_checkpoint(TRUNCATE);' >/dev/null || die "la base $(basename "$f") ne se replie pas (sqlite3 a refusé)"
      [ ! -s "$f-wal" ] || die "le journal -wal de $(basename "$f") n'a pas pu être replié"
      rm -f "$f-wal" "$f-shm"
    fi
  done < <(find "$dest" -type f -name '*.db' | LC_ALL=C sort)
}

sql() { "$SQLITE3" -readonly "$@"; }
une_table_existe() { [ "$(sql "$1" "SELECT count(*) FROM sqlite_master WHERE type = 'table' AND name = '$2';")" = 1 ]; }

# Les deux empreintes du site sur $1 (un fichier vivante.db, copie jetable) : « contenu=… » et « logique=… », ou « indisponible ».
CODE_EMPREINTES="const [, module, base] = process.argv; const { DatabaseSync } = await import('node:sqlite'); const e = await import(module); const db = new DatabaseSync(base, { readOnly: true }); console.log('contenu=' + e.empreintesDuContenu(db).global); console.log('logique=' + e.empreinteLogique(db).empreinte);"
empreintes_du_site() {
  local instance_dir=$1 base=$2 sortie=''
  if [ -n "${MAVERICK_CONTROLE_NODE:-}" ]; then
    # shellcheck disable=SC2086
    sortie=$($MAVERICK_CONTROLE_NODE --input-type=module -e "$CODE_EMPREINTES" "${MAVERICK_CONTROLE_EMPREINTES:?MAVERICK_CONTROLE_EMPREINTES manque}" "$base" 2>/dev/null) || sortie=''
  elif command -v "$DOCKER" >/dev/null 2>&1 && [ -f "$instance_dir/docker-compose.yml" ]; then
    sortie=$(cd "$instance_dir" && "$DOCKER" compose run --rm --no-deps -T -v "$(dirname "$base"):/controle" serveur \
      node --input-type=module -e "$CODE_EMPREINTES" /site/_serveur/serveur/empreintes.mjs "/controle/$(basename "$base")" 2>/dev/null) || sortie=''
  fi
  if printf '%s\n' "$sortie" | grep -q '^contenu=[0-9a-f]\{64\}$' && printf '%s\n' "$sortie" | grep -q '^logique=[0-9a-f]\{64\}$'; then
    printf '%s\n' "$sortie" | grep '^\(contenu\|logique\)='
  else
    echo 'contenu=indisponible'
    echo 'logique=indisponible'
  fi
}

droits_et_taille() { # présent/absent, droits, taille (jamais le contenu)
  if [ -f "$1" ]; then echo "present $(stat -c %a "$1") $(stat -c %s "$1")"; else echo absent; fi
}

bilan() {
  local seulement=$1 sortie=$2 instance dir copie f table nom lignes e out
  travail=$(mktemp -d)
  trap 'rm -rf "$travail"' EXIT
  out=$travail/bilan
  {
    echo "format=maverick-bilan-demenagement/1"
    echo "mode=$([ "$seulement" = 1 ] && echo contenu || echo complet)"
    echo "info.date=$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
  } > "$out"
  for instance in normal test; do
    if [ "$instance" = normal ]; then dir=$NORMAL; else dir=$TEST; fi
    [ -d "$dir" ] || die "$dir introuvable (instance $instance)"
    copie=$travail/$instance/db
    copier_db "$dir/db" "$copie" "$([ "$seulement" = 1 ] && echo vivant || echo arrete)"
    sed -n 's/^\(tag\|version\|mode\)=\(.*\)$/info.'"$instance"'.\1=\2/p' "$dir/VERSION" 2>/dev/null >> "$out" || true
    if [ "$seulement" = 0 ]; then
      while IFS= read -r f; do
        echo "fichier.$instance.${f#"$copie"/}=$(sha256sum "$f" | cut -d' ' -f1) $(stat -c %s "$f")" >> "$out"
      done < <(find "$copie" -type f | LC_ALL=C sort)
    fi
    if [ -f "$copie/vivante.db" ]; then
      echo "integrite.$instance=$(sql "$copie/vivante.db" 'PRAGMA integrity_check;' | head -n 1)" >> "$out"
      for table in personnage utilisateur; do
        nom=fiches; [ "$table" = utilisateur ] && nom=comptes
        if une_table_existe "$copie/vivante.db" "$table"; then lignes=$(sql "$copie/vivante.db" "SELECT count(*) FROM $table;"); else lignes=sans-table; fi
        echo "$nom.$instance=$lignes" >> "$out"
      done
      if [ "$seulement" = 0 ]; then
        while IFS= read -r table; do
          case "$table" in ''|*[!A-Za-z0-9_]*) continue ;; esac   # un nom de table se vérifie avant d'être écrit dans une requête
          echo "lignes.$instance.$table=$(sql "$copie/vivante.db" "SELECT count(*) FROM \"$table\";")" >> "$out"
        done < <(sql "$copie/vivante.db" "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name;")
      fi
      e=$(empreintes_du_site "$dir" "$copie/vivante.db")
      if [ "$seulement" = 1 ]; then e=$(printf '%s\n' "$e" | grep '^contenu='); fi
      printf '%s\n' "$e" | sed "s/^\\([a-z]*\\)=/\\1.$instance=/" >> "$out"
    else
      echo "integrite.$instance=sans-base" >> "$out"
    fi
    if [ -f "$dir/db/source" ] && [ ! -L "$dir/db/source" ]; then
      echo "marqueur.$instance=present" >> "$out"
      head -c 2000 "$dir/db/source" | head -n 8 | sed "s/^/info.marqueur.$instance: /" >> "$out"
    else
      echo "marqueur.$instance=absent" >> "$out"
    fi
  done
  for nom in .env .github-token mise-a-jour.env; do
    echo "secret.normal.$nom=$(droits_et_taille "$NORMAL/$nom")" >> "$out"
    echo "secret.test.$nom=$(droits_et_taille "$TEST/$nom")" >> "$out"
  done
  for nom in acces.json github-actions-token; do echo "secret.test.secrets/$nom=$(droits_et_taille "$TEST/secrets/$nom")" >> "$out"; done
  for nom in stockage.env cle-depot reglages.env; do echo "etc.sauvegardes.$nom=$(droits_et_taille "$ETC_SAUV/$nom")" >> "$out"; done
  if [ "$seulement" = 0 ]; then
    echo "fichier.caddy.certificats=$( [ -d "$CADDY_DATA" ] && find "$CADDY_DATA" -type f -name '*.crt' | wc -l || echo 0 )" >> "$out"
    echo "fichier.metriques.nombre=$( [ -d "$NORMAL/metriques" ] && find "$NORMAL/metriques" -type f ! -name volume-hote.json | wc -l || echo 0 )" >> "$out"
    echo "fichier.copies.nombre=$( [ -d "$SAUV" ] && find "$SAUV" -type f | wc -l || echo 0 )" >> "$out"
  fi
  LC_ALL=C sort "$out" -o "$out"
  if [ -n "$sortie" ]; then cp "$out" "$sortie"; chmod 600 "$sortie"; if [ "$(id -u)" -eq 0 ] && [ -n "${SUDO_USER:-}" ]; then chown "$SUDO_USER" "$sortie"; fi; echo "bilan écrit : $sortie ($(wc -l < "$out") lignes)"; else cat "$out"; fi
}

comparer() {
  local a=$1 b=$2 k v l n=0 ecarts=0 lignes_ecart=''
  [ -f "$a" ] && [ -f "$b" ] || die "bilan introuvable ($a, $b)"
  declare -A va vb
  while IFS= read -r l; do [ -n "$l" ] || continue; va["${l%%=*}"]=${l#*=}; done < "$a"
  while IFS= read -r l; do [ -n "$l" ] || continue; vb["${l%%=*}"]=${l#*=}; done < "$b"
  [ "${va[format]:-}" = "${vb[format]:-}" ] || die "les deux fichiers ne sont pas des bilans du même format"
  # --contenu-seulement d'un côté (le service a démarré : ses fichiers, ses journaux et ses sessions ont bougé) : seul ce qui ne bouge pas se compare
  local partiel=0
  { [ "${va[mode]:-}" = contenu ] || [ "${vb[mode]:-}" = contenu ]; } && partiel=1
  while IFS= read -r k; do
    case "$k" in info.*|mode) continue ;; fichier.*|lignes.*|logique.*) [ "$partiel" = 0 ] || continue ;; esac
    n=$((n + 1))
    v=''
    if [ -z "${va[$k]+x}" ]; then v="absente du bilan ancien (nouveau : ${vb[$k]})"
    elif [ -z "${vb[$k]+x}" ]; then v="absente du bilan nouveau (ancien : ${va[$k]})"
    elif [ "${va[$k]}" != "${vb[$k]}" ]; then v="ancien : ${va[$k]} | nouveau : ${vb[$k]}"
    elif [ "${va[$k]}" = indisponible ]; then v="non vérifiée des deux côtés (indisponible)"
    fi
    if [ -n "$v" ]; then ecarts=$((ecarts + 1)); lignes_ecart="$lignes_ecart  $k : $v"$'\n'; fi
  done < <(printf '%s\n' "${!va[@]}" "${!vb[@]}" | LC_ALL=C sort -u)
  if [ "$ecarts" -eq 0 ]; then
    echo "EGALITE ($n constats comparés)"
  else
    echo "DIFFERENCE ($ecarts écart(s) sur $n constats)"
    printf '%s' "$lignes_ecart"
    return 1
  fi
}

ACTION=${1:-}
[ -n "$ACTION" ] || usage
shift
case "$ACTION" in
  bilan)
    SEULEMENT=0
    SORTIE=''
    while [ $# -gt 0 ]; do
      case "$1" in
        --contenu-seulement) SEULEMENT=1; shift ;;
        --sortie) [ $# -ge 2 ] || usage; SORTIE=$2; shift 2 ;;
        *) usage ;;
      esac
    done
    racine
    command -v "$SQLITE3" >/dev/null 2>&1 || die "sqlite3 est absent (sudo apt-get install -y sqlite3)"
    bilan "$SEULEMENT" "$SORTIE"
    ;;
  comparer) [ $# -eq 2 ] || usage; comparer "$1" "$2" ;;
  copier-db) [ $# -eq 2 ] || usage; racine; copier_db "$1" "$2" ;;   # interne : demenagement.sh emballe la même copie repliée
  *) usage ;;
esac
