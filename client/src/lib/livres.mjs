// Le plan des pages du guide (demandes du propriétaire, 2026-10-16 puis 2026-10-18 : « éclater le guide pour retravailler pleinement l'organisation des
// onglets et de la présentation », puis « refaire toutes les anciennes pages du guide. Retirer le mécanisme de swipe, et les flèches suivant / précédent et
// la pagination ») : les pages `guide/<slug>` de la base sont rangées ici. Plus de livre lu dans l'ordre : chaque page se lit seule, comme une page du
// wiki (components/guide/PageDuGuide.astro : fil d'Ariane vers sa rubrique ou son sommaire, titre, texte, blocs, pied de page ; plus aucune source
// affichée : elles ne se lisent que sur /archives/, réponse du propriétaire du 2026-10-22).
//   - « Découvrir » (/decouvrir/, en tête de la rubrique Règles du menu, faite pour être vue même des non-membres) : Bienvenue (servie à /decouvrir/,
//     entrée « Découvrir ») et L'univers (/decouvrir/l-univers/). La page « Rejoindre une partie » est supprimée (demande du propriétaire du 2026-11-05 :
//     « Efface la page "Rejoindre une partie" et son lien. ») ; son ancienne adresse n'est renvoyée nulle part (réponse « Page 404 (Recommandé) »).
//   - Les onglets des Règles (décisions R184 et R185, migration 0091) : « Fiche de personnage », « Mécaniques générales », « Les combats »,
//     « Exploration », chacun un menu latéral (components/guide/MenuLateral.astro) ouvert sur sa page d'ouverture. Leur plan est une donnée de la
//     base (tables regles_onglet et regles_onglet_entree), jamais écrit ici : lib/plan-des-regles-db.mjs#chargerPlanDesRegles le lit, et celui qui
//     charge les pages l'installe ici (installerLePlan : lib/wiki.ts au build, le service à son démarrage). Une fonction qui a besoin du plan sans qu'il
//     soit installé lève une erreur. Chaque page d'un onglet est à /regles/<slug>/ (« adresses à plat ») ; /regles/<onglet>/ montre la page
//     d'ouverture de l'onglet, /regles/ celle du premier onglet, leur adresse canonique restant /regles/<slug>/. Ces adresses ne dépendent pas du plan
//     (adresseDuGuide) : la chaîne de l'édition du navigateur, qui ne reçoit pas le plan, les calcule aussi.
//   - Le « Guide du MJ » (/mj/) est un sommaire ; ses pages sont à /mj/<slug>/.
//   - « Artisanat » (/regles/artisanat/) est un sommaire de pages d'autres types, entrée lien du menu latéral d'Exploration.
// Couleurs : Découvrir garde la couleur de son ancienne partie (PARTIES, `partie`), la création du personnage (Créer son personnage et ses six étapes,
// PAGES_DE_LA_CREATION) celle de la partie « creer » ; toute autre page des onglets prend l'accent du site (réponse du propriétaire du 2026-11-05 :
// « Accent du site »), comme le Guide du MJ. La couleur d'une partie est sa classe de la palette (`.couleur-partie-<id>` : lib/palette-css.mjs#classeDePartie,
// valeur dans lib/parties-couleurs.mjs). Aucune couleur n'est écrite ici (le navigateur reçoit ce module).
// Rien n'est caché ni filtré (réponse du propriétaire du 2026-10-18 : « Tu fait comme si de rien n'était pour l'instant. On verra les caches. », sic) : à
// terme, les non-membres ne verront que les deux premières rubriques du menu, « Règles et Personnage » (réponse du propriétaire du 2026-10-29 ;
// lib/nav.mjs).
// Seuls des libellés de navigation sont écrits ici : les textes des pages sont dans la base. Une exception : la présentation du lien Discord de
// l'accueil (LIENS_ET_RENCONTRE.liens[].presentation), un texte écrit ici, donc ni modifiable sur le site de dev (un commit le change), ni cherché par la
// recherche, et emporté par la chaîne de l'édition du navigateur avec le reste du module.
// Les identifiants de page ne changent pas (« guide/le-tour-de-jeu ») : seules leurs adresses viennent d'ici (lib/metiers.mjs#adresseDePage, puis
// cheminDePage, entryHref, pageHref, entryUrl, l'index de la recherche) ; les anciennes adresses mènent aux nouvelles par la page 404
// (lib/metiers.mjs#renvoisDuGuide, PAGES_ECLATEES_DU_GUIDE). Une adresse se tire de l'id, sauf exception voulue par le propriétaire
// (ADRESSES_RENOMMEES_DU_GUIDE, R228).
// Sans aucun import : lu par lib/metiers.mjs (chaîne de l'édition du navigateur comprise), lib/guide.mjs, lib/notes-de-version.mjs (service),
// lib/wiki.ts, les composants et les tests.

/**
 * Les parties de l'ancien guide, dont Découvrir et la création du personnage prennent la couleur (`partie` d'un groupe : l'id d'une partie). Leurs
 * couleurs sont dans lib/parties-couleurs.mjs#COULEURS_DES_PARTIES (même clé), posées par leur classe (lib/palette-css.mjs#classeDePartie) ; elles sont
 * aussi celles des quatre zones de la fiche (pages/fiche/index.astro : creer, jouer, decouvrir, progresser). « Pour aller plus loin » ne colore plus
 * rien ; elle reste une partie de l'ancien guide, que nomme le registre de la migration 0064 (data/migrations/0064-guide-sans-chapitres.json,
 * test/guide-sans-chapitres.test.mjs).
 */
export const PARTIES = Object.freeze([
  Object.freeze({ id: 'decouvrir', titre: 'Découvrir' }),
  Object.freeze({ id: 'creer', titre: 'Créer son personnage' }),
  Object.freeze({ id: 'jouer', titre: 'Jouer' }),
  Object.freeze({ id: 'progresser', titre: 'Progresser' }),
  Object.freeze({ id: 'plus-loin', titre: 'Pour aller plus loin' }),
]);
/** L'id d'une partie, vérifié (une partie que PARTIES ne nomme pas arrête le chargement du module). */
const partie = (id) => {
  if (!PARTIES.some((p) => p.id === id)) throw new Error(`lib/livres.mjs : partie inconnue « ${id} »`);
  return id;
};

const gele = (o) => Object.freeze(o);
const slugDe = (id) => id.slice(id.indexOf('/') + 1);

/**
 * Découvrir : deux pages, une par entrée du menu, dans l'ordre du menu ; `accueil` est servie à l'adresse de la rubrique (/decouvrir/), l'autre à
 * /decouvrir/<slug>/. Son groupe ne donne que la partie (la couleur) de ses pages. « Créer son personnage » n'y est plus : c'est l'introduction de
 * l'onglet « Fiche de personnage » (R184).
 */
