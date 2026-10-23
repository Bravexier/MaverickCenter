// Décisions R165 et R166 : les crans de résistance des armures élémentaires entrent dans les résistances de la fiche de personnage (réponse du
// propriétaire : « Le compter dans ce lot »). La lecture de leurs effets (lib/resistance-texte.mjs, option `immunites` des armures élémentaires
// seulement), `regles.armures_elementaires[].resistances` (lib/fiche-regles.mjs) et leur compte dans resistancesDe, degatsRecus et l'export en tableur
// (lib/fiche-moteur.mjs, lib/fiche-tableur-export.mjs). L'Arcane et la Corruption « tels qu'écrits » (« Oui, tel qu'écrit (Recommandé) ») ; la Symbiose
// n'y touche pas (« Oui, effet d'équipement (Recommandé) ») ; les immunités écrites dans des dons restent non comptées (« Oui, dans un lot à part »).
// Identifiants lus dans les règles (le nom d'une armure ou d'une altération peut changer sur le site de dev : son identifiant reste).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { ficheVide } from '../src/lib/fiche-format.mjs';
import * as M from '../src/lib/fiche-moteur.mjs';
import { chargerReglesDeFiche } from '../src/lib/fiche-regles.mjs';
import { CASES_RESISTANCES } from '../src/lib/fiche-tableur-cases.mjs';
import { cellulesDeLaFiche } from '../src/lib/fiche-tableur-export.mjs';
import { lecteurDeResistances } from '../src/lib/resistance-texte.mjs';

const db = ouvrirBase({ sansExemples: false });
const regles = JSON.parse(JSON.stringify(chargerReglesDeFiche(db))); // tel que la page le reçoit
const FEU = 'magies/magie-du-feu';
const EAU = 'magies/magie-de-leau';
const GLACE = 'magies/magie-de-la-glace';
const ARCANE = 'magies/magie-de-larcane';
const CORRUPTION = 'magies/magie-de-la-corruption';
const BRULURE = 'guide/liste-des-alterations-d-etat#etat:brulure';
const SYMBIOSE = 'guide/postures#posture:symbiose';
const elementaire = (magie, poids) => regles.armures_elementaires.find((a) => a.magie_id === magie && a.categorie === poids);
const GARDE_BRAISE = elementaire(FEU, 'Léger');
const TISSU_DU_FROID = elementaire(GLACE, 'Vêtement');
const LEGER_ARCANE = elementaire(ARCANE, 'Léger');
/** Un humain sans classe (aucune AM de classe magique), son armure élémentaire et ses magies. */
const fiche = (x = {}) => ({ ...ficheVide('Essai R166'), race_id: 'races/humain', ethnie_id: 'races/humain#ethnie:humain-central', ...x });
/** Les mêmes règles sans les résistances des armures élémentaires : « avant » ce lot. */
const avant = { ...regles, armures_elementaires: regles.armures_elementaires.map(({ resistances: _r, ...a }) => a) };
/** Le palier et les crans d'une cible : [palier, crans, immunité] ; null sans cran. */
function palier(r, f, type, id) {
  for (const p of M.resistancesDe(r, f).paliers) {
    const c = p.cibles.find((x) => x.type === type && x.id === id);
    if (c) return [p.id, c.crans, c.immunite];
  }
  return null;
}
const recus = (r, f, type) => M.degatsRecus(r, f, { entrants: 30, type }).recus;

