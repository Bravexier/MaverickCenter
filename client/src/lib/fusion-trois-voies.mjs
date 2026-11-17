// Fusion à trois voies d'une valeur modifiée à la fois sur le site de dev et par le code (demande du propriétaire : « Si n'importe quel élément est
// modifiée à la fois par une modification manuelle et par une modification par le code et la livraison d'un build, je site essaye de faire un merge
// automatique entre les deux. Quand un conflit est trop ambigüe seulement là il est listé dans l'onglet mise à jour »). Trois valeurs : `base` (ce que
// le site de dev avait trouvé, l'`avant` de la modification du journal), `site` (ce qu'il a écrit, l'`apres`) et `code` (ce que les règles livrées
// portent aujourd'hui). docs/serveur.md, « Mise à jour (site de dev) », « Fusion à trois voies ».
//
// Un texte long (colonne de type « texte » ou « markdown » du modèle : lib/edition-modele.mjs#colonneFusionnable) se fusionne par passages : ligne
// par ligne d'abord, puis mot à mot dans un passage que les deux côtés ont touché. Deux changements qui ne se touchent pas (au moins une ligne, ou un
// mot, inchangé entre eux) se gardent tous les deux ; deux changements qui se recouvrent ou se touchent, et ne sont pas identiques, rendent la fusion
// ambiguë (choix conservateur, comme `git merge` : on ne devine jamais l'ordre de deux ajouts au même endroit). Une valeur courte (nombre, case, nom,
// choix d'une liste) ne se fusionne jamais : changée différemment des deux côtés, elle est ambiguë.
// Une balise du glossaire (« {{id|texte}} ») compte pour un seul mot, comme lib/notes-de-version-rendu.mjs#diffMots : une fusion ne la coupe jamais.
// Les fins de ligne (« \r\n », « \r ») sont lues comme « \n » ; le résultat garde « \r\n » si la version du site l'écrivait partout.
// Pur, sans import ni navigateur (skill site-version-portable) : partagé par le rejeu du journal (serveur/edition-journal.mjs#evaluerUne), l'examen et
// la résolution des conflits (serveur/edition-conflits.mjs).

/** Cases du tableau de la plus longue sous-suite commune au-delà desquelles on renonce à fusionner (la valeur est alors ambiguë). */
export const LIMITE_DE_FUSION = 1_500_000;

/** Les lignes d'un texte, chacune avec sa fin de ligne (recollées, elles redonnent le texte). */
const lignesDe = (t) => t.match(/[^\n]*\n|[^\n]+$/g) ?? [];
/** Les mots d'un texte : une suite de blancs, ou une suite sans blanc où une balise du glossaire compte pour un seul morceau (diffMots). */
const motsDe = (t) => t.match(/\s+|(?:\{\{[^{}\n]*\}\}|[^\s{]+|\{)+/g) ?? [];

const egal = (a, b) => (a ?? null) === (b ?? null);
const normaliser = (t) => t.replace(/\r\n?/g, '\n');
/** Le site écrit-il ses fins de ligne « \r\n » partout (au moins une, et aucun « \n » seul) ? */
const enCrLf = (t) => typeof t === 'string' && t.includes('\r\n') && !/(^|[^\r])\n/.test(t);

/**
 * Les changements qui mènent de la suite `a` à la suite `b` : [{ debut, fin, remplacement }] (les éléments [debut, fin) de `a` remplacés par
 * `remplacement`, une insertion a debut = fin), dans l'ordre, par la plus longue sous-suite commune ; null au-delà de LIMITE_DE_FUSION.
 */
function changements(a, b) {
  let p = 0;
  while (p < a.length && p < b.length && a[p] === b[p]) p += 1;
  let s = 0;
  while (s < a.length - p && s < b.length - p && a[a.length - 1 - s] === b[b.length - 1 - s]) s += 1;
  const n = a.length - p - s;
  const m = b.length - p - s;
  if (n === 0 && m === 0) return [];
  if (n === 0 || m === 0) return [{ debut: p, fin: p + n, remplacement: b.slice(p, p + m) }];
  if ((n + 1) * (m + 1) > LIMITE_DE_FUSION) return null;
  const largeur = m + 1;
  const t = new Uint32Array((n + 1) * largeur);
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      t[i * largeur + j] = a[p + i] === b[p + j] ? t[(i + 1) * largeur + j + 1] + 1 : Math.max(t[(i + 1) * largeur + j], t[i * largeur + j + 1]);
    }
  }
  const sortie = [];
  let courant = null;
  const fermer = () => {
    if (courant) sortie.push(courant);
    courant = null;
  };
  let i = 0;
  let j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && a[p + i] === b[p + j]) {
      fermer();
      i += 1;
      j += 1;
    } else if (j >= m || (i < n && t[(i + 1) * largeur + j] >= t[i * largeur + j + 1])) {
      courant ??= { debut: p + i, fin: p + i, remplacement: [] };
      courant.fin = p + i + 1;
      i += 1;
    } else {
      courant ??= { debut: p + i, fin: p + i, remplacement: [] };
      courant.remplacement.push(b[p + j]);
      j += 1;
    }
  }
  fermer();
  return sortie;
}

