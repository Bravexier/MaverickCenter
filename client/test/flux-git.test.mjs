// Flux Git (docs/flux-git.md) : règles pures de tools/flux-git/regles.mjs, puis le bot (tools/flux-git/cli.mjs) rejoué sur de vrais
// dépôts Git temporaires (un dépôt « distant » nu + des clones), sans GitHub : feature → dev, livraison dev → master (mineure, majeure),
// hotfix → master avec refusion dans dev, conflits, contrôles des créations de branches et des PR.
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  avantHebergement, avantLaUn, brancheASupprimer, comparerVersions, demandeMajeure, etiquette, etiquetteDeVersion, familleDe, incrementer, livrableDe, modeDeEtiquette,
  planifier, poserVersionJson, PREMIERE_VERSION_HEBERGEE, typeDeFusion, verifierCreation, verifierPR,
} from '../../tools/flux-git/regles.mjs';
import { modeDuSite } from '../src/lib/mode-site.mjs';

const CLI = fileURLToPath(new URL('../../tools/flux-git/cli.mjs', import.meta.url));

describe('règles pures', () => {
  test('familles et noms de branches', () => {
    assert.equal(familleDe('master'), 'principale');
    assert.equal(familleDe('dev'), 'principale');
    assert.equal(familleDe('feature/carte'), 'feature');
    assert.equal(familleDe('feature/a/b'), 'feature');
    assert.equal(familleDe('hotfix/lien-casse'), 'hotfix');
    assert.equal(familleDe('site'), 'publication', 'branche du site avant la 0.2.0, écrite par le bot');
    for (const nom of ['feature/', 'hotfix/', 'feature', 'develop', 'main', 'dev/x', 'claude/x', 'features/x', 'Feature/x', 'site/x', 'feature/x/']) {
      assert.equal(familleDe(nom), null, nom);
    }
    assert.deepEqual(verifierCreation('feature/x'), { ok: true, famille: 'feature', depuis: 'dev' });
    assert.deepEqual(verifierCreation('hotfix/x'), { ok: true, famille: 'hotfix', depuis: 'master' });
    const refus = verifierCreation('dev/bold-ritchie');
    assert.equal(refus.ok, false);
    assert.match(refus.raison, /feature\/<nom>.*hotfix\/<nom>/);
  });

  test('sources permises par cible de PR', () => {
    assert.equal(verifierPR({ base: 'master', head: 'dev' }).type, 'livraison');
    assert.equal(verifierPR({ base: 'master', head: 'hotfix/x' }).type, 'hotfix');
    assert.equal(verifierPR({ base: 'dev', head: 'feature/x' }).type, 'feature');
    for (const [base, head] of [['master', 'feature/x'], ['master', 'claude/x'], ['dev', 'hotfix/x'], ['dev', 'master'], ['dev', 'dev/x'], ['master', 'main']]) {
      assert.equal(verifierPR({ base, head }).ok, false, `${head} → ${base}`);
    }
    assert.equal(verifierPR({ base: 'master', head: 'dev', memeDepot: false }).ok, false, 'une copie du dépôt ne livre pas');
    assert.deepEqual(verifierPR({ base: 'feature/x', head: 'feature/y' }), { ok: true, type: null }, 'les autres cibles sont libres');
    assert.equal(typeDeFusion({ base: 'main', head: 'feature/x' }), null);
  });

  test('branche supprimée après la fusion : la feature ou la hotfix, jamais dev ni une branche hors des règles', () => {
    assert.equal(brancheASupprimer({ base: 'dev', head: 'feature/carte' }), 'feature/carte');
    assert.equal(brancheASupprimer({ base: 'master', head: 'hotfix/lien' }), 'hotfix/lien');
    assert.equal(brancheASupprimer({ base: 'master', head: 'dev' }), null, 'la source d\'une livraison reste');
    assert.equal(brancheASupprimer({ base: 'master', head: 'feature/x' }), null);
    assert.equal(brancheASupprimer({ base: 'main', head: 'feature/x' }), null);
    assert.equal(brancheASupprimer({ base: 'dev', head: 'claude/x' }), null);
  });

  test('versions : incréments et marqueur [V: X+1]', () => {
    assert.equal(incrementer('0.1.25', 'patch'), '0.1.26');
    assert.equal(incrementer('0.1.25', 'mineure'), '0.2.0');
    assert.equal(incrementer('0.9.4', 'majeure'), '1.0.0');
    assert.throws(() => incrementer('0.1', 'patch'), /version invalide/);
    assert.throws(() => incrementer('v0.1.2', 'patch'), /version invalide/);
    assert.equal(comparerVersions('0.10.0', '0.9.9'), 1);
    for (const t of ['Livraison [V: X+1]', '[v:x+1]', '[ V : X + 1 ]']) assert.ok(demandeMajeure('', t), t);
    for (const t of ['V: X+1', '[V: 2]', '[V: X+2]', '[V X+1]']) assert.ok(!demandeMajeure(t), t);
    assert.ok(!demandeMajeure(undefined, null));
  });

  test('plan du bot pour chaque fusion (règles 4 à 7)', () => {
    assert.deepEqual(planifier({ type: 'feature', versionMaster: '0.1.25', versionDev: '0.1.27' }),
      { master: null, dev: { version: '0.1.28', synchroniser: false }, livrer: ['site'] });
    assert.deepEqual(planifier({ type: 'livraison', versionMaster: '0.1.27', versionDev: '0.1.27' }),
      { master: { version: '0.2.0' }, dev: { version: '0.2.0', synchroniser: true }, livrer: ['prod', 'test'] });
    assert.deepEqual(planifier({ type: 'livraison', versionMaster: '0.1.27', versionDev: '0.1.27', majeure: true }),
      { master: { version: '1.0.0' }, dev: { version: '1.0.0', synchroniser: true }, livrer: ['prod', 'test'] });
    assert.equal(planifier({ type: 'livraison', versionMaster: '0.1.27', versionDev: '0.1.29' }).dev.version, '0.2.0', 'jamais en arrière');
    assert.deepEqual(planifier({ type: 'hotfix', versionMaster: '0.2.0', versionDev: '0.2.3' }),
      { master: null, dev: { version: '0.2.4', synchroniser: true }, livrer: ['prod', 'test'] });
    assert.deepEqual(planifier({ type: 'feature', versionMaster: '1.0.0', versionDev: '1.0.4' }).livrer, ['test']);
    assert.deepEqual(planifier({ type: 'livraison', versionMaster: '1.0.4', versionDev: '1.0.4' }).livrer, ['prod', 'test']);
    assert.deepEqual(planifier({ type: 'hotfix', versionMaster: '1.1.0', versionDev: '1.1.3' }),
      { master: null, dev: { version: '1.1.4', synchroniser: true }, livrer: ['prod', 'test'] });
    assert.throws(() => planifier({ type: 'autre', versionMaster: '0.1.0', versionDev: '0.1.0' }), /inconnu/);
  });

  test('la 0.2.0 est la première version hébergée : avant, un seul site depuis dev ; ensuite, serveur normal (master) et serveur de test (dev)', () => {
    assert.equal(PREMIERE_VERSION_HEBERGEE, '0.2.0');
    assert.equal(avantHebergement('0.1.99'), true);
    assert.equal(avantHebergement('0.2.0'), false);
    assert.equal(avantLaUn('0.99.12'), true);
    assert.equal(avantLaUn('1.0.0'), false);
    assert.equal(livrableDe('dev', '0.1.64'), 'site');
    assert.equal(livrableDe('master', '0.1.64'), null);
    assert.equal(livrableDe('dev', '0.2.0'), 'test');
    assert.equal(livrableDe('master', '0.2.0'), 'prod');
    assert.equal(livrableDe('dev', '0.3.1'), 'test');
    assert.equal(livrableDe('dev', '1.0.0'), 'test');
    assert.equal(livrableDe('master', '1.0.0'), 'prod');
    assert.equal(livrableDe('master', '2.4.1'), 'prod');
    assert.throws(() => livrableDe('feature/x', '1.0.0'), /master ou dev/);
  });

  test('étiquettes de version (demande du propriétaire) : VX.Y.Z sur dev, VX.Y sur master', () => {
    assert.equal(etiquetteDeVersion('dev', '0.1.75'), 'V0.1.75');
    assert.equal(etiquetteDeVersion('dev', '0.2.0'), 'V0.2.0');
    assert.equal(etiquetteDeVersion('master', '0.2.0'), 'V0.2');
    assert.equal(etiquetteDeVersion('master', '1.0.0'), 'V1.0');
    assert.throws(() => etiquetteDeVersion('feature/x', '0.2.0'), /master ou dev/);
    assert.throws(() => etiquetteDeVersion('dev', 'v0.2.0'), /version invalide/);
  });

  test('étiquettes uniques des installateurs : chacun prend l\'étiquette de version de sa branche (VX.Y en production, VX.Y.Z en test)', () => {
    assert.equal(etiquette({ mode: 'prod', version: '0.2.0' }), 'V0.2');
    assert.equal(etiquette({ mode: 'test', version: '0.2.3' }), 'V0.2.3', 'la version de dev, sans suffixe « -test »');
    assert.equal(etiquette({ mode: 'test', version: '0.3.0' }), 'V0.3.0');
    assert.equal(etiquette({ mode: 'prod', version: '0.2.0', existantes: ['V0.2'], motif: 'hotfix' }), 'V0.2-hotfix.1');
    assert.equal(etiquette({ mode: 'prod', version: '0.2.0', existantes: ['V0.2', 'V0.2-hotfix.1'] }), 'V0.2-hotfix.2');
    assert.equal(etiquette({ mode: 'prod', version: '0.2.0', existantes: ['V0.2'], motif: 'rebuild' }), 'V0.2-rebuild.1');
    assert.equal(etiquette({ mode: 'test', version: '0.2.3', existantes: ['V0.2.3'] }), 'V0.2.3-rebuild.1');
    assert.equal(etiquette({ mode: 'test', version: '0.2.3', existantes: ['V0.2.3', 'V0.2.3-rebuild.1'] }), 'V0.2.3-rebuild.2');
    assert.throws(() => etiquette({ mode: 'preprod', version: '0.2.3' }), /mode inconnu/);
    assert.equal(modeDeEtiquette('V0.2.3'), 'test');
    assert.equal(modeDeEtiquette('V0.2.3-rebuild.1'), 'test');
    assert.equal(modeDeEtiquette('V0.2'), 'prod');
    assert.equal(modeDeEtiquette('V0.2-hotfix.1'), 'prod');
    assert.equal(modeDeEtiquette('V0.2-rebuild.3'), 'prod');
    assert.equal(modeDeEtiquette('V0.2.0-test'), null, 'seule livraison de test d\'avant cette règle');
  });

  test('aucune étiquette ne diffère d\'une autre par la seule casse (elles se confondraient dans un clone Windows ou macOS)', () => {
    const noms = [];
    for (const v of ['0.2.0', '0.2.1', '0.3.0', '1.0.0']) {
      noms.push(etiquette({ mode: 'test', version: v }));
      if (v.endsWith('.0')) noms.push(etiquetteDeVersion('master', v));
    }
    noms.push(etiquette({ mode: 'prod', version: '0.2.0', existantes: noms }), etiquette({ mode: 'test', version: '0.2.0', existantes: noms }));
    assert.equal(new Set(noms.map((n) => n.toLowerCase())).size, noms.length, noms.join(' '));
  });

  test('mode du site construit : serveur de test marqué, production (sans ce qui ne sert qu’au site de dev), étiquette de la livraison', () => {
    assert.deepEqual(modeDuSite({}, '0.1.75'), { test: false, prod: false, etiquette: 'V0.1.75' }, 'sans livraison : l\'étiquette de version de dev');
    assert.deepEqual(modeDuSite({ SITE_MODE: 'prod', SITE_TAG: 'V0.2-hotfix.1' }, '0.2.0'), { test: false, prod: true, etiquette: 'V0.2-hotfix.1' });
    assert.deepEqual(modeDuSite({ SITE_MODE: 'test', SITE_TAG: 'V0.2.3' }, '0.2.3'), { test: true, prod: false, etiquette: 'V0.2.3' });
  });

  test('pose de la version dans package.json et package-lock.json (texte conservé)', () => {
    const pkg = readFileSync(new URL('../package.json', import.meta.url), 'utf8');
    const lock = readFileSync(new URL('../package-lock.json', import.meta.url), 'utf8');
    const v = JSON.parse(pkg).version;
    assert.equal(poserVersionJson(pkg, v), pkg, 'aller-retour identique : seul le numéro change');
    assert.equal(poserVersionJson(lock, v), lock);
    const nouveau = JSON.parse(poserVersionJson(lock, '9.8.7'));
    assert.equal(nouveau.version, '9.8.7');
    assert.equal(nouveau.packages[''].version, '9.8.7');
  });
});

