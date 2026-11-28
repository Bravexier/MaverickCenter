// Le HTML d'une ancre propre à une page dans le menu latéral du site (R321 (2) et (6) : les sections d'une page de magie ou de classe, sous l'entrée de la page courante,
// sur sa page seulement) : un `<li>` d'un lien vers `#…`, jamais « courant ». Pur, sans DOM ni Astro, sans import : lib/menu-rendu.mjs le pose au build, le mode modification
// des classes (scripts/edition/classes.mjs) redessine les ancres d'une classe avec le même balisage.
const ENTITES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const echapper = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ENTITES[c]);

/**
 * Le `<li>` d'une ancre : `ancre` (« #presentation »), `libelle` (le nom montré), `enfants` (ses sous-ancres, toujours dépliées : R321 (6), les spécialités sous « Dons »).
 */
export const htmlDUneAncre = ({ ancre, libelle, enfants }) => {
  const sous = enfants?.length ? `<ul class="menu-site__sous-liste menu-site__sous-ancres">${enfants.map(htmlDUneAncre).join('')}</ul>` : '';
  return `<li><a class="menu-site__lien menu-site__lien--ancre" href="${echapper(ancre)}">${echapper(libelle)}</a>${sous}</li>`;
};