/** La version d'un côté sur la plage [debut, fin) de `base`, ses changements (tous dans la plage) appliqués. */
function versionSur(base, changes, debut, fin) {
  const sortie = [];
  let k = debut;
  for (const c of changes) {
    sortie.push(...base.slice(k, c.debut), ...c.remplacement);
    k = c.fin;
  }
  sortie.push(...base.slice(k, fin));
  return sortie;
}
const memesSuites = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

/**
 * Fusionne deux suites (lignes ou mots) modifiées depuis `base` : { valeur: [] } si les changements ne se recouvrent ni ne se touchent (ou sont
 * identiques), sinon { passages: [{ base, site, code }] } (suites), null si trop long. `affiner(passage)` : une fusion plus fine d'un passage que les
 * deux côtés ont touché ({ valeur } ou null) — les mots d'un groupe de lignes. `separe(debut, fin)` : les éléments [debut, fin) de `base`, laissés
 * intacts entre deux changements, suffisent-ils à les séparer (une ligne au moins ; entre deux mots, un mot qui n'est pas un blanc) ?
 */
function fusionnerLesSuites(base, site, code, { affiner = null, separe = (debut, fin) => fin > debut } = {}) {
  const cs = changements(base, site);
  const cc = changements(base, code);
  if (!cs || !cc) return null;
  const tous = [...cs.map((c) => ({ ...c, cote: 'site' })), ...cc.map((c) => ({ ...c, cote: 'code' }))].sort((x, y) => x.debut - y.debut || x.fin - y.fin);
  const groupes = [];
  for (const c of tous) {
    const g = groupes.at(-1);
    // deux changements qui se recouvrent ou se touchent (une insertion au bord d'un autre changement, rien qui les sépare) : un seul groupe
    if (g && (c.debut <= g.fin || !separe(g.fin, c.debut))) {
      g.fin = Math.max(g.fin, c.fin);
      g[c.cote].push(c);
    } else groupes.push({ debut: c.debut, fin: c.fin, site: c.cote === 'site' ? [c] : [], code: c.cote === 'code' ? [c] : [] });
  }
  // la fusion, chaque passage en conflit pris du côté du site (siteGagne) ou du code (codeGagne) ; sans conflit, les deux sont la fusion
  const siteGagne = [];
  const codeGagne = [];
  const pousser = (x, y = x) => {
    siteGagne.push(...x);
    codeGagne.push(...y);
  };
  const passages = [];
  let k = 0;
  for (const g of groupes) {
    pousser(base.slice(k, g.debut));
    k = g.fin;
    const versionSite = versionSur(base, g.site, g.debut, g.fin);
    const versionCode = versionSur(base, g.code, g.debut, g.fin);
    if (!g.code.length || memesSuites(versionSite, versionCode)) {
      pousser(versionSite);
      continue;
    }
    if (!g.site.length) {
      pousser(versionCode);
      continue;
    }
    const passage = { base: base.slice(g.debut, g.fin), site: versionSite, code: versionCode };
    const fin = affiner?.(passage);
    if (fin) pousser(fin.valeur);
    else {
      passages.push(passage);
      pousser(versionSite, versionCode);
    }
  }
  pousser(base.slice(k));
  return passages.length ? { passages, siteGagne, codeGagne } : { valeur: siteGagne };
}

