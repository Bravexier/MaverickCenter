// Base de RÉFÉRENCE de la page « Mise à jour » (site de dev) : la base des règles de la production, c'est-à-dire de master (décision du
// propriétaire : la liste compare la production à la base dev). Construite avec scripts/db-build.mjs à partir du schéma et des lignes de master
// (git archive), à côté de la base du site : dist/donnees/reference.db (intégration Astro, au build) ou var/serveur/reference.db (`npm run serveur`).
// Un fichier reference.json l'accompagne : { version, commit, ref } (la version de master : celle d'où part la prochaine livraison).
// Sans master (clone superficiel sans `git fetch origin master`), rien n'est construit : la page dit que la référence manque.
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const CLIENT = fileURLToPath(new URL('../', import.meta.url));
const RACINE = fileURLToPath(new URL('../../', import.meta.url));

const git = (args, options = {}) => spawnSync('git', args, { cwd: RACINE, encoding: 'utf8', ...options });

/**
 * Construit la base de référence depuis `ref` (origin/master par défaut). Rend { chemin, version, commit, ref } ou null (référence absente :
 * `raison` dit pourquoi).
 */
export function construireReference({ sortie, ref = process.env.MAVERICK_REFERENCE_REF || 'origin/master' } = {}) {
  const commit = git(['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]).stdout.trim();
  if (!commit) return { chemin: null, raison: `${ref} introuvable (git fetch origin master)` };
  const tmp = mkdtempSync(join(tmpdir(), 'maverick-reference-'));
  try {
    const archive = git(['archive', '--format=tar', commit, 'data', 'client/package.json'], { encoding: 'buffer', maxBuffer: 512 * 1024 * 1024 });
    if (archive.status !== 0) return { chemin: null, raison: `git archive ${ref} : ${String(archive.stderr).trim()}` };
    const tar = spawnSync('tar', ['-x', '-C', tmp], { input: archive.stdout });
    if (tar.status !== 0) return { chemin: null, raison: `tar : ${String(tar.stderr).trim()}` };
    mkdirSync(dirname(sortie), { recursive: true });
    const construction = spawnSync(process.execPath, [
      '--no-warnings', join(CLIENT, 'scripts', 'db-build.mjs'), '--out', sortie, '--schema', join(tmp, 'data', 'schema.sql'), '--rows', join(tmp, 'data', 'rows'),
    ], { encoding: 'utf8' });
    if (construction.status !== 0) return { chemin: null, raison: `base de ${ref} : ${(construction.stderr || construction.stdout).trim().slice(0, 500)}` };
    let version = null;
    try {
      version = JSON.parse(readFileSync(join(tmp, 'client', 'package.json'), 'utf8')).version ?? null;
    } catch {
      // version inconnue : la page la dira inconnue
    }
    const info = { version, commit, ref };
    writeFileSync(sortie.replace(/\.db$/, '.json'), `${JSON.stringify(info)}\n`);
    return { chemin: sortie, ...info };
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

/**
 * Intégration Astro : la référence à côté de la base du site (dist/donnees/), sauf pour la version portable (sans service) et le serveur normal
 * (SITE_MODE=prod : la page Mise à jour ne s'y prépare pas).
 */
export function integrationReference() {
  return {
    name: 'maverick-reference',
    hooks: {
      'astro:build:done': ({ dir, logger }) => {
        if (process.env.INLINE_CSS === '1' || process.env.SITE_MODE === 'prod') return;
        const r = construireReference({ sortie: fileURLToPath(new URL('donnees/reference.db', dir)) });
        if (r.chemin) logger.info(`base de référence (production) : ${r.ref} ${r.commit.slice(0, 7)}, version ${r.version}`);
        else logger.warn(`base de référence (production) absente : ${r.raison}`);
      },
    },
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const sortie = process.argv[2] ?? join(RACINE, 'var', 'reference.db');
  const r = construireReference({ sortie });
  console.log(r.chemin ? `référence : ${r.chemin} (${r.ref} ${r.commit.slice(0, 7)}, version ${r.version})` : `référence absente : ${r.raison}`);
  process.exit(r.chemin ? 0 : 1);
}
