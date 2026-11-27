#!/bin/sh
# Le geste : pose, change ou retire la CONNEXION PAR DISCORD d'une instance (décision R310 ; docs/serveur.md, « Connexion par Discord »). Une commande lancée depuis
# le serveur, sur le site de dev comme sur la production (chacune a son réglage) :
#
#   sudo sh /srv/maverick-center-test/discord/discord.sh [option]     (le site de dev)
#   sudo sh /srv/maverick-center/discord/discord.sh [option]          (la production)
#
# Sans option : demande l'identifiant de l'application Discord (portail développeur Discord, « OAuth2 »), son secret (saisi SANS écho, jamais en argument, jamais
# dans un fichier de journal) et l'adresse de retour (une adresse est proposée d'après le domaine de l'instance : Entrée l'accepte). L'adresse doit être déclarée à
# l'identique dans le portail (« OAuth2 », « Redirects »). Le réglage est le fichier secrets/discord.json de l'instance (root 600) ; le service le relit dès qu'il
# change : rien à redémarrer.
#   --adresse <url>        l'adresse de retour (https://…/api/connexion/discord/retour/), sans la proposition ni la question (avec la commande sans option)
#   --role <id> mj|createur   le rôle Discord <id> (clic droit sur le rôle, « Copier l'identifiant des rôles ») donne ce niveau ; le niveau le plus haut des rôles
#                          d'un membre l'emporte. La correspondance est dans le réglage de l'instance, jamais dans le code
#   --sans-role <id>       retire la correspondance de ce rôle
#   --serveur <id>         change le serveur Discord (par défaut celui du jeu : sources/sources.json, discord.guildId)
#   --nouvelle-session     change le secret des sessions : toutes les sessions ouvertes (de cette instance) tombent
#   --etat                 dit ce qui est réglé (identifiant de l'application, serveur, adresse de retour, rôles) ; le secret n'est jamais montré
#   --retirer              retire le réglage : la connexion devient indisponible (le site de dev est alors fermé à tous, hors clés)
# Le secret est lu par la commande puis passé au service, dans son conteneur, par l'entrée standard (docker exec -i, jamais en argument) : le service ne fait que fabriquer le réglage, c'est l'hôte
# qui écrit le fichier (root 600). Rien n'est exigé de l'hôte que bash et docker.
# Réglages (tests seulement) : MAVERICK_DISCORD_DOSSIER (l'instance), MAVERICK_DISCORD_CADDY (le fichier d'environnement de Caddy, qui donne le domaine),
# MAVERICK_ESSAI=1 (ni root ni terminal exigés).
if [ -z "${BASH_VERSION:-}" ]; then exec bash "$0" "$@"; fi
set -euo pipefail
umask 077

ICI=$(cd "$(dirname "$0")" && pwd)
INSTANCE=${MAVERICK_DISCORD_DOSSIER:-$(cd "$ICI/.." && pwd)}
ESSAI=${MAVERICK_ESSAI:-0}
SECRETS=$INSTANCE/secrets
FICHIER=$SECRETS/discord.json
CADDY_ENV=${MAVERICK_DISCORD_CADDY:-/etc/caddy/maverick.env}
CHEMIN_DE_RETOUR=/api/connexion/discord/retour/
USAGE="Usage : sudo sh $0 [--adresse <url>] | --role <id> mj|createur | --sans-role <id> | --serveur <id> | --nouvelle-session | --etat | --retirer"

ACTION=definir
ADRESSE=''
ROLE_ID=''
ROLE_NIVEAU=''
SERVEUR=''
while [ $# -gt 0 ]; do
  case "$1" in
    --adresse) [ $# -ge 2 ] || { echo "$USAGE" >&2; exit 2; }; ADRESSE=$2; shift 2 ;;
    --role) [ $# -ge 3 ] || { echo "$USAGE" >&2; exit 2; }; ACTION=role; ROLE_ID=$2; ROLE_NIVEAU=$3; shift 3 ;;
    --sans-role) [ $# -ge 2 ] || { echo "$USAGE" >&2; exit 2; }; ACTION=sans_role; ROLE_ID=$2; shift 2 ;;
    --serveur) [ $# -ge 2 ] || { echo "$USAGE" >&2; exit 2; }; ACTION=serveur; SERVEUR=$2; shift 2 ;;
    --nouvelle-session) ACTION=nouvelle_session; shift ;;
    --etat) ACTION=etat; shift ;;
    --retirer) ACTION=retirer; shift ;;
    -h|--aide) echo "$USAGE"; exit 0 ;;
    *) echo "$USAGE" >&2; exit 2 ;;
  esac
