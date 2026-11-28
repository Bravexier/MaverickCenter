// Les ancres propres à une page de magie (R321 (2) : les sections de la page, qui n'apparaissent que sur elle, comme sous-entrées de la magie courante dans le menu
// latéral du site ; avant : la barre `nav.magie-nav` de components/magie/MagiePage.astro). Pur, sans DOM ni Astro.
// Les ids visés sont ceux des sections de MagiePage.astro (`#presentation`, `#alteration`, `#affinites`, `#mode-hyper`, `#sorts`, `#races-disponibles`), des niveaux
// de puissance magique communs (`#npm-<niveau>`) et des spécialisations (`#specialisation-<ancre>`, lib/sort-format.mjs#ancreDeSpecialisation).
import { racesOfMagie } from './magie-relations.mjs';
import { magiesDuPotentiel, POTENTIEL_ILLIMITE } from './potentiel-illimite.mjs';
import { ancreDeSpecialisation, sortsParSpecialisation } from './sort-format.mjs';

/**
 * Les ancres d'une page de magie, dans l'ordre : les sections présentes, puis un NPM par niveau commun, puis une entrée par spécialisation :
 * [{ ancre: '#presentation', libelle }]. `entry` : la page (lib/wiki.ts), `entries` : toutes les pages, `magie` : la ligne de la base (lib/magies-db.mjs), `magies` : toutes
 * (la page du Potentiel Illimité montre les sorts des autres magies). Une page à une seule section n'a aucune ancre (comme l'ancienne barre).
 */
export function ancresDeLaMagie({ entry, entries, magie, magies }) {
  const { communs: groupes, specialisations } = sortsParSpecialisation(magie.sorts, magie.specialisations);
  const autresMagies = magie.id === POTENTIEL_ILLIMITE ? magiesDuPotentiel(magies.magies) : [];
  const { avec, sans } = racesOfMagie(entries, entry);
  const aPresentation = magie.description.length > 0 || magie.descriptionPhysique.length > 0 || Boolean(magie.banniere);
  const sections = [
    { ancre: '#presentation', libelle: 'Présentation', show: aPresentation },
    { ancre: '#alteration', libelle: 'Altération d’état', show: magie.etats.length > 0 },
    { ancre: '#affinites', libelle: 'Résistances', show: true },
    { ancre: '#mode-hyper', libelle: 'Mode Hyper', show: magie.modeHyper.length > 0 },
    { ancre: '#sorts', libelle: 'Sorts', show: groupes.length > 0 || specialisations.length > 0 || autresMagies.length > 0 },
    { ancre: '#races-disponibles', libelle: 'Races', show: avec.length + sans.length > 0 },
  ].filter((n) => n.show).map(({ ancre, libelle }) => ({ ancre, libelle }));
  if (sections.length <= 1) return [];
  return [
    ...sections,
    ...groupes.map((g) => ({ ancre: `#npm-${g.niveau}`, libelle: `NPM ${g.niveau}` })),
    ...specialisations.map((s) => ({ ancre: `#specialisation-${ancreDeSpecialisation(s.specialisation.id)}`, libelle: s.specialisation.nom })),
  ];
}
