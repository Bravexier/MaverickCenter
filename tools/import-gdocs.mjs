#!/usr/bin/env node
// Télécharge les Google Docs / Sheets listés dans sources/sources.json vers sources/raw/.
//   Docs   -> <id>.md   (export Markdown)
//   Sheets -> <id>[-<gid>].csv (une feuille par gid ; gid 0 par défaut)
// Les fichiers doivent être partagés en « Toute personne disposant du lien ».
// Usage : node tools/import-gdocs.mjs [--dry-run] [--only <id>]
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;

export function exportUrls(source) {
  const base = `https://docs.google.com/${source.kind === 'doc' ? 'document' : 'spreadsheets'}/d/${source.id}/export`;
  if (source.kind === 'doc') {
    return [{ url: `${base}?format=md`, file: `${source.id}.md` }];
  }
  const gids = source.gids?.length ? source.gids : ['0'];
  return gids.map((gid) => ({
    url: `${base}?format=csv&gid=${gid}`,
    file: gids.length > 1 ? `${source.id}-${gid}.csv` : `${source.id}.csv`,
  }));
}

async function download({ url, file }) {
  const res = await fetch(url, { redirect: 'follow' });
  const body = await res.text();
  const type = res.headers.get('content-type') ?? '';
  // Un document privé renvoie la page de connexion Google (HTML) au lieu de l'export.
  if (!res.ok || type.includes('text/html')) {
    throw new Error(`HTTP ${res.status} (${type || 'sans type'}) — document privé ou introuvable ?`);
  }
  await writeFile(join(root, 'sources', 'raw', file), body);
  return body.length;
}

async function main() {
  const manifest = JSON.parse(await readFile(join(root, 'sources', 'sources.json'), 'utf8'));
  const sources = manifest.google.filter((s) => !only || s.id === only);
  await mkdir(join(root, 'sources', 'raw'), { recursive: true });

  let failures = 0;
  for (const source of sources) {
    for (const target of exportUrls(source)) {
      if (dryRun) {
        console.log(`${target.file}\t${target.url}`);
        continue;
      }
      try {
        const size = await download(target);
        console.log(`ok   ${target.file} (${size} car.)`);
      } catch (err) {
        failures += 1;
        console.error(`ÉCHEC ${target.file} : ${err.message}`);
      }
    }
  }
  if (failures) process.exitCode = 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
