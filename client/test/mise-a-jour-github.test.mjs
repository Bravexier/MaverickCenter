// Le workflow « Mise à jour des règles » (.github/workflows/mise-a-jour.yml) et son orchestration (scripts/mise-a-jour-github.mjs), contre un
// GitHub, un git et des commandes simulés : aucun réseau, aucun dépôt réel touché, aucune commande lancée.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { MARQUEUR_MAJEURE } from '../../tools/flux-git/regles.mjs';
import {
  CHECKS_REQUIS, CONTROLES, DELAIS, ESSAIS, MAX_CORPS, TABLES_DE_LA_NOTE, changementsNonIndexes, chercherLotDejaFusionne, corpsDePR,
  enteteAuthentification, enveloppeGit, environnementGit, etatDesChecks, fichiersModifies, gitLocal, horodatage, horsListe, lireStatut, mettreAJour,
  neutraliserMarqueur, noteDuCorps, nomDeBranche, pourCommandeDeWorkflow, sousCommandeGit, tablesDuLot, verifierEntrees,
} from '../scripts/mise-a-jour-github.mjs';
import { TABLES_DE_LA_NOTE as TABLES_DU_SCRIPT } from '../scripts/mise-a-jour-regles.mjs';

const WORKFLOW = fileURLToPath(new URL('../../.github/workflows/mise-a-jour.yml', import.meta.url));
const DEPOT = 'Bravexier/MaverickCenter';
const PROPRIETAIRE = 'Bravexier';
const API = `https://api.github.com/repos/${DEPOT}`;
const LOT = '0f8fad5b-d9cb-469f-a165-70867728950e';
const ADRESSE = `https://dev.maverick-jdr.com/api/mise-a-jour/lots/${LOT}/`;
const RUN = `https://github.com/${DEPOT}/actions/runs/123`;
const DEBUT = new Date('2026-10-11T12:30:00Z'); // 14:30 à Paris
const BRANCHE = 'feature/mise-a-jour-regles-20261011-1430';
const PAT = 'jeton-ecriture';
const LECTURE = 'jeton-lecture';

const sha = (texte) => createHash('sha1').update(texte).digest('hex');
const empreinte = (texte) => createHash('sha256').update(texte).digest('hex');

const LOT_JSON = `${JSON.stringify({
  format: 'maverick-mise-a-jour/1', id: LOT, cree_le: '2026-10-11T12:29:00Z', version_dev: '0.1.76', version_cible: '0.2',
  texte: 'Grosse refonte [V: X+1]',
  journal: { format: 'maverick-edition/1', lots: [{ id: 'l1', fait_le: '2026-10-10', resume: 'Forgeron', modifications: [
    { rang: 1, table: 'metier', cle: { id: 'forgeron' }, operation: 'update', avant: { bonus: '+1' }, apres: { bonus: '+2' } },
  ] }] },
})}\n`;
const EMPREINTE = empreinte(LOT_JSON);
const FICHIERS = ['historique_modification.sql', 'metier.sql', 'note_version.sql', 'note_version_ligne.sql'];

const racineTemp = mkdtempSync(join(tmpdir(), 'mise-a-jour-github-test-'));
after(() => rmSync(racineTemp, { recursive: true, force: true }));

/** Checks d'un commit : regles-de-branches sauté (événement create) puis, après `lectures` lectures, les trois checks requis verts. */
const checksVerts = (lectures = 1) => {
  const vus = new Map();
  return (s) => {
    vus.set(s, (vus.get(s) ?? 0) + 1);
    const runs = [{ name: 'regles-de-branches', status: 'completed', conclusion: 'skipped' }, { name: 'creation-de-branche', status: 'completed', conclusion: 'success' }];
    if (vus.get(s) <= lectures) return [...runs, { name: 'client', status: 'in_progress', conclusion: null }];
    return [...runs, ...CHECKS_REQUIS.map((name) => ({ name, status: 'completed', conclusion: 'success', html_url: `https://github.com/${DEPOT}/runs/${name}` }))];
  };
};

/**
 * Un monde simulé : GitHub (API REST + le site de dev qui sert le lot), le dépôt git local, les commandes (mise-a-jour-regles, npm).
 * `options` remplace les comportements par défaut (chemin heureux).
 */
