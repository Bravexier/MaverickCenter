#!/bin/sh
# Lanceur des sauvegardes automatiques : posé UNE fois par installer.sh dans /usr/local/lib/maverick-center/, il est ce que les minuteurs systemd exécutent.
#   sh maverick-sauvegarde-lanceur.sh copie|envoi|essai [arguments]
# Les scripts eux-mêmes (copie.sh, envoi.sh, essai.sh, lib.sh) voyagent dans l'installateur de chaque site (dossier sauvegarde/ de l'instance) : ils se
# mettent à jour avec le site de dev, sans aucun geste. Le lanceur prend ceux du site de dev (/srv/maverick-center-test/sauvegarde/), sinon ceux du
# serveur normal, et REFUSE de lancer, en root, des scripts que quelqu'un d'autre que root pourrait modifier (dossier, parent ou fichier à un autre
# propriétaire que root, ou modifiable par le groupe ou les autres).
# Ce fichier ne change presque jamais : une nouvelle version se pose en relançant installer.sh.
set -eu

NOM=${1:-}
[ -n "$NOM" ] || { echo "Usage : sh $0 copie|envoi|essai [arguments]" >&2; exit 2; }
shift
case "$NOM" in copie|envoi|essai) ;; *) echo "Script inconnu : $NOM" >&2; exit 2 ;; esac

NORMAL=${MAVERICK_DIR_NORMAL:-/srv/maverick-center}
TEST=${MAVERICK_DIR_TEST:-/srv/maverick-center-test}

DOSSIER=''
for d in "${MAVERICK_SAUV_SCRIPTS:-$TEST/sauvegarde}" "$NORMAL/sauvegarde"; do
  if [ -f "$d/$NOM.sh" ] && [ -f "$d/lib.sh" ]; then DOSSIER=$d; break; fi
done
[ -n "$DOSSIER" ] || { echo "sauvegarde: ERREUR : scripts introuvables ($TEST/sauvegarde, $NORMAL/sauvegarde) : l'installateur du site de dev ne les a pas posés" >&2; exit 1; }

if [ "${MAVERICK_ESSAI:-0}" != 1 ]; then
  suspects=$(find "$DOSSIER" "$(dirname "$DOSSIER")" -maxdepth 1 \( -path "$DOSSIER" -o -path "$DOSSIER/*" -o -path "$(dirname "$DOSSIER")" \) \
    \( ! -user root -o -perm /022 \) 2>/dev/null | head -n 3 || true)
  if [ -n "$suspects" ]; then
    echo "sauvegarde: ERREUR : refus de lancer $DOSSIER/$NOM.sh : ce n'est pas à root seul ($(echo "$suspects" | tr '\n' ' '))" >&2
    exit 1
  fi
fi
exec bash "$DOSSIER/$NOM.sh" "$@"
