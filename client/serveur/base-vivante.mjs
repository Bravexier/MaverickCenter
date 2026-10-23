// Base vivante d'une instance (dossier db/, voir docs/serveur.md) : une copie de la base des règles que publie le site (site/donnees/maverick.db,
// construite depuis data/rows), dans laquelle le service écrit les fiches de personnages, les utilisateurs et les groupes (section 13 de
// data/schema.sql) et, sur le site de dev, les modifications des règles et leur journal (section 14). Quand une livraison change les règles, la base
// vivante est refaite : nouvelle copie des règles, puis les lignes des sections 13 et 14 y sont recopiées, colonne par colonne, et les modifications
// en attente du journal sont rejouées sur les nouvelles règles (serveur/edition-journal.mjs). Un don, une spécialité (avec les dons choisis qui en
// dépendent), un sort ou un métier que les nouvelles règles n'ont plus est retiré des fiches qui l'utilisent, avec une note datée dans chacune (décision
// R42 : serveur/fiches-retraits.mjs ; la liste dans vivante.json, rendue par /api/etat). Toute autre ligne qui ne passe pas (une fiche cite une race, une
// classe, une magie… disparue, une colonne remplie n'existe plus — sauf une colonne que les règles retirent exprès, COLONNES_RETIREES de
// src/lib/fiche-format.mjs : le statut des fiches, migration 0038, perdu sans bloquer —, une contrainte a changé) fait garder la base en place telle quelle, et l'erreur dit
// pourquoi. Une table que les règles retirent de la section 13 (TABLES_RETIREES de src/lib/fiche-format.mjs) n'est plus recopiée : ses lignes sont
// converties (CONVERSIONS : personnage_progression, migration 0045, devient la somme des gains de niveau, personnage.gains_sante et gains_chakra,
// décision R73 ; personnage_armure, migration 0055, devient l'armure de la fiche, la pièce devenue l'armure complète et chaque autre pièce notées
// dans la fiche, décision R95 ; personnage_bouclier_materiau, migration 0060, devient la matière du bouclier, chaque autre matériau noté, décision R96 ;
// personnage_maitrise_arme, migration 0076, ses dés notés avec l'arme choisie de R119 en une ligne datée, aucun choix posé, décision R153),
// l'armure d'une fiche d'avant la migration 0080 (une armure et son élément) devient l'armure élémentaire, et une armure « Familier » ou une armure
// élémentaire d'une magie absente ou trop lourde pour le poids portable est retirée et notée (décision R165 : retirerLesArmuresHorsRegle de
// serveur/fiches-retraits.mjs, à chaque reconstruction ; le poids, lib/poids-portable-db.mjs),
// et les lignes qu'une table garde mais que ses nouvelles règles refusent ne sont pas recopiées (LIGNES_ECARTEES : un accessoire de la Ceinture ou
// d'« Autre », un effet hors table seul, décision R97), notées dans la fiche comme ce que perd une ligne gardée (son nom, son effet hors table) ; une
// arme du catalogue qui porte un élément (décision R167, migration 0081) est écrite convertie (COLONNES_CONVERTIES) ; jamais perdues sans le dire. Une base remplacée qui avait des lignes est d'abord archivée (db/archives/, les ARCHIVES_GARDEES
// dernières) : l'archive garde donc la base d'avant les retraits et les conversions.
// Métriques : `evenement` (facultatif, serveur/metriques.mjs) reçoit la durée du rejeu du journal, des retraits des fiches et de l'archivage.
// Node seulement (node:sqlite), sans dépendance.
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import {
  accessoiresGardes, acquisRetires, armeDAvant, armureDesArmures, COLONNES_DE_L_ARMURE, COLONNES_RETIREES, entrainementEnLignes, maitrisesDAvant, matiereDuBouclier,
  retraitsDeLArmure, retraitsDuBouclier, TABLES_FICHES, TABLES_RETIREES,
} from '../src/lib/fiche-format.mjs';
import { TABLES_DU_JOURNAL } from '../src/lib/tables-de-la-base.mjs';
import { rejouerLeJournal } from './edition.mjs';
import { instant as ecrireInstant } from './instant.mjs';
import { sha256 } from './partage.mjs';
import { noterLesRetraits, nouveauxRetraitsDeFiches, retirerLesArmuresHorsRegle, retirerLesManquants } from './fiches-retraits.mjs';
import { poidsPortableDeLaBase } from '../src/lib/poids-portable-db.mjs';

/** Tables de la section 13 (« PERSONNAGES ») de data/schema.sql : définies dans src/lib/fiche-format.mjs (le journal en tire ses tables interdites). */
export { TABLES_FICHES };
/**
 * Tables de la section 14 (« ÉDITION ») : le journal des modifications faites depuis le site de dev (serveur/edition-journal.mjs) et le brouillon de
 * la note de version (page /mise-a-jour/, serveur/notes-de-version.mjs).
 */
export const TABLES_EDITION = TABLES_DU_JOURNAL;
/** Ce que le service écrit et qui survit à un changement de règles : les fiches, puis le journal des modifications. */
export const TABLES_VIVANTES = Object.freeze([...TABLES_FICHES, ...TABLES_EDITION]);

