// Le plan des pages du guide (demande du propriétaire, 2026-10-16 puis 2026-10-18 : « éclater le guide pour retravailler pleinement l'organisation des
// onglets et de la présentation ») : les pages `guide/<slug>` de la base ne forment plus un seul livre servi sous /guide/, elles sont rangées ici.
//   - Les LIVRES se lisent dans l'ordre, une page à la fois (flèches, ← →, glissement du doigt, pagination colorée par section :
//     components/guide/PageDeLivre.astro) : « Découvrir » (/decouvrir/, rubrique Découvrir du menu, faite pour être vue même des non-membres) et
//     « Les bases » (/regles/, rubrique Règles). La première page d'un livre est servie à l'adresse du livre, les autres à <livre>/<slug>/.
//   - Les « Règles avancées » (/regles/avancees/) et le « Guide du MJ » (/mj/) sont des sommaires (titre et résumé de chaque page,
//     components/guide/Sommaire.astro) ; leurs pages sont à /regles/avancees/<slug>/ et /mj/<slug>/ (components/guide/PageDuGuide.astro).
//     Toute page `guide/…` qui n'est ni dans un livre ni dans le Guide du MJ est une page des Règles avancées (groupe « Autres pages de référence »
//     si aucun groupe ne la nomme) : une page ajoutée plus tard a toujours une adresse.
//   - « Artisanat » (/regles/artisanat/) est un sommaire de pages d'autres types ; « Liens » (/decouvrir/liens/), deux liens externes.
// Rien n'est caché ni filtré (réponse du propriétaire du 2026-10-18 : « Tu fait comme si de rien n'était pour l'instant. On verra les caches. », sic) : à
// terme, les non-membres ne verront que Découvrir et Règles.
// Seuls des libellés de navigation sont écrits ici (titres de livre, de section, de groupe, libellés des liens) : les textes des pages sont dans la base.
// Les identifiants de page ne changent pas (« guide/le-tour-de-jeu ») : seules leurs adresses viennent d'ici (lib/metiers.mjs#adresseDePage, puis
// cheminDePage, entryHref, pageHref, entryUrl, l'index de la recherche) ; les anciennes adresses /guide/… mènent aux nouvelles par la page 404.
// Sans aucun import : lu par lib/metiers.mjs (chaîne de l'édition du navigateur comprise), lib/guide.mjs, lib/notes-de-version.mjs (service),
// lib/fiche-regles.mjs, les composants et les tests.

/**
 * Les couleurs des sections (celles des parties de l'ancien guide), assez foncées pour un texte blanc dessus (pastilles, numéros). Elles sont aussi
 * celles des quatre zones de la fiche (pages/fiche/index.astro, par lib/guide.mjs#PARTIES).
 */
export const PARTIES = Object.freeze([
  Object.freeze({ id: 'decouvrir', titre: 'Découvrir', couleur: '#2a6f97' }),
  Object.freeze({ id: 'creer', titre: 'Créer son personnage', couleur: '#2e7d4f' }),
  Object.freeze({ id: 'jouer', titre: 'Jouer', couleur: '#b03030' }),
  Object.freeze({ id: 'progresser', titre: 'Progresser', couleur: '#6a4a9c' }),
  Object.freeze({ id: 'plus-loin', titre: 'Pour aller plus loin', couleur: '#5a6470' }),
]);
const couleur = (id) => PARTIES.find((p) => p.id === id).couleur;

const gele = (o) => Object.freeze(o);

/**
 * Les livres, dans l'ordre : `chemin` (l'adresse du livre, relative à la racine du site, où est servie sa première page), `sections` (chacune sa
 * couleur ; ses pages, dans l'ordre de lecture). Le numéro d'une page (« chapitre N sur M ») est son rang dans le livre.
 */
export const LIVRES = Object.freeze([
  gele({
    id: 'decouvrir', titre: 'Découvrir', chemin: 'decouvrir/', sections: Object.freeze([
      gele({ id: 'decouvrir', titre: 'Découvrir', couleur: couleur('decouvrir'), pages: Object.freeze(['guide/bienvenue', 'guide/le-jeu-de-role', 'guide/l-univers']) }),
      gele({
        id: 'creer', titre: 'Créer son personnage', couleur: couleur('creer'), pages: Object.freeze([
          'guide/creer-son-personnage', 'guide/choisir-sa-race', 'guide/choisir-ses-magies', 'guide/choisir-sa-classe', 'guide/caracteristiques-et-competences',
          'guide/premiers-sorts', 'guide/finaliser-son-personnage',
        ]),
      }),
      gele({ id: 'rejoindre', titre: 'Rejoindre une partie', couleur: couleur('jouer'), pages: Object.freeze(['guide/campagne-ou-scenario-one-shot']) }),
    ]),
  }),
  gele({
    id: 'bases', titre: 'Les bases', chemin: 'regles/', sections: Object.freeze([
      gele({
        id: 'jouer', titre: 'Jouer', couleur: couleur('jouer'), pages: Object.freeze([
          'guide/reussir-une-action', 'guide/le-tour-de-jeu', 'guide/attaquer-et-se-defendre', 'guide/l-equipement', 'guide/les-degats', 'guide/les-postures',
          'guide/la-magie-en-jeu', 'guide/blessures-et-etats',
        ]),
      }),
      gele({ id: 'progresser', titre: 'Progresser', couleur: couleur('progresser'), pages: Object.freeze(['guide/la-montee-de-niveau', 'guide/s-entrainer-et-exercer-un-metier']) }),
      gele({ id: 'plus-loin', titre: 'Pour aller plus loin', couleur: couleur('plus-loin'), pages: Object.freeze(['guide/aide-memoire', 'guide/lexique']) }),
    ]),
  }),
]);

