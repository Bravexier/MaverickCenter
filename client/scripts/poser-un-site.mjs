#!/usr/bin/env node
// Pose un site fabriqué à la place du site servi (lot 11 « Bascule 2 », PR 3b ; docs/serveur.md, « Bascule 2 : préparation »).
// Sans aucune dépendance : il tourne dans un conteneur de l'atelier (deploy/installateur/atelier/lancer.sh), sans réseau, système de fichiers en lecture seule, sans capacité, avec
//   --source  le site fabriqué (monté en lecture seule, écrit par le conteneur de fabrication : donc NON FIABLE) ;
//   --cible   le site servi (<instance>/site, le seul dossier monté en écriture avec le dossier du résumé) ;
//   --resume  le fichier du résumé JSON (`maverick-pose/1`), dans un dossier que seul ce conteneur écrit : root le copie sans l'interpréter, le service le valide.
// Garde-fou 20 : ce script ne reçoit d'ordre de personne ; il refuse ce qu'il ne comprend pas plutôt que de le deviner.
//
// Ce qu'il fait, dans l'ordre :
//   1. lit la source sans la suivre : un lien, une FIFO, un périphérique, une socket sont REFUSÉS (rien n'est posé) ; `_serveur` n'a rien à faire dans un site fabriqué (refus) ;
//   2. garde-fous : `index.html` présent ; pages HTML de la source au moins `--minimum-pct` % (90 par défaut) de celles du site servi (`site_trop_petit` : les deux nombres) ;
//   3. pose chaque fichier de façon atomique (copie provisoire dans le même dossier, mode 0644, puis renommage) : les fichiers qui ne sont pas des pages d'abord, les pages ensuite ;
//      un fichier identique octet pour octet n'est pas réécrit (« inchangé ») ;
//   4. retire de la cible les fichiers et dossiers que la source n'a pas ;
//   5. n'ouvre, ne lit, ne modifie ni ne retire JAMAIS `_serveur/` (le code du service, que l'installateur pose) ;
//   6. écrit le résumé : posés, retirés, inchangés, pages, refus éventuel.
// Avec `--serveur` (l'activation en production, deploy/installateur/activer.sh ; docs/serveur.md, « PR 5a ») : la source et la cible sont deux dossiers `_serveur` (le code que le service exécute),
//   posés l'un sur l'autre par le même moyen (lstat, aucun lien suivi, fichier par fichier atomique, ce que la source n'a pas est retiré) ; `serveur/index.mjs` et `version.json` doivent être dans la
//   source (87), et `version.json`, que le service surveille pour se relancer, est posé EN DERNIER (jamais un service relancé sur un code à moitié posé). Ni page, ni minimum de pages.
// Avec `--sans-le-serveur-de-la-source` : un `_serveur` que la source porte (le site fabriqué par le kit, ou le site précédent mis de côté) est ignoré au lieu d'être refusé (84) ; la
//   cible n'est toujours jamais touchée dans son `_serveur`. L'activation pose ainsi les pages, puis le service par `--serveur`.
// Codes de sortie : 0 posé ; 81 index.html absent ; 82 site_trop_petit ; 83 fichier irrégulier dans la source ; 84 `_serveur` dans la source ; 85 source illisible ; 86 échec en cours de pose ; 87 service incomplet (--serveur) ; 2 usage.
import { closeSync, constants, copyFileSync, chmodSync, fstatSync, lstatSync, mkdirSync, openSync, readSync, readdirSync, renameSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const FORMAT_DE_LA_POSE = 'maverick-pose/1';
export const DOSSIER_PROTEGE = '_serveur';
export const MINIMUM_DE_PAGES_PAR_DEFAUT = 90;
export const CODES = Object.freeze({ index_absent: 81, site_trop_petit: 82, fichier_irregulier: 83, serveur_dans_la_source: 84, source_illisible: 85, echec: 86, serveur_incomplet: 87 });
const PROVISOIRE = /^\.pose-[0-9]+-[0-9]+\.tmp$/;
const PLAFOND_DE_FICHIERS = 1_000_000;
const estPage = (rel) => rel.endsWith('.html');
/** Avec `--serveur` : le fichier que le service surveille pour se relancer, posé en dernier. */
export const FICHIER_DERNIER = 'version.json';

export class RefusDePose extends Error {
  constructor(refus, plus = {}) {
    super(refus);
    this.refus = refus;
    this.plus = plus;
  }
}

/** Le contenu d'un dossier, sans suivre un lien : { fichiers: Map(rel -> taille), dossiers: Set(rel), irreguliers: rel[], dedans }. Avec `protege`, `_serveur` (à la racine) n'y entre pas : `dedans` dit qu'il y a été vu. */
function lire(racine, { protege }) {
  const fichiers = new Map();
  const dossiers = new Set();
  const irreguliers = [];
  let dedans = false;
  const marcher = (rel) => {
    for (const entree of readdirSync(rel ? join(racine, rel) : racine, { withFileTypes: true })) {
      const enfant = rel ? `${rel}/${entree.name}` : entree.name;
      if (protege && !rel && entree.name === DOSSIER_PROTEGE) { dedans = true; continue; }
      const s = lstatSync(join(racine, enfant));
      if (s.isSymbolicLink()) irreguliers.push(enfant);
      else if (s.isDirectory()) { dossiers.add(enfant); marcher(enfant); }
      else if (s.isFile()) { fichiers.set(enfant, s.size); if (fichiers.size > PLAFOND_DE_FICHIERS) throw new RefusDePose('source_illisible', { cause: 'trop de fichiers' }); }
      else irreguliers.push(enfant);
    }
  };
  marcher('');
  return { fichiers, dossiers, irreguliers, dedans };
}

/** Deux fichiers réguliers de même taille : les mêmes octets ? */
function memesOctets(a, b) {
  const fa = openSync(a, constants.O_RDONLY | constants.O_NOFOLLOW);
  let fb;
  try {
    fb = openSync(b, constants.O_RDONLY | constants.O_NOFOLLOW);
    if (!fstatSync(fa).isFile() || !fstatSync(fb).isFile()) return false;
    const x = Buffer.allocUnsafe(1 << 20);
    const y = Buffer.allocUnsafe(1 << 20);
    for (;;) {
      const n = readSync(fa, x, 0, x.length, null);
      const m = readSync(fb, y, 0, y.length, null);
      if (n !== m) return false;
      if (n === 0) return true;
      if (!x.subarray(0, n).equals(y.subarray(0, n))) return false;
    }
  } finally {
    closeSync(fa);
    if (fb !== undefined) closeSync(fb);
  }
}

const existe = (chemin) => { try { return lstatSync(chemin); } catch { return null; } };

/** S'assure que chaque dossier du chemin (sans suivre de lien) existe : un lien ou un fichier à cet endroit est retiré. */
function assurerLesDossiers(cible, rel) {
  let courant = cible;
  for (const morceau of rel.split('/')) {
    courant = join(courant, morceau);
    const s = existe(courant);
    if (s && !s.isDirectory()) { unlinkSync(courant); }
    if (!s || !s.isDirectory()) mkdirSync(courant, { mode: 0o755 });
  }
}

/**
 * Pose `source` sur `cible`. Rend le résumé (`maverick-pose/1`) ; lève `RefusDePose` quand un garde-fou refuse (rien n'a été posé), ou `Error` en cas d'échec en cours de pose.
 * @param {{ source: string, cible: string, minimumPct?: number, serveur?: boolean, ignorerLeServeur?: boolean }} o `serveur` : la source et la cible sont deux dossiers `_serveur` (le code du service,
 *   `version.json` posé en dernier) ; `ignorerLeServeur` : le `_serveur` que la source porte est ignoré (jamais posé, jamais compté).
 */
export function poserUnSite({ source, cible, minimumPct = MINIMUM_DE_PAGES_PAR_DEFAUT, serveur = false, ignorerLeServeur = false }) {
  const debut = Date.now();
  const racine = existe(source);
  if (!racine || !racine.isDirectory()) throw new RefusDePose('source_illisible', { cause: 'la source n’est pas un dossier (ou est un lien)' });
  const cibleStat = existe(cible);
  if (!cibleStat || !cibleStat.isDirectory()) throw new RefusDePose('source_illisible', { cause: 'la cible n’est pas un dossier' });
  let neuf;
  try { neuf = lire(source, { protege: !serveur }); } catch (e) { if (e instanceof RefusDePose) throw e; throw new RefusDePose('source_illisible', { cause: String(e.code ?? e.message).slice(0, 80) }); }
  if (neuf.irreguliers.length) throw new RefusDePose('fichier_irregulier', { nombre: neuf.irreguliers.length, exemples: neuf.irreguliers.slice(0, 3) });
  if (!serveur && !ignorerLeServeur && neuf.dedans) throw new RefusDePose('serveur_dans_la_source', {});
  if (serveur) {
    if (neuf.fichiers.get('serveur/index.mjs') === undefined || neuf.fichiers.get(FICHIER_DERNIER) === undefined) throw new RefusDePose('serveur_incomplet', {});
  } else if (neuf.fichiers.get('index.html') === undefined) throw new RefusDePose('index_absent', {});
  const pagesFabriquees = serveur ? 0 : [...neuf.fichiers.keys()].filter(estPage).length;
  const ancien = lire(cible, { protege: !serveur });
  const pagesServies = serveur ? 0 : [...ancien.fichiers.keys()].filter(estPage).length;
  const minimum = Math.ceil((pagesServies * minimumPct) / 100);
  if (pagesFabriquees < minimum) throw new RefusDePose('site_trop_petit', { pages_fabriquees: pagesFabriquees, pages_servies: pagesServies, minimum_de_pages: minimum, minimum_pct: minimumPct });

  const compte = { posees: 0, retirees: 0, inchangees: 0, octets_poses: 0 };
  let n = 0;
  const poser = (rel) => {
    const de = join(source, rel);
    const vers = join(cible, rel);
    const taille = neuf.fichiers.get(rel);
    const deja = existe(vers);
    if (deja && deja.isFile() && deja.size === taille && memesOctets(de, vers)) { compte.inchangees += 1; return; }
    if (deja && deja.isDirectory()) rmSync(vers, { recursive: true, force: true });
    else if (deja && !deja.isFile()) unlinkSync(vers);
    const parent = dirname(rel);
    if (parent !== '.') assurerLesDossiers(cible, parent);
    const provisoire = join(dirname(vers), `.pose-${process.pid}-${(n += 1)}.tmp`);
    try {
      copyFileSync(de, provisoire, constants.COPYFILE_EXCL);
      chmodSync(provisoire, 0o644);
      renameSync(provisoire, vers);
    } catch (e) {
      rmSync(provisoire, { force: true });
      throw e;
    }
    compte.posees += 1;
    compte.octets_poses += taille;
  };
  try {
    const noms = [...neuf.fichiers.keys()].sort();
    // les ressources d'abord : une page posée ne doit jamais citer un fichier absent ; pour le service, `version.json` (que le service surveille) en dernier
    const dernier = (rel) => (serveur ? rel === FICHIER_DERNIER : estPage(rel));
    for (const rel of noms) if (!dernier(rel)) poser(rel);
    for (const rel of noms) if (dernier(rel)) poser(rel);
    // ce que la source n'a pas : retiré (fichiers, liens et dossiers de la cible ; `_serveur` jamais regardé)
    const retirer = (rel) => {
      for (const entree of readdirSync(rel ? join(cible, rel) : cible, { withFileTypes: true })) {
        const enfant = rel ? `${rel}/${entree.name}` : entree.name;
        if (!serveur && !rel && entree.name === DOSSIER_PROTEGE) continue;
        const s = lstatSync(join(cible, enfant));
        if (s.isDirectory() && !s.isSymbolicLink()) {
          if (neuf.dossiers.has(enfant)) retirer(enfant);
          else { compte.retirees += lire(join(cible, enfant), { protege: false }).fichiers.size; rmSync(join(cible, enfant), { recursive: true, force: true }); }
        } else if (!neuf.fichiers.has(enfant) || s.isSymbolicLink() || !s.isFile()) {
          unlinkSync(join(cible, enfant));
          if (!PROVISOIRE.test(entree.name)) compte.retirees += 1;
        }
      }
    };
    retirer('');
  } catch (e) {
    const erreur = new Error(`échec en cours de pose : ${String(e.code ?? e.message).slice(0, 80)}`);
    erreur.compte = compte;
    erreur.cause = e;
    throw erreur;
  }
  return { format: FORMAT_DE_LA_POSE, pose: true, refus: null, ...compte, pages_fabriquees: pagesFabriquees, pages_servies: pagesServies, minimum_de_pages: minimum, minimum_pct: minimumPct, fichiers_source: neuf.fichiers.size, duree_ms: Date.now() - debut };
}

function ecrireLeResume(chemin, resume) {
  const provisoire = `${chemin}.${process.pid}.tmp`;
  writeFileSync(provisoire, `${JSON.stringify(resume)}\n`, { mode: 0o644 });
  renameSync(provisoire, chemin);
}

/** La ligne de commande : rend le code de sortie. */
export function principal(argv) {
  const o = { minimumPct: MINIMUM_DE_PAGES_PAR_DEFAUT, serveur: false, ignorerLeServeur: false };
  const usage = () => { console.error('Usage : poser-un-site.mjs --source <site fabriqué> --cible <site servi> --resume <fichier.json> [--minimum-pct 0..100] [--serveur | --sans-le-serveur-de-la-source]'); return 2; };
  for (let i = 0; i < argv.length; i += 1) {
    const valeur = argv[i + 1];
    if (argv[i] === '--serveur') o.serveur = true;
    else if (argv[i] === '--sans-le-serveur-de-la-source') o.ignorerLeServeur = true;
    else if (argv[i] === '--source' && valeur) { o.source = valeur; i += 1; }
    else if (argv[i] === '--cible' && valeur) { o.cible = valeur; i += 1; }
    else if (argv[i] === '--resume' && valeur) { o.resume = valeur; i += 1; }
    else if (argv[i] === '--minimum-pct' && /^[0-9]{1,3}$/.test(valeur ?? '') && Number(valeur) <= 100) { o.minimumPct = Number(valeur); i += 1; }
    else return usage();
  }
  if (!o.source || !o.cible || !o.resume || (o.serveur && o.ignorerLeServeur)) return usage();
  const resume = { format: FORMAT_DE_LA_POSE, pose: false, refus: null, posees: 0, retirees: 0, inchangees: 0, octets_poses: 0, pages_fabriquees: null, pages_servies: null, minimum_de_pages: null, minimum_pct: o.minimumPct };
  let code = 0;
  try {
    Object.assign(resume, poserUnSite(o));
  } catch (e) {
    code = e instanceof RefusDePose ? CODES[e.refus] : CODES.echec;
    resume.refus = e instanceof RefusDePose ? e.refus : 'echec';
    if (e instanceof RefusDePose) Object.assign(resume, e.plus.pages_fabriquees !== undefined ? { pages_fabriquees: e.plus.pages_fabriquees, pages_servies: e.plus.pages_servies, minimum_de_pages: e.plus.minimum_de_pages } : {}, e.plus.nombre !== undefined ? { irreguliers: e.plus.nombre } : {});
    else Object.assign(resume, e.compte ?? {});
    console.error(`poser-un-site : ${resume.refus}${e instanceof RefusDePose ? '' : ` (${e.message})`}`);
  }
  try { ecrireLeResume(o.resume, resume); } catch (e) { console.error(`poser-un-site : le résumé n’a pas pu être écrit (${e.code ?? e.message})`); if (code === 0) code = CODES.echec; }
  console.error(`poser-un-site : posées ${resume.posees}, retirées ${resume.retirees}, inchangées ${resume.inchangees}${resume.pages_fabriquees === null ? '' : `, pages ${resume.pages_fabriquees} fabriquées pour ${resume.pages_servies} servies`}`);
  return code;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = principal(process.argv.slice(2));
