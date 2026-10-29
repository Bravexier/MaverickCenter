// Décision R163 (2026-10-23) : les dons du Flagelleur « Punis-moi ... » et « ... plus fort ! » sur la fiche (lib/fiche-moteur.mjs#resistancesDe).
//   - « Punis-moi ... » : +1 cran à chaque altération de la liste de résistances de la magie innée, « + ça rajoute en plus de ce qui est déjà présent
//     par la magie » (Feu inné : Brûlure, Gel, Pétrifié à +2) ;
//   - « ... plus fort ! » : les crans négatifs des altérations de la liste de faiblesses de la magie innée sont retirés, quelle qu'en soit l'origine
//     (« Retirer les crans négatifs » : +1 et −2 donnent +1), « Pour tous les Flagelleurs » ; une ligne ramenée à 0 disparaît (« Rien, la ligne
//     disparaît ») ; les faiblesses aux magies restent ;
//   - un personnage du Potentiel Illimité choisit pour chacun la magie tirée au D14 par le MJ (« A chaque choix de don, tu choisi la résistance /
//     altération associée », « Les 14 magies ») : personnage_resistance_choix.magie_id, source = le don ; elle tient lieu de magie innée pour le don
//     seulement (le PI n'hérite pas de ses listes : R139, R160).
// Les textes des dons sont épinglés dans leur état d'import (lib/historique-site.mjs, test/resistance-texte.test.mjs) ; ici, les règles de la base.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { ficheVide } from '../src/lib/fiche-format.mjs';
import * as M from '../src/lib/fiche-moteur.mjs';
import { chargerReglesDeFiche } from '../src/lib/fiche-regles.mjs';

const db = ouvrirBase({ sansExemples: false });
const regles = JSON.parse(JSON.stringify(chargerReglesDeFiche(db))); // tel que la page le reçoit
const PUNIS = 'capacites/flagelleur-puni-moi';
const PLUS_FORT = 'capacites/flagelleur-plus-fort';
const PI = 'magies/potentiel-illimite';
const FEU = 'magies/magie-du-feu';
const GLACE = 'magies/magie-de-la-glace';
const VENT = 'magies/magie-du-vent';
const ARCANE = 'magies/magie-de-larcane';
const CORRUPTION = 'magies/magie-de-la-corruption';
const ETAT = (slug) => `guide/liste-des-alterations-d-etat#etat:${slug}`;
const [BRULURE, GEL, PETRIFIE, CONFUSION, SURDITE, SURCHARGE] = ['brulure', 'gel', 'petrifie', 'confusion', 'surdite', 'surcharge-magique'].map(ETAT);
const xpDuNiveau = (n) => regles.niveaux.find((l) => l.niveau === n).xp_min;
const E = (id) => `ressources/accessoires#effet:${id}`;
const porte = (emplacement, effet, autres = {}) => ({ emplacement, accessoire_effet_id: E(effet), valeur: null, maudit: 0, ...autres });

/** Humain central (aucune résistance de race), Flagelleur Masochiste de niveau de classe 10, magie innée `magie`, le don `don` choisi (ou aucun). */
const fiche = (magie, don, surcharge = {}) => ({
  ...ficheVide('Essai'), race_id: 'races/humain', ethnie_id: 'races/humain#ethnie:humain-central', magie_innee_id: magie, xp: xpDuNiveau(5),
  classes: [{ rang: 1, classe_id: 'classes/flagelleur', specialite_id: 'classes/flagelleur#specialite:masochiste' }],
  capacites: don ? [{ capacite_id: don }] : [],
  caracteristiques: regles.caracteristiques.map((k) => ({ caracteristique_id: k.id, base: 3, croix: 0 })),
  ...surcharge,
});
/** Les lignes du tableau des résistances : `type:id` → crans (ou « immunité »), avec le palier. */
const lignes = (f, r = regles) => Object.fromEntries(M.resistancesDe(r, f).paliers.flatMap((p) => p.cibles.map((c) => [`${c.type}:${c.id}`, c.immunite ? 'immunité' : c.crans])));
const cible = (f, id) => M.resistancesDe(regles, f).paliers.flatMap((p) => p.cibles.map((c) => ({ ...c, palier: p.id }))).find((c) => c.id === id) ?? null;
const etat = (id) => `etat:${id}`;
// décision R174 : un personnage du Potentiel Illimité (hors Mode Hyper) a un cran de moins à chacun des trois types physiques (« Surtension corporelle »)
const SURTENSION = { 'physique:estoc': -1, 'physique:taille': -1, 'physique:frappe': -1 };
const magie = (id) => `magie:${id}`;
/** Ce qui change entre deux tableaux : clé → [avant, après] (undefined : pas de ligne). */
const ecarts = (avant, apres) => Object.fromEntries([...new Set([...Object.keys(avant), ...Object.keys(apres)])]
  .filter((k) => avant[k] !== apres[k]).map((k) => [k, [avant[k], apres[k]]]));

