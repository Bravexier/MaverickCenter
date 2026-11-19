// L'issue de la CI nocturne (job `issue-ci-nocturne` de .github/workflows/ci.yml ; docs/flux-git.md, « Contenu lu par les tests », puce « Chaque nuit ») :
// une nuit rouge ouvre, ou met à jour, UNE issue au titre fixe (label `ci-nocturne`) : date, lien du run, jobs et étapes en échec, tests en échec lus
// dans le journal du job (TAP de node --test : nom et emplacement seulement, jamais le message d'erreur, qui peut citer le contenu du site de dev) ;
// la première nuit verte la ferme avec un commentaire. Aucune correction, aucun push : l'API des issues et la lecture des jobs du run, rien d'autre.
//   RESULTATS='{"client":{"result":"failure"}}' GITHUB_TOKEN=… GITHUB_REPOSITORY=propriétaire/dépôt GITHUB_RUN_ID=… node scripts/ci-nocturne-issue.mjs
// Le journal est une donnée non fiable : chaque nom est nettoyé (caractères de contrôle, accents graves), borné, et rendu en code (ni @mention, ni lien,
// ni image) ; la liste et le corps sont bornés. Sortie : 0 (fait, ou rien à faire), 2 (usage ou GitHub illisible).
import { pathToFileURL } from 'node:url';

export const TITRE = 'CI nocturne en échec';
export const LABEL = 'ci-nocturne';
export const MARQUEUR = '<!-- ci-nocturne -->';
/** Le job qui tient l'issue (il n'est pas compté parmi les jobs en échec). */
export const JOB = 'issue-ci-nocturne';
export const MAX_TESTS = 50;
export const MAX_NOM = 200;
/** GitHub accepte 65 536 caractères dans un corps d'issue. */
export const MAX_CORPS = 60_000;
/** Journal d'un job lu au plus (la fin, où sont les échecs). */
export const MAX_JOURNAL = 20_000_000;

const CONTROLE = /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069]/g;

/** Texte d'une source non fiable sur une ligne : sans caractère de contrôle ni accent grave, espaces resserrés, borné. */
export function nettoyer(texte, max = MAX_NOM) {
  const t = String(texte ?? '').replace(CONTROLE, ' ').replace(/`/g, "'").replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

/** Les « @nom » hors code, mis entre accents graves : GitHub ne notifie personne. */
export function neutraliserMentions(texte) {
  return String(texte).replace(/(^|[^\w`])@([\w-]+(?:\/[\w.-]+)?)/g, '$1`@$2`');
}

/** Un texte non fiable rendu en code (rien n'y est interprété : ni mention, ni lien, ni image, ni HTML). */
export const enCode = (texte, max = MAX_NOM) => `\`${nettoyer(texte, max) || ' '}\``;

/** Rouge si un job attendu a échoué, vert si tous ont réussi ; sinon (annulé, sauté) : indéterminé, on ne touche à rien. */
export function etatDuRun(resultats) {
  const valeurs = Object.values(resultats ?? {}).map((r) => r?.result);
  if (!valeurs.length) return 'indetermine';
  if (valeurs.includes('failure')) return 'rouge';
  return valeurs.every((r) => r === 'success') ? 'vert' : 'indetermine';
}

