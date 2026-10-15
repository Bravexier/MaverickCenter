// Page Debug (pages/debug.astro ; site de dev seulement, demande du propriétaire) : le testeur de l'API « façon Swagger » et les journaux du service.
//   1. GET <base>api/etat/ : sans `edition: true`, ce service n'est pas celui du site de dev — la page le dit et s'arrête.
//   2. « Tester l'API » (details fermé par défaut) : à la première ouverture, GET <base>api/v1/openapi.json (serveur/openapi.mjs), puis un groupe
//      repliable par tag, filtre texte, pastille par méthode ; le formulaire d'une opération est construit à son ouverture (lib/debug-api.mjs) ;
//      l'en-tête If-Match suit l'ETag du dernier GET de la même adresse (tant qu'il n'est pas saisi à la main) ; une écriture ne part qu'avec la case
//      « Je sais que cette requête modifie la base du site de dev » cochée. Une suppression n'arrive jamais préremplie d'une ligne réelle : seulement
//      de l'adresse (Location) d'un élément créé dans la page, tant que ses champs n'ont pas été saisis à la main. Le navigateur envoie lui-même
//      `Sec-Fetch-Site: same-origin`.
//   3. « Journaux du serveur » : GET <base>api/debug/journal/ toutes les 2 s, les entrées qui suivent la dernière vue (?depuis=), filtrées dans la
//      page (lib/debug-journaux.mjs) ; les nouvelles lignes s'ajoutent en haut sans refaire les autres (planDAffichage), la ligne lue reste à sa place
//      et une sélection dans le tableau diffère l'affichage ; un autre processus du service (redémarrage) fait tout relire ; Pause (bouton bascule,
//      aria-pressed), Effacer l'affichage.
// Script de page : il n'importe que lib/debug-api.mjs et lib/debug-journaux.mjs, qu'aucun autre script de page n'importe (la version portable refuse
// un module partagé ; test/debug-page.test.mjs). Aucune infobulle native (pas de `title`).
import {
  cleDEtag, commandeCurl, corpsLisible, echapper, entetesUtiles, estDuTexte, familleDuStatut, groupesDOperations, htmlDeLaReponse, htmlDesGroupes,
  htmlDuFormulaire, operationCorrespond, operationsDe, racineDeLApi, requeteDe, valeursDuChemin,
} from '../lib/debug-api.mjs';
import {
  RELEVE_MS, adresseDuJournal, categoriesDes, etatVide, filtrerEntrees, fusionner, htmlDesLignes, planDAffichage, resumeDuJournal,
} from '../lib/debug-journaux.mjs';

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
    dire(`Le service ne répond pas (${e.message}) : ni le testeur ni les journaux ne sont disponibles.`, true);
    return;
  }
  if (etat.edition !== true) {
    dire('Ce service n’est pas celui du site de dev (l’édition des règles y est fermée) : la page Debug ne s’en sert pas.', true);
    return;
  }
  const demarre = etat.demarre_le ? new Date(etat.demarre_le) : null;
  dire(`Service du site de dev, version ${etat.version ?? 'inconnue'}${demarre && !Number.isNaN(demarre.getTime())
    ? `, démarré le ${demarre.toLocaleString('fr-FR')}` : ''}${etat.base?.disponible === false ? ' ; base vivante indisponible' : ''}.`);
  brancherLeTesteur(api);
  brancherLesJournaux(api);
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Testeur de l'API

