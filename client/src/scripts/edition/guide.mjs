// Extension de l'éditeur pour les pages du guide (chapitres : components/guide/GuideChapitre.astro ; pages de référence : pages/[type]/[slug].astro) —
// demande du propriétaire : « le texte de chaque page, les liens (ou non), la mise en page, les tableaux et les cases, ainsi que leur couleur ».
// En mode modification, chaque morceau de texte [data-ed-morceau] devient modifiable en place (contenteditable) ; les blocs tirés de la base (tableaux
// de la montée de niveau, personnages fil rouge…) restent tels quels. Une barre d'outils pose la mise en page (paragraphe, titres, citation, listes,
// gras, italique, barré), les liens (vers une page du wiki : [[cible|texte]], ou une adresse web ; retirer un lien) et les tableaux (insérer, ajouter
// ou supprimer une ligne ou une colonne, couleur des cases). À l'enregistrement, le HTML de chaque morceau modifié est réécrit en Markdown
// (lib/markdown-edition.mjs) et remis à sa place dans le corps de la page, autour des blocs ; son HTML assaini part avec, comme aperçu montré
// tant que la page construite ne l'a pas (surcouche).
import { cleDeLigne } from '../../lib/edition-modele.mjs';
import { arbreDuDom, COULEURS_DE_CASE, decouperCorps, htmlSur, recomposerCorps, versMarkdown } from '../../lib/markdown-edition.mjs';
import { cheminDePage } from '../../lib/metiers.mjs';
import { normalize } from '../../lib/text.mjs';

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
  pages: null, // cibles possibles d'un lien (GET /api/edition/pages/), lues au premier lien posé
};

const corpsId = () => document.querySelector('[data-ed-corps]')?.dataset.edCorps ?? null;
const morceauxDeLaPage = () => [...document.querySelectorAll('[data-ed-morceau]')];
const enfantsDe = (el) => [...el.childNodes].map(arbreDuDom).filter(Boolean);

/** HTML reçu (aperçu d'une modification) → HTML assaini, par le même filtre que l'envoi (lib/markdown-edition.mjs#htmlSur). */
function assainir(html) {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  return htmlSur(enfantsDe(doc.body));
}

/** Une adresse du site écrite depuis la racine, comme dans le Markdown (« /races/ ») : sans le préfixe de déploiement. */
function lienRelatif(ed) {
  const base = ed.base || '/';
  return (href) => (base !== '/' && href.startsWith(base) ? `/${href.slice(base.length)}` : href);
}
const markdownDe = (ed, el) => versMarkdown(enfantsDe(el), { lienRelatif: lienRelatif(ed) });

// --- Sélection --------------------------------------------------------------------------------------------------------------------------------
const dansUnMorceau = (noeud) => {
  const el = noeud?.nodeType === 1 ? noeud : noeud?.parentElement;
  return el ? etat.morceaux.find((m) => m.contains(el)) ?? null : null;
};
function plage() {
  const sel = getSelection();
  if (!sel?.rangeCount) return null;
  const r = sel.getRangeAt(0);
  return dansUnMorceau(r.startContainer) && dansUnMorceau(r.endContainer) ? r : null;
}
function restaurer(r) {
  if (!r) return;
  const sel = getSelection();
  sel.removeAllRanges();
  sel.addRange(r);
}
const elementDe = (noeud) => (noeud?.nodeType === 1 ? noeud : noeud?.parentElement);
const proche = (r, selecteur) => {
  const el = elementDe(r?.startContainer)?.closest(selecteur);
  return el && dansUnMorceau(el) ? el : null;
};

// --- Commandes --------------------------------------------------------------------------------------------------------------------------------
function commande(ed, nom, valeur = null) {
  if (!plage()) {
    ed.annoncer('Placez d’abord le curseur dans le texte de la page.');
    return;
  }
  document.execCommand(nom, false, valeur);
  ed.marquerModifie();
}

/** Paragraphe, titre ou citation ; le même bouton sur un bloc qui l'est déjà le rend paragraphe. */
function bloc(ed, balise) {
  const r = plage();
  if (!r) return commande(ed, 'formatBlock', balise);
  const actuel = proche(r, 'p, h1, h2, h3, h4, h5, h6, blockquote');
  const cible = actuel?.tagName.toLowerCase() === balise && balise !== 'p' ? 'p' : balise;
  if (actuel?.tagName.toLowerCase() === 'blockquote' && cible === 'p') {
    actuel.replaceWith(...actuel.childNodes);
    ed.marquerModifie();
    return;
  }
  commande(ed, 'formatBlock', cible);
}

