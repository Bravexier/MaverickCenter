// Corps Markdown des pages de magie (magies/<slug>) tenu d'accord avec les tables que le site de dev modifie (D4 ; docs/serveur.md, « Édition »).
//
// Une page de magie s'AFFICHE depuis les tables (lib/magies-db.mjs) ; son corps (page.corps_md) ne sert qu'à la recherche (page_fts) et aux [[liens]]. Il a été
// écrit par l'importeur (tools/sheets/magies.py#render) puis retouché par les migrations d'orthographe. Il ne peut pas être refait en entier depuis les
// tables : il porte des choses qu'elles n'ont pas (libellés du bloc « Données » tels qu'écrits, « Santé offert » ici et « Santé offerte » là ; nombres
// en cache du classeur, « 4.0 » pour le coût 4 ; titres des textes de niveau 5, « Pluie Chaude » pour le sort « Pluie chaude » ; libellés des notes ;
// légende ; tableau cadavérique ; relations). Stratégie : REMPLACEMENT DE MORCEAUX. Chaque colonne modifiable a sa place dans le corps (ci-dessous) ;
// une fonction reçoit le corps, la ligne avant et la ligne après, et ne réécrit que les morceaux qui dérivent de cette ligne et qui ne disent plus ce
// que dit la ligne après (rendu de l'importeur, porté ici à l'identique). Un morceau déjà d'accord avec la ligne après est laissé tel quel, octet
// pour octet : rejoué avec les mêmes valeurs sur toutes les pages de la base, le corps revient inchangé (test/corps-magies.test.mjs).
//
// Places (rendu de magies.py#render, dans l'ordre de la page) :
//   magie.banniere                     1re ligne « **TEXTE** » (Potentiel Illimité)                        -> tête du corps, refaite
//   magie.description                  paragraphes d'introduction, avant le premier « ## » ; page.resume = sa première phrase
//   magie.description_physique         section « ## Description physique »                                -> section refaite (ajoutée, retirée)
//   magie.explication                  section « ## Explication »
//   magie.sante_offerte, chakra_offert, caracteristique_brut, barre4_texte
//                                      lignes « - **Libellé** : valeur » de « ## Données » (libellé gardé tel qu'écrit ; « 5.0 » vaut 5)
//   magie.remarque                     section « ## Remarque » en fin de page (aucune aujourd'hui : l'importeur n'en écrivait pas)
//   magie_role.role_brut               n-ième puce de « ## Rôles » (n = rang)
//   mode_hyper_effet.effet             (version onglet_magie) ligne « | Mono-Magie | effet | » de « ## Capacité Mode Hyper », ou puce
//                                      « - **Forme Complète** : effet » (repérée par variante_brut) ; `nom` n'est pas écrit dans une page de magie
//   sort.nom, type_brut, cout_brut, portee_brut, zone_brut, dsb_brut, effets
//                                      case de la ligne du sort (n-ième ligne du tableau « ## Sorts », n = ordre ; « / » pour dsb_brut NULL) ;
//                                      la case « Coût » écrit les deux coûts du sort (cout_brut, cout_secondaire : décision R105), comme le classeur,
//                                      « 3 + 1 Sang », et le coût secondaire seul pour un coût « 0 » (« 2 Sang ») : lib/sort-cout.mjs#coutEnUneCase ;
//                                      le nom aussi dans les libellés des notes (« … du sort « Nom » ») et le titre de son texte de niveau 5
//   sort.remarque                      entrées du sort dans « ## Notes et commentaires des sorts » (la remarque = leurs textes, séparés par une ligne
//                                      vide) ; une remarque modifiée remplace ces entrées par une seule, « **Remarque du sort « Nom »** »
//   sort.texte_niveau5                 citation « > … » sous « ### Titre » dans « ## Textes des sorts de niveau 5 »
// Le niveau d'un sort, son ordre, les relations entre magies, la légende et le tableau cadavérique ne se modifient pas depuis le site : intacts.
//
// Module pur, sans dépendance (ni base, ni Node, ni navigateur) : il reçoit les lignes des tables, le service (serveur/edition.mjs) lit et écrit.

