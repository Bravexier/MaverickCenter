// Contenu des tables de la base vivante pour le menu « DB » (le schéma de la base) de la page Debug (demande du propriétaire du 2026-10-15 :
// « D'un double clic sur une de ces tables, ça ouvrirait une popup avec le contenu dans un tableau (scrollable) »). Site de dev seulement :
// api.mjs répond 403 ailleurs, avant tout 404 ou 405 (décision du propriétaire du 2026-10-15 : en production, la base ne s'ouvre que par les
// pages du site).
//
//   GET /api/debug/tables/          { tables: [{ nom, genre, lignes }] } : chaque table et chaque vue de la base vivante, dans l'ordre des noms, ses
//                                   lignes comptées maintenant ; genre 'table', 'derivee' (TABLES_DERIVEES : `-- @derivee` de data/schema.sql) ou
//                                   'vue'. Ni les tables internes de SQLite (sqlite_…), ni les tables FTS5 (virtuelles, et leurs tables de shadow
//                                   « _data », « _idx »…) : celles que le schéma de la page ne montre pas non plus.
//   GET /api/debug/tables/<nom>/    ?limite=<1..500, 100>&decalage=<n ≥ 0, 0>&tri=<colonne>&ordre=asc|desc →
//                                   { table, genre, colonnes: [{ nom, type, pk }], total, limite, decalage, tri, ordre, lignes: [{ <colonne>: valeur }] }
//                                   (`tri` : la colonne demandée, ou null pour l'ordre par défaut)
//
// Fiches (section 13 : fiches de personnages, comptes, groupes ; et les vues qui les lisent) : listées avec leur nombre de lignes, mais leur contenu
// répond 403 avec la raison — comme /api/v1/ (« jamais servi »), elles ne se lisent que par /api/personnages/ et ses règles de visibilité
// (v_personnage_visible) : avec la connexion Discord, les fiches de joueur et les comptes seront privés. Le journal de l'édition (section 14) se lit :
// GET /api/edition/journal/ l'exporte déjà sur le site de dev (test/serveur-debug-tables.test.mjs épingle les deux listes).
//
// Sécurité. Lecture seule : le routeur ne sert que GET (405 avec Allow sinon) et ce module n'exécute que des SELECT et des PRAGMA de lecture
// (table_list, table_info). Un nom de table n'entre dans le SQL qu'après avoir été trouvé TEL QUEL (casse comprise) parmi les tables et vues que
// donne PRAGMA table_list (404 sinon : nom inconnu, table interne ou FTS, nom piégé, « / » encodé) ; une colonne de tri, qu'après PRAGMA table_info
// (400 sinon) ; les nombres (limite, décalage) passent en paramètres liés.
// Ordre stable d'une page à l'autre : la colonne de tri, puis la clé primaire, puis le rowid (table sans clé primaire, ou clé qui admet NULL) ; une
// vue (ni clé ni rowid) : toutes ses colonnes, dans l'ordre. `ordre=desc` renverse tout l'ordre.
// Valeurs : une image (data URL « data:image/… ») devient { image: true, type, octets, empreinte } — l'empreinte de lib/portrait.mjs#empreinte, comme
// edition-modele.mjs#ligneSansImage : jamais l'image entière ; une image DANS un texte (le JSON de modification.avant / apres : le portrait d'une
// carte de monstre modifié sur le site de dev) devient « [image <type>, N octets, empreinte <e>] » ; un texte de plus de TEXTE_MAX caractères est
// coupé, suivi de « … (N caractères) » ; un BLOB devient { octets } ; un entier hors de la plage sûre de JavaScript, son écriture en texte.
// Ce qui serait jeté n'est pas lu : le SQL ne rend d'un texte long que ses TEXTE_MAX premiers caractères et sa longueur (substr, length), d'un BLOB
// que sa taille ; seules les images (colonnes déclarées `GLOB 'data:image/*'`, et un texte qui en contient une) sont lues en entier, pour leur
// empreinte. Une colonne d'image se trie par sa taille (length) ; avec un tri, la page se choisit d'abord par la clé (rowid ou clé primaire) puis ses
// lignes se lisent une à une : le tri de SQLite ne porte jamais les images.
// N'importe que des modules de client/ (serveur/livraison.mjs#modulesDuServeur).
import { TABLES_FICHES } from '../src/lib/fiche-format.mjs';
import { empreinte } from '../src/lib/portrait.mjs';

