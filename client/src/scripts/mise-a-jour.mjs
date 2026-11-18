// Page « Mise à jour » (pages/mise-a-jour.astro) sur le site de dev : si le service répond `edition: true` (MAVERICK_EDITION=1), la note EN
// PRÉPARATION s'affiche au-dessus de la note de production — les modifications des règles de la production (master) à la base dev, calculées par
// le service (GET /api/mise-a-jour/), le champ libre des admins, la case « Version majeure » à côté du titre (demande du propriétaire du
// 2026-10-22 : cochée après confirmation, la version en préparation passe de X.Y+1 à X+1.0 ; elle ne déclenche rien) et, sur tous les écrans
// (comme le mode modification), le bouton « Effectuer la mise à jour », seul déclencheur : après confirmation, le service fige le lot (case
// comprise) et déclenche le workflow GitHub (rebase sur dev, PR, fusion automatique si tout est vert, puis livraison dev → master, avec
// [V: X+1] pour une version majeure) ; « Simulation de mise à jour » : le même travail, arrêté avant de rien pousser.
// La page suit leur avancement ; une vraie mise à jour lancée, les deux sites passent en maintenance (serveur/maintenance.mjs) et cette page part
// vers /maintenance/, qui y revient quand la nouvelle version est installée. Ailleurs (production, service absent) : rien ne change.
// Après les listes de modifications, les lignes en conflit (demande du propriétaire du 2026-10-22 : « Après les listes de modifications, montrer les
// lignes en conflits. 1. Pour chaque conflit, montrer les deux versions 2. Laisser le choix entre 1, 2, ou 3 pour saisir à la main ce qui remplace les
// deux. ») : les lots du journal que le rejeu d'une livraison a mis en conflit (GET /api/mise-a-jour/conflits/, serveur/edition-conflits.mjs), chacun
// avec ses modifications saines et, pour chaque conflit, ses deux versions (un lot gardé : à gauche la modification sur le site, à droite celle du
// code ; un lot annulé : la version 1 du site de dev, la version 2 la valeur actuelle) et les choix 1, 2, 3 ; « Résoudre ce lot » l'envoie (POST, une
// fois chaque choix fait ; jamais pour un lot qui attend un lot plus ancien : `bloque`) : le service écrit une nouvelle modification du site de dev et
// marque l'ancien lot résolu. Rendu : lib/conflits-rendu.mjs. La section reste la même d'un rendu de la note à l'autre (le suivi d'un lancement la refait toutes les 15 s) :
// les choix en cours ne se perdent pas.
// Avant les conflits, les modifications de l'équipe (R291 : « En gros c'est le patchnote mais où je peux choisir chaque ligne que je peux annuler. […] Juste un
// bout "annuler cette modification" sur chaque ligne du patchnote. ») : une session dépose avec la clé de dépôt (GET /api/edition/lots/, serveur/edition-lots.mjs),
// la modification est appliquée aussitôt, et la page la montre ligne par ligne ; « Annuler cette modification » ouvre une confirmation avec l'aperçu de ce qu'elle
// remettrait, puis l'annule (mot de passe : scripts/acces.mjs le demande, rien à faire ici). Les propositions encore en attente (R275, question 4 a) gardent
// « Appliquer » et « Refuser » ; « Tout recalculer » recalcule les pages que le code d'aujourd'hui calcule autrement. Rendu : lib/lots-rendu.mjs. Rien de cela en
// production ni sans le service (la lecture des lots répond 403 ou 404 : la section reste cachée). Avant « Effectuer la mise à jour », une alerte dit les races,
// classes et magies que la mise à jour retirerait alors que des fiches de la production les citent (R292, `retraits_bloquants`).
// Ce script n'importe que les rendus communs, celui des conflits et celui des lots (aucun autre script de page ne les importe : la version portable
// refuse un module partagé).
import {
  PHRASE_DE_LA_COPIE, affichageDeLaProduction, affichageDesRetraits, compter, echapper, enteteDuLancement, erreurDuReport, htmlDeLaListe, htmlDuTexteLibre, lancementAffiche, messageDuRefus,
  modeDuLancement, motDeLaCopie, texteDeLEtat,
} from '../lib/notes-de-version-rendu.mjs';
import { avecDateLisible, corpsDeLaResolution, htmlDesConflits, messageDeResolution } from '../lib/conflits-rendu.mjs';
import {
  APPLIQUES_RECENTS, corpsDuClic, htmlDeLaConfirmation, htmlDesLots, lotsAppliques, messageDeLaLigneAnnulee, messageDErreur, messageDuBilan,
  messageDuRecalcul, peutAnnuler, peutAnnulerLaLigne, peutAppliquer, verrousDuLot,
} from '../lib/lots-rendu.mjs';

const racine = document.querySelector('[data-mise-a-jour]');
const api = racine?.dataset.api ?? '/api/';

async function appel(methode, chemin, corps) {
  const r = await fetch(`${api}${chemin}`, {
    method: methode,
    headers: { Accept: 'application/json', ...(corps === undefined ? {} : { 'Content-Type': 'application/json' }) },
    body: corps === undefined ? undefined : JSON.stringify(corps),
    cache: 'no-store',
  });
  const contenu = await r.json().catch(() => null);
  if (!r.ok) {
    const e = new Error(contenu?.erreur ?? `Le service a répondu ${r.status}.`);
    e.statut = r.status;
    e.corps = contenu;
    throw e;
  }
  return contenu;
}

const ETATS = {
  envoi: 'Lot figé, envoi à GitHub…',
  lance: 'Workflow déclenché sur GitHub : en attente de démarrage.',
  en_cours: 'Mise à jour en cours sur GitHub (PR vers dev, tests, fusion, puis livraison dev → master).',
  fusionne: 'Les modifications sont fusionnées dans dev ; la livraison dev → master est en cours.',
  termine: 'Mise à jour terminée : fusionnée dans dev puis livrée sur master. Le site de dev se met à jour de lui-même ; le texte redevient modifiable quand la nouvelle version y arrive.',
  echec: 'La mise à jour a échoué sur GitHub avant d’entrer dans dev : rien n’a été fusionné. Le journal du workflow dit pourquoi ; vous pouvez annuler ce lancement.',
  echec_livraison: 'Les modifications sont dans dev, mais la livraison dev → master a échoué. Relancez le run sur GitHub (« Re-run all jobs » : il reprend à la livraison) ou fusionnez la PR de livraison à la main. Une nouvelle mise à jour attend que celle-ci soit livrée.',
  erreur: 'Le workflow n’a pas pu être déclenché.',
  manuel: 'Aucun jeton GitHub sur ce serveur : lancez le workflow à la main avec les valeurs ci-dessous.',
  annule: 'Lancement annulé : le texte redevient modifiable.',
  simulation_reussie: 'Simulation réussie : le lot s’applique sur dev, seules les tables prévues changent, db:check, tous les tests et la construction du site passent, et le jeton du dépôt peut pousser. Rien n’a été poussé ; la vraie mise à jour peut être lancée (seuls les droits d’ouvrir et de fusionner une PR n’ont pas pu être essayés sans effet).',
  simulation_echouee: 'La simulation a échoué : le journal du workflow dit pourquoi. Rien n’a été poussé ; le texte redevient modifiable.',
};
/** États où le run peut encore avancer : la page suit (une relance d'un échec de livraison aussi). */
const EN_COURS = ['envoi', 'lance', 'en_cours', 'fusionne'];
const SUIVIS = [...EN_COURS, 'echec_livraison'];

