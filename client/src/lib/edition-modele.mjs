// Modèle de l'édition depuis le site de dev (demande du propriétaire ; client/serveur/edition.mjs, docs/serveur.md, « Édition ») : quelles colonnes de
// quelles tables une page peut modifier, avec leur type de champ, et comment une page désigne un champ (attribut `data-ed`). Le service n'accepte
// que ces colonnes ; tout ce qui en dépend dans la base (colonnes typées, tables de détail, page du wiki) est recalculé par le service, jamais saisi.
// Fonctions et constantes pures, sans dépendance : partagées par le service, les gabarits Astro et le script des pages (src/scripts/edition.mjs).

/**
 * Types de champ :
 *   ligne    texte sur une ligne (retours à la ligne remplacés par une espace) ;
 *   texte    texte long : paragraphes séparés par une ligne vide, puces « - », retours à la ligne gardés (lib/sort-format.mjs#blocsDeTexte) ;
 *   markdown corps Markdown d'une page (guide) ;
 *   entier   nombre entier (signe permis) ;
 *   choix    une valeur d'une liste (`choix` : [{ valeur, libelle }]).
 * Options : `requis` (vide refusé), `vide` (valeur enregistrée pour un champ vidé quand la colonne n'accepte pas NULL : '' ou 'Rien'),
 * `min` / `max` (entier).
 */
export const TABLES = {
  metier: {
    libelle: 'Métier',
    colonnes: {
      nom: { type: 'ligne', libelle: 'Nom', requis: true },
      description: { type: 'texte', libelle: 'Description', vide: '' },
      bonus_brut: { type: 'ligne', libelle: 'Bonus', vide: '' },
      artisanat_brut: { type: 'ligne', libelle: 'Artisanat', vide: 'Rien' },
      equipement_brut: { type: 'ligne', libelle: 'Équipement supplémentaire', vide: 'Rien' },
      avantage_brut: { type: 'texte', libelle: 'Avantage possible' },
      remarque: { type: 'texte', libelle: 'Remarque' },
    },
  },
};

/**
 * Entités qu'une page peut créer ou supprimer, avec les champs demandés à la création (colonnes de TABLES[table] ; les autres prennent leur valeur
 * « vide »). `adresse(id)` : où mène l'entité créée.
 */
export const ENTITES = {
  metier: {
    table: 'metier',
    libelle: 'métier',
    creation: ['nom', 'description', 'bonus_brut', 'artisanat_brut', 'equipement_brut', 'avantage_brut'],
    suppression: true,
  },
};

export class ErreurValeur extends Error {
  constructor(message) {
    super(message);
    this.name = 'ErreurValeur';
  }
}

/**
 * Valeur saisie → valeur enregistrée, d'après le type du champ ; lève ErreurValeur (message en français) si elle est refusée.
 * Texte : fins de ligne unifiées, espaces de bord retirées ; un champ vidé vaut `vide` s'il est défini, sinon NULL (absent = NULL).
 */
export function valeurDuChamp(champ, brute, nom = champ.libelle) {
  if (champ.type === 'entier') {
    if (brute === null || brute === undefined || String(brute).trim() === '') {
      if (champ.requis) throw new ErreurValeur(`« ${nom} » : valeur obligatoire`);
      return champ.vide ?? null;
    }
    const n = typeof brute === 'number' ? brute : Number(String(brute).trim().replace(/^\+/, ''));
    if (!Number.isInteger(n)) throw new ErreurValeur(`« ${nom} » : nombre entier attendu`);
    if (champ.min !== undefined && n < champ.min) throw new ErreurValeur(`« ${nom} » : au moins ${champ.min}`);
    if (champ.max !== undefined && n > champ.max) throw new ErreurValeur(`« ${nom} » : au plus ${champ.max}`);
    return n;
  }
  if (brute !== null && brute !== undefined && typeof brute !== 'string' && typeof brute !== 'number') throw new ErreurValeur(`« ${nom} » : texte attendu`);
  let texte = String(brute ?? '').replace(/\r\n?/g, '\n');
  if (champ.type === 'ligne' || champ.type === 'choix') texte = texte.replace(/\s*\n\s*/g, ' ');
  texte = champ.type === 'markdown' ? texte.replace(/\s+$/, '') : texte.trim();
  if (champ.type === 'choix' && texte !== '' && !(champ.choix ?? []).some((c) => c.valeur === texte)) throw new ErreurValeur(`« ${nom} » : valeur hors de la liste`);
  if (texte === '') {
    if (champ.requis) throw new ErreurValeur(`« ${nom} » : valeur obligatoire`);
    return champ.vide ?? null;
  }
  return texte;
}

/** L'attribut `data-ed` d'un élément qui affiche un champ : ["table", {clé primaire}, "colonne"] en JSON. */
export const attributEd = (table, cle, colonne) => JSON.stringify([table, cle, colonne]);

/** Lit un attribut `data-ed` ; null s'il est illisible ou vise un champ hors du modèle. */
export function lireAttributEd(texte) {
  try {
    const [table, cle, colonne] = JSON.parse(texte);
    if (!TABLES[table]?.colonnes[colonne] || !cle || typeof cle !== 'object') return null;
    return { table, cle, colonne, champ: TABLES[table].colonnes[colonne] };
  } catch {
    return null;
  }
}

/** Clé de regroupement d'une ligne (table + clé primaire), indépendante de l'ordre des colonnes de la clé. */
export const cleDeLigne = (table, cle) =>
  `${table}\u0000${JSON.stringify(Object.entries(cle ?? {}).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))}`;
