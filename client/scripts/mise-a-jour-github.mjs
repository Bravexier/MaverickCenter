#!/usr/bin/env node
// Mise à jour des règles depuis le site de dev (page « Mise à jour », docs/serveur.md) : l'orchestration côté GitHub, lancée par le workflow
// .github/workflows/mise-a-jour.yml (workflow_dispatch : lot, empreinte, adresse, essai) que le service déclenche sur dev après « Effectuer la
// mise à jour » ou « Simulation de mise à jour » (serveur/notes-de-version.mjs : figerLot, creerGithub). Demande du propriétaire : « rebase,
// création d'une nouvelle PR incluant toutes les modifications de la DB, sa validation automatique si aucun conflit et erreur sur dev, puis juste
// après la fusion, le merge de dev vers master » ; et aucune autre table que celles de la mise à jour ne doit changer.
//
// Trois phases (--phase), réparties sur les deux jobs du workflow :
//   preparer — job « preparer », SANS AUCUN SECRET (npm ci, npm test et le code du dépôt y tournent) :
//     a. télécharge le lot figé (adresse) et vérifie son empreinte SHA-256 (octets tels que servis) ; le lot dit s'il est une simulation
//        (`simulation`, couvert par l'empreinte ; absent = false) : refus si l'entrée « essai » ne correspond pas ;
//     b. refuse si master contient des commits absents de dev, ou si une autre mise à jour (commit « Lot : <autre lot> ») est dans dev sans être
//        sur master ; un lot déjà dans dev ou déjà livré n'est pas rejoué (reprise) ;
//     c. part de origin/dev, rejoue le lot sur data/rows (scripts/mise-a-jour-regles.mjs : conflit ou autre refus, tout s'arrête) ; double
//        contrôle de la liste blanche (seuls data/rows/<table>.sql des tables du lot et de la note de version changent, et seulement ceux que
//        mise-a-jour-regles annonce) ; CONTROLES : db:build, db:check puis tout le job client de ci.yml (npm test, build, tests du site construit,
//        build de test, installateur, version portable) ; aucun fichier ne doit changer pendant les contrôles ; commit local (github-actions[bot]) ;
//     d. publie l'artefact « preparation » : le lot (octets servis), le commit (git bundle sur la base origin/dev) et preparation.json (état,
//        base, commit, version, note, fichiers, lignes).
//   dev, puis master — job « livrer », étapes « Fusion dans dev » et « Livraison vers master » : le SEUL job qui reçoit MISE_A_JOUR_TOKEN ; il
//   n'exécute que git et ce script (qui n'importe que node: et tools/flux-git/regles.mjs), ni npm ni node_modules :
//     e. relit l'artefact : le lot doit avoir l'empreinte de l'ENTRÉE du workflow (pas celle d'un fichier de l'artefact), la préparation être
//        celle de ce lot, le commit être unique sur la base annoncée, ne toucher que data/rows/<tables du lot et de la note de version> (fichiers
//        ordinaires) et porter le message attendu : un job preparer compromis ne peut rien faire pousser d'autre ;
//     f. l'applique sur origin/dev à jour : tel quel si dev n'a pas bougé depuis la base, sinon par un rebase textuel (cherry-pick) ; data/rows
//        a une ligne par ligne de table, un conflit textuel est donc la même ligne (ou sa voisine) modifiée des deux côtés : échec net, rien
//        n'est poussé ; un rebase propre est sûr car la CI de la PR refait tous les contrôles ;
//     g. pousse feature/mise-a-jour-regles-<AAAAMMJJ-HHMM> (sans hooks), ouvre la PR vers dev (branche supprimée si l'ouverture échoue), attend
//        les checks requis VERTS (CHECKS_REQUIS) sur le commit de tête et fusionne par commit de fusion avec sha ; si dev a bougé pendant
//        l'attente (PR non fusionnable, 405, 409, ou dev n'est plus la base) : PR fermée, branche supprimée, commit rejoué sur le nouveau dev
//        (au plus ESSAIS fois). Fin de l'étape « Fusion dans dev » : le lot est dans dev ;
//     h. étape « Livraison vers master » (elle repart de dev : chercherLotDejaFusionne) : attend le commit de version de livraison.yml
//        (« chore: version vX.Y.Z (feature …) (PR #n) ») — la PR de livraison ne part qu'après, sinon la version de la feature s'y mêlerait —,
//        puis ouvre la PR de livraison dev → master (jamais de [V: X+1] : signal du propriétaire seulement), attend ses checks verts et la
//        fusionne par commit de fusion avec sha ; livraison.yml pose ensuite la version X.Y.0, les étiquettes et la publication.
//   Simulation de mise à jour (entrée « essai ») : preparer fait tout, contrôles compris ; livrer vérifie sans effet de bord : artefact, liste
//   blanche, application sur origin/dev à blanc (rebase compris), `git push --dry-run` authentifié par le jeton (la découverte receive-pack exige
//   l'écriture sur Contents), lecture des PR avec le jeton, PR de livraison déjà ouverte ; il ne pousse rien, n'ouvre ni ne ferme aucune PR.
//   Non vérifiable sans effet de bord : Pull requests et Workflows en écriture (NON_VERIFIABLE).
//   Relancer le run (Re-run) reprend où il s'est arrêté : un lot déjà fusionné dans dev (son commit porte « Lot : <id> ») passe directement à la
//   livraison ; un lot déjà livré sur master ne fait rien ; une PR restée ouverte d'un passage précédent du même lot est fermée.
//
// Jetons. Job preparer : aucun secret ; actions/checkout y utilise le jeton du workflow (contents: read) sans le garder dans .git/config
// (persist-credentials: false) et ce script refuse d'y recevoir un jeton. Une dépendance npm compromise n'y trouve que ce que ce jeton lit, et ne
// peut que fausser l'artefact, que livrer revérifie (e). Job livrer : GH_TOKEN (secret MISE_A_JOUR_TOKEN : jeton personnel fine-grained du
// propriétaire, administrateur, limité à ce dépôt, Contents, Pull requests et Workflows en écriture) dans l'environnement de ses deux étapes de
// script, pour tout ce qui écrit : les événements créés avec le jeton du workflow ne déclenchent aucun autre workflow (une PR ouverte par lui
// n'aurait pas de CI, une fusion faite par lui ne lancerait pas livraison.yml). Les lectures de l'API passent par GITHUB_TOKEN_LECTURE (le jeton
// du workflow, lecture seule). git reçoit l'en-tête d'authentification par l'environnement de sa seule commande (fetch : jeton de lecture ; push :
// GH_TOKEN), ni en argument (visible dans ps) ni dans .git/config, et pousse ou rejoue sans hooks (core.hooksPath=/dev/null). Tout processus du
// job livrer pourrait lire ce jeton (/proc/<pid>/environ du script, mémoire du runner par sudo) : c'est pourquoi n'y tournent que les actions
// officielles (checkout, setup-node sans cache, download-artifact), git et ce script.
// Les règles GitHub (rulesets) ne s'appliquent pas à ce dépôt privé (pas d'abonnement) : rien n'empêcherait de fusionner une PR rouge, d'où
// l'attente explicite des checks verts ici, et la fusion avec sha= (refusée si la tête a bougé).
//
// Node 22, aucun paquet npm (fetch natif, git par child_process). Toutes les étapes sont des fonctions exportées qui reçoivent leurs outils
// ({ fetch, git, executer, attendre, journal }) : test/mise-a-jour-github.test.mjs les rejoue avec un GitHub, un git et des commandes simulés,
// et les parties git avec de vrais dépôts temporaires.
import { spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEV, MARQUEUR_MAJEURE, MASTER, demandeMajeure, familleDe } from '../../tools/flux-git/regles.mjs';

const RACINE = fileURLToPath(new URL('../../', import.meta.url));

/** Les phases (--phase) : le job « preparer », puis les deux étapes du job « livrer ». */
export const PHASES = ['preparer', 'dev', 'master'];
/** Noms des jobs et des étapes du job livrer : le service lit leur état (GET /actions/runs/{id}/jobs), ils ne changent pas. */
export const JOBS = Object.freeze({ preparer: 'preparer', livrer: 'livrer' });
export const ETAPES_DE_LIVRER = Object.freeze({ dev: 'Fusion dans dev', master: 'Livraison vers master' });
/** L'artefact que preparer publie et que livrer relit : son nom et ses fichiers. */
export const NOM_ARTEFACT = 'preparation';
export const ARTEFACT = Object.freeze({ lot: 'lot.json', commit: 'commit.bundle', preparation: 'preparation.json' });
export const FORMAT_PREPARATION = 'maverick-mise-a-jour-preparation/1';
/** La référence locale du commit préparé (dans le bundle). */
export const REF_DU_LOT = 'refs/mise-a-jour/lot';
/** Les checks qui doivent être verts sur le commit de tête avant une fusion (ci.yml : client, character-service ; garde-branches.yml). */
export const CHECKS_REQUIS = ['client', 'character-service', 'regles-de-branches'];
/** Applications du commit sur dev (la première, puis une par mouvement de dev pendant l'attente). */
export const ESSAIS = 3;
/** Attentes (ms). Le temps compté est celui des pauses demandées à `attendre` : les tests le simulent sans horloge. */
export const DELAIS = Object.freeze({
  checks: 40 * 60_000,
  intervalleChecks: 30_000,
  version: 20 * 60_000,
  intervalleVersion: 20_000,
  fusionnable: 5 * 60_000,
  intervalleFusionnable: 5_000,
});
/** Délai d'un appel réseau (lot, API) : une connexion pendue ne bloque pas le job jusqu'à son timeout. */
export const DELAI_RESEAU = 60_000;
/** Corps d'une PR : GitHub en accepte 65 536 caractères ; la note est coupée avant, le pied s'y ajoute. */
export const MAX_CORPS = 60_000;
export const PREFIXE_BRANCHE = 'feature/mise-a-jour-regles-';
/** Tables de la note de version, toujours écrites par la mise à jour (même liste que scripts/mise-a-jour-regles.mjs, comparée par le test). */
export const TABLES_DE_LA_NOTE = ['note_version', 'note_version_ligne', 'historique_modification'];
/**
 * Les contrôles du job « client » de .github/workflows/ci.yml après npm ci, dans l'ordre et à l'identique (le test les compare au fichier) ;
 * le `git fetch` de master qui les précède là-bas est fait ici par actions/checkout (fetch-depth: 0). Lancés par `sh -c` dans client/, avec
 * RUNNER_TEMP = un dossier temporaire du script.
 */
