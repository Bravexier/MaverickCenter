// Corps de la page « Armes » (page.corps_md de ressources/armes) suivi depuis les tables : l'édition du site de dev (client/serveur/edition.mjs) et le rejeu
// du journal (recalculerLesPages) y réécrivent la ligne Markdown d'une arme, d'un matériau ou d'une amélioration modifiés, la ligne « TOTAL » et la liste
// des armes de départ. Ce corps ne s'affiche pas (la page est rendue depuis les tables : components/armes/ArmesPage.astro, demande du propriétaire :
// « Pas de tableau markdown ») ; il sert à la recherche (page_fts, search-index.json) et aux [[liens]].
//
// Stratégie : REMPLACEMENT DE LIGNES, comme lib/corps-magies.mjs. Chaque ligne de tableau se rend depuis sa ligne de la base exactement comme
// l'importeur l'a écrite (test/corps-armes.test.mjs : chaque arme, matériau et amélioration de la base retrouve sa ligne, la liste des armes de départ se
// refait à l'identique) ; la ligne d'avant est cherchée dans la section de sa famille (une arme peut être écrite sous deux bandeaux : Crochet grappin) et
// remplacée ; une arme créée depuis le site s'ajoute à la fin du tableau de sa famille, une arme supprimée en part. Une ligne introuvable (corps qui n'a plus la forme de l'importeur) lève ErreurCorpsArmes : le service refuse le lot plutôt que de laisser le
// corps en retard. Fonctions pures, sans dépendance.

export const PAGE_DES_ARMES = 'ressources/armes';

export class ErreurCorpsArmes extends Error {
  constructor(message) {
    super(message);
    this.name = 'ErreurCorpsArmes';
  }
}

/** Une case de tableau : lignes sans espaces de bord, jointes par <br>, « | » échappé (cell_md de l'importeur). */
export const celluleDArmes = (valeur) =>
  String(valeur ?? '').replace(/\r\n?/g, '\n').split('\n').map((l) => l.trim()).join('<br>').replace(/\|/g, '\\|');

/** La ligne d'une arme : Nom | Coût | Catégorie | Effet | Description. */
export const ligneDArme = (a) =>
  `| ${celluleDArmes(a.nom_brut)} | ${celluleDArmes(a.cout_brut)} | ${celluleDArmes(a.categorie_brut)} | ${celluleDArmes(a.effet)} | ${celluleDArmes(a.description)} |`;

/** La ligne d'un matériau : Matière | Prix matériaux | Effets. */
export const ligneDeMateriau = (nom, m) => `| ${celluleDArmes(nom)} | ${celluleDArmes(m.prix_brut)} | ${celluleDArmes(m.effet_brut)} |`;

/** La ligne d'une amélioration d'arme : Niveau | Coût | Effet. */
export const ligneDAmelioration = (a) => `| +${a.niveau} | ${celluleDArmes(a.cout_brut)} | ${celluleDArmes(a.effet_brut)} |`;

/** La ligne « TOTAL » du tableau des améliorations d'arme. */
export const ligneDuTotal = (total) => `**TOTAL** : ${total ?? ''}`;

/** Le nom d'une arme dans la liste des armes de départ : sa cellule Nom sur une ligne (« Dague (une main) »). */
export const nomDeDepart = (a) => String(a.nom_brut ?? '').replace(/\s+/g, ' ').trim();

const TITRE_DE_DEPART = '## Armes sur fond bleu dans la source';
const TITRE_DES_MATERIAUX = '## MATÉRIAUX';
const TITRE_DES_AMELIORATIONS = '## AMÉLIORATION';

