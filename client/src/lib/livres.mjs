// Le plan des pages du guide (demandes du propriétaire, 2026-10-16 puis 2026-10-18 : « éclater le guide pour retravailler pleinement l'organisation des
// onglets et de la présentation », puis « refaire toutes les anciennes pages du guide. Retirer le mécanisme de swipe, et les flèches suivant / précédent et
// la pagination ») : les pages `guide/<slug>` de la base sont rangées ici. Plus de livre lu dans l'ordre : chaque page se lit seule, comme une page du
// wiki (components/guide/PageDuGuide.astro : fil d'Ariane vers sa rubrique ou son sommaire, titre, texte, blocs, pied de page ; plus aucune source
// affichée : elles ne se lisent que sur /archives/, réponse du propriétaire du 2026-10-22).
//   - « Découvrir » (/decouvrir/, en tête de la rubrique Règles du menu — l'ancienne rubrique Découvrir, renommée le 2026-10-29 —, faite pour être vue
//     même des non-membres) : UNE page par entrée du menu (choix du propriétaire du 2026-10-18) — Bienvenue (servie à /decouvrir/, entrée
//     « Découvrir »), L'univers, Créer son personnage (les six étapes sur une seule page). Les autres à /decouvrir/<slug>/. La page « Rejoindre une
//     partie » est supprimée (demande du propriétaire du 2026-11-05 : « Efface la page "Rejoindre une partie" et son lien. ») ; son ancienne adresse
//     n'est renvoyée nulle part (réponse « Page 404 (Recommandé) ») : la page 404 la dit introuvable. Les liens Discord et Tipeee et l'encart « Notre prochaine rencontre IRL » sont sur l'accueil
//     (LIENS_ET_RENCONTRE ; sur la page « Liens » jusqu'au 2026-10-22, puis sous le texte de Bienvenue jusqu'au 2026-10-23 ; l'ancienne adresse de la
//     page Liens n'est plus renvoyée nulle part).
//   - « Les bases » (/regles/, rubrique Règles) : une liste de pages, sans groupes, sur le modèle de la chronologie (demande du propriétaire du
//     2026-11-05 : « Au lieu de lister les différentes pages, réécrit directement le contenu. […] Inutile de séparer les catégories les Jouer /
//     Progresser / Pour aller plus loin. Pour la présation je préfèrera un menu latéral sous le même modèle que la chronologie. ») : à gauche, le menu
//     des titres, à droite le texte de la page choisie (components/guide/MenuLateral.astro). Chaque page à /regles/<slug>/ ; /regles/ montre la première
//     (`ouverture`, « Réussir une action »), son adresse canonique restant /regles/<slug>/.
//   - Les « Règles avancées » (/regles/avancees/) : de même, une liste de pages sans groupes dans le même menu latéral (demande du propriétaire du
//     2026-11-05 : « Suite à la modification de la page "les bases" refait la même avec les "règles avancées", tout sur la même page avec menu
//     lattéral. » ; réponses : « Liste sans groupes » — « Comme Les bases : une seule liste de titres, dans l'ordre actuel des groupes. » — et
//     « Le Mode Hyper » pour la page d'ouverture). Chaque page à /regles/avancees/<slug>/ ; /regles/avancees/ montre `ouverture` (« Le Mode Hyper »),
//     son adresse canonique restant /regles/avancees/le-mode-hyper/. Toute page `guide/…` qui n'est ni dans Découvrir, ni dans Les bases, ni dans le
//     Guide du MJ est une page des Règles avancées (en fin de liste si le plan ne la nomme pas) : une page ajoutée plus tard a toujours une adresse et
//     une entrée dans le menu.
//   - Le « Guide du MJ » (/mj/) est un sommaire ; ses pages sont à /mj/<slug>/.
//   - « Artisanat » (/regles/artisanat/) est un sommaire de pages d'autres types.
// Chaque groupe de Découvrir porte l'id d'une ancienne partie du guide (PARTIES, `partie`) : la couleur de cette partie (sa classe de la palette,
// `.couleur-partie-<id>` : lib/palette-css.mjs#classeDePartie, valeur dans lib/parties-couleurs.mjs) colore ses pages (filet du titre, blocs) et ses
// cartes « Par où commencer ? ». Les pages des Bases n'ont pas de partie : l'accent du site, comme les Règles avancées et le Guide du MJ (réponse du
// propriétaire du 2026-11-05 : « Une seule couleur », puis « Accent du site »). Aucune couleur n'est écrite ici (le navigateur reçoit ce plan).
// Pages fusionnées (2026-10-18) : « Le jeu de rôle, comment ça marche ? » dans Bienvenue, les six étapes de la création dans Créer son personnage
// (PAGES_ABSORBEES) ; elles ne sont plus dans la base, leurs adresses mènent à la page qui les absorbe (page 404 : lib/metiers.mjs#renvoisDuGuide).
// Rien n'est caché ni filtré (réponse du propriétaire du 2026-10-18 : « Tu fait comme si de rien n'était pour l'instant. On verra les caches. », sic) : à
// terme, les non-membres ne verront que les deux premières rubriques du menu, « Règles et Personnage » (réponse du propriétaire du 2026-10-29 ;
// lib/nav.mjs).
// Seuls des libellés de navigation sont écrits ici (titres de rubrique, de groupe, libellés des liens) : les textes des pages sont dans la base. Une
// exception : la présentation du lien Discord de l'accueil (LIENS_ET_RENCONTRE.liens[].presentation), un texte écrit ici, donc ni modifiable sur le site
// de dev (un commit le change), ni cherché par la recherche, et emporté par la chaîne de l'édition du navigateur avec le reste du plan.
// Les identifiants de page ne changent pas (« guide/le-tour-de-jeu ») : seules leurs adresses viennent d'ici (lib/metiers.mjs#adresseDePage, puis
// cheminDePage, entryHref, pageHref, entryUrl, l'index de la recherche) ; les anciennes adresses /guide/… mènent aux nouvelles par la page 404.
// Sans aucun import : lu par lib/metiers.mjs (chaîne de l'édition du navigateur comprise), lib/guide.mjs, lib/notes-de-version.mjs (service),
// lib/fiche-regles.mjs, les composants et les tests.

