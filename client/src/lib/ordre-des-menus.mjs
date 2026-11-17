// L'ordre des menus latéraux et les pages des Règles en mode modification du site de dev (lot de l'édition des menus ; demandes du propriétaire : « En
// mode Edition il faut prévoir de pouvoir changer l'ordre des menu latéraux (par un glisser déposer) », « En mode Edition il faut prévoir aussi de
// pouvoir ajouter / supprimer une page » ; réponses « Règles + Races », « Oui, par une liste », entrées « bientôt » déplaçables, « Pages des Règles »,
// « Titre, onglet, résumé », « Refus si citée, puis 404 »). La logique pure du geste et de l'enregistrement : où va une entrée qu'on glisse ou qu'on
// déplace au clavier, ce qu'on annonce, les opérations `ordonner` d'un lot (serveur/edition-plan.mjs), les entrées d'un menu d'après le plan vivant
// (GET /api/edition/plan/) et leur HTML (celui de components/guide/MenuLateral.astro), l'adresse d'une page créée, le refus d'une suppression.
// Le geste lui-même (Pointer Events, clavier, défilement) est dans src/scripts/edition/glisser.mjs, l'extension dans src/scripts/edition/menus.mjs.
// Sans DOM ni Astro (il entre dans la chaîne de l'édition du navigateur) ; seul import : lib/text.mjs#normalize (l'adresse d'une page, comme le service).
import { normalize } from './text.mjs';

/** Le menu latéral des races (data-ed-menu) ; un menu d'onglet des Règles est `onglet:<id>` (lib/livres.mjs#editionDuMenuLateral). */
export const MENU_DES_RACES = 'races';
/** Les groupes de la liste des races, dans l'ordre du menu (data-ed-groupe ; serveur/edition-plan.mjs#GROUPES_DE_RACES). */
export const GROUPES_DE_RACES = Object.freeze(['pures', 'hybrides']);

/**
 * L'identifiant de l'entrée de menu d'une page (data-ed-entree) : `page:<id>` pour une page du guide (regles_onglet_entree), l'id lui-même pour une
 * race (menu des races). Le libellé d'une entrée de page est le titre de la page : un titre modifié sur le site de dev change son entrée (demande du
 * propriétaire : « Changer le titre avec l'édition devrai aussi changer le nom sur le menu lattéral »).
 */
export const entreeDeLaPage = (id) => (String(id).startsWith('guide/') ? `page:${id}` : String(id));

/** Le menu d'un `data-ed-menu` : { onglet: id } (« onglet:combats »), { races: true } (« races »), ou null. */
export function lireMenu(valeur) {
  const v = String(valeur ?? '');
  if (v === MENU_DES_RACES) return { races: true };
  const m = v.match(/^onglet:([a-z0-9]+(?:-[a-z0-9]+)*)$/);
  return m ? { onglet: m[1] } : null;
}

/** Une copie de `liste` où l'élément d'index `de` est passé à l'index `vers` (bornés à la liste). */
export function deplacer(liste, de, vers) {
  const copie = [...liste];
  if (de < 0 || de >= copie.length) return copie;
  const [x] = copie.splice(de, 1);
  copie.splice(Math.max(0, Math.min(vers, copie.length)), 0, x);
  return copie;
}

/**
 * Les bornes [début, fin] (index compris) du groupe de l'élément `i` : la suite d'éléments voisins de même groupe (`groupes` : le groupe de chaque
 * élément, dans l'ordre ; undefined partout pour un menu d'un seul tenant). Une race ne sort pas du sien (pures, hybrides).
 */
export function bornesDuGroupe(groupes, i) {
  let debut = i;
  let fin = i;
  while (debut > 0 && groupes[debut - 1] === groupes[i]) debut -= 1;
  while (fin < groupes.length - 1 && groupes[fin + 1] === groupes[i]) fin += 1;
  return [debut, fin];
}

/**
 * La place où va l'élément `i` au clavier, dans ses bornes : ↑ (ArrowUp) une place plus haut, ↓ (ArrowDown) une plus bas, Début (Home) la première,
 * Fin (End) la dernière ; null pour une autre touche ou quand l'élément est déjà au bout.
 */
export function placeAuClavier(touche, i, [debut, fin]) {
  const cible = { ArrowUp: i - 1, ArrowDown: i + 1, Home: debut, End: fin }[touche];
  if (cible === undefined) return null;
  const bornee = Math.max(debut, Math.min(fin, cible));
  return bornee === i ? null : bornee;
}

/**
 * Pour mettre l'élément de la place `place` à la place `cible` sans le sortir de la liste (il tient la capture du pointeur : le déplacer la ferait perdre
 * au navigateur, et le geste s'arrêterait après une place), on déplace ses voisins : { sens, debut, fin } — 'avant' : les éléments debut…fin (dans
 * l'ordre) passent devant lui (il descend) ; 'apres' : ils passent derrière lui (il monte). null s'il ne bouge pas. Même résultat que deplacer.
 */
export function voisinsADeplacer(place, cible) {
  if (cible === place) return null;
  return cible > place ? { sens: 'avant', debut: place + 1, fin: cible } : { sens: 'apres', debut: cible, fin: place - 1 };
}

