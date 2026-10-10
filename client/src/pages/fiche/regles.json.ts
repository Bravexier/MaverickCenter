import type { APIRoute } from 'astro';
import { ouvrirBase } from '../../lib/donnees.mjs';
import { chargerReglesDeFiche } from '../../lib/fiche-regles.mjs';

// Règles de la page /fiche/ (lib/fiche-regles.mjs) : tirées de la base au build, lues par le navigateur (lib/fiche-moteur.mjs).
export const GET: APIRoute = () =>
  new Response(JSON.stringify(chargerReglesDeFiche(ouvrirBase())), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
