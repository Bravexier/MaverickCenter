// Rejeu d'un journal du site de dev noté avant la migration 0075 (décision R155, étendue au bestiaire le 2026-10-22 : « Pareil remplace double
// résistance par Grande résistance ») : 0075 a rangé les rubriques « Double(s) Résistance(s) » en grande_resistance avec leurs cibles typées
// (monstre_defense.sens), et passé les titres ÷4 / x4 en ÷3 / x3. serveur/edition-bestiaire.mjs#ancienneEcritureDesResistances traduit le sens
// 'double_resistance' (équivalent sûr) et met en conflit, avec un message qui dit quoi refaire, un lot qui note un titre d'avant 0075.
// Les lots « d'avant » sont fabriqués depuis ce que le service note aujourd'hui, remis dans la forme d'avant 0075 (comme dans le journal du site de dev).
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { traiter } from '../serveur/api.mjs';
import { ouvrirBaseVivante, preparerBaseVivante } from '../serveur/base-vivante.mjs';
import { rejouerLeJournal } from '../serveur/edition.mjs';
import { TITRES_D_AVANT_0075 } from '../serveur/edition-bestiaire.mjs';
import { rejouer } from '../serveur/edition-journal.mjs';
import { cheminBase } from '../src/lib/donnees.mjs';

const racine = mkdtempSync(join(tmpdir(), 'maverick-rejeu-resistances-'));
after(() => rmSync(racine, { recursive: true, force: true }));
let compteur = 0;
const ouvertes = [];
after(() => ouvertes.forEach((b) => b.isOpen && b.close()));
const vivante = () => {
  const b = ouvrirBaseVivante(preparerBaseVivante({ regles: cheminBase({ sansExemples: false }), dossier: join(racine, `b${(compteur += 1)}`) }).chemin);
  ouvertes.push(b);
  return b;
};

