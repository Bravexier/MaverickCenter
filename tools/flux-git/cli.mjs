#!/usr/bin/env node
// Le bot du flux Git (voir docs/flux-git.md) : contrôles et versions, appelés par .github/workflows/garde-branches.yml et livraison.yml.
// Les règles elles-mêmes sont dans regles.mjs (pures, testées) ; ce fichier ne fait que lire et écrire le dépôt Git.
//
//   node tools/flux-git/cli.mjs verifier-creation --branche <nom> --sha <commit>
//       une branche qui vient d'être créée : nom permis et bon point de départ (code 1 sinon)
//   node tools/flux-git/cli.mjs verifier-pr --base <cible> --head <source> --sha <commit> [--depot-source <o/r> --depot <o/r>]
//       une PR : source permise pour la cible, bon point de départ, version non modifiée à la main (code 1 sinon)
//   node tools/flux-git/cli.mjs appliquer --base <cible> --head <source> [--pr <n>] [--texte-fichier <f>]... [--pousser]
//       après une fusion : incréments de version, refusion de master dans dev, étiquette de chaque nouvelle version (VX.Y.Z sur dev,
//       VX.Y sur master), puis ce qu'il faut publier (regles.mjs, livrableDe) : avant la 0.2.0 le site (branche « site », depuis dev),
//       à partir de la 0.2.0 les installateurs (étiquettes posées ici)
//   node tools/flux-git/cli.mjs balayer [--pousser]
//       toutes les branches du dépôt, depuis la branche par défaut (une branche créée depuis un vieux commit échappe à la garde de
//       création, lue dans ce commit) : nom interdit et déjà fusionnée → supprimée ; nom interdit avec du travail non fusionné, ou
//       feature/hotfix au mauvais point de départ → signalée (code 10), jamais supprimée
//   node tools/flux-git/cli.mjs supprimer-fusionnee --branche feature/<nom>|hotfix/<nom> --sha <commit fusionné> [--pousser]
//       après la fusion : supprime la branche sur GitHub seulement si elle pointe encore sur le commit fusionné (bail atomique) ;
//       si elle a reçu des commits depuis, elle est gardée (avertissement)
//   node tools/flux-git/cli.mjs regenerer --branche master|dev [--pousser]
//       republier une branche sans changer sa version (nouvelle étiquette d'installateur, ou le site avant la 0.2.0)
//
// Options communes : --distant <nom> (défaut origin). Sans --pousser, rien ne quitte le dépôt local (essai à blanc).
// Résultat de appliquer/regenerer : JSON sur la sortie standard, et dans $GITHUB_OUTPUT s'il existe :
//   installateurs=<json>   les installateurs à fabriquer ([] avant la 0.2.0)
//   site=<commit>          le commit de dev à publier sur la branche « site » (vide à partir de la 0.2.0)
//   a_supprimer=<branche>  la feature ou la hotfix fusionnée, à supprimer sur GitHub une fois tout fait (vide sinon)
import { spawnSync } from 'node:child_process';
import { appendFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  DEV, FAMILLES, MASTER, brancheASupprimer, familleDe, demandeMajeure, etiquette, etiquetteDeVersion, livrableDe, modeDeEtiquette, planifier, poserVersionJson,
  typeDeFusion, verifierCreation, verifierPR,
} from './regles.mjs';

/** Les fichiers qui portent la version (le pied de page du site lit client/package.json). */
const FICHIERS_VERSION = ['client/package.json', 'client/package-lock.json'];
const PACKAGE = FICHIERS_VERSION[0];

class Refus extends Error {}
/** Code de sortie d'une règle enfreinte : distinct de 1 (code d'un plantage de Node) ; la garde ne supprime une branche que sur ce code. */
export const CODE_REFUS = 10;

