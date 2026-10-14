// Arborescence du menu principal (deux lignes). Module pur, sans dépendance Astro/navigateur.
// Ligne 1 = les rubriques (`NAV`), ligne 2 = les `items` de la rubrique sélectionnée.
// `path` : chemin relatif du site (sans préfixe de déploiement). Sans `path`, l'entrée est affichée
// grisée « bientôt » : la page n'existe pas encore (on n'invente pas de contenu).
// `autres` : débuts d'adresse des pages de la rubrique qui ne sont pas dans le menu (une page de `ressources/` ouvre les Ressources).
// Arborescence voulue par le propriétaire du projet (pas de barre de recherche dans l'en-tête : la recherche est une page, avec les mots-clés).
// Boucliers et bâtons magiques iront dans « Objets à la ceinture » (bientôt, choix du propriétaire) ; hors menu, comme l'alchimie, leurs pages restent
// trouvables par la recherche et les liens.
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
      { label: 'Armes', path: 'ressources/armes/' },
      { label: 'Armures', path: 'ressources/armures/' },
      { label: 'Accessoires', path: 'ressources/accessoires/' },
      { label: 'Objets à la ceinture' },
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
    autres: ['pages/', 'tags/', 'donnees/'],
    items: [
      { label: 'Statistiques' },
      { label: 'Mise à jour', path: 'mise-a-jour/' },
      { label: 'Boîte à idée' },
      { label: 'Galeries', path: 'galeries/' },
      { label: 'Recherche', path: 'recherche/' },
      { label: 'Archives', path: 'archives/' },
    ],
  },
];

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
  return root + (pathname.slice(old.length + 1) || 'pages/');
}

/** Pages renommées (demande du propriétaire) : ancienne adresse → nouvelle, relatives à la racine du site. La liste des mots-clés est dans la recherche. */
export const PAGES_RENOMMEES = { 'generateur/': 'fiche/', 'tags/': 'recherche/' };

/**
 * Nouvelle adresse d'une ancienne adresse du site : les pages du wiki sous `/wiki/` (legacyWikiRedirect) et les pages renommées (le générateur
 * `/generateur/` est devenu la fiche `/fiche/`, la liste des mots-clés `/tags/` est dans la recherche). `null` si ce n'en est pas une. Lu par la page 404.
 */
export function nouvelleAdresse(pathname, base = '/') {
  const wiki = legacyWikiRedirect(pathname, base);
  if (wiki) return wiki;
  const root = base.replace(/\/$/, '') + '/';
  if (!pathname.startsWith(root)) return null;
  const rel = pathname.slice(root.length).replace(/\/?$/, '/');
  return PAGES_RENOMMEES[rel] ? root + PAGES_RENOMMEES[rel] : null;
}
