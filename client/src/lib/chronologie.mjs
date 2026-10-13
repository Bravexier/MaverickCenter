// Chronologie (/chronologie/, docs/chronologie.md) : les événements datés du Codex et des pages de race, une page par événement, lue comme le guide
// du joueur (demande du propriétaire : flèches Précédent / Suivant, glissement du doigt, clavier) mais avec une frise en haut et en bas au lieu de la
// pagination numérotée. Les événements sont les lignes de `evenement` (data/schema.sql, section 5 bis), dans l'ordre de `rang` ; le premier est servi
// à /chronologie/ (comme le premier chapitre du guide à /guide/), les autres à /chronologie/<id>/.
// Module pur, sans dépendance (ni node:, ni Astro) : importé par les pages, le chargeur (chronologie-db.mjs), l'outil du registre
// (tools/chronologie/chronologie.mjs) et les tests.

/**
 * Les époques de la frise, dans l'ordre. « Au début » reprend le nom de la partie du Codex qui ouvre le document (« Au début … » : Origine du monde,
 * Situation actuelle, Les Impacts) ; « Date inconnue » range les événements que la liste des Impacts date « ??? » ; « Aujourd'hui » est la situation
 * actuelle. Les événements datés sont rangés par siècle (periodesDeLaFrise).
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

/** La date d'un événement telle que la frise l'affiche : « An 505 », « An -400 à -350 », ou le nom de son époque hors des années. */
export function libelleDeDate(evenement) {
  if (evenement.epoque !== 'datee') return EPOQUES.find((e) => e.id === evenement.epoque)?.titre ?? '';
  return evenement.annee_fin === null || evenement.annee_fin === undefined
    ? `An ${evenement.annee}`
    : `An ${evenement.annee} à ${evenement.annee_fin}`;
}

/** Le siècle d'une année, compté par centaines : -450 → -500 (de -500 à -401), 0 → 0, 1138 → 1100. */
export const siecle = (annee) => Math.floor(annee / 100) * 100;

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

/** L'événement d'id donné et ses voisins dans l'ordre de lecture : { evenement, precedent, suivant } (null au bord : flèche grisée). */
export function voisins(evenements, id) {
  const i = evenements.findIndex((e) => e.id === id);
  if (i < 0) throw new Error(`chronologie : ${id} n'est pas un événement`);
  return { evenement: evenements[i], precedent: evenements[i - 1] ?? null, suivant: evenements[i + 1] ?? null };
}

/** Adresse d'un événement, relative à la racine du site : le premier est l'accueil de l'onglet (/chronologie/), les autres /chronologie/<id>/. */
export const adresseDEvenement = (evenements, id) => (evenements[0]?.id === id ? 'chronologie/' : `chronologie/${id}/`);

/**
 * Couleurs des périodes de la frise, assez foncées pour un texte blanc dessus : « Au début » en violet, puis les siècles du bleu au rouge brique
 * (teinte qui tourne avec le temps), « Date inconnue » en gris, « Aujourd'hui » en vert sombre. Pur repère visuel : aucune époque du lore n'est déduite.
 */
const COULEUR_DEBUT = '#5b4a9c';
const COULEUR_INCONNUE = '#5a6470';
const COULEUR_AUJOURDHUI = '#24715a';
const couleurDeSiecle = (i, n) => `hsl(${Math.round(205 - (n > 1 ? (i / (n - 1)) * 195 : 0))} 55% 31%)`;

/**
 * Les périodes de la frise, dans l'ordre : [{ id, epoque, titre, libelle, description, couleur, evenements }]. Hors des époques datées, une période par
 * époque (« Au début », « Date inconnue », « Aujourd'hui ») ; les événements datés sont rangés par siècle (titre sur la frise : l'année du début du
 * siècle, « -500 », « 0 », « 1100 » ; libellé de la pastille de la page : « An 0 à 99 »).
 * Une période sans événement n'apparaît pas. `evenements` : la liste rendue par `ordonner`.
 */
export function periodesDeLaFrise(evenements) {
  const periodes = [];
  for (const e of evenements) {
    const id = e.epoque === 'datee' ? `siecle-${siecle(e.annee)}` : e.epoque;
    let p = periodes.at(-1);
    if (!p || p.id !== id) {
      p = { id, epoque: e.epoque, siecle: e.epoque === 'datee' ? siecle(e.annee) : null, evenements: [] };
      periodes.push(p);
    }
    p.evenements.push(e);
  }
  const siecles = periodes.filter((p) => p.epoque === 'datee');
  return periodes.map((p) => ({
    id: p.id,
    epoque: p.epoque,
    titre: p.epoque === 'datee' ? String(p.siecle) : EPOQUES.find((x) => x.id === p.epoque).titre,
    libelle: p.epoque === 'datee' ? `An ${p.siecle} à ${p.siecle + 99}` : EPOQUES.find((x) => x.id === p.epoque).titre,
    description: p.epoque === 'datee' ? `De l’an ${p.siecle} à l’an ${p.siecle + 99}` : EPOQUES.find((x) => x.id === p.epoque).titre,
    couleur:
      p.epoque === 'debut' ? COULEUR_DEBUT
        : p.epoque === 'inconnue' ? COULEUR_INCONNUE
          : p.epoque === 'aujourdhui' ? COULEUR_AUJOURDHUI
            : couleurDeSiecle(siecles.indexOf(p), siecles.length),
    evenements: p.evenements,
  }));
}

/** La période (de periodesDeLaFrise) d'un événement. */
export const periodeDe = (periodes, id) => periodes.find((p) => p.evenements.some((e) => e.id === id));

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
