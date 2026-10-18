// Fiches de personnages dans la base vivante, au format de src/lib/fiche-format.mjs (docs/serveur.md, « Une fiche en JSON »).
// Avant la 1.0, il n'y a pas de comptes : le service ne connaît que les PRÉTIRÉS, qui ne sont à personne et que tout le monde voit
// (v_personnage_visible) ; une fiche de joueur n'est ni listée ni lisible ici. Ce que la base contrôle (types, bornes, références aux règles) refuse
// l'enregistrement ; les règles de v_personnage_controle sont rendues avec la fiche : elles signalent, elles n'empêchent jamais d'enregistrer (la fiche
// n'a plus de statut « validé » qui les rendait bloquantes : demande du propriétaire, migration 0038).
import { randomUUID } from 'node:crypto';
import {
  armuresAvecArmure, bouclierAvecMatiere, entrainementAvecLignes, CHAMP_VERSION, COLONNES_DU_SERVICE, COLONNES_RETIREES, PARTIES_DE_FICHE, ficheVide, nmDuMjAvecCadeaux, progressionAvecGains,
  sansPartiesRetirees,
} from '../src/lib/fiche-format.mjs';
import { cadrageDe, dimensionsDuPortrait, empreinte, estUnPortrait, octetsDuPortrait, styleDuCadrage } from '../src/lib/portrait.mjs';
import { clesRompues } from './base-vivante.mjs';
import { instant } from './instant.mjs';
import { ErreurHttp, empreinteCourte } from './partage.mjs';

/**
 * Valeur de départ d'une colonne que les règles ont retirée (COLONNES_RETIREES) quand la base vivante l'a encore : le service retombe sur sa base
 * d'avant si la reconstruction échoue (docs/serveur.md), et cette base exigerait la colonne (NOT NULL) à chaque création.
 */
const DEPART_DES_COLONNES_RETIREES = Object.freeze({ statut: 'brouillon' });
/** De même pour une table de détail : l'acquis saisi d'une compétence (décision R104, migration 0062 : il se calcule), NOT NULL dans une base d'avant. */
const DEPART_DES_COLONNES_RETIREES_DE_DETAIL = Object.freeze({ personnage_competence: Object.freeze({ acquis: 0 }) });

/**
 * Colonnes que les règles ont ajoutées à la section 13, par table, avec leur valeur de départ (celle d'une fiche vide) : celles de la migration 0045
 * (gains de niveau en deux totaux, R73 ; durabilité d'une arme, R74 ; son entraînement en texte, R71, retiré par la migration 0062 :
 * COLONNES_RETIREES), de la migration 0055 (l'armure de la fiche, R95), de la migration 0060 (le bouclier forme + matière, R96) et de la migration
 * 0061 (la magie de la Symbiose, R100), de la migration 0066 (les NM du MJ de la fiche, R118) et de la migration 0067 (le sort préparé, son jet et sa
 * posture, R115 ; l'arme choisie d'un choix d'acquis, R119, que la page laisse vide). Quand le
 * service retombe sur sa base d'avant (reconstruction échouée, docs/serveur.md), la page à jour les envoie quand même (ficheVide met les gains à 0) :
 * une de ces colonnes que la base n'a pas est ignorée tant qu'elle ne porte rien (sa valeur de départ, ou vide : null, « "" ») ; autrement, « champ
 * inconnu » (ce qu'elle porte serait perdu). De même une table de la fiche que la base n'a pas encore (personnage_armure_partie, 0055 ;
 * personnage_entrainement et personnage_acquis_choix, 0062 : partiesDeLaBase) se lit vide, et une liste non vide pour elle est refusée.
 */
export const DEPART_DES_COLONNES_AJOUTEES = Object.freeze({
  personnage: Object.freeze({
    gains_sante: 0, gains_chakra: 0,
    armure_id: null, armure_amelioration_id: null, armure_elementaire_id: null, armure_amelioration_elementaire_id: null,
    bouclier_materiau_id: null, bouclier_amelioration_id: null, bouclier_solidite: null,
    symbiose_magie_id: null,
    nm_mj: 0,
  }),
  personnage_arme: Object.freeze({ durabilite: null }),
  personnage_sort: Object.freeze({ prepare: 0, prepare_jet: null, prepare_posture_id: null }),
  personnage_acquis_choix: Object.freeze({ arme_famille_id: null }),
});

