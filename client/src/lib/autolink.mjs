// Maillage automatique : transforme les mentions d'un mot-clé à adresse (son libellé, ou le titre ou un alias de la page où il mène) en balises de ce
// mot-clé. Depuis la migration 0098 (décision du propriétaire : « tous les liens deviendront des mots-clés et tous les mots-clés deviendront des
// liens »), un lien est la balise d'un mot-clé dont `mot_cle.url` porte l'adresse : « {{id}} » quand le texte est son libellé, « {{id|texte}} » sinon
// (forme canonique d'un texte mis en forme, lib/mots-cles-balises.mjs#formeCanonique) ; jamais un [[lien]], que db:check refuse. Le maillage ne crée
// jamais de mot-clé : une page sans mot-clé qui y mène n'est pas une cible (ciblesDuVocabulaire).
// Fonctions pures, sans accès disque : le script client/scripts/autolink.mjs lit et écrit les fichiers.
//
// Principes (la précision prime sur le rappel) :
//   - au plus une balise par mot-clé dans une page (une balise déjà écrite compte) ; jamais vers la page elle-même ;
//   - rien dans le frontmatter, les titres, les tableaux, le code, les balises, liens et URLs existants ;
//   - une écriture partagée par plusieurs mots-clés est ignorée (ambiguë) ;
//   - un terme d'un seul mot n'est lié que s'il est écrit avec une majuscule (« Forgeron » oui, « forgeron » non),
//     pour ne pas transformer chaque nom commun en lien ;
//   - le plus long terme gagne (« Philtre du Puissant » avant « Philtre »), et les mots sont comparés entiers.
import { normalize } from './text.mjs';

/**
 * Même longueur que le texte d'origine (indispensable : les positions trouvées dans le texte replié servent
 * à découper le texte d'origine) : minuscules, sans accents, apostrophes et espaces insécables normalisés.
 * Un caractère dont le repli changerait la longueur (emoji, « İ »…) est conservé tel quel.
 */
export function fold(text) {
  let out = '';
  for (const ch of text) {
    let base = ch.length === 1 ? ch.normalize('NFD')[0] : ch;
    const lower = base.toLowerCase();
    if (lower.length === base.length) base = lower;
    out += base === '’' || base === '‘' ? "'" : base === '\u00a0' || base === '\u202f' ? ' ' : base;
  }
  return out;
}

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Types dont le corps est refait depuis les tables par l'édition du site de dev, en entier ou par sections (rendus des importeurs : lib/corps-races.mjs,
 * corps-classes.mjs, corps-magies.mjs, corps-metiers.mjs) : une balise posée dans leur corps serait perdue à la première modification, et
 * tools/db/races_onglet.py --verifier comme test/corps-classes refusent un corps qui ne redit pas l'importeur ; le corps d'un métier est exactement le
 * rendu de sa ligne depuis la migration 0098 (corps_md === corpsDeMetier(ligne), test/corps-metiers.test.mjs). De même les pages `lore`, que leur
 * importeur réécrit à l'identique : le Codex (tools/docs/codex.py, dont --verifier veut chaque page à l'octet près du découpage) et « Relations entre
 * les races » (tools/sheets/relations-races.py). Le maillage ne les modifie pas (leurs mots-clés restent des cibles).
 */
export const TYPES_SANS_MAILLAGE = new Set(['races', 'classes', 'capacites', 'magies', 'metiers', 'lore']);
/** La page reçoit-elle des liens du maillage ? */
export const aMailler = (page) => !TYPES_SANS_MAILLAGE.has(page.type ?? String(page.id ?? '').split('/')[0]);

