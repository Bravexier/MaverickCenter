#!/usr/bin/env bash
# L'activation d'un kit par la production (lot 11 « Bascule 2 », PR 5a ; docs/chantier-base-de-dev.md §9, garde-fous 16, 17, 19 et 20 ; docs/serveur.md, « Bascule 2 : préparation »,
# « PR 5a »). Livré à la RACINE de la production par l'installateur (avec activation-conteneur.sh, gel.sh), lancé en root : par l'installateur de production quand le fichier
# `activation-par-paquet` existe, ou à la main. ÉTEINT par défaut : sans ce fichier (posé par le propriétaire, root), il refuse tout de suite et rien ne change en production.
#
# Usage : sudo bash /srv/maverick-center/activer.sh [--prod <dossier>] [--dev <dossier>] [--kit <dossier>] [--reprendre] [--correctif]
#   --reprendre  rejouer après une correction (mémoire, disque, paquet remis…). Si une activation précédente a été interrompue PENDANT sa bascule (le marqueur activation/en-cours reste), le
#                site précédent (site.precedent/) est d'abord remis, puis l'activation recommence.
#   --correctif  correctif urgent : pas de paquet neuf. Le dernier paquet activé (activation/dernier-paquet.json, empreinte comprise), qui est dans paquets/, est RECONTRÔLÉ avec le nouveau
#                kit et les pages sont refaites avec lui. Refus s'il manque, ou si sa structure diffère de celle du kit.
# Ce qui est fait (chaque refus dit les chiffres et le geste exact ; seulement des comptes, jamais un nom de fiche) :
#   a. préalables : kit posé (activation/kit/), interrupteur, outils à root, utilisateur maverick-site, place disque, mémoire, verrou ; le paquet que le kit annonce (kit.json#paquet) est
#      cherché dans paquets/ : root n'y fait que des `stat` (un fichier régulier, pas un lien, de taille plafonnée) AVANT toute lecture ;
#   b. un conteneur SANS réseau, SANS capacité, utilisateur 65534 : copie le paquet, calcule son empreinte, la compare à celle que le KIT annonce (venue de GitHub : la seule à laquelle la
#      production fait confiance), lance les contrôles du code du kit (structure, notes, contenu réel, base de la production refaite avec ses fiches sur une copie `sqlite3 .backup`) ; un
#      second, sous les mêmes règles, fabrique TOUT le site de la production (SITE_MODE=prod) depuis ce paquet avec le kit. Root ne lit que des JSON plafonnés, après `docker rm` ;
#   c. la bascule courte : gel des écritures (gel.sh poser --duree 30), service arrêté, base mise de côté, site/ copié dans site.precedent/ puis le nouveau site posé en place (pages sous
#      l'utilisateur maverick-site, service `_serveur/` sous root, chacun par un conteneur sans capacité), service relancé ;
#   d. contrôle de santé (5 min au plus) : /api/etat répond, la base est prête, la version est celle du kit ;
#   e. succès : gel levé, rapport. Échec : RETOUR AUTOMATIQUE (site.precedent/ reposé, base remise si elle a changé, gel levé, rapport) : la production garde sa base.
# Le rapport (activation/rapport.json) est aussi laissé dans paquets/activation.json, où le site de dev le lit (page Mise à jour : `activation_production`, docs/api.md).
# Codes : 0 passée ; 1 refusée (rien n'a changé) ou retour automatique (le site précédent est remis) ; 2 impossible (usage, préalable : rien n'a changé).
# Dernière ligne : « activation : == PASSEE … », « == REFUSEE : … », « == RETOUR AUTOMATIQUE : … » ou « == IMPOSSIBLE : … ».
# Variables (tests) : MAVERICK_DIR_NORMAL, MAVERICK_DIR_TEST, MAVERICK_SAUV_DOCKER (docker), MAVERICK_ESSAI=1 (root non exigé, aucun chown, utilisateur de pose donné par
#   MAVERICK_ACTIVATION_UTILISATEUR=uid:gid), MAVERICK_ACTIVATION_PROC, MAVERICK_ACTIVATION_CGROUP, MAVERICK_ACTIVATION_INTERVALLE (secondes entre deux relevés), MAVERICK_ACTIVATION_SANTE
#   (secondes accordées au contrôle de santé, 300), MAVERICK_ACTIVATION_PROPRIETAIRE (uid attendu des fichiers de root sous MAVERICK_ESSAI=1), MAVERICK_DIR_ETC_SYSTEMD.
#
# Les raisons du rapport (le service n'en admet pas d'autres : serveur/paquets-de-la-production.mjs#RAISONS_DE_L_ACTIVATION, un test les rapproche) :
# raisons: kit_sans_paquet empreinte structure note_manquante version_en_arriere
# raisons: paquet_absent paquet_irregulier paquet_trop_gros correctif_sans_paquet contenu fiches controles
# raisons: memoire disque verrou fabrication bascule sante interrompue
set -euo pipefail
umask 077

usage() { echo "Usage : sudo bash $0 [--prod <dossier>] [--dev <dossier>] [--kit <dossier>] [--reprendre] [--correctif]" >&2; exit 2; }
PROD=${MAVERICK_DIR_NORMAL:-/srv/maverick-center}
DEV=${MAVERICK_DIR_TEST:-/srv/maverick-center-test}
KIT_DOSSIER=''
REPRENDRE=0
CORRECTIF=0
while [ $# -gt 0 ]; do
  case "$1" in
    --prod) [ $# -ge 2 ] || usage; PROD=$2; shift 2 ;;
    --dev) [ $# -ge 2 ] || usage; DEV=$2; shift 2 ;;
    --kit) [ $# -ge 2 ] || usage; KIT_DOSSIER=$2; shift 2 ;;
    --reprendre) REPRENDRE=1; shift ;;
    --correctif) CORRECTIF=1; shift ;;
    *) usage ;;
  esac
done
PROD=${PROD%/}
DEV=${DEV%/}
ACT=$PROD/activation
KIT=${KIT_DOSSIER:-$ACT/kit}
PAQUETS=$PROD/paquets
INTERRUPTEUR=$PROD/activation-par-paquet
DOCKER=${MAVERICK_SAUV_DOCKER:-docker}
ESSAI=${MAVERICK_ESSAI:-0}
PROC=${MAVERICK_ACTIVATION_PROC:-/proc}
CGROUP=${MAVERICK_ACTIVATION_CGROUP:-/sys/fs/cgroup}
ETC_SYSTEMD=${MAVERICK_DIR_ETC_SYSTEMD:-/etc/systemd/system}
INTERVALLE=${MAVERICK_ACTIVATION_INTERVALLE:-2}
SANTE_S=${MAVERICK_ACTIVATION_SANTE:-300}
# 45 min : le pire cas de la bascule est la somme des délais (copie 600 s, pages 600 s, service 600 s, santé 300 s) = 2100 s, plus le retour ; le gel ne tombe jamais en pleine bascule
DUREE_DU_GEL=45
# Les règles de l'atelier (deploy/installateur/atelier/lib.sh : un test compare ces constantes aux siennes) : plafond de mémoire 2,5 Go, besoin 1,1 Go, disque minimum 2 Go, délai 30 min.
DEFAUT_MEMOIRE_MAX_KO=2621440
DEFAUT_BESOIN_KO=1153433
DEFAUT_DISQUE_MIN_KO=2097152
DEFAUT_DELAI_S=1800
DEFAUT_CPUS=1
PLAFOND_RESULTAT=262144
PLAFOND_JOURNAL=204800
PLAFOND_PAQUET=536870912
MOTIF_IMAGE='^node:[0-9]+(\.[0-9]+){0,2}-(bookworm-slim|alpine)$'
MEMOIRE_POSE='512m'
DELAI_POSE_S=600

dire() { echo "activation : $*"; }
DEBUT=$SECONDS
TRAVAIL=''
CID=''
BASCULE_EN_COURS=0
GEL_POSE=0
VERROU_DEV_PRIS=0
PAGES=''
MODE=paquet
[ "$CORRECTIF" -eq 0 ] || MODE=correctif

# ---------------------------------------------------------------------------------------------------------------------------------------------
# le rapport : activation/rapport.json (root), et paquets/activation.json (le site de dev le lit)
# ---------------------------------------------------------------------------------------------------------------------------------------------
VERSION_PAQUET=''
DEPUIS=''
LOT=''
RAISONS=''
PHRASE=''
GESTE=''
GEL_LEVE=false
ETAT_RAPPORT=''
jtexte() { printf '%s' "$1" | LC_ALL=C tr -d '\000-\037\177"\\' | LC_ALL=C tr -s ' ' | cut -c1-400; }
jnombre() { case "${1:-}" in ''|*[!0-9]*) printf 'null' ;; *) printf '%s' "$1" ;; esac; }
jversion() { if printf '%s' "${1:-}" | grep -Eq '^[0-9]+\.[0-9]+$'; then printf '"%s"' "$1"; else printf 'null'; fi; }
jlot() { if printf '%s' "${1:-}" | grep -Eq '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'; then printf '"%s"' "$1"; else printf 'null'; fi; }
jraisons() { # mots séparés par des espaces -> ["a","b"]
  sortie=''
  for mot in $RAISONS; do
    case "$mot" in *[!a-z_]*|'') continue ;; esac
    sortie="$sortie${sortie:+,}\"$mot\""
  done
  printf '[%s]' "$sortie"
}
ecrire_le_rapport() { # etat
  ETAT_RAPPORT=$1
  [ -d "$ACT" ] && [ ! -L "$ACT" ] || return 0
  contenu=$(printf '{"format":"maverick-activation/1","etat":"%s","le":"%s","version":%s,"depuis":%s,"lot":%s,"mode":"%s","raisons":%s,"pages":%s,"duree_s":%s,"gel_leve":%s,"phrase":"%s","geste":%s}\n' \
    "$1" "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$(jversion "$VERSION_PAQUET")" "$(jversion "$DEPUIS")" "$(jlot "$LOT")" "$MODE" "$(jraisons)" "$(jnombre "$PAGES")" "$((SECONDS - DEBUT))" "$GEL_LEVE" \
    "$(jtexte "$PHRASE")" "$(if [ -n "$GESTE" ]; then printf '"%s"' "$(jtexte "$GESTE")"; else printf 'null'; fi)")
  deposer_un_fichier "$ACT/rapport.json" "$contenu" || dire "note : le rapport n'a pas pu être écrit dans $ACT."
  if [ -d "$PAQUETS" ] && [ ! -L "$PAQUETS" ]; then
    deposer_un_fichier "$PAQUETS/activation.json" "$contenu" || dire "note : le rapport n'a pas pu être laissé dans $PAQUETS (le site de dev ne le verra pas)."
  fi
}
# Un fichier écrit en entier DANS activation/ (à root seul : le service ne peut rien y remplacer), mis en 644 là, puis RENOMMÉ vers sa destination (`mv -T` : un lien posé à la place
# est remplacé, jamais suivi). Root n'écrit ni ne change JAMAIS les droits d'un fichier d'un dossier que le service peut modifier (paquets/ : garde-fou 20) ; le renommage exige le même
# système de fichiers (`stat -c %d` des deux dossiers) : sinon `mv` copierait, et la copie suivrait un lien posé sur la destination. Le dossier de destination est un dossier ordinaire.
deposer_un_fichier() { # chemin contenu
  dossier=$(dirname "$1")
  [ -d "$dossier" ] && [ ! -L "$dossier" ] || return 1
  [ -d "$ACT" ] && [ ! -L "$ACT" ] || return 1
  [ "$(stat -c '%d' "$dossier" 2>/dev/null || echo a)" = "$(stat -c '%d' "$ACT" 2>/dev/null || echo b)" ] || return 1
  provisoire=$(mktemp "$ACT/.depot.XXXXXX") || return 1
  if printf '%s\n' "$2" > "$provisoire" && chmod 644 "$provisoire" && mv -f -T "$provisoire" "$1"; then return 0; fi
  rm -f "$provisoire"
  return 1
}