// ---------------------------------------------------------------- dépôts temporaires
const racine = mkdtempSync(join(tmpdir(), 'flux-git-test-'));
after(() => rmSync(racine, { recursive: true, force: true }));
const ENV = { ...process.env, GIT_CONFIG_NOSYSTEM: '1', HOME: racine, GIT_AUTHOR_NAME: 'Test', GIT_AUTHOR_EMAIL: 't@example.org', GIT_COMMITTER_NAME: 'Test', GIT_COMMITTER_EMAIL: 't@example.org' };
delete ENV.GITHUB_ACTIONS;
delete ENV.GITHUB_OUTPUT;
delete ENV.GITHUB_STEP_SUMMARY;

function git(cwd, ...args) {
  const r = spawnSync('git', args, { cwd, env: ENV, encoding: 'utf8' });
  assert.equal(r.status, 0, `git ${args.join(' ')} : ${r.stderr}`);
  return r.stdout.trim();
}
const lock = (v) => `${JSON.stringify({ name: 'm', version: v, lockfileVersion: 3, requires: true, packages: { '': { name: 'm', version: v } } }, null, 2)}\n`;

let compteur = 0;
/** Un distant nu avec master et dev à `version` (0.1.25 : avant la 0.2.0), et deux clones : le développeur et le bot. */
function depot(version = '0.1.25') {
  const dossier = join(racine, `d${(compteur += 1)}`);
  const distant = join(dossier, 'distant.git');
  mkdirSync(dossier, { recursive: true });
  git(dossier, 'init', '--quiet', '--bare', '-b', 'master', distant);
  const dev = cloner(dossier, distant, 'humain');
  ecrire(dev, 'client/package.json', `${JSON.stringify({ name: 'm', version, private: true }, null, 2)}\n`);
  ecrire(dev, 'client/package-lock.json', lock(version));
  ecrire(dev, 'site.txt', 'ligne 1\nligne 2\nligne 3\n');
  git(dev, 'add', '-A');
  git(dev, 'commit', '--quiet', '-m', 'départ');
  git(dev, 'push', '--quiet', 'origin', 'master', 'master:dev');
  const bot = cloner(dossier, distant, 'bot');
  return { dossier, distant, dev, bot };
}
function cloner(dossier, distant, nom) {
  const c = join(dossier, nom);
  git(dossier, 'clone', '--quiet', distant, c);
  return c;
}
function ecrire(clone, fichier, texte) {
  mkdirSync(dirname(join(clone, fichier)), { recursive: true });
  writeFileSync(join(clone, fichier), texte);
}
/** Lit le distant tel qu'il est maintenant (le clone du développeur se met à jour d'abord). */
const distantDe = (d) => { git(d.dev, 'fetch', '--quiet', '--prune', 'origin'); return d.dev; };
const versionDistante = (d, ref) => JSON.parse(git(distantDe(d), 'show', `origin/${ref}:client/package.json`)).version;

