// Les lots de changements sur la page « Mise à jour » du site de dev (chantier « la base du site de dev devient la source de vérité », lot 6, R274, R275).
// Décision du propriétaire (R275, question 4 a) : « Chaque lot attend votre clic sur le site de dev, avec un aperçu avant et après. » Une session dépose
// une proposition (clé de lecture) ; le propriétaire la voit ici, avec ce qu'elle change ligne par ligne, avant et après, en langage simple ; un clic (mot de
// passe) l'applique ou la refuse ; un autre clic annule un lot appliqué. Il ne manipule jamais de fichier, et s'occupe le moins possible (R276).
// Le service (GET /api/edition/lots/…, serveur/edition-lots.mjs) rend les noms : la table et la ligne par leur nom, chaque colonne par son libellé
// (`apercu`) ; ce module n'écrit aucun nom de table ni de colonne et n'importe ni lib/edition-modele.mjs ni lib/libelles-de-la-base.mjs (skill
// site-version-portable : le script de la page les ignore). Un mot technique (« nature », « opération », JSON) ne se lit nulle part : une origine dite en
// mots (« décision R275 », « un changement du code »), une ligne dite par son nom, une valeur par `texteDeValeur` (jamais en JSON).
// Fonctions pures (chaîne HTML en sortie, tout texte échappé, jamais de HTML reçu posé), sans dépendance hors lib/conflits-rendu.mjs, lib/diff-replie.mjs
// et lib/notes-de-version-rendu.mjs ; seul le script de la page (src/scripts/mise-a-jour.mjs) importe ce module (version portable : jamais deux scripts).
// Les choix de présentation sans décision du propriétaire (réponse sobre par défaut, à lui de changer) : les lots appliqués ne sont montrés que pour les
// APPLIQUES_RECENTS plus récents, les refusés et les annulés tiennent dans un historique replié, un aperçu coupe à PLAFOND_DES_LIGNES lignes (un bouton montre
// le reste).
import { instantLisible, texteDeValeur } from './conflits-rendu.mjs';
import { replierLeDiff } from './diff-replie.mjs';
import { diffMots, echapper } from './notes-de-version-rendu.mjs';

/** Les lots appliqués qu'on montre (les plus récents) ; les autres se retrouvent dans le journal. */
export const APPLIQUES_RECENTS = 10;
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

/** Les lots appliqués, le plus récemment appliqué d'abord (ceux qu'on peut annuler d'un clic : les `APPLIQUES_RECENTS` premiers sont montrés). */
export const lotsAppliques = (lots) => (lots ?? []).filter((l) => l.etat === 'applique').sort((a, b) => String(b.decide_le ?? '').localeCompare(String(a.decide_le ?? '')));

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

