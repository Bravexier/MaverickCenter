import assert from 'node:assert/strict';
import { test } from 'node:test';
import { alternativesOf, asymmetricChoices, capacitesOfClass, checkSelection, groupByClass, unresolvedCapacites } from '../src/lib/capacites.mjs';

// Fabrique une page de capacité selon le contrat du frontmatter (voir content.config.ts).
const cap = (classe, slug, nom, extra) => ({
  id: `capacites/${classe}-${slug}`,
  data: { title: `${nom} (${classe})`, classe: `classes/${classe}`, ...extra },
});
// Rend les groupes symétriques : chaque membre cite les autres, de gauche à droite.
const group = (...members) => {
  for (const m of members) m.data.choix_exclusif_avec = members.filter((o) => o !== m).map((o) => o.id);
  return members;
};
const ids = (list) => list.map((e) => e.id.replace(/^capacites\//, ''));

// --- Barde (onglet : captures du propriétaire) ---
const prestation = cap('barde', 'prestation', 'Prestation', { niveau: 1, nature: 'classe', rang: 1, ligne: 4 });
const sonPerturbant = cap('barde', 'son-perturbant', 'Son perturbant', { niveau: 5, nature: 'classe', rang: 2, ligne: 10 });
const chantDouble = cap('barde', 'chant-double', 'Chant double', { niveau: 20, nature: 'classe', rang: 3, ligne: 49 });
const danseur = cap('barde', 'danseur', 'Danseur', { niveau: 10, nature: 'specialite', specialite: 'DANSEUR', rang: 1, ligne: 22 });
const menestrel = cap('barde', 'menestrel', 'Ménestrel', { niveau: 10, nature: 'specialite', specialite: 'MÉNESTREL', rang: 2, ligne: 22 });
const choix = (slug, nom, specialite, niveau, rang, ligne) => cap('barde', slug, nom, { niveau, nature: 'choix', specialite, rang, ligne });
const perroquet = choix('perroquet', 'Perroquet', 'DANSEUR', 10, 1, 29);
const contournement = choix('contournement', 'Contournement', 'DANSEUR', 10, 2, 29);
const shrapnel = choix('shrapnel', 'Shrapnel', 'DANSEUR', 15, 1, 36);
const marcheLunaire = choix('marche-lunaire', 'Marche lunaire', 'DANSEUR', 15, 2, 36);
const badauds = choix('a-bas-les-badauds', 'A bas les Badauds', 'DANSEUR', 20, 1, 43);
const bain = choix('bain-de-foules', 'Bain de foules', 'DANSEUR', 20, 2, 43);
const nouvelAccord = choix('nouvel-accord', 'Nouvel accord', 'MÉNESTREL', 10, 1, 29);
const echo = choix('echo', 'Écho', 'MÉNESTREL', 10, 2, 29);
const balade = choix('balade-guerriere', 'Balade guerrière', 'MÉNESTREL', 15, 1, 36);
const amplification = choix('amplification', 'Amplification', 'MÉNESTREL', 15, 2, 36);
const exaltation = choix('exaltation', 'Exaltation', 'MÉNESTREL', 20, 1, 43);
const touerk = choix('touerk', 'Touérk !', 'MÉNESTREL', 20, 2, 43);
group(danseur, menestrel);
for (const g of [[perroquet, contournement], [shrapnel, marcheLunaire], [badauds, bain], [nouvelAccord, echo], [balade, amplification], [exaltation, touerk]]) group(...g);

const barde = { id: 'classes/barde', data: { title: 'Barde' } };
const BARDE = [barde, prestation, sonPerturbant, chantDouble, danseur, menestrel, perroquet, contournement, shrapnel, marcheLunaire, badauds, bain, nouvelAccord, echo, balade, amplification, exaltation, touerk];

// --- Archimage : pas de spécialité, des groupes de 2 ou 3 sur une même ligne ---
const arch = (slug, nom, niveau, nature, rang, ligne) => cap('archimage', slug, nom, { niveau, nature, rang, ligne });
const elementaliste = arch('elementaliste', 'Élémentaliste', 10, 'choix', 1, 18);
const occultiste = arch('occultiste', 'Occultiste', 10, 'choix', 2, 18);
const creation = arch('creation-vivante', 'Création vivante', 10, 'choix', 1, 22);
const tempus = arch('tempus-figus', 'Tempus Figus', 10, 'choix', 2, 22);
const obedience = arch('obedience', 'Obédience', 10, 'choix', 3, 22);
const moissonneur = arch('moissonneur', 'Moissonneur', 15, 'choix', 1, 28);
const rituel = arch('rituel-interdit', 'Rituel Interdit', 15, 'choix', 2, 28);
const pacte = arch('pacte-noire', 'Pacte Noire', 15, 'choix', 3, 28);
const choixCap = arch('choix', 'Choix', 20, 'choix', 1, 34);
const cameleon = arch('cameleon', 'Caméléon', 20, 'choix', 2, 34);
const adaptation = arch('adaptation', 'Adaptation', 20, 'choix', 3, 34);
const semiComplet = arch('semi-complet', 'Semi complet', 20, 'classe', 1, 39);
for (const g of [[elementaliste, occultiste], [creation, tempus, obedience], [moissonneur, rituel, pacte], [choixCap, cameleon, adaptation]]) group(...g);
const archimage = { id: 'classes/archimage', data: { title: 'Archimage' } };
const ARCHIMAGE = [archimage, elementaliste, occultiste, creation, tempus, obedience, moissonneur, rituel, pacte, choixCap, cameleon, adaptation, semiComplet];
const ALL = [...BARDE, ...ARCHIMAGE];

test('Barde : capacités de classe sans choix, puis chaque spécialité avec sa capacité et ses trois groupes de deux', () => {
  const r = capacitesOfClass(ALL, barde);
  assert.deepEqual(ids(r.automatiques), ['barde-prestation', 'barde-son-perturbant', 'barde-chant-double']);
  assert.deepEqual(r.specialites.map((s) => s.nom), ['DANSEUR', 'MÉNESTREL']);
  const menestrelSpec = r.specialites[1];
  assert.equal(menestrelSpec.cartouche.id, 'capacites/barde-menestrel');
  assert.deepEqual(menestrelSpec.groupes.map((g) => [g.niveau, ids(g.options)]), [
    [10, ['barde-nouvel-accord', 'barde-echo']],
    [15, ['barde-balade-guerriere', 'barde-amplification']],
    [20, ['barde-exaltation', 'barde-touerk']],
  ]);
  assert.deepEqual(r.groupes, [], 'le Barde n’a pas de groupe hors spécialité');
});

test('Archimage : une capacité sans choix, quatre groupes (2, 3, 3, 3) ordonnés de haut en bas, aucune spécialité', () => {
  const r = capacitesOfClass(ALL, archimage);
  assert.deepEqual(ids(r.automatiques), ['archimage-semi-complet']);
  assert.deepEqual(r.specialites, []);
  assert.deepEqual(r.groupes.map((g) => [g.niveau, ids(g.options)]), [
    [10, ['archimage-elementaliste', 'archimage-occultiste']],
    [10, ['archimage-creation-vivante', 'archimage-tempus-figus', 'archimage-obedience']],
    [15, ['archimage-moissonneur', 'archimage-rituel-interdit', 'archimage-pacte-noire']],
    [20, ['archimage-choix', 'archimage-cameleon', 'archimage-adaptation']],
  ]);
});

test('alternativesOf : les capacités de la même ligne, dans les deux sens, sans doublon', () => {
  assert.deepEqual(ids(alternativesOf(ALL, echo)), ['barde-nouvel-accord']);
  assert.deepEqual(ids(alternativesOf(ALL, tempus)), ['archimage-creation-vivante', 'archimage-obedience']);
  assert.deepEqual(alternativesOf(ALL, prestation), []);
  const unilateral = [cap('x', 'a', 'A', { niveau: 1, nature: 'choix' }), cap('x', 'b', 'B', { niveau: 1, nature: 'choix' })];
  unilateral[0].data.choix_exclusif_avec = [unilateral[1].id];
  assert.deepEqual(ids(alternativesOf(unilateral, unilateral[1])), ['x-a'], 'la relation est lue dans les deux sens');
});

test('exemple du propriétaire : un Barde Ménestrel valide avec Ménestrel, Nouvel accord, Balade guerrière, Exaltation et Chant double', () => {
  const choisi = [menestrel, nouvelAccord, balade, exaltation, chantDouble, prestation, sonPerturbant].map((e) => e.id);
  assert.deepEqual(checkSelection(ALL, choisi), { ok: true, conflits: [], inconnues: [] });
});

test('exemple du propriétaire : pas Écho avec Nouvel accord, pas Amplification avec Balade guerrière, pas Touérk ! avec Exaltation', () => {
  for (const [a, b] of [[nouvelAccord, echo], [balade, amplification], [exaltation, touerk]]) {
    const r = checkSelection(ALL, [menestrel.id, a.id, b.id]);
    assert.equal(r.ok, false);
    assert.deepEqual(r.conflits, [{ a: a.id, b: b.id, raison: 'meme-choix' }]);
  }
});

test('exemple du propriétaire : une spécialité exclut l’autre, et toutes les capacités de l’autre spécialité', () => {
  assert.deepEqual(checkSelection(ALL, [menestrel.id, danseur.id]).conflits, [{ a: menestrel.id, b: danseur.id, raison: 'meme-choix' }]);
  const r = checkSelection(ALL, [menestrel.id, perroquet.id]);
  assert.equal(r.ok, false);
  assert.deepEqual(r.conflits, [{ a: menestrel.id, b: perroquet.id, raison: 'autre-specialite' }]);
  assert.deepEqual(checkSelection(ALL, [nouvelAccord.id, shrapnel.id]).conflits, [{ a: nouvelAccord.id, b: shrapnel.id, raison: 'autre-specialite' }]);
});

test('exemple du propriétaire : Archimage, Élémentaliste ou Occultiste ET un choix parmi trois ; Semi complet en plus', () => {
  assert.equal(checkSelection(ALL, [elementaliste.id, creation.id, moissonneur.id, cameleon.id, semiComplet.id]).ok, true);
  assert.equal(checkSelection(ALL, [elementaliste.id, occultiste.id]).ok, false);
  assert.deepEqual(checkSelection(ALL, [creation.id, tempus.id, obedience.id]).conflits.map((c) => `${c.a}|${c.b}`), [
    'capacites/archimage-creation-vivante|capacites/archimage-tempus-figus',
    'capacites/archimage-creation-vivante|capacites/archimage-obedience',
    'capacites/archimage-tempus-figus|capacites/archimage-obedience',
  ]);
  assert.equal(checkSelection(ALL, [semiComplet.id, choixCap.id]).ok, true);
  assert.equal(checkSelection(ALL, [choixCap.id, cameleon.id]).ok, false);
});

test('une capacité choisie deux fois, ou inconnue, est rapportée sans faire échouer le contrôle', () => {
  const r = checkSelection(ALL, [prestation.id, prestation.id, 'capacites/inconnue']);
  assert.deepEqual(r.inconnues, ['capacites/inconnue']);
  assert.deepEqual(r.conflits, [], 'une capacité n’entre pas en conflit avec elle-même');
});

test('asymmetricChoices signale une exclusivité déclarée dans un seul sens', () => {
  const a = cap('x', 'a', 'A', { niveau: 1, nature: 'choix' });
  const b = cap('x', 'b', 'B', { niveau: 1, nature: 'choix' });
  a.data.choix_exclusif_avec = [b.id];
  assert.deepEqual(asymmetricChoices([a, b]), [{ de: a.id, vers: b.id }]);
  assert.deepEqual(asymmetricChoices(ALL), []);
});

test('unresolvedCapacites : classe ou alternative qui ne désigne aucune page', () => {
  const faux = cap('barde', 'faux', 'Faux', { niveau: 10, nature: 'choix', rang: 1 });
  faux.data.choix_exclusif_avec = ['capacites/barde-n-existe-pas'];
  faux.data.classe = 'classes/inconnue';
  assert.deepEqual(unresolvedCapacites([...BARDE, faux]), [
    { id: faux.id, champ: 'classe', valeur: 'classes/inconnue' },
    { id: faux.id, champ: 'choix_exclusif_avec', valeur: 'capacites/barde-n-existe-pas' },
  ]);
  assert.deepEqual(unresolvedCapacites(ALL), []);
});

test('les capacités d’une autre classe ne se mélangent pas', () => {
  assert.equal(capacitesOfClass(ALL, archimage).automatiques.length, 1);
  assert.equal(capacitesOfClass(ALL, barde).automatiques.length, 3);
  assert.deepEqual(capacitesOfClass(ALL, { id: 'classes/vide', data: { title: 'Vide' } }), { automatiques: [], specialites: [], groupes: [] });
});

test('groupByClass : une section par classe, triées par titre de classe ; capacités dans l’ordre de l’onglet', () => {
  const groups = groupByClass(ALL);
  assert.deepEqual(groups.map((g) => g.classe.id), ['classes/archimage', 'classes/barde']);
  const bardeGroup = groups[1];
  assert.deepEqual(bardeGroup.entries.slice(0, 4).map((e) => e.id.replace('capacites/barde-', '')), ['prestation', 'son-perturbant', 'danseur', 'menestrel']);
  assert.equal(bardeGroup.entries.length, 17);
  assert.equal(groups[0].entries.length, 12);
});

test('groupByClass : une capacité dont la classe est inconnue n’est pas perdue', () => {
  const orpheline = cap('fantome', 'x', 'X', { niveau: 1, nature: 'classe', rang: 1, ligne: 1 });
  const groups = groupByClass([...BARDE, orpheline]);
  assert.equal(groups.at(-1).classe, null);
  assert.deepEqual(groups.at(-1).entries.map((e) => e.id), [orpheline.id]);
});
