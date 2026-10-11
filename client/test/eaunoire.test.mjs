// La déesse de la Corruption s'appelle « Eaunoire », en un seul mot (décision R21 du propriétaire, migration data/migrations/0012-eaunoire.sql) :
// son nom est corrigé partout dans la base, son identifiant ne change pas, et le sort « Eau noire » de la Corruption garde le sien.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { chargerMagiesDuGuide } from '../src/lib/guide-db.mjs';
import { TABLES_DES_NOTES } from '../src/lib/notes-de-version.mjs';

const db = ouvrirBase({ sansExemples: false });

test('le dieu de la Corruption s’appelle Eaunoire, sous son identifiant d’origine', () => {
  assert.deepEqual(
    db.prepare("SELECT d.id, d.nom FROM magie_dieu md JOIN dieu d ON d.id = md.dieu_id WHERE md.magie_id = 'magies/magie-de-la-corruption'").all().map((d) => ({ ...d })),
    [{ id: 'demon-deau-noire', nom: 'Eaunoire' }],
  );
  assert.deepEqual(chargerMagiesDuGuide(db).find((m) => m.nom === 'Corruption').dieux, ['Eaunoire'], 'le guide du joueur suit la base');
});

test('aucune colonne de texte d’aucune table n’écrit plus « Démon d’Eau Noire »', () => {
  // hors section 15 (notes de version, historique des modifications du site) : des traces, qui citent la production d'avant la livraison (master
  // peut précéder la migration 0012) et les valeurs au moment de chaque modification (lib/notes-de-version.mjs#TABLES_DES_NOTES)
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT GLOB '*_fts*'").all().map((r) => r.name)
    .filter((t) => !TABLES_DES_NOTES.includes(t));
  const trouves = [];
  for (const t of tables) {
    for (const c of db.prepare(`PRAGMA table_info("${t}")`).all().filter((c) => /TEXT/i.test(c.type))) {
      // LIKE ignore la casse des lettres ASCII : « Démon d'Eau Noire » comme « démon d'eau noire »
      const n = db.prepare(`SELECT count(*) AS n FROM "${t}" WHERE "${c.name}" LIKE '%mon d''eau noire%' OR "${c.name}" LIKE '%mon d’eau noire%'`).get().n;
      if (n) trouves.push(`${t}.${c.name} : ${n}`);
    }
  }
  assert.deepEqual(trouves, []);
});

test('l’Elfe noir doit sa fuite à Eaunoire, sur sa page comme dans son onglet', () => {
  const phrase = 'après une fuite possible grâce à Eaunoire.';
  assert.ok(db.prepare("SELECT description_generale FROM race_onglet WHERE race_id = 'races/elfe-noir'").get().description_generale.includes(phrase));
  assert.ok(db.prepare("SELECT corps_md FROM page WHERE id = 'races/elfe-noir'").get().corps_md.includes(phrase));
});

test('le sort « Eau noire » de la Corruption n’est pas la déesse : il garde son nom', () => {
  assert.deepEqual({ ...db.prepare("SELECT nom, nom_cle FROM sort WHERE id = 'magies/magie-de-la-corruption#sort:eau-noire'").get() }, { nom: 'Eau noire', nom_cle: 'eau-noire' });
});