export const LIMITE_PAR_DEFAUT = 100;
export const LIMITE_MAX = 500;
/** Au-delà, un texte est coupé (le reste est dit en nombre de caractères). */
export const TEXTE_MAX = 2000;
/** Tables dérivées (data/schema.sql, section 11 : `-- @derivee`, recalculées par le build), hors tables FTS5 : test/serveur-debug-tables.test.mjs les compare au schéma. */
export const TABLES_DERIVEES = new Set(['lien', 'lien_candidat']);

/** Erreur d'une requête sur les tables : statut HTTP, message en français, détails ajoutés au corps. */
export class ErreurTables extends Error {
  constructor(statut, message, details = {}) {
    super(message);
    this.name = 'ErreurTables';
    this.statut = statut;
    this.details = details;
  }
}

/** Un identifiant SQL entre guillemets doubles (ceux qu'il contient, doublés). */
const nomSql = (nom) => `"${String(nom).replace(/"/g, '""')}"`;

/** Raison du refus du contenu d'une table des fiches (section 13) ou d'une vue qui en lit une. */
export const RAISON_FICHES = 'Les fiches de personnages, les comptes et les groupes (section 13) ne se lisent pas ici : comme pour /api/v1/, elles '
  + 'passent par /api/personnages/ et ses règles de visibilité (v_personnage_visible).';

const echapperRegex = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const LIT_UNE_FICHE = new RegExp(`\\b(?:${TABLES_FICHES.map(echapperRegex).join('|')})\\b`, 'i');

/**
 * Les tables et vues lisibles de la base : Map(nom → { genre, sansRowid, fiches }) d'après PRAGMA table_list (schéma main) — types « table » et
 * « view » seulement (ni « virtual » ni « shadow » : les tables FTS5), sans les tables internes « sqlite_… ». `fiches` : une table de la section 13
 * (TABLES_FICHES), ou une vue qui en lit une (son SQL la nomme, directement ou par une autre vue de fiches) — contenu refusé (RAISON_FICHES).
 */
function objetsLisibles(db) {
  const objets = new Map();
  for (const o of db.prepare('PRAGMA main.table_list').all()) {
    const nom = String(o.name);
    if (nom.startsWith('sqlite_') || (o.type !== 'table' && o.type !== 'view')) continue;
    const genre = o.type === 'view' ? 'vue' : TABLES_DERIVEES.has(nom) ? 'derivee' : 'table';
    objets.set(nom, { genre, sansRowid: Number(o.wr) === 1, fiches: genre !== 'vue' && TABLES_FICHES.includes(nom) });
  }
  // les vues des fiches, jusqu'à ce que plus rien ne change (une vue qui lit une vue de fiches en est une)
  const vues = db.prepare("SELECT name, sql FROM sqlite_schema WHERE type = 'view'").all().filter((v) => objets.has(String(v.name)));
  for (let change = true; change;) {
    change = false;
    const deFiches = [...objets].filter(([, o]) => o.fiches && o.genre === 'vue').map(([n]) => echapperRegex(n));
    const lit = deFiches.length ? new RegExp(`\\b(?:${deFiches.join('|')})\\b`, 'i') : null;
    for (const v of vues) {
      const o = objets.get(String(v.name));
      if (o.fiches) continue;
      if (LIT_UNE_FICHE.test(String(v.sql)) || lit?.test(String(v.sql))) {
        o.fiches = true;
        change = true;
      }
    }
  }
  return objets;
}

/** Les tables et vues dont le contenu est refusé (fiches : section 13, et les vues qui les lisent), dans l'ordre des noms. */
export function tablesDesFiches(db) {
  return [...objetsLisibles(db)].filter(([, o]) => o.fiches).map(([nom]) => nom).sort();
}

/** GET /api/debug/tables/ : { nom, genre, lignes } de chaque table et vue lisible, dans l'ordre des noms. */
export function listerTables(db) {
  return [...objetsLisibles(db)]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([nom, { genre }]) => ({ nom, genre, lignes: Number(db.prepare(`SELECT count(*) AS n FROM ${nomSql(nom)}`).get().n) }));
}

