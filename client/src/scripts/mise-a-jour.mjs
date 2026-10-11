// Page « Mise à jour » (pages/mise-a-jour.astro) sur le site de dev : si le service répond `edition: true` (MAVERICK_EDITION=1), la note EN
// PRÉPARATION s'affiche au-dessus de la note de production — les modifications des règles de la production (master) à la base dev, calculées par
// le service (GET /api/mise-a-jour/), le champ libre des admins et, sur ordinateur seulement (comme le mode modification), le bouton
// « Effectuer la mise à jour » : après confirmation, le service fige le lot et déclenche le workflow GitHub (rebase sur dev, PR, fusion
// automatique si tout est vert, puis livraison dev → master) ; « Simulation de mise à jour » : le même travail, arrêté avant de rien pousser.
// La page suit leur avancement. Ailleurs (production, service absent) : rien ne change.
// Ce script n'importe que le rendu commun (aucun autre script de page ne l'importe : la version portable refuse un module partagé).
import { compter, echapper, htmlDeLaListe, htmlDuTexteLibre } from '../lib/notes-de-version-rendu.mjs';

const racine = document.querySelector('[data-mise-a-jour]');
const BUREAU = matchMedia('(min-width: 60rem) and (hover: hover) and (pointer: fine)');
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
  termine: 'Mise à jour terminée : la PR a été fusionnée dans dev puis livrée sur master. Le site de dev se met à jour de lui-même ; le texte redevient modifiable quand la nouvelle version y arrive.',
  echec: 'La mise à jour a échoué sur GitHub : rien n’a été fusionné de ce qui a échoué. Le journal du workflow dit pourquoi.',
  erreur: 'Le workflow n’a pas pu être déclenché.',
  manuel: 'Aucun jeton GitHub sur ce serveur : lancez le workflow à la main avec les valeurs ci-dessous.',
  annule: 'Lancement annulé : le texte redevient modifiable.',
  simulation_reussie: 'Simulation réussie : le lot s’applique sur dev, seules les tables prévues changent, db:check et tous les tests passent. Rien n’a été poussé ; la vraie mise à jour peut être lancée.',
  simulation_echouee: 'La simulation a échoué : le journal du workflow dit pourquoi. Rien n’a été poussé ; le texte redevient modifiable.',
};
const EN_COURS = ['envoi', 'lance', 'en_cours'];

let donnees = null;
let suivi = null;

function htmlDuLancement(l, github, fige) {
  if (!l) return '';
  const run = l.run?.url ? ` <a href="${echapper(l.run.url)}" rel="noopener noreferrer" target="_blank">Voir le workflow sur GitHub</a>` : '';
  const manuel = l.etat === 'manuel' || l.etat === 'erreur'
    ? `<p>Sur GitHub : <a href="https://github.com/${echapper(github?.depot ?? 'Bravexier/MaverickCenter')}/actions/workflows/mise-a-jour.yml" rel="noopener noreferrer" target="_blank">Actions › Mise à jour des règles › Run workflow</a> (branche dev), avec :</p>
       <ul><li>lot : <code>${echapper(l.lot)}</code></li><li>empreinte : <code>${echapper(l.empreinte)}</code></li><li>adresse : <code>${echapper(l.adresse)}</code></li>
       <li>case « Simulation » : ${l.simulation ? '<strong>cochée</strong>' : 'décochée'}</li></ul>`
    : '';
  const liberer = fige && ['manuel', 'erreur', 'echec', 'envoi'].includes(l.etat) && BUREAU.matches ? '<button type="button" data-nv-liberer>Annuler ce lancement</button>' : '';
  return `<div class="nv-lancement nv-lancement--${echapper(l.etat)}">
    <p class="nv-message"><strong>${l.simulation ? 'Dernière simulation' : 'Dernier lancement'}</strong> (V${echapper(l.version_cible ?? '?')}, ${echapper(l.lance_le ?? '')}) : ${echapper(ETATS[l.etat] ?? l.etat)}${run}</p>
    ${l.erreur ? `<p class="nv-message nv-message--erreur">${echapper(l.erreur)}</p>` : ''}${manuel}${liberer}</div>`;
}

