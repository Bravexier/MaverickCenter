// Page /personnages/ (pages/personnages.astro) : charge les résumés des prétirés auprès du service (GET /api/personnages/), puis filtre et trie la
// liste dans le navigateur (lib/personnages-liste.mjs) ; filtres et tri sont gardés dans l'adresse de la page. Chaque ligne est un lien vers la fiche
// (toute la ligne, pas le nom seul : demande du propriétaire), bordée de la couleur de sa magie (classesDeBordure : les classes de la palette, jamais une couleur) ; le portrait vient de
// GET /api/personnages/<id>/portrait/ (la liste n'en a que l'empreinte et le cadrage), le logo en attendant une image.
// R318 (étape E8) : la liste est rangée en trois sections, « Mes personnages » (fiches `a_moi`), les prétirés, puis les autres fiches de joueur visibles
// avec le nom de leur propriétaire. Sous la ligne d'une fiche de joueur que la session peut régler (la sienne, ou en Créateur) : le menu « Visible par »
// (PUT /api/personnages/<id>/visibilite/) ; sous chaque fiche, pour une session Créateur : « Ranger au compte » (liste de GET /api/utilisateurs/, confirmation,
// PUT /api/personnages/<id>/proprietaire/, puis la liste est relue). Le niveau de la session vient de la réponse de GET /api/moi/ que scripts/compte.mjs a déjà
// reçue (une seule demande par page, zone-menu) ; sans niveau lisible, aucun menu. Contrat avec scripts/compte.mjs, sans module commun : ce script publie la
// réponse dans `window.maverickMoi` (undefined tant qu'elle n'est pas arrivée, null si la demande a échoué) puis émet `maverick:moi` sur `document`
// (`detail` : la réponse, ou null) ; ici, on lit la propriété si l'événement a déjà eu lieu, sinon on l'attend, et on ne fait jamais la requête soi-même.
// La liste s'affiche sans l'attendre, les réglages et « Mes personnages » viennent avec elle. Les
// contrôles sont sous la ligne, pas dedans : toute la ligne est un lien, et un menu ne se met pas dans un lien. Le service reste juge de chaque droit.
// Script de page (navigateur) : il n'importe qu'un module pur que seule cette page utilise (la version portable refuse un module partagé ; il n'importe pas
// lib/compte.mjs, que seul scripts/compte.mjs importe).
import {
  COLONNES, FILTRES_PAR_DEFAUT, adresseDesFiltres, adresseDuPortrait, choixDeFiltres, classesDeBordure, comptesRangeables, filtrer, filtresDepuisAdresse,
  messageDEchec, niveauDeLaSession, optionsDeVisibilite, peutRanger, peutRegler, sectionsDeLaListe, trier,
} from '../lib/personnages-liste.mjs';

const racine = document.getElementById('personnages');
const formulaire = document.getElementById('filtres');
const sections = {
  mes: { bloc: document.getElementById('mes-personnages'), liste: document.getElementById('lignes-mes') },
  pretires: { bloc: document.getElementById('pretires'), liste: document.getElementById('lignes-pretires') },
  autres: { bloc: document.getElementById('fiches-des-joueurs'), liste: document.getElementById('lignes-autres') },
};
const compte = document.getElementById('compte');
const couleurs = JSON.parse(racine.dataset.couleurs || '{}');
let personnages = [];
let niveau = null; // le niveau de la session (réponse de GET /api/moi/ publiée par scripts/compte.mjs) : null sans session lisible
let utilisateurs = null; // les comptes où ranger une fiche (GET /api/utilisateurs/, Créateur) : null tant qu'ils ne sont pas lus, [] s'ils n'ont pas pu l'être
let charge = false; // la liste reçue du service : avant (ou s'il ne répond pas), ni tri ni filtre n'affichent quoi que ce soit
let filtres = filtresDepuisAdresse(location.search);

const element = (balise, classe, contenu) => {
  const e = document.createElement(balise);
  if (classe) e.className = classe;
  if (contenu !== undefined) e.append(contenu);
  return e;
};