/**
 * Les parties de l'ancien guide, dont les groupes de Découvrir prennent la couleur (`partie` d'un groupe : l'id d'une partie). Leurs couleurs sont dans
 * lib/parties-couleurs.mjs#COULEURS_DES_PARTIES (même clé), posées par leur classe (lib/palette-css.mjs#classeDePartie) ; elles sont aussi celles des
 * quatre zones de la fiche (pages/fiche/index.astro : creer, jouer, decouvrir, progresser). « Pour aller plus loin » ne colore plus rien depuis que
 * Les bases n'ont plus de groupes (2026-11-05) ; elle reste une partie de l'ancien guide, que nomme le registre de la migration 0064
 * (data/migrations/0064-guide-sans-chapitres.json, test/guide-sans-chapitres.test.mjs).
 */
export const PARTIES = Object.freeze([
  Object.freeze({ id: 'decouvrir', titre: 'Découvrir' }),
  Object.freeze({ id: 'creer', titre: 'Créer son personnage' }),
  Object.freeze({ id: 'jouer', titre: 'Jouer' }),
  Object.freeze({ id: 'progresser', titre: 'Progresser' }),
  Object.freeze({ id: 'plus-loin', titre: 'Pour aller plus loin' }),
]);
/** L'id d'une partie, vérifié (une partie que PARTIES ne nomme pas arrête le chargement du plan). */
const partie = (id) => {
  if (!PARTIES.some((p) => p.id === id)) throw new Error(`lib/livres.mjs : partie inconnue « ${id} »`);
  return id;
};

const gele = (o) => Object.freeze(o);

/**
 * Découvrir : trois pages, une par entrée du menu, dans l'ordre du menu ; `accueil` est servie à l'adresse de la rubrique (/decouvrir/), les autres à
 * /decouvrir/<slug>/. Les groupes ne donnent que la partie (la couleur) de leurs pages (Découvrir n'a pas de sommaire).
 */
export const DECOUVRIR = gele({
  id: 'decouvrir', titre: 'Découvrir', chemin: 'decouvrir/', accueil: 'guide/bienvenue', groupes: Object.freeze([
    gele({ id: 'decouvrir', titre: 'Découvrir', partie: partie('decouvrir'), pages: Object.freeze(['guide/bienvenue', 'guide/l-univers']) }),
    gele({ id: 'creer', titre: 'Créer son personnage', partie: partie('creer'), pages: Object.freeze(['guide/creer-son-personnage']) }),
  ]),
});

