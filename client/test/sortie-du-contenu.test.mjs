// Les interrupteurs de la sortie du contenu (lot 12, R296 ; src/lib/sortie-du-contenu.mjs : contenu, puis migrations mixtes) et ce qu'ils commandent dans
// les tests : les listes des tests qui sortent avec leur migration (RETIRES_AVEC_LE_CONTENU, RETIRES_AVEC_LES_MIXTES ; test/aide-sortie-du-contenu.mjs) et
// les registres gardés (test/aide-registres-sortis.mjs). Ce fichier tourne éteint (le dépôt, la CI) comme allumé (la passe S : MAVERICK_CONTENU_SORTI=1,
// sans les migrations de données ; avec --avec-mixtes, MAVERICK_MIXTES_SORTIES=1, sans les migrations mixtes).
//   node --test test/sortie-du-contenu.test.mjs
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  CONTENU_SORTI, contenuSorti, MIXTES_SORTIES, mixtesSorties, RETIRES_AVEC_LE_CONTENU, RETIRES_AVEC_LES_MIXTES, VARIABLE_CONTENU_SORTI, VARIABLE_MIXTES_SORTIES,
} from '../src/lib/sortie-du-contenu.mjs';
import { registreDeMigration, REGISTRES_GARDES } from './aide-registres-sortis.mjs';
import { testRetireAvecLeContenu, testRetireAvecLesMixtes } from './aide-sortie-du-contenu.mjs';

const racine = (chemin) => fileURLToPath(new URL(`../../${chemin}`, import.meta.url));

/** Lance `fn` avec MAVERICK_CONTENU_SORTI et MAVERICK_MIXTES_SORTIES posées à `valeur` (undefined : retirées), puis remet l'environnement. */
function avecLaVariable(valeur, fn) {
  const variables = [VARIABLE_CONTENU_SORTI, VARIABLE_MIXTES_SORTIES];
  const avant = variables.map((v) => process.env[v]);
  for (const v of variables) {
    if (valeur === undefined) delete process.env[v];
    else process.env[v] = valeur;
  }
  try {
    return fn();
  } finally {
    variables.forEach((v, i) => {
      if (avant[i] === undefined) delete process.env[v];
      else process.env[v] = avant[i];
    });
  }
}

test('les interrupteurs sont éteints dans le dépôt ; seule leur variable posée à « 1 » les allume pour un essai', () => {
  assert.equal(CONTENU_SORTI, false, 'la PR du jour J du lot 12 l’allume, pas avant');
  assert.equal(MIXTES_SORTIES, false, 'la PR qui retire les migrations mixtes l’allume, pas avant');
  for (const [sorti, variable] of [[contenuSorti, VARIABLE_CONTENU_SORTI], [mixtesSorties, VARIABLE_MIXTES_SORTIES]]) {
    assert.equal(sorti({}), false);
    for (const v of ['0', '', 'true', 'oui']) assert.equal(sorti({ [variable]: v }), false, JSON.stringify(v));
    assert.equal(sorti({ [variable]: '1' }), true);
  }
  assert.equal(contenuSorti({ [VARIABLE_MIXTES_SORTIES]: '1' }), false, 'deux interrupteurs distincts');
  assert.equal(mixtesSorties({ [VARIABLE_CONTENU_SORTI]: '1' }), false);
});

const LISTES = [
  { nom: 'RETIRES_AVEC_LE_CONTENU', liste: RETIRES_AVEC_LE_CONTENU, aide: 'testRetireAvecLeContenu', fabrique: testRetireAvecLeContenu },
  { nom: 'RETIRES_AVEC_LES_MIXTES', liste: RETIRES_AVEC_LES_MIXTES, aide: 'testRetireAvecLesMixtes', fabrique: testRetireAvecLesMixtes },
];

