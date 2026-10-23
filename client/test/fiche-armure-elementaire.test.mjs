// Décision R165 sur la fiche de personnage (lib/fiche-moteur.mjs) : le poids portable (« un enum numérique. 0=Vêtement 1= Léger 2=Intermédiaire
// 3=Lourd », lu dans les textes des règles, jamais par un nom ou un identifiant), la liste unique des armures (armures de base au plus du poids portable,
// jamais « Familier » ; armures élémentaires des magies innée et acquise, aucune pour le Potentiel Illimité), la solidité d'une armure élémentaire
// (« 4 crans, +1 au +4 et au +5, sur les six parties »), le choix dans la liste unique, et les retraits notés (« Retirer et noter ») : leurs lignes sont
// celles du service (serveur/fiches-retraits.mjs#retirerLesArmuresHorsRegle), comparées ici sur une copie de la base vivante.
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { test } from 'node:test';
import { ouvrirBaseVivante, preparerBaseVivante } from '../serveur/base-vivante.mjs';
import { enregistrerFiche, lireFiche } from '../serveur/fiches.mjs';
import { cheminBase, ouvrirBase } from '../src/lib/donnees.mjs';
import { ficheVide, ligneDeRetrait, POIDS_DES_ARMURES, PREFIXE_DE_RETRAIT, valeurDuPoids } from '../src/lib/fiche-format.mjs';
import * as M from '../src/lib/fiche-moteur.mjs';
import { chargerReglesDeFiche } from '../src/lib/fiche-regles.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';

const db = ouvrirBase({ sansExemples: false });
const regles = JSON.parse(JSON.stringify(chargerReglesDeFiche(db))); // tel que la page le reçoit
const INSTANT = '2026-10-23T08:00:00Z';
const xpDuNiveau = (n) => regles.niveaux.find((x) => x.niveau === n).xp_min;
const NAIN = { race_id: 'races/nain', ethnie_id: 'races/nain#ethnie:nain-est' };
const NAIN_SANS_ETHNIE = { race_id: 'races/nain', ethnie_id: null };
const LAMIA = { race_id: 'races/lamia', ethnie_id: 'races/lamia#ethnie:lamia' };
const HUMAIN = { race_id: 'races/humain', ethnie_id: 'races/humain#ethnie:humain-central' };
const FEU = 'magies/magie-du-feu';
const PI = 'magies/potentiel-illimite';
/** Une fiche mono-classe : `niveauDeClasse` (pair) de sa classe 1, le double du niveau global (décision R2). */
const fiche = ({ classe, specialite = null, niveauDeClasse = 1, race = HUMAIN, innee = FEU, acquise = null, ...x } = {}) => ({
  ...ficheVide('Essai R165'), ...race, magie_innee_id: innee, magie_acquise_id: acquise, mode_classe: 'mono', xp: xpDuNiveau(Math.max(1, Math.ceil(niveauDeClasse / 2))),
  classes: classe ? [{ rang: 1, classe_id: classe, specialite_id: specialite }] : [], ...x,
});
const noms = {
  armure: (x) => M.trouver(regles.armures, x)?.nom ?? null, armureElementaire: (x) => M.trouver(regles.armures_elementaires, x)?.nom ?? null,
  amelioration: (x) => M.trouver(regles.ameliorations, x)?.niveau ?? null, emplacement: (x) => M.trouver(regles.emplacements_armure, x)?.nom ?? null,
};
const amelioration = (cible, niveau) => regles.ameliorations.find((a) => a.cible === cible && a.niveau === niveau);
const deBase = (poids) => regles.armures.find((a) => a.type === poids && Number(a.solidite_uni) !== 1);
const elementaire = (magie, poids) => regles.armures_elementaires.find((a) => a.magie_id === magie && a.categorie === poids);

