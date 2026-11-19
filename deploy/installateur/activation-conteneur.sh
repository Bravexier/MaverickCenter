#!/bin/sh
# Ce que le conteneur de l'activation exécute (lot 11 « Bascule 2 », PR 5a ; docs/serveur.md, « Bascule 2 : préparation », « PR 5a »). Livré à la racine de la production par l'installateur, comme
# activer.sh qui le monte en lecture seule (`-v activation-conteneur.sh:/conteneur.sh:ro`). Il tourne SANS privilège : utilisateur 65534, aucun réseau, système de fichiers en lecture seule,
# aucune capacité, aucun nouveau privilège, nœuds de périphérique interdits par Docker. C'est donc ici, et non chez root, que le paquet du site de dev est ouvert pour la première fois
# (garde-fou 20 : un fichier du dossier partagé `paquets/` est de la matière donnée par un service que n'importe quel visiteur du site de dev atteint).
# Deux usages, le premier argument :
#   controles    copie le paquet, puis lance les contrôles d'activation du CODE DU KIT (client/scripts/activation-controles.mjs : empreinte contre kit.json, structure, notes, contenu réel, base de la
#                production refaite avec ses fiches sur une copie). Sortie : /resultats/controles.json (des mots et des nombres) et controles.txt (des comptes) ; code 0 passe, 1 refuse, 2 impossible.
#   fabrication  copie le paquet, REFUSE s'il n'a pas l'empreinte attendue (77), copie le kit et fabrique TOUT le site de la production (client/scripts/fabriquer-depuis-contenu.mjs, SITE_MODE=prod)
#                dans /travail/site, sur le MÊME montage que le kit (Astro déplace ses fichiers par rename). Sortie : /resultats/fabrication.json, pages.txt (le nombre de pages .html), version.txt
#                (la version de son service, _serveur/version.json) ; le site reste dans /travail/site, que activer.sh pose ensuite par un autre conteneur sans capacité.
# Variables (activer.sh) : PAQUET_NOM (le nom du fichier dans /paquets, vide : aucun paquet à copier), EMPREINTE_ATTENDUE (celle que kit.json annonce, ou vide), PLAFOND_PAQUET (octets),
#   DELAI_DE_LA_COPIE (secondes), KIT_VERSION, KIT_STRUCTURE, KIT_PAQUET_VERSION, KIT_PAQUET_EMPREINTE, KIT_PAQUET_STRUCTURE, CORRECTIF (0 ou 1), plus HIDE_EXAMPLES, SITE_MODE, SITE_TAG, SITE_BASE,
#   SITE_GOOGLE_CLIENT_ID pour la fabrication. Chemins (réglages de test seulement) : KIT, PAQUETS, TRAVAIL, RESULTATS, PRODUCTION.
#   serveur      (PR 5a, garde-fou 20) fabrique le service (`_serveur/`, le code que la production exécute) depuis le KIT SEUL : `livrerServeur` du kit, sans paquet, sans contenu, dans
#                /serveur-kit (KIT_VERSION : la version de kit.json). Le code que la production exécute ne vient QUE du kit (GitHub) : jamais de la sortie du conteneur de fabrication, que le
#                paquet (contenu du site de dev) a pu influencer.
# Codes de sortie propres à la copie : 73 (pas un fichier régulier), 74 (trop gros ou vide), 75 (la copie échoue ou dépasse son délai), 77 (l'empreinte n'est pas celle du kit), 78 (nom refusé),
# 79 (le site fabriqué est incomplet : pas de page d'accueil, de service ou de base des règles).
set -u
# ce que ce conteneur écrit est relu par un AUTRE utilisateur (la pose des pages sous maverick-site, root pour le service) : lisible par tous
umask 022
KIT=${KIT:-/kit}
PAQUETS=${PAQUETS:-/paquets}
TRAVAIL=${TRAVAIL:-/travail}
RESULTATS=${RESULTATS:-/resultats}
PRODUCTION=${PRODUCTION:-/production}
PLAFOND=${PLAFOND_PAQUET:-536870912}
DELAI_DE_LA_COPIE=${DELAI_DE_LA_COPIE:-120}
PAQUET_NOM=${PAQUET_NOM:-}
EMPREINTE_ATTENDUE=${EMPREINTE_ATTENDUE:-}
CORRECTIF=${CORRECTIF:-0}
USAGE=${1:-}
case "$USAGE" in controles|fabrication|serveur) ;; *) echo "conteneur.sh : usage : controles | fabrication | serveur" >&2; exit 2 ;; esac

