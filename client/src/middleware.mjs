// Middleware du site (Astro l'applique à chaque page rendue : au build pour les pages pré-rendues, et à chaque requête sous `astro dev`) : les balises du
// glossaire des mots-clés (« {{recharge-longue}} », « {{non-mort|non-morts}} », « {{mordhau:}} » ; demande du propriétaire du 2026-10-16 : « Partout où
// un mot-clé est utilisé, il sera affiché en gras. Une infobulle de sa définition sera visible », sur tout le site) rendues dans le HTML de la page, avec
// une bulle par mot-clé employé avant </body> (lib/mots-cles-balises.mjs#pageAvecMotsCles ; docs/content-guide.md, « Mots-clés (glossaire) »). Le
// vocabulaire est celui de la base construite (lib/mots-cles-db.mjs), lu une fois par processus. Seules les réponses HTML sont lues (pas les
// points d'accès JSON, images, base : la recherche et la fiche retirent elles-mêmes les balises de leurs textes) ; une page sans balise passe telle quelle.
// La version portable (tools/build-artifact.mjs) est construite de même. Sur le site de dev, le HTML qu'un script pose après le chargement (rendus du
// mode modification, cartes rendues par le service) reçoit ses mots-clés de src/scripts/edition/mots-cles-vivants.mjs, d'après le vocabulaire vivant.
import { ouvrirBase } from './lib/donnees.mjs';
import { pageAvecMotsCles } from './lib/mots-cles-balises.mjs';
import { chargerVocabulaire } from './lib/mots-cles-db.mjs';

let vocabulaire = null;
/** Le vocabulaire de la base construite (lu au premier besoin, une fois). */
const vocabulaireDuSite = () => (vocabulaire ??= chargerVocabulaire(ouvrirBase()));

/**
 * La réponse de `suite()` (la page rendue par Astro) avec ses mots-clés rendus : une réponse qui n'est pas du HTML est rendue telle quelle, sans être lue.
 * `lireVocabulaire` : le vocabulaire ([{ id, libelle, description }]) ou une fonction qui le rend (appelée seulement si la page a une balise).
 * @param {() => Promise<Response>} suite
 */
export async function reponseAvecMotsCles(suite, lireVocabulaire = vocabulaireDuSite) {
  const reponse = await suite();
  if (!(reponse instanceof Response) || !/^text\/html\b/i.test(reponse.headers.get('content-type') ?? '')) return reponse;
  const html = await reponse.text();
  const init = { status: reponse.status, statusText: reponse.statusText, headers: new Headers(reponse.headers) };
  init.headers.delete('content-length');
  if (!html.includes('{{') && !html.includes('data-bulle="mot-cle-')) return new Response(html, init);
  const v = typeof lireVocabulaire === 'function' ? lireVocabulaire() : lireVocabulaire;
  return new Response(pageAvecMotsCles(html, v), init);
}

export const onRequest = (_contexte, suite) => reponseAvecMotsCles(suite);