# ---------------------------------------------------------------------------------------------------------------------------------------------
# les sorties : IMPOSSIBLE (rien n'a changé, aucun rapport), REFUSEE (rien n'a changé, rapport), RETOUR AUTOMATIQUE
# ---------------------------------------------------------------------------------------------------------------------------------------------
nettoyer() {
  if [ -n "$CID" ]; then "$DOCKER" rm -f "$CID" >/dev/null 2>&1 || true; fi
  if [ -n "$TRAVAIL" ] && [ -d "$TRAVAIL" ]; then rm -rf "$TRAVAIL"; fi
}
impossible() { echo "activation : == IMPOSSIBLE : $*" >&2; exit 2; }
refuser() { # raisons phrase geste -> exit 1 ; rien n'a été changé
  RAISONS=$1; PHRASE=$2; GESTE=$3
  ecrire_le_rapport refusee
  dire "== REFUSEE : $PHRASE"
  [ -z "$GESTE" ] || dire "geste : $GESTE"
  dire "la production n'a pas changé : son site, sa base et son service sont ceux d'avant."
  exit 1
}
trap 'sortie_du_script' EXIT
trap 'exit 1' INT TERM HUP
sortie_du_script() {
  code=$?
  # un conteneur encore en marche (un signal pendant une pose) est supprimé D'ABORD : il ne doit plus écrire dans site/ pendant que le retour automatique le repose
  if [ -n "$CID" ]; then "$DOCKER" rm -f "$CID" >/dev/null 2>&1 || true; CID=''; fi
  if [ "$BASCULE_EN_COURS" -eq 1 ]; then
    # le script meurt PENDANT la bascule (signal, erreur inattendue) : retour automatique, jamais un site à moitié posé
    BASCULE_EN_COURS=0
    set +e
    dire "interruption pendant la bascule (code $code) : retour automatique."
    retour_automatique interrompue "le script s'est arrêté pendant la bascule (code $code)"
    code=1
  fi
  nettoyer
  exit "$code"
}

verifier_a_root() { # chemin… : à root, non modifiable par un autre
  attendu=0
  if [ "$ESSAI" = 1 ]; then
    [ -n "${MAVERICK_ACTIVATION_PROPRIETAIRE:-}" ] || return 0
    attendu=$MAVERICK_ACTIVATION_PROPRIETAIRE
  fi
  for chemin in "$@"; do
    proprietaire=$(stat -c '%u' "$chemin" 2>/dev/null || echo x)
    [ "$proprietaire" = "$attendu" ] || impossible "$chemin n'appartient pas à root : refus (les outils de l'activation sont posés par l'installateur de production)"
    if [ "$ESSAI" != 1 ]; then
      droits=$(stat -c '%a' "$chemin" 2>/dev/null || echo 777)
      [ $((0$droits & 022)) -eq 0 ] || impossible "$chemin est modifiable par un autre que root : refus (les outils de l'activation sont posés par l'installateur de production)"
    fi
  done
}

mo() { awk -v n="${1:-0}" 'BEGIN { printf "%.1f Mo", n / 1048576 }'; }
ko_en_mo() { awk -v n="${1:-0}" 'BEGIN { printf "%d Mo", n / 1024 }'; }
ko_de() { du -sk "$1" 2>/dev/null | cut -f1; }
compose() { (cd "$PROD" && "$DOCKER" compose "$@" 9>&- 8>&-); }
champ_du_fichier() { # fichier nom : « NOM=valeur » (lignes exactes, jamais interprétées par le shell)
  [ -f "$1" ] || return 0
  sed -n "s|^$2=\\([-A-Za-z0-9._:+@ /]*\\)\$|\\1|p" "$1" | head -n 1
}
entier_positif() { case "$1" in ''|*[!0-9]*) return 1 ;; esac; [ "$1" -gt 0 ]; }
meminfo_ko() { awk -v champ="$1:" '$1 == champ { print $2; exit }' "$PROC/meminfo" 2>/dev/null; }
mesurer_le_disque() { # dossier -> DISQUE_LIBRE_KO
  ligne=$(df -Pk "$1" 2>/dev/null | awk 'NR == 2 { print $4 }')
  case "$ligne" in ''|*[!0-9]*) DISQUE_LIBRE_KO='' ;; *) DISQUE_LIBRE_KO=$ligne ;; esac
}
# Le plafond de mémoire d'une fabrication (mêmes règles que atelier/lib.sh#calculer_le_plafond) : min(maximum, MemAvailable / 2) ; la marge laissée à la production, au moins max(1 Go, 25 % de MemTotal).
calculer_le_plafond() { # total dispo maximum besoin
  PLAFOND_KO=$3
  moitie=$(($2 / 2))
  [ "$moitie" -ge "$PLAFOND_KO" ] || PLAFOND_KO=$moitie
  MARGE_KO=$(($2 - PLAFOND_KO))
  MARGE_MINIMALE_KO=$(($1 / 4))
  [ "$MARGE_MINIMALE_KO" -ge 1048576 ] || MARGE_MINIMALE_KO=1048576
  MOTIF_REFUS=''
  if [ "$PLAFOND_KO" -lt "$4" ]; then MOTIF_REFUS=memoire_insuffisante
  elif [ "$MARGE_KO" -lt "$MARGE_MINIMALE_KO" ]; then MOTIF_REFUS=marge_insuffisante
  fi
}

# ---------------------------------------------------------------------------------------------------------------------------------------------
# a. préalables
# ---------------------------------------------------------------------------------------------------------------------------------------------
[ "$ESSAI" = 1 ] || [ "$(id -u)" -eq 0 ] || impossible "à lancer en root : sudo bash $0"
mode_de() { sed -n 's/^mode=//p' "$1/VERSION" 2>/dev/null | head -n 1 || true; }
[ -f "$PROD/VERSION" ] && [ "$(mode_de "$PROD")" = prod ] || impossible "$PROD n'est pas la production (fichier VERSION, mode prod) : --prod <dossier>"
# l'interrupteur : le fichier est la preuve (à root, régulier, jamais un lien) ; absent, l'activation n'existe pas
if [ ! -e "$INTERRUPTEUR" ] && [ ! -L "$INTERRUPTEUR" ]; then
  impossible "l'activation par paquet est éteinte ($INTERRUPTEUR n'existe pas) : rien n'a changé. Pour l'allumer, le jour J : sudo touch $INTERRUPTEUR"
fi
[ -f "$INTERRUPTEUR" ] && [ ! -L "$INTERRUPTEUR" ] || impossible "$INTERRUPTEUR n'est pas un fichier ordinaire"
{ [ -d "$PROD/site" ] && [ ! -L "$PROD/site" ] && [ -d "$PROD/site/_serveur" ] && [ ! -L "$PROD/site/_serveur" ]; } || impossible "$PROD/site ou $PROD/site/_serveur n'est pas un dossier ordinaire : la production n'est pas installée"
[ -f "$PROD/db/vivante.db" ] && [ ! -L "$PROD/db/vivante.db" ] || impossible "$PROD/db/vivante.db est absente ou n'est pas un fichier ordinaire : la production n'a pas de base"
[ -f "$PROD/docker-compose.yml" ] || impossible "$PROD/docker-compose.yml est absent : ce n'est pas une instance posée par l'installateur"
mkdir -p "$ACT" && chmod 755 "$ACT" || impossible "impossible de créer $ACT"
verifier_a_root "$INTERRUPTEUR" "$PROD/activation-conteneur.sh" "$PROD/gel.sh" "$ACT"
[ -f "$PROD/activation-conteneur.sh" ] || impossible "$PROD/activation-conteneur.sh est absent : l'installateur de production le pose à chaque installation (sudo sh $PROD/mise-a-jour.sh --force)"
[ -f "$PROD/gel.sh" ] || impossible "$PROD/gel.sh est absent : l'installateur de production le pose à chaque installation (sudo sh $PROD/mise-a-jour.sh --force)"
for outil in flock; do command -v "$outil" >/dev/null 2>&1 || impossible "$outil est absent (util-linux)"; done
command -v sqlite3 >/dev/null 2>&1 || impossible "sqlite3 est absent (apt-get install sqlite3) : la base de la production ne peut pas être copiée pour les contrôles"