/** Vrai si `valeur`, reçue pour la colonne `colonne` de `table` que la base vivante n'a pas, ne porte rien (DEPART_DES_COLONNES_AJOUTEES). */
function ajouteeSansRien(table, colonne, valeur) {
  const departs = DEPART_DES_COLONNES_AJOUTEES[table] ?? {};
  if (!Object.hasOwn(departs, colonne)) return false;
  return valeur === null || valeur === undefined || valeur === '' || valeur === departs[colonne];
}

/** Message d'un envoi qui porte les deux formes des gains de niveau (progressionAvecGains de src/lib/fiche-format.mjs). */
export const PAGE_D_AVANT = 'La page vient d’une version précédente du site : rien n’a été enregistré. Rechargez-la, puis saisissez de nouveau ce '
  + 'que vous avez changé depuis le dernier enregistrement (les gains de niveau se saisissent désormais en deux totaux, santé et chakra ; '
  + 'l’armure est une seule armure complète, avec la solidité de chacune de ses parties ; le bouclier a une forme et une matière ; '
  + 'les accessoires n’ont plus que six emplacements, sans nom ni effet hors table ; l’entraînement se note en lignes et l’acquis se calcule ; '
  + 'les NM du MJ se notent pour toute la fiche, à côté de la limite des NM, et plus sort par sort).';

/** Au plus tant de lignes par liste (une fiche en a quelques dizaines) : un envoi aberrant est refusé avant d'écrire. */
export const LIGNES_MAX = 500;

/** @param {number} statut code HTTP @param {string} message @param {object} [details] ajoutés à la réponse */
export class ErreurFiche extends ErreurHttp {}

export { instant };

const infos = (db, table) => db.prepare(`PRAGMA table_info("${table}")`).all();
const colonnesDeDetail = (db, table) => infos(db, table).map((c) => c.name).filter((c) => c !== 'personnage_id');
const colonnesModifiables = (db) => infos(db, 'personnage').map((c) => c.name).filter((c) => !COLONNES_DU_SERVICE.includes(c));
/**
 * Les parties de la fiche (PARTIES_DE_FICHE) dont la base a la table : toutes, sauf dans une base vivante d'avant qu'une nouvelle table de la section
 * 13 ne connaît pas encore (le service y retombe si la reconstruction échoue : DEPART_DES_COLONNES_AJOUTEES).
 */
const partiesDeLaBase = (db) => Object.entries(PARTIES_DE_FICHE).filter(([, table]) => infos(db, table).length > 0);
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
  return empreinteCourte(JSON.stringify(contenu));
}

/** Le prétiré `id` au format d'échange (colonnes à la racine, listes, `version`), ou null. */
export function lireFiche(db, id) {
  const ligne = db.prepare(`SELECT * FROM personnage WHERE id = ? AND nature = 'pretire'`).get(id);
  if (!ligne) return null;
  const fiche = { ...ligne, ...Object.fromEntries(Object.keys(PARTIES_DE_FICHE).map((cle) => [cle, []])) };
  for (const [cle, table] of partiesDeLaBase(db)) {
    const cols = colonnesDeDetail(db, table).map((c) => `"${c}"`).join(', ');
    fiche[cle] = db.prepare(`SELECT ${cols} FROM "${table}" WHERE personnage_id = ? ORDER BY ${ordreDe(db, table)}`).all(id).map((r) => ({ ...r }));
  }
  fiche[CHAMP_VERSION] = versionDe(fiche);
  return fiche;
}

/**
 * Supprime le prétiré `id` (demande du propriétaire) et toutes ses lignes : les tables de la fiche sont en ON DELETE CASCADE, une inscription dans un
 * groupe passe à NULL (groupe_membre). Exige la `version` lue, comme une modification : si la fiche a changé depuis, rien n'est supprimé (409).
 * Erreurs : ErreurFiche (404, 409).
 */
