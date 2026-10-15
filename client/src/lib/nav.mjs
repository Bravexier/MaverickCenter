// Arborescence du menu principal (deux lignes). Module pur, sans dépendance Astro/navigateur.
// Ligne 1 = les rubriques (`NAV`), ligne 2 = les `items` de la rubrique sélectionnée.
// `path` : chemin relatif du site (sans préfixe de déploiement). Sans `path`, l'entrée est affichée
// grisée « bientôt » : la page n'existe pas encore (on n'invente pas de contenu).
// `autres` : débuts d'adresse des pages de la rubrique qui ne sont pas dans le menu (une page de `ressources/` ouvre les Ressources).
// `devSeulement` : une entrée du site de dev seulement, absente du menu en production (entreesDuMenu).
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
      { label: 'Composants', path: 'ressources/composants/' },
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
    autres: ['pages/', 'donnees/'],
    items: [
      { label: 'Statistiques' },
      { label: 'Mise à jour', path: 'mise-a-jour/' },
      { label: 'Boîte à idée' },
      { label: 'Galeries', path: 'galeries/' },
      { label: 'Recherche', path: 'recherche/' },
      { label: 'Archives', path: 'archives/' },
      // Debug (demande du propriétaire : « visible uniquement sur le serveur dev ») : le testeur de l'API et les journaux du service (pages/debug.astro) ;
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

/** Pages renommées (demande du propriétaire) : ancienne adresse → nouvelle, relatives à la racine du site. La liste des mots-clés est dans la recherche. */
export const PAGES_RENOMMEES = { 'generateur/': 'fiche/', 'tags/': 'recherche/' };

/**
 * Nouvelle adresse d'une ancienne adresse du site : les pages du wiki sous `/wiki/` (legacyWikiRedirect), les pages renommées (le générateur
 * `/generateur/` est devenu la fiche `/fiche/`, la liste des mots-clés `/tags/` est dans la recherche) et la page d'un mot-clé `/tags/<clé>/`, devenue
 * la liste de ses éléments dans la recherche, `/recherche/?mot-cle=<clé>` (les ids du vocabulaire, migration 0043, sont les anciennes clés ; un mot-clé
 * disparu depuis y est dit « n'existe plus »). `null` si ce n'en est pas une. Lu par la page 404, qui y ajoute la requête et l'ancre (adresseComplete).
 */
export function nouvelleAdresse(pathname, base = '/') {
  const wiki = legacyWikiRedirect(pathname, base);
  if (wiki) return wiki;
  const root = base.replace(/\/$/, '') + '/';
  if (!pathname.startsWith(root)) return null;
  const rel = pathname.slice(root.length).replace(/\/?$/, '/');
  const motCle = rel.match(/^tags\/([^/]+)\/$/);
  if (motCle) return `${root}recherche/?mot-cle=${motCle[1]}`;
  return PAGES_RENOMMEES[rel] ? root + PAGES_RENOMMEES[rel] : null;
}

/**
 * L'adresse où renvoyer : `cible` (qui peut avoir sa propre requête, « /recherche/?mot-cle=feu »), plus les paramètres de la requête d'origine (`search`)
 * qu'elle n'a pas déjà, puis l'ancre (`hash`) : jamais deux « ? ».
 */
export function adresseComplete(cible, search = '', hash = '') {
  const [chemin, requete = ''] = cible.split('?');
  const parametres = new URLSearchParams(requete);
  for (const [nom, valeur] of new URLSearchParams(search)) if (!parametres.has(nom)) parametres.append(nom, valeur);
  const texte = parametres.toString();
  return `${chemin}${texte ? `?${texte}` : ''}${hash}`;
}
