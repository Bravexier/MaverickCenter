// Corps des pages « Armures » et « Bouclier » (page.corps_md de ressources/armures et ressources/bouclier) suivi depuis les tables : l'édition du site de
// dev (serveur/edition-armures.mjs) et le rejeu du journal (serveur/edition.mjs#recalculerLesPages) y réécrivent la ligne Markdown d'une armure, d'une
// pièce d'armure (tableau FABRICATION), d'une forme ou d'un poids de bouclier, d'un bouclier préfabriqué, d'une amélioration et la ligne TOTAL. Ces corps
// ne s'affichent pas (la page est rendue depuis les tables : components/armures/ArmuresPage.astro) ; ils servent à la recherche (page_fts,
// search-index.json) et aux [[liens]]. Les tableaux des matériaux suivent la page « Composants » (lib/corps-composants.mjs, décision R62) et le nom d'un
// matériau celle des armes (lib/corps-armes.mjs#corpsAvecMateriauRenomme) : rien ici n'y touche.
//
// Stratégie : REMPLACEMENT DE LIGNES, comme lib/corps-armes.mjs. Chaque ligne se rend depuis sa ligne de la base comme l'importeur
// (tools/sheets/equipement.py : cell_md, esc_text) l'a écrite, sauf les cases que le site ne modifie pas : les matières en tête d'une ligne d'armure
// (« Ligne », « Colonne », que le renommage d'un matériau réécrit), la matière d'un bouclier, la colonne d'une armure particulière. On cherche la ligne
// d'avant dans sa section (une armure, un bouclier : par la fin de sa ligne, unique ; une pièce : par son rang dans le tableau ; une amélioration : par son
// niveau) et on la remplace ; test/corps-armures.test.mjs retrouve chaque ligne de la base dans son corps. Une ligne introuvable lève
// ErreurCorpsArmures : le service refuse le lot plutôt que de laisser le corps en retard. Ni création ni suppression (les fiches de personnage citent
// les armures, les pièces et les améliorations). Fonctions pures ; les identifiants des deux pages viennent de lib/corps-composants.mjs.

import { PAGE_DES_ARMURES, PAGE_DES_BOUCLIERS } from './corps-composants.mjs';

export { PAGE_DES_ARMURES, PAGE_DES_BOUCLIERS };

/** Tables dont une ligne a sa ligne dans le corps d'une des deux pages (dans l'ordre où le rejeu les applique). */
export const TABLES_DES_PAGES_DES_ARMURES = ['armure', 'armure_emplacement', 'bouclier_classe', 'bouclier', 'bouclier_poids', 'amelioration_equipement', 'amelioration_total'];

export class ErreurCorpsArmures extends Error {
  constructor(message) {
    super(message);
    this.name = 'ErreurCorpsArmures';
  }
}

/** La page dont le corps écrit cette ligne ; null pour une amélioration d'une autre cible (arme, pièce élémentaire : pages des armes, des pièces). */
export function pageDeLaLigne(table, ligne) {
  if (!ligne) return null;
  if (table === 'amelioration_equipement' || table === 'amelioration_total') {
    return ligne.cible === 'armure' ? PAGE_DES_ARMURES : ligne.cible === 'bouclier' ? PAGE_DES_BOUCLIERS : null;
  }
  if (table === 'armure' || table === 'armure_emplacement') return PAGE_DES_ARMURES;
  if (['bouclier_classe', 'bouclier', 'bouclier_poids'].includes(table)) return PAGE_DES_BOUCLIERS;
  return null;
}

