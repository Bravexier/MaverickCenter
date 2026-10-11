// Les documents Google cités par le site sont les copies du Drive du propriétaire (migration data/migrations/0014-sources-copies-drive.sql, registre
// .json) : plus aucune trace d'un identifiant d'origine dans la base, le manifeste ou les extracteurs ; les renvois des pages et l'ordre des sources sont
// ceux d'avant, seul l'identifiant du fichier a changé (une copie garde le titre et les onglets de l'original).
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { ouvrirBase } from '../src/lib/donnees.mjs';

const racine = (chemin) => fileURLToPath(new URL(`../../${chemin}`, import.meta.url));
const lire = (chemin) => readFileSync(racine(chemin), 'utf8');
const registre = JSON.parse(lire('data/migrations/0014-sources-copies-drive.json'));
const manifeste = JSON.parse(lire('sources/sources.json'));
const db = ouvrirBase({ sansExemples: false });
const ID_GOOGLE = /^[A-Za-z0-9_-]{25,}$/;
const parTitre = new Map(registre.copies.map((c) => [c.titre, c]));

test('registre : chaque copie a son identifiant d’origine et le nouveau, tous distincts', () => {
  const ids = registre.copies.flatMap((c) => [c.avant, c.apres]);
  assert.equal(new Set(ids).size, ids.length);
  for (const c of registre.copies) {
    assert.match(c.avant, ID_GOOGLE, c.titre);
    assert.match(c.apres, ID_GOOGLE, c.titre);
    assert.ok(['doc', 'sheet'].includes(c.genre), c.titre);
  }
  assert.equal(registre.copies.length, 15);
  assert.equal(registre.non_copies.length, 2);
});

test('base : aucune colonne de texte ne cite plus un identifiant d’origine', () => {
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND sql NOT LIKE 'CREATE VIRTUAL%'").all();
  let colonnes = 0;
  for (const { name } of tables) {
    for (const { name: col } of db.prepare('SELECT name FROM pragma_table_info(?) WHERE type = ?').all(name, 'TEXT')) {
      colonnes += 1;
      for (const c of registre.copies) {
        const n = db.prepare(`SELECT count(*) AS n FROM "${name}" WHERE instr("${col}", ?) > 0`).get(c.avant).n;
        assert.equal(n, 0, `${name}.${col} cite encore ${c.titre} (${c.avant})`);
      }
    }
  }
  assert.ok(colonnes > 500, `${colonnes} colonnes lues`);
});

test('sources : une ligne par document cité, id dérivé du nouvel identifiant, 1 069 renvois des pages comme avant la migration', () => {
  const lignes = db.prepare("SELECT id, texte, url, genre, google_id FROM source WHERE google_id IS NOT NULL ORDER BY id").all();
  const cites = new Map(lignes.map((l) => [l.google_id, l]));
  const attendus = ['Classe Maverick V7', 'Les races', 'Magie Maverick V8', 'Invocation', 'Ressources et Craft', 'Mode hyper et co',
    'Règle du jeu/Guide pour MJ - Maverick', 'Créer sa fiche de personnage', 'MÉTIER', 'Alchimie', 'Fiche personnage Maverick Auto V15.2.2'];
  for (const titre of attendus) {
    const { apres, genre } = parTitre.get(titre);
    const l = cites.get(apres);
    assert.ok(l, `${titre} : source absente`);
    assert.equal(l.id, `google-${genre}:${apres}`);
    assert.equal(l.genre, genre);
    assert.equal(l.texte, l.url);
    assert.ok(l.url.includes(`/d/${apres}/`), l.url);
  }
  const renvois = db.prepare(`SELECT count(*) AS n FROM page_source WHERE source_id IN (${attendus.map(() => '?').join(', ')})`)
    .get(...attendus.map((t) => `google-${parTitre.get(t).genre}:${parTitre.get(t).apres}`)).n;
  assert.equal(renvois, 1069);
});

test('liens : les 9 ressources vers la copie du Doc « Alchimie » (le lien du Mage Bleu vers « Familiers » est retiré : migration 0019)', () => {
  assert.equal(db.prepare('SELECT count(*) AS n FROM ressource WHERE instr(description, ?) > 0').get(parTitre.get('Alchimie').apres).n, 9);
});

test('manifeste : chaque document copié pointe sur sa copie et garde l’URL d’origine ; les deux non copiés restent sur l’original, avec leur titre', () => {
  const avant = new Map(registre.copies.map((c) => [c.avant, c]));
  const apres = new Map(registre.copies.map((c) => [c.apres, c]));
  const nonCopies = new Set(registre.non_copies.map((c) => c.id));
  for (const g of manifeste.google) {
    if (nonCopies.has(g.id)) {
      assert.ok(g.url.includes(g.id) && g.note && g.title, g.id);
      continue;
    }
    const c = apres.get(g.id);
    assert.ok(c, `${g.id} n’est pas une copie du registre`);
    assert.equal(g.title, c.titre);
    assert.ok(g.url.includes(`/d/${c.apres}/`), g.url);
    assert.ok(g.original.includes(`/d/${c.avant}/`), g.original);
    assert.ok(!avant.has(g.id));
  }
  assert.equal(manifeste.google.length, 12);
});

test('extracteurs : les identifiants de classeur des outils d’import sont ceux des copies', () => {
  const dossier = racine('tools/sheets');
  for (const f of readdirSync(dossier).filter((x) => x.endsWith('.py'))) {
    const texte = readFileSync(`${dossier}/${f}`, 'utf8');
    for (const c of registre.copies) assert.ok(!texte.includes(c.avant), `tools/sheets/${f} cite encore ${c.titre}`);
  }
  for (const [fichier, titre] of [['classes.py', 'Classe Maverick V7'], ['magies.py', 'Magie Maverick V8'], ['invocations.py', 'Invocation'], ['equipement.py', 'Ressources et Craft']]) {
    assert.match(lire(`tools/sheets/${fichier}`), new RegExp(`^FILE_ID = "${parTitre.get(titre).apres}"$`, 'm'), fichier);
  }
});
