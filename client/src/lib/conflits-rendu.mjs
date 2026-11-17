// Les lignes du journal en conflit sur la page « Mise à jour » du site de dev (demande du propriétaire du 2026-10-22 : « Après les listes de
// modifications, montrer les lignes en conflits. 1. Pour chaque conflit, montrer les deux versions 2. Laisser le choix entre 1, 2, ou 3 pour saisir à
// la main ce qui remplace les deux. »). Le service examine chaque lot en conflit (GET /api/mise-a-jour/conflits/, serveur/edition-conflits.mjs) ; ce
// module en fait le HTML et le corps de la résolution (POST), le script de la page (src/scripts/mise-a-jour.mjs) le pose et l'envoie.
//   - rien de technique : le service fournit les textes, la page les affiche (elle n'importe pas lib/edition-modele.mjs#TABLES) ; la légende d'une
//     ligne (`libelle`, sans JSON même pour une clé composée), la raison d'un conflit (`raison_lisible`, repli sur `raison` pour une réponse
//     ancienne), les colonnes d'une saine partielle (`colonnes_libelles`, repli sur `colonnes`), les colonnes d'une ligne entière (`libelles` de la
//     version : seules les colonnes qu'il nomme, par leur vrai nom ; leur nom technique pour une réponse ancienne sans `libelles`) ; aucune valeur
//     n'est montrée en JSON, aucun nom de table ni de colonne n'est écrit ici (demande du propriétaire du 2026-10-23 : « Un vrai nom serai mieux ») ;
//     un lot est dit par sa date et son résumé (`resume` du service, déjà sans identifiant de lot), jamais par son identifiant (lotLisible) ;
//   - deux sortes de lots (`garde` du service) :
//       - gardé (demande du propriétaire du 2026-11-12 : « les modification apporté sur le site prime » ; « Quand un conflit est trop ambigüe seulement
//         là il est listé dans l'onglet mise à jour avec à gauche "modification sur site" et à droite "modification du code" ») : la fusion à trois voies
//         n'a pas pu se faire, la valeur du site est restée en place ; à gauche la version 1, « modification sur le site » (datée par son lot), à droite
//         la version 2, « modification du code » (les règles livrées, ou fusionnées avec un lot plus ancien du site : `provenance_2`) ; pour deux
//         textes, seulement les passages en conflit (`passages`) ; choix 1 garder le site sur les passages en conflit, 2 y prendre le code (le
//         reste fusionné dans les deux cas : réponse du propriétaire « Les garder (Recommandé) »), 3 saisir (départ : `valeur_1`) ; le résultat de
//         chaque choix (`valeur_1`, `valeur_2`) dans le bloc fermé ; la page affiche `valeur_1` en attendant le choix ;
//       - annulé (tout autre conflit, ou une base vivante d'avant la fusion) : la version 1 (modifiée sur le site de dev, par ce lot) et la version 2
//         (la valeur actuelle, dont le titre dit d'où elle vient : `provenance_2`, règles livrées, un lot du site de dev ou une résolution), ou « ligne
//         supprimée » ; deux textes : seulement leurs différences mot à mot (lib/notes-de-version-rendu.mjs#diffMots), les passages identiques
//         repliés (lib/diff-replie.mjs ; demande du propriétaire du 2026-11-07), les deux versions entières dans un bloc fermé ; sinon les deux
//         versions côte à côte, en texte (retours à la ligne gardés) ;
//     puis le choix 1, 2 ou 3 ; un choix impossible est grisé, avec sa raison ; le 3 ouvre une saisie qui suit le type de la colonne (le champ de
//     lib/edition-modele.mjs#TABLES que le service rend : `saisie`) ; un lot dont un champ attend un lot plus ancien (`bloque`) ne s'envoie pas
//     (bouton grisé, la raison dite) ; les lots plus récents du même champ (`lots_suivants`), les colonnes fusionnées sans conflit
//     (`fusionnees_libelles`) et les lots retenus derrière un conflit (`retenus`) sont dits ;
//   - l'aperçu HTML d'une page modifiée (`apercu`) n'est pas montré : le Markdown de la version 1 se lit tel quel, et aucun HTML reçu n'est posé ;
//   - le corps de la résolution : { lot, empreinte, choix: { "<id>": { choix, valeur? } } } ; la saisie du 3 passe d'abord les contrôles simples de
//     l'éditeur (valeur obligatoire, nombre, bornes : erreurDeSaisie, comme lib/edition-modele.mjs#valeurDuChamp), le service refait tous les siens.
// Fonctions pures (chaîne HTML en sortie, tout texte échappé), sans dépendance hors lib/notes-de-version-rendu.mjs et lib/diff-replie.mjs (purs, sans import) : le script
// de la page Mise à jour est le seul à les importer (skill site-version-portable : jamais lib/edition-modele.mjs, que la chaîne de l'édition importe).
import { replierLeDiff } from './diff-replie.mjs';
import { diffMots, echapper } from './notes-de-version-rendu.mjs';

/** Ce que devient une modification saine du lot (issue rendue par le service). */
export const ISSUES_SAINES = Object.freeze({
  reappliquee: 'repartira telle quelle',
  deja_la: 'déjà dans les règles livrées',
  derivee: 'recalculée d’après sa source',
  sans_effet: 'sans effet aujourd’hui',
  // une règle en données d'un don que le lot supprime aussi (serveur/edition-conflits.mjs#suiventLeDon) : pas de choix à elle ; son don (`don` de la
  // modification, son libellé) est nommé par issueDeLaSaine
  suit_le_don: 'suit son don : retirée avec lui, gardée s’il reste',
});

/** Ce que devient une modification saine, en texte (ISSUES_SAINES) ; une règle qui suit son don le nomme (« suit son don (Don « X ») : … »). */
export function issueDeLaSaine(s) {
  if (s.issue === 'suit_le_don' && s.don) return `suit son don (${s.don}) : retirée avec lui, gardée s’il reste`;
  return ISSUES_SAINES[s.issue] ?? s.issue;
}

const OPERATIONS = Object.freeze({ modifier: 'modification', inserer: 'création', supprimer: 'suppression' });

const INSTANT = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' });
/** « 22 octobre 2026 à 21:34 » d'un instant ISO 8601 ; l'instant tel quel s'il ne se lit pas. */
export function instantLisible(iso) {
  const d = new Date(iso ?? '');
  return Number.isNaN(d.getTime()) ? String(iso ?? '') : INSTANT.format(d);
}