# le verrou : une activation à la fois ; la fabrication de l'atelier du site de dev (même mémoire du serveur) ne tourne pas en même temps
exec 9>"$ACT/.verrou"
flock -n 9 || refuser verrou "une autre activation est en cours (le verrou $ACT/.verrou est pris)" "attendre sa fin, puis relancer : sudo bash $PROD/activer.sh --reprendre"
if [ -f "$DEV/atelier/.verrou" ] && [ ! -L "$DEV/atelier/.verrou" ]; then
  exec 8>"$DEV/atelier/.verrou"
  flock -n 8 || refuser verrou "une fabrication de l'atelier du site de dev est en cours (le verrou $DEV/atelier/.verrou est pris : le serveur n'a pas la mémoire pour deux fabrications)" "attendre sa fin (sudo sh $DEV/atelier/installer.sh --etat), puis relancer : sudo bash $PROD/activer.sh --reprendre"
  VERROU_DEV_PRIS=1
fi

# une activation interrompue pendant sa bascule : le marqueur reste
if [ -e "$ACT/en-cours" ] && [ "$REPRENDRE" -ne 1 ]; then
  impossible "une activation précédente a été interrompue PENDANT sa bascule ($ACT/en-cours existe) : le site de la production est peut-être à moitié posé. Pour remettre le site précédent (site.precedent/) puis recommencer : sudo bash $PROD/activer.sh --reprendre"
fi

# le kit : celui de la livraison que la production vient d'installer (kit.json : version, image, structure, paquet annoncé)
{ [ -d "$KIT" ] && [ ! -L "$KIT" ] && [ -f "$KIT/kit.json" ] && [ ! -L "$KIT/kit.json" ] && [ -f "$KIT/client/package.json" ]; } || impossible "pas de kit dans $KIT (kit.json) : la production reçoit son kit de l'installateur de production quand activation-par-paquet existe ; relancer l'installateur (sudo sh $PROD/mise-a-jour.sh --force)"
verifier_a_root "$KIT" "$KIT/kit.json"
for f in client/scripts/fabriquer-depuis-contenu.mjs client/scripts/poser-un-site.mjs client/scripts/activation-controles.mjs data/schema.sql; do
  [ -f "$KIT/$f" ] || impossible "le kit est incomplet ($KIT/$f manque) ou plus ancien que cette activation : refabriquer le kit par une livraison récente"
done
champ_du_kit() { sed -n "s/^  \"$1\": \"\\([^\"]*\\)\",\\{0,1\\}\$/\\1/p" "$KIT/kit.json" | head -n 1; }
nombre_du_kit() { sed -n "s/^  \"$1\": \\([0-9][0-9]*\\),\\{0,1\\}\$/\\1/p" "$KIT/kit.json" | head -n 1; }
paquet_du_kit() { awk '/^  "paquet": \{/ { d = 1; next } d && /^  \}/ { exit } d { print }' "$KIT/kit.json" | sed -n "s/^    \"$1\": \"\\([^\"]*\\)\",\\{0,1\\}\$/\\1/p" | head -n 1; }
VERSION_KIT=$(champ_du_kit version)
IMAGE=$(champ_du_kit image)
STRUCTURE_KIT=$(nombre_du_kit structure)
printf '%s' "$VERSION_KIT" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+$' || impossible "kit.json ne dit pas sa version (X.Y.Z) : le kit est incomplet ; relancer l'installateur de production (sudo sh $PROD/mise-a-jour.sh --force), ou refabriquer le kit par une livraison récente"
printf '%s\n' "$IMAGE" | grep -Eq "$MOTIF_IMAGE" || impossible "l'image du kit n'est pas une image de la fabrication (kit.json : « $(printf '%s' "$IMAGE" | tr -cd 'A-Za-z0-9._:/-' | cut -c1-60) ») : refabriquer le kit par une livraison récente (node:<version>-bookworm-slim attendue), puis sudo sh $PROD/mise-a-jour.sh --force"
if [ -z "$STRUCTURE_KIT" ]; then
  STRUCTURE_KIT=$(sed -n 's/^PRAGMA user_version *= *\([0-9][0-9]*\).*/\1/p' "$KIT/data/schema.sql" 2>/dev/null | head -n 1 || true)
fi
[ -n "$STRUCTURE_KIT" ] || impossible "la structure du kit est illisible (kit.json#structure, data/schema.sql) : le kit est incomplet, refabriquer le kit par une livraison récente"
ANNONCE_LOT=$(paquet_du_kit lot)
ANNONCE_VERSION=$(paquet_du_kit version)
ANNONCE_EMPREINTE=$(paquet_du_kit empreinte)
ANNONCE_STRUCTURE=$(sed -n 's/^    "structure": \([0-9][0-9]*\),\{0,1\}$/\1/p' <(awk '/^  "paquet": \{/ { d = 1; next } d && /^  \}/ { exit } d { print }' "$KIT/kit.json") | head -n 1)
dire "préalable : kit V$VERSION_KIT (structure $STRUCTURE_KIT, image $IMAGE) ; production $(sed -n 's/^tag=//p' "$PROD/VERSION" | head -n 1)."

# les réglages de l'activation (root) : les mêmes plafonds que l'atelier, relus champ par champ
REGLAGES=$ACT/reglages.env
[ ! -f "$REGLAGES" ] || verifier_a_root "$REGLAGES"
reglage() { valeur=$(champ_du_fichier "$REGLAGES" "$1"); if entier_positif "$valeur"; then printf '%s' "$valeur"; else printf '%s' "$2"; fi; }
MEMOIRE_MAX_KO=$(reglage MEMOIRE_MAX_KO "$DEFAUT_MEMOIRE_MAX_KO")
BESOIN_KO=$(reglage BESOIN_KO "$DEFAUT_BESOIN_KO")
DISQUE_MIN_KO=$(reglage DISQUE_MIN_KO "$DEFAUT_DISQUE_MIN_KO")
DELAI_S=$(reglage DELAI_S "$DEFAUT_DELAI_S")
CPUS=$(champ_du_fichier "$REGLAGES" CPUS)
printf '%s\n' "$CPUS" | awk '/^[0-9]+(\.[0-9]+)?$/ && $0 + 0 > 0 && $0 + 0 <= 64 { ok = 1 } END { exit ok ? 0 : 1 }' || CPUS=$DEFAUT_CPUS
GOOGLE=$(champ_du_fichier "$REGLAGES" GOOGLE_CLIENT_ID | tr -cd 'A-Za-z0-9._-' | cut -c1-128 || true)

# l'utilisateur de la pose des pages : maverick-site, qui possède site/ sauf _serveur/ (l'installateur de production le crée quand activation-par-paquet existe)
if [ -n "${MAVERICK_ACTIVATION_UTILISATEUR:-}" ] && [ "$ESSAI" = 1 ]; then
  UTILISATEUR_DE_POSE=$MAVERICK_ACTIVATION_UTILISATEUR
else
  uid_site=$(id -u maverick-site 2>/dev/null || true)
  gid_site=$(id -g maverick-site 2>/dev/null || true)
  [ -n "$uid_site" ] && [ "$uid_site" != 0 ] || impossible "l'utilisateur système maverick-site n'existe pas : l'installateur de production le crée quand activation-par-paquet existe. Geste : sudo sh $PROD/mise-a-jour.sh --force"
  [ "$(stat -c '%u' "$PROD/site")" = "$uid_site" ] || impossible "$PROD/site n'appartient pas à maverick-site (uid $uid_site) : l'installateur de production le fait à chaque installation. Geste : sudo sh $PROD/mise-a-jour.sh --force"
  [ "$(stat -c '%u' "$PROD/site/_serveur")" = 0 ] || impossible "$PROD/site/_serveur doit rester à root (le code que le service exécute) : sudo sh $PROD/mise-a-jour.sh --force"
  UTILISATEUR_DE_POSE="$uid_site:$gid_site"
fi
case "$UTILISATEUR_DE_POSE" in *[!0-9:]*|'') impossible "utilisateur de pose illisible (« $UTILISATEUR_DE_POSE »)" ;; esac

# le paquet : root ne fait que des `stat` (un fichier régulier non lien, de taille plafonnée) ; c'est le conteneur sans privilège qui le copie et calcule son empreinte
PAQUET_NOM=''
CORRECTIF_ENREGISTRE=$ACT/dernier-paquet.json
if [ "$CORRECTIF" -eq 1 ]; then
  champ_enregistre() { sed -n "s/^.*\"$1\": *\"\\([^\"]*\\)\".*\$/\\1/p" "$CORRECTIF_ENREGISTRE" 2>/dev/null | head -n 1; }
  if [ ! -f "$CORRECTIF_ENREGISTRE" ] || [ -L "$CORRECTIF_ENREGISTRE" ]; then
    refuser correctif_sans_paquet "le correctif urgent recontrôle le dernier paquet activé, et cette production n'en a enregistré aucun ($CORRECTIF_ENREGISTRE absent) : rien à recontrôler" "faire une activation normale avec un paquet (sans --correctif), ou attendre la prochaine mise à jour"
  fi
  ANNONCE_LOT=$(champ_enregistre lot); ANNONCE_VERSION=$(champ_enregistre version); ANNONCE_EMPREINTE=$(champ_enregistre empreinte)
  ANNONCE_STRUCTURE=$(sed -n 's/^.*"structure": *\([0-9][0-9]*\).*$/\1/p' "$CORRECTIF_ENREGISTRE" | head -n 1)
  dire "correctif urgent : le dernier paquet activé (V$ANNONCE_VERSION) est recontrôlé avec le kit V$VERSION_KIT."
