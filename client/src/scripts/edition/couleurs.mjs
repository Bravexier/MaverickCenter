// Le choix d'une couleur dans les barres d'outils du mode modification (couleur d'une case de tableau, d'un onglet) : la liste des couleurs du site que propose
// l'édition d'un mot-clé du glossaire (demande du propriétaire : « Pour les couleurs il faudra reprendre la liste des couleurs de l'édition des mots clés du
// glossaire »), c'est-à-dire le contrôle de l'éditeur (`ed.champ({ type: 'couleur' })` : editeur.mjs#controleDeCouleur : la liste groupée par famille et un
// cercle pour une autre couleur, « #rrggbb »), avec « Aucune » pour retirer la couleur. La liste vient de /couleurs-du-site.json (pages/couleurs-du-site.json.ts :
// lib/glossaire-couleurs.mjs, la même que celle du Glossaire), lue une fois, au premier besoin.
// Une couleur choisie se pose par sa classe (lib/couleurs-ecrites.mjs), jamais en style : si la page ne porte pas encore la règle de cette classe (une famille d'une
// zone, une couleur écrite), elle est ajoutée à la feuille `<style data-couleurs-texte>` (components/SupportDuMarkdown.astro ; lib/palette-css.mjs#cssDesCouleursEcrites).
import { cssDesCouleursEcrites } from '../../lib/palette-css.mjs';

let liste = null;
/** Les couleurs du site, groupées par famille : [{ famille, libelle, couleurs: [{ valeur, libelle, classe, fond }] }] (lues une fois par page). */
export function couleursDuSite(ed) {
  liste ??= fetch(`${ed.base || '/'}couleurs-du-site.json`)
    .then((r) => {
      if (!r.ok) throw new Error(`liste des couleurs indisponible (${r.status})`);
      return r.json();
    })
    .catch((e) => {
      liste = null;
      throw e;
    });
  return liste;
}

/** S'assure que la page a la règle de la classe de la couleur `valeur` (« famille:id », « #rrggbb » : lib/couleurs-ecrites.mjs) ; rien pour un des sept noms d'avant. */
export function poserLaCouleur(valeur) {
  const css = cssDesCouleursEcrites([valeur]);
  if (!css) return;
  let feuille = document.querySelector('style[data-couleurs-texte]');
  if (!feuille) {
    feuille = document.createElement('style');
    feuille.setAttribute('data-couleurs-texte', '');
    document.head.append(feuille);
  }
  if (!feuille.textContent.includes(css)) feuille.textContent += css;
}

/**
 * Retient la dernière plage du curseur dans une zone de l'éditeur en place `texte` (editeurEnPlace) : choisir une couleur dans la liste d'une barre peut
 * en retirer la sélection ; `plage()` rend la plage du moment, sinon la dernière retenue (si ses nœuds sont encore dans la page).
 */
export function memoireDeLaPlage(texte, signal) {
  let derniere = null;
  document.addEventListener('selectionchange', () => {
    const r = texte.plage();
    if (r) derniere = r.cloneRange();
  }, { signal });
  return () => texte.plage() ?? (derniere?.commonAncestorContainer?.isConnected ? derniere : null);
}

/**
 * Pose, dans le groupe `groupe` d'une barre (élément), le choix d'une couleur : `etiquette` (texte court devant), puis la liste des couleurs du site, une fois lue.
 * `lire()` rend la valeur de ce qui est sous le curseur (pour la montrer : « » sans couleur) ; `appliquer(valeur)` la pose (valeur écrite, ou '' pour la retirer).
 * Rend `{ actualiser }`.
 */
export function ajouterLeChoixDeCouleur(ed, groupe, { etiquette, libelle, lire, appliquer, signal }) {
  if (typeof ed.champ !== 'function') return { actualiser() {} }; // un éditeur sans champs à part (les tests des extensions, dans un faux navigateur) : rien à poser
  const titre = document.createElement('span');
  titre.className = 'ed-barre-guide__titre';
  titre.textContent = etiquette;
  const emplacement = document.createElement('span');
  groupe.append(titre, emplacement);
  let controle = null;
  const actualiser = () => {
    if (!controle || controle.element.contains(document.activeElement)) return;
    const v = lire() ?? '';
    if (controle.element.value !== v) controle.element.value = v;
  };
  couleursDuSite(ed).catch((e) => {
    ed.annoncer(`Les couleurs du site n’ont pas pu être lues : ${e.message}. Une couleur écrite (#rrggbb) reste possible.`, 'erreur');
    return [];
  }).then((choix) => {
    controle = ed.champ({ type: 'couleur', libelle, choix, valeur: lire() ?? '' });
    controle.element.addEventListener('input', () => {
      const valeur = controle.lire();
      if (valeur) poserLaCouleur(valeur);
      appliquer(valeur);
    });
    emplacement.replaceWith(controle.element);
  });
  document.addEventListener('selectionchange', actualiser, { signal });
  return { actualiser };
}
