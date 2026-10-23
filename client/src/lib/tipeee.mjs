// La partie « Bienvenue » de la page Tipeee de MaverickJDR, reprise telle quelle sur l'accueil du site (réponses du propriétaire du
// 2026-10-22 : « autant en faire un hook pour que ça reprenne directement le texte au cas où il change sur Tipee » ; texte repris : « La partie
// « Bienvenue » », de « Bienvenue sur le Tipeee de MaverickJDR ! » jusqu'à la fin ; « En direct par le serveur »).
//
// Module pur, sans dépendance (ni navigateur, ni Node, ni Astro) : le service le lit pour relire Tipeee (serveur/tipeee.mjs, GET /api/tipeee/), le
// build pour l'instantané livré avec le site, la page pour comparer les paragraphes.
//
// La source : l'API publique du projet (URL_API ; la page fr.tipeee.com est rendue en JavaScript), champ contentv2.translations.fr.html, un HTML
// avec des styles et des emojis en images. On n'en garde que du TEXTE, jamais du HTML :
//   - commentaires, et script, style, iframe, svg… avec leur contenu, retirés ; toute autre balise retirée (images comprises : les emojis de Tipeee
//     sont des <img>), son texte gardé ;
//   - un bloc (p, div, h1…h6, li…) est un paragraphe ; dans un paragraphe, un <br> seul est un retour à la ligne (« \n »), deux <br> de suite (des
//     espaces entre eux au plus) séparent deux paragraphes ;
//   - les espaces ASCII (espace, tabulation, fins de ligne) se réduisent à une espace, comme le rendu d'un navigateur ; l'espace insécable reste ;
//     chaque ligne est rognée, les lignes et les paragraphes vides disparaissent ;
//   - entités HTML décodées en une passe (&#N;, &#xH;, et les entités nommées d'ENTITES ; une autre reste telle qu'écrite) ;
//   - le paragraphe qui contient le repère (REPERE, cherché sans tenir compte de la casse ni des espaces) est coupé juste avant lui, et l'on garde
//     depuis lui jusqu'à la fin.
// Aujourd'hui (réponse lue le 2026-10-22) : trois paragraphes, environ 600 caractères.

/** L'API publique du projet (une adresse fixe : rien de ce que demande un visiteur n'y entre). */
export const URL_API = 'https://api.tipeee.com/v2.0/projects/maverickjdr';
/** La page Tipeee elle-même (le lien que suit un visiteur). */
export const URL_PAGE = 'https://fr.tipeee.com/maverickjdr';
/** Le début de la partie reprise (réponse du propriétaire du 2026-10-22). */
export const REPERE = 'Bienvenue sur le Tipeee de MaverickJDR !';
/**
 * L'instantané livré avec le site (chemin depuis la racine du dépôt) : le texte affiché au build et le premier repli du service.
 * Format : { url: URL_API, lu_le: "<ISO 8601>", paragraphes: ["…", …] } (instantaneValide).
 */
export const CHEMIN_INSTANTANE = 'sources/tipeee/bienvenue.json';
/** Bornes du texte gardé : au-delà, la réponse n'est pas prise (le dernier texte connu reste). */
export const PARAGRAPHES_MAX = 40;
export const CARACTERES_MAX = 8000;

/** Les raisons d'un refus de bienvenueDeTipeee, et ce que le journal du service en dit. */
export const RAISONS = Object.freeze({
  'reponse-invalide': 'la réponse de Tipeee n’est pas le JSON attendu (contentv2.translations.fr.html)',
  'html-vide': 'la présentation du projet est vide',
  'repere-absent': `le repère « ${REPERE} » est introuvable dans la présentation du projet`,
  'texte-trop-long': `la partie « Bienvenue » dépasse ${PARAGRAPHES_MAX} paragraphes ou ${CARACTERES_MAX} caractères`,
});

/** Éléments retirés avec leur contenu. */
const SANS_CONTENU = ['script', 'style', 'iframe', 'noscript', 'template', 'svg', 'math', 'object', 'textarea', 'select', 'title', 'head'];
/** Éléments qui font un paragraphe. */
const BLOCS = new Set(['address', 'article', 'aside', 'blockquote', 'center', 'dd', 'details', 'dialog', 'div', 'dl', 'dt', 'fieldset', 'figcaption',
  'figure', 'footer', 'form', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'hr', 'li', 'main', 'nav', 'ol', 'p', 'pre', 'section', 'summary', 'table',
  'tbody', 'td', 'tfoot', 'th', 'thead', 'tr', 'ul', 'body', 'html']);

