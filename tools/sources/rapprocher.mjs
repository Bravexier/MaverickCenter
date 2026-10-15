// Rapprochement d'un classeur Google Sheets et de la base, dans les deux sens (demande du propriétaire, 2026-10-15 : « m'assurer que toutes les sources
// des classeurs ont été correctement intégrées dans des tables dans tous les sens » ; décision R81 ; docs/sources.md, « Rapprochement d'un classeur »).
//
//   node --no-warnings tools/sources/rapprocher.mjs --classeur "Classe Maverick V7" --dump sources/raw/classeurs/classe-maverick-v7.json \
//        [--base var/maverick.db] [--registre tools/sources/ignorer/classe-maverick-v7.json] [--sortie <rapport.md>] [--json] [--exemples 20]
//
// Le dump est le JSON uniforme de tools/sheets/xlsx_to_json.py (ou sheets_api_to_json.py) : { sheets: [{ name, cells: [{ r, c, v, note?, threads? }] }] }.
// La base est lue dans son ÉTAT D'IMPORT (lib/historique-site.mjs#lignesDImport) : une ligne que le site de dev a supprimée compte encore, une ligne qu'il a
// créée ne compte pas, une colonne qu'il a modifiée vaut sa valeur d'import (le site est la source de ce qu'il modifie : ce n'est pas un écart).
// 1. Base -> classeur : chaque ligne typée cite ses cellules (`source_ref` « Classeur › Onglet › A1:B2[, C3:D4] [; Classeur › Onglet › …] ») ; l'onglet et
//    les cellules doivent exister, et chacun de ses textes et nombres doit s'y lire, une fois défaites les corrections d'orthographe des migrations
//    (registres data/migrations/0003, 0005, 0006, par ligne, et ceux de la page de la ligne quand elle en a été tirée : la base corrige, le classeur garde
//    la faute), les écarts voulus du registre (`voulus`) et appliqué tools/sheets/corrections.json. Une ligne qui cite aussi un autre classeur se lit dans
//    les cellules des deux (instantanés de sources/raw/classeurs/registre.json) ; si l'autre source n'a pas d'instantané (un Google Doc), ce qui ne se lit
//    pas est « à relire » (listé, pas compté).
// 2. Classeur -> base : chaque cellule non vide est citée par au moins une ligne, ou rangée dans le registre (`regles`) avec sa raison ; et chaque mot
//    d'une cellule citée se lit dans les valeurs des lignes qui la citent (sinon le classeur dit quelque chose que la base n'a pas), sauf les libellés de
//    mise en page déclarés (`libelles`). Limite : deux nombres permutés entre deux cellules d'une même ligne ne se voient pas ici (les tests des découpages
//    rapprochent chaque colonne de sa cellule).
// 3. Notes et fils de commentaires : les mêmes dans le classeur et dans `note_cellule` (état d'import).
// Une colonne modifiée par le site ET dont la cellule a changé dans le classeur est un CONFLIT : présenté avec les deux valeurs, jamais tranché ici ; la
// décision du propriétaire s'inscrit dans le registre (`conflits`). Le rapport range les écarts ; il ne corrige rien et ne déduit rien. Les valeurs du
// classeur sont des données : jamais exécutées.
// L'onglet « première feuille » (nom que l'import des races donne au premier onglet du classeur, tools/sheets/races.py#INDEX_TAB) est le premier onglet
// du dump.
//
// Registre d'un classeur (`--registre`, tools/sources/ignorer/<classeur>.json) :
//   regles    [{ onglets: ["*"] | [noms], plages?: ["A1:B2"], valeurs?: "regex", raison }]  cellules qu'aucune ligne ne cite, et pourquoi ;
//   derivees  { "table.colonne": "raison, et le test qui la garantit" }                     colonnes que l'import calcule au lieu de les recopier ;
//   libelles  [{ mots?: "regex d'un mot", valeurs?: "regex de la cellule", onglets?, plages?, raison }]  libellés de mise en page d'une cellule citée :
//             les mots qui répondent à `mots` (tous si `mots` manque) d'une cellule dont la valeur répond à `valeurs` (« ^Lvl \d+$ » : « Lvl » seul) ;
//   voulus    [{ table, cle: { … }, colonne, avant, apres, raison }]                       écarts voulus hors des registres d'orthographe (décision R…,
//             migration de données) : `avant` est l'écriture du classeur, `apres` celle de la base ;
//   conflits  [{ table, cle, colonne, garder: "site" | "classeur", valeur_classeur, decide_le, raison }]  décisions du propriétaire ;
//   commentaires [{ onglet, cellule, texte, raison }]                                      commentaires du classeur que l'import écarte (un message de
//             conversation : tools/sheets/magies.py#EXCLUDED_COMMENTS).
import { DatabaseSync } from 'node:sqlite';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { historiqueSite } from '../../client/src/lib/historique-site.mjs';

const RACINE = resolve(fileURLToPath(new URL('../../', import.meta.url)));
const REGISTRE_DES_CLASSEURS = resolve(RACINE, 'sources', 'raw', 'classeurs', 'registre.json');

// ---------------------------------------------------------------------------------------------------------------------------------------------------
// Fonctions pures (exportées pour les tests)
// ---------------------------------------------------------------------------------------------------------------------------------------------------

/** « AB12 » -> { r: 12, c: 28 } ; null si ce n'est pas une adresse. */
export function adresse(a1) {
  const m = /^\$?([A-Z]{1,3})\$?([1-9][0-9]*)$/.exec(String(a1).trim());
  if (!m) return null;
  return { r: Number(m[2]), c: [...m[1]].reduce((n, l) => n * 26 + l.charCodeAt(0) - 64, 0) };
}