/** Bornes [début, fin[ (indices de lignes) de la section qui commence par la ligne `estTitre`, jusqu'au titre « ## » suivant. */
function section(lignes, estTitre, quoi) {
  const debut = lignes.findIndex(estTitre);
  if (debut < 0) throw new ErreurCorpsArmes(`section introuvable : ${quoi}`);
  let fin = lignes.findIndex((l, i) => i > debut && /^## /.test(l));
  if (fin < 0) fin = lignes.length;
  return [debut, fin];
}

/** Le titre « ## » de la section d'une famille d'armes (bandeau : « ## ÉPÉES - D10 », « ## ARME DE MONSTRES - … »), d'après son nom. */
const titreDeFamille = (nom) => (l) => l === `## ${nom}` || l.startsWith(`## ${nom} `);

/** Remplace, dans la section, la ligne `avant` par `apres` (une seule fois ; `apres` null : la ligne part) ; ErreurCorpsArmes si elle n'y est pas. */
function remplacerDansSection(corps, bornes, avant, apres, quoi) {
  const lignes = corps.split('\n');
  const [debut, fin] = bornes(lignes);
  const i = lignes.findIndex((l, k) => k > debut && k < fin && l === avant);
  if (i < 0) throw new ErreurCorpsArmes(`ligne introuvable : ${quoi}`);
  if (apres === null) lignes.splice(i, 1);
  else lignes[i] = apres;
  return lignes.join('\n');
}

/** Ajoute `ligne` après la dernière ligne du tableau de la section ; ErreurCorpsArmes si la section n'a pas de tableau. */
function ajouterDansSection(corps, bornes, ligne, quoi) {
  const lignes = corps.split('\n');
  const [debut, fin] = bornes(lignes);
  let derniere = -1;
  for (let k = debut + 1; k < fin; k++) if (lignes[k].startsWith('|')) derniere = k;
  if (derniere < 0) throw new ErreurCorpsArmes(`tableau introuvable : ${quoi}`);
  lignes.splice(derniere + 1, 0, ligne);
  return lignes.join('\n');
}

/**
 * La liste des armes de départ (« ## Armes sur fond bleu dans la source ») refaite depuis les armes : une puce par bandeau qui en a, dans l'ordre des
 * bandeaux, ses armes dans l'ordre du bandeau. `familles` : [{ id, nom }] dans l'ordre ; `armes` : [{ famille_id, nom_brut, depart_possible, ordre }].
 * Le libellé du bandeau est repris du titre de sa section (tel qu'écrit dans le corps).
 */
export function corpsAvecArmesDeDepart(corps, familles, armes) {
  const lignes = corps.split('\n');
  const [debut, fin] = section(lignes, (l) => l === TITRE_DE_DEPART, 'armes de départ');
  const puces = [];
  for (const f of familles) {
    const noms = armes.filter((a) => a.famille_id === f.id && a.depart_possible === 1).sort((a, b) => a.ordre - b.ordre).map(nomDeDepart);
    if (!noms.length) continue;
    const titre = lignes.find(titreDeFamille(f.nom));
    if (!titre) throw new ErreurCorpsArmes(`section introuvable : ${f.nom}`);
    puces.push(`- Sous « ${titre.slice(3)} » : ${noms.join(', ')}`);
  }
  const premiere = lignes.findIndex((l, i) => i > debut && i < fin && l.startsWith('- Sous « '));
  if (premiere < 0) throw new ErreurCorpsArmes('liste des armes de départ introuvable');
  let derniere = premiere;
  while (derniere + 1 < fin && lignes[derniere + 1].startsWith('- Sous « ')) derniere++;
  lignes.splice(premiere, derniere - premiere + 1, ...puces);
  return lignes.join('\n');
}

/**
 * Le corps après la modification d'une ligne d'une des tables de la page (ressource d'un matériau d'arme renommé, arme, materiau_arme,
 * amelioration_equipement de cible « arme », amelioration_total « arme »). `contexte` : { familles: [{ id, nom }] (ordre des bandeaux), armes: () => lignes arme (pour la liste des armes de départ),
 * nomDuMateriau: (ressource_id) => nom }.
 */
export function corpsDesArmesApres(corps, table, avant, apres, contexte) {
  if (table === 'ressource') {
    // un matériau d'arme renommé : sa ligne du tableau des matériaux
    if (avant.nom === apres.nom) return corps;
    return corpsAvecMateriauRenomme(corps, avant.nom, apres.nom, (lignes) => section(lignes, (l) => l === TITRE_DES_MATERIAUX, 'matériaux'));
  }
  if (table === 'arme') {
    const ligne = apres ?? avant;
    const famille = contexte.familles.find((f) => f.id === ligne.famille_id);
    if (!famille) throw new ErreurCorpsArmes(`famille inconnue : ${ligne.famille_id}`);
    const bornes = (lignes) => section(lignes, titreDeFamille(famille.nom), famille.nom);
    let sortie;
    if (!avant) sortie = ajouterDansSection(corps, bornes, ligneDArme(apres), `${famille.nom} › ${apres.nom}`); // une arme créée : à la fin de son tableau
    else if (!apres) sortie = remplacerDansSection(corps, bornes, ligneDArme(avant), null, `${famille.nom} › ${avant.nom}`); // supprimée : sa ligne part
    else sortie = remplacerDansSection(corps, bornes, ligneDArme(avant), ligneDArme(apres), `${famille.nom} › ${avant.nom}`);
    const depart = (x) => x?.depart_possible === 1;
    if (depart(avant) !== depart(apres) || (depart(apres) && avant.nom_brut !== apres.nom_brut)) {
      sortie = corpsAvecArmesDeDepart(sortie, contexte.familles, contexte.armes());
    }
    return sortie;
  }
  if (table === 'materiau_arme') {
    const nom = contexte.nomDuMateriau(apres.ressource_id);
    const bornes = (lignes) => section(lignes, (l) => l === TITRE_DES_MATERIAUX, 'matériaux');
    return remplacerDansSection(corps, bornes, ligneDeMateriau(nom, avant), ligneDeMateriau(nom, apres), `matériau ${nom}`);
  }
  if (table === 'amelioration_equipement') {
    if (apres.cible !== 'arme') return corps;
    const bornes = (lignes) => section(lignes, (l) => l === TITRE_DES_AMELIORATIONS, 'améliorations');
    return remplacerDansSection(corps, bornes, ligneDAmelioration(avant), ligneDAmelioration(apres), `amélioration +${avant.niveau}`);
  }
  if (table === 'amelioration_total') {
    if (apres.cible !== 'arme') return corps;
    const bornes = (lignes) => section(lignes, (l) => l === TITRE_DES_AMELIORATIONS, 'améliorations');
    return remplacerDansSection(corps, bornes, ligneDuTotal(avant.total_brut), ligneDuTotal(apres.total_brut), 'total des améliorations');
  }
  return corps;
}

/** Tables dont une ligne touche le corps de la page des armes (recalculerLesPages, dans cet ordre). */
export const TABLES_DE_LA_PAGE_DES_ARMES = ['ressource', 'arme', 'materiau_arme', 'amelioration_equipement', 'amelioration_total'];

/**
 * Pages qui écrivent les matériaux d'arme dans leurs tableaux, en plus de celle des armes : un matériau est une ressource partagée avec les armures et
 * les boucliers (« comme c'est le même pour armure et bouclier, ça le changera aussi (ça utilisera la même table) »).
 */
export const PAGES_DES_MATERIAUX = ['ressources/armures', 'ressources/bouclier'];

const cleDeCase = (t) => String(t ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/**
 * Un matériau renommé dans le Markdown d'une page : chaque case de tableau qui écrit exactement son ancien nom (à la casse, aux accents et aux espaces
 * près : « Fer Noir » de la grille des armures) et chaque titre « ### Ligne : X » / « ### Colonne : X » qui le nomme prennent le nouveau nom. Un nom qui
 * le contient sans être lui (« Armure Fer/Titane », une armure ; « minerais de titane ») ne change pas. `bornes(lignes)` limite le remplacement à une
 * section (par défaut : tout le corps).
 */
export function corpsAvecMateriauRenomme(corps, ancien, nouveau, bornes = (lignes) => [-1, lignes.length]) {
  const cle = cleDeCase(ancien);
  if (!cle || ancien === nouveau) return corps;
  const lignes = corps.split('\n');
  const [debut, fin] = bornes(lignes);
  const cellule = celluleDArmes(nouveau);
  for (let i = debut + 1; i < fin; i++) {
    const l = lignes[i];
    const titre = /^(#{2,6} (?:Ligne|Colonne) : )(.+)$/.exec(l);
    if (titre && cleDeCase(titre[2]) === cle) lignes[i] = `${titre[1]}${nouveau}`;
    else if (l.startsWith('|') && !/^\|[\s:|-]+\|$/.test(l)) {
      // cases d'une ligne de tableau (séparées par « | » non échappé)
      const cases = l.split(/(?<!\\)\|/);
      lignes[i] = cases.map((c, k) => (k > 0 && k < cases.length - 1 && cleDeCase(c.replace(/\\\|/g, '|')) === cle ? ` ${cellule} ` : c)).join('|');
    }
  }
  return lignes.join('\n');
}
