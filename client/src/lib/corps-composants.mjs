// Corps Markdown des pages qui écrivent les composants (page.corps_md), suivi depuis les tables quand la page « Composants » (/ressources/composants/)
// les modifie sur le site de dev (serveur/edition-composants.mjs) et au rejeu du journal (serveur/edition.mjs#recalculerLesPages) :
//   - « Équipement inventaire » (ressources/equipement-inventaire, rendue depuis son Markdown) : la liste MONNAIE et le CONVERTISSEUR, refaits depuis la
//     table monnaie ; la ligne de chaque objet (produits non monétaires, matos) dans le tableau de sa section, ajoutée à la fin ou retirée avec lui ;
//   - « Armures » : le type d'un matériau dans les fiches des matières de la grille (décision R62) ;
//   - « Armures » et « Bouclier » : le prix et la description d'un matériau dans leur tableau « MATÉRIAUX » (son nom : lib/corps-armes.mjs#corpsAvecMateriauRenomme,
//     appelé par l'édition des armes) ; « Accessoires » : son nom dans le tableau « Monture » ;
//   - « Bâton magique » et « Accessoires » : le nom, la description et les prix d'une gemme dans leur tableau des gemmes (gemme entière, quart de gemme) ;
//     une gemme renommée l'est aussi dans les cases « A + B » des effets d'accessoire (tableaux de « Accessoires ») ; « Bâton magique » : le nom, la
//     description et le prix d'un bois ;
//   - « Liste d'ingrédients » (ressources/alchimie-liste-ingredients) : la ligne de chaque ingrédient d'alchimie (Ingrédient | Type | Affinité) dans le
//     tableau de sa catégorie, ajoutée à la fin ou retirée avec lui.
// Stratégie : REMPLACEMENT DE CASES, comme lib/corps-armes.mjs. La ligne est trouvée par la case de son nom (à la casse, aux accents et aux espaces près) ;
// une case ne change que si elle écrit exactement l'ancienne valeur (une page qui l'écrit autrement la garde). Une ligne d'objet de l'onglet introuvable
// lève ErreurCorpsComposants (le service refuse le lot plutôt que de laisser le corps en retard) ; un matériau ou une gemme créés depuis le site n'ont pas de
// ligne dans les pages de l'armurerie ou des bâtons : rien n'y change. test/corps-composants.test.mjs retrouve chaque composant de la base dans son corps.
// Fonctions pures, sans dépendance (sauf lib/composants-champs.mjs, pur).
import { conversionsDe, milliers } from './composants-champs.mjs';

export const PAGE_DE_L_INVENTAIRE = 'ressources/equipement-inventaire';
export const PAGE_DES_ARMURES = 'ressources/armures';
export const PAGE_DES_BOUCLIERS = 'ressources/bouclier';
export const PAGE_DES_BATONS = 'ressources/baton-magique';
export const PAGE_DES_ACCESSOIRES = 'ressources/accessoires';
export const PAGE_DES_INGREDIENTS = 'ressources/alchimie-liste-ingredients';

/** Les catégories d'ingrédients d'alchimie (ingredient_alchimie.categorie) : section de leurs ressources et titre de leur tableau dans le corps. */
export const CATEGORIES_D_INGREDIENTS = Object.freeze([
  { categorie: 'solvant', section: 'Solvant' },
  { categorie: 'essence', section: 'Essence' },
  { categorie: 'amplificateur', section: 'Amplificateur' },
  { categorie: 'catalyseur', section: 'Catalyseur' },
  { categorie: 'stabilisateur', section: 'Stabilisateur' },
]);

/**
 * Les tableaux de l'onglet « Équipement inventaire » (une section du corps chacun, dans l'ordre de l'onglet) : genre et section de leurs ressources,
 * titre de leur section dans le corps, et s'ils ont une colonne Description (les matos) ou non (les produits non monétaires).
 */
export const SECTIONS_DE_L_INVENTAIRE = Object.freeze([
  { genre: 'produit', section: 'VÉGÉTAUX', titre: '### VÉGÉTAUX', groupe: 'Produits non monétaires', description: false },
  { genre: 'produit', section: 'ANIMAUX', titre: '### ANIMAUX', groupe: 'Produits non monétaires', description: false },
  { genre: 'produit', section: 'AUTRES', titre: '### AUTRES', groupe: 'Produits non monétaires', description: false },
  { genre: 'materiel', section: 'MATOS AVENTURES', titre: '## MATOS AVENTURES', groupe: null, description: true },
  { genre: 'materiel', section: 'MATOS FABRICATION', titre: '## MATOS FABRICATION', groupe: null, description: true },
  { genre: 'materiel', section: 'MATOS PROJECTILE', titre: '## MATOS PROJECTILE', groupe: null, description: true },
]);

