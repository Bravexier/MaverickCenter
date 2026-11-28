// L'adresse renommée (décision R316, docs/chantier-adresses.md, §3, §7, décision 3) pour la création, la suppression, le plan des Règles et les autres lecteurs du
// service : une page créée ne prend jamais l'adresse d'une page vivante (suffixe pour une page des Règles et un don, refus 409 qui nomme la page sinon) et reprend
// une ancienne adresse (sa ligne disparaît) ; une page supprimée emporte ses anciennes adresses, notées au journal ; l'entrée du plan, un lien saisi, une citation,
// le calcul de l'ancrage et les éléments d'un mot-clé lisent l'adresse d'aujourd'hui. Petite base de test/aide-ancrage.mjs, noms inventés ; chaque cas vérifie
// aussi que les contrôles du contenu n'y trouvent rien de plus qu'avant.
//   node --test test/serveur-edition-adresses-creation.test.mjs
import assert from 'node:assert/strict';
import { copyFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { ouvrirBaseVivante } from '../serveur/base-vivante.mjs';
import { controlerLeContenu } from '../serveur/controles-du-contenu.mjs';
import { enregistrer, rejouerLeJournal } from '../serveur/edition.mjs';
import { chargerJournal, journalExporte } from '../serveur/edition-journal.mjs';
import { planVivant } from '../serveur/edition-plan.mjs';
import { adresseDeLaPage, adresseDeLaPageEnBase } from '../src/lib/adresses-db.mjs';
import { citationsDe } from '../src/lib/citations-db.mjs';
import { planDeLAncrage } from '../src/lib/mots-cles-ancrage.mjs';
import { elementsDesMotsCles, lireUnMotCle } from '../src/lib/mots-cles-db.mjs';
import { IDS_DES_MOTS_CLES_PROTEGES } from '../src/lib/mots-cles-proteges.mjs';
import { normalize } from '../src/lib/text.mjs';
import {
  ancrerUnMotCle, baseDAncrage, poserCapacite, poserClasse, poserLesCategoriesNouvelles, poserMagie, poserMetier, poserMotCle, poserOnglet, poserPageLisible, poserSort,
  recalculerLesCles,
} from './aide-ancrage.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';
import { poserUnMotCle } from './aide-mots-cles.mjs';

const racine = dossierTemporaire('edition-adresses-creation');
let n = 0;
const nom = (suffixe) => `Zephyrion ${suffixe}`;
const ONGLET = 'zephyrion-onglet';

/** La petite base nue, écrite une fois en fichier : chaque cas en part d'une copie. */
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
 * Un cas, sur une copie en fichier de la petite base : `poser` y écrit ses lignes et rend ce que l'essai lit (`m.monde`) ; `m.depart` est une copie de la base
 * posée, avant l'essai (pour rejouer le journal). À la fin, les contrôles du contenu n'y trouvent rien de plus qu'avant l'essai.
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
  const depart = join(dossier, 'depart.db');
  copyFileSync(chemin, depart);
  const db = ouvrirBaseVivante(chemin);
  try {
    const avant = new Set(controlerLeContenu(db).problemes);
    await essai({ db, monde, depart });
    assert.deepEqual(controlerLeContenu(db).problemes.filter((p) => !avant.has(p)), [], 'les contrôles du contenu ne trouvent rien de plus');
  } finally {
    db.close();
  }
}

const ecrire = (m, ...operations) => enregistrer(m.db, { page: 'essai/', operations });
const modifier = (m, table, id, valeurs) => ecrire(m, { op: 'modifier', table, cle: { id }, valeurs });
const renommer = (m, id, titre) => modifier(m, 'page', id, { titre });
const creerPageDesRegles = (m, titre) => ecrire(m, { op: 'creer', entite: 'page_des_regles', valeurs: { titre, onglet_id: ONGLET, resume: 'Essai.' } }).crees[0].id;
const anciennes = (m) => m.db.prepare('SELECT adresse, page_id FROM page_ancienne_adresse ORDER BY adresse').all().map((l) => ({ adresse: l.adresse, page_id: l.page_id }));
const segment = (m, id) => m.db.prepare('SELECT slug_adresse AS s FROM page WHERE id = ?').get(id).s;
/** Le refus (ErreurEdition) de `faire`, ou un échec. */
function refus(faire) {
  try {
    faire();
  } catch (e) {
    return e;
  }
  return assert.fail('refus attendu');
}

