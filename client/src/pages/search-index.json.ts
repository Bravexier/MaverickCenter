import type { APIRoute } from 'astro';
import { indexDeRecherche } from '../lib/recherche-index';

// L'index de la recherche (/recherche/, src/scripts/recherche.mjs) : pages du wiki (avec leurs mots-clés) et événements de la chronologie (avec le nom de leurs catégories) : lib/recherche-index.ts.
export const GET: APIRoute = async () => new Response(JSON.stringify(await indexDeRecherche()), { headers: { 'Content-Type': 'application/json' } });
