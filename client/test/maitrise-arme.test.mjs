// Maîtrises d'armes écrites dans les textes de la base (lib/maitrise-arme.mjs) : le dé du Pugilat selon la Force, les sources de maîtrise d'arme lues
// en parts (décisions R148 à R151 : lignes de classe_maitrise_arme et dons ; leurs points, ceux que le texte écrit, R32), et les NM de sorts gagnés
// d'un don (R154). Entrées synthétiques qui imitent le classeur, puis toute la base : les effectifs et les formes de
// l'import se lisent dans son état d'import (lib/historique-site.mjs), l'état courant se contrôle par des invariants.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { historiqueSite } from '../src/lib/historique-site.mjs';
import {
  FAMILLES_DES_SAUF, choixEcritsDuDon, desSelonLaForce, famillesAuChoix, famillesDuNom, idDeSourceDeClasse, lireDon, lireLigneDeClasse, nmGagnesDuDon,
} from '../src/lib/maitrise-arme.mjs';
import { texteSansBalises } from '../src/lib/mots-cles-balises.mjs';

const db = ouvrirBase({ sansExemples: false });
const historique = historiqueSite(db);

test('dé selon la Force : les paliers écrits dans la note, dans l’ordre ; null sans palier', () => {
  assert.deepEqual(desSelonLaForce('D6 1-2 Force, D8 3-4 Force, D10 5 Force'), [
    { de: 'D6', min: 1, max: 2 }, { de: 'D8', min: 3, max: 4 }, { de: 'D10', min: 5, max: 5 },
  ]);
  assert.equal(desSelonLaForce('Un matériau permet d’en faire 10 sauf pour la fronde qui elle est unique'), null);
  assert.equal(desSelonLaForce(null), null);
  // la note du Pugilat telle que l'import l'a écrite (Ressources et Craft › Armes › HW1)
  assert.deepEqual(desSelonLaForce(historique.valeurDImport('arme_famille', { id: 'pugilat' }, 'note_brut')), desSelonLaForce('D6 1-2 Force, D8 3-4 Force, D10 5 Force'));
});

test('dé selon la Force dans la base : chaque palier est un dé de la famille, les paliers se suivent depuis 1 sans se chevaucher', () => {
  const familles = db.prepare('SELECT id, de_brut, note_brut FROM arme_famille').all().filter((f) => desSelonLaForce(f.note_brut));
  assert.ok(familles.some((f) => f.id === 'pugilat'), 'le Pugilat');
  for (const f of familles) {
    const paliers = desSelonLaForce(f.note_brut);
    assert.deepEqual(paliers.map((p) => p.de), f.de_brut.split('/').map((d) => d.trim().toUpperCase()), `${f.id} : les dés de la famille`);
    paliers.forEach((p, i) => {
      assert.ok(p.min <= p.max, `${f.id} : ${p.de}`);
      assert.equal(p.min, i === 0 ? 1 : paliers[i - 1].max + 1, `${f.id} : ${p.de} suit le palier d’avant`);
    });
  }
});

// ——— Sources de maîtrise d'arme (décisions R148 à R151) ———

// les familles comme la table arme_famille les écrit (bandeaux de l'onglet « Armes » du classeur « Ressources et Craft », R45, R127), dans son ordre
const FAMILLES = [
  ['epees', 'ÉPÉES', 'contact'], ['dagues', 'DAGUES', 'contact'], ['masse-marteau', 'MASSE/MARTEAU', 'contact'], ['hache', 'HACHE', 'contact'],
  ['lance-arme-dhast', "LANCE/ARME D'HAST", 'contact'], ['pugilat', 'PUGILAT', 'contact'], ['baton-de-combat', 'BÂTON DE COMBAT', 'contact'],
  ['arme-de-jet', 'ARME DE JET', 'distance'], ['arc', 'ARC', 'distance'], ['arbalete', 'ARBALÈTE', 'distance'], ['bombes', 'BOMBES', 'distance'],
  ['arme-de-monstres', 'ARME DE MONSTRES', null],
].map(([id, nom, categorie]) => ({ id, nom, maitrisable: categorie ? 1 : 0, categorie }));
const TOUTES = FAMILLES.filter((f) => f.maitrisable).map((f) => f.id);
const CONTACT = FAMILLES.filter((f) => f.categorie === 'contact').map((f) => f.id);
const DISTANCE = FAMILLES.filter((f) => f.categorie === 'distance').map((f) => f.id);
/** Les parts d'une source, en [genre, points, famille ou options, limite], pour comparer d'un coup d'œil. */
const resume = (source) => source && { forme: source.forme, parts: source.parts.map((p) => [p.rang, p.genre, p.points, p.genre === 'choix' ? p.options : p.famille, p.limite]), ...(source.non_lues ? { non_lues: source.non_lues } : {}) };
const ligne = (brut, champs) => ({ brut, arme: null, arme_cle: null, categorie: null, sauf: null, sauf_cle: null, ...champs });

