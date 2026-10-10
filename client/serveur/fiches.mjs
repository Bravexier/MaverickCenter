// Fiches de personnages dans la base vivante, au format de src/lib/fiche-format.mjs (docs/serveur.md, « Une fiche en JSON »).
// Avant la 1.0, il n'y a pas de comptes : le service ne connaît que les PRÉTIRÉS, qui ne sont à personne et que tout le monde voit
// (v_personnage_visible) ; une fiche de joueur n'est ni listée ni lisible ici. Ce que la base contrôle (types, bornes, références aux règles) refuse
// l'enregistrement ; les règles de v_personnage_controle sont rendues avec la fiche et empêchent seulement de la passer « valide ».
import { createHash, randomUUID } from 'node:crypto';
import { CHAMP_VERSION, COLONNES_DU_SERVICE, PARTIES_DE_FICHE, ficheVide } from '../src/lib/fiche-format.mjs';
import { clesRompues } from './base-vivante.mjs';

/** Au plus tant de lignes par liste (une fiche en a quelques dizaines) : un envoi aberrant est refusé avant d'écrire. */
export const LIGNES_MAX = 500;

export class ErreurFiche extends Error {
  /** @param {number} statut code HTTP @param {string} message @param {object} [details] ajoutés à la réponse */
  constructor(statut, message, details = {}) {
    super(message);
    this.name = 'ErreurFiche';
    this.statut = statut;
    this.details = details;
  }
}

/** Instant ISO 8601 en UTC à la seconde, le format des colonnes `cree_le` / `modifie_le`. */
export const instant = (date = new Date()) => date.toISOString().replace(/\.\d{3}Z$/, 'Z');

const infos = (db, table) => db.prepare(`PRAGMA table_info("${table}")`).all();
const colonnesDeDetail = (db, table) => infos(db, table).map((c) => c.name).filter((c) => c !== 'personnage_id');
const colonnesModifiables = (db) => infos(db, 'personnage').map((c) => c.name).filter((c) => !COLONNES_DU_SERVICE.includes(c));
const annuler = (db) => {
  try {
    db.exec('ROLLBACK');
  } catch {
    // déjà annulée par SQLite (erreur grave) : rien à faire
  }
};

/** Ordre de lecture d'une liste : son rang quand elle en a un, sinon sa clé (une fiche relue est toujours écrite pareil). */
function ordreDe(db, table) {
  const cols = infos(db, table);
  if (cols.some((c) => c.name === 'rang')) return '"rang"';
  return cols.filter((c) => c.pk && c.name !== 'personnage_id').sort((a, b) => a.pk - b.pk).map((c) => `"${c.name}"`).join(', ');
}

function versionDe(fiche) {
  const { [CHAMP_VERSION]: _ignoree, ...contenu } = fiche;
  return createHash('sha256').update(JSON.stringify(contenu)).digest('hex').slice(0, 16);
}

/** Le prétiré `id` au format d'échange (colonnes à la racine, listes, `version`), ou null. */
export function lireFiche(db, id) {
  const ligne = db.prepare(`SELECT * FROM personnage WHERE id = ? AND nature = 'pretire'`).get(id);
  if (!ligne) return null;
  const fiche = { ...ligne };
  for (const [cle, table] of Object.entries(PARTIES_DE_FICHE)) {
    const cols = colonnesDeDetail(db, table).map((c) => `"${c}"`).join(', ');
    fiche[cle] = db.prepare(`SELECT ${cols} FROM "${table}" WHERE personnage_id = ? ORDER BY ${ordreDe(db, table)}`).all(id).map((r) => ({ ...r }));
  }
  fiche[CHAMP_VERSION] = versionDe(fiche);
  return fiche;
}

/** Règles de v_personnage_controle enfreintes par la fiche (vide : conforme à ce que la base sait contrôler). */
export function controlesDe(db, id) {
  return db.prepare('SELECT regle, detail FROM v_personnage_controle WHERE personnage_id = ? ORDER BY regle, detail').all(id).map((r) => ({ ...r }));
}

/** Niveau global et niveaux de classe (v_personnage_niveau, décision R2). */
export function niveauDe(db, id) {
  const n = db.prepare('SELECT niveau_global, niveau_classe_1, niveau_classe_2 FROM v_personnage_niveau WHERE personnage_id = ?').get(id);
  return n ? { ...n } : null;
}

