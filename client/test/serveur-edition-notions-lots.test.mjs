// Les pages de notion et les lots de changements (docs/chantier-pages-de-notion.md, §3, §4 ; lib/lot-de-changements.mjs, serveur/edition-lots.mjs) : la forme
// `{ table: 'page', operation: 'inserer', ancrage: { notion: true } }` et ses refus ; un lot de pages de notion s'applique ; une ligne annulée emporte sa page, ses
// sources et l'adresse de son mot-clé (R291), le mot-clé reste tel qu'avant ; le lot annulé rend la base d'avant ; une page renommée depuis garde son groupe ;
// un mot-clé verrouillé ou d'une monnaie s'annule sans décision à ouvrir ; un mot-clé créé par le lot part avec sa page ; le journal rejoué donne les mêmes
// lignes. Petite base de test/aide-ancrage.mjs en fichier, noms inventés.
//   node --test test/serveur-edition-notions-lots.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ouvrirBaseVivante } from '../serveur/base-vivante.mjs';
import { appliquerUnLot, ErreurEdition, enregistrer, rejouerLeJournal } from '../serveur/edition.mjs';
import { chargerJournal, journalExporte } from '../serveur/edition-journal.mjs';
import { annuler, annulerUneLigne, decisionsCitees, lire, traduire } from '../serveur/edition-lots.mjs';
import { CORPS_D_UNE_PAGE_DE_NOTION } from '../src/lib/guide.mjs';
import { controlerLeLot } from '../src/lib/lot-de-changements.mjs';
import { adresseDesRegles, idDesRegles, nom, outilsDesCas, refusDuDepot } from './aide-adresses-lots.mjs';
import { idDeCategorie, poserLesCategoriesNouvelles, poserMotCle, poserOnglet, poserPageLisible } from './aide-ancrage.mjs';

const { cas, deposerDirect } = outilsDesCas('edition-notions-lots');
const ONGLET = 'zephyrion-onglet';

/** L'opération d'une page de notion : la page `guide/<nom>` du mot-clé `motCle` (un id, ou un jeton déjà donné). */
const notion = (titre, motCle, id = idDesRegles(titre)) => ({ table: 'page', cle: { id }, operation: 'inserer', apres: { id, titre, mot_cle_id: motCle }, ancrage: { notion: true } });

/** Les catégories nouvelles, l'onglet d'essai et sa page d'ouverture (une page d'onglet : son entrée de menu). */
function poserLeMonde(db) {
  poserLesCategoriesNouvelles(db);
  poserOnglet(db, ONGLET, nom('onglet'));
  const ouverture = poserPageLisible(db, idDesRegles(nom('ouverture')), nom('ouverture'), { resume: 'Résumé d’essai.' });
  db.prepare("INSERT INTO regles_onglet_entree (id, onglet_id, rang, page_id) VALUES (?, ?, 1, ?)").run(`page:${ouverture}`, ONGLET, ouverture);
  db.prepare('UPDATE regles_onglet SET ouverture_page_id = ? WHERE id = ?').run(ouverture, ONGLET);
  return { ouverture };
}

/** Un mot-clé du type Notion, décrit. */
function poserNotion(db, libelle) {
  const id = poserMotCle(db, { libelle, categories: ['Notion'] });
  db.prepare('UPDATE mot_cle SET description = ? WHERE id = ?').run(`Définition d’essai de ${libelle}.`, id);
  return id;
}

/** Les lignes que les pages de notion écrivent. */
const photo = (db) => Object.fromEntries(['page', 'page_source', 'source', 'mot_cle', 'mot_cle_categorie'].map((t) => [t, db.prepare(`SELECT * FROM "${t}" ORDER BY 1, 2`).all().map((l) => ({ ...l }))]));
const page = (m, id) => m.db.prepare('SELECT * FROM page WHERE id = ?').get(id);
const urlDe = (m, k) => m.db.prepare('SELECT url FROM mot_cle WHERE id = ?').get(k)?.url;
/** Le numéro d'une ligne du lot : le rang de sa première écriture au journal. */
const rangDe = (m, lotId, table, cle) => m.db.prepare('SELECT rang, cle FROM modification WHERE lot_id = ? AND table_nom = ? ORDER BY rang').all(lotId, table)
  .find((l) => Object.entries(cle).every(([c, v]) => JSON.parse(l.cle)[c] === v))?.rang;
