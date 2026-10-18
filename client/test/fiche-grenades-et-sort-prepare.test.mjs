// Les sorts grenades (décision R114) et le sort préparé (décision R115) sur la fiche de personnage. R114 : « Pardon ?!? » du Grenadier (« Les bombes et
// les sorts "grenades" font +11 dégâts ») vise les sorts étiquetés « Sort grenade » (sort_mot_cle, migration 0067), jamais un sort par son nom, et les
// armes de la famille BOMBES. R115 : « Préparation » (Mage Rouge) et « Chargement » (Mage Vert) font choisir un sort préparé, d'attaque, de NPM 1 ou 2 ;
// il se calcule à la posture du moment de sa préparation ; « Charge lente… » lui ajoute +5, « … ou rapide » +5 aux autres sorts offensifs. Les lecteurs
// de textes (lib/sort-bonus-texte.mjs) sont rejoués sur toute la base.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { ficheVide } from '../src/lib/fiche-format.mjs';
import * as M from '../src/lib/fiche-moteur.mjs';
import { chargerReglesDeFiche } from '../src/lib/fiche-regles.mjs';
import { MOTS_CLES_PROTEGES } from '../src/lib/mots-cles.mjs';
import { bonusDeSortsEcrits, ETIQUETTES_DES_SORTS, preparationEcrite } from '../src/lib/sort-bonus-texte.mjs';
import { valeurAuNm } from '../src/lib/sort-maitrise.mjs';

const db = ouvrirBase({ sansExemples: false });
const regles = JSON.parse(JSON.stringify(chargerReglesDeFiche(db))); // tel que la page le reçoit
const lignes = (sql, ...p) => db.prepare(sql).all(...p).map((l) => ({ ...l }));
const xpDuNiveau = (n) => regles.niveaux.find((l) => l.niveau === n).xp_min;
const POSTURE = (slug) => `guide/postures#posture:${slug}`;
const auNm = (s, nm = 0) => Object.fromEntries(['cout', 'portee', 'dsb', 'effets'].map((c) => [c, valeurAuNm(s[c], s.bonus ?? [], c, nm) ?? '']));
const sortDe = (id) => {
  const s = regles.sorts.find((x) => x.id === id);
  assert.ok(s, id);
  return s;
};
const don = (classe, id) => regles.classes.find((c) => c.id === classe).dons.find((d) => d.id === id);
const BOULE_DE_FEU = 'magies/magie-du-feu#sort:boule-de-feu';
const GRENADE_INCENDIAIRE = 'magies/magie-du-feu#sort:grenade-incendiaire';
const PARDON = { nom: 'Pardon ?!? (Grenadier)', valeur: 11 };

// ------------------------------------------------------------------ R114 : les sorts grenades

test('R114 : « Sort grenade » étiquette les 14 sorts « Grenade… » (sort_mot_cle), emportés dans regles.json ; le mot-clé est protégé ; aucun autre sort n’a d’étiquette', () => {
  const etiquetes = lignes("SELECT sort_id FROM sort_mot_cle WHERE mot_cle_id = 'sort-grenade' ORDER BY sort_id").map((l) => l.sort_id);
  assert.equal(etiquetes.length, 14);
  assert.equal(new Set(etiquetes.map((id) => sortDe(id).magie_id)).size, 14, 'un dans chaque magie');
  assert.ok(etiquetes.every((id) => /^Grenade /i.test(sortDe(id).nom)), 'les sorts « Grenade… » de la décision');
  assert.deepEqual(regles.sorts.filter((s) => s.mots_cles).map((s) => s.id).sort(), etiquetes);
  for (const id of etiquetes) assert.deepEqual(sortDe(id).mots_cles, ['sort-grenade'], id);
  // l'id lu par la fiche (lib/sort-bonus-texte.mjs) est celui d'un mot-clé protégé de la base (lib/mots-cles.mjs, qui ne l'importe pas)
  for (const [id] of ETIQUETTES_DES_SORTS) {
    assert.ok(MOTS_CLES_PROTEGES.has(id), `${id} : protégé`);
    assert.deepEqual(lignes('SELECT id, libelle, libelle_cle FROM mot_cle WHERE id = ?', id), [{ id, libelle: 'Sort grenade', libelle_cle: id }]);
  }
});

