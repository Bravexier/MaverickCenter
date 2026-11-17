import { ouvrirBase } from './donnees.mjs';
import { chargerRaces, comparerRangsDeListe } from './races-db.mjs';

// Races de la base (lib/races-db.mjs), chargées une fois par build.
export type Races = ReturnType<typeof chargerRaces>;
export type RaceDb = Races['races'] extends Map<string, infer R> ? R : never;

let cache: Races | undefined;
export const loadRaces = () => (cache ??= chargerRaces(ouvrirBase()));

/**
 * L'ordre de la liste des races (menu latéral des races, /races/, tableau des magies innées ; réponse du propriétaire « /races/ suit, le reste figé ») :
 * un comparateur de deux pages de race pour lib/race-kinds.mjs#groupRaces, d'après race.rang_liste (migration 0092 ; lib/races-db.mjs#comparerRangsDeListe :
 * une race sans rang ou sans ligne dans la base en fin de liste, par nom). La fiche et /magies/ gardent ORDRE_DES_RACES.
 */
export function ordreDeLaListeDesRaces() {
  const { races } = loadRaces();
  const place = (e: { id: string; data: { title: string } }) => {
    const r = races.get(e.id) as { rangListe: number | null; nom: string } | undefined;
    return { rangListe: r?.rangListe ?? null, nom: r?.nom ?? e.data.title };
  };
  return (a: { id: string; data: { title: string } }, b: { id: string; data: { title: string } }) => comparerRangsDeListe(place(a), place(b));
}

/** Le rang d'une race dans la liste (race.rang_liste), ou null : le menu latéral le pose pour le mode modification (data-ed-rang). */
export const rangDansLaListe = (id: string) => (loadRaces().races.get(id) as { rangListe: number | null } | undefined)?.rangListe ?? null;
