// Les numéros à donner d'un lot de changements (client/src/lib/lot-de-changements.mjs : `{ "$numero": "a" }`, controlerLeLot, donnerLesNumeros ; lot 6 du
// chantier de la base de dev, R274, R275, garde-fou 11 : « un numéro n'est jamais redonné »). Module pur : la structure des tables est lue ici dans
// data/schema.sql (base neuve en mémoire) ; le service qui choisit le plus haut numéro connu est éprouvé par serveur-edition-lots.
//   node --test test/lot-de-changements-numeros.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { aDesNumeros, controlerLeLot, donnerLesNumeros, estUnJeton } from '../src/lib/lot-de-changements.mjs';

const db = new DatabaseSync(':memory:');
db.exec(readFileSync(new URL('../../data/schema.sql', import.meta.url), 'utf8'));
function structure(table) {
  const lignes = db.prepare(`PRAGMA table_info("${table}")`).all();
  if (!lignes.length) return null;
  return { colonnes: lignes.map((c) => c.name), types: Object.fromEntries(lignes.map((c) => [c.name, c.type.toUpperCase()])), cle: lignes.filter((c) => c.pk).sort((a, b) => a.pk - b.pk).map((c) => c.name) };
}
/** Les tables d'essai se choisissent par leur forme : une clé simple entière, une clé simple texte, une clé composée dont une colonne est entière. */
const CONTENU = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((t) => t.name);
const ENTIERE = CONTENU.find((t) => { const s = structure(t); return s.cle.length === 1 && /INT/.test(s.types[s.cle[0]]) && s.colonnes.length >= 3; });
const TEXTE = CONTENU.find((t) => { const s = structure(t); return s.cle.length === 1 && /TEXT/.test(s.types[s.cle[0]]) && s.colonnes.length >= 3; });
const COMPOSEE = CONTENU.find((t) => { const s = structure(t); return s.cle.length === 2 && s.cle.some((c) => /INT/.test(s.types[c])) && s.cle.some((c) => /TEXT/.test(s.types[c])); });
const [CLE] = structure(ENTIERE).cle;
const AUTRE = structure(ENTIERE).colonnes.find((c) => c !== CLE);
const controler = (lot) => controlerLeLot(lot, { structure, tablesEdition: new Set([ENTIERE, TEXTE, COMPOSEE]) });
const jeton = (nom) => ({ $numero: nom });
const entete = { titre: 'Essai', nature: 'code' };
const inserer = (table, cle, apres = cle) => ({ table, cle, operation: 'inserer', apres });
const rangs = (r) => r.erreurs.map((e) => e.rang);

test('une insertion dont la clé est un entier à donner porte un jeton, dans sa clé et dans sa ligne', () => {
  const lot = { ...entete, operations: [inserer(ENTIERE, { [CLE]: jeton('a') }, { [CLE]: jeton('a'), [AUTRE]: 'x' })] };
  assert.deepEqual(controler(lot), { valide: true, erreurs: [] });
  assert.ok(aDesNumeros(lot));
  assert.ok(estUnJeton(jeton('a')) && !estUnJeton({ $numero: 1 }) && !estUnJeton({ $numero: 'a', autre: 1 }) && !estUnJeton('a'));
  assert.equal(aDesNumeros({ operations: [inserer(ENTIERE, { [CLE]: 5 })] }), false);
});

test('la clé entière simple d’une insertion se donne à l’application : un numéro écrit à la main est refusé avec le rang, la clé texte et la clé composée restent libres', () => {
  const r = controler({ ...entete, operations: [inserer(TEXTE, { [structure(TEXTE).cle[0]]: 'x' }), inserer(ENTIERE, { [CLE]: 5 })] });
  assert.deepEqual(rangs(r), [2]);
  assert.match(r.erreurs[0].message, /\$numero/);
  assert.equal(controler({ ...entete, operations: [inserer(ENTIERE, { [CLE]: jeton('a') })] }).valide, true);
});

