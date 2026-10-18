// L'Acquis calculé et l'entraînement en lignes de la fiche (décision R104, migration 0062) : la lecture des bonus d'acquis dans le texte des dons
// (lib/acquis-texte.mjs), le calcul (lib/fiche-moteur.mjs : entraînement, dons, métier, accessoires, rognés au plafond de R41 dans cet ordre), les choix
// « X ou Y » et « à répartir au choix » du tiroir, et la conversion d'une fiche d'avant (lib/fiche-format.mjs) ; les décisions R120 à R123 : une
// compétence d'arme au choix, deux au choix (Moine Templier), le bonus au jet d'une caractéristique (hors acquis) et l'artisanat du métier.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { COMPETENCES_D_ARME, lecteurDAcquis } from '../src/lib/acquis-texte.mjs';
import { COMPETENCES_D_ARME as COMPETENCES_DES_ARMES } from '../src/lib/arme-champs.mjs';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { acquisRetires, descriptionDuRetrait, entrainementEnLignes, ficheVide, ligneDeRetrait, sansPartiesRetirees } from '../src/lib/fiche-format.mjs';
import * as M from '../src/lib/fiche-moteur.mjs';
import { chargerReglesDeFiche } from '../src/lib/fiche-regles.mjs';

const db = ouvrirBase({ sansExemples: false });
const regles = JSON.parse(JSON.stringify(chargerReglesDeFiche(db))); // tel que la page le reçoit
const lire = lecteurDAcquis(regles.competences);
const RAISONS = ['situation', 'arme_choisie', 'mj', 'inconnue'];
/** Les quatre compétences d'arme, dans l'ordre de la décision R120 (« Arc, Arbalète, Arme légère, Arme lourde »). */
const ARMES = ['arc', 'arbalete', 'arme-legere', 'arme-lourde'];

test('lecture des dons : une valeur et des compétences nommées comptent ; « X ou Y », un choix ; « à répartir au choix », une répartition ; le reste, sa raison', () => {
  const ids = (texte) => lire(texte).map((b) => b.competence_id ?? b.choix ?? (b.repartir ? 'repartir' : b.raison));
  assert.deepEqual(lire('+7% Magie, +7% Médecine'), [{ valeur: 7, competence_id: 'magie' }, { valeur: 7, competence_id: 'medecine' }]);
  assert.deepEqual(ids('+5% à la Diplomatie, Intimidation, Arme Lourde'), ['diplomatie', 'intimidation', 'arme-lourde'], 'les noms qui suivent sans valeur');
  assert.deepEqual(ids('Magie, Concentration, Survie = 5% d’acquis'), ['magie', 'concentration', 'survie']);
  assert.deepEqual(lire('- Survie, Observation et Stabilité (OU Réflexe) = 5% en acquis.\n- Les météos n’ont aucun effet négatif.'), [
    { valeur: 5, competence_id: 'survie' }, { valeur: 5, competence_id: 'observation' }, { valeur: 5, choix: ['stabilite', 'reflexe'], nombre: 1 },
  ]);
  assert.deepEqual(ids('Donne +5% à la Compétence « Arc »'), ['arc']);
  assert.deepEqual(ids('+5% Arme légère et lourde'), ['arme-legere', 'arme-lourde'], '« et lourde » reprend « arme »');
  assert.deepEqual(lire('+5% Armes légères ou lourdes'), [{ valeur: 5, choix: ['arme-legere', 'arme-lourde'], nombre: 1 }]);
  assert.deepEqual(lire('- 10% de compétence en acquis à répartir au choix.'), [{ valeur: 10, repartir: true }]);
  assert.deepEqual(ids('+5% pour toutes les compétences perception'), regles.competences.filter((k) => k.caracteristique_id === 'perception').map((k) => k.id));
  assert.deepEqual(ids('+3% à toutes les compétences de Volonté'), regles.competences.filter((k) => k.caracteristique_id === 'volonte').map((k) => k.id), 'Tenue du Flagelleur');
  assert.deepEqual(lire('+5% Magie ou Concentration'), [{ valeur: 5, choix: ['magie', 'concentration'], nombre: 1 }], 'Robe de mage');
  // le plafond relevé (Mort-vivant, Trompe-mort) : la phrase n'a pas de « % »
  assert.deepEqual(lire('Immunisé contre le poison et la maladie. Son acquis max en Social est augmenté de +20 et un petit plus de selon les conditions de la mort.'),
    [{ plafond: 20, caracteristique_id: 'social' }]);
  assert.deepEqual(ids('+5% {{magie|Magie}}'), ['magie'], 'une balise du glossaire se lit par son texte');
  // ce qui n'est pas compté, avec sa raison
  assert.deepEqual(ids('+10% esquive en l’air'), ['situation']);
  assert.deepEqual(ids('Donne +10% à tous les jets de perception et la vision nocturne aux alliés pendant 3 tours'), ['situation'], 'une action, pas un passif (Lunatique)');
  assert.deepEqual(ids('La cible aura un malus de 10% à son esquive'), ['situation']);
  assert.deepEqual(ids('+5% de la compétence de l’arme choisie, +5% Vigueur'), ['arme_choisie', 'vigueur']);
  assert.deepEqual(ids('+15% à la falsification de documents'), ['mj'], 'au MJ (décision R123)');
  // ce qui n'est pas un bonus de compétence : rien
  assert.deepEqual(lire('+5% de réussite critique'), []);
  assert.deepEqual(lire('+5% chance réussite crit avec des chaotiques'), [], 'Bonimenteur');
  assert.deepEqual(lire('+2 dégâts avec les armes lourdes'), []);
  assert.deepEqual(lire('+4AM, +2 points de maîtrise à répartir'), []);
  assert.deepEqual(lire(''), []);
});

