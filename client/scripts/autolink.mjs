#!/usr/bin/env node
// Maillage automatique des pages du wiki (voir src/lib/autolink.mjs pour les règles) : les mentions d'un mot-clé à adresse (migration 0098) deviennent
// sa balise, {{id}} ou {{id|texte}} ; jamais un [[lien]].
//   node scripts/autolink.mjs                                       aperçu : n'écrit rien, affiche statistiques et exemples
//   node scripts/autolink.mjs --lot <lot.json> --titre <titre> [--avant <extrait.db>]   écrit un LOT DE CHANGEMENTS de nature `source` (scripts/lot-de-source.mjs), à proposer au site de dev par un humain
//                                                                   (`POST /api/edition/lots/`) : l'outil n'envoie rien et n'écrit ni `.md` ni data/rows (lot 12 : `--write` est retiré)
//   --verbose                            liste toutes les balises proposées ; --max <n> : limite par page (25 par défaut)
// Idempotent. Ne modifie jamais le frontmatter ; ignore les pages `status: example` et celles que l’édition refait depuis les tables (TYPES_SANS_MAILLAGE).
// Les mots-clés, leurs adresses et le corps des pages (`page.corps_md`, le texte que le lot modifie) sont lus dans la base de lib/donnees.mjs#ouvrirBase : le contenu fourni
// (MAVERICK_CONTENU : l'extrait du jour du site de dev, `npm run db:extrait`) ou, sans lui, la base reconstruite depuis data/rows (l'aperçu seulement : `--lot` exige l'extrait du
// jour, par MAVERICK_CONTENU, `--avant <extrait.db>` ou var/extrait/maverick-dev.db, sinon refus code 2 : jamais data/rows en silence) ; les `.md` du wiki fabriqué ne servent qu'aux titres et alias des pages (cibles). Le maillage n'en crée jamais de mot-clé.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { indexDesAdresses, pageDeLAdresse } from '../src/lib/adresses-db.mjs';
import { aMailler, autolink, buildTerms, ciblesDuVocabulaire } from '../src/lib/autolink.mjs';
import { cheminBase, ouvrirBase } from '../src/lib/donnees.mjs';
import { motsClesDeLaBase } from '../src/lib/mots-cles-db.mjs';
import { scanContent } from '../src/lib/wikilinks.mjs';
import { contenuFourni } from '../src/lib/contenu-fourni.mjs';
import { EXTRAIT_PAR_DEFAUT, lotDeSourceParModification } from './lot-de-source.mjs';

/**
 * Le maillage d'une base : pour chaque page de `pages` que le maillage reçoit (`aMailler`), les balises à poser dans son `corps_md`.
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {{ id: string, type?: string, title: string, aliases?: string[] }[]} pages  les pages (titres et alias : les cibles)
 * @param {{ ignore?: string[], maxLinks?: number }} [o]
 * @returns {{ corrections: Map<string, string>, liens: { page: string, id: string, text: string, line: number, cible: string|null }[], terms: object[], ambiguous: string[], cibles: object[], sansMotCle: string[] }}
 *   `corrections` : id de la page -> son nouveau `corps_md` (seulement les pages qui changent)
 */
export function mailler(db, pages, { ignore = [], maxLinks = 25 } = {}) {
  // chaque mot-clé à adresse, et la page où elle mène (comme la table dérivée `lien`, scripts/db-derive.mjs)
  const adresses = indexDesAdresses(db);
  const motsCles = motsClesDeLaBase(db);
  const pageDuMotCle = new Map(motsCles.filter((m) => m.url).map((m) => [m.id, pageDeLAdresse(adresses, m.url)]));
  const { cibles, sansMotCle } = ciblesDuVocabulaire(motsCles, pages, pageDuMotCle);
  const { terms, ambiguous } = buildTerms(cibles, { ignore });
  const corps = db.prepare('SELECT corps_md FROM page WHERE id = ?');
  const corrections = new Map();
  const liens = [];
  // les pages rendues depuis les tables (races, classes, dons, magies : TYPES_SANS_MAILLAGE) ne reçoivent pas de liens ; elles en restent des cibles
  for (const page of pages.filter(aMailler)) {
    const texte = corps.get(page.id)?.corps_md;
    if (typeof texte !== 'string') continue;
    const result = autolink(texte, terms, page, { maxLinks });
    if (!result.links.length) continue;
    corrections.set(page.id, result.body);
    for (const link of result.links) liens.push({ page: page.id, id: link.id, text: link.text, line: link.line, cible: link.page ?? null });
  }
  return { corrections, liens, terms, ambiguous, cibles, sansMotCle };
}

/**
 * L'extrait d'où se tire un lot : `--avant`, sinon MAVERICK_CONTENU (déjà posée : rend null, rien à changer), sinon `defaut` (var/extrait/maverick-dev.db) s'il
 * existe ; sinon une erreur (jamais data/rows en silence).
 * @param {{ avant?: string, env?: object, defaut?: string, existe?: (chemin: string) => boolean }} o
 * @returns {string|null} le chemin à poser dans MAVERICK_CONTENU, ou null quand elle l'est déjà
 */
