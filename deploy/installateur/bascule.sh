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
# Chaque étape écrit une ligne par action ; code 0 si elle a réussi, 1 sinon, 2 pour un usage inconnu.
# Variables (tests) : MAVERICK_DIR_TEST, MAVERICK_DIR_NORMAL (dossiers des instances), MAVERICK_SAUV_DOCKER (docker), MAVERICK_DIR_BASCULE (état ; défaut
# <dev>/.bascule), MAVERICK_BASCULE_SAUVEGARDE (scripts des sauvegardes ; défaut <dev>/sauvegarde), MAVERICK_BASCULE_ATTENTE (secondes d'attente du service),
# MAVERICK_SAUV_HORLOGE (l'horloge, comme les sauvegardes), MAVERICK_ESSAI=1 (root non exigé).
set -euo pipefail
umask 077

usage() { echo "Usage : sudo bash $0 [--dev <dossier>] [--prod <dossier>] etat|geler|degeler|constat|sauvegarder|poser|retirer" >&2; exit 2; }
DEV=${MAVERICK_DIR_TEST:-/srv/maverick-center-test}
PROD=${MAVERICK_DIR_NORMAL:-/srv/maverick-center}
ETAPE=''
while [ $# -gt 0 ]; do
  case "$1" in
    --dev) [ $# -ge 2 ] || usage; DEV=$2; shift 2 ;;
    --prod) [ $# -ge 2 ] || usage; PROD=$2; shift 2 ;;
    etat|geler|degeler|constat|sauvegarder|poser|retirer) [ -z "$ETAPE" ] || usage; ETAPE=$1; shift ;;
    *) usage ;;
  esac
done
[ -n "$ETAPE" ] || usage

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
    if service_actif; then etape "service du site de dev : en marche"; else etape "service du site de dev : arrêté"; fi
    if [ -n "$(lire GEL_LE)" ]; then etape "gel : depuis $(date_de "$(lire GEL_LE)")"; else etape "gel : aucun"; fi
    c=$(lire CONSTAT_LE)
    if [ -n "$c" ]; then
      etape "dernier constat : $(lire CONSTAT) le $(date_de "$c") (il y a $(( ($(instant) - c) / 60 )) min ; valable $((DUREE_DU_CONSTAT / 60)) min pour poser)"
    else etape "dernier constat : aucun"; fi
    if [ "$(lire SAUVEGARDE)" = ok ]; then etape "sauvegarde nommée : $(lire SAUVEGARDE_NOM) le $(date_de "$(lire SAUVEGARDE_LE)") (copie locale et envoi hors du serveur)"; else etape "sauvegarde nommée : aucune réussie"; fi
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
    [ -f "$ETC/stockage.env" ] && [ -f "$ETC/cle-depot" ] || die "l'envoi hors du serveur n'est pas activé ($ETC) : « sudo sh $DEV/sauvegarde/installer.sh --stockage » d'abord"
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
esac
exit 0