/** Le portrait d'une ligne : le carré cadré de l'image (style calculé par le service, lib/portrait.mjs#styleDuCadrage), ou le logo. */
function portrait(p) {
  const cadre = element('span', 'perso__portrait');
  const img = document.createElement('img');
  img.alt = '';
  img.loading = 'lazy';
  img.decoding = 'async';
  const adresse = adresseDuPortrait(racine.dataset.api, p);
  if (adresse) {
    img.src = adresse;
    img.setAttribute('style', p.portrait.style);
    img.addEventListener('error', () => {
      img.removeAttribute('style');
      img.src = racine.dataset.logo;
      cadre.toggleAttribute('data-vide', true);
    }, { once: true });
  } else {
    img.src = racine.dataset.logo;
    cadre.toggleAttribute('data-vide', true);
  }
  cadre.append(img);
  return cadre;
}

function ligne(p) {
  const a = element('a', 'perso');
  a.href = `${racine.dataset.fiche}?id=${encodeURIComponent(p.id)}`;
  const bordure = classesDeBordure(p, couleurs);
  if (bordure) a.classList.add('perso--magie', ...bordure);
  for (const c of COLONNES) {
    if (c.cle === 'portrait') {
      a.append(portrait(p));
    } else if (c.cle === 'niveau') {
      const n = element('span', 'col col--niveau', element('span', 'hors-ecran', `${c.titre} `));
      n.append(String(p.niveau_global));
      n.title = `${p.xp} XP`;
      a.append(n);
    } else {
      a.append(element('span', `col col--${c.cle}`, String(c.texte(p) ?? '')));
    }
  }
  const li = element('li', null, a);
  const gestion = reglages(p);
  if (gestion) li.append(gestion);
  return li;
}

const message = (id, texte) => {
  const e = document.getElementById(id);
  e.textContent = texte ?? '';
  e.hidden = !texte;
};
const dire = (erreur, ok) => { message('reglage-erreur', erreur); message('reglage-ok', ok); };

/** Une écriture du service (PUT, JSON) : `{ ok, statut, corps }`, jamais d'exception (`statut` null si le service ne répond pas). */
async function ecrire(chemin, corps) {
  try {
    const reponse = await fetch(`${racine.dataset.api}${chemin}`, {
      method: 'PUT', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(corps),
    });
    return { ok: reponse.ok, statut: reponse.status, corps: await reponse.json().catch(() => null) };
  } catch {
    return { ok: false, statut: null, corps: null };
  }
}

/** Le menu « Visible par » d'une fiche de joueur que la session règle (R318 (2)) : un changement part aussitôt par la route visibilité. */
function menuVisibilite(p) {
  const select = document.createElement('select');
  select.dataset.visibilite = p.id;
  select.setAttribute('aria-label', `Visible par : ${p.nom}`);
  for (const o of optionsDeVisibilite(p, niveau)) {
    const option = new Option(o.libelle, o.valeur, false, o.selectionnee);
    option.disabled = !o.choisissable;
    select.append(option);
  }
  select.addEventListener('change', async () => {
    const choisie = select.value;
    select.disabled = true;
    dire('', '');
    const r = await ecrire(`personnages/${encodeURIComponent(p.id)}/visibilite/`, { visibilite: choisie });
    if (r.ok) {
      p.visibilite = choisie;
      afficher();
      for (const s of document.querySelectorAll('select[data-visibilite]')) if (s.dataset.visibilite === p.id) s.focus();
      return;
    }
    select.value = p.visibilite;
    select.disabled = false;
    dire(messageDEchec('visibilite', r.statut, r.corps));
    if (r.statut === 404) await recharger();
  });
  return select;
}

/** « Ranger au compte » (R318 (4), session Créateur) : un compte choisi, une confirmation, la route propriétaire, puis la liste est relue. */
function menuRangement(p) {
  const select = document.createElement('select');
  select.dataset.rangement = p.id;
  select.setAttribute('aria-label', `Ranger au compte : ${p.nom}`);
  select.append(new Option(utilisateurs === null || utilisateurs.length ? 'Choisir un compte…' : 'Aucun compte', ''));
  for (const c of comptesRangeables(utilisateurs, p)) select.append(new Option(c.libelle, c.id));
  select.disabled = !utilisateurs?.length;
  select.addEventListener('change', async () => {
    const compte = comptesRangeables(utilisateurs, p).find((c) => c.id === select.value);
    if (!compte) return;
    if (!window.confirm(`Ranger « ${p.nom} » au compte de « ${compte.nom} » ? Ce compte en devient le propriétaire.`)) {
      select.value = '';
      return;
    }
    select.disabled = true;
    dire('', '');
    const r = await ecrire(`personnages/${encodeURIComponent(p.id)}/proprietaire/`, { utilisateur_id: compte.id });
    if (!r.ok) {
      select.value = '';
      select.disabled = false;
      dire(messageDEchec('proprietaire', r.statut, r.corps));
      if (r.statut === 404) await recharger();
      return;
    }
    await recharger();
    dire('', `« ${p.nom} » est rangée au compte de « ${compte.nom} ».`);
  });
  return select;
}