test('R165, R166 : la lecture des 56 armures — 55 ont une seule magie à +1, Vêtement Glace le Feu +1 et l’immunité à la Brûlure ; Arcane → Corruption, Corruption → Arcane', () => {
  assert.equal(regles.armures_elementaires.length, 56);
  assert.ok(regles.etats.some((e) => e.id === BRULURE), 'l’altération Brûlure');
  for (const a of regles.armures_elementaires) {
    // le rang 1 : « +1 cran de résistance <à la | à l' | au | de la | de l'> <magie> » ; tel qu'écrit, la colonne Arcane donne la Corruption et l'inverse
    const attendue = a.magie_id === ARCANE ? CORRUPTION : a.magie_id === CORRUPTION ? ARCANE : a.magie_id;
    const effets = a.resistances?.effets ?? [];
    if (a.id === TISSU_DU_FROID.id) {
      assert.deepEqual(effets, [{ type: 'magie', id: GLACE, crans: 1 }, { type: 'magie', id: FEU, crans: 1 }, { type: 'etat', id: BRULURE, immunite: true }], a.id);
    } else assert.deepEqual(effets, [{ type: 'magie', id: attendue, crans: 1 }], a.id);
    assert.equal(a.resistances.choix, false, a.id);
  }
  // aucune autre ligne ne produit d'effet : les bonus de sorts (rang 2), les effets sur les ennemis, temporaires ou situationnels (rang 3)
  const lire = lecteurDeResistances([
    ...regles.magies.map((m) => ({ type: 'magie', id: m.id, nom: m.nom })), ...regles.etats.map((e) => ({ type: 'etat', id: e.id, nom: e.nom })),
  ]);
  for (const a of regles.armures_elementaires) {
    a.effets.forEach((t, i) => {
      const lu = lire(t, { immunites: true });
      if (i === 0 || (a.id === TISSU_DU_FROID.id && i === 2)) assert.ok(lu.effets.length, `${a.id} rang ${i + 1}`);
      else assert.deepEqual(lu, { effets: [], choix: false }, `${a.id} rang ${i + 1} : « ${t} »`);
    });
  }
  // sans l'option (les dons), « et immunité à la brûlure » ne devient pas une immunité : la lecture des dons ne change pas
  assert.deepEqual(lire(TISSU_DU_FROID.effets[2]).effets.find((e) => e.id === BRULURE), { type: 'etat', id: BRULURE, crans: 1 });
});

test('R166 : les immunités écrites dans des dons restent non comptées (« Immunité au saignement », « Immunité à la paralysie »)', () => {
  const dons = [...regles.races.flatMap((r) => r.dons), ...regles.classes.flatMap((c) => c.dons.map((d) => ({ ...d, texte: d.effet })))]
    .filter((d) => /^-?\s*immunité (?:à|au|aux)\b/im.test(d.texte ?? ''));
  assert.ok(dons.length >= 3, 'les dons « Immunité au … » de la base');
  for (const d of dons) {
    const lignes = String(d.texte).split('\n').filter((l) => /^-?\s*immunité (?:à|au|aux)\b/i.test(l));
    for (const l of lignes) assert.ok(!(d.resistances?.effets ?? []).some((e) => e.immunite && l.toLowerCase().includes(String(M.trouver(regles.etats, e.id)?.nom ?? '§').toLowerCase())), `${d.id} : ${l}`);
  }
});

test('R166 : Garde braise (Léger Feu, AP 5), Feu innée — le Feu passe de 1 à 2 ; 30 dégâts de Feu : 25 ÷ 3 = 8 au lieu de 25 ÷ 2 = 12 ; l’origine nommée', () => {
  assert.equal(GARDE_BRAISE.nom, 'Garde braise');
  assert.equal(GARDE_BRAISE.ap, 5);
  const f = fiche({ magie_innee_id: FEU, armure_elementaire_id: GARDE_BRAISE.id });
  assert.deepEqual(palier(avant, f, 'magie', FEU), ['resistance', 1, false]);
  assert.deepEqual(palier(regles, f, 'magie', FEU), ['grande_resistance', 2, false]);
  assert.equal(recus(avant, f, FEU), 12);
  assert.equal(recus(regles, f, FEU), 8);
  const cible = M.resistancesDe(regles, f).paliers.flatMap((p) => p.cibles).find((c) => c.id === FEU);
  assert.deepEqual(cible.origines.at(-1), { nom: 'Garde braise (armure élémentaire)', crans: 1 });
  // sans armure élémentaire portée, rien ne change ; seule l'armure portée compte
  assert.deepEqual(M.resistancesDe(regles, fiche({ magie_innee_id: FEU })), M.resistancesDe(avant, fiche({ magie_innee_id: FEU })));
});

test('R166 : Feu innée + Eau acquise + Garde braise — Feu 3, donc Immunité, 0 dégât', () => {
  const f = fiche({ magie_innee_id: FEU, magie_acquise_id: EAU, armure_elementaire_id: GARDE_BRAISE.id });
  assert.deepEqual(palier(avant, f, 'magie', FEU), ['grande_resistance', 2, false]);
  assert.deepEqual(palier(regles, f, 'magie', FEU), ['immunite', 3, false]);
  assert.equal(recus(regles, f, FEU), 0);
});

