#!/bin/sh
# Le gel des écritures d'une instance (garde-fou 16 de la bascule 2, lot 11 ; docs/serveur.md, « Bascule 2 : préparation », « Gel des écritures »). Une commande
# lancée en root, sur l'instance où elle est livrée (production et site de dev : le même script, à la racine de chaque instance) :
#
#   sudo sh /srv/maverick-center/gel.sh      poser [--duree <minutes>] [--motif <texte>] | lever | etat      (production)
#   sudo sh /srv/maverick-center-test/gel.sh poser [--duree <minutes>] [--motif <texte>] | lever | etat      (site de dev)
#
#   poser   pose db/gel.json : toute écriture de /api/ de cette instance répond 503 (fiches, édition, lots de changements, mise à jour) jusqu'à l'échéance ;
#           les lectures restent ouvertes. --duree : 1 à 240 minutes (60 par défaut). --motif : le texte que verront ceux dont l'écriture est refusée.
#           Reposer un gel remplace le précédent. Le gel tient après une relance du service et se lève seul à l'échéance ; sans redémarrage du service.
#   lever   retire le gel tout de suite.
#   etat    dit s'il y a un gel, jusqu'à quand, pourquoi.
# Le fichier est écrit en entier à côté (mktemp, nom imprévisible) puis renommé (le service ne lit jamais un fichier à moitié écrit), en 644 : lisible par le
# service du conteneur, qui ne l'écrit jamais (il ne fait que le lire). Rien d'autre n'est touché : ni la base, ni le service, ni les mises à jour automatiques (le fichier GELER de bascule.sh, lui,
# arrête le service du site de dev).
# Réglage (tests seulement) : MAVERICK_ESSAI=1 (root non exigé).
set -eu
umask 022

ICI=$(cd "$(dirname "$0")" && pwd)
DOSSIER=$ICI
FICHIER=$DOSSIER/db/gel.json
USAGE="Usage : sudo sh $0 poser [--duree <minutes>] [--motif <texte>] | lever | etat"
DUREE_DEFAUT=60
DUREE_MAX=240

die() { echo "ERREUR : $*" >&2; exit 1; }
case "$DOSSIER" in
  /*[!A-Za-z0-9._/-]*|"") die "le dossier de l'instance ($DOSSIER) porte des caractères que ce script refuse (lettres, chiffres, point, tiret, souligné et barre seulement)" ;;
esac
GESTE="sudo sh $DOSSIER/gel.sh lever"

ACTION=${1:-}
[ $# -eq 0 ] || shift
case "$ACTION" in
  poser|lever|etat) ;;
  -h|--aide) echo "$USAGE"; exit 0 ;;
  *) echo "$USAGE" >&2; exit 2 ;;
esac

DUREE=$DUREE_DEFAUT
MOTIF='mise à jour en cours'
while [ $# -gt 0 ]; do
  [ "$ACTION" = poser ] || { echo "$USAGE" >&2; exit 2; }
  case "$1" in
    --duree)
      [ $# -ge 2 ] || { echo "$USAGE" >&2; exit 2; }
      DUREE=$2; shift 2 ;;
    --motif)
      [ $# -ge 2 ] || { echo "$USAGE" >&2; exit 2; }
      MOTIF=$2; shift 2 ;;
    *) echo "$USAGE" >&2; exit 2 ;;
  esac
done

[ "${MAVERICK_ESSAI:-0}" = 1 ] || [ "$(id -u)" -eq 0 ] || die "à lancer en root : sudo sh $0 $ACTION"
[ -d "$DOSSIER/db" ] || die "$DOSSIER/db est introuvable : ce n'est pas le dossier d'une instance posée par l'installateur"

maintenant() { date +%s; }
iso() { date -u -d "@$1" '+%Y-%m-%dT%H:%M:%SZ' 2>/dev/null || date -u -r "$1" '+%Y-%m-%dT%H:%M:%SZ'; }
# Les secondes d'une date ISO 8601 (« 2026-11-20T10:00:00Z ») ; vide si elle n'est pas lisible.
secondes() { date -u -d "$1" +%s 2>/dev/null || true; }
# Un champ texte du fichier (écrit par ce script : une valeur par clé, sur une ligne).
champ() { sed -n "s/.*\"$1\":\"\([^\"]*\)\".*/\1/p" "$FICHIER" 2>/dev/null | head -n 1; }
minutes_entre() { echo $(( ($1 - $2 + 59) / 60 )); }