test('noms des familles (R138, R151) : le rattachement de FAMILLES_DES_SAUF, puis le bandeau tel quel ou au singulier, puis sans « de » ; rien sinon', () => {
  assert.deepEqual({ ...FAMILLES_DES_SAUF }, { hast: 'lance-arme-dhast', baton: 'baton-de-combat', 'arme-jet': 'arme-de-jet', masse: 'masse-marteau' });
  for (const [nom, ids] of [
    ['Hast', ['lance-arme-dhast']], ['Bâton', ['baton-de-combat']], ['Arme Jet', ['arme-de-jet']], ['Masse', ['masse-marteau']], // R138, R151
    ['Arme de jet', ['arme-de-jet']], ['Bombe', ['bombes']], ['Épée', ['epees']], ['epee', ['epees']], ['Dague', ['dagues']], ['Arcs', ['arc']],
    ['Arbalètes', ['arbalete']], ['Marteau', ['masse-marteau']], ['Pugilat', ['pugilat']], ['Bâton combat', ['baton-de-combat']],
    ['Fronde', []], ['', []], [null, []],
  ]) assert.deepEqual(famillesDuNom(nom, FAMILLES), ids, `« ${nom} »`);
});

test('ligne de classe (R148, R150, R151) : nommée, au choix, répartie ; null sans nombre ; un nom qui ne se lit pas reste écrit', () => {
  assert.equal(idDeSourceDeClasse('classes/guerrier', 2), 'classes/guerrier#maitrise-arme:2');
  assert.deepEqual(resume(lireLigneDeClasse(ligne('1 maîtrise Épée', { forme: 'nommee', nombre: 1, arme: 'Épée', arme_cle: 'epee' }), FAMILLES)),
    { forme: 'nommee', parts: [[1, 'imposee', 1, 'epees', null]] });
  assert.deepEqual(resume(lireLigneDeClasse(ligne('1 maîtrise Arme Jet', { forme: 'nommee', nombre: 1, arme: 'Arme Jet', arme_cle: 'arme-jet' }), FAMILLES)),
    { forme: 'nommee', parts: [[1, 'imposee', 1, 'arme-de-jet', null]] }, 'R151');
  assert.deepEqual(resume(lireLigneDeClasse(ligne('1 maîtrise Bombe', { forme: 'nommee', nombre: 1, arme: 'Bombe', arme_cle: 'bombe' }), FAMILLES)),
    { forme: 'nommee', parts: [[1, 'imposee', 1, 'bombes', null]] });
  assert.deepEqual(resume(lireLigneDeClasse(ligne('1 maîtrise Fronde', { forme: 'nommee', nombre: 1, arme: 'Fronde', arme_cle: 'fronde' }), FAMILLES)),
    { forme: 'nommee', parts: [], non_lues: ['1 maîtrise Fronde'] }, 'rien n’est rapproché à la place de la source');
  // au choix : la catégorie (R127), sans le « sauf » (R138)
  assert.deepEqual(resume(lireLigneDeClasse(ligne('1 maîtrise dans une arme contact au choix  (sauf épée)', { forme: 'au_choix', nombre: 1, categorie: 'contact', sauf: 'épée', sauf_cle: 'epee' }), FAMILLES)),
    { forme: 'au_choix', parts: [[1, 'choix', 1, CONTACT.filter((id) => id !== 'epees'), null]] });
  assert.deepEqual(resume(lireLigneDeClasse(ligne("1 maîtrise d'arme au choix", { forme: 'au_choix', nombre: 1 }), FAMILLES)),
    { forme: 'au_choix', parts: [[1, 'choix', 1, TOUTES, null]] }, 'jamais ARME DE MONSTRES (R45)');
  assert.deepEqual(resume(lireLigneDeClasse(ligne('1 maîtrise au choix (sauf Arme jet)', { forme: 'au_choix', nombre: 1, sauf: 'Arme jet', sauf_cle: 'arme-jet' }), FAMILLES)).parts[0][3],
    TOUTES.filter((id) => id !== 'arme-de-jet'), 'R138');
  // répartie : la limite écrite par famille (R150), les familles écrites ou leur catégorie (« corps à corps » = contact, R151), toutes sinon
  assert.deepEqual(resume(lireLigneDeClasse(ligne('2 maîtrises à répartir dans les armes de corps à corps sans dépasser 1 dans le même', { forme: 'repartie', nombre: 2 }), FAMILLES)),
    { forme: 'repartie', parts: [[1, 'choix', 2, CONTACT, 1]] });
  assert.deepEqual(resume(lireLigneDeClasse(ligne('2 maîtrises à répartir entre Masse, Pugilat, Bâton combat (1 maximum dans une seule)', { forme: 'repartie', nombre: 2 }), FAMILLES)),
    { forme: 'repartie', parts: [[1, 'choix', 2, ['masse-marteau', 'pugilat', 'baton-de-combat'], 1]] });
  assert.deepEqual(resume(lireLigneDeClasse(ligne('3 maîtrises à répartir sans dépasser 1 dans le même', { forme: 'repartie', nombre: 3 }), FAMILLES)),
    { forme: 'repartie', parts: [[1, 'choix', 3, TOUTES, 1]] });
  assert.deepEqual(resume(lireLigneDeClasse(ligne('2 maîtrises à répartir entre Masse, Fronde', { forme: 'repartie', nombre: 2 }), FAMILLES)),
    { forme: 'repartie', parts: [], non_lues: ['2 maîtrises à répartir entre Masse, Fronde'] });
  assert.equal(lireLigneDeClasse(ligne('Maîtrise toutes les armes', { forme: null, nombre: null }), FAMILLES), null);
});

