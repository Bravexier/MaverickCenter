#!/usr/bin/env node
// Fabrique l'installateur autonome d'une version du site (à partir de la 1.0) : installateur.sh (paramètres remplis) suivi de l'archive
// tar.gz du site construit et des fichiers d'hébergement. Un seul fichier à copier sur le serveur, aucun téléchargement à l'installation.
//
// Usage : node deploy/installateur/fabriquer.mjs --mode prod|test --site <dossier dist> --tag <étiquette> --version <X.Y.Z>
//                                                 --sha <commit> --sortie <dossier>
// Résultat : <sortie>/maverick-center-<étiquette>-install.sh (chemin écrit sur la sortie standard).
// Appelé par .github/workflows/livraison.yml après chaque fusion dans dev (mode test) ou master (mode prod), et par fabriquer.sh (à la main).
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmodSync, copyFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ICI = dirname(fileURLToPath(import.meta.url));
/** Fichiers d'hébergement livrés avec le site (l'installateur les pose dans le dossier de l'instance) : nom → source. La configuration nginx est celle du NAS. */
export const FICHIERS_LIVRES = {
  'docker-compose.yml': join(ICI, 'docker-compose.yml'),
  'nginx.conf': join(ICI, '..', 'nginx.conf'),
  'README.md': join(ICI, 'README.md'),
  'mise-a-jour.sh': join(ICI, 'mise-a-jour.sh'),
};

const FORMATS = {
  mode: /^(prod|test)$/,
  tag: /^v\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/,
  version: /^\d+\.\d+\.\d+$/,
  sha: /^([0-9a-f]{7,40}|local)$/,
};

function arguments_(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i += 2) {
    if (!argv[i].startsWith('--') || argv[i + 1] === undefined) throw new Error(`argument inattendu « ${argv[i]} »`);
    o[argv[i].slice(2)] = argv[i + 1];
  }
  return o;
}

/** Les valeurs entrent telles quelles dans un script shell : formats stricts. */
function valider(o) {
  for (const [cle, format] of Object.entries(FORMATS)) {
    if (!format.test(o[cle] ?? '')) throw new Error(`--${cle} invalide ou absent (reçu « ${o[cle] ?? ''} »)`);
  }
  if (o.mode === 'test' && !o.tag.includes('-test')) throw new Error(`une étiquette de test contient « -test » (reçu « ${o.tag} »)`);
  if (o.mode === 'prod' && o.tag.includes('-test')) throw new Error(`une étiquette de production ne contient pas « -test » (reçu « ${o.tag} »)`);
  if (!o.site || !existsSync(join(o.site, 'index.html'))) throw new Error(`--site : pas de index.html dans « ${o.site ?? ''} »`);
  if (!o.sortie) throw new Error('--sortie manquant');
}

function compterPages(dossier) {
  let n = 0;
  for (const nom of readdirSync(dossier)) {
    const chemin = join(dossier, nom);
    if (statSync(chemin).isDirectory()) n += compterPages(chemin);
    else if (nom === 'index.html') n += 1;
  }
  return n;
}

export function fabriquer(options) {
  valider(options);
  const { mode, site, tag, version, sha, sortie } = options;
  const travail = mkdtempSync(join(tmpdir(), 'installateur-'));
  try {
    const contenu = join(travail, 'contenu');
    cpSync(resolve(site), join(contenu, 'site'), { recursive: true });
    for (const [nom, source] of Object.entries(FICHIERS_LIVRES)) copyFileSync(source, join(contenu, nom));
    const archive = join(travail, 'archive.tar.gz');
    const tar = spawnSync('tar', ['-czf', archive, '-C', contenu, '.'], { encoding: 'utf8' });
    if (tar.status !== 0) throw new Error(`tar : ${tar.stderr}`);
    const octets = readFileSync(archive);
    const valeurs = {
      TAG: tag, VERSION: version, SHA: sha, MODE: mode,
      ARCHIVE_SHA256: createHash('sha256').update(octets).digest('hex'),
      PAGES: String(compterPages(join(contenu, 'site'))),
    };
    const modele = readFileSync(join(ICI, 'installateur.sh'), 'utf8');
    if (!modele.endsWith('\n__ARCHIVE__\n')) throw new Error('deploy/installateur/installateur.sh doit se terminer par la ligne __ARCHIVE__');
    const script = modele.replace(/@@([A-Z0-9_]+)@@/g, (tout, cle) => {
      if (!(cle in valeurs)) throw new Error(`paramètre inconnu ${tout} dans deploy/installateur/installateur.sh`);
      return valeurs[cle];
    });
    mkdirSync(sortie, { recursive: true });
    const fichier = join(resolve(sortie), `maverick-center-${tag}-install.sh`);
    writeFileSync(fichier, Buffer.concat([Buffer.from(script, 'utf8'), octets]));
    chmodSync(fichier, 0o755);
    return { fichier, ...valeurs };
  } finally {
    rmSync(travail, { recursive: true, force: true });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const r = fabriquer(arguments_(process.argv.slice(2)));
    console.error(`Installateur ${r.TAG} (${r.MODE}) : ${r.PAGES} pages, archive ${r.ARCHIVE_SHA256.slice(0, 12)}…`);
    console.log(r.fichier);
  } catch (e) {
    console.error(`ERREUR : ${e.message}`);
    process.exit(1);
  }
}
