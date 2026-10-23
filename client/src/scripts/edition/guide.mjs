// Extension de l'éditeur pour les pages du guide (components/guide/PageDuGuide.astro, toutes rubriques : Découvrir, Les bases, Règles avancées, Guide
// du MJ) et du Codex (pages/[type]/[slug].astro) —
// demande du propriétaire : « le texte de chaque page, les liens (ou non), la mise en page, les tableaux et les cases, ainsi que leur couleur ».
// En mode modification, chaque morceau de texte [data-ed-morceau] devient modifiable en place (contenteditable) ; les blocs tirés de la base (tableaux
// de la montée de niveau, personnages fil rouge…) restent tels quels. Une barre d'outils pose la mise en page (paragraphe, titres, citation, listes,
// gras, italique, barré), les liens (vers une page du wiki : [[cible|texte]], ou une adresse web ; retirer un lien) et les tableaux (insérer, ajouter
// ou supprimer une ligne ou une colonne, couleur des cases), les mots-clés du glossaire (texte-en-place.mjs#outilsDesMotsCles). À l'enregistrement,
// le HTML de chaque morceau modifié est réécrit en Markdown (lib/markdown-edition.mjs) et remis à sa place dans le corps de la page, autour des blocs ;
// son HTML assaini part avec, comme aperçu montré tant que la page construite ne l'a pas (surcouche).
import { cleDeLigne } from '../../lib/edition-modele.mjs';
import { arbreDuDom, COULEURS_DE_CASE, decouperCorps, htmlSur, recomposerCorps, versMarkdown } from '../../lib/markdown-edition.mjs';
import { editeurEnPlace, outilsDesMotsCles } from './texte-en-place.mjs';

const ETIQUETTES_COULEUR = { rouge: 'Rouge', orange: 'Orange', jaune: 'Jaune', vert: 'Vert', bleu: 'Bleu', violet: 'Violet', gris: 'Gris' };

const etat = {
  actif: false, // les morceaux sont modifiables
  perime: false, // la base a un texte plus récent que la page, sans aperçu : on ne peut pas le modifier ici
  morceaux: [],
  original: [], // HTML des morceaux au passage en mode modification (rendu si l'on abandonne)
  initial: [], // leur Markdown à ce moment : un morceau qui le redonne n'a pas changé
  envoye: null, // aperçu envoyé avec le dernier enregistrement
  barre: null,
  abandon: null,
};

const corpsId = () => document.querySelector('[data-ed-corps]')?.dataset.edCorps ?? null;
const morceauxDeLaPage = () => [...document.querySelectorAll('[data-ed-morceau]')];
const enfantsDe = (el) => [...el.childNodes].map(arbreDuDom).filter(Boolean);

/** HTML reçu (aperçu d'une modification) → HTML assaini, par le même filtre que l'envoi (lib/markdown-edition.mjs#htmlSur). */
function assainir(html) {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  return htmlSur(enfantsDe(doc.body));
}

/**
 * Une adresse du site écrite depuis la racine, comme dans le Markdown (« /races/ ») : sans le préfixe de déploiement. Un lien écrit vers une ancienne
 * adresse du guide (« /guide/les-postures/ ») n'y passe pas : versMarkdown relit son adresse écrite (`data-lien-ecrit`, lib/guide.mjs#remarkAnciensLiensDuGuide),
 * jamais celle du plan qu'il montre (« /regles/les-postures/ ») : modifier la page ne réécrit pas ses liens.
 */
function lienRelatif(ed) {
  const base = ed.base || '/';
  return (href) => (base !== '/' && href.startsWith(base) ? `/${href.slice(base.length)}` : href);
}
const markdownDe = (ed, el) => versMarkdown(enfantsDe(el), { lienRelatif: lienRelatif(ed) });

// --- Sélection, commandes, liens : l'éditeur en place partagé (texte-en-place.mjs), sur les morceaux du corps -----------------------------------
const texte = editeurEnPlace(() => etat.morceaux);
const { plage, proche, commande, bloc, lienWiki, lienWeb, retirerLien } = texte;

// --- Tableaux ---------------------------------------------------------------------------------------------------------------------------------
const caseCourante = (r) => proche(r, 'td, th');
const nouvelleCase = (balise) => {
  const c = document.createElement(balise);
  c.append(document.createElement('br'));
  return c;
};

