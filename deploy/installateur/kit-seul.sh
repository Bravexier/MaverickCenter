# --- Installateur « kit seul » (lot 11, PR 4 : test ; PR 5b : production ; docs/serveur.md, « Bascule 2 : préparation », « PR 4 » et « PR 5b ») ------------------------------------------------
# Ce fichier n'est pas livré tel quel : fabriquer.mjs en découpe les sections (lignes « # >>> nom ») et les insère à la place des lignes repères @@SEUL_…@@ du modèle installateur.sh.
# Un installateur qui n'est pas un « kit seul » n'en porte rien en production (ses lignes repères sont retirées : même comportement qu'avant, il ne se distingue que par le fragment de l'activation) ; celui de test
# porte les sections `refus`, `controle-…`, `pose-…` et les passe sans effet quand KIT_SEUL=0.
# Une archive « kit seul » (fabriquer.mjs --kit-seul : KIT_SEUL=1) ne porte aucune page.
#   - TEST : seulement le service (site/_serveur/) et le kit. Les pages sont refaites par l'atelier du site de dev ; l'installateur ne pose donc que site/_serveur/ (le reste de site/ reste tel
#     quel), puis le kit et la marque comme toute installation de test.
#   - PRODUCTION (sections « -prod ») : seulement le kit. Il est posé dans <instance>/activation/kit/ ; ni site/ ni site/_serveur/ ne sont touchés : activer.sh (lancé par le fragment
#     activation-pose.sh à la fin de l'installation) fabrique les pages et le service depuis le paquet et les pose. Refusé, avant toute écriture, sans le fichier activation-par-paquet
#     (sinon la production resterait sur l'ancien site sans rien activer), hors root, ou sur une instance qui n'est pas une production installée.
#     VERSION ne prend la nouvelle étiquette QU'APRÈS « activation : == PASSEE » (sections version-avant-prod, version-apres-prod, activation-fin-prod) : sinon la production se dirait
#     « à jour » sur son ancien site et le minuteur ne verrait rien. Une activation non passée garde VERSION d'avant, pose la marque <instance>/.activation-refusee-<étiquette> (que
#     mise-a-jour.sh ne rejoue pas) et sort en code 4 ; activer.sh écrit lui-même VERSION quand il passe (--reprendre).
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
# >>> refus-prod
# Production : sans le fichier activation-par-paquet (posé par le propriétaire, en root), activer.sh n'activerait rien et la production resterait sur l'ancien site sans que personne le
# voie : refus avant toute écriture, avec le geste. Pas root : il ne pourrait ni poser le kit à root ni lancer activer.sh. Pas une production installée : activer.sh n'aurait rien à remplacer.
# Un correctif urgent (hotfix) ou une régénération republie le même contenu : activer.sh --correctif recontrôle le dernier paquet activé avec le nouveau kit.
KIT_SEUL=@@KIT_SEUL@@
ACTIVER_OPTION=''
if [ "$KIT_SEUL" = 1 ]; then
  if [ ! -f "$DOSSIER/activation-par-paquet" ] || [ -L "$DOSSIER/activation-par-paquet" ]; then
    # code 3 : le refus que mise-a-jour.sh ne retente pas (marque .refus-<étiquette>) tant que l'interrupteur manque
    log "ERREUR : installateur « kit seul » de production refusé : $DOSSIER/activation-par-paquet n'existe pas, la production n'activerait pas ce kit et resterait sur l'ancien site (rien n'a été modifié). Pour autoriser l'activation par paquet : sudo touch $DOSSIER/activation-par-paquet, puis sudo sh $DOSSIER/mise-a-jour.sh --force. Pour revenir à une livraison complète : remettre « actif » à false dans tools/flux-git/bascule-2.json (PR vers dev), la prochaine livraison de production porte alors le site entier ; en attendant, sudo touch $DOSSIER/GELER suspend les mises à jour"
    exit 3
  fi
  [ "$(id -u)" -eq 0 ] || die "installateur « kit seul » de production refusé : il s'installe en root (il pose le kit à root, donne site/ à maverick-site et lance activer.sh) : sudo sh $INSTALLATEUR --dossier $DOSSIER (rien n'a été modifié)"
  { [ "$EXISTANT" = prod ] && [ -f "$DOSSIER/site/index.html" ] && [ -d "$DOSSIER/site/_serveur" ]; } ||
    die "installateur « kit seul » de production refusé : $DOSSIER n'est pas une production installée (VERSION en mode prod, site/ et site/_serveur/) : activer.sh n'aurait aucun site à remplacer. Installez d'abord l'installateur complet de production (rien n'a été modifié)"
  # les suffixes de tools/flux-git/regles.mjs : -hotfix.N et -rebuild.N (le même contenu republié)
  if printf '%s' "$TAG" | grep -Eq -- '-(hotfix|rebuild)\.[0-9]+$'; then ACTIVER_OPTION=--correctif; fi
