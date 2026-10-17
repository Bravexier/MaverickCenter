// Corps et résumé de la page d'un métier (page.corps_md et page.resume de metiers/<slug>) recalculés depuis sa ligne de la table `metier` : le défaut D4
// de l'édition du site de dev (client/serveur/edition.mjs ; docs/serveur.md, « Édition »). Ce corps ne s'affiche pas (un métier est une ligne du tableau
// de /metiers/, lib/metiers.mjs) : il sert à la recherche (page_fts, search-index.json) et aux [[liens]].
//
// Forme du corps : cinq champs « **Libellé :** valeur », un paragraphe chacun, séparés par une ligne vide, dans l'ordre de CHAMPS_DU_CORPS. Une valeur
// est du texte, jamais du Markdown (le tableau l'affiche telle quelle) : elle est échappée (markdownDeValeur), si bien qu'aucune ligne d'une valeur ne
// commence par « ** » ; un champ s'étend donc de son libellé jusqu'au champ suivant (toute ligne « **Libellé :** ») ou à la fin du corps, paragraphes
// compris. Un champ vide s'écrit « **Libellé :** » sans valeur (« Avantage possible » de l'Artisan). Le nom fait le titre de la page, pas le corps ; la
// colonne `remarque` n'y est pas écrite (aucun corps de l'import ne porte de remarque : aucune forme à reprendre).
//
// Stratégie : REMPLACEMENT DE SECTIONS. Le rendu complet (corpsDeMetier) redonne corps_md à l'octet près pour chaque métier dont le corps n'a pas de
// [[lien]] (70 des 72 de l'import) ; l'Alchimiste et l'Apothicaire portent dans « Artisanat possible » le lien [[Alchimie primitive|alchimie primitive]]
// posé par le maillage (npm run autolink), que la table n'a pas : un rendu complet le perdrait. corpsApres ne réécrit donc que les champs des colonnes
// modifiées et y repose les liens de l'ancien champ dont le texte est encore écrit dans la nouvelle valeur. Invariants rejoués sur toute la base par
// test/corps-metiers.test.mjs : sansLiens(corps_md) === corpsDeMetier(ligne) pour tout métier, et remplacer un champ par sa propre valeur redonne le
// corps à l'octet près.
//
// Fonctions pures, sans dépendance : importées par lib/metier-champs.mjs (qui les réexporte pour le service et le script de l'édition).

/** Champs de la page d'un métier : colonne de `metier` et libellé écrit dans le corps, dans l'ordre de la page. */
export const CHAMPS_DU_CORPS = [
  { colonne: 'description', libelle: 'Description du métier' },
  { colonne: 'bonus_brut', libelle: 'Bonus' },
  { colonne: 'artisanat_brut', libelle: 'Artisanat possible' },
  { colonne: 'equipement_brut', libelle: 'Équipement supplémentaire possible' },
  { colonne: 'avantage_brut', libelle: 'Avantage possible' },
];

/** Syntaxe des [[liens]] : la même que WIKILINK_SOURCE de lib/wikilinks.mjs (qui lit des fichiers et ne peut pas être importé ici ; testé). */
export const SOURCE_DES_LIENS = String.raw`\[\[([^\[\]|]+?)(?:\|([^\[\]]+?))?\]\]`;

/**
 * Une balise du glossaire dont le séparateur vient d'être échappé (« {{id\|texte}} ») : hors d'une ligne de tableau, il s'écrit « | » (forme canonique
 * d'un texte mis en forme, lib/mots-cles-balises.mjs#formeCanonique ; la ref est un id, sans rien à échapper).
 */
const BALISE_AU_SEPARATEUR_ECHAPPE = /\{\{([^{}|\\\n]+?)\\\|([^{}\n]*?)\}\}/g;

/**
 * Échappe un texte pour une ligne de Markdown : rien de ce qui est écrit ne devient un lien, une mise en forme, une balise, un tableau ou une entité
 * (« &amp; » reste écrit tel quel). Une balise du glossaire garde son séparateur « | » (la ligne n'est pas une ligne de tableau).
 */