test('R165 (6) : le poids portable des exemples — Nain Cuirassé 3, Nain Mage 1, Lamia Mage 1, Lanceur Fantassin au niveau de classe 10 : 2 (3 s’il est Nain), Mage 0', () => {
  const lanceur = { classe: 'classes/lanceur', specialite: 'classes/lanceur#specialite:fantassin', niveauDeClasse: 10 };
  const cas = [
    ['Nain Cuirassé', fiche({ classe: 'classes/cuirasse', race: NAIN }), 3],
    ['Nain Mage', fiche({ classe: 'classes/mage', race: NAIN }), 1],
    // tout Nain, ethnie choisie ou non (réponse du propriétaire : « Oui, tout Nain (Recommandé) » : les trois ethnies l'écrivent)
    ['Nain sans ethnie Mage', fiche({ classe: 'classes/mage', race: NAIN_SANS_ETHNIE }), 1],
    ['Nain sans ethnie Cuirassé', fiche({ classe: 'classes/cuirasse', race: NAIN_SANS_ETHNIE }), 3],
    ['Lamia Mage', fiche({ classe: 'classes/mage', race: LAMIA }), 1],
    ['Lanceur Fantassin 10', fiche(lanceur), 2],
    ['Nain Lanceur Fantassin 10', fiche({ ...lanceur, race: NAIN }), 3],
    ['Mage', fiche({ classe: 'classes/mage' }), 0],
    // la base seule : le Lanceur avant son don (niveau de classe 8), le Cuirassé humain
    ['Lanceur Fantassin 8', fiche({ ...lanceur, niveauDeClasse: 8 }), 1],
    ['Cuirassé', fiche({ classe: 'classes/cuirasse' }), 3],
    // Potentiel Illimité inné : 2 au plus, appliqué en dernier (même Nain)
    ['Nain Cuirassé, Potentiel Illimité inné', fiche({ classe: 'classes/cuirasse', race: NAIN, innee: PI }), 2],
    ['Mage, Potentiel Illimité inné', fiche({ classe: 'classes/mage', innee: PI }), 0],
    ['sans classe', fiche(), 0],
  ];
  for (const [nom, f, attendu] of cas) {
    assert.equal(M.poidsPortable(regles, f), attendu, nom);
    assert.equal(M.poidsPortableDe(regles, f).poids, POIDS_DES_ARMURES[attendu], nom);
  }
  // les étapes de l'infobulle : la classe, le don, le Nain
  const detail = M.poidsPortableDe(regles, fiche({ ...lanceur, race: NAIN })).etapes.map((e) => [e.texte, e.valeur]);
  assert.deepEqual(detail.map(([, v]) => v), [1, 2, 3]);
  assert.match(detail[1][0], /^FANTASSIN \(Lanceur\) : Intermédiaire$/i);
  assert.match(detail[2][0], /^Nain \(Londolor Est\) : une catégorie supérieure \(\+1\)$/);
  // l'ethnie pas encore choisie : le +1 de toutes les ethnies, nommé ainsi dans l'infobulle
  const sansEthnie = M.poidsPortableDe(regles, fiche({ classe: 'classes/mage', race: NAIN_SANS_ETHNIE })).etapes.map((e) => [e.texte, e.valeur]);
  assert.deepEqual(sansEthnie.at(-1), ['Nain (toutes les ethnies) : une catégorie supérieure (+1)', 1]);
});

