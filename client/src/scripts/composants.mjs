// Script de la page /ressources/composants/ (components/composants/ComposantsPage.astro) : la recherche filtre les lignes de tous les tableaux (leur
// `data-recherche` : mots en minuscules, sans accents), le nombre de lignes de chaque tableau suit, un tableau sans ligne trouvée se cache ; « Tout
// déplier » / « Tout replier ». Sans import (aucun module partagé avec un autre script de page). L'extension de l'éditeur (src/scripts/edition/composants.mjs)
// redemande le filtre par l'évènement « composants:rafraichir » (une ligne créée ou supprimée).
const racine = document.querySelector('[data-composants]');
if (racine) {
  const champ = racine.querySelector('[data-composants-recherche]');
  const compte = racine.querySelector('[data-composants-compte]');
  const rien = racine.querySelector('[data-composants-rien]');
  const cle = (t) => String(t ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();

  function filtrer() {
    const mots = cle(champ?.value).split(/\s+/).filter(Boolean);
    let total = 0;
    for (const tableau of racine.querySelectorAll('.comp-tableau')) {
      let n = 0;
      for (const tr of tableau.querySelectorAll('tbody > tr')) {
        const garde = mots.every((m) => (tr.dataset.recherche ?? '').includes(m));
        tr.classList.toggle('est-filtree', !garde);
        if (garde) n += 1;
      }
      const c = tableau.querySelector('.comp-tableau__compte');
      if (c) c.textContent = String(n);
      tableau.hidden = mots.length > 0 && n === 0;
      if (mots.length && n) tableau.open = true;
      total += n;
    }
    // un titre de groupe (« Ingrédients d'alchimie »…) se cache quand tous ses tableaux le sont
    for (const titre of racine.querySelectorAll('.composants-groupe')) {
      let visible = false;
      for (let el = titre.nextElementSibling; el && !el.matches('.composants-groupe'); el = el.nextElementSibling) if (!el.hidden) visible = true;
      titre.hidden = !visible;
    }
    if (compte) compte.textContent = `${total} composant${total > 1 ? 's' : ''}`;
    if (rien) rien.hidden = total > 0;
  }

  champ?.addEventListener('input', filtrer);
  for (const b of racine.querySelectorAll('[data-composants-tout]')) {
    b.addEventListener('click', () => {
      for (const d of racine.querySelectorAll('.comp-tableau')) d.open = b.dataset.composantsTout === 'ouvrir';
    });
  }
  document.addEventListener('composants:rafraichir', filtrer);
}
