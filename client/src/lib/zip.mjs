// Lecture et écriture d'archives ZIP, sans dépendance : le .xlsx et le .ods de la fiche de personnage en tableur (demande du propriétaire,
// 2026-10-15 : « La fiche de personnage doit pouvoir être importée et exportée à tout moment depuis un Excel ou Google Sheet »).
// Module de format, sans rapport avec le jeu ; réservé à src/scripts/fiche.mjs (et aux modules du tableur, aux tests) : un module importé par deux
// scripts de page casse la version portable (CLAUDE.md, « Pièges connus »).
//
// Décisions (relevées sur les fichiers de LibreOffice, Excel et Google Sheets) :
//   - le répertoire central fait foi pour les tailles et le CRC : LibreOffice écrit des data descriptors (bit 3) et laisse l'en-tête local à 0 ;
//     le début des données se calcule sur l'en-tête local, dont l'« extra » peut différer de celui du répertoire central ;
//   - la fin du répertoire central (EOCD) se cherche à reculons (commentaire de 65 535 octets au plus) et n'est retenue que si son commentaire
//     finit exactement le fichier ; des octets placés avant l'archive (archive auto-extractible) décalent tout, comme le lit `unzip` ;
//   - méthodes 0 (stockée) et 8 (deflate) seulement ; chiffrement, ZIP64 et archives en plusieurs volumes refusés (jamais utiles ici) ;
//   - noms : UTF-8 si le bit 11 le déclare, sinon UTF-8 strict puis latin1 (beaucoup d'outils écrivent de l'UTF-8 sans le dire) ; un nom
//     absolu (« /… ») ou qui remonte (segment « .. ») est refusé, comme un nom en double ; les entrées de dossier (« …/ ») sont ignorées ;
//   - bombes : les tailles décompressées annoncées par le répertoire central sont bornées (`maxEntree` par entrée, MAX_ENTREE = 16 Mio ;
//     `maxTotal` pour leur somme, MAX_TOTAL = 64 Mio : une fiche en est loin, un onglet de navigateur tient) et vérifiées toutes AVANT la
//     première décompression ; une décompression s'arrête dès qu'elle dépasse la taille annoncée ; taille réelle et CRC vérifiés ;
//   - écriture : en-têtes complets (jamais de data descriptor), aucun « extra » (un .ods veut « mimetype » en premier, stocké, sans extra :
//     son contenu à l'octet 38), deflate seulement s'il gagne, heure DOS tirée de `date` en UTC (la même Date donne les mêmes octets quel que
//     soit le fuseau ; défaut 1980-01-01 00:00 : sortie déterministe).
// Deflate par CompressionStream / DecompressionStream « deflate-raw » (globaux dans Node 22 et les navigateurs récents : Chrome 103,
// Firefox 113, Safari 16.4) ; sans eux, l'écriture stocke sans compresser et la lecture d'une entrée compressée le dit clairement.

const SIG_LOCAL = 0x04034b50;
const SIG_CENTRAL = 0x02014b50;
const SIG_FIN = 0x06054b50;
const SIG_LOCALISATEUR_ZIP64 = 0x07064b50;
const TAILLE_FIN = 22;
const MIO = 2 ** 20;

/** Taille décompressée permise d'une entrée, et de toutes les entrées ensemble (lireZip). */
export const MAX_ENTREE = 16 * MIO;
export const MAX_TOTAL = 64 * MIO;

/** Erreur de lecture, au message français commun. */
const illisible = (raison) => new Error(`Fichier ZIP illisible : ${raison}`);
/** Une taille lisible : « 1 Mio », « 0,5 Mio » (au dixième), « 1000 octets » (moins de 0,1 Mio). */
const taille = (n) => (n >= MIO / 10 ? `${String(Math.round((n / MIO) * 10) / 10).replace('.', ',')} Mio` : `${n} octets`);
const tropGrand = (raison) => new Error(`Le classeur dépasse la taille permise : ${raison}`);
const impossible = (raison) => new Error(`Fichier ZIP impossible à écrire : ${raison}`);