/**
 * Les cibles du maillage : chaque mot-clé à adresse (`url`), avec la page où mène son adresse (`pageDuMotCle` : id du mot-clé -> id de la page, ou
 * null pour une rubrique ou une route sans page : lib/adresses-db.mjs#pageDeLAdresse) et ses écritures en plus du libellé : le titre et les alias de
 * cette page quand il est le seul mot-clé à y mener (sinon, son libellé seul). Une page (de `pages`) à laquelle aucun mot-clé ne mène n'est pas une
 * cible : le maillage ne crée jamais de mot-clé (règle de la migration 0056) ; elle est rendue dans `sansMotCle`.
 * @param {{ id: string, libelle: string, url?: string|null }[]} motsCles
 * @param {{ id: string, title: string, aliases?: string[] }[]} pages
 * @param {Map<string, string|null>} pageDuMotCle
 * @returns {{ cibles: { id: string, libelle: string, page: string|null, termes: string[] }[], sansMotCle: string[] }}
 */
export function ciblesDuVocabulaire(motsCles, pages, pageDuMotCle) {
  const avecUrl = motsCles.filter((m) => typeof m?.url === 'string' && m.url);
  const parPage = new Map();
  for (const m of avecUrl) {
    const page = pageDuMotCle.get(m.id) ?? null;
    if (page) parPage.set(page, [...(parPage.get(page) ?? []), m.id]);
  }
  const pagesParId = new Map(pages.map((p) => [p.id, p]));
  const cibles = avecUrl.map((m) => {
    const page = pageDuMotCle.get(m.id) ?? null;
    const p = page && parPage.get(page).length === 1 ? pagesParId.get(page) : null;
    return { id: m.id, libelle: m.libelle, page, termes: p ? [p.title, ...(p.aliases ?? [])] : [] };
  });
  return { cibles, sansMotCle: pages.filter((p) => !parPage.has(p.id)).map((p) => p.id) };
}

/**
 * Prépare la liste des termes à lier : les écritures de chaque cible (son libellé, puis ses `termes`). `ignore` : locutions à ne jamais lier (ex.
 * « en résumé »).
 * @param {{ id: string, libelle: string, page?: string|null, termes?: string[] }[]} cibles   ciblesDuVocabulaire
 * @returns {{ terms: { id: string, libelle: string, page: string|null, term: string, words: number, regex: RegExp }[], ambiguous: string[] }}
 */
export function buildTerms(cibles, { minChars = 4, ignore = [] } = {}) {
  const ignored = new Set(ignore.map(normalize));
  const byKey = new Map();
  for (const cible of cibles) {
    for (const term of [cible.libelle, ...(cible.termes ?? [])]) {
      if (!term || /[|\]\[{}\n]/.test(term)) continue; // casserait la syntaxe {{id|…}}
      const key = normalize(term);
      if (!key) continue;
      const entry = byKey.get(key) ?? { cibles: new Map(), term };
      entry.cibles.set(cible.id, cible);
      if (!byKey.has(key)) byKey.set(key, entry);
    }
  }
  const terms = [];
  const ambiguous = [];
  for (const [key, entry] of byKey) {
    if (entry.cibles.size > 1) { ambiguous.push(entry.term); continue; }
    if (ignored.has(key) || entry.term.replace(/\s/g, '').length < minChars) continue;
    const words = entry.term.trim().split(/\s+/);
    const pattern = words.map((w) => escapeRegExp(fold(w))).join('\\s+');
    const [cible] = entry.cibles.values();
    terms.push({
      id: cible.id,
      libelle: cible.libelle,
      page: cible.page ?? null,
      term: entry.term,
      words: words.length,
      regex: new RegExp(`(?<![\\p{L}\\p{N}_])${pattern}(?![\\p{L}\\p{N}_])`, 'gu'),
    });
  }
  // plus long d'abord : « Philtre du Puissant » avant « Philtre »
  terms.sort((a, b) => b.term.length - a.term.length);
  return { terms, ambiguous };
}

