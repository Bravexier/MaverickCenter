// Cadre « Schéma de la base » de la page Debug (pages/debug.astro, site de dev seulement ; demande du propriétaire du 2026-10-15 : « En plus d'un
// openapi, je veux un mappage vectoriel des tables. Ce cadre peut aussi être déroulé, masqué par défaut. Dans le cadre j'aimerais pouvoir zoomer et
// dézoomer pour voir une représentation de l'ensemble des tables de la base, et des liens entre elles. Les tables montreraient une liste de toutes les
// colonnes et des liens pour les FK vers une autre table, ainsi que le type de données. D'un double clic sur une de ces tables, ça ouvrirait une popup
// avec le contenu dans un tableau (scrollable). »).
//
// Fonctions pures, sans DOM ni dépendance (importées par scripts/debug-schema.mjs seulement, et au build par components/debug/SchemaDeLaBase.astro) :
//   - mise en page (mettreEnPage) : une boîte par table, un bloc par section du schéma ; dans un bloc, les tables rangées en couches selon leurs clés
//     étrangères internes à la section (une table à droite des tables qu'elle cite : les liens vont de droite à gauche), ordonnées dans chaque couche par
//     barycentre (aller-retour, pour croiser moins de liens), puis chaque couche trop haute coupée en sous-colonnes (compactage : bloc de proportions
//     RAPPORT_SECTION) ; les blocs posés par « ligne d'horizon » (chacun le plus haut possible, dans l'ordre du schéma) dans une largeur qui donne une
//     carte de proportions RAPPORT_GLOBAL ; les vues (masquées par défaut) dans leurs propres blocs, posés APRÈS ceux des tables : les montrer ne
//     déplace aucune table. Déterministe ; aucun chevauchement (test/debug-schema.test.mjs, sur le vrai schéma) ;
//   - géométrie des liens (geometrieDuLien) : un lien par clé étrangère, de la ligne de la colonne au bord de la table visée (à la ligne de la colonne
//     visée), courbe de Bézier, flèche à l'arrivée ; auto-référence : une boucle à droite. Une clé à plusieurs colonnes : un lien, tiré de la paire
//     (colonne, colonne visée) qui la distingue (indiceDuLien : pour une auto-référence, la première colonne qui ne se vise pas elle-même ; sinon la
//     première qui n'est dans aucune autre clé de la table) : race_don_tableau_cellule(race_id, ligne) part de `ligne`, note_cellule de `repond_a` ;
//   - caméra : écran = schéma × k + (x, y) ; zoom autour d'un point, bornes, « tout voir », centrage, interpolation (animation) ; niveaux de détail ;
//   - navigation au clavier (tableVoisine), recherche (chercherTable) ;
//   - rendu (htmlDuSchema : chaînes, une seule fois ; boîtes en HTML, liens en SVG, voir « Rendu ») et rendu de la fenêtre « Contenu de <table> »
//     (GET <base>api/debug/tables/<nom>/).
// Texte de la base (noms, descriptions, valeurs) : toujours échappé. Jamais d'infobulle native : `data-infobulle` (components/Infobulles.astro).

/** Géométrie des boîtes et des blocs, en unités du schéma (1 unité = 1 pixel au zoom 1). Polices à chasse fixe : largeurs calculables. */
export const GEOMETRIE = Object.freeze({
  entete: 26, // hauteur de l'en-tête d'une table (nom, nombre de lignes)
  ligne: 17, // hauteur d'une ligne de colonne
  basBoite: 6,
  carEntete: 8.2, // chasse d'un caractère de l'en-tête (13 px, chasse fixe, gras ; 0,63 em : un peu plus que les polices courantes)
  carNom: 7.3, // nom de colonne (11,5 px)
  carPetit: 6.1, // type, nombre de lignes, marques (9,5 px)
  xNom: 32, // début du nom de colonne (après la marque de clé primaire)
  droite: 44, // place à droite du type : « NN » et pastille de clé étrangère
  ecartType: 12,
  padX: 10,
  ecartCompte: 14,
  largeurMin: 150,
  largeurMax: 460,
  ecartX: 76, // entre deux colonnes de tables d'un bloc : la place des courbes
  ecartY: 22, // entre deux tables d'une même colonne
  marge: 26, // intérieur d'un bloc de section
  titre: 72, // bandeau du titre d'un bloc (titre de près, et titre de loin, plus grand)
  ecartBlocs: 110, // entre deux blocs
  boucle: 26, // écart d'une auto-référence au bord de sa table
});

/** Proportions visées (largeur / hauteur) d'un bloc de section, et de toute la carte. */
export const RAPPORT_SECTION = 1.5;
export const RAPPORT_GLOBAL = 1.7;

/** Bornes du zoom (k : pixels par unité du schéma). */
export const ZOOM_MIN = 0.03;
export const ZOOM_MAX = 2.5;
/** Zoom au-delà duquel une table centrée (recherche, clic sur une clé étrangère) se lit : colonnes et types. */
export const ZOOM_LISIBLE = 0.9;
/** Facteur des boutons et des touches « + » et « − ». */
export const PAS_DE_ZOOM = 1.25;
/**
 * Écart de zoom au-delà duquel l'épaisseur des traits (variable --k) est refaite PENDANT un geste ; sinon, à sa fin seulement. La refaire à chaque
 * image double le temps d'une image (mesuré dans Chromium : 17 → 37 ms en moyenne, 50 ms au p90) ; jamais, un grand zoom (recherche, « Tout voir »)
 * passe par des traits sept fois trop épais ou trop fins.
 */
export const ECART_DES_TRAITS = 2;

/** L'épaisseur des traits, posée pour le zoom `kTraits`, est-elle à refaire pendant le geste au zoom `k` ? */
export const traitsARefaire = (kTraits, k) => k / kTraits > ECART_DES_TRAITS || kTraits / k > ECART_DES_TRAITS;

/**
 * Niveaux de détail, du plus loin au plus près (attribut data-detail de la carte, styles/debug/schema.css) : « loin » = boîtes, noms en grand, liens
 * allégés (sans flèche) ; « moyen » = en-têtes et noms des colonnes, marques de clé ; « pres » = tout, types et « non nul » compris.
 * Le passage de « loin » à « moyen » attend que les en-têtes (13 px) et les noms des colonnes (11,5 px) se lisent à l'écran (LISIBLE_A_L_ECRAN) :
 * plus tôt, zoomer rendait la vue MOINS lisible (noms de loin remplacés par des textes de 5 px).
 */
export const NIVEAUX = Object.freeze([
  { cle: 'loin', jusqua: 0.7 },
  { cle: 'moyen', jusqua: 0.85 },
  { cle: 'pres', jusqua: Infinity },
]);

