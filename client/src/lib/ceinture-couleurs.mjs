// Couleurs des lignes de l'onglet « Ceinture » de la page /ressources/equipement/ (demande du propriétaire du 2026-10-16 : « il faudra aussi
// récupérer les couleurs utilisées dans les tableaux du GoogleSheet pour les lignes présentes ») : le fond (et la couleur du texte quand la source en
// pose une) de chaque ligne, lus dans les sources originales (décision R83 : les originaux font foi) le 2026-10-16, par les connecteurs Google de la
// session ; les instantanés (sources/raw/, texte seul) ne gardent pas la mise en forme. Repère visuel sans valeur de règle, comme la couleur d'un
// matériau (materiaux-couleurs.mjs). Rien n'est déduit : une ligne dont la source n'a pas de couleur reste neutre (null).
//   - Potions (sous-onglet Consommables) : le Google Doc « Alchimie » (original 1n5KJ8rmk1Yj8QY__v31XnpDwQw6gSyjx1tve9bTZM2k) écrit chaque palier dans
//     un tableau dont la première ligne, le nom (« Petite fiole rouge »), a sa couleur de fond (tableCellStyle.backgroundColor) ; le texte y est noir,
//     sauf quand le Doc le pose (« texte », blanc sur les fonds sombres). Clé : l'identifiant de la potion (ressource.id) ; son palier est le tableau
//     que cite son source_ref (« tableau « Fiole cyante moyenne » », le nom d'avant les corrections d'orthographe). Le Remède enragé et l'Huile rage
//     n'ont pas de couleur dans le Doc.
//   - Bâtons magiques : dans l'onglet « Bâton magique » du classeur « Ressources et Craft » (original 12UBFKzQVWK8zPROqk9GdDq-yIE8EOf6NakU7BQI70PA),
//     seule la case du nom de chaque magie, en tête de sa colonne (D15:V15, D29:V29), a une couleur (effectiveFormat.backgroundColor ; les cases des
//     effets sont blanches) : la couleur de la ligne de sa magie. Clé : l'identifiant de la magie.
//   - Carquois et sacs : l'onglet « Équipement inventaire » (MATOS PROJECTILE, BN3:BT23) ne les colore pas (fond blanc) : pas de couleur.
// Le texte d'une ligne est celui que la source pose, sinon le plus lisible sur le fond (sort-format.mjs#texteSurCouleur, comme les lignes de magie).
// Sans dépendance : importé par lib/ceinture-db.mjs, lib/batons-rendu.mjs et les tests (test/ceinture-couleurs.test.mjs : une entrée par potion de
// la base, une par magie des bâtons).

