#!/usr/bin/env bash
# Envoi chiffré de nuit hors du serveur (temps 2 des sauvegardes automatiques ; deploy/vps/README.md, « Sauvegardes »).
#
#   envoi.sh        envoie, pour chaque instance, sa dernière copie locale saine et son dernier installateur ; applique la rétention ; contrôle le dépôt
#   MAVERICK_SAUV_NOMMEE=<nom> envoi.sh   envoie à la place la copie NOMMÉE <nom> de chaque instance (<sauvegardes>/<instance>/nommees/<nom>, posée par
#                   deploy/installateur/bascule.sh), étiquetée « nommees,<nom> » et gardée sans limite (--keep-tag nommees)
#
# Outil : restic (paquet Ubuntu), dépôt chiffré sur un stockage compatible S3 d'un autre fournisseur que l'hébergeur (R275). Réglages dans
# /etc/maverick-sauvegardes (root 700) : stockage.env (adresse du dépôt et clés d'accès au stockage, 600) et cle-depot (la clé de chiffrement, 600).
# Sans eux, rien n'est envoyé (le temps 1, copie.sh, marche seul) : installer.sh --stockage les pose. Aucun secret en argument : restic lit la
# clé dans un fichier (RESTIC_PASSWORD_FILE) et les accès au stockage dans son environnement ; rien de cela n'est écrit dans l'état ni le journal.
#
# Chaque nuit, par instance :
#   1. restic backup : le dossier de la dernière bonne copie (bases, comptes.tsv, copie.meta) et <instance>/installateur-courant/ (le dernier
#      installateur posé par mise-a-jour.sh) ; étiquettes inst-<instance>, horaire|nuit, et « version » + l'étiquette de version quand la version
#      installée a changé depuis le dernier envoi (VERSIONS_DE) ;
#   2. restic forget : une copie par jour pendant les JOURS_GARDES (30) derniers jours (--keep-within-daily 30d : des JOURS, pas les 30 derniers jours
#      qui ont une copie, comme le ferait --keep-daily), la dernière copie de chaque mois sans limite (--keep-monthly unlimited, valeur de restic 0.16),
#      toutes celles étiquetées « version » ou « nommees » (--keep-tag) ; puis restic prune ;
#   3. restic check ; le dimanche, avec --read-data-subset=CONTROLE_DONNEES (5 %) : une part des données est relue.
# Code de sortie : 0 = envoi fait (ou non activé), 3 = échec (l'état et le journal du minuteur disent lequel), 1 = erreur d'usage.
set -euo pipefail
umask 077

ICI=$(cd "$(dirname "$0")" && pwd)
# shellcheck source=lib.sh
. "$ICI/lib.sh"
charger_reglages
E=$ETAT/exterieur.env
mkdir -p "$SAUV" "$ETAT"
chmod 700 "$SAUV" "$ETAT"

if [ ! -f "$ETC/stockage.env" ] || [ ! -f "$ETC/cle-depot" ]; then
  journal "envoi extérieur non activé (pas de stockage.env ni de cle-depot dans $ETC) : seules les copies locales sont faites"
  ecrire_json
  exit 0
fi
prendre_le_verrou 1800 || exit 0

RESULTAT=ok
CODE=''
echouer() { # code message
  RESULTAT=echec
  [ -n "$CODE" ] || CODE=$1
  echec "$2"
}
terminer() {
  etat_poser_tout "$E" ENVOI_LE "$(instant)" ENVOI_RESULTAT "$RESULTAT" ENVOI_CODE "$CODE" ENVOI_INSTANCES "${ENVOYEES# }"
  ecrire_json
  [ "$RESULTAT" = ok ] || exit 3
  exit 0
}
ENVOYEES=''
# Une copie nommée (bascule.sh) : un nom simple, jamais un chemin.
NOMMEE=${MAVERICK_SAUV_NOMMEE:-}
case "$NOMMEE" in
  '') ;;
  *[!a-z0-9-]*|-*) echec "copie nommée refusée : « $NOMMEE » (lettres minuscules, chiffres et tirets)"; exit 1 ;;
esac

if ! command -v restic >/dev/null 2>&1; then
  echouer restic_absent "restic est absent (apt-get install restic)"
  terminer
