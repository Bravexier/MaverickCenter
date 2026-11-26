// Une base vivante d'essai, préparée une fois par fichier de test puis copiée, pour les tests de l'ancrage (R309) qui déposent, appliquent et annulent des lots : chacun de ces
// gestes rejoue les contrôles du contenu, plusieurs fois. Elle part de la base d'import, sans les traces de cellule (`correction`, `note_cellule`, `ecart_source`) : ces tests n'en
// lisent aucune, et les contrôles passent l'essentiel de leur temps à les recouper. Ce qui touche à ces traces se teste ailleurs, sur la base entière.
import { copyFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { preparerBaseVivante } from '../serveur/base-vivante.mjs';
import { cheminDImport } from './aide-base-d-import.mjs';

const TRACES_DE_CELLULE = ['correction', 'note_cellule', 'ecart_source'];
let modele = null;

function preparerLeModele(racine) {
  const { chemin } = preparerBaseVivante({ regles: cheminDImport(), dossier: join(racine, 'modele') });
  const db = new DatabaseSync(chemin);
  try {
    for (const table of TRACES_DE_CELLULE) db.exec(`DELETE FROM "${table}"`);
    db.exec('VACUUM');
  } finally {
    db.close();
  }
  return chemin;
}

/** Le chemin d'une copie neuve de la base légère, dans `<racine>/<nom>/vivante.db`. */
export function copieDeLaBaseLegere(racine, nom) {
  modele ??= preparerLeModele(racine);
  const dossier = join(racine, nom);
  mkdirSync(dossier, { recursive: true });
  const chemin = join(dossier, 'vivante.db');
  copyFileSync(modele, chemin);
  return chemin;
}