function brancherLeTesteur(api) {
  const testeur = racine.querySelector('[data-debug-testeur]');
  const zone = testeur.querySelector('[data-testeur-groupes]');
  const filtre = testeur.querySelector('[data-testeur-filtre]');
  const resume = testeur.querySelector('[data-testeur-resume]');
  const compte = testeur.querySelector('[data-testeur-compte]');
  /** L'ETag du dernier GET réussi de chaque adresse (sans requête), repris en If-Match par les écritures sur la même ligne. */
  const etags = new Map();
  /** Les adresses (chemins) des éléments créés dans la page (Location d'un POST réussi), la plus récente à la fin : elles seules préremplissent un DELETE. */
  const creees = [];
  let operations = [];
  let racineApi = api.replace(/\/+$/, '');
  let chargement = null;
  testeur.hidden = false;

  async function charger() {
    zone.innerHTML = '<p class="debug-attente" role="status">Chargement de la description de l’API…</p>';
    try {
      const r = await lire(`${api}v1/openapi.json`);
      const spec = await r.json().catch(() => null);
      if (!r.ok || !spec || typeof spec !== 'object') throw new Error(spec?.erreur ?? `le service a répondu ${r.status}`);
      operations = operationsDe(spec);
      racineApi = racineDeLApi(racine.dataset.base, spec);
      zone.innerHTML = operations.length
        ? htmlDesGroupes(groupesDOperations(spec, operations), operations)
        : '<p class="debug-attente">La description ne contient aucune opération.</p>';
      compte.textContent = `${operations.length} opération${operations.length > 1 ? 's' : ''}${spec.info?.version ? ` · API ${spec.info.version}` : ''}`;
      filtrer();
    } catch (e) {
      chargement = null;
      zone.innerHTML = `<p class="debug-attente debug-attente--erreur" role="status">Description de l’API illisible (${echapper(e.message)}).
        <button type="button" data-testeur-recharger>Réessayer</button></p>`;
    }
  }

  testeur.addEventListener('toggle', () => {
    if (testeur.open && !chargement) chargement = charger();
  });
  zone.addEventListener('click', (ev) => {
    if (ev.target.closest('[data-testeur-recharger]')) {
      chargement = charger();
      return;
    }
    const copie = ev.target.closest('[data-copier]');
    if (copie) copier(copie);
  });

  function filtrer() {
    const texte = filtre.value;
    let visibles = 0;
    for (const groupe of zone.querySelectorAll('[data-groupe]')) {
      let n = 0;
      for (const ligne of groupe.querySelectorAll('[data-op-ligne]')) {
        const passe = operationCorrespond(operations[Number(ligne.dataset.opLigne)], texte);
        ligne.hidden = !passe;
        if (passe) n += 1;
      }
      groupe.hidden = n === 0;
      groupe.querySelector('[data-groupe-compte]').textContent = String(n);
      if (texte.trim() && n) groupe.open = true;
      visibles += n;
    }
    resume.textContent = texte.trim() ? `${visibles} sur ${operations.length}` : '';
  }
  filtre.addEventListener('input', filtrer);

  /** Une opération ouverte : son formulaire, construit la première fois (les ids de ses champs commencent par « debug-op<rang> »). */
  zone.addEventListener('toggle', (ev) => {
    const details = ev.target;
    if (!details?.matches?.('details[data-op]') || !details.open) return;
    const corps = details.querySelector('[data-op-corps]');
    if (corps.childElementCount) return;
    const rang = Number(details.dataset.op);
    corps.innerHTML = htmlDuFormulaire(operations[rang], `debug-op${rang}`);
    const exemple = corps.querySelector('[data-corps]');
    if (exemple) exemple.value = operations[rang].corps?.exemple ?? ''; // le texte tel quel (le HTML l'a déjà, échappé)
    majDuFormulaire(corps.querySelector('[data-op-form]'));
  }, true); // `toggle` ne remonte pas : écouté à la capture

  const operationDe = (form) => operations[Number(form.closest('[data-op]').dataset.op)];

  /** Les valeurs saisies d'un formulaire, pour requeteDe (un filtre répétable : le texte de son champ, une valeur par ligne). */
  function saisie(form) {
    const valeurs = { path: {}, query: {}, header: {} };
    for (const champ of form.querySelectorAll('[data-param-dans]')) valeurs[champ.dataset.paramDans][champ.dataset.paramNom] = champ.value;
    return {
      racine: racineApi,
      valeurs,
      vides: [...form.querySelectorAll('[data-param-vide]:checked')].map((c) => c.dataset.paramVide),
      corps: form.querySelector('[data-corps]')?.value ?? '',
      ifMatch: form.querySelector('[data-if-match]')?.value ?? '',
    };
  }

  /**
   * Une suppression dont aucun champ de chemin n'a été saisi à la main : ses champs reprennent l'élément le plus récent créé dans la page qui lui
   * correspond (jamais une ligne d'exemple de la description).
   */
  function suppressionDepuisUneCreation(form, op) {
    if (op.methode !== 'DELETE') return;
    const champs = [...form.querySelectorAll('[data-param-dans="path"]')];
    if (!champs.length || champs.some((c) => c.dataset.manuel === '1')) return;
    const racineDuChemin = new URL(racineApi, location.href).pathname;
    const valeurs = creees.map((adresse) => valeursDuChemin(op, adresse, racineDuChemin)).filter(Boolean).at(-1) ?? null;
    for (const c of champs) c.value = valeurs?.[c.dataset.paramNom] ?? '';
  }

  /** L'adresse qui partira, et If-Match = l'ETag connu de cette adresse, tant que le champ n'a pas été saisi à la main. */
  function majDuFormulaire(form) {
    const op = operationDe(form);
    suppressionDepuisUneCreation(form, op);
    const requete = requeteDe(op, { ...saisie(form), ifMatch: '' });
    const champ = form.querySelector('[data-if-match]');
    if (champ && champ.dataset.manuel !== '1') champ.value = etags.get(cleDEtag(requete.url)) ?? '';
    form.querySelector('[data-adresse]').textContent = `${op.methode} ${requete.url}`;
  }

  zone.addEventListener('input', (ev) => {
    const form = ev.target.closest('[data-op-form]');
    if (!form) return;
    // un If-Match saisi à la main est gardé ; vidé, il suit de nouveau l'ETag connu
    if (ev.target.matches('[data-if-match]')) ev.target.dataset.manuel = ev.target.value.trim() ? '1' : '';
    // un champ de chemin touché à la main n'est plus jamais prérempli (même vidé)
    if (ev.target.matches('[data-param-dans="path"]')) ev.target.dataset.manuel = '1';
    majDuFormulaire(form);
  });
  zone.addEventListener('change', (ev) => {
    const form = ev.target.closest('[data-op-form]');
    if (form && ev.target.matches('select')) majDuFormulaire(form);
  });
  zone.addEventListener('submit', (ev) => {
    const form = ev.target.closest('[data-op-form]');
    if (!form) return;
    ev.preventDefault();
    envoyer(form);
  });

  /**
   * Garde l'ETag d'une réponse réussie : le GET (ou l'écriture) de l'adresse ; la création, sous l'adresse rendue (Location), qui rejoint aussi les
   * éléments créés dans la page (préremplissage d'une suppression) ; une suppression réussie l'en retire.
   */
  function memoriser(requete, reponse) {
    const cle = cleDEtag(new URL(requete.url, location.href).pathname);
    const etag = reponse.headers.get('ETag');
    const lieu = reponse.headers.get('Location');
    if (requete.methode === 'DELETE' && reponse.ok) {
      etags.delete(cle);
      for (let i = creees.length - 1; i >= 0; i--) if (creees[i] === cle) creees.splice(i, 1);
    } else if (reponse.ok) {
      if (requete.methode === 'POST' && lieu) {
        const adresse = cleDEtag(new URL(lieu, location.href).pathname);
        creees.push(adresse);
        if (creees.length > 50) creees.shift();
        if (etag) etags.set(adresse, etag);
      } else if (etag && requete.methode !== 'POST') etags.set(cle, etag);
    }
    for (const form of zone.querySelectorAll('[data-op-form]')) majDuFormulaire(form);
  }

  async function envoyer(form) {
    const op = operationDe(form);
    const annonce = form.querySelector('[data-annonce]');
    const place = form.querySelector('[data-reponse]');
    const bouton = form.querySelector('button[type="submit"]');
    const annoncer = (texte, famille = '') => {
      annonce.textContent = texte;
      if (famille) annonce.dataset.famille = famille;
      else delete annonce.dataset.famille;
    };
    const requete = requeteDe(op, saisie(form));
    if (requete.erreurs.length) {
      annoncer(requete.erreurs.join(' '), 'erreur');
      return;
    }
    const garde = form.querySelector('[data-confirmer]');
    if (op.ecriture && garde && !garde.checked) {
      annoncer('Rien n’est parti : cochez la case, cette requête modifie la base du site de dev.', 'refus');
      garde.focus();
      return;
    }
    const curl = commandeCurl(requete, location.origin);
    bouton.disabled = true;
    annoncer(`${requete.methode} ${requete.url} : envoi…`);
    const debut = performance.now();
    let reponse;
    try {
      reponse = await fetch(requete.url, {
        method: requete.methode,
        headers: requete.entetes,
        body: requete.corps ?? undefined,
        cache: 'no-store',
        credentials: 'same-origin',
      });
    } catch (e) {
      const duree = Math.round(performance.now() - debut);
      annoncer(`Pas de réponse après ${duree} ms : ${e.message}`, 'erreur');
      place.innerHTML = htmlDeLaReponse({ erreur: `La requête n’a pas abouti (${e.message}).` }, curl);
      place.hidden = false;
      bouton.disabled = false;
      return;
    }
    const type = reponse.headers.get('Content-Type') ?? '';
    let corps = null;
    let octets = null;
    try {
      if (requete.methode !== 'HEAD') {
        if (estDuTexte(type)) {
          const texte = await reponse.text();
          corps = texte ? corpsLisible(texte, type) : null;
        } else {
          const blob = await reponse.blob();
          octets = { type, taille: blob.size };
        }
      }
    } catch (e) {
      corps = { texte: `Corps illisible : ${e.message}`, json: false, coupe: 0 };
    }
    const duree = Math.round(performance.now() - debut);
    bouton.disabled = false;
    memoriser(requete, reponse);
    annoncer(`${reponse.status}${reponse.statusText ? ` ${reponse.statusText}` : ''} · ${duree} ms`, familleDuStatut(reponse.status));
    place.innerHTML = htmlDeLaReponse({ entetes: entetesUtiles(reponse.headers), corps, octets }, curl);
    place.hidden = false;
  }

  async function copier(bouton) {
    const code = bouton.closest('.debug-curl')?.querySelector('[data-curl]');
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code.textContent);
      bouton.textContent = 'Copiée';
    } catch {
      // presse-papiers refusé (adresse non sûre, permission) : la commande est sélectionnée, à copier au clavier
      const plage = document.createRange();
      plage.selectNodeContents(code);
      const selection = getSelection();
      selection.removeAllRanges();
      selection.addRange(plage);
      bouton.textContent = 'Sélectionnée : Ctrl+C';
    }
    setTimeout(() => {
      bouton.textContent = 'Copier';
    }, 2500);
  }
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Journaux du serveur

function brancherLesJournaux(api) {
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
  let etat = etatVide();
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
    const { lignes: affichees, total } = filtrerEntrees(etat.entrees, { niveaux: niveaux(), categorie: choisie, texte: texte.value });
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
    if (enCours || arret) return;
    enCours = true;
    let statut = 0;
    let reponse = null;
    try {
      const r = await lire(adresseDuJournal(api, etat.dernier));
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

  // une relève toutes les 2 s, ni en pause ni quand l'onglet est caché
  setInterval(() => {
    if (!enPause && !document.hidden) relever();
  }, RELEVE_MS);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && !enPause) relever();
  });
  relever();

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
  formulaire.addEventListener('input', afficher);
  formulaire.addEventListener('change', afficher);
  formulaire.addEventListener('submit', (ev) => ev.preventDefault());
}
