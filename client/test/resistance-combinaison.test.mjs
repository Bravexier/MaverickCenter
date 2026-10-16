// Résistances et faiblesses d'une combinaison de deux magies (bi-magie) : la vue v_resistance_combinaison (data/schema.sql, migration 0049), décisions
// R85 (« Les résistance/ faiblesses des deux magies se cumulent (ou s'annulent si opposées) », « Il en faut une liste ») et R86 (l'onglet
// « Statistiques », qui les écrivait à la main, est ignoré : les tables resistance_duo et resistance_combinaison sont retirées).
// La vue additionne les crans des listes de chaque magie (magie_resistance, cibles de type magie : résistance +1, faiblesse -1) ; +2 grande résistance,
// +1 résistance, -1 vulnérabilité, -2 grande vulnérabilité, 0 pas de ligne ; une ligne par couple non ordonné (magie_a_id : la première des deux
// dans l'ordre des onglets, magie.ordre). Les listes des magies ne se modifient pas sur le site de dev (lib/edition-modele.mjs : « la table des
// relations entre magies ne se modifie pas »).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { ouvrirBase } from '../src/lib/donnees.mjs';

const db = ouvrirBase({ sansExemples: false });
const schema = readFileSync(new URL('../../data/schema.sql', import.meta.url), 'utf8');
const SQL_DE_LA_VUE = /^CREATE VIEW v_resistance_combinaison AS\n[\s\S]*?;$/m.exec(schema)?.[0];

const PALIER_DE = { 2: 'grande_resistance', 1: 'resistance', [-1]: 'vulnerabilite', [-2]: 'grande_vulnerabilite' };
const NECROMANCIE = 'magies/magie-de-la-necromancie';
const FEU = 'magies/magie-du-feu';

/** Les lignes de la vue pour un couple, par palier : { palier: [noms des magies cibles, dans l'ordre des onglets] }. */
function paliersDu(couple) {
  const lignes = db.prepare(`SELECT v.palier_id, m.nom FROM v_resistance_combinaison v JOIN magie m ON m.id = v.cible_magie_id
                             WHERE v.magie_a_id = ? AND v.magie_b_id = ? ORDER BY m.ordre`).all(...couple);
  const res = {};
  for (const l of lignes) (res[l.palier_id] ??= []).push(l.nom);
  return res;
}

test('décision R85 : Nécromancie + Feu a 5 résistances (Sang, Nécromancie, Feu, Terre, Foudre), une grande vulnérabilité (Eau) et une vulnérabilité (Vent)', () => {
  assert.deepEqual(paliersDu([NECROMANCIE, FEU]), {
    resistance: ['Sang', 'Nécromancie', 'Feu', 'Terre', 'Foudre'],
    vulnerabilite: ['Vent'],
    grande_vulnerabilite: ['Eau'],
  });
  // une seule ligne par couple : Nécromancie vient avant Feu dans l'ordre des onglets ; « Feu + Nécromancie » n'a pas de ligne
  assert.equal(db.prepare('SELECT count(*) AS n FROM v_resistance_combinaison WHERE magie_a_id = ? AND magie_b_id = ?').get(FEU, NECROMANCIE).n, 0);
});

test('la vue suit magie_resistance sur tous les couples de deux magies distinctes : somme des crans, palier, aucune limite par palier, aucun couple en double', () => {
  const magies = db.prepare('SELECT id, ordre FROM magie ORDER BY ordre').all();
  const crans = new Map();
  for (const r of db.prepare("SELECT magie_id, sens, cible_magie_id FROM magie_resistance WHERE cible_type = 'magie'").all()) {
    const k = `${r.magie_id}|${r.cible_magie_id}`;
    crans.set(k, (crans.get(k) ?? 0) + (r.sens === 'resistance' ? 1 : -1));
  }
  const attendu = [];
  for (const a of magies) for (const b of magies) {
    if (b.ordre <= a.ordre) continue;
    for (const c of magies) {
      const valeur = (crans.get(`${a.id}|${c.id}`) ?? 0) + (crans.get(`${b.id}|${c.id}`) ?? 0);
      if (valeur !== 0) attendu.push({ magie_a_id: a.id, magie_b_id: b.id, cible_magie_id: c.id, valeur, palier_id: PALIER_DE[valeur] });
    }
  }
  const cle = (l) => `${l.magie_a_id}|${l.magie_b_id}|${l.cible_magie_id}`;
  const lignes = db.prepare('SELECT magie_a_id, magie_b_id, cible_magie_id, valeur, palier_id FROM v_resistance_combinaison').all().map((l) => ({ ...l }));
  assert.deepEqual(lignes.sort((x, y) => cle(x).localeCompare(cle(y))), attendu.sort((x, y) => cle(x).localeCompare(cle(y))));
  assert.equal(new Set(lignes.map(cle)).size, lignes.length, 'une ligne par couple et par magie cible');
  // chaque palier est un palier de la fiche (resistance_palier) dont les bornes contiennent la somme
  const avecPalier = db.prepare(`SELECT v.valeur, p.valeur_min, p.valeur_max FROM v_resistance_combinaison v
                                 JOIN resistance_palier p ON p.id = v.palier_id`).all();
  assert.equal(avecPalier.length, lignes.length, 'chaque palier_id est un palier de resistance_palier');
  for (const l of avecPalier) assert.ok((l.valeur_min === null || l.valeur >= l.valeur_min) && (l.valeur_max === null || l.valeur <= l.valeur_max), JSON.stringify(l));
  // au-delà de 4 magies par palier (la limite du tableau de l'onglet Statistiques)
  assert.ok(db.prepare('SELECT max(n) AS n FROM (SELECT count(*) AS n FROM v_resistance_combinaison GROUP BY magie_a_id, magie_b_id, palier_id)').get().n > 4);
});

