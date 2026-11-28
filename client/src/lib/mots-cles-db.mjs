// Le vocabulaire des mots-clés lu dans la base construite (table mot_cle, migrations 0043, 0056, 0113 à 0115 et 0136) : le Glossaire, la Recherche, l'adresse
// des pastilles des pages du wiki (/recherche/?mot-cle=<clé>) et les balises des textes (lib/mots-cles-balises.mjs : le middleware du site, la
// recherche, les règles de la fiche). Un mot-clé : son id (entier, figé, migration 0113), son libellé (pas unique), sa clé (`cle` : celle que citent
// les balises et les adresses, recalculée : lib/mots-cles-cles.mjs, décision R232), sa définition (`description` : NULL tant qu'il n'est pas décrit,
// ici comme dans la base, le service et GET /api/edition/mots-cles/ ; qui l'affiche écrit `?? ''`), sa couleur et son adresse (`couleur`, `url`,
// migration 0098 : NULL sans elles), son verrou (0 ou 1, migration 0110), la monnaie dont il est le mot-clé (`monnaie_id`, migration 0113 : NULL
// sinon ; un mot-clé de monnaie se reconnaît par elle, jamais par son id ni par un synonyme), ses synonymes (`synonymes` : leurs écritures dans
// l'ordre, migration 0115, décision R233 ; l'ancienne abréviation en est un), ses catégories (`categories` : leurs ids, croissants, migration 0113) et
// les clés qu'il a quittées (`anciennes_cles`, mot_cle_ancienne_cle : une balise ou une adresse d'avant un renommage mène encore à lui). Les pages
// portent l'écriture de leurs mots-clés (front matter `tags`, fabriqué par db:export-pages : le libellé, ou la clé d'un homonyme).
// Depuis la migration 0136 (chantier 4, « le retrait des colonnes » : docs/chantier-retrait-des-colonnes.md), la ligne du mot-clé ne porte plus que son
// id, sa clé, son verrou et sa monnaie : son libellé, son adresse, sa définition, sa couleur et son icône se lisent sur son ÉLÉMENT, sa page
// (page.mot_cle_id), sinon son sort (sort.mot_cle_id), sinon son repère (table repere). L'objet rendu garde sa forme (motsClesDeLaBase, lireUnMotCle) ;
// une base restée à l'ancienne structure (colonne mot_cle.libelle : la production que la note de version compare au site de dev) se lit comme avant.
// Et les textes de la base où une balise peut s'écrire (textesDeLaBase : db:check, le rejeu du journal ; hors tables de lib/tables-de-la-base.mjs).
// Sans dépendance Astro ni navigateur : la base est passée par l'appelant (pages, middleware, service, scripts, tests).
import { adresseDeLaPage, adresseDeLaPageEnBase, adresseDuSort, adresseDuSortEnBase, indexDesAdresses, pageDeLAdresse, slugsDAdresse } from './adresses-db.mjs';
import { typeDeTexte } from './edition-modele.mjs';
import { parLibelle } from './mots-cles.mjs';
import { motCleDeLaRef, vocabulaireDesMotsCles } from './mots-cles-balises.mjs';
import { TABLES_DERIVEES, TABLES_HORS_REGLES, TRACES_TELLES_QUELLES } from './tables-de-la-base.mjs';

const caches = new WeakMap(); // base -> { vocabulaire, pret }

const tableExiste = (db, nom) => Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(nom));
const colonnesDe = (db, table) => db.prepare(`PRAGMA table_info("${table}")`).all().map((c) => c.name);

/**
 * Ce que la base a des tables où se lit un mot-clé, relu quand sa structure change (`schema_version` monte à chaque CREATE, ALTER ou DROP) : { motCle (les
 * colonnes de mot_cle, null sans la table), ancienne (vrai tant que mot_cle porte `libelle` : avant la migration 0136), page, sort (leurs colonnes, vide
 * sans la table), repere (la table existe) }.
 */
