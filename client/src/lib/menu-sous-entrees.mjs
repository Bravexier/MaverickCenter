// Les sous-entrées du menu latéral du site (R321, refonte du menu, lot 2) : les menus qu'une page avait à côté de celui du site y sont imbriqués, par étapes.
// Étape 1 : les pages de chaque onglet des Règles (le plan de la base, lib/livres.mjs#entreesDuMenuLateral) ; étape 2 : les races (lib/race-kinds.mjs#groupRaces).
// Pur, sans DOM ni Astro ni base : les entrées arrivent déjà chargées (lib/menu-sous-entrees-site.ts les tire du wiki), le HTML est celui de lib/menu-rendu.mjs.
//
// Une sous-entrée a la forme d'une entrée résolue de lib/menu-db.mjs (`href` relatif à la racine du site, `libelle`, `bientot`, `motCle` null, `enfants` []), plus
// `edition` ({ id, rang, groupe? } : la ligne du menu, que lit le mode modification de scripts/edition/menus.mjs, R321 (3)). L'entrée qui les porte garde son lien
// (R321 (1)) et reçoit `enfants` et `sousMenu` (le `data-ed-menu` de la liste : `onglet:<id>`, `races`).
// Les entrées de lib/nav.mjs désignent ce qu'elles portent : `onglet` (l'id d'un onglet des Règles, déjà là) ou `sous` (`races`).
import { editionDuMenuLateral, entreesDuMenuLateral, ongletsDesRegles } from './livres.mjs';
import { cheminDePage } from './metiers.mjs';
import { groupRaces } from './race-kinds.mjs';

/**
 * Les sous-entrées d'un menu d'onglet des Règles : `pages` (lib/livres.mjs#entreesDuMenuLateral : une page `{ id, data: { title } }`, un lien `{ libelle, adresse }`,
 * une entrée « bientôt » `{ bientot }`), `edition` (lib/livres.mjs#editionDuMenuLateral : `entrees`, une par page, dans le même ordre ; sans, aucun attribut).
 */
export function sousEntreesDesPages(pages, edition = null) {
  return (pages ?? []).map((p, i) => {
    const ligne = edition?.entrees?.[i];
    const commun = { motCle: null, enfants: [], ...(ligne ? { edition: { id: ligne.id ?? null, rang: ligne.rang ?? null, ...(ligne.groupe ? { groupe: ligne.groupe } : {}) } } : {}) };
    if ('bientot' in p) return { ...commun, href: null, bientot: true, libelle: String(p.bientot) };
    if ('adresse' in p) return { ...commun, href: p.adresse, bientot: false, libelle: String(p.libelle) };
    return { ...commun, href: cheminDePage(p.id), bientot: false, libelle: p.data.title };
  });
}

/**
 * Les sous-entrées des races : `groupes` (lib/race-kinds.mjs#groupRaces : [{ key, entries }], les pures puis les hybrides, chaque groupe dans l'ordre de la liste
 * /races/), `rangDe(id)` (le rang de la race dans la liste, race.rang_liste, ou null). Une seule liste, sans titre de groupe ; le groupe n'est que dans `edition`,
 * où une race reste dans le sien.
 */
export function sousEntreesDesRaces(groupes, rangDe = () => null) {
  return (groupes ?? []).flatMap((g) => g.entries.map((r) => ({
    motCle: null, enfants: [], href: cheminDePage(r.id), bientot: false, libelle: r.data.title, edition: { id: r.id, rang: rangDe(r.id), groupe: g.key },
  })));
}

/**
 * Les sous-entrées des magies : `magies` [{ id, nom, classe }] (dans l'ordre du classeur, `magie.ordre` ; `classe` : celle de la palette, `couleur-magie-<id>`,
 * lib/palette-css.mjs#classeDeMagie, dont le point du menu prend la couleur). Chacune porte `page` (son id : les ancres propres à la page s'y posent, poserLesAncres)
 * et `cle` (le nom de son état replié, quand elle porte ces ancres). Aucun menu modifiable (`sousMenu` absent : l'ordre des magies n'est pas modifiable).
 */
export function sousEntreesDesMagies(magies) {
  return (magies ?? []).map((m) => ({
    motCle: null, enfants: [], href: cheminDePage(m.id), bientot: false, libelle: m.nom, classe: m.classe, page: m.id, cle: m.id.replace(/[^a-z0-9]+/g, '-'),
  }));
}

/**
 * Les sous-entrées des classes (R321, étape 4) : `groupes` (lib/class-groups.mjs#groupClasses, chacun avec `classe`, celle de sa catégorie dans la palette, lib/palette-css.mjs#
 * classeDeCategorie) : un sous-groupe repliable par catégorie, sans lien (une catégorie n'a pas de page ; `repliee` : repliée au départ sauf si la classe courante y est ; `accordeon` : une seule catégorie ouverte à la fois, R321 (6)), ses classes dessous,
 * les sections de la catégorie à plat (la seule section nommée est celle des classes non classées, de la dernière catégorie). Chaque classe porte `page` (son id) et `cle` : les
 * sections de la page, en ancres sous la classe affichée (poserLesAncres, lib/classe-ancres.mjs).
 */
