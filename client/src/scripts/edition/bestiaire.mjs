// Extension de l'éditeur pour /bestiaire/ (components/bestiaire/TableauMonstres.astro, lib/bestiaire-rendu.mjs) — demande du propriétaire : « la
// possibilité de créer / modifier / supprimer un monstre » :
//   - modifier : les champs de la carte ouverte deviennent des saisies (`data-ed-sur-demande` : une carte à la fois, il y en a plus de 300 dans la
//     page) ; à l'enregistrement, la ligne du tableau et les autres cartes de l'espèce suivent (leurs champs `data-ed-lecture`) ;
//   - ajouter : « + Ajouter un monstre » (une carte dans une espèce, d'abord celle de la carte ouverte) et « + Ajouter une espèce », enregistrés tout
//     de suite (POST /api/edition/, opération creer) ; la carte du monstre créé s'ouvre, prête à remplir ;
//   - supprimer : un bouton sur chaque ligne (une carte, ou une espèce qui n'a pas de carte) ; la suppression part avec le bouton de confirmation ;
//   - un monstre créé ou supprimé depuis la construction du site apparaît ou disparaît au chargement : la page demande au service l'ordre de ses lignes
//     et le HTML de celles qu'elle n'a pas (POST /api/edition/bestiaire/, rendu par lib/bestiaire-rendu.mjs comme la page construite).
//   - le portrait (demande du propriétaire : « il sera possible d'enregistrer le portrait de la même manière que dans la feuille de personnage ») : sous
//     le cadre de la carte ouverte, « Choisir une image » (réduite puis recadrée comme sur la fiche : src/scripts/portrait.mjs), « Recadrer » et ✕ ; le
//     portrait s'enregistre tout de suite, seul dans son lot (une image fait jusqu'à 700 000 caractères, une requête au plus 1 Mio) ; le service ne
//     renvoie d'une image que son empreinte (ligneSansImage) : l'image entière se demande à part (POST /api/edition/portrait/).
//   - les capacités (décisions R66 à R69 ; « Elle change pour tous », et, du chef, « si l'effet ne diffère que d'un chiffre, le mettre modifiable par un
//     slider ») : sous chaque tuile de la carte ouverte, un panneau — le nom et la description de la capacité commune (les modifier les change sur toutes
//     ses cartes), le préfixe et la liste de sorts de cette carte, un curseur par emplacement « {N} » de la description (la valeur de cette carte ;
//     opération valeurs_de_capacite), « Retirer cette capacité » ; « + Ajouter une capacité » (existante ou nouvelle) est enregistré tout de suite.
//     Le bloc des capacités d'une carte touchée est redemandé au service (POST /api/edition/bestiaire/ { capacites }), rendu comme la page construite.
// Chaque changement redemande la recherche, les filtres et le tri au script de la page (évènement « bestiaire:rafraichir ») ; une carte réécrite lui fait
// recaler l'échelle de la carte ouverte (« bestiaire:echelle-reecrite ») ; le script de la page dit quelle carte s'ouvre (« bestiaire:carte-ouverte »).
// Aucun module partagé avec lui.
import { htmlDuPortrait, empreinteDuPortrait } from '../../lib/bestiaire-rendu.mjs';
import { attributEd, cleDeLigne, ENTITES, lireAttributEd } from '../../lib/edition-modele.mjs';
import { avecLesValeurs, borneDuCurseur, emplacementsDetailles as placesDe, valeursAEnvoyer } from '../../lib/monstre-champs.mjs';
import { CADRAGE_PAR_DEFAUT, cadrageDe, empreinte } from '../../lib/portrait.mjs';
import { ouvrirRecadrage, reduireImage } from '../portrait.mjs';

const TABLES_DE_LIGNE = new Set(['monstre', 'monstre_espece']);
const section = () => document.querySelector('[data-bestiaire-tableau][data-prefixe=""]');
const corps = () => section()?.querySelector('table.btable tbody') ?? null;
const zone = () => section()?.querySelector('[data-cartes]') ?? null;
const rangees = () => [...(corps()?.querySelectorAll('tr[data-ed-monstre]') ?? [])];
const rangeeDe = (id) => rangees().find((tr) => tr.dataset.edMonstre === id) ?? null;
const rafraichir = () => document.dispatchEvent(new CustomEvent('bestiaire:rafraichir'));
const supprimes = new Map(); // id de la ligne -> entité à supprimer ('monstre' : une carte, 'monstre_espece' : une espèce sans carte)
let ecoute = null;
let ecoutePortraits = null;
const images = new Map(); // empreinte -> data URL : les portraits déjà lus au service ou choisis dans cette page

function retirer(tr) {
  document.getElementById(tr.dataset.carte)?.remove();
  tr.remove();
}

/** Le premier élément d'un fragment HTML (`dans` : le contexte d'analyse, une ligne de tableau ne s'analyse que dans un tableau). */
function element(html, dans = '') {
  const modele = document.createElement('template');
  modele.innerHTML = dans === 'tbody' ? `<table><tbody>${html}</tbody></table>` : html;
  return dans === 'tbody' ? modele.content.querySelector('tr') : modele.content.firstElementChild;
}

/**
 * Remet le tableau dans l'état de la base vivante : lignes disparues retirées (avec leur carte), lignes que la page n'a pas ajoutées (HTML du
 * service), ordre du doc dans `data-ordre`. -> les lignes ajoutées [{ id, ancre, tr }].
 */
async function reconcilier(ed) {
  const t = corps();
  if (!t) return [];
  const logo = zone()?.querySelector('.bcarte__portrait[data-logo]')?.dataset.logo ?? `${ed.base}logo.webp`;
  const r = await ed.appel('POST', 'edition/bestiaire/', { connues: rangees().map((tr) => tr.dataset.edMonstre), logo });
  const ordre = new Map(r.ordre.map((id, i) => [id, i]));
  for (const tr of rangees()) if (!ordre.has(tr.dataset.edMonstre)) retirer(tr);
  const ajoutees = [];
  for (const l of r.lignes) {
    // une ancre déjà prise dans la page (une carte renommée depuis la construction gardait l'ancien nom) : la nouvelle ligne prend un suffixe
    let ancre = l.ancre;
    for (let n = 2; document.getElementById(ancre) || document.getElementById(`carte-${ancre}`); n += 1) ancre = `${l.ancre}-${n}`;
    const changer = (html) => (ancre === l.ancre ? html : html.split(l.ancre).join(ancre));
    const tr = element(changer(l.ligne), 'tbody');
    const carte = element(changer(l.carte));
    if (!tr || !carte) continue;
    tr.classList.add('ed-nouveau');
    t.append(tr);
    zone().append(carte);
    ajoutees.push({ id: l.id, ancre, tr });
    // le service rend la carte avec le logo : son portrait (`l.portrait` : empreinte et cadrage) se montre comme les autres, à l'ouverture
    const figure = carte.querySelector('.bcarte__portrait[data-ed-portrait]');
    if (figure && l.portrait) await afficherPortrait(ed, figure, l.portrait);
  }
  for (const tr of rangees()) tr.dataset.ordre = String(ordre.get(tr.dataset.edMonstre) ?? rangees().length);
  if (ed.enEdition) for (const a of ajoutees) boutonSupprimer(a.tr);
  rafraichir();
  return ajoutees;
}

// --- Portrait ----------------------------------------------------------------------------------------------------------------------------------
/** La ligne qui porte le portrait d'une figure : { table, cle } (`data-ed-portrait`), ou null. */
function ligneDuPortrait(figure) {
  try {
    const [table, cle] = JSON.parse(figure?.dataset.edPortrait ?? '');
    return TABLES_DE_LIGNE.has(table) && typeof cle?.id === 'string' ? { table, cle } : null;
  } catch {
    return null;
  }
}