export const CONTROLES_DE_LA_CI = [
  'npm test',
  'npm run build',
  'node --test test/magies-html.test.mjs test/races-html.test.mjs test/classes-html.test.mjs test/metiers-html.test.mjs test/bestiaire-html.test.mjs test/chronologie-html.test.mjs test/armes-html.test.mjs test/accessoires-html.test.mjs test/guide-html.test.mjs test/site-html.test.mjs test/fiche-html.test.mjs test/edition-rendu.test.mjs test/classe-dons-rendu.test.mjs',
  'HIDE_EXAMPLES=1 SITE_MODE=test SITE_TAG=v0.0.0-test npm run build',
  'grep -q \'class="bandeau-test"\' dist/index.html',
  'sh "$(node ../deploy/installateur/fabriquer.mjs --mode test --site dist --tag v0.0.0-test --version 0.0.0 --sha local --sortie "$RUNNER_TEMP/installateur")" --verifier',
  'node ../tools/build-artifact.mjs --out "$RUNNER_TEMP/artifact"',
];
/** Les contrôles du job preparer, avant le commit : la base reconstruite et vérifiée, puis exactement ce que la CI de la PR fera (client). */
export const CONTROLES = ['npm run db:build', 'npm run db:check', ...CONTROLES_DE_LA_CI];
/** Ce qu'une simulation ne peut pas vérifier sans effet de bord (dit dans le résumé). */
export const NON_VERIFIABLE = [
  'Pull requests en écriture (ouvrir, commenter, fermer et fusionner les deux PR)',
  'Workflows en écriture (fusion d\'une livraison dev → master qui touche .github/workflows)',
];
/** Que faire quand une autre mise à jour attend sa livraison (code 7 de mise-a-jour-regles, ou commit « Lot : » non livré vu au départ). */
export const ACTION_LOT_EN_ATTENTE = 'Relancer le run de cette mise à jour-là (Re-run) : il reprend à la livraison dev → master ; ou livrer '
  + 'dev → master à la main (« Create a merge commit »). Puis relancer celle-ci.';
/** Codes de sortie de scripts/mise-a-jour-regles.mjs, et ce qu'il faut faire quand le code appelle une action. */
export const CODES_REGLES = {
  2: 'lot illisible ou refusé (tables hors des règles, HTML brut ou lien non sûr)',
  3: 'conflit avec dev',
  4: 'un fichier hors des tables autorisées changerait',
  5: 'clés étrangères rompues',
  6: 'base de production (master) introuvable',
  7: 'une autre mise à jour de la même version est dans dev sans être livrée',
};
export const ACTIONS_REGLES = { 7: ACTION_LOT_EN_ATTENTE };
/** Heure des noms de branche et date de la note : celle du propriétaire. */
export const FUSEAU = 'Europe/Paris';
const BOT = { nom: 'github-actions[bot]', courriel: '41898282+github-actions[bot]@users.noreply.github.com' };
/** Préfixe des commandes git du job livrer qui pourraient lancer un hook (push, cherry-pick) et du commit de preparer. */
const SANS_HOOKS = ['-c', 'core.hooksPath=/dev/null'];
const IDENTITE_DU_BOT = ['-c', `user.name=${BOT.nom}`, '-c', `user.email=${BOT.courriel}`];
/** Conclusions d'un check qui ne comptent ni pour ni contre (un job sauté par son `if:`, comme regles-de-branches sur l'événement create). */
const SANS_AVIS = new Set(['skipped', 'neutral']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SHA = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;
const BRANCHE_DU_WORKFLOW = /^feature\/mise-a-jour-regles-[0-9]{8}-[0-9]{4}(?:-[0-9]+)?$/;
const FICHIER_DE_DATA_ROWS = /^data\/rows\/[A-Za-z0-9_]+\.sql$/;

export class ErreurMiseAJourGithub extends Error {
  constructor(message, { etape = null, pr = null } = {}) {
    super(message);
    this.etape = etape;
    this.pr = pr;
  }
}
const echec = (etape, message, extra = {}) => new ErreurMiseAJourGithub(message, { etape, ...extra });

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Entrées, lot, textes
// ---------------------------------------------------------------------------------------------------------------------------------------------

/**
 * Contrôle les entrées du workflow (jamais recopiées dans un message avant d'être validées) : lot = uuid, empreinte = SHA-256 hexadécimal,
 * adresse = https://<hôte>/api/mise-a-jour/lots/<lot>/ (serveur/notes-de-version.mjs#figerLot) ; `hoteAttendu` (variable MISE_A_JOUR_HOTE,
 * défaut dans le workflow) : l'hôte du site de dev, seul permis.
 */
export function verifierEntrees({ lot, empreinte, adresse, hoteAttendu = null } = {}) {
  if (typeof lot !== 'string' || !UUID.test(lot)) throw echec('entrees', 'entrée « lot » invalide : un identifiant uuid (minuscules) est attendu');
  if (typeof empreinte !== 'string' || !/^[0-9a-f]{64}$/.test(empreinte)) {
    throw echec('entrees', 'entrée « empreinte » invalide : un SHA-256 en 64 caractères hexadécimaux minuscules est attendu');
  }
  const m = typeof adresse === 'string' ? /^https:\/\/([A-Za-z0-9.-]+(?::[0-9]{1,5})?)\/api\/mise-a-jour\/lots\/([0-9a-f-]{36})\/$/.exec(adresse) : null;
  if (!m || m[2] !== lot) throw echec('entrees', `entrée « adresse » invalide : https://<site de dev>/api/mise-a-jour/lots/${lot}/ est attendu`);
  if (hoteAttendu && m[1].toLowerCase() !== String(hoteAttendu).toLowerCase()) {
    throw echec('entrees', `entrée « adresse » : le lot doit venir de ${hoteAttendu} (variable du dépôt MISE_A_JOUR_HOTE)`);
  }
  return { hote: m[1] };
}

/** Les octets d'un lot → ses données, après contrôle de l'empreinte (celle de l'entrée du workflow) et de la forme. */
export function lireLot(octets, { empreinte, lot }, etape = 'lot') {
  const calculee = createHash('sha256').update(octets).digest('hex');
  if (calculee !== empreinte) {
    throw echec(etape, `empreinte du lot différente (attendue ${empreinte}, calculée ${calculee}) : ce n'est pas le lot figé par le site de dev, rien n'est fait`);
  }
  let donnees;
  try {
    donnees = JSON.parse(Buffer.from(octets).toString('utf8'));
  } catch {
    throw echec(etape, 'lot illisible (JSON invalide)');
  }
  if (donnees?.format !== 'maverick-mise-a-jour/1' || donnees.id !== lot || !Array.isArray(donnees.journal?.lots)) {
    throw echec(etape, 'lot illisible (format « maverick-mise-a-jour/1 » et identifiant du lot attendus)');
  }
  if (donnees.simulation !== undefined && typeof donnees.simulation !== 'boolean') throw echec(etape, 'lot illisible (« simulation » doit valoir true ou false)');
  return donnees;
}

/** Télécharge le lot et vérifie son empreinte sur les octets reçus, puis sa forme. Rend { octets, donnees }. */
export async function telechargerLot({ adresse, empreinte, lot }, { fetch }) {
  let r;
  try {
    // Jamais de redirection (vers un autre hôte que celui contrôlé par verifierEntrees) ; délai borné.
    r = await fetch(adresse, {
      headers: { Accept: 'application/json', 'User-Agent': 'maverick-center-mise-a-jour' }, redirect: 'error', signal: AbortSignal.timeout(DELAI_RESEAU),
    });
  } catch (e) {
    throw echec('lot', `téléchargement du lot impossible (${e.message}) : le site de dev doit servir ${adresse}`);
  }
  if (r.status !== 200) throw echec('lot', `téléchargement du lot : le site de dev a répondu ${r.status} pour ${adresse}`);
  const octets = Buffer.from(await r.arrayBuffer());
  return { octets, donnees: lireLot(octets, { empreinte, lot }) };
}

/**
 * Le lot dit s'il est une simulation (`simulation: true`, absent ou false sinon : un lot d'avant ce champ n'en est pas une) : l'entrée « essai »
 * doit dire la même chose, dans les deux sens. Une case « Simulation » laissée décochée (sa valeur par défaut) en lançant à la main un lot de
 * simulation ferait sinon une vraie livraison, que le site n'attend pas.
 */
export function verifierSimulation(donnees, essai) {
  const simulation = donnees?.simulation === true;
  if (simulation && !essai) {
    throw echec('entrees', 'ce lot a été figé pour une simulation de mise à jour : le workflow doit être lancé avec la case « essai » (Simulation) '
      + 'cochée. Rien n\'est fait.');
  }
  if (!simulation && essai) {
    throw echec('entrees', 'simulation demandée (case « essai » cochée) pour un lot de vraie mise à jour : relancer avec la case décochée, ou '
      + 'faire une « Simulation de mise à jour » depuis la page Mise à jour du site de dev. Rien n\'est fait.');
  }
}

/** Les tables que le journal du lot modifie (la liste blanche, avec TABLES_DE_LA_NOTE). */
export function tablesDuLot(donnees) {
  const tables = new Set();
  for (const l of donnees?.journal?.lots ?? []) {
    for (const m of l.modifications ?? []) {
      if (typeof m.table !== 'string' || !/^[A-Za-z0-9_]+$/.test(m.table)) throw echec('lot', 'lot illisible (nom de table invalide dans le journal)');
      tables.add(m.table);
    }
  }
  return [...tables].sort();
}

/** Date (AAAA-MM-JJ, note de version) et horodatage (AAAAMMJJ-HHMM, nom de branche) dans le fuseau du propriétaire. */
export function horodatage(date, fuseau = FUSEAU) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: fuseau, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date).map((x) => [x.type, x.value]));
  return { jour: `${p.year}-${p.month}-${p.day}`, branche: `${p.year}${p.month}${p.day}-${p.hour}${p.minute}` };
}

/** feature/mise-a-jour-regles-<AAAAMMJJ-HHMM>, suffixée du numéro de l'essai à partir du deuxième (nom permis par le flux Git). */
export function nomDeBranche(quand, essai = 1) {
  const nom = `${PREFIXE_BRANCHE}${quand?.branche}${essai > 1 ? `-${essai}` : ''}`;
  if (familleDe(nom) !== 'feature' || !BRANCHE_DU_WORKFLOW.test(nom)) throw echec('branche', `nom de branche invalide « ${nom} »`);
  return nom;
}

const MARQUEUR_GLOBAL = new RegExp(MARQUEUR_MAJEURE.source, 'gi');
/** Le marqueur de version majeure n'est jamais repris d'un texte (signal du propriétaire seulement) : « (V: X+1) » à la place. */
export const neutraliserMarqueur = (texte) => String(texte ?? '').replace(MARQUEUR_GLOBAL, '(V: X+1)');

/** Espace sans chasse (U+200B) : coupe une référence ou une mention pour GitHub, sans changer le texte lu. */
export const SANS_CHASSE = '​';
/**
 * Les références GitHub et les @mentions d'un texte, rendues inertes par une espace sans chasse : une PR ouverte et fusionnée avec le jeton du
 * propriétaire ne doit ni fermer de ticket (« Closes #12 » : dev est la branche par défaut), ni lier des tickets, ni notifier personne en son nom.
 * Visées : `#n`, `GH-n`, `propriétaire/dépôt#n` (par son `#`), les adresses …github.com/…/issues/n et …/pull/n, et tout `@`. Les liens de run
 * (…/actions/runs/n) restent tels quels ; une entité HTML (`&#39;`) aussi. Idempotent (un texte déjà neutralisé ne change plus).
 */
