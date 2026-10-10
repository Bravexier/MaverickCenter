// Arborescence du menu principal (deux lignes). Module pur, sans dépendance Astro/navigateur.
// Ligne 1 = les rubriques (`NAV`), ligne 2 = les `items` de la rubrique sélectionnée.
// `path` : chemin relatif du site (sans préfixe de déploiement). Sans `path`, l'entrée est affichée
// grisée « bientôt » : la page n'existe pas encore (on n'invente pas de contenu).
// « Armes et armures » du plan est éclaté en ses pages (armes, armures, boucliers, bâtons, pièces élémentaires).
export const NAV = [
  {
    key: 'regles',
    label: 'Règles',
    items: [
      { label: 'Guide', path: 'guide/' },
      { label: 'Races', path: 'races/' },
      { label: 'Magies', path: 'magies/' },
      { label: 'Classes', path: 'classes/' },
      { label: 'Métiers', path: 'metiers/' },
      // à droite, après les métiers (demande du propriétaire) : la fiche (création et modification) et la recherche des personnages
      { label: 'Fiche de personnage', path: 'fiche/' },
      { label: 'Personnages', path: 'personnages/' },
    ],
  },
  {
    key: 'objets',
    label: 'Objets et artisanat',
    items: [
      { label: 'Armes', path: 'ressources/armes/' },
      { label: 'Armures', path: 'ressources/armures/' },
      { label: 'Boucliers', path: 'ressources/bouclier/' },
      { label: 'Bâtons magiques', path: 'ressources/baton-magique/' },
      { label: 'Pièces élémentaires', path: 'ressources/pieces-elementaires/' },
      { label: 'Alchimie', path: 'ressources/alchimie/' },
      { label: 'Livres et parchemins', path: 'ressources/livre-parchemin/' },
      { label: 'Accessoires', path: 'ressources/accessoires/' },
    ],
  },
  {
    key: 'codex',
    label: 'Codex',
    items: [{ label: 'Mythologie' }, { label: 'Lieux' }, { label: 'Factions' }],
  },
  {
    key: 'statistiques',
    label: 'Statistiques',
    items: [], // sous-menu à compléter
  },
  {
    key: 'outils',
    label: 'Outils',
    items: [
      { label: 'Index du wiki', path: 'pages/' },
      { label: 'Bestiaire', path: 'bestiaire/' },
      { label: 'Dons de classe', path: 'capacites/' },
      { label: 'Mots-clés', path: 'tags/' },
      { label: 'Base de données', path: 'donnees/' },
    ],
  },
];

/** Tous les chemins référencés par le menu. */
export function navPaths(nav = NAV) {
  return nav.flatMap((g) => g.items.map((i) => i.path)).filter(Boolean);
}

/** Vrai si `pathname` (avec préfixe de déploiement `base`) est dans la section d'un groupe. */
export function groupIsCurrent(group, pathname, base = '/') {
  const prefix = base.replace(/\/$/, '') + '/';
  const rel = pathname.startsWith(prefix) ? pathname.slice(prefix.length) : pathname.replace(/^\//, '');
  return group.items.some((i) => i.path && rel.startsWith(i.path));
}

/** Rubrique à ouvrir pour cette page : celle de la page, sinon la première (accueil, recherche…). */
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

/** Pages renommées (demande du propriétaire) : ancienne adresse → nouvelle, relatives à la racine du site. */
export const PAGES_RENOMMEES = { 'generateur/': 'fiche/' };

/**
 * Nouvelle adresse d'une ancienne adresse du site : les pages du wiki sous `/wiki/` (legacyWikiRedirect) et les pages renommées (le générateur
 * `/generateur/` est devenu la fiche `/fiche/`). `null` si ce n'en est pas une. Lu par la page 404.
 */
export function nouvelleAdresse(pathname, base = '/') {
  const wiki = legacyWikiRedirect(pathname, base);
  if (wiki) return wiki;
  const root = base.replace(/\/$/, '') + '/';
  if (!pathname.startsWith(root)) return null;
  const rel = pathname.slice(root.length).replace(/\/?$/, '/');
  return PAGES_RENOMMEES[rel] ? root + PAGES_RENOMMEES[rel] : null;
}
