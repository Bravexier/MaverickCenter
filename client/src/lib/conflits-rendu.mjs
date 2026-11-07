// Les lignes du journal en conflit sur la page « Mise à jour » du site de dev (demande du propriétaire du 2026-10-22 : « Après les listes de
// modifications, montrer les lignes en conflits. 1. Pour chaque conflit, montrer les deux versions 2. Laisser le choix entre 1, 2, ou 3 pour saisir à
// la main ce qui remplace les deux. »). Le service examine chaque lot en conflit (GET /api/mise-a-jour/conflits/, serveur/edition-conflits.mjs) ; ce
// module en fait le HTML et le corps de la résolution (POST), le script de la page (src/scripts/mise-a-jour.mjs) le pose et l'envoie.
//   - rien de technique : le service fournit les textes, la page les affiche (elle n'importe pas lib/edition-modele.mjs#TABLES) ; la légende d'une
//     ligne (`libelle`, sans JSON même pour une clé composée), la raison d'un conflit (`raison_lisible`, repli sur `raison` pour une réponse
//     ancienne), les colonnes d'une saine partielle (`colonnes_libelles`, repli sur `colonnes`), les colonnes d'une ligne entière (`libelles` de la
//     version : seules les colonnes qu'il nomme, par leur vrai nom ; leur nom technique pour une réponse ancienne sans `libelles`) ; aucune valeur
//     n'est montrée en JSON, aucun nom de table ni de colonne n'est écrit ici (demande du propriétaire du 2026-10-23 : « Un vrai nom serai mieux ») ;
//   - un lot : sa date, son résumé, la raison du rejeu (`detail_lisible` du service, lue comme la légende de ses conflits ; jamais `detail`, la
//     trace des lignes du lot, avec son id, sa clé JSON et ses noms de colonnes) ; ses modifications saines (elles repartent telles quelles dans
//     le nouveau lot) ; puis chaque conflit : la version 1 (modifiée sur le site de dev, par ce lot) et la version 2 (la valeur actuelle, venue de
//     la dernière livraison : titreDeLaVersion), ou « ligne supprimée » ; deux textes : seulement leurs différences mot à mot
//     (lib/notes-de-version-rendu.mjs#diffMots), les passages identiques repliés (lib/diff-replie.mjs ; demande du propriétaire du 2026-11-07), les
//     deux versions entières dans un bloc fermé ; sinon les deux versions côte à côte, en texte (retours à la ligne gardés) ; et le choix 1, 2 ou 3 ; un choix impossible est grisé, avec
//     sa raison ; le 3 ouvre une saisie qui suit le type de la colonne (le champ de lib/edition-modele.mjs#TABLES que le service rend : `saisie`) ;
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

/** Le libellé de chaque choix d'un conflit (`n` : 1, 2, 3), selon ce qu'il fait. */
export function libelleDuChoix(conflit, n) {
  if (n === 3) return '3 : saisir à la main ce qui remplace les deux';
  if (n === 1) return conflit.genre === 'suppression' ? '1 : la version 1 (supprimer la ligne)' : '1 : la version 1 (le site de dev)';
  if (['ligne_supprimee', 'sans_valeur'].includes(conflit.genre)) return '2 : abandonner cette modification (la règle livrée reste)';
  return '2 : la version 2 (la règle livrée reste)';
}

