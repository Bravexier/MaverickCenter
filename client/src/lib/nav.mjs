// Arborescence du menu du site : cinq rubriques sur une seule ligne d'en-tête, et à gauche de la page le menu latéral des entrées de la rubrique choisie
// (R319, refonte du menu, lot 1). Module pur, sans dépendance Astro/navigateur, qui n'importe rien : le script de la page 404 l'importe.
//
// Une rubrique : { key, label, items, autres?, niveau? } ; une entrée (la forme que lib/menu-db.mjs résout d'après la base) :
//   { label, path?, motCle?, libelleArbo?, onglet?, enfants?, cle?, niveau?, devSeulement?, prodSeulement? }
//   - `path`          chemin relatif à la racine du site (sans préfixe de déploiement ni barre initiale) : le repli quand l'entrée n'a ni onglet ni adresse de
//                     mot-clé, et ce que lisent la rubrique courante (activeGroup, groupIsCurrent) et le script de la page 404. Une entrée sans `path` (ni
//                     onglet, ni mot-clé à adresse) est affichée grisée « bientôt » : la page n'existe pas encore (on n'invente pas de contenu) ;
//   - `motCle`        l'id entier d'un mot-clé du glossaire : l'entrée en prend l'adresse, l'habillage et le libellé, sauf `libelleArbo` (le libellé écrit ici
//                     l'emporte : « Les races », « Boucliers »…) ; lib/menu-db.mjs ;
//   - `onglet`        l'id d'un onglet des Règles (regles_onglet.id) : son libellé est le titre de l'onglet dans la base (sauf `libelleArbo`), son adresse regles/<id>/ ;
//   - `enfants`       les sous-pages d'une entrée qui se déplie (Introduction : Découvrir, L'univers) ; une entrée à enfants n'a pas de lien. `cle` la nomme (l'état
//                     replié ou déplié se garde par `cle`) ;
//   - `niveau`        « joueur », « mj » ou « createur » : le niveau d'accès voulu ([J], [MJ], [C] de R319 (3)) ; une rubrique peut le porter (elle disparaît alors avec ses
//                     entrées). Appliqué par le lot 4 (R319) : le build l'écrit sur l'élément du menu (`data-niveau-menu`, caché : le menu d'un Observateur sans JavaScript ni
//                     réponse du service) et scripts/compte.mjs le montre selon le niveau du compte ; la version portable (pas de service) le retire (`sansNiveau`). Ne cache qu'un
//                     lien : la page, elle, reste servie comme avant (R310 (3), la porte du serveur) ;
//   - `devSeulement`  une entrée du site de dev seulement ([Dev]), absente du menu d'un build de production et de la version portable (entreesVisibles) ;
//   - `prodSeulement` une entrée de la production seulement ([Prod]), absente du menu du site de dev (entreesVisibles, `prod`) ;
//   - `autres`        (rubrique) débuts d'adresse des pages de la rubrique qui ne sont pas dans le menu : une page ouvre la rubrique dont une entrée ou un début
//                     d'adresse est le plus long début de la sienne (l'ancre d'une entrée ne compte pas).
// Cinq rubriques (R319 (1)) : Le Jeu, Règles, Ressources, Le monde, Taverne. Le compte est à droite de l'en-tête (components/Compte.astro) ; le menu du profil
// (MENU_DU_PROFIL) rassemble ce qui n'est pas dans une rubrique : Glossaire et Recherche y sont des pages du profil, pas d'une rubrique. Toujours pas de barre
// de recherche. Pas d'entrée pour le générateur /fiche/ (R319 (6)) : on y arrive par « Personnages prétirés » (/personnages/) et par l'onglet des Règles.
// Les chemins de Découvrir (decouvrir/…) et du Guide du MJ (mj/) sont ceux de lib/livres.mjs, ceux des onglets des Règles (regles/<onglet>/) ceux de la table
// regles_onglet, écrits ici à part (nav.mjs n'importe rien) ; test/livres.test.mjs et test/nav.test.mjs vérifient qu'ils s'accordent.

/** Les niveaux que porte `niveau` (R319 (3)), du plus bas au plus haut : joueur [J], MJ [MJ], créateur [C]. Avec Observateur au-dessous, l'ordre de lib/compte.mjs#ORDRE_DES_NIVEAUX (nav.mjs n'importe rien : test/compte.test.mjs compare). */
export const NIVEAUX_DU_MENU = Object.freeze(['joueur', 'mj', 'createur']);

