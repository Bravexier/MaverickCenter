// Les groupes d'onglets dans l'éditeur en place du mode modification (demande du propriétaire : « retravaille le contenu de tous les menu d'édition : de manière à
// pouvoir faire manuellement ce genre de tableau et d'onglet », « Onglets dans la barre du guide ») : partagés par toutes les barres qui rendent du Markdown (guide et
// Codex, chronologie, panneaux de règles, annonce). Le groupe est celui du rendu (`div[data-onglets-md]` : lib/onglets-groupe.mjs, lib/markdown-onglets.mjs) ; l'éditeur
// le relit en `::: onglets` (lib/markdown-edition.mjs#versMarkdown : par panneau, son intertitre `###`, sa couleur `{couleur:…}` et son ancre figée).
//   - « Onglets » : les sous-titres (`###`) choisis deviennent les onglets d'un groupe, chacun avec le texte qui les suit jusqu'au sous-titre suivant (le dernier, jusqu'au
//     prochain titre ou la fin du texte) ;
//   - « + onglet » : un onglet de plus après celui du curseur (son intertitre porte une ancre figée neuve : son adresse ne change pas quand on le renomme) ;
//   - « − onglet » : retire l'onglet du curseur et son texte (un groupe garde au moins un onglet) ;
//   - « Sortir des onglets » : le groupe redevient du texte à la suite, ses intertitres gardés (la couleur d'un onglet n'a plus de place) ;
//   - « Onglet : » : la couleur de l'onglet du curseur, la liste des couleurs du glossaire (edition/couleurs.mjs).
// La barre est refaite d'après les panneaux à chaque changement (lib/onglets-groupe.mjs#htmlDeLaBarre : le texte de l'intertitre, la classe de la couleur) et le script
// partagé des onglets (components/Onglets.astro) la rebranche (`onglets:brancher`) ; un clic sur un onglet ouvre son panneau ici aussi, que ce script soit sur la page ou non
// (`brancherLesOnglets`, aperçu d'un texte en attente compris). Ce module ne touche qu'au DOM.
import { classeDeLaCouleurEcrite } from '../../lib/couleurs-ecrites.mjs';
import { CLASSES_DES_ONGLETS, htmlDeLaBarre } from '../../lib/onglets-groupe.mjs';
import { normalize } from '../../lib/text.mjs';
import { ajouterLeChoixDeCouleur, memoireDeLaPlage, poserLaCouleur } from './couleurs.mjs';

const PANNEAU = `section.${CLASSES_DES_ONGLETS.panneau}`;
const GROUPE = '[data-onglets-md]';
const ONGLET = `.${CLASSES_DES_ONGLETS.onglet}`;

const panneauxDe = (groupe) => [...groupe.children].filter((c) => c.matches(PANNEAU));
const titreDe = (panneau) => panneau.querySelector(':scope > h1, :scope > h2, :scope > h3, :scope > h4, :scope > h5, :scope > h6');
const libelleDe = (panneau) => (titreDe(panneau)?.textContent ?? '').replace(/\s+/g, ' ').trim() || panneau.id;

/**
 * La feuille des onglets (styles/guide/onglets.css), posée si la page n'en a pas (components/SupportDuMarkdown.astro ne la pose que pour un groupe du texte construit) : un
 * groupe écrit ou refait depuis la construction du site doit se voir. Chargée à la demande (`import()` : jamais lue hors du navigateur) ; sans effet si elle est déjà là.
 */
async function assurerLaFeuille() {
  if (document.querySelector('style[data-onglets-feuille]')) return;
  try {
    const { default: css } = await import('../../styles/guide/onglets.css?raw');
    if (document.querySelector('style[data-onglets-feuille]')) return;
    const feuille = document.createElement('style');
    feuille.setAttribute('data-onglets-feuille', '');
    feuille.textContent = css;
    document.head.append(feuille);
  } catch {
    // hors d'un navigateur (tests) : rien
  }
}

