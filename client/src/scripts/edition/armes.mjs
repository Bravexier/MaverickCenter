// Extension de l'éditeur pour /ressources/armes/ (components/armes/ArmesPage.astro) — demande du propriétaire : « tout peut être éditable à l'instar des
// autres pages qui peuvent l'être. Quand le mode Edition est lancé, il n'est pas possible de "sélectionner" une arme / matériau / amélioration, mais tous les
// tableaux sont visibles. »
//   - en mode modification : tous les tableaux s'ouvrent (familles, matériaux, améliorations) et la fiche de l'arme se ferme (styles/armes/armes.css cache
//     la fiche et montre les colonnes `ed-seul` ; le script de la page ignore les clics) ;
//   - une arme enregistrée : sa ligne suit la case « Arme de départ » (fond bleu, infobulle) et sa description (infobulle du nom) ; les autres cellules
//     sont réécrites par l'éditeur (rendus de lib/armes-rendu.mjs) ;
//   - à chaque étape, l'évènement « armes:rafraichir » redemande au script de la page le total des améliorations et la fiche ouverte (aucun module partagé
//     entre les deux scripts).
const rafraichir = () => document.dispatchEvent(new CustomEvent('armes:rafraichir'));

export const armes = {
  nom: 'armes',
  actif: (doc) => Boolean(doc.querySelector('[data-armes]')),

  ligne(_ed, table, cle, ligne) {
    if (table === 'arme' && ligne) {
      const tr = document.querySelector(`tr.arme[data-arme="${CSS.escape(cle.id)}"]`);
      if (tr) {
        const depart = Number(ligne.depart_possible) === 1;
        tr.classList.toggle('arme--depart', depart);
        if (depart) tr.title = 'Arme de départ';
        else tr.removeAttribute('title');
        const nom = tr.querySelector('.arme__choisir');
        if (nom) {
          if (ligne.description) nom.title = ligne.description;
          else nom.removeAttribute('title');
        }
      }
    }
    if (['arme', 'materiau_arme', 'amelioration_equipement'].includes(table)) rafraichir();
  },

  debut() {
    for (const d of document.querySelectorAll('[data-armes] details')) {
      if (!d.classList.contains('armes-regles')) d.open = true;
    }
    rafraichir();
  },

  apresEnregistrement: () => rafraichir(),

  fin: () => rafraichir(),
};
