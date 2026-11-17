// État d'une branche (tools/flux-git/etat-branche.mjs ; docs/flux-git.md) : règles pures de tools/flux-git/etat-regles.mjs (classement d'un conflit
// selon la table du skill resoudre-un-conflit, migrations à renuméroter, refusion), puis le script rejoué sur un dépôt Git jetable (avant le
// rebase, rebase en conflit, refusion, distante en avance). Le script ne modifie jamais le dépôt.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  ajoutsSeuls, brancheDeRefusion, classerConflit, conseilDeRebase, etatDeLaDistante, migrationsARenumeroter, NATURES,
} from '../../tools/flux-git/etat-regles.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';

const SCRIPT = fileURLToPath(new URL('../../tools/flux-git/etat-branche.mjs', import.meta.url));

describe('règles pures', () => {
  test('ajouts seuls : les lignes de la base restent dans l\'ordre', () => {
    assert.ok(ajoutsSeuls('a\nb\n', 'a\nx\nb\ny\n'));
    assert.ok(!ajoutsSeuls('a\nb\n', 'b\na\n'));
    assert.ok(!ajoutsSeuls('a\nb\n', 'a\nB\n'));
  });

  test('classement : chaque nature de la table du skill resoudre-un-conflit', () => {
    const nature = (x) => classerConflit(x).nature;
    assert.equal(nature({ chemin: 'data/rows/sort.sql', base: 'a', nous: 'a\nb', eux: 'a\nc' }), 'outil', 'même un ajout des deux côtés');
    assert.equal(nature({ chemin: 'docs/sql/structure.md' }), 'outil');
    assert.equal(nature({ chemin: 'docs/sql/apercu.md' }), 'outil');
    assert.equal(nature({ chemin: 'data/schema.sql', base: 'a', nous: 'a\nb', eux: 'a\nc' }), 'schema');
    assert.equal(nature({ chemin: 'data/migrations/0080-x.json' }), 'migration');
    assert.equal(nature({ chemin: 'client/package-lock.json' }), 'version-verrou');
    const pkg = (version, deps) => `{\n  "name": "m",\n  "version": "${version}",\n  "dependencies": {${deps}}\n}\n`;
    assert.equal(nature({ chemin: 'client/package.json', base: pkg('0.1.0', ''), nous: pkg('0.1.1', ''), eux: pkg('0.1.0-x', '') }), 'version-verrou');
    assert.equal(nature({ chemin: 'client/package.json', base: pkg('0.1.0', ''), nous: pkg('0.1.1', '"a": "1"'), eux: pkg('0.1.0', '"b": "1"') }), 'dependances');
    assert.equal(nature({ chemin: 'client/package.json' }), 'dependances', 'sans les trois versions : le plus prudent des deux');
    assert.equal(nature({ chemin: 'docs/serveur.md', base: 'a\n', nous: 'a\nb\n', eux: 'a\nc\n' }), 'mecanique');
    assert.equal(nature({ chemin: 'client/src/lib/x.mjs', base: 'a\n', nous: 'b\n', eux: 'c\n' }), 'sens');
    assert.equal(nature({ chemin: 'client/src/lib/x.mjs', base: null, nous: 'b\n', eux: 'c\n' }), 'sens', 'ajouté des deux côtés');
    assert.equal(nature({ chemin: 'client/src/lib/x.mjs', base: 'a\n', nous: null, eux: 'a\nb\n' }), 'sens', 'supprimé d\'un côté');
    assert.equal(classerConflit({ chemin: 'CLAUDE.md', base: 'a', nous: 'b', eux: 'c' }).qui, 'la session principale (instructions)');
    assert.equal(classerConflit({ chemin: '.claude/skills/x/SKILL.md' }).qui, 'la session principale (instructions)');
    assert.equal(classerConflit({ chemin: 'inconnu.bin' }).nature, 'sens', 'aucune règle : sens, le plus prudent');
    for (const n of Object.values(NATURES)) assert.ok(n.qui && n.comment);
  });

  test('migrations : un numéro pris par la base sous un autre nom', () => {
    const r = migrationsARenumeroter({
      ajoutees: ['data/migrations/0072-index.sql', 'data/migrations/0072-index.json', 'data/migrations/0074-libre.sql'],
      dansLaBase: ['data/migrations/0071-a.sql', 'data/migrations/0072-autre.sql', 'data/migrations/0073-b.sql'],
    });
    assert.deepEqual(r, [
      { chemin: 'data/migrations/0072-index.json', numero: '0072', prisPar: ['data/migrations/0072-autre'] },
      { chemin: 'data/migrations/0072-index.sql', numero: '0072', prisPar: ['data/migrations/0072-autre'] },
    ]);
    assert.deepEqual(migrationsARenumeroter({ ajoutees: ['data/migrations/0072-index.sql'], dansLaBase: ['data/migrations/0072-index.sql'] }), [],
      'la même migration, déjà dans la base');
  });

  test('distante : commits remplacés par un rebase (équivalents ou connus du reflog) ou vrais commits à reprendre', () => {
    const c = (sha, equivalent = false) => ({ sha: sha.padEnd(40, '0'), sujet: sha, equivalent });
    const ref = 'origin/feature/x';
    const reecrite = etatDeLaDistante({ distants: [c('a', true), c('b')], connus: new Set([c('b').sha]), nonPousses: 2, ref });
    assert.deepEqual([reecrite.aReprendre.length, reecrite.remplaces.length, reecrite.reecrite], [0, 2, true]);
    assert.match(reecrite.conseil, /git push --force-with-lease origin <branche>/);
    const suggestion = etatDeLaDistante({ distants: [c('s')], connus: new Set(), nonPousses: 0, ref });
    assert.equal(suggestion.aReprendre[0].commande, 'git rebase origin/feature/x');
    const lesDeux = etatDeLaDistante({ distants: [c('a', true), c('s')], connus: new Set(), nonPousses: 1, ref });
    assert.equal(lesDeux.aReprendre[0].commande, 'git cherry-pick s000000000', 'branche réécrite : pas de rebase sur la distante');
    assert.match(lesDeux.conseil, /un par un/);
    assert.match(etatDeLaDistante({ distants: [], connus: new Set(), nonPousses: 1, ref }).conseil, /1 commit\(s\) à pousser/);
    assert.match(etatDeLaDistante({ distants: [], connus: new Set(), nonPousses: 0, ref }).conseil, /à jour/);
  });

  test('refusion et conseil de rebase', () => {
    assert.equal(brancheDeRefusion([]).refusion, false);
    assert.match(brancheDeRefusion([{ sha: 'a', apporteMaster: true }]).raison, /refusion.*ne pas rebaser/);
    assert.match(brancheDeRefusion([{ sha: 'a', apporteMaster: false }]).raison, /ne viennent pas de master/);
    assert.deepEqual(conseilDeRebase({ aJour: true, refusion: false }).necessaire, false);
    assert.deepEqual(conseilDeRebase({ aJour: false, refusion: false }).necessaire, true);
    assert.match(conseilDeRebase({ aJour: false, refusion: true }).conseil, /refaire la refusion/);
  });
});