/** Couleur de la ligne de chaque potion : { fond, texte? } (« #rrggbb »), ou null quand le Doc ne colore pas son palier. */
export const COULEURS_DES_POTIONS = Object.freeze({
  // Fiole beige
  'ressources/fiole-beige#potion:petite-fiole-beige': { fond: '#fff2cc' },
  'ressources/fiole-beige#potion:fiole-beige-moyenne': { fond: '#ffecb3' },
  'ressources/fiole-beige#potion:super-fiole-beige': { fond: '#e4cb7f' },
  'ressources/fiole-beige#potion:mega-fiole-beige': { fond: '#daba59' },
  'ressources/fiole-beige#potion:ultime-fiole-beige': { fond: '#c2a54e' },
  // Fiole blanche
  'ressources/fiole-blanche#potion:petite-fiole-blanche': { fond: '#ffffff' },
  'ressources/fiole-blanche#potion:fiole-blanche-moyenne': { fond: '#f3f3f3' },
  'ressources/fiole-blanche#potion:super-fiole-blanche': { fond: '#efefef' },
  'ressources/fiole-blanche#potion:mega-fiole-blanche': { fond: '#d9d9d9' },
  'ressources/fiole-blanche#potion:ultime-fiole-blanche': { fond: '#cccccc' },
  // Fiole bleue
  'ressources/fiole-bleue#potion:petite-fiole-bleue': { fond: '#c9daf8' },
  'ressources/fiole-bleue#potion:fiole-bleue-moyenne': { fond: '#a4c2f4' },
  'ressources/fiole-bleue#potion:super-fiole-bleue': { fond: '#6d9eeb' },
  'ressources/fiole-bleue#potion:mega-fiole-bleue': { fond: '#3c78d8' },
  'ressources/fiole-bleue#potion:ultime-fiole-bleue': { fond: '#1155cc' },
  // Fiole bordeaux
  'ressources/fiole-bordeaux#potion:petite-fiole-bordeaux': { fond: '#e6b8af' },
  'ressources/fiole-bordeaux#potion:fiole-bordeaux-moyenne': { fond: '#dd7e6b' },
  'ressources/fiole-bordeaux#potion:super-fiole-bordeaux': { fond: '#cc4125' },
  'ressources/fiole-bordeaux#potion:mega-fiole-bordeaux': { fond: '#a61c00', texte: '#ffffff' },
  'ressources/fiole-bordeaux#potion:ultime-fiole-bordeaux': { fond: '#85200c', texte: '#ffffff' },
  // Fiole brune
  'ressources/fiole-brune#potion:petite-fiole-brune': { fond: '#be9870' },
  'ressources/fiole-brune#potion:fiole-brune-moyenne': { fond: '#9e764d' },
  'ressources/fiole-brune#potion:super-fiole-brune': { fond: '#a36627' },
  'ressources/fiole-brune#potion:mega-fiole-brune': { fond: '#9c5000', texte: '#ffffff' },
  'ressources/fiole-brune#potion:ultime-fiole-brune': { fond: '#783f04', texte: '#ffffff' },
  // Fiole cyan
  'ressources/fiole-cyante#potion:petite-fiole-cyante': { fond: '#d0e0e3' }, // « Petite fiole cyante » dans le Doc
  'ressources/fiole-cyante#potion:fiole-cyante-moyenne': { fond: '#a2c4c9' }, // « Fiole cyante moyenne » dans le Doc
  'ressources/fiole-cyante#potion:super-fiole-cyante': { fond: '#76a5af' }, // « Super fiole cyante » dans le Doc
  'ressources/fiole-cyante#potion:mega-fiole-cyante': { fond: '#45818e', texte: '#ffffff' }, // « Méga fiole cyante » dans le Doc
  'ressources/fiole-cyante#potion:ultime-fiole-cyante': { fond: '#134f5c', texte: '#ffffff' }, // « Ultime fiole cyante » dans le Doc
  // Fiole jaune
  'ressources/fiole-jaune#potion:petite-fiole-jaune': { fond: '#fff2cc' },
  'ressources/fiole-jaune#potion:fiole-jaune-moyenne': { fond: '#ffe599' },
  'ressources/fiole-jaune#potion:super-fiole-jaune': { fond: '#ffd966' },
  'ressources/fiole-jaune#potion:mega-fiole-jaune': { fond: '#f1c232' },
  'ressources/fiole-jaune#potion:ultime-fiole-jaune': { fond: '#bf9000' },
  // Fiole mauve
  'ressources/fiole-mauve#potion:petite-fiole-mauve': { fond: '#d9d2e9' },
  'ressources/fiole-mauve#potion:fiole-mauve-moyenne': { fond: '#b4a7d6' },
  'ressources/fiole-mauve#potion:super-fiole-mauve': { fond: '#8e7cc3' },
  'ressources/fiole-mauve#potion:mega-fiole-mauve': { fond: '#674ea7', texte: '#ffffff' },
  'ressources/fiole-mauve#potion:ultime-fiole-mauve': { fond: '#351c75', texte: '#ffffff' },
  // Fiole multicolore
  'ressources/fiole-multicolore#potion:petite-fiole-multicolore': { fond: '#ffffff' },
  'ressources/fiole-multicolore#potion:fiole-multicolore-moyenne': { fond: '#f3f3f3' },
  'ressources/fiole-multicolore#potion:super-fiole-multicolore': { fond: '#efefef' },
  'ressources/fiole-multicolore#potion:mega-fiole-multicolore': { fond: '#d9d9d9' },
  'ressources/fiole-multicolore#potion:ultime-fiole-multicolore': { fond: '#cccccc' },
  // Fiole noire
  'ressources/fiole-noire#potion:petite-fiole-noire': { fond: '#000000', texte: '#ffffff' },
  'ressources/fiole-noire#potion:fiole-noire-moyenne': { fond: '#000000', texte: '#ffffff' },
  'ressources/fiole-noire#potion:super-fiole-noire': { fond: '#000000', texte: '#ffffff' },
  'ressources/fiole-noire#potion:mega-fiole-noire': { fond: '#000000', texte: '#ffffff' },
  'ressources/fiole-noire#potion:ultime-fiole-noire': { fond: '#000000', texte: '#ffffff' },
  // Fiole orange
  'ressources/fiole-orange#potion:petite-fiole-orange': { fond: '#fce5cd' },
  'ressources/fiole-orange#potion:fiole-orange-moyenne': { fond: '#f9cb9c' },
  'ressources/fiole-orange#potion:super-fiole-orange': { fond: '#f6b26b' },
  'ressources/fiole-orange#potion:mega-fiole-orange': { fond: '#e69138' },
  'ressources/fiole-orange#potion:ultime-fiole-orange': { fond: '#b45f06' },
  // Fiole rose
  'ressources/fiole-rose#potion:petite-fiole-rose': { fond: '#ead1dc' },
  'ressources/fiole-rose#potion:fiole-rose-moyenne': { fond: '#d5a6bd' },
  'ressources/fiole-rose#potion:super-fiole-rose': { fond: '#c27ba0' },
  'ressources/fiole-rose#potion:mega-fiole-rose': { fond: '#a64d79', texte: '#ffffff' },
  'ressources/fiole-rose#potion:ultime-fiole-rose': { fond: '#741b47', texte: '#ffffff' },
  // Fiole rouge
  'ressources/fiole-rouge#potion:petite-fiole-rouge': { fond: '#f4cccc' },
  'ressources/fiole-rouge#potion:fiole-rouge-moyenne': { fond: '#ea9999' },
  'ressources/fiole-rouge#potion:super-fiole-rouge': { fond: '#e06666' },
  'ressources/fiole-rouge#potion:mega-fiole-rouge': { fond: '#cc0000' },
  'ressources/fiole-rouge#potion:ultime-fiole-rouge': { fond: '#990000' },
  // Fiole verte
  'ressources/fiole-verte#potion:petite-fiole-verte': { fond: '#d9ead3' },
  'ressources/fiole-verte#potion:fiole-verte-moyenne': { fond: '#b6d7a8' },
  'ressources/fiole-verte#potion:super-fiole-verte': { fond: '#93c47d' },
  'ressources/fiole-verte#potion:mega-fiole-verte': { fond: '#6aa84f' },
  'ressources/fiole-verte#potion:ultime-fiole-verte': { fond: '#38761d', texte: '#ffffff' },
  // Fiole verte foncée
  'ressources/fiole-verte-fonce#potion:fiole-verte-foncee-moyenne': { fond: '#93c47d' },
  'ressources/fiole-verte-fonce#potion:super-fiole-verte-foncee': { fond: '#6aa84f' },
  'ressources/fiole-verte-fonce#potion:mega-fiole-verte-foncee': { fond: '#38761d', texte: '#ffffff' },
  'ressources/fiole-verte-fonce#potion:ultime-fiole-verte-foncee': { fond: '#274e13', texte: '#ffffff' },
  // Panacée
  'ressources/panacee#potion:panacee-mineur': { fond: '#f9cb9c' }, // « Panacée mineur » dans le Doc
  'ressources/panacee#potion:panacee-majeur': { fond: '#f6b26b' }, // « Panacée majeur » dans le Doc
  'ressources/panacee#potion:panacee-parfait': { fond: '#e69138' }, // « Panacée parfait » dans le Doc
  // Remède aveuglement
  'ressources/remede-aveuglement#potion:remede-daveuglement-mineur': { fond: '#ffecb3' },
  'ressources/remede-aveuglement#potion:remede-daveuglement-majeur': { fond: '#e4cb7f' },
  'ressources/remede-aveuglement#potion:remede-daveuglement-parfait': { fond: '#daba59' },
  // Remède brûlure
  'ressources/remede-brulure#potion:remede-de-brulure-mineur': { fond: '#ea9999' },
  'ressources/remede-brulure#potion:remede-de-brulure-majeur': { fond: '#e06666' },
  'ressources/remede-brulure#potion:remede-de-brulure-parfait': { fond: '#cc0000' },
  // Remède confusion
  'ressources/remede-confusion#potion:remede-de-confusion-mineur': { fond: '#c9daf8' },
  'ressources/remede-confusion#potion:remede-de-confusion-majeur': { fond: '#a4c2f4' },
  'ressources/remede-confusion#potion:remede-de-confusion-parfait': { fond: '#6d9eeb' },
  // Remède enragé
  'ressources/remede-enrage#potion:remede-enrage-mineur': null,
  'ressources/remede-enrage#potion:remede-enrage-majeur': null,
  'ressources/remede-enrage#potion:remede-enrage-parfait': null,
  // Remède fatigue
  'ressources/remede-fatigue#potion:remede-de-fatigue-mineur': { fond: '#ead1dc' },
  'ressources/remede-fatigue#potion:remede-de-fatigue-majeur': { fond: '#d5a6bd' },
  'ressources/remede-fatigue#potion:remede-de-fatigue-parfait': { fond: '#c27ba0' },
  // Remède gel
  'ressources/remede-gel#potion:remede-de-gel-mineur': { fond: '#d0e0e3' },
  'ressources/remede-gel#potion:remede-de-gel-majeur': { fond: '#a2c4c9' },
  'ressources/remede-gel#potion:remede-de-gel-parfait': { fond: '#76a5af' },
  // Remède paralysie
  'ressources/remede-paralysie#potion:remede-de-paralysie-mineur': { fond: '#fff2cc' },
  'ressources/remede-paralysie#potion:remede-de-paralysie-majeur': { fond: '#ffe599' },
  'ressources/remede-paralysie#potion:remede-de-paralysie-parfait': { fond: '#ffd966' },
  // Remède pétrification
  'ressources/remede-petrification#potion:remede-de-petrification-mineur': { fond: '#be9870' },
  'ressources/remede-petrification#potion:remede-de-petrification-majeur': { fond: '#9e764d' },
  'ressources/remede-petrification#potion:remede-de-petrification-parfait': { fond: '#a36627' },
  // Remède peur
  'ressources/remede-peur#potion:remede-de-peur-mineur': { fond: '#d9d2e9' },
  'ressources/remede-peur#potion:remede-de-peur-majeur': { fond: '#b4a7d6' },
  'ressources/remede-peur#potion:remede-de-peur-parfait': { fond: '#8e7cc3' },
  // Remède poison
  'ressources/remede-poison#potion:remede-de-poison-mineur': { fond: '#93c47d' },
  'ressources/remede-poison#potion:remede-de-poison-majeur': { fond: '#6aa84f' },
  'ressources/remede-poison#potion:remede-de-poison-parfait': { fond: '#6aa84f' },
  // Remède saignement
  'ressources/remede-saignement#potion:remede-de-saignement-mineur': { fond: '#cc4125' },
  'ressources/remede-saignement#potion:remede-de-saignement-majeur': { fond: '#a61c00' },
  'ressources/remede-saignement#potion:remede-de-saignement-parfait': { fond: '#85200c' },
  // Remède surcharge
  'ressources/remede-surcharge#potion:remede-de-surcharge-mineur': { fond: '#f3f3f3' },
  'ressources/remede-surcharge#potion:remede-de-surcharge-majeur': { fond: '#efefef' },
  'ressources/remede-surcharge#potion:remede-de-surcharge-parfait': { fond: '#d9d9d9' },
  // Remède surdité
  'ressources/remede-surdite#potion:remede-de-surdite-mineur': { fond: '#d9ead3' },
  'ressources/remede-surdite#potion:remede-de-surdite-majeur': { fond: '#b6d7a8' },
  'ressources/remede-surdite#potion:remede-de-surdite-parfait': { fond: '#93c47d' },
  // Philtre de l’Escamoteur
  'ressources/philtre-de-lescamoteur#potion:philtre-de-lescamoteur': { fond: '#b6d7a8' },
  'ressources/philtre-de-lescamoteur#potion:super-philtre-de-lescamoteur': { fond: '#93c47d' },
  'ressources/philtre-de-lescamoteur#potion:mega-philtre-de-lescamoteur': { fond: '#6aa84f' },
  'ressources/philtre-de-lescamoteur#potion:ultime-philtre-de-lescamoteur': { fond: '#38761d', texte: '#ffffff' },
  // Philtre de l’Orateur
  'ressources/philtre-de-lorateur#potion:philtre-de-lorateur': { fond: '#efefef' },
  'ressources/philtre-de-lorateur#potion:super-philtre-de-lorateur': { fond: '#d9d9d9' },
  'ressources/philtre-de-lorateur#potion:mega-philtre-de-lorateur': { fond: '#cccccc' },
  'ressources/philtre-de-lorateur#potion:ultime-philtre-de-lorateur': { fond: '#b7b7b7' },
  // Philtre du Puissant
  'ressources/philtre-du-puissant#potion:philtre-du-puissant': { fond: '#dd7e6b' },
  'ressources/philtre-du-puissant#potion:super-philtre-du-puissant': { fond: '#cc4125' },
  'ressources/philtre-du-puissant#potion:mega-philtre-du-puissant': { fond: '#a61c00' },
  'ressources/philtre-du-puissant#potion:ultime-philtre-du-puissant': { fond: '#85200c', texte: '#ffffff' },
  // Philtre du Savant
  'ressources/philtre-du-savant#potion:philtre-du-savant': { fond: '#a4c2f4' },
  'ressources/philtre-du-savant#potion:super-philtre-du-savant': { fond: '#6d9eeb' },
  'ressources/philtre-du-savant#potion:mega-philtre-du-savant': { fond: '#3c78d8' },
  'ressources/philtre-du-savant#potion:ultime-philtre-du-savant': { fond: '#1155cc', texte: '#ffffff' },
  // Philtre du Valeureux
  'ressources/philtre-du-valeureux#potion:philtre-du-valeureux': { fond: '#b4a7d6' },
  'ressources/philtre-du-valeureux#potion:super-philtre-du-valeureux': { fond: '#8e7cc3' },
  'ressources/philtre-du-valeureux#potion:mega-philtre-du-valeureux': { fond: '#674ea7', texte: '#ffffff' },
  'ressources/philtre-du-valeureux#potion:ultime-philtre-du-valeureux': { fond: '#351c75', texte: '#ffffff' },
  // Philtre du Vigilant
  'ressources/philtre-du-vigilant#potion:philtre-du-vigilant': { fond: '#ffe599' },
  'ressources/philtre-du-vigilant#potion:super-philtre-du-vigilant': { fond: '#ffd966' },
  'ressources/philtre-du-vigilant#potion:mega-philtre-du-vigilant': { fond: '#f1c232' },
  'ressources/philtre-du-vigilant#potion:ultime-philtre-du-vigilant': { fond: '#bf9000' },
  // Huile assourdissante
  'ressources/huile-assourdissante#potion:petite-huile-assourdissante': { fond: '#d9ead3' },
  'ressources/huile-assourdissante#potion:grande-huile-assourdissante': { fond: '#b6d7a8' },
  'ressources/huile-assourdissante#potion:super-huile-assourdissante': { fond: '#93c47d' },
  // Huile aveuglante
  'ressources/huile-aveuglante#potion:petite-huile-aveuglante': { fond: '#ffecb3' },
  'ressources/huile-aveuglante#potion:grande-huile-aveuglante': { fond: '#e4cb7f' },
  'ressources/huile-aveuglante#potion:super-huile-aveuglante': { fond: '#daba59' },
  // Huile confusion
  'ressources/huile-confusion#potion:petite-huile-confusion': { fond: '#c9daf8' },
  'ressources/huile-confusion#potion:grande-huile-confusion': { fond: '#a4c2f4' },
  'ressources/huile-confusion#potion:super-huile-confusion': { fond: '#6d9eeb' },
  // Huile exténuante
  'ressources/huile-extenuante#potion:petite-huile-extenuante': { fond: '#ead1dc' },
  'ressources/huile-extenuante#potion:grande-huile-extenuante': { fond: '#d5a6bd' },
  'ressources/huile-extenuante#potion:super-huile-extenuante': { fond: '#c27ba0' },
  // Huile givrante
  'ressources/huile-givrante#potion:petite-huile-givrante': { fond: '#d0e0e3' },
  'ressources/huile-givrante#potion:grande-huile-givrante': { fond: '#a2c4c9' },
  'ressources/huile-givrante#potion:super-huile-givrante': { fond: '#76a5af' },
  // Huile hémophile
  'ressources/huile-hemophile#potion:petite-huile-hemophile': { fond: '#dd7e6b' },
  'ressources/huile-hemophile#potion:grande-huile-hemophile': { fond: '#cc4125' },
  'ressources/huile-hemophile#potion:super-huile-hemophile': { fond: '#a61c00' },
  // Huile paralysante
  'ressources/huile-paralysante#potion:petite-huile-paralysante': { fond: '#fff2cc' },
  'ressources/huile-paralysante#potion:grande-huile-paralysante': { fond: '#ffe599' },
  'ressources/huile-paralysante#potion:super-huile-paralysante': { fond: '#ffd966' },
  // Huile pétrifiante
  'ressources/huile-petrifiante#potion:petite-huile-petrifiante': { fond: '#be9870' },
  'ressources/huile-petrifiante#potion:grande-huile-petrifiante': { fond: '#9e764d' },
  'ressources/huile-petrifiante#potion:super-huile-petrifiante': { fond: '#a36627' },
  // Huile rage
  'ressources/huile-rage#potion:petite-huile-rage': null,
  'ressources/huile-rage#potion:grande-huile-rage': null,
  'ressources/huile-rage#potion:super-huile-rage': null,
  // Huile séraphine
  'ressources/huile-seraphine#potion:petite-huile-seraphine': { fond: '#ea9999' },
  'ressources/huile-seraphine#potion:grande-huile-seraphine': { fond: '#e06666' },
  'ressources/huile-seraphine#potion:super-huile-seraphine': { fond: '#cc0000' },
  // Huile surcharge
  'ressources/huile-surcharge#potion:petite-huile-surcharge': { fond: '#d9d9d9' },
  'ressources/huile-surcharge#potion:grande-huile-surcharge': { fond: '#cccccc' },
  'ressources/huile-surcharge#potion:super-huile-surcharge': { fond: '#b7b7b7' },
  // Huile terrifiante
  'ressources/huile-terrifiante#potion:petite-huile-terrifiante': { fond: '#d9d2e9' },
  'ressources/huile-terrifiante#potion:grande-huile-terrifiante': { fond: '#b4a7d6' },
  'ressources/huile-terrifiante#potion:super-huile-terrifiante': { fond: '#8e7cc3' },
  // Huile toxique
  'ressources/huile-toxique#potion:petite-huile-toxique': { fond: '#93c47d' },
  'ressources/huile-toxique#potion:grande-huile-toxique': { fond: '#6aa84f' },
  'ressources/huile-toxique#potion:super-huile-toxique': { fond: '#38761d', texte: '#ffffff' },
  // Alchimie primitive
  'ressources/alchimie-primitive#potion:bloc-degoutant': { fond: '#ffe599' },
  'ressources/alchimie-primitive#potion:breuvage-immonde': { fond: '#9fc5e8' },
  'ressources/alchimie-primitive#potion:poudre-de-guerison': { fond: '#dd7e6b' },
  'ressources/alchimie-primitive#potion:bloc-etrange': { fond: '#ffd966' },
  'ressources/alchimie-primitive#potion:breuvage-amer': { fond: '#6fa8dc' },
  'ressources/alchimie-primitive#potion:super-poudre-de-guerison': { fond: '#dd7e6b' },
});

