// Les pages de notion (docs/chantier-pages-de-notion.md, §1, §3, §4 ; serveur/edition-notions.mjs) : la page d'un mot-clé existant (`creer_page_de_notion`) et la
// notion nouvelle (créée par une route du site, `voie: 'route'`) ; leurs refus, sans numéro de décision et sans rien écrire ; l'identifiant suffixé ; le mot-clé
// verrouillé par sa page ; le résumé facultatif ; la suppression (décision 16 du chantier) ; le bloc `notion`, qui ne protège pas la page. Petite base de
// test/aide-ancrage.mjs en fichier, noms inventés ; chaque cas vérifie aussi que les contrôles du contenu n'y trouvent rien de plus qu'avant.
//   node --test test/serveur-edition-notions.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { appliquerUnLot, enregistrer, ErreurEdition, NOTIONS } from '../serveur/edition.mjs';
import { decisionsCitees } from '../serveur/edition-lots.mjs';
import { CORPS_D_UNE_PAGE_DE_NOTION } from '../src/lib/guide.mjs';
import { clesDesMotsCles } from '../src/lib/mots-cles-cles.mjs';
import { categoriesDesMotsCles, motsClesDeLaBase } from '../src/lib/mots-cles-db.mjs';
import { raisonsDeProtection } from '../src/lib/pages-protegees.mjs';
import { normalize } from '../src/lib/text.mjs';
import { adresseDesRegles, idDesRegles, nom, outilsDesCas } from './aide-adresses-lots.mjs';
import { ancrerUnMotCle, idDeCategorie, poserLesCategoriesNouvelles, poserMagie, poserMotCle, poserOnglet, poserPageLisible, poserSort } from './aide-ancrage.mjs';

const { cas } = outilsDesCas('edition-notions');
const ONGLET = 'zephyrion-onglet';

/** Une page d'onglet : son entrée de menu dans l'onglet d'essai. */
function poserPageDOnglet(db, titre) {
  const id = poserPageLisible(db, idDesRegles(titre), titre, { resume: 'Résumé d’essai.' });
  db.prepare('INSERT INTO regles_onglet_entree (id, onglet_id, rang, page_id) VALUES (?, ?, (SELECT coalesce(max(rang), 0) + 1 FROM regles_onglet_entree), ?)').run(`page:${id}`, ONGLET, id);
  return id;
}

/** Les catégories nouvelles, l'onglet d'essai et sa page d'ouverture. */
function poserLeMonde(db) {
  poserLesCategoriesNouvelles(db);
  poserOnglet(db, ONGLET, nom('onglet'));
  const ouverture = poserPageDOnglet(db, nom('ouverture'));
  db.prepare('UPDATE regles_onglet SET ouverture_page_id = ? WHERE id = ?').run(ouverture, ONGLET);
  return { ouverture };
}

/** Un mot-clé du type Notion, décrit, coloré, avec une icône (et ses synonymes). */
function poserNotion(db, libelle, { synonymes = [] } = {}) {
  const id = poserMotCle(db, { libelle, categories: ['Notion'], synonymes });
  db.prepare("UPDATE mot_cle SET description = ?, couleur = '#336699', icone = 'monnaie:rf' WHERE id = ?").run(`Définition d’essai de ${libelle}.`, id);
  return id;
}

/** Le mot-clé `type_sort` 'attaque' (un mot-clé gardé par un autre élément, R289). */
function poserTypeDeSort(db, libelle) {
  const id = poserMotCle(db, { libelle, categories: ['Type de sort'] });
  db.prepare("UPDATE type_sort SET mot_cle_id = ? WHERE id = 'attaque'").run(id);
  return id;
}

/** `op` jouée dans un lot du journal (edition.mjs#appliquerUnLot), sous le gel : ce qu'elle rend. */
const parUnLot = (m, op) => appliquerUnLot(m.db, { titre: 'Notion d’essai', nature: 'decision', decision: 'R309', travail: (h) => h.executer(op) }).resultat;
const pageDe = (m, motCle, plus = {}) => parUnLot(m, { op: 'creer_page_de_notion', mot_cle_id: motCle, ...plus });
const ecrire = (m, ...operations) => enregistrer(m.db, { page: 'essai/', operations });
/** La création d'un mot-clé par une route du site (`voie: 'route'`, que seules donnent serveur/api.mjs et serveur/ressources.mjs) : la notion et sa page. */
const parLaRoute = (m, valeurs) => enregistrer(m.db, { page: 'essai/', operations: [{ op: 'creer', entite: 'mot_cle', valeurs }] }, { voie: 'route' });

