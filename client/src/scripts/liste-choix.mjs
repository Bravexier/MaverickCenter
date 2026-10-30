// Une liste de choix dessinée par le site à la place d'un menu `<select>` de la fiche (demande du propriétaire : « Il faudrai également une infobulle
// au survol des choix pour voir ce qu'ils apportent. » ; réponse « Liste personnalisée (Recommandé) », pour le métier, les sorts, les armes et l'armure) :
// même aspect replié qu'un menu, et chaque ligne de la liste ouverte montre l'infobulle du site (components/Infobulles.astro) avec ce que le choix
// apporte, au survol et au clavier. Le navigateur ne peut pas montrer une bulle du site sur l'option d'un `<select>` natif ouvert.
//
// Le `<select>` reste, caché, et garde la valeur : la fiche le lit, le pose (`poser`, `value`), le remplit, le grise, le teinte et écoute son `input` et son
// `change` comme avant ; rien d'autre ne voit la différence. Le bouton recopie son option choisie et ses marques (`aria-invalid`, `data-couleur`,
// `data-a-choisir`, `data-vide`, classes de la palette, infobulle) ; la liste ouverte, ses groupes et ses options (leurs classes de la palette et leur
// `title`, devenu l'infobulle de la ligne).
//
// Motif clavier : un bouton (`aria-haspopup="listbox"`, `aria-expanded`) qui ouvre une liste `role="listbox"` dont l'option active a le focus réel
// (tabindex mobile : Infobulles.astro n'ouvre au clavier que la bulle de l'élément qui a le focus, jamais celle d'un aria-activedescendant). Bouton :
// Entrée, Espace, ↓, ↑, Alt+↓, Début, Fin ou une lettre ouvrent la liste. Liste : ↓ ↑ Début Fin Page suivante/précédente, une lettre (ou quelques-unes à
// la suite) saute à l'option qui commence par elles (lib/liste-choix.mjs) ; Entrée, Espace ou Alt+↑ choisissent ; Tab choisit et passe au champ
// suivant (Maj+Tab : au précédent) ; Échap ferme sans rien changer et rend le focus au bouton. À la souris ou au toucher, un clic (un appui) choisit ;
// un clic ailleurs ferme. La liste est en position fixe sous le bouton (un tableau qui défile ne la coupe pas), au-dessus quand la place manque,
// bornée à l'écran (téléphone compris) ; elle défile en elle-même.
import { DELAI_DE_SAISIE, optionParLettres, optionVisee, toucheDeSaisie } from '../lib/liste-choix.mjs';

/** Les marques du `<select>` recopiées sur le bouton (fiche.css les lit sur l'un ou l'autre). */
const MARQUES = ['aria-invalid', 'data-couleur', 'data-a-choisir', 'data-vide', 'data-refus', 'data-infobulle', 'aria-description'];
/** Distance minimale au bord de l'écran, en pixels. */
const MARGE = 8;
/** Hauteur maximale de la liste ouverte, en rem (moins quand l'écran manque de place). */
const HAUTEUR_MAX_REM = 20;

let numero = 0;
/** Le dernier bouton de chaque liste, par sa clé stable (option `cle`) : une liste refaite par la fiche après un choix reprend le focus. */
const derniers = new Map();