test('lecture des dons (décisions R120 à R123) : compétences d’arme au choix, deux sur les quatre, bonus au jet d’une caractéristique, artisanat, falsification au MJ', () => {
  const ids = (texte) => lire(texte).map((b) => b.competence_id ?? b.choix ?? b.raison);
  // les compétences d'arme du lecteur sont celles qu'écrit la catégorie d'une arme (R48), dans la table `competence`
  assert.deepEqual([...COMPETENCES_D_ARME].map((nom) => regles.competences.find((k) => k.nom.toLowerCase() === nom.toLowerCase())?.id), ARMES);
  assert.deepEqual(new Set(ARMES), new Set(Object.keys(COMPETENCES_DES_ARMES)));
  // R120 : « +7% d'acquis pour les compétences d'arme. » (Mercenaire, « Polyvalence »), « +3% pour les compétences d'arme, peut porter les armures
  // lourdes, … » (Combattant libre) : une des quatre, au choix
  assert.deepEqual(lire('+7% d’acquis pour les compétences d’arme.'), [{ valeur: 7, choix: ARMES, nombre: 1 }]);
  assert.deepEqual(lire('+3% pour les compétences d\'arme, peut porter les armures lourdes, +5 points de maîtrise d\'arme à répartir (plus de 3 points dans une catégorie interdit).'),
    [{ valeur: 3, choix: ARMES, nombre: 1 }]);
  // R121 : « +5% Intimidation, 5% Arme lourde OU Arme légère OU Arc/Arbalète (choisir 2 sur les 3). » (Moine, « Templier ») : l'Intimidation compte,
  // « Arc/Arbalète » fait deux options, deux compétences au choix parmi les quatre
  assert.deepEqual(lire('+5% Intimidation, 5% Arme lourde OU Arme légère OU Arc/Arbalète (choisir 2 sur les 3). Maîtrise les 3 armures, les Boucliers 1 à 4, +2 points de maîtrise à répartir.'), [
    { valeur: 5, competence_id: 'intimidation' }, { valeur: 5, choix: ['arme-lourde', 'arme-legere', 'arc', 'arbalete'], nombre: 2 },
  ]);
  // un nom inconnu dans la liste, ou plus de compétences à choisir que d'options : aucune compétence nommée, rien n'est deviné
  assert.deepEqual(ids('5% Arme lourde OU Lance (choisir 2 sur les 3)'), ['inconnue']);
  assert.deepEqual(ids('5% Arme lourde OU Arc (choisir 2 sur les 2)'), ['inconnue']);
  // R122 : « +5% à tout jet impliquant la Perception. » (Fenrir, « Sens canin »), « - +5% à tout test d'Agilité » (Elfe forestier) : un bonus au jet
  assert.deepEqual(lire('+5% à tout jet impliquant la Perception.'), [{ valeur: 5, jet: 'perception' }]);
  assert.deepEqual(lire('- +5% à tout test d\'Agilité\n- Le matériau BOIS a ses effets triplés (3AP/AM au lieu de 1AP/AM) (Armure ou Bouclier)'), [{ valeur: 5, jet: 'agilite' }]);
  // un jet d'une situation reste une situation (Lunatique, une action)
  assert.deepEqual(ids('Donne +10% à tous les jets de Perception et la vision nocturne aux alliés pendant 3 tours'), ['situation']);
  // R123 : « - +5% à chaque test lié à l'artisanat. » (Nain, Londolor ouest), « - +10% à tous les tests d'artisanat. » (Elfe noir, Sang purifié) : la
  // compétence d'artisanat du métier ; « +15% à la falsification de documents. (Création et modification) » (Voleur, Faussaire) : au MJ
  assert.deepEqual(lire('- Peut porter une catégorie supérieure d\'armure selon les classes [aucun => léger, léger => intermédiaire, intermédiaire => lourde]\n- +5% à chaque test lié à l\'artisanat.'),
    [{ valeur: 5, artisanat: true }]);
  assert.deepEqual(lire('- +10% à tous les tests d\'artisanat.\n- Chaque soin (physique, magique, sort, objet) soigne 1 point de corruption'), [{ valeur: 10, artisanat: true }]);
  assert.deepEqual(lire('+15% à la falsification de documents. (Création et modification)'), [{ valeur: 15, raison: 'mj', texte: '+15% a la falsification de documents' }]);
});

