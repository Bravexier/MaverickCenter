// L'issue de la CI nocturne (scripts/ci-nocturne-issue.mjs, job `issue-ci-nocturne` de .github/workflows/ci.yml) : une seule issue au titre fixe,
// ouverte ou réécrite par une nuit rouge, fermée par la première nuit verte ; le journal est une donnée non fiable. GitHub est simulé (fetch factice).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import YAML from 'yaml';
import {
  JOB, LABEL, MARQUEUR, MAX_CORPS, MAX_NOM, MAX_TESTS, TITRE, clientGitHub, corpsDeLIssue, emplacement, etatDuRun, jobsEnEchec, neutraliserMentions,
  nettoyer, tenirLIssue, testsEnEchec,
} from '../scripts/ci-nocturne-issue.mjs';

const CI = new URL('../../.github/workflows/ci.yml', import.meta.url);
const LIEN = 'https://github.com/o/d/actions/runs/77';
const H = '2026-11-19T03:40:01.1234567Z ';

// Un journal de job comme GitHub le rend (horodatage par ligne), TAP de node --test : une feuille rouge, un parent de sous-test rouge, un vert, un TODO.
const JOURNAL = [
  'TAP version 13',
  '# Subtest: groupe',
  '    # Subtest: sous-test rouge @quelquun',
  '    not ok 1 - sous-test rouge @quelquun',
  '      ---',
  "      location: '/home/runner/work/d/d/client/test/a.test.mjs:4:35'",
  "      failureType: 'testCodeFailure'",
  "      error: 'contenu du site : ne doit pas sortir'",
  '      stack: |-',
  '        not ok 9 - fuite du message',
  "        location: '/x/client/test/faux.test.mjs:1:1'",
  '      ...',
  'not ok 1 - groupe',
  '  ---',
  "  location: '/home/runner/work/d/d/client/test/a.test.mjs:4:1'",
  "  failureType: 'subtestsFailed'",
  '  ...',
  'ok 2 - vert',
  'not ok 3 - pas fini # TODO',
  'not ok 4 - fichier \\# cassé `x` \u202e[lien](http://x)',
  '  ---',
  "  location: '/home/runner/work/d/d/client/test/b.test.mjs:9:1'",
  '  ...',
].map((l) => H + l).join('\n');

test('état du run : rouge dès un échec, vert si tout a réussi, sinon on ne touche à rien', () => {
  assert.equal(etatDuRun({ a: { result: 'success' }, b: { result: 'failure' } }), 'rouge');
  assert.equal(etatDuRun({ a: { result: 'success' }, b: { result: 'success' } }), 'vert');
  assert.equal(etatDuRun({ a: { result: 'success' }, b: { result: 'cancelled' } }), 'indetermine');
  assert.equal(etatDuRun({}), 'indetermine');
});

test('tests en échec lus dans le TAP : feuilles seulement, sans TODO, emplacement relatif, jamais le message d’erreur', () => {
  const tests = testsEnEchec(JOURNAL);
  assert.deepEqual(tests.map((t) => t.lieu), ['client/test/a.test.mjs:4', 'client/test/b.test.mjs:9']);
  assert.equal(tests[0].nom, 'sous-test rouge @quelquun');
  assert.ok(tests[1].nom.startsWith('fichier # cassé'));
  assert.ok(!JSON.stringify(tests).includes('ne doit pas sortir'));
  assert.ok(!JSON.stringify(tests).includes('fuite'), 'un « not ok » dans un bloc YAML (message, pile) n’est pas un test');
  assert.equal(emplacement('file:///x/y/z.test.mjs:3:1'), 'y/z.test.mjs:3');
});

test('donnée non fiable : nettoyée, bornée, rendue en code ; les @mentions hors code sont neutralisées', () => {
  assert.equal(nettoyer('a\u0000b`c\u202ed\n e'), "a b'c d e");
  assert.equal(nettoyer('x'.repeat(MAX_NOM + 50)).length, MAX_NOM);
  assert.equal(neutraliserMentions('voir @nom et a@b.c'), 'voir `@nom` et a@b.c');
  const corps = corpsDeLIssue({ date: 0, lien: LIEN, numeroRun: 'n° 5', jobs: [{ nom: 'client', etapes: ['Run npm test'] }], tests: testsEnEchec(JOURNAL) });
  assert.ok(corps.startsWith(MARQUEUR));
  assert.ok(corps.includes(LIEN));
  // aucune @mention, aucun lien ni caractère de contrôle hors d'un code
  const horsCode = corps.replace(/`[^`\n]*`/g, '').replace(`(${LIEN})`, '');
  assert.doesNotMatch(horsCode, /@\w|\]\(|\u202e/);
  assert.match(corps, /`client\/test\/b\.test\.mjs:9` — `fichier # cassé 'x'/);
});

