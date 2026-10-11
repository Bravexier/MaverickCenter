// Création et suppression des spécialités et des dons depuis le site de dev (D11) : la partie pure (lib/dons-edition.mjs), sur des grilles
// synthétiques qui imitent un onglet du classeur (Guerrier, Archimage) ; `donnees` des 660 fiches de la base : test/corps-classes.test.mjs.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  alternativesDe, consequences, donneesDeDon, groupeDe, idDeDon, idDeSpecialite, listeDeFiches, motsClesDeDon, natureHorsSpecialite, NIVEAU_DES_SPECIALITES,
  NIVEAUX_DE_DON, operationsDuLot, permissions, placeNouvelleLigne, SPECIALITES_MAX, titreDeDon, TYPES_DE_DON_SAISIE, typeBrutDeSaisie,
} from '../src/lib/dons-edition.mjs';
import { analyserTypeDeDon } from '../src/lib/classe-champs.mjs';
import { ENTITES } from '../src/lib/edition-modele.mjs';

const C = 'classes/guerrier';
const EP = `${C}#specialite:epeiste`;
const MA = `${C}#specialite:maitre-darme`;
const don = (slug, specialite_id, niveau, nature, ligne, rang, nom = slug) => ({
  id: `capacites/guerrier-${slug}`, classe_id: C, specialite_id, niveau, nature, ligne, rang, nom, nom_cle: slug, type_brut: 'Passif',
});
/** La grille du Guerrier telle que l'import l'a écrite (lignes 4, 11, 22, 29, 36, 43, 49). */
const GUERRIER = [
  don('contact', null, 1, 'classe', 4, 1, 'Contact'),
  don('brave', null, 5, 'classe', 11, 1, 'Brave'),
  don('epeiste', EP, 10, 'specialite', 22, 1, 'Épéiste'),
  don('maitre-darme', MA, 10, 'specialite', 22, 1, 'Maître d’arme'),
  don('duelliste', EP, 10, 'choix', 29, 1, 'Duelliste'),
  don('coup-dur', EP, 10, 'choix', 29, 2, 'Coup dur'),
  don('bien-equipe', MA, 10, 'choix', 29, 1),
  don('moi-aussi', MA, 10, 'choix', 29, 2),
  don('affute', EP, 15, 'choix', 36, 1, 'Affuté'),
  don('expert-mordhau', EP, 15, 'choix', 36, 2, 'Expert Mordhau'),
  don('coup-parfait', MA, 15, 'choix', 36, 1),
  don('contre-coup', MA, 15, 'choix', 36, 2),
  don('contre-attaque', EP, 20, 'choix', 43, 1),
  don('tout-ou-rien', EP, 20, 'choix', 43, 2),
  don('contre-riposte', MA, 20, 'choix', 43, 1),
  don('desarmement', MA, 20, 'choix', 43, 2),
  don('hyper-contact', null, 20, 'classe', 49, 1, 'Hyper contact'),
];
const SPECIALITES = [
  { id: EP, classe_id: C, rang: 1, nom: 'ÉPÉISTE', nom_cle: 'epeiste' },
  { id: MA, classe_id: C, rang: 2, nom: "MAÎTRE D'ARME", nom_cle: 'maitre-darme' },
];

test('constantes : niveaux du classeur, spécialité au niveau 10, deux spécialités, les cinq mots de type reconnus', () => {
  assert.deepEqual(NIVEAUX_DE_DON, [1, 5, 10, 15, 20]);
  assert.equal(NIVEAU_DES_SPECIALITES, 10);
  assert.equal(SPECIALITES_MAX, 2);
  for (const t of TYPES_DE_DON_SAISIE) assert.ok(analyserTypeDeDon(typeBrutDeSaisie(t.valeur, '2 fois/combat')).type, t.valeur);
  assert.equal(typeBrutDeSaisie('Actif', '2 fois/combat'), 'Actif (2 fois/combat)');
  assert.equal(typeBrutDeSaisie('Passif', null), 'Passif');
  assert.deepEqual(analyserTypeDeDon(typeBrutDeSaisie('Actif', '2 fois/combat')), { type: 'actif', limite_nombre: 2, limite_periode: 'combat' });
  // modèle partagé : création et suppression des spécialités et des dons
  assert.equal(ENTITES.specialite.suppression, true);
  assert.equal(ENTITES.capacite.suppression, true);
  assert.equal(ENTITES.specialite.nouveau, 'Nouvelle spécialité');
  assert.deepEqual(ENTITES.capacite.champs.niveau.choix.map((c) => c.valeur), ['1', '5', '10', '15', '20']);
});

