// Galerie du site (demande du propriétaire) : les images défilent sur l'accueil (components/galerie/Carrousel.astro) et sont toutes sur /galeries/.
// Module pur, sans dépendance. En construction : seul le logo officiel existe pour l'instant.
// Ajouter une image : le fichier dans client/public/galerie/ (ou à la racine de public/), puis une entrée ici ; `test/galerie.test.mjs` vérifie que le fichier existe.

/** @typedef {{ fichier: string, titre: string, alt: string, largeur: number, hauteur: number }} ImageDeGalerie */

/** Images de la galerie, dans l'ordre du défilement. `fichier` : chemin dans client/public/ ; `alt` : ce que montre l'image (lecteurs d'écran). */
export const GALERIE = [
  { fichier: 'logo.webp', titre: 'Le logo de Maverick', alt: 'Logo de Maverick : une épée derrière un bouclier doré, le nom « Maverick » en lettres d’argent', largeur: 319, hauteur: 320 },
];

/** Vrai tant que la galerie n'a que le logo : l'accueil et /galeries/ l'annoncent « en construction ». */
export const galerieEnConstruction = (images = GALERIE) => images.every((image) => image.fichier === 'logo.webp');

/** Ancre d'une image sur /galeries/ : « image-logo » pour « logo.webp », « image-elfes-au-combat » pour « galerie/elfes-au-combat.jpg ». */
export function ancreDImage(image) {
  const nom = image.fichier.slice(image.fichier.lastIndexOf('/') + 1).replace(/\.[^.]+$/, '');
  return `image-${nom.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
}

/**
 * Image suivante (sens +1) ou précédente (sens -1) du défilement, en boucle : la dernière ramène à la première.
 * Le script du carrousel fait le même calcul (il ne peut pas importer ce module : version portable, tools/build-artifact.mjs).
 */
export function imageVoisine(indice, sens, nombre) {
  if (nombre <= 0) return 0;
  return (((indice + sens) % nombre) + nombre) % nombre;
}
