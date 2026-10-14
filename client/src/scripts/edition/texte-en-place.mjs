// L'éditeur de texte en place du mode modification (contenteditable + barre d'outils), partagé par le texte du guide et du Codex (edition/guide.mjs) et les
// descriptions de la chronologie (edition/chronologie.mjs) : la sélection dans les zones modifiables, les commandes de mise en forme, les liens (vers une
// page du wiki : [[cible|texte]], ou une adresse web ; retirer un lien), une petite boîte de saisie, et la barre d'outils. Le HTML d'une zone est réécrit
// en Markdown par lib/markdown-edition.mjs (versMarkdown) ; ce module ne touche qu'au DOM.
import { cheminDePage } from '../../lib/metiers.mjs';
import { normalize } from '../../lib/text.mjs';

const echapper = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const libelleDePage = (p) => `${p.titre} — ${p.id}`;

/**
 * Petite boîte de dialogue (mêmes styles que les formulaires de création) : un champ, avec une liste de suggestions s'il y en a. `valider(saisie)` lève
 * une erreur (affichée, la boîte reste ouverte) ou rend l'action à faire, lancée une fois la boîte fermée (tant qu'elle est ouverte, la page est inerte).
 */
export function demander(ed, { titre, aide, libelle, valeur = '', suggestions = null, bouton = 'Valider', valider }) {
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
    for (const m of zones()) for (const l of m.querySelectorAll('a, span.wikilink')) if (r.intersectsNode(l)) liens.add(l);
    if (!liens.size) return ed.annoncer('Aucun lien ici.');
    for (const l of liens) l.replaceWith(...l.childNodes);
    ed.marquerModifie();
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
    return { element: el, ajouter };
  }

  /**
   * Rend une zone modifiable : saisie suivie (`ed.marquerModifie`), collage en texte seul (la mise en forme d'un autre site ne passerait pas proprement
   * en Markdown), lien qui ne s'ouvre pas au clic (le curseur s'y place). `signal` : l'AbortController de la session de modification.
   */
  function rendreModifiable(ed, zone, signal, classe = 'ed-texte-guide') {
    zone.contentEditable = 'true';
    zone.spellcheck = true;
    zone.classList.add(classe);
    zone.addEventListener('input', () => ed.marquerModifie(), { signal });
    zone.addEventListener('paste', (e) => {
      e.preventDefault();
      document.execCommand('insertText', false, e.clipboardData?.getData('text/plain') ?? '');
    }, { signal });
    zone.addEventListener('click', (e) => {
      if (e.target.closest('a')) e.preventDefault();
    }, { signal });
  }

  return { plage, restaurer, proche, commande, bloc, lienWiki, lienWeb, retirerLien, barre, rendreModifiable };
}
