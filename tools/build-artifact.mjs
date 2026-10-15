#!/usr/bin/env node
// Construit la version « portable » du site pour un hébergement de fichiers statiques sans chemin connu
// (page privée claude.ai, dossier ouvert depuis n'importe où) :
//   - HIDE_EXAMPLES=1 : sans les pages de démonstration ;
//   - tous les liens deviennent RELATIFS, et les liens de répertoire pointent vers leur index.html ;
//   - CSS inline (Astro) et scripts inlinés (aucun fichier JS/CSS externe) ;
//   - boutons Imprimer / Exporter masqués (inertes dans un cadre sandbox) ;
//   - la page d'accueil est écrite en « fragment » (sans <html>/<head>/<body>), comme l'exige la publication.
//
// Usage : node tools/build-artifact.mjs --out <dossier>
// Résultat : <dossier>/main.html (accueil), <dossier>/files/** (le reste), <dossier>/batch-N.json (listes de ≤ 250 fichiers).
import { spawnSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, posix, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const MARK = '/__BASE__/';
const BATCH = 250;

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outArg = process.argv.indexOf('--out');
if (outArg < 0 || !process.argv[outArg + 1]) {
  console.error('Usage : node tools/build-artifact.mjs --out <dossier>');
  process.exit(2);
}
const out = resolve(process.argv[outArg + 1]);
const raw = join(out, 'raw');
const files = join(out, 'files');
rmSync(out, { recursive: true, force: true });
mkdirSync(files, { recursive: true });

// 0. Les pages du wiki sont fabriquées depuis la base (data/rows) : fichiers .md ignorés par git (client/scripts/db-export-pages.mjs)
const pagesMd = spawnSync(process.execPath, ['--no-warnings', join(root, 'client/scripts/db-export-pages.mjs')], { cwd: join(root, 'client'), encoding: 'utf8' });
if (pagesMd.status !== 0) {
  console.error(pagesMd.stderr || pagesMd.stdout);
  process.exit(1);
}

// 1. Build Astro avec une base « marqueur » (remplacée ensuite par un préfixe relatif propre à chaque page)
const build = spawnSync(process.execPath, [join(root, 'client/node_modules/astro/bin/astro.mjs'), 'build'], {
  cwd: join(root, 'client'),
  env: { ...process.env, SITE_BASE: MARK, HIDE_EXAMPLES: '1', INLINE_CSS: '1', OUT_DIR: raw },
  encoding: 'utf8',
});
if (build.status !== 0) {
  console.error(build.stdout, build.stderr);
  process.exit(1);
}

const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });

const problems = [];

