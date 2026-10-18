// L'Acquis calculé et l'entraînement en lignes de la fiche (décision R104, migration 0062) : la lecture des bonus d'acquis dans le texte des dons
// (lib/acquis-texte.mjs), le calcul (lib/fiche-moteur.mjs : entraînement, dons, métier, accessoires, rognés au plafond de R41 dans cet ordre), les choix
// « X ou Y » et « à répartir au choix » du tiroir, et la conversion d'une fiche d'avant (lib/fiche-format.mjs).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { lecteurDAcquis } from '../src/lib/acquis-texte.mjs';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { acquisRetires, descriptionDuRetrait, entrainementEnLignes, ficheVide, ligneDeRetrait, sansPartiesRetirees } from '../src/lib/fiche-format.mjs';
import * as M from '../src/lib/fiche-moteur.mjs';
import { chargerReglesDeFiche } from '../src/lib/fiche-regles.mjs';

const db = ouvrirBase({ sansExemples: false });
const regles = JSON.parse(JSON.stringify(chargerReglesDeFiche(db))); // tel que la page le reçoit
const lire = lecteurDAcquis(regles.competences);
const RAISONS = ['situation', 'arme_choisie', 'competences_d_arme', 'choix_multiple', 'jets', 'artisanat', 'inconnue'];

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
  assert.deepEqual(ids('+7% d’acquis pour les compétences d’arme.'), ['competences_d_arme']);
  assert.deepEqual(ids('+5% Intimidation, 5% Arme lourde OU Arme légère OU Arc/Arbalète (choisir 2 sur les 3)'), ['intimidation', 'choix_multiple']);
  assert.deepEqual(ids('+5% à tout jet impliquant la perception'), ['jets']);
  assert.deepEqual(ids('+10% à tous les tests d’artisanat'), ['artisanat']);
  assert.deepEqual(ids('+15% à la falsification de documents'), ['inconnue']);
  // ce qui n'est pas un bonus de compétence : rien
  assert.deepEqual(lire('+5% de réussite critique'), []);
  assert.deepEqual(lire('+5% chance réussite crit avec des chaotiques'), [], 'Bonimenteur');
  assert.deepEqual(lire('+2 dégâts avec les armes lourdes'), []);
  assert.deepEqual(lire('+4AM, +2 points de maîtrise à répartir'), []);
  assert.deepEqual(lire(''), []);
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
      } else if (b.choix) assert.ok(b.choix.length >= 2 && new Set(b.choix).size === b.choix.length && b.choix.every((c) => competences.has(c)) && b.nombre === 1, d.id);
      else if (b.plafond) assert.ok(Number.isInteger(b.plafond) && regles.caracteristiques.some((k) => k.id === b.caracteristique_id), d.id);
      else if (!b.repartir) assert.ok(RAISONS.includes(b.raison) && b.texte, `${d.id} : ${JSON.stringify(b)}`);
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
  for (const r of [...RAISONS, 'element']) assert.match(raisons, new RegExp(`\\b${r}:`), r);
});
