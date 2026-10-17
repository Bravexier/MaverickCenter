// Onglets de la page « Composants » (migration 0057 ; demande du propriétaire du 2026-10-17 : « à l'image de la page d'équipement avoir des onglets pour
// chaque table. Il faudrait aussi qu'elles soient modifiables et directement liées en base ») : la table composant_onglet a un onglet par tableau de la
// page, ni plus ni moins (lib/composants-db.mjs#ongletsDeLaPage arrête le build sinon), dans l'ordre de la barre ; titre et note se modifient (TABLES).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chargerComposants, idDuTableauDIngredients, idDuTableauDObjets, ongletsDeLaPage, TABLEAUX_DES_COMPOSANTS } from '../src/lib/composants-db.mjs';
import { CATEGORIES_D_INGREDIENTS, SECTIONS_DE_L_INVENTAIRE } from '../src/lib/corps-composants.mjs';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { ENTITES, TABLES } from '../src/lib/edition-modele.mjs';

const db = ouvrirBase();
const onglets = db.prepare('SELECT * FROM composant_onglet').all().map((o) => ({ ...o }));

test('un tableau par catégorie d’ingrédients et par section de l’onglet « Équipement inventaire », des ids d’ancre uniques', () => {
  assert.equal(TABLEAUX_DES_COMPOSANTS.length, 5 + CATEGORIES_D_INGREDIENTS.length + SECTIONS_DE_L_INVENTAIRE.length);
  assert.equal(new Set(TABLEAUX_DES_COMPOSANTS).size, TABLEAUX_DES_COMPOSANTS.length);
  assert.equal(idDuTableauDIngredients('solvant'), 'ingredients-solvant');
  assert.equal(idDuTableauDObjets('VÉGÉTAUX'), 'objets-vegetaux');
  assert.equal(idDuTableauDObjets('MATOS AVENTURES'), 'objets-matos-aventures');
  for (const id of TABLEAUX_DES_COMPOSANTS) assert.match(id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, id);
});

test('la base a un onglet par tableau de la page, chacun titré, dans l’ordre de la barre', () => {
  const page = chargerComposants(db).onglets;
  assert.deepEqual(page.map((o) => o.id).sort(), [...TABLEAUX_DES_COMPOSANTS].sort());
  assert.ok(page.every((o) => o.titre.trim().length > 0));
  for (let i = 1; i < page.length; i += 1) assert.ok(page[i - 1].ordre <= page[i].ordre, 'trié par ordre');
});

test('un tableau sans onglet, ou un onglet sans tableau, arrête le build', () => {
  assert.throws(() => ongletsDeLaPage(onglets.filter((o) => o.id !== 'gemmes')), /tableaux sans onglet \(gemmes\)/);
  assert.throws(() => ongletsDeLaPage([...onglets, { id: 'objets-armes', titre: 'Armes', note: null, ordre: 99 }]), /onglets sans tableau \(objets-armes\)/);
});

test('l’ordre de la barre : `ordre`, puis l’id à égalité', () => {
  const melanges = onglets.map((o) => ({ ...o, ordre: o.id === 'fruits' || o.id === 'bois' ? 1 : o.ordre + 1 }));
  const ids = ongletsDeLaPage(melanges.reverse()).map((o) => o.id);
  assert.deepEqual(ids.slice(0, 2), ['bois', 'fruits']);
  assert.equal(ids[2], 'monnaie');
});

test('le titre et la note se modifient depuis le site de dev ; un onglet ne se crée ni ne se supprime', () => {
  assert.deepEqual(Object.keys(TABLES.composant_onglet.colonnes), ['titre', 'note']);
  assert.ok(TABLES.composant_onglet.colonnes.titre.requis);
  assert.ok(!TABLES.composant_onglet.colonnes.note.requis);
  assert.ok(!Object.values(ENTITES).some((e) => e.table === 'composant_onglet'));
});
