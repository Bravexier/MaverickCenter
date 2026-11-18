// Variantes mécaniques d'un contenu (essai mécanique des tests, passes V1 à V4 : scripts/essai-mecanique-tests.mjs ; lot 10 du chantier de la base de dev,
// R274, R278). Chacune est une modification que le propriétaire peut faire sur le site de dev ; un test qui casse dessus fige une valeur modifiable.
//   V1  des icônes (lib/icones.mjs#ICONES) posées sur des mots-clés de genres variés : quelques-uns par catégorie de mot-clé, par type de page qui les
//       porte (page_tag), et ceux des magies et des types de dégâts ;
//   V2  un sort renommé PAR LE SERVICE d'édition (serveur/edition.mjs#enregistrer : validations, dérivations — le corps de la page de sa magie —,
//       journal), puis versé dans l'historique comme l'extrait le fait (serveur/historique.mjs#historiser), journal vidé : identifiant inchangé.
//       Pas une magie : magie.nom n'est pas modifiable sur le site (lib/edition-modele.mjs#TABLES.magie) ; une variante qui la renommait figeait à
//       tort les tests qui lisent une magie par son nom ;
//   V3  une ligne créée PAR LE SERVICE (opération « creer » de lib/edition-modele.mjs#ENTITES, valeurs tirées de la dernière ligne de la table, noms
//       suffixés) dans quelques tables que le site sait créer : ses validations (un refus est noté : une troisième spécialité), ses lignes filles et le
//       corps de la page qui la montre ; puis les magies innées d'une race lue par test/races-html.test.mjs changées d'une magie (opération
//       `magies_innees`). Chaque lot est versé dans l'historique, journal vidé, comme le fait l'extrait ;
//   V4  une ligne retirée dans quelques tables que le site sait vider (ENTITES « suppression ») : la première sans dépendant (aucune clé étrangère
//       vers elle hors ON DELETE CASCADE, aucune page qui lui appartienne (page_entite principale), et pour un mot-clé : non protégé, sans homonyme,
//       cité par aucun texte) ; son rattachement non principal à une page est retiré avec elle, comme le fait le service ;
//   V5  une magie renommée (`nom`, `nom_cle`), en écriture directe avec sa trace : HORS des voies du site aujourd'hui (le service refuse magie.nom, le titre
//       de sa page et un alias : test/serveur-edition-nom-de-magie.test.mjs) ; informative, elle ne bloque rien.
// Chaque fonction reçoit la base ouverte en écriture (une copie de l'extrait) et rend un rapport { variante, faites: [...], refusees: [...] }.
// Comme une saisie du site de dev, chaque ligne écrite laisse sa trace dans historique_modification (nature « saisie », version NULL : ce que l'extrait
// verse pour une modification du journal, serveur/historique.mjs#historiser), avant et après comme les note le journal (serveur/edition-journal.mjs :
// la ligne entière pour une insertion ou une suppression, les seules colonnes changées pour une modification) : l'état d'import
// (lib/historique-site.mjs, test/aide-base-d-import.mjs) défait la variante, comme il défait une vraie saisie.
import { enregistrer } from '../serveur/edition.mjs';
import { historiser } from '../serveur/historique.mjs';
import { ENTITES, journalSansImage } from '../src/lib/edition-modele.mjs';
import { cleDeLigne } from '../src/lib/historique-site.mjs';
import { ICONES } from '../src/lib/icones.mjs';
import { IDS_DES_MOTS_CLES_PROTEGES } from '../src/lib/mots-cles-proteges.mjs';
import { TABLES_DU_JOURNAL } from '../src/lib/tables-de-la-base.mjs';
import { normalize } from '../src/lib/text.mjs';

const q = (nom) => `"${String(nom).replace(/"/g, '""')}"`;
const colonnes = (db, table) => db.prepare(`PRAGMA table_info(${q(table)})`).all();
const tableExiste = (db, table) => Boolean(db.prepare("SELECT 1 AS x FROM sqlite_master WHERE type = 'table' AND name = ?").get(table));

/**
 * Le journal d'une variante : un lot de saisies (`essai-mecanique-<variante>`, suffixé s'il existe déjà) dont chaque écriture est versée dans
 * historique_modification. `inserer(table, ligne)`, `supprimer(table, ligne)` (la ligne entière), `modifier(table, ligne, apres)` (la ligne avant,
 * les colonnes changées). Une écriture défaite (ROLLBACK TO) défait sa trace avec elle. Sans table d'historique (base très ancienne) : rien n'est noté.
 */
