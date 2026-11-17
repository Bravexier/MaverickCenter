// Bloc « Fabrication témoin » du menu DB de la page Debug (components/debug/SchemaDeLaBase.astro, src/scripts/debug-atelier.mjs ; lot 9 du chantier de la base
// de dev, PR 3) : le rendu en HTML de ce que dit l'atelier. Module pur, SANS dépendance (le script de la page lui donne ce que lib/debug-atelier.mjs a calculé :
// `presenterLAtelier(etat)` et `jugerLeServeur(etat.dernier)`) ; seul scripts/debug-atelier.mjs l'importe (skill site-version-portable : deux scripts de page
// n'importent jamais le même module).
//
// Entrée : la réponse de GET <base>api/debug/atelier/ (format `maverick-atelier-etat/1`, `Cache-Control: no-store`, 403 en production, 503 sans atelier). Chaque
// texte est échappé ici, même s'il vient du service (qui borne et valide ce qu'il lit des rapports).

/** Le format de la réponse que cette page sait lire (celui de serveur/atelier.mjs#FORMAT_ETAT_DE_L_ATELIER ; le test les compare). */
export const FORMAT_DE_L_ETAT = 'maverick-atelier-etat/1';

/** Le nombre de fabrications gardées dans l'historique affiché. */
export const FABRICATIONS_AFFICHEES = 8;

const ENTITES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const echapper = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ENTITES[c]);
const liste = (v) => (Array.isArray(v) ? v : []);

/** L'adresse de la route, `api` = « <base>api/ ». */
export const adresseDeLAtelier = (api) => `${api}debug/atelier/`;

/** Les messages neutres, pour les états sans contenu. */
export const MESSAGES = {
  attente: 'Chargement de l’atelier…',
  ferme: 'L’atelier n’est lu que sur le site de dev : ce service ne le donne pas.',
  absent: 'Ce service n’a pas d’atelier (il démarre, ou sa version n’en a pas).',
  erreur: 'La réponse du service sur l’atelier n’a pas pu être lue. « Actualiser » réessaie.',
  injoignable: 'Le service ne répond pas. « Actualiser » réessaie.',
};

/**
 * Ce que la page fait d'une réponse du service. Rend { etat, atelier? } :
 *   - `ok` : la réponse est lisible (`atelier` = son contenu, à passer à `presenterLAtelier`) ;
 *   - `ferme` (403 : pas le site de dev) et `absent` (503, 404 : pas d'atelier sur ce service, ou service qui démarre) : des cas normaux, un message neutre ;
 *   - `erreur` : tout le reste (autre statut, corps illisible ou d'un autre format).
 */
export function lireLaReponse(statut, corps) {
  if (statut === 403) return { etat: 'ferme' };
  if (statut === 503 || statut === 404) return { etat: 'absent' };
  if (!(statut >= 200 && statut < 300)) return { etat: 'erreur' };
  if (corps === null || typeof corps !== 'object' || Array.isArray(corps) || corps.format !== FORMAT_DE_L_ETAT) return { etat: 'erreur' };
  return { etat: 'ok', atelier: corps };
}

/** Le mot qui dit la gravité (la couleur ne la porte jamais seule). */
export const LIBELLES_DE_GRAVITE = { neutre: 'État', ok: 'Fabrication faite', attention: 'Fabrication faite, à regarder', alerte: 'À examiner' };
const gravite = (s) => (Object.hasOwn(LIBELLES_DE_GRAVITE, s) ? s : 'neutre');

function htmlDuVerdict(severite, message, phrase) {
  const s = gravite(severite);
  return (
    `<p class="structure-verdict structure-verdict--${s}" role="${s === 'alerte' ? 'alert' : 'status'}">` +
    `<strong class="structure-verdict__nom">${echapper(LIBELLES_DE_GRAVITE[s])}</strong>` +
    (message ? ` <span>${echapper(message)}</span>` : '') +
    (phrase ? `<span class="structure-verdict__resume">${echapper(phrase)}</span>` : '') +
    '</p>'
  );
}