fi
# >>> controle-debut-prod
if [ "$KIT_SEUL" = 1 ]; then
  [ -f "$TRAVAIL/atelier-kit/kit.json" ] && [ -f "$TRAVAIL/atelier-kit/atelier-kit.tar.gz" ] || die "archive refusée : un installateur « kit seul » de production porte son kit (atelier-kit/ absent ou incomplet ; rien n'a été modifié)"
  log "Installateur « kit seul » de production : le kit seulement ; les pages et le service sont fabriqués par activer.sh, depuis le paquet."
else
# >>> pose-debut-prod
if [ "$KIT_SEUL" = 1 ]; then
  # ni pages ni service : seul le kit est posé, dans activation/kit/, à root. Une pose qui échoue REFUSE l'installation (die) : un kit absent ou incomplet ne laisserait à activer.sh que
  # l'ancien site, et l'installation n'aurait pas encore écrit VERSION (le minuteur de mise-a-jour.sh retente). Le nouveau kit est décompressé à côté, l'ancien reste tant qu'il n'est pas complet.
  KIT_SOURCE="$TRAVAIL/atelier-kit"
  KIT_MARGE_KO=262144
  poser_le_kit_de_l_activation() {
    KIT_CIBLE="$DOSSIER/activation"
    [ ! -L "$KIT_CIBLE" ] || die "$KIT_CIBLE est un lien : refus (le kit se pose chez root, jamais à travers un lien ; rien n'a été modifié)"
    KIT_OCTETS=$(sed -n 's/.*"taille_decompressee_octets": *\([0-9][0-9]*\).*/\1/p' "$KIT_SOURCE/kit.json" | head -n 1)
    case "$KIT_OCTETS" in ''|*[!0-9]*) die "kit.json illisible (taille décompressée) : le kit n'est pas posé, la production garde son site (rien n'a été modifié)" ;; esac
    mkdir -p "$KIT_CIBLE" || die "impossible de créer $KIT_CIBLE : le kit n'est pas posé, la production garde son site"
    chmod 755 "$KIT_CIBLE"
    # les restes d'une installation interrompue : un provisoire se jette ; un ancien kit est le SEUL kit qui reste quand kit/ manque : il est remis en place, jamais effacé
    rm -rf "$KIT_CIBLE"/.kit-provisoire.*
    for reste in "$KIT_CIBLE"/.kit-ancien.*; do
      [ -e "$reste" ] || continue
      if [ ! -e "$KIT_CIBLE/kit" ] && mv "$reste" "$KIT_CIBLE/kit"; then log "Kit de l'activation : un kit resté de côté par une installation interrompue est remis en place."; else rm -rf "$reste"; fi
    done
    KIT_BESOIN_KO=$(( (KIT_OCTETS + 511) / 512 + KIT_MARGE_KO ))
    KIT_LIBRE_KO=$(df -Pk "$KIT_CIBLE" 2>/dev/null | awk 'NR == 2 { print $4 }')
    case "$KIT_LIBRE_KO" in ''|*[!0-9]*) die "place libre illisible (df $KIT_CIBLE) : le kit n'est pas posé, la production garde son site" ;; esac
    [ "$KIT_LIBRE_KO" -ge "$KIT_BESOIN_KO" ] || die "pas assez de place pour poser le kit ($((KIT_LIBRE_KO / 1024)) Mo libres, $((KIT_BESOIN_KO / 1024)) Mo demandés sous $KIT_CIBLE) : libérez de la place (site.precedent/, installateur-courant/), puis sudo sh $DOSSIER/mise-a-jour.sh --force. La production garde son site"
    KIT_NOUVEAU="$KIT_CIBLE/.kit-provisoire.$$"
    KIT_ANCIEN="$KIT_CIBLE/.kit-ancien.$$"
    mkdir "$KIT_NOUVEAU" || die "dossier provisoire du kit impossible : la production garde son site"
    if ! gzip -dc "$KIT_SOURCE/atelier-kit.tar.gz" | tar -xof - -C "$KIT_NOUVEAU"; then rm -rf "$KIT_NOUVEAU"; die "décompression du kit impossible (place ou archive) : la production garde son site"; fi
    chmod 755 "$KIT_NOUVEAU"
    if [ ! -f "$KIT_NOUVEAU/client/package.json" ] || [ ! -f "$KIT_NOUVEAU/data/schema.sql" ]; then rm -rf "$KIT_NOUVEAU"; die "archive du kit incomplète : la production garde son site"; fi
    cp "$KIT_SOURCE/kit.json" "$KIT_NOUVEAU/kit.json" || { rm -rf "$KIT_NOUVEAU"; die "kit.json impossible à poser : la production garde son site"; }
    if [ -e "$KIT_CIBLE/kit" ] && ! mv "$KIT_CIBLE/kit" "$KIT_ANCIEN"; then rm -rf "$KIT_NOUVEAU"; die "l'ancien kit ne se déplace pas : la production garde son site"; fi
    if mv "$KIT_NOUVEAU" "$KIT_CIBLE/kit"; then
      rm -rf "$KIT_ANCIEN"
    else
      rm -rf "$KIT_NOUVEAU"
      if [ -e "$KIT_ANCIEN" ]; then mv "$KIT_ANCIEN" "$KIT_CIBLE/kit" || true; fi
      die "pose du kit impossible (ancien kit remis) : la production garde son site"
    fi
    log "Kit de l'activation posé dans $KIT_CIBLE/kit ($(( KIT_OCTETS / 1048576 )) Mo décompressés) ; site/ et site/_serveur/ ne sont pas touchés."
  }
  poser_le_kit_de_l_activation