function monde(options = {}) {
  const m = {
    appels: [], git: [], executions: [], journal: [], commentaires: [], fusions: [], supprimees: [], commits: [], poussees: [],
    attente: 0, devSha: sha('dev-0'), masterSha: sha('master-0'), tete: null, branches: {}, modifies: [], index: [], nouveaux: [], indexes: [],
    prs: new Map(), numero: 40, lecturesCommits: 0, versionPour: null,
    texteLot: LOT_JSON, statutLot: 200, codeRegles: 0, erreurRegles: null, fichiersResume: FICHIERS, fichiersChanges: null,
    markdown: '## Version 0.2 (depuis la V0.1)\n\nGrosse refonte (V: X+1)\n\n### Métiers\n- Forgeron : bonus : ~~+1~~ → **+2** [V: X+1]\n',
    checks: checksVerts(), fusion: null, fusionnable: null, versionApres: 1, codeNpm: null, masterDansDev: 0, log: null, dejaLivre: false,
    ...options,
  };
  const reponse = (statut, donnees, brut = false) => {
    const texte = brut ? donnees : donnees === null ? '' : JSON.stringify(donnees);
    return { status: statut, text: async () => texte, arrayBuffer: async () => new TextEncoder().encode(texte).buffer };
  };
  const route = (methode, chemin, corps) => {
    let x;
    if (methode === 'GET' && chemin.startsWith('/pulls?')) {
      const q = new URLSearchParams(chemin.split('?')[1]);
      return [200, [...m.prs.values()].filter((p) => p.state === 'open' && p.base.ref === q.get('base')
        && (!q.get('head') || q.get('head') === `${PROPRIETAIRE}:${p.head.ref}`))];
    }
    if (methode === 'POST' && chemin === '/pulls') {
      if ([...m.prs.values()].some((p) => p.state === 'open' && p.head.ref === corps.head && p.base.ref === corps.base)) {
        return [422, { message: 'Validation Failed', errors: [{ message: `A pull request already exists for ${PROPRIETAIRE}:${corps.head}.` }] }];
      }
      const head = corps.head === 'dev' ? m.devSha : m.branches[corps.head];
      assert.ok(head, `PR ouverte depuis une branche non poussée (${corps.head})`);
      const number = (m.numero += 1);
      const pr = { number, title: corps.title, body: corps.body, state: 'open', merged: false, html_url: `https://github.com/${DEPOT}/pull/${number}`,
        head: { ref: corps.head, sha: head, repo: { full_name: DEPOT } }, base: { ref: corps.base }, lectures: 0 };
      m.prs.set(number, pr);
      return [201, pr];
    }
    if ((x = /^\/pulls\/(\d+)$/.exec(chemin))) {
      const pr = m.prs.get(Number(x[1]));
      if (methode === 'PATCH') return [200, Object.assign(pr, corps)];
      pr.lectures += 1;
      m.surLecturePR?.(pr, m);
      if (pr.head.ref === 'dev') pr.head.sha = m.devSha; // la tête d'une PR de livraison suit dev
      return [200, { ...pr, mergeable: pr.lectures === 1 ? null : (m.fusionnable?.(pr) ?? true) }];
    }
    if (methode === 'PUT' && (x = /^\/pulls\/(\d+)\/merge$/.exec(chemin))) {
      const pr = m.prs.get(Number(x[1]));
      m.fusions.push({ numero: pr.number, base: pr.base.ref, ...corps });
      const impose = m.fusion?.(pr, corps, m);
      if (impose) return impose;
      if (corps.sha !== pr.head.sha) return [409, { message: 'Head branch was modified. Review and try the merge again.' }];
      Object.assign(pr, { state: 'closed', merged: true });
      const fusion = sha(`fusion-${pr.number}`);
      if (pr.base.ref === 'dev') {
        m.devSha = sha(`version-${pr.number}`); // livraison.yml : commit de version poussé sur dev
        m.versionPour = { numero: pr.number, branche: pr.head.ref };
      } else {
        m.masterSha = fusion;
      }
      return [200, { merged: true, sha: fusion, message: 'Pull Request successfully merged' }];
    }
    if (methode === 'GET' && (x = /^\/commits\/([0-9a-f]{40})\/check-runs\?/.exec(chemin))) return [200, { total_count: 0, check_runs: m.checks(x[1], m) }];
    if (methode === 'GET' && chemin.startsWith('/commits?')) {
      m.lecturesCommits += 1;
      const liste = [{ sha: sha('ancien'), commit: { message: 'chore: version v0.1.76 (feature feature/tags-de-version) (PR #77)' } }];
      if (m.versionPour && m.lecturesCommits > m.versionApres) {
        liste.unshift({ sha: m.devSha, commit: { message: `chore: version v0.1.77 (feature ${m.versionPour.branche}) (PR #${m.versionPour.numero})\n\ndétail` } });
      }
      return [200, liste];
    }
    if (methode === 'GET' && chemin === '/git/ref/heads/dev') return [200, { ref: 'refs/heads/dev', object: { sha: m.devSha, type: 'commit' } }];
    if (methode === 'POST' && (x = /^\/issues\/(\d+)\/comments$/.exec(chemin))) {
      m.commentaires.push({ numero: Number(x[1]), body: corps.body });
      return [201, { id: m.commentaires.length }];
    }
    if (methode === 'DELETE' && chemin.startsWith('/git/refs/heads/')) {
      m.supprimees.push(chemin.slice('/git/refs/heads/'.length));
      return [204, null];
    }
    throw new Error(`appel GitHub inattendu : ${methode} ${chemin}`);
  };
  m.fetch = async (url, init = {}) => {
    const methode = init.method ?? 'GET';
    if (url === ADRESSE) {
      m.appels.push({ methode, url, init });
      return reponse(m.statutLot, m.texteLot, true);
    }
    assert.ok(url.startsWith(API), `adresse inattendue ${url}`);
    const chemin = url.slice(API.length);
    const corps = init.body ? JSON.parse(init.body) : undefined;
    m.appels.push({ methode, chemin, corps, headers: init.headers });
    const [statut, donnees] = route(methode, chemin, corps);
    return reponse(statut, donnees);
  };
  m.gitFn = (args) => {
    m.git.push(args);
    let i = 0;
    while (args[i] === '-c') i += 2;
    const [sous, ...reste] = args.slice(i);
    const ok = (sortie = '') => ({ code: 0, sortie, erreur: '' });
    switch (sous) {
      case 'fetch': return ok();
      case 'rev-parse': return ok(`${reste.includes('HEAD') ? m.tete : m.devSha}\n`);
      case 'merge-base':
        if (reste[1] === 'origin/master' && reste[2] === 'origin/dev') return { code: m.masterDansDev, sortie: '', erreur: '' };
        return { code: m.dejaLivre ? 0 : 1, sortie: '', erreur: '' };
      case 'log': return ok(m.log?.(reste) ?? '');
      case 'checkout':
        m.tete = m.devSha;
        m.modifies = [];
        m.index = [];
        m.nouveaux = [];
        m.local = reste[reste.indexOf('-B') + 1];
        return ok();
      case 'status': {
        // porcelain v1 : X = index, Y = arbre de travail ; un fichier indexé puis réécrit est « MM »
        const etats = new Map(m.index.map((f) => [f, 'M ']));
        for (const f of m.modifies) etats.set(f, `${etats.get(f)?.[0] ?? ' '}M`);
        return ok([...[...etats].map(([f, xy]) => `${xy} ${f}\0`), ...m.nouveaux.map((f) => `?? ${f}\0`)].join(''));
      }
      case 'add': {
        const chemins = reste.slice(reste.indexOf('--') + 1);
        m.indexes = chemins;
        m.index = [...new Set([...m.index, ...chemins])].sort();
        m.modifies = m.modifies.filter((f) => !chemins.includes(f));
        return ok();
      }
      case 'diff': return ok(m.index.map((f) => `${f}\0`).join(''));
      case 'commit':
        m.commits.push({ messages: reste.filter((_, k) => reste[k - 1] === '-m'), auteur: args.slice(0, i) });
        m.tete = sha(`commit-${m.commits.length}`);
        m.modifies = [];
        m.index = [];
        return ok();
      case 'push': {
        m.poussees.push(reste);
        const nom = reste.at(-1).replace('HEAD:refs/heads/', '');
        m.branches[nom] = m.tete;
        return ok();
      }
      default: throw new Error(`git inattendu : ${args.join(' ')}`);
    }
  };
  m.executer = (commande, args, options = {}) => {
    m.executions.push({ commande, args, cwd: options.cwd, env: options.env });
    if (args.some((a) => a.endsWith('mise-a-jour-regles.mjs'))) {
      const resume = args[args.indexOf('--resume') + 1];
      if (m.codeRegles) {
        writeFileSync(resume, JSON.stringify({ erreur: m.erreurRegles, code: m.codeRegles }));
        return { code: m.codeRegles };
      }
      writeFileSync(resume, JSON.stringify({ version: '0.2', depuis: '0.1', lignes: 1, bilan: { amelioration: 1 }, fichiers: m.fichiersResume, markdown: m.markdown }));
      m.modifies = (m.fichiersChanges ?? m.fichiersResume.map((f) => `data/rows/${f}`)).slice().sort();
      return { code: 0 };
    }
    return { code: m.codeNpm?.(args, m) ?? 0 };
  };
  m.lancer = (entrees = {}) => mettreAJour({
    lot: LOT, empreinte: EMPREINTE, adresse: ADRESSE, essai: false, depot: DEPOT, jeton: PAT, jetonLecture: LECTURE, run: RUN,
    racine: '/depot', temp: mkdtempSync(join(racineTemp, 'run-')), debut: DEBUT, ...entrees,
  }, { fetch: m.fetch, git: m.gitFn, executer: m.executer, attendre: async (ms) => { m.attente += ms; }, journal: (t) => m.journal.push(t) });
  m.ecritures = () => m.appels.filter((a) => a.methode && a.methode !== 'GET' && a.chemin);
  m.pullsCrees = () => m.appels.filter((a) => a.methode === 'POST' && a.chemin === '/pulls');
  return m;
}

