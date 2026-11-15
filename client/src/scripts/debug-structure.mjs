// Script du bloc « Structure de la base » du menu DB de la page Debug (components/debug/SchemaDeLaBase.astro ; site de dev seulement : le composant
// n'est pas rendu en production ni dans la version portable). N'importe que lib/debug-structure.mjs (pur), qu'aucun autre script de page n'importe.
//
// Un seul appel à GET <base>api/debug/structure/ : à la première ouverture du menu DB (un menu fermé ne demande rien), puis à chaque clic sur
// « Actualiser ». Aucune relève : la route est une lecture sans cache (`no-store`), et la page ne la répète jamais d'elle-même (elle n'est pas dans
// RELEVES_GET du service). 403 (pas le site de dev), 503 : un message neutre. Le HTML vient de lib/debug-structure.mjs, jamais écrit ici.
import { MESSAGES, adresseDeLaStructure, htmlDeLaStructure, lireLaReponse, resumeDeLaStructure } from '../lib/debug-structure.mjs';

const cadre = document.querySelector('[data-schema-cadre]');
const bloc = document.querySelector('[data-structure]');

if (cadre && bloc) {
  const contenu = bloc.querySelector('[data-structure-contenu]');
  const resume = bloc.querySelector('[data-structure-resume]');
  const bouton = bloc.querySelector('[data-structure-actualiser]');
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
    try {
      const reponse = await fetch(adresseDeLaStructure(api), { cache: 'no-store', headers: { Accept: 'application/json' } });
      let corps = null;
      try {
        corps = await reponse.json();
      } catch {
        corps = null;
      }
      lecture = lireLaReponse(reponse.status, corps);
    } catch {
      lecture = { etat: 'injoignable' };
    }
    afficher(htmlDeLaStructure(lecture) || `<p class="debug-vide">${MESSAGES.erreur}</p>`, resumeDeLaStructure(lecture));
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
