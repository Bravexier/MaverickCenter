// Champs de l'onglet « Armes » (lib/arme-champs.mjs) : les découpages que l'édition du site de dev applique quand une cellule change doivent redonner,
// sur toutes les armes, tous les matériaux et toutes les améliorations d'arme de la base, exactement les colonnes typées et les tables de détail en
// place (arme, arme_degats, arme_prerequis, materiau_arme, amelioration_equipement, amelioration_total). Invariants : ils tiennent aussi après une
// modification depuis le site, que le service recalcule avec ces mêmes fonctions.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import {
  analyserCoutDAmelioration, analyserEffetDAmelioration, analyserEffetDArme, analyserEffetDeMateriau, colonnesDeLArme, COMPETENCES_D_ARME,
  competencesDArme, coutEnRo, decouperCategorieDArme, decouperNomDArme, durabiliteDeLArme, ECRITURES_DE_COMPETENCE, nomBrutDArme, prixEnRf, prixEnRo,
  totalDesAmeliorations,
} from '../src/lib/arme-champs.mjs';
import { prixEnRf as prixEnRfDUneRessource } from '../src/lib/composants-champs.mjs';
import { baseDImport } from './aide-base-d-import.mjs';

const db = ouvrirBase({ sansExemples: false });
const caracteristiques = db.prepare('SELECT id, nom FROM caracteristique').all();
const types = new Map(db.prepare('SELECT * FROM arme_type').all().map((t) => [t.id, t]));
const armes = db.prepare('SELECT * FROM arme WHERE effet IS NOT NULL ORDER BY id').all();

test('chaque arme (hors armes de monstres, sans effet) : ses colonnes typées se refont depuis ses cellules', () => {
  // plus de cent à l'import ; sur l'état courant, toutes celles de la base (le site de dev en supprime)
  assert.ok(baseDImport().prepare('SELECT count(*) AS n FROM arme WHERE effet IS NOT NULL').get().n > 100, 'à l’import');
  for (const a of armes) {
    const colonnes = colonnesDeLArme(a, types.get(a.type_id), caracteristiques, a);
    for (const [c, v] of Object.entries(colonnes)) assert.equal(v, a[c] ?? null, `${a.id} › ${c}`);
    assert.deepEqual(Object.keys(colonnes).filter((c) => c.endsWith('_brut')), [], 'cellules brutes gardées quand nom, mains, type et catégorie ne changent pas');
  }
});

test('chaque arme : ses types de dégâts (arme_degats) et ses minimums de caractéristique (arme_prerequis) se refont depuis son effet', () => {
  const degats = db.prepare('SELECT type_degats FROM arme_degats WHERE arme_id = ? ORDER BY type_degats');
  const prerequis = db.prepare('SELECT caracteristique_id, minimum, exigence, texte FROM arme_prerequis WHERE arme_id = ? ORDER BY caracteristique_id');
  for (const a of armes) {
    const e = analyserEffetDArme(a.effet, caracteristiques);
    assert.deepEqual([...e.degats].sort(), degats.all(a.id).map((r) => r.type_degats), a.id);
    assert.deepEqual([...e.prerequis].sort((x, y) => x.caracteristique_id.localeCompare(y.caracteristique_id)), prerequis.all(a.id).map((r) => ({ ...r })), a.id);
  }
});

test('nom et compétence : la cellule Nom se découpe en nom + mains, la Catégorie en type + compétence, et se réécrivent', () => {
  for (const a of db.prepare('SELECT * FROM arme').all()) {
    assert.deepEqual(decouperNomDArme(a.nom_brut), { nom: a.nom, mains: a.mains }, a.id);
    assert.equal(decouperCategorieDArme(a.categorie_brut).competence_brut, a.competence_brut, a.id);
    assert.equal(coutEnRo(a.cout_brut), a.cout_ro, a.id);
    assert.ok(ECRITURES_DE_COMPETENCE.includes(a.competence_brut), `${a.id} : compétence ${a.competence_brut}`);
    assert.ok(competencesDArme(a.competence_brut).length >= 1, a.id);
  }
  assert.equal(nomBrutDArme('Flamberge', 'deux'), 'Flamberge\n(deux mains)');
  assert.equal(nomBrutDArme('Katana', null), 'Katana');
  // une arme changée de mains et de type se réécrit : le Fauchon de l'import (test/aide-base-d-import.mjs), lu par son identifiant (le site de dev en
  // modifie librement les champs)
  const imp = baseDImport();
  const fauchon = imp.prepare("SELECT * FROM arme WHERE id = 'ressources/armes#arme:epees:fauchon'").get();
  const masse = imp.prepare("SELECT * FROM arme_type WHERE id = 'masse'").get();
  const c = colonnesDeLArme({ ...fauchon, mains: 'une', type_id: 'masse' }, masse, imp.prepare('SELECT id, nom FROM caracteristique').all(), fauchon);
  assert.equal(c.nom_brut, `${fauchon.nom}\n(une main)`);
  assert.equal(c.categorie_brut, `${masse.nom}\n${fauchon.competence_brut}`);
});

