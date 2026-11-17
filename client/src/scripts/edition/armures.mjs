// Extension de l'éditeur pour les pages Armures et Boucliers (/ressources/armures/, /ressources/bouclier/) (components/armures/ArmuresPage.astro) — demande du
// propriétaire (2026-10-15) : la page des armures et des boucliers « Modifiable tout de suite », comme celle des armes (« Quand le mode Edition est
// lancé, il n'est pas possible de "sélectionner" […] mais tous les tableaux sont visibles »).
//   - en mode modification : tous les tableaux des deux onglets s'ouvrent (sauf les règles) et les fiches se ferment (styles/armures/armures.css cache les
//     fiches ; le script de la page ignore les clics) ; les cases des armures, des formes, des boucliers, des poids, des améliorations et le coût de
//     fabrication du bouclier se modifient (éditeur commun : leurs `data-ed` ; le tableau FABRICATION des pièces n'est plus affiché : décision R93),
//     celles des matériaux restent en lecture (décision R62 : la page « Composants ») ;
//   - ni création ni suppression (les fiches de personnage citent armures, pièces, formes et améliorations) ;
//   - un poids de bouclier réécrit (nom, Force) : la liste des poids du service est relue et les pastilles des boucliers (rendu « bouclier-poids »,
//     « Requiert N Force minimum ») refaites, hors des cases en cours de saisie ;
//   - à chaque étape, l'évènement « armures:rafraichir » redemande au script de la page les fiches ouvertes (aucun module partagé
//     entre les deux scripts).
const rafraichir = () => document.dispatchEvent(new CustomEvent('armures:rafraichir'));

/** Un poids réécrit : la liste des poids (GET /api/edition/listes/) puis chaque pastille de poids d'un bouclier, sauf une case en cours de saisie. */
async function rafraichirLesPoids(ed) {
  try {
    Object.assign(ed.listes, await ed.appel('GET', 'edition/listes/'));
  } catch {
    return; // la liste reste celle du chargement : les pastilles suivront au rechargement de la page
  }
  for (const el of document.querySelectorAll('[data-ed-rendu="bouclier-poids"]')) {
    const id = el.querySelector('.ppoids')?.dataset.poids;
    if (id && !ed.editeurs.has(el)) ed.rendre(el, { poids_id: id });
  }
}

/** Les tables dont une ligne réécrite change une fiche de la page. */
const TABLES = ['armure', 'armure_emplacement', 'bouclier_classe', 'bouclier', 'bouclier_poids', 'amelioration_equipement', 'ressource', 'materiau'];

export const armures = {
  nom: 'armures',
  actif: (doc) => Boolean(doc.querySelector('[data-armures]')),

  async ligne(ed, table) {
    if (table === 'bouclier_poids') await rafraichirLesPoids(ed);
    if (TABLES.includes(table)) rafraichir();
  },

  debut() {
    for (const d of document.querySelectorAll('[data-armures] details')) {
      // le panneau de règles : son extension l'ouvre et le referme (edition/panneaux.mjs)
      if (!d.classList.contains('preg')) d.open = true;
    }
    rafraichir();
  },

  apresEnregistrement: () => rafraichir(),

  fin: () => rafraichir(),
};
