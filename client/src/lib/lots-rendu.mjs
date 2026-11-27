// Les changements de l'équipe sur la page « Mise à jour » du site de dev (chantier « la base du site de dev devient la source de vérité », R274, R275 ;
// R291 : « En gros c'est le patchnote mais où je peux choisir chaque ligne que je peux annuler. […] Juste un bout "annuler cette modification" sur chaque ligne
// du patchnote. » puis « Il n'y aura pas à confirmer une modification ni de mofication en attente ou quoi que ce soit. juste le bouton de suppression (qui lui
// devra être confirmé) »). Une session dépose avec la clé de dépôt : la modification est appliquée aussitôt, sans clic. La page la montre comme les notes de
// version, ligne par ligne (la table et la ligne par leur nom, l'avant et l'après), et chaque ligne qui s'annule seule porte « Annuler cette modification » ;
// un clic ouvre une confirmation avec l'aperçu de ce que l'annulation remettrait (refus de la porte : scripts/acces.mjs le dit). Une ligne qui ne s'annule
// pas seule dit pourquoi. Les propositions déposées avant R291, ou tant que la clé de dépôt n'est pas posée (état « propose »), gardent leur aperçu et leurs
// boutons « Appliquer » / « Refuser » dans un bloc à part, qui n'apparaît que s'il en reste ; les dépôts refusés laissent une trace discrète (titre, motifs).
// Le service (GET /api/edition/lots/…, serveur/edition-lots.mjs) rend les noms : la table et la ligne par leur nom, chaque colonne par son libellé ; ce module
// n'écrit aucun nom de table ni de colonne et n'importe ni lib/edition-modele.mjs ni lib/libelles-de-la-base.mjs (skill site-version-portable : le script de la
// page les ignore). Un mot technique (« lot », « nature », « opération », JSON) ne se lit nulle part : une origine dite en mots (« décision R275 », « un
// changement du code »), une ligne dite par son nom, une valeur par `texteDeValeur` (jamais en JSON).
// Fonctions pures (chaîne HTML en sortie, tout texte échappé, jamais de HTML reçu posé), sans dépendance hors lib/conflits-rendu.mjs, lib/diff-replie.mjs
// et lib/notes-de-version-rendu.mjs ; seul le script de la page (src/scripts/mise-a-jour.mjs) importe ce module (version portable : jamais deux scripts).
// La section ne montre que ce qui change par rapport à la production (demande du propriétaire du 2026-11-21 : « Je ne dois voir ici QUE la liste de ce qui change
// par rapport à la prod, car sert pour le patch note. ») : un changement ou une ligne qui vaut déjà la production n'y est plus (`ecart_production` du service ;
// sans référence, rien n'est retiré), ni les refusés et les annulés. Une liste coupe à PLAFOND_DES_LIGNES lignes (un bouton montre le reste).
import { instantLisible, texteDeValeur } from './conflits-rendu.mjs';
import { replierLeDiff } from './diff-replie.mjs';
import { estUnLotDAncrage } from './lots-d-ancrage.mjs';
import { diffMots, echapper } from './notes-de-version-rendu.mjs';

/**
 * Le changement vient-il de l'action « Préparer l'ancrage » (R309 : sa décision et son auteur, lib/lots-d-ancrage.mjs) ? Ses changements se replient (htmlDuLot) : son
 * détail ne se lit qu'à l'ouverture de son repli (la page : `<id>:lot` dans `ouverts`).
 */
export { estUnLotDAncrage };
/** Les lignes d'un aperçu montrées d'abord ; « Tout montrer » donne le reste. */
export const PLAFOND_DES_LIGNES = 30;
/** Au-delà, deux textes se montrent par leurs différences. */
const LIMITE_DU_DIFF = 200;
/** Une valeur citée dans une phrase est coupée à ce nombre de caractères. */
const LIMITE_D_UNE_CITATION = 160;

const pluriel = (n, un, plusieurs) => `${n} ${n > 1 ? plusieurs : un}`;
/** « sa valeur » pour une ligne, « leur valeur » pour plusieurs. */
const saValeur = (n) => (n > 1 ? 'leur valeur' : 'sa valeur');
const court = (t) => (t.length > LIMITE_D_UNE_CITATION ? `${t.slice(0, LIMITE_D_UNE_CITATION)}…` : t);
const citation = (v) => `« ${court(texteDeValeur(v))} »`;
const jour = (iso) => (iso ? instantLisible(iso) : '');

/** Les lots appliqués qui changent encore quelque chose par rapport à la production, le plus récemment appliqué d'abord. */
export const lotsAppliques = (lots) => (lots ?? []).filter((l) => l.etat === 'applique' && l.ecart_production !== false)
  .sort((a, b) => String(b.decide_le ?? '').localeCompare(String(a.decide_le ?? '')));
/** Les lignes d'un lot appliqué qui diffèrent de la production. */
const lignesEnEcart = (lot) => lot.lignes.filter((l) => l.ecart_production !== false);

/** D'où vient le lot, en mots simples ; null pour une origine qu'on ne sait pas dire. */
export function origineDuLot(lot) {
  switch (lot?.nature) {
    case 'decision': return lot.decision ? `décision ${lot.decision}` : 'une décision';
    case 'code': return 'un changement du code';
    case 'source': return 'une source';
    case 'migration': return 'une migration';
    default: return null;
  }
}

/** « Déposé le 12 novembre 2026 à 11:00 · préparé par X · origine : décision R275 » (les morceaux absents sont omis ; `sansDepot` : sans la date du dépôt, déjà dite par l'application aussitôt). */
export function ligneDeLOrigine(lot, { sansDepot = false } = {}) {
  const origine = origineDuLot(lot);
  const date = sansDepot ? '' : jour(lot?.depose_le);
  return [date ? `Déposé le ${date}` : null, lot?.auteur ? `préparé par ${lot.auteur}` : null, origine ? `origine : ${origine}` : null].filter(Boolean).join(' · ');
}

/** Les décisions que l'essai d'un lot demande d'ouvrir (« R218 »…). */
export const verrousDuLot = (lot) => [...(lot?.essai?.verrous_a_ouvrir ?? [])];

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Ce que dit l'essai et ce que dit l'aperçu d'une annulation
// ---------------------------------------------------------------------------------------------------------------------------------------------

/** Le nombre de valeurs (colonnes) qui ont changé depuis, d'après les opérations d'un essai ; une opération sans détail compte pour une. */
function valeursChangees(operations) {
  return (operations ?? []).filter((o) => o.etat === 'changee').reduce((n, o) => n + (o.ecarts?.length || 1), 0);
}

/** Ce qui est à corriger dans un essai, une chose par ligne de texte (opération refusée, refus global, problème du contenu né du lot). */
function problemesDeLEssai(essai) {
  return [
    ...(essai?.operations ?? []).filter((o) => o.etat === 'refusee').map((o) => `ligne ${o.rang} du lot : ${o.message ?? 'refusée'}`),
    ...(essai?.refus_de_l_application ? [String(essai.refus_de_l_application)] : []),
    ...(essai?.problemes_nouveaux ?? []).slice(0, 5).map((p) => `contrôle du contenu : ${p}`),
  ];
}

