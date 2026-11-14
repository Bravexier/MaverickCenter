// Des sections d'une page du guide en onglets (components/guide/PageDuGuide.astro, composant partagé components/Onglets.astro : skill ui-onglets).
// Aujourd'hui : les neuf alignements de la page « Alignement » (migration 0123 ; demande du propriétaire : « Liste les 9 allignements sous forme de
// tableau (ou de tuile) à onglet ou chaque onglet a la couleur de l'alignement »). Le texte de la base n'est ni réécrit ni recopié ici : le déclencheur est
// l'ancre figée (lib/ancres-figees.mjs) d'un intertitre `###` — `### Loyal Bon {#loyal-bon}` —, jamais son texte, qui se renomme sur le site de dev sans
// couper le rattachement (identifiants figés). Les ancres qui font un onglet sont données par l'appelant (les alignements de la palette, avec la classe de
// leur couleur) : ce module ne connaît ni la palette ni les alignements.
// Sans dépendance (sauf lib/ancres-figees.mjs, pur lui aussi).

import { ancreDuTitre } from './ancres-figees.mjs';

const FENCE = /^ {0,3}(`{3,}|~{3,})/;
const TITRE = /^ {0,3}(#{1,6})(?:[ \t]|$)/;
/** Un paragraphe d'une ligne entièrement en gras (« **Une phrase.** ») : ni « ***Exemple :*** » (gras et italique), ni du gras au milieu d'un texte. */
const TOUT_EN_GRAS = /^\*\*(?!\*)(?:(?!\*\*).)+\*\*$/;

/** Les intertitres ATX d'un texte, hors code délimité : [{ ligne (index), niveau, ancre (figée, ou null) }]. */
function intertitresDe(lignes) {
  let fence = null;
  const sortie = [];
  lignes.forEach((ligne, i) => {
    const f = FENCE.exec(ligne);
    if (fence) {
      if (f && f[1][0] === fence[0] && f[1].length >= fence.length && ligne.trim() === f[1]) fence = null;
      return;
    }
    if (f) {
      fence = f[1];
      return;
    }
    const t = TITRE.exec(ligne);
    if (t) sortie.push({ ligne: i, niveau: t[1].length, ancre: ancreDuTitre(ligne)?.ancre ?? null });
  });
  return sortie;
}

/**
 * Le texte d'une page coupé pour les onglets : `ancres` (Set des ancres figées qui font un onglet) ; `niveau` : celui des intertitres des onglets (3).
 * Le groupe commence au premier intertitre de ce niveau dont l'ancre est dans `ancres` et suit tant que les intertitres de niveau 3 ou plus haut sont
 * eux-mêmes des onglets (une ancre déjà prise, ou un autre intertitre de ce niveau ou au-dessus, ferme le groupe). Il en faut au moins deux ; sinon null
 * (la page se rend d'un seul tenant, comme avant).
 *   avant     : le texte au-dessus du premier onglet (l'introduction reste au-dessus de la barre) ;
 *   panneaux  : [{ ancre, markdown }], un par onglet, dans l'ordre du texte, chacun de son intertitre (compris) au suivant ; tout son Markdown est gardé ;
 *   apres     : ce qui suit le groupe — l'intertitre qui le ferme et la suite du texte, précédés d'une phrase de clôture : le dernier paragraphe du dernier
 *               onglet, quand il est entièrement en gras, parle de l'ensemble et non du dernier onglet (règle générale ; sans elle, il resterait caché
 *               tant qu'un autre onglet est ouvert) ;
 *   etiquette : l'ancre du dernier intertitre de `avant` qui en a une, qui nomme la barre d'onglets (aria-labelledby), ou null.
 * Rendre `avant`, chaque `markdown` et `apres` côte à côte, dans cet ordre, redonne le texte de la page : l'éditeur du guide le relit sans perte
 * (lib/markdown-edition.mjs#versMarkdown : la barre porte `data-ed-ignorer`, panneaux et groupe sont transparents).
 */
export function decouperEnOnglets(markdown, ancres, { niveau = 3 } = {}) {
  const lignes = String(markdown ?? '').replace(/\r\n?/g, '\n').split('\n');
  const titres = intertitresDe(lignes);
  const estUnOnglet = (t, prises) => t.niveau === niveau && t.ancre !== null && ancres.has(t.ancre) && !prises.has(t.ancre);
  const premier = titres.findIndex((t) => estUnOnglet(t, new Set()));
  if (premier < 0) return null;
  const prises = new Set();
  const debuts = [];
  let fin = lignes.length;
  for (const t of titres.slice(premier)) {
    if (estUnOnglet(t, prises)) {
      prises.add(t.ancre);
      debuts.push({ ligne: t.ligne, ancre: t.ancre });
    } else if (t.niveau <= niveau) {
      fin = t.ligne;
      break;
    }
  }
  if (debuts.length < 2) return null;
  const panneaux = debuts.map((d, i) => ({
    ancre: d.ancre,
    lignes: lignes.slice(d.ligne, i + 1 < debuts.length ? debuts[i + 1].ligne : fin),
  }));
  // la phrase de clôture : le dernier paragraphe, d'une ligne, entièrement en gras, du dernier onglet (qui garde son intertitre et au moins un autre bloc)
  const dernier = panneaux.at(-1).lignes;
  while (dernier.length && !dernier.at(-1).trim()) dernier.pop();
  const debutDuBloc = dernier.findLastIndex((l) => !l.trim()) + 1;
  let cloture = '';
  const resteDuTexte = dernier.slice(1, debutDuBloc).some((l) => l.trim());
  if (resteDuTexte && dernier.length - debutDuBloc === 1 && TOUT_EN_GRAS.test(dernier[debutDuBloc].trim())) {
    cloture = dernier[debutDuBloc];
    dernier.length = debutDuBloc;
  }
  const avant = lignes.slice(0, debuts[0].ligne);
  const etiquette = intertitresDe(avant).findLast((t) => t.ancre !== null)?.ancre ?? null;
  return {
    avant: avant.join('\n').trim(),
    panneaux: panneaux.map((p) => ({ ancre: p.ancre, markdown: p.lignes.join('\n').trim() })),
    apres: [cloture.trim(), lignes.slice(fin).join('\n').trim()].filter(Boolean).join('\n\n'),
    etiquette,
  };
}

/**
 * Les onglets de la barre dans l'ordre voulu (`ordre` : les ancres, dans l'ordre d'affichage), les panneaux restant dans l'ordre du texte. Une ancre absente
 * de `ordre` suit les autres, dans l'ordre du texte. Rend une copie.
 */
export function dansLOrdre(panneaux, ordre) {
  const rang = new Map([...ordre].map((ancre, i) => [ancre, i]));
  const de = (p) => rang.get(p.ancre) ?? Infinity;
  return [...panneaux].map((p, i) => ({ p, i })).sort((a, b) => de(a.p) - de(b.p) || a.i - b.i).map(({ p }) => p);
}

/** Le texte d'un morceau de HTML sans ses balises (les entités restent écrites : le résultat se pose tel quel en HTML). */
const sansBalises = (html) => html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

/**
 * Le panneau rendu d'un onglet, d'après le HTML de son Markdown : `titre`, le texte de son intertitre `<h3>` tel qu'il est maintenant (le nom se renomme
 * sur le site de dev ; HTML, entités écrites), qui nomme l'onglet ; `html`, le même HTML dont l'intertitre n'a plus son `id` — l'ancre est celle du panneau
 * (`<section id="…">`, que la barre vise), pas deux fois dans la page ; `data-ancre-figee` reste, que l'éditeur relit pour réécrire `{#ancre}`. Sans
 * intertitre `<h3>`, le titre est l'ancre.
 */
export function panneauRendu(html, ancre) {
  let titre = ancre;
  const rendu = String(html ?? '').replace(/<h3\b([^>]*)>([\s\S]*?)<\/h3>/, (_, attributs, contenu) => {
    titre = sansBalises(contenu) || ancre;
    return `<h3${attributs.replace(/\sid="[^"]*"/, '')}>${contenu}</h3>`;
  });
  return { titre, html: rendu };
}