let donnees = null;
let suivi = null;
/** Les lots en conflit : la section (gardée d'un rendu à l'autre), le dernier diagnostic, les listes des champs « choix », les choix en cours. */
const conflits = { section: null, reponse: null, listes: null, choisis: new Map(), message: '', erreur: '' };
/**
 * Les modifications de l'équipe : la section (gardée d'un rendu à l'autre), la liste lue avec le détail des propositions en attente et des changements appliqués
 * récents (leurs lignes), ce que le propriétaire a coché (décisions à ouvrir, par proposition), les messages (clés `<lot>` ou `<lot>#<ligne>`), ce qu'il a
 * déplié, le message d'en tête, et un verrou contre le double clic.
 */
const lots = { section: null, reponse: null, erreur: '', coches: new Map(), messages: new Map(), ouverts: new Set(), toutes: new Set(), message: null, occupe: false };

function htmlDuLancement(l, github, liberable) {
  if (!l) return '';
  const run = l.run?.url ? ` <a href="${echapper(l.run.url)}" rel="noopener noreferrer" target="_blank">Voir le workflow sur GitHub</a>` : '';
  const manuel = l.etat === 'manuel' || l.etat === 'erreur'
    ? `<p>Sur GitHub : <a href="https://github.com/${echapper(github?.depot ?? 'Bravexier/MaverickCenter')}/actions/workflows/mise-a-jour.yml" rel="noopener noreferrer" target="_blank">Actions › Mise à jour des règles › Run workflow</a> (branche dev), avec :</p>
       <ul><li>lot : <code>${echapper(l.lot)}</code></li><li>empreinte : <code>${echapper(l.empreinte)}</code></li><li>adresse : <code>${echapper(l.adresse)}</code></li>
       <li>case « Simulation » : ${l.simulation ? '<strong>cochée</strong>' : 'décochée'}</li>
       ${modeDuLancement(l) === 'copie' ? '<li>case « Copie » : <strong>cochée</strong></li>' : ''}</ul>`
    : '';
  // le service dit si le lancement est annulable (mêmes règles des deux côtés : estLiberable) ; un lot dans dev ou livré, resté sans nouvelles plus
  // de 3 h, libère seulement le texte
  const tardif = ['fusionne', 'echec_livraison', 'termine', 'lance', 'en_cours'].includes(l.etat);
  const liberer = liberable
    ? `<button type="button" data-nv-liberer data-lot="${echapper(l.lot)}">${tardif ? 'Libérer le texte (sans nouvelles depuis plus de 3 h)' : 'Annuler ce lancement'}</button>` : '';
  const entete = enteteDuLancement(l); // « Dernière copie » sans version cible : une copie n'en a pas
  const reportRate = erreurDuReport(l);
  return `<div class="nv-lancement nv-lancement--${echapper(l.etat)}">
    <p class="nv-message"><strong>${echapper(entete.titre)}</strong> (${echapper(entete.precision)}) : ${echapper(texteDeLEtat(l, ETATS))}${run}</p>
    ${l.erreur ? `<p class="nv-message nv-message--erreur">${echapper(l.erreur)}</p>` : ''}${reportRate ? `<p class="nv-message nv-message--erreur">${echapper(reportRate)}</p>` : ''}${manuel}${liberer}</div>`;
}

function rendre() {
  const d = donnees;
  const zone = racine.querySelector('[data-nv-dev]');
  // un lot figé (brouillon.lot) verrouille le texte et le bouton jusqu'à ce que la version livrée arrive sur ce site (ou que le lancement soit annulé)
  const verrouille = Boolean(d.brouillon?.lot);
  const occupe = verrouille || Boolean(d.occupe); // règle du service (occupe : lancement en cours ou en attente de livraison)
  const ref = d.reference;
  const versionProd = ref?.version ? `V${ref.version.split('.').slice(0, 2).join('.')}` : 'inconnue';
  // d'où vient la référence : le contenu que la production publie, ou (tant que son dossier n'est pas monté) la copie de master tirée du dépôt
  const origine = ref?.source === 'production' ? 'contenu publié par la production'
    : ref?.source === 'depot' ? `copie de master tirée du dépôt${ref.raison ? ` — ${ref.raison}` : ''}` : null;
  const n = d.lignes ? compter(d.lignes) : null;
  const bilan = d.lignes
    ? `${d.lignes.length} modification${d.lignes.length > 1 ? 's' : ''} des règles depuis la production (${versionProd}${origine ? ` · ${echapper(origine)}` : ''})`
      + `${n.amelioration ? ` · <span class="nv-sens--amelioration">${n.amelioration} amélioration${n.amelioration > 1 ? 's' : ''}</span>` : ''}`
      + `${n.affaiblissement ? ` · <span class="nv-sens--affaiblissement">${n.affaiblissement} affaiblissement${n.affaiblissement > 1 ? 's' : ''}</span>` : ''}`
    : `La base de production (référence) manque sur ce serveur : la liste ne peut pas être calculée.${ref?.raison ? ` (${echapper(ref.raison)})` : ''}`;
  const enConflit = d.en_conflit?.lots ?? 0;
  const bilanDesConflits = enConflit
    ? ` · <a href="#nv-conflits">${enConflit} lot${enConflit > 1 ? 's' : ''} en conflit ${enConflit > 1 ? 'ne partent' : 'ne part'} pas avec cette mise à jour</a>` : '';
  const texte = d.brouillon?.texte ?? '';
  const note = !verrouille
    ? `<label for="nv-texte"><strong>Informations supplémentaires</strong> (champ libre, ajouté à la note : paragraphes, listes « - », **gras**, *italique*, liens)</label>
       <textarea id="nv-texte" data-nv-texte>${echapper(texte)}</textarea>
       <div class="nv-dev__actions"><button type="button" data-nv-enregistrer>Enregistrer le texte</button><span data-nv-etat-texte></span></div>
       <div class="nv-dev__apercu nv-texte" data-nv-apercu ${texte ? '' : 'hidden'}>${htmlDuTexteLibre(texte)}</div>`
    : texte ? `<div class="nv-texte">${htmlDuTexteLibre(texte)}</div>` : '';
  // base source seulement (lot 8) : « Copier vers le dépôt », à côté des deux autres ; sans elle la page reste telle qu'elle était. Une copie ne demande ni
  // ligne à livrer ni référence : seule une place occupée la grise.
  const motCopie = motDeLaCopie(d);
  const copier = motCopie
    ? `<button type="button" data-nv-copier title="${echapper(PHRASE_DE_LA_COPIE)}" ${occupe ? 'disabled' : ''}>Copier vers le dépôt</button>` : '';
  const bouton = `<div class="nv-dev__actions"><button type="button" data-nv-simuler ${occupe || !d.lignes ? 'disabled' : ''}>Simulation de mise à jour</button>
       <button type="button" class="nv-principal" data-nv-lancer ${occupe || !d.lignes ? 'disabled' : ''}>Effectuer la mise à jour</button>${copier}
       <span class="nv-bascule"><label><input type="checkbox" data-nv-voir-prod> Voir la page de production</label></span></div>
       ${motCopie ? `<p class="nv-message nv-copie-aide" data-nv-copie-aide>« Copier vers le dépôt » : ${echapper(PHRASE_DE_LA_COPIE.charAt(0).toLowerCase() + PHRASE_DE_LA_COPIE.slice(1))}</p>` : ''}`;
  // la case « Version majeure » : figée avec le lot, comme le texte
  const majeure = Boolean(d.brouillon?.majeure);
  const caseMajeure = d.version_majeure
    ? `<label class="nv-majeure" title="Cochée, la prochaine mise à jour est la V${echapper(d.version_majeure)} au lieu de la V${echapper(d.version_mineure ?? '?')}. Elle ne lance rien : seul « Effectuer la mise à jour » livre.${verrouille ? ' Figée avec le lot en cours.' : ''}">
        <input type="checkbox" data-nv-majeure ${majeure ? 'checked' : ''} ${verrouille ? 'disabled' : ''}> Version majeure (V${echapper(d.version_majeure)})</label>`
    : '';
  zone.innerHTML = `<div class="nv-dev__titre"><h2>Mise à jour en préparation : V${echapper(d.version_cible ?? '?')}</h2>${caseMajeure}</div>
    <p class="nv-dev__bilan">${bilan}${bilanDesConflits}</p>
    <div data-nv-production></div>
    <div class="nv-dev__note">${note}</div>
    <div data-nv-retraits></div>
    ${bouton}
    ${htmlDuLancement(lancementAffiche(d), d.github, d.liberable)}
    <div class="nv-dev__liste">${d.lignes ? htmlDeLaListe(d.lignes, { niveau: 3, plafond: 25 }) : ''}</div>`;
  rendreLEtatDeLaProduction(zone.querySelector('[data-nv-production]'), d.etat_production);
  rendreLesRetraits(zone.querySelector('[data-nv-retraits]'), d.retraits_bloquants);
  // après les listes, la section des lots de changements puis celle des conflits, les mêmes d'un rendu à l'autre (choix en cours gardés)
  zone.append(sectionDesLots(), sectionDesConflits());
  zone.hidden = false;
  brancher(zone);
}

