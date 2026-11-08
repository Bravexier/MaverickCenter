// Le Glossaire (/regles/glossaire/ ; réponses du propriétaire du 2026-11-06, Q6 et Q7) : les filtres de son tableau (décision R234 (4) : un filtre texte,
// qui lit le libellé, les synonymes et la définition, et un filtre par catégorie ; lib/glossaire-filtre.mjs, dont la normalisation est celle de
// lib/text.mjs#normalize, recopiée : le script de la page n'importe que ce module), son script dans un faux navigateur (src/scripts/glossaire.mjs :
// saisie, catégorie, ?q=, tableau redessiné par l'éditeur, liste des catégories refaite), les couleurs proposées à un mot-clé (lib/glossaire-couleurs.mjs :
// toutes les familles de la palette, Q3 et Q4) et leurs options (lib/mots-cles-edition.mjs).
//   node --test test/glossaire-filtre.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { categorieChoisie, compteDuFiltre, correspond, motCleDeLaLigne, normaliser, SANS_CATEGORIE, sansBalises, texteDuMotCle } from '../src/lib/glossaire-filtre.mjs';
import { choixDesCouleurs, libelleDeCle, NOMS_DES_FAMILLES } from '../src/lib/glossaire-couleurs.mjs';
import { couleurDuCercle, optionsDeCouleur, valeurDeCouleur } from '../src/lib/mots-cles-edition.mjs';
import { lireLaCouleur } from '../src/lib/mots-cles-liens.mjs';
import { couleursDeLaPalette, FAMILLES_DE_LA_PALETTE, fauteDeLaCouleur } from '../src/lib/palette-css.mjs';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { cleDeMagieConnue } from '../src/lib/sort-format.mjs';
import { normalize } from '../src/lib/text.mjs';
import { baseDImport } from './aide-base-d-import.mjs';
import { attendre, el, fauxDocument } from './aide-faux-dom.mjs';

test('normaliser est lib/text.mjs#normalize (recopiée : le script de la page n’importe rien d’autre)', () => {
  for (const t of ['Armure magique', 'Élémentaire', 'Ricken d’or', "l'Arcane", '  Espace/Temps  ', 'CR', 'Œil — de-boeuf', '', 'Mode Hyper 100 %', 'ÇA ÇA']) {
    assert.equal(normaliser(t), normalize(t), t);
  }
  assert.doesNotMatch(readFileSync(new URL('../src/lib/glossaire-filtre.mjs', import.meta.url), 'utf8'), /^import /m, 'sans import');
  assert.deepEqual([...readFileSync(new URL('../src/scripts/glossaire.mjs', import.meta.url), 'utf8').matchAll(/^import .* from '([^']+)';$/gm)].map((m) => m[1]),
    ['../lib/glossaire-filtre.mjs'], 'le script de la page : ce module seul');
});

test('R234 (4), R233 (1) : un mot-clé correspond par son libellé, l’un de ses synonymes ou sa définition (balises lues comme leur texte), sans casse ni accents', () => {
  const am = { libelle: 'Armure magique', synonymes: ['AM', 'Bouclier de mana'], definition: 'Protège des {{sort|sorts}} et du {{mana:}}.' };
  assert.equal(sansBalises(am.definition), 'Protège des sorts et du mana.');
  assert.equal(sansBalises('{{elfe}} et {{feu\\|Feu}}'), 'elfe et Feu', 'une case de tableau (« \\| »)');
  assert.equal(texteDuMotCle(am), 'armure-magique|am|bouclier-de-mana|protege-des-sorts-et-du-mana');
  for (const q of ['', '  ', 'armure', 'MAGIQUE', 'am', 'bouclier', 'de mana', 'protège', 'protege des', 'sorts', 'mana']) assert.equal(correspond(am, q), true, q);
  for (const q of ['feu', 'armures', 'magique am']) assert.equal(correspond(am, q), false, q);
  assert.equal(correspond({ libelle: 'Feu' }, 'feu'), true, 'sans synonyme ni définition');
  assert.deepEqual([compteDuFiltre(379, 379, ''), compteDuFiltre(1, 1, ' '), compteDuFiltre(3, 379, 'am')], ['379 mots-clés', '1 mot-clé', '3 sur 379']);
});

