// Recherche des personnages (lib/personnages-liste.mjs, page /personnages/) : les colonnes de la liste (portrait, nom, race, magies, niveau : demande
// du propriétaire), filtres, tri de chaque colonne triable dans les deux sens, choix des listes, couleurs de la bordure d'une ligne et aller-retour des
// filtres dans l'adresse. Les résumés imitent ceux que rend le service (client/serveur/fiches.mjs#listerFiches) : plus de statut (migration 0038).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as liste from '../src/lib/personnages-liste.mjs';
import { readFileSync } from 'node:fs';
import { classesDeDeuxMagies } from '../src/lib/palette-css.mjs';

const {
  COLONNES, FILTRES_PAR_DEFAUT, adresseDesFiltres, choixDeFiltres, classesDeBordure, filtrer, filtresDepuisAdresse, magiesDe, normaliser, trier,
} = liste;

const p = (id, surcharge = {}) => ({
  id, nom: id, surnom: null, lieu_origine: null, xp: 0, mode_classe: 'mono', portrait: null, race_id: null, race: null, ethnie_id: null, ethnie: null,
  magie_innee_id: null, magie_innee: null, magie_acquise_id: null, magie_acquise: null, dieu_choisi_id: null, dieu: null, metier_id: null, metier: null,
  niveau_global: 1, niveau_classe_1: 1, niveau_classe_2: null, classes: [], anomalies: 0, cree_le: '2026-10-10T10:00:00Z', modifie_le: '2026-10-10T10:00:00Z',
  ...surcharge,
});
const PERSONNAGES = [
  p('Élise', { race_id: 'races/elfe-dore', race: 'Elfe doré', magie_innee_id: 'magies/magie-du-feu', magie_innee: 'Feu', niveau_global: 5, xp: 1650, classes: [{ rang: 1, classe_id: 'classes/mage', classe: 'Mage', specialite: null }], metier: 'Forgeron', portrait: { empreinte: 'abc123', style: 'object-position: 50% 50%' }, modifie_le: '2026-10-09T10:00:00Z' }),
  p('aldric', { surnom: 'le Brave', race_id: 'races/humain', race: 'Humain', ethnie: 'Humain central', magie_innee_id: 'magies/magie-de-leau', magie_innee: 'Eau', magie_acquise_id: 'magies/magie-du-feu', magie_acquise: 'Feu', mode_classe: 'bi', niveau_global: 11, xp: 17050, classes: [{ rang: 1, classe_id: 'classes/guerrier', classe: 'Guerrier', specialite: 'ÉPÉISTE' }, { rang: 2, classe_id: 'classes/mage', classe: 'Mage', specialite: null }], anomalies: 2 }),
  // une fiche « archivée » d'avant la migration 0038 (résumé d'un service resté à l'ancienne version) : plus cachée, son statut n'est pas lu
  p('Brune', { statut: 'archive', lieu_origine: 'Valbrume', race_id: 'races/humain', race: 'Humain', niveau_global: 2, xp: 200 }),
  // une fiche inachevée : ni race ni magie (les contrôles le signalent, elle s'enregistre et se liste)
  p('Cyrielle', { niveau_global: 3, xp: 550, anomalies: 4, modifie_le: '2026-10-11T08:00:00Z' }),
];
const noms = (personnages) => personnages.map((x) => x.nom);
// couleurs des pages de magie, comme la page les pose au build (identifiant de magie → couleur)
// les classes de la palette de chaque magie, posées par la page au build (pages/personnages.astro : lib/palette-css.mjs#classesDeDeuxMagies)
const COULEURS = { 'magies/magie-du-feu': classesDeDeuxMagies('Feu'), 'magies/magie-de-leau': classesDeDeuxMagies('Eau') };

test('colonnes : exactement portrait, nom, race, magies, niveau (demande du propriétaire), le portrait sans tri ni texte', () => {
  assert.deepEqual(COLONNES.map((c) => c.cle), ['portrait', 'nom', 'race', 'magies', 'niveau']);
  assert.deepEqual(COLONNES.map((c) => c.titre), ['Portrait', 'Nom', 'Race', 'Magies', 'Niveau']);
  const portrait = COLONNES.find((c) => c.cle === 'portrait');
  assert.equal(portrait.tri, undefined, 'le portrait ne se trie pas');
  assert.equal(portrait.texte, undefined);
  for (const c of COLONNES.filter((x) => x.cle !== 'portrait')) {
    assert.equal(typeof c.texte, 'function', `${c.cle} : texte`);
    assert.equal(typeof c.tri, 'function', `${c.cle} : tri`);
    assert.ok(['texte', 'nombre'].includes(c.nature), `${c.cle} : nature`);
  }
  assert.ok(!('STATUTS' in liste), 'plus de statut des fiches');
  const texte = (cle, personnage) => COLONNES.find((c) => c.cle === cle).texte(personnage);
  assert.equal(texte('nom', PERSONNAGES[1]), 'aldric');
  assert.equal(texte('race', PERSONNAGES[1]), 'Humain', 'la race seule, sans l’ethnie');
  assert.equal(texte('race', PERSONNAGES[3]), '', 'sans race : case vide');
  assert.equal(texte('magies', PERSONNAGES[1]), 'Eau, Feu');
  assert.equal(texte('niveau', PERSONNAGES[1]), 11, 'le niveau global (l’XP sert au tri)');
});