/** Le livre Découvrir : son adresse est l'accueil des pages du guide (ancienne adresse /guide/, badge « Guide » de l'index du wiki). */
export const ACCUEIL_DU_GUIDE = LIVRES[0].chemin;

/**
 * Bloc de navigation rendu par le gabarit sous une page de livre (pas du texte de la page) : les rubriques qu'elle présente, par leur clé de
 * lib/types.mjs (le lien mène à `<clé>/`, le libellé est le titre de la rubrique, TYPES[clé].label).
 */
export const RUBRIQUES_SOUS_LA_PAGE = Object.freeze({ 'guide/l-univers': Object.freeze(['races', 'magies', 'classes']) });

/**
 * Les Règles avancées : un sommaire en groupes (titre et résumé de chaque page), chaque groupe avec son ancre (`id`). Un groupe nomme ses pages
 * (`pages`, dans cet ordre), ou les prend par le début de leur id (`prefixe`, ordre des titres) ; le dernier (`reste`) reçoit toute autre page
 * `guide/…` qui n'est ni dans un livre, ni dans le Guide du MJ, ni dans un groupe précédent (ordre des titres).
 */
export const REGLES_AVANCEES = gele({
  titre: 'Règles avancées', chemin: 'regles/avancees/', groupes: Object.freeze([
    gele({
      id: 'magie-et-mode-hyper', titre: 'Magie et Mode Hyper', pages: Object.freeze([
        'guide/le-mode-hyper', 'guide/mode-hyper-magie', 'guide/liste-des-effets-mode-hyper', 'guide/liste-des-effets-mode-super',
        'guide/alterations-d-etats-et-mode-hyper', 'guide/resistance-faiblesse-magie',
      ]),
    }),
    gele({
      id: 'combat-et-actions', titre: 'Combat et actions', pages: Object.freeze([
        'guide/situations-avancees', 'guide/actions-et-mouvements', 'guide/vitesse-et-portee', 'guide/jet-de-des', 'guide/formule-des-degats',
      ]),
    }),
    gele({ id: 'alterations-d-etat', titre: 'Altérations d’état', pages: Object.freeze(['guide/liste-des-alterations-d-etat']) }),
    gele({ id: 'alignement', titre: 'Alignement', pages: Object.freeze(['guide/alignement', 'guide/les-neuf-alignements']) }),
    // pièges, portes, météo, « Donjon pas bon » : « dans les règles avancées, pour tout le monde » (réponse du propriétaire du 2026-10-18)
    gele({
      id: 'exploration-et-voyage', titre: 'Exploration et voyage', pages: Object.freeze([
        'guide/distance-et-voyage', 'guide/meteo', 'guide/les-pieges', 'guide/les-portes', 'guide/donjon-pas-bon',
      ]),
    }),
    gele({ id: 'fiche-de-personnage', titre: 'La fiche de personnage, case par case', prefixe: 'guide/fiche-' }),
    gele({ id: 'autres', titre: 'Autres pages de référence', reste: true }),
  ]),
});

/** Le Guide du MJ : un sommaire (titre et résumé de chaque page), ses pages à /mj/<slug>/. */
export const GUIDE_DU_MJ = gele({ titre: 'Guide du MJ', chemin: 'mj/', pages: Object.freeze(['guide/un-maitre-du-jeu', 'guide/guide-pour-mj-maverick']) });

/**
 * L'Artisanat : un sommaire de pages d'autres types (titre et résumé de chaque page). « ressources/composants » n'est pas une page du wiki mais la page
 * Composants (pages/ressources/composants.astro, lib/composants-db.mjs#PAGE_DES_COMPOSANTS).
 */
export const ARTISANAT = gele({
  titre: 'Artisanat', chemin: 'regles/artisanat/', pages: Object.freeze([
    'ressources/composants', 'ressources/alchimie', 'ressources/alchimie-primitive', 'ressources/alchimie-liste-ingredients', 'metiers/regles-des-metiers',
  ]),
});