/**
 * Petite boîte de dialogue (mêmes styles que les formulaires de création) : un champ, avec une liste de suggestions s'il y en a. `valider(saisie)` lève
 * une erreur (affichée, la boîte reste ouverte) ou rend l'action à faire, lancée une fois la boîte fermée (tant qu'elle est ouverte, la page est inerte).
 */
function demander(ed, { titre, aide, libelle, valeur = '', suggestions = null, bouton = 'Valider', valider }) {
  const dialogue = document.createElement('dialog');
  dialogue.className = 'ed-dialogue';
  const id = `ed-suggestions-${Math.random().toString(36).slice(2)}`;
  dialogue.innerHTML = `<form method="dialog"><h2></h2><p class="ed-aide"></p><label><span class="ed-libelle"></span><input class="ed-saisie" required autocomplete="off"></label>
    <p class="ed-erreur" role="alert" hidden></p><div class="ed-boutons"><button type="button" value="annuler">Annuler</button><button type="submit"></button></div></form>`;
  dialogue.querySelector('h2').textContent = titre;
  dialogue.querySelector('.ed-aide').textContent = aide ?? '';
  dialogue.querySelector('.ed-libelle').textContent = libelle;
  dialogue.querySelector('[type="submit"]').textContent = bouton;
  const saisie = dialogue.querySelector('input');
  saisie.value = valeur;
  if (suggestions) {
    const liste = document.createElement('datalist');
    liste.id = id;
    for (const s of suggestions) liste.append(new Option(s));
    dialogue.append(liste);
    saisie.setAttribute('list', id);
  }
  const erreur = dialogue.querySelector('.ed-erreur');
  dialogue.querySelector('[value="annuler"]').addEventListener('click', () => dialogue.close());
  dialogue.addEventListener('close', () => dialogue.remove());
  dialogue.querySelector('form').addEventListener('submit', (e) => {
    e.preventDefault();
    try {
      const action = valider(saisie.value.trim());
      dialogue.close();
      action();
    } catch (err) {
      erreur.textContent = err.message;
      erreur.hidden = false;
    }
  });
  document.body.append(dialogue);
  dialogue.showModal();
  saisie.select();
}

const echapper = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const libelleDePage = (p) => `${p.titre} — ${p.id}`;

/** Pose (ou change) un lien vers une page du wiki sur le texte choisi : il s'écrira [[cible|texte]]. */
async function lienWiki(ed) {
  const r = plage();
  if (!r) return ed.annoncer('Choisissez d’abord le texte à lier (ou placez le curseur là où le lien doit aller).');
  try {
    etat.pages ??= (await ed.appel('GET', 'edition/pages/')).pages;
  } catch (e) {
    return ed.annoncer(`Liste des pages indisponible : ${e.message}`, 'erreur');
  }
  const existant = proche(r, 'a, span.wikilink');
  const actuelle = existant?.dataset.cible ? etat.pages.find((p) => p.id === existant.dataset.cible || normalize(p.titre) === normalize(existant.dataset.cible)) : null;
  demander(ed, {
    titre: existant ? 'Changer le lien' : 'Lien vers une page du wiki',
    aide: 'Tapez quelques lettres du titre puis choisissez la page. Le texte choisi reste le texte du lien.',
    libelle: 'Page',
    valeur: actuelle ? libelleDePage(actuelle) : '',
    suggestions: etat.pages.map(libelleDePage),
    bouton: 'Lier',
    valider(saisie) {
      const page = etat.pages.find((p) => libelleDePage(p) === saisie || p.id === saisie) ?? etat.pages.filter((p) => normalize(p.titre) === normalize(saisie)).at(0);
      if (!page) throw new Error('Page introuvable : choisissez-la dans la liste.');
      const href = `${(ed.base || '/').replace(/\/?$/, '/')}${cheminDePage(page.id)}`;
      return () => {
        if (existant) {
          const lien = document.createElement('a');
          lien.className = 'wikilink';
          lien.dataset.cible = page.id;
          lien.href = href;
          lien.append(...existant.childNodes);
          existant.replaceWith(lien);
        } else {
          restaurer(r);
          const texte = r.toString().trim() || page.titre;
          document.execCommand('insertHTML', false, `<a class="wikilink" data-cible="${echapper(page.id)}" href="${echapper(href)}">${echapper(texte)}</a>`);
        }
        ed.marquerModifie();
      };
    },
  });
}

