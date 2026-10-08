// Flux Git (docs/flux-git.md) : règles pures de tools/flux-git/regles.mjs, puis le bot (tools/flux-git/cli.mjs) rejoué sur de vrais
// dépôts Git temporaires (un dépôt « distant » nu + des clones), sans GitHub : feature → dev, livraison dev → master (mineure, majeure),
// hotfix → master avec refusion dans dev, conflits, contrôles des créations de branches et des PR.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  comparerVersions, demandeMajeure, etiquette, familleDe, incrementer, modeDeEtiquette, planifier, poserVersionJson,
  typeDeFusion, verifierCreation, verifierPR,
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
    for (const nom of ['feature/', 'hotfix/', 'feature', 'develop', 'main', 'dev/x', 'claude/x', 'features/x', 'Feature/x', 'site', 'feature/x/']) {
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
      { master: null, dev: { version: '0.1.28', synchroniser: false }, livrer: ['test'] });
    assert.deepEqual(planifier({ type: 'livraison', versionMaster: '0.1.27', versionDev: '0.1.27' }),
      { master: { version: '0.2.0' }, dev: { version: '0.2.0', synchroniser: true }, livrer: ['prod', 'test'] });
    assert.deepEqual(planifier({ type: 'livraison', versionMaster: '0.1.27', versionDev: '0.1.27', majeure: true }).master, { version: '1.0.0' });
    assert.equal(planifier({ type: 'livraison', versionMaster: '0.1.27', versionDev: '0.1.29' }).dev.version, '0.2.0', 'jamais en arrière');
    assert.deepEqual(planifier({ type: 'hotfix', versionMaster: '0.2.0', versionDev: '0.2.3' }),
      { master: null, dev: { version: '0.2.4', synchroniser: true }, livrer: ['prod', 'test'] });
    assert.throws(() => planifier({ type: 'autre', versionMaster: '0.1.0', versionDev: '0.1.0' }), /inconnu/);
  });

  test('étiquettes uniques des installateurs', () => {
    assert.equal(etiquette({ mode: 'prod', version: '0.2.0' }), 'v0.2.0');
    assert.equal(etiquette({ mode: 'test', version: '0.2.3' }), 'v0.2.3-test');
    assert.equal(etiquette({ mode: 'prod', version: '0.2.0', existantes: ['v0.2.0'], motif: 'hotfix' }), 'v0.2.0-hotfix.1');
    assert.equal(etiquette({ mode: 'prod', version: '0.2.0', existantes: ['v0.2.0', 'v0.2.0-hotfix.1'] }), 'v0.2.0-hotfix.2');
    assert.equal(etiquette({ mode: 'test', version: '0.2.3', existantes: ['v0.2.3-test'] }), 'v0.2.3-test-rebuild.1');
    assert.throws(() => etiquette({ mode: 'preprod', version: '0.2.3' }), /mode inconnu/);
    assert.equal(modeDeEtiquette('v0.2.3-test'), 'test');
    assert.equal(modeDeEtiquette('v0.2.3-test-rebuild.1'), 'test');
    assert.equal(modeDeEtiquette('v0.2.0-hotfix.1'), 'prod');
  });

  test('mode du site construit : serveur de test marqué, étiquette de la livraison', () => {
    assert.deepEqual(modeDuSite({}, '0.2.0'), { test: false, etiquette: 'v0.2.0' });
    assert.deepEqual(modeDuSite({ SITE_MODE: 'prod', SITE_TAG: 'v0.2.0-hotfix.1' }, '0.2.0'), { test: false, etiquette: 'v0.2.0-hotfix.1' });
    assert.deepEqual(modeDuSite({ SITE_MODE: 'test', SITE_TAG: 'v0.2.3-test' }, '0.2.3'), { test: true, etiquette: 'v0.2.3-test' });
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
/** Un distant nu avec master et dev en 0.1.25, et un clone de travail (le « développeur »). */
function depot() {
  const dossier = join(racine, `d${(compteur += 1)}`);
  const distant = join(dossier, 'distant.git');
  mkdirSync(dossier, { recursive: true });
  git(dossier, 'init', '--quiet', '--bare', '-b', 'master', distant);
  const dev = cloner(dossier, distant, 'humain');
  ecrire(dev, 'client/package.json', `${JSON.stringify({ name: 'm', version: '0.1.25', private: true }, null, 2)}\n`);
  ecrire(dev, 'client/package-lock.json', lock('0.1.25'));
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
const lire = (clone, fichier) => readFileSync(join(clone, fichier), 'utf8');
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
  return { code: r.status, out: r.stdout + r.stderr, json: r.status === 0 && r.stdout.startsWith('{') ? JSON.parse(r.stdout) : null };
}
const tags = (d) => git(d.dev, 'ls-remote', '--tags', '--refs', 'origin').split('\n').filter(Boolean).map((l) => l.split('refs/tags/')[1]).sort();

describe('le bot sur un vrai dépôt Git', () => {
  test('règle 7 : feature → dev incrémente le patch de dev, master inchangée, installateur de test', () => {
    const d = depot();
    branche(d, 'feature/carte', 'dev');
    fusionner(d, 'feature/carte', 'dev');
    const r = bot(d, 'appliquer', '--base', 'dev', '--head', 'feature/carte', '--pr', '12', '--pousser');
    assert.equal(r.code, 0, r.out);
    assert.equal(versionDistante(d, 'dev'), '0.1.26');
    assert.equal(versionDistante(d, 'master'), '0.1.25');
    assert.equal(JSON.parse(git(distantDe(d), 'show', 'origin/dev:client/package-lock.json')).packages[''].version, '0.1.26');
    assert.deepEqual(r.json.livraisons.map((l) => [l.mode, l.tag, l.version]), [['test', 'v0.1.26-test', '0.1.26']]);
    assert.equal(r.json.livraisons[0].sha, git(distantDe(d), 'rev-parse', 'origin/dev'));
    assert.deepEqual(tags(d), ['v0.1.26-test']);
    assert.match(git(distantDe(d), 'log', '-1', '--format=%s', 'origin/dev'), /^chore: version v0\.1\.26 \(feature feature\/carte\) \(PR #12\)$/);
  });

  test('sans --pousser, rien ne quitte le dépôt (essai à blanc)', () => {
    const d = depot();
    branche(d, 'feature/a', 'dev');
    fusionner(d, 'feature/a', 'dev');
    const r = bot(d, 'appliquer', '--base', 'dev', '--head', 'feature/a');
    assert.equal(r.code, 0, r.out);
    assert.equal(r.json.poussee, false);
    assert.equal(versionDistante(d, 'dev'), '0.1.25');
    assert.deepEqual(tags(d), []);
  });

  test('règle 4 : livraison dev → master, X.Y.Z → X.Y+1.0 sur les deux branches, dev = master', () => {
    const d = depot();
    for (const n of ['feature/a', 'feature/b']) {
      branche(d, n, 'dev');
      fusionner(d, n, 'dev');
      assert.equal(bot(d, 'appliquer', '--base', 'dev', '--head', n, '--pousser').code, 0);
    }
    assert.equal(versionDistante(d, 'dev'), '0.1.27');
    fusionner(d, 'dev', 'master');
    const r = bot(d, 'appliquer', '--base', 'master', '--head', 'dev', '--pousser');
    assert.equal(r.code, 0, r.out);
    assert.equal(versionDistante(d, 'master'), '0.2.0');
    assert.equal(versionDistante(d, 'dev'), '0.2.0');
    assert.equal(git(distantDe(d), 'rev-parse', 'origin/dev'), git(distantDe(d), 'rev-parse', 'origin/master'), 'avance rapide : dev rejoint master');
    assert.deepEqual(r.json.livraisons.map((l) => [l.mode, l.tag]), [['prod', 'v0.2.0'], ['test', 'v0.2.0-test']]);
  });

  test('règle 5 : [V: X+1] dans le titre ou la description de la livraison → X+1.0.0', () => {
    const d = depot();
    fusionner(d, 'dev', 'master');
    const titre = join(d.dossier, 'titre.txt');
    const corps = join(d.dossier, 'corps.txt');
    writeFileSync(titre, 'Livraison de printemps');
    writeFileSync(corps, 'Refonte complète\n\n[V: X+1]\n');
    const r = bot(d, 'appliquer', '--base', 'master', '--head', 'dev', '--texte-fichier', titre, '--texte-fichier', corps, '--pousser');
    assert.equal(r.code, 0, r.out);
    assert.equal(r.json.majeure, true);
    assert.equal(versionDistante(d, 'master'), '1.0.0');
    assert.equal(versionDistante(d, 'dev'), '1.0.0');
    assert.deepEqual(tags(d), ['v1.0.0', 'v1.0.0-test']);
  });

  test('livraison pendant qu\'une feature avance dev : conflit de version résolu, dev contient master', () => {
    const d = depot();
    branche(d, 'feature/a', 'dev');
    fusionner(d, 'feature/a', 'dev');
    bot(d, 'appliquer', '--base', 'dev', '--head', 'feature/a', '--pousser');
    fusionner(d, 'dev', 'master'); // livraison de 0.1.26…
    branche(d, 'feature/b', 'dev'); // …mais une feature passe avant le bot
    fusionner(d, 'feature/b', 'dev');
    assert.equal(bot(d, 'appliquer', '--base', 'dev', '--head', 'feature/b', '--pousser').code, 0);
    assert.equal(versionDistante(d, 'dev'), '0.1.27');
    const r = bot(d, 'appliquer', '--base', 'master', '--head', 'dev', '--pousser');
    assert.equal(r.code, 0, r.out);
    assert.equal(versionDistante(d, 'master'), '0.2.0');
    assert.equal(versionDistante(d, 'dev'), '0.2.0');
    git(distantDe(d), 'merge-base', '--is-ancestor', 'origin/master', 'origin/dev');
    assert.equal(git(distantDe(d), 'show', 'origin/dev:feature-b.txt'), 'feature/b', 'le travail de dev est conservé');
  });

  test('règle 6 : hotfix → master, master inchangée, refusion dans dev puis patch de dev', () => {
    const d = depot();
    fusionner(d, 'dev', 'master');
    bot(d, 'appliquer', '--base', 'master', '--head', 'dev', '--pousser'); // 0.2.0 partout, étiquette v0.2.0
    branche(d, 'feature/a', 'dev');
    fusionner(d, 'feature/a', 'dev');
    bot(d, 'appliquer', '--base', 'dev', '--head', 'feature/a', '--pousser'); // dev 0.2.1
    branche(d, 'hotfix/lien', 'master', 'site.txt', 'ligne 1 corrigée\nligne 2\nligne 3\n');
    fusionner(d, 'hotfix/lien', 'master');
    const masterAvant = git(distantDe(d), 'rev-parse', 'origin/master');
    const r = bot(d, 'appliquer', '--base', 'master', '--head', 'hotfix/lien', '--pr', '30', '--pousser');
    assert.equal(r.code, 0, r.out);
    assert.equal(git(distantDe(d), 'rev-parse', 'origin/master'), masterAvant, 'le bot ne touche pas master');
    assert.equal(versionDistante(d, 'master'), '0.2.0');
    assert.equal(versionDistante(d, 'dev'), '0.2.2');
    git(distantDe(d), 'merge-base', '--is-ancestor', 'origin/master', 'origin/dev');
    assert.match(git(distantDe(d), 'show', 'origin/dev:site.txt'), /corrigée/);
    assert.deepEqual(r.json.livraisons.map((l) => [l.mode, l.tag]), [['prod', 'v0.2.0-hotfix.1'], ['test', 'v0.2.2-test']]);
    assert.equal(r.json.livraisons[0].sha, masterAvant);

    // Second hotfix : nouvelle étiquette de production, même version.
    branche(d, 'hotfix/autre', 'master', 'autre.txt');
    fusionner(d, 'hotfix/autre', 'master');
    const r2 = bot(d, 'appliquer', '--base', 'master', '--head', 'hotfix/autre', '--pousser');
    assert.equal(r2.code, 0, r2.out);
    assert.equal(r2.json.livraisons[0].tag, 'v0.2.0-hotfix.2');
    assert.equal(versionDistante(d, 'dev'), '0.2.3');
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
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, /conflit \(site\.txt\).*feature\/<nom>/);
    assert.equal(git(distantDe(d), 'rev-parse', 'origin/dev'), devAvant);
    assert.deepEqual(tags(d), tagsAvant);
  });

  test('fusion hors des règles : refusée, aucune version', () => {
    const d = depot();
    const r = bot(d, 'appliquer', '--base', 'master', '--head', 'claude/x', '--pousser');
    assert.equal(r.code, 1);
    assert.match(r.out, /hors des règles/);
  });

  test('régénération : nouvelle étiquette sans changer la version', () => {
    const d = depot();
    const r1 = bot(d, 'regenerer', '--branche', 'master', '--pousser');
    assert.equal(r1.code, 0, r1.out);
    assert.equal(r1.json.livraisons[0].tag, 'v0.1.25');
    const r2 = bot(d, 'regenerer', '--branche', 'master', '--pousser');
    assert.equal(r2.json.livraisons[0].tag, 'v0.1.25-rebuild.1');
    assert.equal(bot(d, 'regenerer', '--branche', 'dev', '--pousser').json.livraisons[0].tag, 'v0.1.25-test');
    assert.equal(versionDistante(d, 'master'), '0.1.25');
  });

  test('mise en place : tant que master et dev n\'existent pas toutes les deux, la garde ne vérifie rien', () => {
    const d = depot();
    git(d.dev, 'push', '--quiet', 'origin', '--delete', 'dev');
    git(d.bot, 'fetch', '--quiet', '--prune', 'origin');
    const r = bot(d, 'verifier-creation', '--branche', 'dev/session', '--sha', git(d.dev, 'rev-parse', 'HEAD'));
    assert.equal(r.code, 0, r.out);
    assert.match(r.out, /pas encore en place \(dev absente\)/);
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
    assert.equal(nom.code, 1);
    assert.match(nom.out, /nom de branche interdit/);
    const hotfixDepuisDev = verifier('hotfix/mauvais', shaDev);
    assert.equal(hotfixDepuisDev.code, 1);
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
    assert.equal(r.code, 1);
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
    assert.equal(pr('master', 'feature/ok', f).code, 1, 'une feature ne va pas dans master');
    assert.equal(pr('dev', 'feature/ok', f, '--depot-source', 'autre/copie', '--depot', 'o/r').code, 1);
    assert.equal(pr('dev', 'feature/ok', f, '--depot-source', 'O/R', '--depot', 'o/r').code, 0);

    git(d.dev, 'checkout', '--quiet', 'feature/ok');
    ecrire(d.dev, 'client/package.json', `${JSON.stringify({ name: 'm', version: '0.1.99', private: true }, null, 2)}\n`);
    git(d.dev, 'commit', '--quiet', '-am', 'version à la main');
    git(d.dev, 'push', '--quiet', 'origin', 'feature/ok');
    const v = pr('dev', 'feature/ok', git(d.dev, 'rev-parse', 'HEAD'));
    assert.equal(v.code, 1);
    assert.match(v.out, /tenue par le bot/);

    // Hotfix fusionnée dans master mais pas encore dans dev : la livraison attend la synchronisation.
    branche(d, 'hotfix/x', 'master');
    fusionner(d, 'hotfix/x', 'master');
    const l = pr('master', 'dev', git(distantDe(d), 'rev-parse', 'origin/dev'));
    assert.equal(l.code, 1);
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
    assert.equal(h.code, 1);
    assert.match(h.out, /doit partir de master/);

    bot(d, 'appliquer', '--base', 'master', '--head', 'hotfix/x', '--pousser');
    assert.equal(pr('master', 'dev', git(distantDe(d), 'rev-parse', 'origin/dev')).code, 0);
  });
});