/**
 * La place d'insertion d'un élément glissé parmi les autres éléments de son groupe : `y` la hauteur du pointeur, `milieux` les milieux verticaux de
 * ces autres éléments, dans l'ordre (sans celui qu'on glisse). Rend 0…milieux.length : le nombre de milieux au-dessus du pointeur.
 */
export function placeAuPointeur(y, milieux) {
  let place = 0;
  for (const m of milieux) if (y > m) place += 1;
  return place;
}

/**
 * La vitesse du défilement automatique pendant un glisser (pixels par image) : négative près du haut de la zone qui défile (`haut`, `bas` : ses bords
 * à l'écran), positive près du bas, 0 ailleurs ; plus vite à mesure qu'on approche du bord (`marge` : la bande sensible ; `max` : la vitesse au bord).
 */
export function vitesseDeDefilement(y, haut, bas, { marge = 48, max = 18 } = {}) {
  const bande = Math.min(marge, (bas - haut) / 3);
  if (!(bande > 0)) return 0;
  if (y < haut + bande) return -Math.ceil(max * Math.min(1, (haut + bande - y) / bande));
  if (y > bas - bande) return Math.ceil(max * Math.min(1, (y - (bas - bande)) / bande));
  return 0;
}

/** Ce que lit un lecteur d'écran après un déplacement (zone aria-live) : « « Les dégâts » : place 3 sur 12. » (`place` à partir de 1, dans son groupe). */
export const annonceDeLaPlace = (nom, place, total) => `« ${nom} » : place ${place} sur ${total}.`;

/**
 * Les opérations `ordonner` d'un lot pour les menus que la page a réordonnés (serveur/edition-plan.mjs) : `menus` = [{ menu (data-ed-menu), avant,
 * apres }], `avant` et `apres` : les entrées [{ id, groupe? }] au passage en mode modification et à l'enregistrement. Un menu d'onglet : une opération
 * { op: 'ordonner', onglet, ids } (toutes ses entrées) s'il a changé ; le menu des races : une opération { op: 'ordonner', races: 'pures' | 'hybrides',
 * ids } (tout le groupe) par groupe changé. Rien pour un menu inchangé ou illisible.
 */
export function operationsDOrdre(menus) {
  const memes = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
  const operations = [];
  for (const { menu, avant, apres } of menus) {
    const lu = lireMenu(menu);
    if (!lu) continue;
    if (lu.onglet) {
      const ids = apres.map((e) => e.id);
      if (!memes(avant.map((e) => e.id), ids)) operations.push({ op: 'ordonner', onglet: lu.onglet, ids });
      continue;
    }
    for (const groupe of GROUPES_DE_RACES) {
      const ids = apres.filter((e) => e.groupe === groupe).map((e) => e.id);
      if (!memes(avant.filter((e) => e.groupe === groupe).map((e) => e.id), ids)) operations.push({ op: 'ordonner', races: groupe, ids });
    }
  }
  return operations;
}

/**
 * Les entrées d'un menu d'après le plan vivant (GET /api/edition/plan/, serveur/edition-plan.mjs#planVivant), dans l'ordre : [{ id, rang, groupe,
 * sorte ('page' | 'lien' | 'bientot'), page (l'id de la page, ou null), texte, adresse (relative à la racine du site ; null pour « bientôt ») }].
 * `menu` : { onglet } (ses entrées) ou { races } (les races pures puis hybrides) ; [] pour un onglet absent du plan.
 */
export function entreesDuPlanVivant(plan, menu) {
  if (menu?.races) {
    return GROUPES_DE_RACES.flatMap((groupe) => (plan?.races?.[groupe] ?? []).map((r) => ({
      id: r.id, rang: r.rang_liste ?? null, groupe, sorte: 'page', page: r.id, texte: r.nom, adresse: `${r.id}/`,
    })));
  }
  const onglet = plan?.onglets?.find((o) => o.id === menu?.onglet);
  return (onglet?.entrees ?? []).map((e) => ({
    id: e.id, rang: e.rang ?? null, groupe: undefined, sorte: e.sorte, page: e.page_id ?? null, texte: e.sorte === 'page' ? e.titre : e.libelle,
    adresse: e.sorte === 'bientot' ? null : e.adresse,
  }));
}

/**
 * Le bouton « Supprimer » d'une page des Règles : il manque seulement sur une page protégée (`protection` non vide du plan vivant ;
 * lib/pages-protegees.mjs : « pas de bouton « Supprimer » sur une page dont le site ou d'autres données ont besoin »). Une page citée garde le bouton :
 * le refus du service (409) donne alors la liste des textes qui la citent, à corriger d'abord (décision du leader-technique, réponse du propriétaire
 * « Refus si citée, puis 404 »). Jamais pour un lien ni une entrée « bientôt ».
 */
export const boutonSupprimer = (entree) => entree?.sorte === 'page' && Array.isArray(entree.protection) && entree.protection.length === 0;

