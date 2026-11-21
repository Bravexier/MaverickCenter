#!/usr/bin/env bash
# Le transfert du déménagement du serveur (DEMENAGEMENT.md) : emballe sur l'ancien serveur ce que les installateurs ne refabriquent pas, le pose sur le nouveau.
#   sudo bash demenagement.sh emballer [--sortie <dossier>] [--avec-copies] [--sans sauvegardes,caddy]
#   sudo bash demenagement.sh deballer [--a-blanc] [--sans sauvegardes,caddy,copies] <archive>
# Relançable. Jamais d'effacement : ce qui est remplacé est renommé « .avant-demenagement-<date> », et une base n'est jamais écrasée.
#
# EMBALLER (ancien serveur) : refuse tant que les écritures ne sont pas gelées (le service « serveur » des deux instances arrêté, fichier GELER dans chaque instance,
#   minuteurs des sauvegardes arrêtés, aucune ligne mise-a-jour.sh dans le crontab de root). Il copie db/ de chaque instance par la copie « repliée » de
#   controle-demenagement.sh (le fichier d'origine n'est jamais modifié), vérifie PRAGMA integrity_check, range le reste dans un dossier de travail, écrit
#   le manifeste SHA-256 de tous les fichiers et fabrique UNE archive (droits 600). Il refuse aussi tant qu'une unité de l'atelier du site de dev tourne (maverick-atelier.path,
#   .service, -nuit, -jour, -contenu : une fabrication poserait un site pendant la copie) ou qu'une activation est restée à moitié faite (activation/en-cours). Ce qu'elle contient :
#     normal/ et test/ : db/ (sans essai-de-structure/), .env, .github-token, mise-a-jour.env et .log, installateur-courant/ ; test/ : secrets/ ;
#                        normal/ : metriques/ (sans volume-hote.json, refait toutes les 15 minutes)
#     bascule 2 (détectée : <normal>/activation-par-paquet ou <test>/atelier/servir existe ; INFOS : bascule2=1) :
#                        normal/ : activation-par-paquet, paquets/, activation/{reglages.env,rapport.json,dernier-paquet.json,version-en-attente} (jamais kit/ ni base-avant/, qui porte
#                        les fiches), site/ (fabriqué par l'activation ; aucun installateur ne le refait) ;
#                        les deux instances : VERSION (avec site/, elle dit la version du service qu'il porte) ; test/ : atelier/servir, atelier/reglages.env, site/ ; atelier/reglages.env voyage aussi sans bascule 2. db/gel.json ne voyage jamais (un gel est celui d'un serveur)
#     etc-sauvegardes/ : /etc/maverick-sauvegardes (réglages, accès au stockage, phrase de chiffrement) ; sauvegardes/ : les copies locales (--avec-copies)
#     caddy/           : les certificats et la clé de compte de Caddy (évite l'attente des certificats)
#   Jamais : site/ (refabriqué par les installateurs ; en bascule 2 il voyage, voir plus haut), .htpasswd et /etc/caddy/maverick.env (instances.sh refait la paire sur le nouveau serveur), GELER.
# DEBALLER (nouveau serveur, après durcir.sh, outils.sh, instances.sh et les installateurs, SANS « docker compose up ») : vérifie l'archive (manifeste, aucun
#   fichier en trop) et l'état du serveur AVANT de rien poser ; refuse si db/ d'une instance contient déjà autre chose que metriques/ et essai-de-structure/,
#   si /etc/maverick-sauvegardes ou les copies locales ne sont pas vides, si un conteneur ou Caddy tourne. Il pose d'abord tout sauf les bases, puis les bases,
#   vérifie chaque fichier posé contre le manifeste. Il exige la MÊME version installée que sur l'ancien serveur (code 4, avant
#   de rien poser : les commandes pour installer la version exacte sont affichées) ; en bascule 2 la VERSION et site/ viennent de l'archive : la version installée n'est pas comparée. Une archive de
#   bascule 2 exige aussi l'utilisateur système maverick-site, auquel les pages de la production sont rendues après la pose (sauf site/_serveur/, à root). --a-blanc : toutes les
#   vérifications, rien n'est posé.
# Retour arrière (nouveau → ancien) : les mêmes commandes dans l'autre sens ; l'ancien db/ se met d'abord de côté À LA MAIN (mv db db.avant-retour-<date> ; mkdir db).
# Aucun secret n'est affiché. L'archive porte les secrets : à effacer des deux serveurs (et du poste, si un scp l'y a copiée) dès que le nouveau serveur est validé.
#
# Variables (tests) : MAVERICK_ESSAI=1 (root non exigé), MAVERICK_DIR_NORMAL, MAVERICK_DIR_TEST, MAVERICK_DIR_ETC_SAUVEGARDES, MAVERICK_DIR_SAUVEGARDES,
# MAVERICK_DIR_CADDY_DATA, MAVERICK_DOCKER, MAVERICK_SYSTEMCTL, MAVERICK_CRONTAB, MAVERICK_SQLITE3.
set -euo pipefail
umask 077