test('lecture des dons sur toute la base : chaque bonus lu est bien formé, la plupart comptent', () => {
  const competences = new Set(regles.competences.map((k) => k.id));
  const dons = [...regles.classes.flatMap((c) => c.dons ?? []), ...regles.races.flatMap((r) => r.dons ?? []),
    ...regles.races.flatMap((r) => (r.dons_tableau?.lignes ?? []).map((l, i) => ({ ...l, id: `${r.id}#tableau:${i}` }))), ...regles.armures];
  let comptes = 0;
  for (const d of dons) {
    // (un don sans bonus d'acquis n'en porte pas la liste : regles.json reste léger)
    assert.ok(d.acquis === undefined || (Array.isArray(d.acquis) && d.acquis.length), d.id);
    for (const b of d.acquis ?? []) {
      assert.ok(b.plafond || (Number.isInteger(b.valeur) && b.valeur > 0), `${d.id} : ${JSON.stringify(b)}`);
      if (b.competence_id) {
        assert.ok(competences.has(b.competence_id), d.id);
        comptes += 1;
      } else if (b.choix) {
        assert.ok(b.choix.length >= 2 && new Set(b.choix).size === b.choix.length && b.choix.every((c) => competences.has(c)), d.id);
        assert.ok(Number.isInteger(b.nombre) && b.nombre >= 1 && b.nombre < b.choix.length, d.id);
      } else if (b.plafond) assert.ok(Number.isInteger(b.plafond) && regles.caracteristiques.some((k) => k.id === b.caracteristique_id), d.id);
      else if (b.jet) assert.ok(regles.caracteristiques.some((k) => k.id === b.jet), d.id);
      else if (!b.repartir && !b.artisanat) assert.ok(RAISONS.includes(b.raison) && b.texte, `${d.id} : ${JSON.stringify(b)}`);
    }
  }
  assert.ok(comptes > 100, `${comptes} bonus d’acquis comptés`);
});

/** Humain central, Feu inné, sans classe ; un don de race d'essai qui écrit un bonus, un choix, une répartition et un bonus de situation. */
const DON = 'races/humain#don:essai';
const r = {
  ...regles,
  races: regles.races.map((x) => (x.id !== 'races/humain' ? x : {
    ...x,
    dons: [{ id: DON, forme: 'unique', nom: 'Essai', texte: '', acquis: [
      { valeur: 7, competence_id: 'calme' }, { valeur: 5, choix: ['arc', 'parade'], nombre: 1 }, { valeur: 10, repartir: true },
      { valeur: 3, raison: 'situation', texte: '+3% calme en l’air' },
    ] }],
  })),
};
const fiche = (surcharge = {}) => ({
  ...ficheVide('Essai'), race_id: 'races/humain', ethnie_id: 'races/humain#ethnie:humain-central', magie_innee_id: 'magies/magie-du-feu', classes: [],
  caracteristiques: Object.entries({ force: 4, volonte: 2, intelligence: 2, perception: 2, social: 2, agilite: 2 }).map(([caracteristique_id, base]) => ({ caracteristique_id, base, croix: 0 })),
  ...surcharge,
});
const competence = (f, id, regles_ = r) => M.competencesDe(regles_, f).find((k) => k.id === id);

test('acquis des dons : le bonus écrit compte ; « X ou Y » et « à répartir » attendent leur choix (tiroir) ; une situation n’est pas comptée', () => {
  const a = M.acquisDesDons(r, fiche());
  assert.deepEqual([...a.parCompetence], [['calme', [{ nom: 'Essai', valeur: 7 }]]]);
  assert.deepEqual(a.choix, [
    { source: DON, rang: 1, nom: 'Essai', valeur: 5, options: ['arc', 'parade'], choisi: null, fait: false },
    { source: DON, rang: 2, nom: 'Essai', valeur: 10, repartition: true, parts: [], reste: 10, fait: false },
  ]);
  assert.deepEqual(a.nonComptes, [{ nom: 'Essai', valeur: 3, raison: 'situation', texte: '+3% calme en l’air' }]);
  assert.deepEqual(M.choixEnAttente(r, fiche()).filter((c) => c.nature === 'acquis'), [
    { nature: 'acquis', cle: `acquis:${DON}:1`, libelle: 'Acquis Essai : +5 % Arc ou Parade' },
    { nature: 'acquis', cle: `acquis:${DON}:2`, libelle: 'Acquis Essai : 10 % à répartir' },
  ]);
  // le choix fait : la compétence retenue reçoit le bonus ; une compétence hors des options ne compte pas et n'est pas gardée
  let f = fiche(M.acquisApresChoix(fiche(), DON, 1, 'parade'));
  assert.equal(competence(f, 'parade').dons, 5);
  assert.deepEqual(M.acquisChoixValables(r, f), [{ source: DON, rang: 1, competence_id: 'parade', valeur: null }]);
  f = fiche(M.acquisApresChoix(fiche(), DON, 1, 'calme'));
  assert.equal(M.acquisDesDons(r, f).choix[0].fait, false);
  assert.deepEqual(M.acquisChoixValables(r, f), []);
  assert.deepEqual(M.acquisApresChoix(fiche({ acquis_choix: [{ source: DON, rang: 1, competence_id: 'arc', valeur: null }] }), DON, 1, null), { acquis_choix: [] });
  // la répartition : les points où le joueur veut, au plus le bonus (la dernière part rognée), une compétence une fois
  f = fiche(M.acquisApresRepartition(fiche(), DON, 2, [{ competence_id: 'arc', valeur: 6 }, { competence_id: 'arc', valeur: 1 }, { competence_id: 'medecine', valeur: 9 }, { competence_id: null, valeur: 2 }]));
  const choix = M.acquisDesDons(r, f).choix[1];
  assert.deepEqual([choix.parts, choix.reste, choix.fait], [[{ competence_id: 'arc', valeur: 6 }, { competence_id: 'medecine', valeur: 4 }], 0, true]);
  assert.deepEqual([competence(f, 'arc').dons, competence(f, 'medecine').dons], [6, 4]);
  assert.deepEqual(M.acquisChoixValables(r, f), [{ source: DON, rang: 2, competence_id: 'arc', valeur: 6 }, { source: DON, rang: 2, competence_id: 'medecine', valeur: 4 }]);
  f = fiche(M.acquisApresRepartition(fiche(), DON, 2, [{ competence_id: 'arc', valeur: 4 }]));
  assert.deepEqual(M.choixEnAttente(r, f).filter((c) => c.cle === `acquis:${DON}:2`).map((c) => c.libelle), ['Acquis Essai : 6 % à répartir']);
  // un choix d'un don que la fiche n'a plus (autre ethnie) n'est pas gardé
  assert.deepEqual(M.acquisChoixValables(r, { ...f, ethnie_id: 'races/humain#ethnie:humain-desertique', race_id: 'races/elfe' }), []);
});