test('R114 : « Pardon ?!? » se lit sur les sorts étiquetés (plus « selon la situation ») et sur la famille BOMBES ; aucun autre texte de la base ne nomme les sorts grenades', () => {
  const pardon = don('classes/grenadier', 'capacites/grenadier-pardon');
  assert.equal(pardon.effet, 'Les bombes et les sorts "grenades" font +11 dégâts.');
  assert.deepEqual([pardon.niveau, pardon.nature, pardon.type], [20, 'classe', 'passif']);
  assert.deepEqual(pardon.sorts, [{ cible: 'degats', valeur: 11, vises: { mots_cles: ['sort-grenade'] } }]);
  assert.deepEqual(pardon.degats, { valeur: 11, portee: { familles: ['bombes'] } });
  // la famille des bombes : celle de la base, sous ce nom
  assert.deepEqual(lignes("SELECT id, nom FROM arme_famille WHERE id = 'bombes'"), [{ id: 'bombes', nom: 'BOMBES' }]);
  const textes = [...lignes('SELECT id, effet AS texte FROM capacite WHERE effet IS NOT NULL'), ...lignes('SELECT id, texte FROM race_don')];
  const nomment = textes.filter((t) => bonusDeSortsEcrits(t.texte).some((b) => b.vises.mots_cles)).map((t) => t.id);
  assert.deepEqual(nomment, ['capacites/grenadier-pardon']);
  assert.deepEqual(bonusDeSortsEcrits('Les sorts « grenades » font +3 dégâts.'), [{ cible: 'degats', valeur: 3, vises: { mots_cles: ['sort-grenade'] } }]);
});

test('R114 : le Grenadier de niveau de classe 20 ajoute +11 aux dégâts des sorts étiquetés et des bombes ; jamais par le nom du sort ; rien avant', () => {
  // mono-classe : deux niveaux de classe par niveau global (décision R2) ; « Pardon ?!? » au niveau de classe 20, le niveau global 10
  const grenadier = (niveau) => ({
    ...ficheVide('Boum'), race_id: 'races/humain', magie_innee_id: 'magies/magie-du-feu', xp: xpDuNiveau(niveau),
    classes: [{ rang: 1, classe_id: 'classes/grenadier', specialite_id: null }],
    armes: [
      { rang: 1, arme_id: 'ressources/armes#arme:bombes:bombe-frappante', materiau_id: regles.materiau_arme_defaut },
      { rang: 2, arme_id: 'ressources/armes#arme:epees:epee-longue', materiau_id: regles.materiau_arme_defaut },
    ],
  });
  const f = grenadier(10);
  const grenade = sortDe(GRENADE_INCENDIAIRE);
  assert.equal(grenade.dsb, '8d6 + 35 dégâts');
  const m = M.sortDuMoment(regles, f, grenade, auNm(grenade));
  assert.equal(m.dsb.texte, '8d6 + 46 dégâts');
  assert.ok(m.dsb.detail.some((x) => x.nom === PARDON.nom && x.valeur === 11));
  assert.deepEqual(m.nonComptes, [], 'plus « selon la situation »');
  // un sort d'attaque sans l'étiquette : rien, ni compté ni dit
  const boule = sortDe(BOULE_DE_FEU);
  const b = M.sortDuMoment(regles, f, boule, auNm(boule));
  assert.ok(!b.dsb.detail.some((x) => x.nom === PARDON.nom) && !b.nonComptes.some((x) => x.nom === PARDON.nom));
  // l'étiquette fait le sort grenade, pas le nom : sans elle, une grenade n'a rien ; avec elle, un autre sort a les +11
  assert.ok(!M.sortDuMoment(regles, f, { ...grenade, mots_cles: undefined }, auNm(grenade)).dsb.detail.some((x) => x.nom === PARDON.nom));
  assert.ok(M.sortDuMoment(regles, f, { ...boule, mots_cles: ['sort-grenade'] }, auNm(boule)).dsb.detail.some((x) => x.nom === PARDON.nom));
  // les bombes (famille BOMBES) : +11 ; une épée : rien
  assert.ok(M.degatsDArme(regles, f, 1).bonus.some((x) => x.nom === PARDON.nom && x.valeur === 11));
  assert.ok(!M.degatsDArme(regles, f, 2).bonus.some((x) => x.nom === PARDON.nom));
  // niveau global 9 (niveau de classe 18) : le don n'est pas débloqué
  const avant = grenadier(9);
  assert.ok(!M.sortDuMoment(regles, avant, grenade, auNm(grenade)).dsb.detail.some((x) => x.nom === PARDON.nom));
  assert.ok(!M.degatsDArme(regles, avant, 1).bonus.some((x) => x.nom === PARDON.nom));
});