const figuresDe = (table, cle) => [...document.querySelectorAll('.bcarte__portrait[data-ed-portrait]')].filter((f) => {
  const l = ligneDuPortrait(f);
  return l?.table === table && l.cle.id === cle?.id;
});

/** Ce qu'une ligne du service dit du portrait (ligneSansImage) : { empreinte, x, y, zoom }, ou null sans image. */
const portraitVu = (ligne) => (ligne.portrait?.image ? { empreinte: ligne.portrait.empreinte, x: ligne.portrait_x, y: ligne.portrait_y, zoom: ligne.portrait_zoom } : null);

/** Ce que la figure montre, ou doit montrer dès l'ouverture de sa carte (`data-portrait-attendu`) : { empreinte, … } ou null. */
function vuDeLaFigure(figure) {
  if (figure.dataset.portraitAttendu) return JSON.parse(figure.dataset.portraitAttendu);
  const [cle, x, y, zoom] = (figure.dataset.portrait ?? '').split(':');
  return cle ? { empreinte: cle, x: Number(x), y: Number(y), zoom: Number(zoom) } : null;
}

/** L'image entière d'une ligne et son cadrage, lus au service (POST /api/edition/portrait/) ; l'image est gardée pour la suite. */
async function lirePortrait(ed, { table, cle }) {
  const r = await ed.appel('POST', 'edition/portrait/', { table, cle });
  if (r.portrait) images.set(empreinte(r.portrait), r.portrait);
  return r.portrait ? { donnees: r.portrait, x: r.portrait_x, y: r.portrait_y, zoom: r.portrait_zoom } : null;
}

/** Le nom de la carte : son titre, ou sa saisie quand la carte est en mode modification. */
function nomDeLaCarte(carte) {
  const titre = carte?.querySelector('.bcarte__titres h3');
  return (titre?.querySelector('.ed-saisie')?.value ?? titre?.textContent ?? '').trim();
}

/** Le portrait d'une figure refait (lib/bestiaire-rendu.mjs#htmlDuPortrait, l'image en data URL) ; ses boutons du mode modification la suivent. */
function remplacerPortrait(figure, portrait) {
  const ligne = ligneDuPortrait(figure);
  const nom = nomDeLaCarte(figure.closest('.bcarte'));
  const nouvelle = element(htmlDuPortrait({ ...ligne, nom, portrait }, { logo: figure.dataset.logo, adresse: (donnees) => donnees }));
  if (!nouvelle) return figure;
  const outils = figure.querySelector('.ed-portrait');
  if (outils) nouvelle.append(outils);
  figure.replaceWith(nouvelle);
  etatDesOutils(nouvelle);
  return nouvelle;
}

/**
 * Montre dans une figure le portrait `vu` (empreinte et cadrage ; null : le logo). Une carte fermée ne charge rien : la figure note ce qu'elle doit
 * montrer (`data-portrait-attendu`) jusqu'à l'ouverture de sa carte (plus de 300 cartes dans la page, une image fait jusqu'à 700 000 caractères) ;
 * une figure qui le montre déjà ne change pas ; sinon l'image vient du service (ou de ce qu'il a déjà donné).
 */
async function afficherPortrait(ed, figure, vu) {
  if (figure.dataset.portrait === empreinteDuPortrait(vu)) {
    delete figure.dataset.portraitAttendu;
    etatDesOutils(figure);
    return;
  }
  if (!figure.closest('.bcarte')?.classList.contains('est-ouverte')) {
    figure.dataset.portraitAttendu = JSON.stringify(vu);
    return;
  }
  delete figure.dataset.portraitAttendu;
  let portrait = null;
  if (vu) {
    const donnees = images.get(vu.empreinte);
    // l'image lue au service est celle de maintenant (et son cadrage), même si elle a encore changé depuis
    portrait = donnees ? { donnees, ...cadrageDe(vu) } : await lirePortrait(ed, ligneDuPortrait(figure));
  }
  if (figure.isConnected) remplacerPortrait(figure, portrait);
}

/** Une carte s'ouvre : son portrait changé depuis la construction se charge maintenant. */
function portraitsDeLaCarte(ed, carte) {
  for (const f of carte?.querySelectorAll('.bcarte__portrait[data-portrait-attendu]') ?? []) {
    afficherPortrait(ed, f, JSON.parse(f.dataset.portraitAttendu)).catch((e) => ed.annoncer(`Le portrait n’a pas pu être affiché : ${e.message}`, 'erreur'));
  }
}

/**
 * Enregistre le portrait d'une ligne, seul dans son lot, puis le montre. `valeurs` : l'image et son cadrage, le cadrage seul, ou { portrait: null } ;
 * `avant` : l'image (son empreinte) et le cadrage que la page croit en place — refus 409 si quelqu'un d'autre l'a changé entre-temps.
 */
async function enregistrerPortrait(ed, figure, valeurs, avant, message) {
  const ligne = ligneDuPortrait(figure);
  if (!ligne) {
    ed.annoncer('Portrait non enregistré : sa carte n’est plus dans la page.', 'erreur');
    return;
  }
  try {
    const r = await ed.appel('POST', 'edition/', { page: ed.page, operations: [{ op: 'modifier', table: ligne.table, cle: ligne.cle, valeurs, avant }] });
    if (valeurs.portrait) images.set(empreinte(valeurs.portrait), valeurs.portrait);
    for (const l of r.lignes) ed.appliquerLigne(l.table, l.cle, l.ligne);
    ed.annoncer(r.modifications ? message : 'Rien n’a changé dans la base.');
  } catch (e) {
    ed.annoncer(`Portrait non enregistré : ${e.message}`, 'erreur');
    // un conflit : la figure montre le portrait tel qu'il est maintenant
    if (e.statut === 409 && e.corps?.ligne && figure.isConnected) await afficherPortrait(ed, figure, portraitVu(e.corps.ligne)).catch(() => {});
  }
}

/** « Choisir une image » ou « Changer », « Recadrer » et ✕ selon que la figure montre (ou va montrer) une image. */
function etatDesOutils(figure) {
  const outils = figure.querySelector('.ed-portrait');
  if (!outils) return;
  const vide = !vuDeLaFigure(figure);
  outils.querySelector('[data-action="choisir"]').textContent = vide ? 'Choisir une image' : 'Changer';
  outils.querySelector('[data-action="recadrer"]').hidden = vide;
  outils.querySelector('[data-action="retirer"]').hidden = vide;
}

/**
 * Les boutons du portrait d'une carte ouverte en mode modification (comme ceux de la fiche de personnage). Une action à la fois : les boutons restent
 * désactivés de la lecture ou de la réduction de l'image jusqu'à l'enregistrement ; une action qui finit après la sortie du mode modification n'enregistre
 * rien (et le dit).
 */
