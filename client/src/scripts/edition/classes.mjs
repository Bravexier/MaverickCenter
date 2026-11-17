// Extension de l'éditeur pour la page d'une classe (components/classes/ClassePage.astro) — demande du propriétaire (D11) : ajouter et supprimer des
// spécialités et des dons depuis le site de dev, en mode modification.
//   - la page relit l'état vivant de la classe (POST /api/edition/classe/) ; si des spécialités ou des dons ont été créés ou supprimés depuis la
//     construction du site, elle redessine ses dons, ses spécialités et sa navigation avec le rendu des gabarits (lib/classe-dons-rendu.mjs, sur le même
//     assemblage que le build : lib/classe-assemblage.mjs), puis rebranche ses onglets (évènement « onglets:brancher », components/Onglets.astro) ;
//   - en mode modification : « + Ajouter un don de classe », « + Ajouter un don à <SPÉCIALITÉ> », « + Ajouter une option » (sur un choix ou un don
//     seul, jamais sur un don de spécialité), « + Ajouter une spécialité » (selon lib/dons-edition.mjs#permissions) ; « Supprimer » à bascule sur chaque
//     don et chaque spécialité qui peuvent l'être ; quand des fiches de personnage les ont, l'infobulle les nomme (elles en seront retirées, une note
//     datée le rappellera : décision R42) ;
//   - les créations sont mises en file (une carte « sera créé à l'enregistrement » chacune, à modifier ou retirer) et partent avec « Enregistrer », dans
//     le même lot que les suppressions et les champs modifiés (lib/dons-edition.mjs#operationsDuLot : une création sur une ligne en file la cite « @i ») ;
//     leurs conséquences (un don qui devient reçu sans choix, les fiches qui perdront une spécialité ou un don…) sont confirmées avant l'envoi ;
//   - la « Magie liée » d'un don « Variable » (décision R181 ; réponses du propriétaire « Demander la magie » et « Demander ou retirer » : « Passer à
//     « Variable » demande la magie (innée ou acquise) ; quitter « Variable » retire le lien à la magie. ») : dans le formulaire d'un don ou d'une
//     spécialité, le champ ne s'affiche et n'est exigé que pour le type « Variable », caché et non envoyé sinon ; sous le type d'un don existant, un choix
//     de la magie s'affiche quand le type saisi est « Variable » (exigé quand il y passe, la magie actuelle sinon, à changer), et part dans l'opération
//     « modifier » du don (`magie`) ; quitter « Variable » n'envoie rien, le service retire le lien (lib/dons-edition.mjs#champDeLaMagieDuDon,
//     #avecLaMagieDuDon).
import { assemblerClasse } from '../../lib/classe-assemblage.mjs';
import { analyserTypeDeDon } from '../../lib/classe-champs.mjs';
import {
  doitRedessiner, empreinteDeStructure, htmlDesDons, htmlDesSpecialites, htmlDuGroupeDeNavigation, htmlDuRepereMagique, lienDesSpecialites,
} from '../../lib/classe-dons-rendu.mjs';
import {
  avecLaMagieDuDon, champDeLaMagieDuDon, consequences, libelleDeRetrait, niveauxProposes, nomDuDonSuit, operationsDuLot, permissions,
} from '../../lib/dons-edition.mjs';
import { CHAMPS_HORS_COLONNES, ENTITES, MAGIES_D_UN_DON_VARIABLE } from '../../lib/edition-modele.mjs';
import { echapperHtml } from '../../lib/edition-rendu.mjs';

const racine = () => document.querySelector('.classe[data-ed-classe]');
const classeDeLaPage = () => racine()?.dataset.edClasse ?? null;
const slugDe = (id) => id.slice(id.indexOf('/') + 1);

let etat = null; // état vivant de la classe (serveur/edition.mjs#donneesDeClasse)
let chargement = null;
let ancresConstruites = null; // ancres des dons de la page construite : leurs fiches existent (un don créé depuis renvoie à son ancre)
const file = []; // créations en attente : { entite, valeurs, libelle }
const magiesDesDons = new Map(); // élément [data-ed] du type d'un don → { id, controle, etaitVariable, actuelle, champ, choix } (mode modification)