/** Taille à l'écran (px) en dessous de laquelle un texte ne se lit plus. */
export const LISIBLE_A_L_ECRAN = 8;
/** Tailles (px du schéma) des textes de la carte, celles de styles/debug/schema.css (test/debug-schema.test.mjs les compare). */
export const POLICES = Object.freeze({ entete: 13, colonne: 11.5, petit: 9.5, titreSection: 20, titreLoin: 50 });
/**
 * Taille à l'écran (px) visée pour le titre d'un bloc vu de loin : sa police est 1/k fois cette taille (bornée à TITRE_LOIN_MAX px du schéma, la place
 * au-dessus du bloc), jamais moins que POLICES.titreLoin (styles/debug/schema.css : `clamp(50px, calc(11px / var(--k)), 130px)`).
 */
export const TITRE_LOIN_ECRAN = 11;
export const TITRE_LOIN_MAX = 130;

/** Une page de lignes de la fenêtre « Contenu de <table> » (le service en accepte 500 au plus). */
export const PAGE_DE_LIGNES = 100;

/** Une table visée par au moins ce nombre de clés étrangères (`famille`, 155) : ses liens sont allégés (case « Liens vers … »). */
export const SEUIL_LIENS_COMMUNS = 60;

/** Nombre de teintes de bloc (styles/debug/schema.css : .schema-section--c0 à --c7). */
export const TEINTES = 8;

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Textes

const ENTITES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
/** Texte sûr dans du HTML ou du SVG, contenu ou valeur d'attribut entre guillemets. */
export const echapper = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ENTITES[c]);

const ESPACE_FINE = String.fromCharCode(0x202f);
/**
 * 12345 → « 12 345 » (espace fine insécable, comme fr-FR, sans dépendre de la langue du navigateur). Seule la partie entière est groupée : les
 * décimales et l'exposant restent tels quels (0.4375 → « 0.4375 », 1234.5678 → « 1 234.5678 », 1.5e-7 → « 1.5e-7 ») ; la valeur n'est jamais
 * arrondie (fenêtre « Contenu de <table> » : celle de la base).
 */
export function nombre(n) {
  const texte = String(n);
  const m = /^([-+]?)(\d+)(.*)$/s.exec(texte);
  return m ? `${m[1]}${m[2].replace(/\B(?=(\d{3})+(?!\d))/g, ESPACE_FINE)}${m[3]}` : texte;
}
const pluriel = (n, mot) => `${nombre(n)} ${mot}${n > 1 ? 's' : ''}`;

/** « 1 ligne », « 0 ligne », « 1 234 lignes ». */
export const libelleDesLignes = (n) => pluriel(n, 'ligne');

