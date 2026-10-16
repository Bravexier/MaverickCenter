// Script de l'onglet « Bâtons magiques » de la page /ressources/equipement/ (components/equipement/BatonsMagiques.astro ; demande du propriétaire du
// 2026-10-16 : « une colonne "niveau" avec un slider de 1 à 3 à chaque fois. La case de la colonne "effet" se mettra à jour en fonction du niveau ») :
// le curseur d'une ligne (`[data-baton-curseur]`) pose son niveau sur la ligne (`tr[data-niveau]`), dont le CSS n'affiche que la qualité de la gemme,
// l'effet et le prix de ce niveau (`[data-niv]`, styles/equipement/equipement.css) ; le chiffre à côté du curseur (`[data-baton-niveau]`) et le texte lu
// par un lecteur d'écran (`aria-valuetext`) suivent. Un niveau que le navigateur remet dans un curseur (retour arrière) est appliqué au chargement.
// Sans import (aucun module partagé avec un autre script de page) ; testé dans un faux navigateur (test/batons-script.test.mjs).
const racine = document.querySelector('[data-batons]');
if (racine) {
  for (const curseur of racine.querySelectorAll('[data-baton-curseur]')) {
    const ligne = curseur.closest('tr');
    if (!ligne) continue;
    const chiffre = ligne.querySelector('[data-baton-niveau]');
    const appliquer = () => {
      const niveau = String(curseur.value);
      ligne.dataset.niveau = niveau;
      if (chiffre) chiffre.textContent = niveau;
      curseur.setAttribute('aria-valuetext', `Niveau ${niveau}`);
    };
    curseur.addEventListener('input', appliquer);
    appliquer();
  }
}
