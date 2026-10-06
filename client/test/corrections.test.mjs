// Couche de corrections orthographiques : tools/sheets/corriger-dump.py.
// Les classeurs Google contiennent des coquilles (« Chasseur prime » pour « Chasseur de primes »). Le propriétaire du projet demande de les
// corriger, sans jamais toucher à une règle : chaque correction est une ligne du registre `tools/sheets/corrections.json`, adressée à une
// cellule, et l'outil refuse tout ce qui changerait un chiffre, un signe ou plus qu'un mot.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('../../tools/sheets/corriger-dump.py', import.meta.url));
const registreReel = fileURLToPath(new URL('../../tools/sheets/corrections.json', import.meta.url));

const dumpDe = () => ({
  sheets: [
    {
      name: 'Mercenaire',
      cells: [
        { r: 17, c: 27, v: 'CHASSEUR DE PRIMES' },
        { r: 22, c: 29, v: 'Chasseur prime' },
        { r: 23, c: 4, v: '+3% pour les compétences d’arme, +5 points de maîtrise. Ca marche aussi à distance.' },
        { r: 30, c: 5, v: '', note: 'Jet de vigeur pour esquiver' },
        { r: 31, c: 5, v: 'Inflige 2d6 dégâts', f: '=A1' },
      ],
    },
    { name: 'Autre', cells: [{ r: 1, c: 1, v: 'Chasseur prime' }] },
  ],
});
const correction = (extra = {}) => ({ onglet: 'Mercenaire', cellule: 'AC22', avant: 'Chasseur prime', apres: 'Chasseur de primes', nature: 'grammaire', note: 'La bannière dit « CHASSEUR DE PRIMES ».', ...extra });

function lancer(corrections, dump = dumpDe(), { id = 'classes-v7', extra = [] } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'corr-'));
  mkdirSync(dir, { recursive: true });
  const ledger = join(dir, 'corrections.json');
  const entree = join(dir, 'classes-v7.json');
  const sortie = join(dir, 'sortie.json');
  writeFileSync(ledger, JSON.stringify({ version: 1, dumps: { 'classes-v7': { classeur: 'Classe Maverick V7', corrections } } }));
  writeFileSync(entree, JSON.stringify(dump));
  const r = spawnSync('python3', ['-I', script, 'appliquer', '--ledger', ledger, '--id', id, '--dump', entree, '--out', sortie, ...extra], { encoding: 'utf8' });
  return { ...r, sortie: r.status === 0 ? JSON.parse(readFileSync(sortie, 'utf8')) : null };
}
const cellule = (dump, onglet, r, c) => dump.sheets.find((s) => s.name === onglet).cells.find((x) => x.r === r && x.c === c);

test('une correction remplace le texte de sa cellule, et seulement celui-là', () => {
  const r = lancer([correction()]);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(cellule(r.sortie, 'Mercenaire', 22, 29).v, 'Chasseur de primes');
  const attendu = dumpDe();
  cellule(attendu, 'Mercenaire', 22, 29).v = 'Chasseur de primes';
  assert.deepEqual(r.sortie, attendu, 'les autres cellules (même texte dans un autre onglet, formules, notes) sont intactes');
  assert.match(r.stderr, /1 correction/);
});

test('sans correction pour ce dump, il est recopié tel quel', () => {
  const r = lancer([correction()], dumpDe(), { id: 'autre-dump' });
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(r.sortie, dumpDe());
});

test('une correction peut viser la note d’une cellule (champ « note »)', () => {
  const r = lancer([correction({ cellule: 'E30', champ: 'note', avant: 'Jet de vigeur', apres: 'Jet de vigueur', nature: 'orthographe' })]);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(cellule(r.sortie, 'Mercenaire', 30, 5).note, 'Jet de vigueur pour esquiver');
});

test('les accents et les mots de liaison se corrigent avec leur voisin (« Ca marche » → « Ça marche »)', () => {
  const r = lancer([correction({ cellule: 'D23', avant: 'Ca marche aussi', apres: 'Ça marche aussi', nature: 'accent' })]);
  assert.equal(r.status, 0, r.stderr);
  assert.match(cellule(r.sortie, 'Mercenaire', 23, 4).v, /Ça marche aussi à distance\.$/);
});

test('refus : l’onglet ou la cellule n’existe pas', () => {
  assert.notEqual(lancer([correction({ onglet: 'Inconnu' })]).status, 0);
  const r = lancer([correction({ cellule: 'ZZ99' })]);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /ZZ99/);
});

test('refus : le texte « avant » n’est plus dans la cellule (source modifiée) — la correction est périmée', () => {
  const r = lancer([correction({ avant: 'Chasseur primes' })]);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /périmée/);
});

test('refus : la source est déjà corrigée — la correction est redondante, on la retire', () => {
  const dump = dumpDe();
  cellule(dump, 'Mercenaire', 22, 29).v = 'Chasseur de primes';
  const r = lancer([correction()], dump);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /redondante/);
});

test('refus : le texte « avant » apparaît plusieurs fois sans que le registre le dise (occurrences)', () => {
  const dump = dumpDe();
  cellule(dump, 'Mercenaire', 22, 29).v = 'Chasseur prime et Chasseur prime';
  const r = lancer([correction()], dump);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /2 fois/);
  const ok = lancer([correction({ occurrences: 2 })], dump);
  assert.equal(ok.status, 0, ok.stderr);
  assert.equal(cellule(ok.sortie, 'Mercenaire', 22, 29).v, 'Chasseur de primes et Chasseur de primes');
});

test('garde-fou : une correction ne change jamais un chiffre, un signe ou un pourcentage (ce serait une règle)', () => {
  for (const [avant, apres] of [['+3% pour', '+5% pour'], ['+5 points de maîtrise', '+6 points de maîtrise'], ['+3% pour', '-3% pour'], ['pour les compétences', 'pour les 2 compétences']]) {
    const r = lancer([correction({ cellule: 'D23', avant, apres, nature: 'orthographe' })]);
    assert.notEqual(r.status, 0, `${avant} → ${apres}`);
    assert.match(r.stderr, /chiffre|signe/, `${avant} → ${apres}`);
  }
  const dumpDes = lancer([correction({ cellule: 'E31', avant: 'Inflige 2d6 dégâts', apres: 'Inflige 2d8 dégâts', nature: 'orthographe' })]);
  assert.notEqual(dumpDes.status, 0, 'un dé ne change pas');
  assert.equal(lancer([correction({ cellule: 'D23', avant: '+3% pour les', apres: '+3 % pour les', nature: 'espace' })]).status, 0, 'une espace ajoutée avant % ne change pas le nombre');
});

test('garde-fou : une correction n’est pas une reformulation (similarité d’au moins 70 % hors accents et casse)', () => {
  const r = lancer([correction({ avant: 'Chasseur prime', apres: 'Traqueur de récompenses', nature: 'orthographe' })]);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /reformulation|similarité/);
});

test('garde-fou : la nature de la correction est dans la liste fermée', () => {
  const r = lancer([correction({ nature: 'reformulation' })]);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /nature/);
  assert.notEqual(lancer([correction({ note: '' })]).status, 0, 'chaque correction dit pourquoi');
});

test('garde-fou : la même cellule ne reçoit pas deux fois la même correction (registre sans doublon)', () => {
  const r = lancer([correction(), correction()]);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /doublon/);
});

test('le registre du dépôt est bien formé : champs, nature, chiffres et signes inchangés, cellules en A1, sans doublon', () => {
  const r = spawnSync('python3', ['-I', script, 'verifier-registre', '--ledger', registreReel], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
});