test('R165 (6) : poidsPortableDesTextes — l’ordre (classes, dons, +1 du Nain, au moins la Lamia, 3 au plus, Potentiel Illimité en dernier), lu dans les textes', () => {
  const nain = 'Peut porter une catégorie supérieure d’armure selon les classes [aucun => léger, léger => intermédiaire, intermédiaire => lourde]';
  const lamia = 'Vision thermique, peut porter une armure légère même si la classe l’interdit.';
  const pi = '- Impossible de porter des armures lourdes ou boucliers lourds même si la classe vous le permet.';
  const v = (x) => M.poidsPortableDesTextes(x).valeur;
  assert.equal(v({}), 0);
  assert.equal(v({ classes: [1, null, 2] }), 2, 'le plus grand des classes (bi-classé)');
  assert.equal(v({ classes: [1], dons: ['Maîtrise  les armures intermédiaires'] }), 2, 'espaces doublés');
  assert.equal(v({ classes: [2], dons: ['Maîtrise les armures intermédiaires'] }), 2, 'un don ne fait que relever');
  assert.equal(v({ classes: [3], donsDeRace: [nain] }), 3, 'Nain : 3 au plus');
  assert.equal(v({ classes: [0], donsDeRace: [nain] }), 1, 'Nain sans armure de classe : Léger');
  assert.equal(v({ classes: [1], dons: ['Peut porter une armure intermédiaire'], donsDeRace: [nain] }), 3, '+1, dons compris');
  // l'ethnie pas encore choisie : +1 seulement quand chaque ethnie de la race a un don qui l'écrit (« Oui, tout Nain »), jamais par le nom
  assert.equal(v({ classes: [1], donsDesEthnies: { nom: 'Nain', ethnies: [[nain], ['+5%', nain], [nain]] } }), 2, 'toutes les ethnies l’écrivent');
  assert.equal(v({ classes: [1], donsDesEthnies: { nom: 'Nain', ethnies: [[nain], ['+5%'], [nain]] } }), 1, 'une ethnie ne l’écrit pas');
  assert.equal(v({ classes: [1], donsDesEthnies: { nom: 'Nain', ethnies: [] } }), 1, 'une race sans ethnie');
  assert.equal(v({ classes: [1], donsDeRace: [nain], donsDesEthnies: { ethnies: [[nain]] } }), 2, 'jamais deux fois');
  assert.equal(v({ avantages: lamia }), 1, 'Lamia : au moins Léger');
  assert.equal(v({ classes: [2], avantages: lamia }), 2, 'Lamia : jamais moins que la classe');
  assert.equal(v({ classes: [3], donsDeRace: [nain], explicationInnee: pi }), 2, 'Potentiel Illimité : en dernier');
  assert.equal(v({ classes: [1], explicationInnee: pi }), 1, 'Potentiel Illimité : un plafond, rien de plus');
  // ce qui ne compte pas : le malus de la catégorie (Cuirassé, Lancier), la phrase de la race Nain
  for (const t of ['L’armure lourde ne ralentit plus', 'L\'armure ne ralentit pas lors de cette action', 'Les armures lourdes ne les ralentissent pas, accès à toutes les classes.']) {
    assert.equal(M.poidsEcritDuDon(t), null, t);
    assert.equal(v({ classes: [1], dons: [t], donsDeRace: [t], avantages: t }), 1, t);
  }
  assert.equal(M.poidsEcritDuDon('Maîtrise les 3 armures, les Boucliers 1 à 4'), 3, 'Templier');
  assert.equal(M.poidsEcritDuDon('+3% pour les compétences d\'arme, peut porter les armures lourdes, +5 points'), 3);
});

test('R165 (6) : le relevé des dons qui écrivent un poids, sur toute la base — les 20 de gd-fiche, tous de spécialité au niveau de classe 10 ; Cuirassé et Lancier exclus', () => {
  const lus = Object.fromEntries(regles.classes.flatMap((c) => c.dons).map((d) => [d.id, M.poidsEcritDuDon(d.effet)]).filter(([, v]) => v !== null));
  const a3 = ['clerc-zelote', 'guerrier-maitre-darme', 'lancier-maitre-dhast', 'mercenaire-combattant-libre', 'moine-templier'];
  const a2 = ['fenrir-belliciste', 'goleois-irreductible', 'mage-rouge-mage-grenat', 'marcass-canaille', 'medusain-hoplite', 'minotaure-gladiateur', 'minotaure-medium',
    'namazu-batailleur', 'namazu-devin', 'orios-chaman', 'orios-va-t-en-guerre', 'satyre-galopin', 'satyre-oracle', 'lanceur-fantassin', 'martiale-heros'];
  assert.deepEqual(Object.keys(lus).sort(), [...a3, ...a2].map((x) => `capacites/${x}`).sort());
  for (const x of a3) assert.equal(lus[`capacites/${x}`], 3, x);
  for (const x of a2) assert.equal(lus[`capacites/${x}`], 2, x);
  for (const d of regles.classes.flatMap((c) => c.dons).filter((y) => y.id in lus)) assert.deepEqual([d.nature, d.niveau], ['specialite', 10], d.id);
  for (const id of ['capacites/cuirasse-vindicatif', 'capacites/lancier-ou-charger']) {
    const d = regles.classes.flatMap((c) => c.dons).find((y) => y.id === id);
    assert.match(d.effet, /ne ralentit/, id);
    assert.equal(M.poidsEcritDuDon(d.effet), null, id);
  }
  // les races : seuls les trois dons des ethnies du Nain donnent +1, seuls les avantages de la Lamia écrivent un poids ; seule l'explication du
  // Potentiel Illimité borne le poids portable
  const plus1 = regles.races.flatMap((r) => r.dons.filter((d) => M.poidsPortableDesTextes({ classes: [1], donsDeRace: [d.texte] }).valeur === 2).map((d) => d.id));
  assert.deepEqual(plus1.sort(), ['races/nain#don:londolor-centre-ligne-de-partage', 'races/nain#don:londolor-est', 'races/nain#don:londolor-ouest']);
  assert.deepEqual(regles.races.filter((r) => M.poidsEcritDuDon(r.avantages) !== null).map((r) => [r.id, M.poidsEcritDuDon(r.avantages)]), [['races/lamia', 1]]);
  assert.deepEqual(regles.magies.filter((m) => M.poidsPortableDesTextes({ classes: [3], explicationInnee: m.explication }).valeur < 3).map((m) => m.id), [PI]);
  // les classes sans armure dans leur « Maîtrise Armures » : Mage, Mage Vert, Ocultomancien, Flagelleur, Archimage
  assert.deepEqual(regles.classes.filter((c) => !c.maitrise_armures.length).map((c) => c.id).sort(),
    ['classes/archimage', 'classes/flagelleur', 'classes/mage', 'classes/mage-vert', 'classes/ocultomancien']);
});