test('acquis calculé (décision R104) : entraînement, dons, métier, accessoire, dans cet ordre, rognés au plafond de 5 par point (R41, « le plafond prévaut » R38)', () => {
  // Volonté 2 : au plus 10 ; 8 d'entraînement + 7 du don : 10, le don rogné à 2
  const f = fiche({ entrainements: [{ rang: 1, competence_id: 'calme', valeur: 8, texte: null }] });
  const calme = competence(f, 'calme');
  assert.deepEqual([calme.plafondAcquis, calme.entrainement, calme.entrainementBrut, calme.dons, calme.donsBrut, calme.acquis, calme.acquisBrut], [10, 8, 8, 2, 7, 10, 15]);
  assert.deepEqual(calme.donsDetail, [{ nom: 'Essai', valeur: 7 }]);
  const volonte = M.caracteristiquesDe(r, f).find((c) => c.id === 'volonte').valeur;
  assert.equal(calme.score, volonte * 10 + calme.naturel + 10);
  // l'acquis n'est jamais lu dans la fiche : un « acquis » reçu n'y change rien
  assert.equal(competence({ ...f, competences: [{ competence_id: 'calme', naturel: 0, acquis: 9 }] }, 'calme').acquis, 10);
  // un vrai don de classe : son bonus compte au niveau où il est débloqué (lu dans son texte au build)
  const aUnBonus = (d) => d.niveau === 1 && d.nature === 'classe' && (d.acquis ?? []).some((b) => b.competence_id);
  const classe = regles.classes.find((c) => (c.dons ?? []).some(aUnBonus));
  const don = classe.dons.find(aUnBonus);
  const vise = don.acquis.find((b) => b.competence_id);
  const k = competence(fiche({ classes: [{ rang: 1, classe_id: classe.id, specialite_id: null }] }), vise.competence_id, regles);
  assert.ok(k.donsDetail.some((x) => x.nom === `${don.nom} (${classe.nom})` && x.valeur === vise.valeur), JSON.stringify(k.donsDetail));
});

test('entraînement en lignes (décision R104) : les points d’une compétence s’ajoutent (deux lignes, additionnées), 15 compétences et 10 points au plus ; les lignes à enregistrer', () => {
  const lignes = [
    { rang: 2, competence_id: 'arc', valeur: 4, texte: null }, { rang: 1, competence_id: null, valeur: null, texte: 'Béni par la Dame du lac' },
    { rang: 3, competence_id: 'arc', valeur: 3, texte: null }, { rang: 4, competence_id: null, valeur: null, texte: '  ' }, { rang: 5, competence_id: 'calme', valeur: -2, texte: null },
  ];
  const e = M.entrainementDe(regles, { entrainements: lignes });
  assert.deepEqual([[...e.parCompetence], e.competences, e.max, e.valeurMax], [[['arc', 7], ['calme', 0]], 1, 15, 10], 'une compétence à 0 n’est pas « montée »');
  assert.deepEqual(M.entrainementsAEnregistrer({ entrainements: lignes }), [
    { rang: 1, competence_id: null, valeur: null, texte: 'Béni par la Dame du lac' }, { rang: 2, competence_id: 'arc', valeur: 7, texte: null },
    { rang: 3, competence_id: 'calme', valeur: 0, texte: null },
  ]);
  assert.deepEqual(M.entrainementsAEnregistrer({}), []);
});

test('fiche d’avant (décision R104) : le texte d’entraînement en lignes de texte, l’acquis saisi retiré et noté, daté', () => {
  assert.deepEqual(entrainementEnLignes('  Arc +5 %\r\n\nLivre lu : Boule de feu '), [
    { rang: 1, competence_id: null, valeur: null, texte: 'Arc +5 %' }, { rang: 2, competence_id: null, valeur: null, texte: 'Livre lu : Boule de feu' },
  ]);
  assert.deepEqual([entrainementEnLignes(''), entrainementEnLignes(null)], [[], []]);
  const noms = { competence: (id) => regles.competences.find((k) => k.id === id)?.nom ?? null };
  assert.deepEqual(acquisRetires([{ competence_id: 'arc', acquis: 7 }, { competence_id: 'calme', acquis: 0 }], noms), [{ nature: 'acquis', id: 'arc', nom: 'Arc', valeur: 7 }]);
  const d = { nature: 'acquis', id: 'arc', nom: 'Arc', valeur: 7 };
  assert.equal(descriptionDuRetrait(d), 'l’acquis saisi en Arc (7)');
  assert.equal(ligneDeRetrait(d, '2026-10-18T09:00:00Z'),
    '[18/10/2026] Retrait (règles modifiées) : l’acquis saisi en Arc (7) n’est plus saisi : l’Acquis se calcule (entraînement, dons, métier, accessoires). Notez l’entraînement dans ses lignes.');
  const recue = { notes: 'Mes notes', entrainement: 'Livre lu', entrainements: [], competences: [{ competence_id: 'arc', naturel: 10, acquis: 7 }] };
  const convertie = sansPartiesRetirees(recue, { instant: '2026-10-18T09:00:00Z', noms });
  assert.deepEqual(convertie, {
    notes: `Mes notes\n${ligneDeRetrait(d, '2026-10-18T09:00:00Z')}`,
    entrainements: [{ rang: 1, competence_id: null, valeur: null, texte: 'Livre lu' }], competences: [{ competence_id: 'arc', naturel: 10 }],
  });
  assert.deepEqual(recue.competences[0].acquis, 7, 'jamais modifiée en place');
  // des lignes déjà là : le texte (vide) ne les remplace pas ; une liste vide (la fiche vide d'une page d'avant) : le texte devient ses lignes
  const lignes = [{ rang: 1, competence_id: 'arc', valeur: 2, texte: null }];
  assert.deepEqual(sansPartiesRetirees({ entrainement: '', entrainements: lignes }).entrainements, lignes);
  assert.deepEqual(sansPartiesRetirees({ entrainement: 'Livre lu', entrainements: [] }).entrainements, entrainementEnLignes('Livre lu'));
  // une ligne de compétence qui n'est pas un objet reste telle quelle (le service la refuse : 400, pas 500)
  assert.deepEqual(sansPartiesRetirees({ competences: [null, { competence_id: 'arc', naturel: 1, acquis: 0 }] }).competences, [null, { competence_id: 'arc', naturel: 1 }]);
});

