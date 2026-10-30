// Arborescence du menu principal (deux lignes). Module pur, sans dépendance Astro/navigateur.
// Ligne 1 = les rubriques (`NAV`), ligne 2 = les `items` de la rubrique sélectionnée.
// `path` : chemin relatif du site (sans préfixe de déploiement). Sans `path`, l'entrée est affichée
// grisée « bientôt » : la page n'existe pas encore (on n'invente pas de contenu).
// `autres` : débuts d'adresse des pages de la rubrique qui ne sont pas dans le menu (une page de `ressources/` ouvre l'Équipement). Une page ouvre la
// rubrique dont une entrée ou un début d'adresse est le plus long début de la sienne : /regles/artisanat/ ouvre l'Équipement, pas les Règles de /regles/.
// L'ancre d'une entrée, s'il y en a une, ne compte pas.
// `devSeulement` : une entrée du site de dev seulement, absente du menu en production (entreesDuMenu).
// Arborescence voulue par le propriétaire du projet (pas de barre de recherche dans l'en-tête : la recherche est une page, avec les mots-clés).
// Sept rubriques (demande du propriétaire du 2026-10-29, après celles du 2026-10-16 et du 2026-10-18 : « éclater le guide pour retravailler pleinement
// l'organisation des onglets et de la présentation ») : Règles (l'ancienne Découvrir, la vitrine, avec Les bases et les Règles avancées), Personnage
// (l'ancienne Règles), Équipement, Espace joueur, Espace MJ, Codex, Outils ; plus de rubrique Ressources ni d'entrée Guide (les pages du guide sont
// rangées par lib/livres.mjs : Découvrir, Les bases — un sommaire —, Règles avancées, Guide du MJ). Rien n'est caché ni filtré : « Pour l'instant comme
// les menus ne sont pas prêt rien n'est caché mais tout de même ils ne verront à terme que les 2 premiers onglets » (sic ; « ils » : les non-membres) ;
// « Tu fait comme si de rien n'était pour l'instant. On verra les caches. » (sic) ; ces deux premières rubriques sont, depuis le 2026-10-29, « Règles et
// Personnage » (réponse du propriétaire). Composants va sous Artisanat. Plus d'entrée « Pièces élémentaires » (demande du 2026-10-29 : « Le sous-menu
// "pièce élémentaire" et sa page associé seront supprimées ») : son contenu est sur les pages Armes et Armures (« Fusionner dans Armes et Armures »).
// La rubrique Équipement : les cinq pages de l'équipement (lib/equipement.mjs#PAGES_DE_L_EQUIPEMENT, « Cinq pages séparées », libellés « Comme les
// onglets (pluriel) ») — Armes, Armures, Boucliers, Ceinture, Accessoires —, onglets d'une seule page « Équipement » du 2026-10-16 au 2026-10-29. La
// ceinture (potions et huiles, carquois et sacs, bâtons magiques : décision R81) est la page Ceinture. Le bouclier ne va pas à la ceinture, son
// emplacement est dans l'armure (décision R82) : c'est la page Boucliers.
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
    // "Personnage" ») ; les dons de classe vont avec les classes. Familiers (la page `ressources/familiers`, libellé : son titre dans la base) : réponse
    // du propriétaire du 2026-10-29, « Famillier devrai être dans Personnage » (sic) ; son adresse, plus longue que `ressources/` de l'Équipement, fait
    // ouvrir le Personnage à sa page.
    autres: ['capacites/'],
    items: [
      { label: 'Races', path: 'races/' },
      { label: 'Magies', path: 'magies/' },
      { label: 'Classes', path: 'classes/' },
      { label: 'Métiers', path: 'metiers/' },
      { label: 'Familiers', path: 'ressources/familiers/' },
    ],
  },
  {
    key: 'equipement',
    label: 'Équipement',
    // demande du propriétaire du 2026-10-29 : « Entre le nouvellement créé "Personnage" et "Espace Joueur" il faudra un nouveau menu : "Equipement"
    // Dedans tu y déplacera les pages "Armes, Armures, Bouclier, Ceinture, Accessoire" en les sortant du sous-menu "Equipement" le remettant à nouveau
    // dans un sous-menu dédié. Il faudra aussi y déplacer les sous-menu "Artisanat" et "Livres & parchemins". » Une entrée par page de l'équipement
    // (« Cinq pages séparées » : lib/equipement.mjs#PAGES_DE_L_EQUIPEMENT, même libellé, même adresse), puis Artisanat et Livres & Parchemins, puis
    // « Autres » (réponse du propriétaire du 2026-10-29 sur les pages /ressources/… hors menu : « Le reste dans equipement (sous menu-autres pour
    // commencer) ») : la liste de toutes les pages de ressources, /ressources/ (pages/[type]/index.astro) ; toutes les pages /ressources/… (Composants,
    // alchimie…) ouvrent cette rubrique, sauf Familiers (Personnage).
    autres: ['ressources/'],
    items: [
      { label: 'Armes', path: 'ressources/armes/' },
      { label: 'Armures', path: 'ressources/armures/' },
      { label: 'Boucliers', path: 'ressources/bouclier/' },
      { label: 'Ceinture', path: 'ressources/objets-a-la-ceinture/' },
      { label: 'Accessoires', path: 'ressources/accessoires/' },
      { label: 'Artisanat', path: 'regles/artisanat/' },
      { label: 'Livres & Parchemins', path: 'ressources/livre-parchemin/' },
      { label: 'Autres', path: 'ressources/' },
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
