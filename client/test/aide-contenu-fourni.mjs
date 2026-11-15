// Aides des tests de la fabrication depuis un fichier de contenu (lot 9 du chantier de la base de dev) : un extrait du contenu fabriqué une fois par processus
// (serveur/extrait.mjs, depuis la base du site), ses copies modifiables, l'empreinte d'un fichier, la liste d'un dossier. Module sans test propre.
import { createHash } from 'node:crypto';
import { copyFileSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fabriquerExtrait } from '../serveur/extrait.mjs';
import { cheminBase } from '../src/lib/donnees.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';

let extrait = null;

/** Le chemin d'un extrait du contenu de la base du site (version, schéma et lignes de la base fabriquée par le build), fabriqué une fois par processus. */
export function extraitDEssai() {
  if (!extrait) {
    const dossier = dossierTemporaire('contenu-fourni');
    extrait = join(dossier, 'extrait.db');
    fabriquerExtrait({ source: cheminBase({ sansExemples: false }), destination: extrait, version: '0.0.0-essai' });
  }
  return extrait;
}

/** Une copie de l'extrait dans `dossier`, que `modifier(db)` peut changer (base ouverte en écriture, fermée ensuite). Rend le chemin de la copie. */
export function copieDEssai(dossier, modifier = () => {}, nom = 'contenu.db') {
  const copie = join(dossier, nom);
  copyFileSync(extraitDEssai(), copie);
  const db = new DatabaseSync(copie);
  try {
    modifier(db);
  } finally {
    db.close();
  }
  return copie;
}

export const empreinteDuFichier = (chemin) => createHash('sha256').update(readFileSync(chemin)).digest('hex');

/** Les noms d'un dossier, triés : pour prouver qu'un lecteur n'y a rien laissé (ni -journal, ni -wal, ni copie). */
export const listeDuDossier = (dossier) => readdirSync(dossier).sort();
