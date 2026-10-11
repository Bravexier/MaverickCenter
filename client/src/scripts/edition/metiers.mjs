// Extension de l'éditeur pour /metiers/ (components/metier/MetiersTableau.astro) — demande du propriétaire : ajouter, modifier, supprimer un métier.
//   - ajouter : formulaire « Nouveau métier », enregistré tout de suite (POST /api/edition/, opération creer) ; sa ligne apparaît dans le tableau ;
//   - supprimer : bouton sur chaque ligne en mode modification ; la suppression part avec le bouton de confirmation ;
//   - un métier créé ou supprimé depuis la construction du site apparaît ou disparaît au chargement (lignes en attente).
// Chaque ajout ou retrait redemande les filtres et le tri du tableau (évènement « metiers:rafraichir »).
import { attributEd, cleDeLigne, ENTITES } from '../../lib/edition-modele.mjs';
import { echapperHtml } from '../../lib/edition-rendu.mjs';

const table = () => document.querySelector('.metiers-table');
const ligneDe = (id) => document.querySelector(`tbody.metier[data-ed-metier="${CSS.escape(id)}"]`);
const rafraichir = () => document.dispatchEvent(new CustomEvent('metiers:rafraichir'));
const supprimes = new Set();

/** La ligne d'un métier, comme la construit MetiersTableau.astro (champs vides : remplis ensuite depuis la ligne de la base). */
function nouvelleLigne(id) {
  const ancre = `metier-${id.slice(id.indexOf('/') + 1)}`;
  const ed = (colonne) => echapperHtml(attributEd('metier', { id }, colonne));
  const tbody = document.createElement('tbody');
  tbody.className = 'metier';
  tbody.id = ancre;
  tbody.dataset.edMetier = id;
  tbody.innerHTML = `
    <tr class="metier__main">
      <th scope="row" class="metier__nom" data-ed="${ed('nom')}" data-ed-cible=".metier__choisir" data-colonne="nom"><button type="button" class="metier__choisir" aria-expanded="false" aria-controls="detail-${ancre}"></button></th>
      <td data-label="Bonus" class="metier__bonus" data-ed="${ed('bonus_brut')}" data-ed-rendu="metier-bonus" data-colonne="bonus"></td>
      <td data-label="Artisanat" class="metier__artisanat" data-ed="${ed('artisanat_texte')}" data-ed-rendu="metier-artisanat" data-colonne="artisanat"></td>
      <td data-label="Caractéristiques" class="metier__caracs" data-colonne="caracteristiques" title="Compétence d’artisanat : 10 × chacune des deux caractéristiques">
        <span class="metier__carac" data-ed="${ed('test_carac_1_id')}" data-ed-rendu="metier-carac"></span>
        <span class="metier__carac" data-ed="${ed('test_carac_2_id')}" data-ed-rendu="metier-carac"></span>
      </td>
      <td data-label="Équipement supplémentaire" class="metier__equipement" data-ed="${ed('equipement_brut')}" data-ed-rendu="metier-equipement" data-colonne="equipement"></td>
    </tr>
    <tr class="metier__detail" id="detail-${ancre}" hidden>
      <td colspan="5">
        <div class="metier-detail" role="region" aria-labelledby="detail-${ancre}-titre">
          <header class="metier-detail__tete">
            <h2 id="detail-${ancre}-titre" data-ed-lecture="${ed('nom')}"></h2>
            <button type="button" class="metier-detail__fermer" aria-label="Fermer la description">Fermer</button>
          </header>
          <p class="metier-detail__texte" data-ed="${ed('description')}"></p>
          <p class="metier-detail__texte" data-ed-cadre hidden><strong>Avantage possible :</strong> <span data-ed="${ed('avantage_brut')}" data-ed-rendu="metier-avantage"></span></p>
          <p class="metier-detail__texte metier-detail__remarque" data-ed-cadre hidden><span data-ed="${ed('remarque')}"></span></p>
        </div>
      </td>
    </tr>`;
  return tbody;
}

function ajouter(ed, ligne) {
  if (ligneDe(ligne.id)) return ligneDe(ligne.id);
  const tbody = nouvelleLigne(ligne.id);
  tbody.classList.add('ed-nouveau');
  table().append(tbody);
  for (const el of tbody.querySelectorAll('[data-ed], [data-ed-lecture]')) ed.rendre(el, ligne);
  for (const cadre of tbody.querySelectorAll('[data-ed-cadre]')) cadre.hidden = ![...cadre.querySelectorAll('[data-ed]')].some((c) => c.textContent.trim());
  return tbody;
}

