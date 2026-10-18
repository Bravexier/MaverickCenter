// Les pages du guide ne portent plus de numéro de chapitre ni de partie (migration data/migrations/0064-guide-sans-chapitres.sql ; demande du
// propriétaire, 2026-10-16 puis 2026-10-18 : « éclater le guide ») : le plan du site (lib/livres.mjs) range les pages, ordre de lecture et couleurs
// compris. Le registre de la migration (0064-guide-sans-chapitres.json) garde la trace de ce qui est parti : les 24 chapitres de l'ancien guide, leur
// numéro et leur partie. Ici : le registre est complet et s'accorde au SQL de la migration ; plus aucune page de la base n'a ces clés, plus rien ne
// les déclare ni ne les lit ; les livres gardent l'ordre de lecture de l'ancien guide et chaque ancien chapitre a sa place dans le plan.
//   node --test test/guide-sans-chapitres.test.mjs
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { estDansUnLivre, estDuGuideDuMj, groupeDeLaPage, LIVRES, livreDe, PARTIES, pagesDuLivre } from '../src/lib/livres.mjs';

const racine = (chemin) => fileURLToPath(new URL(`../../${chemin}`, import.meta.url));
const lire = (chemin) => readFileSync(racine(chemin), 'utf8');
const registre = JSON.parse(lire('data/migrations/0064-guide-sans-chapitres.json'));
const migration = lire('data/migrations/0064-guide-sans-chapitres.sql');
const db = ouvrirBase({ sansExemples: false });
const parId = new Map(registre.pages.map((p) => [p.id, p]));

test('registre de la migration 0064 : les 24 chapitres de l’ancien guide, numérotés de 1 à 24 sans trou, chacun dans une partie connue, dans l’ordre des parties', () => {
  assert.equal(registre.migration, '0064-guide-sans-chapitres');
  assert.equal(registre.pages.length, 24);
  assert.equal(parId.size, 24, 'aucune page deux fois');
  assert.deepEqual(registre.pages.map((p) => p.chapitre), Array.from({ length: 24 }, (_, i) => i + 1));
  const ordreDesParties = PARTIES.map((p) => p.id);
  let derniere = 0;
  for (const p of registre.pages) {
    assert.match(p.id, /^guide\/[a-z0-9-]+$/, p.id);
    assert.deepEqual(Object.keys(p).sort(), ['chapitre', 'id', 'partie'], p.id);
    const rang = ordreDesParties.indexOf(p.partie);
    assert.ok(rang >= 0, `${p.id} : partie inconnue ${p.partie}`);
    assert.ok(rang >= derniere, `${p.id} : la partie ${p.partie} revient après une partie suivante`);
    derniere = rang;
  }
  // chaque page du registre existe toujours (son identifiant ne change jamais)
  for (const p of registre.pages) {
    assert.equal(db.prepare("SELECT count(*) AS n FROM page WHERE id = ? AND type = 'guide'").get(p.id).n, 1, `${p.id} n’existe plus`);
  }
});