test('la base (décision R163) : pour chaque magie, ses altérations sont l’image par etat_magie de ses magies, en résistance comme en vulnérabilité, et aucune altération n’est à la fois l’une et l’autre', () => {
  const etatDe = new Map(db.prepare('SELECT magie_id, etat_id FROM etat_magie').all().map((r) => [r.magie_id, r.etat_id]));
  const listes = db.prepare('SELECT magie_id, sens, cible_type, COALESCE(cible_magie_id, cible_etat_id, cible_physique) AS cible FROM magie_resistance').all();
  const magies = db.prepare("SELECT id FROM magie WHERE id <> 'magies/potentiel-illimite'").all().map((m) => m.id);
  assert.equal(magies.length, 14);
  for (const m of magies) {
    for (const sens of ['resistance', 'vulnerabilite']) {
      const de = (type) => [...new Set(listes.filter((l) => l.magie_id === m && l.sens === sens && l.cible_type === type).map((l) => l.cible))].sort();
      assert.deepEqual(de('etat'), [...new Set(de('magie').map((x) => etatDe.get(x)))].sort(), `${m} : ${sens}`);
    }
    const resistees = new Set(listes.filter((l) => l.magie_id === m && l.sens === 'resistance' && l.cible_type === 'etat').map((l) => l.cible));
    assert.deepEqual(listes.filter((l) => l.magie_id === m && l.sens === 'vulnerabilite' && l.cible_type === 'etat' && resistees.has(l.cible)), [], m);
  }
  // le Potentiel Illimité n'a pas de liste de magies ni d'altérations (décision R139) ; ses seules lignes sont ses trois vulnérabilités physiques
  // (décision R174, cible_type « physique » : estoc, taille, frappe), qu'aucun don du Flagelleur ne lit
  assert.deepEqual(listes.filter((l) => l.magie_id === PI && l.cible_type !== 'physique'), []);
  assert.deepEqual(listes.filter((l) => l.magie_id === PI).map((l) => `${l.sens}:${l.cible_type}`), Array(3).fill('vulnerabilite:physique'));
});

test('décision R163 : les règles des deux dons — ce que leur texte donne, et la magie tirée du Potentiel Illimité parmi les 14 magies (Arcane et Corruption comprises)', () => {
  const dons = regles.classes.find((c) => c.id === 'classes/flagelleur').dons;
  const options = regles.magies.map((m) => m.id).filter((id) => id !== PI);
  assert.equal(options.length, 14);
  assert.ok(options.includes(ARCANE) && options.includes(CORRUPTION));
  const auChoix = { rang: 1, magie: true, options, si_magie_innee: PI, de: 'D14', remplace_magie_innee: true };
  assert.deepEqual(dons.find((d) => d.id === PUNIS).resistances, { effets: [{ type: 'etats_resistes_magie_innee', id: null, crans: 1 }], choix: false, au_choix: [auChoix] });
  assert.deepEqual(dons.find((d) => d.id === PLUS_FORT).resistances, { effets: [{ type: 'faiblesses_etats_magie_innee', id: null, annule: true }], choix: false, au_choix: [auChoix] });
  // « Punition ! » (Sadique) vise la cible : rien
  assert.equal(dons.find((d) => d.id === 'capacites/flagelleur-punition').resistances, undefined);
});