export const DECOUVRIR = gele({
  id: 'decouvrir', titre: 'Découvrir', chemin: 'decouvrir/', accueil: 'guide/bienvenue', groupes: Object.freeze([
    gele({ id: 'decouvrir', titre: 'Découvrir', partie: partie('decouvrir'), pages: Object.freeze(['guide/bienvenue', 'guide/l-univers']) }),
  ]),
});

/**
 * La création du personnage : l'introduction et ses six étapes (R184, § 1 A), pages de l'onglet « Fiche de personnage » qui gardent la couleur de la
 * partie « creer » (défaut confirmé par le propriétaire) ; les autres pages des onglets prennent l'accent du site. La couleur seulement : leur place
 * dans le menu vient du plan de la base. Les six étapes reprennent, une pour une, les ids des pages fusionnées dans « Créer son personnage » le 2026-10-18.
 */
export const PAGES_DE_LA_CREATION = gele({
  partie: partie('creer'), pages: Object.freeze([
    'guide/creer-son-personnage', 'guide/choisir-sa-race', 'guide/choisir-ses-magies', 'guide/choisir-sa-classe', 'guide/caracteristiques-et-competences',
    'guide/premiers-sorts', 'guide/finaliser-son-personnage',
  ]),
});

/** L'adresse de l'ancien /guide/ (badge « Guide » de l'index du wiki, renvoi de la page 404) : Découvrir. */
export const ACCUEIL_DU_GUIDE = DECOUVRIR.chemin;

/** Le chemin des pages des onglets (/regles/<slug>/) et de chaque onglet (/regles/<onglet>/) ; /regles/ montre l'ouverture du premier onglet. */
export const CHEMIN_DES_REGLES = 'regles/';

/**
 * Bloc de navigation rendu par le gabarit sous une page (pas du texte de la page) : les rubriques qu'elle présente, par leur clé de lib/types.mjs (le lien
 * mène à `<clé>/`, le libellé est le titre de la rubrique, TYPES[clé].label).
 */
export const RUBRIQUES_SOUS_LA_PAGE = Object.freeze({ 'guide/l-univers': Object.freeze(['races', 'magies', 'classes']) });

/**
 * Le Guide du MJ : un sommaire (titre et résumé de chaque page), ses pages à /mj/<slug>/. « « Campagne » ou « Scénario one shot » ? » y passe (choix du
 * propriétaire du 2026-10-18 ; elle était la dernière page du livre Découvrir).
 */
export const GUIDE_DU_MJ = gele({
  titre: 'Guide du MJ', chemin: 'mj/', pages: Object.freeze(['guide/un-maitre-du-jeu', 'guide/guide-pour-mj-maverick', 'guide/campagne-ou-scenario-one-shot']),
});

/**
 * L'Artisanat : un sommaire de pages d'autres types (titre et résumé de chaque page), entrée lien du menu latéral de l'onglet Exploration (R184).
 * « ressources/composants » n'est pas une page du wiki mais la page Composants (pages/ressources/composants.astro,
 * lib/composants-db.mjs#PAGE_DES_COMPOSANTS).
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

/**
 * Les trois cartes « Par où commencer ? » de l'accueil, dans cet ordre : les deux pages de Découvrir, puis « Créer son personnage », l'introduction de
 * l'onglet « Fiche de personnage » (défaut confirmé par le propriétaire, R185 (4)).
 */
export const PAR_OU_COMMENCER = Object.freeze([...DECOUVRIR.groupes.flatMap((g) => g.pages), 'guide/creer-son-personnage']);

/**
 * Les pages Astro écrites à côté des pages des onglets (regles/artisanat, regles/glossaire : la liste des mots-clés, migration 0098), et l'ancienne
 * adresse des Règles avancées (/regles/avancees/, renvoyée par la page 404) : aucune page des onglets ne prend ce nom. Les ids des onglets sont réservés
 * de même (nomsReserves : /regles/<onglet>/).
 */
export const NOMS_RESERVES = Object.freeze(['artisanat', 'avancees', 'glossaire']);

/**
 * Les pages fusionnées dans une autre : page retirée → page qui l'absorbe. Elles ne sont plus dans la base ; leurs anciennes adresses mènent à la page
 * qui les absorbe, à l'endroit où se lit leur contenu s'il est nommé (ANCRES_DES_PAGES_ABSORBEES) — l'ancre et la requête d'origine gardées
 * (lib/metiers.mjs#renvoisDuGuide, page 404) —, comme un lien Markdown écrit vers elles (lib/guide.mjs#adresseDesAnciensLiens).
 *   - « Le jeu de rôle, comment ça marche ? » dans Bienvenue (choix du propriétaire du 2026-10-18 : « Bienvenue absorbe « Le jeu de rôle, comment ça
 *     marche » »).
 *   - « Résistance/Faiblesse Magie » dans « Résistances et faiblesses » (R184, § 1 B 5).
 *   - « Les situations avancées » dans « La prise en tenaille et zone d'influence » (R185 (3), P11) : chacune de ses sections est devenue une page, où
 *     mène son ancienne ancre (PAGES_ECLATEES_DU_GUIDE).
 *   - « Les neuf alignements » dans « Alignement » (migration 0123, demande du propriétaire : « Les pages … /regles/alignement/ et
 *     /regles/les-neuf-alignements/ font doublon. Réunis toutes les informations dans la page /regles/alignement/ »), sous l'intertitre
 *     `{#les-neuf-alignements}` ; ses neuf sections, `{#loyal-bon}`…, y sont les onglets de la page (lib/guide-onglets.mjs).
 *   - « Accessoires et Ceinture » dans « Inventaire/Sac à dos » (migration 0124, R272 : « Tout lien qui revois vers cette page doit renvoyer vers
 *     https://dev.maverick-jdr.com/regles/fiche-inventaire-sac-a-dos/ »), dont ses sections « Accessoires » (`{#accessoires}`, où mène son ancienne
 *     adresse) et « Ceinture » (`{#ceinture}`, lue par l'onglet Ceinture) sont maintenant la fin du texte.
 * Les six étapes de la création, fusionnées dans « Créer son personnage » du 2026-10-18 à R184, sont redevenues des pages, sous leur id.
 */
export const PAGES_ABSORBEES = Object.freeze({
  'guide/le-jeu-de-role': 'guide/bienvenue',
  'guide/resistance-faiblesse-magie': 'guide/resistances-et-faiblesses',
  'guide/situations-avancees': 'guide/prise-en-tenaille-et-zone-d-influence',
  'guide/les-neuf-alignements': 'guide/alignement',
  'guide/fiche-accessoires-et-ceinture': 'guide/fiche-inventaire-sac-a-dos',
});

