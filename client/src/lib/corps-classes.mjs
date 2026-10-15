// Corps Markdown (et résumé) des pages de classe (classes/<slug>) et des fiches de dons (capacites/<classe>-<nom>), refaits depuis les tables
// classe, categorie_classe, specialite, classe_annexe et capacite : le rendu de l'importeur tools/sheets/classes.py (render_class, render_capacity,
// capacity_summary, first_sentence), réécrit pour l'édition depuis le site de dev (client/serveur/edition.mjs). Ces pages s'affichent depuis les
// tables (lib/classes-db.mjs) ; leur corps sert à la recherche (page_fts) et aux [[liens]], il doit donc suivre les tables quand le site les modifie.
//
// Rendu complet : test/corps-classes.test.mjs le rejoue sur toutes les pages du domaine de la base construite depuis data/rows ; il redonne corps_md
// et resume à l'octet près pour les 39 classes et les 660 dons. Une seule information n'est que dans le corps : le titre « CHOSE À SAVOIR » sans texte
// du Bimane (classe.chose_a_savoir NULL veut dire « bloc absent OU intitulé sans texte ») ; corpsDeClasse le reçoit en option, lue dans le corps en
// place par choseASavoirSansTexte (changementsDePageDeClasse le fait).
//
// Ce que l'importeur n'a jamais écrit (aucune ligne de la base n'en a besoin, donc rien ne change pour les pages en place) :
//  - une présentation (classe.description) ou une description de spécialité sans titre de la feuille (description_titre NULL : Grenadier, Arbalétrier…)
//    prend le libellé du champ sur le site (« Présentation », « Description ») ;
//  - la remarque d'une classe (« ## Remarque », en fin de page) et d'une spécialité (« #### Remarque », sous sa description), que le site affiche
//    sous ce titre ; la remarque d'un don, elle, suit le format de l'importeur (« Note de cellule : », capacite.remarque reprend ces notes) ;
//  - classe.chose_a_savoir_lien n'est pas écrit (l'importeur citait la cellule du lien, que la base ne garde pas ; aucune classe n'en a depuis la
//    migration 0019, et le site ne le modifie pas).
// Fonctions pures, sans dépendance : elles reçoivent les lignes des tables, jamais la base.

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Outils de l'importeur (fmt, esc_inline, md_blocks, md_text, cell_md, table, first_sentence), à l'identique
// ---------------------------------------------------------------------------------------------------------------------------------------------

/** Les blancs de Python (str.isspace, \s d'une expression régulière) : ceux de String.prototype.trim n'en sont pas exactement l'ensemble. */
const BLANCS = '\\t\\n\\v\\f\\r\\x1c-\\x20\\x85\\xa0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000';
const BLANC = `[${BLANCS}]`;
const NON_BLANC = `[^${BLANCS}]`;
const DEBUT_BLANC = new RegExp(`^${BLANC}+`);
const FIN_BLANC = new RegExp(`${BLANC}+$`);
/** str.strip() de Python. */
const strip = (s) => s.replace(DEBUT_BLANC, '').replace(FIN_BLANC, '');

/** fmt de l'importeur pour un texte : retours à la ligne unifiés, blancs du bord retirés. */
const fmt = (texte) => strip(String(texte).replace(/\r\n/g, '\n').replace(/\r/g, '\n'));

/** fmt d'un nombre de la feuille : la cellule est un flottant, écrit par repr() de Python (« 9.0 ») ; les colonnes de la base sont entières. */
const fmtNombre = (n) => (Number.isInteger(n) ? `${n}.0` : String(n));