/** La section de l'onglet d'une ressource (genre et section), ou null. */
export const sectionDeLInventaire = (r) => SECTIONS_DE_L_INVENTAIRE.find((s) => s.genre === r?.genre && s.section === r?.section) ?? null;

/** Tables dont une ligne touche ces corps (recalculerLesPages, dans cet ordre). */
export const TABLES_DES_COMPOSANTS = ['monnaie', 'ressource', 'materiau', 'gemme', 'ingredient_alchimie'];

export class ErreurCorpsComposants extends Error {
  constructor(message) {
    super(message);
    this.name = 'ErreurCorpsComposants';
  }
}

/** Une case de tableau : lignes jointes par <br>, « | » échappé ; une adresse web seule entre chevrons (l'importeur l'écrit ainsi). */
export function celluleDeComposant(valeur) {
  const texte = String(valeur ?? '').replace(/\r\n?/g, '\n').split('\n').map((l) => l.trim()).join('<br>').replace(/\|/g, '\\|');
  return /^https?:\/\/\S+$/.test(texte) ? `<${texte}>` : texte;
}

/** Clé de comparaison d'un nom écrit dans une case (« Sac de bombe<br>(5) » = « Sac de bombe (5) », « Fer Noir » = « Fer noir »). */
export const cleDeCase = (t) =>
  String(t ?? '').replace(/<br>/g, ' ').replace(/\\\|/g, '|').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ').trim();

/** La ligne d'un objet de l'onglet : Nom | Prix (| Description). */
export const ligneDObjet = (r, avecDescription) =>
  `| ${celluleDeComposant(r.nom)} | ${celluleDeComposant(r.prix_brut)} |${avecDescription ? ` ${celluleDeComposant(r.description)} |` : ''}`;

const estUneLigneDeTableau = (l) => l.startsWith('|') && !/^\|[\s:|-]+\|$/.test(l);
/** Les cases d'une ligne de tableau, découpée sur les « | » non échappés (la première et la dernière, vides, comprises). */
const cases = (l) => l.split(/(?<!\\)\|/);

/** Bornes [début, fin[ de la section dont le titre est `titre`, jusqu'au titre suivant de même niveau ou plus haut ; null si absente. */
function bornesDe(lignes, titre) {
  const debut = lignes.indexOf(titre);
  if (debut < 0) return null;
  const niveau = /^#+/.exec(titre)[0].length;
  let fin = lignes.findIndex((l, i) => i > debut && new RegExp(`^#{1,${niveau}} `).test(l));
  if (fin < 0) fin = lignes.length;
  return [debut, fin];
}

/** L'indice de la ligne de tableau de la section dont la case `colonne` (1 = la première) écrit l'un des `noms` ; -1 sinon. */
function indiceDeLigne(lignes, [debut, fin], colonne, noms) {
  const cles = noms.filter(Boolean).map(cleDeCase);
  for (let i = debut + 1; i < fin; i++) {
    if (!estUneLigneDeTableau(lignes[i])) continue;
    const c = cases(lignes[i]);
    if (c.length > colonne + 1 && cles.includes(cleDeCase(c[colonne]))) return i;
  }
  return -1;
}

/**
 * Réécrit, dans la ligne `i`, chaque case { colonne, avant, apres } qui écrit exactement `avant` (rendu en case) ; les autres cases restent.
 * `force` : la case prend `apres` quoi qu'elle écrive (la ligne de l'objet, dont toutes les cases viennent de sa ligne de la base).
 */
function reecrireCases(lignes, i, changements, { force = false } = {}) {
  const c = cases(lignes[i]);
  for (const { colonne, avant, apres } of changements) {
    if (colonne >= c.length - 1) continue;
    if (force || c[colonne].trim() === celluleDeComposant(avant)) c[colonne] = ` ${celluleDeComposant(apres)} `;
  }
  lignes[i] = c.join('|');
}

/** Les colonnes changées entre deux lignes, parmi `colonnes` ({ colonne de la base: case du tableau }). */
const changements = (avant, apres, colonnes) =>
  Object.entries(colonnes)
    .filter(([col]) => (avant[col] ?? null) !== (apres[col] ?? null))
    .map(([col, colonne]) => ({ colonne, avant: avant[col], apres: apres[col] }));

