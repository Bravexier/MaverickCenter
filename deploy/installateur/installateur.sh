#!/bin/sh
# Installateur du site Maverick Center, étiquette @@TAG@@ (version @@VERSION@@, commit @@SHA@@), mode @@MODE@@.
# FABRIQUÉ par deploy/installateur/fabriquer.mjs à partir de deploy/installateur/installateur.sh : ne pas l'éditer, il est régénéré à chaque livraison.
# Hébergement : serveur normal et serveur de test (docs/flux-git.md) ; le paquet du NAS a sa propre installation (deploy/README.md).
# Le site (déjà construit) est dans ce fichier même, sous la ligne __ARCHIVE__ : rien n'est téléchargé, aucun jeton n'est nécessaire.
#
# Usage : sh <ce-fichier> [--dossier <dossier>] [--copier-base-prod] [--dossier-prod <dossier>] [--sans-base-prod] [--verifier]
#   --dossier       dossier de l'instance (défaut : ./maverick-center en prod, ./maverick-center-test en test)
#   --copier-base-prod  test seulement : poser dans db/ une copie, prise à cet instant, de la base de la production. Refusé (rien n'est modifié)
#                   si db/ contient autre chose que metriques/ : une installation n'efface jamais une base ; toujours refusé quand db/source existe.
#   --dossier-prod  test, avec --copier-base-prod : instance de production dont on copie la base (défaut : le voisin « maverick-center »)
#   --sans-base-prod  accepté et sans effet (un installateur ne copie plus la production sans --copier-base-prod)
#   --verifier      contrôler l'archive intégrée et s'arrêter (rien n'est installé)
#
# Une instance = un dossier :
#   site/                le site statique (remplacé à chaque installation ; nginx le relit sans redémarrage)
#   db/                  la base vivante de l'instance (le service des personnages y écrit). Jamais vidé ni remplacé par une installation, en
#                        production comme en test : db/ vide, le service crée sa base à partir des règles du site. Seule exception, sur
#                        demande : --copier-base-prod (test), dans un db/ vide.
#                        db/metriques/ (métriques d'une instance sans dossier des métriques réglé) : jamais copié de la production, jamais touché.
#                        db/essai-de-structure/ : l'échange avec le service pour l'essai de la livraison (voir plus bas) ; l'installateur n'y retire que sa propre demande.
#                        db/source : le marqueur de la base source (bascule.sh) ; avec lui, ni --copier-base-prod ni une publication plus ancienne que celle installée.
#   metriques/           les métriques du service (docker-compose.yml, MAVERICK_DOSSIER_METRIQUES) : jamais touché par une installation.
#   docker-compose.yml, nginx.conf   posés s'ils sont absents ; s'ils diffèrent, la version livrée est écrite à côté (.nouveau)
#   .env                 port et nom du conteneur de l'instance (créé une fois, jamais écrasé)
#   .htpasswd            mots de passe (jamais touché)
#   sauvegarde/          les scripts des sauvegardes automatiques (copie, envoi chiffré, essai de restauration, installer.sh) : remplacés à chaque installation
#   acces/               acces.sh, la commande du mot de passe du site de dev (remplacée à chaque installation ; le réglage est dans secrets/, jamais touché)
#   installateur-courant/ le dernier installateur installé par mise-a-jour.sh, que l'envoi de nuit joint à la copie extérieure (jamais touché ici)
#   bascule.sh           (test seulement) le script du jour de la bascule 1 : constat, sauvegarde nommée, pose du marqueur db/source, restauration (remplacé à chaque installation)
#   repetition-prod.sh   (test seulement) la répétition, sur une copie, de la dernière mise à jour de la production par l'ancien circuit (remplacé à chaque installation)
#   repetition-bascule-2.sh  (test seulement) la répétition complète du jour J de la bascule 2, sur des copies : paquet, contrôles, base de la production, pages (lot 11, PR 3a ; remplacé à chaque installation)
#   gel.sh               (production et test) le gel des écritures de l'instance, lancé en root : poser, lever, etat (lot 11, garde-fou 16 ; remplacé à chaque installation)
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

usage() { echo "Usage : sh $INSTALLATEUR [--dossier <dossier>] [--copier-base-prod] [--dossier-prod <dossier>] [--sans-base-prod] [--verifier]" >&2; exit 2; }