test('R166 : Glace innée + Vêtement Glace (AM 2) — Feu de −1 à 0 (30 de Feu : 28 au lieu de 56), Brûlure en Immunité malgré −1, Glace 2', () => {
  assert.equal(TISSU_DU_FROID.am, 2);
  const f = fiche({ magie_innee_id: GLACE, armure_elementaire_id: TISSU_DU_FROID.id });
  assert.deepEqual(palier(avant, f, 'magie', FEU), ['vulnerabilite', -1, false]);
  assert.equal(palier(regles, f, 'magie', FEU), null, 'à 0, rien');
  assert.equal(recus(avant, f, FEU), 56);
  assert.equal(recus(regles, f, FEU), 28);
  assert.deepEqual(palier(avant, f, 'etat', BRULURE), ['vulnerabilite', -1, false]);
  assert.deepEqual(palier(regles, f, 'etat', BRULURE), ['immunite', -1, true], 'une immunité écrite prévaut');
  assert.deepEqual(palier(regles, f, 'magie', GLACE), ['grande_resistance', 2, false]);
});

test('R166 : Arcane innée + Léger Arcane (AM 7), tel qu’écrit — la Corruption de 1 à 2 (30 de Corruption : 7 au lieu de 11), l’Arcane sans cran', () => {
  assert.equal(LEGER_ARCANE.am, 7);
  const f = fiche({ magie_innee_id: ARCANE, armure_elementaire_id: LEGER_ARCANE.id });
  assert.deepEqual(palier(avant, f, 'magie', CORRUPTION), ['resistance', 1, false]);
  assert.deepEqual(palier(regles, f, 'magie', CORRUPTION), ['grande_resistance', 2, false]);
  assert.equal(recus(avant, f, CORRUPTION), 11);
  assert.equal(recus(regles, f, CORRUPTION), 7);
  assert.equal(palier(regles, f, 'magie', ARCANE), null);
});

test('R165, R166 : six parties à 0 — les résistances ne changent pas (R158 ne vise pas une armure élémentaire ; Q57 ouverte)', () => {
  const f = fiche({ magie_innee_id: FEU, armure_elementaire_id: GARDE_BRAISE.id });
  const parties = M.partiesDeLArmure(regles, f).parties;
  assert.equal(parties.length, 6);
  const cassee = { ...f, armure_parties: parties.map((p) => ({ emplacement_id: p.emplacement_id, solidite: 0 })) };
  assert.ok(M.partiesDeLArmure(regles, cassee).parties.every((p) => p.cassee));
  assert.deepEqual(M.resistancesDe(regles, cassee), M.resistancesDe(regles, f));
  assert.deepEqual(palier(regles, cassee, 'magie', FEU), ['grande_resistance', 2, false]);
});

test('R166 : Symbiose — l’armure de la magie désactivée garde son cran (effet d’équipement) ; les listes de la magie, elles, tombent (R111)', () => {
  // Feu innée, Eau acquise, Symbiose avec l'Eau : le Feu est désactivé ; Garde braise, une armure du Feu
  const f = fiche({ magie_innee_id: FEU, magie_acquise_id: EAU, armure_elementaire_id: GARDE_BRAISE.id, posture_id: SYMBIOSE, symbiose_magie_id: EAU });
  assert.deepEqual(M.resistancesDe(regles, f).desactivee, { id: FEU, nom: 'Feu' });
  const cible = M.resistancesDe(regles, f).paliers.flatMap((p) => p.cibles).find((c) => c.type === 'magie' && c.id === FEU);
  assert.ok(cible.origines.some((o) => o.nom === 'Garde braise (armure élémentaire)' && o.crans === 1), 'le cran de l’armure reste');
  assert.ok(!cible.origines.some((o) => /magie innée/.test(o.nom)), 'la liste du Feu désactivé ne compte plus');
  assert.deepEqual(palier(avant, f, 'magie', FEU), ['resistance', 1, false], 'avant : la liste de l’Eau seule');
  assert.deepEqual(palier(regles, f, 'magie', FEU), ['grande_resistance', 2, false], 'avec l’armure : +1');
});