function outilsDuPortrait(ed, carte) {
  const depart = carte.querySelector('.bcarte__portrait[data-ed-portrait]');
  if (!depart || depart.querySelector('.ed-portrait') || !ligneDuPortrait(depart)) return;
  const outils = document.createElement('div');
  outils.className = 'ed-portrait';
  const figure = () => outils.closest('.bcarte__portrait');
  const titre = () => `Portrait : ${nomDeLaCarte(carte) || 'ce monstre'}`;
  const actif = () => ed.enEdition && outils.isConnected;
  const avantDe = (vu) => ({ portrait: vu ? { empreinte: vu.empreinte } : null, ...(vu ? { portrait_x: vu.x, portrait_y: vu.y, portrait_zoom: vu.zoom } : {}) });
  let occupe = false;
  const uneAction = async (action) => {
    if (occupe) return;
    occupe = true;
    for (const b of outils.querySelectorAll('button')) b.disabled = true;
    try {
      await action();
    } catch (e) {
      ed.annoncer(`Portrait non enregistré : ${e.message}`, 'erreur');
    } finally {
      occupe = false;
      for (const b of outils.querySelectorAll('button')) b.disabled = false;
    }
  };
  const quitte = () => ed.annoncer('Portrait non enregistré : la page a quitté le mode modification.', 'erreur');
  const fichier = document.createElement('input');
  fichier.type = 'file';
  fichier.accept = 'image/*';
  fichier.hidden = true;
  const bouton = (action, texte, aide, danger = false) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `ed-outil${danger ? ' ed-outil--danger' : ''}`;
    b.dataset.action = action;
    b.textContent = texte;
    b.title = aide;
    if (danger) b.setAttribute('aria-label', aide);
    return b;
  };
  const choisir = bouton('choisir', 'Choisir une image', 'Choisir une image (réduite, puis recadrée) : enregistrée tout de suite');
  const recadrer = bouton('recadrer', 'Recadrer', 'Recadrer le portrait : enregistré tout de suite');
  const retirer = bouton('retirer', '✕', 'Retirer le portrait', true);
  choisir.addEventListener('click', () => {
    if (!occupe) fichier.click();
  });
  fichier.addEventListener('change', () => uneAction(async () => {
    const f = fichier.files?.[0];
    fichier.value = '';
    if (!f) return;
    const avant = avantDe(vuDeLaFigure(figure()));
    let donnees;
    try {
      donnees = await reduireImage(f);
    } catch {
      ed.annoncer('Cette image n’a pas pu être lue (ou reste trop lourde une fois réduite).', 'erreur');
      return;
    }
    if (!actif()) return quitte();
    const c = await ouvrirRecadrage(donnees, CADRAGE_PAR_DEFAUT, { titre: titre() });
    if (!c) return;
    if (!actif()) return quitte();
    await enregistrerPortrait(ed, figure(), { portrait: donnees, portrait_x: c.x, portrait_y: c.y, portrait_zoom: c.zoom }, avant, 'Portrait enregistré.');
  }));
  recadrer.addEventListener('click', () => uneAction(async () => {
    // l'image d'origine et son cadrage actuel, lus au service (la page n'a peut-être que le fichier publié au build)
    const p = await lirePortrait(ed, ligneDuPortrait(figure()));
    if (!p) {
      ed.annoncer('Ce portrait a été retiré entre-temps.', 'erreur');
      return;
    }
    if (!actif()) return quitte();
    const c = await ouvrirRecadrage(p.donnees, cadrageDe(p), { titre: titre() });
    if (!c) return;
    if (!actif()) return quitte();
    const avant = avantDe({ empreinte: empreinte(p.donnees), ...p });
    await enregistrerPortrait(ed, figure(), { portrait_x: c.x, portrait_y: c.y, portrait_zoom: c.zoom }, avant, 'Cadrage enregistré.');
  }));
  retirer.addEventListener('click', () => uneAction(async () => {
    if (!confirm(`Retirer le portrait de ${nomDeLaCarte(carte) || 'ce monstre'} ? (enregistré tout de suite)`)) return;
    await enregistrerPortrait(ed, figure(), { portrait: null }, avantDe(vuDeLaFigure(figure())), 'Portrait retiré.');
  }));
  outils.append(fichier, choisir, recadrer, retirer);
  depart.append(outils);
  etatDesOutils(depart);
}

// --- Capacités (décisions R66 à R69) -----------------------------------------------------------------------------------------------------------
// Une tuile `li.bcapacite[data-capacite][data-rang]` (lib/monstre-rendu.mjs#htmlDesCapacitesDuMonstre) = une capacité commune placée sur une carte
// (monstre_capacite { monstre_id, rang }) ; son panneau `div.ed-capacite[data-placement]` n'existe qu'en mode modification.
const retirees = new Map(); // placement -> { monstre_id, rang } : capacités à retirer de leur carte à l'enregistrement
// placement -> { monstre_id, rang, commune (id), propres: Map(numéro -> valeur propre lue au service) ou null avant lecture, emplacements: leur nombre
// dans la description lue, valeurs: Map(numéro -> valeur
// choisie au curseur), invalides: Set(numéro : saisie qui n'est pas un entier positif ou nul) }
const reglages = new Map();
const cleDePlacement = (monstreId, rang) => `${monstreId}\u0000${Number(rang)}`;
const blocsDesCapacites = () => new Map([...document.querySelectorAll('dd[data-capacites-de]')].map((dd) => [dd.dataset.capacitesDe, dd]));
const capaciteListee = (ed, id) => (ed.listes.capacitesDeMonstre ?? []).find((c) => c.valeur === id) ?? null;
const TABLES_DES_CAPACITES = new Set(['monstre_capacite_commune', 'monstre_capacite', 'monstre_capacite_valeur']);

/** Les saisies montées (ed.editeurs) d'une colonne d'une ligne : la même capacité commune peut être montrée par plusieurs tuiles. */
const saisiesDe = (ed, table, cle, colonne) => {
  const k = cleDeLigne(table, cle);
  return [...ed.editeurs.values()].filter((x) => x.info.colonne === colonne && cleDeLigne(x.info.table, x.info.cle) === k);
};

/** La description d'une capacité commune telle qu'elle sera à l'enregistrement : sa saisie, sinon sa ligne lue, sinon la liste du service. */
function descriptionDe(ed, id) {
  const [saisie] = saisiesDe(ed, 'monstre_capacite_commune', { id }, 'description');
  if (saisie) return saisie.controle.value;
  return ed.lignes?.get(cleDeLigne('monstre_capacite_commune', { id }))?.description ?? capaciteListee(ed, id)?.description ?? '';
}

/** La description d'une capacité commune telle qu'elle est dans la base (sa ligne lue, sinon la liste du service) : les valeurs propres se lisent d'après elle. */
const descriptionDeLaBase = (ed, id) => ed.lignes?.get(cleDeLigne('monstre_capacite_commune', { id }))?.description ?? capaciteListee(ed, id)?.description ?? '';

/** La valeur d'un emplacement pour la carte : celle choisie au curseur, sinon sa valeur propre, sinon la valeur commune. */
const valeurDe = (r, p) => r.valeurs.get(p.numero) ?? r.propres?.get(p.numero) ?? p.commune;

function boutonDOutil(texte, aide, classe = '') {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = `ed-outil${classe ? ` ${classe}` : ''}`;
  b.textContent = texte;
  if (aide) b.title = aide;
  return b;
}

