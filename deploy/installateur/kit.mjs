// Le kit de l'atelier (lot 9 du chantier « la base du site de dev devient la source de vérité », docs/chantier-base-de-dev.md, PR 2 sur 4) : ce que l'atelier du site de
// dev (PR 3) emporte pour lancer `npm run build:depuis-contenu` sans réseau, dans un conteneur Docker, SANS `data/rows` ni git. Chaque installateur de TEST
// l'emporte, sous atelier-kit/ ; l'installateur de production n'en porte jamais (fabriquer.mjs refuse --kit hors du mode test).
//
// Contenu (R275, question 6 : le kit ne porte aucun contenu, c'est du code) :
//   - client/ avec ses node_modules (aucun lien qui sorte du kit : un node_modules relié à un autre dossier est lu par son chemin réel, ses modules sont alors dupliqués
//     et le site fabriqué n'est plus celui de la CI), sans dist/, .astro/, src/content/wiki/, test/, var/, ni ce que git ignore ;
//   - data/schema.sql, data/derive.sql, data/migrations/ (le schéma et ses registres : du code) ;
//   - sources/sources.json et sources/tipeee/bienvenue.json (la page Archives et l'accueil les lisent) ;
//   - .nvmrc (la version de Node).
// Élagage : les modules natifs d'une autre plateforme, d'une autre architecture ou d'une autre libc (musl contre glibc : les deux variantes sont installées) sont
// retirés selon ce que leur propre package.json déclare (`os`, `cpu`, `libc`) : le critère de npm lui-même, jamais une liste de noms. Ils ne servent jamais ici.
// L'image Docker de l'atelier doit avoir la libc du kit (kit.json : `image`) : des modules faits sur la machine de GitHub (glibc) ne marchent pas sous Alpine.
//
// Fabriqué dans <destination>/ : atelier-kit.tar.gz (l'archive) et kit.json (format maverick-kit/1, à côté : l'installateur le lit sans décompresser).
// Module Node seulement, sans dépendance ; testé par client/test/deploy-kit.test.mjs.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, readlinkSync, rmSync, statSync, lstatSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve, sep } from 'node:path';

export const FORMAT_KIT = 'maverick-kit/1';
export const ARCHIVE_DU_KIT = 'atelier-kit.tar.gz';
export const META_DU_KIT = 'kit.json';
/** Le dossier du kit dans l'archive de l'installateur. */
export const DOSSIER_DU_KIT = 'atelier-kit';

/** Ce que le kit emporte, relatif à la racine du dépôt. */
export const A_EMPORTER = Object.freeze(['client', 'data/schema.sql', 'data/derive.sql', 'data/migrations', 'sources/sources.json', 'sources/tipeee/bienvenue.json', '.nvmrc']);
/** Ce que client/ ne donne pas au kit (chemins relatifs à client/). */
const EXCLUS_DE_CLIENT = Object.freeze(['dist', '.astro', 'test', 'var', 'src/content/wiki']);
const EXCLUS_PAR_NOM = /^(?:\.DS_Store|.*\.log)$/;

/** Ce qu'aucun kit ne porte : du contenu (R275, question 6). Chaque règle : nom, et ce qui la déclenche pour un chemin relatif à la racine du kit (« / »). */
export const INTERDITS = Object.freeze([
  Object.freeze({ nom: 'data/rows (les lignes du contenu)', vise: (rel) => rel === 'data/rows' || rel.startsWith('data/rows/') }),
  Object.freeze({ nom: 'sources/raw (les exports bruts)', vise: (rel) => rel === 'sources/raw' || rel.startsWith('sources/raw/') }),
  Object.freeze({ nom: 'client/src/content/wiki (les pages fabriquées)', vise: (rel) => rel === 'client/src/content/wiki' || rel.startsWith('client/src/content/wiki/') }),
  Object.freeze({ nom: 'un fichier de base de données', vise: (rel) => /\.(?:db|sqlite3?)(?:-(?:wal|shm|journal))?$/i.test(rel) }),
  Object.freeze({ nom: 'l’historique git', vise: (rel) => rel === '.git' || rel.startsWith('.git/') || rel.endsWith('/.git') }),
]);
/** Ce que le kit doit porter pour que le build depuis un contenu marche. */
export const INDISPENSABLES = Object.freeze([
  'client/package.json', 'client/astro.config.mjs', 'client/scripts/fabriquer-depuis-contenu.mjs', 'client/node_modules/astro/bin/astro.mjs',
  'data/schema.sql', 'data/derive.sql', 'data/migrations', 'sources/sources.json', 'sources/tipeee/bienvenue.json', '.nvmrc',
]);

