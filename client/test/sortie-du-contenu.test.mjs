// L'interrupteur de la sortie du contenu (lot 12, R296 ; src/lib/sortie-du-contenu.mjs) et ce qu'il commande dans les tests : la liste des tests qui sortent
// avec leur migration (RETIRES_AVEC_LE_CONTENU, test/aide-sortie-du-contenu.mjs) et les registres gardés (test/aide-registres-sortis.mjs). Ce fichier tourne
// éteint (le dépôt, la CI) comme allumé (la passe S : MAVERICK_CONTENU_SORTI=1, sans les migrations de données).
//   node --test test/sortie-du-contenu.test.mjs
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { CONTENU_SORTI, contenuSorti, RETIRES_AVEC_LE_CONTENU, VARIABLE_CONTENU_SORTI } from '../src/lib/sortie-du-contenu.mjs';
import { registreDeMigration, REGISTRES_GARDES } from './aide-registres-sortis.mjs';
import { testRetireAvecLeContenu } from './aide-sortie-du-contenu.mjs';

const racine = (chemin) => fileURLToPath(new URL(`../../${chemin}`, import.meta.url));

/** Lance `fn` avec MAVERICK_CONTENU_SORTI posé à `valeur` (undefined : retirée), puis remet l'environnement. */
function avecLaVariable(valeur, fn) {
  const avant = process.env[VARIABLE_CONTENU_SORTI];
  if (valeur === undefined) delete process.env[VARIABLE_CONTENU_SORTI];
  else process.env[VARIABLE_CONTENU_SORTI] = valeur;
  try {
    return fn();
  } finally {
    if (avant === undefined) delete process.env[VARIABLE_CONTENU_SORTI];
    else process.env[VARIABLE_CONTENU_SORTI] = avant;
  }
}

test('l’interrupteur est éteint dans le dépôt ; seule la variable posée à « 1 » l’allume pour un essai', () => {
  assert.equal(CONTENU_SORTI, false, 'la PR du jour J du lot 12 l’allume, pas avant');
  assert.equal(contenuSorti({}), false);
  for (const v of ['0', '', 'true', 'oui']) assert.equal(contenuSorti({ [VARIABLE_CONTENU_SORTI]: v }), false, JSON.stringify(v));
  assert.equal(contenuSorti({ [VARIABLE_CONTENU_SORTI]: '1' }), true);
});

test('RETIRES_AVEC_LE_CONTENU : chaque fichier existe, a sa raison, et déclare par l’aide exactement les tests de la liste', () => {
  const fichiers = Object.keys(RETIRES_AVEC_LE_CONTENU);
  assert.ok(fichiers.length > 0);
  for (const [fichier, { raison, tests }] of Object.entries(RETIRES_AVEC_LE_CONTENU)) {
    assert.ok(existsSync(racine(fichier)), fichier);
    assert.ok(raison?.length > 10, `${fichier} : sa raison`);
    assert.ok(tests.length > 0 && new Set(tests).size === tests.length, `${fichier} : des titres, sans doublon`);
    const texte = readFileSync(racine(fichier), 'utf8');
    const noms = [...texte.matchAll(/^const (\w+) = testRetireAvecLeContenu\(import\.meta\.url\);$/gm)].map((m) => m[1]);
    assert.equal(noms.length, 1, `${fichier} : une seule fonction tirée de testRetireAvecLeContenu`);
    const declares = [...texte.matchAll(new RegExp(`^${noms[0]}\\('([^'\\n]+)'`, 'gm'))].map((m) => m[1]);
    assert.deepEqual(declares.sort(), [...tests].sort(), `${fichier} : les tests déclarés par ${noms[0]} sont ceux de la liste`);
  }
});

test('testRetireAvecLeContenu : un titre absent de la liste est une erreur ; allumé, un test de la liste n’est pas déclaré', () => {
  const [fichier, { tests }] = Object.entries(RETIRES_AVEC_LE_CONTENU)[0];
  const declarer = testRetireAvecLeContenu(pathToFileURL(racine(fichier)).href);
  assert.throws(() => declarer('un titre que la liste ne connaît pas', () => {}), /n'est pas déclaré dans RETIRES_AVEC_LE_CONTENU/);
  assert.throws(() => testRetireAvecLeContenu(import.meta.url)(tests[0], () => {}), /n'est pas déclaré/, 'la liste est propre à chaque fichier');
  avecLaVariable('1', () => assert.equal(declarer(tests[0], () => assert.fail('ne doit pas tourner')), undefined));
});

test('registres gardés : allumé, un registre sorti se lit dans la fixture, un registre qui reste dans son fichier ; éteint, toujours dans le fichier', () => {
  assert.ok(Object.keys(REGISTRES_GARDES).length > 0);
  const reste = '0113-mots-cles-id-entier'; // une migration mixte : elle reste dans le dépôt
  const fichier = JSON.parse(readFileSync(racine(`data/migrations/${reste}.json`), 'utf8'));
  avecLaVariable(undefined, () => assert.deepEqual(registreDeMigration(reste), fichier));
  avecLaVariable('1', () => {
    assert.deepEqual(registreDeMigration(reste), fichier);
    for (const [nom, garde] of Object.entries(REGISTRES_GARDES)) assert.equal(registreDeMigration(nom), garde, nom);
    assert.throws(() => registreDeMigration('9999-registre-d-essai-absent'), /sorti avec le contenu et non gardé/);
  });
});