/** L'adresse du site de dev (entrée « Site de dev » du menu du profil) : celle de scripts/db-extrait.mjs#ADRESSE_DU_SITE_DE_DEV, que test/nav.test.mjs compare. */
export const ADRESSE_DU_SITE_DE_DEV = 'https://dev.maverick-jdr.com/';

export const NAV = [
  {
    key: 'jeu',
    label: 'Le Jeu',
    // `capacites/` : les dons de classe vont avec les classes ; `fiche/` : le générateur de fiche n'a pas d'entrée (R319 (6)), sa page est tout de même du Jeu.
    // Familiers (la page `ressources/familiers`) : son adresse, plus longue que `ressources/` de
    // la rubrique Ressources, fait ouvrir Le Jeu à sa page.
    autres: ['capacites/', 'fiche/'],
    items: [
      // Introduction n'est pas une page : elle se déplie sur Découvrir et L'univers
      {
        cle: 'introduction',
        label: 'Introduction',
        enfants: [
          { label: 'Découvrir', motCle: 44, libelleArbo: true, path: 'decouvrir/' },
          { label: 'L’univers', motCle: 201, path: 'decouvrir/l-univers/' },
        ],
      },
      { label: 'Les races', motCle: 298, libelleArbo: true, path: 'races/' },
      { label: 'Les magies', motCle: 223, libelleArbo: true, path: 'magies/' },
      { label: 'Les classes', motCle: 66, libelleArbo: true, path: 'classes/' },
      { label: 'Les métiers', motCle: 240, libelleArbo: true, path: 'metiers/' },
      { label: 'Les familiers', path: 'ressources/familiers/' },
      // l'onglet des Règles (page d'ouverture : guide/creer-son-personnage) ; l'entrée garde le nom de l'arborescence (dix entrées en tout, R319 (4))
      { label: 'La fiche de personnage', onglet: 'fiche-de-personnage', libelleArbo: true, path: 'regles/fiche-de-personnage/' },
      { label: 'Personnages prétirés', path: 'personnages/' },
    ],
  },
  {
    key: 'regles',
    label: 'Règles',
    // toute page sous regles/ (les pages des onglets, à plat) ouvre les Règles ; l'onglet marqué sur ces pages (`entree` de layouts/Base.astro) vient du plan
    // de la base, pas de l'adresse
    autres: ['regles/'],
    items: [
      // les libellés sont les titres des onglets dans la base (le propriétaire les renomme sur le site de dev : Mécaniques de bases, Combat, Avancées)
      { label: 'Mécaniques générales', onglet: 'mecaniques-generales', path: 'regles/mecaniques-generales/' },
      { label: 'Les combats', onglet: 'combats', path: 'regles/combats/' },
      { label: 'Exploration', onglet: 'exploration', path: 'regles/exploration/' },
      { label: 'Guide du MJ', path: 'mj/', niveau: 'mj' },
      { label: 'Mise à jour', path: 'mise-a-jour/', niveau: 'joueur' },
      { label: 'Statistiques', niveau: 'joueur' },
    ],
  },
  {
    key: 'ressources',
    label: 'Ressources',
    niveau: 'joueur',
    // toutes les pages /ressources/… (alchimie…) ouvrent cette rubrique, sauf Familiers (Le Jeu) ; « Autres » (/ressources/) liste toutes les pages de ressources
    autres: ['ressources/'],
    items: [
      { label: 'Armes', motCle: 20, path: 'ressources/armes/' },
      { label: 'Armures', motCle: 23, path: 'ressources/armures/' },
      { label: 'Boucliers', motCle: 49, libelleArbo: true, path: 'ressources/bouclier/' },
      { label: 'Accessoires', motCle: 3, path: 'ressources/accessoires/' },
      { label: 'Ceinture', motCle: 58, path: 'ressources/objets-a-la-ceinture/' },
      { label: 'Livres & Parchemins', motCle: 198, libelleArbo: true, path: 'ressources/livre-parchemin/' },
      // l'Artisanat est une page de l'onglet des Règles Exploration (menu latéral du plan), ouverte par cette entrée
      { label: 'Artisanat', motCle: 25, path: 'regles/artisanat/' },
      { label: 'Composants', motCle: 76, path: 'ressources/composants/' },
      { label: 'Autres', path: 'ressources/' },
    ],
  },
  {
    key: 'monde',
    label: 'Le monde',
    niveau: 'joueur',
    autres: ['bestiaire/', 'lore/', 'cartes/'],
    // Mythologie et Factions : les sommaires des parties « Les Divinités » et « Temples/Cultes/Guildes » du Google Doc « CODEX Maverick » (docs/codex.md) ;
    // Chronologie : les événements datés du Codex et des races, une page par événement (lib/chronologie.mjs, docs/chronologie.md)
    items: [
      { label: 'Chronologie', motCle: 65, path: 'chronologie/' },
      { label: 'Lieux' },
      { label: 'Mythologie', motCle: 185, libelleArbo: true, path: 'lore/les-divinites/' },
      { label: 'Bestiaire', motCle: 42, path: 'bestiaire/', niveau: 'mj' },
      { label: 'Factions', motCle: 349, libelleArbo: true, path: 'lore/temples-cultes-guildes/' },
    ],
  },
  {
    key: 'taverne',
    label: 'Taverne',
    niveau: 'joueur',
    autres: ['pages/', 'donnees/'],
    items: [
      { label: 'Parties' },
      { label: 'Planning' },
      { label: 'Galerie', path: 'galeries/' },
      { label: 'Suggestions' },
      { label: 'Archives', path: 'archives/' },
      // Debug (demande du propriétaire : « visible uniquement sur le serveur dev ») : système, performances, journaux du service et schéma de la base
      // (pages/debug.astro) ; `devSeulement` : hors du menu d'un build de production (SITE_MODE=prod) et de la version portable (entreesVisibles)
      { label: 'Debug', path: 'debug/', devSeulement: true },
    ],
  },
];

