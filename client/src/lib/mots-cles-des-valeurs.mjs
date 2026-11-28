// Les valeurs fermées de la base que le site affiche comme une balise du glossaire (migration 0125, demande du propriétaire : « Tous les liens communs,
// j'aimerais que tu les lies aux mots clés (ceux du glossaire) », « si ils existent ») : un type de dégâts (taille, estoc, frappe) et une magie. Une seule
// fonction de résolution pour toutes les pages (armes, armures, bestiaire, magies, fiche) : elle lit type_degats.mot_cle_id et magie.mot_cle_id et rend le
// mot-clé dont une balise a besoin (gras, définition en infobulle), ou null — une valeur sans mot-clé (physique, sonore) reste sans lien.
//   - Une magie s'affiche par son nom court (magie.nom : « Feu ») avec l'infobulle de son mot-clé (« Magie du Feu ») : `texte` = le nom court.
//   - feu, eau, glace (une attaque de créature, type_degats.magie_id) sont liés à la magie du même nom : leur lien est celui de la magie, `texte` = son nom court.
//   - taille, estoc, frappe : `texte` = null (la page garde son libellé), le mot-clé est celui de type_degats.mot_cle_id.
// Pur, sans dépendance navigateur ni Astro : la base est passée par l'appelant, qui la lit à chaque appel (le service, dont la base change d'un lot à
// l'autre, n'a donc aucun cache à invalider). Une base d'avant la migration 0125 n'a ni la table ni la colonne : aucun lien.
import { lireUnMotCle } from './mots-cles-db.mjs';
import { classeDuMotCle } from './mots-cles-liens.mjs';

const existe = (db, table) => Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(table));
const aLaColonne = (db, table, colonne) => Boolean(db.prepare('SELECT 1 FROM pragma_table_info(?) WHERE name = ?').get(table, colonne));

/**
 * Le lien d'une valeur fermée avec son mot-clé : { id (du mot-clé), cle (ce que cite une balise : `{{cle}}`, `{{cle|texte}}`), libelle, description (''
 * sans), couleur, classe (la classe de couleur du mot-clé, null sans couleur : lib/mots-cles-liens.mjs#classeDuMotCle), url, icone, texte (le texte à
 * afficher quand il n'est pas celui de la page : le nom court d'une magie ; null sinon), magie_id (la magie, ou null) }.
 */
const lienDe = (m, { texte = null, magie_id = null } = {}) => ({
  id: m.id, cle: m.cle, libelle: m.libelle, description: m.description ?? '', couleur: m.couleur ?? null, classe: classeDuMotCle({ id: m.id, couleur: m.couleur }),
  url: m.url ?? null, icone: m.icone ?? null, texte, magie_id,
});

/**
 * Les liens de toutes les valeurs fermées : { degats: { [type de dégâts]: lien | null }, magies: { [id de magie]: lien | null } } — chaque type de dégâts
 * de type_degats et chaque magie y a sa clé (null sans mot-clé). Un lien est celui de lienDe ci-dessus.
 * @param {import('node:sqlite').DatabaseSync} db
 */
export function liensDesValeursFermees(db) {
  const sortie = { degats: {}, magies: {} };
  if (!existe(db, 'mot_cle') || !existe(db, 'magie') || !aLaColonne(db, 'magie', 'mot_cle_id')) return sortie;
  // le libellé, la définition, la couleur, l'adresse et l'icône d'un mot-clé se lisent sur son élément depuis la migration 0136 (lireUnMotCle)
  const ids = db.prepare('SELECT mot_cle_id FROM magie WHERE mot_cle_id IS NOT NULL'
    + `${existe(db, 'type_degats') ? ' UNION SELECT mot_cle_id FROM type_degats WHERE mot_cle_id IS NOT NULL' : ''}`).all().map((r) => r.mot_cle_id);
  const motsCles = new Map(ids.map((id) => lireUnMotCle(db, id)).filter(Boolean).map((m) => [m.id, m]));
  for (const g of db.prepare('SELECT id, nom, mot_cle_id FROM magie ORDER BY ordre').all()) {
    const m = motsCles.get(g.mot_cle_id);
    sortie.magies[g.id] = m ? lienDe(m, { texte: g.nom, magie_id: g.id }) : null;
  }
  if (!existe(db, 'type_degats')) return sortie;
  for (const t of db.prepare('SELECT id, mot_cle_id, magie_id FROM type_degats ORDER BY id').all()) {
    // feu, eau, glace : la magie du même nom (son mot-clé, son nom court) ; les autres : leur propre mot-clé, ou rien
    if (t.magie_id !== null) sortie.degats[t.id] = sortie.magies[t.magie_id] ?? null;
    else sortie.degats[t.id] = motsCles.has(t.mot_cle_id) ? lienDe(motsCles.get(t.mot_cle_id)) : null;
  }
  return sortie;
}

/** Le lien du type de dégâts `id` (taille, estoc, frappe, feu…) dans `liens` (liensDesValeursFermees), ou null. */
export const lienDuTypeDeDegats = (liens, id) => liens?.degats?.[id] ?? null;

/** Le lien de la magie `id` (l'id de sa page : « magies/magie-du-feu ») dans `liens` (liensDesValeursFermees), ou null. */
export const lienDeLaMagie = (liens, id) => liens?.magies?.[id] ?? null;