/** Ouvre l'onglet du panneau `panneau` dans son groupe (classe `is-active` de l'onglet et du panneau, comme le script des onglets). */
export function ouvrirLOnglet(groupe, panneau) {
  const panneaux = panneauxDe(groupe);
  for (const p of panneaux) {
    const actif = p === panneau;
    p.classList.toggle('is-active', actif);
    const lien = groupe.querySelector(`${ONGLET}[href="#${CSS.escape(p.id)}"]`);
    lien?.classList.toggle('is-active', actif);
    lien?.setAttribute('aria-selected', String(actif));
  }
}

/** Refait la barre du groupe d'après ses panneaux (texte et couleur de chaque onglet, onglet ouvert gardé) et la remet au script des onglets. */
export function refaireLaBarre(groupe) {
  const panneaux = panneauxDe(groupe);
  const ouvert = Math.max(0, panneaux.findIndex((p) => p.classList.contains('is-active')));
  const html = htmlDeLaBarre(panneaux.map((p) => ({ id: p.id, titre: libelleDe(p), classe: classeDeLaCouleurEcrite(p.dataset.couleur) })), ouvert);
  const modele = document.createElement('template');
  modele.innerHTML = html;
  const barre = modele.content.firstElementChild;
  const ancienne = groupe.querySelector(`:scope > nav.${CLASSES_DES_ONGLETS.liste}`);
  if (ancienne) ancienne.replaceWith(barre);
  else (panneaux[0] ?? null)?.before(barre);
  panneaux.forEach((p, i) => p.classList.toggle('is-active', i === ouvert));
  groupe.dispatchEvent(new CustomEvent('onglets:brancher', { bubbles: true }));
}

/**
 * Un clic sur un onglet d'un groupe ouvre son panneau (la page qui n'a pas le script des onglets, un groupe dessiné depuis : aperçu d'un texte en attente, groupe
 * posé par l'éditeur). Idempotent : avec le script de la page, le même clic a déjà ouvert l'onglet ; branché une seule fois par page, quelle que soit la barre qui le demande.
 */
let branche = false;
export function brancherLesOnglets() {
  if (branche) return;
  branche = true;
  document.documentElement?.classList.add('js'); // posée par components/Onglets.astro sur une page qui a un groupe : sans elle, les feuilles gardent tous les panneaux ouverts
  assurerLaFeuille();
  document.addEventListener('click', (e) => {
    const lien = e.target instanceof Element ? e.target.closest(`${GROUPE} ${ONGLET}`) : null;
    if (!lien) return;
    const groupe = lien.closest(GROUPE);
    const panneau = groupe && panneauxDe(groupe).find((p) => `#${p.id}` === lien.getAttribute('href'));
    if (!panneau) return;
    e.preventDefault();
    ouvrirLOnglet(groupe, panneau);
  });
}