function insererTableau(ed) {
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

/** Couleur des cases choisies (ou de la case du curseur) ; null : sans couleur. */
function couleur(ed, nom) {
  const r = plage();
  if (!r) return ed.annoncer('Placez d’abord le curseur dans une case du tableau.');
  const cases = new Set();
  const courante = caseCourante(r);
  if (courante) cases.add(courante);
  for (const m of etat.morceaux) for (const c of m.querySelectorAll('td, th')) if (r.intersectsNode(c)) cases.add(c);
  if (!cases.size) return ed.annoncer('Placez d’abord le curseur dans une case du tableau.');
  for (const c of cases) {
    if (nom) c.dataset.couleur = nom;
    else delete c.dataset.couleur;
  }
  ed.marquerModifie();
}

// --- Barre d'outils ---------------------------------------------------------------------------------------------------------------------------
const OUTILS = [
  ['Mise en page', [
    ['¶', 'Paragraphe', (ed) => bloc(ed, 'p')],
    ['Titre', 'Titre de section', (ed) => bloc(ed, 'h2')],
    ['Sous-titre', 'Sous-titre', (ed) => bloc(ed, 'h3')],
    ['« »', 'Citation', (ed) => bloc(ed, 'blockquote')],
    ['• Liste', 'Liste à puces', (ed) => commande(ed, 'insertUnorderedList')],
    ['1. Liste', 'Liste numérotée', (ed) => commande(ed, 'insertOrderedList')],
  ]],
  ['Texte', [
    ['G', 'Gras (Ctrl+B)', (ed) => commande(ed, 'bold'), 'ed-gras'],
    ['I', 'Italique (Ctrl+I)', (ed) => commande(ed, 'italic'), 'ed-italique'],
    ['S', 'Barré', (ed) => commande(ed, 'strikeThrough'), 'ed-barre'],
    ['Effacer', 'Retirer gras, italique et barré du texte choisi', (ed) => commande(ed, 'removeFormat')],
  ]],
  ['Liens', [
    ['Lien page', 'Lien vers une page du wiki', lienWiki],
    ['Lien web', 'Lien vers une adresse web', lienWeb],
    ['Sans lien', 'Retirer le lien (le texte reste)', retirerLien],
  ]],
  outilsDesMotsCles(texte),
  ['Tableau', [
    ['Tableau', 'Insérer un tableau', insererTableau],
    ['+ ligne', 'Ajouter une ligne sous la case', ajouterLigne],
    ['+ colonne', 'Ajouter une colonne à droite de la case', ajouterColonne],
    ['− ligne', 'Supprimer la ligne de la case', supprimerLigne],
    ['− colonne', 'Supprimer la colonne de la case', supprimerColonne],
  ]],
];

function barreDOutils(ed) {
  const { element: barre, ajouter } = texte.barre(ed, OUTILS, 'Mise en forme du texte du guide');
  const couleurs = document.createElement('div');
  couleurs.className = 'ed-barre-guide__groupe';
  couleurs.setAttribute('role', 'group');
  couleurs.setAttribute('aria-label', 'Couleur des cases');
  const titre = document.createElement('span');
  titre.className = 'ed-barre-guide__titre';
  titre.textContent = 'Case :';
  couleurs.append(titre);
  for (const nom of COULEURS_DE_CASE) {
    const b = ajouter(couleurs, '', `Case ${ETIQUETTES_COULEUR[nom].toLowerCase()}`, (e) => couleur(e, nom), 'ed-couleur');
    b.dataset.couleur = nom;
  }
  ajouter(couleurs, '∅', 'Case sans couleur', (e) => couleur(e, null), 'ed-couleur');
  barre.append(couleurs);
  return barre;
}

// --- Extension --------------------------------------------------------------------------------------------------------------------------------
export const guide = {
  nom: 'guide',
  actif: (doc) => Boolean(doc.querySelector('[data-ed-corps]')),

  lignesACharger: () => (corpsId() ? [{ table: 'page', cle: { id: corpsId() } }] : []),

  /** Le texte modifié depuis la construction de la page : son aperçu à la place du texte construit (ou un avertissement s'il n'en a pas). */
  surcouche(ed, lignes) {
    const id = corpsId();
    const enAttente = lignes.find((l) => l.table === 'page' && l.cle?.id === id && 'apercu' in l);
    if (!enAttente) return;
    const morceaux = morceauxDeLaPage();
    if (Array.isArray(enAttente.apercu) && enAttente.apercu.length === morceaux.length) {
      morceaux.forEach((m, i) => (m.innerHTML = assainir(enAttente.apercu[i])));
    } else {
      etat.perime = true;
      ed.annoncer('Le texte de cette page a changé depuis la construction du site : il s’affichera à la prochaine mise à jour du site.');
    }
  },

  debut(ed) {
    const id = corpsId();
    const ligne = ed.lignes?.get(cleDeLigne('page', { id }));
    const morceaux = morceauxDeLaPage();
    if (!ligne || !morceaux.length) return;
    if (etat.perime || decouperCorps(ligne.corps_md).filter((m) => m.visible).length !== morceaux.length) {
      ed.annoncer('Le texte de cette page ne peut pas être modifié ici tant que le site n’a pas été reconstruit (le titre, si).', 'erreur');
      return;
    }
    document.execCommand('defaultParagraphSeparator', false, 'p');
    etat.abandon = new AbortController();
    const { signal } = etat.abandon;
    Object.assign(etat, { actif: true, morceaux, original: morceaux.map((m) => m.innerHTML), initial: [], envoye: null });
    for (const m of morceaux) {
      // modifiable en place (texte-en-place.mjs : saisie suivie, collage en texte seul, lien qui ne s'ouvre pas au clic)
      texte.rendreModifiable(ed, m, signal);
      m.addEventListener('keydown', (e) => {
        // dans une case de tableau, Entrée passe à la ligne dans la case (un tableau Markdown n'a pas de paragraphe dans une case)
        if (e.key === 'Enter' && caseCourante(plage())) {
          e.preventDefault();
          document.execCommand('insertLineBreak');
        }
      }, { signal });
    }
    // le Markdown relu à l'entrée, une fois les mots-clés en balises écrites (rendreModifiable) : un morceau qu'on ne retouche pas n'est pas envoyé
    etat.initial = morceaux.map((m) => markdownDe(ed, m));
    etat.barre = barreDOutils(ed);
    document.body.append(etat.barre);
  },

  verifier(ed) {
    if (!etat.actif) return null;
    const vide = etat.morceaux.findIndex((m) => markdownDe(ed, m).trim() === '');
    if (vide >= 0) {
      etat.morceaux[vide].focus();
      return 'Un morceau de texte de la page est vide : remettez-y au moins une phrase (les tableaux tirés de la base qui l’entourent restent à leur place).';
    }
    return null;
  },

  operations(ed, operations) {
    etat.envoye = null;
    if (!etat.actif) return operations;
    const nouveaux = etat.morceaux.map((m, i) => {
      const md = markdownDe(ed, m);
      return md.trim() === etat.initial[i].trim() ? null : md;
    });
    if (nouveaux.every((n) => n === null)) return operations;
    const id = corpsId();
    const ligne = ed.lignes.get(cleDeLigne('page', { id }));
    const apercu = etat.morceaux.map((m) => htmlSur(enfantsDe(m)));
    let op = operations.find((o) => o.op === 'modifier' && o.table === 'page' && o.cle?.id === id);
    if (!op) operations.push((op = { op: 'modifier', table: 'page', cle: { id }, valeurs: {}, avant: {} }));
    op.valeurs.corps_md = recomposerCorps(ligne.corps_md, nouveaux);
    op.avant.corps_md = ligne.corps_md;
    op.apercu = apercu;
    etat.envoye = apercu;
    return operations;
  },

  fin() {
    // abandon : le texte d'avant revient ; enregistrement : apresEnregistrement pose ensuite le texte enregistré
    if (etat.actif) etat.morceaux.forEach((m, i) => (m.innerHTML = etat.original[i]));
    for (const m of etat.morceaux) {
      m.removeAttribute('contenteditable');
      m.classList.remove('ed-texte-guide');
    }
    etat.abandon?.abort();
    etat.barre?.remove();
    Object.assign(etat, { actif: false, barre: null, abandon: null });
  },

  apresEnregistrement(ed, resultat) {
    const id = corpsId();
    if (!etat.envoye || !resultat.lignes?.some((l) => l.table === 'page' && l.cle?.id === id)) return;
    etat.morceaux.forEach((m, i) => (m.innerHTML = etat.envoye[i]));
    etat.envoye = null;
  },
};
