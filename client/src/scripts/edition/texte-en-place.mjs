// L'éditeur de texte en place du mode modification (contenteditable + barre d'outils), partagé par le texte du guide et du Codex (edition/guide.mjs), les
// descriptions de la chronologie (edition/chronologie.mjs) et les blocs des panneaux de règles (edition/panneaux.mjs) : la sélection dans les zones
// modifiables, les commandes de mise en forme, les liens (vers une page du wiki : [[cible|texte]], ou une adresse web ; retirer un lien), les mots-clés du
// glossaire (ces zones sont des textes mis en forme : lib/mots-cles-balises.mjs), une petite boîte de saisie, et la barre d'outils.
// Les mots-clés du glossaire s'y lisent et s'y modifient en balises écrites, comme dans le Markdown (demande du propriétaire du 2026-10-17 : « Quand je
// passe en mode édition le texte devrai remettre le texte en mode Markdown […] je ne vois pas {{Recharge Longue}} ») : à l'entrée, chaque mot-clé rendu
// redevient « {{id}} », « {{id|texte}} » ou « {{id:}} » (lib/markdown-edition.mjs#baliseEcrite), que l'on peut aussi taper ; les outils (outilsDesMotsCles ;
// demande du 2026-10-16) écrivent la balise du mot-clé choisi : le texte choisi devient « {{id}} » s'il est son libellé, « {{id|texte}} » sinon, la
// définition « {{id:}} » ; le curseur dans une balise, ils en changent le mot-clé. Le texte d'une zone n'est rendu (gras, infobulle) qu'une fois enregistré.
// La barre d'outils se tient à gauche de l'écran, à la hauteur de la zone où est le curseur (demande du 2026-10-17 : hauteurDeLaBarre).
// Le HTML d'une zone est réécrit en Markdown par lib/markdown-edition.mjs (versMarkdown) ; ce module ne touche qu'au DOM.
import { arbreDuDom, baliseEcrite } from '../../lib/markdown-edition.mjs';
import { cheminDePage } from '../../lib/metiers.mjs';
import { lireBalises, motCleDeLaRef } from '../../lib/mots-cles-balises.mjs';
import { normalize } from '../../lib/text.mjs';
import { vocabulaireVivant } from './mots-cles-vivants.mjs';

const echapper = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
/** Les mots-clés rendus (lib/mots-cles-balises.mjs#htmlDeLaBalise) qu'une zone montre en balises écrites en mode modification. */
const MOTS_CLES_RENDUS = 'strong.mot-cle[data-mot-cle], b.mot-cle[data-mot-cle], span.mot-cle-definition[data-mot-cle]';
/** L'écran assez large pour la barre d'outils à gauche (styles/edition/edition.css, même seuil) ; plus étroit, elle reste en haut. */
const BARRE_A_GAUCHE = '(min-width: 48rem)';
const libelleDePage = (p) => `${p.titre} — ${p.id}`;

/**
 * Petite boîte de dialogue (mêmes styles que les formulaires de création) : un champ, avec une liste de suggestions s'il y en a. `valider(saisie)` lève
 * une erreur (affichée, la boîte reste ouverte) ou rend l'action à faire, lancée une fois la boîte fermée (tant qu'elle est ouverte, la page est inerte).
 */