/**
 * Où se lit maintenant une page fusionnée, dans la page qui l'absorbe, quand c'est un intertitre : son id (posé par le rendu Markdown, github-slugger).
 * Son ancienne adresse y mène quand elle n'écrit pas sa propre ancre (adresseDeLaPageAbsorbee : page 404, liens Markdown écrits vers elle). Sans
 * entrée, la page entière. Un intertitre renommé change son id : test/livres.test.mjs compare ces ancres aux intertitres des pages,
 * test/site-html.test.mjs au site construit.
 */
export const ANCRES_DES_PAGES_ABSORBEES = Object.freeze({
  'guide/le-jeu-de-role': 'le-jeu-de-rôle-comment-ça-marche-',
  'guide/les-neuf-alignements': 'les-neuf-alignements', // ancre figée (lib/ancres-figees.mjs) : l'intertitre garde son id quand il est renommé
  'guide/fiche-accessoires-et-ceinture': 'accessoires', // ancre figée : la première section de la page retirée, déplacée telle quelle (0124)
});

/** L'adresse où mène une page fusionnée (`ancienne`, une clé de PAGES_ABSORBEES) : la page qui l'absorbe (`cheminDe` : lib/metiers.mjs#cheminDePage), à son ancre s'il y en a une. */
export const adresseDeLaPageAbsorbee = (ancienne, cheminDe) => {
  const ancre = ANCRES_DES_PAGES_ABSORBEES[ancienne];
  return `${cheminDe(PAGES_ABSORBEES[ancienne])}${ancre ? `#${ancre}` : ''}`;
};

/**
 * Les pages supprimées sans renvoi (R184 (9), R185 (6) : « Leurs adresses mènent à la page 404 par défaut ») : ni dans la base, ni dans le plan, ni dans
 * aucune liste de renvois (verifierLePlan arrête le build si l'une revient sans être rangée). Leur contenu se lit ailleurs ou n'est plus tenu. Leur id
 * reste réservé : une page créée sur le site de dev ne le reprend pas (serveur/edition-plan.mjs#idPris).
 *   - R184 (9) : « Les documents des règles », « En résumé : déroulement d'un tour », « Aide-mémoire », « Mode Hyper (Magie) » ;
 *   - 2026-11-06, migration 0094 (demande du propriétaire : « Il y a 4 pages à supprimer car inutile ou doublon. * Postures * Les boss et leurs
 *     postures * Le mode hyper * Mode super » ; « Le mode hyper » reste, a-t-il précisé) : « Postures » (doublon de guide/les-postures, où mène son
 *     alias ; les ids des postures gardent son préfixe, guide/postures#posture:…, identifiants figés), « Les boss et leurs postures » (son texte est
 *     dans guide/les-postures, ## Les boss), « Le Mode Super » ;
 *   - R187 (1), migration 0095 (même jour : « Supprime la liste ») : la « Liste des effets mode hyper », doublon de guide/le-mode-hyper, qui porte
 *     maintenant le tableau des effets des magies et des races (bloc mode-hyper, lib/guide.mjs#BLOCS) ;
 *   - migration 0096 (même jour : « L'onglet suivant est à retirer …/regles/alterations-d-etats-et-mode-hyper/ ») : « Altérations d'états et Mode
 *     Hyper », un aiguillage vers deux classeurs, doublon de guide/alterations-d-etats, guide/liste-des-alterations-d-etat et guide/le-mode-hyper, que
 *     ses cinq liens visent maintenant ;
 *   - 2026-11-13, migration 0122 (demande du propriétaire : « Supprime juste le doublon ») : « La montée de niveau », doublon de la page des règles
 *     /regles/fiche-experience-niveau-global/, dont le mot-clé (172) est fondu dans celui de la page gardée (138) ; Exploration s'ouvre sur guide/equipement-et-butin.
 */
export const PAGES_SUPPRIMEES = Object.freeze([
  'guide/les-documents-des-regles', 'guide/en-resume-deroulement-d-un-tour', 'guide/aide-memoire', 'guide/mode-hyper-magie',
  'guide/postures', 'guide/les-boss-et-leurs-postures', 'guide/le-mode-super', 'guide/liste-des-effets-mode-hyper',
  'guide/alterations-d-etats-et-mode-hyper', 'guide/la-montee-de-niveau',
]);

/**
 * Les pages retirées du site dont le contenu se lit ailleurs que dans une page (ni absorbées par une autre, ni simplement effacées) : page retirée →
 * { vers : l'adresse où mène chacune de ses anciennes adresses, relative à la racine du site ; adresses : ses anciennes adresses, relatives elles aussi }.
 * Le Lexique (« Les bases », /regles/lexique/ ; /guide/lexique/ avant l'éclatement du guide) est devenu des mots-clés du glossaire (migration 0090, demande
 * du propriétaire du 2026-11-05 : « Supprime la page lexique. Toutes les informations comprises dedans doivent être converties en mot-clés. ») : ses
 * adresses menaient à /recherche/ (réponse du propriétaire : « Rediriger vers /recherche/ ») ; depuis que la liste des mots-clés a sa page, le Glossaire
 * des Règles (/regles/glossaire/, réponses du propriétaire du 2026-11-06 ; décision R190), elles y mènent, la requête et l'ancre d'origine gardées (page 404 :
 * lib/metiers.mjs#renvoisDuGuide), comme un lien Markdown écrit vers elles (lib/guide.mjs#adresseDesAnciensLiens). Elles ne sont plus dans la base
 * (verifierLePlan). Une page simplement effacée, sans renvoi (« Rejoindre une partie », « Liens », PAGES_SUPPRIMEES), n'est pas ici.
 */
export const PAGES_RETIREES = Object.freeze({
  'guide/lexique': gele({ vers: 'regles/glossaire/', adresses: Object.freeze(['guide/lexique/', 'regles/lexique/']) }),
});

/**
 * L'adresse où mène un chemin écrit vers une page retirée (PAGES_RETIREES), relatif à la racine du site, requête et ancre comprises
 * (« regles/lexique/#acquis », « guide/lexique ») : sa destination, la requête et l'ancre écrites gardées ; null pour tout autre chemin, et pour une page
 * retirée que `existe(id)` dit chargée.
 */
