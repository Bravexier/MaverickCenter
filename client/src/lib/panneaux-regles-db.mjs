// Panneaux de règles (migration 0056 ; demande du propriétaire, 2026-10-16 : « refaçonner tous les encarts de début des onglets des équipements. La
// première ligne serait à supprimer et intégrer dans le panneau déroulant. Il faudrait que ce champ texte soit modifiable sur son titre, et son contenu.
// Son contenu peut d'ailleurs inclure des tuiles génériques ») : l'encart replié en tête d'un onglet (aujourd'hui, les cinq de /ressources/equipement/),
// un titre et des blocs dans l'ordre de lecture — du texte, qui suit les colonnes du panneau, ou une tuile au titre facultatif. Tables panneau_regles et
// panneau_regles_bloc (section 1 de data/schema.sql), remplies par la migration des règles que le site tirait du corps des pages ; depuis, le site de dev
// en est la source (serveur/edition-panneaux.mjs). Le rendu : lib/panneaux-regles-rendu.mjs, components/equipement/PanneauDeRegles.astro.
// Pur, sans dépendance : la base est passée par l'appelant (lib/donnees.mjs au build, la base vivante pour le service) ; les calculs de l'ordre servent au
// service (insertion après un bloc) et à l'extension du mode modification (déplacements : src/scripts/edition/panneaux.mjs).

const lignes = (db, sql, ...p) => db.prepare(sql).all(...p).map((l) => ({ ...l }));

/** Les blocs d'un panneau dans l'ordre de lecture : `ordre`, puis le rang (la clé, jamais redonnée) à ordre égal. */
export const ordonnerBlocs = (blocs) => [...blocs].sort((a, b) => a.ordre - b.ordre || a.rang - b.rang);

/**
 * Un panneau et ses blocs dans l'ordre de lecture : { id, titre, page_id, blocs: [{ panneau_id, rang, ordre, tuile, titre, texte }] } ; null s'il
 * n'existe pas (une base d'avant la migration 0056 n'a pas la table : null aussi).
 * @param {import('node:sqlite').DatabaseSync} db
 */
export function chargerPanneau(db, id) {
  if (!db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'panneau_regles'").get()) return null;
  const panneau = db.prepare('SELECT id, titre, page_id FROM panneau_regles WHERE id = ?').get(String(id));
  if (!panneau) return null;
  // dans l'ordre de lecture, trié par la base (index panneau_regles_bloc_ordre ; ordonnerBlocs : le même ordre, pour des lignes lues ailleurs)
  return { ...panneau, blocs: lignes(db, 'SELECT * FROM panneau_regles_bloc WHERE panneau_id = ? ORDER BY ordre, rang', panneau.id) };
}

/** Tous les panneaux (chargerPanneau), par id ; [] pour une base d'avant la migration 0056. */
export function chargerPanneaux(db) {
  if (!db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'panneau_regles'").get()) return [];
  return db.prepare('SELECT id FROM panneau_regles ORDER BY id').all().map((p) => chargerPanneau(db, p.id));
}

/**
 * La place d'un bloc inséré après le bloc de rang `apres` (null : à la fin) et les ordres des blocs suivants qui doivent changer pour lui laisser la
 * place : { ordre, decalages: [{ rang, ordre }] }. Le nouveau bloc prend l'ordre du bloc `apres` + 1 ; chaque bloc qui le suit à la lecture n'est
 * repoussé que s'il le faut (les ordres suivis 6, 7, 8 deviennent 7, 8, 9 ; un trou absorbe le décalage ; deux blocs au même ordre sont séparés).
 * `apres` inconnu : null (l'appelant refuse).
 */
export function ordresApresInsertion(blocs, apres = null) {
  const lus = ordonnerBlocs(blocs);
  if (apres === null || apres === undefined) return { ordre: lus.length ? lus.at(-1).ordre + 1 : 1, decalages: [] };
  const i = lus.findIndex((b) => b.rang === Number(apres));
  if (i < 0) return null;
  const ordre = lus[i].ordre + 1;
  const decalages = [];
  let suivant = ordre + 1;
  for (const b of lus.slice(i + 1)) {
    const voulu = Math.max(b.ordre, suivant);
    if (voulu !== b.ordre) decalages.push({ rang: b.rang, ordre: voulu });
    suivant = voulu + 1;
  }
  return { ordre, decalages };
}

/**
 * Les ordres d'un panneau après des déplacements (« ↑ », « ↓ » du mode modification) : `blocs` = [{ rang, ordre }] tels que dans la base, `sequence` =
 * leurs rangs dans le nouvel ordre de lecture (un rang inconnu de `blocs` est ignoré) ; rend Map(rang → ordre) des seuls blocs dont l'ordre change.
 * Le i-ème bloc de la séquence prend la i-ème des places en place (les ordres de la base, triés), mais toujours au moins l'ordre du bloc précédent + 1 :
 * deux blocs échangés échangent leurs ordres. Si la séquence est l'ordre de lecture de la base, rien ne change tant que ses ordres sont distincts ; deux
 * blocs au même ordre (lus par leur rang) sont séparés : le second prend l'ordre du premier + 1, et ceux qui suivent sont repoussés s'il le faut
 * ([2, 2, 3] devient [2, 3, 4]) — un enregistrement sans déplacement peut donc écrire des ordres.
 */
export function ordresApresDeplacement(blocs, sequence) {
  const parRang = new Map(blocs.map((b) => [b.rang, b]));
  const places = blocs.map((b) => b.ordre).sort((a, b) => a - b);
  const changes = new Map();
  let precedent = 0;
  let i = 0; // la place des seuls blocs connus
  for (const rang of sequence) {
    const b = parRang.get(rang);
    if (!b) continue;
    // au-delà des places en place (une séquence plus longue que `blocs`, un rang répété) : à la suite
    const ordre = Math.max(places[i] ?? precedent + 1, precedent + 1);
    i += 1;
    if (ordre !== b.ordre) changes.set(rang, ordre);
    precedent = ordre;
  }
  return changes;
}
