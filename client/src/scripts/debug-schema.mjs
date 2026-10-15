// Script du menu « DB » (le schéma de la base) de la page Debug (components/debug/SchemaDeLaBase.astro ; site de dev seulement, jamais dans un build
// SITE_MODE=prod ni dans la version portable : le composant n'y est pas rendu). N'importe que lib/debug-schema.mjs (pur), qu'aucun autre script de
// page n'importe ; aucun module commun avec scripts/debug.mjs (test/debug-schema.test.mjs).
//
//   1. Rien avant la première ouverture du cadre (<details> fermé par défaut) : alors seulement, la structure posée au build (<script
//      type="application/json" data-debug-schema>) est lue, mise en page (mettreEnPage) et dessinée une fois (htmlDuSchema : boîtes HTML, liens
//      SVG) ; le zoom et le déplacement ne changent que la transformation CSS du conteneur [data-schema-monde] (une écriture par trame au plus) et,
//      selon le zoom, le niveau de détail (data-detail de la carte, styles/debug/schema.css) ; l'épaisseur des traits suit le zoom à la fin du geste
//      (et pendant un grand zoom, par paliers : ECART_DES_TRAITS) ; « Tout voir » cadre l'ensemble sous les boutons.
//   2. Souris : molette = zoom autour du pointeur, une fois la carte activée (un clic ou le focus dedans, ou le plein cadre ; Ctrl + molette et le
//      pincement du pavé tactile toujours) — de passage, la molette fait défiler la page, et toujours quand le zoom est à sa borne
//      (lib/debug-schema.mjs#actionDeLaMolette) ; glisser = déplacer ; survol d'une table = ses liens entrants et sortants éclairés ; clic sur la
//      pastille d'une clé étrangère = la vue va aussitôt à la table visée (plusieurs tables visées : la liste des clés) ; double clic ailleurs = le
//      contenu de la table. Toucher : un doigt déplace, deux doigts zooment, appui long = le contenu. Clavier (sur une table : une seule table dans
//      l'ordre de tabulation, « roving tabindex ») : flèches = table voisine (la vue la suit), Maj + flèches = déplacer la vue, + et − = zoom, 0 = tout
//      voir, L = la liste des clés étrangères de la table (Entrée y va), Entrée ou Espace = le contenu. Boutons +, −, « Tout voir », « Plein cadre »
//      (Échap le quitte, où que soit le focus ; le reste de la page est alors inerte). Recherche d'une table (centrée, mise en évidence ; Entrée y
//      met le focus). Cases « Montrer les vues » (masquées par défaut) et « Liens vers famille ». Les messages s'écrivent par-dessus la carte, sans
//      la déplacer. Le zoom et le déplacement replacent l'infobulle ouverte (un évènement « scroll » : components/Infobulles.astro).
//      Les nombres de lignes des boîtes : ceux de la base vivante (GET <base>api/debug/tables/, une fois), sinon ceux du build.
//   3. Contenu d'une table : une fenêtre modale (<dialog>), GET <base>api/debug/tables/<nom>/?limite=100&decalage=&tri=&ordre= (lecture seule, site
//      de dev seulement : 403 ailleurs, message clair ; service absent : message clair), par pages de 100 (« Charger plus », et au défilement),
//      total affiché, tri par en-tête ; une cellule coupée (trois lignes) est marquée d'un fondu, se déplie d'un clic ou au clavier (Entrée, Espace) ;
//      Échap, « Fermer » ou un clic hors du tableau la ferment.
// Jamais d'infobulle native (data-infobulle, components/Infobulles.astro) ; texte de la base toujours échappé (lib/debug-schema.mjs).
import {
  PAGE_DE_LIGNES, PAS_DE_ZOOM, actionDeLaMolette, adresseDuContenu, cadrer, centrerSur, chercherTable, clesASuivre, comptesVivants, deplacer, echapper,
  etiquetteDeTable, htmlDesCles, htmlDesEntetes, htmlDesLignes, htmlDuSchema, interpoler, libelleDesLignes, messageDErreur, mettreEnPage, montrer,
  niveauDeDetail, nombre, resumeDuContenu, schemaVersEcran, tableVoisine, traitsARefaire, triSuivant, zoomAutour,
} from '../lib/debug-schema.mjs';

const cadre = document.querySelector('[data-schema-cadre]');
const source = document.querySelector('script[data-debug-schema]');
if (cadre && source) {
  let lance = false;
  const lancer = () => {
    if (lance || !cadre.open) return;
    lance = true;
    try {
      brancher(cadre, source);
    } catch (erreur) {
      const annonce = cadre.querySelector('[data-schema-annonce]');
      annonce.classList.add('debug-annonce--erreur');
      annonce.textContent = `Le schéma n’a pas pu être dessiné : ${erreur?.message ?? erreur}`;
    }
  };
  cadre.addEventListener('toggle', lancer);
  lancer();
}