export class ErreurKit extends Error {
  /** @param {string[]} problemes */
  constructor(problemes) {
    super(`Kit de l'atelier refusé : ${problemes.join(' ; ')}`);
    this.name = 'ErreurKit';
    this.problemes = problemes;
  }
}

const sha256 = (octets) => createHash('sha256').update(octets).digest('hex');
const posix = (chemin) => chemin.split(sep).join('/');

/** Tous les chemins d'un dossier (fichiers, liens et dossiers), relatifs et en « / », sans suivre les liens. */
function parcourir(dossier, relatif = '') {
  const sortie = [];
  for (const entree of readdirSync(join(dossier, relatif), { withFileTypes: true })) {
    const rel = relatif ? `${relatif}/${entree.name}` : entree.name;
    sortie.push({ rel, dossier: entree.isDirectory(), lien: entree.isSymbolicLink() });
    if (entree.isDirectory()) sortie.push(...parcourir(dossier, rel));
  }
  return sortie;
}

/**
 * Le contrôle du kit : ce que `dossier` (la racine du kit) porte d'interdit, et ce qui lui manque. Rend la liste des problèmes (vide : le kit est bon).
 * Un lien symbolique ne se suit pas (`node_modules/.bin` en porte) mais son nom compte.
 */
export function controlerLeKit(dossier) {
  const problemes = [];
  const chemins = parcourir(dossier).map((e) => e.rel);
  for (const regle of INTERDITS) {
    const trouves = chemins.filter(regle.vise);
    if (trouves.length) problemes.push(`le kit porte ${regle.nom} : ${trouves.slice(0, 3).join(', ')}${trouves.length > 3 ? `… (${trouves.length})` : ''}`);
  }
  // un lien qui sort du kit (ou absolu) ferait lire, ou dupliquer, des modules hors du kit : refusé
  const racine = resolve(dossier);
  for (const e of parcourir(dossier).filter((x) => x.lien)) {
    const cible = resolve(dirname(join(racine, e.rel)), readlinkSync(join(racine, e.rel)));
    if (cible !== racine && !cible.startsWith(`${racine}${sep}`)) problemes.push(`le lien « ${e.rel} » mène hors du kit`);
  }
  const presents = new Set(chemins);
  const manquants = INDISPENSABLES.filter((rel) => !presents.has(rel));
  if (manquants.length) problemes.push(`il manque ${manquants.join(', ')}`);
  return problemes;
}

/** La libc de cette machine, au vocabulaire du champ `libc` de package.json (« glibc » ou « musl »), null hors de Linux. */
export function libcDeLaMachine() {
  if (process.platform !== 'linux') return null;
  try {
    return process.report.getReport().header.glibcVersionRuntime ? 'glibc' : 'musl';
  } catch {
    return null;
  }
}

/** L'image Docker de l'atelier : la même libc que le kit. Debian (glibc) ou Alpine (musl), la version de Node de .nvmrc. */
export const imageDeLAtelier = (node, libc) => (libc === 'musl' ? `node:${node}-alpine` : `node:${node}-bookworm-slim`);