fi
# Les accès au stockage entrent dans l'environnement de restic seulement (jamais en argument) ; la clé de chiffrement reste dans son fichier.
set -a
# shellcheck disable=SC1091,SC1090
. "$ETC/stockage.env"
set +a
export RESTIC_PASSWORD_FILE=$ETC/cle-depot
export RESTIC_CACHE_DIR=$SAUV/.cache-restic
mkdir -p "$RESTIC_CACHE_DIR"

# Le dépôt : accessible, ouvert par la clé. Jamais créé ici (installer.sh --stockage le crée une fois).
if ! erreur=$(restic cat config 2>&1 >/dev/null); then
  case "$erreur" in
    *"wrong password"*|*"no key found"*) echouer cle_refusee "le dépôt refuse la clé de chiffrement (cle-depot)" ;;
    *"unable to open config"*|*"Is there a repository"*) echouer depot_absent "le dépôt n'existe pas à l'adresse donnée" ;;
    *) echouer depot_inaccessible "le dépôt est inaccessible : $(printf '%s' "$erreur" | head -n 2 | tr '\n' ' ')" ;;
  esac
  terminer
fi

# Une copie par jour de la semaine suffit pour « le dimanche » : le jour se lit sur l'horloge du script (réglable pour les tests).
JOUR=$(date -u -d "@$(instant)" +%u)
[ "$JOURS_GARDES" -ge 1 ] || JOURS_GARDES=1
RETENTION_OK=1

for inst in $INSTANCES; do
  dossier=$(dossier_de "$inst")
  copie=$(derniere_copie "$inst")
  if [ -n "$NOMMEE" ]; then
    if [ -d "$SAUV/$inst/nommees/$NOMMEE" ]; then copie="nommees/$NOMMEE"; else echouer copie_nommee_absente "$inst : la copie nommée $NOMMEE est absente"; continue; fi
  fi
  if [ -z "$copie" ]; then
    journal "$inst : aucune copie locale saine à envoyer"
    continue
  fi
  chemins=("$SAUV/$inst/$copie")
  [ -d "$dossier/installateur-courant" ] && chemins+=("$dossier/installateur-courant")
  etiquettes="inst-$inst,${copie%%/*}"
  [ -z "$NOMMEE" ] || etiquettes="$etiquettes,$NOMMEE"
  version=''
  [ -f "$dossier/VERSION" ] && version=$(sed -n 's/^tag=//p' "$dossier/VERSION" | head -n 1)
  nouvelle_version=0
  case " $VERSIONS_DE " in
    *" $inst "*)
      if [ -n "$version" ] && [ "$version" != "$(etat_lire "$ETAT/$inst.env" VERSION_ENVOYEE)" ]; then nouvelle_version=1; etiquettes="$etiquettes,version,$version"; fi ;;
  esac
  if restic backup -q --host maverick --tag "$etiquettes" "${chemins[@]}"; then
    ENVOYEES="$ENVOYEES $inst"
    [ "$nouvelle_version" -eq 0 ] || etat_poser "$ETAT/$inst.env" VERSION_ENVOYEE "$version"
    journal "$inst : copie ${copie#*/} envoyée${version:+ (version $version)}"
  else
    echouer envoi_echoue "$inst : l'envoi de la copie a échoué"
    RETENTION_OK=0
    continue
  fi
  # La rétention de l'instance : jamais sans règle (« forget » sans --keep-* ne retire rien), jamais avant un envoi réussi.
  if ! restic forget -q --tag "inst-$inst" --group-by host --keep-within-daily "${JOURS_GARDES}d" --keep-monthly unlimited --keep-tag version --keep-tag nommees; then
    echouer retention_echouee "$inst : la rétention a échoué"
    RETENTION_OK=0
  fi
done

if [ "$RETENTION_OK" -eq 1 ] && [ -n "$ENVOYEES" ]; then
  restic prune -q || echouer retention_echouee "restic prune a échoué"
fi
DONNEES=0
controle=(check -q)
if [ "$JOUR" = 7 ]; then controle+=("--read-data-subset=$CONTROLE_DONNEES"); DONNEES=1; fi
if restic "${controle[@]}"; then
  etat_poser_tout "$E" CONTROLE_LE "$(instant)" CONTROLE_RESULTAT ok CONTROLE_DONNEES "$DONNEES"
else
  etat_poser_tout "$E" CONTROLE_LE "$(instant)" CONTROLE_RESULTAT echec CONTROLE_DONNEES "$DONNEES"
  echouer controle_echoue "restic check a trouvé un défaut dans le dépôt"
fi
terminer