export function demander(ed, { titre, aide, libelle, valeur = '', suggestions = null, bouton = 'Valider', valider }) {
  const dialogue = document.createElement('dialog');
  dialogue.className = 'ed-dialogue';
  dialogue.setAttribute('data-mots-cles-bruts', ''); // ses textes d'aide citent la syntaxe des balises : tels qu'écrits (mots-cles-vivants.mjs)
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

/** Les pages du wiki (GET /api/edition/pages/ : { id, titre }), lues une fois par page du site (cibles d'un lien, lien d'une description). */
let pagesLues = null;
export async function pagesDuWiki(ed) {
  pagesLues ??= ed.appel('GET', 'edition/pages/').then((r) => r.pages).catch((e) => {
    pagesLues = null;
    throw e;
  });
  return pagesLues;
}
/** La page choisie dans une liste de suggestions (« Titre — id », l'id seul, ou un titre exact) ; null sinon. */
export const pageChoisie = (pages, saisie) =>
  pages.find((p) => libelleDePage(p) === saisie || p.id === saisie) ?? pages.filter((p) => normalize(p.titre) === normalize(saisie)).at(0) ?? null;
export { libelleDePage };

const libelleDeMotCle = (m) => `${m.libelle} — ${m.id}`;
/** Le mot-clé choisi dans les suggestions (« Libellé — id »), par son id ou par son écriture ; null sinon. */
const motCleChoisi = (vocabulaire, saisie) =>
  vocabulaire.liste.find((m) => libelleDeMotCle(m) === saisie) ?? motCleDeLaRef(vocabulaire, saisie.replace(/\s+—\s+[a-z0-9-]+$/, '')) ?? null;

/**
 * Les barres d'outils de la page, une par éditeur en place (`{ el, aLeCurseur }`) : quand une page en a plusieurs (le texte de Bienvenue,
 * edition/guide.mjs, et l'annonce de l'encart « Notre prochaine rencontre IRL » sous lui, edition/annonces.mjs), une seule se montre — celle de l'éditeur
 * où est le curseur, sinon la dernière qui l'a eu, sinon la première posée — : les autres sont cachées (`hidden`), sans quoi elles se poseraient
 * l'une sur l'autre à gauche de l'écran.
 */
const BARRES = new Set();
let barreMontree = null;
export function choisirLaBarre(barres = BARRES) {
  const presentes = [...barres].filter((b) => b.el.isConnected);
  const ici = presentes.find((b) => b.aLeCurseur());
  if (ici) barreMontree = ici;
  else if (!presentes.includes(barreMontree)) barreMontree = presentes[0] ?? null;
  for (const b of presentes) b.el.hidden = presentes.length > 1 && b !== barreMontree;
  return barreMontree;
}

/**
 * Un éditeur en place sur les zones que rend `zones()` (éléments contenteditable) : la sélection n'est prise en compte que dans une zone. Rend les outils
 * de mise en forme et de lien, et `barre(ed, groupes, etiquette)` qui dessine une barre d'outils (groupes : [[nom, [[etiquette, titre, action(ed),
 * classe?]]]]).
 */
export function editeurEnPlace(zones) {
  const dansUneZone = (noeud) => {
    const el = noeud?.nodeType === 1 ? noeud : noeud?.parentElement;
    return el ? zones().find((m) => m.contains(el)) ?? null : null;
  };
  function plage() {
    const sel = getSelection();
    if (!sel?.rangeCount) return null;
    const r = sel.getRangeAt(0);
    return dansUneZone(r.startContainer) && dansUneZone(r.endContainer) ? r : null;
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
    return el && dansUneZone(el) ? el : null;
  };

  function commande(ed, nom, valeur = null) {
    if (!plage()) {
      ed.annoncer('Placez d’abord le curseur dans le texte.');
      return;
    }
    document.execCommand(nom, false, valeur);
    ed.marquerModifie();
  }

  /** Paragraphe, titre ou citation ; le même bouton sur un bloc qui l'est déjà le rend paragraphe. */
  function bloc(ed, balise) {
    const r = plage();
    if (!r) return commande(ed, 'formatBlock', balise);
    // la zone modifiable elle-même (une description de la chronologie est un <blockquote>) n'est pas un bloc du texte : elle ne se défait pas
    const trouve = proche(r, 'p, h1, h2, h3, h4, h5, h6, blockquote');
    const actuel = trouve && zones().includes(trouve) ? null : trouve;
    const cible = actuel?.tagName.toLowerCase() === balise && balise !== 'p' ? 'p' : balise;
    if (actuel?.tagName.toLowerCase() === 'blockquote' && cible === 'p') {
      actuel.replaceWith(...actuel.childNodes);
      ed.marquerModifie();
      return;
    }
    commande(ed, 'formatBlock', cible);
  }

  /** Pose (ou change) un lien vers une page du wiki sur le texte choisi : il s'écrira [[cible|texte]]. */
  async function lienWiki(ed) {
    const r = plage();
    if (!r) return ed.annoncer('Choisissez d’abord le texte à lier (ou placez le curseur là où le lien doit aller).');
    let pages;
    try {
      pages = await pagesDuWiki(ed);
    } catch (e) {
      return ed.annoncer(`Liste des pages indisponible : ${e.message}`, 'erreur');
    }
    const existant = proche(r, 'a, span.wikilink');
    const actuelle = existant?.dataset.cible ? pages.find((p) => p.id === existant.dataset.cible || normalize(p.titre) === normalize(existant.dataset.cible)) : null;
    demander(ed, {
      titre: existant ? 'Changer le lien' : 'Lien vers une page du wiki',
      aide: 'Tapez quelques lettres du titre puis choisissez la page. Le texte choisi reste le texte du lien.',
      libelle: 'Page',
      valeur: actuelle ? libelleDePage(actuelle) : '',
      suggestions: pages.map(libelleDePage),
      bouton: 'Lier',
      valider(saisie) {
        const page = pageChoisie(pages, saisie);
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
      // un lien du guide écrit vers une ancienne adresse (lib/guide.mjs#remarkAnciensLiensDuGuide) : son adresse telle qu'écrite, pas celle du rendu
      valeur: existant && !existant.classList.contains('wikilink') ? existant.dataset.lienEcrit ?? existant.getAttribute('href') ?? '' : 'https://',
      bouton: 'Lier',
      valider(adresse) {
        if (!/^(https?:\/\/[^\s]+|\/(?!\/)[^\s]*)$/.test(adresse)) throw new Error('Adresse attendue : https://… ou /…');
        return () => {
          if (existant) {
            // la même adresse écrite (data-lien-ecrit) : le lien ne change pas, il mène toujours à la page du plan
            if (existant.dataset.lienEcrit !== adresse) {
              existant.classList.remove('wikilink');
              delete existant.dataset.cible;
              delete existant.dataset.lienEcrit;
              existant.setAttribute('href', adresse);
            }
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
    for (const m of zones()) for (const l of m.querySelectorAll('a, span.wikilink')) if (r.intersectsNode(l)) liens.add(l);
    if (!liens.size) return ed.annoncer('Aucun lien ici.');
    for (const l of liens) l.replaceWith(...l.childNodes);
    ed.marquerModifie();
  }

  /**
   * La balise écrite autour du texte choisi ou du curseur (dans un même nœud de texte d'une zone) : { noeud, balise } (lireBalises) ; null sinon. Le
   * curseur juste avant « {{ » ou juste après « }} » n'y est pas : il insère à côté.
   */
  function baliseAutour(r) {
    const n = r.startContainer;
    if (n?.nodeType !== 3 || r.endContainer !== n || !dansUneZone(n)) return null;
    const vide = r.collapsed ?? r.startOffset === r.endOffset;
    const b = lireBalises(n.nodeValue).find((x) => (vide ? x.debut < r.startOffset && r.startOffset < x.fin : x.debut <= r.startOffset && r.endOffset <= x.fin));
    return b ? { noeud: n, balise: b } : null;
  }

  /** Écrit la balise `ecriture` à la place du texte choisi `r` (une saisie : le navigateur la garde dans son historique). */
  function insererLaBalise(ed, r, ecriture) {
    restaurer(r);
    document.execCommand('insertText', false, ecriture);
    ed.marquerModifie();
  }

  /** Écrit la balise `ecriture` à la place de la balise `autour` (baliseAutour). */
  function remplacerLaBalise(ed, { noeud, balise }, ecriture) {
    noeud.nodeValue = `${noeud.nodeValue.slice(0, balise.debut)}${ecriture}${noeud.nodeValue.slice(balise.fin)}`;
    ed.marquerModifie();
  }

  /** Le mot-clé du glossaire à choisir (petite boîte, suggestions du vocabulaire vivant), puis `poser(mot-clé)`. */
  async function choisirUnMotCle(ed, { titre, aide, valeur = '', bouton, poser }) {
    let vocabulaire;
    try {
      vocabulaire = await vocabulaireVivant(ed);
    } catch (e) {
      return ed.annoncer(`Glossaire indisponible : ${e.message}`, 'erreur');
    }
    demander(ed, {
      titre, aide, libelle: 'Mot-clé', valeur, bouton, suggestions: vocabulaire.liste.map(libelleDeMotCle),
      valider(saisie) {
        const m = motCleChoisi(vocabulaire, saisie);
        if (!m) throw new Error('Mot-clé introuvable : choisissez-le dans la liste (un mot-clé se crée sur la page Recherche, en mode modification).');
        return () => poser(m);
      },
    });
  }

  /**
   * Le texte choisi devient la balise d'un mot-clé du glossaire : « {{id}} » (son libellé : le texte affiché le suivra), « {{id|texte}} » (un autre
   * texte) ; le curseur dans une balise, change son mot-clé et garde son texte écrit (le mode complet devient « {{id}} »).
   */
  async function motCle(ed) {
    const r = plage();
    if (!r) return ed.annoncer('Choisissez d’abord le texte à mettre en mot-clé (ou placez le curseur là où le mot-clé doit aller).');
    const autour = baliseAutour(r);
    await choisirUnMotCle(ed, {
      titre: autour ? 'Changer le mot-clé' : 'Mot-clé du glossaire',
      aide: 'Tapez quelques lettres du mot-clé puis choisissez-le. Le texte choisi devient sa balise, « {{id}} » (le libellé du mot-clé) ou « {{id|texte}} » (un autre texte) : une fois enregistré, il s’affiche en gras, avec la définition du mot-clé en infobulle.',
      valeur: autour?.balise.ref ?? '',
      bouton: 'Poser',
      poser(m) {
        const ecrit = autour ? (autour.balise.complet ? null : autour.balise.texte) : r.toString().replace(/[{}\n]+/g, ' ').replace(/\s+/g, ' ').trim() || null;
        const ecriture = ecrit === null || ecrit === m.libelle ? `{{${m.id}}}` : `{{${m.id}|${ecrit}}}`;
        if (autour) remplacerLaBalise(ed, autour, ecriture);
        else insererLaBalise(ed, r, ecriture);
      },
    });
  }

  /** Écrit la balise du mode complet d'un mot-clé, « {{id:}} » (« Libellé : définition », venue du glossaire) ; le curseur dans une balise, la remplace. */
  async function definition(ed) {
    const r = plage();
    if (!r) return ed.annoncer('Placez d’abord le curseur là où la définition doit aller.');
    const autour = baliseAutour(r);
    await choisirUnMotCle(ed, {
      titre: 'Définition d’un mot-clé',
      aide: 'Sa balise « {{id:}} » s’écrit au curseur : une fois enregistré, le libellé du mot-clé et sa définition s’affichent tels que le glossaire les écrit (« Libellé : définition ») et la suivront quand elle changera.',
      valeur: autour?.balise.ref ?? '',
      bouton: 'Insérer',
      poser(m) {
        if (autour) remplacerLaBalise(ed, autour, `{{${m.id}:}}`);
        else insererLaBalise(ed, r, `{{${m.id}:}}`);
      },
    });
  }

  /** La barre d'outils : un groupe de boutons par entrée de `groupes` ; un clic garde le curseur dans le texte. */
  function barre(ed, groupes, etiquette) {
    const el = document.createElement('div');
    el.className = 'ed-barre-guide';
    el.setAttribute('role', 'toolbar');
    el.setAttribute('aria-label', etiquette);
    const ajouter = (groupe, texte, titre, action, classe) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.innerHTML = texte;
      b.title = titre;
      b.setAttribute('aria-label', titre);
      if (classe) b.classList.add(classe);
      // le clic ne doit pas retirer le curseur du texte
      b.addEventListener('mousedown', (e) => e.preventDefault());
      b.addEventListener('click', () => action(ed));
      groupe.append(b);
      return b;
    };
    for (const [nom, boutons] of groupes) {
      const groupe = document.createElement('div');
      groupe.className = 'ed-barre-guide__groupe';
      groupe.setAttribute('role', 'group');
      groupe.setAttribute('aria-label', nom);
      for (const [texte, titre, action, classe] of boutons) ajouter(groupe, texte, titre, action, classe);
      el.append(groupe);
    }
    suivreLaZone(el);
    return { element: el, ajouter };
  }

  /** La zone où est le curseur, sinon la dernière qui l'a eu, sinon la première à l'écran (ou la première tout court) ; null s'il n'y en a pas. */
  let derniere = null;
  function zoneSuivie() {
    const sel = getSelection();
    const ici = sel?.rangeCount ? dansUneZone(sel.getRangeAt(0).startContainer) : null;
    const toutes = zones();
    if (ici) derniere = ici;
    else if (!toutes.includes(derniere)) derniere = null;
    return derniere ?? toutes.find((z) => {
      const r = z.getBoundingClientRect();
      return r.bottom > 0 && r.top < innerHeight;
    }) ?? toutes[0] ?? null;
  }

  /**
   * Place la barre `el` à la hauteur de la zone suivie (zoneSuivie, hauteurDeLaBarre) à chaque mouvement du curseur, saisie, défilement (d'un panneau
   * aussi) ou redimensionnement, une fois par image, tant qu'elle est dans la page ; sous 48rem (BARRE_A_GAUCHE), la feuille de style la garde en haut de
   * l'écran. Hors d'un navigateur (tests), rien.
   */
  function suivreLaZone(el) {
    if (typeof window === 'undefined' || typeof matchMedia !== 'function') return;
    const large = matchMedia(BARRE_A_GAUCHE);
    const arret = new AbortController();
    let posee = false; // la barre a été dans la page : sortie (fin du mode modification), elle ne suit plus rien
    let prevue = false;
    const inscrite = { el, aLeCurseur: () => {
      const sel = getSelection();
      return Boolean(sel?.rangeCount && dansUneZone(sel.getRangeAt(0).startContainer));
    } };
    BARRES.add(inscrite);
    const placer = () => {
      prevue = false;
      if (!el.isConnected) {
        if (posee) {
          arret.abort();
          BARRES.delete(inscrite);
          choisirLaBarre();
        }
        return;
      }
      posee = true;
      choisirLaBarre();
      if (el.hidden) return; // une autre barre se montre : celle-ci attend le curseur dans ses zones
      const zone = large.matches ? zoneSuivie() : null;
      if (!zone) el.style.removeProperty('top');
      else el.style.top = `${Math.round(hauteurDeLaBarre(zone.getBoundingClientRect(), el.offsetHeight, innerHeight))}px`;
    };
    const planifier = () => {
      if (prevue) return;
      prevue = true;
      requestAnimationFrame(placer);
    };
    const { signal } = arret;
    document.addEventListener('selectionchange', planifier, { signal });
    document.addEventListener('input', planifier, { signal });
    addEventListener('scroll', planifier, { capture: true, passive: true, signal });
    addEventListener('resize', planifier, { signal });
    large.addEventListener('change', planifier, { signal });
    planifier();
  }

  /**
   * Rend une zone modifiable : saisie suivie (`ed.marquerModifie`), collage en texte seul (la mise en forme d'un autre site ne passerait pas proprement
   * en Markdown), lien qui ne s'ouvre pas au clic (le curseur s'y place). `signal` : l'AbortController de la session de modification.
   */
  function rendreModifiable(ed, zone, signal, classe = 'ed-texte-guide') {
    zone.contentEditable = 'true';
    zone.spellcheck = true;
    zone.classList.add(classe);
    // les mots-clés du glossaire en balises écrites : on les lit et on les modifie comme le reste du texte (le Markdown relu à l'entrée se lit ensuite)
    const rendus = zone.querySelectorAll(MOTS_CLES_RENDUS);
    for (const m of rendus) m.replaceWith(document.createTextNode(baliseEcrite(arbreDuDom(m))));
    if (rendus.length) zone.normalize(); // une balise et le texte qui l'entoure, un seul texte (les outils lisent la balise où est le curseur)
    zone.addEventListener('input', () => ed.marquerModifie(), { signal });
    zone.addEventListener('paste', (e) => {
      e.preventDefault();
      document.execCommand('insertText', false, e.clipboardData?.getData('text/plain') ?? '');
    }, { signal });
    zone.addEventListener('click', (e) => {
      if (e.target.closest('a')) e.preventDefault();
    }, { signal });
  }

  return { plage, restaurer, proche, commande, bloc, lienWiki, lienWeb, retirerLien, motCle, definition, barre, rendreModifiable };
}

/** Le groupe « Mots-clés » d'une barre d'outils (barre(ed, groupes, …)) pour l'éditeur en place `texte` (editeurEnPlace) : mot-clé, définition. */
export const outilsDesMotsCles = (texte) => ['Mots-clés', [
  // (pas d'accolades dans ces titres : la bulle qui les montre est hors des zones gardées telles qu'écrites, elle en rendrait une balise)
  ['Mot-clé', 'Mettre le texte choisi en mot-clé du glossaire : sa balise s’écrit dans le texte (gras, définition en infobulle une fois enregistré)', texte.motCle],
  ['Définition', 'Insérer la balise de la définition d’un mot-clé du glossaire (« Libellé : définition » une fois enregistré)', texte.definition],
]];

/**
 * Le haut de la barre d'outils, en px depuis le haut de l'écran, pour la zone `{ top }` (getBoundingClientRect), une barre haute de `hauteur` et un
 * écran haut de `ecran` : le haut de la zone, ramené dans l'écran (le haut de la zone passé au-dessus : en haut de l'écran ; trop bas : la barre remonte
 * pour y tenir entière), à `marge` de ses bords ; une barre plus haute que l'écran se tient en haut et défile (edition.css).
 */
export function hauteurDeLaBarre(zone, hauteur, ecran, marge = 8) {
  return Math.max(marge, Math.min(zone.top, ecran - hauteur - marge));
}