/** Un texte du service qui cite un lot par son instant ISO (« Le lot du 2026-11-12T10:00:00Z… ») : cet instant, et lui seul, en date lisible. */
export const avecDateLisible = (texte, l) => (l?.fait_le ? String(texte ?? '').replaceAll(l.fait_le, instantLisible(l.fait_le)) : String(texte ?? ''));

/** Un lot dit par sa date et son résumé (`{ fait_le, resume }` du service) : « lot du 12 novembre 2026 à 11:00 (« Métier Forgeron : Description ») ». */
export function lotLisible(l) {
  const resume = l?.resume;
  return `lot${l?.fait_le ? ` du ${instantLisible(l.fait_le)}` : ''}${resume ? ` (« ${resume} »)` : ''}`;
}

/**
 * D'où vient une valeur (une provenance du service : `provenance_2`, `actuelle.provenance`), en une proposition qui suit « la valeur actuelle, … » ;
 * null pour une provenance inconnue (réponse ancienne : rien n'est affirmé). Demande du propriétaire du 2026-11-07 : « Il faut aussi clarifié d'où viens
 * la modification de la V1 et de la V2 ».
 */
export function origineDeLaValeur(p) {
  switch (p?.genre) {
    case 'regles': return 'venue des règles livrées';
    case 'regles_et_site': return `venue des règles livrées, fusionnées avec le ${lotLisible(p)} du site de dev`;
    case 'site': return `écrite sur le site de dev par le ${lotLisible(p)}`;
    case 'resolution': return `écrite par la résolution d’un conflit (${lotLisible(p)})`;
    default: return null;
  }
}

/**
 * Une valeur d'un champ, en texte, jamais en JSON : vide → « (vide) » ; image → son résumé ; liste → « a, b » ; objet → « clé : valeur, … » (les
 * vides omis).
 */
export function texteDeValeur(v) {
  if (v === null || v === undefined || v === '') return '(vide)';
  if (Array.isArray(v)) return v.length ? v.map(texteDeValeur).join(', ') : '(vide)';
  if (typeof v === 'object') {
    if (v.image) return `image ${v.resume ?? v.empreinte ?? ''}`.trim();
    return Object.entries(v).filter(([, x]) => x !== null && x !== undefined && x !== '').map(([k, x]) => `${k} : ${texteDeValeur(x)}`).join(', ') || '(vide)';
  }
  return String(v);
}

/**
 * Une ligne entière, en texte : « Nom : valeur » par colonne (les vides omises). Quand le service nomme les colonnes (`libelles` de la version : colonne →
 * vrai nom, lib/libelles-de-la-base.mjs), seules les colonnes nommées se montrent, par leur nom : une colonne qu'il ne nomme pas n'apparaît jamais sous
 * son nom technique. Sans `libelles` (réponse ancienne), chaque colonne sous son nom.
 */
function texteDeLigne(ligne, libelles) {
  const nommees = libelles && typeof libelles === 'object';
  return Object.entries(ligne ?? {})
    .filter(([c, v]) => v !== null && v !== undefined && v !== '' && (!nommees || (typeof libelles[c] === 'string' && libelles[c])))
    .map(([c, v]) => `${nommees ? libelles[c] : c} : ${texteDeValeur(v)}`).join('\n') || '(vide)';
}

/** Une version d'un conflit ({ genre, valeur, libelles? } du service), en texte. */
export function texteDeLaVersion(version) {
  switch (version?.genre) {
    case 'valeur': return texteDeValeur(version.valeur);
    case 'ligne':
    case 'valeurs': return texteDeLigne(version.valeur, version.libelles);
    case 'suppression': return `Ligne supprimée par le site de dev. Elle était :\n${texteDeLigne(version.valeur, version.libelles)}`;
    case 'absente': return 'Ligne supprimée : elle n’existe plus dans les règles livrées.';
    default: return '(inconnue)';
  }
}

/**
 * Un choix 1 ou 2 qui ne laisse pas sa version entière (`valeur_1`, `valeur_2` du service, lot gardé ou annulé) : un texte dont seuls les passages en
 * conflit sont tranchés, le reste fusionné (réponse du propriétaire du 2026-11-12 : « Les garder (Recommandé) », étendue aux lots annulés par le
 * leader-technique ; serveur/edition-conflits.mjs#completerLeDiagnostic, #examinerUnLotGarde).
 */
const choixFusionne = (c, n) => {
  const valeur = n === 1 ? c.valeur_1 : c.valeur_2;
  return Boolean(valeur) && texteDeLaVersion(valeur) !== texteDeLaVersion(n === 1 ? c.version_1 : c.version_2);
};
/** Le conflit a-t-il un choix 1 ou 2 fusionné (choixFusionne) ? */
const aUnChoixFusionne = (c) => choixFusionne(c, 1) || choixFusionne(c, 2);

/**
 * Le libellé de chaque choix d'un conflit (`n` : 1, 2, 3), selon ce qu'il fait. Un champ gardé : 1 garde la modification du site, 2 prend celle du
 * code ; pour deux textes (des `passages`), seulement sur les passages en conflit, le reste restant fusionné (réponse du propriétaire du 2026-11-12 :
 * « Les garder (Recommandé) » ; le 2 symétrique, décision du leader-technique ; serveur/edition-conflits.mjs#examinerUnLotGarde). Un lot annulé dont
 * un choix est fusionné (aUnChoixFusionne) : la version de ce choix, sur les passages en conflit seulement.
 */
export function libelleDuChoix(conflit, n) {
  if (n === 3) return '3 : saisir à la main ce qui remplace les deux';
  if (conflit.garde) {
    const passages = conflit.passages?.length > 0;
    if (n === 1) return passages ? '1 : garder la modification du site sur les passages en conflit (les autres changements du code restent)' : '1 : garder la modification du site (version 1)';
    return passages ? '2 : prendre la modification du code sur les passages en conflit (les autres modifications du site restent)' : '2 : prendre la modification du code (version 2)';
  }
  if (n === 1) {
    if (conflit.genre === 'suppression') return '1 : la version 1 (supprimer la ligne)';
    return aUnChoixFusionne(conflit) ? '1 : la version 1 sur les passages en conflit (le reste fusionné)' : '1 : la version 1 (le site de dev)';
  }
  if (['ligne_supprimee', 'sans_valeur'].includes(conflit.genre)) return '2 : abandonner cette modification (la valeur actuelle reste)';
  return aUnChoixFusionne(conflit) ? '2 : la version 2 sur les passages en conflit (le reste fusionné)' : '2 : la version 2 (la valeur actuelle reste)';
}