test('le SQL de la migration est le registre : chaque page n’est vidée que si son objet est exactement celui de l’import (rien d’autre dans `donnees`)', () => {
  const paires = [...migration.matchAll(/\('(guide\/[a-z0-9-]+)', '(\{[^']*\})'\)/g)].map((m) => [m[1], m[2]]);
  assert.equal(paires.length, registre.pages.length);
  // chaque page du registre exactement une fois (un doublon ne cache pas une page absente)
  assert.deepEqual(paires.map(([id]) => id).sort(), registre.pages.map((p) => p.id).sort());
  for (const [id, donnees] of paires) {
    const p = parId.get(id);
    assert.ok(p, `${id} : absente du registre`);
    // l'écriture de tools/db/pages_md.py (json.dumps, ensure_ascii=False) : « {"chapitre": N, "partie": "…"} »
    assert.equal(donnees, `{"chapitre": ${p.chapitre}, "partie": "${p.partie}"}`, id);
    assert.deepEqual(Object.keys(JSON.parse(donnees)), ['chapitre', 'partie'], id);
  }
  assert.match(migration, /UPDATE page SET donnees = NULL\s+WHERE type = 'guide' AND \(id, donnees\) IN \(VALUES/);
  // une migration de données : ni transaction, ni PRAGMA (tools/db/maverick.py#migrer les gère), ni autre table touchée
  assert.doesNotMatch(migration.replace(/^--.*$/gm, ''), /\b(BEGIN|COMMIT|PRAGMA|INSERT|DELETE|ALTER|CREATE|DROP)\b/i);
  assert.equal([...migration.replace(/^--.*$/gm, '').matchAll(/\bUPDATE\b/gi)].length, 1);
});

test('la base : plus aucune page (de tout type) ne porte « chapitre » ou « partie » dans `donnees`', () => {
  const restes = db.prepare(`SELECT id FROM page WHERE donnees IS NOT NULL
    AND (json_type(donnees, '$.chapitre') IS NOT NULL OR json_type(donnees, '$.partie') IS NOT NULL) ORDER BY id`).all().map((r) => r.id);
  assert.deepEqual(restes, []);
});

test('plus rien ne les déclare (content.config.ts) ni ne les lit (site, service, scripts, importeurs)', () => {
  const config = lire('client/src/content.config.ts');
  assert.doesNotMatch(config, /^\s*(chapitre|partie)\s*:/m, 'content.config.ts déclare encore chapitre ou partie');
  // une lecture de ces clés de page.donnees ou du frontmatter : chemin JSON, data.chapitre, `donnees` et la clé sur la même ligne, déstructuration
  // (« const { chapitre } = … »), ou une propriété d'un objet nommé comme un frontmatter (fm, frontmatter) — hors commentaires ; une recherche par
  // motifs : une lecture écrite autrement lui échapperait
  const lecture = [/\$\.(chapitre|partie)\b/, /\bdata\??\.(chapitre|partie)\b/, /\bdonnees\b.*\b(chapitre|partie)\b/, /\[['"](chapitre|partie)['"]\]/, /\.get\(['"](chapitre|partie)['"]/,
    /\{[^}]*\b(chapitre|partie)\b[^}]*\}\s*=[^=>]/, /\b(fm|frontmatter)\??\.(chapitre|partie)\b/];
  const commentaire = /^\s*(\/\/|\*|\/\*|#|--)/;
  const fichiers = [];
  const parcourir = (dossier) => {
    for (const nom of readdirSync(dossier)) {
      if (nom === 'node_modules' || nom === '__pycache__' || nom === 'content') continue;
      const chemin = join(dossier, nom);
      if (statSync(chemin).isDirectory()) parcourir(chemin);
      else if (/\.(mjs|js|ts|astro|py)$/.test(nom)) fichiers.push(chemin);
    }
  };
  for (const d of ['client/src', 'client/serveur', 'client/scripts', 'tools']) parcourir(racine(d));
  assert.ok(fichiers.length > 100, `${fichiers.length} fichiers lus`);
  const trouves = [];
  for (const f of fichiers) {
    readFileSync(f, 'utf8').split('\n').forEach((ligne, i) => {
      if (!commentaire.test(ligne) && lecture.some((re) => re.test(ligne))) trouves.push(`${f.slice(racine('').length)}:${i + 1} ${ligne.trim().slice(0, 120)}`);
    });
  }
  assert.deepEqual(trouves, []);
});

test('le plan garde l’ordre de lecture de l’ancien guide, et chaque ancien chapitre y a sa place (livre ou Règles avancées)', () => {
  for (const livre of LIVRES) {
    const numeros = pagesDuLivre(livre).map((p) => parId.get(p.id)?.chapitre).filter((n) => n !== undefined);
    assert.ok(numeros.length > 0, livre.titre);
    assert.deepEqual(numeros, [...numeros].sort((a, b) => a - b), `${livre.titre} : les anciens chapitres ne sont plus dans l’ordre (${numeros.join(', ')})`);
  }
  for (const p of registre.pages) {
    const place = livreDe(p.id) ? 'livre' : estDuGuideDuMj(p.id) ? 'mj' : groupeDeLaPage(p.id) ? 'avancees' : null;
    assert.ok(place, `${p.id} (ancien chapitre ${p.chapitre}) n’a plus de place`);
  }
  // les deux anciens chapitres hors des livres : le Mode Hyper (20) et les documents des règles (24), dans les Règles avancées
  assert.deepEqual(registre.pages.filter((p) => !estDansUnLivre(p.id)).map((p) => [p.chapitre, groupeDeLaPage(p.id)?.id]),
    [[20, 'magie-et-mode-hyper'], [24, 'autres']]);
});
