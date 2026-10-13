// Portrait d'une fiche de personnage ou d'une carte de monstre (fiche : migration 0031 ; bestiaire : demande du propriétaire, « il sera possible
// d'enregistrer le portrait de la même manière que dans la feuille de personnage », migration 0033). L'image choisie est réduite par la page
// (src/scripts/portrait.mjs : 600 000 pixels au plus, data URL WebP, ou JPEG si le navigateur ne sait pas écrire le WebP, sous 700 000 caractères :
// data/schema.sql) ; elle garde son cadrage : le centre x, y du cadre carré dans l'image (de 0 à 1) et le zoom (de 1 à 4 ; le côté du carré est le petit
// côté de l'image divisé par le zoom). L'image d'origine reste : on peut recadrer plus tard.
// Ici, sans dépendance (navigateur, build et service) : bornes du cadrage, style CSS qui montre le carré sans script (cadre en position relative et
// overflow caché, image en absolu), dimensions lues dans l'en-tête de l'image (WebP, JPEG, PNG), empreinte (nom de fichier, notes de version).

/** Limite de la base (data/schema.sql : personnage.portrait, monstre.portrait, monstre_espece.portrait). */
export const PORTRAIT_MAX = 700_000;
/** L'image gardée : 600 000 pixels au plus (assez pour recadrer)… */
export const PIXELS_MAX_PORTRAIT = 600_000;
/** … et sa data URL sous la limite de la base. */
export const LONGUEUR_MAX_PORTRAIT = 690_000;
export const ZOOM_MIN = 1;
export const ZOOM_MAX = 4;
/** Le cadrage d'une image qui n'en a pas : centré, sans zoom. */
export const CADRAGE_PAR_DEFAUT = Object.freeze({ x: 0.5, y: 0.5, zoom: 1 });

const FORMAT = /^data:image\/(webp|jpeg|png);base64,([A-Za-z0-9+/]+={0,2})$/;
const EXTENSIONS = { webp: 'webp', jpeg: 'jpg', png: 'png' };

/** Une data URL d'image que la page sait écrire (WebP, JPEG ou PNG en base64), sous la limite de la base. */
export const estUnPortrait = (v) => typeof v === 'string' && v.length <= PORTRAIT_MAX && FORMAT.test(v);

const borner = (v, min, max) => Math.min(max, Math.max(min, v));
const arrondi = (v) => Math.round(v * 10000) / 10000;

/** Le cadrage enregistré (centré, sans zoom pour une valeur absente). */
export const cadrageDe = ({ x, y, zoom } = {}) => ({ x: x ?? CADRAGE_PAR_DEFAUT.x, y: y ?? CADRAGE_PAR_DEFAUT.y, zoom: zoom ?? CADRAGE_PAR_DEFAUT.zoom });

/**
 * Le cadrage ramené dans l'image (`dimensions` : { largeur, hauteur } en pixels) : zoom de 1 à 4, et le carré tout entier dans l'image (son centre à au
 * moins un demi-côté de chaque bord), arrondi à 4 décimales comme l'enregistre la page.
 */
export function bornerCadrage(cadrage, { largeur, hauteur }) {
  const c = cadrageDe(cadrage);
  const zoom = borner(Number(c.zoom) || 1, ZOOM_MIN, ZOOM_MAX);
  const petit = Math.min(largeur, hauteur);
  const demiX = petit / (2 * largeur * zoom);
  const demiY = petit / (2 * hauteur * zoom);
  return { x: arrondi(borner(Number(c.x), demiX, 1 - demiX)), y: arrondi(borner(Number(c.y), demiY, 1 - demiY)), zoom: arrondi(zoom) };
}

/** Le carré à découper dans l'image, en pixels : { gauche, haut, cote }. */
export function carreDuCadrage(cadrage, { largeur, hauteur }) {
  const { x, y, zoom } = cadrageDe(cadrage);
  const cote = Math.min(largeur, hauteur) / zoom;
  return { gauche: x * largeur - cote / 2, haut: y * hauteur - cote / 2, cote };
}

/**
 * Le style de l'image dans un cadre carré (position relative, overflow caché) pour qu'il en montre le carré cadré, en pourcentages du cadre : la même
 * vue que la vignette de la fiche, sans script. Sans dimensions connues : l'image couvre le cadre, centrée (le cadrage ne peut pas s'appliquer).
 */
export function styleDuCadrage(cadrage, dimensions) {
  if (!dimensions?.largeur || !dimensions?.hauteur) return 'width:100%;height:100%;left:0;top:0;object-fit:cover';
  const { gauche, haut, cote } = carreDuCadrage(cadrage, dimensions);
  const pc = (v) => `${arrondi((v / cote) * 100)}%`;
  return `width:${pc(dimensions.largeur)};height:${pc(dimensions.hauteur)};left:${pc(-gauche)};top:${pc(-haut)}`;
}