/** L'état de la production (`etat_production`) : une alerte si elle n'a pas appliqué sa dernière mise à jour, sinon une ligne discrète. Texte par textContent. */
function rendreLEtatDeLaProduction(place, etat) {
  if (!place) return;
  const a = affichageDeLaProduction(etat);
  if (!a) return;
  const ajouter = (parent, balise, texte, classe) => {
    const e = document.createElement(balise);
    if (classe) e.className = classe;
    e.textContent = texte;
    parent.append(e);
    return e;
  };
  const bloc = document.createElement('div');
  bloc.className = `nv-production nv-production--${a.niveau}`;
  if (a.niveau === 'alerte') bloc.setAttribute('role', 'alert');
  if (a.message) ajouter(bloc, 'p', a.message, a.niveau === 'alerte' ? 'nv-message nv-message--erreur' : 'nv-message');
  if (a.lignes.length) {
    const liste = document.createElement('ul');
    for (const l of a.lignes) ajouter(liste, 'li', l);
    bloc.append(liste);
  }
  if (a.tables.length) ajouter(bloc, 'p', `Tables dont le contenu diffère : ${a.tables.join(', ')}`, 'nv-message');
  place.append(bloc);
}

/**
 * R292 : une alerte, avant « Effectuer la mise à jour », quand la mise à jour retirerait des races, classes ou magies que des fiches de la production citent
 * (la production garderait sa base d'avant). Rien si l'attestation n'est pas lue ou si rien ne bloque. Texte par textContent.
 */
function rendreLesRetraits(place, retraits) {
  const a = place ? affichageDesRetraits(retraits) : null;
  if (!a) return;
  const bloc = document.createElement('div');
  bloc.className = 'nv-retraits';
  bloc.setAttribute('role', 'alert');
  const ajouter = (parent, balise, texte, classe) => {
    const e = document.createElement(balise);
    if (classe) e.className = classe;
    e.textContent = texte;
    parent.append(e);
    return e;
  };
  ajouter(bloc, 'p', a.message || 'Cette mise à jour retire des éléments que des fiches de la production utilisent encore : la production garderait sa version actuelle.', 'nv-message nv-message--erreur');
  const liste = document.createElement('ul');
  for (const t of a.elements) ajouter(liste, 'li', t);
  bloc.append(liste);
  if (a.total) ajouter(bloc, 'p', a.total, 'nv-message');
  place.append(bloc);
}

// --- Modifications de l'équipe ------------------------------------------------------------------------------------------------------------------------

const adresseDuLot = (id, action = '') => `edition/lots/${encodeURIComponent(id)}/${action}`;
const lotParId = (id) => lots.reponse?.lots?.find((l) => l.id === id) ?? null;
const desactiver = (bouton, oui) => {
  bouton.disabled = oui;
  if (oui) bouton.setAttribute('disabled', '');
  else bouton.removeAttribute('disabled');
};

function sectionDesLots() {
  if (lots.section) return lots.section;
  const section = document.createElement('section');
  section.className = 'nv-lots';
  section.id = 'nv-lots';
  section.setAttribute('data-nv-lots', '');
  section.setAttribute('aria-live', 'polite');
  section.hidden = true;
  // délégation : la section est refaite après chaque clic, ses écouteurs restent
  section.addEventListener('click', (e) => {
    const bouton = e.target?.closest?.('button');
    if (!bouton || bouton.hasAttribute('disabled')) return;
    clicSurLesLots(bouton).catch((err) => {
      lots.message = messageDErreur(err);
      rendreLesLots();
    });
  });
  section.addEventListener('change', (e) => {
    const caseACocher = e.target?.closest?.('[data-nv-verrou]');
    if (caseACocher) cocherUneDecision(caseACocher);
  });
  // ce que le propriétaire déplie se garde d'un rendu à l'autre (`toggle` ne remonte pas : écoute à la descente)
  section.addEventListener('toggle', (e) => {
    const cle = e.target?.getAttribute?.('data-nv-ouvert');
    if (!cle) return;
    if (e.target.open) lots.ouverts.add(cle);
    else lots.ouverts.delete(cle);
  }, true);
  lots.section = section;
  return section;
}

/** L'état de la page pour le rendu (`lib/lots-rendu.mjs`). */
const vueDesLots = () => ({ coches: lots.coches, messages: lots.messages, ouverts: lots.ouverts, toutes: lots.toutes, message: lots.message });