/**
 * Conversion des lignes d'une table que les règles ont retirée (TABLES_RETIREES), de la base `ancienne` (attachée) vers les nouvelles règles (`main`),
 * après la copie des tables encore présentes. personnage_progression (une ligne par niveau atteint) : la somme par fiche, points du niveau plus le dé sur
 * la santé, le chakra ou les deux, un résultat absent comptant 0 (décision R73 ; la même que la migration 0045 et que gainsDeLaProgression de
 * src/lib/fiche-format.mjs). personnage_armure (une armure par emplacement) : l'armure de la fiche est la ligne de son premier emplacement, l'armure
 * complète d'abord (décision R95 ; la même que la migration 0055 et que armureDesArmures) ; une pièce gardée qui devient l'armure complète, et chaque
 * autre pièce qui ne porte pas la même armure (ou pas la même amélioration, le même élément), un retrait rangé dans `retraits` (retraitsDeLArmure,
 * noms lus dans les nouvelles règles) : noterLesRetraits en écrit la ligne datée dans les notes, marque la fiche modifiée et la liste dans /api/etat,
 * avec ceux de la décision R42. personnage_maitrise_arme (les dés par famille) : décision R153, noterLesMaitrisesDAvant. Une conversion est une
 * instruction SQL, ou une fonction (db, { retraits }) quand elle retire quelque chose. Une table retirée sans conversion bloque la reconstruction (ses
 * lignes seraient perdues).
 */
export const CONVERSIONS = Object.freeze({
  personnage_progression: `UPDATE main.personnage SET
    gains_sante = (SELECT COALESCE(SUM(pp.points_sante + CASE WHEN pp.de_choix IN ('sante', 'les_deux') THEN COALESCE(pp.de_resultat, 0) ELSE 0 END), 0)
                   FROM ancienne.personnage_progression pp WHERE pp.personnage_id = personnage.id),
    gains_chakra = (SELECT COALESCE(SUM(pp.points_chakra + CASE WHEN pp.de_choix IN ('chakra', 'les_deux') THEN COALESCE(pp.de_resultat, 0) ELSE 0 END), 0)
                    FROM ancienne.personnage_progression pp WHERE pp.personnage_id = personnage.id)
    WHERE id IN (SELECT personnage_id FROM ancienne.personnage_progression)`,
  personnage_armure: (db, { retraits }) => {
    const nom = (table) => {
      const lire = db.prepare(`SELECT nom FROM main."${table}" WHERE id = ?`);
      return (id) => lire.get(id)?.nom ?? null;
    };
    const noms = { armure: nom('armure'), emplacement: nom('armure_emplacement') };
    const parFiche = new Map();
    for (const l of db.prepare('SELECT * FROM ancienne.personnage_armure').all()) {
      if (!parFiche.has(l.personnage_id)) parFiche.set(l.personnage_id, []);
      parFiche.get(l.personnage_id).push({ ...l });
    }
    const colonnes = Object.keys(COLONNES_DE_L_ARMURE);
    const ecrire = db.prepare(`UPDATE main.personnage SET ${colonnes.map((c) => `"${c}" = ?`).join(', ')} WHERE id = ?`);
    const notes = [];
    for (const [id, lignes] of parFiche) {
      const conversion = armureDesArmures(lignes);
      ecrire.run(...colonnes.map((c) => conversion.colonnes[c]), id);
      notes.push([id, retraitsDeLArmure(conversion, noms)]);
    }
    ajouterLesRetraits(db, retraits, notes);
  },
  // le bouclier (décision R96) : la matière est le matériau du premier rang (matiereDuBouclier, comme la migration 0060), chaque autre matériau noté
  personnage_bouclier_materiau: (db, { retraits }) => {
    const nom = db.prepare('SELECT nom FROM main.ressource WHERE id = ?');
    const noms = { ressource: (id) => nom.get(id)?.nom ?? null };
    const parFiche = new Map();
    for (const l of db.prepare('SELECT * FROM ancienne.personnage_bouclier_materiau').all()) {
      if (!parFiche.has(l.personnage_id)) parFiche.set(l.personnage_id, []);
      parFiche.get(l.personnage_id).push({ ...l });
    }
    const ecrire = db.prepare('UPDATE main.personnage SET bouclier_materiau_id = ? WHERE id = ?');
    const notes = [];
    for (const [id, lignes] of parFiche) {
      const conversion = matiereDuBouclier(lignes);
      ecrire.run(conversion.materiau_id, id);
      notes.push([id, retraitsDuBouclier(conversion, noms)]);
    }
    ajouterLesRetraits(db, retraits, notes);
  },
  // les maîtrises d'armes (décisions R148, R153) : aucun choix posé, les anciens dés et l'arme choisie notés
  personnage_maitrise_arme: (db, { retraits }) => noterLesMaitrisesDAvant(db, retraits),
});

/** Les accumulateurs de retraits dont les maîtrises d'avant sont déjà notées (une seule ligne par fiche : noterLesMaitrisesDAvant). */
const MAITRISES_NOTEES = new WeakSet();

/**
 * Décision R153 (« Tout remettre à choisir », avec « une note datée de l'ancien tableau ») : range dans `retraits`, pour chaque fiche de `ancienne`, un
 * descripteur « maitrises_armes » (maitrisesDAvant de src/lib/fiche-format.mjs) avec ses anciens dés par famille (personnage_maitrise_arme) et l'arme
 * choisie de ses choix d'acquis (personnage_acquis_choix.arme_famille_id, décision R119, retirée par R152) ; noterLesRetraits en écrit la ligne datée à
 * la fin des notes. Aucun choix de maîtrise n'est posé (personnage_maitrise_choix reste vide) ; les lignes des choix d'acquis sont recopiées sans la
 * colonne, leur compétence gardée (R152). Appelée par la conversion de la table et par celle de la colonne : une base d'avant la migration 0067 n'a que
 * la table, et une fiche peut n'avoir qu'une arme choisie ; une seule ligne par fiche (une seule fois par accumulateur). Noms, dés et ordre des familles
 * lus dans les nouvelles règles, sinon dans l'ancienne base.
 */