/** { r: 12, c: 28 } -> « AB12 ». */
export function enA1({ r, c }) {
  let s = '';
  for (let n = c; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return `${s}${r}`;
}

/** « A1:C3 » ou « B7 » -> { r1, c1, r2, c2 } ; null si illisible. */
export function plage(texte) {
  const [d, f] = String(texte).trim().split(':');
  const a = adresse(d), b = adresse(f ?? d);
  if (!a || !b) return null;
  return { r1: Math.min(a.r, b.r), c1: Math.min(a.c, b.c), r2: Math.max(a.r, b.r), c2: Math.max(a.c, b.c) };
}

/** Une plage écrite en tête d'un jeton (« S5 (liste déroulante) », « G309:R318 (texte retenu) ») ; null si le jeton n'en commence pas par une. */
const plageEnTete = (jeton) => {
  const m = /^\$?[A-Z]{1,3}\$?[1-9][0-9]*(?::\$?[A-Z]{1,3}\$?[1-9][0-9]*)?(?=$|[\s(])/.exec(String(jeton).trim());
  return m ? plage(m[0]) : null;
};

/** Clé de comparaison d'un nom d'onglet ou de classeur : sans accents, casse ni ponctuation (« Altération d'états » = « Altération détats »). */
export const cleDeNom = (s) => String(s).normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, '');

/**
 * Les citations d'un `source_ref` : [{ classeur, onglet, plages: [{ r1, c1, r2, c2, texte }], illisibles: [jetons] }]. Formes lues :
 *   « Classeur › Onglet › A1:B2, C3 ; Classeur › Onglet2 › D4 »  (une citation par segment, plages séparées par « , » ou « ; ») ;
 *   « … › S5 (liste déroulante) »                                   (la plage en tête du jeton) ;
 *   « Google Sheet « … », onglet « … » »                            (citation d'un onglet entier, celle des pages : `plages: []`, `onglet` seul).
 * Un jeton qui n'est pas une plage est rendu dans `illisibles` : le rapprochement le compte comme un écart, jamais en silence.
 */
export function citations(sourceRef) {
  if (!sourceRef) return [];
  const res = [];
  const page = /Google Sheet « ([^»]+) »(?:, onglet « ([^»]+) »)?/g;
  for (const m of String(sourceRef).matchAll(page)) res.push({ classeur: m[1].trim(), onglet: m[2]?.trim() ?? null, plages: [], illisibles: [], page: true });
  if (res.length) return res;
  for (const segment of String(sourceRef).split(/\s*;\s*(?=[^;›]+›)/)) {
    const parts = segment.split('›').map((x) => x.trim());
    if (parts.length < 2) continue;
    const [classeur, onglet, ...reste] = parts;
    const plages = [];
    const illisibles = [];
    // Une annotation entre parenthèses (« S5 (liste déroulante, rang 24) ») ou « décision R54 » n'est pas une plage : retirée avant le découpage.
    const texte = reste.join('›').replace(/\([^()]*\)/g, ' ');
    for (const jeton of texte.split(/[,;]/).map((x) => x.trim()).filter((x) => x && !/^décision R\d+/i.test(x))) {
      const p = plage(jeton) ?? plageEnTete(jeton);
      if (p) plages.push({ ...p, texte: jeton });
      else illisibles.push(jeton);
    }
    res.push({ classeur, onglet, plages, illisibles });
  }
  return res;
}

/** Texte comparable : NFC, blancs (espaces insécables compris, `\s`) ramenés à une espace, apostrophe typographique ramenée à « ' ». */
export const comparable = (s) => String(s ?? '').normalize('NFC').replace(/[’ʼ]/g, "'").replace(/\s+/g, ' ').trim();

/** Les mots d'un texte, pour le contrôle inverse : lettres et chiffres, en minuscules. */
export const mots = (s) => comparable(s).toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];

/**
 * Les morceaux d'une valeur de la base à retrouver dans ses cellules : une valeur faite de plusieurs cellules est écrite ligne à ligne (« - 1 maîtrise… »)
 * ou en chemin (« Sang › Niveau 1 » : l'en-tête, puis la ligne).
 */
export function morceaux(valeur) {
  return String(valeur).split(/\n+| › /).map((l) => comparable(l.replace(/^\s*(?:[-•*]|\d+[.)])\s+/, ''))).filter((l) => l.length >= 2);
}

/** Les feuilles d'une valeur JSON (objet ou tableau, colonne `donnees`) : ses textes et ses nombres, sans les clés ; null si la valeur n'en est pas une. */
export function feuillesJson(valeur) {
  const s = String(valeur).trim();
  if (!/^[[{]/.test(s)) return null;
  let v;
  try { v = JSON.parse(s); } catch { return null; }
  const textes = [];
  const nombres = [];
  const parcourir = (x) => {
    if (typeof x === 'string') textes.push(x);
    else if (typeof x === 'number') nombres.push(x);
    else if (x && typeof x === 'object') for (const y of Object.values(x)) parcourir(y);
  };
  parcourir(v);
  return { textes, nombres };
}

const LETTRE = /[\p{L}\p{N}]/u;

/** Les occurrences de `de` dans `v` qui ne coupent pas un mot (quand `de` commence ou finit par une lettre) : [début, fin]. */
function occurrences(v, de) {
  const res = [];
  if (!de) return res;
  const bordDebut = LETTRE.test(de[0]);
  const bordFin = LETTRE.test(de.at(-1));
  for (let j = v.indexOf(de); j >= 0; j = v.indexOf(de, j + 1)) {
    const dansUnMot = (bordDebut && j > 0 && LETTRE.test(v[j - 1])) || (bordFin && j + de.length < v.length && LETTRE.test(v[j + de.length]));
    if (!dansUnMot) res.push([j, j + de.length]);
  }
  return res;
}

/**
 * Remplace dans `v` chaque `de` par son `vers` (paires [de, vers]), toutes cherchées dans le texte d'origine, jamais l'une dans le résultat d'une autre :
 *   - la plus longue d'abord, et une occurrence déjà prise par une autre n'est pas retouchée (« araignée » -> « araignées », corrigé dans une autre
 *     ligne, ne défait pas « race méleant araignée » -> « race mêlant araignée ») ;
 *   - jamais au milieu d'un mot (« ect » -> « etc » ne touche pas « secte ») ;
 *   - jamais dans une écriture déjà corrigée (« mineur » -> « mineure » ne fait pas « mineuree » d'un texte qui écrit déjà « mineure »).
 */
function appliquer(v, paires) {
  const prises = [];
  const chevauche = (a, b) => prises.some(([x, y]) => a < y && b > x);
  const uniques = [...new Map(paires.filter(([de]) => de).map((p) => [JSON.stringify(p), p])).values()].sort((a, b) => b[0].length - a[0].length);
  const deja = [];
  for (const [de, vers] of uniques) if (vers && vers.includes(de)) deja.push(...occurrences(v, vers));
  for (const [de, vers] of uniques) {
    for (const [a, b] of occurrences(v, de)) {
      if (chevauche(a, b) || deja.some(([x, y]) => a >= x && b <= y)) continue;
      prises.push([a, b, vers]);
    }
  }
  prises.sort((p, q) => p[0] - q[0]);
  let res = '';
  let pos = 0;
  for (const [a, b, vers] of prises) { res += v.slice(pos, a) + vers; pos = b; }
  return res + v.slice(pos);
}

/** Remplace `de` par `vers` dans `v` (voir `appliquer`). */
export const remplacer = (v, de, vers) => appliquer(String(v), [[de, vers]]);

/** Applique des paires l'une après l'autre, dans l'ordre des migrations (deux corrections d'une même ligne peuvent se chevaucher : 0005 puis 0006). */
const enSuite = (v, paires) => [...new Map(paires.map((p) => [JSON.stringify(p), p])).values()].reduce((t, [de, vers]) => remplacer(t, de, vers), v);

/** Les corrections d'une liste, écrites comme un texte comparable (blancs ramenés à une espace), pour un texte comparable. */
const enComparable = (corrections) => corrections.map((c) => ({ avant: comparable(c.avant), apres: comparable(c.apres) }));

/**
 * Applique à un texte du classeur les corrections d'orthographe (`avant` devient `apres`) : l'autre sens du rapprochement. `propres` (celles de la ligne,
 * dans l'ordre des migrations) l'une après l'autre ; `heritees` (celles d'une autre ligne, du texte dont celle-ci a été tirée) ensuite, sans chevauchement.
 */
export const avecCorrections = (texte, propres, heritees = []) => appliquer(enSuite(String(texte), propres.map((c) => [c.avant, c.apres])), heritees.map((c) => [c.avant, c.apres]));

/** Défait, dans une valeur de la base, les corrections d'orthographe (`apres` redevient `avant`) : l'inverse de `avecCorrections`. */
export const sansCorrections = (valeur, propres, heritees = []) => enSuite(appliquer(String(valeur), heritees.map((c) => [c.apres, c.avant])), [...propres].reverse().map((c) => [c.apres, c.avant]));

/**
 * « 1 000 » se lit 1000 (et aussi 1 et 0) ; « 2,5 » se lit 2.5 ; « -5 » se lit -5 ; une plage « 4-18 », « 1% -5% » se lit 4 et 18, 1 et 5 (le tiret qui
 * suit un nombre est un trait d'intervalle : la borne se lit aussi sans signe).
 */
export function nombresDe(texte) {
  const t = comparable(texte).replace(/[–−](?=\d)/g, '-');   // tiret demi-cadratin, signe moins typographique
  const lus = [];
  for (const m of t.matchAll(/(?<!\d)-?\d+(?:[.,]\d+)?/g)) {
    lus.push(m[0]);
    if (m[0].startsWith('-') && /[\d%]\s*$/.test(t.slice(0, m.index))) lus.push(m[0].slice(1));
  }
  lus.push(...(t.match(/\d{1,3}(?: \d{3})+(?:[.,]\d+)?/g) ?? []).map((n) => n.replace(/ /g, '')));
  return new Set(lus.map((n) => Number(n.replace(',', '.'))));
}

// ---------------------------------------------------------------------------------------------------------------------------------------------------
// Rapprochement
// ---------------------------------------------------------------------------------------------------------------------------------------------------

// Registres de corrections des migrations (0003, 0005, 0006…) : tout data/migrations/*.json dont `corrections` est une liste { table, col, avant, apres }.
const registresDOrthographe = () => readdirSync(resolve(RACINE, 'data', 'migrations')).filter((f) => f.endsWith('.json')).sort()
  .map((f) => JSON.parse(readFileSync(resolve(RACINE, 'data', 'migrations', f), 'utf8')).corrections)
  .filter((cs) => Array.isArray(cs) && cs.length && cs.every((c) => c.table && c.col && typeof c.avant === 'string' && typeof c.apres === 'string'));
// Colonnes jamais comparées : clés, provenance (et jamais dans le vocabulaire d'une ligne).
const EXCLUES = /^(id|cle|slug|origine|source_ref|page_id|empreinte)$|_id$|_cle$/;
// Tables qui décrivent la source sans en recopier une cellule (un écart entre sources, une correction, un fil de commentaires sans cellule) : leurs
// cellules comptent pour la couverture, pas leur texte (les fils de `commentaire_orphelin` sont rapprochés avec les notes).
const META = new Set(['ecart_source', 'correction', 'commentaire_orphelin']);
// Colonnes d'une table cible qui nomment sa ligne : une clé étrangère entre dans le vocabulaire d'une ligne par ces libellés, jamais par son identifiant.
const LIBELLES_DE_CIBLE = /^(nom|nom_court|nom_brut|libelle|libelle_brut|titre)$/;
// Nombres comparés : une valeur lue dans le texte (« Lvl 5 », « 2 fois/Combat ») ; pas une position.
const POSITIONS = /^(rang|ligne|ordre|option|position|occurrence|numero|n|niveau_min)$|_rang$|^ordre_/;
// Nom que tools/sheets/races.py (INDEX_TAB) donne au premier onglet du classeur « Les races » (son « Sommaire »).
const PREMIERE_FEUILLE = cleDeNom('première feuille');

/** La formule d'une cellule, lisible : sans l'enveloppe IFERROR(__xludf.DUMMYFUNCTION("…"), …) qu'ajoute l'export d'une fonction propre à Google. */
export function formuleLisible(f) {
  const m = /__xludf\.DUMMYFUNCTION\("((?:[^"]|"")*)"\)/s.exec(String(f ?? ''));
  return m ? m[1].replaceAll('""', '"') : String(f ?? '');
}
const sansBlancs = (s) => String(s).replace(/\s+/g, '');
const commentairesDe = (x) => [...(x.note ? [x.note] : []), ...(x.threads ?? []).flatMap((f) => [f.text, ...(f.replies ?? [])])].filter(Boolean);
const valeur = (x) => (x?.v === undefined || x?.v === null ? '' : comparable(x.v) === '' ? '' : String(x.v));   // espaces seuls = vide
const dans = (x, p) => x.r >= p.r1 && x.r <= p.r2 && x.c >= p.c1 && x.c <= p.c2;
const cellulesDe = (o, p) => {
  const res = [];
  for (let r = p.r1; r <= p.r2; r += 1) for (let c = p.c1; c <= p.c2; c += 1) { const x = o.cellules.get(`${r}:${c}`); if (x) res.push(x); }
  return res;
};

