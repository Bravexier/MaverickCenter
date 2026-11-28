// Les entrées du menu du site résolues d'après la base (refonte du menu en cinq rubriques, lot 1 ; réponses du propriétaire du 2026-11-27, R319).
//
// lib/nav.mjs (pur, sans import : le script de la page 404 l'importe) écrit l'arborescence du menu ; ce module la lit dans la base du site. Une entrée de
// nav.mjs a la forme (le contrat que ce module fixe) :
//   { label, path?, motCle?, libelleArbo?, onglet?, enfants?: [entrée], devSeulement?, prodSeulement?, niveau?, … }
//   - `label`        le libellé écrit dans nav.mjs : le repli, et le libellé voulu quand `libelleArbo` est vrai ;
//   - `path`         le chemin écrit dans nav.mjs, relatif à la racine du site, sans préfixe de déploiement ni barre initiale (« regles/combats/ ») : le
//                    repli d'une entrée sans mot-clé (« Lien direct en attendant ») ; sans `path` ni adresse lue, l'entrée est « bientôt » ;
//   - `motCle`       l'id entier figé d'une ligne de `mot_cle` (migration 0113) : l'entrée prend son adresse (`url`), son libellé et son habillage ;
//   - `libelleArbo`  vrai : le libellé de `label` l'emporte sur celui du mot-clé (« Nom de l'arborescence » : dix entrées, dont le mot-clé ou l'onglet a un autre
//                    libellé) ; absent ou faux : l'entrée suit le libellé du mot-clé, renommer la page renomme l'entrée (« Tout, libellé compris ») ;
//   - `onglet`       l'id d'un onglet des Règles (`regles_onglet.id`) : son libellé est `regles_onglet.titre` (modifiable sur le site de dev, R319) et son
//                    adresse `adresseDeLOnglet` (lue ici, jamais recopiée : un lot à part la fera suivre le titre) ;
//   - `enfants`      les entrées de dessous, résolues de même ;
//   - tout autre champ (`key`, `devSeulement`, `prodSeulement`, `niveau`, `autres`…) est recopié tel quel dans l'entrée résolue.
// Une entrée résolue : { …les champs recopiés, href, libelle, bientot, motCle, enfants } :
//   - `href`     relatif à la racine du site, sans préfixe de déploiement ni barre initiale, avec son ancre ou sa requête s'il en a (« races/ ») ; null quand
//                l'entrée est « bientôt ». Le préfixe de déploiement s'ajoute à l'affichage (`base` + href) ;
//   - `libelle`  le texte à afficher (règle ci-dessus) ;
//   - `bientot`  vrai quand `href` est null (entrée grisée, sans lien) ;
//   - `motCle`   null sans mot-clé (absent de la base compris : repli sur `path`, jamais d'erreur) ; sinon { id, cle, libelle (celui du mot-clé), couleur,
//                icone, description (la définition montrée par sa bulle : la sienne, sinon le texte de son élément, lib/mots-cles-balises.mjs#
//                definitionDuMotCle ; null sans), url, classe (celle de sa couleur, lib/mots-cles-liens.mjs#classeDuMotCle, null sans couleur), iconeHtml
//                (son dessin, lib/mots-cles-balises.mjs#htmlDeLIcone, '' sans icône), bulle (l'id de sa bulle, `mot-cle-<clé>`, null sans définition) } ;
//   - `enfants`  les entrées résolues de dessous ([] sans).
// Habillage (« l'entrée s'affiche comme un mot-clé dans un texte : sa couleur, son icône et son infobulle quand il en a ») : `htmlDeLEntree` rend le
// lien exactement comme un mot-clé balisé d'un texte (lib/mots-cles-balises.mjs#htmlDeLaBalise : `a.mot-cle` + classe de couleur + icône + `data-bulle`,
// dont le middleware pose la bulle avant </body>) ; celui qui dessine l'entrée à sa façon prend `motCle.classe`, `motCle.iconeHtml` et `motCle.bulle`.
// Lu au build (la base construite, lib/donnees.mjs) ; sans dépendance navigateur ni Astro.
import { ouvrirBase } from './donnees.mjs';
import { htmlDeLaBalise, htmlDeLIcone, idDeBulle, definitionDuMotCle, vocabulaireDesMotsCles } from './mots-cles-balises.mjs';
import { chargerVocabulaire, motsClesDeLaBase } from './mots-cles-db.mjs';
import { classeDuMotCle } from './mots-cles-liens.mjs';