done
case "$ROLE_ID" in *[!0-9]*) echo "--role / --sans-role : l'identifiant d'un rôle Discord (des chiffres)" >&2; exit 2 ;; esac
case "$SERVEUR" in *[!0-9]*) echo "--serveur : l'identifiant d'un serveur Discord (des chiffres)" >&2; exit 2 ;; esac
case "$ROLE_NIVEAU" in ''|mj|createur) ;; *) echo "--role : le niveau est « mj » ou « createur »" >&2; exit 2 ;; esac

die() { echo "ERREUR : $*" >&2; exit 1; }
[ "$ESSAI" = 1 ] || [ "$(id -u)" -eq 0 ] || die "à lancer en root : sudo sh $0"

# --- l'instance -------------------------------------------------------------------------------------------------------------------------------
env_valeur() { # nom : valeur du .env de l'instance (vide si absente)
  [ -f "$1" ] || return 0
  { sed -n "s/^$2=//p" "$1" | tail -n 1 | tr -d '\r"' | tr -d "'"; } || true
}
[ -f "$INSTANCE/.env" ] || die "$INSTANCE/.env est introuvable : ce n'est pas le dossier d'une instance posée par l'installateur"
EDITION=$(env_valeur "$INSTANCE/.env" MAVERICK_EDITION)
if [ "$EDITION" = 1 ]; then NOM_PAR_DEFAUT=maverick-center-test; INSTANCE_DIT='le site de dev'; else NOM_PAR_DEFAUT=maverick-center; INSTANCE_DIT='la production'; fi
NOM=$(env_valeur "$INSTANCE/.env" MAVERICK_CONTENEUR)
CONTENEUR=${NOM:-$NOM_PAR_DEFAUT}-serveur

# --- état et retrait : sans le conteneur --------------------------------------------------------------------------------------------------------
if [ "$ACTION" = etat ]; then
  if [ ! -f "$FICHIER" ]; then
    if [ "$EDITION" = 1 ]; then echo "Connexion Discord : non réglée. Elle est indisponible sur $INSTANCE_DIT, qui est donc fermé à tous (hors clés)."; else echo "Connexion Discord : non réglée. Elle est indisponible sur $INSTANCE_DIT (le site reste ouvert, comme avant)."; fi
    exit 0
  fi
  # seuls des champs précis sont lus : le secret de l'application et celui des sessions ne sont jamais extraits
  champ() { sed -n "s/.*\"$1\":\"\([^\"]*\)\".*/\1/p" "$FICHIER" | head -n 1; }
  roles=$(sed -n 's/.*"roles":{\([^}]*\)}.*/\1/p' "$FICHIER" | head -n 1 | sed 's/"//g; s/:/ -> /g; s/,/ ; /g')
  echo "Connexion Discord : réglée sur $INSTANCE_DIT. Application : $(champ client_id) (secret posé, non montré). Serveur : $(champ serveur). Adresse de retour : $(champ adresse_de_retour). Rôles : ${roles:-aucun (tout membre est Joueur)}."
  exit 0
fi
if [ "$ACTION" = retirer ]; then
  if [ -f "$FICHIER" ]; then
    rm -f "$FICHIER"
    echo "Connexion Discord retirée de $INSTANCE_DIT : elle est indisponible, et les sessions ouvertes tombent. Le service le prend en compte tout de suite (rien à redémarrer)."
  else
    echo "Aucun réglage Discord : rien à retirer."
  fi
  exit 0
fi

# --- le conteneur du service : il fabrique le réglage (l'hôte l'écrit) ---------------------------------------------------------------------------------------------
command -v docker >/dev/null 2>&1 || die "docker est introuvable sur ce serveur"
[ "$(docker inspect -f '{{.State.Running}}' "$CONTENEUR" 2>/dev/null || true)" = true ] ||
  die "le conteneur $CONTENEUR ne tourne pas (cd $INSTANCE && docker compose up -d), puis relancez cette commande"
docker exec "$CONTENEUR" test -f /site/_serveur/serveur/discord.mjs ||
  die "le service de ce site n'a pas encore le code de la connexion par Discord : installez la dernière livraison, puis relancez"