/** Un classeur lu : ses onglets (cellules par adresse), le registre des corrections des dumps appliqué à une copie, et la recherche d'un onglet cité. */
function classeurLu(dumpLu, titre, lignesDeCorrection) {
  const dump = structuredClone(dumpLu);
  const onglets = new Map();
  for (const s of dump.sheets) {
    const k = cleDeNom(s.name);
    if (onglets.has(k)) throw new Error(`${titre} : deux onglets se confondent : « ${onglets.get(k).nom} » et « ${s.name} »`);
    const cellules = new Map();
    for (const x of s.cells) cellules.set(`${x.r}:${x.c}`, x);
    // Listes de validation (liste déroulante) : leurs choix écrits (« "1d,2d,3d" ») sont un texte des cellules qu'elles couvrent ; une liste tirée d'une
    // plage (« BDD!$A$2:$A972 ») n'en ajoute pas (ses cellules sont rapprochées là où elles sont).
    const validations = (s.validations ?? []).filter((v) => v.type === 'list' && /^".*"$/s.test(v.formula1 ?? ''))
      .map((v) => ({ plages: String(v.range).split(/\s+/).map(plage).filter(Boolean), textes: v.formula1.slice(1, -1).split(',').map((t) => t.trim()).filter(Boolean) }));
    onglets.set(k, { nom: s.name, cellules, validations, citees: new Map(), ignorees: new Map() });
  }
  // Registre des corrections des dumps (tools/sheets/corrections.json, recopié dans la table `correction`) : appliqué au classeur avant tout.
  let corrigees = 0;
  for (const c of lignesDeCorrection) {
    if (cleDeNom(c.classeur) !== cleDeNom(titre)) continue;
    const o = onglets.get(cleDeNom(c.onglet));
    const a = adresse(c.cellule);
    const x = o && a ? o.cellules.get(`${a.r}:${a.c}`) : null;
    const champ = c.champ === 'note' ? 'note' : 'v';
    if (x && typeof x[champ] === 'string' && x[champ].includes(c.avant)) { x[champ] = x[champ].split(c.avant).join(c.apres); corrigees += 1; }
  }
  const premier = dump.sheets.length ? onglets.get(cleDeNom(dump.sheets[0].name)) : undefined;
  const onglet = (nom) => onglets.get(cleDeNom(nom)) ?? (cleDeNom(nom) === PREMIERE_FEUILLE ? premier : undefined);
  return { onglets, corrigees, onglet };
}

/**
 * Rapproche un classeur (son dump) et la base ouverte `db` ; rend le relevé des écarts (voir l'en-tête). `autres` : { titre: dump } des autres classeurs,
 * pour les lignes qui en citent plusieurs. Les dumps ne sont pas modifiés.
 */
