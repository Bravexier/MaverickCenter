// Journal du service, gardé en mémoire pour la page Debug du site de dev (demande du propriétaire : « en dessous on trouvera les logs du serveur
// (avec une possibilité de filtrer) » ; pages/debug.astro, lue par GET /api/debug/journal/, site de dev seulement).
//
// `ecrire(message)` garde la sortie d'avant — la ligne horodatée « <instant> <message> » de service.mjs#horodater, que `docker logs` montre — et met
// aussi l'entrée dans un anneau borné (`capacite`, 2000 par défaut : les plus anciennes en sortent, comptées dans `perdues`). Une entrée :
//   { n, instant, niveau, categorie, message }
//   n          numéro croissant depuis le démarrage du service, jamais réutilisé (même après `vider`) : la page relève les suivantes par ?depuis=<n>
//   instant    ISO 8601 en UTC à la seconde, le format de serveur/instant.mjs (recopié ici : ce module n'importe rien ; le test les compare)
//   niveau     info, avertissement ou erreur (NIVEAUX)
//   categorie  service, http, base, fiches, edition, mise-a-jour, maintenance (CATEGORIES), ou celle que l'appelant donne
// Niveau et catégorie se donnent (`ecrire(message, { niveau, categorie })`) ou se déduisent du message, d'après l'écriture des lignes que le service
// note déjà (service.mjs, api.mjs, notes-de-version.mjs) : niveauDuMessage, categorieDuMessage.
//
// Les relèves réussies du journal lui-même (la page Debug le lit toutes les 2 s) et de l'état de maintenance (chaque page ouverte le lit toutes les
// 30 s : layouts/Base.astro) ne sont notées nulle part : elles noieraient le reste et le pousseraient hors de la mémoire (estUneReleve).
// Module sans import (ni node: ni autre) : service.mjs et api.mjs le branchent.

/** Les niveaux, du moins grave au plus grave. */
export const NIVEAUX = ['info', 'avertissement', 'erreur'];

/** Les catégories que le service écrit (dans l'ordre de la liste de la page) ; un appelant peut en donner une autre. */
export const CATEGORIES = ['service', 'http', 'base', 'fiches', 'edition', 'mise-a-jour', 'maintenance'];

/** Longueur gardée en mémoire d'un message (une pile d'erreur, un corps cité) : la sortie console, elle, l'a en entier. */
export const MESSAGE_MAX = 16000;

/** Instant ISO 8601 en UTC à la seconde (même écriture que serveur/instant.mjs#instant). */
const aLaSeconde = (date) => date.toISOString().replace(/\.\d{3}Z$/, 'Z');

/** Préfixe d'un message qui en dit le niveau (« ERREUR base vivante : … ») : retiré avant d'en chercher la catégorie. */
const PREFIXE_DE_NIVEAU = /^(ERREUR|ATTENTION|AVERTISSEMENT)\b\s*:?\s*/;

/** Une requête HTTP notée : « GET /api/v1/metiers/ 200 12 ms » (et « ERREUR GET /api/… : <pile> » d'une exception, service.mjs). */
const REQUETE = /^(GET|HEAD|POST|PUT|PATCH|DELETE|OPTIONS) \S+/;

/** Catégorie d'un message d'après son début (le préfixe de niveau retiré), dans cet ordre ; sinon « service ». */
const REGLES_DE_CATEGORIE = [
  [REQUETE, 'http'],
  [/^édition\b/i, 'edition'], // « édition : lot … (N ligne(s)) depuis <page> » (api.mjs)
  [/^(simulation de )?mise à jour\b/i, 'mise-a-jour'], // lot figé, workflow déclenché ou annulé (api.mjs, notes-de-version.mjs)
  [/^maintenance\b/i, 'maintenance'], // annonce publiée ou retirée, levée depuis la page, suivi du lancement (service.mjs, api.mjs)
  [/prétiré|^fiches\b/i, 'fiches'], // création, modification, suppression d'un prétiré (api.mjs) ; fiches adaptées aux nouvelles règles (R42)
  [/base vivante|base des règles|^journal des modifications rejoué/i, 'base'], // reconstruction, réouverture, rejeu du journal (service.mjs)
  [/^service des personnages|^nouvelle version du service/i, 'service'], // démarrage, relance après livraison (service.mjs)
];

/** La catégorie d'un message que l'appelant n'a pas rangé (voir REGLES_DE_CATEGORIE). */
export function categorieDuMessage(message) {
  const texte = String(message ?? '').replace(PREFIXE_DE_NIVEAU, '');
  return REGLES_DE_CATEGORIE.find(([motif]) => motif.test(texte))?.[1] ?? 'service';
}

/**
 * Le niveau d'un message que l'appelant n'a pas donné : « ERREUR … » → erreur ; « ATTENTION … » ou « AVERTISSEMENT … » → avertissement ; une
 * requête HTTP notée avec son statut (« GET /api/x/ 404 3 ms ») : 5xx → erreur, 4xx → avertissement ; un rejeu du journal avec des modifications
 * en conflit (« …, 2 en conflit ») → avertissement ; sinon info.
 */