test('un jeton se donne une fois, avant de servir ; il ne sert jamais dans « avant », ni dans la clé d’une modification ou d’une suppression', () => {
  // donné deux fois
  assert.deepEqual(rangs(controler({ ...entete, operations: [inserer(ENTIERE, { [CLE]: jeton('a') }), inserer(ENTIERE, { [CLE]: jeton('a') })] })), [2]);
  // servi avant d'être donné
  const sert = { table: ENTIERE, cle: { [CLE]: 7 }, operation: 'modifier', avant: { [AUTRE]: null }, apres: { [AUTRE]: jeton('a') } };
  assert.deepEqual(rangs(controler({ ...entete, operations: [sert, inserer(ENTIERE, { [CLE]: jeton('a') })] })), [1]);
  // servi après : admis dans « apres »
  assert.equal(controler({ ...entete, operations: [inserer(ENTIERE, { [CLE]: jeton('a') }), sert] }).valide, true);
  // jamais dans « avant »
  const dansAvant = { ...sert, avant: { [AUTRE]: jeton('a') } };
  assert.ok(rangs(controler({ ...entete, operations: [inserer(ENTIERE, { [CLE]: jeton('a') }), dansAvant] })).includes(2));
  // jamais dans la clé d'une modification ou d'une suppression
  for (const o of [{ table: ENTIERE, cle: { [CLE]: jeton('a') }, operation: 'modifier', avant: { [AUTRE]: null }, apres: { [AUTRE]: 'y' } }, { table: ENTIERE, cle: { [CLE]: jeton('a') }, operation: 'supprimer', avant: {} }]) {
    assert.ok(rangs(controler({ ...entete, operations: [inserer(ENTIERE, { [CLE]: jeton('a') }), o] })).includes(2));
  }
});

test('un numéro ne se donne que pour la clé entière d’une table à clé simple, sous un nom lisible ; la ligne porte le même numéro que sa clé', () => {
  assert.deepEqual(rangs(controler({ ...entete, operations: [inserer(TEXTE, { [structure(TEXTE).cle[0]]: jeton('a') })] })), [1]);
  const [k1, k2] = structure(COMPOSEE).cle;
  const entier = /INT/.test(structure(COMPOSEE).types[k1]) ? k1 : k2;
  assert.deepEqual(rangs(controler({ ...entete, operations: [inserer(COMPOSEE, { [k1]: entier === k1 ? jeton('a') : 'x', [k2]: entier === k2 ? jeton('a') : 'x' })] })), [1]);
  assert.deepEqual(rangs(controler({ ...entete, operations: [inserer(ENTIERE, { [CLE]: jeton('un nom avec espaces') })] })), [1]);
  assert.deepEqual(rangs(controler({ ...entete, operations: [inserer(ENTIERE, { [CLE]: jeton('a') }, { [CLE]: jeton('b') })] })), [1]);
});

test('donnerLesNumeros : 1 + le plus haut connu, consécutifs par table et colonne dans l’ordre des opérations, le même jeton partout ; le lot reçu n’est pas touché', () => {
  const lot = { ...entete, operations: [
    inserer(ENTIERE, { [CLE]: jeton('a') }, { [CLE]: jeton('a'), [AUTRE]: 'x' }),
    inserer(ENTIERE, { [CLE]: jeton('b') }, { [CLE]: jeton('b'), [AUTRE]: 'y' }),
    { table: ENTIERE, cle: { [CLE]: 1 }, operation: 'modifier', avant: { [AUTRE]: null }, apres: { [AUTRE]: jeton('a') } },
  ] };
  assert.equal(controler(lot).valide, true, JSON.stringify(controler(lot).erreurs));
  const copie = JSON.stringify(lot);
  const demandes = [];
  const { lot: resolu, numeros } = donnerLesNumeros(lot, (table, colonne) => { demandes.push([table, colonne]); return 40; });
  assert.deepEqual(numeros, [{ jeton: 'a', table: ENTIERE, colonne: CLE, numero: 41 }, { jeton: 'b', table: ENTIERE, colonne: CLE, numero: 42 }]);
  assert.deepEqual(demandes, [[ENTIERE, CLE]], 'le plus haut numéro connu n’est demandé qu’une fois par table et colonne');
  assert.deepEqual(resolu.operations[0].cle, { [CLE]: 41 });
  assert.deepEqual(resolu.operations[0].apres, { [CLE]: 41, [AUTRE]: 'x' });
  assert.deepEqual(resolu.operations[1].cle, { [CLE]: 42 });
  assert.deepEqual(resolu.operations[2].apres, { [AUTRE]: 41 }, 'le même jeton, le même numéro, dans une autre opération');
  assert.equal(JSON.stringify(lot), copie);
  assert.equal(aDesNumeros(resolu), false);
});

