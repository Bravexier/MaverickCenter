// Page Debug (pages/debug.astro ; site de dev seulement, demande du propriétaire) : quatre menus déroulants FERMÉS par défaut, dans l'ordre
// Système, Performances, Journaux du serveur, DB (demande du propriétaire du 2026-10-15) ; ce script mène les trois premiers (DB, le schéma de
// la base : scripts/debug-schema.mjs).
//   1. GET <base>api/etat/ : sans `edition: true`, ce service n'est pas celui du site de dev — la page le dit et s'arrête (les menus restent cachés).
//   2. Un menu fermé ne demande RIEN au service (demande du 2026-10-15) : chacun charge ses données à son ouverture, aussitôt, puis les relève tant
//      qu'il reste ouvert — une minuterie par menu, posée à l'ouverture et arrêtée à la fermeture (lib/debug-metriques.mjs#suivreLOuverture) ;
//      rien non plus quand l'onglet est caché.
//   3. « Système » : GET <base>api/debug/systeme/ toutes les 30 s (RELEVE_METRIQUES_MS) : processus, disque, volume, échantillons, fichiers,
//      évènements, alertes, et la jauge « Espace disque du serveur » (disque.repartition, de la même réponse) ; survoler un type de la légende ou
//      un segment met les deux en évidence (data-actif : un segment très fin se repère).
//   4. « Performances » : GET <base>api/debug/metriques/ (instance, période, tri) et …/metriques/requetes/ toutes les 30 s ; une instance (dev OU
//      production : deux jeux de données séparés) pour Système et Performances, choisie dans l'un ou l'autre (les deux listes se suivent) ; le
//      tableau des routes se trie dans la page (en-têtes, aria-sort) ; rendu pur : lib/debug-metriques.mjs ; les liens « Exporter » suivent
//      l'instance et la période.
//   5. « Journaux du serveur » : GET <base>api/debug/journal/ toutes les 2 s, les entrées qui suivent la dernière vue (?depuis=), filtrées dans la
//      page (lib/debug-journaux.mjs) ; refermé puis rouvert, le menu reprend où il en était (les entrées arrivées entre-temps) ; les nouvelles lignes
//      s'ajoutent en haut sans refaire les autres (planDAffichage), la ligne lue reste à sa place et une sélection dans le tableau diffère
//      l'affichage ; un autre processus du service (redémarrage) fait tout relire ; Pause (bouton bascule, aria-pressed), Effacer l'affichage ;
//      colonne Durée triable (Heure / Durée) ; « Plus lent que … ms » part au service (?min_ms=) et fait tout relire.
// Script de page : il n'importe que lib/debug-journaux.mjs et lib/debug-metriques.mjs, qu'aucun autre script de page n'importe (la version portable
// refuse un module partagé ; test/debug-page.test.mjs). Aucune infobulle native (pas de `title`).
import {
  RELEVE_MS, TRI_DU_JOURNAL_PAR_DEFAUT, adresseDuJournal, categoriesDes, etatVide, filtrerEntrees, fusionner, htmlDesLignes, planDAffichage,
  resumeDuJournal,
} from '../lib/debug-journaux.mjs';
import {
  INSTANCES, PERIODE_PAR_DEFAUT, RELEVE_METRIQUES_MS, REQUETES_AUTRE_INSTANCE, REQUETES_LIMITE, TRI_PAR_DEFAUT, adresseDeLExport, adresseDesMetriques,
  adresseDesRequetes, adresseDuSysteme, ariaSort, courbeDeLaSerie, courbeDuSysteme, echapper, htmlDeLEspaceDisque, htmlDesAlertes, htmlDesChiffres,
  htmlDesEvenements, htmlDesFichiers, htmlDesNavigateurs, htmlDesOrigines, htmlDesPages, htmlDesRequetes, htmlDesRoutes, htmlDuDisque,
  htmlDuProcessus, htmlDuVolume, noteDeFenetreHoraire, optionsDesRoutes, plusLentes, requetesDeLInstance, resumeDesMetriques, resumeDuSysteme,
  seuilSaisi, sensParDefaut, suivreLOuverture, trierRoutes,
} from '../lib/debug-metriques.mjs';

