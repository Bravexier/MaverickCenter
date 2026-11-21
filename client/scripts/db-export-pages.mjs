// Fabrique les fichiers `.md` du wiki (client/src/content/wiki/<type>/<slug>.md) à partir de la base reconstruite depuis data/rows.
//   node scripts/db-export-pages.mjs [--out <dossier>] [--verifier <dossier-existant>]
// Lancé automatiquement avant `npm run dev`, `npm run build` et `npm test` (scripts « pre… » de package.json) : les `.md` ne sont plus dans git, la base est la source.
// --verifier : n'écrit rien ; compare ce que la base produirait au dossier donné (code 1 s'il y a un écart).
// MAVERICK_CONTENU=<fichier SQLite> : la base est une copie de ce fichier (un extrait du contenu, lib/contenu-fourni.mjs) au lieu d'être reconstruite depuis data/rows,
// préparée comme celle du build (scripts/db-preparer-contenu.mjs : vue de l'extrait retirée, migrations manquantes du dépôt appliquées, pages d'exemple ajoutées).
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { contenuDejaDerive, contenuFourni, copierLeContenu } from '../src/lib/contenu-fourni.mjs';
import { emettrePage, lirePages, ouvrirEnLectureSeule } from '../src/lib/pages-db.mjs';
import { preparerLeContenu } from './db-preparer-contenu.mjs';

const client = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const racine = resolve(client, '..');
const args = process.argv.slice(2);
const option = (nom) => (args.includes(nom) ? args[args.indexOf(nom) + 1] : null);
const verifier = option('--verifier');
const sortie = resolve(option('--out') ?? join(client, 'src', 'content', 'wiki'));

const dossier = mkdtempSync(join(tmpdir(), 'maverick-pages-'));
const fichier = join(dossier, 'maverick.db');

/** Fabrique ou vérifie les pages ; renvoie le code de sortie. Le dossier temporaire est supprimé dans tous les cas (d'où aucun `process.exit` ici). */
function executer() {
  try {
    // MAVERICK_CONTENU : les pages viennent d'une copie du fichier de contenu fourni (jamais modifié), sans data/rows
    const contenu = contenuFourni();
    if (contenu) {
      copierLeContenu(contenu, fichier);
      // comme lib/donnees.mjs#ouvrirBase : un fichier déjà dérivé (fabrication en deux temps) se lit tel quel, sans préparation ; la fabrication l'a
      // contrôlé (serveur/fichier-de-contenu.mjs : structure égale à celle du dépôt) et dérivé, mais il garde sa vue `extrait_meta`, sans effet sur la lecture des pages
      // les pages d'exemple du dépôt s'ajoutent à un contenu qui n'en a aucune (le site de dev), sauf pour HIDE_EXAMPLES=1 (Astro les écarterait)
      if (!contenuDejaDerive()) preparerLeContenu(fichier, { racine, exemples: process.env.HIDE_EXAMPLES !== '1' });
    } else {
      const r = spawnSync(process.execPath, ['--no-warnings', join(client, 'scripts', 'db-build.mjs'), '--out', fichier], { encoding: 'utf8', cwd: racine });
      if (r.status !== 0) { console.error(`db-build a échoué : ${r.stderr || r.stdout}`); return 1; }
    }
    const db = ouvrirEnLectureSeule(fichier);
    const types = db.prepare('SELECT id FROM type_page ORDER BY ordre').all().map((t) => t.id);
    const pages = lirePages(db);
    db.close();

    if (verifier) {
      const attendus = new Map(pages.map((p) => [`${p.type}/${p.slug}.md`, emettrePage(p)]));
      const ecarts = [];
      const presents = new Set();
      for (const type of existsSync(verifier) ? readdirSync(verifier) : []) {
        for (const nom of readdirSync(join(verifier, type)).filter((f) => f.endsWith('.md'))) {
          const cle = `${type}/${nom}`;
          presents.add(cle);
          if (!attendus.has(cle)) ecarts.push(`en trop : ${cle}`);
          else if (readFileSync(join(verifier, cle), 'utf8') !== attendus.get(cle)) ecarts.push(`différent : ${cle}`);
        }
      }
      for (const cle of attendus.keys()) if (!presents.has(cle)) ecarts.push(`manquant : ${cle}`);
      console.log(JSON.stringify({ pages: pages.length, ecarts: ecarts.length, exemples: ecarts.slice(0, 20) }));
      return ecarts.length ? 1 : 0;
    }

    for (const type of types) { rmSync(join(sortie, type), { recursive: true, force: true }); mkdirSync(join(sortie, type), { recursive: true }); }
    for (const p of pages) writeFileSync(join(sortie, p.type, `${p.slug}.md`), emettrePage(p));
    console.log(`${pages.length} pages écrites dans ${sortie}`);
    return 0;
  } finally {
    rmSync(dossier, { recursive: true, force: true });
  }
}

process.exit(executer());