/** Le type choisi ou saisi est-il « Variable » (le premier mot, comme le service : lib/classe-champs.mjs#analyserTypeDeDon) ? */
const estVariable = (type) => analyserTypeDeDon(type ?? '').type === 'variable';
/** Les champs du type et de la magie d'un don dans le formulaire d'une entité (« Magie liée » d'un don « Variable », R181). */
const CHAMPS_DU_DON_VARIABLE = { capacite: { type: 'type', magie: 'magie' }, specialite: { type: 'don_type', magie: 'don_magie' } };
/** La magie actuelle d'un don « Variable » (capacite_variable.magie), si l'état vivant de la classe la donne ; null sinon (« inchangée »). */
const magieActuelle = (id) => etat?.variables?.[id] ?? null;
const donsSupprimes = new Set();
const specialitesSupprimees = new Set();

async function charger(ed) {
  // un échec n'est pas gardé : la prochaine entrée en mode modification relance la lecture
  chargement = ed.appel('POST', 'edition/classe/', { classe: classeDeLaPage() }).then(
    (r) => (etat = r),
    (e) => {
      chargement = null;
      throw e;
    },
  );
  return chargement;
}

const assemblee = () => assemblerClasse({ specialites: etat.specialites, dons: etat.dons, exclusions: etat.exclusions, typesDon: etat.typesDon });
const donParAncre = (ancre) => etat.dons.find((d) => `don-${slugDe(d.id)}` === ancre) ?? null;
const specialiteParAncre = (ancre) => etat.specialites.find((s) => `specialite-${s.id.slice(s.id.indexOf('#specialite:') + '#specialite:'.length)}` === ancre) ?? null;

/** Remplace l'élément d'id `id` par `html` (rien : il part) ; absent, il est inséré avant le premier élément de `avant` qui existe. */
function remplacer(id, html, avant) {
  const el = document.getElementById(id);
  const gabarit = document.createElement('template');
  gabarit.innerHTML = html;
  const neuf = gabarit.content.firstElementChild;
  if (el) {
    if (neuf) el.replaceWith(neuf);
    else el.remove();
    return neuf;
  }
  if (!neuf) return null;
  const repere = avant.map((s) => racine().querySelector(s)).find(Boolean);
  const fin = racine().querySelector(':scope > .classe-remarque');
  if (repere) repere.before(neuf);
  else if (fin) fin.before(neuf);
  else racine().append(neuf);
  return neuf;
}

const elementDe = (html) => {
  const gabarit = document.createElement('template');
  gabarit.innerHTML = html;
  return gabarit.content.firstElementChild;
};

/** Le repère « Classe magique » du bandeau, refait depuis l'état vivant (une spécialité magique créée ou supprimée). */
function redessinerLeRepere(classe) {
  const html = htmlDuRepereMagique(classe, { classeId: etat.classe.id, amBase: etat.categorie?.am_base ?? null, amMagique: etat.amMagique, note: etat.categorie?.note ?? null });
  const enPlace = document.getElementById('repere-magique');
  const hero = racine().querySelector('.classe-hero');
  let liste = hero?.querySelector('.classe-hero__reperes') ?? null;
  if (!html) {
    enPlace?.remove();
    if (liste && !liste.children.length) liste.remove();
    return;
  }
  if (enPlace) {
    enPlace.replaceWith(elementDe(html));
    return;
  }
  if (!hero) return;
  if (!liste) {
    liste = document.createElement('ul');
    liste.className = 'classe-hero__reperes';
    const stats = hero.querySelector('.classe-stats');
    if (stats) stats.after(liste);
    else hero.append(liste);
  }
  liste.prepend(elementDe(html));
}

/** Un lien de la navigation de la page (« Spécialités », « Dons ») : ajouté à sa place s'il manque, retiré s'il n'a plus lieu d'être. */
function lienDeNavigation(nav, href, libelle, montrer, suivants) {
  const enPlace = nav.querySelector(`:scope > a[href="${href}"]`);
  if (!montrer) {
    enPlace?.remove();
    return;
  }
  if (enPlace) return;
  const a = document.createElement('a');
  a.href = href;
  a.textContent = libelle;
  const suivant = [...suivants.map((h) => nav.querySelector(`:scope > a[href="${h}"]`)), nav.querySelector('.classe-nav__specialites')].find(Boolean);
  if (suivant) suivant.before(a);
  else nav.append(a);
}