NORMAL=${MAVERICK_DIR_NORMAL:-/srv/maverick-center}
TEST=${MAVERICK_DIR_TEST:-/srv/maverick-center-test}
ETC_SAUV=${MAVERICK_DIR_ETC_SAUVEGARDES:-/etc/maverick-sauvegardes}
SAUV=${MAVERICK_DIR_SAUVEGARDES:-/srv/maverick-sauvegardes}
CADDY_DATA=${MAVERICK_DIR_CADDY_DATA:-/var/lib/caddy/.local/share/caddy}
DOCKER=${MAVERICK_DOCKER:-docker}
SYSTEMCTL=${MAVERICK_SYSTEMCTL:-systemctl}
CRONTAB=${MAVERICK_CRONTAB:-crontab}
SQLITE3=${MAVERICK_SQLITE3:-sqlite3}
ici="$(cd "$(dirname "$0")" && pwd)"
CONTROLE="$ici/controle-demenagement.sh"
FORMAT=maverick-demenagement/1
STAMP=$(date +%Y%m%d-%H%M%S)

die() { echo "demenagement : REFUS : $*" >&2; exit 1; }
etape() { echo "demenagement : $*"; }
usage() {
  echo "Usage : sudo bash $0 emballer [--sortie <dossier>] [--avec-copies] [--sans sauvegardes,caddy]" >&2
  echo "        sudo bash $0 deballer [--a-blanc] [--sans sauvegardes,caddy,copies] <archive>" >&2
  exit 2
}

ACTION=${1:-}
[ -n "$ACTION" ] || usage
shift
SORTIE=''
AVEC_COPIES=0
SANS=''
A_BLANC=0
ARCHIVE=''
while [ $# -gt 0 ]; do
  case "$1" in
    --sortie) [ "$ACTION" = emballer ] && [ $# -ge 2 ] || usage; SORTIE=$2; shift 2 ;;
    --avec-copies) [ "$ACTION" = emballer ] || usage; AVEC_COPIES=1; shift ;;
    --sans) [ $# -ge 2 ] || usage; SANS=$2; shift 2 ;;
    --a-blanc) [ "$ACTION" = deballer ] || usage; A_BLANC=1; shift ;;
    -*) usage ;;
    *) [ "$ACTION" = deballer ] && [ -z "$ARCHIVE" ] || usage; ARCHIVE=$1; shift ;;
  esac
done
case "$SANS" in *[!a-z,]*) usage ;; esac
sans() { case ",$SANS," in *",$1,"*) return 0 ;; *) return 1 ;; esac; }
[ "${MAVERICK_ESSAI:-0}" = 1 ] || [ "$(id -u)" -eq 0 ] || die "à lancer en root : sudo bash $0 $ACTION"
EST_ROOT=0; [ "$(id -u)" -eq 0 ] && EST_ROOT=1
for c in tar sha256sum "$SQLITE3"; do command -v "$c" >/dev/null 2>&1 || die "$c est absent (sudo apt-get install -y tar coreutils sqlite3)"; done