/** Sous la ligne d'une fiche : son propriétaire (fiche d'un autre joueur), « Visible par » et « Ranger au compte » selon ce que la session peut faire ; null s'il n'y a rien à dire. */
function reglages(p) {
  const bloc = element('div', 'perso-reglages');
  if (p.nature === 'joueur' && !p.a_moi && p.proprietaire?.nom_affichage) {
    bloc.append(element('span', 'perso-reglages__proprietaire', `Propriétaire : ${p.proprietaire.nom_affichage}`));
  }
  const champ = (titre, menu) => { const l = element('label', 'perso-reglages__champ', `${titre} `); l.append(menu); bloc.append(l); };
  if (peutRegler(p, niveau)) champ('Visible par', menuVisibilite(p));
  if (peutRanger(niveau)) champ('Ranger au compte', menuRangement(p));
  return bloc.childElementCount ? bloc : null;
}

function pasDeFiche(texte) {
  sections.mes.liste.replaceChildren(element('li', 'personnages-vide', texte));
}

function afficher() {
  if (!charge) return;
  const liste = trier(filtrer(personnages, filtres), filtres.tri, filtres.sens);
  compte.textContent = personnages.length === 0
    ? 'Aucun personnage pour l’instant.'
    : `${liste.length} personnage${liste.length > 1 ? 's' : ''}${liste.length !== personnages.length ? ` sur ${personnages.length}` : ''}`;
  const rangees = sectionsDeLaListe(liste);
  for (const cle of Object.keys(sections)) {
    const { bloc, liste: ol } = sections[cle];
    ol.replaceChildren(...rangees[cle].map(ligne));
    // « Mes personnages » reste visible, même vide, pour une session connectée : le lien du menu y mène (R318)
    bloc.hidden = cle === 'mes' ? niveau === null && !rangees.mes.length : !rangees[cle].length;
  }
  if (!rangees.mes.length && niveau !== null) {
    pasDeFiche(personnages.some((p) => p.a_moi) ? 'Aucune de vos fiches ne correspond à ces filtres.' : 'Aucune fiche n’est rangée à votre compte.');
  }
  document.getElementById('vide').hidden = !(personnages.length && !liste.length);
  for (const bouton of racine.querySelectorAll('#tete button[data-cle]')) {
    const actif = bouton.dataset.cle === filtres.tri;
    const titre = COLONNES.find((c) => c.cle === bouton.dataset.cle).titre;
    bouton.toggleAttribute('data-actif', actif);
    bouton.setAttribute('aria-label', actif
      ? `${titre} : trié par ordre ${filtres.sens === 'desc' ? 'décroissant' : 'croissant'} (cliquer pour inverser)`
      : `Trier par ${titre.toLowerCase()}`);
    bouton.querySelector('.fleche').textContent = actif ? (filtres.sens === 'desc' ? '▼' : '▲') : '↕';
  }
  history.replaceState(null, '', `${location.pathname}${adresseDesFiltres(filtres)}${location.hash}`); // l'ancre du menu (#mes-personnages) reste
}

function remplirFormulaire() {
  const choix = choixDeFiltres(personnages);
  for (const [nom, liste] of [['race', choix.races], ['magie', choix.magies], ['classe', choix.classes]]) {
    const select = formulaire.elements.namedItem(nom);
    select.replaceChildren(select.options[0], ...liste.map((x) => new Option(x.nom, x.id)));
  }
  for (const [cle, valeur] of Object.entries(filtres)) {
    const champ = formulaire.elements.namedItem(cle);
    if (champ) champ.value = valeur;
  }
}