/**
 * Ce qu'une création par le service cite (clés étrangères de la page créée et mots-clés protégés qu'elle reçoit : lib/mots-cles-proteges.mjs) : les familles et
 * les types de page des pages créées, la catégorie des classes d'essai (aide-ancrage.mjs#poserClasse), les mots-clés « metier » et « capacite-de-classe » (à leur
 * id figé), l'onglet d'essai et sa page d'ouverture.
 */
function poserLeNecessaire(db) {
  ['docs', 'docs_typees', 'classes', 'races'].forEach((id, i) => db.prepare('INSERT INTO famille (id, libelle, ordre) VALUES (?, ?, ?)').run(id, `Famille ${id}`, i + 1));
  db.prepare("INSERT INTO categorie_classe (id, libelle, ordre, origine, source_ref) VALUES ('essai', 'Essai', 1, 'classes', 'essai')").run();
  ['guide', 'metiers', 'capacites'].forEach((id, i) => db.prepare("INSERT INTO type_page (id, libelle, singulier, salon_discord, description, ordre) VALUES (?, ?, ?, '', '', ?)").run(id, id, id, i + 1));
  poserMotCle(db, { id: IDS_DES_MOTS_CLES_PROTEGES.metier, libelle: 'Métier' });
  poserMotCle(db, { id: IDS_DES_MOTS_CLES_PROTEGES['capacite-de-classe'], libelle: 'Capacité de classe' });
  poserOnglet(db, ONGLET, nom('onglet'));
  // la page d'ouverture de l'onglet (clé étrangère de regles_onglet, que le rejeu contrôle lot par lot)
  const { id } = poserUnePageDesRegles(db, nom('ouverture'));
  db.prepare('UPDATE regles_onglet SET ouverture_page_id = ? WHERE id = ?').run(id, ONGLET);
}

/** Une page des Règles dans l'onglet d'essai (son entrée de menu ; tirée du site, elle n'est pas protégée), et son mot-clé ancré. */
function poserUnePageDesRegles(db, titre) {
  const id = poserPageLisible(db, `guide/${normalize(titre)}`, titre);
  db.prepare("UPDATE page SET origine = 'docs' WHERE id = ?").run(id);
  db.prepare('INSERT INTO regles_onglet_entree (id, onglet_id, rang, page_id) VALUES (?, ?, (SELECT coalesce(max(rang), 0) + 1 FROM regles_onglet_entree), ?)').run(`page:${id}`, ONGLET, id);
  return { id, motCle: ancrerUnMotCle(db, 'page', id, { categories: ['Règles'] }) };
}

test('R316 (2) : une page des Règles créée au titre dont le segment est l’adresse d’une page renommée prend le suffixe -2', () => cas(
  (db) => {
    poserLeNecessaire(db);
    return poserUnePageDesRegles(db, nom('un'));
  },
  (m) => {
    const { id } = m.monde;
    renommer(m, id, 'Glossaire'); // nom réservé : glossaire-2
    assert.equal(segment(m, id), 'glossaire-2');
    const titre = 'Glossaire 2';
    assert.equal(normalize(titre), 'glossaire-2', 'le titre voudrait l’adresse de la page renommée');
    const creee = creerPageDesRegles(m, titre);
    assert.equal(creee, 'guide/glossaire-2-2');
    assert.equal(adresseDeLaPageEnBase(m.db, creee), '/regles/glossaire-2-2/');
    assert.equal(adresseDeLaPageEnBase(m.db, id), '/regles/glossaire-2/', 'la page renommée garde la sienne');
    assert.deepEqual(anciennes(m), [{ adresse: `regles/${normalize(nom('un'))}/`, page_id: id }]);
  },
));

test('R316 (3) : une page des Règles créée à une ancienne adresse la reprend (la ligne disparaît, au journal)', () => cas(
  (db) => {
    poserLeNecessaire(db);
    return poserUnePageDesRegles(db, nom('un'));
  },
  (m) => {
    const { id } = m.monde;
    renommer(m, id, 'Glossaire'); // nom réservé : glossaire-2 ; l'ancien titre devient un alias, pas « Glossaire 2 »
    renommer(m, id, nom('trois'));
    assert.deepEqual(anciennes(m).map((a) => a.adresse), ['regles/glossaire-2/', `regles/${normalize(nom('un'))}/`]);
    const r = ecrire(m, { op: 'creer', entite: 'page_des_regles', valeurs: { titre: 'Glossaire 2', onglet_id: ONGLET, resume: 'Essai.' } });
    const creee = r.crees[0].id;
    assert.equal(creee, 'guide/glossaire-2');
    assert.equal(adresseDeLaPageEnBase(m.db, creee), '/regles/glossaire-2/');
    assert.deepEqual(anciennes(m), [{ adresse: `regles/${normalize(nom('un'))}/`, page_id: id }], 'la ligne de l’adresse reprise est retirée');
    assert.equal(m.db.prepare("SELECT count(*) AS n FROM modification WHERE lot_id = ? AND table_nom = 'page_ancienne_adresse' AND operation = 'supprimer'").get(r.lot).n, 1);
  },
));