/**
 * Le menu du profil (R319 (1)), à droite de l'en-tête, rendu par le compte : des blocs d'entrées séparés par un filet. `connecte` : tout compte connecté, quel
 * que soit son niveau (R319 : « Se déconnecter (tout compte connecté) »). `externe` : une adresse complète, hors du site. `action: 'deconnexion'` : l'entrée
 * que le compte rend lui-même (script du compte), sans adresse ; `action: 'voir-en-tant-que'` : un choix de niveau (lib/menu-rendu.mjs), montré selon le niveau RÉEL du
 * compte (Créateur). Les autres niveaux s'appliquent comme ceux de NAV, au niveau vu (scripts/compte.mjs). Un visiteur non connecté garde « Connexion via Discord » et
 * un petit menu Glossaire et Recherche.
 */
export const MENU_DU_PROFIL = [
  [{ label: 'Mon profil', path: 'profil/', connecte: true }],
  [
    // R318 (étape E8) : la section « Mes personnages » de /personnages/ (les fiches rangées au compte de la session)
    { label: 'Mes personnages', path: 'personnages/#mes-personnages', niveau: 'joueur' },
    { label: 'Mes groupes', niveau: 'joueur' },
    { label: 'Mes scénarios', niveau: 'mj' },
  ],
  [
    { label: 'Glossaire', path: 'regles/glossaire/' },
    { label: 'Recherche', path: 'recherche/' },
  ],
  [
    { label: 'Site de dev', externe: ADRESSE_DU_SITE_DE_DEV, prodSeulement: true, niveau: 'mj' },
    // R319 (1) : un Créateur choisit un niveau inférieur et voit le menu de ce niveau (le choix, un <select>, est rendu par lib/menu-rendu.mjs)
    { label: 'Voir le site en tant que…', niveau: 'createur', action: 'voir-en-tant-que' },
  ],
  [{ label: 'Se déconnecter', action: 'deconnexion', connecte: true }],
];

/** Les entrées de `entrees` et de leurs `enfants`, à plat, dans l'ordre. */
export function entreesAPlat(entrees) {
  return (entrees ?? []).flatMap((e) => [e, ...entreesAPlat(e.enfants)]);
}

/**
 * Les entrées de `entrees` à afficher au build : sans celles du site de dev seulement (`devSeulement`) quand `dev` est faux (build de production, version portable), sans
 * celles de la production seulement (`prodSeulement`) quand `prod` est faux (le site de dev : « Site de dev » du menu du profil), jusque dans les `enfants`. Les
 * rubriques ne passent pas `prod` (vrai par défaut : rien n'y est de la production seulement). `sansNiveau` : sans celles qui portent un `niveau` (la version portable,
 * sans service : le menu d'un Observateur, que tout `niveau` de R319 (3) dépasse). Sans lui, le `niveau` n'est pas filtré ici : le build écrit le menu d'un Observateur
 * (`data-niveau-menu`, `hidden`) et scripts/compte.mjs le montre selon le niveau du compte.
 */