function rendreLesLots() {
  const section = sectionDesLots();
  const r = lots.reponse;
  if (!r) {
    // la lecture refusée ou absente (production, service sans lots, mot de passe annulé) : rien ; une autre erreur est dite
    section.innerHTML = lots.erreur ? `<p class="nv-message nv-message--erreur">${echapper(lots.erreur)}</p>` : '';
    section.hidden = !lots.erreur;
    return;
  }
  section.innerHTML = htmlDesLots(r, vueDesLots());
  section.hidden = false;
}

/** Lit les lots, puis le détail de ceux qui attendent le clic (l'essai, l'aperçu avant et après) et des appliqués récents (leurs lignes), et les pose. */
async function chargerLesLots() {
  let liste;
  try {
    liste = (await appel('GET', 'edition/lots/'))?.lots ?? [];
  } catch (e) {
    lots.reponse = null;
    lots.erreur = [401, 403, 404].includes(e.statut) ? '' : `Les lots de changements n’ont pas pu être lus : ${e.message}`;
    rendreLesLots();
    return;
  }
  lots.erreur = '';
  const aLire = [...liste.filter((l) => l.etat === 'propose'), ...lotsAppliques(liste).slice(0, APPLIQUES_RECENTS)];
  const details = new Map((await Promise.all(aLire.map(async (l) => [l.id, await appel('GET', adresseDuLot(l.id)).catch(() => null)]))));
  lots.reponse = { lots: liste.map((l) => ({ ...l, ...(details.get(l.id) ?? {}) })) };
  // ce qui ne vaut plus pour l'état d'une proposition (cases d'une proposition décidée) s'oublie
  for (const id of [...lots.coches.keys()]) if (lotParId(id)?.etat !== 'propose') lots.coches.delete(id);
  rendreLesLots();
}

/** Relit un seul lot (après un essai, un refus du service) : sa place dans la liste est remplacée. */
async function relireUnLot(id, lot = null) {
  const neuf = lot ?? (await appel('GET', adresseDuLot(id)).catch(() => null));
  if (!neuf || !lots.reponse) return;
  lots.reponse = { lots: lots.reponse.lots.map((l) => (l.id === id ? { ...l, ...neuf } : l)) };
}

/** Une case « J'accepte d'ouvrir ce que la décision R… verrouille » d'une proposition : « Appliquer » s'active ou s'éteint, sans refaire la section. */
function cocherUneDecision(caseACocher) {
  const article = caseACocher.closest('[data-nv-lot-id]');
  const id = article?.dataset.nvLotId;
  if (!id) return;
  const coches = new Set(lots.coches.get(id) ?? []);
  const decision = caseACocher.getAttribute('data-nv-verrou');
  if (caseACocher.checked) coches.add(decision);
  else coches.delete(decision);
  lots.coches.set(id, coches);
  const verdict = peutAppliquer(lotParId(id), coches);
  const bouton = article.querySelector('[data-nv-appliquer]');
  if (bouton) desactiver(bouton, !verdict.possible);
  const raison = article.querySelector('[data-nv-raison]');
  if (raison) {
    raison.textContent = verdict.raison ?? '';
    raison.hidden = verdict.possible;
  }
}

/** Dit quelque chose dans le lot (« Envoi… »), sans refaire la section : le message est remplacé au rendu suivant. */
function direDansLeLot(id, texte) {
  const article = [...(lots.section?.querySelectorAll('[data-nv-lot-id]') ?? [])].find((a) => a.dataset.nvLotId === id);
  const p = article?.querySelector('[data-nv-lot-message]');
  if (!p) return;
  p.textContent = texte;
  p.hidden = !texte;
}

/** Dit quelque chose dans une ligne d'un changement (« Annulation en cours… »), sans refaire la section. */
function direDansLaLigne(id, n, texte) {
  const article = [...(lots.section?.querySelectorAll('[data-nv-lot-id]') ?? [])].find((a) => a.dataset.nvLotId === id);
  const ligne = [...(article?.querySelectorAll('[data-nv-ligne]') ?? [])].find((l) => l.getAttribute('data-nv-ligne') === String(n));
  const p = ligne?.querySelector('[data-nv-ligne-message]');
  if (!p) return;
  p.textContent = texte;
  p.hidden = !texte;
}

async function clicSurLesLots(bouton) {
  if (lots.occupe) return;
  if (bouton.hasAttribute('data-nv-toutes')) {
    lots.toutes.add(bouton.getAttribute('data-nv-toutes'));
    return rendreLesLots();
  }
  const id = bouton.closest('[data-nv-lot-id]')?.dataset.nvLotId ?? null;
  const action = ['data-nv-recalcul', 'data-nv-lots-actualiser', 'data-nv-appliquer', 'data-nv-refuser', 'data-nv-essai', 'data-nv-annuler-ligne'].find((a) => bouton.hasAttribute(a));
  if (!action || (action !== 'data-nv-recalcul' && action !== 'data-nv-lots-actualiser' && !id)) return;
  lots.occupe = true;
  try {
    lots.message = null;
    if (action === 'data-nv-recalcul') await toutRecalculer();
    else if (action === 'data-nv-lots-actualiser') await chargerLesLots();
    else if (action === 'data-nv-appliquer') await appliquerUnLot(id);
    else if (action === 'data-nv-refuser') await refuserUnLot(id);
    else if (action === 'data-nv-essai') await refaireLEssai(id);
    else await annulerUneLigne(id, Number(bouton.getAttribute('data-nv-annuler-ligne')));
  } finally {
    lots.occupe = false;
  }
}

/**
 * Une confirmation (`<dialog>`) avant un clic qui écrit ou décide : `{ verrous }` (les décisions cochées dans la boîte) si le propriétaire confirme, sinon null.
 * Avec un aperçu d'annulation (`options.apercu`), la boîte porte une case par décision à ouvrir et ne confirme que cochées.
 */
function confirmerLeClic(options) {
  return new Promise((resoudre) => {
    const dialogue = document.createElement('dialog');
    dialogue.className = 'nv-dialogue';
    dialogue.innerHTML = htmlDeLaConfirmation(options);
    racine.append(dialogue);
    const coches = new Set();
    let confirme = false;
    dialogue.querySelector('[value="annuler"]').addEventListener('click', () => dialogue.close());
    dialogue.addEventListener('close', () => {
      dialogue.remove();
      resoudre(confirme ? { verrous: [...coches] } : null);
    });
    // les cases d'un aperçu d'annulation : le bouton qui confirme s'active quand chaque décision à ouvrir est cochée
    dialogue.addEventListener('change', (e) => {
      const caseACocher = e.target?.closest?.('[data-nv-verrou]');
      if (!caseACocher || !options.apercu) return;
      const decision = caseACocher.getAttribute('data-nv-verrou');
      if (caseACocher.checked) coches.add(decision);
      else coches.delete(decision);
      const verdict = peutAnnuler(options.apercu, coches);
      const bouton = dialogue.querySelector('[data-nv-confirmer-ligne]');
      if (bouton) desactiver(bouton, !verdict.possible);
      const raison = dialogue.querySelector('[data-nv-raison]');
      if (raison) {
        raison.textContent = verdict.raison ?? '';
        raison.hidden = verdict.possible;
      }
    });
    dialogue.querySelector('form').addEventListener('submit', (e) => {
      e.preventDefault();
      if (options.apercu && !peutAnnuler(options.apercu, coches).possible) return; // une décision à ouvrir n'est pas cochée
      confirme = true;
      dialogue.close();
    });
    dialogue.showModal();
  });
}