// ------------------------------------------------------------------ R115 : le sort préparé

test('R115 : seuls « Préparation » (Mage Rouge) et « Chargement » (Mage Vert) permettent de préparer un sort — un sort d’attaque de NPM 1 ou 2 (lus sur toute la base)', () => {
  const lus = lignes('SELECT id, effet FROM capacite WHERE effet IS NOT NULL').map((d) => [d.id, preparationEcrite(d.effet)]).filter(([, p]) => p);
  assert.deepEqual(lus, [
    ['capacites/mage-rouge-preparation', { types: ['attaque'], niveaux: [1, 2] }],
    ['capacites/mage-vert-chargement', { types: ['attaque'], niveaux: [1, 2] }],
  ]);
  assert.equal(don('classes/mage-rouge', 'capacites/mage-rouge-preparation').effet,
    'Permet de charger un sort d\'attaque lvl1 ou lvl2 le premier tour et de l\'utiliser en même temps que l\'attaque de contact le tour suivant.');
  assert.equal(don('classes/mage-vert', 'capacites/mage-vert-chargement').effet,
    'Permet d\'influer un sort d\'attaque lvl1 ou 2 dans la main et de l\'utiliser en même temps que l\'attaque de distance le tour suivant.');
  for (const [classe, id] of [['classes/mage-rouge', 'capacites/mage-rouge-preparation'], ['classes/mage-vert', 'capacites/mage-vert-chargement']]) {
    assert.deepEqual([don(classe, id).niveau, don(classe, id).nature, don(classe, id).preparation], [1, 'classe', { types: ['attaque'], niveaux: [1, 2] }], id);
  }
  assert.equal(regles.classes.flatMap((c) => c.dons).filter((d) => d.preparation).length, 2);
  // « Instant sort » change la préparation, le Maclier influe un sort dans le bouclier : ni l'un ni l'autre ne permet de préparer (R115)
  assert.equal(preparationEcrite(don('classes/mage-rouge', 'capacites/mage-rouge-instant-sort').effet), null);
  assert.equal(preparationEcrite('Permet d\'influer un sort offensif de niveau 3 maximum. Va de pair avec « Contre magique »'), null);
});

/**
 * Un Mage Rouge (spécialité Rubis) mono-classe de niveau global `niveau` (niveau de classe 2 × `niveau`, décision R2), magie du Feu, avec les sorts
 * `sorts` (ids) ; `x` complète la fiche.
 */
function mage(niveau, sorts, x = {}) {
  return {
    ...ficheVide('Ignis'), race_id: 'races/humain', magie_innee_id: 'magies/magie-du-feu', xp: xpDuNiveau(niveau),
    classes: [{ rang: 1, classe_id: 'classes/mage-rouge', specialite_id: 'classes/mage-rouge#specialite:mage-rubis' }],
    sorts: sorts.map((sort_id, i) => ({ sort_id, rang: i + 1, niveau_maitrise: 0, nm_livre: 0 })),
    ...x,
  };
}