test('don (R150, R151) : une forme par écriture, lue dans le texte ; null sans point de maîtrise d’arme', () => {
  const lu = (texte) => resume(lireDon(texte, FAMILLES));
  assert.deepEqual(lu('+7% Magie, 7% Concentration, +2 points de maîtrise à répartir, considérer comme classe magique.'), { forme: 'a_repartir', parts: [[1, 'choix', 2, TOUTES, null]] });
  assert.deepEqual(lu('2 points de maitrise à répartir, +10% Arme Lourde, +5% Fermeté.'), { forme: 'a_repartir', parts: [[1, 'choix', 2, TOUTES, null]] }, 'écrit sans accent');
  assert.deepEqual(lu('+5% pour toutes les compétences Perception, +5 points de maîtrise d\'arme à répartir.'), { forme: 'a_repartir', parts: [[1, 'choix', 5, TOUTES, null]] }, 'R150 : la même famille peut revenir');
  assert.deepEqual(lu("+5% Armes légères et lourdes, +5 points de maîtrise d'arme à répartir (Pas plus de 2 points de maîtrise répartis dans la même catégorie), Maîtrise les armures lourdes."),
    { forme: 'a_repartir_limite', parts: [[1, 'choix', 5, TOUTES, 2]] }, 'R150 : « catégorie » = famille');
  assert.deepEqual(lu("+3% pour les compétences d'arme, peut porter les armures lourdes, +5 points de maîtrise d'arme à répartir (plus de 3 points dans une catégorie interdit)."),
    { forme: 'a_repartir_limite', parts: [[1, 'choix', 5, TOUTES, 3]] });
  for (const texte of ["+2 points de maîtrise d'arme, +7% Magie", '+1 point de maîtrise arme, +15% Parade, +4AM.', 'La météo Neutre augmente ses dégâts magiques de 4, +1 point de maîtrise.']) {
    assert.equal(lu(texte).forme, 'sans_destination', texte);
    assert.deepEqual(lu(texte).parts[0][3], TOUTES, 'R150 : comme à répartir');
  }
  assert.deepEqual(lu('Permet d\'utiliser l\'arc de guerre géant, +7% Arc, +2 points de maîtrise Arcs.'), { forme: 'nommee', parts: [[1, 'imposee', 2, 'arc', null]] });
  assert.deepEqual(lu('+2 dégâts, +1 maîtrise Dague, +6% arme légère, +5% Esquive.'), { forme: 'nommee', parts: [[1, 'imposee', 1, 'dagues', null]] });
  assert.deepEqual(lu('+2 points de maîtrise Arme de jet, +1 point de maîtrise Arme contact au choix, +8% Arme Lourdes'),
    { forme: 'nommee_et_categorie', parts: [[1, 'imposee', 2, 'arme-de-jet', null], [2, 'choix', 1, CONTACT, null]] });
  assert.deepEqual(lu('+7% Magie, +7% survie, +7% vie en nature, +1 point de maîtrise d\'arme de contact'), { forme: 'categorie', parts: [[1, 'choix', 1, CONTACT, null]] });
  assert.deepEqual(lu('+2 dégâts avec les sorts, +1 point de maîtrise à distance au choix, +6% Arme à distance liée.'), { forme: 'categorie', parts: [[1, 'choix', 1, DISTANCE, null]] },
    'R151 : le Ménestrel, les quatre à distance');
  assert.deepEqual(lu('+2 points de maîtrise avec l\'arme déterminée avant, +10% Arme légères OU lourdes'), { forme: 'suit', parts: [[1, 'suit', 2, null, null]] }, 'R151');
  assert.deepEqual(lu("+5% Arme lourde OU légère. 2 points de maîtrise à l'épée, 1 point de maîtrise à la dague, -1 point de maîtrise de l'autre arme choisie"),
    { forme: 'nommee_et_retrait', parts: [[1, 'imposee', 2, 'epees', null], [2, 'imposee', 1, 'dagues', null], [3, 'suit', -1, null, null]] }, 'R151 : l’Épéiste');
  assert.deepEqual(lu('+2 points de maîtrise Frondes'), { forme: null, parts: [], non_lues: ['+2 points de maîtrise Frondes'] }, 'un nom qui ne se lit pas reste écrit');
  assert.deepEqual(lu('+5% Arc, +1 point  de maîtrise {{fronde|Fronde}} (au choix), −1 point de maîtrise à répartir.'),
    { forme: null, parts: [], non_lues: ['+1 point de maîtrise Fronde', '−1 point de maîtrise à répartir'] }, 'tel qu’écrit : sans balises, espaces resserrés');
  // ce qui ne donne pas de point de maîtrise d'arme
  for (const texte of ['Gagne 4 niveaux de maîtrise (NM).', "Permet d'additionner les dés de maîtrise de l'arme de jet avec les dés de maîtrise de l'arme version cac",
    'Bonus de 2d4 dégâts sournois* avec une arme de cac ou distance (selon la maîtrise d\'arme).', 'Tirer à la main prendra en compte la maîtrise d\'arme et fera +6 dégâts.',
    '+5% Concentration, +10% Dressage, +2D aux dégâts des armes du familier.', 'Maîtrise les armures intermédiaires.', null]) assert.equal(lireDon(texte, FAMILLES), null, String(texte));
  // les balises du glossaire se lisent par leur texte
  assert.deepEqual(lu('+2 points de maîtrise {{arc|Arcs}}'), { forme: 'nommee', parts: [[1, 'imposee', 2, 'arc', null]] });
});

