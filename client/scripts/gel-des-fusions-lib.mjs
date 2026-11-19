// Le gel des fusions pendant une mise à jour (lot 11, bascule 2 ; docs/flux-git.md, « Gel des fusions pendant une mise à jour » ; plan : docs/chantier-base-de-dev.md,
// section 15) : job `gel-des-fusions` de .github/workflows/ci.yml, sur chaque PR vers dev et master. Une mise à jour du site (workflow mise-a-jour.yml) fusionne
// elle-même dans dev puis livre vers master : une autre fusion en plein milieu déplacerait la base sous ses pieds. Ce module porte la décision, pure (des
// données d'API déjà lues, sans réseau ni git) ; scripts/gel-des-fusions.mjs lit le dépôt et l'API de GitHub.
//
// ÉTEINT tant que l'interrupteur (tools/flux-git/bascule-2.json, `gel_des_fusions`, indépendant de `actif`) ne vaut pas true dans `origin/dev` : le job passe vert sans rien lire d'autre ni
// appeler GitHub. Allumé : rouge tant qu'un run de mise-a-jour.yml est en cours (pas fini : en file, en cours, en attente), SAUF pour les deux fusions que ce
// workflow fait lui-même : la PR de sa branche feature/mise-a-jour-regles-… vers dev, et la PR de livraison dev → master. Le job ne devient un check REQUIS
// que par une décision du propriétaire sur les rulesets (.github/rulesets/, mise-a-jour-github.mjs#CHECKS_REQUIS) : ce module n'y touche pas.
// Un run « en cours » depuis plus de 8 h est ignoré (GitHub arrête un job au bout de 6 h ; un run resté en file ne gèlerait pas les fusions pour toujours).
import { BRANCHE_DU_WORKFLOW } from './mise-a-jour-github.mjs';
import { DEV, MASTER } from '../../tools/flux-git/regles.mjs';

/** L'interrupteur, relatif à la racine du dépôt ; lu dans `origin/dev` (jamais dans la PR contrôlée). */
export const INTERRUPTEUR = 'tools/flux-git/bascule-2.json';
export const BRANCHE_DE_L_INTERRUPTEUR = `origin/${DEV}`;
/** Le workflow dont un run en cours gèle les fusions. */
export const WORKFLOW_DE_MISE_A_JOUR = 'mise-a-jour.yml';
export const NOM_DU_WORKFLOW = 'Mise à jour des règles';
/** Au-delà, un run « pas fini » est ignoré. */
export const PLAFOND_D_UN_RUN_MS = 8 * 3600_000;

/** Lit l'interrupteur (le texte du fichier, ou null s'il est absent : éteint). Un fichier illisible fait échouer le job : on ne devine pas. */
export function lireLInterrupteur(texte) {
  if (texte === null || texte === undefined) return false;
  let v;
  try {
    v = JSON.parse(texte);
  } catch {
    throw new Error(`${INTERRUPTEUR} illisible (JSON attendu : { "gel_des_fusions": false } ou { "gel_des_fusions": true })`);
  }
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error(`${INTERRUPTEUR} : un objet JSON est attendu, avec « gel_des_fusions » à true ou false`);
  // « gel_des_fusions » seul gouverne ce job ; « actif » est l'autre interrupteur du fichier (kit seul, identité du lot : tools/flux-git/bascule-2.mjs). Absent : éteint.
  if (v.gel_des_fusions === undefined) return false;
  if (typeof v.gel_des_fusions !== 'boolean') throw new Error(`${INTERRUPTEUR} : « gel_des_fusions » doit valoir true ou false`);
  return v.gel_des_fusions;
}

/** La PR est-elle une fusion que le workflow de mise à jour fait lui-même (sa branche vers dev, ou la livraison dev → master) ? */
export const estUneFusionDuWorkflow = ({ source, cible }) => (
  (cible === DEV && BRANCHE_DU_WORKFLOW.test(String(source ?? ''))) || (cible === MASTER && source === DEV)
);