/** « Appliquer » : confirmation, puis le clic part avec les décisions cochées ; le bilan dit ce qui est écrit et ce qui est gardé parce que la valeur avait changé. */
async function appliquerUnLot(id) {
  const lot = lotParId(id);
  const coches = lots.coches.get(id) ?? new Set();
  if (!lot || !peutAppliquer(lot, coches).possible) return;
  const corps = corpsDuClic(verrousDuLot(lot), coches);
  if (!(await confirmerLeClic({ action: 'appliquer', lot, verrous: corps.verrous_ouverts }))) return;
  lots.messages.delete(id);
  direDansLeLot(id, 'Envoi…');
  try {
    const r = await appel('POST', adresseDuLot(id, 'appliquer/'), corps);
    lots.coches.delete(id);
    lots.message = messageDuBilan(r);
  } catch (e) {
    // 409 : le lot a changé (essai refait, valeur modifiée) ou il y a quelque chose à corriger : le lot à jour est reposé, avec ce que dit le service
    lots.messages.set(id, messageDErreur(e));
    await relireUnLot(id);
    rendreLesLots();
    return;
  }
  await relireLaPage(); // la note en préparation compte les nouvelles modifications ; les lots et les conflits sont relus
}

/** Relit la page après un clic réussi : un échec de la relecture ne se dit pas comme un refus du lot (il est écrit), il s'ajoute au message du clic. */
async function relireLaPage() {
  try {
    await charger();
  } catch (e) {
    lots.message = { ...lots.message, lignes: [...(lots.message?.lignes ?? []), `La page n’a pas pu être relue : ${e.message}. Actualisez-la.`] };
    rendreLesLots();
  }
}

/** « Refuser » : confirmation, puis rien n'est écrit ; le lot passe dans l'historique. */
async function refuserUnLot(id) {
  const lot = lotParId(id);
  if (!lot || !(await confirmerLeClic({ action: 'refuser', lot }))) return;
  lots.messages.delete(id);
  try {
    await appel('POST', adresseDuLot(id, 'refuser/'), {});
    lots.coches.delete(id);
    lots.message = { texte: `« ${lot.titre} » est refusé : rien n’a été écrit.`, lignes: [] };
    await chargerLesLots();
  } catch (e) {
    lots.messages.set(id, messageDErreur(e));
    rendreLesLots();
  }
}

/** « Refaire l'essai » : le service refait l'essai à blanc (quelques secondes) ; l'aperçu et la phrase sont remplacés. */
async function refaireLEssai(id) {
  lots.messages.delete(id);
  direDansLeLot(id, 'Essai en cours…');
  try {
    await relireUnLot(id, await appel('POST', adresseDuLot(id, 'essai/'), {}));
  } catch (e) {
    lots.messages.set(id, messageDErreur(e));
  }
  rendreLesLots();
}

/**
 * « Annuler cette modification » (R291) : l'aperçu de ce que l'annulation de cette ligne remettrait (rien n'est écrit), la confirmation, puis le clic part avec les
 * décisions cochées. Un refus du service (une autre ligne la tient, une valeur a changé, un contrôle échoue) se dit sous la ligne ; rien ne s'annule en silence.
 */
async function annulerUneLigne(id, n) {
  const lot = lotParId(id);
  const ligne = lot?.lignes?.find?.((l) => l.n === n) ?? null;
  if (!lot || !ligne || !peutAnnulerLaLigne(ligne)) return;
  const cle = `${id}#${n}`;
  lots.messages.delete(cle);
  let apercu;
  try {
    apercu = await appel('GET', adresseDuLot(id, `lignes/${n}/annulation/`));
  } catch (e) {
    lots.messages.set(cle, messageDErreur(e));
    rendreLesLots();
    return;
  }
  const choix = await confirmerLeClic({ action: 'annuler-ligne', lot, ligne, apercu });
  if (!choix) return;
  direDansLaLigne(id, n, 'Annulation en cours…');
  try {
    await appel('POST', adresseDuLot(id, `lignes/${n}/annuler/`), corpsDuClic(apercu.verrous_a_ouvrir ?? [], new Set(choix.verrous)));
    lots.message = messageDeLaLigneAnnulee(ligne, apercu);
  } catch (e) {
    // 409 : la ligne n'est plus annulable seule ou un contrôle refuse : le changement à jour est relu, avec ce que dit le service
    lots.messages.set(cle, messageDErreur(e));
    await relireUnLot(id);
    rendreLesLots();
    return;
  }
  await relireLaPage(); // la note en préparation compte la modification annulée ; les changements et les conflits sont relus
}

/** « Tout recalculer » : dépose le lot des pages que le code d'aujourd'hui calcule autrement, et l'affiche ; ou dit qu'il n'y a rien à recalculer. */
async function toutRecalculer() {
  lots.message = { texte: 'Calcul en cours : les pages dérivées sont recalculées sur une copie…', lignes: [] };
  rendreLesLots();
  try {
    const r = await appel('POST', 'edition/lots/recalcul/', {});
    lots.message = messageDuRecalcul(r);
  } catch (e) {
    lots.message = messageDErreur(e);
  }
  await chargerLesLots();
}

// --- Lignes en conflit ---------------------------------------------------------------------------------------------------------------------------

function sectionDesConflits() {
  if (conflits.section) return conflits.section;
  const section = document.createElement('section');
  section.className = 'nv-conflits';
  section.id = 'nv-conflits';
  section.setAttribute('data-nv-conflits', '');
  section.setAttribute('aria-live', 'polite');
  section.hidden = true;
  // délégation : la section est refaite à chaque diagnostic, ses écouteurs restent
  section.addEventListener('change', (e) => {
    const radio = e.target?.closest?.('[data-nv-choix]');
    if (!radio) return;
    const fieldset = radio.closest('[data-nv-conflit]');
    const n = Number(radio.getAttribute('value')); // l'attribut du bouton (1, 2, 3)
    conflits.choisis.set(cleDuChoix(fieldset), { ...(conflits.choisis.get(cleDuChoix(fieldset)) ?? {}), choix: n });
    const saisie = fieldset.querySelector('[data-nv-saisie]');
    if (saisie) saisie.hidden = n !== 3;
    const erreur = fieldset.querySelector('[data-nv-erreur]');
    if (erreur) erreur.hidden = true;
  });
  // la saisie du choix 3 se garde à mesure (un nouveau rendu de la note la remet)
  const garderLaSaisie = (e) => {
    const champ = e.target?.closest?.('[data-nv-valeur]');
    const fieldset = champ?.closest('[data-nv-conflit]');
    if (!fieldset) return;
    conflits.choisis.set(cleDuChoix(fieldset), { ...(conflits.choisis.get(cleDuChoix(fieldset)) ?? {}), valeur: champ.value });
  };
  section.addEventListener('input', garderLaSaisie);
  section.addEventListener('change', garderLaSaisie);
  section.addEventListener('submit', (e) => {
    const form = e.target?.closest?.('[data-nv-lot]');
    if (!form) return;
    e.preventDefault();
    resoudre(form).catch((err) => montrerMessage(form, err.message, true));
  });
  conflits.section = section;
  return section;
}

