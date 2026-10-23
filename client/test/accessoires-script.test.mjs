// Le script de l'onglet Accessoires de /ressources/equipement/ (src/scripts/accessoires.mjs), exécuté dans un faux navigateur, pour la malédiction
// (décision R94 : « Si à n'importe quel étape "Malédiction" est choisi, on relance tout l'item à partir de l'étape 2 (on garde le même emplacement) Dans
// le 2em roll si on retombe à nouveau sur "Malédiction", l'objet est DETRUIT et tombe en poussière. ») : « Tirer un accessoire » relance depuis l'étape 2
// avec le même emplacement et détruit à la seconde malédiction ; le dé d'un tableau suit la même transition (lib/accessoires-generateur.mjs#apresUnJet),
// un clic jamais ; le dé de l'étape 1, ou un dé jeté sur un accessoire détruit, commence un nouvel accessoire ; le dé de l'étape 2 retire un effet
// « MALÉDICTION » ; « détruit » se lève dès qu'une ligne qui n'est pas une malédiction est choisie, en décochant « Maudit » ou par « Tout effacer » ;
// l'encart d'un accessoire détruit montre la monture choisie à la main ; l'adresse est lue telle quelle. Aussi : le dé des compétences (1d6 puis
// 1d20) et le dé d'acquis d'une ligne (la ligne choisie, son bonus, la monture d'office). La règle elle-même : test/accessoires-generateur.test.mjs.
//   node --test test/accessoires-script.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { cliquer, el, Element, fauxDocument } from './aide-faux-dom.mjs';

let numero = 0;
let pageOuverte = null;

/** Un tableau des étapes, réduit à ce que le script lit : le dé (`faces`, et `bonus` pour les compétences) et ses lignes. */
const tableau = (de, ...lignes) =>
  el('table', {}, el('thead', {}, el('tr', {}, el('th', {}, el('button', de, el('span', { 'data-de-resultat': '' }))))), el('tbody', {}, ...lignes));
const ligne = (attributs, ...cases) => el('tr', attributs, el('th', {}, el('button', { class: 'acc-choisir' })), ...cases);
// la classe de la couleur d'un niveau, telle que la page la pose (lib/palette-css.mjs#classeDeNiveau) : le script la reprend, jamais une couleur
const NIVEAU = { 1: 'couleur-niveau-1', 2: 'couleur-niveau-2' };

/**
 * La page à l'adresse `recherche` : Identité 1d4 (Anneau 1-2, Collier 3-4) ; Propriété 1d100 (Attaque 1-60, Compétence 61-95, Malédiction 96-100) ;
 * Attaque 1d20 (« Dégâts physiques +2 » 1-9, « MALÉDICTION » 10-20) ; Compétence 1d6 puis 1d20 (Compétence Force au jet 1 : niveau 1 de 1 à 10 %,
 * niveau 2 de 11 à 20 %, son dé d'acquis) ; Monture, niveaux 1 et 2. Rend les lignes, l'encart et l'adresse écrite (`adresse()`, comme en quittant la
 * page).
 */