test('don : ses parts à choisir telles qu’écrites (choixEcritsDuDon, pour le refus du site de dev d’une source à plus d’une part à choisir)', () => {
  assert.deepEqual(choixEcritsDuDon("+2 points de maîtrise à répartir, +1 point de maîtrise d'arme de contact.", FAMILLES),
    ['+2 points de maîtrise à répartir', "+1 point de maîtrise d'arme de contact"]);
  const deux = lireDon("+2 points de maîtrise à répartir, +1 point de maîtrise d'arme de contact.", FAMILLES);
  assert.deepEqual([deux.forme, deux.non_lues], ['mixte', undefined], 'lisible : rien dans non_lues, d’où le refus à part');
  assert.deepEqual(choixEcritsDuDon('+2 points de maîtrise Arme de jet, +1 point de maîtrise {{contact|Arme contact}} au choix', FAMILLES), ['+1 point de maîtrise Arme contact au choix'],
    'l’imposée n’en est pas ; sans balises');
  assert.deepEqual(choixEcritsDuDon('+1 point de maîtrise Truc, +2 points de maîtrise Arcs.', FAMILLES), [], 'ni une écriture illisible ni une imposée');
  assert.deepEqual(choixEcritsDuDon('Gagne 4 niveaux de maîtrise (NM).', FAMILLES), []);
});

