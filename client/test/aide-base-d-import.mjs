// La base des règles remise dans son état d'import, pour les tests qui épinglent une règle lue dans un texte que le site de dev peut réécrire (demande
// du propriétaire : « Les tests automatiques ne devrai pas porter sur le contenu même des textes mais juste sur le fonctionnement du site, les
// formules et les règles elle même »). Le site de dev est la source de ce qu'il modifie : la base courante peut porter n'importe quel texte. Une règle
// que le moteur lit dans un texte (R110, R122, R163, R177…) s'épingle donc sur le texte que l'import et les migrations ont écrit, jamais sur le texte
// courant ; l'état courant se contrôle par des invariants (chaque texte est lu, ou porte une raison), sans valeur figée.
//
//   baseDImport(options?)    une copie de la base construite (cheminBase, pages d'exemple comprises, comme les tests de la fiche), ouverte en lecture
//                            seule, dont chaque modification rapatriée du site (historique_modification, client/src/lib/historique-site.mjs) est
//                            défaite, de la dernière à la première : une ligne insérée par le site est retirée, une ligne supprimée remise, une
//                            cellule modifiée reprend sa valeur « avant ». Une cellule qu'une migration a réécrite après le site (sa valeur n'est plus
//                            celle que le site a laissée) est gardée telle que la migration l'a écrite : sa valeur d'import n'existe plus ; sauf si
//                            la migration n'y a remplacé que des fragments de son registre `textes` (data/migrations/NNNN.json, comme la 0122 qui
//                            recible une balise) présents aussi dans la valeur « avant » : celle-ci est remise, avec le même remplacement. Les lots
//                            défaits quittent l'historique de la copie (historiqueSite y voit l'état d'import comme courant). Seules les traces de nature
//                            `saisie` et `decision` sont défaites (R275 : une source, une migration ou un recalcul du code font partie de l'import). Depuis la
//                            0136, l'insertion défaite du repère d'un mot-clé de l'import sans page ni sort garde le repère (C0 : il porte ses colonnes
//                            d'import, comme celui du lot des repères appliqué avant la 0136) ; sa trace part avec son lot. `base.ecarts` : ce
//                            qui n'a pas pu être défait (vide d'ordinaire). Une copie par processus et par options, supprimée à sa sortie.
//     { garder: lotsAvant('0093') }
//                            l'état d'après une migration : ne défait que les lots rapatriés après elle (liste figée test/fixtures/lots-avant-NNNN.json,
//                            comme lectureDe0090, skill tests-conventions) — pour une phrase qu'une décision a fait écrire par le site de dev.
//   reglesDImport(options?)  chargerReglesDeFiche sur cette base, « tel que la page le reçoit » (passé par JSON), une fois par processus.
//   cheminDImport(options?)  le fichier de cette base : les règles d'une base vivante d'essai (preparerBaseVivante({ regles: cheminDImport() })).
//   texteDImport(table, cle, colonne, options?)
//                            une cellule de cette base (ligne lue par sa clé primaire) ; undefined pour une ligne absente.
//   remettreDepuisLImport(db, table, cle, { enfants? })
//                            remet dans une copie (règles d'une base vivante d'essai, data/rows reconstruit) une ligne que le site a supprimée, avec ce
//                            qu'elle cite et ce qui la compose, telle que l'import l'écrit (patron : serveur-edition-conflits).
//
// Les tables dérivées (lien, lien_candidat, page_fts, entite_fts) sont refaites sur la copie par scripts/db-derive.mjs, comme après `db:build` : un
// lien que portait une balise d'un mot-clé que le site a supprimé (ou une page qu'il a supprimée) y revient avec elle.
// Les noms aussi reviennent à l'import : un test cherche toujours par identifiant (figé), et bâtit un message attendu avec le nom lu par identifiant.
import { spawnSync } from 'node:child_process';
import { copyFileSync, readdirSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { adresseDeLaPageEnBase } from '../src/lib/adresses-db.mjs';
import { cheminBase } from '../src/lib/donnees.mjs';
import { chargerReglesDeFiche } from '../src/lib/fiche-regles.mjs';
import { cleDeLigne, lireHistorique } from '../src/lib/historique-site.mjs';
import { lireUnMotCle } from '../src/lib/mots-cles-db.mjs';
import { contenuSorti } from '../src/lib/sortie-du-contenu.mjs';
import { fichierTemporaire } from './aide-dossier-temporaire.mjs';
import { REGISTRES_GARDES } from './aide-registres-sortis.mjs';

/** Colonnes d'une table de la base (null : table absente, renommée ou supprimée par une migration). */
function colonnesDe(db, table) {
  if (!/^[a-z0-9_]+$/.test(table)) return null;
  const lignes = db.prepare(`PRAGMA table_info("${table}")`).all();
  return lignes.length ? new Set(lignes.map((c) => c.name)) : null;
}

const memes = (a, b) => (a === null || a === undefined ? b === null || b === undefined : b !== null && b !== undefined && String(a) === String(b));

const cleTriee = (cle) => JSON.stringify(Object.fromEntries(Object.entries(cle).sort(([x], [y]) => x.localeCompare(y))));

/**
 * Les remplacements par fragments des registres `textes` des migrations (data/migrations/*.json), par cellule « table|clé triée|colonne ». Une fois le contenu
 * sorti du dépôt (src/lib/sortie-du-contenu.mjs#contenuSorti, jour J du lot 12), ceux d'un registre sorti viennent de ce qu'en garde
 * test/fixtures/registres-sortis.json (aide-registres-sortis.mjs#REGISTRES_GARDES) ; un registre sorti non gardé n'a rien qui serve ici.
 */
const REECRITURES_DES_MIGRATIONS = (() => {
  const dossier = new URL('../../data/migrations/', import.meta.url);
  const gardes = contenuSorti() ? REGISTRES_GARDES : {};
  const registres = new Map(Object.entries(gardes).map(([nom, r]) => [`${nom}.json`, r]));
  for (const nom of readdirSync(dossier).filter((f) => f.endsWith('.json'))) {
    if (!registres.has(nom)) registres.set(nom, JSON.parse(readFileSync(new URL(nom, dossier), 'utf8')));
  }
  const parCellule = new Map();
  for (const nom of [...registres.keys()].sort()) {
    const textes = registres.get(nom).textes;
    if (!Array.isArray(textes)) continue;
    for (const t of textes) {
      if (!t?.table || !t.col || !t.cle || typeof t.avant !== 'string' || typeof t.apres !== 'string' || !t.avant) continue;
      const k = `${t.table}|${cleTriee(t.cle)}|${t.col}`;
      parCellule.set(k, [...(parCellule.get(k) ?? []), t]);
    }
  }
  return parCellule;
})();

/**
 * La valeur « avant » d'un lot du site, réécrite comme une migration passée depuis a réécrit la cellule : si les remplacements par fragments des
 * registres `textes` pour cette cellule, appliqués à l'« après » du lot (SQL replace : toutes les occurrences), donnent la valeur actuelle, et que
 * chacun de ceux qui ont changé l'« après » s'applique aussi à l'« avant », rend l'« avant » ainsi réécrit ; sinon undefined (la migration a le
 * dernier mot : la cellule est gardée). Ex. : la 0122 recible {{la-montee-de-niveau}} dans le corps de guide/bienvenue, que le site avait modifié.
 */
function avantReecrit(table, cle, col, avant, apres, actuelle) {
  if (typeof avant !== 'string' || typeof apres !== 'string' || typeof actuelle !== 'string') return undefined;
  const textes = REECRITURES_DES_MIGRATIONS.get(`${table}|${cleTriee(cle)}|${col}`);
  if (!textes) return undefined;
  const appliquees = textes.filter((t) => apres.includes(t.avant));
  if (!appliquees.length || appliquees.some((t) => !avant.includes(t.avant))) return undefined;
  const reecrire = (v) => appliquees.reduce((s, t) => s.split(t.avant).join(t.apres), v);
  return reecrire(apres) === actuelle ? reecrire(avant) : undefined;
}

/**
 * Les références qu'une migration a posées vers une ligne créée par le site de dev, par table citée : [table qui cite, colonne nullable]. À l'import,
 * la ligne citée n'existait pas : la référence y vaut NULL. Migration 0125 : type_degats.mot_cle_id cite Frappe, Taille et Estoc, mots-clés créés sur
 * le site (« Si ils existent! »). Une migration qui cite une autre ligne créée par le site s'ajoute ici ; sans elle, baseDImport refuse la copie
 * (clés étrangères rompues).
 */
const REFERENCES_DES_MIGRATIONS = Object.freeze({ mot_cle: Object.freeze([['type_degats', 'mot_cle_id']]) });

/** Met à NULL, avant que la ligne `cle` de `table` (créée par le site) soit retirée, les références que des migrations ont posées vers elle. */
function oublierLesReferencesDesMigrations(db, table, cle) {
  const valeurs = Object.values(cle);
  if (valeurs.length !== 1) return;
  for (const [cite, colonne] of REFERENCES_DES_MIGRATIONS[table] ?? []) {
    if (colonnesDe(db, cite)?.has(colonne)) db.prepare(`UPDATE "${cite}" SET "${colonne}" = NULL WHERE "${colonne}" = ?`).run(valeurs[0]);
  }
}

/**
 * Depuis la migration 0136, le nom, l'adresse, la définition, la couleur et l'icône d'un mot-clé se lisent sur son élément (sa page, sinon son
 * sort, sinon son repère) : un lot ancien du site les écrivait sur `mot_cle`. Colonnes logiques de `mot_cle` -> colonnes de l'élément, par table
 * (le titre et l'adresse d'une page, le nom d'un sort ont leur propre historique : ils ne se défont pas ici).
 */
const COLONNES_DE_L_ELEMENT = Object.freeze({
  repere: Object.freeze({ libelle: 'nom', url: 'adresse', description: 'definition', couleur: 'couleur', icone: 'icone' }),
  page: Object.freeze({ description: 'definition', couleur: 'couleur', icone: 'icone' }),
  sort: Object.freeze({ description: 'definition', couleur: 'couleur', icone: 'icone' }),
});

/**
 * Le nom et l'adresse propres d'un mot-clé ancré (`libelle`, `url`), par id : avant la 0136, le mot-clé les portait à côté de sa page ou de son
 * sort. Une entrée ancienne de `mot_cle` qui les écrit, défaite pendant que le mot-clé est ancré, les note ici ; ils passent dans le repère si un
 * ancrage défait le laisse sans élément. Propre à un appel de defaireLeSite.
 */
const LOGIQUES_PROPRES = Object.freeze(['libelle', 'url']);

/** L'élément du mot-clé `id` dans `db` : { table, ou, cle } ou null. */
function elementDe(db, id) {
  const page = db.prepare('SELECT id FROM page WHERE mot_cle_id = ?').get(id);
  if (page) return { table: 'page', ou: '"id" = ?', cle: page.id };
  const sort = db.prepare('SELECT id FROM sort WHERE mot_cle_id = ?').get(id);
  if (sort) return { table: 'sort', ou: '"id" = ?', cle: sort.id };
  const repere = db.prepare('SELECT mot_cle_id FROM repere WHERE mot_cle_id = ?').get(id);
  return repere ? { table: 'repere', ou: '"mot_cle_id" = ?', cle: id } : null;
}

/**
 * Défait, sur l'élément du mot-clé, les colonnes logiques qu'une entrée ancienne de `mot_cle` écrivait (base à la structure 0136 et après). Une
 * suppression défaite remet aussi le repère d'un mot-clé qui n'a ni page ni sort, avec les valeurs de son « avant ».
 */
function defaireSurLElement(db, e, id, propres) {
  if (e.operation === 'inserer') return;
  if (e.operation === 'supprimer') {
    if (elementDe(db, id) || !e.avant?.libelle) return;
    db.prepare('INSERT INTO repere (mot_cle_id, nom, adresse, definition, couleur, icone) VALUES (?, ?, ?, ?, ?, ?)')
      .run(id, e.avant.libelle, e.avant.url ?? null, e.avant.description ?? null, e.avant.couleur ?? null, e.avant.icone ?? null);
    return;
  }
  const element = elementDe(db, id);
  if (!element) return;
  if (element.table !== 'repere') {
    const notes = propres.get(id) ?? {};
    for (const l of LOGIQUES_PROPRES.filter((x) => e.avant && x in e.avant)) {
      if (!(l in notes) || memes(notes[l], e.apres?.[l])) notes[l] = e.avant[l];
    }
    propres.set(id, notes);
  }
  const actuelle = db.prepare(`SELECT * FROM "${element.table}" WHERE ${element.ou}`).get(element.cle);
  const valeurs = Object.entries(COLONNES_DE_L_ELEMENT[element.table]).filter(([logique]) => e.avant && logique in e.avant).flatMap(([logique, col]) => {
    const v = e.avant[logique];
    if (memes(actuelle[col], e.apres?.[logique])) return [[col, v]];
    const reecrit = avantReecrit('mot_cle', { id }, logique, v, e.apres?.[logique], actuelle[col]);
    return reecrit === undefined ? [] : [[col, reecrit]];
  });
  if (valeurs.length) db.prepare(`UPDATE "${element.table}" SET ${valeurs.map(([c]) => `"${c}" = ?`).join(', ')} WHERE ${element.ou}`).run(...valeurs.map(([, v]) => v), element.cle);
}

/** Les mots-clés qu'une entrée de `page` ou de `sort` ancre ou désancre (son mot_cle_id avant, après, et celui de la ligne actuelle). */
function motsClesAncres(e, actuelle) {
  if ((e.table !== 'page' && e.table !== 'sort') || (e.operation === 'modifier' && !(e.avant && 'mot_cle_id' in e.avant))) return [];
  return [...new Set([actuelle?.mot_cle_id, e.avant?.mot_cle_id, e.apres?.mot_cle_id].filter((id) => id !== null && id !== undefined))];
}

/** La page, sinon le sort du mot-clé `id`, avec ce qu'en recevrait son repère : { table, id, nom, adresse, definition, couleur, icone } ou null. */
function ancrageDe(db, id) {
  const page = db.prepare('SELECT id, titre, definition, couleur, icone FROM page WHERE mot_cle_id = ?').get(id);
  if (page) return { table: 'page', id: page.id, nom: page.titre, adresse: adresseDeLaPageEnBase(db, page.id), definition: page.definition, couleur: page.couleur, icone: page.icone };
  const sort = db.prepare('SELECT id, nom, definition, couleur, icone FROM sort WHERE mot_cle_id = ?').get(id);
  return sort ? { table: 'sort', id: sort.id, nom: sort.nom, adresse: null, definition: sort.definition, couleur: sort.couleur, icone: sort.icone } : null;
}

/**
 * Après une entrée défaite de `page` ou de `sort` qui ancre ou désancre le mot-clé `id` (base à la structure 0136 et après), tient le contrat C0 : un
 * mot-clé laissé sans page ni sort reçoit aussitôt son repère, tiré de l'élément qu'il avait (`avant`, lu avant l'entrée : son titre ou son nom, l'adresse
 * de la page, sa définition, sa couleur et son icône, vidées sur l'élément qui reste), le nom et l'adresse propres notés (`propres`) l'emportant ; les
 * entrées plus anciennes de `mot_cle` s'y défont. Un mot-clé ancré de nouveau quitte son repère : sa définition, sa couleur et son icône passent sur
 * l'élément qui ne les a pas, son nom et son adresse sont notés. `provisoires` : les repères ainsi créés.
 */
function tenirLAncrage(db, id, avant, { propres, provisoires }) {
  if (!db.prepare('SELECT 1 FROM mot_cle WHERE id = ?').get(id)) return;
  const element = ancrageDe(db, id);
  const repere = db.prepare('SELECT * FROM repere WHERE mot_cle_id = ?').get(id);
  if (!element && !repere && avant) {
    const notes = propres.get(id) ?? {};
    const nom = notes.libelle ?? avant.nom;
    if (!nom) return;
    db.prepare('INSERT INTO repere (mot_cle_id, nom, adresse, definition, couleur, icone) VALUES (?, ?, ?, ?, ?, ?)')
      .run(id, nom, 'url' in notes ? notes.url : avant.adresse, avant.definition ?? null, avant.couleur ?? null, avant.icone ?? null);
    if (db.prepare(`SELECT 1 FROM "${avant.table}" WHERE id = ?`).get(avant.id)) {
      db.prepare(`UPDATE "${avant.table}" SET definition = NULL, couleur = NULL, icone = NULL WHERE id = ?`).run(avant.id);
    }
    propres.delete(id);
    provisoires.add(id);
  } else if (element && repere) {
    db.prepare(`UPDATE "${element.table}" SET definition = coalesce(definition, ?), couleur = coalesce(couleur, ?), icone = coalesce(icone, ?) WHERE id = ?`)
      .run(repere.definition, repere.couleur, repere.icone, element.id);
    db.prepare('DELETE FROM repere WHERE mot_cle_id = ?').run(id);
    propres.set(id, { libelle: repere.nom, url: repere.adresse });
    provisoires.delete(id);
  }
}

/**
 * Défait dans `db` (ouverte en écriture) les modifications du site, de la dernière à la première, sauf celles des lots `garder`, puis retire de
 * l'historique les lots défaits. Rend ce qui n'a pas pu être défait (opération et raison). Exporté pour le test de l'aide.
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {{ garder?: Set<string> }} [options]
 * @returns {string[]}
 */
export function defaireLeSite(db, { garder = new Set() } = {}) {
  const entrees = lireHistorique(db).filter((e) => !garder.has(e.lot));
  const ecarts = [];
  const aDesReperes = Boolean(colonnesDe(db, 'repere')) && !colonnesDe(db, 'mot_cle')?.has('libelle');
  const suivi = { propres: new Map(), provisoires: new Set() };
  // les mots-clés que des lots défaits ont créés : leur repère part avec eux
  const creesParLeSite = new Set(entrees.filter((e) => e.table === 'mot_cle' && e.operation === 'inserer' && colonnesDe(db, 'mot_cle'))
    .map((e) => String(cleDeLigne(db, 'mot_cle', e.cle).id)));
  db.exec('PRAGMA foreign_keys = ON');
  db.exec('BEGIN');
  db.exec('PRAGMA defer_foreign_keys = ON'); // l'ordre inverse des opérations d'un lot peut passer par un état transitoire
  try {
    for (let i = entrees.length - 1; i >= 0; i -= 1) {
      const e = entrees[i];
      const colonnes = colonnesDe(db, e.table);
      if (!colonnes) continue;
      const cle = cleDeLigne(db, e.table, e.cle);
      const ou = Object.keys(cle).map((k) => `"${k}" = ?`).join(' AND ');
      const actuelle = db.prepare(`SELECT * FROM "${e.table}" WHERE ${ou}`).get(...Object.values(cle));
      try {
        const ancres = aDesReperes ? motsClesAncres(e, actuelle).map((id) => [id, ancrageDe(db, id)]) : [];
        if (e.operation === 'inserer') {
          if (actuelle && aDesReperes && e.table === 'repere' && !creesParLeSite.has(String(cle.mot_cle_id)) && !ancrageDe(db, cle.mot_cle_id)) {
            // un repère posé par le site à un mot-clé de l'import qui n'a ni page ni sort (le lot des repères, R309, appliqué avant la 0136) : il
            // recopiait les colonnes d'import du mot-clé, que la 0136 a retirées ; il en est la forme à l'import (C0), et reste
            continue;
          }
          if (actuelle) oublierLesReferencesDesMigrations(db, e.table, cle);
          if (actuelle) db.prepare(`DELETE FROM "${e.table}" WHERE ${ou}`).run(...Object.values(cle));
        } else if (e.operation === 'supprimer') {
          if (actuelle && e.table === 'repere' && suivi.provisoires.delete(cle.mot_cle_id)) {
            // le repère qu'un ancrage défait plus tard dans l'ordre inverse a créé : la suppression défaite lui rend les valeurs de son « avant »
            const valeurs = Object.entries(e.avant ?? {}).filter(([c]) => colonnes.has(c) && c !== 'mot_cle_id');
            if (valeurs.length) db.prepare(`UPDATE repere SET ${valeurs.map(([c]) => `"${c}" = ?`).join(', ')} WHERE ${ou}`).run(...valeurs.map(([, v]) => v), ...Object.values(cle));
            continue;
          }
          if (actuelle) continue; // remise depuis par une migration : gardée
          const valeurs = Object.entries(e.avant ?? {}).filter(([c]) => colonnes.has(c));
          db.prepare(`INSERT INTO "${e.table}" (${valeurs.map(([c]) => `"${c}"`).join(', ')}) VALUES (${valeurs.map(() => '?').join(', ')})`).run(...valeurs.map(([, v]) => v));
        } else if (actuelle) {
          // seule une cellule qui garde la valeur que ce lot a écrite est défaite : une migration (ou un lot gardé) passée depuis a le dernier mot,
          // sauf si elle n'y a remplacé que des fragments de son registre `textes` qui se lisent aussi dans l'« avant » : il reprend alors ce remplacement
          const valeurs = Object.entries(e.avant ?? {}).filter(([c]) => colonnes.has(c)).flatMap(([c, v]) => {
            if (memes(actuelle[c], e.apres?.[c])) return [[c, v]];
            const reecrit = avantReecrit(e.table, cle, c, v, e.apres?.[c], actuelle[c]);
            return reecrit === undefined ? [] : [[c, reecrit]];
          });
          if (valeurs.length) db.prepare(`UPDATE "${e.table}" SET ${valeurs.map(([c]) => `"${c}" = ?`).join(', ')} WHERE ${ou}`).run(...valeurs.map(([, v]) => v), ...Object.values(cle));
        }
        for (const [id, avant] of ancres) tenirLAncrage(db, id, avant, suivi);
        if (e.table === 'mot_cle' && !colonnes.has('libelle') && cle.id !== undefined) defaireSurLElement(db, e, cle.id, suivi.propres);
      } catch (err) {
        ecarts.push(`${e.table} ${e.texte} (${e.operation}, lot ${e.lot}) : ${err.message}`);
      }
    }
    if (colonnesDe(db, 'repere') && !colonnesDe(db, 'mot_cle')?.has('libelle')) {
      // un repère remis avant la page ou le sort que le même lot avait retirés (ordre inverse) : sa définition, sa couleur et son icône passent sur
      // la page, et il s'efface (un repère ne double jamais une page ou un sort)
      db.exec(`UPDATE page SET
          definition = coalesce(definition, (SELECT r.definition FROM repere r WHERE r.mot_cle_id = page.mot_cle_id)),
          couleur = coalesce(couleur, (SELECT r.couleur FROM repere r WHERE r.mot_cle_id = page.mot_cle_id)),
          icone = coalesce(icone, (SELECT r.icone FROM repere r WHERE r.mot_cle_id = page.mot_cle_id))
        WHERE mot_cle_id IN (SELECT mot_cle_id FROM repere)`);
      db.exec(`DELETE FROM repere WHERE mot_cle_id IN (SELECT mot_cle_id FROM page WHERE mot_cle_id IS NOT NULL)
        OR mot_cle_id IN (SELECT mot_cle_id FROM sort WHERE mot_cle_id IS NOT NULL)`);
    }
    const rompues = db.prepare('PRAGMA foreign_key_check').all().map((f) => `${f.table} (rowid ${f.rowid}) -> ${f.parent}`);
    if (rompues.length) throw new Error(`base d'import : clés étrangères rompues\n${rompues.join('\n')}\n${ecarts.join('\n')}`);
    const retirer = db.prepare('DELETE FROM historique_modification WHERE lot_id = ?');
    for (const lot of new Set(entrees.map((e) => e.lot))) retirer.run(lot);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
  return ecarts;
}

/** Les lots rapatriés quand la migration `numero` a été écrite (test/fixtures/lots-avant-<numero>.json, liste figée). */
export const lotsAvant = (numero) => new Set(JSON.parse(readFileSync(new URL(`./fixtures/lots-avant-${numero}.json`, import.meta.url), 'utf8')).lots);

const caches = new Map(); // clé des lots gardés -> { db, chemin, regles }

function preparer({ garder = new Set() } = {}) {
  const cle = [...garder].sort().join('\n');
  if (caches.has(cle)) return caches.get(cle);
  const copie = fichierTemporaire('maverick-import.db', 'base-d-import-');
  copyFileSync(cheminBase({ sansExemples: false }), copie);
  const ecriture = new DatabaseSync(copie);
  let ecarts;
  try {
    ecarts = defaireLeSite(ecriture, { garder });
  } finally {
    ecriture.close();
  }
  const derive = spawnSync(process.execPath, ['--no-warnings', fileURLToPath(new URL('../scripts/db-derive.mjs', import.meta.url)), copie], { encoding: 'utf8' });
  if (derive.status !== 0) throw new Error(`tables dérivées de la base d'import : ${derive.stderr || derive.stdout}`);
  const db = new DatabaseSync(copie, { readOnly: true });
  db.exec('PRAGMA foreign_keys = ON');
  Object.defineProperty(db, 'ecarts', { value: ecarts });
  const entree = { db, chemin: copie, regles: null };
  caches.set(cle, entree);
  return entree;
}

/** La base des règles dans son état d'import (voir l'en-tête) : en lecture seule, une copie par processus et par `garder`, supprimée à sa sortie. */
export const baseDImport = (options) => preparer(options).db;

/** Le fichier de la base d'import (à ne pas modifier : une base vivante d'essai en fait sa propre copie). */
export const cheminDImport = (options) => preparer(options).chemin;

/** Les règles de la fiche lues dans la base d'import, telles que la page les reçoit (passées par JSON). */
export function reglesDImport(options) {
  const entree = preparer(options);
  entree.regles ??= JSON.parse(JSON.stringify(chargerReglesDeFiche(entree.db)));
  return entree.regles;
}

/** Les colonnes logiques d'un mot-clé, lues sur son élément depuis la migration 0136 (lib/mots-cles-db.mjs#lireUnMotCle). */
const CHAMPS_LOGIQUES_DU_MOT_CLE = Object.freeze(['libelle', 'url', 'description', 'couleur', 'icone']);

/**
 * La cellule `colonne` de la ligne `cle` dans la base d'import ; undefined pour une ligne absente (créée par le site, ou supprimée par une migration).
 * Une colonne logique d'un mot-clé que la table ne porte plus (libelle, url, description, couleur, icone : migration 0136) se lit sur son élément.
 */
export function texteDImport(table, cle, colonne, options) {
  const db = baseDImport(options);
  const c = cleDeLigne(db, table, cle);
  if (table === 'mot_cle' && CHAMPS_LOGIQUES_DU_MOT_CLE.includes(colonne) && !colonnesDe(db, table)?.has(colonne)) {
    const m = lireUnMotCle(db, c.id);
    return m ? m[colonne] : undefined;
  }
  if (!colonnesDe(db, table)?.has(colonne)) throw new Error(`${table}.${colonne} : colonne absente de la base`);
  const ligne = db.prepare(`SELECT "${colonne}" AS v FROM "${table}" WHERE ${Object.keys(c).map((k) => `"${k}" = ?`).join(' AND ')}`).get(...Object.values(c));
  return ligne ? ligne.v : undefined;
}

/**
 * Remet dans `db` (une copie de la base, ouverte en écriture, clés étrangères contrôlées) la ligne `cle` de `table` telle que la base d'import l'écrit,
 * si le site de dev l'a supprimée : d'abord les lignes qu'elle cite (clés étrangères, de proche en proche : l'espèce avant la carte, la page avant le
 * métier ou le don), puis elle, puis (`enfants`, vrai par défaut) les lignes de l'import qui la composent (une table dont la clé étrangère vers elle fait
 * partie de sa clé primaire : les bonus d'un métier, les rubriques d'une carte). Rend le nombre de lignes remises (0 : elle était là).
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {string} table
 * @param {object} cle les colonnes de sa clé primaire
 * @param {{ enfants?: boolean, dImport?: import('node:sqlite').DatabaseSync }} [options]
 */
export function remettreDepuisLImport(db, table, cle, { enfants = true, dImport = baseDImport() } = {}) {
  const colonnes = colonnesDe(db, table);
  if (!colonnes || !Object.keys(cle).every((k) => colonnes.has(k))) throw new Error(`${table} : table ou clé inconnue (${Object.keys(cle).join(', ')})`);
  const ou = Object.keys(cle).map((k) => `"${k}" = ?`).join(' AND ');
  if (db.prepare(`SELECT 1 FROM "${table}" WHERE ${ou}`).get(...Object.values(cle))) return 0;
  const ligne = dImport.prepare(`SELECT * FROM "${table}" WHERE ${ou}`).get(...Object.values(cle));
  if (!ligne) throw new Error(`${table} ${JSON.stringify(cle)} : absente de la base d'import`);
  let n = 0;
  const parents = new Map();
  for (const f of db.prepare(`PRAGMA foreign_key_list("${table}")`).all()) parents.set(f.id, [...(parents.get(f.id) ?? []), f]);
  for (const fk of parents.values()) {
    const cleParent = Object.fromEntries(fk.map((f) => [f.to, ligne[f.from]]));
    if (Object.values(cleParent).some((v) => v === null || v === undefined)) continue;
    n += remettreDepuisLImport(db, fk[0].table, cleParent, { enfants: false, dImport });
  }
  const valeurs = Object.entries(ligne).filter(([c]) => colonnes.has(c));
  db.prepare(`INSERT INTO "${table}" (${valeurs.map(([c]) => `"${c}"`).join(', ')}) VALUES (${valeurs.map(() => '?').join(', ')})`).run(...valeurs.map(([, v]) => v));
  n += 1;
  if (!enfants) return n;
  for (const { name } of db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all()) {
    const cleDeLEnfant = db.prepare(`PRAGMA table_info("${name}")`).all().filter((c) => c.pk).map((c) => c.name);
    for (const fk of db.prepare(`PRAGMA foreign_key_list("${name}")`).all().filter((f) => f.table === table && cleDeLEnfant.includes(f.from) && f.to in ligne)) {
      if (!colonnesDe(dImport, name)) continue;
      for (const enfant of dImport.prepare(`SELECT * FROM "${name}" WHERE "${fk.from}" = ?`).all(ligne[fk.to])) {
        n += remettreDepuisLImport(db, name, Object.fromEntries(cleDeLEnfant.map((c) => [c, enfant[c]])), { enfants: false, dImport });
      }
    }
  }
  return n;
}
