// L'affichage d'une valeur fermée liée à un mot-clé du glossaire (migration 0125, demande du propriétaire : « Tous les liens communs, j'aimerais que tu les lies
// aux mots clés (ceux du glossaire) », « si ils existent ») : un type de dégâts (taille, estoc, frappe, feu, eau, glace) et une magie. Le site l'affiche comme
// une balise du glossaire : en gras, la définition du mot-clé en infobulle, un lien quand le mot-clé a une adresse — le même rendu qu'un `{{clé|texte}}` écrit
// dans un texte (rendu par le middleware au build et par `scripts/edition/mots-cles-vivants.mjs` sur le site de dev : un seul rendu, celui de
// lib/mots-cles-balises.mjs#htmlDeLaBalise). Les liens viennent de lib/mots-cles-des-valeurs.mjs (`liens` de chargerArmes, chargerArmures, chargerMonstres,
// chargerInvocations, loadMagies, chargerReglesDeFiche) ; ce module ne lit pas la base. Une valeur sans mot-clé (physique, sonore) ou une page sans `liens`
// (le contexte d'un rendu du mode modification n'en porte pas toujours) garde son libellé nu : rien n'est deviné.
// Pur, sans dépendance navigateur ni Astro.
import { lienDeLaMagie, lienDuTypeDeDegats } from './mots-cles-des-valeurs.mjs';

/** Ce que le texte d'une balise ne peut pas porter : le séparateur, les accolades, un balisage HTML (le texte serait lu autrement). */
const IMPOSSIBLE = /[|{}<>&"]/;

const echapper = (t) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * La balise `{{clé|texte}}` d'une valeur fermée, ou null quand elle n'a pas de mot-clé (`lien` nul) ou que son texte ne peut pas s'écrire dans une balise. Le
 * texte est celui du lien (le nom court d'une magie : « Feu » ; feu, eau et glace d'une attaque : celui de leur magie) ; à défaut, `libelle`, celui que la page
 * affiche déjà (taille, estoc, frappe : « Taille », « Dégâts de taille »). Le mot-clé est visé par sa clé du moment : lue de la base à chaque construction de page
 * (le service et le build relisent la base ; une clé que le site de dev change est reconnue par ses anciennes clés, lib/mots-cles-balises.mjs#motCleDeLaRef).
 * @param {{ cle: string, texte?: string | null } | null | undefined} lien
 * @param {string} libelle
 */
export function baliseDeLaValeur(lien, libelle) {
  if (!lien?.cle || IMPOSSIBLE.test(lien.cle)) return null;
  const texte = lien.texte ?? libelle;
  if (!texte || IMPOSSIBLE.test(texte)) return null;
  return `{{${lien.cle}|${texte}}}`;
}

/** L'HTML d'une valeur fermée : sa balise, sinon son libellé échappé. */
export const htmlDeLaValeur = (lien, libelle) => baliseDeLaValeur(lien, libelle) ?? echapper(libelle);

/** L'HTML d'un type de dégâts (`id` : taille, estoc, frappe, feu…) : lié à son mot-clé dans `liens` quand il en a un, sinon `libelle`. */
export const htmlDuTypeDeDegats = (liens, id, libelle) => htmlDeLaValeur(lienDuTypeDeDegats(liens, id), libelle);

/** L'HTML d'une magie (`id` : l'id de sa page) : lié à son mot-clé dans `liens`, affiché par son nom court ; sinon `libelle`. */
export const htmlDeLaMagie = (liens, id, libelle) => htmlDeLaValeur(lienDeLaMagie(liens, id), libelle);

/**
 * L'HTML d'une magie citée sur la page de magie `pageId` : comme htmlDeLaMagie, sauf pour la magie de la page elle-même, qui garde son libellé nu (jamais un
 * lien de la page vers elle-même : le mot-clé d'une magie a l'adresse de sa page).
 */
export const htmlDeLaMagieDeLaPage = (liens, id, libelle, pageId) => (id === pageId ? echapper(libelle) : htmlDeLaMagie(liens, id, libelle));

/**
 * Le lien de la magie nommée `nom` (son nom court : « Feu »), dans `liens` — pour une page que la base ne donne que par le nom d'une magie (le Bestiaire :
 * lib/bestiaire-db.mjs, les magies d'une créature invoquée et la cible d'une résistance écrite) ; null sans magie de ce nom. Le nom d'une magie est unique.
 */
export const lienDeLaMagieNommee = (liens, nom) => Object.values(liens?.magies ?? {}).find((l) => l && l.texte === nom) ?? null;

/** L'HTML d'une magie nommée par son nom court : sa balise, sinon son nom échappé (un nom qui n'est pas celui d'une magie : une altération d'état…). */
export const htmlDeLaMagieNommee = (liens, nom) => htmlDeLaValeur(lienDeLaMagieNommee(liens, nom), nom);

/**
 * Le lien d'une cible de créature (`cible_type`, `cible_degat`, `cible_magie_id` : lib/bestiaire-db.mjs) : un type de dégâts par son identifiant, une magie par
 * son identifiant (`cible_magie_id`) — à défaut, par son nom court `nom` — ; null pour une altération d'état, un texte écrit ou une valeur sans mot-clé.
 */
function lienDeLaCible(x, liens, nom) {
  if (x.cible_type === 'degat') return lienDuTypeDeDegats(liens, x.cible_degat);
  if (x.cible_type !== 'magie') return null;
  return x.cible_magie_id ? lienDeLaMagie(liens, x.cible_magie_id) : lienDeLaMagieNommee(liens, nom);
}

/** L'HTML d'une cible de `defensesParMagie` (`resisteCibles`, `vulnerableCibles` : { nom, cible_type, cible_magie_id, cible_degat }), liée par son identifiant. */
export const htmlDeLaCible = (x, liens) => htmlDeLaValeur(lienDeLaCible(x, liens, x.nom), x.nom);

/**
 * Une résistance ou une immunité écrite d'une créature invoquée (lib/bestiaire-db.mjs#chargerInvocations, `defensesEcrites` : { sens, cible_type, cible_degat,
 * cible, libelle } ; `libelle` : « Résistance : Dégâts de frappe ») : son libellé, dont la cible est liée à son mot-clé quand elle est une valeur fermée — un type
 * de dégâts (`cible_degat`) ou une magie (par son nom) ; une altération d'état, un texte écrit, ou une valeur sans mot-clé (physique, sonore) : le libellé nu.
 */
export function htmlDeLaDefenseDeCreature(x, liens) {
  const cible = typeof x.cible === 'string' ? x.cible : null;
  const lien = lienDeLaCible(x, liens, cible);
  const balise = cible && x.libelle.endsWith(cible) ? baliseDeLaValeur(lien, cible) : null;
  return balise ? `${echapper(x.libelle.slice(0, x.libelle.length - cible.length))}${balise}` : echapper(x.libelle);
}