test('RETIRES_AVEC_LE_CONTENU et RETIRES_AVEC_LES_MIXTES : chaque fichier existe, a sa raison, et déclare par son aide exactement les tests de sa liste ; un test n’est que dans une liste', () => {
  assert.ok(Object.keys(RETIRES_AVEC_LE_CONTENU).length > 0);
  for (const { nom, liste, aide } of LISTES) {
    for (const [fichier, { raison, tests }] of Object.entries(liste)) {
      assert.ok(existsSync(racine(fichier)), fichier);
      assert.ok(raison?.length > 10, `${fichier} : sa raison`);
      assert.ok(tests.length > 0 && new Set(tests).size === tests.length, `${fichier} : des titres, sans doublon`);
      const texte = readFileSync(racine(fichier), 'utf8');
      const noms = [...texte.matchAll(new RegExp(`^const (\\w+) = ${aide}\\(import\\.meta\\.url\\);$`, 'gm'))].map((m) => m[1]);
      assert.equal(noms.length, 1, `${fichier} : une seule fonction tirée de ${aide} (${nom})`);
      const declares = [...texte.matchAll(new RegExp(`^${noms[0]}\\('([^'\\n]+)'`, 'gm'))].map((m) => m[1]);
      assert.deepEqual(declares.sort(), [...tests].sort(), `${fichier} : les tests déclarés par ${noms[0]} sont ceux de ${nom}`);
    }
  }
  // un fichier peut avoir des tests dans les deux listes (l'un éprouve une migration de données, l'autre une migration mixte), chacun dans une seule
  const communs = Object.keys(RETIRES_AVEC_LE_CONTENU).filter((f) => Object.hasOwn(RETIRES_AVEC_LES_MIXTES, f))
    .flatMap((f) => RETIRES_AVEC_LE_CONTENU[f].tests.filter((t) => RETIRES_AVEC_LES_MIXTES[f].tests.includes(t)).map((t) => `${f} : ${t}`));
  assert.deepEqual(communs, [], 'un test sort avec le contenu ou avec les mixtes, pas les deux');
});

test('testRetireAvecLeContenu, testRetireAvecLesMixtes : un titre absent de la liste est une erreur ; allumé, un test de la liste n’est pas déclaré', () => {
  for (const { nom, liste, fabrique } of LISTES) {
    const entrees = Object.entries(liste);
    if (!entrees.length) {
      assert.throws(() => fabrique(import.meta.url)('un titre', () => {}), new RegExp(`n'est pas déclaré dans ${nom}`));
      continue;
    }
    const [fichier, { tests }] = entrees[0];
    const declarer = fabrique(pathToFileURL(racine(fichier)).href);
    assert.throws(() => declarer('un titre que la liste ne connaît pas', () => {}), new RegExp(`n'est pas déclaré dans ${nom}`));
    assert.throws(() => fabrique(import.meta.url)(tests[0], () => {}), /n'est pas déclaré/, 'la liste est propre à chaque fichier');
    avecLaVariable('1', () => assert.equal(declarer(tests[0], () => assert.fail('ne doit pas tourner')), undefined));
  }
});

test('registres gardés : allumé, un registre sorti se lit dans la fixture, un registre qui reste dans son fichier ; éteint, toujours dans le fichier', () => {
  assert.ok(Object.keys(REGISTRES_GARDES).length > 0);
  // les registres encore dans data/migrations et non gardés (les migrations mixtes, tant qu'elles restent) : lus dans leur fichier, allumé ou non
  const restes = readdirSync(racine('data/migrations')).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)).filter((n) => !Object.hasOwn(REGISTRES_GARDES, n));
  if (!mixtesSorties()) assert.ok(restes.length > 0, 'les registres des migrations mixtes sont dans le dépôt');
  const fichier = (nom) => JSON.parse(readFileSync(racine(`data/migrations/${nom}.json`), 'utf8'));
  avecLaVariable(undefined, () => {
    for (const nom of restes) assert.deepEqual(registreDeMigration(nom), fichier(nom), nom);
  });
  avecLaVariable('1', () => {
    for (const nom of restes) assert.deepEqual(registreDeMigration(nom), fichier(nom), nom);
    for (const [nom, garde] of Object.entries(REGISTRES_GARDES)) assert.equal(registreDeMigration(nom), garde, nom);
    assert.throws(() => registreDeMigration('9999-registre-d-essai-absent'), /sorti avec le contenu ou les migrations mixtes et non gardé/);
  });
});