/** Avant de brancher les onglets redessinés : ouvre celui du panneau `id` (au lieu du premier), s'il existe encore. */
function rouvrirLePanneau(id) {
  const onglet = id ? racine().querySelector(`.specialites[data-onglets] a.onglet[href="#${CSS.escape(id)}"]`) : null;
  if (!onglet) return;
  const groupe = onglet.closest('.specialites[data-onglets]');
  for (const el of groupe.querySelectorAll('a.onglet, section.specialite')) el.classList.remove('is-active');
  onglet.classList.add('is-active');
  document.getElementById(id)?.classList.add('is-active');
}

/** L'adresse de la page désigne un élément redessiné (#don-…, #specialite-…) : son onglet s'ouvre (components/Onglets.astro) et la page y défile. */
function suivreLAdresse() {
  let id = '';
  try {
    id = decodeURIComponent(location.hash.slice(1));
  } catch {
    return;
  }
  const cible = id ? document.getElementById(id) : null;
  if (!cible || !racine().contains(cible)) return;
  window.dispatchEvent(new HashChangeEvent('hashchange'));
  if (!cible.closest('section.specialite')) cible.scrollIntoView({ block: 'start' });
}

/**
 * Redessine dons, spécialités, navigation et repère « Classe magique » depuis l'état vivant (la page construite ne les montre plus tels qu'ils sont). L'onglet
 * de spécialité ouvert le reste ; `adresse` (au chargement) : l'élément que vise l'adresse est ouvert et montré, comme sur une page construite.
 */
function redessiner(ed, { adresse = false } = {}) {
  const classe = assemblee();
  const ouvert = racine().querySelector('section.specialite.is-active')?.id ?? null;
  const options = {
    base: ed.base, typesDon: etat.typesDon, amMagique: etat.amMagique,
    hrefDuDon: (don) => (ancresConstruites?.has(don.ancre) ? `${ed.base}capacites/${don.slug}/` : `#${don.ancre}`),
  };
  remplacer('specialites', htmlDesSpecialites(classe), ['#depart', '#dons', '#annexe']);
  const dons = remplacer('dons', htmlDesDons(classe, options), ['#annexe']);
  redessinerLeRepere(classe);
  const nav = racine().querySelector('.classe-nav');
  if (nav) {
    const groupe = htmlDuGroupeDeNavigation(classe);
    const enPlace = nav.querySelector('.classe-nav__specialites');
    const gabarit = document.createElement('template');
    gabarit.innerHTML = groupe;
    if (enPlace) enPlace.replaceWith(...gabarit.content.childNodes);
    else if (groupe) nav.append(...gabarit.content.childNodes);
    lienDeNavigation(nav, '#specialites', 'Spécialités', lienDesSpecialites(classe), ['#depart', '#dons', '#annexe']);
    lienDeNavigation(nav, '#dons', 'Dons', Boolean(dons), ['#annexe']);
  }
  racine().dataset.edStructure = empreinteDeStructure(classe);
  rouvrirLePanneau(ouvert);
  for (const g of racine().querySelectorAll('.specialites[data-onglets]')) g.dispatchEvent(new CustomEvent('onglets:brancher', { bubbles: true }));
  if (adresse) suivreLAdresse();
}

/** La disposition vivante diffère-t-elle de celle que la page montre (lib/classe-dons-rendu.mjs#doitRedessiner : une modification de champ, non) ? */
const structureChangee = () => doitRedessiner(racine()?.dataset.edStructure, assemblee());

// --- Mode modification ---------------------------------------------------------------------------------------------------------------------------
const OUTILS = 'ed-outils ed-outils-classe';

function bouton(libelle, action, { danger = false, titre = '' } = {}) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = `ed-outil${danger ? ' ed-outil--danger' : ''}`;
  b.textContent = libelle;
  if (titre) b.title = titre;
  b.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    action(b);
  });
  return b;
}

function boite(...boutons) {
  const div = document.createElement('div');
  div.className = OUTILS;
  div.append(...boutons);
  return div;
}