fi
VERSION_PAQUET=$ANNONCE_VERSION
LOT=$ANNONCE_LOT
DEPUIS=$(sed -n 's/^tag=[vV]\([0-9][0-9]*\.[0-9][0-9]*\).*$/\1/p' "$PROD/VERSION" | head -n 1)
if [ -n "$ANNONCE_LOT" ] && [ -n "$ANNONCE_VERSION" ]; then
  printf '%s' "$ANNONCE_VERSION" | grep -Eq '^[0-9]+\.[0-9]+$' || refuser paquet_irregulier "le kit annonce un paquet de version illisible (« $(printf '%s' "$ANNONCE_VERSION" | tr -cd 'A-Za-z0-9._-' | cut -c1-20) »)" "refabriquer le kit : une livraison de test récente"
  printf '%s' "$ANNONCE_LOT" | grep -Eq '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' || refuser paquet_irregulier "le kit annonce un paquet de lot illisible" "refabriquer le kit : une livraison de test récente"
  printf '%s' "$ANNONCE_EMPREINTE" | grep -Eq '^[0-9a-f]{64}$' || refuser paquet_irregulier "le kit annonce l'empreinte de son paquet sous une forme illisible" "refabriquer le kit : une livraison de test récente"
  PAQUET_NOM="$ANNONCE_VERSION-$ANNONCE_LOT.db"
  if [ ! -d "$PAQUETS" ] || [ -L "$PAQUETS" ]; then
    refuser paquet_absent "le dossier $PAQUETS n'existe pas (ou est un lien) : le site de dev n'a nulle part où déposer le paquet" "sudo bash /srv/maverick-center-test/bascule.sh poser-bascule-2 (il le crée), puis refaire « Effectuer la mise à jour » sur le site de dev"
  fi
  chemin_du_paquet=$PAQUETS/$PAQUET_NOM
  if [ -L "$chemin_du_paquet" ]; then refuser paquet_irregulier "$PAQUET_NOM est un lien : refusé sans être lu" "refaire « Effectuer la mise à jour » sur le site de dev (le paquet est déposé à neuf)"; fi
  if [ ! -e "$chemin_du_paquet" ]; then
    refuser paquet_absent "le paquet $PAQUET_NOM, que le kit annonce, n'est pas dans $PAQUETS" "le déposer : refaire « Effectuer la mise à jour » sur le site de dev (avec db/bascule-2) puis relancer : sudo bash $PROD/activer.sh --reprendre"
  fi
  genre=$(stat -c '%F' "$chemin_du_paquet" 2>/dev/null || echo inconnu)
  case "$genre" in "regular file"|"regular empty file") ;; *) refuser paquet_irregulier "$PAQUET_NOM n'est pas un fichier ordinaire ($genre) : refusé sans être lu" "refaire « Effectuer la mise à jour » sur le site de dev (le paquet est déposé à neuf)" ;; esac
  taille_paquet=$(stat -c '%s' "$chemin_du_paquet" 2>/dev/null || echo 0)
  if [ "$taille_paquet" -le 0 ] || [ "$taille_paquet" -gt "$PLAFOND_PAQUET" ]; then
    refuser paquet_trop_gros "le paquet $PAQUET_NOM pèse $taille_paquet octets (attendu : plus de 0 et au plus $PLAFOND_PAQUET) : refusé sans être lu" "refaire « Effectuer la mise à jour » sur le site de dev"
  fi
  dire "paquet : $PAQUET_NOM, $(mo "$taille_paquet"), fichier ordinaire (non lu par root ; l'empreinte que le kit annonce : $(printf '%s' "$ANNONCE_EMPREINTE" | cut -c1-12)…)."
else
  dire "paquet : le kit n'en annonce aucun."
fi

# la mémoire et le disque : les règles de l'atelier (refus avant toute écriture, avec les chiffres et le geste)
MEM_TOTAL_KO=$(meminfo_ko MemTotal)
MEM_DISPO_KO=$(meminfo_ko MemAvailable)
case "$MEM_TOTAL_KO$MEM_DISPO_KO" in ''|*[!0-9]*) refuser memoire "la mémoire du serveur est illisible ($PROC/meminfo)" "relancer : sudo bash $PROD/activer.sh --reprendre" ;; esac
calculer_le_plafond "$MEM_TOTAL_KO" "$MEM_DISPO_KO" "$MEMOIRE_MAX_KO" "$BESOIN_KO"
if [ -n "$MOTIF_REFUS" ]; then
  refuser memoire "la fabrication des pages serait refusée ($MOTIF_REFUS) : $(ko_en_mo "$MEM_DISPO_KO") disponibles sur $(ko_en_mo "$MEM_TOTAL_KO"), plafond possible $(ko_en_mo "$PLAFOND_KO") pour un besoin de $(ko_en_mo "$BESOIN_KO"), marge laissée à la production $(ko_en_mo "$MARGE_KO") (au moins $(ko_en_mo "$MARGE_MINIMALE_KO"))" "libérer de la mémoire (il faut au moins $(( (2 * BESOIN_KO) / 1024 )) Mo disponibles), puis : sudo bash $PROD/activer.sh --reprendre"
fi
taille_site_ko=$(ko_de "$PROD/site"); taille_kit_ko=$(ko_de "$KIT"); taille_base_ko=$(ko_de "$PROD/db")
besoin_disque_ko=$((2 * taille_kit_ko + 4 * taille_site_ko + 4 * taille_base_ko + DISQUE_MIN_KO + 65536))
mesurer_le_disque "$ACT"
if [ -z "$DISQUE_LIBRE_KO" ] || [ "$DISQUE_LIBRE_KO" -lt "$besoin_disque_ko" ]; then
  refuser disque "place insuffisante sous $ACT : $(ko_en_mo "${DISQUE_LIBRE_KO:-0}") libres, $(ko_en_mo "$besoin_disque_ko") nécessaires (2 fois le kit : $(ko_en_mo "$taille_kit_ko"), 4 fois le site : $(ko_en_mo "$taille_site_ko"), 4 fois la base : $(ko_en_mo "$taille_base_ko"), le minimum de $(ko_en_mo "$DISQUE_MIN_KO"), 64 Mo)" "libérer de la place sous $ACT (ou supprimer $PROD/site.precedent/ : la sauvegarde de la dernière activation), puis : sudo bash $PROD/activer.sh --reprendre"
fi
dire "mémoire : $(ko_en_mo "$MEM_DISPO_KO") disponibles sur $(ko_en_mo "$MEM_TOTAL_KO") ; plafond du conteneur $(ko_en_mo "$PLAFOND_KO") (besoin $(ko_en_mo "$BESOIN_KO")) ; disque : $(ko_en_mo "$DISQUE_LIBRE_KO") libres ($(ko_en_mo "$besoin_disque_ko") nécessaires)."

# ---------------------------------------------------------------------------------------------------------------------------------------------
# le dossier de travail, la base de la production copiée, le conteneur
# ---------------------------------------------------------------------------------------------------------------------------------------------
TRAVAIL=$(mktemp -d "$ACT/travail.XXXXXX")
case "$TRAVAIL" in *"'"*|*:*) rm -rf "$TRAVAIL"; TRAVAIL=''; impossible "chemin de travail inattendu" ;; esac
chmod 755 "$TRAVAIL"
CT=$TRAVAIL/ct; RES=$TRAVAIL/resultats
mkdir "$CT" "$CT/prod" "$RES"
for d in "$CT" "$CT/prod" "$RES"; do
  if [ "$ESSAI" != 1 ]; then chown 65534:65534 "$d"; fi
  chmod 755 "$d"
done
MARQUE_PRODUCTION=$(sed -n 's/^tag=//p' "$PROD/VERSION" | head -n 1)

if ! "$DOCKER" image inspect "$IMAGE" >/dev/null 2>&1; then
  "$DOCKER" pull "$IMAGE" >/dev/null 2>&1 || refuser fabrication "l'image $IMAGE est absente et ne se télécharge pas (image_absente)" "vérifier la connexion du serveur, puis : sudo bash $PROD/activer.sh --reprendre"
fi