else
# >>> activation-fin-prod
# Dernier mot d'un kit seul. VERSION n'a pas encore la nouvelle étiquette : elle la prend ICI, et seulement si activer.sh est sorti en 0 sur « activation : == PASSEE » (activer.sh l'a
# peut-être déjà fait lui-même : alors rien à poser). Sinon (refus, retour automatique, impossible, activer.sh non lancé) la production garde son site, son service et sa VERSION d'avant,
# et la marque .activation-refusee-<étiquette> dit à mise-a-jour.sh de ne pas relancer toutes les 5 minutes une activation (elle gèle les écritures et fabrique tout le site) : même logique que
# .refus-<étiquette> (pas de nouvelle tentative tant que l'étiquette ne change pas ; --force passe outre ; une installation réussie efface les marques). Code 4 : installé, non activé.
if [ "$KIT_SEUL" = 1 ]; then
  ACTIVATION_DERNIERE=''
  ACTIVATION_PASSEE=0
  if [ "${ACTIVATION_LANCEE:-0}" = 1 ] && [ -f "$TRAVAIL/activation.out" ]; then
    ACTIVATION_DERNIERE=$(grep -E '^activation : == (PASSEE|REFUSEE|RETOUR AUTOMATIQUE|IMPOSSIBLE)' "$TRAVAIL/activation.out" | tail -n 1 | cut -c1-300 || true)
    [ -n "$ACTIVATION_DERNIERE" ] || ACTIVATION_DERNIERE="activation : activer.sh est sorti en code ${ACTIVATION_CODE:-?} sans ligne « == »"
    case "$ACTIVATION_DERNIERE" in 'activation : == PASSEE'*) if [ "${ACTIVATION_CODE:-1}" -eq 0 ]; then ACTIVATION_PASSEE=1; fi ;; esac
  fi
  if [ "$ACTIVATION_PASSEE" = 1 ]; then
    if [ -f "$DOSSIER/activation/version-en-attente" ]; then
      cp "$DOSSIER/activation/version-en-attente" "$DOSSIER/.VERSION.$$" && mv -f "$DOSSIER/.VERSION.$$" "$DOSSIER/VERSION" && rm -f "$DOSSIER/activation/version-en-attente" ||
        die "activation passée, mais VERSION n'a pas pu recevoir $TAG : sudo cp $DOSSIER/activation/version-en-attente $DOSSIER/VERSION"
    fi
    rm -f "$DOSSIER"/.activation-refusee-*
  else
    rm -f "$DOSSIER"/.activation-refusee-*
    printf '%s\n' "${ACTIVATION_DERNIERE:-activation : non lancée}" > "$DOSSIER/.activation-refusee-$TAG" 2>/dev/null || true
    log "ERREUR : $TAG est installé (kit posé) mais son activation n'a pas passé (${ACTIVATION_DERNIERE:-activer.sh n'a pas été lancé : raison au journal ci-dessus}) : la production garde son site, son service et sa VERSION d'avant ($(sed -n 's/^tag=//p' "$DOSSIER/VERSION" | head -n 1)) ; marque $DOSSIER/.activation-refusee-$TAG : mise-a-jour.sh ne la rejoue pas tant que l'étiquette ne change pas (sudo sh $DOSSIER/mise-a-jour.sh --force passe outre). Geste : sudo bash $DOSSIER/activer.sh --reprendre${ACTIVER_OPTION:+ $ACTIVER_OPTION} (s'il passe, activer.sh écrit VERSION et efface la marque)"
    exit 4
  fi