/**
 * Les champs du formulaire d'une entité, sans ceux que donne le bouton (classe, spécialité, don « au choix avec »), valeurs déjà saisies reprises ;
 * `choix` : des listes propres au bouton (les niveaux d'un don de spécialité).
 */
function champsDuFormulaire(entite, { sans = [], valeurs = {}, choix = {} } = {}) {
  return Object.entries(ENTITES[entite].champs)
    .filter(([nom]) => !sans.includes(nom))
    .map(([nom, c]) => ({
      nom, libelle: c.libelle, type: c.type, requis: c.requis || (entite === 'capacite' && nom === 'niveau' && !sans.includes('niveau')), choix: choix[nom] ?? c.choix,
      aide: c.aide, valeur: valeurs[nom] ?? '',
    }));
}

/** Une création en file : son formulaire (nouvelle, ou modifiée : `index`). */
function formulaire(ed, { entite, fixes, sans, libelle, aide, index = null }) {
  const valeurs = index === null ? {} : file[index].valeurs;
  // un don de spécialité (sans option) : à partir du niveau où la spécialité se choisit
  const choix = entite === 'capacite' && fixes.specialite_id && !fixes.avec
    ? { niveau: niveauxProposes({ specialite: true }).map((n) => ({ valeur: String(n), libelle: `Niveau ${n}` })) } : {};
  const dialogue = ed.formulaire({
    titre: ENTITES[entite].nouveau,
    aide: `${aide} La création part avec « Enregistrer », dans le même lot que les autres modifications de la page.`.trim(),
    champs: champsDuFormulaire(entite, { sans, valeurs, choix }),
    bouton: index === null ? 'Ajouter' : 'Modifier',
    valider: (saisies) => {
      const variable = CHAMPS_DU_DON_VARIABLE[entite];
      if (variable) {
        // la magie d'un don « Variable » : exigée pour ce type, oubliée pour un autre (champ caché, jamais envoyé)
        const m = champDeLaMagieDuDon({ variable: estVariable(saisies[variable.type]), magie: saisies[variable.magie] });
        if (m.erreur) throw new Error(`« ${ENTITES[entite].champs[variable.magie].libelle} » : ${m.erreur}`);
        if (m.envoyer === null) delete saisies[variable.magie];
        else saisies[variable.magie] = m.envoyer;
      }
      for (const [nom, c] of Object.entries(ENTITES[entite].champs)) {
        if (!sans.includes(nom) && (c.requis || (entite === 'capacite' && nom === 'niveau')) && !String(saisies[nom] ?? '').trim()) {
          throw new Error(`« ${c.libelle} » est obligatoire.`);
        }
      }
      const propres = Object.fromEntries(Object.entries(saisies).filter(([, v]) => String(v).trim() !== ''));
      const creation = { entite, valeurs: { ...fixes, ...propres }, libelle };
      if (index === null) file.push(creation);
      else file[index] = creation;
      ed.marquerModifie();
      afficherLaFile(ed);
    },
  });
  if (CHAMPS_DU_DON_VARIABLE[entite]) suivreLeTypeDuFormulaire(dialogue, CHAMPS_DU_DON_VARIABLE[entite], ENTITES[entite].champs[CHAMPS_DU_DON_VARIABLE[entite].magie].libelle);
  // le nom du don de spécialité reprend celui de la spécialité tant qu'on ne l'a pas changé (lib/dons-edition.mjs#nomDuDonSuit) ; rouvert pour « Modifier »,
  // un nom de don personnalisé reste
  const nom = dialogue.querySelector('[name="nom"]');
  const donNom = dialogue.querySelector('[name="don_nom"]');
  if (nom && donNom) {
    let precedent = nom.value;
    nom.addEventListener('input', () => {
      if (nomDuDonSuit(donNom.value, precedent)) donNom.value = nom.value;
      precedent = nom.value;
    });
  }
}