case "$ACTION" in
  poser)
    case "$DUREE" in
      ""|*[!0-9]*) echo "ERREUR : --duree $DUREE : un nombre entier de minutes est attendu, de 1 à $DUREE_MAX." >&2; exit 2 ;;
    esac
    if [ "$DUREE" -lt 1 ] || [ "$DUREE" -gt "$DUREE_MAX" ]; then
      echo "ERREUR : --duree $DUREE : de 1 à $DUREE_MAX minutes (au-delà, le service ramènerait de toute façon l'échéance à $((DUREE_MAX / 60)) h ; un gel plus long se repose)." >&2
      exit 2
    fi
    # le motif entre dans du JSON : sans retour à la ligne ni caractère de commande, guillemets et barres échappés, 250 octets au plus
    MOTIF=$(printf '%s' "$MOTIF" | tr '\n\r\t' '   ' | tr -d '\000-\037' | head -c 250 | sed 's/\\/\\\\/g; s/"/\\"/g')
    [ -n "$MOTIF" ] || MOTIF='mise à jour en cours'
    deja=''
    if [ -f "$FICHIER" ]; then deja=$(champ jusqu_a); fi
    debut=$(maintenant)
    fin=$((debut + DUREE * 60))
    # un nom imprévisible, créé d'un coup (mktemp : jamais un lien posé d'avance), effacé si le script meurt avant le renommage
    provisoire=$(mktemp "$DOSSIER/db/.gel.XXXXXX") || die "impossible de créer un fichier provisoire dans $DOSSIER/db"
    trap 'rm -f "$provisoire"' EXIT
    printf '{"format":"maverick-gel/1","pose_le":"%s","jusqu_a":"%s","motif":"%s","geste":"%s"}\n' "$(iso "$debut")" "$(iso "$fin")" "$MOTIF" "$GESTE" > "$provisoire"
    chmod 644 "$provisoire"
    mv -f "$provisoire" "$FICHIER"
    trap - EXIT
    [ -z "$deja" ] || echo "Un gel était déjà posé (jusqu'à $deja) : il est remplacé."
    echo "Écritures gelées sur $DOSSIER pendant $DUREE minutes, jusqu'à $(iso "$fin") : toute écriture de /api/ répond 503, les lectures restent ouvertes."
    echo "Motif affiché : $MOTIF"
    echo "Le service le prend en compte tout de suite, sans redémarrage, et il tient après une relance. Il se lève seul à l'échéance."
    echo "Pour le lever avant : $GESTE"
    ;;
  lever)
    if [ -e "$FICHIER" ]; then
      rm -f "$FICHIER"
      echo "Gel levé sur $DOSSIER : les écritures sont rouvertes (le service le voit tout de suite)."
    else
      echo "Aucun gel n'est posé sur $DOSSIER : rien à lever."
    fi
    ;;
  etat)
    if [ ! -e "$FICHIER" ]; then
      echo "Gel : aucun sur $DOSSIER. Pour en poser un : sudo sh $DOSSIER/gel.sh poser --duree 60 --motif \"...\""
      exit 0
    fi
    jusqu=$(champ jusqu_a)
    fin=''
    [ -z "$jusqu" ] || fin=$(secondes "$jusqu")
    maintenant_s=$(maintenant)
    if [ -z "$fin" ]; then
      modif=$(stat -c %Y "$FICHIER" 2>/dev/null || date -r "$FICHIER" +%s 2>/dev/null || echo "$maintenant_s")
      plafond=$((modif + 7200))
      if [ "$maintenant_s" -lt "$plafond" ]; then
        echo "Gel : le fichier $FICHIER est illisible ou mal formé ; le service le tient par prudence jusqu'à $(iso "$plafond") au plus (2 h après sa modification), soit encore $(minutes_entre "$plafond" "$maintenant_s") min. Pour le lever : $GESTE"
      else
        echo "Gel : le fichier $FICHIER est illisible ou mal formé et son plafond de 2 h est passé : le service l'ignore. « $GESTE » le retire."
      fi
      exit 0
    fi
    if [ "$maintenant_s" -lt "$fin" ]; then
      echo "Gel : posé le $(champ pose_le), jusqu'à $jusqu (encore $(minutes_entre "$fin" "$maintenant_s") min) : $(champ motif). Pour le lever : $GESTE"
    else
      echo "Gel : échu depuis $jusqu ; le service l'ignore. Le fichier reste là, « $GESTE » le retire."
    fi
    ;;
esac
