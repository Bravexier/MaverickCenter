// Texte des retraits (décision R42 ; src/lib/fiche-format.mjs) : un don, une spécialité, un sort ou un métier que les règles suppriment est retiré des
// fiches, et une ligne datée par élément s'ajoute à la fin des notes. Fonctions pures, partagées par le service (serveur/fiches-retraits.mjs) et la page
// /fiche/ (bannière, message d'un conflit de version).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ajouterAuxNotes, descriptionDuRetrait, jourDuRetrait, ligneDeRetrait, nouveauxRetraits, ORDRE_DES_NATURES, ordreDesRetraits, PREFIXE_DE_RETRAIT,
  resumeDesRetraits, retraitsDesNotes,
} from '../src/lib/fiche-format.mjs';

const BOTTE = { nature: 'capacite', id: 'capacites/bretteur-botte-secrete', nom: 'Botte secrète', classe: 'Bretteur des dunes', specialite: 'LAME COURBE', niveau: 20 };

test('jourDuRetrait : le jour UTC de l’instant, au format JJ/MM/AAAA ; un instant mal formé est refusé', () => {
  assert.equal(jourDuRetrait('2026-10-11T23:59:59Z'), '11/10/2026');
  assert.equal(jourDuRetrait('2026-01-02T00:00:00Z'), '02/01/2026');
  for (const faux of ['hier', '2026-10-11T23:59:59', '2026-10-11', '2026-13-45T00:00:00Z', null, undefined, 20261011]) {
    assert.throws(() => jourDuRetrait(faux), /instant mal formé/, String(faux));
  }
});

test('descriptionDuRetrait : don, spécialité (et ses dons choisis), sort (NPM, NM de la fiche), métier ; un nom absent est remplacé par l’id', () => {
  assert.equal(descriptionDuRetrait(BOTTE), 'le don « Botte secrète » (classe Bretteur des dunes, spécialité LAME COURBE, niveau 20)');
  assert.equal(descriptionDuRetrait({ nature: 'capacite', id: 'x', nom: 'Rage', classe: 'Guerrier', specialite: null, niveau: 5 }), 'le don « Rage » (classe Guerrier, niveau 5)');
  assert.equal(descriptionDuRetrait({ nature: 'capacite', id: 'x', nom: 'Rage', niveau: 5 }), 'le don « Rage » (niveau 5)', 'classe absente');
  assert.equal(descriptionDuRetrait({ nature: 'capacite', id: 'capacites/x', nom: null }), 'le don « capacites/x »', 'sans partie : pas de parenthèses');

  const lame = { nature: 'specialite', id: 'classes/b#specialite:lame-courbe', nom: 'LAME COURBE', classe: 'Bretteur des dunes' };
  assert.equal(descriptionDuRetrait(lame), 'la spécialité « LAME COURBE » (classe Bretteur des dunes)');
  assert.equal(descriptionDuRetrait({ ...lame, dons: [] }), 'la spécialité « LAME COURBE » (classe Bretteur des dunes)');
  assert.equal(descriptionDuRetrait({ ...lame, dons: ['A'] }), 'la spécialité « LAME COURBE » (classe Bretteur des dunes, avec le don choisi « A »)');
  assert.equal(descriptionDuRetrait({ ...lame, dons: ['A', 'B'] }), 'la spécialité « LAME COURBE » (classe Bretteur des dunes, avec les dons choisis « A » et « B »)');
  assert.equal(descriptionDuRetrait({ ...lame, dons: ['A', 'B', 'C'] }), 'la spécialité « LAME COURBE » (classe Bretteur des dunes, avec les dons choisis « A », « B » et « C »)');

  const boule = { nature: 'sort', id: 'magies/magie-du-feu#sort:boule-de-feu', nom: 'Boule de feu', magie: 'Feu', npm: 2 };
  assert.equal(descriptionDuRetrait({ ...boule, nm: 0, nm_livre: 0, nm_cadeau: 0 }), 'le sort « Boule de feu » (magie Feu, NPM 2)');
  assert.equal(descriptionDuRetrait({ ...boule, nm: 2, nm_livre: 0, nm_cadeau: 0 }), 'le sort « Boule de feu » (magie Feu, NPM 2, 2 NM sur cette fiche)');
  assert.equal(descriptionDuRetrait({ ...boule, nm: 2, nm_livre: 1, nm_cadeau: 1 }), 'le sort « Boule de feu » (magie Feu, NPM 2, 2 NM sur cette fiche dont 1 de livre et 1 du MJ)');
  assert.equal(descriptionDuRetrait({ ...boule, nm: 3, nm_livre: 0, nm_cadeau: 2 }), 'le sort « Boule de feu » (magie Feu, NPM 2, 3 NM sur cette fiche dont 2 du MJ)');
  assert.equal(descriptionDuRetrait({ ...boule, nm: 1, nm_livre: 1, nm_cadeau: 0 }), 'le sort « Boule de feu » (magie Feu, NPM 2, 1 NM sur cette fiche dont 1 de livre)');

  assert.equal(descriptionDuRetrait({ nature: 'metier', id: 'metiers/forgeron', nom: 'Forgeron' }), 'le métier « Forgeron »');
  assert.equal(descriptionDuRetrait({ nature: 'metier', id: 'metiers/forgeron', nom: null }), 'le métier « metiers/forgeron »');
  assert.throws(() => descriptionDuRetrait({ nature: 'race', id: 'races/x' }), /nature de retrait inconnue/);
  // une arme supprimée (décision R52) : sa famille et son emplacement
  assert.equal(descriptionDuRetrait({ nature: 'arme', id: 'a', nom: 'Katana', famille: 'ÉPÉES', rang: 1 }), 'l’arme « Katana » (ÉPÉES, arme 1)');
});