function noterLesMaitrisesDAvant(db, retraits) {
  if (MAITRISES_NOTEES.has(retraits)) return;
  MAITRISES_NOTEES.add(retraits);
  const parFiche = new Map();
  const de = (id) => {
    if (!parFiche.has(id)) parFiche.set(id, { maitrises: [], armes: [] });
    return parFiche.get(id);
  };
  if (colonnes(db, 'ancienne', 'personnage_maitrise_arme').length) {
    for (const l of db.prepare('SELECT personnage_id, arme_famille_id, des FROM ancienne.personnage_maitrise_arme ORDER BY personnage_id, arme_famille_id').all()) {
      de(l.personnage_id).maitrises.push({ arme_famille_id: l.arme_famille_id, des: l.des });
    }
  }
  if (colonnes(db, 'ancienne', 'personnage_acquis_choix').includes('arme_famille_id')) {
    for (const l of db.prepare(`SELECT personnage_id, source, arme_famille_id FROM ancienne.personnage_acquis_choix WHERE arme_famille_id IS NOT NULL
      ORDER BY personnage_id, source, rang, competence_id`).all()) {
      de(l.personnage_id).armes.push({ source: l.source, arme_famille_id: l.arme_famille_id });
    }
  }
  if (!parFiche.size) return;
  const familles = ['main', 'ancienne'].map((b) => db.prepare(`SELECT nom, de_brut AS de, ordre FROM ${b}.arme_famille WHERE id = ?`));
  const dons = ['main', 'ancienne'].map((b) => db.prepare(`SELECT k.nom, c.nom AS classe FROM ${b}.capacite k LEFT JOIN ${b}.classe c ON c.id = k.classe_id WHERE k.id = ?`));
  const premier = (requetes) => (id) => {
    for (const r of requetes) {
      const l = r.get(id);
      if (l) return { ...l };
    }
    return null;
  };
  const noms = { famille: premier(familles), don: premier(dons) };
  ajouterLesRetraits(db, retraits, [...parFiche].map(([id, x]) => [id, [maitrisesDAvant(x.maitrises, x.armes, noms)].filter(Boolean)]));
}

/**
 * Lignes qu'une table de la section 13 garde mais que ses nouvelles règles refusent, par table : { ou (prédicat SQL des lignes à NE PAS recopier, valable
 * sur l'ancienne et la nouvelle forme de la table), noter (db, retraits) : range dans `retraits` ce que la copie perd, lu dans `ancienne` avant elle }.
 * personnage_accessoire (décision R97, migration 0060) : un accessoire de la Ceinture ou d'« Autre », ou sans effet de la table (effet hors table seul),
 * n'est pas recopié ; il est noté, comme le nom ou l'effet hors table qu'un accessoire gardé perd (COLONNES_RETIREES), par accessoiresGardes.
 * personnage_arme (décision R167, migration 0081 : CHECK « une arme du catalogue OU une arme élémentaire ») : une arme du catalogue qui porte un
 * élément n'est pas recopiée telle quelle ; la conversion de la colonne retirée amelioration_elementaire_id (COLONNES_CONVERTIES, juste après la copie)
 * l'écrit dans sa nouvelle forme et note ce qu'elle perd (convertirLesArmesDAvant) : rien n'est noté ici.
 */
export const LIGNES_ECARTEES = Object.freeze({
  personnage_accessoire: Object.freeze({
    ou: "emplacement IN ('ceinture', 'autre') OR accessoire_effet_id IS NULL",
    noter: (db, retraits) => {
      const cols = colonnes(db, 'ancienne', 'personnage_accessoire');
      if (!cols.includes('nom') && !cols.includes('texte')) {
        // l'ancienne base est déjà au format de 0060 : aucune ligne n'y est refusée
        if (!db.prepare(`SELECT 1 FROM ancienne.personnage_accessoire WHERE ${LIGNES_ECARTEES.personnage_accessoire.ou} LIMIT 1`).get()) return;
      }
      const libelle = db.prepare('SELECT libelle FROM main.accessoire_effet WHERE id = ?');
      const noms = { accessoire: (id) => libelle.get(id)?.libelle ?? null };
      const parFiche = new Map();
      for (const l of db.prepare('SELECT * FROM ancienne.personnage_accessoire ORDER BY personnage_id, emplacement').all()) {
        if (!parFiche.has(l.personnage_id)) parFiche.set(l.personnage_id, []);
        parFiche.get(l.personnage_id).push({ ...l });
      }
      ajouterLesRetraits(db, retraits, [...parFiche].map(([id, lignes]) => [id, accessoiresGardes(lignes, noms).retraits]));
    },
  }),
  personnage_arme: Object.freeze({
    ou: 'arme_id IS NOT NULL AND arme_elementaire_id IS NOT NULL',
    noter: () => {},
  }),
});

/**
 * Décision R167 (migration 0081) : les armes des fiches d'une base vivante d'avant (un élément posé sur une arme du catalogue, l'amélioration de
 * l'élément) dans la forme d'aujourd'hui, par armeDAvant de src/lib/fiche-format.mjs (même type : l'arme élémentaire, au niveau de l'ancienne
 * amélioration de l'élément, durabilité bornée ; autre type : l'arme sans l'élément ; amélioration de l'élément sans élément : retirée). Les lignes
 * écartées de la copie (LIGNES_ECARTEES) sont écrites converties ; chaque perte est rangée dans `retraits` (une ligne datée par arme : noterLesRetraits).
 * Noms, familles et types lus dans les nouvelles règles, sinon dans l'ancienne base ; le type élémentaire d'une famille (arme_famille.type_elementaire_id)
 * et la solidité de base d'une arme élémentaire (constante_equipement) dans les nouvelles seulement.
 */
