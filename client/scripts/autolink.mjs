#!/usr/bin/env node
// Maillage automatique des pages du wiki (voir src/lib/autolink.mjs pour les règles) : les mentions d'un mot-clé à adresse (migration 0096) deviennent
// sa balise, {{id}} ou {{id|texte}} ; jamais un [[lien]].
//   node scripts/autolink.mjs            aperçu : n'écrit rien, affiche statistiques et exemples
//   node scripts/autolink.mjs --write    applique les balises dans src/content/wiki/**/*.md (puis npm run db:sync-pages)
//   --verbose                            liste toutes les balises proposées ; --max <n> : limite par page (25 par défaut)
// Idempotent. Ne modifie jamais le frontmatter ; ignore les pages `status: example` et celles que l’édition refait depuis les tables (TYPES_SANS_MAILLAGE).
// Les mots-clés et leurs adresses sont lus dans la base reconstruite depuis data/rows (lib/donnees.mjs#ouvrirBase) ; le maillage n'en crée jamais.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { indexDesAdresses, pageDeLAdresse } from '../src/lib/adresses-db.mjs';
import { aMailler, autolink, buildTerms, ciblesDuVocabulaire } from '../src/lib/autolink.mjs';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { motsClesDeLaBase } from '../src/lib/mots-cles-db.mjs';
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
// chaque mot-clé à adresse, et la page où elle mène (comme la table dérivée `lien`, scripts/db-derive.mjs)
const db = ouvrirBase({ sansExemples: false });
const adresses = indexDesAdresses(db);
const motsCles = motsClesDeLaBase(db);
const pageDuMotCle = new Map(motsCles.filter((m) => m.url).map((m) => [m.id, pageDeLAdresse(adresses, m.url)]));
const { cibles, sansMotCle } = ciblesDuVocabulaire(motsCles, pages, pageDuMotCle);
const { terms, ambiguous } = buildTerms(cibles, { ignore });

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
    if (verbose || samples.length < 40) samples.push(`${page.id}:${link.line}  « ${link.text} » → {{${link.id}}}${link.page ? ` (${link.page})` : ''}`);
  }
  if (write) writeFileSync(file, head + result.body);
}

console.log(`${write ? 'APPLIQUÉ' : 'APERÇU (rien n’est écrit ; relancez avec --write)'}`);
console.log(`${pages.length} pages · ${cibles.length} mot(s)-clé(s) à adresse · ${terms.length} termes utilisables · ${ambiguous.length} écriture(s) ambiguë(s) ignorée(s)`);
console.log(`${sansMotCle.length} page(s) sans mot-clé qui y mène (pas de balise vers elles ; le maillage n'en crée pas)`);
console.log(`${totalLinks} balise(s) dans ${changedFiles} page(s)`);
const top = [...incoming.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
console.log('\nMots-clés les plus posés :');
for (const [id, n] of top) console.log(`  ${String(n).padStart(4)}  ${id}`);
console.log(`\n${verbose ? 'Tous les liens' : 'Exemples (40 premiers ; --verbose pour tout)'} :`);
for (const s of samples) console.log('  ' + s);
if (ambiguous.length) console.log('\nÉcritures ambiguës ignorées :', ambiguous.join(', '));
if (verbose && sansMotCle.length) console.log('\nPages sans mot-clé :', sansMotCle.join(', '));