/** Couleur de la ligne des bâtons de chaque magie : la case de son nom dans l'onglet « Bâton magique » ({ fond, texte? }). */
export const COULEURS_DES_BATONS = Object.freeze({
  'magies/magie-du-sang': { fond: '#980000' }, // D15
  'magies/magie-de-larcane': { fond: '#f3f3f3' }, // G15
  'magies/magie-de-la-corruption': { fond: '#000000', texte: '#ffffff' }, // J15
  'magies/magie-de-lespace-temps': { fond: '#d5a6bd' }, // M15
  'magies/magie-du-vide': { fond: '#ffffff' }, // P15
  'magies/magie-de-la-necromancie': { fond: '#274e13', texte: '#ffffff' }, // S15
  'magies/magie-du-feu': { fond: '#cc0000' }, // V15
  'magies/magie-de-leau': { fond: '#3c78d8' }, // D29
  'magies/magie-de-la-glace': { fond: '#00ffff' }, // G29
  'magies/magie-de-la-terre': { fond: '#783f04' }, // J29
  'magies/magie-du-vent': { fond: '#93c47d' }, // M29
  'magies/magie-de-la-foudre': { fond: '#ffff00' }, // P29
  'magies/magie-de-la-lumiere': { fond: '#fff2cc' }, // S29
  'magies/magie-de-lombre': { fond: '#674ea7' }, // V29
});

/** La couleur d'une potion, ou null (pas de couleur dans le Doc, ou potion créée depuis). */
export const couleurDePotion = (id) => COULEURS_DES_POTIONS[id] ?? null;

/** La couleur de la ligne des bâtons d'une magie, ou null (magie absente de l'onglet). */
export const couleurDesBatons = (magieId) => COULEURS_DES_BATONS[magieId] ?? null;