export function neutraliserReferences(texte) {
  return String(texte ?? '')
    .replace(/((?:https?:\/\/)?(?:www\.)?github\.com\/[^\s/]+\/[^\s/]+\/(?:issues|pulls?)\/)(?=\d)/gi, `$1${SANS_CHASSE}`)
    .replace(/(?<!&)#(?=\d)/g, `#${SANS_CHASSE}`)
    .replace(/\bGH-(?=\d)/gi, (m) => `${m}${SANS_CHASSE}`)
    .replace(/@(?!​)/g, `@${SANS_CHASSE}`);
}
/** Tout ce qu'un texte venu du lot ou de la note ne doit pas porter dans une PR ou un commentaire : marqueur, références, mentions. */
export const neutraliserTexte = (texte) => neutraliserReferences(neutraliserMarqueur(texte));

/** Corps d'une PR : la note neutralisée (neutraliserTexte) coupée à MAX_CORPS, puis une ligne de pied (le lot, le run), neutralisée de même. */
export function corpsDePR(markdown, pied) {
  let texte = neutraliserTexte(markdown).trimEnd();
  if (texte.length > MAX_CORPS) {
    texte = `${texte.slice(0, MAX_CORPS).replace(/\n[^\n]*$/, '')}\n\n… note coupée à ${MAX_CORPS} caractères : la note complète est dans data/rows/note_version_ligne.sql.`;
  }
  const corps = `${texte}\n\n---\n${neutraliserTexte(pied)}\n`;
  if (demandeMajeure(corps)) throw echec('texte', 'le corps de la PR porte encore [V: X+1]');
  return corps;
}

/** La note seule, sans le pied qu'y ajoute corpsDePR (le corps de la PR vers dev redevient celui de la livraison). */
export function noteDuCorps(corps) {
  const texte = String(corps ?? '');
  const i = texte.lastIndexOf('\n\n---\n');
  return i < 0 ? texte : texte.slice(0, i);
}

export const titreDev = (version) => `Mise à jour des règles V${version} (site de dev)`;
export const titreLivraison = (version) => `Livraison V${version} (mise à jour du site de dev)`;
export const messageDeCommit = (version, lot) => `Mise à jour des règles V${version} (site de dev, lot ${lot.slice(0, 8)})`;
export const corpsDuCommit = (lot, run) => `Lot : ${lot}${run ? `\nRun : ${run}` : ''}\n\nAppliqué par le workflow « Mise à jour des règles » (.github/workflows/mise-a-jour.yml).`;
/** Le message complet du commit préparé : livrer le recalcule et le compare (aucune ligne « Lot : » d'un autre lot ne peut s'y glisser). */
export const messageAttendu = (version, lot, run) => `${messageDeCommit(version, lot)}\n\n${corpsDuCommit(lot, run)}`;

// ---------------------------------------------------------------------------------------------------------------------------------------------
// git et contrôles locaux
// ---------------------------------------------------------------------------------------------------------------------------------------------

/** git injecté ({ code, sortie, erreur }) → une fonction qui échoue sauf code permis. La sortie n'est pas rognée (git status -z). */
export function enveloppeGit(git) {
  return (args, { ok = [0] } = {}) => {
    const r = git(args);
    if (!ok.includes(r.code)) throw echec('git', `git ${args.join(' ')} : ${String(r.erreur || r.sortie || '').trim() || `code ${r.code}`}`);
    return { code: r.code, sortie: String(r.sortie ?? ''), erreur: String(r.erreur ?? '') };
  };
}

const rafraichir = (g) => g(['fetch', '--quiet', 'origin', `+refs/heads/${DEV}:refs/remotes/origin/${DEV}`, `+refs/heads/${MASTER}:refs/remotes/origin/${MASTER}`]);
const revision = (g, ref) => g(['rev-parse', '--verify', `${ref}^{commit}`]).sortie.trim();
/** Les parents d'un commit (rev-list --parents : « <commit> <parent>… »). */
const parentsDe = (g, commit) => g(['rev-list', '--parents', '-n', '1', commit]).sortie.trim().split(/\s+/).slice(1);

/** Les chemins que `git status --porcelain=v1 -z` montre changés (suivis ou non, renommages compris). */
export function lireStatut(sortie) {
  const morceaux = String(sortie ?? '').split('\0').filter(Boolean);
  const chemins = new Set();
  for (let i = 0; i < morceaux.length; i += 1) {
    const entree = morceaux[i];
    chemins.add(entree.slice(3));
    if (/^[RC]/.test(entree)) chemins.add(morceaux[(i += 1)]);
  }
  return [...chemins].filter(Boolean).sort();
}
const STATUT = ['status', '--porcelain=v1', '-z', '--untracked-files=all', '--no-renames'];
export const fichiersModifies = (g) => lireStatut(g(STATUT).sortie);

/**
 * Les entrées de `git status` dont l'arbre de travail diffère de l'index (deuxième colonne non blanche, nouveaux fichiers « ?? » compris) :
 * après `git add`, ce qui a changé depuis (un contrôle qui réécrit un fichier, en crée ou en supprime un).
 */
export function changementsNonIndexes(sortie) {
  return String(sortie ?? '').split('\0').filter(Boolean).filter((e) => e[1] !== ' ').map((e) => e.slice(3)).sort();
}
const fichiersIndexes = (g) => g(['diff', '--cached', '--name-only', '--no-renames', '-z']).sortie.split('\0').filter(Boolean).sort();

/** Les chemins permis : data/rows/<table>.sql des tables du lot et de la note de version. */
const cheminsPermis = (tables) => new Set([...(tables ?? []), ...TABLES_DE_LA_NOTE].map((t) => `data/rows/${t}.sql`));

/**
 * Double contrôle de la liste blanche : un fichier changé doit être data/rows/<f> avec <f> annoncé par mise-a-jour-regles (`fichiers`) ET la
 * table d'une modification du lot ou de la note de version. Rend les chemins refusés.
 */
export function horsListe(chemins, fichiers, tables) {
  const annonces = new Set((fichiers ?? []).map((f) => `data/rows/${f}`));
  const permis = cheminsPermis(tables);
  return chemins.filter((c) => !annonces.has(c) || !permis.has(c));
}

/** `git diff-tree -r --raw -z --no-renames` → [{ ancien, nouveau, statut, chemin }] (modes git de l'ancien et du nouveau fichier). */
export function lireDiffTree(sortie) {
  const morceaux = String(sortie ?? '').split('\0');
  const entrees = [];
  for (let i = 0; i + 1 < morceaux.length; i += 2) {
    const meta = morceaux[i].trim();
    if (!meta) break;
    const m = /^:(\d{6}) (\d{6}) [0-9a-f]+ [0-9a-f]+ ([A-Z])\d*$/.exec(meta);
    if (!m) throw echec('artefact', `sortie de git diff-tree illisible (« ${meta.slice(0, 80)} »)`);
    entrees.push({ ancien: m[1], nouveau: m[2], statut: m[3], chemin: morceaux[i + 1] });
  }
  return entrees;
}

/**
 * Contrôle par git d'un commit à pousser (job livrer) : ce qu'il change depuis `base` ne touche que data/rows/<tables du lot et de la note de
 * version>.sql, en fichiers ordinaires (mode 100644, ou supprimés) ; `fichiers` (facultatif) : la liste exacte attendue ; `message` (facultatif) :
 * le message exact attendu. Rend les chemins changés.
 */
export function verifierCommit(g, { base, commit, tables, fichiers = null, message = null }) {
  const entrees = lireDiffTree(g(['diff-tree', '-r', '--no-renames', '--no-commit-id', '--raw', '-z', base, commit]).sortie);
  if (!entrees.length) throw echec('liste', `le commit ${commit.slice(0, 7)} ne change rien depuis ${base.slice(0, 7)} : rien n'est poussé.`);
  const permis = cheminsPermis(tables);
  const refuses = entrees.filter((x) => !permis.has(x.chemin) || !FICHIER_DE_DATA_ROWS.test(x.chemin)
    || !(x.nouveau === '100644' || (x.nouveau === '000000' && x.statut === 'D')));
  if (refuses.length) {
    throw echec('liste', `le commit ${commit.slice(0, 7)} touche hors des tables de la mise à jour : ${refuses.map((x) => `${x.chemin} (${x.nouveau})`).join(', ')} `
      + `(seuls les fichiers ordinaires data/rows/<table>.sql des tables du lot [${(tables ?? []).join(', ') || 'aucune'}] et de la note de version). Rien n'est poussé.`);
  }
  const chemins = entrees.map((x) => x.chemin).sort();
  if (fichiers && chemins.join('\n') !== [...fichiers].sort().join('\n')) {
    throw echec('liste', `le commit ${commit.slice(0, 7)} ne change pas les fichiers annoncés par la préparation (${chemins.join(', ')} au lieu de ${[...fichiers].sort().join(', ')}). Rien n'est poussé.`);
  }
  if (message !== null) {
    const lu = g(['log', '-1', '--format=%B', commit]).sortie.trim();
    if (lu !== message.trim()) throw echec('artefact', `le message du commit ${commit.slice(0, 7)} n'est pas celui du workflow : rien n'est poussé.`);
  }
  return chemins;
}

function lireJson(chemin) {
  try {
    return JSON.parse(readFileSync(chemin, 'utf8'));
  } catch {
    return null;
  }
}

function verifierResume(resume) {
  const ok = resume && /^\d+\.\d+$/.test(String(resume.version)) && Array.isArray(resume.fichiers)
    && resume.fichiers.every((f) => typeof f === 'string' && /^[A-Za-z0-9_]+\.sql$/.test(f)) && typeof resume.markdown === 'string';
  if (!ok) throw echec('lot', 'résumé de mise-a-jour-regles.mjs illisible (version X.Y, fichiers, markdown attendus)');
}

/** L'environnement des commandes lancées (mise-a-jour-regles, contrôles) : sans aucun jeton. */
function environnementSansJeton() {
  const env = { ...process.env };
  delete env.GH_TOKEN;
  delete env.GITHUB_TOKEN_LECTURE;
  return env;
}

/**
 * Le lot est-il déjà passé par ce workflow ? Son commit porte « Lot : <id> » ; s'il est sur master, il est livré ; sinon la PR qui l'a fusionné
 * dans dev se lit dans son commit de fusion (« Merge pull request #n from … »). Rend { commit, version, livre, pr } ou null.
 */
export function chercherLotDejaFusionne(g, lot) {
  const commits = g(['log', `origin/${DEV}`, '--fixed-strings', `--grep=Lot : ${lot}`, '--format=%H']).sortie.split('\n').map((s) => s.trim()).filter(Boolean);
  if (!commits.length) return null;
  const commit = commits.at(-1);
  const sujet = g(['log', '-1', '--format=%s', commit]).sortie.trim();
  const version = /\bV(\d+\.\d+)\b/.exec(sujet)?.[1] ?? null;
  const livre = g(['merge-base', '--is-ancestor', commit, `origin/${MASTER}`], { ok: [0, 1] }).code === 0;
  const fusion = g(['log', '--merges', '--ancestry-path', '--reverse', '--format=%H%x09%P%x09%s', `${commit}..origin/${DEV}`]).sortie
    .split('\n').filter(Boolean).map((l) => l.split('\t')).find(([, parents = '']) => parents.split(' ').includes(commit));
  const pr = fusion ? Number(/^Merge pull request #(\d+) /.exec(fusion[2] ?? '')?.[1]) || null : null;
  return { commit, version, livre, pr };
}

/**
 * Les mises à jour d'un AUTRE lot qui sont dans dev sans être sur master : commits « Lot : <id> » de origin/master..origin/dev. Rend
 * [{ commit, lot, version, run }]. Une nouvelle mise à jour de la même version X.Y remplacerait leur note (texte libre et historique).
 */
export function lotsEnAttente(g, lot) {
  const sortie = g(['log', `origin/${MASTER}..origin/${DEV}`, '--no-merges', '--format=%H%x1f%B%x1e']).sortie;
  const autres = [];
  for (const bloc of sortie.split('\x1e')) {
    const [commit = '', message = ''] = bloc.replace(/^\s+/, '').split('\x1f');
    if (!SHA.test(commit)) continue;
    for (const [, id] of message.matchAll(/^Lot : ([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})[ \t]*$/gm)) {
      if (id === lot) continue;
      autres.push({
        commit, lot: id, version: /\bV(\d+\.\d+)\b/.exec(message.split('\n')[0])?.[1] ?? null, run: /^Run : (https:\/\/\S+)[ \t]*$/m.exec(message)?.[1] ?? null,
      });
    }
  }
  return autres;
}

export const messageLotEnAttente = (a) => `une autre mise à jour attend sa livraison : la V${a.version ?? '?'} du lot ${a.lot} est dans dev `
  + `(commit ${a.commit.slice(0, 7)}) mais pas encore sur master. ${ACTION_LOT_EN_ATTENTE}${a.run ? ` Run de cette mise à jour : ${a.run}.` : ''} Rien n'est fait.`;

/**
 * Au départ de chaque phase : master doit être dans dev (une refusion après un hotfix en attente ferait refuser la livraison), et aucune autre
 * mise à jour ne doit attendre sa livraison dans dev (lotsEnAttente).
 */
export function verifierDepart(g, lot) {
  if (g(['merge-base', '--is-ancestor', `origin/${MASTER}`, `origin/${DEV}`], { ok: [0, 1] }).code !== 0) {
    throw echec('depart', 'master contient des commits absents de dev (refusion après un hotfix en attente) : la livraison serait refusée, rien n\'est fait. Refusionner master dans dev d\'abord (docs/flux-git.md).');
  }
  const autres = lotsEnAttente(g, lot);
  if (autres.length) throw echec('depart', messageLotEnAttente(autres[0]));
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Artefact (preparer → livrer)
// ---------------------------------------------------------------------------------------------------------------------------------------------

/** Le commit préparé dans un bundle git (le commit seul : la base, origin/dev, est un prérequis que livrer a déjà). */
export function creerBundle(g, { base, commit, fichier }) {
  g(['update-ref', REF_DU_LOT, commit]);
  g(['bundle', 'create', '--quiet', fichier, REF_DU_LOT, `^${base}`]);
}

/**
 * Contrôle la préparation lue dans l'artefact : même lot, même empreinte, même mode (simulation ou non) que les entrées du workflow, état
 * connu ; pour un lot prêt : base et commit, version X.Y, note, fichiers de data/rows, horodatage de la branche.
 */
export function verifierPreparation(p, { lot, empreinte, essai }) {
  if (p?.format !== FORMAT_PREPARATION || p.lot !== lot || p.empreinte !== empreinte || p.essai !== Boolean(essai)) {
    throw echec('artefact', `préparation illisible ou d'un autre passage (format ${FORMAT_PREPARATION}, même lot, même empreinte et même mode attendus) : relancer tous les jobs du run (Re-run all jobs)`);
  }
  if (!['pret', 'rien', 'reprise', 'deja-livre'].includes(p.etat)) throw echec('artefact', 'préparation illisible (état inconnu)');
  if (p.etat !== 'pret') return p;
  const ok = SHA.test(String(p.base)) && SHA.test(String(p.commit)) && /^\d+\.\d+$/.test(String(p.version)) && typeof p.markdown === 'string'
    && Array.isArray(p.fichiers) && p.fichiers.length > 0 && p.fichiers.every((f) => typeof f === 'string' && FICHIER_DE_DATA_ROWS.test(f))
    && /^\d{8}-\d{4}$/.test(String(p.quand?.branche));
  if (!ok) throw echec('artefact', 'préparation illisible (base, commit, version X.Y, note, fichiers de data/rows et horodatage attendus)');
  return p;
}

/** Relit l'artefact « preparation » (job livrer). Le lot est vérifié par l'empreinte de l'entrée du workflow. Rend { donnees, tables, preparation }. */
export function lireArtefact(dossier, { lot, empreinte, essai }) {
  if (!dossier) throw echec('entrees', 'ARTEFACT manquant (dossier de l\'artefact « preparation »)');
  let octets;
  try {
    octets = readFileSync(join(dossier, ARTEFACT.lot));
  } catch {
    throw echec('artefact', `artefact « ${NOM_ARTEFACT} » incomplet (${ARTEFACT.lot} absent) : le job preparer l'a-t-il publié ?`);
  }
  const donnees = lireLot(octets, { empreinte, lot }, 'artefact');
  verifierSimulation(donnees, essai);
  const tables = tablesDuLot(donnees);
  const preparation = verifierPreparation(lireJson(join(dossier, ARTEFACT.preparation)), { lot, empreinte, essai });
  return { donnees, tables, preparation };
}

/** Importe le commit du bundle et vérifie qu'il est celui annoncé, avec pour seul parent la base annoncée. */
export function importerCommit(g, fichier, p) {
  if (!existsSync(fichier)) throw echec('artefact', `artefact « ${NOM_ARTEFACT} » incomplet (${ARTEFACT.commit} absent)`);
  g(['bundle', 'verify', '--quiet', fichier]);
  g(['fetch', '--quiet', '--no-tags', fichier, `+${REF_DU_LOT}:${REF_DU_LOT}`]);
  const commit = revision(g, REF_DU_LOT);
  if (commit !== p.commit) throw echec('artefact', `le bundle porte ${commit.slice(0, 7)}, la préparation annonçait ${String(p.commit).slice(0, 7)} : rien n'est poussé.`);
  const parents = parentsDe(g, commit);
  if (parents.length !== 1 || parents[0] !== p.base) {
    throw echec('artefact', `le commit ${commit.slice(0, 7)} doit avoir pour seul parent la base annoncée (${String(p.base).slice(0, 7)}) : rien n'est poussé.`);
  }
  return commit;
}

/**
 * Pose le commit préparé sur origin/dev (à jour) dans la branche locale `branche` : tel quel si dev est encore sa base, sinon par un rebase
 * textuel (cherry-pick, sans hooks, par github-actions[bot]). Conflit (même ligne de data/rows, ou voisine, changée des deux côtés) ou commit
 * devenu vide : échec net, rien n'est poussé. Le commit rejoué est revérifié (liste blanche). Rend { tete, sha, rejoue }.
 */
export function appliquerSurDev(g, { preparation: p, branche, tables }) {
  const tete = revision(g, `origin/${DEV}`);
  if (tete === p.base) {
    g(['checkout', '--quiet', '-B', branche, p.commit]);
    return { tete, sha: p.commit, rejoue: false };
  }
  g(['checkout', '--quiet', '-B', branche, `origin/${DEV}`]);
  const r = g([...SANS_HOOKS, ...IDENTITE_DU_BOT, 'cherry-pick', p.commit], { ok: [0, 1] });
  if (r.code !== 0) {
    g(['cherry-pick', '--abort'], { ok: [0, 128] });
    throw echec('rebase', `dev a modifié les mêmes lignes de data/rows que ce lot depuis sa préparation (${p.base.slice(0, 7)} → ${tete.slice(0, 7)}) : `
      + 'relancez la mise à jour (Re-run all jobs : le lot sera rejoué sur le nouveau dev). Rien n\'est poussé.');
  }
  const sha = revision(g, 'HEAD');
  const parents = parentsDe(g, sha);
  if (parents.length !== 1 || parents[0] !== tete) throw echec('rebase', `commit rejoué inattendu (${sha.slice(0, 7)}) : rien n'est poussé.`);
  verifierCommit(g, { base: tete, commit: sha, tables });
  return { tete, sha, rejoue: true };
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// API GitHub
// ---------------------------------------------------------------------------------------------------------------------------------------------

/**
 * Client de l'API REST du dépôt : { statut, donnees } pour chaque appel ; GET avec le jeton de lecture s'il y en a un (sauf `{ ecriture: true }`,
 * qui lit avec le jeton du bot : vérification du jeton en simulation).
 */
export function creerApi({ fetch, depot, jeton, jetonLecture = null }) {
  const base = `https://api.github.com/repos/${depot}`;
  const appel = async (methode, chemin, corps, { ecriture = false } = {}) => {
    const r = await fetch(`${base}${chemin}`, {
      method: methode,
      signal: AbortSignal.timeout(DELAI_RESEAU),
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${methode === 'GET' && jetonLecture && !ecriture ? jetonLecture : jeton}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'maverick-center-mise-a-jour',
        ...(corps === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      ...(corps === undefined ? {} : { body: JSON.stringify(corps) }),
    });
    const texte = await r.text();
    let donnees = null;
    try {
      donnees = texte ? JSON.parse(texte) : null;
    } catch {
      donnees = { message: texte.slice(0, 300) };
    }
    return { statut: r.status, donnees };
  };
  return {
    get: (chemin, options) => appel('GET', chemin, undefined, options),
    post: (chemin, corps) => appel('POST', chemin, corps),
    put: (chemin, corps) => appel('PUT', chemin, corps),
    patch: (chemin, corps) => appel('PATCH', chemin, corps),
    supprimer: (chemin) => appel('DELETE', chemin),
  };
}

const messageGithub = (r) => {
  const d = r.donnees ?? {};
  const details = Array.isArray(d.errors) ? d.errors.map((e) => e?.message ?? e?.code).filter(Boolean).join(' ; ') : '';
  return `${r.statut}${d.message ? ` (${d.message}${details ? ` : ${details}` : ''})` : ''}`;
};
function exiger(r, statuts, quoi, etape) {
  if (!statuts.includes(r.statut)) throw echec(etape, `${quoi} : GitHub a répondu ${messageGithub(r)}`);
  return r.donnees;
}
/** Un appel de sondage : une panne passagère (réseau) compte comme une réponse sans résultat. */
async function sonder(appel) {
  try {
    return await appel();
  } catch (e) {
    return { statut: 0, donnees: { message: e.message } };
  }
}

/**
 * L'état des checks requis d'un commit. Par nom : un check en échec (toute conclusion autre que success, skipped, neutral) → `echecs` ;
 * un check en cours → `attente` ; au moins un succès et rien d'autre → `reussis` ; aucun check, ou seulement sautés → `attente`.
 * Un job sauté ne compte pas : regles-de-branches est sauté sur l'événement create (garde-branches.yml), le vrai vient de la PR.
 */
export function etatDesChecks(runs, requis = CHECKS_REQUIS) {
  const reussis = [];
  const echecs = [];
  const attente = [];
  for (const nom of requis) {
    const liste = (runs ?? []).filter((c) => c?.name === nom);
    const rate = liste.find((c) => c.status === 'completed' && c.conclusion !== 'success' && !SANS_AVIS.has(c.conclusion));
    if (rate) echecs.push(`${nom} (${rate.conclusion}${rate.html_url ? ` : ${rate.html_url}` : ''})`);
    else if (liste.some((c) => c.status !== 'completed')) attente.push(`${nom} (en cours)`);
    else if (liste.some((c) => c.conclusion === 'success')) reussis.push(nom);
    else attente.push(`${nom} (pas encore lancé)`);
  }
  return { reussis, echecs, attente };
}

/** Attend que les checks requis du commit `sha` soient tous verts. Rend { ok, raison: 'succes' | 'echec' | 'delai', reussis, echecs, attente }. */
export async function attendreChecks(ctx, sha) {
  const { api, outils: { attendre, journal }, delais } = ctx;
  let attendu = 0;
  let dernier = '';
  let etat = { reussis: [], echecs: [], attente: CHECKS_REQUIS.map((n) => `${n} (pas encore lancé)`) };
  for (;;) {
    const r = await sonder(() => api.get(`/commits/${sha}/check-runs?per_page=100&filter=latest`));
    if (r.statut === 200) {
      etat = etatDesChecks(r.donnees?.check_runs);
      if (etat.echecs.length) return { ok: false, raison: 'echec', ...etat };
      if (!etat.attente.length) return { ok: true, raison: 'succes', ...etat };
      const resume = `checks de ${sha.slice(0, 7)} : attente de ${etat.attente.join(', ')}`;
      if (resume !== dernier) journal(resume);
      dernier = resume;
    } else if (dernier !== `!${r.statut}`) {
      journal(`avertissement : lecture des checks de ${sha.slice(0, 7)} : ${messageGithub(r)} (nouvel essai)`);
      dernier = `!${r.statut}`;
    }
    if (attendu >= delais.checks) return { ok: false, raison: 'delai', ...etat };
    await attendre(delais.intervalleChecks);
    attendu += delais.intervalleChecks;
  }
}

function texteDesChecks(checks, delais) {
  if (checks.raison === 'echec') return `check(s) en échec : ${checks.echecs.join(', ')}`;
  const jamais = checks.attente.length && checks.attente.every((a) => a.endsWith('(pas encore lancé)'));
  return `checks toujours pas verts après ${Math.round(delais.checks / 60_000)} min (${checks.attente.join(', ')})`
    + (jamais ? ' : aucun n\'a démarré ; la PR doit être ouverte avec le jeton MISE_A_JOUR_TOKEN (jeton personnel), pas avec celui du workflow' : '');
}

/** Attend que GitHub ait calculé `mergeable`. Rend { etat: 'fusionnable' | 'conflit' | 'inconnu' | 'fermee', pr }. */
export async function attendreFusionnable(ctx, numero) {
  const { api, outils: { attendre }, delais } = ctx;
  let attendu = 0;
  let pr = null;
  for (;;) {
    const r = await sonder(() => api.get(`/pulls/${numero}`));
    if (r.statut === 200 && r.donnees) {
      pr = r.donnees;
      if (pr.state !== 'open') return { etat: 'fermee', pr };
      if (pr.mergeable === true) return { etat: 'fusionnable', pr };
      if (pr.mergeable === false) return { etat: 'conflit', pr };
    }
    if (attendu >= delais.fusionnable) return { etat: 'inconnu', pr };
    await attendre(delais.intervalleFusionnable);
    attendu += delais.intervalleFusionnable;
  }
}

/** Fusionne par commit de fusion, seulement si la tête est encore `sha`. Rend { ok, sha } ou { ok: false, statut, message } (405, 409…). */
export async function fusionner(ctx, numero, sha, { titre, message }) {
  const r = await ctx.api.put(`/pulls/${numero}/merge`, { merge_method: 'merge', sha, commit_title: titre, commit_message: message });
  if (r.statut === 200 && r.donnees?.merged) return { ok: true, sha: r.donnees.sha };
  // 405 : non fusionnable (dev a bougé, conflit) ; 409 : la tête n'est plus `sha`. Tout autre refus (422 : méthode refusée…) arrête tout.
  if (r.statut === 405 || r.statut === 409 || r.statut === 200) return { ok: false, statut: r.statut, message: r.donnees?.message ?? null };
  throw echec('fusion', `fusion de la PR #${numero} : GitHub a répondu ${messageGithub(r)}`, { pr: numero });
}

async function commenter(ctx, numero, texte) {
  const r = await sonder(() => ctx.api.post(`/issues/${numero}/comments`, { body: neutraliserTexte(texte) }));
  if (r.statut !== 201) ctx.outils.journal(`avertissement : commentaire sur la PR #${numero} impossible (${messageGithub(r)})`);
}

/** Supprime une branche du workflow (jamais une autre). */
async function supprimerBranche(ctx, branche) {
  if (!BRANCHE_DU_WORKFLOW.test(branche)) return false;
  const s = await sonder(() => ctx.api.supprimer(`/git/refs/heads/${branche}`));
  if (![204, 404, 422].includes(s.statut)) {
    ctx.outils.journal(`avertissement : branche ${branche} non supprimée (${messageGithub(s)})`);
    return false;
  }
  return true;
}

/** Ferme une PR du workflow et supprime sa branche (un nouvel essai, ou un passage précédent du même lot). */
async function abandonnerPR(ctx, numero, branche, raison) {
  await commenter(ctx, numero, `${raison}\n\nPR fermée par le workflow « Mise à jour des règles »${ctx.run ? ` (${ctx.run})` : ''} : le lot est rejoué sur le dev à jour.`);
  exiger(await ctx.api.patch(`/pulls/${numero}`, { state: 'closed' }), [200], `fermeture de la PR #${numero}`, 'pr-dev');
  await supprimerBranche(ctx, branche);
}

/** Les PR encore ouvertes d'un passage précédent du même lot (même préfixe de branche, lot cité dans le corps) : fermées. */
export async function fermerAnciennesPR(ctx) {
  const r = await sonder(() => ctx.api.get(`/pulls?state=open&base=${DEV}&per_page=100`));
  if (r.statut !== 200 || !Array.isArray(r.donnees)) {
    ctx.outils.journal(`avertissement : lecture des PR ouvertes vers ${DEV} impossible (${messageGithub(r)}) : une PR d'un passage précédent du même lot resterait ouverte`);
    return [];
  }
  const anciennes = r.donnees.filter((p) => BRANCHE_DU_WORKFLOW.test(String(p.head?.ref ?? '')) && p.head?.repo?.full_name === ctx.depot
    && String(p.body ?? '').includes(ctx.lot));
  for (const p of anciennes) {
    await abandonnerPR(ctx, p.number, p.head.ref, 'Cette PR vient d\'un passage précédent du même lot, qui ne l\'a pas menée à terme.');
    ctx.outils.journal(`PR #${p.number} d'un passage précédent du même lot : fermée`);
  }
  return anciennes.map((p) => p.number);
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Contexte des phases
// ---------------------------------------------------------------------------------------------------------------------------------------------

function contexte(entrees, outils, { avecJeton }) {
  const journal = outils.journal ?? (() => {});
  const e = { essai: false, delais: DELAIS, debut: new Date(), hoteAttendu: null, jeton: null, jetonLecture: null, run: null, ...entrees };
  e.essai = e.essai === true;
  verifierEntrees(e);
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(String(e.depot ?? ''))) throw echec('entrees', 'GITHUB_REPOSITORY manquant ou invalide');
  if (avecJeton && !e.jeton) throw echec('entrees', 'GH_TOKEN manquant (secret MISE_A_JOUR_TOKEN)');
  if (!avecJeton && (e.jeton || e.jetonLecture)) {
    throw echec('entrees', 'le job preparer ne reçoit aucun jeton (npm et le code du dépôt y tournent) : GH_TOKEN et GITHUB_TOKEN_LECTURE y sont refusés');
  }
  return {
    ...e,
    proprietaire: e.depot.split('/')[0],
    api: avecJeton ? creerApi({ fetch: outils.fetch, depot: e.depot, jeton: e.jeton, jetonLecture: e.jetonLecture }) : null,
    g: enveloppeGit(outils.git),
    outils: { ...outils, journal, attendre: outils.attendre ?? attendreVraiment },
  };
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Phase « preparer » (job preparer, sans secret)
// ---------------------------------------------------------------------------------------------------------------------------------------------

/**
 * a à d : lot téléchargé et vérifié, rejoué sur origin/dev, contrôlé (CONTROLES), commité localement et publié dans le dossier `artefact`.
 * `entrees` : { lot, empreinte, adresse, essai, depot, run, racine, temp, artefact, debut, hoteAttendu } ; `outils` : { fetch, git, executer,
 * journal }. Rend la préparation (aussi écrite dans preparation.json) : { etat: 'pret' | 'rien' | 'reprise' | 'deja-livre', … }.
 */
export async function preparer(entrees, outils) {
  const ctx = contexte(entrees, outils, { avecJeton: false });
  const { g, outils: { journal, executer }, lot, run, essai, racine, temp, artefact } = ctx;
  if (!artefact) throw echec('entrees', 'ARTEFACT manquant (dossier de l\'artefact « preparation »)');

  // a. le lot
  journal(`lot ${lot} : téléchargement depuis ${ctx.adresse}`);
  const { octets, donnees } = await telechargerLot(ctx, outils);
  verifierSimulation(donnees, essai);
  const tables = tablesDuLot(donnees);
  const nbModifications = donnees.journal.lots.reduce((n, l) => n + (l.modifications?.length ?? 0), 0);
  journal(`empreinte vérifiée${essai ? ' (lot de simulation)' : ''} ; ${nbModifications} modification(s) en ${donnees.journal.lots.length} lot(s) ; tables du lot : ${tables.join(', ') || 'aucune'}`);
  rmSync(artefact, { recursive: true, force: true });
  mkdirSync(artefact, { recursive: true });
  writeFileSync(join(artefact, ARTEFACT.lot), octets);
  const fichierLot = join(temp, `lot-${lot}.json`);
  writeFileSync(fichierLot, octets);
  const commun = { format: FORMAT_PREPARATION, lot, empreinte: ctx.empreinte, essai, run };
  const publier = (p) => {
    writeFileSync(join(artefact, ARTEFACT.preparation), `${JSON.stringify({ ...commun, ...p }, null, 2)}\n`);
    return { ...commun, ...p };
  };

  // b. départ : le dépôt tel que récupéré par actions/checkout (fetch-depth: 0 : dev et master) ; aucun jeton ici pour le rafraîchir
  verifierDepart(g, lot);
  const deja = chercherLotDejaFusionne(g, lot);
  if (deja?.livre) {
    journal(`ce lot est déjà livré sur master (commit ${deja.commit.slice(0, 7)}) : rien à préparer.`);
    return publier({ etat: 'deja-livre', commit: deja.commit, version: deja.version });
  }
  if (deja) {
    journal(`reprise : ce lot est déjà dans dev (commit ${deja.commit.slice(0, 7)}${deja.pr ? `, PR #${deja.pr}` : ''}) : rien à rejouer, le job livrer reprend à la livraison.`);
    return publier({ etat: 'reprise', commit: deja.commit, version: deja.version, pr: deja.pr });
  }

  // c. le lot rejoué sur dev, contrôlé, commité
  const quand = horodatage(ctx.debut);
  const base = revision(g, `origin/${DEV}`);
  const branche = nomDeBranche(quand);
  journal(`${branche} depuis dev (${base.slice(0, 7)})`);
  g(['checkout', '--quiet', '-B', branche, `origin/${DEV}`]);
  const client = join(racine, 'client');
  const fichierResume = join(temp, 'resume.json');
  const regles = executer(process.execPath, ['--no-warnings', join(client, 'scripts', 'mise-a-jour-regles.mjs'), '--lot', fichierLot,
    '--reference', `origin/${MASTER}`, '--date', quand.jour, '--resume', fichierResume], { cwd: racine, env: environnementSansJeton() });
  const resume = lireJson(fichierResume);
  if (regles.code !== 0) {
    const action = ACTIONS_REGLES[regles.code];
    throw echec('lot', `le lot ne s'applique pas à dev (mise-a-jour-regles.mjs, code ${regles.code} : ${CODES_REGLES[regles.code] ?? 'erreur'}) : `
      + `${resume?.erreur ?? 'voir le journal ci-dessus'}.${action ? ` ${action}` : ''} Rien n'est poussé.`);
  }
  verifierResume(resume);
  const { version } = resume;
  const modifies = fichiersModifies(g);
  if (!modifies.length) {
    journal(`V${version} : aucun fichier de data/rows ne change, rien à livrer (aucune PR).`);
    return publier({ etat: 'rien', version });
  }
  const refuses = horsListe(modifies, resume.fichiers, tables);
  if (refuses.length) {
    throw echec('liste', `fichiers hors des tables de la mise à jour : ${refuses.join(', ')} (seuls data/rows/<table>.sql des tables du lot `
      + `[${tables.join(', ') || 'aucune'}] et de la note de version peuvent changer). Rien n'est poussé.`);
  }
  journal(`V${version} : ${resume.lignes ?? '?'} ligne(s) dans la note ; fichiers changés : ${modifies.join(', ')}`);

  // Ce qui est contrôlé est exactement ce qui sera commité : indexé AVANT les contrôles ; un contrôle qui réécrit ensuite un de ces fichiers
  // (contenu compris), en crée ou en supprime un autre, apparaît hors de l'index et arrête tout.
  g(['add', '--all', '--', ...modifies]);
  const indexes = fichiersIndexes(g);
  if (indexes.join('\n') !== modifies.join('\n')) throw echec('commit', `index inattendu (${indexes.join(', ')}) : rien n'est poussé.`);

  const dossierControles = join(temp, 'controles');
  mkdirSync(dossierControles, { recursive: true });
  const envControles = { ...environnementSansJeton(), RUNNER_TEMP: dossierControles };
  for (const commande of CONTROLES) {
    journal(`contrôle : ${commande}`);
    const c = executer('sh', ['-c', commande], { cwd: client, env: envControles });
    if (c.code !== 0) throw echec('controles', `« ${commande} » échoue (code ${c.code}) avec data/rows mis à jour : voir le journal ci-dessus. Rien n'est poussé.`);
  }
  const statut = g(STATUT).sortie;
  const salis = changementsNonIndexes(statut);
  const apres = lireStatut(statut);
  if (salis.length || apres.join('\n') !== modifies.join('\n')) {
    const autres = [...new Set([...salis, ...apres.filter((f) => !modifies.includes(f)), ...modifies.filter((f) => !apres.includes(f))])].sort();
    throw echec('controles', `les contrôles ont changé des fichiers (${autres.join(', ')}) : rien n'est poussé.`);
  }

  g([...SANS_HOOKS, ...IDENTITE_DU_BOT, 'commit', '--quiet', '--no-verify', '-m', messageDeCommit(version, lot), '-m', corpsDuCommit(lot, run)]);
  const commit = revision(g, 'HEAD');

  // d. l'artefact : le commit (bundle) et la préparation
  creerBundle(g, { base, commit, fichier: join(artefact, ARTEFACT.commit) });
  journal(`prêt : V${version}, commit ${commit.slice(0, 7)} sur dev ${base.slice(0, 7)}, contrôles verts ; artefact « ${NOM_ARTEFACT} » pour le job livrer`
    + (essai ? ' (simulation : il le vérifiera sans rien pousser)' : ''));
  return publier({
    etat: 'pret', base, commit, version, depuis: resume.depuis ?? null, lignes: resume.lignes ?? null, fichiers: modifies, markdown: resume.markdown, quand,
  });
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Phase « dev » (job livrer, étape « Fusion dans dev »)
// ---------------------------------------------------------------------------------------------------------------------------------------------

/**
 * Simulation : le jeton peut-il pousser (git push --dry-run : la découverte receive-pack exige l'écriture sur Contents) et lire les PR ? Rien
 * n'est envoyé. Rend la liste de ce qui est vérifié.
 */
export async function verifierJeton(ctx, branche) {
  const r = ctx.g([...SANS_HOOKS, 'push', '--dry-run', '--quiet', 'origin', `HEAD:refs/heads/${branche}`], { ok: [0, 1, 128] });
  if (r.code !== 0) {
    throw echec('jeton', `git push --dry-run refusé (${String(r.erreur || r.sortie).trim() || `code ${r.code}`}) : le jeton MISE_A_JOUR_TOKEN doit pouvoir écrire `
      + 'dans ce dépôt (Contents en lecture et écriture).');
  }
  const l = await sonder(() => ctx.api.get('/pulls?state=open&per_page=1', { ecriture: true }));
  if (l.statut !== 200) throw echec('jeton', `lecture des PR avec le jeton MISE_A_JOUR_TOKEN : GitHub a répondu ${messageGithub(l)} (permission Pull requests attendue)`);
  return ['Contents en écriture (git push --dry-run authentifié par le jeton)', 'Pull requests en lecture (avec le jeton)'];
}

/**
 * g : pousse le commit (rejoué si dev a bougé), ouvre la PR vers dev, attend les checks verts et la fusionne. Si dev bouge pendant l'attente :
 * PR fermée, branche supprimée, nouvel essai sur le nouveau dev. Rend { etat: 'fusionne', pr, url, version, branche, fusion }.
 */
async function fusionnerLaPR(ctx, { preparation: p, tables }) {
  const { g, api, outils: { journal }, lot, run } = ctx;
  for (let essai = 1; essai <= ESSAIS; essai += 1) {
    if (essai > 1) rafraichir(g);
    const branche = nomDeBranche(p.quand, essai);
    const { tete: base, sha, rejoue } = appliquerSurDev(g, { preparation: p, branche, tables });
    journal(`essai ${essai}/${ESSAIS} : ${branche} sur dev (${base.slice(0, 7)})${rejoue ? ', commit rejoué (rebase textuel propre)' : ''}`);
    g([...SANS_HOOKS, 'push', '--quiet', 'origin', `HEAD:refs/heads/${branche}`]);
    journal(`poussé : ${branche} (${sha.slice(0, 7)})`);

    const pied = `Lot \`${lot}\` appliqué par le workflow « Mise à jour des règles »${run ? ` : ${run}` : ''}.`;
    const ouverture = await sonder(() => api.post('/pulls', { title: titreDev(p.version), head: branche, base: DEV, body: corpsDePR(p.markdown, pied) }));
    if (ouverture.statut !== 201) {
      const supprimee = await supprimerBranche(ctx, branche);
      throw echec('pr-dev', `ouverture de la PR vers dev : GitHub a répondu ${messageGithub(ouverture)} (le jeton MISE_A_JOUR_TOKEN a-t-il Pull requests en écriture ?) ; `
        + `la branche ${branche} ${supprimee ? 'poussée a été supprimée' : 'poussée n\'a pas pu être supprimée : la supprimer à la main'}. Rien n'est fusionné.`);
    }
    const pr = ouverture.donnees;
    journal(`PR #${pr.number} ouverte vers dev : ${pr.html_url}`);

    const checks = await attendreChecks(ctx, sha);
    if (!checks.ok) {
      const texte = texteDesChecks(checks, ctx.delais);
      await commenter(ctx, pr.number, `La mise à jour automatique s'arrête : ${texte}.\n\nLa PR reste ouverte et n'est pas fusionnée. `
        + 'Une fois le problème réglé, relancer le workflow « Mise à jour des règles » (cette PR sera alors fermée et le lot rejoué), ou fusionner à la main (« Create a merge commit ») puis livrer dev → master.');
      throw echec('checks-dev', `PR #${pr.number} (${pr.html_url}) : ${texte}`, { pr: pr.number });
    }
    journal(`PR #${pr.number} : checks verts (${checks.reussis.join(', ')})`);

    const etat = await attendreFusionnable(ctx, pr.number);
    if (etat.etat === 'fermee') {
      throw echec('pr-dev', etat.pr?.merged
        ? `la PR #${pr.number} a été fusionnée à la main pendant l'attente : relancer le workflow, il reprendra à la livraison dev → master`
        : `la PR #${pr.number} a été fermée pendant l'attente : rien n'est fusionné`, { pr: pr.number });
    }
    let raison;
    if (etat.etat === 'conflit') {
      raison = 'GitHub la dit non fusionnable (dev a bougé).';
    } else {
      const tete = exiger(await api.get(`/git/ref/heads/${DEV}`), [200], 'lecture de dev', 'pr-dev')?.object?.sha;
      if (tete !== base) {
        raison = `dev a bougé pendant l'attente (${base.slice(0, 7)} → ${String(tete).slice(0, 7)}) : les contrôles ne portent plus sur ce qui serait fusionné.`;
      } else {
        const f = await fusionner(ctx, pr.number, sha, {
          titre: `Merge pull request #${pr.number} from ${ctx.proprietaire}/${branche}`, message: `${titreDev(p.version)} (lot ${lot})`,
        });
        if (f.ok) {
          journal(`PR #${pr.number} fusionnée dans dev (${String(f.sha).slice(0, 7)})`);
          return { etat: 'fusionne', pr: pr.number, url: pr.html_url, version: p.version, branche, fusion: f.sha };
        }
        raison = `GitHub a refusé la fusion (${f.statut}${f.message ? ` : ${f.message}` : ''}).`;
      }
    }
    await abandonnerPR(ctx, pr.number, branche, raison);
    journal(`PR #${pr.number} fermée, branche supprimée : ${raison}${essai < ESSAIS ? ' Nouvel essai sur le nouveau dev.' : ''}`);
  }
  throw echec('pr-dev', `dev a bougé à chacun des ${ESSAIS} essais : rien n'est fusionné. Relancer le workflow quand dev sera calme.`);
}

/**
 * e à g. `entrees` : { lot, empreinte, adresse, essai, depot, jeton, jetonLecture, run, artefact, debut, hoteAttendu, delais } ; `outils` :
 * { fetch, git, attendre, journal } (aucune commande : ni npm ni code du dépôt). Rend { etat: 'fusionne' | 'rien' | 'deja-livre' | 'essai', … }.
 */
export async function fusionDansDev(entrees, outils) {
  const ctx = contexte(entrees, outils, { avecJeton: true });
  const { g, outils: { journal }, lot, essai } = ctx;
  const { tables, preparation: p } = lireArtefact(ctx.artefact, ctx);
  journal(`artefact « ${NOM_ARTEFACT} » : lot vérifié par l'empreinte de l'entrée${essai ? ' (lot de simulation)' : ''} ; préparation : ${p.etat}`);
  rafraichir(g);
  verifierDepart(g, lot);

  const deja = chercherLotDejaFusionne(g, lot);
  if (deja?.livre) {
    journal(`ce lot est déjà livré sur master (commit ${deja.commit.slice(0, 7)}) : rien à faire.`);
    return { etat: 'deja-livre', commit: deja.commit, version: deja.version };
  }
  if (deja) {
    if (!deja.pr || !deja.version) {
      throw echec('reprise', `ce lot est déjà dans dev (commit ${deja.commit.slice(0, 7)}) mais sa PR de fusion est introuvable : livrer dev → master à la main.`);
    }
    journal(`reprise : ce lot est déjà fusionné dans dev par la PR #${deja.pr} (V${deja.version})`);
    if (essai) {
      const verifie = await verifierJeton(ctx, nomDeBranche(horodatage(ctx.debut)));
      return { etat: 'essai', reprise: true, version: deja.version, pr: deja.pr, verifie, nonVerifie: NON_VERIFIABLE };
    }
    return { etat: 'fusionne', reprise: true, pr: deja.pr, version: deja.version };
  }
  if (p.etat === 'reprise' || p.etat === 'deja-livre') {
    throw echec('artefact', `la préparation a trouvé ce lot ${p.etat === 'reprise' ? 'dans dev' : 'sur master'}, il n'y est plus : relancer tous les jobs du run (Re-run all jobs).`);
  }
  if (p.etat === 'rien') {
    journal(`V${p.version} : aucun fichier de data/rows ne change, rien à livrer.`);
    if (essai) return { etat: 'essai', rien: true, version: p.version, verifie: await verifierJeton(ctx, nomDeBranche(horodatage(ctx.debut))), nonVerifie: NON_VERIFIABLE };
    return { etat: 'rien', version: p.version };
  }

  // e. le commit de l'artefact, revérifié par git
  importerCommit(g, join(ctx.artefact, ARTEFACT.commit), p);
  verifierCommit(g, { base: p.base, commit: p.commit, tables, fichiers: p.fichiers, message: messageAttendu(p.version, lot, ctx.run) });
  journal(`commit ${p.commit.slice(0, 7)} vérifié : parent ${p.base.slice(0, 7)}, fichiers ${p.fichiers.join(', ')} (tables du lot et de la note de version)`);

  if (essai) {
    // f à blanc, puis le jeton : rien n'est poussé, aucune PR n'est ouverte ni fermée
    const branche = nomDeBranche(p.quand);
    const a = appliquerSurDev(g, { preparation: p, branche, tables });
    journal(a.rejoue
      ? `dev a bougé depuis la préparation (${p.base.slice(0, 7)} → ${a.tete.slice(0, 7)}) : le commit s'y rejoue proprement (rebase textuel)`
      : 'dev n\'a pas bougé depuis la préparation : le commit s\'applique tel quel');
    const verifie = await verifierJeton(ctx, branche);
    journal(`simulation : vérifié : ${verifie.join(' ; ')} ; non vérifiable sans effet de bord : ${NON_VERIFIABLE.join(' ; ')}. Rien n'est poussé.`);
    return { etat: 'essai', version: p.version, fichiers: p.fichiers, markdown: p.markdown, rejoue: a.rejoue, verifie, nonVerifie: NON_VERIFIABLE };
  }

  await fermerAnciennesPR(ctx);
  return fusionnerLaPR(ctx, { preparation: p, tables });
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Phase « master » (job livrer, étape « Livraison vers master »)
// ---------------------------------------------------------------------------------------------------------------------------------------------

/** Étape c : le commit de version que livraison.yml pousse sur dev après la fusion de la PR `numero`. Rend { sha, version }. */
export async function attendreCommitDeVersion(ctx, numero) {
  const { api, outils: { attendre, journal }, delais } = ctx;
  const suffixe = `(PR #${numero})`;
  let attendu = 0;
  journal(`attente du commit de version de livraison.yml sur dev (« chore: version v… ${suffixe} »)`);
  for (;;) {
    const r = await sonder(() => api.get(`/commits?sha=${DEV}&per_page=100`));
    if (r.statut === 200 && Array.isArray(r.donnees)) {
      for (const c of r.donnees) {
        const sujet = String(c?.commit?.message ?? '').split('\n')[0];
        const m = /^chore: version v(\d+\.\d+\.\d+) /.exec(sujet);
        if (m && sujet.endsWith(suffixe)) {
          journal(`dev en v${m[1]} (${String(c.sha).slice(0, 7)})`);
          return { sha: c.sha, version: m[1] };
        }
      }
    }
    if (attendu >= delais.version) {
      throw echec('version-dev', `livraison.yml n'a pas posé sur dev la version de la PR #${numero} en ${Math.round(delais.version / 60_000)} min `
        + `(commit « chore: version v… ${suffixe} » attendu ; voir Actions → Version et livraison). La livraison dev → master n'est pas faite : `
        + 'relancer ce workflow (il reprendra ici) ou ouvrir la PR dev → master à la main une fois la version posée.', { pr: numero });
    }
    await attendre(delais.intervalleVersion);
    attendu += delais.intervalleVersion;
  }
}

const MAJEURE_AJOUTEE = 'le titre ou la description porte le marqueur de version majeure (V: X+1) : une version majeure est le signal du '
  + 'propriétaire, la fusion lui est laissée (à faire à la main, « Create a merge commit »)';
const MAJEURE_OUVERTE = (numero) => `une PR de livraison dev → master est déjà ouverte avec [V: X+1] (#${numero}) : une version majeure est le signal `
  + 'du propriétaire, à fusionner (ou fermer) à la main';

/** Étape d : la PR de livraison dev → master (ou celle déjà ouverte, sans [V: X+1]), checks verts, fusion par commit de fusion avec sha. */
export async function livrerSurMaster(ctx, dev) {
  const { api, outils: { journal }, lot, run } = ctx;
  const titre = titreLivraison(dev.version);
  const corps = corpsDePR(dev.markdown, `Livraison automatique après la fusion de la PR #${dev.pr} dans dev (lot \`${lot}\`, workflow « Mise à jour des règles »${run ? ` : ${run}` : ''}).`);
  if (demandeMajeure(titre, corps)) throw echec('pr-master', 'le titre ou le corps de la livraison porte [V: X+1]');
  let pr;
  const r = await api.post('/pulls', { title: titre, head: DEV, base: MASTER, body: corps });
  if (r.statut === 201) {
    pr = r.donnees;
    journal(`PR de livraison #${pr.number} ouverte vers master : ${pr.html_url}`);
  } else if (r.statut === 422 && /already exists/i.test(JSON.stringify(r.donnees ?? ''))) {
    const ouvertes = exiger(await api.get(`/pulls?state=open&base=${MASTER}&head=${encodeURIComponent(`${ctx.proprietaire}:${DEV}`)}`), [200],
      'lecture des PR de livraison ouvertes', 'pr-master');
    pr = Array.isArray(ouvertes) ? ouvertes[0] : null;
    if (!pr) throw echec('pr-master', `ouverture de la PR de livraison : GitHub a répondu ${messageGithub(r)}`);
    if (demandeMajeure(pr.title, pr.body)) throw echec('pr-master', MAJEURE_OUVERTE(pr.number), { pr: pr.number });
    journal(`PR de livraison déjà ouverte : #${pr.number} (${pr.html_url}), reprise`);
  } else {
    exiger(r, [201], 'ouverture de la PR de livraison dev → master', 'pr-master');
  }

  const arreter = async (texte) => {
    await commenter(ctx, pr.number, `La livraison automatique s'arrête : ${texte}.\n\nLa PR reste ouverte : la fusionner à la main (« Create a merge commit ») une fois le problème réglé, ou relancer le workflow « Mise à jour des règles » (il reprendra à la livraison).`);
    return echec('pr-master', `PR de livraison #${pr.number} (${pr.html_url}) : ${texte}`, { pr: pr.number });
  };
  for (let essai = 1; essai <= ESSAIS; essai += 1) {
    const lue = exiger(await api.get(`/pulls/${pr.number}`), [200], `lecture de la PR #${pr.number}`, 'pr-master');
    if (lue.state !== 'open') throw echec('pr-master', `la PR de livraison #${pr.number} a été fermée`, { pr: pr.number });
    if (demandeMajeure(lue.title, lue.body)) throw await arreter(MAJEURE_AJOUTEE);
    const sha = lue.head.sha;
    const checks = await attendreChecks(ctx, sha);
    if (!checks.ok) throw await arreter(texteDesChecks(checks, ctx.delais));
    journal(`PR #${pr.number} : checks verts sur dev ${sha.slice(0, 7)} (${checks.reussis.join(', ')})`);
    const etat = await attendreFusionnable(ctx, pr.number);
    if (etat.etat === 'fermee') throw echec('pr-master', `la PR de livraison #${pr.number} a été fermée`, { pr: pr.number });
    if (etat.etat === 'conflit') throw await arreter('GitHub la dit non fusionnable (conflit entre dev et master)');
    // Relu juste avant la fusion : le marqueur ajouté entre-temps (titre ou description modifiés) ferait une version majeure.
    if (etat.pr && demandeMajeure(etat.pr.title, etat.pr.body)) throw await arreter(MAJEURE_AJOUTEE);
    if (etat.pr?.head?.sha && etat.pr.head.sha !== sha) {
      journal(`dev a bougé (${sha.slice(0, 7)} → ${etat.pr.head.sha.slice(0, 7)}) : nouvelle attente des checks`);
      continue;
    }
    const f = await fusionner(ctx, pr.number, sha, { titre: `Merge pull request #${pr.number} from ${ctx.proprietaire}/${DEV}`, message: lue.title ?? titre });
    if (f.ok) {
      journal(`PR de livraison #${pr.number} fusionnée dans master (${String(f.sha).slice(0, 7)}) : livraison.yml pose la version, les étiquettes et la publication`);
      return { pr: pr.number, url: pr.html_url, fusion: f.sha };
    }
    if (f.statut !== 409) throw await arreter(`GitHub a refusé la fusion (${f.statut}${f.message ? ` : ${f.message}` : ''})`);
    journal(`dev a bougé pendant la fusion (409) : nouvelle attente des checks`);
  }
  throw await arreter(`dev a bougé à chacun des ${ESSAIS} essais de fusion`);
}

/** Simulation de la livraison : lectures seulement (une PR de livraison ouverte avec [V: X+1] arrêterait la vraie). */
async function verifierLivraisonPossible(ctx) {
  const r = await sonder(() => ctx.api.get(`/pulls?state=open&base=${MASTER}&head=${encodeURIComponent(`${ctx.proprietaire}:${DEV}`)}`));
  if (r.statut !== 200 || !Array.isArray(r.donnees)) throw echec('pr-master', `lecture des PR de livraison ouvertes : GitHub a répondu ${messageGithub(r)}`);
  const majeure = r.donnees.find((p) => demandeMajeure(p.title, p.body));
  if (majeure) throw echec('pr-master', MAJEURE_OUVERTE(majeure.number), { pr: majeure.number });
  ctx.outils.journal(`simulation : master est dans dev${r.donnees.length ? `, la PR de livraison #${r.donnees[0].number} déjà ouverte serait reprise` : ', la PR de livraison serait ouverte'} ; `
    + `non vérifiable sans effet de bord : ${NON_VERIFIABLE.join(' ; ')}. Rien n'est ouvert ni fusionné.`);
}

/**
 * h. Repart de dev : le lot doit y être (fusionné par l'étape « Fusion dans dev », ou par un passage précédent). Rend
 * { etat: 'livre' | 'rien' | 'deja-livre' | 'essai', … }. Mêmes entrées et outils que fusionDansDev.
 */
export async function livraisonVersMaster(entrees, outils) {
  const ctx = contexte(entrees, outils, { avecJeton: true });
  const { g, outils: { journal }, lot, essai } = ctx;
  const { donnees, preparation: p } = lireArtefact(ctx.artefact, ctx);
  rafraichir(g);
  verifierDepart(g, lot);
  const deja = chercherLotDejaFusionne(g, lot);
  if (deja?.livre) {
    journal(`ce lot est déjà livré sur master (commit ${deja.commit.slice(0, 7)}) : rien à faire.`);
    return { etat: 'deja-livre', commit: deja.commit, version: deja.version };
  }
  if (!deja) {
    if (p.etat === 'rien') return { etat: 'rien', version: p.version };
    if (essai) {
      await verifierLivraisonPossible(ctx);
      return { etat: 'essai', version: p.version ?? null, nonVerifie: NON_VERIFIABLE };
    }
    throw echec('reprise', 'ce lot n\'est pas dans dev : l\'étape « Fusion dans dev » ne l\'a pas fusionné, rien n\'est livré.');
  }
  if (!deja.pr || !deja.version) {
    throw echec('reprise', `ce lot est déjà dans dev (commit ${deja.commit.slice(0, 7)}) mais sa PR de fusion est introuvable : livrer dev → master à la main.`);
  }
  if (essai) {
    await verifierLivraisonPossible(ctx);
    return { etat: 'essai', reprise: true, version: deja.version, pr: deja.pr, nonVerifie: NON_VERIFIABLE };
  }
  journal(`le lot est dans dev (PR #${deja.pr}, V${deja.version}) : livraison dev → master`);
  const prDev = exiger(await ctx.api.get(`/pulls/${deja.pr}`), [200], `lecture de la PR #${deja.pr}`, 'reprise');
  const dev = { pr: deja.pr, url: prDev.html_url, version: deja.version, markdown: noteDuCorps(prDev.body) };
  if (donnees.version_cible && donnees.version_cible !== dev.version) {
    journal(`avertissement : la page annonçait la V${donnees.version_cible}, la livraison sera la V${dev.version} (master a changé entre-temps)`);
  }
  // c. la version de la feature, posée par livraison.yml ; d. la livraison dev → master
  const versionDev = await attendreCommitDeVersion(ctx, dev.pr);
  const master = await livrerSurMaster(ctx, dev);
  return { etat: 'livre', version: dev.version, prDev: dev.pr, urlDev: dev.url, versionDev: versionDev.version, prMaster: master.pr, urlMaster: master.url };
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Exécution dans le workflow
// ---------------------------------------------------------------------------------------------------------------------------------------------

export const attendreVraiment = (ms) => new Promise((r) => { setTimeout(r, ms); });

/** L'en-tête qu'actions/checkout pose pour un jeton (jeton du workflow ou jeton personnel). */
export const enteteAuthentification = (jeton) => `AUTHORIZATION: basic ${Buffer.from(`x-access-token:${jeton}`).toString('base64')}`;

/** La sous-commande git d'une liste d'arguments (après les « -c clé=valeur »). */
export function sousCommandeGit(args) {
  let i = 0;
  while (args[i] === '-c') i += 2;
  return args[i] ?? null;
}

/**
 * L'environnement d'une commande git : jamais d'invite (GIT_TERMINAL_PROMPT=0), sans les jetons du script ; pour fetch (jeton de lecture, sinon
 * GH_TOKEN) et push (GH_TOKEN) seulement, l'en-tête d'authentification par GIT_CONFIG_* : ni sur la ligne de commande (visible dans ps), ni dans
 * .git/config.
 */
export function environnementGit(args, { jeton = null, jetonLecture = null, serveur = 'https://github.com', env = process.env } = {}) {
  const resultat = { ...env, GIT_TERMINAL_PROMPT: '0' };
  delete resultat.GH_TOKEN;
  delete resultat.GITHUB_TOKEN_LECTURE;
  const sous = sousCommandeGit(args);
  const cle = sous === 'push' ? jeton : sous === 'fetch' ? jetonLecture || jeton : null;
  if (cle) {
    const n = Number.parseInt(resultat.GIT_CONFIG_COUNT ?? '0', 10) || 0;
    resultat[`GIT_CONFIG_KEY_${n}`] = `http.${String(serveur).replace(/\/+$/, '')}/.extraheader`;
    resultat[`GIT_CONFIG_VALUE_${n}`] = enteteAuthentification(cle);
    resultat.GIT_CONFIG_COUNT = String(n + 1);
  }
  return resultat;
}

/** git dans le dépôt : { code, sortie, erreur }. `jetons` : { jeton, jetonLecture, serveur } pour fetch et push (environnementGit). */
export function gitLocal(racine = RACINE, jetons = {}) {
  return (args) => {
    const r = spawnSync('git', args, { cwd: racine, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, env: environnementGit(args, jetons) });
    if (r.error) throw r.error;
    return { code: r.status, sortie: r.stdout, erreur: r.stderr };
  };
}

/**
 * Une commande dont la sortie va au journal du workflow : { code }. Dans GitHub Actions, sa sortie (où passent des textes du lot : résumés, conflits,
 * tests) ne peut pas émettre de commandes de workflow (« ::…:: ») : elles sont suspendues le temps de la commande (::stop-commands::).
 */
export function executerLocal(commande, args, { cwd, env } = {}) {
  const pause = process.env.GITHUB_ACTIONS === 'true' ? randomUUID() : null;
  if (pause) console.log(`::stop-commands::${pause}`);
  try {
    const r = spawnSync(commande, args, { cwd, env, stdio: 'inherit' });
    if (r.error) {
      console.error(`${commande} : ${r.error.message}`);
      return { code: 127 };
    }
    return { code: r.status ?? 1 };
  } finally {
    if (pause) console.log(`::${pause}::`);
  }
}

/** Une ligne pour une commande de workflow (::error::…) : %, CR et LF encodés, comme le fait @actions/core. */
export const pourCommandeDeWorkflow = (texte) => String(texte).replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');

/** La phase demandée (--phase preparer | dev | master). */
export function lirePhase(args) {
  const i = args.indexOf('--phase');
  const phase = i >= 0 ? args[i + 1] : null;
  if (!PHASES.includes(phase)) throw echec('entrees', `--phase ${PHASES.join(' | ')} attendu`);
  return phase;
}

const TITRES = { preparer: 'préparation', dev: ETAPES_DE_LIVRER.dev, master: ETAPES_DE_LIVRER.master };

/** Le message de fin d'une phase, pour le journal et le résumé du run. */
export function messageDeFin(phase, r) {
  const simulation = (texte) => `**Simulation (${TITRES[phase]}) réussie** : ${texte}${r.verifie?.length ? ` Vérifié : ${r.verifie.join(' ; ')}.` : ''}`
    + `${r.nonVerifie?.length ? ` Non vérifiable sans effet de bord : ${r.nonVerifie.join(' ; ')}.` : ''} Rien n'a été poussé, aucune PR ouverte ni fermée.`;
  const communs = {
    rien: '**Rien à livrer** : le lot ne change aucune ligne de data/rows.',
    'deja-livre': '**Déjà livré** : ce lot est sur master, rien n\'a été fait.',
  };
  if (communs[r.etat]) return communs[r.etat];
  if (phase === 'preparer') {
    if (r.etat === 'reprise') return `**Reprise** : ce lot est déjà dans dev (commit ${String(r.commit).slice(0, 7)}) ; le job livrer reprend à la livraison dev → master.`;
    return `**Préparé** : V${r.version}, ${r.fichiers.length} fichier(s) de data/rows, ${CONTROLES.length} contrôles verts (dont tout le job client de ci.yml) ; `
      + `commit ${r.commit.slice(0, 7)} sur dev ${r.base.slice(0, 7)}, publié dans l'artefact « ${NOM_ARTEFACT} »${r.essai ? ' (simulation : le job livrer le vérifie sans rien pousser)' : ''}.`;
  }
  if (phase === 'dev') {
    if (r.etat === 'essai') {
      if (r.reprise) return simulation(`le lot est déjà fusionné dans dev (PR #${r.pr}) ; un vrai passage reprendrait à la livraison dev → master.`);
      if (r.rien) return simulation(`V${r.version} : le lot ne change aucune ligne de data/rows, un vrai passage ne livrerait rien.`);
      return simulation(`V${r.version}, artefact et liste blanche vérifiés (${r.fichiers.length} fichier(s)), commit appliqué à blanc sur dev `
        + `(${r.rejoue ? 'dev a bougé : rebase textuel propre' : 'tel quel'}).`);
    }
    return `**Fusionné dans dev** : V${r.version} — PR #${r.pr}${r.reprise ? ' (passage précédent)' : ''} ; la livraison vers master suit.`;
  }
  if (r.etat === 'essai') return simulation(r.reprise ? `le lot est dans dev (PR #${r.pr}) ; la livraison dev → master serait ouverte.` : 'la livraison dev → master serait possible.');
  return `**Terminé** : V${r.version} — PR #${r.prDev} fusionnée dans dev (v${r.versionDev}), puis PR de livraison #${r.prMaster} fusionnée dans master ; `
    + `livraison.yml pose la version V${r.version}, ses étiquettes et la publication.`;
}

async function main() {
  const env = process.env;
  const resumeGithub = env.GITHUB_STEP_SUMMARY;
  const ecrire = (texte) => { if (resumeGithub) appendFileSync(resumeGithub, texte); };
  // Une ligne du journal reste une ligne : aucun texte ne peut commencer une commande de workflow (« ::… ») en début de ligne.
  const journal = (texte) => { const ligne = String(texte).replace(/\r?\n|\r/g, ' '); console.log(ligne); ecrire(`- ${ligne}\n`); };
  const essai = env.ESSAI === 'true';
  const serveur = env.GITHUB_SERVER_URL || 'https://github.com';
  const temp = mkdtempSync(join(env.RUNNER_TEMP || tmpdir(), 'mise-a-jour-'));
  let phase = 'preparer';
  try {
    phase = lirePhase(process.argv.slice(2));
    const jeton = env.GH_TOKEN || null;
    const jetonLecture = env.GITHUB_TOKEN_LECTURE || null;
    if (env.GITHUB_ACTIONS === 'true') {
      // Les formes encodées des jetons (en-têtes de git) sont masquées comme les secrets eux-mêmes.
      for (const j of [jeton, jetonLecture]) if (j) console.log(`::add-mask::${Buffer.from(`x-access-token:${j}`).toString('base64')}`);
    }
    ecrire(`### Mise à jour des règles — ${TITRES[phase]}${essai ? ' (simulation)' : ''}\n\n`);
    const entrees = {
      lot: env.LOT, empreinte: env.EMPREINTE, adresse: env.ADRESSE, essai, depot: env.GITHUB_REPOSITORY, hoteAttendu: env.HOTE_ATTENDU || null,
      racine: RACINE, temp, artefact: env.ARTEFACT || null, debut: new Date(), jeton, jetonLecture,
      run: env.GITHUB_RUN_ID ? `${serveur}/${env.GITHUB_REPOSITORY}/actions/runs/${env.GITHUB_RUN_ID}` : null,
    };
    let r;
    if (phase === 'preparer') {
      r = await preparer(entrees, { fetch: globalThis.fetch, git: gitLocal(RACINE), executer: executerLocal, journal });
    } else {
      const outils = { fetch: globalThis.fetch, git: gitLocal(RACINE, { jeton, jetonLecture, serveur }), attendre: attendreVraiment, journal };
      r = phase === 'dev' ? await fusionDansDev(entrees, outils) : await livraisonVersMaster(entrees, outils);
    }
    const fin = messageDeFin(phase, r);
    console.log(fin.replace(/\*\*/g, ''));
    ecrire(`\n${fin}\n`);
    if (phase === 'dev' && r.etat === 'essai' && r.markdown) {
      ecrire(`\n<details><summary>Note de version qui serait livrée (V${r.version})</summary>\n\n${neutraliserTexte(r.markdown)}\n\n</details>\n`);
    }
  } catch (e) {
    const texte = e instanceof ErreurMiseAJourGithub ? `Échec${e.etape ? ` (${e.etape})` : ''} : ${e.message}` : `Échec inattendu : ${e.stack || e.message}`;
    console.error(env.GITHUB_ACTIONS === 'true' ? `::error::${pourCommandeDeWorkflow(texte)}` : texte);
    ecrire(`\n**${texte}**\n`);
    process.exitCode = 1;
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
