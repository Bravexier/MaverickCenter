#!/usr/bin/env node
// Mise à jour des règles depuis le site de dev (page « Mise à jour », docs/serveur.md) : l'orchestration côté GitHub, lancée par le workflow
// .github/workflows/mise-a-jour.yml (workflow_dispatch : lot, empreinte, adresse, essai) que le service déclenche sur dev après « Effectuer la
// mise à jour » et sa confirmation (serveur/notes-de-version.mjs : figerLot, creerGithub). Demande du propriétaire : « rebase, création d'une
// nouvelle PR incluant toutes les modifications de la DB, sa validation automatique si aucun conflit et erreur sur dev, puis juste après la
// fusion, le merge de dev vers master » ; et aucune autre table que celles de la mise à jour ne doit changer.
//
//   a. télécharge le lot figé (adresse) et vérifie son empreinte SHA-256 (octets tels que servis) ;
//   b. jusqu'à ESSAIS fois : feature/mise-a-jour-regles-<AAAAMMJJ-HHMM> depuis origin/dev ; scripts/mise-a-jour-regles.mjs rejoue le lot sur
//      data/rows (conflit ou autre refus : arrêt, rien n'est poussé) ; double contrôle de la liste blanche (seuls data/rows/<table>.sql des
//      tables du lot et de la note de version changent, et seulement ceux que mise-a-jour-regles annonce) ; contrôles rapides (db:build,
//      db:check, npm test) ; simulation de mise à jour (entrée « essai ») : arrêt ici. Puis commit (github-actions[bot]), poussée, PR vers dev, attente des checks requis
//      VERTS sur le commit de tête (CHECKS_REQUIS), fusion par commit de fusion avec sha. Si dev a bougé (PR non fusionnable, 405, 409, ou dev
//      n'est plus le point de départ de la branche) : PR fermée, branche supprimée, et le lot est rejoué sur le nouveau dev. C'est le « rebase » :
//      un rejeu plutôt qu'un rebase textuel des .sql, et les contrôles portent ainsi exactement sur ce qui est fusionné ;
//   c. attend sur dev le commit de version de livraison.yml (« chore: version vX.Y.Z (feature …) (PR #n) ») : la PR de livraison ne part
//      qu'après, sinon la version de la feature se mêlerait à la livraison ;
//   d. ouvre la PR de livraison dev → master (jamais de [V: X+1] : signal du propriétaire seulement), attend ses checks verts et la fusionne par
//      commit de fusion avec sha ; livraison.yml pose ensuite la version X.Y.0, les étiquettes et la publication.
//   Relancer le workflow avec le même lot reprend où il s'est arrêté : un lot déjà fusionné dans dev (son commit porte « Lot : <id> ») passe
//   directement à c et d ; un lot déjà livré sur master ne fait rien ; une PR restée ouverte d'un passage précédent du même lot est fermée.
//
// Jetons. GH_TOKEN (secret MISE_A_JOUR_TOKEN : jeton personnel fine-grained du propriétaire, administrateur, limité à ce dépôt, Contents,
// Pull requests et Workflows en écriture) pour tout ce qui écrit : les événements créés avec le jeton du workflow ne déclenchent aucun autre
// workflow (une PR ouverte par lui n'aurait pas de CI, une fusion faite par lui ne lancerait pas livraison.yml). Les lectures passent par
// GITHUB_TOKEN_LECTURE (le jeton du workflow, permissions en lecture seule) s'il est fourni, sinon par GH_TOKEN. Aucun jeton n'est écrit sur le
// disque : le checkout se fait sans persist-credentials, et git ne reçoit l'en-tête d'authentification que pour fetch (jeton de lecture) et push
// (GH_TOKEN), par l'environnement de cette seule commande (gitLocal) ; npm et mise-a-jour-regles.mjs (dépendances npm, code du dépôt) n'en voient
// aucun, ni dans leur environnement ni dans .git/config.
// Les règles GitHub (rulesets) ne s'appliquent pas à ce dépôt privé (pas d'abonnement) : rien n'empêcherait de fusionner une PR rouge, d'où
// l'attente explicite des checks verts ici, et la fusion avec sha= (refusée si la tête a bougé).
//
// Node 22, aucun paquet npm (fetch natif, git par child_process). Toutes les étapes sont des fonctions exportées qui reçoivent leurs outils
// ({ fetch, git, executer, attendre, journal }) : test/mise-a-jour-github.test.mjs les rejoue avec un GitHub, un git et des commandes simulés.
import { spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { appendFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEV, MARQUEUR_MAJEURE, MASTER, demandeMajeure, familleDe } from '../../tools/flux-git/regles.mjs';

const RACINE = fileURLToPath(new URL('../../', import.meta.url));

/** Les checks qui doivent être verts sur le commit de tête avant une fusion (ci.yml : client, character-service ; garde-branches.yml). */
export const CHECKS_REQUIS = ['client', 'character-service', 'regles-de-branches'];
/** Applications du lot sur dev (la première, puis une par mouvement de dev pendant l'attente). */
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
/** Contrôles rapides avant de pousser (npm, dans client/). La CI de la PR refait tout, build compris. */
export const CONTROLES = [['run', 'db:build'], ['run', 'db:check'], ['test']];
/** Codes de sortie de scripts/mise-a-jour-regles.mjs. */
export const CODES_REGLES = {
  2: 'lot illisible',
  3: 'conflit avec dev',
  4: 'un fichier hors des tables autorisées changerait',
  5: 'clés étrangères rompues',
  6: 'base de production (master) introuvable',
};
/** Heure des noms de branche et date de la note : celle du propriétaire. */
export const FUSEAU = 'Europe/Paris';
const BOT = { nom: 'github-actions[bot]', courriel: '41898282+github-actions[bot]@users.noreply.github.com' };
/** Conclusions d'un check qui ne comptent ni pour ni contre (un job sauté par son `if:`, comme regles-de-branches sur l'événement create). */
const SANS_AVIS = new Set(['skipped', 'neutral']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const BRANCHE_DU_WORKFLOW = /^feature\/mise-a-jour-regles-[0-9]{8}-[0-9]{4}(?:-[0-9]+)?$/;

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
 * facultative) : l'hôte du site de dev, seul permis.
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
  const calculee = createHash('sha256').update(octets).digest('hex');
  if (calculee !== empreinte) {
    throw echec('lot', `empreinte du lot différente (attendue ${empreinte}, calculée ${calculee}) : ce n'est pas le lot figé par le site de dev, rien n'est fait`);
  }
  let donnees;
  try {
    donnees = JSON.parse(octets.toString('utf8'));
  } catch {
    throw echec('lot', 'lot illisible (JSON invalide)');
  }
  if (donnees?.format !== 'maverick-mise-a-jour/1' || donnees.id !== lot || !Array.isArray(donnees.journal?.lots)) {
    throw echec('lot', 'lot illisible (format « maverick-mise-a-jour/1 » et identifiant du lot attendus)');
  }
  return { octets, donnees };
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
  const nom = `${PREFIXE_BRANCHE}${quand.branche}${essai > 1 ? `-${essai}` : ''}`;
  if (familleDe(nom) !== 'feature' || !BRANCHE_DU_WORKFLOW.test(nom)) throw echec('branche', `nom de branche invalide « ${nom} »`);
  return nom;
}

