// Éditeur visuel du guide (site de dev, src/scripts/edition/guide.mjs) : le texte d'une page se modifie en place (texte, liens, mise en page, tableaux
// et couleur de leurs cases : demande du propriétaire), puis cet HTML est réécrit en Markdown, le format des pages (page.corps_md).
// Ici, sans dépendance : un arbre simple { type: 'texte', valeur } | { type: 'element', nom, attributs, enfants } (le script le tire du DOM, les tests
// d'un HTML analysé) → Markdown, dans les écritures du site : liens [[cible|texte]] (attribut data-cible posé par lib/wikilinks.mjs), tableaux GFM,
// couleur de case « {couleur:vert} » en tête de case (lib/markdown-couleurs.mjs). test/markdown-edition.test.mjs rejoue l'aller-retour
// Markdown → HTML → Markdown → HTML sur toutes les pages du guide : le rendu ne change pas.

/** Couleurs de case permises (une classe CSS par couleur : styles/global/wiki.css). */
export const COULEURS_DE_CASE = ['rouge', 'orange', 'jaune', 'vert', 'bleu', 'violet', 'gris'];

const BLOCS = new Set(['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'blockquote', 'pre', 'hr', 'table', 'section', 'article', 'figure']);
const IGNORES = new Set(['script', 'style', 'button', 'select', 'textarea', 'input', 'colgroup']);

const attribut = (n, nom) => n.attributs?.[nom] ?? null;
const classes = (n) => String(attribut(n, 'class') ?? '').split(/\s+/).filter(Boolean);
const estElement = (n) => n?.type === 'element';
const estBloc = (n) => estElement(n) && BLOCS.has(n.nom);
const ignore = (n) => estElement(n) && (IGNORES.has(n.nom) || attribut(n, 'data-ed-ignorer') !== null);

/**
 * Échappe un texte pour du Markdown en ligne : rien de ce qu'on a écrit ne devient une mise en forme, un lien Markdown ou une balise. Seule exception,
 * voulue : « [[Page]] » tapé dans le texte reste un lien du wiki (lib/wikilinks.mjs lit le texte, échappé ou non : il n'y a pas d'autre écriture).
 */
export function echapperTexte(texte, { tableau = false } = {}) {
  let t = String(texte).replace(/([\\`*_[\]])/g, '\\$1').replace(/<(?=[a-zA-Z/!?])/g, '\\<');
  t = t.replace(/\\\[\\\[((?:(?!\\\]\\\]).)+?)\\\]\\\]/g, (_, cible) => `[[${cible.replace(/\\([[\]])/g, '$1')}]]`);
  if (tableau) t = t.replace(/\|/g, '\\|');
  return t;
}

/** Échappe ce qui ferait d'un début de ligne un titre, une citation, une liste ou une règle. */
const echapperDebutDeLigne = (ligne) =>
  ligne.replace(/^(\s*)(#{1,6}\s|>|[-+*]\s|(\d+)([.)])\s)/, (tout, espaces, marque, chiffres, point) =>
    chiffres ? `${espaces}${chiffres}\\${point} ` : `${espaces}\\${marque}`).replace(/^(\s*)(-{3,}|={3,})\s*$/, '$1\\$2');

/** Le texte en ligne d'une suite de nœuds (gras, italique, code, liens, sauts de ligne) ; `tableau` : dans une case. */
function enLigne(noeuds, o = {}) {
  let sortie = '';
  for (const n of noeuds) {
    if (n.type === 'texte') {
      sortie += echapperTexte(n.valeur.replace(/\s+/g, ' '), o);
      continue;
    }
    if (!estElement(n) || ignore(n)) continue;
    const dedans = () => enLigne(n.enfants ?? [], o);
    switch (n.nom) {
      case 'strong':
      case 'b': {
        const t = dedans();
        sortie += t.trim() ? `**${t}**` : t;
        break;
      }
      case 'em':
      case 'i': {
        const t = dedans();
        sortie += t.trim() ? `*${t}*` : t;
        break;
      }
      case 'del':
      case 's':
      case 'strike':
        sortie += `~~${dedans()}~~`;
        break;
      case 'code':
        sortie += `\`${texteBrut(n)}\``;
        break;
      case 'br':
        sortie += '<br>';
        break;
      case 'img':
        sortie += `![${echapperTexte(attribut(n, 'alt') ?? '')}](${attribut(n, 'src') ?? ''})`;
        break;
      case 'a':
      case 'span': {
        const cible = attribut(n, 'data-cible');
        if (cible !== null && classes(n).includes('wikilink')) {
          const libelle = texteBrut(n).replace(/\s+/g, ' ').trim();
          sortie += libelle === cible ? `[[${cible}]]` : `[[${cible}|${libelle}]]`;
        } else if (n.nom === 'a' && attribut(n, 'href')) {
          const href = o.lienRelatif ? o.lienRelatif(attribut(n, 'href')) : attribut(n, 'href');
          const libelle = texteBrut(n);
          sortie += /^https?:\/\//.test(href) && libelle === href ? `<${href}>` : `[${dedans()}](${href})`;
        } else {
          // élément en ligne sans sens propre : son texte, en gras ou en italique si son style le dit (mise en forme du navigateur)
          const style = attribut(n, 'style') ?? '';
          let t = dedans();
          if (t.trim() && /font-style:\s*italic/.test(style)) t = `*${t}*`;
          if (t.trim() && /font-weight:\s*(bold|[6-9]00)/.test(style)) t = `**${t}**`;
          sortie += t;
        }
        break;
      }
      default:
        sortie += estBloc(n) ? ` ${dedans()} ` : dedans();
    }
  }
  return sortie;
}

/** Sans les sauts de ligne de bord : le navigateur en laisse dans un paragraphe ou une case vide (« <p><br></p> »), le rendu n'en montre aucun. */
const sansSautsDeBord = (t) => t.replace(/^(?:\s*<br>)+\s*/, '').replace(/(?:\s*<br>)+\s*$/, '');

/** Le texte d'un nœud, sans aucune mise en forme. */
export function texteBrut(n) {
  if (n.type === 'texte') return n.valeur;
  if (!estElement(n) || ignore(n)) return '';
  return (n.enfants ?? []).map(texteBrut).join('');
}

/** Coupe les enfants d'un élément en morceaux de blocs : une suite de nœuds en ligne forme un paragraphe implicite. */
function morceaux(enfants) {
  const sortie = [];
  let enCours = [];
  const fermer = () => {
    if (enCours.some((n) => (n.type === 'texte' ? n.valeur.trim() : !ignore(n)))) sortie.push({ type: 'element', nom: 'p', attributs: {}, enfants: enCours });
    enCours = [];
  };
  for (const n of enfants) {
    if (ignore(n)) continue;
    if (estBloc(n)) {
      fermer();
      sortie.push(n);
    } else enCours.push(n);
  }
  fermer();
  return sortie;
}

const alignement = (n) => {
  const a = attribut(n, 'align') ?? /text-align:\s*(left|center|right)/.exec(attribut(n, 'style') ?? '')?.[1] ?? null;
  return ['left', 'center', 'right'].includes(a) ? a : null;
};

function tableau(n, o) {
  const lignes = [];
  const parcourir = (e, dansEntete) => {
    for (const c of e.enfants ?? []) {
      if (!estElement(c)) continue;
      if (c.nom === 'thead') parcourir(c, true);
      else if (c.nom === 'tbody' || c.nom === 'tfoot') parcourir(c, false);
      else if (c.nom === 'tr') lignes.push({ entete: dansEntete || (c.enfants ?? []).filter(estElement).every((x) => x.nom === 'th') && lignes.length === 0, cases: (c.enfants ?? []).filter((x) => estElement(x) && (x.nom === 'td' || x.nom === 'th')) });
    }
  };
  parcourir(n, false);
  if (!lignes.length) return '';
  const largeur = Math.max(...lignes.map((l) => l.cases.length));
  const ecrireCase = (c) => {
    const couleur = attribut(c, 'data-couleur');
    const contenu = sansSautsDeBord(enLigne(c.enfants ?? [], { ...o, tableau: true }).trim());
    return `${couleur && COULEURS_DE_CASE.includes(couleur) ? `{couleur:${couleur}} ` : ''}${contenu}`.trim();
  };
  const ligne = (cases) => `| ${Array.from({ length: largeur }, (_, i) => (cases[i] ? ecrireCase(cases[i]) : '')).join(' | ')} |`;
  const [tete, ...corps] = lignes[0].entete ? lignes : [{ cases: [] }, ...lignes];
  const aligns = Array.from({ length: largeur }, (_, i) => alignement(tete.cases[i] ?? corps[0]?.cases[i] ?? {}));
  const separateur = `| ${aligns.map((a) => (a === 'center' ? ':---:' : a === 'right' ? '---:' : a === 'left' ? ':---' : '---')).join(' | ')} |`;
  return [ligne(tete.cases), separateur, ...corps.map((l) => ligne(l.cases))].join('\n');
}

/** `alterne` : la liste suit une liste de même sorte ; elle change de marque (« * » au lieu de « - », « 1) » au lieu de « 1. »), sinon le Markdown n'en ferait qu'une. */
function liste(n, o, profondeur, alterne = false) {
  const ordonnee = n.nom === 'ol';
  let numero = Number(attribut(n, 'start') ?? 1) || 1;
  const items = (n.enfants ?? []).filter((c) => estElement(c) && c.nom === 'li');
  const lache = items.some((li) => (li.enfants ?? []).some((c) => estElement(c) && c.nom === 'p'));
  const sorties = items.map((li) => {
    const marque = ordonnee ? `${numero++}${alterne ? ')' : '.'} ` : alterne ? '* ' : '- ';
    const retrait = ' '.repeat(marque.length);
    const corps = blocs(li.enfants ?? [], o, profondeur + 1, { serre: !lache }).replace(/^\n+/, '');
    const [premiere = '', ...suite] = corps.split('\n');
    return `${marque}${premiere}${suite.map((l) => (l ? `\n${retrait}${l}` : '\n')).join('')}`;
  });
  return sorties.join(lache ? '\n\n' : '\n');
}

function bloc(n, o, profondeur, alterne = false) {
  switch (n.nom) {
    case 'h1':
    case 'h2':
    case 'h3':
    case 'h4':
    case 'h5':
    case 'h6':
      return `${'#'.repeat(Number(n.nom[1]))} ${sansSautsDeBord(enLigne(n.enfants ?? [], o).trim())}`;
    case 'ul':
    case 'ol':
      return liste(n, o, profondeur, alterne);
    case 'blockquote':
      return blocs(n.enfants ?? [], o, profondeur).split('\n').map((l) => (l ? `> ${l}` : '>')).join('\n');
    case 'pre': {
      const code = (n.enfants ?? []).find((c) => estElement(c) && c.nom === 'code') ?? n;
      const langue = classes(code).find((c) => c.startsWith('language-'))?.slice(9) ?? '';
      return `\`\`\`${langue}\n${texteBrut(code).replace(/\n$/, '')}\n\`\`\``;
    }
    case 'hr':
      return '---';
    case 'table':
      return tableau(n, o);
    case 'p':
    case 'div':
    case 'section':
    case 'article':
    case 'figure': {
      if (n.nom !== 'p' && (n.enfants ?? []).some(estBloc)) return blocs(n.enfants ?? [], o, profondeur);
      return sansSautsDeBord(enLigne(n.enfants ?? [], o).trim()).split('\n').map(echapperDebutDeLigne).join('\n');
    }
    default:
      return enLigne([n], o).trim();
  }
}

function blocs(enfants, o, profondeur = 0, { serre = false } = {}) {
  const sorties = [];
  let precedent = null;
  let alterne = false;
  for (const n of morceaux(enfants)) {
    // deux listes de même sorte qui se suivent (« - » puis « * » dans une page du Codex) : la seconde prend l'autre marque
    const suit = estElement(n) && (n.nom === 'ul' || n.nom === 'ol') && precedent?.nom === n.nom;
    const t = bloc(n, o, profondeur, suit && !alterne);
    if (t.trim() === '') continue;
    sorties.push(t);
    alterne = suit && !alterne;
    precedent = n;
  }
  return sorties.join(serre ? '\n' : '\n\n');
}

/**
 * Le Markdown d'un contenu modifié (les enfants de l'élément qui le contient). `lienRelatif(href)` : réécrit une adresse du site (préfixe de
 * déploiement retiré, comme les liens Markdown du guide s'écrivent : « /races/ »).
 */
export function versMarkdown(enfants, { lienRelatif } = {}) {
  return `${blocs(enfants, { lienRelatif }).replace(/\n{3,}/g, '\n\n').trim()}\n`;
}

/** Un arbre simple d'après un nœud du DOM (navigateur) : texte, ou élément avec ses attributs et ses enfants. */
export function arbreDuDom(noeud) {
  if (noeud.nodeType === 3) return { type: 'texte', valeur: noeud.nodeValue };
  if (noeud.nodeType !== 1) return null;
  const attributs = {};
  for (const a of noeud.attributes) attributs[a.name] = a.value;
  return { type: 'element', nom: noeud.tagName.toLowerCase(), attributs, enfants: [...noeud.childNodes].map(arbreDuDom).filter(Boolean) };
}

const MARQUEUR = /^<!--\s*guide:([a-z-]+)\s*-->[ \t]*$/gm;

/**
 * Le corps d'une page coupé en morceaux de texte et marqueurs de bloc, SANS rien perdre (contrairement à lib/guide.mjs#morceauxDuChapitre) :
 * [{ texte } | { marqueur, bloc }] ; leur concaténation redonne le corps. `visible` : un morceau de texte que la page affiche (non vide).
 */
export function decouperCorps(corps) {
  const sortie = [];
  let fin = 0;
  for (const m of corps.matchAll(MARQUEUR)) {
    sortie.push({ texte: corps.slice(fin, m.index) });
    sortie.push({ marqueur: m[0], bloc: m[1] });
    fin = m.index + m[0].length;
  }
  sortie.push({ texte: corps.slice(fin) });
  return sortie.map((m) => ('texte' in m ? { ...m, visible: m.texte.trim() !== '' } : m));
}

/**
 * Le corps réécrit : les morceaux de texte visibles reçoivent, dans l'ordre, le Markdown modifié donné pour eux (`null` : inchangé) ; les espaces qui
 * les entourent et les marqueurs de bloc restent.
 */
export function recomposerCorps(corps, nouveaux) {
  let i = 0;
  return decouperCorps(corps)
    .map((m) => {
      if ('marqueur' in m) return m.marqueur;
      if (!m.visible) return m.texte;
      const nouveau = nouveaux[i++];
      if (nouveau === null || nouveau === undefined) return m.texte;
      const avant = /^\s*/.exec(m.texte)[0];
      const apres = /\s*$/.exec(m.texte)[0];
      return `${avant}${nouveau.trim()}${apres}`;
    })
    .join('');
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// HTML assaini (aperçu d'une page modifiée, montré tant que la page construite ne l'a pas)
// ---------------------------------------------------------------------------------------------------------------------------------------------

const ECHAPPE = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
const echapper = (t) => String(t).replace(/[&<>"]/g, (c) => ECHAPPE[c]);
/** Éléments gardés (nom en sortie) ; tout autre élément est remplacé par son contenu, ceux de IGNORES disparaissent. */
const GARDES = {
  p: 'p', h1: 'h1', h2: 'h2', h3: 'h3', h4: 'h4', h5: 'h5', h6: 'h6', ul: 'ul', ol: 'ol', li: 'li', blockquote: 'blockquote', pre: 'pre', code: 'code',
  hr: 'hr', table: 'table', thead: 'thead', tbody: 'tbody', tr: 'tr', th: 'th', td: 'td', strong: 'strong', b: 'strong', em: 'em', i: 'em', del: 'del',
  s: 'del', strike: 'del', br: 'br', a: 'a', span: 'span',
};
const VIDES = new Set(['hr', 'br']);
const ADRESSE_SURE = /^(https?:\/\/|\/(?!\/)|#|\.\.?\/)/i;

function attributsSurs(n, nom) {
  const a = [];
  const garder = (cle, valeur) => a.push(` ${cle}="${echapper(valeur)}"`);
  if (/^h[1-6]$/.test(nom) && /^[a-z0-9-]+$/.test(attribut(n, 'id') ?? '')) garder('id', attribut(n, 'id'));
  if (nom === 'ol' && /^\d+$/.test(attribut(n, 'start') ?? '')) garder('start', attribut(n, 'start'));
  if (nom === 'code') {
    const langue = classes(n).find((c) => /^language-[a-z0-9-]+$/.test(c));
    if (langue) garder('class', langue);
  }
  if (nom === 'td' || nom === 'th') {
    if (COULEURS_DE_CASE.includes(attribut(n, 'data-couleur'))) garder('data-couleur', attribut(n, 'data-couleur'));
    const align = alignement(n);
    if (align) garder('align', align);
  }
  if (nom === 'a' || nom === 'span') {
    const lien = classes(n).filter((c) => c === 'wikilink' || c === 'wikilink--missing');
    if (lien.length) garder('class', lien.join(' '));
    if (attribut(n, 'data-cible') !== null && lien.length) garder('data-cible', attribut(n, 'data-cible'));
    if (attribut(n, 'title') !== null) garder('title', attribut(n, 'title'));
  }
  if (nom === 'a' && ADRESSE_SURE.test(attribut(n, 'href') ?? '')) garder('href', attribut(n, 'href'));
  return a.join('');
}

/**
 * Le HTML d'un arbre (arbreDuDom) réduit à ce que le Markdown d'une page peut produire : titres, paragraphes, listes, citations, code, tableaux (couleur
 * et alignement des cases), gras, italique, barré, liens (adresses du site ou web seulement), liens du wiki. Aucun script, style, attribut
 * d'événement ni adresse « javascript: » ne passe : ce HTML vient d'un navigateur et sera montré à d'autres.
 */
export function htmlSur(enfants) {
  return enfants
    .map((n) => {
      if (n.type === 'texte') return echapper(n.valeur);
      if (!estElement(n) || ignore(n) || n.nom === 'img') return '';
      const nom = GARDES[n.nom];
      if (!nom) return htmlSur(n.enfants ?? []);
      if (VIDES.has(nom)) return `<${nom}>`;
      return `<${nom}${attributsSurs(n, n.nom)}>${htmlSur(n.enfants ?? [])}</${nom}>`;
    })
    .join('');
}