export function rapprocher(db, {
  classeur, dump, nomDuDump = '', regles = [], derivees = {}, libelles = [], voulus = [], conflits = [], commentaires = [], autres = {},
}) {
  const h = historiqueSite(db);
  const cle = cleDeNom(classeur);
  const cleK = (table, cleLigne, col) => `${table}|${JSON.stringify(cleLigne)}|${col}`;
  const lignesDeCorrection = db.prepare('SELECT classeur, onglet, cellule, champ, avant, apres FROM correction').all();
  const ce = classeurLu(dump, classeur, lignesDeCorrection);
  const { onglets } = ce;
  const autresLus = new Map(Object.entries(autres).filter(([t]) => cleDeNom(t) !== cle).map(([t, d]) => [cleDeNom(t), classeurLu(d, t, lignesDeCorrection)]));

  // Registres d'orthographe des migrations et écarts voulus du registre : par (table, clé, colonne). 0003 écrit la clé d'une table sans colonne `id`
  // (clé primaire double) sous la forme « <clé 1>#[mot:]<clé 2> » (« bestiaire/executeur-lunaire#1 », « magies/magie-du-sang#role:1 »).
  const clesPrimaires = new Map();
  const pkDe = (table) => {
    if (!clesPrimaires.has(table)) clesPrimaires.set(table, db.prepare(`PRAGMA table_info("${table}")`).all().filter((c) => c.pk).sort((a, b) => a.pk - b.pk).map((c) => c.name));
    return clesPrimaires.get(table);
  };
  const cleDeCorrection = (c) => {
    if (c.cle) { const pk = pkDe(c.table); return pk.length && pk.every((k) => k in c.cle) ? Object.fromEntries(pk.map((k) => [k, c.cle[k]])) : c.cle; }
    const pk = pkDe(c.table);
    const m = /^(.*)#(?:[a-z_]+:)?(\d+)$/.exec(c.id ?? '');
    if (pk.length === 2 && !pk.includes('id') && m) return { [pk[0]]: m[1], [pk[1]]: Number(m[2]) };
    return { id: c.id };
  };
  const corrections = new Map();
  const correctionsDeLigne = new Map();
  const correctionsDePage = new Map();
  const ajouter = (m, k, c) => { if (!m.has(k)) m.set(k, []); m.get(k).push(c); };
  const inscrire = (c, colonne) => {
    const cleLigne = cleDeCorrection(c);
    ajouter(corrections, cleK(c.table, cleLigne, colonne), c);
    ajouter(correctionsDeLigne, cleK(c.table, cleLigne, ''), c);
    if (c.table === 'page') ajouter(correctionsDePage, cleLigne.id, c);
  };
  for (const cs of registresDOrthographe()) for (const c of cs) inscrire(c, c.col);
  for (const v of voulus) inscrire(v, v.colonne);
  // Identifiants des documents Google remplacés par ceux des copies (migration 0014, registre `copies` : avant -> apres) : un lien du classeur original
  // vers un autre document, recopié dans la base, cite la copie.
  const chemin0014 = resolve(RACINE, 'data', 'migrations', '0014-sources-copies-drive.json');
  const copies = existsSync(chemin0014) ? (JSON.parse(readFileSync(chemin0014, 'utf8')).copies ?? []).filter((c) => c.avant && c.apres) : [];
  // Corrections héritées : une ligne tirée d'un texte déjà corrigé porte les corrections de ce texte (0003.sql a corrigé les notes et extraits d'un sort
  // avec lui, 0004 a lu les NM dans le texte corrigé, les tables de 0007 viennent du Markdown corrigé des pages) : celles des lignes qu'elle cite par
  // clé étrangère, de l'entité d'une note (`entite_table`, `entite_id`), et de sa page (`page_entite`, `page_id`, ou une colonne qui vaut l'identifiant
  // d'une page corrigée : `race_id`).
  const pageDeLEntite = new Map(db.prepare('SELECT entite_table, entite_id, page_id FROM page_entite').all().map((p) => [`${p.entite_table}|${p.entite_id}`, p.page_id]));
  const clesEtrangeres = new Map();
  const etrangeresDe = (table) => {
    if (!clesEtrangeres.has(table)) {
      clesEtrangeres.set(table, db.prepare(`PRAGMA foreign_key_list("${table}")`).all().map((f) => ({ de: f.from, table: f.table, vers: f.to ?? pkDe(f.table)[0] }))
        .filter((f) => f.vers && f.table !== 'famille'));
    }
    return clesEtrangeres.get(table);
  };
  const correctionsHeritees = (table, ligne) => {
    const res = [...copies];
    for (const f of etrangeresDe(table)) if (ligne[f.de] !== null && ligne[f.de] !== undefined) res.push(...(correctionsDeLigne.get(cleK(f.table, { [f.vers]: ligne[f.de] }, '')) ?? []));
    if (ligne.entite_table && ligne.entite_id) res.push(...(correctionsDeLigne.get(cleK(ligne.entite_table, { id: ligne.entite_id }, '')) ?? []));
    if (table !== 'page') {
      const pages = new Set(Object.values(ligne).filter((v) => typeof v === 'string' && correctionsDePage.has(v)));
      if (ligne.id && pageDeLEntite.has(`${table}|${ligne.id}`)) pages.add(pageDeLEntite.get(`${table}|${ligne.id}`));
      for (const p of pages) res.push(...(correctionsDePage.get(p) ?? []));
    }
    return res;
  };
  // Le libellé d'une ligne visée par une clé étrangère (« Évitée » pour `echelle_id` = 'evitee'), pour le vocabulaire.
  const libellesVises = new Map();
  const libellesDe = (table, colonne, v) => {
    const k = `${table}|${colonne}|${v}`;
    if (!libellesVises.has(k)) {
      const cols = db.prepare(`PRAGMA table_info("${table}")`).all().map((c) => c.name).filter((c) => LIBELLES_DE_CIBLE.test(c));
      const l = cols.length ? db.prepare(`SELECT ${cols.map((c) => `"${c}"`).join(', ')} FROM "${table}" WHERE "${colonne}" = ?`).get(v) : null;
      libellesVises.set(k, l ? Object.values(l).filter((x) => x !== null) : []);
    }
    return libellesVises.get(k);
  };
  const derivee = new Set(Object.keys(derivees));
  const decisions = new Map(conflits.map((d) => [cleK(d.table, cleDeCorrection(d), d.colonne), d]));
  const libellesLus = libelles.map((l) => {
    if (!l.mots && !l.valeurs) throw new Error(`libellé sans \`mots\` ni \`valeurs\` : ${JSON.stringify(l)}`);
    return {
      mots: l.mots ? new RegExp(`^(?:${l.mots})$`, 'iu') : null,
      valeurs: l.valeurs ? new RegExp(l.valeurs, 'u') : null,
      onglets: (l.onglets ?? ['*']).map((n) => (n === '*' ? n : cleDeNom(n))),
      plages: (l.plages ?? []).map(plage),
    };
  });
  const libelle = (o, x, mot) => libellesLus.some((l) => l.onglets.some((n) => n === '*' || n === cleDeNom(o.nom))
    && (!l.plages.length || l.plages.some((p) => dans(x, p))) && (!l.valeurs || l.valeurs.test(valeur(x))) && (!l.mots || l.mots.test(mot)));

  const R = {
    classeur, dump: nomDuDump, onglets: dump.sheets.length, cellules: 0, lignes: 0, parTable: {}, citationsDOnglet: 0, corrigees: ce.corrigees,
    autresClasseurs: autresLus.size, voulus: voulus.length,
    sansOnglet: [], sansCellule: [], illisibles: [], ecarts: [], nombres: [], conflits: [], casse: [], aRelire: [], nonCitees: [], motsAbsents: [], ignorees: 0,
    notes: { classeur: 0, declares: 0, manquantes: [], enTrop: [] },
    site: { modifiees: [], supprimees: [], creees: [] },
  };
  for (const o of onglets.values()) R.cellules += [...o.cellules.values()].filter((x) => valeur(x) !== '').length;

  const tables = db.prepare("SELECT name, sql FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND sql NOT LIKE 'CREATE VIRTUAL%' ORDER BY name").all()
    .filter((t) => db.prepare(`PRAGMA table_info("${t.name}")`).all().some((c) => c.name === 'source_ref'));
  const citeCeClasseur = (sourceRef) => citations(sourceRef).filter((x) => cleDeNom(x.classeur) === cle);

  for (const t of tables) {
    const colonnes = db.prepare(`PRAGMA table_info("${t.name}")`).all();
    // Une énumération (`CHECK (x IN (…))`, `CHECK (x IS NULL OR x IN (…))`) est un vocabulaire fermé posé par l'import, pas une écriture de la cellule ;
    // une colonne `*_brut` est toujours comparée (c'est l'écriture de la source).
    const avant = (col) => `CHECK\\s*\\(\\s*(?:"?${col}"?\\s+IS\\s+NULL\\s+OR\\s+)?"?${col}"?\\s+IN\\s*\\(`;
    const enumeree = (col) => !col.endsWith('_brut') && new RegExp(avant(col), 'i').test(t.sql);
    const booleen = (col) => new RegExp(`${avant(col)}\\s*[01]\\s*(?:,\\s*[01]\\s*)?\\)\\s*\\)`, 'i').test(t.sql);   // IN (0, 1), IN (1)
    const compare = (c) => !META.has(t.name) && !derivee.has(`${t.name}.${c.name}`);
    const textes = colonnes.filter((c) => compare(c) && /TEXT/i.test(c.type) && !EXCLUES.test(c.name) && !enumeree(c.name) && !(t.name === 'note_cellule' && c.name !== 'texte'));
    // Une colonne typée qui a sa `*_brut` sœur se contrôle par elle quand elle est remplie (la fidélité typé <-> brut est l'affaire des tests de découpage).
    const parSonBrut = new Set(colonnes.filter((c) => colonnes.some((b) => b.name === `${c.name}_brut`)).map((c) => c.name));
    // Une position : nom de position, ou colonne qu'un CHECK égale au rang (`etat_stade.stade`, tiré de l'en-tête « Stade N »).
    const liee = (col) => new RegExp(`\\b${col}\\s*=\\s*rang\\b|\\brang\\s*=\\s*${col}\\b`).test(t.sql);
    const nombres = colonnes.filter((c) => compare(c) && /INT|REAL/i.test(c.type) && !c.pk && !POSITIONS.test(c.name) && !liee(c.name) && !booleen(c.name));
    const pk = colonnes.filter((c) => c.pk).sort((a, b) => a.pk - b.pk).map((c) => c.name);
    const cleDe = (l) => Object.fromEntries((pk.length ? pk : colonnes.map((c) => c.name)).map((k) => [k, l[k]]));
    const actuelles = new Map(db.prepare(`SELECT * FROM "${t.name}"`).all().map((l) => [JSON.stringify(cleDe(l)), l]));
    const importees = h.lignesDImport(t.name);
    const vues = new Set();

    for (const ligne of importees) {
      const toutes = citations(ligne.source_ref);
      const cites = toutes.filter((x) => cleDeNom(x.classeur) === cle);
      if (!cites.length) continue;
      const cleLigne = cleDe(ligne);
      const cleTexte = JSON.stringify(cleLigne);
      vues.add(cleTexte);
      const ident = `${t.name} ${cleTexte}`;
      if (cites.every((x) => x.page)) { R.citationsDOnglet += 1; continue; }   // une page cite l'onglet entier : pas de contrôle cellule par cellule
      R.parTable[t.name] = (R.parTable[t.name] ?? 0) + 1;
      R.lignes += 1;
      const actuelle = actuelles.get(cleTexte);
      if (!actuelle) R.site.supprimees.push({ ligne: ident });
      // Cellules citées de ce classeur (la couverture), puis celles des autres classeurs que la ligne cite (pour la lire seulement).
      const textesCellules = [];
      const formules = [];
      const cellulesCitees = [];
      const nomsDOnglets = new Set();
      for (const x of cites) {
        if (x.illisibles.length && !META.has(t.name)) R.illisibles.push({ ligne: ident, citation: `${x.onglet} › ${x.illisibles.join(', ')}` });
        if (!x.plages.length) continue;
        const o = ce.onglet(x.onglet);
        if (!o) { R.sansOnglet.push({ ligne: ident, onglet: x.onglet }); continue; }
        nomsDOnglets.add(comparable(x.onglet)).add(comparable(o.nom));
        let n = 0;
        for (const p of x.plages) {
          for (const c of cellulesDe(o, p)) {
            const k = `${c.r}:${c.c}`;
            if (!o.citees.has(k)) o.citees.set(k, []);
            o.citees.get(k).push({ table: t.name, cleLigne, ligne });
            const commentaires = commentairesDe(c);
            if (c.f) formules.push(formuleLisible(c.f));
            if (valeur(c) !== '' || commentaires.length || c.f) { n += 1; textesCellules.push(valeur(c), ...commentaires); cellulesCitees.push(c); }
          }
          // Une saisie vide à liste déroulante (« Personnage › S5 ») : la liste est ce que la cellule dit.
          for (const v of o.validations) {
            if (!v.plages.some((q) => q.r1 <= p.r2 && q.r2 >= p.r1 && q.c1 <= p.c2 && q.c2 >= p.c1)) continue;
            n += 1;
            textesCellules.push(...v.textes);
            cellulesCitees.push(null);
          }
        }
        if (n === 0) R.sansCellule.push({ ligne: ident, citation: `${x.onglet} › ${x.plages.map((p) => p.texte).join(', ')}` });
      }
      const ailleurs = new Set();
      for (const x of toutes) {
        if (x.page || cleDeNom(x.classeur) === cle) continue;
        const o = autresLus.get(cleDeNom(x.classeur))?.onglet(x.onglet);
        if (!o) { ailleurs.add(`${x.classeur} › ${x.onglet}`); continue; }
        for (const p of x.plages) for (const c of cellulesDe(o, p)) textesCellules.push(valeur(c), ...commentairesDe(c));
      }
      if (!cellulesCitees.length) continue;
      const brut = [...textesCellules, ...formules].join('\n');
      const valeursDesCellules = new Set(textesCellules.map(comparable));
      const formulesSansBlancs = sansBlancs(formules.join('\n'));
      const tout = comparable(brut);
      const toutMinuscules = tout.toLowerCase();
      const lus = nombresDe(brut);
      // Un morceau se lit dans les cellules ; ou c'est le nom de l'onglet cité (« Animation des morts », le nom de l'invocation) ; ou c'est un nombre
      // écrit autrement dans une cellule numérique (« 400.0 » pour 400).
      // Une formule se compare sans ses blancs ; l'import écrit une formule « Onglet!A1 =… », une cellule sans formule « <valeur> (constante) ».
      const seLit = (m, texte) => {
        if (texte.includes(m) || nomsDOnglets.has(m) || (/^-?\d+(?:[.,]\d+)?$/.test(m) && lus.has(Number(m.replace(',', '.'))))) return true;
        // Un nom d'onglet tronqué à 31 caractères (« Potentiel illimité (magie diffi ») : la valeur est son début, avant la parenthèse.
        if ([...nomsDOnglets].some((n) => n.toLowerCase().startsWith(`${m.toLowerCase()} (`))) return true;
        const f = /^[^\s!]+![A-Z]{1,3}\d+\s+(=.*)$/s.exec(m)?.[1] ?? /^(.*) \(constante\)$/s.exec(m)?.[1] ?? m;
        return (f !== m && seLit(f, texte)) || (formulesSansBlancs !== '' && formulesSansBlancs.includes(sansBlancs(f)));
      };
      const heritees = correctionsHeritees(t.name, ligne);
      // Un écart d'une ligne qui cite aussi une source sans instantané (un Google Doc) est « à relire » : la valeur peut venir de cette source.
      const signaler = (ecart, liste) => (ailleurs.size ? R.aRelire.push({ ...ecart, ailleurs: [...ailleurs].join(' ; ') }) : liste.push(ecart));

      // Une colonne : la valeur d'import doit se lire dans les cellules (ou, si le propriétaire a tranché un conflit pour le classeur, la valeur actuelle).
      const verifier = (c, lire) => {
        if (parSonBrut.has(c.name) && ligne[`${c.name}_brut`] !== null && ligne[`${c.name}_brut`] !== undefined) return;
        const importee = ligne[c.name];
        const courante = actuelle ? actuelle[c.name] : undefined;
        const modifiee = actuelle && courante !== importee;
        if (modifiee) R.site.modifiees.push({ ligne: ident, colonne: c.name, import: importee, actuelle: courante });
        const d = decisions.get(cleK(t.name, cleLigne, c.name));
        if (d?.garder === 'site') {
          // Le site garde sa valeur : l'écart reste résolu tant que la cellule dit ce que le propriétaire a vu en tranchant.
          if (!tout.includes(comparable(d.valeur_classeur))) R.conflits.push({ ligne: ident, colonne: c.name, classeur: tout.slice(0, 200), base: courante, note: 'la cellule a encore changé depuis la décision' });
          return;
        }
        const attendue = d?.garder === 'classeur' ? courante : importee;
        if (attendue === null || attendue === undefined || attendue === '') return;
        const ecart = lire(attendue);
        if (!ecart) return;
        if (modifiee && !d) R.conflits.push({ ligne: ident, colonne: c.name, classeur: tout.slice(0, 200), import: importee, site: courante });
        else if (!actuelle && !d) R.conflits.push({ ligne: ident, colonne: c.name, classeur: tout.slice(0, 200), import: importee, site: null, note: 'ligne supprimée par le site de dev' });
        else ecart();
      };
      for (const c of textes) {
        verifier(c, (attendue) => {
          const propres = corrections.get(cleK(t.name, cleLigne, c.name)) ?? [];
          // Une valeur d'un caractère (« 0 », « x ») : égale à l'une des cellules (corrections et écarts voulus défaits).
          if (comparable(attendue).length < 2) {
            // … ou un jeton entier d'une cellule (« Prix : 4 », « 40% »).
            const jeton = (v) => new RegExp(`(?:^|[^\\p{L}\\p{N}])${comparable(v).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:$|[^\\p{L}\\p{N}])`, 'u').test(tout);
            const lue = [attendue, sansCorrections(attendue, propres, heritees)].some((v) => valeursDesCellules.has(comparable(v)) || jeton(v));
            return lue ? null : () => signaler({ ligne: ident, colonne: c.name, absent: [String(attendue)], cellules: tout.slice(0, 300) }, R.ecarts);
          }
          // Une valeur JSON (`donnees`) : ses feuilles, pas son écriture (les clés ne sont pas dans le classeur).
          const json = feuillesJson(attendue);
          const morceauxDe = (v) => (json ? (feuillesJson(v)?.textes ?? []).flatMap(morceaux) : morceaux(v));
          // Deux sens pour l'orthographe : la valeur, corrections défaites, dans les cellules ; ou la valeur telle quelle dans les cellules corrigées
          // (une correction qui ne touche qu'une des écritures d'un mot ne se défait pas sans erreur).
          let absents = morceauxDe(sansCorrections(attendue, propres, heritees)).filter((m) => !seLit(m, tout));
          if (absents.length && (propres.length || heritees.length)) {
            const corrige = avecCorrections(tout, enComparable(propres), enComparable(heritees));
            absents = morceauxDe(attendue).filter((m) => !seLit(m, corrige));
          }
          absents.push(...(json?.nombres ?? []).filter((n) => !lus.has(n)).map(String));
          if (!absents.length) return null;
          // Une valeur que l'import a normalisée (« Combat » -> « combat ») ne diffère que par la casse : listée à part, pas un écart.
          const vraiment = absents.filter((m) => !toutMinuscules.includes(m.toLowerCase()));
          return () => {
            if (!vraiment.length) R.casse.push({ ligne: ident, colonne: c.name, valeur: absents.join(' ‖ ').slice(0, 120) });
            else signaler({ ligne: ident, colonne: c.name, absent: vraiment.slice(0, 3), cellules: tout.slice(0, 300) }, R.ecarts);
          };
        });
      }
      for (const c of nombres) {
        verifier(c, (attendue) => (lus.has(Number(attendue)) ? null : () => signaler({ ligne: ident, colonne: c.name, valeur: attendue, cellules: tout.slice(0, 200) }, R.nombres)));
      }
    }
    for (const [cleTexte, l] of actuelles) {
      if (!vues.has(cleTexte) && citeCeClasseur(l.source_ref).some((x) => !x.page) && h.creee(t.name, cleDe(l))) R.site.creees.push({ ligne: `${t.name} ${cleTexte}` });
    }
  }

  // Notes et fils de commentaires : chacun dans note_cellule (état d'import, plage qui le contient, même texte), et inversement. Ne comptent pas : les
  // réponses automatiques d'un fil (« Marquée comme fermée », « Rouverte » : des événements, tools/sheets/magies.py#STATUS_REPLIES), un fil qui redit la
  // note de sa cellule ou un fil précédent (une seule ligne à l'import), un commentaire que le registre déclare non importé (`commentaires`).
  const notesBase = [...h.lignesDImport('note_cellule'), ...h.lignesDImport('commentaire_orphelin').map((n) => ({ ...n, entite_table: 'commentaire_orphelin', entite_id: n.id, rang: n.occurrence }))]
    .filter((n) => n.nature !== 'evenement')
    .map((n) => ({ ...n, cites: citeCeClasseur(n.source_ref).filter((x) => x.plages.length) })).filter((n) => n.cites.length);
  const retrouvees = new Set();
  const idNote = (n) => `${n.entite_table}|${n.entite_id}|${n.rang}`;
  // Une note de la base, ses corrections défaites : les siennes, et celles de son entité dont l'écriture d'origine se lit dans le commentaire du
  // classeur (0003.sql a corrigé des notes avec leur sort ; une correction du sort que la note n'a pas reçue ne se défait pas).
  const lecturesDeNote = (nb, texteNote) => {
    const propres = corrections.get(cleK('note_cellule', { entite_table: nb.entite_table, entite_id: nb.entite_id, rang: nb.rang }, 'texte')) ?? [];
    const cible = comparable(texteNote);
    const heritees = enComparable(correctionsHeritees('note_cellule', nb)).filter((c) => c.avant && cible.includes(c.avant));
    return new Set([sansCorrections(nb.texte, propres), sansCorrections(comparable(nb.texte), enComparable(propres), heritees)].map(comparable));
  };
  const EVENEMENTS_DE_FIL = new Set(['Marquée comme fermée', 'Rouverte']);
  const nonImportes = commentaires.map((c) => ({ onglet: cleDeNom(c.onglet), adresse: adresse(c.cellule), texte: comparable(c.texte) }));
  for (const o of onglets.values()) {
    for (const x of o.cellules.values()) {
      const vus = new Set();
      for (const texteNote of commentairesDe(x)) {
        const cible = comparable(texteNote);
        if (EVENEMENTS_DE_FIL.has(cible)) continue;
        const redite = vus.has(cible);
        vus.add(cible);
        R.notes.classeur += 1;
        if (nonImportes.some((c) => c.onglet === cleDeNom(o.nom) && c.adresse?.r === x.r && c.adresse?.c === x.c && c.texte === cible)) { R.notes.declares += 1; continue; }
        const n = notesBase.find((nb) => !retrouvees.has(idNote(nb))
          && nb.cites.some((ci) => ce.onglet(ci.onglet) === o && ci.plages.some((p) => dans(x, p)))
          && lecturesDeNote(nb, texteNote).has(cible));
        if (n) { retrouvees.add(idNote(n)); continue; }
        // Un commentaire recopié dans la colonne `commentaire` d'une ligne qui cite la cellule (mode_hyper_effet).
        const enColonne = (o.citees.get(`${x.r}:${x.c}`) ?? []).some((c) => typeof c.ligne.commentaire === 'string'
          && [c.ligne.commentaire, sansCorrections(c.ligne.commentaire, corrections.get(cleK(c.table, c.cleLigne, 'commentaire')) ?? [])].map(comparable).includes(cible));
        if (!enColonne && !redite) R.notes.manquantes.push({ cellule: `${o.nom}!${enA1(x)}`, note: cible.slice(0, 160) });
      }
    }
  }
  for (const n of notesBase) if (!retrouvees.has(idNote(n))) R.notes.enTrop.push({ ligne: `${n.entite_table} ${n.entite_id} #${n.rang}`, texte: comparable(n.texte).slice(0, 160) });

  // Cellules ignorées par le registre.
  for (const regle of regles) {
    const re = regle.valeurs ? new RegExp(regle.valeurs, 'u') : null;
    for (const o of onglets.values()) {
      if (!(regle.onglets ?? ['*']).some((n) => n === '*' || cleDeNom(n) === cleDeNom(o.nom))) continue;
      const ps = (regle.plages ?? ['A1:ZZZ1000000']).map(plage);
      for (const x of o.cellules.values()) {
        if (!ps.some((p) => dans(x, p))) continue;
        if (re && !re.test(valeur(x))) continue;
        o.ignorees.set(`${x.r}:${x.c}`, regle.raison);
      }
    }
  }

  // Classeur -> base : cellules non citées ; mots d'une cellule citée absents des lignes qui la citent.
  const vocabulaires = new Map();
  const vocabulaireDe = (cite) => {
    const k = cleK(cite.table, cite.cleLigne, '');
    if (!vocabulaires.has(k)) {
      const valeurs = Object.entries(cite.ligne).filter(([col, v]) => v !== null && v !== undefined && !EXCLUES.test(col)).map(([, v]) => v);
      for (const f of etrangeresDe(cite.table)) if (cite.ligne[f.de] !== null && cite.ligne[f.de] !== undefined) valeurs.push(...libellesDe(f.table, f.vers, cite.ligne[f.de]));
      vocabulaires.set(k, new Set(valeurs.flatMap((v) => mots(v))));
    }
    return vocabulaires.get(k);
  };
  for (const o of onglets.values()) {
    for (const x of o.cellules.values()) {
      const k = `${x.r}:${x.c}`;
      if (valeur(x) === '') continue;
      const cites = o.citees.get(k);
      if (!cites) {
        if (o.ignorees.has(k)) R.ignorees += 1;
        else R.nonCitees.push({ onglet: o.nom, cellule: enA1(x), valeur: comparable(valeur(x)).slice(0, 120), formule: x.f ? true : undefined });
        continue;
      }
      const lecteurs = cites.filter((c) => !META.has(c.table));
      if (!lecteurs.length) continue;
      // Le texte de la cellule doit être fait des mots des lignes qui la citent : tel quel, ou corrigé comme la base l'a été (un mot n'est absent que
      // s'il manque dans les deux lectures ; une correction héritée peut ne pas avoir touché cette ligne).
      const propres = lecteurs.flatMap((c) => correctionsDeLigne.get(cleK(c.table, c.cleLigne, '')) ?? []);
      const heritees = lecteurs.flatMap((c) => correctionsHeritees(c.table, c.ligne));
      const vocab = new Set(lecteurs.flatMap((c) => [...vocabulaireDe(c)]));
      const texte = comparable(valeur(x));
      const manquants = (t) => new Set(mots(t).filter((m) => !vocab.has(m) && !libelle(o, x, m)));
      const bruts = manquants(texte);
      const absents = propres.length || heritees.length ? [...manquants(avecCorrections(texte, enComparable(propres), enComparable(heritees)))].filter((m) => bruts.has(m)) : [...bruts];
      if (absents.length) R.motsAbsents.push({ onglet: o.nom, cellule: enA1(x), mots: absents.slice(0, 12), valeur: comparable(valeur(x)).slice(0, 160) });
    }
  }
  return R;
}