/** Une base vivante neuve qui reçoit le journal de `source` tel quel, puis le rejoue clés coupées (comme base-vivante.mjs#transferer). */
function rebatir(source, rejeu = (db) => rejouerLeJournal(db, {})) {
  const neuve = vivante();
  for (const l of source.prepare('SELECT * FROM modification_lot').all()) {
    neuve.prepare('INSERT INTO modification_lot (id, fait_le, auteur_id, page_id, resume) VALUES (?, ?, ?, ?, ?)').run(l.id, l.fait_le, l.auteur_id, l.page_id, l.resume);
  }
  for (const m of source.prepare('SELECT * FROM modification').all()) {
    neuve.prepare('INSERT INTO modification (lot_id, rang, table_nom, cle, operation, avant, apres, etat, detail, apercu) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(m.lot_id, m.rang, m.table_nom, m.cle, m.operation, m.avant, m.apres, m.etat, m.detail, m.apercu);
  }
  neuve.exec('PRAGMA foreign_keys = OFF');
  neuve.exec('BEGIN');
  const bilan = rejeu(neuve);
  neuve.exec('COMMIT');
  neuve.exec('PRAGMA foreign_keys = ON');
  return { base: neuve, bilan };
}
const enregistrer = (base, operations) => {
  const r = traiter({ methode: 'POST', chemin: '/api/edition/', entetes: { 'content-type': 'application/json' }, corps: JSON.stringify({ page: 'bestiaire/', operations }) },
    { base: () => base, etat: () => ({}), edition: true });
  assert.equal(r.statut, 200, JSON.stringify(r.corps));
  return r.corps;
};
/**
 * Les titres que 0075 réécrit, lus dans la migration (« UPDATE … SET … titre = 'après' WHERE rubrique = '…' AND titre = 'avant' ») :
 * [{ rubrique, avant, apres }] ; deux titres d'avant donnent le même après (« Double(s) Résistance(s) Dégâts ÷4 » et « Grande(s) … ÷4 »).
 */
const TITRES_DE_0075 = [...readFileSync(new URL('../../data/migrations/0075-r155-titres-du-bestiaire.sql', import.meta.url), 'utf8')
  .matchAll(/^UPDATE monstre_rubrique SET [^;]*?titre = '([^']+)'\s*WHERE rubrique = '([a-z_]+)' AND titre = '([^']+)';/gms)]
  .map((m) => ({ apres: m[1], rubrique: m[2], avant: m[3] }));
const titreDAvant0075 = (rubrique, titre) => TITRES_DE_0075.find((t) => t.rubrique === rubrique && t.apres === titre)?.avant;
const AVANT_0075 = /noté avant la migration 0075 \(décision R155\) : le titre de la rubrique écrit encore l’ancien multiplicateur/;
const conflits = (base) => base.prepare("SELECT DISTINCT detail FROM modification WHERE etat = 'conflit'").all().map((r) => r.detail);

// le Collecteur : sa rubrique 11 était « Double(s) Résistance(s) Dégâts/Effets ÷4 » (Foudre, Paralysie, Confusion) avant 0075
const COLLECTEUR = 'monstres/collecteur#carte:collecteur';
const RANG = 11;
const ANCIENS_TITRES = { 'Grande(s) Résistance(s) Dégâts/Effets ÷3': 'Double(s) Résistance(s) Dégâts/Effets ÷4' };
const cibles = (base, sens) => base.prepare('SELECT rang, cible FROM monstre_defense WHERE monstre_id = ? AND sens = ? ORDER BY rang').all(COLLECTEUR, sens)
  .map((c) => ({ ...c }));
const doubles = (base) => base.prepare("SELECT count(*) AS n FROM monstre_defense WHERE sens = 'double_resistance'").get().n
  + base.prepare("SELECT count(*) AS n FROM monstre_rubrique WHERE rubrique = 'double_resistance'").get().n;

/** Le journal de `base` remis dans la forme d'avant 0075 : sens et rubrique 'double_resistance', titre « Double(s) … ÷4 » (rubrique 11 du Collecteur). */
function enFormeDAvant0075(base) {
  const versDouble = (v) => {
    if (!v) return v;
    const r = { ...v };
    if (r.sens === 'grande_resistance') r.sens = 'double_resistance';
    if (r.rubrique === 'grande_resistance') r.rubrique = 'double_resistance';
    if (r.titre in ANCIENS_TITRES) r.titre = ANCIENS_TITRES[r.titre];
    return r;
  };
  const ecrit = (v) => (v === null ? null : JSON.stringify(v));
  for (const m of base.prepare("SELECT * FROM modification WHERE table_nom IN ('monstre_defense', 'monstre_rubrique')").all()) {
    const cle = JSON.parse(m.cle);
    if (cle.monstre_id !== COLLECTEUR) continue;
    if (m.table_nom === 'monstre_rubrique' && cle.rang !== RANG) continue;
    if (m.table_nom === 'monstre_defense' && cle.sens !== 'grande_resistance') continue;
    base.prepare('UPDATE modification SET cle = ?, avant = ?, apres = ? WHERE lot_id = ? AND rang = ?')
      .run(JSON.stringify(versDouble(cle)), ecrit(versDouble(JSON.parse(m.avant))), ecrit(versDouble(JSON.parse(m.apres))), m.lot_id, m.rang);
  }
}

test('décision R155 : le texte de la Double résistance du Collecteur modifié avant 0075 se rejoue en Grande résistance — aucune cible double_resistance', () => {
  const source = vivante();
  const rubrique = source.prepare('SELECT rubrique, texte FROM monstre_rubrique WHERE monstre_id = ? AND rang = ?').get(COLLECTEUR, RANG);
  assert.equal(rubrique.rubrique, 'grande_resistance', 'la rubrique 11 du Collecteur est rangée en grande_resistance (0075)');
  assert.equal(rubrique.texte, 'Foudre, Paralysie, Confusion');
  // deux lots : une cible ajoutée (inserer dans monstre_defense), puis une changée et deux retirées (modifier, supprimer)
  const modifier = (texte) => enregistrer(source, [{ op: 'modifier', table: 'monstre_rubrique', cle: { monstre_id: COLLECTEUR, rang: RANG }, valeurs: { texte } }]);
  modifier('Foudre, Paralysie, Confusion, Glace');
  modifier('Foudre, Feu');
  const voulues = cibles(source, 'grande_resistance');
  assert.deepEqual(voulues.map((c) => c.cible), ['Foudre', 'Feu']);
  enFormeDAvant0075(source);
  assert.ok(source.prepare("SELECT count(*) AS n FROM modification WHERE table_nom = 'monstre_defense' AND json_extract(cle, '$.sens') = 'double_resistance'").get().n >= 3,
    'le journal d’avant 0075 note des cibles double_resistance');

  // témoin : rejoué sans l'adaptateur, le premier lot remet une cible double_resistance à côté de celles que 0075 a rangées en grande_resistance, et
  // le second passe en conflit (sa cible double_resistance à modifier n'existe plus)
  const temoin = rebatir(source, (db) => rejouer(db, {}));
  assert.equal(temoin.base.prepare("SELECT count(*) AS n FROM monstre_defense WHERE sens = 'double_resistance'").get().n, 1, 'sans l’adaptateur, une cible double_resistance revient');
  assert.equal(conflits(temoin.base).length, 1, 'sans l’adaptateur, le second lot est en conflit');

  const { base, bilan } = rebatir(source);
  assert.equal(bilan.conflits, 0, JSON.stringify(conflits(base)));
  assert.equal(doubles(base), 0, 'aucune rubrique ni cible double_resistance');
  assert.equal(base.prepare('SELECT texte FROM monstre_rubrique WHERE monstre_id = ? AND rang = ?').get(COLLECTEUR, RANG).texte, 'Foudre, Feu');
  assert.deepEqual(cibles(base, 'grande_resistance'), voulues, 'les cibles sont celles du texte, en grande_resistance');
  assert.deepEqual(base.prepare('PRAGMA foreign_key_check').all(), []);
});

test('décision R155 : une carte supprimée avant 0075 (sa rubrique notée « Double(s) Résistance(s) … ÷4 ») : conflit explicite, la carte reste', () => {
  const source = vivante();
  const rubriques = source.prepare('SELECT count(*) AS n FROM monstre_rubrique WHERE monstre_id = ?').get(COLLECTEUR).n;
  const defenses = cibles(source, 'grande_resistance');
  enregistrer(source, [{ op: 'supprimer', entite: 'monstre', cle: { id: COLLECTEUR } }]);
  enFormeDAvant0075(source);
  assert.equal(source.prepare("SELECT count(*) AS n FROM modification WHERE table_nom = 'monstre_rubrique' AND json_extract(avant, '$.titre') = 'Double(s) Résistance(s) Dégâts/Effets ÷4'").get().n, 1);

  const { base, bilan } = rebatir(source);
  assert.equal(bilan.appliquees, 0);
  const [detail, ...autres] = conflits(base);
  assert.equal(autres.length, 0, 'un seul lot, un seul conflit');
  assert.match(detail, /noté avant la migration 0075 \(décision R155\) : le titre de la rubrique écrit encore l’ancien multiplicateur/);
  assert.match(detail, /la supprimer de nouveau/);
  assert.equal(base.prepare('SELECT count(*) AS n FROM monstre WHERE id = ?').get(COLLECTEUR).n, 1);
  assert.equal(base.prepare('SELECT count(*) AS n FROM monstre_rubrique WHERE monstre_id = ?').get(COLLECTEUR).n, rubriques);
  assert.deepEqual(cibles(base, 'grande_resistance'), defenses);
  assert.equal(doubles(base), 0);
});

test('décision R155 : une carte supprimée après 0075 (titres en ÷3) se rejoue sans conflit', () => {
  const source = vivante();
  enregistrer(source, [{ op: 'supprimer', entite: 'monstre', cle: { id: COLLECTEUR } }]);
  const { base, bilan } = rebatir(source);
  assert.equal(bilan.conflits, 0, JSON.stringify(conflits(base)));
  assert.equal(base.prepare('SELECT count(*) AS n FROM monstre WHERE id = ?').get(COLLECTEUR).n, 0);
  assert.equal(base.prepare('SELECT count(*) AS n FROM monstre_defense WHERE monstre_id = ?').get(COLLECTEUR).n, 0);
});

test('décision R155 : les titres que l’adaptateur reconnaît sont exactement les titres d’avant de la migration 0075', () => {
  assert.equal(TITRES_DE_0075.length, 8, 'les 8 UPDATE de titre de 0075');
  assert.deepEqual([...TITRES_D_AVANT_0075].sort(), TITRES_DE_0075.map((t) => t.avant).sort());
});

for (const [carte, rang, rubrique] of [['monstres/loup-garou#carte:loup-garou', 9, 'grande_vulnerabilite'], ['monstres/momie#carte:momie', 8, 'grande_resistance']]) {
  test(`décision R155 : une carte sans Double résistance supprimée avant 0075 (${carte}, ${rubrique} en ${rubrique === 'grande_resistance' ? '÷4' : 'x4'}) : conflit explicite, la carte reste`, () => {
    const source = vivante();
    const r = source.prepare('SELECT rubrique, titre FROM monstre_rubrique WHERE monstre_id = ? AND rang = ?').get(carte, rang);
    assert.equal(r.rubrique, rubrique);
    const ancien = titreDAvant0075(r.rubrique, r.titre);
    assert.ok(ancien && !ancien.startsWith('Double'), `« ${r.titre} » : un titre de ${rubrique} réécrit par 0075`);
    assert.equal(source.prepare("SELECT count(*) AS n FROM monstre_rubrique WHERE monstre_id = ? AND titre LIKE 'Double(s)%'").get(carte).n, 0);
    const rubriques = source.prepare('SELECT count(*) AS n FROM monstre_rubrique WHERE monstre_id = ?').get(carte).n;
    enregistrer(source, [{ op: 'supprimer', entite: 'monstre', cle: { id: carte } }]);
    // le lot tel que noté avant 0075 : le titre d'avant de la migration
    const m = source.prepare("SELECT lot_id, rang, avant FROM modification WHERE table_nom = 'monstre_rubrique' AND json_extract(cle, '$.monstre_id') = ? AND json_extract(cle, '$.rang') = ?").get(carte, rang);
    source.prepare('UPDATE modification SET avant = ? WHERE lot_id = ? AND rang = ?').run(JSON.stringify({ ...JSON.parse(m.avant), titre: ancien }), m.lot_id, m.rang);

    const { base, bilan } = rebatir(source);
    assert.equal(bilan.appliquees, 0);
    const [detail, ...autres] = conflits(base);
    assert.equal(autres.length, 0, 'un seul lot, un seul conflit');
    assert.match(detail, AVANT_0075);
    assert.equal(base.prepare('SELECT count(*) AS n FROM monstre WHERE id = ?').get(carte).n, 1);
    assert.equal(base.prepare('SELECT count(*) AS n FROM monstre_rubrique WHERE monstre_id = ?').get(carte).n, rubriques);
  });
}
