# --- Kit de l'atelier (mode test seulement ; docs/serveur.md, « Fabriquer le site depuis un fichier de contenu ») ------------------------------------------
# Ce fragment est inséré par fabriquer.mjs à la place de la ligne repère du modèle installateur.sh, dans un installateur de TEST seulement : celui de production
# ne le porte pas (son script est identique, octet pour octet, à celui d'avant le kit). Il n'est pas livré tel quel.
# Le kit (atelier-kit/atelier-kit.tar.gz et kit.json dans l'archive : deploy/installateur/kit.mjs) est posé dans <instance>/atelier/kit/, HORS de site/ : jamais servi.
# Il est décompressé dans un dossier provisoire voisin, puis remplace l'ancien par renommage : un seul kit est gardé, et l'ancien reste en place tant que le nouveau
# n'est pas complet. Un manque de place ou un échec ne fait JAMAIS échouer l'installation : le site est déjà posé, le journal dit que le kit manque.
KIT_SOURCE="$TRAVAIL/atelier-kit"
KIT_MARGE_KO=262144
poser_le_kit() {
  [ -d "$KIT_SOURCE" ] || return 0
  [ -f "$KIT_SOURCE/atelier-kit.tar.gz" ] && [ -f "$KIT_SOURCE/kit.json" ] || { log "Kit de l'atelier : fichiers manquants dans l'archive, installation sans kit."; return 0; }
  KIT_OCTETS=$(sed -n 's/.*"taille_decompressee_octets": *\([0-9][0-9]*\).*/\1/p' "$KIT_SOURCE/kit.json" | head -n 1)
  case "$KIT_OCTETS" in ''|*[!0-9]*) log "Kit de l'atelier : kit.json illisible (taille décompressée), installation sans kit."; return 0 ;; esac
  mkdir -p "$DOSSIER/atelier" || { log "Kit de l'atelier : impossible de créer $DOSSIER/atelier, installation sans kit."; return 0; }
  # les restes d'une installation interrompue (un signal) : un provisoire se jette ; un ancien kit est le SEUL kit qui reste quand kit/ manque (interruption entre
  # les deux renommages) : il est remis en place, jamais effacé ; quand kit/ est là, l'ancien est périmé
  rm -rf "$DOSSIER"/atelier/.kit-provisoire.*
  for reste in "$DOSSIER"/atelier/.kit-ancien.*; do
    [ -e "$reste" ] || continue
    if [ ! -e "$DOSSIER/atelier/kit" ] && mv "$reste" "$DOSSIER/atelier/kit"; then
      log "Kit de l'atelier : un kit resté de côté par une installation interrompue est remis en place."
    else
      rm -rf "$reste"
    fi
  done
  # Deux fois la taille décompressée (le nouveau kit s'ajoute à l'ancien jusqu'au renommage), plus une marge.
  KIT_BESOIN_KO=$(( (KIT_OCTETS + 511) / 512 + KIT_MARGE_KO ))
  KIT_LIBRE_KO=$(df -Pk "$DOSSIER/atelier" 2>/dev/null | awk 'NR == 2 { print $4 }')
  case "$KIT_LIBRE_KO" in ''|*[!0-9]*) log "Kit de l'atelier : place libre illisible (df), installation sans kit."; return 0 ;; esac
  if [ "$KIT_LIBRE_KO" -lt "$KIT_BESOIN_KO" ]; then
    log "Kit de l'atelier : pas assez de place ($((KIT_LIBRE_KO / 1024)) Mo libres, $((KIT_BESOIN_KO / 1024)) Mo demandés), installation sans kit. Le site, lui, est installé."
    return 0
  fi
  KIT_NOUVEAU="$DOSSIER/atelier/.kit-provisoire.$$"
  KIT_ANCIEN="$DOSSIER/atelier/.kit-ancien.$$"
  mkdir "$KIT_NOUVEAU" || { log "Kit de l'atelier : dossier provisoire impossible, installation sans kit."; return 0; }
  if ! gzip -dc "$KIT_SOURCE/atelier-kit.tar.gz" | tar -xof - -C "$KIT_NOUVEAU"; then
    rm -rf "$KIT_NOUVEAU"
    log "Kit de l'atelier : décompression impossible (place ou archive), installation sans kit."
    return 0
  fi
  if [ ! -f "$KIT_NOUVEAU/client/package.json" ] || [ ! -f "$KIT_NOUVEAU/data/schema.sql" ]; then
    rm -rf "$KIT_NOUVEAU"
    log "Kit de l'atelier : archive incomplète, installation sans kit."
    return 0
  fi
  cp "$KIT_SOURCE/kit.json" "$KIT_NOUVEAU/kit.json" || { rm -rf "$KIT_NOUVEAU"; log "Kit de l'atelier : kit.json impossible à poser, installation sans kit."; return 0; }
  if [ -e "$DOSSIER/atelier/kit" ] && ! mv "$DOSSIER/atelier/kit" "$KIT_ANCIEN"; then
    rm -rf "$KIT_NOUVEAU"
    log "Kit de l'atelier : l'ancien kit ne se déplace pas, installation sans nouveau kit."
    return 0
  fi
  if mv "$KIT_NOUVEAU" "$DOSSIER/atelier/kit"; then
    rm -rf "$KIT_ANCIEN"
    log "Kit de l'atelier posé dans $DOSSIER/atelier/kit ($(( KIT_OCTETS / 1048576 )) Mo décompressés)."
  else
    rm -rf "$KIT_NOUVEAU"
    if [ -e "$KIT_ANCIEN" ]; then mv "$KIT_ANCIEN" "$DOSSIER/atelier/kit" || true; fi
    log "Kit de l'atelier : pose impossible, ancien kit remis, installation sans nouveau kit."
  fi
}
poser_le_kit || log "Kit de l'atelier : échec inattendu, installation sans kit."