/**
 * La page Liens (rubrique Découvrir) : deux liens externes, rien d'autre. Le Discord : réponse du propriétaire du 2026-10-18 (« https://discord.gg/GMGBnjzfMk »),
 * aussi cité par les sources de « Bienvenue » ; Tipeee : plan du propriétaire du 2026-10-16 (« un ensemble de liens, sur le discord […] et le
 * https://fr.tipeee.com/maverickjdr »).
 */
export const LIENS = gele({
  titre: 'Liens', chemin: 'decouvrir/liens/', liens: Object.freeze([
    gele({ libelle: 'Serveur Discord « L’univers de Maverick »', url: 'https://discord.gg/GMGBnjzfMk' }),
    gele({ libelle: 'Maverick JDR sur Tipeee', url: 'https://fr.tipeee.com/maverickjdr' }),
  ]),
});

/** Les quatre cartes « Par où commencer ? » de l'accueil, et les entrées du menu Découvrir qui mènent à ces pages, dans cet ordre. */
export const PAR_OU_COMMENCER = Object.freeze(['guide/bienvenue', 'guide/l-univers', 'guide/creer-son-personnage', 'guide/campagne-ou-scenario-one-shot']);

/** Les pages Astro écrites à côté des pages d'un livre (decouvrir/liens, regles/artisanat, regles/avancees/) : aucune page d'un livre ne prend ce nom. */
export const NOMS_RESERVES = Object.freeze(['liens', 'artisanat', 'avancees']);

const slugDe = (id) => id.slice(id.indexOf('/') + 1);

/** Les pages d'un livre dans l'ordre : [{ id, numero, section }] (numéro 1…M dans le livre). */
export function pagesDuLivre(livre) {
  let numero = 0;
  return livre.sections.flatMap((section) => section.pages.map((id) => ({ id, numero: ++numero, section })));
}

const PLACES = new Map(LIVRES.flatMap((livre) => {
  const pages = pagesDuLivre(livre);
  return pages.map((p, i) => [p.id, { livre, section: p.section, numero: p.numero, total: pages.length, rang: i }]);
}));

/** La place d'une page dans un livre : { livre, section, numero, total }, ou null si la page n'est dans aucun livre. */
export function livreDe(id) {
  const place = PLACES.get(id);
  return place ? { livre: place.livre, section: place.section, numero: place.numero, total: place.total } : null;
}

/** Vrai si la page est dans un livre (Découvrir, Les bases). */
export const estDansUnLivre = (id) => PLACES.has(id);

/** Vrai si la page est dans le Guide du MJ. */
export const estDuGuideDuMj = (id) => GUIDE_DU_MJ.pages.includes(id);

/** La page et ses voisines dans son livre : { precedent, suivant } (ids, null au bord : flèche grisée), ou null si la page n'est dans aucun livre. */
export function voisinsDansLeLivre(id) {
  const place = PLACES.get(id);
  if (!place) return null;
  const pages = pagesDuLivre(place.livre);
  return { precedent: pages[place.rang - 1]?.id ?? null, suivant: pages[place.rang + 1]?.id ?? null };
}

/**
 * Où mène la dernière page d'un livre : le lien du bas (« Suivant › ») qui serait grisé mène à la suite du plan, le livre suivant puis les Règles
 * avancées (Découvrir → Les bases → Règles avancées) : { titre, chemin }. Les flèches, le clavier et le glissement du doigt restent dans le livre.
 */
export function suiteDuLivre(livre) {
  const suite = LIVRES[LIVRES.indexOf(livre) + 1] ?? REGLES_AVANCEES;
  return { titre: suite.titre, chemin: suite.chemin };
}

/**
 * L'adresse d'une page `guide/<slug>`, relative à la racine du site : la première page d'un livre à l'adresse du livre, une autre page d'un livre à
 * `<livre>/<slug>/`, une page du Guide du MJ à `mj/<slug>/`, toute autre page `guide/…` à `regles/avancees/<slug>/` (les Règles avancées).
 */
export function adresseDuGuide(id) {
  const place = PLACES.get(id);
  if (place) return place.rang === 0 ? place.livre.chemin : `${place.livre.chemin}${slugDe(id)}/`;
  if (estDuGuideDuMj(id)) return `${GUIDE_DU_MJ.chemin}${slugDe(id)}/`;
  return `${REGLES_AVANCEES.chemin}${slugDe(id)}/`;
}

/**
 * Où se range une page `guide/…`, pour la nommer et l'ordonner (notes de version, aide « Entraînement » de la fiche) : { rubrique, rang, numero } ;
 * `rubrique` est le titre du livre, « Règles avancées » ou « Guide du MJ », `rang` l'ordre de ces rubriques, `numero` le rang de la page dans son livre
 * (null hors livre).
 */
