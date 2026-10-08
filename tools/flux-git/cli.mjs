#!/usr/bin/env node
// Le bot du flux Git (voir docs/flux-git.md) : contrôles et versions, appelés par .github/workflows/garde-branches.yml et livraison.yml.
// Les règles elles-mêmes sont dans regles.mjs (pures, testées) ; ce fichier ne fait que lire et écrire le dépôt Git.
//
//   node tools/flux-git/cli.mjs verifier-creation --branche <nom> --sha <commit>
//       une branche qui vient d'être créée : nom permis et bon point de départ (code 1 sinon)
//   node tools/flux-git/cli.mjs verifier-pr --base <cible> --head <source> --sha <commit> [--depot-source <o/r> --depot <o/r>]
//       une PR : source permise pour la cible, bon point de départ, version non modifiée à la main (code 1 sinon)
//   node tools/flux-git/cli.mjs appliquer --base <cible> --head <source> [--pr <n>] [--texte-fichier <f>]... [--pousser]
//       après une fusion : incréments de version, refusion de master dans dev, étiquettes des installateurs à générer
//   node tools/flux-git/cli.mjs regenerer --branche master|dev [--pousser]
//       nouvelle étiquette pour régénérer l'installateur d'une branche sans changer sa version
//
// Options communes : --distant <nom> (défaut origin). Sans --pousser, rien ne quitte le dépôt local (essai à blanc).
// Résultat de appliquer/regenerer : JSON sur la sortie standard, et `livraisons=<json>` dans $GITHUB_OUTPUT s'il existe.
import { spawnSync } from 'node:child_process';
import { appendFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  DEV, FAMILLES, MASTER, demandeMajeure, etiquette, planifier, poserVersionJson, typeDeFusion, verifierCreation, verifierPR,
} from './regles.mjs';

/** Les fichiers qui portent la version (le pied de page du site lit client/package.json). */
export const FICHIERS_VERSION = ['client/package.json', 'client/package-lock.json'];
const PACKAGE = FICHIERS_VERSION[0];

class Refus extends Error {}

function git(args, { ok = [0], entree } = {}) {
  const r = spawnSync('git', args, { encoding: 'utf8', input: entree, maxBuffer: 64 * 1024 * 1024 });
  if (r.error) throw r.error;
  if (!ok.includes(r.status)) throw new Error(`git ${args.join(' ')} : ${(r.stderr || r.stdout).trim()}`);
  return { sortie: r.stdout.trim(), code: r.status };
}
const sortie = (args) => git(args).sortie;
const existe = (ref) => git(['rev-parse', '--verify', '--quiet', `${ref}^{commit}`], { ok: [0, 1] }).code === 0;
const estAncetre = (a, b) => git(['merge-base', '--is-ancestor', a, b], { ok: [0, 1] }).code === 0;
const commits = (args) => sortie(['rev-list', ...args]).split('\n').filter(Boolean);
const versionSur = (ref) => JSON.parse(sortie(['show', `${ref}:${PACKAGE}`])).version;

/** Branches distantes correspondant à un nom (« dev ») ou à un préfixe (« hotfix/ »). */
function branchesDistantes(distant, motif) {
  if (!motif.endsWith('/')) return existe(`${distant}/${motif}`) ? [`${distant}/${motif}`] : [];
  return sortie(['for-each-ref', '--format=%(refname:short)', `refs/remotes/${distant}/${motif}`]).split('\n').filter(Boolean);
}

/**
 * Point de départ d'une branche de travail : ses commits propres (absents de la branche dont elle doit partir et des branches `admises`)
 * ne doivent venir d'aucune branche « opposée » (voir FAMILLES dans regles.mjs). Une feature créée depuis master est indiscernable
 * d'une feature partie de dev qui aurait fusionné master : elle passe, sans conséquence (dev reçoit master de toute façon).
 */