test('ligneDeRetrait : la ligne exacte, datée, neutre (« n’existe plus dans les règles »), qui invite à s’adapter', () => {
  assert.equal(ligneDeRetrait(BOTTE, '2026-10-11T08:30:00Z'),
    '[11/10/2026] Retrait (règles modifiées) : le don « Botte secrète » (classe Bretteur des dunes, spécialité LAME COURBE, niveau 20) n’existe plus dans les règles. Choisissez autre chose ou adaptez la fiche à la nouvelle règle.');
  assert.ok(ligneDeRetrait(BOTTE, '2026-10-11T08:30:00Z').startsWith(`[11/10/2026] ${PREFIXE_DE_RETRAIT}`));
  assert.throws(() => ligneDeRetrait(BOTTE, 'hier'), /instant mal formé/);
});

test('ajouterAuxNotes : le texte du joueur reste un préfixe exact, une ligne par élément, aucune ligne vide insérée', () => {
  const lignes = ['L-a', 'L-b'];
  assert.equal(ajouterAuxNotes(null, lignes), 'L-a\nL-b');
  assert.equal(ajouterAuxNotes(undefined, ['L-a']), 'L-a');
  assert.equal(ajouterAuxNotes('', lignes), 'L-a\nL-b');
  assert.equal(ajouterAuxNotes('Texte', lignes), 'Texte\nL-a\nL-b');
  assert.equal(ajouterAuxNotes('Texte\n', lignes), 'Texte\nL-a\nL-b');
  assert.equal(ajouterAuxNotes('L1\nL2', ['L-a']), 'L1\nL2\nL-a');
  for (const notes of ['Texte', 'Texte\n', 'L1\nL2', '  espaces  ', 'fin\n\n']) {
    const r = ajouterAuxNotes(notes, lignes);
    assert.ok(r.startsWith(notes), JSON.stringify(notes));
    assert.equal(r.split('\n').length, notes.split('\n').length + lignes.length - (notes.endsWith('\n') ? 1 : 0), JSON.stringify(notes));
    assert.ok(!r.slice(notes.length).includes('\n\n'), 'pas de ligne vide ajoutée');
  }
});

