// Extension de l'éditeur pour /bestiaire/ (components/bestiaire/TableauMonstres.astro, lib/bestiaire-rendu.mjs) — demande du propriétaire : « la
// possibilité de créer / modifier / supprimer un monstre » :
//   - modifier : les champs de la carte ouverte deviennent des saisies (`data-ed-sur-demande` : une carte à la fois, il y en a plus de 300 dans la
//     page) ; à l'enregistrement, la ligne du tableau et les autres cartes de l'espèce suivent (leurs champs `data-ed-lecture`) ;
//   - ajouter : « + Ajouter un monstre » (une carte dans une espèce, d'abord celle de la carte ouverte) et « + Ajouter une espèce », enregistrés tout
//     de suite (POST /api/edition/, opération creer) ; la carte du monstre créé s'ouvre, prête à remplir ;
//   - supprimer : un bouton sur chaque ligne (une carte, ou une espèce qui n'a pas de carte) ; la suppression part avec le bouton de confirmation ;
//   - un monstre créé ou supprimé depuis la construction du site apparaît ou disparaît au chargement : la page demande au service l'ordre de ses lignes
//     et le HTML de celles qu'elle n'a pas (POST /api/edition/bestiaire/, rendu par lib/bestiaire-rendu.mjs comme la page construite).
// Chaque changement redemande la recherche, les filtres et le tri au script de la page (évènement « bestiaire:rafraichir ») ; le script de la page dit
// quelle carte s'ouvre (« bestiaire:carte-ouverte »). Aucun module partagé avec lui.
import { cleDeLigne, ENTITES, lireAttributEd } from '../../lib/edition-modele.mjs';

const TABLES_DE_LIGNE = new Set(['monstre', 'monstre_espece']);
const section = () => document.querySelector('[data-bestiaire-tableau][data-prefixe=""]');
const corps = () => section()?.querySelector('table.btable tbody') ?? null;
const zone = () => section()?.querySelector('[data-cartes]') ?? null;
const rangees = () => [...(corps()?.querySelectorAll('tr[data-ed-monstre]') ?? [])];
const rangeeDe = (id) => rangees().find((tr) => tr.dataset.edMonstre === id) ?? null;
const rafraichir = () => document.dispatchEvent(new CustomEvent('bestiaire:rafraichir'));
const supprimes = new Map(); // id de la ligne -> entité à supprimer ('monstre' : une carte, 'monstre_espece' : une espèce sans carte)
let ecoute = null;

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
  const logo = zone()?.querySelector('.bcarte__portrait img')?.getAttribute('src') ?? `${ed.base}logo.webp`;
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
  }
  for (const tr of rangees()) tr.dataset.ordre = String(ordre.get(tr.dataset.edMonstre) ?? rangees().length);
  if (ed.enEdition) for (const a of ajoutees) boutonSupprimer(a.tr);
  rafraichir();
  return ajoutees;
}

/** Les champs de la carte (`data-ed-sur-demande`) deviennent des saisies : leurs lignes sont lues dans la base vivante, puis l'éditeur les monte. */
async function monterCarte(ed, carte) {
  if (!ed.enEdition || !carte) return;
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
    if (lignes.some((l) => TABLES_DE_LIGNE.has(l.table) && (l.creee || !l.ligne))) await reconcilier(ed);
  },

  pret() {
    // un lien vers un monstre créé depuis la construction du site (#monstre-…) : sa ligne vient d'être ajoutée, on l'ouvre
    const cible = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (cible?.classList.contains('ed-nouveau')) window.dispatchEvent(new HashChangeEvent('hashchange'));
  },

  ligne(_ed, table, cle, ligne) {
    if (!TABLES_DE_LIGNE.has(table) || ligne) return;
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
    for (const b of document.querySelectorAll('.bligne__nom .ed-supprimer')) b.remove();
    for (const tr of document.querySelectorAll('tr.bligne.ed-supprime')) tr.classList.remove('ed-supprime');
    supprimes.clear();
    if (ecoute) document.removeEventListener('bestiaire:carte-ouverte', ecoute);
    ecoute = null;
    // les champs des cartes redeviennent de simples affichages (réécrits par l'éditeur quand leur ligne change)
    for (const el of document.querySelectorAll('[data-ed-sur-demande][data-ed]')) {
      el.dataset.edLecture = el.dataset.ed;
      delete el.dataset.ed;
    }
  },
};