test('R165 (5) : la liste unique — armures de base au plus du poids portable, jamais « Familier » ; armures élémentaires des magies innée et acquise ; aucune pour le Potentiel Illimité', () => {
  const lanceur = fiche({ classe: 'classes/lanceur', acquise: 'magies/magie-de-la-glace' });
  const l = M.armuresProposees(regles, lanceur);
  assert.equal(l.portable, 1);
  assert.deepEqual(l.base.map((g) => g.poids), ['Vêtement', 'Léger']);
  for (const g of l.base) assert.ok(g.armures.length && g.armures.every((a) => a.type === g.poids), g.poids);
  assert.equal(l.base.flatMap((g) => g.armures).length, regles.armures.filter((a) => ['Vêtement', 'Léger'].includes(a.type)).length);
  assert.deepEqual(l.elementaires.map((g) => g.magie.id), [FEU, 'magies/magie-de-la-glace']);
  for (const g of l.elementaires) assert.deepEqual(g.armures.map((a) => a.categorie), ['Vêtement', 'Léger'], g.magie.id);
  // au poids Lourd : toutes les armures de base sauf « Familier », les quatre poids élémentaires
  const lourd = M.armuresProposees(regles, fiche({ classe: 'classes/cuirasse' }));
  assert.equal(lourd.base.flatMap((g) => g.armures).length, regles.armures.filter((a) => a.type !== 'Familier').length);
  assert.ok(!lourd.base.flatMap((g) => g.armures).some((a) => a.type === 'Familier'));
  assert.deepEqual(lourd.elementaires[0].armures.map((a) => valeurDuPoids(a.categorie)), [0, 1, 2, 3]);
  // le Potentiel Illimité inné (sans acquise) : aucune armure élémentaire ; une acquise : les siennes seulement
  assert.deepEqual(M.armuresProposees(regles, fiche({ classe: 'classes/cuirasse', innee: PI })).elementaires, []);
  assert.deepEqual(M.armuresProposees(regles, fiche({ classe: 'classes/cuirasse', innee: PI, acquise: FEU })).elementaires.map((g) => g.magie.id), [FEU]);
  // Mage : les vêtements seulement
  assert.deepEqual(M.armuresProposees(regles, fiche({ classe: 'classes/mage' })).base.map((g) => g.poids), ['Vêtement']);
});

