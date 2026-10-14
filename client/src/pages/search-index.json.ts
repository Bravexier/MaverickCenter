import type { APIRoute } from 'astro';
import { TYPES } from '../lib/types.mjs';
import { loadWiki, typeOf } from '../lib/wiki';
import { adresseDePage } from '../lib/metiers.mjs';
import { sansMarqueurs } from '../lib/guide.mjs';
import { ouvrirBase } from '../lib/donnees.mjs';
import { chargerChronologie } from '../lib/chronologie-db.mjs';
import { adresseDEvenement, libelleDeDate } from '../lib/chronologie.mjs';

/** Texte brut approximatif d'une page, pour la recherche plein texte côté navigateur. */
function plainText(body: string) {
  return body
    .replace(/\[\[([^\[\]|]+?)(?:\|([^\[\]]+?))?\]\]/g, (_, target, label) => label ?? target)
    .replace(/[#>*_`|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 4000);
}

export const GET: APIRoute = async () => {
  const { entries } = await loadWiki();
  const index = entries.map((entry) => {
    // chemin relatif à la racine du site ; la page ajoute le préfixe (data-base), le suffixe (data-suffix) puis l'ancre (un métier : sa ligne du tableau)
    const { chemin, ancre } = adresseDePage(entry.id);
    return {
      title: entry.data.title,
      type: TYPES[typeOf(entry)].singular,
      path: chemin,
      ...(ancre && { ancre }),
      summary: entry.data.summary ?? '',
      aliases: entry.data.aliases,
      tags: entry.data.tags,
      text: plainText(sansMarqueurs(entry.body ?? '')),
    };
  });
  // Les événements de la chronologie ne sont pas des pages du wiki (tables evenement, lib/chronologie-db.mjs) : ils sont ajoutés à part, avec le texte
  // de leurs extraits.
  const evenements = chargerChronologie(ouvrirBase());
  for (const e of evenements) {
    index.push({
      title: e.titre,
      type: 'Événement',
      path: adresseDEvenement(e.id),
      summary: libelleDeDate(e),
      aliases: [],
      tags: ['chronologie'],
      text: plainText(e.extraits.map((x: { texte: string }) => x.texte).join(' ')),
    });
  }
  return new Response(JSON.stringify(index), { headers: { 'Content-Type': 'application/json' } });
};