export function entreesVisibles(entrees, { dev = true, prod = true, sansNiveau = false } = {}) {
  return (entrees ?? [])
    .filter((e) => (dev || !e.devSeulement) && (prod || !e.prodSeulement) && !(sansNiveau && e.niveau))
    .map((e) => (e.enfants ? { ...e, enfants: entreesVisibles(e.enfants, { dev, prod, sansNiveau }) } : e));
}

/** Tous les chemins référencés par le menu (rubriques, sous-pages comprises ; pas le menu du profil). */
export function navPaths(nav = NAV) {
  return nav.flatMap((g) => entreesAPlat(g.items).map((i) => i.path)).filter(Boolean);
}

/** Le chemin de `pathname` relatif à la racine du site (préfixe de déploiement `base` retiré). */
function cheminRelatif(pathname, base) {
  const prefix = base.replace(/\/$/, '') + '/';
  return pathname.startsWith(prefix) ? pathname.slice(prefix.length) : pathname.replace(/^\//, '');
}

/** Les débuts d'adresse d'une rubrique : ses entrées (sans leur ancre, sous-pages comprises) et ses `autres`. */
const debutsDe = (group) => [...entreesAPlat(group.items).map((i) => i.path?.split('#')[0]), ...(group.autres ?? [])];

/** La longueur du plus long début d'adresse du groupe (une entrée sans son ancre, ou une `autres`) qui commence `rel` ; -1 si aucun. */
function correspondance(group, rel) {
  let longueur = -1;
  for (const debut of debutsDe(group)) {
    if (debut && rel.startsWith(debut) && debut.length > longueur) longueur = debut.length;
  }
  return longueur;
}

/**
 * La rubrique de `rel` (relatif à la racine) : une page du menu du profil n'est d'aucune rubrique (Glossaire, Recherche, profil) ; puis la rubrique dont une
 * entrée est cette page même ; puis celle de l'entrée `entree` (l'onglet du plan d'une page qui n'est pas une entrée : une page d'un onglet des Règles, dont
 * l'adresse ne dit pas l'onglet) ; puis celle du plus long début d'adresse (la première en cas d'égalité). `null` si aucune.
 */
function rubriqueDe(rel, nav, entree) {
  const duProfil = entreesAPlat(MENU_DU_PROFIL.flat());
  if (duProfil.some((e) => e.path === rel || (entree && e.path === entree))) return null;
  const exacte = nav.find((g) => entreesAPlat(g.items).some((i) => i.path === rel));
  if (exacte) return exacte;
  const deLEntree = entree ? nav.find((g) => entreesAPlat(g.items).some((i) => i.path === entree)) : null;
  if (deLEntree) return deLEntree;
  let meilleure = null;
  let longueur = -1;
  for (const g of nav) {
    const l = correspondance(g, rel);
    if (l > longueur) [meilleure, longueur] = [g, l];
  }
  return meilleure;
}

/**
 * Vrai si `pathname` (avec préfixe de déploiement `base`) est dans la section d'un groupe : une de ses entrées, ou une de ses `autres` pages, sans
 * qu'un autre groupe de `nav` en ait un début plus long (/ressources/familiers/ est au Jeu, pas aux Ressources de /ressources/). `entree` : l'entrée du menu
 * (son `path`) par laquelle on atteint une page qui n'en est pas une (Base.astro, propriété `entree`).
 */
export function groupIsCurrent(group, pathname, base = '/', nav = NAV, entree = undefined) {
  const rel = cheminRelatif(pathname, base);
  if (!nav.includes(group)) return correspondance(group, rel) >= 0;
  return rubriqueDe(rel, nav, entree) === group;
}

/** La rubrique de la page, `null` quand elle n'est d'aucune (l'accueil, la page 404, les pages du menu du profil). */
export function rubriqueCourante(pathname, base = '/', nav = NAV, entree = undefined) {
  return rubriqueDe(cheminRelatif(pathname, base), nav, entree);
}

/** Rubrique dont le menu latéral est montré au départ : celle de la page (rubriqueCourante), sinon la première, Le Jeu (accueil, page 404…). */
export function activeGroup(pathname, base = '/', nav = NAV, entree = undefined) {
  return rubriqueCourante(pathname, base, nav, entree) ?? nav[0];
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
 * recherche ; la page « Bâton magique » est le sous-onglet Bâtons magiques de la page Ceinture (lib/equipement.mjs, lib/metiers.mjs#adresseDePage :
 * test/equipement.test.mjs vérifie que les deux listes s'accordent ; nav.mjs n'importe rien, le script de la page 404 l'importe). Les pages Armes,
 * Armures, Bouclier, Accessoires et Objets à la ceinture ont retrouvé leur adresse (2026-10-29) ; l'ancienne page « Équipement » et la page « Pièces
 * élémentaires », éclatées, sont des renvois selon l'ancre (adresseEclatee).
 */
// « guide/statistiques-resistance-faiblesse/ » recopiait le tableau des combinaisons de deux magies de l'onglet « Statistiques », ignoré (décisions R85,
// R86, migration 0049) : les relations des magies sont sous la carte de /magies/.
export const PAGES_RENOMMEES = {
  'generateur/': 'fiche/', 'tags/': 'recherche/', 'guide/statistiques-resistance-faiblesse/': 'magies/',
  'ressources/baton-magique/': 'ressources/objets-a-la-ceinture/#batons-magiques',
};

/** Une ancre sans son « # », décodée (« #%C3%A9p%C3%A9e » → « épée ») ; telle quelle si elle est mal formée. */
function ancreLue(hash) {
  const brute = String(hash ?? '').replace(/^#/, '');
  try {
    return decodeURIComponent(brute);
  } catch {
    return brute;
  }
}

/**
 * La nouvelle adresse d'une page éclatée en plusieurs (l'ancienne page « Équipement », /ressources/equipement/, en cinq pages ; la page « Pièces
 * élémentaires », dans Armes et Armures : 2026-10-29), selon l'ancre et la requête de l'adresse demandée, relative à la racine du site et AVEC l'ancre
 * à garder (« ressources/armes/#famille-bombes ») ; null si `rel` (relatif à la racine, « ressources/equipement/ ») n'en est pas une.
 * `eclatees` : lib/equipement.mjs#RENVOIS_DES_PAGES_ECLATEES (nav.mjs n'importe rien : la page 404 les passe à son script, data-eclatees) —
 *   une ancienne ancre connue (anciennesAncres) est remplacée ; sinon une ancre reconnue (le plus long des débuts d'`ancres`) mène à sa page et reste ;
 *   sinon le premier paramètre de la requête reconnu (`parametres`) ; sinon `defaut`. Une ancre inconnue est gardée sur la page de `defaut` si celle-ci
 *   n'en a pas.
 */
export function adresseEclatee(rel, eclatees = {}, { search = '', hash = '' } = {}) {
  const chemin = String(rel ?? '').replace(/\/?$/, '/');
  const r = eclatees && Object.hasOwn(eclatees, chemin) ? eclatees[chemin] : null;
  if (!r) return null;
  const ancre = ancreLue(hash);
  const avecAncre = (page) => `${page}${ancre ? `#${ancre}` : ''}`;
  if (ancre && r.anciennesAncres && Object.hasOwn(r.anciennesAncres, ancre)) return r.anciennesAncres[ancre];
  if (ancre) {
    let meilleure = null;
    for (const [debut, page] of r.ancres ?? []) if (ancre.startsWith(debut) && (!meilleure || debut.length > meilleure[0].length)) meilleure = [debut, page];
    if (meilleure) return avecAncre(meilleure[1]);
  }
  const parametres = new URLSearchParams(search);
  const parParametre = (r.parametres ?? []).find(([nom]) => parametres.has(nom));
  if (parParametre) return avecAncre(parParametre[1]);
  return r.defaut.includes('#') || !ancre ? r.defaut : avecAncre(r.defaut);
}

/**
 * Nouvelle adresse d'une ancienne adresse du site : les pages du wiki sous `/wiki/` (legacyWikiRedirect), les pages renommées (le générateur
 * `/generateur/` est devenu la fiche `/fiche/`, la liste des mots-clés `/tags/` est dans la recherche) et la page d'un mot-clé `/tags/<clé>/`, devenue
 * la liste de ses éléments dans la recherche, `/recherche/?mot-cle=<clé>` (les ids du vocabulaire, migration 0043, sont les anciennes clés ; un mot-clé
 * disparu depuis y est dit « n'existe plus »). `null` si ce n'en est pas une. Lu par la page 404, qui y ajoute la requête et l'ancre (adresseComplete).
 * `renvois` : d'autres anciennes adresses → nouvelles, relatives à la racine du site, calculées au build : celles des pages du guide, /guide/ et
 * /guide/<slug>/ avant l'éclatement du guide, /regles/avancees/<slug>/ avant les onglets des Règles (lib/metiers.mjs#renvoisDuGuide, écrites par
 * pages/404.astro ; nav.mjs n'importe pas le plan, que la chaîne de l'édition importe aussi sur la page 404). PAGES_RENOMMEES l'emporte sur elles.
 */
export function nouvelleAdresse(pathname, base = '/', renvois = {}) {
  const wiki = legacyWikiRedirect(pathname, base);
  // une ancienne adresse du wiki d'une page renommée depuis (« /wiki/ressources/bouclier/ ») : la nouvelle, sans second passage par la page 404
  if (wiki) return adresseRenommee(wiki, base, renvois) ?? wiki;
  return adresseRenommee(pathname, base, renvois);
}

/** La nouvelle adresse d'une page renommée, d'un renvoi ou d'un mot-clé (voir nouvelleAdresse), `null` sinon. */
function adresseRenommee(pathname, base, renvois = {}) {
  const root = base.replace(/\/$/, '') + '/';
  if (!pathname.startsWith(root)) return null;
  const rel = pathname.slice(root.length).replace(/\/?$/, '/');
  const motCle = rel.match(/^tags\/([^/]+)\/$/);
  if (motCle) return `${root}recherche/?mot-cle=${motCle[1]}`;
  const cible = Object.hasOwn(PAGES_RENOMMEES, rel) ? PAGES_RENOMMEES[rel] : renvois && Object.hasOwn(renvois, rel) ? renvois[rel] : null;
  return typeof cible === 'string' ? root + cible : null;
}

/**
 * L'adresse où renvoyer : `cible` (qui peut avoir sa propre requête, « /recherche/?mot-cle=feu », et sa propre ancre, « /ressources/objets-a-la-ceinture/#batons-magiques »),
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

/**
 * Un chemin écrit vers une page éclatée, relatif à la racine du site, requête et ancre comprises (« ressources/equipement/?arme=x#armes », un lien
 * Markdown du guide : lib/guide-rendu.ts) : sa nouvelle adresse (adresseEclatee), la requête gardée avant l'ancre ; le chemin tel quel sinon.
 */
export function cheminVersUnePageEclatee(chemin, eclatees = {}) {
  const m = String(chemin).match(/^([^?#]*)(\?[^#]*)?(#.*)?$/);
  if (!m) return chemin;
  const [, rel, search = '', hash = ''] = m;
  const nouvelle = adresseEclatee(rel, eclatees, { search, hash });
  if (!nouvelle) return chemin;
  const i = nouvelle.indexOf('#');
  return i < 0 ? `${nouvelle}${search}` : `${nouvelle.slice(0, i)}${search}${nouvelle.slice(i)}`;
}

/**
 * L'adresse complète où la page 404 renvoie `pathname` (avec préfixe de déploiement `base`), requête (`search`) et ancre (`hash`) d'origine comprises,
 * ou null : une page éclatée (adresseEclatee, `eclatees` : lib/equipement.mjs#RENVOIS_DES_PAGES_ECLATEES) mène à la page de son ancre ou de sa requête,
 * l'ancre décidée par elle ; sinon nouvelleAdresse (`renvois`), puis adresseComplete. Une ancienne adresse du wiki d'une page éclatée : un seul saut.
 */
export function adresseDeRenvoi(pathname, { base = '/', renvois = {}, eclatees = {}, search = '', hash = '' } = {}) {
  const root = base.replace(/\/$/, '') + '/';
  const chemin = legacyWikiRedirect(pathname, base) ?? pathname;
  if (chemin.startsWith(root)) {
    const eclatee = adresseEclatee(chemin.slice(root.length), eclatees, { search, hash });
    if (eclatee) return adresseComplete(root + eclatee, search, '');
  }
  const cible = nouvelleAdresse(pathname, base, renvois);
  return cible ? adresseComplete(cible, search, hash) : null;
}