/** Le choix d'un conflit se garde par lot et par conflit (deux lots peuvent avoir un conflit de même id). */
const cleDuChoix = (fieldset) => `${fieldset.closest('[data-nv-lot]')?.dataset.nvLot ?? ''}\u0000${fieldset.dataset.nvConflit}`;

function montrerMessage(form, texte, erreur = false) {
  const p = form.querySelector('[data-nv-lot-message]');
  if (!p) return;
  p.textContent = texte;
  p.hidden = !texte;
  p.classList.toggle('nv-message--erreur', erreur);
}

/** Pose le diagnostic (`reponse` : { lots, resolus }) et remet les choix en cours ; `message` : ce qu'a dit la dernière résolution. */
function rendreLesConflits() {
  const section = sectionDesConflits();
  const r = conflits.reponse;
  const html = r ? htmlDesConflits(r, { listes: conflits.listes ?? {} }) : '';
  const message = conflits.message ? `<p class="nv-message nv-conflits__message" role="status">${echapper(conflits.message)}</p>` : '';
  const erreur = conflits.erreur ? `<p class="nv-message nv-message--erreur">${echapper(conflits.erreur)}</p>` : '';
  section.innerHTML = `${message}${erreur}${html}`;
  section.hidden = !html && !message && !erreur;
  for (const fieldset of section.querySelectorAll('[data-nv-conflit]')) {
    const choisi = conflits.choisis.get(cleDuChoix(fieldset));
    if (!choisi?.choix) continue;
    const radio = [...fieldset.querySelectorAll('[data-nv-choix]')].find((x) => Number(x.getAttribute('value')) === choisi.choix && !x.hasAttribute('disabled'));
    if (!radio) continue;
    radio.checked = true;
    const saisie = fieldset.querySelector('[data-nv-saisie]');
    if (saisie) saisie.hidden = choisi.choix !== 3;
    const valeur = fieldset.querySelector('[data-nv-valeur]');
    if (valeur && choisi.valeur !== undefined) valeur.value = choisi.valeur;
  }
}

/** Lit les lots en conflit (et, si un champ « choix » en a besoin, les listes de l'édition), puis les pose. */
async function chargerLesConflits() {
  if (!(donnees?.en_conflit?.lots > 0) && !conflits.message && !conflits.reponse?.resolus?.length) {
    conflits.reponse = null;
    rendreLesConflits();
    return;
  }
  const reponse = await appel('GET', 'mise-a-jour/conflits/');
  conflits.erreur = '';
  const besoinDesListes = reponse.lots?.some((l) => l.conflits?.some((c) => c.saisie?.type === 'choix' && !c.saisie.choix && c.saisie.liste));
  if (besoinDesListes && !conflits.listes) conflits.listes = await appel('GET', 'edition/listes/').catch(() => ({}));
  conflits.reponse = reponse;
  rendreLesConflits();
}

/** « Résoudre ce lot » : chaque choix fait (et la saisie du 3 contrôlée), le lot part ; le service écrit une nouvelle modification et le marque résolu. */
async function resoudre(form) {
  const lot = conflits.reponse?.lots?.find((l) => l.lot === form.dataset.nvLot);
  if (!lot) return;
  // un lot qui attend un lot plus ancien, en conflit sur le même champ (`bloque`) : son bouton est grisé, la raison dite ; rien ne part
  if (form.hasAttribute('data-nv-bloque')) return montrerMessage(form, 'Ce lot attend la résolution d’un lot plus ancien : voyez la raison ci-dessous.', true);
  const choisis = new Map();
  for (const fieldset of form.querySelectorAll('[data-nv-conflit]')) {
    const choisi = conflits.choisis.get(cleDuChoix(fieldset));
    if (!choisi?.choix) continue;
    const valeur = fieldset.querySelector('[data-nv-valeur]')?.value;
    if (choisi.choix === 3) conflits.choisis.set(cleDuChoix(fieldset), { ...choisi, valeur });
    choisis.set(fieldset.dataset.nvConflit, { choix: choisi.choix, valeur: choisi.choix === 3 ? valeur : undefined });
  }
  const { corps, manquants, erreurs } = corpsDeLaResolution(lot, choisis);
  for (const fieldset of form.querySelectorAll('[data-nv-conflit]')) {
    const p = fieldset.querySelector('[data-nv-erreur]');
    const e = erreurs?.get(fieldset.dataset.nvConflit);
    p.textContent = e ?? '';
    p.hidden = !e;
  }
  if (manquants) return montrerMessage(form, `Choisissez 1, 2 ou 3 pour chaque conflit ; il manque : ${manquants.join(' ; ')}.`, true);
  if (erreurs) return montrerMessage(form, 'Une valeur saisie est refusée : voyez le message sous le conflit.', true);
  const bouton = form.querySelector('[type="submit"]');
  if (bouton) bouton.disabled = true;
  montrerMessage(form, 'Envoi…');
  try {
    const r = await appel('POST', 'mise-a-jour/conflits/', corps);
    for (const k of [...conflits.choisis.keys()]) if (k.startsWith(`${lot.lot}\u0000`)) conflits.choisis.delete(k);
    conflits.message = messageDeResolution(r);
    await charger(); // la note en préparation compte la nouvelle modification ; les conflits sont relus
  } catch (e) {
    if (bouton) bouton.disabled = false;
    // un 409 de blocage cite le lot plus ancien par son instant (`details.bloque`) : sa date lisible
    const message = avecDateLisible(e.message, e.corps?.bloque);
    // 409 : le diagnostic a changé (règles livrées, autre onglet), ou un lot plus ancien touche le même champ (`details.bloque`) : le lot à jour est
    // reposé (son bouton grisé s'il attend), avec le message du service ; les choix qui y valent encore restent
    if (e.statut === 409 && e.corps?.lot && typeof e.corps.lot === 'object') {
      conflits.reponse = { ...conflits.reponse, lots: conflits.reponse.lots.map((l) => (l.lot === lot.lot ? e.corps.lot : l)) };
      rendreLesConflits();
      const neuf = [...conflits.section.querySelectorAll('[data-nv-lot]')].find((f) => f.dataset.nvLot === lot.lot);
      if (neuf) montrerMessage(neuf, e.corps.bloque ? message : `${message} Les conflits affichés sont à jour.`, true);
      return;
    }
    if (e.statut === 409) {
      conflits.message = message;
      await charger();
      return;
    }
    montrerMessage(form, message, true);
  }
}

