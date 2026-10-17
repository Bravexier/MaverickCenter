// Corps Markdown de la page d'une potion (page.corps_md de la page de sa ressource, `ressource.page_id` : « Fiole rouge », « Alchimie primitive »…), suivi
// depuis les tables quand le sous-onglet Consommables de l'onglet Ceinture de /ressources/equipement/ les modifie sur le site de dev
// (serveur/edition-consommables.mjs) et au rejeu du journal (serveur/edition.mjs#recalculerLesPages). La page, rendue depuis son Markdown, écrit chaque
// palier dans un tableau à lui (Google Doc « Alchimie ») :
//   | Petite fiole rouge |  |  |
//   | :-: | :-: | :-: |
//   | Prix | Niveau | Effet |
//   | 2 Ro | Novice | Récupère 2d8 + 5 santé |
// le nom de la potion (ressource.nom) dans la première case de la première ligne ; son prix (ressource.prix_brut), le nom de son niveau d'alchimie
// (potion.niveau_id → niveau_alchimie.nom) et son effet (potion.effet, ses lignes jointes par <br>) dans la ligne qui suit « Prix | Niveau | Effet ».
// Stratégie : REMPLACEMENT DE CASES, comme lib/corps-composants.mjs. Le tableau est trouvé par la case de son nom (à la casse, aux accents et aux espaces
// près : cleDeCase) ; toutes ses cases viennent de la ligne de la potion, une colonne changée réécrit sa case. Un tableau introuvable, ou d'une autre forme,
// lève ErreurCorpsPotions (le service refuse le lot plutôt que de laisser le corps en retard). Ni création ni suppression de potion depuis le site.
// test/corps-potions.test.mjs retrouve chaque potion de la base, ses quatre valeurs comprises, dans le corps de sa page.
// Fonctions pures, sans dépendance (sauf lib/corps-composants.mjs, pur).
import { cleDeCase } from './corps-composants.mjs';

/** Tables dont une ligne touche le corps d'une page de potion (recalculerLesPages, dans cet ordre : le nom d'abord, qui désigne le tableau). */
export const TABLES_DES_POTIONS = ['ressource', 'potion'];

/** La ligne d'en-têtes de la ligne de valeurs d'un palier. */
const ENTETES = ['Prix', 'Niveau', 'Effet'];

export class ErreurCorpsPotions extends Error {
  constructor(message) {
    super(message);
    this.name = 'ErreurCorpsPotions';
  }
}

/** Une case de tableau : lignes jointes par <br>, « | » échappé (l'écriture de l'import, celle de lib/corps-composants.mjs). */
export const celluleDePotion = (valeur) =>
  String(valeur ?? '').replace(/\r\n?/g, '\n').split('\n').map((l) => l.trim()).join('<br>').replace(/\|/g, '\\|');

/** Les cases d'une ligne de tableau, découpée sur les « | » non échappés (la première et la dernière, vides, comprises). */
const cases = (l) => l.split(/(?<!\\)\|/);
const estUneLigneDeTableau = (l) => l.startsWith('|');
const estUnSeparateur = (l) => /^\|[\s:|-]+\|$/.test(l);

/** La ressource d'une potion est-elle en cause (une ligne de ressource d'un autre genre ne touche aucune page de potion) ? */
export const estUnePotion = (table, ligne) => (table === 'potion' ? Boolean(ligne) : table === 'ressource' && ligne?.genre === 'potion');

/** L'id de la page qui écrit la potion d'une ligne (ressource ou potion), ou null. `contexte.ressource(id)` : la ligne ressource. */
export function pageDeLaPotion(table, ligne, contexte) {
  if (!estUnePotion(table, ligne)) return null;
  return (table === 'ressource' ? ligne : contexte.ressource(ligne.ressource_id))?.page_id ?? null;
}