# Un conteneur sous les règles de l'atelier : aucun réseau, système de fichiers en lecture seule, aucune capacité, aucun nouveau privilège ; suivi du pic de mémoire (cgroup, sinon docker stats),
# de l'espace libre (sous le minimum le conteneur est arrêté) et du délai. Pose CONT_CODE, CONT_OOM, CONT_DEPASSE, CONT_DISQUE, CONT_PIC_KO ; le journal (200 Ko) est dans $TRAVAIL/journal-<nom>.txt ;
# le conteneur est SUPPRIMÉ avant de rendre la main (plus aucun processus ne change ce qu'il a laissé entre le contrôle de son type et sa lecture).
executer_un_conteneur() { # nom délai surveiller_le_disque arguments de docker run (après les règles)…
  nom=$1; delai=$2; surveiller=$3; shift 3
  CONT_CODE=''; CONT_OOM=false; CONT_DEPASSE=0; CONT_DISQUE=0; CONT_PIC_KO=''
  PARENT_DU_CGROUP=''
  if [ -f "$ETC_SYSTEMD/maverick-atelier.slice" ]; then PARENT_DU_CGROUP='--cgroup-parent maverick-atelier.slice'; fi
  if ! CID=$("$DOCKER" run -d --name "maverick-activation-$nom-$$" --network none --read-only --cap-drop ALL --security-opt no-new-privileges $PARENT_DU_CGROUP "$@" 9>&- 8>&- 2>/dev/null); then
    CID=''; CONT_CODE=docker_refuse; return 0
  fi
  depart=$(date +%s)
  while :; do
    en_marche=$("$DOCKER" inspect -f '{{.State.Running}}' "$CID" 2>/dev/null || echo false)
    releve_du_conteneur
    [ "$en_marche" = true ] || break
    if [ "$surveiller" = 1 ]; then
      mesurer_le_disque "$ACT"
      if [ -n "$DISQUE_LIBRE_KO" ] && [ "$DISQUE_LIBRE_KO" -lt "$DISQUE_MIN_KO" ]; then CONT_DISQUE=1; "$DOCKER" kill "$CID" >/dev/null 2>&1 || true; break; fi
    fi
    if [ $(($(date +%s) - depart)) -ge "$delai" ]; then CONT_DEPASSE=1; "$DOCKER" kill "$CID" >/dev/null 2>&1 || true; break; fi
    sleep "$INTERVALLE"
  done
  CONT_OOM=$("$DOCKER" inspect -f '{{.State.OOMKilled}}' "$CID" 2>/dev/null || echo false)
  CONT_CODE=$("$DOCKER" inspect -f '{{.State.ExitCode}}' "$CID" 2>/dev/null || echo '')
  case "$CONT_CODE" in ''|*[!0-9]*) CONT_CODE=inconnu ;; esac
  { timeout 30 "$DOCKER" logs "$CID" 2>&1 | tail -c "$PLAFOND_JOURNAL" > "$TRAVAIL/journal-$nom.txt"; } 2>/dev/null || : > "$TRAVAIL/journal-$nom.txt"
  "$DOCKER" rm -f "$CID" >/dev/null 2>&1 || true
  CID=''
  return 0
}
releve_du_conteneur() {
  trouve=0
  for base in "$CGROUP/maverick-atelier.slice/docker-$CID.scope" "$CGROUP/maverick-atelier.slice/$CID" "$CGROUP/system.slice/docker-$CID.scope" "$CGROUP/docker/$CID"; do
    [ -d "$base" ] || continue
    trouve=1
    if [ -f "$base/memory.peak" ]; then octets=$(cat "$base/memory.peak" 2>/dev/null || true)
    elif [ -f "$base/memory.current" ]; then octets=$(cat "$base/memory.current" 2>/dev/null || true)
    else octets=''
    fi
    case "$octets" in ''|*[!0-9]*) ;; *) ko=$((octets / 1024)); if [ -z "$CONT_PIC_KO" ] || [ "$ko" -gt "$CONT_PIC_KO" ]; then CONT_PIC_KO=$ko; fi ;; esac
    break
  done
  if [ "$trouve" -eq 0 ]; then
    utilisee=$("$DOCKER" stats --no-stream --format '{{.MemUsage}}' "$CID" 2>/dev/null | awk '{ print $1 }' || true)
    ko=$(printf '%s\n' "$utilisee" | awk '
      match($0, /^[0-9.]+/) { v = substr($0, 1, RLENGTH) + 0; u = substr($0, RLENGTH + 1)
        if (u == "GiB" || u == "GB") printf "%d\n", v * 1048576; else if (u == "MiB" || u == "MB") printf "%d\n", v * 1024; else if (u == "KiB" || u == "kB" || u == "KB") printf "%d\n", v; else if (u == "B") printf "%d\n", v / 1024 }')
    case "$ko" in ''|*[!0-9]*) ;; *) if [ -z "$CONT_PIC_KO" ] || [ "$ko" -gt "$CONT_PIC_KO" ]; then CONT_PIC_KO=$ko; fi ;; esac
  fi
}
# ce que root garde d'un fichier du conteneur : seulement s'il est régulier, non lien, de 256 Ko au plus ; jamais interprété
fichier_du_conteneur() { [ -f "$1" ] && [ ! -L "$1" ] && [ "$(stat -c '%s' "$1" 2>/dev/null || echo 999999999)" -le "$PLAFOND_RESULTAT" ]; }
mot_de() { # fichier expression_sed -> la première valeur, ou vide
  fichier_du_conteneur "$1" || return 0
  head -c "$PLAFOND_RESULTAT" "$1" | sed -n "$2" | head -n 1 || true
}
afficher_le_journal() { # fichier préfixe lignes : sans caractère de commande, 300 caractères au plus par ligne
  fichier_du_conteneur "$1" || return 0
  head -c "$PLAFOND_RESULTAT" "$1" | LC_ALL=C tr -d '\000-\010\013-\037\177' | cut -c1-300 | head -n "${3:-60}" | sed "s/^/activation : $2/" || true
}
liste_blanche_des_raisons() { # mots du conteneur -> seulement ceux que le rapport admet
  for mot in $1; do
    case "$mot" in
      kit_sans_paquet|empreinte|structure|note_manquante|version_en_arriere|paquet_irregulier|contenu|fiches) printf '%s ' "$mot" ;;
    esac
  done
}
raison_du_conteneur() { # code du conteneur -> la phrase ; les échecs de l'environnement
  if [ "$CONT_DISQUE" -eq 1 ]; then printf 'le disque est tombé sous le minimum pendant le travail du conteneur (arrêté)'
  elif [ "$CONT_DEPASSE" -eq 1 ]; then printf 'le conteneur a dépassé le délai de %s s (arrêté)' "$2"
  elif [ "$CONT_OOM" = true ]; then printf 'le conteneur a dépassé son plafond de mémoire de %s (OOMKilled)' "$(ko_en_mo "$PLAFOND_KO")"
  elif [ "$CONT_CODE" = docker_refuse ]; then printf 'Docker refuse de lancer le conteneur'
  else printf 'le conteneur a échoué (code %s)' "$CONT_CODE"; fi
}
# le geste exact de chaque refus du garde-fou 17 et des contrôles du contenu (le premier des raisons qui en a un)
geste_du_refus() { # raisons
  for r in $1; do
    case "$r" in
      kit_sans_paquet|empreinte|paquet_irregulier) printf '%s' "refaire « Effectuer la mise à jour » sur le site de dev (le kit et son paquet viennent de la même mise à jour), puis : sudo bash $PROD/activer.sh --reprendre"; return ;;
      structure) printf '%s' "installer sur le site de dev le kit de la structure du paquet (sudo sh $DEV/mise-a-jour.sh), refaire « Effectuer la mise à jour », puis : sudo bash $PROD/activer.sh --reprendre"; return ;;
      note_manquante) printf '%s' "refaire la mise à jour depuis un site de dev qui porte les notes de version que la production a déjà (une base de dev restaurée trop ancienne ?), puis : sudo bash $PROD/activer.sh --reprendre"; return ;;
      version_en_arriere) printf '%s' "activer un paquet plus récent que la production (une mise à jour nouvelle depuis le site de dev) ; pour revenir en arrière, restaurer une sauvegarde de la production"; return ;;
      contenu) printf '%s' "corriger sur le site de dev la ligne nommée ci-dessus (table, identifiant, règle), refaire « Effectuer la mise à jour », puis : sudo bash $PROD/activer.sh --reprendre"; return ;;
      fiches) printf '%s' "des fiches de la production citent un élément absent du contenu : le garder dans le contenu (ou le dire au propriétaire), refaire « Effectuer la mise à jour », puis : sudo bash $PROD/activer.sh --reprendre"; return ;;
    esac
  done
  printf '%s' "relire les raisons ci-dessus, puis : sudo bash $PROD/activer.sh --reprendre"
}

# la base de la production, copiée à l'instant en lecture seule (comme les sauvegardes) : les contrôles refont une copie, jamais la vraie
sqlite3 -readonly -cmd '.timeout 10000' "$PROD/db/vivante.db" ".backup '$CT/prod/vivante.db'" >/dev/null 2>&1 || refuser controles "la copie de la base de la production n'a pas pu être prise (sqlite3 .backup)" "relancer : sudo bash $PROD/activer.sh --reprendre"
[ ! -f "$PROD/db/vivante.json" ] || cp "$PROD/db/vivante.json" "$CT/prod/vivante.json" 2>/dev/null || true
if [ "$ESSAI" != 1 ]; then chown -R 65534:65534 "$CT/prod"; fi
dire "copie de la base de la production : $(mo "$(stat -c '%s' "$CT/prod/vivante.db")") (les contrôles la refont ; la vraie n'est pas touchée)."

# ---------------------------------------------------------------------------------------------------------------------------------------------
# b. les contrôles, dans un conteneur sans privilège, avec le code du kit
# ---------------------------------------------------------------------------------------------------------------------------------------------
dire "contrôles du kit V$VERSION_KIT dans un conteneur sans réseau ni capacité (empreinte, structure, notes, contenu, base de la production refaite)…"
EN_COMMUN=(-e HOME=/travail/home -e TMPDIR=/travail/tmp -e "PAQUET_NOM=$PAQUET_NOM" -e "EMPREINTE_ATTENDUE=$ANNONCE_EMPREINTE" -e "PLAFOND_PAQUET=$PLAFOND_PAQUET" -e DELAI_DE_LA_COPIE=120
  -e "KIT_VERSION=$VERSION_KIT" -e "KIT_STRUCTURE=$STRUCTURE_KIT" -e "KIT_PAQUET_VERSION=$ANNONCE_VERSION" -e "KIT_PAQUET_EMPREINTE=$ANNONCE_EMPREINTE" -e "KIT_PAQUET_STRUCTURE=$ANNONCE_STRUCTURE" -e "CORRECTIF=$CORRECTIF")
MONTAGES=(-v "$KIT:/kit:ro" -v "$PAQUETS:/paquets:ro" -v "$PROD/site:/production:ro" -v "$PROD/activation-conteneur.sh:/conteneur.sh:ro" -v "$CT:/travail" -v "$RES:/resultats")
debut_controles=$SECONDS
executer_un_conteneur controles 600 0 --user 65534:65534 --pids-limit 1024 --cpus "$CPUS" --memory "${PLAFOND_KO}k" --memory-swap "${PLAFOND_KO}k" --oom-score-adj 500 "${EN_COMMUN[@]}" "${MONTAGES[@]}" "$IMAGE" sh /conteneur.sh controles
afficher_le_journal "$RES/controles.txt" ''
verdict=$(mot_de "$RES/controles.json" 's/^  "verdict": "\([a-z]*\)",$/\1/p')
raisons_lues=$(mot_de "$RES/controles.json" 's/^  "raisons": \[\(.*\)\],$/\1/p' | tr -cd 'a-z_,' | tr ',' ' ')
PAQUET_VERSION_LUE=$(mot_de "$RES/controles.json" 's/^  "version_du_paquet": "\([0-9]*\.[0-9]*\)",$/\1/p')
EMPREINTE_RECUE=$(mot_de "$RES/controles.json" 's/^  "empreinte_du_paquet": "\([0-9a-f]\{64\}\)",$/\1/p')
PROBLEMES=$(mot_de "$RES/controles.json" 's/^  "problemes_du_contenu": \([0-9][0-9]*\),$/\1/p')
FICHES=$(mot_de "$RES/controles.json" 's/^  "fiches": \([0-9][0-9]*\)$/\1/p')
if [ "$CONT_DISQUE" -eq 1 ] || [ "$CONT_DEPASSE" -eq 1 ] || [ "$CONT_OOM" = true ] || [ "$CONT_CODE" = docker_refuse ]; then
  refuser controles "les contrôles n'ont pas abouti : $(raison_du_conteneur "$CONT_CODE" 600)" "voir le journal ($TRAVAIL est effacé : relancer pour en refaire un) ; sudo bash $PROD/activer.sh --reprendre"
