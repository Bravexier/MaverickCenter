// Les sorts grenades (décision R114) et le sort préparé (décision R115) sur la fiche de personnage. R114 : « Pardon ?!? » du Grenadier (« Les bombes et
// les sorts "grenades" font +11 dégâts ») vise les sorts étiquetés « Sort grenade » (sort_mot_cle, migration 0067), jamais un sort par son nom, et les
// armes de la famille BOMBES. R115 : « Préparation » (Mage Rouge) et « Chargement » (Mage Vert) font choisir un sort préparé, d'attaque, de NPM 1 ou 2 ;
// il se calcule à la posture du moment de sa préparation ; « Charge lente… » lui ajoute +5, « … ou rapide » +5 aux autres sorts offensifs (« offensif » :
// d'attaque, R132). Décisions du 2026-10-22 : « Soralongé » (Mage Vert) donne +2 de portée au sort préparé (R133) ; « À l'aise », dans sa nouvelle
// version (migration 0071), +1 NM au sort préparé, au plus 3 (R134) ; en Symbiose d'une autre magie, le sort préparé est perdu (R135) ; un seul sort
// préparé, pour tout type d'attaque (R136). Les lecteurs de textes (lib/sort-bonus-texte.mjs) sont rejoués sur toute la base.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { ficheVide } from '../src/lib/fiche-format.mjs';
import * as M from '../src/lib/fiche-moteur.mjs';
import { chargerReglesDeFiche } from '../src/lib/fiche-regles.mjs';
import { historiqueSite } from '../src/lib/historique-site.mjs';
import { corpsDeDon, resumeDeDon } from '../src/lib/corps-classes.mjs';
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
  // « Instant Sort » change la préparation, le Maclier influe un sort dans le bouclier : ni l'un ni l'autre ne permet de préparer (R115)
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

test('R135 : en Symbiose d’une autre magie que la sienne, le sort préparé est perdu — la préparation est lâchée et ne revient pas ; la liste ne propose que les sorts de la magie de la Symbiose', () => {
  const GLACE = 'magies/magie-de-la-glace';
  const glace = regles.sorts.find((s) => s.magie_id === GLACE && s.niveau === 1 && s.types.includes('attaque')).id;
  const neutre = mage(3, [ATTAQUE_1, glace], { magie_acquise_id: GLACE, posture_id: POSTURE('neutre') });
  // préparée en Neutre : la Boule de feu (Feu)
  const prepare = { ...neutre, sorts: M.sortsApresLeJet(regles, { ...neutre, sorts: M.sortsApresPreparation(regles, neutre, ATTAQUE_1) }, '61') };
  assert.equal(M.sortPrepare(regles, prepare).sort.id, ATTAQUE_1);
  assert.equal(M.sortsApresLaSymbiose(regles, prepare), prepare.sorts, 'hors de la Symbiose : rien ne change (le même tableau)');
  // la Symbiose du Feu, sa magie : gardé, calculé à la posture de sa préparation
  const enFeu = { ...prepare, posture_id: POSTURE('symbiose'), symbiose_magie_id: 'magies/magie-du-feu' };
  assert.equal(M.sortsApresLaSymbiose(regles, enFeu), enFeu.sorts);
  assert.deepEqual([M.sortPrepare(regles, enFeu).sort.id, M.sortPrepare(regles, enFeu).jet, M.sortPrepare(regles, enFeu).posture.id], [ATTAQUE_1, 61, POSTURE('neutre')]);
  // la magie de la Symbiose encore à choisir (deux magies) : rien n'est perdu tant qu'elle ne l'est pas
  const aChoisir = { ...prepare, posture_id: POSTURE('symbiose'), symbiose_magie_id: null };
  assert.equal(M.postureDuMoment(regles, aChoisir).symbiose.aChoisir, true);
  assert.equal(M.sortsApresLaSymbiose(regles, aChoisir), aChoisir.sorts);
  // la Symbiose de la Glace : « Si le sort préparé est d'une magie différente de la posture symbiose, il est perdu »
  const enGlace = { ...prepare, posture_id: POSTURE('symbiose'), symbiose_magie_id: GLACE };
  assert.equal(M.postureDuMoment(regles, enGlace).symbiose.inactive.id, 'magies/magie-du-feu');
  assert.equal(M.sortPrepare(regles, enGlace), null, 'plus compté');
  assert.equal(M.contexteDesSorts(regles, enGlace).prepare, null);
  const boule = sortDe(ATTAQUE_1);
  assert.deepEqual([M.sortDuMoment(regles, enGlace, boule, auNm(boule)).prepare, M.sortDuMoment(regles, enGlace, boule, auNm(boule)).inactif], [false, 'Feu']);
  const perdu = M.sortsApresLaSymbiose(regles, enGlace);
  assert.deepEqual(perdu.map((x) => [x.sort_id, x.prepare, x.prepare_jet, x.prepare_posture_id]), [[ATTAQUE_1, 0, null, null], [glace, 0, null, null]], 'lâché');
  assert.ok(M.sortsAEnregistrer(regles, enGlace).every((x) => x.prepare === 0), 'il part à l’enregistrement');
  // de retour en Neutre, il ne revient pas
  assert.equal(M.sortPrepare(regles, { ...enGlace, sorts: perdu, posture_id: POSTURE('neutre') }), null);
  // la liste, en Symbiose de la Glace : les sorts de la Glace seulement ; en Symbiose du Feu, ceux du Feu
  assert.deepEqual(M.sortsAPreparer(regles, enGlace).map((x) => x.sort.id), [glace]);
  assert.deepEqual(M.sortsAPreparer(regles, enFeu).map((x) => x.sort.id), [ATTAQUE_1]);
  assert.deepEqual(M.sortsAPreparer(regles, aChoisir).map((x) => x.sort.id), [ATTAQUE_1, glace]);
  // le Potentiel Illimité inné : sa Symbiose n'a pas de magie (décision R109), rien n'est perdu
  const pi = { ...prepare, magie_innee_id: 'magies/potentiel-illimite', magie_acquise_id: null, posture_id: POSTURE('symbiose'), symbiose_magie_id: null };
  assert.equal(M.postureDuMoment(regles, pi).symbiose.potentielIllimite, true);
  assert.equal(M.sortsApresLaSymbiose(regles, pi), pi.sorts);
  // la page lâche la préparation à chaque rafraîchissement (src/scripts/fiche.mjs, lu comme un texte)
  const script = readFileSync(new URL('../src/scripts/fiche.mjs', import.meta.url), 'utf8');
  const rafraichir = script.slice(script.indexOf('function rafraichir()'), script.indexOf('calcul = {', script.indexOf('function rafraichir()')));
  assert.match(rafraichir, /fiche\.sorts = sortsApresLaSymbiose\(regles, fiche\);/);
});