/** Le journal de `m`, rejoué sur une copie de la base posée (`m.depart`) : aucun conflit, et les mêmes lignes qu'ici dans `tables`. */
function rejoueCommeIci(m, tables) {
  const neuve = ouvrirBaseVivante(m.depart);
  try {
    const exporte = journalExporte(m.db);
    neuve.exec('PRAGMA foreign_keys = OFF');
    neuve.exec('BEGIN');
    chargerJournal(neuve, exporte);
    const bilan = rejouerLeJournal(neuve, {});
    neuve.exec('COMMIT');
    assert.equal(bilan.conflits, 0, JSON.stringify(bilan).slice(0, 2000));
    const [ici, rejoue] = [photo(m.db), photo(neuve)];
    for (const t of tables) assert.deepEqual(rejoue[t], ici[t], t);
  } finally {
    neuve.close();
  }
}
async function applique(m, operations) {
  const p = await deposerDirect(m, operations, { titre: 'Pages de notion d’essai', decision: 'R309' });
  assert.equal(p.etat, 'applique', JSON.stringify(p.refus ?? lire(m.db, p.id).essai?.operations?.filter((o) => o.etat === 'refusee') ?? null));
  return { ...p, lot: lire(m.db, p.id).lot_id };
}

test('format : la page de notion passe, avec un mot-clé donné ou un jeton déjà donné ; `{ notion: true }` est refusé sur une modification, sur une autre table, avec une colonne de plus, sans mot-clé ou hors du guide', () => {
  const structure = (table) => ({
    mot_cle: { colonnes: ['id', 'libelle', 'cle', 'url', 'description'], cle: ['id'], types: { id: 'INTEGER' } },
    page: { colonnes: ['id', 'titre', 'mot_cle_id', 'resume', 'corps_md'], cle: ['id'], types: { id: 'TEXT' } },
    magie: { colonnes: ['id', 'nom', 'mot_cle_id'], cle: ['id'], types: { id: 'TEXT' } },
  })[table] ?? null;
  const fautes = (...operations) => controlerLeLot({ titre: 'Essai', nature: 'decision', decision: 'R309', operations }, { structure }).erreurs.map((e) => e.message);
  const jeton = { $numero: 'k' };
  const creation = { table: 'mot_cle', cle: { id: jeton }, operation: 'inserer', apres: { id: jeton, libelle: nom('X') } };
  assert.deepEqual(fautes(notion(nom('X'), 7)), []);
  assert.deepEqual(fautes(creation, notion(nom('X'), jeton)), []);

  const page = notion(nom('X'), 7);
  const refusees = {
    'une modification': { table: 'page', cle: page.cle, operation: 'modifier', avant: { titre: 'a' }, apres: { titre: 'b' }, ancrage: { notion: true } },
    'une autre table': { table: 'magie', cle: { id: 'x' }, operation: 'inserer', apres: { id: 'x', nom: 'X', mot_cle_id: 7 }, ancrage: { notion: true } },
    'un mot-clé': { ...creation, ancrage: { notion: true } },
    'un résumé': { ...page, apres: { ...page.apres, resume: 'Non.' } },
    'un texte': { ...page, apres: { ...page.apres, corps_md: 'Non.' } },
    'sans mot-clé': { ...page, apres: { id: page.cle.id, titre: nom('X') } },
    'un mot-clé qui n’est pas un id': { ...page, apres: { ...page.apres, mot_cle_id: 'x' } },
    'sans titre': { ...page, apres: { id: page.cle.id, titre: '', mot_cle_id: 7 } },
    'une autre clé d’ancrage': { ...page, ancrage: { notion: true, table: 'page' } },
    'notion faux': { ...page, ancrage: { notion: false } },
    'hors du guide': notion(nom('X'), 7, 'races/zephyrion-x'),
  };
  for (const [quoi, o] of Object.entries(refusees)) assert.match(fautes(o).join(' | '), /ancrage/, quoi);
  assert.ok(fautes(notion(nom('X'), { $numero: 'z' })).length, 'un jeton qu’aucune opération ne donne');
});

test('traduire : la création de la page par le service, puis la vérification de la ligne écrite', () => {
  const t = traduire(notion(nom('X'), 7));
  assert.deepEqual(t.ops, [
    { op: 'creer_page_de_notion', id: idDesRegles(nom('X')), titre: nom('X'), mot_cle_id: 7 },
    { op: 'verifier_ligne', table: 'page', cle: { id: idDesRegles(nom('X')) }, attendu: { id: idDesRegles(nom('X')), titre: nom('X'), resume: null, corps_md: CORPS_D_UNE_PAGE_DE_NOTION, mot_cle_id: 7 } },
  ]);
  assert.match(traduire({ table: 'page', cle: { id: 'guide/x' }, operation: 'inserer', apres: { id: 'guide/x', titre: 'X' } }).refus, /crée lui-même/, 'une page sans ancrage reste refusée');
});

