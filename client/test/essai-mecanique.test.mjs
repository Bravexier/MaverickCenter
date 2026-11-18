// Essai mécanique des tests, passes du site de dev (lot 10, R278 ; scripts/essai-mecanique-tests.mjs, scripts/essai-variantes.mjs) : chaque variante est
// une modification que le site de dev peut faire, fabriquée sans rompre la base (clés étrangères, CHECK, intégrité) ; le tri compte une variante
// seulement sur les fichiers qui passent C. Les lignes visées sont lues dans l'extrait d'essai, jamais supposées.
//   node --test test/essai-mecanique.test.mjs
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { trierLesPassesDuSite } from '../scripts/essai-mecanique-tests.mjs';
import { TABLES_AJOUTEES, TABLES_VIDEES, VARIANTES } from '../scripts/essai-variantes.mjs';
import { ICONES } from '../src/lib/icones.mjs';
import { normalize } from '../src/lib/text.mjs';
import { copieDEssai, empreinteDuFichier, extraitDEssai } from './aide-contenu-fourni.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';

const compte = (db, table) => db.prepare(`SELECT count(*) AS n FROM "${table}"`).get().n;

/** Applique la variante à une copie de l'extrait ; rend { rapport, avant (comptes), apres (comptes), db (copie ouverte en lecture) }. */
function variante(t, nom, tables = []) {
  const dossier = dossierTemporaire(`essai-variante-${nom}`, { t });
  let rapport;
  const avant = {};
  const chemin = copieDEssai(dossier, (db) => {
    for (const table of tables) avant[table] = compte(db, table);
    rapport = VARIANTES[nom](db);
  });
  const db = new DatabaseSync(chemin, { readOnly: true });
  t.after(() => db.close());
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), [], `${nom} : aucune clé étrangère rompue`);
  assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
  for (const r of rapport.refusees) assert.ok(r.table && r.raison, `${nom} : un refus dit sa table et sa raison`);
  return { rapport, avant, db };
}

test('l’extrait d’essai n’est jamais modifié par une variante', (t) => {
  const avant = empreinteDuFichier(extraitDEssai());
  for (const nom of Object.keys(VARIANTES)) variante(t, nom);
  assert.equal(empreinteDuFichier(extraitDEssai()), avant);
});

test('V1 : des icônes de la liste du site, sur des mots-clés de plusieurs genres', (t) => {
  const { rapport, db } = variante(t, 'V1');
  assert.ok(rapport.faites.length > 0);
  const valeurs = new Set(ICONES.map((i) => i.valeur));
  for (const f of rapport.faites) assert.equal(db.prepare('SELECT icone FROM mot_cle WHERE id = ?').get(f.id).icone, f.icone);
  assert.ok(rapport.faites.every((f) => valeurs.has(f.icone)), 'seulement des icônes que le site propose (lib/icones.mjs)');
  const genres = new Set(rapport.faites.map((f) => f.groupe.split(':')[0]));
  assert.ok(genres.has('categorie') && genres.has('page'), 'des catégories de mots-clés et des types de page');
  assert.ok(new Set(rapport.faites.map((f) => f.groupe)).size >= 3, 'plusieurs groupes, pas seulement les magies');
});

test('V2 : une magie renommée garde son identifiant ; sa clé suit le nom (normalize)', (t) => {
  const { rapport, db } = variante(t, 'V2');
  assert.equal(rapport.faites.length, 1);
  const [f] = rapport.faites;
  const apres = db.prepare('SELECT nom, nom_cle FROM magie WHERE id = ?').get(f.id);
  assert.notEqual(apres.nom, f.avant);
  assert.equal(apres.nom, f.apres);
  assert.equal(apres.nom_cle, normalize(apres.nom));
  const origine = new DatabaseSync(extraitDEssai(), { readOnly: true });
  t.after(() => origine.close());
  assert.equal(compte(db, 'magie'), compte(origine, 'magie'));
});