// ---------- CRC-32 (polynôme 0xEDB88320, celui de ZIP) ----------
const TABLE_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

/** CRC-32 d'une suite d'octets (entier non signé). */
export function crc32(octets) {
  let c = 0xffffffff;
  for (let i = 0; i < octets.length; i++) c = TABLE_CRC[(c ^ octets[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// ---------- deflate « brut » par les flux du navigateur / de Node ----------
/** Construit le flux demandé, ou null s'il manque (navigateur trop ancien, ou sans « deflate-raw »). */
function flux(nom) {
  const Classe = globalThis[nom];
  if (typeof Classe !== 'function') return null;
  try {
    return new Classe('deflate-raw');
  } catch {
    return null;
  }
}

/** Fait passer `octets` dans `transformation` ; rend null dès que la sortie dépasserait `limite` (le flux est alors abandonné). */
async function parFlux(octets, transformation, limite = Infinity) {
  const lecteur = new Blob([octets]).stream().pipeThrough(transformation).getReader();
  const morceaux = [];
  let taille = 0;
  for (;;) {
    const { done, value } = await lecteur.read();
    if (done) break;
    taille += value.length;
    if (taille > limite) {
      await lecteur.cancel().catch(() => {});
      return null;
    }
    morceaux.push(value);
  }
  return concatener(morceaux, taille);
}

function concatener(morceaux, taille = morceaux.reduce((s, m) => s + m.length, 0)) {
  const sortie = new Uint8Array(taille);
  let p = 0;
  for (const m of morceaux) {
    sortie.set(m, p);
    p += m.length;
  }
  return sortie;
}

/** Décompresse une entrée de méthode 8 ; `null` si la sortie dépasse la taille annoncée. */
async function gonfler(brut, tailleAnnoncee, nom) {
  if (brut.length === 0 && tailleAnnoncee === 0) return new Uint8Array(0);
  const transformation = flux('DecompressionStream');
  if (!transformation) {
    throw illisible('ce navigateur ne sait pas décompresser (DecompressionStream « deflate-raw » absent) ; essayez avec un navigateur à jour.');
  }
  try {
    return await parFlux(brut, transformation, tailleAnnoncee);
  } catch {
    throw illisible(`données compressées abîmées (« ${nom} »).`);
  }
}

// ---------- noms ----------
const UTF8_STRICT = new TextDecoder('utf-8', { fatal: true });
const LATIN1 = new TextDecoder('latin1'); // à défaut de CP437 : les noms OOXML et ODF sont ASCII en pratique
const ENCODEUR = new TextEncoder();

function nomDe(octets, drapeaux) {
  if (drapeaux & 0x800) {
    try {
      return UTF8_STRICT.decode(octets);
    } catch {
      throw illisible('nom d’entrée déclaré en UTF-8 mais mal codé.');
    }
  }
  try {
    return UTF8_STRICT.decode(octets);
  } catch {
    return LATIN1.decode(octets);
  }
}

/** Un nom absolu ou qui remonte dans l'arborescence (« ../ », aussi avec « \ ») ne désigne pas une partie du document. */
function nomDangereux(nom) {
  return nom === '' || nom.startsWith('/') || nom.startsWith('\\') || nom.split(/[\\/]/).includes('..');
}

// ---------- lecture ----------
/** Position de la fin du répertoire central, cherchée à reculons ; -1 si absente. */
function chercherFin(zip, v) {
  const plusTot = Math.max(0, zip.length - TAILLE_FIN - 0xffff);
  for (let i = zip.length - TAILLE_FIN; i >= plusTot; i--) {
    if (zip[i] === 0x50 && v.getUint32(i, true) === SIG_FIN && i + TAILLE_FIN + v.getUint16(i + 20, true) === zip.length) return i;
  }
  return -1;
}

/**
 * Lit une archive ZIP : Map<nom, octets> dans l'ordre du répertoire central (dossiers exclus). Refuse ce qui n'est pas sûr ou pas pris en
 * charge (voir l'en-tête) par une Error « Fichier ZIP illisible : … », ce qui dépasse les tailles permises par une Error « Le classeur dépasse
 * la taille permise : … » (avant toute décompression).
 * @param {Uint8Array | ArrayBuffer} octets
 * @param {{ maxEntree?: number, maxTotal?: number }} [limites] tailles décompressées permises (une entrée, toute l'archive), en octets
 * @returns {Promise<Map<string, Uint8Array>>}
 */
export async function lireZip(octets, { maxEntree = MAX_ENTREE, maxTotal = MAX_TOTAL } = {}) {
  if (!(octets instanceof ArrayBuffer) && !ArrayBuffer.isView(octets)) throw illisible('aucun octet à lire.');
  // une vue Uint8Array simple (un Buffer de Node a un slice() qui ne copie pas)
  const zip = octets instanceof ArrayBuffer ? new Uint8Array(octets) : new Uint8Array(octets.buffer, octets.byteOffset, octets.byteLength);
  if (zip.length < TAILLE_FIN) throw illisible('fichier trop court pour une archive.');
  const v = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);

  const fin = chercherFin(zip, v);
  if (fin < 0) throw illisible('fin du répertoire central introuvable (ce n’est pas une archive ZIP, ou elle est tronquée).');
  if (fin >= 20 && v.getUint32(fin - 20, true) === SIG_LOCALISATEUR_ZIP64) throw illisible('archive ZIP64, non prise en charge.');
  if (v.getUint16(fin + 4, true) !== 0 || v.getUint16(fin + 6, true) !== 0) throw illisible('archive en plusieurs volumes, non prise en charge.');
  const nombre = v.getUint16(fin + 10, true);
  const tailleCentral = v.getUint32(fin + 12, true);
  const debutCentral = v.getUint32(fin + 16, true);
  if (nombre === 0xffff || tailleCentral === 0xffffffff || debutCentral === 0xffffffff) throw illisible('archive ZIP64, non prise en charge.');
  if (v.getUint16(fin + 8, true) !== nombre) throw illisible('archive en plusieurs volumes, non prise en charge.');
  // octets avant l'archive (programme d'auto-extraction…) : les décalages écrits sont relatifs au début de l'archive
  const base = fin - tailleCentral - debutCentral;
  if (base < 0) throw illisible('répertoire central hors de l’archive.');

  // 1. le répertoire central entier, tailles annoncées comprises, avant de décompresser quoi que ce soit
  const aLire = [];
  const noms = new Set();
  let p = base + debutCentral;
  let total = 0;
  for (let n = 0; n < nombre; n++) {
    if (p + 46 > fin || v.getUint32(p, true) !== SIG_CENTRAL) throw illisible('répertoire central abîmé.');
    const drapeaux = v.getUint16(p + 8, true);
    const methode = v.getUint16(p + 10, true);
    const crc = v.getUint32(p + 16, true);
    const tailleC = v.getUint32(p + 20, true);
    const tailleU = v.getUint32(p + 24, true);
    const lNom = v.getUint16(p + 28, true);
    const lExtra = v.getUint16(p + 30, true);
    const lCommentaire = v.getUint16(p + 32, true);
    const local = v.getUint32(p + 42, true);
    if (p + 46 + lNom > fin) throw illisible('répertoire central abîmé.');
    const nom = nomDe(zip.subarray(p + 46, p + 46 + lNom), drapeaux);
    p += 46 + lNom + lExtra + lCommentaire;

    if (tailleC === 0xffffffff || tailleU === 0xffffffff || local === 0xffffffff) throw illisible(`entrée ZIP64 (« ${nom} »), non prise en charge.`);
    if (drapeaux & 0x41) throw illisible(`entrée chiffrée (« ${nom} »), non prise en charge.`);
    if (nomDangereux(nom)) throw illisible(`nom d’entrée refusé : « ${nom} ».`);
    if (nom.endsWith('/')) continue; // dossier
    if (noms.has(nom)) throw illisible(`entrée en double : « ${nom} ».`);
    noms.add(nom);
    if (methode !== 0 && methode !== 8) throw illisible(`méthode de compression ${methode} non prise en charge (« ${nom} »).`);
    if (tailleU > maxEntree) throw tropGrand(`« ${nom} » ferait ${taille(tailleU)} une fois décompressé (au plus ${taille(maxEntree)} par partie).`);
    total += tailleU;
    aLire.push({ nom, methode, crc, tailleC, tailleU, local });
  }
  if (total > maxTotal) throw tropGrand(`il ferait ${taille(total)} une fois décompressé (au plus ${taille(maxTotal)}).`);

  // 2. les données, dans l'ordre du répertoire central
  const entrees = new Map();
  for (const { nom, methode, crc, tailleC, tailleU, local } of aLire) {
    // en-tête local : ses longueurs de nom et d'extra peuvent différer de celles du répertoire central
    const tete = base + local;
    if (tete + 30 > zip.length || v.getUint32(tete, true) !== SIG_LOCAL) throw illisible(`en-tête local introuvable (« ${nom} »).`);
    const debut = tete + 30 + v.getUint16(tete + 26, true) + v.getUint16(tete + 28, true);
    if (debut + tailleC > base + debutCentral) throw illisible(`données de « ${nom} » hors de l’archive.`);
    const brut = zip.subarray(debut, debut + tailleC);

    let donnees;
    if (methode === 0) {
      if (tailleC !== tailleU) throw illisible(`taille incohérente (« ${nom} »).`);
      donnees = brut.slice();
    } else {
      donnees = await gonfler(brut, tailleU, nom);
      if (donnees === null) throw illisible(`« ${nom} » se décompresse au-delà de sa taille annoncée (${tailleU} octets).`);
    }
    if (donnees.length !== tailleU) throw illisible(`taille réelle inattendue (« ${nom} »).`);
    if (crc32(donnees) !== crc) throw illisible(`CRC faux (« ${nom} »).`);
    entrees.set(nom, donnees);
  }
  return entrees;
}

// ---------- écriture ----------
const JOUR_1980 = (1 << 5) | 1; // 1980-01-01, l'origine des dates DOS

/** Heure et jour DOS (UTC), bornés à la plage du format (1980 à 2107). */
function dateDos(date) {
  if (date == null) return { heure: 0, jour: JOUR_1980 };
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) throw impossible('date invalide.');
  const annee = date.getUTCFullYear();
  if (annee < 1980) return { heure: 0, jour: JOUR_1980 };
  if (annee > 2107) return { heure: (23 << 11) | (59 << 5) | 29, jour: (127 << 9) | (12 << 5) | 31 };
  return {
    heure: (date.getUTCHours() << 11) | (date.getUTCMinutes() << 5) | (date.getUTCSeconds() >> 1),
    jour: ((annee - 1980) << 9) | ((date.getUTCMonth() + 1) << 5) | date.getUTCDate(),
  };
}

/** Compresse si le navigateur le sait et si c'est plus petit ; sinon garde les octets tels quels (méthode 0). */
async function comprimer(donnees) {
  if (donnees.length === 0) return { methode: 0, comprimes: donnees };
  const transformation = flux('CompressionStream');
  if (!transformation) return { methode: 0, comprimes: donnees };
  const comprimes = await parFlux(donnees, transformation, donnees.length - 1);
  return comprimes ? { methode: 8, comprimes } : { methode: 0, comprimes: donnees };
}

/**
 * Écrit une archive ZIP, entrées dans l'ordre donné (pour un .ods, « mimetype » d'abord).
 * @param {Iterable<[string, Uint8Array | ArrayBuffer | string]>} entrees nom et contenu (une chaîne est écrite en UTF-8)
 * @param {{ stocker?: (nom: string) => boolean, date?: Date }} [options] `stocker(nom)` vrai = jamais compressé ; `date` des entrées
 * @returns {Promise<Uint8Array>}
 */
export async function ecrireZip(entrees, { stocker = (nom) => nom === 'mimetype', date } = {}) {
  const { heure, jour } = dateDos(date);
  const morceaux = [];
  const central = [];
  const vus = new Set();
  let decalage = 0;
  for (const [nom, contenu] of entrees) {
    if (typeof nom !== 'string' || nomDangereux(nom)) throw impossible(`nom d’entrée refusé : « ${nom} ».`);
    if (vus.has(nom)) throw impossible(`entrée en double : « ${nom} ».`);
    vus.add(nom);
    let donnees;
    if (typeof contenu === 'string') donnees = ENCODEUR.encode(contenu);
    else if (contenu instanceof Uint8Array) donnees = contenu;
    else if (contenu instanceof ArrayBuffer) donnees = new Uint8Array(contenu);
    else throw impossible(`contenu de « ${nom} » ni texte ni octets.`);
    const octetsNom = ENCODEUR.encode(nom);
    if (octetsNom.length > 0xffff) throw impossible(`nom trop long : « ${nom.slice(0, 40)}… ».`);
    if (donnees.length >= 0xffffffff) throw impossible(`« ${nom} » trop grand (ZIP64 non pris en charge).`);
    const crc = crc32(donnees);
    const { methode, comprimes } = stocker(nom) ? { methode: 0, comprimes: donnees } : await comprimer(donnees);
    const drapeaux = octetsNom.some((o) => o > 0x7f) ? 0x800 : 0; // bit 11 : nom en UTF-8

    const tete = new Uint8Array(30 + octetsNom.length);
    const t = new DataView(tete.buffer);
    t.setUint32(0, SIG_LOCAL, true);
    t.setUint16(4, 20, true); // version nécessaire : 2.0 (deflate)
    t.setUint16(6, drapeaux, true);
    t.setUint16(8, methode, true);
    t.setUint16(10, heure, true);
    t.setUint16(12, jour, true);
    t.setUint32(14, crc, true);
    t.setUint32(18, comprimes.length, true);
    t.setUint32(22, donnees.length, true);
    t.setUint16(26, octetsNom.length, true);
    t.setUint16(28, 0, true); // pas d'extra
    tete.set(octetsNom, 30);

    const c = new Uint8Array(46 + octetsNom.length);
    const cv = new DataView(c.buffer);
    cv.setUint32(0, SIG_CENTRAL, true);
    cv.setUint16(4, 20, true); // écrite par : MS-DOS, 2.0
    cv.setUint16(6, 20, true);
    cv.setUint16(8, drapeaux, true);
    cv.setUint16(10, methode, true);
    cv.setUint16(12, heure, true);
    cv.setUint16(14, jour, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, comprimes.length, true);
    cv.setUint32(24, donnees.length, true);
    cv.setUint16(28, octetsNom.length, true);
    cv.setUint32(42, decalage, true);
    c.set(octetsNom, 46);

    central.push(c);
    morceaux.push(tete, comprimes);
    decalage += tete.length + comprimes.length;
    if (decalage >= 0xffffffff) throw impossible('archive trop grande (ZIP64 non pris en charge).');
  }
  if (central.length >= 0xffff) throw impossible('trop d’entrées (ZIP64 non pris en charge).');
  const tailleCentral = central.reduce((s, c) => s + c.length, 0);
  const fin = new Uint8Array(TAILLE_FIN);
  const f = new DataView(fin.buffer);
  f.setUint32(0, SIG_FIN, true);
  f.setUint16(8, central.length, true);
  f.setUint16(10, central.length, true);
  f.setUint32(12, tailleCentral, true);
  f.setUint32(16, decalage, true);
  return concatener([...morceaux, ...central, fin]);
}
