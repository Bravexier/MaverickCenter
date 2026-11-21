// Le gel des fusions pendant une mise à jour (lot 11 ; client/scripts/gel-des-fusions-lib.mjs, gel-des-fusions.mjs, job `gel-des-fusions` de ci.yml ; docs/flux-git.md,
// « Gel des fusions pendant une mise à jour »). ÉTEINT par défaut : sans interrupteur allumé sur origin/dev, vert, sans appeler GitHub. Allumé : rouge tant qu'un run
// de mise-a-jour.yml n'est pas fini, sauf pour les fusions du workflow lui-même ; le run, depuis quand et le geste sont dits. L'interrupteur se lit dans origin/dev,
// jamais dans la PR. Le CLI est lancé pour de bon contre un faux serveur GitHub.
import assert from 'node:assert/strict';
import { execFile, execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { after, test } from 'node:test';
import { promisify } from 'node:util';
import { BRANCHE_DU_WORKFLOW } from '../scripts/mise-a-jour-github.mjs';
import {
  INTERRUPTEUR, NOM_DU_WORKFLOW, PLAFOND_D_UN_RUN_MS, decider, estUneFusionDuWorkflow, lireLInterrupteur, resumeDeLaDecision, runsEnCours,
} from '../scripts/gel-des-fusions-lib.mjs';
import { controlerLesFusions, interrupteurDans, lireLesRuns } from '../scripts/gel-des-fusions.mjs';
import { dossierTemporaire, variablesTemporaires } from './aide-dossier-temporaire.mjs';

const SCRIPT = fileURLToPath(new URL('../scripts/gel-des-fusions.mjs', import.meta.url));
const RACINE = fileURLToPath(new URL('../../', import.meta.url));
const MIN = 60_000;
const MAINTENANT = Date.parse('2026-11-20T12:00:00Z');
const FEATURE = 'feature/mise-a-jour-regles-20261120-1100';
const run = (o = {}) => ({ id: 111, run_number: 42, status: 'in_progress', conclusion: null, created_at: '2026-11-20T11:30:00Z', run_started_at: '2026-11-20T11:31:00Z', html_url: 'https://github.com/o/d/actions/runs/111', ...o });

test('l’interrupteur : absent ou faux = éteint ; vrai = allumé ; illisible = erreur (on ne devine pas)', () => {
  assert.equal(lireLInterrupteur(null), false);
  assert.equal(lireLInterrupteur('{"gel_des_fusions":false}'), false);
  assert.equal(lireLInterrupteur('{"gel_des_fusions":true,"a_lire":"x"}'), true);
  assert.equal(lireLInterrupteur('{"actif":true}'), false, '« actif » est l’autre interrupteur du fichier (kit seul) : il n’allume pas le gel');
  assert.equal(lireLInterrupteur('{"actif":true,"gel_des_fusions":false}'), false);
  assert.equal(lireLInterrupteur('{"actif":false,"gel_des_fusions":true}'), true, 'indépendants dans les deux sens');
  assert.equal(lireLInterrupteur('{}'), false, 'clé absente : éteint');
  assert.throws(() => lireLInterrupteur('{ pas du json'), /illisible/);
  assert.throws(() => lireLInterrupteur('{"gel_des_fusions":"oui"}'), /true ou false/);
  assert.throws(() => lireLInterrupteur('[]'), /true ou false/);
});

test('le fichier du dépôt est un interrupteur lisible, relu par le job (son état — éteint ou allumé — est le choix du propriétaire)', () => {
  assert.equal(INTERRUPTEUR, 'tools/flux-git/bascule-2.json');
  const brut = readFileSync(join(RACINE, INTERRUPTEUR), 'utf8');
  assert.equal(typeof lireLInterrupteur(brut), 'boolean');
  assert.equal(typeof JSON.parse(brut).a_lire, 'string');
});

test('les fusions du workflow de mise à jour : sa branche vers dev et la livraison dev → master ; aucune autre', () => {
  assert.equal(BRANCHE_DU_WORKFLOW.test(FEATURE), true, 'la branche que le workflow pousse');
  assert.equal(estUneFusionDuWorkflow({ source: FEATURE, cible: 'dev' }), true);
  assert.equal(estUneFusionDuWorkflow({ source: 'feature/mise-a-jour-regles-20261120-1100-2', cible: 'dev' }), true, 'une reprise du même jour');
  assert.equal(estUneFusionDuWorkflow({ source: 'dev', cible: 'master' }), true, 'la PR de livraison');
  for (const [source, cible] of [
    [FEATURE, 'master'], ['feature/autre', 'dev'], ['feature/mise-a-jour-regles-x', 'dev'], ['master', 'dev'], ['hotfix/urgent', 'master'], ['dev', 'dev'], ['feature/autre', 'master'], [undefined, 'dev'],
  ]) assert.equal(estUneFusionDuWorkflow({ source, cible }), false, `${source} → ${cible}`);
});

test('les runs en cours : ni les finis, ni ceux de plus de 8 h ; le plus ancien d’abord, depuis combien de minutes', () => {
  const liste = [
    run({ id: 1, status: 'completed', conclusion: 'success' }),
    run({ id: 2, status: 'queued', run_number: 44, run_started_at: undefined, created_at: '2026-11-20T11:50:00Z' }),
    run({ id: 3, status: 'in_progress', run_number: 43, run_started_at: '2026-11-20T11:00:00Z' }),
    run({ id: 4, status: 'in_progress', run_started_at: new Date(MAINTENANT - PLAFOND_D_UN_RUN_MS - MIN).toISOString() }),
    null, 'x',
  ];
  const r = runsEnCours(liste, { maintenantMs: MAINTENANT });
  assert.deepEqual(r.map((x) => x.id), [3, 2]);
  assert.deepEqual(r.map((x) => x.duree_min), [60, 10]);
  assert.equal(r[0].statut, 'in_progress');
  assert.equal(r[1].statut, 'queued');
  assert.equal(r[0].url, 'https://github.com/o/d/actions/runs/111');
  assert.deepEqual(runsEnCours(undefined), []);
  assert.deepEqual(runsEnCours({}), []);
});

test('la décision : éteint → vert ; fusion du workflow → vert ; aucun run → vert ; un run en cours → rouge, avec le run, depuis quand et le geste', () => {
  const enCours = runsEnCours([run({ run_started_at: '2026-11-20T11:15:00Z' })], { maintenantMs: MAINTENANT });
  const eteint = decider({ actif: false, source: 'feature/x', cible: 'dev', runs: enCours });
  assert.equal(eteint.verdict, 'vert');
  assert.equal(eteint.raison, 'eteint');
  assert.match(eteint.message, /éteint/);
  const fusion = decider({ actif: true, source: FEATURE, cible: 'dev', runs: enCours });
  assert.equal(fusion.verdict, 'vert');
  assert.equal(fusion.raison, 'fusion_du_workflow');
  assert.equal(decider({ actif: true, source: 'dev', cible: 'master', runs: enCours }).verdict, 'vert');
  const libre = decider({ actif: true, source: 'feature/x', cible: 'dev', runs: [] });
  assert.equal(libre.verdict, 'vert');
  assert.equal(libre.raison, 'aucun_run');
  assert.equal(decider({ actif: true, source: 'feature/x', cible: 'dev', runs: null }).verdict, 'vert', 'aucune liste lue : libre (le CLI la lit toujours quand il le faut)');
  const rouge = decider({ actif: true, source: 'feature/x', cible: 'dev', runs: enCours });
  assert.equal(rouge.verdict, 'rouge');
  assert.equal(rouge.raison, 'run_en_cours');
  assert.match(rouge.message, /n° 42/);
  assert.ok(rouge.message.includes('https://github.com/o/d/actions/runs/111'));
  assert.match(rouge.message, /depuis 2026-11-20T11:15:00Z \(il y a 45 min\)/);
  assert.ok(rouge.message.includes(NOM_DU_WORKFLOW));
  assert.match(rouge.message, /relancer ce job/);
  assert.match(resumeDeLaDecision(rouge), /^### Gel des fusions\n\n\*\*Refusé\.\*\* /);
  const deux = decider({ actif: true, source: 'hotfix/x', cible: 'master', runs: runsEnCours([run({ id: 1 }), run({ id: 2, run_started_at: '2026-11-20T11:40:00Z' })], { maintenantMs: MAINTENANT }) });
  assert.match(deux.message, /1 autre\(s\) en attente/);
});

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Lire le dépôt et GitHub
// ---------------------------------------------------------------------------------------------------------------------------------------------

/** Un dépôt factice dont origin/dev porte (ou non) l'interrupteur `contenu` ; la copie de travail peut dire autre chose (la PR). */
function depot(nom, { surDev = null, surLaPR = null } = {}) {
  const d = dossierTemporaire(`gel-fusions-${nom}`);
  const g = (...a) => execFileSync('git', ['-C', d, '-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'commit.gpgsign=false', ...a], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  g('init', '-q', '-b', 'dev');
  mkdirSync(join(d, 'tools', 'flux-git'), { recursive: true });
  writeFileSync(join(d, 'README'), 'x');
  if (surDev !== null) writeFileSync(join(d, INTERRUPTEUR), surDev);
  g('add', '-A');
  g('commit', '-q', '-m', 'dev');
  g('update-ref', 'refs/remotes/origin/dev', 'HEAD');
  if (surLaPR !== null) writeFileSync(join(d, INTERRUPTEUR), surLaPR);
  return d;
}
const fauxFetch = (reponses) => {
  const appels = [];
  const f = async (adresse, options) => {
    appels.push({ adresse, options });
    const r = typeof reponses === 'function' ? reponses(adresse) : reponses;
    return { ok: r.statut === undefined || r.statut < 300, status: r.statut ?? 200, json: async () => r.corps };
  };
  f.appels = appels;
  return f;
};
const interdit = () => { throw new Error('GitHub ne doit pas être appelé'); };

test('éteint ou absent sur origin/dev : vert, GitHub n’est jamais appelé ; l’interrupteur d’une PR n’est pas lu (seulement origin/dev)', async () => {
  const absent = depot('absent');
  assert.equal(interrupteurDans(absent, 'origin/dev'), false);
  assert.equal((await controlerLesFusions({ racine: absent, cible: 'dev', source: 'feature/x', fetch: interdit })).verdict, 'vert');
  const faux = depot('faux', { surDev: '{"gel_des_fusions":false}' });
  assert.equal((await controlerLesFusions({ racine: faux, cible: 'master', source: 'hotfix/x', fetch: interdit })).raison, 'eteint');
  // la PR allume l'interrupteur dans son propre arbre : sans effet, et un `false` posé par la PR n'éteint pas non plus un interrupteur allumé sur dev
  const pr = depot('pr', { surDev: '{"gel_des_fusions":false}', surLaPR: '{"gel_des_fusions":true}' });
  assert.equal((await controlerLesFusions({ racine: pr, cible: 'dev', source: 'feature/x', fetch: interdit })).raison, 'eteint');
  const allumeSurDev = depot('pr-eteint', { surDev: '{"gel_des_fusions":true}', surLaPR: '{"gel_des_fusions":false}' });
  const f = fauxFetch({ corps: { workflow_runs: [run()] } });
  assert.equal((await controlerLesFusions({ racine: allumeSurDev, cible: 'dev', source: 'feature/x', depot: 'o/d', jeton: 'j', fetch: f, maintenantMs: MAINTENANT })).verdict, 'rouge');
  assert.throws(() => interrupteurDans(absent, 'origin/inconnue'), /introuvable/);
});

test('allumé : rouge avec un run en cours, vert sans, vert pour une fusion du workflow (sans lire GitHub) ; la requête est en lecture, avec le jeton, sur le bon workflow', async () => {
  const d = depot('allume', { surDev: '{"gel_des_fusions":true}' });
  const f = fauxFetch({ corps: { workflow_runs: [run({ status: 'completed' }), run({ id: 7, run_number: 9, run_started_at: '2026-11-20T11:55:00Z' })] } });
  const rouge = await controlerLesFusions({ racine: d, cible: 'dev', source: 'feature/ma-feature', depot: 'proprio/depot', jeton: 'jeton-lecture', fetch: f, api: 'https://api.exemple.invalid/', maintenantMs: MAINTENANT });
  assert.equal(rouge.verdict, 'rouge');
  assert.equal(rouge.runs.length, 1);
  assert.match(rouge.message, /n° 9/);
  assert.equal(f.appels.length, 1);
  assert.equal(f.appels[0].adresse, 'https://api.exemple.invalid/repos/proprio/depot/actions/workflows/mise-a-jour.yml/runs?per_page=30');
  assert.equal(f.appels[0].options.headers.Authorization, 'Bearer jeton-lecture');
  assert.equal(f.appels[0].options.method, undefined, 'GET : rien n’est écrit');
  const libre = await controlerLesFusions({ racine: d, cible: 'dev', source: 'feature/x', depot: 'o/d', jeton: 'j', fetch: fauxFetch({ corps: { workflow_runs: [run({ status: 'completed' })] } }), maintenantMs: MAINTENANT });
  assert.equal(libre.raison, 'aucun_run');
  for (const [source, cible] of [[FEATURE, 'dev'], ['dev', 'master']]) {
    assert.equal((await controlerLesFusions({ racine: d, cible, source, fetch: interdit })).raison, 'fusion_du_workflow', `${source} → ${cible}`);
  }
});

test('allumé et GitHub illisible : une erreur (le job est rouge), jamais un vert deviné', async () => {
  const d = depot('illisible', { surDev: '{"gel_des_fusions":true}' });
  const base = { racine: d, cible: 'dev', source: 'feature/x', depot: 'o/d', jeton: 'j' };
  await assert.rejects(controlerLesFusions({ ...base, fetch: fauxFetch({ statut: 403, corps: {} }) }), /403/);
  await assert.rejects(controlerLesFusions({ ...base, fetch: fauxFetch({ corps: { message: 'x' } }) }), /workflow_runs/);
  await assert.rejects(controlerLesFusions({ ...base, jeton: '', fetch: interdit }), /GITHUB_TOKEN absent/);
  await assert.rejects(controlerLesFusions({ ...base, depot: 'pas un dépôt', fetch: interdit }), /dépôt invalide/);
  await assert.rejects(controlerLesFusions({ ...base, fetch: async () => { throw new Error('réseau coupé'); } }), /réseau coupé/);
  await assert.rejects(lireLesRuns({ depot: 'o/d', jeton: 'j', fetch: fauxFetch({ statut: 500, corps: {} }) }), /500/);
});

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Le CLI, contre un faux serveur GitHub
// ---------------------------------------------------------------------------------------------------------------------------------------------

const lancer = promisify(execFile);
const demandes = [];
let reponseDuServeur = { statut: 200, corps: { workflow_runs: [] } };
const serveur = createServer((req, res) => {
  demandes.push({ url: req.url, auth: req.headers.authorization });
  res.writeHead(reponseDuServeur.statut, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(reponseDuServeur.corps));
});
await new Promise((ok) => serveur.listen(0, '127.0.0.1', ok));
after(() => new Promise((ok) => { serveur.close(ok); serveur.closeAllConnections?.(); }));

async function cli(d, args, { token = 'jeton-cli' } = {}) {
  const env = { PATH: process.env.PATH, ...variablesTemporaires(d), GITHUB_REPOSITORY: 'o/d', GITHUB_API_URL: `http://127.0.0.1:${serveur.address().port}`, ...(token ? { GITHUB_TOKEN: token } : {}) };
  try {
    const r = await lancer('node', ['--no-warnings', SCRIPT, '--racine', d, ...args], { env, timeout: 30_000 });
    return { code: 0, out: `${r.stdout}${r.stderr}` };
  } catch (e) {
    return { code: e.code, out: `${e.stdout ?? ''}${e.stderr ?? ''}` };
  }
}

test('CLI : éteint → 0 sans requête ; allumé avec un run en cours → 1 et le message (run, depuis quand, geste) dans la sortie et le résumé ; fusion du workflow → 0', async () => {
  demandes.length = 0;
  const eteint = depot('cli-eteint', { surDev: '{"gel_des_fusions":false}' });
  const r0 = await cli(eteint, ['--cible', 'dev', '--source', 'feature/x']);
  assert.equal(r0.code, 0, r0.out);
  assert.equal(demandes.length, 0, 'éteint : aucun appel');
  const allume = depot('cli-allume', { surDev: '{"gel_des_fusions":true}' });
  const maintenant = Date.now();
  reponseDuServeur = { statut: 200, corps: { workflow_runs: [run({ run_number: 77, run_started_at: new Date(maintenant - 20 * MIN).toISOString() })] } };
  const resume = join(dossierTemporaire('gel-fusions-resume'), 'resume.md');
  const r1 = await cli(allume, ['--cible', 'master', '--source', 'hotfix/x', '--resume', resume]);
  assert.equal(r1.code, 1, r1.out);
  assert.match(r1.out, /n° 77/);
  assert.match(r1.out, /il y a 2\d min/);
  assert.match(r1.out, /relancer ce job/);
  assert.match(readFileSync(resume, 'utf8'), /\*\*Refusé\.\*\*.*n° 77/s);
  assert.equal(demandes.length, 1);
  assert.equal(demandes[0].auth, 'Bearer jeton-cli');
  assert.ok(demandes[0].url.startsWith('/repos/o/d/actions/workflows/mise-a-jour.yml/runs'));
  const r2 = await cli(allume, ['--cible', 'dev', '--source', FEATURE]);
  assert.equal(r2.code, 0, r2.out);
  assert.equal(demandes.length, 1, 'la fusion du workflow ne lit pas GitHub');
  reponseDuServeur = { statut: 200, corps: { workflow_runs: [] } };
  assert.equal((await cli(allume, ['--cible', 'dev', '--source', 'feature/x'])).code, 0);
});

test('CLI : GitHub illisible, jeton absent, usage faux → 2 (jamais vert) ; le résumé le dit', async () => {
  const allume = depot('cli-erreur', { surDev: '{"gel_des_fusions":true}' });
  const resume = join(dossierTemporaire('gel-fusions-resume-erreur'), 'resume.md');
  reponseDuServeur = { statut: 403, corps: { message: 'interdit' } };
  const r = await cli(allume, ['--cible', 'dev', '--source', 'feature/x', '--resume', resume]);
  assert.equal(r.code, 2, r.out);
  assert.match(r.out, /403/);
  assert.match(readFileSync(resume, 'utf8'), /Illisible/);
  assert.equal((await cli(allume, ['--cible', 'dev', '--source', 'feature/x'], { token: '' })).code, 2);
  assert.equal((await cli(allume, ['--cible', 'autre', '--source', 'feature/x'])).code, 2);
  assert.equal((await cli(allume, ['--cible', 'dev'])).code, 2);
});

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Le job de ci.yml
// ---------------------------------------------------------------------------------------------------------------------------------------------

test('ci.yml : le job gel-des-fusions lit l’interrupteur d’origin/dev par le script, sur les PR vers dev et master, avec la lecture des actions seulement', () => {
  const ci = readFileSync(join(RACINE, '.github/workflows/ci.yml'), 'utf8');
  const debut = ci.indexOf('\n  gel-des-fusions:\n');
  assert.ok(debut > 0, 'le job existe');
  const fin = ci.indexOf('\n  character-service:', debut);
  const job = ci.slice(debut, fin > 0 ? fin : undefined);
  assert.match(job, /if: github\.event_name == 'pull_request' && \(github\.base_ref == 'dev' \|\| github\.base_ref == 'master'\)/);
  assert.match(job, /permissions:\n\s+contents: read\n\s+actions: read\n/);
  assert.match(job, /fetch-depth: 0/, 'origin/dev doit être là');
  assert.match(job, /scripts\/gel-des-fusions\.mjs --cible "\$CIBLE" --source "\$SOURCE"/);
  assert.match(job, /GITHUB_TOKEN: \$\{\{ secrets\.GITHUB_TOKEN \}\}/);
  assert.doesNotMatch(job, /npm ci|MISE_A_JOUR_TOKEN|contents: write|actions: write/, 'ni npm, ni jeton d’écriture');
});