appeler() { # arguments de la commande : le secret de l'application arrive sur l'entrée standard
  docker exec -i "$CONTENEUR" node --disable-warning=ExperimentalWarning -e "import('/site/_serveur/serveur/discord.mjs').then((m) => m.lancerLaCommande(process.argv.slice(1)))" -- "$@"
}
ecrire_le_reglage() { # le contenu du fichier : posé atomiquement, root seul
  mkdir -p "$SECRETS"
  chmod 700 "$SECRETS"
  tmp=$SECRETS/.discord.json.$$
  printf '%s\n' "$1" > "$tmp"
  chmod 600 "$tmp"
  mv -f "$tmp" "$FICHIER"
}
lire_la_sortie() { # sortie_de_la_commande → REGLAGE (variable globale)
  REGLAGE=$(printf '%s\n' "$1" | sed -n 's/^REGLAGE //p' | head -n 1)
  [ -n "$REGLAGE" ] || die "le service n'a pas rendu de réglage (sortie inattendue) : rien n'a été modifié"
}
adresse_proposee() { # l'adresse de retour d'après le domaine de l'instance : MAVERICK_ADRESSE_PUBLIQUE du .env (le site de dev), sinon MAVERICK_DOMAINE de Caddy
  base=$(env_valeur "$INSTANCE/.env" MAVERICK_ADRESSE_PUBLIQUE)
  if [ -z "$base" ]; then
    domaine=$(env_valeur "$CADDY_ENV" MAVERICK_DOMAINE)
    if [ -n "$domaine" ]; then
      if [ "$EDITION" = 1 ]; then base=https://dev.$domaine; else base=https://$domaine; fi
    fi
  fi
  [ -z "$base" ] || printf '%s%s' "${base%/}" "$CHEMIN_DE_RETOUR"
}

case "$ACTION" in
  definir)
    [ -t 0 ] || [ "$ESSAI" = 1 ] || die "la saisie du secret demande un terminal : lancez la commande dans une session ssh ordinaire"
    echo "Connexion par Discord de $INSTANCE_DIT. Portail développeur Discord : https://discord.com/developers/applications → votre application → « OAuth2 »."
    IFS= read -r -p "Identifiant de l'application (Client ID, des chiffres) : " identifiant || identifiant=''
    IFS= read -r -s -p "Secret de l'application (Client Secret, n'est pas affiché) : " secret || secret=''
    echo
    case "$identifiant" in ''|*[!0-9]*) die "l'identifiant de l'application ne contient que des chiffres : rien n'a été modifié" ;; esac
    [ -n "$secret" ] || die "le secret est vide : rien n'a été modifié"
    if [ -z "$ADRESSE" ]; then
      proposee=$(adresse_proposee)
      if [ -n "$proposee" ]; then
        IFS= read -r -p "Adresse de retour [$proposee] : " ADRESSE || ADRESSE=''
        [ -n "$ADRESSE" ] || ADRESSE=$proposee
      else
        IFS= read -r -p "Adresse de retour (https://<domaine>$CHEMIN_DE_RETOUR) : " ADRESSE || ADRESSE=''
      fi
    fi
    [ -n "$ADRESSE" ] || die "aucune adresse de retour : rien n'a été modifié"
    sortie=$(printf '%s\n' "$secret" | appeler definir "$identifiant" "$ADRESSE") || die "le service a refusé ce réglage : rien n'a été modifié"
    secret=''
    lire_la_sortie "$sortie"
    ecrire_le_reglage "$REGLAGE"
    echo "Connexion par Discord réglée sur $INSTANCE_DIT. Rien à redémarrer."
    echo "À FAIRE dans le portail développeur Discord (« OAuth2 », « Redirects ») : ajoutez exactement cette adresse de retour :"
    echo
    echo "      $ADRESSE"
    echo
    echo "Niveaux : tout membre du serveur est Joueur ; MJ et Créateur se donnent par un rôle Discord : sudo sh $0 --role <id du rôle> mj|createur"
    ;;
  role)
    sortie=$(appeler role "$ROLE_ID" "$ROLE_NIVEAU" </dev/null) || die "le service a refusé : rien n'a été modifié"
    lire_la_sortie "$sortie"
    ecrire_le_reglage "$REGLAGE"
    echo "Le rôle $ROLE_ID donne le niveau « $ROLE_NIVEAU » (recalculé à chaque connexion : les sessions ouvertes gardent leur niveau jusqu'à leur fin, --nouvelle-session les ferme)."
    ;;
  sans_role)
    sortie=$(appeler sans-role "$ROLE_ID" </dev/null) || die "le service a refusé : rien n'a été modifié"
    lire_la_sortie "$sortie"
    ecrire_le_reglage "$REGLAGE"
    echo "Le rôle $ROLE_ID ne donne plus de niveau (les sessions ouvertes gardent leur niveau jusqu'à leur fin, --nouvelle-session les ferme)."
    ;;
  serveur)
    sortie=$(appeler serveur "$SERVEUR" </dev/null) || die "le service a refusé : rien n'a été modifié"
    lire_la_sortie "$sortie"
    ecrire_le_reglage "$REGLAGE"
    echo "Serveur Discord : $SERVEUR. Pensez aux rôles : ceux de l'ancien serveur ne valent plus rien."
    ;;
  nouvelle_session)
    sortie=$(appeler nouvelle-session </dev/null) || die "le service a refusé : rien n'a été modifié"
    lire_la_sortie "$sortie"
    ecrire_le_reglage "$REGLAGE"
    echo "Toutes les sessions de $INSTANCE_DIT sont fermées : chacun doit se reconnecter."
    ;;
esac