/** Les lignes { libelle, valeur } en liste de définitions ; une valeur vide est omise. */
function htmlDesLignes(lignes) {
  const l = liste(lignes).filter((x) => x && x.valeur !== null && x.valeur !== undefined && x.valeur !== '');
  if (l.length === 0) return '';
  return `<dl class="structure-faits">${l.map((x) => `<div><dt>${echapper(x.libelle)}</dt><dd>${echapper(x.valeur)}</dd></div>`).join('')}</dl>`;
}

function htmlDeLHistorique(historique) {
  const h = liste(historique).slice(0, FABRICATIONS_AFFICHEES);
  if (h.length === 0) return '';
  return (
    '<h5>Dernières fabrications</h5><ul class="atelier-historique">' +
    h.map((x) => `<li class="atelier-historique__ligne atelier-historique__ligne--${gravite(x?.severite)}">${echapper(x?.texte)}</li>`).join('') +
    '</ul>'
  );
}

const nombre = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const objet = (v) => (v !== null && typeof v === 'object' && !Array.isArray(v) ? v : {});

/** Le titre du verdict du bilan de la journée, en toutes lettres (la couleur ne le porte jamais seule). */
export const LIBELLES_DU_BILAN = {
  tient: 'Le serveur tient',
  tient_tout_juste: 'Le serveur tient tout juste',
  ne_tient_pas: 'À examiner : le serveur ne tient pas',
  journee_incomplete: 'Journée incomplète',
  inconnu: 'Pas de verdict',
};
const libelleDuBilan = (verdict) => (Object.hasOwn(LIBELLES_DU_BILAN, verdict) ? LIBELLES_DU_BILAN[verdict] : LIBELLES_DU_BILAN.inconnu);

/** Le message d'une journée incomplète : combien de fabrications ont eu lieu, et combien il en faut pour juger ; '' si ce n'est pas le cas ou si les nombres manquent. */
export function messageDeLaJourneeIncomplete(bilan) {
  const b = objet(bilan);
  const total = nombre(objet(b.fabrications).total);
  const minimum = nombre(objet(b.seuils).fabrications_minimum);
  const heures = nombre(objet(b.seuils).periode_h) ?? nombre(b.periode_h);
  if (b.verdict !== 'journee_incomplete' || total === null) return '';
  return `${total} fabrication${total > 1 ? 's' : ''} sur les ${heures ?? '?'} dernières heures${minimum === null ? '' : `, il en faut au moins ${minimum} pour juger le serveur`}.`;
}

/** Les phrases des seuils du verdict, d'après `bilan.seuils` (jamais écrits ici en chiffres : le service les expose). Vide sans seuils. */
export function phrasesDesSeuils(seuils) {
  const s = objet(seuils);
  const n = (cle) => nombre(s[cle]);
  if (['periode_h', 'fabrications_minimum', 'facteur_de_reference', 'plancher_ms', 'facteur_grave', 'plancher_grave_ms', 'erreurs_graves_pct'].some((c) => n(c) === null)) return [];
  return [
    `Période jugée : les ${n('periode_h')} dernières heures ; au moins ${n('fabrications_minimum')} fabrications pour rendre un verdict.`,
    `Le serveur tient : aucun refus ni échec, et le temps de réponse de la production (95e centile) pendant les fabrications reste sous ${n('facteur_de_reference')} fois sa référence ou sous ${n('plancher_ms')} ms.`,
    `Le serveur ne tient pas : un refus ou un arrêt faute de mémoire, de marge, de disque ou de délai ; ou la production à plus de ${n('facteur_grave')} fois sa référence et au-delà de ${n('plancher_grave_ms')} ms ; ou plus de ${n('erreurs_graves_pct')} % de mauvaises réponses.`,
    'Entre les deux : il tient tout juste.',
  ];
}