/** La règle de npm pour `os`, `cpu` et `libc` : une liste de valeurs permises, ou refusées par « ! » ; absente ou vide, tout est permis ; valeur inconnue (null), tout est permis. */
export function compatible(liste, valeur) {
  if (!Array.isArray(liste) || liste.length === 0 || valeur === null) return true;
  if (liste.includes(`!${valeur}`)) return false;
  const permises = liste.filter((v) => !String(v).startsWith('!'));
  return permises.length === 0 || permises.includes(valeur);
}

/**
 * Les paquets de `node_modules` qu'une autre plateforme, architecture ou libc rend inutiles, d'après leur package.json (`os`, `cpu`, `libc`).
 * @returns {{ rel: string, octets: number }[]} chemins relatifs à node_modules (« @scope/nom » ou « nom »)
 */
export function paquetsInutiles(nodeModules, { platform = process.platform, arch = process.arch, libc = libcDeLaMachine() } = {}) {
  const inutiles = [];
  // chaque paquet de node_modules, scopes compris, puis les node_modules imbriqués de ceux qu'on garde (un paquet retiré emporte les siens)
  const balayer = (dossier, prefixe) => {
    for (const nom of readdirSync(dossier)) {
      if (nom.startsWith('.')) continue;
      const noms = nom.startsWith('@') ? readdirSync(join(dossier, nom)).map((sous) => `${nom}/${sous}`) : [nom];
      for (const rel of noms) {
        let package_;
        try { package_ = JSON.parse(readFileSync(join(dossier, rel, 'package.json'), 'utf8')); } catch { package_ = null; }
        if (package_ && ![['os', platform], ['cpu', arch], ['libc', libc]].every(([champ, valeur]) => compatible(package_[champ], valeur))) {
          inutiles.push({ rel: `${prefixe}${rel}`, octets: tailleDe(join(dossier, rel)) });
        } else if (existsSync(join(dossier, rel, 'node_modules'))) {
          balayer(join(dossier, rel, 'node_modules'), `${prefixe}${rel}/node_modules/`);
        }
      }
    }
  };
  balayer(nodeModules, '');
  return inutiles;
}

/** La taille (octets) des fichiers d'un dossier, liens non suivis. */
export function tailleDe(dossier) {
  let somme = 0;
  for (const e of parcourir(dossier)) if (!e.dossier && !e.lien) somme += lstatSync(join(dossier, e.rel)).size;
  return somme;
}

