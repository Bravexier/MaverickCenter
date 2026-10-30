// Script du texte « Pièces élémentaires » des pages Armes et Armures (components/equipement/PiecesElementaires.astro : un `<details>` replié sous le
// panneau de règles ; « Fusionner dans Armes et Armures », 2026-10-29). Les liens de la page d'avant y mènent (`ressources/armes/#pieces-elementaires`,
// lib/equipement.mjs#ANCRE_DES_PIECES_ELEMENTAIRES) : une adresse qui vise le bloc, ou un élément qu'il contient, l'ouvre, au chargement et quand l'ancre
// change (hashchange) ; un élément du bloc visé est amené à l'écran une fois le bloc ouvert. Toute autre adresse ne le touche pas (il reste comme le
// lecteur l'a laissé). Un clic sur un lien vers l'ancre que l'adresse a déjà (le bloc refermé depuis) ne change pas l'ancre, donc pas de hashchange :
// le clic l'ouvre lui-même, avant que le navigateur ne défile.
// Sans import (aucun module partagé avec un autre script de page : skill site-version-portable) ; testé dans un faux navigateur
// (test/pieces-elementaires-script.test.mjs).
const BLOC = 'details.preg--pieces-elementaires';

if (document.querySelector(BLOC)) {
  const depuisAdresse = () => {
    let id = '';
    try {
      id = decodeURIComponent(location.hash.slice(1));
    } catch {
      return; // adresse mal formée : ignorée
    }
    const cible = id ? document.getElementById(id) : null;
    const bloc = cible?.closest(BLOC);
    if (!bloc) return;
    bloc.open = true;
    if (cible !== bloc) cible.scrollIntoView({ block: 'start' });
  };
  window.addEventListener('hashchange', depuisAdresse);
  // un lien de la page vers l'ancre de l'adresse (clic simple, même page) : pas de hashchange, l'adresse relue ici
  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const href = e.target?.closest?.('a[href]')?.getAttribute('href');
    if (!href || !location.hash) return;
    let vers;
    try {
      vers = new URL(href, location.href);
    } catch {
      return;
    }
    const ici = new URL(location.href);
    if (vers.origin === ici.origin && vers.pathname === ici.pathname && vers.search === ici.search && vers.hash === location.hash) depuisAdresse();
  });
  depuisAdresse();
}