/** Un emplacement : curseur et nombre synchronisés, la valeur commune, et un bouton qui y revient ; `apres` : l'aperçu du texte suit. */
function saisieDEmplacement(ed, r, p, apres) {
  const ligne = document.createElement('div');
  ligne.className = 'ed-emplacement';
  const libelle = document.createElement('span');
  libelle.className = 'ed-libelle';
  libelle.textContent = `Valeur ${p.numero}`;
  const curseur = document.createElement('input');
  curseur.type = 'range';
  curseur.className = 'ed-curseur';
  const nombre = document.createElement('input');
  nombre.type = 'number';
  nombre.className = 'ed-saisie ed-nombre';
  nombre.inputMode = 'numeric';
  for (const x of [curseur, nombre]) {
    x.min = '0';
    x.step = '1';
    x.setAttribute('aria-label', `Valeur ${p.numero} de la capacité pour cette carte (valeur commune ${p.commune})`);
  }
  const commune = document.createElement('span');
  commune.className = 'ed-emplacement__commune';
  commune.textContent = `valeur commune ${p.commune}${p.pourcent ? ' %' : ''}`;
  const retour = boutonDOutil('valeur commune', `Revenir à la valeur commune (${p.commune}) : la carte suit alors la description`);
  const propre = r.propres?.get(p.numero) ?? null;
  const etat = (v) => {
    ligne.classList.toggle('ed-propre', v !== p.commune);
    retour.disabled = v === p.commune;
    nombre.classList.toggle('ed-modifiee', v !== (propre ?? p.commune));
  };
  const poser = (v, depuis) => {
    r.valeurs.set(p.numero, v);
    r.invalides.delete(p.numero);
    nombre.classList.remove('ed-invalide');
    // le curseur s'élargit pour une valeur saisie au-delà de sa borne
    if (v > Number(curseur.max)) curseur.max = String(v);
    if (depuis !== curseur) curseur.value = String(v);
    if (depuis !== nombre) nombre.value = String(v);
    etat(v);
    ed.marquerModifie();
    apres();
  };
  const depart = valeurDe(r, p);
  curseur.max = String(Math.max(borneDuCurseur(p, propre), depart));
  curseur.value = String(depart);
  nombre.value = String(depart);
  etat(depart);
  curseur.addEventListener('input', () => poser(Number(curseur.value), curseur));
  nombre.addEventListener('input', () => {
    const v = nombre.value.trim() === '' ? Number.NaN : Number(nombre.value);
    if (Number.isSafeInteger(v) && v >= 0) return poser(v, nombre);
    r.invalides.add(p.numero);
    nombre.classList.add('ed-invalide');
    ed.marquerModifie();
  });
  retour.addEventListener('click', () => poser(p.commune, null));
  ligne.append(libelle, curseur, nombre, commune, retour);
  return ligne;
}

/**
 * Les curseurs d'un panneau, d'après la description en cours (une description modifiée qui change ses emplacements les redessine ; les valeurs
 * choisies restent, par numéro) et l'aperçu du texte de la carte avec ces valeurs (lib/monstre-champs.mjs#avecLesValeurs). Rien avant la lecture des
 * valeurs propres.
 */
function dessinerLesValeurs(ed, panneau) {
  const r = reglages.get(panneau.dataset.placement);
  const zone = panneau.querySelector('.ed-capacite__valeurs');
  if (!r?.propres || !zone) return;
  const places = placesDe(descriptionDe(ed, r.commune));
  // une description qui change son nombre d'emplacements dans ce lot : les valeurs de la carte se règlent après l'avoir enregistrée (le service décide
  // alors quel emplacement garde quelle valeur : lib/monstre-champs.mjs#suiteDesEmplacements). Ce qui est réglé ici est gardé (la description peut revenir
  // à son nombre d'emplacements, le temps d'une frappe) mais ne part pas tant qu'elle en diffère (operationsDeValeurs) : la note le dit s'il y en a
  if (bloque(ed, r)) {
    if (zone.dataset.signature !== 'attente') {
      zone.dataset.signature = 'attente';
      const reglees = Object.keys(valeursAEnvoyer(descriptionDeLaBase(ed, r.commune), r.valeurs, r.propres)).length > 0 || r.invalides.size > 0;
      const note = document.createElement('p');
      note.className = 'ed-capacite__portee';
      note.textContent = `Le nombre de valeurs « {N} » de la description change : enregistrez-la d’abord, puis réglez les valeurs de cette carte.${
        reglees ? ' Les valeurs réglées ici ne partent pas avec elle.' : ''}`;
      zone.replaceChildren(note);
    }
    zone.hidden = false;
    return;
  }
  const apercu = () => {
    const sortie = zone.querySelector('.ed-capacite__apercu');
    const valeurs = Object.fromEntries(places.map((p) => [p.numero, valeurDe(r, p)]));
    if (sortie) sortie.textContent = avecLesValeurs(descriptionDe(ed, r.commune), valeurs);
  };
  const signature = JSON.stringify(places);
  if (zone.dataset.signature !== signature) {
    zone.dataset.signature = signature;
    r.invalides.clear();
    const titre = document.createElement('span');
    titre.className = 'ed-libelle';
    titre.textContent = 'Valeurs — cette carte';
    const sortie = document.createElement('p');
    sortie.className = 'ed-capacite__apercu';
    sortie.setAttribute('aria-live', 'polite');
    zone.replaceChildren(titre, ...places.map((p) => saisieDEmplacement(ed, r, p, apercu)), sortie);
  }
  zone.hidden = places.length === 0;
  apercu();
}

/** « Capacité commune : sur N cartes — la modifier la change sur toutes » (N : liste du service, relue après chaque changement des capacités). */
function ecrireLaPortee(ed, el) {
  const n = capaciteListee(ed, el.dataset.capacite)?.cartes;
  el.textContent = n === undefined
    ? 'Capacité commune : la modifier la change sur toutes les cartes qui l’ont.'
    : n > 1 ? `Capacité commune : sur ${n} cartes — la modifier la change sur toutes.` : 'Capacité commune : sur 1 carte (celle-ci).';
}

/** Un champ du panneau : son intitulé, et un `span` que monterCarte change en saisie (`data-ed-sur-demande`, comme les champs de la carte). */
function champDuPanneau(libelle, table, cle, colonne, texte) {
  const bloc = document.createElement('div');
  bloc.className = 'ed-capacite__champ';
  const intitule = document.createElement('span');
  intitule.className = 'ed-libelle';
  intitule.textContent = libelle;
  const valeur = document.createElement('span');
  valeur.dataset.edLecture = attributEd(table, cle, colonne);
  valeur.dataset.edSurDemande = '';
  valeur.textContent = texte;
  bloc.append(intitule, valeur);
  return bloc;
}

/** Le panneau d'une tuile : la capacité commune (nom, description : toutes ses cartes), ce qui est propre à la carte (préfixe, sorts, valeurs), « Retirer ». */
function panneauDeCapacite(ed, tuile, monstreId) {
  const rang = Number(tuile.dataset.rang);
  const id = tuile.dataset.capacite;
  if (!id || !Number.isInteger(rang)) return;
  const cle = { monstre_id: monstreId, rang };
  const k = cleDePlacement(monstreId, rang);
  if (!reglages.has(k)) reglages.set(k, { monstre_id: monstreId, rang, commune: id, propres: null, emplacements: 0, valeurs: new Map(), invalides: new Set() });
  const listee = capaciteListee(ed, id);
  const panneau = document.createElement('div');
  panneau.className = 'ed-capacite';
  panneau.dataset.placement = k;
  // ses libellés ne sont pas le texte de la carte (la recherche du bestiaire les saute : src/scripts/bestiaire.mjs#texteDeCarte)
  panneau.dataset.horsRecherche = '';
  const portee = document.createElement('p');
  portee.className = 'ed-capacite__portee';
  portee.dataset.capacite = id;
  ecrireLaPortee(ed, portee);
  // la mention et « Retirer » sur la même ligne, en tête du panneau
  const tete = document.createElement('div');
  tete.className = 'ed-capacite__tete';
  panneau.append(
    tete,
    champDuPanneau('Nom — toutes ses cartes', 'monstre_capacite_commune', { id }, 'nom', tuile.querySelector('.bcapacite__nom')?.textContent ?? ''),
    champDuPanneau('Description — toutes ses cartes', 'monstre_capacite_commune', { id }, 'description', listee?.description ?? ''),
    champDuPanneau('Préfixe — cette carte (« [EP3] » : à partir de l’EP 3)', 'monstre_capacite', cle, 'prefixe', tuile.querySelector('.bcapacite__tete .prefixe')?.textContent ?? ''),
  );
  if (listee?.listeDeSorts) panneau.append(champDuPanneau('Sorts — cette carte', 'monstre_capacite', cle, 'sorts', ''));
  const valeurs = document.createElement('div');
  valeurs.className = 'ed-capacite__valeurs';
  valeurs.hidden = true;
  const retirer = boutonDOutil('Retirer cette capacité', 'Retirer cette capacité de cette carte (à l’enregistrement) ; la capacité commune reste sur ses autres cartes', 'ed-outil--danger');
  retirer.setAttribute('aria-pressed', 'false');
  retirer.addEventListener('click', () => {
    const oui = !retirees.has(k);
    if (oui) retirees.set(k, { monstre_id: monstreId, rang });
    else retirees.delete(k);
    retirer.setAttribute('aria-pressed', String(oui));
    retirer.textContent = oui ? 'Sera retirée — annuler' : 'Retirer cette capacité';
    tuile.classList.toggle('ed-supprime', oui);
    ed.marquerModifie();
  });
  tete.append(portee, retirer);
  panneau.append(valeurs);
  panneau.addEventListener('input', (e) => suivreLaSaisie(ed, e.target));
  tuile.append(panneau);
}