test('acquis de la race, de l’armure et du plafond (décision R104) : la ligne de l’ethnie du tableau (Drakos), l’armure portée (sauf transformée : R99), le plafond relevé ; un don actif ne compte pas', () => {
  // la ligne de l'ethnie du tableau de la race : « Bonus compétence » du Drakos
  const drakos = regles.races.find((x) => (x.dons_tableau?.lignes ?? []).some((l) => (l.acquis ?? []).some((b) => b.competence_id)));
  const ligne = drakos.dons_tableau.lignes.find((l) => (l.acquis ?? []).some((b) => b.competence_id));
  const vise = ligne.acquis.find((b) => b.competence_id);
  const fd = fiche({ race_id: drakos.id, ethnie_id: ligne.ethnie_id });
  assert.ok(competence(fd, vise.competence_id, regles).donsDetail.some((d) => d.valeur === vise.valeur && d.nom === drakos.dons_tableau.titre), JSON.stringify(vise));
  // une ligne qui ne nomme pas de compétence (« 5% parmi les autres ») : listée, non comptée
  const autre = drakos.dons_tableau.lignes.find((l) => (l.acquis ?? []).some((b) => b.raison));
  if (autre) assert.ok(M.acquisDesDons(regles, fiche({ race_id: drakos.id, ethnie_id: autre.ethnie_id })).nonComptes.some((x) => x.nom === drakos.dons_tableau.titre));
  // l'armure portée : son effet compte (« Les bonus de race/classe/don/équipement vont dans la case Acquis ») ; un choix « X ou Y » va au tiroir
  const armure = regles.armures.find((a) => (a.acquis ?? []).some((b) => b.competence_id));
  const va = armure.acquis.find((b) => b.competence_id);
  const fa = fiche({ armure_id: armure.id, caracteristiques: fiche().caracteristiques.map((c) => ({ ...c, base: 4 })) });
  assert.ok(competence(fa, va.competence_id, regles).donsDetail.some((d) => d.nom === `${armure.nom} (armure)`), armure.id);
  const choix = regles.armures.find((a) => (a.acquis ?? []).some((b) => b.choix));
  assert.ok(M.acquisDesDons(regles, fiche({ armure_id: choix.id })).choix.some((c) => c.source === choix.id && c.options.length === 2), choix.id);
  // transformée par un élément (R99) : ses bonus d'origine sont perdus, listés
  const element = regles.armures_elementaires.find((x) => x.categorie === armure.type) ?? regles.armures_elementaires[0];
  const transformee = M.acquisDesDons(regles, { ...fa, armure_elementaire_id: element.id });
  assert.ok(!(transformee.parCompetence.get(va.competence_id) ?? []).some((d) => d.nom === `${armure.nom} (armure)`));
  assert.ok(transformee.nonComptes.some((x) => x.raison === 'element' && x.nom === `${armure.nom} (armure)`));
  // le plafond relevé d'une caractéristique (« Son acquis max en Social est augmenté de +20 ») : chaque compétence de la caractéristique
  const rp = { ...r, races: r.races.map((x) => (x.id !== 'races/humain' ? x : { ...x, dons: [{ id: 'races/humain#don:plafond', forme: 'unique', nom: 'Plafond', texte: '', acquis: [{ plafond: 20, caracteristique_id: 'social' }] }] })) };
  const social = regles.competences.filter((k) => k.caracteristique_id === 'social');
  for (const k of social) assert.equal(competence(fiche(), k.id, rp).plafondAcquis, competence(fiche(), k.id, regles).plafondAcquis + 20, k.id);
  assert.equal(competence(fiche(), 'calme', rp).plafondAcquis, competence(fiche(), 'calme', regles).plafondAcquis, 'les autres caractéristiques : rien');
  // un don de classe actif (« Actif : Le joueur doit déclarer le don ») ne compte pas, même s'il écrit un bonus
  const classe = regles.classes.find((c) => (c.dons ?? []).some((d) => d.niveau === 1 && d.nature === 'classe' && (d.acquis ?? []).some((b) => b.competence_id)));
  const don = classe.dons.find((d) => d.niveau === 1 && d.nature === 'classe' && (d.acquis ?? []).some((b) => b.competence_id));
  const ra = { ...regles, classes: regles.classes.map((c) => (c.id !== classe.id ? c : { ...c, dons: c.dons.map((d) => (d.id === don.id ? { ...d, type: 'actif' } : d)) })) };
  const fc = fiche({ classes: [{ rang: 1, classe_id: classe.id, specialite_id: null }] });
  const k = don.acquis.find((b) => b.competence_id).competence_id;
  assert.ok(competence(fc, k, regles).donsDetail.some((d) => d.nom.startsWith(don.nom)));
  assert.ok(!competence(fc, k, ra).donsDetail.some((d) => d.nom.startsWith(don.nom)), 'actif : non compté');
});