function creer(balise, attributs = {}, ...enfants) {
  const e = document.createElement(balise);
  for (const [k, v] of Object.entries(attributs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') e.className = v;
    else e.setAttribute(k, v === true ? '' : v);
  }
  e.append(...enfants.filter((x) => x !== null && x !== undefined));
  return e;
}

const recopier = (de, vers, nom) => {
  const v = de.getAttribute(nom);
  if (v === null) {
    if (vers.hasAttribute(nom)) vers.removeAttribute(nom);
  } else if (vers.getAttribute(nom) !== v) vers.setAttribute(nom, v);
};

/** L'infobulle d'une option du `<select>` : son `title` (que Infobulles.astro déplace dans `data-infobulle`). */
const texteDInfobulle = (o) => (o.getAttribute('data-infobulle') ?? o.getAttribute('title') ?? '').trim();

/** Le nom de la liste : l'`aria-label` du `<select>`, sinon le texte de son `<label>` (son premier `span`, ou le texte sans le menu). */
function etiquetteDe(select) {
  const aria = select.getAttribute('aria-label');
  if (aria) return aria;
  const label = select.labels?.[0] ?? select.closest('label');
  if (!label) return '';
  const span = [...label.children].find((c) => c.tagName === 'SPAN' && !c.contains(select));
  return (span ?? label).textContent.trim();
}

/**
 * Remplace le menu `select` par la liste du site ; rend l'enveloppe, qui contient le `<select>` caché, à poser à sa place (si le `<select>` est déjà dans
 * la page, l'enveloppe y prend sa place). `cle` : un nom stable de la liste dans la page (« sort-1 », « livre-2 », « armure »), qui ne change pas avec
 * la valeur choisie (l'aria-label d'un livre nomme son sort) : la liste que la fiche refait après un choix rend le focus au bouton de même clé.
 */
export function listeDeChoix(select, { cle = null } = {}) {
  const n = ++numero;
  const id = `liste-choix-${n}`;
  const nomDeLaListe = etiquetteDe(select);
  const etiquette = creer('span', { id: `${id}-nom`, hidden: true }, nomDeLaListe);
  const valeur = creer('span', { class: 'liste-choix__valeur', id: `${id}-valeur` });
  const bouton = creer('button', {
    type: 'button', class: 'liste-choix__bouton', id: `${id}-bouton`, 'aria-haspopup': 'listbox', 'aria-expanded': 'false',
    'aria-controls': `${id}-liste`, 'aria-labelledby': `${id}-nom ${id}-valeur`,
  }, valeur);
  const liste = creer('div', { class: 'liste-choix__liste', role: 'listbox', id: `${id}-liste`, tabindex: '-1', 'aria-labelledby': `${id}-nom`, hidden: true });
  const enveloppe = creer('span', { class: 'liste-choix' }, etiquette, bouton, liste);
  if (select.parentNode) select.replaceWith(enveloppe);
  enveloppe.append(select);
  select.hidden = true;
  select.tabIndex = -1;
  if (cle) derniers.set(cle, bouton);
  let saisie = '';   // les lettres tapées à la suite (chercher)
  let derniereFrappe = 0;

  // ---------------------------------------------------------------- le bouton suit le <select>
  const classesDuBouton = () => ['liste-choix__bouton', select.className].filter(Boolean).join(' ');
  function maj() {
    const o = select.selectedOptions[0] ?? null;
    const texte = o?.textContent ?? '';
    if (valeur.textContent !== texte) valeur.textContent = texte;
    if (bouton.className !== classesDuBouton()) bouton.className = classesDuBouton();
    for (const nom of MARQUES) recopier(select, bouton, nom);
    if (bouton.disabled !== select.disabled) bouton.disabled = select.disabled;
    if (select.disabled && !liste.hidden) fermer(false);
    const nom = etiquetteDe(select) || nomDeLaListe;
    if (etiquette.textContent !== nom) etiquette.textContent = nom;
  }
  // la valeur posée par la fiche (poser, `value`, `selectedIndex`) ne fait ni évènement ni mutation : le bouton suit par ces deux propriétés
  for (const prop of ['value', 'selectedIndex']) {
    const d = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, prop);
    Object.defineProperty(select, prop, {
      configurable: true,
      get() { return d.get.call(this); },
      set(v) { d.set.call(this, v); maj(); if (!liste.hidden) remplir(); },
    });
  }
  // les options, les groupes et les marques changés par la fiche (listes refaites, groupes déplacés, teinte, grisé, infobulle)
  new MutationObserver(() => {
    maj();
    if (!liste.hidden) remplir();
  }).observe(select, { subtree: true, childList: true, attributes: true, characterData: true });
  maj();

  // ---------------------------------------------------------------- la liste ouverte
  let lignes = [];   // les lignes `role="option"`, dans l'ordre des options du <select>
  let valeurs = [];   // la valeur de l'option de chaque ligne, lue quand la ligne est faite (les options ont pu changer depuis)
  const actif = () => lignes.indexOf(document.activeElement);
  function remplir() {
    // la valeur de la ligne active, celle de sa création : une option ajoutée ou retirée avant elle a déjà décalé les index du <select>
    const garde = actif() >= 0 ? valeurs[actif()] ?? null : null;
    lignes = [];
    valeurs = [];
    let g = 0;
    const ligne = (o) => {
      const i = lignes.length;
      const texte = texteDInfobulle(o);
      const l = creer('div', {
        role: 'option', id: `${id}-option-${i}`, tabindex: '-1', class: ['liste-choix__option', o.className].filter(Boolean).join(' '),
        'aria-selected': String(o.selected), 'aria-disabled': o.disabled ? 'true' : null,
        // l'infobulle de l'option, à côté de la ligne (dessous, elle couvrirait les suivantes) ; aucune sans texte. Posée comme Infobulles.astro pose un
        // `title` (data-infobulle, aria-description) : la ligne qui reçoit le focus à l'ouverture a sa bulle tout de suite, sans attendre son observateur
        'data-infobulle': texte || null, 'aria-description': texte || null, 'data-placement': texte ? 'cote' : null,
      }, o.textContent);
      lignes.push(l);
      valeurs.push(o.value);
      return l;
    };
    const enfants = [...select.children].map((x) => {
      if (x.tagName === 'OPTGROUP') {
        const gid = `${id}-groupe-${g += 1}`;
        return creer('div', { role: 'group', class: 'liste-choix__groupe', 'aria-labelledby': gid },
          creer('div', { class: 'liste-choix__titre', id: gid, role: 'presentation' }, x.label), ...[...x.children].filter((o) => o.tagName === 'OPTION').map(ligne));
      }
      return x.tagName === 'OPTION' ? ligne(x) : null;
    }).filter(Boolean);
    const avaitLeFocus = liste.contains(document.activeElement);
    liste.replaceChildren(...enfants);
    // la liste refaite pendant qu'elle est ouverte : l'option qui avait le focus le garde (la même valeur)
    // (repli : l'option choisie, sinon la première)
    if (avaitLeFocus) activer(Math.max(0, garde !== null && valeurs.includes(garde) ? valeurs.indexOf(garde) : select.selectedIndex));
  }

  const ignorees = () => new Set(lignes.flatMap((l, i) => (l.getAttribute('aria-disabled') === 'true' ? [i] : [])));
  function activer(i) {
    const l = lignes[i];
    if (!l) return;
    for (const x of lignes) if (x !== l && x.tabIndex !== -1) x.tabIndex = -1;
    l.tabIndex = 0;
    // l'option à l'écran dans la liste qui défile (sans faire défiler la page), avant le focus : sa bulle se place sur elle
    const haut = l.offsetTop;
    const bas = haut + l.offsetHeight;
    if (haut < liste.scrollTop) liste.scrollTop = haut;
    else if (bas > liste.scrollTop + liste.clientHeight) liste.scrollTop = bas - liste.clientHeight;
    l.focus({ preventScroll: true });
  }

  /** Sous le bouton, au-dessus quand la place manque dessous ; bornée à l'écran ; en position fixe (corrigée si un parent déplace son repère). */
  function placer() {
    if (liste.hidden) return;
    const r = bouton.getBoundingClientRect();
    const largeur = document.documentElement.clientWidth;
    const hauteur = document.documentElement.clientHeight;
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    liste.style.minWidth = `${Math.min(r.width, largeur - 2 * MARGE)}px`;
    liste.style.maxWidth = `${largeur - 2 * MARGE}px`;
    const dessous = hauteur - r.bottom - 2 - MARGE;   // (2 : l'écart entre le bouton et la liste)
    const dessus = r.top - 2 - MARGE;
    const voulue = Math.min(liste.scrollHeight + 2, HAUTEUR_MAX_REM * rem);
    const enDessous = voulue <= dessous || dessous >= dessus;
    liste.style.maxHeight = `${Math.max(Math.min(voulue, enDessous ? dessous : dessus), 3 * rem)}px`;
    const b = liste.getBoundingClientRect();
    const gauche = Math.max(MARGE, Math.min(r.left, largeur - b.width - MARGE));
    const haut = enDessous ? r.bottom + 2 : r.top - 2 - b.height;
    liste.style.left = `${gauche}px`;
    liste.style.top = `${haut}px`;
    // un parent transformé, filtré ou à confinement (`transform`, `filter`, `container-type`…) ferait de lui le repère de la position fixe : aucune liste
    // n'en a aujourd'hui, mais la liste serait alors recalée sur l'écart mesuré
    const apres = liste.getBoundingClientRect();
    if (Math.abs(apres.left - gauche) > 0.5) liste.style.left = `${gauche + (gauche - apres.left)}px`;
    if (Math.abs(apres.top - haut) > 0.5) liste.style.top = `${haut + (haut - apres.top)}px`;
  }
  let image = 0;
  // la page défile ou change de taille : la liste suit son bouton (pas quand elle défile elle-même : rien n'a bougé)
  const replacer = (ev) => {
    if (ev?.target === liste) return;
    cancelAnimationFrame(image);
    image = requestAnimationFrame(placer);
  };
  // un appui hors de la liste la ferme ; sur le <label> du bouton, son clic la fermera (il clique le bouton)
  const appuiAilleurs = (ev) => {
    if (enveloppe.contains(ev.target) || [...(bouton.labels ?? [])].some((l) => l.contains(ev.target))) return;
    fermer(false);
  };

  function ouvrir(index = null) {
    if (select.disabled || !liste.hidden) return;
    remplir();
    liste.hidden = false;
    bouton.setAttribute('aria-expanded', 'true');
    enveloppe.setAttribute('data-ouverte', '');
    placer();
    addEventListener('scroll', replacer, { passive: true, capture: true });
    addEventListener('resize', replacer);
    document.addEventListener('pointerdown', appuiAilleurs, true);
    activer(index ?? Math.max(0, select.selectedIndex));
  }
  /** Ferme la liste ; `rendre` : le focus revient au bouton (avant de cacher la liste, qui l'a). */
  function fermer(rendre = true) {
    if (liste.hidden) return;
    if (rendre && bouton.isConnected) bouton.focus({ preventScroll: true });
    liste.hidden = true;
    bouton.setAttribute('aria-expanded', 'false');
    enveloppe.removeAttribute('data-ouverte');
    removeEventListener('scroll', replacer, { capture: true });
    removeEventListener('resize', replacer);
    document.removeEventListener('pointerdown', appuiAilleurs, true);
    cancelAnimationFrame(image);
    saisie = '';
  }
  /** Choisit l'option `i` : le <select> la prend et annonce `input` puis `change`, comme un menu natif ; le focus revient au bouton. */
  function choisir(i) {
    const o = select.options[i];
    if (!o || o.disabled) return fermer(true);
    fermer(true);
    if (select.selectedIndex === i) return;
    select.selectedIndex = i;
    select.dispatchEvent(new Event('input', { bubbles: true }));
    select.dispatchEvent(new Event('change', { bubbles: true }));
    // la fiche a refait la liste (le tableau des sorts, le bloc de l'armure) : le focus va au bouton qui la remplace
    const nouveau = cle ? derniers.get(cle) : null;
    if (!bouton.isConnected && nouveau?.isConnected && (document.activeElement === document.body || document.activeElement === null)) nouveau.focus({ preventScroll: true });
  }

  // ---------------------------------------------------------------- la frappe
  /** Une lettre tapée : la recherche continue si elle suit de près la précédente. Rend l'index visé, ou null. */
  function chercher(caractere, depuis) {
    const maintenant = Date.now();
    saisie = maintenant - derniereFrappe > DELAI_DE_SAISIE ? caractere : saisie + caractere;
    derniereFrappe = maintenant;
    return optionParLettres(lignes.map((l) => l.textContent), depuis, saisie, ignorees());
  }
  const enSaisie = () => saisie !== '' && Date.now() - derniereFrappe <= DELAI_DE_SAISIE;

  bouton.addEventListener('click', () => {
    if (liste.hidden) ouvrir();
    else fermer(true);
  });
  bouton.addEventListener('keydown', (ev) => {
    if (!liste.hidden || select.disabled) return;
    const k = ev.key;
    if (['Enter', ' ', 'ArrowDown', 'ArrowUp'].includes(k) && !ev.ctrlKey && !ev.metaKey) ouvrir();
    else if (k === 'Home' || k === 'End') {
      ouvrir();
      activer(optionVisee(k, -1, lignes.length));
    } else if (toucheDeSaisie(ev)) {
      ouvrir();
      // comme un menu natif fermé : une lettre (la même répétée) passe à l'option suivante qui commence par elle, à partir de l'option choisie, exclue
      const i = chercher(k, select.selectedIndex);
      if (i !== null) activer(i);
    } else return;
    ev.preventDefault();
  });
  liste.addEventListener('keydown', (ev) => {
    const k = ev.key;
    const i = actif();
    if (k === 'Escape') {
      fermer(true);
      ev.stopPropagation();
    } else if (k === 'Tab') {
      // Tab prend l'option active et passe au champ suivant : le focus rendu au bouton, le navigateur avance depuis lui
      if (i >= 0) choisir(i);
      else fermer(true);
      return;
    } else if ((k === 'Enter' || (k === ' ' && !enSaisie())) && !ev.ctrlKey && !ev.metaKey) {
      if (i >= 0) choisir(i);
    } else if (k === 'ArrowUp' && ev.altKey) {
      if (i >= 0) choisir(i);
      else fermer(true);
    } else if (optionVisee(k, i, lignes.length) !== null && !ev.altKey && !ev.ctrlKey && !ev.metaKey) {
      activer(optionVisee(k, i, lignes.length));
    } else if (toucheDeSaisie(ev)) {
      const j = chercher(k, i);
      if (j !== null) activer(j);
    } else return;
    ev.preventDefault();
  });
  // un clic (un appui) sur une option la choisit ; aucun clic dans la liste ne remonte au <label> qui l'entoure (il cliquerait le bouton)
  liste.addEventListener('click', (ev) => {
    ev.preventDefault();
    const l = ev.target instanceof Element ? ev.target.closest('[role="option"]') : null;
    const i = lignes.indexOf(l);
    if (i >= 0 && l.getAttribute('aria-disabled') !== 'true') choisir(i);
  });
  // le focus parti ailleurs (Tab du navigateur, un champ cliqué) : la liste se ferme ; vers le bouton, son clic décide
  enveloppe.addEventListener('focusout', (ev) => {
    if (liste.hidden) return;
    const vers = ev.relatedTarget;
    if (vers instanceof Node && enveloppe.contains(vers)) return;
    setTimeout(() => { if (!enveloppe.contains(document.activeElement)) fermer(false); });
  });
  return enveloppe;
}
