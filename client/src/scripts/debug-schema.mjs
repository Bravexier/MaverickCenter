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
//      Les nombres de lignes des boîtes : ceux de la base vivante (GET <base>api/debug/tables/, après la première relève de la version, puis à
//      chaque version nouvelle : 4 ; une boîte dont le nombre change ensuite s'éclaire 2 s), sinon ceux du build.
//   3. Contenu d'une table : une fenêtre modale (<dialog>), GET <base>api/debug/tables/<nom>/?limite=100&decalage=&tri=&ordre= (lecture seule, site
//      de dev seulement — toutes les tables et vues, fiches de personnages comprises : « Il faut tout rendre ouvert. Ce qui est fermé c'est que la
//      base du serveur de prod », demande du propriétaire du 2026-10-15 ; 403 ailleurs, message clair ; service absent : message clair), par pages
//      de 100 toujours alignées (décalages 0, 100, … : chacune garde l'ETag de sa réponse, qui vaut pour ses lignes affichées — une page relue qui
//      ne redonne pas celles déjà là fait d'abord rafraîchir le tableau : pageAccordee), « Charger plus » et au défilement, total affiché, tri
//      par en-tête ; une cellule coupée (trois lignes) est marquée d'un fondu, se déplie d'un clic ou au clavier (Entrée, Espace) ; Échap,
//      « Fermer » ou un clic hors du tableau la ferment. Suivi en direct (« j'aimerais que ce tableau se mette à jour si la table change ») : à
//      chaque version nouvelle de la base (4), chaque page déjà chargée est redemandée avec If-None-Match (304 : inchangée) ; le tableau montre
//      alors les premières min(lignes affichées avant, total) lignes de la table, et seules les lignes dont le JSON n'était pas affiché sont refaites
//      (lib/debug-schema.mjs#planDeMiseAJour) et mises en évidence 2 s ; rien d'autre ne bouge : défilement (la première ligne visible gardée à sa
//      place, sauf tout en haut), tri, en-têtes (refaits si les colonnes changent, focus du bouton de tri gardé), cellules dépliées, focus. Jamais
//      deux rafraîchissements à la fois, jamais pendant un chargement de page (il attend la fin) ; une autre table, un autre tri ou la fermeture
//      l'abandonnent ; plusieurs versions vues pendant l'un : un seul de plus ensuite. « Charger plus » n'est jamais désactivé (il garderait mal le
//      focus) : un clic pendant un rafraîchissement est rejoué après lui. 404 (table disparue) : message, ni réécrit ni annoncé de nouveau tant
//      qu'il ne change pas ; 400 (colonne de tri disparue) : ordre par défaut, rechargé, dit avec le résumé du rechargement et dans la ligne d'état ;
//      réseau : « interrompu », contenu gardé, nouvel essai à la relève suivante ; une lecture de page en échec (première page, « Charger plus »)
//      se relit à la version suivante sans rien effacer, et le tableau rafraîchi sans changement repart d'où il était. Ligne d'état « Suivi en
//      direct » dans l'en-tête ; la zone « live » n'annonce que les changements.
//   4. Relève de la version de la base (GET <base>api/debug/base/ : un texte opaque, qui change à chaque écriture validée) : toutes les 2 s, tant que
//      le menu est ouvert ET la page visible (setTimeout enchaîné, jamais deux à la fois ; aussitôt à l'ouverture et au retour au premier plan ; 403 :
//      arrêt définitif ; réseau ou 5xx : toutes les 10 s, puis 2 s après un succès : lib/debug-schema.mjs#suiteDeLaReleve). La première réponse sert
//      de référence ; une version différente fait relire les nombres de lignes et, fenêtre ouverte, son contenu (3). Une relève dont la réponse
//      arrive menu refermé ou page cachée n'a pas de suite (rien de relu : la version sera revue à la réouverture).
// Jamais d'infobulle native (data-infobulle, components/Infobulles.astro) ; texte de la base toujours échappé (lib/debug-schema.mjs).
import {
  MISE_EN_EVIDENCE_MS, PAGE_DE_LIGNES, PAS_DE_ZOOM, RELEVE_EN_PANNE_MS, actionDeLaMolette, adresseDeLaVersion, adresseDuContenu, annonceDuChangement,
  assemblerLesPages, cadrer, centrerSur, chercherTable, cleDeLigne, clesASuivre, comptesVivants, debutDePage, deplacer, echapper, etatDeLEchec,
  etiquetteDeTable, heureCourte, htmlDesCles, htmlDesEntetes, htmlDesLignes, htmlDuSchema, interpoler, libelleDesLignes, libelleDuSuivi, messageDErreur,
  mettreEnPage, montrer, niveauDeDetail, noteDuTriPerdu, nombre, pageAccordee, pagesARedemander, planDeMiseAJour, resumeDesChangements, resumeDuContenu,
  schemaVersEcran, suiteDeLaReleve, tableVoisine, traitsARefaire, triSuivant, zoomAutour,
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

  // les nombres de lignes de la base vivante (le dessin porte ceux du build) : GET <base>api/debug/tables/, après la première relève de la version
  // puis à chaque version nouvelle (4) ; sans réponse, ceux du build. Une seule lecture à la fois (une demande pendant l'une : une de plus ensuite).
  // Une boîte dont le nombre change ensuite s'éclaire MISE_EN_EVIDENCE_MS (pas à la première lecture : elle remplace seulement ceux du build).
  const sourceDesComptes = $('[data-schema-comptes]');
  const comptes = { enCours: false, encore: false, lus: false };
  const eclairages = new Map(); // boîte → minuterie de son éclairage
  function eclairerLesBoites(boites) {
    for (const el of boites) {
      clearTimeout(eclairages.get(el));
      el.classList.remove('est-changee');
    }
    if (boites.length) void monde.offsetWidth; // l'animation repart pour une boîte encore éclairée (deux changements en moins de 2 s)
    for (const el of boites) {
      el.classList.add('est-changee');
      eclairages.set(el, setTimeout(() => {
        el.classList.remove('est-changee');
        eclairages.delete(el);
      }, MISE_EN_EVIDENCE_MS));
    }
  }
  async function relireLesComptes() {
    comptes.lus = true;
    if (comptes.enCours) {
      comptes.encore = true;
      return;
    }
    comptes.enCours = true;
    let statut = 0;
    let corps = null;
    try {
      const r = await fetch(`${api}debug/tables/`, { cache: 'no-store', headers: { Accept: 'application/json' } });
      statut = r.status;
      corps = r.ok ? await r.json().catch(() => null) : null;
    } catch {
      statut = 0;
    }
    comptes.enCours = false;
    if (Array.isArray(corps?.tables)) {
      const changees = [];
      for (const { nom, lignes } of comptesVivants(structure, corps)) {
        const t = tableDe.get(nom);
        t.lignes = lignes;
        const el = elTable.get(nom);
        el.querySelector('.schema-table__compte').textContent = libelleDesLignes(lignes);
        el.setAttribute('aria-label', etiquetteDeTable(t));
        changees.push(el);
      }
      if ('vivants' in sourceDesComptes.dataset) eclairerLesBoites(changees);
      sourceDesComptes.dataset.vivants = '';
      majSourceDesComptes();
    } else if (!statut || statut >= 500) suivi.enRetard = true; // relus à la relève suivante qui réussit
    if (comptes.encore) {
      comptes.encore = false;
      relireLesComptes();
    }
  }
  function majSourceDesComptes() {
    if (!('vivants' in sourceDesComptes.dataset)) return;
    const etat = suivi.arret ? 'sans suivi' : suivi.panne !== null ? 'suivi interrompu' : 'suivis en direct';
    const texte = `de la base vivante du service, ${etat}`;
    if (sourceDesComptes.textContent !== texte) sourceDesComptes.textContent = texte;
  }

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
  const ligneDuSuivi = d$('[data-schema-suivi]');
  const texteDuSuivi = d$('[data-schema-suivi-texte]');
  const annonceDuContenu = d$('[data-schema-contenu-annonce]');
  const erreurEl = d$('[data-schema-contenu-erreur]');
  const defilement = d$('[data-schema-contenu-defilement]');
  const entetes = d$('[data-schema-contenu-entetes]');
  const lignes = d$('[data-schema-contenu-lignes]');
  const sentinelle = d$('[data-schema-contenu-sentinelle]');
  const plus = d$('[data-schema-plus]');
  // cles : le JSON de chaque ligne affichée, dans l'ordre des <tr> (leur identité) ; etags : celui de la réponse de chaque page chargée (pages
  // alignées : décalages 0, 100, …) ; rafraichit / aRafraichir / chargerApres : le suivi en direct (4), jamais en même temps qu'un chargement ;
  // note : ce que la première page relue dira en plus de son résumé (une colonne de tri disparue : lib/debug-schema.mjs#noteDuTriPerdu)
  const contenu = {
    nom: null, tri: null, ordre: 'asc', total: 0, colonnes: [], cles: [], etags: new Map(), enCours: false, fini: true, demande: 0, focusApres: null,
    rafraichit: false, aRafraichir: false, chargerApres: false, note: null,
  };
  // la relève de la version de la base (4) : arret = la raison d'un refus (403, plus de relève) ; panne = le statut de la dernière relève en échec
  // (0 : réseau), null sinon ; enRetard = une lecture a échoué depuis la dernière version vue (refaite à la relève suivante qui réussit)
  const suivi = { minuterie: 0, enCours: false, arret: null, panne: null, reference: null, enRetard: false };
  let etatBon = { genre: 'attente' }; // l'état de la fenêtre après sa dernière lecture réussie (lib/debug-schema.mjs#libelleDuSuivi)
  let etatDuContenu = etatBon; // le même, ou un échec du rafraîchissement

  /** La ligne d'état « Suivi en direct — … » : un refus ou une panne de la relève l'emporte sur l'état de la fenêtre. */
  function majSuivi() {
    const etat = suivi.arret ? { genre: 'arrete', raison: suivi.arret }
      : suivi.panne !== null ? { genre: 'interrompu', statut: suivi.panne, delai: RELEVE_EN_PANNE_MS } : etatDuContenu;
    const texte = libelleDuSuivi(etat);
    if (texteDuSuivi.textContent !== texte) texteDuSuivi.textContent = texte;
    if (ligneDuSuivi.dataset.etat !== etat.genre) ligneDuSuivi.dataset.etat = etat.genre;
    majSourceDesComptes();
  }
  // la zone « live » (polite) : le résultat d'un chargement et les changements du suivi, jamais une relève sans changement ; vidée puis écrite, pour
  // qu'un même texte soit annoncé deux fois
  let ecritureDeLAnnonce = 0;
  function annoncer(texte) {
    if (!texte) return;
    clearTimeout(ecritureDeLAnnonce);
    annonceDuContenu.textContent = '';
    ecritureDeLAnnonce = setTimeout(() => { annonceDuContenu.textContent = texte; }, 60);
  }
  const ecrireLeResume = (texte) => {
    if (resume.textContent !== texte) resume.textContent = texte;
  };
  /**
   * Le message d'erreur de la fenêtre (role="alert" : annoncé à chaque écriture), réécrit seulement s'il change — une table toujours introuvable n'est
   * pas annoncée de nouveau à chaque écriture dans une autre table. Vrai s'il est nouveau.
   */
  function montrerLErreur(texte) {
    if (!erreurEl.hidden && erreurEl.textContent === texte) return false;
    erreurEl.textContent = texte;
    erreurEl.hidden = false;
    return true;
  }
  /** « Charger plus » caché (plus rien à lire, ou une lecture en échec) : le focus qu'il avait reste dans la fenêtre, sur le cadre du tableau. */
  function cacherPlus() {
    if (document.activeElement === plus) defilement.focus({ preventScroll: true });
    plus.hidden = true;
  }
  /** Le résumé et « Charger plus », d'après les lignes affichées et le total. */
  function majPied() {
    ecrireLeResume(resumeDuContenu(contenu.cles.length, contenu.total));
    if (contenu.fini) cacherPlus();
    else plus.hidden = false;
    const restantes = contenu.total - contenu.cles.length;
    if (!contenu.fini) plus.textContent = `Charger plus (${nombre(restantes)} restante${restantes > 1 ? 's' : ''})`;
  }
  // « Charger plus » n'est jamais désactivé (disabled) : Chrome retire le focus d'un bouton qui le devient. Pendant une lecture de page, il est
  // marqué occupé (aria-disabled, un clic n'y fait rien : charger() ne lance jamais deux lectures) ; pendant un rafraîchissement, il reste actif et
  // le clic est rejoué après lui (contenu.chargerApres).
  const occuperPlus = (oui) => (oui ? plus.setAttribute('aria-disabled', 'true') : plus.removeAttribute('aria-disabled'));
  /** Les lignes du tableau en bandes alternées, par identité et non par rang : une ligne insérée ou retirée ne repeint pas celles d'après. */
  const rayer = (tr) => tr.classList.toggle('est-rayee', !!tr.previousElementSibling && !tr.previousElementSibling.classList.contains('est-rayee'));

  function ouvrirContenu(nom) {
    fermerCles();
    if (!tableDe.has(nom)) return;
    Object.assign(contenu, { nom, tri: null, ordre: 'asc' });
    nomEl.textContent = nom;
    recommencer(true);
    if (!dialogue.open) dialogue.showModal();
    defilement.scrollTo(0, 0);
  }
  /**
   * Repart de la première page (autre table : en-têtes refaits ; autre tri : gardés jusqu'à la réponse). Un rafraîchissement en cours est abandonné.
   * `note` : ce que la première page dira en plus de son résumé (noteDuTriPerdu).
   */
  function recommencer(autreTable, note = null) {
    contenu.demande++;
    Object.assign(contenu, {
      total: 0, cles: [], etags: new Map(), enCours: false, fini: false, rafraichit: false, aRafraichir: false, chargerApres: false, note,
    });
    if (autreTable) {
      contenu.colonnes = [];
      entetes.innerHTML = '';
    }
    lignes.innerHTML = '';
    erreurEl.hidden = true;
    cacherPlus();
    occuperPlus(false);
    ecrireLeResume('Chargement…');
    etatBon = { genre: 'attente' };
    etatDuContenu = etatBon;
    majSuivi();
    charger();
  }
  /** Une page de lignes (alignée sur PAGE_DE_LIGNES), avec l'ETag de sa dernière réponse s'il faut seulement savoir si elle a changé (304). */
  async function lirePage(decalage, etag = null) {
    const entetesHttp = { Accept: 'application/json' };
    if (etag) entetesHttp['If-None-Match'] = etag;
    try {
      const reponse = await fetch(adresseDuContenu(api, contenu.nom, { limite: PAGE_DE_LIGNES, decalage, tri: contenu.tri, ordre: contenu.ordre }), {
        cache: 'no-store',
        headers: entetesHttp,
      });
      const corps = reponse.status === 304 ? null : await reponse.json().catch(() => null);
      return { decalage, statut: reponse.status, corps, etag: reponse.headers.get('ETag') };
    } catch {
      return { decalage, statut: 0, corps: null, etag: null };
    }
  }
  async function charger() {
    if (contenu.enCours || contenu.fini || !contenu.nom) return;
    if (contenu.rafraichit) {
      contenu.chargerApres = true; // un rafraîchissement en cours : la page suivante après lui
      return;
    }
    contenu.enCours = true;
    const demande = contenu.demande;
    const affichees = contenu.cles.length;
    const debut = debutDePage(affichees); // la page qui contient la ligne suivante (une page à moitié affichée après un rafraîchissement : relue)
    occuperPlus(true);
    const { statut, corps, etag } = await lirePage(debut);
    if (demande !== contenu.demande) return; // une autre table, un autre tri, ou la fenêtre fermée entre-temps
    contenu.enCours = false;
    occuperPlus(false);
    if (statut !== 200 || !Array.isArray(corps?.lignes) || !Array.isArray(corps?.colonnes)) {
      montrerLErreur(messageDErreur(statut, corps));
      if (!affichees) ecrireLeResume(''); // des lignes affichées : leur résumé reste juste
      // pas de nouvel essai au défilement : fermer et rouvrir, ou la version suivante de la base (la première page relue, ou le tableau rafraîchi
      // et son pied refait) ; la ligne d'état dit pourquoi
      contenu.fini = true;
      cacherPlus();
      etatDuContenu = { ...etatDeLEchec(statut), lecture: true };
      majSuivi();
      return;
    }
    // une lecture réussie : l'erreur d'une lecture d'avant (service revenu, première page enfin lue) s'efface
    erreurEl.hidden = true;
    if (!pageAccordee(contenu.cles, debut, corps.lignes)) {
      // la table a changé depuis le dernier rafraîchissement (la page relue ne redonne pas les lignes déjà affichées qu'elle contient) : son ETag
      // ne vaudrait pas pour elles — rien n'est ajouté, le tableau est rafraîchi d'abord (avec l'ETag qu'il a), puis la page suivante lue
      Object.assign(contenu, { aRafraichir: true, chargerApres: true });
      lancerLeRafraichissement();
      return;
    }
    if (affichees === 0) {
      contenu.colonnes = corps.colonnes;
      entetes.innerHTML = htmlDesEntetes(corps.colonnes, contenu);
      if (contenu.focusApres) {
        const boutons = [...entetes.querySelectorAll('[data-tri-colonne]')];
        (boutons.find((b) => b.dataset.triColonne === contenu.focusApres) ?? boutons[0])?.focus();
        contenu.focusApres = null;
      }
    }
    contenu.etags.set(debut, etag);
    const neuves = corps.lignes.slice(affichees - debut);
    const avant = lignes.children.length;
    lignes.insertAdjacentHTML('beforeend', htmlDesLignes(contenu.colonnes, neuves));
    for (let i = avant; i < lignes.children.length; i++) rayer(lignes.children[i]);
    contenu.cles.push(...neuves.map(cleDeLigne));
    marquerLesCoupees();
    contenu.total = Number(corps.total) || 0;
    contenu.fini = neuves.length === 0 || contenu.cles.length >= contenu.total;
    majPied();
    // la note d'un rechargement (colonne de tri disparue) : dite AVEC le résumé (une seconde annonce effacerait la première) et écrite dans la ligne
    // d'état ; sinon la première lecture de la table pose « à jour ». L'échec d'une lecture de page d'avant s'efface (la première page, ou celle-ci,
    // enfin lue) ; celui d'un rafraîchissement reste (le tableau n'a pas été relu : il le sera à la relève suivante qui réussit)
    const note = contenu.note;
    contenu.note = null;
    annoncer(note ? `${note.annonce} ${resume.textContent}` : resume.textContent);
    if (note) etatBon = { genre: 'mis-a-jour', heure: heureCourte(new Date()), resume: note.resume };
    else if (etatBon.genre === 'attente') etatBon = { genre: 'a-jour', heure: heureCourte(new Date()) };
    if (affichees === 0 || etatDuContenu.lecture) {
      etatDuContenu = etatBon;
      majSuivi();
    }
    suiteSiVisible();
    lancerLeRafraichissement(); // une version nouvelle vue pendant le chargement : le rafraîchissement part maintenant
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

  // ---- suivi en direct : le contenu affiché suit la table (une version nouvelle de la base : 4) ----------------------------------------------
  /** Une version nouvelle de la base : le contenu affiché est à relire, aussitôt ou à la fin du chargement ou du rafraîchissement en cours. */
  function demanderLeRafraichissement() {
    if (!dialogue.open || !contenu.nom) return;
    contenu.aRafraichir = true; // plusieurs demandes pendant un rafraîchissement : un seul de plus ensuite
    lancerLeRafraichissement();
  }
  function lancerLeRafraichissement() {
    if (!contenu.aRafraichir || contenu.rafraichit || contenu.enCours || !dialogue.open || !contenu.nom) return;
    contenu.aRafraichir = false;
    // rien n'a encore été lu (la première page a échoué : service absent, base pas prête, table introuvable) : elle est redemandée sans rien
    // effacer ni écrire « Chargement… » — tant que la réponse ne change pas, ni le résumé ni le message d'erreur ne bougent (montrerLErreur)
    if (!contenu.etags.size) {
      contenu.fini = false;
      charger();
    } else rafraichir();
  }
  /**
   * Chaque page déjà chargée, redemandée avec son ETag (304 : inchangée) ; le tableau passe à l'état reçu (appliquer). « Charger plus » reste actif
   * (son focus aussi) : un clic pendant le rafraîchissement est rejoué après lui (charger : contenu.chargerApres).
   */
  async function rafraichir() {
    contenu.rafraichit = true;
    const demande = contenu.demande;
    const avant = { cles: contenu.cles, total: contenu.total, colonnes: contenu.colonnes };
    const reponses = await Promise.all(pagesARedemander(avant.cles.length).map((d) => lirePage(d, contenu.etags.get(d))));
    if (demande !== contenu.demande) return; // une autre table, un autre tri, ou la fenêtre fermée : abandonné (leur état est déjà repris)
    contenu.rafraichit = false;
    const suite = assemblerLesPages(avant, reponses);
    if (suite.erreur) {
      if (traiterLEchec(suite.erreur)) return; // rechargé dans l'ordre par défaut
    } else if (suite.inchange) {
      // rien n'a changé ; un « Charger plus » en échec avait arrêté la fenêtre (fini, bouton caché) : elle repart d'où elle était
      erreurEl.hidden = true;
      contenu.fini = contenu.cles.length >= contenu.total;
      majPied();
      etatDuContenu = etatBon;
      majSuivi();
    } else {
      erreurEl.hidden = true;
      appliquer(suite, avant);
    }
    if (contenu.chargerApres) {
      contenu.chargerApres = false;
      charger();
    }
    lancerLeRafraichissement();
  }
  /** Un rafraîchissement en échec. Vrai si le contenu est rechargé (colonne de tri disparue) ; sinon le tableau reste tel qu'il était. */
  function traiterLEchec({ genre, statut, corps }) {
    if (genre === 'tri' && contenu.tri) {
      const colonne = contenu.tri;
      const focusAuxEntetes = entetes.contains(document.activeElement);
      Object.assign(contenu, { tri: null, ordre: 'asc', focusApres: focusAuxEntetes ? colonne : null });
      defilement.scrollTo({ top: 0 });
      // dit avec le résumé de la première page relue, et dans la ligne d'état (une annonce à part serait effacée par celle du rechargement)
      recommencer(false, noteDuTriPerdu(colonne));
      return true;
    }
    etatDuContenu = etatDeLEchec(statut);
    if (genre === 'panne') {
      // service injoignable : le contenu reste ; nouvel essai à la relève suivante qui réussit
      suivi.enRetard = true;
    } else {
      // le même échec qu'à la relève d'avant (une table toujours introuvable, et une écriture dans une autre) : ni réécrit ni annoncé de nouveau
      const introuvable = genre === 'introuvable';
      const nouveau = montrerLErreur(introuvable ? `${messageDErreur(404, corps)} Le tableau montre sa dernière lecture.` : messageDErreur(statut, corps));
      if (introuvable && nouveau) annoncer(`La table ${contenu.nom} n’existe plus dans la base vivante.`);
    }
    majSuivi();
    return false;
  }
  /**
   * Le tableau passe à l'état reçu (lib/debug-schema.mjs#assemblerLesPages) : seules les lignes dont le JSON n'était pas affiché sont refaites, et
   * mises en évidence MISE_EN_EVIDENCE_MS ; les autres <tr> restent (cellules dépliées comprises), déplacées s'il le faut (planDeMiseAJour : le
   * moins possible). La première ligne visible reste à sa place à l'écran (sauf tout en haut : une ligne nouvelle en tête s'y voit) ; le focus reste
   * où il était, ou sur la case de même place si sa ligne est refaite ; les en-têtes ne sont refaits que si les colonnes changent.
   */
  function appliquer(suite, avant) {
    const anciennes = [...lignes.children];
    const memesNoms = suite.colonnes.map((c) => c.nom).join('\n') === avant.colonnes.map((c) => c.nom).join('\n');
    const colonnesChangees = JSON.stringify(suite.colonnes) !== JSON.stringify(avant.colonnes);
    // d'autres colonnes (noms, ordre) : chaque ligne se rend autrement, toutes sont refaites
    const plan = planDeMiseAJour(memesNoms ? avant.cles : [], suite.cles);
    const retirees = memesNoms ? plan.retirees : anciennes.map((_, i) => i);

    // avant d'écrire : le focus, et la ligne qui tient la place de la vue (mesures groupées)
    const focus = dialogue.contains(document.activeElement) ? document.activeElement : null;
    const trDuFocus = focus && lignes.contains(focus) ? focus.closest('tr') : null;
    const caseDuFocus = trDuFocus ? { ligne: anciennes.indexOf(trDuFocus), colonne: [...trDuFocus.children].indexOf(focus.closest('td')) } : null;
    const ancre = memesNoms ? ancreDuDefilement(anciennes, new Set([...plan.immobiles].map((j) => plan.source[j]))) : null;

    if (colonnesChangees) {
      const tri = focus && entetes.contains(focus) ? focus.closest('[data-tri-colonne]')?.dataset.triColonne ?? null : null;
      contenu.colonnes = suite.colonnes;
      entetes.innerHTML = htmlDesEntetes(suite.colonnes, contenu);
      if (tri) {
        const boutons = [...entetes.querySelectorAll('[data-tri-colonne]')];
        (boutons.find((b) => b.dataset.triColonne === tri) ?? boutons[0])?.focus({ preventScroll: true });
      }
    }
    // les lignes à refaire, rendues d'un coup (rendus échappés de lib/debug-schema.mjs) ; une ligne d'une page inchangée (304) se relit de son JSON
    const tampon = document.createElement('tbody');
    tampon.innerHTML = htmlDesLignes(suite.colonnes, plan.nouvelles.map((j) => suite.lignes[j] ?? JSON.parse(suite.cles[j])));
    const neuves = [...tampon.children];
    const elements = plan.source.map((s) => (s >= 0 ? anciennes[s] : null));
    plan.nouvelles.forEach((j, k) => { elements[j] = neuves[k]; });
    for (const i of retirees) anciennes[i].remove();
    // de la fin vers le début : chaque ligne nouvelle ou déplacée se pose avant la suivante ; les immobiles ne bougent pas
    let suivante = null;
    for (let j = elements.length - 1; j >= 0; j--) {
      if (!plan.immobiles.has(j)) lignes.insertBefore(elements[j], suivante);
      suivante = elements[j];
    }
    elements.forEach((tr, j) => { if (!plan.immobiles.has(j)) rayer(tr); });
    marquerLesCoupees();
    if (ancre?.el.isConnected) defilement.scrollTop = ancre.el.offsetTop - ancre.ecart;
    if (neuves.length) {
      for (const tr of neuves) tr.classList.add('est-nouvelle');
      setTimeout(() => neuves.forEach((tr) => tr.classList.remove('est-nouvelle')), MISE_EN_EVIDENCE_MS);
    }
    // le focus : là où il était (une ligne déplacée le perd), sinon la case de même place, sinon le cadre du tableau
    if (focus && document.activeElement !== focus) {
      if (focus.isConnected) focus.focus({ preventScroll: true });
      else if (caseDuFocus) {
        const td = lignes.children[Math.min(caseDuFocus.ligne, lignes.children.length - 1)]?.children[caseDuFocus.colonne];
        (td && td.tabIndex >= 0 ? td : defilement).focus({ preventScroll: true });
      }
    }

    contenu.cles = suite.cles;
    contenu.total = suite.total;
    for (const [d, etag] of Object.entries(suite.etags)) contenu.etags.set(Number(d), etag);
    for (const d of [...contenu.etags.keys()]) if (d > 0 && d >= contenu.cles.length) contenu.etags.delete(d);
    contenu.fini = contenu.cles.length >= contenu.total;
    majPied();
    const changements = resumeDesChangements({
      nouvelles: plan.nouvelles.length, retirees: retirees.length, totalAvant: avant.total, totalApres: suite.total, colonnesChangees,
    });
    if (changements) {
      etatBon = { genre: 'mis-a-jour', heure: heureCourte(new Date()), resume: changements };
      annoncer(annonceDuChangement(contenu.nom, changements));
    }
    etatDuContenu = etatBon;
    majSuivi();
  }
  /**
   * La ligne qui tient la place de la vue : la première visible (sous les en-têtes collants) qui reste où elle est, et son écart au haut du cadre ;
   * aucune tout en haut du tableau. `gardees` : les indices des anciennes lignes immobiles.
   */
  function ancreDuDefilement(anciennes, gardees) {
    const haut = defilement.scrollTop;
    if (haut <= 1) return null;
    const limite = haut + entetes.offsetHeight;
    let bas = 0;
    let fin = anciennes.length;
    while (bas < fin) {
      const milieu = (bas + fin) >> 1;
      if (anciennes[milieu].offsetTop + anciennes[milieu].offsetHeight <= limite) bas = milieu + 1;
      else fin = milieu;
    }
    for (let i = bas; i < anciennes.length && anciennes[i].offsetTop < haut + defilement.clientHeight; i++) {
      if (gardees.has(i)) return { el: anciennes[i], ecart: anciennes[i].offsetTop - haut };
    }
    return null;
  }

  // la fin du tableau approche : la page suivante, après avoir revu la mesure (suiteSiVisible) — une notification peut dater du tableau vidé par un
  // autre tri et arriver après sa première page : elle ne doit pas en charger une seconde
  new IntersectionObserver((entrees) => {
    if (entrees.some((e) => e.isIntersecting)) suiteSiVisible();
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
    contenu.demande++; // une réponse encore en route (chargement, rafraîchissement) n'écrit plus rien
    Object.assign(contenu, { enCours: false, fini: true, rafraichit: false, aRafraichir: false, chargerApres: false });
    elTable.get(contenu.nom)?.focus({ preventScroll: true });
  });

  // ---- relève de la version de la base : menu ouvert ET page visible, toutes les 2 s (lib/debug-schema.mjs#suiteDeLaReleve) ----------------------
  const releveActive = () => cadre.open && document.visibilityState === 'visible' && !suivi.arret;
  /** La relève suivante dans `delai` ms (setTimeout enchaîné : jamais deux à la fois) ; rien si le menu est fermé, la page cachée ou le suivi arrêté. */
  function planifier(delai) {
    clearTimeout(suivi.minuterie);
    suivi.minuterie = releveActive() ? setTimeout(relever, delai) : 0;
  }
  async function relever() {
    clearTimeout(suivi.minuterie);
    suivi.minuterie = 0;
    if (suivi.enCours || !releveActive()) return;
    suivi.enCours = true;
    let statut = 0;
    let corps = null;
    try {
      const reponse = await fetch(adresseDeLaVersion(api), { cache: 'no-store', headers: { Accept: 'application/json' } });
      statut = reponse.status;
      corps = await reponse.json().catch(() => null);
    } catch {
      statut = 0;
    }
    suivi.enCours = false;
    const suite = suiteDeLaReleve(statut, corps);
    if (suite.action === 'arret') {
      // hors du site de dev : plus de relève (les nombres de lignes restent ceux du build, ou d'une lecture)
      suivi.arret = `le service refuse (403)${typeof corps?.erreur === 'string' && corps.erreur.trim() ? ` : ${corps.erreur.trim()}` : ''}`;
      if (!comptes.lus && cadre.open && document.visibilityState === 'visible') relireLesComptes();
      majSuivi();
      return;
    }
    // le menu refermé (ou la page cachée) pendant la relève : rien n'est relu ni rafraîchi, et la référence ne change pas — une version nouvelle
    // sera vue à la réouverture du menu ou au retour de la page au premier plan (relever, aussitôt)
    if (!releveActive()) return;
    if (suite.action === 'panne') {
      if (suivi.panne === null && dialogue.open) annoncer(`${libelleDuSuivi({ genre: 'interrompu', statut: suite.statut, delai: suite.delai })}.`);
      suivi.panne = suite.statut;
      if (!comptes.lus) relireLesComptes();
    } else {
      if (suivi.panne !== null && dialogue.open) annoncer('Suivi en direct rétabli.');
      suivi.panne = null;
      // la première version sert de référence (les nombres de lignes, lus après elle) ; une autre ensuite : tout ce qui est affiché est relu
      const nouvelle = suite.version !== suivi.reference;
      suivi.reference = suite.version;
      if (nouvelle || suivi.enRetard || !comptes.lus) {
        suivi.enRetard = false;
        relireLesComptes();
        demanderLeRafraichissement();
      }
    }
    majSuivi();
    planifier(suite.delai);
  }
  // aussitôt à l'ouverture du menu et au retour de la page au premier plan ; rien quand il est fermé ou la page cachée
  cadre.addEventListener('toggle', () => (cadre.open ? relever() : planifier(0)));
  document.addEventListener('visibilitychange', () => (releveActive() ? relever() : planifier(0)));
  relever();
}