function htmlDesSeuils(seuils) {
  const phrases = phrasesDesSeuils(seuils);
  if (phrases.length === 0) return '';
  return (
    '<details class="structure-repli atelier-seuils"><summary>Seuils du verdict</summary>' +
    `<ul class="structure-liste">${phrases.map((p) => `<li>${echapper(p)}</li>`).join('')}</ul>` +
    '<p class="debug-petit">Ce sont des choix techniques, réglables dans le code (<code>src/lib/atelier-bilan.mjs</code>), pas des règles du jeu.</p></details>'
  );
}

/** Le bilan de la journée : `presentation.bilan` (`presenterLeBilan`), `atelier.bilan` pour les nombres bruts (seuils, total). '' sans bilan. */
function htmlDuBilan(bilan, brut) {
  if (!bilan || typeof bilan !== 'object') return '';
  const s = gravite(bilan.severite);
  const incomplete = bilan.verdict === 'journee_incomplete';
  const message = incomplete ? messageDeLaJourneeIncomplete(brut) : bilan.phrase;
  const raisons = liste(bilan.raisons).filter((r) => typeof r === 'string' && r !== '');
  return (
    `<section class="atelier-bilan"><h4>${echapper(bilan.titre ?? '')}</h4>` +
    `<p class="structure-verdict structure-verdict--${s}" role="${s === 'alerte' ? 'alert' : 'status'}">` +
    `<strong class="structure-verdict__nom">${echapper(libelleDuBilan(bilan.verdict))}</strong>` +
    (message ? ` <span>${echapper(message)}</span>` : '') +
    '</p>' +
    (raisons.length ? `<ul class="structure-liste atelier-bilan__raisons">${raisons.map((r) => `<li>${echapper(r)}</li>`).join('')}</ul>` : '') +
    htmlDesLignes(bilan.lignes) +
    htmlDesSeuils(objet(brut).seuils) +
    '</section>'
  );
}

/**
 * Tout le contenu du bloc pour une réponse lue (`lireLaReponse`). `presentation` = `presenterLAtelier(lecture.atelier)` et `jugement` =
 * `jugerLeServeur(lecture.atelier.dernier)`, calculés par le script ; sans contenu, le message neutre de l'état.
 * Le bilan de la journée vient en tête, puis l'état de l'atelier, la dernière mesure et l'historique.
 */
export function htmlDeLAtelier(lecture, presentation, jugement) {
  const l = lecture !== null && typeof lecture === 'object' ? lecture : {};
  if (l.etat !== 'ok' || !presentation || typeof presentation !== 'object') return `<p class="debug-vide">${echapper(MESSAGES[l.etat] ?? MESSAGES.erreur)}</p>`;
  const avecMesure = liste(presentation.lignes).length > 0;
  // le jugement sur le serveur ne se dit que s'il y a une mesure ; « inconnu » dit déjà quelque chose (pas de mesure exploitable) sans verdict
  const phrase = avecMesure && jugement && typeof jugement.phrase === 'string' ? jugement.phrase : '';
  const bilan = htmlDuBilan(presentation.bilan, objet(l.atelier).bilan);
  const dernier = htmlDuVerdict(presentation.severite, presentation.message, phrase) + htmlDesLignes(presentation.lignes);
  return bilan + (bilan && avecMesure ? '<h4>Dernière fabrication</h4>' : '') + dernier + htmlDeLHistorique(presentation.historique);
}

/** Le résumé d'une ligne du bloc (à droite du titre) : le verdict du bilan quand il existe, sinon la gravité de la dernière mesure, sinon rien. */
export function resumeDeLAtelier(lecture, presentation) {
  const l = lecture !== null && typeof lecture === 'object' ? lecture : {};
  if (l.etat !== 'ok' || !presentation) return '';
  if (presentation.bilan && typeof presentation.bilan === 'object') return libelleDuBilan(presentation.bilan.verdict).replace(/^À examiner : /, '').toLowerCase();
  if (liste(presentation.lignes).length === 0) return '';
  return LIBELLES_DE_GRAVITE[gravite(presentation.severite)].toLowerCase();
}
