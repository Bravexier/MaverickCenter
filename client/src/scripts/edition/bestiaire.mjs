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
// Chaque changement redemande la recherche, les filtres et le tri au script de la page (évènement « bestiaire:rafraichir ») ; une carte réécrite lui fait
// recaler l'échelle de la carte ouverte (« bestiaire:echelle-reecrite ») ; le script de la page dit quelle carte s'ouvre (« bestiaire:carte-ouverte »).
// Aucun module partagé avec lui.
import { htmlDuPortrait, empreinteDuPortrait } from '../../lib/bestiaire-rendu.mjs';
import { cleDeLigne, ENTITES, lireAttributEd } from '../../lib/edition-modele.mjs';
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

/** Les champs de la carte (`data-ed-sur-demande`) deviennent des saisies : leurs lignes sont lues dans la base vivante, puis l'éditeur les monte. */
async function monterCarte(ed, carte) {
  if (!ed.enEdition || !carte) return;
  outilsDuPortrait(ed, carte);
  // la description, repliée en lecture, s'ouvre pour être modifiée (elle reste fermée hors du mode modification : src/scripts/bestiaire.mjs)
  for (const d of carte.querySelectorAll('details.bcarte__description')) d.open = true;
  const champs = [...carte.querySelectorAll('[data-ed-sur-demande][data-ed-lecture]')];
  if (!champs.length) return;
  for (const el of champs) {
    el.dataset.ed = el.dataset.edLecture;
    delete el.dataset.edLecture;
  }
  // les cadres vides (type, alignement, description…) s'ouvrent pour être remplis
  for (const c of carte.querySelectorAll('[data-ed-cadre][hidden]')) c.hidden = false;
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
    ed.monterChamps(carte);
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

  operations(_ed, operations) {
    if (!supprimes.size) return operations;
    // rien à modifier dans ce qui va disparaître (la carte, ses rubriques ; une espèce sans carte)
    const garde = operations.filter((op) => !(
      ((op.table === 'monstre' || op.table === 'monstre_espece') && supprimes.has(op.cle?.id)) || (op.table === 'monstre_rubrique' && supprimes.has(op.cle?.monstre_id))
    ));
    return [...garde, ...[...supprimes].map(([id, entite]) => ({ op: 'supprimer', entite, cle: { id } }))];
  },

  apresEnregistrement(ed, resultat) {
    // une carte supprimée peut laisser son espèce sans carte (elle reprend une ligne à elle) : le service redonne le tableau ; sinon les textes changés
    // (recherche, tri) sont relus
    const lignesChangees = resultat.crees?.length || resultat.lignes?.some((l) => TABLES_DE_LIGNE.has(l.table) && !l.ligne);
    if (lignesChangees) reconcilier(ed).catch((e) => ed.annoncer(`Le tableau n’a pas pu être remis à jour : ${e.message}`, 'erreur'));
    else rafraichir();
  },

  fin() {
    document.querySelector('.ed-outils-bestiaire')?.remove();
    for (const b of document.querySelectorAll('.bligne__nom .ed-supprimer, .bcarte__portrait .ed-portrait')) b.remove();
    for (const tr of document.querySelectorAll('tr.bligne.ed-supprime')) tr.classList.remove('ed-supprime');
    supprimes.clear();
    if (ecoute) document.removeEventListener('bestiaire:carte-ouverte', ecoute);
    ecoute = null;
    // la description, ouverte pour être modifiée, se replie de nouveau (« enroulée par défaut »)
    for (const d of document.querySelectorAll('details.bcarte__description[open]')) d.open = false;
    // les champs des cartes redeviennent de simples affichages (réécrits par l'éditeur quand leur ligne change)
    for (const el of document.querySelectorAll('[data-ed-sur-demande][data-ed]')) {
      el.dataset.edLecture = el.dataset.ed;
      delete el.dataset.ed;
    }
  },
};