/** Nombre d'écarts d'un relevé (0 = classeur et base d'accord dans les deux sens). */
export const nombreDEcarts = (R) => R.sansOnglet.length + R.sansCellule.length + R.illisibles.length + R.ecarts.length + R.nombres.length + R.conflits.length
  + R.nonCitees.length + R.motsAbsents.length + R.notes.manquantes.length + R.notes.enTrop.length;

/** Le relevé en Markdown. */
export function rapport(R, { exemples: EXEMPLES = 20 } = {}) {
  const cell = (v) => String(v ?? '').replaceAll('|', '\\|').replace(/\n/g, ' ');
  const tab = (lignes, cols, max = EXEMPLES) => (lignes.length
    ? [`| ${cols.join(' | ')} |`, `| ${cols.map(() => '---').join(' | ')} |`, ...lignes.slice(0, max).map((l) => `| ${cols.map((c) => cell(Array.isArray(l[c]) ? l[c].join(' ‖ ') : l[c])).join(' | ')} |`)].join('\n')
      + (lignes.length > max ? `\n\n… et ${lignes.length - max} autre(s) (\`--exemples\` pour tout voir)` : '') + '\n'
    : '_Rien._\n');
  const parOnglet = Object.entries(R.nonCitees.reduce((a, x) => ({ ...a, [x.onglet]: (a[x.onglet] ?? 0) + 1 }), {})).map(([onglet, n]) => ({ onglet, n }));
  const o = [];
  o.push(`# Rapprochement : « ${R.classeur} » et la base\n`);
  o.push(`Instantané \`${R.dump}\` : ${R.onglets} onglets, ${R.cellules} cellules non vides, ${R.notes.classeur} notes et commentaires, ${R.corrigees} cellule(s) corrigée(s) par le registre des dumps. `
    + `Base (état d'import) : ${R.lignes} lignes citent des cellules de ce classeur (${Object.entries(R.parTable).map(([t, n]) => `${t} ${n}`).join(', ')}), ${R.citationsDOnglet} pages citent un onglet entier. `
    + `${R.autresClasseurs} autre(s) classeur(s) lu(s) pour les lignes qui en citent plusieurs ; ${R.voulus} écart(s) voulu(s) déclaré(s) par le registre.\n`);
  o.push('## Bilan\n');
  o.push(tab([
    { controle: 'Onglet cité introuvable', n: R.sansOnglet.length },
    { controle: 'Cellules citées vides', n: R.sansCellule.length },
    { controle: 'Citation illisible (pas une plage de cellules)', n: R.illisibles.length },
    { controle: 'Texte d\'une ligne absent de ses cellules', n: R.ecarts.length },
    { controle: 'Nombre d\'une ligne absent de ses cellules', n: R.nombres.length },
    { controle: 'Conflit : colonne modifiée par le site ET cellule changée (à trancher par le propriétaire)', n: R.conflits.length },
    { controle: 'Cellule non vide ni citée ni ignorée', n: R.nonCitees.length },
    { controle: 'Mots d\'une cellule citée absents des lignes qui la citent', n: R.motsAbsents.length },
    { controle: 'Note ou commentaire du classeur absent de note_cellule', n: R.notes.manquantes.length },
    { controle: 'Note de la base absente du classeur', n: R.notes.enTrop.length },
    { controle: 'Pour mémoire : à relire dans une autre source citée par la ligne, sans instantané', n: R.aRelire.length },
    { controle: 'Pour mémoire : différences de casse seulement (valeurs normalisées à l\'import)', n: R.casse.length },
    { controle: 'Pour mémoire : cellules ignorées par le registre', n: R.ignorees },
    { controle: 'Pour mémoire : commentaires non importés déclarés par le registre', n: R.notes.declares },
    { controle: 'Pour mémoire : colonnes modifiées, lignes supprimées, lignes créées par le site de dev', n: `${R.site.modifiees.length}, ${R.site.supprimees.length}, ${R.site.creees.length}` },
  ], ['controle', 'n'], Infinity));
  o.push('## 1. Base -> classeur\n');
  o.push('**Onglet introuvable** :\n'); o.push(tab(R.sansOnglet, ['ligne', 'onglet']));
  o.push('**Cellules citées vides** :\n'); o.push(tab(R.sansCellule, ['ligne', 'citation']));
  o.push('**Citation illisible** :\n'); o.push(tab(R.illisibles, ['ligne', 'citation']));
  o.push('**Texte absent de ses cellules** (morceau de la valeur d\'import, orthographe défaite) :\n'); o.push(tab(R.ecarts, ['ligne', 'colonne', 'absent', 'cellules']));
  o.push('**Nombre absent de ses cellules** :\n'); o.push(tab(R.nombres, ['ligne', 'colonne', 'valeur', 'cellules']));
  o.push('**Conflits à trancher** (le site a modifié la colonne, le classeur a changé la cellule) :\n'); o.push(tab(R.conflits, ['ligne', 'colonne', 'classeur', 'import', 'site', 'note']));
  o.push('## 2. Classeur -> base\n');
  o.push('**Cellules non citées, par onglet** :\n'); o.push(tab(parOnglet, ['onglet', 'n']));
  o.push('**Détail** :\n'); o.push(tab(R.nonCitees, ['onglet', 'cellule', 'valeur', 'formule']));
  o.push('**Mots d\'une cellule absents des lignes qui la citent** :\n'); o.push(tab(R.motsAbsents, ['onglet', 'cellule', 'mots', 'valeur']));
  o.push('## 3. Notes et commentaires\n');
  o.push('**Du classeur, absents de la base** :\n'); o.push(tab(R.notes.manquantes, ['cellule', 'note']));
  o.push('**De la base, absentes du classeur** :\n'); o.push(tab(R.notes.enTrop, ['ligne', 'texte']));
  o.push('## Pour mémoire\n');
  o.push('**À relire dans une autre source citée par la ligne** (sans instantané : un Google Doc) :\n');
  o.push(tab(R.aRelire.map((x) => ({ ...x, absent: x.absent ?? x.valeur })), ['ligne', 'colonne', 'absent', 'ailleurs']));
  o.push('**Différences de casse seulement** :\n'); o.push(tab(R.casse, ['ligne', 'colonne', 'valeur']));
  o.push('**Colonnes modifiées par le site de dev** (le site est la source de ce qu\'il modifie) :\n');
  o.push(tab(R.site.modifiees.map((m) => ({ ...m, import: comparable(m.import).slice(0, 80), actuelle: comparable(m.actuelle).slice(0, 80) })), ['ligne', 'colonne', 'import', 'actuelle']));
  o.push('**Lignes supprimées par le site de dev** (rapprochées dans leur état d\'import) :\n'); o.push(tab(R.site.supprimees, ['ligne']));
  o.push('**Lignes créées par le site de dev** (hors rapprochement) :\n'); o.push(tab(R.site.creees, ['ligne']));
  return o.join('\n');
}

