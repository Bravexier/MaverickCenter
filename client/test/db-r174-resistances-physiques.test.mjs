// Décision R174 du propriétaire (2026-10-29) : « le mode hyper se contente d'annuler malus passif du PI qui réduit de 1 toutes les défenses physiques.
// (il serai bien de rajouter les 3 type de physique dans le tableau de résistance d'ailleurs : Estoc, Frappe, Taille) » ; « Oui, palier personnel ».
// Migration data/migrations/0083-r174-resistances-physiques.sql : magie_resistance.cible_type admet 'physique', avec cible_physique (estoc, taille,
// frappe) et la contrainte nommée magie_resistance_une_cible (exactement une cible renseignée, celle de cible_type) ; trois lignes du Potentiel
// Illimité (toujours la magie innée, R176), une vulnérabilité à chacun des trois types (« Surtension corporelle », magie.explication). Les écritures
// se font dans une COPIE de la base construite, jamais dans var/maverick.db ni dans data/rows.
import assert from 'node:assert/strict';
import { copyFileSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { after, test } from 'node:test';
import { cheminBase, ouvrirBase } from '../src/lib/donnees.mjs';
import { fichierTemporaire } from './aide-dossier-temporaire.mjs';

const PI = 'magies/potentiel-illimite';
const CITATION = 'Surtension corporelle (Vulnérabilité contre les dégâts physiques';
const CONTRAINTE = 'magie_resistance_une_cible';
const lire = (chemin) => readFileSync(new URL(`../../${chemin}`, import.meta.url), 'utf8');

const db = ouvrirBase({ sansExemples: false });
const copie = fichierTemporaire('maverick.db', 'r174');
copyFileSync(cheminBase({ sansExemples: false }), copie);
const ecrite = new DatabaseSync(copie);
ecrite.exec('PRAGMA foreign_keys = ON');
after(() => ecrite.close());

test('R174 : le Potentiel Illimité a une vulnérabilité à chacun des trois types physiques, estoc, taille et frappe, citée de son explication', () => {
  const lignes = db.prepare(`SELECT magie_id, sens, cible_type, rang, cible_magie_id, cible_etat_id, cible_physique, cible_brut, source_ref
                             FROM magie_resistance WHERE cible_type = 'physique' ORDER BY magie_id, sens, rang`).all();
  assert.deepEqual(lignes.map((l) => ({ ...l })), ['estoc', 'taille', 'frappe'].map((cible, i) => ({
    magie_id: PI, sens: 'vulnerabilite', cible_type: 'physique', rang: i + 1, cible_magie_id: null, cible_etat_id: null, cible_physique: cible,
    cible_brut: CITATION, source_ref: 'Magie Maverick V8 › Potentiel illimité (magie diffi › A26',
  })));
  // la citation est celle de la magie, telle qu'écrite dans la base
  assert.ok(db.prepare('SELECT explication FROM magie WHERE id = ?').get(PI).explication.includes(`- ${CITATION}, `));
});

test('R174 : rien d\'autre ne change — aucune autre ligne physique, aucune cible physique hors de cible_type « physique », le PI sans liste de magie ni d\'état', () => {
  assert.equal(db.prepare("SELECT count(*) AS n FROM magie_resistance WHERE cible_type <> 'physique' AND cible_physique IS NOT NULL").get().n, 0);
  assert.ok(db.prepare("SELECT count(*) AS n FROM magie_resistance WHERE cible_type IN ('magie', 'etat')").get().n > 0);
  // « Aucune » dans les quatre blocs de l'onglet du Potentiel Illimité : toujours aucune ligne de magie ni d'état
  assert.equal(db.prepare("SELECT count(*) AS n FROM magie_resistance WHERE magie_id = ? AND cible_type <> 'physique'").get(PI).n, 0);
  // les vues qui lisent la table ne voient que ses cibles de magie
  assert.equal(db.prepare('SELECT count(*) AS n FROM v_resistance_combinaison WHERE cible_magie_id IS NULL').get().n, 0);
  assert.equal(db.prepare("SELECT count(*) AS n FROM v_creature_resistance WHERE provenance = 'element' AND cible_magie_id IS NULL").get().n, 0);
});

test('R174 : le schéma et la migration 0083 portent la contrainte nommée et la colonne cible_physique', () => {
  const clause = `CONSTRAINT ${CONTRAINTE} CHECK (`;
  for (const [nom, sql] of [['data/schema.sql', lire('data/schema.sql')], ['migration 0083', lire('data/migrations/0083-r174-resistances-physiques.sql')],
    ['base construite', db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'magie_resistance'").get().sql]]) {
    assert.ok(sql.includes(clause), `${nom} : ${clause}`);
    assert.ok(sql.includes("cible_physique  TEXT    CHECK (cible_physique IN ('estoc', 'taille', 'frappe'))"), `${nom} : cible_physique`);
    assert.ok(sql.includes('UNIQUE (magie_id, sens, cible_physique)'), `${nom} : unicité`);
  }
});

test('R174 : la base refuse une ligne dont la cible ne répond pas à cible_type, un type physique hors vocabulaire et un doublon', () => {
  const colonnes = ['magie_id', 'sens', 'cible_type', 'rang', 'cible_magie_id', 'cible_etat_id', 'cible_physique', 'cible_brut', 'origine', 'source_ref'];
  const inserer = (valeurs) => ecrite.prepare(`INSERT INTO magie_resistance (${colonnes.join(', ')}) VALUES (${colonnes.map(() => '?').join(', ')})`)
    .run(...colonnes.map((c) => valeurs[c] ?? null));
  const magie = ecrite.prepare("SELECT cible_magie_id FROM magie_resistance WHERE cible_type = 'magie' LIMIT 1").get().cible_magie_id;
  const etat = ecrite.prepare("SELECT cible_etat_id FROM magie_resistance WHERE cible_type = 'etat' LIMIT 1").get().cible_etat_id;
  const base = { magie_id: PI, sens: 'resistance', rang: 9, cible_brut: 'essai', origine: 'magies', source_ref: 'essai' };
  const refusee = (valeurs, message, quoi) => assert.throws(() => inserer({ ...base, ...valeurs }), { message }, quoi);
  ecrite.exec('BEGIN');
  try {
    const une = `CHECK constraint failed: ${CONTRAINTE}`;
    refusee({ cible_type: 'physique' }, une, 'physique sans cible');
    refusee({ cible_type: 'physique', cible_physique: 'estoc', cible_magie_id: magie }, une, 'physique et magie');
    refusee({ cible_type: 'physique', cible_physique: 'estoc', cible_etat_id: etat }, une, 'physique et état');
    refusee({ cible_type: 'magie', cible_magie_id: magie, cible_physique: 'estoc' }, une, 'magie et physique');
    refusee({ cible_type: 'etat', cible_etat_id: etat, cible_physique: 'taille' }, une, 'état et physique');
    refusee({ cible_type: 'physique', cible_physique: 'sonore' }, /CHECK constraint failed: cible_physique IN/, 'hors vocabulaire');
    refusee({ cible_type: 'physique', cible_physique: 'physique' }, /CHECK constraint failed: cible_physique IN/, 'hors vocabulaire');
    // un second cran de vulnérabilité à l'estoc pour la même magie : refusé (un cran par cible et par sens)
    refusee({ sens: 'vulnerabilite', cible_type: 'physique', cible_physique: 'estoc' },
      'UNIQUE constraint failed: magie_resistance.magie_id, magie_resistance.sens, magie_resistance.cible_physique', 'doublon');
    // témoins : une ligne bien formée de chaque type s'insère
    inserer({ ...base, cible_type: 'physique', cible_physique: 'frappe' });
    inserer({ ...base, cible_type: 'magie', cible_magie_id: magie });
    inserer({ ...base, cible_type: 'etat', cible_etat_id: etat });
  } finally {
    ecrite.exec('ROLLBACK');
  }
  assert.equal(ecrite.prepare("SELECT count(*) AS n FROM magie_resistance WHERE cible_type = 'physique'").get().n, 3);
});
