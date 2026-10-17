// Extension de l'éditeur pour l'onglet Armes de /ressources/equipement/ (components/armes/ArmesPage.astro) — demandes du propriétaire : « tout peut
// être éditable à l'instar des autres pages qui peuvent l'être. Quand le mode Edition est lancé, il n'est pas possible de "sélectionner" une arme /
// matériau / amélioration, mais tous les tableaux sont visibles » ; « Fais donc la possibilité de créer / supprimer des armes ».
//   - en mode modification : tous les tableaux s'ouvrent (familles, matériaux, améliorations) et la fiche de l'arme se vide (styles/armes/armes.css cache
//     la fiche et montre les colonnes `ed-seul` ; le script de la page ignore les clics) ;
//   - ajouter : formulaire « Nouvelle arme » (famille, nom, compétence, type, effet…), enregistré tout de suite (POST /api/edition/, opération creer) ; sa
//     ligne s'ajoute à la fin du tableau de sa famille (lib/armes-rendu.mjs#htmlDeLigneDArme, le HTML de la page construite) ;
//   - supprimer : bouton sur chaque ligne ; la suppression part avec le bouton de confirmation (une fiche de personnage qui a l'arme la perd, avec une
//     note datée : décision R52, annonce de l'éditeur) ;
//   - au chargement, une arme créée ou supprimée depuis la construction du site apparaît ou disparaît (lignes en attente) ;
//   - une arme enregistrée : sa ligne suit la case « Arme de départ » (fond bleu, infobulle) et sa description (infobulle du nom) ;
//   - à chaque étape, l'évènement « armes:rafraichir » redemande au script de la page la fiche ouverte et le filtre (aucun module partagé
//     entre les deux scripts).
import { cleDeLigne, ENTITES } from '../../lib/edition-modele.mjs';
import { htmlDeLigneDArme } from '../../lib/armes-rendu.mjs';

const rafraichir = () => document.dispatchEvent(new CustomEvent('armes:rafraichir'));
const ligneDe = (id) => document.querySelector(`tr.arme[data-arme="${CSS.escape(id)}"]`);
const supprimees = new Set();

/** Le nombre d'armes affiché en tête de la famille d'une ligne. */
function recompter(famille) {
  const compte = famille?.querySelector('.armes-famille__compte');
  if (!compte) return;
  const n = famille.querySelectorAll('tbody tr.arme').length;
  compte.textContent = `${n} arme${n > 1 ? 's' : ''}`;
}

/**
 * Les lignes d'une arme que la page n'a pas (la sienne et celle de ses effets : lib/armes-rendu.mjs#htmlDeLigneDArme), ajoutées à la fin du tableau de
 * sa famille (rien si la famille n'est pas sur la page) ; rend la ligne de l'arme.
 */
function ajouter(ed, ligne) {
  if (ligneDe(ligne.id)) return ligneDe(ligne.id);
  const famille = document.getElementById(`famille-${ligne.famille_id}`);
  const corps = famille?.querySelector('tbody');
  if (!corps) return null;
  corps.insertAdjacentHTML('beforeend', htmlDeLigneDArme(ligne, ed.listes));
  const tr = ligneDe(ligne.id);
  tr?.classList.add('ed-nouveau');
  recompter(famille);
  return tr;
}

function retirer(id) {
  const tr = ligneDe(id);
  if (!tr) return;
  const famille = tr.closest('.armes-famille');
  if (tr.nextElementSibling?.classList.contains('arme-suite')) tr.nextElementSibling.remove();
  tr.remove();
  recompter(famille);
}

function boutonSupprimer(tr) {
  const cellule = tr.querySelector('.arme__nom');
  if (!cellule || cellule.querySelector('.ed-supprimer')) return;
  const bouton = document.createElement('button');
  bouton.type = 'button';
  bouton.className = 'ed-outil ed-outil--danger ed-supprimer';
  bouton.textContent = 'Supprimer';
  bouton.setAttribute('aria-pressed', 'false');
  // R52 (comme R42) : les fiches qui l'ont la perdent, avec une note datée ; elles sont annoncées après l'enregistrement (editeur.mjs, annonceDesFiches)
  bouton.title = 'Supprimer cette arme (à l’enregistrement) ; une fiche de personnage qui l’a la perdra, avec une note datée';
  bouton.addEventListener('click', (e) => {
    e.stopPropagation();
    const id = tr.dataset.arme;
    const oui = !supprimees.has(id);
    if (oui) supprimees.add(id);
    else supprimees.delete(id);
    bouton.setAttribute('aria-pressed', String(oui));
    bouton.textContent = oui ? 'Sera supprimée — annuler' : 'Supprimer';
    tr.classList.toggle('ed-supprime', oui);
  });
  cellule.append(bouton);
}