function convertirLesArmesDAvant(db, retraits) {
  const premier = (requetes) => (x) => {
    for (const r of requetes) {
      const l = r.get(x);
      if (l) return { ...l };
    }
    return null;
  };
  const arme = premier(['main', 'ancienne'].map((b) => db.prepare(`SELECT a.nom, coalesce(mf.nom, af.nom) AS famille, mf.type_elementaire_id
    FROM ${b}.arme a LEFT JOIN main.arme_famille mf ON mf.id = a.famille_id LEFT JOIN ancienne.arme_famille af ON af.id = a.famille_id WHERE a.id = ?`)));
  const armeElementaire = premier(['main', 'ancienne'].map((b) => db.prepare(`SELECT nom, type_id FROM ${b}.arme_elementaire WHERE id = ?`)));
  const ressource = premier(['main', 'ancienne'].map((b) => db.prepare(`SELECT nom FROM ${b}.ressource WHERE id = ?`)));
  const niveau = premier(['main', 'ancienne'].map((b) => db.prepare(`SELECT niveau FROM ${b}.amelioration_equipement WHERE id = ?`)));
  const ameliorationDArme = db.prepare("SELECT id, bonus_cran FROM main.amelioration_equipement WHERE cible = 'arme' AND niveau = ?");
  // la solidité de base d'une pièce élémentaire (migration 0080), + les crans de la ligne d'amélioration d'arme (R167)
  const solidite = db.prepare("SELECT valeur FROM main.constante_equipement WHERE id = 'piece_elementaire.solidite_base'").get();
  if (!solidite) throw new Error('constante_equipement « piece_elementaire.solidite_base » absente des nouvelles règles');
  const noms = {
    arme, armeElementaire, ressource: (x) => ressource(x)?.nom ?? null, niveau: (x) => niveau(x)?.niveau ?? null,
    ameliorationDArme: (n) => premier([ameliorationDArme])(n), soliditeElementaire: solidite.valeur,
  };
  const cibles = colonnes(db, 'main', 'personnage_arme');
  const ecartee = db.prepare(`SELECT 1 FROM ancienne.personnage_arme WHERE personnage_id = ? AND rang = ? AND (${LIGNES_ECARTEES.personnage_arme.ou})`);
  const parFiche = new Map();
  for (const l of db.prepare('SELECT * FROM ancienne.personnage_arme ORDER BY personnage_id, rang').all()) {
    const { ligne, retrait } = armeDAvant({ ...l }, noms);
    if (ecartee.get(l.personnage_id, l.rang)) {
      const cols = cibles.filter((c) => c in ligne);
      db.prepare(`INSERT INTO main.personnage_arme (${cols.map((c) => `"${c}"`).join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`).run(...cols.map((c) => ligne[c]));
    }
    if (!retrait) continue;
    if (!parFiche.has(l.personnage_id)) parFiche.set(l.personnage_id, []);
    parFiche.get(l.personnage_id).push(retrait);
  }
  ajouterLesRetraits(db, retraits, [...parFiche]);
}

/**
 * Range des descripteurs de retrait par fiche (`parFiche` : [[id, descripteurs]]) dans `retraits` (nouveauxRetraitsDeFiches), nom et nature lus dans
 * `ancienne` : une table écartée (LIGNES_ECARTEES) se note pendant la copie, que la fiche y soit déjà recopiée ou non (l'ordre de TABLES_VIVANTES n'y
 * change rien).
 */
function ajouterLesRetraits(db, retraits, parFiche) {
  const lire = db.prepare('SELECT nom, nature FROM ancienne.personnage WHERE id = ?');
  for (const [id, d] of parFiche) {
    const p = d.length ? lire.get(id) : null;
    if (!p) continue;
    if (!retraits.has(id)) retraits.set(id, { personnage: id, nom: p.nom, nature: p.nature, retraits: [] });
    retraits.get(id).retraits.push(...d);
  }
}

/**
 * Colonnes que les règles ont retirées (COLONNES_RETIREES) et dont le contenu ne se perd pas sans le dire, par table et colonne : une conversion
 * (db, { retraits }) lue dans `ancienne`, faite après la copie des fiches. Décision R104 (migration 0062) : `personnage.entrainement`, le texte libre de
 * R71, devient une ligne de texte de l'entraînement (entrainementEnLignes) ; l'acquis saisi d'une compétence (`personnage_competence.acquis`) se perd,
 * noté, daté, dans la fiche (acquisRetires). Décision R118 (migration 0066) : les NM du MJ d'un sort (`personnage_sort.nm_cadeau`) deviennent ceux de
 * la fiche, `personnage.nm_mj`, leur somme (comme la migration et nmDuMjDesSorts) ; le NM de chaque sort, recopié, ne change pas. Décisions R152 et R153
 * (migration 0076) : l'arme choisie d'un choix d'acquis (`personnage_acquis_choix.arme_famille_id`) se perd, notée sur la ligne des anciennes maîtrises
 * (noterLesMaitrisesDAvant, une seule fois avec la conversion de personnage_maitrise_arme) ; la compétence du choix reste. Décision R167 (migration
 * 0081) : l'amélioration de l'élément d'une arme (`personnage_arme.amelioration_elementaire_id`) devient le niveau de l'arme élémentaire, ou part, notée
 * (convertirLesArmesDAvant, qui écrit aussi les armes écartées de la copie : LIGNES_ECARTEES).
 */