test('magies dans une case : « Innée, Acquise », toujours dans cet ordre ; l’innée seule ; rien sans magie', () => {
  assert.equal(magiesDe(PERSONNAGES[1]), 'Eau, Feu', 'innée (Eau) puis acquise (Feu)');
  assert.equal(magiesDe(p('x', { magie_innee: 'Feu', magie_acquise: 'Eau' })), 'Feu, Eau', 'l’ordre est celui des magies, pas l’alphabet');
  assert.equal(magiesDe(PERSONNAGES[0]), 'Feu', 'l’innée seule, sans virgule');
  assert.equal(magiesDe(PERSONNAGES[3]), '', 'sans magie');
  assert.equal(magiesDe(p('x', { magie_acquise: 'Feu' })), 'Feu', 'une fiche inachevée sans innée : l’acquise seule');
});

test('filtres : tous les personnages par défaut (plus de statut ni de fiche archivée cachée), race, magie innée ou acquise, classe 1 ou 2, niveaux, règles à revoir, texte sans accents', () => {
  assert.ok(!('statut' in FILTRES_PAR_DEFAUT), 'plus de filtre de statut');
  assert.deepEqual(noms(filtrer(PERSONNAGES, {})), ['Élise', 'aldric', 'Brune', 'Cyrielle'], 'tous, y compris l’ancienne fiche archivée');
  assert.deepEqual(noms(filtrer(PERSONNAGES, { statut: 'archive' })), noms(PERSONNAGES), 'un filtre de statut ancien est ignoré');
  assert.deepEqual(noms(filtrer(PERSONNAGES, { statut: 'valide' })), noms(PERSONNAGES));
  assert.deepEqual(noms(filtrer(PERSONNAGES, { race: 'races/humain' })), ['aldric', 'Brune']);
  assert.deepEqual(noms(filtrer(PERSONNAGES, { magie: 'magies/magie-du-feu' })), ['Élise', 'aldric'], 'Feu inné ou acquis');
  assert.deepEqual(noms(filtrer(PERSONNAGES, { magie: 'magies/magie-de-leau' })), ['aldric']);
  assert.deepEqual(noms(filtrer(PERSONNAGES, { classe: 'classes/mage' })), ['Élise', 'aldric'], 'Mage en 1re ou en 2e classe');
  assert.deepEqual(noms(filtrer(PERSONNAGES, { niveauMin: '3', niveauMax: '10' })), ['Élise', 'Cyrielle']);
  assert.deepEqual(noms(filtrer(PERSONNAGES, { regles: 'avec' })), ['aldric', 'Cyrielle']);
  assert.deepEqual(noms(filtrer(PERSONNAGES, { regles: 'sans' })), ['Élise', 'Brune']);
  assert.deepEqual(noms(filtrer(PERSONNAGES, { texte: 'elise' })), ['Élise']);
  assert.deepEqual(noms(filtrer(PERSONNAGES, { texte: 'BRAVE ald' })), ['aldric'], 'tous les mots, dans le nom ou le surnom');
  assert.deepEqual(noms(filtrer(PERSONNAGES, { texte: 'valbrume' })), ['Brune'], 'le lieu d’origine');
  assert.equal(normaliser('  Élise   DORÉE '), 'elise doree');
});

