// Le Glossaire (/regles/glossaire/ ; réponses du propriétaire du 2026-11-06, Q6 et Q7) : le filtre de sa liste (lib/glossaire-filtre.mjs, dont la
// normalisation est celle de lib/text.mjs#normalize, recopiée : le script de la page n'importe que ce module), son script dans un faux navigateur
// (src/scripts/glossaire.mjs : saisie, ?q=, liste redessinée par l'éditeur), les couleurs proposées à un mot-clé (lib/glossaire-couleurs.mjs : toutes
// les familles de la palette, Q3 et Q4) et leurs options (lib/mots-cles-edition.mjs).
//   node --test test/glossaire-filtre.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { compteDuFiltre, correspond, normaliser, sansBalises, texteDuMotCle } from '../src/lib/glossaire-filtre.mjs';
import { choixDesCouleurs, libelleDeCle, NOMS_DES_FAMILLES } from '../src/lib/glossaire-couleurs.mjs';
import { couleurDuCercle, optionsDeCouleur, valeurDeCouleur } from '../src/lib/mots-cles-edition.mjs';
import { lireLaCouleur } from '../src/lib/mots-cles-liens.mjs';
import { couleursDeLaPalette, FAMILLES_DE_LA_PALETTE, fauteDeLaCouleur } from '../src/lib/palette-css.mjs';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { normalize } from '../src/lib/text.mjs';
import { attendre, el, fauxDocument } from './aide-faux-dom.mjs';

test('normaliser est lib/text.mjs#normalize (recopiée : le script de la page n’importe rien d’autre)', () => {
  for (const t of ['Armure magique', 'Élémentaire', 'Ricken d’or', "l'Arcane", '  Espace/Temps  ', 'CR', 'Œil — de-boeuf', '', 'Mode Hyper 100 %', 'ÇA ÇA']) {
    assert.equal(normaliser(t), normalize(t), t);
  }
  assert.doesNotMatch(readFileSync(new URL('../src/lib/glossaire-filtre.mjs', import.meta.url), 'utf8'), /^import /m, 'sans import');
  assert.deepEqual([...readFileSync(new URL('../src/scripts/glossaire.mjs', import.meta.url), 'utf8').matchAll(/^import .* from '([^']+)';$/gm)].map((m) => m[1]),
    ['../lib/glossaire-filtre.mjs'], 'le script de la page : ce module seul');
});

test('un mot-clé correspond par son libellé, son abréviation ou sa définition (balises lues comme leur texte), sans casse ni accents', () => {
  const am = { libelle: 'Armure magique', abreviation: 'AM', definition: 'Protège des {{sort|sorts}} et du {{mana:}}.' };
  assert.equal(sansBalises(am.definition), 'Protège des sorts et du mana.');
  assert.equal(sansBalises('{{elfe}} et {{feu\\|Feu}}'), 'elfe et Feu', 'une case de tableau (« \\| »)');
  assert.equal(texteDuMotCle(am), 'armure-magique-am-protege-des-sorts-et-du-mana');
  for (const q of ['', '  ', 'armure', 'MAGIQUE', 'am', 'protège', 'protege des', 'sorts', 'mana']) assert.equal(correspond(am, q), true, q);
  for (const q of ['feu', 'sort:', 'armures']) assert.equal(correspond(am, q), q === 'sort:', q);
  assert.equal(correspond({ libelle: 'Feu' }, 'feu'), true, 'sans abréviation ni définition');
  assert.deepEqual([compteDuFiltre(379, 379, ''), compteDuFiltre(1, 1, ' '), compteDuFiltre(3, 379, 'am')], ['379 mots-clés', '1 mot-clé', '3 sur 379']);
});

test('le script de la page : la saisie filtre la liste (compte, « aucun »), ?q= la remplit, la liste redessinée par l’éditeur est relue', async () => {
  const li = (id, libelle, extra = {}) => el('li', { 'data-id': id, 'data-libelle': libelle, ...extra });
  const liste = el('ul', { id: 'liste-mots-cles' }, li('am', 'Armure magique', { 'data-abreviation': 'AM' }), li('feu', 'Feu', { 'data-definition': 'Ce qui {{brule|brûle}}.' }), li('nain', 'Nain'));
  const champ = el('input', { id: 'filtre-glossaire' });
  const document = fauxDocument(el('form', {}, champ, el('span', { id: 'glossaire-compte' })), liste, el('p', { id: 'aucun-mot-cle', hidden: '' }));
  Object.assign(globalThis, { document, location: { search: '?q=brûle' } });
  await import('../src/scripts/glossaire.mjs');
  const visibles = () => liste.children.filter((x) => !x.hidden).map((x) => x.dataset.id);
  assert.equal(champ.value, 'brûle', '?q= dans l’adresse');
  assert.deepEqual(visibles(), ['feu']);
  assert.equal(document.getElementById('glossaire-compte').textContent, '1 sur 3');
  champ.value = 'am';
  champ.dispatchEvent(new Event('input'));
  assert.deepEqual(visibles(), ['am']);
  champ.value = 'zzz';
  champ.dispatchEvent(new Event('input'));
  assert.deepEqual(visibles(), []);
  assert.equal(document.getElementById('aucun-mot-cle').hidden, false);
  champ.value = '';
  champ.dispatchEvent(new Event('input'));
  assert.deepEqual(visibles(), ['am', 'feu', 'nain']);
  assert.equal(document.getElementById('glossaire-compte').textContent, '3 mots-clés');
  // l'éditeur redessine la liste (site de dev) : relue et filtrée comme avant
  liste.append(li('elfe', 'Elfe'));
  champ.value = 'elf';
  document.dispatchEvent(new CustomEvent('glossaire:mots-cles', { detail: { gestion: false } }));
  await attendre();
  assert.deepEqual(visibles(), ['elfe']);
  assert.equal(document.getElementById('glossaire-compte').textContent, '1 sur 4');
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
  const libelle = (valeur) => toutes.find((c) => c.valeur === valeur)?.libelle;
  // l'élément de référence, tel que la base ou le site le nomme (réponse Q3 : « Feu », « Chakra », « Mithril »…)
  assert.deepEqual(['magie:feu', 'magie:espace-temps', 'attribut:chakra', 'materiau:mythril', 'classe:melee', 'race:pure', 'partie:creer', 'magie:par-defaut', 'niveau:3'].map(libelle),
    ['Feu', 'Espace/Temps', 'Chakra', 'Mythril', 'Physiques Mêlée', 'Race pure', 'Créer son personnage', 'Par défaut', 'Niveau 3']);
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
