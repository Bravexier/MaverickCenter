// Lecture d'un classeur (.xlsx, .ods ou .csv) en grille : la fiche de personnage en tableur (demande du propriétaire, 2026-10-15 : « La fiche
// de personnage doit pouvoir être importée et exportée à tout moment depuis un Excel ou Google Sheet »). Module de format, qui ne sait rien du
// jeu : lib/fiche-tableur-import.mjs lit la grille rendue ici. Réservé à src/scripts/fiche.mjs (et aux modules du tableur, aux tests) : un module
// importé par deux scripts de page casse la version portable (skill site-version-portable) ; n'importe que lib/zip.mjs, lib/xml-mini.mjs et
// lib/fiche-tableur-cases.mjs.
//
//   lireClasseur(octets, { nom }) → { format: 'xlsx' | 'ods' | 'csv', feuilles: [noms], feuille(nom?), trouver(test) }
//   feuille(nom) : la feuille de ce nom (même écriture, sinon même cle()), sinon la première ; lue à la première demande, puis gardée.
//   trouver(test) : la première feuille dont `test(feuille)` est vrai, en essayant d'abord celle nommée « Personnage » (comparée par cle()),
//     puis les autres dans l'ordre du classeur ; null si aucune (un onglet renommé ou déplacé est retrouvé à son contenu). Une feuille illisible
//     est passée ; si aucune ne convient et qu'une n'a pas pu être lue, l'erreur de la première est levée (le fichier est abîmé, pas étranger).
//   Feuille = { nom, cellules: Map<'A1', Cellule>, images: Image[] }
//   Cellule = { valeur: string | number | boolean, texte, remplissage: 'RRGGBB' | null, tronquee?: true } (seules les cases non vides OU remplies ;
//             `tronquee` : valeur ou texte coupé à MAX_TEXTE_LU caractères)
//   Image   = { de: 'A1', a: 'E5' | null, octets, type: 'image/png'…, nom, description }
//
// Décisions (relevées sur les fichiers de LibreOffice, d'Excel et de Google Sheets ; lecteurs d'essai vérifiés contre openpyxl) :
//   - format : « PK » → ZIP ; classeur OOXML (relation officeDocument de _rels/.rels vers un <workbook>, sinon xl/workbook.xml) → xlsx ;
//     mimetype « application/vnd.oasis.opendocument.spreadsheet » (modèle .ots compris) ou content.xml → ods ; tout autre ZIP refusé.
//     Pas ZIP : un ancien .xls (ou un .xlsx chiffré : tous deux des fichiers OLE) est refusé en le disant ; un texte (UTF-8, UTF-16 avec BOM,
//     sinon Windows-1252, celui d'Excel en français) → CSV ; tout autre binaire est refusé.
//   - aucune formule n'est évaluée : seule la valeur en cache compte (`<v>`, office:value) ; une formule sans résultat est une case vide.
//   - une zone fusionnée s'affiche comme sa case du haut à gauche : les autres cases de la zone (xlsx : <mergeCell> ; ods : covered-table-cell)
//     ne sont pas dans la grille, ni leur valeur (cachée) ni leur fond (LibreOffice le recopie dans un .xlsx, pas dans un .ods).
//   - xlsx : noms locaux comparés (« x:c », « ns0: »… selon les producteurs ; OOXML Strict comme Transitional) ; parties retrouvées par les
//     relations (cible relative, absolue, encodée en %, ou d'une autre casse : OPC ne distingue pas la casse) ; `_xHHHH_` décodé (Excel écrit
//     `_x000D_`) puis `\r\n` → `\n` ; texte riche = les <t> des <r>, jamais ceux de <rPh> (lecture phonétique) ; types s, inlineStr, b, str, e,
//     d, n ou absent ; `r` facultatif sur <row> et <c> ; texte affiché d'un nombre, d'après le format de nombre de sa case (numFmtId de cellXfs :
//     intégré ou <numFmt>, sa première section, hors guillemets, « \x », « _x », « *x » et crochets) : date (intégrés 14 à 22 et 45 à 47, ou
//     un format qui écrit d, m ou y) → « JJ/MM/AAAA », suivie de « HH:MM » (« :SS ») si le format écrit aussi h ou s, l'heure seule pour un
//     format d'heure sans d ni y (« h:mm », « mm:ss », « [h]:mm:ss » qui compte les heures au-delà de 24) ; calendrier de 1900 (le 29/02/1900
//     fictif d'Excel compris) ou de 1904 (workbookPr@date1904) ; une valeur hors des dates (négative, après 9999) garde le format « Standard » ;
//     pourcentage (format qui écrit « % ») → « 18 % », ses décimales au point ; sinon « Standard » (15 chiffres significatifs, point décimal) ;
//     la valeur reste le nombre ; booléen « TRUE » / « FALSE ».
//   - ods : préfixes résolus par les xmlns (aucun « office: » ni « table: » supposé) ; lignes dans table-header-rows, table-row-group,
//     table-rows ; texte affiché = les text:p (text:h) DIRECTS de la cellule joints par `\n` (pas ceux d'un draw:frame ni d'une
//     office:annotation), lus comme LibreOffice les relit : blancs littéraux gardés tels quels (espaces doubles, espace de tête, tabulation,
//     saut de ligne : LibreOffice écrit ainsi une case de plusieurs paragraphes, sans text:s, et ne replie rien à la relecture, contrairement au
//     §6.1.2 d'ODF ; relevé sur LibreOffice 24.2), text:s (text:c espaces), text:tab, text:line-break, text:span / text:a lus ; nombre,
//     pourcentage, devise → office:value, booléen → office:boolean-value, date / heure → la valeur ISO, texte → office:string-value sinon les
//     paragraphes.
//   - répétitions (ods) : une valeur non vide répétée plus de MAX_REPETITION fois (lignes × colonnes) refuse le fichier (bombe) ; une case
//     vide seulement remplie n'est dépliée que si ses deux répétitions restent sous MAX_REPETITION (au-delà : le décor des bords de la feuille),
//     et dans ZONE_DES_FONDS seulement (A1:CZ200 ; la fiche s'arrête en BZ75) : un petit fichier aux fonds répétés ne fait pas des centaines de
//     milliers de cases. Au plus MAX_CASES cases par feuille : au-delà, une valeur refuse le fichier, un simple fond n'est plus déplié.
//   - longueur : une case lue garde au plus MAX_TEXTE_LU caractères (valeur et texte ; Excel n'en écrit pas plus de 32 767), au-delà elle est
//     coupée et marquée `tronquee` ; un .ods n'assemble pas au-delà (text:s, paragraphes), quelle que soit leur répétition.
//   - remplissage : xlsx, cellXfs[s].fillId → fills : motif « solid » seulement, fgColor (ARGB : le canal alpha ignoré comme le fait Excel ;
//     indexed : palette standard d'Excel ou <indexedColors> ; theme : couleur du thème, ordre lt1 dk1 lt2 dk2 accent1…6 hlink folHlink, avec
//     tint) ; « THEME » / « INDEXE » quand la couleur ne se retrouve pas (non nul : la case est bien remplie). ods : style de la case, sinon
//     défaut de la ligne, sinon défaut de la colonne, fo:background-color de style:table-cell-properties, en remontant les parents (styles
//     automatiques de content.xml, styles de styles.xml, style par défaut). Blanc et transparent = null.
//   - images : xlsx, relations de la feuille → dessin → ancres twoCellAnchor (de, a) et oneCellAnchor (de, a = null), absoluteAnchor ignorée,
//     mc:AlternateContent lu une fois (Choice, sinon Fallback) → pic → blip r:embed → média ; nom = cNvPr@name, description = @descr (sinon
//     @title). ods : draw:frame d'une cellule (ou d'un draw:g) → premier draw:image interne ; de = la cellule, a = table:end-cell-address sans
//     le nom de la feuille ; nom = draw:name, description = svg:desc (sinon svg:title). Type tiré des octets (PNG, JPEG, GIF, WebP, BMP, TIFF),
//     sinon du [Content_Types].xml ou du manifeste.
//   - CSV : séparateur « ; », « , » ou tabulation, celui dont les 20 premières lignes ont le plus souvent le même nombre de colonnes (au moins
//     deux), puis le plus de colonnes ; RFC 4180 (guillemets, « "" », sauts de ligne entre guillemets, fins de ligne \r\n, \n ou \r) ; une ligne
//     vide reste une ligne ; valeur = texte = la chaîne lue (un CSV n'a pas de type) ; feuille nommée d'après le fichier.

