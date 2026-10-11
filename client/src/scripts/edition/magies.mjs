// Extension de l'éditeur pour les pages de magie (components/magie/*) — demande du propriétaire : chaque case de chaque sort se modifie. Une ligne
// peut avoir un effet dû aux NM dans plusieurs colonnes (le propriétaire a des cas : la règle d'une seule colonne a été retirée). Ici, un bouton
// « Détails » ouvre le panneau du sort (effets, remarque, texte du sort de niveau 5), dont les champs se modifient aussi.
// La table des relations entre magies (résistances, vulnérabilités, incompatibilités) ne se modifie pas.

export const magies = {
  nom: 'magies',
  actif: (doc) => Boolean(doc.querySelector('tbody.sort[data-ed-sort]')),

  debut() {
    for (const tbody of document.querySelectorAll('tbody.sort[data-ed-sort]')) {
      const cellule = tbody.querySelector('.sort__nom');
      if (!cellule || cellule.querySelector('.ed-details')) continue;
      const bouton = document.createElement('button');
      bouton.type = 'button';
      bouton.className = 'ed-outil ed-details';
      bouton.textContent = 'Détails';
      bouton.title = 'Ouvrir ou fermer les effets, la remarque et le texte du sort (modifiables aussi)';
      cellule.append(bouton); // le clic remonte à la ligne : SortsInteractifs.astro ouvre ou ferme le panneau
    }
  },

  fin() {
    for (const el of document.querySelectorAll('.ed-details')) el.remove();
  },
};
