#!/usr/bin/env node
// Maillage automatique des pages du wiki (voir src/lib/autolink.mjs pour les règles).
//   node scripts/autolink.mjs            aperçu : n'écrit rien, affiche statistiques et exemples
//   node scripts/autolink.mjs --write    applique les liens dans src/content/wiki/**/*.md
//   --verbose                            liste tous les liens proposés ; --max <n> : limite par page (25 par défaut)
// Idempotent. Ne modifie jamais le frontmatter ; ignore les pages `status: example` et celles que l’édition refait depuis les tables (TYPES_SANS_MAILLAGE).
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { aMailler, autolink, buildTerms } from '../src/lib/autolink.mjs';
import { scanContent } from '../src/lib/wikilinks.mjs';

const contentDir = fileURLToPath(new URL('../src/content/wiki', import.meta.url));
const args = process.argv.slice(2);
const write = args.includes('--write');
const verbose = args.includes('--verbose');
const maxIdx = args.indexOf('--max');
const maxLinks = maxIdx >= 0 ? Number(args[maxIdx + 1]) : 25;

// Locutions courantes à ne jamais lier : une par ligne, # pour un commentaire
const ignore = readFileSync(fileURLToPath(new URL('./autolink-ignore.txt', import.meta.url)), 'utf8')
  .split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));

const pages = scanContent(contentDir, { includeExamples: false });
const { terms, ambiguous } = buildTerms(pages, { ignore });

const incoming = new Map();
const samples = [];
let changedFiles = 0;
let totalLinks = 0;

// les pages rendues depuis les tables (races, classes, dons, magies : TYPES_SANS_MAILLAGE) ne reçoivent pas de liens ; elles en restent des cibles
for (const page of pages.filter(aMailler)) {
  const file = join(contentDir, page.type, `${page.slug}.md`);
  const raw = readFileSync(file, 'utf8');
  const match = raw.match(/^(---\r?\n[\s\S]*?\r?\n---\r?\n?)([\s\S]*)$/);
  if (!match) continue;
  const [, head, body] = match;
  const result = autolink(body, terms, page, { maxLinks });
  if (!result.links.length) continue;
  changedFiles += 1;
  totalLinks += result.links.length;
  for (const link of result.links) {
    incoming.set(link.id, (incoming.get(link.id) ?? 0) + 1);
    if (verbose || samples.length < 40) samples.push(`${page.id}:${link.line}  « ${link.text} » → ${link.id}`);
  }
  if (write) writeFileSync(file, head + result.body);
}

console.log(`${write ? 'APPLIQUÉ' : 'APERÇU (rien n’est écrit ; relancez avec --write)'}`);
console.log(`${pages.length} pages · ${terms.length} termes utilisables · ${ambiguous.length} titre(s) ambigu(s) ignoré(s)`);
console.log(`${totalLinks} lien(s) dans ${changedFiles} page(s)`);
const top = [...incoming.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
console.log('\nPages les plus liées :');
for (const [id, n] of top) console.log(`  ${String(n).padStart(4)}  ${id}`);
console.log(`\n${verbose ? 'Tous les liens' : 'Exemples (40 premiers ; --verbose pour tout)'} :`);
for (const s of samples) console.log('  ' + s);
if (ambiguous.length) console.log('\nTitres ambigus ignorés :', ambiguous.join(', '));
