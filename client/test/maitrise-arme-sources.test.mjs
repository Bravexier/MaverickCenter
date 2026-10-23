// Les sources de maîtrise d'arme en tables (migration 0074-refonte-maitrises-armes, décisions R148 à R151, R154) : le lecteur de lib/maitrise-arme.mjs
// (lireLigneDeClasse, lireDon, nmGagnesDuDon), rejoué sur toute la base, redonne exactement les lignes de maitrise_arme_part,
// maitrise_arme_part_famille et capacite_nm_gagne (comme test/accessoire-champs.test.mjs pour accessoire_effet_cible) : un changement du lecteur ou d'un
// texte demande de réécrire ces lignes. Les règles que la base en tire sur les fiches : test/personnages-db.test.mjs.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { idDeSourceDeClasse, lireDon, lireLigneDeClasse, nmGagnesDuDon } from '../src/lib/maitrise-arme.mjs';

const db = ouvrirBase({ sansExemples: false });
const q = (sql) => db.prepare(sql).all().map((l) => ({ ...l }));
const familles = q('SELECT id, nom, maitrisable, categorie FROM arme_famille ORDER BY ordre');
const MAITRISABLES = new Set(familles.filter((f) => f.maitrisable).map((f) => f.id));
const parCle = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/** Les sources que le lecteur trouve dans la base : { parts, options }, une ligne par part et par option, comme les tables. */
function relire() {
  const parts = [];
  const options = [];
  const ajouter = (sourceId, origine, lu) => {
    assert.equal(lu.non_lues, undefined, `${sourceId} : tout se lit`);
    for (const p of lu.parts) {
      parts.push({ source_id: sourceId, rang: p.rang, ...origine, genre: p.genre, points: p.points, arme_famille_id: p.famille, limite_famille: p.limite });
      for (const id of p.options) options.push({ source_id: sourceId, rang: p.rang, arme_famille_id: id });
    }
  };
  for (const l of q('SELECT * FROM classe_maitrise_arme')) {
    const lu = lireLigneDeClasse(l, familles);
    if (lu) ajouter(idDeSourceDeClasse(l.classe_id, l.rang), { capacite_id: null, classe_id: l.classe_id, classe_rang: l.rang }, lu);
  }
  for (const d of q('SELECT id, effet FROM capacite')) {
    const lu = lireDon(d.effet, familles);
    if (lu) ajouter(d.id, { capacite_id: d.id, classe_id: null, classe_rang: null }, lu);
  }
  parts.sort((a, b) => parCle(a.source_id, b.source_id) || a.rang - b.rang);
  options.sort((a, b) => parCle(a.source_id, b.source_id) || a.rang - b.rang || parCle(a.arme_famille_id, b.arme_famille_id));
  return { parts, options };
}

test('le lecteur rejoué sur toute la base redonne maitrise_arme_part et maitrise_arme_part_famille (R148, R150, R151)', () => {
  const { parts, options } = relire();
  assert.deepEqual(q('SELECT * FROM maitrise_arme_part ORDER BY source_id, rang'), parts);
  assert.deepEqual(q('SELECT * FROM maitrise_arme_part_famille ORDER BY source_id, rang, arme_famille_id'), options);
  assert.ok(parts.length > 0 && options.length > 0);
});

test('le lecteur rejoué sur toute la base redonne capacite_nm_gagne (R154) : les dons qui écrivent « Gagne N niveaux de maîtrise (NM) », et eux seuls', () => {
  const attendu = q('SELECT id, effet FROM capacite ORDER BY id').map((d) => ({ capacite_id: d.id, nm: nmGagnesDuDon(d.effet) })).filter((d) => d.nm > 0);
  assert.deepEqual(q('SELECT capacite_id, nm FROM capacite_nm_gagne ORDER BY capacite_id'), attendu);
});

test('invariants des parts : familles maîtrisables (jamais ARME DE MONSTRES, R45), options d’une part à choisir seulement, une part à choisir au plus par source', () => {
  for (const p of q('SELECT * FROM maitrise_arme_part')) {
    if (p.genre === 'imposee') assert.ok(MAITRISABLES.has(p.arme_famille_id), `${p.source_id} : R45`);
    const n = db.prepare('SELECT count(*) AS n FROM maitrise_arme_part_famille WHERE source_id = ? AND rang = ?').get(p.source_id, p.rang).n;
    assert.equal(n > 0, p.genre === 'choix', `${p.source_id} ${p.rang} : des options pour une part à choisir, et pour elle seule`);
  }
  for (const o of q('SELECT * FROM maitrise_arme_part_famille')) assert.ok(MAITRISABLES.has(o.arme_famille_id), `${o.source_id} : R45`);
  assert.deepEqual(q("SELECT source_id FROM maitrise_arme_part WHERE genre = 'choix' GROUP BY source_id HAVING count(*) > 1"), [],
    'une source a au plus une part à choisir : un choix de la fiche se range par (source, point)');
  // un don qui suit (R151) est d'une classe à une seule maîtrise au choix, sur laquelle il se règle
  for (const p of q("SELECT m.source_id, k.classe_id FROM maitrise_arme_part m JOIN capacite k ON k.id = m.capacite_id WHERE m.genre = 'suit'")) {
    assert.equal(db.prepare("SELECT count(*) AS n FROM classe_maitrise_arme WHERE classe_id = ? AND forme = 'au_choix'").get(p.classe_id).n, 1, p.source_id);
  }
});