test('R154 : les NM de sorts gagnés qu’écrit un don, « Gagne N niveaux de maîtrise (NM) » ; 0 sinon', () => {
  assert.equal(nmGagnesDuDon('Gagne 4 niveaux de maîtrise (NM).'), 4);
  assert.equal(nmGagnesDuDon('gagne 1 niveau de maitrise (NM)'), 1);
  assert.equal(nmGagnesDuDon('Donne un NM supplémentaire au sort préparé. Ne peut pas dépasser 3 NM.'), 0, 'R134 : « À l’aise » ne change pas les NM gagnés');
  assert.equal(nmGagnesDuDon('+2 points de maîtrise à répartir'), 0);
  assert.equal(nmGagnesDuDon(null), 0);
});

// toute la base
const famillesDe = (lignes) => [...lignes].sort((a, b) => a.ordre - b.ordre).map(({ id, nom, maitrisable, categorie }) => ({ id, nom, maitrisable, categorie }));
const famillesActuelles = famillesDe(db.prepare('SELECT id, nom, maitrisable, categorie, ordre FROM arme_famille').all());
const MAITRISABLES = new Set(famillesActuelles.filter((f) => f.maitrisable).map((f) => f.id));
const parId = (lignes) => [...lignes].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
/**
 * Les points de maîtrise d'arme qu'écrit un texte (décision R32), lus ici sans le lecteur : la somme signée de ses « N point(s) de maîtrise » et
 * « N maîtrise(s) » (le « -1 point de maîtrise de l'autre arme choisie » de l'Épéiste en retire un), sauf une limite (« pas plus de 2 points de
 * maîtrise répartis… ») ; un NM de sort (« 4 niveaux de maîtrise (NM) ») ne s'écrit pas ainsi.
 */
