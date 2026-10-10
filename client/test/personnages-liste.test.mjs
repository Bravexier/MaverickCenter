// Recherche des personnages (lib/personnages-liste.mjs, page /personnages/) : filtres, tri de chaque colonne dans les deux sens, choix des listes et
// aller-retour des filtres dans l'adresse. Les résumés imitent ceux que rend le service (client/serveur/fiches.mjs#listerFiches).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  COLONNES, FILTRES_PAR_DEFAUT, STATUTS, adresseDesFiltres, choixDeFiltres, filtrer, filtresDepuisAdresse, normaliser, trier,
} from '../src/lib/personnages-liste.mjs';

const p = (id, surcharge = {}) => ({
  id, nom: id, surnom: null, lieu_origine: null, statut: 'brouillon', xp: 0, race_id: null, race: null, ethnie_id: null, ethnie: null,
  magie_innee_id: null, magie_innee: null, magie_acquise_id: null, magie_acquise: null, dieu: null, metier: null, niveau_global: 1, classes: [],
  anomalies: 0, modifie_le: '2026-10-10T10:00:00Z', ...surcharge,
});
const PERSONNAGES = [
  p('Élise', { statut: 'valide', race_id: 'races/elfe-dore', race: 'Elfe doré', magie_innee_id: 'magies/magie-du-feu', magie_innee: 'Feu', niveau_global: 5, xp: 1650, classes: [{ rang: 1, classe_id: 'classes/mage', classe: 'Mage', specialite: null }], metier: 'Forgeron', modifie_le: '2026-10-09T10:00:00Z' }),
  p('aldric', { surnom: 'le Brave', race_id: 'races/humain', race: 'Humain', ethnie: 'Humain central', magie_innee_id: 'magies/magie-de-leau', magie_innee: 'Eau', magie_acquise_id: 'magies/magie-du-feu', magie_acquise: 'Feu', niveau_global: 11, xp: 17050, classes: [{ rang: 1, classe_id: 'classes/guerrier', classe: 'Guerrier', specialite: 'ÉPÉISTE' }, { rang: 2, classe_id: 'classes/mage', classe: 'Mage', specialite: null }], anomalies: 2 }),
  p('Brune', { statut: 'archive', lieu_origine: 'Valbrume', race_id: 'races/humain', race: 'Humain', niveau_global: 2, xp: 200 }),
  p('Cyrielle', { niveau_global: 3, xp: 550, modifie_le: '2026-10-11T08:00:00Z' }),
];
const noms = (liste) => liste.map((x) => x.nom);

test('filtres : archivés cachés par défaut, statut, race, magie innée ou acquise, classe 1 ou 2, niveaux, règles à revoir, texte sans accents', () => {
  assert.deepEqual(noms(filtrer(PERSONNAGES, {})), ['Élise', 'aldric', 'Cyrielle']);
  assert.deepEqual(noms(filtrer(PERSONNAGES, { statut: 'tous' })), ['Élise', 'aldric', 'Brune', 'Cyrielle']);
  assert.deepEqual(noms(filtrer(PERSONNAGES, { statut: 'archive' })), ['Brune']);
  assert.deepEqual(noms(filtrer(PERSONNAGES, { statut: 'valide' })), ['Élise']);
  assert.deepEqual(noms(filtrer(PERSONNAGES, { race: 'races/humain', statut: 'tous' })), ['aldric', 'Brune']);
  assert.deepEqual(noms(filtrer(PERSONNAGES, { magie: 'magies/magie-du-feu' })), ['Élise', 'aldric'], 'Feu inné ou acquis');
  assert.deepEqual(noms(filtrer(PERSONNAGES, { classe: 'classes/mage' })), ['Élise', 'aldric'], 'Mage en 1re ou en 2e classe');
  assert.deepEqual(noms(filtrer(PERSONNAGES, { niveauMin: '3', niveauMax: '10' })), ['Élise', 'Cyrielle']);
  assert.deepEqual(noms(filtrer(PERSONNAGES, { regles: 'avec' })), ['aldric']);
  assert.deepEqual(noms(filtrer(PERSONNAGES, { regles: 'sans' })), ['Élise', 'Cyrielle']);
  assert.deepEqual(noms(filtrer(PERSONNAGES, { texte: 'elise' })), ['Élise']);
  assert.deepEqual(noms(filtrer(PERSONNAGES, { texte: 'BRAVE ald' })), ['aldric'], 'tous les mots, dans le nom ou le surnom');
  assert.deepEqual(noms(filtrer(PERSONNAGES, { texte: 'valbrume', statut: 'tous' })), ['Brune'], 'le lieu d’origine');
  assert.equal(normaliser('  Élise   DORÉE '), 'elise doree');
});