test('tri : chaque colonne triable dans les deux sens, texte sans casse ni accents, nombres, cases vides toujours à la fin', () => {
  const tous = filtrer(PERSONNAGES, {});
  assert.deepEqual(noms(trier(tous, 'nom')), ['aldric', 'Brune', 'Cyrielle', 'Élise']);
  assert.deepEqual(noms(trier(tous, 'nom', 'desc')), ['Élise', 'Cyrielle', 'Brune', 'aldric']);
  assert.deepEqual(noms(trier(tous, 'race')), ['Élise', 'aldric', 'Brune', 'Cyrielle'], 'Elfe doré, Humain, Humain, puis sans race');
  assert.deepEqual(noms(trier(tous, 'race', 'desc')), ['aldric', 'Brune', 'Élise', 'Cyrielle'], 'vides à la fin aussi en ordre décroissant ; égaux dans l’ordre d’origine');
  // par la case affichée : « Eau, Feu » avant « Feu » ; sans magie à la fin
  assert.deepEqual(noms(trier(tous, 'magies')), ['aldric', 'Élise', 'Brune', 'Cyrielle'], 'Eau, Feu ; Feu ; puis sans magie dans l’ordre d’origine');
  assert.deepEqual(noms(trier(tous, 'magies', 'desc')), ['Élise', 'aldric', 'Brune', 'Cyrielle']);
  assert.deepEqual(noms(trier(tous, 'niveau')), ['Brune', 'Cyrielle', 'Élise', 'aldric'], 'niveau (par l’XP)');
  assert.deepEqual(noms(trier(tous, 'niveau', 'desc')), ['aldric', 'Élise', 'Cyrielle', 'Brune']);
  const memeNiveau = [p('A', { niveau_global: 2, xp: 300 }), p('B', { niveau_global: 2, xp: 150 })];
  assert.deepEqual(noms(trier(memeNiveau, 'niveau')), ['B', 'A'], 'à niveau égal, l’XP départage');
  const parNom = noms(trier(tous, 'nom'));
  assert.deepEqual(noms(trier(tous, 'portrait')), parNom, 'le portrait ne se trie pas : par nom');
  assert.deepEqual(noms(trier(tous, 'portrait', 'desc')), noms(trier(tous, 'nom', 'desc')), 'le sens demandé reste celui du nom');
  for (const ancienne of ['statut', 'classes', 'metier', 'anomalies', 'modifie_le', 'inconnue', undefined]) {
    assert.deepEqual(noms(trier(tous, ancienne)), parNom, `colonne ${ancienne} (retirée ou inconnue) : par nom`);
  }
  for (const c of COLONNES.filter((x) => x.tri)) {
    for (const sens of ['asc', 'desc']) {
      const trie = trier(tous, c.cle, sens);
      assert.equal(trie.length, tous.length, `${c.cle} ${sens} : personne de perdu`);
      assert.deepEqual(new Set(trie), new Set(tous), `${c.cle} ${sens} : les mêmes personnages`);
    }
  }
  assert.deepEqual(noms(tous), ['Élise', 'aldric', 'Brune', 'Cyrielle'], 'le tri ne touche pas à la liste reçue');
});

test('choix des filtres : races, magies et classes présentes, sans doublon, par nom', () => {
  const choix = choixDeFiltres(PERSONNAGES);
  assert.deepEqual(choix.races, [{ id: 'races/elfe-dore', nom: 'Elfe doré' }, { id: 'races/humain', nom: 'Humain' }]);
  assert.deepEqual(choix.magies, [{ id: 'magies/magie-de-leau', nom: 'Eau' }, { id: 'magies/magie-du-feu', nom: 'Feu' }]);
  assert.deepEqual(choix.classes.map((c) => c.nom), ['Guerrier', 'Mage']);
  assert.deepEqual(choixDeFiltres([]), { races: [], magies: [], classes: [] });
});

test('bordure d’une ligne : la couleur de la magie innée, en dégradé vers l’acquise en bi-magie, par les classes de la palette (jamais une couleur)', () => {
  const [feu, feu2] = classesDeDeuxMagies('Feu');
  const [eau, eau2] = classesDeDeuxMagies('Eau');
  assert.deepEqual([feu, feu2, eau, eau2], ['couleur-magie-feu', 'couleur-2-magie-feu', 'couleur-magie-eau', 'couleur-2-magie-eau']);
  assert.deepEqual(classesDeBordure(PERSONNAGES[0], COULEURS), [feu, feu2], 'innée seule : sa classe et sa classe de second rang');
  assert.deepEqual(classesDeBordure(PERSONNAGES[1], COULEURS), [eau, feu2], 'bi-magie : l’innée (Eau) puis l’acquise (Feu)');
  assert.deepEqual(classesDeBordure(p('x', { magie_innee_id: 'magies/magie-du-feu', magie_acquise_id: 'magies/magie-de-leau' }), COULEURS),
    [feu, eau2], 'l’ordre suit les magies : innée d’abord');
  assert.equal(classesDeBordure(PERSONNAGES[3], COULEURS), null, 'sans magie : bordure neutre');
  assert.equal(classesDeBordure(p('x', { magie_innee_id: 'magies/inconnue' }), COULEURS), null, 'magie absente de la table des couleurs : bordure neutre');
  assert.equal(classesDeBordure(PERSONNAGES[1], {}), null, 'table des couleurs vide : bordure neutre');
  // repli défensif (les couleurs viennent de la même base que les fiches) : une magie absente de la table des couleurs est sautée, la couleur connue reste
  assert.deepEqual(classesDeBordure(p('x', { magie_innee_id: 'magies/magie-du-feu', magie_acquise_id: 'magies/inconnue' }), COULEURS),
    [feu, feu2], 'acquise inconnue : l’innée seule');
  assert.deepEqual(classesDeBordure(p('x', { magie_innee_id: 'magies/inconnue', magie_acquise_id: 'magies/magie-de-leau' }), COULEURS),
    [eau, eau2], 'innée inconnue : l’acquise seule');
  assert.deepEqual(classesDeBordure(p('x', { magie_acquise_id: 'magies/magie-de-leau' }), COULEURS), [eau, eau2], 'fiche inachevée sans innée : l’acquise seule');
  // la feuille de la liste lit les propriétés de ces classes, sans couleur écrite
  const css = readFileSync(new URL('../src/styles/personnages/liste.css', import.meta.url), 'utf8');
  assert.match(css, /\n\.perso--magie \{ --magie-1: var\(--couleur\); --magie-2: var\(--couleur-2\); \}\n/);
  assert.match(readFileSync(new URL('../src/scripts/personnages.mjs', import.meta.url), 'utf8'), /a\.classList\.add\('perso--magie', \.\.\.bordure\)/);
});