/** La fiche d'essai avec un don de race d'essai qui écrit `acquis` (ce que lib/acquis-texte.mjs en lit). */
const avecLeDon = (acquis) => ({ ...r, races: r.races.map((x) => (x.id !== 'races/humain' ? x : { ...x, dons: [{ id: DON, forme: 'unique', nom: 'Essai', texte: '', acquis }] })) });

test('décision R120 : « +7% d’acquis pour les compétences d’arme » est un choix du tiroir d’une des quatre compétences d’arme', () => {
  const rr = avecLeDon([{ valeur: 7, choix: ARMES, nombre: 1 }]);
  assert.deepEqual(M.acquisDesDons(rr, fiche()).choix, [{ source: DON, rang: 1, nom: 'Essai', valeur: 7, options: ARMES, choisi: null, fait: false }]);
  assert.deepEqual(M.choixEnAttente(rr, fiche()).filter((c) => c.nature === 'acquis').map((c) => c.libelle), ['Acquis Essai : +7 % Arc ou Arbalète ou Arme Légère ou Arme Lourde']);
  assert.deepEqual(M.acquisDesDons(rr, fiche()).nonComptes, [], 'plus listé non compté');
  const f = fiche(M.acquisApresChoix(fiche(), DON, 1, 'arbalete'));
  assert.equal(competence(f, 'arbalete', rr).dons, 7);
  for (const k of ['arc', 'arme-legere', 'arme-lourde']) assert.equal(competence(f, k, rr).dons, 0, `${k} : une seule au choix`);
  assert.deepEqual(M.acquisChoixValables(rr, f), [{ source: DON, rang: 1, competence_id: 'arbalete', valeur: null }]);
  assert.deepEqual(M.choixEnAttente(rr, f).filter((c) => c.nature === 'acquis'), []);
  // une compétence qui n'est pas une compétence d'arme n'est pas gardée
  assert.deepEqual(M.acquisChoixValables(rr, fiche(M.acquisApresChoix(fiche(), DON, 1, 'parade'))), []);
  // le vrai don : le Mercenaire (« Polyvalence », niveau 1, passif) le reçoit dès le niveau 1
  const classe = regles.classes.find((c) => (c.dons ?? []).some((d) => d.niveau === 1 && d.nature === 'classe' && d.type === 'passif' && (d.acquis ?? []).some((b) => b.choix?.length === 4)));
  const don = classe.dons.find((d) => d.niveau === 1 && d.nature === 'classe' && (d.acquis ?? []).some((b) => b.choix?.length === 4));
  const fc = fiche({ classes: [{ rang: 1, classe_id: classe.id, specialite_id: null }] });
  const c = M.acquisDesDons(regles, fc).choix.find((x) => x.source === don.id);
  assert.deepEqual([c.options, c.fait], [ARMES, false], don.id);
  assert.equal(competence(fiche({ ...fc, ...M.acquisApresChoix(fc, don.id, c.rang, 'arc') }), 'arc', regles).donsDetail.find((x) => x.nom.startsWith(don.nom))?.valeur, c.valeur);
});