/**
 * Le résultat de l'essai d'un lot en une phrase : { niveau, verdict, texte, lignes } ; `niveau` : `pret`, `accord` (prêt avec les décisions à ouvrir),
 * `attention`, `erreur`, `attente` (pas d'essai valide) ; `lignes` : ce qui est à corriger, une chose par ligne.
 */
export function phraseDeLEssai(lot) {
  const essai = lot?.essai ?? null;
  const verdict = essai?.verdict ?? null;
  const comptes = essai?.comptes ?? {};
  const aEcrire = (comptes.applicables ?? 0) + (comptes.verrouillees ?? 0);
  const valeurs = valeursChangees(essai?.operations);
  const changees = valeurs ? `${valeurs > 1 ? `${valeurs} valeurs ont changé depuis : elles ne seront pas écrites` : '1 valeur a changé depuis : elle ne sera pas écrite'}` : '';
  const ecrites = pluriel(aEcrire, 'ligne sera écrite', 'lignes seront écrites');
  const verrous = verrousDuLot(lot);
  if (!essai || !verdict) return { niveau: 'attente', verdict: null, texte: 'L’essai n’est pas encore fait : refaites-le.', lignes: [] };
  if (verdict === 'en_echec') return { niveau: 'erreur', verdict, texte: 'L’essai n’a pas pu se faire : refaites-le.', lignes: essai.erreur ? [String(essai.erreur)] : [] };
  if (verdict === 'a_corriger') return { niveau: 'erreur', verdict, texte: 'À corriger avant d’appliquer :', lignes: problemesDeLEssai(essai) };
  if (verdict === 'rien_a_ecrire') {
    return { niveau: 'attention', verdict, valeurs, texte: `Rien à écrire : tout est déjà comme le lot le demande, ou a changé depuis${changees ? ` (${changees})` : ''}.`, lignes: [] };
  }
  if (verdict === 'verrous') {
    // sans liste de décisions (réponse incomplète), la phrase ne cite aucun numéro
    const qui = !verrous.length ? 'une décision verrouille' : verrous.length > 1 ? `les décisions ${verrous.join(', ')} verrouillent` : `la décision ${verrous[0]} verrouille`;
    return { niveau: 'accord', verdict, valeurs, texte: `Prêt, avec votre accord : ${ecrites}, mais ${qui} une partie${changees ? ` ; ${changees}` : ''}.`, lignes: [] };
  }
  return { niveau: 'pret', verdict, valeurs, texte: `Prêt : ${ecrites}${changees ? ` ; ${changees}` : ''}.`, lignes: [] };
}

/** L'aperçu d'une annulation (d'une modification, d'une ligne) en une phrase : { niveau, verdict, texte, lignes }. */
export function phraseDeLAnnulation(apercu) {
  const verdict = apercu?.verdict ?? null;
  const c = apercu?.comptes ?? {};
  if (verdict === 'refusee') {
    const lignes = [
      ...(apercu.operations ?? []).filter((o) => o.etat === 'refusee').map((o) => `${o.apercu ? `${o.apercu.ligne} (${o.apercu.table})` : `ligne ${o.rang}`} : ${o.message ?? 'refusée'}`),
      ...(apercu.refus_de_l_annulation ? [String(apercu.refus_de_l_annulation)] : []),
      ...(apercu.problemes_nouveaux ?? []).slice(0, 5).map((p) => `contrôle du contenu : ${p}`),
    ];
    return { niveau: 'erreur', verdict, texte: 'L’annulation est impossible pour l’instant :', lignes };
  }
  if (verdict === 'rien_a_remettre') {
    return { niveau: 'attention', verdict, texte: 'Rien à remettre : chaque valeur a changé depuis ou est déjà comme avant. La modification reste en place.', lignes: [] };
  }
  const aRemettre = (c.remises ?? 0) + (c.verrouillees ?? 0);
  const parts = [
    `${pluriel(aRemettre, 'ligne sera remise', 'lignes seront remises')} comme avant`,
    c.deja ? `${pluriel(c.deja, 'ligne est', 'lignes sont')} déjà comme avant` : null,
    c.gardees ? `${pluriel(c.gardees, 'ligne est gardée', 'lignes sont gardées')} parce que ${saValeur(c.gardees)} a changé depuis` : null,
  ].filter(Boolean);
  return { niveau: verdict === 'verrous' ? 'accord' : 'pret', verdict, texte: `${parts.join(' ; ')}.`, lignes: [] };
}

/** Peut-on appliquer ? Le verdict le permet et chaque décision à ouvrir est cochée : { possible, raison } (`raison` : ce qui manque, sinon null). */
export function peutAppliquer(lot, coches = new Set()) {
  const v = lot?.essai?.verdict ?? null;
  if (lot?.etat !== 'propose') return { possible: false, raison: 'Ce lot n’attend plus de clic.' };
  if (v === 'a_corriger') return { possible: false, raison: 'Il y a des choses à corriger : le lot ne peut pas être appliqué tel quel.' };
  if (v === 'rien_a_ecrire') return { possible: false, raison: 'Il n’y a rien à écrire.' };
  if (v !== 'applicable' && v !== 'verrous') return { possible: false, raison: 'Refaites l’essai avant d’appliquer.' };
  if (verrousDuLot(lot).some((d) => !coches.has(d))) return { possible: false, raison: 'Cochez la case ci-dessus pour accepter d’ouvrir ce que la décision verrouille.' };
  return { possible: true, raison: null };
}

/** Peut-on annuler ? Même règle, sur l'aperçu de l'annulation. */
export function peutAnnuler(apercu, coches = new Set()) {
  const v = apercu?.verdict ?? null;
  if (v === 'refusee') return { possible: false, raison: 'L’annulation est impossible pour l’instant.' };
  if (v === 'rien_a_remettre') return { possible: false, raison: 'Il n’y a rien à remettre.' };
  if (v !== 'applicable' && v !== 'verrous') return { possible: false, raison: 'L’aperçu de l’annulation manque.' };
  if ((apercu.verrous_a_ouvrir ?? []).some((d) => !coches.has(d))) return { possible: false, raison: 'Cochez la case ci-dessus pour accepter d’ouvrir ce que la décision verrouille.' };
  return { possible: true, raison: null };
}

/** Le corps d'un clic (`appliquer` ou `annuler`) : les décisions que le propriétaire a cochées, parmi celles que le service demande. */
export const corpsDuClic = (verrous, coches = new Set()) => ({ verrous_ouverts: [...verrous].filter((d) => coches.has(d)) });

// ---------------------------------------------------------------------------------------------------------------------------------------------
// L'aperçu avant et après
// ---------------------------------------------------------------------------------------------------------------------------------------------

