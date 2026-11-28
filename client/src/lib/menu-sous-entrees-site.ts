import { poserLesAncres, poserLesSousEntrees, sousEntreesDuSite } from './menu-sous-entrees.mjs';
import { classeDeCategorie, classeDeMagie } from './palette-css.mjs';
import { groupClasses } from './class-groups.mjs';
import { loadMagies } from './magies';
import { ordreDeLaListeDesRaces, rangDansLaListe } from './races';
import { loadWiki } from './wiki';

// Ce que le site tire de la base pour les sous-entrées du menu latéral (R321, lot 2 ; lib/menu-sous-entrees.mjs) : les pages de chaque onglet des Règles (le plan,
// installé par lib/wiki.ts) et les races (dans l'ordre de /races/). Calculé une fois par construction du site (comme loadWiki), posé par layouts/Base.astro.
let cache: Promise<ReturnType<typeof sousEntreesDuSite>> | undefined;

async function calculer() {
  const { entries } = await loadWiki();
  // les magies, dans l'ordre du classeur (magie.ordre) ; une magie sans page chargée est sautée
  const magies = [...loadMagies().magies.values()].filter((m) => entries.some((e) => e.id === m.id)).sort((a, b) => a.ordre - b.ordre)
    .map((m) => ({ id: m.id, nom: m.nom, classe: classeDeMagie(m.nom) }));
  // les classes rangées comme sur /classes/ (groupClasses : cinq catégories), chaque catégorie de sa couleur
  const groupesDeClasses = groupClasses(entries.filter((e) => e.id.startsWith('classes/'))).map((g) => ({ ...g, classe: classeDeCategorie(g.key) }));
  return sousEntreesDuSite({ entries, ordreDesRaces: ordreDeLaListeDesRaces(), rangDe: rangDansLaListe, magies, groupesDeClasses });
}

/**
 * Les entrées d'une rubrique du menu avec leurs sous-entrées (R321 (2) : sur toutes les pages, chaque entrée porte les siennes), et, sur la page `ancres.page`,
 * les ancres propres à cette page sous son entrée.
 */
export async function avecLesSousEntrees(entrees: any[], ancres?: { page: string; entrees: { ancre: string; libelle: string }[] }) {
  cache ??= calculer();
  const posees = poserLesSousEntrees(entrees, await cache);
  return ancres ? poserLesAncres(posees, ancres.page, ancres.entrees) : posees;
}
