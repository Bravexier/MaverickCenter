// Script de la page /ressources/objets-a-la-ceinture/ (components/ceinture/CeinturePage.astro) : la recherche filtre les lignes (`tr.ceint-ligne`) des
// tableaux (`[data-ceinture-tableau]`) d'après leur `data-recherche` (mots en minuscules, sans accents) ; une potion se trouve aussi par le titre et le
// résumé de sa page, le `data-recherche` de son <tbody>. Seuls les <tbody data-ceinture-corps> sont filtrés (pas ceux d'un tableau des règles) ; un
// <tbody> sans ligne trouvée se cache avec son titre de groupe ; le nombre d'objets de chaque tableau suit ; un tableau sans ligne trouvée se cache,
// et un groupe (`[data-ceinture-groupe]` : « Potions ») dont tous les tableaux le sont.
// « Tout déplier » / « Tout replier ». Une recherche que le navigateur remet (retour arrière) est appliquée au chargement. Sans import (aucun module
// partagé avec un autre script de page) ; testé dans un faux navigateur (test/ceinture-script.test.mjs).
const racine = document.querySelector('[data-ceinture]');
if (racine) {
  const champ = racine.querySelector('[data-ceinture-recherche]');
  const compte = racine.querySelector('[data-ceinture-compte]');
  const rien = racine.querySelector('[data-ceinture-rien]');
  const cle = (t) => String(t ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
  const objets = (n) => `${n} objet${n > 1 ? 's' : ''}`;

  function filtrer() {
    const mots = cle(champ?.value).split(/\s+/).filter(Boolean);
    let total = 0;
    for (const tableau of racine.querySelectorAll('[data-ceinture-tableau]')) {
      let n = 0;
      for (const corps of tableau.querySelectorAll('[data-ceinture-corps]')) {
        const duGroupe = corps.dataset.recherche ?? '';
        let visibles = 0;
        for (const tr of corps.querySelectorAll('tr.ceint-ligne')) {
          const texte = `${duGroupe} ${tr.dataset.recherche ?? ''}`;
          const garde = mots.every((m) => texte.includes(m));
          tr.classList.toggle('est-filtree', !garde);
          if (garde) visibles += 1;
        }
        corps.hidden = visibles === 0;
        n += visibles;
      }
      const c = tableau.querySelector('[data-compte]');
      if (c) c.textContent = String(n);
      tableau.hidden = mots.length > 0 && n === 0;
      if (mots.length && n) tableau.open = true;
      total += n;
    }
    for (const groupe of racine.querySelectorAll('[data-ceinture-groupe]')) {
      groupe.hidden = ![...groupe.querySelectorAll('[data-ceinture-tableau]')].some((t) => !t.hidden);
    }
    if (compte) compte.textContent = objets(total);
    if (rien) rien.hidden = total > 0;
  }

  champ?.addEventListener('input', filtrer);
  for (const b of racine.querySelectorAll('[data-ceinture-tout]')) {
    b.addEventListener('click', () => {
      for (const d of racine.querySelectorAll('[data-ceinture-tableau]')) d.open = b.dataset.ceintureTout === 'ouvrir';
    });
  }
  if (champ?.value) filtrer();
}