DOSSIER=''
DOSSIER_PROD=''
SANS_BASE_PROD=0
COPIER_BASE_PROD=0
VERIFIER=0
while [ $# -gt 0 ]; do
  case "$1" in
    --dossier) [ $# -ge 2 ] || usage; DOSSIER=$2; shift 2 ;;
    --dossier-prod) [ $# -ge 2 ] || usage; DOSSIER_PROD=$2; shift 2 ;;
    --sans-base-prod) SANS_BASE_PROD=1; shift ;;
    --copier-base-prod) COPIER_BASE_PROD=1; shift ;;
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
@@SEUL_REFUS@@

# Métriques (docs/serveur.md, « Métriques et volume ») : sans dossier des métriques réglé, le service range sa base de métriques dans db/metriques/.
# Chaque instance a la sienne, jamais mêlée à celle de l'autre : ce dossier n'est ni copié de la production, ni touché, ni compté comme une base.
METRIQUES=metriques
# Essai de la structure (docs/serveur.md, « Essai avant installation ») : le dossier d'échange avec le service, dans db/ (monté dans son conteneur).
ESSAIS=essai-de-structure
# Vrai si le db/ de l'instance contient autre chose que ses métriques et son dossier d'essai : une base, une archive, n'importe quel fichier.
base_remplie() { [ -d "$DOSSIER/db" ] && find "$DOSSIER/db/" -mindepth 1 -maxdepth 1 ! -name "$METRIQUES" ! -name "$ESSAIS" | grep -q .; }

# Base source (lot 8 du chantier de la base de dev ; docs/serveur.md, « Base source (lot 8) ») : le fichier db/source dit que la base de cette instance est
# la source de vérité (bascule.sh le pose, le jour de la bascule). Rien ne peut alors la remplacer, la vider ni la recréer (--copier-base-prod est refusé), et
# une publication plus ancienne que celle installée est refusée (garde-fou 7 : son service ne connaîtrait pas la structure de la base). Refus ICI, avant le
# verrou et toute écriture. Sans ce fichier, rien ne change. Une instance sans VERSION lisible (une base restaurée avant la première installation) s'installe.
# Écrit « oui » si la version $1 (X.Y.Z) est plus ancienne que $2.
plus_ancienne() {
  awk -v a="$1" -v b="$2" 'BEGIN {
    na = split(a, x, "."); nb = split(b, y, ".")
    for (i = 1; i <= 3; i++) { u = x[i] + 0; v = y[i] + 0; if (u < v) { print "oui"; exit } if (u > v) { print "non"; exit } }
    print "non"
  }'
}
if [ -e "$DOSSIER/db/source" ]; then
  [ "$COPIER_BASE_PROD" -eq 0 ] ||
    die "--copier-base-prod refusé : $DOSSIER/db/source existe (la base de cette instance est la source de vérité : elle ne se remplace jamais, elle se restaure depuis une sauvegarde). Rien n'a été modifié"
  INSTALLEE=$(sed -n 's/^version=//p' "$DOSSIER/VERSION" 2>/dev/null | head -n 1 || true)
  if [ -n "$INSTALLEE" ] && [ "$(plus_ancienne "$VERSION" "$INSTALLEE")" = oui ]; then
    die "publication $VERSION refusée : elle est plus ancienne que la $INSTALLEE installée, et $DOSSIER/db/source existe (une base source ne revient jamais à une version plus ancienne). Rien n'a été modifié"
  fi
fi