export const COLONNES_CONVERTIES = Object.freeze({
  personnage: Object.freeze({
    entrainement: (db) => {
      const ecrire = db.prepare('INSERT INTO main.personnage_entrainement (personnage_id, rang, competence_id, valeur, texte) VALUES (?, ?, NULL, NULL, ?)');
      for (const p of db.prepare('SELECT id, entrainement FROM ancienne.personnage WHERE entrainement IS NOT NULL').all()) {
        for (const l of entrainementEnLignes(p.entrainement)) ecrire.run(p.id, l.rang, l.texte);
      }
    },
  }),
  personnage_competence: Object.freeze({
    acquis: (db, { retraits }) => {
      const nom = db.prepare('SELECT nom FROM main.competence WHERE id = ?');
      const noms = { competence: (id) => nom.get(id)?.nom ?? null };
      const parFiche = new Map();
      for (const l of db.prepare('SELECT personnage_id, competence_id, acquis FROM ancienne.personnage_competence WHERE acquis > 0 ORDER BY personnage_id, competence_id').all()) {
        if (!parFiche.has(l.personnage_id)) parFiche.set(l.personnage_id, []);
        parFiche.get(l.personnage_id).push({ ...l });
      }
      ajouterLesRetraits(db, retraits, [...parFiche].map(([id, lignes]) => [id, acquisRetires(lignes, noms)]));
    },
  }),
  personnage_sort: Object.freeze({
    nm_cadeau: (db) => {
      const ecrire = db.prepare('UPDATE main.personnage SET nm_mj = ? WHERE id = ?');
      for (const l of db.prepare('SELECT personnage_id, SUM(nm_cadeau) AS nm FROM ancienne.personnage_sort WHERE nm_cadeau > 0 GROUP BY personnage_id').all()) {
        ecrire.run(l.nm, l.personnage_id);
      }
    },
  }),
  personnage_acquis_choix: Object.freeze({
    arme_famille_id: (db, { retraits }) => noterLesMaitrisesDAvant(db, retraits),
  }),
  personnage_arme: Object.freeze({
    amelioration_elementaire_id: (db, { retraits }) => convertirLesArmesDAvant(db, retraits),
  }),
});

/** Les conversions des colonnes retirées (COLONNES_CONVERTIES) que l'ancienne base a encore : rend les problèmes. */
function convertirLesColonnesRetirees(db, retraits) {
  const problemes = [];
  for (const [t, parColonne] of Object.entries(COLONNES_CONVERTIES)) {
    const avant = colonnes(db, 'ancienne', t);
    for (const [c, convertir] of Object.entries(parColonne)) {
      if (!avant.includes(c) || colonnes(db, 'main', t).includes(c)) continue;
      try {
        convertir(db, { retraits });
      } catch (e) {
        problemes.push(`${t}.${c} : ${e.message}`);
      }
    }
  }
  return problemes;
}

/**
 * Convertit les lignes des tables retirées de la base `ancienne` (attachée) dans `db` : rend les problèmes (une conversion qui échoue, ou une table
 * retirée que les nouvelles règles ont encore, ou qui n'a pas de conversion) ; rien n'est perdu sans être dit. Une conversion range ce qu'elle retire
 * d'une fiche dans `retraits` (nouveauxRetraitsDeFiches de serveur/fiches-retraits.mjs).
 */
function convertirLesTablesRetirees(db, retraits) {
  const problemes = [];
  for (const t of Object.keys(TABLES_RETIREES)) {
    if (!colonnes(db, 'ancienne', t).length || !compter(db, 'ancienne', t)) continue; // rien à convertir
    if (colonnes(db, 'main', t).length) {
      // les règles l'ont encore (service et règles qui ne vont pas ensemble : base des règles pas reconstruite) : ses lignes seraient perdues
      problemes.push(`${t} : table retirée par les nouvelles règles (TABLES_RETIREES), mais encore dans la base des règles : ses lignes ne seraient pas reprises`);
      continue;
    }
    if (!CONVERSIONS[t]) {
      problemes.push(`${t} : table retirée sans conversion, ses lignes seraient perdues`);
      continue;
    }
    try {
      if (typeof CONVERSIONS[t] === 'function') CONVERSIONS[t](db, { retraits });
      else db.exec(CONVERSIONS[t]);
    } catch (e) {
      problemes.push(`${t} : ${e.message}`);
    }
  }
  return problemes;
}

export const FICHIER_BASE = 'vivante.db';
/** À côté de la base : l'empreinte des règles dont elle est faite (refaite quand elle diffère de celle de la base publiée). */
export const FICHIER_ETAT = 'vivante.json';
export const DOSSIER_ARCHIVES = 'archives';
export const ARCHIVES_GARDEES = 5;

export class ErreurBaseVivante extends Error {
  /** @param {string} message @param {string[]} problemes */
  constructor(message, problemes = []) {
    super(message);
    this.name = 'ErreurBaseVivante';
    this.problemes = problemes;
  }
}

/** Empreinte SHA-256 d'un fichier. */
export function empreinteFichier(chemin) {
  return sha256(readFileSync(chemin));
}

/** Signature d'un fichier sans le lire (change quand il est remplacé ou réécrit) ; null s'il n'existe pas. */
export function signature(chemin) {
  try {
    const s = statSync(chemin);
    return `${s.ino}:${s.size}:${s.mtimeMs}`;
  } catch {
    return null;
  }
}

/**
 * Contenu de vivante.json ({ regles, schema, refaite_le, retraits? }), null s'il est absent ou illisible. `retraits` : { le, fiches } de la dernière
 * reconstruction qui a retiré quelque chose des fiches (R42), gardé par les suivantes qui ne retirent rien ; absent s'il n'y en a jamais eu.
 */