/** Le nom d'une table lu dans l'adresse (segment encodé), décodé ; null s'il est illisible. */
function nomDecode(segment) {
  try {
    return decodeURIComponent(String(segment ?? ''));
  } catch {
    return null;
  }
}

/** Un entier lu dans l'adresse, de `min` à `max` ; `defaut` s'il est absent ou vide ; 400 sinon. */
function entierDe(texte, defaut, min, max, nom) {
  if (texte === null || texte === undefined || String(texte).trim() === '') return defaut;
  const brut = String(texte).trim();
  const n = Number(brut);
  if (!/^\d+$/.test(brut) || n < min || n > max) {
    throw new ErreurTables(400, `${nom} : nombre entier attendu, de ${min} à ${max === Number.MAX_SAFE_INTEGER ? 'plus' : max} (reçu « ${texte} »).`);
  }
  return n;
}

const DATA_URL_IMAGE = /^data:(image\/[A-Za-z0-9.+-]+)((?:;[^,;]*)*?)(;base64)?,/;
/**
 * Une data URL d'image DANS un texte (le JSON du journal) : son en-tête, puis ses données — en base64, ses seuls caractères ; sinon jusqu'au premier
 * caractère qui ne peut pas en être (guillemet, barre oblique inverse d'un échappement JSON, blanc, chevron).
 */
