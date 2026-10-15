import type { APIRoute } from 'astro';
import { modeleXlsx } from '../../lib/fiche-modele.mjs';

// Le modèle « Fiche-de-personnage-Maverick-V15.2.2 ordinateur » (lib/fiche-modele.mjs), assemblé au build depuis client/src/modeles/fiche-personnage :
// la page /fiche/ le remplit pour exporter une fiche (lib/tableur-ecriture.mjs) et y relit le logo à l'import.
export const GET: APIRoute = async () =>
  new Response(await modeleXlsx(), { headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' } });