test('idDeDon : slug du nom, puis -niveau, -niveau-rang, -2… ; jamais un id pris', () => {
  const pris = (ids) => (id) => ids.includes(id);
  assert.equal(idDeDon({ slugClasse: 'guerrier', nom: 'Coup de grâce', niveau: 15, rang: 1 }, pris([])), 'capacites/guerrier-coup-de-grace');
  assert.equal(idDeDon({ slugClasse: 'guerrier', nom: 'Affuté', niveau: 15, rang: 3 }, pris(['capacites/guerrier-affute'])), 'capacites/guerrier-affute-15');
  // nom sans lettre ni chiffre (« … ² » du Grenadier) : -niveau d'emblée
  assert.equal(idDeDon({ slugClasse: 'grenadier', nom: '... ²', niveau: 20, rang: 2 }, pris([])), 'capacites/grenadier-20');
  assert.equal(idDeDon({ slugClasse: 'guerrier', nom: 'Affuté', niveau: 15, rang: 3 }, pris(['capacites/guerrier-affute', 'capacites/guerrier-affute-15'])),
    'capacites/guerrier-affute-15-3');
  assert.equal(idDeDon({ slugClasse: 'guerrier', nom: 'Affuté', niveau: 15, rang: 3 },
    pris(['capacites/guerrier-affute', 'capacites/guerrier-affute-15', 'capacites/guerrier-affute-15-3', 'capacites/guerrier-affute-15-3-2'])),
  'capacites/guerrier-affute-15-3-3');
  // « pris » est fourni par le service : ligne existante, historique, journal, clé de cle_page
  const vus = [];
  const id = idDeDon({ slugClasse: 'orios', nom: 'Chaman', niveau: 10, rang: 1 }, (x) => (vus.push(x), x === 'capacites/orios-chaman'));
  assert.equal(id, 'capacites/orios-chaman-10');
  assert.deepEqual(vus, ['capacites/orios-chaman', 'capacites/orios-chaman-10']);
});

test('idDeSpecialite : <classe>#specialite:<nom>, puis -2, -3 si l’id est pris (spécialité renommée qui garde l’ancien, supprimée)', () => {
  assert.equal(idDeSpecialite(C, 'Bretteur', () => false), `${C}#specialite:bretteur`);
  assert.equal(idDeSpecialite(C, 'Épéiste', (id) => id === EP), `${EP}-2`);
  assert.equal(idDeSpecialite(C, 'Épéiste', (id) => [EP, `${EP}-2`].includes(id)), `${EP}-3`);
});

test('titreDeDon : « Nom (Classe) », sinon « , niveau N », sinon null', () => {
  assert.equal(titreDeDon({ nom: 'Riposte', classeNom: 'Guerrier', niveau: 15 }, () => false), 'Riposte (Guerrier)');
  assert.equal(titreDeDon({ nom: 'Riposte', classeNom: 'Guerrier', niveau: 15 }, (c) => c === 'riposte-guerrier'), 'Riposte (Guerrier), niveau 15');
  assert.equal(titreDeDon({ nom: 'Riposte', classeNom: 'Guerrier', niveau: 15 }, () => true), null);
});