sha_de() { sha256sum "$1" | cut -d' ' -f1; }
travail=''
partiel=''
nettoyer() { [ -z "$travail" ] || rm -rf "$travail"; [ -z "$partiel" ] || rm -f "$partiel"; }
trap nettoyer EXIT

# ---------------------------------------------------------------------------------------------------------------------------------- vérifications communes
conteneurs_en_marche() { # $1 = dossier d'une instance : son service (« serveur », qui écrit la base) ; nginx peut rester en marche, il ne sert que le site
  local sortie
  sortie=$(cd "$1" && "$DOCKER" compose ps -q --status running serveur 2>/dev/null) || die "docker ne répond pas dans $1 (impossible de savoir si les conteneurs sont arrêtés)"
  [ -n "$sortie" ]
}
unite_active() { "$SYSTEMCTL" is-active --quiet "$1" 2>/dev/null; }
# Jamais « find | grep -q » : sous pipefail, le SIGPIPE de find ferait dire « vide » au-delà de quelques milliers d'entrées. « -print -quit » s'arrête de lui-même.
base_non_vide() { # db/ ne contient que metriques/ et essai-de-structure/ (vides ou non) : vrai si autre chose s'y trouve
  [ -d "$1/db" ] && [ -n "$(find "$1/db/" -mindepth 1 -maxdepth 1 ! -name metriques ! -name essai-de-structure -print -quit)" ]
}
dossier_non_vide() { [ -d "$1" ] && [ -n "$(find "$1/" -mindepth 1 -maxdepth 1 -print -quit)" ]; }
# Le contenu de $2 est-il déjà celui de $1 (une reprise après une panne : ce qui est posé et conforme n'est pas posé deux fois) ?
deja_pose() { [ -e "$2" ] && diff -rq -x essai-de-structure -x metriques "$1" "$2" >/dev/null 2>&1; }
UNITES_ATELIER="maverick-atelier.path maverick-atelier.service maverick-atelier-nuit.timer maverick-atelier-nuit.service maverick-atelier-jour.timer maverick-atelier-jour.service maverick-atelier-contenu.timer maverick-atelier-contenu.service"
version_de() { sed -n 's/^version=//p' "$1/VERSION" 2>/dev/null | head -n 1; }
tag_de() { sed -n 's/^tag=//p' "$1/VERSION" 2>/dev/null | head -n 1; }