/** Dans un formulaire, la « Magie liée » ne s'affiche (et n'est exigée) que quand le type choisi est « Variable ». */
function suivreLeTypeDuFormulaire(dialogue, { type, magie }, libelle) {
  const choixDuType = dialogue.querySelector(`[name="${type}"]`);
  const choixDeLaMagie = dialogue.querySelector(`[name="${magie}"]`);
  const champ = choixDeLaMagie?.closest('label');
  if (!choixDuType || !champ) return;
  const suivre = () => {
    const { visible, requis } = champDeLaMagieDuDon({ variable: estVariable(choixDuType.value) });
    champ.hidden = !visible;
    choixDeLaMagie.required = requis;
    const etiquette = champ.querySelector('.ed-libelle');
    if (etiquette) etiquette.textContent = `${libelle}${requis ? ' *' : ''}`;
  };
  choixDuType.addEventListener('change', suivre);
  choixDuType.addEventListener('input', suivre);
  suivre();
}

/**
 * Mode modification : sous le type de chaque don (son champ `data-ed` type_brut), le choix de sa « Magie liée », affiché quand le type saisi est
 * « Variable » (R181) : exigé quand le don y passe, sa magie actuelle sinon (« inchangée » quand l'état de la classe ne la donne pas), à changer.
 */
function brancherLesMagies(ed) {
  const champ = CHAMPS_HORS_COLONNES.capacite.magie;
  for (const [el, e] of ed.editeurs) {
    if (e.info.table !== 'capacite' || e.info.colonne !== 'type_brut' || magiesDesDons.has(el)) continue;
    const id = e.info.cle.id;
    const etaitVariable = estVariable(e.original);
    const actuelle = etaitVariable ? magieActuelle(id) : null;
    const label = document.createElement('label');
    label.className = 'ed-magie-du-don';
    const etiquette = document.createElement('span');
    etiquette.className = 'ed-libelle';
    const choix = document.createElement('select');
    choix.className = 'ed-saisie';
    choix.setAttribute('aria-label', champ.libelle);
    choix.title = champ.aide;
    choix.append(new Option(etaitVariable && !actuelle ? '— inchangée —' : '— choisir —', ''), ...MAGIES_D_UN_DON_VARIABLE.map((m) => new Option(m.libelle, m.valeur)));
    choix.value = actuelle ?? '';
    for (const type of ['click', 'keydown', 'keyup', 'pointerdown']) choix.addEventListener(type, (ev) => ev.stopPropagation());
    choix.addEventListener('change', () => ed.marquerModifie());
    label.append(etiquette, choix);
    e.controle.after(label);
    const suivi = { id, controle: e.controle, etaitVariable, actuelle, champ: label, choix };
    const suivre = () => {
      const { visible, requis } = champDeLaMagieDuDon({ variable: estVariable(e.controle.value), etaitVariable });
      label.hidden = !visible;
      etiquette.textContent = `Magie liée${requis ? ' *' : ''}`;
    };
    e.controle.addEventListener('input', suivre);
    suivre();
    magiesDesDons.set(el, suivi);
  }
}

/** Le refus d'un type passé à « Variable » sans magie (R181), avant l'envoi ; null si tout va. */
function refusDesMagies() {
  for (const s of magiesDesDons.values()) {
    const { erreur } = champDeLaMagieDuDon({ variable: estVariable(s.controle.value), etaitVariable: s.etaitVariable, magie: s.choix.value, actuelle: s.actuelle });
    if (erreur) return `« ${etat?.dons.find((d) => d.id === s.id)?.nom ?? s.id} » : ${erreur}`;
  }
  return null;
}

/** Les opérations du lot avec la magie de chaque don « Variable » choisie sous son type (rien pour un autre type : le service retire le lien). */
function avecLesMagies(operations) {
  let sortie = operations;
  for (const s of magiesDesDons.values()) {
    const { envoyer } = champDeLaMagieDuDon({ variable: estVariable(s.controle.value), etaitVariable: s.etaitVariable, magie: s.choix.value, actuelle: s.actuelle });
    sortie = avecLaMagieDuDon(sortie, s.id, envoyer);
  }
  return sortie;
}

const ajouterDon = (ed, { specialite = null, avec = null, libelle, aide }) => () => formulaire(ed, {
  entite: 'capacite',
  fixes: { classe_id: classeDeLaPage(), ...(specialite ? { specialite_id: specialite } : {}), ...(avec ? { avec } : {}) },
  sans: ['classe_id', 'specialite_id', 'avec', ...(avec ? ['niveau'] : [])],
  libelle,
  aide,
});

