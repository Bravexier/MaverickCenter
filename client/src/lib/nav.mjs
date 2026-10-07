// Arborescence du menu principal (deux niveaux). Module pur, sans dépendance Astro/navigateur.
// `path` : chemin relatif du site (sans préfixe de déploiement). Sans `path`, l'entrée est affichée
// grisée « bientôt » : la page n'existe pas encore (on n'invente pas de contenu).
// `links` : pages liées, affichées sous l'entrée (ex. les pages incluses dans « Armes et armures »).
export const NAV = [
  {
    key: 'regles',
    label: 'Règles',
    items: [
      { label: 'Guide', path: 'wiki/guide/' },
      { label: 'Fiche de personnage', path: 'generateur/' },
      { label: 'Races', path: 'wiki/races/' },
      { label: 'Magies', path: 'wiki/magies/' },
      { label: 'Classes', path: 'wiki/classes/' },
      { label: 'Métiers', path: 'wiki/metiers/' },
    ],
  },
  {
    key: 'objets',
    label: 'Objets et artisanat',
    items: [
      {
        label: 'Armes et armures',
        path: 'wiki/ressources/armes/',
        links: [
          { label: 'Armes', path: 'wiki/ressources/armes/' },
          { label: 'Armures', path: 'wiki/ressources/armures/' },
          { label: 'Boucliers', path: 'wiki/ressources/bouclier/' },
          { label: 'Bâtons magiques', path: 'wiki/ressources/baton-magique/' },
          { label: 'Pièces élémentaires', path: 'wiki/ressources/pieces-elementaires/' },
        ],
      },
      { label: 'Alchimie', path: 'wiki/ressources/alchimie/' },
      {
        label: 'Livres, parchemins et accessoires magiques',
        path: 'wiki/ressources/livre-parchemin/',
        links: [
          { label: 'Livres et parchemins', path: 'wiki/ressources/livre-parchemin/' },
          { label: 'Accessoires', path: 'wiki/ressources/accessoires/' },
        ],
      },
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
      { label: 'Index du wiki', path: 'wiki/' },
      { label: 'Bestiaire', path: 'wiki/bestiaire/' },
      { label: 'Capacités de classe', path: 'wiki/capacites/' },
      { label: 'Mots-clés', path: 'tags/' },
      { label: 'Base de données', path: 'donnees/' },
    ],
  },
];

/** Tous les chemins référencés par le menu (entrées et pages liées). */
export function navPaths(nav = NAV) {
  return nav.flatMap((g) => g.items.flatMap((i) => [i.path, ...(i.links ?? []).map((l) => l.path)])).filter(Boolean);
}

/** Vrai si `pathname` (avec préfixe de déploiement `base`) est dans la section d'un groupe. */
export function groupIsCurrent(group, pathname, base = '/') {
  const prefix = base.replace(/\/$/, '') + '/';
  const rel = pathname.startsWith(prefix) ? pathname.slice(prefix.length) : pathname.replace(/^\//, '');
  return group.items.some((i) => [i.path, ...(i.links ?? []).map((l) => l.path)].some((p) => p && (rel === p || (p !== 'wiki/' && rel.startsWith(p)))));
}