function git(args, { ok = [0], entree } = {}) {
  const r = spawnSync('git', args, { encoding: 'utf8', input: entree, maxBuffer: 64 * 1024 * 1024 });
  if (r.error) throw r.error;
  if (!ok.includes(r.status)) throw new Error(`git ${args.join(' ')} : ${(r.stderr || r.stdout).trim()}`);
  return { sortie: r.stdout.trim(), code: r.status, erreur: (r.stderr || '').trim() };
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
  // Tant que master et dev n'existent pas toutes les deux, le flux n'est pas en place : rien n'est vérifié ni supprimé (mise en place du dépôt).
  const absent = fluxAbsent(distant);
  if (absent) return `${branche} : ${absent}, aucune vérification.`;
  const r = verifierCreation(branche);
  if (!r.ok) throw new Refus(r.raison);
  if (r.famille === 'principale' || r.famille === 'publication') return `${branche} : branche ${r.famille}.`;
  const probleme = verifierOrigine(r.famille, sha, distant);
  if (probleme) throw new Refus(`${branche} : ${probleme}`);
  return `${branche} : créée depuis ${r.depuis}, conforme.`;
}

/** Le flux est en place quand master et dev existent toutes les deux ; avant, ni la garde ni le balayage n'agissent. */
function fluxAbsent(distant) {
  const absentes = [MASTER, DEV].filter((b) => !existe(`${distant}/${b}`));
  return absentes.length ? `flux Git pas encore en place (${absentes.join(' et ')} absente${absentes.length > 1 ? 's' : ''})` : null;
}

function balayer({ distant, envoyer }) {
  git(['fetch', '--quiet', '--prune', distant]);
  const absent = fluxAbsent(distant);
  if (absent) return { type: 'balayage', resultats: [], message: `${absent} : aucun balayage.` };
  // Noms complets (refs/remotes/<distant>/…) : « %(refname:short) » raccourcit « x/HEAD » en « x », et un nom court peut désigner une étiquette.
  const prefixe = `refs/remotes/${distant}/`;
  const refs = sortie(['for-each-ref', '--format=%(refname)%09%(objectname)%09%(symref)', prefixe]).split('\n').filter(Boolean)
    .map((l) => l.split('\t')).filter(([, , symref]) => !symref)
    .map(([ref, sha]) => ({ ref, sha, branche: ref.slice(prefixe.length) }));
  const resultats = [];
  for (const { ref, sha, branche } of refs) {
    const famille = familleDe(branche);
    if (famille === 'principale' || famille === 'publication') continue;
    if (!famille) {
      const fusionnee = estAncetre(ref, `${prefixe}${DEV}`) || estAncetre(ref, `${prefixe}${MASTER}`);
      resultats.push(fusionnee
        ? { branche, sha, action: 'supprimee', raison: 'nom interdit, et tout son contenu est déjà dans dev ou master' }
        : { branche, sha, action: 'signalee', raison: 'nom interdit, mais elle contient du travail absent de dev et de master : le reprendre dans une feature/<nom> (ou la supprimer à la main)' });
      continue;
    }
    const probleme = verifierOrigine(famille, sha, distant);
    if (probleme) resultats.push({ branche, sha, action: 'signalee', raison: probleme });
  }
  // Une suppression par branche, avec bail : refusée si la branche a bougé depuis la lecture ; un refus n'empêche pas les autres.
  for (const r of resultats.filter((x) => x.action === 'supprimee')) {
    if (!envoyer) continue;
    const p = git(['push', '--quiet', `--force-with-lease=refs/heads/${r.branche}:${r.sha}`, distant, `:refs/heads/${r.branche}`], { ok: [0, 1, 128] });
    if (p.code !== 0) Object.assign(r, { action: 'signalee', raison: `suppression refusée (${(p.erreur || p.sortie).split('\n').pop()}) : elle a peut-être bougé entre-temps` });
  }
  return { type: 'balayage', resultats, poussee: Boolean(envoyer) };
}