fi
case "$CONT_CODE" in
  0) [ "$verdict" = passe ] || refuser controles "les contrôles disent « passe » par leur code mais pas par leur résultat : défaut à corriger avant l'activation" "ne pas relancer : le dire à l'équipe" ;;
  1)
    liste=$(liste_blanche_des_raisons "$raisons_lues")
    [ -n "$liste" ] || liste=controles
    details=''
    for r in $liste; do
      case "$r" in
        empreinte) details="$details ; le paquet reçu a l'empreinte $(printf '%s' "$EMPREINTE_RECUE" | cut -c1-12)…, le kit annonce $(printf '%s' "$ANNONCE_EMPREINTE" | cut -c1-12)…" ;;
        contenu) details="$details ; ${PROBLEMES:-0} problème(s) du contenu (table, identifiant et règle ci-dessus)" ;;
        fiches) details="$details ; des fiches de la production ne passent pas dans ce contenu" ;;
      esac
    done
    refuser "$liste" "le kit V$VERSION_KIT ne s'active pas avec ce paquet (raisons : $(printf '%s' "${liste% }" | sed 's/ /, /g')$details)" "$(geste_du_refus "$liste")"
    ;;
  73|74|75|78) refuser paquet_irregulier "le conteneur a refusé le paquet (code $CONT_CODE : pas un fichier ordinaire, taille inattendue, copie trop lente ou nom refusé)" "refaire « Effectuer la mise à jour » sur le site de dev, puis : sudo bash $PROD/activer.sh --reprendre" ;;
  *) refuser controles "les contrôles ont échoué (code $CONT_CODE) : voir plus haut" "ne pas relancer sans en parler à l'équipe : c'est un défaut à corriger avant l'activation" ;;
esac
dire "contrôles : PASSÉS ($((SECONDS - debut_controles)) s) : paquet V${PAQUET_VERSION_LUE:-$ANNONCE_VERSION}, ${PROBLEMES:-0} problème(s) du contenu, ${FICHES:-0} fiche(s) de la production refaites sur la copie."

# ---------------------------------------------------------------------------------------------------------------------------------------------
# b (suite). toutes les pages de la production, fabriquées depuis ce paquet avec le kit
# ---------------------------------------------------------------------------------------------------------------------------------------------
dire "fabrication de TOUT le site de la production (V${VERSION_PAQUET:-$VERSION_KIT}) depuis le paquet avec le kit V$VERSION_KIT (SITE_MODE=prod)…"
rm -f "$RES/fabrication.json" "$RES/pages.txt" "$RES/version.txt"
debut_fabrication=$SECONDS
executer_un_conteneur fabrication "$DELAI_S" 1 --user 65534:65534 --pids-limit 1024 --cpus "$CPUS" --cpu-shares 128 --memory "${PLAFOND_KO}k" --memory-swap "${PLAFOND_KO}k" --oom-score-adj 500 \
  -e HIDE_EXAMPLES=1 -e SITE_MODE=prod -e "SITE_TAG=v${VERSION_PAQUET:-$VERSION_KIT}" -e SITE_BASE=/ -e "SITE_GOOGLE_CLIENT_ID=$GOOGLE" "${EN_COMMUN[@]}" "${MONTAGES[@]}" "$IMAGE" sh /conteneur.sh fabrication
PAGES=$(mot_de "$RES/pages.txt" 's/^\([0-9][0-9]*\)$/\1/p')
VERSION_FABRIQUEE=$(mot_de "$RES/version.txt" 's/^\([0-9][0-9]*\.[0-9][0-9]*\.[0-9][0-9]*\)$/\1/p')
PIC_PROCESSUS_KO=$(mot_de "$RES/fabrication.json" 's/^ *"pic_ko": *\([0-9][0-9]*\).*/\1/p')
texte_pic='non relevé'; [ -z "$CONT_PIC_KO" ] || texte_pic="$(ko_en_mo "$CONT_PIC_KO")"
texte_pic_processus='inconnu'; [ -z "$PIC_PROCESSUS_KO" ] || texte_pic_processus="$(ko_en_mo "$PIC_PROCESSUS_KO")"
dire "fabrication : ${PAGES:-aucune} page(s) HTML en $((SECONDS - debut_fabrication)) s ; pic de mémoire du conteneur $texte_pic (plafond $(ko_en_mo "$PLAFOND_KO")), d'un processus $texte_pic_processus."
if [ "$CONT_DISQUE" -eq 1 ] || [ "$CONT_DEPASSE" -eq 1 ] || [ "$CONT_OOM" = true ] || [ "$CONT_CODE" != 0 ]; then
  afficher_le_journal "$TRAVAIL/journal-fabrication.txt" '  journal : ' 15
  case "$CONT_CODE" in
    77) refuser empreinte "le conteneur de fabrication a refusé le paquet : sa copie n'a pas l'empreinte que le kit annonce (code 77)" "refaire « Effectuer la mise à jour » sur le site de dev (le paquet est déposé à neuf), puis : sudo bash $PROD/activer.sh --reprendre" ;;
    73|74|75|78) refuser paquet_irregulier "le conteneur de fabrication a refusé le paquet (code $CONT_CODE : pas un fichier ordinaire, taille inattendue, copie trop lente ou nom refusé)" "refaire « Effectuer la mise à jour » sur le site de dev, puis : sudo bash $PROD/activer.sh --reprendre" ;;
  esac
  refuser fabrication "les pages ne se fabriquent pas : $(raison_du_conteneur "$CONT_CODE" "$DELAI_S")" "si c'est la mémoire : libérer de la mémoire ou prendre un serveur plus gros ; sinon c'est un défaut à corriger avant l'activation ; puis : sudo bash $PROD/activer.sh --reprendre"
fi
{ [ -n "$PAGES" ] && [ "$PAGES" -gt 0 ]; } || refuser fabrication "la fabrication a réussi mais aucune page HTML n'a été comptée" "défaut à corriger avant l'activation : le dire à l'équipe"
[ "$VERSION_FABRIQUEE" = "$VERSION_KIT" ] || refuser fabrication "le service fabriqué est de la V${VERSION_FABRIQUEE:-inconnue}, le kit est de la V$VERSION_KIT" "défaut à corriger avant l'activation : le dire à l'équipe"
pages_servies=$(find "$PROD/site" -type f -name '*.html' 2>/dev/null | wc -l | tr -d ' ')
minimum_de_pages=$(( (pages_servies * 90 + 99) / 100 ))
if [ "$PAGES" -lt "$minimum_de_pages" ]; then
  refuser fabrication "le site fabriqué compte $PAGES page(s) HTML, le site servi en compte $pages_servies (au moins 90 %, soit $minimum_de_pages, sont attendues)" "défaut à corriger avant l'activation : le dire à l'équipe ; ou, si le retrait de pages est voulu, le dire avant de poser"
fi
# le code que la production exécutera (`_serveur/`) vient du KIT SEUL : un conteneur sans paquet ni contenu le fabrique (`livrerServeur` du kit) ; celui du conteneur de fabrication, que le
# contenu du site de dev a pu influencer, n'est jamais posé (garde-fou 20 : le code que root fait exécuter ne vient que de GitHub)
rm -rf "$TRAVAIL/serveur-kit"; mkdir "$TRAVAIL/serveur-kit"
if [ "$ESSAI" != 1 ]; then chown 65534:65534 "$TRAVAIL/serveur-kit"; fi
chmod 755 "$TRAVAIL/serveur-kit"
executer_un_conteneur serveur-kit 300 0 --user 65534:65534 --pids-limit 256 --cpus 1 --memory "$MEMOIRE_POSE" --memory-swap "$MEMOIRE_POSE" -e "KIT_VERSION=$VERSION_KIT" \
  -v "$KIT:/kit:ro" -v "$PROD/activation-conteneur.sh:/conteneur.sh:ro" -v "$TRAVAIL/serveur-kit:/serveur-kit" "$IMAGE" sh /conteneur.sh serveur
if [ "$CONT_CODE" != 0 ] || [ "$CONT_DEPASSE" -eq 1 ] || [ "$CONT_OOM" = true ]; then
  refuser fabrication "le service du kit ne se fabrique pas ($(raison_du_conteneur "$CONT_CODE" 300))" "défaut à corriger avant l'activation : le dire à l'équipe"
fi
# après le `docker rm`, plus rien ne peut changer ce qui a été laissé : des dossiers ordinaires, jamais un lien (Docker suit le lien de la source d'un montage)
{ [ -d "$TRAVAIL/serveur-kit" ] && [ ! -L "$TRAVAIL/serveur-kit" ] && [ -d "$TRAVAIL/serveur-kit/_serveur" ] && [ ! -L "$TRAVAIL/serveur-kit/_serveur" ]; } || refuser fabrication "le service du kit n'est pas un dossier ordinaire (lien ou absent)" "défaut à corriger avant l'activation : le dire à l'équipe"
{ [ -d "$TRAVAIL/ct/site" ] && [ ! -L "$TRAVAIL/ct/site" ]; } || refuser fabrication "le site fabriqué n'est pas un dossier ordinaire (lien ou absent)" "défaut à corriger avant l'activation : le dire à l'équipe"
version_du_service_du_kit=$(mot_de "$TRAVAIL/serveur-kit/_serveur/version.json" 's/^.*"version": *"\([0-9][0-9]*\.[0-9][0-9]*\.[0-9][0-9]*\)".*$/\1/p')
[ "$version_du_service_du_kit" = "$VERSION_KIT" ] || refuser fabrication "le service fabriqué depuis le kit seul est de la V${version_du_service_du_kit:-inconnue}, le kit est de la V$VERSION_KIT" "défaut à corriger avant l'activation : le dire à l'équipe"
dire "service du kit : fabriqué par le kit seul (V$VERSION_KIT, sans paquet ni contenu) : c'est lui qui sera posé."
fichiers_de_la_fabrication=$(mot_de "$RES/fabrication.json" 's/^ *"fichiers": *\([0-9][0-9]*\).*/\1/p')
dire "fabrication : PASSÉE ($PAGES pages pour $pages_servies servies, ${fichiers_de_la_fabrication:-inconnu} fichier(s))."