const MARQUEUR_GLOBAL = new RegExp(MARQUEUR_MAJEURE.source, 'gi');
/** Le marqueur de version majeure n'est jamais repris d'un texte (signal du propriétaire seulement) : « (V: X+1) » à la place. */
export const neutraliserMarqueur = (texte) => String(texte ?? '').replace(MARQUEUR_GLOBAL, '(V: X+1)');

/** Corps d'une PR : la note (sans [V: X+1]) coupée à MAX_CORPS, puis une ligne de pied (le lot, le run). */
export function corpsDePR(markdown, pied) {
  let texte = neutraliserMarqueur(markdown).trimEnd();
  if (texte.length > MAX_CORPS) {
    texte = `${texte.slice(0, MAX_CORPS).replace(/\n[^\n]*$/, '')}\n\n… note coupée à ${MAX_CORPS} caractères : la note complète est dans data/rows/note_version_ligne.sql.`;
  }
  const corps = `${texte}\n\n---\n${neutraliserMarqueur(pied)}\n`;
  if (demandeMajeure(corps)) throw echec('texte', 'le corps de la PR porte encore [V: X+1]');
  return corps;
}

/** La note seule, sans le pied qu'y ajoute corpsDePR (reprise : le corps de la PR vers dev redevient celui de la livraison). */
export function noteDuCorps(corps) {
  const texte = String(corps ?? '');
  const i = texte.lastIndexOf('\n\n---\n');
  return i < 0 ? texte : texte.slice(0, i);
}