/** Des sorts du Feu : d'attaque NPM 1, NPM 2 et NPM 3, et un sort de NPM 1 qui n'est pas d'attaque. */
const feu = regles.sorts.filter((s) => s.magie_id === 'magies/magie-du-feu');
const ATTAQUE_1 = BOULE_DE_FEU;
const ATTAQUE_2 = feu.find((s) => s.niveau === 2 && s.types.includes('attaque') && M.lireDegatsDeSort(auNm(s).dsb)?.nature === 'degats').id;
const ATTAQUE_3 = feu.find((s) => s.niveau === 3 && s.types.includes('attaque')).id;
const AUTRE_1 = feu.find((s) => s.niveau === 1 && !s.types.includes('attaque')).id;

test('R115 : le don débloqué propose les sorts de la fiche qu’il autorise ; préparer enregistre la posture cochée, efface le jet ; le jet se borne au D100 ; « Lâcher le sort » remet tout à zéro', () => {
  assert.equal(M.donDePreparation(regles, { ...mage(10, []), classes: [{ rang: 1, classe_id: 'classes/guerrier', specialite_id: null }] }), null);
  const f = mage(10, [ATTAQUE_1, ATTAQUE_2, ATTAQUE_3, AUTRE_1], { posture_id: POSTURE('offensif') });
  const d = M.donDePreparation(regles, f);
  assert.deepEqual([d.dons.map((x) => x.don.id), d.types, d.niveaux], [['capacites/mage-rouge-preparation'], ['attaque'], [1, 2]]);
  assert.deepEqual(M.sortsAPreparer(regles, f).map((x) => [x.index, x.sort.id]), [[0, ATTAQUE_1], [1, ATTAQUE_2]]);
  assert.equal(M.sortPrepare(regles, f), null, 'rien de préparé');
  // préparer : la posture du moment est enregistrée, un seul sort marqué
  let sorts = M.sortsApresPreparation(regles, f, ATTAQUE_2);
  assert.deepEqual(sorts.map((s) => [s.sort_id, s.prepare, s.prepare_jet, s.prepare_posture_id]), [
    [ATTAQUE_1, 0, null, null], [ATTAQUE_2, 1, null, POSTURE('offensif')], [ATTAQUE_3, 0, null, null], [AUTRE_1, 0, null, null],
  ]);
  // le jet de magie : un D100 (regles.sort_prepare, la décision), borné ; vide, effacé
  assert.deepEqual([regles.sort_prepare, M.jetDuSortPrepare(regles)], [{ jet_min: 1, jet_max: 100 }, { min: 1, max: 100 }]);
  for (const [saisie, jet] of [['57', 57], ['0', 1], ['140', 100], ['', null], ['abc', null]]) {
    assert.equal(M.sortsApresLeJet(regles, { ...f, sorts }, saisie)[1].prepare_jet, jet, saisie);
  }
  sorts = M.sortsApresLeJet(regles, { ...f, sorts }, '57');
  // un autre sort préparé à une autre posture : le jet repart à zéro, l'ancien n'est plus préparé
  const g = { ...f, sorts, posture_id: null };
  assert.deepEqual(M.sortPrepare(regles, g) && [M.sortPrepare(regles, g).sort.id, M.sortPrepare(regles, g).jet, M.sortPrepare(regles, g).posture.id], [ATTAQUE_2, 57, POSTURE('offensif')]);
  const h = { ...g, sorts: M.sortsApresPreparation(regles, g, ATTAQUE_1) };
  assert.deepEqual([M.sortPrepare(regles, h).sort.id, M.sortPrepare(regles, h).jet, M.sortPrepare(regles, h).posture], [ATTAQUE_1, null, null]);
  assert.deepEqual(h.sorts.map((s) => s.prepare), [1, 0, 0, 0]);
  // « Lâcher le sort »
  assert.deepEqual(M.sortsApresPreparation(regles, h, null).map((s) => [s.prepare, s.prepare_jet, s.prepare_posture_id]), Array(4).fill([0, null, null]));
  // à l'enregistrement : la préparation que le don ne permet plus part (un sort de NPM 3, une fiche sans le don)
  const npm3 = { ...f, sorts: f.sorts.map((s) => (s.sort_id === ATTAQUE_3 ? { ...s, prepare: 1, prepare_jet: 12, prepare_posture_id: POSTURE('focus') } : s)) };
  assert.equal(M.sortPrepare(regles, npm3), null);
  assert.ok(M.sortsAEnregistrer(regles, npm3).every((s) => s.prepare === 0 && s.prepare_jet === null && s.prepare_posture_id === null));
  const guerrier = { ...g, classes: [{ rang: 1, classe_id: 'classes/guerrier', specialite_id: null }] };
  assert.ok(M.sortsAEnregistrer(regles, guerrier).every((s) => s.prepare === 0));
  assert.deepEqual(M.sortsAEnregistrer(regles, g).map((s) => [s.rang, s.prepare, s.prepare_jet, s.prepare_posture_id]),
    [[1, 0, null, null], [2, 1, 57, POSTURE('offensif')], [3, 0, null, null], [4, 0, null, null]]);
  // le Mage Vert (« Chargement ») aussi
  assert.ok(M.donDePreparation(regles, { ...f, classes: [{ rang: 1, classe_id: 'classes/mage-vert', specialite_id: null }] }));
});

