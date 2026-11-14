#!/bin/sh
# Le geste : pose, change ou retire l'accès protégé du site de dev (R275, question 2). Une commande lancée depuis le serveur, saisie au clavier sans écho :
#
#   sudo sh /srv/maverick-center-test/acces/acces.sh [option]
#
# Sans option : demande un mot de passe (deux fois, sans écho) et le pose. Le site de dev le demande alors pour modifier une page, enregistrer un
# prétiré, lancer une mise à jour ou sa simulation, lever la maintenance ; la lecture des pages reste libre. La première fois, la commande fabrique aussi
# une clé de lecture, affichée UNE SEULE FOIS à l'écran : c'est ce que reçoivent les sessions de Claude (en-tête X-Maverick-Cle) pour lire le journal
# d'édition, la page Debug et l'API /api/v1/. Elle ne permet jamais d'écrire. Changer le mot de passe ferme toutes les sessions ouvertes et garde la clé.
#   --cle                  refait la clé de lecture et l'affiche une seule fois ; l'ancienne ne marche plus
#   --portee ecriture|tout « ecriture » (par défaut) : le mot de passe protège les écritures ; « tout » : un seul mot de passe pour tout le site (le
#                          service demande alors la connexion aussi pour ses lectures ; les pages ne se ferment que si Caddy interroge
#                          /api/acces/verifier/ : docs/serveur.md, « Accès au site de dev »). Les sessions ouvertes sont fermées
#   --etat                 dit si l'accès est protégé, la portée, et si une clé de lecture existe (aucun secret n'est montré)
#   --retirer              retire la protection : le site de dev redevient ouvert à tous, comme avant (rien d'autre n'est touché)
# Rien à redémarrer : le service relit le réglage dès qu'il change. Le réglage est le fichier secrets/acces.json de l'instance (root 600 : l'empreinte
# du mot de passe et celle de la clé, jamais leurs valeurs). Le mot de passe est haché par le service lui-même, dans son conteneur (docker exec, entrée
# standard : jamais un argument de commande, jamais un fichier), donc rien n'est exigé de l'hôte. Pas de mot de passe perdu qui enferme dehors : cette
# commande en pose un autre ou retire la protection, sans connaître l'ancien.
# Refuse de tourner sur la production : seul le site de dev (MAVERICK_EDITION=1 dans le .env de l'instance) a un accès protégé.
# Réglages (tests seulement) : MAVERICK_ACCES_DOSSIER (l'instance), MAVERICK_ESSAI=1 (ni root ni terminal exigés).
if [ -z "${BASH_VERSION:-}" ]; then exec bash "$0" "$@"; fi
set -euo pipefail
umask 077

ICI=$(cd "$(dirname "$0")" && pwd)
INSTANCE=${MAVERICK_ACCES_DOSSIER:-$(cd "$ICI/.." && pwd)}
ESSAI=${MAVERICK_ESSAI:-0}
SECRETS=$INSTANCE/secrets
FICHIER=$SECRETS/acces.json
USAGE="Usage : sudo sh $0 [--cle | --portee ecriture|tout | --etat | --retirer]"

ACTION=mot_de_passe
PORTEE=''
while [ $# -gt 0 ]; do
  case "$1" in
    --cle) ACTION=cle; shift ;;
    --etat) ACTION=etat; shift ;;
    --retirer) ACTION=retirer; shift ;;
    --portee) [ $# -ge 2 ] || { echo "$USAGE" >&2; exit 2; }; ACTION=portee; PORTEE=$2; shift 2 ;;
    -h|--aide) echo "$USAGE"; exit 0 ;;
    *) echo "$USAGE" >&2; exit 2 ;;
  esac
done
case "$PORTEE" in ''|ecriture|tout) ;; *) echo "--portee : « ecriture » ou « tout »" >&2; exit 2 ;; esac

die() { echo "ERREUR : $*" >&2; exit 1; }
[ "$ESSAI" = 1 ] || [ "$(id -u)" -eq 0 ] || die "à lancer en root : sudo sh $0"

# --- l'instance : un site de dev seulement ---------------------------------------------------------------------------------------------------
env_valeur() { # nom : valeur du .env de l'instance (vide si absente)
  [ -f "$INSTANCE/.env" ] || return 0
  { sed -n "s/^$1=//p" "$INSTANCE/.env" | tail -n 1 | tr -d '\r"' | tr -d "'"; } || true
}
[ -f "$INSTANCE/.env" ] || die "$INSTANCE/.env est introuvable : ce n'est pas le dossier d'une instance posée par l'installateur"
[ "$(env_valeur MAVERICK_EDITION)" = 1 ] || die "cette instance n'est pas le site de dev (MAVERICK_EDITION=1 absent de $INSTANCE/.env) : la production n'a jamais d'accès protégé, rien n'a été modifié"
NOM=$(env_valeur MAVERICK_CONTENEUR)
CONTENEUR=${NOM:-maverick-center-test}-serveur