/**
 * Le tableau du palier `nom` dans les lignes d'un corps : { entete, valeurs } (indices de la ligne du nom et de la ligne de valeurs), ou null s'il n'y
 * en a pas ; lève ErreurCorpsPotions si plusieurs tableaux portent ce nom ou si le tableau n'a pas la forme « Prix | Niveau | Effet ».
 */
export function tableauDuPalier(lignes, nom) {
  const cle = cleDeCase(nom);
  const debuts = [];
  for (let i = 0; i < lignes.length; i++) {
    if (!estUneLigneDeTableau(lignes[i]) || (i > 0 && estUneLigneDeTableau(lignes[i - 1]))) continue;
    const c = cases(lignes[i]);
    if (c.length > 2 && cleDeCase(c[1]) === cle) debuts.push(i);
  }
  if (!debuts.length) return null;
  if (debuts.length > 1) throw new ErreurCorpsPotions(`plusieurs tableaux « ${nom} »`);
  const entete = debuts[0];
  let fin = entete;
  while (fin + 1 < lignes.length && estUneLigneDeTableau(lignes[fin + 1])) fin++;
  const titres = lignes.findIndex((l, i) => i > entete && i <= fin && !estUnSeparateur(l) && cases(l).slice(1, -1).map((x) => x.trim()).join('|') === ENTETES.join('|'));
  const valeurs = titres < 0 ? -1 : lignes.findIndex((l, i) => i > titres && i <= fin && !estUnSeparateur(l));
  if (valeurs < 0 || cases(lignes[valeurs]).length !== ENTETES.length + 2) throw new ErreurCorpsPotions(`tableau « ${nom} » : ligne « Prix | Niveau | Effet » introuvable`);
  return { entete, valeurs };
}

/** Réécrit la case `colonne` (1 = la première) de la ligne `i`. */
function reecrire(lignes, i, colonne, valeur) {
  const c = cases(lignes[i]);
  c[colonne] = ` ${celluleDePotion(valeur)} `;
  lignes[i] = c.join('|');
}

const change = (avant, apres, colonne) => (avant?.[colonne] ?? null) !== (apres?.[colonne] ?? null);

/**
 * Le corps d'une page de potion après la modification d'une ligne de ressource (nom, prix) ou de potion (niveau, effet) ; inchangé pour une autre ligne
 * ou si rien de ce que la page écrit n'a changé. `contexte` : { ressource: (id) => ligne ressource (après la modification), niveau: (id) => ligne
 * niveau_alchimie }. Une ligne de potion désigne son tableau par le nom actuel de sa ressource : au rejeu, les lignes de ressource passent d'abord
 * (TABLES_DES_POTIONS).
 */
export function corpsDeLaPotionApres(corps, table, avant, apres, contexte) {
  if (!avant || !apres || !estUnePotion(table, apres)) return corps;
  const colonnes = table === 'ressource' ? ['nom', 'prix_brut'] : ['niveau_id', 'effet'];
  if (!colonnes.some((c) => change(avant, apres, c))) return corps;
  const lignes = String(corps ?? '').split('\n');
  const nom = table === 'ressource' ? avant.nom : contexte.ressource(apres.ressource_id)?.nom;
  const t = tableauDuPalier(lignes, nom);
  if (!t) throw new ErreurCorpsPotions(`tableau introuvable : ${nom}`);
  if (table === 'ressource') {
    if (change(avant, apres, 'nom')) reecrire(lignes, t.entete, 1, apres.nom);
    if (change(avant, apres, 'prix_brut')) reecrire(lignes, t.valeurs, 1, apres.prix_brut);
  } else {
    if (change(avant, apres, 'niveau_id')) {
      const niveau = contexte.niveau(apres.niveau_id);
      if (!niveau) throw new ErreurCorpsPotions(`niveau d’alchimie inconnu : ${apres.niveau_id}`);
      reecrire(lignes, t.valeurs, 2, niveau.nom);
    }
    if (change(avant, apres, 'effet')) reecrire(lignes, t.valeurs, 3, apres.effet);
  }
  return lignes.join('\n');
}