test('R234 (4) : le filtre par catégorie — un mot-clé qui la porte (R232 (5) : ses catégories, des ids) ; aucune choisie : tous ; il se combine au filtre texte', () => {
  const m = { libelle: 'Orios', categories: [3, 6] };
  assert.equal(categorieChoisie(''), null);
  assert.equal(categorieChoisie('6'), 6);
  assert.equal(categorieChoisie('x'), null);
  assert.equal(correspond(m, '', { categorie: 6 }), true);
  assert.equal(correspond(m, '', { categorie: 1 }), false);
  assert.equal(correspond({ libelle: 'Sans catégorie' }, '', { categorie: 1 }), false);
  assert.equal(correspond(m, 'ori', { categorie: 3 }), true);
  assert.equal(correspond(m, 'feu', { categorie: 3 }), false, 'les deux filtres');
  assert.equal(correspond(m, 'ori', { categorie: null }), true);
  assert.equal(compteDuFiltre(4, 379, '', { categorie: 2 }), '4 sur 379', 'une catégorie choisie : le compte filtré');
  // « Sans catégorie » (réponse du propriétaire) : les mots-clés à classer
  assert.equal(categorieChoisie('sans'), SANS_CATEGORIE);
  assert.equal(correspond({ libelle: 'À classer' }, '', { categorie: SANS_CATEGORIE }), true);
  assert.equal(correspond({ libelle: 'À classer', categories: [] }, 'class', { categorie: SANS_CATEGORIE }), true);
  assert.equal(correspond(m, '', { categorie: SANS_CATEGORIE }), false);
  assert.equal(compteDuFiltre(2, 379, '', { categorie: SANS_CATEGORIE }), '2 sur 379');
  // la ligne du tableau (data-*, lib/mots-cles-balises.mjs#htmlDeLaLigneDuGlossaire) : ses listes en JSON
  assert.deepEqual(motCleDeLaLigne({ libelle: 'Orios', synonymes: '["Orio"]', categories: '[3,6]', definition: 'Une race.' }),
    { libelle: 'Orios', synonymes: ['Orio'], definition: 'Une race.', categories: [3, 6] });
  assert.deepEqual(motCleDeLaLigne({ libelle: 'X', synonymes: 'pas du JSON' }), { libelle: 'X', synonymes: [], definition: '', categories: [] });
});