const motCle = (m, id) => m.db.prepare('SELECT id, libelle, cle, description, couleur, icone, url, verrou, monnaie_id FROM mot_cle WHERE id = ?').get(id);
const ligneDe = (m, id) => (motCle(m, id) ? { ...motCle(m, id) } : null);
const categories = (m, id) => m.db.prepare('SELECT categorie_id AS c FROM mot_cle_categorie WHERE mot_cle_id = ? ORDER BY c').all(id).map((l) => l.c);
const synonymes = (m, id) => m.db.prepare('SELECT libelle FROM mot_cle_synonyme WHERE mot_cle_id = ? ORDER BY ordre').all(id).map((l) => l.libelle);
const page = (m, id) => m.db.prepare('SELECT * FROM page WHERE id = ?').get(id);
const journal = (m) => m.db.prepare('SELECT count(*) AS n FROM modification').get().n;
/** La clé que la règle donne au mot-clé `id` (R232). */
const cleDeLaRegle = (m, id) => clesDesMotsCles(motsClesDeLaBase(m.db), new Map(categoriesDesMotsCles(m.db).map((c) => [c.id, c.libelle]))).get(id);

/** Le refus (ErreurEdition) de `faire`, rien d'écrit au journal ; `sansNumero` : son message ne cite aucune décision. */
function refus(m, faire, { sansNumero = true } = {}) {
  const avant = journal(m);
  let e = null;
  try {
    faire();
  } catch (x) {
    e = x;
  }
  assert.ok(e instanceof ErreurEdition, `refus attendu : ${e}`);
  if (sansNumero) assert.deepEqual(decisionsCitees(e.message), [], e.message);
  assert.equal(journal(m), avant, `rien d’écrit (${e.message})`);
  return e;
}

test('la page d’un mot-clé existant : son nom pour titre, ni résumé ni entrée de menu, le bloc pour texte, une source ; le mot-clé garde tout, son adresse devient celle de la page', () => cas(
  (db) => ({ ...poserLeMonde(db), k: poserNotion(db, nom('Brume'), { synonymes: [nom('Brumes')] }) }),
  (m) => {
    const { k, ouverture } = m.monde;
    const avant = { ...ligneDe(m, k), categories: categories(m, k), synonymes: synonymes(m, k) };
    assert.equal(avant.url, null);
    const entrees = m.db.prepare('SELECT count(*) AS n FROM regles_onglet_entree').get().n;
    const id = pageDe(m, k);
    assert.equal(id, idDesRegles(nom('Brume')));
    const p = page(m, id);
    assert.deepEqual([p.type, p.titre, p.resume, p.corps_md, p.statut, p.mot_cle_id], ['guide', nom('Brume'), null, CORPS_D_UNE_PAGE_DE_NOTION, 'draft', k]);
    assert.equal(m.db.prepare('SELECT count(*) AS n FROM page_source WHERE page_id = ?').get(id).n, 1, 'une source');
    assert.equal(m.db.prepare('SELECT count(*) AS n FROM regles_onglet_entree').get().n, entrees, 'aucune entrée de menu');
    const apres = { ...ligneDe(m, k), categories: categories(m, k), synonymes: synonymes(m, k) };
    assert.equal(apres.url, adresseDesRegles(nom('Brume')));
    assert.deepEqual({ ...apres, url: null }, avant, 'numéro, clé, définition, couleur, icône, catégories et synonymes d’avant');
    assert.equal(NOTIONS.estUnePageDeNotion(m.db, id), true);
    assert.equal(NOTIONS.estUnePageDeNotion(m.db, ouverture), false, 'une page d’onglet');
  },
));