async function charger(recherche = '') {
  // la page d'avant écrit son adresse et oublie son écriture en attente (sinon elle écrirait dans celle-ci)
  pageOuverte?.dispatchEvent(new Event('pagehide'));
  const niveaux = [
    { valeur: 'competence:force:1', niveau: 1, min: 1, max: 10, brut: 'Niveau 1', prix: '10 Ro', classe: NIVEAU[1] },
    { valeur: 'competence:force:2', niveau: 2, min: 11, max: 20, brut: 'Niveau 2', prix: '20 Ro', classe: NIVEAU[2] },
  ];
  const acquisDe = el('button', { 'data-acc-acquis-de': '20' });
  const r = {
    anneau: ligne({ 'data-choix': 'emplacement', 'data-valeur': 'anneau', 'data-min': '1', 'data-max': '2', 'data-libelle': 'Anneau' }),
    collier: ligne({ 'data-choix': 'emplacement', 'data-valeur': 'collier', 'data-min': '3', 'data-max': '4', 'data-libelle': 'Collier' }),
    attaque: ligne({ 'data-choix': 'propriete', 'data-valeur': 'attaque', 'data-min': '1', 'data-max': '60', 'data-libelle': 'Attaque' }),
    competence: ligne({ 'data-choix': 'propriete', 'data-valeur': 'competence', 'data-min': '61', 'data-max': '95', 'data-libelle': 'Compétence' }),
    malediction: ligne({ 'data-choix': 'propriete', 'data-valeur': 'malediction', 'data-min': '96', 'data-max': '100', 'data-libelle': 'Malédiction', 'data-malediction': '1' }),
    degats: ligne({ class: NIVEAU[1], 'data-choix': 'effet', 'data-valeur': 'attaque:1', 'data-propriete': 'attaque', 'data-min': '1', 'data-max': '9', 'data-niveau': '1', 'data-niveau-brut': 'Niveau 1',
      'data-libelle': 'Dégâts physiques +2', 'data-prix': '29 Ro' }),
    maudite: ligne({ 'data-choix': 'effet', 'data-valeur': 'attaque:10', 'data-propriete': 'attaque', 'data-min': '10', 'data-max': '20', 'data-libelle': 'MALÉDICTION', 'data-malediction': '1' }),
    force: ligne({ class: NIVEAU[1], 'data-choix': 'effet', 'data-valeur': 'competence:force:1', 'data-propriete': 'competence', 'data-jet': '1', 'data-acquis': '1', 'data-niveau': '1',
      'data-niveau-brut': 'Niveau 1', 'data-libelle': 'Compétence Force', 'data-prix': '10 Ro', 'data-niveaux': JSON.stringify(niveaux) },
    el('td', {}, el('input', { 'data-acc-acquis': '' }), el('input', { 'data-acc-acquis-saisie': '' }), acquisDe),
    el('td', {}, el('span', { 'data-acc-niveau': '' })), el('td', {}, el('span', { 'data-acc-prix': '' }))),
    monture1: ligne({ class: NIVEAU[1], 'data-choix': 'monture', 'data-valeur': '1', 'data-niveau': '1', 'data-libelle': 'Cuivre', 'data-prix': '5 Ro', 'data-prix-ro': '5', 'data-effet': 'Aucun' }),
    monture2: ligne({ class: NIVEAU[2], 'data-choix': 'monture', 'data-valeur': '2', 'data-niveau': '2', 'data-libelle': 'Argent', 'data-prix': '15 Ro', 'data-prix-ro': '15', 'data-effet': 'Aucun' }),
  };
  const sections = {
    emplacements: el('section', { 'data-table': 'emplacement' }, tableau({ 'data-de': '4' }, r.anneau, r.collier)),
    proprietes: el('section', { 'data-table': 'propriete' }, tableau({ 'data-de': '100' }, r.attaque, r.competence, r.malediction)),
    effets: el('section', { class: 'acc-famille', 'data-propriete': 'attaque', 'data-table': 'effet' }, tableau({ 'data-de': '20' }, r.degats, r.maudite)),
    competences: el('section', { class: 'acc-famille', 'data-propriete': 'competence', 'data-table': 'effet' }, tableau({ 'data-de': '6', 'data-de-bonus': '20' }, r.force)),
    montures: el('section', { 'data-table': 'monture' }, el('table', {}, el('tbody', {}, r.monture1, r.monture2))),
  };
  // ni `style` ni getComputedStyle : le script ne lit ni ne pose aucune couleur, seulement les classes des lignes
  const produit = el('div', { class: 'acc-produit', 'data-acc-produit': '' });
  const tirerTout = el('button', { 'data-acc-tout-tirer': '' });
  const effacer = el('button', { 'data-acc-effacer': '' });
  const racine = el('div', { 'data-accessoires': '' }, tirerTout, effacer, ...Object.values(sections), produit);
  let url = new URL(`/ressources/equipement/${recherche}#accessoires`, 'http://site/');
  const fenetre = new EventTarget();
  pageOuverte = fenetre;
  Object.assign(globalThis, {
    document: fauxDocument(el('section', { class: 'equipement-panneau', id: 'accessoires' }, racine)),
    Element,
    HTMLInputElement: Element,
    addEventListener: fenetre.addEventListener.bind(fenetre),
    location: { get pathname() { return url.pathname; }, get search() { return url.search; }, get hash() { return url.hash; } },
    history: { state: null, replaceState: (_, __, a) => (url = new URL(a, url)) },
  });
  await import(`../src/scripts/accessoires.mjs?page=${(numero += 1)}`);
  const de = (section) => section.querySelector('[data-de]');
  const clic = (x) => cliquer(x, racine);
  const classes = () => ({ maudit: produit.classList.contains('est-maudit'), detruit: produit.classList.contains('est-detruit') });
  /** Les classes de couleur d'un élément (`couleur-…`). */
  const couleurs = (x) => [...x.classList].filter((c) => c.startsWith('couleur-'));
  return {
    ...r,
    sections,
    produit,
    classes,
    couleurs,
    encart: () => produit.innerHTML,
    jet: (section) => de(section).querySelector('[data-de-resultat]').textContent,
    /** Le dé d'un tableau (`de1`, `de2`, `de3` : Attaque, `deCompetence`), le dé d'acquis de la ligne Compétence Force. */
    de1: () => clic(de(sections.emplacements)),
    de2: () => clic(de(sections.proprietes)),
    de3: () => clic(de(sections.effets)),
    deCompetence: () => clic(de(sections.competences)),
    deAcquis: () => clic(acquisDe),
    tirerTout: () => clic(tirerTout),
    effacer: () => clic(effacer),
    cliquer: clic,
    /** La case « Maudit » de l'encart, cochée ou décochée (l'encart est du HTML que le faux navigateur ne lit pas : la case est refaite). */
    maudit: (coche) => {
      const c = el('input', { 'data-acc-maudit': '' });
      c.checked = coche;
      const ev = new Event('change');
      Object.defineProperty(ev, 'target', { value: c });
      racine.dispatchEvent(ev);
    },
    adresse: () => {
      fenetre.dispatchEvent(new Event('pagehide'));
      return url.search;
    },
  };
}