test('placeNouvelleLigne : à la fin de son niveau, sur un numéro libre de toute la classe', () => {
  assert.equal(placeNouvelleLigne(GUERRIER, { niveau: 1 }), 5, 'après Contact (4), avant Brave (11)');
  assert.equal(placeNouvelleLigne(GUERRIER, { niveau: 10 }), 23, 'hors spécialité, après l’étage des spécialités (22)');
  assert.equal(placeNouvelleLigne(GUERRIER, { niveau: 20 }), 56, 'après Hyper contact (49) : bas + 7');
  assert.equal(placeNouvelleLigne(GUERRIER, { specialiteId: EP, niveau: 15 }), 37, 'spécialité : après la ligne 36, avant 43');
  assert.equal(placeNouvelleLigne(GUERRIER, { specialiteId: EP, niveau: 10 }), 30);
  assert.equal(placeNouvelleLigne(GUERRIER, { specialiteId: EP, niveau: 20 }), 50, 'bas = 43, puis 50 (libre)');
  // classe sans don : 7, puis 14
  assert.equal(placeNouvelleLigne([], { niveau: 1 }), 7);
  assert.equal(placeNouvelleLigne([{ ...GUERRIER[0], ligne: 7 }], { niveau: 1 }), 14);
  // lignes occupées (par une autre spécialité, ou un don hors spécialité) sautées
  const occupe = [...GUERRIER, { ...don('x', MA, 15, 'choix', 37, 1), id: 'capacites/x' }];
  assert.equal(placeNouvelleLigne(occupe, { specialiteId: EP, niveau: 15 }), 38);
  const plein = [...GUERRIER, ...[5, 6, 7, 8, 9, 10].map((l) => ({ ...don(`p${l}`, null, 1, 'classe', l, 1), id: `capacites/p${l}` }))];
  assert.equal(placeNouvelleLigne(plein, { niveau: 1 }), null, 'plus de place entre 4 et 11');
  assert.equal(placeNouvelleLigne([...GUERRIER, { ...don('y', null, 20, 'classe', 56, 1), id: 'capacites/y' }], { niveau: 20 }), 63);
  // classe créée sur le site, avec sa seule spécialité (ligne 7) : rien en dessous, vers le milieu de l'écart (un niveau plus bas aura sa place)
  const neuve = [{ ...don('lame', 'classes/x#specialite:lame', 10, 'specialite', 7, 1), classe_id: 'classes/x' }];
  assert.equal(placeNouvelleLigne(neuve, { niveau: 5 }), 4);
  const apres5 = [...neuve, { ...don('pas', null, 5, 'classe', 4, 1), classe_id: 'classes/x' }];
  assert.equal(placeNouvelleLigne(apres5, { niveau: 1 }), 2);
  assert.equal(placeNouvelleLigne([...apres5, { ...don('un', null, 1, 'classe', 2, 1), classe_id: 'classes/x' }], { niveau: 1 }), 3);
  assert.equal(placeNouvelleLigne(apres5, { niveau: 5 }), 5);
});

test('donneesDeDon : rang du don reçu sans choix (de haut en bas), du cartouche (rang de la spécialité), choix exclusifs triés', () => {
  const contexte = { specialites: SPECIALITES, donsDeLaClasse: GUERRIER };
  assert.deepEqual(donneesDeDon(GUERRIER[16], contexte), { classe: C, niveau: 20, nature: 'classe', rang: 3, ligne: 49, type_capacite: 'Passif' });
  assert.deepEqual(donneesDeDon(GUERRIER[3], contexte), {
    classe: C, specialite: "MAÎTRE D'ARME", niveau: 10, nature: 'specialite', rang: 2, ligne: 22, type_capacite: 'Passif', choix_exclusif_avec: ['capacites/guerrier-epeiste'],
  });
  assert.deepEqual(donneesDeDon(GUERRIER[9], contexte).choix_exclusif_avec, ['capacites/guerrier-affute']);
  assert.deepEqual(Object.keys(donneesDeDon(GUERRIER[8], contexte)), ['classe', 'specialite', 'niveau', 'nature', 'rang', 'ligne', 'type_capacite', 'choix_exclusif_avec']);
  // un don « choix » resté seul : pas d'alternative, pas de clé
  assert.equal('choix_exclusif_avec' in donneesDeDon(GUERRIER[8], { specialites: SPECIALITES, donsDeLaClasse: GUERRIER.filter((d) => d.nom !== 'Expert Mordhau') }), false);
  assert.equal('type_capacite' in donneesDeDon({ ...GUERRIER[0], type_brut: null }, contexte), false);
  assert.deepEqual(alternativesDe(GUERRIER[2], GUERRIER), ['capacites/guerrier-maitre-darme'], 'cartouches : d’une spécialité à l’autre');
  assert.deepEqual(alternativesDe(GUERRIER[0], GUERRIER), []);
});