const tableExiste = (db, nom) => Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(nom));

/**
 * L'adresse d'un onglet des Règles, relative à la racine du site (`regles/<id>/`) : le seul endroit qui la compose. Un onglet qui porterait une adresse
 * à lui (`adresse`, quand un lot à part fera suivre l'adresse le titre) la donne telle quelle.
 */
export const adresseDeLOnglet = (onglet) => (typeof onglet?.adresse === 'string' && onglet.adresse ? onglet.adresse : `regles/${onglet.id}/`);

/** L'adresse d'un mot-clé (`url`, « /races/ ») sans sa barre initiale, comme le `path` de nav.mjs ; null sans adresse. */
const href = (url) => (typeof url === 'string' && url ? url.replace(/^\//, '') : null);

/** Une collection d'éléments (liste, Map ou itérable) en Map indexée par `cle(élément)`. */
function indexer(collection, cle) {
  if (collection instanceof Map) return collection;
  return new Map([...(collection ?? [])].map((x) => [cle(x), x]));
}

/** Le mot-clé résolu d'une entrée (la forme décrite en tête), à partir de sa ligne du vocabulaire. */
function motCleResolu(m) {
  const description = definitionDuMotCle(m) ?? null;
  return {
    id: m.id,
    cle: m.cle,
    libelle: m.libelle,
    couleur: m.couleur ?? null,
    icone: m.icone ?? null,
    description,
    url: typeof m.url === 'string' && m.url ? m.url : null,
    classe: classeDuMotCle(m),
    iconeHtml: htmlDeLIcone(m.icone ?? null),
    bulle: description ? idDeBulle(m.cle) : null,
  };
}

/**
 * Les entrées `entrees` (la forme décrite en tête) résolues d'après `motsCles` ([{ id, libelle, cle, description?, url?, couleur?, icone?, element? }] :
 * lib/mots-cles-db.mjs#motsClesDeLaBase, ou une Map par id) et `onglets` ([{ id, titre }] : `regles_onglet`, ou une Map par id). Pure, sans base ni cache.
 * Un mot-clé, un onglet ou une adresse absents ne lèvent rien : l'entrée garde son `label` et son `path`, ou devient « bientôt ».
 */
export function resoudreLesEntrees(entrees, { motsCles = [], onglets = [] } = {}) {
  const parId = indexer(motsCles, (m) => m.id);
  const parOnglet = indexer(onglets, (o) => o.id);
  const resoudre = (e) => {
    const { label, path, motCle: idDuMotCle, libelleArbo, enfants, ...reste } = e ?? {};
    const m = Number.isInteger(idDuMotCle) ? parId.get(idDuMotCle) ?? null : null;
    const onglet = typeof reste.onglet === 'string' ? parOnglet.get(reste.onglet) ?? null : null;
    // l'adresse : celle de l'onglet, sinon celle du mot-clé, sinon le chemin écrit dans nav.mjs (un mot-clé absent ou sans adresse ne lève rien)
    const adresse = (onglet ? adresseDeLOnglet(onglet) : null) ?? href(m?.url) ?? (typeof path === 'string' && path ? path : null);
    // le libellé : celui de l'arborescence quand `libelleArbo`, sinon celui de l'onglet, puis celui du mot-clé, puis le repli
    const libelle = libelleArbo === true ? label : onglet?.titre ?? m?.libelle ?? label;
    return {
      ...reste,
      href: adresse,
      libelle: String(libelle ?? ''),
      bientot: adresse === null,
      motCle: m ? motCleResolu(m) : null,
      enfants: (enfants ?? []).map(resoudre),
    };
  };
  return (entrees ?? []).map(resoudre);
}

/**
 * Ce que la base donne au menu : { motsCles (lib/mots-cles-db.mjs#motsClesDeLaBase, relus à chaque appel sauf si `motsCles` est passé), onglets
 * ([{ id, titre }] de regles_onglet, dans l'ordre de leur `ordre` ; [] pour une base sans la table) }. Lecture seule.
 * @param {import('node:sqlite').DatabaseSync} db
 */
export function donneesDuMenu(db, { motsCles = motsClesDeLaBase(db) } = {}) {
  const onglets = tableExiste(db, 'regles_onglet') ? db.prepare('SELECT id, titre FROM regles_onglet ORDER BY ordre, id').all().map((o) => ({ ...o })) : [];
  return { motsCles, onglets };
}

/** Les entrées résolues d'après la base `db` (donneesDuMenu, resoudreLesEntrees). */
export const lireLeMenu = (db, entrees, options = {}) => resoudreLesEntrees(entrees, donneesDuMenu(db, options));

const menus = new WeakMap(); // entrées de nav.mjs -> entrées résolues (la base construite ne change pas pendant le build)
/**
 * Les entrées résolues d'après la base construite (lib/donnees.mjs#ouvrirBase, comme lib/couleur-de-la-page.mjs#cssDesMotsClesDuSite) : lues une fois par
 * liste d'entrées (la même constante de nav.mjs à chaque page), le vocabulaire étant celui que le middleware et les pages partagent
 * (lib/mots-cles-db.mjs#chargerVocabulaire). À appeler avec la liste d'entrées d'UNE rubrique ou d'UN bloc, jamais avec `NAV` (ses éléments sont des rubriques, dont `items` ne serait pas résolu) : `menuDuSite(g.items)` dans layouts/Base.astro, `menuDuSite(bloc)` dans components/MenuDuProfil.astro.
 */
export function menuDuSite(entrees) {
  if (!menus.has(entrees)) {
    const db = ouvrirBase();
    menus.set(entrees, lireLeMenu(db, entrees, { motsCles: chargerVocabulaire(db) }));
  }
  return menus.get(entrees);
}

/** `x` sans ce qui casserait une balise écrite (« { », « } », « | » et retours à la ligne) : le texte d'un lien n'en a pas besoin. */
const sansSyntaxe = (x) => String(x).replace(/[{}|\n]+/g, ' ').replace(/\s+/g, ' ').trim();

/**
 * Le HTML du lien d'une entrée résolue, rendu comme la balise d'un mot-clé dans un texte (lib/mots-cles-balises.mjs#htmlDeLaBalise, la seule logique de ce
 * lien) : `a.mot-cle` vers `base` + `href` avec la classe de sa couleur, son icône et `data-bulle` (la bulle, posée par le middleware, vient du
 * vocabulaire complet) ; `strong.mot-cle` quand l'entrée est « bientôt » ou, plus largement, sans adresse. Le texte est `libelle` (celui de
 * l'arborescence quand il diffère de celui du mot-clé : balise `{{clé|libellé}}`, `data-balise`). Rend { html, id } comme htmlDeLaBalise (id : l'id du
 * mot-clé dont la bulle est à poser, null sans) ; null pour une entrée sans mot-clé (c'est à l'appelant de dessiner un lien direct).
 * `base` : le préfixe de déploiement (import.meta.env.BASE_URL) ; `sansLien`, `sansBulle`, `sansFocus` : comme htmlDeLaBalise (le lien d'un menu est déjà
 * un lien : le mettre dans un élément qui en est un demande `sansLien`).
 */
export function htmlDeLEntree(entree, { base = '/', ...contexte } = {}) {
  const m = entree?.motCle;
  if (!m) return null;
  const memeLibelle = entree.libelle === m.libelle;
  const texte = memeLibelle ? null : sansSyntaxe(entree.libelle) || null;
  const brut = texte === null ? `{{${m.cle}}}` : `{{${m.cle}|${texte}}}`;
  // le mot-clé tel que le vocabulaire le porte, avec l'adresse de l'entrée (celle du mot-clé, ou le chemin écrit quand le mot-clé n'en a pas)
  const vocabulaire = vocabulaireDesMotsCles([{ id: m.id, libelle: m.libelle, cle: m.cle, description: m.description, couleur: m.couleur, icone: m.icone, url: entree.href === null ? null : `/${entree.href}` }]);
  return htmlDeLaBalise({ brut, ref: m.cle, texte, separateur: texte === null ? null : '|', complet: false }, vocabulaire, { base, ...contexte });
}