test('V3 : une ligne de plus dans des tables que le site sait créer, sous une clé nouvelle', (t) => {
  const { rapport, avant, db } = variante(t, 'V3', TABLES_AJOUTEES);
  assert.ok(rapport.faites.length >= 3, `au moins trois tables (refus : ${JSON.stringify(rapport.refusees)})`);
  const origine = new DatabaseSync(extraitDEssai(), { readOnly: true });
  t.after(() => origine.close());
  for (const f of rapport.faites) {
    assert.equal(compte(db, f.table), avant[f.table] + 1, f.table);
    const ou = Object.keys(f.cle).map((c) => `"${c}" = ?`).join(' AND ');
    assert.ok(db.prepare(`SELECT 1 AS x FROM "${f.table}" WHERE ${ou}`).get(...Object.values(f.cle)), `${f.table} : la ligne ajoutée est là`);
    assert.equal(origine.prepare(`SELECT 1 AS x FROM "${f.table}" WHERE ${ou}`).get(...Object.values(f.cle)), undefined, `${f.table} : sa clé est nouvelle`);
  }
  for (const r of rapport.refusees) assert.equal(compte(db, r.table), avant[r.table], `${r.table} : un ajout refusé ne laisse rien`);
});

test('V4 : une ligne de moins dans des tables que le site sait vider, choisie sans dépendant', (t) => {
  const { rapport, avant, db } = variante(t, 'V4', TABLES_VIDEES);
  assert.ok(rapport.faites.length >= 2, `au moins deux tables (refus : ${JSON.stringify(rapport.refusees)})`);
  for (const f of rapport.faites) {
    assert.equal(compte(db, f.table), avant[f.table] - 1, f.table);
    const [[k, v]] = Object.entries(f.cle);
    assert.equal(db.prepare(`SELECT 1 AS x FROM "${f.table}" WHERE "${k}" = ?`).get(v), undefined);
    assert.equal(db.prepare('SELECT count(*) AS n FROM page_entite WHERE entite_table = ? AND entite_id = ?').get(f.table, String(v)).n, 0, 'son rattachement à une page part avec elle');
  }
  for (const r of rapport.refusees) assert.equal(compte(db, r.table), avant[r.table]);
});

test('tri des passes du site : C compte ce qui lit encore le dépôt ; une variante ne compte que les fichiers qui passent C', () => {
  const m = (lignes) => new Map(lignes.map(([fichier, code]) => [fichier, { fichier, code }]));
  const { passes, fichiers, md } = trierLesPassesDuSite({
    C: m([['a.test.mjs', 0], ['b.test.mjs', 1], ['c.test.mjs', 0]]),
    V1: m([['a.test.mjs', 1], ['b.test.mjs', 1], ['c.test.mjs', 0]]),
    V3: m([['a.test.mjs', 0], ['b.test.mjs', 0], ['c.test.mjs', 'delai']]),
  }, (passe, fichier) => `not ok 1\n  error: échec de ${fichier} sur ${passe}\n`);
  assert.deepEqual(passes.C, { mesures: 3, passent: 2, cassent: ['b.test.mjs'] });
  assert.deepEqual(passes.V1, { mesures: 3, figent_une_valeur: ['a.test.mjs'], deja_casses_par_C: 1 });
  assert.deepEqual(passes.V3, { mesures: 3, figent_une_valeur: ['c.test.mjs'], deja_casses_par_C: 0 });
  assert.equal(passes.V2, undefined, 'une passe non lancée n’apparaît pas');
  assert.deepEqual(fichiers.find((f) => f.fichier === 'a.test.mjs'), { fichier: 'a.test.mjs', C: 'passe', V1: 'casse', V3: 'passe', causes: { V1: 'error: échec de a.test.mjs sur V1' } });
  assert.ok(md.some((l) => l.startsWith('## Passe V1')));
});