/** Erreur : le corps n'a pas la forme attendue (morceau introuvable) ; le service peut refuser le lot ou laisser le corps tel quel. */
export class ErreurCorpsMagie extends Error {
  constructor(message) {
    super(message);
    this.name = 'ErreurCorpsMagie';
  }
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Rendu Markdown de l'importeur (tools/sheets/magies.py : fmt, esc_inline, md_text, md_quote, cell_md, entry_lines, first_sentence), à l'identique
// ---------------------------------------------------------------------------------------------------------------------------------------------

// Blancs au sens de Python (str.isspace, \s des expressions de str) : strip(), split() et \s de l'importeur
const BLANCS = '\\t\\n\\v\\f\\r \\x1c-\\x1f\\x85\\xa0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000';
const B = `[${BLANCS}]`;
const BORDS = new RegExp(`^${B}+|${B}+$`, 'gu');
const strip = (s) => s.replace(BORDS, '');
const normEspaces = (s) => strip(String(s)).split(new RegExp(`${B}+`, 'u')).filter(Boolean).join(' ');

/** fmt() de l'importeur pour un texte : retours à la ligne unifiés, blancs de bord retirés. */
const fmt = (valeur) => strip(String(valeur ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n'));

const URL = new RegExp(`https?://[^<>${BLANCS}]+`, 'gu');

/**
 * Une balise du glossaire dont le séparateur vient d'être échappé (« {{id\|texte}} ») : `barres` échappe les « | » d'une ligne qui n'est pas une ligne de
 * tableau (les commentaires), où le séparateur d'une balise s'écrit « | » (forme canonique, lib/mots-cles-balises.mjs#formeCanonique ; la ref est un id).
 */
const BALISE_AU_SEPARATEUR_ECHAPPE = /\{\{([^{}|\\\n]+?)\\\|([^{}\n]*?)\}\}/g;

function echapperTexte(s, barres) {
  let t = s.replace(/\\/g, '\\\\').replace(/([`*_[\]<~])/g, '\\$1').replace(/&(?=#?[\p{L}\p{N}_]+;)/gu, '\\&');
  if (barres) t = t.replace(/\|/g, '\\|').replace(BALISE_AU_SEPARATEUR_ECHAPPE, '{{$1|$2}}');
  return t;
}

const DEBUTS = [
  [new RegExp(`^(${B}*)>`, 'u'), '$1\\>'],
  [new RegExp(`^(${B}*)(#{1,6})(?=${B}|$)`, 'u'), '$1\\$2'],
  [new RegExp(`^(${B}*)([-+])(?=${B}|$)`, 'u'), '$1\\$2'],
  [new RegExp(`^(${B}*)(\\p{Nd}+)([.)])(?=${B}|$)`, 'u'), '$1$2\\$3'],
];

/** esc_inline : un texte d'une ligne échappé pour Markdown, les URL nues en liens automatiques <url>, un début de ligne qui ferait une structure échappé. */
export function echapperLigne(s, barres = false) {
  let sortie = '';
  let pos = 0;
  for (const m of s.matchAll(URL)) {
    sortie += echapperTexte(s.slice(pos, m.index), barres) + `<${m[0]}>`;
    pos = m.index + m[0].length;
  }
  sortie += echapperTexte(s.slice(pos), barres);
  for (const [motif, par] of DEBUTS) sortie = sortie.replace(motif, par);
  return sortie;
}

const PUCE_DE_TEXTE = new RegExp(`^-${B}+[^${BLANCS}]`, 'u');

/** md_blocks : [['p', lignes] | ['ul', éléments]] ; une ligne vide sépare les blocs, une ligne « - … » est une puce. */
function blocsDeTexte(texte) {
  const blocs = [];
  let para = [];
  let puces = [];
  const fermer = () => {
    if (para.length) blocs.push(['p', para]);
    if (puces.length) blocs.push(['ul', puces]);
    para = [];
    puces = [];
  };
  for (const ligne of fmt(texte).split('\n').map(strip)) {
    if (!ligne) fermer();
    else if (PUCE_DE_TEXTE.test(ligne)) {
      if (para.length) blocs.push(['p', para]);
      para = [];
      puces.push(strip(ligne.slice(1)));
    } else {
      if (puces.length) blocs.push(['ul', puces]);
      puces = [];
      para.push(ligne);
    }
  }
  fermer();
  return blocs;
}

/** md_text : un texte de plusieurs lignes en lignes Markdown (paragraphes séparés par une ligne vide, saut forcé par deux espaces). */
export function lignesDeTexte(texte, prefixe = '') {
  const sortie = [];
  for (const [genre, contenu] of blocsDeTexte(texte)) {
    if (sortie.length) sortie.push('');
    if (genre === 'p') contenu.forEach((l, i) => sortie.push(echapperLigne(l) + (i < contenu.length - 1 ? '  ' : '')));
    else for (const element of contenu) sortie.push(`- ${echapperLigne(element)}`);
  }
  return sortie.map((l) => (l ? prefixe + l : prefixe.replace(/\s+$/, '')));
}

/** cell_md : une case de tableau (retours à la ligne en <br>, « | » échappé). */
export function celluleDeTableau(valeur) {
  return fmt(valeur).split('\n').map((l) => echapperLigne(strip(l))).join('<br>').replace(/\|/g, '\\|');
}

/** first_sentence : la première phrase du premier paragraphe (le résumé de la page). */
export function premierePhrase(texte) {
  const para = fmt(texte).split('\n')[0];
  const m = new RegExp(`[.!?](?=${B}|$)`, 'u').exec(para);
  return m ? para.slice(0, m.index + 1) : para;
}

/** Résumé de la page d'une magie : la première phrase de sa présentation (NULL sans présentation, comme l'importeur qui n'écrivait pas `summary`). */
export const resumeDeMagie = (magie) => (magie.description ? premierePhrase(magie.description) : null);

// Notes et commentaires (comment_lines, is_bullet, esc_comment_line, entry_lines)
const PUCE = /^- \S/u;
const SAUT = '  ';
const lignesDeCommentaire = (texte) => {
  const lignes = String(texte ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').map((l) => l.replace(/^[ \t]+|[ \t]+$/g, ''));
  while (lignes.length && !lignes[0]) lignes.shift();
  while (lignes.length && !lignes.at(-1)) lignes.pop();
  return lignes;
};
const echapperLigneDeCommentaire = (ligne) => echapperLigne(ligne, true).replace(/^(-{2,}|=+)(?=\s*$)/u, '\\$1');

/** entry_lines : l'entrée d'une note (libellé en gras, puis les lignes du commentaire ; une seule ligne qui n'est pas une puce tient sur celle du libellé). */
export function lignesDEntree(libelle, lignes) {
  const tete = `**${echapperLigne(libelle)}**`;
  if (lignes.length === 1 && !PUCE.test(lignes[0])) return [`${tete} : ${echapperLigneDeCommentaire(lignes[0])}`];
  const sortie = [tete, ''];
  lignes.forEach((ligne, i) => {
    const suivante = lignes[i + 1] ?? '';
    const texte = PUCE.test(ligne) ? `- ${echapperLigneDeCommentaire(ligne.slice(2))}` : echapperLigneDeCommentaire(ligne);
    sortie.push(texte + (ligne && suivante && !PUCE.test(suivante) ? SAUT : ''));
  });
  return sortie;
}

/** Retire les échappements Markdown d'un texte écrit par echapperLigne (libellés, noms) : « \* » -> « * », « <url> » -> « url ». */
export const sansEchappement = (s) => s.replace(/<(https?:\/\/[^>\s]+)>/g, '$1').replace(/\\(.)/g, '$1');

/** Comparaison sans accents ni casse, espaces regroupés (fold de l'importeur : titres des textes de niveau 5, libellés du bloc Données). */
const plier = (s) => normEspaces(String(s).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase());

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Le corps en morceaux : la tête (bannière, introduction), puis les sections « ## Titre »
// ---------------------------------------------------------------------------------------------------------------------------------------------

export const SECTIONS = {
  physique: '## Description physique',
  explication: '## Explication',
  donnees: '## Données',
  hyper: '## Capacité Mode Hyper',
  roles: '## Rôles',
  sorts: '## Sorts',
  notes: '## Notes et commentaires des sorts',
  niveau5: '## Textes des sorts de niveau 5',
  legende: '## Légende',
  remarque: '## Remarque',
};
// ordre des sections dans la page (render) : une section ajoutée se place avant la première qui la suit ; « ## TABLEAU … » (Nécromancie) suit les rôles
const ORDRE_DES_SECTIONS = ['physique', 'explication', 'donnees', 'hyper', 'roles', 'tableau', 'sorts', 'notes', 'niveau5', 'legende', 'remarque'];
const rangDeSection = (titre) => {
  if (titre.startsWith('## TABLEAU')) return ORDRE_DES_SECTIONS.indexOf('tableau');
  const cle = Object.keys(SECTIONS).find((k) => SECTIONS[k] === titre);
  return cle ? ORDRE_DES_SECTIONS.indexOf(cle) : ORDRE_DES_SECTIONS.length;
};

/** { tete: lignes avant le premier « ## », sections: [{ titre, lignes }] } ; `lignes` = tout ce qui suit le titre jusqu'au suivant. */
export function decouperCorpsDeMagie(corps) {
  const texte = String(corps ?? '').replace(/\n$/, '');
  const morceaux = { tete: [], sections: [] };
  for (const ligne of texte.split('\n')) {
    if (ligne.startsWith('## ')) morceaux.sections.push({ titre: ligne, lignes: [] });
    else (morceaux.sections.length ? morceaux.sections.at(-1).lignes : morceaux.tete).push(ligne);
  }
  return morceaux;
}

/** Le corps refait depuis ses morceaux (lignes vides de fin retirées, un retour à la ligne final : comme render). */
export function assemblerCorpsDeMagie({ tete, sections }) {
  const lignes = [...tete, ...sections.flatMap((s) => [s.titre, ...s.lignes])];
  while (lignes.length && lignes.at(-1) === '') lignes.pop();
  return `${lignes.join('\n')}\n`;
}

const section = (morceaux, titre) => morceaux.sections.find((s) => s.titre === titre) ?? null;
/** Contenu d'une section : ses lignes sans les lignes vides du début et de la fin. */
const contenu = (s) => {
  const l = [...s.lignes];
  while (l.length && l[0] === '') l.shift();
  while (l.length && l.at(-1) === '') l.pop();
  return l;
};
const memesLignes = (a, b) => a.length === b.length && a.every((l, i) => l === b[i]);

/** Pose le contenu d'une section : remplacée, ajoutée à sa place, ou retirée (contenu vide). */
function poserSection(morceaux, titre, lignesVoulues) {
  const lignes = [...lignesVoulues];
  while (lignes.length && lignes[0] === '') lignes.shift();
  while (lignes.length && lignes.at(-1) === '') lignes.pop();
  const i = morceaux.sections.findIndex((s) => s.titre === titre);
  if (!lignes.length) {
    if (i >= 0) morceaux.sections.splice(i, 1);
    return;
  }
  if (i >= 0) {
    if (!memesLignes(contenu(morceaux.sections[i]), lignes)) morceaux.sections[i].lignes = ['', ...lignes, ''];
    return;
  }
  const rang = rangDeSection(titre);
  const avant = morceaux.sections.findIndex((s) => rangDeSection(s.titre) > rang);
  const nouvelle = { titre, lignes: ['', ...lignes, ''] };
  if (avant < 0) {
    const precedentes = morceaux.sections.at(-1)?.lignes ?? morceaux.tete;
    if (precedentes.length && precedentes.at(-1) !== '') precedentes.push('');
    morceaux.sections.push(nouvelle);
  } else morceaux.sections.splice(avant, 0, nouvelle);
}

// Tête : bannière (une ligne en gras ; un texte de plusieurs lignes y tient sur une seule) et introduction
function lignesDeTete(magie) {
  const lignes = [];
  const banniere = fmt(magie.banniere).split('\n').map(strip).filter(Boolean).join(' ');
  if (banniere) lignes.push(`**${echapperLigne(banniere)}**`, '');
  if (magie.description && fmt(magie.description)) lignes.push(...lignesDeTexte(magie.description), '');
  return lignes;
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Bloc « Données » : une puce par libellé, valeur sur la même ligne, lignes suivantes en retrait de deux espaces
// ---------------------------------------------------------------------------------------------------------------------------------------------

const ELEMENT = /^- \*\*(.+?)\*\* :(?: (.*))?$/u;

/** [{ debut, fin, libelle (tel qu'écrit, échappé), valeur: lignes }] des puces d'une liste « - **Libellé** : valeur » (fin exclue). */
function elementsEtiquetes(lignes) {
  const elements = [];
  for (let i = 0; i < lignes.length; i++) {
    const m = ELEMENT.exec(lignes[i]);
    if (!m) continue;
    let fin = i + 1;
    while (fin < lignes.length && (lignes[fin].startsWith('  ') || (lignes[fin] === '' && lignes[fin + 1]?.startsWith('  ')))) fin++;
    const valeur = m[2] === undefined ? [] : [m[2], ...lignes.slice(i + 1, fin).map((l) => (l ? l.slice(2) : ''))];
    elements.push({ debut: i, fin, libelle: m[1], valeur });
    i = fin - 1;
  }
  return elements;
}

const lignesDElement = (libelle, valeur) => {
  const lignes = valeur === null || valeur === undefined || valeur === '' ? [] : lignesDeTexte(String(valeur));
  if (!lignes.length) return [`- **${libelle}** :`];
  return [`- **${libelle}** : ${lignes[0]}`, ...lignes.slice(1).map((e) => (e ? `  ${e}` : ''))];
};

/**
 * Colonnes de magie écrites dans « Données » : libellé reconnu (sans accents ni casse, tel que l'onglet l'écrit), libellé d'une ligne ajoutée, et
 * équivalence d'un nombre : la cellule du classeur était un nombre en cache (« 5.0 ») que la base garde en entier (5).
 */
const DONNEES_DE_MAGIE = [
  { colonne: 'sante_offerte', motif: /^sante offert/, libelle: 'Santé offerte', nombre: true },
  { colonne: 'chakra_offert', motif: /^chakra offert/, libelle: 'Chakra offert', nombre: true },
  { colonne: 'caracteristique_brut', motif: /^caracteri?s?tiques? bonus/, libelle: 'Caractéristiques bonus' },
  { colonne: 'barre4_texte', motif: /^4eme barre/, libelle: '4ème barre' },
];

const valeurEquivalente = (lignes, attendu, nombre) => {
  if (memesLignes(lignes, attendu)) return true;
  return nombre && lignes.length === 1 && attendu.length === 1 && lignes[0] === `${attendu[0]}.0`;
};

function poserDonnees(morceaux, magie) {
  const s = section(morceaux, SECTIONS.donnees);
  const lignes = s ? contenu(s) : [];
  for (const [rang, champ] of DONNEES_DE_MAGIE.entries()) {
    if (!(champ.colonne in magie)) continue;
    const valeur = magie[champ.colonne];
    const vide = valeur === null || valeur === undefined || valeur === '';
    const elements = elementsEtiquetes(lignes);
    const trouve = elements.find((e) => champ.motif.test(plier(sansEchappement(e.libelle))));
    if (trouve) {
      if (vide) lignes.splice(trouve.debut, trouve.fin - trouve.debut);
      else if (!valeurEquivalente(trouve.valeur, lignesDeTexte(String(valeur)), champ.nombre)) {
        lignes.splice(trouve.debut, trouve.fin - trouve.debut, ...lignesDElement(trouve.libelle, valeur));
      }
      continue;
    }
    if (vide) continue;
    // ligne absente : ajoutée après la dernière des lignes qui la précèdent dans l'onglet (sinon en tête du bloc)
    const precedentes = DONNEES_DE_MAGIE.slice(0, rang).map((c) => c.motif);
    const apres = elements.filter((e) => precedentes.some((m) => m.test(plier(sansEchappement(e.libelle))))).at(-1);
    lignes.splice(apres ? apres.fin : 0, 0, ...lignesDElement(echapperLigne(champ.libelle), valeur));
  }
  poserSection(morceaux, SECTIONS.donnees, lignes);
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Tableaux Markdown : « | a | b | » (les « | » du texte sont échappés par celluleDeTableau)
// ---------------------------------------------------------------------------------------------------------------------------------------------

/** Cases d'une ligne de tableau telles qu'écrites (échappées), ou null si ce n'est pas une ligne « | … | ». */
export function casesDeLigne(ligne) {
  if (!ligne.startsWith('| ') || !ligne.endsWith(' |')) return null;
  const cases = [];
  let courante = '';
  for (let i = 1; i < ligne.length; i++) {
    const c = ligne[i];
    if (c === '\\' && i + 1 < ligne.length) {
      courante += c + ligne[i + 1];
      i++;
    } else if (c === '|') {
      cases.push(courante);
      courante = '';
    } else courante += c;
  }
  if (courante !== '' || cases.some((c) => c.length < 2 || !c.startsWith(' ') || !c.endsWith(' '))) return null;
  return cases.map((c) => c.slice(1, -1));
}
const ligneDeCases = (cases) => `| ${cases.join(' | ')} |`;

/** Indices (dans les lignes données) des lignes de données du premier tableau : après l'en-tête et la ligne « | --- | ». */
function lignesDuTableau(lignes) {
  const entete = lignes.findIndex((l) => l.startsWith('| '));
  if (entete < 0 || !/^\|( -+ \|)+$/.test(lignes[entete + 1] ?? '')) return [];
  const indices = [];
  for (let i = entete + 2; i < lignes.length && lignes[i].startsWith('|'); i++) indices.push(i);
  return indices;
}

/** Une case de nombre : « 4.0 » (nombre en cache du classeur) vaut « 4 » (la base). */
const caseEquivalente = (ecrite, attendue) => ecrite === attendue || (/^\d+$/.test(attendue) && ecrite === `${attendue}.0`);

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Magie, rôles, capacité Mode Hyper
// ---------------------------------------------------------------------------------------------------------------------------------------------

/** Colonnes de la table `magie` qui ont une place dans le corps (les autres sont ignorées). */
export const COLONNES_DE_MAGIE = ['banniere', 'description', 'description_physique', 'explication', 'sante_offerte', 'chakra_offert', 'caracteristique_brut', 'barre4_texte', 'remarque'];

function poserMagie(morceaux, magie) {
  if ('banniere' in magie || 'description' in magie) {
    const tete = lignesDeTete(magie);
    const actuelle = [...morceaux.tete];
    while (actuelle.length && actuelle.at(-1) === '') actuelle.pop();
    const voulue = tete.slice(0, -1);
    if (!memesLignes(actuelle, voulue)) morceaux.tete = tete;
  }
  if ('description_physique' in magie) poserSection(morceaux, SECTIONS.physique, magie.description_physique ? lignesDeTexte(magie.description_physique) : []);
  if ('explication' in magie) poserSection(morceaux, SECTIONS.explication, magie.explication ? lignesDeTexte(magie.explication) : []);
  poserDonnees(morceaux, magie);
  if ('remarque' in magie) poserSection(morceaux, SECTIONS.remarque, magie.remarque ? lignesDeTexte(magie.remarque) : []);
}

function poserRole(morceaux, role) {
  const s = section(morceaux, SECTIONS.roles);
  if (!s) throw new ErreurCorpsMagie(`rôle ${role.rang} de ${role.magie_id} : pas de section « Rôles » dans le corps`);
  const lignes = contenu(s);
  const puces = lignes.map((l, i) => (l.startsWith('- ') ? i : -1)).filter((i) => i >= 0);
  const voulue = `- ${echapperLigne(fmt(role.role_brut))}`;
  if (role.rang <= puces.length) lignes[puces[role.rang - 1]] = voulue;
  else if (role.rang === puces.length + 1) lignes.splice(puces.length ? puces.at(-1) + 1 : lignes.length, 0, voulue);
  else throw new ErreurCorpsMagie(`rôle ${role.rang} de ${role.magie_id} : la section « Rôles » n'a que ${puces.length} rôle(s)`);
  poserSection(morceaux, SECTIONS.roles, lignes);
}

function poserModeHyper(morceaux, effet) {
  if (effet.version !== 'onglet_magie') throw new ErreurCorpsMagie(`${effet.id} : version ${effet.version}, pas le bloc « Capacité Mode Hyper » d'un onglet de magie`);
  const s = section(morceaux, SECTIONS.hyper);
  if (!s) throw new ErreurCorpsMagie(`${effet.id} : pas de section « Capacité Mode Hyper » dans le corps`);
  const lignes = contenu(s);
  const libelle = effet.variante_brut ?? '';
  // forme tableau (« | Type | Effets | ») : la ligne dont la première case est la variante
  for (const i of lignesDuTableau(lignes)) {
    const cases = casesDeLigne(lignes[i]);
    if (cases?.length === 2 && plier(sansEchappement(cases[0])) === plier(libelle)) {
      const voulue = celluleDeTableau(effet.effet);
      if (cases[1] !== voulue) lignes[i] = ligneDeCases([cases[0], voulue]);
      poserSection(morceaux, SECTIONS.hyper, lignes);
      return;
    }
  }
  // forme liste (« - **Forme Complète** : … »)
  const element = elementsEtiquetes(lignes).find((e) => plier(sansEchappement(e.libelle)) === plier(libelle));
  if (!element) throw new ErreurCorpsMagie(`${effet.id} : variante « ${libelle} » introuvable dans « Capacité Mode Hyper »`);
  if (!memesLignes(element.valeur, lignesDeTexte(effet.effet))) {
    lignes.splice(element.debut, element.fin - element.debut, ...lignesDElement(element.libelle, effet.effet));
  }
  poserSection(morceaux, SECTIONS.hyper, lignes);
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Sorts : ligne du tableau, notes (remarque), texte de niveau 5
// ---------------------------------------------------------------------------------------------------------------------------------------------

/** Colonnes de `sort` écrites dans la ligne du tableau « ## Sorts », avec leur case (Niveau, Nom, Type, Coût, Portée, Zone, D/S/B, Effets secondaires). */
const CASES_DU_SORT = { nom: 1, type_brut: 2, cout_brut: 3, portee_brut: 4, zone_brut: 5, dsb_brut: 6, effets: 7 };
/** Colonnes de `sort` qui ont une place dans le corps de la page de sa magie (le coût secondaire : dans la case « Coût »). */
export const COLONNES_DE_SORT = [...Object.keys(CASES_DU_SORT), 'cout_secondaire', 'remarque', 'texte_niveau5'];

/** Les deux coûts d'un sort en une case (lib/sort-cout.mjs#coutEnUneCase, recopiée : ce module n'importe rien ; test/sort-cout-secondaire.test.mjs). */
export const coutEnUneCase = (cout, secondaire) => (!secondaire ? cout : cout === '0' || cout === '' ? secondaire : `${cout} + ${secondaire}`);

/**
 * Valeur d'une case : « / » pour D/S/B NULL (la base garde NULL pour la cellule « / »), le coût et le coût secondaire ensemble dans la case « Coût »,
 * texte vide pour une autre case vide.
 */
const valeurDeCase = (sort, colonne) => {
  if (colonne === 'dsb_brut' && (sort.dsb_brut === null || sort.dsb_brut === undefined)) return '/';
  if (colonne === 'cout_brut') return coutEnUneCase(sort.cout_brut ?? '', sort.cout_secondaire ?? null);
  return sort[colonne] ?? '';
};
/**
 * Un nom de sort tel que la base l'écrit (retours à la ligne et espaces insécables remplacés par des espaces : identifiant) : la case du tableau peut
 * garder le retour à la ligne (« Amélioration<br>Cadavérique ») ou l'insécable du classeur.
 */
const memeNom = (ecrit, nom) => ecrit.replace(/<br>/g, ' ').replace(/\u00a0/g, ' ') === celluleDeTableau(nom).replace(/\u00a0/g, ' ');

/** Lignes du tableau des sorts : [{ indice, cases }] dans l'ordre de la page (ordre du sort = rang + 1). */
function tableauDesSorts(lignes) {
  return lignesDuTableau(lignes).map((i) => ({ indice: i, cases: casesDeLigne(lignes[i]) }));
}

/**
 * La ligne du sort dans le tableau : celle de son rang (ordre), si elle porte son nom (ou celui d'avant un renommage) ; sinon la seule ligne qui le
 * porte (un tableau qui ne suit plus l'ordre des sorts) ; aucune ou plusieurs : ErreurCorpsMagie (jamais la ligne d'un autre sort).
 */
function poserLigneDuSort(morceaux, sort, avant = null) {
  const s = section(morceaux, SECTIONS.sorts);
  if (!s) throw new ErreurCorpsMagie(`${sort.id} : pas de section « Sorts » dans le corps`);
  const lignes = contenu(s);
  const tableau = tableauDesSorts(lignes);
  const noms = [avant?.nom, sort.nom].filter(Boolean);
  const sienne = (l) => l?.cases?.length === 8 && noms.some((n) => memeNom(l.cases[1], n));
  let ligne = tableau[sort.ordre - 1];
  if (!sienne(ligne)) {
    const portent = tableau.filter(sienne);
    if (portent.length !== 1) {
      throw new ErreurCorpsMagie(`${sort.id} : ligne du sort « ${sort.nom} » introuvable dans le tableau des sorts (ligne ${sort.ordre} : « ${ligne?.cases?.[1] ?? '—'} »)`);
    }
    ligne = portent[0];
  }
  const cases = [...ligne.cases];
  for (const [colonne, n] of Object.entries(CASES_DU_SORT)) {
    if (!(colonne in sort)) continue;
    const voulue = celluleDeTableau(valeurDeCase(sort, colonne));
    const egale = colonne === 'nom' ? memeNom(cases[n], sort.nom) : caseEquivalente(cases[n], voulue);
    if (!egale) cases[n] = voulue;
  }
  lignes[ligne.indice] = ligneDeCases(cases);
  poserSection(morceaux, SECTIONS.sorts, lignes);
}

const LIBELLE_DE_NOTE = /^(?:(?:Note|Commentaire résolu|Commentaire) de la cellule « .+? »|Remarque) du sort « (.+) »$/u;

/** Entrées de la section des notes : [{ debut, fin, libelle (sans échappement), sort (nom), lignes (texte du commentaire, sans échappement) }]. */
function entreesDeNotes(lignes) {
  const debuts = lignes.map((l, i) => (l.startsWith('**') ? i : -1)).filter((i) => i >= 0);
  return debuts.map((debut, k) => {
    let fin = debuts[k + 1] ?? lignes.length;
    while (fin > debut + 1 && lignes[fin - 1] === '') fin--;
    const m = /^\*\*(.+)\*\*(?: : (.*))?$/u.exec(lignes[debut]);
    if (!m) throw new ErreurCorpsMagie(`notes des sorts : ligne « ${lignes[debut].slice(0, 60)} » illisible`);
    const libelle = sansEchappement(m[1]);
    const corps = m[2] !== undefined ? [m[2]] : lignes.slice(debut + 2, fin);
    const texte = corps.map((l) => {
      const sansSaut = l.endsWith(SAUT) ? l.slice(0, -SAUT.length) : l;
      return sansSaut.startsWith('- ') ? `- ${sansEchappement(sansSaut.slice(2))}` : sansEchappement(sansSaut);
    });
    return { debut, fin, libelle, sort: normEspaces(LIBELLE_DE_NOTE.exec(libelle)?.[1] ?? ''), lignes: texte };
  });
}

/** La remarque d'un sort est le texte de ses entrées de notes, séparées par une ligne vide (blancs de bord de ligne près, comme la citation). */
const remarqueDesEntrees = (entrees) => lignesDeCommentaire(entrees.map((e) => e.lignes.join('\n')).join('\n\n')).join('\n');

/** Rang (= ordre) de chaque sort du tableau, par nom (forme des libellés de notes) : place d'une entrée ou d'un texte ajouté, dans l'ordre des sorts. */
function nomsDuTableau(morceaux) {
  const s = section(morceaux, SECTIONS.sorts);
  if (!s) return new Map();
  return new Map(tableauDesSorts(contenu(s)).map((l, i) => [normEspaces(sansEchappement((l.cases?.[1] ?? '').replace(/<br>/g, ' '))), i + 1]));
}

function poserRemarqueDuSort(morceaux, avant, apres) {
  const noms = new Set([avant?.nom, apres.nom].filter(Boolean).map(normEspaces));
  const s = section(morceaux, SECTIONS.notes);
  const lignes = s ? contenu(s) : [];
  const entrees = entreesDeNotes(lignes);
  const siennes = entrees.filter((e) => noms.has(e.sort));
  const nom = normEspaces(apres.nom);
  const voulue = apres.remarque ? lignesDeCommentaire(apres.remarque).join('\n') : null;
  if (voulue === null ? !siennes.length : siennes.length && remarqueDesEntrees(siennes) === voulue) {
    // remarque inchangée : seul le nom du sort dans les libellés peut changer
    for (const e of [...siennes].reverse()) {
      if (e.sort === nom) continue;
      const libelle = e.libelle.replace(/du sort « .+ »$/u, () => `du sort « ${nom} »`);
      lignes.splice(e.debut, e.fin - e.debut, ...lignesDEntree(libelle, e.lignes));
    }
  } else {
    // remarque modifiée : ses entrées sont remplacées par une seule, à la place de la première, sinon dans l'ordre des sorts
    const rangs = nomsDuTableau(morceaux);
    let place = siennes.length ? siennes[0].debut : null;
    for (const e of [...siennes].reverse()) {
      let fin = e.fin;
      while (lignes[fin] === '') fin++;
      lignes.splice(e.debut, fin - e.debut);
    }
    while (lignes.length && lignes.at(-1) === '') lignes.pop();
    if (voulue !== null) {
      if (place !== null) place = Math.min(place, lignes.length);
      if (place === null) {
        const suivante = entreesDeNotes(lignes).find((e) => (rangs.get(e.sort) ?? Infinity) > apres.ordre);
        place = suivante ? suivante.debut : lignes.length;
      }
      const bloc = lignesDEntree(`Remarque du sort « ${nom} »`, voulue.split('\n'));
      if (place < lignes.length) bloc.push('');
      else if (lignes.length) bloc.unshift('');
      lignes.splice(place, 0, ...bloc);
    }
  }
  poserSection(morceaux, SECTIONS.notes, lignes);
}

/** Blocs « ### Titre » de la section des textes de niveau 5 : [{ debut, fin, titre (sans échappement), citation: lignes « > » }]. */
function blocsDeNiveau5(lignes) {
  const debuts = lignes.map((l, i) => (l.startsWith('### ') ? i : -1)).filter((i) => i >= 0);
  return debuts.map((debut, k) => {
    const fin = debuts[k + 1] ?? lignes.length;
    return { debut, fin, titre: sansEchappement(lignes[debut].slice(4)), citation: lignes.slice(debut + 1, fin).filter((l) => l.startsWith('>')) };
  });
}

function poserTexteDeNiveau5(morceaux, avant, apres) {
  const noms = new Set([avant?.nom, apres.nom].filter(Boolean).map(plier));
  const s = section(morceaux, SECTIONS.niveau5);
  const lignes = s ? contenu(s) : [];
  const bloc = blocsDeNiveau5(lignes).find((b) => noms.has(plier(b.titre)));
  const citation = apres.texte_niveau5 ? lignesDeTexte(apres.texte_niveau5, '> ') : [];
  if (!citation.length) {
    if (bloc?.citation.length) lignes.splice(bloc.debut, bloc.fin - bloc.debut);
    else if (bloc && plier(bloc.titre) !== plier(apres.nom)) lignes[bloc.debut] = `### ${echapperLigne(fmt(apres.nom))}`;
    poserSection(morceaux, SECTIONS.niveau5, lignes);
    return;
  }
  const titre = bloc && plier(bloc.titre) === plier(apres.nom) ? lignes[bloc.debut] : `### ${echapperLigne(fmt(apres.nom))}`;
  const voulu = [titre, '', ...citation];
  if (bloc) {
    let fin = bloc.fin;
    while (fin > bloc.debut + 1 && lignes[fin - 1] === '') fin--;
    if (!memesLignes(lignes.slice(bloc.debut, fin), voulu)) lignes.splice(bloc.debut, fin - bloc.debut, ...voulu);
  } else {
    // texte nouveau : un bloc titré du nom du sort, dans l'ordre des sorts du tableau
    const rangs = nomsDuTableau(morceaux);
    const rangDe = (b) => [...rangs].find(([n]) => plier(n) === plier(b.titre))?.[1] ?? Infinity;
    const suivant = blocsDeNiveau5(lignes).find((b) => rangDe(b) > apres.ordre);
    if (suivant) lignes.splice(suivant.debut, 0, ...voulu, '');
    else lignes.push(...(lignes.length ? [''] : []), ...voulu);
  }
  poserSection(morceaux, SECTIONS.niveau5, lignes);
}

/**
 * Lecture des morceaux du corps (contrôles : test/corps-magies.test.mjs) : la tête, les lignes « Données » (libellé et valeur sans échappement),
 * les rôles, les variantes Mode Hyper, les cases des lignes du tableau des sorts (telles qu'écrites), les entrées des notes (sort et lignes) et les
 * textes de niveau 5 (titre, citation).
 */
export function morceauxDuCorpsDeMagie(corps) {
  const morceaux = decouperCorpsDeMagie(corps);
  const lignesDe = (titre) => {
    const s = section(morceaux, titre);
    return s ? contenu(s) : [];
  };
  const hyper = lignesDe(SECTIONS.hyper);
  const tableHyper = lignesDuTableau(hyper).map((i) => casesDeLigne(hyper[i]));
  return {
    tete: morceaux.tete,
    titres: morceaux.sections.map((s) => s.titre),
    donnees: elementsEtiquetes(lignesDe(SECTIONS.donnees)).map((e) => ({ libelle: sansEchappement(e.libelle), valeur: e.valeur })),
    roles: lignesDe(SECTIONS.roles).filter((l) => l.startsWith('- ')).map((l) => sansEchappement(l.slice(2))),
    hyper: tableHyper.length
      ? tableHyper.map((c) => ({ variante: sansEchappement(c[0]), effet: c[1] }))
      : elementsEtiquetes(hyper).map((e) => ({ variante: sansEchappement(e.libelle), effet: e.valeur.join('\n') })),
    sorts: tableauDesSorts(lignesDe(SECTIONS.sorts)).map((l) => l.cases),
    notes: entreesDeNotes(lignesDe(SECTIONS.notes)).map(({ libelle, sort, lignes }) => ({ libelle, sort, lignes })),
    niveau5: blocsDeNiveau5(lignesDe(SECTIONS.niveau5)).map(({ titre, citation }) => ({ titre, citation })),
  };
}

/** Le nom d'un sort ramené à la forme des libellés de notes (espaces regroupés) et des titres de niveau 5 (sans accents ni casse). */
export const nomDeNote = (nom) => normEspaces(nom);
export const nomPlie = (nom) => plier(nom);

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Point d'entrée
// ---------------------------------------------------------------------------------------------------------------------------------------------

/** Tables dont une ligne a des morceaux dans le corps de la page de sa magie, et l'id de cette page. */
export const PAGE_DE_LA_LIGNE = {
  magie: (l) => l.id,
  magie_role: (l) => l.magie_id,
  mode_hyper_effet: (l) => l.magie_id,
  sort: (l) => l.magie_id,
};

/**
 * Le corps de la page d'une magie après la modification d'une ligne de `table` (magie, magie_role, mode_hyper_effet version onglet_magie, sort).
 * `avant` et `apres` sont la ligne entière avant et après (`avant` sert à retrouver un sort renommé dans les notes et les textes de niveau 5 ; il peut
 * être null). Seuls les morceaux qui dérivent de la ligne et ne disent plus ce que dit `apres` sont réécrits ; le reste du corps est rendu octet pour
 * octet. Lève ErreurCorpsMagie quand un morceau attendu est introuvable (ligne du sort, rôle, variante Mode Hyper).
 */
export function corpsDeMagieApres(corps, table, avant, apres) {
  const morceaux = decouperCorpsDeMagie(corps);
  if (table === 'magie') poserMagie(morceaux, apres);
  else if (table === 'magie_role') poserRole(morceaux, apres);
  else if (table === 'mode_hyper_effet') poserModeHyper(morceaux, apres);
  else if (table === 'sort') {
    poserLigneDuSort(morceaux, apres, avant);
    if ('remarque' in apres) poserRemarqueDuSort(morceaux, avant, apres);
    if ('texte_niveau5' in apres) poserTexteDeNiveau5(morceaux, avant, apres);
  } else throw new ErreurCorpsMagie(`table ${table} : pas de morceau dans le corps d'une page de magie`);
  return assemblerCorpsDeMagie(morceaux);
}

/**
 * Le résumé de la page d'une magie après la modification de sa ligne : la première phrase de la nouvelle présentation, si le résumé actuel est celui
 * de l'ancienne (il en dérive) ; sinon il est laissé tel quel.
 */
export function resumeDeMagieApres(resume, avant, apres) {
  if ((resume ?? null) !== resumeDeMagie(avant ?? {})) return resume ?? null;
  return resumeDeMagie(apres);
}

/**
 * Une page qui cite un sort par un titre « ## Effet "Nom" » (pages du bestiaire : creature_effet.libelle) : la ligne du titre suit le libellé renommé
 * (serveur/edition.mjs#deriverNomDuSort). Les autres lignes ne bougent pas.
 */
export function corpsAvecTitreRenomme(corps, libelleAvant, libelleApres) {
  if (libelleAvant === libelleApres) return corps;
  const ecrits = new Set([`## ${libelleAvant}`, `## ${echapperLigne(libelleAvant)}`]);
  return String(corps).split('\n').map((l) => (ecrits.has(l) ? `## ${echapperLigne(libelleApres)}` : l)).join('\n');
}
