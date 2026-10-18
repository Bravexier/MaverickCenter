// Les annonces que le site place (table annonce, migration 0068) : aujourd'hui l'encart « Notre prochaine rencontre IRL » de la page Liens (demande du
// propriétaire du 2026-10-18 : « Laisse également un encart « Notre prochaine rencontre IRL » pour faire la place à une annonce dédiée aux prochaines
// conventions où Maverick sera présent » ; titre fixe, annonce modifiable sur le site de dev, texte d'attente quand elle est vide :
// lib/livres.mjs#LIENS.rencontre). Le contenu de la zone de l'annonce est le même à la construction du site (pages/decouvrir/liens.astro, le Markdown
// rendu par remark : lib/guide-rendu.ts) et dans le navigateur du site de dev (src/scripts/edition/annonces.mjs : une annonce modifiée depuis la
// construction, son Markdown rendu par lib/chronologie-rendu.mjs#htmlDuTexte) : son texte rendu, ou le texte d'attente ; la zone porte l'empreinte du
// texte (`data-annonce-empreinte`), que la surcouche du site de dev compare pour ne refaire que ce qui a changé. Pur, sans dépendance navigateur (sauf
// lib/portrait.mjs#empreinte, pur).
import { empreinte } from './portrait.mjs';

const ENTITES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const echapper = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ENTITES[c]);

/** L'annonce `id` de la base : { id, texte } (texte NULL tant que rien n'est annoncé), ou null si la ligne manque. */
export function chargerAnnonce(db, id) {
  const ligne = db.prepare('SELECT id, texte FROM annonce WHERE id = ?').get(id);
  return ligne ? { id: ligne.id, texte: ligne.texte ?? null } : null;
}

/** L'empreinte du texte d'une annonce (vide : celle de la chaîne vide), posée sur sa zone. */
export const empreinteDeLAnnonce = (texte) => empreinte(String(texte ?? ''));

/** Le contenu de la zone d'une annonce : son texte rendu (`html`) quand elle en a un, sinon le texte d'attente `vide` (échappé). */
export const contenuDeLAnnonce = (texte, html, vide) => (texte ? String(html ?? '') : `<p class="annonce__vide">${echapper(vide)}</p>`);