function brancher(zone) {
  const champ = zone.querySelector('[data-nv-texte]');
  const apercu = zone.querySelector('[data-nv-apercu]');
  const etatTexte = zone.querySelector('[data-nv-etat-texte]');
  champ?.addEventListener('input', () => {
    apercu.innerHTML = htmlDuTexteLibre(champ.value);
    apercu.hidden = !champ.value.trim();
    etatTexte.textContent = 'modifié, non enregistré';
  });
  zone.querySelector('[data-nv-enregistrer]')?.addEventListener('click', async () => {
    try {
      const r = await appel('POST', 'mise-a-jour/brouillon/', { texte: champ.value, avant: donnees.brouillon?.texte ?? null });
      donnees.brouillon = r.brouillon;
      etatTexte.textContent = 'enregistré';
    } catch (e) {
      etatTexte.textContent = e.message;
    }
  });
  zone.querySelector('[data-nv-majeure]')?.addEventListener('change', (e) => {
    const coche = e.currentTarget.checked;
    e.currentTarget.checked = !coche; // la case ne change qu'une fois le service d'accord
    if (coche) confirmerMajeure();
    else enregistrerMajeure(false);
  });
  zone.querySelector('[data-nv-lancer]')?.addEventListener('click', () => confirmer({ simulation: false }));
  zone.querySelector('[data-nv-simuler]')?.addEventListener('click', () => confirmer({ simulation: true }));
  zone.querySelector('[data-nv-copier]')?.addEventListener('click', () => confirmerLaCopie());
  zone.querySelector('[data-nv-liberer]')?.addEventListener('click', async (e) => {
    try {
      // le lot affiché : si un autre lancement a eu lieu entre-temps (autre onglet), le service refuse (409) au lieu de l'annuler
      await appel('POST', 'mise-a-jour/liberer/', { lot: e.currentTarget.dataset.lot });
      await charger();
    } catch (e) {
      alert(e.message);
    }
  });
  zone.querySelector('[data-nv-voir-prod]')?.addEventListener('change', (e) => {
    zone.querySelector('.nv-dev__liste').hidden = e.target.checked;
    zone.querySelector('.nv-dev__note').hidden = e.target.checked;
    if (e.target.checked) {
      sectionDesConflits().hidden = true;
      sectionDesLots().hidden = true;
    } else {
      rendreLesLots();
      rendreLesConflits();
    }
    racine.querySelector('[data-nv-production]').scrollIntoView({ behavior: 'smooth' });
  });
}

/**
 * Enregistre la case « Version majeure » (POST /api/mise-a-jour/majeure/ : le service rend la note en préparation, à sa nouvelle version cible),
 * puis refait la partie du site de dev en gardant le texte en cours de saisie, pas encore enregistré.
 */
async function enregistrerMajeure(majeure) {
  try {
    Object.assign(donnees, await appel('POST', 'mise-a-jour/majeure/', { majeure }));
  } catch (e) {
    alert(e.message);
    if (e.statut === 409) await charger().catch(() => {}); // un lot figé depuis un autre onglet : la page le montre
    return;
  }
  const champ = racine.querySelector('[data-nv-texte]');
  const saisie = champ ? { valeur: champ.value, etat: racine.querySelector('[data-nv-etat-texte]')?.textContent ?? '' } : null;
  rendre();
  const nouveau = racine.querySelector('[data-nv-texte]');
  if (saisie && nouveau && saisie.valeur !== nouveau.value) {
    nouveau.value = saisie.valeur;
    nouveau.dispatchEvent(new Event('input')); // aperçu refait, « modifié, non enregistré »
  } else if (saisie?.etat) {
    const etat = racine.querySelector('[data-nv-etat-texte]');
    if (etat) etat.textContent = saisie.etat;
  }
}

/** Confirmation de la case « Version majeure » (demande du propriétaire) : ce qu'elle change, et qu'elle ne lance rien. */
function confirmerMajeure() {
  const dialogue = document.createElement('dialog');
  dialogue.className = 'nv-dialogue';
  dialogue.innerHTML = `<form method="dialog">
    <h2>Version majeure V${echapper(donnees.version_majeure)}</h2>
    <p>La prochaine mise à jour sera la <strong>V${echapper(donnees.version_majeure)}</strong> au lieu de la V${echapper(donnees.version_mineure ?? '?')} :
    sa livraison dev → master portera le marqueur de version majeure <code>[V: X+1]</code>, et la production comme dev passeront en
    V${echapper(donnees.version_majeure)}.0.</p>
    <p>Cocher la case <strong>ne lance rien</strong> : la mise à jour ne part qu’avec « Effectuer la mise à jour », et la case se décoche tant
    qu’elle n’est pas partie.</p>
    <p class="nv-message nv-message--erreur" data-erreur hidden></p>
    <div class="nv-dev__actions"><button type="button" value="annuler">Annuler</button><button type="submit" class="nv-principal">Passer en version majeure</button></div>
  </form>`;
  racine.append(dialogue);
  dialogue.querySelector('[value="annuler"]').addEventListener('click', () => dialogue.close());
  dialogue.addEventListener('close', () => dialogue.remove());
  dialogue.querySelector('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    dialogue.close();
    await enregistrerMajeure(true);
  });
  dialogue.showModal();
}

/**
 * Confirmation. La vraie mise à jour : ce qu'elle fait, et le mot à taper. La simulation (rien n'est poussé) : une confirmation simple, le service
 * recevant le même mot (il le demande à tout lancement).
 */
