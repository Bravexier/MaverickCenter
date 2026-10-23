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
// avec ses modifications saines et, pour chaque conflit, la version 1 (le site de dev), la version 2 (les règles livrées) et les choix 1, 2, 3 ;
// « Résoudre ce lot » l'envoie (POST, une fois chaque choix fait) : le service écrit une nouvelle modification du site de dev et marque l'ancien lot
// résolu. Rendu : lib/conflits-rendu.mjs. La section reste la même d'un rendu de la note à l'autre (le suivi d'un lancement la refait toutes les 15 s) :
// les choix en cours ne se perdent pas.
// Ce script n'importe que le rendu commun et celui des conflits (aucun autre script de page ne les importe : la version portable refuse un module
// partagé).
import { compter, echapper, htmlDeLaListe, htmlDuTexteLibre, lancementAffiche } from '../lib/notes-de-version-rendu.mjs';
import { corpsDeLaResolution, htmlDesConflits, messageDeResolution } from '../lib/conflits-rendu.mjs';

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

function htmlDuLancement(l, github, liberable) {
  if (!l) return '';
  const run = l.run?.url ? ` <a href="${echapper(l.run.url)}" rel="noopener noreferrer" target="_blank">Voir le workflow sur GitHub</a>` : '';
  const manuel = l.etat === 'manuel' || l.etat === 'erreur'
    ? `<p>Sur GitHub : <a href="https://github.com/${echapper(github?.depot ?? 'Bravexier/MaverickCenter')}/actions/workflows/mise-a-jour.yml" rel="noopener noreferrer" target="_blank">Actions › Mise à jour des règles › Run workflow</a> (branche dev), avec :</p>
       <ul><li>lot : <code>${echapper(l.lot)}</code></li><li>empreinte : <code>${echapper(l.empreinte)}</code></li><li>adresse : <code>${echapper(l.adresse)}</code></li>
       <li>case « Simulation » : ${l.simulation ? '<strong>cochée</strong>' : 'décochée'}</li></ul>`
    : '';
  // le service dit si le lancement est annulable (mêmes règles des deux côtés : estLiberable) ; un lot dans dev ou livré, resté sans nouvelles plus
  // de 3 h, libère seulement le texte
  const tardif = ['fusionne', 'echec_livraison', 'termine', 'lance', 'en_cours'].includes(l.etat);
  const liberer = liberable
    ? `<button type="button" data-nv-liberer data-lot="${echapper(l.lot)}">${tardif ? 'Libérer le texte (sans nouvelles depuis plus de 3 h)' : 'Annuler ce lancement'}</button>` : '';
  return `<div class="nv-lancement nv-lancement--${echapper(l.etat)}">
    <p class="nv-message"><strong>${l.simulation ? 'Dernière simulation' : 'Dernier lancement'}</strong> (V${echapper(l.version_cible ?? '?')}, ${echapper(l.lance_le ?? '')}) : ${echapper(ETATS[l.etat] ?? l.etat)}${run}</p>
    ${l.erreur ? `<p class="nv-message nv-message--erreur">${echapper(l.erreur)}</p>` : ''}${manuel}${liberer}</div>`;
}

function rendre() {
  const d = donnees;
  const zone = racine.querySelector('[data-nv-dev]');
  // un lot figé (brouillon.lot) verrouille le texte et le bouton jusqu'à ce que la version livrée arrive sur ce site (ou que le lancement soit annulé)
  const verrouille = Boolean(d.brouillon?.lot);
  const occupe = verrouille || Boolean(d.occupe); // règle du service (occupe : lancement en cours ou en attente de livraison)
  const ref = d.reference;
  const versionProd = ref?.version ? `V${ref.version.split('.').slice(0, 2).join('.')}` : 'inconnue';
  const n = d.lignes ? compter(d.lignes) : null;
  const bilan = d.lignes
    ? `${d.lignes.length} modification${d.lignes.length > 1 ? 's' : ''} des règles depuis la production (${versionProd})`
      + `${n.amelioration ? ` · <span class="nv-sens--amelioration">${n.amelioration} amélioration${n.amelioration > 1 ? 's' : ''}</span>` : ''}`
      + `${n.affaiblissement ? ` · <span class="nv-sens--affaiblissement">${n.affaiblissement} affaiblissement${n.affaiblissement > 1 ? 's' : ''}</span>` : ''}`
    : `La base de production (référence) manque sur ce serveur : la liste ne peut pas être calculée.`;
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
  const bouton = `<div class="nv-dev__actions"><button type="button" data-nv-simuler ${occupe || !d.lignes ? 'disabled' : ''}>Simulation de mise à jour</button>
       <button type="button" class="nv-principal" data-nv-lancer ${occupe || !d.lignes ? 'disabled' : ''}>Effectuer la mise à jour</button>
       <span class="nv-bascule"><label><input type="checkbox" data-nv-voir-prod> Voir la page de production</label></span></div>`;
  // la case « Version majeure » : figée avec le lot, comme le texte
  const majeure = Boolean(d.brouillon?.majeure);
  const caseMajeure = d.version_majeure
    ? `<label class="nv-majeure" title="Cochée, la prochaine mise à jour est la V${echapper(d.version_majeure)} au lieu de la V${echapper(d.version_mineure ?? '?')}. Elle ne lance rien : seul « Effectuer la mise à jour » livre.${verrouille ? ' Figée avec le lot en cours.' : ''}">
        <input type="checkbox" data-nv-majeure ${majeure ? 'checked' : ''} ${verrouille ? 'disabled' : ''}> Version majeure (V${echapper(d.version_majeure)})</label>`
    : '';
  zone.innerHTML = `<div class="nv-dev__titre"><h2>Mise à jour en préparation : V${echapper(d.version_cible ?? '?')}</h2>${caseMajeure}</div>
    <p class="nv-dev__bilan">${bilan}${bilanDesConflits}</p>
    <div class="nv-dev__note">${note}</div>
    ${bouton}
    ${htmlDuLancement(lancementAffiche(d), d.github, d.liberable)}
    <div class="nv-dev__liste">${d.lignes ? htmlDeLaListe(d.lignes, { niveau: 3, plafond: 25 }) : ''}</div>`;
  // après les listes, la section des conflits, la même d'un rendu à l'autre (choix en cours gardés)
  zone.append(sectionDesConflits());
  zone.hidden = false;
  brancher(zone);
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
    // 409 : le diagnostic a changé (règles livrées, autre onglet) : le lot à jour est reposé, les choix qui y valent encore restent
    if (e.statut === 409 && e.corps?.lot && typeof e.corps.lot === 'object') {
      conflits.reponse = { ...conflits.reponse, lots: conflits.reponse.lots.map((l) => (l.lot === lot.lot ? e.corps.lot : l)) };
      rendreLesConflits();
      const neuf = [...conflits.section.querySelectorAll('[data-nv-lot]')].find((f) => f.dataset.nvLot === lot.lot);
      if (neuf) montrerMessage(neuf, `${e.message} Les conflits affichés sont à jour.`, true);
      return;
    }
    if (e.statut === 409) {
      conflits.message = e.message;
      await charger();
      return;
    }
    montrerMessage(form, e.message, true);
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
    if (e.target.checked) sectionDesConflits().hidden = true;
    else rendreLesConflits();
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
      erreur.textContent = err.message;
      erreur.hidden = false;
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