/** Entités nommées décodées (les plus courantes dans un texte français) ; une autre reste telle qu'écrite. */
export const ENTITES = Object.freeze({
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', thinsp: ' ', ensp: ' ', emsp: ' ', shy: '­',
  rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', laquo: '«', raquo: '»', sbquo: '‚', bdquo: '„', hellip: '…', ndash: '–', mdash: '—',
  bull: '•', middot: '·', deg: '°', euro: '€', copy: '©', reg: '®', trade: '™', times: '×', iexcl: '¡', iquest: '¿',
  agrave: 'à', aacute: 'á', acirc: 'â', auml: 'ä', aelig: 'æ', ccedil: 'ç', egrave: 'è', eacute: 'é', ecirc: 'ê', euml: 'ë', icirc: 'î', iuml: 'ï',
  ocirc: 'ô', ouml: 'ö', oelig: 'œ', ugrave: 'ù', uacute: 'ú', ucirc: 'û', uuml: 'ü', yuml: 'ÿ', ntilde: 'ñ',
  Agrave: 'À', Aacute: 'Á', Acirc: 'Â', Auml: 'Ä', AElig: 'Æ', Ccedil: 'Ç', Egrave: 'È', Eacute: 'É', Ecirc: 'Ê', Euml: 'Ë', Icirc: 'Î', Iuml: 'Ï',
  Ocirc: 'Ô', Ouml: 'Ö', OElig: 'Œ', Ugrave: 'Ù', Uacute: 'Ú', Ucirc: 'Û', Uuml: 'Ü', Yuml: 'Ÿ', Ntilde: 'Ñ',
});

/** Décode les entités d'un texte, en une passe (« &amp;lt; » donne « &lt; »). */
export function decoderEntites(texte) {
  if (!texte.includes('&')) return texte;
  return texte.replace(/&(?:#(\d{1,7})|#[xX]([0-9a-fA-F]{1,6})|([A-Za-z][A-Za-z0-9]{1,31}));/g, (m, decimal, hexa, nom) => {
    if (nom !== undefined) return Object.hasOwn(ENTITES, nom) ? ENTITES[nom] : m;
    const code = decimal !== undefined ? Number.parseInt(decimal, 10) : Number.parseInt(hexa, 16);
    // NUL, demi-paires de substitution et hors d'Unicode : le caractère de remplacement, comme un navigateur
    if (!(code >= 1 && code <= 0x10ffff) || (code >= 0xd800 && code <= 0xdfff)) return '�';
    return String.fromCodePoint(code);
  });
}