test('R115 : changer le sort d’un emplacement (sortsApresChoixDEmplacement) : le nouveau sort à 0 NM, sans livre ni la préparation de l’ancien ; vider retire la ligne ; un emplacement libre en ajoute une', () => {
  const f = mage(3, [ATTAQUE_1, ATTAQUE_2]);
  const avant = { ...f, sorts: M.sortsApresPreparation(regles, { ...f, posture_id: POSTURE('focus') }, ATTAQUE_1).map((s, i) => (i === 0 ? { ...s, prepare_jet: 40, niveau_maitrise: 2, nm_livre: 1 } : s)) };
  const gele = structuredClone(avant);
  assert.deepEqual(M.sortsApresChoixDEmplacement(avant, 0, AUTRE_1)[0],
    { sort_id: AUTRE_1, rang: 1, niveau_maitrise: 0, nm_livre: 0, prepare: 0, prepare_jet: null, prepare_posture_id: null });
  assert.equal(M.sortPrepare(regles, avant).sort.id, ATTAQUE_1);
  assert.equal(M.sortPrepare(regles, { ...avant, sorts: M.sortsApresChoixDEmplacement(avant, 0, AUTRE_1) }), null, 'plus de sort préparé');
  assert.deepEqual(M.sortsApresChoixDEmplacement(avant, 0, null).map((s) => s.sort_id), [ATTAQUE_2]);
  assert.deepEqual(M.sortsApresChoixDEmplacement(avant, 2, ATTAQUE_3).at(-1), { sort_id: ATTAQUE_3, rang: 3, niveau_maitrise: 0, nm_livre: 0 });
  // l'autre ligne garde la sienne (rien de préparé, mais son objet n'est pas recréé) ; la fiche n'est pas touchée
  assert.equal(M.sortsApresChoixDEmplacement(avant, 0, AUTRE_1)[1], avant.sorts[1]);
  assert.deepEqual(avant, gele);
});

