// Index des décisions (A3) : logique pure de scripts/decisions-index.mjs (npm run decisions:index), épinglée par test/decisions-index.test.mjs.
// Lit le registre docs/decisions-regles.md (tableau Markdown, une ligne par décision R…) et produit docs/decisions-index.md : une ligne par
// décision, `Rn | sujet | décision`, dans l'ordre du registre. Le sujet est le début de la colonne « Question » (LARGEUR_SUJET caractères au plus),
// la décision le début de la colonne « Décision » (LARGEUR_DECISION) ; coupe nette au caractère (graphème : jamais un caractère Unicode coupé en
// deux), « … » ajouté dans la limite. Sans fichier ni processus : le script lit et écrit, ce module ne fait que transformer des textes.

/** Largeurs des colonnes de l'index, en caractères (graphèmes), « … » compris. */
export const LARGEUR_SUJET = 75;
export const LARGEUR_DECISION = 55;
/** Taille visée de l'index (25 Ko) : un dépassement est signalé, jamais corrigé seul (les largeurs sont fixées par le brief A3). */
export const TAILLE_CIBLE = 25 * 1024;

export const CHEMIN_REGISTRE = 'docs/decisions-regles.md';
export const CHEMIN_INDEX = 'docs/decisions-index.md';

const REF = /^R([0-9]+)$/;
const graphemes = new Intl.Segmenter('fr', { granularity: 'grapheme' });

/**
 * Cellules d'une ligne de tableau Markdown (règle GFM) : séparées par les `|` non échappés ; une barre oblique inverse échappe le caractère qui
 * la suit (`\|` reste dans la cellule, `\\|` est une barre oblique échappée suivie d'un séparateur). Les `|` de début et de fin sont retirés.
 * Les cellules sont rendues telles qu'écrites (échappements compris), sans les espaces du bord. Une ligne qui ne commence pas par `|` : null.
 */
export function cellules(ligne) {
  const l = ligne.trim();
  if (!l.startsWith('|')) return null;
  const morceaux = [];
  let courant = '';
  for (let i = 1; i < l.length; i += 1) {
    const c = l[i];
    if (c === '\\' && i + 1 < l.length) { courant += c + l[i + 1]; i += 1; } else if (c === '|') { morceaux.push(courant); courant = ''; } else courant += c;
  }
  if (courant.trim() !== '') morceaux.push(courant); // ligne sans `|` final
  return morceaux.map((m) => m.trim());
}