test('retraitsDesNotes : relit les lignes de ligneDeRetrait, ignore celles du joueur (même si « Retrait » y figure), plusieurs dates', () => {
  const a = ligneDeRetrait(BOTTE, '2026-10-11T08:30:00Z');
  const b = ligneDeRetrait({ nature: 'metier', id: 'metiers/forgeron', nom: 'Forgeron' }, '2026-11-02T10:00:00Z');
  const notes = ['Note du joueur.', 'Le Retrait (règles modifiées) : ma propre phrase', a, '[11/10/2026] Retrait du joueur', b].join('\n');
  assert.deepEqual(retraitsDesNotes(notes), [
    { jour: '11/10/2026', ligne: a, texte: a.slice('[11/10/2026] '.length + PREFIXE_DE_RETRAIT.length) },
    { jour: '02/11/2026', ligne: b, texte: b.slice('[02/11/2026] '.length + PREFIXE_DE_RETRAIT.length) },
  ]);
  assert.deepEqual(retraitsDesNotes(null), []);
  assert.deepEqual(retraitsDesNotes(''), []);
  assert.deepEqual(retraitsDesNotes('Rien\r\nde spécial'), []);
  assert.equal(retraitsDesNotes(`Avant\r\n${a}\r\n`).length, 1, 'fins de ligne Windows');
});

test('nouveauxRetraits : les lignes de retrait apparues depuis l’ouverture de la fiche', () => {
  const a = ligneDeRetrait(BOTTE, '2026-10-11T08:30:00Z');
  const b = ligneDeRetrait({ nature: 'metier', id: 'metiers/forgeron', nom: 'Forgeron' }, '2026-10-12T08:30:00Z');
  assert.deepEqual(nouveauxRetraits('Note', `Note\n${a}`).map((r) => r.ligne), [a]);
  assert.deepEqual(nouveauxRetraits(`Note\n${a}`, `Note\n${a}\n${b}`).map((r) => r.ligne), [b]);
  assert.deepEqual(nouveauxRetraits(`Note\n${a}`, `Note modifiée\n${a}`), []);
  assert.deepEqual(nouveauxRetraits(null, null), []);
  assert.deepEqual(nouveauxRetraits(null, a).length, 1);
});

test('resumeDesRetraits : rien sans ligne ; singulier ; pluriel avec le jour le plus récent (comparé en AAAA-MM-JJ)', () => {
  assert.equal(resumeDesRetraits(null), null);
  assert.equal(resumeDesRetraits('Note du joueur.'), null);
  const un = ligneDeRetrait(BOTTE, '2026-10-11T08:30:00Z');
  assert.deepEqual(resumeDesRetraits(`Note\n${un}`), { nombre: 1, dernier: '11/10/2026', texte: 'Règles modifiées : 1 élément retiré de cette fiche le 11/10/2026.' });
  // le 28/09/2027 est plus récent que le 30/12/2026 : une comparaison du texte JJ/MM le classerait avant
  const lignes = [ligneDeRetrait(BOTTE, '2027-09-28T08:00:00Z'), ligneDeRetrait(BOTTE, '2026-12-30T08:00:00Z'), un];
  assert.deepEqual(resumeDesRetraits(lignes.join('\n')),
    { nombre: 3, dernier: '28/09/2027', texte: 'Règles modifiées : 3 éléments retirés de cette fiche (dernier retrait le 28/09/2027).' });
});

test('objet supprimé de la base (décision R60) : la fiche le garde sous son nom, la note le dit et demande la mise à jour', () => {
  const d = { nature: 'objet', id: 'ressources/equipement-inventaire#materiel:corde-1m', nom: 'Corde (1m)', emplacement: 'ceinture' };
  assert.equal(descriptionDuRetrait(d), 'l’objet « Corde (1m) » (ceinture)');
  assert.equal(ligneDeRetrait(d, '2026-10-14T12:00:00Z'),
    `[14/10/2026] ${PREFIXE_DE_RETRAIT}l’objet « Corde (1m) » (ceinture) a été supprimé de la base ; il reste dans la fiche sous son nom : veuillez la mettre à jour.`);
});