test('trois pages de notion (un mot-clé ordinaire, un verrouillé, un de monnaie) : le lot s’applique ; une ligne annulée emporte sa page, sa source et l’adresse du mot-clé, laisse les deux autres ; celles du mot-clé verrouillé et de la monnaie s’annulent sans décision à ouvrir ; le journal rejoué donne les mêmes lignes ; le lot annulé rend la base d’avant', () => cas(
  (db) => {
    const monde = poserLeMonde(db);
    db.prepare("INSERT INTO famille (id, libelle, ordre) VALUES ('equipement', 'Famille equipement', 2)").run();
    const [un, scelle] = [poserNotion(db, nom('Un')), poserNotion(db, nom('Scelle'))];
    db.prepare('UPDATE mot_cle SET verrou = 1 WHERE id = ?').run(scelle);
    const piece = poserMotCle(db, { libelle: nom('Piece') });
    db.prepare("INSERT INTO monnaie (id, nom, abreviation, valeur_rf, origine, source_ref) VALUES ('zz', ?, 'ZZ', 1, 'equipement', 'essai')").run(nom('Piece'));
    db.prepare("UPDATE mot_cle SET monnaie_id = 'zz' WHERE id = ?").run(piece);
    return { ...monde, motsCles: [un, scelle, piece] };
  },
  async (m) => {
    const { motsCles } = m.monde;
    const titres = ['Un', 'Scelle', 'Piece'].map(nom);
    const depart = photo(m.db);
    const commeAvant = (k) => assert.deepEqual(photo(m.db).mot_cle.find((x) => x.id === k), depart.mot_cle.find((x) => x.id === k), `le mot-clé ${k} tel qu’avant le lot`);
    const p = await applique(m, motsCles.map((k, i) => notion(titres[i], k)));
    const ids = titres.map(idDesRegles);
    for (const [i, id] of ids.entries()) {
      assert.equal(page(m, id).mot_cle_id, motsCles[i]);
      assert.equal(urlDe(m, motsCles[i]), adresseDesRegles(titres[i]));
    }
    // la base avec les pages : le journal rejoué donne les mêmes lignes, la source du jour comprise
    rejoueCommeIci(m, ['page', 'page_source', 'mot_cle', 'source']);

    const n = rangDe(m, p.lot, 'page', { id: ids[0] });
    annulerUneLigne(m.db, p.id, n);
    assert.equal(page(m, ids[0]), undefined);
    assert.equal(m.db.prepare('SELECT count(*) AS n FROM page_source WHERE page_id = ?').get(ids[0]).n, 0);
    commeAvant(motsCles[0]);
    for (const [i, id] of ids.slice(1).entries()) {
      assert.ok(page(m, id), id);
      assert.equal(urlDe(m, motsCles[i + 1]), adresseDesRegles(titres[i + 1]));
    }
    const annulees = lire(m.db, p.id).lignes.filter((l) => l.etat === 'annulee').map((l) => l.n);
    assert.ok(annulees.includes(n) && annulees.length === 3, `la page, sa source et le mot-clé : ${annulees}`);
    // Review Focus 2 : le mot-clé verrouillé, celui de la monnaie ; une décision à ouvrir lèverait un refus « verrouillée par R… »
    for (const [i, id] of ids.slice(1).entries()) {
      annulerUneLigne(m.db, p.id, rangDe(m, p.lot, 'page', { id }));
      assert.equal(page(m, id), undefined);
      commeAvant(motsCles[i + 1]);
    }

    // la base après les annulations ligne à ligne
    rejoueCommeIci(m, ['page', 'page_source', 'mot_cle']);

    annuler(m.db, p.id, {});
    assert.deepEqual(photo(m.db), depart, 'la base d’avant, la source comprise');
  },
));

/** Les opérations du service qu'une opération de lot donne (`traduire`), jouées dans un lot du journal de la base vivante, sans essai : le refus, ou null. */
function jouer(m, o) {
  const { ops, refus } = traduire(o);
  if (refus) return new ErreurEdition(409, refus);
  try {
    appliquerUnLot(m.db, { titre: 'Essai', nature: 'decision', decision: 'R309', travail: (h) => ops.forEach((op) => h.executer(op)) });
    return null;
  } catch (e) {
    if (e instanceof ErreurEdition) return e;
    throw e;
  }
}