function verifierOrigine(famille, sha, distant) {
  const { depuis, opposees, admises } = FAMILLES[famille];
  const base = `${distant}/${depuis}`;
  if (!existe(base)) return `la branche ${depuis} n'existe pas : une branche ${famille}/<nom> doit être créée depuis ${depuis}`;
  const exclus = [base, ...admises.flatMap((m) => branchesDistantes(distant, m))].map((r) => `^${r}`);
  const propres = commits([sha, ...exclus]);
  if (propres.length === 0) return null;
  for (const ref of opposees.flatMap((m) => branchesDistantes(distant, m))) {
    const hors = new Set(commits([sha, ...exclus, `^${ref}`]));
    const venus = propres.filter((c) => !hors.has(c));
    if (venus.length) {
      return `${famille}/<nom> doit partir de ${depuis}, or elle contient ${venus.length} commit(s) de ${ref.slice(distant.length + 1)} absent(s) de ${depuis} (par exemple ${venus[0].slice(0, 7)})`;
    }
  }
  return null;
}

function verifierCreationCmd({ branche, sha, distant }) {
  const r = verifierCreation(branche);
  if (!r.ok) throw new Refus(r.raison);
  if (r.famille === 'principale') return `${branche} : branche principale.`;
  const probleme = verifierOrigine(r.famille, sha, distant);
  if (probleme) throw new Refus(`${branche} : ${probleme}`);
  return `${branche} : créée depuis ${r.depuis}, conforme.`;
}

function verifierPRCmd({ base, head, sha, distant, depotSource, depot }) {
  const memeDepot = !depotSource || !depot || depotSource.toLowerCase() === depot.toLowerCase();
  const r = verifierPR({ base, head, memeDepot });
  if (!r.ok) throw new Refus(r.raison);
  if (!r.type) return `PR vers ${base} : aucune règle de branche.`;
  if (r.type === 'livraison') {
    if (!estAncetre(`${distant}/${MASTER}`, sha)) {
      throw new Refus(`master contient des commits absents de dev : refusionnez d'abord master dans dev (normalement fait par le bot après un hotfix ; sinon une feature/<nom> qui fusionne master)`);
    }
    return 'Livraison dev → master : conforme.';
  }
  const probleme = verifierOrigine(r.type, sha, distant);
  if (probleme) throw new Refus(probleme);
  const depart = sortie(['merge-base', `${distant}/${base}`, sha]);
  if (versionSur(depart) !== versionSur(sha)) {
    throw new Refus(`la version de ${PACKAGE} a été modifiée (${versionSur(depart)} → ${versionSur(sha)}) : elle est tenue par le bot, ne la changez pas dans une PR ${r.type}`);
  }
  return `PR ${head} → ${base} : conforme (${r.type}).`;
}

function poserVersion(version) {
  for (const f of FICHIERS_VERSION) {
    let texte;
    try { texte = readFileSync(f, 'utf8'); } catch { continue; }
    writeFileSync(f, poserVersionJson(texte, version));
    git(['add', f]);
  }
}

function committer(message) {
  git(['commit', '--quiet', '--no-verify', '-m', message]);
  return sortie(['rev-parse', 'HEAD']);
}

/** Un conflit dont chaque bloc n'oppose que des lignes « "version": "X.Y.Z" » (le bot les réécrit juste après). */
function conflitDeVersionSeulement(fichier) {
  const dossier = mkdtempSync(join(tmpdir(), 'flux-git-'));
  try {
    const etapes = {};
    for (const [n, nom] of [[1, 'base'], [2, 'nous'], [3, 'eux']]) {
      const r = git(['show', `:${n}:${fichier}`], { ok: [0, 128] });
      if (r.code !== 0) return null;
      etapes[nom] = join(dossier, nom);
      writeFileSync(etapes[nom], `${r.sortie}\n`);
    }
    const fusion = spawnSync('git', ['merge-file', '-p', etapes.nous, etapes.base, etapes.eux], { encoding: 'utf8' });
    const ligneVersion = /^\s*"version": "\d+\.\d+\.\d+",?$/;
    let dansConflit = false;
    for (const ligne of fusion.stdout.split('\n')) {
      if (ligne.startsWith('<<<<<<< ')) { dansConflit = true; continue; }
      if (ligne.startsWith('>>>>>>> ')) { dansConflit = false; continue; }
      if (ligne.startsWith('||||||| ')) continue;
      if (dansConflit && ligne !== '=======' && !ligneVersion.test(ligne)) return null;
    }
    // Résolution : notre côté (dev) pour ces blocs ; la version définitive est posée ensuite.
    return spawnSync('git', ['merge-file', '-p', '--ours', etapes.nous, etapes.base, etapes.eux], { encoding: 'utf8' }).stdout;
  } finally {
    rmSync(dossier, { recursive: true, force: true });
  }
}