test('mots-clés d’une fiche de don, groupe d’un emplacement, nature hors spécialité, liste des fiches', () => {
  assert.deepEqual(motsClesDeDon({ libelleClasse: 'arbalètrier', specialiteNom: 'GRAND ARBALETRIER' }), ['capacité de classe', 'arbalètrier', 'grand arbaletrier']);
  assert.deepEqual(motsClesDeDon({ libelleClasse: 'archimage' }), ['capacité de classe', 'archimage']);
  assert.deepEqual(motsClesDeDon({ libelleClasse: 'guerrier', specialiteNom: 'Guerrier' }), ['capacité de classe', 'guerrier'], 'même clé : une fois');
  assert.deepEqual(groupeDe(GUERRIER[4], GUERRIER).map((d) => d.nom), ['Duelliste', 'Coup dur']);
  assert.deepEqual(groupeDe(GUERRIER[2], GUERRIER).map((d) => d.nom), ['Épéiste'], 'un cartouche par spécialité');
  assert.equal(natureHorsSpecialite(1), 'classe');
  assert.equal(natureHorsSpecialite(2), 'choix');
  assert.equal(listeDeFiches(['A', 'B']), 'A, B');
  assert.equal(listeDeFiches(['A', 'B', 'C', 'D', 'E', 'F', 'G']), 'A, B, C, D, E et 2 autre(s)');
});

const ARCHIMAGE = {
  specialites: [
    { id: 'classes/archimage#specialite:elementaliste', rang: 1, nom: 'Élémentaliste', nom_cle: 'elementaliste' },
    { id: 'classes/archimage#specialite:occultiste', rang: 2, nom: 'Occultiste', nom_cle: 'occultiste' },
  ],
  dons: [
    { id: 'capacites/archimage-elementaliste', classe_id: 'classes/archimage', specialite_id: null, niveau: 10, nature: 'choix', ligne: 18, rang: 1, nom: 'Élémentaliste', nom_cle: 'elementaliste' },
    { id: 'capacites/archimage-occultiste', classe_id: 'classes/archimage', specialite_id: null, niveau: 10, nature: 'choix', ligne: 18, rang: 2, nom: 'Occultiste', nom_cle: 'occultiste' },
    { id: 'capacites/archimage-grimoire', classe_id: 'classes/archimage', specialite_id: null, niveau: 5, nature: 'classe', ligne: 11, rang: 1, nom: 'Grimoire', nom_cle: 'grimoire' },
  ],
  fiches: {},
};

test('permissions : maximum de spécialités, Archimage, cartouche, don miroir, fiches qui citent', () => {
  const guerrier = permissions({ specialites: SPECIALITES, dons: GUERRIER, fiches: { 'capacites/guerrier-affute': ['Aria', 'Borin'], [MA]: ['Cyd'] } });
  assert.equal(guerrier.peutAjouterSpecialite, false, 'déjà deux');
  assert.equal(permissions({ specialites: SPECIALITES.slice(0, 1), dons: GUERRIER.filter((d) => d.specialite_id !== MA) }).peutAjouterSpecialite, true);
  assert.equal(permissions({ specialites: [], dons: [] }).peutAjouterSpecialite, true, 'classe créée sur le site');
  assert.deepEqual(guerrier.specialites[EP], { supprimable: true, fiches: ['Aria', 'Borin'] }, 'les fiches de ses dons comptent');
  assert.deepEqual(guerrier.specialites[MA].fiches, ['Cyd']);
  assert.equal(guerrier.dons['capacites/guerrier-epeiste'].supprimable, false, 'cartouche : on supprime la spécialité');
  assert.equal(guerrier.dons['capacites/guerrier-epeiste'].peutRecevoirOption, false);
  assert.equal(guerrier.dons['capacites/guerrier-contact'].peutRecevoirOption, true);
  assert.deepEqual(guerrier.dons['capacites/guerrier-affute'].fiches, ['Aria', 'Borin']);
  const archimage = permissions(ARCHIMAGE);
  assert.equal(archimage.peutAjouterSpecialite, false, 'spécialités sans don de spécialité');
  assert.equal(archimage.specialites['classes/archimage#specialite:occultiste'].supprimable, false);
  assert.equal(archimage.dons['capacites/archimage-occultiste'].supprimable, false, 'don miroir');
  assert.equal(archimage.dons['capacites/archimage-occultiste'].peutRecevoirOption, true, 'un palier reçoit une option');
  assert.equal(archimage.dons['capacites/archimage-grimoire'].supprimable, true);
});