function brancher(cadre, source) {
  const $ = (selecteur) => cadre.querySelector(selecteur);
  const api = cadre.dataset.api || '/api/';
  const vueEl = $('[data-schema-vue]');
  const carte = $('[data-schema-carte]');
  const monde = $('[data-schema-monde]');
  const annonce = $('[data-schema-annonce]');
  const recherche = $('[data-schema-recherche]');
  const caseVues = $('[data-schema-vues]');
  const caseCommuns = $('[data-schema-communs]');
  const boutonAgrandir = $('[data-schema-agrandir]');
  const conseil = $('[data-schema-conseil]');
  const menuCles = $('[data-schema-cles]');
  // les messages s'écrivent PAR-DESSUS la carte (rien ne bouge sous le pointeur) et s'effacent d'eux-mêmes
  let effacement = 0;
  const dire = (texte) => {
    annonce.textContent = texte;
    clearTimeout(effacement);
    if (texte) effacement = setTimeout(() => { annonce.textContent = ''; }, 10_000);
  };

  // ---- dessin (une fois) -------------------------------------------------------------------------------------------------------------------
  const structure = JSON.parse(source.textContent);
  const plan = mettreEnPage(structure);
  monde.innerHTML = htmlDuSchema(structure, plan);
  monde.style.width = `${plan.cadreTout.x + plan.cadreTout.largeur}px`;
  monde.style.height = `${plan.cadreTout.y + plan.cadreTout.hauteur}px`;
  $('[data-schema-attente]').hidden = true;
  $('[data-schema-noms]').innerHTML = structure.tables.map((t) => `<option value="${echapper(t.nom)}"></option>`).join('');
  const tableDe = new Map(structure.tables.map((t) => [t.nom, t]));
  const boiteDe = new Map(plan.boites.map((b) => [b.nom, b]));
  const elTable = new Map([...monde.querySelectorAll('[data-table]')].map((g) => [g.dataset.table, g]));
  const groupeLiens = monde.querySelector('[data-schema-liens]');
  const liensDe = new Map();
  for (const p of groupeLiens.querySelectorAll('[data-lien]')) {
    for (const nom of new Set([p.dataset.de, p.dataset.vers])) (liensDe.get(nom) ?? liensDe.set(nom, []).get(nom)).push(p);
  }
  const premiere = plan.boites.find((b) => b.genre !== 'vue')?.nom ?? plan.boites[0]?.nom;

  // les nombres de lignes de la base vivante (le dessin porte ceux du build) : GET <base>api/debug/tables/, une fois ; sans réponse, ceux du build
  const sourceDesComptes = $('[data-schema-comptes]');
  fetch(`${api}debug/tables/`, { cache: 'no-store', headers: { Accept: 'application/json' } })
    .then((r) => (r.ok ? r.json() : null))
    .then((corps) => {
      if (!Array.isArray(corps?.tables)) return;
      for (const { nom, lignes } of comptesVivants(structure, corps)) {
        const t = tableDe.get(nom);
        t.lignes = lignes;
        const el = elTable.get(nom);
        el.querySelector('.schema-table__compte').textContent = libelleDesLignes(lignes);
        el.setAttribute('aria-label', etiquetteDeTable(t));
      }
      sourceDesComptes.textContent = 'de la base vivante du service';
    })
    .catch(() => {});

  // ---- vue : écran = schéma × k + (x, y) ---------------------------------------------------------------------------------------------------
  let vue = { x: 0, y: 0, k: 1 };
  let taille = mesurer();
  let touchee = false; // la vue a été déplacée ou zoomée : un redimensionnement garde le centre au lieu de tout recadrer
  let trame = 0;
  let animation = 0;
  const mouvementReduit = matchMedia('(prefers-reduced-motion: reduce)');

  // la carte (dans le cadre, bordure exclue) : origine des coordonnées de l'écran, celle du monde transformé
  function mesurer() {
    const r = carte.getBoundingClientRect();
    return { l: Math.max(1, r.width), h: Math.max(1, r.height) };
  }
  let finDeGeste = 0;
  let kTraits = 1; // le zoom pour lequel l'épaisseur des traits est posée (--k : 1 dans la CSS)
  const poserLesTraits = () => {
    kTraits = vue.k;
    monde.style.setProperty('--k', kTraits.toFixed(5));
  };
  function rendre() {
    monde.style.transform = `translate(${vue.x.toFixed(2)}px, ${vue.y.toFixed(2)}px) scale(${vue.k.toFixed(5)})`;
    // l'infobulle ouverte (une colonne sous le pointeur) suit sa ligne, ou se ferme si elle sort de l'écran : components/Infobulles.astro la replace
    // à chaque « scroll » (écouteur de capture), et la molette ne fait défiler rien d'autre
    carte.dispatchEvent(new Event('scroll'));
    const niveau = niveauDeDetail(vue.k);
    if (carte.dataset.detail !== niveau) carte.dataset.detail = niveau;
    // l'épaisseur des traits (liens, cadres) suit le zoom une fois le geste fini, et pendant un grand zoom dès que l'écart dépasse ECART_DES_TRAITS :
    // la changer à chaque image ferait tout recalculer (lib/debug-schema.mjs#traitsARefaire)
    if (traitsARefaire(kTraits, vue.k)) poserLesTraits();
    clearTimeout(finDeGeste);
    finDeGeste = setTimeout(poserLesTraits, 140);
  }
  /** Nouvelle vue, rendue à la prochaine trame (plusieurs évènements par trame : une seule écriture). */
  function poser(v) {
    vue = v;
    if (!trame) trame = requestAnimationFrame(() => { trame = 0; rendre(); });
  }
  function arreter() {
    cancelAnimationFrame(animation);
    animation = 0;
  }
  /** Vers une vue, en 320 ms (rien d'animé si l'utilisateur réduit les animations). */
  function allerA(cible, duree = 320) {
    arreter();
    if (mouvementReduit.matches) return poser(cible);
    const depart = vue;
    const debut = performance.now();
    const { l, h } = taille;
    const pas = (instant) => {
      const u = Math.min(1, (instant - debut) / duree);
      const e = u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2;
      vue = u >= 1 ? cible : interpoler(depart, cible, e, l, h);
      rendre();
      animation = u < 1 ? requestAnimationFrame(pas) : 0;
    };
    animation = requestAnimationFrame(pas);
  }
  const cadreAVoir = () => (caseVues.checked ? plan.cadreTout : plan.cadreTables);
  const commandes = $('.schema-commandes');
  const toutVoir = (anime = true) => {
    // les boutons (en haut, posés sur la carte) ne cachent aucun bloc : l'ensemble est cadré sous eux
    const haut = Math.min(commandes.offsetTop + commandes.offsetHeight, taille.h / 3);
    const cible = cadrer(cadreAVoir(), taille.l, Math.max(1, taille.h - haut));
    cible.y += haut;
    if (anime) allerA(cible);
    else {
      vue = cible;
      rendre();
    }
  };
  const centre = () => ({ x: taille.l / 2, y: taille.h / 2 });
  /** Le point autour duquel zoomer au clavier ou aux boutons : la table du focus si elle se voit, sinon le centre du cadre. */
  function pointDeZoom() {
    const b = boiteDe.get(courante);
    if (b && carte.contains(document.activeElement) && document.activeElement !== carte) {
      const p = schemaVersEcran(vue, { x: b.x + b.largeur / 2, y: b.y + Math.min(b.hauteur / 2, 120) });
      if (p.x >= 0 && p.y >= 0 && p.x <= taille.l && p.y <= taille.h) return p;
    }
    return centre();
  }
  function zoomer(facteur) {
    touchee = true;
    allerA(zoomAutour(vue, facteur, pointDeZoom()), 180);
  }

  toutVoir(false);
  new ResizeObserver(() => {
    const r = carte.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return; // cadre replié : rien à refaire
    const avant = taille;
    taille = mesurer();
    if (!touchee) return toutVoir(false);
    const c = { x: (avant.l / 2 - vue.x) / vue.k, y: (avant.h / 2 - vue.y) / vue.k };
    poser({ k: vue.k, x: taille.l / 2 - c.x * vue.k, y: taille.h / 2 - c.y * vue.k });
  }).observe(carte);

  // ---- tables : focus (roving tabindex), éclairage, mise en évidence ------------------------------------------------------------------------
  let courante = null;
  function definirCourante(nom) {
    const el = elTable.get(nom);
    if (!el || courante === nom) return;
    elTable.get(courante)?.setAttribute('tabindex', '-1');
    el.setAttribute('tabindex', '0');
    courante = nom;
  }
  definirCourante(premiere);
  const visibles = () => plan.boites.filter((b) => caseVues.checked || b.genre !== 'vue');

  let eclairee = null;
  function eteindre() {
    if (!eclairee) return;
    carte.classList.remove('a-eclairage');
    elTable.get(eclairee)?.classList.remove('est-eclairee');
    for (const p of liensDe.get(eclairee) ?? []) {
      p.classList.remove('est-relie');
      elTable.get(p.dataset.de === eclairee ? p.dataset.vers : p.dataset.de)?.classList.remove('est-voisine');
    }
    eclairee = null;
  }
  function eclairer(nom) {
    if (eclairee === nom) return;
    eteindre();
    if (!nom || !elTable.has(nom)) return;
    eclairee = nom;
    carte.classList.add('a-eclairage');
    elTable.get(nom).classList.add('est-eclairee');
    for (const p of liensDe.get(nom) ?? []) {
      p.classList.add('est-relie');
      groupeLiens.appendChild(p); // au-dessus des autres liens
      const autre = p.dataset.de === nom ? p.dataset.vers : p.dataset.de;
      if (autre !== nom) elTable.get(autre)?.classList.add('est-voisine');
    }
  }
  const tableDuFocus = () => (carte.contains(document.activeElement) ? document.activeElement.closest?.('[data-table]')?.dataset.table ?? null : null);

  let trouvee = null;
  function marquer(nom) {
    if (trouvee) elTable.get(trouvee)?.classList.remove('est-trouvee');
    trouvee = nom;
    if (nom) elTable.get(nom)?.classList.add('est-trouvee');
  }

  /** La vue va à une table (centrée, lisible) ; une vue masquée fait cocher « Montrer les vues ». */
  function allerALaTable(nom) {
    const b = boiteDe.get(nom);
    if (!b) return;
    if (b.genre === 'vue' && !caseVues.checked) {
      caseVues.checked = true;
      majVues();
    }
    touchee = true;
    allerA(centrerSur(b, vue, taille.l, taille.h));
  }

  function majVues() {
    carte.classList.toggle('avec-vues', caseVues.checked);
    if (caseVues.checked) return;
    if (boiteDe.get(courante)?.genre === 'vue') definirCourante(premiere);
    if (trouvee && boiteDe.get(trouvee)?.genre === 'vue') marquer(null);
  }
  caseVues.addEventListener('change', () => {
    majVues();
    toutVoir();
  });
  caseCommuns?.addEventListener('change', () => carte.classList.toggle('sans-communs', !caseCommuns.checked));

  // ---- souris et toucher -------------------------------------------------------------------------------------------------------------------
  const point = (e) => {
    const r = carte.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const pointeurs = new Map();
  let geste = null; // { type: 'glisser', depart, vue } ou { type: 'pincer', distance, milieu, vue }
  let glisse = false; // le geste en cours (ou le dernier) a bougé la vue : le clic qui le suit ne compte pas
  let appuiLong = 0;
  let appuiLongFait = false;
  let dernierType = 'mouse';
  const DUREE_APPUI_LONG = 500;

  const milieuEtEcart = () => {
    const [a, b] = [...pointeurs.values()];
    return { milieu: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, distance: Math.hypot(a.x - b.x, a.y - b.y) };
  };

  carte.addEventListener('pointerdown', (e) => {
    dernierType = e.pointerType;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    activee = true;
    fermerCles();
    // l'animation en cours (clé suivie, recherche) n'est arrêtée qu'au début d'un vrai geste (glisser, pincer) : un clic ne la fige pas à mi-chemin
    pointeurs.set(e.pointerId, point(e));
    clearTimeout(appuiLong);
    if (pointeurs.size === 1) {
      glisse = false;
      appuiLongFait = false;
      geste = { type: 'glisser', depart: point(e), vue };
      const table = e.target.closest?.('[data-table]');
      if (e.pointerType !== 'mouse' && table) appuiLong = setTimeout(() => ouvrirParAppuiLong(table.dataset.table), DUREE_APPUI_LONG);
    } else if (pointeurs.size === 2) {
      arreter();
      glisse = true;
      geste = { type: 'pincer', ...milieuEtEcart(), vue };
      for (const id of pointeurs.keys()) {
        try { carte.setPointerCapture(id); } catch { /* pointeur déjà relâché */ }
      }
    }
  });
  function ouvrirParAppuiLong(nom) {
    if (appuiLongFait || glisse || geste?.type !== 'glisser') return;
    appuiLongFait = true;
    ouvrirContenu(nom);
  }
  carte.addEventListener('pointermove', (e) => {
    if (!pointeurs.has(e.pointerId)) return;
    const p = point(e);
    pointeurs.set(e.pointerId, p);
    if (geste?.type === 'glisser') {
      const dx = p.x - geste.depart.x;
      const dy = p.y - geste.depart.y;
      if (!glisse) {
        if (Math.hypot(dx, dy) < 6) return;
        arreter();
        geste.vue = vue;
        glisse = true;
        clearTimeout(appuiLong);
        carte.classList.add('est-glisse');
        try { carte.setPointerCapture(e.pointerId); } catch { /* pointeur déjà relâché */ }
      }
      touchee = true;
      poser(deplacer(geste.vue, dx, dy));
    } else if (geste?.type === 'pincer' && pointeurs.size >= 2) {
      const { milieu, distance } = milieuEtEcart();
      touchee = true;
      const zoomee = zoomAutour(geste.vue, distance / Math.max(1, geste.distance), geste.milieu);
      poser(deplacer(zoomee, milieu.x - geste.milieu.x, milieu.y - geste.milieu.y));
    }
  });
  const finir = (e) => {
    if (!pointeurs.delete(e.pointerId)) return;
    clearTimeout(appuiLong);
    if (pointeurs.size === 1 && geste?.type === 'pincer') {
      // un doigt reste : il reprend le déplacement d'où il est
      geste = { type: 'glisser', depart: [...pointeurs.values()][0], vue };
      return;
    }
    if (!pointeurs.size) {
      geste = null;
      carte.classList.remove('est-glisse');
    }
  };
  carte.addEventListener('pointerup', finir);
  carte.addEventListener('pointercancel', finir);
  // appui long au toucher : le menu contextuel du navigateur n'apparaît pas, la fenêtre du contenu s'ouvre
  carte.addEventListener('contextmenu', (e) => {
    if (dernierType === 'mouse') return;
    e.preventDefault();
    const table = e.target.closest?.('[data-table]');
    if (table) ouvrirParAppuiLong(table.dataset.table);
  });

  // la molette : le zoom d'une carte activée (clic ou focus dedans, plein cadre) ou avec Ctrl ; sinon la page défile (lib/debug-schema.mjs#actionDeLaMolette)
  let activee = false;
  let pointeurDedans = false;
  let conseilCache = 0;
  carte.addEventListener('pointerenter', () => { pointeurDedans = true; });
  carte.addEventListener('pointerleave', () => {
    pointeurDedans = false;
    activee = false;
  });
  carte.addEventListener('wheel', (e) => {
    const ctrl = e.ctrlKey || e.metaKey;
    const action = actionDeLaMolette({ ctrl, activee: activee || vueEl.classList.contains('est-agrandie'), k: vue.k, deltaY: e.deltaY });
    if (action !== 'zoom') {
      // de passage : la page défile ; un conseil dit comment zoomer (pas à la borne du zoom : là, le cran n'aurait rien changé)
      if (!activee && e.deltaY) {
        conseil.hidden = false;
        clearTimeout(conseilCache);
        conseilCache = setTimeout(() => { conseil.hidden = true; }, 1600);
      }
      return;
    }
    e.preventDefault();
    arreter();
    fermerCles();
    touchee = true;
    conseil.hidden = true;
    const unite = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? taille.h : 1;
    // Ctrl + molette : le pincement d'un pavé tactile (petits pas)
    poser(zoomAutour(vue, Math.exp(-e.deltaY * unite * (e.ctrlKey ? 0.01 : 0.0016)), point(e)));
  }, { passive: false });

  /** Suit une clé étrangère : la vue va à la table visée (centrée, mise en évidence, focus), le message dit laquelle. */
  function suivre(cible, message) {
    marquer(cible);
    allerALaTable(cible);
    definirCourante(cible);
    elTable.get(cible)?.focus({ preventScroll: true });
    dire(message);
  }
  // un clic sur la PASTILLE d'une clé étrangère la suit aussitôt (une table visée) ou ouvre la liste de ses clés (plusieurs) ; ailleurs, un clic
  // ne fait que choisir la table, et un double clic ouvre son contenu (aucune attente : un double clic lent ne suit plus la clé)
  carte.addEventListener('click', (e) => {
    if (glisse || appuiLongFait) return;
    const table = e.target.closest?.('[data-table]');
    if (!table) return;
    definirCourante(table.dataset.table);
    const pastille = e.target.closest('.schema-col__fk');
    if (!pastille || e.detail > 1) return;
    const ligne = pastille.closest('.schema-col[data-vers]');
    const cibles = ligne.dataset.vers.split(' ').filter(Boolean);
    if (cibles.length > 1) ouvrirCles(table.dataset.table, ligne.dataset.colonne);
    else suivre(cibles[0], `Clé étrangère ${table.dataset.table}.${ligne.dataset.colonne} → ${cibles[0]}.`);
  });
  carte.addEventListener('dblclick', (e) => {
    if (e.target.closest?.('.schema-col__fk')) return; // le premier clic a suivi la clé
    const table = e.target.closest?.('[data-table]');
    if (!table) return;
    e.preventDefault();
    ouvrirContenu(table.dataset.table);
  });

  // ---- liste des clés étrangères d'une table (L au clavier, pastille d'une colonne qui vise plusieurs tables) ----------------------------------
  let sourceDesCles = null;
  function fermerCles(rendreLeFocus = false) {
    if (menuCles.hidden) return;
    menuCles.hidden = true;
    if (rendreLeFocus) elTable.get(sourceDesCles)?.focus({ preventScroll: true });
    sourceDesCles = null;
  }
  function ouvrirCles(nom, colonne = null) {
    const cles = clesASuivre(tableDe.get(nom), colonne);
    if (!cles.length) return dire(`${nom} n’a pas de clé étrangère.`);
    sourceDesCles = nom;
    menuCles.innerHTML = htmlDesCles(cles);
    menuCles.setAttribute('aria-label', `Clés étrangères de ${nom}${colonne ? ` (${colonne})` : ''}`);
    menuCles.hidden = false;
    // près de la table (son bord droit, à l'écran), sans sortir du cadre
    const b = boiteDe.get(nom);
    const p = schemaVersEcran(vue, { x: b.x + b.largeur, y: b.y });
    const l = menuCles.offsetWidth;
    const h = menuCles.offsetHeight;
    menuCles.style.left = `${Math.max(8, Math.min(p.x + 8, taille.l - l - 8))}px`;
    menuCles.style.top = `${Math.max(8, Math.min(p.y, taille.h - h - 8))}px`;
    menuCles.querySelector('button')?.focus();
  }
  menuCles.addEventListener('click', (e) => {
    const bouton = e.target.closest('[data-cle-vers]');
    if (!bouton) return;
    const source = sourceDesCles;
    fermerCles();
    suivre(bouton.dataset.cleVers, `Clé étrangère ${source} : ${bouton.textContent}.`);
  });
  menuCles.addEventListener('keydown', (e) => {
    const boutons = [...menuCles.querySelectorAll('button')];
    const i = boutons.indexOf(document.activeElement);
    const aller = { ArrowDown: i + 1, ArrowUp: i - 1, Home: 0, End: boutons.length - 1 }[e.key];
    if (aller !== undefined) {
      boutons[(aller + boutons.length) % boutons.length]?.focus();
      e.preventDefault();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation(); // Échap ferme la liste, pas le plein cadre
      fermerCles(true);
    } else if (e.key === 'Tab') {
      e.preventDefault(); // Tab referme la liste et rend le focus à sa table (la liste n'est pas dans l'ordre de tabulation)
      fermerCles(true);
    }
  });
  menuCles.addEventListener('focusout', (e) => {
    if (!menuCles.contains(e.relatedTarget)) fermerCles();
  });

  carte.addEventListener('pointerover', (e) => {
    if (geste && glisse) return;
    eclairer(e.target.closest?.('[data-table]')?.dataset.table ?? tableDuFocus());
  });
  carte.addEventListener('pointerleave', () => eclairer(tableDuFocus()));
  carte.addEventListener('focusin', (e) => {
    const table = e.target.closest?.('[data-table]');
    if (!table) return;
    if (table.matches(':focus-visible')) activee = true; // arrivée au clavier : la molette y zoome aussi
    definirCourante(table.dataset.table);
    eclairer(table.dataset.table);
    // arrivée au clavier (Tab) sur une table hors de la vue : la vue la montre (sauf si elle y va déjà : recherche, clé étrangère)
    if (table.matches(':focus-visible') && !animation) allerA(montrer(boiteDe.get(table.dataset.table), vue, taille.l, taille.h), 200);
  });
  carte.addEventListener('focusout', (e) => {
    if (carte.contains(e.relatedTarget)) return;
    eteindre();
    // le focus quitte la carte (Tab) : désactivée ; pas quand un clic sur son fond le lui retire (le pointeur y est encore)
    if (!pointeurDedans && !menuCles.contains(e.relatedTarget)) activee = false;
  });

  // ---- clavier -------------------------------------------------------------------------------------------------------------------------------
  const PAS_CLAVIER = 90;
  carte.addEventListener('keydown', (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const nom = e.target.closest?.('[data-table]')?.dataset.table ?? null;
    const touche = e.key;
    if (touche === '+' || touche === '=') zoomer(PAS_DE_ZOOM);
    else if (touche === '-' || touche === '−' || touche === '_') zoomer(1 / PAS_DE_ZOOM);
    else if (touche === '0') {
      touchee = true;
      toutVoir();
    } else if (touche.startsWith('Arrow')) {
      if (e.shiftKey || !nom) {
        const [dx, dy] = { ArrowLeft: [1, 0], ArrowRight: [-1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[touche] ?? [0, 0];
        touchee = true;
        allerA(deplacer(vue, dx * PAS_CLAVIER, dy * PAS_CLAVIER), 120);
      } else {
        const voisine = tableVoisine(visibles(), nom, touche);
        if (voisine) {
          definirCourante(voisine);
          elTable.get(voisine).focus({ preventScroll: true });
          allerA(montrer(boiteDe.get(voisine), vue, taille.l, taille.h), 200);
        }
      }
    } else if ((touche === 'l' || touche === 'L') && nom) ouvrirCles(nom);
    else if ((touche === 'Enter' || touche === ' ') && nom) ouvrirContenu(nom);
    else return;
    e.preventDefault();
  });

  // ---- boutons, plein cadre, recherche ----------------------------------------------------------------------------------------------------
  for (const bouton of cadre.querySelectorAll('[data-schema-zoom]')) {
    bouton.addEventListener('click', () => {
      const action = bouton.dataset.schemaZoom;
      if (action === 'tout') {
        touchee = true;
        toutVoir();
      } else zoomer(action === 'plus' ? PAS_DE_ZOOM : 1 / PAS_DE_ZOOM);
    });
  }
  // plein cadre : le reste de la page devient inerte (ni Tab ni lecteur d'écran n'y vont, cachés sous la carte) — sauf la fenêtre du contenu et les
  // bulles —, et Échap le quitte où que soit le focus (un glisser le laisse sur la page)
  let inertes = [];
  const quitterAEchap = (e) => {
    if (e.key !== 'Escape' || !vueEl.classList.contains('est-agrandie') || dialogue.open || e.defaultPrevented) return;
    e.preventDefault();
    agrandir(false);
  };
  function agrandir(oui) {
    vueEl.classList.toggle('est-agrandie', oui);
    boutonAgrandir.setAttribute('aria-pressed', String(oui));
    document.documentElement.style.overflow = oui ? 'hidden' : '';
    for (const el of inertes) el.inert = false;
    inertes = [];
    document.removeEventListener('keydown', quitterAEchap);
    if (!oui) return;
    for (let n = vueEl; n.parentElement && n !== document.body; n = n.parentElement) {
      for (const frere of n.parentElement.children) {
        if (frere === n || frere.inert || frere.matches('dialog, script, style, template, .bulle, [role="tooltip"], [class^="bulle"]')) continue;
        frere.inert = true;
        inertes.push(frere);
      }
    }
    document.addEventListener('keydown', quitterAEchap);
  }
  boutonAgrandir.addEventListener('click', () => agrandir(!vueEl.classList.contains('est-agrandie')));

  const noms = structure.tables.map((t) => t.nom);
  let attenteRecherche = 0;
  function chercher() {
    const texte = recherche.value.trim();
    if (!texte) {
      marquer(null);
      dire('');
      return null;
    }
    const nom = chercherTable(noms, texte);
    if (!nom) {
      marquer(null);
      dire(`Aucune table ne correspond à « ${texte} ».`);
      return null;
    }
    marquer(nom);
    definirCourante(nom);
    allerALaTable(nom);
    const t = tableDe.get(nom);
    dire(`${etiquetteDeTable(t)} — section ${t.section}. Entrée : aller à la table.`);
    return nom;
  }
  recherche.addEventListener('input', () => {
    clearTimeout(attenteRecherche);
    attenteRecherche = setTimeout(chercher, 250);
  });
  recherche.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    clearTimeout(attenteRecherche);
    const nom = chercher();
    if (nom) elTable.get(nom).focus({ preventScroll: true });
  });

  // ---- fenêtre « Contenu de <table> » -------------------------------------------------------------------------------------------------------
  const dialogue = document.querySelector('[data-schema-dialogue]');
  const d$ = (selecteur) => dialogue.querySelector(selecteur);
  const nomEl = d$('[data-schema-contenu-nom]');
  const resume = d$('[data-schema-contenu-resume]');
  const erreurEl = d$('[data-schema-contenu-erreur]');
  const defilement = d$('[data-schema-contenu-defilement]');
  const entetes = d$('[data-schema-contenu-entetes]');
  const lignes = d$('[data-schema-contenu-lignes]');
  const sentinelle = d$('[data-schema-contenu-sentinelle]');
  const plus = d$('[data-schema-plus]');
  const contenu = { nom: null, tri: null, ordre: 'asc', decalage: 0, total: 0, colonnes: [], enCours: false, fini: true, demande: 0, focusApres: null };

  function ouvrirContenu(nom) {
    fermerCles();
    if (!tableDe.has(nom)) return;
    Object.assign(contenu, { nom, tri: null, ordre: 'asc' });
    nomEl.textContent = nom;
    recommencer(true);
    if (!dialogue.open) dialogue.showModal();
    defilement.scrollTo(0, 0);
  }
  /** Repart de la première page (autre table : en-têtes refaits ; autre tri : gardés jusqu'à la réponse). */
  function recommencer(autreTable) {
    contenu.demande++;
    Object.assign(contenu, { decalage: 0, total: 0, enCours: false, fini: false });
    if (autreTable) {
      contenu.colonnes = [];
      entetes.innerHTML = '';
    }
    lignes.innerHTML = '';
    erreurEl.hidden = true;
    plus.hidden = true;
    resume.textContent = 'Chargement…';
    charger();
  }
  async function charger() {
    if (contenu.enCours || contenu.fini || !contenu.nom) return;
    contenu.enCours = true;
    const demande = contenu.demande;
    plus.disabled = true;
    let reponse = null;
    let corps = null;
    try {
      reponse = await fetch(adresseDuContenu(api, contenu.nom, { limite: PAGE_DE_LIGNES, decalage: contenu.decalage, tri: contenu.tri, ordre: contenu.ordre }), {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      });
      corps = await reponse.json().catch(() => null);
    } catch {
      reponse = null;
    }
    if (demande !== contenu.demande) return; // une autre table, un autre tri, ou la fenêtre fermée entre-temps
    contenu.enCours = false;
    plus.disabled = false;
    if (!reponse || !reponse.ok || !Array.isArray(corps?.lignes) || !Array.isArray(corps?.colonnes)) {
      erreurEl.textContent = messageDErreur(reponse ? reponse.status : 0, corps);
      erreurEl.hidden = false;
      resume.textContent = '';
      contenu.fini = true; // pas de nouvel essai au défilement : fermer et rouvrir
      plus.hidden = true;
      return;
    }
    if (contenu.decalage === 0) {
      contenu.colonnes = corps.colonnes;
      entetes.innerHTML = htmlDesEntetes(corps.colonnes, contenu);
      if (contenu.focusApres) {
        [...entetes.querySelectorAll('[data-tri-colonne]')].find((b) => b.dataset.triColonne === contenu.focusApres)?.focus();
        contenu.focusApres = null;
      }
    }
    lignes.insertAdjacentHTML('beforeend', htmlDesLignes(contenu.colonnes, corps.lignes));
    marquerLesCoupees();
    contenu.decalage += corps.lignes.length;
    contenu.total = Number(corps.total) || 0;
    contenu.fini = corps.lignes.length === 0 || contenu.decalage >= contenu.total;
    resume.textContent = resumeDuContenu(contenu.decalage, contenu.total);
    plus.hidden = contenu.fini;
    if (!contenu.fini) plus.textContent = `Charger plus (${nombre(contenu.total - contenu.decalage)} restantes)`;
    suiteSiVisible();
  }
  /**
   * Les cellules que la hauteur de trois lignes coupe : un fondu le montre, et elles prennent le focus (Entrée ou Espace les déplient). Toutes les
   * mesures d'abord, puis toutes les écritures (une seule mise en page).
   */
  function marquerLesCoupees() {
    const neuves = [...lignes.querySelectorAll('td:not([data-mesuree])')];
    const coupees = neuves.filter((td) => td.firstElementChild && td.firstElementChild.scrollHeight > td.firstElementChild.clientHeight + 1);
    for (const td of neuves) td.dataset.mesuree = '';
    for (const td of coupees) {
      td.classList.add('est-coupee');
      td.tabIndex = 0;
      td.setAttribute('aria-description', 'texte coupé : Entrée ou un clic le déplie');
    }
  }
  /** La fin du tableau est encore à l'écran (peu de lignes, grand écran) : la page suivante, sans attendre un défilement. */
  function suiteSiVisible() {
    requestAnimationFrame(() => {
      if (!dialogue.open || contenu.fini || contenu.enCours) return;
      if (sentinelle.getBoundingClientRect().top < defilement.getBoundingClientRect().bottom + 300) charger();
    });
  }
  new IntersectionObserver((entrees) => {
    if (entrees.some((e) => e.isIntersecting)) charger();
  }, { root: defilement, rootMargin: '0px 0px 300px 0px' }).observe(sentinelle);
  plus.addEventListener('click', () => charger());
  entetes.addEventListener('click', (e) => {
    const bouton = e.target.closest('[data-tri-colonne]');
    if (!bouton) return;
    Object.assign(contenu, triSuivant(contenu, bouton.dataset.triColonne), { focusApres: bouton.dataset.triColonne });
    defilement.scrollTo({ top: 0 });
    recommencer(false);
  });
  lignes.addEventListener('click', (e) => {
    const cellule = e.target.closest('td');
    if (cellule && !String(getSelection?.() ?? '')) cellule.classList.toggle('est-depliee');
  });
  lignes.addEventListener('keydown', (e) => {
    const cellule = e.target.closest?.('td.est-coupee');
    if (!cellule || (e.key !== 'Enter' && e.key !== ' ')) return;
    e.preventDefault();
    cellule.classList.toggle('est-depliee');
  });
  d$('[data-schema-fermer]').addEventListener('click', () => dialogue.close());
  // un clic hors du tableau (sur le fond) ferme : appui ET relâchement sur le fond (une sélection qui finit dehors ne ferme pas)
  let appuiSurLeFond = false;
  dialogue.addEventListener('pointerdown', (e) => { appuiSurLeFond = e.target === dialogue; });
  dialogue.addEventListener('click', (e) => {
    if (appuiSurLeFond && e.target === dialogue) dialogue.close();
    appuiSurLeFond = false;
  });
  dialogue.addEventListener('close', () => {
    contenu.demande++; // une réponse encore en route n'écrit plus rien
    contenu.enCours = false;
    contenu.fini = true;
    elTable.get(contenu.nom)?.focus({ preventScroll: true });
  });
}