# --- état et retrait : sans le conteneur --------------------------------------------------------------------------------------------------------
if [ "$ACTION" = etat ]; then
  if [ ! -f "$FICHIER" ]; then echo "Accès : non protégé (aucun réglage). Le site de dev est ouvert à tous, comme avant."; exit 0; fi
  portee=$(sed -n 's/.*"portee":"\([a-z]*\)".*/\1/p' "$FICHIER" | head -n 1)
  cle=non
  grep -q '"cle_de_lecture":{' "$FICHIER" && cle=oui
  echo "Accès : protégé. Portée : ${portee:-inconnue} (ecriture : le mot de passe protège les écritures ; tout : le service demande la connexion aussi pour ses lectures). Clé de lecture : $cle."
  exit 0
fi
if [ "$ACTION" = retirer ]; then
  if [ -f "$FICHIER" ]; then
    rm -f "$FICHIER"
    echo "Accès retiré : le site de dev est de nouveau ouvert à tous, comme avant. Le service le prend en compte tout de suite (rien à redémarrer)."
  else
    echo "Aucun réglage d'accès : le site de dev est déjà ouvert à tous."
  fi
  exit 0
fi

# --- le conteneur du service : il hache le mot de passe -----------------------------------------------------------------------------------------
command -v docker >/dev/null 2>&1 || die "docker est introuvable sur ce serveur"
[ "$(docker inspect -f '{{.State.Running}}' "$CONTENEUR" 2>/dev/null || true)" = true ] ||
  die "le conteneur $CONTENEUR ne tourne pas (cd $INSTANCE && docker compose up -d), puis relancez cette commande"
docker exec "$CONTENEUR" test -f /site/_serveur/serveur/acces.mjs ||
  die "le service de ce site n'a pas encore le code de l'accès : installez la dernière livraison du site de dev (mise-a-jour.sh), puis relancez"
appeler() { # arguments de la commande : le mot de passe arrive sur l'entrée standard
  docker exec -i "$CONTENEUR" node --disable-warning=ExperimentalWarning -e "import('/site/_serveur/serveur/acces.mjs').then((m) => m.lancerLaCommande(process.argv.slice(1)))" -- "$@"
}
exige_un_terminal() { # la clé de lecture ne s'affiche que sur un terminal (jamais dans un fichier de journal ni un tube)
  if [ "$ESSAI" != 1 ] && [ ! -t 1 ]; then die "la clé de lecture ne s'affiche que sur un terminal : lancez la commande dans une session ssh ordinaire"; fi
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
  echo "  (en-tête X-Maverick-Cle). Elle permet de LIRE (journal d'édition, page Debug, API /api/v1/),"
  echo "  jamais d'écrire. Le serveur n'en garde que l'empreinte : pour en avoir une autre,"
  echo "  sudo sh $0 --cle  (l'ancienne cesse de marcher)."
  echo
  echo "      $1"
  echo "=============================================================================================="
}
lire_la_sortie() { # sortie_de_la_commande → REGLAGE et CLE (variables globales)
  REGLAGE=$(printf '%s\n' "$1" | sed -n 's/^REGLAGE //p' | head -n 1)
  CLE=$(printf '%s\n' "$1" | sed -n 's/^CLE //p' | head -n 1)
  [ -n "$REGLAGE" ] || die "le service n'a pas rendu de réglage (sortie inattendue) : rien n'a été modifié"
}

case "$ACTION" in
  mot_de_passe)
    exige_un_terminal
    [ -t 0 ] || [ "$ESSAI" = 1 ] || die "la saisie du mot de passe demande un terminal : lancez la commande dans une session ssh ordinaire"
    IFS= read -r -s -p "Mot de passe du site de dev (n'est pas affiché, 10 caractères au moins) : " mot || mot=''
    echo
    IFS= read -r -s -p "Encore une fois : " mot2 || mot2=''
    echo
    [ "$mot" = "$mot2" ] || die "les deux saisies diffèrent : rien n'a été modifié"
    [ "${#mot}" -ge 10 ] || die "mot de passe trop court (10 caractères au moins) : rien n'a été modifié"
    sortie=$(printf '%s\n' "$mot" | appeler definir) || die "le service a refusé ce mot de passe : rien n'a été modifié"
    mot=''; mot2=''
    lire_la_sortie "$sortie"
    ecrire_le_reglage "$REGLAGE"
    echo "Mot de passe posé. Le site de dev le demande pour modifier, enregistrer un prétiré, lancer une mise à jour ou sa simulation ; la lecture reste libre."
    echo "Les sessions ouvertes sont fermées. Rien à redémarrer."
    if [ -n "$CLE" ]; then afficher_la_cle "$CLE"; else echo "La clé de lecture est inchangée (--cle pour en refaire une)."; fi
    ;;
  cle)
    exige_un_terminal
    sortie=$(appeler cle </dev/null) || die "le service a refusé : rien n'a été modifié"
    lire_la_sortie "$sortie"
    ecrire_le_reglage "$REGLAGE"
    afficher_la_cle "$CLE"
    ;;
  portee)
    sortie=$(appeler portee "$PORTEE" </dev/null) || die "le service a refusé : rien n'a été modifié"
    lire_la_sortie "$sortie"
    ecrire_le_reglage "$REGLAGE"
    echo "Portée : $PORTEE. Les sessions ouvertes sont fermées : le mot de passe se redemande une fois."
    if [ "$PORTEE" = tout ]; then
      echo "Avec « tout », le service demande la connexion aussi pour ses lectures. Les pages elles-mêmes ne se ferment que si Caddy interroge /api/acces/verifier/ (docs/serveur.md, « Accès au site de dev »)."
    fi
    ;;
esac
