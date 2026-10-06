// Maillage automatique : transforme les mentions du titre (ou d'un alias) d'une autre page en liens [[…]].
// Fonctions pures, sans accès disque : le script client/scripts/autolink.mjs lit et écrit les fichiers.
//
// Principes (la précision prime sur le rappel) :
//   - au plus un lien par page cible dans une page ; jamais vers la page elle-même ;
//   - rien dans le frontmatter, les titres, les tableaux, le code, les liens et URLs existants ;
//   - un titre/alias partagé par plusieurs pages est ignoré (ambigu) ;
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
 * Prépare la liste des termes à lier. `ignore` : locutions à ne jamais lier (ex. « en résumé »).
 * @param {{ id: string, title: string, aliases?: string[] }[]} pages
 * @returns {{ terms: { id: string, title: string, term: string, words: number, regex: RegExp }[], ambiguous: string[] }}
 */
export function buildTerms(pages, { minChars = 4, ignore = [] } = {}) {
  const ignored = new Set(ignore.map(normalize));
  const byKey = new Map();
  for (const page of pages) {
    for (const term of [page.title, ...(page.aliases ?? [])]) {
      if (!term || /[|\]\[]/.test(term)) continue; // casserait la syntaxe [[…|…]]
      const key = normalize(term);
      if (!key) continue;
      const entry = byKey.get(key) ?? { pages: new Set(), term, title: page.title };
      entry.pages.add(page.id);
      if (!byKey.has(key)) byKey.set(key, entry);
    }
  }
  const terms = [];
  const ambiguous = [];
  for (const [key, entry] of byKey) {
    if (entry.pages.size > 1) { ambiguous.push(entry.term); continue; }
    if (ignored.has(key) || entry.term.replace(/\s/g, '').length < minChars) continue;
    const words = entry.term.trim().split(/\s+/);
    const pattern = words.map((w) => escapeRegExp(fold(w))).join('\\s+');
    terms.push({
      id: [...entry.pages][0],
      title: entry.title,
      term: entry.term,
      words: words.length,
      regex: new RegExp(`(?<![\\p{L}\\p{N}_])${pattern}(?![\\p{L}\\p{N}_])`, 'gu'),
    });
  }
  // plus long d'abord : « Philtre du Puissant » avant « Philtre »
  terms.sort((a, b) => b.term.length - a.term.length);
  return { terms, ambiguous };
}

// Portions à ne jamais toucher dans une ligne de texte
const PROTECTED = /(`[^`]*`|\[\[[^\]]*\]\]|\[[^\]]*\]\([^)]*\)|https?:\/\/\S+|<[^>]+>)/g;

/**
 * Insère les liens dans le corps Markdown d'une page (sans son frontmatter).
 * `self` : l'id de la page, ou { id, title, aliases } pour que ce qui figure dans son propre nom ne soit pas lié
 * (« Le Philtre du Savant… » ne doit pas renvoyer vers le métier « Savant »).
 * @returns {{ body: string, links: { id: string, title: string, text: string, line: number }[] }}
 */
export function autolink(body, terms, self, { maxLinks = 25 } = {}) {
  const selfId = typeof self === 'string' ? self : self.id;
  const ownNames = typeof self === 'string' ? [] : buildTerms([{ id: selfId, title: self.title, aliases: self.aliases ?? [] }], { minChars: 1 }).terms;
  const linked = new Set();
  const links = [];
  let inFence = false;

  /** Lie la première occurrence de chaque terme dans un fragment de texte libre. */
  function linkText(text, lineNumber) {
    if (links.length >= maxLinks) return text;
    const folded = fold(text);
    const ownSpans = ownNames.flatMap((n) => { n.regex.lastIndex = 0; return [...folded.matchAll(n.regex)].map((m) => [m.index, m.index + m[0].length]); });
    const matches = [];
    for (const t of terms) {
      if (t.id === selfId || linked.has(t.id)) continue;
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
      out += m.surface === m.t.title ? `[[${m.t.title}]]` : `[[${m.t.title}|${m.surface}]]`;
      links.push({ id: m.t.id, title: m.t.title, text: m.surface, line: lineNumber });
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
