#!/bin/sh
# Installateur du site Maverick Center, étiquette @@TAG@@ (version @@VERSION@@, commit @@SHA@@), mode @@MODE@@.
# FABRIQUÉ par deploy/installateur/fabriquer.mjs à partir de deploy/installateur/installateur.sh : ne pas l'éditer, il est régénéré à chaque livraison.
# Hébergement à partir de la 1.0 (serveur normal et serveur de test, voir docs/flux-git.md) ; le NAS d'avant la 1.0 a sa propre installation (deploy/).
# Le site (déjà construit) est dans ce fichier même, sous la ligne __ARCHIVE__ : rien n'est téléchargé, aucun jeton n'est nécessaire.
#
# Usage : sh <ce-fichier> [--dossier <dossier>] [--dossier-prod <dossier>] [--sans-base-prod] [--verifier]
#   --dossier       dossier de l'instance (défaut : ./maverick-center en prod, ./maverick-center-test en test)
#   --dossier-prod  test seulement : instance de production dont on copie la base (défaut : le voisin « maverick-center »)
#   --sans-base-prod  test seulement : accepter qu'il n'y ait pas d'instance de production (base de test vide)
#   --verifier      contrôler l'archive intégrée et s'arrêter (rien n'est installé)
#
# Une instance = un dossier :
#   site/                le site statique (remplacé à chaque installation ; nginx le relit sans redémarrage)
#   db/                  la base vivante de l'instance (le service des personnages y écrit). Production : jamais touchée par une installation.
#                        Test : son contenu est remplacé à chaque installation par une copie, à cet instant, du db/ de la production.
#   docker-compose.yml, nginx.conf   posés s'ils sont absents ; s'ils diffèrent, la version livrée est écrite à côté (.nouveau)
#   .env                 port et nom du conteneur de l'instance (créé une fois, jamais écrasé)
#   .htpasswd            mots de passe (jamais touché)
#   VERSION              ce qui est installé (étiquette, version, commit, mode, date)
# Prérequis : sh, tar, gzip, et sha256sum (ou shasum / openssl) pour contrôler l'archive. rsync et sqlite3 sont utilisés s'ils sont présents.
set -eu
umask 022

TAG='@@TAG@@'
VERSION='@@VERSION@@'
COMMIT='@@SHA@@'
MODE='@@MODE@@'
ARCHIVE_SHA256='@@ARCHIVE_SHA256@@'
PAGES_ATTENDUES='@@PAGES@@'

INSTALLATEUR=$0
USE_RSYNC=${USE_RSYNC:-auto}
NOM_PROD=maverick-center

usage() { echo "Usage : sh $INSTALLATEUR [--dossier <dossier>] [--dossier-prod <dossier>] [--sans-base-prod] [--verifier]" >&2; exit 2; }

DOSSIER=''
DOSSIER_PROD=''
SANS_BASE_PROD=0
VERIFIER=0
while [ $# -gt 0 ]; do
  case "$1" in
    --dossier) [ $# -ge 2 ] || usage; DOSSIER=$2; shift 2 ;;
    --dossier-prod) [ $# -ge 2 ] || usage; DOSSIER_PROD=$2; shift 2 ;;
    --sans-base-prod) SANS_BASE_PROD=1; shift ;;
    --verifier) VERIFIER=1; shift ;;
    *) usage ;;
  esac
done

JOURNAL=''
log() {
  ligne="$(date '+%Y-%m-%d %H:%M:%S') [$TAG] $*"
  echo "$ligne"
  if [ -n "$JOURNAL" ]; then echo "$ligne" >> "$JOURNAL" 2>/dev/null || true; fi
}
die() { log "ERREUR : $*"; exit 1; }

# ---------------------------------------------------------------- archive intégrée
LIGNE=$(awk '/^__ARCHIVE__$/ { print NR; exit }' "$INSTALLATEUR")
[ -n "$LIGNE" ] || die "archive introuvable dans $INSTALLATEUR (fichier tronqué ?)"
archive() { tail -n +"$((LIGNE + 1))" "$INSTALLATEUR"; }

