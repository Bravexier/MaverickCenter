// Le workflow « Mise à jour des règles » (.github/workflows/mise-a-jour.yml) et son orchestration (scripts/mise-a-jour-github.mjs) : ses deux jobs
// (preparer, sans secret ; livrer, seul à recevoir MISE_A_JOUR_TOKEN, en deux étapes « Fusion dans dev » et « Livraison vers master ») contre un
// GitHub, un git et des commandes simulés (aucun réseau, aucun dépôt réel touché, aucune commande lancée), puis les parties git contre de vrais
// dépôts temporaires (un dépôt « distant » local, deux clones : la machine du job preparer et celle du job livrer).
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { MARQUEUR_MAJEURE } from '../../tools/flux-git/regles.mjs';
import { markdownDeLaNote } from '../src/lib/notes-de-version-rendu.mjs';
import {
  ACTION_LOT_EN_ATTENTE, ACTIONS_REGLES, ARTEFACT, CHECKS_REQUIS, CODES_REGLES, CONTROLES, CONTROLES_DE_LA_CI, DELAIS, ESSAIS, ETAPES_DE_LIVRER,
  FORMAT_PREPARATION, JOBS, MAX_CORPS, NOM_ARTEFACT, NON_VERIFIABLE, REF_DU_LOT, SANS_CHASSE, TABLES_DE_LA_NOTE, appliquerSurDev,
  changementsNonIndexes, chercherLotDejaFusionne, corpsDePR, creerBundle, enteteAuthentification, enveloppeGit, environnementGit, etatDesChecks,
  fichiersModifies, fusionDansDev, gitLocal, horodatage, horsListe, importerCommit, lireDiffTree, lirePhase, lireStatut, livraisonVersMaster,
  lotsEnAttente, messageAttendu, messageDeFin, neutraliserMarqueur, neutraliserReferences, noteDuCorps, nomDeBranche, pourCommandeDeWorkflow,
  preparer, sousCommandeGit, tablesAvecBalises, tablesDuLot, TABLES_DES_SOURCES_DE_MAITRISE, verifierCommit, verifierEntrees, verifierPreparation, verifierSimulation,
} from '../scripts/mise-a-jour-github.mjs';
import { TABLES_DES_SOURCES } from '../serveur/edition-maitrises.mjs';
import { TABLES_DE_LA_NOTE as TABLES_DU_SCRIPT } from '../scripts/mise-a-jour-regles.mjs';

const SCRIPT = fileURLToPath(new URL('../scripts/mise-a-jour-github.mjs', import.meta.url));
const REGLES_FLUX = fileURLToPath(new URL('../../tools/flux-git/regles.mjs', import.meta.url));
const WORKFLOW = fileURLToPath(new URL('../../.github/workflows/mise-a-jour.yml', import.meta.url));
const CI = fileURLToPath(new URL('../../.github/workflows/ci.yml', import.meta.url));
const DEPOT = 'Bravexier/MaverickCenter';
const PROPRIETAIRE = 'Bravexier';
const API = `https://api.github.com/repos/${DEPOT}`;
const LOT = '0f8fad5b-d9cb-469f-a165-70867728950e';
const AUTRE_LOT = '7cce0010-1111-4222-8333-944455556666';
const ADRESSE = `https://dev.maverick-jdr.com/api/mise-a-jour/lots/${LOT}/`;
const RUN = `https://github.com/${DEPOT}/actions/runs/123`;
const DEBUT = new Date('2026-10-11T12:30:00Z'); // 14:30 à Paris
const BRANCHE = 'feature/mise-a-jour-regles-20261011-1430';
const PAT = 'jeton-ecriture';
const LECTURE = 'jeton-lecture';
const SANS_HOOKS = ['-c', 'core.hooksPath=/dev/null'];

const sha = (texte) => createHash('sha1').update(texte).digest('hex');
const empreinte = (texte) => createHash('sha256').update(texte).digest('hex');

const lotJson = (extra = {}) => `${JSON.stringify({
  format: 'maverick-mise-a-jour/1', id: LOT, cree_le: '2026-10-11T12:29:00Z', version_dev: '0.1.76', version_cible: '0.2',
  texte: 'Grosse refonte [V: X+1]', ...extra,
  journal: { format: 'maverick-edition/1', lots: [{ id: 'l1', fait_le: '2026-10-10', resume: 'Forgeron', modifications: [
    { rang: 1, table: 'metier', cle: { id: 'forgeron' }, operation: 'update', avant: { bonus: '+1' }, apres: { bonus: '+2' } },
  ] }] },
})}\n`;
const LOT_JSON = lotJson({ simulation: false });
const LOT_ESSAI = lotJson({ simulation: true });
const LOT_ANCIEN = lotJson(); // d'avant le champ « simulation »
const EMPREINTE = empreinte(LOT_JSON);
const FICHIERS = ['historique_modification.sql', 'metier.sql', 'note_version.sql', 'note_version_ligne.sql'];
const CHEMINS = FICHIERS.map((f) => `data/rows/${f}`);

const racineTemp = mkdtempSync(join(tmpdir(), 'mise-a-jour-github-test-'));
after(() => rmSync(racineTemp, { recursive: true, force: true }));
const dossierTemp = (prefixe) => mkdtempSync(join(racineTemp, prefixe));

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
 * Un monde simulé : GitHub (API REST + le site de dev qui sert le lot), le dépôt git local (le même pour les deux jobs : l'artefact, lui, est un
 * vrai dossier), les commandes (mise-a-jour-regles, contrôles). `options` remplace les comportements par défaut (chemin heureux).
 */