/** Une balise : `<nom …>`, `</nom>`, `<nom …/>` ; les valeurs d'attribut entre guillemets peuvent contenir « > ». */
const BALISE = /<(\/?)([A-Za-z][A-Za-z0-9:-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g;

/** Retire les commentaires, déclarations et les éléments SANS_CONTENU avec tout ce qu'ils contiennent (non fermé : jusqu'à la fin). */
function sansLeNonTexte(html) {
  let s = html.replace(/<!--[\s\S]*?(?:-->|$)/g, ' ').replace(/<![^>]*>/g, ' ').replace(/<\?[^>]*>/g, ' ');
  for (const nom of SANS_CONTENU) {
    s = s.replace(new RegExp(`<${nom}\\b(?:[^>"']|"[^"]*"|'[^']*')*>[\\s\\S]*?(?:</${nom}\\s*>|$)`, 'gi'), ' ');
  }
  return s;
}

/** Les lignes d'un morceau de paragraphe (« \n » = un <br>), les espaces de suite réduits (d'un élément à l'autre aussi), rognées, sans les vides. */
const lignesDe = (texte) => texte.split('\n').map((l) => l.replace(/ {2,}/g, ' ').trim()).filter(Boolean);

/**
 * Le texte d'un HTML, en paragraphes (voir l'en-tête) : un tableau de chaînes, chacune ses lignes jointes par « \n ». Jamais de balise : ce qui ressemble
 * à une balise sans en être une (« a < b ») reste du texte.
 * @param {string} html
 * @returns {string[]}
 */
export function paragraphesDuHtml(html) {
  if (typeof html !== 'string' || !html) return [];
  const source = sansLeNonTexte(html);
  const paragraphes = [];
  let courant = ''; // le paragraphe en cours : texte et « \n » (un <br>)
  let brDeSuite = 0; // <br> lus depuis le dernier texte non vide
  const clore = () => {
    const lignes = lignesDe(courant);
    if (lignes.length) paragraphes.push(lignes.join('\n'));
    courant = '';
    brDeSuite = 0;
  };
  const texte = (brut) => {
    if (!brut) return;
    // les balises retirées : un « < » ou un « > » restant est du texte ; espaces ASCII réduits (l'insécable reste), entités décodées ensuite
    const t = decoderEntites(brut.replace(/[ \t\n\f\r]+/g, ' ')).replace(/[\t\n\f\r]+/g, ' ');
    if (t.trim()) brDeSuite = 0;
    courant += t;
  };
  let position = 0;
  for (const m of source.matchAll(BALISE)) {
    texte(source.slice(position, m.index));
    position = m.index + m[0].length;
    const nom = m[2].toLowerCase();
    if (nom === 'br') {
      brDeSuite += 1;
      if (brDeSuite >= 2) clore();
      else courant += '\n';
    } else if (BLOCS.has(nom)) {
      clore();
    }
  }
  texte(source.slice(position));
  clore();
  return paragraphes;
}

/** Un texte réduit pour chercher le repère : en minuscules, sans aucun espace (insécables compris) ; avec, pour chaque caractère gardé, sa place. */
function reduit(texte) {
  let s = '';
  const places = [];
  let i = 0;
  for (const c of texte) {
    if (!/\s/u.test(c)) {
      const bas = c.toLowerCase();
      s += bas;
      for (let k = 0; k < bas.length; k += 1) places.push(i);
    }
    i += c.length;
  }
  return { s, places };
}

/** Le repère réduit (sans casse ni espaces). */
const REPERE_REDUIT = reduit(REPERE).s;

/**
 * Les paragraphes depuis le repère (sans tenir compte de la casse ni des espaces) jusqu'à la fin ; null si le repère n'y est pas.
 * @param {string[]} paragraphes
 * @param {string} [repere]
 */
export function depuisLeRepere(paragraphes, repere = REPERE) {
  const cherche = repere === REPERE ? REPERE_REDUIT : reduit(repere).s;
  if (!cherche) return null;
  for (let i = 0; i < paragraphes.length; i += 1) {
    const { s, places } = reduit(paragraphes[i]);
    const k = s.indexOf(cherche);
    if (k < 0) continue;
    return [paragraphes[i].slice(places[k]), ...paragraphes.slice(i + 1)];
  }
  return null;
}

/** Le HTML de la présentation du projet dans une réponse de l'API (objet ou texte JSON) ; undefined si la réponse n'a pas cette forme. */
function htmlDeLaReponse(reponse) {
  let o = reponse;
  if (typeof o === 'string') {
    try {
      o = JSON.parse(o);
    } catch {
      return undefined;
    }
  }
  const html = o?.contentv2?.translations?.fr?.html;
  return typeof html === 'string' ? html : undefined;
}

/**
 * La partie « Bienvenue » d'une réponse de l'API Tipeee (l'objet, ou le texte JSON reçu) → { paragraphes } ; sinon { raison, message } (RAISONS) :
 * réponse qui n'est pas le JSON attendu, présentation vide, repère absent, texte au-delà des bornes.
 * @param {unknown} reponse
 * @returns {{ paragraphes: string[] } | { raison: keyof typeof RAISONS, message: string }}
 */
export function bienvenueDeTipeee(reponse) {
  const refus = (raison) => ({ raison, message: RAISONS[raison] });
  const html = htmlDeLaReponse(reponse);
  if (html === undefined) return refus('reponse-invalide');
  const tous = paragraphesDuHtml(html);
  if (!tous.length) return refus('html-vide');
  const paragraphes = depuisLeRepere(tous);
  if (!paragraphes) return refus('repere-absent');
  if (!dansLesBornes(paragraphes)) return refus('texte-trop-long');
  return { paragraphes };
}

/** Des paragraphes non vides, de texte, dans les bornes (PARAGRAPHES_MAX, CARACTERES_MAX). */
function dansLesBornes(paragraphes) {
  if (!Array.isArray(paragraphes) || !paragraphes.length || paragraphes.length > PARAGRAPHES_MAX) return false;
  let total = 0;
  for (const p of paragraphes) {
    if (typeof p !== 'string' || !p.trim()) return false;
    total += p.length;
  }
  return total <= CARACTERES_MAX;
}

/**
 * Un instantané (ou le dernier texte gardé par le service) valide → { url, lu_le, paragraphes } ; sinon null. `lu_le` : un instant ISO 8601 lisible ;
 * `paragraphes` : des textes non vides dans les bornes ; `url` : un texte (l'adresse lue, URL_API).
 * @param {unknown} o
 */
export function instantaneValide(o) {
  if (!o || typeof o !== 'object' || Array.isArray(o)) return null;
  const { url, lu_le: luLe, paragraphes } = o;
  if (typeof url !== 'string' || !url || typeof luLe !== 'string' || !Number.isFinite(Date.parse(luLe))) return null;
  if (!dansLesBornes(paragraphes)) return null;
  return { url, lu_le: luLe, paragraphes: [...paragraphes] };
}

/** L'instantané d'une réponse de l'API lue à `luLe` (ISO 8601) → { url, lu_le, paragraphes } ; { raison, message } si elle n'a pas la partie. */
export function instantaneDe(reponse, luLe) {
  const r = bienvenueDeTipeee(reponse);
  return 'raison' in r ? r : { url: URL_API, lu_le: luLe, paragraphes: r.paragraphes };
}

/** Vrai si les deux listes de paragraphes sont les mêmes (la page ne remplace son texte que s'il diffère). */
export function memesParagraphes(a, b) {
  return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((p, i) => p === b[i]);
}