/** Minuscules sans accents (recherche). */
export const normaliser = (t) => String(t ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();

/** Le résumé du cadre (son <summary>) : nombre de tables, de vues et de clés étrangères. */
export function resumeDuSchema(structure) {
  const tables = structure.tables.filter((t) => t.genre !== 'vue');
  const vues = structure.tables.length - tables.length;
  const cles = tables.reduce((n, t) => n + t.cles_etrangeres.length, 0);
  return `${pluriel(tables.length, 'table')}, ${pluriel(vues, 'vue')}, ${pluriel(cles, 'clé étrangère').replace('clé étrangères', 'clés étrangères')}`;
}

/** Le nom du genre d'un objet, pour les lecteurs d'écran et les infobulles. */
const GENRES = { table: 'table', derivee: 'table dérivée', vue: 'vue' };

/** Étiquette d'une boîte (aria-label) : « table sort, 22 colonnes, 322 lignes ». */
export function etiquetteDeTable(table) {
  return `${GENRES[table.genre] ?? 'table'} ${table.nom}, ${pluriel(table.colonnes.length, 'colonne')}, ${libelleDesLignes(table.lignes)}`;
}

const sectionDe = (structure, numero) => structure.sections.find((s) => s.numero === numero);
const titreDeSection = (s) => (s ? `${s.numero}. ${s.titre}` : '');

/**
 * Infobulle de l'en-tête d'une table : son nom (l'en-tête peut le couper quand le nombre de lignes de la base vivante s'allonge), son genre, sa
 * section, sa description.
 */
export function infobulleDeTable(structure, table) {
  const genre = table.genre === 'table' ? '' : ` (${GENRES[table.genre]})`;
  return [`${table.nom}${genre}`, `Section ${titreDeSection(sectionDe(structure, table.section))}`, table.description].filter(Boolean).join('\n');
}

/**
 * Les clés étrangères qui contiennent une colonne (structure : `fks`, toutes ; une structure sans `fks` : sa seule `fk`), chacune
 * { table, colonne, colonnes, vers }.
 */
export function clesDeLaColonne(colonne) {
  if (Array.isArray(colonne.fks) && colonne.fks.length) return colonne.fks;
  return colonne.fk ? [{ table: colonne.fk.table, colonne: colonne.fk.colonne ?? null, colonnes: [colonne.nom], vers: [colonne.fk.colonne ?? null] }] : [];
}

/**
 * Une clé étrangère en une ligne : « → magie.id » (une colonne ; `depuis` : la colonne, quand elle doit être dite) ; « (race_id, colonne) →
 * race_don_tableau_colonne(race_id, rang) » (plusieurs colonnes) ; « (auto-référence) » quand la table se vise elle-même.
 */
export function libelleDeCle(cle, { depuis = null, table = null } = {}) {
  const visees = (cle.vers ?? []).map((v) => v ?? '?');
  const soi = table !== null && cle.table === table ? ' (auto-référence)' : '';
  if ((cle.colonnes ?? []).length > 1) return `(${cle.colonnes.join(', ')}) → ${cle.table}(${visees.join(', ')})${soi}`;
  return `${depuis ? `${depuis} ` : ''}→ ${cle.table}.${visees[0] ?? cle.colonne ?? '?'}${soi}`;
}

/**
 * Infobulle d'une ligne de colonne : nom, type, clé, non nul, défaut, chaque clé étrangère qui la contient (une ligne par clé, une clé à plusieurs
 * colonnes écrite en entier), description. `table` : le nom de sa table (une auto-référence le dit).
 */
export function infobulleDeColonne(colonne, table = null) {
  const traits = [colonne.type || 'sans type déclaré'];
  if (colonne.pk) traits.push(colonne.pk > 1 ? `clé primaire (${colonne.pk}e colonne)` : 'clé primaire');
  if (colonne.nonNul) traits.push('non nul');
  if (colonne.defaut !== null && colonne.defaut !== undefined) traits.push(`défaut ${colonne.defaut}`);
  const cles = clesDeLaColonne(colonne);
  const cibles = new Set(cles.map((c) => c.table));
  return [
    `${colonne.nom} : ${traits.join(', ')}`,
    ...cles.map((c) => libelleDeCle(c, { table })),
    cles.length ? `(clic sur la pastille : ${cibles.size > 1 ? 'choisir la table visée' : 'aller à la table visée'})` : '',
    colonne.description,
  ].filter(Boolean).join('\n');
}

/** Les tables que vise une colonne, sans doublon, dans l'ordre de ses clés. */
export const tablesVisees = (colonne) => [...new Set(clesDeLaColonne(colonne).map((c) => c.table))];

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Mise en page

/**
 * L'en-tête d'une boîte garde la place d'un nombre de lignes au moins aussi long que celui-ci : les nombres de la base vivante (GET <base>api/debug/
 * tables/) remplacent ceux du build sans que le nom de la table soit coupé (une table des fiches : « 0 ligne » au build, des milliers sur le site de dev).
 */
export const COMPTE_RESERVE = 99_999;

/** Largeur et hauteur de la boîte d'une table (polices à chasse fixe : GEOMETRIE). */
export function mesurerTable(table) {
  const G = GEOMETRIE;
  let nom = 0;
  let type = 0;
  for (const c of table.colonnes) {
    nom = Math.max(nom, c.nom.length);
    type = Math.max(type, (c.type || '').length);
  }
  const compte = libelleDesLignes(Math.max(table.lignes, COMPTE_RESERVE)).length;
  const entete = G.padX + table.nom.length * G.carEntete + G.ecartCompte + compte * G.carPetit + G.padX;
  const lignes = G.xNom + nom * G.carNom + G.ecartType + type * G.carPetit + G.droite;
  return {
    largeur: Math.ceil(Math.min(G.largeurMax, Math.max(G.largeurMin, entete, lignes))),
    hauteur: G.entete + table.colonnes.length * G.ligne + G.basBoite,
  };
}

/** Ordonnée (dans la boîte) du milieu de la ligne d'une colonne ; le milieu de l'en-tête pour une colonne inconnue. */
export function milieuDeLaColonne(table, colonne) {
  const i = colonne === null || colonne === undefined ? -1 : table.colonnes.findIndex((c) => c.nom === colonne);
  return i < 0 ? GEOMETRIE.entete / 2 : GEOMETRIE.entete + i * GEOMETRIE.ligne + GEOMETRIE.ligne / 2;
}

const moyenne = (valeurs) => valeurs.reduce((s, v) => s + v, 0) / valeurs.length;

/**
 * Un bloc : ses tables placées (coordonnées relatives à l'intérieur du bloc), sa taille. `tables` : dans l'ordre du schéma.
 * Couches : 0 = ne cite aucune table du bloc ; sinon 1 + la plus haute couche des tables qu'elle cite (cycles coupés, auto-références ignorées).
 */
function blocDeTables(tables, ordre) {
  const G = GEOMETRIE;
  const noms = new Set(tables.map((t) => t.nom));
  const cibles = new Map(tables.map((t) => [t.nom, [...new Set(t.cles_etrangeres.map((c) => c.table))].filter((n) => n !== t.nom && noms.has(n))]));
  const sources = new Map(tables.map((t) => [t.nom, []]));
  for (const [nom, liste] of cibles) for (const c of liste) sources.get(c).push(nom);

  const couche = new Map();
  const enCours = new Set();
  const profondeur = (nom) => {
    if (couche.has(nom)) return couche.get(nom);
    enCours.add(nom);
    let p = 0;
    for (const c of cibles.get(nom)) if (!enCours.has(c)) p = Math.max(p, profondeur(c) + 1);
    enCours.delete(nom);
    couche.set(nom, p);
    return p;
  };
  for (const t of tables) profondeur(t.nom);

  const couches = [];
  for (const t of tables) (couches[couche.get(t.nom)] ??= []).push(t.nom);
  const rang = new Map();
  const rangs = () => couches.forEach((c) => c.forEach((n, i) => rang.set(n, (i + 0.5) / c.length)));
  const trier = (c, voisins) => {
    const cle = new Map(c.map((n) => {
      const v = voisins(n);
      return [n, v.length ? moyenne(v.map((x) => rang.get(x))) : rang.get(n)];
    }));
    c.sort((a, b) => cle.get(a) - cle.get(b) || ordre.get(a) - ordre.get(b));
  };
  rangs();
  for (let passe = 0; passe < 4; passe++) {
    for (let L = 1; L < couches.length; L++) trier(couches[L], (n) => cibles.get(n).filter((c) => couche.get(c) < L));
    rangs();
    for (let L = couches.length - 2; L >= 0; L--) trier(couches[L], (n) => sources.get(n).filter((s) => couche.get(s) > L));
    rangs();
  }

  const taille = new Map(tables.map((t) => [t.nom, mesurerTable(t)]));
  const aire = tables.reduce((s, t) => s + (taille.get(t.nom).largeur + G.ecartX) * (taille.get(t.nom).hauteur + G.ecartY), 0);
  const plusHaute = Math.max(...tables.map((t) => taille.get(t.nom).hauteur));
  const hauteurMax = Math.max(plusHaute, Math.sqrt(aire / RAPPORT_SECTION));

  const places = [];
  let x = 0;
  let hauteur = 0;
  for (const c of couches) {
    // une couche : une ou plusieurs sous-colonnes, chacune de hauteurMax au plus
    let colonne = [];
    let h = 0;
    const poser = () => {
      if (!colonne.length) return;
      const largeur = Math.max(...colonne.map((n) => taille.get(n).largeur));
      let y = 0;
      for (const n of colonne) {
        places.push({ nom: n, x, y, ...taille.get(n) });
        y += taille.get(n).hauteur + G.ecartY;
      }
      hauteur = Math.max(hauteur, y - G.ecartY);
      x += largeur + G.ecartX;
      colonne = [];
      h = 0;
    };
    for (const n of c) {
      const ht = taille.get(n).hauteur;
      if (colonne.length && h + ht > hauteurMax) poser();
      colonne.push(n);
      h += ht + G.ecartY;
    }
    poser();
  }
  return { places, largeur: x - G.ecartX, hauteur };
}

/**
 * Pose des rectangles (dans l'ordre) par ligne d'horizon : chacun au plus haut possible, puis le plus à gauche, dans la largeur donnée (un rectangle
 * plus large qu'elle part à gauche). Rend [{ x, y }] dans l'ordre. Les rectangles reçus comprennent déjà leur écart (à droite et en bas).
 */
export function empiler(rectangles, largeurTotale) {
  let horizon = [{ x: 0, l: largeurTotale, y: 0 }];
  return rectangles.map(({ largeur, hauteur }) => {
    let meilleur = null;
    for (const depart of horizon) {
      const x = depart.x;
      if (x + largeur > largeurTotale && x > 0) continue;
      const y = Math.max(...horizon.filter((s) => s.x < x + largeur && s.x + s.l > x).map((s) => s.y));
      if (!meilleur || y < meilleur.y || (y === meilleur.y && x < meilleur.x)) meilleur = { x, y };
    }
    const { x, y } = meilleur;
    const fin = x + largeur;
    const suite = [];
    for (const s of horizon) {
      if (s.x + s.l <= x || s.x >= fin) { suite.push(s); continue; }
      if (s.x < x) suite.push({ x: s.x, l: x - s.x, y: s.y });
      if (s.x + s.l > fin) suite.push({ x: fin, l: s.x + s.l - fin, y: s.y });
    }
    suite.push({ x, l: largeur, y: y + hauteur });
    suite.sort((a, b) => a.x - b.x);
    // segments voisins à la même hauteur : fusionnés
    horizon = suite.reduce((acc, s) => {
      const p = acc.at(-1);
      if (p && p.y === s.y && p.x + p.l === s.x) p.l += s.l;
      else acc.push({ ...s });
      return acc;
    }, []);
    return { x, y };
  });
}

/** Le plus petit rectangle qui contient les rectangles donnés ({ x, y, largeur, hauteur }). */
export function englobant(rectangles) {
  if (!rectangles.length) return { x: 0, y: 0, largeur: 0, hauteur: 0 };
  const x = Math.min(...rectangles.map((r) => r.x));
  const y = Math.min(...rectangles.map((r) => r.y));
  return {
    x,
    y,
    largeur: Math.max(...rectangles.map((r) => r.x + r.largeur)) - x,
    hauteur: Math.max(...rectangles.map((r) => r.y + r.hauteur)) - y,
  };
}

/**
 * Le titre d'une section vu de loin : sans ce qui suit « : » ou « ( » (« 15. NOTES DE VERSION », « 3. MAGIES ET SORTS ») ; le titre entier est
 * dans son infobulle.
 */
export function titreCourt(titre) {
  const coupe = String(titre).search(/\s+(?::|\(|—)\s*/);
  return coupe > 0 ? String(titre).slice(0, coupe) : String(titre);
}

/**
 * La carte entière : { blocs, boites, liens, cadreTables, cadreTout }.
 *   blocs  : [{ cle, numero, titre, titreLoin, vues, teinte, x, y, largeur, hauteur }] (un par section qui a des tables, puis un par section qui a
 *            des vues) ;
 *   boites : [{ nom, genre, section, x, y, largeur, hauteur }] dans l'ordre du schéma (vues comprises) ;
 *   liens  : [{ id, de, vers, colonnes, visees, indice, colonne, visee, commun, soi, depart, arrivee, d }] : un par clé étrangère d'une table (les
 *            vues n'en ont pas) ; `colonne` et `visee` : la paire d'où part et où arrive le trait (indiceDuLien) ;
 *   cadreTables / cadreTout : le rectangle des blocs de tables, avec ou sans les vues (« Tout voir »).
 */
export function mettreEnPage(structure) {
  const G = GEOMETRIE;
  const ordre = new Map(structure.tables.map((t, i) => [t.nom, i]));
  const parNom = new Map(structure.tables.map((t) => [t.nom, t]));
  const prepares = [];
  for (const vues of [false, true]) {
    structure.sections.forEach((s, rangSection) => {
      const tables = structure.tables.filter((t) => t.section === s.numero && (t.genre === 'vue') === vues);
      if (!tables.length) return;
      const contenu = blocDeTables(tables, ordre);
      prepares.push({
        cle: `${vues ? 'vues' : 'tables'}-${s.numero}`,
        numero: s.numero,
        titre: vues ? `${s.numero}. ${s.titre} — vues` : `${s.numero}. ${s.titre}`,
        titreLoin: `${s.numero}. ${titreCourt(s.titre)}${vues ? ' — vues' : ''}`,
        vues,
        teinte: rangSection % TEINTES,
        contenu,
        largeur: Math.max(contenu.largeur + 2 * G.marge, 260),
        hauteur: G.titre + contenu.hauteur + 2 * G.marge,
      });
    });
  }
  const avecEcart = (b) => ({ largeur: b.largeur + G.ecartBlocs, hauteur: b.hauteur + G.ecartBlocs });
  const aire = prepares.filter((b) => !b.vues).reduce((s, b) => s + avecEcart(b).largeur * avecEcart(b).hauteur, 0);
  const largeurTotale = Math.max(...prepares.map((b) => avecEcart(b).largeur), Math.sqrt(aire * RAPPORT_GLOBAL));
  const positions = empiler(prepares.map(avecEcart), largeurTotale);

  const blocs = [];
  const boites = [];
  prepares.forEach((b, i) => {
    const { x, y } = positions[i];
    blocs.push({ cle: b.cle, numero: b.numero, titre: b.titre, titreLoin: b.titreLoin, vues: b.vues, teinte: b.teinte, x, y, largeur: b.largeur, hauteur: b.hauteur });
    for (const p of b.contenu.places) {
      const t = parNom.get(p.nom);
      boites.push({ nom: p.nom, genre: t.genre, section: t.section, x: x + G.marge + p.x, y: y + G.titre + G.marge + p.y, largeur: p.largeur, hauteur: p.hauteur });
    }
  });
  boites.sort((a, b) => ordre.get(a.nom) - ordre.get(b.nom));
  const boiteDe = new Map(boites.map((b) => [b.nom, b]));

  const communes = new Set(tablesCommunes(structure).map((c) => c.nom));
  const liens = [];
  for (const t of structure.tables) {
    if (t.genre === 'vue') continue;
    t.cles_etrangeres.forEach((c, i) => {
      const cible = parNom.get(c.table);
      if (!cible) return; // une clé vers une table absente du schéma (impossible avec PRAGMA foreign_keys) : pas de lien
      const indice = indiceDuLien(t, c);
      const lien = {
        id: `${t.nom}#${i}`,
        de: t.nom,
        vers: c.table,
        colonnes: c.colonnes,
        visees: c.vers,
        indice,
        colonne: c.colonnes[indice],
        visee: c.vers?.[indice] ?? null,
        commun: communes.has(c.table),
        soi: c.table === t.nom,
      };
      liens.push({ ...lien, ...geometrieDuLien(lien, t, boiteDe.get(t.nom), cible, boiteDe.get(c.table)) });
    });
  }
  const blocsTables = blocs.filter((b) => !b.vues);
  return { blocs, boites, liens, cadreTables: englobant(blocsTables), cadreTout: englobant(blocs) };
}

/**
 * La paire (colonnes[i], vers[i]) qui distingue une clé étrangère, d'où part et où arrive son lien : une colonne seule, 0 ; une auto-référence, la
 * première colonne qui ne se vise pas elle-même (note_cellule : repond_a → rang) ; sinon la première colonne qui n'est dans aucune autre clé de la
 * table (race_don_tableau_cellule : ligne, puis colonne ; capacite : specialite_id) ; à défaut, la première.
 */
export function indiceDuLien(table, cle) {
  const n = cle.colonnes.length;
  if (n <= 1) return 0;
  if (cle.table === table.nom) {
    const i = cle.colonnes.findIndex((c, j) => c !== cle.vers?.[j]);
    if (i >= 0) return i;
  }
  const autres = new Set(table.cles_etrangeres.filter((k) => k !== cle).flatMap((k) => k.colonnes));
  const i = cle.colonnes.findIndex((c) => !autres.has(c));
  return i >= 0 ? i : 0;
}

/**
 * Géométrie d'un lien : départ au bord de la table source, à la ligne de sa colonne (`lien.indice` : indiceDuLien, 0 sinon) ; arrivée au bord de la
 * table visée, à la ligne de la colonne visée au même rang ; courbe de Bézier horizontale aux deux bouts (la flèche entre dans la table visée). Côtés :
 * la table visée à droite, à gauche, ou au-dessus / au-dessous (les deux bords droits, courbe en « C ») ; auto-référence : une boucle à droite.
 */
export function geometrieDuLien(lien, source, boiteSource, cible, boiteCible) {
  const G = GEOMETRIE;
  const i = lien.indice ?? 0;
  const ys = boiteSource.y + milieuDeLaColonne(source, lien.colonnes[i]);
  const yc = boiteCible.y + milieuDeLaColonne(cible, lien.visees?.[i]);
  const r = (n) => Math.round(n * 10) / 10;
  const courbe = (x1, y1, c1, c2, x2, y2) => `M${r(x1)} ${r(y1)}C${r(c1)} ${r(y1)} ${r(c2)} ${r(y2)} ${r(x2)} ${r(y2)}`;
  const droiteS = boiteSource.x + boiteSource.largeur;
  const droiteC = boiteCible.x + boiteCible.largeur;
  if (lien.soi || boiteSource === boiteCible) {
    const ecart = G.boucle + Math.abs(yc - ys) * 0.12;
    return { cote: 'boucle', depart: { x: droiteS, y: ys }, arrivee: { x: droiteS, y: yc }, d: courbe(droiteS, ys, droiteS + ecart, droiteS + ecart, droiteS, yc) };
  }
  if (boiteCible.x >= droiteS) {
    const dx = Math.max(30, (boiteCible.x - droiteS) / 2);
    return { cote: 'droite', depart: { x: droiteS, y: ys }, arrivee: { x: boiteCible.x, y: yc }, d: courbe(droiteS, ys, droiteS + dx, boiteCible.x - dx, boiteCible.x, yc) };
  }
  if (droiteC <= boiteSource.x) {
    const dx = Math.max(30, (boiteSource.x - droiteC) / 2);
    return { cote: 'gauche', depart: { x: boiteSource.x, y: ys }, arrivee: { x: droiteC, y: yc }, d: courbe(boiteSource.x, ys, boiteSource.x - dx, droiteC + dx, droiteC, yc) };
  }
  // l'une au-dessus de l'autre : de bord droit à bord droit, la courbe passe à droite des deux
  const ecart = Math.max(droiteS, droiteC) + 34 + Math.min(120, Math.abs(yc - ys) * 0.08);
  return { cote: 'dessus', depart: { x: droiteS, y: ys }, arrivee: { x: droiteC, y: yc }, d: courbe(droiteS, ys, ecart, ecart, droiteC, yc) };
}

/**
 * Les tables visées par au moins SEUIL_LIENS_COMMUNS clés étrangères (`famille`) : [{ nom, liens }] dans l'ordre du schéma. Leurs liens sont allégés et
 * une case les masque (ils traversent toute la carte).
 */
export function tablesCommunes(structure) {
  const visees = new Map();
  for (const t of structure.tables) for (const c of t.cles_etrangeres) visees.set(c.table, (visees.get(c.table) ?? 0) + 1);
  return structure.tables.filter((t) => (visees.get(t.nom) ?? 0) >= SEUIL_LIENS_COMMUNS).map((t) => ({ nom: t.nom, liens: visees.get(t.nom) }));
}

/** Deux rectangles se recouvrent-ils (bords communs permis) ? */
export const recouvrent = (a, b) => a.x < b.x + b.largeur && b.x < a.x + a.largeur && a.y < b.y + b.hauteur && b.y < a.y + a.hauteur;

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Caméra : écran = schéma × k + (x, y)

/** Le niveau de détail d'un zoom (NIVEAUX). */
export function niveauDeDetail(k) {
  return NIVEAUX.find((n) => k < n.jusqua).cle;
}

export const bornerZoom = (k) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, k));

