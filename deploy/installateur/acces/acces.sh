#!/bin/sh
# Le geste : pose, change ou retire les CLÉS du site de dev (R275, R291 ; le mot de passe est retiré par R310 : le site de dev est fermé, on s'y connecte par
# Discord avec discord.sh). Une commande lancée depuis le serveur :
#
#   sudo sh /srv/maverick-center-test/acces/acces.sh <option>
#
# Les clés ne sont pas des connexions de personnes : ce sont celles des sessions de Claude, de la CI et des workflows (docs/serveur.md, « Accès au site de dev »).
#   --cle                  fabrique la CLÉ DE LECTURE et l'affiche UNE SEULE FOIS à l'écran ; l'ancienne ne marche plus. C'est ce que reçoivent les sessions de Claude (en-tête
#                          X-Maverick-Key ou X-Maverick-Cle) pour lire le journal d'édition, la page Debug et l'API /api/v1/. Elle n'écrit jamais dans le contenu (au plus, tant que
#                          la clé de dépôt n'est pas posée, elle dépose une proposition qui attend le clic d'un Créateur)
#   --cle-de-depot         pose (ou refait) la CLÉ DE DÉPÔT et l'affiche une seule fois (R291). Tant qu'elle n'est pas posée, la clé de lecture dépose une proposition
#                          qui attend le clic d'un Créateur. Une fois posée, la clé de dépôt (ou une session Créateur) dépose un lot que le site APPLIQUE AUSSITÔT, et la clé de
#                          lecture ne dépose plus. À donner aux sessions de Claude, jamais à la CI ni à GitHub (qui n'ont que la clé de lecture)
#   --sans-cle-de-depot    retire la clé de dépôt : retour à l'état sûr (la clé de lecture dépose de nouveau une proposition qui attend le clic)
#   --etat                 dit si une clé de lecture et une clé de dépôt existent (aucun secret n'est montré)
#   --retirer              retire les deux clés (le site de dev reste fermé : seules les sessions Discord de niveau MJ ou Créateur y entrent)
# Rien à redémarrer : le service relit le fichier dès qu'il change. Le fichier est secrets/acces.json de l'instance (root 600 : l'empreinte des clés, jamais
# leurs valeurs). Un fichier d'avant R310, qui porte encore l'empreinte d'un mot de passe, reste lisible : ces champs sont ignorés, et la première commande qui
# réécrit le fichier les retire.
# Refuse de tourner sur la production : seul le site de dev (MAVERICK_EDITION=1 dans le .env de l'instance) a une porte.
# Réglages (tests seulement) : MAVERICK_ACCES_DOSSIER (l'instance), MAVERICK_ESSAI=1 (ni root ni terminal exigés).
if [ -z "${BASH_VERSION:-}" ]; then exec bash "$0" "$@"; fi
set -euo pipefail
umask 077

ICI=$(cd "$(dirname "$0")" && pwd)
INSTANCE=${MAVERICK_ACCES_DOSSIER:-$(cd "$ICI/.." && pwd)}
ESSAI=${MAVERICK_ESSAI:-0}
SECRETS=$INSTANCE/secrets
FICHIER=$SECRETS/acces.json
USAGE="Usage : sudo sh $0 --cle | --cle-de-depot | --sans-cle-de-depot | --etat | --retirer"

ACTION=''
while [ $# -gt 0 ]; do
  case "$1" in
    --cle) ACTION=cle; shift ;;
    --cle-de-depot) ACTION=cle_de_depot; shift ;;
    --sans-cle-de-depot) ACTION=sans_cle_de_depot; shift ;;
    --etat) ACTION=etat; shift ;;
    --retirer) ACTION=retirer; shift ;;
    -h|--aide) echo "$USAGE"; exit 0 ;;
    *) echo "$USAGE" >&2; exit 2 ;;
  esac
done
[ -n "$ACTION" ] || { echo "$USAGE" >&2; exit 2; }