/**
 * Les bases : douze pages, sans groupes ni partie (l'accent du site), dans l'ordre du menu latéral (components/guide/MenuLateral.astro) ; chaque page à
 * /regles/<slug>/. `accueil` est null : aucune page n'est servie à /regles/ sous cette adresse ; /regles/ (pages/regles/index.astro) montre le menu et
 * la page `ouverture` (« Réussir une action » : réponse du propriétaire du 2026-11-05), dont l'adresse canonique reste /regles/<slug>/.
 */
export const LES_BASES = gele({
  id: 'bases', titre: 'Les bases', chemin: 'regles/', accueil: null, ouverture: 'guide/reussir-une-action', pages: Object.freeze([
    'guide/reussir-une-action', 'guide/le-tour-de-jeu', 'guide/attaquer-et-se-defendre', 'guide/l-equipement', 'guide/les-degats', 'guide/les-postures',
    'guide/la-magie-en-jeu', 'guide/blessures-et-etats', 'guide/la-montee-de-niveau', 'guide/s-entrainer-et-exercer-un-metier', 'guide/aide-memoire',
    'guide/lexique',
  ]),
});

/** Les deux rubriques écrites pour le site (Découvrir, Les bases), dans l'ordre du menu. */
export const RUBRIQUES_DU_GUIDE = Object.freeze([DECOUVRIR, LES_BASES]);

/** L'adresse de l'ancien /guide/ (badge « Guide » de l'index du wiki, renvoi de la page 404) : Découvrir. */
export const ACCUEIL_DU_GUIDE = DECOUVRIR.chemin;

/**
 * Bloc de navigation rendu par le gabarit sous une page (pas du texte de la page) : les rubriques qu'elle présente, par leur clé de lib/types.mjs (le lien
 * mène à `<clé>/`, le libellé est le titre de la rubrique, TYPES[clé].label).
 */
export const RUBRIQUES_SOUS_LA_PAGE = Object.freeze({ 'guide/l-univers': Object.freeze(['races', 'magies', 'classes']) });

/**
 * Les Règles avancées : une liste de pages, sans groupes ni partie (l'accent du site), dans l'ordre du menu latéral (components/guide/MenuLateral.astro),
 * comme Les bases (réponse du propriétaire du 2026-11-05 : « Liste sans groupes » — « Comme Les bases : une seule liste de titres, dans l'ordre actuel
 * des groupes. »). L'ordre est celui des anciens groupes du sommaire : Magie et Mode Hyper, Combat et actions, Altérations d'état, Alignement,
 * Exploration et voyage (`pages`, nommées dans cet ordre), puis la fiche de personnage case par case (les pages dont l'id commence par un des
 * `prefixes`, un préfixe après l'autre, chacun dans l'ordre des titres), puis toute autre page `guide/…` qui n'est ni dans Découvrir, ni dans Les
 * bases, ni dans le Guide du MJ, ni prise avant (ordre des titres) : une page ajoutée plus tard a toujours une adresse (adresseDuGuide) et une entrée
 * dans le menu (pagesDesReglesAvancees). Chaque page à /regles/avancees/<slug>/ ; /regles/avancees/ (pages/regles/avancees/index.astro) montre le menu
 * et la page `ouverture` (« Le Mode Hyper » : réponse du propriétaire du 2026-11-05), dont l'adresse canonique reste /regles/avancees/<slug>/.
 */