import { lireZip } from './zip.mjs';
import { analyserXml, enfantNomme, enfantsNommes, nomLocal, texteDe } from './xml-mini.mjs';
import { cle, lettresDeColonne, numeroDeColonne } from './fiche-tableur-cases.mjs';

/** Une valeur non vide (ods) répétée plus que cela refuse le fichier. */
export const MAX_REPETITION = 1000;
/** Cases au plus dans une feuille. */
export const MAX_CASES = 500_000;
/** Caractères au plus dans une case lue (valeur et texte) ; au-delà, la case est coupée et marquée `tronquee`. */
export const MAX_TEXTE_LU = 40_000;
/** La zone où une case vide seulement remplie (ods) est dépliée : A1:CZ200. */
export const ZONE_DES_FONDS = Object.freeze({ colonnes: 104, lignes: 200 });
const MAX_COLONNE = 16_384; // XFD : la dernière colonne d'Excel
const MAX_LIGNE = 1_048_576;

const PAS_UN_CLASSEUR = 'Ce fichier n’est pas un classeur .xlsx ou .ods.';
const PAS_UN_TABLEUR = 'Ce fichier n’est ni un classeur .xlsx ou .ods, ni un tableau .csv.';
const FICHIER_OLE = 'Ce fichier est un classeur Excel 97-2003 (.xls) ou un classeur protégé par un mot de passe, que le site ne sait pas lire : '
  + 'enregistrez-le au format .xlsx (sans mot de passe) puis importez-le.';
const incomplet = (chemin) => new Error(`Le classeur est incomplet : « ${chemin} » manque.`);
const tropDeCases = (nom) => new Error(`La feuille « ${nom} » a trop de cases remplies (plus de ${MAX_CASES}) : fichier refusé.`);

const adresse = (colonne, ligne) => `${lettresDeColonne(colonne)}${ligne}`;
const BLANC = 'FFFFFF';
const sansBlanc = (c) => (c === BLANC ? null : c);

/**
 * Lit un classeur .xlsx, .ods ou .csv (voir l'en-tête). Error au message français pour un fichier qui n'en est pas un ou qui est abîmé.
 * @param {Uint8Array | ArrayBuffer} octets
 * @param {{ nom?: string }} [options] `nom` : nom du fichier (sert à nommer la feuille d'un CSV)
 */
export async function lireClasseur(octets, { nom = '' } = {}) {
  let o;
  if (octets instanceof Uint8Array) o = octets;
  else if (ArrayBuffer.isView(octets)) o = new Uint8Array(octets.buffer, octets.byteOffset, octets.byteLength);
  else if (octets instanceof ArrayBuffer) o = new Uint8Array(octets);
  else throw new Error('Aucun fichier à lire.');
  if (!o.length) throw new Error('Ce fichier est vide.');

  const commence = (...signature) => signature.every((b, i) => o[i] === b);
  if (commence(0x50, 0x4b) && ((o[2] === 3 && o[3] === 4) || (o[2] === 5 && o[3] === 6) || (o[2] === 7 && o[3] === 8))) {
    const entrees = await lireZip(o);
    const cheminXlsx = cheminDuClasseurXlsx(entrees);
    if (cheminXlsx) {
      const racine = xmlDe(entrees, cheminXlsx);
      if (nomLocal(racine.nom) === 'workbook') return classeurXlsx(entrees, cheminXlsx, racine);
    }
    const mimetype = entrees.has('mimetype') ? new TextDecoder().decode(entrees.get('mimetype')).trim() : '';
    if (mimetype.startsWith('application/vnd.oasis.opendocument.spreadsheet') || entrees.has('content.xml')) return classeurOds(entrees);
    throw new Error(PAS_UN_CLASSEUR);
  }
  if (commence(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1)) throw new Error(FICHIER_OLE);
  return classeurCsv(texteDuCsv(o), nom);
}

/** Le nom de feuille que trouver() essaie d'abord : celui de l'onglet des deux modèles de la fiche. */
const FEUILLE_PREFEREE = cle('Personnage');

/** L'objet rendu par lireClasseur : `feuilles` = [{ nom, … }], `lire(feuille)` → Feuille (appelée une fois par feuille). */
function classeur(format, feuilles, lire) {
  const lues = new Map();
  const lue = (i) => {
    if (!lues.has(i)) lues.set(i, lire(feuilles[i]));
    return lues.get(i);
  };
  return {
    format,
    feuilles: feuilles.map((f) => f.nom),
    feuille(nom) {
      let i = -1;
      if (nom !== undefined && nom !== null && String(nom) !== '') {
        i = feuilles.findIndex((f) => f.nom === String(nom));
        if (i < 0) i = feuilles.findIndex((f) => cle(f.nom) === cle(nom));
      }
      return lue(i < 0 ? 0 : i);
    },
    /** La première feuille dont `test(feuille)` est vrai, « Personnage » d'abord, puis les autres dans l'ordre ; null sinon (voir l'en-tête). */
    trouver(test) {
      const preferee = feuilles.findIndex((f) => cle(f.nom) === FEUILLE_PREFEREE);
      const ordre = [...feuilles.keys()];
      if (preferee > 0) ordre.unshift(...ordre.splice(preferee, 1));
      let erreur = null;
      for (const i of ordre) {
        let f;
        try {
          f = lue(i);
        } catch (e) {
          erreur ??= e;
          continue;
        }
        if (test(f)) return f;
      }
      if (erreur) throw erreur;
      return null;
    },
  };
}

/** Une chaîne d'au plus MAX_TEXTE_LU caractères (sans couper une paire de substitution) ; toute autre valeur telle quelle. */
function borne(v) {
  if (typeof v !== 'string' || v.length <= MAX_TEXTE_LU) return v;
  const code = v.charCodeAt(MAX_TEXTE_LU - 1);
  return v.slice(0, code >= 0xd800 && code <= 0xdbff ? MAX_TEXTE_LU - 1 : MAX_TEXTE_LU);
}

/** Le contenu d'une case ({ valeur, texte } ou null) borné à MAX_TEXTE_LU caractères, `tronquee` s'il a fallu couper. */
function contenuBorne(contenu) {
  if (!contenu) return contenu;
  const valeur = borne(contenu.valeur);
  const texte = borne(contenu.texte);
  return valeur === contenu.valeur && texte === contenu.texte ? contenu : { valeur, texte, tronquee: true };
}

/** La grille est-elle pleine (MAX_CASES) ? Une case de plus n'y entre que pour refuser le fichier. */
const pleine = (cellules) => cellules.size >= MAX_CASES;

/**
 * Pose une case dans la grille (`contenu` : { valeur, texte, tronquee? } déjà borné, ou null pour une case seulement remplie) ; au-delà de MAX_CASES,
 * une valeur refuse le fichier, un simple fond est laissé.
 */
