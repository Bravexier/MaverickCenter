// Couleur d'une potion (sous-onglet Consommables de l'onglet « Ceinture » de la page /ressources/equipement/) : une RÈGLE du site, jamais une couleur
// relevée ligne par ligne (demande du propriétaire du 2026-10-22 : « Partout il faut utiliser Que les couleurs du site. Si le site n'a pas de règle il
// ajoute une nouvelle couleur au site en se basant sur celle du classeur. Aucune couleur en dur. » ; puis, pour le texte : « Privilégé la lisibilité. »).
//
// La règle est un CHOIX DU SITE, inspiré des gammes du Google Doc « Alchimie » (lu le 2026-10-16 sur l'original : chaque fiole y a sa teinte, ses
// paliers du clair au foncé ; le Doc ne suit pas une règle unique, voir docs/content-guide.md, « Ceinture ») : une teinte par AFFINITÉ DE L'ESSENCE de la
// potion, déclinée selon son NIVEAU D'ALCHIMIE. Ici :
//   0. une page de potion dont le propriétaire a choisi la couleur prend la magie qu'il a nommée (COULEURS_CHOISIES_PAR_PAGE, ses retours carte par
//      carte du 2026-10-23), avant la règle de l'affinité ; aucune autre page n'en déduit rien ;
//   1. sinon, la base est la couleur de l'affinité de l'essence de la potion (`recette_ingredient`, rôle « essence », de la première variante de sa recette) :
//      - un attribut a la couleur du site (lib/attributs-couleurs.mjs : santé, chakra, barrière, corruption) ;
//      - une magie, la couleur de la magie sur le site (sort-format.mjs) ;
//      - la 4ᵉ barre, la couleur de la magie Nécromancie (MAGIE_DE_L_AFFINITE ; demande du propriétaire du 2026-10-23 : « La fiole verte foncée devrai
//        avoir la couleur verte foncée en s'inspirant de la couleur de la nécromancie. ») : la classe de la magie, sans couleur ajoutée (la 4ᵉ barre
//        de la fiche, elle, prend la couleur de la magie qui la donne, Sang ou Nécromancie : lib/fiche-moteur.mjs#attributsDe) ;
//      - une autre affinité, la couleur que le site lui ajoute (COULEURS_DES_AFFINITES), d'après le Doc : la teinte de la fiole de cette affinité au
//        palier Super (niveau Avancé, le milieu de sa gamme) ;
//      - l'affinité Démon, essence de tous les philtres, n'a pas de fiole dans le Doc : un philtre prend la couleur de la caractéristique que nomment les
//        effets de sa page (« compétences de Force » ; l'Ultime, « +1 Force », la reçoit de sa page : lib/ceinture-db.mjs ;
//        lib/caracteristiques-postures.mjs) ;
//      - l'affinité Anti n'a pas de couleur dans le Doc : la ligne reste neutre (ses deux pages, Huile rage et Remède enragé, ont depuis le 2026-10-23
//        la couleur que le propriétaire leur a choisie, le Vide : étape 0) ;
//   2. la nuance du niveau est calculée depuis la base (NUANCES_DES_NIVEAUX : mêlée de blanc pour Novice et Apprenti, la base à Avancé, mêlée de noir pour
//      Expert et Maître ; parts choisies par le site) ; une base blanche, que le blanc n'éclaircit pas (la magie du Vide), suit
//      NUANCES_D_UNE_BASE_BLANCHE : blanche jusqu'à Apprenti, puis un cran plus sombre à chaque palier (réponse du propriétaire du 2026-10-23 :
//      « Dégradé visible » ; teintes validées par le propriétaire le 2026-10-23 : « Oui, les garder ») ;
//   3. le texte est le plus lisible sur le fond (sort-format.mjs#texteSurCouleur) ; un fond qui n'atteint pas un contraste de 4,5:1 avec lui (seuil
//      AA du WCAG) est éclairci (texte foncé) ou assombri (texte blanc) jusqu'à l'atteindre (`lisible`).
// Repère visuel sans valeur de règle du jeu. Une potion dont le niveau ou l'effet change sur le site de dev suit la même règle à la construction
// suivante du site (l'éditeur réécrit les cases de la ligne, pas sa classe).
// Couleurs sous forme de classes (choix du propriétaire du 2026-10-22, « Règle de calcul ») : la base d'une potion est une classe du site
// (`base` : { famille, cle }, la classe `.couleur-<famille>-<cle>` de lib/palette-css.mjs) ; la nuance du niveau et le fond lisible se calculent depuis
// elle, et la page Équipement n'émet la classe d'une combinaison (lib/palette-css.mjs#classeDePotion) que pour les potions qu'elle affiche.
// Sans dépendance (modules purs : attributs-couleurs.mjs, sort-format.mjs, caracteristiques-postures.mjs) ; importé par lib/ceinture-db.mjs,
// lib/palette-css.mjs et les tests.
import { couleurDAttribut } from './attributs-couleurs.mjs';
import { cleDeMagieConnue, couleurDeMagieConnue, texteSurCouleur } from './sort-format.mjs';
import { COULEURS_CARACTERISTIQUES } from './caracteristiques-postures.mjs';

