// Extension de l'éditeur pour les onglets Armures et Boucliers de /ressources/equipement/ (components/armures/ArmuresPage.astro) — demande du
// propriétaire (2026-10-15) : la page des armures et des boucliers « Modifiable tout de suite », comme celle des armes (« Quand le mode Edition est
// lancé, il n'est pas possible de "sélectionner" […] mais tous les tableaux sont visibles »).
//   - en mode modification : tous les tableaux des deux onglets s'ouvrent (sauf les règles) et les fiches se ferment (styles/armures/armures.css cache les
//     fiches ; le script de la page ignore les clics) ; les cases des armures, des pièces, des formes, des boucliers, des poids et des améliorations se
//     modifient (éditeur commun : leurs `data-ed`), celles des matériaux restent en lecture (décision R62 : la page « Composants ») ;
//   - ni création ni suppression (les fiches de personnage citent armures, pièces, formes et améliorations) ;
//   - à chaque étape, l'évènement « armures:rafraichir » redemande au script de la page les fiches ouvertes (aucun module partagé
//     entre les deux scripts).
const rafraichir = () => document.dispatchEvent(new CustomEvent('armures:rafraichir'));

/** Les tables dont une ligne réécrite change une fiche de la page. */
const TABLES = ['armure', 'armure_emplacement', 'bouclier_classe', 'bouclier', 'bouclier_poids', 'amelioration_equipement', 'ressource', 'materiau'];

export const armures = {
  nom: 'armures',
  actif: (doc) => Boolean(doc.querySelector('[data-armures]')),

  ligne(_ed, table) {
    if (TABLES.includes(table)) rafraichir();
  },

  debut() {
    for (const d of document.querySelectorAll('[data-armures] details')) {
      if (!d.classList.contains('armures-regles')) d.open = true;
    }
    rafraichir();
  },

  apresEnregistrement: () => rafraichir(),

  fin: () => rafraichir(),
};