export function supprimerFiche(db, id, version) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const avant = lireFiche(db, id);
    if (!avant) throw new ErreurFiche(404, 'Fiche introuvable.');
    if (version !== avant[CHAMP_VERSION]) {
      throw new ErreurFiche(409, 'Cette fiche a été modifiée entre-temps : rechargez-la avant de la supprimer.', { personnage: avant });
    }
    db.prepare("DELETE FROM personnage WHERE id = ? AND nature = 'pretire'").run(id);
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
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

/**
 * Clé SQL de l'image d'un portrait, sans la lire : l'instant de la dernière modification de la fiche (chaque enregistrement par le service le change)
 * et la taille de l'image en octets (octet_length la tire de l'en-tête de la ligne ; length ou substr reliraient les 700 000 caractères). NULL sans
 * portrait.
 */
const CLE_DU_PORTRAIT = "p.modifie_le || ':' || octet_length(p.portrait)";

/**
 * Ce que la liste et l'adresse d'un portrait tirent de l'image — lisible ou non, empreinte, type, dimensions —, gardé d'un appel à l'autre par fiche :
 * le calcul relit toute la data URL (jusqu'à 700 000 caractères, une quinzaine de millisecondes par fiche, pendant lesquelles le service ne répond à
 * rien d'autre), la clé (CLE_DU_PORTRAIT) ne la lit pas. Une entrée par fiche, refaite quand son image change ; null sans image lisible.
 */
const IMAGES = new Map();
function imageDuPortrait(db, id, cle) {
  if (cle === null || cle === undefined) return null;
  const connue = IMAGES.get(id);
  if (connue?.cle === cle) return connue.image;
  const { portrait } = db.prepare('SELECT portrait FROM personnage WHERE id = ?').get(id) ?? {};
  const image = estUnPortrait(portrait)
    ? { empreinte: empreinte(portrait), type: portrait.slice('data:'.length, portrait.indexOf(';')), dimensions: dimensionsDuPortrait(portrait) }
    : null;
  IMAGES.set(id, { cle, image });
  return image;
}

/**
 * Le portrait d'une fiche dans la liste des personnages : l'empreinte de l'image (adresse de portraitDeFiche, qui change avec elle) et le style qui en
 * montre le carré cadré dans un cadre carré (lib/portrait.mjs#styleDuCadrage, comme les cartes du bestiaire) ; null sans image lisible (le logo).
 */
function portraitDansLaListe(db, ligne) {
  const image = imageDuPortrait(db, ligne.id, ligne.portrait_cle);
  if (!image) return null;
  const cadrage = cadrageDe({ x: ligne.portrait_x, y: ligne.portrait_y, zoom: ligne.portrait_zoom });
  return { empreinte: image.empreinte, style: styleDuCadrage(cadrage, image.dimensions) };
}

/**
 * Résumé de chaque prétiré, pour la recherche : identité, portrait (portraitDansLaListe : l'image elle-même se lit par portraitDeFiche), race, magies,
 * classes, niveau, nombre de règles enfreintes.
 */