const ECRITURE_DE_POINTS = /([+\-−]?)\s*(\d+)\s+(?:points?\s+de\s+)?maitrises?\b/g;
const plierLeTexte = (t) => String(texteSansBalises(t ?? '') ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[’`]/g, "'").toLowerCase();
const pointsEcrits = (texte) => {
  const t = plierLeTexte(texte);
  return [...t.matchAll(ECRITURE_DE_POINTS)].filter((m) => !/plus de\s*$/.test(t.slice(0, m.index)))
    .reduce((n, m) => n + (m[1] && m[1] !== '+' ? -1 : 1) * Number(m[2]), 0);
};
const pointsLus = (texte) => (lireDon(texte, famillesActuelles)?.parts ?? []).reduce((n, p) => n + p.points, 0);

test('points de maîtrise d’un don (R32, R148) : la somme signée de ses parts — chaque « N point(s) de maîtrise » et « N maîtrise(s) » ; ni une limite, ni un NM de sort', () => {
  assert.equal(pointsLus('+7% Magie, 7% Concentration, +2 points de maîtrise à répartir, considérer comme classe magique.'), 2);
  assert.equal(pointsLus('+2 dégâts, +1 maîtrise Dague, +6% arme légère, +5% Esquive.'), 1);
  assert.equal(pointsLus('+2 points de maîtrise Arme de jet, +1 point de maîtrise Arme contact au choix, +8% Arme Lourdes'), 3);
  assert.equal(pointsLus('2 points de maitrise à répartir, +10% Arme Lourde, +5% Fermeté.'), 2, 'écrit sans accent');
  assert.equal(pointsLus("+5% Arme lourde OU légère. 2 points de maîtrise à l'épée, 1 point de maîtrise à la dague, -1 point de maîtrise de l'autre arme choisie"), 2,
    'l’Épéiste : 2 + 1 − 1');
  assert.equal(pointsLus("+5 points de maîtrise d'arme à répartir (Pas plus de 2 points de maîtrise répartis dans la même catégorie), Maîtrise les armures lourdes."), 5,
    'la limite n’est pas un gain');
  for (const t of ['Gagne 4 niveaux de maîtrise (NM).', 'Le sort influé aura toujours au minimum un Niveau de Maîtrise.',
    "Permet d'additionner les dés de maîtrise de l'arme de jet avec les dés de maîtrise de l'arme cac", 'Maîtrise les armures intermédiaires.', null]) {
    assert.equal(lireDon(t, famillesActuelles), null, String(t));
  }
});

test('les 66 lignes typées de classe_maitrise_arme à l’import (R148, R151) : 29 nommées sur une famille maîtrisable, 34 au choix, 3 réparties à 1 par famille', () => {
  const familles = famillesDe(historique.lignesDImport('arme_famille'));
  const lues = historique.lignesDImport('classe_maitrise_arme').filter((l) => l.nombre !== null)
    .sort((a, b) => (a.classe_id < b.classe_id ? -1 : a.classe_id > b.classe_id ? 1 : a.rang - b.rang))
    .map((l) => ({ l, r: lireLigneDeClasse(l, familles) }));
  assert.equal(lues.length, 66);
  const deForme = (forme) => lues.filter(({ r }) => r.forme === forme);
  assert.deepEqual([deForme('nommee').length, deForme('au_choix').length, deForme('repartie').length], [29, 34, 3]);
  for (const { l, r } of lues) {
    assert.equal(r.non_lues, undefined, `${l.classe_id} : ${l.brut}`);
    assert.equal(r.parts.length, 1, l.classe_id);
  }
  for (const { l, r } of deForme('nommee')) {
    assert.equal(r.parts[0].genre, 'imposee');
    assert.ok(MAITRISABLES.has(r.parts[0].famille), `R151 : ${l.classe_id} « ${l.arme} »`);
  }
  for (const { l, r } of deForme('au_choix')) assert.deepEqual(r.parts[0].options, famillesAuChoix(l, familles), l.classe_id);
  const reparties = Object.fromEntries(deForme('repartie').map(({ l, r }) => [l.classe_id, resume(r).parts]));
  assert.deepEqual(reparties, {
    'classes/bimane': [[1, 'choix', 2, CONTACT, 1]], // « corps à corps » = contact (R151)
    'classes/frappeur': [[1, 'choix', 2, ['masse-marteau', 'pugilat', 'baton-de-combat'], 1]],
    'classes/mercenaire': [[1, 'choix', 3, TOUTES, 1]],
  }, 'R150 : la limite écrite de 1 par famille');
  // les noms des lignes nommées écrits autrement que leur bandeau (R151) : chacun sa famille
  const nommees = new Map(deForme('nommee').map(({ l, r }) => [l.arme, r.parts[0].famille]));
  for (const [arme, id] of [['Hast', 'lance-arme-dhast'], ['Bâton', 'baton-de-combat'], ['Arme Jet', 'arme-de-jet'], ['Arme de jet', 'arme-de-jet'], ['Masse', 'masse-marteau'], ['Bombe', 'bombes'], ['Épée', 'epees']]) {
    assert.equal(nommees.get(arme), id, arme);
  }
});

test('lignes de classe_maitrise_arme de la base : chacune se lit, une famille maîtrisable pour une nommée, les options d’arme_famille et jamais ARME DE MONSTRES', () => {
  for (const l of db.prepare('SELECT * FROM classe_maitrise_arme ORDER BY classe_id, rang').all()) {
    const r = lireLigneDeClasse(l, famillesActuelles);
    if (l.nombre === null) { assert.equal(r, null); continue; }
    assert.equal(r.forme, l.forme);
    assert.equal(r.non_lues, undefined, `${l.classe_id} : ${l.brut}`);
    for (const p of r.parts) {
      assert.equal(p.points, l.nombre);
      if (p.genre === 'imposee') assert.ok(MAITRISABLES.has(p.famille), l.classe_id);
      else {
        assert.ok(p.options.length && p.options.every((id) => MAITRISABLES.has(id)), `${l.classe_id} : R45`);
        assert.deepEqual(p.options, famillesActuelles.map((f) => f.id).filter((id) => p.options.includes(id)), 'dans l’ordre d’arme_famille');
      }
    }
  }
});

test('les 77 dons à l’import, par forme (R150, R151) : 50 à répartir, 5 sans destination, 2 à limite, 9 nommés, 2 nommés plus contact, 3 par catégorie, 5 « arme déterminée avant », l’Épéiste', () => {
  const familles = famillesDe(historique.lignesDImport('arme_famille'));
  const lus = parId(historique.lignesDImport('capacite')).map((d) => ({ d, r: lireDon(d.effet, familles) })).filter(({ r }) => r);
  assert.equal(lus.length, 77);
  const ids = (forme) => lus.filter(({ r }) => r.forme === forme).map(({ d }) => d.id);
  const compte = Object.fromEntries(['a_repartir', 'sans_destination', 'a_repartir_limite', 'nommee', 'nommee_et_categorie', 'categorie', 'suit', 'nommee_et_retrait']
    .map((forme) => [forme, ids(forme).length]));
  assert.deepEqual(compte, { a_repartir: 50, sans_destination: 5, a_repartir_limite: 2, nommee: 9, nommee_et_categorie: 2, categorie: 3, suit: 5, nommee_et_retrait: 1 });
  // à répartir : 44 à 2 points, 5 à 1 point, le Chasseur de primes à 5
  const points = lus.filter(({ r }) => r.forme === 'a_repartir').map(({ r }) => r.parts[0].points);
  assert.deepEqual([2, 1, 5].map((n) => points.filter((p) => p === n).length), [44, 5, 1]);
  assert.deepEqual(lus.find(({ r }) => r.forme === 'a_repartir' && r.parts[0].points === 5).d.id, 'capacites/mercenaire-chasseur-de-primes');
  assert.deepEqual(ids('sans_destination'), ['capacites/clerc-saint-combattant', 'capacites/clerc-zelote', 'capacites/maclier-archiclier', 'capacites/maclier-grand-maclier',
    'capacites/ocultomancien-meteorologue']);
  // les 52 « à répartir » et les 5 sans destination : sans limite, sauf Maître d'arme (2) et Combattant libre (3) (R150)
  const limites = Object.fromEntries(lus.filter(({ r }) => ['a_repartir', 'a_repartir_limite', 'sans_destination'].includes(r.forme))
    .filter(({ r }) => r.parts[0].limite !== null).map(({ d, r }) => [d.id, r.parts[0].limite]));
  assert.equal(lus.filter(({ r }) => ['a_repartir', 'a_repartir_limite', 'sans_destination'].includes(r.forme)).length, 57);
  assert.deepEqual(limites, { 'capacites/guerrier-maitre-darme': 2, 'capacites/mercenaire-combattant-libre': 3 });
  for (const { d, r } of lus.filter(({ r: x }) => ['a_repartir', 'a_repartir_limite', 'sans_destination'].includes(x.forme))) {
    assert.deepEqual(r.parts[0].options, TOUTES, `${d.id} : R150, toutes les familles maîtrisables`);
  }
  assert.deepEqual(Object.fromEntries(lus.filter(({ r }) => r.forme === 'nommee').map(({ d, r }) => [d.id, r.parts.map((p) => [p.famille, p.points])])), {
    'capacites/arbaletrier-baliste': [['arbalete', 2]], 'capacites/arbaletrier-grand-arbaletrier': [['arbalete', 2]], 'capacites/archer-grand-archer': [['arc', 2]],
    'capacites/archer-tireur-delite': [['arc', 2]], 'capacites/barde-danseur': [['dagues', 1]], 'capacites/grenadier-artilleur': [['bombes', 2]],
    'capacites/grenadier-bombardier': [['bombes', 2]], 'capacites/pugiliste-cogneur': [['pugilat', 2]], 'capacites/pugiliste-lutteur': [['pugilat', 2]],
  });
  for (const id of ids('nommee_et_categorie')) {
    assert.deepEqual(resume(lus.find(({ d }) => d.id === id).r).parts, [[1, 'imposee', 2, 'arme-de-jet', null], [2, 'choix', 1, CONTACT, null]], id);
  }
  assert.deepEqual(Object.fromEntries(lus.filter(({ r }) => r.forme === 'categorie').map(({ d, r }) => [d.id, r.parts[0].options])), {
    'capacites/archimage-elementaliste': CONTACT, 'capacites/archimage-occultiste': DISTANCE,
    'capacites/barde-menestrel': DISTANCE, // R151 : les quatre familles à distance, indépendamment de la maîtrise du Barde
  });
  assert.deepEqual(ids('suit'), ['capacites/mage-bleu-mage-saphir', 'capacites/mage-rouge-mage-grenat', 'capacites/mage-rouge-mage-rubis', 'capacites/mage-vert-mage-emeraude',
    'capacites/mage-vert-mage-jade']);
  for (const { r } of lus.filter(({ r: x }) => x.forme === 'suit')) assert.deepEqual(resume(r).parts, [[1, 'suit', 2, null, null]]);
  assert.deepEqual(ids('nommee_et_retrait'), ['capacites/guerrier-epeiste']);
  assert.deepEqual(resume(lus.find(({ d }) => d.id === 'capacites/guerrier-epeiste').r).parts,
    [[1, 'imposee', 2, 'epees', null], [2, 'imposee', 1, 'dagues', null], [3, 'suit', -1, null, null]], 'R151');
  // ne donnent rien : Dresseur bleu, « Encore plus ! », « Sournois », « Sur le Pouce », les NM de l'Ocultomancien
  const dImport = new Map(historique.lignesDImport('capacite').map((d) => [d.id, d]));
  for (const id of ['capacites/mage-bleu-dresseur-bleu', 'capacites/lanceur-encore-plus', 'capacites/tueur-sournois', 'capacites/mage-vert-sur-le-pouce', 'capacites/ocultomancien-maitrise']) {
    assert.ok(dImport.has(id), id);
    assert.equal(lireDon(dImport.get(id).effet, familles), null, id);
  }
});

test('dons de la base : chaque écriture se lit, autant de points que le texte en donne (R32), une part à choisir au plus, jamais ARME DE MONSTRES ; un don qui suit est d’une classe à une seule maîtrise au choix', () => {
  const auChoix = new Map();
  for (const l of db.prepare("SELECT classe_id FROM classe_maitrise_arme WHERE forme = 'au_choix'").all()) auChoix.set(l.classe_id, (auChoix.get(l.classe_id) ?? 0) + 1);
  let lus = 0;
  for (const d of db.prepare('SELECT id, classe_id, effet FROM capacite ORDER BY id').all()) {
    const r = lireDon(d.effet, famillesActuelles);
    assert.equal(r === null, !/\d+\s+(?:points?\s+de\s+)?ma[iî]trises?\b/i.test(d.effet ?? ''), d.id);
    if (!r) continue;
    lus += 1;
    assert.equal(r.non_lues, undefined, d.id);
    assert.notEqual(r.forme, 'mixte', d.id);
    assert.equal(r.parts.reduce((n, p) => n + p.points, 0), pointsEcrits(d.effet), `${d.id} : R32`);
    assert.ok(pointsEcrits(d.effet) >= 0, `${d.id} : jamais moins de 0`);
    assert.ok(r.parts.filter((p) => p.genre === 'choix').length <= 1, `${d.id} : une part à choisir au plus`);
    r.parts.forEach((p, i) => {
      assert.equal(p.rang, i + 1);
      assert.ok(Number.isInteger(p.points) && p.points !== 0, d.id);
      if (p.genre === 'imposee') assert.ok(MAITRISABLES.has(p.famille), d.id);
      if (p.genre === 'choix') assert.ok(p.points > 0 && p.options.length && p.options.every((id) => MAITRISABLES.has(id)), `${d.id} : R45`);
      if (p.genre === 'suit') assert.equal(auChoix.get(d.classe_id), 1, `${d.id} : R151, la maîtrise au choix de ${d.classe_id}`);
    });
  }
  assert.ok(lus > 0);
});

test('R154 : un seul don de la base fait gagner des NM de sorts à l’import, la « Maîtrise » de l’Ocultomancien (4) ; dans la base, chaque « niveaux de maîtrise (NM) » se lit', () => {
  const dImport = historique.lignesDImport('capacite').filter((d) => nmGagnesDuDon(d.effet) > 0).map((d) => [d.id, nmGagnesDuDon(d.effet)]);
  assert.deepEqual(dImport, [['capacites/ocultomancien-maitrise', 4]]);
  for (const d of db.prepare('SELECT id, effet FROM capacite').all()) {
    const ecrit = /niveaux?\s+de\s+ma[iî]trise\s*\(\s*NM\s*\)/i.test(d.effet ?? '');
    assert.equal(nmGagnesDuDon(d.effet) > 0, ecrit, d.id);
  }
});