const ajouterSpecialite = (ed) => () => formulaire(ed, {
  entite: 'specialite',
  fixes: { classe_id: classeDeLaPage() },
  sans: ['classe_id'],
  libelle: 'Nouvelle spécialité',
  aide: 'Une spécialité se choisit au niveau 10 : elle est créée avec son don de spécialité (niveau 10), qui porte d’abord son nom.',
});

/** Les cartes des créations en attente, en tête des dons (chacune : « sera créé à l'enregistrement », modifier, retirer, et y ajouter un don ou une option). */
function afficherLaFile(ed) {
  for (const c of document.querySelectorAll('.ed-file-classe')) c.remove();
  if (!file.length) return;
  const zone = document.createElement('div');
  zone.className = 'ed-file-classe';
  file.forEach((creation, i) => {
    const v = creation.valeurs;
    const carte = document.createElement('article');
    carte.className = 'don ed-nouveau';
    const ou = v.avec ? `option de « ${nomDe(v.avec)} »` : v.specialite_id ? `spécialité ${nomDeSpecialite(v.specialite_id)}, niveau ${v.niveau}` : creation.entite === 'capacite' ? `don de classe, niveau ${v.niveau}` : 'spécialité, avec son don de spécialité (niveau 10)';
    carte.innerHTML = `<header class="don__tete"><span class="don__niveau">${creation.entite === 'specialite' ? 'Spécialité' : 'Don'}</span><h4 class="don__nom">${echapperHtml(v.nom)}</h4></header>`
      + `<p class="don__precision">${echapperHtml(ou)} — sera créé à l’enregistrement</p>`;
    const outils = [
      bouton('Modifier', () => formulaire(ed, { entite: creation.entite, fixes: Object.fromEntries(Object.entries(v).filter(([k]) => ['classe_id', 'specialite_id', 'avec'].includes(k))),
        sans: creation.entite === 'capacite' ? ['classe_id', 'specialite_id', 'avec', ...(v.avec ? ['niveau'] : [])] : ['classe_id'], libelle: creation.libelle, aide: '', index: i })),
      bouton('Retirer', () => {
        const dependantes = file.filter((x) => x.valeurs.avec === `@${i}` || x.valeurs.specialite_id === `@${i}`);
        if (dependantes.length) {
          ed.annoncer(`Retirez d’abord ce qui s’y rattache : ${dependantes.map((x) => x.valeurs.nom).join(', ')}.`, 'erreur');
          return;
        }
        file.splice(i, 1);
        // les références « @k » des créations suivantes reculent d'une place
        for (const x of file) for (const champ of ['avec', 'specialite_id']) {
          const k = /^@(\d+)$/.exec(x.valeurs[champ] ?? '')?.[1];
          if (k !== undefined && Number(k) > i) x.valeurs[champ] = `@${Number(k) - 1}`;
        }
        afficherLaFile(ed);
      }, { danger: true }),
    ];
    if (creation.entite === 'specialite') outils.push(bouton('+ Ajouter un don à cette spécialité', ajouterDon(ed, { specialite: `@${i}`, libelle: 'Nouveau don', aide: `Un don de la spécialité ${v.nom} (niveau 10 au moins).` })));
    if (creation.entite === 'capacite') outils.push(bouton('+ Ajouter une option', ajouterDon(ed, { avec: `@${i}`, libelle: 'Nouvelle option', aide: `Une option au choix avec « ${v.nom} » : même niveau, même ligne.` })));
    carte.append(boite(...outils));
    zone.append(carte);
  });
  const titre = document.createElement('p');
  titre.className = 'etage__repere';
  titre.textContent = `${file.length} création${file.length > 1 ? 's' : ''} en attente d’enregistrement`;
  zone.prepend(titre);
  assurerSectionDons().querySelector('h2').after(zone);
}

const nomDe = (id) => (String(id).startsWith('@') ? file[Number(String(id).slice(1))]?.valeurs.nom : etat.dons.find((d) => d.id === id)?.nom) ?? id;
const nomDeSpecialite = (id) => (String(id).startsWith('@') ? file[Number(String(id).slice(1))]?.valeurs.nom : etat.specialites.find((s) => s.id === id)?.nom) ?? id;

