// L'annulation d'une ligne d'un renommage qui déplace l'adresse d'une page typée (décision R316, serveur/edition-lots.mjs#lignesEmportees) : la ligne de
// l'élément renommé (un don, un métier) est du groupe de l'adresse de sa page ; annuler n'importe quelle ligne du groupe rend d'un coup le nom, le titre, le
// segment, les anciennes adresses et l'adresse du mot-clé. Petite base de test/aide-ancrage.mjs, noms inventés.
//   node --test test/serveur-edition-adresses-lots-elements.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { annulerUneLigne, lire } from '../serveur/edition-lots.mjs';
import { normalize } from '../src/lib/text.mjs';
import { nom, numerosDe, outilsDesCas, photo, TOUS_LES_VERROUS } from './aide-adresses-lots.mjs';
import { ancrerUnMotCle, poserCapacite, poserClasse, poserMetier } from './aide-ancrage.mjs';

const { cas, deposerDirect } = outilsDesCas('edition-adresses-lots-elements');

/** La photo d'un renommage, plus le nom de l'élément `table`/`id`. */
const photoDe = (db, table, id) => ({ ...photo(db), element: db.prepare(`SELECT nom FROM "${table}" WHERE id = ?`).get(id) });

/** Renomme l'élément `table`/`id` par un lot déposé (nom et clé du nom), vérifie que l'adresse de sa page a bougé, annule la ligne `visee` et compare. */
async function renommerPuisAnnuler(m, { table, id, avant, apres, visee }) {
  const depart = photoDe(m.db, table, id);
  const fait = await deposerDirect(m, [
    { table, cle: { id }, operation: 'modifier', avant: { nom: avant, nom_cle: normalize(avant) }, apres: { nom: apres, nom_cle: normalize(apres) } },
  ], { verrous_ouverts: TOUS_LES_VERROUS }, 'createur');
  assert.equal(fait.etat, 'applique', JSON.stringify(fait.refus ?? null));
  const renomme = photoDe(m.db, table, id);
  assert.notDeepEqual(renomme.pages.find((p) => p.id === id).slug_adresse, depart.pages.find((p) => p.id === id).slug_adresse, 'l’adresse de la page a bougé');
  const lignes = lire(m.db, fait.id).lignes;
  const [numero] = numerosDe(lignes, visee);
  assert.ok(numero, `${visee} : ${JSON.stringify(lignes.map((l) => l.table))}`);
  annulerUneLigne(m.db, fait.id, numero);
  assert.deepEqual(photoDe(m.db, table, id), depart, `${visee} annulée : nom, titre, segment, anciennes adresses et mots-clés d’avant`);
}

test('R316 : annuler la ligne du don renommé (ou celle de sa page) rend aussi le titre, l’adresse, l’ancienne adresse et l’adresse du mot-clé', () => cas(
  (db) => {
    const classe = poserClasse(db, 'classes/zephyrion-mage', nom('Mage'));
    const don = (slug, libelle) => {
      const id = poserCapacite(db, `capacites/zephyrion-mage-${slug}`, { classe, nom: libelle, niveau: 5 });
      return { id, motCle: ancrerUnMotCle(db, 'page', id, { categories: ['Don'] }) };
    };
    return { a: don('zorblat', 'Zorblat'), b: don('quixal', 'Quixal') };
  },
  async (m) => {
    await renommerPuisAnnuler(m, { table: 'capacite', id: m.monde.a.id, avant: 'Zorblat', apres: 'Zorblot', visee: 'capacite' });
    await renommerPuisAnnuler(m, { table: 'capacite', id: m.monde.b.id, avant: 'Quixal', apres: 'Quixol', visee: 'page' });
  },
));

test('R316 : annuler la ligne du métier renommé rend aussi son ancre, son ancienne adresse et l’adresse de son mot-clé', () => cas(
  (db) => {
    const id = poserMetier(db, 'metiers/zephyrion-forgeron', nom('Forgeron'));
    return { id, motCle: ancrerUnMotCle(db, 'page', id, { categories: ['Métier'] }) };
  },
  (m) => renommerPuisAnnuler(m, { table: 'metier', id: m.monde.id, avant: nom('Forgeron'), apres: nom('Ferronnier'), visee: 'metier' }),
));