function structureDe(db) {
  const version = db.prepare('PRAGMA schema_version').get().schema_version;
  const memo = structures.get(db);
  if (memo?.version === version) return memo.structure;
  const motCle = tableExiste(db, 'mot_cle') ? colonnesDe(db, 'mot_cle') : null;
  const structure = {
    motCle,
    ancienne: Boolean(motCle?.includes('libelle')),
    page: tableExiste(db, 'page') ? colonnesDe(db, 'page') : [],
    sort: tableExiste(db, 'sort') ? colonnesDe(db, 'sort') : [],
    repere: tableExiste(db, 'repere'),
  };
  structures.set(db, { version, structure });
  return structure;
}
const structures = new WeakMap(); // db -> { version, structure }

/** Les colonnes de page d'où se lit un mot-clé de page ; une colonne que la base n'a pas (base d'essai réduite) vaut NULL. */
const colonnesDeLElementPage = (s) => ['definition', 'couleur', 'icone'].map((c) => (s.page.includes(c) ? c : `NULL AS ${c}`)).join(', ');
const champsDeLaPage = (p, url) => ({ libelle: p.titre, url, description: p.definition ?? null, couleur: p.couleur ?? null, icone: p.icone ?? null, element: { table: 'page', id: p.id } });
// un mot-clé de sort n'a ni définition écrite, ni couleur, ni icône (docs/chantier-retrait-des-colonnes.md §1)
const champsDuSort = (l, url) => ({ libelle: l.nom, url, description: null, couleur: null, icone: null, element: { table: 'sort', id: l.id } });
const champsDuRepere = (r) => ({ libelle: r.nom, url: r.adresse ?? null, description: r.definition ?? null, couleur: r.couleur ?? null, icone: r.icone ?? null, element: { table: 'repere', id: r.mot_cle_id } });
const LIRE_LE_REPERE = 'SELECT mot_cle_id, nom, adresse, definition, couleur, icone FROM repere';

/**
 * L'élément de CHAQUE mot-clé et ce qui s'y lit : Map(id du mot-clé → { libelle, url, description, couleur, icone, element: { table, id } }). La page
 * d'abord (son titre, son adresse d'aujourd'hui, sa définition, sa couleur, son icône), sinon le sort (son nom, sa place dans la page de sa magie), sinon
 * le repère. Un mot-clé sans élément n'y est pas.
 */
function champsDesElements(db, s) {
  const sortie = new Map();
  const poser = (id, champs) => { if (!sortie.has(id)) sortie.set(id, champs); };
  // l'adresse d'aujourd'hui : le segment renommé de la page (d'un sort : celui de sa magie) lu en base (R316)
  const segments = slugsDAdresse(db);
  if (s.page.includes('mot_cle_id')) {
    for (const p of db.prepare(`SELECT id, mot_cle_id, titre, ${colonnesDeLElementPage(s)} FROM page WHERE mot_cle_id IS NOT NULL ORDER BY id`).all()) {
      poser(p.mot_cle_id, champsDeLaPage(p, adresseDeLaPage(p.id, segments.get(p.id) ?? null)));
    }
  }
  if (s.sort.includes('mot_cle_id')) {
    for (const l of db.prepare('SELECT id, mot_cle_id, nom FROM sort WHERE mot_cle_id IS NOT NULL ORDER BY id').all()) {
      poser(l.mot_cle_id, champsDuSort(l, adresseDuSort(l.id, segments.get(String(l.id).split('#sort:')[0]) ?? null)));
    }
  }
  if (s.repere) for (const r of db.prepare(`${LIRE_LE_REPERE} ORDER BY mot_cle_id`).all()) poser(r.mot_cle_id, champsDuRepere(r));
  return sortie;
}