# ---------------------------------------------------------------------------------------------------------------------------------- EMBALLER
emballer() {
  local d nom items f
  [ -n "$SORTIE" ] || { if [ -n "${SUDO_USER:-}" ]; then SORTIE=$(getent passwd "$SUDO_USER" | cut -d: -f6); else SORTIE=$(pwd); fi; }
  [ -d "$SORTIE" ] && [ -w "$SORTIE" ] || die "dossier de sortie introuvable ou non inscriptible : $SORTIE"
  for d in "$NORMAL" "$TEST"; do [ -d "$d/db" ] || die "$d/db introuvable : ce n'est pas l'instance attendue"; done

  etape "1/5 les écritures sont-elles gelées ?"
  for d in "$NORMAL" "$TEST"; do
    if conteneurs_en_marche "$d"; then die "le service tourne dans $d : « cd $d && sudo docker compose stop serveur » (DEMENAGEMENT.md, étape « Geler »)"; fi
    [ -e "$d/GELER" ] || die "pas de fichier GELER dans $d : « sudo touch $d/GELER » (une mise à jour automatique installerait pendant la copie)"
  done
  for u in maverick-sauvegarde-horaire.timer maverick-sauvegarde-nuit.timer maverick-sauvegarde-essai.timer; do
    if unite_active "$u"; then die "le minuteur $u tourne : « sudo systemctl stop $u » (DEMENAGEMENT.md, étape « Geler »)"; fi
  done
  for u in $UNITES_ATELIER; do
    if unite_active "$u"; then die "l'unité de l'atelier $u tourne : « sudo systemctl stop $UNITES_ATELIER » (DEMENAGEMENT.md, étape « Geler »)"; fi
  done
  [ ! -e "$NORMAL/activation/en-cours" ] || die "une activation est restée à moitié faite ($NORMAL/activation/en-cours) : « sudo bash $NORMAL/activer.sh --reprendre » sur l'ancien serveur d'abord"
  if "$CRONTAB" -l 2>/dev/null | grep -v '^[[:space:]]*#' | grep -q 'mise-a-jour\.sh'; then
    die "le crontab de root lance encore mise-a-jour.sh : « sudo crontab -e » et mettez les lignes en commentaire (DEMENAGEMENT.md)"
  fi

  local b2=0
  { [ -e "$NORMAL/activation-par-paquet" ] || [ -e "$TEST/atelier/servir" ]; } && b2=1
  travail=$(mktemp -d -p "$SORTIE" .demenagement-travail.XXXXXX)
  chmod 700 "$travail"
  mkdir "$travail/normal" "$travail/test"

  etape "2/5 copie cohérente des bases (les fichiers d'origine ne sont pas modifiés)"
  for nom in normal test; do
    if [ "$nom" = normal ]; then d=$NORMAL; else d=$TEST; fi
    MAVERICK_ESSAI=1 MAVERICK_SQLITE3="$SQLITE3" bash "$CONTROLE" copier-db "$d/db" "$travail/$nom/db"
    if [ -f "$travail/$nom/db/vivante.db" ]; then
      [ "$("$SQLITE3" -readonly "$travail/$nom/db/vivante.db" 'PRAGMA integrity_check;' | head -n 1)" = ok ] || die "la base $nom/db/vivante.db est abîmée (integrity_check) : rien n'est emballé"
      etape "  $nom : vivante.db, integrity_check ok"
      rm -f "$travail/$nom/db/"*.db-wal "$travail/$nom/db/"*.db-shm   # créés dans la copie par la lecture ci-dessus : aucune connexion n'est ouverte, la base est entière sans eux
    else
      echo "demenagement : ATTENTION $nom/db n'a pas de vivante.db (instance jamais démarrée ?)" >&2
    fi
    items=".env .github-token mise-a-jour.env mise-a-jour.log installateur-courant"
    if [ "$nom" = test ]; then items="$items secrets atelier/servir atelier/reglages.env"
    else items="$items activation-par-paquet paquets activation/reglages.env activation/rapport.json activation/dernier-paquet.json activation/version-en-attente"; fi
    [ "$b2" = 1 ] && items="$items VERSION site"
    for f in $items; do
      [ -e "$d/$f" ] || continue
      mkdir -p "$(dirname "$travail/$nom/$f")"
      cp -a "$d/$f" "$travail/$nom/$f"
    done
  done
  if [ -d "$NORMAL/metriques" ]; then
    cp -a "$NORMAL/metriques" "$travail/normal/metriques"
    rm -f "$travail/normal/metriques/volume-hote.json"
  fi

  etape "3/5 réglages des sauvegardes, copies locales, certificats de Caddy"
  if sans sauvegardes; then :
  elif [ -d "$ETC_SAUV" ]; then cp -a "$ETC_SAUV" "$travail/etc-sauvegardes"
  else echo "demenagement : ATTENTION $ETC_SAUV absent : aucune sauvegarde extérieure n'est configurée sur l'ancien serveur" >&2; fi
  if [ "$AVEC_COPIES" = 1 ]; then
    if [ -d "$SAUV" ]; then cp -a "$SAUV" "$travail/sauvegardes"; else echo "demenagement : ATTENTION $SAUV absent : pas de copie locale" >&2; fi
  fi
  if sans caddy; then :
  elif [ -d "$CADDY_DATA" ]; then cp -a "$CADDY_DATA" "$travail/caddy"; rm -rf "$travail/caddy/locks"
  else echo "demenagement : ATTENTION $CADDY_DATA absent : Caddy redemandera ses certificats (adresse à jour dans le DNS exigée)" >&2; fi

  [ -z "$(find "$travail/" -type l -print -quit)" ] || die "l'archive contiendrait des liens symboliques : refusé ($(find "$travail/" -type l | head -n 3 | tr '\n' ' '))"
  {
    echo "format=$FORMAT"
    echo "cree_le=$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
    echo "normal.tag=$(tag_de "$NORMAL")"; echo "normal.version=$(version_de "$NORMAL")"
    echo "test.tag=$(tag_de "$TEST")"; echo "test.version=$(version_de "$TEST")"
    echo "avec_copies=$AVEC_COPIES"
    echo "bascule2=$b2"
  } > "$travail/INFOS"

  etape "4/5 manifeste SHA-256"
  (cd "$travail" && find . -type f ! -name MANIFEST.sha256 -print0 | LC_ALL=C sort -z | xargs -0 sha256sum > MANIFEST.sha256)
  local nombre; nombre=$(wc -l < "$travail/MANIFEST.sha256" | tr -d ' ')

  etape "5/5 archive"
  local archive="$SORTIE/demenagement-$STAMP.tar.gz"
  [ ! -e "$archive" ] || die "$archive existe déjà"
  partiel="$archive.partiel"
  tar -C "$travail" -czpf "$partiel" . || die "l'archive n'a pas pu être écrite (place ?)"
  chmod 600 "$partiel"
  mv "$partiel" "$archive"
  partiel=''
  if [ "$EST_ROOT" = 1 ] && [ -n "${SUDO_USER:-}" ]; then chown "$SUDO_USER" "$archive"; fi
  echo
  echo "Archive : $archive ($(du -h "$archive" | cut -f1), $nombre fichiers)"
  echo "Empreinte de l'archive (à retrouver à l'arrivée) : $(sha_de "$archive")"
  echo "Elle contient des secrets : droits 600, à effacer dès que le nouveau serveur est validé."
}