/** Point de l'écran (pixels, relatifs au cadre) → point du schéma. */
export const ecranVersSchema = (vue, p) => ({ x: (p.x - vue.x) / vue.k, y: (p.y - vue.y) / vue.k });
/** Point du schéma → point de l'écran. */
export const schemaVersEcran = (vue, p) => ({ x: p.x * vue.k + vue.x, y: p.y * vue.k + vue.y });

/** Zoom d'un facteur autour d'un point de l'écran (le point du schéma sous lui ne bouge pas), dans les bornes. */
export function zoomAutour(vue, facteur, point) {
  const k = bornerZoom(vue.k * facteur);
  const s = ecranVersSchema(vue, point);
  return { k, x: point.x - s.x * k, y: point.y - s.y * k };
}

/** Déplacement de la vue de (dx, dy) pixels. */
export const deplacer = (vue, dx, dy) => ({ k: vue.k, x: vue.x + dx, y: vue.y + dy });

/** La vue qui montre tout un rectangle du schéma au centre d'un cadre de largeur × hauteur pixels, avec une marge (pixels). */
export function cadrer(rect, largeur, hauteur, marge = 16) {
  const k = bornerZoom(Math.min((largeur - 2 * marge) / Math.max(rect.largeur, 1), (hauteur - 2 * marge) / Math.max(rect.hauteur, 1)));
  return {
    k,
    x: largeur / 2 - (rect.x + rect.largeur / 2) * k,
    y: hauteur / 2 - (rect.y + rect.hauteur / 2) * k,
  };
}

