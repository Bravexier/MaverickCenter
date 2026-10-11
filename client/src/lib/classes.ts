import { ouvrirBase } from './donnees.mjs';
import { chargerClasses } from './classes-db.mjs';

// Classes et dons de la base (lib/classes-db.mjs), chargés une fois par build.
export type Classes = ReturnType<typeof chargerClasses>;
export type ClasseDb = Classes['classes'] extends Map<string, infer C> ? C : never;
export type DonDb = ClasseDb['dons'][number];

let cache: Classes | undefined;
export const loadClasses = () => (cache ??= chargerClasses(ouvrirBase()));