test('les filtres et le tri vivent dans l’adresse : aller-retour, seuls ceux qui diffèrent du défaut ; statut et tri disparus ramenés au défaut', () => {
  assert.equal(adresseDesFiltres(FILTRES_PAR_DEFAUT), '');
  const f = { ...FILTRES_PAR_DEFAUT, texte: 'élise', race: 'races/humain', tri: 'niveau', sens: 'desc' };
  const adresse = adresseDesFiltres(f);
  assert.equal(adresse, '?texte=%C3%A9lise&race=races%2Fhumain&tri=niveau&sens=desc');
  assert.deepEqual(filtresDepuisAdresse(adresse), f);
  assert.deepEqual(filtresDepuisAdresse(''), FILTRES_PAR_DEFAUT);
  for (const c of COLONNES.filter((x) => x.tri)) {
    for (const sens of ['asc', 'desc']) {
      const filtres = { ...FILTRES_PAR_DEFAUT, tri: c.cle, sens };
      assert.deepEqual(filtresDepuisAdresse(adresseDesFiltres(filtres)), filtres, `aller-retour du tri ${c.cle} ${sens}`);
    }
  }
  // une adresse gardée d'avant la migration 0038 (ou d'une colonne retirée) : le statut est ignoré, le tri revient au nom, un sens invalide à 'asc'
  assert.deepEqual(filtresDepuisAdresse('?statut=archive'), FILTRES_PAR_DEFAUT);
  assert.deepEqual(filtresDepuisAdresse('?statut=tous&race=races%2Fhumain'), { ...FILTRES_PAR_DEFAUT, race: 'races/humain' });
  assert.deepEqual(filtresDepuisAdresse('?tri=statut&sens=desc'), { ...FILTRES_PAR_DEFAUT, sens: 'desc' }, 'tri par statut : par nom, le sens gardé');
  for (const tri of ['portrait', 'classes', 'metier', 'anomalies', 'modifie_le', 'inconnue', '']) {
    assert.equal(filtresDepuisAdresse(`?tri=${tri}`).tri, 'nom', `?tri=${tri}`);
  }
  assert.deepEqual(filtresDepuisAdresse('?tri=race&sens=n%27importe-quoi'), { ...FILTRES_PAR_DEFAUT, tri: 'race' }, 'sens invalide : croissant');
  assert.equal(filtresDepuisAdresse('?sens=DESC').sens, 'asc', 'le sens se lit tel quel');
  assert.equal(adresseDesFiltres({ ...FILTRES_PAR_DEFAUT, statut: 'archive' }), '', 'un statut resté dans les filtres ne va pas dans l’adresse');
  assert.equal(adresseDesFiltres(filtresDepuisAdresse('?statut=archive&tri=statut&sens=zz')), '', 'nettoyée, une ancienne adresse redevient celle par défaut');
});

test('adresse du portrait : la route du service, l’empreinte de l’image en paramètre (une autre image, une autre adresse) ; rien sans portrait', () => {
  const avec = p('Élise', { id: 'id avec/espace', portrait: { empreinte: '0123456789abcdef', style: 'width:100%' } });
  assert.equal(liste.adresseDuPortrait('/api/', avec), '/api/personnages/id%20avec%2Fespace/portrait/?v=0123456789abcdef');
  assert.equal(liste.adresseDuPortrait('/MaverickCenter/api/', avec), '/MaverickCenter/api/personnages/id%20avec%2Fespace/portrait/?v=0123456789abcdef', 'sous un sous-chemin');
  assert.notEqual(liste.adresseDuPortrait('/api/', { ...avec, portrait: { empreinte: 'fedcba9876543210' } }), liste.adresseDuPortrait('/api/', avec));
  assert.equal(liste.adresseDuPortrait('/api/', p('Brune')), null, 'sans portrait : le logo');
});