/**
 * Une saisie du nom ou de la description d'une capacité commune : la même dans tous les panneaux qui la montrent (autre carte ouverte entre-temps,
 * capacité deux fois sur la carte) ; une description modifiée redessine les curseurs de ses tuiles.
 */
function suivreLaSaisie(ed, cible) {
  const el = cible.closest?.('[data-ed]');
  const x = el && ed.editeurs.get(el);
  if (!x || x.controle !== cible || x.info.table !== 'monstre_capacite_commune') return;
  for (const autre of saisiesDe(ed, x.info.table, x.info.cle, x.info.colonne)) {
    if (autre === x) continue;
    autre.controle.value = x.controle.value;
    autre.controle.classList.toggle('ed-modifiee', autre.controle.value !== autre.original);
  }
  if (x.info.colonne !== 'description') return;
  for (const p of document.querySelectorAll('.ed-capacite[data-placement]')) if (reglages.get(p.dataset.placement)?.commune === x.info.cle.id) dessinerLesValeurs(ed, p);
}

/** Après un montage de saisies : une capacité commune déjà modifiée dans un autre panneau l'est aussi dans les nouveaux. */
function alignerLesCommunes(ed) {
  const modifiees = new Map();
  const k = (x) => `${x.info.cle.id}\u0000${x.info.colonne}`;
  for (const x of ed.editeurs.values()) if (x.info.table === 'monstre_capacite_commune' && x.controle.value !== x.original) modifiees.set(k(x), x.controle.value);
  for (const x of ed.editeurs.values()) {
    const v = x.info.table === 'monstre_capacite_commune' ? modifiees.get(k(x)) : undefined;
    if (v === undefined || x.controle.value === v) continue;
    x.controle.value = v;
    x.controle.classList.add('ed-modifiee');
  }
}

/** Les valeurs propres des emplacements des tuiles de la carte (monstre_capacite_valeur : une ligne seulement quand la valeur n'est pas la commune). */
async function chargerLesValeurs(ed, carte) {
  const panneaux = [...carte.querySelectorAll('.ed-capacite[data-placement]')];
  const attente = [...new Set(panneaux.map((p) => reglages.get(p.dataset.placement)).filter((r) => r && !r.propres))];
  const demandes = attente.flatMap((r) => placesDe(descriptionDeLaBase(ed, r.commune)).map((p) => ({
    table: 'monstre_capacite_valeur', cle: { monstre_id: r.monstre_id, rang: r.rang, numero: p.numero },
  })));
  const lues = demandes.length ? (await ed.appel('POST', 'edition/lignes/', { lignes: demandes })).lignes : [];
  if (!ed.enEdition) return;
  for (const r of attente) {
    r.propres = new Map();
    // le nombre d'emplacements de la description de la base : les curseurs valent pour lui (une description en cours de saisie qui en a un autre les bloque)
    r.emplacements = placesDe(descriptionDeLaBase(ed, r.commune)).length;
  }
  for (const l of lues) if (l.ligne) reglages.get(cleDePlacement(l.cle.monstre_id, l.cle.rang))?.propres?.set(l.cle.numero, l.ligne.valeur);
  for (const p of panneaux) dessinerLesValeurs(ed, p);
}

/** Les panneaux des tuiles de la carte qui n'en ont pas encore, et « + Ajouter une capacité » à la fin de son bloc. */
function panneauxDeLaCarte(ed, carte) {
  for (const dd of carte.querySelectorAll('dd[data-capacites-de]')) {
    const id = dd.dataset.capacitesDe;
    for (const tuile of dd.querySelectorAll('li.bcapacite[data-rang]')) if (!tuile.querySelector(':scope > .ed-capacite')) panneauDeCapacite(ed, tuile, id);
    let ajout = dd.querySelector(':scope > .ed-ajout-capacite');
    if (!ajout) {
      ajout = boutonDOutil('+ Ajouter une capacité', 'Ajouter à cette carte une capacité commune existante ou nouvelle (enregistré tout de suite)', 'ed-ajout-capacite');
      ajout.dataset.horsRecherche = '';
      ajout.addEventListener('click', () => formulaireCapacite(ed, id));
    }
    dd.append(ajout);
  }
}

/** Le bloc des capacités de ces cartes, rendu par le service comme la page construite : { id de la carte: html } (cartes absentes de la page exclues). */
async function blocsDuService(ed, ids) {
  const blocs = blocsDesCapacites();
  const voulus = [...new Set(ids)].filter((id) => blocs.has(id));
  if (!voulus.length) return new Map();
  const { capacites = {} } = await ed.appel('POST', 'edition/bestiaire/', { capacites: voulus });
  return new Map(Object.entries(capacites).filter(([id]) => blocs.get(id)?.isConnected).map(([id, html]) => [blocs.get(id), html]));
}

/** Hors du mode modification (enregistrement, surcouche au chargement) : le bloc des capacités de ces cartes remplacé ; la page relit ses lignes. */
async function refaireLesCapacites(ed, ids) {
  const blocs = await blocsDuService(ed, ids);
  for (const [dd, html] of blocs) dd.innerHTML = html;
  if (!blocs.size) return;
  rafraichir();
  document.dispatchEvent(new CustomEvent('bestiaire:echelle-reecrite'));
}

/** Une tuile qui quitte le bloc en mode modification : ses saisies, son réglage et son retrait éventuel partent avec elle. */
function oublierLaTuile(ed, tuile) {
  for (const el of tuile.querySelectorAll('[data-ed]')) ed.editeurs.delete(el);
  const k = tuile.querySelector('.ed-capacite')?.dataset.placement;
  if (k) {
    reglages.delete(k);
    retirees.delete(k);
  }
  tuile.remove();
}

/**
 * En mode modification (capacité ajoutée) : les tuiles que le bloc n'a pas encore s'ajoutent à la fin, celles qui n'y sont plus partent, les autres
 * restent telles quelles (avec leurs saisies en cours) ; un bloc sans tuile avant ou après est remplacé entier.
 */
function fusionnerLeBloc(ed, dd, html) {
  const modele = document.createElement('template');
  modele.innerHTML = html;
  const neuve = modele.content.querySelector('ul.bcapacites');
  const liste = dd.querySelector(':scope > ul.bcapacites');
  const ajout = dd.querySelector(':scope > .ed-ajout-capacite');
  if (!neuve || !liste) {
    for (const t of dd.querySelectorAll('li.bcapacite')) oublierLaTuile(ed, t);
    dd.replaceChildren(modele.content);
  } else {
    const rangs = new Set([...neuve.children].map((li) => li.dataset.rang));
    for (const li of [...liste.children]) if (!rangs.has(li.dataset.rang)) oublierLaTuile(ed, li);
    const deja = new Set([...liste.children].map((li) => li.dataset.rang));
    for (const li of [...neuve.children]) if (!deja.has(li.dataset.rang)) liste.append(li);
  }
  if (ajout) dd.append(ajout);
}

