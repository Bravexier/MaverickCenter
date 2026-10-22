// Les lignes du journal en conflit sur la page « Mise à jour » du site de dev (demande du propriétaire du 2026-10-22 : « Après les listes de
// modifications, montrer les lignes en conflits. 1. Pour chaque conflit, montrer les deux versions 2. Laisser le choix entre 1, 2, ou 3 pour saisir à
// la main ce qui remplace les deux. »). Le service examine chaque lot en conflit (GET /api/mise-a-jour/conflits/, serveur/edition-conflits.mjs) ; ce
// module en fait le HTML et le corps de la résolution (POST), le script de la page (src/scripts/mise-a-jour.mjs) le pose et l'envoie.
//   - un lot : sa date, son résumé, la raison du rejeu (`detail_lisible` du service, lue comme la légende de ses conflits ; jamais `detail`, la
//     trace des lignes du lot, avec son id, sa clé JSON et ses noms de colonnes) ; ses modifications saines (elles repartent telles quelles dans
//     le nouveau lot) ; puis chaque conflit : la version 1 (ce que le site de dev avait écrit) et la version 2 (ce que disent les règles livrées,
//     ou « ligne supprimée ») côte à côte, en texte (un long texte se lit en entier, ses retours à la ligne gardés), leurs différences
//     mot à mot quand ce sont deux textes (lib/notes-de-version-rendu.mjs#diffMots), et le choix 1, 2 ou 3 ; un choix impossible est grisé, avec
//     sa raison ; le 3 ouvre une saisie qui suit le type de la colonne (le champ de lib/edition-modele.mjs#TABLES que le service rend : `saisie`) ;
//   - l'aperçu HTML d'une page modifiée (`apercu`) n'est pas montré : le Markdown de la version 1 se lit tel quel, et aucun HTML reçu n'est posé ;
//   - le corps de la résolution : { lot, empreinte, choix: { "<id>": { choix, valeur? } } } ; la saisie du 3 passe d'abord les contrôles simples de
//     l'éditeur (valeur obligatoire, nombre, bornes : erreurDeSaisie, comme lib/edition-modele.mjs#valeurDuChamp), le service refait tous les siens.
// Fonctions pures (chaîne HTML en sortie, tout texte échappé), sans dépendance hors lib/notes-de-version-rendu.mjs (pur, sans import) : le script
// de la page Mise à jour est le seul à les importer (skill site-version-portable : jamais lib/edition-modele.mjs, que la chaîne de l'édition importe).
import { diffMots, echapper } from './notes-de-version-rendu.mjs';

/** Ce que devient une modification saine du lot (issue rendue par le service). */
export const ISSUES_SAINES = Object.freeze({
  reappliquee: 'repartira telle quelle',
  deja_la: 'déjà dans les règles livrées',
  derivee: 'recalculée d’après sa source',
  sans_effet: 'sans effet aujourd’hui',
});

const OPERATIONS = Object.freeze({ modifier: 'modification', inserer: 'création', supprimer: 'suppression' });

const INSTANT = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' });
/** « 22 octobre 2026 à 21:34 » d'un instant ISO 8601 ; l'instant tel quel s'il ne se lit pas. */
export function instantLisible(iso) {
  const d = new Date(iso ?? '');
  return Number.isNaN(d.getTime()) ? String(iso ?? '') : INSTANT.format(d);
}

/** Une valeur d'un champ, en texte : vide → « (vide) » ; image → son résumé ; liste → « a, b » ; objet → JSON. */
export function texteDeValeur(v) {
  if (v === null || v === undefined || v === '') return '(vide)';
  if (Array.isArray(v)) return v.length ? v.map(String).join(', ') : '(vide)';
  if (typeof v === 'object') return v.image ? `image ${v.resume ?? v.empreinte ?? ''}`.trim() : JSON.stringify(v);
  return String(v);
}

/** Une ligne entière, en texte : « colonne : valeur » par colonne (les vides omises). */
const texteDeLigne = (ligne) =>
  Object.entries(ligne ?? {}).filter(([, v]) => v !== null && v !== undefined && v !== '').map(([c, v]) => `${c} : ${texteDeValeur(v)}`).join('\n') || '(vide)';

/** Une version d'un conflit ({ genre, valeur } du service), en texte. */
export function texteDeLaVersion(version) {
  switch (version?.genre) {
    case 'valeur': return texteDeValeur(version.valeur);
    case 'ligne':
    case 'valeurs': return texteDeLigne(version.valeur);
    case 'suppression': return `Ligne supprimée par le site de dev. Elle était :\n${texteDeLigne(version.valeur)}`;
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
    // ligne, catégories (« id1, id2 ») : une ligne de texte
    controle = `<input type="text" ${commun} value="${echapper(depart)}">`;
  }
  const aide = [s.requis ? 'obligatoire' : null, s.min !== undefined ? `au moins ${s.min}` : null, s.max !== undefined ? `au plus ${s.max}` : null,
    s.type === 'markdown' ? 'Markdown de la page, comme dans l’éditeur' : null, s.type === 'categories' ? 'identifiants séparés par des virgules' : null].filter(Boolean);
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
  return null;
}