export function lireEtat(dossier) {
  try {
    return JSON.parse(readFileSync(join(dossier, FICHIER_ETAT), 'utf8'));
  } catch {
    return null;
  }
}

function ecrireEtat(dossier, etat) {
  const provisoire = join(dossier, `.${FICHIER_ETAT}.${process.pid}`);
  writeFileSync(provisoire, `${JSON.stringify(etat, null, 2)}\n`);
  renameSync(provisoire, join(dossier, FICHIER_ETAT));
}

const colonnes = (db, schema, table) => db.prepare(`PRAGMA "${schema}".table_info("${table}")`).all().map((c) => c.name);
const compter = (db, schema, table) => db.prepare(`SELECT count(*) AS n FROM "${schema}"."${table}"`).get().n;

/**
 * Clés étrangères rompues d'une table : une entrée par (colonnes, valeur citée absente de la table visée), avec le nombre de lignes.
 * `ou` restreint les lignes contrôlées (« personnage_id = ? », avec `valeurs`).
 */
export function clesRompues(db, table, { schema = 'main', ou = null, valeurs = [] } = {}) {
  const liaisons = new Map();
  for (const f of db.prepare(`PRAGMA "${schema}".foreign_key_list("${table}")`).all()) {
    if (!liaisons.has(f.id)) liaisons.set(f.id, []);
    liaisons.get(f.id).push(f);
  }
  const rompues = [];
  for (const liaison of liaisons.values()) {
    liaison.sort((a, b) => a.seq - b.seq);
    const parent = liaison[0].table;
    const clePrimaire = db.prepare(`PRAGMA "${schema}".table_info("${parent}")`).all().filter((c) => c.pk).sort((a, b) => a.pk - b.pk).map((c) => c.name);
    const de = liaison.map((f) => f.from);
    const vers = liaison.map((f, i) => f.to ?? clePrimaire[i]);
    const conditions = [...de.map((c) => `t."${c}" IS NOT NULL`), ...(ou ? [`(${ou})`] : [])].join(' AND ');
    const egalites = de.map((c, i) => `p."${vers[i]}" = t."${c}"`).join(' AND ');
    const valeur = de.map((c) => `t."${c}"`).join(` || ' / ' || `);
    const lignes = db.prepare(`SELECT ${valeur} AS valeur, count(*) AS n FROM "${schema}"."${table}" t
      WHERE ${conditions} AND NOT EXISTS (SELECT 1 FROM "${schema}"."${parent}" p WHERE ${egalites})
      GROUP BY valeur ORDER BY valeur`).all(...valeurs);
    for (const l of lignes) rompues.push({ table, colonnes: de, parent, valeur: l.valeur, lignes: l.n });
  }
  return rompues;
}

/** Les tables des sections 13 et 14 existent dans la copie des règles, et elles y sont vides (data/rows les garde vides : jamais de fiche ni de journal dans git). */
function verifierRegles(db) {
  const problemes = [];
  for (const t of TABLES_VIVANTES) {
    if (!colonnes(db, 'main', t).length) problemes.push(`table ${t} absente`);
    else if (compter(db, 'main', t)) problemes.push(`table ${t} non vide`);
  }
  if (problemes.length) throw new ErreurBaseVivante(`base des règles inattendue : ${problemes.join(', ')}`, problemes);
  const controle = db.prepare('PRAGMA quick_check').all().map((r) => Object.values(r)[0]);
  if (controle.join() !== 'ok') throw new ErreurBaseVivante(`base des règles abîmée : ${controle.slice(0, 3).join(' ; ')}`);
}

/**
 * Recopie dans `db` (la copie neuve des règles) les lignes des sections 13 et 14 de la base `ancienne`, convertit celles d'une table que les règles ont
 * retirée (TABLES_RETIREES, CONVERSIONS : les gains de niveau, R73), puis rejoue les modifications en attente du
 * journal sur les nouvelles règles, avant le contrôle des fiches : une fiche peut citer une ligne créée par l'édition (une classe, une spécialité, un
 * don), y compris par un lot qui suit un autre lot touchant la même table. Le rejeu ne contrôle donc pas les clés étrangères des fiches lot par lot
 * (`horsControleParLot`) : elles le sont toutes ici, après le rejeu complet. Un don, une spécialité, un sort ou un métier que les nouvelles règles n'ont
 * plus est alors retiré des fiches, avec une note datée de `instant` (R42 ; jamais avant le rejeu : un lot suivant peut créer ce qu'une fiche cite) ; toute
 * autre référence rompue est relevée avec son détail, et rien n'est écrit (ni retrait, ni note). Une modification que les nouvelles règles contredisent
 * n'empêche rien : elle passe « conflit ». Rend { rejeu (bilan du rejeu), fiches (les fiches adaptées : noterLesRetraits) }.
 * @param {string} instant ISO 8601 UTC à la seconde
 * @param {(type: string, o: { duree_ms?: number, detail?: object }) => void} [evenement] métriques : durée du rejeu et des retraits
 */