/** Une branche de travail partie de `depuis`, avec un commit. */
function branche(d, nom, depuis, fichier = `${nom.replace('/', '-')}.txt`, texte = nom) {
  git(d.dev, 'fetch', '--quiet', 'origin');
  git(d.dev, 'checkout', '--quiet', '-B', nom, `origin/${depuis}`);
  ecrire(d.dev, fichier, texte);
  git(d.dev, 'add', '-A');
  git(d.dev, 'commit', '--quiet', '-m', `travail ${nom}`);
  git(d.dev, 'push', '--quiet', 'origin', nom);
  return git(d.dev, 'rev-parse', 'HEAD');
}
/** Le bouton « Merge » de GitHub : commit de fusion de la source dans la cible. */
function fusionner(d, source, cible) {
  git(d.dev, 'fetch', '--quiet', 'origin');
  git(d.dev, 'checkout', '--quiet', '-B', cible, `origin/${cible}`);
  git(d.dev, 'merge', '--quiet', '--no-ff', '-m', `Merge ${source} into ${cible}`, `origin/${source}`);
  git(d.dev, 'push', '--quiet', 'origin', cible);
}
function bot(d, ...args) {
  const r = spawnSync('node', [CLI, ...args], { cwd: d.bot, env: ENV, encoding: 'utf8' });
  return { code: r.status, out: r.stdout + r.stderr, json: r.stdout.startsWith('{') ? JSON.parse(r.stdout) : null };
}
/** Comme bot(), avec les sorties GitHub Actions ($GITHUB_OUTPUT) lues en retour. */
function botSorties(d, ...args) {
  const fichier = join(d.dossier, `sorties-${(compteur += 1)}`);
  writeFileSync(fichier, '');
  const r = spawnSync('node', [CLI, ...args], { cwd: d.bot, env: { ...ENV, GITHUB_OUTPUT: fichier }, encoding: 'utf8' });
  const sorties = Object.fromEntries(readFileSync(fichier, 'utf8').trim().split('\n').filter(Boolean).map((l) => l.split(/=(.*)/s).slice(0, 2)));
  return { code: r.status, out: r.stdout + r.stderr, sorties, json: r.stdout.startsWith('{') ? JSON.parse(r.stdout) : null };
}
/** Une feature de plus, fusionnée dans dev, et le passage du bot. */
function feature(d, nom) {
  branche(d, nom, 'dev');
  fusionner(d, nom, 'dev');
  const r = bot(d, 'appliquer', '--base', 'dev', '--head', nom, '--pousser');
  assert.equal(r.code, 0, r.out);
  return r;
}
/** Une livraison dev → master et le passage du bot. */
function livraison(d, ...options) {
  fusionner(d, 'dev', 'master');
  const r = bot(d, 'appliquer', '--base', 'master', '--head', 'dev', ...options, '--pousser');
  assert.equal(r.code, 0, r.out);
  return r;
}
const publie = (r) => r.json.livraisons.map((l) => [l.mode, l.tag, l.version]);
const tags = (d) => git(d.dev, 'ls-remote', '--tags', '--refs', 'origin').split('\n').filter(Boolean).map((l) => l.split('refs/tags/')[1]).sort();
/** Commit d'une étiquette du distant. */
const commitDe = (d, tag) => git(distantDe(d), 'rev-parse', `refs/tags/${tag}^{commit}`);

