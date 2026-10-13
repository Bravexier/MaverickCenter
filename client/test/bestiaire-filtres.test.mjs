// Recherche, filtres et tri des tableaux de /bestiaire/ (lib/bestiaire-filtres.mjs, fonctions pures).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { adresseAvecEtat, basculer, casesTrouvees, effectifs, etatDepuisAdresse, filtrerEtTrier, garder, normaliser, triSuivant } from '../src/lib/bestiaire-filtres.mjs';

const config = { prefixe: '', facettes: ['categorie', 'ep', 'lieu'], tris: ['nom', 'sante'] };
const lignes = [
  { ordre: 0, texte: 'Amblypyge noir Vermine Marais Pétrolier', facettes: { categorie: ['ennemi_simple'], ep: ['2'], lieu: ['marais'] }, tri: { nom: 'Amblypyge noir', sante: 70 } },
  { ordre: 1, texte: 'Amblypyge de brai Vermine Marais', facettes: { categorie: ['mini_boss'], ep: ['2'], lieu: ['marais'] }, tri: { nom: 'Amblypyge de brai', sante: 140 } },
  { ordre: 2, texte: 'Archidémon Démon Ici et là', facettes: { categorie: ['ennemi_simple'], ep: ['1', '2', '3'], lieu: ['ici-et-la'] }, tri: { nom: 'Archidémon', sante: null } },
  { ordre: 3, texte: 'Golem de fer III Mécanique Mine', facettes: { categorie: ['boss'], ep: ['2'], lieu: ['mine', 'caverne'] }, tri: { nom: 'Golem de fer III', sante: 140 } },
];
const noms = (ls) => ls.map((l) => l.tri.nom);

test('dans un filtre : l’une OU l’autre valeur ; entre deux filtres : l’un ET l’autre', () => {
  const etat = { q: '', facettes: { categorie: ['ennemi_simple', 'boss'], ep: ['2'] }, tri: null, sens: 'asc' };
  assert.deepEqual(noms(filtrerEtTrier(lignes, etat)), ['Amblypyge noir', 'Archidémon', 'Golem de fer III']);
  assert.deepEqual(noms(filtrerEtTrier(lignes, { ...etat, facettes: { ...etat.facettes, lieu: ['marais'] } })), ['Amblypyge noir']);
  assert.deepEqual(noms(filtrerEtTrier(lignes, { ...etat, facettes: { lieu: ['caverne'] } })), ['Golem de fer III'], 'une ligne à plusieurs valeurs');
});

test('recherche : tous les mots, sans casse ni accents, n’importe où dans le texte', () => {
  assert.equal(normaliser('  Pétrolier  ÉLÉMENTAIRE de l’Eau '), "petrolier elementaire de l'eau");
  const q = (texte) => noms(filtrerEtTrier(lignes, { q: texte, facettes: {}, tri: null, sens: 'asc' }));
  assert.deepEqual(q('amblypyge marais'), ['Amblypyge noir', 'Amblypyge de brai']);
  assert.deepEqual(q('PETROLIER'), ['Amblypyge noir']);
  assert.deepEqual(q('archidemon ici'), ['Archidémon']);
  assert.deepEqual(q('golem marais'), []);
  assert.deepEqual(q('   '), noms(lignes));
  assert.equal(garder({ texteNormalise: 'deja normalise', facettes: {} }, { q: 'normalise', facettes: {} }), true, 'texte déjà normalisé (script de la page)');
});

test('tri : croissant, décroissant, valeur absente toujours à la fin, égalité dans l’ordre du doc ; sans tri : l’ordre du doc', () => {
  const tous = { q: '', facettes: {}, sens: 'asc' };
  assert.deepEqual(noms(filtrerEtTrier(lignes, { ...tous, tri: null })), noms(lignes));
  assert.deepEqual(noms(filtrerEtTrier(lignes, { ...tous, tri: 'sante' })), ['Amblypyge noir', 'Amblypyge de brai', 'Golem de fer III', 'Archidémon']);
  assert.deepEqual(noms(filtrerEtTrier(lignes, { ...tous, tri: 'sante', sens: 'desc' })), ['Amblypyge de brai', 'Golem de fer III', 'Amblypyge noir', 'Archidémon']);
  assert.deepEqual(noms(filtrerEtTrier(lignes, { ...tous, tri: 'nom' })), ['Amblypyge de brai', 'Amblypyge noir', 'Archidémon', 'Golem de fer III']);
  let etat = { ...tous, tri: null };
  etat = triSuivant(etat, 'sante');
  assert.deepEqual([etat.tri, etat.sens], ['sante', 'asc']);
  etat = triSuivant(etat, 'sante');
  assert.deepEqual([etat.tri, etat.sens], ['sante', 'desc']);
  etat = triSuivant(etat, 'sante');
  assert.deepEqual([etat.tri, etat.sens], [null, 'asc']);
  assert.deepEqual([triSuivant({ ...tous, tri: 'nom', sens: 'desc' }, 'sante').sens], ['asc'], 'une autre colonne repart en croissant');
});

test('effectifs d’un filtre : parmi les lignes qui passent la recherche et les AUTRES filtres', () => {
  const etat = { q: '', facettes: { categorie: ['boss'], lieu: ['marais'] }, tri: null, sens: 'asc' };
  assert.deepEqual(Object.fromEntries(effectifs(lignes, etat, 'categorie')), { ennemi_simple: 1, mini_boss: 1 }, 'catégorie : le seul filtre lieu compte');
  assert.deepEqual(Object.fromEntries(effectifs(lignes, etat, 'lieu')), { mine: 1, caverne: 1 }, 'lieu : le seul filtre catégorie compte');
  assert.deepEqual(Object.fromEntries(effectifs(lignes, { ...etat, q: 'amblypyge' }, 'categorie')), { ennemi_simple: 1, mini_boss: 1 });
});