function transferer(db, ancienne, instant, evenement = null, poidsPortable = undefined) {
  let rejeu = null;
  let fiches = [];
  const problemes = [];
  db.prepare('ATTACH DATABASE ? AS ancienne').run(ancienne);
  try {
    db.exec('PRAGMA foreign_keys = OFF'); // contrôle explicite après la copie, avec le détail de chaque référence rompue
    db.exec('BEGIN');
    let ouverte = true;
    try {
      const retraits = nouveauxRetraitsDeFiches();
      for (const t of TABLES_VIVANTES) {
        const avant = colonnes(db, 'ancienne', t);
        if (!avant.length) continue; // table que l'ancienne base n'avait pas encore
        const lignes = compter(db, 'ancienne', t);
        if (!lignes) continue;
        const apres = colonnes(db, 'main', t);
        // une colonne que les règles ont retirée exprès (COLONNES_RETIREES : le statut des fiches, migration 0038) se perd sans bloquer
        const perdues = avant.filter((c) => !apres.includes(c) && !(COLONNES_RETIREES[t] ?? []).includes(c))
          .filter((c) => db.prepare(`SELECT count(*) AS n FROM ancienne."${t}" WHERE "${c}" IS NOT NULL`).get().n > 0);
        if (perdues.length) {
          problemes.push(`${t} : ${perdues.join(', ')} rempli(e)s mais absente(s) des nouvelles règles`);
          continue;
        }
        const communes = avant.filter((c) => apres.includes(c)).map((c) => `"${c}"`).join(', ');
        // des lignes que les nouvelles règles refusent (LIGNES_ECARTEES) : notées, puis laissées de côté par la copie
        const ecartees = LIGNES_ECARTEES[t];
        try {
          ecartees?.noter(db, retraits);
          db.exec(`INSERT INTO main."${t}" (${communes}) SELECT ${communes} FROM ancienne."${t}"${ecartees ? ` WHERE NOT (${ecartees.ou})` : ''}`);
        } catch (e) {
          problemes.push(`${t} : ${e.message}`);
        }
      }
      // les lignes d'une table que les règles ont retirée (TABLES_RETIREES) sont converties, après la copie des fiches qu'elles complètent
      // (une conversion qui retire quelque chose d'une fiche le range dans `retraits`, noté avec les retraits de la décision R42, plus bas)
      if (!problemes.length) problemes.push(...convertirLesTablesRetirees(db, retraits));
      if (!problemes.length) problemes.push(...convertirLesColonnesRetirees(db, retraits));
      // les modifications déjà livrées (leur lot est dans historique_modification des nouvelles règles : mise à jour ou rapatriement) sont
      // « intégrées » AVANT le rejeu : rejouées d'après leurs valeurs, un aller-retour (A → B → A) se réappliquerait et deux saisies du même
      // champ passeraient « conflit » — et une valeur annulée par l'admin reviendrait sur le site, puis en production
      if (!problemes.length) integrerLivrees(db);
      // le corps des pages typées que le journal touche est refait depuis les tables rejouées (serveur/edition.mjs#rejouerLeJournal)
      if (!problemes.length) {
        const t0 = performance.now();
        rejeu = rejouerLeJournal(db, {}, { horsControleParLot: TABLES_FICHES });
        evenement?.('rejeu', { duree_ms: performance.now() - t0, detail: { lots: rejeu?.lots ?? 0, appliquees: rejeu?.appliquees ?? 0, integrees: rejeu?.integrees ?? 0, conflits: rejeu?.conflits ?? 0 } });
      }
      // le brouillon de la note de version d'un lot que les nouvelles règles ont livré est vidé (son texte est dans note_version)
      if (!problemes.length) viderBrouillonLivre(db);
      // R42 : un don, une spécialité, un sort ou un métier disparu est retiré des fiches (noms lus dans l'ancienne base, encore attachée), une note
      // datée dans chacune ; ce qui reste rompu ensuite (race, classe, magie…) bloque, et l'annulation emporte aussi ces retraits
      if (!problemes.length) {
        const t0 = performance.now();
        retirerLesManquants(db, retraits);
        // R165 : l'armure d'une fiche d'avant (armure + élément) devient l'armure élémentaire, puis une armure « Familier », une armure élémentaire d'une
        // magie absente et une armure trop lourde (le poids portable de chaque fiche, joueurs compris, selon les règles rejouées : un seul lecteur
        // pour toutes les fiches, lib/poids-portable-db.mjs) sont retirées, à chaque reconstruction (idempotent)
        const portable = poidsPortable === undefined ? poidsPortableDeLaBase(db) : poidsPortable;
        retirerLesArmuresHorsRegle(db, retraits, { poidsPortable: portable });
        fiches = noterLesRetraits(db, retraits, instant);
        // un compte, jamais les noms des fiches
        evenement?.('retraits_fiches', { duree_ms: performance.now() - t0, detail: { fiches: fiches.length } });
      }
      if (!problemes.length) {
        for (const t of TABLES_VIVANTES) {
          for (const r of clesRompues(db, t)) problemes.push(`${t}.${r.colonnes.join('+')} = « ${r.valeur} » absent de ${r.parent} (${r.lignes} ligne(s))`);
        }
      }
      if (problemes.length) {
        throw new ErreurBaseVivante(`les fiches ne passent pas dans les nouvelles règles, la base vivante est gardée telle quelle : ${problemes.join(' ; ')}`, problemes);
      }
      db.exec('COMMIT');
      ouverte = false;
    } finally {
      if (ouverte) {
        try {
          db.exec('ROLLBACK');
        } catch {
          // déjà annulée par SQLite
        }
      }
    }
  } finally {
    db.exec('DETACH DATABASE ancienne');
    db.exec('PRAGMA foreign_keys = ON');
  }
  return { rejeu, fiches };
}

/**
 * Marque « integree » toute modification du journal (en attente ou en conflit) que les règles ont déjà reçue : son (lot, rang) est dans
 * historique_modification. Rend le nombre de modifications marquées.
 */