export const REGLES_AVANCEES = gele({
  id: 'avancees', titre: 'Règles avancées', chemin: 'regles/avancees/', ouverture: 'guide/le-mode-hyper', pages: Object.freeze([
    // Magie et Mode Hyper
    'guide/le-mode-hyper', 'guide/mode-hyper-magie', 'guide/liste-des-effets-mode-hyper', 'guide/liste-des-effets-mode-super',
    'guide/alterations-d-etats-et-mode-hyper', 'guide/resistance-faiblesse-magie',
    // Combat et actions
    'guide/situations-avancees', 'guide/actions-et-mouvements', 'guide/vitesse-et-portee', 'guide/jet-de-des', 'guide/formule-des-degats',
    // Altérations d'état ; Alignement
    'guide/liste-des-alterations-d-etat', 'guide/alignement', 'guide/les-neuf-alignements',
    // Exploration et voyage — pièges, portes, météo, « Donjon pas bon » : « dans les règles avancées, pour tout le monde » (réponse du propriétaire
    // du 2026-10-18)
    'guide/distance-et-voyage', 'guide/meteo', 'guide/les-pieges', 'guide/les-portes', 'guide/donjon-pas-bon',
  ]),
  // la fiche de personnage, case par case (« Fiche de personnage : … »)
  prefixes: Object.freeze(['guide/fiche-']),
});

/**
 * Le Guide du MJ : un sommaire (titre et résumé de chaque page), ses pages à /mj/<slug>/. « « Campagne » ou « Scénario one shot » ? » y passe (choix du
 * propriétaire du 2026-10-18 ; elle était la dernière page du livre Découvrir).
 */