if command -v sha256sum >/dev/null 2>&1; then EMPREINTE=$(archive | sha256sum | cut -d ' ' -f 1)
elif command -v shasum >/dev/null 2>&1; then EMPREINTE=$(archive | shasum -a 256 | cut -d ' ' -f 1)
elif command -v openssl >/dev/null 2>&1; then EMPREINTE=$(archive | openssl dgst -sha256 | sed 's/^.*= *//')
else EMPREINTE=''
fi
if [ -n "$EMPREINTE" ]; then
  [ "$EMPREINTE" = "$ARCHIVE_SHA256" ] || die "archive corrompue (empreinte SHA-256 inattendue) : retéléchargez l'installateur"
else
  log "Avertissement : ni sha256sum, ni shasum, ni openssl : l'empreinte de l'archive n'est pas contrôlée (seule sa lisibilité l'est)."
  archive | gzip -t 2>/dev/null || die "archive illisible : retéléchargez l'installateur"
fi
if [ "$VERIFIER" -eq 1 ]; then
  echo "Installateur $TAG (mode $MODE, version $VERSION, commit $COMMIT) : archive intègre, $PAGES_ATTENDUES pages."
  exit 0
fi

# ---------------------------------------------------------------- dossiers
case "$MODE" in
  prod) DEFAUT=$NOM_PROD ;;
  test) DEFAUT=$NOM_PROD-test ;;
  *) die "mode inconnu « $MODE »" ;;
esac
[ -n "$DOSSIER" ] || DOSSIER="$(pwd)/$DEFAUT"
mkdir -p "$DOSSIER" || die "impossible de créer $DOSSIER"
DOSSIER=$(cd "$DOSSIER" && pwd -P)
case "$DOSSIER" in /|//) die "refus d'installer à la racine du système : précisez --dossier <dossier de l'instance>" ;; esac
JOURNAL="$DOSSIER/installation.log"

# Mode d'une instance : celui de son fichier VERSION. Un dossier qui a déjà un site sans VERSION (installé autrement) compte comme une
# production : un installateur de test refuse de l'écraser.
mode_de() {
  if [ -f "$1/VERSION" ]; then sed -n 's/^mode=//p' "$1/VERSION" | head -n 1
  elif [ -d "$1/site" ]; then echo prod
  fi
}
EXISTANT=$(mode_de "$DOSSIER")
if [ -n "$EXISTANT" ] && [ "$EXISTANT" != "$MODE" ]; then
  die "$DOSSIER est une instance « $EXISTANT » : un installateur « $MODE » refuse de l'écraser"
fi

if [ "$MODE" = test ]; then
  [ -n "$DOSSIER_PROD" ] || DOSSIER_PROD="$(dirname "$DOSSIER")/$NOM_PROD"
  if [ -d "$DOSSIER_PROD" ]; then
    DOSSIER_PROD=$(cd "$DOSSIER_PROD" && pwd -P)
    [ "$DOSSIER_PROD" != "$DOSSIER" ] || die "le serveur de test ne peut pas s'installer dans le dossier de la production ($DOSSIER)"
    [ "$(mode_de "$DOSSIER_PROD")" = prod ] || die "$DOSSIER_PROD n'est pas une instance de production (fichier VERSION) : précisez --dossier-prod"
  elif [ "$SANS_BASE_PROD" -eq 1 ]; then
    DOSSIER_PROD=''
  else
    die "instance de production introuvable ($DOSSIER_PROD) : précisez --dossier-prod <dossier>, ou --sans-base-prod pour une base de test vide"
  fi
fi

# ---------------------------------------------------------------- un seul exemplaire à la fois
VERROU="$DOSSIER/.installation.lock"
if ! mkdir "$VERROU" 2>/dev/null; then
  AUTRE=$(cat "$VERROU/pid" 2>/dev/null || true)
  if [ -n "$AUTRE" ] && kill -0 "$AUTRE" 2>/dev/null; then die "une installation est déjà en cours dans $DOSSIER (PID $AUTRE)"; fi
  rm -rf "$VERROU"
  mkdir "$VERROU" || die "impossible de créer le verrou $VERROU"
fi
echo "$$" > "$VERROU/pid"
TRAVAIL="$DOSSIER/.installation.$$"
nettoyer() { rm -rf "$TRAVAIL" "$DOSSIER/.db.copie.$$" "$VERROU"; }
trap nettoyer EXIT
trap 'exit 1' INT TERM HUP