export const titreDev = (version) => `Mise à jour des règles V${version} (site de dev)`;
export const titreLivraison = (version) => `Livraison V${version} (mise à jour du site de dev)`;
export const messageDeCommit = (version, lot) => `Mise à jour des règles V${version} (site de dev, lot ${lot.slice(0, 8)})`;

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

/**
 * Double contrôle de la liste blanche : un fichier changé doit être data/rows/<f> avec <f> annoncé par mise-a-jour-regles (`fichiers`) ET la
 * table d'une modification du lot ou de la note de version. Rend les chemins refusés.
 */
export function horsListe(chemins, fichiers, tables) {
  const annonces = new Set((fichiers ?? []).map((f) => `data/rows/${f}`));
  const permis = new Set([...(tables ?? []), ...TABLES_DE_LA_NOTE].map((t) => `data/rows/${t}.sql`));
  return chemins.filter((c) => !annonces.has(c) || !permis.has(c));
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

/** L'environnement des commandes lancées (mise-a-jour-regles, npm) : sans les jetons. */
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
  const commits = g(['log', 'origin/dev', '--fixed-strings', `--grep=Lot : ${lot}`, '--format=%H']).sortie.split('\n').map((s) => s.trim()).filter(Boolean);
  if (!commits.length) return null;
  const commit = commits.at(-1);
  const sujet = g(['log', '-1', '--format=%s', commit]).sortie.trim();
  const version = /\bV(\d+\.\d+)\b/.exec(sujet)?.[1] ?? null;
  const livre = g(['merge-base', '--is-ancestor', commit, 'origin/master'], { ok: [0, 1] }).code === 0;
  const fusion = g(['log', '--merges', '--ancestry-path', '--reverse', '--format=%H%x09%P%x09%s', `${commit}..origin/dev`]).sortie
    .split('\n').filter(Boolean).map((l) => l.split('\t')).find(([, parents = '']) => parents.split(' ').includes(commit));
  const pr = fusion ? Number(/^Merge pull request #(\d+) /.exec(fusion[2] ?? '')?.[1]) || null : null;
  return { commit, version, livre, pr };
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// API GitHub
// ---------------------------------------------------------------------------------------------------------------------------------------------

/** Client de l'API REST du dépôt : { statut, donnees } pour chaque appel ; GET avec le jeton de lecture s'il y en a un. */
export function creerApi({ fetch, depot, jeton, jetonLecture = null }) {
  const base = `https://api.github.com/repos/${depot}`;
  const appel = async (methode, chemin, corps) => {
    const r = await fetch(`${base}${chemin}`, {
      method: methode,
      signal: AbortSignal.timeout(DELAI_RESEAU),
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${methode === 'GET' && jetonLecture ? jetonLecture : jeton}`,
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
    get: (chemin) => appel('GET', chemin),
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
  const r = await sonder(() => ctx.api.post(`/issues/${numero}/comments`, { body: neutraliserMarqueur(texte) }));
  if (r.statut !== 201) ctx.outils.journal(`avertissement : commentaire sur la PR #${numero} impossible (${messageGithub(r)})`);
}

/** Ferme une PR du workflow et supprime sa branche (un nouvel essai, ou un passage précédent du même lot). */
async function abandonnerPR(ctx, numero, branche, raison) {
  await commenter(ctx, numero, `${raison}\n\nPR fermée par le workflow « Mise à jour des règles »${ctx.run ? ` (${ctx.run})` : ''} : le lot est rejoué sur le dev à jour.`);
  exiger(await ctx.api.patch(`/pulls/${numero}`, { state: 'closed' }), [200], `fermeture de la PR #${numero}`, 'pr-dev');
  if (!BRANCHE_DU_WORKFLOW.test(branche)) return;
  const s = await sonder(() => ctx.api.supprimer(`/git/refs/heads/${branche}`));
  if (![204, 404, 422].includes(s.statut)) ctx.outils.journal(`avertissement : branche ${branche} non supprimée (${messageGithub(s)})`);
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
// Étapes
// ---------------------------------------------------------------------------------------------------------------------------------------------

/**
 * Étape b : applique le lot sur une feature partie de dev, la pousse, ouvre la PR vers dev, attend les checks verts et la fusionne.
 * Rend { etat: 'fusionne', pr, url, version, markdown, branche, fusion } ; { etat: 'rien' } (aucun fichier ne change) ; { etat: 'essai', … }.
 */
export async function livrerSurDev(ctx, { fichierLot, tables }) {
  const { g, api, outils: { journal, executer }, racine, temp, lot, run } = ctx;
  const quand = horodatage(ctx.debut);
  const client = join(racine, 'client');
  for (let essai = 1; essai <= ESSAIS; essai += 1) {
    rafraichir(g);
    const base = g(['rev-parse', 'origin/dev']).sortie.trim();
    const branche = nomDeBranche(quand, essai);
    journal(`essai ${essai}/${ESSAIS} : ${branche} depuis dev (${base.slice(0, 7)})`);
    g(['checkout', '--quiet', '-B', branche, 'origin/dev']);

    const fichierResume = join(temp, `resume-${essai}.json`);
    const regles = executer(process.execPath, ['--no-warnings', join(client, 'scripts', 'mise-a-jour-regles.mjs'), '--lot', fichierLot,
      '--reference', 'origin/master', '--date', quand.jour, '--resume', fichierResume], { cwd: racine, env: environnementSansJeton() });
    const resume = lireJson(fichierResume);
    if (regles.code !== 0) {
      throw echec('lot', `le lot ne s'applique pas à dev (mise-a-jour-regles.mjs, code ${regles.code} : ${CODES_REGLES[regles.code] ?? 'erreur'}) : `
        + `${resume?.erreur ?? 'voir le journal ci-dessus'}. Rien n'est poussé.`);
    }
    verifierResume(resume);
    const { version } = resume;
    const modifies = fichiersModifies(g);
    if (!modifies.length) {
      journal(`V${version} : aucun fichier de data/rows ne change, rien à livrer (aucune PR).`);
      return { etat: 'rien', version };
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

    for (const args of CONTROLES) {
      journal(`contrôle : npm ${args.join(' ')}`);
      const c = executer('npm', args, { cwd: client, env: environnementSansJeton() });
      if (c.code !== 0) throw echec('controles', `npm ${args.join(' ')} échoue (code ${c.code}) avec data/rows mis à jour : voir le journal ci-dessus. Rien n'est poussé.`);
    }
    const statut = g(STATUT).sortie;
    const salis = changementsNonIndexes(statut);
    const apres = lireStatut(statut);
    if (salis.length || apres.join('\n') !== modifies.join('\n')) {
      const autres = [...new Set([...salis, ...apres.filter((f) => !modifies.includes(f)), ...modifies.filter((f) => !apres.includes(f))])].sort();
      throw echec('controles', `les contrôles ont changé des fichiers (${autres.join(', ')}) : rien n'est poussé.`);
    }
    if (ctx.essai) {
      journal(`simulation de mise à jour : V${version} prête sur ${branche}, contrôles verts ; arrêt avant le commit, rien n'est poussé.`);
      return { etat: 'essai', version, fichiers: modifies, markdown: resume.markdown, branche };
    }

    g(['-c', `user.name=${BOT.nom}`, '-c', `user.email=${BOT.courriel}`, 'commit', '--quiet', '--no-verify',
      '-m', messageDeCommit(version, lot), '-m', `Lot : ${lot}${run ? `\nRun : ${run}` : ''}\n\nAppliqué par le workflow « Mise à jour des règles » (.github/workflows/mise-a-jour.yml).`]);
    const sha = g(['rev-parse', 'HEAD']).sortie.trim();
    g(['push', '--quiet', 'origin', `HEAD:refs/heads/${branche}`]);
    journal(`poussé : ${branche} (${sha.slice(0, 7)})`);

    const pied = `Lot \`${lot}\` appliqué par le workflow « Mise à jour des règles »${run ? ` : ${run}` : ''}.`;
    const pr = exiger(await api.post('/pulls', { title: titreDev(version), head: branche, base: DEV, body: corpsDePR(resume.markdown, pied) }),
      [201], 'ouverture de la PR vers dev', 'pr-dev');
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
          titre: `Merge pull request #${pr.number} from ${ctx.proprietaire}/${branche}`, message: `${titreDev(version)} (lot ${lot})`,
        });
        if (f.ok) {
          journal(`PR #${pr.number} fusionnée dans dev (${String(f.sha).slice(0, 7)})`);
          return { etat: 'fusionne', pr: pr.number, url: pr.html_url, version, markdown: resume.markdown, branche, fusion: f.sha };
        }
        raison = `GitHub a refusé la fusion (${f.statut}${f.message ? ` : ${f.message}` : ''}).`;
      }
    }
    await abandonnerPR(ctx, pr.number, branche, raison);
    journal(`PR #${pr.number} fermée, branche supprimée : ${raison}${essai < ESSAIS ? ' Nouvel essai depuis le nouveau dev.' : ''}`);
  }
  throw echec('pr-dev', `dev a bougé à chacun des ${ESSAIS} essais : rien n'est fusionné. Relancer le workflow quand dev sera calme.`);
}

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
    if (demandeMajeure(pr.title, pr.body)) {
      throw echec('pr-master', `une PR de livraison dev → master est déjà ouverte avec [V: X+1] (#${pr.number}) : une version majeure est le signal du propriétaire, à fusionner (ou fermer) à la main`, { pr: pr.number });
    }
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

/**
 * Le processus complet (a à d). `entrees` : { lot, empreinte, adresse, essai, depot, jeton, jetonLecture, run, racine, temp, debut,
 * hoteAttendu, delais } ; `outils` : { fetch, git, executer, attendre, journal }.
 * Rend { etat: 'livre' | 'rien' | 'essai' | 'deja-livre', … } ; lève ErreurMiseAJourGithub à tout échec.
 */
export async function mettreAJour(entrees, outils) {
  const journal = outils.journal ?? (() => {});
  const e = { essai: false, delais: DELAIS, debut: new Date(), hoteAttendu: null, ...entrees };
  verifierEntrees(e);
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(String(e.depot ?? ''))) throw echec('entrees', 'GITHUB_REPOSITORY manquant ou invalide');
  if (!e.jeton) throw echec('entrees', 'GH_TOKEN manquant (secret MISE_A_JOUR_TOKEN)');
  const ctx = {
    ...e,
    proprietaire: e.depot.split('/')[0],
    api: creerApi({ fetch: outils.fetch, depot: e.depot, jeton: e.jeton, jetonLecture: e.jetonLecture }),
    g: enveloppeGit(outils.git),
    outils: { ...outils, journal, attendre: outils.attendre ?? attendreVraiment },
  };

  // a. le lot
  journal(`lot ${e.lot} : téléchargement depuis ${e.adresse}`);
  const { octets, donnees } = await telechargerLot(e, outils);
  const tables = tablesDuLot(donnees);
  const nbModifications = donnees.journal.lots.reduce((n, l) => n + (l.modifications?.length ?? 0), 0);
  journal(`empreinte vérifiée ; ${nbModifications} modification(s) en ${donnees.journal.lots.length} lot(s) ; tables du lot : ${tables.join(', ') || 'aucune'}`);
  const fichierLot = join(e.temp, `lot-${e.lot}.json`);
  writeFileSync(fichierLot, octets);

  rafraichir(ctx.g);
  if (ctx.g(['merge-base', '--is-ancestor', `origin/${MASTER}`, `origin/${DEV}`], { ok: [0, 1] }).code !== 0) {
    throw echec('depart', 'master contient des commits absents de dev (refusion après un hotfix en attente) : la livraison serait refusée, rien n\'est fait. Refusionner master dans dev d\'abord (docs/flux-git.md).');
  }

  // reprise d'un passage précédent du même lot
  let dev;
  const deja = chercherLotDejaFusionne(ctx.g, e.lot);
  if (deja?.livre) {
    journal(`ce lot est déjà livré sur master (commit ${deja.commit.slice(0, 7)}) : rien à faire.`);
    return { etat: 'deja-livre', commit: deja.commit, version: deja.version };
  }
  if (deja) {
    if (!deja.pr || !deja.version) {
      throw echec('reprise', `ce lot est déjà dans dev (commit ${deja.commit.slice(0, 7)}) mais sa PR de fusion est introuvable : livrer dev → master à la main.`);
    }
    journal(`reprise : ce lot est déjà fusionné dans dev par la PR #${deja.pr} (V${deja.version})`);
    if (e.essai) return { etat: 'essai', reprise: true, version: deja.version, pr: deja.pr };
    const pr = exiger(await ctx.api.get(`/pulls/${deja.pr}`), [200], `lecture de la PR #${deja.pr}`, 'reprise');
    dev = { etat: 'fusionne', pr: deja.pr, url: pr.html_url, version: deja.version, markdown: noteDuCorps(pr.body) };
  } else {
    // b. la PR vers dev
    if (!e.essai) await fermerAnciennesPR(ctx);
    dev = await livrerSurDev(ctx, { fichierLot, tables });
    if (dev.etat !== 'fusionne') return dev;
  }
  if (donnees.version_cible && donnees.version_cible !== dev.version) {
    journal(`avertissement : la page annonçait la V${donnees.version_cible}, la livraison sera la V${dev.version} (master a changé entre-temps)`);
  }

  // c. la version de la feature, posée par livraison.yml
  const versionDev = await attendreCommitDeVersion(ctx, dev.pr);
  // d. la livraison dev → master
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
 * .git/config (lisible par npm et ses dépendances).
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
 * Une commande dont la sortie va au journal du workflow : { code }. Dans GitHub Actions, sa sortie (où passent des textes du lot : résumés, conflits)
 * ne peut pas émettre de commandes de workflow (« ::…:: ») : elles sont suspendues le temps de la commande (::stop-commands::).
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

async function main() {
  const env = process.env;
  const resumeGithub = env.GITHUB_STEP_SUMMARY;
  const ecrire = (texte) => { if (resumeGithub) appendFileSync(resumeGithub, texte); };
  // Une ligne du journal reste une ligne : aucun texte ne peut commencer une commande de workflow (« ::… ») en début de ligne.
  const journal = (texte) => { const ligne = String(texte).replace(/\r?\n|\r/g, ' '); console.log(ligne); ecrire(`- ${ligne}\n`); };
  const essai = env.ESSAI === 'true';
  const serveur = env.GITHUB_SERVER_URL || 'https://github.com';
  if (env.GITHUB_ACTIONS === 'true') {
    // Les formes encodées des jetons (en-têtes de git) sont masquées comme les secrets eux-mêmes.
    for (const j of [env.GH_TOKEN, env.GITHUB_TOKEN_LECTURE]) if (j) console.log(`::add-mask::${Buffer.from(`x-access-token:${j}`).toString('base64')}`);
  }
  ecrire(`### Mise à jour des règles${essai ? ' (simulation)' : ''}\n\n`);
  const temp = mkdtempSync(join(env.RUNNER_TEMP || tmpdir(), 'mise-a-jour-'));
  try {
    const r = await mettreAJour({
      lot: env.LOT, empreinte: env.EMPREINTE, adresse: env.ADRESSE, essai, depot: env.GITHUB_REPOSITORY, jeton: env.GH_TOKEN,
      jetonLecture: env.GITHUB_TOKEN_LECTURE || null, hoteAttendu: env.HOTE_ATTENDU || null, racine: RACINE, temp, debut: new Date(),
      run: env.GITHUB_RUN_ID ? `${serveur}/${env.GITHUB_REPOSITORY}/actions/runs/${env.GITHUB_RUN_ID}` : null,
    }, {
      fetch: globalThis.fetch, git: gitLocal(RACINE, { jeton: env.GH_TOKEN, jetonLecture: env.GITHUB_TOKEN_LECTURE || null, serveur }),
      executer: executerLocal, attendre: attendreVraiment, journal,
    });
    const fin = {
      livre: `**Terminé** : V${r.version} — PR #${r.prDev} fusionnée dans dev (v${r.versionDev}), puis PR de livraison #${r.prMaster} fusionnée dans master ; livraison.yml pose la version V${r.version}, ses étiquettes et la publication.`,
      rien: `**Rien à livrer** : le lot ne change aucune ligne de data/rows.`,
      essai: r.reprise
        ? `**Simulation de mise à jour** : le lot est déjà fusionné dans dev (PR #${r.pr}) ; un vrai passage ferait la livraison dev → master.`
        : `**Simulation de mise à jour réussie** : V${r.version}, ${r.fichiers?.length ?? 0} fichier(s) de data/rows, contrôles verts ; rien n'a été poussé.`,
      'deja-livre': `**Déjà livré** : ce lot est sur master, rien n'a été fait.`,
    }[r.etat];
    console.log(fin.replace(/\*\*/g, ''));
    ecrire(`\n${fin}\n`);
    if (r.etat === 'essai' && r.markdown) ecrire(`\n<details><summary>Note de version qui serait livrée (V${r.version})</summary>\n\n${neutraliserMarqueur(r.markdown)}\n\n</details>\n`);
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