// Portions à ne jamais toucher dans une ligne de texte : code, balise du glossaire, lien, URL, balise HTML
const PROTECTED = /(`[^`]*`|\{\{[^{}]*\}\}|\[\[[^\]]*\]\]|\[[^\]]*\]\([^)]*\)|https?:\/\/\S+|<[^>]+>)/g;
/** Les mots-clés déjà balisés dans un texte (la ref d'une balise de la base est un id : forme canonique). */
const DEJA_BALISES = /\{\{([a-z0-9-]+)\s*(?:\\?\||:|\}\})/g;

/**
 * Insère les balises dans le corps Markdown d'une page (sans son frontmatter).
 * `self` : l'id de la page, ou { id, title, aliases } pour que ce qui figure dans son propre nom ne soit pas lié
 * (« Le Philtre du Savant… » ne doit pas renvoyer vers le métier « Savant »).
 * @returns {{ body: string, links: { id: string, page: string|null, libelle: string, text: string, line: number }[] }}
 */
export function autolink(body, terms, self, { maxLinks = 25 } = {}) {
  const selfId = typeof self === 'string' ? self : self.id;
  const ownNames = typeof self === 'string' ? [] : buildTerms([{ id: selfId, libelle: self.title, termes: self.aliases ?? [] }], { minChars: 1 }).terms;
  // un mot-clé déjà balisé dans la page n'est pas balisé une seconde fois (idempotent)
  const linked = new Set([...body.matchAll(DEJA_BALISES)].map((m) => m[1]));
  const links = [];
  let inFence = false;

  /** Lie la première occurrence de chaque terme dans un fragment de texte libre. */
  function linkText(text, lineNumber) {
    if (links.length >= maxLinks) return text;
    const folded = fold(text);
    const ownSpans = ownNames.flatMap((n) => { n.regex.lastIndex = 0; return [...folded.matchAll(n.regex)].map((m) => [m.index, m.index + m[0].length]); });
    const matches = [];
    for (const t of terms) {
      if ((t.page && t.page === selfId) || linked.has(t.id)) continue;
      t.regex.lastIndex = 0;
      for (const m of folded.matchAll(t.regex)) {
        if (ownSpans.some(([a, b]) => m.index < b && m.index + m[0].length > a)) continue; // dans le nom de la page
        const surface = text.slice(m.index, m.index + m[0].length);
        if (t.words === 1 && !/^\p{Lu}/u.test(surface)) continue; // nom commun : on ne lie pas
        matches.push({ start: m.index, end: m.index + m[0].length, t, surface });
        break; // première occurrence valable seulement
      }
    }
    // De gauche à droite, le plus long d'abord à position égale ; on écarte les chevauchements
    matches.sort((a, b) => a.start - b.start || b.end - b.start - (a.end - a.start));
    const kept = [];
    let cursor = -1;
    for (const m of matches) {
      if (m.start < cursor || linked.has(m.t.id)) continue;
      if (links.length + kept.length >= maxLinks) break;
      kept.push(m);
      cursor = m.end;
      linked.add(m.t.id);
    }
    if (!kept.length) return text;
    let out = '';
    let pos = 0;
    for (const m of kept) {
      out += text.slice(pos, m.start);
      out += m.surface === m.t.libelle ? `{{${m.t.id}}}` : `{{${m.t.id}|${m.surface}}}`;
      links.push({ id: m.t.id, page: m.t.page, libelle: m.t.libelle, text: m.surface, line: lineNumber });
      pos = m.end;
    }
    return out + text.slice(pos);
  }

  const lines = body.split('\n').map((line, index) => {
    if (/^\s*(```|~~~)/.test(line)) { inFence = !inFence; return line; }
    if (inFence || /^\s*#{1,6}\s/.test(line) || /^\s*\|/.test(line) || /^\s*<!--/.test(line)) return line;
    return line
      .split(PROTECTED)
      .map((part, i) => (i % 2 === 1 || !part ? part : linkText(part, index + 1)))
      .join('');
  });

  return { body: lines.join('\n'), links };
}