function rendre() {
  const d = donnees;
  const zone = racine.querySelector('[data-nv-dev]');
  const bureau = BUREAU.matches;
  // un lot figé (brouillon.lot) verrouille le texte et le bouton jusqu'à ce que la version livrée arrive sur ce site (ou que le lancement soit annulé)
  const verrouille = Boolean(d.brouillon?.lot);
  const occupe = verrouille || EN_COURS.includes(d.lancement?.etat);
  const ref = d.reference;
  const versionProd = ref?.version ? `V${ref.version.split('.').slice(0, 2).join('.')}` : 'inconnue';
  const n = d.lignes ? compter(d.lignes) : null;
  const bilan = d.lignes
    ? `${d.lignes.length} modification${d.lignes.length > 1 ? 's' : ''} des règles depuis la production (${versionProd})`
      + `${n.amelioration ? ` · <span class="nv-sens--amelioration">${n.amelioration} amélioration${n.amelioration > 1 ? 's' : ''}</span>` : ''}`
      + `${n.affaiblissement ? ` · <span class="nv-sens--affaiblissement">${n.affaiblissement} affaiblissement${n.affaiblissement > 1 ? 's' : ''}</span>` : ''}`
    : `La base de production (référence) manque sur ce serveur : la liste ne peut pas être calculée.`;
  const texte = d.brouillon?.texte ?? '';
  const note = bureau && !verrouille
    ? `<label for="nv-texte"><strong>Informations supplémentaires</strong> (champ libre, ajouté à la note : paragraphes, listes « - », **gras**, *italique*, liens)</label>
       <textarea id="nv-texte" data-nv-texte>${echapper(texte)}</textarea>
       <div class="nv-dev__actions"><button type="button" data-nv-enregistrer>Enregistrer le texte</button><span data-nv-etat-texte></span></div>
       <div class="nv-dev__apercu nv-texte" data-nv-apercu ${texte ? '' : 'hidden'}>${htmlDuTexteLibre(texte)}</div>`
    : texte ? `<div class="nv-texte">${htmlDuTexteLibre(texte)}</div>` : '';
  const bouton = bureau
    ? `<div class="nv-dev__actions"><button type="button" data-nv-simuler ${occupe || !d.lignes ? 'disabled' : ''}>Simulation de mise à jour</button>
       <button type="button" class="nv-principal" data-nv-lancer ${occupe || !d.lignes ? 'disabled' : ''}>Effectuer la mise à jour</button>
       <span class="nv-bascule"><label><input type="checkbox" data-nv-voir-prod> Voir la page de production</label></span></div>`
    : `<p class="nv-bascule">Le bouton « Effectuer la mise à jour » est sur la version ordinateur du site.</p>`;
  zone.innerHTML = `<h2>Mise à jour en préparation : V${echapper(d.version_cible ?? '?')}</h2>
    <p class="nv-dev__bilan">${bilan}</p>
    <div class="nv-dev__note">${note}</div>
    ${bouton}
    ${htmlDuLancement(d.lancement, d.github, verrouille)}
    <div class="nv-dev__liste">${d.lignes ? htmlDeLaListe(d.lignes, { niveau: 3, plafond: 25 }) : ''}</div>`;
  zone.hidden = false;
  brancher(zone);
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
  zone.querySelector('[data-nv-lancer]')?.addEventListener('click', () => confirmer({ simulation: false }));
  zone.querySelector('[data-nv-simuler]')?.addEventListener('click', () => confirmer({ simulation: true }));
  zone.querySelector('[data-nv-liberer]')?.addEventListener('click', async () => {
    try {
      donnees.lancement = (await appel('POST', 'mise-a-jour/liberer/', {})).lancement;
      await charger();
    } catch (e) {
      alert(e.message);
    }
  });
  zone.querySelector('[data-nv-voir-prod]')?.addEventListener('change', (e) => {
    zone.querySelector('.nv-dev__liste').hidden = e.target.checked;
    zone.querySelector('.nv-dev__note').hidden = e.target.checked;
    racine.querySelector('[data-nv-production]').scrollIntoView({ behavior: 'smooth' });
  });
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
  const dialogue = document.createElement('dialog');
  dialogue.className = 'nv-dialogue';
  dialogue.innerHTML = simulation
    ? `<form method="dialog">
    <h2>Simulation de mise à jour V${echapper(donnees.version_cible)}</h2>
    <p>GitHub fait tout le travail de la mise à jour (${modifications}) : branche à jour de dev, modifications rejouées, note de version écrite,
    contrôle des tables, <code>db:check</code> et tous les tests. Puis il s’arrête : <strong>rien n’est poussé</strong>, ni PR, ni fusion, ni livraison.</p>
    <p class="nv-message nv-message--erreur" data-erreur hidden></p>
    <div class="nv-dev__actions"><button type="button" value="annuler">Annuler</button><button type="submit" class="nv-principal">Lancer la simulation</button></div>
  </form>`
    : `<form method="dialog">
    <h2>Effectuer la mise à jour V${echapper(donnees.version_cible)}</h2>
    <p>Les modifications du site de dev (${modifications}) et la note de version partent sur GitHub : une branche à jour de dev, une PR qui
    apporte la base modifiée, fusionnée automatiquement si les tests passent et qu’il n’y a aucun conflit, puis la <strong>livraison dev → master</strong> (production).</p>
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
      await appel('POST', 'mise-a-jour/lancer/', { confirmation: saisi, simulation });
      dialogue.close();
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
      const change = JSON.stringify(r.lancement) !== JSON.stringify(donnees.lancement);
      donnees.lancement = r.lancement;
      if (!EN_COURS.includes(r.lancement?.etat)) {
        clearInterval(suivi);
        await charger(); // fini : le brouillon a pu être libéré (simulation, échec) ; tout est relu
      } else if (change) rendre();
    } catch {
      // service relancé (nouvelle version livrée) : on réessaiera
    }
  }, 15000);
}

async function charger() {
  donnees = await appel('GET', 'mise-a-jour/');
  rendre();
  if (EN_COURS.includes(donnees.lancement?.etat)) suivre();
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