export const GUIDE_DU_MJ = gele({
  titre: 'Guide du MJ', chemin: 'mj/', pages: Object.freeze(['guide/un-maitre-du-jeu', 'guide/guide-pour-mj-maverick', 'guide/campagne-ou-scenario-one-shot']),
});

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
 * Sur l'accueil, sous la bienvenue et le carrousel, avant « Par où commencer ? » (components/accueil/LiensEtRencontre.astro, posé par pages/index.astro ;
 * demandes du propriétaire du 2026-10-23 : « Ces 3 blocs auraient plus leur place dans l'onglet d'acceuil. », puis « Sous la bienvenue et le
 * carrousel ») : les deux liens externes, chacun sous un titre avec sa présentation,
 * puis l'encart « Notre prochaine rencontre IRL » (`rencontre`). Avant : sur la page Liens, puis sous le texte de Bienvenue (réponse du propriétaire du
 * 2026-10-22 à « L'encart IRL et les présentations Discord / Tipeee sont sur la page Liens. Les voulez-vous plutôt sur Bienvenue ? » : « Bonne idée. »,
 * puis, pour la page Liens, « Supprimer la page » : « Plus d'entrée Liens au menu : tout est sur Bienvenue. L'ancienne adresse renverrait vers
 * Bienvenue. »).
 *   - Le Discord : réponse du propriétaire du 2026-10-18 (« https://discord.gg/GMGBnjzfMk »), aussi cité par les sources de « Bienvenue » ; sa
 *     présentation (`presentation`, Markdown de quelques phrases ; demande du 2026-10-18 : « Étoffe un peu la présentation pour les liens Discord et
 *     Tipeee ») dit le texte d'accueil du propriétaire (« L'activité JDR se fait principalement sur le Discord officiel ») et docs/sources.md (« Les
 *     salons du groupe contiennent, pour la plupart, des liens vers les Google Docs »).
 *   - Tipeee : plan du propriétaire du 2026-10-16 (« un ensemble de liens, sur le discord […] et le https://fr.tipeee.com/maverickjdr ») ; sa
 *     présentation n'est pas écrite ici (`presentation` absente) : c'est la partie « Bienvenue » de la page Tipeee elle-même, reprise en direct
 *     (réponses du 2026-10-22 : « autant en faire un hook pour que ça reprenne directement le texte au cas où il change sur Tipee », « La partie
 *     « Bienvenue » », « En direct par le serveur ») — l'instantané livré avec le site au build (sources/tipeee/bienvenue.json, lib/tipeee.mjs), puis
 *     le texte du service (GET /api/tipeee/, src/scripts/tipeee.mjs).
 *   - L'encart : un titre fixe, l'annonce (table annonce, ligne `rencontre.annonce` : Markdown modifiable sur le site de dev, partie en production par la
 *     mise à jour) et le texte d'attente quand elle est vide (demande du propriétaire du 2026-10-18 : « Laisse également un encart « Notre prochaine
 *     rencontre IRL » pour faire la place à une annonce dédiée aux prochaines conventions où Maverick sera présent »).
 * `page` : l'id de l'accueil pour le mode modification du site de dev (noté au journal avec chaque enregistrement : components/edition/Edition.astro)
 * et dans les avertissements des [[liens]] cassés ; ce n'est pas une page du wiki.
 * `titre` : le titre de l'accueil (pages/index.astro, « Accueil », celui du fil d'Ariane), qui nomme l'encart dans la note de version
 * (lib/notes-de-version.mjs : « Accueil › Notre prochaine rencontre IRL »).
 * Les `id` (ancres « lien-discord », « lien-tipeee », « prochaine-rencontre ») sont ceux de l'ancienne page Liens, figés : un lien écrit dans une page
 * y mène (« /#lien-discord », « /#prochaine-rencontre »). L'ancienne adresse de la page Liens
 * (/decouvrir/liens/) n'est plus renvoyée nulle part (réponse du propriétaire du 2026-10-23 : « supprimer ce lien ») : la page 404 la dit introuvable.
 */
export const LIENS_ET_RENCONTRE = gele({
  page: 'accueil', titre: 'Accueil', liens: Object.freeze([
    gele({ id: 'discord', libelle: 'Serveur Discord « L’univers de Maverick »', url: 'https://discord.gg/GMGBnjzfMk', presentation:
      '« L’univers de Maverick » est le serveur Discord officiel du jeu : c’est là que se fait l’essentiel de l’activité de jeu de rôle. Plusieurs de ses salons donnent aussi les liens vers les documents de règles et de lore dont ce site est tiré.',
    }),
    gele({ id: 'tipeee', libelle: 'Maverick JDR sur Tipeee', url: 'https://fr.tipeee.com/maverickjdr', tipeee: true }),
  ]),
  rencontre: gele({
    id: 'prochaine-rencontre', titre: 'Notre prochaine rencontre IRL', annonce: 'prochaine-rencontre-irl', vide: 'Aucune rencontre annoncée pour le moment.',
  }),
});

/** Les trois cartes « Par où commencer ? » de l'accueil, et les entrées de la rubrique Règles du menu qui mènent à ces pages, dans cet ordre : les pages de Découvrir. */
export const PAR_OU_COMMENCER = Object.freeze(DECOUVRIR.groupes.flatMap((g) => g.pages));

/** Les pages Astro écrites à côté des pages du plan (regles/artisanat, regles/avancees/) : aucune page de Découvrir ni des Bases ne prend ce nom. */
export const NOMS_RESERVES = Object.freeze(['artisanat', 'avancees']);

/**
 * Les pages fusionnées dans une autre (choix du propriétaire du 2026-10-18 : « Bienvenue absorbe « Le jeu de rôle, comment ça marche » » ; « Créer son
 * personnage = les six étapes sur une seule page ») : page retirée → page qui l'absorbe. Elles ne sont plus dans la base ; leurs anciennes adresses
 * (/guide/<slug>/ et /decouvrir/<slug>/) mènent à la page qui les absorbe, à l'endroit où se lit leur contenu (ANCRES_DES_PAGES_ABSORBEES) — l'ancre
 * et la requête d'origine gardées (lib/metiers.mjs#renvoisDuGuide, page 404) —, comme un lien Markdown écrit vers elles (lib/guide.mjs#adresseDesAnciensLiens).
 */
export const PAGES_ABSORBEES = Object.freeze({
  'guide/le-jeu-de-role': 'guide/bienvenue',
  'guide/choisir-sa-race': 'guide/creer-son-personnage',
  'guide/choisir-ses-magies': 'guide/creer-son-personnage',
  'guide/choisir-sa-classe': 'guide/creer-son-personnage',
  'guide/caracteristiques-et-competences': 'guide/creer-son-personnage',
  'guide/premiers-sorts': 'guide/creer-son-personnage',
  'guide/finaliser-son-personnage': 'guide/creer-son-personnage',
});

/**
 * Où se lit maintenant chaque page fusionnée, dans la page qui l'absorbe : l'id de son intertitre (posé par le rendu Markdown, github-slugger). Son
 * ancienne adresse y mène quand elle n'écrit pas sa propre ancre (adresseDeLaPageAbsorbee : page 404, liens Markdown écrits vers elle). Un intertitre
 * renommé change son id : test/livres.test.mjs compare ces ancres aux intertitres des pages, test/site-html.test.mjs au site construit.
 */
export const ANCRES_DES_PAGES_ABSORBEES = Object.freeze({
  'guide/le-jeu-de-role': 'le-jeu-de-rôle-comment-ça-marche-',
  'guide/choisir-sa-race': 'étape-1--imaginer-son-personnage-et-choisir-sa-race',
  'guide/choisir-ses-magies': 'étape-2--choisir-ses-magies',
  'guide/choisir-sa-classe': 'étape-3--choisir-sa-classe',
  'guide/caracteristiques-et-competences': 'étape-4--répartir-caractéristiques-et-compétences',
  'guide/premiers-sorts': 'étape-5--choisir-ses-premiers-sorts',
  'guide/finaliser-son-personnage': 'étape-6--finaliser-son-personnage',
});

/** L'adresse où mène une page fusionnée (`ancienne`, une clé de PAGES_ABSORBEES) : la page qui l'absorbe (`cheminDe` : lib/metiers.mjs#cheminDePage), à son ancre. */
export const adresseDeLaPageAbsorbee = (ancienne, cheminDe) => `${cheminDe(PAGES_ABSORBEES[ancienne])}#${ANCRES_DES_PAGES_ABSORBEES[ancienne]}`;

/**
 * Les adresses du plan précédent (livres Découvrir et Les bases, 2026-10-18) qui ont changé, hors pages absorbées : adresse → page qui y est maintenant.
 * « « Campagne » ou « Scénario one shot » ? » était la dernière page de Découvrir ; elle est dans le Guide du MJ. (/regles/ reste une adresse : le
 * menu des Bases, ouvert sur leur première page.) La page « Liens » (/decouvrir/liens/), supprimée le 2026-10-22, menait à Bienvenue jusqu'au 2026-10-23 ; elle n'est plus
 * renvoyée nulle part (réponse du propriétaire du 2026-10-23 : « supprimer ce lien »).
 */
export const ADRESSES_DU_PLAN_PRECEDENT = Object.freeze({
  'decouvrir/campagne-ou-scenario-one-shot/': 'guide/campagne-ou-scenario-one-shot',
});

const slugDe = (id) => id.slice(id.indexOf('/') + 1);

/**
 * Les pages d'une rubrique (Découvrir, Les bases) dans l'ordre : [{ id, groupe, ordre }] (`ordre` : 0…M − 1 dans la rubrique ; `groupe` : celui de
 * Découvrir, null pour Les bases, qui n'en a pas).
 */
export function pagesDeLaRubrique(rubrique) {
  if (!rubrique.groupes) return rubrique.pages.map((id, ordre) => ({ id, groupe: null, ordre }));
  let ordre = 0;
  return rubrique.groupes.flatMap((groupe) => groupe.pages.map((id) => ({ id, groupe, ordre: ordre++ })));
}

const PLACES = new Map(RUBRIQUES_DU_GUIDE.flatMap((rubrique) => pagesDeLaRubrique(rubrique).map((p) => [p.id, { rubrique, groupe: p.groupe, ordre: p.ordre }])));

/** La place d'une page dans Découvrir ou Les bases : { rubrique, groupe, ordre }, ou null si elle n'y est pas. */
export function rubriqueDe(id) {
  const place = PLACES.get(id);
  return place ? { ...place } : null;
}

/** Vrai si la page est dans Découvrir ou Les bases (les pages écrites pour le site, pas les pages de référence importées). */
export const estDansDecouvrirOuLesBases = (id) => PLACES.has(id);

/** Vrai si la page est dans le Guide du MJ. */
export const estDuGuideDuMj = (id) => GUIDE_DU_MJ.pages.includes(id);

/** Vrai si la page est dans Les bases (menu latéral de components/guide/MenuLateral.astro). */
export const estDesBases = (id) => PLACES.get(id)?.rubrique === LES_BASES;

/**
 * Vrai si la page est une page des Règles avancées : toute page `guide/…` qui n'est ni dans Découvrir, ni dans Les bases, ni dans le Guide du MJ, que
 * le plan la nomme ou non (adresseDuGuide lui donne alors /regles/avancees/<slug>/).
 */
export const estDesReglesAvancees = (id) => id.startsWith('guide/') && !PLACES.has(id) && !estDuGuideDuMj(id);

/**
 * La partie d'une page de Découvrir (celle de son groupe : l'id de sa couleur, lib/palette-css.mjs#classeDePartie), ou null : une page des Bases (l'accent
 * du site, réponse du propriétaire du 2026-11-05 : « Accent du site ») ou de référence.
 */
export const partieDeLaPage = (id) => PLACES.get(id)?.groupe?.partie ?? null;

/**
 * L'adresse d'une page `guide/<slug>`, relative à la racine du site : Bienvenue à /decouvrir/, une autre page de Découvrir à `decouvrir/<slug>/`, une page
 * des Bases à `regles/<slug>/`, une page du Guide du MJ à `mj/<slug>/`, toute autre page `guide/…` à `regles/avancees/<slug>/` (les Règles avancées).
 */
export function adresseDuGuide(id) {
  const place = PLACES.get(id);
  if (place) return place.rubrique.accueil === id ? place.rubrique.chemin : `${place.rubrique.chemin}${slugDe(id)}/`;
  if (estDuGuideDuMj(id)) return `${GUIDE_DU_MJ.chemin}${slugDe(id)}/`;
  return `${REGLES_AVANCEES.chemin}${slugDe(id)}/`;
}

/**
 * Où se range une page `guide/…`, pour la nommer et l'ordonner (notes de version, panneau de la ceinture) : { rubrique, rang, ordre } ; `rubrique` est
 * « Découvrir », « Les bases », « Règles avancées » ou « Guide du MJ », `rang` l'ordre de ces rubriques, `ordre` la place de la page dans Découvrir ou
 * Les bases (0…), null ailleurs.
 */
export function placeDansLeGuide(id) {
  const place = PLACES.get(id);
  if (place) return { rubrique: place.rubrique.titre, rang: RUBRIQUES_DU_GUIDE.indexOf(place.rubrique), ordre: place.ordre };
  if (estDuGuideDuMj(id)) return { rubrique: GUIDE_DU_MJ.titre, rang: RUBRIQUES_DU_GUIDE.length + 1, ordre: null };
  return { rubrique: REGLES_AVANCEES.titre, rang: RUBRIQUES_DU_GUIDE.length, ordre: null };
}

const parTitre = (a, b) => String(a.data?.title ?? a.id).localeCompare(String(b.data?.title ?? b.id), 'fr');

/**
 * Les pages des Bases prises dans les pages données (`entries` : les pages chargées, { id, data: { title } }), dans l'ordre du plan : le menu latéral.
 * Une page nommée et absente de `entries` est sautée (verifierLePlan la signale).
 */
export function pagesDesBases(entries) {
  const parId = new Map(entries.map((e) => [e.id, e]));
  return LES_BASES.pages.map((id) => parId.get(id)).filter(Boolean);
}

/**
 * Les pages des Règles avancées prises dans les pages données (`entries` : les pages chargées, { id, data: { title } }), dans l'ordre du plan : le menu
 * latéral, une seule liste. D'abord les pages nommées (REGLES_AVANCEES.pages, dans cet ordre), puis, pour chaque préfixe (REGLES_AVANCEES.prefixes),
 * les pages dont l'id commence par lui (ordre des titres), puis toute autre page des Règles avancées (estDesReglesAvancees, ordre des titres). Une page
 * nommée et absente de `entries` est sautée (verifierLePlan la signale).
 */
export function pagesDesReglesAvancees(entries) {
  const avancees = entries.filter((e) => estDesReglesAvancees(e.id));
  const parId = new Map(avancees.map((e) => [e.id, e]));
  const pages = REGLES_AVANCEES.pages.map((id) => parId.get(id)).filter(Boolean);
  const pris = new Set(REGLES_AVANCEES.pages);
  const prendre = (liste) => {
    for (const e of liste.sort(parTitre)) {
      pages.push(e);
      pris.add(e.id);
    }
  };
  for (const prefixe of REGLES_AVANCEES.prefixes) prendre(avancees.filter((e) => e.id.startsWith(prefixe) && !pris.has(e.id)));
  prendre(avancees.filter((e) => !pris.has(e.id)));
  return pages;
}

/**
 * Le menu latéral d'une page `guide/…` (components/guide/MenuLateral.astro) : { rubrique, pages } — Les bases (LES_BASES, pagesDesBases) ou les Règles
 * avancées (REGLES_AVANCEES, pagesDesReglesAvancees), `pages` prises dans les pages chargées (`entries`) —, ou null (Découvrir, Guide du MJ).
 */
export function menuLateralDe(id, entries) {
  if (estDesBases(id)) return { rubrique: LES_BASES, pages: pagesDesBases(entries) };
  if (estDesReglesAvancees(id)) return { rubrique: REGLES_AVANCEES, pages: pagesDesReglesAvancees(entries) };
  return null;
}

/**
 * Le fil d'Ariane d'une page `guide/…`, après « Accueil » : [{ titre, chemin }] (`chemin` relatif à la racine du site) — sa rubrique (Découvrir, Les
 * bases, Règles avancées : plus de groupes depuis le 2026-11-05, ni d'ancre de groupe), ou le Guide du MJ. Le gabarit marque le maillon qui mène à la
 * page elle-même (Bienvenue est servie à /decouvrir/).
 */
export function filDAriane(id) {
  const place = PLACES.get(id);
  if (place) return [{ titre: place.rubrique.titre, chemin: place.rubrique.chemin }];
  if (estDuGuideDuMj(id)) return [{ titre: GUIDE_DU_MJ.titre, chemin: GUIDE_DU_MJ.chemin }];
  return [{ titre: REGLES_AVANCEES.titre, chemin: REGLES_AVANCEES.chemin }];
}

/**
 * Contrôle du plan contre les pages chargées (`entries` : { id, data: { status } }), appelé au build par les routes : chaque page nommée (Découvrir, Les
 * bases, Guide du MJ, Règles avancées) existe et n'est pas une page d'exemple, aucune n'est nommée deux fois, aucune page de Découvrir ni des Bases ne
 * prend un nom réservé, aucune rubrique ni aucun groupe n'est vide, la page d'ouverture des Bases en est une, celle des Règles avancées aussi (nommée
 * par REGLES_AVANCEES.pages), aucune page absorbée n'est encore là (elle s'afficherait dans les Règles avancées) et chaque page qui en absorbe une est
 * dans le plan. Lève une erreur (le build s'arrête plutôt que de montrer un plan faux) ; rend `entries`.
 */
export function verifierLePlan(entries) {
  const parId = new Map(entries.map((e) => [e.id, e]));
  for (const r of RUBRIQUES_DU_GUIDE) {
    for (const g of r.groupes ?? []) if (!g.pages.length) throw new Error(`plan du guide : le groupe « ${g.titre} » de « ${r.titre} » est vide`);
    if (!pagesDeLaRubrique(r).length) throw new Error(`plan du guide : « ${r.titre} » est vide`);
  }
  for (const r of [LES_BASES, REGLES_AVANCEES]) {
    if (!r.pages.includes(r.ouverture)) throw new Error(`plan du guide : ${r.ouverture}, ouverte à /${r.chemin}, n'est pas dans « ${r.titre} »`);
  }
  const nommees = [
    ...RUBRIQUES_DU_GUIDE.flatMap((r) => pagesDeLaRubrique(r).map(({ id }) => [id, `« ${r.titre} »`])),
    ...GUIDE_DU_MJ.pages.map((id) => [id, GUIDE_DU_MJ.titre]),
    ...REGLES_AVANCEES.pages.map((id) => [id, `« ${REGLES_AVANCEES.titre} »`]),
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
  for (const r of RUBRIQUES_DU_GUIDE) {
    for (const { id } of pagesDeLaRubrique(r)) if (NOMS_RESERVES.includes(slugDe(id))) throw new Error(`plan du guide : ${id} prend un nom réservé (${NOMS_RESERVES.join(', ')})`);
  }
  for (const [ancienne, nouvelle] of Object.entries(PAGES_ABSORBEES)) {
    if (parId.has(ancienne)) throw new Error(`plan du guide : ${ancienne} est absorbée par ${nouvelle} et ne doit plus être dans la base`);
    if (!vues.has(nouvelle)) throw new Error(`plan du guide : ${nouvelle}, qui absorbe ${ancienne}, n'est pas dans le plan`);
  }
  return entries;
}
