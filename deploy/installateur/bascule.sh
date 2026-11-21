#!/usr/bin/env bash
# Le jour de la bascule 1 : la base du site de dev devient la source de vérité (lot 8 du chantier, docs/chantier-base-de-dev.md, garde-fous 3, 5, 6 ;
# docs/serveur.md, « Base source (lot 8) »). Livré par l'installateur de test à la racine de l'instance du site de dev ; lancé par le propriétaire, en root,
# sur le serveur. Aucun secret : il ne lit ni n'écrit de clé, de jeton ni de mot de passe.
#
# Usage : sudo bash /srv/maverick-center-test/bascule.sh [--dev <dossier>] [--prod <dossier>] <étape>
#   etat         où on en est (marqueur, service, gel, constat, sauvegarde nommée) ; rien n'est modifié
#   geler        gèle les écritures du site de dev : fichier GELER (plus de mise à jour automatique) et service des personnages arrêté (le site reste lisible,
#                /api/ répond 502). L'annonce de maintenance n'arrête pas les écritures : elle ne sert pas ici
#   degeler      relance le service (et retire GELER s'il a été posé par « geler »)
#   constat      écritures gelées : égalité, table de contenu par table de contenu, entre la production (son attestation), la base vivante du site de dev et
#                le fichier des règles installé (le dépôt). Calculé DANS le conteneur du service (scripts/constat-de-bascule.mjs). Code 0 : EGALITE ; 1 : écarts
#   sauvegarder  copie nommée « bascule-1-<date> » des deux bases par les sauvegardes automatiques (copie locale, puis envoi chiffré hors du serveur)
#   poser        pose db/source (date, version, empreinte du contenu, sauvegarde) : refusé sans constat EGALITE de moins d'une heure fait pendant ce gel, et
#                sans sauvegarde nommée réussie depuis ; relance le service et vérifie que /api/etat dit « source: true »
#   retirer      le retour arrière : le marqueur est renommé (rien n'est effacé), le service relancé
#   poser-bascule-2    (lot 11, PR 5a) pose db/bascule-2, le marqueur de la bascule 2 du site de dev : refusé sans db/source ; crée paquets/ de la production (le dossier partagé où le site
#                de dev dépose le paquet de la mise à jour) et le fait monter dans le service du site de dev (MAVERICK_DOSSIER_PAQUETS de son .env, `docker compose up -d serveur`) ; le service lit
#                le marqueur à chaque fois (pas de redémarrage) : avec lui, le bouton refuse un code pas à jour et un contenu rouge, et dépose le paquet pour la production
#   retirer-bascule-2  le retour arrière : le marqueur est renommé (rien n'est effacé ; paquets/ reste), le service du site de dev redevient celui d'avant
#   copies       les copies de la base du site de dev qu'on peut restaurer : locales (type/nom, date, lignes) et, envoi activé, extérieures (restic) ; rien n'est modifié
#   restaurer --copie <type>/<nom>|derniere  ou  restaurer --exterieure <id>|latest
#                remet une copie de la base du site de dev dans db/ (docs/serveur.md, « Restauration de la base du site de dev ») : copie contrôlée (intégrité,
#                comptes de la copie), GELER posé, service arrêté, base en place gardée à part dans <dev>/var/avant-restauration-<date>/ (renommée, jamais
#                effacée), la copie posée, le service relancé. Il migre lui-même la base restaurée (marqueur db/source) ; il dit si un paquet a été figé
#                après la copie. Les lots écrits depuis la copie ne sont que dans la base gardée à part : rien ne les rejoue
# Chaque étape écrit une ligne par action ; code 0 si elle a réussi, 1 sinon, 2 pour un usage inconnu.
# Variables (tests) : MAVERICK_DIR_TEST, MAVERICK_DIR_NORMAL (dossiers des instances), MAVERICK_SAUV_DOCKER (docker), MAVERICK_DIR_BASCULE (état ; défaut
# <dev>/.bascule), MAVERICK_BASCULE_SAUVEGARDE (scripts des sauvegardes ; défaut <dev>/sauvegarde), MAVERICK_BASCULE_ATTENTE (secondes d'attente du service),
# MAVERICK_SAUV_HORLOGE (l'horloge, comme les sauvegardes), MAVERICK_ESSAI=1 (root non exigé).
set -euo pipefail
umask 077

usage() { echo "Usage : sudo bash $0 [--dev <dossier>] [--prod <dossier>] etat|geler|degeler|constat|sauvegarder|poser|retirer|poser-bascule-2|retirer-bascule-2|copies | restaurer --copie <type>/<nom>|derniere | restaurer --exterieure <id>|latest" >&2; exit 2; }
DEV=${MAVERICK_DIR_TEST:-/srv/maverick-center-test}
PROD=${MAVERICK_DIR_NORMAL:-/srv/maverick-center}
ETAPE=''
COPIE=''
EXTERIEURE=''
while [ $# -gt 0 ]; do
  case "$1" in
    --dev) [ $# -ge 2 ] || usage; DEV=$2; shift 2 ;;
    --prod) [ $# -ge 2 ] || usage; PROD=$2; shift 2 ;;
    --copie) [ $# -ge 2 ] || usage; COPIE=$2; shift 2 ;;
    --exterieure) [ $# -ge 2 ] || usage; EXTERIEURE=$2; shift 2 ;;
    etat|geler|degeler|constat|sauvegarder|poser|retirer|poser-bascule-2|retirer-bascule-2|copies|restaurer) [ -z "$ETAPE" ] || usage; ETAPE=$1; shift ;;
    *) usage ;;
  esac
