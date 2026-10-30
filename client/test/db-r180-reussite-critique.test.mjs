// Décision R180 du propriétaire (2026-10-30), « nerf de la réussite critique » : Affûtage coûte 4 chakra ; « Prends ça … » est un IC ; en Mode
// Hyper, les amplifications de la Lumière deviennent aussi des IC (mêmes exceptions) ; les nombres du critique (base 5, paliers 96 et 103, +2 et +5
// au total, plafond 15) et les jets où compte le bonus de critique d'une posture sont des données. Migration
// data/migrations/0087-r180-reussite-critique.sql ; pages du guide passées par db:sync-pages. Lecture seule de la base construite. Les lignes
// 'don_de_posture' de posture_critique sont retirées par R182 (migration 0089 : test/db-r182-critique-du-sort-prepare.test.mjs).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { lecteurDAcquis } from '../src/lib/acquis-texte.mjs';
import { corpsDeMagieApres, morceauxDuCorpsDeMagie } from '../src/lib/corps-magies.mjs';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { effetsDuModeHyper } from '../src/lib/mode-hyper-texte.mjs';
import { COMPETENCES_D_ATTAQUE } from '../src/lib/posture-texte.mjs';

const db = ouvrirBase({ sansExemples: false });
const corps = (id) => db.prepare('SELECT corps_md FROM page WHERE id = ?').get(id).corps_md;

const AFFUTAGE = 'magies/magie-de-la-foudre#sort:affutage';
const PRENDS_CA = 'capacites/moine-prend-ca';
const EFFET_PRENDS_CA = "Donne +5% à la réussite critique pour la prochaine attaque. C'est un IC.";
const LUMIERE = 'magies/magie-de-la-lumiere';
const MONO = 'Les soins, les protections et les amplifications deviennent des IC le temps du mode hyper (sauf les sorts niveau de puissance 5).';
const BI = 'Chaque tour, un soin, une protection ou une amplification est un IC (seulement le premier IC). (sauf les sorts niveau de puissance 5).';
const OFFENSIF = 'guide/postures#posture:offensif';
const DEFENSIF = 'guide/postures#posture:defensif';
const SIX_JETS = ['arbalete', 'arc', 'arme-legere', 'arme-lourde', 'concentration', 'magie'];

test('R180 : Affûtage coûte 4 chakra, garde son effet « 2% (+1/NM) » et n’a pas de coût secondaire ; la ligne du tableau de sa page suit', () => {
  const s = db.prepare('SELECT * FROM sort WHERE id = ?').get(AFFUTAGE);
  assert.equal(s.cout_brut, '4');
  assert.equal(s.cout_chakra, 4);
  assert.equal(s.cout_secondaire, null);
  assert.equal(s.effets, "Permet d'augmenter la réussite critique de 2% (+1/NM) à la prochaine attaque avec une arme.");
  assert.equal(s.type_brut, 'Amplification\n(IC)');
  const page = corps('magies/magie-de-la-foudre');
  const ligne = morceauxDuCorpsDeMagie(page).sorts.find((c) => c[1] === 'Affûtage');
  assert.equal(ligne[3], '4.0');
  // la page est d'accord avec la ligne : le module de l'édition n'y change rien
  assert.equal(corpsDeMagieApres(page, 'sort', { ...s }, { ...s }), page);
});

test('R180 : « Prends ça … » est un IC, écrit dans son effet et sa fiche ; son type et sa limite ne changent pas ; aucun bonus de compétence n’y est lu', () => {
  const k = db.prepare('SELECT * FROM capacite WHERE id = ?').get(PRENDS_CA);
  assert.equal(k.effet, EFFET_PRENDS_CA);
  assert.equal(k.type_brut, 'Actif (3 fois/combat)');
  assert.equal(k.type, 'actif');
  assert.deepEqual([k.limite_nombre, k.limite_periode], [3, 'combat']);
  const p = db.prepare('SELECT corps_md, resume FROM page WHERE id = ?').get(PRENDS_CA);
  assert.deepEqual({ ...p }, { corps_md: `${EFFET_PRENDS_CA}\n`, resume: EFFET_PRENDS_CA });
  const lire = lecteurDAcquis(db.prepare('SELECT id, nom FROM competence').all());
  assert.deepEqual(lire(k.effet), []);
});

