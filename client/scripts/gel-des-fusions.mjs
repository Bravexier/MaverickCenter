// Le gel des fusions pendant une mise à jour (lot 11 ; job `gel-des-fusions` de .github/workflows/ci.yml ; règles : scripts/gel-des-fusions-lib.mjs ;
// docs/flux-git.md, « Gel des fusions pendant une mise à jour »). Ce fichier lit l'interrupteur dans le dépôt (git) et les runs du workflow de mise à jour
// dans l'API de GitHub (lecture seule, GITHUB_TOKEN).
//   node scripts/gel-des-fusions.mjs --cible <dev|master> --source <branche de la PR> [--depot <propriétaire/dépôt>] [--interrupteur origin/dev] [--racine <dépôt>] [--resume <fichier.md>]
// Éteint (interrupteur absent ou `actif: false` sur origin/dev) : vert, sans appel réseau. Allumé et GitHub illisible (jeton, réseau, réponse inattendue) :
// ROUGE (on ne devine pas qu'aucune mise à jour ne tourne) ; relancer le job règle une panne passagère. Sortie : 0 (vert), 1 (rouge : le run, depuis
// quand, le geste), 2 (usage, dépôt ou API illisible).
import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { BRANCHE_DE_L_INTERRUPTEUR, INTERRUPTEUR, WORKFLOW_DE_MISE_A_JOUR, decider, estUneFusionDuWorkflow, lireLInterrupteur, resumeDeLaDecision, runsEnCours } from './gel-des-fusions-lib.mjs';

const RACINE_DU_DEPOT = fileURLToPath(new URL('../../', import.meta.url));

const git = (racine, args, { ok = [0] } = {}) => {
  try {
    return execFileSync('git', ['-C', racine, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    if (ok.includes(e.status)) return null;
    throw new Error(`git ${args.join(' ')} : ${String(e.stderr ?? e.message).trim().split('\n')[0]}`);
  }
};

/** L'interrupteur lu dans `ref` (false si le fichier y manque : éteint). */
export function interrupteurDans(racine, ref) {
  if (git(racine, ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`], { ok: [1] }) === null) throw new Error(`${ref} introuvable : l’interrupteur ${INTERRUPTEUR} ne se lit pas (git fetch origin dev)`);
  return lireLInterrupteur(git(racine, ['show', `${ref}:${INTERRUPTEUR}`], { ok: [128] }));
}

/** Les runs pas finis du workflow de mise à jour (GET /repos/<dépôt>/actions/workflows/mise-a-jour.yml/runs, jeton en lecture). */
export async function lireLesRuns({ depot, jeton, api = 'https://api.github.com', fetch: appeler = globalThis.fetch, maintenantMs = Date.now() }) {
  if (!/^[\w.-]+\/[\w.-]+$/.test(depot ?? '')) throw new Error(`dépôt invalide « ${depot ?? ''} » (propriétaire/dépôt attendu)`);
  if (!jeton) throw new Error('GITHUB_TOKEN absent : les runs de la mise à jour ne se lisent pas');
  const reponse = await appeler(`${api.replace(/\/+$/, '')}/repos/${depot}/actions/workflows/${WORKFLOW_DE_MISE_A_JOUR}/runs?per_page=30`, {
    headers: { Authorization: `Bearer ${jeton}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
  });
  if (!reponse.ok) throw new Error(`GitHub a répondu ${reponse.status} à la lecture des runs de ${WORKFLOW_DE_MISE_A_JOUR} (jeton sans la lecture des actions ? réseau ?)`);
  const corps = await reponse.json();
  if (!Array.isArray(corps?.workflow_runs)) throw new Error('réponse inattendue de GitHub : pas de liste `workflow_runs`');
  return runsEnCours(corps.workflow_runs, { maintenantMs });
}

/** La décision pour une PR : lit l'interrupteur, puis (allumé, hors fusion du workflow) les runs. */
export async function controlerLesFusions({ racine = RACINE_DU_DEPOT, cible, source, interrupteur = BRANCHE_DE_L_INTERRUPTEUR, depot, jeton, api, fetch, maintenantMs }) {
  const actif = interrupteurDans(racine, interrupteur);
  const lireRuns = actif && !estUneFusionDuWorkflow({ source, cible });
  const runs = lireRuns ? await lireLesRuns({ depot, jeton, api, fetch, maintenantMs }) : null;
  return decider({ actif, source, cible, runs });
}

async function main(args) {
  const option = (nom, defaut) => {
    const i = args.indexOf(nom);
    return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : defaut;
  };
  const cible = option('--cible', null);
  const source = option('--source', null);
  if (!['dev', 'master'].includes(cible) || !source) {
    console.error('Usage : node scripts/gel-des-fusions.mjs --cible dev|master --source <branche> [--depot <propriétaire/dépôt>] [--interrupteur origin/dev] [--racine <dépôt>] [--resume <fichier.md>]');
    return 2;
  }
  try {
    const d = await controlerLesFusions({
      racine: option('--racine', RACINE_DU_DEPOT), cible, source, interrupteur: option('--interrupteur', BRANCHE_DE_L_INTERRUPTEUR),
      depot: option('--depot', process.env.GITHUB_REPOSITORY), jeton: process.env.GITHUB_TOKEN, api: process.env.GITHUB_API_URL || undefined,
    });
    console.log(d.message);
    const resume = option('--resume', null);
    if (resume) appendFileSync(resume, `${resumeDeLaDecision(d)}\n`);
    return d.verdict === 'rouge' ? 1 : 0;
  } catch (e) {
    console.error(`ERREUR : ${e.message}`);
    const resume = option('--resume', null);
    if (resume) appendFileSync(resume, `### Gel des fusions\n\n**Illisible.** ${e.message}. Relancer ce job (« Re-run »).\n\n`);
    return 2;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = await main(process.argv.slice(2));
