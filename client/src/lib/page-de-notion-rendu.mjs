// La page d'une notion créée sur le site de dev, avant la refabrication du site (chantier 3 des mots-clés ; R309 (7)) : à son adresse /regles/<slug>/, le
// site construit n'a pas encore son fichier, la page 404 la dessine (src/scripts/edition/nouvelles.mjs, seul à importer ce module). C'est le gabarit de
// components/guide/PageDuGuide.astro pour une page hors du plan : fil d'Ariane vers le Glossaire (lib/livres.mjs#filDAriane), titre modifiable, pas de menu
// latéral. Son texte est la seule ligne du bloc calculé `notion` (lib/guide.mjs#CORPS_D_UNE_PAGE_DE_NOTION) : le bloc se calcule au build, depuis la base,
// il n'a donc rien à montrer ici ; une ligne d'interface le dit.
// Pur : sans dépendance navigateur ni Astro (skill site-version-portable), pour être testé sans les feuilles `?raw` de nouvelles.mjs.
import { attributEd } from './edition-modele.mjs';
import { echapperHtml } from './edition-rendu.mjs';
import { estDansDecouvrir, estDuGuideDuMj, GLOSSAIRE } from './livres.mjs';

/**
 * Vrai si la ligne `page` d'identifiant `id` peut se dessiner en page de notion sur la page 404 : une page `guide/<slug>` qui n'est ni dans Découvrir ni dans le Guide du
 * MJ (listes fixes de lib/livres.mjs). Le plan vivant des onglets des Règles se juge ensuite (nouvelles.mjs#pageDesRegles) : ce qu'il range dans un onglet n'en est pas une.
 */
export const peutEtreUnePageDeNotion = (id) => /^guide\/[a-z0-9-]+$/.test(id) && !estDansDecouvrir(id) && !estDuGuideDuMj(id);

/**
 * Le HTML de la page d'une notion créée : `id` (« guide/<slug> »), `titre` (le nom du mot-clé) et `base` (le préfixe de déploiement, `ed.base`, terminé
 * par « / »). Le corps porte `data-ed-corps` (l'extension `guide` charge la ligne et pose le résumé facultatif) et `data-ed-notion` (l'extension `menus`
 * y pose « Supprimer la page »), sans morceau de texte modifiable : le texte de la page n'est que le bloc.
 */
export function htmlDeLaPageDeNotion({ id, titre, base }) {
  const chemin = `${base}${GLOSSAIRE.chemin}`;
  return `<div class="guide-reference">
    <p class="muted guide-fil"><a href="${echapperHtml(base)}">Accueil</a> › <a href="${echapperHtml(chemin)}">${echapperHtml(GLOSSAIRE.titre)}</a></p>
    <h1 id="guide-titre"><span data-ed="${echapperHtml(attributEd('page', { id }, 'titre'))}">${echapperHtml(titre)}</span></h1>
    <p class="banner" role="note">Page créée sur le site de dev : elle sera construite comme les autres à la prochaine version du site, une fois le journal des
      modifications rapatrié. Vous pouvez déjà changer son titre (crayon).</p>
    <div class="guide-corps" data-ed-corps="${echapperHtml(id)}" data-ed-notion>
      <p class="muted">Le contenu de cette page (définition, type, autres noms, sorts et pages liés) est calculé à la fabrication du site.</p>
    </div>
  </div>`;
}
