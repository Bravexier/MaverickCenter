// Une catégorie-type renommée au Glossaire (permis : docs/chantier-ancrage-mots-cles.md, §7) reste la catégorie de sa rubrique, de « Sort » et de « Type de sort » : le service et
// le plan de l'ancrage la retrouvent par la trace de son renommage (lib/mots-cles-ancrage.mjs#categorieDuType), sans id écrit en dur. Sur le contenu du dépôt ou un contenu ancré.
//   node --test test/serveur-edition-ancrage-categories.test.mjs
import assert from 'node:assert/strict';
import { copyFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { ouvrirBaseVivante, preparerBaseVivante } from '../serveur/base-vivante.mjs';
import { enregistrer } from '../serveur/edition.mjs';
import { estUnePageDeNotion } from '../serveur/edition-notions.mjs';
import { cheminBase } from '../src/lib/donnees.mjs';
import { CATEGORIES_NOUVELLES, categorieDuType, planDeLAncrage, TYPE_DE_RUBRIQUE } from '../src/lib/mots-cles-ancrage.mjs';
import { elementDuMotCle, lireUnMotCle } from '../src/lib/mots-cles-db.mjs';
import { normalize } from '../src/lib/text.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';

const racine = dossierTemporaire('ancrage-categories');
let n = 0;
let modele = null;
/** Une copie de la base vivante, préparée une fois. */
function base() {
  modele ??= preparerBaseVivante({ regles: cheminBase({ sansExemples: false }), dossier: join(racine, 'modele') }).chemin;
  const dossier = join(racine, `b${(n += 1)}`);
  mkdirSync(dossier, { recursive: true });
  const chemin = join(dossier, 'vivante.db');
  copyFileSync(modele, chemin);
  return ouvrirBaseVivante(chemin);
}
const ecrire = (db, operations) => enregistrer(db, { page: 'regles/glossaire/', operations });
/** L'id de la catégorie de ce type ; posée dans la copie si le contenu ne l'a pas encore (les nouvelles de l'ancrage). */
function assurer(db, libelle) {
  const id = categorieDuType(db, libelle);
  if (id !== null) return id;
  const suivant = db.prepare('SELECT coalesce(max(id), 0) + 1 AS n FROM categorie_mot_cle').get().n;
  db.prepare('INSERT INTO categorie_mot_cle (id, libelle, libelle_cle) VALUES (?, ?, ?)').run(suivant, libelle, normalize(libelle));
  return suivant;
}
/** Renomme la catégorie par le service (le journal garde le nom quitté) et rend son nouveau libellé. */
function renommer(db, id) {
  const { libelle } = db.prepare('SELECT libelle FROM categorie_mot_cle WHERE id = ?').get(id);
  const nouveau = `${libelle} renommée ${process.pid}`;
  ecrire(db, [{ op: 'modifier', table: 'categorie_mot_cle', cle: { id }, valeurs: { libelle: nouveau } }]);
  assert.equal(db.prepare('SELECT libelle FROM categorie_mot_cle WHERE id = ?').get(id).libelle, nouveau);
  return nouveau;
}
const categoriesDe = (db, motCle) => db.prepare('SELECT categorie_id AS c FROM mot_cle_categorie WHERE mot_cle_id = ?').all(motCle).map((l) => l.c);
const ancreDe = (db, page) => db.prepare('SELECT mot_cle_id AS m FROM page WHERE id = ?').get(page).m;

test('la catégorie « Métier » renommée : un métier créé sur le site a son mot-clé dans la catégorie renommée', () => {
  const db = base();
  try {
    const metier = assurer(db, TYPE_DE_RUBRIQUE.metiers);
    renommer(db, metier);
    assert.equal(categorieDuType(db, TYPE_DE_RUBRIQUE.metiers), metier, 'retrouvée sous le nom qu’elle a quitté');
    const page = ecrire(db, [{ op: 'creer', entite: 'metier', valeurs: { nom: `Zephyrion métier ${process.pid}` } }]).crees[0].id;
    assert.notEqual(ancreDe(db, page), null, 'la page a son mot-clé');
    assert.deepEqual(categoriesDe(db, ancreDe(db, page)), [metier]);
  } finally {
    db.close();
  }
});

test('la catégorie « Guide » renommée : le plan ne la recrée pas, une page de guide créée va dans la catégorie renommée', () => {
  const db = base();
  try {
    const guide = assurer(db, TYPE_DE_RUBRIQUE.guide);
    renommer(db, guide);
    const recreees = planDeLAncrage(db).lots.flatMap((l) => l.operations).filter((o) => o.table === 'categorie_mot_cle' && o.operation === 'inserer').map((o) => normalize(o.apres.libelle));
    assert.ok(!recreees.includes(normalize(TYPE_DE_RUBRIQUE.guide)), recreees.join());
    const page = ecrire(db, [{ op: 'creer', entite: 'page_des_regles', valeurs: { titre: `Zephyrion guide ${process.pid}`, onglet_id: 'combats', resume: 'Essai.' } }]).crees[0].id;
    assert.deepEqual(categoriesDe(db, ancreDe(db, page)), [guide]);
  } finally {
    db.close();
  }
});

test('« Sort » et « Type de sort » renommées : le plan ne les recrée pas et y range les mots-clés qu’il crée', () => {
  const db = base();
  try {
    for (const libelle of CATEGORIES_NOUVELLES) assurer(db, libelle);
    const sort = assurer(db, 'Sort');
    const type = assurer(db, 'Type de sort');
    // deux éléments sans ancre : le plan doit leur créer un mot-clé
    const element = db.prepare('SELECT id FROM sort ORDER BY id LIMIT 1').get().id;
    const code = db.prepare('SELECT type AS id FROM sort_type ORDER BY type LIMIT 1').get().id;
    for (const [table, id] of [['sort', element], ['type_sort', code]]) {
      // sur un contenu ancré : l'ancre retirée, et son ancien mot-clé sous un autre nom (sinon, même nom et même type : à trancher)
      const ancien = db.prepare(`SELECT mot_cle_id AS m FROM "${table}" WHERE id = ?`).get(id).m;
      const nom = ancien === null ? null : lireUnMotCle(db, ancien).libelle;
      db.prepare(`UPDATE "${table}" SET mot_cle_id = NULL WHERE id = ?`).run(id);
      // sa page de notion (R309 (7)) porte aussi son nom : retirée de cette copie, sinon le nom est pris (à trancher)
      for (const p of ancien === null ? [] : db.prepare('SELECT id FROM page WHERE mot_cle_id = ?').all(ancien)) {
        if (estUnePageDeNotion(db, p.id)) db.prepare('DELETE FROM page WHERE id = ?').run(p.id);
      }
      if (ancien === null) continue;
      db.prepare("UPDATE mot_cle SET cle = cle || '-quitte' WHERE id = ?").run(ancien);
      // depuis la 0136, son nom se lit sur son élément : resté sans page ni sort, il le garde dans un repère (contrat C0), sous le nom quitté
      if (!elementDuMotCle(db, ancien)) db.prepare('INSERT INTO repere (mot_cle_id, nom) VALUES (?, ?)').run(ancien, `${nom} quitté`);
      else if (elementDuMotCle(db, ancien).table === 'repere') db.prepare('UPDATE repere SET nom = ? WHERE mot_cle_id = ?').run(`${nom} quitté`, ancien);
    }
    renommer(db, sort);
    renommer(db, type);
    const operations = planDeLAncrage(db).lots.flatMap((l) => l.operations);
    const recreees = operations.filter((o) => o.table === 'categorie_mot_cle' && o.operation === 'inserer').map((o) => normalize(o.apres.libelle));
    assert.ok(!recreees.includes(normalize('Sort')) && !recreees.includes(normalize('Type de sort')), recreees.join());
    const creation = (table, id) => operations.find((o) => o.table === 'mot_cle' && o.operation === 'inserer' && o.ancrage?.table === table && o.ancrage?.id === id);
    assert.equal(creation('sort', element)?.ancrage.type, sort);
    assert.equal(creation('type_sort', code)?.ancrage.type, type);
  } finally {
    db.close();
  }
});

test('une catégorie recréée sous le nom quitté prime sur la trace du renommage', () => {
  const db = base();
  try {
    const metier = assurer(db, TYPE_DE_RUBRIQUE.metiers);
    const { libelle } = db.prepare('SELECT libelle FROM categorie_mot_cle WHERE id = ?').get(metier);
    renommer(db, metier);
    const suivant = db.prepare('SELECT max(id) + 1 AS n FROM categorie_mot_cle').get().n;
    db.prepare('INSERT INTO categorie_mot_cle (id, libelle, libelle_cle) VALUES (?, ?, ?)').run(suivant, libelle, normalize(libelle));
    assert.equal(categorieDuType(db, libelle), suivant);
  } finally {
    db.close();
  }
});
