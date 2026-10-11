// Ce que le site de dev a modifié revient dans data/rows (npm run db:appliquer-edition, « Effectuer la mise à jour ») sans casser les outils des
// pages : une page créée par le site a sa provenance (source « Site de dev › … », que tools/db/pages_md.py rattache à la famille de son type), le JSON
// des champs structurés d'une page (page.donnees) est écrit comme l'écrivent les importeurs (une page réécrite sans changement reste identique), et
// des lots enregistrés dans la même seconde sont rejoués dans leur ordre par db:appliquer-edition comme par la mise à jour des règles.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { appendFileSync, cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { appliquerJournal } from '../scripts/db-appliquer-edition.mjs';
import { appliquerMiseAJour } from '../scripts/mise-a-jour-regles.mjs';
import { ouvrirBaseVivante, preparerBaseVivante } from '../serveur/base-vivante.mjs';
import { enregistrer, FAMILLE_DES_PAGES_DU_SITE } from '../serveur/edition.mjs';
import { journalExporte } from '../serveur/edition-journal.mjs';
import { cheminBase } from '../src/lib/donnees.mjs';
import { jsonCommePython } from '../src/lib/json-python.mjs';
import { emettrePage, lirePages } from '../src/lib/pages-db.mjs';

const RACINE = fileURLToPath(new URL('../../', import.meta.url));
const ROWS = join(RACINE, 'data', 'rows');
const sansPython = spawnSync('python3', ['--version']).error ? 'python3 absent' : false;
const tmp = mkdtempSync(join(tmpdir(), 'maverick-rapatriement-pages-'));
after(() => rmSync(tmp, { recursive: true, force: true }));