# ---------------------------------------------------------------------------------------------------------------------------------------------
# c. la bascule courte : gel, service arrêté, base mise de côté, site précédent copié, nouveau site posé, service relancé
# ---------------------------------------------------------------------------------------------------------------------------------------------
pose_pages() { # source_hote source_conteneur minimum_pct nom : les pages, sous l'utilisateur maverick-site (_serveur/ remonté en lecture seule par-dessus)
  rm -rf "$TRAVAIL/pose-$4"; mkdir "$TRAVAIL/pose-$4"
  if [ "$ESSAI" != 1 ]; then chown "$UTILISATEUR_DE_POSE" "$TRAVAIL/pose-$4"; fi
  chmod 755 "$TRAVAIL/pose-$4"
  executer_un_conteneur "pose-$4" "$DELAI_POSE_S" 0 --user "$UTILISATEUR_DE_POSE" --pids-limit 128 --cpus 1 --memory "$MEMOIRE_POSE" --memory-swap "$MEMOIRE_POSE" \
    -v "$KIT:/kit:ro" -v "$1:$2:ro" -v "$PROD/site:/site" -v "$PROD/site/_serveur:/site/_serveur:ro" -v "$TRAVAIL/pose-$4:/pose" "$IMAGE" \
    node --no-warnings /kit/client/scripts/poser-un-site.mjs --source "$2" --cible /site --resume /pose/pose.json --minimum-pct "$3" --sans-le-serveur-de-la-source
  [ "$CONT_CODE" = 0 ] && [ "$CONT_DEPASSE" -eq 0 ] && [ "$CONT_OOM" != true ]
}
pose_du_service() { # source_hote nom : le service (_serveur/), sous root dans le conteneur, SANS capacité (le dossier est à root : le propriétaire l'écrit)
  rm -rf "$TRAVAIL/pose-$2"; mkdir "$TRAVAIL/pose-$2"
  chmod 755 "$TRAVAIL/pose-$2"
  executer_un_conteneur "pose-$2" "$DELAI_POSE_S" 0 --user 0:0 --pids-limit 128 --cpus 1 --memory "$MEMOIRE_POSE" --memory-swap "$MEMOIRE_POSE" \
    -v "$KIT:/kit:ro" -v "$1:/nouveau:ro" -v "$PROD/site/_serveur:/serveur" -v "$TRAVAIL/pose-$2:/pose" "$IMAGE" \
    node --no-warnings /kit/client/scripts/poser-un-site.mjs --serveur --source /nouveau --cible /serveur --resume /pose/pose.json
  [ "$CONT_CODE" = 0 ] && [ "$CONT_DEPASSE" -eq 0 ] && [ "$CONT_OOM" != true ]
}
attendre_la_sante() { # version_attendue secondes -> 0 si le service répond, la base est prête et la version est celle attendue ; SANTE_VUE dit ce qui a été vu
  attendue=$1; limite=$(( $(date +%s) + $2 )); SANTE_VUE='aucune réponse du service'
  while :; do
    ligne=$(compose exec -T serveur node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 8787) + '/api/etat/').then((r) => r.json()).then((e) => console.log('etat=' + JSON.stringify({ v: e.version, d: Boolean(e.base && e.base.disponible), a: Boolean(e.base && e.base.a_jour) }))).catch(() => process.exit(1))" 2>/dev/null | tr -d '\r' | sed -n 's/^etat=\(.*\)$/\1/p' | head -n 1 || true)
    if [ -n "$ligne" ]; then
      vue=$(printf '%s' "$ligne" | sed -n 's/^.*"v":"\([0-9][0-9.]*\)".*$/\1/p')
      dispo=$(printf '%s' "$ligne" | sed -n 's/^.*"d":\(true\|false\).*$/\1/p')
      a_jour=$(printf '%s' "$ligne" | sed -n 's/^.*"a":\(true\|false\).*$/\1/p')
      SANTE_VUE="version vue V${vue:-inconnue}, version attendue V$attendue, base disponible : ${dispo:-inconnu}, base à jour : ${a_jour:-inconnu}"
      if [ "$vue" = "$attendue" ] && [ "$dispo" = true ] && [ "$a_jour" = true ]; then return 0; fi
    fi
    [ "$(date +%s)" -lt "$limite" ] || return 1
    sleep "$INTERVALLE"
  done
}
sha_de() { sha256sum "$1" 2>/dev/null | cut -d ' ' -f 1; }
marqueur() { # lignes clé=valeur du marqueur de la bascule
  { printf 'debut=%s\n' "$(date +%s)"; printf 'pose_commencee=%s\n' "$POSE_COMMENCEE"; printf 'precedent_complet=%s\n' "$PRECEDENT_COMPLET"; printf 'sha_base=%s\n' "$SHA_BASE"; } > "$ACT/en-cours.provisoire" && mv -f "$ACT/en-cours.provisoire" "$ACT/en-cours"
}
POSE_COMMENCEE=0
PRECEDENT_COMPLET=0
SHA_BASE=''

# le retour automatique : le site précédent reposé (pages, puis service), la base remise si elle a changé, le service relancé, le gel levé ; jamais d'échec silencieux (RETOUR_COMPLET)
retour_automatique() { # raison phrase
  RAISONS=$1; PHRASE=$2; RETOUR_COMPLET=1
  dire "RETOUR AUTOMATIQUE : $2."
  compose stop serveur >/dev/null 2>&1 || true
  if [ "$POSE_COMMENCEE" -eq 1 ]; then
    if [ "$PRECEDENT_COMPLET" -eq 1 ] && [ -d "$PROD/site.precedent" ] && [ -d "$TRAVAIL" ]; then
      if pose_pages "$PROD/site.precedent" /precedent 0 retour-pages; then dire "pages : le site précédent est reposé."
      else RETOUR_COMPLET=0; dire "ATTENTION les pages du site précédent n'ont pas pu être reposées ($(raison_du_conteneur "$CONT_CODE" "$DELAI_POSE_S"))."; fi
      if [ -d "$PROD/site.precedent/_serveur" ]; then
        if pose_du_service "$PROD/site.precedent/_serveur" retour-service; then dire "service : le code précédent est reposé."
        else RETOUR_COMPLET=0; dire "ATTENTION le service précédent n'a pas pu être reposé ($(raison_du_conteneur "$CONT_CODE" "$DELAI_POSE_S"))."; fi
      fi
    else
      RETOUR_COMPLET=0
      dire "ATTENTION la pose avait commencé mais site.precedent/ n'est pas complet : le site n'a pas pu être remis."
    fi
  fi
  # la base : intacte (le nouveau service ne l'a pas touchée) ou remise telle qu'elle était avant la bascule
  if [ -n "$SHA_BASE" ] && [ -f "$PROD/db/vivante.db" ]; then
    if [ "$(sha_de "$PROD/db/vivante.db")" = "$SHA_BASE" ]; then dire "base de la production : intacte (sha256 $(printf '%s' "$SHA_BASE" | cut -c1-12)…, celle d'avant la bascule)."
    elif [ -f "$ACT/base-avant/vivante.db" ] && [ "$(sha_de "$ACT/base-avant/vivante.db")" = "$SHA_BASE" ]; then
      rm -f "$PROD/db/vivante.db-wal" "$PROD/db/vivante.db-shm" "$PROD/db/vivante.db-journal"
      for suffixe in -journal -wal; do
        [ ! -f "$ACT/base-avant/vivante.db$suffixe" ] || { cp "$ACT/base-avant/vivante.db$suffixe" "$PROD/db/.vivante.db$suffixe.retour.$$" && mv -f -T "$PROD/db/.vivante.db$suffixe.retour.$$" "$PROD/db/vivante.db$suffixe"; } || RETOUR_COMPLET=0
      done
      if cp "$ACT/base-avant/vivante.db" "$PROD/db/.vivante.db.retour.$$" && mv -f -T "$PROD/db/.vivante.db.retour.$$" "$PROD/db/vivante.db"; then
        [ ! -f "$ACT/base-avant/vivante.json" ] || { cp "$ACT/base-avant/vivante.json" "$PROD/db/.vivante.json.retour.$$" && mv -f -T "$PROD/db/.vivante.json.retour.$$" "$PROD/db/vivante.json"; } || true
        dire "base de la production : remise telle qu'elle était (le nouveau service l'avait refaite), sha256 $(printf '%s' "$SHA_BASE" | cut -c1-12)…."
      else
        RETOUR_COMPLET=0; rm -f "$PROD/db/.vivante.db.retour.$$"; dire "ATTENTION la base d'avant ($ACT/base-avant/) n'a pas pu être remise."
      fi
    else
      RETOUR_COMPLET=0
      dire "ATTENTION la base de la production a changé et la copie d'avant ($ACT/base-avant/) n'est pas celle d'avant la bascule : rien n'a été remis."
    fi
  fi
  compose up -d serveur >/dev/null 2>&1 || compose start serveur >/dev/null 2>&1 || { RETOUR_COMPLET=0; dire "ATTENTION le service n'a pas pu être relancé (docker compose up -d serveur, dans $PROD)."; }
  ANCIENNE_VERSION=$(sed -n 's/^.*"version": *"\([0-9][0-9]*\.[0-9][0-9]*\.[0-9][0-9]*\)".*$/\1/p' "$PROD/site/_serveur/version.json" 2>/dev/null | head -n 1 || true)
  if [ -n "$ANCIENNE_VERSION" ] && attendre_la_sante "$ANCIENNE_VERSION" 120; then dire "service : de retour (V$ANCIENNE_VERSION, base prête)."
  else RETOUR_COMPLET=0; dire "ATTENTION le service d'avant ne répond pas comme attendu ($SANTE_VUE)."; fi
  if sh "$PROD/gel.sh" lever >/dev/null 2>&1; then GEL_POSE=0; GEL_LEVE=true; dire "gel des écritures : levé."; else dire "ATTENTION le gel n'a pas pu être levé : sudo sh $PROD/gel.sh lever"; fi
  rm -f "$ACT/en-cours"
  if [ "$RETOUR_COMPLET" -eq 1 ]; then
    GESTE="relire les raisons ci-dessus, corriger, puis : sudo bash $PROD/activer.sh --reprendre"
    ecrire_le_rapport retour_automatique
    dire "== RETOUR AUTOMATIQUE : $2. Le site précédent est remis, le gel est levé, la production a gardé sa base ($((SECONDS - DEBUT)) s)."
  else
    GESTE="le retour automatique est INCOMPLET : sudo bash $PROD/activer.sh --reprendre remet site.precedent/ ; sinon, restaurer la sauvegarde de la production (docs/serveur.md, « PR 5a »)"
    ecrire_le_rapport retour_incomplet
    dire "== RETOUR AUTOMATIQUE INCOMPLET : $2. Voir les ATTENTION ci-dessus. Geste : $GESTE"
  fi
}