function confirmer({ simulation }) {
  const champ = racine.querySelector('[data-nv-texte]');
  if (champ && champ.value !== (donnees.brouillon?.texte ?? '') && !window.confirm('Le texte n’est pas enregistré : continuer sans lui ?')) return;
  const mot = donnees.confirmation;
  const n = donnees.en_attente ?? 0;
  const modifications = `${n} ligne${n > 1 ? 's' : ''} de la base en attente`;
  const majeure = !donnees.brouillon?.majeure ? ''
    : simulation
      ? `<p><strong>Version majeure</strong> (case cochée) : la livraison dev → master porterait <code>[V: X+1]</code>, la production et dev passeraient en V${echapper(donnees.version_cible)}.0.</p>`
      : `<p><strong>Version majeure</strong> (case cochée) : la livraison dev → master porte <code>[V: X+1]</code>, la production et dev passent en V${echapper(donnees.version_cible)}.0.</p>`;
  const dialogue = document.createElement('dialog');
  dialogue.className = 'nv-dialogue';
  dialogue.innerHTML = simulation
    ? `<form method="dialog">
    <h2>Simulation de mise à jour V${echapper(donnees.version_cible)}</h2>
    <p>GitHub fait tout le travail de la mise à jour (${modifications}) : branche à jour de dev, modifications rejouées, note de version écrite,
    contrôle des tables, <code>db:check</code>, tous les tests, la construction du site (et sa version de test, l’installateur, la version
    portable), puis un essai de poussée avec le jeton du dépôt. Il s’arrête là : <strong>rien n’est poussé</strong>, ni PR, ni fusion, ni livraison.
    Seuls les droits d’ouvrir et de fusionner une PR ne peuvent pas être essayés sans effet.</p>
    ${majeure}
    <p class="nv-message nv-message--erreur" data-erreur hidden></p>
    <div class="nv-dev__actions"><button type="button" value="annuler">Annuler</button><button type="submit" class="nv-principal">Lancer la simulation</button></div>
  </form>`
    : `<form method="dialog">
    <h2>Effectuer la mise à jour V${echapper(donnees.version_cible)}</h2>
    <p>Les modifications du site de dev (${modifications}) et la note de version partent sur GitHub : une branche à jour de dev, une PR qui
    apporte la base modifiée, fusionnée automatiquement si les tests passent et qu’il n’y a aucun conflit, puis la <strong>livraison dev → master</strong> (production).</p>
    ${majeure}
    <p>Pendant ce temps, <strong>les deux sites (production et dev) affichent « Maintenance en cours »</strong> ; chacun rouvre de lui-même dès que la
    nouvelle version y est installée (ou si la mise à jour s’arrête avant).</p>
    <p>Pour confirmer, tapez <strong>${echapper(mot)}</strong> :</p>
    <input name="mot" autocomplete="off" required>
    <p class="nv-message nv-message--erreur" data-erreur hidden></p>
    <div class="nv-dev__actions"><button type="button" value="annuler">Annuler</button><button type="submit" class="nv-principal">Effectuer la mise à jour</button></div>
  </form>`;
  racine.append(dialogue);
  const erreur = dialogue.querySelector('[data-erreur]');
  dialogue.querySelector('[value="annuler"]').addEventListener('click', () => dialogue.close());
  dialogue.addEventListener('close', () => dialogue.remove());
  dialogue.querySelector('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const saisi = simulation ? mot : dialogue.querySelector('input').value.trim();
    if (saisi !== mot) {
      erreur.textContent = `Tapez exactement « ${mot} ».`;
      erreur.hidden = false;
      return;
    }
    try {
      // la version montrée dans ce dialogue : le service refuse (409) si une autre partirait (case changée depuis un autre onglet)
      await appel('POST', 'mise-a-jour/lancer/', { confirmation: saisi, simulation, version_cible: donnees.version_cible });
      dialogue.close();
      if (!simulation && (await enMaintenance())) {
        location.replace(`${racine.dataset.maintenance}?retour=${encodeURIComponent(location.pathname)}`);
        return;
      }
      await charger(); // le brouillon est maintenant figé (lot) : texte et boutons verrouillés jusqu'à la fin
    } catch (err) {
      direLErreur(erreur, err);
    }
  });
  dialogue.showModal();
}

/**
 * Dit l'erreur d'un lancement dans le dialogue (`erreur` : son `<p data-erreur>`). Un refus avant l'envoi (409 avec `refus` : l'attestation de la production,
 * le seul depuis R280) se dit par le message du service, en une phrase ; toute autre erreur garde le message du service.
 */
function direLErreur(erreur, err) {
  const refus = messageDuRefus(err.corps?.refus);
  erreur.textContent = refus ? refus.texte : err.message;
  erreur.hidden = false;
}

/**
 * « Copier vers le dépôt » (base source seulement) : ce que fait la copie, et le mot à taper (`confirmation_copie`). Le service fige un paquet du contenu du
 * site de dev et GitHub le fusionne dans dev ; aucune maintenance, aucune livraison, aucune version.
 */
function confirmerLaCopie() {
  const mot = motDeLaCopie(donnees);
  if (!mot) return;
  const dialogue = document.createElement('dialog');
  dialogue.className = 'nv-dialogue';
  dialogue.innerHTML = `<form method="dialog">
    <h2>Copier vers le dépôt</h2>
    <p>${echapper(PHRASE_DE_LA_COPIE)} Les pages sont refaites dans la branche dev du dépôt (une PR, fusionnée automatiquement si les tests passent) ; le contenu
    copié part en production avec la prochaine mise à jour. Les modifications du site de dev restent en attente : une copie n’écrit ni note de version ni version.</p>
    <p>Pour confirmer, tapez <strong>${echapper(mot)}</strong> :</p>
    <input name="mot" autocomplete="off" required>
    <p class="nv-message nv-message--erreur" data-erreur hidden></p>
    <div class="nv-dev__actions"><button type="button" value="annuler">Annuler</button><button type="submit" class="nv-principal">Copier vers le dépôt</button></div>
  </form>`;
  racine.append(dialogue);
  const erreur = dialogue.querySelector('[data-erreur]');
  dialogue.querySelector('[value="annuler"]').addEventListener('click', () => dialogue.close());
  dialogue.addEventListener('close', () => dialogue.remove());
  dialogue.querySelector('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const saisi = dialogue.querySelector('input').value.trim();
    if (saisi !== mot) {
      erreur.textContent = `Tapez exactement « ${mot} ».`;
      erreur.hidden = false;
      return;
    }
    try {
      await appel('POST', 'mise-a-jour/copier/', { confirmation: saisi });
      dialogue.close();
      await charger(); // le lancement de la copie est affiché et suivi ; le texte libre reste libre (rien n'est figé pour une copie)
    } catch (err) {
      direLErreur(erreur, err);
    }
  });
  dialogue.showModal();
}

/** Suit le lancement tant qu'il est en cours (le service interroge GitHub au plus toutes les 20 s). */
function suivre() {
  clearInterval(suivi);
  suivi = setInterval(async () => {
    try {
      const r = await appel('GET', 'mise-a-jour/lancement/');
      const change = JSON.stringify(r.lancement) !== JSON.stringify(donnees.lancement) || r.liberable !== donnees.liberable || r.occupe !== donnees.occupe;
      donnees.lancement = r.lancement;
      donnees.liberable = r.liberable;
      donnees.occupe = r.occupe;
      if (!SUIVIS.includes(r.lancement?.etat)) {
        clearInterval(suivi);
        await charger(); // fini : le brouillon a pu être libéré (simulation, échec) ; tout est relu
      } else if (change) rendre();
    } catch {
      // service relancé (nouvelle version livrée) : on réessaiera
    }
  }, 15000);
}

/** Ce serveur est-il en maintenance (vraie mise à jour lancée) ? Sans jeton GitHub (lancement à la main), non : la page garde ses valeurs. */
async function enMaintenance() {
  try {
    return (await appel('GET', 'maintenance/'))?.active === true;
  } catch {
    return false;
  }
}

async function charger() {
  donnees = await appel('GET', 'mise-a-jour/');
  rendre();
  if (SUIVIS.includes(donnees.lancement?.etat)) suivre();
  await chargerLesConflits().catch((e) => {
    conflits.reponse = null;
    conflits.erreur = `Les lignes en conflit n’ont pas pu être lues : ${e.message}`;
    rendreLesConflits();
  });
  await chargerLesLots();
}

async function lancer() {
  if (!racine) return;
  try {
    const etat = await appel('GET', 'etat/');
    if (!etat?.edition) return; // production : la page construite suffit
    await charger();
  } catch {
    // service absent (site statique seul) : la note de production reste
  }
}

lancer();