export const echapperMarkdown = (texte) =>
  String(texte ?? '')
    .replace(/([\\[\]*_`<>~|])/g, '\\$1')
    .replace(/&(?=#?[A-Za-z0-9]+;)/g, '\\&')
    .replace(BALISE_AU_SEPARATEUR_ECHAPPE, '{{$1|$2}}');

/**
 * Échappe le début d'une ligne de valeur (après la première, qui suit le libellé) qui en ferait un bloc Markdown : intertitre « # », soulignement
 * d'intertitre ou filet (« --- », « === », « - - - »), puce « + », liste numérotée « 1. ». La puce « - » reste une puce (type « texte » de l'édition,
 * comme lib/sort-format.mjs#blocsDeTexte), son texte est échappé à son tour. La ligne reçue est déjà échappée par echapperMarkdown et sans espaces de bord.
 */
function echapperDebutDeLigne(ligne) {
  if (/^(?:[-=]+|(?:-[ \t]*){3,})$/.test(ligne)) return `\\${ligne}`;
  const puce = /^-[ \t]+/.exec(ligne);
  if (puce) return `- ${echapperDebutDeLigne(ligne.slice(puce[0].length))}`;
  if (/^(?:#|\+(?:[ \t]|$))/.test(ligne)) return `\\${ligne}`;
  const numero = /^\d{1,9}(?=[.)](?:[ \t]|$))/.exec(ligne);
  if (numero) return `${numero[0]}\\${ligne.slice(numero[0].length)}`;
  return ligne;
}

/**
 * Une valeur de la table écrite en Markdown (sans le libellé) : fins de ligne unifiées (puis écrites avec `fin`), espaces de bord de la valeur et de
 * chaque ligne retirées (comme à l'affichage d'un texte de la base), texte échappé. '' pour une valeur absente, vide ou faite d'espaces.
 */
export function markdownDeValeur(valeur, fin = '\n') {
  const texte = String(valeur ?? '').replace(/\r\n?/g, '\n').trim();
  if (!texte) return '';
  return texte
    .split('\n')
    .map((ligne, i) => {
      const echappee = echapperMarkdown(ligne.trim());
      return i === 0 ? echappee : echapperDebutDeLigne(echappee);
    })
    .join(fin);
}

/** Un champ du corps : « **Libellé :** valeur », ou « **Libellé :** » seul pour une valeur vide. */
export function champDuCorps(libelle, valeur, fin = '\n') {
  const md = markdownDeValeur(valeur, fin);
  return `**${libelle} :**${md ? ` ${md}` : ''}`;
}

/** Rendu complet : le corps de la page d'un métier d'après sa ligne (ses cinq champs dans l'ordre de la page). Celui d'un métier créé depuis le site. */
export const corpsDeMetier = (metier, fin = '\n') =>
  `${CHAMPS_DU_CORPS.map((c) => champDuCorps(c.libelle, metier?.[c.colonne], fin)).join(fin + fin)}${fin}`;

/** Fin de ligne d'un corps : « \r\n » s'il en contient (corps écrit sous Windows), sinon (corps vide compris) « \n ». Les champs réécrits la reprennent. */
const finDeLigneDe = (corps) => (/\S/.test(corps) && /\r\n/.test(corps) ? '\r\n' : '\n');

/** Début d'un champ : une ligne qui commence par « **Libellé :** » (libellé sans astérisque ni retour à la ligne). */
const DEBUT_DE_CHAMP = /(^|\n)\*\*([^*\r\n]+?) :\*\*/g;

/**
 * Les champs écrits dans un corps, dans l'ordre : { libelle, debut, fin } où corps.slice(debut, fin) va de « **Libellé :** » à la fin de la valeur
 * (paragraphes compris, espaces et lignes vides de fin exclues), jusqu'au début du champ suivant (connu de CHAMPS_DU_CORPS ou non) ou à la fin du corps.
 */
export function champsDuCorps(corps) {
  const texte = String(corps ?? '');
  const debuts = [...texte.matchAll(DEBUT_DE_CHAMP)].map((m) => ({ libelle: m[2], debut: m.index + m[1].length }));
  return debuts.map((d, i) => {
    const limite = i + 1 < debuts.length ? debuts[i + 1].debut : texte.length;
    return { libelle: d.libelle, debut: d.debut, fin: d.debut + texte.slice(d.debut, limite).replace(/\s+$/, '').length };
  });
}

/** Le texte d'un Markdown sans ses [[liens]] : [[Cible|texte]] → texte, [[Cible]] → Cible. */
export const sansLiens = (md) => String(md ?? '').replace(new RegExp(SOURCE_DES_LIENS, 'g'), (_, cible, texte) => texte ?? cible);

const lettreOuChiffre = /[\p{L}\p{N}]/u;

/**
 * Repose dans `md` (nouvelle valeur, sans lien) les liens d'une ancienne valeur, dans leur ordre : chacun à la première occurrence de son texte qui
 * suit le lien précédent et forme des mots entiers (ni lettre ni chiffre collé de part et d'autre) ; un lien dont le texte n'est plus écrit disparaît.
 */
function reposerLiens(md, ancien) {
  let sortie = '';
  let depuis = 0;
  for (const m of ancien.matchAll(new RegExp(SOURCE_DES_LIENS, 'g'))) {
    const texte = m[2] ?? m[1];
    let i = md.indexOf(texte, depuis);
    while (i >= 0 && (lettreOuChiffre.test(md[i - 1] ?? '') || lettreOuChiffre.test(md[i + texte.length] ?? ''))) i = md.indexOf(texte, i + 1);
    if (i < 0) continue;
    sortie += md.slice(depuis, i) + m[0];
    depuis = i + texte.length;
  }
  return sortie + md.slice(depuis);
}

const rangDuLibelle = (libelle) => CHAMPS_DU_CORPS.findIndex((c) => c.libelle === libelle);

/** Ajoute un champ absent à sa place dans l'ordre de CHAMPS_DU_CORPS (après le dernier champ qui le précède, sinon avant le premier qui le suit), sinon à la fin. */
function insererChamp(texte, champs, libelle, nouveau, fin) {
  const rang = rangDuLibelle(libelle);
  if (rang >= 0) {
    const precedent = champs.filter((c) => rangDuLibelle(c.libelle) >= 0 && rangDuLibelle(c.libelle) < rang).at(-1);
    if (precedent) return `${texte.slice(0, precedent.fin)}${fin}${fin}${nouveau}${texte.slice(precedent.fin)}`;
    const suivant = champs.find((c) => rangDuLibelle(c.libelle) > rang);
    if (suivant) return `${texte.slice(0, suivant.debut)}${nouveau}${fin}${fin}${texte.slice(suivant.debut)}`;
  }
  const debut = texte.replace(/\s+$/, '');
  return debut ? `${debut}${fin}${fin}${nouveau}${fin}` : `${nouveau}${fin}`;
}

/**
 * Remplace un champ « **Libellé :** valeur » du corps, en entier (tous ses paragraphes, jusqu'au champ suivant ou à la fin), partout où il est écrit ;
 * le reste du corps ne bouge pas, octet pour octet, et les liens [[…]] de l'ancienne valeur dont le texte est encore écrit sont reposés. Un champ absent
 * est ajouté à sa place. `valeur` null, vide ou faite d'espaces : « **Libellé :** » sans valeur.
 */
export function remplacerChampDuCorps(corps, libelle, valeur) {
  const texte = String(corps ?? '');
  const fin = finDeLigneDe(texte);
  const champs = champsDuCorps(texte);
  const tete = `**${libelle} :**`;
  const nouveau = champDuCorps(libelle, valeur, fin).slice(tete.length);
  const vises = champs.filter((c) => c.libelle === libelle);
  if (!vises.length) return insererChamp(texte, champs, libelle, tete + nouveau, fin);
  let sortie = texte;
  for (const c of vises.reverse()) {
    const ancien = texte.slice(c.debut + tete.length, c.fin);
    sortie = `${sortie.slice(0, c.debut)}${tete}${reposerLiens(nouveau, ancien)}${sortie.slice(c.fin)}`;
  }
  return sortie;
}

/** Vrai si le champ est écrit dans le corps et redit `valeur` (liens [[…]] mis à part, fins de ligne comprises) partout où il est écrit. */
export function champAJour(corps, libelle, valeur) {
  const texte = String(corps ?? '');
  const vises = champsDuCorps(texte).filter((c) => c.libelle === libelle);
  const attendu = champDuCorps(libelle, valeur);
  return vises.length > 0 && vises.every((c) => sansLiens(texte.slice(c.debut, c.fin)).replace(/\r\n?/g, '\n') === attendu);
}

/**
 * Le corps de la page après la modification d'une ligne de `metier` : seuls les champs des colonnes qui diffèrent entre `avant` et `apres` sont
 * réécrits (remplacerChampDuCorps). Sans `avant` (null), chaque champ qui ne redit pas sa colonne (champAJour) est réécrit : un corps en retard est
 * remis d'accord avec la table, un corps à jour ne change pas. Une colonne absente de `apres` (ligne partielle) n'est jamais touchée.
 * @param {string} corps page.corps_md actuel
 * @param {Record<string, unknown> | null} avant la ligne de metier avant la modification
 * @param {Record<string, unknown>} apres la ligne après
 */
export function corpsApres(corps, avant, apres) {
  let sortie = String(corps ?? '');
  for (const { colonne, libelle } of CHAMPS_DU_CORPS) {
    if (!apres || !(colonne in apres)) continue;
    if (avant ? (avant[colonne] ?? null) === (apres[colonne] ?? null) : champAJour(sortie, libelle, apres[colonne])) continue;
    sortie = remplacerChampDuCorps(sortie, libelle, apres[colonne]);
  }
  return sortie;
}

/**
 * Le résumé de la page d'un métier : la première phrase de sa description (jusqu'au premier « . ! ? … » suivi d'une espace), prise dans son premier
 * paragraphe, retours à la ligne remplacés par une espace ; '' pour une description vide. Le même que lib/metier-champs.mjs#resumeDeDescription pour une
 * description d'un seul paragraphe (toutes celles de l'import ; testé), qui laisserait passer les paragraphes suivants quand le premier n'a pas de point.
 */
export function resumeDuMetier(description) {
  const texte = String(description ?? '').replace(/\r\n?/g, '\n').trim();
  const paragraphe = texte.split(/\n\s*\n/)[0];
  const m = /^(.+?[.!?…])\s/s.exec(paragraphe);
  return (m ? m[1] : paragraphe).replace(/[ \t]*\n\s*/g, ' ');
}

/**
 * Ce que la page d'un métier tire de sa ligne après une modification : { corps_md, resume } (resume null pour une description vide, comme l'import).
 * Le titre (`nom`) et sa clé restent à la charge de l'appelant (normalize de lib/text.mjs).
 */
export const pageDuMetier = (corps, avant, apres) => ({
  corps_md: corpsApres(corps, avant, apres),
  resume: resumeDuMetier(apres?.description) || null,
});