test('compétences (décision R48, corrigée) : Lourde, Légère, les deux, Arc, Arc / Légère, Arbalète ; ids, noms et caractéristiques de la table competence', () => {
  const ids = (ecriture) => competencesDArme(ecriture).map((c) => c.id);
  assert.deepEqual(ids('Arme Lourde'), ['arme-lourde']);
  assert.deepEqual(ids('Arme Légère'), ['arme-legere']);
  assert.deepEqual(ids('Arme Lourde/Légère'), ['arme-lourde', 'arme-legere']);
  // « Il y a bien une catégorie "Arc" […] Il y a donc "Arc (rouge)" et "Arc / arme légère" » ; « Renomme également "précision" en "Arbalète" »
  assert.deepEqual(ids('Arc'), ['arc']);
  assert.deepEqual(ids('Arc / Arme Légère'), ['arc', 'arme-legere']);
  assert.deepEqual(competencesDArme('Arc').map((c) => [c.libelle, c.caracteristique_id]), [['Arc', 'force']]);
  assert.deepEqual(competencesDArme('Arbalète').map((c) => [c.libelle, c.caracteristique_id]), [['Arbalète', 'perception']]);
  assert.deepEqual(competencesDArme('Arme Lourde').map((c) => c.caracteristique_id), ['force']);
  assert.deepEqual(competencesDArme('Arme Légère').map((c) => c.caracteristique_id), ['agilite']);
  assert.deepEqual(ids('Inconnue'), []);
  // la couleur vient de la caractéristique de la compétence : celle de la base
  const competence = db.prepare('SELECT nom, caracteristique_id FROM competence WHERE id = ?');
  for (const [id, c] of Object.entries(COMPETENCES_D_ARME)) {
    assert.deepEqual({ ...competence.get(id) }, { nom: c.nom, caracteristique_id: c.caracteristique_id }, id);
  }
});

test('effets supplémentaires : l’effet sans les clauses montrées dans une autre colonne ; une valeur des modes qui diverge reste écrite', () => {
  const e = analyserEffetDArme('Dégâts taille/estoc, 4 de Force minimum, +5 dégâts, +5% Parade avec cette arme, Origine Lamia', caracteristiques);
  assert.equal(e.autres, '4 de Force minimum, +5% Parade avec cette arme');
  assert.deepEqual([e.bonus_degats, e.provenance, e.degats], [5, 'Lamia', ['taille', 'estoc']]);
  // « +4 dégâts estoc » n'est pas un bonus de dégâts
  assert.equal(analyserEffetDArme('Dégâts taille /estoc, +4 dégâts estoc, -4 dégâts taille, Origine Elfe').bonus_degats, null);
  // modes : retenu seulement si chaque mode le donne
  const batarde = analyserEffetDArme('Une main = Estoc/Taille, Arme lourde, 2 de Force minimum, +2 dégâts\nDeux mains = Estoc/Taille, Arme légère, 2 de Force minimum, +2 dégâts');
  assert.deepEqual([batarde.bonus_degats, batarde.degats], [2, ['taille', 'estoc']]);
  assert.equal(batarde.autres, 'Une main = Arme lourde, 2 de Force minimum\nDeux mains = Arme légère, 2 de Force minimum');
  const eventail = analyserEffetDArme('Ouvert = Dégâts taille, +5% au jet de défense\nFermé = Dégâts estoc, +2 dégâts, Ignore 2AP');
  assert.deepEqual([eventail.bonus_degats, eventail.degats, eventail.ignore_ap], [null, [], null]);
  assert.equal(eventail.autres, 'Ouvert = Dégâts taille, +5% au jet de défense\nFermé = Dégâts estoc, +2 dégâts, Ignore 2AP');
  // dé de l'effet, solidité
  const courte = analyserEffetDArme('Dégâts taille/estoc, D8 au lieu du D10');
  assert.deepEqual([courte.de, courte.autres], ['D8', '']);
  assert.equal(durabiliteDeLArme(analyserEffetDArme('Dégâts taille, 1 seul point de solidité'), 2), 1);
  assert.equal(durabiliteDeLArme(analyserEffetDArme('Dégâts frappe, -1 cran de solidité'), 2), 1);
  assert.equal(durabiliteDeLArme(analyserEffetDArme('Dégâts frappe'), 2), 2);
});