/** Refusionne `source` (master) dans la branche courante (dev). Seuls les conflits sur les lignes de version se résolvent seuls. */
function synchroniser(source, message) {
  if (estAncetre(source, 'HEAD')) return 'déjà à jour';
  if (estAncetre('HEAD', source)) {
    git(['merge', '--quiet', '--ff-only', source]);
    return 'avance rapide';
  }
  const fusion = git(['merge', '--no-ff', '--no-commit', source], { ok: [0, 1] });
  if (fusion.code !== 0) {
    const enConflit = sortie(['diff', '--name-only', '--diff-filter=U']).split('\n').filter(Boolean);
    const resolus = enConflit.map((f) => [f, FICHIERS_VERSION.includes(f) ? conflitDeVersionSeulement(f) : null]);
    const restants = resolus.filter(([, texte]) => texte === null).map(([f]) => f);
    if (restants.length || enConflit.length === 0) {
      git(['merge', '--abort'], { ok: [0, 128] });
      throw new Refus(`la refusion de master dans dev est en conflit (${restants.join(', ') || 'conflit non identifié'}) : `
        + 'créez une feature/<nom> depuis dev, fusionnez-y master, résolvez, puis ouvrez la PR vers dev');
    }
    for (const [f, texte] of resolus) { writeFileSync(f, texte); git(['add', f]); }
  }
  committer(message);
  return 'fusion';
}

function etiquettesExistantes() {
  return sortie(['tag', '--list', 'v*']).split('\n').filter(Boolean);
}

function pousser(distant, refs) {
  git(['push', '--quiet', '--atomic', distant, ...refs]);
}

/** Après une fusion de PR : versions, refusion, étiquettes. Réessaie si quelqu'un a poussé entre-temps (la poussée est atomique). */
function appliquer({ base, head, pr, textes, distant, envoyer, tentatives = 5 }) {
  const type = typeDeFusion({ base, head });
  if (!type) throw new Refus(`fusion hors des règles (${head} → ${base}) : aucune version ni installateur. Seules feature/<nom> → dev, dev → master et hotfix/<nom> → master sont gérées.`);
  const majeure = type === 'livraison' && demandeMajeure(...textes);
  const ref = pr ? ` (PR #${pr})` : '';
  for (let essai = 1; essai <= tentatives; essai += 1) {
    git(['fetch', '--quiet', '--tags', '--force', distant, `+refs/heads/${MASTER}:refs/remotes/${distant}/${MASTER}`, `+refs/heads/${DEV}:refs/remotes/${distant}/${DEV}`]);
    const avant = { master: sortie(['rev-parse', `${distant}/${MASTER}`]), dev: sortie(['rev-parse', `${distant}/${DEV}`]) };
    const plan = planifier({ type, versionMaster: versionSur(avant.master), versionDev: versionSur(avant.dev), majeure });
    const apres = { ...avant };
    const journal = [];

    if (plan.master) {
      git(['checkout', '--quiet', '-B', MASTER, avant.master]);
      poserVersion(plan.master.version);
      apres.master = committer(`chore: version v${plan.master.version} (livraison dev → master${majeure ? ', majeure [V: X+1]' : ''})${ref}`);
      journal.push(`master : v${versionSur(avant.master)} → v${plan.master.version}`);
    }

    git(['checkout', '--quiet', '-B', DEV, avant.dev]);
    if (plan.dev.synchroniser) {
      const comment = synchroniser(apres.master, `Synchroniser master dans dev après ${type === 'hotfix' ? `le hotfix ${head}` : 'la livraison'}${ref}`);
      journal.push(`dev : master refusionnée (${comment})`);
    }
    if (versionSur('HEAD') !== plan.dev.version) {
      const ancienne = versionSur('HEAD');
      poserVersion(plan.dev.version);
      committer(`chore: version v${plan.dev.version} (${type === 'livraison' ? 'livraison' : `${type} ${head}`})${ref}`);
      journal.push(`dev : v${ancienne} → v${plan.dev.version}`);
    }
    apres.dev = sortie(['rev-parse', 'HEAD']);

    const existantes = etiquettesExistantes();
    const livraisons = plan.livrer.map((mode) => {
      const branche = mode === 'prod' ? MASTER : DEV;
      const version = versionSur(apres[branche]);
      const tag = etiquette({ mode, version, existantes, motif: mode === 'prod' && type === 'hotfix' ? 'hotfix' : 'rebuild' });
      existantes.push(tag);
      return { mode, branche, sha: apres[branche], version, tag, type };
    });

    const refs = [];
    if (apres.master !== avant.master) refs.push(`${apres.master}:refs/heads/${MASTER}`);
    if (apres.dev !== avant.dev) refs.push(`${apres.dev}:refs/heads/${DEV}`);
    for (const l of livraisons) refs.push(`${l.sha}:refs/tags/${l.tag}`);
    if (!envoyer) return { type, majeure, journal, livraisons, poussee: false };
    try {
      pousser(distant, refs);
      return { type, majeure, journal, livraisons, poussee: true };
    } catch (e) {
      if (essai === tentatives) throw e;
      console.error(`Poussée refusée (essai ${essai}/${tentatives}), nouvel essai : ${e.message}`);
    }
  }
  throw new Error('inaccessible');
}