test('cocher, décocher : un filtre vide disparaît de l’état', () => {
  let etat = { q: '', facettes: {}, tri: null, sens: 'asc' };
  etat = basculer(etat, 'categorie', 'boss', true);
  etat = basculer(etat, 'categorie', 'boss', true);
  etat = basculer(etat, 'categorie', 'mini_boss', true);
  assert.deepEqual(etat.facettes, { categorie: ['boss', 'mini_boss'] });
  etat = basculer(basculer(etat, 'categorie', 'boss', false), 'categorie', 'mini_boss', false);
  assert.deepEqual(etat.facettes, {});
});

test('adresse : aller-retour, valeurs multiples, préfixe d’un tableau, paramètres de l’autre tableau gardés, valeurs inconnues ignorées', () => {
  const etat = { q: 'golem fer', facettes: { categorie: ['boss', 'mini_boss'], ep: ['5'] }, tri: 'sante', sens: 'desc' };
  const adresse = adresseAvecEtat('', etat, config);
  assert.equal(adresse, '?q=golem+fer&categorie=boss&categorie=mini_boss&ep=5&tri=sante&sens=desc');
  assert.deepEqual(etatDepuisAdresse(adresse, config), etat);
  // le tableau des créatures invoquées (préfixe « i- ») n'efface pas celui des monstres, et inversement
  const inv = { prefixe: 'i-', facettes: ['magie'], tris: ['nom'] };
  const deux = adresseAvecEtat(adresse, { q: '', facettes: { magie: ['feu'] }, tri: 'nom', sens: 'asc' }, inv);
  assert.equal(deux, `${adresse}&i-magie=feu&i-tri=nom`);
  assert.deepEqual(etatDepuisAdresse(deux, config), etat);
  assert.deepEqual(etatDepuisAdresse(deux, inv), { q: '', facettes: { magie: ['feu'] }, tri: 'nom', sens: 'asc' });
  assert.equal(adresseAvecEtat(deux, { q: '', facettes: {}, tri: null, sens: 'asc' }, config), '?i-magie=feu&i-tri=nom');
  assert.equal(adresseAvecEtat('?autre=1', { q: '', facettes: {}, tri: null, sens: 'asc' }, config), '?autre=1');
  assert.equal(adresseAvecEtat('', { q: '  ', facettes: {}, tri: null, sens: 'desc' }, config), '', 'rien à écrire');
  // valeurs inconnues : ignorées
  const lu = etatDepuisAdresse('?tri=inconnu&sens=desc&categorie=boss&categorie=dragon&categorie=boss', { ...config, valeurs: { categorie: ['boss', 'mini_boss'] } });
  assert.deepEqual(lu, { q: '', facettes: { categorie: ['boss'] }, tri: null, sens: 'asc' });
});

test('cases d’une ligne (une combinaison de magies et ses deux créatures) : la recherche désigne celle qui contient tous les mots ; sinon toutes', () => {
  const zombi = { texte: 'Zombi Non-Mort Mord' };
  const squelette = { texte: 'Squelette archer Non-Mort Tire' };
  const ligne = { texte: 'Nécromancie mono Zombi Squelette archer', cases: [zombi, squelette] };
  assert.deepEqual(casesTrouvees(ligne, { q: '' }), [zombi, squelette], 'sans recherche : toutes');
  assert.deepEqual(casesTrouvees(ligne, { q: 'zombi' }), [zombi]);
  assert.deepEqual(casesTrouvees(ligne, { q: 'SQUELETTE tire' }), [squelette], 'sans casse, tous les mots');
  assert.deepEqual(casesTrouvees(ligne, { q: 'non-mort' }), [zombi, squelette], 'les deux');
  // les mots sont dans l'en-tête de la ligne (la combinaison) ou répartis entre les deux cases : toutes
  assert.deepEqual(casesTrouvees(ligne, { q: 'necromancie' }), [zombi, squelette]);
  assert.deepEqual(casesTrouvees(ligne, { q: 'mord tire' }), [zombi, squelette]);
  // une ligne d'une seule case (un monstre) : elle-même
  const monstre = { texte: 'Amblypyge noir', cases: [] };
  monstre.cases = [monstre];
  assert.deepEqual(casesTrouvees(monstre, { q: 'noir' }), [monstre]);
});

test('effectifs d’une ligne à cases (une combinaison et ses deux créatures) : elle compte pour ses cases, celles que la recherche trouve, comme le compte de la page', () => {
  const ligne = (magies, ...noms) => {
    const l = { texte: `${magies.join(' ')} ${noms.join(' ')}`, facettes: { magie: magies } };
    l.cases = noms.map((n) => ({ texte: n }));
    return l;
  };
  const lignes = [ligne(['terre'], 'Golem de pierre', 'Poupée de terre'), ligne(['terre', 'feu'], 'Golem de magma', 'Poupée de braise'), ligne(['ombre'], 'Ombre rampante')];
  assert.deepEqual(Object.fromEntries(effectifs(lignes, { q: '', facettes: {} }, 'magie')), { terre: 4, feu: 2, ombre: 1 });
  assert.deepEqual(Object.fromEntries(effectifs(lignes, { q: 'golem', facettes: {} }, 'magie')), { terre: 2, feu: 1 }, 'les poupées ne sont pas trouvées');
  // une ligne sans cases (un test, une ligne de monstre déjà lue) compte pour une
  assert.deepEqual(Object.fromEntries(effectifs([{ texte: 'x', facettes: { magie: ['feu'] } }], { q: '', facettes: {} }, 'magie')), { feu: 1 });
});