describe('mettreAJour : chemin heureux', () => {
  test('lot vérifié, PR vers dev verte et fusionnée, version attendue, puis livraison dev → master fusionnée', async () => {
    const m = monde();
    const r = await m.lancer();
    assert.equal(r.etat, 'livre');
    assert.equal(r.version, '0.2');
    assert.equal(r.prDev, 41);
    assert.equal(r.prMaster, 42);
    assert.equal(r.versionDev, '0.1.77');

    // a. le lot téléchargé une fois depuis son adresse, sans suivre de redirection, avec un délai
    const telechargements = m.appels.filter((a) => a.url === ADRESSE);
    assert.equal(telechargements.length, 1);
    assert.equal(telechargements[0].init.redirect, 'error');
    assert.ok(telechargements[0].init.signal instanceof AbortSignal);
    // b. branche partie de origin/dev, rejeu, contrôles
    assert.ok(m.git.some((a) => a.join(' ') === `checkout --quiet -B ${BRANCHE} origin/dev`));
    const regles = m.executions.find((e) => e.args.some((a) => a.endsWith('mise-a-jour-regles.mjs')));
    assert.deepEqual(regles.args.slice(regles.args.indexOf('--reference'), regles.args.indexOf('--reference') + 4), ['--reference', 'origin/master', '--date', '2026-10-11']);
    assert.equal(readFileSync(regles.args[regles.args.indexOf('--lot') + 1], 'utf8'), LOT_JSON, 'le lot est passé tel que téléchargé');
    assert.ok(!('GH_TOKEN' in (regles.env ?? {})), 'les commandes ne reçoivent pas le jeton');
    assert.deepEqual(m.executions.filter((e) => e.commande === 'npm').map((e) => e.args), CONTROLES);
    // commit : seulement les fichiers de data/rows annoncés, auteur github-actions[bot]
    assert.deepEqual(m.indexes, FICHIERS.map((f) => `data/rows/${f}`));
    assert.equal(m.commits.length, 1);
    assert.equal(m.commits[0].messages[0], 'Mise à jour des règles V0.2 (site de dev, lot 0f8fad5b)');
    assert.match(m.commits[0].messages[1], new RegExp(`Lot : ${LOT}`));
    assert.ok(m.commits[0].auteur.includes('user.name=github-actions[bot]'));
    assert.deepEqual(m.poussees, [['--quiet', 'origin', `HEAD:refs/heads/${BRANCHE}`]]);

    const [prDev, prMaster] = m.pullsCrees();
    assert.deepEqual({ head: prDev.corps.head, base: prDev.corps.base, title: prDev.corps.title },
      { head: BRANCHE, base: 'dev', title: 'Mise à jour des règles V0.2 (site de dev)' });
    assert.ok(prDev.corps.body.includes(RUN), 'le corps cite le run');
    assert.deepEqual({ head: prMaster.corps.head, base: prMaster.corps.base, title: prMaster.corps.title },
      { head: 'dev', base: 'master', title: 'Livraison V0.2 (mise à jour du site de dev)' });

    // fusions : par commit de fusion, avec le sha de tête ; la livraison seulement après le commit de version de la PR vers dev
    assert.deepEqual(m.fusions.map((f) => [f.numero, f.base, f.merge_method, f.sha]), [
      [41, 'dev', 'merge', m.branches[BRANCHE]],
      [42, 'master', 'merge', sha('version-41')],
    ]);
    assert.match(m.fusions[0].commit_title, new RegExp(`^Merge pull request #41 from ${PROPRIETAIRE}/${BRANCHE}$`));
    const indexDe = (predicat) => m.appels.findIndex(predicat);
    assert.ok(indexDe((a) => a.chemin?.startsWith('/commits?')) < indexDe((a) => a.methode === 'POST' && a.corps?.base === 'master'));
    assert.ok(m.lecturesCommits >= 2, 'le commit de version est attendu (il n\'apparaît qu\'à la deuxième lecture)');
    // checks attendus sur le bon commit avant chaque fusion
    assert.ok(m.appels.some((a) => a.chemin === `/commits/${m.branches[BRANCHE]}/check-runs?per_page=100&filter=latest`));
    assert.ok(m.appels.some((a) => a.chemin === `/commits/${sha('version-41')}/check-runs?per_page=100&filter=latest`));
    assert.equal(m.commentaires.length, 0);
    assert.ok(m.attente > 0);
  });

  test('le marqueur [V: X+1] n\'est jamais envoyé (corps des PR, commentaires, messages de fusion)', async () => {
    const m = monde();
    await m.lancer();
    for (const a of m.ecritures()) assert.doesNotMatch(JSON.stringify(a.corps ?? {}), MARQUEUR_MAJEURE, `${a.methode} ${a.chemin}`);
    assert.ok(m.pullsCrees().every((a) => a.corps.body.includes('(V: X+1)')), 'neutralisé, pas supprimé');
  });

  test('écritures avec le jeton du bot, lectures avec le jeton du workflow ; en-têtes de l\'API', async () => {
    const m = monde();
    await m.lancer();
    const api = m.appels.filter((a) => a.chemin);
    for (const a of api) {
      assert.equal(a.headers.Authorization, `Bearer ${a.methode === 'GET' ? LECTURE : PAT}`, `${a.methode} ${a.chemin}`);
      assert.equal(a.headers.Accept, 'application/vnd.github+json');
      assert.equal(a.headers['X-GitHub-Api-Version'], '2022-11-28');
    }
  });

  test('sans jeton de lecture, tout passe par le jeton du bot', async () => {
    const m = monde();
    await m.lancer({ jetonLecture: null });
    assert.ok(m.appels.filter((a) => a.chemin).every((a) => a.headers.Authorization === `Bearer ${PAT}`));
  });
});