test('R165 (5), (6), R163 : un Flagelleur Potentiel Illimité qui a tiré une magie pour « Punis-moi ... » — aucune armure élémentaire, poids portable 0 (1 Nain ou Lamia)', () => {
  // la magie tirée par le MJ tient lieu de magie innée pour le don seulement (R163) : la liste et le poids portable lisent la vraie magie innée (le PI)
  const PUNIS = 'capacites/flagelleur-puni-moi';
  const flagelleur = fiche({
    classe: 'classes/flagelleur', specialite: 'classes/flagelleur#specialite:masochiste', niveauDeClasse: 10, innee: PI,
    capacites: [{ capacite_id: PUNIS }], resistance_choix: [{ source: PUNIS, rang: 1, magie_id: FEU }],
  });
  const choix = M.resistancesDe(regles, flagelleur).aChoisir.find((c) => c.source === PUNIS);
  assert.deepEqual([choix?.remplaceMagieInnee, choix?.fait, choix?.choisi], [true, true, FEU], 'la magie du don est bien choisie');
  const liste = M.armuresProposees(regles, flagelleur);
  assert.deepEqual(liste.elementaires, [], 'aucune armure élémentaire, ni du Feu tiré');
  assert.deepEqual(liste.base.map((g) => g.poids), ['Vêtement']);
  // « Maîtrise Armures » du Flagelleur : « Aucun » → 0 ; le plafond du PI (2) n'y change rien
  assert.equal(M.poidsPortable(regles, flagelleur), 0);
  assert.equal(M.poidsPortable(regles, { ...flagelleur, ...NAIN }), 1, 'Nain : +1');
  assert.equal(M.poidsPortable(regles, { ...flagelleur, ...LAMIA }), 1, 'Lamia : au moins Léger');
  // une armure élémentaire du Feu sur sa fiche : retirée et notée, le personnage n'a pas la magie (le Feu tiré ne compte pas)
  const porte = M.retraitsDeLArmureHorsListe(regles, { ...flagelleur, armure_elementaire_id: elementaire(FEU, 'Vêtement').id });
  assert.deepEqual(porte?.retraits.map((d) => d.nature), ['armure_magie_absente']);
});

test('R165 (3) : la solidité d’une armure élémentaire — la constante (4), plus les crans de son amélioration (5 au +4 et au +5), sur ses six parties', () => {
  const base = regles.constantes['piece_elementaire.solidite_base'];
  assert.equal(base, 4);
  const parties = M.partiesDuCorps(regles).map((p) => p.id);
  for (const a of regles.armures_elementaires) {
    for (const niveau of [0, 1, 2, 3, 4, 5]) {
      const am = niveau ? amelioration('armure_elementaire', niveau) : null;
      const f = { armure_elementaire_id: a.id, armure_amelioration_elementaire_id: am?.id ?? null };
      assert.equal(M.soliditeMaxDeLArmure(regles, f), niveau >= 4 ? 5 : 4, `${a.nom} +${niveau}`);
      const p = M.partiesDeLArmure(regles, f);
      assert.deepEqual([p.uni, p.elementaire, p.parties.map((x) => x.emplacement_id)], [false, true, parties]);
    }
  }
  // une amélioration d'armure de base ne compte pas sur une armure élémentaire (ni l'inverse) ; la constante lue, jamais 4 en dur
  const e = regles.armures_elementaires[0];
  assert.equal(M.soliditeMaxDeLArmure(regles, { armure_elementaire_id: e.id, armure_amelioration_elementaire_id: amelioration('armure', 5).id }), 4);
  assert.equal(M.soliditeMaxDeLArmure({ ...regles, constantes: { ...regles.constantes, 'piece_elementaire.solidite_base': 6 } }, { armure_elementaire_id: e.id }), 6);
  // AP et AM : ceux de l'armure élémentaire et de la ligne de son amélioration (R99, R165 (2))
  const plus5 = amelioration('armure_elementaire', 5);
  const parPartie = M.armureParPartie(regles, { armure_elementaire_id: e.id, armure_amelioration_elementaire_id: plus5.id, armure_parties: [{ emplacement_id: 'torse', solidite: 0 }] });
  assert.ok(parPartie.every((x) => (x.id === 'torse' ? x.ap === 0 && x.am === 0 : x.ap === e.ap + plus5.bonus_ap && x.am === e.am + plus5.bonus_am)));
});