const racine = document.querySelector('[data-debug]');

/** Une requête de lecture au service (JSON, jamais du cache). */
const lire = (adresse) => fetch(adresse, { headers: { Accept: 'application/json' }, cache: 'no-store', credentials: 'same-origin' });

if (racine) demarrer();

async function demarrer() {
  const api = racine.dataset.api; // « <base>api/ »
  const etatDuService = racine.querySelector('[data-debug-etat]');
  const dire = (texte, erreur = false) => {
    etatDuService.textContent = texte;
    etatDuService.classList.toggle('debug-etat--erreur', erreur);
  };
  let etat = null;
  try {
    const r = await lire(`${api}etat/`);
    etat = await r.json().catch(() => null);
    if (!r.ok || !etat) throw new Error(`il a répondu ${r.status}`);
  } catch (e) {
    dire(`Le service ne répond pas (${e.message}) : ni le système, ni les performances, ni les journaux ne sont disponibles.`, true);
    return;
  }
  if (etat.edition !== true) {
    dire('Ce service n’est pas celui du site de dev (l’édition des règles y est fermée) : la page Debug ne s’en sert pas.', true);
    return;
  }
  const demarre = etat.demarre_le ? new Date(etat.demarre_le) : null;
  dire(`Service du site de dev, version ${etat.version ?? 'inconnue'}${demarre && !Number.isNaN(demarre.getTime())
    ? `, démarré le ${demarre.toLocaleString('fr-FR')}` : ''}${etat.base?.disponible === false ? ' ; base vivante indisponible' : ''}.`);
  brancherLesMetriques(api);
  brancherLesJournaux(api);
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Système et performances

function brancherLesMetriques(api) {
  const perfs = racine.querySelector('[data-debug-perfs]');
  const systeme = racine.querySelector('[data-debug-systeme]');
  const champ = (bloc, nom) => bloc.querySelector(`[data-${nom}]`);
  /** Le choix de l'instance, en tête de Système et de Performances : les deux listes se suivent (une seule instance pour les deux menus). */
  const instances = [champ(systeme, 'systeme-instance'), champ(perfs, 'perfs-instance')];
  const periode = champ(perfs, 'perfs-periode');
  const triChoisi = champ(perfs, 'perfs-tri');
  const annonce = champ(perfs, 'perfs-annonce');
  const routesCorps = champ(perfs, 'perfs-routes');
  const requetesMin = champ(perfs, 'requetes-min');
  const requetesRoute = champ(perfs, 'requetes-route');
  const requetesAnnonce = champ(perfs, 'requetes-annonce');
  const requetesContenu = champ(perfs, 'requetes-contenu');
  const requetesAutre = champ(perfs, 'requetes-autre');
  const fenetre = champ(perfs, 'perfs-fenetre');
  const systemeAnnonce = champ(systeme, 'systeme-annonce');
  /** La jauge « Espace disque du serveur », dans Système (demande du 2026-10-15 : « Inclus-la directement dans Système »). */
  const espaceJauge = champ(systeme, 'espace-jauge');
  /** Le tri du tableau des routes (dans la page) ; la clé part aussi au service quand il la connaît. */
  let tri = { cle: TRI_PAR_DEFAUT, sens: sensParDefaut(TRI_PAR_DEFAUT) };
  let routes = [];
  /** L'instance du serveur qui répond (la première de `instances`, celle des requêtes une à une) : le site de dev. */
  let instanceDuServeur = INSTANCES[0].cle;
  /** Un numéro par demande : une réponse arrivée après un changement d'instance ou de période est ignorée. */
  const demandes = { metriques: 0, requetes: 0, systeme: 0 };
  const fermes = { metriques: false, requetes: false, systeme: false }; // 403 : ce service n'est pas celui du site de dev
  const dernieres = { metriques: 0, systeme: 0 };
  systeme.hidden = false;
  perfs.hidden = false;

  const choix = () => ({ instance: instances[0].value || INSTANCES[0].cle, periode: periode.value || PERIODE_PAR_DEFAUT });
  const dire = (place, texte, erreur = false) => {
    place.textContent = texte;
    place.classList.toggle('debug-annonce--erreur', erreur);
  };
  /** Un tableau et sa phrase « vide » : le HTML des lignes (rien : la phrase se montre). */
  const remplir = (nom, html) => {
    const corps = racine.querySelector(`[data-${nom}]`);
    corps.innerHTML = html;
    const vide = racine.querySelector(`[data-${nom}-vide]`);
    if (vide) vide.hidden = Boolean(html);
  };

  /** Lit une adresse : { statut, corps } (corps : le JSON, ou null) ; une panne réseau lève. */
  async function lireJson(adresse) {
    const r = await lire(adresse);
    return { statut: r.status, corps: await r.json().catch(() => null) };
  }

  function majDesExports() {
    const { instance: i, periode: p } = choix();
    for (const lien of perfs.querySelectorAll('[data-perfs-export]')) lien.href = adresseDeLExport(api, { instance: i, periode: p, format: lien.dataset.perfsExport });
  }

  /**
   * Les options d'instance (des deux listes) : celles dont le fichier existe (réponse `instances`) ; les autres restent choisissables mais disent
   * qu'elles sont vides.
   */
  function majDesInstances(presentes) {
    if (!Array.isArray(presentes)) return;
    for (const liste of instances) {
      for (const option of liste.options) {
        const connue = INSTANCES.find((i) => i.cle === option.value);
        option.textContent = `${connue?.libelle ?? option.value}${presentes.includes(option.value) ? '' : ' (aucune donnée)'}`;
      }
    }
  }

  function afficherLesRoutes() {
    const triees = trierRoutes(routes, tri);
    routesCorps.innerHTML = htmlDesRoutes(triees, { lentes: plusLentes(routes) });
    racine.querySelector('[data-perfs-routes-vide]').hidden = triees.length > 0;
    for (const bouton of perfs.querySelectorAll('[data-tri-colonne]')) {
      bouton.closest('th').setAttribute('aria-sort', ariaSort(tri, bouton.dataset.triColonne));
    }
  }

  function viderLesMetriques() {
    routes = [];
    afficherLesRoutes();
    champ(perfs, 'perfs-global').innerHTML = '';
    champ(perfs, 'perfs-serie').innerHTML = '';
    champ(perfs, 'perfs-resume').textContent = '';
    fenetre.textContent = '';
    fenetre.hidden = true;
    for (const nom of ['perfs-pages', 'perfs-navigateurs', 'perfs-origines']) remplir(nom, '');
  }

  async function chargerLesMetriques() {
    if (fermes.metriques || !perfs.open) return; // un menu fermé ne demande rien
    const numero = ++demandes.metriques;
    const { instance: i, periode: p } = choix();
    let reponse;
    try {
      reponse = await lireJson(adresseDesMetriques(api, { instance: i, periode: p, tri: tri.cle }));
    } catch (e) {
      if (numero === demandes.metriques) dire(annonce, `Métriques injoignables (${e.message}) : nouvel essai dans ${RELEVE_METRIQUES_MS / 1000} s.`, true);
      return;
    }
    if (numero !== demandes.metriques) return;
    dernieres.metriques = Date.now();
    const { statut, corps } = reponse;
    if (statut === 403) {
      fermes.metriques = true;
      dire(annonce, corps?.erreur ?? 'Le service refuse ses métriques : il n’est pas celui du site de dev.', true);
      return;
    }
    if (statut === 404) {
      viderLesMetriques();
      majDesInstances(corps?.instances);
      dire(annonce, corps?.erreur ?? `Aucune métrique enregistrée pour « ${instances[0].selectedOptions[0]?.textContent ?? i} » pour l’instant.`);
      return;
    }
    if (statut !== 200 || !corps || typeof corps !== 'object') {
      dire(annonce, `Métriques illisibles (${corps?.erreur ?? `le service a répondu ${statut}`}).`, true);
      return;
    }
    dire(annonce, '');
    majDesInstances(corps.instances);
    if (Array.isArray(corps.instances) && corps.instances[0]) instanceDuServeur = corps.instances[0];
    routes = Array.isArray(corps.routes) ? corps.routes : [];
    afficherLesRoutes();
    champ(perfs, 'perfs-resume').textContent = resumeDesMetriques(corps);
    champ(perfs, 'perfs-global').innerHTML = htmlDesChiffres(corps.global, corps.releves);
    champ(perfs, 'perfs-serie').innerHTML = courbeDeLaSerie(corps.serie);
    // pages vues, navigateurs et origines : par heure, une fenêtre parfois plus large que celle des routes (période « 1h »)
    fenetre.textContent = noteDeFenetreHoraire(corps);
    fenetre.hidden = !fenetre.textContent;
    remplir('perfs-pages', htmlDesPages(corps.pages));
    remplir('perfs-navigateurs', htmlDesNavigateurs(corps.navigateurs));
    remplir('perfs-origines', htmlDesOrigines(corps.origines));
    // la liste « Route » des requêtes une à une : les routes du serveur qui les garde (le site de dev), jamais celles d'une autre instance
    if (requetesDeLInstance(i, instanceDuServeur)) requetesRoute.innerHTML = optionsDesRoutes(routes, requetesRoute.value);
  }

  /** Les requêtes une à une ne sont que celles du serveur qui répond : pour une autre instance, une phrase à la place (requetesDeLInstance). */
  function montrerLesRequetes() {
    const visibles = requetesDeLInstance(choix().instance, instanceDuServeur);
    requetesContenu.hidden = !visibles;
    requetesAutre.hidden = visibles;
    requetesAutre.textContent = visibles ? '' : REQUETES_AUTRE_INSTANCE;
    return visibles;
  }

  async function chargerLesRequetes() {
    if (fermes.requetes || !perfs.open) return;
    const numero = ++demandes.requetes;
    if (!montrerLesRequetes()) {
      dire(requetesAnnonce, '');
      return;
    }
    let reponse;
    try {
      reponse = await lireJson(adresseDesRequetes(api, { limite: REQUETES_LIMITE, route: requetesRoute.value, minMs: seuilSaisi(requetesMin.value) }));
    } catch (e) {
      if (numero === demandes.requetes) dire(requetesAnnonce, `Requêtes récentes injoignables (${e.message}).`, true);
      return;
    }
    if (numero !== demandes.requetes || !montrerLesRequetes()) return;
    const { statut, corps } = reponse;
    if (statut === 403) {
      fermes.requetes = true;
      dire(requetesAnnonce, corps?.erreur ?? 'Le service refuse ses requêtes récentes.', true);
      return;
    }
    if (statut !== 200 || !Array.isArray(corps?.requetes)) {
      dire(requetesAnnonce, `Requêtes récentes illisibles (${corps?.erreur ?? `le service a répondu ${statut}`}).`, true);
      return;
    }
    dire(requetesAnnonce, '');
    // les détails ouverts restent ouverts d'une relève à l'autre (repérés par instant, méthode et adresse)
    const liste = champ(perfs, 'requetes-liste');
    const ouverts = new Set([...liste.querySelectorAll('details[open]')].map((d) => d.closest('li').dataset.cle));
    liste.innerHTML = htmlDesRequetes(corps.requetes);
    for (const li of liste.children) {
      const resume = li.querySelector('summary');
      li.dataset.cle = resume ? resume.textContent : '';
      if (ouverts.has(li.dataset.cle)) li.querySelector('details').open = true;
    }
    champ(perfs, 'requetes-vide').hidden = corps.requetes.length > 0;
  }

  async function chargerLeSysteme() {
    if (fermes.systeme || !systeme.open) return;
    const numero = ++demandes.systeme;
    const { instance: i } = choix();
    let reponse;
    try {
      reponse = await lireJson(adresseDuSysteme(api, i));
    } catch (e) {
      if (numero === demandes.systeme) dire(systemeAnnonce, `Système injoignable (${e.message}) : nouvel essai dans ${RELEVE_METRIQUES_MS / 1000} s.`, true);
      return;
    }
    if (numero !== demandes.systeme) return;
    dernieres.systeme = Date.now();
    const { statut, corps } = reponse;
    if (statut === 403) {
      fermes.systeme = true;
      dire(systemeAnnonce, corps?.erreur ?? 'Le service refuse son état système : il n’est pas celui du site de dev.', true);
      return;
    }
    const vider = () => {
      for (const nom of ['systeme-alertes', 'systeme-processus', 'systeme-disque', 'systeme-volume', 'systeme-echantillons']) champ(systeme, nom).innerHTML = '';
      champ(systeme, 'systeme-fichiers').innerHTML = '';
      remplir('systeme-evenements', '');
      champ(systeme, 'systeme-resume').textContent = '';
      espaceJauge.innerHTML = '';
    };
    if (statut === 404) {
      vider();
      dire(systemeAnnonce, corps?.erreur ?? 'Aucun état système enregistré pour cette instance pour l’instant.');
      return;
    }
    if (statut !== 200 || !corps || typeof corps !== 'object') {
      dire(systemeAnnonce, `État système illisible (${corps?.erreur ?? `le service a répondu ${statut}`}).`, true);
      return;
    }
    dire(systemeAnnonce, '');
    const maintenant = new Date();
    champ(systeme, 'systeme-resume').textContent = resumeDuSysteme(corps);
    champ(systeme, 'systeme-alertes').innerHTML = htmlDesAlertes(corps.alertes);
    champ(systeme, 'systeme-processus').innerHTML = htmlDuProcessus(corps.processus, maintenant);
    champ(systeme, 'systeme-disque').innerHTML = htmlDuDisque(corps.disque);
    champ(systeme, 'systeme-volume').innerHTML = htmlDuVolume(corps.volume);
    champ(systeme, 'systeme-echantillons').innerHTML = courbeDuSysteme(corps.echantillons);
    champ(systeme, 'systeme-fichiers').innerHTML = htmlDesFichiers(corps.fichiers);
    remplir('systeme-evenements', htmlDesEvenements(corps.evenements, maintenant));
    const actif = espaceJauge.querySelector('[data-actif]')?.dataset.cle;
    espaceJauge.innerHTML = htmlDeLEspaceDisque(corps.disque, { instance: corps.instance ?? i, maintenant });
    if (actif) mettreEnEvidence(actif);
  }

  /** Un type de données mis en évidence (survol d'un segment ou d'un type de la légende) : son segment et son type portent data-actif. */
  function mettreEnEvidence(cle) {
    let trouve = false;
    for (const el of espaceJauge.querySelectorAll('[data-cle]')) {
      const actif = Boolean(cle) && el.dataset.cle === cle;
      el.toggleAttribute('data-actif', actif);
      trouve ||= actif;
    }
    // un type absent (autre instance, jauge refaite) n'efface pas toute la barre
    espaceJauge.classList.toggle('debug-espace--survol', trouve);
  }
  espaceJauge.addEventListener('pointerover', (ev) => mettreEnEvidence(ev.target.closest?.('[data-cle]')?.dataset.cle ?? ''));
  espaceJauge.addEventListener('pointerleave', () => mettreEnEvidence(''));

  /** Vrai si la dernière relève date d'au moins 30 s (à une seconde près). */
  const age = (t) => Date.now() - t >= RELEVE_METRIQUES_MS - 1000;
  /** Une relève de Performances : ouvert seulement, onglet visible ; `force` : même relevé il y a moins de 30 s (ouverture, choix, bouton). */
  function releverLesPerfs(force = false) {
    if (document.hidden || !perfs.open) return;
    if (force || age(dernieres.metriques)) {
      chargerLesMetriques();
      chargerLesRequetes();
    }
  }
  /** Une relève de Système (et de la jauge de l'espace disque, de la même réponse) : ouvert seulement, onglet visible. */
  function releverLeSysteme(force = false) {
    if (document.hidden || !systeme.open) return;
    if (force || age(dernieres.systeme)) chargerLeSysteme();
  }
  /** Les deux menus (chacun seulement s'il est ouvert) : changement d'instance, bouton « Actualiser », onglet de nouveau visible. */
  const relever = (force = false) => {
    releverLeSysteme(force);
    releverLesPerfs(force);
  };

  for (const liste of instances) {
    liste.addEventListener('change', () => {
      for (const autre of instances) if (autre !== liste) autre.value = liste.value;
      majDesExports();
      relever(true);
    });
  }
  periode.addEventListener('change', () => {
    majDesExports();
    chargerLesMetriques();
  });
  triChoisi.addEventListener('change', () => {
    tri = { cle: triChoisi.value, sens: sensParDefaut(triChoisi.value) };
    afficherLesRoutes();
  });
  perfs.querySelector('[data-perfs-actualiser]').addEventListener('click', () => relever(true));
  perfs.querySelector('thead').addEventListener('click', (ev) => {
    const bouton = ev.target.closest('[data-tri-colonne]');
    if (!bouton) return;
    const cle = bouton.dataset.triColonne;
    tri = tri.cle === cle ? { cle, sens: tri.sens === 'asc' ? 'desc' : 'asc' } : { cle, sens: sensParDefaut(cle) };
    triChoisi.value = cle;
    afficherLesRoutes();
  });
  let attente = 0;
  requetesMin.addEventListener('input', () => {
    clearTimeout(attente);
    attente = setTimeout(chargerLesRequetes, 400);
  });
  requetesRoute.addEventListener('change', chargerLesRequetes);
  for (const f of [...systeme.querySelectorAll('form'), ...perfs.querySelectorAll('form')]) f.addEventListener('submit', (ev) => ev.preventDefault());
  // chaque menu : rien tant qu'il est fermé ; à son ouverture, aussitôt, puis toutes les 30 s tant qu'il reste ouvert
  suivreLOuverture(systeme, RELEVE_METRIQUES_MS, releverLeSysteme);
  suivreLOuverture(perfs, RELEVE_METRIQUES_MS, releverLesPerfs);
  document.addEventListener('visibilitychange', () => relever());
  majDesExports();
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Journaux du serveur

function brancherLesJournaux(api) {
  /** Le menu « Journaux du serveur » (un <details>, fermé par défaut : rien n'est demandé tant qu'il l'est). */
  const section = racine.querySelector('[data-debug-journaux]');
  const formulaire = section.querySelector('[data-journaux-filtres]');
  const categorie = section.querySelector('[data-journaux-categorie]');
  const texte = section.querySelector('[data-journaux-texte]');
  const pause = section.querySelector('[data-journaux-pause]');
  const effacer = section.querySelector('[data-journaux-effacer]');
  const annonce = section.querySelector('[data-journaux-annonce]');
  const resume = section.querySelector('[data-journaux-resume]');
  const lignes = section.querySelector('[data-journaux-lignes]');
  const vide = section.querySelector('[data-journaux-vide]');
  const cadre = section.querySelector('.debug-journaux__cadre');
  const minMs = section.querySelector('[data-journaux-min-ms]');
  let etat = etatVide();
  /** Le seuil de durée qui a servi à la relève en cours (?min_ms=) : un autre fait tout relire. */
  let seuil = 0;
  let tri = { ...TRI_DU_JOURNAL_PAR_DEFAUT };
  let enPause = false;
  let enCours = false;
  let arret = false;
  let listeDesCategories = '';
  let affichageDiffere = false; // des entrées sont arrivées pendant une sélection dans le tableau
  section.hidden = false;

  const niveaux = () => [...formulaire.querySelectorAll('input[name="niveau"]:checked')].map((c) => c.value);

  function afficher() {
    const choisie = categorie.value;
    const categories = categoriesDes(etat.entrees, choisie);
    if (categories.join('\n') !== listeDesCategories) {
      listeDesCategories = categories.join('\n');
      categorie.innerHTML = `<option value=""${choisie ? '' : ' selected'}>Toutes</option>${categories
        .map((c) => `<option value="${echapper(c)}"${c === choisie ? ' selected' : ''}>${echapper(c)}</option>`).join('')}`;
    }
    const { lignes: affichees, total } = filtrerEntrees(etat.entrees, { niveaux: niveaux(), categorie: choisie, texte: texte.value, minMs: seuil, tri });
    for (const bouton of section.querySelectorAll('[data-journaux-tri]')) {
      const actif = bouton.dataset.journauxTri === tri.cle;
      bouton.closest('th').setAttribute('aria-sort', actif ? (tri.sens === 'asc' ? 'ascending' : 'descending') : 'none');
    }
    // la ligne lue (la première visible du cadre, s'il n'est pas tout en haut) reste à sa place à l'écran
    const ancre = ancreDuCadre();
    const plan = planDAffichage([...lignes.rows].map((r) => Number(r.dataset.n)), affichees.map((e) => e.n));
    if (plan) {
      // seulement les nouvelles lignes, en haut ; les autres restent les mêmes nœuds (une sélection y survit)
      if (plan.ajout) lignes.insertAdjacentHTML('afterbegin', htmlDesLignes(affichees.slice(0, plan.ajout)));
      for (let i = 0; i < plan.retrait; i++) lignes.lastElementChild?.remove();
    } else lignes.innerHTML = htmlDesLignes(affichees);
    if (ancre) recaler(ancre);
    affichageDiffere = false;
    vide.hidden = affichees.length > 0;
    vide.textContent = etat.entrees.length ? 'Aucune entrée ne passe les filtres.' : 'Aucune entrée pour l’instant.';
    resume.textContent = resumeDuJournal({ affichees: affichees.length, total, gardees: etat.entrees.length, perdues: etat.perdues, enPause });
  }

  /** La première ligne visible du cadre et sa hauteur à l'écran, quand le cadre n'est pas tout en haut (en haut, les nouvelles lignes se montrent). */
  function ancreDuCadre() {
    if (cadre.scrollTop <= 0) return null;
    const haut = cadre.getBoundingClientRect().top;
    for (const r of lignes.rows) {
      const boite = r.getBoundingClientRect();
      if (boite.bottom > haut) return { n: r.dataset.n, ecart: boite.top - haut };
    }
    return null;
  }

  /** Remet la ligne de l'ancre à la même hauteur dans le cadre (elle a pu descendre de la hauteur des lignes ajoutées au-dessus). */
  function recaler(ancre) {
    const r = lignes.querySelector(`tr[data-n="${ancre.n}"]`);
    if (!r) return;
    const ecart = r.getBoundingClientRect().top - cadre.getBoundingClientRect().top;
    cadre.scrollTop += ecart - ancre.ecart;
  }

  /** Vrai si une sélection non vide est dans le tableau (la copier ne doit pas être défait par une relève). */
  function selectionDansLeTableau() {
    const selection = document.getSelection();
    if (!selection || selection.isCollapsed || !selection.rangeCount) return false;
    const plage = selection.getRangeAt(0);
    return cadre.contains(plage.startContainer) || cadre.contains(plage.endContainer);
  }

  document.addEventListener('selectionchange', () => {
    if (affichageDiffere && !selectionDansLeTableau()) afficher();
  });

  async function relever() {
    if (enCours || arret || !section.open) return; // un menu fermé ne demande rien
    enCours = true;
    const seuilDeLaDemande = seuil;
    let statut = 0;
    let reponse = null;
    try {
      const r = await lire(adresseDuJournal(api, etat.dernier, { minMs: seuilDeLaDemande }));
      statut = r.status;
      reponse = await r.json().catch(() => null);
      if (!r.ok && statut !== 403) throw new Error(reponse?.erreur ?? `le service a répondu ${statut}`);
      if (!reponse) throw new Error('réponse illisible');
    } catch (e) {
      annonce.dataset.erreur = '1';
      annonce.textContent = `Journal injoignable (${e.message}) : nouvel essai dans ${RELEVE_MS / 1000} s.`;
      return;
    } finally {
      enCours = false;
    }
    if (statut === 403) {
      arret = true;
      annonce.textContent = reponse.erreur ?? 'Le service refuse son journal : il n’est pas celui du site de dev.';
      return;
    }
    if (seuilDeLaDemande !== seuil) {
      // le seuil a changé pendant la demande : sa réponse ne vaut plus, tout est relu avec le nouveau
      setTimeout(relever, 0);
      return;
    }
    const suite = fusionner(etat, reponse);
    etat = suite.etat;
    if (suite.redemarre) {
      // un autre processus (ou une numérotation repartie de 1) : tout est redemandé aussitôt, depuis le début
      annonce.textContent = `Le service a redémarré (${new Date().toLocaleTimeString('fr-FR')}) : journal relu depuis le début.`;
      afficher();
      setTimeout(relever, 0);
      return;
    }
    if (annonce.dataset.erreur) {
      annonce.textContent = '';
      delete annonce.dataset.erreur;
    }
    if (suite.ajoutees || !section.dataset.lu) {
      section.dataset.lu = '1';
      // une sélection en cours dans le tableau : l'affichage attend qu'elle parte (selectionchange) ; les entrées, elles, sont gardées
      if (suite.ajoutees && selectionDansLeTableau()) {
        affichageDiffere = true;
        resume.textContent = `${resume.textContent.replace(/ Nouvelles entrées en attente.*$/, '')} Nouvelles entrées en attente (sélection en cours dans le tableau).`;
      } else afficher();
    }
  }

  // menu ouvert seulement : une relève aussitôt à l'ouverture, puis toutes les 2 s tant qu'il reste ouvert, ni en pause ni quand l'onglet est caché ;
  // refermé, la minuterie s'arrête (les entrées reçues restent : rouvert, il reprend après la dernière vue)
  suivreLOuverture(section, RELEVE_MS, () => {
    if (!enPause && !document.hidden) relever();
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && !enPause) relever();
  });

  // un bouton bascule : son libellé reste « Pause », seul aria-pressed dit si la relève est arrêtée (enfoncé = en pause)
  pause.addEventListener('click', () => {
    enPause = !enPause;
    pause.setAttribute('aria-pressed', String(enPause));
    afficher();
    if (!enPause) relever();
  });
  effacer.addEventListener('click', () => {
    // la page oublie ce qu'elle a reçu, pas le curseur : seules les entrées suivantes s'afficheront
    etat = { ...etat, entrees: [] };
    afficher();
  });
  /** Un nouveau seuil « plus lent que … ms » : il part au service (?min_ms=), tout est relu depuis le début. */
  let attente = 0;
  function nouveauSeuil() {
    clearTimeout(attente);
    attente = setTimeout(() => {
      const valeur = seuilSaisi(minMs.value);
      if (valeur === seuil) return;
      seuil = valeur;
      etat = etatVide();
      lignes.innerHTML = '';
      afficher();
      relever();
    }, 400);
  }
  formulaire.addEventListener('input', (ev) => (ev.target === minMs ? nouveauSeuil() : afficher()));
  formulaire.addEventListener('change', (ev) => (ev.target === minMs ? nouveauSeuil() : afficher()));
  formulaire.addEventListener('submit', (ev) => ev.preventDefault());
  // tri par heure ou par durée (en-têtes) : le même en-tête inverse le sens ; un autre part de la plus récente ou de la plus lente
  section.querySelector('thead').addEventListener('click', (ev) => {
    const bouton = ev.target.closest('[data-journaux-tri]');
    if (!bouton) return;
    const cle = bouton.dataset.journauxTri;
    tri = tri.cle === cle ? { cle, sens: tri.sens === 'asc' ? 'desc' : 'asc' } : { cle, sens: 'desc' };
    afficher();
  });
}
