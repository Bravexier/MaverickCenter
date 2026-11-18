// Variantes mécaniques d'un contenu (essai mécanique des tests, passes V1 à V4 : scripts/essai-mecanique-tests.mjs ; lot 10 du chantier de la base de dev,
// R274, R278). Chacune est une modification que le propriétaire peut faire sur le site de dev ; un test qui casse dessus fige une valeur modifiable.
//   V1  des icônes (lib/icones.mjs#ICONES) posées sur des mots-clés de genres variés : quelques-uns par catégorie de mot-clé, par type de page qui les
//       porte (page_tag), et ceux des magies et des types de dégâts ;
//   V2  une magie renommée : `nom` et `nom_cle` (normalize), identifiant inchangé ;
//   V3  une ligne ajoutée dans quelques tables de contenu que le site sait créer (ENTITES « nouveau ») : copie de la dernière ligne, clé nouvelle,
//       noms suffixés, `*_cle` recalculées, colonnes uniques décalées, rattachée à la même page que son modèle (page_entite non principale, comme le
//       service : serveur/edition-armes.mjs) ; clés étrangères et CHECK respectés (une ligne refusée est notée, pas forcée) ;
//   V4  une ligne retirée dans quelques tables que le site sait vider (ENTITES « suppression ») : la première sans dépendant (aucune clé étrangère
//       vers elle hors ON DELETE CASCADE, aucune page qui lui appartienne (page_entite principale), et pour un mot-clé : non protégé, sans homonyme,
//       cité par aucun texte) ; son rattachement non principal à une page est retiré avec elle, comme le fait le service.
// Chaque fonction reçoit la base ouverte en écriture (une copie de l'extrait) et rend un rapport { variante, faites: [...], refusees: [...] }.
import { ICONES } from '../src/lib/icones.mjs';
import { IDS_DES_MOTS_CLES_PROTEGES } from '../src/lib/mots-cles-proteges.mjs';
import { normalize } from '../src/lib/text.mjs';

const q = (nom) => `"${String(nom).replace(/"/g, '""')}"`;
const colonnes = (db, table) => db.prepare(`PRAGMA table_info(${q(table)})`).all();
const tableExiste = (db, table) => Boolean(db.prepare("SELECT 1 AS x FROM sqlite_master WHERE type = 'table' AND name = ?").get(table));

/** Les tables où V3 ajoute une ligne (le site de dev sait en créer : lib/edition-modele.mjs#ENTITES, « nouveau »). */
export const TABLES_AJOUTEES = Object.freeze(['arme', 'specialite', 'evenement', 'monstre_capacite_commune', 'mot_cle', 'categorie_mot_cle']);
/** Les tables où V4 retire une ligne (le site de dev sait en supprimer : ENTITES, « suppression »). */
export const TABLES_VIDEES = Object.freeze(['arme', 'monstre', 'monstre_capacite_commune', 'specialite', 'evenement', 'metier', 'mot_cle']);
/** Mots-clés par groupe (catégorie, type de page) qui reçoivent une icône en V1. */
const PAR_GROUPE = 3;