test('R165 (5) : armureApresChoix dans la liste unique — une armure élémentaire remplace l’armure de base (et l’inverse), chacune avec son amélioration ; une autre armure est neuve', () => {
  const b = deBase('Léger');
  const e = elementaire(FEU, 'Léger');
  const f = { armure_id: b.id, armure_amelioration_id: amelioration('armure', 2).id, armure_parties: [{ emplacement_id: 'torse', solidite: 0 }] };
  const vers = M.armureApresChoix(regles, f, 'armure', e.id);
  assert.deepEqual(vers, { armure_id: null, armure_amelioration_id: null, armure_elementaire_id: e.id, armure_amelioration_elementaire_id: null, armure_parties: [] });
  const plus = M.armureApresChoix(regles, { ...vers, armure_parties: [{ emplacement_id: 'casque', solidite: 4 }, { emplacement_id: 'torse', solidite: 1 }] }, 'armure_amelioration_elementaire_id', amelioration('armure_elementaire', 4).id);
  assert.deepEqual([plus.armure_amelioration_elementaire_id, plus.armure_parties], [amelioration('armure_elementaire', 4).id, [{ emplacement_id: 'casque', solidite: 4 }, { emplacement_id: 'torse', solidite: 1 }]]);
  const retour = M.armureApresChoix(regles, plus, 'armure', b.id);
  assert.deepEqual(retour, { armure_id: b.id, armure_amelioration_id: null, armure_elementaire_id: null, armure_amelioration_elementaire_id: null, armure_parties: [] });
  assert.deepEqual(M.armureApresChoix(regles, plus, 'armure', null),
    { armure_id: null, armure_amelioration_id: null, armure_elementaire_id: null, armure_amelioration_elementaire_id: null, armure_parties: [] });
  // la même armure choisie de nouveau : ses parties restent
  assert.deepEqual(M.armureApresChoix(regles, plus, 'armure', e.id).armure_parties, plus.armure_parties);
});

test('R165 (7), (8) : retraitsDeLArmureHorsListe — trop lourde (le poids baisse), magie absente, « Familier », armure et élément d’avant ; null dans la liste', () => {
  const inter = deBase('Intermédiaire');
  const lanceur = { classe: 'classes/lanceur', specialite: 'classes/lanceur#specialite:fantassin', niveauDeClasse: 10 };
  const porte = fiche({ ...lanceur, armure_id: inter.id, armure_amelioration_id: amelioration('armure', 2).id, armure_parties: [{ emplacement_id: 'torse', solidite: 1 }] });
  assert.equal(M.retraitsDeLArmureHorsListe(regles, porte), null, 'dans la liste');
  // le niveau baisse (le don Fantassin perdu) : trop lourde
  const r = M.retraitsDeLArmureHorsListe(regles, { ...porte, xp: xpDuNiveau(4) });
  assert.deepEqual(r.colonnes, { armure_id: null, armure_amelioration_id: null, armure_elementaire_id: null, armure_amelioration_elementaire_id: null, armure_parties: [] });
  assert.deepEqual(r.retraits.map((d) => ligneDeRetrait(d, INSTANT)),
    [`[23/10/2026] ${PREFIXE_DE_RETRAIT}l’armure « ${inter.nom} » (amélioration +2, solidité Torse 1) n’est plus portée : elle est trop lourde pour le personnage (Intermédiaire, au plus Léger). Adaptez la fiche.`]);
  // une armure élémentaire d'une magie que le personnage n'a plus
  const eau = elementaire('magies/magie-de-leau', 'Léger');
  const m = M.retraitsDeLArmureHorsListe(regles, fiche({ ...lanceur, armure_elementaire_id: eau.id, armure_amelioration_elementaire_id: amelioration('armure_elementaire', 1).id }));
  assert.deepEqual(m.retraits.map((d) => ligneDeRetrait(d, INSTANT)),
    [`[23/10/2026] ${PREFIXE_DE_RETRAIT}l’armure élémentaire « ${eau.nom} » (amélioration +1) n’est plus portée : le personnage n’a pas la magie de cette armure (${M.trouver(regles.magies, eau.magie_id).nom}). Adaptez la fiche.`]);
  // une armure élémentaire trop lourde
  const lourde = elementaire(FEU, 'Lourd');
  const t = M.retraitsDeLArmureHorsListe(regles, fiche({ ...lanceur, armure_elementaire_id: lourde.id }));
  assert.match(ligneDeRetrait(t.retraits[0], INSTANT), new RegExp(`l’armure élémentaire « ${lourde.nom} » n’est plus portée : elle est trop lourde pour le personnage \\(Lourd, au plus Intermédiaire\\)`));
  // une armure « Familier », même au poids Lourd
  const familier = regles.armures.find((a) => a.type === 'Familier');
  const fam = M.retraitsDeLArmureHorsListe(regles, fiche({ classe: 'classes/cuirasse', armure_id: familier.id }));
  assert.deepEqual(fam.retraits.map((d) => d.nature), ['armure_familier']);
  // une fiche d'avant : l'élément devient l'armure, puis l'armure élémentaire est jugée (ici trop lourde pour un Mage)
  const avant = fiche({ classe: 'classes/mage', armure_id: inter.id, armure_amelioration_id: amelioration('armure', 1).id, armure_elementaire_id: elementaire(FEU, 'Léger').id,
    armure_parties: [{ emplacement_id: 'casque', solidite: 0 }] });
  const a = M.retraitsDeLArmureHorsListe(regles, avant);
  assert.deepEqual(a.retraits.map((d) => d.nature), ['armure_transformee', 'armure_trop_lourde']);
  assert.match(ligneDeRetrait(a.retraits[0], INSTANT), new RegExp(`l’armure « ${inter.nom.replace(/[/()]/g, '\\$&')} » \\(amélioration \\+1, solidité Casque 0\\) est devenue l’armure élémentaire « ${elementaire(FEU, 'Léger').nom} »`));
  assert.deepEqual([a.colonnes.armure_id, a.colonnes.armure_elementaire_id], [null, null]);
  // `portable` donné : il prévaut (le service le borne de même)
  assert.equal(M.retraitsDeLArmureHorsListe(regles, { ...porte, xp: xpDuNiveau(4) }, { portable: 2 }), null);
});