/** Résumé de chaque prétiré, pour la recherche : identité, race, magies, classes, niveau, statut, nombre de règles enfreintes. */
export function listerFiches(db) {
  const fiches = db.prepare(`
    SELECT p.id, p.nom, p.surnom, p.statut, p.lieu_origine, p.xp, p.mode_classe,
           p.race_id, r.nom AS race, p.ethnie_id, e.nom AS ethnie,
           p.magie_innee_id, mi.nom AS magie_innee, p.magie_acquise_id, ma.nom AS magie_acquise,
           p.dieu_choisi_id, d.nom AS dieu, p.metier_id, me.nom AS metier,
           n.niveau_global, n.niveau_classe_1, n.niveau_classe_2, p.cree_le, p.modifie_le
    FROM personnage p
    LEFT JOIN race r ON r.id = p.race_id
    LEFT JOIN ethnie e ON e.id = p.ethnie_id
    LEFT JOIN magie mi ON mi.id = p.magie_innee_id
    LEFT JOIN magie ma ON ma.id = p.magie_acquise_id
    LEFT JOIN dieu d ON d.id = p.dieu_choisi_id
    LEFT JOIN metier me ON me.id = p.metier_id
    LEFT JOIN v_personnage_niveau n ON n.personnage_id = p.id
    WHERE p.nature = 'pretire'
    ORDER BY p.nom COLLATE NOCASE, p.id`).all().map((r) => ({ ...r, classes: [], anomalies: 0 }));
  const parId = new Map(fiches.map((f) => [f.id, f]));
  for (const c of db.prepare(`
    SELECT pc.personnage_id, pc.rang, pc.classe_id, c.nom AS classe, pc.specialite_id, s.nom AS specialite
    FROM personnage_classe pc JOIN personnage p ON p.id = pc.personnage_id AND p.nature = 'pretire'
    JOIN classe c ON c.id = pc.classe_id LEFT JOIN specialite s ON s.id = pc.specialite_id
    ORDER BY pc.personnage_id, pc.rang`).all()) {
    const { personnage_id: id, ...classe } = c;
    parId.get(id)?.classes.push({ ...classe });
  }
  for (const a of db.prepare('SELECT personnage_id AS id, count(*) AS n FROM v_personnage_controle GROUP BY personnage_id').all()) {
    if (parId.has(a.id)) parId.get(a.id).anomalies = a.n;
  }
  return fiches;
}

/** Valeur d'une cellule : texte, nombre, booléen (0/1) ou null ; « "" » vaut null (champ laissé vide). */
function valeurDeCellule(v, ou, problemes) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v === 'string') return v;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  problemes.push(`${ou} : valeur refusée (texte, nombre, booléen ou null attendu)`);
  return null;
}

/** Message d'une contrainte de la base, en français. */
function expliquer(message) {
  let m;
  if ((m = /^NOT NULL constraint failed: \w+\.(\w+)$/.exec(message))) return `« ${m[1]} » est obligatoire`;
  if ((m = /^CHECK constraint failed: (.+)$/.exec(message))) return `valeur hors des bornes (${m[1].trim()})`;
  if ((m = /^UNIQUE constraint failed: (.+)$/.exec(message))) {
    const cols = m[1].split(',').map((c) => c.trim().replace(/^\w+\./, '')).filter((c) => c !== 'personnage_id');
    return `en double (${cols.join(', ')})`;
  }
  if ((m = /^cannot store (\w+) value in (\w+) column \w+\.(\w+)$/.exec(message))) {
    return `« ${m[3]} » : ${m[2] === 'INTEGER' ? 'un nombre entier' : m[2] === 'TEXT' ? 'un texte' : m[2]} est attendu`;
  }
  return message;
}

/** Contrôle de forme du JSON reçu (avant toute écriture) : champs connus, listes d'objets, valeurs simples. */
function verifierForme(db, entree, problemes) {
  if (!entree || typeof entree !== 'object' || Array.isArray(entree)) {
    throw new ErreurFiche(400, 'Une fiche est un objet JSON.');
  }
  const modifiables = new Set(colonnesModifiables(db));
  for (const cle of Object.keys(entree)) {
    if (modifiables.has(cle) || COLONNES_DU_SERVICE.includes(cle) || cle === CHAMP_VERSION) continue;
    if (cle in PARTIES_DE_FICHE) {
      const liste = entree[cle];
      if (!Array.isArray(liste)) problemes.push(`${cle} : une liste est attendue`);
      else if (liste.length > LIGNES_MAX) problemes.push(`${cle} : ${liste.length} lignes, au plus ${LIGNES_MAX}`);
      else {
        const colonnes = new Set(colonnesDeDetail(db, PARTIES_DE_FICHE[cle]));
        liste.forEach((l, i) => {
          if (!l || typeof l !== 'object' || Array.isArray(l)) problemes.push(`${cle}[${i}] : un objet est attendu`);
          else for (const c of Object.keys(l)) if (!colonnes.has(c)) problemes.push(`${cle}[${i}] : champ inconnu « ${c} »`);
        });
      }
      continue;
    }
    problemes.push(`champ inconnu « ${cle} »`);
  }
}

/**
 * Crée (sans `id`) ou modifie (avec `id`) un prétiré à partir du JSON `entree`. Une colonne absente du JSON garde sa valeur (création : celle
 * d'une fiche vide) ; une liste présente remplace toute la liste, une liste absente ne change pas. Modifier exige la `version` lue : si la fiche a
 * changé depuis, rien n'est écrit (409). Rend { personnage, controles, niveau }. Erreurs : ErreurFiche (400 forme ou contrainte, 404, 409, 422).
 */
