// Script du bloc « Fabrication témoin » du menu DB de la page Debug (components/debug/SchemaDeLaBase.astro ; site de dev seulement : le composant n'est pas
// rendu en production ni dans la version portable). N'importe que lib/debug-atelier.mjs (mise en forme de l'atelier, partagée avec le service) et
// lib/debug-atelier-page.mjs (rendu HTML, pur) : aucun autre script de page n'importe ni l'un ni l'autre.
//
// Un seul appel à GET <base>api/debug/atelier/ : à la première ouverture du menu DB (un menu fermé ne demande rien), puis à chaque clic sur « Actualiser ».
// Aucune relève (la route n'est pas dans RELEVES_GET du service). 403 (pas le site de dev), 503 (pas d'atelier) : un message neutre. Le HTML vient de
// lib/debug-atelier-page.mjs, jamais écrit ici.
import { jugerLeServeur, presenterLAtelier } from '../lib/debug-atelier.mjs';
import { MESSAGES, adresseDeLAtelier, htmlDeLAtelier, lireLaReponse, resumeDeLAtelier } from '../lib/debug-atelier-page.mjs';

const cadre = document.querySelector('[data-schema-cadre]');
const bloc = document.querySelector('[data-atelier]');

if (cadre && bloc) {
  const contenu = bloc.querySelector('[data-atelier-contenu]');
  const resume = bloc.querySelector('[data-atelier-resume]');
  const bouton = bloc.querySelector('[data-atelier-actualiser]');
  const api = cadre.getAttribute('data-api') ?? '/api/';
  let enCours = false;
  let charge = false;

  const afficher = (html, texteDuResume = '') => {
    contenu.innerHTML = html;
    if (resume) resume.textContent = texteDuResume;
  };

  async function lire() {
    if (enCours) return;
    enCours = true;
    bouton.disabled = true;
    bloc.setAttribute('aria-busy', 'true');
    let lecture;
    let presentation = null;
    let jugement = null;
    try {
      const reponse = await fetch(adresseDeLAtelier(api), { cache: 'no-store', headers: { Accept: 'application/json' } });
      let corps = null;
      try {
        corps = await reponse.json();
      } catch {
        corps = null;
      }
      lecture = lireLaReponse(reponse.status, corps);
      // la présentation est dans le try : une erreur de calcul donne le message neutre, jamais un bloc figé sur « Chargement… »
      if (lecture.etat === 'ok') {
        presentation = presenterLAtelier(lecture.atelier);
        jugement = jugerLeServeur(lecture.atelier.dernier);
      }
    } catch {
      lecture = { etat: 'injoignable' };
      presentation = null;
      jugement = null;
    }
    afficher(htmlDeLAtelier(lecture, presentation, jugement) || `<p class="debug-vide">${MESSAGES.erreur}</p>`, resumeDeLAtelier(lecture, presentation));
    charge = true;
    enCours = false;
    bouton.disabled = false;
    bloc.removeAttribute('aria-busy');
  }

  bouton.addEventListener('click', lire);
  const ouvrirLaPremiereFois = () => {
    if (charge || enCours || !cadre.open) return;
    lire();
  };
  cadre.addEventListener('toggle', ouvrirLaPremiereFois);
  ouvrirLaPremiereFois();
}