/** Les deux versions côte à côte, puis leurs différences mot à mot quand ce sont deux textes qui diffèrent. */
function htmlDesVersions(c) {
  const v1 = texteDeLaVersion(c.version_1);
  const v2 = texteDeLaVersion(c.version_2);
  const version = (n, titre, texte) => `<div class="nv-version nv-version--${n}"><h5 class="nv-version__titre">${titre}</h5><div class="nv-version__texte">${echapper(texte)}</div></div>`;
  const textes = c.version_1?.genre === 'valeur' && c.version_2?.genre === 'valeur' && typeof c.version_1.valeur === 'string' && typeof c.version_2.valeur === 'string';
  const diff = textes && v1 !== v2 ? diffMots(v2, v1) : null;
  const differences = diff
    ? `<details class="nv-conflit__differences"><summary>Différences (barré : seulement dans la version 2 ; en gras : seulement dans la version 1)</summary><div class="nv-diff">${diff
      .map((d) => (d.type === 'egal' ? echapper(d.texte) : d.type === 'retire' ? `<del>${echapper(d.texte)}</del>` : `<ins>${echapper(d.texte)}</ins>`)).join('')}</div></details>`
    : '';
  const avant = c.avant?.genre === 'valeur' && texteDeValeur(c.avant.valeur) !== v2
    ? `<details class="nv-conflit__avant"><summary>Ce que le site de dev avait sous les yeux avant sa modification</summary><div class="nv-version__texte">${echapper(texteDeValeur(c.avant.valeur))}</div></details>`
    : '';
  return `<div class="nv-conflit__versions">${version(1, 'Version 1 : ce que le site de dev avait écrit', v1)}${version(2, 'Version 2 : ce que disent les règles livrées', v2)}</div>${differences}${avant}`;
}

/** Un conflit d'un lot : ses deux versions et ses trois choix (`k` : son rang dans la page, pour les identifiants des champs). */
export function htmlDuConflit(c, k, { listes = {} } = {}) {
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
    ${c.raison ? `<p class="nv-conflit__raison">${echapper(c.raison)}</p>` : ''}
    ${htmlDesVersions(c)}
    <ul class="nv-choix-liste">${choix}</ul>${saisie}
    <p class="nv-message nv-message--erreur" data-nv-erreur hidden></p>
  </fieldset>`;
}

/** Un lot en conflit : en-tête, modifications saines, conflits, envoi (`debut` : le rang du premier conflit dans la page). */
export function htmlDuLot(lot, { listes = {}, debut = 0 } = {}) {
  const saines = lot.saines?.length
    ? `<details class="nv-conflit-lot__saines"><summary>${lot.saines.length} modification${lot.saines.length > 1 ? 's' : ''} saine${lot.saines.length > 1 ? 's' : ''} de ce lot (sans conflit)</summary><ul>${lot.saines
      .map((s) => `<li>${echapper(s.libelle)}${s.colonnes?.length ? ` (${echapper(s.colonnes.join(', '))})` : ''} <span class="nv-conflit__operation">${echapper(OPERATIONS[s.operation] ?? s.operation)}</span> : ${echapper(ISSUES_SAINES[s.issue] ?? s.issue)}</li>`).join('')}</ul></details>`
    : '<p class="nv-conflit-lot__saines">Aucune modification saine dans ce lot : seulement les conflits ci-dessous.</p>';
  const n = lot.conflits?.length ?? 0;
  return `<form class="nv-conflit-lot" data-nv-lot="${echapper(lot.lot)}" data-nv-empreinte="${echapper(lot.empreinte)}">
    <h4 class="nv-conflit-lot__titre">Lot du ${echapper(instantLisible(lot.fait_le))} : ${echapper(lot.resume ?? lot.lot)}</h4>
    ${lot.detail_lisible ? `<p class="nv-conflit-lot__detail">Au rejeu : ${echapper(lot.detail_lisible)}</p>` : ''}
    ${saines}
    <p>${n} conflit${n > 1 ? 's' : ''} : choisissez pour chacun. Le lot reste en attente, entier, tant qu’un choix manque ; une fois résolu, ses modifications saines et vos choix 1 et 3 forment une nouvelle modification du site de dev (elle partira avec la prochaine mise à jour) ; le choix 2 laisse la règle livrée.</p>
    ${(lot.conflits ?? []).map((c, i) => htmlDuConflit(c, debut + i, { listes })).join('')}
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
    ? `<p>${lots.length} lot${lots.length > 1 ? 's' : ''} du site de dev ${lots.length > 1 ? 'sont' : 'est'} en conflit avec les règles livrées depuis : ${lots.length > 1 ? 'ils ne partent' : 'il ne part'} pas avec cette mise à jour. Pour chaque conflit, la version 1 est ce que le site de dev avait écrit, la version 2 ce que disent maintenant les règles livrées.</p>`
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
