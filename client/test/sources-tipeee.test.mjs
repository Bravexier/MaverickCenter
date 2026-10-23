// L'instantané de la partie « Bienvenue » de Tipeee (réponses du propriétaire du 2026-10-22 : « La partie « Bienvenue » », « En direct par le
// serveur » ; docs/sources.md, « Tipeee ») et son outil, tools/sources/tipeee.mjs : forme stable du fichier, instantané gardé tel quel quand le texte
// n'a pas changé, rien d'écrit quand la partie manque, vérificateur, et l'instantané versionné dans sources/tipeee/. L'extraction elle-même est
// testée par tipeee.test.mjs.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { instantaneAEcrire, problemesDInstantane, texteDInstantane } from '../../tools/sources/tipeee.mjs';
import { CHEMIN_INSTANTANE, REPERE, URL_API, bienvenueDeTipeee, instantaneValide } from '../src/lib/tipeee.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';

const RACINE = fileURLToPath(new URL('../../', import.meta.url));
const OUTIL = join(RACINE, 'tools', 'sources', 'tipeee.mjs');
const EXEMPLE = readFileSync(new URL('./fixtures/tipeee-projet.json', import.meta.url), 'utf8');
const PARAGRAPHES = bienvenueDeTipeee(EXEMPLE).paragraphes;
const avecHtml = (html) => JSON.stringify({ contentv2: { translations: { fr: { html } } } });
const AUTRE = avecHtml(`<p>${REPERE}</p><p>Un texte changé.</p>`);
const SANS_REPERE = avecHtml('<p>Une présentation sans la partie.</p>');

const dossier = dossierTemporaire('sources-tipeee');
let n = 0;
const fichier = (contenu) => { const chemin = join(dossier, `f-${(n += 1)}.json`); if (contenu !== undefined) writeFileSync(chemin, contenu); return chemin; };
const outil = (...args) => spawnSync(process.execPath, ['--no-warnings', OUTIL, ...args], { encoding: 'utf8', cwd: RACINE });

test('forme stable : url, lu_le, paragraphes, deux espaces, une fin de ligne', () => {
  const texte = texteDInstantane({ paragraphes: ['a'], lu_le: '2026-10-22T10:00:00Z', url: URL_API, autre: 1 });
  assert.equal(texte, `{\n  "url": "${URL_API}",\n  "lu_le": "2026-10-22T10:00:00Z",\n  "paragraphes": [\n    "a"\n  ]\n}\n`);
});

test('instantané à écrire : neuf, inchangé (date gardée), changé, refusé', () => {
  const neuf = instantaneAEcrire(null, EXEMPLE, '2026-10-22T10:00:00Z');
  assert.deepEqual(neuf, { instantane: { url: URL_API, lu_le: '2026-10-22T10:00:00Z', paragraphes: PARAGRAPHES }, change: true });
  // même texte : l'ancien reste tel quel, avec sa date (ni diff ni date bougée)
  assert.deepEqual(instantaneAEcrire(neuf.instantane, EXEMPLE, '2026-10-23T10:00:00Z'), { instantane: neuf.instantane, change: false });
  // texte changé, ou ancien d'une autre adresse ou illisible : réécrit, à la nouvelle date
  assert.deepEqual(instantaneAEcrire(neuf.instantane, AUTRE, '2026-10-23T10:00:00Z'),
    { instantane: { url: URL_API, lu_le: '2026-10-23T10:00:00Z', paragraphes: [REPERE, 'Un texte changé.'] }, change: true });
  assert.equal(instantaneAEcrire({ ...neuf.instantane, url: 'https://ailleurs.example/' }, EXEMPLE, '2026-10-23T10:00:00Z').change, true);
  assert.equal(instantaneAEcrire({ paragraphes: 'x' }, EXEMPLE, '2026-10-23T10:00:00Z').change, true);
  // partie absente ou réponse invalide : rien à écrire, la raison du module pur
  assert.equal(instantaneAEcrire(neuf.instantane, SANS_REPERE, '2026-10-23T10:00:00Z').raison, 'repere-absent');
  assert.equal(instantaneAEcrire(null, 'pas du JSON', '2026-10-23T10:00:00Z').raison, 'reponse-invalide');
  assert.equal(instantaneAEcrire(null, EXEMPLE, 'hier').raison, 'date-invalide');
});

test('vérificateur : forme, adresse, texte actuel de Tipeee', () => {
  const bon = texteDInstantane({ url: URL_API, lu_le: '2026-10-22T10:00:00Z', paragraphes: PARAGRAPHES });
  assert.deepEqual(problemesDInstantane(bon), []);
  assert.deepEqual(problemesDInstantane(bon, EXEMPLE), []);
  assert.match(problemesDInstantane(bon, AUTRE).join(), /a changé depuis le 2026-10-22T10:00:00Z/);
  assert.match(problemesDInstantane(bon, SANS_REPERE).join(), /^Tipeee : le repère/);
  assert.match(problemesDInstantane(JSON.stringify(JSON.parse(bon))).join(), /forme stable/);
  assert.match(problemesDInstantane(bon.replace(URL_API, 'https://ailleurs.example/')).join(), /adresse https:\/\/ailleurs\.example\//);
  assert.match(problemesDInstantane('{').join(), /pas du JSON/);
  assert.match(problemesDInstantane('{"url":"x"}').join(), /forme \{ url, lu_le, paragraphes \}/);
});

test('l’outil, sur une réponse enregistrée : écrit, garde, vérifie, refuse sans rien écrire', () => {
  const reponse = fichier(EXEMPLE);
  const sortie = join(dossier, 'sous-dossier', 'bienvenue.json');
  let r = outil('--depuis', reponse, '--lu-le', '2026-10-22T10:00:00Z', '--sortie', sortie);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /^écrit \(lu le 2026-10-22T10:00:00Z\) : 3 paragraphe\(s\)/);
  const ecrit = readFileSync(sortie, 'utf8');
  assert.equal(ecrit, texteDInstantane({ url: URL_API, lu_le: '2026-10-22T10:00:00Z', paragraphes: PARAGRAPHES }));
  r = outil('--depuis', reponse, '--lu-le', '2026-10-23T10:00:00Z', '--sortie', sortie);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /^inchangé \(lu le 2026-10-22T10:00:00Z\)/);
  assert.equal(readFileSync(sortie, 'utf8'), ecrit);
  r = outil('--verifier', '--depuis', reponse, '--sortie', sortie);
  assert.equal(r.status, 0, r.stderr);
  r = outil('--verifier', '--depuis', fichier(AUTRE), '--sortie', sortie);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /ÉCART le texte de Tipeee a changé/);
  r = outil('--depuis', fichier(SANS_REPERE), '--sortie', sortie);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /rien d’écrit : le repère/);
  assert.equal(readFileSync(sortie, 'utf8'), ecrit);
  const absent = fichier();
  r = outil('--depuis', fichier(SANS_REPERE), '--sortie', absent);
  assert.equal(r.status, 1);
  assert.equal(existsSync(absent), false);
  assert.equal(outil('--inconnue').status, 2);
});

test('l’instantané versionné : valide, dans sa forme stable, à l’adresse de l’API, depuis le repère', () => {
  const texte = readFileSync(join(RACINE, CHEMIN_INSTANTANE), 'utf8');
  assert.deepEqual(problemesDInstantane(texte), []);
  const instantane = instantaneValide(JSON.parse(texte));
  assert.equal(instantane.paragraphes[0].startsWith(REPERE), true);
});
