#!/bin/bash
# L'essai de bout en bout de deploy/installateur/activer.sh (tools/essai-activation/README.md) : un cas, « reussite », « refus » ou « retour ».
#   sudo bash tools/essai-activation/lancer.sh <cas>
# Le monde est refait à chaque cas (monde.mjs). Les empreintes sha256 de la base de la production et de l'arbre de site/ sont prises AVANT et APRÈS ; le service est le vrai (docker.mjs).
set -u
CAS=${1:-}
case "$CAS" in reussite|refus|retour|retour-base) ;; *) echo "Usage : bash $0 reussite|refus|retour|retour-base" >&2; exit 2 ;; esac
ICI=$(cd "$(dirname "$0")" && pwd)
export ESSAI_ACTIVATION=${ESSAI_ACTIVATION:-/srv/essai-activation}
R=$ESSAI_ACTIVATION
PROD=$R/maverick-center
DEV=$R/maverick-center-test
export PATH=$R/bin:$PATH
export MAVERICK_DIR_NORMAL=$PROD MAVERICK_DIR_TEST=$DEV MAVERICK_SAUV_DOCKER=$R/bin/docker MAVERICK_ACTIVATION_INTERVALLE=1
arbre() { (cd "$1" && find -P . -type f -print0 | sort -z | xargs -0 sha256sum | sha256sum | cut -c1-16); }
version_servie() { node -e "console.log(JSON.parse(require('fs').readFileSync('$PROD/site/_serveur/version.json','utf8')).version)"; }
node --no-warnings "$ICI/monde.mjs" "$CAS" || exit 2
# le service précédent en marche, comme en production ; puis arrêté proprement pour prendre l'empreinte de la base
docker compose up -d serveur; sleep 6
docker compose exec -T serveur node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/etat/').then(r=>r.json()).then(e=>console.log('avant : service V'+e.version+', base disponible '+e.base.disponible+', à jour '+e.base.a_jour))"
(cd "$PROD" && docker compose stop serveur)
BASE_AVANT=$(sha256sum "$PROD/db/vivante.db" | cut -c1-16)
SITE_AVANT=$(arbre "$PROD/site")
SERVICE_AVANT=$(arbre "$PROD/site/_serveur")
(cd "$PROD" && docker compose up -d serveur); sleep 4
echo "avant : base sha256 $BASE_AVANT, arbre de site/ $SITE_AVANT, V$(version_servie)"
case "$CAS" in
  retour-base) export FAUX_SANTE_MUETTE=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$PROD/activation/kit/kit.json','utf8')).version)") MAVERICK_ACTIVATION_SANTE=25 ;;
  retour) export FAUX_CASSE_LA_VERSION=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$PROD/activation/kit/kit.json','utf8')).version)") MAVERICK_ACTIVATION_SANTE=25 ;;
esac
echo "================ activer.sh ($CAS)"
bash "$PROD/activer.sh"
CODE=$?
echo "================ code de sortie : $CODE"
(cd "$PROD" && docker compose stop serveur)
echo "après : base sha256 $(sha256sum "$PROD/db/vivante.db" | cut -c1-16) (avant : $BASE_AVANT)"
echo "après : arbre de site/ $(arbre "$PROD/site") (avant : $SITE_AVANT), service V$(version_servie)"
[ ! -d "$PROD/site.precedent" ] || echo "après : site.precedent/ $(arbre "$PROD/site.precedent") ; service précédent $(arbre "$PROD/site.precedent/_serveur") (service d'avant : $SERVICE_AVANT)"
echo "gel : $([ -e "$PROD/db/gel.json" ] && echo "POSÉ : $(cat "$PROD/db/gel.json")" || echo 'aucun (levé)')"
echo "marqueur en-cours : $([ -e "$PROD/activation/en-cours" ] && echo présent || echo absent)"
echo "rapport : $(cat "$PROD/activation/rapport.json" 2>/dev/null)"
echo "rapport partagé : $(cmp -s "$PROD/activation/rapport.json" "$PROD/paquets/activation.json" && echo identique || echo DIFFÉRENT)"
echo "traînent dans activation/ : $(ls -A "$PROD/activation" | tr '\n' ' ')"
exit "$CODE"