/** Pourquoi un choix est impossible (null s'il est permis). */
export function raisonDuChoix(conflit, n) {
  if ((conflit.choix_possibles ?? []).includes(n)) return null;
  if (n === 1) {
    if (conflit.refus_1) return `l’édition refuse aujourd’hui cette valeur : ${conflit.refus_1}`;
    if (conflit.genre === 'ligne_supprimee') return 'la ligne n’existe plus dans les règles livrées (la version 1 reste lisible ci-dessus, pour la recopier ailleurs)';
    if (conflit.genre === 'sans_valeur') return 'cette modification ne peut plus s’écrire';
    return 'impossible ici';
  }
  if (n === 2) return conflit.refus_2 ? `la règle livrée ne se recalcule pas : ${conflit.refus_2}` : 'impossible ici';
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

/** La valeur de départ de la saisie du choix 3 : la version 1 quand c'est une valeur (sinon vide). */
const valeurDeDepart = (conflit) => {
  const v = conflit.version_1?.genre === 'valeur' ? conflit.version_1.valeur : null;
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
 * D'où vient chaque version (demande du propriétaire du 2026-11-07 : « Il faut aussi clarifié d'où viens la modification de la V1 et de la V2 ») :
 * la version 1 est la valeur que le lot du journal du site de dev avait écrite ; la version 2 est la valeur de la base vivante d'aujourd'hui
 * (serveur/edition-conflits.mjs#examinerLeLot : les règles de la dernière livraison du site, plus les autres modifications du site de dev qui sont
 * passées au rejeu), ou « ligne supprimée ». `faitLe` : l'instant du lot, quand on le connaît.
 */
export function titreDeLaVersion(n, faitLe) {
  if (n === 1) return `Version 1 : modifiée sur le site de dev${faitLe ? ` (ce lot, du ${instantLisible(faitLe)})` : ''}`;
  return 'Version 2 : la valeur actuelle, venue de la dernière livraison du site (règles livrées)';
}

/** Un morceau du diff replié (lib/diff-replie.mjs) : « egal » tel quel, « retire » barré (version 2), « ajoute » en gras (version 1), « replie » fermé. */
function htmlDuMorceau(m) {
  if (m.type === 'egal') return echapper(m.texte);
  if (m.type === 'retire') return `<del>${echapper(m.texte)}</del>`;
  if (m.type === 'ajoute') return `<ins>${echapper(m.texte)}</ins>`;
  const resume = m.lignes > 1 ? `… ${m.lignes} lignes identiques …` : '… passage identique …';
  return `<details class="nv-diff__replie"><summary>${resume}</summary>${echapper(m.texte)}</details>`;
}

/**
 * Les deux versions. Deux textes qui diffèrent : seulement leurs différences, mot à mot, les passages identiques repliés autour d'un peu de contexte
 * (demande du propriétaire du 2026-11-07 ; lib/diff-replie.mjs), et les deux versions entières dans un bloc fermé. Sinon (une ligne entière, une
 * suppression, un nombre, deux textes trop longs pour le détail) : les deux versions côte à côte, en entier.
 */
function htmlDesVersions(c, faitLe) {
  const v1 = texteDeLaVersion(c.version_1);
  const v2 = texteDeLaVersion(c.version_2);
  const version = (n, texte) => `<div class="nv-version nv-version--${n}"><h5 class="nv-version__titre">${echapper(titreDeLaVersion(n, faitLe))}</h5><div class="nv-version__texte">${echapper(texte)}</div></div>`;
  const versions = `<div class="nv-conflit__versions">${version(1, v1)}${version(2, v2)}</div>`;
  const textes = c.version_1?.genre === 'valeur' && c.version_2?.genre === 'valeur' && typeof c.version_1.valeur === 'string' && typeof c.version_2.valeur === 'string';
  const morceaux = textes && v1 !== v2 ? replierLeDiff(diffMots(v2, v1)) : null;
  const avant = c.avant?.genre === 'valeur' && texteDeValeur(c.avant.valeur) !== v2
    ? `<details class="nv-conflit__avant"><summary>Ce que le site de dev avait sous les yeux avant sa modification</summary><div class="nv-version__texte">${echapper(texteDeValeur(c.avant.valeur))}</div></details>`
    : '';
  if (!morceaux) return `${versions}${avant}`;
  const legende = `<p class="nv-diff__legende"><ins>en gras</ins> : seulement dans la version 1 (modifiée sur le site de dev) ; <del>barré</del> : seulement dans la version 2 (la valeur actuelle, venue de la dernière livraison) ; le reste est identique aux deux.</p>`;
  return `<div class="nv-conflit__differences"><h5 class="nv-version__titre">Ce qui diffère entre les deux versions</h5>${legende}<div class="nv-diff">${morceaux.map(htmlDuMorceau).join('')}</div></div>`
    + `<details class="nv-conflit__entieres"><summary>Voir les deux versions en entier</summary>${versions}</details>${avant}`;
}

/** La raison d'un conflit sous sa légende : le texte lisible du service (`raison_lisible`), sinon la trace (`raison`, réponse ancienne). */
export const raisonDuConflit = (c) => c?.raison_lisible ?? c?.raison ?? null;

/** Les colonnes écrites d'une modification saine partielle : leurs libellés (`colonnes_libelles`), sinon leurs noms (réponse ancienne). */
export const colonnesDeLaSaine = (s) => (s?.colonnes_libelles?.length ? s.colonnes_libelles : s?.colonnes ?? []);

/** Un conflit d'un lot : ses deux versions et ses trois choix (`k` : son rang dans la page, pour les identifiants des champs). */
export function htmlDuConflit(c, k, { listes = {}, faitLe = null } = {}) {
  const nom = `nv-conflit-${k}`;
  const titre = `${c.libelle}${c.colonne_libelle ? ` — ${c.colonne_libelle}` : ''}`;
  const choix = [1, 2, 3].map((n) => {
    const raison = raisonDuChoix(c, n);
    const id = `${nom}-choix-${n}`;
    return `<li class="nv-choix${raison ? ' nv-choix--impossible' : ''}"><input type="radio" id="${id}" name="${nom}" value="${n}" data-nv-choix${raison ? ' disabled' : ''}>`
      + ` <label for="${id}">${echapper(libelleDuChoix(c, n))}</label>${raison ? ` <span class="nv-choix__raison">(${echapper(raison)})</span>` : ''}</li>`;
  }).join('');
  const saisie = c.saisie && (c.choix_possibles ?? []).includes(3) ? `<div class="nv-conflit__saisie" data-nv-saisie hidden>${htmlDeLaSaisie(c, `${nom}-valeur`, listes)}</div>` : '';
  return `<fieldset class="nv-conflit" data-nv-conflit="${echapper(c.id)}" data-nv-nom="${nom}">
    <legend>${echapper(titre)} <span class="nv-conflit__operation">${echapper(OPERATIONS[c.operation] ?? c.operation ?? '')}</span></legend>
    ${raisonDuConflit(c) ? `<p class="nv-conflit__raison">${echapper(raisonDuConflit(c))}</p>` : ''}
    ${htmlDesVersions(c, faitLe)}
    <ul class="nv-choix-liste">${choix}</ul>${saisie}
    <p class="nv-message nv-message--erreur" data-nv-erreur hidden></p>
  </fieldset>`;
}

/** Un lot en conflit : en-tête, modifications saines, conflits, envoi (`debut` : le rang du premier conflit dans la page). */
export function htmlDuLot(lot, { listes = {}, debut = 0 } = {}) {
  const n = lot.conflits?.length ?? 0;
  // sans conflit à trancher (ses règles en conflit suivent leur don : serveur/edition-conflits.mjs#suiventLeDon), ses modifications se montrent dépliées
  const saines = lot.saines?.length
    ? `<details class="nv-conflit-lot__saines"${n ? '' : ' open'}><summary>${lot.saines.length} modification${lot.saines.length > 1 ? 's' : ''} saine${lot.saines.length > 1 ? 's' : ''} de ce lot (sans conflit)</summary><ul>${lot.saines
      .map((s) => `<li>${echapper(s.libelle)}${colonnesDeLaSaine(s).length ? ` (${echapper(colonnesDeLaSaine(s).join(', '))})` : ''} <span class="nv-conflit__operation">${echapper(OPERATIONS[s.operation] ?? s.operation)}</span> : ${echapper(issueDeLaSaine(s))}</li>`).join('')}</ul></details>`
    : '<p class="nv-conflit-lot__saines">Aucune modification saine dans ce lot : seulement les conflits ci-dessous.</p>';
  const suivent = (lot.saines ?? []).some((s) => s.issue === 'suit_le_don');
  const consigne = n
    ? `${n} conflit${n > 1 ? 's' : ''} : choisissez pour chacun. Le lot reste en attente, entier, tant qu’un choix manque ; une fois résolu, ses modifications saines et vos choix 1 et 3 forment une nouvelle modification du site de dev (elle partira avec la prochaine mise à jour) ; le choix 2 laisse la règle livrée.`
    : `Aucun choix à faire${suivent ? ' : chaque règle en conflit suit son don, que ce lot supprime aussi' : ''}. Le lot reste en attente tant qu’il n’est pas résolu ; « Résoudre ce lot » fait de ses modifications une nouvelle modification du site de dev (elle partira avec la prochaine mise à jour).`;
  return `<form class="nv-conflit-lot" data-nv-lot="${echapper(lot.lot)}" data-nv-empreinte="${echapper(lot.empreinte)}">
    <h4 class="nv-conflit-lot__titre">Lot du ${echapper(instantLisible(lot.fait_le))} : ${echapper(lot.resume ?? lot.lot)}</h4>
    ${lot.detail_lisible ? `<p class="nv-conflit-lot__detail">Au rejeu : ${echapper(lot.detail_lisible)}</p>` : ''}
    ${saines}
    <p class="nv-conflit-lot__consigne">${echapper(consigne)}</p>
    ${(lot.conflits ?? []).map((c, i) => htmlDuConflit(c, debut + i, { listes, faitLe: lot.fait_le })).join('')}
    <p class="nv-message" data-nv-lot-message aria-live="polite" hidden></p>
    <div class="nv-dev__actions"><button type="submit" class="nv-principal">Résoudre ce lot</button></div>
  </form>`;
}

/** Ce que dit un lot résolu. */
const htmlDuResolu = (r) => `<li>Lot du ${echapper(instantLisible(r.fait_le))} (${echapper(r.resume ?? r.lot)}) : résolu le ${echapper(instantLisible(r.resolu_le))}, ${r.resolu_par
  ? `par une nouvelle modification (lot <code>${echapper(r.resolu_par)}</code>)` : 'sans rien écrire (tout au choix 2 : les règles livrées restent)'}.</li>`;

/** La section des lignes en conflit (réponse de GET /api/mise-a-jour/conflits/ : { lots, resolus }) ; vide sans lot à résoudre ni lot résolu. */
export function htmlDesConflits({ lots = [], resolus = [] } = {}, { listes = {}, niveau = 3 } = {}) {
  if (!lots.length && !resolus.length) return '';
  let debut = 0;
  const formulaires = lots.map((l) => {
    const h = htmlDuLot(l, { listes, debut });
    debut += l.conflits?.length ?? 0;
    return h;
  }).join('');
  const intro = lots.length
    ? `<p>${lots.length} lot${lots.length > 1 ? 's' : ''} du site de dev ${lots.length > 1 ? 'sont' : 'est'} en conflit avec les règles livrées depuis : ${lots.length > 1 ? 'ils ne partent' : 'il ne part'} pas avec cette mise à jour. Pour chaque conflit, la version 1 est la modification faite sur le site de dev (le lot daté ci-dessous) ; la version 2 est la valeur actuelle, venue de la dernière livraison du site (les règles livrées, avec les autres modifications du site de dev qui sont passées). Pour un long texte, seules les différences sont montrées.</p>`
    : '<p>Aucun lot en conflit à résoudre.</p>';
  const anciens = resolus.length ? `<details class="nv-conflits__resolus"><summary>Lots en conflit déjà résolus (${resolus.length})</summary><ul>${resolus.map(htmlDuResolu).join('')}</ul></details>` : '';
  return `<h${niveau} class="nv-conflits__titre">Lignes en conflit</h${niveau}>${intro}${formulaires}${anciens}`;
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

/** Le message après une résolution réussie (réponse du POST). */
export function messageDeResolution(r) {
  const fiches = r.fiches?.length ? ` ${r.fiches.length} fiche${r.fiches.length > 1 ? 's' : ''} de personnage adaptée${r.fiches.length > 1 ? 's' : ''} (un élément supprimé ${r.fiches.length > 1 ? 'leur' : 'lui'} est retiré).` : '';
  if (!r.nouveau_lot) return `Conflit résolu : rien n’a été écrit (tout au choix 2), les règles livrées restent.${fiches}`;
  return `Conflit résolu : une nouvelle modification du site de dev a été enregistrée (${r.modifications} ligne${r.modifications > 1 ? 's' : ''} ; lot ${r.nouveau_lot}). Elle partira avec la prochaine mise à jour.${fiches}`;
}
