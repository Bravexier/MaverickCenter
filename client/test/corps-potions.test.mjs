// Corps des pages de potions (lib/corps-potions.mjs : le tableau de chaque palier, suivi quand les consommables de l'onglet Ceinture se modifient sur le
// site de dev, et au rejeu du journal) : chaque potion de la base se retrouve dans le corps de sa page, ses quatre valeurs comprises (nom, prix, niveau,
// effet) ; puis les réécritures, case par case.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import {
  celluleDePotion, corpsDeLaPotionApres, ErreurCorpsPotions, pageDeLaPotion, tableauDuPalier, TABLES_DES_POTIONS,
} from '../src/lib/corps-potions.mjs';

const db = ouvrirBase({ sansExemples: false });
const contexte = {
  ressource: (id) => db.prepare('SELECT * FROM ressource WHERE id = ?').get(id) ?? null,
  niveau: (id) => db.prepare('SELECT * FROM niveau_alchimie WHERE id = ?').get(id) ?? null,
};
const cases = (l) => l.split(/(?<!\\)\|/).slice(1, -1).map((c) => c.trim());

test('chaque potion de la base a son tableau dans la page qui l’écrit : son nom, puis « Prix | Niveau | Effet » et ses valeurs', () => {
  const potions = db.prepare(`SELECT r.id, r.nom, r.prix_brut, r.page_id, p.effet, n.nom AS niveau FROM potion p JOIN ressource r ON r.id = p.ressource_id
    JOIN niveau_alchimie n ON n.id = p.niveau_id`).all();
  assert.ok(potions.length > 150);
  for (const p of potions) {
    assert.equal(pageDeLaPotion('ressource', contexte.ressource(p.id), contexte), p.page_id);
    assert.equal(pageDeLaPotion('potion', { ressource_id: p.id }, contexte), p.page_id);
    const lignes = db.prepare('SELECT corps_md FROM page WHERE id = ?').get(p.page_id).corps_md.split('\n');
    const t = tableauDuPalier(lignes, p.nom);
    assert.ok(t, `${p.id} : son tableau`);
    assert.equal(cases(lignes[t.entete])[0], celluleDePotion(p.nom), `${p.id} : le nom`);
    assert.deepEqual(cases(lignes[t.valeurs]), [p.prix_brut, p.niveau, p.effet].map(celluleDePotion), `${p.id} : prix, niveau, effet`);
  }
});

const CORPS = [
  'Intro.',
  '',
  '| Recette |  |  |',
  '| :-: | :-: | :-: |',
  '| Solvant | Essence | Amplificateur |',
  '| Fiole | Santé | Herbe |',
  '',
  '| Petite fiole d’essai |  |  |',
  '| :-: | :-: | :-: |',
  '| Prix | Niveau | Effet |',
  '| 2 Ro | Novice | Redonne 5 santé |',
  '',
  '| Grande fiole d’essai |  |  |',
  '| :-: | :-: | :-: |',
  '| Prix | Niveau | Effet |',
  '| 9 Ro | Apprenti | - Redonne 9 santé<br>- 1 croix |',
  '',
].join('\n');
const petite = { id: 'ressources/essai#potion:petite', genre: 'potion', nom: 'Petite fiole d’essai', prix_brut: '2 Ro', page_id: 'ressources/essai' };
const ctxEssai = {
  ressource: (id) => (id === petite.id ? petite : null),
  niveau: (id) => ({ novice: { nom: 'Novice' }, expert: { nom: 'Expert' } })[id] ?? null,
};

test('réécriture : le nom dans l’en-tête du tableau, le prix, le niveau (son nom), l’effet (lignes jointes par <br>, « | » échappé) ; rien d’autre ne bouge', () => {
  const renomme = corpsDeLaPotionApres(CORPS, 'ressource', petite, { ...petite, nom: 'Fiole d’essai renommée', prix_brut: '3 Ro' }, ctxEssai);
  assert.equal(renomme, CORPS.replace('| Petite fiole d’essai |  |  |', '| Fiole d’essai renommée |  |  |').replace('| 2 Ro | Novice |', '| 3 Ro | Novice |'));
  const potion = { ressource_id: petite.id, niveau_id: 'novice', effet: 'Redonne 5 santé' };
  const effet = corpsDeLaPotionApres(CORPS, 'potion', potion, { ...potion, niveau_id: 'expert', effet: 'Redonne 6 santé\nEt | un tube' }, ctxEssai);
  assert.equal(effet, CORPS.replace('| 2 Ro | Novice | Redonne 5 santé |', '| 2 Ro | Expert | Redonne 6 santé<br>Et \\| un tube |'));
  assert.equal(corpsDeLaPotionApres(CORPS, 'potion', potion, { ...potion }, ctxEssai), CORPS, 'rien de changé');
  assert.equal(corpsDeLaPotionApres(CORPS, 'ressource', { ...petite, genre: 'materiel' }, { ...petite, genre: 'materiel', nom: 'X' }, ctxEssai), CORPS, 'pas une potion');
  assert.equal(corpsDeLaPotionApres(CORPS, 'ressource', petite, { ...petite, description: 'x' }, ctxEssai), CORPS, 'la description n’est pas écrite par la page');
  assert.deepEqual(TABLES_DES_POTIONS, ['ressource', 'potion'], 'le nom d’abord : il désigne le tableau');
});

test('un tableau introuvable, en double ou d’une autre forme, un niveau inconnu : ErreurCorpsPotions (le service refuse le lot)', () => {
  const absente = { ...petite, nom: 'Fiole absente' };
  assert.throws(() => corpsDeLaPotionApres(CORPS, 'ressource', absente, { ...absente, prix_brut: '1 Ro' }, ctxEssai), ErreurCorpsPotions);
  const double = `${CORPS}\n| Petite fiole d’essai |  |  |\n| :-: | :-: | :-: |\n| Prix | Niveau | Effet |\n| 1 Ro | Novice | x |\n`;
  assert.throws(() => corpsDeLaPotionApres(double, 'ressource', petite, { ...petite, prix_brut: '1 Ro' }, ctxEssai), /plusieurs tableaux/);
  const forme = CORPS.replace('| Prix | Niveau | Effet |\n| 2 Ro', '| Coût | Niveau | Effet |\n| 2 Ro');
  assert.throws(() => corpsDeLaPotionApres(forme, 'ressource', petite, { ...petite, prix_brut: '1 Ro' }, ctxEssai), /Prix \| Niveau \| Effet/);
  const potion = { ressource_id: petite.id, niveau_id: 'novice', effet: 'x' };
  assert.throws(() => corpsDeLaPotionApres(CORPS, 'potion', potion, { ...potion, niveau_id: 'inconnu' }, ctxEssai), /niveau/);
});