export function v1IconesVariees(db) {
  const rapport = { variante: 'V1', faites: [], refusees: [] };
  const choisis = new Map(); // id → groupe
  const ajouter = (lignes, groupe) => { for (const { id } of lignes) if (!choisis.has(id)) choisis.set(id, groupe); };
  for (const { id } of db.prepare('SELECT id FROM categorie_mot_cle ORDER BY id').all()) {
    ajouter(db.prepare('SELECT m.id FROM mot_cle m JOIN mot_cle_categorie c ON c.mot_cle_id = m.id WHERE c.categorie_id = ? AND m.icone IS NULL ORDER BY m.id LIMIT ?').all(id, PAR_GROUPE), `categorie:${id}`);
  }
  for (const { type } of db.prepare('SELECT DISTINCT type FROM page ORDER BY type').all()) {
    ajouter(db.prepare('SELECT DISTINCT m.id FROM mot_cle m JOIN page_tag t ON t.tag_id = m.id JOIN page p ON p.id = t.page_id WHERE p.type = ? AND m.icone IS NULL ORDER BY m.id LIMIT ?').all(type, PAR_GROUPE), `page:${type}`);
  }
  ajouter(db.prepare('SELECT m.id FROM mot_cle m JOIN magie g ON g.mot_cle_id = m.id WHERE m.icone IS NULL ORDER BY m.id').all(), 'magie');
  if (tableExiste(db, 'type_degats')) ajouter(db.prepare('SELECT m.id FROM mot_cle m JOIN type_degats d ON d.mot_cle_id = m.id WHERE m.icone IS NULL ORDER BY m.id').all(), 'type_degats');
  const poser = db.prepare('UPDATE mot_cle SET icone = ? WHERE id = ?');
  let i = 0;
  for (const [id, groupe] of choisis) {
    const icone = ICONES[i++ % ICONES.length].valeur;
    try {
      poser.run(icone, id);
      rapport.faites.push({ table: 'mot_cle', id, groupe, icone });
    } catch (e) {
      rapport.refusees.push({ table: 'mot_cle', id, raison: String(e.message).split('\n')[0] });
    }
  }
  return rapport;
}

export function v2MagieRenommee(db) {
  const rapport = { variante: 'V2', faites: [], refusees: [] };
  const magie = db.prepare('SELECT id, nom FROM magie ORDER BY id LIMIT 1').get();
  if (!magie) return { ...rapport, refusees: [{ table: 'magie', raison: 'aucune magie' }] };
  const nom = `Magie renommée ${magie.id}`;
  db.prepare('UPDATE magie SET nom = ?, nom_cle = ? WHERE id = ?').run(nom, normalize(nom), magie.id);
  rapport.faites.push({ table: 'magie', id: magie.id, avant: magie.nom, apres: nom });
  return rapport;
}

/** Les colonnes visées par une clé étrangère de `table` (elles gardent leur valeur : la ligne copiée pointe vers les mêmes parents). */
const colonnesEtrangeres = (db, table) => new Set(db.prepare(`PRAGMA foreign_key_list(${q(table)})`).all().map((f) => f.from));

/** Les colonnes d'un index unique (hors clé primaire) de `table`. */
function colonnesUniques(db, table) {
  const uniques = new Set();
  for (const i of db.prepare(`PRAGMA index_list(${q(table)})`).all()) {
    if (!i.unique || i.origin === 'pk') continue;
    for (const c of db.prepare(`PRAGMA index_info(${q(i.name)})`).all()) if (c.name) uniques.add(c.name);
  }
  return uniques;
}

const NOMS = ['nom', 'titre', 'libelle', 'intitule'];

/** Une copie de la dernière ligne de `table` sous une clé nouvelle : la ligne à insérer, ou null (aucune ligne). */
function ligneNouvelle(db, table) {
  const cols = colonnes(db, table);
  const cle = cols.filter((c) => c.pk > 0);
  if (!cle.length) return null;
  const ordre = cle.sort((a, b) => a.pk - b.pk).map((c) => q(c.name)).join(', ');
  const modele = db.prepare(`SELECT * FROM ${q(table)} ORDER BY ${ordre} DESC LIMIT 1`).get();
  if (!modele) return null;
  const ligne = { ...modele };
  const etrangeres = colonnesEtrangeres(db, table);
  const uniques = colonnesUniques(db, table);
  const suivant = (c) => (db.prepare(`SELECT max(${q(c)}) AS m FROM ${q(table)}`).get().m ?? 0) + 1;
  for (const c of cols) {
    if (etrangeres.has(c.name)) continue;
    const entier = /INT/i.test(c.type);
    if (c.pk > 0 || (uniques.has(c.name) && !NOMS.includes(c.name) && !/(^|_)cle$/.test(c.name))) {
      if (ligne[c.name] === null) continue;
      ligne[c.name] = entier ? suivant(c.name) : `${ligne[c.name]}-essai`;
    }
  }
  for (const n of NOMS) {
    if (typeof ligne[n] !== 'string' || !ligne[n]) continue;
    ligne[n] = `${ligne[n]} essai`;
    if (`${n}_cle` in ligne) ligne[`${n}_cle`] = normalize(ligne[n]);
  }
  if (table === 'mot_cle' && typeof ligne.libelle === 'string') ligne.cle = normalize(ligne.libelle);
  return { ligne, modele, cle: cle.map((c) => c.name) };
}