/** Les cartes dont les capacités ont changé : celles des lignes de placement et de valeur, et toutes celles de la page qui ont une capacité commune modifiée. */
function cartesTouchees(lignes) {
  const ids = new Set();
  const communes = new Set();
  for (const l of lignes ?? []) {
    if (l.table === 'monstre_capacite' || l.table === 'monstre_capacite_valeur') ids.add(l.cle?.monstre_id);
    else if (l.table === 'monstre_capacite_commune') communes.add(l.cle?.id);
  }
  if (communes.size) {
    for (const li of document.querySelectorAll('dd[data-capacites-de] li.bcapacite[data-capacite]')) {
      if (communes.has(li.dataset.capacite)) ids.add(li.closest('dd[data-capacites-de]').dataset.capacitesDe);
    }
  }
  ids.delete(undefined);
  return [...ids];
}

/**
 * « + Ajouter une capacité » : une capacité commune existante, ou nouvelle (nom et description, créée dans le même lot : « @0 »), à la fin des
 * capacités de la carte ; enregistré tout de suite, comme « + Ajouter un monstre ». Le bloc de la carte est redemandé au service et la liste des
 * capacités relue (le nombre de cartes de chacune).
 */
function formulaireCapacite(ed, monstreId) {
  const NOUVELLE = '*'; // jamais un identifiant (tiré du nom par normalize : lettres, chiffres et tirets)
  const liste = ed.listes.capacitesDeMonstre ?? [];
  const { champs: commune } = ENTITES.monstre_capacite_commune;
  const { champs: place } = ENTITES.monstre_capacite;
  const dialogue = ed.formulaire({
    titre: 'Ajouter une capacité',
    aide: 'La capacité est ajoutée tout de suite à la fin des capacités de cette carte, dans la base du site de dev. Une capacité commune vaut pour toutes les cartes qui l’ont : son nom et sa description se modifient pour toutes.',
    champs: [
      {
        nom: 'capacite', libelle: 'Capacité', type: 'choix', requis: true, valeur: NOUVELLE, aide: ' ',
        choix: [{ valeur: NOUVELLE, libelle: '— Nouvelle capacité —' }, ...liste.map((c) => ({ valeur: c.valeur, libelle: c.libelle }))],
      },
      { nom: 'nom', libelle: commune.nom.libelle, type: 'ligne' },
      { nom: 'description', libelle: commune.description.libelle, type: 'texte', aide: '« {10}% » : un pourcentage (curseur de 0 à 100).' },
      { nom: 'prefixe', libelle: place.prefixe.libelle, type: 'ligne' },
      { nom: 'sorts', libelle: place.sorts.libelle, type: 'ligne' },
    ],
    bouton: 'Ajouter',
    valider: async (v) => {
      const nouvelle = v.capacite === NOUVELLE;
      const choisie = liste.find((c) => c.valeur === v.capacite);
      if (nouvelle && (!v.nom.trim() || !v.description.trim())) throw new Error('Une nouvelle capacité a besoin d’un nom et d’une description.');
      const valeurs = { monstre_id: monstreId, capacite_commune_id: nouvelle ? '@0' : v.capacite };
      if (v.prefixe.trim()) valeurs.prefixe = v.prefixe.trim();
      if (choisie?.listeDeSorts && v.sorts.trim()) valeurs.sorts = v.sorts.trim();
      const operations = [{ op: 'creer', entite: 'monstre_capacite', valeurs }];
      if (nouvelle) operations.unshift({ op: 'creer', entite: 'monstre_capacite_commune', valeurs: { nom: v.nom.trim(), description: v.description.trim() } });
      await ed.appel('POST', 'edition/', { page: ed.page, operations });
      const nom = nouvelle ? v.nom.trim() : choisie?.libelle ?? v.capacite;
      try {
        Object.assign(ed.listes, await ed.appel('GET', 'edition/listes/'));
        for (const [dd, html] of await blocsDuService(ed, [monstreId])) fusionnerLeBloc(ed, dd, html);
        // la recherche relit le texte des cartes (la capacité ajoutée)
        rafraichir();
        for (const p of document.querySelectorAll('.ed-capacite__portee')) ecrireLaPortee(ed, p);
        const carte = blocsDesCapacites().get(monstreId)?.closest('.bcarte');
        if (carte) await monterCarte(ed, carte);
        ed.annoncer(`Capacité ajoutée : ${nom}.`);
      } catch (e) {
        ed.annoncer(`Capacité ajoutée (${nom}), mais la carte n’a pas pu être remise à jour : ${e.message}`, 'erreur');
      }
    },
  });
  // nom et description pour une nouvelle capacité seulement ; la liste de sorts pour une capacité qui en a une (« Lanceur de sorts ») ; sous le choix, la
  // description de la capacité choisie
  const form = dialogue.querySelector('form');
  const champ = (nom) => form.elements.namedItem(nom);
  const aide = champ('capacite').closest('label').querySelector('.ed-aide');
  const suivre = () => {
    const nouvelle = champ('capacite').value === NOUVELLE;
    const choisie = liste.find((c) => c.valeur === champ('capacite').value);
    for (const nom of ['nom', 'description']) {
      champ(nom).closest('label').hidden = !nouvelle;
      champ(nom).required = nouvelle;
    }
    champ('sorts').closest('label').hidden = !choisie?.listeDeSorts;
    aide.textContent = choisie
      ? `${choisie.description}${choisie.cartes ? ` — sur ${choisie.cartes} carte${choisie.cartes > 1 ? 's' : ''}` : ''}`
      : 'Une capacité commune nouvelle : elle pourra ensuite être ajoutée à d’autres cartes.';
  };
  champ('capacite').addEventListener('change', suivre);
  suivre();
}

/**
 * Les opérations des capacités : les valeurs réglées au curseur (une opération valeurs_de_capacite par placement ; la valeur commune -> null, la carte suit
 * alors la description), seulement celles qui changent quelque chose, et seulement pour les emplacements de la description telle qu'elle sera enregistrée.
 */
/** Les curseurs d'une capacité sont bloqués : sa description (modifiée dans ce lot) n'a plus le nombre d'emplacements de celle de la base. */
const bloque = (ed, r) => placesDe(descriptionDe(ed, r.commune)).length !== r.emplacements;

function operationsDeValeurs(ed) {
  const ops = [];
  for (const r of reglages.values()) {
    if (!r.propres || !r.valeurs.size) continue;
    // une description qui change son nombre d'emplacements dans ce lot : ses curseurs sont bloqués (dessinerLesValeurs), rien ne part
    if (bloque(ed, r)) continue;
    const valeurs = valeursAEnvoyer(descriptionDe(ed, r.commune), r.valeurs, r.propres);
    if (Object.keys(valeurs).length) ops.push({ op: 'valeurs_de_capacite', monstre_id: r.monstre_id, rang: r.rang, valeurs });
  }
  return ops;
}