fi
# >>> version-avant-prod
# Ce que VERSION disait avant cette installation : remis juste après son écriture (version-apres-prod), la nouvelle étiquette n'étant prise qu'une fois l'activation passée.
VERSION_D_AVANT="$TRAVAIL/VERSION.avant"
if [ "$KIT_SEUL" = 1 ] && [ -f "$DOSSIER/VERSION" ]; then
  cp -p "$DOSSIER/VERSION" "$VERSION_D_AVANT" || die "VERSION d'avant impossible à garder : l'installation est refusée (rien n'a été modifié de la production)"
fi
# >>> version-apres-prod
# La nouvelle VERSION vient d'être écrite : elle est mise en attente (activation/version-en-attente, que activer.sh ou la fin de cette installation posera quand l'activation passe) et
# l'ancienne est remise, par renommage. Sans VERSION d'avant (instance installée autrement), la nouvelle reste : rien à garder.
if [ "$KIT_SEUL" = 1 ] && [ -f "$VERSION_D_AVANT" ]; then
  mkdir -p "$DOSSIER/activation" &&
    cp "$DOSSIER/VERSION" "$DOSSIER/activation/.version-en-attente.$$" && mv -f "$DOSSIER/activation/.version-en-attente.$$" "$DOSSIER/activation/version-en-attente" &&
    cp -p "$VERSION_D_AVANT" "$DOSSIER/.VERSION.$$" && mv -f "$DOSSIER/.VERSION.$$" "$DOSSIER/VERSION" ||
    die "VERSION n'a pas pu être mise en attente (activation/version-en-attente) : voir $DOSSIER/VERSION et sudo sh $DOSSIER/mise-a-jour.sh --force"
fi