/** L'identifiant libre le plus proche de `base` dans la page (ni un id, ni l'id d'un intertitre d'un autre onglet) : `base`, `base-2`, `base-3`… */
function identifiantLibre(base) {
  const libre = (id) => !document.getElementById(id) && !document.getElementById(`titre-${id}`);
  if (libre(base)) return base;
  let n = 2;
  while (!libre(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

/** Pose la couleur `valeur` (« » : aucune) sur le panneau : `data-couleur` (que relit le Markdown) et la classe de la palette, jamais un style. */
function colorerLePanneau(panneau, valeur) {
  for (const k of [...panneau.classList]) if (k.startsWith('couleur-')) panneau.classList.remove(k);
  const classe = valeur ? classeDeLaCouleurEcrite(valeur) : null;
  if (valeur && classe) {
    poserLaCouleur(valeur);
    panneau.dataset.couleur = valeur;
    panneau.classList.add(classe);
  } else delete panneau.dataset.couleur;
}

/** Les outils des onglets d'une barre : `{ groupe (le groupe « Onglets »), ajouterLaCouleur(ed, barre, signal) }`. `texte` : l'éditeur en place de la barre, `zones()` ses zones. */
export function outilsDesOnglets(texte, zones) {
  const { plage, proche } = texte;
  let plageDuMoment = plage;
  const groupeDe = (r) => proche(r, GROUPE);
  const panneauDe = (r) => {
    const p = proche(r, PANNEAU);
    return p && p.parentElement?.matches(GROUPE) ? p : null;
  };

  function placerLeCurseur(el) {
    const r = document.createRange();
    r.selectNodeContents(el);
    r.collapse(false);
    texte.restaurer(r);
  }

  /** Les sous-titres `###` du texte (enfants directs d'une zone, hors d'un groupe) que touche la sélection : les futurs onglets. */
  function sousTitresChoisis(r) {
    const choisis = [];
    for (const z of zones()) for (const h of z.querySelectorAll(':scope > h3')) if (r.intersectsNode(h)) choisis.push(h);
    return choisis;
  }

  function mettreEnOnglets(ed) {
    const r = plage();
    if (!r) return ed.annoncer('Choisissez d’abord les sous-titres qui feront les onglets (ou placez le curseur dans l’un d’eux).');
    if (groupeDe(r)) return ed.annoncer('Ce texte est déjà en onglets.');
    const titres = sousTitresChoisis(r);
    if (!titres.length) return ed.annoncer('Aucun sous-titre dans la sélection : mettez d’abord les titres des onglets en « Sous-titre ».');
    const zone = titres[0].parentElement;
    if (titres.some((h) => h.parentElement !== zone)) return ed.annoncer('Les sous-titres choisis doivent être dans le même texte.');
    const enfants = [...zone.children];
    const debut = enfants.indexOf(titres[0]);
    const dernier = enfants.indexOf(titres.at(-1));
    // un titre plus haut entre les sous-titres choisis couperait le groupe : il ne se range pas en onglets
    if (enfants.slice(debut, dernier + 1).some((e) => /^H[12]$/.test(e.tagName) || (e.tagName === 'H3' && !titres.includes(e)))) {
      return ed.annoncer('Un titre sépare les sous-titres choisis : choisissez ceux d’une même section.');
    }
    // le dernier onglet va jusqu'au prochain titre (niveau 1 à 3) ou jusqu'à la fin du texte
    let fin = enfants.findIndex((e, i) => i > dernier && /^H[1-3]$/.test(e.tagName));
    if (fin < 0) fin = enfants.length;
    const groupe = document.createElement('div');
    groupe.className = CLASSES_DES_ONGLETS.groupe;
    groupe.setAttribute('data-onglets-md', '');
    groupe.setAttribute('data-onglets', 'Onglets');
    for (const [i, titre] of titres.entries()) {
      const suite = enfants.slice(enfants.indexOf(titre) + 1, i + 1 < titres.length ? enfants.indexOf(titres[i + 1]) : fin);
      const panneau = document.createElement('section');
      const id = titre.dataset.ancreFigee || identifiantLibre(`onglet-${normalize(titre.textContent) || 'sans-nom'}`);
      panneau.className = `${CLASSES_DES_ONGLETS.panneau}${i === 0 ? ' is-active' : ''}`;
      panneau.id = id;
      titre.id = `titre-${id}`;
      panneau.append(titre, ...suite);
      groupe.append(panneau);
    }
    zone.insertBefore(groupe, enfants[fin] ?? null);
    refaireLaBarre(groupe);
    ed.marquerModifie();
    placerLeCurseur(titreDe(panneauxDe(groupe)[0]));
  }

  function ajouterUnOnglet(ed) {
    const r = plage();
    const groupe = r ? groupeDe(r) : null;
    if (!groupe) return ed.annoncer('Placez d’abord le curseur dans un groupe d’onglets.');
    const apres = panneauDe(r) ?? panneauxDe(groupe).at(-1);
    const ancre = identifiantLibre('nouvel-onglet');
    const panneau = document.createElement('section');
    panneau.className = CLASSES_DES_ONGLETS.panneau;
    panneau.id = ancre;
    const titre = document.createElement('h3');
    titre.id = `titre-${ancre}`;
    titre.dataset.ancreFigee = ancre;
    titre.textContent = 'Nouvel onglet';
    const paragraphe = document.createElement('p');
    paragraphe.append(document.createElement('br'));
    panneau.append(titre, paragraphe);
    apres.after(panneau);
    ouvrirLOnglet(groupe, panneau);
    refaireLaBarre(groupe);
    ed.marquerModifie();
    const sel = document.createRange();
    sel.selectNodeContents(titre);
    texte.restaurer(sel);
  }

  function retirerUnOnglet(ed) {
    const r = plage();
    const panneau = r ? panneauDe(r) : null;
    if (!panneau) return ed.annoncer('Placez d’abord le curseur dans l’onglet à retirer.');
    const groupe = panneau.parentElement;
    const panneaux = panneauxDe(groupe);
    if (panneaux.length < 2) return ed.annoncer('Un groupe garde au moins un onglet : « Sortir des onglets » le défait.');
    const voisin = panneaux[panneaux.indexOf(panneau) + 1] ?? panneaux[panneaux.indexOf(panneau) - 1];
    panneau.remove();
    ouvrirLOnglet(groupe, voisin);
    refaireLaBarre(groupe);
    ed.marquerModifie();
    placerLeCurseur(voisin);
  }

  function sortirDesOnglets(ed) {
    const r = plage();
    const groupe = r ? groupeDe(r) : null;
    if (!groupe) return ed.annoncer('Placez d’abord le curseur dans un groupe d’onglets.');
    const morceaux = [];
    for (const c of [...groupe.children]) {
      if (c.matches(`nav.${CLASSES_DES_ONGLETS.liste}`)) continue;
      if (c.matches(PANNEAU)) {
        const titre = titreDe(c);
        if (titre) titre.removeAttribute('id'); // l'id d'un intertitre d'onglet (`titre-…`) ne sert qu'au groupe
        morceaux.push(...c.childNodes);
      } else morceaux.push(c);
    }
    groupe.replaceWith(...morceaux);
    ed.marquerModifie();
  }

  return {
    /** Le groupe « Onglets » des barres d'outils ([nom, [[étiquette, titre, action]]]). */
    groupe: ['Onglets', [
      ['Onglets', 'Mettre en onglets les sous-titres choisis (chacun avec le texte qui le suit)', mettreEnOnglets],
      ['+ onglet', 'Ajouter un onglet après celui du curseur', ajouterUnOnglet],
      ['− onglet', 'Retirer l’onglet du curseur et son texte', retirerUnOnglet],
      ['Sortir des onglets', 'Défaire le groupe : ses intertitres et leur texte restent, à la suite', sortirDesOnglets],
    ]],

    /** « Onglet : » : le choix de la couleur de l'onglet du curseur (liste des couleurs du glossaire), ajouté au groupe « Onglets » de la barre `barre` (élément). */
    ajouterLaCouleur(ed, barre, signal) {
      plageDuMoment = memoireDeLaPlage(texte, signal);
      const groupe = [...barre.querySelectorAll('[role="group"]')].find((g) => g.getAttribute('aria-label') === 'Onglets');
      if (!groupe) return;
      ajouterLeChoixDeCouleur(ed, groupe, {
        etiquette: 'Couleur :',
        libelle: 'Couleur de l’onglet',
        signal,
        lire: () => {
          const r = plageDuMoment();
          return (r ? panneauDe(r) : null)?.dataset.couleur ?? '';
        },
        appliquer: (valeur) => {
          const r = plageDuMoment();
          const panneau = r ? panneauDe(r) : null;
          if (!panneau) return ed.annoncer('Placez d’abord le curseur dans un onglet.');
          colorerLePanneau(panneau, valeur);
          refaireLaBarre(panneau.parentElement);
          ed.marquerModifie();
        },
      });
    },
  };
}
