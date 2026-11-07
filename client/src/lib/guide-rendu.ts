import { createMarkdownProcessor } from '@astrojs/markdown-remark';
import { buildIndex, remarkWikilinks } from './wikilinks.mjs';
import { remarkCouleursDeCase } from './markdown-couleurs.mjs';
import { remarkMonnaies } from './markdown-monnaies.mjs';
import { remarkAncresFigees } from './ancres-figees.mjs';
import { adresseDesAnciensLiens, avecPrefixe, remarkAnciensLiensDuGuide } from './guide.mjs';
import { ACCUEIL_DU_GUIDE, pagesEclateesDuGuide } from './livres.mjs';
import { cheminDePage } from './metiers.mjs';
import { RENVOIS_DES_PAGES_ECLATEES } from './equipement.mjs';
import { cheminVersUnePageEclatee } from './nav.mjs';
import { loadWiki, slugOf, typeOf } from './wiki';

// Rendu Markdown des pages du guide (lib/guide.mjs) : une page est coupée à ses blocs tirés de la base, chaque morceau de texte est rendu ici
// avec les mêmes plugins ([[liens]], couleur des cases, monnaies, ancres figées des intertitres) que les autres pages (astro.config.mjs), sur l'index des pages chargées (lib/wiki.ts).
// Un lien Markdown écrit vers une ancienne adresse du guide (« [les postures](/guide/les-postures/) ») mène à la nouvelle adresse de la page
// (lib/livres.mjs, par lib/guide.mjs#adresseDesAnciensLiens) et garde l'adresse écrite en `data-lien-ecrit` (lib/guide.mjs#remarkAnciensLiensDuGuide) :
// le texte de la base n'est réécrit ni au rendu ni par l'éditeur du guide, qui la relit (lib/markdown-edition.mjs#versMarkdown). De même, un lien écrit
// vers une page éclatée (l'ancienne page « Équipement », « [armes](/ressources/equipement/#armes) », ou la page « Pièces élémentaires » : 2026-10-29)
// mène à la page de son ancre (lib/nav.mjs#cheminVersUnePageEclatee, lib/equipement.mjs#RENVOIS_DES_PAGES_ECLATEES), sans page 404 : la version portable n'en a
// pas ; de même une ancienne adresse du guide découpée en plusieurs pages (lib/livres.mjs#PAGES_ECLATEES_DU_GUIDE, sans ses cibles absentes : « /decouvrir/creer-son-personnage/#… »,
// « Les situations avancées »), menée selon son ancre avant toute autre règle.

let processeur: ReturnType<typeof createMarkdownProcessor> | undefined;

async function creer() {
  const { entries } = await loadWiki();
  const pages = new Set(entries.map((e) => e.id));
  const index = buildIndex(entries.map((e) => ({ id: e.id, type: typeOf(e), slug: slugOf(e), title: e.data.title, aliases: e.data.aliases })));
  // une cible absente (une page des Règles supprimée sur le site de dev) est sautée : le lien reste tel qu'écrit, la 404 (lib/livres.mjs#pagesEclateesDuGuide)
  const eclatees = { ...RENVOIS_DES_PAGES_ECLATEES, ...pagesEclateesDuGuide((page: string) => pages.has(page)) };
  const adresse = (chemin: string) => {
    const eclatee = cheminVersUnePageEclatee(chemin, eclatees);
    return eclatee !== chemin ? eclatee : adresseDesAnciensLiens(chemin, { cheminDe: cheminDePage, existe: (page: string) => pages.has(page), accueil: ACCUEIL_DU_GUIDE });
  };
  return createMarkdownProcessor({
    syntaxHighlight: false,
    remarkPlugins: [[remarkWikilinks, { index, base: import.meta.env.BASE_URL }], remarkCouleursDeCase, remarkMonnaies, remarkAncresFigees,
      [remarkAnciensLiensDuGuide, { base: import.meta.env.BASE_URL, adresse }]],
  });
}

/** HTML d'un morceau de Markdown. `id` (« guide/le-combat ») sert aux avertissements des liens cassés. */
export async function rendreMarkdown(markdown: string, id: string, status?: string) {
  const rendu = await (processeur ??= creer());
  const { code } = await rendu.render(avecPrefixe(markdown, import.meta.env.BASE_URL), { fileURL: new URL(`file:///${id}.md`), frontmatter: { status } });
  return code;
}

/** HTML d'une phrase de la base qui peut contenir des [[liens]] : sans le paragraphe qui l'entoure. */
export async function rendreLigne(texte: string, id: string) {
  return (await rendreMarkdown(texte, id)).replace(/^<p>([\s\S]*)<\/p>\s*$/, '$1');
}