export function integrerLivrees(db) {
  if (!db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'historique_modification'").get()) return 0;
  return Number(db.prepare(`UPDATE modification SET etat = 'integree', detail = NULL
    WHERE etat IN ('en_attente', 'conflit')
      AND EXISTS (SELECT 1 FROM historique_modification h WHERE h.lot_id = modification.lot_id AND h.rang = modification.rang)`).run().changes);
}

/** Vide le brouillon de la note de version si les règles contiennent la note de version de son lot (livré par « Effectuer la mise à jour »). */
export function viderBrouillonLivre(db) {
  const b = db.prepare('SELECT lot FROM note_version_brouillon WHERE id = 1').get();
  if (b?.lot && db.prepare('SELECT 1 FROM note_version WHERE lot = ?').get(b.lot)) db.exec('DELETE FROM note_version_brouillon');
}

/** Nom d'archive horodaté (l'ordre alphabétique est l'ordre chronologique). */
const horodatage = (instant) => instant.toISOString().replace(/[:.]/g, '-');

/** Archive la base vivante si elle a des lignes de la section 13 ; garde les ARCHIVES_GARDEES dernières. */
function archiver(dossier, chemin, instant) {
  const db = new DatabaseSync(chemin, { readOnly: true });
  let lignes = 0;
  try {
    for (const t of TABLES_VIVANTES) if (colonnes(db, 'main', t).length) lignes += compter(db, 'main', t);
  } finally {
    db.close();
  }
  if (!lignes) return null;
  const archives = join(dossier, DOSSIER_ARCHIVES);
  mkdirSync(archives, { recursive: true });
  const fichier = join(archives, `vivante-${horodatage(instant)}.db`);
  copyFileSync(chemin, fichier);
  const toutes = readdirSync(archives).filter((f) => /^vivante-.+\.db$/.test(f)).sort();
  for (const f of toutes.slice(0, -ARCHIVES_GARDEES)) rmSync(join(archives, f), { force: true });
  return fichier;
}

/**
 * Prépare la base vivante du dossier `dossier` pour la base des règles `regles` (celle que publie le site) : la crée au premier lancement, la
 * refait quand les règles ont changé, ne touche à rien sinon. Rend { chemin, refaite, archive, empreinte, schema, rejeu, fiches } (rejeu : bilan des
 * modifications du journal rejouées, null sans base précédente ; fiches : celles dont un élément disparu a été retiré, R42, [] sinon). En cas d'échec,
 * lève une erreur (ErreurBaseVivante quand les fiches ne passent pas) et la base en place reste intacte. `evenement` (facultatif) : les métriques du
 * service (durées du rejeu, des retraits des fiches et de l'archivage). Une armure trop lourde pour le poids portable d'une fiche (décision R165 (6),
 * (7) : serveur/fiches-retraits.mjs#retirerLesArmuresHorsRegle, étape 4) est retirée et notée : le calcul du moteur de la fiche, lu dans la base
 * refaite (lib/poids-portable-db.mjs#poidsPortableDeLaBase). `poidsPortable` (facultatif, (db, id) => 0 à 3 ou null) remplace ce calcul (tests) ;
 * null : pas d'étape du poids.
 */
export function preparerBaseVivante({ regles, dossier, instant = new Date(), evenement = null, poidsPortable = undefined }) {
  if (!existsSync(regles)) throw new ErreurBaseVivante(`base des règles introuvable : ${regles} (le site est-il installé ?)`);
  mkdirSync(dossier, { recursive: true });
  const chemin = join(dossier, FICHIER_BASE);
  const etat = lireEtat(dossier);
  if (existsSync(chemin) && etat?.regles && etat.regles === empreinteFichier(regles)) {
    return { chemin, refaite: false, archive: null, empreinte: etat.regles, schema: etat.schema ?? null, fiches: [] };
  }

  const neuve = join(dossier, `.${FICHIER_BASE}.${process.pid}.neuve`);
  rmSync(neuve, { force: true });
  copyFileSync(regles, neuve);
  let archive = null;
  let schema;
  let rejeu = null;
  let fiches = [];
  const iso = ecrireInstant(instant); // format des colonnes `*_le` : date des notes de retrait et de refaite_le
  try {
    const empreinte = empreinteFichier(neuve); // celle de la copie : les règles peuvent être remplacées pendant qu'on les copie
    const db = new DatabaseSync(neuve);
    try {
      verifierRegles(db);
      if (existsSync(chemin)) ({ rejeu, fiches } = transferer(db, chemin, iso, evenement, poidsPortable));
      schema = db.prepare('PRAGMA user_version').get().user_version;
    } finally {
      db.close();
    }
    if (existsSync(chemin)) {
      const t0 = performance.now();
      archive = archiver(dossier, chemin, instant);
      if (archive) evenement?.('archive_base_vivante', { duree_ms: performance.now() - t0, detail: { octets: statSync(archive).size } });
    }
    renameSync(neuve, chemin);
    // la dernière liste non vide des fiches adaptées (R42), datée, survit aux reconstructions qui ne retirent rien et au redémarrage du service
    const retraits = fiches.length ? { le: iso, fiches } : etat?.retraits;
    ecrireEtat(dossier, { regles: empreinte, schema, refaite_le: iso, ...(retraits ? { retraits } : {}) });
    return { chemin, refaite: true, archive, empreinte, schema, rejeu, fiches };
  } catch (e) {
    rmSync(neuve, { force: true });
    throw e;
  }
}

/** Ouvre la base vivante pour le service : clés étrangères contrôlées, attente courte si une copie (sqlite3 .backup) la verrouille. */
export function ouvrirBaseVivante(chemin) {
  const db = new DatabaseSync(chemin);
  db.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  return db;
}
