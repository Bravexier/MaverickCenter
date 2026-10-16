// Le HTML des blocs d'un panneau de règles (lib/panneaux-regles-db.mjs ; migration 0055) : le même à la construction du site
// (components/equipement/PanneauDeRegles.astro, le Markdown de chaque bloc rendu par remark : lib/guide-rendu.ts) et dans le navigateur du site de dev
// (src/scripts/edition/panneaux.mjs : un bloc modifié ou créé depuis la construction, son Markdown rendu par lib/chronologie-rendu.mjs#htmlDuTexte).
// Un bloc est un élément `.preg-bloc` (du texte : `--texte`, qui suit les colonnes du panneau ; une tuile : `--tuile`, encadrée, jamais coupée entre deux
// colonnes) qui porte son rang (`data-preg-bloc`, sa clé avec le panneau), son ordre de lecture (`data-preg-ordre`) et l'empreinte de son Markdown
// (`data-preg-empreinte`, lib/portrait.mjs#empreinte : la surcouche du site de dev ne refait que les blocs dont le texte a changé) ; son contenu est
// `.preg-bloc__texte`, le titre d'une tuile `.preg-bloc__titre` (un champ `data-ed` du mode modification, caché quand il est vide). Le titre du panneau
// est écrit par le composant. Le HTML d'un texte vient de l'appelant (déjà rendu) ; les titres sont échappés ici. Pur, sans dépendance navigateur.
import { attributEd } from './edition-modele.mjs';
import { empreinte } from './portrait.mjs';

const ENTITES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const echapper = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ENTITES[c]);

/** L'identifiant HTML d'un panneau (son `<details>`) : « regles-armes ». */
export const ancreDuPanneau = (id) => `regles-${id}`;

/** L'empreinte du Markdown d'un bloc, posée sur son élément. */
export const empreinteDuTexte = (texte) => empreinte(String(texte ?? ''));

/**
 * Le HTML d'un bloc : `bloc` = sa ligne (panneau_id, rang, ordre, tuile, titre, texte), `html` = son texte rendu. Une tuile sans titre garde l'élément du
 * titre, caché (`hidden`, `data-ed-cadre`) : le mode modification l'affiche pour qu'on puisse lui en donner un.
 */
export function htmlDuBloc(bloc, html) {
  const tuile = Number(bloc.tuile) === 1;
  const attributs = `data-preg-bloc="${Number(bloc.rang)}" data-preg-ordre="${Number(bloc.ordre)}" data-preg-empreinte="${empreinteDuTexte(bloc.texte)}"`;
  const texte = `<div class="preg-bloc__texte">${html ?? ''}</div>`;
  if (!tuile) return `<div class="preg-bloc preg-bloc--texte" ${attributs}>${texte}</div>`;
  const champ = echapper(attributEd('panneau_regles_bloc', { panneau_id: bloc.panneau_id, rang: Number(bloc.rang) }, 'titre'));
  const titre = `<p class="preg-bloc__titre" data-ed-cadre${bloc.titre ? '' : ' hidden'}><span data-ed="${champ}">${echapper(bloc.titre ?? '')}</span></p>`;
  return `<div class="preg-bloc preg-bloc--tuile" ${attributs}>${titre}${texte}</div>`;
}

/** Le HTML des blocs d'un panneau, dans l'ordre donné : `blocs` = [{ …ligne, html }]. */
export const htmlDesBlocs = (blocs) => (blocs ?? []).map((b) => htmlDuBloc(b, b.html)).join('');
