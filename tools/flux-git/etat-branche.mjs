#!/usr/bin/env node
// État de la branche courante, pour la publication (tech-publication, leader-technique ; docs/flux-git.md, skill resoudre-un-conflit). LECTURE
// SEULE : ne lance que des commandes Git qui lisent (pas de fetch : faire `git fetch --prune origin` avant). Règles pures : etat-regles.mjs ;
// recouvrement : client/scripts/tests-cibles-lib.mjs (celui de `npm run test:cible -- --apres-rebase`).
//
//   node tools/flux-git/etat-branche.mjs [--base <réf>] [--distant <nom>] [--json]
//
// Affiche : branche et base (origin/dev, origin/master pour une hotfix/…) ; commits en avance et en retard ; commits de origin/<branche> absents
// en local ; rebase nécessaire (git merge-base --is-ancestor <base> HEAD) ; branche de refusion (une fusion qui doit rester : ne pas rebaser) ;
// opération en cours et conflits (git diff --name-only --diff-filter=U), chacun classé (mécanique, version/verrou, dépendances, schéma,
// migration, fichier d'outil, sens) ; migrations dont la base a pris le numéro ; le recouvrement (prévu si le rebase reste à faire, sinon celui
// du dernier rebase). Code 0, ou 2 si l'état ne peut pas être lu.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { apresRebase, baseDeLaBranche, brancheCourante, fichiersDuLot, recouvrement } from '../../client/scripts/tests-cibles-lib.mjs';
import { brancheDeRefusion, classerConflit, conseilDeRebase, etatDeLaDistante, migrationsARenumeroter } from './etat-regles.mjs';

function options(argv) {
  const o = { base: null, distant: 'origin', json: false };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--base') o.base = argv[++i];
    else if (argv[i] === '--distant') o.distant = argv[++i];
    else if (argv[i] === '--json') o.json = true;
    else throw new Error(`option inconnue : ${argv[i]}`);
  }
  return o;
}