test('R115 : le sort préparé se calcule à la posture du moment de sa préparation — préparé en Offensif, ses dégâts maximum même en Défensif ; les autres à la posture cochée', () => {
  const offensif = mage(3, [ATTAQUE_1, ATTAQUE_2], { posture_id: POSTURE('offensif') });
  const prepare = { ...offensif, sorts: M.sortsApresPreparation(regles, offensif, ATTAQUE_1), posture_id: POSTURE('defensif') };
  const boule = sortDe(ATTAQUE_1);
  const autre = sortDe(ATTAQUE_2);
  const contexte = M.contexteDesSorts(regles, prepare);
  assert.deepEqual([contexte.prepare.sort_id, contexte.prepare.posture.posture.id], [ATTAQUE_1, POSTURE('offensif')]);
  const p = M.sortDuMoment(regles, prepare, boule, auNm(boule), contexte);
  const v = M.lireDegatsDeSort(auNm(boule).dsb);
  assert.deepEqual([p.prepare, p.posture.id, p.dsb.diviseur], [true, POSTURE('offensif'), 1]);
  assert.equal(p.dsb.texte, M.ecrireDegatsDeSort({ ...v, nombre: 0, fixe: v.fixe + v.nombre * v.faces }), 'dégâts maximum, pas ÷ 2');
  const q = M.sortDuMoment(regles, prepare, autre, auNm(autre), contexte);
  assert.deepEqual([q.prepare, q.posture.id, q.dsb.diviseur, q.dsb.texte], [false, POSTURE('defensif'), 2, auNm(autre).dsb], 'à la posture cochée : ÷ 2, pas maximum');
  // préparé sans posture : sans posture, même si l'Offensif est coché ensuite
  const sansPosture = mage(3, [ATTAQUE_1], { posture_id: null });
  const ensuite = { ...sansPosture, sorts: M.sortsApresPreparation(regles, sansPosture, ATTAQUE_1), posture_id: POSTURE('offensif') };
  const s = M.sortDuMoment(regles, ensuite, boule, auNm(boule));
  assert.deepEqual([s.prepare, s.posture, s.dsb.texte], [true, null, auNm(boule).dsb]);
  // sans le don, la marque ne compte pas : le sort suit la posture cochée
  const sansDon = { ...prepare, classes: [{ rang: 1, classe_id: 'classes/guerrier', specialite_id: null }] };
  const t = M.sortDuMoment(regles, sansDon, boule, auNm(boule));
  assert.deepEqual([t.prepare, t.posture.id, t.dsb.diviseur], [false, POSTURE('defensif'), 2]);
});

