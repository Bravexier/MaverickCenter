// Script de la page /ressources/composants/ (components/composants/ComposantsPage.astro) : la recherche filtre les lignes de tous les tableaux (leur
// `data-recherche` : mots en minuscules, sans accents) ; chaque onglet dit combien de lignes son tableau garde, un onglet sans ligne trouvée s'estompe
// (son panneau, ouvert à la main, le dit), et si celui qui est ouvert n'en a plus, le premier qui en a s'ouvre (évènement « onglets:ouvrir » de
// components/Onglets.astro, sans toucher à l'adresse). Sans import (aucun module partagé avec un autre script de page). L'extension de l'éditeur (src/scripts/edition/composants.mjs) redemande le
// filtre par l'évènement « composants:rafraichir » (une ligne créée ou supprimée).
const racine = document.querySelector('[data-composants]');
if (racine) {
  const champ = racine.querySelector('[data-composants-recherche]');
  const compte = racine.querySelector('[data-composants-compte]');
  const rien = racine.querySelector('[data-composants-rien]');
  const cle = (t) => String(t ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
  const ongletDe = (panneau) => racine.querySelector(`.composants-onglets #onglet-${CSS.escape(panneau.id)}`);

  function filtrer() {
    const mots = cle(champ?.value).split(/\s+/).filter(Boolean);
    let total = 0;
    const trouves = [];
    for (const panneau of racine.querySelectorAll('.composants-panneau')) {
      let n = 0;
      for (const tr of panneau.querySelectorAll('tbody > tr')) {
        const garde = mots.every((m) => (tr.dataset.recherche ?? '').includes(m));
        tr.classList.toggle('est-filtree', !garde);
        if (garde) n += 1;
      }
      const onglet = ongletDe(panneau);
      const c = onglet?.querySelector('[data-compte]');
      if (c) c.textContent = String(n);
      onglet?.classList.toggle('est-vide', mots.length > 0 && n === 0);
      // ouvert à la main pendant une recherche, un onglet sans ligne trouvée le dit
      const vide = panneau.querySelector('[data-rien]');
      if (vide) vide.hidden = !(mots.length > 0 && n === 0);
      if (n) trouves.push(panneau);
      total += n;
    }
    // l'onglet ouvert n'a plus rien : le premier qui a des lignes trouvées s'ouvre
    const ouvert = racine.querySelector('.composants-panneau.is-active');
    if (mots.length && ouvert && !trouves.includes(ouvert) && trouves[0]) trouves[0].dispatchEvent(new CustomEvent('onglets:ouvrir', { bubbles: true }));
    if (compte) compte.textContent = `${total} composant${total > 1 ? 's' : ''}`;
    if (rien) rien.hidden = total > 0;
  }

  champ?.addEventListener('input', filtrer);
  document.addEventListener('composants:rafraichir', filtrer);
}