test('R316 (2) : un don créé au nom d’un don renommé de sa classe reçoit le suffixe du niveau, l’adresse renommée est prise', () => cas(
  (db) => {
    poserLeNecessaire(db);
    const classe = poserClasse(db, 'classes/zephyrion-mage', nom('Mage'));
    const don = poserCapacite(db, 'capacites/zephyrion-mage-zorblat', { classe, nom: 'Zorblat', niveau: 5, rang: 1 });
    ancrerUnMotCle(db, 'page', don, { categories: ['Don'] });
    return { classe, don };
  },
  (m) => {
    const { classe, don } = m.monde;
    modifier(m, 'capacite', don, { nom: 'Zorblot' });
    assert.equal(adresseDeLaPageEnBase(m.db, don), '/capacites/zephyrion-mage-zorblot/');
    const cree = ecrire(m, { op: 'creer', entite: 'capacite', valeurs: { classe_id: classe, niveau: '10', nom: 'Zorblot', type: 'Passif' } }).crees[0].id;
    assert.equal(cree, 'capacites/zephyrion-mage-zorblot-10');
    assert.equal(adresseDeLaPageEnBase(m.db, cree), '/capacites/zephyrion-mage-zorblot-10/');
  },
));

test('R316 (3) : un métier créé à l’ancienne adresse d’un métier renommé est créé et la reprend ; à l’adresse d’aujourd’hui d’un autre, refus 409 qui nomme la page, sans numéro de décision', () => cas(
  (db) => {
    poserLeNecessaire(db);
    const id = poserMetier(db, `metiers/${normalize(nom('Forgeur'))}`, nom('Forgeur'));
    return { id, motCle: ancrerUnMotCle(db, 'page', id, { categories: ['Métier'] }) };
  },
  (m) => {
    const { id } = m.monde;
    modifier(m, 'metier', id, { nom: nom('Batteur') });
    modifier(m, 'metier', id, { nom: nom('Tanneur') });
    assert.deepEqual(anciennes(m).map((a) => a.adresse), [`metiers/#metier-${normalize(nom('Batteur'))}`, `metiers/#metier-${normalize(nom('Forgeur'))}`]);

    const cree = ecrire(m, { op: 'creer', entite: 'metier', valeurs: { nom: nom('Batteur') } }).crees[0].id;
    assert.equal(cree, `metiers/${normalize(nom('Batteur'))}`);
    assert.equal(adresseDeLaPageEnBase(m.db, cree), `/metiers/#metier-${normalize(nom('Batteur'))}`);
    assert.deepEqual(anciennes(m), [{ adresse: `metiers/#metier-${normalize(nom('Forgeur'))}`, page_id: id }], 'la ligne de l’adresse reprise est retirée');

    const avant = m.db.prepare('SELECT count(*) AS n FROM modification').get().n;
    const e = refus(() => ecrire(m, { op: 'creer', entite: 'metier', valeurs: { nom: nom('Tanneur') } }));
    assert.equal(e.statut, 409, e.message);
    assert.ok(e.message.includes(id) && e.message.includes(nom('Tanneur')), e.message);
    assert.doesNotMatch(e.message, /R\d+/);
    assert.equal(m.db.prepare('SELECT 1 FROM page WHERE id = ?').get(`metiers/${normalize(nom('Tanneur'))}`), undefined);
    assert.equal(m.db.prepare('SELECT count(*) AS n FROM modification').get().n, avant, 'rien d’écrit');
  },
));

test('R316 : une page créée puis renommée dans le même lot ne laisse aucune ancienne adresse (la première n’a jamais été publiée)', () => cas(
  (db) => poserLeNecessaire(db),
  (m) => {
    const r = ecrire(m,
      { op: 'creer', entite: 'page_des_regles', valeurs: { titre: nom('neuve'), onglet_id: ONGLET, resume: 'Essai.' } },
      { op: 'modifier', table: 'page', cle: { id: `guide/${normalize(nom('neuve'))}` }, valeurs: { titre: nom('renommée') } });
    const id = r.crees[0].id;
    assert.equal(adresseDeLaPageEnBase(m.db, id), `/regles/${normalize(nom('renommée'))}/`);
    assert.deepEqual(anciennes(m), []);
  },
));

