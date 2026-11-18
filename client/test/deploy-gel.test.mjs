// Le geste de root du gel des écritures (deploy/installateur/gel.sh ; lot 11, garde-fou 16 ; docs/serveur.md, « Gel des écritures ») : exécuté pour de bon avec sh,
// dans une instance factice. Il pose db/gel.json que le service lit (le vrai code de serveur/gel.mjs relit ce qu'il écrit), le lève, dit où l'on en est, refuse
// une durée hors des bornes, n'écrit jamais un fichier à moitié (provisoire puis renommage) et est livré par l'installateur dans les DEUX instances. Les tests
// du script se sautent sans sh, ceux de la livraison sans tar ni gzip.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, utimesSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { fabriquer } from '../../deploy/installateur/fabriquer.mjs';
import { FICHIER_GEL, lireLeGel, messageDuGel } from '../serveur/gel.mjs';
import { dossierTemporaire, variablesTemporaires } from './aide-dossier-temporaire.mjs';

const SCRIPT = fileURLToPath(new URL('../../deploy/installateur/gel.sh', import.meta.url));
const outil = (cmd, arg = '--version') => spawnSync(cmd, [arg], { stdio: 'ignore' }).status === 0;
const SANS_SH = spawnSync('sh', ['-c', 'true'], { stdio: 'ignore' }).status !== 0 && 'sh indisponible';
const SANS_DATE_GNU = spawnSync('date', ['-u', '-d', '@0', '+%s'], { encoding: 'utf8' }).stdout.trim() !== '0' && 'date GNU indisponible';
const SKIP = SANS_SH || SANS_DATE_GNU;
const SANS_TAR = !(outil('tar') && outil('gzip')) && 'tar ou gzip indisponible';
const MIN = 60_000;

/** Une instance factice : le dossier (nommé comme celui du VPS), son db/, et le script copié à sa racine, où l'installateur le livre. */
function instance(t, nom = 'maverick-center-test') {
  const racine = dossierTemporaire('gel-sh', { t });
  const dossier = join(racine, nom);
  mkdirSync(join(dossier, 'db'), { recursive: true });
  copyFileSync(SCRIPT, join(dossier, 'gel.sh'));
  const lancer = (...args) => {
    const r = spawnSync('sh', [join(dossier, 'gel.sh'), ...args], {
      encoding: 'utf8', timeout: 30_000, env: { PATH: process.env.PATH, LANG: 'C.UTF-8', ...variablesTemporaires(racine), MAVERICK_ESSAI: '1' },
    });
    return { code: r.status, out: `${r.stdout}${r.stderr}` };
  };
  return { racine, dossier, fichier: join(dossier, 'db', FICHIER_GEL), lancer };
}