/**
 * Les jets du hasard (Math.random), dans l'ordre. Un jet de trop ne lève rien (l'erreur partirait d'un écouteur d'évènement, loin du test) : il rend
 * 0 et se compte, et l'assertion vient après l'appel.
 */
function avecLesJets(jets, f) {
  const hasard = Math.random;
  const reste = [...jets];
  let enTrop = 0;
  Math.random = () => {
    if (reste.length) return reste.shift();
    enTrop += 1;
    return 0;
  };
  try {
    f();
  } finally {
    Math.random = hasard;
  }
  assert.equal(enTrop, 0, 'pas de jet de trop');
  assert.deepEqual(reste, [], 'tous les jets prévus ont été lancés');
}
// lancer(faces) = 1 + ⌊hasard × faces⌋
const D4 = { anneau: 0, collier: 0.5 };
const D100 = { attaque: 0.5, competence: 0.7, malediction: 0.97 };
const D20 = { degats: 0, malediction: 0.5 };

/** Un accessoire détruit au dé (Collier, Attaque, MALÉDICTION, puis Malédiction) : la propriété Malédiction choisie. */
function detruire(p) {
  avecLesJets([D4.collier, D100.attaque, D20.malediction, D100.malediction], p.tirerTout);
  assert.deepEqual(p.classes(), { maudit: true, detruit: true });
}

test('« Tirer un accessoire » : une malédiction rend maudit et relance depuis l’étape 2, l’emplacement tiré une seule fois', async () => {
  const p = await charger();
  avecLesJets([D4.anneau, D100.malediction, D100.attaque, D20.degats], p.tirerTout);
  assert.equal(p.jet(p.sections.emplacements), '1', 'l’identité : un seul jet');
  assert.equal(p.jet(p.sections.proprietes), '51', 'le jet de la relance');
  assert.ok(p.anneau.classList.contains('est-choisi') && p.degats.classList.contains('est-choisi'));
  assert.deepEqual(p.classes(), { maudit: true, detruit: false });
  assert.match(p.encart(), /Anneau · Niveau 1 · <strong>Maudit<\/strong>/);
  assert.match(p.encart(), /Accessoire maudit : l’effet est le contraire/);
  assert.equal(p.adresse(), '?emplacement=anneau&propriete=attaque&effet=attaque%3A1&maudit=1');
});

test('« Tirer un accessoire » : une seconde malédiction détruit l’accessoire, sans troisième tirage ; l’encart le dit', async () => {
  const p = await charger();
  detruire(p);
  const encart = p.encart();
  assert.match(encart, /Collier · <strong>Détruit<\/strong>/, 'l’emplacement gardé');
  assert.match(encart, /<h2 class="acc-produit__titre">Accessoire détruit<\/h2>/);
  assert.match(encart, /<dt>Propriété<\/dt><dd>Malédiction<\/dd>/);
  assert.match(encart, /Seconde malédiction : l’accessoire est détruit et tombe en poussière\./);
  for (const absent of ['<dt>Niveau', '<dt>Gemmes', '<dt>Monture', '<dt>Prix', 'Maudit</strong>']) assert.ok(!encart.includes(absent), absent);
  // l'encart relu (innerHTML, comme un navigateur : test/aide-faux-dom.mjs) écrit un attribut sans valeur `checked=""`
  assert.match(encart, /data-acc-maudit(?:="")? checked(?:="")?[ >]/, 'la case « Maudit » reste, pour tout lever');
  assert.equal(p.adresse(), '?emplacement=collier&propriete=malediction&maudit=1&detruit=1');
  // « Tirer un accessoire » repart de zéro
  avecLesJets([D4.anneau, D100.attaque, D20.degats], p.tirerTout);
  assert.deepEqual(p.classes(), { maudit: false, detruit: false });
  assert.equal(p.adresse(), '?emplacement=anneau&propriete=attaque&effet=attaque%3A1');
});