export function listerFiches(db) {
  const fiches = db.prepare(`
    SELECT p.id, p.nom, p.surnom, p.lieu_origine, p.xp, p.mode_classe, ${CLE_DU_PORTRAIT} AS portrait_cle, p.portrait_x, p.portrait_y, p.portrait_zoom,
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
    ORDER BY p.nom COLLATE NOCASE, p.id`).all().map(({ portrait_cle, portrait_x, portrait_y, portrait_zoom, ...r }) => ({
    ...r, portrait: portraitDansLaListe(db, { id: r.id, portrait_cle, portrait_x, portrait_y, portrait_zoom }), classes: [], anomalies: 0,
  }));
  const parId = new Map(fiches.map((f) => [f.id, f]));
  for (const id of IMAGES.keys()) if (!parId.has(id)) IMAGES.delete(id); // fiches supprimées : leur entrée part
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

/**
 * L'image du portrait du prétiré `id` (GET /api/personnages/<id>/portrait/ : la liste des personnages la montre sans recevoir les data URL de toutes
 * les fiches) : son empreinte et son type (imageDuPortrait), et `octets()`, qui ne la décode que si on la sert (pas pour un 304) ; null sans fiche,
 * sans portrait ou si l'image ne se décode pas.
 */
export function portraitDeFiche(db, id) {
  const ligne = db.prepare(`SELECT ${CLE_DU_PORTRAIT} AS cle FROM personnage p WHERE p.id = ? AND p.nature = 'pretire'`).get(id);
  const image = imageDuPortrait(db, id, ligne?.cle);
  if (!image) return null;
  return {
    empreinte: image.empreinte,
    type: image.type,
    octets: () => octetsDuPortrait(db.prepare('SELECT portrait FROM personnage WHERE id = ?').get(id)?.portrait),
  };
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

/** Index uniques partiels qui ne nomment que la fiche (« UNIQUE constraint failed: <table>.personnage_id ») : ce qu'ils refusent. */
const UNIQUES_DE_LA_FICHE = Object.freeze({ 'personnage_sort.personnage_id': 'un seul sort préparé par fiche (décision R115)' });

/** Message d’une contrainte de la base, en français (exporté pour les tests). */
export function expliquer(message) {
  let m;
  if ((m = /^NOT NULL constraint failed: \w+\.(\w+)$/.exec(message))) return `« ${m[1]} » est obligatoire`;
  if ((m = /^CHECK constraint failed: ([\s\S]+)$/.exec(message))) return `valeur hors des bornes (${m[1].replace(/\s+/g, ' ').trim()})`;
  if ((m = /^UNIQUE constraint failed: (.+)$/.exec(message))) {
    // un index unique partiel sur la seule fiche (personnage_sort_prepare, migration 0067) : SQLite ne nomme que personnage_id
    if (UNIQUES_DE_LA_FICHE[m[1].trim()]) return UNIQUES_DE_LA_FICHE[m[1].trim()];
    const cols = m[1].split(',').map((c) => c.trim().replace(/^\w+\./, '')).filter((c) => c !== 'personnage_id');
    return `en double (${cols.join(', ')})`;
  }
  // un choix que les règles n'ont plus (don ou spécialité supprimé depuis le site de dev, D11) : la page a été construite avant
  if (/FOREIGN KEY constraint failed/.test(message)) return 'un choix de la fiche (don, spécialité…) n’existe plus dans les règles : rechargez la page';
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
    if (COLONNES_RETIREES.personnage.includes(cle)) continue; // colonne que les règles ont retirée (fichier exporté avant, page restée ouverte) : ignorée
    // colonne ajoutée par les règles, absente d'une base vivante d'avant (le service y retombe si la reconstruction échoue) : ignorée si elle ne porte rien
    if (ajouteeSansRien('personnage', cle, entree[cle])) continue;
    if (cle in PARTIES_DE_FICHE) {
      const liste = entree[cle];
      const table = PARTIES_DE_FICHE[cle];
      if (!Array.isArray(liste)) problemes.push(`${cle} : une liste est attendue`);
      else if (liste.length > LIGNES_MAX) problemes.push(`${cle} : ${liste.length} lignes, au plus ${LIGNES_MAX}`);
      else if (!infos(db, table).length) {
        // une table que la base vivante n'a pas encore (base d'avant) : une liste vide ne porte rien, une autre serait perdue
        if (liste.length) problemes.push(`${cle} : pas encore dans cette base, ses lignes seraient perdues`);
      } else {
        const colonnes = new Set(colonnesDeDetail(db, table));
        liste.forEach((l, i) => {
          if (!l || typeof l !== 'object' || Array.isArray(l)) problemes.push(`${cle}[${i}] : un objet est attendu`);
          else for (const c of Object.keys(l)) if (!colonnes.has(c) && !ajouteeSansRien(table, c, l[c])) problemes.push(`${cle}[${i}] : champ inconnu « ${c} »`);
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
 * changé depuis, rien n'est écrit (409). Rend { personnage, controles, niveau }. Erreurs : ErreurFiche (400 forme ou contrainte, 404, 409).
 * La clé d'une table que les règles ont retirée est convertie d'abord (sansPartiesRetirees de src/lib/fiche-format.mjs) : une page restée ouverte
 * qui envoie encore `progression` enregistre ses gains de niveau en deux totaux (décision R73), sans « champ inconnu ». Une `progression` non vide
 * envoyée AVEC les deux totaux (progressionAvecGains : page d'avant 0045 qui a repris les totaux d'une réponse) ne se concilie pas avec eux : refus
 * 409 (PAGE_D_AVANT), rien n'est écrit, plutôt que d'en jeter une sans le dire. De même une liste `armures` (une armure par emplacement, avant la
 * migration 0055) donne l'armure de la fiche, chaque autre pièce une ligne datée dans les notes (décision R95) ; envoyée avec les nouvelles clés de
 * l'armure (armuresAvecArmure) : refus 409. Une liste `bouclier_materiaux` (avant la migration 0060) donne la matière du bouclier (R96 ; avec les
 * nouvelles clés du bouclier, bouclierAvecMatiere : refus 409), et les accessoires d'avant (nom, effet hors table, Ceinture, Autre) sont convertis (R97).
 * Des sorts qui portent leurs NM du MJ (`nm_cadeau`, avant la migration 0066) donnent les NM du MJ de la fiche (R118) ; avec `nm_mj` et des NM du MJ
 * sur un sort (nmDuMjAvecCadeaux) : refus 409.
 */
export function enregistrerFiche(db, recue, { id = null, maintenant = new Date() } = {}) {
  const problemes = [];
  if (progressionAvecGains(recue) || armuresAvecArmure(recue) || bouclierAvecMatiere(recue) || entrainementAvecLignes(recue) || nmDuMjAvecCadeaux(recue)) {
    throw new ErreurFiche(409, PAGE_D_AVANT);
  }
  const nomDans = (table) => (x) => db.prepare(`SELECT nom FROM "${table}" WHERE id = ?`).get(x)?.nom ?? null;
  // les notes enregistrées : une ligne de conversion s'y ajoute quand l'envoi (partiel) n'a pas les siennes ; la version, contrôlée plus bas, garantit
  // qu'elles n'ont pas changé depuis
  const notes = id === null ? null : db.prepare('SELECT notes FROM personnage WHERE id = ?').get(id)?.notes ?? null;
  const libelle = db.prepare('SELECT libelle FROM accessoire_effet WHERE id = ?');
  const entree = sansPartiesRetirees(recue, {
    instant: instant(maintenant), notes,
    noms: {
      armure: nomDans('armure'), emplacement: nomDans('armure_emplacement'), ressource: nomDans('ressource'), accessoire: (x) => libelle.get(x)?.libelle ?? null,
      competence: nomDans('competence'),
    },
  });
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
      const depart = { ...ficheVide(), ...Object.fromEntries(COLONNES_RETIREES.personnage.map((c) => [c, DEPART_DES_COLONNES_RETIREES[c] ?? null])) };
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
      for (const [cle, table] of partiesDeLaBase(db)) {
        if (!(cle in entree)) continue;
        db.prepare(`DELETE FROM "${table}" WHERE personnage_id = ?`).run(id);
        const colonnes = colonnesDeDetail(db, table);
        // une colonne que les règles ont retirée et que cette base (d'avant) exige encore : sa valeur de départ
        const departs = Object.entries(DEPART_DES_COLONNES_RETIREES_DE_DETAIL[table] ?? {}).filter(([c]) => colonnes.includes(c));
        entree[cle].forEach((l0, i) => {
          const l = departs.length ? { ...Object.fromEntries(departs), ...l0 } : l0;
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
      for (const [cle, table] of partiesDeLaBase(db)) {
        for (const r of clesRompues(db, table, { ou: 't.personnage_id = ?', valeurs: [id] })) {
          problemes.push(`${cle} : « ${r.colonnes.join(', ')} » = « ${r.valeur} » n’existe pas dans les règles (${r.parent})`);
        }
      }
    }
    if (problemes.length) throw new ErreurFiche(400, 'La fiche n’a pas été enregistrée.', { problemes });

    const controles = controlesDe(db, id);
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
