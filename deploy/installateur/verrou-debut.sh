# --- Verrou de l'atelier (mode test seulement ; docs/serveur.md, « Bascule 2 : préparation ») ------------------------------------------------------------
# L'atelier du site de dev peut POSER un site fabriqué dans site/ (interrupteur atelier/servir) : pendant la pose de site/ par cette installation, on prend le MÊME verrou que lui
# (atelier/.verrou, un flock) pour que les deux ne s'écrivent jamais ensemble. Sans atelier (pas de dossier atelier/) ou sans flock : rien. Attente de 45 minutes au plus (une fabrication de
# l'atelier dure au plus délai + pose) ; passé ce temps, l'installation continue sans le verrou et le dit. Le verrou est rendu aussitôt la pose de site/ faite.
if [ -d "$DOSSIER/atelier" ] && [ ! -L "$DOSSIER/atelier" ] && command -v flock >/dev/null 2>&1; then
  exec 8>"$DOSSIER/atelier/.verrou"
  if flock -w 2700 8; then log "Atelier : verrou pris pour poser site/."; else log "Atelier : le verrou est tenu depuis plus de 45 minutes ; site/ est posé sans lui."; fi
fi