formulaire.addEventListener('input', () => {
  for (const cle of Object.keys(FILTRES_PAR_DEFAUT)) {
    const champ = formulaire.elements.namedItem(cle);
    if (champ) filtres[cle] = champ.value;
  }
  afficher();
});
formulaire.addEventListener('submit', (ev) => ev.preventDefault());
formulaire.addEventListener('reset', () => {
  setTimeout(() => {
    filtres = { ...FILTRES_PAR_DEFAUT, tri: filtres.tri, sens: filtres.sens };
    remplirFormulaire();
    afficher();
  });
});
for (const bouton of racine.querySelectorAll('#tete button[data-cle]')) {
  bouton.addEventListener('click', () => {
    filtres = { ...filtres, sens: filtres.tri === bouton.dataset.cle && filtres.sens === 'asc' ? 'desc' : 'asc', tri: bouton.dataset.cle };
    afficher();
  });
}

/** La liste des personnages que la session voit (GET /api/personnages/) ; lève si le service ne répond pas. */
async function lireLesPersonnages() {
  const reponse = await fetch(`${racine.dataset.api}personnages/`, { credentials: 'same-origin', headers: { Accept: 'application/json' } });
  if (!reponse.ok) throw new Error(`HTTP ${reponse.status}`);
  return (await reponse.json()).personnages;
}

/**
 * Le niveau de la session, d'après la réponse de `GET /api/moi/` que scripts/compte.mjs publie (`window.maverickMoi`, événement `maverick:moi` sur
 * `document`, `detail` identique) : lue si elle est déjà là, attendue sinon. Aucune requête ici. null si la demande de compte a échoué : aucun réglage.
 */
async function lireLeNiveau() {
  const dejaLa = window.maverickMoi;
  if (dejaLa !== undefined) return niveauDeLaSession(dejaLa);
  return new Promise((resolve) => {
    document.addEventListener('maverick:moi', (e) => resolve(niveauDeLaSession(e.detail ?? null)), { once: true });
  });
}

/** Les comptes où ranger une fiche (GET /api/utilisateurs/, Créateur) ; [] avec un message si la liste n'a pas pu être lue. */
async function lireLesComptes() {
  try {
    const reponse = await fetch(`${racine.dataset.api}utilisateurs/`, { credentials: 'same-origin', headers: { Accept: 'application/json' } });
    if (!reponse.ok) throw new Error(`HTTP ${reponse.status}`);
    return (await reponse.json()).utilisateurs ?? [];
  } catch {
    dire('La liste des comptes n’a pas pu être lue : les fiches ne peuvent pas être rangées pour le moment.');
    return [];
  }
}

/** Relit la liste après un réglage (une fiche rangée à un autre compte change de section, ou disparaît). */
async function recharger() {
  try {
    personnages = await lireLesPersonnages();
  } catch {
    dire('La liste n’a pas pu être relue : le service ne répond pas. Rechargez la page.');
    return;
  }
  remplirFormulaire();
  afficher();
}

/** Va à l'ancre de l'adresse si sa section est visible ; vrai si c'est fait. Les sections n'existent qu'une fois la liste lue (l'ancre « Mes personnages » du menu). */
function allerALAncre() {
  const cible = location.hash.length > 1 ? document.getElementById(location.hash.slice(1)) : null;
  if (!cible || cible.hidden) return false;
  cible.scrollIntoView();
  return true;
}

async function charger() {
  try {
    personnages = await lireLesPersonnages();
    charge = true;
  } catch {
    const b = document.getElementById('indisponible');
    b.textContent = 'Le service des personnages n’est pas joignable : la liste ne peut pas être chargée pour le moment.';
    b.hidden = false;
    compte.textContent = '';
    return;
  }
  // la liste d'abord : le niveau (réponse de compte.mjs) peut arriver après, ou jamais si le compte n'est pas posé
  remplirFormulaire();
  afficher();
  const fait = allerALAncre();
  niveau = await lireLeNiveau();
  if (peutRanger(niveau)) utilisateurs = await lireLesComptes();
  remplirFormulaire();
  afficher();
  if (!fait) allerALAncre();
}

charger();