test('deux crans opposés s’annulent : une résistance de l’une et une faiblesse de l’autre à la même magie ne donnent aucune ligne (Lumière + Ombre)', () => {
  const opposes = db.prepare(`SELECT a.id AS magie_a_id, b.id AS magie_b_id, ra.cible_magie_id
    FROM magie a JOIN magie b ON b.ordre > a.ordre
    JOIN magie_resistance ra ON ra.magie_id = a.id AND ra.cible_type = 'magie'
    JOIN magie_resistance rb ON rb.magie_id = b.id AND rb.cible_type = 'magie' AND rb.cible_magie_id = ra.cible_magie_id AND rb.sens <> ra.sens
    WHERE NOT EXISTS (SELECT 1 FROM magie_resistance x WHERE x.cible_type = 'magie' AND x.magie_id IN (a.id, b.id)
                        AND x.cible_magie_id = ra.cible_magie_id AND NOT (x.magie_id = a.id AND x.sens = ra.sens) AND NOT (x.magie_id = b.id AND x.sens = rb.sens))`).all();
  assert.ok(opposes.length > 10, `${opposes.length} cas dans la base`);
  const ligne = db.prepare('SELECT count(*) AS n FROM v_resistance_combinaison WHERE magie_a_id = ? AND magie_b_id = ? AND cible_magie_id = ?');
  for (const o of opposes) assert.equal(ligne.get(o.magie_a_id, o.magie_b_id, o.cible_magie_id).n, 0, JSON.stringify(o));
  // Lumière + Ombre : chacune résiste à elle-même et craint l'autre, tout s'annule
  assert.deepEqual(paliersDu(['magies/magie-de-la-lumiere', 'magies/magie-de-lombre']), {});
});

