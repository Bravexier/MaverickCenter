// Le bouton « + Ajouter … » des tableaux de /ressources/composants/ en mode modification (src/scripts/edition/composants.mjs, qui lit
// lib/edition-modele.mjs#champsDeCreationDe et #sansChoixPossible, testées ici sans le script de page) : il n'est pas proposé
// quand un choix obligatoire de son formulaire n'a aucune option — Gemmes et Bois depuis la décision R160 (le Potentiel Illimité n'a ni gemme ni bois,
// chaque autre magie a déjà le sien : les listes `magiesSansGemme`, `magiesSansBois` de GET /api/edition/listes/ sont vides). « Ne rien afficher » :
// ni bouton grisé ni texte nouveau ; les libellés des champs restent tels quels. Puis l'onglet Monnaie, figé (décision R219 (3) : « Ni création, ni
// modification, ni suppression dans l'onglet Monnaie ») : l'extension, dans un faux navigateur, ne lui offre aucun contrôle.
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { listes as listesDuService } from '../serveur/edition.mjs';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { champsDeCreationDe, ENTITES, sansChoixPossible, TABLES_FIGEES } from '../src/lib/edition-modele.mjs';
import { htmlDeLigneDeMateriau, htmlDeLigneDeMonnaie } from '../src/lib/composants-rendu.mjs';
import { el, fauxDocument } from './aide-faux-dom.mjs';

const FEU = { valeur: 'magies/magie-du-feu', libelle: 'Feu' };
const sansBouton = (entite, listes, ajout = {}) => sansChoixPossible(champsDeCreationDe(entite, ajout.valeurs ?? {}, ajout.montrer, listes));

test('décision R160 : Gemmes et Bois sans magie libre, pas de bouton ; une magie libre, le bouton revient', () => {
  assert.equal(sansBouton('gemme', { magiesSansGemme: [] }), true);
  assert.equal(sansBouton('bois', { magiesSansBois: [] }), true);
  assert.equal(sansBouton('gemme', { magiesSansGemme: [FEU] }), false);
  assert.equal(sansBouton('bois', { magiesSansBois: [FEU] }), false);
  // les libellés restent tels quels
  assert.equal(ENTITES.gemme.champs.magie_id.libelle, 'Magie (une gemme par magie)');
  assert.equal(ENTITES.bois.champs.magie_id.libelle, 'Magie (un bois par magie)');
});

test('les autres tableaux gardent leur bouton : pas de choix obligatoire vide (une liste fixe, une valeur donnée d’office)', () => {
  // la monnaie n'en a pas de choix vide non plus, mais son onglet est figé (R219 (3), test plus bas)
  for (const entite of ['monnaie', 'materiau', 'composant']) assert.equal(sansBouton(entite, {}, { valeurs: entite === 'composant' ? { tableau: 'produit:Essai' } : {} }), false, entite);
  // un ingrédient : sa catégorie, une liste fixe ; un fruit : la catégorie donnée d'office et montrée
  assert.equal(sansBouton('ingredient', {}, { valeurs: { categorie: 'catalyseur' } }), false);
  assert.equal(sansBouton('ingredient', {}, { valeurs: { categorie: 'catalyseur', type_brut: 'Fruit' }, montrer: ['categorie', 'type_brut'] }), false);
  // un choix facultatif vide ne cache rien
  assert.equal(sansChoixPossible([{ nom: 'x', type: 'choix', requis: false, choix: [] }]), false);
});

test('les champs du formulaire : les valeurs données d’office retirées (sauf `montrer`, pré-remplies), les options d’une liste du service', () => {
  const champs = champsDeCreationDe('ingredient', { categorie: 'catalyseur', type_brut: 'Fruit' }, ['type_brut']);
  assert.deepEqual(champs.map((c) => c.nom), Object.keys(ENTITES.ingredient.champs).filter((c) => c !== 'categorie'));
  assert.equal(champs.find((c) => c.nom === 'type_brut').valeur, 'Fruit');
  const [magie] = champsDeCreationDe('gemme', {}, [], { magiesSansGemme: [FEU] });
  assert.deepEqual({ nom: magie.nom, requis: magie.requis, choix: magie.choix }, { nom: 'magie_id', requis: true, choix: [FEU] });
  assert.deepEqual(champsDeCreationDe('gemme')[0].choix, [], 'sans listes : aucune option');
});

