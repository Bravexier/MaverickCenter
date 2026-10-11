// Page « Maintenance en cours » (pages/maintenance.astro ; serveur/maintenance.mjs). Toutes les 3 s, demande au service si CE serveur est encore
// en maintenance (GET /api/maintenance/) : oui → l'étape de la mise à jour ; non → retour immédiat à la page d'où l'on venait (`?retour=`, une
// adresse de ce site seulement), sinon à l'accueil. Service injoignable (il redémarre avec la nouvelle version) : on attend et on redemande.
// Site de dev : le lien vers le run GitHub et « Lever la maintenance » (les deux serveurs rouvrent, la mise à jour continue).
// Seul ce script importe lib/maintenance-retour.mjs (aucun module partagé entre scripts de page ; la version portable ne charge pas ce script).
import { adresseDeRetour } from '../lib/maintenance-retour.mjs';

const racine = document.querySelector('[data-maintenance]');
const api = racine?.dataset.api ?? '/api/';
const accueil = racine?.dataset.accueil ?? '/';
const INTERVALLE = 3000;

const retour = () => adresseDeRetour(location.search, { origine: location.origin, accueil });

const heure = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
};

const ORDRE = ['preparation', 'livraison', 'installation'];
let dernier = '';

function montrer(m) {
  const cle = JSON.stringify(m);
  if (cle === dernier) return;
  dernier = cle;
  const detail = racine.querySelector('[data-maintenance-detail]');
  const debut = heure(m.depuis);
  detail.textContent = `Mise à jour du site vers la version ${m.version_cible}${debut ? `, commencée à ${debut}` : ''}.`;
  detail.hidden = false;
  const etapes = racine.querySelector('[data-maintenance-etapes]');
  const rang = ORDRE.indexOf(m.etape);
  for (const li of etapes.querySelectorAll('li')) {
    const i = ORDRE.indexOf(li.dataset.etape);
    li.classList.toggle('fait', rang >= 0 && i < rang);
    if (i === rang) li.setAttribute('aria-current', 'step');
    else li.removeAttribute('aria-current');
  }
  etapes.hidden = rang < 0;
  const dev = racine.querySelector('[data-maintenance-dev]');
  if (!m.levable) {
    dev.hidden = true;
    dev.textContent = '';
    return;
  }
  dev.innerHTML = `<p>Site de dev : la production attend sa propre installation, indépendamment de celle-ci.${m.run ? ' <a data-maintenance-run rel="noopener noreferrer" target="_blank">Voir le workflow sur GitHub</a>' : ''}</p>
    <button type="button" data-maintenance-lever>Lever la maintenance (les deux sites)</button> <span data-maintenance-erreur></span>`;
  if (m.run) dev.querySelector('[data-maintenance-run]').href = m.run;
  dev.querySelector('[data-maintenance-lever]').addEventListener('click', () => lever(m.lot));
  dev.hidden = false;
}

async function lever(lot) {
  if (!window.confirm('Lever la maintenance des deux sites ? La mise à jour continue : les pages redeviennent accessibles avant qu’elle soit finie.')) return;
  const erreur = racine.querySelector('[data-maintenance-erreur]');
  try {
    const r = await fetch(`${api}maintenance/lever/`, {
      method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify({ lot }), cache: 'no-store',
    });
    const corps = await r.json().catch(() => null);
    if (!r.ok) throw new Error(corps?.erreur ?? `Le service a répondu ${r.status}.`);
    if (!corps?.active) location.replace(retour());
  } catch (e) {
    erreur.textContent = e.message;
  }
}

let minuterie = null;
async function verifier() {
  clearTimeout(minuterie);
  try {
    const r = await fetch(`${api}maintenance/`, { cache: 'no-store', headers: { Accept: 'application/json' } });
    // 404 : le service ne connaît pas la maintenance, ou il n'y a pas de service (site statique) — rien n'est en maintenance
    if (r.status === 404) return location.replace(retour());
    if (r.ok) {
      const m = await r.json();
      if (m?.active !== true) return location.replace(retour());
      montrer(m);
    }
  } catch {
    // service injoignable (il redémarre avec la nouvelle version) : on redemande
  }
  minuterie = setTimeout(verifier, INTERVALLE);
}

if (racine) {
  verifier();
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) verifier();
  });
}