/** Ce que git ignore dans client/ (dossiers et fichiers, relatifs à la racine), si la racine est un dépôt git ; liste vide sinon. node_modules/ est le seul ignoré qu'on garde. */
function ignoresParGit(racine) {
  if (!existsSync(join(racine, '.git'))) return [];
  const r = spawnSync('git', ['-C', racine, 'ls-files', '--others', '--ignored', '--exclude-standard', '--directory', '-z', '--', 'client'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) return [];
  return r.stdout.split('\0').filter(Boolean).map((p) => p.replace(/\/$/, '')).filter((p) => p !== 'client/node_modules' && !p.startsWith('client/node_modules/'));
}

/** La version de Node de .nvmrc (« 22 » ou « v22.13.0 » → « 22 » ou « 22.13.0 »). */
export function nodeDeNvmrc(racine) {
  const texte = readFileSync(join(racine, '.nvmrc'), 'utf8').trim().replace(/^v/, '');
  if (!/^\d+(?:\.\d+){0,2}$/.test(texte)) throw new ErreurKit([`.nvmrc : version de Node illisible (« ${texte.slice(0, 20)} »)`]);
  return texte;
}

/**
 * Fabrique le kit depuis la racine du dépôt `racine` dans le dossier `destination` : atelier-kit.tar.gz et kit.json. Rend le contenu de kit.json.
 * `plateforme` ne sert qu'aux tests (par défaut : cette machine).
 * @param {{ racine: string, destination: string, version: string, sha: string, plateforme?: { platform: string, arch: string, libc: string|null } }} o
 */
export function fabriquerLeKit({ racine, destination, version, sha, plateforme = { platform: process.platform, arch: process.arch, libc: libcDeLaMachine() } }) {
  if (plateforme.platform !== 'linux') throw new ErreurKit([`le kit se fabrique sous Linux (cette machine : ${plateforme.platform}) : ses modules natifs doivent être ceux de l'image Docker de l'atelier`]);
  for (const rel of A_EMPORTER) if (!existsSync(join(racine, rel))) throw new ErreurKit([`${rel} est introuvable dans ${racine}`]);
  const node = nodeDeNvmrc(racine);
  const exclus = new Set([...EXCLUS_DE_CLIENT.map((e) => `client/${e}`), ...ignoresParGit(racine)]);
  const travail = mkdtempSync(join(tmpdir(), 'maverick-kit-'));
  try {
    const kit = join(travail, 'kit');
    for (const rel of A_EMPORTER) {
      mkdirSync(dirname(join(kit, rel)), { recursive: true });
      cpSync(join(racine, rel), join(kit, rel), {
        recursive: true, verbatimSymlinks: true, preserveTimestamps: true,
        filter: (source) => {
          const rel_ = posix(relative(racine, source));
          if (EXCLUS_PAR_NOM.test(rel_.split('/').pop())) return false;
          for (const e of exclus) if (rel_ === e || rel_.startsWith(`${e}/`)) return false;
          return true;
        },
      });
    }
    const modules = join(kit, 'client', 'node_modules');
    const retires = existsSync(modules) ? paquetsInutiles(modules, plateforme) : [];
    for (const p of retires) rmSync(join(modules, p.rel), { recursive: true, force: true });
    const problemes = controlerLeKit(kit);
    if (problemes.length) throw new ErreurKit(problemes);

    // l'empreinte du kit : celle de la liste ordonnée de ses fichiers et de leur contenu (liens : leur cible)
    const empreinte = createHash('sha256');
    let fichiers = 0;
    let octets = 0;
    for (const e of parcourir(kit).sort((x, y) => (x.rel < y.rel ? -1 : x.rel > y.rel ? 1 : 0))) {
      if (e.dossier) continue;
      const chemin = join(kit, e.rel);
      if (e.lien) { empreinte.update(`${e.rel}\0lien\0${readlinkSync(chemin)}\0`); fichiers += 1; continue; }
      const contenu = readFileSync(chemin);
      empreinte.update(`${e.rel}\0${sha256(contenu)}\0`);
      fichiers += 1;
      octets += contenu.length;
    }

    mkdirSync(destination, { recursive: true });
    const archive = join(destination, ARCHIVE_DU_KIT);
    rmSync(archive, { force: true });
    const tar = spawnSync('tar', ['-czf', archive, '-C', kit, '.'], { encoding: 'utf8' });
    if (tar.status !== 0) throw new ErreurKit([`tar : ${tar.stderr}`]);
    const meta = {
      format: FORMAT_KIT,
      version,
      commit: sha,
      node,
      plateforme: { os: plateforme.platform, arch: plateforme.arch, libc: plateforme.libc },
      image: imageDeLAtelier(node, plateforme.libc),
      fichiers,
      taille_decompressee_octets: octets,
      taille_archive_octets: statSync(archive).size,
      empreinte: empreinte.digest('hex'),
      archive_sha256: sha256(readFileSync(archive)),
      elagage: { paquets_retires: retires.length, octets_retires: retires.reduce((s, p) => s + p.octets, 0), exemples: retires.slice(0, 12).map((p) => p.rel) },
    };
    writeFileSync(join(destination, META_DU_KIT), `${JSON.stringify(meta, null, 2)}\n`);
    return meta;
  } finally {
    rmSync(travail, { recursive: true, force: true });
  }
}