test('durabilité de l’arme nue : celle de la vue v_arme (2 crans de base, règle de l’onglet), jamais moins de 1 (R51, R74)', () => {
  const durabilites = (base) => {
    const solidite = base.prepare("SELECT valeur FROM constante_equipement WHERE id = 'arme.solidite_base'").get().valeur;
    const vue = new Map(base.prepare('SELECT id, solidite_sans_composition FROM v_arme').all().map((v) => [v.id, v.solidite_sans_composition]));
    const lignes = base.prepare('SELECT * FROM arme ORDER BY id').all();
    assert.equal(vue.size, lignes.length, 'une ligne de v_arme par arme');
    return lignes.map((a) => ({ id: a.id, moteur: durabiliteDeLArme(a, solidite), vue: vue.get(a.id) }));
  };
  // à l'import (test/aide-base-d-import.mjs) et aujourd'hui (le site de dev modifie librement crans et base) : le moteur et la vue disent la même
  // durabilité, plancher de R51 compris (migration 0099 ; le plancher lui-même s'essaie sous 1 dans test/db-0099-solidite-et-tableau-du-sort.test.mjs)
  for (const [base, quand] of [[baseDImport(), 'import'], [db, 'aujourd’hui']]) {
    for (const d of durabilites(base)) {
      assert.equal(d.vue, d.moteur, `${quand} : ${d.id}`);
      assert.ok(d.vue >= 1, `${quand} : ${d.id}`);
    }
  }
});

// Le prix : la colonne materiau_arme.prix_rf est la lecture de sa cellule prix_brut par arme-champs.mjs#prixEnRf (aucune égalité avec le prix de la
// ressource). Défaut du code hors lot : le service recopie le prix de la ressource (« 1 000 RF / 10 RO ») et le lit par composants-champs.mjs#prixEnRf,
// qui comprend le séparateur de milliers que arme-champs.mjs#prixEnRf ignore.
test('matériaux : bonus, cran de solidité, effet secondaire et prix se refont depuis les cellules ; le prix en RO ignore le RF', () => {
  const lignes = db.prepare('SELECT * FROM materiau_arme ORDER BY ordre').all();
  assert.ok(lignes.length >= 14);
  for (const m of lignes) {
    assert.deepEqual(analyserEffetDeMateriau(m.effet_brut), { bonus_degats: m.bonus_degats, cran_solidite: m.cran_solidite, effet_secondaire: m.effet_secondaire }, m.ressource_id);
    assert.equal(prixEnRf(m.prix_brut), m.prix_rf, m.ressource_id);
    assert.ok(prixEnRo(m.prix_brut) > 0, m.ressource_id);
  }
  assert.equal(prixEnRo('100 RF / 10 RO'), 10);
  assert.equal(prixEnRo('200 RO'), 200);
});

test('prix d’un matériau d’arme : lu comme celui de sa ressource (R62), espace des milliers compris (espace, insécable, fine insécable)', () => {
  for (const espace of [' ', '\u00a0', '\u202f']) {
    const prix = `1${espace}000 RF / 10 RO`;
    assert.equal(prixEnRf(prix), 1000, JSON.stringify(prix));
    assert.equal(prixEnRf(prix), prixEnRfDUneRessource(prix), JSON.stringify(prix));
    assert.equal(prixEnRo(`1${espace}200 RO`), 1200, JSON.stringify(espace));
  }
  // RF et RO en désaccord (un zéro oublié) : null, comme l'importeur ; le RO seul ; le RF seul
  assert.equal(prixEnRf('100 RF / 10 RO'), null);
  assert.equal(prixEnRf('8 000 RF / 80 RO'), 8000);
  assert.equal(prixEnRf('0,5 RO'), 50);
  assert.equal(prixEnRf('250 RF'), 250);
  assert.equal(prixEnRo('250 RF'), null);
});

test('améliorations d’arme : coût (RO, matériaux) et effet (dégâts, crans) se refont ; la ligne TOTAL se refait depuis les niveaux', () => {
  const niveaux = db.prepare("SELECT * FROM amelioration_equipement WHERE cible = 'arme' ORDER BY niveau").all();
  assert.equal(niveaux.length, 10);
  for (const a of niveaux) {
    assert.deepEqual(analyserCoutDAmelioration(a.cout_brut), { cout_ro: a.cout_ro, cout_materiaux: a.cout_materiaux }, a.id);
    assert.deepEqual(analyserEffetDAmelioration(a.effet_brut), { bonus_degats: a.bonus_degats, bonus_cran: a.bonus_cran }, a.id);
  }
  assert.equal(totalDesAmeliorations(niveaux), db.prepare("SELECT total_brut FROM amelioration_total WHERE cible = 'arme'").get().total_brut);
});