test('pièce d’armure (décision R95) : une pièce que la fiche ne porte plus, ou devenue l’armure complète de la fiche', () => {
  const d = { nature: 'piece_armure', id: 'ressources/armures#armure:cuir-peau', nom: 'Armure Cuir/Peau', emplacement: 'Torse' };
  assert.equal(descriptionDuRetrait(d), 'la pièce d’armure « Armure Cuir/Peau » (Torse)');
  const fin = 'une fiche n’a plus qu’une armure complète (son amélioration et son élément pour l’armure entière). Adaptez la fiche.';
  assert.equal(ligneDeRetrait(d, '2026-10-16T12:00:00Z'), `[16/10/2026] ${PREFIXE_DE_RETRAIT}la pièce d’armure « Armure Cuir/Peau » (Torse) n’est plus portée : ${fin}`);
  assert.equal(ligneDeRetrait({ ...d, devenue: true }, '2026-10-16T12:00:00Z'),
    `[16/10/2026] ${PREFIXE_DE_RETRAIT}la pièce d’armure « Armure Cuir/Peau » (Torse) est devenue l’armure complète de la fiche : ${fin}`);
  assert.equal(ligneDeRetrait({ ...d, armureGardee: true }, '2026-10-16T12:00:00Z'),
    `[16/10/2026] ${PREFIXE_DE_RETRAIT}la pièce d’armure « Armure Cuir/Peau » (Torse) reste l’armure de la fiche, sans l’amélioration ni l’élément propres à cette pièce : ${fin}`);
});

test('matériau de bouclier (R96) et accessoire (R97) : la description, puis la fin de la ligne', () => {
  const m = { nature: 'materiau_bouclier', id: 'ressources/armures#materiau:bois', nom: 'Bois', quantite: 2, matiere: 'Fer' };
  assert.equal(descriptionDuRetrait(m), 'le matériau de bouclier « Bois » (×2)');
  assert.equal(ligneDeRetrait(m, '2026-10-17T12:00:00Z'),
    `[17/10/2026] ${PREFIXE_DE_RETRAIT}le matériau de bouclier « Bois » (×2) n’est plus dans le bouclier : un bouclier n’a plus qu’une forme et une matière (« Fer », son premier matériau). Adaptez la fiche.`);
  const a = { nature: 'accessoire', id: 'collier', nom: 'Collier du vent', emplacement: 'Collier', effet: '+5 Santé', texte: 'Brille', ecarte: false };
  assert.equal(descriptionDuRetrait(a), 'l’accessoire « Collier du vent » (Collier, effet « +5 Santé », effet hors table « Brille »)');
  assert.equal(ligneDeRetrait(a, '2026-10-17T12:00:00Z'),
    `[17/10/2026] ${PREFIXE_DE_RETRAIT}l’accessoire « Collier du vent » (Collier, effet « +5 Santé », effet hors table « Brille ») reste porté avec son effet : la fiche ne garde plus le nom d’un accessoire ni son effet hors table.`);
  assert.equal(descriptionDuRetrait({ nature: 'accessoire', id: 'ceinture', nom: null, emplacement: 'Ceinture', effet: null, texte: null, ecarte: true }),
    'l’accessoire de l’emplacement Ceinture');
});

test('ordreDesRetraits : métier, spécialité, don, sort, puis par nom', () => {
  assert.deepEqual([...ORDRE_DES_NATURES], ['metier', 'specialite', 'capacite', 'sort', 'arme', 'objet', 'piece_armure', 'materiau_bouclier', 'accessoire', 'acquis']);
  const elements = [
    { nature: 'sort', id: 's2', nom: 'Zéphyr' }, { nature: 'sort', id: 's1', nom: 'Aura' }, { nature: 'capacite', id: 'k2', nom: 'Don 10' },
    { nature: 'capacite', id: 'k1', nom: 'Don 9' }, { nature: 'specialite', id: 'sp', nom: 'LAME' }, { nature: 'metier', id: 'm', nom: 'Forgeron' },
    { nature: 'capacite', id: 'k3', nom: null },
  ];
  assert.deepEqual([...elements].sort(ordreDesRetraits).map((e) => e.id), ['m', 'sp', 'k1', 'k2', 'k3', 's1', 's2']);
});