/** Les octets d'une data URL d'image (les `max` premiers seulement si demandé), ou null si ce n'en est pas une. */
export function octetsDuPortrait(donnees, max = Infinity) {
  const m = FORMAT.exec(String(donnees ?? ''));
  if (!m) return null;
  // 4 caractères base64 = 3 octets : on ne décode que ce qu'il faut
  const base64 = Number.isFinite(max) ? m[2].slice(0, Math.ceil(max / 3) * 4) : m[2];
  const binaire = atob(base64);
  const octets = new Uint8Array(binaire.length);
  for (let i = 0; i < binaire.length; i += 1) octets[i] = binaire.charCodeAt(i);
  return octets;
}

const SOF = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
const texte4 = (o, i) => String.fromCharCode(o[i], o[i + 1], o[i + 2], o[i + 3]);

/** Largeur et hauteur d'une image en octets, lues dans son en-tête (WebP VP8, VP8L ou VP8X, JPEG, PNG) ; null si l'en-tête n'est pas lisible. */
export function dimensionsDesOctets(o) {
  if (!o || o.length < 30) return null;
  if (texte4(o, 0) === 'RIFF' && texte4(o, 8) === 'WEBP') {
    const morceau = texte4(o, 12);
    if (morceau === 'VP8 ' && o[23] === 0x9d && o[24] === 0x01 && o[25] === 0x2a) {
      return { largeur: (o[26] | (o[27] << 8)) & 0x3fff, hauteur: (o[28] | (o[29] << 8)) & 0x3fff };
    }
    if (morceau === 'VP8L' && o[20] === 0x2f) {
      return { largeur: 1 + (((o[22] & 0x3f) << 8) | o[21]), hauteur: 1 + (((o[24] & 0x0f) << 10) | (o[23] << 2) | ((o[22] & 0xc0) >> 6)) };
    }
    if (morceau === 'VP8X') return { largeur: 1 + (o[24] | (o[25] << 8) | (o[26] << 16)), hauteur: 1 + (o[27] | (o[28] << 8) | (o[29] << 16)) };
    return null;
  }
  if (o[0] === 0x89 && texte4(o, 1) === 'PNG\r' && texte4(o, 12) === 'IHDR') {
    const lire = (i) => ((o[i] << 24) | (o[i + 1] << 16) | (o[i + 2] << 8) | o[i + 3]) >>> 0;
    return { largeur: lire(16), hauteur: lire(20) };
  }
  if (o[0] === 0xff && o[1] === 0xd8) {
    let i = 2;
    while (i + 9 < o.length) {
      if (o[i] !== 0xff) return null;
      const marque = o[i + 1];
      if (marque === 0xff) {
        i += 1; // octet de remplissage
        continue;
      }
      if (marque === 0x01 || (marque >= 0xd0 && marque <= 0xd7)) {
        i += 2; // marque sans longueur
        continue;
      }
      if (SOF.has(marque)) return { largeur: (o[i + 7] << 8) | o[i + 8], hauteur: (o[i + 5] << 8) | o[i + 6] };
      i += 2 + ((o[i + 2] << 8) | o[i + 3]);
    }
    return null;
  }
  return null;
}

/** Largeur et hauteur d'une data URL d'image (les 64 premiers kilo-octets suffisent à l'en-tête d'une image écrite par la page) ; null sinon. */
export function dimensionsDuPortrait(donnees) {
  const d = dimensionsDesOctets(octetsDuPortrait(donnees, 65_536));
  return d && d.largeur > 0 && d.hauteur > 0 ? d : null;
}

/**
 * Empreinte d'un texte : deux FNV-1a de 32 bits (bases différentes) en 16 caractères hexadécimaux. Nomme le fichier d'un portrait au build et le dit
 * dans les notes de version et l'historique (sans y recopier l'image).
 */
export function empreinte(texte) {
  const s = String(texte ?? '');
  let a = 0x811c9dc5;
  let b = 0x01000193 ^ 0x5bd1e995;
  for (let i = 0; i < s.length; i += 1) {
    const c = s.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193) >>> 0;
    b = Math.imul(b ^ c, 0x01000193) >>> 0;
  }
  return a.toString(16).padStart(8, '0') + b.toString(16).padStart(8, '0');
}

/** Le nom du fichier d'un portrait publié par le build (« 3f2a…9c.webp ») : son empreinte et l'extension de son format ; null si ce n'en est pas un. */
export function fichierDuPortrait(donnees) {
  const m = FORMAT.exec(String(donnees ?? ''));
  return m ? `${empreinte(donnees)}.${EXTENSIONS[m[1]]}` : null;
}

/** Le poids d'une image, en kilo-octets (environ 3 octets par 4 caractères de base64). */
export const kiloOctetsDuPortrait = (donnees) => Math.round((String(donnees ?? '').replace(/^[^,]*,/, '').length * 3) / 4 / 1024);

/** Une image dite sans être recopiée : « image 3f2a9c01 (84 Ko) » (notes de version, historique, pages de la base). */
export const resumeDuPortrait = (donnees) => (donnees ? `image ${empreinte(donnees).slice(0, 8)} (${kiloOctetsDuPortrait(donnees)} Ko)` : null);