/** L'élément du seul mot-clé `id` et ce qui s'y lit (la forme de champsDesElements), ou null. Les adresses sont lues dans la base (R316). */
function champsDeLElement(db, s, id) {
  if (s.page.includes('mot_cle_id')) {
    const p = db.prepare(`SELECT id, titre, ${colonnesDeLElementPage(s)} FROM page WHERE mot_cle_id = ? ORDER BY id LIMIT 1`).get(id);
    if (p) return champsDeLaPage(p, adresseDeLaPageEnBase(db, p.id));
  }
  if (s.sort.includes('mot_cle_id')) {
    const l = db.prepare('SELECT id, nom FROM sort WHERE mot_cle_id = ? ORDER BY id LIMIT 1').get(id);
    if (l) return champsDuSort(l, adresseDuSortEnBase(db, l.id));
  }
  if (s.repere) {
    const r = db.prepare(`${LIRE_LE_REPERE} WHERE mot_cle_id = ?`).get(id);
    if (r) return champsDuRepere(r);
  }
  return null;
}

/** Une colonne de mot_cle dans un SELECT : écrite seulement si la table l'a (PRAGMA table_info), sinon sa valeur par défaut. */
const colonneDuMotCle = (s, c, defaut = 'NULL') => (s.motCle.includes(c) ? `"${c}"` : `${defaut} AS "${c}"`);
const cleDuMotCle = (s) => (s.motCle.includes('cle') ? '"cle"' : '"libelle_cle" AS "cle"');

/**
 * Les catégories des mots-clés (table categorie_mot_cle, migration 0113) : [{ id, libelle, libelle_cle, mots_cles (le nombre de mots-clés qui la
 * portent) }], dans l'ordre de leur id ; vide pour une base qui n'a pas la table.
 * @param {import('node:sqlite').DatabaseSync} db
 */
export function categoriesDesMotsCles(db) {
  if (!tableExiste(db, 'categorie_mot_cle')) return [];
  const compte = tableExiste(db, 'mot_cle_categorie') ? '(SELECT count(*) FROM mot_cle_categorie l WHERE l.categorie_id = c.id)' : '0';
  return db.prepare(`SELECT c.id, c.libelle, c.libelle_cle, ${compte} AS mots_cles FROM categorie_mot_cle c ORDER BY c.id`).all().map((c) => ({ ...c }));
}

/**
 * Les mots-clés de la base, lus à chaque appel (sans cache : le service, dont la base change d'un lot à l'autre) : [{ id, libelle, cle, description,
 * couleur, url, verrou, monnaie_id, icone, synonymes, categories, anciennes_cles, parent, element }], dans l'ordre de leur id (`icone` : migration 0116,
 * décision R235, lib/icones.mjs ; `parent` : le nom de la magie du sort que le mot-clé ancre, migration 0131, décision R309, null sinon et pour une base
 * sans `sort.mot_cle_id` ; il sert à lib/mots-cles-cles.mjs#clesDesMotsCles et n'entre pas dans le vocabulaire des balises ; `element` : { table, id,
 * adresse, texte } le premier de `elementsDesMotsCles`, ou null sans élément : son `texte` est ce qu'un mot-clé sans définition écrite montre,
 * lib/mots-cles-balises.mjs#definitionDuMotCle ; un repère n'est pas l'un d'eux : un mot-clé à repère reste « sans élément » ici, et se modifie au
 * Glossaire). Depuis la migration 0136, `libelle`, `url`, `description`, `couleur` et `icone` se lisent sur la page, sinon le sort, sinon le repère du
 * mot-clé (champsDesElements) ; un mot-clé sans aucun des trois (base incohérente, que db:check refuse) montre sa clé pour libellé, le reste à NULL.
 * `elements: false` ne lit aucun texte et laisse `element` à null : les chemins d'écriture du service, qui
 * n'affichent rien et appellent cette fonction à chaque ligne d'un lot, le passent. Une base d'avant la migration 0113 (le service peut y retomber si la reconstruction de sa base vivante échoue) : `cle` =
 * libelle_cle, ni catégorie ni clé quittée, et son abréviation (0090) pour seul synonyme ; d'avant la 0056, la 0098, la 0110 ou la 0116 : NULL (0 pour
 * le verrou) ; vide sans table mot_cle (avant la 0043).
 * @param {import('node:sqlite').DatabaseSync} db
 */