function boutonSupprimer(tbody) {
  const cellule = tbody.querySelector('.metier__nom');
  if (!cellule || cellule.querySelector('.ed-supprimer')) return;
  const bouton = document.createElement('button');
  bouton.type = 'button';
  bouton.className = 'ed-outil ed-outil--danger ed-supprimer';
  bouton.textContent = 'Supprimer';
  bouton.setAttribute('aria-pressed', 'false');
  // R42 : les fiches qui l'ont le perdent, avec une note datée ; elles sont annoncées après l'enregistrement (editeur.mjs, annonceDesFiches)
  bouton.title = 'Supprimer ce métier (à l’enregistrement) ; une fiche de personnage qui l’a le perdra, avec une note datée';
  bouton.addEventListener('click', (e) => {
    e.stopPropagation();
    const id = tbody.dataset.edMetier;
    const oui = !supprimes.has(id);
    if (oui) supprimes.add(id);
    else supprimes.delete(id);
    bouton.setAttribute('aria-pressed', String(oui));
    bouton.textContent = oui ? 'Sera supprimé — annuler' : 'Supprimer';
    tbody.classList.toggle('ed-supprime', oui);
  });
  cellule.append(bouton);
}

/** Champs du formulaire « Nouveau métier » ; un champ « choix » (caractéristiques de l'artisanat) prend sa liste du service (ed.listes). */
const champsDeCreation = (ed) =>
  Object.entries(ENTITES.metier.champs).map(([c, champ]) => ({
    nom: c, libelle: champ.libelle, type: champ.type, requis: champ.requis, valeur: champ.vide === 'Rien' ? 'Rien' : '',
    ...(champ.type === 'choix' ? { choix: champ.choix ?? ed.listes?.[champ.liste] ?? [] } : {}),
  }));

export const metiers = {
  nom: 'metiers',
  actif: (doc) => Boolean(doc.querySelector('.metiers-table')),

  surcouche(ed, lignes) {
    for (const l of lignes) {
      if (l.table !== 'metier') continue;
      if (l.ligne) ajouter(ed, l.ligne);
      else ligneDe(l.cle.id)?.remove();
    }
    rafraichir();
  },

  pret() {
    // un lien vers un métier créé depuis la construction du site (#metier-…) : sa ligne vient d'être ajoutée, on l'ouvre
    if (location.hash.startsWith('#metier-') && document.getElementById(decodeURIComponent(location.hash.slice(1)))?.classList.contains('ed-nouveau')) {
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    }
  },

  ligne(_ed, table_, cle, ligne) {
    if (table_ !== 'metier') return;
    if (!ligne) ligneDe(cle.id)?.remove();
    rafraichir();
  },

  debut(ed) {
    const outils = document.createElement('div');
    outils.className = 'ed-outils ed-outils-metiers';
    const ajouterBouton = document.createElement('button');
    ajouterBouton.type = 'button';
    ajouterBouton.className = 'ed-outil';
    ajouterBouton.textContent = '+ Ajouter un métier';
    ajouterBouton.addEventListener('click', () =>
      ed.formulaire({
        titre: 'Nouveau métier',
        aide: 'Le métier est créé tout de suite dans la base du site de dev ; ses autres champs se modifient ensuite dans le tableau.',
        champs: champsDeCreation(ed),
        valider: async (valeurs) => {
          const r = await ed.appel('POST', 'edition/', { page: ed.page, operations: [{ op: 'creer', entite: 'metier', valeurs }] });
          const metier = r.lignes.find((l) => l.table === 'metier' && l.ligne)?.ligne;
          if (!metier) return;
          const tbody = ajouter(ed, metier);
          ed.lignes?.set(cleDeLigne('metier', { id: metier.id }), metier);
          if (ed.enEdition) {
            ed.monterChamps(tbody);
            boutonSupprimer(tbody);
          }
          rafraichir();
          tbody.scrollIntoView({ block: 'center' });
          ed.annoncer(`Métier créé : ${metier.nom}.`);
        },
      }),
    );
    outils.append(ajouterBouton);
    document.querySelector('.metiers-wrap')?.before(outils);
    for (const tbody of document.querySelectorAll('tbody.metier')) boutonSupprimer(tbody);
  },

  operations(_ed, operations) {
    if (!supprimes.size) return operations;
    const garde = operations.filter((op) => !(op.table === 'metier' && supprimes.has(op.cle?.id)));
    return [...garde, ...[...supprimes].map((id) => ({ op: 'supprimer', entite: 'metier', cle: { id } }))];
  },

  fin() {
    document.querySelector('.ed-outils-metiers')?.remove();
    for (const b of document.querySelectorAll('.ed-supprimer')) b.remove();
    for (const t of document.querySelectorAll('tbody.metier.ed-supprime')) t.classList.remove('ed-supprime');
    supprimes.clear();
  },
};