test('décision R121 : « choisir 2 sur les 3 » (Moine Templier) : deux choix du tiroir, deux compétences différentes parmi les quatre, +5 à chacune', () => {
  const OPTIONS = ['arme-lourde', 'arme-legere', 'arc', 'arbalete'];
  // le « +5% Intimidation » du même don compte toujours ; un « X ou Y » écrit après prend le rang suivant
  const rr = avecLeDon([{ valeur: 5, competence_id: 'intimidation' }, { valeur: 5, choix: OPTIONS, nombre: 2 }, { valeur: 3, choix: ['calme', 'survie'], nombre: 1 }]);
  const groupe = (f) => M.acquisDesDons(rr, f).choix;
  assert.deepEqual(groupe(fiche()), [
    { source: DON, rang: 1, nom: 'Essai', valeur: 5, options: OPTIONS, choisi: null, fait: false, numero: 1, sur: 2, exclues: [] },
    { source: DON, rang: 2, nom: 'Essai', valeur: 5, options: OPTIONS, choisi: null, fait: false, numero: 2, sur: 2, exclues: [] },
    { source: DON, rang: 3, nom: 'Essai', valeur: 3, options: ['calme', 'survie'], choisi: null, fait: false },
  ]);
  assert.equal(competence(fiche(), 'intimidation', rr).dons, 5);
  assert.deepEqual(M.choixEnAttente(rr, fiche()).filter((c) => c.nature === 'acquis').map((c) => c.libelle), [
    'Acquis Essai : +5 % Arme Lourde ou Arme Légère ou Arc ou Arbalète (choix 1 sur 2)', 'Acquis Essai : +5 % Arme Lourde ou Arme Légère ou Arc ou Arbalète (choix 2 sur 2)',
    'Acquis Essai : +3 % Calme ou Survie',
  ]);
  // le premier choix fait : le second ne propose plus sa compétence
  let f = fiche(M.acquisApresChoix(fiche(), DON, 1, 'arc'));
  assert.deepEqual(groupe(f).slice(0, 2).map((c) => [c.choisi, c.fait, c.exclues]), [['arc', true, []], [null, false, ['arc']]]);
  assert.deepEqual(M.choixEnAttente(rr, f).filter((c) => c.nature === 'acquis').map((c) => c.libelle).slice(0, 1), ['Acquis Essai : +5 % Arme Lourde ou Arme Légère ou Arbalète (choix 2 sur 2)']);
  // la même compétence deux fois : le second choix n'est pas fait, ne compte pas et n'est pas gardé
  f = fiche(M.acquisApresChoix(f, DON, 2, 'arc'));
  assert.deepEqual([groupe(f)[1].fait, competence(f, 'arc', rr).dons], [false, 5]);
  assert.deepEqual(M.acquisChoixValables(rr, f), [{ source: DON, rang: 1, competence_id: 'arc', valeur: null }]);
  // deux compétences différentes : +5 à chacune ; chaque liste exclut celle de l'autre
  f = fiche(M.acquisApresChoix(f, DON, 2, 'arme-lourde'));
  assert.deepEqual(groupe(f).slice(0, 2).map((c) => [c.choisi, c.fait, c.exclues]), [['arc', true, ['arme-lourde']], ['arme-lourde', true, ['arc']]]);
  assert.deepEqual([competence(f, 'arc', rr).dons, competence(f, 'arme-lourde', rr).dons, competence(f, 'arme-legere', rr).dons], [5, 5, 0]);
  assert.deepEqual(M.acquisChoixValables(rr, f), [
    { source: DON, rang: 1, competence_id: 'arc', valeur: null }, { source: DON, rang: 2, competence_id: 'arme-lourde', valeur: null },
  ]);
  // le vrai don : la spécialité Templier du Moine, au niveau 10
  const classe = regles.classes.find((c) => (c.dons ?? []).some((d) => (d.acquis ?? []).some((b) => b.nombre === 2)));
  const don = classe.dons.find((d) => (d.acquis ?? []).some((b) => b.nombre === 2));
  const fc = fiche({ classes: [{ rang: 1, classe_id: classe.id, specialite_id: don.specialite_id }] });
  const fn = { ...fc, xp: regles.niveaux.find((n) => M.niveauxDeClasse(regles, n.niveau, fc.mode_classe).classe1 >= don.niveau).xp_min };
  const choix = M.acquisDesDons(regles, fn).choix.filter((x) => x.source === don.id);
  assert.deepEqual(choix.map((c) => [c.rang, c.options, c.sur]), [[1, OPTIONS, 2], [2, OPTIONS, 2]], don.id);
  assert.ok(competence(fn, 'intimidation', regles).donsDetail.some((x) => x.nom.startsWith(don.nom) && x.valeur === 5), 'le « +5% Intimidation » compte');
});

test('décision R122 : « +5% à tout jet impliquant la Perception » : un bonus au score de chaque compétence de la caractéristique, hors acquis et hors plafond', () => {
  const rr = avecLeDon([{ valeur: 5, jet: 'perception' }]);
  const perception = regles.competences.filter((k) => k.caracteristique_id === 'perception').map((k) => k.id);
  // l'acquis au plafond (Perception 2 : 10) : le bonus au jet passe quand même
  const f = fiche({ entrainements: [{ rang: 1, competence_id: 'observation', valeur: 10, texte: null }] });
  for (const id of perception) {
    const avec = competence(f, id, rr);
    const sans = competence(f, id, regles);
    assert.deepEqual([avec.acquis, avec.plafondAcquis, avec.jet, avec.score], [sans.acquis, sans.plafondAcquis, 5, sans.score + 5], id);
    assert.deepEqual(avec.jetDetail, [{ nom: 'Essai', valeur: 5 }], id);
    assert.equal(avec.scoreDuMoment, avec.score + avec.posture, id);
  }
  assert.equal(competence(f, 'observation', rr).acquis, 10, 'l’acquis reste au plafond');
  for (const k of regles.competences.filter((x) => x.caracteristique_id !== 'perception')) assert.equal(competence(f, k.id, rr).jet, 0, k.id);
  assert.deepEqual(M.acquisDesDons(rr, f).nonComptes, [], 'plus listé non compté');
  // deux croix : la compétence reste inutilisable
  const croix = fiche({ caracteristiques: fiche().caracteristiques.map((c) => (c.caracteristique_id === 'perception' ? { ...c, croix: 2 } : c)) });
  assert.equal(competence(croix, 'observation', rr).score, null);
  // les vrais dons : le Fenrir (« Sens canin ») et les deux ethnies de l'Elfe forestier, lus au build
  const sens = regles.classes.flatMap((c) => (c.dons ?? []).map((d) => ({ c, d }))).find(({ d }) => (d.acquis ?? []).some((b) => b.jet === 'perception'));
  const fc = fiche({ classes: [{ rang: 1, classe_id: sens.c.id, specialite_id: null }] });
  const xp = regles.niveaux.find((n) => M.niveauxDeClasse(regles, n.niveau, fc.mode_classe).classe1 >= sens.d.niveau).xp_min;
  const k = competence({ ...fc, xp }, 'observation', regles);
  assert.ok(k.jetDetail.some((x) => x.nom === `${sens.d.nom} (${sens.c.nom})` && x.valeur === 5), JSON.stringify(k.jetDetail));
  const agilite = regles.races.flatMap((x) => (x.dons ?? []).map((d) => ({ race: x, d }))).filter(({ d }) => (d.acquis ?? []).some((b) => b.jet === 'agilite'));
  assert.ok(agilite.length >= 2, 'les deux ethnies de l’Elfe forestier');
  for (const { race, d } of agilite) {
    const e = competence(fiche({ race_id: race.id, ethnie_id: d.ethnie_id }), 'esquive', regles);
    assert.ok(e.jet >= 5 && e.jetDetail.length, d.id);
  }
});

