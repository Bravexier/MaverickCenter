// Rapprochement des classeurs et de la base, dans les deux sens (demande du propriétaire, 2026-10-15 ; tools/sources/rapprocher.mjs, docs/sources.md,
// « Rapprochement d'un classeur ») : pour chaque instantané de sources/raw/classeurs/registre.json, chaque ligne typée se lit dans les cellules qu'elle
// cite (orthographe des migrations défaite, valeurs d'import du site de dev), chaque cellule non vide est citée ou ignorée avec sa raison, et les notes
// de cellule sont les mêmes de part et d'autre. Un écart fait échouer le test avec le relevé complet.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { adresse, avecCorrections, citations, comparable, enA1, morceaux, nombreDEcarts, plage, rapport, rapprocher, sansCorrections } from '../../tools/sources/rapprocher.mjs';
import { texteDInstantane } from '../../tools/sources/instantane.mjs';
import { ouvrirBase } from '../src/lib/donnees.mjs';

const racine = new URL('../../', import.meta.url);
const lire = (chemin) => JSON.parse(readFileSync(new URL(chemin, racine), 'utf8'));
const registre = lire('sources/raw/classeurs/registre.json');

test('adresses, plages et citations des source_ref', () => {
  assert.deepEqual(adresse('AB12'), { r: 12, c: 28 });
  assert.equal(enA1({ r: 12, c: 28 }), 'AB12');
  assert.equal(adresse('12'), null);
  assert.deepEqual(plage('C3:A1'), { r1: 1, c1: 1, r2: 3, c2: 3 });
  assert.deepEqual(citations('Classe Maverick V7 › Anansi › A2:L13, AM1:BA1 ; Classe Maverick V7 › Sommaire › I13:J13').map((c) => [c.onglet, c.plages.map((p) => p.texte)]),
    [['Anansi', ['A2:L13', 'AM1:BA1']], ['Sommaire', ['I13:J13']]]);
  assert.deepEqual(citations('Google Sheet « Classe Maverick V7 », onglet « Anansi »'), [{ classeur: 'Classe Maverick V7', onglet: 'Anansi', plages: [] }]);
  assert.deepEqual(citations(null), []);
});

test('texte comparable, morceaux d’une valeur faite de plusieurs cellules, corrections d’orthographe dans les deux sens', () => {
  assert.equal(comparable('  l’armure  lourde\n'), "l'armure lourde");
  assert.deepEqual(morceaux('- 1 maîtrise Dague\n- 1 maîtrise au choix'), ['1 maîtrise Dague', '1 maîtrise au choix']);
  const regs = [{ avant: 'Grace', apres: 'Grâce' }];
  assert.equal(sansCorrections('Grâce à son arme', regs), 'Grace à son arme');
  assert.equal(avecCorrections('Grace à son arme. Grâce à son armure', regs), 'Grâce à son arme. Grâce à son armure');
});

test('chaque classeur du registre est rapproché ou en cours, avec son instantané et son registre de cellules', () => {
  for (const c of registre.classeurs) {
    assert.ok(['rapproche', 'en_cours'].includes(c.etat), `${c.titre} : état « ${c.etat} »`);
    const reg = lire(c.ignorer);
    assert.ok(Array.isArray(reg.regles) && typeof (reg.derivees ?? {}) === 'object', `${c.ignorer} : regles et derivees`);
    for (const r of reg.regles) assert.ok(r.raison, `${c.ignorer} : une règle sans raison`);
    for (const [col, raison] of Object.entries(reg.derivees ?? {})) assert.ok(/^[a-z_]+\.[a-z0-9_]+$/.test(col) && raison, `${c.ignorer} : ${col}`);
  }
  assert.ok(registre.classeurs.some((c) => c.etat === 'rapproche'));
});

test('un instantané se réécrit à l’identique (forme stable, rien de perdu)', () => {
  for (const c of registre.classeurs) {
    const texte = readFileSync(new URL(`sources/raw/classeurs/${c.fichier}`, racine), 'utf8');
    assert.equal(texteDInstantane(JSON.parse(texte)), texte, c.fichier);
  }
});

const db = ouvrirBase({ sansExemples: false });
for (const c of registre.classeurs.filter((x) => x.etat === 'rapproche')) {
  test(`« ${c.titre} » et la base sont d’accord dans les deux sens`, () => {
    const R = rapprocher(db, {
      classeur: c.titre, dump: lire(`sources/raw/classeurs/${c.fichier}`), nomDuDump: `sources/raw/classeurs/${c.fichier}`, ...lire(c.ignorer),
    });
    assert.ok(R.lignes > 0, 'des lignes de la base citent le classeur');
    assert.equal(nombreDEcarts(R), 0, rapport(R, { exemples: 50 }));
  });
}

test('le rapprochement voit un mot changé, un nombre changé et une cellule ajoutée', () => {
  const c = registre.classeurs.find((x) => x.titre === 'Classe Maverick V7');
  const dump = lire(`sources/raw/classeurs/${c.fichier}`);
  const guerrier = dump.sheets.find((s) => s.name === 'Guerrier');
  const niveau = guerrier.cells.find((x) => typeof x.v === 'string' && x.v.startsWith('Lvl 20'));
  niveau.v = niveau.v.replace('Lvl 20', 'Lvl 21');
  const mot = guerrier.cells.find((x) => typeof x.v === 'string' && x.v.includes('dégâts') && x !== niveau);
  mot.v = mot.v.replace('dégâts', 'soins');
  guerrier.cells.push({ r: 99, c: 2, v: 'Nouvelle règle' });
  const R = rapprocher(db, { classeur: c.titre, dump, ...lire(c.ignorer) });
  assert.equal(R.nombres.length, 1, 'le niveau changé');
  assert.ok(R.ecarts.length >= 1, 'le mot changé');
  assert.deepEqual(R.nonCitees.map((x) => `${x.onglet}!${x.cellule}`), ['Guerrier!B99']);
});
