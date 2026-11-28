// Migration data/migrations/0135-reperes.sql (chantier 4 des mots-clés, « le retrait des colonnes » : docs/chantier-retrait-des-colonnes.md, §2 et §7) : la
// table `repere`, l'élément d'un mot-clé sans page ni sort. Migration de structure seule : la table naît vide, les colonnes de mot_cle ne changent pas. Le test
// lit la structure sur une base neuve du schéma et rejoue la migration sur le schéma d'avant ; les noms posés sont inventés, aucune valeur du site n'est lue.
//   node --test test/db-0135-reperes.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';

const SCHEMA = readFileSync(new URL('../../data/schema.sql', import.meta.url), 'utf8');
const MIGRATION = readFileSync(new URL('../../data/migrations/0135-reperes.sql', import.meta.url), 'utf8');

/** Une base neuve du schéma, clés étrangères actives, avec `n` mots-clés d'essai (ids 1 à n). */
function baseNeuve(n = 2) {
  const essai = new DatabaseSync(':memory:', { enableForeignKeyConstraints: true });
  essai.exec(SCHEMA);
  for (let id = 1; id <= n; id += 1) essai.prepare('INSERT INTO mot_cle (id, libelle, cle) VALUES (?, ?, ?)').run(id, `Essai ${id}`, `essai-${id}`);
  return essai;
}
const COLONNES = ['mot_cle_id', 'nom', 'adresse', 'definition', 'couleur', 'icone'];
const poser = (essai, valeurs) => {
  const colonnes = Object.keys(valeurs);
  return essai.prepare(`INSERT INTO repere (${colonnes.join(', ')}) VALUES (${colonnes.map(() => '?').join(', ')})`).run(...Object.values(valeurs));
};
/** Le SQL d'un objet du schéma, sans commentaires ni espaces : la migration et data/schema.sql ne diffèrent que par eux. */
const sansCommentaires = (sql) => sql.replace(/(^|\s)--[^\n]*/g, '$1'); // un « -- » collé à un caractère est dans un motif GLOB ('*--*'), pas un commentaire
const sqlNu = (db, nom) => sansCommentaires(db.prepare('SELECT sql FROM sqlite_master WHERE name = ?').get(nom).sql).replace(/\s+/g, '');

test('0135 : la table repere existe, vide, STRICT ; une ligne par mot-clé (mot_cle_id clé primaire), nom obligatoire, quatre colonnes facultatives', () => {
  const essai = baseNeuve();
  assert.equal(essai.prepare('SELECT count(*) n FROM repere').get().n, 0, 'aucun repère écrit par le schéma');
  const colonnes = essai.prepare("SELECT name, type, \"notnull\" n, pk FROM pragma_table_info('repere') ORDER BY cid").all();
  assert.deepEqual(colonnes.map((c) => c.name), COLONNES);
  assert.deepEqual(colonnes.map((c) => c.type), ['INTEGER', 'TEXT', 'TEXT', 'TEXT', 'TEXT', 'TEXT']);
  assert.deepEqual(colonnes.map((c) => c.n), [1, 1, 0, 0, 0, 0], 'seuls le mot-clé et le nom sont obligatoires');
  assert.deepEqual(colonnes.map((c) => c.pk), [1, 0, 0, 0, 0, 0]);
  assert.match(essai.prepare("SELECT sql FROM sqlite_master WHERE name = 'repere'").get().sql, /\)\s*STRICT\s*$/);

  poser(essai, { mot_cle_id: 1, nom: 'Essai 1' });
  assert.deepEqual({ ...essai.prepare('SELECT * FROM repere WHERE mot_cle_id = 1').get() }, { mot_cle_id: 1, nom: 'Essai 1', adresse: null, definition: null, couleur: null, icone: null });
  assert.throws(() => poser(essai, { mot_cle_id: 1, nom: 'Second' }), /UNIQUE|PRIMARY/, 'un seul repère par mot-clé');
  essai.close();
});