test('une clé composée REPREND le numéro qu’une insertion précédente a donné (la ligne de liaison d’une ligne créée par le même lot) : jamais un second numéro, jamais avant d’être donné', () => {
  const [k1, k2] = structure(COMPOSEE).cle;
  const entier = /INT/.test(structure(COMPOSEE).types[k1]) ? k1 : k2;
  const autre = entier === k1 ? k2 : k1;
  const liaison = (n, valeur = 'x') => inserer(COMPOSEE, { [entier]: jeton(n), [autre]: valeur });
  const cree = inserer(ENTIERE, { [CLE]: jeton('a') }, { [CLE]: jeton('a'), [AUTRE]: 'x' });
  // donné d'abord, repris ensuite : valide
  assert.equal(controler({ ...entete, operations: [cree, liaison('a')] }).valide, true, JSON.stringify(controler({ ...entete, operations: [cree, liaison('a')] }).erreurs));
  // repris avant d'être donné, ou jamais donné : refusé, avec le rang
  assert.deepEqual(rangs(controler({ ...entete, operations: [liaison('a'), cree] })), [1]);
  assert.deepEqual(rangs(controler({ ...entete, operations: [cree, liaison('b')] })), [2]);
  // plusieurs lignes de liaison pour le même numéro
  assert.equal(controler({ ...entete, operations: [cree, liaison('a', 'x'), liaison('a', 'y')] }).valide, true);
  // donner deux fois le même numéro reste refusé (clé simple)
  assert.deepEqual(rangs(controler({ ...entete, operations: [cree, inserer(ENTIERE, { [CLE]: jeton('a') })] })), [2]);
  // donnerLesNumeros : un seul numéro, repris dans la clé et la ligne de la liaison
  const { lot, numeros } = donnerLesNumeros({ ...entete, operations: [cree, liaison('a', 'x'), liaison('a', 'y')] }, () => 40);
  assert.deepEqual(numeros, [{ jeton: 'a', table: ENTIERE, colonne: CLE, numero: 41 }]);
  assert.deepEqual(lot.operations[1].cle, { [entier]: 41, [autre]: 'x' });
  assert.deepEqual(lot.operations[2].apres, { [entier]: 41, [autre]: 'y' });
  assert.equal(aDesNumeros(lot), false);
  // quand l'appelant donne les clés étrangères, la colonne qui reprend le numéro cite la table qui l'a donné
  const avecEtrangeres = (cible) => (t) => ({ ...structure(t), ...(t === COMPOSEE ? { etrangeres: { [entier]: cible } } : {}) });
  const lotLiaison = { ...entete, operations: [cree, liaison('a')] };
  assert.equal(controlerLeLot(lotLiaison, { structure: avecEtrangeres(ENTIERE), tablesEdition: new Set([ENTIERE, TEXTE, COMPOSEE]) }).valide, true);
  const autreTable = controlerLeLot(lotLiaison, { structure: avecEtrangeres(TEXTE), tablesEdition: new Set([ENTIERE, TEXTE, COMPOSEE]) });
  assert.deepEqual(rangs(autreTable), [2]);
  assert.match(autreTable.erreurs[0].message, /ne cite pas cette table/);
});