/** Lien vers une adresse web (ou une adresse du site écrite depuis la racine, « /races/ »). */
function lienWeb(ed) {
  const r = plage();
  if (!r) return ed.annoncer('Choisissez d’abord le texte à lier.');
  const existant = proche(r, 'a');
  demander(ed, {
    titre: 'Lien vers une adresse',
    aide: 'Une adresse web complète (https://…) ou une adresse du site depuis sa racine (/races/).',
    libelle: 'Adresse',
    valeur: existant && !existant.classList.contains('wikilink') ? existant.getAttribute('href') ?? '' : 'https://',
    bouton: 'Lier',
    valider(adresse) {
      if (!/^(https?:\/\/[^\s]+|\/(?!\/)[^\s]*)$/.test(adresse)) throw new Error('Adresse attendue : https://… ou /…');
      return () => {
        if (existant) {
          existant.classList.remove('wikilink');
          delete existant.dataset.cible;
          existant.setAttribute('href', adresse);
        } else {
          restaurer(r);
          const texte = r.toString().trim() || adresse;
          document.execCommand('insertHTML', false, `<a href="${echapper(adresse)}">${echapper(texte)}</a>`);
        }
        ed.marquerModifie();
      };
    },
  });
}

/** Retire les liens sous le curseur ou dans le texte choisi : il ne reste que leur texte. */
function retirerLien(ed) {
  const r = plage();
  if (!r) return ed.annoncer('Placez d’abord le curseur sur le lien à retirer.');
  const liens = new Set();
  const autour = proche(r, 'a, span.wikilink');
  if (autour) liens.add(autour);
  for (const m of etat.morceaux) for (const l of m.querySelectorAll('a, span.wikilink')) if (r.intersectsNode(l)) liens.add(l);
  if (!liens.size) return ed.annoncer('Aucun lien ici.');
  for (const l of liens) l.replaceWith(...l.childNodes);
  ed.marquerModifie();
}

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
  ['Tableau', [
    ['Tableau', 'Insérer un tableau', insererTableau],
    ['+ ligne', 'Ajouter une ligne sous la case', ajouterLigne],
    ['+ colonne', 'Ajouter une colonne à droite de la case', ajouterColonne],
    ['− ligne', 'Supprimer la ligne de la case', supprimerLigne],
    ['− colonne', 'Supprimer la colonne de la case', supprimerColonne],
  ]],
];

function barreDOutils(ed) {
  const barre = document.createElement('div');
  barre.className = 'ed-barre-guide';
  barre.setAttribute('role', 'toolbar');
  barre.setAttribute('aria-label', 'Mise en forme du texte du guide');
  const ajouter = (groupe, etiquette, titre, action, classe) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.innerHTML = etiquette;
    b.title = titre;
    b.setAttribute('aria-label', titre);
    if (classe) b.classList.add(classe);
    // le clic ne doit pas retirer le curseur du texte
    b.addEventListener('mousedown', (e) => e.preventDefault());
    b.addEventListener('click', () => action(ed));
    groupe.append(b);
    return b;
  };
  for (const [nom, boutons] of OUTILS) {
    const groupe = document.createElement('div');
    groupe.className = 'ed-barre-guide__groupe';
    groupe.setAttribute('role', 'group');
    groupe.setAttribute('aria-label', nom);
    for (const [etiquette, titre, action, classe] of boutons) ajouter(groupe, etiquette, titre, action, classe);
    barre.append(groupe);
  }
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
    Object.assign(etat, { actif: true, morceaux, original: morceaux.map((m) => m.innerHTML), initial: morceaux.map((m) => markdownDe(ed, m)), envoye: null });
    for (const m of morceaux) {
      m.contentEditable = 'true';
      m.spellcheck = true;
      m.classList.add('ed-texte-guide');
      m.addEventListener('input', () => ed.marquerModifie(), { signal });
      // un collage n'apporte que du texte (la mise en forme d'un autre site ou d'un traitement de texte ne passerait pas proprement en Markdown)
      m.addEventListener('paste', (e) => {
        e.preventDefault();
        document.execCommand('insertText', false, e.clipboardData?.getData('text/plain') ?? '');
      }, { signal });
      m.addEventListener('keydown', (e) => {
        // dans une case de tableau, Entrée passe à la ligne dans la case (un tableau Markdown n'a pas de paragraphe dans une case)
        if (e.key === 'Enter' && caseCourante(plage())) {
          e.preventDefault();
          document.execCommand('insertLineBreak');
        }
      }, { signal });
      // un lien dans le texte modifiable ne s'ouvre pas au clic (le curseur s'y place)
      m.addEventListener('click', (e) => {
        if (e.target.closest('a')) e.preventDefault();
      }, { signal });
    }
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