test('le mot-clé d’un type de sort, d’un type de dégâts, d’une monnaie, ou verrouillé : sa page se crée sous le gel, sans refus, et son lien d’origine ne bouge pas', () => cas(
  (db) => {
    const monde = poserLeMonde(db);
    db.prepare("INSERT INTO famille (id, libelle, ordre) VALUES ('equipement', 'Famille equipement', 2)").run();
    const sort = poserTypeDeSort(db, nom('Rituel'));
    const degats = poserMotCle(db, { libelle: nom('Entaille'), categories: ['Dégâts'] });
    db.prepare("INSERT INTO type_degats (id, mot_cle_id, magie_id) VALUES ('taille', ?, NULL)").run(degats);
    const piece = poserMotCle(db, { libelle: nom('Piece') });
    db.prepare("INSERT INTO monnaie (id, nom, abreviation, valeur_rf, origine, source_ref) VALUES ('zz', ?, 'ZZ', 1, 'equipement', 'essai')").run(nom('Piece'));
    db.prepare("UPDATE mot_cle SET monnaie_id = 'zz' WHERE id = ?").run(piece);
    const scelle = poserNotion(db, nom('Scelle'));
    db.prepare('UPDATE mot_cle SET verrou = 1 WHERE id = ?').run(scelle);
    return { ...monde, sort, degats, piece, scelle };
  },
  (m) => {
    const { sort, degats, piece, scelle } = m.monde;
    const liens = () => ({
      sort: m.db.prepare("SELECT mot_cle_id AS k FROM type_sort WHERE id = 'attaque'").get().k,
      degats: m.db.prepare("SELECT mot_cle_id AS k FROM type_degats WHERE id = 'taille'").get().k,
      piece: m.db.prepare('SELECT monnaie_id AS x FROM mot_cle WHERE id = ?').get(piece).x,
    });
    const avant = liens();
    for (const k of [sort, degats, piece, scelle]) {
      const id = pageDe(m, k);
      assert.equal(page(m, id).mot_cle_id, k, id);
      assert.equal(motCle(m, k).url, adresseDesRegles(motCle(m, k).libelle), id);
    }
    assert.deepEqual(liens(), avant);
    assert.equal(motCle(m, scelle).verrou, 1);
  },
));