test('R165 (7) : les lignes du moteur sont celles du service (enregistrerFiche avec poidsPortable branché sur le moteur) — trop lourde, magie absente, « Familier », armure et élément d’avant', (t) => {
  const racine = dossierTemporaire('r165-fiche', { t });
  const vivante = ouvrirBaseVivante(preparerBaseVivante({ regles: cheminBase({ sansExemples: false }), dossier: join(racine, 'db') }).chemin);
  try {
    const poidsPortable = (base, id) => M.poidsPortable(regles, lireFiche(base, id));
    const lanceur = { classe: 'classes/lanceur', specialite: 'classes/lanceur#specialite:fantassin', niveauDeClasse: 4 };
    const inter = deBase('Intermédiaire');
    const cas = [
      ['trop lourde', fiche({ ...lanceur, armure_id: inter.id, armure_amelioration_id: amelioration('armure', 3).id, armure_parties: [{ emplacement_id: 'bras-gauche', solidite: 0 }] })],
      ['magie absente', fiche({ ...lanceur, armure_elementaire_id: elementaire('magies/magie-de-leau', 'Vêtement').id, armure_amelioration_elementaire_id: amelioration('armure_elementaire', 2).id })],
      ['Familier', fiche({ ...lanceur, armure_id: regles.armures.find((a) => a.type === 'Familier').id })],
      ['armure et élément d’avant', fiche({ ...lanceur, armure_id: deBase('Léger').id, armure_amelioration_id: amelioration('armure', 1).id,
        armure_elementaire_id: elementaire(FEU, 'Lourd').id, armure_amelioration_elementaire_id: amelioration('armure_elementaire', 5).id, armure_parties: [{ emplacement_id: 'torse', solidite: 1 }] })],
    ];
    for (const [nom, f] of cas) {
      const envoi = { ...f, nom: `Essai R165 moteur et service ${nom}`, notes: null };
      const attendu = M.retraitsDeLArmureHorsListe(regles, envoi).retraits.map((d) => ligneDeRetrait(d, INSTANT));
      const p = enregistrerFiche(vivante, envoi, { maintenant: new Date(INSTANT), poidsPortable }).personnage;
      const lue = lireFiche(vivante, p.id);
      assert.deepEqual((lue.notes ?? '').split('\n').filter((l) => l.includes(PREFIXE_DE_RETRAIT)), attendu, nom);
      assert.equal(M.retraitsDeLArmureHorsListe(regles, lue), null, `${nom} : relue, la fiche n’a plus rien à retirer`);
    }
  } finally {
    vivante.close();
  }
});