test('décision R123 : les bonus d’artisanat des dons s’ajoutent à la compétence d’artisanat du métier ; rien sans métier ; la falsification de documents au MJ', () => {
  const metier = { id: 'metiers/essai', nom: 'Essai', bonus: [], objets: [], artisanat: { texte: 'Fabrique', caracteristiques: ['force', 'intelligence'] } };
  const rr = { ...avecLeDon([{ valeur: 10, artisanat: true }, { valeur: 15, raison: 'mj', texte: '+15% a la falsification de documents' }]), metiers: [...regles.metiers, metier, { ...metier, id: 'metiers/sans', artisanat: null }] };
  // Force 4, Intelligence 2 : 40 + 20, +10 du don
  const a = M.artisanatDe(rr, fiche({ metier_id: metier.id }));
  assert.deepEqual([a.score, a.bonus], [70, [{ nom: 'Essai', valeur: 10 }]]);
  assert.deepEqual(M.acquisDesDons(rr, fiche({ metier_id: metier.id })).nonComptes, [{ nom: 'Essai', valeur: 15, raison: 'mj', texte: '+15% a la falsification de documents' }]);
  // aucune compétence n'en reçoit rien
  for (const k of M.competencesDe(rr, fiche({ metier_id: metier.id }))) assert.equal(k.dons + k.jet, 0, k.id);
  // deux croix : inutilisable, le bonus n'y change rien
  const croix = fiche({ metier_id: metier.id, caracteristiques: fiche().caracteristiques.map((c) => (c.caracteristique_id === 'force' ? { ...c, croix: 2 } : c)) });
  assert.deepEqual([M.artisanatDe(rr, croix).score, M.artisanatDe(rr, croix).inutilisable], [null, true]);
  // sans métier, ou un métier sans artisanat : rien, et le bonus est listé non compté
  for (const metier_id of [null, 'metiers/sans']) {
    assert.equal(M.artisanatDe(rr, fiche({ metier_id })), null);
    assert.deepEqual(M.acquisDesDons(rr, fiche({ metier_id })).nonComptes[0], { nom: 'Essai', valeur: 10, raison: 'sans_artisanat', texte: null });
  }
  // les vrais dons : le Nain de Londolor ouest et l'Elfe noir Sang purifié, avec un métier de la base qui a un artisanat
  const avecArtisanat = regles.metiers.find((m) => m.artisanat?.caracteristiques.length === 2);
  const dons = regles.races.flatMap((x) => (x.dons ?? []).map((d) => ({ race: x, d }))).filter(({ d }) => (d.acquis ?? []).some((b) => b.artisanat));
  assert.ok(dons.length >= 2, 'Londolor ouest et Sang purifié');
  for (const { race, d } of dons) {
    const valeur = d.acquis.find((b) => b.artisanat).valeur;
    const f = fiche({ race_id: race.id, ethnie_id: d.ethnie_id, metier_id: avecArtisanat.id });
    const sans = M.artisanatDe(regles, { ...f, race_id: 'races/humain', ethnie_id: 'races/humain#ethnie:humain-central' });
    const avec = M.artisanatDe(regles, f);
    assert.ok(avec.bonus.some((b) => b.valeur === valeur), d.id);
    assert.equal(avec.score - avec.bonus.reduce((t, b) => t + b.valeur, 0), avec.caracteristiques.reduce((t, c) => t + c.points, 0), d.id);
    assert.deepEqual(sans.bonus, [], 'l’Humain central n’en a pas');
  }
});

test('la page (src/scripts/fiche.mjs, lue comme un texte) : les lignes d’entraînement se relient à une fiche relue ; les ajouts relisent la fiche au clic ; chaque raison d’un bonus non compté a son libellé', () => {
  const script = readFileSync(new URL('../src/scripts/fiche.mjs', import.meta.url), 'utf8');
  const corps = script.slice(script.indexOf('function construireEntrainement()'), script.indexOf('function construireAcquisAChoisir()'));
  // une fiche relue (enregistrement, rechargement, import) remplace ses objets : la clé des lignes porte versionInventaire, comme l'inventaire
  assert.match(corps, /const cle = JSON\.stringify\(\[versionInventaire, /);
  // « + Compétence » et « + Livre de sort » cherchent la compétence libre et le sort sans livre au moment du clic
  assert.match(corps, /onclick: \(\) => \{ const k = libre\(\);/);
  assert.match(corps, /onclick: \(\) => \{ const j = sansLivre\(\);/);
  // les raisons que rend le lecteur (et la pièce élémentaire, R99) ont toutes un libellé dans la page
  const raisons = script.slice(script.indexOf('const RAISONS_DE_L_ACQUIS = {'), script.indexOf('};', script.indexOf('const RAISONS_DE_L_ACQUIS = {')));
  for (const r of [...RAISONS, 'element', 'sans_artisanat']) assert.match(raisons, new RegExp(`\\b${r}:`), r);
});