export function sousEntreesDesClasses(groupes) {
  return (groupes ?? []).map((g) => ({
    motCle: null, href: null, bientot: false, libelle: g.label, classe: g.classe, cle: `classes-${g.key}`, repliee: true, accordeon: 'classes',
    // `page` et `cle` : les ancres propres à la page (R321 (6) : les sections d'une classe) se posent sous la classe affichée, comme celles d'une magie (poserLesAncres) ;
    // `cle` en `classe-<slug>` (au singulier : jamais celle d'une catégorie, `classes-<clé>`)
    enfants: g.sections.flatMap((s) => s.entries).map((e) => ({
      motCle: null, enfants: [], href: cheminDePage(e.id), bientot: false, libelle: e.data.title, page: e.id, cle: `classe-${e.id.slice(e.id.indexOf('/') + 1).replace(/[^a-z0-9]+/g, '-')}`,
    })),
  }));
}

/**
 * Les ancres propres à une page (R321 (2) et (6) : « n'apparaissent que sur leur page » : une magie, une classe) : `ancres` [{ ancre: '#presentation', libelle }] devient les sous-entrées de l'entrée
 * dont `page` est l'id de la page courante (la magie ou la classe affichée) ; rien ailleurs. Une ancre garde ses `enfants` (R321 (6) : les spécialités, sous-ancres de « Dons »,
 * lib/classe-ancres.mjs#ancresDesSections). Rend de nouvelles entrées ; sans entrée à cet id ou sans ancre, les entrées telles quelles.
 */
export function poserLesAncres(entrees, page, ancres) {
  if (!page || !(ancres?.length > 0)) return entrees;
  const enfantsDe = (liste) => liste.map((a) => ({ motCle: null, bientot: false, href: null, ancre: a.ancre, libelle: a.libelle, enfants: enfantsDe(a.enfants ?? []) }));
  const enfants = enfantsDe(ancres);
  const poser = (e) => (e.page === page ? { ...e, enfants } : e.enfants?.length > 0 ? { ...e, enfants: e.enfants.map(poser) } : e);
  return (entrees ?? []).map(poser);
}

/**
 * Les `entrees` (résolues : lib/menu-db.mjs#menuDuSite) avec leurs sous-entrées posées : `parOnglet` { <id d'onglet>: { menu, enfants } } pour une entrée qui a `onglet`,
 * `parSource` { <nom>: { menu, enfants } } pour une entrée qui a `sous`. Une liste vide ne pose rien (pas de chevron). Les entrées qui ont déjà des `enfants`
 * (Introduction) sont parcourues, jamais remplacées. Rend de nouvelles entrées ; celles de départ ne changent pas.
 */
export function poserLesSousEntrees(entrees, { parOnglet = {}, parSource = {} } = {}) {
  const poser = (e) => {
    const source = (typeof e.onglet === 'string' && parOnglet[e.onglet]) || (typeof e.sous === 'string' && parSource[e.sous]) || null;
    if (source?.enfants?.length && !(e.enfants?.length > 0)) return { ...e, enfants: source.enfants, ...(source.menu ? { sousMenu: source.menu } : {}) };
    return e.enfants?.length > 0 ? { ...e, enfants: e.enfants.map(poser) } : e;
  };
  return (entrees ?? []).map(poser);
}

/**
 * Ce que le site tire de la base pour les sous-entrées : { parOnglet, parSource } (la forme de poserLesSousEntrees), d'après `entries` (les pages chargées,
 * lib/wiki.ts#loadWiki), le plan des onglets installé (lib/livres.mjs#installerLePlan), `ordreDesRaces` (le comparateur de la liste /races/, lib/races.ts#ordreDeLaListeDesRaces)
 * `rangDe(id)` (race.rang_liste, lib/races.ts#rangDansLaListe) `magies` ([{ id, nom, classe }], sousEntreesDesMagies) et `groupesDeClasses` (sousEntreesDesClasses).
 */
export function sousEntreesDuSite({ entries, ordreDesRaces, rangDe, magies = [], groupesDeClasses = [] }) {
  const parOnglet = {};
  for (const onglet of ongletsDesRegles()) {
    const edition = editionDuMenuLateral(onglet, entries);
    parOnglet[onglet.id] = { menu: edition.menu, enfants: sousEntreesDesPages(entreesDuMenuLateral(onglet, entries), edition) };
  }
  return {
    parOnglet,
    parSource: {
      races: { menu: 'races', enfants: sousEntreesDesRaces(groupRaces(entries, ordreDesRaces), rangDe) },
      magies: { menu: null, enfants: sousEntreesDesMagies(magies) },
      classes: { menu: null, enfants: sousEntreesDesClasses(groupesDeClasses) },
    },
  };
}