test('le dé d’un tableau : une malédiction rend maudit (relancer depuis l’étape 2), une seconde détruit ; choisir une autre ligne lève « détruit »', async () => {
  const p = await charger();
  avecLesJets([D100.malediction], p.de2);
  assert.deepEqual(p.classes(), { maudit: true, detruit: false });
  assert.match(p.encart(), /Malédiction : relancez les dés depuis l’étape 2, avec le même emplacement/);
  avecLesJets([D100.malediction], p.de2);
  assert.deepEqual(p.classes(), { maudit: true, detruit: true }, 'deux jets de malédiction');
  p.cliquer(p.anneau);
  assert.ok(p.classes().detruit, 'un clic sur l’emplacement ne change rien');
  p.cliquer(p.degats);
  assert.deepEqual(p.classes(), { maudit: true, detruit: false }, 'un clic sur un effet qui n’est pas une malédiction : reste maudit');
  avecLesJets([D20.malediction], p.de3);
  assert.deepEqual(p.classes(), { maudit: true, detruit: true }, 'déjà maudit : la malédiction tirée à l’étape 3 le détruit');
  assert.equal(p.adresse(), '?emplacement=anneau&propriete=attaque&effet=attaque%3A10&maudit=1&detruit=1');
  p.cliquer(p.maudite);
  assert.ok(!p.classes().detruit, 'la ligne de malédiction retirée : plus de malédiction choisie');
  p.effacer();
  assert.equal(p.adresse(), '');
});

test('un dé jeté sur un accessoire détruit commence un nouvel accessoire (étape 2, 3 ou 1) : il ne revient jamais', async () => {
  let p = await charger();
  detruire(p);
  avecLesJets([D100.attaque], p.de2);
  assert.deepEqual(p.classes(), { maudit: false, detruit: false }, 'dé 2 → Attaque : un accessoire neuf');
  assert.equal(p.adresse(), '?emplacement=collier&propriete=attaque', 'l’emplacement reste, il n’est pas relancé');
  avecLesJets([D100.malediction], p.de2);
  assert.deepEqual(p.classes(), { maudit: true, detruit: false }, 'puis une malédiction : maudit seulement');

  p = await charger();
  detruire(p);
  avecLesJets([D20.degats], p.de3);
  assert.deepEqual(p.classes(), { maudit: false, detruit: false }, 'dé 3 → un effet : un accessoire neuf, pas un maudit complet');
  assert.equal(p.adresse(), '?emplacement=collier&propriete=attaque&effet=attaque%3A1');
  detruire(p);
  avecLesJets([D20.malediction], p.de3);
  assert.deepEqual(p.classes(), { maudit: true, detruit: false }, 'dé 3 → MALÉDICTION : maudit seulement');

  p = await charger();
  detruire(p);
  avecLesJets([D4.anneau], p.de1);
  assert.deepEqual(p.classes(), { maudit: false, detruit: false }, 'dé 1 : un autre accessoire');
  assert.equal(p.adresse(), '?emplacement=anneau&propriete=malediction', 'rien d’autre ne change');
  assert.match(p.encart(), /relancez les dés depuis l’étape 2/);
  // un clic ne commence pas d'accessoire : détruit ne tombe que si plus aucune malédiction n'est choisie
  detruire(p);
  p.cliquer(p.malediction);
  assert.deepEqual(p.classes(), { maudit: true, detruit: false }, 'la propriété Malédiction retirée');
});

