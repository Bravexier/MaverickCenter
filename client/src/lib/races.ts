import { ouvrirBase } from './donnees.mjs';
import { chargerRaces } from './races-db.mjs';

// Races de la base (lib/races-db.mjs), chargées une fois par build.
export type Races = ReturnType<typeof chargerRaces>;
export type RaceDb = Races['races'] extends Map<string, infer R> ? R : never;

let cache: Races | undefined;
export const loadRaces = () => (cache ??= chargerRaces(ouvrirBase()));