test('décision R163 : Feu inné + « Punis-moi ... » — Brûlure, Gel et Pétrifié à +2 (Grande résistance), Confusion et Surdité à −1, rien de plus sur la magie Feu ; Arcane : Surcharge magique à +2', () => {
  const sans = lignes(fiche(FEU, null));
  const avec = lignes(fiche(FEU, PUNIS));
  assert.deepEqual(ecarts(sans, avec), { [etat(BRULURE)]: [1, 2], [etat(GEL)]: [1, 2], [etat(PETRIFIE)]: [1, 2] }, 's’ajoute aux crans de la magie (R163)');
  assert.deepEqual([avec[etat(CONFUSION)], avec[etat(SURDITE)], avec[magie(FEU)]], [-1, -1, 1]);
  const brulure = cible(fiche(FEU, PUNIS), BRULURE);
  assert.equal(brulure.palier, 'grande_resistance');
  assert.deepEqual(brulure.origines, [{ nom: 'Feu (magie innée)', crans: 1 }, { nom: 'Punis-moi ... (Flagelleur)', crans: 1 }]);
  // hors du Potentiel Illimité : aucun choix
  assert.deepEqual(M.resistancesDe(regles, fiche(FEU, PUNIS)).aChoisir, []);
  assert.deepEqual(M.choixEnAttente(regles, fiche(FEU, PUNIS)).filter((c) => c.nature === 'resistance'), []);
  // l'Arcane (Surcharge magique, commune avec la Corruption)
  assert.deepEqual(ecarts(lignes(fiche(ARCANE, null)), lignes(fiche(ARCANE, PUNIS))), { [etat(SURCHARGE)]: [1, 2] });
});

test('décision R163 : Glace innée + « ... plus fort ! » — Brûlure et Surdité disparaissent, les faiblesses au Feu et au Vent restent ; avec « Résistance Feu et Brûlure », Brûlure à +1 ; l’Arcane : rien ; une immunité reste', () => {
  const sans = lignes(fiche(GLACE, null));
  const avec = lignes(fiche(GLACE, PLUS_FORT));
  assert.deepEqual([sans[etat(BRULURE)], sans[etat(SURDITE)]], [-1, -1]);
  assert.deepEqual(ecarts(sans, avec), { [etat(BRULURE)]: [-1, undefined], [etat(SURDITE)]: [-1, undefined] }, 'une ligne ramenée à 0 disparaît, sans mention');
  assert.deepEqual([avec[magie(FEU)], avec[magie(VENT)]], [-1, -1], 'les faiblesses aux magies restent');
  // un accessoire « Résistance Feu et Brûlure » : +1 et −1 donnent +1 (les crans positifs restent)
  const accessoire = { accessoires: [porte('bague-1', 'defense:5')] };
  assert.deepEqual([lignes(fiche(GLACE, null, accessoire))[etat(BRULURE)], lignes(fiche(GLACE, PLUS_FORT, accessoire))[etat(BRULURE)]], [undefined, 1]);
  const brulure = cible(fiche(GLACE, PLUS_FORT, accessoire), BRULURE);
  assert.equal(brulure.palier, 'resistance');
  assert.deepEqual(brulure.origines, [{ nom: 'Glace (magie innée)', crans: -1 }, { nom: 'Accessoire : Bague 1 (accessoire)', crans: 1 }, { nom: '... plus fort ! (Flagelleur)', crans: 1 }],
    'l’infobulle garde l’origine annulée, et le don rend ce qu’il retire');
  // l'Arcane n'a aucune faiblesse : rien ne change
  assert.deepEqual(ecarts(lignes(fiche(ARCANE, null)), lignes(fiche(ARCANE, PLUS_FORT))), {});
  // une immunité écrite (un don de race d'essai) reste une immunité
  const immunise = { ...regles, races: regles.races.map((r) => (r.id !== 'races/humain' ? r : { ...r, dons: [...r.dons, { id: 'essai', forme: 'unique', nom: 'Essai', texte: '', resistances: { effets: [{ type: 'etat', id: BRULURE, immunite: true }], choix: false } }] })) };
  assert.equal(lignes(fiche(GLACE, PLUS_FORT), immunise)[etat(BRULURE)], 'immunité');
});

