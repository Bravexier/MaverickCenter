// Décision R169 (migration 0082-r169-livre-de-sort) : le livre de sort se note indépendamment de la liste des sorts, dans personnage_livre_sort (un par
// sort : R26) ; la colonne personnage_sort.nm_livre disparaît. Une fiche d'avant garde ses livres : chaque sort dont nm_livre = 1 devient un livre, rangé
// dans l'ordre de la liste ; le NM de chaque sort (niveau_maitrise, livre compris) ne change pas. Les tables des fiches sont vides dans data/rows : le test
// remet une COPIE de la base construite dans l'état d'avant 0082 (sans personnage_livre_sort, avec la colonne nm_livre), y pose des fiches, puis rejoue
// la migration (test/aide-migration-rejouee.mjs : les vues reprennent ensuite leur définition de data/schema.sql). Les règles de la vue : test/personnages-db.test.mjs.
import assert from 'node:assert/strict';
import { copyFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { cheminBase } from '../src/lib/donnees.mjs';
import { fichierTemporaire } from './aide-dossier-temporaire.mjs';
import { rejouerLaMigration, vuesCourantes } from './aide-migration-rejouee.mjs';

const base = cheminBase({ sansExemples: false });
const copie = fichierTemporaire('maverick.db', 'maverick-0082-');
copyFileSync(base, copie);
const db = new DatabaseSync(copie);

const INSTANT = '2026-10-29T12:00:00Z';
const SORTS = db.prepare("SELECT id FROM sort WHERE magie_id = 'magies/magie-du-feu' AND niveau = 1 ORDER BY id LIMIT 4").all().map((s) => s.id);
const colonnes = (d, table) => d.prepare(`SELECT name, type, "notnull", dflt_value, pk FROM pragma_table_info('${table}') ORDER BY cid`).all().map((c) => ({ ...c }));

function inserer(table, ligne) {
  const cols = Object.keys(ligne);
  db.prepare(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`).run(...Object.values(ligne));
}
function fiche(id, sorts) {
  inserer('personnage', {
    id, nature: 'joueur', proprietaire_id: 'joueuse', visibilite: 'privee', nom: `Fiche ${id}`, magie_innee_id: 'magies/magie-du-feu', mode_classe: 'mono',
    xp: 1650, alignement_loyal: 0, alignement_chaotique: 0, alignement_bon: 0, alignement_mauvais: 0, bourse_pp: 0, bourse_ro: 0, bourse_rf: 0, ambidextrie: 0,
    cree_le: INSTANT, modifie_le: INSTANT,
  });
  for (const [rang, [sort, nm, livre]] of sorts.entries()) {
    inserer('personnage_sort', { personnage_id: id, sort_id: SORTS[sort], rang: rang + 1, niveau_maitrise: nm, nm_livre: livre });
  }
}

// l'état d'avant 0082 : ni la table des livres, ni sa vue ; la colonne nm_livre (0021, contrainte de 0066), en dernier ici (la migration la retire)
db.exec(`DROP VIEW v_personnage_controle;
  DROP TABLE personnage_livre_sort;
  ALTER TABLE personnage_sort ADD COLUMN nm_livre INTEGER NOT NULL DEFAULT 0 CHECK (nm_livre IN (0, 1) AND nm_livre <= niveau_maitrise);
  CREATE VIEW v_personnage_controle AS SELECT NULL AS personnage_id, NULL AS regle, NULL AS detail;`);
inserer('utilisateur', { id: 'joueuse', discord_id: null, nom_affichage: 'joueuse', cree_le: INSTANT });
fiche('deux-livres', [[0, 2, 0], [1, 2, 1], [2, 1, 1], [3, 0, 0]]);   // livres aux rangs 2 et 3 de la liste
fiche('un-livre', [[3, 3, 0], [2, 3, 1]]);
fiche('sans-livre', [[0, 1, 0]]);
const NM_AVANT = db.prepare('SELECT personnage_id, sort_id, rang, niveau_maitrise FROM personnage_sort ORDER BY personnage_id, rang').all().map((r) => ({ ...r }));

const vuesRefaites = rejouerLaMigration(db, '0082-r169-livre-de-sort.sql');
db.exec('PRAGMA foreign_keys = ON');

test('migration 0082 (R169) : chaque sort qui avait son livre en garde un, rangé dans l’ordre de la liste ; le NM des sorts ne change pas', () => {
  assert.deepEqual(db.prepare('SELECT personnage_id, sort_id, rang FROM personnage_livre_sort ORDER BY personnage_id, rang').all().map((r) => ({ ...r })), [
    { personnage_id: 'deux-livres', sort_id: SORTS[1], rang: 1 },
    { personnage_id: 'deux-livres', sort_id: SORTS[2], rang: 2 },
    { personnage_id: 'un-livre', sort_id: SORTS[2], rang: 1 },
  ]);
  assert.deepEqual(db.prepare('SELECT personnage_id, sort_id, rang, niveau_maitrise FROM personnage_sort ORDER BY personnage_id, rang').all().map((r) => ({ ...r })), NM_AVANT);
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
});

test('migration 0082 : nm_livre retirée, personnage_sort et personnage_livre_sort comme dans data/schema.sql, la vue de contrôle refaite', () => {
  const neuve = new DatabaseSync(base, { readOnly: true });
  try {
    for (const table of ['personnage_sort', 'personnage_livre_sort']) assert.deepEqual(colonnes(db, table), colonnes(neuve, table), table);
  } finally {
    neuve.close();
  }
  assert.ok(!colonnes(db, 'personnage_sort').some((c) => c.name === 'nm_livre'));
  assert.deepEqual(vuesRefaites, [], 'la migration recrée v_personnage_controle telle que data/schema.sql');
  assert.equal(db.prepare("SELECT sql FROM sqlite_master WHERE name = 'v_personnage_controle'").get().sql,
    vuesCourantes().find((v) => v.name === 'v_personnage_controle').sql);
  assert.deepEqual(db.prepare("SELECT regle, detail FROM v_personnage_controle WHERE personnage_id = 'un-livre' AND regle LIKE 'sort%'").all().map((r) => ({ ...r })),
    [{ regle: 'sorts_nm_total', detail: '5 / 4' }], 'niveau 5 : 6 NM sur les sorts, dont 1 de livre');
});