/** La section des dons (une classe sans don n'en a pas : une section vide pour ses boutons). */
function assurerSectionDons() {
  let section = document.getElementById('dons');
  if (section?.querySelector('h2')) return section;
  // la section vide d'une page dessinée par src/scripts/edition/nouvelles.mjs (classe créée), sinon une nouvelle
  if (section) section.remove();
  section = document.createElement('section');
  section.className = 'classe-section ed-dons-vide';
  section.id = 'dons';
  section.innerHTML = '<h2 id="dons-titre">Dons <span class="count">0</span></h2>';
  const repere = racine().querySelector('#annexe') ?? racine().querySelector(':scope > .classe-remarque');
  if (repere) repere.before(section);
  else racine().append(section);
  return section;
}

/** « Supprimer » à bascule ; quand des fiches de personnage ont la ligne, l'infobulle les nomme : elles la perdront (R42). */
function bascule(element, ensemble, id, { libelle, fiches }) {
  const b = bouton('Supprimer', () => {
    const oui = !ensemble.has(id);
    if (oui) ensemble.add(id);
    else ensemble.delete(id);
    b.setAttribute('aria-pressed', String(oui));
    b.textContent = oui ? 'Sera supprimé — annuler' : 'Supprimer';
    element.classList.toggle('ed-supprime', oui);
    ed_.marquerModifie();
  }, { danger: true, titre: fiches.length ? `${libelle} — ${libelleDeRetrait(fiches, { feminin: ensemble === specialitesSupprimees })}` : libelle });
  b.classList.add('ed-supprimer');
  b.setAttribute('aria-pressed', 'false');
  return b;
}
let ed_ = null;

function outils(ed) {
  ed_ = ed;
  const perms = permissions(etat);
  const nomDeClasse = etat.classe.nom;
  const dons = assurerSectionDons();
  const tete = boite(bouton('+ Ajouter un don de classe (reçu sans choix)', ajouterDon(ed, {
    libelle: 'Nouveau don', aide: `Un don de la classe ${nomDeClasse}, reçu sans choix, placé à la fin de son niveau ; une option ajoutée ensuite en fait un choix.`,
  })));
  if (perms.peutAjouterSpecialite && !dons.querySelector('.onglets')) tete.append(bouton('+ Ajouter une spécialité', ajouterSpecialite(ed)));
  dons.querySelector('h2').after(tete);
  // la rangée des onglets : une spécialité de plus
  const onglets = dons.querySelector('.onglets');
  if (onglets && perms.peutAjouterSpecialite) onglets.after(boite(bouton('+ Ajouter une spécialité', ajouterSpecialite(ed))));
  // chaque panneau de spécialité : un don de plus, et la spécialité à supprimer
  for (const panneau of dons.querySelectorAll('section.specialite')) {
    const s = specialiteParAncre(panneau.id);
    if (!s) continue;
    const p = perms.specialites[s.id];
    const boutons = [];
    if (p?.supprimable) {
      boutons.push(bouton(`+ Ajouter un don à ${s.nom}`, ajouterDon(ed, { specialite: s.id, libelle: 'Nouveau don', aide: `Un don de la spécialité ${s.nom}, placé à la fin de son niveau (10 au moins : la spécialité se choisit au niveau 10).` })));
      boutons.push(bascule(panneau, specialitesSupprimees, s.id, { libelle: `Supprimer la spécialité ${s.nom}, son don de spécialité et ses dons (à l’enregistrement)`, fiches: p.fiches }));
    }
    if (boutons.length) panneau.append(boite(...boutons));
  }
  // chaque choix : une option de plus ; chaque don : une option (s'il est seul) et sa suppression
  for (const choix of dons.querySelectorAll('.choix')) {
    const premier = donParAncre(choix.querySelector('article.don')?.id ?? '');
    if (premier && perms.dons[premier.id]?.peutRecevoirOption) {
      choix.append(boite(bouton('+ Ajouter une option', ajouterDon(ed, { avec: premier.id, libelle: 'Nouvelle option', aide: `Une option de plus dans ce choix (niveau ${premier.niveau}) : un seul des dons pourra être pris.` }))));
    }
  }
  for (const article of dons.querySelectorAll('article.don[id^="don-"]')) {
    const don = donParAncre(article.id);
    const p = don && perms.dons[don.id];
    if (!p) continue;
    const boutons = [];
    if (p.peutRecevoirOption && !article.closest('.choix')) {
      boutons.push(bouton('+ Ajouter une option', ajouterDon(ed, { avec: don.id, libelle: 'Nouvelle option', aide: `Une option au choix avec « ${don.nom} » (niveau ${don.niveau}) : les deux deviennent un choix, un seul pourra être pris.` })));
    }
    if (p.supprimable) boutons.push(bascule(article, donsSupprimes, don.id, { libelle: `Supprimer « ${don.nom} » (à l’enregistrement)`, fiches: p.fiches }));
    if (boutons.length) article.append(boite(...boutons));
  }
  afficherLaFile(ed);
}

