// Décisions R203, R204 et R205 du propriétaire (2026-11-07), appliquées à la base par les migrations data/migrations/0101-r203-plancher-du-critique,
// 0102-r204-description-de-calme et 0103-r205-etat-gel (registre 0103-r205-etat-gel.json). Lecture seule de la base construite.
//   - R203 : la plage de réussite critique ne descend jamais sous « 1 à 1 » : constante critique.plancher, borne basse du CHECK de la plage figée du
//     sort préparé (le calcul est épinglé dans le moteur : test/fiche-critique.test.mjs). regle_constante n'est écrite ni par lib/edition-modele.mjs ni
//     par le service : ses valeurs se lisent telles quelles.
//   - R204 : « Prouesse » est l'ancien nom de Calme ; la phrase du guide est la description de Calme. competence n'est écrite ni par
//     lib/edition-modele.mjs ni par le service : la valeur se lit telle quelle.
//   - R205 (3) : l'état s'appelle « Gel » dans les textes de règles modifiables. Ces textes sont modifiables sur le site de dev, source de ce qu'il
//     modifie : ce que la 0103 a écrit se lit dans l'état de la migration (baseDImport({ garder: lotsAvant('0103') }), skill tests-conventions), et
//     l'état courant ne garde que des invariants (monstre_defense dérive de ses rubriques).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { valeursDeLaCarte } from '../src/lib/monstre-champs.mjs';
import { baseDImport, lotsAvant } from './aide-base-d-import.mjs';

const db = ouvrirBase({ sansExemples: false });
const constante = (id) => db.prepare('SELECT * FROM regle_constante WHERE id = ?').get(id);
const registre = JSON.parse(readFileSync(new URL('../../data/migrations/0103-r205-etat-gel.json', import.meta.url), 'utf8'));
const apresLa0103 = () => baseDImport({ garder: lotsAvant('0103') });

// L'état écrit « Gelé » (mot entier : ni « Gelée », ni « Gelés »), ou « gelé N » / « Gelé N » avec un stade : les motifs de la 0103.
const ETAT_GELE = /(?<!\p{L})Gelé(?!\p{L})|(?<!\p{L})gelé(?= \d)/u;
const renomme = (t) => t.replace(/(?<!\p{L})([Gg])elé(?= \d)/gu, '$1el').replace(/(?<!\p{L})Gelé(?!\p{L})/gu, 'Gel');
// Les textes de règles modifiables de la décision (R205 : « résistances des magies, bestiaire, accessoires, maladies, capacités communes, Mage Bleu »).
const COLONNES = {
  magie_resistance: 'cible_brut', monstre_rubrique: 'texte', accessoire_effet: 'libelle', maladie: 'effets',
  monstre_capacite_commune: 'description', classe_annexe: 'texte', classe_annexe_entree: 'effet',
};
const ETAT_GEL = 'guide/liste-des-alterations-d-etat#etat:gel';

test('R203 : critique.plancher = 1, de la décision R203, dans la page du plafond ; c’est la borne basse du CHECK de la plage figée du sort préparé', () => {
  const p = constante('critique.plancher');
  assert.deepEqual([p.valeur, p.unite, p.nature, p.page_id, p.source_ref], [1, '%', 'texte', 'guide/reussites-echecs-et-critiques', 'Décision R203 du propriétaire']);
  assert.equal(p.page_id, constante('critique.plafond').page_id, 'à côté du plafond');
  assert.ok(p.valeur <= constante('critique.base').valeur && constante('critique.base').valeur <= constante('critique.plafond').valeur);
  const sql = db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'personnage_sort'").get().sql;
  const [, min, max] = /prepare_critique BETWEEN (\d+) AND (\d+)/.exec(sql);
  assert.deepEqual([Number(min), Number(max)], [p.valeur, constante('critique.plafond').valeur]);
});

test('R204 : Calme a pour description la phrase de « Prouesse », son ancien nom ; les 30 compétences ont la leur ; la trace de l’écart reste', () => {
  assert.equal(db.prepare("SELECT description FROM competence WHERE id = 'calme'").get().description, 'Faire preuve de sang-froid dans les situations dangereuses.');
  assert.deepEqual({ ...db.prepare("SELECT count(*) AS n, count(NULLIF(trim(description), '')) AS d FROM competence").get() }, { n: 30, d: 30 });
  assert.ok(db.prepare("SELECT 1 FROM ecart_source WHERE id = 'competence:calme:nom:nom_different:fiche:guide'").get(), 'ecart_source gardé (provenance, R204)');
});

test('R205 : le registre de la 0103 — chaque correction remplace l’état « Gelé » par « Gel » (motifs de la migration), dans les colonnes de la décision seulement', () => {
  const compte = {};
  for (const c of registre.corrections) {
    compte[c.table] = (compte[c.table] ?? 0) + 1;
    if (c.table === 'page') assert.deepEqual(c.cle, { id: 'classes/mage-bleu' }, 'seule page : celle du Mage Bleu, rendu de ses tables (lib/corps-classes.mjs)');
    else assert.equal(c.col, COLONNES[c.table], `${c.table} : colonne de la décision`);
    assert.match(c.avant, ETAT_GELE, JSON.stringify(c.cle));
    assert.doesNotMatch(c.apres, ETAT_GELE, JSON.stringify(c.cle));
    assert.equal(c.apres, renomme(c.avant), JSON.stringify(c.cle));
  }
  // les comptes de la décision (R205, « À appliquer ») ; le Mage Bleu : sa ligne, son entrée (R181) et sa page
  assert.deepEqual(compte, { magie_resistance: 5, monstre_rubrique: 83, accessoire_effet: 1, maladie: 1, monstre_capacite_commune: 3, classe_annexe: 1, classe_annexe_entree: 1, page: 1 });
  assert.equal(registre.derivees.monstre_defense.lignes.length, 77);
});

