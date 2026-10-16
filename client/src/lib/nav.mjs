// Arborescence du menu principal (deux lignes). Module pur, sans dépendance Astro/navigateur.
// Ligne 1 = les rubriques (`NAV`), ligne 2 = les `items` de la rubrique sélectionnée.
// `path` : chemin relatif du site (sans préfixe de déploiement). Sans `path`, l'entrée est affichée
// grisée « bientôt » : la page n'existe pas encore (on n'invente pas de contenu).
// `autres` : débuts d'adresse des pages de la rubrique qui ne sont pas dans le menu (une page de `ressources/` ouvre les Ressources).
// `devSeulement` : une entrée du site de dev seulement, absente du menu en production (entreesDuMenu).
// Arborescence voulue par le propriétaire du projet (pas de barre de recherche dans l'en-tête : la recherche est une page, avec les mots-clés).
// « Équipement » (demandes du propriétaire, 2026-10-16 : « J'aimerai fusionner "Armes" et "Armures" dans un seule onglet : "Equipement" »,
// « J'aimerai rajouter un 5 onglet pour y déplacer les accessoires ») : cinq onglets, Armes, Armures, Boucliers, Bâtons magiques, Accessoires
// (lib/equipement.mjs). « Objets à la ceinture » : potions, huiles, carquois et sacs (décision R81) ; les bâtons magiques, qui vont aussi à la
// ceinture, sont l'onglet Bâtons magiques de « Équipement », où la page renvoie. Le bouclier ne va pas à la ceinture, son emplacement est dans
// l'armure (décision R82) : c'est l'onglet Boucliers de « Équipement ».
export const NAV = [
  {
    key: 'regles',
    label: 'Règles',
    autres: ['capacites/'],
    items: [
      { label: 'Guide', path: 'guide/' },
      { label: 'Races', path: 'races/' },
      { label: 'Magies', path: 'magies/' },
      { label: 'Classes', path: 'classes/' },
      { label: 'Métiers', path: 'metiers/' },
    ],
  },
  {
    key: 'ressources',
    label: 'Ressources',
    autres: ['ressources/'],
    items: [
      { label: 'Équipement', path: 'ressources/equipement/' },
      { label: 'Composants', path: 'ressources/composants/' },
      { label: 'Objets à la ceinture', path: 'ressources/objets-a-la-ceinture/' },
      { label: 'Livres & Parchemins', path: 'ressources/livre-parchemin/' },
      { label: 'Pièces élémentaires', path: 'ressources/pieces-elementaires/' },
    ],
  },
  {
    key: 'personnages',
    label: 'Personnages',
    items: [
      { label: 'Fiche de personnage', path: 'fiche/' },
      { label: 'Listes', path: 'personnages/' },
      { label: 'Groupes' },
      { label: 'Chroniques' },
    ],
  },
  {
    key: 'codex',
    label: 'Codex',
    autres: ['bestiaire/', 'lore/', 'cartes/'],
    // Mythologie et Factions : les sommaires des parties « Les Divinités » et « Temples/Cultes/Guildes » du Google Doc « CODEX Maverick » (docs/codex.md) ;
    // Chronologie : les événements datés du Codex et des races, une page par événement (lib/chronologie.mjs, docs/chronologie.md)
    items: [
      { label: 'Chronologie', path: 'chronologie/' },
      { label: 'Carte & lieux' },
      { label: 'Mythologie', path: 'lore/les-divinites/' },
      { label: 'Bestiaire', path: 'bestiaire/' },
      { label: 'Factions', path: 'lore/temples-cultes-guildes/' },
    ],
  },
  {
    key: 'outils',
    label: 'Outils',
    autres: ['pages/', 'donnees/'],
    items: [
      { label: 'Statistiques' },
      { label: 'Mise à jour', path: 'mise-a-jour/' },
      { label: 'Boîte à idée' },
      { label: 'Galeries', path: 'galeries/' },
      { label: 'Recherche', path: 'recherche/' },
      { label: 'Archives', path: 'archives/' },
      // Debug (demande du propriétaire : « visible uniquement sur le serveur dev ») : système, performances, journaux du service et schéma de la base
      // (pages/debug.astro) ;
      // `devSeulement` : hors du menu d'un build de production (SITE_MODE=prod) et de la version portable (entreesDuMenu, layouts/Base.astro)
      { label: 'Debug', path: 'debug/', devSeulement: true },
    ],
  },
];

/**
 * Les entrées d'une rubrique à afficher : sans celles du site de dev seulement (`devSeulement`) quand `dev` est faux (build de production,
 * version portable).
 */
export function entreesDuMenu(group, { dev = true } = {}) {
  return group.items.filter((i) => dev || !i.devSeulement);
}

/** Tous les chemins référencés par le menu. */
export function navPaths(nav = NAV) {
  return nav.flatMap((g) => g.items.map((i) => i.path)).filter(Boolean);
}

