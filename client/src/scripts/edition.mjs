// Chargeur du mode modification (components/edition/Edition.astro) : léger, il est sur toutes les pages modifiables, y compris en production où il ne
// fait rien. L'éditeur n'est chargé que sur le site de dev : le service répond `edition: true` à /api/etat/ (MAVERICK_EDITION=1, docs/serveur.md,
// « Édition »). Sur tous les écrans, téléphone et tablette compris (demande du propriétaire, 2026-10-15 : un outil pour ceux qui bidouillent déjà).
const racine = document.querySelector('[data-edition]');
let lance = false;

async function lancer() {
  if (lance || !racine) return;
  lance = true;
  try {
    const reponse = await fetch(`${racine.dataset.api}etat/`, { headers: { Accept: 'application/json' }, cache: 'no-store' });
    const etat = reponse.ok ? await reponse.json() : null;
    if (!etat?.edition) return;
    const { demarrer } = await import('./edition/editeur.mjs');
    demarrer(racine, etat);
  } catch {
    // service absent (site statique seul, version portable) : pas d'édition
  }
}

lancer();