/** La base reconstruite depuis un dossier de lignes (scripts/db-build.mjs). */
function construire(rows, nom) {
  const sortie = join(tmp, `${nom}.db`);
  const r = spawnSync(process.execPath, ['--no-warnings', join(RACINE, 'client', 'scripts', 'db-build.mjs'), '--out', sortie, '--rows', rows], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  return new DatabaseSync(sortie, { readOnly: true });
}
const pagesMd = (...args) => spawnSync('python3', ['-I', join(RACINE, 'tools', 'db', 'pages_md.py'), ...args], { encoding: 'utf8' });
const copie = (nom) => {
  const d = join(tmp, nom, 'rows');
  cpSync(ROWS, d, { recursive: true });
  return d;
};

// --- des modifications faites sur le site de dev -----------------------------------------------------------------------------------------------
const vivante = ouvrirBaseVivante(preparerBaseVivante({ regles: cheminBase({ sansExemples: false }), dossier: join(tmp, 'db') }).chemin);
const lire = (sql, ...p) => vivante.prepare(sql).get(...p);
const nomLibre = (table, base) => {
  for (let i = 1; ; i += 1) {
    const nom = i === 1 ? base : `${base} ${i}`;
    if (!lire(`SELECT 1 FROM "${table}" WHERE nom = ?`, nom)) return nom;
  }
};
let horloge = Date.parse('2026-10-11T08:00:00Z');
const lot = (operations, { instant = new Date((horloge += 1000)).toISOString().replace(/\.\d{3}Z$/, 'Z') } = {}) => {
  const r = enregistrer(vivante, { page: 'essai/', operations }, { instant });
  assert.ok(r.lot, JSON.stringify(operations));
  return r;
};

const noms = { metier: nomLibre('metier', 'Métier d’essai'), race: nomLibre('race', 'Race d’essai'), classe: nomLibre('classe', 'Classe d’essai'), jetable: nomLibre('metier', 'Métier jetable') };
const crees = lot([
  { op: 'creer', entite: 'metier', valeurs: { nom: noms.metier, description: 'Il essaie.', bonus_brut: '+3% Calme' } },
  { op: 'creer', entite: 'race', valeurs: { nom: noms.race, nature: 'hybride', presentation: 'Une race d’essai.' } },
  { op: 'creer', entite: 'classe', valeurs: { nom: noms.classe, categorie_id: 'classe-magique' } },
]).crees.map((c) => c.id);
// un don créé dans la classe créée (D11) : sa fiche capacites/… est de la famille des classes, sa seule source est sa provenance
crees.push(lot([{ op: 'creer', entite: 'capacite', valeurs: { classe_id: crees[2], niveau: '1', nom: 'Don d’essai', type: 'Passif', effet: 'Il essaie aussi.' } }]).crees[0].id);
assert.ok(crees[3].startsWith('capacites/'));
// un métier créé un autre jour puis supprimé : sa source (« Site de dev › édition du 2026-10-12 ») n'est plus citée, elle part avec lui
const jetable = lot([{ op: 'creer', entite: 'metier', valeurs: { nom: noms.jetable } }], { instant: '2026-10-12T08:00:00Z' }).crees[0].id;
lot([{ op: 'supprimer', entite: 'metier', cle: { id: jetable } }], { instant: '2026-10-12T08:00:01Z' });

// pages réécrites par le service puis revenues à leur contenu : magies innées d'une race de la matrice, nom d'une spécialité, type d'un don
const pagesD2 = {};
const garder = (id) => (pagesD2[id] = lire('SELECT donnees FROM page WHERE id = ?', id).donnees);
const raceMatrice = lire("SELECT r.id FROM race r JOIN page p ON p.id = r.id WHERE r.id NOT IN (SELECT race_id FROM race_magie_onglet) AND p.donnees LIKE '%magies_innees%' ORDER BY r.id LIMIT 1").id;
garder(raceMatrice);
const innees = vivante.prepare('SELECT magie_id FROM race_magie WHERE race_id = ? AND accessible = 1').all(raceMatrice).map((m) => m.magie_id);
const absente = lire('SELECT magie_id FROM race_magie WHERE race_id = ? AND accessible = 0 LIMIT 1', raceMatrice)?.magie_id;
if (absente) lot([{ op: 'magies_innees', race: raceMatrice, magies: [...innees, absente] }]);
lot([{ op: 'magies_innees', race: raceMatrice, magies: innees.slice(1) }]);
lot([{ op: 'magies_innees', race: raceMatrice, magies: innees }]);
const specialite = lire("SELECT sp.id, sp.nom, c.id AS don FROM specialite sp JOIN capacite c ON c.specialite_id = sp.id JOIN page p ON p.id = c.id WHERE json_extract(p.donnees, '$.specialite') = sp.nom ORDER BY sp.id LIMIT 1");
garder(specialite.don);
lot([{ op: 'modifier', table: 'specialite', cle: { id: specialite.id }, valeurs: { nom: `${specialite.nom} BIS` } }]);
lot([{ op: 'modifier', table: 'specialite', cle: { id: specialite.id }, valeurs: { nom: specialite.nom } }]);
const don = lire("SELECT c.id, c.type_brut FROM capacite c JOIN page p ON p.id = c.id WHERE json_extract(p.donnees, '$.type_capacite') = c.type_brut AND c.type_brut = 'Passif' ORDER BY c.id LIMIT 1");
garder(don.id);
lot([{ op: 'modifier', table: 'capacite', cle: { id: don.id }, valeurs: { type_brut: 'Action (1 fois/Combat)' } }]);
lot([{ op: 'modifier', table: 'capacite', cle: { id: don.id }, valeurs: { type_brut: don.type_brut } }]);

// dix lots dans la même seconde sur le même champ : seul l'ordre d'enregistrement donne la bonne valeur finale
const memeSeconde = new Date((horloge += 1000)).toISOString().replace(/\.\d{3}Z$/, 'Z');
const bonus = Array.from({ length: 10 }, (_, i) => `+${i + 1}% Arme lourde`);
for (const b of bonus) lot([{ op: 'modifier', table: 'metier', cle: { id: 'metiers/forgeron' }, valeurs: { bonus_brut: b } }], { instant: memeSeconde });

const journal = journalExporte(vivante);
const etatVivant = Object.fromEntries(Object.keys(pagesD2).map((id) => [id, lire('SELECT donnees FROM page WHERE id = ?', id).donnees]));
vivante.close();

test('page.donnees écrit comme json.dumps de Python : toutes les pages de data/rows se réécrivent à l’identique ; une page réécrite sans changement reste identique', () => {
  const db = construire(ROWS, 'reference');
  for (const p of db.prepare('SELECT id, donnees FROM page WHERE donnees IS NOT NULL').all()) assert.equal(jsonCommePython(JSON.parse(p.donnees)), p.donnees, p.id);
  db.close();
  assert.equal(jsonCommePython({ a: 'é "x"\n', n: 20, l: ['b', 'c'], vide: [], o: {} }), '{"a": "é \\"x\\"\\n", "n": 20, "l": ["b", "c"], "vide": [], "o": {}}');
  assert.deepEqual(etatVivant, pagesD2, 'magies innées, spécialité, type du don : revenus à leur valeur, octet pour octet');
});

test('pages créées par le site : chacune a sa source « Site de dev › édition du … » (provenance), toute page hors exemple en a au moins une', () => {
  const v = ouvrirBaseVivante(join(tmp, 'db', 'vivante.db'));
  try {
    for (const id of crees) {
      const sources = v.prepare('SELECT s.id, s.nature, s.texte FROM page_source ps JOIN source s ON s.id = ps.source_id WHERE ps.page_id = ? ORDER BY ps.ordre').all(id).map((s) => ({ ...s }));
      assert.deepEqual(sources, [{ id: 'ref:site-de-dev-edition-du-2026-10-11', nature: 'libelle', texte: 'Site de dev › édition du 2026-10-11' }], id);
      const page = v.prepare('SELECT type, origine, source_ref FROM page WHERE id = ?').get(id);
      assert.equal(page.origine, FAMILLE_DES_PAGES_DU_SITE[page.type], id);
      assert.equal(page.source_ref, sources[0].texte);
    }
    assert.deepEqual(v.prepare("SELECT id FROM page p WHERE statut <> 'example' AND NOT EXISTS (SELECT 1 FROM page_source ps WHERE ps.page_id = p.id)").all(), []);
    assert.equal(v.prepare("SELECT count(*) AS n FROM source WHERE id = 'ref:site-de-dev-edition-du-2026-10-12'").get().n, 0, 'source du métier supprimé retirée');
    assert.deepEqual(v.prepare('SELECT id FROM source WHERE id NOT IN (SELECT source_id FROM page_source)').all(), [], 'aucune source orpheline');
  } finally {
    v.close();
  }
});

test('db:appliquer-edition puis db:pages-check et db:sync-pages : data/rows et les .md fabriqués restent d’accord ; une page créée se resynchronise dans sa famille', { skip: sansPython }, () => {
  const rows = copie('appliquer');
  const r = appliquerJournal(journal, { rows });
  assert.equal(r.ecrit, true, JSON.stringify(r.conflits));
  assert.deepEqual(r.conflits, []);
  const db = construire(rows, 'appliquee');
  assert.equal(db.prepare("SELECT bonus_brut FROM metier WHERE id = 'metiers/forgeron'").get().bonus_brut, bonus.at(-1), 'lots de la même seconde rejoués dans leur ordre');
  assert.deepEqual(db.prepare("SELECT id FROM page p WHERE statut <> 'example' AND NOT EXISTS (SELECT 1 FROM page_source ps WHERE ps.page_id = p.id)").all(), []);
  assert.deepEqual(db.prepare('SELECT id FROM source WHERE id NOT IN (SELECT source_id FROM page_source)').all(), []);
  for (const [id, donnees] of Object.entries(pagesD2)) assert.equal(db.prepare('SELECT donnees FROM page WHERE id = ?').get(id).donnees, donnees, id);
  // les .md tels que db:export-pages les fabrique depuis ces lignes
  const wiki = join(tmp, 'appliquer', 'wiki');
  const pages = lirePages(db);
  db.close();
  for (const p of pages) {
    mkdirSync(join(wiki, p.type), { recursive: true });
    writeFileSync(join(wiki, p.type, `${p.slug}.md`), emettrePage(p));
  }
  const check = pagesMd('check', '--rows', rows, '--wiki', wiki);
  assert.equal(check.status, 0, check.stdout + check.stderr);
  assert.match(check.stdout, /est à jour/);
  const sync = pagesMd('sync', '--rows', rows, '--wiki', wiki);
  assert.equal(sync.status, 0, sync.stdout + sync.stderr);
  assert.match(sync.stdout, /déjà à jour/);
  // une page créée par le site, modifiée à la main : pages_md la rattache à la même famille que la base (sinon : « importeur de famille requis »)
  for (const id of crees) appendFileSync(join(wiki, `${id}.md`), '\nUne ligne ajoutée à la main.\n');
  const resync = pagesMd('sync', '--rows', rows, '--wiki', wiki);
  assert.equal(resync.status, 0, resync.stdout + resync.stderr);
  assert.match(resync.stdout, new RegExp(`${crees.length} page\\(s\\) mise\\(s\\) à jour`));
  assert.equal(pagesMd('check', '--rows', rows, '--wiki', wiki).status, 0);
});

test('mise à jour des règles (Effectuer la mise à jour) : les lots de la même seconde rejoués et historisés dans leur ordre', () => {
  const rows = copie('mise-a-jour');
  const memes = { ...journal, lots: journal.lots.filter((l) => l.fait_le === memeSeconde) };
  assert.equal(memes.lots.length, bonus.length);
  const r = appliquerMiseAJour({ format: 'maverick-mise-a-jour/1', id: '11111111-2222-3333-4444-555555555555', cree_le: memeSeconde, version_dev: '0.1.76', version_cible: '0.2', texte: null, journal: memes },
    { rows, reference: 'HEAD', date: '2026-10-11', versionDev: '0.1.76' });
  assert.ok(r.fichiers.includes('metier.sql'), r.fichiers.join(', '));
  const db = construire(rows, 'mise-a-jour');
  assert.equal(db.prepare("SELECT bonus_brut FROM metier WHERE id = 'metiers/forgeron'").get().bonus_brut, bonus.at(-1));
  // les modifications de cette mise à jour (version 0.2) : data/rows peut déjà en historiser d'autres (rapatriées ou livrées avant)
  const historique = db.prepare("SELECT apres FROM historique_modification WHERE table_nom = 'metier' AND version = '0.2' ORDER BY fait_le, lot_id, rang").all().map((h) => JSON.parse(h.apres).bonus_brut);
  assert.deepEqual(historique, bonus);
  db.close();
  // la copie n'a jamais touché data/rows
  assert.equal(readFileSync(join(ROWS, 'metier.sql'), 'utf8').includes(bonus.at(-1)), false);
});