describe('mettreAJour : refus avant toute poussée', () => {
  const sansPoussee = (m) => {
    assert.deepEqual(m.poussees, []);
    assert.equal(m.commits.length, 0);
    assert.deepEqual(m.ecritures(), [], 'aucune écriture sur GitHub');
  };

  test('empreinte fausse : échec sans rien faire (ni git, ni PR)', async () => {
    const m = monde({ texteLot: LOT_JSON.replace('+2', '+3') });
    await assert.rejects(m.lancer(), (e) => e.etape === 'lot' && /empreinte du lot différente/.test(e.message));
    sansPoussee(m);
    assert.deepEqual(m.git, []);
    assert.deepEqual(m.executions, []);
  });

  test('lot indisponible (404) : échec', async () => {
    const m = monde({ statutLot: 404 });
    await assert.rejects(m.lancer(), /répondu 404/);
    sansPoussee(m);
  });

  test('conflit (mise-a-jour-regles code 3) : échec avec le message, rien n\'est poussé', async () => {
    const m = monde({ codeRegles: 3, erreurRegles: '1 lot(s) en conflit avec dev : « Forgeron » (bonus : avant différent)' });
    await assert.rejects(m.lancer(), (e) => e.etape === 'lot' && /code 3 : conflit avec dev/.test(e.message) && /Forgeron/.test(e.message));
    sansPoussee(m);
    assert.ok(!m.executions.some((e) => e.commande === 'npm'), 'pas de contrôles après un conflit');
  });

  test('fichier hors des fichiers annoncés : échec, rien n\'est poussé', async () => {
    const m = monde({ fichiersChanges: [...FICHIERS.map((f) => `data/rows/${f}`), 'client/package.json'] });
    await assert.rejects(m.lancer(), (e) => e.etape === 'liste' && /client\/package\.json/.test(e.message));
    sansPoussee(m);
  });

  test('table annoncée par le résumé mais absente du journal du lot : échec (double contrôle indépendant)', async () => {
    const fichiers = [...FICHIERS, 'race.sql'];
    const m = monde({ fichiersResume: fichiers });
    await assert.rejects(m.lancer(), (e) => e.etape === 'liste' && /data\/rows\/race\.sql/.test(e.message));
    sansPoussee(m);
  });

  test('un contrôle rouge (npm test) : échec, rien n\'est poussé', async () => {
    const m = monde({ codeNpm: (args) => (args[0] === 'test' ? 1 : 0) });
    await assert.rejects(m.lancer(), (e) => e.etape === 'controles' && /npm test/.test(e.message));
    sansPoussee(m);
  });

  test('un contrôle réécrit un fichier de la liste (même chemin, autre contenu) : échec, rien n\'est poussé', async () => {
    const m = monde({ codeNpm: (args, monde) => { if (args[0] === 'test') monde.modifies.push('data/rows/metier.sql'); return 0; } });
    await assert.rejects(m.lancer(), (e) => e.etape === 'controles' && /data\/rows\/metier\.sql/.test(e.message));
    sansPoussee(m);
  });

  test('un contrôle crée un fichier (non suivi) : échec, rien n\'est poussé, même en essai à blanc', async () => {
    for (const essai of [false, true]) {
      const m = monde({ codeNpm: (args, monde) => { if (args[1] === 'db:build') monde.nouveaux.push('data/rows/autre.sql'); return 0; } });
      await assert.rejects(m.lancer({ essai }), (e) => e.etape === 'controles' && /data\/rows\/autre\.sql/.test(e.message));
      sansPoussee(m);
    }
  });

  test('aucun changement : arrêt sans PR (rien à livrer)', async () => {
    const m = monde({ fichiersChanges: [] });
    const r = await m.lancer();
    assert.equal(r.etat, 'rien');
    sansPoussee(m);
  });

  test('essai à blanc : lot appliqué et contrôlé, rien n\'est poussé ni ouvert', async () => {
    const m = monde();
    const r = await m.lancer({ essai: true });
    assert.equal(r.etat, 'essai');
    assert.equal(r.version, '0.2');
    assert.deepEqual(r.fichiers, FICHIERS.map((f) => `data/rows/${f}`));
    assert.deepEqual(m.executions.filter((e) => e.commande === 'npm').map((e) => e.args), CONTROLES, 'les contrôles tournent');
    sansPoussee(m);
  });

  test('master absente de dev (refusion en attente) : échec avant le rejeu', async () => {
    const m = monde({ masterDansDev: 1 });
    await assert.rejects(m.lancer(), (e) => e.etape === 'depart');
    sansPoussee(m);
    assert.deepEqual(m.executions, []);
  });
});

