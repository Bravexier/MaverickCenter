// Corps des pages de potions (lib/corps-potions.mjs : le tableau de chaque palier, suivi quand les consommables de l'onglet Ceinture se modifient sur le
// site de dev, et au rejeu du journal) : chaque potion de la base se retrouve dans le corps de sa page, ses quatre valeurs comprises (nom, prix, niveau,
// effet) ; puis les réécritures, case par case.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import {
  celluleDePotion, corpsDeLaPotionApres, corpsDesPotionsEntier, ErreurCorpsPotions, pageDeLaPotion, tableauDuPalier, tableauxDesPaliers, TABLES_DES_POTIONS,
} from '../src/lib/corps-potions.mjs';
import { potionsParPage } from '../serveur/edition-consommables.mjs';

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

// Le corps ENTIER d'une page de potion (« Tout recalculer » : serveur/edition-lots.mjs#ecartsDuRecalcul) : la case de nom, le prix, le niveau et l'effet de
// chaque tableau de palier sont réécrits depuis sa potion ; une potion renommée dans sa table se retrouve à sa place, pas par son ancien nom.
test('le corps entier redonne le corps de chaque page de potion : chaque tableau est déjà ce que la table dit', () => {
  const pages = potionsParPage(db);
  // chaque potion de la base est dans une page (une potion ne se crée ni ne se supprime depuis le site)
  assert.equal([...pages.values()].reduce((n, p) => n + p.length, 0), db.prepare('SELECT count(*) AS n FROM potion').get().n);
  for (const [id, potions] of pages) {
    const corps = db.prepare('SELECT corps_md FROM page WHERE id = ?').get(id).corps_md;
    assert.equal(corpsDesPotionsEntier(corps, potions, contexte), corps, id);
  }
});

const potionsEssai = [
  { nom: 'Petite fiole d’essai', prix_brut: '2 Ro', niveau_id: 'novice', effet: 'Redonne 5 santé' },
  { nom: 'Grande fiole d’essai', prix_brut: '9 Ro', niveau_id: 'apprenti', effet: '- Redonne 9 santé\n- 1 croix' },
];
const ctxNiveaux = { niveau: (id) => ({ novice: { nom: 'Novice' }, apprenti: { nom: 'Apprenti' }, expert: { nom: 'Expert' } })[id] ?? null };

test('corps entier : une potion renommée dans sa table, ou dont le prix, le niveau, l’effet ont changé, est réécrite à sa place ; la prose et les autres tableaux ne bougent pas', () => {
  assert.equal(corpsDesPotionsEntier(CORPS, potionsEssai, ctxNiveaux), CORPS);
  assert.equal(tableauxDesPaliers(CORPS.split('\n')).length, 2, 'le tableau « Recette » n’est pas un palier');
  const changees = [
    { ...potionsEssai[0], nom: 'Fiole renommée du test', prix_brut: '3 Ro', niveau_id: 'expert', effet: 'Redonne 6 santé\nEt | un tube' },
    { ...potionsEssai[1], nom: 'Autre potion renommée' },
  ];
  const refait = corpsDesPotionsEntier(CORPS, changees, ctxNiveaux);
  assert.equal(refait, CORPS
    .replace('| Petite fiole d’essai |  |  |', '| Fiole renommée du test |  |  |').replace('| 2 Ro | Novice | Redonne 5 santé |', '| 3 Ro | Expert | Redonne 6 santé<br>Et \\| un tube |')
    .replace('| Grande fiole d’essai |  |  |', '| Autre potion renommée |  |  |'));
  // une potion reconnue par son nom garde son tableau, même quand les tableaux restants sont rangés autrement
  const inversees = corpsDesPotionsEntier(CORPS, [{ ...potionsEssai[1], prix_brut: '10 Ro' }, potionsEssai[0]], ctxNiveaux);
  assert.equal(inversees, CORPS.replace('| 9 Ro | Apprenti |', '| 10 Ro | Apprenti |'));
  // une renommée parmi deux potions inchangées : elle prend le seul tableau resté sans potion
  const une = corpsDesPotionsEntier(CORPS, [potionsEssai[0], { ...potionsEssai[1], nom: 'Renommée' }], ctxNiveaux);
  assert.equal(une, CORPS.replace('| Grande fiole d’essai |  |  |', '| Renommée |  |  |'));
});

test('corps entier : un nombre de tableaux qui n’est plus celui des potions, un niveau inconnu, un tableau de palier sans ligne de valeurs : ErreurCorpsPotions', () => {
  assert.throws(() => corpsDesPotionsEntier(CORPS, potionsEssai.slice(0, 1), ctxNiveaux), ErreurCorpsPotions);
  assert.throws(() => corpsDesPotionsEntier('Aucun tableau.', potionsEssai, ctxNiveaux), ErreurCorpsPotions);
  assert.throws(() => corpsDesPotionsEntier(CORPS, [{ ...potionsEssai[0], niveau_id: 'inconnu' }, potionsEssai[1]], ctxNiveaux), /niveau/);
  const sans = CORPS.replace('| 2 Ro | Novice | Redonne 5 santé |\n', '');
  assert.throws(() => corpsDesPotionsEntier(sans, potionsEssai, ctxNiveaux), ErreurCorpsPotions);
});