test('tri : chaque colonne dans les deux sens, texte sans casse ni accents, nombres et dates, cases vides toujours à la fin', () => {
  const tous = filtrer(PERSONNAGES, { statut: 'tous' });
  assert.deepEqual(noms(trier(tous, 'nom')), ['aldric', 'Brune', 'Cyrielle', 'Élise']);
  assert.deepEqual(noms(trier(tous, 'nom', 'desc')), ['Élise', 'Cyrielle', 'Brune', 'aldric']);
  assert.deepEqual(noms(trier(tous, 'niveau', 'desc')), ['aldric', 'Élise', 'Cyrielle', 'Brune']);
  assert.deepEqual(noms(trier(tous, 'niveau')), ['Brune', 'Cyrielle', 'Élise', 'aldric'], 'niveau (par l’XP)');
  assert.deepEqual(noms(trier(tous, 'race')), ['Élise', 'aldric', 'Brune', 'Cyrielle'], 'Elfe doré, Humain, Humain, puis sans race');
  assert.deepEqual(noms(trier(tous, 'race', 'desc')), ['aldric', 'Brune', 'Élise', 'Cyrielle'], 'vides à la fin aussi en ordre décroissant ; égaux dans l’ordre d’origine');
  assert.deepEqual(noms(trier(tous, 'modifie_le', 'desc')), ['Cyrielle', 'aldric', 'Brune', 'Élise']);
  assert.deepEqual(noms(trier(tous, 'statut')), ['Brune', 'aldric', 'Cyrielle', 'Élise'], 'Archivé, Brouillon, Brouillon, Validé');
  assert.deepEqual(noms(trier(tous, 'inconnue')), noms(trier(tous, 'nom')), 'colonne inconnue : par nom');
  for (const c of COLONNES) {
    for (const sens of ['asc', 'desc']) assert.equal(trier(tous, c.cle, sens).length, tous.length, `${c.cle} ${sens}`);
  }
  assert.equal(COLONNES.find((c) => c.cle === 'classes').texte(PERSONNAGES[1]), 'Guerrier (ÉPÉISTE) / Mage');
  assert.equal(COLONNES.find((c) => c.cle === 'race').texte(PERSONNAGES[1]), 'Humain · Humain central');
  assert.equal(COLONNES.find((c) => c.cle === 'statut').texte(PERSONNAGES[0]), STATUTS.valide);
});

test('choix des filtres : races, magies et classes présentes, sans doublon, par nom', () => {
  const choix = choixDeFiltres(PERSONNAGES);
  assert.deepEqual(choix.races, [{ id: 'races/elfe-dore', nom: 'Elfe doré' }, { id: 'races/humain', nom: 'Humain' }]);
  assert.deepEqual(choix.magies.map((m) => m.nom), ['Eau', 'Feu']);
  assert.deepEqual(choix.classes.map((c) => c.nom), ['Guerrier', 'Mage']);
});

test('les filtres et le tri vivent dans l’adresse : aller-retour, seuls ceux qui diffèrent du défaut', () => {
  assert.equal(adresseDesFiltres(FILTRES_PAR_DEFAUT), '');
  const f = { ...FILTRES_PAR_DEFAUT, texte: 'élise', race: 'races/humain', tri: 'niveau', sens: 'desc' };
  const adresse = adresseDesFiltres(f);
  assert.equal(adresse, '?texte=%C3%A9lise&race=races%2Fhumain&tri=niveau&sens=desc');
  assert.deepEqual(filtresDepuisAdresse(adresse), f);
  assert.deepEqual(filtresDepuisAdresse(''), FILTRES_PAR_DEFAUT);
});
