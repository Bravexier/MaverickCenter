// Le contrôle du contenu écrit dans le dépôt (lot 8, garde-fou 12 ; docs/flux-git.md, « Contenu écrit à la main (lot 8) ») : job `controle-du-contenu-ecrit`
// de .github/workflows/ci.yml, sur chaque PR. Les règles sont dans scripts/controler-le-contenu-ecrit-lib.mjs ; ce fichier lit le dépôt (git).
//   node scripts/controler-le-contenu-ecrit.mjs --cible <branche visée : dev, master> --source <branche de la PR> [--sha HEAD] [--interrupteur origin/dev] [--racine <dépôt>] [--resume <fichier.md>]
// L'interrupteur (tools/flux-git/bascule-1.json) se lit dans `--interrupteur` (origin/dev par défaut), jamais dans la PR : éteint (ou absent), le contrôle passe
// vert sans rien lire d'autre. Sortie : 0 (éteint, ou rien de refusé), 1 (une règle refuse : la règle et ce qu'il faut faire), 2 (usage ou dépôt illisible).
import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { BRANCHE_DE_L_INTERRUPTEUR, controlerLeContenu, FICHIER_D_IDENTITE, INTERRUPTEUR, INTERRUPTEUR_BASCULE_2, lireLInterrupteur } from './controler-le-contenu-ecrit-lib.mjs';
import { lireLInterrupteur as lireLaBascule2 } from '../../tools/flux-git/bascule-2.mjs';

const RACINE_DU_DEPOT = fileURLToPath(new URL('../../', import.meta.url));
const SEP = '\x1f';
const FIN = '\x1e';

const git = (racine, args, { ok = [0] } = {}) => {
  try {
    return execFileSync('git', ['-C', racine, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 256 * 1024 * 1024 });
  } catch (e) {
    if (ok.includes(e.status)) return null;
    throw new Error(`git ${args.join(' ')} : ${String(e.stderr ?? e.message).trim().split('\n')[0]}`);
  }
};
const lignes = (t) => String(t ?? '').split('\n').filter(Boolean);

/** L'interrupteur lu dans `ref` (null si le fichier y manque : éteint). */
export function interrupteurDans(racine, ref) {
  if (git(racine, ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`], { ok: [1] }) === null) throw new Error(`${ref} introuvable : l’interrupteur ${INTERRUPTEUR} ne se lit pas (git fetch origin dev)`);
  return lireLInterrupteur(git(racine, ['show', `${ref}:${INTERRUPTEUR}`], { ok: [128] }));
}

/**
 * Lit la PR dans le dépôt et rend le contrôle : { actif, refus, fichiers, commits, migrations }. `cible` : dev ou master ; la base est `origin/<cible>`.
 * @param {{ racine?: string, cible: string, source: string, sha?: string, interrupteur?: string }} o
 */
export function controlerLaPR({ racine = RACINE_DU_DEPOT, cible, source, sha = 'HEAD', interrupteur = BRANCHE_DE_L_INTERRUPTEUR }) {
  const actif = interrupteurDans(racine, interrupteur);
  // l'interrupteur de la bascule 2 (data/paquet.json, lot 11 PR 4), lu au même endroit ; éteint ou absent : rien de ce qui le concerne n'existe
  const bascule2 = lireLaBascule2(git(racine, ['show', `${interrupteur}:${INTERRUPTEUR_BASCULE_2}`], { ok: [128] }));
  if ((!actif && !bascule2) || !['dev', 'master'].includes(cible)) return { actif, refus: [], fichiers: [], commits: [], migrations: [] };
  const base = git(racine, ['merge-base', `origin/${cible}`, sha]).trim();
  const fichiers = lignes(git(racine, ['diff', '--name-only', '--no-renames', base, sha]));
  const commits = [];
  if (fichiers.some((f) => f.startsWith('data/rows/')) || (bascule2 && fichiers.includes(FICHIER_D_IDENTITE))) {
    const brut = git(racine, ['log', `--format=%H${SEP}%an${SEP}%ae${SEP}%cn${SEP}%ce${SEP}%B${FIN}`, `${base}..${sha}`, '--', 'data/rows/', ...(bascule2 ? [FICHIER_D_IDENTITE] : [])]);
    for (const bloc of brut.split(FIN).map((b) => b.replace(/^\n/, '')).filter(Boolean)) {
      const [h, auteur, courriel, commiteur, courrielCommiteur, message] = bloc.split(SEP);
      // les fichiers du commit, comparés à son premier parent (une fusion porte alors tout ce qu'elle apporte : refusée si elle apporte data/rows/)
      const fichiersDuCommit = lignes(git(racine, ['diff', '--name-only', '--no-renames', `${h}^1`, h]));
      commits.push({ sha: h, auteur, courriel, commiteur, courrielCommiteur, message, fichiers: fichiersDuCommit });
    }
  }
  const ajoutees = lignes(git(racine, ['diff', '--name-only', '--no-renames', '--diff-filter=A', base, sha, '--', 'data/migrations/'])).filter((f) => f.endsWith('.sql'));
  const migrations = new Map(ajoutees.map((f) => [f.slice('data/migrations/'.length), git(racine, ['show', `${sha}:${f}`])]));
  const r = controlerLeContenu({ actif, bascule2, cible, source, fichiers, commits, migrations });
  return { ...r, fichiers, commits: commits.map((c) => c.sha), migrations: [...migrations.keys()] };
}

/** Le résumé Markdown ($GITHUB_STEP_SUMMARY) : jamais un contenu, seulement des chemins, des commits et les règles. */
export function resumeDuControle(r) {
  if (!r.actif && !r.refus.length) return `### Contenu écrit à la main\n\nContrôle éteint (\`${INTERRUPTEUR}\` : \`actif\` n’est pas \`true\` sur \`${BRANCHE_DE_L_INTERRUPTEUR}\`) : rien n’est refusé.\n`;
  if (!r.refus.length) return `### Contenu écrit à la main\n\nContrôle allumé : rien à refuser (${r.fichiers.length} fichier(s) changé(s)).\n`;
  return `### Contenu écrit à la main\n\nContrôle allumé : **${r.refus.length} refus**.\n\n${r.refus.map((x) => `- \`${x.regle}\` : ${x.message}`).join('\n')}\n`;
}

function main(args) {
  const option = (nom, defaut) => (args.includes(nom) ? args[args.indexOf(nom) + 1] : defaut);
  const cible = option('--cible', null);
  const source = option('--source', null);
  // une autre branche visée (le flux Git n'en admet pas : regles-de-branches la refuse) n'est concernée par aucune règle d'ici
  if (!cible || !source) {
    console.error('Usage : node scripts/controler-le-contenu-ecrit.mjs --cible dev|master --source <branche> [--sha HEAD] [--interrupteur origin/dev] [--racine <dépôt>] [--resume <fichier.md>]');
    return 2;
  }
  try {
    const r = controlerLaPR({ racine: resolve(option('--racine', RACINE_DU_DEPOT)), cible, source, sha: option('--sha', 'HEAD'), interrupteur: option('--interrupteur', BRANCHE_DE_L_INTERRUPTEUR) });
    const texte = resumeDuControle(r);
    process.stdout.write(texte);
    const resume = option('--resume', null);
    if (resume) appendFileSync(resume, `${texte}\n`);
    for (const x of r.refus) console.error(`REFUS [${x.regle}] : ${x.message}`);
    return r.refus.length ? 1 : 0;
  } catch (e) {
    console.error(`contrôle du contenu impossible : ${e?.message ?? e}`);
    return 2;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = main(process.argv.slice(2));