test('le dé de l’étape 1 commence un nouvel accessoire : maudit, puis dé 1, puis Malédiction au dé 2 ⇒ maudit seulement', async () => {
  const p = await charger();
  avecLesJets([D4.anneau, D100.malediction, D100.attaque, D20.degats], p.tirerTout);
  assert.deepEqual(p.classes(), { maudit: true, detruit: false });
  p.cliquer(p.monture2);
  avecLesJets([D4.collier], p.de1);
  assert.deepEqual(p.classes(), { maudit: false, detruit: false });
  assert.equal(p.adresse(), '?emplacement=collier&propriete=attaque&effet=attaque%3A1&monture=2', 'propriété, effet et monture restent');
  avecLesJets([D100.malediction], p.de2);
  assert.deepEqual(p.classes(), { maudit: true, detruit: false });
});

test('le dé de l’étape 2 retire un effet MALÉDICTION choisi ; un autre effet de la même propriété reste', async () => {
  const p = await charger();
  p.cliquer(p.maudite);
  assert.deepEqual(p.classes(), { maudit: true, detruit: false });
  avecLesJets([D100.attaque], p.de2);
  assert.ok(!p.maudite.classList.contains('est-choisi') && p.attaque.classList.contains('est-choisi'));
  assert.deepEqual(p.classes(), { maudit: true, detruit: false });
  assert.ok(!p.encart().includes('relancez'), 'plus de malédiction choisie');
  assert.match(p.encart(), /Accessoire maudit : l’effet est le contraire/);
  assert.equal(p.adresse(), '?propriete=attaque&maudit=1');
  p.cliquer(p.degats);
  avecLesJets([D100.attaque], p.de2);
  assert.ok(p.degats.classList.contains('est-choisi'), 'un effet qui n’est pas une malédiction reste');
});

test('accessoire détruit : la monture choisie à la main est dans l’encart, celle d’office non', async () => {
  let p = await charger();
  p.cliquer(p.monture2);
  avecLesJets([D100.malediction], p.de2);
  avecLesJets([D100.malediction], p.de2);
  assert.deepEqual(p.classes(), { maudit: true, detruit: true });
  assert.match(p.encart(), /<dt>Monture<\/dt><dd>Argent <span class="acc-produit__sous">Niveau 2 · /);
  assert.ok(!p.encart().includes('celle du niveau de l’effet'));
  p = await charger();
  p.cliquer(p.degats);
  assert.ok(p.monture1.classList.contains('est-choisi'), 'la monture d’office (niveau de l’effet)');
  avecLesJets([D20.malediction], p.de3);
  avecLesJets([D20.malediction], p.de3);
  assert.deepEqual(p.classes(), { maudit: true, detruit: true });
  assert.ok(!p.encart().includes('<dt>Monture'));
});

test('un clic sur une ligne de malédiction rend maudit, jamais détruit ; la case « Maudit » cochée fait détruire au prochain jet, décochée lève tout', async () => {
  const p = await charger();
  p.cliquer(p.malediction);
  p.cliquer(p.maudite);
  p.cliquer(p.malediction);
  assert.deepEqual(p.classes(), { maudit: true, detruit: false }, 'trois clics ne sont pas des jets');
  p.effacer();
  p.maudit(true);
  avecLesJets([D100.malediction], p.de2);
  assert.deepEqual(p.classes(), { maudit: true, detruit: true }, 'maudit par la case, puis une malédiction tirée');
  p.maudit(false);
  assert.deepEqual(p.classes(), { maudit: false, detruit: false });
  assert.equal(p.adresse(), '?propriete=malediction');
});

test('compétences : le dé du tableau (1d6 puis 1d20) et le dé d’acquis choisissent la ligne, règlent son bonus et la monture d’office', async () => {
  const p = await charger();
  avecLesJets([0, 0.6], p.deCompetence);
  assert.equal(p.jet(p.sections.competences), '1 · 13');
  assert.ok(p.force.classList.contains('est-choisi') && p.competence.classList.contains('est-choisi'));
  assert.equal(p.force.dataset.niveau, '2', 'le bonus 13 % : niveau 2');
  assert.ok(p.monture2.classList.contains('est-choisi'), 'la monture du niveau');
  assert.match(p.encart(), /Bonus d’acquis : <strong>13 %<\/strong>/);
  assert.match(p.encart(), /celle du niveau de l’effet/);
  assert.equal(p.adresse(), '?propriete=competence&effet=competence%3Aforce%3A2&acquis=13');
  avecLesJets([0.2], p.deAcquis);
  assert.equal(p.jet(p.sections.competences), '', 'le jet du tableau ne décrit plus la ligne');
  assert.ok(p.monture1.classList.contains('est-choisi'));
  assert.equal(p.adresse(), '?propriete=competence&effet=competence%3Aforce%3A1&acquis=5');
  // le dé d'acquis compte pour l'étape 3 : sur un accessoire détruit, un accessoire neuf
  avecLesJets([D100.malediction], p.de2);
  avecLesJets([D100.malediction], p.de2);
  assert.deepEqual(p.classes(), { maudit: true, detruit: true });
  avecLesJets([0.9], p.deAcquis);
  assert.deepEqual(p.classes(), { maudit: false, detruit: false });
  assert.equal(p.adresse(), '?propriete=competence&effet=competence%3Aforce%3A2&acquis=19');
});