test('le script de la page : la saisie et la catégorie filtrent le tableau (compte, « aucun »), ?q= la remplit, le tableau redessiné par l’éditeur est relu, la liste des catégories refaite', async () => {
  const ligne = (id, libelle, extra = {}) => el('tbody', { 'data-id': id, 'data-libelle': libelle, ...extra }, el('tr', {}, el('th', {}, libelle)));
  const tableau = el('table', { id: 'liste-mots-cles' }, el('thead', {}),
    ligne('1', 'Armure magique', { 'data-synonymes': '["AM"]', 'data-categories': '[2,4]' }),
    ligne('2', 'Feu', { 'data-definition': 'Ce qui {{brule|brûle}}.', 'data-categories': '[2]' }),
    ligne('3', 'Nain', { 'data-categories': '[3]' }));
  const champ = el('input', { id: 'filtre-glossaire' });
  const categorie = el('select', { id: 'filtre-categorie' }, el('option', { value: '' }, 'Toutes les catégories'), el('option', { value: 'sans' }, 'Sans catégorie'),
    el('option', { value: '2' }, 'Magie'),
    el('option', { value: '3' }, 'Race'));
  const document = fauxDocument(el('form', {}, champ, categorie, el('span', { id: 'glossaire-compte' })), tableau, el('p', { id: 'aucun-mot-cle', hidden: '' }));
  Object.assign(globalThis, { document, location: { search: '?q=brûle' } });
  await import('../src/scripts/glossaire.mjs');
  const visibles = () => tableau.children.filter((x) => x.tagName === 'TBODY' && !x.hidden).map((x) => x.dataset.id);
  assert.equal(champ.value, 'brûle', '?q= dans l’adresse');
  assert.deepEqual(visibles(), ['2']);
  assert.equal(document.getElementById('glossaire-compte').textContent, '1 sur 3');
  champ.value = 'am';
  champ.dispatchEvent(new Event('input'));
  assert.deepEqual(visibles(), ['1'], 'par un synonyme');
  champ.value = 'zzz';
  champ.dispatchEvent(new Event('input'));
  assert.deepEqual(visibles(), []);
  assert.equal(document.getElementById('aucun-mot-cle').hidden, false);
  champ.value = '';
  champ.dispatchEvent(new Event('input'));
  assert.deepEqual(visibles(), ['1', '2', '3']);
  assert.equal(document.getElementById('glossaire-compte').textContent, '3 mots-clés');
  // la catégorie
  categorie.value = '2';
  categorie.dispatchEvent(new Event('change'));
  assert.deepEqual(visibles(), ['1', '2']);
  assert.equal(document.getElementById('glossaire-compte').textContent, '2 sur 3');
  champ.value = 'feu';
  champ.dispatchEvent(new Event('input'));
  assert.deepEqual(visibles(), ['2'], 'les deux filtres ensemble');
  champ.value = '';
  champ.dispatchEvent(new Event('input'));
  // « Sans catégorie » : les mots-clés à classer
  tableau.append(ligne('5', 'À classer'));
  document.dispatchEvent(new CustomEvent('glossaire:mots-cles', { detail: { gestion: false } }));
  categorie.value = 'sans';
  categorie.dispatchEvent(new Event('change'));
  assert.deepEqual(visibles(), ['5']);
  categorie.value = '2';
  categorie.dispatchEvent(new Event('change'));
  // l'éditeur redessine le tableau (site de dev) et donne les catégories (une créée, une renommée) : relu, liste refaite, la catégorie choisie gardée
  tableau.append(ligne('4', 'Elfe', { 'data-categories': '[2,9]' }));
  document.dispatchEvent(new CustomEvent('glossaire:mots-cles', {
    detail: { gestion: false, categories: [{ id: 2, libelle: 'Magies' }, { id: 3, libelle: 'Race' }, { id: 9, libelle: 'Nouvelle' }] },
  }));
  await attendre();
  assert.deepEqual(categorie.children.map((o) => [o.value || o.getAttribute('value'), o.textContent]), [['', 'Toutes les catégories'], ['sans', 'Sans catégorie'], ['2', 'Magies'], ['3', 'Race'], ['9', 'Nouvelle']], '« Toutes » et « Sans catégorie » gardées en tête');
  assert.equal(categorie.value, '2');
  assert.deepEqual(visibles(), ['1', '2', '4']);
  assert.equal(document.getElementById('glossaire-compte').textContent, '3 sur 5');
  // une catégorie supprimée entre-temps : « toutes »
  document.dispatchEvent(new CustomEvent('glossaire:mots-cles', { detail: { gestion: false, categories: [{ id: 3, libelle: 'Race' }] } }));
  await attendre();
  assert.equal(categorie.value, '');
  assert.deepEqual(visibles(), ['1', '2', '3', '5', '4']);
});