const escPlain = (s) =>
  s
    .replace(/\\/g, '\\\\')
    .replace(/([`*_[\]<~])/g, '\\$1')
    .replace(/&(?=#?[\p{L}\p{N}_]+;)/gu, '\\&');

const CITATION = new RegExp(`^(${BLANC}*)>`);
const TITRE = new RegExp(`^(${BLANC}*)(#{1,6})(?=${BLANC}|$)`);
const PUCE = new RegExp(`^(${BLANC}*)([-+])(?=${BLANC}|$)`);
const NUMERO = new RegExp(`^(${BLANC}*)(\\p{Nd}+)([.)])(?=${BLANC}|$)`, 'u');

/** esc_inline : un texte d'une ligne échappé pour le Markdown ; en début de ligne, ni citation, ni titre, ni liste. */
export function echapperLigne(texte) {
  return escPlain(String(texte)).replace(CITATION, '$1\\>').replace(TITRE, '$1\\$2').replace(PUCE, '$1\\$2').replace(NUMERO, '$1$2\\$3');
}

const ELEMENT_DE_LISTE = new RegExp(`^-${BLANC}+${NON_BLANC}`);

/** md_blocks : paragraphes ['p', lignes] et listes ['ul', éléments] d'un texte ; une ligne « - … » est un élément de liste. */
function blocs(texte) {
  const sortie = [];
  let para = [];
  let items = [];
  const finPara = () => {
    if (para.length) sortie.push(['p', para]);
    para = [];
  };
  const finItems = () => {
    if (items.length) sortie.push(['ul', items]);
    items = [];
  };
  for (const brute of fmt(texte).split('\n')) {
    const ligne = strip(brute);
    if (!ligne) {
      finPara();
      finItems();
    } else if (ELEMENT_DE_LISTE.test(ligne)) {
      finPara();
      items.push(strip(ligne.slice(1)));
    } else {
      finItems();
      para.push(ligne);
    }
  }
  finPara();
  finItems();
  return sortie;
}

/** md_text : un texte de cellule en lignes Markdown (paragraphes séparés par une ligne vide, sauts de ligne forcés par deux espaces, puces « - »). */
export function lignesMarkdown(texte) {
  const sortie = [];
  for (const [genre, contenu] of blocs(texte)) {
    if (sortie.length) sortie.push('');
    if (genre === 'p') contenu.forEach((l, i) => sortie.push(echapperLigne(l) + (i < contenu.length - 1 ? '  ' : '')));
    else for (const item of contenu) sortie.push(`- ${echapperLigne(item)}`);
  }
  return sortie;
}

/** cell_md : une cellule de tableau (retours à la ligne → <br>, « | » échappé). */
const celluleMarkdown = (texte) => fmt(texte).split('\n').map((l) => echapperLigne(strip(l))).join('<br>').replace(/\|/g, '\\|');

const tableau = (entetes, lignes) => [
  `| ${entetes.join(' | ')} |`,
  `| ${entetes.map(() => '---').join(' | ')} |`,
  ...lignes.map((l) => `| ${l.join(' | ')} |`),
];

const PHRASE = new RegExp(`^(.+?[.!?])(?=${BLANC}|$)`, 's');

/** first_sentence : la première phrase de la première ligne d'un texte (la ligne entière si elle n'a pas de point suivi d'un blanc). */
export function premierePhrase(texte) {
  const para = strip(fmt(texte).split('\n')[0]);
  return PHRASE.exec(para)?.[1] ?? para;
}

/** text_section : un titre de niveau `niveau`, puis le texte s'il y en a un. */
function section(L, niveau, titre, texte) {
  L.push(`${'#'.repeat(niveau)} ${echapperLigne(titre)}`, '');
  if (texte) L.push(...lignesMarkdown(texte), '');
}

/** Les lignes d'une page jointes, sans ligne vide à la fin, terminées par un retour à la ligne (corps_md). */
const fermer = (L) => {
  while (L.length && L.at(-1) === '') L.pop();
  return `${L.join('\n')}\n`;
};

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Page d'une classe (render_class)
// ---------------------------------------------------------------------------------------------------------------------------------------------

/** Intitulés de la page d'une classe : ceux des cellules de titre de l'onglet (identiques dans les 39 onglets, orthographe de la migration 0005). */
export const TITRES_DE_CLASSE = {
  categorie: 'Catégorie',
  noteDuSommaire: 'Note du Sommaire',
  choseASavoir: 'CHOSE À SAVOIR',
  donDeDepart: 'Don de départ',
  stats: ['Santé', 'Chakra', 'Barrière'],
  maitriseArme: 'Maîtrise Arme',
  maitriseArmure: 'Maîtrise Armures',
  inventaire: 'Inventaire de départ',
  arme: 'Arme de départ',
  armure: 'Armure de départ',
  sousClasses: 'Sous-classes',
  annexe: "Tableau sans titre en bas de l'onglet",
  annexeColonnes: ['Libellé', 'Texte'],
  // titres que l'importeur n'a jamais écrits (voir l'en-tête) : libellés des champs sur le site
  presentation: 'Présentation',
  descriptionDeSpecialite: 'Description',
  remarque: 'Remarque',
};

const LIGNE_CHOSE_A_SAVOIR = `## ${TITRES_DE_CLASSE.choseASavoir}`;

/**
 * Le corps dit-il « CHOSE À SAVOIR » sans texte (le titre suivi directement d'un autre titre) ? Seul le Bimane : la base ne le garde nulle part
 * ailleurs (chose_a_savoir NULL).
 */
export function choseASavoirSansTexte(corps) {
  const lignes = String(corps ?? '').split('\n');
  const i = lignes.indexOf(LIGNE_CHOSE_A_SAVOIR);
  return i >= 0 && lignes[i + 1] === '' && /^#/.test(lignes[i + 2] ?? '');
}

/**
 * Spécialités écrites sous « Sous-classes » : les bannières de l'onglet. Une spécialité sans aucun don n'en est pas une (les deux de l'Archimage,
 * cartouches lus comme spécialités par la fiche V15.2.2 : même règle que lib/classe-dons.mjs#plateauDeDons).
 */
export const specialitesDeLaPage = (specialites, dons) => {
  const avecDon = new Set(dons.map((d) => d.specialite_id).filter((id) => id !== null && id !== undefined));
  return [...specialites].sort((a, b) => a.rang - b.rang).filter((s) => avecDon.has(s.id));
};

/**
 * Le corps de la page d'une classe.
 * @param {object} lignes
 * @param {object} lignes.classe sa ligne de la table classe
 * @param {{ libelle: string, note: string | null }} lignes.categorie sa ligne de categorie_classe
 * @param {object[]} [lignes.specialites] ses lignes de specialite (triées ici par `rang`)
 * @param {{ specialite_id: string | null }[]} [lignes.dons] ses dons (table capacite ; seul `specialite_id` est lu)
 * @param {object[]} [lignes.annexe] ses lignes de classe_annexe (triées ici par `rang`)
 * @param {{ choseASavoirSansTexte?: boolean }} [options] titre « CHOSE À SAVOIR » écrit sans texte quand chose_a_savoir est NULL (Bimane)
 * @returns {string}
 */
export function corpsDeClasse({ classe, categorie, specialites = [], dons = [], annexe = [] }, { choseASavoirSansTexte: sansTexte = false } = {}) {
  const T = TITRES_DE_CLASSE;
  const L = [`**${T.categorie}** : ${echapperLigne(categorie.libelle)}`, ''];
  if (categorie.note) L.push(`**${T.noteDuSommaire}** : ${echapperLigne(categorie.note)}`, '');
  if (classe.description_titre !== null || classe.description) section(L, 2, classe.description_titre ?? T.presentation, classe.description);
  if (classe.chose_a_savoir || sansTexte) section(L, 2, T.choseASavoir, classe.chose_a_savoir);
  L.push(`## ${T.donDeDepart}`, '');
  L.push(...tableau(T.stats, [[classe.sante_depart, classe.chakra_depart, classe.barriere_depart].map(fmtNombre)]), '');
  section(L, 3, T.maitriseArme, classe.maitrise_arme);
  section(L, 3, T.maitriseArmure, classe.maitrise_armure);
  section(L, 2, T.inventaire, classe.inventaire_depart);
  section(L, 3, T.arme, classe.arme_depart);
  section(L, 3, T.armure, classe.armure_depart);
  const banniere = specialitesDeLaPage(specialites, dons);
  if (banniere.length) {
    L.push(`## ${T.sousClasses}`, '');
    for (const s of banniere) {
      L.push(`### ${echapperLigne(s.nom)}`, '');
      if (s.description_titre !== null || s.description) section(L, 4, s.description_titre ?? T.descriptionDeSpecialite, s.description);
      if (s.remarque) section(L, 4, T.remarque, s.remarque);
    }
  }
  if (annexe.length) {
    L.push(`## ${T.annexe}`, '');
    const rangees = [...annexe].sort((a, b) => a.rang - b.rang).map((a) => [celluleMarkdown(a.libelle), celluleMarkdown(a.texte)]);
    L.push(...tableau(T.annexeColonnes, rangees), '');
  }
  if (classe.remarque) section(L, 2, T.remarque, classe.remarque);
  return fermer(L);
}

/** Le résumé de la page d'une classe : la première phrase de sa présentation (null sans présentation). */
export const resumeDeClasse = (classe) => (classe.description ? premierePhrase(classe.description) || null : null);

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Fiche d'un don (render_capacity, capacity_summary)
// ---------------------------------------------------------------------------------------------------------------------------------------------

/** Début de la remarque d'un don dans sa fiche : capacite.remarque reprend la note de cellule du classeur, que l'importeur écrivait ainsi. */
export const LIBELLE_DE_NOTE = 'Note de cellule : ';

/** Le corps de la fiche d'un don : son effet, puis sa remarque précédée de « Note de cellule : » (une ligne vide entre les deux). */
export function corpsDeDon(don) {
  const L = don.effet ? lignesMarkdown(don.effet) : [];
  if (don.remarque) L.push(...(L.length ? [''] : []), ...lignesMarkdown(LIBELLE_DE_NOTE + don.remarque));
  return fermer(L);
}

/** Un effet d'une seule ligne d'au plus ce nombre de caractères est le résumé entier. */
const RESUME_COURT = 120;
const ETIQUETTE = /^\([^()]+\)$/;

/**
 * Le résumé de la fiche d'un don (capacity_summary) : l'effet entier s'il tient sur une ligne courte, sinon sa première phrase ; une première ligne
 * qui n'est qu'une étiquette entre parenthèses (« (Rage) ») est suivie de la première phrase de la ligne suivante. null sans effet.
 */
export function resumeDeDon(don) {
  const texte = don.effet ? fmt(don.effet) : '';
  if (!texte) return null;
  if (!texte.includes('\n') && [...texte].length <= RESUME_COURT) return texte;
  const lignes = texte.split('\n').map(strip).filter(Boolean);
  if (lignes.length > 1 && ETIQUETTE.test(lignes[0]) && !ELEMENT_DE_LISTE.test(lignes[1])) return `${lignes[0]} ${premierePhrase(lignes[1])}`;
  return premierePhrase(texte);
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Ce que l'édition écrit dans la page après une modification
// ---------------------------------------------------------------------------------------------------------------------------------------------

/**
 * Les colonnes de la page d'une classe à réécrire après une modification de ses tables (classe, specialite) : { corps_md?, resume? }, vide quand le
 * rendu ne change pas (une page n'est jamais réécrite pour rien). `avant` et `apres` : les lignes de corpsDeClasse avant et après la modification ;
 * `page` : la ligne de la page en place (son corps dit si « CHOSE À SAVOIR » est un titre sans texte). Le corps en place est remplacé en entier :
 * celui d'une classe créée par le site (« À compléter. ») devient le rendu de ses tables dès sa première modification.
 */
export function changementsDePageDeClasse(page, avant, apres) {
  const options = { choseASavoirSansTexte: choseASavoirSansTexte(page.corps_md) };
  const changes = {};
  const corps = corpsDeClasse(apres, options);
  if (corps !== corpsDeClasse(avant, options) && corps !== page.corps_md) changes.corps_md = corps;
  const resume = resumeDeClasse(apres.classe);
  if (resume !== resumeDeClasse(avant.classe) && resume !== page.resume) changes.resume = resume;
  return changes;
}

/** Les colonnes de la fiche d'un don à réécrire après une modification de sa ligne de capacite : { corps_md?, resume? } (vide si rien ne change). */
export function changementsDePageDeDon(page, avant, apres) {
  const changes = {};
  const corps = corpsDeDon(apres);
  if (corps !== corpsDeDon(avant) && corps !== page.corps_md) changes.corps_md = corps;
  const resume = resumeDeDon(apres);
  if (resume !== resumeDeDon(avant) && resume !== page.resume) changes.resume = resume;
  return changes;
}