if [ "$USAGE" = serveur ]; then
  SERVEUR_KIT=${SERVEUR_KIT:-/serveur-kit}
  cd "$KIT/client" || exit 72
  [ -d "$SERVEUR_KIT" ] || exit 70
  KIT_VERSION=${KIT_VERSION:-} node --no-warnings --input-type=module -e "
    import { livrerServeur } from './serveur/livraison.mjs';
    livrerServeur(process.argv[1], { version: process.env.KIT_VERSION });
  " "$SERVEUR_KIT" || exit 79
  [ -f "$SERVEUR_KIT/_serveur/serveur/index.mjs" ] && [ -f "$SERVEUR_KIT/_serveur/version.json" ] || exit 79
  exit 0
fi

mkdir -p "$TRAVAIL/home" "$TRAVAIL/tmp" || exit 70

# 1. le paquet : un fichier régulier non lien, de la taille attendue, copié sous délai (une FIFO posée après le contrôle bloquerait un `dd` sans `timeout`)
COPIE=$TRAVAIL/contenu.db
if [ -n "$PAQUET_NOM" ]; then
  case "$PAQUET_NOM" in */*|*..*|.*|'') exit 78 ;; esac
  extrait=$PAQUETS/$PAQUET_NOM
  [ -f "$extrait" ] && [ ! -L "$extrait" ] || exit 73
  taille=$(stat -c '%s' "$extrait" 2>/dev/null || echo 0)
  [ "$taille" -gt 0 ] && [ "$taille" -le "$PLAFOND" ] || exit 74
  timeout "$DELAI_DE_LA_COPIE" dd if="$extrait" of="$COPIE" iflag=nofollow bs=1048576 count=$((PLAFOND / 1048576 + 1)) 2>/dev/null || exit 75
  [ "$(stat -c '%s' "$COPIE" 2>/dev/null || echo 0)" -eq "$taille" ] || exit 75
  if [ "$USAGE" = fabrication ]; then
    # le paquet qu'on fabrique est celui du kit : une copie qui n'a pas l'empreinte annoncée n'est jamais fabriquée
    calculee=$(sha256sum "$COPIE" 2>/dev/null | cut -d ' ' -f 1)
    [ -n "$EMPREINTE_ATTENDUE" ] && [ "$calculee" = "$EMPREINTE_ATTENDUE" ] || exit 77
  fi
fi

if [ "$USAGE" = controles ]; then
  cd "$KIT/client" || exit 72
  options=""
  [ -z "$PAQUET_NOM" ] || options="$options --paquet $COPIE"
  [ -z "${KIT_PAQUET_EMPREINTE:-}" ] || options="$options --kit-paquet-empreinte $KIT_PAQUET_EMPREINTE"
  [ -z "${KIT_PAQUET_VERSION:-}" ] || options="$options --kit-paquet-version $KIT_PAQUET_VERSION"
  [ -z "${KIT_PAQUET_STRUCTURE:-}" ] || options="$options --kit-paquet-structure $KIT_PAQUET_STRUCTURE"
  [ "$CORRECTIF" != 1 ] || options="$options --correctif"
  # shellcheck disable=SC2086
  node --no-warnings scripts/activation-controles.mjs --travail "$TRAVAIL" --resultat "$RESULTATS/controles.json" --kit-version "${KIT_VERSION:-}" --kit-structure "${KIT_STRUCTURE:-}" \
    --production "$PRODUCTION" --schema "$KIT/data/schema.sql" $options > "$RESULTATS/controles.txt" 2>&1
  exit $?
fi

# 2. le kit (monté en lecture seule) est copié : le build écrit src/content/wiki, .astro, node_modules/.vite
[ -f "$COPIE" ] || exit 73
mkdir -p "$TRAVAIL/kit" || exit 70
FABRIQUE=$TRAVAIL/site
rm -rf "$FABRIQUE" || exit 70
cp -a "$KIT/." "$TRAVAIL/kit/" || exit 71
cd "$TRAVAIL/kit/client" || exit 72

# 3. la fabrication, puis ce que root et la pose liront : le nombre de pages, la version du service fabriqué (chiffres seulement)
node --no-warnings scripts/fabriquer-depuis-contenu.mjs --contenu "$COPIE" --sortie "$FABRIQUE" --mesure "$RESULTATS/fabrication.json"
code=$?
[ "$code" -eq 0 ] || exit "$code"
[ -f "$FABRIQUE/index.html" ] && [ -f "$FABRIQUE/_serveur/serveur/index.mjs" ] && [ -f "$FABRIQUE/_serveur/version.json" ] && [ -f "$FABRIQUE/donnees/maverick.db" ] || exit 79
find "$FABRIQUE" -type f -name '*.html' 2>/dev/null | wc -l | tr -d ' ' > "$RESULTATS/pages.txt"
sed -n 's/^ *"version": *"\([0-9][0-9]*\.[0-9][0-9]*\.[0-9][0-9]*\)".*/\1/p' "$FABRIQUE/_serveur/version.json" | head -n 1 > "$RESULTATS/version.txt"
exit 0