export function placeDansLeGuide(id) {
  const place = PLACES.get(id);
  if (place) return { rubrique: place.livre.titre, rang: LIVRES.indexOf(place.livre), numero: place.numero };
  if (estDuGuideDuMj(id)) return { rubrique: GUIDE_DU_MJ.titre, rang: LIVRES.length + 1, numero: null };
  return { rubrique: REGLES_AVANCEES.titre, rang: LIVRES.length, numero: null };
}

const parTitre = (a, b) => String(a.data?.title ?? a.id).localeCompare(String(b.data?.title ?? b.id), 'fr');

/**
 * Les groupes des Règles avancées remplis des pages données (`entries` : les pages chargées, { id, data: { title } }) : [{ id, titre, pages }] (`pages` :
 * les éléments de `entries`), un groupe vide omis. Une page nommée par un groupe et absente de `entries` est sautée (verifierLePlan la signale).
 */
export function groupesDesReglesAvancees(entries) {
  const guide = entries.filter((e) => e.id.startsWith('guide/') && !estDansUnLivre(e.id) && !estDuGuideDuMj(e.id));
  const parId = new Map(guide.map((e) => [e.id, e]));
  const pris = new Set();
  const groupes = [];
  for (const g of REGLES_AVANCEES.groupes) {
    let pages;
    if (g.pages) pages = g.pages.map((id) => parId.get(id)).filter(Boolean);
    else if (g.prefixe) pages = guide.filter((e) => e.id.startsWith(g.prefixe) && !pris.has(e.id)).sort(parTitre);
    else pages = guide.filter((e) => !pris.has(e.id)).sort(parTitre);
    for (const p of pages) pris.add(p.id);
    if (pages.length) groupes.push({ id: g.id, titre: g.titre, pages });
  }
  return groupes;
}

/** Le groupe des Règles avancées d'une page (un élément de REGLES_AVANCEES.groupes), ou null si elle est dans un livre ou le Guide du MJ. */
export function groupeDeLaPage(id) {
  if (!id.startsWith('guide/') || estDansUnLivre(id) || estDuGuideDuMj(id)) return null;
  const nomme = REGLES_AVANCEES.groupes.find((g) => g.pages?.includes(id));
  if (nomme) return nomme;
  return REGLES_AVANCEES.groupes.find((g) => g.prefixe && id.startsWith(g.prefixe)) ?? REGLES_AVANCEES.groupes.find((g) => g.reste);
}

/**
 * Contrôle du plan contre les pages chargées (`entries` : { id, data: { status } }), appelé au build par les routes : chaque page nommée (livres,
 * Guide du MJ, groupes, cartes « Par où commencer ? ») existe et n'est pas une page d'exemple, aucune n'est nommée deux fois, aucune page d'un livre ne
 * prend un nom réservé, aucune section n'est vide. Lève une erreur (le build s'arrête plutôt que de montrer une pagination fausse) ; rend `entries`.
 */
export function verifierLePlan(entries) {
  const parId = new Map(entries.map((e) => [e.id, e]));
  const nommees = [
    ...LIVRES.flatMap((l) => l.sections.flatMap((s) => {
      if (!s.pages.length) throw new Error(`plan du guide : la section « ${s.titre} » du livre « ${l.titre} » est vide`);
      return s.pages.map((id) => [id, `livre « ${l.titre} »`]);
    })),
    ...GUIDE_DU_MJ.pages.map((id) => [id, GUIDE_DU_MJ.titre]),
    ...REGLES_AVANCEES.groupes.flatMap((g) => (g.pages ?? []).map((id) => [id, `groupe « ${g.titre} »`])),
  ];
  const vues = new Map();
  for (const [id, ou] of nommees) {
    if (vues.has(id)) throw new Error(`plan du guide : ${id} est nommée deux fois (${vues.get(id)}, ${ou})`);
    vues.set(id, ou);
    const e = parId.get(id);
    if (!e) throw new Error(`plan du guide : ${id} (${ou}) n'existe pas`);
    if (e.data?.status === 'example') throw new Error(`plan du guide : ${id} (${ou}) est une page d'exemple`);
    if (!id.startsWith('guide/')) throw new Error(`plan du guide : ${id} (${ou}) n'est pas une page du guide`);
  }
  for (const l of LIVRES) {
    for (const { id } of pagesDuLivre(l)) if (NOMS_RESERVES.includes(slugDe(id))) throw new Error(`plan du guide : ${id} prend un nom réservé (${NOMS_RESERVES.join(', ')})`);
  }
  for (const id of PAR_OU_COMMENCER) if (!vues.has(id)) throw new Error(`plan du guide : la carte « Par où commencer ? » ${id} n'est dans aucun livre`);
  return entries;
}