/** Ce que dit chaque état d'une ligne, selon ce qu'on regarde : l'essai d'un lot, son bilan, l'aperçu de son annulation. */
const ETATS_DE_LA_LIGNE = Object.freeze({
  essai: { applicable: 'sera écrite', changee: 'ne sera pas écrite : elle a changé depuis', verrouillee: 'verrouillée : à ouvrir avec votre accord', refusee: 'à corriger' },
  bilan: { ecrite: 'écrite', changee: 'gardée : elle avait changé depuis', verrouillee: 'verrouillée', refusee: 'refusée' },
  annulation: { remise: 'sera remise comme avant', deja: 'est déjà comme avant', gardee: 'sera gardée : elle a changé depuis', verrouillee: 'verrouillée : à ouvrir avec votre accord', refusee: 'à corriger' },
});
const NIVEAUX_DE_LA_LIGNE = Object.freeze({ applicable: 'ok', ecrite: 'ok', remise: 'ok', changee: 'garde', gardee: 'garde', deja: 'neutre', verrouillee: 'accord', refusee: 'erreur' });
/** Ce que la ligne devient, pour une création ou un retrait (la modification d'une valeur ne dit rien de plus). */
const GENRES = Object.freeze({
  essai: { inserer: 'nouvelle ligne', supprimer: 'ligne retirée' },
  bilan: { inserer: 'nouvelle ligne', supprimer: 'ligne retirée' },
  annulation: { inserer: 'ligne créée par le lot, retirée par l’annulation', supprimer: 'ligne retirée par le lot, remise par l’annulation' },
});

/** Le libellé d'une colonne d'une ligne d'aperçu (celui du service) ; son nom brut, jamais montré en pratique, sinon. */
const libelleDeLaColonne = (o, colonne) => o?.apercu?.colonnes?.find((c) => c.colonne === colonne)?.libelle ?? colonne;

/** Un morceau du diff replié : « egal » tel quel, « retire » barré (l'avant), « ajoute » en gras (l'après), « replie » fermé. */
function htmlDuMorceau(m) {
  if (m.type === 'egal') return echapper(m.texte);
  if (m.type === 'retire') return `<del>${echapper(m.texte)}</del>`;
  if (m.type === 'ajoute') return `<ins>${echapper(m.texte)}</ins>`;
  const resume = m.lignes > 1 ? `… ${m.lignes} lignes identiques …` : '… passage identique …';
  return `<details class="nv-diff__replie"><summary>${resume}</summary>${echapper(m.texte)}</details>`;
}

/** Une colonne d'une ligne d'aperçu : son libellé, la valeur d'avant et celle d'après (deux longs textes : seulement leurs différences, les deux en entier à la demande). */
function htmlDeLaColonne(c, titres) {
  const avant = texteDeValeur(c.avant);
  const apres = texteDeValeur(c.apres);
  const version = (n, titre, texte) => `<div class="nv-version nv-version--${n}"><h5 class="nv-version__titre">${echapper(titre)}</h5><div class="nv-version__texte">${echapper(texte)}</div></div>`;
  const versions = `<div class="nv-conflit__versions">${version(1, titres.avant, avant)}${version(2, titres.apres, apres)}</div>`;
  const deuxTextes = typeof c.avant === 'string' && typeof c.apres === 'string' && c.avant !== c.apres && (avant.length > LIMITE_DU_DIFF || apres.length > LIMITE_DU_DIFF);
  const morceaux = deuxTextes ? replierLeDiff(diffMots(c.avant, c.apres)) : null;
  const corps = morceaux
    ? `<p class="nv-diff__legende"><ins>en gras</ins> : ce qui s’ajoute ; <del>barré</del> : ce qui disparaît ; le reste est identique.</p><div class="nv-diff">${morceaux.map(htmlDuMorceau).join('')}</div>`
      + `<details class="nv-conflit__entieres"><summary>Voir les deux textes en entier</summary>${versions}</details>`
    : versions;
  const tronque = c.tronquee ? '<p class="nv-conflit__aide">Texte long : seul son début est montré.</p>' : '';
  return `<div class="nv-lot-colonne" data-nv-colonne="${echapper(c.colonne)}"><p class="nv-lot-colonne__nom">${echapper(c.libelle ?? c.colonne)}</p>${corps}${tronque}</div>`;
}

/** Ce qu'un écart dit d'une colonne : « Nom : le site vaut maintenant « X » (le lot attendait « Y ») » (essai, bilan) ; « Nom : la valeur trouvée est « X » » (annulation). */
function phraseDeLEcart(o, e, contexte) {
  const nom = libelleDeLaColonne(o, e.colonne);
  if (contexte === 'annulation') return `${nom} : la valeur trouvée est ${citation(e.trouvee)} (le lot avait écrit ${citation(e.ecrite)})`;
  return `${nom} : le site vaut maintenant ${citation(e.actuelle)} (le lot attendait ${citation(e.attendue)})`;
}

/** Une ligne de la base dans un aperçu : son nom, son état, ses colonnes avant et après. */
function htmlDeLaLigne(o, contexte, titres) {
  const ap = o.apercu ?? null;
  const etat = o.etat;
  const mot = ETATS_DE_LA_LIGNE[contexte]?.[etat] ?? etat;
  const genre = GENRES[contexte]?.[o.operation ?? o.genre];
  const nom = ap ? `<strong>${echapper(ap.ligne)}</strong> <span class="nv-lot-ligne__table">(${echapper(ap.table)})</span>` : `<strong>ligne ${echapper(o.rang)} du lot</strong>`;
  const decisions = o.decisions?.length ? ` : ${echapper(o.decisions.join(', '))}` : '';
  const ecarts = (o.ecarts ?? []).length ? `<ul class="nv-lot-ligne__ecarts">${o.ecarts.map((e) => `<li>${echapper(phraseDeLEcart(o, e, contexte))}</li>`).join('')}</ul>` : '';
  const message = o.message && (etat === 'refusee' || etat === 'verrouillee' || etat === 'gardee') ? `<p class="nv-lot-ligne__message">${echapper(o.message)}</p>` : '';
  // une ligne qui ne s'écrit pas (changée depuis, déjà comme avant) ne montre pas ses colonnes : ce qui compte est ce qu'elle porte aujourd'hui
  const colonnes = ap && etat !== 'deja' && etat !== 'gardee' && etat !== 'changee' ? ap.colonnes.map((c) => htmlDeLaColonne(c, titres)).join('') : '';
  return `<li class="nv-lot-ligne nv-lot-ligne--${NIVEAUX_DE_LA_LIGNE[etat] ?? 'neutre'}" data-nv-ligne="${echapper(o.rang)}" data-nv-etat-ligne="${echapper(etat)}">`
    + `<p class="nv-lot-ligne__nom">${nom} <span class="nv-lot-ligne__etat">${echapper(`${genre ? `${genre} · ` : ''}${mot}`)}${decisions}</span></p>${message}${ecarts}${colonnes}</li>`;
}