describe('mettreAJour : checks, mouvements de dev, reprise', () => {
  test('check rouge sur la PR vers dev : pas de fusion, commentaire, PR laissée ouverte', async () => {
    const m = monde({
      checks: () => [
        { name: 'client', status: 'completed', conclusion: 'failure', html_url: `https://github.com/${DEPOT}/runs/9` },
        { name: 'character-service', status: 'completed', conclusion: 'success' },
        { name: 'regles-de-branches', status: 'completed', conclusion: 'success' },
      ],
    });
    await assert.rejects(m.lancer(), (e) => e.etape === 'checks-dev' && e.pr === 41 && /client \(failure/.test(e.message));
    assert.deepEqual(m.fusions, []);
    assert.equal(m.commentaires.length, 1);
    assert.equal(m.commentaires[0].numero, 41);
    assert.match(m.commentaires[0].body, /client \(failure/);
    assert.equal(m.prs.get(41).state, 'open');
    assert.deepEqual(m.supprimees, []);
    assert.equal(m.pullsCrees().length, 1, 'pas de livraison');
  });

  test('checks jamais lancés : arrêt après 40 min, commentaire qui parle du jeton', async () => {
    const m = monde({ checks: () => [{ name: 'regles-de-branches', status: 'completed', conclusion: 'skipped' }] });
    await assert.rejects(m.lancer(), (e) => e.etape === 'checks-dev' && /MISE_A_JOUR_TOKEN/.test(e.message));
    assert.ok(m.attente >= DELAIS.checks);
    assert.deepEqual(m.fusions, []);
    assert.match(m.commentaires[0].body, /aucun n'a démarré/);
  });

  test('dev bouge (405 à la fusion) : PR fermée, branche supprimée, lot rejoué sur le nouveau dev', async () => {
    const m = monde({
      fusion: (pr, corps, monde) => {
        if (pr.number !== 41) return null;
        monde.devSha = sha('dev-1');
        return [405, { message: 'Pull Request is not mergeable' }];
      },
    });
    const r = await m.lancer();
    assert.equal(r.etat, 'livre');
    assert.equal(r.prDev, 42);
    assert.equal(r.prMaster, 43);
    assert.equal(m.prs.get(41).state, 'closed');
    assert.equal(m.prs.get(41).merged, false);
    assert.deepEqual(m.supprimees, [BRANCHE]);
    assert.match(m.commentaires[0].body, /405/);
    assert.equal(m.executions.filter((e) => e.args.some((a) => a.endsWith('mise-a-jour-regles.mjs'))).length, 2, 'le lot est rejoué');
    assert.deepEqual(m.poussees.map((p) => p.at(-1)), [`HEAD:refs/heads/${BRANCHE}`, `HEAD:refs/heads/${BRANCHE}-2`]);
    assert.ok(m.git.some((a) => a.join(' ') === `checkout --quiet -B ${BRANCHE}-2 origin/dev`));
    assert.equal(m.fusions.at(-2).sha, m.branches[`${BRANCHE}-2`]);
  });

  test('dev bouge pendant l\'attente des checks (sans conflit) : nouvel essai plutôt qu\'une fusion non contrôlée', async () => {
    let bouge = false;
    const verts = checksVerts(0);
    const m = monde({
      checks: (s, monde) => {
        if (!bouge) { bouge = true; monde.devSha = sha('dev-bis'); }
        return verts(s);
      },
    });
    const r = await m.lancer();
    assert.equal(r.prDev, 42);
    assert.equal(m.fusions.filter((f) => f.numero === 41).length, 0, 'la première PR n\'est jamais fusionnée');
    assert.equal(m.prs.get(41).state, 'closed');
  });

  test('mergeable false : PR fermée et nouvel essai ; trois fois de suite : échec', async () => {
    const m = monde({ fusionnable: (pr) => pr.base.ref !== 'dev' });
    await assert.rejects(m.lancer(), (e) => e.etape === 'pr-dev' && new RegExp(`${ESSAIS} essais`).test(e.message));
    assert.equal(m.pullsCrees().length, ESSAIS);
    assert.deepEqual(m.fusions, []);
    assert.equal(m.supprimees.length, ESSAIS);
  });

  test('livraison : check rouge sur la tête de dev, PR de livraison laissée ouverte avec un commentaire', async () => {
    const verts = checksVerts(0);
    const m = monde({
      checks: (s, monde) => (monde.versionPour ? [{ name: 'regles-de-branches', status: 'completed', conclusion: 'failure' }] : verts(s)),
    });
    await assert.rejects(m.lancer(), (e) => e.etape === 'pr-master' && e.pr === 42);
    assert.deepEqual(m.fusions.map((f) => f.numero), [41]);
    assert.equal(m.commentaires.at(-1).numero, 42);
    assert.equal(m.prs.get(42).state, 'open');
  });

  test('livraison : une PR dev → master déjà ouverte est reprise ; avec [V: X+1], elle est laissée au propriétaire', async () => {
    const m = monde();
    m.prs.set(30, { number: 30, title: 'Livraison', body: 'notes', state: 'open', html_url: 'u', head: { ref: 'dev', sha: m.devSha }, base: { ref: 'master' }, lectures: 0 });
    const r = await m.lancer();
    assert.equal(r.prMaster, 30);
    assert.deepEqual(m.fusions.map((f) => f.numero), [41, 30]);

    const majeure = monde();
    majeure.prs.set(30, { number: 30, title: 'Livraison [V: X+1]', body: '', state: 'open', html_url: 'u', head: { ref: 'dev', sha: majeure.devSha }, base: { ref: 'master' }, lectures: 0 });
    await assert.rejects(majeure.lancer(), (e) => e.etape === 'pr-master' && /signal du propriétaire/.test(e.message));
    assert.deepEqual(majeure.fusions.map((f) => f.numero), [41]);
  });

  test('livraison : [V: X+1] ajouté à la PR de livraison après son ouverture (avant ou pendant l\'attente) → jamais fusionnée', async () => {
    for (const lecture of [1, 2]) {
      const m = monde({
        surLecturePR: (pr) => { if (pr.base.ref === 'master' && pr.lectures === lecture) pr.body = `${pr.body}\n[V: X+1]`; },
      });
      await assert.rejects(m.lancer(), (e) => e.etape === 'pr-master' && e.pr === 42 && /version majeure/.test(e.message), `lecture ${lecture}`);
      assert.deepEqual(m.fusions.map((f) => f.numero), [41], `lecture ${lecture}`);
      assert.equal(m.prs.get(42).state, 'open');
      assert.equal(m.commentaires.at(-1).numero, 42);
      assert.doesNotMatch(m.commentaires.at(-1).body, MARQUEUR_MAJEURE);
      const checksDeLivraison = m.appels.filter((a) => a.chemin?.startsWith(`/commits/${sha('version-41')}/check-runs`)).length;
      if (lecture === 1) assert.equal(checksDeLivraison, 0, 'vu dès la première lecture : arrêt sans attendre les checks');
      else assert.ok(checksDeLivraison > 0);
    }
  });

  test('livraison : le commit de version n\'arrive pas en 20 min → échec, pas de PR vers master', async () => {
    const m = monde({ versionApres: Infinity });
    await assert.rejects(m.lancer(), (e) => e.etape === 'version-dev' && /PR #41/.test(e.message));
    assert.equal(m.pullsCrees().length, 1);
  });

  test('reprise : lot déjà fusionné dans dev (relance) → directement la livraison', async () => {
    const commit = sha('lot-commit');
    const fusion = sha('lot-fusion');
    const m = monde({
      log: (reste) => {
        if (reste.some((a) => a.startsWith('--grep='))) return `${commit}\n`;
        if (reste.includes('-1')) return 'Mise à jour des règles V0.2 (site de dev, lot 0f8fad5b)\n';
        if (reste.includes('--merges')) return `${fusion}\t${sha('dev-0')} ${commit}\tMerge pull request #12 from ${PROPRIETAIRE}/feature/mise-a-jour-regles-20261010-0900\n`;
        return '';
      },
    });
    m.prs.set(12, { number: 12, title: 'Mise à jour des règles V0.2 (site de dev)', body: corpsDePR('## Version 0.2\n\nla note', 'pied'), state: 'closed', merged: true, html_url: 'u12', head: { ref: 'x', sha: commit }, base: { ref: 'dev' }, lectures: 0 });
    m.versionPour = { numero: 12, branche: 'feature/mise-a-jour-regles-20261010-0900' };
    m.versionApres = 0;
    const r = await m.lancer();
    assert.equal(r.etat, 'livre');
    assert.equal(r.prDev, 12);
    assert.deepEqual(m.executions, [], 'le lot n\'est pas rejoué');
    assert.deepEqual(m.poussees, []);
    const [livraison] = m.pullsCrees();
    assert.equal(livraison.corps.base, 'master');
    assert.ok(livraison.corps.body.startsWith('## Version 0.2\n\nla note'), 'la note de la PR vers dev, sans son pied');
  });

  test('reprise : lot déjà livré sur master → rien', async () => {
    const m = monde({ dejaLivre: true, log: (reste) => (reste.some((a) => a.startsWith('--grep=')) ? `${sha('c')}\n` : 'Mise à jour des règles V0.2 (site de dev, lot 0f8fad5b)\n') });
    const r = await m.lancer();
    assert.equal(r.etat, 'deja-livre');
    assert.deepEqual(m.ecritures(), []);
    assert.deepEqual(m.executions, []);
  });

  test('une PR ouverte d\'un passage précédent du même lot est fermée avant le nouveau passage', async () => {
    const m = monde();
    const ancienne = 'feature/mise-a-jour-regles-20261011-1200';
    m.prs.set(39, { number: 39, title: 't', body: `note\n\n---\nLot \`${LOT}\` appliqué…`, state: 'open', html_url: 'u', head: { ref: ancienne, sha: sha('x'), repo: { full_name: DEPOT } }, base: { ref: 'dev' }, lectures: 0 });
    m.prs.set(38, { number: 38, title: 't', body: 'autre lot', state: 'open', html_url: 'u', head: { ref: 'feature/mise-a-jour-regles-20261009-1200', sha: sha('y'), repo: { full_name: DEPOT } }, base: { ref: 'dev' }, lectures: 0 });
    const r = await m.lancer();
    assert.equal(r.etat, 'livre');
    assert.equal(m.prs.get(39).state, 'closed');
    assert.equal(m.prs.get(38).state, 'open', 'la PR d\'un autre lot n\'est pas touchée');
    assert.deepEqual(m.supprimees, [ancienne]);
  });
});

describe('fonctions pures', () => {
  test('entrées : lot uuid, empreinte SHA-256, adresse du lot sur le site de dev (hôte imposé si configuré)', () => {
    assert.deepEqual(verifierEntrees({ lot: LOT, empreinte: EMPREINTE, adresse: ADRESSE }), { hote: 'dev.maverick-jdr.com' });
    const ko = (e) => assert.throws(() => verifierEntrees({ lot: LOT, empreinte: EMPREINTE, adresse: ADRESSE, ...e }), (x) => x.etape === 'entrees');
    ko({ lot: 'abc' });
    ko({ lot: LOT.toUpperCase() });
    ko({ empreinte: EMPREINTE.slice(1) });
    ko({ empreinte: EMPREINTE.toUpperCase() });
    ko({ adresse: ADRESSE.replace('https', 'http') });
    ko({ adresse: ADRESSE.replace(LOT, '1f8fad5b-d9cb-469f-a165-70867728950e') });
    ko({ adresse: `${ADRESSE}?x=1` });
    ko({ adresse: `https://u:p@dev.maverick-jdr.com/api/mise-a-jour/lots/${LOT}/` });
    ko({ adresse: `https://dev.maverick-jdr.com/autre/api/mise-a-jour/lots/${LOT}/` });
    ko({ hoteAttendu: 'maverick-jdr.com' });
    verifierEntrees({ lot: LOT, empreinte: EMPREINTE, adresse: ADRESSE, hoteAttendu: 'DEV.maverick-jdr.com' });
  });

  test('checks : un job sauté ne compte pas, un échec l\'emporte, un check en cours fait attendre', () => {
    const ok = (name) => ({ name, status: 'completed', conclusion: 'success' });
    assert.deepEqual(etatDesChecks(CHECKS_REQUIS.map(ok)).reussis, CHECKS_REQUIS);
    // regles-de-branches sauté (événement create) seul : pas encore le vrai
    assert.deepEqual(etatDesChecks([ok('client'), ok('character-service'), { name: 'regles-de-branches', status: 'completed', conclusion: 'skipped' }]).attente,
      ['regles-de-branches (pas encore lancé)']);
    // push et pull_request sur le même commit : les deux doivent être verts
    assert.deepEqual(etatDesChecks([...CHECKS_REQUIS.map(ok), { name: 'client', status: 'completed', conclusion: 'cancelled' }]).echecs, ['client (cancelled)']);
    assert.deepEqual(etatDesChecks([...CHECKS_REQUIS.map(ok), { name: 'client', status: 'queued', conclusion: null }]).attente, ['client (en cours)']);
    assert.equal(etatDesChecks([]).attente.length, 3);
  });

  test('liste blanche : fichiers annoncés ET tables du lot ou de la note de version', () => {
    assert.deepEqual(TABLES_DE_LA_NOTE, TABLES_DU_SCRIPT, 'même liste que scripts/mise-a-jour-regles.mjs');
    const tables = ['metier'];
    assert.deepEqual(horsListe(FICHIERS.map((f) => `data/rows/${f}`), FICHIERS, tables), []);
    assert.deepEqual(horsListe(['data/rows/race.sql'], ['race.sql'], tables), ['data/rows/race.sql']);
    assert.deepEqual(horsListe(['data/rows/metier.sql'], [], tables), ['data/rows/metier.sql']);
    assert.deepEqual(horsListe(['data/rows/VERSION', 'data/schema.sql'], ['VERSION'], tables), ['data/rows/VERSION', 'data/schema.sql']);
    assert.deepEqual(tablesDuLot(JSON.parse(LOT_JSON)), ['metier']);
    assert.throws(() => tablesDuLot({ journal: { lots: [{ modifications: [{ table: 'x; DROP' }] }] } }));
  });

  test('git : l\'en-tête d\'authentification seulement pour fetch et push, par l\'environnement, jamais en argument ni avec GH_TOKEN', () => {
    const env = { PATH: '/bin', GH_TOKEN: PAT, GITHUB_TOKEN_LECTURE: LECTURE };
    const jetons = { jeton: PAT, jetonLecture: LECTURE, serveur: 'https://github.com/', env };
    const push = environnementGit(['push', '--quiet', 'origin', 'HEAD:refs/heads/x'], jetons);
    assert.deepEqual([push.GIT_CONFIG_COUNT, push.GIT_CONFIG_KEY_0, push.GIT_CONFIG_VALUE_0],
      ['1', 'http.https://github.com/.extraheader', enteteAuthentification(PAT)]);
    assert.equal(enteteAuthentification(PAT), `AUTHORIZATION: basic ${Buffer.from(`x-access-token:${PAT}`).toString('base64')}`);
    assert.equal(push.GIT_TERMINAL_PROMPT, '0');
    assert.ok(!('GH_TOKEN' in push) && !('GITHUB_TOKEN_LECTURE' in push));
    assert.equal(environnementGit(['fetch', 'origin'], jetons).GIT_CONFIG_VALUE_0, enteteAuthentification(LECTURE), 'fetch : le jeton de lecture');
    assert.equal(environnementGit(['fetch', 'origin'], { ...jetons, jetonLecture: null }).GIT_CONFIG_VALUE_0, enteteAuthentification(PAT));
    for (const args of [['status'], ['log', 'origin/dev'], ['-c', 'user.name=x', 'commit', '-m', 'push'], ['checkout', '-B', 'fetch']]) {
      const e = environnementGit(args, jetons);
      assert.ok(!('GIT_CONFIG_COUNT' in e) && !Object.values(e).some((v) => v.includes(Buffer.from(`x-access-token:${PAT}`).toString('base64'))), args.join(' '));
    }
    const suite = environnementGit(['push'], { ...jetons, env: { ...env, GIT_CONFIG_COUNT: '2', GIT_CONFIG_KEY_0: 'a', GIT_CONFIG_VALUE_0: 'b' } });
    assert.deepEqual([suite.GIT_CONFIG_COUNT, suite.GIT_CONFIG_KEY_0, suite.GIT_CONFIG_KEY_2], ['3', 'a', 'http.https://github.com/.extraheader']);
    assert.equal(sousCommandeGit(['-c', 'a=b', '-c', 'c=d', 'push']), 'push');
  });

  test('commande de workflow : %, CR et LF encodés (un texte du lot ne peut pas ouvrir une commande sur une nouvelle ligne)', () => {
    assert.equal(pourCommandeDeWorkflow('a%b\r\n::add-mask::x\rz'), 'a%25b%0D%0A::add-mask::x%0Dz');
  });

  test('git status -z après git add : ce qui a changé hors de l\'index (réécrit, nouveau, supprimé)', () => {
    assert.deepEqual(changementsNonIndexes('M  data/rows/a.sql\0A  data/rows/n.sql\0D  data/rows/d.sql\0'), []);
    assert.deepEqual(changementsNonIndexes('MM data/rows/a.sql\0?? x.txt\0 D data/rows/c.sql\0M  data/rows/b.sql\0'),
      ['data/rows/a.sql', 'data/rows/c.sql', 'x.txt']);
  });

  test('git status -z : modifiés, nouveaux, supprimés, renommés (premier caractère blanc conservé)', () => {
    assert.deepEqual(lireStatut(' M data/rows/b.sql\0?? data/rows/a.sql\0 D data/rows/c.sql\0R  data/rows/n.sql\0data/rows/o.sql\0'),
      ['data/rows/a.sql', 'data/rows/b.sql', 'data/rows/c.sql', 'data/rows/n.sql', 'data/rows/o.sql']);
    assert.deepEqual(lireStatut(''), []);
  });

  test('nom de branche feature/ et date dans le fuseau du propriétaire', () => {
    const quand = horodatage(DEBUT);
    assert.deepEqual(quand, { jour: '2026-10-11', branche: '20261011-1430' });
    assert.equal(nomDeBranche(quand), BRANCHE);
    assert.equal(nomDeBranche(quand, 2), `${BRANCHE}-2`);
    assert.deepEqual(horodatage(new Date('2026-12-31T23:30:00Z')), { jour: '2027-01-01', branche: '20270101-0030' });
  });

  test('corps de PR : marqueur neutralisé, coupé sous la limite de GitHub, pied séparable', () => {
    assert.equal(neutraliserMarqueur('a [V: X+1] b [ v :x + 1 ]'), 'a (V: X+1) b (V: X+1)');
    const long = `## Version 0.2\n\n${'- ligne de note assez longue pour remplir\n'.repeat(3000)}`;
    const corps = corpsDePR(long, `pied [V: X+1] ${RUN}`);
    assert.ok(corps.length < 65_536 && corps.length <= MAX_CORPS + 500);
    assert.doesNotMatch(corps, MARQUEUR_MAJEURE);
    assert.ok(corps.includes(RUN));
    assert.equal(noteDuCorps(corpsDePR('## note\n\n---\ntexte libre', 'pied')), '## note\n\n---\ntexte libre');
  });
});

describe('avec un vrai git (dépôt temporaire)', () => {
  const avecGit = spawnSync('git', ['--version']).status === 0;
  const depot = () => {
    const dir = mkdtempSync(join(racineTemp, 'git-'));
    const g = enveloppeGit(gitLocal(dir));
    g(['init', '--quiet', '-b', 'master']);
    g(['config', 'user.name', 'test']);
    g(['config', 'user.email', 'test@example.com']);
    g(['config', 'commit.gpgsign', 'false']);
    mkdirSync(join(dir, 'data', 'rows'), { recursive: true });
    for (const f of ['metier.sql', 'race.sql']) writeFileSync(join(dir, 'data', 'rows', f), `-- ${f}\n`);
    g(['add', '-A']);
    g(['commit', '--quiet', '-m', 'départ']);
    return { dir, g };
  };

  test('git status -z réel : fichiers modifiés, nouveaux et supprimés de data/rows', { skip: !avecGit && 'git indisponible' }, () => {
    const { dir, g } = depot();
    writeFileSync(join(dir, 'data', 'rows', 'metier.sql'), '-- changé\n');
    writeFileSync(join(dir, 'data', 'rows', 'note_version.sql'), '-- nouveau\n');
    unlinkSync(join(dir, 'data', 'rows', 'race.sql'));
    assert.deepEqual(fichiersModifies(g), ['data/rows/metier.sql', 'data/rows/note_version.sql', 'data/rows/race.sql']);
  });

  test('reprise : le commit « Lot : <id> » et la PR qui l\'a fusionné dans dev ; livré une fois dans master', { skip: !avecGit && 'git indisponible' }, () => {
    const { dir, g } = depot();
    g(['branch', 'dev']);
    g(['checkout', '--quiet', '-b', BRANCHE]);
    writeFileSync(join(dir, 'data', 'rows', 'metier.sql'), '-- lot\n');
    g(['commit', '--quiet', '-am', 'Mise à jour des règles V0.2 (site de dev, lot 0f8fad5b)', '-m', `Lot : ${LOT}\nRun : ${RUN}`]);
    const commit = g(['rev-parse', 'HEAD']).sortie.trim();
    g(['checkout', '--quiet', 'dev']);
    g(['commit', '--quiet', '--allow-empty', '-m', 'autre travail sur dev']);
    g(['merge', '--quiet', '--no-ff', BRANCHE, '-m', `Merge pull request #12 from ${PROPRIETAIRE}/${BRANCHE}`, '-m', `Mise à jour des règles V0.2 (site de dev) (lot ${LOT})`]);
    g(['commit', '--quiet', '--allow-empty', '-m', `chore: version v0.1.77 (feature ${BRANCHE}) (PR #12)`]);
    const master = g(['rev-parse', 'master']).sortie.trim();
    g(['update-ref', 'refs/remotes/origin/dev', 'dev']);
    g(['update-ref', 'refs/remotes/origin/master', master]);
    assert.equal(chercherLotDejaFusionne(g, '1f8fad5b-d9cb-469f-a165-70867728950e'), null, 'un autre lot n\'est pas trouvé');
    assert.deepEqual(chercherLotDejaFusionne(g, LOT), { commit, version: '0.2', livre: false, pr: 12 });
    g(['update-ref', 'refs/remotes/origin/master', 'dev']);
    assert.equal(chercherLotDejaFusionne(g, LOT).livre, true);
  });
});

describe('.github/workflows/mise-a-jour.yml', () => {
  const texte = readFileSync(WORKFLOW, 'utf8');
  const wf = YAML.parse(texte);
  const job = wf.jobs['mise-a-jour'];

  test('déclenché seulement à la main (workflow_dispatch) avec lot, empreinte, adresse et essai', () => {
    assert.equal(wf.name, 'Mise à jour des règles');
    assert.deepEqual(Object.keys(wf.on), ['workflow_dispatch']);
    const entrees = wf.on.workflow_dispatch.inputs;
    assert.deepEqual(Object.keys(entrees), ['lot', 'empreinte', 'adresse', 'essai']);
    for (const nom of ['lot', 'empreinte', 'adresse']) assert.deepEqual([entrees[nom].type, entrees[nom].required], ['string', true], nom);
    assert.deepEqual([entrees.essai.type, entrees.essai.default], ['boolean', false]);
  });

  test('une mise à jour à la fois, jamais annulée ; permissions en lecture seule ; sur dev seulement', () => {
    assert.deepEqual(wf.concurrency, { group: 'mise-a-jour-des-regles', 'cancel-in-progress': false });
    assert.deepEqual(wf.permissions, { contents: 'read', 'pull-requests': 'read', checks: 'read', actions: 'read' });
    assert.deepEqual(Object.keys(wf.jobs), ['mise-a-jour']);
    assert.equal(job.permissions, undefined, 'pas de permission en écriture au niveau du job');
    assert.equal(job.if, "github.ref == 'refs/heads/dev'");
    assert.equal(job['timeout-minutes'], 120);
  });

  test('jeton du bot : garde-fou, checkout de dev complet, script', () => {
    const etapes = job.steps;
    const garde = etapes.find((s) => s.env?.MISE_A_JOUR_TOKEN);
    assert.equal(garde.env.MISE_A_JOUR_TOKEN, '${{ secrets.MISE_A_JOUR_TOKEN }}');
    assert.match(garde.run, /-z "\$MISE_A_JOUR_TOKEN"/);
    assert.match(garde.run, /Fine-grained/);
    const prive = etapes.find((s) => s.env?.IS_PRIVATE);
    assert.equal(prive.env.IS_PRIVATE, '${{ github.event.repository.private }}');
    const checkout = etapes.find((s) => s.uses?.startsWith('actions/checkout@'));
    assert.deepEqual(checkout.with, { ref: 'dev', 'fetch-depth': 0, token: '${{ secrets.MISE_A_JOUR_TOKEN }}', 'persist-credentials': false },
      'le jeton du bot n\'est pas gardé dans .git/config (npm ci et npm test le liraient)');
    const node = etapes.find((s) => s.uses?.startsWith('actions/setup-node@'));
    assert.deepEqual(node.with, { 'node-version-file': '.nvmrc', cache: 'npm', 'cache-dependency-path': 'client/package-lock.json' });
    assert.ok(etapes.some((s) => s.run === 'npm ci' && s['working-directory'] === 'client'));
    const script = etapes.find((s) => s.run?.includes('client/scripts/mise-a-jour-github.mjs'));
    assert.equal(script.run, 'node client/scripts/mise-a-jour-github.mjs');
    assert.equal(script.env.GH_TOKEN, '${{ secrets.MISE_A_JOUR_TOKEN }}');
    assert.equal(script.env.GITHUB_TOKEN_LECTURE, '${{ github.token }}');
    assert.equal(script.env.HOTE_ATTENDU, "${{ vars.MISE_A_JOUR_HOTE || 'dev.maverick-jdr.com' }}", 'un seul hôte permis, même sans la variable');
    // le jeton du bot n'est donné qu'au checkout, au garde-fou et au script (pas à npm ci)
    const avecJeton = etapes.filter((s) => JSON.stringify(s).includes('secrets.MISE_A_JOUR_TOKEN'));
    assert.deepEqual(avecJeton.map((s) => etapes.indexOf(s)), [garde, checkout, script].map((s) => etapes.indexOf(s)));
    for (const [variable, entree] of [['LOT', 'lot'], ['EMPREINTE', 'empreinte'], ['ADRESSE', 'adresse'], ['ESSAI', 'essai']]) {
      assert.equal(script.env[variable], `\${{ inputs.${entree} }}`);
    }
    // les garde-fous passent avant le checkout, le résumé tourne toujours
    const rang = (s) => etapes.indexOf(s);
    assert.ok(rang(prive) < rang(checkout) && rang(garde) < rang(checkout));
    assert.equal(etapes.at(-1).if, 'always()');
  });

  test('aucune expression dans un run: (les entrées passent par env, jamais interpolées dans le shell)', () => {
    for (const s of job.steps) {
      if (!s.run) continue;
      assert.doesNotMatch(s.run, /\$\{\{/, `étape « ${s.name ?? s.run} »`);
    }
    assert.doesNotMatch(texte.replace(/^\s*#.*$/gm, ''), /run:[^\n]*\$\{\{\s*(inputs|github\.event\.inputs)\./);
  });
});