const DATA_URL_IMAGE_DANS = /data:(image\/[A-Za-z0-9.+-]+)((?:;[^,;"'\\\s<>]*)*?)(?:(;base64),([A-Za-z0-9+/=]*)|,([^"'\\\s<>]*))/g;
/** Le marqueur qui annonce une image dans un texte (instr côté SQL : un tel texte est lu en entier, pour résumer l'image). */
const MARQUE_IMAGE = 'data:image/';

/** Une data URL d'image résumée : { image: true, type, octets (de l'image décodée), empreinte (de toute la data URL, comme ligneSansImage) }. */
function imageResumee(dataUrl, type, base64, donnees) {
  let octets;
  if (base64) {
    const utiles = /\s/.test(donnees) ? donnees.replace(/\s+/g, '') : donnees;
    const remplissage = utiles.endsWith('==') ? 2 : utiles.endsWith('=') ? 1 : 0;
    octets = Math.max(0, Math.floor((utiles.length * 3) / 4) - remplissage);
  } else {
    octets = Buffer.byteLength(donnees);
  }
  return { image: true, type: type.toLowerCase(), octets, empreinte: empreinte(dataUrl) };
}

/** Chaque image d'un texte remplacée par « [image <type>, N octets, empreinte <e>] » (jamais un morceau de ses données). */
function imagesDuTexteResumees(texte) {
  if (!texte.includes(MARQUE_IMAGE)) return texte;
  return texte.replace(DATA_URL_IMAGE_DANS, (tout, type, _parametres, base64, enBase64, brutes) => {
    const r = imageResumee(tout, type, Boolean(base64), base64 ? enBase64 : brutes);
    return `[image ${r.type}, ${r.octets} octets, empreinte ${r.empreinte}]`;
  });
}

/** Un texte de plus de TEXTE_MAX caractères (points de code : un emoji compte pour un), coupé et suivi de « … (N caractères) ». */
function texteResume(texte) {
  if (texte.length <= TEXTE_MAX) return texte;
  const points = Array.from(texte);
  if (points.length <= TEXTE_MAX) return texte;
  return `${points.slice(0, TEXTE_MAX).join('')} … (${points.length} caractères)`;
}

/**
 * Une valeur telle que la route la rend : null et nombres tels quels ; un entier lu en BigInt, en nombre s'il tient dans la plage sûre, sinon en
 * texte ; une image résumée (imageResumee) ; un texte qui contient des images, chacune résumée ; un texte long coupé (texteResume) ; un BLOB : { octets }.
 */
export function valeurResumee(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'bigint') return v >= BigInt(Number.MIN_SAFE_INTEGER) && v <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(v) : v.toString();
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const m = DATA_URL_IMAGE.exec(v);
    return m ? imageResumee(v, m[1], Boolean(m[3]), v.slice(m[0].length)) : texteResume(imagesDuTexteResumees(v));
  }
  if (v instanceof Uint8Array || ArrayBuffer.isView(v)) return { octets: v.byteLength };
  return String(v);
}

/**
 * Une valeur lue par lireTable (expressionsDeLecture) : `v` la valeur (un texte long : ses TEXTE_MAX premiers caractères ; un BLOB : null), `longueur`
 * celle de la valeur entière en base (caractères d'un texte, octets d'un BLOB ; null sinon).
 */
function valeurLue(v, longueur) {
  const n = longueur === null || longueur === undefined ? null : Number(longueur);
  if ((v === null || v === undefined) && n !== null) return { octets: n }; // un BLOB : sa taille seulement
  if (typeof v === 'string' && n !== null && n > TEXTE_MAX && !v.includes(MARQUE_IMAGE)) return `${v} … (${n} caractères)`; // coupé par le SQL
  return valeurResumee(v);
}

/** Les colonnes d'image d'une table : celles que son CREATE TABLE contraint par `<colonne> GLOB 'data:image/*'` (portraits). */
function colonnesDImage(db, nom, noms) {
  const sql = String(db.prepare("SELECT sql FROM sqlite_schema WHERE type = 'table' AND name = ?").get(nom)?.sql ?? '');
  return new Set(noms.filter((c) => new RegExp(`(?:^|[^\\w"])"?${echapperRegex(c)}"?\\s+GLOB\\s+'data:image/\\*'`, 'i').test(sql)));
}

/**
 * Ce que le SELECT lit de chaque colonne (alias v<i> et l<i>) : une colonne d'image, entière (son empreinte) ; une autre : un BLOB → NULL et sa taille,
 * un texte de plus de TEXTE_MAX caractères → ses TEXTE_MAX premiers et sa longueur (sauf s'il contient une image : entier, pour la résumer).
 */
function expressionsDeLecture(noms, images) {
  return noms.flatMap((n, i) => {
    const c = nomSql(n);
    if (images.has(n)) return [`${c} AS "v${i}"`, `NULL AS "l${i}"`];
    return [
      `CASE WHEN typeof(${c}) = 'blob' THEN NULL WHEN typeof(${c}) = 'text' AND length(${c}) > ${TEXTE_MAX} AND instr(${c}, '${MARQUE_IMAGE}') = 0`
        + ` THEN substr(${c}, 1, ${TEXTE_MAX}) ELSE ${c} END AS "v${i}"`,
      `CASE WHEN typeof(${c}) IN ('text', 'blob') THEN length(${c}) END AS "l${i}"`,
    ];
  }).join(', ');
}

/**
 * GET /api/debug/tables/<nom>/ : une page des lignes d'une table ou d'une vue (voir l'en-tête du module).
 * @param {import('node:sqlite').DatabaseSync} db la base vivante
 * @param {string} segment le nom de la table tel qu'il est écrit dans l'adresse (encodé)
 * @param {URLSearchParams} params limite, decalage, tri, ordre
 */
export function lireTable(db, segment, params = new URLSearchParams()) {
  const nom = nomDecode(segment);
  const objet = nom === null ? null : objetsLisibles(db).get(nom);
  if (!objet) {
    throw new ErreurTables(404, `Table introuvable${nom ? ` : « ${nom.slice(0, 100)} »` : ''} (les tables et vues de la base : GET /api/debug/tables/).`);
  }
  if (objet.fiches) throw new ErreurTables(403, RAISON_FICHES, { table: nom });
  const info = db.prepare(`PRAGMA main.table_info(${nomSql(nom)})`).all();
  const colonnes = info.map((c) => ({ nom: String(c.name), type: String(c.type ?? ''), pk: Number(c.pk) }));
  const noms = colonnes.map((c) => c.nom);

  const limite = entierDe(params.get('limite'), LIMITE_PAR_DEFAUT, 1, LIMITE_MAX, 'limite');
  const decalage = entierDe(params.get('decalage'), 0, 0, Number.MAX_SAFE_INTEGER, 'decalage');
  const triDemande = params.get('tri');
  const tri = triDemande === null || triDemande === '' ? null : triDemande;
  if (tri !== null && !noms.includes(tri)) {
    throw new ErreurTables(400, `tri : « ${tri.slice(0, 100)} » n’est pas une colonne de ${nom}.`, { colonnes: noms });
  }
  const ordreDemande = params.get('ordre');
  const ordre = ordreDemande === null || ordreDemande === '' ? 'asc' : ordreDemande.toLowerCase();
  if (ordre !== 'asc' && ordre !== 'desc') throw new ErreurTables(400, `ordre : « asc » ou « desc » attendu (reçu « ${String(ordreDemande).slice(0, 100)} »).`);

  // ordre stable : la colonne de tri, puis la clé primaire, puis le rowid ; une vue (ni clé ni rowid) : toutes ses colonnes
  const clePrimaire = colonnes.filter((c) => c.pk > 0).sort((a, b) => a.pk - b.pk).map((c) => c.nom);
  const cle = clePrimaire.map(nomSql);
  // le rowid sous l'un de ses trois noms qu'aucune colonne ne prend (une colonne « rowid » le masquerait)
  const rowid = objet.sansRowid ? null : ['rowid', '_rowid_', 'oid'].find((alias) => !noms.some((n) => n.toLowerCase() === alias)) ?? null;
  const departage = objet.genre === 'vue' ? noms.map(nomSql) : [...cle, ...(rowid ? [rowid] : [])];
  const images = objet.genre === 'vue' ? new Set() : colonnesDImage(db, nom, noms);
  const sens = ordre === 'desc' ? 'DESC' : 'ASC';
  // une colonne d'image se trie par sa taille : le tri de SQLite ne compare (ni ne copie) jamais des images de 700 000 caractères
  const parTri = tri === null ? [] : [images.has(tri) ? `length(${nomSql(tri)})` : nomSql(tri)];
  const cles = [...new Set([...parTri, ...departage])];
  const parOrdre = cles.length ? ` ORDER BY ${cles.map((c) => `${c} ${sens}`).join(', ')}` : '';

  const total = Number(db.prepare(`SELECT count(*) AS n FROM ${nomSql(nom)}`).get().n);
  const lues = noms.length ? expressionsDeLecture(noms, images) : '*';
  // chaque ligne résumée dès qu'elle est lue (une image n'est gardée que le temps de son empreinte) ; les entiers en BigInt : aucun entier de la base
  // ne fait échouer la lecture (valeurResumee les rend en nombre, ou en texte hors de la plage sûre)
  const resumer = (l) => {
    const sortie = {};
    noms.forEach((n, i) => { sortie[n] = valeurLue(l[`v${i}`], l[`l${i}`]); });
    return sortie;
  };
  const lignes = [];
  // avec un tri, d'abord la page de clés (le tri ne porte que la clé et la valeur triée), puis chaque ligne par sa clé : jamais une image dans le tri
  const parCle = tri !== null && objet.genre !== 'vue' && (rowid || clePrimaire.length) ? (rowid ? [rowid] : cle) : null;
  if (parCle) {
    const pageDeCles = db.prepare(`SELECT ${parCle.map((c, i) => `${c} AS "k${i}"`).join(', ')} FROM ${nomSql(nom)}${parOrdre} LIMIT ? OFFSET ?`);
    pageDeCles.setReadBigInts(true);
    const ligne = db.prepare(`SELECT ${lues} FROM ${nomSql(nom)} WHERE ${parCle.map((c) => `${c} = ?`).join(' AND ')}`);
    ligne.setReadBigInts(true);
    for (const k of pageDeCles.all(limite, decalage)) {
      const l = ligne.get(...parCle.map((_, i) => k[`k${i}`]));
      if (l) lignes.push(resumer(l));
    }
  } else {
    const instruction = db.prepare(`SELECT ${lues} FROM ${nomSql(nom)}${parOrdre} LIMIT ? OFFSET ?`);
    instruction.setReadBigInts(true);
    for (const l of instruction.iterate(limite, decalage)) lignes.push(resumer(l));
  }
  return { table: nom, genre: objet.genre, colonnes, total, limite, decalage, tri, ordre, lignes };
}