/** L'affinité de l'essence de tous les philtres : sans fiole dans le Doc, un philtre prend la couleur de sa caractéristique. */
export const AFFINITE_DES_PHILTRES = 'demon';

/**
 * L'attribut de la fiche (lib/attributs-couleurs.mjs) dont une affinité d'alchimie (`affinite.id`) prend la couleur. La 4ᵉ barre n'en est plus : elle
 * prend celle d'une magie (MAGIE_DE_L_AFFINITE).
 */
export const ATTRIBUT_DE_L_AFFINITE = Object.freeze({ sante: 'sante', chakra: 'chakra', barriere: 'barriere', corruption: 'corruption' });

/**
 * La magie du site (son nom court, sort-format.mjs) dont une affinité d'alchimie qui n'est pas une magie prend la couleur : la 4ᵉ barre, la Nécromancie
 * (demande du propriétaire du 2026-10-23 : « La fiole verte foncée devrai avoir la couleur verte foncée en s'inspirant de la couleur de la
 * nécromancie. »). Sa base est la classe de la magie (`couleur-magie-necromancie`) : aucune couleur n'est ajoutée ni recopiée.
 */
export const MAGIE_DE_L_AFFINITE = Object.freeze({ '4eme-barre': 'necromancie' });

/**
 * Les choix du propriétaire, page de potion par page de potion (`ressource.page_id`) : la base que prennent toutes les potions de la page, avant la
 * règle de l'affinité de leur essence ; la couleur d'une magie du site (sa classe), jamais une couleur ajoutée. Ses retours du 2026-10-23, carte par
 * carte (une carte non citée suit la règle) :
 *   - « Le remède enragé est de la couleur du Vide » ;
 *   - « Le remêde du saignement devrai être couleur sang » (la magie du Sang du site) ;
 *   - « Le remêde brûlure devrai couleur feu » ;
 *   - « L'huile rage devrai être couleur du Vide » ;
 *   - « L'huile séraphine couleur feu ».
 * Puis, à la question « L'Huile hémophile (inflige saignement, rouge-orangé #cc4125) passe-t-elle en Sang comme le Remède saignement ? » :
 *   - « Huile hémophile → Sang » (la magie du Sang du site, comme le Remède saignement ; la Fiole bordeaux, de même essence, garde la sienne).
 * (« Le remède du poison couleur nécromancie » et « L'huile toxique devrait être couleur nécromancie », comme la Fiole verte foncée, suivent l'affinité
 * 4ᵉ barre : MAGIE_DE_L_AFFINITE.)
 */
export const COULEURS_CHOISIES_PAR_PAGE = Object.freeze({
  'ressources/remede-enrage': Object.freeze({ famille: 'magie', cle: 'vide' }),
  'ressources/remede-saignement': Object.freeze({ famille: 'magie', cle: 'sang' }),
  'ressources/remede-brulure': Object.freeze({ famille: 'magie', cle: 'feu' }),
  'ressources/huile-rage': Object.freeze({ famille: 'magie', cle: 'vide' }),
  'ressources/huile-seraphine': Object.freeze({ famille: 'magie', cle: 'feu' }),
  'ressources/huile-hemophile': Object.freeze({ famille: 'magie', cle: 'sang' }),
});

/** La base que le propriétaire a choisie pour une page de potion ({ famille, cle }, une copie), ou null. */
export const baseChoisieDeLaPage = (page) =>
  (page && Object.hasOwn(COULEURS_CHOISIES_PAR_PAGE, page) ? baseAvecCouleur({ ...COULEURS_CHOISIES_PAR_PAGE[page] }) : null);

/**
 * Les couleurs que le site ajoute pour les affinités qui n'avaient pas de règle (ni attribut ni magie), d'après le Doc « Alchimie » : la teinte de la
 * fiole de chaque affinité au palier Super (niveau Avancé). L'Universelle suit la Fiole multicolore, que le Doc décline en gris (sa Panacée, elle, est
 * orange dans le Doc).
 */
