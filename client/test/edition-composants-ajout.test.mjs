// Le bouton « + Ajouter … » des tableaux de /ressources/composants/ en mode modification (src/scripts/edition/composants.mjs, qui lit
// lib/edition-modele.mjs#champsDeCreationDe et #sansChoixPossible, testées ici sans le script de page) : il n'est pas proposé
// quand un choix obligatoire de son formulaire n'a aucune option — Gemmes et Bois depuis la décision R160 (le Potentiel Illimité n'a ni gemme ni bois,
// chaque autre magie a déjà le sien : les listes `magiesSansGemme`, `magiesSansBois` de GET /api/edition/listes/ sont vides). « Ne rien afficher » :
// ni bouton grisé ni texte nouveau ; les libellés des champs restent tels quels.
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { listes as listesDuService } from '../serveur/edition.mjs';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { champsDeCreationDe, ENTITES, sansChoixPossible } from '../src/lib/edition-modele.mjs';

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