test('R119 : l’arme choisie d’un choix d’acquis (personnage_acquis_choix.arme_famille_id) suit le choix tant que sa compétence ne change pas ; jamais sur une répartition', () => {
  const f = {
    ...ficheVide('Lame'), race_id: 'races/humain', ethnie_id: 'races/humain#ethnie:humain-central', magie_innee_id: 'magies/magie-du-feu', xp: xpDuNiveau(10),
    classes: [{ rang: 1, classe_id: 'classes/guerrier', specialite_id: 'classes/guerrier#specialite:epeiste' }],
    acquis_choix: [
      { source: 'capacites/guerrier-epeiste', rang: 1, competence_id: 'arme-legere', valeur: null, arme_famille_id: 'epees' },
      { source: 'races/humain#don:humain-central', rang: 1, competence_id: 'arc', valeur: 6, arme_famille_id: null },
      { source: 'races/humain#don:humain-central', rang: 1, competence_id: 'calme', valeur: 4 },
    ],
  };
  assert.deepEqual(M.acquisChoixValables(regles, f), [
    { source: 'capacites/guerrier-epeiste', rang: 1, competence_id: 'arme-legere', valeur: null, arme_famille_id: 'epees' },
    { source: 'races/humain#don:humain-central', rang: 1, competence_id: 'arc', valeur: 6 },
    { source: 'races/humain#don:humain-central', rang: 1, competence_id: 'calme', valeur: 4 },
  ]);
  // une autre compétence : un autre choix, sans l'arme
  const change = { ...f, ...M.acquisApresChoix(f, 'capacites/guerrier-epeiste', 1, 'arme-lourde') };
  assert.deepEqual(M.acquisChoixValables(regles, change)[0], { source: 'capacites/guerrier-epeiste', rang: 1, competence_id: 'arme-lourde', valeur: null });
  // sans arme choisie, la ligne d'avant (aucune clé de plus)
  const sansArme = { ...f, acquis_choix: f.acquis_choix.map(({ arme_famille_id: _a, ...x }) => x) };
  assert.ok(M.acquisChoixValables(regles, sansArme).every((x) => !('arme_famille_id' in x)));
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

test('R115, R132 : « Charge lente… » (+5 au sort préparé offensif) et « … ou rapide » (+5 aux sorts offensifs non préparés), Mage Rouge Rubis niveau 10 ; « offensif » : d’attaque ; plus « selon la situation »', () => {
  const lente = don('classes/mage-rouge', 'capacites/mage-rouge-charge-lente');
  const rapide = don('classes/mage-rouge', 'capacites/mage-rouge-ou-rapide');
  assert.deepEqual([lente.nom, lente.effet, lente.niveau, lente.specialite_id], ['Charge lente…', 'Les sorts offensifs préparés infligent +5 dégâts.', 10, 'classes/mage-rouge#specialite:mage-rubis']);
  assert.deepEqual([rapide.nom, rapide.effet, rapide.niveau, rapide.specialite_id], ['… ou rapide', 'Les sorts offensifs non préparés infligent +5 dégâts.', 10, 'classes/mage-rouge#specialite:mage-rubis']);
  assert.deepEqual(lente.sorts, [{ cible: 'degats', valeur: 5, vises: { attaque: true, prepare: true } }]);
  assert.deepEqual(rapide.sorts, [{ cible: 'degats', valeur: 5, vises: { attaque: true, prepare: false } }]);
  // aucun autre texte de la base ne vise le sort préparé ou les autres, sauf ceux du Mage Vert que les décisions R133 et R134 y rattachent
  const textes = [...lignes('SELECT id, effet AS texte FROM capacite WHERE effet IS NOT NULL'), ...lignes('SELECT id, texte FROM race_don')];
  assert.deepEqual(textes.filter((t) => bonusDeSortsEcrits(t.texte).some((b) => 'prepare' in b.vises)).map((t) => t.id).sort(),
    ['capacites/mage-rouge-charge-lente', 'capacites/mage-rouge-ou-rapide', 'capacites/mage-vert-a-laise', 'capacites/mage-vert-soralonge']);

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

// ------------------------------------------------------------------ R133 à R136 (décisions du 2026-10-22)

/** Mage Vert, spécialité Mage jade, au niveau global `niveau` (5 : classe de niveau 10), « Chargement » débloqué dès le niveau 1. */
const mageVert = (niveau, sorts, x = {}) => mage(niveau, sorts, { classes: [{ rang: 1, classe_id: 'classes/mage-vert', specialite_id: 'classes/mage-vert#specialite:mage-jade' }], ...x });

test('R133 : « Soralongé » (Mage Vert, niveau de classe 5) donne +2 de portée au sort préparé, le sort chargé ; ni aux autres sorts, ni sans sort préparé, ni avant son niveau', () => {
  const sora = don('classes/mage-vert', 'capacites/mage-vert-soralonge');
  assert.deepEqual([sora.niveau, sora.nature, sora.type], [5, 'classe', 'passif']);
  // (le site de dev modifie les dons : le texte de l'import, et sa lecture)
  const ecrit = historiqueSite(db).lignesDImport('capacite').find((d) => d.id === sora.id).effet;
  assert.equal(ecrit, "Augmente la portée des sorts d'attaque chargés de +2");
  assert.deepEqual(bonusDeSortsEcrits(ecrit), [{ cible: 'portee', valeur: 2, vises: { attaque: true, prepare: true } }]);
  assert.deepEqual(sora.sorts, bonusDeSortsEcrits(sora.effet));
  const f = mageVert(3, [ATTAQUE_1, ATTAQUE_2]);
  const prepare = { ...f, sorts: M.sortsApresPreparation(regles, f, ATTAQUE_1) };
  const portee = (fiche, id) => {
    const m = M.sortDuMoment(regles, fiche, sortDe(id), auNm(sortDe(id)));
    return [m.portee.texte, m.portee.detail, m.nonComptes.filter((x) => x.cible === 'portee')];
  };
  const boule = auNm(sortDe(ATTAQUE_1)).portee;
  assert.match(boule, /^\d+$/);
  assert.deepEqual(portee(prepare, ATTAQUE_1), [String(Number(boule) + 2), [{ nom: 'Soralongé (Mage Vert)', valeur: 2 }], []]);
  assert.deepEqual(portee(prepare, ATTAQUE_2), [auNm(sortDe(ATTAQUE_2)).portee, [], []], 'un autre sort');
  assert.deepEqual(portee(f, ATTAQUE_1), [boule, [], []], 'sans sort préparé');
  // niveau global 2 : classe de niveau 4, « Chargement » débloqué, « Soralongé » pas encore
  const avant = { ...prepare, xp: xpDuNiveau(2) };
  assert.ok(M.sortPrepare(regles, avant));
  assert.deepEqual(portee(avant, ATTAQUE_1), [boule, [], []]);
});

test('R134 : « À l’aise » (Mage Vert, Mage jade, niveau de classe 10), nouvelle version (migration 0071) : +1 NM au sort préparé, au plus 3, lu dans son texte ; hors du décompte', () => {
  const aise = don('classes/mage-vert', 'capacites/mage-vert-a-laise');
  const texte = 'Donne un NM supplémentaire au sort préparé. Ne peut pas dépasser 3 NM.';
  assert.deepEqual([aise.niveau, aise.nature, aise.type, aise.specialite_id], [10, 'choix', 'passif', 'classes/mage-vert#specialite:mage-jade']);
  // la migration 0071 : le texte de la décision (avant toute modification du site de dev) ; la fiche du don suit l'effet, comme le service la refait
  assert.equal(historiqueSite(db).lignesDImport('capacite').find((d) => d.id === aise.id).effet, texte);
  const effet = lignes('SELECT effet, remarque FROM capacite WHERE id = ?', aise.id)[0];
  assert.deepEqual(lignes('SELECT resume, corps_md FROM page WHERE id = ?', aise.id), [{ resume: resumeDeDon(effet), corps_md: corpsDeDon(effet) }]);
  assert.deepEqual(bonusDeSortsEcrits(texte), [{ cible: 'nm', valeur: 1, vises: { tous: true, prepare: true }, max: 3 }]);
  assert.deepEqual(aise.sorts ?? [], bonusDeSortsEcrits(aise.effet));
  assert.deepEqual(bonusDeSortsEcrits('Le sort influé aura toujours au minimum un Niveau de Maîtrise.'), [], 'l’ancien texte n’est pas lu');

  // la fiche : +1 NM au sort préparé, sans dépasser 3 ; le décompte ne compte que les NM de la ligne
  const r = { ...regles, classes: regles.classes.map((c) => (c.id !== 'classes/mage-vert' ? c : { ...c, dons: c.dons.map((d) => (d.id === aise.id ? { ...d, effet: texte, sorts: bonusDeSortsEcrits(texte) } : d)) })) };
  const f = mageVert(5, [ATTAQUE_1, ATTAQUE_2], { capacites: [{ capacite_id: aise.id }] });
  const avecNm = (nm) => ({ ...f, sorts: M.sortsApresPreparation(r, f, ATTAQUE_1).map((x, i) => (i === 0 ? { ...x, niveau_maitrise: nm } : x)) });
  for (const [nm, total] of [[0, 1], [1, 2], [2, 3], [3, 3]]) {
    const g = avecNm(nm);
    const lu = M.nmDuMoment(r, g, g.sorts[0]);
    assert.deepEqual([lu.base, lu.total, lu.detail], [nm, total, total > nm ? [{ nom: 'À l\'aise (Mage Vert)', valeur: 1 }] : []], `${nm} NM`);
    assert.equal(M.maitriseDesSorts(r, g).total, nm, 'le décompte');
  }
  const g = avecNm(0);
  assert.deepEqual(M.nmDuMoment(r, g, g.sorts[1]), { total: 0, base: 0, detail: [] }, 'un autre sort');
  assert.deepEqual(M.nmDuMoment(r, f, f.sorts[0]), { total: 0, base: 0, detail: [] }, 'sans sort préparé');
  assert.equal(M.nmDuMoment(r, { ...g, capacites: [{ capacite_id: 'capacites/mage-vert-vieille-branche' }] }, g.sorts[0]).total, 0, 'l’autre don du choix');
  assert.equal(M.nmDuMoment(r, { ...g, xp: xpDuNiveau(4) }, g.sorts[0]).total, 0, 'avant le niveau de classe 10');
  // lu dans le texte, jamais par le nom du don
  const avecTexte = (t) => ({ ...r, classes: r.classes.map((c) => (c.id !== 'classes/mage-vert' ? c : { ...c, dons: c.dons.map((d) => (d.id === aise.id ? { ...d, effet: t, sorts: bonusDeSortsEcrits(t) } : d)) })) });
  assert.equal(M.nmDuMoment(avecTexte('Le sort influé aura toujours au minimum un Niveau de Maîtrise.'), g, g.sorts[0]).total, 0);
  assert.equal(M.nmDuMoment(avecTexte('Donne 2 NM supplémentaires au sort préparé.'), g, g.sorts[0]).total, 2);
  // ses valeurs se lisent à ce NM (Boule de feu : 2d6 à 0 NM, 3d6 à 1 NM) ; la page lit nmDuMoment (src/scripts/fiche.mjs, lu comme un texte)
  const boule = sortDe(ATTAQUE_1);
  assert.notEqual(valeurAuNm(boule.dsb, boule.bonus, 'dsb', M.nmDuMoment(r, g, g.sorts[0]).total), valeurAuNm(boule.dsb, boule.bonus, 'dsb', 0));
  const script = readFileSync(new URL('../src/scripts/fiche.mjs', import.meta.url), 'utf8');
  assert.match(script, /const nmLu = fiche\.sorts\[l\.index\] \? nmDuMoment\(regles, fiche, fiche\.sorts\[l\.index\], calcul\.contexteSorts\)/);
  assert.match(script, /valeurAuNm\(brut, l\.sort\.bonus \?\? \[\], champ, nmLu\.total\)/);
});

test('R136 : un seul sort préparé à la fois, même bi-classé Mage Rouge et Mage Vert (« Préparation » et « Chargement ») ; le bloc le dit, pour tout type d’attaque', () => {
  const bi = mage(10, [ATTAQUE_1, ATTAQUE_2], {
    mode_classe: 'bi', classes: [{ rang: 1, classe_id: 'classes/mage-rouge', specialite_id: null }, { rang: 2, classe_id: 'classes/mage-vert', specialite_id: null }],
  });
  assert.deepEqual(M.donDePreparation(regles, bi).dons.map((x) => x.don.id).sort(), ['capacites/mage-rouge-preparation', 'capacites/mage-vert-chargement']);
  const premier = M.sortsApresPreparation(regles, bi, ATTAQUE_1);
  assert.deepEqual(M.sortsApresPreparation(regles, { ...bi, sorts: premier }, ATTAQUE_2).map((x) => x.prepare), [0, 1], 'préparer un second sort lâche le premier');
  // la base : un sort préparé par fiche (index unique de personnage_sort, migration 0067)
  assert.ok(lignes("SELECT sql FROM sqlite_master WHERE name = 'personnage_sort_prepare'")[0].sql.includes('WHERE prepare = 1'));
  // le bloc « Sort préparé » (src/scripts/fiche.mjs, lu comme un texte)
  const script = readFileSync(new URL('../src/scripts/fiche.mjs', import.meta.url), 'utf8');
  assert.match(script, /Un seul sort préparé à la fois, utilisable pour n’importe quel type `\s*\+ 'd’attaque, de contact ou à distance/);
});