/** Texte lisible d'une cellule : `\|` → `|`, `<br>` → espace, gras `**` retiré, blancs réunis. */
export function texteDeCellule(cellule) {
  return cellule
    .replace(/\\\|/g, '|')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/\*\*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Coupe nette : au plus `largeur` graphèmes ; si le texte est plus long, les `largeur - 1` premiers (blancs de fin retirés) puis « … ». */
export function couper(texte, largeur) {
  const g = Array.from(graphemes.segment(texte), (s) => s.segment);
  if (g.length <= largeur) return texte;
  return `${g.slice(0, Math.max(0, largeur - 1)).join('').trimEnd()}…`;
}

/** Longueur en graphèmes (ce que compte `couper`). */
export const longueur = (texte) => Array.from(graphemes.segment(texte)).length;

/** Un texte rendu sûr pour une cellule de l'index : ses `|` sont échappés (sinon ils casseraient le tableau produit). */
export const echapperCellule = (texte) => texte.replace(/\|/g, '\\|');

/**
 * Les décisions du registre : seules comptent les lignes de tableau dont la 1re cellule est `R<n>` (les autres tableaux, l'en-tête, le texte
 * libre et les blocs de code ``` sont ignorés). Renvoie { decisions: [{ ref, numero, ligne, question, decision }], erreurs, avertissements } :
 * erreur pour un numéro en double ou une ligne R… de moins de 3 cellules ; avertissement (sans erreur) pour un trou dans la numérotation ou un
 * numéro hors de l'ordre croissant.
 */
export function analyserRegistre(texte) {
  const decisions = [];
  const erreurs = [];
  const avertissements = [];
  let dansCode = false;
  texte.split(/\r?\n/).forEach((ligne, i) => {
    if (/^\s*(```|~~~)/.test(ligne)) { dansCode = !dansCode; return; }
    if (dansCode) return;
    const c = cellules(ligne);
    if (!c?.length) return;
    const m = REF.exec(c[0]);
    if (!m) return;
    if (c.length < 3) { erreurs.push(`ligne ${i + 1} : ${c[0]} n'a que ${c.length} cellule(s), il en faut au moins 3 (Réf., Question, Décision)`); return; }
    decisions.push({ ref: c[0], numero: Number(m[1]), ligne: i + 1, question: texteDeCellule(c[1]), decision: texteDeCellule(c[2]) });
  });

  const vues = new Map();
  for (const d of decisions) {
    if (vues.has(d.numero)) erreurs.push(`${d.ref} en double : lignes ${vues.get(d.numero)} et ${d.ligne}`);
    else vues.set(d.numero, d.ligne);
  }
  decisions.forEach((d, i) => {
    if (i > 0 && d.numero < decisions[i - 1].numero) avertissements.push(`${d.ref} (ligne ${d.ligne}) vient après ${decisions[i - 1].ref} : ordre non croissant`);
  });
  if (vues.size) {
    const max = Math.max(...vues.keys());
    const manquants = [];
    for (let n = 1; n <= max; n += 1) if (!vues.has(n)) manquants.push(`R${n}`);
    if (manquants.length) avertissements.push(`trou dans la numérotation : ${manquants.join(', ')} absent(s)`);
  }
  if (!decisions.length) erreurs.push('aucune décision trouvée (ligne de tableau dont la 1re cellule est R<n>)');
  return { decisions, erreurs, avertissements };
}

/** Une ligne de l'index pour une décision. */
export const ligneDIndex = (d) =>
  `| ${d.ref} | ${echapperCellule(couper(d.question, LARGEUR_SUJET))} | ${echapperCellule(couper(d.decision, LARGEUR_DECISION))} |`;

/** Texte complet de l'index (fin de ligne LF, saut de ligne final). */
export function produireIndex(decisions) {
  const premiere = decisions[0]?.ref ?? '—';
  const derniere = decisions.at(-1)?.ref ?? '—';
  return [
    '# Index des décisions du propriétaire',
    '',
    `Ne lis jamais \`${CHEMIN_REGISTRE}\` en entier : trouve ici le numéro de la décision, puis cherche sa ligne avec Grep (motif \`^\\| R41 \\|\`) et ne lis qu'elle.`,
    '',
    `Fichier fabriqué par \`npm run decisions:index\` (depuis \`client/\`), à ne pas modifier à la main : ${decisions.length} décisions, de ${premiere} à ${derniere}, dans l'ordre du registre. Sujet : début de la colonne « Question » ; décision : début de la colonne « Décision ».`,
    '',
    '| Réf. | Sujet | Décision |',
    '| --- | --- | --- |',
    ...decisions.map(ligneDIndex),
    '',
  ].join('\n');
}

/** Taille en octets (UTF-8) d'un texte. */
export const octets = (texte) => Buffer.byteLength(texte, 'utf8');

/**
 * Contrôle de l'index sans rien écrire : { aJour, attendu, analyse }. `indexActuel` null ou undefined (fichier absent) : pas à jour. Les fins de
 * ligne CRLF d'une copie Windows ne comptent pas.
 */
export function verifier(texteRegistre, indexActuel) {
  const analyse = analyserRegistre(texteRegistre);
  const attendu = produireIndex(analyse.decisions);
  const aJour = indexActuel != null && indexActuel.replace(/\r\n/g, '\n') === attendu;
  return { aJour, attendu, analyse };
}
