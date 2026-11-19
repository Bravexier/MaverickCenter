# --- Activation par paquet (installateur de PRODUCTION seulement ; lot 11, PR 5a ; docs/serveur.md, « Bascule 2 : préparation », « PR 5a ») ---------------------------------------
# Ce fragment est inséré par fabriquer.mjs à la place de la ligne repère du modèle installateur.sh, dans un installateur de PRODUCTION seulement : celui de test ne le porte pas.
# ÉTEINT par défaut : sans le fichier <instance>/activation-par-paquet (que le propriétaire pose en root le jour J : `sudo touch <instance>/activation-par-paquet`), il ne fait RIEN
# et l'installation est celle d'avant, au même résultat. Avec lui :
#   1. l'utilisateur système maverick-site est créé s'il manque (sans connexion, sans dossier personnel) ;
#   2. site/ lui est donné SAUF site/_serveur/ (le code que le service exécute), qui reste à root ; le chown est fait par root sans JAMAIS suivre un lien (`find -P … -exec chown -h`,
#      garde-fou 20 : le propriétaire de ce que root touche ne se lit jamais à travers un lien posé par un service) ;
#   3. si le kit de l'activation est posé (activation/kit/kit.json), activer.sh est lancé (root) : paquet contrôlé, pages fabriquées, bascule courte, contrôle de santé, retour
#      automatique. Son refus ne fait jamais échouer l'installation : il est dit au journal, la production garde son site et sa base ; le geste exact est dans sa sortie.
activation_par_paquet() {
  [ -f "$DOSSIER/activation-par-paquet" ] && [ ! -L "$DOSSIER/activation-par-paquet" ] || return 0
  log "Activation par paquet : $DOSSIER/activation-par-paquet existe."
  if [ "$(id -u)" -ne 0 ]; then
    log "Activation par paquet : pas root : l'utilisateur maverick-site et les droits de site/ ne sont pas posés. Geste : sudo sh $DOSSIER/mise-a-jour.sh --force"
    return 0
  fi
  if ! id maverick-site >/dev/null 2>&1; then
    if command -v useradd >/dev/null 2>&1; then useradd --system --user-group --no-create-home --shell /usr/sbin/nologin maverick-site
    elif command -v adduser >/dev/null 2>&1; then adduser --system --group --no-create-home --shell /usr/sbin/nologin maverick-site
    else log "Activation par paquet : ni useradd ni adduser : l'utilisateur maverick-site n'a pas pu être créé."; return 0
    fi
    id maverick-site >/dev/null 2>&1 || { log "Activation par paquet : l'utilisateur maverick-site n'a pas pu être créé."; return 0; }
    log "Activation par paquet : utilisateur système maverick-site créé."
  fi
  if [ -d "$SITE/_serveur" ] && [ ! -L "$SITE/_serveur" ]; then
    find -P "$SITE" -path "$SITE/_serveur" -prune -o -exec chown -h maverick-site:maverick-site {} + || { log "Activation par paquet : le propriétaire de site/ n'a pas pu être donné à maverick-site."; return 0; }
    find -P "$SITE/_serveur" -exec chown -h root:root {} + || { log "Activation par paquet : site/_serveur n'a pas pu être rendu à root."; return 0; }
    log "Activation par paquet : site/ appartient à maverick-site, site/_serveur reste à root."
  else
    log "Activation par paquet : $SITE/_serveur n'est pas un dossier ordinaire : droits non posés."
    return 0
  fi
  if [ -f "$DOSSIER/activation/kit/kit.json" ] && [ -f "$DOSSIER/activer.sh" ]; then
    log "Activation par paquet : le kit est posé, activer.sh est lancé."
    ACTIVATION_CODE=0
    bash "$DOSSIER/activer.sh" --prod "$DOSSIER" > "$TRAVAIL/activation.out" 2>&1 || ACTIVATION_CODE=$?
    cat "$TRAVAIL/activation.out"
    if [ -n "$JOURNAL" ]; then cat "$TRAVAIL/activation.out" >> "$JOURNAL" 2>/dev/null || true; fi
    if [ "$ACTIVATION_CODE" -eq 0 ]; then log "Activation par paquet : passée."
    else log "ATTENTION activation par paquet : code $ACTIVATION_CODE (refusée, retour automatique ou impossible : voir sa sortie ci-dessus). L'installation, elle, est faite ; la production garde son site et sa base. Pour rejouer : sudo bash $DOSSIER/activer.sh --reprendre"
    fi
  else
    log "Activation par paquet : pas de kit dans $DOSSIER/activation/kit : activer.sh n'est pas lancé (la production reçoit son kit de l'installateur de production : lot 11, PR 5b)."
  fi
}
activation_par_paquet || log "Activation par paquet : échec inattendu."