/**
 * La vue centrée sur un rectangle (une table) : ZOOM_LISIBLE (ou le zoom courant s'il est plus fort), moins si c'est la seule façon de la montrer en
 * entier, mais jamais sous le niveau « moyen » (NIVEAUX : ses colonnes se lisent) ; une table plus haute que le cadre à ce zoom : son haut en haut du
 * cadre.
 */
export function centrerSur(rect, vue, largeur, hauteur, marge = 16) {
  const tient = Math.min((largeur - 2 * marge) / Math.max(rect.largeur, 1), (hauteur - 2 * marge) / Math.max(rect.hauteur, 1));
  const k = bornerZoom(Math.max(vue.k, NIVEAUX[0].jusqua, Math.min(ZOOM_LISIBLE, tient)));
  const x = largeur / 2 - (rect.x + rect.largeur / 2) * k;
  const y = rect.hauteur * k > hauteur - 2 * marge ? marge - rect.y * k : hauteur / 2 - (rect.y + rect.hauteur / 2) * k;
  return { k, x, y };
}

/** La vue déplacée au plus court pour que le rectangle soit dans le cadre (rien ne bouge s'il y est déjà ; zoom inchangé). */
export function montrer(rect, vue, largeur, hauteur, marge = 24) {
  const a = schemaVersEcran(vue, { x: rect.x, y: rect.y });
  const l = rect.largeur * vue.k;
  const h = rect.hauteur * vue.k;
  const decale = (debut, taille, place) => {
    if (taille > place - 2 * marge || debut < marge) return marge - debut;
    if (debut + taille > place - marge) return place - marge - (debut + taille);
    return 0;
  };
  return deplacer(vue, decale(a.x, l, largeur), decale(a.y, h, hauteur));
}