test('R316 : une page renommée puis supprimée emporte ses anciennes adresses, chacune notée au journal ; le journal rejoué redonne la même base', () => cas(
  (db) => {
    poserLeNecessaire(db);
    return poserUnePageDesRegles(db, nom('un'));
  },
  (m) => {
    const { id } = m.monde;
    renommer(m, id, nom('deux'));
    renommer(m, id, nom('trois'));
    assert.equal(anciennes(m).length, 2);
    const r = ecrire(m, { op: 'supprimer', entite: 'page_des_regles', cle: { id } });
    assert.equal(m.db.prepare('SELECT 1 FROM page WHERE id = ?').get(id), undefined);
    assert.deepEqual(anciennes(m), []);
    const notees = m.db.prepare("SELECT cle, operation FROM modification WHERE lot_id = ? AND table_nom = 'page_ancienne_adresse' ORDER BY rang").all(r.lot);
    assert.deepEqual(notees.map((l) => [JSON.parse(l.cle).adresse, l.operation]), [
      [`regles/${normalize(nom('deux'))}/`, 'supprimer'], [`regles/${normalize(nom('un'))}/`, 'supprimer'],
    ]);
    const lePage = m.db.prepare("SELECT min(rang) AS r FROM modification WHERE lot_id = ? AND table_nom = 'page' AND operation = 'supprimer'").get(r.lot).r;
    assert.ok(notees.length && lePage > Math.max(...m.db.prepare("SELECT rang FROM modification WHERE lot_id = ? AND table_nom = 'page_ancienne_adresse'").all(r.lot).map((l) => l.rang)),
      'les anciennes adresses avant la page');

    const etat = (db) => ({
      pages: db.prepare('SELECT id, titre, slug_adresse FROM page ORDER BY id').all().map((p) => ({ ...p })),
      anciennes: db.prepare('SELECT adresse, page_id FROM page_ancienne_adresse ORDER BY adresse').all().map((p) => ({ ...p })),
      // l'adresse d'un mot-clé se lit sur son élément (migration 0136) ; son repère, tel quel
      motsCles: db.prepare('SELECT id FROM mot_cle ORDER BY id').all().map((p) => ({ id: p.id, url: lireUnMotCle(db, p.id).url })),
      reperes: db.prepare('SELECT * FROM repere ORDER BY mot_cle_id').all().map((p) => ({ ...p })),
    });
    const journal = journalExporte(m.db);
    const neuve = ouvrirBaseVivante(m.depart);
    try {
      neuve.exec('PRAGMA foreign_keys = OFF');
      neuve.exec('BEGIN');
      chargerJournal(neuve, journal);
      const sortie = {};
      const bilan = rejouerLeJournal(neuve, sortie);
      neuve.exec('COMMIT');
      const conflits = neuve.prepare("SELECT table_nom, cle, operation, detail FROM modification WHERE etat = 'conflit' ORDER BY lot_id, rang").all().map((c) => ({ ...c }));
      assert.equal(bilan.conflits, 0, JSON.stringify({ bilan, sortie, conflits }).slice(0, 4000));
      assert.deepEqual(etat(neuve), etat(m.db));
    } finally {
      neuve.close();
    }
  },
));

test('R316 : l’entrée du plan d’une page renommée porte son adresse d’aujourd’hui', () => cas(
  (db) => {
    poserLeNecessaire(db);
    return poserUnePageDesRegles(db, nom('un'));
  },
  (m) => {
    const { id } = m.monde;
    renommer(m, id, nom('deux'));
    const entree = planVivant(m.db).onglets.find((o) => o.id === ONGLET).entrees.find((e) => e.page_id === id);
    assert.equal(entree.adresse, `regles/${normalize(nom('deux'))}/`);
  },
));

test('R316 : un lien saisi vers l’adresse d’aujourd’hui d’une page renommée (ou par son titre) devient la balise de son mot-clé ; vers l’ancienne adresse, refus 400', () => cas(
  (db) => {
    poserLeNecessaire(db);
    return { cible: poserUnePageDesRegles(db, nom('un')), texte: poserPageLisible(db, 'guide/zephyrion-texte', nom('texte')) };
  },
  (m) => {
    const { cible: { id, motCle }, texte } = m.monde;
    renommer(m, id, nom('deux'));
    const nouvelle = `/regles/${normalize(nom('deux'))}/`;
    assert.equal(lireUnMotCle(m.db, motCle).url, nouvelle);
    const cle = m.db.prepare('SELECT cle FROM mot_cle WHERE id = ?').get(motCle).cle;
    const corps = () => m.db.prepare('SELECT corps_md FROM page WHERE id = ?').get(texte).corps_md;

    modifier(m, 'page', texte, { corps_md: `Voir [la page](${nouvelle}).\n` });
    assert.match(corps(), new RegExp(`\\{\\{${cle}\\|`), 'le lien est devenu la balise du mot-clé');
    modifier(m, 'page', texte, { corps_md: `Voir [[${nom('deux')}|la page]].\n` });
    assert.match(corps(), new RegExp(`\\{\\{${cle}\\|`), 'un lien [[…]] vers la page aussi');

    const e = refus(() => modifier(m, 'page', texte, { corps_md: `Voir [la page](/regles/${normalize(nom('un'))}/).\n` }));
    assert.equal(e.statut, 400, e.message);
  },
));