export const COULEURS_DES_AFFINITES = Object.freeze({
  'chakra+sante': '#8e7cc3', // Fiole mauve
  'barriere+chakra': '#93c47d', // Fiole verte
  'barriere+sante': '#f6b26b', // Fiole orange
  'regeneration-sante': '#cc4125', // Fiole bordeaux
  'regeneration-chakra': '#efefef', // Fiole blanche
  coma: '#e4cb7f', // Fiole beige
  'armure-magique': '#76a5af', // Fiole cyante
  'armure-physique': '#a36627', // Fiole brune
  vitesse: '#c27ba0', // Fiole rose
  universelle: '#efefef', // Fiole multicolore
});

/**
 * La couleur du site que prend une affinité, { famille, cle } (la famille et la clé de sa classe, lib/palette-css.mjs) : son attribut
 * (`attribut`), sa magie (`magie`, le nom court de la magie, ou celle de MAGIE_DE_L_AFFINITE) ou la couleur que le site lui ajoute (`affinite`) ; null si le site n'en a pas (Anti,
 * Démon). Une affinité qui est un attribut ou une magie garde la classe de cet attribut ou de cette magie : aucune couleur n'est recopiée.
 */
export function baseDAffinite(id) {
  if (!id) return null;
  if (Object.hasOwn(ATTRIBUT_DE_L_AFFINITE, id)) return baseAvecCouleur({ famille: 'attribut', cle: ATTRIBUT_DE_L_AFFINITE[id] });
  if (Object.hasOwn(MAGIE_DE_L_AFFINITE, id)) return baseAvecCouleur({ famille: 'magie', cle: MAGIE_DE_L_AFFINITE[id] });
  const magie = cleDeMagieConnue(id);
  if (magie) return baseAvecCouleur({ famille: 'magie', cle: magie });
  return baseAvecCouleur({ famille: 'affinite', cle: id });
}

/**
 * Une base de potion ({ famille, cle }) dont la règle donne bien une couleur, ou null : un attribut, une magie, une affinité ou une caractéristique
 * sans couleur laisse la ligne neutre (jamais une couleur incalculable).
 */
export const baseAvecCouleur = (base) => (couleurDeLaBase(base) ? base : null);

/** La couleur (« #rrggbb ») d'une base de potion ({ famille, cle }), lue dans le module de sa règle ; null si la règle n'en a pas. */
function couleurDeLaBase(base) {
  if (!base) return null;
  if (base.famille === 'attribut') return couleurDAttribut(base.cle);
  if (base.famille === 'magie') return couleurDeMagieConnue(base.cle);
  if (base.famille === 'affinite') return Object.hasOwn(COULEURS_DES_AFFINITES, base.cle) ? COULEURS_DES_AFFINITES[base.cle] : null;
  if (base.famille === 'caracteristique') return Object.hasOwn(COULEURS_CARACTERISTIQUES, base.cle) ? COULEURS_CARACTERISTIQUES[base.cle] : null;
  return null;
}

/** La couleur de base d'une affinité : celle de son attribut, de sa magie ou celle que le site lui donne ; null si le site n'en a pas (Anti, Démon). */
export const couleurDAffinite = (id) => couleurDeLaBase(baseDAffinite(id));

/**
 * La nuance de chaque niveau d'alchimie (`niveau_alchimie.rang` : 1 Novice … 5 Maître), inspirée des gammes du Doc : la part de blanc ou de noir mêlée à
 * la base (valeurs choisies par le site). Avancé (3) est la base elle-même.
 */
export const NUANCES_DES_NIVEAUX = Object.freeze({
  1: Object.freeze({ vers: 'blanc', part: 0.7 }),
  2: Object.freeze({ vers: 'blanc', part: 0.45 }),
  3: null,
  4: Object.freeze({ vers: 'noir', part: 0.2 }),
  5: Object.freeze({ vers: 'noir', part: 0.4 }),
});

/**
 * La nuance de chaque niveau pour une base blanche (le blanc pur : la magie du Vide, couleur du Remède enragé et de l'Huile rage). Mêlé de blanc, le
 * blanc reste blanc : avec NUANCES_DES_NIVEAUX, Novice, Apprenti et Avancé seraient tous trois blancs. Le propriétaire, à la question « Faut-il un
 * palier visible entre Apprenti et Avancé ? », a répondu « Dégradé visible » (2026-10-23), sans préciser de teinte : Novice et Apprenti restent
 * blancs (rien n'est plus clair), puis chaque palier s'assombrit d'un cran : Avancé gris très clair (10 % de noir), Expert et Maître comme toute
 * base (20 % et 40 % de noir : gris clair, gris). Teintes validées par le propriétaire le 2026-10-23 : à la question qui les lui présentait (le
 * dégradé du Vide sur le Remède enragé et l'Huile rage : Apprenti blanc, Avancé gris très clair, Expert gris clair, Maître gris, texte foncé et
 * lisible ; « Ces teintes vous conviennent ? »), il a répondu « Oui, les garder ». Toute autre base suit
 * NUANCES_DES_NIVEAUX, inchangée.
 */