/**
 * Pourquoi un choix est impossible (null s'il est permis). Un refus venu d'un lot plus récent du site de dev (`refus_1_lot`, `refus_2_lot` :
 * { lot, fait_le, resume }) est la phrase du service, sa date lisible ; un refus de l'éditeur (sans lot) est dit comme tel.
 */
export function raisonDuChoix(conflit, n) {
  if ((conflit.choix_possibles ?? []).includes(n)) return null;
  if (n === 1) {
    if (conflit.refus_1) return conflit.refus_1_lot ? avecDateLisible(conflit.refus_1, conflit.refus_1_lot) : `l’édition refuse aujourd’hui cette valeur : ${conflit.refus_1}`;
    if (conflit.genre === 'ligne_supprimee') return 'la ligne n’existe plus dans les règles livrées (la version 1 reste lisible ci-dessus, pour la recopier ailleurs)';
    if (conflit.genre === 'sans_valeur') return 'cette modification ne peut plus s’écrire';
    return 'impossible ici';
  }
  if (n === 2) {
    if (!conflit.refus_2) return 'impossible ici';
    if (conflit.refus_2_lot) return avecDateLisible(conflit.refus_2, conflit.refus_2_lot);
    return conflit.garde ? `l’édition refuse aujourd’hui la modification du code : ${conflit.refus_2}` : `la règle livrée ne se recalcule pas : ${conflit.refus_2}`;
  }
  // une ligne gelée (un mot-clé verrouillé, une monnaie : décisions R218, R219) : la raison du service
  if (conflit.refus_3) return conflit.refus_3;
  if (conflit.colonne && !conflit.saisie) return 'une image ne se saisit pas ici';
  return 'seul un champ se saisit à la main (pas une ligne entière)';
}

/** Les options d'une liste de choix (le champ `saisie`, et les listes de GET /api/edition/listes/) : l'option vide d'un champ non requis, puis les choix. */
export function optionsDeLaSaisie(saisie, listes = {}) {
  const choix = saisie?.choix ?? listes?.[saisie?.liste] ?? [];
  return [...(saisie?.requis ? [] : [{ valeur: '', libelle: saisie?.libelleVide ?? '—' }]), ...choix.map((c) => ({ valeur: String(c.valeur), libelle: String(c.libelle ?? c.valeur) }))];
}

/**
 * La valeur de départ de la saisie du choix 3 : le résultat du choix 1 (`valeur_1`) quand le service le donne (lot gardé : la valeur affichée ; lot
 * annulé : la version 1, ou la fusion côté site d'un texte) ; sinon la version 1, quand c'est une valeur (sinon vide).
 */
const valeurDeDepart = (conflit) => {
  const depart = conflit.valeur_1?.genre === 'valeur' ? conflit.valeur_1 : conflit.version_1;
  const v = depart?.genre === 'valeur' ? depart.valeur : null;
  if (v === null || v === undefined || typeof v === 'object') return Array.isArray(v) ? v.join(', ') : '';
  return String(v);
};

/** L'aide d'une adresse de mot-clé (mot_cle.url, migration 0098 : lib/mots-cles-liens.mjs, que ce module n'importe pas : skill site-version-portable). */
const AIDE_ADRESSE = 'adresse d’une page du site depuis sa racine, « /races/elfe/ », vide : aucune';
/** L'aide d'une couleur de mot-clé (mot_cle.couleur, migration 0098). */
const AIDE_COULEUR = '« #rrggbb », ou « famille:id » d’une couleur du site (« magie:feu »), vide : aucune';
/**
 * La forme d'une adresse et d'une couleur de mot-clé : la même règle que lib/mots-cles-liens.mjs#fauteDeFormeDeLUrl (« / » au début, pas « // », ASCII
 * imprimable sans aucun blanc, ni « \ », ni « " », « ' », « < », « > », « ` ») et #lireLaCouleur, recopiée ici (ce module n'importe que
 * lib/notes-de-version-rendu.mjs : skill site-version-portable) ; test/conflits-rendu.test.mjs compare les deux règles. Le service refait tout.
 */