test('0135 : la migration rejouée sur le schéma d’avant donne la table de data/schema.sql, et ne touche pas à mot_cle', () => {
  const neuve = baseNeuve(0);
  const avant = new DatabaseSync(':memory:', { enableForeignKeyConstraints: false });
  avant.exec(SCHEMA);
  const motCle = sqlNu(avant, 'mot_cle');
  avant.exec('DROP TABLE repere');
  avant.exec(MIGRATION);
  assert.equal(sqlNu(avant, 'repere'), sqlNu(neuve, 'repere'));
  assert.equal(sqlNu(avant, 'mot_cle'), motCle, 'les colonnes du mot-clé font toujours foi : elles ne changent pas');
  assert.equal(avant.prepare('SELECT count(*) n FROM repere').get().n, 0, 'structure seule : aucune ligne');
  assert.doesNotMatch(sansCommentaires(MIGRATION), /\b(BEGIN|COMMIT|ROLLBACK|PRAGMA|INSERT|UPDATE)\b|\bDELETE\s+FROM\b/i, 'ni transaction, ni PRAGMA, ni écriture de ligne');
  avant.close();
  neuve.close();
});

test('0135 : les contraintes sont celles des colonnes du mot-clé (nom non vide, adresse interne, définition non vide, forme de la couleur et de l’icône)', () => {
  const essai = baseNeuve();
  // ce que mot_cle refuse, repere le refuse, et ce qu'il accepte, repere l'accepte : la même valeur est posée des deux côtés
  const paires = { nom: 'libelle', adresse: 'url', definition: 'description', couleur: 'couleur', icone: 'icone' };
  const essais = {
    nom: { bons: ['Classe'], mauvais: [''] },
    adresse: { bons: ['/classes/', '/metiers/#metier-essai', null], mauvais: ['classes/', '//hote/', '/a b/', '/é/', '/a\\b', ''] },
    definition: { bons: ['Un texte d’essai.', null], mauvais: [''] },
    couleur: { bons: ['#a1b2c3', 'magie:essai', null], mauvais: ['#A1B2C3', '#abc', 'rouge', 'magie:', 'a:b:c', 'magie:essai-'] },
    icone: { bons: ['monnaie:rf', null], mauvais: ['monnaie', '#a1b2c3', 'Monnaie:rf', 'monnaie:rf-'] },
  };
  const dansRepere = (colonne, valeur) => {
    essai.exec('DELETE FROM repere');
    poser(essai, { mot_cle_id: 1, nom: 'Essai 1', [colonne]: valeur });
  };
  const dansMotCle = (colonne, valeur) => essai.prepare(`UPDATE mot_cle SET "${colonne}" = ? WHERE id = 2`).run(valeur);
  for (const [colonne, { bons, mauvais }] of Object.entries(essais)) {
    for (const v of bons) {
      assert.doesNotThrow(() => dansRepere(colonne, v), `repere.${colonne} accepte ${JSON.stringify(v)}`);
      assert.doesNotThrow(() => dansMotCle(paires[colonne], v), `mot_cle.${paires[colonne]} aussi`);
    }
    for (const v of mauvais) {
      assert.throws(() => dansRepere(colonne, v), /CHECK/, `repere.${colonne} refuse ${JSON.stringify(v)}`);
      assert.throws(() => dansMotCle(paires[colonne], v), /CHECK/, `mot_cle.${paires[colonne]} aussi`);
    }
  }
  assert.throws(() => poser(essai, { mot_cle_id: 2, nom: null }), /NOT NULL/);
  essai.close();
});

test('0135 : un repère cite un mot-clé qui existe et part avec lui (ON DELETE CASCADE)', () => {
  const essai = baseNeuve();
  const cles = essai.prepare("PRAGMA foreign_key_list('repere')").all();
  assert.equal(cles.length, 1);
  assert.deepEqual([cles[0].from, cles[0].table, cles[0].to, cles[0].on_delete], ['mot_cle_id', 'mot_cle', 'id', 'CASCADE']);
  assert.throws(() => poser(essai, { mot_cle_id: 99, nom: 'Sans mot-clé' }), /FOREIGN KEY/);
  poser(essai, { mot_cle_id: 1, nom: 'Essai 1', adresse: '/classes/' });
  poser(essai, { mot_cle_id: 2, nom: 'Essai 2' });
  essai.prepare('DELETE FROM mot_cle WHERE id = 1').run();
  assert.deepEqual(essai.prepare('SELECT mot_cle_id FROM repere').all().map((r) => r.mot_cle_id), [2], 'le repère du mot-clé supprimé est parti, l’autre reste');
  essai.close();
});