die() { echo "ERREUR : $*" >&2; exit 1; }
[ "$ESSAI" = 1 ] || [ "$(id -u)" -eq 0 ] || die "à lancer en root : sudo sh $0"

# --- l'instance : un site de dev seulement ---------------------------------------------------------------------------------------------------
env_valeur() { # nom : valeur du .env de l'instance (vide si absente)
  [ -f "$INSTANCE/.env" ] || return 0
  { sed -n "s/^$1=//p" "$INSTANCE/.env" | tail -n 1 | tr -d '\r"' | tr -d "'"; } || true
}
[ -f "$INSTANCE/.env" ] || die "$INSTANCE/.env est introuvable : ce n'est pas le dossier d'une instance posée par l'installateur"
[ "$(env_valeur MAVERICK_EDITION)" = 1 ] || die "cette instance n'est pas le site de dev (MAVERICK_EDITION=1 absent de $INSTANCE/.env) : la production n'a jamais de porte, rien n'a été modifié"
NOM=$(env_valeur MAVERICK_CONTENEUR)
CONTENEUR=${NOM:-maverick-center-test}-serveur

# --- état et retrait : sans le conteneur --------------------------------------------------------------------------------------------------------
if [ "$ACTION" = etat ]; then
  if [ ! -f "$FICHIER" ]; then echo "Clés : aucune. Le site de dev est fermé : seules les sessions Discord de niveau MJ ou Créateur y entrent."; exit 0; fi
  cle=non
  grep -q '"cle_de_lecture":{' "$FICHIER" && cle=oui
  depot=non
  grep -q '"cle_de_depot":{' "$FICHIER" && depot=oui
  echo "Clés : clé de lecture : $cle. Clé de dépôt : $depot (oui : un lot déposé avec elle, ou avec une session Créateur, est appliqué aussitôt ; non : un dépôt attend le clic d'un Créateur). Le site de dev est fermé dans tous les cas (session Discord de niveau MJ ou Créateur, ou une de ces clés)."
  exit 0
fi
if [ "$ACTION" = retirer ]; then
  if [ -f "$FICHIER" ]; then
    rm -f "$FICHIER"
    echo "Clés retirées. Le site de dev reste fermé : seules les sessions Discord de niveau MJ ou Créateur y entrent. Le service le prend en compte tout de suite (rien à redémarrer)."
  else
    echo "Aucune clé posée : rien à retirer."
  fi
  exit 0
fi

# --- le conteneur du service : il fabrique les clés ---------------------------------------------------------------------------------------------
command -v docker >/dev/null 2>&1 || die "docker est introuvable sur ce serveur"
[ "$(docker inspect -f '{{.State.Running}}' "$CONTENEUR" 2>/dev/null || true)" = true ] ||
  die "le conteneur $CONTENEUR ne tourne pas (cd $INSTANCE && docker compose up -d), puis relancez cette commande"
docker exec "$CONTENEUR" test -f /site/_serveur/serveur/acces.mjs ||
  die "le service de ce site n'a pas encore le code de l'accès : installez la dernière livraison du site de dev (mise-a-jour.sh), puis relancez"
appeler() { # arguments de la commande
  docker exec -i "$CONTENEUR" node --disable-warning=ExperimentalWarning -e "import('/site/_serveur/serveur/acces.mjs').then((m) => m.lancerLaCommande(process.argv.slice(1)))" -- "$@"
}
exige_un_terminal() { # une clé ne s'affiche que sur un terminal (jamais dans un fichier de journal ni un tube)
  if [ "$ESSAI" != 1 ] && [ ! -t 1 ]; then die "la clé ne s'affiche que sur un terminal : lancez la commande dans une session ssh ordinaire"; fi
}