log "Installation $MODE dans $DOSSIER (version $VERSION, commit $(echo "$COMMIT" | cut -c1-7))."
mkdir "$TRAVAIL"
# -o : ne pas reprendre le propriétaire enregistré dans l'archive (celui de la machine qui l'a fabriquée), même en root.
archive | gzip -dc | tar -xof - -C "$TRAVAIL" || die "extraction de l'archive impossible"
[ -f "$TRAVAIL/site/index.html" ] || die "archive refusée : pas de site/index.html (rien n'a été modifié)"
PAGES=$(find "$TRAVAIL/site" -name index.html | wc -l | tr -d ' ')
[ "$PAGES" -eq "$PAGES_ATTENDUES" ] || die "archive refusée : $PAGES pages au lieu de $PAGES_ATTENDUES (rien n'a été modifié)"

# ---------------------------------------------------------------- base (avant le site : en cas d'échec, rien n'a changé)
if [ "$MODE" = prod ]; then
  mkdir -p "$DOSSIER/db"
else
  COPIE="$DOSSIER/.db.copie.$$"
  mkdir "$COPIE"
  SOURCE="$DOSSIER_PROD/db"
  if [ -z "$DOSSIER_PROD" ]; then
    log "Pas d'instance de production (--sans-base-prod) : base de test vide."
    ORIGINE='aucune (--sans-base-prod)'
  elif [ ! -d "$SOURCE" ]; then
    log "La production n'a pas de base vivante ($SOURCE absent) : base de test vide."
    ORIGINE="$SOURCE (absent)"
  else
    ORIGINE=$SOURCE
    # « $SOURCE/ » (barre finale) : si db/ est lui-même un lien, find et tar descendent quand même dedans.
    # Un lien À L'INTÉRIEUR serait recopié tel quel : la base de test pointerait vers celle du serveur normal et y écrirait. Refus.
    if find "$SOURCE/" -type l | grep -q .; then
      die "$SOURCE contient des liens symboliques : copie refusée (le serveur de test écrirait dans les fichiers du serveur normal)"
    fi
    SQLITE=0
    if command -v sqlite3 >/dev/null 2>&1; then SQLITE=1
    elif find "$SOURCE/" -type f \( -name '*.db' -o -name '*.sqlite' -o -name '*.sqlite3' \) | grep -q .; then
      log "Avertissement : sqlite3 absent, les bases SQLite sont copiées fichier par fichier (sûr seulement si la production n'écrit pas en ce moment)."
    fi
    # Copie de l'arborescence (propriétaires et droits conservés quand on est root, comme tar le fait par défaut), puis, avec sqlite3,
    # le contenu de chaque base remplacé par une sauvegarde cohérente (.backup) prise à cet instant, réécrite en place pour garder
    # son propriétaire et ses droits.
    (cd "$SOURCE/" && tar -cf - .) | (cd "$COPIE" && tar -xf -) || die "copie de $SOURCE impossible"
    if [ "$SQLITE" -eq 1 ]; then
      find "$SOURCE/" -type f \( -name '*.db' -o -name '*.sqlite' -o -name '*.sqlite3' \) | while IFS= read -r base; do
        relatif=${base#"$SOURCE"/}
        relatif=${relatif#/}
        cible="$COPIE/$relatif"
        rm -f "$cible-wal" "$cible-shm" "$cible-journal"
        (cd "$(dirname "$cible")" && sqlite3 "$base" ".backup copie-en-cours.tmp" && cat copie-en-cours.tmp > "$(basename "$cible")" && rm -f copie-en-cours.tmp) ||
          die "sauvegarde SQLite de $base impossible"
      done
    fi
    log "Base de test : copie de $SOURCE ($(find "$COPIE" -type f | wc -l | tr -d ' ') fichier(s))."
  fi
  {
    echo "copie_le=$(date '+%Y-%m-%d %H:%M:%S')"
    echo "source=$ORIGINE"
    if [ -n "$DOSSIER_PROD" ] && [ -f "$DOSSIER_PROD/VERSION" ]; then sed -n 's/^tag=/version_prod=/p' "$DOSSIER_PROD/VERSION"; fi
  } > "$COPIE/.copie-de-la-production"
  # db/ est monté tel quel dans le conteneur du service (docker-compose.yml) : on garde le dossier et on remplace son contenu, comme pour
  # site/ (un dossier remplacé laisserait le conteneur sur l'ancien, supprimé). Le service voit sa base remplacée et la rouvre.
  mkdir -p "$DOSSIER/db"
  find "$DOSSIER/db/" -mindepth 1 -maxdepth 1 -exec rm -rf {} \; || die "impossible de vider $DOSSIER/db"
  find "$COPIE" -mindepth 1 -maxdepth 1 -exec mv {} "$DOSSIER/db/" \; || die "impossible de poser la copie dans $DOSSIER/db"
  rmdir "$COPIE"
fi

# ---------------------------------------------------------------- site
SITE="$DOSSIER/site"
mkdir -p "$SITE"
if [ "$USE_RSYNC" != 0 ] && command -v rsync >/dev/null 2>&1; then
  # --checksum : une page modifiée de même taille doit être recopiée.
  rsync -a --delete --checksum "$TRAVAIL/site/" "$SITE/" || die "synchronisation (rsync) du site impossible"
else
  # On garde le dossier lui-même (nginx le monte tel quel) et on remplace son contenu.
  find "$SITE" -mindepth 1 -maxdepth 1 -exec rm -rf {} \;
  cp -a "$TRAVAIL/site/." "$SITE/" || die "copie du site impossible"
fi

# ---------------------------------------------------------------- configuration
# .livre/ garde la dernière version livrée de chaque fichier : un fichier identique à elle n'a pas été touché sur place et prend la
# nouvelle version ; un fichier modifié sur place est conservé et la nouvelle version est posée à côté (.nouveau).
mkdir -p "$DOSSIER/.livre"
for f in docker-compose.yml nginx.conf; do
  if [ ! -f "$DOSSIER/$f" ] || cmp -s "$DOSSIER/$f" "$DOSSIER/.livre/$f"; then
    if [ -f "$DOSSIER/$f" ] && ! cmp -s "$TRAVAIL/$f" "$DOSSIER/$f"; then
      log "$f mis à jour par cette livraison : relancez « docker compose up -d » dans $DOSSIER pour l'appliquer."
    fi
    cp "$TRAVAIL/$f" "$DOSSIER/$f"
    rm -f "$DOSSIER/$f.nouveau"
  elif cmp -s "$TRAVAIL/$f" "$DOSSIER/$f"; then
    rm -f "$DOSSIER/$f.nouveau"
  else
    cp "$TRAVAIL/$f" "$DOSSIER/$f.nouveau"
    log "$f a été modifié sur place : il est conservé, la version livrée est dans $f.nouveau (à comparer, puis « docker compose up -d »)."
  fi
  cp "$TRAVAIL/$f" "$DOSSIER/.livre/$f"
done
# Remplacement par renommage : mise-a-jour.sh peut être en train de s'exécuter (c'est lui qui lance l'installateur) ; le shell qui le lit
# garde l'ancien fichier au lieu de lire la suite dans le nouveau.
for f in README.md mise-a-jour.sh; do
  cp "$TRAVAIL/$f" "$DOSSIER/.$f.$$" && mv -f "$DOSSIER/.$f.$$" "$DOSSIER/$f" || die "impossible de poser $f"
done
if [ ! -f "$DOSSIER/.env" ]; then
  if [ "$MODE" = prod ]; then CONTENEUR=$NOM_PROD; PORT=8080; else CONTENEUR=$NOM_PROD-test; PORT=8081; fi
  {
    echo "# Réglages de cette instance, lus par docker compose. Créé à la première installation, jamais écrasé."
    echo "MAVERICK_CONTENEUR=$CONTENEUR"
    echo "MAVERICK_PORT=$PORT"
  } > "$DOSSIER/.env"
fi

{
  echo "tag=$TAG"
  echo "version=$VERSION"
  echo "commit=$COMMIT"
  echo "mode=$MODE"
  echo "installe_le=$(date '+%Y-%m-%d %H:%M:%S')"
} > "$DOSSIER/VERSION"
log "Installé : $TAG, $PAGES pages."

if [ ! -f "$DOSSIER/.htpasswd" ]; then
  echo
  echo "Première installation : créez le mot de passe puis lancez le conteneur (voir $DOSSIER/README.md) :"
  # printf '%s\n' et non echo : le echo de dash interpréterait le \n de la commande affichée.
  printf '%s\n' "  cd \"$DOSSIER\"" \
    "  printf 'invite:%s\\n' \"\$(openssl passwd -apr1 'MotDePasse')\" > .htpasswd" \
    "  docker compose up -d"
fi
exit 0
__ARCHIVE__
