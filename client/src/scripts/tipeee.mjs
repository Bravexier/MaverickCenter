// La partie « Bienvenue » de Tipeee sous le texte de Bienvenue (components/guide/SousBienvenue.astro ; réponses du propriétaire du 2026-10-22 : « autant
// en faire un hook pour que ça reprenne directement le texte au cas où il change sur Tipee », « En direct par le serveur ») : la page construite montre
// l'instantané livré avec le site ; ce script demande au service le texte qu'il a relu sur Tipeee (GET /api/tipeee/ : { paragraphes, lu_le, origine },
// serveur/tipeee.mjs) et, s'il diffère, remplace les paragraphes de la citation `[data-tipeee]`, en TEXTE seulement (textContent : rien de Tipeee n'est
// jamais lu comme du HTML). Une réponse vide, mal formée ou hors des bornes du module pur (PARAGRAPHES_MAX, CARACTERES_MAX), une erreur, un service
// absent : l'instantané reste. Absent de la version portable (pas de service).
// Seul script de page à importer lib/tipeee.mjs (skill site-version-portable). Exécuté dans un faux navigateur par test/tipeee-script.test.mjs.
import { CARACTERES_MAX, memesParagraphes, PARAGRAPHES_MAX } from '../lib/tipeee.mjs';

/** Les paragraphes d'une réponse du service, s'ils se montrent tels quels : des textes non vides, dans les bornes ; null sinon. */
function paragraphesDe(reponse) {
  const p = reponse?.paragraphes;
  if (!Array.isArray(p) || !p.length || p.length > PARAGRAPHES_MAX) return null;
  if (!p.every((x) => typeof x === 'string' && x.trim())) return null;
  if (p.reduce((n, x) => n + x.length, 0) > CARACTERES_MAX) return null;
  return p;
}

async function suivreTipeee() {
  const zone = document.querySelector('[data-tipeee]');
  if (!zone?.dataset.tipeeeApi) return;
  try {
    const r = await fetch(zone.dataset.tipeeeApi, { headers: { Accept: 'application/json' } });
    if (!r.ok) return;
    const reponse = await r.json();
    const nouveaux = paragraphesDe(reponse);
    const actuels = [...zone.querySelectorAll('p')].map((p) => p.textContent);
    if (!nouveaux || memesParagraphes(actuels, nouveaux)) return;
    const elements = nouveaux.map((texte) => {
      const p = document.createElement('p');
      p.textContent = texte;
      return p;
    });
    zone.replaceChildren(...elements);
    if (typeof reponse.lu_le === 'string') zone.dataset.tipeeeLuLe = reponse.lu_le; // la lecture de Tipeee dont vient le texte affiché
  } catch {
    // service absent ou réponse illisible : l'instantané reste
  }
}

suivreTipeee();