test('R316 : une page renommée est citée par un lien écrit vers son adresse d’aujourd’hui', () => cas(
  (db) => {
    poserLeNecessaire(db);
    return poserUnePageDesRegles(db, nom('un'));
  },
  (m) => {
    const { id } = m.monde;
    renommer(m, id, nom('deux'));
    // un texte qui cite la page par son adresse écrite (une définition de mot-clé : un texte que le service ne réécrit pas en balise)
    poserUnMotCle(m.db, { id: 9500, libelle: 'Zephyrion citant', cle: 'zephyrion-citant', description: `Voir /regles/${normalize(nom('deux'))}/.` });
    // (sans page ni sort, sa définition est dans son repère : migration 0136)
    assert.deepEqual(citationsDe(m.db, id).filter((c) => c.comment === 'adresse').map((c) => [c.table, c.cle.mot_cle_id]), [['repere', 9500]]);
    m.db.prepare('DELETE FROM mot_cle WHERE id = 9500').run();
  },
));

test('R316 : le calcul de l’ancrage et les éléments d’un mot-clé lisent l’adresse renommée (page, magie, sort) ; rien à réaligner', () => {
  const db = baseDAncrage();
  poserLesCategoriesNouvelles(db);
  const page = poserPageLisible(db, 'races/zephyrine', 'Zéphyrine');
  const magie = poserPageLisible(db, 'magies/zephyrisme', 'Zéphyrisme');
  poserMagie(db, magie, 'Zéphyrisme');
  const sort = poserSort(db, magie, 'Zéphyr', { types: ['attaque'] });
  const motCleDeLaPage = ancrerUnMotCle(db, 'page', page, { categories: ['Race'] });
  const motCleDuSort = ancrerUnMotCle(db, 'sort', sort, { categories: ['Sort'] });
  const motCleDeLaMagie = poserMotCle(db, { libelle: 'Zéphyrisme', url: '/magies/zephyrisme/', categories: ['Magie'] });
  db.prepare('UPDATE magie SET mot_cle_id = ? WHERE id = ?').run(motCleDeLaMagie, magie);
  db.prepare("UPDATE page SET slug_adresse = 'zephyrienne', titre = 'Zéphyrienne' WHERE id = ?").run(page);
  db.prepare("UPDATE page SET slug_adresse = 'zephyrie' WHERE id = ?").run(magie);
  // depuis la migration 0136, le nom et l'adresse des mots-clés de la page et du sort se lisent sur eux ; celui de la magie, sans page ni sort, garde
  // les siens dans son repère
  db.prepare("UPDATE repere SET adresse = '/magies/zephyrie/' WHERE mot_cle_id = ?").run(motCleDeLaMagie);
  assert.deepEqual([lireUnMotCle(db, motCleDeLaPage).libelle, lireUnMotCle(db, motCleDeLaPage).url], ['Zéphyrienne', '/races/zephyrienne/']);
  assert.equal(lireUnMotCle(db, motCleDuSort).url, '/magies/zephyrie/#sort-zephyr');
  recalculerLesCles(db);

  const elements = elementsDesMotsCles(db);
  assert.equal(elements.get(motCleDeLaPage).find((e) => e.table === 'page').adresse, '/races/zephyrienne/');
  assert.equal(elements.get(motCleDuSort).find((e) => e.table === 'sort').adresse, '/magies/zephyrie/#sort-zephyr');
  assert.equal(elements.get(motCleDeLaMagie).find((e) => e.table === 'magie').adresse, '/magies/zephyrie/');

  const plan = planDeLAncrage(db);
  const operations = plan.lots.flatMap((l) => l.operations);
  for (const id of [motCleDeLaPage, motCleDuSort]) {
    assert.equal(operations.find((o) => o.table === 'mot_cle' && o.cle.id === id), undefined, `rien à réaligner pour #${id}`);
  }
  assert.notEqual(adresseDeLaPage(page, null), '/races/zephyrienne/', 'sans le segment, l’adresse serait l’ancienne');
  db.close();
});