/** Un texte échappé comme le fait l'importeur (esc_text : barre oblique inverse, `*_[]<~` et `&` d'une entité). */
const echappe = (texte) => String(texte).replace(/\\/g, '\\\\').replace(/([`*_[\]<~])/g, '\\$1').replace(/&(?=#?\w+;)/g, '\\&');

/** Une case de tableau (cell_md de l'importeur) : lignes sans espaces de bord, échappées, jointes par <br>, « | » échappé. */
const cellule = (valeur) =>
  valeur === null || valeur === undefined
    ? ''
    : String(valeur).replace(/\r\n?/g, '\n').split('\n').map((l) => echappe(l.trim())).join('<br>').replace(/\|/g, '\\|');

/** La fin de la ligne d'une armure, à partir de son nom (les matières de la grille ou la colonne d'une armure particulière la précèdent). */
export function finDeLigneDArmure(a) {
  const cases = a.sorte === 'particuliere'
    ? [a.nom, a.prix_brut, a.type, a.stats_brut, a.solidite, a.effet]
    : [a.nom, a.prix_brut, a.type, a.stats_brut, a.solidite, a.resistance_brut, a.faiblesse_brut];
  return `| ${cases.map(cellule).join(' | ')} |`;
}

/** La fin de la ligne d'un bouclier préfabriqué, à partir de son nom (sa matière la précède). */
export const finDeLigneDeBouclier = (b) => `| ${[b.nom, b.prix_brut, b.defense_brut].map(cellule).join(' | ')} |`;

/** La ligne d'une pièce du tableau FABRICATION : « | Casque | 100 RF / 1 R0 | ». */
export const ligneDePiece = (p) => `| ${cellule(p.nom)} | ${cellule(p.cout_brut)} |`;

/** La ligne d'une forme (classe) de bouclier : « | Bocle | 2,5 | Classe 1 | ». */
export const ligneDeForme = (f) => `| ${cellule(f.nom)} | ${cellule(f.prix_brut)} | ${cellule(f.categorie_brut)} |`;

/** La puce d'un poids de bouclier : « - Léger : 1 de Force minimum ». */
export const ligneDePoids = (p) => `- ${echappe(p.nom ?? '')} : ${echappe(p.force_brut ?? '')}`;

/** La ligne d'une amélioration : « | +2 | 100 + 1 Matériau | +4 AP/AM | ». */
export const ligneDAmelioration = (a) => `| +${a.niveau} | ${cellule(a.cout_brut)} | ${cellule(a.effet_brut)} |`;

/** La ligne TOTAL d'un tableau d'améliorations. */
export const ligneDuTotal = (total) => `**TOTAL** : ${cellule(total)}`;

const TITRES = {
  combinaisons: '## Armures par combinaison de matières',
  particulieres: '## Armures particulières',
  fabrication: '## FABRICATION',
  ameliorations: '## AMÉLIORATION',
  formes: '## Classes de boucliers',
  boucliers: '## Boucliers par classe et par matière',
};

/** Bornes [début, fin[ (indices de lignes) de la section qui commence par le titre `titre`, jusqu'au titre « ## » suivant. */
function section(lignes, titre) {
  const debut = lignes.findIndex((l) => l === titre);
  if (debut < 0) throw new ErreurCorpsArmures(`section introuvable : ${titre}`);
  let fin = lignes.findIndex((l, i) => i > debut && /^## /.test(l));
  if (fin < 0) fin = lignes.length;
  return [debut, fin];
}

/** L'indice de l'unique ligne de la section qui vérifie `test` ; ErreurCorpsArmures si aucune ou plusieurs. */
function uniqueDansSection(lignes, titre, test, quoi) {
  const [debut, fin] = section(lignes, titre);
  const trouvees = [];
  for (let k = debut + 1; k < fin; k++) if (test(lignes[k])) trouvees.push(k);
  if (trouvees.length !== 1) throw new ErreurCorpsArmures(`${trouvees.length ? 'ligne en double' : 'ligne introuvable'} : ${quoi}`);
  return trouvees[0];
}

/** Les lignes de données d'un tableau Markdown de la section (sans l'en-tête ni la ligne de séparation). */
function lignesDuTableau(lignes, titre) {
  const [debut, fin] = section(lignes, titre);
  const tableau = [];
  for (let k = debut + 1; k < fin; k++) if (lignes[k].startsWith('|')) tableau.push(k);
  return tableau.slice(2);
}

/** Remplace la fin `avant` (unique dans la section) de sa ligne par `apres`. */
function remplacerLaFin(lignes, titre, avant, apres, quoi) {
  const k = uniqueDansSection(lignes, titre, (l) => l.endsWith(avant) && (l === avant || l.slice(0, -avant.length).endsWith(' ')), quoi);
  lignes[k] = lignes[k].slice(0, lignes[k].length - avant.length) + apres;
}

/**
 * Le corps d'une des deux pages après la modification d'une ligne de `table` (`avant`, `apres` : la ligne avant et après ; ni création ni suppression :
 * les deux sont donnés ; une pièce d’armure se retrouve par son rang dans le tableau FABRICATION, armure_emplacement.ordre). Rend le corps (inchangé si la
 * ligne rendue ne change pas) ; ErreurCorpsArmures si la ligne d'avant n'est pas dans le corps.
 */
export function corpsDesArmuresApres(corps, table, avant, apres) {
  if (!avant || !apres) throw new ErreurCorpsArmures(`${table} : ni création ni suppression dans les pages des armures et des boucliers`);
  const lignes = String(corps ?? '').split('\n');
  switch (table) {
    case 'armure': {
      const titre = avant.sorte === 'particuliere' ? TITRES.particulieres : TITRES.combinaisons;
      remplacerLaFin(lignes, titre, finDeLigneDArmure(avant), finDeLigneDArmure(apres), `armure ${avant.nom}`);
      break;
    }
    case 'bouclier':
      remplacerLaFin(lignes, TITRES.boucliers, finDeLigneDeBouclier(avant), finDeLigneDeBouclier(apres), `bouclier ${avant.nom}`);
      break;
    case 'armure_emplacement': {
      // rien de visible n'a changé : la ligne reste telle que l'importeur l'a écrite (« Jambe Droite » quand la base écrit « Jambe Droit »)
      if (ligneDePiece(avant) === ligneDePiece(apres)) return corps;
      const k = lignesDuTableau(lignes, TITRES.fabrication)[avant.ordre - 1];
      const cout = (l) => l.slice(l.lastIndexOf(' | ', l.length - 3) + 3, -2);
      if (k === undefined || cout(lignes[k]) !== cellule(avant.cout_brut)) throw new ErreurCorpsArmures(`ligne introuvable : pièce ${avant.nom}`);
      lignes[k] = ligneDePiece(apres);
      break;
    }
    case 'bouclier_classe': {
      const k = uniqueDansSection(lignes, TITRES.formes, (l) => l === ligneDeForme(avant), `forme ${avant.nom}`);
      lignes[k] = ligneDeForme(apres);
      // le titre de son tableau dans « Boucliers par classe et par matière » (les noms des boucliers ne suivent pas : comme ceux des armures)
      if (avant.nom !== apres.nom) {
        const t = uniqueDansSection(lignes, TITRES.boucliers, (l) => l === `### ${echappe(avant.nom)}`, `titre de la forme ${avant.nom}`);
        lignes[t] = `### ${echappe(apres.nom)}`;
      }
      break;
    }
    case 'bouclier_poids': {
      const k = uniqueDansSection(lignes, TITRES.fabrication, (l) => l === ligneDePoids(avant), `poids ${avant.nom}`);
      lignes[k] = ligneDePoids(apres);
      break;
    }
    case 'amelioration_equipement': {
      // rien de visible n'a changé : la ligne reste telle que l'importeur l'a écrite (« 100.0 » quand la base écrit « 100 »)
      if (ligneDAmelioration(avant) === ligneDAmelioration(apres)) return corps;
      const k = uniqueDansSection(lignes, TITRES.ameliorations, (l) => l.startsWith(`| +${avant.niveau} | `), `amélioration +${avant.niveau}`);
      lignes[k] = ligneDAmelioration(apres);
      break;
    }
    case 'amelioration_total': {
      const k = uniqueDansSection(lignes, TITRES.ameliorations, (l) => l.startsWith('**TOTAL** : '), `TOTAL (${avant.cible})`);
      lignes[k] = ligneDuTotal(apres.total_brut);
      break;
    }
    default:
      throw new ErreurCorpsArmures(`table ${table} : pas dans les pages des armures et des boucliers`);
  }
  return lignes.join('\n');
}