test('une page de notion renommée depuis le lot : son groupe reste en place, avec son motif ; un lot qui écrit son mot-clé, son résumé ou son texte par la voie ordinaire garde les verdicts d’aujourd’hui (le mot-clé ne change pas, refus sans numéro ; le résumé et le texte s’écrivent comme ceux d’une page d’onglet)', () => cas(
  (db) => ({ ...poserLeMonde(db), k: poserNotion(db, nom('Brise')), autre: poserNotion(db, nom('Autre')) }),
  async (m) => {
    const { k, autre, ouverture } = m.monde;
    const p = await applique(m, [notion(nom('Brise'), k)]);
    const id = idDesRegles(nom('Brise'));
    const modifier = (pageId, apres) => {
      const avant = page(m, pageId);
      return { table: 'page', cle: { id: pageId }, operation: 'modifier', avant: Object.fromEntries(Object.keys(apres).map((c) => [c, avant[c]])), apres };
    };
    const avant = { ...page(m, id) };
    await refusDuDepot(deposerDirect(m, [modifier(id, { mot_cle_id: autre })]));
    const detache = jouer(m, modifier(id, { mot_cle_id: null }));
    assert.equal(detache?.statut, 409, String(detache));
    assert.deepEqual(decisionsCitees(detache.message), [], detache.message);
    assert.deepEqual({ ...page(m, id) }, avant);

    enregistrer(m.db, { page: 'essai/', operations: [{ op: 'modifier', table: 'page', cle: { id }, valeurs: { titre: nom('Bourrasque') } }] });
    const n = rangDe(m, p.lot, 'page', { id });
    const ligne = lire(m.db, p.id).lignes.find((l) => l.n === n);
    assert.equal(ligne.etat, 'modifiee_depuis');
    assert.match(ligne.motif, /page de notion/);
    const e = (() => {
      try {
        annulerUneLigne(m.db, p.id, n);
      } catch (x) {
        return x;
      }
      return null;
    })();
    assert.ok(e instanceof ErreurEdition && e.statut === 409, String(e));
    assert.equal(page(m, id).titre, nom('Bourrasque'));

    // le résumé et le texte : le même verdict que sur une page d'onglet
    for (const apres of [{ resume: 'Un résumé d’essai.' }, { corps_md: 'Un texte d’essai.\n' }]) {
      const [surLaNotion, surLOnglet] = [jouer(m, modifier(id, apres)), jouer(m, modifier(ouverture, apres))];
      assert.equal(surLaNotion?.statut ?? 'ecrit', surLOnglet?.statut ?? 'ecrit', `${JSON.stringify(apres)} : ${surLaNotion} / ${surLOnglet}`);
    }
  },
));

test('un lot qui crée un mot-clé, sa catégorie et sa page de notion (jeton) s’applique ; sa ligne annulée emporte catégorie et page ; le lot annulé rend la base d’avant', () => cas(
  // un mot-clé déjà là : le numéro que le lot donne (le plus haut connu) est celui que le service prend, au-dessus du registre de la migration 0113
  (db) => ({ ...poserLeMonde(db), voisin: poserNotion(db, nom('Voisin')) }),
  async (m) => {
    const depart = photo(m.db);
    const categorie = idDeCategorie(m.db, 'Notion');
    const jeton = { $numero: 'k' };
    const p = await applique(m, [
      { table: 'mot_cle', cle: { id: jeton }, operation: 'inserer', apres: { id: jeton, libelle: nom('Neuf') } },
      { table: 'mot_cle_categorie', cle: { mot_cle_id: jeton, categorie_id: categorie }, operation: 'inserer', apres: { mot_cle_id: jeton, categorie_id: categorie } },
      notion(nom('Neuf'), jeton),
    ]);
    const k = m.db.prepare('SELECT id FROM mot_cle WHERE libelle = ?').get(nom('Neuf')).id;
    const id = idDesRegles(nom('Neuf'));
    assert.equal(page(m, id).mot_cle_id, k);
    assert.equal(urlDe(m, k), adresseDesRegles(nom('Neuf')));
    annulerUneLigne(m.db, p.id, rangDe(m, p.lot, 'mot_cle', { id: k }));
    assert.equal(page(m, id), undefined);
    assert.equal(urlDe(m, k), undefined, 'le mot-clé créé part');
    assert.equal(m.db.prepare('SELECT count(*) AS n FROM mot_cle_categorie WHERE mot_cle_id = ?').get(k).n, 0);
    annuler(m.db, p.id, {});
    assert.deepEqual(photo(m.db), depart);
  },
));