describe('le script sur un dépôt jetable', () => {
  function depot(t) {
    const dossier = dossierTemporaire('flux-git-etat', { t });
    const env = { ...process.env, GIT_CONFIG_NOSYSTEM: '1', HOME: dossier, GIT_AUTHOR_NAME: 'Test', GIT_AUTHOR_EMAIL: 't@example.org', GIT_COMMITTER_NAME: 'Test', GIT_COMMITTER_EMAIL: 't@example.org' };
    const brut = (args) => spawnSync('git', ['-c', 'commit.gpgsign=false', ...args], { cwd: dossier, env, encoding: 'utf8' });
    const git = (...args) => { const r = brut(args); assert.equal(r.status, 0, `git ${args.join(' ')} : ${r.stderr}`); return r.stdout.trim(); };
    const ecrire = (fichiers) => {
      for (const [c, texte] of Object.entries(fichiers)) { mkdirSync(dirname(join(dossier, c)), { recursive: true }); writeFileSync(join(dossier, c), texte); }
    };
    const commit = (fichiers, message) => { ecrire(fichiers); git('add', '-A'); git('commit', '--quiet', '-m', message); return git('rev-parse', 'HEAD'); };
    const etatDans = (cwd, ...args) => {
      const r = spawnSync(process.execPath, [SCRIPT, '--json', ...args], { cwd, env, encoding: 'utf8' });
      assert.equal(r.status, 0, r.stderr);
      return JSON.parse(r.stdout);
    };
    const etat = (...args) => etatDans(dossier, ...args);
    const texte = () => spawnSync(process.execPath, [SCRIPT], { cwd: dossier, env, encoding: 'utf8' }).stdout;
    return { dossier, git, brut, commit, ecrire, etat, etatDans, texte };
  }
  const pkg = (version) => `{\n  "name": "m",\n  "version": "${version}"\n}\n`;

  test('avant le rebase, puis rebase en conflit : retard, recouvrement prévu, migrations, conflits classés ; rien n\'est modifié', (t) => {
    const d = depot(t);
    d.git('init', '--quiet', '-b', 'dev');
    d.commit({ 'client/package.json': pkg('0.1.0'), 'data/schema.sql': 'a\n', 'docs/a.md': 'a\n', 'client/src/x.mjs': 'a\n', 'data/rows/t.sql': 'a\n', 'autre.txt': 'a\n' }, 'base');
    d.git('switch', '--quiet', '-c', 'feature/x');
    d.commit({ 'client/package.json': pkg('0.1.0-lot'), 'data/schema.sql': 'a\nlot\n', 'docs/a.md': 'a\nlot\n', 'client/src/x.mjs': 'lot\n', 'data/rows/t.sql': 'lot\n', 'data/migrations/0002-lot.sql': 'x\n' }, 'lot');
    d.git('switch', '--quiet', 'dev');
    const pointeDev = d.commit({ 'client/package.json': pkg('0.1.1'), 'data/schema.sql': 'a\nbase\n', 'docs/a.md': 'a\nbase\n', 'client/src/x.mjs': 'base\n', 'data/rows/t.sql': 'base\n', 'data/migrations/0002-base.sql': 'y\n', 'autre.txt': 'b\n' }, 'base bouge');
    d.git('update-ref', 'refs/remotes/origin/dev', pointeDev);
    d.git('switch', '--quiet', 'feature/x');

    const avant = d.etat();
    assert.equal(avant.branche, 'feature/x');
    assert.equal(avant.base, 'origin/dev');
    assert.deepEqual([avant.avance, avant.retard], [1, 1]);
    assert.equal(avant.rebase.necessaire, true);
    assert.equal(avant.refusion.refusion, false);
    assert.equal(avant.distante.absente, true);
    assert.deepEqual(avant.recouvrement.fichiers, ['client/package.json', 'client/src/x.mjs', 'data/rows/t.sql', 'data/schema.sql', 'docs/a.md']);
    assert.match(avant.recouvrement.genre, /prévu/);
    assert.deepEqual(avant.migrations, [{ chemin: 'data/migrations/0002-lot.sql', numero: '0002', prisPar: ['data/migrations/0002-base'] }]);
    assert.match(d.texte(), /Rebase nécessaire : oui/);
    assert.deepEqual(d.etatDans(join(d.dossier, 'client')).migrations, avant.migrations, 'lancé depuis un sous-dossier : mêmes chemins');

    assert.notEqual(d.brut(['rebase', 'origin/dev']).status, 0, 'le rebase s\'arrête sur les conflits');
    const statut = d.git('status', '--porcelain');
    const pendant = d.etat();
    assert.equal(pendant.enCours, 'rebase');
    assert.equal(pendant.branche, 'feature/x', 'lue dans rebase-merge/head-name');
    assert.deepEqual(Object.fromEntries(pendant.conflits.map((c) => [c.chemin, c.nature])), {
      'client/package.json': 'version-verrou',
      'client/src/x.mjs': 'sens',
      'data/rows/t.sql': 'outil',
      'data/schema.sql': 'schema',
      'docs/a.md': 'mecanique',
    });
    assert.match(d.texte(), /Conflits \(5\) :\n {2}client\/package\.json — version-verrou \(tech-publication\)/);
    assert.equal(d.git('status', '--porcelain'), statut, 'lecture seule : l\'arbre et l\'index n\'ont pas bougé');
    d.git('rebase', '--abort');
  });

  test('refusion, distante en avance, base hotfix', (t) => {
    const d = depot(t);
    d.git('init', '--quiet', '-b', 'master');
    const m0 = d.commit({ 'a.txt': 'a\n' }, 'prod');
    d.git('switch', '--quiet', '-c', 'dev');
    d.commit({ 'b.txt': 'b\n' }, 'dev');
    d.git('switch', '--quiet', 'master');
    const m1 = d.commit({ 'c.txt': 'c\n' }, 'hotfix livré');
    d.git('switch', '--quiet', 'dev');
    const dev = d.git('rev-parse', 'HEAD');
    d.git('switch', '--quiet', '-c', 'feature/refusion');
    d.git('merge', '--quiet', '--no-ff', '--no-edit', 'master');
    const fusion = d.git('rev-parse', 'HEAD');
    for (const [ref, sha] of [['origin/dev', dev], ['origin/master', m1], ['origin/feature/refusion', fusion]]) d.git('update-ref', `refs/remotes/${ref}`, sha);
    d.commit({ 'd.txt': 'd\n' }, 'local seulement');

    const e = d.etat();
    assert.equal(e.refusion.refusion, true);
    assert.match(e.refusion.raison, /fusion\(s\) de master/);
    assert.equal(e.distante.nonPousses, 1);
    assert.deepEqual(e.distante.aReprendre, []);
    assert.equal(e.distante.reecrite, false);

    // La base bouge : une refusion ne se rebase pas.
    d.git('switch', '--quiet', 'dev');
    d.git('update-ref', 'refs/remotes/origin/dev', d.commit({ 'e.txt': 'e\n' }, 'dev bouge'));
    d.git('switch', '--quiet', 'feature/refusion');
    const bouge = d.etat();
    assert.equal(bouge.rebase.necessaire, false);
    assert.match(bouge.rebase.conseil, /refaire la refusion/);

    // Un commit poussé sur la distante (suggestion appliquée sur GitHub), absent en local.
    d.git('switch', '--quiet', '-c', 'hotfix/lien', m0);
    const h1 = d.commit({ 'f.txt': 'f\n' }, 'hotfix');
    d.git('switch', '--quiet', '--detach');
    const h2 = d.commit({ 'g.txt': 'g\n' }, 'suggestion');
    d.git('update-ref', 'refs/remotes/origin/hotfix/lien', h2);
    d.git('switch', '--quiet', 'hotfix/lien');
    assert.equal(d.git('rev-parse', 'HEAD'), h1);
    const h = d.etat();
    assert.equal(h.base, 'origin/master', 'une hotfix part de master');
    assert.equal(h.distante.aReprendre.length, 1);
    assert.equal(h.distante.aReprendre[0].sujet, 'suggestion');
    assert.equal(h.distante.reecrite, false);
    assert.match(d.texte(), /à reprendre d'abord : git rebase origin\/hotfix\/lien/);
    assert.equal(d.etat('--base', 'origin/dev').base, 'origin/dev');
  });

  test('branche poussée puis rebasée : rien à reprendre, push --force-with-lease ; recouvrement du dernier rebase', (t) => {
    const d = depot(t);
    const lignes10 = (marque = {}) => `${Array.from({ length: 10 }, (_, i) => marque[i] ?? `ligne ${i}`).join('\n')}\n`;
    d.git('init', '--quiet', '-b', 'dev');
    d.commit({ 'a.txt': lignes10(), 'b.txt': 'b\n' }, 'base');
    d.git('switch', '--quiet', '-c', 'feature/x');
    const poussee = d.commit({ 'a.txt': lignes10({ 8: 'lot' }), 'd.txt': 'd\n' }, 'lot');
    d.git('update-ref', 'refs/remotes/origin/feature/x', poussee);
    d.git('switch', '--quiet', 'dev');
    d.git('update-ref', 'refs/remotes/origin/dev', d.commit({ 'a.txt': lignes10({ 1: 'base' }), 'b.txt': 'b2\n' }, 'base bouge'));
    d.git('switch', '--quiet', 'feature/x');
    d.git('rebase', '--quiet', 'origin/dev');

    const e = d.etat();
    assert.deepEqual(e.distante.aReprendre, [], 'l\'ancien commit poussé n\'est pas à reprendre');
    assert.equal(e.distante.reecrite, true);
    assert.match(d.texte(), /branche réécrite par un rebase : git fetch --prune origin, puis git push --force-with-lease origin <branche> attendu/);
    assert.doesNotMatch(d.texte(), /à reprendre d'abord/);
    assert.equal(e.recouvrement.genre, 'du dernier rebase');
    assert.deepEqual(e.recouvrement.fichiers, ['a.txt']);
    assert.deepEqual([e.recouvrement.arrivees, e.recouvrement.lot], [2, 2]);

    // Le commit rejoué a changé (patch différent, comme après un conflit résolu) : toujours connu par le reflog.
    d.ecrire({ 'd.txt': 'd modifié\n' });
    d.git('commit', '--quiet', '-a', '--amend', '--no-edit');
    const amende = d.etat();
    assert.deepEqual(amende.distante.aReprendre, []);
    assert.equal(amende.distante.remplaces.length, 1);
    assert.equal(amende.recouvrement.genre, 'aucun rebase récent', 'ORIG_HEAD daté par l\'amend');
  });

  test('hors d\'un dépôt ou base absente : code 2 et la raison', (t) => {
    const d = depot(t);
    d.git('init', '--quiet', '-b', 'dev');
    d.commit({ 'a.txt': 'a\n' }, 'base');
    const r = spawnSync(process.execPath, [SCRIPT], { cwd: d.dossier, encoding: 'utf8' });
    assert.equal(r.status, 2);
    assert.match(r.stderr, /base origin\/dev introuvable/);
  });
});