test('poser : db/gel.json que le service lit ; 60 minutes par défaut, le motif et le geste exact ; lisible par le service, écrit en entier par un fichier provisoire, rien ne traîne', { skip: SKIP }, (t) => {
  const i = instance(t);
  const avant = Date.now();
  const r = i.lancer('poser');
  assert.equal(r.code, 0, r.out);
  const lu = lireLeGel(join(i.dossier, 'db'), { maintenantMs: avant });
  assert.equal(lu.etat, 'actif');
  assert.equal(lu.gel.illisible, false);
  assert.equal(lu.gel.plafonne, false);
  assert.equal(lu.gel.motif, 'mise à jour en cours');
  assert.equal(lu.gel.geste, `sudo sh ${i.dossier}/gel.sh lever`, 'le geste exact, avec le dossier de CETTE instance');
  const duree = lu.fin_ms - avant;
  assert.ok(duree > 59 * MIN && duree <= 60 * MIN + 2000, `60 minutes à la seconde près (${duree} ms)`);
  assert.match(r.out, /pendant 60 minutes, jusqu'à \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z/);
  assert.ok(r.out.includes(`sudo sh ${i.dossier}/gel.sh lever`), r.out);
  assert.equal(statSync(i.fichier).mode & 0o777, 0o644, 'lisible par le service du conteneur');
  assert.deepEqual(readdirSync(join(i.dossier, 'db')), [FICHIER_GEL], 'aucun fichier provisoire laissé');
  assert.equal(JSON.parse(readFileSync(i.fichier, 'utf8')).format, 'maverick-gel/1');
  // le message que verrait un joueur dit jusqu'à quand, pourquoi et le geste
  assert.match(messageDuGel(lu.gel, { maintenantMs: avant }), /gel\.sh lever/);
});

test('poser --duree et --motif : la durée voulue (1 à 240 minutes), un motif quelconque (guillemets, barres, accents, retours à la ligne) reste un JSON valide', { skip: SKIP }, (t) => {
  const i = instance(t, 'maverick-center');
  for (const [duree, attendu] of [['1', 1], ['15', 15], ['240', 240]]) {
    const avant = Date.now();
    assert.equal(i.lancer('poser', '--duree', duree).code, 0);
    const d = lireLeGel(join(i.dossier, 'db'), { maintenantMs: avant }).fin_ms - avant;
    assert.ok(d > (attendu - 1) * MIN && d <= attendu * MIN + 2000, `${duree} min : ${d} ms`);
  }
  const motif = 'bascule « prod » : "écritures" \\ gelées\nsur deux lignes\t!';
  const r = i.lancer('poser', '--duree', '30', '--motif', motif);
  assert.equal(r.code, 0, r.out);
  const brut = JSON.parse(readFileSync(i.fichier, 'utf8'));
  assert.equal(brut.motif, 'bascule « prod » : "écritures" \\ gelées sur deux lignes !', 'un seul paragraphe, guillemets et barre conservés');
  assert.equal(brut.geste, `sudo sh ${i.dossier}/gel.sh lever`, 'le geste de la production : /srv/maverick-center, sans -test');
  assert.equal(lireLeGel(join(i.dossier, 'db')).gel.motif, brut.motif);
  // un motif démesuré est coupé (le service le coupe aussi)
  assert.equal(i.lancer('poser', '--motif', 'x'.repeat(2000)).code, 0);
  assert.ok(JSON.parse(readFileSync(i.fichier, 'utf8')).motif.length <= 250);
});

test('poser : une durée hors des bornes ou un usage faux est refusé (code 2) avec les chiffres, et n’écrit rien ; reposer remplace le gel', { skip: SKIP }, (t) => {
  const i = instance(t);
  for (const duree of ['0', '241', '1000', '-5', 'abc', '1.5', '']) {
    const r = i.lancer('poser', '--duree', duree);
    assert.equal(r.code, 2, `--duree « ${duree} » : ${r.out}`);
    assert.match(r.out, /de 1 à 240/);
    assert.equal(existsSync(i.fichier), false);
  }
  for (const args of [[], ['inconnue'], ['poser', '--inconnu'], ['poser', '--duree'], ['lever', '--duree', '5'], ['etat', 'x']]) {
    const r = i.lancer(...args);
    assert.equal(r.code, 2, `${args.join(' ')} : ${r.out}`);
    assert.match(r.out, /Usage : sudo sh .*gel\.sh poser/);
  }
  assert.equal(existsSync(i.fichier), false);
  assert.equal(i.lancer('poser', '--duree', '10', '--motif', 'premier').code, 0);
  const r = i.lancer('poser', '--duree', '20', '--motif', 'second');
  assert.equal(r.code, 0);
  assert.match(r.out, /déjà posé .* remplacé/);
  assert.equal(lireLeGel(join(i.dossier, 'db')).gel.motif, 'second');
});

test('lever : retire le gel et le dit ; sans gel, le dit aussi (code 0) ; le service ne voit plus rien', { skip: SKIP }, (t) => {
  const i = instance(t);
  assert.match(i.lancer('lever').out, /Aucun gel n'est posé/);
  i.lancer('poser', '--duree', '30');
  assert.equal(lireLeGel(join(i.dossier, 'db')).etat, 'actif');
  const r = i.lancer('lever');
  assert.equal(r.code, 0);
  assert.match(r.out, /Gel levé/);
  assert.equal(existsSync(i.fichier), false);
  assert.equal(lireLeGel(join(i.dossier, 'db')).etat, 'absent');
});

test('etat : aucun gel ; un gel (jusqu’à quand, combien de minutes, motif, geste) ; un gel échu ; un fichier illisible tenu au plus 2 h', { skip: SKIP }, (t) => {
  const i = instance(t);
  assert.match(i.lancer('etat').out, /Gel : aucun/);
  i.lancer('poser', '--duree', '45', '--motif', 'essai');
  const actif = i.lancer('etat');
  assert.equal(actif.code, 0);
  assert.match(actif.out, /Gel : posé le \d{4}-.*jusqu'à \d{4}-.*\(encore (44|45) min\) : essai\./);
  assert.ok(actif.out.includes(`sudo sh ${i.dossier}/gel.sh lever`));
  // échu : écrit à la main avec une échéance passée
  writeFileSync(i.fichier, '{"format":"maverick-gel/1","pose_le":"2020-01-01T00:00:00Z","jusqu_a":"2020-01-01T01:00:00Z","motif":"ancien","geste":"x"}\n');
  assert.match(i.lancer('etat').out, /Gel : échu depuis 2020-01-01T01:00:00Z ; le service l'ignore/);
  // illisible, modifié il y a 30 minutes : tenu, il reste environ 90 minutes
  writeFileSync(i.fichier, '{ pas du json');
  const il = (Date.now() - 30 * MIN) / 1000;
  utimesSync(i.fichier, il, il);
  const r = i.lancer('etat');
  assert.match(r.out, /illisible ou mal formé/);
  assert.match(r.out, /encore (89|90) min/);
  assert.equal(lireLeGel(join(i.dossier, 'db')).gel.illisible, true, 'le service le tient aussi');
  // illisible depuis plus de 2 h : le plafond est passé
  const vieux = (Date.now() - 130 * MIN) / 1000;
  utimesSync(i.fichier, vieux, vieux);
  assert.match(i.lancer('etat').out, /plafond de 2 h est passé/);
  assert.equal(lireLeGel(join(i.dossier, 'db')).etat, 'echu');
});

test('sans db/ (ce n’est pas une instance) : refus clair, rien n’est créé ; un dossier aux caractères douteux est refusé', { skip: SKIP }, (t) => {
  const racine = dossierTemporaire('gel-sh-sans-db', { t });
  const dossier = join(racine, 'ailleurs');
  mkdirSync(dossier);
  copyFileSync(SCRIPT, join(dossier, 'gel.sh'));
  const lancer = (cwd, script) => spawnSync('sh', [script, 'poser'], { cwd, encoding: 'utf8', env: { PATH: process.env.PATH, MAVERICK_ESSAI: '1', ...variablesTemporaires(racine) } });
  const r = lancer(dossier, join(dossier, 'gel.sh'));
  assert.equal(r.status, 1);
  assert.match(r.stderr, /db est introuvable/);
  assert.equal(existsSync(join(dossier, 'db')), false);
  const bizarre = join(racine, 'a b');
  mkdirSync(join(bizarre, 'db'), { recursive: true });
  copyFileSync(SCRIPT, join(bizarre, 'gel.sh'));
  const r2 = lancer(bizarre, join(bizarre, 'gel.sh'));
  assert.equal(r2.status, 1);
  assert.match(r2.stderr, /caractères que ce script refuse/);
  assert.deepEqual(readdirSync(join(bizarre, 'db')), []);
});

test('sans MAVERICK_ESSAI, un autre que root est refusé avant toute écriture', { skip: SKIP || (process.getuid?.() === 0 && 'lancé en root : le refus ne se joue pas') }, (t) => {
  const i = instance(t);
  const r = spawnSync('sh', [join(i.dossier, 'gel.sh'), 'poser'], { encoding: 'utf8', env: { PATH: process.env.PATH } });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /à lancer en root : sudo sh/);
  assert.equal(existsSync(i.fichier), false);
});

// ---------------------------------------------------------------------------------------------------------------------------------------------
// La livraison : les deux instances
// ---------------------------------------------------------------------------------------------------------------------------------------------

test('l’installateur livre gel.sh à la racine de l’instance de test ET de production, exécutable, tel quel ; il remplace une ancienne version et ne touche pas à db/gel.json', { skip: SANS_TAR }, (t) => {
  const racine = dossierTemporaire('gel-livraison', { t });
  const site = join(racine, 'site');
  mkdirSync(site);
  writeFileSync(join(site, 'index.html'), '<h1>accueil</h1>');
  const source = readFileSync(SCRIPT, 'utf8');
  for (const [mode, tag, version] of [['test', 'v0.9.1', '0.9.1'], ['prod', 'v0.9', '0.9.0']]) {
    const { fichier } = fabriquer({ mode, site, tag, version, sha: 'e'.repeat(40), sortie: join(racine, 'sortie') });
    const dossier = join(racine, `instance-${mode}`);
    mkdirSync(join(dossier, 'db'), { recursive: true });
    writeFileSync(join(dossier, 'gel.sh'), 'ancienne version');
    writeFileSync(join(dossier, 'db', FICHIER_GEL), '{"jusqu_a":"2099-01-01T00:00:00Z"}\n');
    const r = spawnSync('sh', [fichier, '--dossier', dossier], {
      encoding: 'utf8', env: { PATH: process.env.PATH, MAVERICK_ESSAI_ACCUSE_S: '1', MAVERICK_ESSAI_DELAI_S: '3', ...variablesTemporaires(racine) },
    });
    assert.equal(r.status, 0, `${mode} : ${r.stdout}${r.stderr}`);
    assert.equal(readFileSync(join(dossier, 'gel.sh'), 'utf8'), source, `${mode} : le script livré est celui du dépôt`);
    assert.equal(statSync(join(dossier, 'gel.sh')).mode & 0o755, 0o755, `${mode} : exécutable`);
    assert.equal(readFileSync(join(dossier, 'db', FICHIER_GEL), 'utf8'), '{"jusqu_a":"2099-01-01T00:00:00Z"}\n', `${mode} : une installation ne touche jamais à db/`);
    assert.deepEqual(readdirSync(dossier).filter((f) => f.startsWith('.gel.sh')), [], `${mode} : aucun fichier provisoire`);
  }
});