export function v3LignesAjoutees(db, tables = TABLES_AJOUTEES) {
  const rapport = { variante: 'V3', faites: [], refusees: [] };
  db.exec('PRAGMA foreign_keys = ON');
  for (const table of tables) {
    if (!tableExiste(db, table)) { rapport.refusees.push({ table, raison: 'table absente' }); continue; }
    const n = ligneNouvelle(db, table);
    if (!n) { rapport.refusees.push({ table, raison: 'aucune ligne à copier' }); continue; }
    const noms = Object.keys(n.ligne);
    db.exec('SAVEPOINT ajout');
    try {
      db.prepare(`INSERT INTO ${q(table)} (${noms.map(q).join(', ')}) VALUES (${noms.map(() => '?').join(', ')})`).run(...noms.map((c) => n.ligne[c]));
      // rattachée à la page de son modèle quand le modèle y est rattaché sans la posséder (le service fait de même à la création)
      if (n.cle.length === 1) {
        const page = db.prepare('SELECT page_id, origine FROM page_entite WHERE entite_table = ? AND entite_id = ? AND principale = 0').get(table, String(n.modele[n.cle[0]]));
        if (page) {
          db.prepare('INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES (?, ?, ?, 0, ?)').run(table, String(n.ligne[n.cle[0]]), page.page_id, page.origine);
        }
      }
      db.exec('RELEASE ajout');
      rapport.faites.push({ table, cle: Object.fromEntries(n.cle.map((c) => [c, n.ligne[c]])) });
    } catch (e) {
      db.exec('ROLLBACK TO ajout');
      db.exec('RELEASE ajout');
      rapport.refusees.push({ table, raison: String(e.message).split('\n')[0] });
    }
  }
  return rapport;
}

/** Les clés étrangères qui visent `table` : [{ table, from, to, on_delete }] (`to` null : la clé primaire). */
function referencesVers(db, table) {
  const refs = [];
  for (const { name } of db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all()) {
    let fks;
    try { fks = db.prepare(`PRAGMA foreign_key_list(${q(name)})`).all(); } catch { continue; }
    for (const f of fks) if (f.table === table) refs.push({ table: name, from: f.from, to: f.to, on_delete: f.on_delete });
  }
  return refs;
}