/** La liste MONNAIE (« - Ricken de fer : RF ») et le CONVERTISSEUR (« - 1 PP : 1 000 RO »), refaits depuis la table monnaie (par valeur croissante). */
export function corpsAvecMonnaies(corps, monnaies) {
  const lignes = corps.split('\n');
  const ordre = [...monnaies].sort((a, b) => a.valeur_rf - b.valeur_rf);
  const remplacerPuces = (titre, puces) => {
    const b = bornesDe(lignes, titre);
    if (!b) throw new ErreurCorpsComposants(`section introuvable : ${titre}`);
    let [debut, fin] = b;
    const sousTitre = lignes.findIndex((l, i) => i > debut && i < fin && /^#/.test(l));
    if (sousTitre > 0) fin = sousTitre;
    const premiere = lignes.findIndex((l, i) => i > debut && i < fin && l.startsWith('- '));
    if (premiere < 0) throw new ErreurCorpsComposants(`liste introuvable : ${titre}`);
    let derniere = premiere;
    while (derniere + 1 < fin && lignes[derniere + 1].startsWith('- ')) derniere++;
    lignes.splice(premiere, derniere - premiere + 1, ...puces);
  };
  remplacerPuces('## MONNAIE', ordre.map((m) => `- ${m.nom} : ${m.abreviation}`));
  remplacerPuces('### CONVERTISSEUR', ordre.flatMap((m) => conversionsDe(m, ordre).map((c) => `- 1 ${m.abreviation} : ${milliers(c.valeur)} ${c.vers.abreviation}`)));
  return lignes.join('\n');
}

/** Une gemme renommée dans les cases d'un corps qui l'écrivent seule ou dans une combinaison (« Ambre + Grenat », « Grenat/Malachite », « A ou B »). */
export function corpsAvecGemmeRenommee(corps, ancien, nouveau, bornes = (lignes) => [-1, lignes.length]) {
  const cle = cleDeCase(ancien);
  if (!cle || ancien === nouveau) return corps;
  const lignes = corps.split('\n');
  const [debut, fin] = bornes(lignes) ?? [-1, -1];
  const cellule = celluleDeComposant(nouveau);
  for (let i = debut + 1; i < fin; i++) {
    if (!estUneLigneDeTableau(lignes[i])) continue;
    const c = cases(lignes[i]);
    lignes[i] = c.map((x, k) => {
      if (k === 0 || k === c.length - 1) return x;
      const morceaux = x.split(/(\s*\+\s*|\s*\/\s*|\s+ou\s+\+?\s*)/);
      if (!morceaux.some((m, j) => j % 2 === 0 && cleDeCase(m) === cle)) return x;
      return morceaux.map((m, j) => (j % 2 === 0 && cleDeCase(m) === cle ? m.replace(m.trim(), cellule) : m)).join('');
    }).join('|');
  }
  return lignes.join('\n');
}

/** Un matériau renommé dans les cases d'une section (le tableau « Monture » des accessoires). */
function corpsAvecNomDansSection(corps, titre, ancien, nouveau) {
  const lignes = corps.split('\n');
  const b = bornesDe(lignes, titre);
  if (!b || ancien === nouveau) return corps;
  for (let i = b[0] + 1; i < b[1]; i++) {
    if (!estUneLigneDeTableau(lignes[i])) continue;
    const c = cases(lignes[i]);
    lignes[i] = c.map((x, k) => (k > 0 && k < c.length - 1 && cleDeCase(x) === cleDeCase(ancien) ? ` ${celluleDeComposant(nouveau)} ` : x)).join('|');
  }
  return lignes.join('\n');
}

/** Les tableaux des gemmes : page → { titre de la section, colonnes de la base → case }. */
const TITRE_DES_BATONS = '## MATÉRIAUX NÉCESSAIRES PAR MAGIE';
const TABLEAUX_DES_GEMMES = {
  [PAGE_DES_BATONS]: { titre: TITRE_DES_BATONS, ressource: { nom: 2, description: 3 }, gemme: { prix_commune_brut: 4, prix_raffinee_brut: 5, prix_parfaite_brut: 6 } },
  [PAGE_DES_ACCESSOIRES]: { titre: '## Gemme précieuse', ressource: { nom: 2, description: 3 }, gemme: { quart_commune_brut: 4, quart_raffinee_brut: 5, quart_parfaite_brut: 6 } },
};
/** Le tableau « MATÉRIAUX » des armures et des boucliers : prix et description (le nom suit lib/corps-armes.mjs#corpsAvecMateriauRenomme). */
const TABLEAU_DES_MATERIAUX = { titre: '## MATÉRIAUX', ressource: { prix_brut: 2, description: 3 } };

/**
 * Les pages dont le corps écrit une ligne de ces tables : une monnaie et un objet de l'onglet → « Équipement inventaire » ; un matériau → Armures,
 * Bouclier, Accessoires ; une gemme → Bâton magique, Accessoires.
 */
export function pagesDuComposant(table, ligne) {
  if (table === 'monnaie') return [PAGE_DE_L_INVENTAIRE];
  if (table === 'gemme') return [PAGE_DES_BATONS, PAGE_DES_ACCESSOIRES];
  if (table === 'ingredient_alchimie') return [PAGE_DES_INGREDIENTS];
  if (table === 'materiau') return [PAGE_DES_ARMURES];
  if (table !== 'ressource' || !ligne) return [];
  if (sectionDeLInventaire(ligne)) return [PAGE_DE_L_INVENTAIRE];
  if (ligne.genre === 'ingredient_alchimie') return [PAGE_DES_INGREDIENTS];
  if (ligne.genre === 'bois') return [PAGE_DES_BATONS];
  if (ligne.genre === 'materiau') return [PAGE_DES_ARMURES, PAGE_DES_BOUCLIERS, PAGE_DES_ACCESSOIRES];
  if (ligne.genre === 'gemme') return [PAGE_DES_BATONS, PAGE_DES_ACCESSOIRES];
  return [];
}

/**
 * Le corps de la page `pageId` après la modification (ou la création : `avant` null, ou la suppression : `apres` null) d'une ligne de monnaie,
 * ressource, gemme ou ingrédient d'alchimie. `contexte` : { monnaies: () => lignes monnaie (après la modification), ressource: (id) => ligne ressource }.
 * Un ingrédient créé s'écrit à la création de sa ligne ingredient_alchimie (son type et son affinité), supprimé à la suppression de sa ressource (son nom).
 */
export function corpsDuComposantApres(pageId, corps, table, avant, apres, contexte) {
  const ligne = apres ?? avant;
  if (table === 'monnaie') return pageId === PAGE_DE_L_INVENTAIRE ? corpsAvecMonnaies(corps, contexte.monnaies()) : corps;
  const lignes = corps.split('\n');
  const ingredient = table === 'ingredient_alchimie' || (table === 'ressource' && ligne.genre === 'ingredient_alchimie');
  if (ingredient && pageId === PAGE_DES_INGREDIENTS) {
    const r = table === 'ressource' ? ligne : contexte.ressource(ligne.ressource_id);
    const c = CATEGORIES_D_INGREDIENTS.find((x) => x.section === r?.section || x.categorie === ligne.categorie);
    if (!c) throw new ErreurCorpsComposants(`catégorie d’ingrédient inconnue : ${r?.section ?? ligne.categorie}`);
    const b = bornesDe(lignes, `## ${c.section}`);
    if (!b) throw new ErreurCorpsComposants(`section introuvable : ${c.section}`);
    if (table === 'ingredient_alchimie' && !avant) {
      let derniere = -1;
      for (let k = b[0] + 1; k < b[1]; k++) if (lignes[k].startsWith('|')) derniere = k;
      if (derniere < 0) throw new ErreurCorpsComposants(`tableau introuvable : ${c.section}`);
      lignes.splice(derniere + 1, 0, `| ${celluleDeComposant(r.nom)} | ${celluleDeComposant(apres.type_brut)} | ${celluleDeComposant(apres.affinite_brut)} |`);
      return lignes.join('\n');
    }
    if (!avant || !apres) {
      if (table === 'ingredient_alchimie') return corps; // la ligne part avec la ressource
      if (!avant) return corps; // la ligne s'écrit avec l'ingrédient
    }
    const nom = table === 'ressource' ? avant.nom : r.nom;
    const i = indiceDeLigne(lignes, b, 1, [nom]);
    if (i < 0) throw new ErreurCorpsComposants(`ligne introuvable : ${c.section} › ${nom}`);
    if (!apres) lignes.splice(i, 1);
    else reecrireCases(lignes, i, changements(avant, apres, table === 'ressource' ? { nom: 1 } : { type_brut: 2, affinite_brut: 3 }), { force: true });
    return lignes.join('\n');
  }
  if (ingredient) return corps;
  if (table === 'ressource' && pageId === PAGE_DE_L_INVENTAIRE) {
    const s = sectionDeLInventaire(ligne);
    if (!s) return corps;
    const b = bornesDe(lignes, s.titre);
    if (!b) throw new ErreurCorpsComposants(`section introuvable : ${s.titre}`);
    if (!avant) {
      // un objet créé : à la fin du tableau de sa section
      let derniere = -1;
      for (let k = b[0] + 1; k < b[1]; k++) if (lignes[k].startsWith('|')) derniere = k;
      if (derniere < 0) throw new ErreurCorpsComposants(`tableau introuvable : ${s.titre}`);
      lignes.splice(derniere + 1, 0, ligneDObjet(apres, s.description));
      return lignes.join('\n');
    }
    const i = indiceDeLigne(lignes, b, 1, [avant.nom]);
    if (i < 0) throw new ErreurCorpsComposants(`ligne introuvable : ${s.section} › ${avant.nom}`);
    if (!apres) lignes.splice(i, 1);
    else reecrireCases(lignes, i, changements(avant, apres, { nom: 1, prix_brut: 2, ...(s.description ? { description: 3 } : {}) }), { force: true });
    return lignes.join('\n');
  }
  if (!avant || !apres) return corps; // un matériau ou une gemme créés (ou supprimés) depuis le site : pas de ligne dans ces pages
  if (table === 'ressource' && ligne.genre === 'materiau') {
    if (pageId === PAGE_DES_ACCESSOIRES) return avant.nom === apres.nom ? corps : corpsAvecNomDansSection(corps, '## Monture', avant.nom, apres.nom);
    if (pageId !== PAGE_DES_ARMURES && pageId !== PAGE_DES_BOUCLIERS) return corps;
    const b = bornesDe(lignes, TABLEAU_DES_MATERIAUX.titre);
    const i = b ? indiceDeLigne(lignes, b, 1, [apres.nom, avant.nom]) : -1;
    if (i < 0) return corps;
    reecrireCases(lignes, i, changements(avant, apres, TABLEAU_DES_MATERIAUX.ressource));
    return lignes.join('\n');
  }
  // le type d'un matériau (décision R62) : sa case « Type » des fiches des matières de la grille des armures
  if (table === 'materiau') {
    if (pageId !== PAGE_DES_ARMURES) return corps;
    const b = bornesDe(lignes, '## Fiches des matières de la grille');
    const i = b ? indiceDeLigne(lignes, b, 1, [contexte.ressource(apres.ressource_id)?.nom]) : -1;
    if (i < 0) return corps;
    reecrireCases(lignes, i, changements(avant, apres, { type: 3 }));
    return lignes.join('\n');
  }
  if (table === 'ressource' && ligne.genre === 'bois') {
    if (pageId !== PAGE_DES_BATONS) return corps;
    const b = bornesDe(lignes, TITRE_DES_BATONS);
    const i = b ? indiceDeLigne(lignes, b, 7, [avant.nom]) : -1;
    if (i < 0) return corps;
    reecrireCases(lignes, i, changements(avant, apres, { nom: 7, description: 8, prix_brut: 9 }));
    return lignes.join('\n');
  }
  const tableau = TABLEAUX_DES_GEMMES[pageId];
  if (!tableau) return corps;
  const b = bornesDe(lignes, tableau.titre);
  if (table === 'ressource' && ligne.genre === 'gemme') {
    const i = b ? indiceDeLigne(lignes, b, 2, [avant.nom]) : -1;
    if (i >= 0) reecrireCases(lignes, i, changements(avant, apres, tableau.ressource));
    const sortie = lignes.join('\n');
    // les effets d'accessoire citent les gemmes par leur nom (« Ambre + Grenat »)
    return pageId === PAGE_DES_ACCESSOIRES ? corpsAvecGemmeRenommee(sortie, avant.nom, apres.nom) : sortie;
  }
  if (table === 'gemme') {
    const nom = contexte.ressource(apres.ressource_id)?.nom;
    const i = b ? indiceDeLigne(lignes, b, 2, [nom]) : -1;
    if (i < 0) return corps;
    reecrireCases(lignes, i, changements(avant, apres, tableau.gemme));
    return lignes.join('\n');
  }
  return corps;
}