const lot = (operations) => operationsDuLot({
  champs: operations, specialitesSupprimees: [...specialitesSupprimees], creations: file, donsSupprimes: [...donsSupprimes], etat,
});

export const classes = {
  nom: 'classes',
  actif: (doc) => Boolean(doc.querySelector('.classe[data-ed-classe]')),

  async surcouche(ed) {
    ancresConstruites = new Set([...document.querySelectorAll('.classe article.don[id^="don-"]')].map((a) => a.id));
    try {
      await charger(ed);
    } catch (e) {
      // les autres extensions s'appliquent quand même ; les boutons des spécialités et des dons attendront un nouvel essai (passage en mode modification)
      etat = null;
      chargement = null;
      ed.annoncer(`État de la classe illisible : ${e.message}`, 'erreur');
      return;
    }
    if (structureChangee()) redessiner(ed, { adresse: true });
  },

  debut(ed) {
    // le choix de la « Magie liée » d'un don « Variable » montre sa magie actuelle, lue dans l'état de la classe (variables) : il ne se pose qu'une fois
    // l'état chargé, sinon la première entrée en mode modification montrerait « — inchangée — » ; l'état illisible, il se pose quand même
    if (etat) {
      brancherLesMagies(ed);
      outils(ed);
      return;
    }
    // deux issues séparées : une erreur levée en branchant (issue réussie) ne repasse pas par l'issue d'échec, qui brancherait les magies une 2e fois
    (chargement ?? charger(ed))
      .then(
        () => {
          if (!ed.enEdition) return;
          brancherLesMagies(ed);
          outils(ed);
        },
        (e) => {
          if (ed.enEdition) brancherLesMagies(ed);
          ed.annoncer(`Classe : ${e.message}`, 'erreur');
        },
      )
      .catch((e) => ed.annoncer(`Classe : ${e.message}`, 'erreur'));
  },

  verifier() {
    const magie = refusDesMagies();
    if (magie) return magie;
    if (!etat || (!file.length && !donsSupprimes.size && !specialitesSupprimees.size)) return null;
    try {
      lot([]);
    } catch (e) {
      return e.message;
    }
    const phrases = consequences(etat, { creations: file, donsSupprimes: [...donsSupprimes], specialitesSupprimees: [...specialitesSupprimees] });
    if (phrases.length && !confirm(`${phrases.join('\n')}\n\nEnregistrer ?`)) return 'Enregistrement annulé : rien n’a été envoyé.';
    return null;
  },

  operations(_ed, champs) {
    const operations = avecLesMagies(champs);
    if (!etat || (!file.length && !donsSupprimes.size && !specialitesSupprimees.size)) return operations;
    return lot(operations);
  },

  async apresEnregistrement(ed) {
    await charger(ed);
    if (structureChangee()) redessiner(ed);
  },

  fin() {
    for (const el of document.querySelectorAll('.ed-outils-classe, .ed-file-classe')) el.remove();
    for (const el of document.querySelectorAll('.classe .ed-supprime')) el.classList.remove('ed-supprime');
    document.querySelector('#dons.ed-dons-vide')?.remove();
    file.length = 0;
    magiesDesDons.clear();
    donsSupprimes.clear();
    specialitesSupprimees.clear();
  },
};