describe('le bot sur un vrai dépôt Git', () => {
  test('règle 7, avant la 0.2.0 : feature → dev incrémente le patch de dev, master inchangée, le site suit dev', () => {
    const d = depot();
    branche(d, 'feature/carte', 'dev');
    fusionner(d, 'feature/carte', 'dev');
    const r = bot(d, 'appliquer', '--base', 'dev', '--head', 'feature/carte', '--pr', '12', '--pousser');
    assert.equal(r.code, 0, r.out);
    assert.equal(versionDistante(d, 'dev'), '0.1.26');
    assert.equal(versionDistante(d, 'master'), '0.1.25');
    assert.equal(JSON.parse(git(distantDe(d), 'show', 'origin/dev:client/package-lock.json')).packages[''].version, '0.1.26');
    assert.deepEqual(publie(r), [['site', null, '0.1.26']]);
    assert.equal(r.json.livraisons[0].sha, git(distantDe(d), 'rev-parse', 'origin/dev'));
    assert.deepEqual(tags(d), ['V0.1.26'], 'avant la 0.2.0 : l\'étiquette de version seule, aucun installateur');
    assert.equal(commitDe(d, 'V0.1.26'), git(distantDe(d), 'rev-parse', 'origin/dev'), 'sur le commit qui porte la version');
    assert.deepEqual(r.json.etiquettes.map((e) => [e.branche, e.tag, e.version]), [['dev', 'V0.1.26', '0.1.26']]);
    assert.match(git(distantDe(d), 'log', '-1', '--format=%s', 'origin/dev'), /^chore: version v0\.1\.26 \(feature feature\/carte\) \(PR #12\)$/);
    assert.equal(r.json.aSupprimer, 'feature/carte');
  });

  test('sorties pour le workflow : site, installateurs, branche à supprimer (pas dev après une livraison)', () => {
    const d = depot();
    branche(d, 'feature/a', 'dev');
    fusionner(d, 'feature/a', 'dev');
    const f = botSorties(d, 'appliquer', '--base', 'dev', '--head', 'feature/a', '--pousser');
    assert.equal(f.code, 0, f.out);
    assert.deepEqual(f.sorties, { installateurs: '[]', site: git(distantDe(d), 'rev-parse', 'origin/dev'), a_supprimer: 'feature/a' });
    fusionner(d, 'dev', 'master');
    const l = botSorties(d, 'appliquer', '--base', 'master', '--head', 'dev', '--pousser');
    assert.equal(l.code, 0, l.out);
    assert.equal(l.sorties.a_supprimer, '');
  });

  test('règle 7, à partir de la 1.0 : installateur de test', () => {
    const d = depot('1.2.5');
    const r = feature(d, 'feature/carte');
    assert.equal(versionDistante(d, 'master'), '1.2.5');
    assert.deepEqual(publie(r), [['test', 'V1.2.6', '1.2.6']], 'l\'installateur de test sous l\'étiquette de version de dev');
    assert.deepEqual(tags(d), ['V1.2.6'], 'une seule étiquette : pas de « -test » à côté');
    assert.equal(commitDe(d, 'V1.2.6'), git(distantDe(d), 'rev-parse', 'origin/dev'));
    assert.equal(r.json.livraisons[0].sha, commitDe(d, 'V1.2.6'), 'l\'installateur est construit depuis le commit étiqueté');
  });

  test('sans --pousser, rien ne quitte le dépôt (essai à blanc)', () => {
    const d = depot('1.0.0');
    branche(d, 'feature/a', 'dev');
    fusionner(d, 'feature/a', 'dev');
    const r = bot(d, 'appliquer', '--base', 'dev', '--head', 'feature/a');
    assert.equal(r.code, 0, r.out);
    assert.equal(r.json.poussee, false);
    assert.equal(versionDistante(d, 'dev'), '1.0.0');
    assert.deepEqual(tags(d), []);
  });

  test('règle 4, première livraison 0.1.x → 0.2.0 : X.Y.Z → X.Y+1.0 sur les deux branches, dev = master, installateurs de production et de test', () => {
    const d = depot();
    feature(d, 'feature/a');
    feature(d, 'feature/b');
    assert.equal(versionDistante(d, 'dev'), '0.1.27');
    const r = livraison(d);
    assert.equal(versionDistante(d, 'master'), '0.2.0');
    assert.equal(versionDistante(d, 'dev'), '0.2.0');
    assert.equal(git(distantDe(d), 'rev-parse', 'origin/dev'), git(distantDe(d), 'rev-parse', 'origin/master'), 'avance rapide : dev rejoint master');
    assert.deepEqual(publie(r), [['prod', 'V0.2', '0.2.0'], ['test', 'V0.2.0', '0.2.0']], 'chaque installateur sous l\'étiquette de version de sa branche');
    assert.deepEqual(tags(d), ['V0.1.26', 'V0.1.27', 'V0.2', 'V0.2.0']);
    assert.deepEqual(r.json.etiquettes.map((e) => [e.branche, e.tag]), [['master', 'V0.2'], ['dev', 'V0.2.0']]);
    for (const t of ['V0.2', 'V0.2.0']) assert.equal(commitDe(d, t), git(distantDe(d), 'rev-parse', 'origin/master'), t);
  });

  test('règle 4, après la première version hébergée : installateurs de production et de test', () => {
    const d = depot('1.0.0');
    feature(d, 'feature/a');
    feature(d, 'feature/b');
    const r = livraison(d);
    assert.equal(versionDistante(d, 'master'), '1.1.0');
    assert.equal(versionDistante(d, 'dev'), '1.1.0');
    assert.deepEqual(publie(r), [['prod', 'V1.1', '1.1.0'], ['test', 'V1.1.0', '1.1.0']]);
    assert.deepEqual(tags(d), ['V1.0.1', 'V1.0.2', 'V1.1', 'V1.1.0']);
  });

  test('règle 5 : [V: X+1] dans le titre ou la description → X+1.0.0 ; la 1.0 ouvre les serveurs normal et de test', () => {
    const d = depot();
    const titre = join(d.dossier, 'titre.txt');
    const corps = join(d.dossier, 'corps.txt');
    writeFileSync(titre, 'Connexion Discord');
    writeFileSync(corps, 'Première version utilisée pour de vrai\n\n[V: X+1]\n');
    const r = livraison(d, '--texte-fichier', titre, '--texte-fichier', corps);
    assert.equal(r.json.majeure, true);
    assert.equal(versionDistante(d, 'master'), '1.0.0');
    assert.equal(versionDistante(d, 'dev'), '1.0.0');
    assert.deepEqual(publie(r), [['prod', 'V1.0', '1.0.0'], ['test', 'V1.0.0', '1.0.0']], 'plus de branche « site » : les installateurs prennent le relais');
    assert.deepEqual(tags(d), ['V1.0', 'V1.0.0']);
    const r2 = livraison(d, '--texte-fichier', corps);
    assert.equal(versionDistante(d, 'master'), '2.0.0');
    assert.deepEqual(publie(r2).map(([m, t]) => [m, t]), [['prod', 'V2.0'], ['test', 'V2.0.0']]);
  });

  test('livraison pendant qu\'une feature avance dev : conflit de version résolu, dev contient master', () => {
    const d = depot();
    feature(d, 'feature/a');
    fusionner(d, 'dev', 'master'); // livraison de 0.1.26…
    feature(d, 'feature/b'); // …mais une feature passe avant le bot
    assert.equal(versionDistante(d, 'dev'), '0.1.27');
    const r = bot(d, 'appliquer', '--base', 'master', '--head', 'dev', '--pousser');
    assert.equal(r.code, 0, r.out);
    assert.equal(versionDistante(d, 'master'), '0.2.0');
    assert.equal(versionDistante(d, 'dev'), '0.2.0');
    git(distantDe(d), 'merge-base', '--is-ancestor', 'origin/master', 'origin/dev');
    assert.equal(git(distantDe(d), 'show', 'origin/dev:feature-b.txt'), 'feature/b', 'le travail de dev est conservé');
    assert.notEqual(git(distantDe(d), 'rev-parse', 'origin/dev'), git(distantDe(d), 'rev-parse', 'origin/master'));
    assert.equal(commitDe(d, 'V0.2'), git(distantDe(d), 'rev-parse', 'origin/master'), 'chaque branche a l\'étiquette de sa version');
    assert.equal(commitDe(d, 'V0.2.0'), git(distantDe(d), 'rev-parse', 'origin/dev'));
  });

  test('règle 6, à partir de la 1.0 : hotfix → master inchangée, refusion dans dev puis patch de dev, installateurs', () => {
    const d = depot('1.0.0');
    livraison(d); // 1.1.0 partout, étiquette v1.1.0
    feature(d, 'feature/a'); // dev 1.1.1
    branche(d, 'hotfix/lien', 'master', 'site.txt', 'ligne 1 corrigée\nligne 2\nligne 3\n');
    fusionner(d, 'hotfix/lien', 'master');
    const masterAvant = git(distantDe(d), 'rev-parse', 'origin/master');
    const r = bot(d, 'appliquer', '--base', 'master', '--head', 'hotfix/lien', '--pr', '30', '--pousser');
    assert.equal(r.code, 0, r.out);
    assert.equal(git(distantDe(d), 'rev-parse', 'origin/master'), masterAvant, 'le bot ne touche pas master');
    assert.equal(versionDistante(d, 'master'), '1.1.0');
    assert.equal(versionDistante(d, 'dev'), '1.1.2');
    git(distantDe(d), 'merge-base', '--is-ancestor', 'origin/master', 'origin/dev');
    assert.match(git(distantDe(d), 'show', 'origin/dev:site.txt'), /corrigée/);
    assert.deepEqual(publie(r), [['prod', 'V1.1-hotfix.1', '1.1.0'], ['test', 'V1.1.2', '1.1.2']]);
    assert.equal(r.json.livraisons[0].sha, masterAvant);
    assert.deepEqual(r.json.etiquettes.map((e) => [e.branche, e.tag]), [['dev', 'V1.1.2']], 'master garde sa version, donc son étiquette');
    assert.equal(commitDe(d, 'V1.1.2'), git(distantDe(d), 'rev-parse', 'origin/dev'));

    // Second hotfix : nouvelle étiquette de production, même version.
    branche(d, 'hotfix/autre', 'master', 'autre.txt');
    fusionner(d, 'hotfix/autre', 'master');
    const r2 = bot(d, 'appliquer', '--base', 'master', '--head', 'hotfix/autre', '--pousser');
    assert.equal(r2.code, 0, r2.out);
    assert.equal(r2.json.livraisons[0].tag, 'V1.1-hotfix.2');
    assert.equal(versionDistante(d, 'dev'), '1.1.3');
  });

  test('règle 6, avant la 0.2.0 : même chose pour les versions, mais seul le site (dev) est republié', () => {
    const d = depot();
    feature(d, 'feature/a'); // dev 0.1.26
    branche(d, 'hotfix/lien', 'master', 'site.txt', 'ligne 1 corrigée\nligne 2\nligne 3\n');
    fusionner(d, 'hotfix/lien', 'master');
    const r = bot(d, 'appliquer', '--base', 'master', '--head', 'hotfix/lien', '--pousser');
    assert.equal(r.code, 0, r.out);
    assert.equal(versionDistante(d, 'master'), '0.1.25');
    assert.equal(versionDistante(d, 'dev'), '0.1.27');
    assert.deepEqual(publie(r), [['site', null, '0.1.27']]);
    assert.match(git(distantDe(d), 'show', 'origin/dev:site.txt'), /corrigée/, 'le correctif arrive sur le site par dev');
    assert.deepEqual(tags(d), ['V0.1.26', 'V0.1.27'], 'les étiquettes de version de dev seules');
  });

  test('hotfix en conflit avec dev : rien n\'est poussé, la marche à suivre est donnée', () => {
    const d = depot();
    branche(d, 'feature/a', 'dev', 'site.txt', 'ligne 1 version dev\nligne 2\nligne 3\n');
    fusionner(d, 'feature/a', 'dev');
    bot(d, 'appliquer', '--base', 'dev', '--head', 'feature/a', '--pousser');
    branche(d, 'hotfix/x', 'master', 'site.txt', 'ligne 1 version hotfix\nligne 2\nligne 3\n');
    fusionner(d, 'hotfix/x', 'master');
    const devAvant = git(distantDe(d), 'rev-parse', 'origin/dev');
    const tagsAvant = tags(d);
    const r = bot(d, 'appliquer', '--base', 'master', '--head', 'hotfix/x', '--pousser');
    assert.equal(r.code, 10, r.out);
    assert.match(r.out, /conflit \(site\.txt\).*feature\/<nom>/);
    assert.equal(git(distantDe(d), 'rev-parse', 'origin/dev'), devAvant);
    assert.deepEqual(tags(d), tagsAvant);
  });

  test('après la 1.0, un hotfix en conflit avec dev garde son installateur de production ; relancé, il ne le refait pas', () => {
    const d = depot('1.0.0');
    branche(d, 'feature/a', 'dev', 'site.txt', 'ligne 1 version dev\nligne 2\nligne 3\n');
    fusionner(d, 'feature/a', 'dev');
    bot(d, 'appliquer', '--base', 'dev', '--head', 'feature/a', '--pousser');
    branche(d, 'hotfix/x', 'master', 'site.txt', 'ligne 1 version hotfix\nligne 2\nligne 3\n');
    fusionner(d, 'hotfix/x', 'master');
    const devAvant = git(distantDe(d), 'rev-parse', 'origin/dev');
    const r = botSorties(d, 'appliquer', '--base', 'master', '--head', 'hotfix/x', '--pr', '41', '--pousser');
    assert.equal(r.code, 10, r.out);
    assert.equal(r.sorties.a_supprimer, '', 'la hotfix reste tant que sa refusion n\'est pas faite');
    assert.match(r.sorties.installateurs, /"tag":"V1\.0"/);
    assert.match(r.json.erreur, /conflit \(site\.txt\).*Create a merge commit/);
    assert.deepEqual(publie(r), [['prod', 'V1.0', '1.0.0']], 'règle 9 : le hotfix est livré même si la refusion attend');
    assert.ok(tags(d).includes('V1.0'));
    assert.equal(git(distantDe(d), 'rev-parse', 'origin/dev'), devAvant, 'dev n\'est pas touchée');

    const r2 = bot(d, 'appliquer', '--base', 'master', '--head', 'hotfix/x', '--pr', '41', '--pousser');
    assert.equal(r2.code, 10, r2.out);
    assert.deepEqual(publie(r2), [], 'pas de second installateur pour le même commit');
    assert.deepEqual(tags(d).filter((t) => modeDeEtiquette(t) === 'prod'), ['V1.0']);
  });

  test('une relance (Re-run) d\'un passage déjà fait ne refait pas l\'incrément', () => {
    const d = depot();
    fusionner(d, 'dev', 'master');
    assert.equal(bot(d, 'appliquer', '--base', 'master', '--head', 'dev', '--pr', '7', '--pousser').code, 0);
    assert.equal(versionDistante(d, 'master'), '0.2.0');
    const r = bot(d, 'appliquer', '--base', 'master', '--head', 'dev', '--pr', '7', '--pousser');
    assert.equal(r.code, 10, r.out);
    assert.match(r.out, /PR #7 a déjà été traitée/);
    assert.equal(versionDistante(d, 'master'), '0.2.0');
    assert.equal(versionDistante(d, 'dev'), '0.2.0');
  });

  test('deux fusions traitées en même temps : aucune n\'est perdue (la poussée atomique départage, le perdant recommence)', async () => {
    const d = depot();
    for (const n of ['feature/a', 'feature/b']) {
      branche(d, n, 'dev');
      fusionner(d, n, 'dev');
    }
    const clones = [cloner(d.dossier, d.distant, 'bot-a'), cloner(d.dossier, d.distant, 'bot-b')];
    const lancer = (cwd, head, pr) => new Promise((ok) => {
      const p = spawn('node', [CLI, 'appliquer', '--base', 'dev', '--head', head, '--pr', pr, '--pousser'], { cwd, env: ENV });
      let out = '';
      p.stdout.on('data', (b) => { out += b; });
      p.stderr.on('data', (b) => { out += b; });
      p.on('close', (code) => ok({ code, out }));
    });
    const [a, b] = await Promise.all([lancer(clones[0], 'feature/a', '1'), lancer(clones[1], 'feature/b', '2')]);
    assert.equal(a.code, 0, a.out);
    assert.equal(b.code, 0, b.out);
    assert.equal(versionDistante(d, 'dev'), '0.1.27', 'deux fusions, deux incréments');
  });

  test('étiquette de version déjà posée ailleurs : laissée telle quelle et signalée, la version passe quand même', () => {
    const d = depot();
    git(d.dev, 'push', '--quiet', 'origin', 'origin/master:refs/tags/V0.1.26'); // posée à la main sur un autre commit
    const ancien = commitDe(d, 'V0.1.26');
    const r = feature(d, 'feature/a');
    assert.equal(versionDistante(d, 'dev'), '0.1.26');
    assert.equal(commitDe(d, 'V0.1.26'), ancien, 'jamais déplacée');
    assert.deepEqual(r.json.etiquettes, []);
    assert.ok(r.json.journal.some((j) => /étiquette V0\.1\.26 déjà posée .* laissée telle quelle/.test(j)), r.json.journal.join('\n'));
    feature(d, 'feature/b');
    assert.equal(commitDe(d, 'V0.1.27'), git(distantDe(d), 'rev-parse', 'origin/dev'), 'la suivante est posée normalement');
  });

  test('étiquette de version déjà posée ailleurs, serveurs hébergés : l\'installateur de test n\'est pas publié sous elle', () => {
    const d = depot('1.0.0');
    git(d.dev, 'push', '--quiet', 'origin', 'origin/master:refs/tags/V1.0.1'); // posée à la main sur un autre commit
    const ancien = commitDe(d, 'V1.0.1');
    const r = feature(d, 'feature/a');
    assert.equal(versionDistante(d, 'dev'), '1.0.1');
    assert.equal(commitDe(d, 'V1.0.1'), ancien, 'jamais déplacée');
    assert.deepEqual(publie(r), [['test', 'V1.0.1-rebuild.1', '1.0.1']], 'une étiquette qui désigne un autre commit ne porte pas l\'installateur');
    assert.equal(commitDe(d, 'V1.0.1-rebuild.1'), git(distantDe(d), 'rev-parse', 'origin/dev'));
  });

  test('fusion hors des règles : refusée, aucune version', () => {
    const d = depot();
    const r = bot(d, 'appliquer', '--base', 'master', '--head', 'claude/x', '--pousser');
    assert.equal(r.code, 10);
    assert.match(r.out, /hors des règles/);
  });

  test('régénération, avant la 0.2.0 : le site depuis dev ; master n\'a pas de serveur', () => {
    const d = depot();
    const r = bot(d, 'regenerer', '--branche', 'dev', '--pousser');
    assert.equal(r.code, 0, r.out);
    assert.deepEqual(publie(r), [['site', null, '0.1.25']]);
    const m = bot(d, 'regenerer', '--branche', 'master', '--pousser');
    assert.equal(m.code, 10);
    assert.match(m.out, /avant la 0\.2\.0, master n'a pas de serveur/);
    assert.deepEqual(tags(d), []);
  });

  test('régénération, à partir de la 1.0 : nouvelle étiquette sans changer la version', () => {
    const d = depot('1.0.0');
    const r1 = bot(d, 'regenerer', '--branche', 'master', '--pousser');
    assert.equal(r1.code, 0, r1.out);
    assert.equal(r1.json.livraisons[0].tag, 'V1.0');
    const r2 = bot(d, 'regenerer', '--branche', 'master', '--pousser');
    assert.equal(r2.json.livraisons[0].tag, 'V1.0-rebuild.1');
    assert.equal(bot(d, 'regenerer', '--branche', 'dev', '--pousser').json.livraisons[0].tag, 'V1.0.0');
    assert.equal(bot(d, 'regenerer', '--branche', 'dev', '--pousser').json.livraisons[0].tag, 'V1.0.0-rebuild.1');
    assert.deepEqual(r2.json.etiquettes, [], 'pas de nouvelle version, pas d\'étiquette de version');
    assert.equal(versionDistante(d, 'master'), '1.0.0');
  });

  test('mise en place : tant que master et dev n\'existent pas toutes les deux, la garde ne vérifie rien', () => {
    const d = depot();
    git(d.dev, 'push', '--quiet', 'origin', '--delete', 'dev');
    git(d.bot, 'fetch', '--quiet', '--prune', 'origin');
    const r = bot(d, 'verifier-creation', '--branche', 'dev/session', '--sha', git(d.dev, 'rev-parse', 'HEAD'));
    assert.equal(r.code, 0, r.out);
    assert.match(r.out, /pas encore en place \(dev absente\)/);
  });

  test('balayage : nom interdit et fusionnée → supprimée ; travail non fusionné ou mauvais départ → signalée, gardée', () => {
    const d = depot();
    const branchesDistantes = () => git(distantDe(d), 'ls-remote', '--heads', 'origin').split('\n').map((l) => l.split('refs/heads/')[1]).sort();
    feature(d, 'feature/a'); // dev a maintenant des commits absents de master
    git(d.dev, 'push', '--quiet', 'origin', 'origin/master:refs/heads/develop'); // ancienne branche, tout son contenu est dans master
    branche(d, 'claude/session', 'dev'); // nom interdit, avec du travail
    branche(d, 'feature/ok', 'dev');
    branche(d, 'hotfix/depuis-dev', 'dev'); // contient dev
    git(d.dev, 'checkout', '--quiet', '--orphan', 'publication');
    git(d.dev, 'commit', '--quiet', '--allow-empty', '-m', 'site construit');
    git(d.dev, 'push', '--quiet', 'origin', 'publication:site');

    const r = bot(d, 'balayer', '--pousser');
    assert.equal(r.code, 10, r.out);
    assert.match(r.out, /develop : supprimée/);
    assert.match(r.out, /claude\/session : signalée \(nom interdit, mais elle contient du travail/);
    assert.match(r.out, /hotfix\/depuis-dev : signalée \(hotfix\/<nom> doit partir de master/);
    assert.doesNotMatch(r.out, /^- (feature\/a|feature\/ok|site|master|dev) :/m, 'les branches conformes ne sont pas citées');
    assert.deepEqual(branchesDistantes(), ['claude/session', 'dev', 'feature/a', 'feature/ok', 'hotfix/depuis-dev', 'master', 'site'].sort());

    git(d.dev, 'push', '--quiet', 'origin', '--delete', 'claude/session', 'hotfix/depuis-dev');
    const propre = bot(d, 'balayer', '--pousser');
    assert.equal(propre.code, 0, propre.out);
    assert.match(propre.out, /Toutes les branches sont conformes/);
  });

  test('balayage : noms complets (« x/HEAD » n\'est pas « x »), une suppression refusée n\'empêche pas les autres', () => {
    const d = depot();
    const branchesDistantes = () => git(distantDe(d), 'ls-remote', '--heads', 'origin').split('\n').map((l) => l.split('refs/heads/')[1]).sort();
    for (const b of ['vieux/HEAD', 'bloquee', 'autre-vieille']) git(d.dev, 'push', '--quiet', 'origin', `origin/master:refs/heads/${b}`);
    // Le serveur refuse de supprimer « bloquee » (comme une protection ou une panne réseau).
    writeFileSync(join(d.distant, 'hooks', 'pre-receive'), '#!/bin/sh\nwhile read ancien nouveau ref; do\n  if [ "$ref" = refs/heads/bloquee ]; then echo "suppression interdite" >&2; exit 1; fi\ndone\n');
    chmodSync(join(d.distant, 'hooks', 'pre-receive'), 0o755);
    const r = bot(d, 'balayer', '--pousser');
    assert.equal(r.code, 10, r.out);
    assert.match(r.out, /^- vieux\/HEAD : supprimée/m);
    assert.match(r.out, /^- autre-vieille : supprimée/m);
    assert.match(r.out, /^- bloquee : signalée \(suppression refusée/m);
    assert.deepEqual(branchesDistantes(), ['bloquee', 'dev', 'master']);
  });

  test('suppression après la fusion : seulement si la branche pointe encore sur le commit fusionné', () => {
    const d = depot();
    const existe = (b) => git(distantDe(d), 'ls-remote', '--heads', 'origin').split('\n').some((l) => l.endsWith(`refs/heads/${b}`));
    const sha = branche(d, 'feature/finie', 'dev');
    let r = bot(d, 'supprimer-fusionnee', '--branche', 'feature/finie', '--sha', sha, '--pousser');
    assert.equal(r.code, 0, r.out);
    assert.match(r.out, /supprimée/);
    assert.ok(!existe('feature/finie'));
    r = bot(d, 'supprimer-fusionnee', '--branche', 'feature/finie', '--sha', sha, '--pousser');
    assert.match(r.out, /déjà supprimée/);

    // Un commit poussé après la fusion : la branche est gardée.
    const fusionne = branche(d, 'feature/suite', 'dev');
    ecrire(d.dev, 'suite.txt', 'travail après la fusion');
    git(d.dev, 'add', '-A');
    git(d.dev, 'commit', '--quiet', '-m', 'suite');
    git(d.dev, 'push', '--quiet', 'origin', 'feature/suite');
    r = bot(d, 'supprimer-fusionnee', '--branche', 'feature/suite', '--sha', fusionne, '--pousser');
    assert.equal(r.code, 0, r.out);
    assert.match(r.out, /a reçu des commits après la fusion .* gardée/);
    assert.ok(existe('feature/suite'));

    // « # » dans le nom : c'est bien cette branche qui est supprimée, pas « feature/a ».
    const shaA = branche(d, 'feature/a', 'dev');
    const shaDiese = branche(d, 'feature/a#b', 'dev', 'diese.txt');
    assert.notEqual(shaA, shaDiese);
    r = bot(d, 'supprimer-fusionnee', '--branche', 'feature/a#b', '--sha', shaDiese, '--pousser');
    assert.equal(r.code, 0, r.out);
    assert.ok(!existe('feature/a#b'));
    assert.ok(existe('feature/a'), 'l\'autre branche est intacte');

    for (const b of ['dev', 'master', 'site', 'develop']) {
      const refus = bot(d, 'supprimer-fusionnee', '--branche', b, '--sha', sha, '--pousser');
      assert.equal(refus.code, 10, `${b} : ${refus.out}`);
    }
    assert.ok(existe('dev') && existe('master'));
  });

  test('balayage : rien tant que le flux n\'est pas en place', () => {
    const d = depot();
    git(d.dev, 'push', '--quiet', 'origin', '--delete', 'dev');
    git(d.dev, 'push', '--quiet', 'origin', 'origin/master:refs/heads/develop');
    const r = bot(d, 'balayer', '--pousser');
    assert.equal(r.code, 0, r.out);
    assert.match(r.out, /pas encore en place \(dev absente\)/);
    assert.match(git(distantDe(d), 'ls-remote', '--heads', 'origin'), /refs\/heads\/develop/);
  });

  test('règles 2 et 3 à la création : nom et point de départ', () => {
    const d = depot();
    fusionner(d, 'dev', 'master');
    bot(d, 'appliquer', '--base', 'master', '--head', 'dev', '--pousser');
    branche(d, 'feature/avance', 'dev'); // dev a maintenant des commits absents de master
    fusionner(d, 'feature/avance', 'dev');
    git(d.bot, 'fetch', '--quiet', 'origin');
    const verifier = (nom, sha) => bot(d, 'verifier-creation', '--branche', nom, '--sha', sha);
    const shaDev = git(distantDe(d), 'rev-parse', 'origin/dev');
    const shaMaster = git(distantDe(d), 'rev-parse', 'origin/master');

    assert.equal(verifier('feature/ok', shaDev).code, 0);
    assert.equal(verifier('hotfix/ok', shaMaster).code, 0);
    assert.equal(verifier('master', shaMaster).code, 0);
    const nom = verifier('dev/session', shaDev);
    assert.equal(nom.code, 10);
    assert.match(nom.out, /nom de branche interdit/);
    const hotfixDepuisDev = verifier('hotfix/mauvais', shaDev);
    assert.equal(hotfixDepuisDev.code, 10);
    assert.match(hotfixDepuisDev.out, /doit partir de master.*de dev absent/);

    // Une feature avec ses propres commits (créée puis poussée avec un commit) reste conforme.
    const shaFeature = branche(d, 'feature/avec-commit', 'dev');
    git(d.bot, 'fetch', '--quiet', 'origin');
    assert.equal(verifier('feature/avec-commit', shaFeature).code, 0);
    // Une feature créée depuis une hotfix en cours ne l'est pas.
    const shaHotfix = branche(d, 'hotfix/en-cours', 'master');
    git(d.dev, 'checkout', '--quiet', '-B', 'feature/depuis-hotfix', shaHotfix);
    git(d.dev, 'push', '--quiet', 'origin', 'feature/depuis-hotfix');
    git(d.bot, 'fetch', '--quiet', 'origin');
    const r = verifier('feature/depuis-hotfix', shaHotfix);
    assert.equal(r.code, 10);
    assert.match(r.out, /doit partir de dev.*hotfix\/en-cours/);
  });

  test('contrôle des PR : source, point de départ, version, synchronisation avant livraison', () => {
    const d = depot();
    const pr = (base, head, sha, ...extra) => {
      git(d.bot, 'fetch', '--quiet', 'origin');
      return bot(d, 'verifier-pr', '--base', base, '--head', head, '--sha', sha, ...extra);
    };
    const f = branche(d, 'feature/ok', 'dev');
    assert.equal(pr('dev', 'feature/ok', f).code, 0);
    assert.equal(pr('master', 'feature/ok', f).code, 10, 'une feature ne va pas dans master');
    assert.equal(pr('dev', 'feature/ok', f, '--depot-source', 'autre/copie', '--depot', 'o/r').code, 10);
    assert.equal(pr('dev', 'feature/ok', f, '--depot-source', 'O/R', '--depot', 'o/r').code, 0);

    git(d.dev, 'checkout', '--quiet', 'feature/ok');
    ecrire(d.dev, 'client/package.json', `${JSON.stringify({ name: 'm', version: '0.1.99', private: true }, null, 2)}\n`);
    git(d.dev, 'commit', '--quiet', '-am', 'version à la main');
    git(d.dev, 'push', '--quiet', 'origin', 'feature/ok');
    const v = pr('dev', 'feature/ok', git(d.dev, 'rev-parse', 'HEAD'));
    assert.equal(v.code, 10);
    assert.match(v.out, /tenue par le bot/);

    // Hotfix fusionnée dans master mais pas encore dans dev : la livraison attend la synchronisation.
    branche(d, 'hotfix/x', 'master');
    fusionner(d, 'hotfix/x', 'master');
    const l = pr('master', 'dev', git(distantDe(d), 'rev-parse', 'origin/dev'));
    assert.equal(l.code, 10);
    assert.match(l.out, /refusionnez d'abord master dans dev/);

    // Refusion à la main (ce que fait une feature quand celle du bot est en conflit) : une feature qui contient master est permise,
    // à la création comme en PR, même si la branche hotfix/x existe encore.
    git(d.dev, 'checkout', '--quiet', '-B', 'feature/refusion', 'origin/dev');
    git(d.dev, 'merge', '--quiet', '--no-ff', '-m', 'Fusionner master', 'origin/master');
    git(d.dev, 'push', '--quiet', 'origin', 'feature/refusion');
    const shaRefusion = git(d.dev, 'rev-parse', 'HEAD');
    assert.equal(pr('dev', 'feature/refusion', shaRefusion).code, 0);
    assert.equal(bot(d, 'verifier-creation', '--branche', 'feature/refusion', '--sha', shaRefusion).code, 0);
    // Une hotfix qui contiendrait dev, elle, est refusée.
    git(d.dev, 'checkout', '--quiet', '-B', 'hotfix/avec-dev', 'origin/master');
    git(d.dev, 'merge', '--quiet', '--no-ff', '-m', 'Fusionner dev', 'origin/feature/ok');
    git(d.dev, 'push', '--quiet', 'origin', 'hotfix/avec-dev');
    const h = pr('master', 'hotfix/avec-dev', git(d.dev, 'rev-parse', 'HEAD'));
    assert.equal(h.code, 10);
    assert.match(h.out, /doit partir de master/);

    bot(d, 'appliquer', '--base', 'master', '--head', 'hotfix/x', '--pousser');
    assert.equal(pr('master', 'dev', git(distantDe(d), 'rev-parse', 'origin/dev')).code, 0);
  });
});