/** Les champs de la carte (`data-ed-sur-demande`) deviennent des saisies : leurs lignes sont lues dans la base vivante, puis l'éditeur les monte. */
async function monterCarte(ed, carte) {
  if (!ed.enEdition || !carte) return;
  outilsDuPortrait(ed, carte);
  // la description, repliée en lecture, s'ouvre pour être modifiée (elle reste fermée hors du mode modification : src/scripts/bestiaire.mjs)
  for (const d of carte.querySelectorAll('details.bcarte__description')) d.open = true;
  // les capacités : un panneau par tuile, dont les champs deviennent des saisies avec ceux de la carte
  panneauxDeLaCarte(ed, carte);
  const champs = [...carte.querySelectorAll('[data-ed-sur-demande][data-ed-lecture]')];
  for (const el of champs) {
    el.dataset.ed = el.dataset.edLecture;
    delete el.dataset.edLecture;
  }
  // les cadres vides (type, alignement, description…) s'ouvrent pour être remplis
  if (champs.length) for (const c of carte.querySelectorAll('[data-ed-cadre][hidden]')) c.hidden = false;
  const demandes = new Map();
  for (const el of champs) {
    const info = lireAttributEd(el.dataset.ed);
    const k = info && cleDeLigne(info.table, info.cle);
    if (k && !ed.lignes?.has(k)) demandes.set(k, { table: info.table, cle: info.cle });
  }
  try {
    if (demandes.size) {
      const { lignes } = await ed.appel('POST', 'edition/lignes/', { lignes: [...demandes.values()] });
      if (!ed.enEdition) return;
      for (const l of lignes) if (l.ligne) ed.lignes.set(cleDeLigne(l.table, l.cle), l.ligne);
    }
    if (champs.length) {
      ed.monterChamps(carte);
      alignerLesCommunes(ed);
    }
    // les curseurs des capacités, une fois les descriptions lues (leurs emplacements « {N} »)
    await chargerLesValeurs(ed, carte);
  } catch (e) {
    ed.annoncer(`La carte n’a pas pu passer en mode modification : ${e.message}`, 'erreur');
  }
}

/**
 * Une défense à formule « N (+k/mEP) » ou « N (+k/EP) » se calcule avec les échelles de sa carte (décisions R55, R59, rendu « monstre-rubrique » :
 * `ed.listes.echellesDesCartes`, lu une fois au démarrage) : une carte réécrite (échelle modifiée, carte créée, surcouche au chargement) met la liste à
 * jour et refait ses défenses à formule, hors saisie en cours.
 */
const FORMULE = /\(\s*\+\s*\d+\s*\/\s*(?:[1-9]\d*)?\s*EP\s*\)/;
async function refaireLaDefense(ed, id, echelle) {
  ed.listes.echellesDesCartes = { ...(ed.listes.echellesDesCartes ?? {}), [id]: echelle };
  const champs = [...document.querySelectorAll('[data-ed-rendu="monstre-rubrique"]')].filter((el) => {
    const info = lireAttributEd(el.dataset.ed ?? el.dataset.edLecture);
    return info?.table === 'monstre_rubrique' && info.cle.monstre_id === id && !ed.editeurs.has(el) && (el.querySelector('.bcalcul') || FORMULE.test(el.textContent));
  });
  if (!champs.length) return;
  try {
    const demandes = champs.map((el) => lireAttributEd(el.dataset.ed ?? el.dataset.edLecture)).map((info) => ({ table: info.table, cle: info.cle }));
    const { lignes } = await ed.appel('POST', 'edition/lignes/', { lignes: demandes });
    const parCle = new Map(lignes.filter((l) => l.ligne).map((l) => [cleDeLigne(l.table, l.cle), l.ligne]));
    for (const el of champs) {
      const info = lireAttributEd(el.dataset.ed ?? el.dataset.edLecture);
      const ligne = parCle.get(cleDeLigne(info.table, info.cle));
      if (ligne && !ed.editeurs.has(el)) ed.rendre(el, ligne);
    }
    document.dispatchEvent(new CustomEvent('bestiaire:echelle-reecrite'));
  } catch (e) {
    ed.annoncer(`La défense de la carte n’a pas pu être recalculée : ${e.message}`, 'erreur');
  }
}

function boutonSupprimer(tr) {
  const cellule = tr.querySelector('.bligne__nom');
  if (!cellule || cellule.querySelector('.ed-supprimer')) return;
  const espece = tr.dataset.edNature === 'espece';
  const bouton = document.createElement('button');
  bouton.type = 'button';
  bouton.className = 'ed-outil ed-outil--danger ed-supprimer';
  bouton.textContent = 'Supprimer';
  bouton.setAttribute('aria-pressed', 'false');
  bouton.title = espece
    ? 'Supprimer cette espèce (à l’enregistrement), avec ses lieux de rencontre, ses blocs et son butin'
    : 'Supprimer ce monstre (à l’enregistrement), avec toute sa carte ; son espèce reste';
  bouton.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();
    const id = tr.dataset.edMonstre;
    const oui = !supprimes.has(id);
    if (oui) supprimes.set(id, espece ? 'monstre_espece' : 'monstre');
    else supprimes.delete(id);
    bouton.setAttribute('aria-pressed', String(oui));
    bouton.textContent = oui ? 'Sera supprimé — annuler' : 'Supprimer';
    tr.classList.toggle('ed-supprime', oui);
  });
  cellule.append(bouton);
}

/**
 * Les champs d'un formulaire de création (ENTITES), une liste « choix » prise au service (ed.listes) ; `valeurs` : les valeurs de départ (un choix
 * obligatoire sans valeur de départ prend la première de sa liste : une liste déroulante obligatoire n'a pas de case vide).
 */
function champsDeCreation(ed, entite, valeurs = {}) {
  return Object.entries(ENTITES[entite].champs).map(([nom, champ]) => {
    const choix = champ.type === 'choix' ? champ.choix ?? ed.listes?.[champ.liste] ?? [] : null;
    const valeur = valeurs[nom] ?? (choix && champ.requis ? choix[0]?.valeur : '') ?? '';
    return { nom, libelle: champ.libelle, type: champ.type, requis: champ.requis, valeur, ...(choix ? { choix } : {}) };
  });
}

/** Après une création : la ligne ajoutée au tableau, sa carte ouverte (l'adresse #ancre : le script de la page l'ouvre). */
async function apresCreation(ed, resultat, message) {
  const id = resultat.crees?.[0]?.id;
  const ajoutees = await reconcilier(ed);
  const nouvelle = ajoutees.find((a) => a.id === id);
  if (nouvelle) {
    location.hash = nouvelle.ancre;
    nouvelle.tr.scrollIntoView({ block: 'center' });
  }
  ed.annoncer(message);
}

function formulaireMonstre(ed) {
  const ouverte = zone()?.querySelector('.bcarte.est-ouverte');
  const espece = ouverte ? rangees().find((tr) => tr.dataset.carte === ouverte.id)?.dataset.edEspece : undefined;
  ed.formulaire({
    titre: 'Nouveau monstre',
    aide: 'La carte est créée tout de suite dans la base du site de dev, avec les rubriques de la plupart des cartes du doc, vides : elles se remplissent ensuite dans la carte.',
    champs: champsDeCreation(ed, 'monstre', { espece_id: espece }),
    valider: async (valeurs) => {
      const r = await ed.appel('POST', 'edition/', { page: ed.page, operations: [{ op: 'creer', entite: 'monstre', valeurs }] });
      await apresCreation(ed, r, `Monstre créé : ${valeurs.nom}.`);
    },
  });
}

function formulaireEspece(ed) {
  ed.formulaire({
    titre: 'Nouvelle espèce',
    aide: 'L’espèce est créée tout de suite dans la base du site de dev, à la fin du doc ; elle a sa ligne dans le tableau jusqu’à sa première carte (« + Ajouter un monstre »).',
    champs: champsDeCreation(ed, 'monstre_espece'),
    valider: async (valeurs) => {
      const r = await ed.appel('POST', 'edition/', { page: ed.page, operations: [{ op: 'creer', entite: 'monstre_espece', valeurs }] });
      // la liste des espèces du formulaire « Nouveau monstre » la contient désormais
      Object.assign(ed.listes, await ed.appel('GET', 'edition/listes/'));
      await apresCreation(ed, r, `Espèce créée : ${valeurs.nom}.`);
    },
  });
}