/**
 * Vue intermédiaire d'une animation (t de 0 à 1) : le zoom suit une échelle logarithmique, le point du schéma au centre du cadre va en ligne droite
 * (pas de détour quand le zoom change beaucoup).
 */
export function interpoler(a, b, t, largeur, hauteur) {
  const milieu = { x: largeur / 2, y: hauteur / 2 };
  const ca = ecranVersSchema(a, milieu);
  const cb = ecranVersSchema(b, milieu);
  const k = Math.exp(Math.log(a.k) + (Math.log(b.k) - Math.log(a.k)) * t);
  const c = { x: ca.x + (cb.x - ca.x) * t, y: ca.y + (cb.y - ca.y) * t };
  return { k, x: milieu.x - c.x * k, y: milieu.y - c.y * k };
}

/** Le rectangle du schéma visible dans un cadre de largeur × hauteur pixels. */
export function partieVisible(vue, largeur, hauteur) {
  const a = ecranVersSchema(vue, { x: 0, y: 0 });
  return { x: a.x, y: a.y, largeur: largeur / vue.k, hauteur: hauteur / vue.k };
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Navigation et recherche

const DIRECTIONS = {
  ArrowRight: [1, 0],
  ArrowLeft: [-1, 0],
  ArrowDown: [0, 1],
  ArrowUp: [0, -1],
};

/**
 * La table voisine dans une direction (touche fléchée), d'abord parmi les boîtes dont le centre est DANS LE CÔNE de la direction (écart de côté au
 * plus égal à l'avancée : Flèche droite va à droite, jamais surtout vers le bas) ; à défaut, parmi celles qui sont devant et dont la boîte chevauche
 * celle de départ sur l'autre axe (une table voisine très haute ou très large) ; sinon aucune (on reste sur place). Dans chaque groupe : la plus
 * proche, l'écart de côté comptant triple. `boites` : celles qu'on peut atteindre (vues masquées exclues). null s'il n'y en a pas.
 */
export function tableVoisine(boites, nom, touche) {
  const sens = DIRECTIONS[touche];
  const depart = boites.find((b) => b.nom === nom);
  if (!sens || !depart) return null;
  const centre = (b) => ({ x: b.x + b.largeur / 2, y: b.y + b.hauteur / 2 });
  const c0 = centre(depart);
  const horizontal = sens[0] !== 0;
  const chevauche = (b) => (horizontal
    ? b.y < depart.y + depart.hauteur && depart.y < b.y + b.hauteur
    : b.x < depart.x + depart.largeur && depart.x < b.x + b.largeur);
  let dansLeCone = null;
  let enFace = null;
  for (const b of boites) {
    if (b.nom === nom) continue;
    const c = centre(b);
    const avant = (c.x - c0.x) * sens[0] + (c.y - c0.y) * sens[1];
    if (avant <= 1) continue;
    const cote = Math.abs((c.x - c0.x) * sens[1] + (c.y - c0.y) * sens[0]);
    const score = avant + 3 * cote;
    if (cote <= avant) {
      if (!dansLeCone || score < dansLeCone.score) dansLeCone = { nom: b.nom, score };
    } else if (chevauche(b) && (!enFace || score < enFace.score)) enFace = { nom: b.nom, score };
  }
  return (dansLeCone ?? enFace)?.nom ?? null;
}

/**
 * La table que désigne un texte cherché : nom exact, puis nom qui commence par le texte, puis qui le contient, puis qui contient chacun de ses mots
 * (sans accents ni majuscules ; « _ » et espace équivalents) ; à égalité, le nom le plus court puis l'ordre donné. null si rien ne correspond.
 */
export function chercherTable(noms, texte) {
  const q = normaliser(texte).replace(/\s+/g, ' ');
  if (!q) return null;
  const qSouligne = q.replace(/ /g, '_');
  const mots = q.split(/[ _]+/).filter(Boolean);
  let meilleur = null;
  noms.forEach((nom, i) => {
    const n = normaliser(nom);
    let rang = null;
    if (n === qSouligne) rang = 0;
    else if (n.startsWith(qSouligne)) rang = 1;
    else if (n.includes(qSouligne)) rang = 2;
    else if (mots.every((m) => n.includes(m))) rang = 3;
    if (rang === null) return;
    const cle = [rang, n.length, i];
    if (!meilleur || comparer(cle, meilleur.cle) < 0) meilleur = { nom, cle };
  });
  return meilleur?.nom ?? null;
}
const comparer = (a, b) => {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return 0;
};

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Rendu (une fois, dans [data-schema-monde] ; le zoom ne change que la transformation CSS de ce conteneur)
//
// Boîtes et titres en HTML, liens en SVG, tous en position absolue dans un même conteneur (1 px = 1 unité du schéma) : le zoom est une transformation
// CSS de ce conteneur. Pourquoi pas tout en SVG : un <text> SVG est remis en page par le navigateur à CHAQUE changement d'échelle (taille de police à
// l'écran recalculée pour chaque texte), soit 60 à 200 ms par image mesurées sur ce schéma (~10 000 textes) ; un texte HTML sous une transformation ne
// l'est jamais (16,7 ms par image : une image par trame, au zoom comme au déplacement). Les traits (liens, cadres) gardent leur épaisseur à l'écran par
// la variable --k (le zoom), posée à la fin d'un geste et, pendant un grand zoom, par paliers (ECART_DES_TRAITS ; styles/debug/schema.css).

/** Le nom d'une table en une ou deux lignes (coupé au « _ » le plus proche du milieu), pour le titre de loin. */
export function lignesDuNom(nom) {
  if (nom.length <= 14) return [nom];
  let coupe = -1;
  for (let i = 1; i < nom.length - 1; i++) if (nom[i] === '_' && (coupe < 0 || Math.abs(i - nom.length / 2) < Math.abs(coupe - nom.length / 2))) coupe = i;
  return coupe < 0 ? [nom] : [nom.slice(0, coupe + 1), nom.slice(coupe + 1)];
}

/** Tailles du nom d'une table vu de loin (peu de tailles différentes : moins de polices à préparer pour le navigateur). */
export const TAILLES_DE_LOIN = Object.freeze([14, 18, 24, 32, 40]);

/** Taille (px du schéma) du nom d'une table vu de loin : la plus grande de TAILLES_DE_LOIN qui tient dans la boîte (la plus petite sinon). */
export function tailleDuNomDeLoin(nom, largeur, hauteur) {
  const lignes = lignesDuNom(nom);
  const plusLongue = Math.max(...lignes.map((l) => l.length));
  const tient = Math.min((largeur - 16) / (plusLongue * 0.64), (hauteur - 10) / (lignes.length * 1.25));
  return [...TAILLES_DE_LOIN].reverse().find((t) => t <= tient) ?? TAILLES_DE_LOIN[0];
}

const px = (v) => `${Math.round(v * 10) / 10}px`;
const position = (r) => `left:${px(r.x)};top:${px(r.y)};width:${px(r.largeur)};height:${px(r.hauteur)}`;

function htmlDeBloc(b) {
  const classes = `schema-section schema-section--c${b.teinte}${b.vues ? ' schema-section--vues' : ''}`;
  const loin = b.titreLoin ?? b.titre;
  // de loin, le titre court en grand (sa police suit 1/k : styles/debug/schema.css) et le titre entier en infobulle
  return `<div class="${classes}" data-section="${echapper(b.cle)}" style="${position(b)}">`
    + `<span class="schema-section__titre" data-infobulle="${echapper(b.titre)}">${echapper(b.titre)}</span>`
    + `<span class="schema-section__titre-loin" aria-hidden="true" data-infobulle="${echapper(b.titre)}">${echapper(loin)}</span>`
    + '</div>';
}

/**
 * Une ligne de colonne. Une colonne clé étrangère porte data-vers (les tables visées, séparées par une espace) et une pastille : un clic sur la
 * pastille suit la clé (scripts/debug-schema.mjs ; plusieurs tables visées : la liste des clés), un double clic ailleurs ouvre le contenu.
 */
function htmlDeColonne(c, table) {
  const cibles = tablesVisees(c);
  const classes = `schema-col${c.pk ? ' schema-col--pk' : ''}${cibles.length ? ' schema-col--fk' : ''}`;
  const vers = cibles.length ? ` data-vers="${echapper(cibles.join(' '))}"` : '';
  return `<div class="${classes}" data-colonne="${echapper(c.nom)}"${vers} data-infobulle="${echapper(infobulleDeColonne(c, table))}">`
    + (c.pk ? '<span class="schema-col__pk">PK</span>' : '')
    + `<span class="schema-col__nom">${echapper(c.nom)}</span>`
    + `<span class="schema-col__type">${echapper(c.type || '—')}</span>`
    + (c.nonNul ? '<span class="schema-col__nn">NN</span>' : '')
    + (cibles.length ? '<span class="schema-col__fk" aria-hidden="true"></span>' : '')
    + '</div>';
}

function htmlDeTable(structure, table, boite) {
  const taille = tailleDuNomDeLoin(table.nom, boite.largeur, boite.hauteur);
  return `<div class="schema-table schema-table--${table.genre}" data-table="${echapper(table.nom)}" style="${position(boite)}" tabindex="-1" role="button"`
    + ` aria-haspopup="dialog" aria-label="${echapper(etiquetteDeTable(table))}">`
    + `<div class="schema-table__entete" data-infobulle="${echapper(infobulleDeTable(structure, table))}">`
    + `<span class="schema-table__nom">${echapper(table.nom)}</span><span class="schema-table__compte">${echapper(libelleDesLignes(table.lignes))}</span></div>`
    + `<div class="schema-table__colonnes">${table.colonnes.map((c) => htmlDeColonne(c, table.nom)).join('')}</div>`
    + `<span class="schema-table__nom-loin" style="font-size:${taille}px" aria-hidden="true">${lignesDuNom(table.nom).map(echapper).join('<br>')}</span>`
    + '</div>';
}

/** Le SVG des liens : flèches (deux marqueurs : normal, éclairé), un chemin par clé étrangère (data-lien, data-de, data-vers). */
export function svgDesLiens(plan) {
  const { largeur, hauteur } = plan.cadreTout;
  const fleche = (id, classe, taille) => `<marker id="${id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="${taille}" markerHeight="${taille}" markerUnits="strokeWidth" orient="auto">`
    + `<path class="${classe}" d="M0 0L10 5L0 10z"/></marker>`;
  const liens = plan.liens.map((l) => {
    const cls = `schema-lien${l.commun ? ' schema-lien--commun' : ''}${l.soi ? ' schema-lien--soi' : ''}`;
    return `<path class="${cls}" d="${l.d}" data-lien="${echapper(l.id)}" data-de="${echapper(l.de)}" data-vers="${echapper(l.vers)}"/>`;
  }).join('');
  return `<svg class="schema-liens" data-schema-liens="" xmlns="http://www.w3.org/2000/svg" width="${largeur}" height="${hauteur}" viewBox="0 0 ${largeur} ${hauteur}" aria-hidden="true" focusable="false">`
    + `<defs>${fleche('schema-fleche', 'schema-fleche', 7)}${fleche('schema-fleche-forte', 'schema-fleche schema-fleche--forte', 5)}</defs>${liens}</svg>`;
}

/**
 * Le contenu de [data-schema-monde] : les blocs des sections (fonds et titres), le SVG des liens (sous les boîtes), puis les boîtes (HTML).
 * Chaque boîte porte data-table, son étiquette (aria-label) et son genre ; chaque ligne data-colonne (et data-vers pour une clé étrangère).
 */
export function htmlDuSchema(structure, plan) {
  const parNom = new Map(structure.tables.map((t) => [t.nom, t]));
  return `<div class="schema-blocs">${plan.blocs.map(htmlDeBloc).join('')}</div>${svgDesLiens(plan)}`
    + `<div class="schema-boites">${plan.boites.map((b) => htmlDeTable(structure, parNom.get(b.nom), b)).join('')}</div>`;
}

/**
 * Les clés étrangères d'une table qu'on peut suivre (liste ouverte par « L » au clavier, ou par la pastille d'une colonne qui vise plusieurs tables) :
 * [{ cle (rang dans cles_etrangeres), table, libelle }], dans l'ordre du schéma ; `colonne` : seulement les clés qui la contiennent.
 */
export function clesASuivre(table, colonne = null) {
  return table.cles_etrangeres
    .map((c, i) => ({ cle: i, table: c.table, colonnes: c.colonnes, libelle: libelleDeCle(c, { depuis: c.colonnes[0], table: table.nom }) }))
    .filter((c) => colonne === null || c.colonnes.includes(colonne))
    .map(({ cle, table: t, libelle }) => ({ cle, table: t, libelle }));
}

/** Les entrées de la liste des clés (role="menu" de components/debug/SchemaDeLaBase.astro) : un bouton par clé, la table visée en data-cle-vers. */
export function htmlDesCles(cles) {
  return cles.map((c) => `<li role="none"><button type="button" role="menuitem" tabindex="-1" class="schema-cles__cle" data-cle-vers="${echapper(c.table)}">`
    + `${echapper(c.libelle)}</button></li>`).join('');
}

/**
 * Que fait un cran de molette sur la carte ? 'zoom' (la carte le prend : preventDefault) ou 'page' (la page défile, la carte n'y touche pas).
 *   - Ctrl (ou ⌘) + molette, et le pincement d'un pavé tactile (que les navigateurs envoient avec ctrlKey) : toujours le zoom (sinon le navigateur
 *     zoomerait la page) ;
 *   - sinon, seulement une carte « activée » (un clic ou le focus dedans, ou le plein cadre) : de passage, la molette fait défiler la page ;
 *   - et jamais quand le zoom est déjà à sa borne dans le sens demandé (le cran ne changerait rien : la page défile).
 */
export function actionDeLaMolette({ ctrl = false, activee = false, k, deltaY }) {
  if (ctrl) return 'zoom';
  if (!activee || !deltaY) return 'page';
  if (deltaY > 0 && k <= ZOOM_MIN * (1 + 1e-9)) return 'page';
  if (deltaY < 0 && k >= ZOOM_MAX * (1 - 1e-9)) return 'page';
  return 'zoom';
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Fenêtre « Contenu de <table> » : GET <base>api/debug/tables/<nom>/?limite=&decalage=&tri=&ordre= (serveur/debug-tables.mjs)

/**
 * Les nombres de lignes de la base vivante (GET <base>api/debug/tables/ : { tables: [{ nom, genre, lignes }] }) qui changent ceux du build : [{ nom,
 * lignes }] pour les tables du schéma seulement (une table inconnue du build, ou une valeur qui n'est pas un entier, est ignorée).
 */
export function comptesVivants(structure, reponse) {
  if (!Array.isArray(reponse?.tables)) return [];
  const connues = new Map(structure.tables.map((t) => [t.nom, t]));
  return reponse.tables
    .filter((t) => connues.has(t?.nom) && Number.isInteger(t.lignes) && t.lignes >= 0 && t.lignes !== connues.get(t.nom).lignes)
    .map((t) => ({ nom: t.nom, lignes: t.lignes }));
}

/** L'adresse d'une page de lignes. `api` : la racine de l'API du site (« /api/ », ou sous un sous-chemin). */
export function adresseDuContenu(api, nom, { limite = PAGE_DE_LIGNES, decalage = 0, tri = null, ordre = 'asc' } = {}) {
  const p = new URLSearchParams({ limite: String(limite), decalage: String(decalage) });
  if (tri) {
    p.set('tri', tri);
    p.set('ordre', ordre === 'desc' ? 'desc' : 'asc');
  }
  return `${api}debug/tables/${encodeURIComponent(nom)}/?${p}`;
}

/** Le tri suivant après un clic sur l'en-tête d'une colonne : une autre colonne → croissant ; la même → l'autre sens. */
export function triSuivant(etat, colonne) {
  return etat.tri === colonne ? { tri: colonne, ordre: etat.ordre === 'asc' ? 'desc' : 'asc' } : { tri: colonne, ordre: 'asc' };
}

/** Les en-têtes du tableau (une ligne <tr>) : nom et type de chaque colonne, bouton de tri, aria-sort de la colonne triée. */
export function htmlDesEntetes(colonnes, { tri = null, ordre = 'asc' } = {}) {
  return `<tr>${colonnes.map((c) => {
    const trie = tri === c.nom ? (ordre === 'desc' ? 'descending' : 'ascending') : 'none';
    const fleche = trie === 'ascending' ? ' ▲' : trie === 'descending' ? ' ▼' : '';
    return `<th scope="col" aria-sort="${trie}"><button type="button" class="schema-tri" data-tri-colonne="${echapper(c.nom)}">`
      + `<span class="schema-tri__nom">${c.pk ? '<span class="schema-tri__pk">PK</span> ' : ''}${echapper(c.nom)}</span>`
      + `<span class="schema-tri__type">${echapper(c.type || '—')}${fleche}</span></button></th>`;
  }).join('')}</tr>`;
}

/**
 * Une valeur telle que le service la rend, en HTML : NULL visible, nombre à droite, image et BLOB résumés (jamais l'image entière), texte coupé par
 * le service (« … (N caractères) ») tel quel, objet inattendu en JSON. → { classe, html }
 */
export function valeurEnHtml(v) {
  if (v === null || v === undefined) return { classe: 'schema-v--nul', html: 'NULL' };
  if (typeof v === 'number') return { classe: 'schema-v--nombre', html: echapper(nombre(v)) };
  if (typeof v === 'object' && v.image === true) {
    const empreinte = v.empreinte ? `, ${String(v.empreinte).slice(0, 12)}` : '';
    return { classe: 'schema-v--resume', html: echapper(`${v.type || 'image'} (${nombre(v.octets ?? 0)} octets${empreinte})`) };
  }
  if (typeof v === 'object' && typeof v.octets === 'number' && Object.keys(v).length === 1) {
    return { classe: 'schema-v--resume', html: echapper(`BLOB (${nombre(v.octets)} octets)`) };
  }
  if (typeof v === 'object') return { classe: 'schema-v--resume', html: echapper(JSON.stringify(v)) };
  const texte = String(v);
  const coupe = / … \((\d+) caractères\)$/.exec(texte);
  if (coupe) {
    return { classe: 'schema-v--texte', html: `${echapper(texte.slice(0, coupe.index))}<span class="schema-v__suite"> … (${nombre(Number(coupe[1]))} caractères)</span>` };
  }
  return { classe: texte === '' ? 'schema-v--vide' : 'schema-v--texte', html: texte === '' ? '<span class="schema-v__suite">(texte vide)</span>' : echapper(texte) };
}

/** Des lignes du tableau (<tr>…</tr>), dans l'ordre des colonnes reçues. Une cellule se déplie d'un clic (texte long). */
export function htmlDesLignes(colonnes, lignes) {
  return lignes.map((l) => `<tr>${colonnes.map((c) => {
    const { classe, html } = valeurEnHtml(l[c.nom]);
    return `<td class="${classe}"><div class="schema-cellule">${html}</div></td>`;
  }).join('')}</tr>`).join('');
}

/** « 100 lignes affichées sur 1 234 », « 3 lignes », « Aucune ligne ». */
export function resumeDuContenu(affichees, total) {
  if (!total) return 'Aucune ligne.';
  if (affichees >= total) return `${libelleDesLignes(total)}.`;
  return `${nombre(affichees)} ${affichees > 1 ? 'lignes affichées' : 'ligne affichée'} sur ${nombre(total)}.`;
}

/**
 * Le message d'une réponse en échec (statut 0 : le service n'a pas répondu ; 502 à 504 sans message du service : un relais sans service derrière) ;
 * celui du service s'il en donne un (503 du service : sa base n'est pas encore prête).
 */
export function messageDErreur(statut, corps = null) {
  const message = corps && typeof corps.erreur === 'string' && corps.erreur.trim() ? corps.erreur.trim() : null;
  if (statut === 503 && message) return `Le service est indisponible pour le moment (503) : ${message}`;
  if (!statut || statut === 502 || statut === 503 || statut === 504) {
    return `Le service ne répond pas${statut ? ` (${statut})` : ''} : le contenu des tables vient du service du site de dev (npm run serveur, transmis par npm run dev).`;
  }
  if (statut === 403) return `Le service refuse (403) : ${message ?? 'le contenu des tables ne se lit que sur le site de dev.'}`;
  if (statut === 404) return `Table introuvable dans la base vivante du service (404)${message ? ` : ${message}` : '.'}`;
  return `Le service a répondu ${statut}${message ? ` : ${message}` : '.'}`;
}