export function motsClesDeLaBase(db, { elements = true } = {}) {
  const s = structureDe(db);
  if (!s.motCle) return [];
  const abreviation = s.ancienne && !tableExiste(db, 'mot_cle_synonyme') && s.motCle.includes('abreviation');
  const suite = () => ({ synonymes: [], categories: [], anciennes_cles: [], parent: null, element: null });
  let parId;
  if (s.ancienne) {
    // avant la migration 0136 : les cinq champs sont des colonnes du mot-clé
    const colonnes = [...['description', 'couleur', 'url', 'monnaie_id', 'icone'].map((c) => colonneDuMotCle(s, c)), colonneDuMotCle(s, 'verrou', '0')].join(', ');
    const lignes = db.prepare(`SELECT id, libelle, ${cleDuMotCle(s)}, ${colonnes}${abreviation ? ', "abreviation"' : ''} FROM mot_cle ORDER BY id`).all();
    parId = new Map(lignes.map((l) => [l.id, { ...l, ...suite() }]));
  } else {
    // depuis la 0136 : ils se lisent sur l'élément ; l'objet garde ses champs, dans le même ordre
    const champs = champsDesElements(db, s);
    const lignes = db.prepare(`SELECT id, ${cleDuMotCle(s)}, ${colonneDuMotCle(s, 'monnaie_id')}, ${colonneDuMotCle(s, 'verrou', '0')} FROM mot_cle ORDER BY id`).all();
    parId = new Map(lignes.map((l) => {
      const e = champs.get(l.id);
      return [l.id, {
        id: l.id, libelle: e?.libelle ?? l.cle, cle: l.cle, description: e?.description ?? null, couleur: e?.couleur ?? null, url: e?.url ?? null,
        monnaie_id: l.monnaie_id, icone: e?.icone ?? null, verrou: l.verrou, ...suite(),
      }];
    }));
  }
  for (const m of parId.values()) {
    if (abreviation) {
      if (typeof m.abreviation === 'string' && m.abreviation) m.synonymes.push(m.abreviation);
      delete m.abreviation;
    }
  }
  if (tableExiste(db, 'mot_cle_synonyme')) {
    for (const s of db.prepare('SELECT mot_cle_id, libelle FROM mot_cle_synonyme ORDER BY mot_cle_id, ordre, id').all()) parId.get(s.mot_cle_id)?.synonymes.push(s.libelle);
  }
  if (tableExiste(db, 'mot_cle_categorie')) {
    for (const c of db.prepare('SELECT mot_cle_id, categorie_id FROM mot_cle_categorie ORDER BY mot_cle_id, categorie_id').all()) parId.get(c.mot_cle_id)?.categories.push(c.categorie_id);
  }
  if (tableExiste(db, 'mot_cle_ancienne_cle')) {
    for (const a of db.prepare('SELECT mot_cle_id, cle FROM mot_cle_ancienne_cle ORDER BY mot_cle_id, cle').all()) parId.get(a.mot_cle_id)?.anciennes_cles.push(a.cle);
  }
  if (tableExiste(db, 'sort') && tableExiste(db, 'magie') && colonnesDe(db, 'sort').includes('mot_cle_id')) {
    for (const p of db.prepare('SELECT s.mot_cle_id, m.nom FROM sort s JOIN magie m ON m.id = s.magie_id WHERE s.mot_cle_id IS NOT NULL').all()) {
      const m = parId.get(p.mot_cle_id);
      if (m) m.parent = p.nom;
    }
  }
  if (elements) {
    for (const [id, [premier]] of lireLesElements(db, s, (motCle) => parId.get(motCle)?.libelle)) {
      const m = parId.get(id);
      if (m && premier) m.element = { table: premier.table, id: premier.id, adresse: premier.adresse, texte: premier.texte };
    }
  }
  return [...parId.values()];
}

