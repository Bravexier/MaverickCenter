// Les portraits du bestiaire publiés en fichiers au build (migration 0033 : monstre.portrait, monstre_espece.portrait) : la page /bestiaire/ a plus de
// 300 cartes, une image en data URL dans le HTML la rendrait énorme. Un fichier par image, nommé d'après son empreinte (lib/portrait.mjs#fichierDuPortrait,
// l'adresse que donne components/bestiaire/TableauMonstres.astro) : une image changée change d'adresse. Une route par format
// (pages/bestiaire/portraits/[empreinte].webp.ts, .jpg.ts, .png.ts) : Astro n'exempte de `trailingSlash: 'always'` qu'une route dont le nom porte
// l'extension (sinon `npm run dev` ne sert l'image qu'avec un « / » final).
// Côté build seulement (lit la base) : ni navigateur ni service.
import { empreinte, estUnPortrait, extensionDuPortrait, fichierDuPortrait, octetsDuPortrait } from './portrait.mjs';

export const TYPES_DE_PORTRAIT = Object.freeze({ webp: 'image/webp', jpg: 'image/jpeg', png: 'image/png' });

/** Les portraits de la base au format `extension` : [{ params: { empreinte }, props: { octets, type } }], une entrée par image (les doublons n'en font qu'une). */
export function cheminsDesPortraits(db, extension) {
  const images = db
    .prepare('SELECT portrait FROM monstre WHERE portrait IS NOT NULL UNION SELECT portrait FROM monstre_espece WHERE portrait IS NOT NULL')
    .all()
    .map((r) => String(r.portrait))
    // une image que la page écrit (base64 complet : estUnPortrait) se décode toujours ; une autre n'a pas de fichier, la carte montre le logo
    .filter((donnees) => estUnPortrait(donnees) && extensionDuPortrait(donnees) === extension);
  const parEmpreinte = new Map(images.map((donnees) => [empreinte(donnees), donnees]));
  return [...parEmpreinte].map(([cle, donnees]) => ({ params: { empreinte: cle }, props: { octets: octetsDuPortrait(donnees), type: TYPES_DE_PORTRAIT[extension] } }));
}

/**
 * L'adresse d'un portrait publié, pour une page qui montre une carte (TableauMonstres.astro, PageMonstre.astro) : le fichier que publient les routes
 * pages/bestiaire/portraits/[empreinte].<ext>.ts, nommé d'après son empreinte ; null pour une image qui n'en a pas (la carte montre le logo). `url` :
 * lib/wiki#url (la base du site).
 */
export const adresseDuPortrait = (url) => (donnees) => (estUnPortrait(donnees) ? url(`bestiaire/portraits/${fichierDuPortrait(donnees)}`) : null);

/** La réponse d'un fichier de portrait. */
export const reponseDuPortrait = ({ octets, type }) => new Response(octets, { headers: { 'Content-Type': type } });