/**
 * L'aperçu avant et après d'un lot : par ligne de la base, son nom, ce qui lui arrive, et pour chaque colonne la valeur d'avant et celle d'après. Au plus
 * `plafond` lignes d'abord (`toutes` : toutes) ; `cle` nomme le bouton « Tout montrer ».
 * @param {object[]} operations les opérations d'un essai, d'un bilan ou d'un aperçu d'annulation (`apercu`, `etat`, `ecarts`…)
 * @param {{ contexte?: 'essai' | 'bilan' | 'annulation', plafond?: number, toutes?: boolean, cle?: string, titres?: { avant: string, apres: string } }} [o]
 */
export function htmlDeLApercu(operations, { contexte = 'essai', plafond = PLAFOND_DES_LIGNES, toutes = false, cle = '', titres = { avant: 'Avant', apres: 'Après' } } = {}) {
  const ops = operations ?? [];
  if (!ops.length) return '<p class="nv-conflit__aide">Aucune ligne.</p>';
  const montrees = toutes ? ops : ops.slice(0, plafond);
  const reste = ops.length - montrees.length;
  const suite = reste > 0
    ? `<p class="nv-conflit__aide">… et ${echapper(pluriel(reste, 'autre ligne', 'autres lignes'))}. <button type="button" data-nv-toutes="${echapper(cle)}">Tout montrer</button></p>` : '';
  return `<ul class="nv-lot-lignes">${montrees.map((o) => htmlDeLaLigne(o, contexte, titres)).join('')}</ul>${suite}`;
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Les lots
// ---------------------------------------------------------------------------------------------------------------------------------------------

/** Une phrase du service ou de ce module, avec ses lignes de détail : <p> puis <ul>. */
function htmlDeLaPhrase({ niveau, verdict, texte, lignes }, attribut) {
  const liste = lignes?.length ? `<ul class="nv-lot__problemes">${lignes.map((l) => `<li>${echapper(l)}</li>`).join('')}</ul>` : '';
  return `<div class="nv-lot__essai nv-lot__essai--${echapper(niveau)}" ${attribut}="${echapper(verdict ?? 'aucun')}"><p>${echapper(texte)}</p>${liste}</div>`;
}

/** Une case par décision à ouvrir : « J'accepte d'ouvrir ce que la décision R218 verrouille ». */
function htmlDesVerrous(verrous, coches) {
  if (!verrous.length) return '';
  return `<div class="nv-lot__verrous">${verrous.map((d) => `<label class="nv-lot__verrou"><input type="checkbox" data-nv-verrou="${echapper(d)}" ${coches.has(d) ? 'checked' : ''}> `
    + `J’accepte d’ouvrir ce que la décision ${echapper(d)} verrouille</label>`).join('')}</div>`;
}

/** Un lot est replié ou non d'un rendu à l'autre : la page garde ce que le propriétaire a ouvert (`ouverts` : clés `<lot>:<zone>`). */
const ouvert = (vue, id, zone) => (vue.ouverts?.has(`${id}:${zone}`) ? ' open' : '');

/** Le message d'un lot ou d'une ligne (une erreur d'un clic, l'état d'une demande) : `{ texte, erreur, lignes }` posé par la page. */
function htmlDuMessage(m, attribut = 'data-nv-lot-message') {
  if (!m) return `<p class="nv-message" ${attribut} hidden></p>`;
  const liste = m.lignes?.length ? `<ul class="nv-lot__problemes">${m.lignes.map((l) => `<li>${echapper(l)}</li>`).join('')}</ul>` : '';
  return `<div class="nv-message${m.erreur ? ' nv-message--erreur' : ''}" ${attribut} role="${m.erreur ? 'alert' : 'status'}"><p>${echapper(m.texte)}</p>${liste}</div>`;
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Les lignes d'un lot appliqué : « comme les notes de version », chacune avec son bouton « Annuler cette modification » (R291)
// ---------------------------------------------------------------------------------------------------------------------------------------------

/** Ce que la ligne est devenue par la modification, pour la lire d'un coup d'œil. */
const GENRE_DE_LA_LIGNE = Object.freeze({ modifier: 'modifiée', inserer: 'nouvelle ligne', supprimer: 'ligne retirée' });
const NIVEAU_DE_L_ETAT = Object.freeze({ en_place: 'ok', annulee: 'neutre', modifiee_depuis: 'garde', comme_avant: 'neutre' });

/** Le bouton « Annuler cette modification » n'existe que pour une ligne en place que le service dit annulable seule. */
export const peutAnnulerLaLigne = (ligne) => ligne?.etat === 'en_place' && ligne?.annulable_seule === true;

/** Ce que dit l'état d'une ligne (rien de plus pour une ligne en place) : « annulée le 12 novembre 2026 », « changée depuis : le site prime », « déjà comme avant ». */
export function motDeLEtat(ligne) {
  switch (ligne?.etat) {
    case 'annulee': return ligne.annulee?.annule_le ? `annulée le ${jour(ligne.annulee.annule_le)}` : 'annulée';
    case 'modifiee_depuis': return 'changée depuis : le site prime';
    case 'comme_avant': return 'déjà comme avant';
    default: return '';
  }
}

/** Les lignes du lot qu'une ligne attend (`depend_de` : leurs numéros), dites par leur nom. */
function nomsDesLignesLiees(ligne, lot) {
  return (ligne.depend_de ?? []).map((n) => {
    const l = (lot.lignes ?? []).find((x) => x.n === n);
    return l ? `${l.ligne} (${l.table})` : 'une autre ligne du même changement';
  });
}

/** Une ligne d'un changement appliqué : son nom, son état, l'avant et l'après de chaque colonne, puis le bouton qui l'annule ou ce qui l'en empêche. */
function htmlDeLaLigneDuLot(ligne, lot, vue) {
  const etat = ligne.etat;
  const mots = [GENRE_DE_LA_LIGNE[ligne.genre], motDeLEtat(ligne)].filter(Boolean).join(' · ');
  const ecarts = (ligne.colonnes_modifiees ?? []).length
    ? `<ul class="nv-lot-ligne__ecarts">${ligne.colonnes_modifiees.map((c) => `<li>${echapper(`${c.libelle ?? c.colonne} : la valeur est maintenant ${citation(c.trouvee)} (la modification avait écrit ${citation(c.ecrite)})`)}</li>`).join('')}</ul>` : '';
  const colonnes = (ligne.colonnes ?? []).map((c) => htmlDeLaColonne(c, { avant: 'Avant', apres: 'Après' })).join('');
  const liees = nomsDesLignesLiees(ligne, lot);
  const explication = ligne.motif && etat !== 'annulee' && etat !== 'comme_avant'
    ? `<p class="nv-lot-ligne__motif" data-nv-motif>${echapper(ligne.motif)}${liees.length ? ` ${echapper(`Liée à : ${liees.join(' ; ')}.`)}` : ''}</p>` : '';
  const action = peutAnnulerLaLigne(ligne)
    ? `<div class="nv-dev__actions"><button type="button" data-nv-annuler-ligne="${echapper(ligne.n)}">Annuler cette modification</button></div>` : explication;
  return `<li class="nv-lot-ligne nv-lot-ligne--${NIVEAU_DE_L_ETAT[etat] ?? 'neutre'}" data-nv-ligne="${echapper(ligne.n)}" data-nv-etat-ligne="${echapper(etat)}" data-nv-annulable="${peutAnnulerLaLigne(ligne) ? 'oui' : 'non'}">`
    + `<p class="nv-lot-ligne__nom"><strong>${echapper(ligne.ligne)}</strong> <span class="nv-lot-ligne__table">(${echapper(ligne.table)})</span> <span class="nv-lot-ligne__etat">${echapper(mots)}</span></p>`
    + `${ecarts}${colonnes}${action}${htmlDuMessage(vue.messages?.get(`${lot.id}#${ligne.n}`) ?? null, 'data-nv-ligne-message')}</li>`;
}

/** Les lignes d'un changement appliqué, au plus `PLAFOND_DES_LIGNES` d'abord (« Tout montrer » donne le reste). */
function htmlDesLignesDuLot(lot, vue) {
  const lignes = lignesEnEcart(lot);
  if (!lignes.length) return '<p class="nv-conflit__aide">Aucune ligne.</p>';
  const cle = `${lot.id}:lignes`;
  const montrees = vue.toutes?.has(cle) ? lignes : lignes.slice(0, PLAFOND_DES_LIGNES);
  const reste = lignes.length - montrees.length;
  const suite = reste > 0 ? `<p class="nv-conflit__aide">… et ${echapper(pluriel(reste, 'autre ligne', 'autres lignes'))}. <button type="button" data-nv-toutes="${echapper(cle)}">Tout montrer</button></p>` : '';
  return `<ul class="nv-lot-lignes">${montrees.map((l) => htmlDeLaLigneDuLot(l, lot, vue)).join('')}</ul>${suite}`;
}

/** Un lot qui attend le clic du propriétaire. */
function htmlDuLotProposeAttend(lot, vue) {
  const id = lot.id;
  const coches = vue.coches?.get(id) ?? new Set();
  const { possible, raison } = peutAppliquer(lot, coches);
  const phrase = phraseDeLEssai(lot);
  const ops = lot.essai?.operations ?? [];
  const apercu = ops.length
    ? `<details class="nv-lot__apercu" data-nv-ouvert="${echapper(id)}:apercu"${ouvert(vue, id, 'apercu')}><summary>Voir ce qui change (${echapper(pluriel(ops.length, 'ligne', 'lignes'))})</summary>`
      + `${htmlDeLApercu(ops, { contexte: 'essai', toutes: vue.toutes?.has(`${id}:apercu`), cle: `${id}:apercu` })}</details>` : '';
  return `${htmlDeLaPhrase(phrase, 'data-nv-verdict')}${apercu}${htmlDesVerrous(verrousDuLot(lot), coches)}`
    + `<div class="nv-dev__actions"><button type="button" class="nv-principal" data-nv-appliquer ${possible ? '' : 'disabled'}>Appliquer</button>`
    + `<button type="button" data-nv-refuser>Refuser</button><button type="button" data-nv-essai>Refaire l’essai</button></div>`
    + `<p class="nv-conflit__aide" data-nv-raison ${possible ? 'hidden' : ''}>${echapper(raison ?? '')}</p>`;
}

/**
 * Un changement appliqué : le nombre de ses modifications, puis chacune de ses lignes avec son bouton. Sans le détail des lignes (journal indisponible : `lignes`
 * vaut null, ou le détail n'a pas pu être lu), la page le dit : rien ne s'annule sans qu'on voie ce qui change.
 */
function htmlDuLotApplique(lot) {
  if (!Array.isArray(lot.lignes)) {
    const pourquoi = lot.lignes === null && lot.lignes_indisponibles ? ` ${echapper(`(${lot.lignes_indisponibles})`)}` : '';
    return `<p class="nv-lot__bilan" data-nv-bilan-indisponible>Le détail ligne par ligne de ce changement n’est pas disponible : il ne peut pas être annulé d’ici.${pourquoi}</p>`;
  }
  const lignes = lignesEnEcart(lot);
  const annulees = lignes.filter((l) => l.etat === 'annulee').length;
  const texte = `${pluriel(lignes.length, 'modification', 'modifications')}${annulees ? `, dont ${pluriel(annulees, 'annulée', 'annulées')}` : ''}.`;
  return `<p class="nv-lot__bilan" data-nv-bilan>${echapper(texte)}</p>`;
}

/** Le corps d'un changement d'ancrage dont le détail n'est pas lu : « Lecture des lignes… », ou l'échec et « Réessayer » (seul ce bouton relance la lecture). */
function htmlDeLaLecture(lot, vue) {
  const lecture = vue.lectures?.get(lot.id);
  if (lecture?.etat === 'echec') {
    return `<div class="nv-message nv-message--erreur" role="alert" data-nv-lecture-erreur><p>${echapper(lecture.texte)}</p></div>`
      + `<div class="nv-dev__actions"><button type="button" data-nv-relire>Réessayer</button></div>`;
  }
  return lecture?.etat === 'en_cours' ? '<p class="nv-conflit__aide" data-nv-lecture>Lecture des lignes…</p>' : '';
}

/**
 * Un lot, selon son état (`propose` : attend le clic ; `applique` : ses lignes, chacune annulable seule).
 * @param {object} lot la proposition (GET /api/edition/lots/<id>/ : `essai`, `bilan`, `lignes`…, ou son résumé de la liste)
 * @param {{ coches?: Map<string, Set<string>>, messages?: Map<string, object>, ouverts?: Set<string>, toutes?: Set<string>, lectures?: Map<string, { etat: 'en_cours' | 'echec', texte?: string }> }} [vue] l'état de la page
 */
export function htmlDuLot(lot, vue = {}) {
  const decision = lot.decision ? `<span class="nv-lot__decision" data-nv-decision>${echapper(lot.decision)}</span> ` : '';
  const applique = lot.etat === 'applique';
  const direct = applique && lot.application?.directe === true;
  const quand = applique ? `Appliqué${direct ? ' aussitôt' : ''} le ${jour(lot.decide_le)}` : null;
  const meta = [quand, ligneDeLOrigine(lot, { sansDepot: direct })].filter(Boolean).join(' · ');
  const replie = estUnLotDAncrage(lot);
  // un changement d'ancrage dont le détail n'est pas encore lu (`lignes` absent) : la lecture en cours ou en échec (« Réessayer »), jamais « indisponible » ;
  // `lignes: null` : c'est le service qui dit que le détail l'est
  const nonLu = replie && applique && lot.lignes === undefined;
  const corps = lot.etat === 'propose' ? htmlDuLotProposeAttend(lot, vue)
    : nonLu ? htmlDeLaLecture(lot, vue) : `${htmlDuLotApplique(lot)}${Array.isArray(lot.lignes) ? htmlDesLignesDuLot(lot, vue) : ''}`;
  const titre = `<h4 class="nv-lot__titre">${decision}${echapper(lot.titre)}</h4>`;
  const message = htmlDuMessage(vue.messages?.get(lot.id) ?? null);
  const entete = `<article class="nv-lot nv-lot--${echapper(lot.etat)}" data-nv-lot-id="${echapper(lot.id)}" data-nv-etat="${echapper(lot.etat)}">`;
  // R309 : un changement d'ancrage porte des centaines de lignes (une par page, sort et type de sort) : replié derrière son titre et son nombre de lignes ; ses
  // lignes restent dedans, consultables, chacune avec « Annuler cette modification ». Une proposition qui attend son clic reste ouverte (ses boutons ne se cachent
  // pas) ; le message d'un clic reste dehors, lisible replié. Le nombre : celui des lignes en écart une fois le détail lu ; avant, celui de la liste
  // (`lignes_nettes`, moins les lignes annulées) ; sans l'un ni l'autre, le titre seul : aucun nombre inventé.
  if (replie) {
    const n = Array.isArray(lot.lignes) ? lignesEnEcart(lot).length
      : applique && lot.lignes === undefined && Number.isInteger(lot.lignes_nettes) ? Math.max(0, lot.lignes_nettes - (lot.lignes_annulees ?? 0)) : null;
    const nombre = n === null ? '' : ` <span class="nv-lot__compte">${echapper(pluriel(n, 'ligne', 'lignes'))}</span>`;
    return `${entete}<details class="nv-lot__repli" data-nv-ouvert="${echapper(lot.id)}:lot"${lot.etat === 'propose' || vue.ouverts?.has(`${lot.id}:lot`) ? ' open' : ''}>`
      + `<summary>${titre}${nombre}</summary><p class="nv-lot__meta">${echapper(meta)}</p>${corps}</details>${message}</article>`;
  }
  return `${entete}${titre}<p class="nv-lot__meta">${echapper(meta)}</p>${corps}${message}</article>`;
}

/**
 * La section « Modifications de l'équipe », repliée sous son titre (un <details> ; le message d'après un clic reste au-dessus) : en tête l'explication, « Tout recalculer » et « Actualiser » ; puis les propositions encore en attente (seulement
 * s'il en reste) et les changements appliqués qui diffèrent de la production (chaque ligne avec « Annuler cette modification »).
 * @param {{ lots?: object[] }} reponse les lots, la plus récente d'abord (chacun avec son détail quand la page l'a lu)
 * @param {{ coches?: Map<string, Set<string>>, messages?: Map<string, object>, ouverts?: Set<string>, toutes?: Set<string>, message?: object | null }} [vue]
 */
export function htmlDesLots({ lots = [] } = {}, vue = {}) {
  const attendent = lots.filter((l) => l.etat === 'propose');
  const appliques = lotsAppliques(lots);
  const message = vue.message ? `<div class="nv-message nv-lots__message${vue.message.erreur ? ' nv-message--erreur' : ''}" data-nv-lots-message role="${vue.message.erreur ? 'alert' : 'status'}"><p>${echapper(vue.message.texte)}</p>`
    + `${vue.message.lignes?.length ? `<ul class="nv-lot__problemes">${vue.message.lignes.map((l) => `<li>${echapper(l)}</li>`).join('')}</ul>` : ''}</div>` : '';
  // la section se replie sous son titre (demande du propriétaire : elle prenait trop de place), dans le même bloc dépliant que les domaines de la note
  // au-dessus (`nv-domaine`, lib/notes-de-version-rendu.mjs) : repliée au départ, sauf si une proposition attend son clic
  const comptes = [attendent.length ? pluriel(attendent.length, 'proposition en attente', 'propositions en attente') : null,
    appliques.length ? pluriel(appliques.length, 'changement appliqué', 'changements appliqués') : null].filter(Boolean).join(' · ');
  const resume = `<summary><h3 class="nv-domaine__entete"><span class="nv-domaine__titre">Modifications de l’équipe</span>${comptes ? ` <span class="nv-compte">${echapper(comptes)}</span>` : ''}</h3></summary>`;
  const entete = `<p class="nv-lots__intro">Ce que l’équipe a changé sur le site est appliqué tout de suite ; vous le retrouvez ici, ligne par ligne, avec la valeur d’avant et celle d’après, tant que la production ne l’a pas reçu. « Annuler cette modification » remet une ligne comme avant, après votre confirmation.</p>`
    + `<div class="nv-dev__actions"><button type="button" data-nv-recalcul>Tout recalculer</button><button type="button" data-nv-ancrage>Préparer l’ancrage</button>`
    + `${vue.ancrageAReprendre ? '<button type="button" data-nv-ancrage-reprendre>Reprendre les lignes annulées</button>' : ''}<button type="button" data-nv-lots-actualiser>Actualiser</button></div>`
    + `<p class="nv-conflit__aide">« Tout recalculer » sert après un changement de code : il recalcule les pages que le code d’aujourd’hui calcule autrement. « Préparer l’ancrage » donne un mot-clé à chaque page, sort et type de sort qui n’en a pas ; il ne refait jamais une ligne que vous avez annulée.</p>`;
  const bloc = (titre, contenu, attribut) => `<div class="nv-lots__groupe" ${attribut}><h4 class="nv-lots__sous-titre">${echapper(titre)}</h4>${contenu}</div>`;
  const attente = attendent.length
    ? bloc(`Propositions en attente (${attendent.length})`, `<p class="nv-conflit__aide">Une proposition ne change rien tant que vous n’avez pas cliqué sur « Appliquer ».</p>${attendent.map((l) => htmlDuLot(l, vue)).join('')}`, 'data-nv-lots-attente') : '';
  const faits = bloc('Changements appliqués', appliques.length ? appliques.map((l) => htmlDuLot(l, vue)).join('') : '<p class="nv-lots__aucun">Aucun changement par rapport à la production.</p>', 'data-nv-lots-appliques');
  return `${message}<details class="nv-domaine nv-lots__repli" data-nv-ouvert="section"${vue.ouverts?.has('section') || attendent.length ? ' open' : ''} data-nv-lots-repli>`
    + `${resume}<div class="nv-lots__corps">${entete}${attente}${faits}</div></details>`;
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Les messages d'après un clic
// ---------------------------------------------------------------------------------------------------------------------------------------------

/** Le message d'un lot qui vient d'être appliqué (réponse de POST …/appliquer/) : `{ texte, lignes }`. Les lignes gardées sont dites par leur nom. */
export function messageDuBilan(lot) {
  const bilan = lot?.bilan ?? {};
  const ecrites = bilan.ecrites ?? 0;
  const changees = bilan.changees ?? 0;
  const lignes = (bilan.operations ?? []).filter((o) => o.etat === 'changee').map((o) => {
    const ap = lot.essai?.operations?.find((x) => x.rang === o.rang)?.apercu ?? null;
    const nom = ap ? `${ap.ligne} (${ap.table})` : `ligne ${o.rang} du lot`;
    const ecarts = (o.ecarts ?? []).map((e) => phraseDeLEcart({ apercu: ap }, e, 'bilan')).join(' ; ');
    return ecarts ? `${nom} : ${ecarts}` : nom;
  });
  return {
    texte: `« ${lot?.titre ?? ''} » est appliqué : ${pluriel(ecrites, 'ligne écrite', 'lignes écrites')}${changees ? `, ${pluriel(changees, 'ligne gardée', 'lignes gardées')} parce que ${saValeur(changees)} avait changé depuis (le site prime)` : ''}.`,
    lignes,
  };
}

/**
 * Le message d'une modification qui vient d'être annulée (réponse de POST …/lignes/<n>/annuler/) ; `ligne` : la ligne annulée (`ligne`, `table`), `apercu` :
 * l'aperçu montré avant, qui donne les valeurs gardées parce que le site les avait changées depuis.
 */
export function messageDeLaLigneAnnulee(ligne, apercu = null) {
  const c = apercu?.comptes ?? {};
  const nom = ligne?.ligne ? `${ligne.ligne} (${ligne.table})` : 'la ligne';
  const lignes = (apercu?.operations ?? []).filter((o) => o.etat === 'gardee').map((o) => {
    const vu = o.apercu ? `${o.apercu.ligne} (${o.apercu.table})` : 'une ligne';
    const ecarts = (o.ecarts ?? []).map((e) => phraseDeLEcart(o, e, 'annulation')).join(' ; ');
    return ecarts ? `${vu} : ${ecarts}` : vu;
  });
  const parts = [
    `${pluriel((c.remises ?? 0) + (c.verrouillees ?? 0), 'ligne remise', 'lignes remises')} comme avant`,
    c.deja ? `${pluriel(c.deja, 'ligne était', 'lignes étaient')} déjà comme avant` : null,
    c.gardees ? `${pluriel(c.gardees, 'ligne gardée', 'lignes gardées')} parce que ${saValeur(c.gardees)} avait changé depuis` : null,
  ].filter(Boolean);
  return { texte: `La modification de ${nom} est annulée : ${parts.join(', ')}.`, lignes };
}

/** Le message d'après « Tout recalculer » (réponse de POST …/recalcul/) : un recalcul appliqué ou proposé, ou rien à recalculer. */
export function messageDuRecalcul(r) {
  const n = r?.recalcul?.ecarts ?? 0;
  const illisibles = r?.recalcul?.pages_illisibles ?? [];
  const reste = illisibles.length ? `${pluriel(illisibles.length, 'page n’a pas pu être examinée', 'pages n’ont pas pu être examinées')}.` : '';
  if (!r?.lot) return { texte: `Rien à recalculer : tout est déjà à jour.${reste ? ` ${reste}` : ''}`, lignes: [], erreur: false };
  const calculees = pluriel(n, 'page se calculait autrement', 'pages se calculaient autrement');
  if (r.lot.etat === 'applique') return { texte: `Recalcul appliqué : ${calculees}. Vous le retrouvez ci-dessous, ligne par ligne.${reste ? ` ${reste}` : ''}`, lignes: [], erreur: false };
  return { texte: `Une proposition est faite : ${pluriel(n, 'page se calcule autrement', 'pages se calculent autrement')}. Vérifiez-la ci-dessous, puis appliquez-la ou refusez-la.${reste ? ` ${reste}` : ''}`, lignes: [], erreur: false };
}

const LISTE_MAX_DE_L_ANCRAGE = 10;

/** Une ligne écartée de l'ancrage, dite sans son code (`page:<id>`, `nom:<id>`…). */
function phraseDeLEcartee(cle) {
  const [genre] = cle.split(':', 1);
  const quoi = cle.slice(genre.length + 1);
  return {
    page: `la page ${quoi}`, sort: `le sort ${quoi.split('#sort:').pop()}`, type_sort: `le type de sort ${quoi}`, nom: `le mot-clé n° ${quoi}, qui garde son ancien nom`,
    type: `le mot-clé n° ${quoi}, qui garde ses catégories`, categorie: `la catégorie ${quoi} (tant qu’elle manque, les créations attendent)`,
  }[genre] ?? quoi;
}

const listeCourte = (liste) => `${liste.slice(0, LISTE_MAX_DE_L_ANCRAGE).join(' ; ')}${liste.length > LISTE_MAX_DE_L_ANCRAGE ? ` ; … et ${liste.length - LISTE_MAX_DE_L_ANCRAGE} de plus` : ''}`;

/** L'état revenu sans résultat ni erreur : le service a redémarré pendant l'action. Le plan se recalcule : ce qui est déjà appliqué n'est pas refait. */
export const MESSAGE_ANCRAGE_INTERROMPU = 'Le service a redémarré pendant la préparation de l’ancrage : il suffit de la relancer, ce qui est déjà fait ne sera pas refait.';
/** Le service ne répond plus depuis trop longtemps : l'action tourne peut-être encore. */
export const MESSAGE_ANCRAGE_INJOIGNABLE = 'Le service ne répond plus : la préparation de l’ancrage continue peut-être. Rechargez la page dans quelques minutes pour la suivre.';

/**
 * Le message d'après « Préparer l'ancrage » (`resultat` de GET …/ancrage/), pour le propriétaire : ce qui est appliqué ou proposé, le motif d'un arrêt, ce qui reste à
 * trancher, les lignes annulées laissées de côté.
 * @param {{ lots?: object[], arret?: { titre: string, motif: string } | null, a_trancher?: object[], ecartees?: string[] }} r
 * @returns {string}
 */
export function messageDeLAncrage(r) {
  const lots = r?.lots ?? [];
  const appliques = lots.filter((l) => l.etat === 'applique').length;
  const aTrancher = r?.a_trancher ?? [];
  const ecartees = r?.ecartees ?? [];
  const parties = [];
  // sans clé de dépôt, le lot proposé que l'essai refuse : il ne s'applique pas, on le refuse pour relancer (ni « appliquez-la », ni « Arrêt »)
  const proposeRefuse = r?.arret ? lots.find((l) => l.etat === 'propose' && l.titre === r.arret.titre) : null;
  if (appliques) parties.push(`${pluriel(appliques, 'lot appliqué', 'lots appliqués')} : vous les retrouvez ci-dessous, ligne par ligne.`);
  if (proposeRefuse) parties.push(`La proposition « ${proposeRefuse.titre} » ne peut pas s’appliquer : ${String(r.arret.motif).trim().replace(/([^.!?…])$/, '$1.')} Refusez-la ci-dessous, puis relancez « Préparer l’ancrage ».`);
  else if (lots.some((l) => l.etat === 'propose')) parties.push('Une proposition est faite : vérifiez-la ci-dessous et appliquez-la, puis relancez « Préparer l’ancrage » pour la suite.');
  if (r?.arret && !proposeRefuse) parties.push(`Arrêt sur « ${r.arret.titre} », rien de ce lot n’est écrit : ${r.arret.motif}`);
  // des lignes annulées restent de côté : rien n'est « déjà » ancré pour elles (la phrase qui suit les liste)
  if (!lots.length && !r?.arret) parties.push(ecartees.length ? 'Rien d’autre à préparer.' : 'Rien à préparer : tout ce qui pouvait être ancré l’est déjà.');
  if (aTrancher.length) parties.push(`À trancher (${aTrancher.length}) : ${listeCourte(aTrancher.map((x) => `${x.nom} : ${x.raison}`))}.`);
  if (ecartees.length) parties.push(`Lignes annulées laissées de côté (${ecartees.length}) : ${listeCourte(ecartees.map(phraseDeLEcartee))}. « Reprendre les lignes annulées » les redépose.`);
  return parties.join(' ');
}

/**
 * Une erreur du service (409, 400…) en message lisible : { texte, lignes, erreur: true }. Le service dit quelle ligne corriger (`operations`), quels contrôles
 * du contenu échouent (`problemes`), quelles décisions il faut ouvrir (`verrous`).
 * @param {{ message?: string, corps?: object | null }} e
 */
export function messageDErreur(e) {
  const corps = e?.corps ?? {};
  const lignes = [
    ...(Array.isArray(corps.operations) ? corps.operations.map((o) => (typeof o === 'string' ? o : o?.message ? `ligne ${o.rang} du lot : ${o.message}` : null)).filter(Boolean) : []),
    ...(Array.isArray(corps.problemes) ? corps.problemes.slice(0, 5).map((p) => `contrôle du contenu : ${p}`) : []),
    ...(Array.isArray(corps.verrous) && corps.verrous.length ? [`Cochez la case de ${corps.verrous.length > 1 ? 'chaque décision' : 'la décision'} ${corps.verrous.join(', ')} pour accepter d’ouvrir ce qu’elle verrouille.`] : []),
  ];
  return { texte: String(e?.message ?? 'Le service a refusé.'), lignes, erreur: true };
}

/**
 * La confirmation avant « Annuler cette modification » (R291 : le bouton de suppression se confirme) : la ligne, ce que l'annulation remettrait (l'aperçu du
 * service, sur une copie), une case par décision à ouvrir, puis « Oui, annuler cette modification ». Un aperçu refusé ou sans rien à remettre ne porte que « Fermer ».
 */
function htmlDeLaConfirmationDeLaLigne({ lot, ligne, apercu, verrous = [] }) {
  const phrase = phraseDeLAnnulation(apercu);
  const possible = apercu?.verdict === 'applicable' || apercu?.verdict === 'verrous';
  const decisions = apercu?.verrous_a_ouvrir ?? [];
  const pret = peutAnnuler(apercu, new Set(verrous)).possible;
  const nom = ligne?.ligne ? `${ligne.ligne} (${ligne.table})` : 'cette ligne';
  const detail = apercu?.operations?.length
    ? `<div class="nv-lot__apercu">${htmlDeLApercu(apercu.operations, { contexte: 'annulation', toutes: true, titres: { avant: 'Maintenant', apres: 'Après l’annulation' } })}</div>` : '';
  return `<form method="dialog"><h2>Annuler cette modification ?</h2>`
    + `<p>${echapper(`${nom}, dans « ${lot?.titre ?? ''} ».`)}</p>${htmlDeLaPhrase(phrase, 'data-nv-verdict-annulation')}${detail}${possible ? htmlDesVerrous(decisions, new Set(verrous)) : ''}`
    + `<div class="nv-dev__actions"><button type="button" value="annuler">${possible ? 'Revenir en arrière' : 'Fermer'}</button>`
    + `${possible ? `<button type="submit" class="nv-principal" data-nv-confirmer-ligne ${pret ? '' : 'disabled'}>Oui, annuler cette modification</button>` : ''}</div>`
    + `<p class="nv-conflit__aide" data-nv-raison ${pret || !possible ? 'hidden' : ''}>${echapper(peutAnnuler(apercu, new Set(verrous)).raison ?? '')}</p></form>`;
}

/**
 * La confirmation avant un clic qui écrit ou qui décide (le contenu d'un `<dialog>` : formulaire, titre, ce que le clic fait, « Annuler » et le bouton).
 * @param {{ action: 'appliquer' | 'refuser' | 'annuler-ligne', lot: object, verrous?: string[], ligne?: object, apercu?: object }} o `verrous` : les décisions que le propriétaire a cochées ;
 * `ligne` et `apercu` : « Annuler cette modification » (la ligne du changement et l'aperçu de son annulation)
 */
export function htmlDeLaConfirmation({ action, lot, verrous = [], ligne = null, apercu = null }) {
  if (action === 'annuler-ligne') return htmlDeLaConfirmationDeLaLigne({ lot, ligne, apercu, verrous });
  const comptes = lot?.essai?.comptes ?? {};
  const aEcrire = (comptes.applicables ?? 0) + (comptes.verrouillees ?? 0);
  const valeurs = valeursChangees(lot?.essai?.operations);
  const titre = action === 'refuser' ? `Refuser « ${lot?.titre ?? ''} » ?` : `Appliquer « ${lot?.titre ?? ''} » ?`;
  const corps = action === 'refuser'
    ? '<p>Rien ne sera écrit. Le lot reste lisible dans l’historique, mais ne peut plus être appliqué.</p>'
    : `<p>${echapper(`${pluriel(aEcrire, 'ligne sera écrite', 'lignes seront écrites')} dans la base du site de dev${valeurs ? `, sauf ${pluriel(valeurs, 'valeur qui a changé depuis', 'valeurs qui ont changé depuis')}` : ''}.`)} Vous pourrez ensuite annuler chaque ligne.</p>`
      + (verrous.length ? `<p>Vous ouvrez ce que ${verrous.length > 1 ? 'les décisions' : 'la décision'} <strong>${echapper(verrous.join(', '))}</strong> ${verrous.length > 1 ? 'verrouillent' : 'verrouille'}.</p>` : '');
  return `<form method="dialog"><h2>${echapper(titre)}</h2>${corps}`
    + `<div class="nv-dev__actions"><button type="button" value="annuler">Revenir en arrière</button>`
    + `<button type="submit" class="nv-principal">${action === 'refuser' ? 'Refuser le lot' : 'Appliquer le lot'}</button></div></form>`;
}