/**
 * Un mot-clé, lu seul : { id, cle, verrou, monnaie_id, libelle, url, description, couleur, icone, element: { table: 'page' | 'sort' | 'repere', id } }, ou
 * null s'il n'existe pas. `libelle`, `url`, `description`, `couleur` et `icone` sont ceux de son élément (les mêmes valeurs que motsClesDeLaBase) ;
 * `element.id` : l'identifiant de la page ou du sort, ou le mot_cle_id du repère. `element` est null pour un mot-clé qui n'a ni page, ni sort, ni
 * repère : une base incohérente depuis la migration 0136 (db:check le refuse ; son libellé est alors sa clé), ou une base à l'ancienne structure, dont
 * les cinq champs se lisent dans les colonnes du mot-clé et où un mot-clé sans page ni sort n'a d'élément que si son repère est déjà posé.
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {number} id
 */
export function lireUnMotCle(db, id) {
  const s = structureDe(db);
  if (!s.motCle) return null;
  const anciennes = s.ancienne ? `, libelle, ${['url', 'description', 'couleur', 'icone'].map((c) => colonneDuMotCle(s, c)).join(', ')}` : '';
  const l = db.prepare(`SELECT id, ${cleDuMotCle(s)}, ${colonneDuMotCle(s, 'verrou', '0')}, ${colonneDuMotCle(s, 'monnaie_id')}${anciennes} FROM mot_cle WHERE id = ?`).get(id);
  if (!l) return null;
  const e = champsDeLElement(db, s, l.id);
  const lu = s.ancienne ? l : e ?? { libelle: l.cle };
  return {
    id: l.id, cle: l.cle, verrou: l.verrou, monnaie_id: l.monnaie_id,
    libelle: lu.libelle, url: lu.url ?? null, description: lu.description ?? null, couleur: lu.couleur ?? null, icone: lu.icone ?? null,
    element: e ? e.element : null,
  };
}

/** L'élément du mot-clé `id` : { table: 'page' | 'sort' | 'repere', id } (celui de lireUnMotCle), ou null (mot-clé absent, ou sans élément). */
export function elementDuMotCle(db, id) {
  const s = structureDe(db);
  return s.motCle ? (champsDeLElement(db, s, id)?.element ?? null) : null;
}

/**
 * La page où mène l'adresse de chaque mot-clé qui en a une (la colonne Lien du tableau du Glossaire, décision R234 (2), réponse T5 : « le titre de la
 * page ») : Map(id du mot-clé → { page, titre }, ou null quand l'adresse ne mène à aucune page de la base : une rubrique, une route sans page, que le
 * Glossaire montre telle quelle) ; lib/adresses-db.mjs#pageDeLAdresse (ancre comprise, sinon le chemin ; pages d'exemple exclues). `motsCles` : ceux
 * de motsClesDeLaBase par défaut.
 * @param {import('node:sqlite').DatabaseSync} db
 */
export function pagesDesLiens(db, motsCles = motsClesDeLaBase(db)) {
  const sortie = new Map();
  const avecAdresse = [...motsCles].filter((m) => typeof m.url === 'string' && m.url);
  if (!avecAdresse.length) return sortie;
  const index = indexDesAdresses(db);
  const titres = tableExiste(db, 'page') ? new Map(db.prepare('SELECT id, titre FROM page').all().map((p) => [p.id, p.titre])) : new Map();
  for (const m of avecAdresse) {
    const page = pageDeLAdresse(index, m.url);
    sortie.set(m.id, page && titres.has(page) ? { page, titre: titres.get(page) } : null);
  }
  return sortie;
}

/**
 * Les éléments auxquels chaque mot-clé renvoie (décision R309, migration 0131) : Map(id du mot-clé → [{ table, id, nom, adresse, texte }]), dans l'ordre
 * page, sort, type de sort, magie, type de dégâts, monnaie. `texte` : le résumé d'une page, les effets d'un sort, sinon null. Un type de sort et un type
 * de dégâts n'ont pas de nom à eux : celui de leur mot-clé. Une table ou une colonne absente (base d'avant la migration) ne donne aucun élément. Le
 * repère n'en est pas un : il tient lieu d'élément au mot-clé qui n'en a pas (lireUnMotCle, elementDuMotCle).
 * @param {import('node:sqlite').DatabaseSync} db
 */