if [ "$COPIER_BASE_PROD" -eq 1 ]; then
  # La seule route qui écrit dans db/ en mode test : refus ICI, avant le verrou, l'extraction et toute autre écriture.
  [ "$MODE" = test ] || die "--copier-base-prod n'existe qu'en mode test : une installation de production ne touche jamais à db/"
  [ "$SANS_BASE_PROD" -eq 0 ] || die "--copier-base-prod et --sans-base-prod s'excluent"
  [ -n "$DOSSIER_PROD" ] || DOSSIER_PROD="$(dirname "$DOSSIER")/$NOM_PROD"
  [ -d "$DOSSIER_PROD" ] || die "instance de production introuvable ($DOSSIER_PROD) : précisez --dossier-prod <dossier>"
  DOSSIER_PROD=$(cd "$DOSSIER_PROD" && pwd -P)
  [ "$DOSSIER_PROD" != "$DOSSIER" ] || die "le serveur de test ne peut pas s'installer dans le dossier de la production ($DOSSIER)"
  [ "$(mode_de "$DOSSIER_PROD")" = prod ] || die "$DOSSIER_PROD n'est pas une instance de production (fichier VERSION) : précisez --dossier-prod"
  if base_remplie; then
    die "copie de la production refusée : $DOSSIER/db n'est pas vide (une installation n'efface jamais une base). Rien n'a été modifié ; videz-le vous-même après en avoir fait une sauvegarde si c'est voulu"
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
# $ESSAI_DEPOT et $ESSAI_DEMANDE : la demande d'essai de CETTE installation (noms bâtis plus bas, jamais vides quand ils servent), rien d'autre dans db/.
ESSAI_DEPOT=''
ESSAI_DEMANDE=''
nettoyer() { rm -rf "$TRAVAIL" "$DOSSIER/.db.copie.$$" "$VERROU" ${ESSAI_DEPOT:+"$ESSAI_DEPOT"} ${ESSAI_DEMANDE:+"$ESSAI_DEMANDE"}; }
trap nettoyer EXIT
trap 'exit 1' INT TERM HUP

log "Installation $MODE dans $DOSSIER (version $VERSION, commit $(echo "$COMMIT" | cut -c1-7))."
mkdir "$TRAVAIL"
# -o : ne pas reprendre le propriétaire enregistré dans l'archive (celui de la machine qui l'a fabriquée), même en root.
archive | gzip -dc | tar -xof - -C "$TRAVAIL" || die "extraction de l'archive impossible"
@@SEUL_CONTROLE_DEBUT@@
[ -f "$TRAVAIL/site/index.html" ] || die "archive refusée : pas de site/index.html (rien n'a été modifié)"
@@SEUL_CONTROLE_FIN@@
PAGES=$(find "$TRAVAIL/site" -name index.html | wc -l | tr -d ' ')
[ "$PAGES" -eq "$PAGES_ATTENDUES" ] || die "archive refusée : $PAGES pages au lieu de $PAGES_ATTENDUES (rien n'a été modifié)"