test('décision R163 : en Symbiose, la magie innée désactivée (R111), les deux dons s’appliquent encore', () => {
  const symbiose = (innee, acquise, don) => fiche(innee, don, { magie_acquise_id: acquise, posture_id: 'guide/postures#posture:symbiose', symbiose_magie_id: acquise });
  assert.equal(M.resistancesDe(regles, symbiose(FEU, VENT, PUNIS)).desactivee?.id, FEU);
  assert.deepEqual(ecarts(lignes(symbiose(FEU, VENT, null)), lignes(symbiose(FEU, VENT, PUNIS))),
    { [etat(BRULURE)]: [1, 2], [etat(GEL)]: [1, 2], [etat(PETRIFIE)]: [-1, undefined] }, 'les altérations de la liste du Feu, désactivé (le Vent est faible au Pétrifié)');
  // la Glace désactivée, le Feu acquis : sa faiblesse à la Surdité est retirée (une faiblesse de la liste de la Glace), pas celle à la Confusion
  assert.equal(M.resistancesDe(regles, symbiose(GLACE, FEU, PLUS_FORT)).desactivee?.id, GLACE);
  assert.deepEqual(ecarts(lignes(symbiose(GLACE, FEU, null)), lignes(symbiose(GLACE, FEU, PLUS_FORT))), { [etat(SURDITE)]: [-1, undefined] });
});

test('décision R163 : Potentiel Illimité + « Punis-moi ... » — la magie tirée au D14 par le MJ, un choix du tiroir parmi les 14 magies, qui tient lieu de magie innée pour ce don seulement', () => {
  const options = regles.magies.map((m) => m.id).filter((id) => id !== PI);
  const f = fiche(PI, PUNIS);
  const r = M.resistancesDe(regles, f);
  assert.deepEqual(r.aChoisir, [{
    source: PUNIS, rang: 1, nom: 'Punis-moi ... (Flagelleur)', crans: null, options, magie: true, alteration: false, remplaceMagieInnee: true, de: 'D14', choisi: null, fait: false,
  }]);
  assert.equal(r.aChoisir[0].options.length, 14);
  assert.deepEqual(r.auChoix, []);
  assert.deepEqual(lignes(f), lignes(fiche(PI, null)), 'rien tant que la magie n’est pas tirée');
  assert.deepEqual(M.choixEnAttente(regles, f).filter((c) => c.nature === 'resistance'), [{
    nature: 'resistance', cle: M.cleDeChoix.resistance(PUNIS, 1), libelle: 'Punis-moi ... (Flagelleur) : magie tirée au D14 par le MJ (tient lieu de magie innée pour ce don)',
  }]);
  // le Feu tiré : +1 à Brûlure, Gel et Pétrifié ; ni la magie Feu ni ses faiblesses (le PI n'hérite pas de ses listes, R139, R160)
  const g = { ...f, ...M.resistanceApresChoix(f, PUNIS, 1, FEU, true) };
  assert.deepEqual(g.resistance_choix, [{ source: PUNIS, rang: 1, magie_id: FEU }]);
  assert.deepEqual(ecarts(lignes(fiche(PI, null)), lignes(g)), { [etat(BRULURE)]: [undefined, 1], [etat(GEL)]: [undefined, 1], [etat(PETRIFIE)]: [undefined, 1] });
  assert.deepEqual(M.resistanceChoixValables(regles, g), [{ source: PUNIS, rang: 1, magie_id: FEU }]);
  assert.deepEqual(M.choixEnAttente(regles, g).filter((c) => c.nature === 'resistance'), []);
  // l'Arcane et la Corruption se tirent aussi (Surcharge magique) ; le PI lui-même n'est pas une option
  assert.deepEqual(lignes({ ...f, ...M.resistanceApresChoix(f, PUNIS, 1, CORRUPTION, true) }), { [etat(SURCHARGE)]: 1, ...SURTENSION });
  assert.deepEqual(M.resistanceChoixValables(regles, { ...f, resistance_choix: [{ source: PUNIS, rang: 1, magie_id: PI }] }), []);
  // la magie innée passe du PI au Feu : le choix part, le don compte la liste du Feu
  const feu = { ...g, magie_innee_id: FEU };
  assert.deepEqual(M.resistanceChoixValables(regles, feu), []);
  assert.deepEqual(M.resistancesDe(regles, feu).aChoisir, []);
  assert.deepEqual(lignes(feu), lignes(fiche(FEU, PUNIS)));
  // le don quitté (« ... plus fort ! » à sa place) : son choix part, l'autre don a le sien
  const autre = { ...g, capacites: [{ capacite_id: PLUS_FORT }] };
  assert.deepEqual(M.resistanceChoixValables(regles, autre), []);
  assert.deepEqual(M.resistancesDe(regles, autre).aChoisir.map((c) => [c.source, c.fait]), [[PLUS_FORT, false]]);
});

