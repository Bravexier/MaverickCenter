// Les races que la migration 0120 ajoute (décision R239 : Fongoïde et Gémidien, onglets de la mise à jour de Décembre), lues dans son registre
// (data/migrations/0120-races-fongoide-gemidien.json), jamais écrites à la main dans un test. Les tests d'une migration antérieure (0007 : les tables
// de l'onglet ; 0092 : le rang de la liste) et des effectifs de l'import du classeur « Les races » (R1 : 27 races) les mettent à part.
//   RACES_DE_LA_0120          Set des ids (« races/fongoide », « races/gemidien »)
//   horsDeLa0120(raceId)      vrai pour une race qui n'est pas de la 0120
//   MOTS_CLES_DE_LA_0120      { id de la race → id du mot-clé de la race } (R218 (5), R219 (5))
//   TEXTES_DE_LA_0120         les textes que la 0120 réécrit (registre `textes` : Modes Hyper de l'Elfe argenté et du Felfe, R237 (12))
import { readFileSync } from 'node:fs';

const registre = JSON.parse(readFileSync(new URL('../../data/migrations/0120-races-fongoide-gemidien.json', import.meta.url), 'utf8'));

export const RACES_DE_LA_0120 = new Set(registre.races);
export const horsDeLa0120 = (raceId) => !RACES_DE_LA_0120.has(raceId);
export const TEXTES_DE_LA_0120 = registre.textes;
export const MOTS_CLES_DE_LA_0120 = registre.mots_cles;