export function enregistrerFiche(db, entree, { id = null, maintenant = new Date() } = {}) {
  const problemes = [];
  verifierForme(db, entree, problemes);
  if (problemes.length) throw new ErreurFiche(400, 'La fiche n’a pas été enregistrée.', { problemes });

  const creation = id === null;
  db.exec('BEGIN IMMEDIATE');
  let ouverte = true;
  try {
    db.exec('PRAGMA defer_foreign_keys = ON'); // références contrôlées à la fin, avec le détail (clesRompues)
    const avant = creation ? null : lireFiche(db, id);
    if (!creation) {
      if (!avant) throw new ErreurFiche(404, 'Fiche introuvable.');
      if (entree[CHAMP_VERSION] !== avant[CHAMP_VERSION]) {
        throw new ErreurFiche(409, 'Cette fiche a été modifiée entre-temps : rechargez-la avant de l’enregistrer.', { personnage: avant });
      }
    }
    const t = instant(maintenant);
    const modifiables = colonnesModifiables(db);
    const ligne = {};
    for (const c of modifiables) {
      if (c in entree) ligne[c] = valeurDeCellule(entree[c], c, problemes);
    }
    if (problemes.length) throw new ErreurFiche(400, 'La fiche n’a pas été enregistrée.', { problemes });
    if (creation) {
      id = randomUUID();
      const depart = ficheVide();
      const complete = { ...Object.fromEntries(modifiables.filter((c) => c in depart).map((c) => [c, valeurDeCellule(depart[c], c, problemes)])), ...ligne };
      const valeurs = { id, nature: 'pretire', proprietaire_id: null, visibilite: 'tous', cree_le: t, modifie_le: t, ...complete };
      const cols = Object.keys(valeurs);
      try {
        db.prepare(`INSERT INTO personnage (${cols.map((c) => `"${c}"`).join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`).run(...Object.values(valeurs));
      } catch (e) {
        problemes.push(expliquer(e.message));
      }
    } else {
      const valeurs = { ...ligne, modifie_le: t > avant.cree_le ? t : avant.cree_le };
      const cols = Object.keys(valeurs);
      try {
        db.prepare(`UPDATE personnage SET ${cols.map((c) => `"${c}" = ?`).join(', ')} WHERE id = ?`).run(...Object.values(valeurs), id);
      } catch (e) {
        problemes.push(expliquer(e.message));
      }
    }

    if (!problemes.length) {
      for (const [cle, table] of Object.entries(PARTIES_DE_FICHE)) {
        if (!(cle in entree)) continue;
        db.prepare(`DELETE FROM "${table}" WHERE personnage_id = ?`).run(id);
        const colonnes = colonnesDeDetail(db, table);
        entree[cle].forEach((l, i) => {
          const cols = colonnes.filter((c) => c in l);
          const dejaVus = problemes.length;
          const valeurs = cols.map((c) => valeurDeCellule(l[c], `${cle}[${i}].${c}`, problemes));
          if (problemes.length > dejaVus) return; // valeur refusée : la ligne n'est pas tentée
          try {
            db.prepare(`INSERT INTO "${table}" (personnage_id${cols.map((c) => `, "${c}"`).join('')}) VALUES (?${', ?'.repeat(cols.length)})`).run(id, ...valeurs);
          } catch (e) {
            problemes.push(`${cle}[${i}] : ${expliquer(e.message)}`);
          }
        });
      }
    }
    if (!problemes.length) {
      for (const r of clesRompues(db, 'personnage', { ou: 't.id = ?', valeurs: [id] })) {
        problemes.push(`« ${r.colonnes.join(', ')} » : « ${r.valeur} » n’existe pas dans les règles (${r.parent})`);
      }
      for (const [cle, table] of Object.entries(PARTIES_DE_FICHE)) {
        for (const r of clesRompues(db, table, { ou: 't.personnage_id = ?', valeurs: [id] })) {
          problemes.push(`${cle} : « ${r.colonnes.join(', ')} » = « ${r.valeur} » n’existe pas dans les règles (${r.parent})`);
        }
      }
    }
    if (problemes.length) throw new ErreurFiche(400, 'La fiche n’a pas été enregistrée.', { problemes });

    const controles = controlesDe(db, id);
    const statut = db.prepare('SELECT statut FROM personnage WHERE id = ?').get(id).statut;
    if (statut === 'valide' && controles.length) {
      throw new ErreurFiche(422, 'La fiche enfreint des règles : corrigez-les, ou enregistrez-la en brouillon (rien n’a été enregistré).', { controles });
    }
    try {
      db.exec('COMMIT');
    } catch (e) {
      throw new ErreurFiche(400, 'La fiche n’a pas été enregistrée.', { problemes: [expliquer(e.message)] });
    }
    ouverte = false;
    return { personnage: lireFiche(db, id), controles, niveau: niveauDe(db, id) };
  } finally {
    if (ouverte) annuler(db);
  }
}