test('consequences : don qui devient reçu sans choix, don reçu d’office qui devient un choix, spécialité qui emporte ses dons', () => {
  const etat = { specialites: SPECIALITES, dons: GUERRIER };
  assert.deepEqual(consequences(etat, { specialitesSupprimees: [EP] }), ['La spécialité ÉPÉISTE emporte son don de spécialité et ses 6 dons.']);
  assert.deepEqual(consequences(etat, { creations: [{ entite: 'capacite', valeurs: { avec: 'capacites/guerrier-contact', nom: 'Poigne' } }] }),
    ['Contact deviendra un choix : les fiches qui le recevaient d’office devront choisir.']);
  const paliers = { specialites: [], dons: [...ARCHIMAGE.dons.slice(0, 2).map((d) => ({ ...d, nom_cle: `${d.nom_cle}-x` }))] };
  assert.deepEqual(consequences(paliers, { donsSupprimes: ['capacites/archimage-occultiste'] }), ['Élémentaliste deviendra un don reçu sans choix.']);
  const [phrase] = consequences(etat, { donsSupprimes: ['capacites/guerrier-coup-dur'] });
  assert.match(phrase, /^Duelliste restera seul sur sa ligne/, 'dans une spécialité, le survivant reste un choix sans alternative');
  assert.deepEqual(consequences(etat, { donsSupprimes: ['capacites/guerrier-coup-dur'], creations: [{ entite: 'capacite', valeurs: { avec: 'capacites/guerrier-duelliste' } }] }), [],
    'remplacé par une option : rien à signaler');
  assert.deepEqual(consequences(etat, { donsSupprimes: ['capacites/guerrier-coup-dur', 'capacites/guerrier-duelliste'] }), [], 'les deux partent');
  assert.deepEqual(consequences(etat, { donsSupprimes: ['capacites/guerrier-coup-dur'], specialitesSupprimees: [EP] }),
    ['La spécialité ÉPÉISTE emporte son don de spécialité et ses 6 dons.']);
});

test('operationsDuLot : champs, suppressions de spécialités, créations (références « @i »), suppressions de dons ; refus d’une option sur une ligne supprimée', () => {
  const champs = [
    { op: 'modifier', table: 'capacite', cle: { id: 'capacites/guerrier-affute' }, valeurs: { nom: 'Affûté' } },
    { op: 'modifier', table: 'capacite', cle: { id: 'capacites/guerrier-contact' }, valeurs: { nom: 'Contact !' } },
    { op: 'modifier', table: 'specialite', cle: { id: MA }, valeurs: { nom: 'MAÎTRE' } },
  ];
  const creations = [
    { entite: 'specialite', valeurs: { classe_id: C, nom: 'Bretteur' } },
    { entite: 'capacite', valeurs: { classe_id: C, specialite_id: '@0', niveau: '15', nom: 'Fente' } },
    { entite: 'capacite', valeurs: { classe_id: C, specialite_id: '@0', avec: '@1', nom: 'Parade' } },
  ];
  const ops = operationsDuLot({ champs, specialitesSupprimees: [EP], creations, donsSupprimes: ['capacites/guerrier-moi-aussi', 'capacites/guerrier-duelliste'], etat: { dons: GUERRIER } });
  assert.deepEqual(ops.map((o) => `${o.op}:${o.entite ?? o.table}:${o.cle?.id ?? o.valeurs?.nom}`), [
    'modifier:capacite:capacites/guerrier-contact',
    `modifier:specialite:${MA}`,
    `supprimer:specialite:${EP}`,
    'creer:specialite:Bretteur',
    'creer:capacite:Fente',
    'creer:capacite:Parade',
    'supprimer:capacite:capacites/guerrier-moi-aussi',
  ], 'les dons de la spécialité supprimée partent avec elle');
  assert.equal(ops[4].valeurs.specialite_id, '@3');
  assert.equal(ops[5].valeurs.specialite_id, '@3');
  assert.equal(ops[5].valeurs.avec, '@4');
  assert.throws(() => operationsDuLot({ creations: [{ entite: 'capacite', valeurs: { avec: 'capacites/guerrier-coup-dur' } }], donsSupprimes: ['capacites/guerrier-coup-dur'] }),
    /marqué pour suppression/);
  assert.throws(() => operationsDuLot({ creations: [{ entite: 'capacite', valeurs: { specialite_id: EP } }], specialitesSupprimees: [EP] }), /spécialité marquée pour suppression/);
  assert.throws(() => operationsDuLot({ creations: [{ entite: 'capacite', valeurs: { avec: 'capacites/guerrier-duelliste' } }], specialitesSupprimees: [EP], etat: { dons: GUERRIER } }),
    /marqué pour suppression/, 'un don de la spécialité supprimée');
  assert.throws(() => operationsDuLot({ creations: [{ entite: 'capacite', valeurs: { avec: '@3' } }] }), /aucune création/);
  assert.deepEqual(operationsDuLot({ champs }), champs, 'sans création ni suppression : les champs seuls');
});
