# --- Installateur « kit seul » (mode test seulement ; lot 11, PR 4 ; docs/serveur.md, « Bascule 2 : préparation », « PR 4 ») ------------------------------------------------
# Ce fichier n'est pas livré tel quel : fabriquer.mjs en découpe les sections (lignes « # >>> nom ») et les insère à la place des lignes repères @@SEUL_…@@ du modèle installateur.sh,
# dans un installateur de TEST seulement. Celui de production n'en porte rien : ses lignes repères sont retirées, son script reste identique, octet pour octet, à celui d'avant.
# Une archive « kit seul » (fabriquer.mjs --kit-seul : KIT_SEUL=1) ne porte aucune page : seulement le service (site/_serveur/) et le kit. Les pages sont refaites par l'atelier du
# site de dev ; l'installateur ne pose donc que site/_serveur/ (le reste de site/ reste tel quel), puis le kit et la marque comme toute installation de test. Un installateur de test
# ordinaire (KIT_SEUL=0) passe ces sections sans effet.
# >>> refus
# Le champ du modèle, rempli par fabriquer.mjs. Sans l'interrupteur atelier/servir, l'atelier ne poserait pas les pages et le site resterait celui d'avant : refus avant toute
# écriture, avec le geste.
KIT_SEUL=@@KIT_SEUL@@
if [ "$KIT_SEUL" = 1 ] && [ ! -f "$DOSSIER/atelier/servir" ]; then
  die "installateur « kit seul » refusé : $DOSSIER/atelier/servir n'existe pas, l'atelier ne refabriquerait pas les pages et le site resterait celui d'avant (rien n'a été modifié). Posez d'abord l'interrupteur : sudo sh $DOSSIER/atelier/installer.sh --servir (il demande db/source : sudo bash $DOSSIER/bascule.sh poser), ou installez un installateur complet"
fi
# >>> controle-debut
if [ "$KIT_SEUL" = 1 ]; then
  [ -f "$TRAVAIL/site/_serveur/version.json" ] && [ -f "$TRAVAIL/site/_serveur/serveur/index.mjs" ] || die "archive refusée : pas de site/_serveur/ (le service) dans un installateur « kit seul » (rien n'a été modifié)"
  [ -f "$TRAVAIL/atelier-kit/kit.json" ] || die "archive refusée : un installateur « kit seul » porte son kit (atelier-kit/kit.json absent ; rien n'a été modifié)"
  log "Installateur « kit seul » : le service et le kit seulement, les pages restent celles de l'atelier."
else
# >>> controle-fin
fi
# >>> pose-debut
if [ "$KIT_SEUL" = 1 ]; then
  # seul le service (site/_serveur/) est posé ; les pages de site/ ne sont pas touchées
  mkdir -p "$SITE/_serveur"
  if [ "$USE_RSYNC" != 0 ] && command -v rsync >/dev/null 2>&1; then
    rsync -a --delete --checksum "$TRAVAIL/site/_serveur/" "$SITE/_serveur/" || die "synchronisation (rsync) du service impossible"
  else
    find "$SITE/_serveur" -mindepth 1 -maxdepth 1 -exec rm -rf {} \;
    cp -a "$TRAVAIL/site/_serveur/." "$SITE/_serveur/" || die "copie du service impossible"
  fi
else
# >>> pose-fin
fi