export const NUANCES_D_UNE_BASE_BLANCHE = Object.freeze({
  1: null,
  2: null,
  3: Object.freeze({ vers: 'noir', part: 0.1 }),
  4: NUANCES_DES_NIVEAUX[4],
  5: NUANCES_DES_NIVEAUX[5],
});

const CIBLES = { blanc: [255, 255, 255], noir: [0, 0, 0] };
const canaux = (hex) => String(hex).slice(1).match(/.{2}/g).map((c) => parseInt(c, 16));
const versHex = (rgb) => `#${rgb.map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')}`;
const estBlanche = (hex) => canaux(hex).every((c) => c === 255);

/**
 * La nuance d'une couleur (« #rrggbb ») au niveau `rang` : la base mêlée de blanc ou de noir (NUANCES_DES_NIVEAUX, ou NUANCES_D_UNE_BASE_BLANCHE pour
 * le blanc pur) ; la base pour un rang inconnu.
 */
export function nuanceDuNiveau(base, rang) {
  const n = (estBlanche(base) ? NUANCES_D_UNE_BASE_BLANCHE : NUANCES_DES_NIVEAUX)[rang];
  if (!n) return base;
  const cible = CIBLES[n.vers];
  return versHex(canaux(base).map((c, i) => c * (1 - n.part) + cible[i] * n.part));
}

const cle = (t) => String(t ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

/**
 * La caractéristique dont un effet augmente les compétences (« +5% dans toutes les compétences de Force », « compétences d' Agilité ») : son id parmi
 * `caracteristiques` ([{ id, nom }]), ou null si l'effet n'en nomme aucune. Seul le nom exact d'une caractéristique compte (rien par vraisemblance).
 */
export function caracteristiqueDesCompetences(effet, caracteristiques) {
  const m = /competences d(?:e\s+|['’]\s*)([a-z]+)/.exec(cle(effet));
  if (!m) return null;
  return caracteristiques.find((c) => cle(c.nom) === m[1])?.id ?? null;
}

/** Le contraste minimal entre le texte et le fond d'une ligne (seuil AA du WCAG pour un texte courant) : « Privilégé la lisibilité. » */
export const CONTRASTE_MINIMAL = 4.5;

const luminance = (hex) => {
  const [r, g, b] = canaux(hex).map((c) => c / 255).map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** Le contraste entre deux couleurs (« #rrggbb »), de 1 à 21 (formule du WCAG). */
export function contraste(a, b) {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/**
 * Un fond lisible : le fond lui-même si son texte (texteSurCouleur) l'atteint déjà au contraste minimal, sinon éclairci (texte foncé) ou assombri (texte
 * blanc) par pas de 5 % jusqu'à l'atteindre ; le texte reste celui du fond de départ.
 */
export function lisible(fond) {
  const texte = texteSurCouleur(fond);
  const vers = luminance(texte) > luminance(fond) ? CIBLES.noir : CIBLES.blanc;
  let rgb = canaux(fond);
  let resultat = fond;
  for (let i = 0; i < 20 && contraste(resultat, texte) < CONTRASTE_MINIMAL; i++) {
    rgb = rgb.map((c, k) => c * 0.95 + vers[k] * 0.05);
    resultat = versHex(rgb);
  }
  return resultat;
}

/**
 * La couleur d'une potion, ou null (ligne neutre) : `page`, l'id de sa page (son choix du propriétaire, COULEURS_CHOISIES_PAR_PAGE, passe avant tout) ;
 * `essence`, l'affinité de son essence ; `caracteristique`, celle que nomment les effets de sa page, qui ne compte que pour un philtre (essence
 * AFFINITE_DES_PHILTRES) ; `niveau`, le rang de son niveau d'alchimie. Rend { fond, texte, base, niveau } :
 * le fond (« #rrggbb », la base nuancée au niveau puis rendue lisible), le texte le plus lisible dessus, la base ({ famille, cle } : la classe du
 * site d'où la couleur se calcule) et le niveau (null s'il manque) ; la classe de la combinaison : lib/palette-css.mjs#classeDePotion.
 */
export function couleurDePotion({ page = null, essence = null, caracteristique = null, niveau = null } = {}) {
  const base = baseChoisieDeLaPage(page)
    ?? baseDAffinite(essence)
    ?? (essence === AFFINITE_DES_PHILTRES && caracteristique ? baseAvecCouleur({ famille: 'caracteristique', cle: caracteristique }) : null);
  if (!base) return null;
  const fond = lisible(nuanceDuNiveau(couleurDeLaBase(base), niveau));
  return { fond, texte: texteSurCouleur(fond), base, niveau: niveau ?? null };
}
