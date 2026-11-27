// L'annulation des pages de notion d'un lot de changements (docs/chantier-pages-de-notion.md, §4 ; serveur/edition-lots.mjs, R291), en complément de
// test/serveur-edition-notions-lots.test.mjs : le lot ENTIER annulé aussitôt après son application rend la base d'avant, la source comprise ; la ligne d'une
// page posée sur le mot-clé d'un type de sort s'annule, le lien du type de sort reste et l'adresse du mot-clé redevient vide. Petite base de
// test/aide-ancrage.mjs en fichier, noms inventés.
//   node --test test/serveur-edition-notions-annulation.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { annuler, annulerUneLigne, lire } from '../serveur/edition-lots.mjs';
import { adresseDesRegles, idDesRegles, nom, outilsDesCas } from './aide-adresses-lots.mjs';
import { poserLesCategoriesNouvelles, poserMotCle, poserOnglet, poserPageLisible } from './aide-ancrage.mjs';

const { cas, deposerDirect } = outilsDesCas('edition-notions-annulation');
const ONGLET = 'zephyrion-onglet';

/** L'opération d'une page de notion : la page `guide/<nom>` du mot-clé `motCle`. */
const notion = (titre, motCle, id = idDesRegles(titre)) => ({ table: 'page', cle: { id }, operation: 'inserer', apres: { id, titre, mot_cle_id: motCle }, ancrage: { notion: true } });

/** Les catégories nouvelles, l'onglet d'essai et sa page d'ouverture (une page d'onglet : son entrée de menu). */
function poserLeMonde(db) {
  poserLesCategoriesNouvelles(db);
  poserOnglet(db, ONGLET, nom('onglet'));
  const ouverture = poserPageLisible(db, idDesRegles(nom('ouverture')), nom('ouverture'), { resume: 'Résumé d’essai.' });
  db.prepare('INSERT INTO regles_onglet_entree (id, onglet_id, rang, page_id) VALUES (?, ?, 1, ?)').run(`page:${ouverture}`, ONGLET, ouverture);
  db.prepare('UPDATE regles_onglet SET ouverture_page_id = ? WHERE id = ?').run(ouverture, ONGLET);
}

/** Un mot-clé du type Notion, décrit. */
function poserNotion(db, libelle) {
  const id = poserMotCle(db, { libelle, categories: ['Notion'] });
  db.prepare('UPDATE mot_cle SET description = ? WHERE id = ?').run(`Définition d’essai de ${libelle}.`, id);
  return id;
}

/** Le mot-clé du type de sort 'attaque', sans adresse. */
function poserTypeDeSort(db, libelle) {
  const id = poserMotCle(db, { libelle, categories: ['Type de sort'] });
  db.prepare("UPDATE type_sort SET mot_cle_id = ? WHERE id = 'attaque'").run(id);
  return id;
}

/** Les lignes que les pages de notion écrivent. */
const photo = (db) => Object.fromEntries(['page', 'page_source', 'source', 'mot_cle', 'mot_cle_categorie'].map((t) => [t, db.prepare(`SELECT * FROM "${t}" ORDER BY 1, 2`).all().map((l) => ({ ...l }))]));
const page = (m, id) => m.db.prepare('SELECT * FROM page WHERE id = ?').get(id);
const urlDe = (m, k) => m.db.prepare('SELECT url FROM mot_cle WHERE id = ?').get(k)?.url;
const typeDeSort = (m) => m.db.prepare("SELECT mot_cle_id AS k FROM type_sort WHERE id = 'attaque'").get().k;
/** Le numéro d'une ligne du lot : le rang de sa première écriture au journal. */
const rangDe = (m, lotId, table, cle) => m.db.prepare('SELECT rang, cle FROM modification WHERE lot_id = ? AND table_nom = ? ORDER BY rang').all(lotId, table)
  .find((l) => Object.entries(cle).every(([c, v]) => JSON.parse(l.cle)[c] === v))?.rang;
async function applique(m, operations) {
  const p = await deposerDirect(m, operations, { titre: 'Pages de notion d’essai', decision: 'R309' });
  assert.equal(p.etat, 'applique', JSON.stringify(p.refus ?? lire(m.db, p.id).essai?.operations?.filter((o) => o.etat === 'refusee') ?? null));
  return { ...p, lot: lire(m.db, p.id).lot_id };
}

test('le lot entier annulé aussitôt après son application (un mot-clé ordinaire, un verrouillé, celui d’un type de sort) : la base d’avant, la source comprise', () => cas(
  (db) => {
    poserLeMonde(db);
    const [un, scelle] = [poserNotion(db, nom('Un')), poserNotion(db, nom('Scelle'))];
    db.prepare('UPDATE mot_cle SET verrou = 1 WHERE id = ?').run(scelle);
    return { motsCles: [un, scelle, poserTypeDeSort(db, nom('Rituel'))] };
  },
  async (m) => {
    const { motsCles } = m.monde;
    const titres = ['Un', 'Scelle', 'Rituel'].map(nom);
    const depart = photo(m.db);
    const p = await applique(m, motsCles.map((k, i) => notion(titres[i], k)));
    for (const [i, k] of motsCles.entries()) assert.equal(urlDe(m, k), adresseDesRegles(titres[i]), titres[i]);
    annuler(m.db, p.id, {});
    assert.deepEqual(photo(m.db), depart, 'la base d’avant, la source comprise');
    assert.equal(typeDeSort(m), motsCles[2], 'le lien du type de sort');
  },
));

test('la ligne d’une page posée sur le mot-clé d’un type de sort s’annule : la page et sa source partent, le lien du type de sort reste, l’adresse du mot-clé redevient vide', () => cas(
  (db) => {
    poserLeMonde(db);
    return { k: poserTypeDeSort(db, nom('Rituel')) };
  },
  async (m) => {
    const { k } = m.monde;
    const avant = photo(m.db).mot_cle.find((x) => x.id === k);
    assert.equal(avant.url, null);
    const p = await applique(m, [notion(nom('Rituel'), k)]);
    const id = idDesRegles(nom('Rituel'));
    assert.equal(page(m, id).mot_cle_id, k);
    assert.equal(urlDe(m, k), adresseDesRegles(nom('Rituel')));
    annulerUneLigne(m.db, p.id, rangDe(m, p.lot, 'page', { id }));
    assert.equal(page(m, id), undefined);
    assert.equal(m.db.prepare('SELECT count(*) AS n FROM page_source WHERE page_id = ?').get(id).n, 0);
    assert.equal(urlDe(m, k), null);
    assert.equal(typeDeSort(m), k, 'le lien du type de sort');
    assert.deepEqual(photo(m.db).mot_cle.find((x) => x.id === k), avant, 'le mot-clé tel qu’avant le lot');
    assert.equal(lire(m.db, p.id).lignes.filter((l) => l.etat === 'annulee').length, 3, 'la page, sa source et le mot-clé');
  },
));