export function journalDeLaVariante(db, variante) {
  if (!tableExiste(db, 'historique_modification')) return { inserer() {}, supprimer() {}, modifier() {} };
  let lot = `essai-mecanique-${variante}`;
  for (let n = 2; db.prepare('SELECT 1 AS x FROM historique_modification WHERE lot_id = ?').get(lot); n += 1) lot = `essai-mecanique-${variante}-${n}`;
  const dernier = db.prepare('SELECT max(fait_le) AS f FROM historique_modification').get().f;
  const maintenant = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  const faitLe = dernier && dernier > maintenant ? dernier : maintenant; // jamais avant une saisie déjà là : l'ordre de lecture est (fait_le, lot_id, rang)
  const resume = `Essai mécanique des tests : variante ${variante}`;
  const noter = db.prepare(`INSERT INTO historique_modification (lot_id, rang, fait_le, resume, version, table_nom, cle, operation, avant, apres, nature, decision)
    VALUES (?, (SELECT coalesce(max(rang), 0) + 1 FROM historique_modification WHERE lot_id = ?), ?, ?, NULL, ?, ?, ?, ?, ?, 'saisie', NULL)`);
  const json = (table, o) => (o === null ? null : journalSansImage(table, JSON.stringify(o)));
  const note = (table, ligne, operation, avant, apres) => noter.run(lot, lot, faitLe, resume, table, JSON.stringify(cleDeLigne(db, table, ligne)), operation,
    json(table, avant), json(table, apres));
  return {
    inserer: (table, ligne) => note(table, ligne, 'inserer', null, ligne),
    supprimer: (table, ligne) => note(table, ligne, 'supprimer', ligne, null),
    modifier: (table, ligne, apres) => {
      const changees = Object.keys(apres).filter((c) => ligne[c] !== apres[c]);
      if (changees.length) note(table, ligne, 'modifier', Object.fromEntries(changees.map((c) => [c, ligne[c]])), Object.fromEntries(changees.map((c) => [c, apres[c]])));
    },
  };
}

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
  const journal = journalDeLaVariante(db, 'V1');
  let i = 0;
  for (const [id, groupe] of choisis) {
    const icone = ICONES[i++ % ICONES.length].valeur;
    try {
      const avant = db.prepare('SELECT * FROM mot_cle WHERE id = ?').get(id);
      poser.run(icone, id);
      journal.modifier('mot_cle', avant, { icone });
      rapport.faites.push({ table: 'mot_cle', id, groupe, icone });
    } catch (e) {
      rapport.refusees.push({ table: 'mot_cle', id, raison: String(e.message).split('\n')[0] });
    }
  }
  return rapport;
}

/** Le lot d'une variante : `essai-mecanique-<variante>`, suffixé s'il est déjà dans l'historique (un contenu qui porte déjà la variante). */
function idDuLot(db, variante) {
  let lot = `essai-mecanique-${variante}`;
  for (let n = 2; db.prepare('SELECT 1 AS x FROM historique_modification WHERE lot_id = ? UNION SELECT 1 FROM modification_lot WHERE id = ?').get(lot, lot); n += 1) {
    lot = `essai-mecanique-${variante}-${n}`;
  }
  return lot;
}

/**
 * Un lot fait PAR LE SERVICE d'édition (serveur/edition.mjs#enregistrer : validations, dérivations, journal), puis ce que fait l'extrait du site de dev :
 * le journal versé dans l'historique (serveur/historique.mjs#historiser, nature « saisie »), les tables propres au site vidées. Rend l'id du lot ;
 * un refus du service lève son erreur (rien n'est écrit).
 */
function parLeService(db, variante, page, operations) {
  const lot = idDuLot(db, variante);
  const resultat = enregistrer(db, { page, operations }, { id: lot, instant: new Date().toISOString().replace(/\.\d+Z$/, 'Z') });
  historiser(db);
  for (const table of ['modification', ...TABLES_DU_JOURNAL.filter((t) => t !== 'modification')]) db.exec(`DELETE FROM "${table}"`); // liste figée du code
  return { lot, resultat };
}