# ---------------------------------------------------------------- base (avant le site : en cas d'échec, rien n'a changé)
# Pose $1 en $2 sans jamais écraser : « mv » remplacerait un fichier créé entre le contrôle et la pose. « ln » (fichier) et « mkdir »
# (dossier) échouent si $2 existe ; la source n'est retirée qu'ensuite. Même système de fichiers (la copie est dans le dossier de l'instance).
poser_sans_ecraser() {
  if [ -d "$1" ]; then
    mkdir "$2" 2>/dev/null && cp -Rp "$1/." "$2/" && rm -rf "$1"
  else
    ln "$1" "$2" 2>/dev/null && rm -f "$1"
  fi
}
# db/ n'est JAMAIS vidé ni remplacé par une installation (production comme test) : les saisies d'un serveur de test n'existent nulle part ailleurs.
# Aucun « rm » ne vise db/ dans ce script. Il est monté tel quel dans le conteneur du service (docker-compose.yml) : on le crée s'il manque
# et on n'y touche pas. Vide, le service y crée sa base à partir des règles du site (docs/serveur.md, « Base vivante »).
mkdir -p "$DOSSIER/db" || die "impossible de créer $DOSSIER/db"
if [ "$MODE" = test ] && [ "$COPIER_BASE_PROD" -eq 1 ]; then
  # Copie préparée à part, dans le dossier de l'instance : si elle échoue, db/ n'a pas bougé.
  COPIE="$DOSSIER/.db.copie.$$"
  mkdir "$COPIE"
  SOURCE="$DOSSIER_PROD/db"
  if [ ! -d "$SOURCE" ]; then
    log "La production n'a pas de base vivante ($SOURCE absent) : rien à copier."
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
    rm -rf "${COPIE:?}/$METRIQUES" "${COPIE:?}/$ESSAIS"
    if [ "$SQLITE" -eq 1 ]; then
      find "$SOURCE/" -type f \( -name '*.db' -o -name '*.sqlite' -o -name '*.sqlite3' \) | while IFS= read -r base; do
        relatif=${base#"$SOURCE"/}
        relatif=${relatif#/}
        case "$relatif" in "$METRIQUES"/*|"$ESSAIS"/*) continue ;; esac
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
    if [ -f "$DOSSIER_PROD/VERSION" ]; then sed -n 's/^tag=/version_prod=/p' "$DOSSIER_PROD/VERSION"; fi
  } > "$COPIE/.copie-de-la-production"
  # Le contrôle fait avant le verrou date d'avant la copie, qui peut être longue : il est refait juste avant de poser (le service a pu écrire
  # dans db/ entre-temps), puis chaque entrée est posée sans jamais en écraser une.
  if base_remplie; then die "copie de la production refusée : $DOSSIER/db n'est plus vide (rien n'a été modifié)"; fi
  find "$COPIE" -mindepth 1 -maxdepth 1 > "$TRAVAIL/a-poser" || die "lecture de la copie impossible"
  while IFS= read -r entree; do
    nom=$(basename "$entree")
    if [ -e "$DOSSIER/db/$nom" ] || [ -L "$DOSSIER/db/$nom" ]; then die "copie de la production refusée : $DOSSIER/db/$nom existe déjà (rien n'a été modifié)"; fi
  done < "$TRAVAIL/a-poser"
  while IFS= read -r entree; do
    nom=$(basename "$entree")
    if [ -e "$DOSSIER/db/$nom" ] || [ -L "$DOSSIER/db/$nom" ]; then die "copie de la production interrompue : $DOSSIER/db/$nom existe déjà"; fi
    poser_sans_ecraser "$entree" "$DOSSIER/db/$nom" || die "copie de la production interrompue : $DOSSIER/db/$nom n'a pas pu être posé (créé entre-temps ? rien n'a été écrasé)"
  done < "$TRAVAIL/a-poser"
  rmdir "$COPIE" 2>/dev/null || true
elif [ "$MODE" = test ]; then
  log "Base de test : $DOSSIER/db n'est pas touché (la production n'est copiée que sur demande : --copier-base-prod, dans un db/ vide)."
fi

# ---------------------------------------------------------------- essai de la structure (avant le site : refus, et rien n'est installé)
# Avant de remplacer le site, le service EN PLACE essaie les migrations de cette livraison sur une COPIE de sa base vivante (docs/serveur.md, « Essai avant
# installation »). Un seul programme touche la base à la fois : le service, jamais cet installateur. Il dépose une demande dans db/essai-de-structure/
# (migrations/*.sql, schema.sql et demande.json de la livraison, posés d'un coup : dossier provisoire puis « mv ») et attend le resultat.json du service. Il ne
# touche à rien d'autre dans db/ et ne retire que sa propre demande.
#   - pas de réponse (service arrêté, version du service sans cet essai : aucun accusé de réception), délai dépassé, réponse illisible : noté, l'installation continue ;
#   - essai refusé : noté, l'installation continue, SAUF si db/source existe. Ce marqueur est celui du changement de structure sur place (la base vivante y est la
#     source de vérité) : l'installation s'arrête alors AVANT d'avoir rien installé. Rien ne le pose aujourd'hui ; il ne servira qu'une fois ce changement actif ;
#   - première installation (pas de VERSION, pas de base) et --copier-base-prod : aucun essai.
# Réglages : MAVERICK_ESSAI_ACCUSE_S (20 s : attente de l'accusé de réception du service ; un service arrêté coûte ce délai, pas le suivant), MAVERICK_ESSAI_DELAI_S
# (120 s : attente totale du résultat, comptée dès le dépôt).
ESSAI_ACCUSE_S=${MAVERICK_ESSAI_ACCUSE_S:-20}
ESSAI_DELAI_S=${MAVERICK_ESSAI_DELAI_S:-120}
case "$ESSAI_ACCUSE_S$ESSAI_DELAI_S" in *[!0-9]*|'') ESSAI_ACCUSE_S=20; ESSAI_DELAI_S=120 ;; esac

# Attend resultat.json dans le dossier $1 : 0 = reçu, 1 = aucun accusé de réception dans le délai, 2 = accusé reçu mais pas de résultat dans le délai.
attendre_l_essai() {
  ecoule=0
  accuse=0
  while :; do
    if [ -f "$1/resultat.json" ]; then return 0; fi
    if [ -f "$1/accuse.json" ]; then accuse=1; fi
    if [ "$accuse" -eq 0 ] && [ "$ecoule" -ge "$ESSAI_ACCUSE_S" ]; then return 1; fi
    if [ "$ecoule" -ge "$ESSAI_DELAI_S" ]; then return 2; fi
    sleep 1
    ecoule=$((ecoule + 1))
  done
}

# Une valeur du premier niveau du resultat.json du service (JSON indenté de deux espaces : « "verdict": "…" » seul sur sa ligne).
champ_du_resultat() {
  sed -n "s/^  \"$2\": \"\\(.*\\)\"[,]*\$/\\1/p" "$1" | head -n 1 | sed 's/\\"/"/g' | cut -c1-400
}

essayer_la_structure() {
  ESSAI_DEPOT="$DOSSIER/db/$ESSAIS/.depot-$$"
  ESSAI_DEMANDE="$DOSSIER/db/$ESSAIS/demande-$(printf '%s' "$VERSION" | tr -c 'A-Za-z0-9.-' '_')-$$"
  if ! { mkdir -p "$DOSSIER/db/$ESSAIS" && mkdir "$ESSAI_DEPOT" && mkdir "$ESSAI_DEPOT/migrations" &&
    cp "$TRAVAIL"/site/_serveur/data/migrations/*.sql "$ESSAI_DEPOT/migrations/" && cp "$TRAVAIL/site/_serveur/data/schema.sql" "$ESSAI_DEPOT/schema.sql" &&
    printf '{"format":"maverick-essai-demande/1","version":"%s","tag":"%s","deposee_le":"%s"}\n' "$VERSION" "$TAG" "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" > "$ESSAI_DEPOT/demande.json" &&
    mv "$ESSAI_DEPOT" "$ESSAI_DEMANDE"; } 2>/dev/null; then
    log "Essai de la structure : la demande n'a pas pu être déposée dans db/$ESSAIS : l'installation continue sans essai."
    return 0
  fi
  ESSAI_DEPOT=''
  log "Essai de la structure : demande déposée, le service essaie les migrations de $VERSION sur une copie de sa base (au plus $ESSAI_DELAI_S s)."
  attente=0
  attendre_l_essai "$ESSAI_DEMANDE" || attente=$?
  if [ "$attente" -eq 1 ]; then
    log "Essai de la structure : aucune réponse du service en $ESSAI_ACCUSE_S s (arrêté, ou sans cet essai) : l'installation continue sans essai."
  elif [ "$attente" -eq 2 ]; then
    log "Essai de la structure : le service n'a pas fini en $ESSAI_DELAI_S s : l'installation continue sans le résultat."
  else
    verdict=$(champ_du_resultat "$ESSAI_DEMANDE/resultat.json" verdict)
    resume=$(champ_du_resultat "$ESSAI_DEMANDE/resultat.json" resume)
    case "$verdict" in
      accepte) log "Essai de la structure : accepté par le service ($resume)." ;;
      a_jour) log "Essai de la structure : rien à appliquer ($resume)." ;;
      indisponible) log "Essai de la structure : indisponible ($resume) : l'installation continue sans essai." ;;
      refuse)
        if [ -e "$DOSSIER/db/source" ]; then
          rm -rf "$ESSAI_DEMANDE"
          ESSAI_DEMANDE=''
          die "ATTENTION essai de la structure REFUSÉ par le service ($resume) : rien n'a été installé (db/source existe : la base de cette instance est la source de vérité)"
        fi
        log "ATTENTION essai de la structure REFUSÉ par le service ($resume) : l'installation continue (db/source n'existe pas). Détail : page Debug, db/$ESSAIS/dernier.json."
        ;;
      *) log "Essai de la structure : réponse du service illisible : l'installation continue sans essai." ;;
    esac
  fi
  rm -rf "$ESSAI_DEMANDE"
  ESSAI_DEMANDE=''
}

if [ "$COPIER_BASE_PROD" -eq 0 ] && [ -n "$EXISTANT" ] && [ -f "$DOSSIER/db/vivante.db" ] &&
  [ -d "$TRAVAIL/site/_serveur/data/migrations" ] && [ -f "$TRAVAIL/site/_serveur/data/schema.sql" ]; then
  essayer_la_structure
fi

# ---------------------------------------------------------------- site
@@VERROU_DEBUT@@
SITE="$DOSSIER/site"
mkdir -p "$SITE"
@@SEUL_POSE_DEBUT@@
if [ "$USE_RSYNC" != 0 ] && command -v rsync >/dev/null 2>&1; then
  # --checksum : une page modifiée de même taille doit être recopiée.
  rsync -a --delete --checksum "$TRAVAIL/site/" "$SITE/" || die "synchronisation (rsync) du site impossible"
else
  # On garde le dossier lui-même (nginx le monte tel quel) et on remplace son contenu.
  find "$SITE" -mindepth 1 -maxdepth 1 -exec rm -rf {} \;
  cp -a "$TRAVAIL/site/." "$SITE/" || die "copie du site impossible"
fi
@@SEUL_POSE_FIN@@
@@VERROU_FIN@@

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
# bascule.sh, repetition-prod.sh et repetition-bascule-2.sh (installateur de test seulement) : les scripts du jour de la bascule 1, de sa répétition et de la répétition du jour J de la bascule 2,
# que le propriétaire lance en root (docs/serveur.md, « Base source (lot 8) », « Répétition de la mise à jour de la production » et « Bascule 2 : préparation »).
# gel.sh (les deux instances) : le gel des écritures, db/gel.json (docs/serveur.md, « Gel des écritures »).
for f in bascule.sh repetition-prod.sh repetition-bascule-2.sh gel.sh; do
  if [ -f "$TRAVAIL/$f" ]; then
    cp "$TRAVAIL/$f" "$DOSSIER/.$f.$$" && chmod 755 "$DOSSIER/.$f.$$" && mv -f "$DOSSIER/.$f.$$" "$DOSSIER/$f" ||
      die "impossible de poser $f"
  fi
done
# sauvegarde/ : les scripts des sauvegardes automatiques (deploy/vps/README.md, « Sauvegardes »), que des minuteurs systemd exécutent en root depuis le
# dossier du serveur de test. Les copies, l'état et les clés ne sont PAS ici (/srv/maverick-sauvegardes, /etc/maverick-sauvegardes).
# acces/ : la commande du mot de passe du site de dev (acces.sh ; docs/serveur.md, « Accès au site de dev »), que le propriétaire lance. Le réglage qu'elle
# écrit est secrets/acces.json, jamais ici : une installation ne touche pas à secrets/.
# Chaque fichier est remplacé par renommage (un script peut être en train de tourner), ceux qui ne sont plus livrés sont retirés : un dossier ne garde
# jamais deux versions.
for dossier in sauvegarde acces; do
  [ -d "$TRAVAIL/$dossier" ] || continue
  mkdir -p "$DOSSIER/$dossier"
  for f in "$TRAVAIL/$dossier"/*; do
    nom=$(basename "$f")
    cp "$f" "$DOSSIER/$dossier/.$nom.$$" && chmod 755 "$DOSSIER/$dossier/.$nom.$$" && mv -f "$DOSSIER/$dossier/.$nom.$$" "$DOSSIER/$dossier/$nom" ||
      die "impossible de poser $dossier/$nom"
  done
  for f in "$DOSSIER/$dossier"/*; do
    [ -e "$f" ] || continue
    [ -f "$TRAVAIL/$dossier/$(basename "$f")" ] || rm -rf "$f"
  done
done
if [ ! -f "$DOSSIER/.env" ]; then
  if [ "$MODE" = prod ]; then CONTENEUR=$NOM_PROD; PORT=8080; else CONTENEUR=$NOM_PROD-test; PORT=8081; fi
  {
    echo "# Réglages de cette instance, lus par docker compose. Créé à la première installation, jamais écrasé."
    echo "MAVERICK_CONTENEUR=$CONTENEUR"
    echo "MAVERICK_PORT=$PORT"
    # serveur de test : les pages du guide, des races, des magies, des classes et des métiers s'y modifient (docs/serveur.md, « Édition »)
    if [ "$MODE" = test ]; then echo "MAVERICK_EDITION=1"; fi
  } > "$DOSSIER/.env"
fi

{
  echo "tag=$TAG"
  echo "version=$VERSION"
  echo "commit=$COMMIT"
  echo "mode=$MODE"
  echo "installe_le=$(date '+%Y-%m-%d %H:%M:%S')"
} > "$DOSSIER/VERSION"
@@KIT@@
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