test('R115 : « Charge lente… » (+5 au sort préparé offensif) et « … ou rapide » (+5 aux sorts offensifs non préparés), Mage Rouge Rubis niveau 10 ; plus « selon la situation »', () => {
  const lente = don('classes/mage-rouge', 'capacites/mage-rouge-charge-lente');
  const rapide = don('classes/mage-rouge', 'capacites/mage-rouge-ou-rapide');
  assert.deepEqual([lente.nom, lente.effet, lente.niveau, lente.specialite_id], ['Charge lente…', 'Les sorts offensifs préparés infligent +5 dégâts.', 10, 'classes/mage-rouge#specialite:mage-rubis']);
  assert.deepEqual([rapide.nom, rapide.effet, rapide.niveau, rapide.specialite_id], ['… ou rapide', 'Les sorts offensifs non préparés infligent +5 dégâts.', 10, 'classes/mage-rouge#specialite:mage-rubis']);
  assert.deepEqual(lente.sorts, [{ cible: 'degats', valeur: 5, vises: { attaque: true, prepare: true } }]);
  assert.deepEqual(rapide.sorts, [{ cible: 'degats', valeur: 5, vises: { attaque: true, prepare: false } }]);
  // aucun autre texte de la base ne vise le sort préparé ou les autres
  const textes = [...lignes('SELECT id, effet AS texte FROM capacite WHERE effet IS NOT NULL'), ...lignes('SELECT id, texte FROM race_don')];
  assert.deepEqual(textes.filter((t) => bonusDeSortsEcrits(t.texte).some((b) => 'prepare' in b.vises)).map((t) => t.id), ['capacites/mage-rouge-charge-lente', 'capacites/mage-rouge-ou-rapide']);
  // « Soralonge » (Mage Vert : « Augmente la portée des sorts d'attaque chargés de +2 ») reste selon la situation : la décision ne le nomme pas
  assert.deepEqual(don('classes/mage-vert', 'capacites/mage-vert-soralonge').sorts, [{ cible: 'portee', valeur: 2, vises: { attaque: true }, raison: 'situation' }]);

  const nomDe = (d) => `${d.nom} (Mage Rouge)`;
  const avecDon = (d) => {
    const f = mage(10, [ATTAQUE_1, ATTAQUE_2, AUTRE_1], { capacites: [{ capacite_id: d.id }] });
    return { ...f, sorts: M.sortsApresPreparation(regles, f, ATTAQUE_1) };
  };
  // ce que le don choisi (« Charge lente… » ou « … ou rapide ») ajoute aux dégâts du sort `id`, et ce qui n'est pas compté
  const bonus = (f, id) => {
    const s = sortDe(id);
    const m = M.sortDuMoment(regles, f, s, auNm(s));
    const choisi = f.capacites[0].capacite_id === lente.id ? lente : rapide;
    return { compte: m.dsb.detail.filter((x) => x.nom === nomDe(choisi)).map((x) => x.valeur), nonComptes: m.nonComptes };
  };
  const fl = avecDon(lente);
  assert.deepEqual(bonus(fl, ATTAQUE_1), { compte: [5], nonComptes: [] }, 'Charge lente : le sort préparé');
  assert.deepEqual(bonus(fl, ATTAQUE_2).compte, [], 'Charge lente : pas un sort non préparé');
  const fr = avecDon(rapide);
  assert.deepEqual(bonus(fr, ATTAQUE_1).compte, [], '… ou rapide : pas le sort préparé');
  assert.deepEqual(bonus(fr, ATTAQUE_2), { compte: [5], nonComptes: [] }, '… ou rapide : un sort offensif non préparé');
  assert.deepEqual(bonus(fr, AUTRE_1).compte, [], '… ou rapide : pas un sort qui n’est pas offensif');
  // sans sort préparé, « … ou rapide » vaut pour tous les sorts offensifs, « Charge lente… » pour aucun
  const lache = (f) => ({ ...f, sorts: M.sortsApresPreparation(regles, f, null) });
  assert.deepEqual([bonus(lache(fr), ATTAQUE_1).compte, bonus(lache(fl), ATTAQUE_1).compte], [[5], []]);
  // avant le niveau de classe 10 (niveau global 4 : niveau de classe 8), le don n'est pas débloqué
  assert.deepEqual(bonus({ ...fl, xp: xpDuNiveau(4) }, ATTAQUE_1).compte, []);
});