# --- Les outils de l'atelier et la marque (mode test seulement) --------------------------------------------------------------------------------------------
# Les scripts de l'atelier (deploy/installateur/atelier/ : installer.sh, lancer.sh, lib.sh) sont posés dans <instance>/atelier/ : installer.sh à la racine de l'atelier
# (la commande courte du propriétaire), les autres dans atelier/outils/. Seuls ces fichiers sont remplacés (par renommage), et seuls ceux d'outils/ qui ne sont plus
# livrés sont retirés : le kit, le travail, la sortie et les rapports de l'atelier ne sont jamais touchés. Tout est à root, comme l'installateur.
poser_les_outils_de_l_atelier() {
  OUTILS_SOURCE="$TRAVAIL/atelier-scripts"
  [ -d "$OUTILS_SOURCE" ] || return 0
  mkdir -p "$DOSSIER/atelier/outils" || { log "Atelier : impossible de créer $DOSSIER/atelier/outils, outils non posés."; return 0; }
  for f in "$OUTILS_SOURCE"/*; do
    [ -f "$f" ] || continue
    nom=$(basename "$f")
    if [ "$nom" = installer.sh ]; then cible="$DOSSIER/atelier/installer.sh"; else cible="$DOSSIER/atelier/outils/$nom"; fi
    if ! { cp "$f" "$cible.$$" && chmod 755 "$cible.$$" && mv -f "$cible.$$" "$cible"; }; then
      rm -f "$cible.$$"
      log "Atelier : $nom n'a pas pu être posé."
    fi
  done
  for f in "$DOSSIER/atelier/outils"/*; do
    [ -e "$f" ] || continue
    nom=$(basename "$f")
    if [ "$nom" = installer.sh ] || [ ! -f "$OUTILS_SOURCE/$nom" ]; then rm -rf "$f"; fi
  done
}
# La marque : ce que l'atelier surveille. Posée seulement si le kit posé est celui de cette livraison (sinon l'atelier fabriquerait avec le code d'une autre version) ;
# kit.json est recopié dans rapports/ (lu par le service, en lecture seule : « le kit est posé »), ou retiré quand il n'y a pas de kit. Rien ne consomme la marque tant
# que le propriétaire n'a pas lancé atelier/installer.sh.
signaler_l_atelier() {
  rapports_atelier="$DOSSIER/atelier/rapports"
  if [ -f "$DOSSIER/atelier/kit/kit.json" ]; then
    mkdir -p "$rapports_atelier" "$DOSSIER/atelier/declencheur" || return 0
    chmod 755 "$rapports_atelier" "$DOSSIER/atelier/declencheur"
    cp "$DOSSIER/atelier/kit/kit.json" "$rapports_atelier/.kit.json.$$" && chmod 644 "$rapports_atelier/.kit.json.$$" && mv -f "$rapports_atelier/.kit.json.$$" "$rapports_atelier/kit.json" || rm -f "$rapports_atelier/.kit.json.$$"
    version_du_kit=$(sed -n 's/.*"version": *"\([0-9][0-9]*\.[0-9][0-9]*\.[0-9][0-9]*\)".*/\1/p' "$DOSSIER/atelier/kit/kit.json" | head -n 1)
    if [ "$version_du_kit" = "$VERSION" ]; then
      printf 'version=%s\ntag=%s\ncommit=%s\n' "$VERSION" "$TAG" "$COMMIT" > "$DOSSIER/atelier/declencheur/marque"
      log "Atelier : marque posée pour la version $VERSION."
    else
      log "Atelier : le kit posé est celui de la version ${version_du_kit:-inconnue}, pas de la $VERSION : pas de marque."
    fi
  elif [ -d "$rapports_atelier" ]; then
    rm -f "$rapports_atelier/kit.json"
  fi
}
poser_les_outils_de_l_atelier || log "Atelier : outils non posés."
signaler_l_atelier || log "Atelier : marque non posée."
