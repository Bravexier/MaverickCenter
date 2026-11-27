// Aides des tests de l'adresse d'une page dans les lots de changements (décision R316) : une copie en fichier de la petite base de test/aide-ancrage.mjs par cas,
// le dépôt direct d'un lot, le renommage par un lot ou sur le site, la photo de ce qu'un renommage écrit. Noms inventés.
import assert from 'node:assert/strict';
import { copyFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { ouvrirBaseVivante } from '../serveur/base-vivante.mjs';
import { controlerLeContenu } from '../serveur/controles-du-contenu.mjs';
import { enregistrer, ErreurEdition } from '../serveur/edition.mjs';
import { decisionsCitees, deposerEtAppliquer } from '../serveur/edition-lots.mjs';
import { nomDeTable } from '../src/lib/libelles-de-la-base.mjs';
import { FORMAT_DU_LOT } from '../src/lib/lot-de-changements.mjs';
import { normalize } from '../src/lib/text.mjs';
import { ancrerUnMotCle, baseDAncrage, poserPageLisible, recalculerLesCles } from './aide-ancrage.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';

export const nom = (suffixe) => `Zephyrion ${suffixe}`;
export const idDesRegles = (titre) => `guide/${normalize(titre)}`;
export const adresseDesRegles = (titre) => `/regles/${normalize(titre)}/`;
export const TOUS_LES_VERROUS = ['R218', 'R219', 'R232', 'R233', 'R309'];

/** Une page des Règles et son mot-clé ancré. */
export function poserUnePageDesRegles(db, titre) {
  const id = poserPageLisible(db, idDesRegles(titre), titre);
  return { id, motCle: ancrerUnMotCle(db, 'page', id, { categories: ['Règles'] }) };
}

/** Ce que le renommage écrit : le titre et le segment de chaque page, les anciennes adresses, le nom et l'adresse de chaque mot-clé. */
export const photo = (db) => ({
  pages: db.prepare('SELECT id, titre, slug_adresse FROM page ORDER BY id').all().map((p) => ({ ...p })),
  anciennes: db.prepare('SELECT adresse, page_id FROM page_ancienne_adresse ORDER BY adresse').all().map((a) => ({ ...a })),
  motsCles: db.prepare('SELECT id, libelle, url FROM mot_cle ORDER BY id').all().map((k) => ({ ...k })),
});

/** Les numéros des lignes d'un lot appliqué (edition-lots.mjs#lire) qui sont de la table `table` (les lignes disent le nom lisible de leur table). */
export const numerosDe = (lignes, table) => lignes.filter((l) => l.table === (nomDeTable(table) ?? table)).map((l) => l.n);

/** Le refus d'un dépôt direct : 409, sans numéro de décision. */
export async function refusDuDepot(promesse) {
  const e = await promesse.then(() => assert.fail('refus attendu'), (x) => x);
  assert.ok(e instanceof ErreurEdition, String(e));
  assert.equal(e.statut, 409, e.message);
  assert.deepEqual(decisionsCitees(e.message), [], e.message);
  return e;
}

/**
 * Les outils d'un fichier de tests, dans son dossier temporaire `nomDuDossier` : { cas, deposerDirect, renommerParUnLot, renommerSurLeSite }.
 * `cas(poser, essai)` : une copie en fichier de la petite base ; `poser` y écrit ses lignes et rend ce que l'essai lit (`m.monde`) ; `m.depart` est une copie de
 * la base posée (pour rejouer le journal). À la fin, les contrôles du contenu n'y trouvent rien de plus qu'avant l'essai.
 */
export function outilsDesCas(nomDuDossier) {
  const racine = dossierTemporaire(nomDuDossier);
  let n = 0;
  let modele = null;
  const cheminDuModele = () => {
    if (!modele) {
      const memoire = baseDAncrage();
      modele = join(racine, 'modele.db');
      memoire.exec(`VACUUM INTO '${modele.replaceAll("'", "''")}'`);
      memoire.close();
    }
    return modele;
  };

  async function cas(poser, essai) {
    const dossier = join(racine, `b${(n += 1)}`);
    mkdirSync(dossier, { recursive: true });
    const chemin = join(dossier, 'vivante.db');
    copyFileSync(cheminDuModele(), chemin);
    const brute = new DatabaseSync(chemin, { enableForeignKeyConstraints: false });
    brute.exec('PRAGMA ignore_check_constraints = ON; BEGIN');
    const monde = poser(brute);
    // la provenance et le type des pages (clés étrangères vers `famille` et `type_page`, que le rejeu contrôle lot par lot)
    brute.exec(`INSERT INTO famille (id, libelle, ordre) VALUES ('docs', 'Famille docs', 1); UPDATE page SET origine = 'docs';
      INSERT INTO type_page (id, libelle, singulier, salon_discord, description, ordre) SELECT type, type, type, '', '', row_number() OVER (ORDER BY type) FROM (SELECT DISTINCT type FROM page)`);
    recalculerLesCles(brute);
    brute.exec('COMMIT');
    brute.close();
    const depart = join(dossier, 'depart.db');
    copyFileSync(chemin, depart);
    const db = ouvrirBaseVivante(chemin);
    try {
      const avant = new Set(controlerLeContenu(db).problemes);
      await essai({ db, monde, depart, base: () => db, dossier: join(dossier, 'essais') });
      assert.deepEqual(controlerLeContenu(db).problemes.filter((p) => !avant.has(p)), [], 'les contrôles du contenu ne trouvent rien de plus');
    } finally {
      db.close();
    }
  }

  const lot = (operations) => ({ format: FORMAT_DU_LOT, titre: `Adresse d’essai ${(n += 1)}`, nature: 'decision', decision: 'R316', operations });
  const deposerDirect = (m, operations, plus = {}, par = 'cle_de_depot') => deposerEtAppliquer(m.base, { ...lot(operations), ...plus }, { par, enArrierePlan: false, dossier: m.dossier, controle: { ouvertHorsEdition: true } });
  const renommerParUnLot = (m, id, avant, apres) => deposerDirect(m, [{ table: 'page', cle: { id }, operation: 'modifier', avant: { titre: avant }, apres: { titre: apres } }]);
  const renommerSurLeSite = (m, id, titre) => enregistrer(m.db, { page: 'essai/', operations: [{ op: 'modifier', table: 'page', cle: { id }, valeurs: { titre } }] });
  return { cas, deposerDirect, renommerParUnLot, renommerSurLeSite };
}
