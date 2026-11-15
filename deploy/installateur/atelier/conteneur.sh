#!/bin/sh
# Ce que le conteneur de l'atelier exécute (lot 9 du chantier de la base de dev ; docs/serveur.md, « Atelier du site de dev »). Monté en lecture seule par lancer.sh, il tourne
# SANS privilège : utilisateur 65534, aucun réseau, système de fichiers en lecture seule, aucune capacité, aucun nouveau privilège, nœuds de périphérique interdits par Docker.
# C'est donc ici, et non chez root, que l'extrait du contenu est ouvert pour la première fois : le dépôt que le service remplit (<atelier>/depot/, créé par root) est
# monté en lecture seule sur /contenu ; un lien s'y résout DANS le conteneur, une FIFO ou un fichier irrégulier est refusé ou coupé par `timeout`, jamais lu par root.
# Variables (lancer.sh) : VERSION_INSTALLEE (celle de la marque). Réglages de test seulement : KIT, SITE, CONTENU, TRAVAIL, SORTIE, RESULTATS, DELAI_DE_LA_COPIE.
# Codes de sortie propres à la copie : 73 (pas un fichier régulier), 74 (trop gros ou vide), 75 (la copie échoue ou dépasse son délai) ; lancer.sh en fait « extrait_refuse ».
set -u
KIT=${KIT:-/kit}
SITE=${SITE:-/site}
CONTENU=${CONTENU:-/contenu}
TRAVAIL=${TRAVAIL:-/travail}
SORTIE=${SORTIE:-/sortie}
RESULTATS=${RESULTATS:-/resultats}
PLAFOND=${PLAFOND_EXTRAIT:-536870912}
DELAI_DE_LA_COPIE=${DELAI_DE_LA_COPIE:-120}

mkdir -p "$TRAVAIL/kit" "$TRAVAIL/home" "$TRAVAIL/tmp" || exit 70

# 1. l'extrait : un fichier régulier non lien, de la taille attendue, copié sous délai (une FIFO posée après le contrôle bloquerait un `dd` sans `timeout`)
extrait=$CONTENU/contenu-${VERSION_INSTALLEE:-}.db
[ -f "$extrait" ] && [ ! -L "$extrait" ] || exit 73
taille=$(stat -c '%s' "$extrait" 2>/dev/null || echo 0)
[ "$taille" -gt 0 ] && [ "$taille" -le "$PLAFOND" ] || exit 74
timeout "$DELAI_DE_LA_COPIE" dd if="$extrait" of="$TRAVAIL/contenu.db" iflag=nofollow bs=1048576 count=$((PLAFOND / 1048576 + 1)) 2>/dev/null || exit 75
[ "$(stat -c '%s' "$TRAVAIL/contenu.db" 2>/dev/null || echo 0)" -eq "$taille" ] || exit 75

# 2. le kit (monté en lecture seule) est copié : le build écrit src/content/wiki, .astro, node_modules/.vite
cp -a "$KIT/." "$TRAVAIL/kit/" || exit 71
cd "$TRAVAIL/kit/client" || exit 72

# 3. la fabrication, puis la comparaison avec le site livré (son code de sortie ne compte pas : un écart est une mesure)
node --no-warnings scripts/fabriquer-depuis-contenu.mjs --contenu "$TRAVAIL/contenu.db" --sortie "$SORTIE/site" --mesure "$RESULTATS/fabrication.json"
code=$?
if [ "$code" -eq 0 ]; then
  node --no-warnings scripts/comparer-sites.mjs "$SITE" "$SORTIE/site" --json "$RESULTATS/comparaison.json" > "$RESULTATS/comparaison.txt" 2>&1 || true
fi
exit "$code"