/**
 * Fusionne trois textes (fins de ligne « \n ») : { valeur } ou { passages: [{ base, site, code }], siteGagne, codeGagne } (textes ; trop longs : un
 * seul passage, le texte entier, et les deux côtés tels quels).
 */
function fusionnerLesTextes(base, site, code) {
  const parMots = (p) => {
    const base = motsDe(p.base.join(''));
    // deux changements séparés par des blancs seulement se touchent (une page réécrite et un paragraphe ajouté au bout : ambigu)
    const separe = (debut, fin) => base.slice(debut, fin).some((x) => /\S/.test(x));
    const r = fusionnerLesSuites(base, motsDe(p.site.join('')), motsDe(p.code.join('')), { separe });
    return r?.valeur ? { valeur: [r.valeur.join('')] } : null;
  };
  const r = fusionnerLesSuites(lignesDe(base), lignesDe(site), lignesDe(code), { affiner: parMots });
  if (!r) return { passages: [{ base, site, code }], siteGagne: site, codeGagne: code };
  if (r.valeur) return { valeur: r.valeur.join('') };
  return {
    passages: r.passages.map((p) => ({ base: p.base.join(''), site: p.site.join(''), code: p.code.join('') })),
    siteGagne: r.siteGagne.join(''), codeGagne: r.codeGagne.join(''),
  };
}

/**
 * Fusion à trois voies d'une valeur : `base` (ce que le site avait trouvé), `site` (ce qu'il a écrit), `code` (ce que les règles livrées portent).
 * `texte` : la valeur est un texte long fusionnable (sinon une valeur courte, jamais fusionnée). Rend { issue, valeur?, passages } :
 *   - 'identique' : le site et le code disent la même chose (valeur : celle-là) ;
 *   - 'site' : le code n'a rien changé (valeur : celle du site) ; 'code' : le site n'a rien changé (valeur : celle du code) ;
 *   - 'fusionnee' : les deux ont changé des passages qui ne se touchent pas (valeur : les deux changements) ;
 *   - 'ambigue' : changée différemment des deux côtés au même endroit, ou valeur courte, ou texte trop long pour une fusion utile — pas de `valeur` ;
 *     `passages` : les passages en conflit d'un texte, [{ base, site, code }] (vide pour une valeur courte) ; `siteGagne` : la fusion où chaque
 *     passage en conflit prend le côté du site et le reste est fusionné (les changements du code hors conflit gardés : réponse du propriétaire
 *     « Les garder ») ; `codeGagne` : la même, côté code (les changements du site hors conflit gardés). Une valeur courte : le site, le code.
 * Les comparaisons d'un texte lisent ses fins de ligne en « \n ».
 */
export function fusionner(base, site, code, { texte = false } = {}) {
  if (egal(site, code)) return { issue: 'identique', valeur: site ?? null, passages: [] };
  if (egal(base, code)) return { issue: 'site', valeur: site ?? null, passages: [] };
  if (egal(base, site)) return { issue: 'code', valeur: code ?? null, passages: [] };
  const lisible = (v) => v === null || v === undefined || typeof v === 'string';
  if (!texte || !lisible(base) || !lisible(site) || !lisible(code)) return { issue: 'ambigue', passages: [], siteGagne: site ?? null, codeGagne: code ?? null };
  const [b, s, c] = [base, site, code].map((v) => normaliser(v ?? ''));
  // ne diffèrent que par leurs fins de ligne
  if (s === c) return { issue: 'identique', valeur: site ?? null, passages: [] };
  if (b === c) return { issue: 'site', valeur: site ?? null, passages: [] };
  if (b === s) return { issue: 'code', valeur: code ?? null, passages: [] };
  const r = fusionnerLesTextes(b, s, c);
  // les fins de ligne du site s'il écrit « \r\n » partout ; un texte vidé par le site reste null
  const ecrit = (t, vide) => {
    const v = enCrLf(site) ? t.replace(/\n/g, '\r\n') : t;
    return v === '' && (vide === null || vide === undefined) ? null : v;
  };
  if (r.passages) return { issue: 'ambigue', passages: r.passages, siteGagne: ecrit(r.siteGagne, site), codeGagne: ecrit(r.codeGagne, code) };
  return { issue: 'fusionnee', valeur: ecrit(r.valeur, site), passages: [] };
}
