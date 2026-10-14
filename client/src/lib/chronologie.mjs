// Chronologie (/chronologie/, docs/chronologie.md) : les événements datés du Codex et des pages de race (demande du propriétaire) : à gauche, la
// chronologie en une immense barre verticale en dégradé, la date à gauche de la barre et le titre à droite ; un clic ouvre la page de l'événement à
// côté (75 % de la largeur), et deux chevrons, tout à droite, passent au précédent ou au suivant. Les événements sont les lignes de `evenement`
// (data/schema.sql, section 5 bis), dans l'ordre de `rang`, chacun à /chronologie/<id>/ ; /chronologie/ montre la frise seule et son mode d'emploi.
// Module pur, sans dépendance (ni node:, ni Astro) : importé par les pages, le chargeur (chronologie-db.mjs), l'outil du registre
// (tools/chronologie/chronologie.mjs) et les tests.

/**
 * Les époques de la frise, dans l'ordre. « Au début » reprend le nom de la partie du Codex qui ouvre le document (« Au début … » : Origine du monde,
 * Situation actuelle, Les Impacts) ; « Date inconnue » range les événements que la liste des Impacts date « ??? » ; « Aujourd'hui » est la situation
 * actuelle.
 */
export const EPOQUES = [
  { id: 'debut', titre: 'Au début' },
  { id: 'datee', titre: 'Événements datés' },
  { id: 'inconnue', titre: 'Date inconnue' },
  { id: 'aujourdhui', titre: 'Aujourd’hui' },
];

/** Portée d'un événement de la page « Les Impacts mineur et majeur » du Codex (titres de ses deux listes). */
export const PORTEES = { majeur: 'Impact majeur', mineur: 'Impact mineur' };

const rangDEpoque = (id) => EPOQUES.findIndex((e) => e.id === id);

/** La date d'un événement telle que sa page l'affiche : « An 505 », « An -400 à -350 », ou le nom de son époque hors des années. */
export function libelleDeDate(evenement) {
  if (evenement.epoque !== 'datee') return EPOQUES.find((e) => e.id === evenement.epoque)?.titre ?? '';
  return evenement.annee_fin === null || evenement.annee_fin === undefined
    ? `An ${evenement.annee}`
    : `An ${evenement.annee} à ${evenement.annee_fin}`;
}

/**
 * Les événements dans l'ordre de lecture, vérifiés : rangs 1, 2, 3… sans trou, époques dans l'ordre de EPOQUES, années croissantes (au sens large)
 * parmi les événements datés, une année exactement pour eux seuls. Sinon une erreur : le build s'arrête plutôt que de montrer une frise fausse.
 */
export function ordonner(evenements) {
  const liste = [...evenements].sort((a, b) => a.rang - b.rang);
  liste.forEach((e, i) => {
    if (e.rang !== i + 1) throw new Error(`chronologie : rang ${i + 1} attendu, ${e.id} porte le rang ${e.rang}`);
    if (rangDEpoque(e.epoque) < 0) throw new Error(`chronologie : ${e.id} a une époque inconnue (${e.epoque})`);
    if ((e.epoque === 'datee') !== Number.isInteger(e.annee)) throw new Error(`chronologie : ${e.id} : une année pour les événements datés, et pour eux seuls`);
    const avant = liste[i - 1];
    if (!avant) return;
    if (rangDEpoque(e.epoque) < rangDEpoque(avant.epoque)) throw new Error(`chronologie : ${e.id} (${e.epoque}) vient après ${avant.id} (${avant.epoque})`);
    if (e.epoque === 'datee' && avant.epoque === 'datee' && e.annee < avant.annee) {
      throw new Error(`chronologie : ${e.id} (an ${e.annee}) vient après ${avant.id} (an ${avant.annee})`);
    }
  });
  return liste;
}

/** L'événement d'id donné et ses voisins dans l'ordre de lecture : { evenement, precedent, suivant } (null au bord : chevron grisé). */
export function voisins(evenements, id) {
  const i = evenements.findIndex((e) => e.id === id);
  if (i < 0) throw new Error(`chronologie : ${id} n'est pas un événement`);
  return { evenement: evenements[i], precedent: evenements[i - 1] ?? null, suivant: evenements[i + 1] ?? null };
}

/** Adresse d'un événement, relative à la racine du site : /chronologie/<id>/ (/chronologie/ est l'accueil de l'onglet : la frise seule et son mode d'emploi). */
export const adresseDEvenement = (id) => `chronologie/${id}/`;

/** La date d'un événement dans la colonne de gauche de la frise : l'année sans « An » (« 505 », « -400 à -350 »), ou le nom de son époque hors des années. */
export function dateCourte(evenement) {
  return evenement.epoque === 'datee' ? libelleDeDate(evenement).replace(/^An /, '') : libelleDeDate(evenement);
}

