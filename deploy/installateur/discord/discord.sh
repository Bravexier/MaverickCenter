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
#   --role <id>… joueur|mj|createur   les rôles Discord <id> (clic droit sur le rôle, « Copier l'identifiant du rôle ») donnent ce niveau ; un ou plusieurs identifiants, le
#                          niveau en dernier (R311). Le niveau le plus haut des rôles d'un membre l'emporte ; un membre sans aucun rôle de la correspondance est Observateur.
#                          La correspondance est dans le réglage de l'instance, jamais dans le code
#   --sans-role <id>       retire la correspondance de ce rôle
#   --serveur <id>         change le serveur Discord (par défaut celui du jeu : sources/sources.json, discord.guildId)
#   --nouvelle-session     change le secret des sessions : toutes les sessions ouvertes (de cette instance) tombent
#   --bot                  pose le jeton du BOT de l'application (R314) : saisi SANS écho (jamais en argument), il permet au service de revérifier le niveau de chaque
#                          personne connectée, au plus toutes les 5 minutes, pendant sa session (rôle retiré ou donné, départ du serveur). Le bot se crée dans le portail développeur
#                          Discord (la même application, onglet « Bot », « Reset Token » ; « Public Bot » décoché ; aucun intent privilégié requis) et se fait inviter sur le serveur
#                          par son administrateur (https://discord.com/oauth2/authorize?client_id=<identifiant de l'application>&scope=bot&permissions=0). Sans bot posé, le niveau
#                          est fixé à la connexion et les sessions gardent leur niveau jusqu'à leur fin
#   --sans-bot             retire le jeton du bot : plus de revérification (le réglage de la connexion reste)
#   --commune <dossier>    pose la CONNEXION COMMUNE (R315) : un seul cookie de session vaut pour le site de dev et la production (le domaine MAVERICK_DOMAINE de Caddy), et
#                          passer de l'un à l'autre n'oblige pas à se reconnecter. <dossier> : l'instance de l'AUTRE site (/srv/maverick-center ou /srv/maverick-center-test),
#                          dont le secret de session est repris (lu dans son réglage, jamais montré ni passé en argument). À lancer sur les deux sites (sur le second, le secret
#                          ne change plus). Le bot doit être posé sur chacun (--bot) : chaque site recalcule le niveau avec ses propres rôles. Les sessions ouvertes du site dont
#                          le secret change tombent. Revers acceptés : un secret volé sur un site ouvre aussi l'autre ; se déconnecter de l'un déconnecte aussi de l'autre
#   --sans-commune         retire la connexion commune de ce site (ses sessions redeviennent propres à son hôte ; --nouvelle-session pour ne plus partager le secret)
#   --etat                 dit ce qui est réglé (identifiant de l'application, serveur, adresse de retour, rôles, bot posé ou non, connexion commune) ; aucun secret n'est montré
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
USAGE="Usage : sudo sh $0 [--adresse <url>] | --role <id>… joueur|mj|createur | --sans-role <id> | --serveur <id> | --nouvelle-session | --bot | --sans-bot | --commune <dossier de l'autre site> | --sans-commune | --etat | --retirer"

ACTION=definir
ADRESSE=''
ROLE_IDS=''
ROLE_ID=''
ROLE_NIVEAU=''
SERVEUR=''
AUTRE=''
while [ $# -gt 0 ]; do
  case "$1" in
    --adresse) [ $# -ge 2 ] || { echo "$USAGE" >&2; exit 2; }; ADRESSE=$2; shift 2 ;;
    --role)
      ACTION=role; shift
      while [ $# -gt 0 ]; do case "$1" in *[!0-9]*) break ;; *) ROLE_IDS="$ROLE_IDS $1"; shift ;; esac; done
      [ -n "$ROLE_IDS" ] && [ $# -ge 1 ] || { echo "$USAGE" >&2; exit 2; }
      ROLE_NIVEAU=$1; shift ;;
    --sans-role) [ $# -ge 2 ] || { echo "$USAGE" >&2; exit 2; }; ACTION=sans_role; ROLE_ID=$2; shift 2 ;;
    --serveur) [ $# -ge 2 ] || { echo "$USAGE" >&2; exit 2; }; ACTION=serveur; SERVEUR=$2; shift 2 ;;
    --nouvelle-session) ACTION=nouvelle_session; shift ;;
    --bot) ACTION=bot; shift ;;
    --sans-bot) ACTION=sans_bot; shift ;;
    --commune) [ $# -ge 2 ] || { echo "$USAGE" >&2; exit 2; }; ACTION=commune; AUTRE=$2; shift 2 ;;
    --sans-commune) ACTION=sans_commune; shift ;;
    --etat) ACTION=etat; shift ;;
    --retirer) ACTION=retirer; shift ;;
    -h|--aide) echo "$USAGE"; exit 0 ;;
    *) echo "$USAGE" >&2; exit 2 ;;
  esac