/** Champs du formulaire « Nouvelle arme » ; un champ « choix » prend sa liste du service (ed.listes) ; une arme n'est pas d'office arme de départ. */
const champsDeCreation = (ed) =>
  Object.entries(ENTITES.arme.champs).map(([c, champ]) => ({
    nom: c, libelle: champ.libelle, type: champ.type, requis: champ.requis, valeur: c === 'depart_possible' ? '0' : '',
    ...(champ.type === 'choix' ? { choix: champ.choix ?? ed.listes?.[champ.liste] ?? [] } : {}),
  }));

export const armes = {
  nom: 'armes',
  actif: (doc) => Boolean(doc.querySelector('[data-armes]')),

  surcouche(ed, lignes) {
    for (const l of lignes) {
      if (l.table !== 'arme') continue;
      if (l.ligne) ajouter(ed, l.ligne);
      else retirer(l.cle.id);
    }
  },

  ligne(_ed, table, cle, ligne) {
    if (table === 'arme') {
      if (!ligne) retirer(cle.id);
      const tr = ligne && ligneDe(cle.id);
      if (tr) {
        const depart = Number(ligne.depart_possible) === 1;
        tr.classList.toggle('arme--depart', depart);
        // `title` vide pour retirer une infobulle (components/Infobulles.astro a déplacé l'attribut : un removeAttribute ne l'efface pas)
        tr.title = depart ? 'Arme de départ' : '';
        const nom = tr.querySelector('.arme__choisir');
        if (nom) nom.title = ligne.description || '';
      }
    }
    if (['arme', 'ressource', 'materiau_arme', 'amelioration_equipement'].includes(table)) rafraichir();
  },

  debut(ed) {
    for (const d of document.querySelectorAll('[data-armes] details')) {
      // le panneau de règles : son extension l'ouvre et le referme (edition/panneaux.mjs)
      if (!d.classList.contains('preg')) d.open = true;
    }
    const outils = document.createElement('div');
    outils.className = 'ed-outils ed-outils-armes';
    const ajouterBouton = document.createElement('button');
    ajouterBouton.type = 'button';
    ajouterBouton.className = 'ed-outil';
    ajouterBouton.textContent = '+ Ajouter une arme';
    ajouterBouton.addEventListener('click', () =>
      ed.formulaire({
        titre: 'Nouvelle arme',
        aide: 'L’arme est créée tout de suite dans la base du site de dev, à la fin du tableau de sa famille ; ses colonnes (dégâts, portée, solidité, origine…) sont tirées de son effet, comme celles des autres armes.',
        champs: champsDeCreation(ed),
        valider: async (valeurs) => {
          const r = await ed.appel('POST', 'edition/', { page: ed.page, operations: [{ op: 'creer', entite: 'arme', valeurs }] });
          const arme = r.lignes.find((l) => l.table === 'arme' && l.ligne)?.ligne;
          if (!arme) return;
          const tr = ajouter(ed, arme);
          if (!tr) return;
          ed.lignes?.set(cleDeLigne('arme', { id: arme.id }), arme);
          if (ed.enEdition) {
            ed.monterChamps(tr);
            boutonSupprimer(tr);
          }
          tr.scrollIntoView({ block: 'center' });
          ed.annoncer(`Arme créée : ${arme.nom}.`);
        },
      }),
    );
    outils.append(ajouterBouton);
    document.querySelector('[data-armes] .armes-vue')?.before(outils);
    for (const tr of document.querySelectorAll('[data-armes] tr.arme')) boutonSupprimer(tr);
    rafraichir();
  },

  operations(_ed, operations) {
    if (!supprimees.size) return operations;
    const garde = operations.filter((op) => !(op.table === 'arme' && supprimees.has(op.cle?.id)));
    return [...garde, ...[...supprimees].map((id) => ({ op: 'supprimer', entite: 'arme', cle: { id } }))];
  },

  apresEnregistrement: () => rafraichir(),

  fin() {
    document.querySelector('.ed-outils-armes')?.remove();
    for (const b of document.querySelectorAll('[data-armes] .ed-supprimer')) b.remove();
    for (const t of document.querySelectorAll('[data-armes] tr.ed-supprime')) t.classList.remove('ed-supprime');
    supprimees.clear();
    rafraichir();
  },
};