test('la vue sur des listes synthétiques : cumul, annulation, grande résistance et grande vulnérabilité, couple non ordonné', () => {
  assert.ok(SQL_DE_LA_VUE, 'CREATE VIEW v_resistance_combinaison introuvable dans data/schema.sql');
  const m = new DatabaseSync(':memory:');
  m.exec(`CREATE TABLE magie (id TEXT PRIMARY KEY, ordre INTEGER NOT NULL UNIQUE);
          CREATE TABLE magie_resistance (magie_id TEXT, sens TEXT, cible_type TEXT, cible_magie_id TEXT, cible_etat_id TEXT);
          CREATE TABLE resistance_palier (id TEXT PRIMARY KEY, valeur_min INTEGER, valeur_max INTEGER);
          INSERT INTO resistance_palier VALUES ('immunite', 3, NULL), ('grande_resistance', 2, 2), ('resistance', 1, 1), ('vulnerabilite', -1, -1),
            ('grande_vulnerabilite', -2, -2), ('sensibilite', NULL, -3);
          ${SQL_DE_LA_VUE}`);
  const ajouter = m.prepare('INSERT INTO magie_resistance VALUES (?, ?, ?, ?, ?)');
  for (const [id, ordre] of [['x', 2], ['y', 1], ['z', 3]]) m.prepare('INSERT INTO magie VALUES (?, ?)').run(id, ordre);
  for (const [magie, sens, cible] of [
    ['x', 'resistance', 'x'], ['y', 'resistance', 'x'],          // x : +2
    ['x', 'vulnerabilite', 'z'], ['y', 'vulnerabilite', 'z'],    // z : -2
    ['x', 'resistance', 'y'], ['y', 'vulnerabilite', 'y'],       // y : +1 -1 = 0, pas de ligne
  ]) ajouter.run(magie, sens, 'magie', cible, null);
  ajouter.run('x', 'resistance', 'etat', null, 'brulure');       // une altération d'état n'entre pas dans la vue
  const lignes = (a, b) => m.prepare('SELECT cible_magie_id, valeur, palier_id FROM v_resistance_combinaison WHERE magie_a_id = ? AND magie_b_id = ? ORDER BY cible_magie_id').all(a, b).map((l) => ({ ...l }));
  // y (ordre 1) avant x (ordre 2)
  assert.deepEqual(lignes('y', 'x'), [
    { cible_magie_id: 'x', valeur: 2, palier_id: 'grande_resistance' },
    { cible_magie_id: 'z', valeur: -2, palier_id: 'grande_vulnerabilite' },
  ]);
  assert.deepEqual(lignes('x', 'y'), []);
  // x + z (z n'a pas de liste) : les crans de x seuls
  assert.deepEqual(lignes('x', 'z'), [
    { cible_magie_id: 'x', valeur: 1, palier_id: 'resistance' },
    { cible_magie_id: 'y', valeur: 1, palier_id: 'resistance' },
    { cible_magie_id: 'z', valeur: -1, palier_id: 'vulnerabilite' },
  ]);
  // pas de couple d'une magie avec elle-même
  assert.equal(m.prepare('SELECT count(*) AS n FROM v_resistance_combinaison WHERE magie_a_id = magie_b_id').get().n, 0);
});

test('décision R86 : les tables recopiées de l’onglet Statistiques et ce qui ne vivait que pour elles sont retirés', () => {
  const objets = db.prepare("SELECT name FROM sqlite_master WHERE name IN ('resistance_duo', 'resistance_combinaison')").all();
  assert.deepEqual(objets, []);
  assert.equal(db.prepare("SELECT count(*) AS n FROM ecart_source WHERE entite_table IN ('resistance_duo', 'resistance_combinaison') OR source_a = 'statistiques'").get().n, 0);
  assert.equal(db.prepare("SELECT count(*) AS n FROM page WHERE id = 'guide/statistiques-resistance-faiblesse'").get().n, 0);
  assert.equal(db.prepare("SELECT count(*) AS n FROM source WHERE onglets LIKE '%Statistiques%'").get().n, 0);
});

// Décision R90 (« Arcane résiste de base à la corruption et corruption résite à l'arcane. », 2026-10-16) : les listes de « Magie Maverick V8 »
// font foi, pas la matrice de la fiche auto (Magie!F2:S16), qui faisait résister chacune à elle-même ; la matrice et ses deux vues sont retirées (0051).
// magie_resistance ne se modifie pas sur le site de dev : l'état courant est celui de l'import.
const ARCANE = 'magies/magie-de-larcane';
const CORRUPTION = 'magies/magie-de-la-corruption';

test('décision R90 : l’Arcane et la Corruption résistent chacune à l’autre, et ni l’une ni l’autre à elle-même ; la matrice de la fiche est retirée', () => {
  const liste = (magie) => db.prepare("SELECT sens, cible_magie_id FROM magie_resistance WHERE magie_id = ? AND cible_type = 'magie' ORDER BY rang").all(magie)
    .map((r) => ({ ...r }));
  assert.deepEqual(liste(ARCANE), [{ sens: 'resistance', cible_magie_id: CORRUPTION }]);
  assert.deepEqual(liste(CORRUPTION), [{ sens: 'resistance', cible_magie_id: ARCANE }]);
  // La combinaison des deux (R85) : une résistance à chacune.
  assert.deepEqual(paliersDu([ARCANE, CORRUPTION].sort((a, b) => ordreDe(a) - ordreDe(b))), { resistance: ['Arcane', 'Corruption'] });
  const objets = db.prepare("SELECT name FROM sqlite_master WHERE name IN ('resistance_magie', 'v_resistance_magie_lectures', 'v_resistance_ecart')").all();
  assert.deepEqual(objets, []);
  assert.equal(db.prepare("SELECT count(*) AS n FROM ecart_source WHERE entite_table = 'resistance_magie'").get().n, 0);
});

function ordreDe(magie) {
  return db.prepare('SELECT ordre FROM magie WHERE id = ?').get(magie).ordre;
}