/** Les magies innées d'une race comme le service les lit : la liste de son onglet (R11) si elle en a une, sinon la matrice de la fiche (R8). */
function magiesInneesDe(db, raceId) {
  const onglet = db.prepare('SELECT magie_id FROM race_magie_onglet WHERE race_id = ? ORDER BY rang').all(raceId).map((l) => l.magie_id);
  return onglet.length ? onglet : db.prepare('SELECT magie_id FROM race_magie WHERE race_id = ? AND accessible = 1').all(raceId).map((l) => l.magie_id);
}

/** Les races dont V3 change les magies innées : la première présente (une race que test/races-html.test.mjs lit en particulier). */
const RACES_DE_V3 = Object.freeze(['races/nain', 'races/orios', 'races/drassahthac', 'races/humain']);

/**
 * V3, par le service : les magies innées d'une race changent (opération `magies_innees`) : la première magie qu'elle n'a pas s'ajoute, ou, si elle les a
 * toutes, sa dernière part (jamais une liste vide : R210). Rend { faite } ou { refusee }.
 */
function changerLesMagiesInnees(db) {
  const race = RACES_DE_V3.map((id) => db.prepare('SELECT id FROM race WHERE id = ?').get(id)).find(Boolean);
  if (!race) return { refusee: { table: 'race_magie', raison: 'aucune race de RACES_DE_V3' } };
  const avant = magiesInneesDe(db, race.id);
  const absente = db.prepare('SELECT id FROM magie ORDER BY ordre').all().map((m) => m.id).find((id) => !avant.includes(id));
  const apres = absente ? [...avant, absente] : avant.slice(0, -1);
  if (!apres.length) return { refusee: { table: 'race_magie', raison: `${race.id} : une seule magie innée, aucune à ajouter` } };
  try {
    const { lot } = parLeService(db, 'V3', race.id, [{ op: 'magies_innees', race: race.id, magies: apres }]);
    return { faite: { race: race.id, lot, avant, apres } };
  } catch (e) {
    return { refusee: { table: 'race_magie', raison: String(e.message).split('\n')[0] } };
  }
}

export function v2SortRenomme(db) {
  const rapport = { variante: 'V2', faites: [], refusees: [] };
  db.exec('PRAGMA foreign_keys = ON');
  const sort = db.prepare('SELECT s.id, s.nom, s.magie_id FROM sort s JOIN magie m ON m.id = s.magie_id ORDER BY m.id, s.id LIMIT 1').get();
  if (!sort) return { ...rapport, refusees: [{ table: 'sort', raison: 'aucun sort' }] };
  // un nom toujours nouveau, même sur un contenu déjà renommé (la passe V2 lance aussi le test de cette variante)
  let nom = `${sort.nom} renommé`;
  for (let n = 2; db.prepare('SELECT 1 AS x FROM sort WHERE magie_id = ? AND nom = ?').get(sort.magie_id, nom); n += 1) nom = `${sort.nom} renommé ${n}`;
  let lot;
  try {
    ({ lot } = parLeService(db, 'V2', sort.magie_id, [{ op: 'modifier', table: 'sort', cle: { id: sort.id }, valeurs: { nom } }]));
  } catch (e) {
    return { ...rapport, refusees: [{ table: 'sort', raison: String(e.message).split('\n')[0] }] };
  }
  rapport.faites.push({ table: 'sort', id: sort.id, lot, avant: sort.nom, apres: nom });
  return rapport;
}

const NOMS = ['nom', 'titre', 'libelle', 'intitule'];

/**
 * Les valeurs de création d'une entité (lib/edition-modele.mjs#ENTITES) tirées de la dernière ligne de sa table, son modèle : chaque champ que la ligne
 * porte (les noms suffixés « essai »), et pour un champ obligatoire qu'elle n'a pas, une valeur d'essai de son type (texte, premier choix, 1).
 */
function valeursDeCreation(entite, modele) {
  const valeurs = {};
  for (const [c, champ] of Object.entries(entite.champs)) {
    const v = modele[c];
    if (v !== undefined && v !== null && v !== '' && !['ids', 'ecritures'].includes(champ.type)) valeurs[c] = NOMS.includes(c) ? `${v} essai` : v;
    else if (champ.requis) {
      valeurs[c] = champ.type === 'choix' && champ.choix?.length ? champ.choix[0].valeur : champ.type === 'entier' ? 1 : `Essai ${champ.libelle}`;
    }
  }
  return valeurs;
}