done
case "$ROLE_ID" in *[!0-9]*) echo "--role / --sans-role : l'identifiant d'un rôle Discord (des chiffres)" >&2; exit 2 ;; esac
case "$SERVEUR" in *[!0-9]*) echo "--serveur : l'identifiant d'un serveur Discord (des chiffres)" >&2; exit 2 ;; esac
case "$ROLE_NIVEAU" in ''|joueur|mj|createur) ;; *) echo "--role : le niveau est « joueur », « mj » ou « createur »" >&2; exit 2 ;; esac

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
  roles=$(sed -n 's/.*"roles":{\([^}]*\)}.*/\1/p' "$FICHIER" | head -n 1 | tr ',' '\n')
  par_niveau() { # niveau libellé : « Joueur : id id (n) »
    ids=$(printf '%s\n' "$roles" | sed -n "s/^\"\([0-9]*\)\":\"$1\"$/\1/p" | tr '\n' ' ' | sed 's/ $//')
    n=$(printf '%s\n' "$roles" | sed -n "s/^\"\([0-9]*\)\":\"$1\"$/\1/p" | wc -l | tr -d ' ')
    printf '%s : %s (%s)' "$2" "${ids:-aucun}" "$n"
  }
  if grep -q '"jeton_du_bot"' "$FICHIER"; then bot='posé (jeton non montré) : le niveau des personnes connectées est revérifié toutes les 5 minutes (R314)'; else bot='non posé : le niveau est fixé à la connexion (--bot pour le revérifier pendant la session)'; fi
  if grep -q '"domaine_commun"' "$FICHIER"; then commune="posée sur $(champ domaine_commun) : une seule connexion vaut pour les deux sites, chacun avec ses rôles (R315)"; else commune='non posée : la session est propre à ce site (--commune <dossier de l’autre site> pour la partager, R315)'; fi
  echo "Connexion Discord : réglée sur $INSTANCE_DIT. Application : $(champ client_id) (secret posé, non montré). Serveur : $(champ serveur). Adresse de retour : $(champ adresse_de_retour). Rôles par niveau — $(par_niveau joueur Joueur) ; $(par_niveau mj MJ) ; $(par_niveau createur Créateur). Un membre sans aucun de ces rôles est Observateur (R311). Bot de revérification : $bot. Connexion commune : $commune."
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
    echo "Niveaux (R311) : Joueur, MJ et Créateur se donnent tous par rôle Discord ; un membre sans aucun rôle de la correspondance est Observateur. Poser les rôles : sudo sh $0 --role <id>… joueur|mj|createur"
    ;;
  role)
    # shellcheck disable=SC2086
    sortie=$(appeler role $ROLE_IDS "$ROLE_NIVEAU" </dev/null) || die "le service a refusé : rien n'a été modifié"
    lire_la_sortie "$sortie"
    ecrire_le_reglage "$REGLAGE"
    echo "Les rôles$ROLE_IDS donnent le niveau « $ROLE_NIVEAU » (le plus haut niveau des rôles d'un membre l'emporte ; recalculé à chaque connexion, et pendant la session toutes les 5 minutes si le bot est posé (--bot, R314) ; sans bot, les sessions ouvertes gardent leur niveau jusqu'à leur fin, --nouvelle-session les ferme)."
    ;;
  sans_role)
    sortie=$(appeler sans-role "$ROLE_ID" </dev/null) || die "le service a refusé : rien n'a été modifié"
    lire_la_sortie "$sortie"
    ecrire_le_reglage "$REGLAGE"
    echo "Le rôle $ROLE_ID ne donne plus de niveau (les sessions ouvertes le perdent à la prochaine revérification si le bot est posé (--bot, R314), sinon à leur fin ; --nouvelle-session les ferme)."
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
    if grep -q '"domaine_commun"' "$FICHIER"; then
      echo "ATTENTION : la connexion commune est posée (R315) et l'autre site garde l'ancien secret : le cookie commun ne se lit plus d'un site à l'autre. Refaites-la sur l'autre site :"
      echo
      echo "      sudo sh <dossier de l'autre site>/discord/discord.sh --commune $INSTANCE"
      echo
    fi
    ;;
  bot)
    [ -t 0 ] || [ "$ESSAI" = 1 ] || die "la saisie du jeton demande un terminal : lancez la commande dans une session ssh ordinaire"
    echo "Bot de $INSTANCE_DIT (R314). Portail développeur Discord : https://discord.com/developers/applications → votre application → « Bot » (« Reset Token » donne le jeton ; « Public Bot » décoché)."
    IFS= read -r -s -p "Jeton du bot (n'est pas affiché) : " jeton || jeton=''
    echo
    [ -n "$jeton" ] || die "le jeton est vide : rien n'a été modifié"
    sortie=$(printf '%s\n' "$jeton" | appeler bot) || die "le service a refusé ce jeton : rien n'a été modifié"
    jeton=''
    lire_la_sortie "$sortie"
    ecrire_le_reglage "$REGLAGE"
    echo "Bot posé sur $INSTANCE_DIT : le niveau des personnes connectées est revérifié toutes les 5 minutes, lors de leurs visites. Rien à redémarrer."
    echo "À FAIRE (une fois) : l'administrateur du serveur Discord invite le bot, depuis le portail (« OAuth2 », « URL Generator », case « bot », aucune permission) ou par"
    echo "      https://discord.com/oauth2/authorize?client_id=$(sed -n 's/.*"client_id":"\([^"]*\)".*/\1/p' "$FICHIER" | head -n 1)&scope=bot&permissions=0"
    echo "Tant que le bot n'est pas dans le serveur, Discord refuse ses appels : les sessions gardent leur niveau, une ligne le dit au journal du service, aucun niveau n'est déduit de la panne."
    ;;
  sans_bot)
    sortie=$(appeler sans-bot </dev/null) || die "le service a refusé : rien n'a été modifié"
    lire_la_sortie "$sortie"
    ecrire_le_reglage "$REGLAGE"
    echo "Jeton du bot retiré de $INSTANCE_DIT : le niveau n'est plus revérifié pendant la session (il reste fixé à la connexion). Pensez à réinitialiser le jeton dans le portail Discord s'il a pu fuir."
    ;;
  commune)
    domaine=$(env_valeur "$CADDY_ENV" MAVERICK_DOMAINE)
    [ -n "$domaine" ] || die "le domaine du site est introuvable (MAVERICK_DOMAINE dans $CADDY_ENV) : rien n'a été modifié"
    autre_dossier=$(cd "$AUTRE" 2>/dev/null && pwd) || die "--commune : le dossier $AUTRE est introuvable : rien n'a été modifié"
    [ "$autre_dossier" != "$INSTANCE" ] || die "--commune : donnez le dossier de l'AUTRE site (celui-ci est $INSTANCE) : rien n'a été modifié"
    autre_fichier=$autre_dossier/secrets/discord.json
    [ -f "$autre_fichier" ] || die "l'autre site ($autre_dossier) n'a pas de réglage Discord : posez-le d'abord (sudo sh $autre_dossier/discord/discord.sh), puis relancez : rien n'a été modifié"
    # seul le secret de session de l'autre site est lu ; il passe au service par l'entrée standard, jamais en argument ni à l'écran
    secret_commun=$(sed -n 's/.*"secret_de_session":"\([0-9a-f]\{64\}\)".*/\1/p' "$autre_fichier" | head -n 1)
    [ -n "$secret_commun" ] || die "le réglage de l'autre site ($autre_fichier) est illisible : reposez-le (sudo sh $autre_dossier/discord/discord.sh) : rien n'a été modifié"
    sortie=$(printf '%s\n' "$secret_commun" | appeler commune "$domaine") || die "le service a refusé : rien n'a été modifié"
    secret_commun=''
    lire_la_sortie "$sortie"
    ecrire_le_reglage "$REGLAGE"
    echo "Connexion commune posée sur $INSTANCE_DIT (R315) : le cookie de session vaut pour $domaine et dev.$domaine, avec le secret de session de l'autre site. Rien à redémarrer."
    echo "Si ce n'est pas encore fait, la même commande sur l'autre site, avec le dossier de celui-ci :"
    echo
    echo "      sudo sh $autre_dossier/discord/discord.sh --commune $INSTANCE"
    echo
    echo "Chaque site garde ses propres rôles. Se déconnecter de l'un déconnecte aussi de l'autre."
    ;;
  sans_commune)
    sortie=$(appeler sans-commune </dev/null) || die "le service a refusé : rien n'a été modifié"
    lire_la_sortie "$sortie"
    ecrire_le_reglage "$REGLAGE"
    echo "Connexion commune retirée de $INSTANCE_DIT : ses sessions redeviennent propres à son hôte. Le secret de session reste celui de l'autre site : --nouvelle-session pour ne plus le partager (toutes les sessions de ce site tombent)."
    ;;
esac