test('refus, sans numéro de décision et sans rien écrire : mot-clé inconnu, nom sans lettre ni chiffre, nom d’une autre page (titre, adresse, alias), mot-clé qui désigne déjà une page, titre ou identifiant autres que les siens', () => cas(
  (db) => {
    const monde = poserLeMonde(db);
    poserPageLisible(db, idDesRegles(nom('Cendre')), nom('Cendre'));
    poserPageLisible(db, 'guide/zephyrion-flamme', nom('Autre titre'));
    const givre = poserPageLisible(db, idDesRegles(nom('Givre ancien')), nom('Givre ancien'));
    db.prepare('INSERT INTO alias (page_id, ordre, texte, cle) VALUES (?, 0, ?, ?)').run(givre, nom('Givre'), normalize(nom('Givre')));
    const ancree = ancrerUnMotCle(db, 'page', poserPageDOnglet(db, nom('Ancree')), { categories: ['Règles'] });
    return {
      ...monde, ancree, titre: poserNotion(db, nom('Cendre')), slug: poserNotion(db, nom('Flamme')), alias: poserNotion(db, nom('Givre')), libre: poserNotion(db, nom('Libre')),
    };
  },
  (m) => {
    const { ancree, titre, slug, alias, libre } = m.monde;
    assert.equal(refus(m, () => pageDe(m, 999999)).statut, 404);
    for (const k of [titre, slug, alias]) {
      const e = refus(m, () => pageDe(m, k));
      assert.equal(e.statut, 409, e.message);
      assert.match(e.message, /guide\//, 'le message nomme la page');
    }
    assert.equal(refus(m, () => pageDe(m, ancree)).statut, 409);
    assert.equal(refus(m, () => pageDe(m, libre, { titre: nom('Autre') })).statut, 409, 'un titre autre que son nom');
    assert.equal(refus(m, () => pageDe(m, libre, { id: 'guide/zephyrion-autre' })).statut, 409, 'un identifiant qui n’est pas tiré de son nom');
    // un nom sans lettre ni chiffre (que la création d'un mot-clé refuse) : posé à la main le temps de l'essai
    const libelle = motCle(m, libre).libelle;
    m.db.prepare("UPDATE mot_cle SET libelle = '« ? »' WHERE id = ?").run(libre);
    assert.equal(refus(m, () => pageDe(m, libre)).statut, 409);
    m.db.prepare('UPDATE mot_cle SET libelle = ? WHERE id = ?').run(libelle, libre);
    assert.equal(page(m, idDesRegles(nom('Libre'))), undefined);
  },
));

test('refus, sans numéro de décision et sans rien écrire : un mot-clé qui mène déjà à une adresse, celui d’un sort, celui d’une magie ; le lien d’origine et l’adresse ne bougent pas', () => cas(
  (db) => {
    const monde = poserLeMonde(db);
    const adresse = poserNotion(db, nom('Ailleurs'));
    db.prepare("UPDATE mot_cle SET url = '/regles/zephyrion-autre-page/' WHERE id = ?").run(adresse);
    // le sort et la magie : leur mot-clé sans adresse, pour que le refus vienne du lien et non de l'adresse
    const duSort = poserMotCle(db, { libelle: nom('Eclair'), categories: ['Notion'] });
    poserMagie(db, 'zephyrion-magie', nom('Magie'));
    const sort = poserSort(db, 'zephyrion-magie', nom('Eclair'));
    db.prepare('UPDATE sort SET mot_cle_id = ? WHERE id = ?').run(duSort, sort);
    const deLaMagie = poserMotCle(db, { libelle: nom('Arcane'), categories: ['Notion'] });
    poserMagie(db, 'zephyrion-arcane', nom('Arcane'), { mot_cle_id: deLaMagie });
    return { ...monde, adresse, duSort, sort, deLaMagie };
  },
  (m) => {
    const { adresse, duSort, sort, deLaMagie } = m.monde;
    const liens = () => ({
      sort: m.db.prepare('SELECT mot_cle_id AS k FROM sort WHERE id = ?').get(sort).k,
      magie: m.db.prepare("SELECT mot_cle_id AS k FROM magie WHERE id = 'zephyrion-arcane'").get().k,
      urls: [adresse, duSort, deLaMagie].map((k) => motCle(m, k).url),
    });
    const avant = liens();
    for (const [k, detail] of [[adresse, 'url'], [duSort, 'sort'], [deLaMagie, 'magie']]) {
      const e = refus(m, () => pageDe(m, k));
      assert.equal(e.statut, 409, e.message);
      assert.ok(e.details?.[detail], `${detail} : ${JSON.stringify(e.details)}`);
      assert.equal(page(m, idDesRegles(motCle(m, k).libelle)), undefined, detail);
    }
    assert.deepEqual(liens(), avant);
  },
));

test('identifiant : guide/<nom>, suffixé -2 quand il est déjà employé (page supprimée du journal, nom réservé, onglet) ; un identifiant donné déjà pris : 409', () => cas(
  (db) => ({ ...poserLeMonde(db), reserve: poserNotion(db, 'Glossaire'), onglet: poserNotion(db, nom('onglet')), sort: poserTypeDeSort(db, nom('Ancienne')), libre: poserNotion(db, nom('Libre')) }),
  (m) => {
    const { reserve, onglet, sort, libre } = m.monde;
    assert.equal(NOTIONS.idDeNotion(m.db, nom('Libre')), idDesRegles(nom('Libre')));
    assert.equal(NOTIONS.idDeNotion(m.db, nom('Libre'), { pris: new Set([idDesRegles(nom('Libre'))]) }), `${idDesRegles(nom('Libre'))}-2`);
    assert.equal(NOTIONS.idDeNotion(m.db, '« ? »'), null);
    assert.equal(refus(m, () => pageDe(m, reserve, { id: 'guide/glossaire' })).statut, 409, 'un identifiant donné, réservé');
    for (const suffixe of ['-0', '-1', '-02']) {
      assert.equal(refus(m, () => pageDe(m, libre, { id: `${idDesRegles(nom('Libre'))}${suffixe}` })).statut, 409, `le suffixe ${suffixe}`);
    }
    assert.equal(pageDe(m, reserve), 'guide/glossaire-2');
    assert.equal(pageDe(m, onglet), `guide/${ONGLET}-2`);
    // une page supprimée : son identifiant reste employé par le journal
    const premiere = pageDe(m, sort);
    assert.equal(premiere, idDesRegles(nom('Ancienne')));
    ecrire(m, { op: 'supprimer', entite: 'page_des_regles', cle: { id: premiere } });
    assert.equal(page(m, premiere), undefined);
    assert.equal(pageDe(m, sort, { id: `${premiere}-2` }), `${premiere}-2`, 'l’identifiant donné, suffixé');
    assert.equal(refus(m, () => pageDe(m, libre, { id: `${premiere}-2` })).statut, 409, 'pris, et pas tiré de son nom');
  },
));

test('notion nouvelle : le mot-clé (type et définition donnés), sa page et l’ancre dans le même lot du journal ; un homonyme d’un autre type passe ; un nom que la règle refuse : 409, ni page ni mot-clé', () => cas(
  (db) => ({ ...poserLeMonde(db), regle: poserMotCle(db, { libelle: nom('Ecume'), categories: ['Règles'] }), houle: poserMotCle(db, { libelle: nom('Houle'), categories: ['Notion'], synonymes: [nom('Vague')] }) }),
  (m) => {
    const notion = idDeCategorie(m.db, 'Notion');
    const lots = () => m.db.prepare('SELECT count(DISTINCT lot_id) AS n FROM modification').get().n;
    const avant = lots();
    const cree = parLaRoute(m, { libelle: nom('Embrun'), categories: [notion], description: 'Définition d’essai.' });
    assert.equal(lots(), avant + 1, 'un seul lot du journal');
    const idCree = cree.crees[0].id;
    const k = motCle(m, idCree);
    assert.deepEqual([k.libelle, k.description, k.url, k.verrou], [nom('Embrun'), 'Définition d’essai.', adresseDesRegles(nom('Embrun')), 0]);
    assert.equal(k.cle, cleDeLaRegle(m, idCree));
    assert.deepEqual(categories(m, idCree), [notion]);
    const p = m.db.prepare('SELECT * FROM page WHERE mot_cle_id = ?').get(idCree);
    assert.deepEqual([p.id, p.titre, p.resume, p.corps_md], [idDesRegles(nom('Embrun')), nom('Embrun'), null, CORPS_D_UNE_PAGE_DE_NOTION]);

    // l'homonyme d'un mot-clé d'un autre type : les deux clés suivent la règle
    const homonyme = parLaRoute(m, { libelle: nom('Ecume'), categories: [notion] }).crees[0].id;
    assert.equal(m.db.prepare('SELECT id FROM page WHERE mot_cle_id = ?').get(homonyme).id, idDesRegles(nom('Ecume')));
    for (const id of [homonyme, m.monde.regle]) assert.equal(motCle(m, id).cle, cleDeLaRegle(m, id));
    assert.notEqual(motCle(m, homonyme).cle, motCle(m, m.monde.regle).cle);

    // le synonyme d'un autre mot-clé : refusé, ni page ni mot-clé
    const e = refus(m, () => parLaRoute(m, { libelle: nom('Vague'), categories: [notion] }));
    assert.equal(e.statut, 409, e.message);
    assert.equal(page(m, idDesRegles(nom('Vague'))), undefined);
    assert.equal(m.db.prepare('SELECT id FROM mot_cle WHERE libelle = ?').get(nom('Vague')), undefined);
    // le nom d'une page : refusé de même
    assert.equal(refus(m, () => parLaRoute(m, { libelle: nom('ouverture'), categories: [notion] })).statut, 409);
  },
));

test('après la création : le nom et la définition du mot-clé ne se modifient plus par une route (409) ; renommer la page renomme le mot-clé, sa clé et son adresse', () => cas(
  (db) => ({ ...poserLeMonde(db), k: poserNotion(db, nom('Brise')) }),
  (m) => {
    const { k } = m.monde;
    const id = pageDe(m, k);
    for (const valeurs of [{ libelle: nom('Autre') }, { description: 'Autre définition.' }]) {
      assert.equal(refus(m, () => ecrire(m, { op: 'modifier', table: 'mot_cle', cle: { id: k }, valeurs })).statut, 409, JSON.stringify(valeurs));
    }
    const avant = motCle(m, k).cle;
    ecrire(m, { op: 'modifier', table: 'page', cle: { id }, valeurs: { titre: nom('Bourrasque') } });
    const apres = motCle(m, k);
    assert.equal(apres.libelle, nom('Bourrasque'));
    assert.equal(apres.cle, cleDeLaRegle(m, k));
    assert.notEqual(apres.cle, avant);
    assert.equal(apres.url, adresseDesRegles(nom('Bourrasque')));
  },
));

test('résumé : vidé sur une page de notion, accepté (NULL) ; vidé sur une page d’onglet, refusé (400)', () => cas(
  (db) => ({ ...poserLeMonde(db), k: poserNotion(db, nom('Rosee')) }),
  (m) => {
    const id = pageDe(m, m.monde.k);
    const resume = (pageId, valeur) => ecrire(m, { op: 'modifier', table: 'page', cle: { id: pageId }, valeurs: { resume: valeur } });
    resume(id, 'Un résumé d’essai.');
    assert.equal(page(m, id).resume, 'Un résumé d’essai.');
    resume(id, '');
    assert.equal(page(m, id).resume, null);
    assert.equal(refus(m, () => resume(m.monde.ouverture, '')).statut, 400);
  },
));

test('suppression (décision 16) : refusée quand un texte cite le mot-clé (409, citations) ou qu’il est verrouillé ; sinon la page et le mot-clé partent ; le mot-clé d’un type de sort reste, sans adresse ; une page hors plan d’exemple ou de Découvrir : 400', () => cas(
  (db) => {
    const monde = poserLeMonde(db);
    const exemple = poserPageLisible(db, 'guide/zephyrion-exemple', nom('Exemple'));
    db.prepare("UPDATE page SET statut = 'example' WHERE id = ?").run(exemple);
    const scelle = poserNotion(db, nom('Scelle'));
    db.prepare('UPDATE mot_cle SET verrou = 1 WHERE id = ?').run(scelle);
    return {
      ...monde, exemple, scelle, decouvrir: poserPageLisible(db, 'guide/bienvenue', nom('Accueil')), lecteur: poserPageDOnglet(db, nom('Lecteur')),
      cite: poserNotion(db, nom('Cite')), seul: poserNotion(db, nom('Seul')), sort: poserTypeDeSort(db, nom('Rituel')),
    };
  },
  (m) => {
    const { exemple, scelle, decouvrir, lecteur, cite, seul, sort } = m.monde;
    const [pCite, pScelle, pSeul, pSort] = [cite, scelle, seul, sort].map((k) => pageDe(m, k));
    const supprimer = (id) => ecrire(m, { op: 'supprimer', entite: 'page_des_regles', cle: { id } });
    const corps = page(m, lecteur).corps_md;
    ecrire(m, { op: 'modifier', table: 'page', cle: { id: lecteur }, valeurs: { corps_md: `${corps}Il cite {{${motCle(m, cite).cle}}}.\n` } });
    const citee = refus(m, () => supprimer(pCite));
    assert.equal(citee.statut, 409);
    assert.ok(citee.details?.citations?.length, JSON.stringify(citee.details));
    ecrire(m, { op: 'modifier', table: 'page', cle: { id: lecteur }, valeurs: { corps_md: corps } });
    // le verrou : le refus existant (le mot-clé verrouillé qui y mène), sans numéro écrit par ce chantier
    assert.equal(refus(m, () => supprimer(pScelle), { sansNumero: false }).statut, 409);
    assert.ok(page(m, pScelle));

    supprimer(pSeul);
    assert.equal(page(m, pSeul), undefined);
    assert.equal(motCle(m, seul), undefined, 'son mot-clé part avec elle');
    supprimer(pSort);
    assert.equal(page(m, pSort), undefined);
    assert.equal(motCle(m, sort).url, null, 'gardé par le type de sort, son adresse se vide');
    assert.equal(m.db.prepare("SELECT mot_cle_id AS k FROM type_sort WHERE id = 'attaque'").get().k, sort);
    supprimer(pCite);
    assert.equal(page(m, pCite), undefined);

    assert.equal(refus(m, () => supprimer(exemple)).statut, 400, 'une page hors plan d’exemple');
    assert.equal(refus(m, () => supprimer(decouvrir)).statut, 400, 'une page de Découvrir');
  },
));

test('le bloc `notion` ne protège pas la page ; un second bloc la protège', () => cas(
  (db) => ({ ...poserLeMonde(db), k: poserNotion(db, nom('Halo')) }),
  (m) => {
    const id = pageDe(m, m.monde.k);
    assert.deepEqual(raisonsDeProtection(m.db, id), []);
    m.db.prepare('UPDATE page SET corps_md = ? WHERE id = ?').run(`${CORPS_D_UNE_PAGE_DE_NOTION}\n<!-- guide:initiative -->\n`, id);
    assert.ok(raisonsDeProtection(m.db, id).some((r) => r.raison === 'bloc' && r.bloc === 'initiative'), JSON.stringify(raisonsDeProtection(m.db, id)));
    m.db.prepare('UPDATE page SET corps_md = ? WHERE id = ?').run(CORPS_D_UNE_PAGE_DE_NOTION, id);
  },
));
