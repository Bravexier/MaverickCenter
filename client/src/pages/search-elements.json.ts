import type { APIRoute } from 'astro';
import { elementsDesMotsCles } from '../lib/recherche-index';

// Les éléments des mots-clés ancrés (décision R309 §8) : { <id du mot-clé>: { nom, type, adresse?, texte? } }, lus par la vue d'un mot-clé de /recherche/
// (src/scripts/recherche.mjs) en même temps que l'index, et seulement alors : lib/recherche-index.ts#elementsDesMotsCles.
export const GET: APIRoute = async () => new Response(JSON.stringify(elementsDesMotsCles()), { headers: { 'Content-Type': 'application/json' } });
