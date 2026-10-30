// Décision R182 du propriétaire (2026-10-30), suite de R180 (réussite critique) : réponses à Q89, Q90 et Q91 (docs/sql/a-valider.md).
// Migration data/migrations/0089-r182-critique-du-sort-prepare.sql :
//   - personnage_sort.prepare_critique : le N de « Réussite critique : 1 à N (figée à la préparation) », de 1, le bas de la plage « 1 à N » (un
//     accessoire maudit retire de la réussite critique, R180 et R54 : Concentration peut n'avoir que 1 à 4), à 15 (regle_constante
//     'critique.plafond'), seulement sur le sort préparé, NULL tant qu'il n'est pas noté (Q91 : « c'est le critique au moment de la préparation qui
//     va taper quand le sort est relaché ») ;
//   - posture_critique sans ligne 'don_de_posture' : « Sci du Crit » n'est que mentionné sur la fiche, jamais compté (Q90 : « Tout jet d'attaque au
//     corps à corps », armes de contact seulement, jamais un sort).
// Pages du guide passées par db:sync-pages : l'échec critique au-delà de 95 % (Q89) et le paragraphe « Le sort préparé ». Les écritures se font dans
// une COPIE de la base construite, jamais dans var/maverick.db ni dans data/rows.
import assert from 'node:assert/strict';
import { copyFileSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { cheminBase, ouvrirBase } from '../src/lib/donnees.mjs';
import { fichierTemporaire } from './aide-dossier-temporaire.mjs';
import { rejouerLaMigration } from './aide-migration-rejouee.mjs';

const MIGRATION = '0089-r182-critique-du-sort-prepare.sql';
const AVEC_PREPARE = 'personnage_sort_prepare_critique_avec_prepare';
const BORNES = 'personnage_sort_prepare_critique_bornes';
const INSTANT = '2026-10-30T12:00:00Z';
const lire = (chemin) => readFileSync(new URL(`../../${chemin}`, import.meta.url), 'utf8');
const db = ouvrirBase({ sansExemples: false });
const corps = (id) => db.prepare('SELECT corps_md FROM page WHERE id = ?').get(id).corps_md;
const constante = (id) => db.prepare('SELECT valeur FROM regle_constante WHERE id = ?').get(id).valeur;

/** Une copie de la base construite, ouverte en écriture, fermée à la fin du test `t`, avec un prétiré minimal `p` et deux de ses sorts. */
function copie(t) {
  const chemin = fichierTemporaire('maverick.db', 'r182-critique', { t });
  copyFileSync(cheminBase({ sansExemples: false }), chemin);
  const base = new DatabaseSync(chemin);
  base.exec('PRAGMA foreign_keys = ON');
  t.after(() => base.close());
  base.prepare(`INSERT INTO personnage (id, nature, proprietaire_id, visibilite, nom, mode_classe, xp, alignement_loyal, alignement_chaotique,
    alignement_bon, alignement_mauvais, bourse_pp, bourse_ro, bourse_rf, ambidextrie, cree_le, modifie_le)
    VALUES ('p', 'pretire', NULL, 'tous', 'Essai R182 sort préparé', 'mono', 0, 0, 0, 0, 0, 0, 0, 0, 0, ?, ?)`).run(INSTANT, INSTANT);
  const [a, b] = base.prepare('SELECT id FROM sort ORDER BY id LIMIT 2').all().map((s) => s.id);
  return { base, a, b };
}

/** Insère le sort `sortId` au rang `rang` de la fiche `p`, avec les colonnes de `plus`. */
function inserer(base, sortId, rang, plus = {}) {
  const ligne = { personnage_id: 'p', sort_id: sortId, rang, niveau_maitrise: 0, ...plus };
  const cols = Object.keys(ligne);
  base.prepare(`INSERT INTO personnage_sort (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`).run(...Object.values(ligne));
}
const critiqueDe = (base, sortId) => base.prepare('SELECT prepare_critique FROM personnage_sort WHERE personnage_id = ? AND sort_id = ?').get('p', sortId).prepare_critique;

test('R182 : personnage_sort finit par prepare_critique (INTEGER, nullable, sans défaut), ses deux contraintes nommées ; data/rows garde la table vide', () => {
  const colonnes = db.prepare('PRAGMA table_xinfo(personnage_sort)').all();
  assert.deepEqual({ ...colonnes.at(-1) }, { cid: colonnes.length - 1, name: 'prepare_critique', type: 'INTEGER', notnull: 0, dflt_value: null, pk: 0, hidden: 0 });
  const sql = db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'personnage_sort'").get().sql;
  assert.ok(sql.includes(`CONSTRAINT ${AVEC_PREPARE} CHECK (prepare_critique IS NULL OR prepare = 1)`));
  assert.ok(sql.includes(`CONSTRAINT ${BORNES} CHECK (prepare_critique IS NULL OR prepare_critique BETWEEN 1 AND 15)`));
  assert.equal(db.prepare('SELECT count(*) AS n FROM personnage_sort').get().n, 0);
});

test('R182 : la borne haute écrite dans le CHECK est le plafond de regle_constante (critique.plafond) : une constante changée demande une migration', () => {
  const sql = db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'personnage_sort'").get().sql;
  const [, min, max] = /prepare_critique BETWEEN (\d+) AND (\d+)/.exec(sql);
  assert.equal(Number(max), constante('critique.plafond'));
  // la borne basse est le bas de la plage « 1 à N », pas critique.base : un accessoire maudit la fait descendre sous la base (R180, R54)
  assert.deepEqual([Number(min), Number(max)], [1, 15]);
});

test('R182 : la plage figée se note de 1 à 15 (4 avec un accessoire maudit, R180), seulement sur le sort préparé ; NULL tant qu’elle ne l’est pas ; « Lâcher le sort » la remet à NULL', (t) => {
  const { base, a, b } = copie(t);
  const refusee = (plus, message, quoi) => assert.throws(() => inserer(base, b, 9, plus), { message }, quoi);
  refusee({ prepare_critique: 10 }, `CHECK constraint failed: ${AVEC_PREPARE}`, 'sur un sort non préparé');
  refusee({ prepare: 1, prepare_critique: 16 }, `CHECK constraint failed: ${BORNES}`, 'au-delà du plafond de 15');
  refusee({ prepare: 1, prepare_critique: 0 }, `CHECK constraint failed: ${BORNES}`, 'zéro, sous le bas de la plage « 1 à N »');
  refusee({ prepare: 1, prepare_critique: 7.5 }, /cannot store REAL value in INTEGER column personnage_sort\.prepare_critique/, 'un nombre non entier (STRICT)');
  inserer(base, a, 1);
  assert.equal(critiqueDe(base, a), null, 'sort non préparé : NULL');
  for (const n of [1, 4, 5, 15]) {   // 4 : Concentration avec un accessoire maudit (−1 %, R180, R54), que le moteur écrit
    base.prepare('DELETE FROM personnage_sort WHERE sort_id = ?').run(b);
    inserer(base, b, 2, { prepare: 1, prepare_jet: 42, prepare_critique: n });
    assert.equal(critiqueDe(base, b), n, `N = ${n}`);
  }
  // préparé sans plage notée (une fiche d'avant 0089) : accepté
  base.prepare('UPDATE personnage_sort SET prepare_critique = NULL WHERE sort_id = ?').run(b);
  assert.equal(critiqueDe(base, b), null);
  base.prepare('UPDATE personnage_sort SET prepare_critique = 12 WHERE sort_id = ?').run(b);
  assert.throws(() => base.prepare('UPDATE personnage_sort SET prepare = 0, prepare_jet = NULL WHERE sort_id = ?').run(b), { message: `CHECK constraint failed: ${AVEC_PREPARE}` },
    'lâcher le sort sans vider la plage');
  base.prepare('UPDATE personnage_sort SET prepare = 0, prepare_jet = NULL, prepare_posture_id = NULL, prepare_critique = NULL WHERE sort_id = ?').run(b);
  assert.equal(critiqueDe(base, b), null);
});

test('R182 : la migration 0089 laisse NULL la plage d’un sort préparé d’avant (rien n’est recalculé) et donne la table de data/schema.sql', (t) => {
  const { base, a, b } = copie(t);
  const attendu = base.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'personnage_sort'").get().sql;
  base.exec('ALTER TABLE personnage_sort DROP COLUMN prepare_critique');
  inserer(base, a, 1);
  inserer(base, b, 2, { prepare: 1, prepare_jet: 87, prepare_posture_id: 'guide/postures#posture:offensif' });
  rejouerLaMigration(base, MIGRATION);
  assert.deepEqual([critiqueDe(base, a), critiqueDe(base, b)], [null, null]);
  const normal = (sql) => sql.replace(/--[^\n]*/g, '').replace(/\s+/g, ' ').replace(/ ?([,()]) ?/g, '$1').trim();
  assert.equal(normal(base.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'personnage_sort'").get().sql), normal(attendu));
  assert.equal(base.prepare('SELECT count(*) AS n FROM posture_critique').get().n, 8, 'rejouée sur la table déjà reconstruite : rien ne change');
});

test('R182 (Q90) : posture_critique n’a plus aucune ligne de don de posture ; son CHECK refuse « don_de_posture » ; les lignes de la posture restent', (t) => {
  assert.equal(db.prepare("SELECT count(*) AS n FROM posture_critique WHERE bonus <> 'posture'").get().n, 0);
  assert.deepEqual(db.prepare('SELECT DISTINCT bonus FROM posture_critique').all().map((r) => r.bonus), ['posture']);
  assert.equal(db.prepare('SELECT count(*) AS n FROM posture_critique').get().n, 8, 'Offensif sur six jets, Défensif sur Esquive et Parade (R180)');
  assert.ok(!lire('data/rows/posture_critique.sql').includes('don_de_posture'));
  const sql = db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'posture_critique'").get().sql;
  assert.ok(sql.includes("CHECK (bonus IN ('posture'))"), sql);
  const { base } = copie(t);
  assert.throws(() => base.prepare("INSERT INTO posture_critique (posture_id, bonus, competence_id) VALUES ('guide/postures#posture:offensif', 'don_de_posture', 'arme-legere')").run(),
    { message: /CHECK constraint failed: bonus IN/ });
  // le don lui-même ne change pas : son texte reste tel quel (mentionné sur la fiche)
  assert.equal(db.prepare("SELECT effet FROM capacite WHERE id = 'capacites/martiale-sci-du-crit'").get().effet, '(Posture Offensif)\nAugmente la réussite critique de +5%.');
});

test('R182 (Q89, Q91) : le guide dit l’échec critique au-delà de 95 % et le sort préparé (critique de la préparation, Double coup), décisions citées', () => {
  const reussir = corps('guide/reussir-une-action');
  const ECHEC = 'C’est vrai même pour un score au-delà de 95 % : de 96 à 100, le jet reste un échec critique.';
  assert.ok(reussir.includes(ECHEC));
  const section = reussir.slice(reussir.indexOf('### L’échec critique : de 96 à 100'), reussir.indexOf('## Bonus et malus'));
  assert.ok(section.includes(ECHEC), 'dans la section « L’échec critique : de 96 à 100 »');
  const magie = corps('guide/la-magie-en-jeu');
  const lancer = magie.slice(magie.indexOf('## Lancer un sort'), magie.indexOf('## Ce que coûte un sort'));
  assert.ok(lancer.includes('### Le sort préparé'), 'sous « Lancer un sort »');
  for (const phrase of [
    'Le Mage Rouge et le Mage Vert préparent un sort dans la main',
    'Le jet se fait et se note à la préparation, et la cible se défend contre ce nombre.',
    'La réussite critique est celle du moment de la préparation, et c’est elle qui compte au relâchement.',
    'Avec « Double coup » (niveau 20), le même sort se relâche à chaque coup, au corps à corps pour le Mage Rouge, à distance pour le Mage Vert',
    'seul le premier relâchement peut être un critique, les suivants sont fixés à 40 de réussite, et le {{chakra|chakra}} se consomme à chaque sort.',
  ]) assert.ok(lancer.includes(phrase), phrase);
  const sources = (id) => db.prepare(`SELECT s.texte FROM page_source ps JOIN source s ON s.id = ps.source_id WHERE ps.page_id = ?`).all(id).map((r) => r.texte).join('\n');
  for (const r of ['R115', 'R179', 'R182']) assert.match(sources('guide/la-magie-en-jeu'), new RegExp(`\\b${r}\\b`), r);
  assert.match(sources('guide/reussir-une-action'), /\bR182\b/);
  // la remarque citée de Double coup (Classe Maverick V7) que le guide reprend, intacte
  for (const id of ['capacites/mage-rouge-double-coup', 'capacites/mage-vert-double-coup']) {
    assert.ok(db.prepare('SELECT remarque FROM capacite WHERE id = ?').get(id).remarque
      .startsWith("Dans le cas d'un critique, ce sera que pour le premier coup, les prochains c'est fixé à 40 de réussite."), id);
  }
});