function monde(options = {}) {
  const m = {
    appels: [], git: [], executions: [], journal: [], commentaires: [], fusions: [], supprimees: [], commits: [], poussees: [], prefixesPoussees: [],
    pousseesAblanc: [], cherryPicks: [], abandons: 0, attente: 0, devSha: sha('dev-0'), masterSha: sha('master-0'), tete: null, local: null,
    branches: {}, modifies: [], index: [], nouveaux: [], indexes: [], objets: new Map(), refs: {}, nbCommits: 0, nbCherry: 0,
    prs: new Map(), numero: 40, lecturesCommits: 0, versionPour: null, fusionDev: null, livre: false,
    texteLot: LOT_JSON, empreinteEntree: null, statutLot: 200, codeRegles: 0, erreurRegles: null, fichiersResume: FICHIERS, fichiersChanges: null,
    markdown: '## Version 0.2 (depuis la V0.1)\n\nGrosse refonte (V: X+1)\n\n### Métiers\n- Forgeron : bonus : ~~+1~~ → **+2** [V: X+1]\n',
    checks: checksVerts(), fusion: null, fusionnable: null, versionApres: 1, codeNpm: null, masterDansDev: 0, log: null, dejaLivre: false,
    autresLots: [], conflitRebase: false, pushAblanc: null, statutOuverture: null, statutLecturePAT: 200,
    ...options,
  };
  m.artefact = dossierTemp('artefact-');
  const reponse = (statut, donnees, brut = false) => {
    const texte = brut ? donnees : donnees === null ? '' : JSON.stringify(donnees);
    return { status: statut, text: async () => texte, arrayBuffer: async () => new TextEncoder().encode(texte).buffer };
  };
  const route = (methode, chemin, corps, headers) => {
    let x;
    if (methode === 'GET' && chemin.startsWith('/pulls?')) {
      if (headers?.Authorization === `Bearer ${PAT}` && m.statutLecturePAT !== 200) return [m.statutLecturePAT, { message: 'Resource not accessible by personal access token' }];
      const q = new URLSearchParams(chemin.split('?')[1]);
      return [200, [...m.prs.values()].filter((p) => p.state === 'open' && (!q.get('base') || p.base.ref === q.get('base'))
        && (!q.get('head') || q.get('head') === `${PROPRIETAIRE}:${p.head.ref}`))];
    }
    if (methode === 'POST' && chemin === '/pulls') {
      if (m.statutOuverture && corps.base === 'dev') return m.statutOuverture;
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
        m.fusionDev = { commit: pr.head.sha, numero: pr.number, branche: pr.head.ref, fusion, parent: m.devSha };
        m.devSha = sha(`version-${pr.number}`); // livraison.yml : commit de version poussé sur dev
        m.versionPour = { numero: pr.number, branche: pr.head.ref };
      } else {
        m.masterSha = fusion;
        m.livre = true;
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
    const [statut, donnees] = route(methode, chemin, corps, init.headers);
    return reponse(statut, donnees);
  };
  const resoudre = (ref) => {
    const r = String(ref).replace(/\^\{commit\}$/, '');
    if (r === 'HEAD') return m.tete;
    if (r === 'origin/dev') return m.devSha;
    if (r === 'origin/master') return m.masterSha;
    if (m.refs[r]) return m.refs[r];
    return /^[0-9a-f]{40}$/.test(r) ? r : null;
  };
  m.gitFn = (args) => {
    m.git.push(args);
    let i = 0;
    while (args[i] === '-c') i += 2;
    const prefixe = args.slice(0, i);
    const [sous, ...reste] = args.slice(i);
    const ok = (sortie = '') => ({ code: 0, sortie, erreur: '' });
    const ko = (code, erreur) => ({ code, sortie: '', erreur });
    switch (sous) {
      case 'fetch': {
        const bundle = reste.find((a) => a.endsWith('.bundle'));
        if (bundle) {
          const b = JSON.parse(readFileSync(bundle, 'utf8'));
          m.refs[REF_DU_LOT] = b.commit;
          if (b.objet) m.objets.set(b.commit, b.objet);
        }
        return ok();
      }
      case 'rev-parse': {
        const s = resoudre(reste.at(-1));
        return s ? ok(`${s}\n`) : ko(128, `fatal: révision inconnue ${reste.at(-1)}`);
      }
      case 'rev-list': {
        const c = reste.at(-1);
        const o = m.objets.get(c);
        return ok(`${c}${o?.parent ? ` ${o.parent}` : ''}\n`);
      }
      case 'merge-base':
        if (reste[1] === 'origin/master' && reste[2] === 'origin/dev') return { code: m.masterDansDev, sortie: '', erreur: '' };
        return { code: m.dejaLivre || m.livre ? 0 : 1, sortie: '', erreur: '' };
      case 'log': {
        const perso = m.log?.(reste);
        if (perso !== undefined && perso !== null) return ok(perso);
        if (reste[0] === 'origin/master..origin/dev') {
          const lots = [...m.autresLots];
          if (m.fusionDev && !m.livre) lots.push({ sha: m.fusionDev.commit, message: m.objets.get(m.fusionDev.commit)?.message ?? '' });
          return ok(lots.map((l) => `${l.sha}\x1f${l.message}\n\x1e\n`).join(''));
        }
        const grep = reste.find((a) => a.startsWith('--grep='));
        if (grep) return ok(m.fusionDev && grep === `--grep=Lot : ${LOT}` ? `${m.fusionDev.commit}\n` : '');
        if (reste.includes('-1')) {
          const message = m.objets.get(reste.at(-1))?.message ?? '';
          return ok(reste.includes('--format=%s') ? `${message.split('\n')[0]}\n` : `${message}\n`);
        }
        if (reste.includes('--merges')) {
          const f = m.fusionDev;
          return ok(f ? `${f.fusion}\t${f.parent} ${f.commit}\tMerge pull request #${f.numero} from ${PROPRIETAIRE}/${f.branche}\n` : '');
        }
        return ok('');
      }
      case 'checkout':
        m.tete = resoudre(reste.at(-1));
        m.local = reste[reste.indexOf('-B') + 1];
        m.modifies = [];
        m.index = [];
        m.nouveaux = [];
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
      case 'commit': {
        const messages = reste.filter((_, k) => reste[k - 1] === '-m');
        m.nbCommits += 1;
        const s = sha(`commit-${m.nbCommits}`);
        m.objets.set(s, { parent: m.tete, message: messages.join('\n\n'), fichiers: m.index.map((chemin) => ({ chemin, mode: '100644', statut: 'M' })) });
        m.commits.push({ sha: s, messages, prefixe, args: reste });
        m.tete = s;
        m.modifies = [];
        m.index = [];
        return ok();
      }
      case 'update-ref':
        m.refs[reste[0]] = reste[1];
        return ok();
      case 'bundle':
        if (reste[0] === 'create') {
          const [, , fichier, ref, exclu] = reste;
          writeFileSync(fichier, JSON.stringify({ commit: m.refs[ref], base: exclu.slice(1), objet: m.objets.get(m.refs[ref]) }));
          return ok();
        }
        return existsSync(reste.at(-1)) ? ok() : ko(1, 'bundle illisible');
      case 'diff-tree': {
        const o = m.objets.get(reste.at(-1));
        return ok((o?.fichiers ?? []).map((f) => `:100644 ${f.mode} ${'a'.repeat(40)} ${'b'.repeat(40)} ${f.statut}\0${f.chemin}\0`).join(''));
      }
      case 'cherry-pick': {
        if (reste[0] === '--abort') { m.abandons += 1; return ok(); }
        m.cherryPicks.push({ commit: reste[0], prefixe });
        if (m.conflitRebase) return ko(1, 'CONFLICT (content): Merge conflict in data/rows/metier.sql');
        m.nbCherry += 1;
        const s = sha(`cherry-${m.nbCherry}`);
        m.objets.set(s, { ...m.objets.get(reste[0]), parent: m.tete });
        m.tete = s;
        return ok();
      }
      case 'push': {
        if (reste.includes('--dry-run')) {
          m.pousseesAblanc.push({ reste, prefixe });
          return m.pushAblanc ?? ok();
        }
        m.poussees.push(reste);
        m.prefixesPoussees.push(prefixe);
        m.branches[reste.at(-1).replace('HEAD:refs/heads/', '')] = m.tete;
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
      writeFileSync(resume, JSON.stringify({ version: m.versionRegles ?? '0.2', depuis: '0.1', lignes: 1, bilan: { amelioration: 1 }, fichiers: m.fichiersResume, markdown: m.markdown }));
      m.modifies = (m.fichiersChanges ?? m.fichiersResume.map((f) => `data/rows/${f}`)).slice().sort();
      return { code: 0 };
    }
    return { code: m.codeNpm?.(args[1], m) ?? 0 };
  };
  const journal = (t) => m.journal.push(t);
  const communes = (entrees) => ({
    lot: LOT, empreinte: m.empreinteEntree ?? empreinte(m.texteLot), adresse: ADRESSE, essai: false, depot: DEPOT, run: RUN, racine: '/depot',
    artefact: m.artefact, debut: DEBUT, temp: dossierTemp('run-'), ...entrees,
  });
  const outilsDeLivrer = () => ({ fetch: m.fetch, git: m.gitFn, attendre: async (ms) => { m.attente += ms; }, journal });
  m.preparer = (entrees = {}) => preparer(communes(entrees), { fetch: m.fetch, git: m.gitFn, executer: m.executer, journal });
  m.dev = (entrees = {}) => fusionDansDev(communes({ jeton: PAT, jetonLecture: LECTURE, ...entrees }), outilsDeLivrer());
  m.master = (entrees = {}) => livraisonVersMaster(communes({ jeton: PAT, jetonLecture: LECTURE, ...entrees }), outilsDeLivrer());
  /** Le run entier : job preparer, puis les deux étapes du job livrer (qui ne doit lancer aucune commande). */
  m.lancer = async (entrees = {}) => {
    const preparation = await m.preparer(entrees);
    m.apresPreparer?.(m);
    m.appelsDePreparer = m.appels.length;
    const executions = m.executions.length;
    const dev = await m.dev(entrees);
    const master = await m.master(entrees);
    assert.equal(m.executions.length, executions, 'le job livrer n\'exécute aucune commande');
    return { ...master, preparation, dev };
  };
  m.ecritures = () => m.appels.filter((a) => a.methode && a.methode !== 'GET' && a.chemin);
  m.pullsCrees = () => m.appels.filter((a) => a.methode === 'POST' && a.chemin === '/pulls');
  m.lirePreparation = () => JSON.parse(readFileSync(join(m.artefact, ARTEFACT.preparation), 'utf8'));
  m.ecrirePreparation = (p) => writeFileSync(join(m.artefact, ARTEFACT.preparation), JSON.stringify(p));
  m.reecrireBundle = (changer) => {
    const fichier = join(m.artefact, ARTEFACT.commit);
    writeFileSync(fichier, JSON.stringify(changer(JSON.parse(readFileSync(fichier, 'utf8')))));
  };
  return m;
}

const sansPoussee = (m) => {
  assert.deepEqual(m.poussees, []);
  assert.deepEqual(m.ecritures(), [], 'aucune écriture sur GitHub');
};

describe('chemin heureux : preparer, puis livrer (fusion dans dev, livraison vers master)', () => {
  test('lot vérifié et contrôlé sans jeton, artefact relu, PR vers dev verte et fusionnée, version attendue, puis livraison fusionnée', async () => {
    const m = monde();
    const r = await m.lancer();
    assert.equal(r.preparation.etat, 'pret');
    assert.equal(r.dev.etat, 'fusionne');
    assert.equal(r.etat, 'livre');
    assert.equal(r.version, '0.2');
    assert.equal(r.prDev, 41);
    assert.equal(r.prMaster, 42);
    assert.equal(r.versionDev, '0.1.77');

    // preparer : le lot téléchargé une fois depuis son adresse, sans suivre de redirection, avec un délai ; aucune autre requête (aucun jeton)
    const telechargements = m.appels.filter((a) => a.url === ADRESSE);
    assert.equal(telechargements.length, 1);
    assert.equal(telechargements[0].init.redirect, 'error');
    assert.ok(telechargements[0].init.signal instanceof AbortSignal);
    assert.equal(m.appelsDePreparer, 1, 'le job preparer n\'appelle pas l\'API GitHub');
    assert.ok(m.git.some((a) => a.join(' ') === `checkout --quiet -B ${BRANCHE} origin/dev`));
    const regles = m.executions.find((e) => e.args.some((a) => a.endsWith('mise-a-jour-regles.mjs')));
    assert.deepEqual(regles.args.slice(regles.args.indexOf('--reference'), regles.args.indexOf('--reference') + 4), ['--reference', 'origin/master', '--date', '2026-10-11']);
    assert.equal(readFileSync(regles.args[regles.args.indexOf('--lot') + 1], 'utf8'), LOT_JSON, 'le lot est passé tel que téléchargé');
    assert.ok(!('GH_TOKEN' in (regles.env ?? {})), 'les commandes ne reçoivent pas le jeton');
    // tous les contrôles, dont le job client de ci.yml, par sh -c dans client/, avec un RUNNER_TEMP à eux
    const controles = m.executions.filter((e) => e.commande === 'sh');
    assert.deepEqual(controles.map((e) => e.args), CONTROLES.map((c) => ['-c', c]));
    assert.ok(controles.every((e) => e.cwd === '/depot/client' && e.env.RUNNER_TEMP?.includes('controles') && !('GH_TOKEN' in e.env)));
    // commit : seulement les fichiers de data/rows annoncés, auteur github-actions[bot], sans hooks
    assert.deepEqual(m.indexes, CHEMINS);
    assert.equal(m.commits.length, 1);
    assert.equal(m.commits[0].messages[0], 'Mise à jour des règles V0.2 (site de dev, lot 0f8fad5b)');
    assert.match(m.commits[0].messages[1], new RegExp(`^Lot : ${LOT}\nRun : ${RUN}\n`));
    assert.ok(m.commits[0].prefixe.includes('user.name=github-actions[bot]') && m.commits[0].prefixe.includes('core.hooksPath=/dev/null'));
    // l'artefact : le lot tel que servi, le bundle, la préparation
    assert.equal(readFileSync(join(m.artefact, ARTEFACT.lot), 'utf8'), LOT_JSON);
    assert.ok(existsSync(join(m.artefact, ARTEFACT.commit)));
    const p = m.lirePreparation();
    assert.deepEqual({ format: p.format, etat: p.etat, base: p.base, commit: p.commit, version: p.version, fichiers: p.fichiers, essai: p.essai },
      { format: FORMAT_PREPARATION, etat: 'pret', base: sha('dev-0'), commit: m.commits[0].sha, version: '0.2', fichiers: CHEMINS, essai: false });
    assert.ok(m.git.some((a) => a.join(' ') === `bundle create --quiet ${join(m.artefact, ARTEFACT.commit)} ${REF_DU_LOT} ^${sha('dev-0')}`));

    // livrer : bundle vérifié et importé, commit contrôlé (diff-tree, message), dev inchangé → poussé tel quel, sans hooks
    assert.ok(m.git.some((a) => a[0] === 'bundle' && a[1] === 'verify'));
    assert.ok(m.git.some((a) => a[0] === 'diff-tree' && a.at(-2) === sha('dev-0') && a.at(-1) === m.commits[0].sha));
    assert.deepEqual(m.cherryPicks, [], 'dev n\'a pas bougé : pas de rebase');
    assert.deepEqual(m.poussees, [['--quiet', 'origin', `HEAD:refs/heads/${BRANCHE}`]]);
    assert.deepEqual(m.prefixesPoussees, [SANS_HOOKS]);
    assert.equal(m.branches[BRANCHE], m.commits[0].sha, 'le commit préparé est poussé tel quel');

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
    assert.ok(m.appels.some((a) => a.chemin === `/commits/${m.branches[BRANCHE]}/check-runs?per_page=100&filter=latest`));
    assert.ok(m.appels.some((a) => a.chemin === `/commits/${sha('version-41')}/check-runs?per_page=100&filter=latest`));
    assert.equal(m.commentaires.length, 0);
    assert.ok(m.attente > 0);
    assert.match(messageDeFin('master', r), /^\*\*Terminé\*\* : V0\.2/);
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

  test('séparation des jobs : preparer refuse tout jeton ; livrer exige le sien et ne reçoit aucun outil pour lancer une commande', async () => {
    for (const jetons of [{ jeton: PAT }, { jetonLecture: LECTURE }]) {
      const m = monde();
      await assert.rejects(m.preparer(jetons), (e) => e.etape === 'entrees' && /aucun jeton/.test(e.message));
      assert.deepEqual([m.appels, m.git, m.executions], [[], [], []]);
    }
    const m = monde();
    await m.preparer();
    await assert.rejects(m.dev({ jeton: null }), (e) => e.etape === 'entrees' && /MISE_A_JOUR_TOKEN/.test(e.message));
    // l'outil `executer` n'est pas donné au job livrer (outilsDeLivrer) : la phase réussit sans lui, et m.lancer contrôle qu'il n'y a rien eu
    assert.equal((await m.dev()).etat, 'fusionne');
  });
});

describe('preparer : refus avant toute publication', () => {
  test('empreinte fausse : échec sans rien faire (ni git, ni commande, ni artefact)', async () => {
    const m = monde({ texteLot: LOT_JSON.replace('+2', '+3'), empreinteEntree: EMPREINTE });
    await assert.rejects(m.preparer(), (e) => e.etape === 'lot' && /empreinte du lot différente/.test(e.message));
    assert.deepEqual(m.git, []);
    assert.deepEqual(m.executions, []);
    assert.ok(!existsSync(join(m.artefact, ARTEFACT.preparation)));
  });

  test('lot indisponible (404) : échec', async () => {
    const m = monde({ statutLot: 404 });
    await assert.rejects(m.preparer(), /répondu 404/);
    assert.deepEqual(m.executions, []);
  });

  test('le lot dit s\'il est une simulation : refus dans les deux sens, avant tout (étape « entrees »)', async () => {
    const cas = [
      { texteLot: LOT_ESSAI, essai: false, motif: /figé pour une simulation/ },
      { texteLot: LOT_JSON, essai: true, motif: /lot de vraie mise à jour/ },
      { texteLot: LOT_ANCIEN, essai: true, motif: /lot de vraie mise à jour/ },
    ];
    for (const { texteLot, essai, motif } of cas) {
      const m = monde({ texteLot });
      await assert.rejects(m.preparer({ essai }), (e) => e.etape === 'entrees' && motif.test(e.message) && /Rien n'est fait/.test(e.message), `essai=${essai}`);
      assert.deepEqual([m.git, m.executions], [[], []], `essai=${essai} : rien n'est fait`);
    }
    // un lot d'avant le champ « simulation » est une vraie mise à jour
    assert.equal((await monde({ texteLot: LOT_ANCIEN }).preparer()).etat, 'pret');
    assert.equal((await monde({ texteLot: LOT_ESSAI }).preparer({ essai: true })).etat, 'pret');
    assert.throws(() => verifierSimulation({ simulation: true }, false), (e) => e.etape === 'entrees');
    assert.doesNotThrow(() => verifierSimulation({}, false));
  });

  test('une autre mise à jour attend sa livraison dans dev (commit « Lot : » hors de master) : refus immédiat, rien n\'est fait', async () => {
    const autre = { sha: sha('autre-lot'), message: `Mise à jour des règles V0.2 (site de dev, lot 7cce0010)\n\nLot : ${AUTRE_LOT}\nRun : https://github.com/${DEPOT}/actions/runs/99\n` };
    const m = monde({ autresLots: [autre] });
    await assert.rejects(m.preparer(), (e) => e.etape === 'depart' && e.message.includes(`la V0.2 du lot ${AUTRE_LOT} est dans dev`)
      && e.message.includes(ACTION_LOT_EN_ATTENTE) && e.message.includes('actions/runs/99'));
    assert.deepEqual(m.executions, []);
    assert.ok(!m.git.some((a) => a[0] === 'checkout'));
    // le lot courant lui-même, dans dev sans être livré (relance), n'est pas « une autre » mise à jour
    const meme = monde({ autresLots: [{ sha: sha('meme'), message: `Mise à jour des règles V0.2 (site de dev, lot 0f8fad5b)\n\nLot : ${LOT}\n` }] });
    assert.equal((await meme.preparer()).etat, 'pret');
  });

  test('mise-a-jour-regles code 7 (même version d\'un autre lot dans dev) : échec avec l\'action à faire', async () => {
    assert.match(CODES_REGLES[7], /autre mise à jour/);
    assert.equal(ACTIONS_REGLES[7], ACTION_LOT_EN_ATTENTE);
    assert.match(ACTION_LOT_EN_ATTENTE, /Re-run/);
    assert.match(ACTION_LOT_EN_ATTENTE, /livrer dev → master/);
    const m = monde({ codeRegles: 7, erreurRegles: `la V0.2 du lot ${AUTRE_LOT} est dans dev mais pas encore sur master` });
    await assert.rejects(m.preparer(), (e) => e.etape === 'lot' && /code 7 : une autre mise à jour/.test(e.message)
      && e.message.includes(AUTRE_LOT) && e.message.includes(ACTION_LOT_EN_ATTENTE));
    assert.ok(!m.executions.some((e) => e.commande === 'sh'), 'pas de contrôles');
  });

  test('conflit (mise-a-jour-regles code 3) : échec avec le message', async () => {
    const m = monde({ codeRegles: 3, erreurRegles: '1 lot(s) en conflit avec dev : « Forgeron » (bonus : avant différent)' });
    await assert.rejects(m.preparer(), (e) => e.etape === 'lot' && /code 3 : conflit avec dev/.test(e.message) && /Forgeron/.test(e.message));
    assert.ok(!m.executions.some((e) => e.commande === 'sh'), 'pas de contrôles après un conflit');
    assert.equal(m.commits.length, 0);
  });

  test('fichier hors des fichiers annoncés, ou table annoncée absente du journal : échec (double contrôle)', async () => {
    const m = monde({ fichiersChanges: [...CHEMINS, 'client/package.json'] });
    await assert.rejects(m.preparer(), (e) => e.etape === 'liste' && /client\/package\.json/.test(e.message));
    const n = monde({ fichiersResume: [...FICHIERS, 'race.sql'] });
    await assert.rejects(n.preparer(), (e) => e.etape === 'liste' && /data\/rows\/race\.sql/.test(e.message));
    assert.equal(m.commits.length + n.commits.length, 0);
  });

  test('un contrôle rouge, dont ceux du site construit (npm run build, tests *-html) : échec, rien n\'est commité', async () => {
    for (const rouge of ['npm test', 'npm run build', CONTROLES_DE_LA_CI[2], CONTROLES_DE_LA_CI.at(-1)]) {
      const m = monde({ codeNpm: (commande) => (commande === rouge ? 1 : 0) });
      await assert.rejects(m.preparer(), (e) => e.etape === 'controles' && e.message.includes(rouge), rouge);
      assert.equal(m.commits.length, 0, rouge);
      assert.ok(!existsSync(join(m.artefact, ARTEFACT.commit)), rouge);
    }
  });

  test('un contrôle réécrit un fichier de la liste, ou en crée un (même en simulation) : échec', async () => {
    const m = monde({ codeNpm: (commande, monde) => { if (commande === 'npm test') monde.modifies.push('data/rows/metier.sql'); return 0; } });
    await assert.rejects(m.preparer(), (e) => e.etape === 'controles' && /data\/rows\/metier\.sql/.test(e.message));
    for (const essai of [false, true]) {
      const n = monde({ texteLot: essai ? LOT_ESSAI : LOT_JSON, codeNpm: (commande, monde) => { if (commande === 'npm run build') monde.nouveaux.push('data/rows/autre.sql'); return 0; } });
      await assert.rejects(n.preparer({ essai }), (e) => e.etape === 'controles' && /data\/rows\/autre\.sql/.test(e.message));
      assert.equal(n.commits.length, 0);
    }
  });

  test('aucun changement : « rien » publié, puis rien à livrer dans les deux étapes (aucune PR)', async () => {
    const m = monde({ fichiersChanges: [] });
    const r = await m.lancer();
    assert.deepEqual([r.preparation.etat, r.dev.etat, r.etat], ['rien', 'rien', 'rien']);
    sansPoussee(m);
    assert.equal(m.commits.length, 0);
  });

  test('master absente de dev (refusion en attente) : échec avant le rejeu', async () => {
    const m = monde({ masterDansDev: 1 });
    await assert.rejects(m.preparer(), (e) => e.etape === 'depart');
    assert.deepEqual(m.executions, []);
  });
});

describe('livrer : l\'artefact est revérifié (un job preparer compromis ne fait rien pousser d\'autre)', () => {
  const apresPreparation = async (options = {}) => {
    const m = monde(options);
    await m.preparer();
    return m;
  };
  const refuse = async (m, predicat) => {
    await assert.rejects(m.dev(), predicat);
    sansPoussee(m);
    assert.deepEqual(m.pousseesAblanc, []);
  };

  test('lot de l\'artefact différent de l\'empreinte de l\'entrée : refusé', async () => {
    const m = await apresPreparation();
    writeFileSync(join(m.artefact, ARTEFACT.lot), LOT_JSON.replace('+2', '+9'));
    await refuse(m, (e) => e.etape === 'artefact' && /empreinte du lot différente/.test(e.message));
  });

  test('préparation d\'un autre lot, d\'un autre mode, ou illisible : refusée', async () => {
    for (const changer of [(p) => ({ ...p, lot: AUTRE_LOT }), (p) => ({ ...p, essai: true }), (p) => ({ ...p, empreinte: 'f'.repeat(64) }),
      (p) => ({ ...p, fichiers: ['client/package.json'] }), (p) => ({ ...p, etat: 'autre' }), (p) => ({ ...p, quand: { branche: '../x' } })]) {
      const m = await apresPreparation();
      m.ecrirePreparation(changer(m.lirePreparation()));
      await refuse(m, (e) => e.etape === 'artefact');
    }
  });

  test('commit du bundle qui touche hors de data/rows/<tables du lot> (workflow, autre table, lien symbolique) : refusé', async () => {
    const fichiers = [
      { chemin: '.github/workflows/ci.yml', mode: '100644', statut: 'M' },
      { chemin: 'data/rows/race.sql', mode: '100644', statut: 'M' },
      { chemin: 'data/rows/metier.sql', mode: '120000', statut: 'T' },
    ];
    for (const f of fichiers) {
      const m = await apresPreparation();
      m.reecrireBundle((b) => ({ ...b, objet: { ...b.objet, fichiers: [...b.objet.fichiers.filter((x) => x.chemin !== f.chemin), f] } }));
      await refuse(m, (e) => e.etape === 'liste' && e.message.includes(f.chemin));
    }
  });

  test('message du commit modifié (une ligne « Lot : » d\'un autre lot glissée) : refusé', async () => {
    const m = await apresPreparation();
    m.reecrireBundle((b) => ({ ...b, objet: { ...b.objet, message: `${b.objet.message}\nLot : ${AUTRE_LOT}` } }));
    await refuse(m, (e) => e.etape === 'artefact' && /message du commit/.test(e.message));
  });

  test('bundle d\'un autre commit, ou commit qui n\'a pas la base pour seul parent : refusé', async () => {
    const m = await apresPreparation();
    m.reecrireBundle((b) => ({ ...b, commit: sha('autre'), objet: b.objet }));
    await refuse(m, (e) => e.etape === 'artefact' && /le bundle porte/.test(e.message));
    const n = await apresPreparation();
    n.reecrireBundle((b) => ({ ...b, objet: { ...b.objet, parent: sha('ailleurs') } }));
    await refuse(n, (e) => e.etape === 'artefact' && /seul parent/.test(e.message));
    const o = await apresPreparation();
    unlinkSync(join(o.artefact, ARTEFACT.commit));
    await refuse(o, (e) => e.etape === 'artefact' && /incomplet/.test(e.message));
  });

  test('une autre mise à jour arrive dans dev entre les deux jobs : refus au départ de livrer', async () => {
    const m = await apresPreparation();
    m.autresLots = [{ sha: sha('autre-lot'), message: `Mise à jour des règles V0.2 (site de dev, lot 7cce0010)\n\nLot : ${AUTRE_LOT}\n` }];
    await refuse(m, (e) => e.etape === 'depart' && e.message.includes(AUTRE_LOT) && e.message.includes(ACTION_LOT_EN_ATTENTE));
    await assert.rejects(m.master(), (e) => e.etape === 'depart');
  });

  test('livrer lancé dans un autre mode que le lot (case « essai » changée) : refusé avant tout', async () => {
    const m = await apresPreparation();
    await assert.rejects(m.dev({ essai: true }), (e) => e.etape === 'entrees' && /lot de vraie mise à jour/.test(e.message));
    assert.deepEqual(m.pousseesAblanc, []);
    sansPoussee(m);
  });
});

describe('livrer : dev qui bouge, checks, reprise', () => {
  test('dev a bougé depuis la préparation (sans conflit) : commit rejoué par cherry-pick (sans hooks, par le bot), poussé, fusionné', async () => {
    const m = monde({ apresPreparer: (monde) => { monde.devSha = sha('dev-1'); } });
    const r = await m.lancer();
    assert.equal(r.etat, 'livre');
    assert.equal(m.cherryPicks.length, 1);
    assert.equal(m.cherryPicks[0].commit, r.preparation.commit);
    assert.ok(m.cherryPicks[0].prefixe.includes('core.hooksPath=/dev/null') && m.cherryPicks[0].prefixe.includes('user.name=github-actions[bot]'));
    assert.ok(m.git.some((a) => a.join(' ') === `checkout --quiet -B ${BRANCHE} origin/dev`));
    assert.equal(m.branches[BRANCHE], sha('cherry-1'));
    assert.ok(m.git.some((a) => a[0] === 'diff-tree' && a.at(-2) === sha('dev-1') && a.at(-1) === sha('cherry-1')), 'le commit rejoué est revérifié');
    assert.equal(m.executions.filter((e) => e.args.some((a) => a.endsWith('mise-a-jour-regles.mjs'))).length, 1, 'le lot n\'est pas rejoué par npm');
  });

  test('dev a modifié les mêmes lignes : échec net (relancez), cherry-pick abandonné, rien n\'est poussé', async () => {
    const m = monde({ apresPreparer: (monde) => { monde.devSha = sha('dev-1'); monde.conflitRebase = true; } });
    await assert.rejects(m.lancer(), (e) => e.etape === 'rebase' && /mêmes lignes/.test(e.message) && /relancez la mise à jour/.test(e.message));
    assert.equal(m.abandons, 1);
    sansPoussee(m);
  });

  test('ouverture de la PR refusée après la poussée : la branche poussée est supprimée', async () => {
    const m = monde({ statutOuverture: [403, { message: 'Resource not accessible by personal access token' }] });
    await assert.rejects(m.lancer(), (e) => e.etape === 'pr-dev' && /403/.test(e.message) && /supprimée/.test(e.message));
    assert.deepEqual(m.poussees.map((p) => p.at(-1)), [`HEAD:refs/heads/${BRANCHE}`]);
    assert.deepEqual(m.supprimees, [BRANCHE]);
    assert.equal(m.prs.size, 0);
  });

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

  test('dev bouge (405 à la fusion) : PR fermée, branche supprimée, commit rejoué sur le nouveau dev (rebase textuel)', async () => {
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
    assert.equal(m.executions.filter((e) => e.args.some((a) => a.endsWith('mise-a-jour-regles.mjs'))).length, 1);
    assert.equal(m.cherryPicks.length, 1, 'le commit est rejoué sur le nouveau dev');
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

  test('version majeure (case « Version majeure » du lot) : seul le titre de la PR de livraison porte [V: X+1], et il le garde jusqu\'à la fusion', async () => {
    // mise-a-jour-regles écrit la note en V1.0 pour un lot majeur (versionDeLivraison, testé dans mise-a-jour-regles)
    const m = monde({ texteLot: lotJson({ simulation: false, majeure: true, version_cible: '1.0' }), versionRegles: '1.0' });
    const r = await m.lancer();
    assert.deepEqual([r.etat, r.version, r.majeure], ['livre', '1.0', true]);
    const [prDev, prMaster] = m.pullsCrees();
    assert.equal(prDev.corps.title, 'Mise à jour des règles V1.0 (site de dev)', 'la PR vers dev ne porte pas le marqueur');
    assert.equal(prMaster.corps.title, 'Livraison V1.0 (mise à jour du site de dev) [V: X+1]');
    assert.match(prMaster.corps.title, MARQUEUR_MAJEURE, 'livraison.yml lit le titre de la PR (tools/flux-git/cli.mjs#appliquer)');
    // le marqueur n'est que dans ce titre (et le message de sa fusion, qui le reprend) : jamais dans un corps, un commentaire, la PR vers dev
    for (const a of m.ecritures()) {
      const sansTitre = a.chemin === '/pulls' && a.corps?.base === 'master' ? { ...a.corps, title: '' } : a.chemin === '/pulls/42/merge' ? { ...a.corps, commit_message: '' } : a.corps;
      assert.doesNotMatch(JSON.stringify(sansTitre ?? {}), MARQUEUR_MAJEURE, `${a.methode} ${a.chemin}`);
    }
    assert.deepEqual(m.fusions.map((f) => f.numero), [41, 42]);
    assert.match(m.journal.join('\n'), /version majeure/);
    assert.match(messageDeFin('master', r), /^\*\*Terminé\*\* : V1\.0 .*version majeure/);
  });

  test('version majeure : une PR de livraison déjà ouverte sans [V: X+1] est laissée au propriétaire ; avec, elle est reprise', async () => {
    const lot = lotJson({ simulation: false, majeure: true, version_cible: '1.0' });
    const m = monde({ texteLot: lot, versionRegles: '1.0' });
    m.prs.set(30, { number: 30, title: 'Livraison', body: 'notes', state: 'open', html_url: 'u', head: { ref: 'dev', sha: m.devSha }, base: { ref: 'master' }, lectures: 0 });
    await assert.rejects(m.lancer(), (e) => e.etape === 'pr-master' && e.pr === 30 && /sans \[V: X\+1\]/.test(e.message));
    assert.deepEqual(m.fusions.map((f) => f.numero), [41]);

    const reprise = monde({ texteLot: lot, versionRegles: '1.0' });
    reprise.prs.set(30, { number: 30, title: 'Livraison V1.0 [V: X+1]', body: '', state: 'open', html_url: 'u', head: { ref: 'dev', sha: reprise.devSha }, base: { ref: 'master' }, lectures: 0 });
    const r = await reprise.lancer();
    assert.deepEqual([r.prMaster, r.majeure], [30, true]);
    assert.deepEqual(reprise.fusions.map((f) => f.numero), [41, 30]);
  });

  test('version majeure : [V: X+1] retiré du titre de la PR de livraison pendant l\'attente → jamais fusionnée (elle ferait une version mineure)', async () => {
    for (const lecture of [1, 2]) {
      const m = monde({
        texteLot: lotJson({ simulation: false, majeure: true, version_cible: '1.0' }), versionRegles: '1.0',
        surLecturePR: (pr) => { if (pr.base.ref === 'master' && pr.lectures === lecture) pr.title = 'Livraison V1.0'; },
      });
      await assert.rejects(m.lancer(), (e) => e.etape === 'pr-master' && e.pr === 42 && /version mineure/.test(e.message), `lecture ${lecture}`);
      assert.deepEqual(m.fusions.map((f) => f.numero), [41], `lecture ${lecture}`);
      assert.equal(m.prs.get(42).state, 'open');
    }
  });

  test('version majeure : « majeure » du lot est vérifié (true ou false, couvert par l\'empreinte) ; absent, la livraison est mineure', async () => {
    const m = monde({ texteLot: lotJson({ simulation: false, majeure: 'oui' }) });
    await assert.rejects(m.preparer(), (e) => e.etape === 'lot' && /« majeure »/.test(e.message));
    const ancien = monde({ texteLot: lotJson({ simulation: false }) });
    const r = await ancien.lancer();
    assert.equal(r.majeure, false);
    assert.equal(ancien.pullsCrees()[1].corps.title, 'Livraison V0.2 (mise à jour du site de dev)');
  });

  test('livraison : le commit de version n\'arrive pas en 20 min → échec de « Livraison vers master » seule, pas de PR vers master', async () => {
    const m = monde({ versionApres: Infinity });
    await m.preparer();
    assert.equal((await m.dev()).etat, 'fusionne', '« Fusion dans dev » réussit');
    await assert.rejects(m.master(), (e) => e.etape === 'version-dev' && /PR #41/.test(e.message));
    assert.equal(m.pullsCrees().length, 1);
  });

  test('relance des jobs en échec (Re-run failed jobs) après une livraison ratée : « Fusion dans dev » reprend sans rien refaire', async () => {
    const m = monde({ versionApres: Infinity });
    await m.preparer();
    await m.dev();
    await assert.rejects(m.master());
    m.versionApres = 0;
    const poussees = m.poussees.length;
    const dev = await m.dev();
    assert.deepEqual([dev.etat, dev.reprise, dev.pr], ['fusionne', true, 41]);
    assert.equal(m.poussees.length, poussees, 'rien n\'est repoussé');
    const r = await m.master();
    assert.deepEqual([r.etat, r.prDev, r.prMaster], ['livre', 41, 42]);
    assert.equal(m.pullsCrees().length, 2);
  });

  test('reprise : lot déjà fusionné dans dev (relance de tous les jobs) → rien rejoué, directement la livraison', async () => {
    const commit = sha('lot-commit');
    const fusion = sha('lot-fusion');
    const m = monde({
      log: (reste) => {
        if (reste.some((a) => a.startsWith('--grep='))) return `${commit}\n`;
        if (reste.includes('-1')) return 'Mise à jour des règles V0.2 (site de dev, lot 0f8fad5b)\n';
        if (reste.includes('--merges')) return `${fusion}\t${sha('dev-0')} ${commit}\tMerge pull request #12 from ${PROPRIETAIRE}/feature/mise-a-jour-regles-20261010-0900\n`;
        return null;
      },
    });
    m.prs.set(12, { number: 12, title: 'Mise à jour des règles V0.2 (site de dev)', body: corpsDePR('## Version 0.2\n\nla note', 'pied'), state: 'closed', merged: true, html_url: 'u12', head: { ref: 'x', sha: commit }, base: { ref: 'dev' }, lectures: 0 });
    m.versionPour = { numero: 12, branche: 'feature/mise-a-jour-regles-20261010-0900' };
    m.versionApres = 0;
    const r = await m.lancer();
    assert.equal(r.preparation.etat, 'reprise');
    assert.deepEqual([r.dev.etat, r.dev.reprise], ['fusionne', true]);
    assert.equal(r.etat, 'livre');
    assert.equal(r.prDev, 12);
    assert.deepEqual(m.executions, [], 'le lot n\'est pas rejoué');
    assert.deepEqual(m.poussees, []);
    const [livraison] = m.pullsCrees();
    assert.equal(livraison.corps.base, 'master');
    assert.ok(livraison.corps.body.startsWith('## Version 0.2\n\nla note'), 'la note de la PR vers dev, sans son pied');
  });

  test('reprise : lot déjà livré sur master → rien, dans les trois phases', async () => {
    const m = monde({ dejaLivre: true, log: (reste) => (reste.some((a) => a.startsWith('--grep=')) ? `${sha('c')}\n` : reste.includes('-1') ? 'Mise à jour des règles V0.2 (site de dev, lot 0f8fad5b)\n' : null) });
    const r = await m.lancer();
    assert.deepEqual([r.preparation.etat, r.dev.etat, r.etat], ['deja-livre', 'deja-livre', 'deja-livre']);
    assert.deepEqual(m.ecritures(), []);
    assert.deepEqual(m.executions, []);
  });

  test('« Livraison vers master » sans le lot dans dev (hors simulation) : échec, rien n\'est livré', async () => {
    const m = monde();
    await m.preparer();
    await assert.rejects(m.master(), (e) => e.etape === 'reprise' && /Fusion dans dev/.test(e.message));
    assert.deepEqual(m.ecritures(), []);
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

describe('simulation de mise à jour : vraie vérification, sans effet de bord', () => {
  const essai = (options = {}) => monde({ texteLot: LOT_ESSAI, ...options });

  test('preparer fait tous les contrôles ; livrer vérifie artefact et jeton (push --dry-run, lecture des PR) ; rien n\'est poussé ni ouvert', async () => {
    const m = essai();
    const r = await m.lancer({ essai: true });
    assert.equal(r.preparation.etat, 'pret');
    assert.equal(r.preparation.essai, true);
    assert.deepEqual(m.executions.filter((e) => e.commande === 'sh').map((e) => e.args[1]), CONTROLES, 'tous les contrôles tournent');
    assert.equal(r.dev.etat, 'essai');
    assert.equal(r.dev.rejoue, false);
    assert.equal(r.etat, 'essai');
    sansPoussee(m);
    assert.equal(m.prs.size, 0);
    // le commit est appliqué à blanc, puis la poussée est essayée à blanc avec le jeton, sans hooks
    assert.ok(m.git.some((a) => a[0] === 'diff-tree'));
    assert.deepEqual(m.pousseesAblanc.map((p) => p.reste), [['--dry-run', '--quiet', 'origin', `HEAD:refs/heads/${BRANCHE}`]]);
    assert.deepEqual(m.pousseesAblanc[0].prefixe, SANS_HOOKS);
    assert.ok(environnementGit(['-c', 'core.hooksPath=/dev/null', 'push', '--dry-run'], { jeton: PAT, env: {} }).GIT_CONFIG_VALUE_0 === enteteAuthentification(PAT),
      'la poussée à blanc est authentifiée par le jeton du bot');
    const lecturePAT = m.appels.filter((a) => a.headers?.Authorization === `Bearer ${PAT}`);
    assert.deepEqual(lecturePAT.map((a) => `${a.methode} ${a.chemin}`), ['GET /pulls?state=open&per_page=1'], 'le jeton du bot ne sert qu\'à une lecture');
    // le résumé dit ce qui est vérifié et ce qui ne l'est pas
    const fin = messageDeFin('dev', r.dev);
    assert.match(fin, /Simulation \(Fusion dans dev\) réussie/);
    for (const x of NON_VERIFIABLE) assert.ok(fin.includes(x));
    assert.match(fin, /push --dry-run/);
    assert.match(messageDeFin('master', r), /Pull requests en écriture/);
  });

  test('jeton sans écriture (push --dry-run refusé) ou sans lecture des PR : la simulation échoue', async () => {
    const m = essai({ pushAblanc: { code: 128, sortie: '', erreur: 'remote: Permission to Bravexier/MaverickCenter.git denied to bot.\nfatal: unable to access' } });
    await assert.rejects(m.lancer({ essai: true }), (e) => e.etape === 'jeton' && /Permission to/.test(e.message) && /Contents/.test(e.message));
    sansPoussee(m);
    const n = essai({ statutLecturePAT: 403 });
    await assert.rejects(n.lancer({ essai: true }), (e) => e.etape === 'jeton' && /403/.test(e.message) && /Pull requests/.test(e.message));
    sansPoussee(n);
  });

  test('dev a bougé depuis la préparation : rebase à blanc (propre : réussite ; conflit : échec), toujours sans poussée', async () => {
    const m = essai({ apresPreparer: (monde) => { monde.devSha = sha('dev-1'); } });
    const r = await m.lancer({ essai: true });
    assert.equal(r.dev.rejoue, true);
    assert.equal(m.cherryPicks.length, 1);
    sansPoussee(m);
    const n = essai({ apresPreparer: (monde) => { monde.devSha = sha('dev-1'); monde.conflitRebase = true; } });
    await assert.rejects(n.lancer({ essai: true }), (e) => e.etape === 'rebase');
    assert.deepEqual(n.pousseesAblanc, []);
    sansPoussee(n);
  });

  test('une PR de livraison ouverte avec [V: X+1] ferait échouer la vraie livraison : la simulation aussi', async () => {
    const m = essai();
    m.prs.set(30, { number: 30, title: 'Livraison [V: X+1]', body: '', state: 'open', html_url: 'u', head: { ref: 'dev', sha: m.devSha }, base: { ref: 'master' }, lectures: 0 });
    await assert.rejects(m.lancer({ essai: true }), (e) => e.etape === 'pr-master' && /#30/.test(e.message));
    sansPoussee(m);
  });

  test('simulation d\'une version majeure : une PR de livraison ouverte sans [V: X+1] ferait échouer la vraie ; sinon, elle le dit', async () => {
    const lot = lotJson({ simulation: true, majeure: true, version_cible: '1.0' });
    const m = essai({ texteLot: lot, versionRegles: '1.0' });
    m.prs.set(30, { number: 30, title: 'Livraison', body: '', state: 'open', html_url: 'u', head: { ref: 'dev', sha: m.devSha }, base: { ref: 'master' }, lectures: 0 });
    await assert.rejects(m.lancer({ essai: true }), (e) => e.etape === 'pr-master' && /#30/.test(e.message) && /sans \[V: X\+1\]/.test(e.message));
    sansPoussee(m);
    const n = essai({ texteLot: lot, versionRegles: '1.0' });
    const r = await n.lancer({ essai: true });
    assert.deepEqual([r.etat, r.majeure], ['essai', true]);
    assert.match(messageDeFin('master', r), /version majeure/);
    sansPoussee(n);
  });

  test('simulation d\'un lot déjà dans dev : les deux étapes le disent, sans rien écrire', async () => {
    const commit = sha('lot-commit');
    const m = essai({
      log: (reste) => {
        if (reste.some((a) => a.startsWith('--grep='))) return `${commit}\n`;
        if (reste.includes('-1')) return 'Mise à jour des règles V0.2 (site de dev, lot 0f8fad5b)\n';
        if (reste.includes('--merges')) return `${sha('f')}\t${sha('dev-0')} ${commit}\tMerge pull request #12 from ${PROPRIETAIRE}/x\n`;
        return null;
      },
    });
    const r = await m.lancer({ essai: true });
    assert.deepEqual([r.preparation.etat, r.dev.etat, r.dev.reprise, r.etat, r.reprise], ['reprise', 'essai', true, 'essai', true]);
    assert.equal(m.pousseesAblanc.length, 1, 'le jeton est quand même vérifié');
    sansPoussee(m);
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

  test('phase : preparer, dev ou master', () => {
    assert.equal(lirePhase(['--phase', 'dev']), 'dev');
    assert.throws(() => lirePhase([]), (e) => e.etape === 'entrees');
    assert.throws(() => lirePhase(['--phase', 'tout']), (e) => e.etape === 'entrees');
  });

  test('checks : un job sauté ne compte pas, un échec l\'emporte, un check en cours fait attendre', () => {
    const ok = (name) => ({ name, status: 'completed', conclusion: 'success' });
    assert.deepEqual(etatDesChecks(CHECKS_REQUIS.map(ok)).reussis, CHECKS_REQUIS);
    assert.deepEqual(etatDesChecks([ok('client'), ok('character-service'), { name: 'regles-de-branches', status: 'completed', conclusion: 'skipped' }]).attente,
      ['regles-de-branches (pas encore lancé)']);
    assert.deepEqual(etatDesChecks([...CHECKS_REQUIS.map(ok), { name: 'client', status: 'completed', conclusion: 'cancelled' }]).echecs, ['client (cancelled)']);
    assert.deepEqual(etatDesChecks([...CHECKS_REQUIS.map(ok), { name: 'client', status: 'queued', conclusion: null }]).attente, ['client (en cours)']);
    assert.equal(etatDesChecks([]).attente.length, 3);
  });

  test('liste blanche : fichiers annoncés ET tables du lot ou de la note de version', () => {
    assert.deepEqual(TABLES_DE_LA_NOTE, TABLES_DU_SCRIPT, 'même liste que scripts/mise-a-jour-regles.mjs');
    const tables = ['metier'];
    assert.deepEqual(horsListe(CHEMINS, FICHIERS, tables), []);
    assert.deepEqual(horsListe(['data/rows/race.sql'], ['race.sql'], tables), ['data/rows/race.sql']);
    assert.deepEqual(horsListe(['data/rows/metier.sql'], [], tables), ['data/rows/metier.sql']);
    assert.deepEqual(horsListe(['data/rows/VERSION', 'data/schema.sql'], ['VERSION'], tables), ['data/rows/VERSION', 'data/schema.sql']);
    assert.deepEqual(tablesDuLot(JSON.parse(LOT_JSON)), ['metier']);
    assert.throws(() => tablesDuLot({ journal: { lots: [{ modifications: [{ table: 'x; DROP' }] }] } }));
    // ce que le rejeu écrit au-delà du journal (serveur/edition.mjs#rejouerLeJournal) : la cascade d'un mot-clé supprimé (pages d'exemple), le mot-clé
    // d'une ligne page_tag notée avant la migration 0043
    const lot = (...modifications) => ({ journal: { lots: [{ modifications }] } });
    assert.deepEqual(tablesDuLot(lot({ table: 'mot_cle', operation: 'supprimer', avant: { id: 'demo' }, apres: null })), ['mot_cle', 'page', 'page_tag'],
      'la cascade de page_tag, et les pages typées refaites depuis les lignes dont les balises sont retirées');
    assert.deepEqual(tablesDuLot(lot({ table: 'mot_cle', operation: 'modifier', avant: { libelle: 'a' }, apres: { libelle: 'b' } })), ['mot_cle']);
    assert.deepEqual(tablesDuLot(lot({ table: 'page_tag', operation: 'inserer', avant: null, apres: { page_id: 'p', ordre: 1, tag_id: 'x', libelle: 'X' } })), ['mot_cle', 'page_tag']);
    assert.deepEqual(tablesDuLot(lot({ table: 'page_tag', operation: 'inserer', avant: null, apres: { page_id: 'p', ordre: 1, tag_id: 'x' } })), ['page_tag']);
    // les sources de maîtrise d'arme d'une classe ou d'un don touchés, refaites par le lecteur après le lot (sourcesRefaitesParLeLot : un lot noté avant
    // la migration 0076 ne les écrit pas ; décisions R148 à R151, R154), la même liste que le service
    assert.deepEqual(TABLES_DES_SOURCES_DE_MAITRISE, TABLES_DES_SOURCES);
    assert.deepEqual(tablesDuLot(lot({ table: 'capacite', operation: 'modifier', avant: { effet: 'a' }, apres: { effet: 'b' } })), ['capacite', 'capacite_nm_gagne', 'maitrise_arme_part', 'maitrise_arme_part_famille']);
    assert.deepEqual(tablesDuLot(lot({ table: 'classe_maitrise_arme', operation: 'supprimer', avant: { classe_id: 'c', rang: 2 }, apres: null })), ['capacite_nm_gagne', 'classe_maitrise_arme', 'maitrise_arme_part', 'maitrise_arme_part_famille']);
    // une famille d'armes créée ou renommée (décision R159) : le lecteur relit toutes les sources avec les familles
    assert.deepEqual(tablesDuLot(lot({ table: 'arme_famille', operation: 'inserer', avant: null, apres: { id: 'fouets', nom: 'FOUETS' } })),
      ['arme_famille', 'capacite_nm_gagne', 'maitrise_arme_part', 'maitrise_arme_part_famille']);
    assert.deepEqual(tablesDuLot(lot({ table: 'metier', operation: 'modifier', avant: { nom: 'a' }, apres: { nom: 'b' } })), ['metier']);
    // D3 : un mot-clé supprimé (ou fusionné) quitte aussi les balises des textes que le journal n'a pas (balisesRetireesParLeLot,
    // balisesDesColonnesDerivees) : les tables dont data/rows a une balise, lues seulement pour un tel lot
    let lues = 0;
    const balises = () => {
      lues += 1;
      return ['arme', 'page'];
    };
    assert.deepEqual(tablesDuLot(lot({ table: 'mot_cle', operation: 'supprimer', avant: { id: 'demo' }, apres: null }), { tablesAvecBalises: balises }),
      ['arme', 'mot_cle', 'page', 'page_tag']);
    assert.deepEqual(tablesDuLot(lot({ table: 'mot_cle', operation: 'modifier', avant: { libelle: 'a' }, apres: { libelle: 'b' } }), { tablesAvecBalises: balises }), ['mot_cle']);
    assert.equal(lues, 1, 'git grep seulement pour un lot qui retire un mot-clé');
    const appels = [];
    const g = (args, o) => {
      appels.push([args, o]);
      return { code: 0, sortie: `${sha}:data/rows/panneau_regles_bloc.sql\n${sha}:data/rows/arme.sql\n${sha}:data/rows/sous/x.sql\n`, erreur: '' };
    };
    const sha = 'abc1230000000000000000000000000000000000';
    assert.deepEqual(tablesAvecBalises(g, sha), ['arme', 'panneau_regles_bloc']);
    assert.deepEqual(appels, [[['grep', '-l', '-F', '{{', sha, '--', 'data/rows/'], { ok: [0, 1] }]], 'git grep, rien d’autre (code 1 : aucune balise)');
    assert.deepEqual(tablesAvecBalises(g, null), []);
    tablesAvecBalises(g, 'origin/dev');
    assert.deepEqual(appels.at(-1)[0], ['grep', '-l', '-F', '{{', 'origin/dev', '--', 'data/rows/'], 'origin/dev, la base du rejeu de « preparer »');
    const nombre = appels.length;
    for (const rev of ['--open-files-in-pager=sh', '-O', 'abc123', 'origin/master', 'HEAD', 'origin/dev --no-index']) {
      assert.throws(() => tablesAvecBalises(g, rev), /révision refusée/, rev);
    }
    assert.equal(appels.length, nombre, 'rien n’est passé à git pour une révision refusée');
  });

  test('git diff-tree -z : modes et chemins ; préparation : forme contrôlée', () => {
    const a = 'a'.repeat(40);
    assert.deepEqual(lireDiffTree(`:100644 100644 ${a} ${a} M\0data/rows/metier.sql\0:000000 100644 ${'0'.repeat(40)} ${a} A\0data/rows/note_version.sql\0:100644 000000 ${a} ${'0'.repeat(40)} D\0data/rows/x.sql\0`), [
      { ancien: '100644', nouveau: '100644', statut: 'M', chemin: 'data/rows/metier.sql' },
      { ancien: '000000', nouveau: '100644', statut: 'A', chemin: 'data/rows/note_version.sql' },
      { ancien: '100644', nouveau: '000000', statut: 'D', chemin: 'data/rows/x.sql' },
    ]);
    assert.deepEqual(lireDiffTree(''), []);
    assert.throws(() => lireDiffTree('n\'importe quoi\0x\0'), (e) => e.etape === 'artefact');
    const p = { format: FORMAT_PREPARATION, lot: LOT, empreinte: EMPREINTE, essai: false, etat: 'pret', base: sha('b'), commit: sha('c'), version: '0.2', markdown: '', fichiers: CHEMINS, quand: { branche: '20261011-1430' } };
    assert.equal(verifierPreparation(p, { lot: LOT, empreinte: EMPREINTE, essai: false }), p);
    for (const x of [{ base: 'x' }, { version: '0.2.1' }, { fichiers: [] }, { fichiers: ['data/rows/../x.sql'] }, { essai: true }, { format: 'autre' }]) {
      assert.throws(() => verifierPreparation({ ...p, ...x }, { lot: LOT, empreinte: EMPREINTE, essai: false }), (e) => e.etape === 'artefact', JSON.stringify(x));
    }
    assert.doesNotThrow(() => verifierPreparation({ ...p, etat: 'rien', base: undefined }, { lot: LOT, empreinte: EMPREINTE, essai: false }));
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
    assert.equal(environnementGit([...SANS_HOOKS, 'push', '--dry-run'], jetons).GIT_CONFIG_VALUE_0, enteteAuthentification(PAT), 'push sans hooks : le jeton du bot');
    assert.equal(environnementGit(['fetch', 'origin'], jetons).GIT_CONFIG_VALUE_0, enteteAuthentification(LECTURE), 'fetch : le jeton de lecture');
    assert.equal(environnementGit(['fetch', 'origin'], { ...jetons, jetonLecture: null }).GIT_CONFIG_VALUE_0, enteteAuthentification(PAT));
    for (const args of [['status'], ['log', 'origin/dev'], ['-c', 'user.name=x', 'commit', '-m', 'push'], ['checkout', '-B', 'fetch'], [...SANS_HOOKS, 'cherry-pick', 'x']]) {
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
    assert.throws(() => nomDeBranche({ branche: '../x' }), (e) => e.etape === 'branche');
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

  // Ce que GitHub lit comme une référence (un mot-clé de fermeture devant ferme le ticket à la fusion dans dev, branche par défaut) ou une mention.
  const REFERENCES = [/(?<![&\w])#\d/, /\bGH-\d/i, /[\w.-]+\/[\w.-]+#\d/, /github\.com\/[^\s/]+\/[^\s/]+\/(?:issues|pulls?)\/\d/i, /(?<![\w`])@[A-Za-z0-9]/];
  const sansReference = (texte) => REFERENCES.every((r) => !r.test(texte));

  test('corps de PR : références GitHub et @mentions neutralisées, du texte libre comme d\'une ligne calculée ; liens de run gardés', () => {
    const libre = `Équilibrage. Closes #12, fixes GH-13, voir ${DEPOT}#14, https://github.com/${DEPOT}/issues/15 et github.com/${DEPOT}/pull/16. Merci @Bravexier et @org/equipe.`;
    const lignes = [
      { domaine: 'metiers', groupe: null, entite: 'Closes #14', champ: null, nature: 'ajoute', avant: null, apres: null, sens: 'neutre' },
      { domaine: 'metiers', groupe: null, entite: 'Forgeron', champ: 'bonus', nature: 'modifie', avant: '+1', apres: 'Fixes #13 merci @Bravexier', sens: 'amelioration' },
    ];
    const markdown = markdownDeLaNote({ version: '0.2', depuis: '0.1', texte: libre }, lignes);
    assert.ok(!sansReference(markdown), 'le texte d\'origine porte bien des références');
    const corps = corpsDePR(markdown, `Lot \`${LOT}\` appliqué par le workflow « Mise à jour des règles » : ${RUN}. Merci @Bravexier (#3).`);
    assert.ok(sansReference(corps), corps);
    assert.ok(corps.includes(RUN), 'le lien du run reste cliquable');
    assert.ok(corps.includes(`Closes #${SANS_CHASSE}12`) && corps.includes(`@${SANS_CHASSE}Bravexier`), 'neutralisé, pas supprimé');
    assert.ok(corps.includes(`- Closes #${SANS_CHASSE}14 : ajouté`), 'ligne calculée (entité)');
    assert.ok(corps.includes(`Fixes #${SANS_CHASSE}13 merci @${SANS_CHASSE}Bravexier`), 'ligne calculée (valeur)');
    assert.equal(neutraliserReferences(corps), corps, 'idempotent (reprise : la note de la PR vers dev redevient celle de la livraison)');
    assert.equal(neutraliserReferences('&#39; ## Version 0.2 V0.2 a@'), `&#39; ## Version 0.2 V0.2 a@${SANS_CHASSE}`);
  });

  test('corps des deux PR et commentaires : aucune référence ni mention, même venues du lot', async () => {
    const texte = 'Closes #12 @Bravexier https://github.com/Bravexier/MaverickCenter/issues/15';
    const m = monde({ markdown: `## Version 0.2\n\n${texte}\n\n### Métiers\n- Closes #14 : ajouté\n` });
    await m.lancer();
    const [prDev, prMaster] = m.pullsCrees();
    for (const corps of [prDev.corps.body, prMaster.corps.body]) {
      assert.ok(sansReference(corps), corps);
      assert.ok(corps.includes(RUN));
    }
  });
});

describe('avec un vrai git (dépôts temporaires)', () => {
  const avecGit = spawnSync('git', ['--version']).status === 0;
  const passer = { skip: !avecGit && 'git indisponible' };
  const configurer = (g) => {
    g(['config', 'user.name', 'test']);
    g(['config', 'user.email', 'test@example.com']);
    g(['config', 'commit.gpgsign', 'false']);
  };
  const LIGNES = Array.from({ length: 12 }, (_, i) => `INSERT INTO metier VALUES (${i + 1});`);
  const ecrireLignes = (dir, f, lignes) => writeFileSync(join(dir, 'data', 'rows', f), `${lignes.join('\n')}\n`);
  const depot = () => {
    const dir = dossierTemp('git-');
    const g = enveloppeGit(gitLocal(dir));
    g(['init', '--quiet', '-b', 'master']);
    configurer(g);
    mkdirSync(join(dir, 'data', 'rows'), { recursive: true });
    for (const f of ['metier.sql', 'race.sql']) writeFileSync(join(dir, 'data', 'rows', f), `-- ${f}\n`);
    g(['add', '-A']);
    g(['commit', '--quiet', '-m', 'départ']);
    return { dir, g };
  };
  /** Un dépôt « distant » (nu) avec dev et master, et des clones : la machine du job preparer, celle du job livrer, un développeur. */
  const distant = () => {
    const dir = dossierTemp('distant-');
    const origine = join(dir, 'origine.git');
    enveloppeGit(gitLocal(dir))(['init', '--quiet', '--bare', '-b', 'dev', origine]);
    const cloner = (nom) => {
      enveloppeGit(gitLocal(dir))(['clone', '--quiet', origine, nom]);
      const d = join(dir, nom);
      const g = enveloppeGit(gitLocal(d));
      configurer(g);
      return { d, g };
    };
    const amorce = cloner('amorce');
    mkdirSync(join(amorce.d, 'data', 'rows'), { recursive: true });
    mkdirSync(join(amorce.d, '.github', 'workflows'), { recursive: true });
    ecrireLignes(amorce.d, 'metier.sql', LIGNES);
    for (const f of ['note_version.sql', 'note_version_ligne.sql', 'historique_modification.sql', 'race.sql']) writeFileSync(join(amorce.d, 'data', 'rows', f), `-- ${f}\n`);
    writeFileSync(join(amorce.d, '.github', 'workflows', 'ci.yml'), 'name: CI\n');
    amorce.g(['add', '-A']);
    amorce.g(['commit', '--quiet', '-m', 'départ']);
    amorce.g(['push', '--quiet', 'origin', 'HEAD:refs/heads/dev', 'HEAD:refs/heads/master']);
    /** Un commit poussé sur dev par quelqu'un d'autre (dev bouge). */
    const pousserSurDev = (changer, message = 'autre travail sur dev') => {
      amorce.g(['fetch', '--quiet', 'origin']);
      amorce.g(['checkout', '--quiet', '-B', 'dev', 'origin/dev']);
      changer(amorce.d);
      amorce.g(['commit', '--quiet', '-am', message]);
      amorce.g(['push', '--quiet', 'origin', 'HEAD:refs/heads/dev']);
    };
    return { dir, origine, cloner, amorce, pousserSurDev };
  };
  /** Le commit d'une mise à jour, préparé dans `d` sur origin/dev (ligne 2 de metier.sql changée, note de version écrite). */
  const commitDeLot = ({ d, g }, { version = '0.2', lot = LOT, run = RUN, changer = null } = {}) => {
    const base = g(['rev-parse', 'origin/dev']).sortie.trim();
    g(['checkout', '--quiet', '-B', 'preparation', 'origin/dev']);
    ecrireLignes(d, 'metier.sql', LIGNES.map((l, i) => (i === 1 ? 'INSERT INTO metier VALUES (2, \'+2\');' : l)));
    writeFileSync(join(d, 'data', 'rows', 'note_version.sql'), `-- note ${version}\n`);
    changer?.(d);
    g(['add', '-A']);
    g(['-c', 'user.name=github-actions[bot]', 'commit', '--quiet', '--no-verify', '-m', `Mise à jour des règles V${version} (site de dev, lot ${lot.slice(0, 8)})`,
      '-m', `Lot : ${lot}\nRun : ${run}\n\nAppliqué par le workflow « Mise à jour des règles » (.github/workflows/mise-a-jour.yml).`]);
    return { base, commit: g(['rev-parse', 'HEAD']).sortie.trim() };
  };
  const preparationDe = (base, commit, fichiers = ['data/rows/metier.sql', 'data/rows/note_version.sql']) => ({
    format: FORMAT_PREPARATION, lot: LOT, empreinte: EMPREINTE, essai: false, etat: 'pret', base, commit, version: '0.2', markdown: 'note', fichiers, quand: horodatage(DEBUT),
  });

  test('git status -z réel : fichiers modifiés, nouveaux et supprimés de data/rows', passer, () => {
    const { dir, g } = depot();
    writeFileSync(join(dir, 'data', 'rows', 'metier.sql'), '-- changé\n');
    writeFileSync(join(dir, 'data', 'rows', 'note_version.sql'), '-- nouveau\n');
    unlinkSync(join(dir, 'data', 'rows', 'race.sql'));
    assert.deepEqual(fichiersModifies(g), ['data/rows/metier.sql', 'data/rows/note_version.sql', 'data/rows/race.sql']);
  });

  test('reprise : le commit « Lot : <id> » et la PR qui l\'a fusionné dans dev ; livré une fois dans master', passer, () => {
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
    // le lot dans dev sans être livré : une « autre mise à jour » pour tout autre lot, pas pour lui-même
    assert.deepEqual(lotsEnAttente(g, LOT), []);
    assert.deepEqual(lotsEnAttente(g, AUTRE_LOT), [{ commit, lot: LOT, version: '0.2', run: RUN }]);
    g(['update-ref', 'refs/remotes/origin/master', 'dev']);
    assert.equal(chercherLotDejaFusionne(g, LOT).livre, true);
    assert.deepEqual(lotsEnAttente(g, AUTRE_LOT), [], 'livré : plus en attente');
  });

  test('bundle : le commit préparé passe d\'une machine à l\'autre, vérifié par git (base, fichiers, message)', passer, () => {
    const { cloner } = distant();
    const prep = cloner('preparer');
    const { base, commit } = commitDeLot(prep);
    const fichier = join(prep.d, '..', 'commit.bundle');
    creerBundle(prep.g, { base, commit, fichier });
    const livr = cloner('livrer');
    const p = preparationDe(base, commit);
    assert.equal(importerCommit(livr.g, fichier, p), commit);
    assert.deepEqual(verifierCommit(livr.g, { base, commit, tables: ['metier'], fichiers: p.fichiers, message: messageAttendu('0.2', LOT, RUN) }), p.fichiers);
    assert.throws(() => verifierCommit(livr.g, { base, commit, tables: ['metier'], message: messageAttendu('0.2', LOT, null) }), (e) => e.etape === 'artefact');
    assert.throws(() => verifierCommit(livr.g, { base, commit, tables: [] }), (e) => e.etape === 'liste' && /metier\.sql/.test(e.message), 'table absente du lot');
    assert.throws(() => importerCommit(livr.g, fichier, { ...p, commit: base }), (e) => e.etape === 'artefact');
  });

  test('bundle altéré : workflow touché, lien symbolique, deux commits : refusés par git', passer, () => {
    const { cloner } = distant();
    const livr = cloner('livrer');
    const cas = [
      ['workflow', (d) => writeFileSync(join(d, '.github', 'workflows', 'ci.yml'), 'name: CI\non: push\n'), /\.github\/workflows\/ci\.yml/],
      ['lien', (d) => { unlinkSync(join(d, 'data', 'rows', 'race.sql')); symlinkSync('/etc/passwd', join(d, 'data', 'rows', 'race.sql')); }, /race\.sql \(120000\)/],
    ];
    for (const [nom, changer, motif] of cas) {
      const prep = cloner(`preparer-${nom}`);
      const { base, commit } = commitDeLot(prep, { changer });
      const fichier = join(prep.d, '..', `${nom}.bundle`);
      creerBundle(prep.g, { base, commit, fichier });
      importerCommit(livr.g, fichier, preparationDe(base, commit));
      assert.throws(() => verifierCommit(livr.g, { base, commit, tables: ['metier', 'race'] }), (e) => e.etape === 'liste' && motif.test(e.message), nom);
    }
    const prep = cloner('preparer-deux');
    const { base } = commitDeLot(prep);
    writeFileSync(join(prep.d, 'data', 'rows', 'note_version_ligne.sql'), '-- deuxième commit\n');
    prep.g(['commit', '--quiet', '-am', 'deuxième']);
    const commit = prep.g(['rev-parse', 'HEAD']).sortie.trim();
    const fichier = join(prep.d, '..', 'deux.bundle');
    creerBundle(prep.g, { base, commit, fichier });
    assert.throws(() => importerCommit(livr.g, fichier, preparationDe(base, commit)), (e) => e.etape === 'artefact' && /seul parent/.test(e.message));
  });

  test('application sur dev : telle quelle, rebase textuel propre, ou conflit (même ligne / voisine) avec un état propre', passer, () => {
    const { cloner, pousserSurDev } = distant();
    const prep = cloner('preparer');
    const { base, commit } = commitDeLot(prep);
    const fichier = join(prep.d, '..', 'commit.bundle');
    creerBundle(prep.g, { base, commit, fichier });
    const p = preparationDe(base, commit);
    const livr = cloner('livrer');
    const rafraichir = () => livr.g(['fetch', '--quiet', 'origin', '+refs/heads/dev:refs/remotes/origin/dev', '+refs/heads/master:refs/remotes/origin/master']);
    importerCommit(livr.g, fichier, p);
    assert.deepEqual(appliquerSurDev(livr.g, { preparation: p, branche: BRANCHE, tables: ['metier'] }), { tete: base, sha: commit, rejoue: false });

    // dev bouge loin de la ligne du lot (ligne 10) : cherry-pick propre, parent = nouveau dev, commit revérifié
    pousserSurDev((d) => ecrireLignes(d, 'metier.sql', LIGNES.map((l, i) => (i === 9 ? 'INSERT INTO metier VALUES (10, \'dev\');' : l))));
    rafraichir();
    const a = appliquerSurDev(livr.g, { preparation: p, branche: `${BRANCHE}-2`, tables: ['metier'] });
    const dev1 = livr.g(['rev-parse', 'origin/dev']).sortie.trim();
    assert.equal(a.rejoue, true);
    assert.equal(a.tete, dev1);
    assert.equal(livr.g(['rev-parse', `${a.sha}^`]).sortie.trim(), dev1);
    assert.match(livr.g(['log', '-1', '--format=%B', a.sha]).sortie, new RegExp(`Lot : ${LOT}`), 'le message (et la ligne « Lot : ») suit');
    assert.match(livr.g(['log', '-1', '--format=%cn', a.sha]).sortie, /github-actions\[bot\]/);

    // dev change la ligne voisine (3) puis la même ligne (2) : conflit, cherry-pick abandonné, arbre propre
    for (const ligne of [2, 1]) {
      pousserSurDev((d) => ecrireLignes(d, 'metier.sql', LIGNES.map((l, i) => (i === ligne ? `INSERT INTO metier VALUES (${i + 1}, 'dev-${ligne}');` : l))), `dev ligne ${ligne + 1}`);
      rafraichir();
      assert.throws(() => appliquerSurDev(livr.g, { preparation: p, branche: `${BRANCHE}-3`, tables: ['metier'] }), (e) => e.etape === 'rebase', `ligne ${ligne + 1}`);
      assert.equal(livr.g(['status', '--porcelain']).sortie, '', 'aucun cherry-pick en cours');
    }
  });

  test('de bout en bout (simulation) : preparer sur une machine, livrer sur une autre, poussée à blanc vers le distant', passer, async () => {
    const { origine, cloner, pousserSurDev } = distant();
    const prep = cloner('preparer');
    const artefact = dossierTemp('artefact-reel-');
    const api = [];
    const fetch = async (url, init = {}) => {
      if (url === ADRESSE) return { status: 200, arrayBuffer: async () => new TextEncoder().encode(LOT_ESSAI).buffer };
      api.push({ url, methode: init.method ?? 'GET', auth: init.headers?.Authorization });
      return { status: 200, text: async () => '[]' };
    };
    const executer = (commande, args) => {
      if (args.some((a) => a.endsWith('mise-a-jour-regles.mjs'))) {
        ecrireLignes(prep.d, 'metier.sql', LIGNES.map((l, i) => (i === 1 ? 'INSERT INTO metier VALUES (2, \'+2\');' : l)));
        writeFileSync(join(prep.d, 'data', 'rows', 'note_version.sql'), '-- note 0.2\n');
        writeFileSync(args[args.indexOf('--resume') + 1], JSON.stringify({ version: '0.2', depuis: '0.1', lignes: 1, fichiers: ['metier.sql', 'note_version.sql'], markdown: '## Version 0.2' }));
      }
      return { code: 0 };
    };
    const entrees = { lot: LOT, empreinte: empreinte(LOT_ESSAI), adresse: ADRESSE, essai: true, depot: DEPOT, run: RUN, artefact, debut: DEBUT };
    const p = await preparer({ ...entrees, racine: prep.d, temp: dossierTemp('run-') }, { fetch, git: gitLocal(prep.d), executer });
    assert.deepEqual([p.etat, p.fichiers], ['pret', ['data/rows/metier.sql', 'data/rows/note_version.sql']]);
    assert.deepEqual(Object.values(ARTEFACT).map((f) => existsSync(join(artefact, f))), [true, true, true]);

    pousserSurDev((d) => ecrireLignes(d, 'metier.sql', LIGNES.map((l, i) => (i === 9 ? 'INSERT INTO metier VALUES (10, \'dev\');' : l))));
    const livr = cloner('livrer');
    const avant = enveloppeGit(gitLocal(origine))(['for-each-ref', '--format=%(refname) %(objectname)']).sortie;
    const outils = { fetch, git: gitLocal(livr.d, { jeton: PAT, jetonLecture: LECTURE }), attendre: async () => {}, journal: () => {} };
    const r = await fusionDansDev({ ...entrees, jeton: PAT, jetonLecture: LECTURE }, outils);
    assert.deepEqual([r.etat, r.rejoue], ['essai', true], 'dev a bougé : rebase textuel à blanc');
    const m = await livraisonVersMaster({ ...entrees, jeton: PAT, jetonLecture: LECTURE }, outils);
    assert.equal(m.etat, 'essai');
    assert.equal(enveloppeGit(gitLocal(origine))(['for-each-ref', '--format=%(refname) %(objectname)']).sortie, avant, 'le distant n\'a pas changé');
    assert.ok(api.every((a) => a.methode === 'GET'), 'aucune écriture sur GitHub');
    assert.ok(api.some((a) => a.auth === `Bearer ${PAT}`), 'le jeton du bot est vérifié par une lecture');
  });
});

describe('.github/workflows/mise-a-jour.yml', () => {
  const texte = readFileSync(WORKFLOW, 'utf8');
  const wf = YAML.parse(texte);
  const { preparer: jobPreparer, livrer: jobLivrer } = wf.jobs;
  const etape = (job, predicat) => job.steps.find(predicat);
  const parNom = (job, nom) => job.steps.find((s) => s.name === nom);

  test('déclenché seulement à la main (workflow_dispatch) avec lot, empreinte, adresse et essai ; le run porte le lot', () => {
    assert.equal(wf.name, 'Mise à jour des règles');
    assert.deepEqual(Object.keys(wf.on), ['workflow_dispatch']);
    const entrees = wf.on.workflow_dispatch.inputs;
    assert.deepEqual(Object.keys(entrees), ['lot', 'empreinte', 'adresse', 'essai']);
    for (const nom of ['lot', 'empreinte', 'adresse']) assert.deepEqual([entrees[nom].type, entrees[nom].required], ['string', true], nom);
    assert.deepEqual([entrees.essai.type, entrees.essai.default], ['boolean', false]);
    assert.match(wf['run-name'], /\$\{\{ inputs\.lot \}\}/, 'le service retrouve son run par le lot dans le nom');
  });

  test('deux jobs aux noms épinglés (le service les lit) : preparer, puis livrer ; une mise à jour à la fois ; sur dev seulement', () => {
    assert.deepEqual(wf.concurrency, { group: 'mise-a-jour-des-regles', 'cancel-in-progress': false });
    assert.deepEqual(Object.keys(wf.jobs), ['preparer', 'livrer']);
    assert.deepEqual(JOBS, { preparer: 'preparer', livrer: 'livrer' });
    assert.equal(jobPreparer.name, 'preparer');
    assert.equal(jobLivrer.name, 'livrer');
    assert.equal(jobLivrer.needs, 'preparer');
    for (const job of [jobPreparer, jobLivrer]) assert.equal(job.if, "github.ref == 'refs/heads/dev'");
    // le service tient un run pour perdu au bout de 3 h (serveur/notes-de-version.mjs#DUREE_MAX_RUN)
    assert.ok(jobPreparer['timeout-minutes'] + jobLivrer['timeout-minutes'] < 180);
  });

  test('permissions minimales : aucune par défaut, lecture du code pour preparer, lectures de l\'API pour livrer', () => {
    assert.deepEqual(wf.permissions, {});
    assert.deepEqual(jobPreparer.permissions, { contents: 'read' });
    assert.deepEqual(jobLivrer.permissions, { contents: 'read', 'pull-requests': 'read', checks: 'read' });
  });

  test('le secret MISE_A_JOUR_TOKEN n\'est cité que dans le job livrer : garde-fou et ses deux étapes de script', () => {
    assert.ok(!JSON.stringify(jobPreparer).includes('secrets.'), 'aucun secret dans preparer');
    const avecJeton = jobLivrer.steps.filter((s) => JSON.stringify(s).includes('secrets.'));
    assert.deepEqual(avecJeton.map((s) => s.name), ['Garde-fou — jeton du bot (secret MISE_A_JOUR_TOKEN)', ETAPES_DE_LIVRER.dev, ETAPES_DE_LIVRER.master]);
    assert.ok(avecJeton.every((s) => Object.values(s.env).filter((v) => String(v).includes('secrets.')).every((v) => v === '${{ secrets.MISE_A_JOUR_TOKEN }}')));
    const garde = avecJeton[0];
    assert.match(garde.run, /-z "\$MISE_A_JOUR_TOKEN"/);
    assert.match(garde.run, /Fine-grained/);
    assert.equal(jobLivrer.steps.indexOf(garde), 0, 'vérifié avant tout');
  });

  test('preparer : garde-fous, checkout de dev complet avec le jeton du workflow non gardé, npm ci, script --phase preparer, artefact', () => {
    // Dépôt public depuis le 2026-10-14 (décision du propriétaire) : plus de garde-fou du dépôt privé.
    assert.ok(!etape(jobPreparer, (s) => s.env?.IS_PRIVATE), 'plus de garde-fou du dépôt privé');
    const checkout = etape(jobPreparer, (s) => s.uses?.startsWith('actions/checkout@'));
    assert.deepEqual(checkout.with, { ref: 'dev', 'fetch-depth': 0, token: '${{ github.token }}', 'persist-credentials': false });
    const node = etape(jobPreparer, (s) => s.uses?.startsWith('actions/setup-node@'));
    assert.deepEqual(node.with, { 'node-version-file': '.nvmrc', cache: 'npm', 'cache-dependency-path': 'client/package-lock.json' });
    assert.ok(jobPreparer.steps.some((s) => s.run === 'npm ci' && s['working-directory'] === 'client'));
    const script = etape(jobPreparer, (s) => s.run?.includes('mise-a-jour-github.mjs'));
    assert.equal(script.run, 'node client/scripts/mise-a-jour-github.mjs --phase preparer');
    assert.equal(script.id, 'preparer');
    assert.ok(!('GH_TOKEN' in script.env) && !('GITHUB_TOKEN_LECTURE' in script.env), 'aucun jeton pour le script de preparer');
    assert.equal(script.env.HOTE_ATTENDU, "${{ vars.MISE_A_JOUR_HOTE || 'dev.maverick-jdr.com' }}", 'un seul hôte permis, même sans la variable');
    for (const [variable, entree] of [['LOT', 'lot'], ['EMPREINTE', 'empreinte'], ['ADRESSE', 'adresse'], ['ESSAI', 'essai']]) {
      assert.equal(script.env[variable], `\${{ inputs.${entree} }}`);
    }
    const envoi = etape(jobPreparer, (s) => s.uses?.startsWith('actions/upload-artifact@'));
    assert.equal(envoi.uses, 'actions/upload-artifact@v4');
    assert.deepEqual(envoi.with, { name: NOM_ARTEFACT, path: `${script.env.ARTEFACT}/`, 'if-no-files-found': 'error', 'retention-days': 7, overwrite: true });
    const rang = (s) => jobPreparer.steps.indexOf(s);
    const entrees = etape(jobPreparer, (s) => s.name?.startsWith('Garde-fou — entrées'));
    assert.ok(rang(entrees) < rang(checkout) && rang(script) < rang(envoi));
    assert.equal(jobPreparer.steps.at(-1).if, 'always()');
  });

  test('livrer : ni npm ni node_modules ; artefact récupéré ; étapes « Fusion dans dev » puis « Livraison vers master » (--phase dev, master)', () => {
    assert.deepEqual(ETAPES_DE_LIVRER, { dev: 'Fusion dans dev', master: 'Livraison vers master' });
    for (const s of jobLivrer.steps) {
      assert.doesNotMatch(s.run ?? '', /\bnpm\b|node_modules/, s.name ?? s.uses);
      assert.ok(!s['working-directory'], s.name ?? s.uses);
    }
    const checkout = etape(jobLivrer, (s) => s.uses?.startsWith('actions/checkout@'));
    assert.deepEqual(checkout.with, { ref: 'dev', 'fetch-depth': 0, token: '${{ github.token }}', 'persist-credentials': false });
    const node = etape(jobLivrer, (s) => s.uses?.startsWith('actions/setup-node@'));
    assert.deepEqual(node.with, { 'node-version-file': '.nvmrc' }, 'sans cache npm (setup-node lancerait npm)');
    const reception = etape(jobLivrer, (s) => s.uses?.startsWith('actions/download-artifact@'));
    assert.equal(reception.uses, 'actions/download-artifact@v4');
    const dev = parNom(jobLivrer, 'Fusion dans dev');
    const master = parNom(jobLivrer, 'Livraison vers master');
    assert.deepEqual(reception.with, { name: NOM_ARTEFACT, path: dev.env.ARTEFACT });
    assert.deepEqual([dev.id, dev.run], ['dev', 'node client/scripts/mise-a-jour-github.mjs --phase dev']);
    assert.deepEqual([master.id, master.run], ['master', 'node client/scripts/mise-a-jour-github.mjs --phase master']);
    assert.ok(!master.if, 'la livraison suit une fusion réussie (succès par défaut)');
    for (const s of [dev, master]) {
      assert.equal(s.env.GH_TOKEN, '${{ secrets.MISE_A_JOUR_TOKEN }}');
      assert.equal(s.env.GITHUB_TOKEN_LECTURE, '${{ github.token }}');
      assert.equal(s.env.ARTEFACT, '${{ runner.temp }}/mise-a-jour-preparation');
      assert.equal(s.env.HOTE_ATTENDU, "${{ vars.MISE_A_JOUR_HOTE || 'dev.maverick-jdr.com' }}");
      for (const [variable, entree] of [['LOT', 'lot'], ['EMPREINTE', 'empreinte'], ['ADRESSE', 'adresse'], ['ESSAI', 'essai']]) assert.equal(s.env[variable], `\${{ inputs.${entree} }}`);
    }
    const rang = (s) => jobLivrer.steps.indexOf(s);
    assert.ok(rang(checkout) < rang(reception) && rang(reception) < rang(dev) && rang(dev) < rang(master));
    assert.equal(jobLivrer.steps.at(-1).if, 'always()');
    assert.ok(!etape(jobLivrer, (s) => s.env?.IS_PRIVATE), 'plus de garde-fou du dépôt privé dans livrer non plus');
  });

  test('aucune expression dans un run: (les entrées passent par env, jamais interpolées dans le shell)', () => {
    for (const job of Object.values(wf.jobs)) {
      for (const s of job.steps) {
        if (!s.run) continue;
        assert.doesNotMatch(s.run, /\$\{\{/, `étape « ${s.name ?? s.run} »`);
      }
    }
    assert.doesNotMatch(texte.replace(/^\s*#.*$/gm, ''), /run:[^\n]*\$\{\{\s*(inputs|github\.event\.inputs)\./);
  });

  test('les contrôles de preparer reprennent tout le job client de ci.yml (même ordre, mêmes commandes)', () => {
    const client = YAML.parse(readFileSync(CI, 'utf8')).jobs.client;
    const commandes = client.steps.filter((s) => s.run).map((s) => s.run.trim())
      .filter((c) => c !== 'npm ci' && !c.startsWith('git fetch ')); // npm ci : étape du workflow ; le fetch de master : actions/checkout, fetch-depth: 0
    assert.deepEqual(CONTROLES_DE_LA_CI, commandes);
    assert.deepEqual(CONTROLES.slice(0, 2), ['npm run db:build', 'npm run db:check']);
    assert.ok(client.steps.some((s) => s.run?.startsWith('git fetch ') && s.run.includes('master')), 'ci.yml récupère master (fetch-depth: 0 ici)');
  });

  test('le script du job livrer n\'importe que node: et tools/flux-git/regles.mjs, qui n\'importe rien', () => {
    const imports = (fichier) => [...readFileSync(fichier, 'utf8').matchAll(/^\s*import\s[^'"]*['"]([^'"]+)['"]/gm)].map((x) => x[1]);
    const duScript = imports(SCRIPT);
    assert.ok(duScript.length > 0);
    assert.deepEqual(duScript.filter((s) => !s.startsWith('node:')), ['../../tools/flux-git/regles.mjs']);
    assert.deepEqual(imports(REGLES_FLUX), []);
    assert.doesNotMatch(readFileSync(SCRIPT, 'utf8'), /\bimport\(/, 'aucun import dynamique');
  });
});