test('R166, R163 : un Flagelleur (pas PI) — « ... plus fort ! » garde les crans positifs de l’armure, « Punis-moi ... » s’y ajoute, une immunité écrite prévaut', () => {
  const PUNIS = 'capacites/flagelleur-puni-moi';
  const PLUS_FORT = 'capacites/flagelleur-plus-fort';
  const SURDITE = 'guide/liste-des-alterations-d-etat#etat:surdite';
  const TISSU_DU_CHAUD = elementaire(FEU, 'Vêtement');
  /** Flagelleur Masochiste de niveau de classe 10 (niveau global 5), magie innée `magie`, le don `don`. */
  const flagelleur = (magie, don, x = {}) => fiche({
    magie_innee_id: magie, xp: regles.niveaux.find((l) => l.niveau === 5).xp_min, capacites: [{ capacite_id: don }],
    classes: [{ rang: 1, classe_id: 'classes/flagelleur', specialite_id: 'classes/flagelleur#specialite:masochiste' }], ...x,
  });
  // « ... plus fort ! », Glace innée, Tissu du froid : Brûlure en immunité (écrite, elle prévaut) ; la Glace +1 de l'armure gardé (2) ; le Feu, une
  // faiblesse à une magie que le don ne touche pas, −1 + 1 = 0
  const glace = flagelleur(GLACE, PLUS_FORT, { armure_elementaire_id: TISSU_DU_FROID.id });
  assert.deepEqual(palier(regles, glace, 'etat', BRULURE), ['immunite', 0, true]);
  assert.deepEqual(palier(regles, glace, 'magie', GLACE), ['grande_resistance', 2, false]);
  assert.equal(palier(regles, glace, 'magie', FEU), null);
  // aucune armure n'écrit de cran à une altération : règles d'essai où Tissu du froid donne aussi +1 à la Surdité (une faiblesse de la Glace, −1).
  // « ... plus fort ! » retire le −1 de la magie et garde le +1 de l'armure : +1, pas 0
  const essai = { ...regles, armures_elementaires: regles.armures_elementaires.map((a) => (a.id !== TISSU_DU_FROID.id ? a
    : { ...a, resistances: { ...a.resistances, effets: [...a.resistances.effets, { type: 'etat', id: SURDITE, crans: 1 }] } })) };
  assert.deepEqual(palier(essai, flagelleur(GLACE, null, { armure_elementaire_id: TISSU_DU_FROID.id }), 'etat', SURDITE), null, 'sans le don : −1 + 1');
  assert.deepEqual(palier(essai, glace, 'etat', SURDITE), ['resistance', 1, false], 'le cran positif de l’armure reste');
  // « Punis-moi ... », Feu inné, Tissu du chaud : les crans s'additionnent — le Feu passe de 1 à 2, les altérations du don restent à 2
  const feu = flagelleur(FEU, PUNIS);
  const avecLArmure = { ...feu, armure_elementaire_id: TISSU_DU_CHAUD.id };
  assert.deepEqual(palier(regles, feu, 'magie', FEU), ['resistance', 1, false]);
  assert.deepEqual(palier(regles, avecLArmure, 'magie', FEU), ['grande_resistance', 2, false]);
  assert.deepEqual(palier(regles, avecLArmure, 'etat', BRULURE), palier(regles, feu, 'etat', BRULURE));
  assert.deepEqual(palier(regles, feu, 'etat', BRULURE), ['grande_resistance', 2, false]);
});

test('R166 : l’export en tableur écrit les paliers avec l’armure élémentaire (cases BA/BI, sans la posture du moment)', () => {
  const f = fiche({ magie_innee_id: GLACE, armure_elementaire_id: TISSU_DU_FROID.id });
  const v = cellulesDeLaFiche(regles, f, { date: '23/10/2026' }).cellules;
  const r = M.resistancesDe(regles, f, { avecLaPosture: false });
  for (const k of CASES_RESISTANCES) {
    const p = r.paliers.find((x) => x.id === k.palier);
    assert.equal(v[k.cibles] ?? '', p.cibles.map((x) => x.nom).join(', '), k.palier);
  }
  const cellule = (id) => v[CASES_RESISTANCES.find((k) => k.palier === id).cibles] ?? '';
  const nom = (liste, id) => M.trouver(regles[liste], id).nom;
  assert.ok(cellule('immunite').split(', ').includes(nom('etats', BRULURE)), 'Brûlure en immunité');
  assert.ok(cellule('grande_resistance').split(', ').includes(nom('magies', GLACE)), 'Glace en grande résistance');
  assert.ok(!Object.values(Object.fromEntries(CASES_RESISTANCES.map((k) => [k.palier, v[k.cibles] ?? '']))).join(', ').split(', ').includes(nom('magies', FEU)), 'le Feu à 0 : nulle part');
});
