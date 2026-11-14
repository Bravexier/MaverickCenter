// Les tableaux dans l'éditeur en place du mode modification (insérer un tableau, ajouter ou supprimer une ligne ou une colonne, couleur des cases), partagés par
// toutes les barres qui rendent du Markdown : le texte du guide et du Codex (edition/guide.mjs), les descriptions de la chronologie (edition/chronologie.mjs), les blocs des
// panneaux de règles (edition/panneaux.mjs) et l'annonce de l'accueil (edition/annonces.mjs) — demande du propriétaire : « retravaille le contenu de tous les menu
// d'édition : de manière à pouvoir faire manuellement ce genre de tableau et d'onglet ». Le HTML d'un tableau est réécrit en Markdown (GFM) par lib/markdown-edition.mjs ;
// la couleur d'une case s'écrit « {couleur:x} » en tête de case (lib/couleurs-ecrites.mjs : un des sept noms d'avant, une couleur du site « famille:id » ou « #rrggbb »,
// le même choix que celui d'un mot-clé du glossaire : edition/couleurs.mjs), par `data-couleur` et les classes de la palette (classList : jamais un style).
// Ce module ne touche qu'au DOM ; `texte` est l'éditeur en place de la barre (texte-en-place.mjs#editeurEnPlace), `zones()` ses zones modifiables.
import { classesDeCase, CLASSE_DE_CASE_COLOREE } from '../../lib/couleurs-ecrites.mjs';
import { ajouterLeChoixDeCouleur, memoireDeLaPlage } from './couleurs.mjs';

const nouvelleCase = (balise) => {
  const c = document.createElement(balise);
  c.append(document.createElement('br'));
  return c;
};

/** Les outils des tableaux d'une barre : `{ groupe (le groupe « Tableau » des barres d'outils), brancher(zone, signal), ajouterLaCouleur(ed, barre, signal) }`. */
export function outilsDesTableaux(texte, zones) {
  const { plage, proche } = texte;
  const caseCourante = (r) => proche(r, 'td, th');
  let plageDuMoment = plage;

  function inserer(ed) {
    const r = plage();
    if (!r) return ed.annoncer('Placez d’abord le curseur là où le tableau doit aller.');
    if (caseCourante(r)) return ed.annoncer('Un tableau ne se met pas dans un autre.');
    document.execCommand('insertHTML', false, '<table><thead><tr><th>Titre</th><th>Titre</th></tr></thead><tbody><tr><td>Case</td><td>Case</td></tr></tbody></table><p><br></p>');
    ed.marquerModifie();
  }

  function surLaCase(ed, faire) {
    const c = caseCourante(plage());
    if (!c) return ed.annoncer('Placez d’abord le curseur dans une case du tableau.');
    const ligne = c.parentElement;
    const table = c.closest('table');
    faire({ c, ligne, table, index: [...ligne.children].indexOf(c), lignes: [...table.querySelectorAll('tr')] });
    ed.marquerModifie();
  }

  const ajouterLigne = (ed) =>
    surLaCase(ed, ({ ligne, table, lignes }) => {
      const largeur = Math.max(...lignes.map((l) => l.children.length));
      const tr = document.createElement('tr');
      for (let i = 0; i < largeur; i++) tr.append(nouvelleCase('td'));
      if (ligne.parentElement.tagName === 'THEAD') {
        let corps = table.querySelector('tbody');
        if (!corps) table.append((corps = document.createElement('tbody')));
        corps.prepend(tr);
      } else ligne.after(tr);
    });

  const ajouterColonne = (ed) =>
    surLaCase(ed, ({ index, lignes }) => {
      for (const l of lignes) {
        const c = nouvelleCase(l.parentElement.tagName === 'THEAD' || [...l.children].every((x) => x.tagName === 'TH') ? 'th' : 'td');
        const voisine = l.children[index];
        if (voisine) voisine.after(c);
        else l.append(c);
      }
    });

  const supprimerLigne = (ed) =>
    surLaCase(ed, ({ ligne }) => {
      if (ligne.parentElement.tagName === 'THEAD') {
        ed.annoncer('La ligne d’en-tête d’un tableau reste (videz ses cases si besoin).');
        return;
      }
      ligne.remove();
    });

  const supprimerColonne = (ed) =>
    surLaCase(ed, ({ index, lignes, table }) => {
      for (const l of lignes) l.children[index]?.remove();
      if (lignes.every((l) => !l.children.length)) table.remove();
    });

  /** Les cases choisies : celle du curseur et celles de la sélection. */
  function casesChoisies(r) {
    const cases = new Set();
    const courante = r ? caseCourante(r) : null;
    if (courante) cases.add(courante);
    if (r) for (const z of zones()) for (const c of z.querySelectorAll('td, th')) if (r.intersectsNode(c)) cases.add(c);
    return cases;
  }

  /** Pose la couleur `valeur` (« » : aucune) sur les cases choisies : `data-couleur` (que relit le Markdown) et les classes de la palette. */
  function colorer(ed, valeur) {
    const cases = casesChoisies(plageDuMoment());
    if (!cases.size) return ed.annoncer('Placez d’abord le curseur dans une case du tableau.');
    const classes = valeur ? classesDeCase(valeur) : [];
    if (valeur && !classes.length) return ed.annoncer('Cette couleur n’est pas lisible.');
    for (const c of cases) {
      for (const k of [...c.classList]) if (k === CLASSE_DE_CASE_COLOREE || k.startsWith('couleur-')) c.classList.remove(k);
      if (valeur) {
        c.dataset.couleur = valeur;
        c.classList.add(...classes);
      } else {
        delete c.dataset.couleur;
        if (!c.classList.length) c.removeAttribute('class');
      }
    }
    ed.marquerModifie();
  }

  return {
    /** Le groupe « Tableau » des barres d'outils ([nom, [[étiquette, titre, action]]]). */
    groupe: ['Tableau', [
      ['Tableau', 'Insérer un tableau', inserer],
      ['+ ligne', 'Ajouter une ligne sous la case', ajouterLigne],
      ['+ colonne', 'Ajouter une colonne à droite de la case', ajouterColonne],
      ['− ligne', 'Supprimer la ligne de la case', supprimerLigne],
      ['− colonne', 'Supprimer la colonne de la case', supprimerColonne],
    ]],

    /** Dans une case, Entrée passe à la ligne dans la case (un tableau Markdown n'a pas de paragraphe dans une case) : à brancher sur chaque zone. */
    brancher(zone, signal) {
      zone.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && caseCourante(plage())) {
          e.preventDefault();
          document.execCommand('insertLineBreak');
        }
      }, { signal });
    },

    /** « Case : » : le choix d'une couleur de case (la liste des couleurs du glossaire, « Aucune » pour la retirer), ajouté à la barre `barre` (élément). */
    ajouterLaCouleur(ed, barre, signal) {
      plageDuMoment = memoireDeLaPlage(texte, signal);
      const groupe = document.createElement('div');
      groupe.className = 'ed-barre-guide__groupe';
      groupe.setAttribute('role', 'group');
      groupe.setAttribute('aria-label', 'Couleur des cases');
      barre.append(groupe);
      ajouterLeChoixDeCouleur(ed, groupe, {
        etiquette: 'Case :',
        libelle: 'Couleur de la case',
        signal,
        lire: () => caseCourante(plageDuMoment())?.dataset.couleur ?? '',
        appliquer: (valeur) => colorer(ed, valeur),
      });
    },
  };
}
