// Arborescence du menu principal (deux lignes). Module pur, sans dépendance Astro/navigateur.
// Ligne 1 = les rubriques (`NAV`), ligne 2 = les `items` de la rubrique sélectionnée.
// `path` : chemin relatif du site (sans préfixe de déploiement). Sans `path`, l'entrée est affichée
// grisée « bientôt » : la page n'existe pas encore (on n'invente pas de contenu).
// `autres` : débuts d'adresse des pages de la rubrique qui ne sont pas dans le menu (une page de `ressources/` ouvre l'Équipement). Une page ouvre la
// rubrique dont une entrée ou un début d'adresse est le plus long début de la sienne : /regles/artisanat/ ouvre l'Équipement, pas les Règles de /regles/.
// L'ancre d'une entrée (« ressources/equipement/#armes ») ne compte pas.
// `devSeulement` : une entrée du site de dev seulement, absente du menu en production (entreesDuMenu).
// Arborescence voulue par le propriétaire du projet (pas de barre de recherche dans l'en-tête : la recherche est une page, avec les mots-clés).
// Sept rubriques (demande du propriétaire du 2026-10-29, après celles du 2026-10-16 et du 2026-10-18 : « éclater le guide pour retravailler pleinement
// l'organisation des onglets et de la présentation ») : Règles (l'ancienne Découvrir, la vitrine, faite pour être vue même des non-membres, avec Les
// bases et les Règles avancées), Personnage (l'ancienne Règles), Équipement, Espace joueur, Espace MJ, Codex, Outils ; plus de rubrique Ressources ni
// d'entrée Guide (les pages du guide sont rangées par lib/livres.mjs : Découvrir, Les bases — un sommaire —, Règles avancées, Guide du MJ). Rien n'est
// caché ni filtré : « Pour l'instant comme les menus ne sont pas prêt rien n'est caché mais tout de même ils ne verront à terme que les 2 premiers
// onglets » (sic ; « ils » : les non-membres) ; « Tu fait comme si de rien n'était pour l'instant. On verra les caches. » (sic). Composants va sous
// Artisanat. Plus d'entrée « Pièces élémentaires » (demande du 2026-10-29) ; sa page reste dans la base, en attendant la réponse du propriétaire sur
// son contenu (armes et armures élémentaires, lus par la fiche).
// La page « Équipement » (demandes du propriétaire, 2026-10-16 : « J'aimerai fusionner "Armes" et "Armures" dans un seule onglet : "Equipement" »,
// « J'aimerai rajouter un 5 onglet pour y déplacer les accessoires », puis « renommer l'onglet en "Ceinture" et le mettre dans les onglets de
// équipement ») : cinq onglets, Armes, Armures, Boucliers, Ceinture, Accessoires (lib/equipement.mjs), chacun une entrée de la rubrique Équipement
// depuis le 2026-10-29. La ceinture (potions et huiles, carquois et sacs, bâtons magiques : décision R81) est l'onglet Ceinture. Le bouclier ne va pas
// à la ceinture, son emplacement est dans l'armure (décision R82) : c'est l'onglet Boucliers.
// Les chemins des pages du guide (decouvrir/…, regles/…, mj/) sont ceux de lib/livres.mjs, écrits ici à part (nav.mjs n'importe rien : le script de la
// page 404 l'importe) ; test/livres.test.mjs vérifie qu'ils s'accordent.
export const NAV = [
  {
    key: 'regles',
    label: 'Règles',
    // l'ancienne rubrique Découvrir, renommée « Règles » (demande du propriétaire du 2026-10-29 : « Le menu "Découvrir" sera renommé "Règles", le
    // sous-menu "Bienvenue" sera renommé "Découvrir" ») ; puis « Les bases » et « Règles avancées », venues de l'ancienne rubrique Règles (« il faudra
    // les sous-menu "Les bases", "règles avancées" soient déplacées dans l'ancien menu "Découvrir", devenu "Règles" »).
    // Une page par entrée (choix du propriétaire du 2026-10-18) : les quatre pages de Découvrir, celles des cartes « Par où commencer ? » de l'accueil
    // (lib/livres.mjs#DECOUVRIR, PAR_OU_COMMENCER) ; plus d'entrée « Liens » (réponse du 2026-10-22, « Supprimer la page » : « Plus d'entrée Liens au
    // menu : tout est sur Bienvenue. ») : Discord, Tipeee et la rencontre IRL sont sur l'accueil depuis le 2026-10-23 (« Ces 3 blocs auraient
    // plus leur place dans l'onglet d'acceuil. »)
    items: [
      { label: 'Découvrir', path: 'decouvrir/' },
      { label: 'L’univers', path: 'decouvrir/l-univers/' },
      { label: 'Créer son personnage', path: 'decouvrir/creer-son-personnage/' },
      { label: 'Rejoindre une partie', path: 'decouvrir/rejoindre-une-partie/' },
      { label: 'Les bases', path: 'regles/' },
      { label: 'Règles avancées', path: 'regles/avancees/' },
    ],
  },
  {
    key: 'personnage',
    label: 'Personnage',
    // l'ancienne rubrique Règles, renommée « Personnage » (demande du propriétaire du 2026-10-29 : « Il faudra renommer le menu "Règles" en
    // "Personnage" ») ; les dons de classe vont avec les classes
    autres: ['capacites/'],
    items: [
      { label: 'Races', path: 'races/' },
      { label: 'Magies', path: 'magies/' },
      { label: 'Classes', path: 'classes/' },
      { label: 'Métiers', path: 'metiers/' },
    ],
  },
  {
    key: 'equipement',
    label: 'Équipement',
    // demande du propriétaire du 2026-10-29 : « Entre le nouvellement créé "Personnage" et "Espace Joueur" il faudra un nouveau menu : "Equipement"
    // Dedans tu y déplacera les pages "Armes, Armures, Bouclier, Ceinture, Accessoire" en les sortant du sous-menu "Equipement" le remettant à nouveau
    // dans un sous-menu dédié. Il faudra aussi y déplacer les sous-menu "Artisanat" et "Livres & parchemins". » Une entrée par onglet de la page
    // « Équipement » (lib/equipement.mjs#ONGLETS_DE_L_EQUIPEMENT : même libellé, l'ancre de l'onglet) ; toutes les pages /ressources/… (Composants,
    // alchimie…) ouvrent cette rubrique.
    autres: ['ressources/'],
    items: [
      { label: 'Armes', path: 'ressources/equipement/#armes' },
      { label: 'Armures', path: 'ressources/equipement/#armures' },
      { label: 'Boucliers', path: 'ressources/equipement/#boucliers' },
      { label: 'Ceinture', path: 'ressources/equipement/#ceinture' },
      { label: 'Accessoires', path: 'ressources/equipement/#accessoires' },
      { label: 'Artisanat', path: 'regles/artisanat/' },
      { label: 'Livres & Parchemins', path: 'ressources/livre-parchemin/' },
    ],
  },
  {
    key: 'joueur',
    label: 'Espace joueur',
    items: [
      { label: 'Fiche de personnage', path: 'fiche/' },
      { label: 'Personnages', path: 'personnages/' },
      { label: 'Groupes d’aventures' },
      { label: 'Table de jeu' },
      { label: 'Chroniques' },
    ],
  },
  {
    key: 'mj',
    label: 'Espace MJ',
    items: [
      { label: 'Guide du MJ', path: 'mj/' },
      { label: 'Fiches de PNJ et scénarios' },
      { label: 'Groupes de jeu' },
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

/** Le chemin de `pathname` relatif à la racine du site (préfixe de déploiement `base` retiré). */
function cheminRelatif(pathname, base) {
  const prefix = base.replace(/\/$/, '') + '/';
  return pathname.startsWith(prefix) ? pathname.slice(prefix.length) : pathname.replace(/^\//, '');
}

/** La longueur du plus long début d'adresse du groupe (une entrée sans son ancre, ou une `autres`) qui commence `rel` ; -1 si aucun. */
function correspondance(group, rel) {
  let longueur = -1;
  for (const debut of [...group.items.map((i) => i.path?.split('#')[0]), ...(group.autres ?? [])]) {
    if (debut && rel.startsWith(debut) && debut.length > longueur) longueur = debut.length;
  }
  return longueur;
}

/** La rubrique de `rel` : celle du plus long début d'adresse (la première en cas d'égalité), `null` si aucune. */
function rubriqueDe(rel, nav) {
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
 * qu'un autre groupe de `nav` en ait un début plus long (/regles/artisanat/ est à l'Équipement, pas aux Règles de /regles/).
 */
export function groupIsCurrent(group, pathname, base = '/', nav = NAV) {
  const rel = cheminRelatif(pathname, base);
  if (!nav.includes(group)) return correspondance(group, rel) >= 0;
  return rubriqueDe(rel, nav) === group;
}

/** Rubrique à ouvrir pour cette page : celle de la page (groupIsCurrent), sinon la première, les Règles (accueil, page 404…). */
export function activeGroup(pathname, base = '/', nav = NAV) {
  return rubriqueDe(cheminRelatif(pathname, base), nav) ?? nav[0];
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
 * recherche ; les pages « Armes », « Armures », « Bouclier » et « Accessoires » sont les onglets de la page « Équipement », « Bâton magique » le
 * sous-onglet Bâtons magiques de son onglet Ceinture, et l'ancienne page « Objets à la ceinture », l'onglet Ceinture (lib/equipement.mjs,
 * lib/metiers.mjs#adresseDePage : test/equipement.test.mjs vérifie que les deux listes s'accordent ; nav.mjs n'importe rien, le script de la page
 * 404 l'importe).
 */
// « guide/statistiques-resistance-faiblesse/ » recopiait le tableau des combinaisons de deux magies de l'onglet « Statistiques », ignoré (décisions R85,
// R86, migration 0049) : les relations des magies sont sous la carte de /magies/.
export const PAGES_RENOMMEES = {
  'generateur/': 'fiche/', 'tags/': 'recherche/', 'guide/statistiques-resistance-faiblesse/': 'magies/',
  'ressources/armes/': 'ressources/equipement/#armes', 'ressources/armures/': 'ressources/equipement/#armures',
  'ressources/bouclier/': 'ressources/equipement/#boucliers', 'ressources/baton-magique/': 'ressources/equipement/#batons-magiques',
  'ressources/accessoires/': 'ressources/equipement/#accessoires', 'ressources/objets-a-la-ceinture/': 'ressources/equipement/#ceinture',
};

/**
 * Nouvelle adresse d'une ancienne adresse du site : les pages du wiki sous `/wiki/` (legacyWikiRedirect), les pages renommées (le générateur
 * `/generateur/` est devenu la fiche `/fiche/`, la liste des mots-clés `/tags/` est dans la recherche) et la page d'un mot-clé `/tags/<clé>/`, devenue
 * la liste de ses éléments dans la recherche, `/recherche/?mot-cle=<clé>` (les ids du vocabulaire, migration 0043, sont les anciennes clés ; un mot-clé
 * disparu depuis y est dit « n'existe plus »). `null` si ce n'en est pas une. Lu par la page 404, qui y ajoute la requête et l'ancre (adresseComplete).
 * `renvois` : d'autres anciennes adresses → nouvelles, relatives à la racine du site, calculées au build : celles des pages du guide, /guide/ et
 * /guide/<slug>/ avant l'éclatement du guide (lib/metiers.mjs#renvoisDuGuide, écrites par pages/404.astro ; nav.mjs n'importe pas le plan, que la
 * chaîne de l'édition importe aussi sur la page 404). PAGES_RENOMMEES l'emporte sur elles.
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