test('couleurs des niveaux : la ligne et l’encart portent la classe du niveau (reprise de la ligne choisie, ou de data-niveaux), jamais un style', async () => {
  let p = await charger();
  assert.deepEqual(p.couleurs(p.produit), [], 'rien de choisi : pas de couleur');
  p.cliquer(p.degats);
  assert.deepEqual(p.couleurs(p.produit), [NIVEAU[1]], 'l’encart : la classe de la ligne de l’effet');
  // la monture d'office ne colore pas l'encart : la couleur est celle de l'effet
  p.cliquer(p.monture2);
  assert.deepEqual(p.couleurs(p.produit), [NIVEAU[1]]);
  // une compétence : le bonus d'acquis donne le niveau, la ligne prend la classe de ce niveau (data-niveaux), à la place de la sienne, et l'encart la suit
  avecLesJets([0, 0.6], p.deCompetence);
  assert.deepEqual([p.couleurs(p.force), p.couleurs(p.produit)], [[NIVEAU[2]], [NIVEAU[2]]], '13 % : niveau 2');
  avecLesJets([0.2], p.deAcquis);
  assert.deepEqual([p.couleurs(p.force), p.couleurs(p.produit)], [[NIVEAU[1]], [NIVEAU[1]]], '5 % : niveau 1');
  assert.ok(p.force.classList.contains('est-choisi'), 'les autres classes de la ligne restent');
  // un effet sans niveau (la ligne MALÉDICTION) : l'encart sans couleur ; un accessoire détruit aussi ; « Tout effacer » aussi
  p.cliquer(p.maudite);
  assert.deepEqual(p.couleurs(p.produit), [], 'un effet sans niveau');
  p = await charger();
  p.cliquer(p.degats);
  avecLesJets([D20.malediction], p.de3);
  avecLesJets([D20.malediction], p.de3);
  assert.deepEqual(p.classes(), { maudit: true, detruit: true });
  assert.deepEqual(p.couleurs(p.produit), [], 'détruit : pas de couleur de niveau');
  p.cliquer(p.degats);
  assert.deepEqual(p.couleurs(p.produit), [NIVEAU[1]]);
  p.effacer();
  assert.deepEqual(p.couleurs(p.produit), []);
  for (const x of [p.produit, p.force, p.degats]) assert.equal(x.getAttribute('style'), null, 'aucun style');
  pageOuverte.dispatchEvent(new Event('pagehide'));
});

test('l’adresse est lue telle quelle : « détruit » seulement avec une malédiction choisie, et il implique « maudit »', async () => {
  let p = await charger('?emplacement=anneau&propriete=malediction&maudit=1&detruit=1');
  assert.ok(p.classes().detruit);
  assert.match(p.encart(), /Anneau · <strong>Détruit<\/strong>/);
  p = await charger('?propriete=malediction&detruit=1');
  assert.deepEqual(p.classes(), { maudit: true, detruit: true });
  assert.equal(p.adresse(), '?propriete=malediction&maudit=1&detruit=1');
  p = await charger('?emplacement=anneau&propriete=attaque&effet=attaque%3A1&detruit=1');
  assert.deepEqual(p.classes(), { maudit: false, detruit: false }, 'pas de malédiction choisie');
  assert.equal(p.adresse(), '?emplacement=anneau&propriete=attaque&effet=attaque%3A1');
  p = await charger('?propriete=malediction');
  assert.ok(!p.classes().maudit, 'rien n’est déduit à la lecture');
  assert.match(p.encart(), /relancez les dés depuis l’étape 2/);
  pageOuverte.dispatchEvent(new Event('pagehide'));
});

test('sources : le script ne dit plus de relancer depuis l’étape 1 (R94)', () => {
  assert.ok(!readFileSync(new URL('../src/scripts/accessoires.mjs', import.meta.url), 'utf8').includes('depuis l’étape 1'));
});