# ---------------------------------------------------------------------------------------------------------------------------------- DEBALLER
destination_de() { # chemin du manifeste (./normal/…) → chemin posé
  case "$1" in
    ./normal/*) echo "$NORMAL/${1#./normal/}" ;;
    ./test/*) echo "$TEST/${1#./test/}" ;;
    ./etc-sauvegardes/*) echo "$ETC_SAUV/${1#./etc-sauvegardes/}" ;;
    ./sauvegardes/*) echo "$SAUV/${1#./sauvegardes/}" ;;
    ./caddy/*) echo "$CADDY_DATA/${1#./caddy/}" ;;
    *) return 1 ;;
  esac
}
mettre_de_cote() { # renomme (jamais n'efface) ce qui est remplacé
  if [ -e "$1" ] || [ -L "$1" ]; then mv "$1" "$1.avant-demenagement-$STAMP"; echo "demenagement :   $1 déjà présent : mis de côté (.avant-demenagement-$STAMP)"; fi
}

# Pose $1 en $2 d'un seul coup (voir plus bas) ; déjà posé et identique : rien à faire.
poser() {
  local src=$1 dest=$2 tmp
  if deja_pose "$src" "$dest"; then echo "demenagement :   $dest : déjà posé, conforme"; return 0; fi
  tmp="$dest.nouveau-$STAMP"
  mkdir -p "$(dirname "$dest")"
  cp -a "$src" "$tmp" || die "la pose de $dest a échoué (place ?) : rien n'est à moitié posé ; relancez la même commande ($tmp peut être effacé)"
  mettre_de_cote "$dest"
  mv "$tmp" "$dest"
}

deballer() {
  local d nom f groupe src
  [ -n "$ARCHIVE" ] && [ -f "$ARCHIVE" ] || die "archive introuvable : $ARCHIVE"
  travail=$(mktemp -d -p "$(cd "$(dirname "$ARCHIVE")" && pwd)" .demenagement-travail.XXXXXX)
  chmod 700 "$travail"

  etape "1/6 lecture et vérification de l'archive (rien n'est encore posé)"
  tar -xzpf "$ARCHIVE" -C "$travail" || die "archive illisible ou tronquée (le transfert a-t-il été complet ? comparez son empreinte avec celle de l'emballage)"
  [ -f "$travail/MANIFEST.sha256" ] && [ -f "$travail/INFOS" ] || die "ce n'est pas une archive de déménagement (MANIFEST.sha256 ou INFOS manque)"
  [ "$(sed -n 's/^format=//p' "$travail/INFOS")" = "$FORMAT" ] || die "format d'archive inconnu"
  (cd "$travail" && sha256sum -c --quiet MANIFEST.sha256 >/dev/null 2>&1) || {
    (cd "$travail" && sha256sum -c MANIFEST.sha256 2>&1 | grep -v ': OK$' | head -n 10) >&2 || true
    die "le contenu ne correspond pas au manifeste : archive altérée ou abîmée"
  }
  diff <(cd "$travail" && find . -type f ! -name MANIFEST.sha256 | LC_ALL=C sort) <(sed 's/^[0-9a-f]\{64\}  //' "$travail/MANIFEST.sha256" | LC_ALL=C sort) >/dev/null ||
    die "l'archive contient des fichiers que le manifeste ne couvre pas (ou en manque) : refusée"
  [ -z "$(find "$travail/" -type l -print -quit)" ] || die "l'archive contient des liens symboliques : refusée"
  etape "  manifeste : $(wc -l < "$travail/MANIFEST.sha256" | tr -d ' ') fichiers, tous conformes"

  etape "2/6 ce serveur est-il prêt à recevoir ?"
  for nom in normal test; do
    if [ "$nom" = normal ]; then d=$NORMAL; else d=$TEST; fi
    if [ -f "$travail/$nom/VERSION" ]; then [ -f "$d/docker-compose.yml" ] || die "$d n'est pas installé : posez d'abord les sites par les installateurs (DEMENAGEMENT.md), sans « docker compose up »"
    elif [ -f "$d/VERSION" ] && [ -f "$d/docker-compose.yml" ]; then :
    else die "$d n'est pas installé : posez d'abord les sites par les installateurs (DEMENAGEMENT.md), sans « docker compose up »"
    fi
    if conteneurs_en_marche "$d"; then
      die "le service tourne dans $d : il a pu créer une base NEUVE. « cd $d && sudo docker compose down », puis « sudo mv $d/db $d/db.neuve-$STAMP && sudo mkdir $d/db » (rien ne s'efface), puis relancez"
    fi
    if base_non_vide "$d" && ! deja_pose "$travail/$nom/db" "$d/db"; then
      die "$d/db n'est pas vide ($(find "$d/db/" -mindepth 1 -maxdepth 1 ! -name metriques ! -name essai-de-structure -printf '%f ' | cut -c1-120)) : une base ne s'écrase jamais. Si c'est une base neuve créée par erreur : « sudo mv $d/db $d/db.neuve-$STAMP && sudo mkdir $d/db » ; si c'est une vraie base, ARRÊTEZ-VOUS et collez l'écran"
    fi
  done
  # La MÊME version des deux côtés : la base de l'ancien serveur est celle de SA version ; on la contrôle puis on la démarre telle quelle, et la mise à jour vient après,
  # par le cron normal, sur une base déjà contrôlée. Refus AVANT de rien poser (une fois db/source posé, l'installateur refuserait de revenir à une version plus ancienne).
  local ecart=0 ancien nouveau
  for nom in normal test; do
    if [ "$nom" = normal ]; then d=$NORMAL; else d=$TEST; fi
    ancien=$(sed -n "s/^$nom.tag=//p" "$travail/INFOS"); nouveau=$(tag_de "$d")
    # bascule 2 : la VERSION et site/ (donc le service) viennent de l'archive, rien à comparer
    if [ -f "$travail/$nom/VERSION" ]; then continue; fi
    if [ -n "$ancien" ] && [ "$ancien" != "$nouveau" ]; then
      echo "demenagement : VERSION $nom : l'ancien serveur est en $ancien, celui-ci en ${nouveau:-inconnue}. Installez la version EXACTE de l'ancien (rien n'est encore posé) :" >&2
      echo "    mkdir -p ~/installateurs-de-l-ancien && tar -xzpf $ARCHIVE -C ~/installateurs-de-l-ancien ./$nom/installateur-courant" >&2
      echo "    sudo sh ~/installateurs-de-l-ancien/$nom/installateur-courant/<le fichier .sh> --dossier $d" >&2
      ecart=1
    fi
  done
  if [ "$ecart" = 1 ]; then echo "demenagement : puis relancez la même commande (code 4 : versions différentes)." >&2; exit 4; fi
  if [ "$(sed -n 's/^bascule2=//p' "$travail/INFOS")" = 1 ] && [ "${MAVERICK_ESSAI:-0}" != 1 ] && ! id maverick-site >/dev/null 2>&1; then
    die "l'archive est celle d'un serveur en bascule 2 : l'utilisateur système maverick-site manque (l'installateur de production le crée quand le fichier activation-par-paquet existe : « sudo touch $NORMAL/activation-par-paquet » avant lui, puis refaire l'installation, DEMENAGEMENT.md, étape 3)"
  fi
  if [ -d "$travail/etc-sauvegardes" ] && ! sans sauvegardes && dossier_non_vide "$ETC_SAUV" && ! deja_pose "$travail/etc-sauvegardes" "$ETC_SAUV"; then die "$ETC_SAUV n'est pas vide et n'est pas celui de l'archive : des sauvegardes sont déjà configurées ici (--sans sauvegardes pour ne pas y toucher)"; fi
  if [ -d "$travail/sauvegardes" ] && ! sans copies && dossier_non_vide "$SAUV" && ! deja_pose "$travail/sauvegardes" "$SAUV"; then die "$SAUV n'est pas vide et n'est pas celui de l'archive (--sans copies pour ne pas y toucher)"; fi
  if [ -d "$travail/caddy" ] && ! sans caddy && unite_active caddy; then die "Caddy tourne : « sudo systemctl stop caddy » avant (il réécrirait ses certificats), puis « sudo systemctl start caddy » après"; fi
  if [ "$A_BLANC" = 1 ]; then
    echo
    echo "A BLANC : l'archive est conforme et ce serveur est prêt ; rien n'a été posé."
    return 0
  fi

  # Chaque élément est posé d'un seul coup : copié à côté (« .nouveau-<date> »), puis renommé en place ; ce qui y était est mis de côté, jamais effacé. Une panne
  # (session coupée, disque plein) laisse donc un élément entier ou rien ; ce qui est déjà posé et conforme n'est pas reposé : la commande se relance telle quelle.
  etape "3/6 configuration, secrets, installateurs, métriques (les fichiers remplacés sont mis de côté)"
  for nom in normal test; do
    if [ "$nom" = normal ]; then d=$NORMAL; else d=$TEST; fi
    for f in .env .github-token mise-a-jour.env mise-a-jour.log installateur-courant secrets activation-par-paquet paquets activation/reglages.env activation/rapport.json activation/dernier-paquet.json activation/version-en-attente VERSION atelier/servir atelier/reglages.env site; do
      [ -e "$travail/$nom/$f" ] || continue
      poser "$travail/$nom/$f" "$d/$f"
    done
    [ ! -d "$d/secrets" ] || { chmod 700 "$d/secrets"; find "$d/secrets" -type f -exec chmod 600 {} +; }
    [ ! -f "$d/.github-token" ] || chmod 600 "$d/.github-token"
  done
  # metriques/ : celui du serveur neuf ne porte que volume-hote.json (refait toutes les 15 minutes) ; sur un serveur qui en a un vrai (retour arrière), il est mis de côté
  if [ -d "$travail/normal/metriques" ]; then poser "$travail/normal/metriques" "$NORMAL/metriques"; fi

  # Bascule 2 : les pages de la production appartiennent à maverick-site, sauf site/_serveur/ (le code que le service exécute, à root), comme les pose l'installateur (activation-pose.sh).
  # La pose a gardé les propriétaires de l'ancien serveur (des numéros), qui ne sont pas ceux de celui-ci.
  if [ "$EST_ROOT" = 1 ] && [ -d "$travail/normal/site/_serveur" ] && id maverick-site >/dev/null 2>&1; then
    find -P "$NORMAL/site" -path "$NORMAL/site/_serveur" -prune -o -exec chown -h maverick-site:maverick-site {} +
    find -P "$NORMAL/site/_serveur" -exec chown -h root:root {} +
    etape "  site/ de la production rendu à maverick-site (sauf _serveur/, à root)"
  fi

  etape "4/6 sauvegardes, copies locales, certificats de Caddy"
  if [ -d "$travail/etc-sauvegardes" ] && ! sans sauvegardes; then
    poser "$travail/etc-sauvegardes" "$ETC_SAUV"; chmod 700 "$ETC_SAUV"; find "$ETC_SAUV" -type f -exec chmod 600 {} +
  fi
  if [ -d "$travail/sauvegardes" ] && ! sans copies; then poser "$travail/sauvegardes" "$SAUV"; chmod 700 "$SAUV"; fi
  if [ -d "$travail/caddy" ] && ! sans caddy; then poser "$travail/caddy" "$CADDY_DATA"; fi

  etape "5/6 les bases (en dernier : une panne avant ce point laisse db/ vide ; une panne après laisse une base entière ; la commande se relance)"
  for nom in normal test; do
    if [ "$nom" = normal ]; then d=$NORMAL; else d=$TEST; fi
    [ -d "$travail/$nom/db" ] || continue
    poser "$travail/$nom/db" "$d/db"
  done

  etape "6/6 vérification de chaque fichier posé contre le manifeste"
  local h p dest erreurs=0 n=0
  while IFS= read -r l; do
    h=${l%% *}; p=${l#*  }
    dest=$(destination_de "$p") || continue
    n=$((n + 1))
    case "$p" in ./*/db/essai-de-structure/*) continue ;; esac
    if [ "$(sha_de "$dest" 2>/dev/null || echo manque)" != "$h" ]; then echo "demenagement : ÉCART $dest" >&2; erreurs=$((erreurs + 1)); fi
  done < "$travail/MANIFEST.sha256"
  [ "$erreurs" -eq 0 ] || die "$erreurs fichier(s) posé(s) ne correspondent pas au manifeste : ne démarrez rien"
  etape "  $n fichiers posés et conformes"

  echo
  echo "Versions : les mêmes que l'ancien serveur ($(tag_de "$NORMAL"), $(tag_de "$TEST"))."
  if [ "$(sed -n 's/^bascule2=//p' "$travail/INFOS")" = 1 ]; then echo "Bascule 2 : interrupteurs, paquets, réglages de l'atelier et pages posés ; les unités de l'atelier et son interrupteur se refont après le démarrage (DEMENAGEMENT.md)."; fi
echo "Posé. Aucun conteneur n'est démarré. Suite : contrôle d'égalité (DEMENAGEMENT.md)."
  return 0
}

case "$ACTION" in
  emballer) emballer ;;
  deballer) deballer ;;
  *) usage ;;
esac