/** Emplacement d'un test, relatif au dépôt quand on le reconnaît (`client/test/x.test.mjs:12`). */
export function emplacement(chemin) {
  const m = /^(.+?):(\d+)(?::\d+)?$/.exec(String(chemin ?? '').replace(/^file:\/\//, ''));
  const [fichier, ligne] = m ? [m[1], m[2]] : [String(chemin ?? ''), null];
  const i = fichier.lastIndexOf('/client/');
  const relatif = i >= 0 ? fichier.slice(i + 1) : fichier.split('/').slice(-2).join('/');
  return ligne ? `${relatif}:${ligne}` : relatif;
}

/**
 * Les tests en échec d'un journal de job GitHub (TAP de node --test, horodatage de GitHub en tête de ligne) : les « not ok » hors TODO et SKIP, sans
 * les parents dont seuls des sous-tests ont échoué (failureType subtestsFailed). Ni message ni pile : seulement le nom et l'emplacement.
 */
export function testsEnEchec(journal) {
  const lignes = String(journal ?? '').split(/\r?\n/).map((l) => l.replace(/^\d{4}-\d\d-\d\dT[\d:.]+Z ?/, ''));
  const tests = [];
  // Un bloc YAML (« --- » … « ... ») n'est jamais lu comme une ligne de test : un message d'erreur peut contenir « not ok N - … ».
  const debutDeBloc = (l) => /^\s*---\s*$/.test(l);
  const finDeBloc = (l) => /^\s*\.\.\.\s*$/.test(l);
  for (let i = 0; i < lignes.length; i++) {
    if (debutDeBloc(lignes[i])) {
      while (i + 1 < lignes.length && !finDeBloc(lignes[i + 1])) i++;
      continue;
    }
    const m = /^(\s*)not ok \d+ - (.*)$/.exec(lignes[i]);
    if (!m || /\s#\s*(TODO|SKIP)\b/i.test(m[2])) continue;
    const retrait = m[1].length;
    let lieu = null;
    let parent = false;
    if (debutDeBloc(lignes[i + 1] ?? '')) {
      // les clés de ce test sont au premier niveau du bloc (retrait + 2) ; les lignes plus enfoncées sont le message ou la pile
      for (let j = i + 2; j < lignes.length && !finDeBloc(lignes[j]); j++) {
        const l = lignes[j];
        if (l.search(/\S/) !== retrait + 2) continue;
        const loc = /^\s*location: '(.*)'\s*$/.exec(l);
        if (loc) lieu = loc[1];
        if (/^\s*failureType: 'subtestsFailed'\s*$/.test(l)) parent = true;
      }
    }
    if (parent) continue;
    tests.push({ nom: m[2].replace(/\\#/g, '#').replace(/\\\\/g, '\\'), lieu: lieu ? emplacement(lieu) : null });
  }
  return tests;
}

/** Jobs du run en échec (hors celui-ci) et leurs étapes en échec. */
export function jobsEnEchec(jobs) {
  return (jobs ?? []).filter((j) => j?.conclusion === 'failure' && j.name !== JOB)
    .map((j) => ({ id: j.id, nom: j.name, etapes: (j.steps ?? []).filter((s) => s?.conclusion === 'failure').map((s) => s.name) }));
}

/** Date lisible (UTC). */
export const dateUTC = (d) => `${new Date(d).toISOString().slice(0, 16).replace('T', ' ')} UTC`;

/** Le corps de l'issue (marqueur, date, run, jobs et étapes, tests), borné à MAX_CORPS. */
export function corpsDeLIssue({ date, lien, numeroRun, jobs = [], tests = [], lecture = null }) {
  const lignes = [MARQUEUR, 'La CI nocturne (déclenchement programmé sur `dev`, contenu du site de dev du jour) est **rouge**.', '',
    `- Date : ${dateUTC(date)}`, `- Run : [${nettoyer(numeroRun, 40)}](${lien})`, '', '### Jobs et étapes en échec', ''];
  if (!jobs.length) lignes.push('- (non lus : voir le run)');
  for (const j of jobs) lignes.push(`- ${enCode(j.nom, 100)}${j.etapes.length ? ` : ${j.etapes.map((e) => enCode(e, 100)).join(', ')}` : ''}`);
  lignes.push('', `### Tests en échec (${tests.length})`, '');
  if (!tests.length) lignes.push(lecture ? `- (journal illisible : ${neutraliserMentions(nettoyer(lecture, 200))} ; voir le run)` : '- (aucun test en échec lu dans le journal : une étape hors tests, voir le run)');
  for (const t of tests.slice(0, MAX_TESTS)) lignes.push(`- ${t.lieu ? `${enCode(t.lieu, 160)} — ` : ''}${enCode(t.nom)}`);
  if (tests.length > MAX_TESTS) lignes.push(`- … et ${tests.length - MAX_TESTS} autre(s) : voir le run`);
  const pied = ['', `Issue tenue par le job \`${JOB}\` de \`.github/workflows/ci.yml\` : réécrite à chaque nuit rouge, fermée à la première nuit verte. Aucune correction automatique.`];
  let corps = [...lignes, ...pied].join('\n');
  if (corps.length > MAX_CORPS) corps = `${lignes.join('\n').slice(0, MAX_CORPS - 400)}\n- … (coupé : voir le run)${pied.join('\n')}`;
  return corps;
}

/** Client minimal de l'API REST de GitHub (fetch global, aucune dépendance). */
export function clientGitHub({ depot, jeton, api = 'https://api.github.com', fetch: appeler = globalThis.fetch }) {
  if (!/^[\w.-]+\/[\w.-]+$/.test(depot ?? '')) throw new Error(`dépôt invalide « ${depot ?? ''} » (propriétaire/dépôt attendu)`);
  if (!jeton) throw new Error('GITHUB_TOKEN absent');
  const base = `${api.replace(/\/+$/, '')}/repos/${depot}`;
  const entetes = { Authorization: `Bearer ${jeton}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
  return async function gh(methode, chemin, corps, { accepter = [], texte = false } = {}) {
    const r = await appeler(`${base}${chemin}`, { method: methode, headers: corps ? { ...entetes, 'Content-Type': 'application/json' } : entetes, body: corps ? JSON.stringify(corps) : undefined });
    if (!r.ok && !accepter.includes(r.status)) throw new Error(`GitHub a répondu ${r.status} à ${methode} ${chemin}`);
    if (!r.ok) return { statut: r.status, corps: null };
    return { statut: r.status, corps: texte ? await r.text() : r.status === 204 ? null : await r.json() };
  };
}

/** L'issue ouverte au titre fixe et au label (la plus ancienne s'il y en avait plusieurs), ou null. */
export async function chercherLIssue(gh) {
  const { corps } = await gh('GET', `/issues?state=open&labels=${encodeURIComponent(LABEL)}&per_page=100`);
  const trouvees = (corps ?? []).filter((i) => !i.pull_request && i.title === TITRE).sort((a, b) => a.number - b.number);
  return trouvees[0] ?? null;
}

/** Jobs et tests en échec du run (lecture seule : actions: read). Une lecture ratée n'empêche pas l'issue : elle le dit. */
export async function lireLesEchecs(gh, runId) {
  const { corps } = await gh('GET', `/actions/runs/${runId}/jobs?filter=latest&per_page=100`);
  const jobs = jobsEnEchec(corps?.jobs);
  const tests = [];
  let lecture = null;
  for (const j of jobs) {
    try {
      const { corps: journal } = await gh('GET', `/actions/jobs/${j.id}/logs`, null, { texte: true });
      tests.push(...testsEnEchec(journal.length > MAX_JOURNAL ? journal.slice(-MAX_JOURNAL) : journal));
    } catch (e) {
      lecture = e.message;
    }
  }
  return { jobs, tests, lecture };
}

/**
 * Le geste du soir : « creee », « mise-a-jour », « fermee » ou « rien ». `resultats` : les `needs` du job (JSON de toJSON(needs)).
 */
export async function tenirLIssue({ gh, resultats, runId, lien, numeroRun, maintenant = Date.now() }) {
  const etat = etatDuRun(resultats);
  if (etat === 'indetermine') return { action: 'rien', etat };
  const ouverte = await chercherLIssue(gh);
  if (etat === 'vert') {
    if (!ouverte) return { action: 'rien', etat };
    await gh('POST', `/issues/${ouverte.number}/comments`, { body: `${MARQUEUR}\nLa CI nocturne est revenue au vert le ${dateUTC(maintenant)} : [run ${nettoyer(numeroRun, 40)}](${lien}). Issue fermée.` });
    await gh('PATCH', `/issues/${ouverte.number}`, { state: 'closed', state_reason: 'completed' });
    return { action: 'fermee', etat, numero: ouverte.number };
  }
  let echecs;
  try {
    echecs = await lireLesEchecs(gh, runId);
  } catch (e) {
    echecs = { jobs: [], tests: [], lecture: e.message };
  }
  const body = corpsDeLIssue({ date: maintenant, lien, numeroRun, ...echecs });
  if (ouverte) {
    await gh('PATCH', `/issues/${ouverte.number}`, { body });
    await gh('POST', `/issues/${ouverte.number}/comments`, { body: `${MARQUEUR}\nToujours rouge le ${dateUTC(maintenant)} : [run ${nettoyer(numeroRun, 40)}](${lien}), ${echecs.tests.length} test(s) en échec. Le corps de l'issue est à jour.` });
    return { action: 'mise-a-jour', etat, numero: ouverte.number };
  }
  const label = await gh('GET', `/labels/${encodeURIComponent(LABEL)}`, null, { accepter: [404] });
  if (label.statut === 404) await gh('POST', '/labels', { name: LABEL, color: 'd73a4a', description: 'CI nocturne rouge (tenue par le job issue-ci-nocturne de ci.yml)' }, { accepter: [422] });
  const { corps: creee } = await gh('POST', '/issues', { title: TITRE, body, labels: [LABEL] });
  return { action: 'creee', etat, numero: creee?.number };
}

async function main(env = process.env) {
  let resultats;
  try {
    resultats = JSON.parse(env.RESULTATS ?? '');
  } catch {
    console.error('Usage : RESULTATS=<toJSON(needs)> GITHUB_TOKEN=… GITHUB_REPOSITORY=… GITHUB_RUN_ID=… node scripts/ci-nocturne-issue.mjs');
    return 2;
  }
  const runId = env.GITHUB_RUN_ID;
  if (!/^\d+$/.test(runId ?? '')) {
    console.error('GITHUB_RUN_ID absent ou invalide');
    return 2;
  }
  const depot = env.GITHUB_REPOSITORY;
  const lien = `${(env.GITHUB_SERVER_URL ?? 'https://github.com').replace(/\/+$/, '')}/${depot}/actions/runs/${runId}`;
  const numeroRun = `n° ${env.GITHUB_RUN_NUMBER ?? runId}${env.GITHUB_RUN_ATTEMPT && env.GITHUB_RUN_ATTEMPT !== '1' ? `, tentative ${env.GITHUB_RUN_ATTEMPT}` : ''}`;
  try {
    const gh = clientGitHub({ depot, jeton: env.GITHUB_TOKEN, api: env.GITHUB_API_URL });
    const r = await tenirLIssue({ gh, resultats, runId, lien, numeroRun });
    console.log(`CI nocturne ${r.etat} : ${r.action}${r.numero ? ` (issue #${r.numero})` : ''}.`);
    return 0;
  } catch (e) {
    console.error(`Issue de la CI nocturne : ${e.message}`);
    return 2;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = await main();
