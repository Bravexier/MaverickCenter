import type { APIRoute } from 'astro';
import { ouvrirBase } from '../lib/donnees.mjs';
import { choixDesCouleurs } from '../lib/glossaire-couleurs.mjs';

// La liste des couleurs du site que propose le choix d'une couleur du mode modification, la même que celle d'un mot-clé du glossaire (lib/glossaire-couleurs.mjs :
// toutes les familles de la palette, groupées, chacune avec sa référence « famille:id », son libellé, sa classe et son fond). Le Glossaire la donne à son script
// (`data-couleurs` de pages/regles/glossaire.astro) ; les autres pages (couleur d'une case de tableau, d'un onglet : src/scripts/edition/couleurs.mjs) la lisent ici, au
// moment où l'on choisit une couleur : une page de contenu n'importe jamais la palette (skill ui-couleurs) ; l'éditeur du site de dev, hors version portable, l'importe (scripts/edition/couleurs.mjs : règle d'une couleur écrite).
export const GET: APIRoute = () => new Response(JSON.stringify(choixDesCouleurs(ouvrirBase())), { headers: { 'Content-Type': 'application/json' } });