export function elementsDesMotsCles(db) {
  const s = structureDe(db);
  if (!s.motCle) return new Map();
  let noms; // le nom de chaque mot-clé, lu seulement si un type de sort ou de dégâts le demande
  return lireLesElements(db, s, (id) => (noms ??= nomsDesMotsCles(db, s)).get(id));
}

/** Le nom de chaque mot-clé : Map(id → libellé), sa colonne avant la migration 0136, celui de son élément depuis (sa clé, sans élément). */
function nomsDesMotsCles(db, s) {
  if (s.ancienne) return new Map(db.prepare('SELECT id, libelle FROM mot_cle').all().map((m) => [m.id, m.libelle]));
  const champs = champsDesElements(db, s);
  return new Map(db.prepare(`SELECT id, ${cleDuMotCle(s)} FROM mot_cle`).all().map((m) => [m.id, champs.get(m.id)?.libelle ?? m.cle]));
}

/** elementsDesMotsCles, `nomDe` donnant le nom du mot-clé `id` (undefined : le mot-clé n'existe pas, son type de sort ou de dégâts est ignoré). */
function lireLesElements(db, s, nomDe) {
  const sortie = new Map();
  const ajouter = (table, sql, element) => {
    if (!tableExiste(db, table) || !colonnesDe(db, table).includes(table === 'monnaie' ? 'id' : 'mot_cle_id')) return;
    for (const l of db.prepare(sql).all()) (sortie.get(l.mot_cle_id) ?? sortie.set(l.mot_cle_id, []).get(l.mot_cle_id)).push({ table, id: l.id, nom: l.nom, ...element(l) });
  };
  const sansTexte = { adresse: null, texte: null };
  // le texte : une colonne que la base n'a pas (base d'essai réduite à ce que son test lit) n'en donne pas
  const texteDe = (table, colonne) => (tableExiste(db, table) && colonnesDe(db, table).includes(colonne) ? colonne : 'NULL');
  // l'adresse d'aujourd'hui : le segment renommé de la page (d'un sort : celui de sa magie) lu en base (R316)
  const segments = slugsDAdresse(db);
  const adresseDe = (id) => adresseDeLaPage(id, segments.get(id) ?? null);
  ajouter('page', `SELECT id, mot_cle_id, titre AS nom, ${texteDe('page', 'resume')} AS resume FROM page WHERE mot_cle_id IS NOT NULL ORDER BY id`, (l) => ({ adresse: adresseDe(l.id), texte: l.resume ?? null }));
  ajouter('sort', `SELECT id, mot_cle_id, nom, ${texteDe('sort', 'effets')} AS effets FROM sort WHERE mot_cle_id IS NOT NULL ORDER BY id`,
    (l) => ({ adresse: adresseDuSort(l.id, segments.get(String(l.id).split('#sort:')[0]) ?? null), texte: l.effets ?? null }));
  // un type de sort ou de dégâts porte le nom de son mot-clé (celui de son élément depuis la migration 0136)
  const typesNommes = (table) => {
    if (!tableExiste(db, table) || !colonnesDe(db, table).includes('mot_cle_id')) return;
    for (const l of db.prepare(`SELECT id, mot_cle_id FROM ${table} WHERE mot_cle_id IS NOT NULL ORDER BY id`).all()) {
      const nom = nomDe(l.mot_cle_id);
      if (nom === undefined) continue;
      (sortie.get(l.mot_cle_id) ?? sortie.set(l.mot_cle_id, []).get(l.mot_cle_id)).push({ table, id: l.id, nom, ...sansTexte });
    }
  };
  typesNommes('type_sort');
  ajouter('magie', 'SELECT id, mot_cle_id, nom FROM magie WHERE mot_cle_id IS NOT NULL ORDER BY id', (l) => ({ adresse: adresseDe(l.id), texte: null }));
  typesNommes('type_degats');
  if (s.motCle.includes('monnaie_id')) {
    ajouter('monnaie', 'SELECT n.id, m.id AS mot_cle_id, n.nom FROM mot_cle m JOIN monnaie n ON n.id = m.monnaie_id ORDER BY n.id', () => sansTexte);
  }
  return sortie;
}