/**
 * Une page affichée que le site de dev a supprimée depuis la construction : sa ligne `page` en attente n'a plus de ligne (GET /api/edition/en-attente/ :
 * { table, cle, ligne: null }). Sa page construite reste jusqu'à la reconstruction ; la surcouche y pose un avis (edition/menus.mjs).
 */
export const pageSupprimeeEnAttente = (lignes, id) => Boolean(id) && (lignes ?? []).some((l) => l.table === 'page' && l.cle?.id === id && l.ligne === null);

/** L'id de la race d'un lien vers sa page (« /MaverickCenter/races/elfe-noir/ » → « races/elfe-noir »), ou null. */
export function raceDuLien(href) {
  const m = String(href ?? '').match(/(?:^|\/)races\/([a-z0-9]+(?:-[a-z0-9]+)*)\/?(?:[?#].*)?$/);
  return m ? `races/${m[1]}` : null;
}

/**
 * Les éléments `elements` (chacun avec son `id`, ou null) dans l'ordre de `ordre` (les ids, l'ordre de la liste des races du plan vivant) : ceux
 * que l'ordre connaît, à leur rang ; les autres (la race d'exemple, un id illisible) après, dans leur ordre d'origine. Une nouvelle liste.
 */
export function ordonnerSelon(elements, ordre, idDe = (e) => e.id) {
  const rang = new Map(ordre.map((id, i) => [id, i]));
  const place = (e) => rang.get(idDe(e)) ?? Number.POSITIVE_INFINITY;
  return elements.map((e, i) => ({ e, i })).sort((a, b) => place(a.e) - place(b.e) || a.i - b.i).map(({ e }) => e);
}

/** L'onglet du plan vivant dont une entrée vérifie `test` (une entrée de GET /api/edition/plan/), et cette entrée : { onglet, entree }, ou null. */
export function chercherDansLePlan(plan, test) {
  for (const onglet of plan?.onglets ?? []) {
    const entree = onglet.entrees.find(test);
    if (entree) return { onglet, entree };
  }
  return null;
}

const echapper = (texte) => String(texte ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/**
 * Le HTML d'une entrée du menu latéral (entreesDuPlanVivant), le même que components/guide/MenuLateral.astro : une page ou un lien (`<a
 * class="lateral-menu__lien">`, `aria-current="page"` pour l'entrée affichée), une entrée « bientôt » grisée, sans lien ; avec les attributs du mode
 * modification (data-ed-entree, data-ed-rang, data-ed-groupe). `base` : le préfixe du site (« / », « /MaverickCenter/ »).
 */
export function htmlDUneEntree(e, { base = '/', courante = false } = {}) {
  const attributs = [
    ` data-ed-entree="${echapper(e.id)}"`,
    e.rang === null || e.rang === undefined ? '' : ` data-ed-rang="${echapper(e.rang)}"`,
    e.groupe ? ` data-ed-groupe="${echapper(e.groupe)}"` : '',
  ].join('');
  if (e.sorte === 'bientot') return `<li${attributs}><span class="lateral-menu__bientot nav-soon">${echapper(e.texte)} <small>(bientôt)</small></span></li>`;
  return `<li${attributs}><a class="lateral-menu__lien" href="${echapper(`${base}${e.adresse}`)}"${courante ? ' aria-current="page"' : ''}>${echapper(e.texte)}</a></li>`;
}

/**
 * L'adresse d'une page des Règles créée, relative à la racine du site : `regles/<normalize(titre)>/`, figée (le service la tire du titre de la même façon,
 * serveur/edition-plan.mjs ; il la suffixe -2, -3… si elle est déjà prise) ; null pour un titre sans lettre ni chiffre.
 */
export function adresseDeLaNouvellePage(titre) {
  const slug = normalize(String(titre ?? ''));
  return slug ? `regles/${slug}/` : null;
}

/** L'adresse d'une page créée d'après son id (`crees[0].id` du lot : « guide/<slug> ») : `regles/<slug>/` ; null pour un autre id. */
export const adresseDeLaPageCreee = (id) => (/^guide\/[a-z0-9-]+$/.test(String(id)) ? `regles/${String(id).slice('guide/'.length)}/` : null);

/**
 * Ce qu'on montre d'un refus de suppression (409 du service : `raisons` d'une page protégée, lib/pages-protegees.mjs ; `citations` d'une page citée,
 * lib/citations-db.mjs) : [{ texte, page }] — une raison par ligne (`page` null), ou une page qui cite (son id, pour un lien ; null quand le texte
 * n'est pas sur une page : une légende de la chronologie…), chacune une fois. [] pour un autre refus.
 */
export function elementsDuRefus(corps) {
  if (Array.isArray(corps?.raisons) && corps.raisons.length) return corps.raisons.map((r) => ({ texte: String(r.texte ?? r.raison ?? ''), page: null }));
  if (!Array.isArray(corps?.citations)) return [];
  const vus = new Set();
  const elements = [];
  for (const c of corps.citations) {
    const page = c.page?.id ?? null;
    const texte = c.page?.titre ?? c.libelle ?? page ?? '';
    const cle = page ?? `texte:${texte}`;
    if (vus.has(cle)) continue;
    vus.add(cle);
    elements.push({ texte, page });
  }
  return elements;
}