test('Q3, Q4 : les couleurs proposées — toutes les familles de la palette (techniques et « par défaut » comprises), groupées, chaque couleur nommée par son élément', () => {
  const groupes = choixDesCouleurs(ouvrirBase());
  assert.deepEqual(groupes.map((g) => g.famille), Object.keys(FAMILLES_DE_LA_PALETTE));
  assert.deepEqual(Object.keys(NOMS_DES_FAMILLES), Object.keys(FAMILLES_DE_LA_PALETTE), 'chaque famille a son nom');
  const toutes = groupes.flatMap((g) => g.couleurs);
  assert.equal(toutes.length, couleursDeLaPalette().length, 'toutes les couleurs de la palette');
  for (const c of toutes) {
    assert.equal(fauteDeLaCouleur(c.valeur), null, `${c.valeur} : une référence que le service accepte`);
    const lue = lireLaCouleur(c.valeur);
    assert.equal(c.classe, `couleur-${lue.famille}-${lue.id}`, c.valeur);
    assert.match(c.fond, /^#[0-9a-f]{6}$/, c.valeur);
    assert.ok(c.libelle && !c.libelle.includes(':'), c.valeur);
  }
  const libelleDans = (liste) => (valeur) => liste.find((c) => c.valeur === valeur)?.libelle;
  const libelle = libelleDans(toutes);
  // l'élément de référence, tel que la base ou le site le nomme (réponse Q3 : « Feu », « Chakra », « Mithril »…) : l'exemple se lit à l'import (les noms
  // de la base sont modifiables sur le site de dev : skill tests-conventions, « pas de texte figé »)
  const BASE = ['magie:feu', 'magie:espace-temps', 'attribut:chakra', 'materiau:mythril'];
  const MODULES = ['classe:melee', 'race:pure', 'partie:creer', 'magie:par-defaut', 'niveau:3'];
  assert.deepEqual([...BASE, ...MODULES].map(libelleDans(choixDesCouleurs(baseDImport()).flatMap((g) => g.couleurs))),
    ['Feu', 'Espace/Temps', 'Chakra', 'Mythril', 'Physiques Mêlée', 'Race pure', 'Créer son personnage', 'Par défaut', 'Niveau 3']);
  // aujourd'hui : un nom de la base suit la ligne lue par son id (figé), ou, si le site l'a supprimée ou renommée hors de la clé, la clé mise en forme
  const db = ouvrirBase();
  const nomPar = (sql, id) => db.prepare(sql).get(id)?.nom;
  const magie = (id, cle) => {
    const nom = nomPar('SELECT nom FROM magie WHERE id = ?', id);
    return cleDeMagieConnue(nom) === cle ? nom : undefined;
  };
  const courants = [
    magie('magies/magie-du-feu', 'feu'),
    magie('magies/magie-de-lespace-temps', 'espace-temps'),
    nomPar('SELECT libelle AS nom FROM affinite WHERE id = ?', 'chakra'),
    nomPar('SELECT nom FROM ressource WHERE id = ?', 'ressources/armures#materiau:mythril'),
  ];
  assert.deepEqual(BASE.map(libelle), BASE.map((v, i) => courants[i] || libelleDeCle(v.slice(v.indexOf(':') + 1))), 'les noms de la base, lus par id');
  // les libellés des modules du site (CLASS_GROUPS, LIBELLES_ECRITS, PARTIES) : le site de dev ne les écrit pas
  assert.deepEqual(MODULES.map(libelle), ['Physiques Mêlée', 'Race pure', 'Créer son personnage', 'Par défaut', 'Niveau 3']);
  assert.equal(libelleDeCle('fer-noir'), 'Fer noir');
  // sans base : les clés mises en forme, les mêmes couleurs
  assert.equal(choixDesCouleurs().flatMap((g) => g.couleurs).length, toutes.length);
});

test('Q3, Q4 : les options de la liste (aucune, puis les familles) ; une couleur écrite ou inconnue gardée ; le cercle ; la valeur enregistrée', () => {
  const groupes = [
    { famille: 'magie', libelle: 'Magies', couleurs: [{ valeur: 'magie:feu', libelle: 'Feu', classe: 'couleur-magie-feu', fond: '#FF4500' }] },
    { famille: 'race', libelle: 'Natures de race', couleurs: [{ valeur: 'race:pure', libelle: 'Race pure', classe: 'couleur-race-pure', fond: '#2f6a6a' }] },
  ];
  assert.deepEqual(optionsDeCouleur(groupes, 'magie:feu'), [
    { valeur: '', libelle: 'Aucune' },
    { groupe: 'Magies', options: [{ valeur: 'magie:feu', libelle: 'Feu', classe: 'couleur-magie-feu' }] },
    { groupe: 'Natures de race', options: [{ valeur: 'race:pure', libelle: 'Race pure', classe: 'couleur-race-pure' }] },
  ]);
  assert.deepEqual(optionsDeCouleur(groupes, '#12AB9F').at(-1), { valeur: '#12AB9F', libelle: 'Couleur choisie (#12ab9f)', ecrite: true });
  assert.deepEqual(optionsDeCouleur(groupes, 'magie:disparue').at(-1), { valeur: 'magie:disparue', libelle: 'magie:disparue', ecrite: true }, 'jamais perdue');
  assert.equal(optionsDeCouleur(groupes, '').length, 3);
  assert.equal(couleurDuCercle(groupes, 'magie:feu'), '#ff4500', 'le fond de la couleur de la palette');
  assert.equal(couleurDuCercle(groupes, '#ABCDEF'), '#abcdef');
  assert.equal(couleurDuCercle(groupes, ''), '#808080');
  assert.equal(couleurDuCercle(groupes, 'x:y', '#000000'), '#000000');
  assert.deepEqual(['#ABCDEF', ' race:pure ', '', null].map(valeurDeCouleur), ['#abcdef', 'race:pure', '', '']);
});