/** Contraste WCAG entre deux couleurs « #rrggbb » (1 à 21). */
export function contraste(a, b) {
  const luminance = (hex) => {
    const [r, g, v] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * v;
  };
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

/** « #rrggbb » d'une teinte TSL (t en degrés, s et l de 0 à 1). */
function hexDeTsl(t, s, l) {
  const f = (n) => {
    const k = (n + t / 30) % 12;
    return l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return `#${[f(0), f(8), f(4)].map((c) => Math.round(c * 255).toString(16).padStart(2, '0')).join('')}`;
}

const COULEUR_INCONNUE = '#5a6470';
const COULEUR_AUJOURDHUI = '#24715a';
const TEINTE_DU_DEBUT = 285;
const TEINTE_DE_LA_FIN = 5;

/**
 * Couleurs de la frise et des pages, une par événement (demande du propriétaire : la chronologie en une immense barre verticale avec un dégradé).
 * Les événements « Au début » et datés suivent la roue des couleurs dans l'ordre de lecture, du violet (les origines) au rouge (les derniers siècles),
 * en passant par le bleu, le vert et l'or ; « Date inconnue » est gris, « Aujourd'hui » vert sombre. Chaque teinte est assez foncée pour un texte blanc
 * dessus (4,5:1). Pur repère visuel : aucune époque du lore n'en est déduite. Rend une Map(id -> « #rrggbb »).
 */
export function couleursDesEvenements(evenements) {
  const roue = evenements.filter((e) => e.epoque === 'debut' || e.epoque === 'datee');
  const couleurs = new Map();
  roue.forEach((e, i) => {
    const t = TEINTE_DU_DEBUT - (roue.length > 1 ? i / (roue.length - 1) : 0) * (TEINTE_DU_DEBUT - TEINTE_DE_LA_FIN);
    // la plus claire des teintes qui gardent 4,5:1 (marge : 4,6) avec le blanc
    let l = 0.4;
    while (contraste(hexDeTsl(t, 0.58, l), '#ffffff') < 4.6) l -= 0.01;
    couleurs.set(e.id, hexDeTsl(t, 0.58, l));
  });
  for (const e of evenements) {
    if (e.epoque === 'inconnue') couleurs.set(e.id, COULEUR_INCONNUE);
    if (e.epoque === 'aujourdhui') couleurs.set(e.id, COULEUR_AUJOURDHUI);
  }
  return couleurs;
}

/**
 * Les extraits d'un événement regroupés par page source consécutive : [{ page_id, page_titre, extraits }] (une seule légende « Page › section »
 * pour plusieurs passages de la même page qui se suivent).
 */
export function extraitsParPage(extraits) {
  const groupes = [];
  for (const x of extraits) {
    const dernier = groupes.at(-1);
    if (dernier && dernier.page_id === x.page_id) dernier.extraits.push(x);
    else groupes.push({ page_id: x.page_id, page_titre: x.page_titre, extraits: [x] });
  }
  return groupes;
}

// Marqueurs de la date à surligner dans un extrait : deux caractères de la zone d'usage privé, posés dans le Markdown autour de `date_brut` et changés en
// <mark> une fois le HTML rendu (le Markdown d'une page ne peut pas en contenir : rien de ce que la source écrit n'est confondu avec eux).
export const DEBUT_DATE = '';
export const FIN_DATE = '';

/** Le Markdown d'un extrait avec sa date entourée des marqueurs (la première occurrence, celle que la source écrit) ; inchangé sans date. */
export function marquerLaDate(texte, date) {
  if (!date) return texte;
  const i = texte.indexOf(date);
  if (i < 0) return texte;
  return texte.slice(0, i) + DEBUT_DATE + date + FIN_DATE + texte.slice(i + date.length);
}

/** Le titre d'une section tel que la légende d'un extrait l'affiche : sans le deux-points final d'un titre de liste (« Impact majeur : »). */
export const titreDeSection = (section) => section.replace(/\s*:\s*$/, '');

/**
 * Le HTML rendu d'un extrait marqué (marquerLaDate) : les marqueurs deviennent <mark class="chrono-surligne">…</mark> si la date est restée d'un seul tenant
 * (aucune balise entre les deux) ; sinon ils sont simplement retirés.
 */
export function surlignerLaDate(html) {
  const debut = html.indexOf(DEBUT_DATE);
  const fin = html.indexOf(FIN_DATE);
  const sans = (t) => t.replaceAll(DEBUT_DATE, '').replaceAll(FIN_DATE, '');
  if (debut < 0 || fin < debut || html.slice(debut, fin).includes('<')) return sans(html);
  return sans(html.slice(0, debut)) + '<mark class="chrono-surligne">' + html.slice(debut + 1, fin) + '</mark>' + sans(html.slice(fin + 1));
}