done
[ -n "$ETAPE" ] || usage
# une copie à restaurer, et une seule, pour « restaurer » ; jamais ailleurs
if [ "$ETAPE" = restaurer ]; then
  [ -n "$COPIE$EXTERIEURE" ] && { [ -z "$COPIE" ] || [ -z "$EXTERIEURE" ]; } || usage
  case "$COPIE" in ''|derniere|horaire/*|nuit/*|nommees/*) ;; *) usage ;; esac
  case "$COPIE" in */*/*|*..*) usage ;; esac
  case "$EXTERIEURE" in ''|latest) ;; *[!0-9a-f]*) usage ;; esac
elif [ -n "$COPIE$EXTERIEURE" ]; then usage
fi

etape() { echo "bascule : $*"; }
die() { echo "bascule : REFUS : $*" >&2; exit 1; }
# root seulement (MAVERICK_ESSAI=1 : les tests), comme acces/acces.sh
[ "${MAVERICK_ESSAI:-0}" = 1 ] || [ "$(id -u)" -eq 0 ] || die "à lancer en root : sudo bash $0 $ETAPE"

DEV=${DEV%/}
PROD=${PROD%/}
[ -d "$DEV" ] && [ -f "$DEV/VERSION" ] || die "$DEV n'est pas une instance installée (pas de fichier VERSION) : --dev <dossier du site de dev>"
[ "$(sed -n 's/^mode=//p' "$DEV/VERSION" | head -n 1)" = test ] || die "$DEV n'est pas le site de dev (mode test) : la base source est celle du site de dev"
[ "$DEV" != "$PROD" ] || die "--dev et --prod désignent le même dossier"

# Les fonctions des sauvegardes automatiques (lib.sh : état, horloge, dossier des métriques de chaque instance), avec les dossiers de cette commande.
SCRIPTS=${MAVERICK_BASCULE_SAUVEGARDE:-$DEV/sauvegarde}
[ -f "$SCRIPTS/lib.sh" ] || die "scripts des sauvegardes introuvables ($SCRIPTS) : l'installateur du site de dev les pose dans sauvegarde/"
export MAVERICK_DIR_TEST=$DEV MAVERICK_DIR_NORMAL=$PROD
# shellcheck source=sauvegarde/lib.sh
. "$SCRIPTS/lib.sh"
DOCKER=${MAVERICK_SAUV_DOCKER:-docker}
ETAT_BASCULE=${MAVERICK_DIR_BASCULE:-$DEV/.bascule}/etat
DUREE_DU_CONSTAT=3600
ATTENTE=${MAVERICK_BASCULE_ATTENTE:-180}
MARQUEUR=$DEV/db/source
MARQUEUR_2=$DEV/db/bascule-2

lire() { etat_lire "$ETAT_BASCULE" "$1"; }
noter() { mkdir -p "$(dirname "$ETAT_BASCULE")"; chmod 700 "$(dirname "$ETAT_BASCULE")"; etat_poser_tout "$ETAT_BASCULE" "$@"; }
date_de() { if [ -n "${1:-}" ]; then iso_de "$1"; else echo "jamais"; fi; }
compose() { (cd "$DEV" && "$DOCKER" compose "$@"); }
service_actif() { [ -n "$(compose ps -q --status running serveur 2>/dev/null || true)" ]; }
# Le marqueur se lit seulement s'il est un fichier ordinaire (jamais un lien ni une FIFO posés par le conteneur), et seulement ses premières lignes.
marqueur_pose() { [ -e "$MARQUEUR" ] || [ -L "$MARQUEUR" ]; }
contenu_du_marqueur() { if [ -f "$MARQUEUR" ] && [ ! -L "$MARQUEUR" ]; then head -c 2000 "$MARQUEUR" | head -n 8; fi; }

relancer_le_service() {
  compose start serveur >/dev/null 2>&1 || compose up -d serveur >/dev/null 2>&1 || die "le service du site de dev n'a pas pu être relancé (docker compose up -d serveur, dans $DEV)"
  etape "service du site de dev relancé."
}
retirer_geler() {
  if [ "$(lire GELER_POSE)" = 1 ]; then
    rm -f "$DEV/GELER"
    noter GELER_POSE 0
    etape "fichier GELER retiré : les mises à jour automatiques reprennent."
  fi
}
# /api/etat lu DANS le conteneur (nginx et Caddy demandent un mot de passe ; le service écoute sur PORT, 8787 par défaut) : la ligne « source=true|false ».
source_selon_le_service() {
  compose exec -T serveur node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 8787) + '/api/etat/').then((r) => r.json()).then((e) => console.log('source=' + Boolean(e && e.base && e.base.source))).catch(() => process.exit(1))" 2>/dev/null || true
}

case "$ETAPE" in
  etat)
    if marqueur_pose; then etape "marqueur : POSÉ ($MARQUEUR) : $(contenu_du_marqueur | tr '\n' ' ')"; else etape "marqueur : absent (la base du site de dev est encore refaite depuis les règles)"; fi
    if [ -e "$MARQUEUR_2" ] || [ -L "$MARQUEUR_2" ]; then etape "bascule 2 : marqueur POSÉ ($MARQUEUR_2) : $( { [ -f "$MARQUEUR_2" ] && [ ! -L "$MARQUEUR_2" ] && head -c 1000 "$MARQUEUR_2" | head -n 4 | tr '\n' ' '; } || true)"; else etape "bascule 2 : marqueur absent (le bouton « Effectuer la mise à jour » ne dépose rien pour la production)"; fi
    if service_actif; then etape "service du site de dev : en marche"; else etape "service du site de dev : arrêté"; fi
    if [ -n "$(lire GEL_LE)" ]; then etape "gel : depuis $(date_de "$(lire GEL_LE)")"; else etape "gel : aucun"; fi
    c=$(lire CONSTAT_LE)
    if [ -n "$c" ]; then
      etape "dernier constat : $(lire CONSTAT) le $(date_de "$c") (il y a $(( ($(instant) - c) / 60 )) min ; valable $((DUREE_DU_CONSTAT / 60)) min pour poser)"
    else etape "dernier constat : aucun"; fi
    if [ "$(lire SAUVEGARDE)" = ok ]; then etape "sauvegarde nommée : $(lire SAUVEGARDE_NOM) le $(date_de "$(lire SAUVEGARDE_LE)") (copie locale et envoi hors du serveur)"; else etape "sauvegarde nommée : aucune réussie"; fi
    # l'attestation de la production telle que le service du site de dev la lit (son dossier des métriques) : sans elle, « Copier vers le dépôt », la Simulation et la
    # mise à jour sont refusées (incident du 2026-11-19). Un `stat` seulement, jamais une ouverture.
    m_dev=$(metriques_de_l_instance dev); m_dev=${m_dev#* }
    m_prod=$(metriques_de_l_instance prod); m_prod=${m_prod#* }
    if [ -f "$m_dev/attestation-prod.json" ] && [ ! -L "$m_dev/attestation-prod.json" ]; then
      etape "attestation de la production lue par le site de dev : oui ($m_dev/attestation-prod.json, écrite il y a $(( ($(date +%s) - $(stat -c %Y "$m_dev/attestation-prod.json")) / 60 )) min)"
    else
      etape "attestation de la production lue par le site de dev : NON ($m_dev/attestation-prod.json absente ; la production écrit la sienne dans $m_prod) : « Copier vers le dépôt », la Simulation et la mise à jour seraient refusées. Geste : si $m_prod/attestation-prod.json existe, ajouter MAVERICK_DOSSIER_METRIQUES=$m_prod à $DEV/.env, puis cd $DEV && sudo docker compose up -d ; sinon, la production ne l'a pas encore écrite (elle l'écrit à son démarrage, puis toutes les heures)"
    fi
    ;;

  geler)
    if [ ! -e "$DEV/GELER" ]; then
      : > "$DEV/GELER"
      noter GELER_POSE 1
      etape "fichier GELER posé dans $DEV : plus de mise à jour automatique du site de dev."
    fi
    compose stop serveur >/dev/null 2>&1 || die "le service du site de dev n'a pas pu être arrêté (docker compose stop serveur, dans $DEV)"
    service_actif && die "le service du site de dev tourne encore"
    noter GEL_LE "$(instant)"
    etape "écritures gelées : le service des personnages du site de dev est arrêté (le site reste lisible, /api/ répond 502 jusqu'à « degeler » ou « poser »)."
    ;;

  degeler)
    relancer_le_service
    retirer_geler
    noter GEL_LE ''
    etape "écritures rouvertes."
    ;;

  constat)
    service_actif && die "le service du site de dev tourne : les écritures ne sont pas gelées (« bascule.sh geler » d'abord)"
    [ -n "$(lire GEL_LE)" ] || die "aucun gel en cours (« bascule.sh geler » d'abord)"
    ligne=$(metriques_de_l_instance prod)
    attestation="${ligne#* }/attestation-prod.json"
    [ -f "$attestation" ] && [ ! -L "$attestation" ] || die "attestation de la production introuvable ($attestation) : la production l'écrit à son démarrage (docs/serveur.md, « Extrait du contenu et attestation de la production »)"
    etape "constat dans le conteneur du service du site de dev (attestation de la production : $attestation)…"
    rc=0
    sortie=$(compose run --rm --no-deps -T -v "$attestation:/bascule/attestation-prod.json:ro" serveur \
      node /site/_serveur/scripts/constat-de-bascule.mjs --base /db/vivante.db --regles /site/donnees/maverick.db --attestation /bascule/attestation-prod.json --production /production) || rc=$?
    printf '%s\n' "$sortie" | sed 's/^/bascule : /'
    premiere=$(printf '%s\n' "$sortie" | head -n 1)
    empreinte=$(printf '%s\n' "$sortie" | sed -n 's/^EMPREINTE \([0-9a-f]\{64\}\)$/\1/p' | head -n 1)
    if [ "$rc" -eq 0 ] && [ "${premiere%% *}" = EGALITE ] && [ -n "$empreinte" ]; then
      noter CONSTAT EGALITE CONSTAT_LE "$(instant)" CONSTAT_EMPREINTE "$empreinte"
      etape "constat : EGALITE (valable $((DUREE_DU_CONSTAT / 60)) min pour poser le marqueur)."
    else
      noter CONSTAT DIFFERENCES CONSTAT_LE "$(instant)" CONSTAT_EMPREINTE ''
      die "constat : pas d'égalité (code $rc) : rien ne peut être posé"
    fi
    ;;

  sauvegarder)
    [ -f "$ETC/stockage.env" ] && [ -f "$ETC/cle-depot" ] || die "l'envoi hors du serveur n'est pas activé ($ETC) : « sudo bash $DEV/sauvegarde/installer.sh --stockage » d'abord"
    debut=$(instant)
    nom="bascule-1-$(nom_de_copie "$debut")"
    etape "copie locale des deux bases (copie.sh nuit)…"
    rc=0
    bash "$SCRIPTS/copie.sh" nuit prod dev || rc=$?
    [ "$rc" -eq 0 ] || die "la copie locale n'est pas saine (code $rc : voir la page Debug, bloc Sauvegardes) : rien n'est nommé"
    for inst in prod dev; do
      e="$ETAT/$inst.env"
      copie=$(etat_lire "$e" COPIE_NOM)
      [ "$(etat_lire "$e" COPIE_TYPE)" = nuit ] && [ "$(etat_lire "$e" COPIE_LE)" -ge "$debut" ] 2>/dev/null && [ -d "$SAUV/$inst/nuit/$copie" ] ||
        die "$inst : aucune copie faite à l'instant (état $e)"
      mkdir -p "$SAUV/$inst/nommees"
      [ ! -e "$SAUV/$inst/nommees/$nom" ] || die "$inst : la copie nommée $nom existe déjà"
      cp -al "$SAUV/$inst/nuit/$copie" "$SAUV/$inst/nommees/$nom" || die "$inst : la copie nommée $nom n'a pas pu être posée"
      etape "$inst : copie nommée $nom ($SAUV/$inst/nommees/$nom)."
    done
    etape "envoi chiffré hors du serveur (envoi.sh)…"
    rc=0
    MAVERICK_SAUV_NOMMEE=$nom bash "$SCRIPTS/envoi.sh" || rc=$?
    x="$ETAT/exterieur.env"
    envoyees=" $(etat_lire "$x" ENVOI_INSTANCES) "
    if [ "$rc" -ne 0 ] || [ "$(etat_lire "$x" ENVOI_RESULTAT)" != ok ] || ! [ "$(etat_lire "$x" ENVOI_LE)" -ge "$debut" ] 2>/dev/null ||
      [ "${envoyees#* prod }" = "$envoyees" ] || [ "${envoyees#* dev }" = "$envoyees" ]; then
      noter SAUVEGARDE echec SAUVEGARDE_NOM "$nom" SAUVEGARDE_LE "$debut"
      die "l'envoi de $nom hors du serveur a échoué (code $rc, $(etat_lire "$x" ENVOI_CODE)) : la copie locale est gardée, la sauvegarde nommée n'est pas réussie"
    fi
    noter SAUVEGARDE ok SAUVEGARDE_NOM "$nom" SAUVEGARDE_LE "$debut"
    etape "sauvegarde nommée $nom réussie : copie locale et envoi hors du serveur (étiquette « $nom »)."
    ;;

  poser)
    marqueur_pose && die "$MARQUEUR existe déjà (« bascule.sh etat »)"
    [ -f "$DEV/db/vivante.db" ] || die "$DEV/db/vivante.db est absente : rien à marquer"
    maintenant=$(instant)
    gel=$(lire GEL_LE)
    constat_le=$(lire CONSTAT_LE)
    sauvegarde_le=$(lire SAUVEGARDE_LE)
    [ -n "$gel" ] || die "aucun gel en cours (geler, constat, sauvegarder, puis poser)"
    service_actif && die "le service du site de dev tourne : le gel a été levé depuis le constat (geler, constat, sauvegarder, puis poser)"
    [ "$(lire CONSTAT)" = EGALITE ] && [ -n "$constat_le" ] || die "aucun constat EGALITE (« bascule.sh constat »)"
    [ "$constat_le" -ge "$gel" ] || die "le constat précède le gel en cours : refaites-le (« bascule.sh constat »)"
    [ $((maintenant - constat_le)) -lt "$DUREE_DU_CONSTAT" ] || die "le constat EGALITE date de plus d'une heure ($(date_de "$constat_le")) : refaites-le"
    [ "$(lire SAUVEGARDE)" = ok ] && [ -n "$sauvegarde_le" ] && [ "$sauvegarde_le" -ge "$constat_le" ] ||
      die "aucune sauvegarde nommée réussie depuis le constat (« bascule.sh sauvegarder »)"
    version=$(sed -n 's/^tag=//p' "$DEV/VERSION" | head -n 1)
    provisoire=$(mktemp "$DEV/db/.source.XXXXXX")
    # le fichier provisoire ne reste jamais dans db/, même si le script meurt avant de le renommer
    trap 'rm -f "$provisoire"' EXIT
    {
      echo "format=maverick-source/1"
      echo "pose_le=$(iso_de "$maintenant")"
      echo "version=$version"
      echo "empreinte=$(lire CONSTAT_EMPREINTE)"
      echo "sauvegarde=$(lire SAUVEGARDE_NOM)"
    } > "$provisoire"
    chmod 644 "$provisoire"
    mv -f -T "$provisoire" "$MARQUEUR" || die "le marqueur n'a pas pu être posé"
    trap - EXIT
    noter POSE_LE "$maintenant"
    etape "marqueur posé : $MARQUEUR (version $version, empreinte $(lire CONSTAT_EMPREINTE | cut -c1-12)…, sauvegarde $(lire SAUVEGARDE_NOM))."
    relancer_le_service
    noter GEL_LE ''
    retirer_geler
    reponse=''
    for _ in $(seq 1 "$((ATTENTE / 2 + 1))"); do
      reponse=$(source_selon_le_service)
      case "$reponse" in source=*) break ;; esac
      sleep 2
    done
    if [ "$reponse" = source=true ]; then
      etape "/api/etat dit « source: true » : la base du site de dev est la source de vérité."
    else
      die "le service ne dit pas « source: true » (${reponse:-pas de réponse en $ATTENTE s}) : voir « docker compose logs serveur » dans $DEV ; retour arrière : « bascule.sh retirer »"
    fi
    ;;

  retirer)
    if ! marqueur_pose; then
      etape "aucun marqueur à retirer ($MARQUEUR)."
      exit 0
    fi
    garde="$DEV/db/source-retire-$(nom_de_copie "$(instant)")"
    [ ! -e "$garde" ] || die "$garde existe déjà"
    mv -T "$MARQUEUR" "$garde" || die "le marqueur n'a pas pu être retiré"
    noter RETIRE_LE "$(instant)"
    etape "marqueur retiré (gardé sous $garde) : la base n'est plus la source."
    compose restart serveur >/dev/null 2>&1 || relancer_le_service
    etape "service du site de dev relancé (« bascule.sh etat » pour vérifier)."
    ;;

  poser-bascule-2)
    marqueur_pose || die "$MARQUEUR n'existe pas : la base du site de dev n'est pas encore la source de vérité, et le service n'admet le marqueur de la bascule 2 qu'avec la base source (geste : « bascule.sh etat », puis geler, constat, sauvegarder, poser)"
    { [ ! -e "$MARQUEUR_2" ] && [ ! -L "$MARQUEUR_2" ]; } || die "$MARQUEUR_2 existe déjà (« bascule.sh etat ») : rien à poser"
    PAQUETS_PROD=$PROD/paquets
    if [ -L "$PAQUETS_PROD" ] || { [ -e "$PAQUETS_PROD" ] && [ ! -d "$PAQUETS_PROD" ]; }; then die "$PAQUETS_PROD n'est pas un dossier ordinaire : refus (le site de dev y dépose les paquets de la production)"; fi
    # le service du site de dev doit pouvoir y écrire : son docker-compose.yml monte MAVERICK_DOSSIER_PAQUETS (livré avec le code de la PR 5a)
    grep -q 'MAVERICK_DOSSIER_PAQUETS' "$DEV/docker-compose.yml" 2>/dev/null || die "le docker-compose.yml de $DEV ne monte pas le dossier partagé des paquets (MAVERICK_DOSSIER_PAQUETS) : installer d'abord une livraison de test qui le porte (« sudo sh $DEV/mise-a-jour.sh --force »), puis refaire cette étape ; s'il existe un docker-compose.yml.nouveau, le comparer et le prendre"
    mkdir -p "$PAQUETS_PROD" && chmod 755 "$PAQUETS_PROD" || die "impossible de créer $PAQUETS_PROD"
    etape "dossier partagé des paquets : $PAQUETS_PROD (créé ou déjà là ; le site de dev y dépose le paquet de la mise à jour, l'activation de la production le lit)."
    # le .env du site de dev dit quel dossier monter (jamais écrasé : une ligne de plus seulement)
    if ! grep -q '^MAVERICK_DOSSIER_PAQUETS=' "$DEV/.env" 2>/dev/null; then
      # le dossier (réel) et l'option vide : lecture-écriture (sans eux, le docker-compose.yml ne monte que /dev/null en lecture seule)
      printf 'MAVERICK_DOSSIER_PAQUETS=%s\nMAVERICK_PAQUETS_OPTION=\n' "$PAQUETS_PROD" >> "$DEV/.env" || die "$DEV/.env n'a pas pu être complété (MAVERICK_DOSSIER_PAQUETS=$PAQUETS_PROD)"
      etape ".env du site de dev : MAVERICK_DOSSIER_PAQUETS=$PAQUETS_PROD et MAVERICK_PAQUETS_OPTION= (lecture-écriture) ajoutés."
    else
      etape ".env du site de dev : MAVERICK_DOSSIER_PAQUETS est déjà réglé ($(sed -n 's/^MAVERICK_DOSSIER_PAQUETS=//p' "$DEV/.env" | head -n 1))."
      grep -q '^MAVERICK_PAQUETS_OPTION=' "$DEV/.env" || { printf 'MAVERICK_PAQUETS_OPTION=\n' >> "$DEV/.env" && etape ".env du site de dev : MAVERICK_PAQUETS_OPTION= (lecture-écriture) ajouté."; }
    fi
    provisoire=$(mktemp "$DEV/db/.bascule-2.XXXXXX")
    trap 'rm -f "$provisoire"' EXIT
    {
      echo "format=maverick-bascule-2/1"
      echo "pose_le=$(iso_de "$(instant)")"
      echo "version=$(sed -n 's/^tag=//p' "$DEV/VERSION" | head -n 1)"
      echo "paquets=$PAQUETS_PROD"
    } > "$provisoire"
    chmod 644 "$provisoire"
    mv -f -T "$provisoire" "$MARQUEUR_2" || die "le marqueur n'a pas pu être posé"
    trap - EXIT
    noter BASCULE_2_POSE_LE "$(instant)"
    etape "marqueur posé : $MARQUEUR_2 (lu à chaque fois par le service : sans redémarrage)."
    # le service est recréé pour monter le dossier partagé (le volume est lu au démarrage du conteneur)
    compose up -d serveur >/dev/null 2>&1 || die "le service du site de dev n'a pas pu être recréé (docker compose up -d serveur, dans $DEV) : le marqueur est posé, le dossier partagé ne sera monté qu'à sa prochaine création ; retour arrière : « bascule.sh retirer-bascule-2 »"
    etape "service du site de dev recréé (le dossier partagé des paquets est monté)."
    etape "bascule 2 allumée sur le site de dev : « Effectuer la mise à jour » exige le dernier code installé et un contenu sans problème, puis dépose le paquet dans $PAQUETS_PROD. Rien ne change en production tant que $PROD/activation-par-paquet n'existe pas."
    ;;

  retirer-bascule-2)
    if [ ! -e "$MARQUEUR_2" ] && [ ! -L "$MARQUEUR_2" ]; then
      etape "aucun marqueur de la bascule 2 à retirer ($MARQUEUR_2)."
      exit 0
    fi
    garde="$DEV/db/bascule-2-retire-$(nom_de_copie "$(instant)")"
    [ ! -e "$garde" ] || die "$garde existe déjà"
    mv -T "$MARQUEUR_2" "$garde" || die "le marqueur n'a pas pu être retiré"
    noter BASCULE_2_RETIRE_LE "$(instant)"
    etape "marqueur de la bascule 2 retiré (gardé sous $garde) : le service du site de dev redevient celui d'avant (rien n'est déposé pour la production). $PROD/paquets/ n'est pas touché."
    # le montage aussi : les deux lignes du .env sont retirées (le fichier est réécrit d'un coup), le service recréé (le volume ne se change qu'à la création du conteneur)
    if grep -q '^MAVERICK_\(DOSSIER_PAQUETS\|PAQUETS_OPTION\)=' "$DEV/.env" 2>/dev/null; then
      env_provisoire=$(mktemp "$DEV/.env.XXXXXX")
      if grep -v '^MAVERICK_\(DOSSIER_PAQUETS\|PAQUETS_OPTION\)=' "$DEV/.env" > "$env_provisoire"; chmod --reference="$DEV/.env" "$env_provisoire" 2>/dev/null; mv -f -T "$env_provisoire" "$DEV/.env"; then
        etape ".env du site de dev : MAVERICK_DOSSIER_PAQUETS et MAVERICK_PAQUETS_OPTION retirés (le montage redevient /dev/null en lecture seule)."
      else
        rm -f "$env_provisoire"; etape "ATTENTION $DEV/.env n'a pas pu être nettoyé : retirer à la main les lignes MAVERICK_DOSSIER_PAQUETS et MAVERICK_PAQUETS_OPTION."
      fi
    fi
    compose up -d serveur >/dev/null 2>&1 && etape "service du site de dev recréé (plus de dossier partagé des paquets)." || etape "ATTENTION le service du site de dev n'a pas pu être recréé (docker compose up -d serveur, dans $DEV) : le faire à la main."
    ;;

  copies)
    etape "copies locales de la base du site de dev ($SAUV/dev), de la plus ancienne à la plus récente :"
    n=0
    while IFS= read -r c; do
      [ -n "$c" ] || continue
      meta="$SAUV/dev/$c/copie.meta"
      etape "  $c : $(date_de "$(etat_lire "$meta" INSTANT)"), version $(etat_lire "$meta" VERSION), $(etat_lire "$meta" LIGNES) ligne(s), $(( $(octets_de "$SAUV/dev/$c") / 1048576 )) Mo"
      n=$((n + 1))
    done <<EOF_COPIES
$(copies_de dev horaire nuit nommees)
EOF_COPIES
    [ "$n" -gt 0 ] || etape "  aucune."
    if [ -f "$ETC/stockage.env" ] && [ -f "$ETC/cle-depot" ] && command -v restic >/dev/null 2>&1; then
      etape "copies extérieures (restic, étiquette inst-dev) :"
      ( set -a; . "$ETC/stockage.env"; set +a; export RESTIC_PASSWORD_FILE=$ETC/cle-depot RESTIC_CACHE_DIR=$SAUV/.cache-restic
        restic snapshots --host maverick --tag inst-dev --compact ) 2>&1 | sed 's/^/bascule :   /' || etape "  lecture impossible (accès au stockage ?)"
    else
      etape "copies extérieures : envoi non activé ou restic absent."
    fi
    ;;

  restaurer)
    command -v sqlite3 >/dev/null 2>&1 || die "sqlite3 est absent (apt-get install sqlite3) : la copie ne peut pas être contrôlée"
    prendre_le_verrou 600 || die "une sauvegarde est en cours : réessayez dans quelques minutes"
    REST=''
    trap '[ -z "$REST" ] || rm -rf "$REST"' EXIT
    # 1. la copie choisie, contrôlée avant de toucher à quoi que ce soit
    if [ -n "$EXTERIEURE" ]; then
      [ -f "$ETC/stockage.env" ] && [ -f "$ETC/cle-depot" ] || die "l'envoi hors du serveur n'est pas activé ($ETC) : seules les copies locales se restaurent (--copie)"
      command -v restic >/dev/null 2>&1 || die "restic est absent (apt-get install restic)"
      REST=$(mktemp -d "$SAUV/.restauration.XXXXXX")
      etape "copie extérieure $EXTERIEURE : téléchargement et déchiffrement dans $REST…"
      filtre=()
      [ "$EXTERIEURE" != latest ] || filtre=(--host maverick --tag inst-dev)
      ( set -a; . "$ETC/stockage.env"; set +a; export RESTIC_PASSWORD_FILE=$ETC/cle-depot RESTIC_CACHE_DIR=$SAUV/.cache-restic
        restic restore "$EXTERIEURE" "${filtre[@]}" --target "$REST" ) >/dev/null 2>"$REST.erreur" ||
        { e=$(tail -n 2 "$REST.erreur" | tr '\n' ' ' | cut -c1-200); rm -f "$REST.erreur"; die "la restauration de la copie extérieure a échoué ($e)"; }
      rm -f "$REST.erreur"
      [ "$(find "$REST" -name comptes.tsv | wc -l | tr -d ' ')" = 1 ] || die "la copie extérieure ne rend pas exactement une copie de base (instance du site de dev ?)"
      SOURCE_COPIE=$(dirname "$(find "$REST" -name comptes.tsv)")
      # une copie du SITE DE DEV seulement (un identifiant peut désigner une copie de la production, avec ses fiches) : envoi.sh sauvegarde
      # <sauvegardes>/dev/<type>/<nom>, dont copie.meta dit INSTANCE=dev ; les deux sont exigés, avant toute écriture dans l'instance
      [ "$(basename "$(dirname "$(dirname "$SOURCE_COPIE")")")" = dev ] && [ "$(etat_lire "$SOURCE_COPIE/copie.meta" INSTANCE)" = dev ] ||
        die "la copie extérieure $EXTERIEURE n'est pas une copie du site de dev (instance $(etat_lire "$SOURCE_COPIE/copie.meta" INSTANCE)) : rien n'a été touché"
      NOM_COPIE="extérieure $EXTERIEURE"
    else
      [ "$COPIE" != derniere ] || COPIE=$(derniere_copie dev)
      [ -n "$COPIE" ] || die "aucune copie locale du site de dev ($SAUV/dev)"
      SOURCE_COPIE="$SAUV/dev/$COPIE"
      [ -d "$SOURCE_COPIE" ] || die "copie introuvable : $SOURCE_COPIE (« bascule.sh copies »)"
      NOM_COPIE="locale $COPIE"
    fi
    [ -f "$SOURCE_COPIE/db/vivante.db" ] && [ ! -L "$SOURCE_COPIE/db/vivante.db" ] || die "la copie $NOM_COPIE n'a pas de db/vivante.db"
    controle=$(controle_integrite "$SOURCE_COPIE/db/vivante.db")
    [ "$controle" = ok ] || die "la copie $NOM_COPIE échoue au contrôle d'intégrité ($controle) : rien n'a été touché"
    attendus=$(awk -F'\t' '$1 == "vivante.db"' "$SOURCE_COPIE/comptes.tsv" 2>/dev/null | sort)
    [ -n "$attendus" ] && [ "$(comptes_de "$SOURCE_COPIE/db/vivante.db" vivante.db | sort)" = "$attendus" ] ||
      die "la copie $NOM_COPIE ne compte pas les lignes notées à sa copie (comptes.tsv) : rien n'a été touché"
    instant_copie=$(etat_lire "$SOURCE_COPIE/copie.meta" INSTANT)
    etape "copie $NOM_COPIE contrôlée : $(date_de "$instant_copie"), $(awk -F'\t' '{ s += $3 } END { print s + 0 }' <<<"$attendus") ligne(s)."
    # 2. les écritures gelées : plus de mise à jour automatique, service arrêté
    if [ ! -e "$DEV/GELER" ]; then : > "$DEV/GELER"; noter GELER_POSE 1; etape "fichier GELER posé dans $DEV : plus de mise à jour automatique."; fi
    compose stop serveur >/dev/null 2>&1 || die "le service du site de dev n'a pas pu être arrêté (docker compose stop serveur, dans $DEV)"
    service_actif && die "le service du site de dev tourne encore"
    etape "service du site de dev arrêté."
    # 3. la base en place, gardée à part (renommée sur le même disque : rien n'est copié ni effacé)
    GARDE="$DEV/var/avant-restauration-$(nom_de_copie "$(instant)")"
    [ ! -e "$GARDE" ] || die "$GARDE existe déjà"
    mkdir -p "$DEV/var" && mkdir -m 700 "$GARDE" || die "impossible de créer $GARDE"
    gardes=0
    for f in vivante.db vivante.db-journal vivante.db-wal vivante.db-shm vivante.json; do
      if [ -e "$DEV/db/$f" ] || [ -L "$DEV/db/$f" ]; then mv -T "$DEV/db/$f" "$GARDE/$f" || die "$DEV/db/$f n'a pas pu être mis de côté"; gardes=$((gardes + 1)); fi
    done
    if [ "$gardes" -gt 0 ]; then etape "base en place gardée à part : $GARDE ($gardes fichier(s), jamais effacés par ce script)."
    else etape "aucune base en place dans $DEV/db (perdue) : rien à garder à part."; fi
    # 4. la copie posée d'un coup (fichier provisoire dans db/, puis renommé)
    provisoire="$DEV/db/.vivante.db.restauration.$$"
    cp "$SOURCE_COPIE/db/vivante.db" "$provisoire" && chmod 644 "$provisoire" && mv -T "$provisoire" "$DEV/db/vivante.db" ||
      { rm -f "$provisoire"; die "la copie n'a pas pu être posée dans $DEV/db (la base d'avant est dans $GARDE)"; }
    if [ -f "$SOURCE_COPIE/db/vivante.json" ]; then cp "$SOURCE_COPIE/db/vivante.json" "$DEV/db/.vivante.json.$$" && chmod 644 "$DEV/db/.vivante.json.$$" && mv -T "$DEV/db/.vivante.json.$$" "$DEV/db/vivante.json"; fi
    noter RESTAURE_LE "$(instant)" RESTAURE_DEPUIS "$NOM_COPIE" RESTAURE_GARDE "$GARDE"
    etape "copie $NOM_COPIE posée dans $DEV/db/vivante.db."
    # 5. un paquet figé après la copie : la production a (ou aura) un contenu que la base restaurée n'a pas
    if [ -n "$instant_copie" ] && [ -d "$DEV/db/mise-a-jour" ]; then
      for paquet in "$DEV/db/mise-a-jour"/*.db; do
        [ -f "$paquet" ] || continue
        case "$(basename "$paquet")" in ????????-????-????-????-????????????.db) ;; *) continue ;; esac
        if [ "$(stat -c %Y "$paquet")" -gt "$instant_copie" ]; then
          etape "ATTENTION le paquet $(basename "$paquet" .db | cut -c1-8) a été figé après cette copie : son contenu n'est pas dans la base restaurée ; si la production l'a installé, le service REFUSERA d'en reporter la note (rien n'est écrit ; « ERREUR mise à jour : report de la note… » au journal du service ; sur la page Mise à jour, seulement pour le paquet du lancement en cours) : faire refaire ce contenu sur le site de dev par une session, d'après la note du paquet (docs/serveur.md, « Restauration de la base du site de dev »)."
        fi
      done
    fi
    # 6. le service relancé : avec db/source, il migre la base restaurée sur place (ou refuse de démarrer, la raison au journal)
    relancer_le_service
    retirer_geler
    noter GEL_LE ''
    reponse=''
    for _ in $(seq 1 "$((ATTENTE / 2 + 1))"); do
      reponse=$(source_selon_le_service)
      case "$reponse" in source=*) break ;; esac
      sleep 2
    done
    case "$reponse" in
      source=*) etape "le service répond ($reponse) : base restaurée en service." ;;
      *) die "le service ne répond pas en $ATTENTE s : voir « docker compose logs serveur » dans $DEV (une migration refusée l'arrête) ; la base d'avant est dans $GARDE" ;;
    esac
    etape "les lots écrits après la copie ne sont que dans la base gardée à part ($GARDE) : rien ne les rejoue."
    ;;
esac
exit 0