/** Git lancé dans `cwd` (la racine du dépôt : les chemins `data/migrations` et les sorties de ls-tree en dépendent). */
const gitDans = (cwd) => (args) => {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return { code: r.status ?? 1, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
};
const lignes = (s) => (s ?? '').split('\n').map((l) => l.trim()).filter(Boolean);

/** L'état, en objet (ce que --json affiche), du dépôt qui contient `depuis` (par défaut le dossier courant). */
export function lireEtat({ base: baseDonnee = null, distant = 'origin', depuis = process.cwd() } = {}) {
  const racine = gitDans(depuis)(['rev-parse', '--show-toplevel']).stdout.trim();
  if (!racine) throw new Error('pas dans un dépôt Git');
  const git = gitDans(racine);
  const sortie = (args) => { const r = git(args); return r.code === 0 ? r.stdout.trim() : null; };
  const existeRef = (ref) => git(['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]).code === 0;
  const ancetre = (a, b) => git(['merge-base', '--is-ancestor', a, b]).code === 0;
  const gitDir = sortie(['rev-parse', '--absolute-git-dir']);
  const enCours = existsSync(join(gitDir, 'rebase-merge')) || existsSync(join(gitDir, 'rebase-apply')) ? 'rebase'
    : existsSync(join(gitDir, 'MERGE_HEAD')) ? 'fusion'
      : existsSync(join(gitDir, 'CHERRY_PICK_HEAD')) ? 'cherry-pick' : null;
  const branche = brancheCourante({ git });
  const base = baseDonnee ?? baseDeLaBranche(branche);
  if (!existeRef(base)) throw new Error(`base ${base} introuvable (git fetch --prune ${distant}, ou --base <réf>)`);

  const [retard, avance] = (sortie(['rev-list', '--left-right', '--count', `${base}...HEAD`]) ?? '0 0').split(/\s+/).map(Number);
  const refDistante = branche ? `${distant}/${branche}` : null;
  let distante = { ref: refDistante, absente: true };
  if (refDistante && existeRef(refDistante)) {
    // Commits de la distante absents de HEAD ; --cherry-mark marque « = » ceux qu'un rebase a rejoués tels quels (même patch en local)…
    const distants = lignes(sortie(['log', '--format=%m %H %s', '--right-only', '--cherry-mark', `HEAD...${refDistante}`]))
      .map((l) => ({ equivalent: l[0] === '=', sha: l.slice(2, 42), sujet: l.slice(43) }));
    // … dont ceux que la branche locale a déjà portés (son reflog) : remplacés par un rebase, pas à reprendre.
    const pointes = [...new Set(lignes(sortie(['reflog', 'show', '--format=%H', `refs/heads/${branche}`])))].slice(0, 500);
    const connus = new Set(pointes.length ? lignes(sortie(['rev-list', ...pointes, '--not', base])) : []);
    distante = {
      ref: refDistante,
      ...etatDeLaDistante({ distants, connus, nonPousses: Number(sortie(['rev-list', '--count', `${refDistante}..HEAD`]) ?? 0), ref: refDistante }),
    };
  }

  const master = existeRef(`${distant}/master`) ? `${distant}/master` : null;
  const fusions = lignes(sortie(['rev-list', '--merges', `${base}..HEAD`])).map((sha) => {
    const parents = (sortie(['rev-list', '--parents', '-n', '1', sha]) ?? '').split(/\s+/).slice(2);
    return { sha, apporteMaster: !!master && parents.some((p) => ancetre(p, master)) };
  });
  const refusion = brancheDeRefusion(fusions);
  const aJour = ancetre(base, 'HEAD');
  const rebase = conseilDeRebase({ aJour, refusion: refusion.refusion });

  const conflits = lignes(sortie(['diff', '--name-only', '--diff-filter=U'])).map((chemin) => {
    const version = (n) => { const r = git(['show', `:${n}:${chemin}`]); return r.code === 0 ? r.stdout : null; };
    return { chemin, ...classerConflit({ chemin, base: version(1), nous: version(2), eux: version(3) }) };
  });

  const migrations = migrationsARenumeroter({
    ajoutees: lignes(sortie(['diff', '--name-only', '--diff-filter=A', `${base}...HEAD`, '--', 'data/migrations'])),
    dansLaBase: lignes(sortie(['ls-tree', '-r', '--name-only', base, '--', 'data/migrations'])),
  });

  let recouvre;
  if (!aJour) {
    const depart = sortie(['merge-base', 'HEAD', base]);
    const arrivees = lignes(sortie(['diff', '--name-only', depart, base]));
    const lot = fichiersDuLot(git, base);
    recouvre = { genre: 'prévu (rebase à faire)', arrivees: arrivees.length, lot: lot.length, ...recouvrement({ arrivees, lot }) };
  } else if (enCours === 'rebase') {
    recouvre = { genre: 'à calculer une fois le rebase fini (npm run test:cible -- --apres-rebase)', fichiers: [] };
  } else if (existeRef('ORIG_HEAD')) {
    const r = apresRebase({ git, base });
    recouvre = r.avertissement
      ? { genre: 'aucun rebase récent', fichiers: [], avertissement: r.avertissement }
      : { genre: 'du dernier rebase', arrivees: r.arrivees.length, lot: r.lot.length, fichiers: r.fichiers, communs: r.communs, resolus: [], avertissement: r.avertissement };
  } else {
    recouvre = { genre: 'aucun rebase connu (pas d\'ORIG_HEAD)', fichiers: [] };
  }
  return { branche, base, enCours, avance, retard, distante, fusions: fusions.length, refusion, rebase, conflits, migrations, recouvrement: recouvre };
}

function afficher(e) {
  const l = [];
  l.push(`Branche : ${e.branche ?? '(HEAD détachée)'}   base : ${e.base}   (sans fetch : git fetch --prune origin avant)`);
  l.push(`Commits : ${e.avance} en avance, ${e.retard} en retard sur ${e.base}`);
  if (e.distante.absente) l.push(`Distante : ${e.distante.ref ?? '—'} absente (jamais poussée)`);
  else {
    const d = e.distante;
    l.push(`Distante : ${d.ref} — ${d.aReprendre.length} commit(s) à reprendre, ${d.remplaces.length} remplacé(s) par un rebase, ${d.nonPousses} non poussé(s)`);
    for (const c of d.aReprendre) l.push(`  ${c.sha.slice(0, 10)} ${c.sujet}   (à reprendre d'abord : ${c.commande})`);
    l.push(`  ${d.conseil}`);
  }
  l.push(`Refusion : ${e.refusion.refusion ? 'oui' : 'non'} — ${e.refusion.raison}`);
  l.push(`Rebase nécessaire : ${e.rebase.necessaire ? 'oui' : 'non'} — ${e.rebase.conseil}`);
  l.push(`Opération en cours : ${e.enCours ?? 'aucune'}`);
  if (e.conflits.length) {
    l.push(`Conflits (${e.conflits.length}) :`);
    for (const c of e.conflits) l.push(`  ${c.chemin} — ${c.nature} (${c.qui}) : ${c.comment}`);
  } else l.push('Conflits : aucun');
  if (e.migrations.length) {
    l.push('Migrations à renuméroter (la base a pris le numéro) — tech-db :');
    for (const m of e.migrations) l.push(`  ${m.chemin} — ${m.numero} déjà pris par ${m.prisPar.join(', ')}`);
  }
  const r = e.recouvrement;
  l.push(`Recouvrement ${r.genre} : ${r.fichiers.length} fichier(s)${r.arrivees !== undefined ? ` (base : ${r.arrivees}, lot : ${r.lot})` : ''}`);
  for (const f of r.fichiers) l.push(`  ${f}`);
  if (r.avertissement) l.push(`  Attention : ${r.avertissement}`);
  if (r.fichiers.length || r.genre.startsWith('du dernier')) l.push('  Tests : npm run test:cible -- --apres-rebase (dans client/, une fois le rebase fini)');
  return l.join('\n');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const o = options(process.argv.slice(2));
    const etat = lireEtat(o);
    console.log(o.json ? JSON.stringify(etat, null, 2) : afficher(etat));
  } catch (e) {
    console.error(`etat-branche : ${e.message}`);
    process.exitCode = 2;
  }
}