function poserCase(cellules, nomFeuille, colonne, ligne, contenu, remplissage) {
  if (colonne < 1 || colonne > MAX_COLONNE || ligne < 1 || ligne > MAX_LIGNE) return;
  const a = adresse(colonne, ligne);
  if (!cellules.has(a) && pleine(cellules)) {
    if (!contenu) return;
    throw tropDeCases(nomFeuille);
  }
  const cellule = { valeur: contenu?.valeur ?? '', texte: contenu?.texte ?? '', remplissage };
  if (contenu?.tronquee) cellule.tronquee = true;
  cellules.set(a, cellule);
}

// ---------- outils communs ----------
/** Texte d'une partie XML : UTF-16 si un BOM le dit, sinon UTF-8 (BOM retiré). */
function texteDePartie(o) {
  if (o[0] === 0xff && o[1] === 0xfe) return new TextDecoder('utf-16le').decode(o);
  if (o[0] === 0xfe && o[1] === 0xff) return new TextDecoder('utf-16be').decode(o);
  return new TextDecoder().decode(o);
}

/** Arbre d'une partie (lib/xml-mini.mjs) ; le message d'erreur dit laquelle. */
function xmlDe(entrees, chemin) {
  const o = entrees.get(chemin);
  if (!o) throw incomplet(chemin);
  try {
    return analyserXml(texteDePartie(o));
  } catch (e) {
    throw new Error(`${chemin} : ${e.message}`);
  }
}

/** Le nom d'entrée d'une partie : tel quel, sinon décodé (%20…), sinon sans tenir compte de la casse ; null si absente. */
function trouverPartie(entrees, chemin) {
  if (!chemin) return null;
  if (entrees.has(chemin)) return chemin;
  let decode = chemin;
  try {
    decode = decodeURIComponent(chemin);
  } catch {
    // « % » qui n'encode rien : le nom tel quel
  }
  if (entrees.has(decode)) return decode;
  const bas = decode.toLowerCase();
  for (const k of entrees.keys()) if (k.toLowerCase() === bas) return k;
  return null;
}