test('décision R163 : Potentiel Illimité + « ... plus fort ! » — la Glace tirée, un accessoire maudit « Résistance Feu et Brûlure » : la Brûlure retirée, la faiblesse au Feu reste', () => {
  const maudit = { accessoires: [porte('bague-1', 'defense:5', { maudit: 1 })] };
  const f = fiche(PI, PLUS_FORT, maudit);
  assert.deepEqual(lignes(f), { [magie(FEU)]: -1, [etat(BRULURE)]: -1, ...SURTENSION }, 'sans magie tirée, rien n’est annulé');
  const g = { ...f, ...M.resistanceApresChoix(f, PLUS_FORT, 1, GLACE, true) };
  assert.deepEqual(lignes(g), { [magie(FEU)]: -1, ...SURTENSION }, 'les faiblesses physiques ne sont pas des altérations : « ... plus fort ! » ne les retire pas');
  assert.deepEqual(M.resistanceChoixValables(regles, g), [{ source: PLUS_FORT, rang: 1, magie_id: GLACE }]);
  // le Feu tiré (ses faiblesses : Confusion, Surdité) : la Brûlure maudite reste
  assert.deepEqual(lignes({ ...f, ...M.resistanceApresChoix(f, PLUS_FORT, 1, FEU, true) }), { [magie(FEU)]: -1, [etat(BRULURE)]: -1, ...SURTENSION });
});

test('la page (src/scripts/fiche.mjs, lue comme un texte) : la magie tirée sous le tableau des résistances et dans le tiroir, l’aide de « ... plus fort ! » sous le don (décision R163)', () => {
  const script = readFileSync(new URL('../src/scripts/fiche.mjs', import.meta.url), 'utf8');
  const resistances = script.slice(script.indexOf('function construireResistances()'), script.indexOf('// ------------------------------------------------------------------ classes'));
  assert.match(resistances, /const quoi = c\.remplaceMagieInnee \? magieTireeParLeMj\(c\)/);
  assert.match(script, /AIDE_ANNULE_LES_FAIBLESSES = 'La fiche retire les faiblesses qu’elle connaît ; le MJ annule aussi en jeu celles qu’elle ne connaît pas \(sorts ennemis, météo, armure, états en jeu\)\.'/);
  assert.match(script, /const aideDuDon = \(d\) => \(\(d\.resistances\?\.effets \?\? \[\]\)\.some\(\(e\) => e\.annule\) \? AIDE_ANNULE_LES_FAIBLESSES : null\);/);
  assert.match(script, /texte: d\.effet, aide: aideDuDon\(d\) \}/);
});