/** Lit le registre d'un classeur (erreur s'il manque : un registre absent ne doit pas passer pour vide). */
export function lireRegistre(chemin) {
  if (!existsSync(chemin)) throw new Error(`registre introuvable : ${chemin}`);
  const { regles = [], derivees = {}, libelles = [], voulus = [], conflits = [], commentaires = [] } = JSON.parse(readFileSync(chemin, 'utf8'));
  return { regles, derivees, libelles, voulus, conflits, commentaires };
}

/** Les instantanés du registre des classeurs (sources/raw/classeurs/registre.json) : { titre: dump }. */
export function instantanesDuRegistre(chemin = REGISTRE_DES_CLASSEURS) {
  const registre = JSON.parse(readFileSync(chemin, 'utf8'));
  return Object.fromEntries(registre.classeurs.map((c) => [c.titre, JSON.parse(readFileSync(resolve(chemin, '..', c.fichier), 'utf8'))]));
}

function principal() {
  const arg = (nom, defaut) => {
    const i = process.argv.indexOf(nom);
    if (i < 0) return defaut;
    const v = process.argv[i + 1];
    if (v === undefined || v.startsWith('--')) { console.error(`${nom} attend une valeur`); process.exit(2); }
    return v;
  };
  const classeur = arg('--classeur', null);
  const dump = arg('--dump', null);
  if (!classeur || !dump) { console.error('usage : rapprocher.mjs --classeur "<titre>" --dump <instantané.json> [--registre <registre.json>] [--base var/maverick.db] [--sortie <fichier>] [--json]'); process.exit(2); }
  const base = resolve(arg('--base', resolve(RACINE, 'var', 'maverick.db')));
  const registre = arg('--registre', arg('--ignorer', null));
  const sortie = arg('--sortie', null);
  const db = new DatabaseSync(base, { readOnly: true });
  const R = rapprocher(db, {
    classeur, dump: JSON.parse(readFileSync(resolve(dump), 'utf8')), nomDuDump: dump, autres: instantanesDuRegistre(), ...(registre ? lireRegistre(resolve(registre)) : {}),
  });
  db.close();
  const s = process.argv.includes('--json') ? JSON.stringify(R, null, 2) : rapport(R, { exemples: Number(arg('--exemples', '20')) });
  if (sortie) { writeFileSync(sortie, s); console.log(`${nombreDEcarts(R)} écart(s) : rapport écrit dans ${sortie}`); } else process.stdout.write(`${s}\n`);
  process.exitCode = nombreDEcarts(R) ? 1 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) principal();