export function niveauDuMessage(message, categorie = categorieDuMessage(message)) {
  const texte = String(message ?? '');
  if (/^ERREUR\b/.test(texte)) return 'erreur';
  if (/^(ATTENTION|AVERTISSEMENT)\b/.test(texte)) return 'avertissement';
  if (categorie === 'http') {
    const statut = Number(/^[A-Z]+ \S+ (\d{3})\b/.exec(texte)?.[1]);
    if (statut >= 500) return 'erreur';
    if (statut >= 400) return 'avertissement';
  }
  if (/\b[1-9]\d* en conflit\b/.test(texte)) return 'avertissement';
  return 'info';
}

/**
 * Vrai pour la ligne d'une relève réussie (2xx ou 304) du journal (GET /api/debug/journal/) ou de l'état de maintenance (GET /api/maintenance/) :
 * elle n'est notée ni en mémoire ni sur la sortie.
 */
export function estUneReleve(message) {
  return /^GET \S*\/api\/(?:debug\/journal|maintenance)\/?(?:\?\S*)? (?:2\d\d|304)\b/.test(String(message ?? ''));
}

/** Écriture de recherche : minuscules, sans accents (« Édition » se trouve par « edition »). */
const cle = (texte) => String(texte ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/** Les valeurs d'un filtre : un tableau, ou un texte « a,b » ; null si le filtre est vide (tout passe). */
function ensemble(valeur) {
  const valeurs = (Array.isArray(valeur) ? valeur : String(valeur ?? '').split(',')).map((v) => String(v).trim()).filter(Boolean);
  return valeurs.length ? new Set(valeurs) : null;
}

/** Un entier positif lu dans un paramètre (texte de l'adresse ou nombre) ; `defaut` s'il n'en est pas un. */
function entier(valeur, defaut) {
  if (valeur === undefined || valeur === null || valeur === '') return defaut;
  const n = Number(valeur);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : defaut;
}

/**
 * Crée le journal du service.
 * @param {object} [o]
 * @param {number} [o.capacite] entrées gardées en mémoire (les plus récentes)
 * @param {((ligne: string) => void) | null} [o.sortie] où écrire la ligne horodatée (la console ; null : nulle part)
 * @param {() => Date | string | number} [o.horloge] l'instant d'une écriture (tests)
 */
export function creerJournalDuService({ capacite = 2000, sortie = (ligne) => console.log(ligne), horloge = () => new Date() } = {}) {
  const taille = Math.max(1, entier(capacite, 2000));
  /** @type {{ n: number, instant: string, niveau: string, categorie: string, message: string }[]} */
  let entrees = [];
  let dernier = 0;

  /** Note `message` : sur la sortie (la ligne d'avant), puis en mémoire. Rend l'entrée (une copie), ou null pour une relève (estUneReleve). */
  function ecrire(message, { niveau, categorie } = {}) {
    const texte = String(message ?? '');
    if (estUneReleve(texte)) return null;
    const date = horloge();
    const instant = aLaSeconde(date instanceof Date ? date : new Date(date));
    sortie?.(`${instant} ${texte}`);
    const rangee = typeof categorie === 'string' && categorie.trim() ? categorie.trim() : categorieDuMessage(texte);
    const entree = {
      n: ++dernier,
      instant,
      niveau: NIVEAUX.includes(niveau) ? niveau : niveauDuMessage(texte, rangee),
      categorie: rangee,
      message: texte.length > MESSAGE_MAX ? `${texte.slice(0, MESSAGE_MAX)}… (${texte.length - MESSAGE_MAX} caractères de plus sur la sortie du service)` : texte,
    };
    entrees.push(entree);
    if (entrees.length > taille) entrees.splice(0, entrees.length - taille);
    return { ...entree };
  }

  /**
   * Les entrées en mémoire qui suivent `depuis` (n > depuis) et passent les filtres, de la plus ancienne à la plus récente, au plus `limite` (les
   * plus récentes) :
   *   niveau, categorie : une valeur, « a,b » ou un tableau (l'une OU l'autre) ; q : un texte cherché dans le message et la catégorie (sans
   *   accents ni majuscules). Un filtre vide laisse tout passer.
   * Rend { entrees, dernier (le n de la dernière écriture, filtres ou non : le curseur de la relève suivante), capacite, perdues (entrées écrites
   * qui ne sont plus en mémoire) }.
   */
  function lire({ depuis, niveau, categorie, q, limite } = {}) {
    const apres = entier(depuis, 0);
    const niveaux = ensemble(niveau);
    const categories = ensemble(categorie);
    const texte = cle(q).trim();
    const max = Math.min(taille, entier(limite, taille) || taille);
    const trouvees = entrees.filter((e) => e.n > apres
      && (!niveaux || niveaux.has(e.niveau))
      && (!categories || categories.has(e.categorie))
      && (!texte || cle(`${e.message} ${e.categorie}`).includes(texte)));
    return { entrees: trouvees.slice(-max).map((e) => ({ ...e })), dernier, capacite: taille, perdues: dernier - entrees.length };
  }

  /** Les catégories des entrées en mémoire : celles de CATEGORIES dans leur ordre, puis les autres par ordre alphabétique. */
  function categories() {
    const presentes = new Set(entrees.map((e) => e.categorie));
    const connues = CATEGORIES.filter((c) => presentes.has(c));
    return [...connues, ...[...presentes].filter((c) => !CATEGORIES.includes(c)).sort((a, b) => a.localeCompare(b, 'fr'))];
  }

  /** Vide la mémoire (la sortie n'est pas touchée) ; la numérotation continue : un curseur `depuis` reste valable. */
  function vider() {
    entrees = [];
  }

  return { ecrire, lire, categories, vider };
}
