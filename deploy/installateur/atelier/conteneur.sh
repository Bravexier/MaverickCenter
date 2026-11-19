#!/bin/sh
# Ce que le conteneur de l'atelier exécute (lot 9 du chantier de la base de dev ; docs/serveur.md, « Atelier du site de dev »). Monté en lecture seule par lancer.sh, il tourne
# SANS privilège : utilisateur 65534, aucun réseau, système de fichiers en lecture seule, aucune capacité, aucun nouveau privilège, nœuds de périphérique interdits par Docker.
# C'est donc ici, et non chez root, que l'extrait du contenu est ouvert pour la première fois : le dépôt que le service remplit (<atelier>/depot/, créé par root) est
# monté en lecture seule sur /contenu ; un lien s'y résout DANS le conteneur, une FIFO ou un fichier irrégulier est refusé ou coupé par `timeout`, jamais lu par root.
# Variables (lancer.sh) : VERSION_INSTALLEE (celle de la marque). Réglages de test seulement : KIT, SITE, CONTENU, TRAVAIL, SORTIE, RESULTATS, DELAI_DE_LA_COPIE.
# La répétition de la bascule 2 (deploy/installateur/repetition-bascule-2.sh) sert le même script avec deux variables de plus, absentes de l'atelier (son comportement n'en change pas) :
# CONTENU_FICHIER (le fichier de contenu, au lieu de $CONTENU/contenu-<version>.db : le paquet à livrer) et MODE_REPETITION=1 (pas de comparaison avec le site livré, pas de copie vers
# $SORTIE : le site reste dans $TRAVAIL/site, que le .sh efface ; le nombre de pages .html fabriquées est écrit dans $RESULTATS/pages.txt).
# Codes de sortie propres à la copie : 73 (pas un fichier régulier), 74 (trop gros ou vide), 75 (la copie échoue ou dépasse son délai) ; lancer.sh en fait « extrait_refuse ».
# Le site est fabriqué dans $TRAVAIL/site, sur le MÊME montage que le kit : Astro déplace ses fichiers de .astro/.prerender vers son dossier de sortie par `rename`, impossible
# d'un montage à l'autre (EXDEV). Il est ensuite copié vers $SORTIE/site (un autre montage) ; code 76 si cette copie échoue. Le site fabriqué est le même, seul son dépôt final change.
set -u
KIT=${KIT:-/kit}
SITE=${SITE:-/site}
CONTENU=${CONTENU:-/contenu}
TRAVAIL=${TRAVAIL:-/travail}
SORTIE=${SORTIE:-/sortie}
RESULTATS=${RESULTATS:-/resultats}
PLAFOND=${PLAFOND_EXTRAIT:-536870912}
DELAI_DE_LA_COPIE=${DELAI_DE_LA_COPIE:-120}
CONTENU_FICHIER=${CONTENU_FICHIER:-}
MODE_REPETITION=${MODE_REPETITION:-0}

mkdir -p "$TRAVAIL/kit" "$TRAVAIL/home" "$TRAVAIL/tmp" || exit 70
FABRIQUE=$TRAVAIL/site
rm -rf "$FABRIQUE" || exit 70

# 1. l'extrait : un fichier régulier non lien, de la taille attendue, copié sous délai (une FIFO posée après le contrôle bloquerait un `dd` sans `timeout`)
extrait=${CONTENU_FICHIER:-$CONTENU/contenu-${VERSION_INSTALLEE:-}.db}
[ -f "$extrait" ] && [ ! -L "$extrait" ] || exit 73
taille=$(stat -c '%s' "$extrait" 2>/dev/null || echo 0)
[ "$taille" -gt 0 ] && [ "$taille" -le "$PLAFOND" ] || exit 74
timeout "$DELAI_DE_LA_COPIE" dd if="$extrait" of="$TRAVAIL/contenu.db" iflag=nofollow bs=1048576 count=$((PLAFOND / 1048576 + 1)) 2>/dev/null || exit 75
[ "$(stat -c '%s' "$TRAVAIL/contenu.db" 2>/dev/null || echo 0)" -eq "$taille" ] || exit 75

# 2. le kit (monté en lecture seule) est copié : le build écrit src/content/wiki, .astro, node_modules/.vite
cp -a "$KIT/." "$TRAVAIL/kit/" || exit 71
cd "$TRAVAIL/kit/client" || exit 72

# 3. la fabrication (dans le travail, sur le montage du kit), puis la comparaison avec le site livré (son code de sortie ne compte pas : un écart est une mesure)
node --no-warnings scripts/fabriquer-depuis-contenu.mjs --contenu "$TRAVAIL/contenu.db" --sortie "$FABRIQUE" --mesure "$RESULTATS/fabrication.json"
code=$?
if [ "$code" -eq 0 ] && [ "$MODE_REPETITION" = 1 ]; then
  # la répétition : le nombre de pages, rien d'autre (ni comparaison, ni copie : le site est jugé là où il est fait)
  find "$FABRIQUE" -type f -name '*.html' 2>/dev/null | wc -l | tr -d ' ' > "$RESULTATS/pages.txt"
elif [ "$code" -eq 0 ]; then
  node --no-warnings scripts/comparer-sites.mjs "$SITE" "$FABRIQUE" --json "$RESULTATS/comparaison.json" > "$RESULTATS/comparaison.txt" 2>&1 || true
  # 4. le site fabriqué est copié vers la sortie (un autre montage : une copie, jamais un renommage)
  if ! { rm -rf "$SORTIE/site" && mkdir -p "$SORTIE/site" && cp -a "$FABRIQUE/." "$SORTIE/site/"; }; then
    echo "conteneur.sh : la copie du site fabriqué vers $SORTIE/site a échoué" >&2
    exit 76
  fi
fi
exit "$code"