ecrire_le_reglage() { # le contenu du fichier : posé atomiquement, root seul
  mkdir -p "$SECRETS"
  chmod 700 "$SECRETS"
  tmp=$SECRETS/.acces.json.$$
  printf '%s\n' "$1" > "$tmp"
  chmod 600 "$tmp"
  mv -f "$tmp" "$FICHIER"
}
afficher_la_cle() { # clé
  echo "=============================================================================================="
  echo "  CLÉ DE LECTURE DU SITE DE DEV (affichée une seule fois) : donnez-la aux sessions de Claude"
  echo "  (en-tête X-Maverick-Key ou X-Maverick-Cle). Elle permet de LIRE (journal d'édition, page Debug, API /api/v1/),"
  echo "  jamais d'écrire dans le contenu. Le serveur n'en garde que l'empreinte : pour en avoir une autre,"
  echo "  sudo sh $0 --cle  (l'ancienne cesse de marcher)."
  echo
  echo "      $1"
  echo "=============================================================================================="
}
afficher_la_cle_de_depot() { # clé
  echo "=============================================================================================="
  echo "  CLÉ DE DÉPÔT DU SITE DE DEV (affichée une seule fois) : donnez-la aux sessions de Claude qui déposent des lots"
  echo "  (en-tête X-Maverick-Key ou X-Maverick-Cle, le même formulaire que la clé de lecture). Elle permet de LIRE comme la clé de lecture"
  echo "  ET de déposer un lot de changements que le site APPLIQUE AUSSITÔT (rien n'attend plus le clic d'un Créateur : vous annulez ensuite le lot,"
  echo "  ou une seule de ses lignes, depuis la page Mise à jour). La clé de lecture ne dépose plus. Ne la donnez ni à la CI ni à GitHub."
  echo "  Le serveur n'en garde que l'empreinte : sudo sh $0 --cle-de-depot en fait une autre (l'ancienne cesse de marcher),"
  echo "  sudo sh $0 --sans-cle-de-depot revient au dépôt qui attend le clic d'un Créateur."
  echo
  echo "      $1"
  echo "=============================================================================================="
}
lire_la_sortie() { # sortie_de_la_commande → REGLAGE, CLE et CLE_DE_DEPOT (variables globales)
  REGLAGE=$(printf '%s\n' "$1" | sed -n 's/^REGLAGE //p' | head -n 1)
  CLE=$(printf '%s\n' "$1" | sed -n 's/^CLE //p' | head -n 1)
  CLE_DE_DEPOT=$(printf '%s\n' "$1" | sed -n 's/^CLE_DE_DEPOT //p' | head -n 1)
  [ -n "$REGLAGE" ] || die "le service n'a pas rendu de réglage (sortie inattendue) : rien n'a été modifié"
}

case "$ACTION" in
  cle)
    exige_un_terminal
    sortie=$(appeler cle </dev/null) || die "le service a refusé : rien n'a été modifié"
    lire_la_sortie "$sortie"
    [ -n "$CLE" ] || die "le service n'a pas rendu de clé (sortie inattendue) : rien n'a été modifié"
    ecrire_le_reglage "$REGLAGE"
    afficher_la_cle "$CLE"
    ;;
  cle_de_depot)
    exige_un_terminal
    sortie=$(appeler cle-de-depot </dev/null) || die "le service a refusé : rien n'a été modifié"
    lire_la_sortie "$sortie"
    [ -n "$CLE_DE_DEPOT" ] || die "le service n'a pas rendu de clé de dépôt (sortie inattendue) : rien n'a été modifié"
    ecrire_le_reglage "$REGLAGE"
    afficher_la_cle_de_depot "$CLE_DE_DEPOT"
    ;;
  sans_cle_de_depot)
    sortie=$(appeler sans-cle-de-depot </dev/null) || die "le service a refusé : rien n'a été modifié"
    lire_la_sortie "$sortie"
    ecrire_le_reglage "$REGLAGE"
    echo "Clé de dépôt retirée : la clé de lecture dépose de nouveau une proposition qui attend le clic d'un Créateur. Rien à redémarrer."
    ;;
esac