test('R205 : après la 0103, aucun texte de la décision n’écrit plus l’état « Gelé », chaque correction est en place, et monstre_defense n’a plus de cible gele', () => {
  const imp = apresLa0103();
  for (const [table, col] of Object.entries(COLONNES)) {
    const restes = imp.prepare(`SELECT "${col}" AS v FROM "${table}" WHERE "${col}" IS NOT NULL`).all().filter((l) => ETAT_GELE.test(l.v));
    assert.deepEqual(restes.map((l) => l.v), [], `${table}.${col}`);
  }
  for (const c of registre.corrections) {
    const ou = Object.keys(c.cle).map((k) => `"${k}" = ?`).join(' AND ');
    const v = imp.prepare(`SELECT "${c.col}" AS v FROM "${c.table}" WHERE ${ou}`).get(...Object.values(c.cle))?.v;
    assert.ok(typeof v === 'string' && v.includes(c.apres) && !v.includes(c.avant), `${c.table} ${JSON.stringify(c.cle)}`);
  }
  assert.equal(imp.prepare("SELECT count(*) AS n FROM monstre_defense WHERE cible_cle = 'gele'").get().n, 0);
  // les cibles « Gel » portent la clé de l'état (son identifiant, figé) ; les lignes de la dérivée du registre sont toutes là
  const cle = ETAT_GEL.slice(ETAT_GEL.indexOf('#etat:') + '#etat:'.length);
  const derivee = imp.prepare('SELECT cible, cible_cle FROM monstre_defense WHERE monstre_id = ? AND sens = ? AND rang = ?');
  for (const l of registre.derivees.monstre_defense.lignes) {
    assert.deepEqual({ ...derivee.get(l.monstre_id, l.sens, l.rang) }, { cible: 'Gel', cible_cle: cle }, JSON.stringify(l));
  }
  // la résistance d'une magie à l'état Gel est écrite « Gel » (cible_brut), l'état visé est le même
  const brutes = imp.prepare("SELECT cible_brut FROM magie_resistance WHERE cible_type = 'etat' AND cible_etat_id = ?").all(ETAT_GEL).map((r) => r.cible_brut);
  assert.ok(brutes.length >= 5 && brutes.every((b) => b === 'Gel'), brutes.join(', '));
});

test('R205 : ce que la décision laisse — l’identifiant de l’état, le sort « Cerveau gelé », les adjectifs — n’est dans aucune correction de la 0103', () => {
  assert.ok(db.prepare('SELECT 1 FROM etat WHERE id = ?').get(ETAT_GEL), 'identifiant de l’état inchangé');
  assert.ok(db.prepare("SELECT 1 FROM sort WHERE id = 'magies/magie-de-la-glace#sort:cerveau-gele'").get(), 'identifiant du sort inchangé');
  const tables = new Set(registre.corrections.map((c) => c.table));
  for (const t of ['sort', 'etat', 'historique_modification', 'note_version_ligne', 'monstre_espece', 'meteo', 'armure_elementaire_effet', 'arme_elementaire']) {
    assert.ok(!tables.has(t), t);
  }
  for (const c of registre.corrections) assert.doesNotMatch(c.avant, /(?<!\p{L})gel(?:é|ée|és|ées)(?! \d)(?!\p{L})/u, `adjectif laissé : ${JSON.stringify(c.cle)}`);
});

test('monstre_defense dérive des rubriques de sa carte (lib/monstre-champs.mjs#valeursDeLaCarte), sur la base courante comme le service la refait', () => {
  const rubriques = db.prepare('SELECT monstre_id, rang, rubrique, texte FROM monstre_rubrique ORDER BY monstre_id, rang').all();
  const parCarte = Map.groupBy(rubriques, (r) => r.monstre_id);
  const defense = db.prepare('SELECT sens, rang, cible, cible_cle FROM monstre_defense WHERE monstre_id = ?');
  const ligne = (d) => `${d.sens}|${d.rang}|${d.cible}|${d.cible_cle}`;
  const ecarts = [];
  for (const [carte, rs] of parCarte) {
    const attendu = valeursDeLaCarte(rs).defenses.map(ligne).sort();
    const reel = defense.all(carte).map(ligne).sort();
    if (JSON.stringify(attendu) !== JSON.stringify(reel)) ecarts.push(carte);
  }
  assert.deepEqual(ecarts, []);
  assert.equal(db.prepare('SELECT count(*) AS n FROM monstre_defense WHERE monstre_id NOT IN (SELECT monstre_id FROM monstre_rubrique)').get().n, 0);
});
