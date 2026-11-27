// L'adresse d'une page suit son titre (décision R316, docs/chantier-adresses.md, §3 ; serveur/edition-adresses.mjs) : en fin de lot, une page dont le titre a changé
// prend l'adresse que sa création lui donnerait aujourd'hui (le suffixe de la création si elle est prise, jamais un refus) ; l'adresse quittée est gardée
// (page_ancienne_adresse), la ligne d'une ancienne adresse reprise disparaît, et les mots-clés qui menaient à l'adresse quittée la suivent ; l'identifiant ne change
// pas. Petite base de test/aide-ancrage.mjs, noms inventés ; chaque cas vérifie aussi que les contrôles du contenu n'y trouvent rien de plus qu'avant.
//   node --test test/serveur-edition-adresses.test.mjs
import assert from 'node:assert/strict';
import { copyFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { ouvrirBaseVivante } from '../serveur/base-vivante.mjs';
import { controlerLeContenu } from '../serveur/controles-du-contenu.mjs';
import { appliquerUnLot, enregistrer, ErreurEdition } from '../serveur/edition.mjs';
import { outilsDesAdresses, segmentsVoulus } from '../serveur/edition-adresses.mjs';
import { deposerEtAppliquer } from '../serveur/edition-lots.mjs';
import { adresseDeLaPageEnBase, adresseDuSortEnBase } from '../src/lib/adresses-db.mjs';
import { CATEGORIE_RACIALE } from '../src/lib/classe-champs.mjs';
import { ADRESSES_DES_PAGES_SERVIES } from '../src/lib/equipement.mjs';
import { ADRESSES_RENOMMEES_DU_GUIDE, DECOUVRIR, NOMS_RESERVES } from '../src/lib/livres.mjs';
import { FORMAT_DU_LOT } from '../src/lib/lot-de-changements.mjs';
import { PAGE_DES_REGLES } from '../src/lib/metiers.mjs';
import { normalize } from '../src/lib/text.mjs';
import {
  ancrerUnMotCle, baseDAncrage, poserCapacite, poserClasse, poserMagie, poserMetier, poserMotCle, poserOnglet, poserPageLisible, poserRace, poserSort,
  recalculerLesCles,
} from './aide-ancrage.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';

const racine = dossierTemporaire('edition-adresses');
let n = 0;
const nom = (suffixe) => `Zephyrion ${suffixe}`;
/** L'id d'une page des Règles créée sous ce titre. */
const idDesRegles = (titre) => `guide/${normalize(titre)}`;
/** La page R228 (lib/livres.mjs#ADRESSES_RENOMMEES_DU_GUIDE) et le segment de son adresse écrit dans le code. */
const [PAGE_R228, SEGMENT_R228] = Object.entries(ADRESSES_RENOMMEES_DU_GUIDE)[0];

/** La petite base nue, écrite une fois en fichier : chaque cas en part d'une copie (la bâtir coûte plus que la copier). */
let modele = null;
function cheminDuModele() {
  if (!modele) {
    const memoire = baseDAncrage();
    modele = join(racine, 'modele.db');
    memoire.exec(`VACUUM INTO '${modele.replaceAll("'", "''")}'`);
    memoire.close();
  }
  return modele;
}

/**
 * Un cas, sur une copie en fichier de la petite base (ce qu'un dépôt copie) : `poser` y écrit ses lignes (comme dans test/aide-ancrage.mjs#baseDAncrage, sans
 * clés étrangères ni CHECK : les lignes d'essai ne remplissent pas tout) et rend ce que l'essai lit (`m.monde`) ; `essai(m)` le joue. À la fin, les contrôles du
 * contenu n'y trouvent rien de plus qu'avant l'essai.
 */
async function cas(poser, essai) {
  const dossier = join(racine, `b${(n += 1)}`);
  mkdirSync(dossier, { recursive: true });
  const chemin = join(dossier, 'vivante.db');
  copyFileSync(cheminDuModele(), chemin);
  const brute = new DatabaseSync(chemin, { enableForeignKeyConstraints: false });
  brute.exec('PRAGMA ignore_check_constraints = ON; BEGIN');
  const monde = poser(brute);
  recalculerLesCles(brute);
  brute.exec('COMMIT');
  brute.close();
  const db = ouvrirBaseVivante(chemin);
  try {
    const avant = new Set(controlerLeContenu(db).problemes);
    await essai({ db, monde, base: () => db, dossier: join(dossier, 'essais') });
    assert.deepEqual(controlerLeContenu(db).problemes.filter((p) => !avant.has(p)), [], 'les contrôles du contenu ne trouvent rien de plus');
  } finally {
    db.close();
  }
}

/** Une saisie du site de dev (serveur/edition.mjs#enregistrer) : `operations` de « modifier ». */
const saisir = (m, ...operations) => enregistrer(m.db, { page: 'essai/', operations: operations.map(([table, id, valeurs]) => ({ op: 'modifier', table, cle: { id }, valeurs })) });
const renommer = (m, id, titre) => saisir(m, ['page', id, { titre }]);

/**
 * Un lot qui écrit par la voie générique du journal (une race, une classe, une magie : aucune route ne renomme leur page), puis le suivi de fin de lot ; chaque
 * colonne écrite emporte sa clé (`titre_cle`, `nom_cle`) si la table en a une.
 */
function parUnLot(m, ...ecritures) {
  const avecLaCle = (table, valeurs) => {
    const colonnes = new Set(m.db.prepare(`SELECT name FROM pragma_table_info('${table}')`).all().map((c) => c.name));
    return { ...valeurs, ...Object.fromEntries(Object.entries(valeurs).filter(([c]) => colonnes.has(`${c}_cle`)).map(([c, v]) => [`${c}_cle`, normalize(v)])) };
  };
  return appliquerUnLot(m.db, {
    titre: 'Essai', nature: 'decision', decision: 'R316',
    travail: (hote) => {
      for (const [table, id, valeurs] of ecritures) hote.executer({ op: 'ecrire_modifier', table, cle: { id }, valeurs: avecLaCle(table, valeurs) });
      hote.suivreLesElements();
    },
  });
}

/** L'adresse de la page `id` : son segment renommé, son adresse lue dans la base, et celle de son mot-clé `motCle`. */
const etat = (m, id, motCle = null) => ({
  segment: m.db.prepare('SELECT slug_adresse AS s FROM page WHERE id = ?').get(id).s,
  adresse: adresseDeLaPageEnBase(m.db, id),
  url: motCle === null ? null : m.db.prepare('SELECT url FROM mot_cle WHERE id = ?').get(motCle).url,
});
const anciennes = (m) => m.db.prepare('SELECT adresse, page_id FROM page_ancienne_adresse ORDER BY adresse').all().map((l) => ({ adresse: l.adresse, page_id: l.page_id }));
/** Les lignes du journal sur `table` : l'annulation et le rejeu relisent ce que le suivi a écrit. */
const auJournal = (m, table) => m.db.prepare('SELECT count(*) AS n FROM modification WHERE table_nom = ?').get(table).n;
const urlDe = (m, motCle) => m.db.prepare('SELECT url FROM mot_cle WHERE id = ?').get(motCle).url;

/** Une page des Règles et son mot-clé ancré. */
function poserUnePageDesRegles(db, titre, { verrou = false, sansMotCle = false } = {}) {
  const id = poserPageLisible(db, idDesRegles(titre), titre);
  return { id, motCle: sansMotCle ? null : ancrerUnMotCle(db, 'page', id, { categories: ['Règles'], verrou }) };
}

/** Une classe et deux de ses dons du niveau 5, chacun avec son mot-clé ancré. */
function poserDeuxDons(db) {
  const classe = poserClasse(db, 'classes/zephyrion-mage', nom('Mage'));
  const don = (slug, libelle, rang) => {
    const id = poserCapacite(db, `capacites/zephyrion-mage-${slug}`, { classe, nom: libelle, niveau: 5, rang });
    return { id, motCle: ancrerUnMotCle(db, 'page', id, { categories: ['Don'] }) };
  };
  return { classe, un: don('zorblat', 'Zorblat', 2), deux: don('zorblit', 'Zorblit', 1) };
}

test('R316 : une page des Règles renommée prend l’adresse de son nouveau titre, l’ancienne est gardée, l’identifiant ne change pas ; un accent ou une majuscule seuls ne la déplacent pas', () => cas(
  (db) => poserUnePageDesRegles(db, nom('avant')),
  (m) => {
    const { id, motCle } = m.monde;
    const avant = etat(m, id, motCle);
    renommer(m, id, 'ZÉPHYRION Avant');
    assert.equal(m.db.prepare('SELECT titre FROM page WHERE id = ?').get(id).titre, 'ZÉPHYRION Avant');
    assert.deepEqual(etat(m, id, motCle), avant, 'un accent ou une majuscule : rien ne bouge');
    assert.equal(avant.segment, null);
    assert.deepEqual(anciennes(m), []);
    assert.equal(auJournal(m, 'page_ancienne_adresse'), 0);
    assert.equal(m.db.prepare("SELECT count(*) AS n FROM modification WHERE table_nom = 'page' AND apres LIKE '%slug_adresse%'").get().n, 0, 'rien n’est écrit');

    renommer(m, id, nom('après'));
    const nouvelle = `/regles/${normalize(nom('après'))}/`;
    assert.deepEqual(etat(m, id, motCle), { segment: normalize(nom('après')), adresse: nouvelle, url: nouvelle });
    assert.deepEqual(anciennes(m), [{ adresse: `regles/${normalize(nom('avant'))}/`, page_id: id }]);
    assert.deepEqual({ ...m.db.prepare('SELECT id, slug FROM page').get() }, { id, slug: normalize(nom('avant')) }, 'l’identifiant et le slug restent');
    assert.ok(auJournal(m, 'page_ancienne_adresse') > 0, 'l’ancienne adresse est notée au journal');
  },
));

test('R316 : trois titres de suite laissent deux anciennes adresses vers la même page ; revenir au premier rend l’adresse de l’identifiant (segment NULL) et retire la ligne de l’adresse reprise', () => cas(
  (db) => poserUnePageDesRegles(db, nom('un')),
  (m) => {
    const { id, motCle } = m.monde;
    renommer(m, id, nom('deux'));
    renommer(m, id, nom('trois'));
    const derniere = `/regles/${normalize(nom('trois'))}/`;
    assert.deepEqual(etat(m, id, motCle), { segment: normalize(nom('trois')), adresse: derniere, url: derniere });
    assert.deepEqual(anciennes(m), [
      { adresse: `regles/${normalize(nom('deux'))}/`, page_id: id },
      { adresse: `regles/${normalize(nom('un'))}/`, page_id: id },
    ]);

    renommer(m, id, nom('un'));
    const premiere = `/regles/${normalize(nom('un'))}/`;
    assert.deepEqual(etat(m, id, motCle), { segment: null, adresse: premiere, url: premiere });
    assert.deepEqual(anciennes(m), [
      { adresse: `regles/${normalize(nom('deux'))}/`, page_id: id },
      { adresse: `regles/${normalize(nom('trois'))}/`, page_id: id },
    ], 'les adresses intermédiaires restent');
  },
));

test('R316 (2) : une adresse prise par une autre page, un nom réservé des Règles (Glossaire, les autres) ou un onglet donne le suffixe -2, le renommage est accepté', () => cas(
  (db) => {
    poserPageLisible(db, PAGE_R228, nom('super'));
    poserOnglet(db, 'zephyrion-onglet', nom('onglet'));
    return {
      prise: poserUnePageDesRegles(db, nom('avant')),
      reservees: [...NOMS_RESERVES, 'zephyrion-onglet'].map((reserve, i) => ({ reserve, ...poserUnePageDesRegles(db, nom(`page ${i + 1}`)) })),
    };
  },
  (m) => {
    const { prise: { id, motCle }, reservees } = m.monde;
    const autre = adresseDeLaPageEnBase(m.db, PAGE_R228);
    assert.equal(autre, `/regles/${SEGMENT_R228}/`, 'l’autre page tient l’adresse que le titre voudrait');
    const titre = SEGMENT_R228.replaceAll('-', ' ');
    renommer(m, id, titre);
    assert.equal(m.db.prepare('SELECT titre FROM page WHERE id = ?').get(id).titre, titre, 'le renommage est accepté');
    const suffixee = `/regles/${SEGMENT_R228}-2/`;
    assert.deepEqual(etat(m, id, motCle), { segment: `${SEGMENT_R228}-2`, adresse: suffixee, url: suffixee });
    assert.equal(adresseDeLaPageEnBase(m.db, PAGE_R228), autre, 'l’autre page garde la sienne');
    assert.deepEqual(anciennes(m), [{ adresse: `regles/${normalize(nom('avant'))}/`, page_id: id }]);

    assert.ok(NOMS_RESERVES.includes('glossaire'));
    saisir(m, ...reservees.map(({ id: page, reserve }) => ['page', page, { titre: reserve[0].toUpperCase() + reserve.slice(1).replaceAll('-', ' ') }]));
    for (const { id: page, motCle: leSien, reserve } of reservees) {
      const reservee = `/regles/${reserve}-2/`;
      assert.deepEqual(etat(m, page, leSien), { segment: `${reserve}-2`, adresse: reservee, url: reservee }, reserve);
    }
    assert.equal(anciennes(m).length, 1 + reservees.length);

    // qui tient une adresse : la page vivante, une route (nom réservé, onglet), personne pour une ancienne adresse ou pour la page mise de côté
    const { adressePrise } = outilsDesAdresses({ ErreurEdition });
    assert.equal(adressePrise(m.db, autre), PAGE_R228);
    assert.equal(adressePrise(m.db, '/regles/glossaire/'), 'route');
    assert.equal(adressePrise(m.db, '/regles/zephyrion-onglet/'), 'route');
    assert.equal(adressePrise(m.db, `/regles/${normalize(nom('avant'))}/`), null, 'une ancienne adresse est libre');
    assert.equal(adressePrise(m.db, suffixee), id);
    assert.equal(adressePrise(m.db, suffixee, { sauf: [id] }), null);
  },
));

test('R316 (3), (4) : un métier renommé : son ancre suit, l’ancienne est gardée ; un autre métier qui prend cette ancienne adresse la reprend, la ligne disparaît', () => cas(
  (db) => {
    const metier = (titre) => {
      const id = poserMetier(db, `metiers/${normalize(titre)}`, titre);
      return { id, motCle: ancrerUnMotCle(db, 'page', id, { categories: ['Métier'] }) };
    };
    return { un: metier(nom('Forgeur')), deux: metier(nom('Tanneur')) };
  },
  (m) => {
    const { un, deux } = m.monde;
    saisir(m, ['metier', un.id, { nom: nom('Batteur') }]);
    const batteur = `/metiers/#metier-${normalize(nom('Batteur'))}`;
    assert.deepEqual(etat(m, un.id, un.motCle), { segment: normalize(nom('Batteur')), adresse: batteur, url: batteur }, 'l’ancre suit le nom du métier');
    assert.deepEqual(anciennes(m), [{ adresse: `metiers/#metier-${normalize(nom('Forgeur'))}`, page_id: un.id }]);
    saisir(m, ['metier', deux.id, { nom: nom('Forgeur') }]);
    const reprise = `/metiers/#metier-${normalize(nom('Forgeur'))}`;
    assert.deepEqual(etat(m, deux.id, deux.motCle), { segment: normalize(nom('Forgeur')), adresse: reprise, url: reprise });
    assert.deepEqual(etat(m, un.id, un.motCle).adresse, `/metiers/#metier-${normalize(nom('Batteur'))}`);
    assert.deepEqual(anciennes(m), [{ adresse: `metiers/#metier-${normalize(nom('Tanneur'))}`, page_id: deux.id }], 'la ligne de l’adresse reprise est retirée');
  },
));

test('R316 (1), (2) : un don renommé va à capacites/<classe>-<nouveau nom>/ ; un nom déjà pris dans sa classe reçoit le niveau', () => cas(
  (db) => poserDeuxDons(db),
  (m) => {
    const { un, deux } = m.monde;
    saisir(m, ['capacite', un.id, { nom: 'Zorblut' }]);
    assert.deepEqual(etat(m, un.id, un.motCle), { segment: 'zephyrion-mage-zorblut', adresse: '/capacites/zephyrion-mage-zorblut/', url: '/capacites/zephyrion-mage-zorblut/' });
    saisir(m, ['capacite', un.id, { nom: 'Zorblit' }]);
    assert.deepEqual(etat(m, un.id, un.motCle), { segment: 'zephyrion-mage-zorblit-5', adresse: '/capacites/zephyrion-mage-zorblit-5/', url: '/capacites/zephyrion-mage-zorblit-5/' });
    assert.deepEqual(etat(m, deux.id, deux.motCle), { segment: null, adresse: '/capacites/zephyrion-mage-zorblit/', url: '/capacites/zephyrion-mage-zorblit/' });
    assert.deepEqual(anciennes(m), [
      { adresse: 'capacites/zephyrion-mage-zorblat/', page_id: un.id },
      { adresse: 'capacites/zephyrion-mage-zorblut/', page_id: un.id },
    ]);
  },
));

test('R316 (1) : une page suivie dont le premier segment voulu donne son adresse d’aujourd’hui la garde, même voulue par une page placée avant elle dans le lot', () => cas(
  (db) => poserDeuxDons(db),
  (m) => {
    const { un, deux } = m.monde;
    // « Zorblat » prend le nom de « Zorblit », dont seule la page est retitrée, après lui dans le même lot : « Zorblit » garde son adresse
    parUnLot(m, ['capacite', un.id, { nom: 'Zorblit' }], ['page', un.id, { titre: `Zorblit (${nom('Mage')})` }],
      ['page', deux.id, { titre: `Zorblit (${nom('Mage')}, essai)` }]);
    assert.deepEqual(etat(m, deux.id, deux.motCle), { segment: null, adresse: '/capacites/zephyrion-mage-zorblit/', url: '/capacites/zephyrion-mage-zorblit/' });
    assert.deepEqual(etat(m, un.id, un.motCle), { segment: 'zephyrion-mage-zorblit-5', adresse: '/capacites/zephyrion-mage-zorblit-5/', url: '/capacites/zephyrion-mage-zorblit-5/' });
    assert.deepEqual(anciennes(m), [{ adresse: 'capacites/zephyrion-mage-zorblat/', page_id: un.id }]);
  },
));

test('R316 (1) : une race et une classe renommées ; l’adresse de la classe ne porte pas « (classe) » ; une classe raciale prend le segment de sa race renommée dans le même lot', () => cas(
  (db) => {
    const race = poserRace(db, 'races/zephyrion-elfe', nom('Elfe'));
    const classe = poserClasse(db, 'classes/zephyrion-elfe', nom('Elfe'), { titre: `${nom('Elfe')} (classe)` });
    const lezard = poserRace(db, 'races/zephyrion-lezard', nom('Lézard'));
    const raciale = poserClasse(db, 'classes/zephyrion-lezard', nom('Lézard'), { categorie: CATEGORIE_RACIALE });
    return {
      race: { id: race, motCle: ancrerUnMotCle(db, 'page', race, { categories: ['Race'] }) },
      classe: { id: classe, motCle: ancrerUnMotCle(db, 'page', classe, { categories: ['Classe'] }) },
      lezard: { id: lezard, motCle: ancrerUnMotCle(db, 'page', lezard, { categories: ['Race'] }) },
      raciale: { id: raciale, motCle: ancrerUnMotCle(db, 'page', raciale, { categories: ['Classe'] }) },
    };
  },
  (m) => {
    const { race, classe, lezard, raciale } = m.monde;
    parUnLot(m, ['race', race.id, { nom: nom('Sylve') }], ['page', race.id, { titre: nom('Sylve') }],
      ['classe', classe.id, { nom: nom('Sylve') }], ['page', classe.id, { titre: `${nom('Sylve')} (classe)` }]);
    const segment = normalize(nom('Sylve'));
    assert.deepEqual(etat(m, race.id, race.motCle), { segment, adresse: `/races/${segment}/`, url: `/races/${segment}/` });
    assert.deepEqual(etat(m, classe.id, classe.motCle), { segment, adresse: `/classes/${segment}/`, url: `/classes/${segment}/` });
    assert.deepEqual(anciennes(m), [{ adresse: 'classes/zephyrion-elfe/', page_id: classe.id }, { adresse: 'races/zephyrion-elfe/', page_id: race.id }]);

    // la classe raciale d'abord dans le lot, sa race ensuite : elle prend quand même le segment que sa race reçoit
    parUnLot(m, ['page', raciale.id, { titre: nom('Ophidien') }], ['race', lezard.id, { nom: nom('Ophidien') }], ['page', lezard.id, { titre: nom('Ophidien') }]);
    const ophidien = normalize(nom('Ophidien'));
    assert.deepEqual(etat(m, lezard.id, lezard.motCle), { segment: ophidien, adresse: `/races/${ophidien}/`, url: `/races/${ophidien}/` });
    assert.deepEqual(etat(m, raciale.id, raciale.motCle), { segment: ophidien, adresse: `/classes/${ophidien}/`, url: `/classes/${ophidien}/` }, 'le segment de sa race');
    assert.deepEqual(anciennes(m), [
      { adresse: 'classes/zephyrion-elfe/', page_id: classe.id },
      { adresse: 'classes/zephyrion-lezard/', page_id: raciale.id },
      { adresse: 'races/zephyrion-elfe/', page_id: race.id },
      { adresse: 'races/zephyrion-lezard/', page_id: lezard.id },
    ]);
  },
));

test('R316 (1) : les segments voulus sont ceux de la création, dans l’ordre (don, élément, classe raciale, autre page, titre sans lettre ni chiffre)', () => {
  const db = baseDAncrage();
  try {
    const { un } = poserDeuxDons(db);
    poserMetier(db, 'metiers/zephyrion-forgeur', nom('Batteur'));
    db.prepare('UPDATE page SET titre = ? WHERE id = ?').run(nom('page du métier'), 'metiers/zephyrion-forgeur');
    poserClasse(db, 'classes/zephyrion-elfe', nom('Elfe'), { titre: `${nom('Elfe')} (classe)` });
    poserRace(db, 'races/zephyrion-lezard', nom('Lézard'));
    poserClasse(db, 'classes/zephyrion-lezard', nom('Lézard'), { categorie: CATEGORIE_RACIALE });
    poserPageLisible(db, 'guide/zephyrion-page', nom('autre titre'));
    poserPageLisible(db, 'guide/zephyrion-vide', '¿ ? !');
    const premiers = (id, combien) => {
      const sortie = [];
      for (const s of segmentsVoulus(db, db.prepare('SELECT * FROM page WHERE id = ?').get(id))) {
        sortie.push(s);
        if (sortie.length === combien) break;
      }
      return sortie;
    };
    assert.deepEqual(premiers(un.id, 5), ['zephyrion-mage-zorblat', 'zephyrion-mage-zorblat-5', 'zephyrion-mage-zorblat-5-2', 'zephyrion-mage-zorblat-5-2-2', 'zephyrion-mage-zorblat-5-2-3']);
    assert.deepEqual(premiers('metiers/zephyrion-forgeur', 3), ['zephyrion-batteur', 'zephyrion-batteur-2', 'zephyrion-batteur-3'], 'le nom du métier, pas le titre de sa page');
    assert.deepEqual(premiers('classes/zephyrion-elfe', 2), ['zephyrion-elfe', 'zephyrion-elfe-2']);
    assert.deepEqual(premiers('classes/zephyrion-lezard', 2), ['zephyrion-lezard', 'zephyrion-lezard-2'], 'une classe raciale : le segment de sa race');
    db.prepare("UPDATE page SET slug_adresse = 'zephyrion-ophidien' WHERE id = 'races/zephyrion-lezard'").run();
    assert.deepEqual(premiers('classes/zephyrion-lezard', 1), ['zephyrion-ophidien'], 'celui de sa race renommée');
    assert.deepEqual(premiers('guide/zephyrion-page', 3), ['zephyrion-autre-titre', 'zephyrion-autre-titre-2', 'zephyrion-autre-titre-3']);
    assert.deepEqual(premiers('guide/zephyrion-vide', 3), [], 'aucun segment : rien ne bouge');
  } finally {
    db.close();
  }
});

test('R316 : une page servie par une route fixe garde son adresse quel que soit son titre', () => cas(
  (db) => {
    const [servie] = Object.keys(ADRESSES_DES_PAGES_SERVIES);
    poserPageLisible(db, servie, nom('servie'));
    const accueil = poserPageLisible(db, DECOUVRIR.accueil, nom('accueil'));
    return { servie, accueil, motCle: ancrerUnMotCle(db, 'page', accueil, { categories: ['Règles'] }) };
  },
  (m) => {
    const { servie, accueil, motCle } = m.monde;
    const avant = [etat(m, accueil, motCle), etat(m, servie)];
    renommer(m, accueil, nom('accueil renommé'));
    parUnLot(m, ['page', servie, { titre: nom('servie renommée') }]);
    assert.deepEqual([etat(m, accueil, motCle), etat(m, servie)], avant);
    assert.equal(avant[0].adresse, `/${DECOUVRIR.chemin}`);
    assert.deepEqual(anciennes(m), []);
  },
));

test('R316 et R228 : la page renommée à la main dans le code, renommée au titre de son identifiant, écrit son segment (non NULL)', () => cas(
  (db) => {
    const id = poserPageLisible(db, PAGE_R228, nom('super'));
    return { id, motCle: ancrerUnMotCle(db, 'page', id, { categories: ['Règles'] }) };
  },
  (m) => {
    const { id, motCle } = m.monde;
    assert.equal(adresseDeLaPageEnBase(m.db, id), `/regles/${SEGMENT_R228}/`);
    const segmentDeLId = id.slice(id.indexOf('/') + 1);
    renommer(m, id, segmentDeLId.replaceAll('-', ' '));
    assert.deepEqual(etat(m, id, motCle), { segment: segmentDeLId, adresse: `/regles/${segmentDeLId}/`, url: `/regles/${segmentDeLId}/` });
    assert.deepEqual(anciennes(m), [{ adresse: `regles/${SEGMENT_R228}/`, page_id: id }]);
  },
));

test('R316 : la page d’une magie renommée : l’adresse des mots-clés de ses sorts suit, leur ancre gardée', () => cas(
  (db) => {
    const id = poserPageLisible(db, 'magies/zephyrion-feu', nom('Feu'));
    poserMagie(db, id, nom('Feu'));
    const sorts = [nom('Braise'), nom('Cendre')].map((s) => poserSort(db, id, s));
    return { id, motCle: ancrerUnMotCle(db, 'page', id, { categories: ['Magie'] }), sorts: sorts.map((s) => ({ id: s, motCle: ancrerUnMotCle(db, 'sort', s, { categories: ['Sort'] }) })) };
  },
  (m) => {
    const { id, motCle, sorts } = m.monde;
    parUnLot(m, ['magie', id, { nom: nom('Flamme') }], ['page', id, { titre: nom('Flamme') }]);
    const nouvelle = `/magies/${normalize(nom('Flamme'))}/`;
    assert.deepEqual(etat(m, id, motCle), { segment: normalize(nom('Flamme')), adresse: nouvelle, url: nouvelle });
    for (const s of sorts) {
      const url = urlDe(m, s.motCle);
      assert.equal(url, adresseDuSortEnBase(m.db, s.id));
      assert.equal(url, `${nouvelle}#sort-${s.id.split('#sort:')[1]}`, 'l’ancre du sort est gardée');
    }
    assert.deepEqual(anciennes(m), [{ adresse: 'magies/zephyrion-feu/', page_id: id }]);
  },
));

test('R316 : deux dons qui échangent leurs noms dans un même lot déposé échangent leurs adresses, sans suffixe ni ancienne adresse', () => cas(
  (db) => poserDeuxDons(db),
  async (m) => {
    const { un, deux } = m.monde;
    const lot = {
      format: FORMAT_DU_LOT, titre: 'Échange d’essai', nature: 'decision', decision: 'R316', operations: [
        { table: 'capacite', cle: { id: un.id }, operation: 'modifier', avant: { nom: 'Zorblat' }, apres: { nom: 'Zorblit' } },
        { table: 'capacite', cle: { id: deux.id }, operation: 'modifier', avant: { nom: 'Zorblit' }, apres: { nom: 'Zorblat' } },
      ],
    };
    const r = await deposerEtAppliquer(m.base, lot, { par: 'cle_de_depot', enArrierePlan: false, dossier: m.dossier, controle: { ouvertHorsEdition: true } });
    assert.equal(r.etat, 'applique', JSON.stringify(r.refus ?? null));
    assert.deepEqual(etat(m, un.id, un.motCle), { segment: 'zephyrion-mage-zorblit', adresse: '/capacites/zephyrion-mage-zorblit/', url: '/capacites/zephyrion-mage-zorblit/' });
    assert.deepEqual(etat(m, deux.id, deux.motCle), { segment: 'zephyrion-mage-zorblat', adresse: '/capacites/zephyrion-mage-zorblat/', url: '/capacites/zephyrion-mage-zorblat/' });
    assert.deepEqual(anciennes(m), [], 'chaque adresse quittée est celle d’une page vivante');
  },
));

test('R316 : une page sans mot-clé et une page dont le mot-clé est verrouillé suivent leur titre ; l’adresse du verrouillé aussi', () => cas(
  (db) => ({ sans: poserUnePageDesRegles(db, nom('sans'), { sansMotCle: true }), verrouillee: poserUnePageDesRegles(db, nom('verrou'), { verrou: true }) }),
  (m) => {
    const { sans, verrouillee } = m.monde;
    saisir(m, ['page', sans.id, { titre: nom('sans, renommée') }], ['page', verrouillee.id, { titre: nom('verrou, renommée') }]);
    const [a, b] = [normalize(nom('sans, renommée')), normalize(nom('verrou, renommée'))];
    assert.deepEqual(etat(m, sans.id), { segment: a, adresse: `/regles/${a}/`, url: null });
    assert.deepEqual(etat(m, verrouillee.id, verrouillee.motCle), { segment: b, adresse: `/regles/${b}/`, url: `/regles/${b}/` });
    assert.equal(m.db.prepare('SELECT verrou FROM mot_cle WHERE id = ?').get(verrouillee.motCle).verrou, 1);
    assert.equal(anciennes(m).length, 2);
  },
));

test('R316 : un titre sans lettre ni chiffre ne déplace rien ; « Règles des métiers », sans ligne de métier, prend le segment de son titre', () => cas(
  (db) => ({ page: poserUnePageDesRegles(db, nom('avant')), regles: { id: PAGE_DES_REGLES, motCle: ancrerUnMotCle(db, 'page', poserPageLisible(db, PAGE_DES_REGLES, nom('règles')), { categories: ['Métier'] }) } }),
  (m) => {
    const { page, regles } = m.monde;
    const avant = etat(m, page.id, page.motCle);
    renommer(m, page.id, '¿ ? !');
    assert.deepEqual(etat(m, page.id, page.motCle), avant);
    parUnLot(m, ['page', regles.id, { titre: nom('règles neuves') }]);
    const segment = normalize(nom('règles neuves'));
    assert.deepEqual(etat(m, regles.id, regles.motCle), { segment, adresse: `/metiers/${segment}/`, url: `/metiers/${segment}/` });
    assert.deepEqual(anciennes(m), [{ adresse: `${PAGE_DES_REGLES}/`, page_id: regles.id }]);
  },
));

test('R316 : un mot-clé sans élément qui mène à une section de la page suit son chemin, même écrit autrement, requête et ancre gardées ; un chemin voisin ne bouge pas', () => cas(
  (db) => {
    const page = poserUnePageDesRegles(db, nom('avant'));
    const voisine = poserUnePageDesRegles(db, nom('avant bis'));
    const ancienne = `/regles/${normalize(nom('avant'))}/`;
    return {
      page, voisine,
      section: poserMotCle(db, { libelle: nom('section'), url: `${ancienne}#zephyrion-section` }),
      requete: poserMotCle(db, { libelle: nom('requête'), url: `${ancienne}?vue=1#zephyrion-section` }),
      // le même chemin sans barre finale (lib/mots-cles-liens.mjs#cheminDeLAdresse le complète, comme pageDeLAdresse)
      sansBarre: poserMotCle(db, { libelle: nom('sans barre'), url: `${ancienne.slice(0, -1)}#zephyrion-section` }),
    };
  },
  (m) => {
    const { page, voisine, section, requete, sansBarre } = m.monde;
    renommer(m, page.id, nom('après'));
    const nouvelle = `/regles/${normalize(nom('après'))}/`;
    assert.equal(urlDe(m, section), `${nouvelle}#zephyrion-section`);
    assert.equal(urlDe(m, requete), `${nouvelle}?vue=1#zephyrion-section`);
    assert.equal(urlDe(m, sansBarre), `${nouvelle}#zephyrion-section`);
    assert.equal(urlDe(m, voisine.motCle), `/regles/${normalize(nom('avant bis'))}/`);
    assert.deepEqual(etat(m, page.id, page.motCle), { segment: normalize(nom('après')), adresse: nouvelle, url: nouvelle });
    assert.deepEqual(anciennes(m), [{ adresse: `regles/${normalize(nom('avant'))}/`, page_id: page.id }]);
  },
));