export function extraitDuLot({ avant, env = process.env, defaut = EXTRAIT_PAR_DEFAUT, existe = existsSync } = {}) {
  if (avant) return resolve(avant);
  if (contenuFourni(env)) return null;
  if (!existe(defaut)) {
    throw new Error('--lot demande l\'extrait du jour du site de dev : poser MAVERICK_CONTENU=<extrait.db>, ou `--avant <extrait.db>`, ou faire `npm run db:extrait` (var/extrait/maverick-dev.db). Jamais data/rows en silence.');
  }
  return defaut;
}

/** Écrit les corps maillés dans une base ouverte en écriture (la copie d'où se tire le lot : scripts/lot-de-source.mjs#lotDeSourceParModification). */
export function poserLeMaillage(db, corrections) {
  const modifier = db.prepare('UPDATE page SET corps_md = ? WHERE id = ?');
  for (const [id, corps] of corrections) modifier.run(corps, id);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const contentDir = fileURLToPath(new URL('../src/content/wiki', import.meta.url));
  const args = process.argv.slice(2);
  const option = (nom) => (args.includes(nom) ? args[args.indexOf(nom) + 1] : undefined);
  if (args.includes('--write')) {
    console.error('--write est retiré (bascule 1, R274 ; lot 12) : le maillage s\'écrit en lot de changements, `--lot <lot.json> --titre <titre>`, à proposer au site de dev (POST /api/edition/lots/).');
    process.exit(2);
  }
  const sortie = option('--lot');
  if (sortie && !option('--titre')) {
    console.error('usage : node scripts/autolink.mjs [--lot <lot.json> --titre <titre> [--avant <extrait.db>]] [--verbose] [--max <n>]');
    process.exit(2);
  }
  // `--lot` propose au site de dev : sa base de départ est l'extrait du jour, nommée, jamais data/rows en silence
  if (sortie) {
    try {
      const extrait = extraitDuLot({ avant: option('--avant') });
      if (extrait) process.env.MAVERICK_CONTENU = extrait;
    } catch (e) {
      console.error(e.message);
      process.exit(2);
    }
  }
  const verbose = args.includes('--verbose');
  const maxLinks = option('--max') !== undefined ? Number(option('--max')) : 25;

  // Locutions courantes à ne jamais lier : une par ligne, # pour un commentaire
  const ignore = readFileSync(fileURLToPath(new URL('./autolink-ignore.txt', import.meta.url)), 'utf8')
    .split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));

  const pages = scanContent(contentDir, { includeExamples: false });
  const db = ouvrirBase({ sansExemples: false });
  const { corrections, liens, terms, ambiguous, cibles, sansMotCle } = mailler(db, pages, { ignore, maxLinks });

  const incoming = new Map();
  const samples = [];
  for (const l of liens) {
    incoming.set(l.id, (incoming.get(l.id) ?? 0) + 1);
    if (verbose || samples.length < 40) samples.push(`${l.page}:${l.line}  « ${l.text} » → {{${l.id}}}${l.cible ? ` (${l.cible})` : ''}`);
  }

  console.log(sortie ? 'LOT' : 'APERÇU (rien n’est écrit ; relancez avec --lot <lot.json> --titre <titre> pour écrire un lot à proposer)');
  console.log(`${pages.length} pages · ${cibles.length} mot(s)-clé(s) à adresse · ${terms.length} termes utilisables · ${ambiguous.length} écriture(s) ambiguë(s) ignorée(s)`);
  console.log(`${sansMotCle.length} page(s) sans mot-clé qui y mène (pas de balise vers elles ; le maillage n'en crée pas)`);
  console.log(`${liens.length} balise(s) dans ${corrections.size} page(s)`);
  const top = [...incoming.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
  console.log('\nMots-clés les plus posés :');
  for (const [id, n] of top) console.log(`  ${String(n).padStart(4)}  ${id}`);
  console.log(`\n${verbose ? 'Tous les liens' : 'Exemples (40 premiers ; --verbose pour tout)'} :`);
  for (const s of samples) console.log('  ' + s);
  if (ambiguous.length) console.log('\nÉcritures ambiguës ignorées :', ambiguous.join(', '));
  if (verbose && sansMotCle.length) console.log('\nPages sans mot-clé :', sansMotCle.join(', '));
  if (sortie) {
    if (!corrections.size) console.log('\naucune balise à poser : aucun lot écrit.');
    else {
      const { lot, bilan } = lotDeSourceParModification(cheminBase({ sansExemples: false }), (copie) => poserLeMaillage(copie, corrections), { titre: option('--titre') });
      writeFileSync(resolve(sortie), `${JSON.stringify(lot, null, 2)}\n`);
      console.log(`\nlot « ${option('--titre')} » (source) : ${bilan.operations} opération(s) -> ${resolve(sortie)} (à PROPOSER au site de dev par un humain : POST /api/edition/lots/ ; l'outil n'envoie rien)`);
    }
  }
}