/** « Déposé le 12 novembre 2026 à 11:00 par X · origine : décision R275 » (les morceaux absents sont omis). */
export function ligneDeLOrigine(lot) {
  const origine = origineDuLot(lot);
  const date = jour(lot?.depose_le);
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

/** L'aperçu d'une annulation en une phrase : { niveau, verdict, texte, lignes }. */
export function phraseDeLAnnulation(apercu) {
  const verdict = apercu?.verdict ?? null;
  const c = apercu?.comptes ?? {};
  if (verdict === 'refusee') {
    const lignes = [
      ...(apercu.operations ?? []).filter((o) => o.etat === 'refusee').map((o) => `ligne ${o.rang} : ${o.message ?? 'refusée'}`),
      ...(apercu.refus_de_l_annulation ? [String(apercu.refus_de_l_annulation)] : []),
      ...(apercu.problemes_nouveaux ?? []).slice(0, 5).map((p) => `contrôle du contenu : ${p}`),
    ];
    return { niveau: 'erreur', verdict, texte: 'L’annulation est impossible pour l’instant :', lignes };
  }
  if (verdict === 'rien_a_remettre') {
    return { niveau: 'attention', verdict, texte: 'Rien à remettre : chaque valeur a changé depuis ou est déjà comme avant. Le lot reste appliqué.', lignes: [] };
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
  const message = o.message && (etat === 'refusee' || etat === 'verrouillee') ? `<p class="nv-lot-ligne__message">${echapper(o.message)}</p>` : '';
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

/** Le message d'un lot (une erreur d'un clic, l'état d'une demande) : `{ texte, erreur, lignes }` posé par la page. */
function htmlDuMessage(m) {
  if (!m) return '<p class="nv-message" data-nv-lot-message hidden></p>';
  const liste = m.lignes?.length ? `<ul class="nv-lot__problemes">${m.lignes.map((l) => `<li>${echapper(l)}</li>`).join('')}</ul>` : '';
  return `<div class="nv-message${m.erreur ? ' nv-message--erreur' : ''}" data-nv-lot-message role="${m.erreur ? 'alert' : 'status'}"><p>${echapper(m.texte)}</p>${liste}</div>`;
}

/** L'aperçu de l'annulation d'un lot appliqué (reçu de GET …/annulation/), avec sa confirmation. */
function htmlDeLAnnulation(lot, etat, vue) {
  const id = lot.id;
  if (etat.chargement) return '<div class="nv-lot-annulation" data-nv-annulation><p class="nv-message">Calcul de ce que l’annulation remettrait…</p></div>';
  if (etat.erreur) return `<div class="nv-lot-annulation" data-nv-annulation>${htmlDuMessage({ texte: etat.erreur, erreur: true })}<div class="nv-dev__actions"><button type="button" data-nv-renoncer>Fermer</button></div></div>`;
  const apercu = etat.apercu;
  const coches = vue.coches?.get(`annulation:${id}`) ?? new Set();
  const { possible, raison } = peutAnnuler(apercu, coches);
  const verrous = apercu.verrous_a_ouvrir ?? [];
  return `<div class="nv-lot-annulation" data-nv-annulation>`
    + `<h5 class="nv-lot-annulation__titre">Ce que ferait l’annulation</h5>${htmlDeLaPhrase(phraseDeLAnnulation(apercu), 'data-nv-verdict-annulation')}`
    + `<details class="nv-lot__apercu" data-nv-ouvert="${echapper(id)}:annulation"${ouvert(vue, id, 'annulation')}><summary>Voir ligne par ligne</summary>`
    + `${htmlDeLApercu(apercu.operations, { contexte: 'annulation', toutes: vue.toutes?.has(`${id}:annulation`), cle: `${id}:annulation`, titres: { avant: 'Maintenant', apres: 'Après l’annulation' } })}</details>`
    + `${htmlDesVerrous(verrous, coches)}`
    + `<div class="nv-dev__actions"><button type="button" class="nv-principal" data-nv-confirmer-annulation ${possible ? '' : 'disabled'}>Oui, annuler ce lot</button>`
    + `<button type="button" data-nv-renoncer>Renoncer</button></div>`
    + `<p class="nv-conflit__aide" data-nv-raison ${possible ? 'hidden' : ''}>${echapper(raison ?? '')}</p></div>`;
}

/**
 * Les lignes d'un lot appliqué, avec ce qui leur est arrivé au clic (`bilan.operations` : écrite, ou gardée parce que la valeur avait changé) ; le bilan n'a pas
 * les noms (le service les retire) : ceux de l'essai, par rang. Sans bilan détaillé : null.
 */
function operationsDuBilan(lot) {
  const faites = lot.bilan?.operations ?? [];
  if (!faites.length) return null;
  const essai = lot.essai?.operations ?? [];
  return faites.map((o) => {
    const vue = essai.find((x) => x.rang === o.rang) ?? {};
    return { ...vue, ...o, apercu: o.apercu ?? vue.apercu ?? null };
  });
}

/** Le bilan d'un lot appliqué : ce qui a été écrit, ce qui a été gardé parce que la valeur avait changé. */
function htmlDuBilan(lot) {
  const bilan = lot.bilan;
  if (!bilan) return '';
  const ecrites = bilan.ecrites ?? 0;
  const changees = bilan.changees ?? 0;
  const texte = `${pluriel(ecrites, 'ligne écrite', 'lignes écrites')}${changees ? ` ; ${pluriel(changees, 'ligne gardée', 'lignes gardées')} parce que ${saValeur(changees)} avait changé depuis (le site prime)` : ''}.`;
  return `<p class="nv-lot__bilan" data-nv-bilan>${echapper(texte)}</p>`;
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

/** Un lot appliqué : son bilan, ses lignes avant et après (celles gardées sont dites), puis « Annuler ce lot » (l'aperçu de l'annulation vient d'abord). */
function htmlDuLotApplique(lot, vue) {
  const id = lot.id;
  const annulation = vue.annulations?.get(id);
  const bilan = operationsDuBilan(lot);
  const ops = bilan ?? lot.essai?.operations ?? [];
  const apercu = ops.length
    ? `<details class="nv-lot__apercu" data-nv-ouvert="${echapper(id)}:apercu"${ouvert(vue, id, 'apercu')}><summary>Voir ce que le lot a changé (${echapper(pluriel(ops.length, 'ligne', 'lignes'))})</summary>`
      + `${htmlDeLApercu(ops, { contexte: bilan ? 'bilan' : 'essai', toutes: vue.toutes?.has(`${id}:apercu`), cle: `${id}:apercu` })}</details>` : '';
  const bouton = annulation ? '' : '<div class="nv-dev__actions"><button type="button" data-nv-annuler>Annuler ce lot</button></div>';
  return `${htmlDuBilan(lot)}${apercu}${bouton}${annulation ? htmlDeLAnnulation(lot, annulation, vue) : ''}`;
}

const ETAT_DE_L_HISTORIQUE = Object.freeze({ refuse: 'refusé', annule: 'annulé' });

/** Un lot dans l'historique replié : son titre, ce qu'il est devenu et quand. */
function htmlDuLotArchive(lot) {
  const quand = lot.etat === 'annule' ? lot.annule_le : lot.decide_le;
  return `<li class="nv-lot-archive" data-nv-lot-id="${echapper(lot.id)}" data-nv-etat="${echapper(lot.etat)}"><strong>${echapper(lot.titre)}</strong> `
    + `<span class="nv-lot__meta">${echapper(`${ETAT_DE_L_HISTORIQUE[lot.etat] ?? lot.etat}${quand ? ` le ${jour(quand)}` : ''}`)}</span></li>`;
}

/**
 * Un lot, selon son état (`propose` : attend le clic ; `applique` : bilan et annulation).
 * @param {object} lot la proposition (GET /api/edition/lots/<id>/ : `essai`, `bilan`…, ou son résumé de la liste)
 * @param {{ coches?: Map<string, Set<string>>, annulations?: Map<string, object>, messages?: Map<string, object>, ouverts?: Set<string>, toutes?: Set<string> }} [vue] l'état de la page
 */
export function htmlDuLot(lot, vue = {}) {
  const decision = lot.decision ? `<span class="nv-lot__decision" data-nv-decision>${echapper(lot.decision)}</span> ` : '';
  const titre = lot.etat === 'applique' ? `Appliqué le ${jour(lot.decide_le)}` : null;
  const meta = [ligneDeLOrigine(lot), titre].filter(Boolean).join(' · ');
  const corps = lot.etat === 'propose' ? htmlDuLotProposeAttend(lot, vue) : htmlDuLotApplique(lot, vue);
  return `<article class="nv-lot nv-lot--${echapper(lot.etat)}" data-nv-lot-id="${echapper(lot.id)}" data-nv-etat="${echapper(lot.etat)}">`
    + `<h4 class="nv-lot__titre">${decision}${echapper(lot.titre)}</h4><p class="nv-lot__meta">${echapper(meta)}</p>${corps}${htmlDuMessage(vue.messages?.get(lot.id) ?? null)}</article>`;
}

/**
 * La section « Lots de changements proposés » : en tête l'explication, « Tout recalculer » et « Actualiser », puis les lots qui attendent le clic, les lots
 * appliqués récents (« Annuler ce lot »), et un historique replié des refusés et des annulés.
 * @param {{ lots?: object[] }} reponse les lots, la plus récente d'abord (chacun avec son détail quand la page l'a lu)
 * @param {{ coches?: Map<string, Set<string>>, annulations?: Map<string, object>, messages?: Map<string, object>, ouverts?: Set<string>, toutes?: Set<string>, message?: object | null }} [vue]
 */
export function htmlDesLots({ lots = [] } = {}, vue = {}) {
  const attendent = lots.filter((l) => l.etat === 'propose');
  const appliques = lotsAppliques(lots);
  const recents = appliques.slice(0, APPLIQUES_RECENTS);
  const archives = lots.filter((l) => l.etat === 'refuse' || l.etat === 'annule');
  const message = vue.message ? `<div class="nv-message nv-lots__message${vue.message.erreur ? ' nv-message--erreur' : ''}" data-nv-lots-message role="${vue.message.erreur ? 'alert' : 'status'}"><p>${echapper(vue.message.texte)}</p>`
    + `${vue.message.lignes?.length ? `<ul class="nv-lot__problemes">${vue.message.lignes.map((l) => `<li>${echapper(l)}</li>`).join('')}</ul>` : ''}</div>` : '';
  const entete = `<h3 class="nv-lots__titre">Lots de changements proposés</h3>`
    + `<p class="nv-lots__intro">Une proposition préparée par une session ne change rien tant que vous n’avez pas cliqué sur « Appliquer ». Vous voyez d’abord ce qui change, ligne par ligne ; un lot appliqué peut s’annuler d’un clic.</p>`
    + `<div class="nv-dev__actions"><button type="button" data-nv-recalcul>Tout recalculer</button><button type="button" data-nv-lots-actualiser>Actualiser</button></div>`
    + `<p class="nv-conflit__aide">« Tout recalculer » sert après un changement de code : il propose, comme un lot à valider, les pages que le code d’aujourd’hui calcule autrement. Rien n’est écrit sans votre clic.</p>`;
  const bloc = (titre, contenu, attribut) => `<div class="nv-lots__groupe" ${attribut}><h4 class="nv-lots__sous-titre">${echapper(titre)}</h4>${contenu}</div>`;
  const attente = bloc(attendent.length ? `À décider (${attendent.length})` : 'À décider', attendent.length ? attendent.map((l) => htmlDuLot(l, vue)).join('') : '<p class="nv-lots__aucun">Aucun lot n’attend votre clic.</p>', 'data-nv-lots-attente');
  const faits = recents.length
    ? bloc('Appliqués récemment', recents.map((l) => htmlDuLot(l, vue)).join('')
      + (appliques.length > recents.length ? `<p class="nv-conflit__aide">${echapper(`${pluriel(appliques.length - recents.length, 'lot appliqué plus ancien n’est pas montré', 'lots appliqués plus anciens ne sont pas montrés')}.`)}</p>` : ''), 'data-nv-lots-appliques') : '';
  const historique = archives.length
    ? `<details class="nv-lots__historique" data-nv-ouvert="historique"${vue.ouverts?.has('historique') ? ' open' : ''} data-nv-lots-historique><summary>Historique : refusés et annulés (${archives.length})</summary>`
      + `<ul class="nv-lots__archives">${archives.map(htmlDuLotArchive).join('')}</ul></details>` : '';
  return `${message}${entete}${attente}${faits}${historique}`;
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

/** Le message d'un lot qui vient d'être annulé (réponse de POST …/annuler/) ; `apercu` : l'aperçu montré avant, qui donne les noms des lignes gardées. */
export function messageDeLAnnulation(lot, apercu = null) {
  const a = lot?.bilan?.annulation ?? {};
  const lignes = (a.operations ?? []).filter((o) => o.etat === 'gardee').map((o) => {
    const vu = apercu?.operations?.find((x) => x.rang === o.rang) ?? null;
    const nom = vu?.apercu ? `${vu.apercu.ligne} (${vu.apercu.table})` : `ligne ${o.rang}`;
    const ecarts = (o.ecarts ?? []).map((e) => phraseDeLEcart(vu ?? {}, e, 'annulation')).join(' ; ');
    return ecarts ? `${nom} : ${ecarts}` : nom;
  });
  const parts = [
    pluriel(a.remises ?? 0, 'ligne remise', 'lignes remises') + ' comme avant',
    a.deja ? `${pluriel(a.deja, 'ligne était', 'lignes étaient')} déjà comme avant` : null,
    a.gardees ? `${pluriel(a.gardees, 'ligne gardée', 'lignes gardées')} parce que ${saValeur(a.gardees)} avait changé depuis` : null,
  ].filter(Boolean);
  return { texte: `« ${lot?.titre ?? ''} » est annulé : ${parts.join(', ')}.`, lignes };
}

/** Le message d'après « Tout recalculer » (réponse de POST …/recalcul/) : un lot déposé, ou rien à recalculer. */
export function messageDuRecalcul(r) {
  const n = r?.recalcul?.ecarts ?? 0;
  const illisibles = r?.recalcul?.pages_illisibles ?? [];
  const reste = illisibles.length ? `${pluriel(illisibles.length, 'page n’a pas pu être examinée', 'pages n’ont pas pu être examinées')}.` : '';
  if (!r?.lot) return { texte: `Rien à recalculer : tout est déjà à jour.${reste ? ` ${reste}` : ''}`, lignes: [], erreur: false };
  return { texte: `Un lot est proposé : ${pluriel(n, 'page se calcule autrement', 'pages se calculent autrement')}. Vérifiez-le ci-dessous, puis appliquez-le ou refusez-le.${reste ? ` ${reste}` : ''}`, lignes: [], erreur: false };
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
 * La confirmation avant un clic qui écrit ou qui décide (le contenu d'un `<dialog>` : formulaire, titre, ce que le clic fait, « Annuler » et le bouton).
 * @param {{ action: 'appliquer' | 'refuser', lot: object, verrous?: string[] }} o `verrous` : les décisions que le propriétaire a cochées
 */
export function htmlDeLaConfirmation({ action, lot, verrous = [] }) {
  const comptes = lot?.essai?.comptes ?? {};
  const aEcrire = (comptes.applicables ?? 0) + (comptes.verrouillees ?? 0);
  const valeurs = valeursChangees(lot?.essai?.operations);
  const titre = action === 'refuser' ? `Refuser « ${lot?.titre ?? ''} » ?` : `Appliquer « ${lot?.titre ?? ''} » ?`;
  const corps = action === 'refuser'
    ? '<p>Rien ne sera écrit. Le lot reste lisible dans l’historique, mais ne peut plus être appliqué.</p>'
    : `<p>${echapper(`${pluriel(aEcrire, 'ligne sera écrite', 'lignes seront écrites')} dans la base du site de dev${valeurs ? `, sauf ${pluriel(valeurs, 'valeur qui a changé depuis', 'valeurs qui ont changé depuis')}` : ''}.`)} Vous pourrez l’annuler ensuite d’un clic.</p>`
      + (verrous.length ? `<p>Vous ouvrez ce que ${verrous.length > 1 ? 'les décisions' : 'la décision'} <strong>${echapper(verrous.join(', '))}</strong> ${verrous.length > 1 ? 'verrouillent' : 'verrouille'}.</p>` : '');
  return `<form method="dialog"><h2>${echapper(titre)}</h2>${corps}`
    + `<div class="nv-dev__actions"><button type="button" value="annuler">Revenir en arrière</button>`
    + `<button type="submit" class="nv-principal">${action === 'refuser' ? 'Refuser le lot' : 'Appliquer le lot'}</button></div></form>`;
}