test('corps borné : au plus MAX_TESTS tests listés, et jamais plus de MAX_CORPS caractères', () => {
  const tests = Array.from({ length: MAX_TESTS + 7 }, (_, i) => ({ nom: `t${i}`, lieu: `client/test/t${i}.test.mjs:1` }));
  const corps = corpsDeLIssue({ date: 0, lien: LIEN, numeroRun: '1', tests });
  assert.equal((corps.match(/^- `client\/test\/t/gm) ?? []).length, MAX_TESTS);
  assert.match(corps, /… et 7 autre/);
  const enorme = Array.from({ length: 5000 }, (_, i) => ({ nom: 'n'.repeat(MAX_NOM), lieu: `l${i}` }));
  assert.ok(corpsDeLIssue({ date: 0, lien: LIEN, numeroRun: '1', tests: enorme }).length <= MAX_CORPS);
  assert.deepEqual(jobsEnEchec([{ id: 1, name: JOB, conclusion: 'failure', steps: [] }, { id: 2, name: 'client', conclusion: 'failure', steps: [{ name: 's', conclusion: 'failure' }, { name: 'v', conclusion: 'success' }] }]),
    [{ id: 2, nom: 'client', etapes: ['s'] }]);
});

/** GitHub factice : issues, labels, jobs et journaux du run ; consigne chaque appel. */
function github({ issues = [], label = true, journal = JOURNAL } = {}) {
  const appels = [];
  const etat = { issues: issues.map((i) => ({ ...i })), commentaires: [], label };
  const repondre = (statut, corps, texte = false) => ({ ok: statut < 300, status: statut, json: async () => corps, text: async () => (texte ? corps : JSON.stringify(corps)) });
  const fetch = async (url, { method = 'GET', body, headers } = {}) => {
    assert.equal(headers.Authorization, 'Bearer jeton');
    const chemin = url.replace('https://api.github.com/repos/o/d', '');
    const donnees = body ? JSON.parse(body) : null;
    appels.push(`${method} ${chemin.split('?')[0]}`);
    if (method === 'GET' && chemin.startsWith('/issues?')) {
      assert.match(chemin, new RegExp(`labels=${LABEL}`));
      return repondre(200, etat.issues.filter((i) => i.state === 'open' && i.labels.includes(LABEL)));
    }
    if (method === 'GET' && chemin.startsWith('/actions/runs/77/jobs')) return repondre(200, { jobs: [{ id: 9, name: 'client', conclusion: 'failure', steps: [{ name: 'Run npm test', conclusion: 'failure' }] }] });
    if (method === 'GET' && chemin === '/actions/jobs/9/logs') return journal === null ? repondre(500, null) : repondre(200, journal, true);
    if (method === 'GET' && chemin.startsWith('/labels/')) return etat.label ? repondre(200, {}) : repondre(404, null);
    if (method === 'POST' && chemin === '/labels') { etat.label = true; return repondre(201, {}); }
    if (method === 'POST' && chemin === '/issues') {
      const issue = { number: 100 + etat.issues.length, state: 'open', title: donnees.title, body: donnees.body, labels: donnees.labels };
      etat.issues.push(issue);
      return repondre(201, issue);
    }
    const n = /^\/issues\/(\d+)(\/comments)?$/.exec(chemin);
    if (n) {
      const issue = etat.issues.find((i) => i.number === Number(n[1]));
      if (n[2]) { etat.commentaires.push({ numero: issue.number, body: donnees.body }); return repondre(201, {}); }
      Object.assign(issue, donnees);
      return repondre(200, issue);
    }
    throw new Error(`appel inattendu ${method} ${chemin}`);
  };
  return { appels, etat, gh: clientGitHub({ depot: 'o/d', jeton: 'jeton', fetch }) };
}

const nuit = (g, result, extra = {}) => tenirLIssue({ gh: g.gh, resultats: { 'extrait-du-site-de-dev': { result: 'success' }, client: { result } }, runId: '77', lien: LIEN, numeroRun: 'n° 5', ...extra });

test('nuit rouge sans issue ouverte : le label créé au besoin, puis UNE issue au titre fixe, avec le lien et les tests', async () => {
  const g = github({ label: false });
  assert.equal((await nuit(g, 'failure')).action, 'creee');
  assert.equal(g.etat.issues.length, 1);
  const [issue] = g.etat.issues;
  assert.equal(issue.title, TITRE);
  assert.deepEqual(issue.labels, [LABEL]);
  assert.ok(issue.body.includes(LIEN) && issue.body.includes('client/test/a.test.mjs:4'));
  assert.ok(g.appels.includes('POST /labels'));
  assert.ok(!g.appels.some((a) => a.startsWith('PUT') || a.startsWith('DELETE')), 'aucune autre écriture');
});

test('nuits rouges suivantes : la même issue, corps réécrit et un commentaire, jamais une deuxième', async () => {
  const g = github();
  await nuit(g, 'failure');
  const r = await nuit(g, 'failure');
  assert.equal(r.action, 'mise-a-jour');
  assert.equal(g.etat.issues.length, 1);
  assert.equal(g.etat.commentaires.length, 1);
  assert.ok(g.etat.commentaires[0].body.includes(LIEN));
  // une issue fermée de même titre, ou ouverte d'un autre titre, ne compte pas
  const h = github({ issues: [{ number: 1, state: 'closed', title: TITRE, labels: [LABEL] }, { number: 2, state: 'open', title: 'autre', labels: [LABEL] }] });
  assert.equal((await nuit(h, 'failure')).action, 'creee');
});

test('journal illisible : l’issue est quand même tenue et le dit', async () => {
  const g = github({ journal: null });
  await nuit(g, 'failure');
  assert.match(g.etat.issues[0].body, /journal illisible/);
});

test('nuit verte : l’issue ouverte est fermée avec un commentaire ; sans issue, rien ; run annulé : rien', async () => {
  const g = github();
  await nuit(g, 'failure');
  const r = await nuit(g, 'success');
  assert.equal(r.action, 'fermee');
  assert.equal(g.etat.issues[0].state, 'closed');
  assert.equal(g.etat.issues[0].state_reason, 'completed');
  assert.ok(g.etat.commentaires.at(-1).body.includes(LIEN));
  assert.equal((await nuit(g, 'success')).action, 'rien');
  const h = github({ issues: [{ number: 1, state: 'open', title: TITRE, labels: [LABEL] }] });
  assert.equal((await nuit(h, 'cancelled')).action, 'rien');
  assert.deepEqual(h.appels, [], 'aucun appel à GitHub');
});

test('ci.yml : le job issue-ci-nocturne ne tourne que la nuit, après l’extrait et le client, seul à écrire des issues, sans secret du site de dev ni npm', () => {
  const ci = YAML.parse(readFileSync(CI, 'utf8'));
  assert.ok(ci.on.schedule?.length, 'déclenchement programmé');
  const job = ci.jobs[JOB];
  assert.ok(job, 'job présent');
  assert.equal(job.if, "${{ github.event_name == 'schedule' && !cancelled() }}");
  assert.deepEqual(job.needs, ['extrait-du-site-de-dev', 'client']);
  assert.deepEqual(job.permissions, { contents: 'read', actions: 'read', issues: 'write' });
  assert.ok(job['timeout-minutes'] > 0);
  const texte = JSON.stringify(job);
  assert.deepEqual([...texte.matchAll(/secrets\.([A-Z_]+)/g)].map((m) => m[1]), ['GITHUB_TOKEN']);
  assert.doesNotMatch(texte, /\bnpm\b/);
  assert.ok(job.steps.some((s) => /scripts\/ci-nocturne-issue\.mjs/.test(s.run ?? '') && s.env?.RESULTATS === '${{ toJSON(needs) }}'));
  // aucun autre job n'écrit des issues
  for (const [nom, j] of Object.entries(ci.jobs)) if (nom !== JOB) assert.notEqual(j.permissions?.issues, 'write', nom);
  assert.notEqual(ci.permissions?.issues, 'write');
});