/** Type d'image d'après ses premiers octets, sinon le type déclaré par le paquet. */
function typeDImage(o, declare) {
  const commence = (...b) => b.every((x, i) => o[i] === x);
  if (commence(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return 'image/png';
  if (commence(0xff, 0xd8, 0xff)) return 'image/jpeg';
  if (commence(0x47, 0x49, 0x46, 0x38)) return 'image/gif';
  if (commence(0x52, 0x49, 0x46, 0x46) && o[8] === 0x57 && o[9] === 0x45 && o[10] === 0x42 && o[11] === 0x50) return 'image/webp';
  if (commence(0x42, 0x4d)) return 'image/bmp';
  if (commence(0x49, 0x49, 0x2a, 0x00) || commence(0x4d, 0x4d, 0x00, 0x2a)) return 'image/tiff';
  return declare || 'application/octet-stream';
}

/** Texte affiché d'un nombre au format « Standard » : entier tel quel, sinon 15 chiffres significatifs (0.1 + 0.2 → « 0.3 »). */
const texteStandard = (n) => (Number.isInteger(n) ? String(n) : String(Number(n.toPrecision(15))));

/** Entier positif écrit dans un attribut (répétition, numéro de ligne) ; `defaut` s'il manque ou n'en est pas un. */
function entier(v, defaut) {
  const n = Number.parseInt(v ?? '', 10);
  return Number.isInteger(n) && n >= 1 ? n : defaut;
}

/** « AB12 » ou « $AB$12 » → { colonne, ligne } ; null sinon. */
function decouperReference(ref) {
  const m = /^\$?([A-Za-z]{1,3})\$?(\d+)$/.exec(String(ref ?? '').trim());
  if (!m) return null;
  const position = { colonne: numeroDeColonne(m[1].toUpperCase()), ligne: Number(m[2]) };
  return position.ligne >= 1 ? position : null;
}

// =====================================================================================================================================
// xlsx
// =====================================================================================================================================
function* descendants(el, local) {
  for (const e of el?.enfants ?? []) {
    if (typeof e === 'string') continue;
    if (nomLocal(e.nom) === local) yield e;
    yield* descendants(e, local);
  }
}
const premier = (iterable) => {
  for (const e of iterable) return e;
  return null;
};

/** Attribut préfixé de nom local `local` (« r:id », « r:embed ») ; jamais une déclaration xmlns ni l'attribut sans préfixe (« id »). */
function attributPrefixe(el, local) {
  for (const [nom, valeur] of Object.entries(el?.attrs ?? {})) {
    const i = nom.indexOf(':');
    if (i > 0 && nom.slice(i + 1) === local && nom.slice(0, i) !== 'xmlns') return valeur;
  }
  return undefined;
}

/** Décode les `_xHHHH_` d'OOXML (« _x005F_ » = « _ », d'où « _x005F_x000D_ » → « _x000D_ ») puis ramène les fins de ligne à `\n`. */
function texteOoxml(s) {
  const decode = s.includes('_x') ? s.replace(/_x([0-9A-Fa-f]{4})_/g, (_, h) => String.fromCharCode(parseInt(h, 16))) : s;
  return decode.includes('\r') ? decode.replace(/\r\n?/g, '\n') : decode;
}

/** Texte d'un <si> ou d'un <is> : son <t>, ou les <t> de ses <r> ; jamais <rPh> (lecture phonétique). */
function texteRiche(el) {
  let s = '';
  for (const e of enfantsNommes(el)) {
    const local = nomLocal(e.nom);
    if (local === 't') s += texteDe(e);
    else if (local === 'r') for (const t of enfantsNommes(e, 't')) s += texteDe(t);
  }
  return texteOoxml(s);
}

/** Chemin d'une cible de relation, relatif au dossier de la partie source ou absolu ; null pour une adresse externe. */
function cheminDeCible(source, cible) {
  if (!cible || /^[a-z][a-z0-9+.-]*:/i.test(cible)) return null;
  const sansAncre = cible.split('#')[0];
  const parties = sansAncre.startsWith('/') ? [] : source.split('/').slice(0, -1);
  for (const p of sansAncre.split('/')) {
    if (p === '..') parties.pop();
    else if (p !== '.' && p !== '') parties.push(p);
  }
  return parties.join('/');
}

/** Relations d'une partie (« » = le paquet) : Map Id → { type, chemin (attendu), cible (nom d'entrée, null si absente ou externe) }. */
function relations(entrees, source) {
  const dossier = source.slice(0, source.lastIndexOf('/') + 1);
  const cheminRels = trouverPartie(entrees, `${dossier}_rels/${source.slice(dossier.length)}.rels`);
  const r = new Map();
  if (!cheminRels) return r;
  for (const e of enfantsNommes(xmlDe(entrees, cheminRels), 'Relationship')) {
    const chemin = e.attrs.TargetMode === 'External' ? null : cheminDeCible(source, e.attrs.Target ?? '');
    r.set(e.attrs.Id, { type: e.attrs.Type ?? '', chemin, cible: trouverPartie(entrees, chemin) });
  }
  return r;
}
const relationDeType = (rels, type) => {
  for (const r of rels.values()) if (r.type.endsWith(`/${type}`)) return r;
  return null;
};

function cheminDuClasseurXlsx(entrees) {
  const principal = relationDeType(relations(entrees, ''), 'officeDocument');
  return principal?.cible ?? trouverPartie(entrees, 'xl/workbook.xml');
}

/** Types déclarés par [Content_Types].xml : (nom d'entrée) → type, ou null. Lu sans exiger qu'il soit lisible (il ne sert qu'en repli). */
function typesDeContenu(entrees) {
  const defauts = new Map();
  const surcharges = new Map();
  const chemin = trouverPartie(entrees, '[Content_Types].xml');
  if (chemin) {
    try {
      for (const e of enfantsNommes(xmlDe(entrees, chemin))) {
        const local = nomLocal(e.nom);
        if (local === 'Default' && e.attrs.Extension) defauts.set(e.attrs.Extension.toLowerCase(), e.attrs.ContentType);
        else if (local === 'Override' && e.attrs.PartName) surcharges.set(e.attrs.PartName.replace(/^\//, '').toLowerCase(), e.attrs.ContentType);
      }
    } catch {
      // illisible : les types se tirent des octets seulement
    }
  }
  return (nom) => surcharges.get(nom.toLowerCase()) ?? defauts.get(nom.slice(nom.lastIndexOf('.') + 1).toLowerCase()) ?? null;
}

function classeurXlsx(entrees, cheminClasseur, racine) {
  const rels = relations(entrees, cheminClasseur);
  const feuilles = [];
  const date1904 = ['1', 'true'].includes(String(enfantNomme(racine, 'workbookPr')?.attrs.date1904 ?? '').trim().toLowerCase());
  for (const s of enfantsNommes(enfantNomme(racine, 'sheets'), 'sheet')) {
    const rel = rels.get(attributPrefixe(s, 'id'));
    if (!rel || !rel.type.endsWith('/worksheet')) continue; // feuille de graphique, de dialogue, de macros : pas de cases
    feuilles.push({ nom: texteOoxml(s.attrs.name ?? ''), chemin: rel.chemin, cible: rel.cible });
  }
  if (!feuilles.length) throw new Error('Ce classeur n’a aucune feuille de calcul.');
  let commun = null; // chaînes partagées, styles, types : lus à la première feuille demandée
  const communDuClasseur = () => {
    commun ??= {
      partages: chainesPartagees(entrees, rels),
      styles: stylesXlsx(entrees, rels),
      types: typesDeContenu(entrees),
      date1904,
    };
    return commun;
  };
  return classeur('xlsx', feuilles, (f) => feuilleXlsx(entrees, f, communDuClasseur()));
}

function chainesPartagees(entrees, rels) {
  const chemin = relationDeType(rels, 'sharedStrings')?.cible ?? trouverPartie(entrees, 'xl/sharedStrings.xml');
  return chemin ? enfantsNommes(xmlDe(entrees, chemin), 'si').map(texteRiche) : [];
}

// ---------- styles (remplissages, pourcentages) ----------
// Palette « indexed » d'Excel (ECMA-376, §18.8.27) ; 64 = premier plan du système (noir), 65 = arrière-plan du système (blanc).
const PALETTE = Object.freeze([
  '000000', 'FFFFFF', 'FF0000', '00FF00', '0000FF', 'FFFF00', 'FF00FF', '00FFFF',
  '000000', 'FFFFFF', 'FF0000', '00FF00', '0000FF', 'FFFF00', 'FF00FF', '00FFFF',
  '800000', '008000', '000080', '808000', '800080', '008080', 'C0C0C0', '808080',
  '9999FF', '993366', 'FFFFCC', 'CCFFFF', '660066', 'FF8080', '0066CC', 'CCCCFF',
  '000080', 'FF00FF', 'FFFF00', '00FFFF', '800080', '800000', '008080', '0000FF',
  '00CCFF', 'CCFFFF', 'CCFFCC', 'FFFF99', '99CCFF', 'FF99CC', 'CC99FF', 'FFCC99',
  '3366FF', '33CCCC', '99CC00', 'FFCC00', 'FF9900', 'FF6600', '666699', '969696',
  '003366', '339966', '003300', '333300', '993300', '993366', '333399', '333333',
  '000000', 'FFFFFF',
]);
// Ordre des couleurs du thème vu par SpreadsheetML (theme="0" = lt1, le fond ; theme="1" = dk1, le texte).
const ORDRE_DU_THEME = Object.freeze(['lt1', 'dk1', 'lt2', 'dk2', 'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6', 'hlink', 'folHlink']);

/** « FFB2B2B2 », « B2B2B2 » ou « #b2b2b2 » → « B2B2B2 » (alpha ignoré) ; null sinon. */
function hexa(v) {
  const m = /^#?(?:[0-9A-Fa-f]{2})?([0-9A-Fa-f]{6})$/.exec(String(v ?? '').trim());
  return m ? m[1].toUpperCase() : null;
}

/** Applique la teinte (`tint`, de −1 à 1) d'OOXML à une couleur : luminosité TSL × (1 + tint), ou vers le blanc si tint > 0. */
function teinte(couleur, tint) {
  if (!Number.isFinite(tint) || tint === 0) return couleur;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(couleur.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let t = 0;
  let s = 0;
  let l = (max + min) / 2;
  if (d) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    t = (max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4) / 6;
  }
  l = tint < 0 ? l * (1 + tint) : l * (1 - tint) + tint;
  const canal = (p, q, x) => {
    const h = x < 0 ? x + 1 : x > 1 ? x - 1 : x;
    if (h < 1 / 6) return p + (q - p) * 6 * h;
    if (h < 1 / 2) return q;
    if (h < 2 / 3) return p + (q - p) * (2 / 3 - h) * 6;
    return p;
  };
  let rvb = [l, l, l];
  if (s) {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    rvb = [canal(p, q, t + 1 / 3), canal(p, q, t), canal(p, q, t - 1 / 3)];
  }
  return rvb.map((x) => Math.round(Math.min(1, Math.max(0, x)) * 255).toString(16).padStart(2, '0')).join('').toUpperCase();
}

/** Couleur d'un élément CT_Color (fgColor…) : « RRGGBB », « THEME » / « INDEXE » si elle ne se retrouve pas, null s'il n'en dit aucune. */
function couleurOoxml(el, palette, theme) {
  if (!el) return null;
  const { rgb, theme: indiceTheme, indexed, tint } = el.attrs;
  let base;
  if (rgb !== undefined) base = hexa(rgb);
  else if (indiceTheme !== undefined) base = theme[Number(indiceTheme)] ?? 'THEME';
  else if (indexed !== undefined) base = palette[Number(indexed)] ?? 'INDEXE';
  else return null; // auto : la couleur du système, rien d'écrit
  if (!base || base === 'THEME' || base === 'INDEXE') return base;
  return tint === undefined ? base : teinte(base, Number(tint));
}

function couleursDuTheme(entrees, rels) {
  const chemin = relationDeType(rels, 'theme')?.cible;
  if (!chemin) return [];
  let schema;
  try {
    schema = premier(descendants(xmlDe(entrees, chemin), 'clrScheme'));
  } catch {
    return []; // thème illisible : ses couleurs restent « THEME »
  }
  const parNom = new Map();
  for (const e of enfantsNommes(schema)) {
    const srgb = enfantNomme(e, 'srgbClr');
    const sys = enfantNomme(e, 'sysClr');
    let c = srgb ? hexa(srgb.attrs.val) : null;
    if (!c && sys) c = hexa(sys.attrs.lastClr) ?? ({ window: BLANC, windowText: '000000' })[sys.attrs.val] ?? null;
    parNom.set(nomLocal(e.nom), c);
  }
  return ORDRE_DU_THEME.map((n) => parNom.get(n) ?? null);
}

// Formats de nombre intégrés d'Excel qui ne sont pas « Standard » (ECMA-376, §18.8.30) : pourcentages, dates et heures.
const FORMATS_INTEGRES = new Map([
  [9, '0%'], [10, '0.00%'], [14, 'm/d/yyyy'], [15, 'd-mmm-yy'], [16, 'd-mmm'], [17, 'mmm-yy'], [18, 'h:mm AM/PM'], [19, 'h:mm:ss AM/PM'],
  [20, 'h:mm'], [21, 'h:mm:ss'], [22, 'm/d/yyyy h:mm'], [45, 'mm:ss'], [46, '[h]:mm:ss'], [47, 'mmss.0'],
]);

/**
 * Ce que dit un code de format de nombre (sa première section, hors texte entre guillemets, « \x », « _x », « *x » et crochets) :
 * { pourcentage: décimales, date: null } pour un format qui écrit « % », { pourcentage: null, date: { jour, heure, secondes, ecoule } } pour une
 * date ou une heure (d, m, y : le jour ; h, s, m à côté d'eux : l'heure ; « [h] » : les heures écoulées), null pour un autre format.
 */
function formatDeNombre(code) {
  const section = String(code ?? '').replace(/"[^"]*"|\\.|[_*]./g, '').split(';')[0];
  const ecoule = /\[h+\]/i.test(section);
  const nu = section.replace(/\[[^\]]*\]/g, (crochets) => (/^\[(?:h+|m+|s+)\]$/i.test(crochets) ? crochets.slice(1, -1) : ''))
    .replace(/AM\/PM|A\/P/gi, '').toLowerCase();
  if (/[dy]/.test(nu) || /[hs]/.test(nu) || (nu.includes('m') && !/[0#?]/.test(nu))) {
    const heure = /[hs]/.test(nu);
    return { pourcentage: null, date: { jour: /[dy]/.test(nu) || !heure, heure, secondes: nu.includes('s'), ecoule } };
  }
  if (nu.includes('%')) return { pourcentage: /\.([0#?]+)/.exec(nu)?.[1].length ?? 0, date: null };
  return null;
}

const deuxChiffres = (n) => String(n).padStart(2, '0');
const JOUR_MS = 86_400_000;
const DERNIER_JOUR = 2_958_465; // 31/12/9999 dans le calendrier de 1900

/** Le texte d'une date ou d'une heure d'Excel (numéro de série), selon ce qu'en montre son format (formatDeNombre) ; null hors des dates. */
function texteDeDate(n, { jour, heure, secondes, ecoule }, date1904) {
  if (!Number.isFinite(n) || n < 0) return null;
  const totalSecondes = Math.round(n * 86_400);
  const jours = Math.floor(totalSecondes / 86_400);
  if (jours > DERNIER_JOUR) return null;
  const dansLeJour = totalSecondes - jours * 86_400;
  const morceaux = [];
  if (jour) {
    if (date1904) {
      const d = new Date(Date.UTC(1904, 0, 1) + jours * JOUR_MS);
      morceaux.push(`${deuxChiffres(d.getUTCDate())}/${deuxChiffres(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`);
    } else if (jours === 0) morceaux.push('00/01/1900'); // ce qu'écrit Excel
    else if (jours === 60) morceaux.push('29/02/1900'); // le jour fictif d'Excel (Lotus 1-2-3)
    else {
      const d = new Date(Date.UTC(1899, 11, jours < 60 ? 31 : 30) + jours * JOUR_MS);
      morceaux.push(`${deuxChiffres(d.getUTCDate())}/${deuxChiffres(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`);
    }
  }
  if (heure) {
    const heures = ecoule ? Math.floor(totalSecondes / 3600) : Math.floor(dansLeJour / 3600);
    const minutes = Math.floor((dansLeJour % 3600) / 60);
    morceaux.push(`${deuxChiffres(heures)}:${deuxChiffres(minutes)}${secondes ? `:${deuxChiffres(dansLeJour % 60)}` : ''}`);
  }
  return morceaux.join(' ');
}

/** Les styles des cases (cellXfs) : [{ fond: 'RRGGBB' | 'THEME' | 'INDEXE' | null, format: formatDeNombre(…) }]. */
function stylesXlsx(entrees, rels) {
  const chemin = relationDeType(rels, 'styles')?.cible ?? trouverPartie(entrees, 'xl/styles.xml');
  if (!chemin) return [];
  const racine = xmlDe(entrees, chemin);
  const theme = couleursDuTheme(entrees, rels);
  const palette = [...PALETTE];
  enfantsNommes(enfantNomme(enfantNomme(racine, 'colors'), 'indexedColors'), 'rgbColor').forEach((e, i) => {
    if (i < 64) palette[i] = hexa(e.attrs.rgb);
  });
  const fonds = enfantsNommes(enfantNomme(racine, 'fills'), 'fill').map((fill) => {
    const motif = enfantNomme(fill, 'patternFill'); // gradientFill : pas une couleur pleine
    if (!motif || motif.attrs.patternType !== 'solid') return null;
    return sansBlanc(couleurOoxml(enfantNomme(motif, 'fgColor'), palette, theme));
  });
  const formats = new Map([...FORMATS_INTEGRES].map(([id, code]) => [id, formatDeNombre(code)]));
  for (const f of enfantsNommes(enfantNomme(racine, 'numFmts'), 'numFmt')) formats.set(Number(f.attrs.numFmtId), formatDeNombre(f.attrs.formatCode));
  return enfantsNommes(enfantNomme(racine, 'cellXfs'), 'xf').map((xf) => ({
    fond: fonds[Number(xf.attrs.fillId ?? 0)] ?? null,
    format: formats.get(Number(xf.attrs.numFmtId ?? 0)) ?? null,
  }));
}

// ---------- feuille ----------
function feuilleXlsx(entrees, f, { partages, styles, types, date1904 }) {
  if (!f.cible) throw incomplet(f.chemin ?? '?');
  const racine = xmlDe(entrees, f.cible);
  const cellules = new Map();
  const couverte = casesCouvertes(racine);
  let ligne = 0;
  for (const row of enfantsNommes(enfantNomme(racine, 'sheetData'), 'row')) {
    ligne = entier(row.attrs.r, ligne + 1);
    let colonne = 0;
    for (const c of enfantsNommes(row, 'c')) {
      const position = decouperReference(c.attrs.r);
      colonne = position ? position.colonne : colonne + 1;
      const ligneDeCase = position?.ligne ?? ligne;
      const style = styles[Number(c.attrs.s ?? 0)];
      const contenu = valeurXlsx(c, partages, style, date1904);
      const remplissage = style?.fond ?? null;
      if ((!contenu && !remplissage) || couverte(colonne, ligneDeCase)) continue;
      poserCase(cellules, f.nom, colonne, ligneDeCase, contenuBorne(contenu), remplissage);
    }
  }
  return { nom: f.nom, cellules, images: imagesXlsx(entrees, f.cible, types) };
}

/** (colonne, ligne) → vrai pour une case couverte par une fusion (<mergeCell>) : toute case de la zone sauf celle du haut à gauche. */
function casesCouvertes(racine) {
  const zones = [];
  for (const m of enfantsNommes(enfantNomme(racine, 'mergeCells'), 'mergeCell')) {
    const [debut, fin] = String(m.attrs.ref ?? '').split(':').map(decouperReference);
    if (!debut || !fin) continue;
    zones.push({
      c1: Math.min(debut.colonne, fin.colonne), c2: Math.max(debut.colonne, fin.colonne),
      l1: Math.min(debut.ligne, fin.ligne), l2: Math.max(debut.ligne, fin.ligne),
    });
  }
  return (c, l) => zones.some((z) => c >= z.c1 && c <= z.c2 && l >= z.l1 && l <= z.l2 && (c !== z.c1 || l !== z.l1));
}

/** { valeur, texte } d'une case <c>, ou null si elle est vide. */
function valeurXlsx(c, partages, style, date1904) {
  const v = enfantNomme(c, 'v');
  const brut = v ? texteDe(v) : null;
  const texte = (s) => (s === null || s === undefined || s === '' ? null : { valeur: s, texte: s });
  switch (c.attrs.t ?? 'n') {
    case 's':
      return texte(brut === null || brut.trim() === '' ? null : partages[Number(brut)]);
    case 'inlineStr': {
      const is = enfantNomme(c, 'is');
      return texte(is ? texteRiche(is) : brut === null ? null : texteOoxml(brut));
    }
    case 'b': {
      if (brut === null || brut.trim() === '') return null;
      const vrai = brut.trim() === '1' || brut.trim().toLowerCase() === 'true';
      return { valeur: vrai, texte: vrai ? 'TRUE' : 'FALSE' };
    }
    case 'str':
    case 'e':
    case 'd':
      return texte(brut === null ? null : texteOoxml(brut));
    default: {
      if (brut === null || brut.trim() === '') return null;
      const n = Number(brut.trim());
      if (!Number.isFinite(n)) return texte(brut);
      const format = style?.format;
      const date = format?.date ? texteDeDate(n, format.date, date1904) : null;
      if (date) return { valeur: n, texte: date };
      if (format?.pourcentage !== null && format?.pourcentage !== undefined) return { valeur: n, texte: `${(n * 100).toFixed(format.pourcentage)} %` };
      return { valeur: n, texte: texteStandard(n) };
    }
  }
}

/** Les ancres d'un dessin, mc:AlternateContent lu une fois (Choice, sinon Fallback). */
function* ancresDe(el) {
  for (const e of enfantsNommes(el)) {
    const local = nomLocal(e.nom);
    if (local === 'twoCellAnchor' || local === 'oneCellAnchor') yield e;
    else if (local === 'AlternateContent') {
      const choix = [...ancresDe(enfantNomme(e, 'Choice'))];
      yield* choix.length ? choix : ancresDe(enfantNomme(e, 'Fallback'));
    }
  }
}

/** « A1 » d'un <from> / <to> (col et row comptés depuis 0), null s'il manque. */
function caseDAncre(el) {
  if (!el) return null;
  const colonne = Number.parseInt(texteDe(enfantNomme(el, 'col')), 10);
  const ligne = Number.parseInt(texteDe(enfantNomme(el, 'row')), 10);
  return colonne >= 0 && ligne >= 0 && colonne < MAX_COLONNE && ligne < MAX_LIGNE ? adresse(colonne + 1, ligne + 1) : null;
}

function imagesXlsx(entrees, cheminFeuille, types) {
  const images = [];
  for (const rel of relations(entrees, cheminFeuille).values()) {
    if (!rel.type.endsWith('/drawing') || !rel.cible) continue;
    const dessin = xmlDe(entrees, rel.cible);
    const relsDessin = relations(entrees, rel.cible);
    for (const ancre of ancresDe(dessin)) {
      const de = caseDAncre(enfantNomme(ancre, 'from'));
      if (!de) continue;
      const a = nomLocal(ancre.nom) === 'twoCellAnchor' ? caseDAncre(enfantNomme(ancre, 'to')) : null;
      for (const pic of descendants(ancre, 'pic')) {
        const blip = premier(descendants(enfantNomme(pic, 'blipFill'), 'blip'));
        const cible = relsDessin.get(attributPrefixe(blip, 'embed'))?.cible;
        if (!cible) continue; // image liée (r:link) ou absente du paquet
        const octets = entrees.get(cible);
        const props = enfantNomme(enfantNomme(pic, 'nvPicPr'), 'cNvPr');
        images.push({
          de, a, octets, type: typeDImage(octets, types(cible)),
          nom: props?.attrs.name ?? '', description: props?.attrs.descr || props?.attrs.title || '',
        });
      }
    }
  }
  return images;
}

// =====================================================================================================================================
// ods
// =====================================================================================================================================
const NS = Object.freeze({
  office: 'urn:oasis:names:tc:opendocument:xmlns:office:1.0',
  style: 'urn:oasis:names:tc:opendocument:xmlns:style:1.0',
  text: 'urn:oasis:names:tc:opendocument:xmlns:text:1.0',
  table: 'urn:oasis:names:tc:opendocument:xmlns:table:1.0',
  draw: 'urn:oasis:names:tc:opendocument:xmlns:drawing:1.0',
  fo: 'urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0',
  svg: 'urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0',
  xlink: 'http://www.w3.org/1999/xlink',
  manifest: 'urn:oasis:names:tc:opendocument:xmlns:manifest:1.0',
});
const NS_XML = 'http://www.w3.org/XML/1998/namespace';

/**
 * Arbre aux noms résolus par les xmlns : { ns, local, attrs: { 'ns|local': valeur }, enfants }. Un attribut sans préfixe n'a pas d'espace de
 * noms (« |nom ») ; un préfixe non déclaré donne un espace « ?préfixe » que rien ne reconnaît.
 */
function resoudre(el, portee = new Map([['xml', NS_XML]])) {
  let p = portee;
  for (const nom of Object.keys(el.attrs)) {
    if (nom !== 'xmlns' && !nom.startsWith('xmlns:')) continue;
    if (p === portee) p = new Map(portee);
    p.set(nom === 'xmlns' ? '' : nom.slice(6), el.attrs[nom]);
  }
  const espace = (prefixe) => p.get(prefixe) ?? `?${prefixe}`;
  const i = el.nom.indexOf(':');
  const attrs = Object.create(null);
  for (const [nom, valeur] of Object.entries(el.attrs)) {
    if (nom === 'xmlns' || nom.startsWith('xmlns:')) continue;
    const j = nom.indexOf(':');
    attrs[j < 0 ? `|${nom}` : `${espace(nom.slice(0, j))}|${nom.slice(j + 1)}`] = valeur;
  }
  return {
    ns: i < 0 ? (p.get('') ?? '') : espace(el.nom.slice(0, i)),
    local: el.nom.slice(i + 1),
    attrs,
    enfants: el.enfants.map((e) => (typeof e === 'string' ? e : resoudre(e, p))),
  };
}
const attribut = (n, ns, local) => n?.attrs[`${ns}|${local}`];
const fils = (n, ns, local) => (n?.enfants ?? []).filter((e) => typeof e !== 'string' && e.ns === ns && (local === undefined || e.local === local));
const filUnique = (n, ns, local) => (n?.enfants ?? []).find((e) => typeof e !== 'string' && e.ns === ns && e.local === local) ?? null;
const texteResolu = (n) => (typeof n === 'string' ? n : (n?.enfants ?? []).map(texteResolu).join(''));

function classeurOds(entrees) {
  const doc = resoudre(xmlDe(entrees, trouverPartie(entrees, 'content.xml') ?? 'content.xml'));
  const tableur = filUnique(filUnique(doc, NS.office, 'body'), NS.office, 'spreadsheet');
  if (!tableur) throw new Error(PAS_UN_CLASSEUR);
  const feuilles = fils(tableur, NS.table, 'table').map((table) => ({ nom: attribut(table, NS.table, 'name') ?? '', table }));
  if (!feuilles.length) throw new Error('Ce classeur n’a aucune feuille de calcul.');
  let commun = null;
  const communDuClasseur = () => {
    commun ??= { fond: stylesOds(entrees, doc), types: manifeste(entrees) };
    return commun;
  };
  return classeur('ods', feuilles, (f) => feuilleOds(entrees, f, communDuClasseur()));
}

/** Les types déclarés par META-INF/manifest.xml : (nom d'entrée) → type, ou null. Repli seulement : lu sans exiger qu'il soit lisible. */
function manifeste(entrees) {
  const types = new Map();
  const chemin = trouverPartie(entrees, 'META-INF/manifest.xml');
  if (chemin) {
    try {
      for (const e of fils(resoudre(xmlDe(entrees, chemin)), NS.manifest, 'file-entry')) {
        types.set(String(attribut(e, NS.manifest, 'full-path') ?? '').replace(/^\.?\//, ''), attribut(e, NS.manifest, 'media-type') || null);
      }
    } catch {
      // illisible : les types se tirent des octets seulement
    }
  }
  return (nom) => types.get(nom) ?? null;
}

/** fo:background-color → « RRGGBB », null (transparent, blanc ou illisible), undefined si le style ne le dit pas. */
function couleurOdf(v) {
  if (v === undefined) return undefined;
  const t = String(v).trim().toLowerCase();
  if (t === 'transparent') return null;
  const long = /^#([0-9a-f]{6})$/.exec(t);
  if (long) return sansBlanc(long[1].toUpperCase());
  const court = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/.exec(t);
  return court ? sansBlanc(`${court[1]}${court[1]}${court[2]}${court[2]}${court[3]}${court[3]}`.toUpperCase()) : null;
}

/** (nom d'un style de case) → fond « RRGGBB » | null, en remontant les parents jusqu'au style par défaut. */
function stylesOds(entrees, doc) {
  const parNom = new Map();
  let parDefaut;
  const fondDuStyle = (s) => couleurOdf(attribut(filUnique(s, NS.style, 'table-cell-properties'), NS.fo, 'background-color'));
  const ramasser = (conteneur) => {
    for (const s of fils(conteneur, NS.style)) {
      if (attribut(s, NS.style, 'family') !== 'table-cell') continue;
      if (s.local === 'default-style') parDefaut = fondDuStyle(s);
      else if (s.local === 'style') {
        parNom.set(attribut(s, NS.style, 'name'), { parent: attribut(s, NS.style, 'parent-style-name'), fond: fondDuStyle(s) });
      }
    }
  };
  const cheminStyles = trouverPartie(entrees, 'styles.xml');
  if (cheminStyles) {
    const styles = resoudre(xmlDe(entrees, cheminStyles));
    ramasser(filUnique(styles, NS.office, 'styles'));
    ramasser(filUnique(styles, NS.office, 'automatic-styles'));
  }
  ramasser(filUnique(doc, NS.office, 'styles'));
  ramasser(filUnique(doc, NS.office, 'automatic-styles'));
  const cache = new Map();
  return (nom) => {
    if (nom === undefined) return parDefaut ?? null;
    if (cache.has(nom)) return cache.get(nom);
    let fond;
    const vus = new Set();
    for (let n = nom; n !== undefined && !vus.has(n) && fond === undefined; n = parNom.get(n)?.parent) {
      vus.add(n);
      fond = parNom.get(n)?.fond;
    }
    const resultat = fond === undefined ? (parDefaut ?? null) : fond;
    cache.set(nom, resultat);
    return resultat;
  };
}

const GROUPES_DE_LIGNES = new Set(['table-header-rows', 'table-row-group', 'table-rows']);
const GROUPES_DE_COLONNES = new Set(['table-header-columns', 'table-column-group', 'table-columns']);

/** (numéro de colonne) → style par défaut de ses cases (table:default-cell-style-name), ou undefined ; plages croissantes, cherchées par dichotomie. */
function stylesDesColonnes(table) {
  const plages = [];
  let colonne = 1;
  const parcourir = (n) => {
    for (const e of fils(n, NS.table)) {
      if (e.local === 'table-column') {
        const n2 = entier(attribut(e, NS.table, 'number-columns-repeated'), 1);
        const style = attribut(e, NS.table, 'default-cell-style-name');
        if (style !== undefined) plages.push({ debut: colonne, fin: colonne + n2 - 1, style });
        colonne += n2;
      } else if (GROUPES_DE_COLONNES.has(e.local)) parcourir(e);
    }
  };
  parcourir(table);
  return (c) => {
    let bas = 0;
    let haut = plages.length - 1;
    while (bas <= haut) {
      const milieu = (bas + haut) >> 1;
      const p = plages[milieu];
      if (c < p.debut) haut = milieu - 1;
      else if (c > p.fin) bas = milieu + 1;
      else return p.style;
    }
    return undefined;
  };
}

/**
 * Texte affiché d'une table:table-cell, tel que LibreOffice le relit : ses text:p (text:h) directs joints par `\n`, blancs littéraux gardés tels
 * quels (voir l'en-tête), text:s, text:tab, text:line-break ; pas plus de MAX_TEXTE_LU + 1 caractères assemblés (la case sera coupée).
 */
function texteAfficheOds(c) {
  let s = '';
  const plein = () => s.length > MAX_TEXTE_LU;
  const lire = (n) => {
    for (const e of n.enfants) {
      if (plein()) return;
      if (typeof e === 'string') s += e;
      else if (e.ns !== NS.text) continue; // office:annotation, draw:frame… : pas du texte affiché dans la case
      else if (e.local === 's') s += ' '.repeat(Math.min(entier(attribut(e, NS.text, 'c'), 1), MAX_TEXTE_LU + 1));
      else if (e.local === 'tab') s += '\t';
      else if (e.local === 'line-break') s += '\n';
      else if (e.local !== 'note' && e.local !== 'ruby-text') lire(e); // span, a, meta, champs…
    }
  };
  let premier = true;
  for (const p of fils(c, NS.text)) {
    if (p.local !== 'p' && p.local !== 'h') continue;
    if (plein()) break;
    if (!premier) s += '\n';
    premier = false;
    lire(p);
  }
  return s;
}

/** { valeur, texte } d'une table:table-cell, ou null si elle est vide. */
function valeurOds(c) {
  const affiche = texteAfficheOds(c);
  const type = attribut(c, NS.office, 'value-type');
  if (type === 'float' || type === 'percentage' || type === 'currency') {
    const n = Number(attribut(c, NS.office, 'value'));
    if (attribut(c, NS.office, 'value') !== undefined && Number.isFinite(n)) return { valeur: n, texte: affiche || texteStandard(n) };
  } else if (type === 'boolean') {
    const b = String(attribut(c, NS.office, 'boolean-value') ?? '').trim().toLowerCase();
    const vrai = b === 'true' || b === '1';
    return { valeur: vrai, texte: affiche || (vrai ? 'TRUE' : 'FALSE') };
  } else if (type === 'date' || type === 'time') {
    const v = attribut(c, NS.office, type === 'date' ? 'date-value' : 'time-value');
    if (v) return { valeur: v, texte: affiche || v };
  }
  const s = attribut(c, NS.office, 'string-value') ?? affiche;
  return s === '' ? null : { valeur: s, texte: s };
}

/** Les draw:frame d'une cellule, directs ou dans un draw:g. */
function* cadresDe(n) {
  for (const e of n.enfants) {
    if (typeof e === 'string' || e.ns !== NS.draw) continue;
    if (e.local === 'frame') yield e;
    else if (e.local === 'g') yield* cadresDe(e);
  }
}

/** « Personnage.E5 », « $'Ma feuille'.$E$5 » → « E5 » ; null sinon. */
function caseDeFin(v) {
  if (!v) return null;
  const ref = String(v).slice(String(v).lastIndexOf('.') + 1).replaceAll('$', '').toUpperCase();
  const position = decouperReference(ref);
  return position ? adresse(position.colonne, position.ligne) : null;
}

function feuilleOds(entrees, f, { fond, types }) {
  const cellules = new Map();
  const images = [];
  const styleDeColonne = stylesDesColonnes(f.table);
  let ligne = 0; // lignes déjà lues

  const lireLigne = (row) => {
    const nLignes = entier(attribut(row, NS.table, 'number-rows-repeated'), 1);
    const styleDeLigne = attribut(row, NS.table, 'default-cell-style-name');
    let colonne = 0; // colonnes déjà lues
    for (const c of fils(row, NS.table)) {
      const couverte = c.local === 'covered-table-cell';
      if (!couverte && c.local !== 'table-cell') continue;
      const nColonnes = entier(attribut(c, NS.table, 'number-columns-repeated'), 1);
      if (couverte) {
        colonne += nColonnes; // case couverte par une fusion : ni valeur (même écrite) ni fond, la zone s'affiche comme sa première case
        continue;
      }
      const contenu = contenuBorne(valeurOds(c));
      const styleDeCase = attribut(c, NS.table, 'style-name') ?? styleDeLigne;
      const fondEn = (col) => fond(styleDeCase ?? styleDeColonne(col));
      if (contenu) {
        if (nColonnes * nLignes > MAX_REPETITION) {
          throw new Error(`La feuille « ${f.nom} » répète une même case ${nColonnes * nLignes} fois (au plus ${MAX_REPETITION}) : fichier refusé.`);
        }
        for (let dl = 1; dl <= nLignes; dl++) {
          for (let dc = 1; dc <= nColonnes; dc++) poserCase(cellules, f.nom, colonne + dc, ligne + dl, contenu, fondEn(colonne + dc));
        }
      } else if (nColonnes <= MAX_REPETITION && nLignes <= MAX_REPETITION && colonne < ZONE_DES_FONDS.colonnes && ligne < ZONE_DES_FONDS.lignes
        && !pleine(cellules) && (styleDeCase === undefined || fondEn(colonne + 1))) {
        // une case seulement remplie : dépliée dans ZONE_DES_FONDS, tant que la grille n'est pas pleine
        const colonnes = Math.min(nColonnes, ZONE_DES_FONDS.colonnes - colonne);
        const lignes = Math.min(nLignes, ZONE_DES_FONDS.lignes - ligne);
        for (let dc = 1; dc <= colonnes && !pleine(cellules); dc++) {
          const remplissage = fondEn(colonne + dc);
          if (remplissage) for (let dl = 1; dl <= lignes && !pleine(cellules); dl++) poserCase(cellules, f.nom, colonne + dc, ligne + dl, null, remplissage);
        }
      }
      if (colonne < MAX_COLONNE && ligne < MAX_LIGNE) {
        for (const cadre of cadresDe(c)) {
          const cible = fils(cadre, NS.draw, 'image')
            .map((im) => attribut(im, NS.xlink, 'href'))
            .map((href) => (href && !/^[a-z][a-z0-9+.-]*:/i.test(href) ? trouverPartie(entrees, href.replace(/^(\.\/|\/)+/, '')) : null))
            .find(Boolean);
          if (!cible) continue; // image liée (adresse externe) ou absente du paquet
          const octets = entrees.get(cible);
          images.push({
            de: adresse(colonne + 1, ligne + 1), a: caseDeFin(attribut(cadre, NS.table, 'end-cell-address')),
            octets, type: typeDImage(octets, types(cible)), nom: attribut(cadre, NS.draw, 'name') ?? '',
            description: texteResolu(filUnique(cadre, NS.svg, 'desc')) || texteResolu(filUnique(cadre, NS.svg, 'title')) || '',
          });
        }
      }
      colonne += nColonnes;
    }
    ligne += nLignes;
  };
  const parcourir = (n) => {
    for (const e of fils(n, NS.table)) {
      if (e.local === 'table-row') lireLigne(e);
      else if (GROUPES_DE_LIGNES.has(e.local)) parcourir(e);
    }
  };
  parcourir(f.table);
  return { nom: f.nom, cellules, images };
}

// =====================================================================================================================================
// CSV
// =====================================================================================================================================
// Windows-1252 de 0x80 à 0x9F (le reste est le latin-1) : décodé ici, TextDecoder('windows-1252') de Node sans ICU complet rendant du latin-1.
const CP1252 = '\u20AC\u0081\u201A\u0192\u201E\u2026\u2020\u2021\u02C6\u2030\u0160\u2039\u0152\u008D\u017D\u008F'
  + '\u0090\u2018\u2019\u201C\u201D\u2022\u2013\u2014\u02DC\u2122\u0161\u203A\u0153\u009D\u017E\u0178';
function windows1252(o) {
  const morceaux = [];
  for (let i = 0; i < o.length; i += 8192) {
    const codes = Array.from(o.subarray(i, i + 8192), (b) => (b >= 0x80 && b < 0xa0 ? CP1252.charCodeAt(b - 0x80) : b));
    morceaux.push(String.fromCharCode(...codes));
  }
  return morceaux.join('');
}

/** Texte d'un CSV : UTF-8 (BOM retiré), UTF-16 avec BOM, sinon Windows-1252 ; un binaire (caractères de contrôle) est refusé. */
function texteDuCsv(o) {
  let texte;
  try {
    if (o[0] === 0xff && o[1] === 0xfe) texte = new TextDecoder('utf-16le', { fatal: true }).decode(o);
    else if (o[0] === 0xfe && o[1] === 0xff) texte = new TextDecoder('utf-16be', { fatal: true }).decode(o);
    else {
      try {
        texte = new TextDecoder('utf-8', { fatal: true }).decode(o);
      } catch {
        texte = windows1252(o);
      }
    }
  } catch {
    throw new Error(PAS_UN_TABLEUR);
  }
  if (/[\u0000-\u0008\u000E-\u0019\u001B-\u001F]/.test(texte)) throw new Error(PAS_UN_TABLEUR);
  return texte;
}

/** Enregistrements d'un CSV (RFC 4180, voir l'en-tête), `max` au plus. */
function decouperCsv(texte, separateur, max = Infinity) {
  const lignes = [];
  let champs = [];
  let champ = '';
  let debutDeChamp = true;
  let i = 0;
  const n = texte.length;
  while (i < n && lignes.length < max) {
    const c = texte[i];
    if (debutDeChamp && c === '"') {
      i++;
      while (i < n) {
        const d = texte[i];
        if (d === '"') {
          if (texte[i + 1] === '"') {
            champ += '"';
            i += 2;
            continue;
          }
          i++;
          break;
        }
        if (d === '\r') {
          champ += '\n';
          i += texte[i + 1] === '\n' ? 2 : 1;
          continue;
        }
        champ += d;
        i++;
      }
      debutDeChamp = false; // ce qui suit le guillemet fermant, jusqu'au séparateur, est gardé tel quel
    } else if (c === separateur) {
      champs.push(champ);
      champ = '';
      debutDeChamp = true;
      i++;
    } else if (c === '\n' || c === '\r') {
      champs.push(champ);
      lignes.push(champs);
      champs = [];
      champ = '';
      debutDeChamp = true;
      i += c === '\r' && texte[i + 1] === '\n' ? 2 : 1;
    } else {
      champ += c;
      debutDeChamp = false;
      i++;
    }
  }
  if (lignes.length < max && (champs.length || !debutDeChamp)) {
    champs.push(champ);
    lignes.push(champs);
  }
  return lignes;
}

/** Le séparateur dont les premières lignes ont le plus souvent le même nombre de colonnes (au moins deux), puis le plus de colonnes. */
function separateurCsv(texte) {
  let meilleur = ',';
  let score = [0, 0];
  for (const separateur of [';', ',', '\t']) {
    const lignes = decouperCsv(texte, separateur, 20).filter((l) => l.length > 1 || l[0] !== '');
    if (!lignes.length) continue;
    const effectifs = new Map();
    for (const l of lignes) effectifs.set(l.length, (effectifs.get(l.length) ?? 0) + 1);
    let colonnes = 0;
    let frequence = 0;
    for (const [k, nb] of effectifs) {
      if (nb > frequence || (nb === frequence && k > colonnes)) [colonnes, frequence] = [k, nb];
    }
    if (colonnes < 2) continue;
    const s = [frequence / lignes.length, colonnes];
    if (s[0] > score[0] || (s[0] === score[0] && s[1] > score[1])) [meilleur, score] = [separateur, s];
  }
  return meilleur;
}

function classeurCsv(texte, nomFichier) {
  const nom = String(nomFichier ?? '').replace(/^.*[\\/]/, '').replace(/\.[^.]*$/, '') || 'Feuille 1';
  const lire = () => {
    const cellules = new Map();
    decouperCsv(texte, separateurCsv(texte)).forEach((champs, i) => {
      champs.forEach((v, j) => {
        if (v !== '') poserCase(cellules, nom, j + 1, i + 1, contenuBorne({ valeur: v, texte: v }), null);
      });
    });
    return { nom, cellules, images: [] };
  };
  return classeur('csv', [{ nom }], lire);
}