export function v3LignesAjoutees(db, tables = TABLES_AJOUTEES) {
  const rapport = { variante: 'V3', faites: [], refusees: [] };
  db.exec('PRAGMA foreign_keys = ON');
  for (const table of tables) {
    const [nom, entite] = Object.entries(ENTITES).find(([, e]) => e.table === table) ?? [];
    if (!entite || !tableExiste(db, table)) { rapport.refusees.push({ table, raison: 'table absente ou sans création depuis le site' }); continue; }
    const cle = colonnes(db, table).filter((c) => c.pk > 0).sort((a, b) => a.pk - b.pk).map((c) => c.name);
    const modele = db.prepare(`SELECT * FROM ${q(table)} ORDER BY ${cle.map(q).join(' DESC, ')} DESC LIMIT 1`).get();
    if (!modele || cle.length !== 1) { rapport.refusees.push({ table, raison: modele ? 'clé primaire composée' : 'aucune ligne modèle' }); continue; }
    // par le service (opération « creer ») : ses validations (un refus est noté, jamais forcé : une troisième spécialité, SPECIALITES_MAX), ses lignes
    // filles (types de dégâts d'une arme, blocs d'un événement), le corps de la page qui la montre ; un lot par création
    try {
      const { lot, resultat } = parLeService(db, 'V3', null, [{ op: 'creer', entite: nom, valeurs: valeursDeCreation(entite, modele) }]);
      const cree = resultat.crees.find((c) => c.entite === nom);
      rapport.faites.push({ table, lot, cle: { [cle[0]]: cree.id } });
    } catch (e) {
      rapport.refusees.push({ table, raison: String(e.message).split('\n')[0] });
    }
  }
  // puis, par le service, les magies innées d'une race (lot à part, versé dans l'historique)
  const innees = changerLesMagiesInnees(db);
  if (innees.faite) rapport.faites.push({ table: 'race_magie', operation: 'magies_innees', ...innees.faite });
  else rapport.refusees.push(innees.refusee);
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
  const journal = journalDeLaVariante(db, 'V4');
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
        // chaque ligne retirée est notée, les enfants d'abord (comme le service : serveur/edition-journal.mjs)
        for (const r of refs.filter(enfant)) {
          for (const l of db.prepare(`SELECT * FROM ${q(r.table)} WHERE ${q(r.from)} = ?`).all(c.id)) journal.supprimer(r.table, l);
          enfants += Number(db.prepare(`DELETE FROM ${q(r.table)} WHERE ${q(r.from)} = ?`).run(c.id).changes);
        }
        for (const l of db.prepare('SELECT * FROM page_entite WHERE entite_table = ? AND entite_id = ? AND principale = 0').all(table, String(c.id))) journal.supprimer('page_entite', l);
        db.prepare('DELETE FROM page_entite WHERE entite_table = ? AND entite_id = ? AND principale = 0').run(table, String(c.id));
        journal.supprimer(table, db.prepare(`SELECT * FROM ${q(table)} WHERE ${q(k)} = ?`).get(c.id));
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

export function v5MagieRenommee(db) {
  const rapport = { variante: 'V5', faites: [], refusees: [] };
  const magie = db.prepare('SELECT * FROM magie ORDER BY id LIMIT 1').get();
  if (!magie) return { ...rapport, refusees: [{ table: 'magie', raison: 'aucune magie' }] };
  // un nom toujours nouveau, même sur un contenu déjà renommé (la passe V5 lance aussi le test de cette variante)
  let nom = `Magie renommée ${magie.id}`;
  for (let n = 2; nom === magie.nom; n += 1) nom = `Magie renommée ${magie.id} (${n})`;
  db.prepare('UPDATE magie SET nom = ?, nom_cle = ? WHERE id = ?').run(nom, normalize(nom), magie.id);
  journalDeLaVariante(db, 'V5').modifier('magie', magie, { nom, nom_cle: normalize(nom) });
  rapport.faites.push({ table: 'magie', id: magie.id, avant: magie.nom, apres: nom });
  return rapport;
}

/** Les variantes, par nom de passe (V5 : hors des voies du site, informative). */
export const VARIANTES = Object.freeze({ V1: v1IconesVariees, V2: v2SortRenomme, V3: v3LignesAjoutees, V4: v4LignesRetirees, V5: v5MagieRenommee });