export function adresseDeLaPageRetiree(chemin, { existe = () => false } = {}) {
  const m = String(chemin).match(/^([^?#]*?)\/?((?:[?#].*)?)$/);
  if (!m) return null;
  const adresse = `${m[1]}/`;
  for (const [id, { vers, adresses }] of Object.entries(PAGES_RETIREES)) if (adresses.includes(adresse) && !existe(id)) return `${vers}${m[2]}`;
  return null;
}

/**
 * L'adresse d'une page `guide/<slug>`, relative à la racine du site, sans le plan des onglets (la chaîne de l'édition du navigateur la calcule aussi) :
 * Bienvenue à /decouvrir/, L'univers à `decouvrir/<slug>/`, une page du Guide du MJ à `mj/<slug>/`, toute autre page `guide/…` à `regles/<slug>/` (les
 * pages des onglets, « adresses à plat » ; la fixture `guide/utiliser-ce-wiki` aussi, sans entrée de menu). Le slug est celui de l'id, sauf pour une
 * page de ADRESSES_RENOMMEES_DU_GUIDE (R228 : guide/liste-des-effets-mode-super à regles/mode-super/).
 */
export function adresseDuGuide(id) {
  if (id === DECOUVRIR.accueil) return DECOUVRIR.chemin;
  if (estDansDecouvrir(id)) return `${DECOUVRIR.chemin}${slugDAdresse(id)}/`;
  if (estDuGuideDuMj(id)) return `${GUIDE_DU_MJ.chemin}${slugDAdresse(id)}/`;
  return `${CHEMIN_DES_REGLES}${slugDAdresse(id)}/`;
}

/**
 * Les pages du guide dont l'adresse ne se tire pas de l'identifiant : id → dernier segment de son adresse. Exceptions voulues par le propriétaire à la
 * règle des adresses figées (CLAUDE.md, « Identifiants figés ») ; l'identifiant reste, lu par les tables (mode_texte.page_id, regles_onglet_entree,
 * alias, historique_modification…). Liste figée : adresseDuGuide la lit, pageDuGuideALAdresse la lit à l'envers ; l'ancienne adresse de chaque page est
 * dans ADRESSES_DU_PLAN_PRECEDENT (page 404, liens écrits) ; aucune autre page ne prend la nouvelle (verifierLePlan, serveur/edition-plan.mjs#idPris).
 *   - R228 (2026-11-08 : « https://dev.maverick-jdr.com/regles/liste-des-effets-mode-super/ à changer en https://dev.maverick-jdr.com/regles/mode-super/
 *     (et le titre aussi) ») : la page du Mode Super, guide/liste-des-effets-mode-super, est servie à /regles/mode-super/.
 *   - R272 (2026-11-14 : « Il faudrai d'ailleur corriger le nom de ce ce lien pour qu'il corresponde mieux au titre. » ; réponse : « Renommer l'adresse
 *     fiche-inventaire-sac-a-dos (sans le préfixe « fiche- ») et rediriger l'ancienne. Cela déroge à la règle des adresses figées. ») : la page
 *     « Inventaire/Sac à dos », guide/fiche-inventaire-sac-a-dos, est servie à /regles/inventaire-sac-a-dos/ (migration 0124).
 */
export const ADRESSES_RENOMMEES_DU_GUIDE = Object.freeze({
  'guide/liste-des-effets-mode-super': 'mode-super',
  'guide/fiche-inventaire-sac-a-dos': 'inventaire-sac-a-dos',
});

/** Le dernier segment de l'adresse d'une page `guide/<slug>` : son slug, ou celui que lui donne ADRESSES_RENOMMEES_DU_GUIDE. */
export const slugDAdresse = (id) => (Object.hasOwn(ADRESSES_RENOMMEES_DU_GUIDE, id) ? ADRESSES_RENOMMEES_DU_GUIDE[id] : slugDe(id));

/** La page d'un segment d'adresse renommé (ADRESSES_RENOMMEES_DU_GUIDE lue à l'envers) : « mode-super » → guide/liste-des-effets-mode-super. */
const PAGES_DES_ADRESSES_RENOMMEES = new Map(Object.entries(ADRESSES_RENOMMEES_DU_GUIDE).map(([id, slug]) => [slug, id]));

/**
 * Les pages qui étaient dans les Règles avancées (/regles/avancees/<slug>/, du 2026-11-05 à R184), sauf les pages supprimées (PAGES_SUPPRIMEES : la
 * page 404) : liste figée, relevée au commit 92a123d (les 19 pages nommées par l'ancien plan, les 14 pages « Fiche de personnage : … », et les pages
 * qu'il ne nommait pas). Chacune mène à sa page, ou à celle qui l'absorbe (ADRESSES_DU_PLAN_PRECEDENT) ; « Les situations avancées », éclatée, à la page
 * de son ancre (PAGES_ECLATEES_DU_GUIDE). « Postures », supprimée le 2026-11-06 (migration 0094), la « Liste des effets
 * mode hyper », supprimée le même jour (R187, migration 0095), et « Altérations d'états et Mode Hyper », supprimée le même jour (migration 0096), en
 * sont sorties comme « Mode Hyper (Magie) » : leur ancienne adresse mène à la page 404 (R185 (6)).
 */
const ANCIENNES_REGLES_AVANCEES = Object.freeze([
  'actions-et-mouvements', 'alignement', 'attaque-et-defense', 'distance-et-voyage', 'donjon-pas-bon',
  'fiche-accessoires-et-ceinture', 'fiche-armure-defense-bouclier', 'fiche-attributs', 'fiche-capacites-dons', 'fiche-caracteristiques', 'fiche-classe',
  'fiche-competences', 'fiche-experience-niveau-global', 'fiche-inventaire-sac-a-dos', 'fiche-maitrise-darme-et-armes', 'fiche-personnage',
  'fiche-tableau-magie', 'fiche-tableau-posture', 'fiche-tableau-resistances-faiblesses', 'formule-des-degats', 'jet-de-des', 'le-mode-hyper',
  'les-neuf-alignements', 'les-pieges', 'les-portes', 'liste-des-alterations-d-etat', 'liste-des-effets-mode-super',
  'meteo', 'resistance-faiblesse-magie', 'situations-avancees', 'utiliser-ce-wiki', 'vitesse-et-portee',
]);

/**
 * Les pages des onglets des Règles qui avaient leur adresse à plat (/regles/<slug>/, `adresseDuGuide`) avant d'être fusionnées dans une autre
 * (PAGES_ABSORBEES) : leur ancienne adresse y mène, à l'ancre de la section (ou à celle que l'ancienne adresse écrit : « /regles/les-neuf-alignements/#loyal-bon »
 * mène à « /regles/alignement/#loyal-bon »). Les pages fusionnées plus tôt n'en ont pas : elles étaient encore sous /regles/avancees/ ou /decouvrir/.
 * « Accessoires et Ceinture » (migration 0124, R272) : /regles/fiche-accessoires-et-ceinture/ mène à /regles/inventaire-sac-a-dos/#accessoires.
 */
const PAGES_DES_REGLES_ABSORBEES = Object.freeze(['guide/les-neuf-alignements', 'guide/fiche-accessoires-et-ceinture']);

/** Les six étapes de la création : pages du 2026-10-16 au 2026-10-18 (/decouvrir/<slug>/), puis fusionnées, de nouveau des pages depuis R184. */
const ETAPES_DE_LA_CREATION = PAGES_DE_LA_CREATION.pages.slice(1);

/**
 * Les adresses des plans précédents qui ont changé, hors pages éclatées : adresse → page qui y est maintenant (ou page fusionnée, menée à la page qui
 * l'absorbe : lib/metiers.mjs#renvoisDuGuide, lib/guide.mjs#adresseDesAnciensLiens). Listes figées, sans préfixe deviné :
 *   - « « Campagne » ou « Scénario one shot » ? », dernière page de Découvrir jusqu'au 2026-10-18, est dans le Guide du MJ ;
 *   - « Le jeu de rôle, comment ça marche ? » (/decouvrir/le-jeu-de-role/), fusionnée dans Bienvenue ;
 *   - les six étapes de la création (/decouvrir/<étape>/), de nouveau des pages (R184) ;
 *   - les Règles avancées (R184 : plus de rubrique) : /regles/avancees/ mène au Mode Hyper, sa page d'ouverture, et chacune de ses pages
 *     (ANCIENNES_REGLES_AVANCEES) à sa nouvelle adresse ;
 *   - une page dont l'adresse a changé sans son identifiant (ADRESSES_RENOMMEES_DU_GUIDE) : son adresse tirée de l'identifiant, /regles/<slug>/ (R228 :
 *     /regles/liste-des-effets-mode-super/ mène à /regles/mode-super/) ;
 *   - une page des Règles fusionnée depuis dans une autre (PAGES_DES_REGLES_ABSORBEES : /regles/les-neuf-alignements/, migration 0123 ;
 *     /regles/fiche-accessoires-et-ceinture/, migration 0124) ; /regles/fiche-inventaire-sac-a-dos/ (page renommée, R272) mène à /regles/inventaire-sac-a-dos/.
 * « Créer son personnage » (/decouvrir/creer-son-personnage/), découpée, et « Les situations avancées » sont dans PAGES_ECLATEES_DU_GUIDE. La page
 * « Liens » (/decouvrir/liens/), supprimée le 2026-10-22, n'est plus renvoyée nulle part (réponse du propriétaire du 2026-10-23 : « supprimer ce lien »).
 */
export const ADRESSES_DU_PLAN_PRECEDENT = Object.freeze({
  'decouvrir/campagne-ou-scenario-one-shot/': 'guide/campagne-ou-scenario-one-shot',
  'decouvrir/le-jeu-de-role/': 'guide/le-jeu-de-role',
  ...Object.fromEntries(ETAPES_DE_LA_CREATION.map((id) => [`decouvrir/${slugDe(id)}/`, id])),
  'regles/avancees/': 'guide/le-mode-hyper',
  ...Object.fromEntries(ANCIENNES_REGLES_AVANCEES.filter((slug) => slug !== 'situations-avancees').map((slug) => [`regles/avancees/${slug}/`, `guide/${slug}`])),
  ...Object.fromEntries(Object.keys(ADRESSES_RENOMMEES_DU_GUIDE).map((id) => [`${CHEMIN_DES_REGLES}${slugDe(id)}/`, id])),
  ...Object.fromEntries(PAGES_DES_REGLES_ABSORBEES.map((id) => [`${CHEMIN_DES_REGLES}${slugDe(id)}/`, id])),
});

/**
 * Les anciennes ancres de « Créer son personnage » quand elle portait les six étapes (/decouvrir/creer-son-personnage/, du 2026-10-18 à R184), relevées
 * dans son texte au commit 92a123d (github-slugger, un rendu par morceau de texte entre deux blocs : les deux « Nos quatre personnages » avaient le
 * même id, le premier l'emporte) : l'intertitre de chaque étape mène à sa page, chacun de ses sous-intertitres (devenus des `##`, même texte) à la page
 * de l'étape, à son ancre. « Ce que contient la fiche » et « Quatre personnages pour exemple » restent dans l'introduction (ancre gardée).
 */
const ANCRES_DE_LA_CREATION = Object.freeze({
  'guide/choisir-sa-race': ['étape-1--imaginer-son-personnage-et-choisir-sa-race', 'qui-est-votre-personnage-', 'sa-race'],
  'guide/choisir-ses-magies': ['étape-2--choisir-ses-magies', 'la-magie-innée', 'la-magie-acquise', 'résistances-et-faiblesses', 'nos-quatre-personnages'],
  'guide/choisir-sa-classe': ['étape-3--choisir-sa-classe', 'une-ou-deux-classes--le-biclassage'],
  'guide/caracteristiques-et-competences': ['étape-4--répartir-caractéristiques-et-compétences', 'les-caractéristiques', 'les-compétences', 'les-maîtrises-darmes'],
  'guide/premiers-sorts': ['étape-5--choisir-ses-premiers-sorts', 'les-emplacements-de-sorts', 'choisir-ses-sorts'],
  'guide/finaliser-son-personnage': ['étape-6--finaliser-son-personnage', 'les-attributs', 'les-dons', 'léquipement-et-la-bourse', 'lalignement'],
});

/**
 * Les anciennes ancres des sections de « Les situations avancées » (R185 (3), relevées au commit 92a123d) : chacune mène à la page qui porte maintenant
 * son texte ; « La prise en tenaille » à sa section de la page de la tenaille ; « Les boss et leurs postures », dont la page est supprimée (migration
 * 0094, PAGES_SUPPRIMEES), à la section « Les boss » de la page des postures, qui porte son texte.
 */
const ANCRES_DES_SITUATIONS_AVANCEES = Object.freeze({
  'la-prise-en-tenaille': 'regles/prise-en-tenaille-et-zone-d-influence/#la-prise-en-tenaille',
  'le-déplacement-ou-la-sortie-de-la-zone-dinfluence': adresseDuGuide('guide/deplacement-ou-sortie-de-la-zone-d-influence'),
  'les-attaques-discrètes': adresseDuGuide('guide/les-attaques-discretes'),
  'les-attaques-dopportunité': adresseDuGuide('guide/les-attaques-d-opportunite'),
  'lembuscade': adresseDuGuide('guide/l-embuscade'),
  'les-boss-et-leurs-postures': `${adresseDuGuide('guide/les-postures')}#les-boss`,
  'rater-ses-sortilèges': adresseDuGuide('guide/rater-ses-sortileges'),
  'mordhau-ou-demi-épée': adresseDuGuide('guide/mordhau-ou-demi-epee'),
});

const eclatee = (defaut, anciennesAncres) => gele({ ancres: Object.freeze([]), anciennesAncres: gele(anciennesAncres), parametres: Object.freeze([]), defaut });
const situationsAvancees = eclatee(adresseDuGuide(PAGES_ABSORBEES['guide/situations-avancees']), ANCRES_DES_SITUATIONS_AVANCEES);

/**
 * Les anciennes adresses du guide découpées en plusieurs pages, au format de lib/equipement.mjs#RENVOIS_DES_PAGES_ECLATEES (lib/nav.mjs#adresseEclatee ;
 * la page 404 les reçoit avec celles de l'équipement, data-eclatees ; un lien Markdown écrit vers elles mène au même endroit, lib/guide-rendu.ts) :
 * une ancienne ancre connue mène à sa page, toute autre adresse à `defaut`, l'ancre gardée.
 *   - /decouvrir/creer-son-personnage/ (R184) : les étapes à leur page (ANCRES_DE_LA_CREATION), le reste à /regles/creer-son-personnage/ ;
 *   - « Les situations avancées » (/regles/avancees/situations-avancees/, /guide/situations-avancees/ ; R185 (3)) : chaque section à sa page, le reste à
 *     la page de la tenaille (P11).
 */
export const PAGES_ECLATEES_DU_GUIDE = gele({
  'decouvrir/creer-son-personnage/': eclatee(adresseDuGuide('guide/creer-son-personnage'), Object.fromEntries(Object.entries(ANCRES_DE_LA_CREATION).flatMap(([id, ancres]) =>
    ancres.map((a, i) => [a, i === 0 ? adresseDuGuide(id) : `${adresseDuGuide(id)}#${a}`])))),
  'regles/avancees/situations-avancees/': situationsAvancees,
  'guide/situations-avancees/': situationsAvancees,
});

/**
 * La page `guide/…` servie à une adresse du guide, relative à la racine du site (« regles/l-embuscade/ », « regles/<slug>/#ancre », « decouvrir/ ») ; la
 * requête et l'ancre ne comptent pas : l'inverse d'adresseDuGuide, ADRESSES_RENOMMEES_DU_GUIDE comprises (« regles/mode-super/ » :
 * guide/liste-des-effets-mode-super ; son ancienne adresse, « regles/liste-des-effets-mode-super/ », ne sert plus aucune page). null pour toute autre
 * adresse.
 */
export function pageDuGuideALAdresse(adresse) {
  const chemin = String(adresse).replace(/[?#].*$/, '');
  if (chemin === DECOUVRIR.chemin) return DECOUVRIR.accueil;
  const m = chemin.match(/^(?:decouvrir|regles|mj)\/([a-z0-9]+(?:-[a-z0-9]+)*)\/$/);
  if (!m) return null;
  if (PAGES_DES_ADRESSES_RENOMMEES.has(m[1])) return PAGES_DES_ADRESSES_RENOMMEES.get(m[1]);
  return Object.hasOwn(ADRESSES_RENOMMEES_DU_GUIDE, `guide/${m[1]}`) ? null : `guide/${m[1]}`;
}

/**
 * PAGES_ECLATEES_DU_GUIDE sans ses cibles absentes (`existe(id)` : la page est chargée), pour la page 404 (pages/404.astro) et les liens écrits
 * (lib/guide-rendu.ts). Une page des Règles supprimée sur le site de dev peut être la cible d'un renvoi figé (rien ne la protège pour cela :
 * lib/pages-protegees.mjs) ; son ancienne adresse mène alors à la 404, comme une page supprimée (R185 (6), « Page 404 ») :
 *   - une ancienne ancre dont la page manque est retirée : l'adresse mène à `defaut`, l'ancre gardée (une ancre ne peut pas, seule, donner la 404) ;
 *   - une page éclatée dont la page `defaut` manque est retirée entière : son adresse donne la 404, un lien écrit vers elle reste tel qu'écrit.
 * Une cible qui n'est pas une page du guide reste. Toutes les pages là : les objets de PAGES_ECLATEES_DU_GUIDE, inchangés.
 */
export function pagesEclateesDuGuide(existe) {
  const presente = (adresse) => {
    const id = pageDuGuideALAdresse(adresse);
    return id === null || Boolean(existe(id));
  };
  const sortie = {};
  for (const [adresse, r] of Object.entries(PAGES_ECLATEES_DU_GUIDE)) {
    if (!presente(r.defaut)) continue;
    const ancres = Object.entries(r.anciennesAncres).filter(([, cible]) => presente(cible));
    sortie[adresse] = ancres.length === Object.keys(r.anciennesAncres).length ? r : gele({ ...r, anciennesAncres: gele(Object.fromEntries(ancres)) });
  }
  return gele(sortie);
}

// ---- Le plan des onglets (base, installé) ----------------------------------------------------------------------------------------------------------

let plan = null;

/**
 * Installe le plan des onglets des Règles (lib/plan-des-regles-db.mjs#chargerPlanDesRegles : [{ id, titre, ouverture, entrees: [{ page } | { libelle,
 * adresse } | { bientot }] }], dans l'ordre), une fois, là où les pages se chargent : lib/wiki.ts au build, le service à son démarrage (notes de
 * version). Un nouvel appel le remplace. Contrôle sa forme : chaque onglet a un id, un titre et au moins une entrée ; chaque entrée est d'une seule
 * sorte ; une page n'est que dans une entrée ; la page d'ouverture est une page de son onglet. Les pages elles-mêmes se contrôlent au build
 * (verifierLePlan). Rend le plan installé : les onglets gelés, chacun avec son `chemin` (`regles/<id>/`). Une entrée garde l'`id` et le `rang` de sa
 * ligne quand le plan les donne (la base : le menu latéral les pose pour le mode modification du site de dev, editionDuMenuLateral).
 */
export function installerLePlan(onglets) {
  if (!Array.isArray(onglets)) throw new Error('plan des règles : une liste d’onglets est attendue (lib/plan-des-regles-db.mjs#chargerPlanDesRegles)');
  const places = new Map();
  const ids = new Set();
  const installes = onglets.map((o, rang) => {
    if (!o || typeof o.id !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(o.id)) throw new Error(`plan des règles : id d’onglet invalide « ${o?.id} »`);
    if (ids.has(o.id)) throw new Error(`plan des règles : l’onglet ${o.id} est nommé deux fois`);
    ids.add(o.id);
    if (typeof o.titre !== 'string' || !o.titre) throw new Error(`plan des règles : l’onglet ${o.id} n’a pas de titre`);
    if (!Array.isArray(o.entrees) || o.entrees.length === 0) throw new Error(`plan des règles : l’onglet « ${o.titre} » est vide`);
    const entrees = o.entrees.map((e) => {
      const sortes = ['page', 'adresse', 'bientot'].filter((k) => e && typeof e[k] === 'string' && e[k]);
      if (sortes.length !== 1 || ('adresse' in e && !e.libelle)) throw new Error(`plan des règles : entrée illisible dans « ${o.titre} » (${JSON.stringify(e)})`);
      // l'id et le rang de la ligne (la base), gardés pour le mode modification ; un plan d'essai peut ne pas les avoir
      const ligne = {
        ...(typeof e.id === 'string' && e.id ? { id: e.id } : {}),
        ...(Number.isInteger(e.rang) ? { rang: e.rang } : {}),
      };
      if (sortes[0] === 'page') {
        if (places.has(e.page)) throw new Error(`plan des règles : ${e.page} est dans deux entrées (« ${places.get(e.page).onglet.titre} », « ${o.titre} »)`);
        return gele({ ...ligne, page: e.page });
      }
      return gele(sortes[0] === 'adresse' ? { ...ligne, libelle: e.libelle, adresse: e.adresse } : { ...ligne, bientot: e.bientot });
    });
    const onglet = gele({ id: o.id, titre: o.titre, chemin: `${CHEMIN_DES_REGLES}${o.id}/`, ouverture: o.ouverture, rang: rang + 1, entrees: Object.freeze(entrees) });
    entrees.forEach((e, ordre) => { if (e.page) places.set(e.page, { onglet, ordre }); });
    if (places.get(o.ouverture)?.onglet !== onglet) throw new Error(`plan des règles : ${o.ouverture}, ouverte à /${onglet.chemin}, n’est pas une page de « ${o.titre} »`);
    return onglet;
  });
  plan = { onglets: Object.freeze(installes), places };
  return plan.onglets;
}

/** Vrai si le plan des onglets est installé (installerLePlan). */
export const planInstalle = () => plan !== null;

function lePlan() {
  if (!plan) {
    throw new Error('lib/livres.mjs : le plan des onglets des Règles n’est pas installé — installerLePlan(chargerPlanDesRegles(db)) d’abord '
      + '(lib/plan-des-regles-db.mjs ; au build, lib/wiki.ts le fait au chargement)');
  }
  return plan;
}

/** Les onglets des Règles, dans l'ordre du menu : [{ id, titre, chemin, ouverture, rang, entrees }] (le plan installé). */
export const ongletsDesRegles = () => lePlan().onglets;

/** L'onglet d'une page (celui dont une entrée la nomme), ou null. */
export const ongletDe = (id) => lePlan().places.get(id)?.onglet ?? null;

/** L'onglet dont une entrée lien mène à `adresse` (« regles/artisanat/ » : Exploration), ou null. */
export const ongletDuLien = (adresse) => lePlan().onglets.find((o) => o.entrees.some((e) => e.adresse === adresse)) ?? null;

/** Les noms qu'aucune page des onglets ne prend (son adresse /regles/<slug>/ cacherait une autre) : NOMS_RESERVES et les ids des onglets. */
export const nomsReserves = () => [...NOMS_RESERVES, ...lePlan().onglets.map((o) => o.id)];

/** Vrai si la page est dans Découvrir. */
export function estDansDecouvrir(id) {
  return DECOUVRIR.groupes.some((g) => g.pages.includes(id));
}

/** Vrai si la page est dans le Guide du MJ. */
export function estDuGuideDuMj(id) {
  return GUIDE_DU_MJ.pages.includes(id);
}

/** Vrai si la page est dans un onglet des Règles (le plan installé). */
export const estDesOnglets = (id) => lePlan().places.has(id);

/**
 * Les pages d'une rubrique écrite ici (Découvrir), dans l'ordre : [{ id, groupe, ordre }] (`ordre` : 0…M − 1 dans la rubrique). Lu par
 * scripts/mise-a-jour-simulation.mjs (les deux premières pages de Découvrir).
 */
export function pagesDeLaRubrique(rubrique) {
  let ordre = 0;
  return rubrique.groupes.flatMap((groupe) => groupe.pages.map((id) => ({ id, groupe, ordre: ordre++ })));
}

/**
 * La partie d'une page (l'id de sa couleur, lib/palette-css.mjs#classeDePartie) : celle de son groupe pour Découvrir, « creer » pour la création du
 * personnage (PAGES_DE_LA_CREATION) ; null ailleurs : l'accent du site (réponse du propriétaire du 2026-11-05 : « Accent du site »). Sans le plan.
 */
export function partieDeLaPage(id) {
  const groupe = DECOUVRIR.groupes.find((g) => g.pages.includes(id));
  if (groupe) return groupe.partie;
  return PAGES_DE_LA_CREATION.pages.includes(id) ? PAGES_DE_LA_CREATION.partie : null;
}

/**
 * Où se range une page `guide/…`, pour la nommer et l'ordonner (notes de version, panneau de la ceinture) : { rubrique, rang, ordre } — Découvrir (rang
 * 0), un onglet des Règles (rang 1…N, `ordre` : sa place dans le menu latéral, 0…), le Guide du MJ (rang N + 1, `ordre` null). Une page qui n'est nulle
 * part (supprimée, la fixture) : { rubrique: null, rang: null, ordre: null }. Le plan installé.
 */
export function placeDansLeGuide(id) {
  const { onglets, places } = lePlan();
  const decouvrir = pagesDeLaRubrique(DECOUVRIR).find((p) => p.id === id);
  if (decouvrir) return { rubrique: DECOUVRIR.titre, rang: 0, ordre: decouvrir.ordre };
  const place = places.get(id);
  if (place) return { rubrique: place.onglet.titre, rang: place.onglet.rang, ordre: place.ordre };
  if (estDuGuideDuMj(id)) return { rubrique: GUIDE_DU_MJ.titre, rang: onglets.length + 1, ordre: null };
  return { rubrique: null, rang: null, ordre: null };
}

/**
 * Le menu latéral d'un onglet (components/guide/MenuLateral.astro), ses entrées dans l'ordre du plan : la page chargée pour une entrée page (`entries` :
 * { id, data: { title } } ; une page absente est sautée, verifierLePlan la signale), un lien ({ libelle, adresse }) ou une entrée « bientôt »
 * ({ bientot }).
 */
export function entreesDuMenuLateral(onglet, entries) {
  const parId = new Map(entries.map((e) => [e.id, e]));
  // un lien ou une entrée « bientôt » sans l'id et le rang de sa ligne (editionDuMenuLateral les donne à part) : une entrée qui a un `id` est une page
  return onglet.entrees.map((e) => (e.page ? parId.get(e.page) : e.adresse ? { libelle: e.libelle, adresse: e.adresse } : { bientot: e.bientot })).filter(Boolean);
}

/**
 * Ce que le menu latéral d'un onglet pose pour le mode modification du site de dev (components/guide/MenuLateral.astro, prop `edition` ;
 * scripts/edition/menus.mjs) : { menu: `onglet:<id>` (data-ed-menu), entrees: [{ id, rang }] (data-ed-entree, data-ed-rang : l'id et le rang de la ligne
 * de regles_onglet_entree, null sans eux), une par entrée de entreesDuMenuLateral, dans le même ordre (une page absente est sautée de même) }.
 */
export function editionDuMenuLateral(onglet, entries) {
  const charges = new Set(entries.map((e) => e.id));
  return {
    menu: `onglet:${onglet.id}`,
    entrees: onglet.entrees.filter((e) => !e.page || charges.has(e.page)).map((e) => ({ id: e.id ?? null, rang: e.rang ?? null })),
  };
}

/**
 * Le menu latéral d'une page `guide/…` : { rubrique: { titre, chemin } (son onglet), pages (entreesDuMenuLateral), edition (editionDuMenuLateral) }, ou
 * null (Découvrir, Guide du MJ, fixture). Le plan installé.
 */
export function menuLateralDe(id, entries) {
  const onglet = ongletDe(id);
  return onglet ? { rubrique: onglet, pages: entreesDuMenuLateral(onglet, entries), edition: editionDuMenuLateral(onglet, entries) } : null;
}

/**
 * Le fil d'Ariane d'une page `guide/…`, après « Accueil » : [{ titre, chemin }] (`chemin` relatif à la racine du site) — Découvrir, son onglet des
 * Règles (« Accueil › Les combats »), le Guide du MJ ; [] pour une page rangée nulle part (la fixture). Le gabarit marque le maillon qui mène à la page
 * elle-même (Bienvenue est servie à /decouvrir/). Le plan installé.
 */
export function filDAriane(id) {
  if (estDansDecouvrir(id)) return [{ titre: DECOUVRIR.titre, chemin: DECOUVRIR.chemin }];
  const onglet = ongletDe(id);
  if (onglet) return [{ titre: onglet.titre, chemin: onglet.chemin }];
  if (estDuGuideDuMj(id)) return [{ titre: GUIDE_DU_MJ.titre, chemin: GUIDE_DU_MJ.chemin }];
  return [];
}

/**
 * Contrôle du plan contre les pages chargées (`entries` : { id, data: { status } }), appelé au build par les routes (le plan installé). Arrête le build
 * (erreur qui nomme la page) plutôt que de montrer un plan faux :
 *   - chaque page nommée (Découvrir, les onglets, le Guide du MJ) existe, n'est pas une page d'exemple, est une page `guide/…`, n'est nommée qu'une fois ;
 *   - toute page `guide/…` chargée qui n'est pas d'exemple est rangée (Découvrir, un onglet, le Guide du MJ) : pas d'onglet « Autre » (R185, P7) ;
 *   - aucune page des onglets ne prend un nom réservé (nomsReserves), aucune entrée lien ne mène sous /guide/ ;
 *   - aucune page ne prend l'adresse d'une page renommée (ADRESSES_RENOMMEES_DU_GUIDE : guide/mode-super cacherait guide/liste-des-effets-mode-super) ;
 *   - aucune page absorbée, retirée ou supprimée n'est revenue, et chaque page qui en absorbe une est rangée.
 * La cible d'un renvoi figé d'une ancienne adresse (ADRESSES_DU_PLAN_PRECEDENT, PAGES_ECLATEES_DU_GUIDE) n'a pas à exister : une page des Règles
 * supprimée sur le site de dev peut l'être ; l'ancienne adresse mène alors à la 404 (R185 (6) ; lib/metiers.mjs#renvoisDuGuide, pagesEclateesDuGuide,
 * lib/guide.mjs#adresseDesAnciensLiens la sautent). Rend `entries`.
 */
export function verifierLePlan(entries) {
  const { onglets } = lePlan();
  const parId = new Map(entries.map((e) => [e.id, e]));
  const nommees = [
    ...pagesDeLaRubrique(DECOUVRIR).map(({ id }) => [id, `« ${DECOUVRIR.titre} »`]),
    ...onglets.flatMap((o) => o.entrees.filter((e) => e.page).map((e) => [e.page, `« ${o.titre} »`])),
    ...GUIDE_DU_MJ.pages.map((id) => [id, GUIDE_DU_MJ.titre]),
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
  const reserves = nomsReserves();
  for (const o of onglets) {
    if (NOMS_RESERVES.includes(o.id)) throw new Error(`plan du guide : l'onglet ${o.id} prend un nom réservé (${NOMS_RESERVES.join(', ')})`);
    for (const e of o.entrees) {
      if (e.page && reserves.includes(slugDAdresse(e.page))) throw new Error(`plan du guide : ${e.page} prend un nom réservé (${reserves.join(', ')})`);
      if (e.adresse?.startsWith('guide/')) throw new Error(`plan du guide : l'entrée « ${e.libelle} » de « ${o.titre} » mène sous /guide/`);
    }
  }
  for (const [ancienne, nouvelle] of Object.entries(PAGES_ABSORBEES)) {
    if (parId.has(ancienne)) throw new Error(`plan du guide : ${ancienne} est absorbée par ${nouvelle} et ne doit plus être dans la base`);
    if (!vues.has(nouvelle)) throw new Error(`plan du guide : ${nouvelle}, qui absorbe ${ancienne}, n'est pas dans le plan`);
  }
  for (const [retiree, { vers }] of Object.entries(PAGES_RETIREES)) {
    if (parId.has(retiree)) throw new Error(`plan du guide : ${retiree} est retirée (ses adresses mènent à /${vers}) et ne doit plus être dans la base`);
  }
  for (const supprimee of PAGES_SUPPRIMEES) {
    if (parId.has(supprimee) && !vues.has(supprimee)) throw new Error(`plan du guide : ${supprimee}, supprimée (R184), est revenue sans place dans le plan`);
  }
  for (const [id, slug] of Object.entries(ADRESSES_RENOMMEES_DU_GUIDE)) {
    const autre = `guide/${slug}`;
    if (parId.has(autre)) throw new Error(`plan du guide : ${autre} prendrait l'adresse /${adresseDuGuide(id)}, celle de ${id} (ADRESSES_RENOMMEES_DU_GUIDE)`);
  }
  for (const e of entries) {
    if (e.id.startsWith('guide/') && e.data?.status !== 'example' && !vues.has(e.id)) {
      throw new Error(`plan du guide : ${e.id} n'est rangée nulle part (ni Découvrir, ni un onglet des Règles, ni le Guide du MJ) : l'ajouter au plan (table regles_onglet_entree)`);
    }
  }
  return entries;
}