/** Après une fusion : la branche fusionnée est supprimée seulement si elle pointe encore sur le commit fusionné. */
function supprimerFusionnee({ branche, sha, distant, envoyer }) {
  const famille = familleDe(branche);
  if (famille !== 'feature' && famille !== 'hotfix') throw new Refus(`refus de supprimer « ${branche} » : seules feature/<nom> et hotfix/<nom> le sont`);
  if (!/^[0-9a-f]{40}$/.test(sha)) throw new Refus(`commit fusionné invalide « ${sha} »`);
  // Comparaison exacte du nom (ls-remote filtre par fin de nom) ; aucun nom n'est mis dans une adresse.
  const actuel = sortie(['ls-remote', '--heads', distant]).split('\n').map((l) => l.split('\t')).find(([, ref]) => ref === `refs/heads/${branche}`)?.[0];
  if (!actuel) return `${branche} : déjà supprimée.`;
  if (actuel !== sha) return avertir(`${branche} a reçu des commits après la fusion (${actuel.slice(0, 7)} au lieu de ${sha.slice(0, 7)}) : elle est gardée, à supprimer à la main une fois son travail repris.`);
  if (!envoyer) return `${branche} : à supprimer (essai à blanc).`;
  const p = git(['push', '--quiet', `--force-with-lease=refs/heads/${branche}:${sha}`, distant, `:refs/heads/${branche}`], { ok: [0, 1, 128] });
  if (p.code !== 0) return avertir(`${branche} : suppression refusée (${(p.erreur || p.sortie).split('\n').pop()}), elle a sans doute bougé : gardée.`);
  return `${branche} : supprimée (elle est fusionnée).`;
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
        + 'créez une feature/<nom> depuis dev, fusionnez-y master, résolvez, puis ouvrez la PR vers dev (fusion par « Create a merge commit »)');
    }
    for (const [f, texte] of resolus) { writeFileSync(f, texte); git(['add', f]); }
  }
  committer(message);
  return 'fusion';
}

function etiquettesExistantes() {
  return sortie(['tag', '--list']).split('\n').filter(Boolean);
}

/** Commit d'une étiquette déjà posée (lue après le fetch des étiquettes), ou '' si elle n'existe pas. */
const commitDeEtiquette = (tag) => git(['rev-parse', '--verify', '--quiet', `refs/tags/${tag}^{commit}`], { ok: [0, 1] }).sortie;

function pousser(distant, refs) {
  git(['push', '--quiet', '--atomic', distant, ...refs]);
}