/** Contenu d'un script externe à inliner ; refuse les scripts qui en importent d'autres. */
function inlineScript(src) {
  const file = join(raw, src.replace(MARK, ''));
  const code = readFileSync(file, 'utf8');
  if (/(^|[;}\n])\s*import[\s{*"']|\bimport\(/.test(code)) throw new Error(`${src} importe un autre module : inlining impossible`);
  if (/<\/script/i.test(code)) throw new Error(`${src} contient </script`);
  return code;
}

function convert(html, rel) {
  const depth = posix.dirname(rel) === '.' ? 0 : posix.dirname(rel).split('/').length;
  const prefix = depth === 0 ? './' : '../'.repeat(depth);

  html = html.replace(/<script type="module" src="([^"]+)"><\/script>/g, (_, src) => `<script type="module">${inlineScript(src)}</script>`);
  html = html.replaceAll(MARK, prefix);
  // Lien de répertoire -> index.html (la racine du site reste « ./ » ou « ../ » : c'est la page principale)
  // (un lien de répertoire avec ancre ou paramètres, « …/liste-des-alterations-d-etat/#brûlure », suit la même règle : l'ancre est gardée)
  html = html.replace(/\b(href|action)="(\.{1,2}\/[^"#?]*\/)([#?][^"]*)?"/g, (m, attr, target, reste = '') =>
    target === prefix ? m : `${attr}="${target}index.html${reste}"`);
  html = html.replace('data-suffix=""', 'data-suffix="index.html"');
  // Imprimer / Exporter : sans effet dans un cadre sandbox (la fiche de personnage : exports en tableur et en JSON, impression)
  html = html.replace(/<button type="button" id="(btn-print|btn-export|fiche-exporter-tableur|fiche-exporter|fiche-imprimer)"/g, '<button type="button" id="$1" hidden');
  return html;
}

/** Page d'accueil -> fragment : titre, meta description, icône, styles, puis contenu du <body>. */
function toFragment(html) {
  const title = html.match(/<title>[\s\S]*?<\/title>/)?.[0];
  const description = html.match(/<meta name="description"[^>]*>/)?.[0] ?? '';
  const icon = html.match(/<link rel="icon"[^>]*>/)?.[0] ?? '';
  const styles = [...html.matchAll(/<style[\s\S]*?<\/style>/g)].map((m) => m[0]).join('\n');
  const body = html.match(/<body[^>]*>([\s\S]*)<\/body>/)?.[1];
  if (!title || !body) throw new Error("Structure inattendue pour la page d'accueil");
  return [title, description, icon, styles, body.trim()].filter(Boolean).join('\n');
}

for (const file of walk(raw)) {
  const rel = relative(raw, file).split('\\').join('/');
  if (rel.startsWith('_astro/')) continue; // inliné
  if (rel.endsWith('.db')) continue; // la base SQLite (téléchargement de /donnees/) n'a pas sa place dans la version portable
  if (rel.startsWith('_serveur/')) continue; // le service des personnages (client/serveur/) ne tourne que derrière nginx, pas dans une page statique
  if (rel.startsWith('debug/')) continue; // la page Debug (site de dev seulement : testeur de l'API et journaux du service) n'a rien à montrer sans service
  if (!rel.endsWith('.html')) {
    mkdirSync(dirname(join(files, rel)), { recursive: true });
    writeFileSync(join(files, rel), readFileSync(file));
    continue;
  }
  const html = convert(readFileSync(file, 'utf8'), rel);
  if (rel === 'index.html') {
    writeFileSync(join(out, 'main.html'), toFragment(html));
  } else {
    mkdirSync(dirname(join(files, rel)), { recursive: true });
    writeFileSync(join(files, rel), html);
  }
}

// 2. Contrôles : plus de marqueur, et chaque lien/ressource relatif existe dans le résultat
const exists = (p) => p === join(files) || p === files + '/' || (() => { try { return statSync(p).isFile(); } catch { return false; } })();
let links = 0;
const pages = walk(files).filter((f) => f.endsWith('.html')).map((f) => [relative(files, f).split('\\').join('/'), readFileSync(f, 'utf8')]);
pages.push(['index.html', readFileSync(join(out, 'main.html'), 'utf8')]);
for (const [rel, html] of pages) {
  if (html.includes('__BASE__')) problems.push(`${rel} : marqueur restant`);
  const dir = posix.dirname(rel);
  for (const m of html.matchAll(/\b(?:href|src|action|data-index-url)="(\.{1,2}\/[^"#?]*)(?:[#?][^"]*)?"/g)) {
    links += 1;
    const target = posix.normalize(posix.join(dir, m[1]));
    if (target === '.' || target === './' || target === '') continue; // racine = page principale
    if (!exists(join(files, target)) && !(rel === 'index.html' && target === 'index.html')) problems.push(`${rel} : lien cassé → ${m[1]}`);
  }
  if (/<script[^>]+src=/i.test(html)) problems.push(`${rel} : script externe restant`);
  if (/rel="stylesheet"/i.test(html)) problems.push(`${rel} : feuille de style externe restante`);
}

// 3. Listes de fichiers à publier (par lots)
const all = walk(files).map((f) => relative(files, f).split('\\').join('/')).sort();
const batches = [];
for (let i = 0; i < all.length; i += BATCH) batches.push(all.slice(i, i + BATCH));
batches.forEach((b, i) => writeFileSync(join(out, `batch-${i + 1}.json`), JSON.stringify(b.map((path) => ({ path })))));
rmSync(raw, { recursive: true, force: true });

console.log(`${all.length} fichiers (+ main.html) en ${batches.length} lot(s) ; ${links} liens relatifs vérifiés ; ${problems.length} problème(s)`);
for (const p of problems.slice(0, 20)) console.log('  -', p);
process.exit(problems.length ? 1 : 0);