# --reprendre après une interruption pendant la bascule : le site précédent d'abord
if [ -e "$ACT/en-cours" ]; then
  dire "reprise : une activation précédente a été interrompue pendant sa bascule : retour au site précédent avant de recommencer."
  POSE_COMMENCEE=$(champ_du_fichier "$ACT/en-cours" pose_commencee); POSE_COMMENCEE=${POSE_COMMENCEE:-1}
  PRECEDENT_COMPLET=$(champ_du_fichier "$ACT/en-cours" precedent_complet); PRECEDENT_COMPLET=${PRECEDENT_COMPLET:-0}
  SHA_BASE=$(champ_du_fichier "$ACT/en-cours" sha_base)
  case "$POSE_COMMENCEE$PRECEDENT_COMPLET" in [01][01]) ;; *) POSE_COMMENCEE=1; PRECEDENT_COMPLET=0 ;; esac
  printf '%s' "$SHA_BASE" | grep -Eq '^[0-9a-f]{64}$' || SHA_BASE=''
  set +e
  retour_automatique interrompue "l'activation précédente avait été interrompue pendant sa bascule"
  set -e
  [ "$RETOUR_COMPLET" -eq 1 ] || exit 1
  RAISONS=''; PHRASE=''; GESTE=''; GEL_LEVE=false; DEBUT=$SECONDS
  POSE_COMMENCEE=0; PRECEDENT_COMPLET=0; SHA_BASE=''
fi

dire "bascule courte : gel des écritures ($DUREE_DU_GEL min au plus), service arrêté, base mise de côté, site précédent copié, nouveau site posé."
sh "$PROD/gel.sh" poser --duree "$DUREE_DU_GEL" --motif "Mise à jour de la production en cours : les écritures reprennent dans quelques minutes" >/dev/null || refuser bascule "le gel des écritures n'a pas pu être posé (gel.sh poser)" "relancer : sudo bash $PROD/activer.sh --reprendre"
GEL_POSE=1
ecrire_le_rapport en_cours
BASCULE_EN_COURS=1
marqueur
set +e
echec_de_la_bascule() { # raison phrase
  BASCULE_EN_COURS=0
  retour_automatique "$1" "$2"
  exit 1
}
compose stop serveur >/dev/null 2>&1 || echec_de_la_bascule bascule "le service n'a pas pu être arrêté (docker compose stop serveur, dans $PROD)"
# le service arrêté : la base ne bouge plus ; son empreinte est celle que le retour automatique vérifiera
if [ -L "$PROD/db/vivante.db" ] || [ ! -f "$PROD/db/vivante.db" ]; then echec_de_la_bascule bascule "db/vivante.db n'est pas un fichier ordinaire"; fi
SHA_BASE=$(sha_de "$PROD/db/vivante.db")
rm -rf "$ACT/base-avant"; mkdir "$ACT/base-avant" && chmod 700 "$ACT/base-avant"
cp "$PROD/db/vivante.db" "$ACT/base-avant/vivante.db" || echec_de_la_bascule bascule "la base de la production n'a pas pu être mise de côté ($ACT/base-avant)"
# un journal resté en place (arrêt brutal : -journal ou -wal non vides) fait partie de la base : il est gardé avec elle et remis avec elle
for suffixe in -journal -wal; do
  if [ -L "$PROD/db/vivante.db$suffixe" ]; then echec_de_la_bascule bascule "db/vivante.db$suffixe est un lien : refusé"; fi
  if [ -s "$PROD/db/vivante.db$suffixe" ]; then
    cp "$PROD/db/vivante.db$suffixe" "$ACT/base-avant/vivante.db$suffixe" || echec_de_la_bascule bascule "db/vivante.db$suffixe n'a pas pu être mis de côté"
    dire "note : db/vivante.db$suffixe est resté en place après l'arrêt du service ($(stat -c '%s' "$PROD/db/vivante.db$suffixe") octets) : gardé avec la base."
  fi
done
[ ! -f "$PROD/db/vivante.json" ] || [ -L "$PROD/db/vivante.json" ] || cp "$PROD/db/vivante.json" "$ACT/base-avant/vivante.json"
[ "$(sha_de "$ACT/base-avant/vivante.db")" = "$SHA_BASE" ] || echec_de_la_bascule bascule "la copie de la base mise de côté n'a pas la même empreinte"
marqueur
dire "base de la production mise de côté : sha256 $(printf '%s' "$SHA_BASE" | cut -c1-12)… ($(mo "$(stat -c '%s' "$PROD/db/vivante.db")"))."
# le site précédent : copié par un conteneur sans capacité (site.precedent/ est à root : le propriétaire l'écrit ; sans CAP_CHOWN la copie ne garde pas les propriétaires, seulement les droits et les dates)
rm -rf "$PROD/site.precedent"
mkdir "$PROD/site.precedent" && chmod 755 "$PROD/site.precedent" || echec_de_la_bascule bascule "site.precedent/ n'a pas pu être créé"
executer_un_conteneur sauver 600 0 --user 0:0 --pids-limit 128 --cpus 1 --memory "$MEMOIRE_POSE" --memory-swap "$MEMOIRE_POSE" -v "$PROD/site:/site:ro" -v "$PROD/site.precedent:/precedent" "$IMAGE" sh -c 'cp -RP --preserve=mode,timestamps /site/. /precedent/ || cp -RP /site/. /precedent/'
if [ "$CONT_CODE" != 0 ] || [ "$CONT_DEPASSE" -eq 1 ] || [ "$CONT_OOM" = true ]; then echec_de_la_bascule bascule "le site n'a pas pu être copié dans site.precedent/ ($(raison_du_conteneur "$CONT_CODE" 600))"; fi
PRECEDENT_COMPLET=1
marqueur
dire "site précédent : copié dans $PROD/site.precedent/ ($(mo "$(( $(ko_de "$PROD/site.precedent") * 1024 ))"))."
POSE_COMMENCEE=1
marqueur
pose_pages "$TRAVAIL/ct/site" /fabrique 90 pages || echec_de_la_bascule bascule "les pages du nouveau site n'ont pas pu être posées ($(raison_du_conteneur "$CONT_CODE" "$DELAI_POSE_S"), code de la pose $CONT_CODE)"
posees=$(mot_de "$TRAVAIL/pose-pages/pose.json" 's/^.*"posees": *\([0-9][0-9]*\).*$/\1/p')
inchangees=$(mot_de "$TRAVAIL/pose-pages/pose.json" 's/^.*"inchangees": *\([0-9][0-9]*\).*$/\1/p')
retirees=$(mot_de "$TRAVAIL/pose-pages/pose.json" 's/^.*"retirees": *\([0-9][0-9]*\).*$/\1/p')
dire "pages posées : ${posees:-inconnu} fichier(s) posé(s), ${inchangees:-inconnu} inchangé(s), ${retirees:-inconnu} retiré(s)."
pose_du_service "$TRAVAIL/serveur-kit/_serveur" service || echec_de_la_bascule bascule "le service du nouveau site n'a pas pu être posé ($(raison_du_conteneur "$CONT_CODE" "$DELAI_POSE_S"), code de la pose $CONT_CODE)"
dire "service posé : le code du kit V$VERSION_KIT est dans $PROD/site/_serveur."

# ---------------------------------------------------------------------------------------------------------------------------------------------
# d. le service relancé et le contrôle de santé
# ---------------------------------------------------------------------------------------------------------------------------------------------
compose up -d serveur >/dev/null 2>&1 || compose start serveur >/dev/null 2>&1 || echec_de_la_bascule sante "le service n'a pas pu être relancé (docker compose up -d serveur, dans $PROD)"
dire "contrôle de santé : /api/etat, base prête, version V$VERSION_KIT (au plus $SANTE_S s)…"
if ! attendre_la_sante "$VERSION_KIT" "$SANTE_S"; then
  echec_de_la_bascule sante "le contrôle de santé a échoué en $SANTE_S s ($SANTE_VUE)"
fi
dire "contrôle de santé : PASSÉ ($SANTE_VUE)."

# ---------------------------------------------------------------------------------------------------------------------------------------------
# e. succès
# ---------------------------------------------------------------------------------------------------------------------------------------------
BASCULE_EN_COURS=0
set -e
if sh "$PROD/gel.sh" lever >/dev/null 2>&1; then GEL_POSE=0; GEL_LEVE=true; dire "gel des écritures : levé."; else dire "ATTENTION le gel n'a pas pu être levé (il se lève seul dans $DUREE_DU_GEL min) : sudo sh $PROD/gel.sh lever"; fi
rm -f "$ACT/en-cours"
if [ -n "$ANNONCE_EMPREINTE" ]; then
  deposer_un_fichier "$ACT/dernier-paquet.json" "$(printf '{"format":"maverick-dernier-paquet/1","version":"%s","lot":"%s","empreinte":"%s","structure":%s,"kit":"%s","active_le":"%s"}' \
    "$ANNONCE_VERSION" "$ANNONCE_LOT" "$ANNONCE_EMPREINTE" "$(jnombre "$ANNONCE_STRUCTURE")" "$VERSION_KIT" "$(date -u '+%Y-%m-%dT%H:%M:%SZ')")" || dire "note : $ACT/dernier-paquet.json n'a pas pu être écrit (le correctif urgent ne le retrouverait pas)."
fi
RAISONS=''
PHRASE="La production est passée à la V${VERSION_PAQUET:-$VERSION_KIT} (kit V$VERSION_KIT) : $PAGES pages, service en bonne santé, gel levé. Le site précédent est gardé dans site.precedent/."
GESTE=''
ecrire_le_rapport passee
dire "== PASSEE : la production est à la V${VERSION_PAQUET:-$VERSION_KIT} (kit V$VERSION_KIT) : $PAGES pages, $((SECONDS - DEBUT)) s, gel levé. Le site précédent est gardé dans $PROD/site.precedent/ jusqu'à la prochaine activation."
exit 0