function lire(db) {
  if (caches.has(db)) return caches.get(db);
  const vocabulaire = motsClesDeLaBase(db).sort(parLibelle);
  const lu = { vocabulaire, pret: vocabulaireDesMotsCles(vocabulaire) };
  caches.set(db, lu);
  return lu;
}

/**
 * Le vocabulaire (motsClesDeLaBase), trié par libellé ; vide pour une base sans table mot_cle (antérieure à la migration 0043). Lu une fois par base
 * (la base construite : pages, middleware).
 */
export const chargerVocabulaire = (db) => lire(db).vocabulaire;

/**
 * L'id du mot-clé qu'une écriture du `tags:` d'une page désigne (sa clé, son libellé quand un seul mot-clé le porte, un synonyme, une clé quittée :
 * lib/mots-cles-balises.mjs#motCleDeLaRef, l'ordre de tools/db/maverick.py#trouver_mot_cle), ou null (inconnue, ou libellé ambigu).
 */
export function idDuMotCle(db, ecriture) {
  return motCleDeLaRef(lire(db).pret, String(ecriture ?? ''))?.id ?? null;
}

/**
 * Les colonnes de texte de la base où une balise du glossaire peut s'écrire : toutes les colonnes TEXT des tables de règles et des pages (sections 1 à
 * 10 et 12 de data/schema.sql), sauf (lib/tables-de-la-base.mjs, la seule source) les tables hors des règles (sections 13 à 15 : fiches, journal, notes de
 * version), les tables dérivées (section 11 : `lien.ancre` reprend le texte d'un lien du Markdown, que le build recalcule), les traces gardées telles
 * quelles (notes de cellule, écarts, corrections, commentaires orphelins, alias, sources) et les tables de recherche plein texte (FTS5 et leurs tables
 * internes) : ce que db:check contrôle et que le rejeu du journal réécrit. Le repère d'un mot-clé (`repere`) et la définition d'une page
 * (`page.definition`) en sont depuis la migration 0136, comme l'étaient les colonnes du mot-clé. Rend [{ table, colonne, cle (colonnes de la clé primaire, ou rowid), markdown
 * (lib/edition-modele.mjs#typeDeTexte : un texte mis en forme) }], dans l'ordre des tables.
 * @param {import('node:sqlite').DatabaseSync} db
 */
export function textesDeLaBase(db) {
  // lue une fois par structure de la base (`schema_version` change à chaque CREATE, ALTER ou DROP) : le contrôle du contenu la relit à chaque essai,
  // application et annulation d'un lot ; chaque appel reçoit sa copie
  const version = db.prepare('PRAGMA schema_version').get().schema_version;
  let memo = textesParBase.get(db);
  if (memo?.version !== version) {
    memo = { version, sortie: lireLesTextesDeLaBase(db) };
    textesParBase.set(db, memo);
  }
  return memo.sortie.map((t) => ({ ...t, cle: [...t.cle] }));
}
const textesParBase = new WeakMap(); // db -> { version, sortie }

function lireLesTextesDeLaBase(db) {
  const exclues = new Set([...TABLES_HORS_REGLES, ...TABLES_DERIVEES, ...TRACES_TELLES_QUELLES]);
  const tables = db.prepare("SELECT name, sql FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all();
  const virtuelles = tables.filter((t) => /^\s*CREATE\s+VIRTUAL\s+TABLE/i.test(t.sql ?? '')).map((t) => t.name);
  const sortie = [];
  for (const { name: table } of tables) {
    if (exclues.has(table) || virtuelles.some((v) => table === v || table.startsWith(`${v}_`))) continue;
    const colonnes = db.prepare(`PRAGMA table_info("${table}")`).all();
    const pk = colonnes.filter((c) => c.pk).sort((a, b) => a.pk - b.pk).map((c) => c.name);
    for (const c of colonnes) {
      if (!/TEXT/i.test(c.type)) continue;
      sortie.push({ table, colonne: c.name, cle: pk.length ? pk : ['rowid'], markdown: typeDeTexte(table, c.name) === 'markdown' });
    }
  }
  return sortie;
}