/** Vrai si `pathname` (avec préfixe de déploiement `base`) est dans la section d'un groupe : une de ses entrées, ou une de ses `autres` pages. */
export function groupIsCurrent(group, pathname, base = '/') {
  const prefix = base.replace(/\/$/, '') + '/';
  const rel = pathname.startsWith(prefix) ? pathname.slice(prefix.length) : pathname.replace(/^\//, '');
  return [...group.items.map((i) => i.path), ...(group.autres ?? [])].some((debut) => debut && rel.startsWith(debut));
}

/** Rubrique à ouvrir pour cette page : celle de la page, sinon la première (accueil, page 404…). */
export function activeGroup(pathname, base = '/', nav = NAV) {
  return nav.find((g) => groupIsCurrent(g, pathname, base)) ?? nav[0];
}

/**
 * Nouvelle adresse d'une ancienne adresse du wiki : les pages étaient sous `/wiki/` (`/wiki/races/elfe/` → `/races/elfe/`),
 * l'index du wiki était `/wiki/` (→ `/pages/`). `null` si `pathname` n'est pas une ancienne adresse. Lu par la page 404.
 */
export function legacyWikiRedirect(pathname, base = '/') {
  const root = base.replace(/\/$/, '') + '/';
  const old = `${root}wiki`;
  if (pathname !== old && !pathname.startsWith(`${old}/`)) return null;
  // les barres en tête du reste retirées : « /wiki//autre.site/ » donnerait « //autre.site/ », une adresse hors du site
  return root + (pathname.slice(old.length + 1).replace(/^\/+/, '') || 'pages/');
}

/**
 * Pages renommées (demande du propriétaire) : ancienne adresse → nouvelle, relatives à la racine du site. La liste des mots-clés est dans la
 * recherche ; les pages « Armes », « Armures », « Bouclier », « Bâton magique » et « Accessoires » sont les onglets de la page « Équipement »
 * (lib/equipement.mjs, lib/metiers.mjs#adresseDePage : test/equipement.test.mjs vérifie que les deux listes s'accordent ; nav.mjs n'importe rien, le
 * script de la page 404 l'importe).
 */
// « guide/statistiques-resistance-faiblesse/ » recopiait le tableau des combinaisons de deux magies de l'onglet « Statistiques », ignoré (décisions R85,
// R86, migration 0049) : les relations des magies sont sous la carte de /magies/.
export const PAGES_RENOMMEES = {
  'generateur/': 'fiche/', 'tags/': 'recherche/', 'guide/statistiques-resistance-faiblesse/': 'magies/',
  'ressources/armes/': 'ressources/equipement/#armes', 'ressources/armures/': 'ressources/equipement/#armures',
  'ressources/bouclier/': 'ressources/equipement/#boucliers', 'ressources/baton-magique/': 'ressources/equipement/#batons-magiques',
  'ressources/accessoires/': 'ressources/equipement/#accessoires',
};

/**
 * Nouvelle adresse d'une ancienne adresse du site : les pages du wiki sous `/wiki/` (legacyWikiRedirect), les pages renommées (le générateur
 * `/generateur/` est devenu la fiche `/fiche/`, la liste des mots-clés `/tags/` est dans la recherche) et la page d'un mot-clé `/tags/<clé>/`, devenue
 * la liste de ses éléments dans la recherche, `/recherche/?mot-cle=<clé>` (les ids du vocabulaire, migration 0043, sont les anciennes clés ; un mot-clé
 * disparu depuis y est dit « n'existe plus »). `null` si ce n'en est pas une. Lu par la page 404, qui y ajoute la requête et l'ancre (adresseComplete).
 */
export function nouvelleAdresse(pathname, base = '/') {
  const wiki = legacyWikiRedirect(pathname, base);
  // une ancienne adresse du wiki d'une page renommée depuis (« /wiki/ressources/bouclier/ ») : la nouvelle, sans second passage par la page 404
  if (wiki) return adresseRenommee(wiki, base) ?? wiki;
  return adresseRenommee(pathname, base);
}

/** La nouvelle adresse d'une page renommée ou d'un mot-clé (voir nouvelleAdresse), `null` sinon. */
function adresseRenommee(pathname, base) {
  const root = base.replace(/\/$/, '') + '/';
  if (!pathname.startsWith(root)) return null;
  const rel = pathname.slice(root.length).replace(/\/?$/, '/');
  const motCle = rel.match(/^tags\/([^/]+)\/$/);
  if (motCle) return `${root}recherche/?mot-cle=${motCle[1]}`;
  return PAGES_RENOMMEES[rel] ? root + PAGES_RENOMMEES[rel] : null;
}

/**
 * L'adresse où renvoyer : `cible` (qui peut avoir sa propre requête, « /recherche/?mot-cle=feu », et sa propre ancre, « /ressources/equipement/#boucliers »),
 * plus les paramètres de la requête d'origine (`search`) qu'elle n'a pas déjà, puis l'ancre (`hash`, sinon celle de la cible) : jamais deux « ? » ni deux
 * « # », la requête toujours avant l'ancre.
 */
export function adresseComplete(cible, search = '', hash = '') {
  const [sansAncre, ancreDeLaCible = ''] = cible.split('#');
  const [chemin, requete = ''] = sansAncre.split('?');
  const parametres = new URLSearchParams(requete);
  for (const [nom, valeur] of new URLSearchParams(search)) if (!parametres.has(nom)) parametres.append(nom, valeur);
  const texte = parametres.toString();
  return `${chemin}${texte ? `?${texte}` : ''}${hash || (ancreDeLaCible ? `#${ancreDeLaCible}` : '')}`;
}
