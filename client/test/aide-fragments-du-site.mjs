// Un fragment qu'une migration a écrit, puis que le site de dev a retiré (skill tests-conventions : le site est la source de ce qu'il modifie).
// La base d'import (test/aide-base-d-import.mjs#defaireLeSite) ne défait pas toujours un tel lot : rapatrié après une migration qui avait réécrit une
// autre partie de la même cellule, il y est fusionné, la cellule ne garde plus la valeur que le lot a écrite, et « une migration a le dernier mot ».
// Le test qui lit le fragment dans l'état de la migration (baseDImport({ garder: lotsAvant('NNNN') })) l'admet alors absent, preuve lue dans le journal.
//
//   fragmentRetireParLeSite(db, { table, cle, col }, fragment, { lotsAvant, ecritures })
//     vrai si un lot rapatrié après la migration (absent de `lotsAvant`, liste figée test/fixtures/lots-avant-NNNN.json) a, pour cette cellule, un
//     « avant » qui contient le fragment et un « après » qui ne le contient pas. `ecritures` : les écritures admises du fragment (par défaut, lui seul ;
//     les balises d'un registre antérieur à la 0113 s'écrivent aussi avec la clé d'aujourd'hui : aide-mots-cles.mjs#avecLesClesDe).
//   db : la base courante (son historique_modification).

/** Le fragment `fragment` (une de ses `ecritures`) a été retiré de la cellule par un lot du site postérieur à la migration. */
export function fragmentRetireParLeSite(db, { table, cle, col }, fragment, { lotsAvant, ecritures = [fragment] }) {
  const cellule = (json) => String(JSON.parse(json ?? 'null')?.[col] ?? '');
  const ecrit = (texte) => ecritures.some((e) => texte.includes(e));
  return db.prepare("SELECT lot_id, avant, apres FROM historique_modification WHERE table_nom = ? AND cle = ? AND operation = 'modifier'")
    .all(table, JSON.stringify(cle))
    .some((l) => !lotsAvant.has(l.lot_id) && ecrit(cellule(l.avant)) && !ecrit(cellule(l.apres)));
}