function regenerer({ branche, distant, envoyer }) {
  if (branche !== MASTER && branche !== DEV) throw new Refus(`branche à régénérer : master ou dev (reçu « ${branche} »)`);
  git(['fetch', '--quiet', '--tags', '--force', distant, `+refs/heads/${branche}:refs/remotes/${distant}/${branche}`]);
  const sha = sortie(['rev-parse', `${distant}/${branche}`]);
  const mode = branche === MASTER ? 'prod' : 'test';
  const version = versionSur(sha);
  const tag = etiquette({ mode, version, existantes: etiquettesExistantes(), motif: 'rebuild' });
  if (envoyer) pousser(distant, [`${sha}:refs/tags/${tag}`]);
  return { type: 'regeneration', journal: [], livraisons: [{ mode, branche, sha, version, tag, type: 'regeneration' }], poussee: envoyer };
}

function options(argv) {
  const o = { textes: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--pousser') { o.envoyer = true; continue; }
    if (!a.startsWith('--') || i + 1 >= argv.length) throw new Refus(`argument inattendu « ${a} »`);
    const v = argv[(i += 1)];
    if (a === '--texte-fichier') o.textes.push(readFileSync(v, 'utf8'));
    else o[a.slice(2).replace(/-(\w)/g, (_, c) => c.toUpperCase())] = v;
  }
  o.distant ??= 'origin';
  return o;
}

function exiger(o, ...noms) {
  for (const n of noms) if (!o[n]) throw new Refus(`option --${n.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)} manquante`);
}

function principal(argv) {
  const [commande, ...reste] = argv;
  const o = options(reste); // avant le changement de dossier : --texte-fichier peut être relatif
  process.chdir(sortie(['rev-parse', '--show-toplevel'])); // les chemins de FICHIERS_VERSION et de git diff partent de la racine
  if (commande === 'verifier-creation') { exiger(o, 'branche', 'sha'); return verifierCreationCmd(o); }
  if (commande === 'verifier-pr') { exiger(o, 'base', 'head', 'sha'); return verifierPRCmd(o); }
  if (commande === 'appliquer') { exiger(o, 'base', 'head'); return appliquer(o); }
  if (commande === 'regenerer') { exiger(o, 'branche'); return regenerer(o); }
  throw new Refus('commande attendue : verifier-creation, verifier-pr, appliquer ou regenerer');
}

const annoter = (texte) => (process.env.GITHUB_ACTIONS ? `::error::${texte}` : `ERREUR : ${texte}`);
try {
  const r = principal(process.argv.slice(2));
  if (typeof r === 'string') {
    console.log(r);
  } else {
    console.log(JSON.stringify(r, null, 2));
    if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `livraisons=${JSON.stringify(r.livraisons)}\n`);
    if (process.env.GITHUB_STEP_SUMMARY) {
      const lignes = [`### ${r.type}${r.majeure ? ' (majeure)' : ''}`, '', ...r.journal.map((j) => `- ${j}`),
        ...r.livraisons.map((l) => `- installateur ${l.mode} : \`${l.tag}\` (${l.branche} ${l.sha.slice(0, 7)})`)];
      appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${lignes.join('\n')}\n`);
    }
  }
} catch (e) {
  console.error(annoter(e.message));
  process.exit(e instanceof Refus ? 1 : 3);
}