test('décision R160 sur la base : Gemmes et Bois n’ont un bouton que s’il reste une magie libre (listes du service, jamais le Potentiel Illimité)', () => {
  const db = ouvrirBase({ sansExemples: false });
  after(() => db.close());
  const listes = listesDuService(db);
  for (const [entite, liste] of [['gemme', 'magiesSansGemme'], ['bois', 'magiesSansBois']]) {
    assert.ok(!listes[liste].some((m) => m.valeur === 'magies/potentiel-illimite'), liste);
    assert.equal(sansBouton(entite, listes), listes[liste].length === 0, entite);
  }
});

// --- Décision R219 (3) : l'onglet Monnaie figé ----------------------------------------------------------------------------------------------------
// Des monnaies et un matériau d'essai (structure seule : aucune valeur de la base n'est lue), rendus par lib/composants-rendu.mjs comme la page construite.
const MONNAIES = [{ id: 'essai-a', nom: 'Essai A', abreviation: 'EA', valeur_rf: 1 }, { id: 'essai-b', nom: 'Essai B', abreviation: 'EB', valeur_rf: 10 }];
const MATERIAU = { id: 'ressources/composants#materiau:essai', nom: 'Essai', type: 'Léger', prix_brut: null, description: null, arme: null, usages: [], citations: [] };

test('décision R219 (3) : la ligne d’une monnaie n’a aucune case modifiable (son symbole suit la base en lecture seule)', () => {
  assert.ok(Object.hasOwn(TABLES_FIGEES, 'monnaie'), 'la table des monnaies est figée (le service refuse en 409)');
  for (const m of MONNAIES) {
    const ligne = el('tbody');
    ligne.innerHTML = htmlDeLigneDeMonnaie(m, MONNAIES);
    const tr = ligne.children[0];
    assert.equal(tr.querySelector('[data-ed]'), null, `${m.id} : aucun data-ed`);
    assert.ok(tr.querySelector('.comp-abr[data-ed-lecture]'), `${m.id} : le symbole suit la base`);
    assert.equal(tr.dataset.entite, 'monnaie', 'la ligne garde son entité (surcouche d’un lot ancien rejoué, R220 (1))');
  }
});

test('décision R219 (3) : en mode modification, l’onglet Monnaie n’offre ni « + Ajouter », ni « Supprimer » ; les autres tableaux gardent les leurs', async () => {
  const panneau = (id, ajout, lignes) => {
    const section = el('section', { class: 'composants-panneau', id });
    section.innerHTML = `<table data-ajout="${JSON.stringify(ajout).replace(/"/g, '&quot;')}"><tbody>${lignes.join('')}</tbody></table>`;
    return section;
  };
  const document = fauxDocument(el('div', { 'data-composants': '' },
    panneau('monnaie', { entite: 'monnaie', libelle: 'une monnaie' }, MONNAIES.map((m) => htmlDeLigneDeMonnaie(m, MONNAIES))),
    panneau('materiaux', { entite: 'materiau', libelle: 'un matériau' }, [htmlDeLigneDeMateriau(MATERIAU)])));
  const avant = { document: globalThis.document, CSS: globalThis.CSS };
  Object.assign(globalThis, { document, CSS: { escape: (x) => x } });
  try {
    const { composants } = await import('../src/scripts/edition/composants.mjs');
    const ed = { page: 'ressources/composants/', listes: {}, enEdition: true, formulaire() {}, annoncer() {} };
    composants.debut(ed);
    const monnaie = document.querySelector('#monnaie');
    assert.equal(monnaie.querySelector('button'), null, 'l’onglet Monnaie : aucun bouton');
    assert.equal(monnaie.querySelector('[data-ed]'), null, 'ni aucun champ');
    const materiaux = document.querySelector('#materiaux');
    assert.ok(materiaux.querySelector('.comp-ajouter'), 'un autre tableau garde « + Ajouter »');
    assert.ok(materiaux.querySelector('.ed-supprimer'), 'et « Supprimer » sur une ligne que rien ne cite');
    assert.deepEqual(composants.operations(ed, []), [], 'rien en file');
    composants.fin(ed);
    assert.equal(document.querySelector('[data-composants] button'), null, 'en sortant, plus aucun bouton');
  } finally {
    Object.assign(globalThis, avant);
  }
});
