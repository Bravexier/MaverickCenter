// Lecture des sources du dépôt par les tests : un clone Windows (core.autocrlf=true) les a en CRLF, alors que les motifs des tests sont écrits pour « \n ».
// Comportement épinglé par test/compat-windows.test.mjs.
import { readFileSync } from 'node:fs';

/** `texte` avec des fins de ligne « \n ». */
export const sansCrlf = (texte) => texte.replace(/\r\n/g, '\n');

/** Le contenu du fichier `chemin` (chemin ou URL), avec des fins de ligne « \n » quel que soit le clone. */
export const lireSansCrlf = (chemin) => sansCrlf(readFileSync(chemin, 'utf8'));