const FORME_D_ADRESSE = /^\/(?!\/)[!-~]*$/;
const CARACTERES_REFUSES_D_ADRESSE = /["'<>`\\]/;
const FORME_DE_COULEUR = /^(?:#[0-9a-f]{6}|[a-z]+:[a-z0-9]+(?:-[a-z0-9]+)*)$/;

/** La saisie du choix 3, d'après le type de la colonne (comme l'éditeur : src/scripts/edition/editeur.mjs#controleDe). */
export function htmlDeLaSaisie(conflit, id, listes = {}) {
  const s = conflit.saisie;
  const depart = valeurDeDepart(conflit);
  const commun = `id="${id}" data-nv-valeur aria-label="${echapper(`Valeur saisie : ${conflit.colonne_libelle ?? conflit.colonne ?? ''}`)}"`;
  let controle;
  if (s.type === 'texte' || s.type === 'markdown') {
    const lignes = Math.min(16, Math.max(3, depart.split('\n').length + 1));
    controle = `<textarea ${commun} rows="${lignes}">${echapper(depart)}</textarea>`;
  } else if (s.type === 'choix') {
    const options = optionsDeLaSaisie(s, listes);
    if (depart && !options.some((o) => o.valeur === depart)) options.push({ valeur: depart, libelle: depart });
    controle = `<select ${commun}>${options.map((o) => `<option value="${echapper(o.valeur)}"${o.valeur === depart ? ' selected' : ''}>${echapper(o.libelle)}</option>`).join('')}</select>`;
  } else if (s.type === 'entier' || s.type === 'reel') {
    const bornes = `${s.min !== undefined ? ` data-min="${s.min}"` : ''}${s.max !== undefined ? ` data-max="${s.max}"` : ''}`;
    controle = `<input type="text" inputmode="${s.type === 'entier' ? 'numeric' : 'decimal'}" ${commun}${bornes} value="${echapper(depart)}">`;
  } else {
    // ligne, catégories (« id1, id2 »), adresse et couleur d'un mot-clé (migration 0098) : une ligne de texte
    controle = `<input type="text" ${commun} value="${echapper(depart)}">`;
  }
  const aide = [s.requis ? 'obligatoire' : null, s.min !== undefined ? `au moins ${s.min}` : null, s.max !== undefined ? `au plus ${s.max}` : null,
    s.type === 'markdown' ? 'Markdown de la page, comme dans l’éditeur' : null, s.type === 'categories' ? 'identifiants séparés par des virgules' : null,
    s.type === 'adresse' ? AIDE_ADRESSE : null, s.type === 'couleur' ? AIDE_COULEUR : null].filter(Boolean);
  return `<label for="${id}">${echapper(s.libelle ?? conflit.colonne_libelle ?? '')}${aide.length ? ` <span class="nv-conflit__aide">(${echapper(aide.join(', '))})</span>` : ''}</label>${controle}`;
}

/**
 * Les contrôles simples de l'éditeur sur la saisie d'un choix 3 (lib/edition-modele.mjs#valeurDuChamp, que le service refait en entier) : le message
 * d'un refus, ou null. Valeur obligatoire, nombre entier ou décimal, bornes ; une liste de choix fixée ne prend qu'une de ses valeurs.
 */
export function erreurDeSaisie(saisie, brute) {
  const nom = saisie?.libelle ?? 'valeur';
  const texte = String(brute ?? '').trim();
  if (!texte) return saisie?.requis ? `« ${nom} » : valeur obligatoire` : null;
  if (saisie?.type === 'entier' || saisie?.type === 'reel') {
    const n = Number(saisie.type === 'entier' ? texte.replace(/^\+/, '') : texte.replace(',', '.'));
    if (saisie.type === 'entier' ? !Number.isSafeInteger(n) : !Number.isFinite(n)) return `« ${nom} » : ${saisie.type === 'entier' ? 'nombre entier' : 'nombre'} attendu`;
    if (saisie.min !== undefined && n < saisie.min) return `« ${nom} » : au moins ${saisie.min}`;
    if (saisie.max !== undefined && n > saisie.max) return `« ${nom} » : au plus ${saisie.max}`;
  }
  if (saisie?.type === 'choix' && saisie.choix && !saisie.choix.some((c) => String(c.valeur) === texte)) return `« ${nom} » : valeur hors de la liste`;
  if (saisie?.type === 'adresse' && (!FORME_D_ADRESSE.test(texte) || CARACTERES_REFUSES_D_ADRESSE.test(texte))) return `« ${nom} » : ${AIDE_ADRESSE}`;
  if (saisie?.type === 'couleur' && !FORME_DE_COULEUR.test(texte.toLowerCase())) return `« ${nom} » : ${AIDE_COULEUR}`;
  return null;
}

/**
 * D'où vient chaque version (demande du propriétaire du 2026-11-07 : « Il faut aussi clarifié d'où viens la modification de la V1 et de la V2 »), d'après
 * les provenances du service (serveur/edition-conflits.mjs#completerLeDiagnostic, #examinerUnLotGarde), jamais supposée :
 *   - champ gardé (`garde`) : version 1 « modification sur le site » (le lot de `provenance_1`, daté) ; version 2 « modification du code » (les règles
 *     livrées, ou fusionnées avec un lot plus ancien du site : `provenance_2.genre` « regles_et_site ») ;
 *   - lot annulé : version 1 modifiée sur le site de dev (ce lot, daté) ; version 2 la valeur actuelle de la base, venue des règles livrées, d'un lot du
 *     site de dev ou de la résolution d'un conflit (`provenance_2`) ; sans provenance (réponse ancienne), sa source n'est pas dite ; « absente » :
 *     les règles livrées, où la ligne n'existe plus.
 * `faitLe` : l'instant du lot, quand le conflit ne porte pas `provenance_1`.
 */
export function titreDeLaVersion(n, conflit = {}, faitLe = null) {
  const quand = conflit.provenance_1?.fait_le ?? faitLe;
  if (conflit.garde) {
    if (n === 1) return `Version 1 : modification sur le site${quand ? ` (lot du ${instantLisible(quand)})` : ''}`;
    const p = conflit.provenance_2;
    return `Version 2 : modification du code (${p?.genre === 'regles_et_site' ? `règles livrées, fusionnées avec le ${lotLisible(p)} du site de dev` : 'règles livrées'})`;
  }
  if (n === 1) return `Version 1 : modifiée sur le site de dev${quand ? ` (ce lot, du ${instantLisible(quand)})` : ''}`;
  if (conflit.version_2?.genre === 'absente') return 'Version 2 : les règles livrées (la ligne n’y existe plus)';
  const origine = origineDeLaValeur(conflit.provenance_2);
  return `Version 2 : la valeur actuelle${origine ? `, ${origine}` : ''}`;
}

/** Un morceau du diff replié (lib/diff-replie.mjs) : « egal » tel quel, « retire » barré (version 2), « ajoute » en gras (version 1), « replie » fermé. */
function htmlDuMorceau(m) {
  if (m.type === 'egal') return echapper(m.texte);
  if (m.type === 'retire') return `<del>${echapper(m.texte)}</del>`;
  if (m.type === 'ajoute') return `<ins>${echapper(m.texte)}</ins>`;
  const resume = m.lignes > 1 ? `… ${m.lignes} lignes identiques …` : '… passage identique …';
  return `<details class="nv-diff__replie"><summary>${resume}</summary>${echapper(m.texte)}</details>`;
}

/** Les deux versions sont-elles deux textes ? */
const deuxTextes = (c) => c.version_1?.genre === 'valeur' && c.version_2?.genre === 'valeur' && typeof c.version_1.valeur === 'string' && typeof c.version_2.valeur === 'string';

/**
 * Le résultat de chaque choix (`valeur_1` ; `valeur_2`, null si le choix 2 est refusé), en entier, côte à côte ; '' sans ces valeurs (réponse ancienne).
 * Champ gardé : `valeur_1` est la valeur en place, que la page affiche ; lot annulé : la page affiche la version 2 (la valeur actuelle).
 */
function htmlDesResultats(c) {
  if (!c.valeur_1 && !c.valeur_2) return '';
  const resultat = (n, v, titre) => `<div class="nv-version nv-version--${n}" data-nv-resultat="${n}"><h5 class="nv-version__titre">${echapper(titre)}</h5>`
    + `<div class="nv-version__texte">${echapper(v ? texteDeLaVersion(v) : 'Ce choix n’est pas possible ici (sa raison est dite avec les choix).')}</div></div>`;
  return `<div class="nv-conflit__versions nv-conflit__resultats">${resultat(1, c.valeur_1, c.garde ? 'Résultat du choix 1 (affiché sur la page en attendant votre choix)' : 'Résultat du choix 1')}${resultat(2, c.valeur_2, 'Résultat du choix 2')}</div>`;
}

/**
 * Les deux colonnes d'un champ gardé (demande du propriétaire du 2026-11-12 : « à gauche "modification sur site" et à droite "modification du code" ») :
 * pour deux textes, seulement les passages en conflit (`passages` du service, la fusion à trois voies : { base, site, code }), chacun comparé mot à mot
 * (à gauche en gras ce qui n'est que sur le site, à droite barré ce qui n'est que dans le code), le reste replié (lib/diff-replie.mjs) ; un champ court
 * sans passage : les deux textes entiers, comparés de même. Une autre valeur (nombre, liste, deux textes trop longs pour le détail) : les deux versions
 * côte à côte, en entier. Dans un bloc fermé, dès que quelque chose est caché : les deux modifications entières et le résultat de chaque choix
 * (htmlDesResultats ; le reste du texte est fusionné, réponse du propriétaire « Les garder (Recommandé) »).
 */
function htmlDesVersionsGardees(c, faitLe, versions, avant) {
  const v1 = texteDeLaVersion(c.version_1);
  const v2 = texteDeLaVersion(c.version_2);
  const passages = (c.passages ?? []).filter((p) => typeof p?.site === 'string' && typeof p?.code === 'string');
  const resultats = htmlDesResultats(c);
  // les résultats n'apprennent rien de plus quand chaque choix laisse sa modification entière (un champ court)
  const resultatsUtiles = resultats && aUnChoixFusionne(c);
  const bloc = (montrerLesVersions) => (montrerLesVersions || resultatsUtiles
    ? `<details class="nv-conflit__entieres"><summary>${resultatsUtiles ? 'Voir les deux modifications en entier et le résultat de chaque choix' : 'Voir les deux versions en entier'}</summary>${montrerLesVersions ? versions : ''}${resultatsUtiles ? resultats : ''}</details>`
    : '');
  if (!deuxTextes(c) || v1 === v2) return `${versions}${bloc(false)}${avant}`;
  const paires = passages.length ? passages.map((p) => [p.code, p.site]) : [[v2, v1]];
  const diffs = paires.map(([code, site]) => replierLeDiff(diffMots(code, site)));
  if (diffs.some((d) => !d)) return `${versions}${bloc(false)}${avant}`;
  const colonne = (n, cache) => `<div class="nv-version nv-version--${n}"><h5 class="nv-version__titre">${echapper(titreDeLaVersion(n, c, faitLe))}</h5>`
    + `<div class="nv-passages">${diffs.map((d) => `<div class="nv-diff nv-passage">${d.filter((m) => m.type !== cache).map(htmlDuMorceau).join('')}</div>`).join('')}</div></div>`;
  const nombre = passages.length > 1 ? ` (${passages.length})` : '';
  const legende = `<p class="nv-diff__legende">${passages.length ? `Seuls les passages en conflit sont montrés${nombre} ; ` : ''}<ins>en gras</ins> : seulement dans la modification sur le site ; <del>barré</del> : seulement dans la modification du code${passages.length ? ' ; le reste du texte est fusionné, quel que soit le choix (voir ci-dessous)' : ''}.</p>`;
  const cache = passages.length > 0 || diffs.some((d) => d.some((m) => m.type === 'replie'));
  return `<div class="nv-conflit__differences">${legende}<div class="nv-conflit__versions nv-conflit__versions--garde">${colonne(1, 'retire')}${colonne(2, 'ajoute')}</div></div>`
    + `${bloc(cache)}${avant}`;
}

/**
 * Les deux versions. Un champ gardé : htmlDesVersionsGardees. Deux textes qui diffèrent : seulement leurs différences, mot à mot, les passages
 * identiques repliés autour d'un peu de contexte (demande du propriétaire du 2026-11-07 ; lib/diff-replie.mjs), et les deux versions entières dans un
 * bloc fermé. Sinon (une ligne entière, une suppression, un nombre, deux textes trop longs pour le détail) : les deux versions côte à côte, en entier.
 */
function htmlDesVersions(c, faitLe) {
  const v1 = texteDeLaVersion(c.version_1);
  const v2 = texteDeLaVersion(c.version_2);
  const version = (n, texte) => `<div class="nv-version nv-version--${n}"><h5 class="nv-version__titre">${echapper(titreDeLaVersion(n, c, faitLe))}</h5><div class="nv-version__texte">${echapper(texte)}</div></div>`;
  const versions = `<div class="nv-conflit__versions">${version(1, v1)}${version(2, v2)}</div>`;
  const avant = c.avant?.genre === 'valeur' && texteDeValeur(c.avant.valeur) !== v2
    ? `<details class="nv-conflit__avant"><summary>Ce que le site de dev avait sous les yeux avant sa modification</summary><div class="nv-version__texte">${echapper(texteDeValeur(c.avant.valeur))}</div></details>`
    : '';
  if (c.garde) return htmlDesVersionsGardees(c, faitLe, versions, avant);
  // un lot annulé : le diff du texte entier (décision du leader-technique) ; un choix fusionné : le résultat de chaque choix dans le bloc fermé
  const resultats = aUnChoixFusionne(c) ? htmlDesResultats(c) : '';
  const morceaux = deuxTextes(c) && v1 !== v2 ? replierLeDiff(diffMots(v2, v1)) : null;
  if (!morceaux) return `${versions}${resultats ? `<details class="nv-conflit__entieres"><summary>Voir le résultat de chaque choix</summary>${resultats}</details>` : ''}${avant}`;
  const legende = `<p class="nv-diff__legende"><ins>en gras</ins> : seulement dans la version 1 (modifiée sur le site de dev) ; <del>barré</del> : seulement dans la version 2 (la valeur actuelle) ; le reste est identique aux deux${resultats ? ' ; les choix 1 et 2 ne tranchent que les passages en conflit, le reste est fusionné (voir le résultat de chaque choix ci-dessous)' : ''}.</p>`;
  return `<div class="nv-conflit__differences"><h5 class="nv-version__titre">Ce qui diffère entre les deux versions</h5>${legende}<div class="nv-diff">${morceaux.map(htmlDuMorceau).join('')}</div></div>`
    + `<details class="nv-conflit__entieres"><summary>${resultats ? 'Voir les deux versions en entier et le résultat de chaque choix' : 'Voir les deux versions en entier'}</summary>${versions}${resultats}</details>${avant}`;
}

/**
 * Ce que la page affiche en attendant le choix : pour un champ gardé, le résultat du choix 1 (`valeur_1` : la modification du site sur les passages en
 * conflit, le reste fusionné ; réponse du propriétaire du 2026-11-12, « Les garder (Recommandé) », et décision du leader-technique : dès le rejeu,
 * la page affiche la valeur du choix 1), avec la provenance d'une valeur plus récente (`actuelle`) ; pour un lot annulé dont un lot plus récent a
 * changé la valeur (`actuelle`), cette valeur, lisible dans un bloc fermé. Rien pour un lot annulé sans `actuelle` (la version 2 est la valeur actuelle).
 */
function htmlDeLaValeurAffichee(c) {
  const a = c.actuelle && typeof c.actuelle === 'object' ? c.actuelle : null;
  const origine = a ? origineDeLaValeur(a.provenance) : null;
  if (c.garde) {
    const quoi = c.passages?.length ? ' (la modification du site sur les passages en conflit, le reste fusionné)' : '';
    const plusRecente = a ? `, qui comprend une valeur plus récente${origine ? `, ${origine}` : ''}` : '';
    return `<p class="nv-conflit__affichee" data-nv-affichee="1">${echapper(`Aujourd’hui sur la page, en attendant votre choix : le résultat du choix 1${quoi}${plusRecente}.`)}</p>`;
  }
  if (a) {
    return `<div class="nv-conflit__affichee" data-nv-affichee="actuelle"><p>Aujourd’hui sur la page : une valeur plus récente${origine ? `, ${echapper(origine)}` : ''}.</p>`
      + `<details><summary>Voir la valeur affichée</summary><div class="nv-version__texte">${echapper(texteDeLaVersion(a))}</div></details></div>`;
  }
  return '';
}

/** Les lots plus récents du site de dev qui ont écrit ce champ depuis (`lots_suivants` d'un champ gardé). */
function htmlDesLotsSuivants(c) {
  const suivants = c.lots_suivants ?? [];
  if (!suivants.length) return '';
  return `<p class="nv-conflit__suivants" data-nv-suivants>Modifié depuis sur le site de dev : ${suivants.map((l) => echapper(`le ${lotLisible(l)}`)).join(' ; ')}.</p>`;
}

/**
 * Un champ qui attend un lot plus ancien, en conflit sur le même champ (`bloque` : { lot, fait_le, resume, raison }) : le lot à résoudre d'abord, par
 * sa date et son résumé, avec un lien vers lui s'il est sur la page (`ancres` : id du lot → id de son formulaire).
 */
function htmlDuBlocage(b, ancres) {
  if (!b) return '';
  const nom = echapper(`le ${lotLisible(b)}`);
  const ancre = ancres?.get?.(b.lot);
  return `<p class="nv-conflit__bloque" data-nv-bloque>À résoudre d’abord : ${ancre ? `<a href="#${echapper(ancre)}">${nom}</a>` : nom}, plus ancien, touche aussi ce champ et n’est pas résolu.</p>`;
}

/** La raison d'un conflit sous sa légende : le texte lisible du service (`raison_lisible`), sinon la trace (`raison`, réponse ancienne). */
export const raisonDuConflit = (c) => c?.raison_lisible ?? c?.raison ?? null;

/** Les colonnes écrites d'une modification saine partielle : leurs libellés (`colonnes_libelles`), sinon leurs noms (réponse ancienne). */
export const colonnesDeLaSaine = (s) => (s?.colonnes_libelles?.length ? s.colonnes_libelles : s?.colonnes ?? []);

/** Un conflit d'un lot : ses deux versions et ses trois choix (`k` : son rang dans la page, pour les identifiants des champs). */
export function htmlDuConflit(c, k, { listes = {}, faitLe = null, ancres = null } = {}) {
  const nom = `nv-conflit-${k}`;
  const titre = `${c.libelle}${c.colonne_libelle ? ` — ${c.colonne_libelle}` : ''}`;
  const choix = [1, 2, 3].map((n) => {
    const raison = raisonDuChoix(c, n);
    const id = `${nom}-choix-${n}`;
    return `<li class="nv-choix${raison ? ' nv-choix--impossible' : ''}"><input type="radio" id="${id}" name="${nom}" value="${n}" data-nv-choix${raison ? ' disabled' : ''}>`
      + ` <label for="${id}">${echapper(libelleDuChoix(c, n))}</label>${raison ? ` <span class="nv-choix__raison">(${echapper(raison)})</span>` : ''}</li>`;
  }).join('');
  const saisie = c.saisie && (c.choix_possibles ?? []).includes(3) ? `<div class="nv-conflit__saisie" data-nv-saisie hidden>${htmlDeLaSaisie(c, `${nom}-valeur`, listes)}</div>` : '';
  return `<fieldset class="nv-conflit${c.garde ? ' nv-conflit--garde' : ''}" data-nv-conflit="${echapper(c.id)}" data-nv-nom="${nom}">
    <legend>${echapper(titre)} <span class="nv-conflit__operation">${echapper(OPERATIONS[c.operation] ?? c.operation ?? '')}</span></legend>
    ${raisonDuConflit(c) ? `<p class="nv-conflit__raison">${echapper(raisonDuConflit(c))}</p>` : ''}
    ${htmlDeLaValeurAffichee(c)}
    ${htmlDesVersions(c, faitLe)}
    ${htmlDesLotsSuivants(c)}
    ${htmlDuBlocage(c.bloque, ancres)}
    <ul class="nv-choix-liste">${choix}</ul>${saisie}
    <p class="nv-message nv-message--erreur" data-nv-erreur hidden></p>
  </fieldset>`;
}

/** Ce que devient une modification saine, en texte, et les colonnes que le rejeu a fusionnées sans conflit (`fusionnees_libelles`). */
function htmlDeLaSaine(s) {
  const colonnes = colonnesDeLaSaine(s);
  const fusion = s.fusionnees_libelles?.length ? ` <span class="nv-conflit__fusion" data-nv-fusion>(fusionné automatiquement : ${echapper(s.fusionnees_libelles.join(', '))})</span>` : '';
  return `<li>${echapper(s.libelle)}${colonnes.length ? ` (${echapper(colonnes.join(', '))})` : ''} <span class="nv-conflit__operation">${echapper(OPERATIONS[s.operation] ?? s.operation)}</span> : ${echapper(issueDeLaSaine(s))}${fusion}</li>`;
}

/** Les lots plus anciens qu'un lot attend (un par lot, dans l'ordre de ses conflits) : les `bloque` de ses conflits. */
const blocagesDuLot = (lot) => [...new Map((lot.conflits ?? []).filter((c) => c.bloque).map((c) => [c.bloque.lot, c.bloque])).values()];

/**
 * Un lot en conflit : en-tête, modifications saines, conflits, envoi (`debut` : le rang du premier conflit dans la page ; `ancres` : id d'un lot → id
 * de son formulaire, pour les liens vers un lot à résoudre d'abord). Un lot qui attend un lot plus ancien (`bloque`) : « Résoudre ce lot » grisé, la
 * raison dite à côté (le service refuserait : 409 `details.bloque`).
 */
export function htmlDuLot(lot, { listes = {}, debut = 0, ancres = null } = {}) {
  const n = lot.conflits?.length ?? 0;
  // sans conflit à trancher (ses règles en conflit suivent leur don : serveur/edition-conflits.mjs#suiventLeDon), ses modifications se montrent dépliées
  const saines = lot.saines?.length
    ? `<details class="nv-conflit-lot__saines"${n ? '' : ' open'}><summary>${lot.saines.length} modification${lot.saines.length > 1 ? 's' : ''} saine${lot.saines.length > 1 ? 's' : ''} de ce lot (sans conflit)</summary><ul>${lot.saines.map(htmlDeLaSaine).join('')}</ul></details>`
    : '<p class="nv-conflit-lot__saines">Aucune modification saine dans ce lot : seulement les conflits ci-dessous.</p>';
  const suivent = (lot.saines ?? []).some((s) => s.issue === 'suit_le_don');
  let consigne;
  if (lot.garde) {
    consigne = `${n} conflit${n > 1 ? 's' : ''} : choisissez pour chacun 1 (garder la modification du site), 2 (prendre la modification du code) ou 3 (saisir à la main) ; hors des passages en conflit, les deux modifications restent fusionnées. Le lot reste en attente, entier, tant qu’un choix manque ; une fois résolu, il partira avec la prochaine mise à jour, avec vos choix.`;
  } else if (n) {
    consigne = `${n} conflit${n > 1 ? 's' : ''} : choisissez pour chacun. Le lot reste en attente, entier, tant qu’un choix manque ; une fois résolu, ses modifications saines et vos choix 1 et 3 forment une nouvelle modification du site de dev (elle partira avec la prochaine mise à jour) ; le choix 2 laisse la valeur actuelle${(lot.conflits ?? []).some(aUnChoixFusionne) ? ', sauf sur un texte dont le choix 2 est fusionné : il y prend la version 2 sur les passages en conflit, le reste fusionné' : ''}.`;
  } else {
    consigne = `Aucun choix à faire${suivent ? ' : chaque règle en conflit suit son don, que ce lot supprime aussi' : ''}. Le lot reste en attente tant qu’il n’est pas résolu ; « Résoudre ce lot » fait de ses modifications une nouvelle modification du site de dev (elle partira avec la prochaine mise à jour).`;
  }
  const garde = lot.garde
    ? '<p class="nv-conflit-lot__garde">Les règles livrées ont changé les mêmes passages autrement, sans fusion automatique possible : en attendant votre choix, la page garde la modification du site sur ces passages, le reste fusionné.</p>'
    : '';
  const blocages = blocagesDuLot(lot);
  const bloque = Boolean(lot.bloque) || blocages.length > 0;
  const nomDuLot = (b) => {
    const nom = echapper(`le ${lotLisible(b)}`);
    const ancre = ancres?.get?.(b.lot);
    return ancre ? `<a href="#${echapper(ancre)}">${nom}</a>` : nom;
  };
  const attente = bloque
    ? `<p class="nv-conflit-lot__bloque" data-nv-lot-bloque>Ce lot ne peut pas encore être résolu : ${blocages.length ? `résolvez d’abord ${blocages.map(nomDuLot).join(' et ')}, plus ancien${blocages.length > 1 ? 's' : ''}, qui touche${blocages.length > 1 ? 'nt' : ''} les mêmes champs` : 'un lot plus ancien touche les mêmes champs'}.</p>`
    : '';
  const ancre = ancres?.get?.(lot.lot);
  return `<form class="nv-conflit-lot${lot.garde ? ' nv-conflit-lot--garde' : ''}"${ancre ? ` id="${echapper(ancre)}"` : ''} data-nv-lot="${echapper(lot.lot)}" data-nv-empreinte="${echapper(lot.empreinte)}"${bloque ? ' data-nv-bloque' : ''}>
    <h4 class="nv-conflit-lot__titre">Lot du ${echapper(instantLisible(lot.fait_le))} : ${echapper(lot.resume || lot.lot)}</h4>
    ${garde}
    ${lot.detail_lisible ? `<p class="nv-conflit-lot__detail">Au rejeu : ${echapper(lot.detail_lisible)}</p>` : ''}
    ${saines}
    <p class="nv-conflit-lot__consigne">${echapper(consigne)}</p>
    ${(lot.conflits ?? []).map((c, i) => htmlDuConflit(c, debut + i, { listes, faitLe: lot.fait_le, ancres })).join('')}
    <p class="nv-message" data-nv-lot-message aria-live="polite" hidden></p>
    ${attente}
    <div class="nv-dev__actions"><button type="submit" class="nv-principal"${bloque ? ' disabled' : ''}>Résoudre ce lot</button></div>
  </form>`;
}

/** Ce que dit un lot résolu. */
const htmlDuResolu = (r) => `<li>Lot du ${echapper(instantLisible(r.fait_le))} (${echapper(r.resume || r.lot)}) : résolu le ${echapper(instantLisible(r.resolu_le))}, ${r.resolu_par
  ? `par une nouvelle modification (lot <code>${echapper(r.resolu_par)}</code>)` : 'sans rien écrire (tout au choix 2 : la valeur actuelle reste)'}.</li>`;

/**
 * Les lots retenus (`retenus` : [{ lot, fait_le, resume, derriere }]) : des modifications du site de dev qui suivent un lot gardé sur l'un de ses champs
 * et ne partiront qu'après sa résolution ; chacune dit le lot qu'elle attend (par sa date et son résumé, lien vers son formulaire).
 */
function htmlDesRetenus(retenus, lots, ancres) {
  if (!retenus?.length) return '';
  const parId = new Map(lots.map((l) => [l.lot, l]));
  const items = retenus.map((r) => {
    const devant = parId.get(r.derriere);
    const ancre = ancres.get(r.derriere);
    const nom = devant ? echapper(`le ${lotLisible(devant)}`) : 'un lot en conflit';
    const soi = lotLisible(r);
    return `<li>${echapper(`${soi[0].toUpperCase()}${soi.slice(1)}`)} : attend ${ancre ? `<a href="#${echapper(ancre)}">${nom}</a>` : nom}.</li>`;
  }).join('');
  const n = retenus.length;
  return `<details class="nv-conflits__retenus" data-nv-retenus open><summary>${n} modification${n > 1 ? 's' : ''} du site de dev en attente derrière un conflit</summary>`
    + `<p>${n > 1 ? 'Elles suivent' : 'Elle suit'} un lot en conflit sur un même champ : ${n > 1 ? 'elles ne partiront' : 'elle ne partira'} qu’après sa résolution.</p><ul>${items}</ul></details>`;
}

/**
 * La section des lignes en conflit (réponse de GET /api/mise-a-jour/conflits/ : { lots, resolus, retenus }) ; vide sans lot à résoudre, lot résolu ni
 * lot retenu.
 */
export function htmlDesConflits({ lots = [], resolus = [], retenus = [] } = {}, { listes = {}, niveau = 3 } = {}) {
  if (!lots.length && !resolus.length && !retenus?.length) return '';
  const ancres = new Map(lots.map((l, i) => [l.lot, `nv-lot-${i + 1}`]));
  let debut = 0;
  const formulaires = lots.map((l) => {
    const h = htmlDuLot(l, { listes, debut, ancres });
    debut += l.conflits?.length ?? 0;
    return h;
  }).join('');
  const gardes = lots.filter((l) => l.garde).length;
  const annules = lots.length - gardes;
  const sortes = [
    gardes ? `Pour une modification du site gardée, la version 1, à gauche, est la modification sur le site ; la version 2, à droite, la modification du code ; pour un long texte, seuls les passages en conflit sont montrés, le reste étant fusionné ; la page affiche le résultat du choix 1 en attendant votre choix.` : null,
    annules ? `${gardes ? 'Pour un lot annulé, la' : 'Pour chaque conflit, la'} version 1 est la modification faite sur le site de dev (le lot daté ci-dessous) ; la version 2 est la valeur actuelle, dont le titre dit d’où elle vient ; pour un long texte, seules les différences sont montrées.` : null,
  ].filter(Boolean).join(' ');
  const intro = lots.length
    ? `<p>${lots.length} lot${lots.length > 1 ? 's' : ''} du site de dev ${lots.length > 1 ? 'sont' : 'est'} en conflit avec les règles livrées depuis : ${lots.length > 1 ? 'ils ne partent' : 'il ne part'} pas avec cette mise à jour. ${sortes}</p>`
    : '<p>Aucun lot en conflit à résoudre.</p>';
  const anciens = resolus.length ? `<details class="nv-conflits__resolus"><summary>Lots en conflit déjà résolus (${resolus.length})</summary><ul>${resolus.map(htmlDuResolu).join('')}</ul></details>` : '';
  return `<h${niveau} class="nv-conflits__titre">Lignes en conflit</h${niveau}>${intro}${formulaires}${htmlDesRetenus(retenus, lots, ancres)}${anciens}`;
}

/**
 * Le corps de POST /api/mise-a-jour/conflits/ pour `lot` (le diagnostic reçu), d'après les choix faits (`choisis` : id du conflit → { choix, valeur })
 * → { corps } ; ou { manquants: [libellés] } s'il manque un choix ; ou { erreurs: Map id → message } si une saisie est refusée.
 */
export function corpsDeLaResolution(lot, choisis) {
  const manquants = [];
  const erreurs = new Map();
  const choix = {};
  for (const c of lot.conflits ?? []) {
    const r = choisis?.get?.(c.id) ?? choisis?.[c.id];
    const n = Number(r?.choix);
    if (!(c.choix_possibles ?? []).includes(n)) {
      manquants.push(`${c.libelle}${c.colonne_libelle ? ` — ${c.colonne_libelle}` : ''}`);
      continue;
    }
    if (n === 3) {
      const e = erreurDeSaisie(c.saisie, r.valeur);
      if (e) erreurs.set(c.id, e);
      choix[c.id] = { choix: 3, valeur: r.valeur ?? '' };
    } else choix[c.id] = { choix: n };
  }
  if (manquants.length) return { manquants };
  if (erreurs.size) return { erreurs };
  return { corps: { lot: lot.lot, empreinte: lot.empreinte, choix } };
}

/**
 * Le message après une résolution réussie (réponse du POST). Un lot gardé (`reprise` : sa reprise, un lot normal qui note ce que le rejeu a écrit) :
 * la modification du site repart, et les choix 2 et 3, s'il y en a, forment une nouvelle modification.
 */
export function messageDeResolution(r) {
  const fiches = r.fiches?.length ? ` ${r.fiches.length} fiche${r.fiches.length > 1 ? 's' : ''} de personnage adaptée${r.fiches.length > 1 ? 's' : ''} (un élément supprimé ${r.fiches.length > 1 ? 'leur' : 'lui'} est retiré).` : '';
  if (r.reprise) {
    const lignes = `${r.modifications} ligne${r.modifications > 1 ? 's' : ''}`;
    return `Conflit résolu : la modification du site est reprise${r.nouveau_lot ? `, et vos choix 2 et 3 forment une nouvelle modification du site de dev (lot ${r.nouveau_lot})` : ''} (${lignes}). Elle partira avec la prochaine mise à jour.${fiches}`;
  }
  if (!r.nouveau_lot) return `Conflit résolu : rien n’a été écrit (tout au choix 2), la valeur actuelle reste.${fiches}`;
  return `Conflit résolu : une nouvelle modification du site de dev a été enregistrée (${r.modifications} ligne${r.modifications > 1 ? 's' : ''} ; lot ${r.nouveau_lot}). Elle partira avec la prochaine mise à jour.${fiches}`;
}