/** Tous les textes de la base (cellules TEXT des tables de contenu), pour savoir si un mot-clé est cité. */
function corpus(db) {
  const morceaux = [];
  for (const { name, sql } of db.prepare("SELECT name, sql FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all()) {
    if (/^\s*CREATE\s+VIRTUAL/i.test(sql ?? '') || /_fts/.test(name) || name === 'mot_cle') continue;
    const textes = colonnes(db, name).filter((c) => /TEXT/i.test(c.type)).map((c) => q(c.name));
    if (!textes.length) continue;
    for (const c of textes) for (const r of db.prepare(`SELECT ${c} AS t FROM ${q(name)} WHERE ${c} IS NOT NULL`).all()) morceaux.push(r.t);
  }
  return morceaux.join('\n');
}

/** Combien de candidats V4 essaie par table avant de renoncer (un enfant peut lui-même avoir des dépendants : la suppression est alors refusée). */
const ESSAIS_PAR_TABLE = 25;

export function v4LignesRetirees(db, tables = TABLES_VIDEES) {
  const rapport = { variante: 'V4', faites: [], refusees: [] };
  db.exec('PRAGMA foreign_keys = ON');
  let textes = null;
  const proteges = new Set(Object.values(IDS_DES_MOTS_CLES_PROTEGES).filter((v) => v !== null));
  for (const table of tables) {
    if (!tableExiste(db, table)) { rapport.refusees.push({ table, raison: 'table absente' }); continue; }
    const cle = colonnes(db, table).filter((c) => c.pk > 0).sort((a, b) => a.pk - b.pk).map((c) => c.name);
    if (cle.length !== 1) { rapport.refusees.push({ table, raison: 'clé primaire composée' }); continue; }
    const [k] = cle;
    // les enfants partent avec leur parent (ON DELETE CASCADE, ou table « <table>_… » : les rubriques d'un monstre, les extraits d'un événement) ;
    // toute autre ligne qui la cite (un don d'une spécialité, une capacité qui en reprend une commune) la rend non retirable
    const refs = referencesVers(db, table);
    const enfant = (r) => r.on_delete === 'CASCADE' || r.table.startsWith(`${table}_`);
    const conditions = refs.filter((r) => !enfant(r)).map((r) => `NOT EXISTS (SELECT 1 FROM ${q(r.table)} x WHERE x.${q(r.from)} = t.${q(r.to ?? k)})`);
    conditions.push(`NOT EXISTS (SELECT 1 FROM page_entite p WHERE p.entite_table = ? AND p.entite_id = CAST(t.${q(k)} AS TEXT) AND p.principale = 1)`);
    const candidats = db.prepare(`SELECT t.${q(k)} AS id${table === 'mot_cle' ? ', t.cle' : ''} FROM ${q(table)} t WHERE ${conditions.join(' AND ')} ORDER BY t.${q(k)}`).all(table);
    let fait = null;
    let derniere = 'aucune ligne sans dépendant';
    let essais = 0;
    for (const c of candidats) {
      if (table === 'mot_cle') {
        if (proteges.has(c.id)) continue;
        // un homonyme : sa clé distingue l'autre (« <libellé>-<catégorie> »), que le service recalculerait ; on n'en retire pas
        if (db.prepare('SELECT count(*) AS n FROM mot_cle a JOIN mot_cle b ON b.id <> a.id AND lower(b.libelle) = lower(a.libelle) WHERE a.id = ?').get(c.id).n) continue;
        textes ??= corpus(db);
        if (textes.includes(c.cle)) continue;
      }
      if (essais++ >= ESSAIS_PAR_TABLE) break;
      db.exec('SAVEPOINT retrait');
      try {
        let enfants = 0;
        for (const r of refs.filter(enfant)) enfants += Number(db.prepare(`DELETE FROM ${q(r.table)} WHERE ${q(r.from)} = ?`).run(c.id).changes);
        db.prepare('DELETE FROM page_entite WHERE entite_table = ? AND entite_id = ? AND principale = 0').run(table, String(c.id));
        db.prepare(`DELETE FROM ${q(table)} WHERE ${q(k)} = ?`).run(c.id);
        db.exec('RELEASE retrait');
        fait = { table, cle: { [k]: c.id }, enfants };
        break;
      } catch (e) {
        db.exec('ROLLBACK TO retrait');
        db.exec('RELEASE retrait');
        derniere = String(e.message).split('\n')[0];
      }
    }
    if (fait) rapport.faites.push(fait);
    else rapport.refusees.push({ table, raison: derniere });
  }
  return rapport;
}

/** Les variantes, par nom de passe. */
export const VARIANTES = Object.freeze({ V1: v1IconesVariees, V2: v2MagieRenommee, V3: v3LignesAjoutees, V4: v4LignesRetirees });