export const bestiaire = {
  nom: 'bestiaire',
  actif: (doc) => Boolean(doc.querySelector('[data-bestiaire-tableau][data-prefixe=""] tr[data-ed-monstre]')),

  async surcouche(ed, lignes) {
    // un portrait changé depuis la construction se charge à l'ouverture de sa carte (afficherPortrait), en lecture comme en mode modification
    if (!ecoutePortraits) {
      ecoutePortraits = (e) => portraitsDeLaCarte(ed, e.detail?.carte);
      document.addEventListener('bestiaire:carte-ouverte', ecoutePortraits);
    }
    if (lignes.some((l) => TABLES_DE_LIGNE.has(l.table) && (l.creee || !l.ligne))) await reconcilier(ed);
    // des capacités modifiées depuis la construction (une capacité commune : toutes ses cartes de la page) : leur bloc vient du service
    const cartes = cartesTouchees(lignes.filter((l) => TABLES_DES_CAPACITES.has(l.table)));
    if (cartes.length) await refaireLesCapacites(ed, cartes);
  },

  pret() {
    // un lien vers un monstre créé depuis la construction du site (#monstre-…) : sa ligne vient d'être ajoutée, on l'ouvre
    const cible = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (cible?.classList.contains('ed-nouveau')) window.dispatchEvent(new HashChangeEvent('hashchange'));
  },

  ligne(ed, table, cle, ligne) {
    if (!TABLES_DE_LIGNE.has(table)) return;
    if (ligne) {
      // le curseur d'échelle de la carte (data-ed-lecture sur echelle_brut) vient d'être réécrit, curseur remis à sa première échelle : la page recale
      // l'échelle de la carte ouverte (src/scripts/bestiaire.mjs ; enregistrement, portrait, surcouche au chargement)
      if (table === 'monstre') {
        document.dispatchEvent(new CustomEvent('bestiaire:echelle-reecrite'));
        refaireLaDefense(ed, cle.id, ligne.echelle_brut);
      }
      if (!('portrait' in ligne)) return;
      for (const f of figuresDe(table, cle)) {
        afficherPortrait(ed, f, portraitVu(ligne)).catch((e) => ed.annoncer(`Le portrait n’a pas pu être affiché : ${e.message}`, 'erreur'));
      }
      return;
    }
    const tr = rangeeDe(cle.id);
    if (tr) retirer(tr);
  },

  debut(ed) {
    const outils = document.createElement('div');
    outils.className = 'ed-outils ed-outils-bestiaire';
    const bouton = (texte, action) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'ed-outil';
      b.textContent = texte;
      b.addEventListener('click', action);
      return b;
    };
    const aide = document.createElement('span');
    aide.className = 'ed-aide';
    aide.textContent = 'Ouvrez une carte pour la modifier.';
    outils.append(bouton('+ Ajouter un monstre', () => formulaireMonstre(ed)), bouton('+ Ajouter une espèce', () => formulaireEspece(ed)), aide);
    section()?.querySelector('.bvue')?.before(outils);
    for (const tr of rangees()) boutonSupprimer(tr);
    ecoute = (e) => monterCarte(ed, e.detail?.carte);
    document.addEventListener('bestiaire:carte-ouverte', ecoute);
    monterCarte(ed, zone()?.querySelector('.bcarte.est-ouverte'));
  },

  verifier(ed) {
    for (const [k, r] of reglages) {
      // une saisie d'un panneau bloqué ne part pas (operationsDeValeurs) : elle ne bloque pas l'enregistrement
      if (r.invalides.size && !retirees.has(k) && !supprimes.has(r.monstre_id) && !bloque(ed, r)) {
        return 'Une valeur de capacité n’est pas un nombre entier positif ou nul : corrigez-la (ou revenez à la valeur commune) avant d’enregistrer.';
      }
    }
    return null;
  },

  operations(ed, operations) {
    const carteSupprimee = (id) => supprimes.has(id);
    const placementRetire = (cle) => retirees.has(cleDePlacement(cle?.monstre_id, cle?.rang));
    // rien à modifier dans ce qui va disparaître (la carte, ses rubriques et ses capacités ; une espèce sans carte ; une capacité retirée de sa carte)
    const garde = operations.filter((op) => !(
      ((op.table === 'monstre' || op.table === 'monstre_espece') && carteSupprimee(op.cle?.id))
      || (op.table === 'monstre_rubrique' && carteSupprimee(op.cle?.monstre_id))
      || ((op.table === 'monstre_capacite' || op.table === 'monstre_capacite_valeur') && (carteSupprimee(op.cle?.monstre_id) || placementRetire(op.cle)))
    ));
    // les valeurs des curseurs (après la description commune modifiée dans le même lot), puis les capacités retirées
    const valeurs = operationsDeValeurs(ed).filter((op) => !carteSupprimee(op.monstre_id) && !placementRetire(op));
    const retraits = [...retirees.values()].filter((p) => !carteSupprimee(p.monstre_id))
      .map((p) => ({ op: 'supprimer', entite: 'monstre_capacite', cle: { monstre_id: p.monstre_id, rang: p.rang } }));
    return [...garde, ...valeurs, ...retraits, ...[...supprimes].map(([id, entite]) => ({ op: 'supprimer', entite, cle: { id } }))];
  },

  apresEnregistrement(ed, resultat) {
    // une carte ou une espèce créée ou supprimée (une carte supprimée peut laisser son espèce sans carte : elle reprend une ligne à elle) : le service
    // redonne le tableau ; des capacités changées : le bloc des cartes touchées (une capacité commune : toutes ses cartes de la page) et la liste des
    // capacités (nombre de cartes de chacune) ; sinon les textes changés (recherche, tri) sont relus
    const lignes = resultat.lignes ?? [];
    const tableau = resultat.crees?.some((c) => TABLES_DE_LIGNE.has(c.entite)) || lignes.some((l) => TABLES_DE_LIGNE.has(l.table) && !l.ligne);
    const cartes = cartesTouchees(lignes);
    const capacites = lignes.some((l) => TABLES_DES_CAPACITES.has(l.table));
    if (!tableau && !cartes.length) {
      rafraichir();
      return;
    }
    (async () => {
      if (tableau) await reconcilier(ed).catch((e) => ed.annoncer(`Le tableau n’a pas pu être remis à jour : ${e.message}`, 'erreur'));
      if (cartes.length) await refaireLesCapacites(ed, cartes).catch((e) => ed.annoncer(`Les capacités n’ont pas pu être remises à jour : ${e.message}`, 'erreur'));
      if (capacites) Object.assign(ed.listes, await ed.appel('GET', 'edition/listes/').catch(() => ({})));
    })();
  },

  fin() {
    document.querySelector('.ed-outils-bestiaire')?.remove();
    for (const b of document.querySelectorAll('.bligne__nom .ed-supprimer, .bcarte__portrait .ed-portrait, .ed-capacite, .ed-ajout-capacite')) b.remove();
    for (const el of document.querySelectorAll('tr.bligne.ed-supprime, li.bcapacite.ed-supprime')) el.classList.remove('ed-supprime');
    supprimes.clear();
    retirees.clear();
    reglages.clear();
    if (ecoute) document.removeEventListener('bestiaire:carte-ouverte', ecoute);
    ecoute = null;
    // la description, ouverte pour être modifiée, se replie de nouveau (« enroulée par défaut »)
    for (const d of document.querySelectorAll('details.bcarte__description[open]')) d.open = false;
    // les champs des cartes redeviennent de simples affichages (réécrits par l'éditeur quand leur ligne change)
    for (const el of document.querySelectorAll('[data-ed-sur-demande][data-ed]')) {
      el.dataset.edLecture = el.dataset.ed;
      delete el.dataset.ed;
    }
    // panneaux retirés, retraits annulés : la recherche relit les cartes
    rafraichir();
  },
};