/** Pause entre deux essais (synchrone : le bot est un script court). */
function attendre(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/** Commit du bot qui porte déjà cette PR (une relance du workflow ne doit pas incrémenter une seconde fois), ou undefined. */
function dejaTraitee(pr, distant) {
  const sujets = sortie(['log', '--format=%s', '-n', '2000', `${distant}/${MASTER}`, `${distant}/${DEV}`]).split('\n');
  return sujets.find((s) => s.endsWith(`(PR #${pr})`) && (s.startsWith('chore: version v') || s.startsWith('Synchroniser master dans dev')));
}

const indiceJeton = (message) => (/workflow/i.test(message)
  ? ' (le jeton du bot n\'a pas la permission « Workflows » : voir BOT_TOKEN dans docs/flux-git.md ; sinon, refusion à la main par une feature/<nom>)'
  : '');

/**
 * Après une fusion de PR : versions, refusion, étiquettes. Pas de file d'attente côté GitHub (elle annulerait des fusions) : des passages
 * simultanés se départagent ici, la poussée atomique de l'un fait échouer celle de l'autre, qui relit les branches et recommence.
 * Hotfix : l'installateur de production (master n'a pas bougé) est posé d'abord ; si la refusion dans dev échoue ensuite, il reste livré
 * et le résultat porte `erreur` (le workflow publie ce qui est prêt, puis échoue en le signalant).
 */
function appliquer({ base, head, pr, textes, distant, envoyer, tentatives = 10 }) {
  const type = typeDeFusion({ base, head });
  if (!type) throw new Refus(`fusion hors des règles (${head} → ${base}) : aucune version ni publication. Seules feature/<nom> → dev, dev → master et hotfix/<nom> → master sont gérées.`);
  const majeure = type === 'livraison' && demandeMajeure(...textes);
  const ref = pr ? ` (PR #${pr})` : '';
  let prodDuHotfix; // undefined : pas encore traité ; null : rien à livrer (avant la 0.2.0) ; sinon la livraison de production déjà étiquetée
  for (let essai = 1; essai <= tentatives; essai += 1) {
    const reessayer = (e) => {
      if (essai === tentatives) throw e;
      console.error(`Poussée refusée (essai ${essai}/${tentatives}), nouvel essai : ${e.message}`);
      attendre(1000 + Math.floor(Math.random() * 4000));
    };
    git(['fetch', '--quiet', '--tags', '--force', distant, `+refs/heads/${MASTER}:refs/remotes/${distant}/${MASTER}`, `+refs/heads/${DEV}:refs/remotes/${distant}/${DEV}`]);
    if (pr) {
      const fait = dejaTraitee(pr, distant);
      if (fait) throw new Refus(`la PR #${pr} a déjà été traitée par le bot (« ${fait} ») : rien n'est refait. Pour republier une branche : Actions → Version et livraison → Run workflow.`);
    }
    const avant = { master: sortie(['rev-parse', `${distant}/${MASTER}`]), dev: sortie(['rev-parse', `${distant}/${DEV}`]) };
    const plan = planifier({ type, versionMaster: versionSur(avant.master), versionDev: versionSur(avant.dev), majeure });
    const apres = { ...avant };
    const journal = [];
    const existantes = etiquettesExistantes();

    if (type === 'hotfix' && prodDuHotfix === undefined) {
      const version = versionSur(avant.master);
      const dejaEtiquete = sortie(['tag', '--points-at', avant.master]).split('\n').find((t) => t && modeDeEtiquette(t) === 'prod');
      if (dejaEtiquete) {
        prodDuHotfix = null; // relance après une refusion en échec : l'installateur de ce commit existe déjà
        journal.push(`production : ${dejaEtiquete} existe déjà pour ce commit`);
      } else if (livrableDe(MASTER, version) === 'prod') {
        const tag = etiquette({ mode: 'prod', version, existantes, motif: 'hotfix' });
        try {
          if (envoyer) pousser(distant, [`${avant.master}:refs/tags/${tag}`]);
        } catch (e) {
          reessayer(e);
          continue;
        }
        existantes.push(tag);
        prodDuHotfix = { mode: 'prod', branche: MASTER, sha: avant.master, version, tag, type };
      } else {
        prodDuHotfix = null;
      }
    }
    const partiel = (message) => ({ type, majeure, journal, livraisons: prodDuHotfix ? [prodDuHotfix] : [], etiquettes: [], poussee: Boolean(envoyer), erreur: message });

    if (plan.master) {
      git(['checkout', '--quiet', '-B', MASTER, avant.master]);
      poserVersion(plan.master.version);
      apres.master = committer(`chore: version v${plan.master.version} (livraison dev → master${majeure ? ', majeure [V: X+1]' : ''})${ref}`);
      journal.push(`master : v${versionSur(avant.master)} → v${plan.master.version}`);
    }

    git(['checkout', '--quiet', '-B', DEV, avant.dev]);
    if (plan.dev.synchroniser) {
      try {
        const comment = synchroniser(apres.master, `Synchroniser master dans dev après ${type === 'hotfix' ? `le hotfix ${head}` : 'la livraison'}${ref}`);
        journal.push(`dev : master refusionnée (${comment})`);
      } catch (e) {
        if (e instanceof Refus && type === 'hotfix') return partiel(e.message);
        throw e;
      }
    }
    if (versionSur('HEAD') !== plan.dev.version) {
      const ancienne = versionSur('HEAD');
      poserVersion(plan.dev.version);
      committer(`chore: version v${plan.dev.version} (${type === 'livraison' ? 'livraison' : `${type} ${head}`})${ref}`);
      journal.push(`dev : v${ancienne} → v${plan.dev.version}`);
    }
    apres.dev = sortie(['rev-parse', 'HEAD']);

    const livraisons = plan.livrer.filter((mode) => !(type === 'hotfix' && mode === 'prod')).map((mode) => {
      const branche = mode === 'prod' ? MASTER : DEV;
      const version = versionSur(apres[branche]);
      if (mode === 'site') return { mode, branche, sha: apres[branche], version, tag: null, type };
      const tag = etiquette({ mode, version, existantes, motif: 'rebuild' });
      existantes.push(tag);
      return { mode, branche, sha: apres[branche], version, tag, type };
    });
    if (prodDuHotfix) livraisons.unshift(prodDuHotfix);

    // Étiquettes de version (demande du propriétaire) : le commit qui porte la nouvelle version de chaque branche (VX.Y.Z sur dev,
    // VX.Y sur master). Une étiquette déjà posée ailleurs n'est pas déplacée : signalée, elle n'empêche ni la version ni la publication.
    const etiquettes = [];
    for (const [branche, nouvelle] of [[MASTER, plan.master?.version], [DEV, plan.dev.version]]) {
      if (!nouvelle) continue;
      const tag = etiquetteDeVersion(branche, nouvelle);
      const deja = commitDeEtiquette(tag);
      if (deja && deja !== apres[branche]) journal.push(`${branche} : étiquette ${tag} déjà posée sur ${deja.slice(0, 7)}, laissée telle quelle`);
      else if (!deja) etiquettes.push({ branche, version: nouvelle, tag, sha: apres[branche] });
    }

    const refs = [];
    if (apres.master !== avant.master) refs.push(`${apres.master}:refs/heads/${MASTER}`);
    if (apres.dev !== avant.dev) refs.push(`${apres.dev}:refs/heads/${DEV}`);
    // Une étiquette par nom : un installateur porte l'étiquette de version de sa branche (VX.Y pour la production d'une livraison,
    // VX.Y.Z pour le serveur de test : même nom, même commit).
    const aPoser = new Map();
    for (const { tag, sha } of [...livraisons.filter((l) => l.tag && l !== prodDuHotfix), ...etiquettes]) {
      if (aPoser.has(tag) && aPoser.get(tag) !== sha) throw new Error(`étiquette ${tag} demandée sur deux commits (${aPoser.get(tag).slice(0, 7)}, ${sha.slice(0, 7)})`);
      aPoser.set(tag, sha);
    }
    for (const [tag, sha] of aPoser) refs.push(`${sha}:refs/tags/${tag}`);
    const aSupprimer = brancheASupprimer({ base, head });
    if (!envoyer) return { type, majeure, journal, livraisons, etiquettes, poussee: false, aSupprimer };
    try {
      pousser(distant, refs);
      return { type, majeure, journal, livraisons, etiquettes, poussee: true, aSupprimer };
    } catch (e) {
      if (essai === tentatives && type === 'hotfix') return partiel(`refusion de master dans dev impossible à pousser : ${e.message}${indiceJeton(e.message)}`);
      reessayer(new Error(`${e.message}${indiceJeton(e.message)}`));
    }
  }
  throw new Error('inaccessible');
}

function regenerer({ branche, distant, envoyer }) {
  if (branche !== MASTER && branche !== DEV) throw new Refus(`branche à régénérer : master ou dev (reçu « ${branche} »)`);
  git(['fetch', '--quiet', '--tags', '--force', distant, `+refs/heads/${branche}:refs/remotes/${distant}/${branche}`]);
  const sha = sortie(['rev-parse', `${distant}/${branche}`]);
  const version = versionSur(sha);
  const mode = livrableDe(branche, version);
  if (!mode) throw new Refus(`master est en v${version} : avant la 0.2.0, master n'a pas de serveur, rien à publier (le site suit dev)`);
  const tag = mode === 'site' ? null : etiquette({ mode, version, existantes: etiquettesExistantes(), motif: 'rebuild' });
  if (envoyer && tag) pousser(distant, [`${sha}:refs/tags/${tag}`]);
  return { type: 'regeneration', journal: [], livraisons: [{ mode, branche, sha, version, tag, type: 'regeneration' }], etiquettes: [], poussee: Boolean(envoyer) };
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
  if (commande === 'balayer') return balayer(o);
  if (commande === 'supprimer-fusionnee') { exiger(o, 'branche', 'sha'); return supprimerFusionnee(o); }
  throw new Refus('commande attendue : verifier-creation, verifier-pr, appliquer, regenerer, balayer ou supprimer-fusionnee');
}

const annoter = (texte) => (process.env.GITHUB_ACTIONS ? `::error::${texte}` : `ERREUR : ${texte}`);
function avertir(texte) { return process.env.GITHUB_ACTIONS ? `::warning::${texte}` : `AVERTISSEMENT : ${texte}`; }
try {
  const r = principal(process.argv.slice(2));
  if (typeof r === 'string') {
    console.log(r);
  } else if (r.type === 'balayage') {
    const lignes = r.message ? [r.message] : r.resultats.length
      ? r.resultats.map((x) => `- ${x.branche} : ${x.action === 'supprimee' ? (r.poussee ? 'supprimée' : 'à supprimer') : 'signalée'} (${x.raison})`)
      : ['Toutes les branches sont conformes.'];
    console.log(lignes.join('\n'));
    if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Balayage des branches\n\n${lignes.join('\n')}\n`);
    const signalees = r.resultats.filter((x) => x.action === 'signalee');
    if (signalees.length) {
      console.error(annoter(`${signalees.length} branche(s) hors des règles à reprendre : ${signalees.map((x) => x.branche).join(', ')}`));
      process.exit(CODE_REFUS);
    }
  } else {
    console.log(JSON.stringify(r, null, 2));
    const installateurs = r.livraisons.filter((l) => l.mode !== 'site');
    const site = r.livraisons.find((l) => l.mode === 'site');
    // a_supprimer n'est écrit que si tout est fait : une hotfix dont la refusion a échoué reste, pour la reprendre.
    const aSupprimer = r.erreur ? '' : (r.aSupprimer ?? '');
    if (process.env.GITHUB_OUTPUT) {
      appendFileSync(process.env.GITHUB_OUTPUT, `installateurs=${JSON.stringify(installateurs)}\nsite=${site ? site.sha : ''}\na_supprimer=${aSupprimer}\n`);
    }
    if (process.env.GITHUB_STEP_SUMMARY) {
      const lignes = [`### ${r.type}${r.majeure ? ' (majeure)' : ''}`, '', ...r.journal.map((j) => `- ${j}`),
        ...r.etiquettes.map((e) => `- étiquette de version \`${e.tag}\` sur ${e.branche} (${e.sha.slice(0, 7)})`),
        ...installateurs.map((l) => `- installateur ${l.mode} : \`${l.tag}\` (${l.branche} ${l.sha.slice(0, 7)})`),
        ...(site ? [`- site (avant la 0.2.0) : branche \`site\` reconstruite depuis dev ${site.sha.slice(0, 7)} (v${site.version})`] : []),
        ...(r.erreur ? [`- **à faire** : ${r.erreur}`] : [])];
      appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${lignes.join('\n')}\n`);
    }
    // Ce qui était prêt est publié (sorties écrites) ; l'échec signale ce qui reste à faire.
    if (r.erreur) {
      console.error(annoter(r.erreur));
      process.exit(CODE_REFUS);
    }
  }
} catch (e) {
  console.error(annoter(e.message));
  process.exit(e instanceof Refus ? CODE_REFUS : 3);
}
