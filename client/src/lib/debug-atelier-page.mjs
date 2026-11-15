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

/**
 * Tout le contenu du bloc pour une réponse lue (`lireLaReponse`). `presentation` = `presenterLAtelier(lecture.atelier)` et `jugement` =
 * `jugerLeServeur(lecture.atelier.dernier)`, calculés par le script ; sans contenu, le message neutre de l'état.
 */
export function htmlDeLAtelier(lecture, presentation, jugement) {
  const l = lecture !== null && typeof lecture === 'object' ? lecture : {};
  if (l.etat !== 'ok' || !presentation || typeof presentation !== 'object') return `<p class="debug-vide">${echapper(MESSAGES[l.etat] ?? MESSAGES.erreur)}</p>`;
  const avecMesure = liste(presentation.lignes).length > 0;
  // le jugement sur le serveur ne se dit que s'il y a une mesure ; « inconnu » dit déjà quelque chose (pas de mesure exploitable) sans verdict
  const phrase = avecMesure && jugement && typeof jugement.phrase === 'string' ? jugement.phrase : '';
  return htmlDuVerdict(presentation.severite, presentation.message, phrase) + htmlDesLignes(presentation.lignes) + htmlDeLHistorique(presentation.historique);
}

/** Le résumé d'une ligne du bloc (à droite du titre) : la gravité en toutes lettres quand une mesure existe, sinon rien. */
export function resumeDeLAtelier(lecture, presentation) {
  const l = lecture !== null && typeof lecture === 'object' ? lecture : {};
  if (l.etat !== 'ok' || !presentation || liste(presentation.lignes).length === 0) return '';
  return LIBELLES_DE_GRAVITE[gravite(presentation.severite)].toLowerCase();
}