test('R180 : Mode Hyper de la Lumière — les trois copies (classeur_modes, onglet_magie, fiche), mono et bi, ajoutent les amplifications ; magie_masque intacte', () => {
  const lignes = db.prepare(`SELECT version, variante, effet FROM mode_hyper_effet
                             WHERE magie_id = ? AND magie2_id IS NULL AND portee = 'magie' ORDER BY version, variante`).all(LUMIERE);
  assert.deepEqual(lignes.map((l) => ({ ...l })), [
    { version: 'classeur_modes', variante: 'bi', effet: BI },
    { version: 'classeur_modes', variante: 'mono', effet: MONO },
    { version: 'fiche', variante: 'bi', effet: BI },
    { version: 'fiche', variante: 'mono', effet: MONO },
    { version: 'magie_masque', variante: 'mono', effet: 'Les soins deviennent des IC (Instant Cast) et sont au maximum de leur effet.' },
    { version: 'onglet_magie', variante: 'bi', effet: BI },
    { version: 'onglet_magie', variante: 'mono', effet: MONO },
  ]);
  // le texte ne chiffre rien que la fiche applique (lib/mode-hyper-texte.mjs)
  assert.deepEqual([effetsDuModeHyper(MONO), effetsDuModeHyper(BI)], [[], []]);
  // la page de la magie, la liste des effets du Mode Hyper, et pas la liste de l'onglet masqué (magie_masque)
  assert.deepEqual(morceauxDuCorpsDeMagie(corps(LUMIERE)).hyper.map((h) => h.effet), [MONO, BI]);
  assert.ok(corps('guide/liste-des-effets-mode-hyper').includes(`| Lumière | ${MONO} | ${BI} |`));
  assert.ok(corps('guide/mode-hyper-magie').includes('| Lumière | Les soins deviennent des IC (Instant Cast) et sont au maximum de leur effet. |'));
  assert.ok(!corps('guide/mode-hyper-magie').includes('amplifications deviennent'));
});

test('R180 : les nombres du critique sont des constantes de règle, chacune citée d’une phrase de « Réussir une action »', () => {
  const lignes = db.prepare("SELECT id, valeur, unite, nature, texte, page_id, source_ref FROM regle_constante WHERE id LIKE 'critique.%' ORDER BY id").all();
  assert.deepEqual(Object.fromEntries(lignes.map((l) => [l.id, l.valeur])), {
    'critique.base': 5, 'critique.palier_1_bonus': 2, 'critique.palier_1_score_min': 96,
    'critique.palier_2_bonus': 5, 'critique.palier_2_score_min': 103, 'critique.plafond': 15,
  });
  const page = corps('guide/reussir-une-action');
  for (const l of lignes) {
    assert.deepEqual([l.unite, l.nature, l.page_id, l.source_ref], ['%', 'texte', 'guide/reussir-une-action', 'Décision R180 du propriétaire'], l.id);
    assert.ok(page.includes(l.texte), `${l.id} : « ${l.texte} » dans la page`);
  }
});

test('R180 : le bonus de critique de l’Offensif compte sur six jets (Concentration comprise), différents des cinq de son −10 % (R100) ; le Défensif sur Esquive et Parade', () => {
  const jets = (posture, bonus) => db.prepare(`SELECT competence_id FROM posture_critique WHERE posture_id = ? AND bonus = ?
                                               ORDER BY competence_id`).all(posture, bonus).map((r) => r.competence_id);
  assert.deepEqual(jets(OFFENSIF, 'posture'), SIX_JETS);
  // Q90 tranchée par R182 (migration 0089) : un don « (Posture Offensif) » (Sci du Crit) n'a plus de ligne, il n'est que mentionné sur la fiche
  // (test/db-r182-critique-du-sort-prepare.test.mjs)
  assert.deepEqual(jets(OFFENSIF, 'don_de_posture'), []);
  assert.deepEqual(jets(DEFENSIF, 'posture'), ['esquive', 'parade']);
  assert.equal(db.prepare('SELECT count(*) AS n FROM posture_critique').get().n, 8);
  assert.deepEqual(SIX_JETS.filter((c) => !COMPETENCES_D_ATTAQUE.includes(c)), ['concentration']);
  assert.equal(COMPETENCES_D_ATTAQUE.length, 5);
});

test('R180 : le guide rappelle le plafond de 1 à 15 là où il élargit la réussite critique, jamais dans les textes tels quels des postures', () => {
  const PLAFOND = /jamais (?:au-delà de |dépasser |)1 à 15|ne dépasse jamais(?: \*\*)? ?1 à 15/;
  for (const id of ['guide/reussir-une-action', 'guide/les-postures', 'guide/aide-memoire', 'guide/lexique', 'guide/attaquer-et-se-defendre', 'guide/situations-avancees']) {
    assert.match(corps(id), PLAFOND, id);
  }
  const reussir = corps('guide/reussir-une-action');
  assert.ok(reussir.includes('Au-delà de 95 %, le surplus élargit la réussite critique : de 96 à 102 %, +2 % ; à partir de 103 %, +5 % au total.'));
  assert.ok(reussir.includes('Le score compté est celui du moment, posture comprise, et ce bonus vaut sur tout jet, quelle que soit la posture.'));
  assert.ok(reussir.includes('la posture offensive pour les six jets d’attaque (*Arc*, *Arbalète*, *Arme Légère*, *Arme Lourde*, *Magie* et *Concentration*)'));
  // textes copiés des Docs : inchangés (« monte à 10 ou moins », sans plafond)
  for (const id of ['guide/postures', 'guide/fiche-tableau-posture']) {
    assert.ok(corps(id).includes('cette réussite critique monte à 10 ou moins'), id);
    assert.ok(!corps(id).includes('1 à 15'), id);
  }
  assert.equal(db.prepare("SELECT count(*) AS n FROM posture_effet WHERE texte LIKE '%1 à 15%' OR texte LIKE '%103%'").get().n, 0);
});