/**
 * Les runs du workflow qui ne sont pas finis, d'après la réponse de GET /repos/<dépôt>/actions/workflows/mise-a-jour.yml/runs (`workflow_runs`) :
 * [{ id, numero, statut, depuis, url, duree_min }], le plus ancien d'abord ; un run démarré il y a plus de PLAFOND_D_UN_RUN_MS est ignoré.
 */
export function runsEnCours(workflowRuns, { maintenantMs = Date.now() } = {}) {
  return (Array.isArray(workflowRuns) ? workflowRuns : [])
    .filter((r) => r && typeof r === 'object' && r.status !== 'completed')
    .map((r) => {
      const depuis = r.run_started_at ?? r.created_at ?? null;
      const ms = depuis ? Date.parse(depuis) : NaN;
      return { id: r.id ?? null, numero: r.run_number ?? null, statut: String(r.status ?? 'inconnu'), depuis, url: typeof r.html_url === 'string' ? r.html_url : null, ms, duree_min: Number.isFinite(ms) ? Math.max(0, Math.round((maintenantMs - ms) / 60_000)) : null };
    })
    .filter((r) => !Number.isFinite(r.ms) || maintenantMs - r.ms <= PLAFOND_D_UN_RUN_MS)
    .sort((a, b) => (a.ms || 0) - (b.ms || 0))
    .map(({ ms, ...r }) => r);
}

/**
 * La décision du job. `runs` : le résultat de runsEnCours (ignoré si éteint ou fusion du workflow : le job ne lit alors pas l'API, `runs` vaut null).
 * @returns {{ verdict: 'vert' | 'rouge', raison: 'eteint' | 'fusion_du_workflow' | 'aucun_run' | 'run_en_cours', runs: object[], message: string }}
 */
export function decider({ actif, source, cible, runs = null }) {
  if (!actif) return { verdict: 'vert', raison: 'eteint', runs: [], message: `Gel des fusions éteint (\`${INTERRUPTEUR}\` : \`gel_des_fusions\` n’est pas \`true\` sur \`${BRANCHE_DE_L_INTERRUPTEUR}\`) : aucune fusion n’est arrêtée.` };
  if (estUneFusionDuWorkflow({ source, cible })) {
    return { verdict: 'vert', raison: 'fusion_du_workflow', runs: [], message: `Gel des fusions allumé, mais cette PR (\`${source}\` → \`${cible}\`) est une fusion du workflow « ${NOM_DU_WORKFLOW} » lui-même : elle passe.` };
  }
  if (!runs?.length) return { verdict: 'vert', raison: 'aucun_run', runs: [], message: `Gel des fusions allumé : aucune mise à jour (« ${NOM_DU_WORKFLOW} ») n’est en cours, la fusion est libre.` };
  const r = runs[0];
  const depuis = r.depuis ? `depuis ${r.depuis}${r.duree_min !== null ? ` (il y a ${r.duree_min} min)` : ''}` : 'depuis une heure inconnue';
  const autres = runs.length > 1 ? ` (${runs.length - 1} autre(s) en attente derrière lui)` : '';
  return {
    verdict: 'rouge', raison: 'run_en_cours', runs,
    message: `Une mise à jour est en cours : le run${r.numero ? ` n° ${r.numero}` : ''} de « ${NOM_DU_WORKFLOW} »${r.url ? ` (${r.url})` : ''} est « ${r.statut} » ${depuis}${autres}. `
      + `Les fusions vers \`${DEV}\` et \`${MASTER}\` sont gelées tant qu’il tourne (\`${INTERRUPTEUR}\` allumé sur \`${BRANCHE_DE_L_INTERRUPTEUR}\`). `
      + 'Geste : relancer ce job (« Re-run ») quand la mise à jour est finie.',
  };
}

/** Le résumé Markdown du job (GITHUB_STEP_SUMMARY). */
export const resumeDeLaDecision = (d) => `### Gel des fusions\n\n${d.verdict === 'rouge' ? '**Refusé.** ' : ''}${d.message}\n`;
