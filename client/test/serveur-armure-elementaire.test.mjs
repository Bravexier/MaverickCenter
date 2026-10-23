// Décision R165 (pièce élémentaire posée sur une armure) côté service : une fiche porte une armure de base OU une armure élémentaire, jamais les deux.
// Les natures et les textes des lignes de retrait (lib/fiche-format.mjs : NATURES_DE_L_ARMURE, ligneDeRetrait), identiques à ceux de la migration
// 0080 (comparés à elle sur les mêmes fiches) ; la conversion d'une fiche reçue par la page (sansPartiesRetirees, armureTransformee) ; l'étape de la
// reconstruction de la base vivante (serveur/fiches-retraits.mjs#retirerLesArmuresHorsRegle : armure + élément, « Familier », magie absente,
// idempotente) et celle de l'enregistrement (serveur/fiches.mjs#enregistrerFiche), avec le point d'accroche du poids portable (`poidsPortable` ; son
// calcul par défaut, lu dans la base : test/serveur-poids-portable.test.mjs).
// Tout s'écrit dans des copies de la base construite depuis data/rows.
import assert from 'node:assert/strict';
import { copyFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { ouvrirBaseVivante, preparerBaseVivante } from '../serveur/base-vivante.mjs';
import { enregistrerFiche, lireFiche } from '../serveur/fiches.mjs';
import { noterLesRetraits, nouveauxRetraitsDeFiches, retirerLesArmuresHorsRegle } from '../serveur/fiches-retraits.mjs';
import { cheminBase, trouverRacine } from '../src/lib/donnees.mjs';
import {
  armureTransformee, COLONNES_DE_L_ARMURE_DE_BASE, COLONNES_DE_L_ARMURE_ELEMENTAIRE, descriptionDuRetrait, deuxArmures, EMPLACEMENTS_D_ARMURE, ligneDeRetrait,
  NATURES_DE_L_ARMURE, ORDRE_DES_NATURES, partiesEnTexte, POIDS_DES_ARMURES, POIDS_PORTABLE_MAX, retraitsDesNotes, sansPartiesRetirees, TYPE_FAMILIER, valeurDuPoids,
} from '../src/lib/fiche-format.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';

const dossier = dossierTemporaire('r165-service');
const REGLES = cheminBase({ sansExemples: false });
const INSTANT = '2026-10-09T12:00:00Z';
const lecture = new DatabaseSync(REGLES, { readOnly: true });
const un = (sql, ...p) => lecture.prepare(sql).get(...p);
const nom = (table, id) => un(`SELECT nom FROM ${table} WHERE id = ?`, id).nom;
const amelioration = (cible, niveau) => un('SELECT id FROM amelioration_equipement WHERE cible = ? AND niveau = ?', cible, niveau).id;
const elementaire = (magie, categorie) => un('SELECT id FROM armure_elementaire WHERE magie_id = ? AND categorie = ?', magie, categorie).id;
const FEU = 'magies/magie-du-feu';
const VENT = 'magies/magie-du-vent';
const GRILLE = un('SELECT id FROM armure WHERE solidite_uni IS NULL ORDER BY ordre LIMIT 1').id;
const LOURDE = un("SELECT id FROM armure WHERE type = 'Lourd' AND solidite_uni IS NULL ORDER BY ordre LIMIT 1").id;
const FAMILIER = un('SELECT id FROM armure WHERE type = ? ORDER BY ordre LIMIT 1', TYPE_FAMILIER).id;
const EL_FEU = elementaire(FEU, 'Intermédiaire');
const EL_VENT = elementaire(VENT, 'Léger');
const EL_FEU_LOURD = elementaire(FEU, 'Lourd');
const sansDate = (notes) => notes?.replace(/^\[\d{2}\/\d{2}\/\d{4}\] /gm, '[date] ') ?? null;
const ARMURE = [...COLONNES_DE_L_ARMURE_DE_BASE, ...COLONNES_DE_L_ARMURE_ELEMENTAIRE];
// une classe qui porte toute armure (« Maîtrise Armures » Lourde) : l'étape du poids portable (R165 (6), (7), test/serveur-poids-portable.test.mjs)
// ne retire rien des fiches de ces tests
const CUIRASSE = 'classes/cuirasse';
const CLASSES = [{ rang: 1, classe_id: CUIRASSE, specialite_id: null }];

test('R165 : poids d’armure (0 = Vêtement … 3 = Lourd), écrits par les armures, les armures élémentaires et la « Maîtrise Armures » des classes', () => {
  assert.deepEqual([...POIDS_DES_ARMURES], ['Vêtement', 'Léger', 'Intermédiaire', 'Lourd']);
  assert.equal(POIDS_PORTABLE_MAX, 3, '« Si un calcul dépasse lourd (3+) rester à 3 au max »');
  assert.deepEqual(['Vêtement', 'Léger', 'Légère', 'Intermédiaire', 'Lourd', 'Lourde', 'Familier', null].map(valeurDuPoids), [0, 1, 1, 2, 3, 3, null, null]);
  // chaque poids écrit par la base a sa valeur, sauf « Familier » (R165 (1) : à part)
  for (const { t } of lecture.prepare(`SELECT DISTINCT type AS t FROM armure UNION SELECT DISTINCT categorie FROM armure_elementaire
    UNION SELECT DISTINCT poids_max FROM classe_maitrise_armure WHERE poids_max IS NOT NULL`).all()) {
    assert.equal(valeurDuPoids(t) === null, t === TYPE_FAMILIER, t);
  }
  // l'ordre des emplacements de la note est celui de la base (armure_emplacement.ordre)
  assert.deepEqual(lecture.prepare("SELECT id FROM armure_emplacement WHERE id <> 'bouclier' ORDER BY ordre").all().map((r) => r.id), [...EMPLACEMENTS_D_ARMURE]);
});

test('R165 : natures de retrait de l’armure, après les pièces d’armure de R95, et leurs textes', () => {
  assert.deepEqual([...NATURES_DE_L_ARMURE], ['armure_transformee', 'armure_familier', 'armure_magie_absente', 'armure_trop_lourde']);
  assert.equal(ORDRE_DES_NATURES.indexOf('armure_transformee'), ORDRE_DES_NATURES.indexOf('piece_armure') + 1);
  const avant = (d) => ligneDeRetrait(d, '2026-10-23T08:00:00Z');
  assert.equal(partiesEnTexte([{ emplacement_id: 'torse', solidite: 0 }, { emplacement_id: 'casque', solidite: 1 }], { emplacement: (id) => ({ casque: 'Casque', torse: 'Torse' })[id] }),
    'Casque 1, Torse 0', 'dans l’ordre des emplacements');
  assert.equal(partiesEnTexte([]), null);
  assert.equal(avant({ nature: 'armure_transformee', id: 'a', nom: 'Armure Cuir/Peau', amelioration: 2, parties: 'Casque 1, Torse 0', devenue: 'Garde coeur', amelioration_devenue: 3 }),
    '[23/10/2026] Retrait (règles modifiées) : l’armure « Armure Cuir/Peau » (amélioration +2, solidité Casque 1, Torse 0) est devenue l’armure élémentaire « Garde coeur » '
    + '(amélioration +3) de la fiche, remise à sa solidité maximum : une armure transformée par une pièce élémentaire n’a plus rien de l’armure d’origine. Adaptez la fiche.');
  assert.equal(avant({ nature: 'armure_familier', id: 'f', nom: 'Armure légère familier', amelioration: null, parties: null }),
    '[23/10/2026] Retrait (règles modifiées) : l’armure « Armure légère familier » n’est plus portée : une armure de familier ne se porte pas sur une fiche de personnage. Adaptez la fiche.');
  assert.equal(avant({ nature: 'armure_magie_absente', id: 'e', nom: 'Garde coeur', amelioration: 1, parties: null, magie: 'Feu' }),
    '[23/10/2026] Retrait (règles modifiées) : l’armure élémentaire « Garde coeur » (amélioration +1) n’est plus portée : le personnage n’a pas la magie de cette armure (Feu). Adaptez la fiche.');
  assert.equal(avant({ nature: 'armure_trop_lourde', id: 'a', nom: 'Armure Fer/Fer', elementaire: false, amelioration: 4, parties: 'Torse 2', poids: 'Lourd', portable: 'Intermédiaire' }),
    '[23/10/2026] Retrait (règles modifiées) : l’armure « Armure Fer/Fer » (amélioration +4, solidité Torse 2) n’est plus portée : elle est trop lourde pour le personnage (Lourd, au plus Intermédiaire). Adaptez la fiche.');
  assert.equal(descriptionDuRetrait({ nature: 'armure_trop_lourde', id: 'e', nom: 'Garde coeur', elementaire: true, poids: 'Lourd', portable: 'Vêtement' }), 'l’armure élémentaire « Garde coeur »');
  for (const nature of NATURES_DE_L_ARMURE) assert.equal(retraitsDesNotes(avant({ nature, id: 'x' })).length, 1, `${nature} : une ligne de retrait, comptée par la page`);
});

test('R165 : sansPartiesRetirees convertit une fiche reçue qui porte une armure et son « élément » (la page) ; le service la laisse à sa conversion après l’écriture', () => {
  const fiche = {
    nom: 'Aldric', notes: 'Mes notes', armure_id: 'A', armure_amelioration_id: 'p#amelioration:armure:2', armure_elementaire_id: 'E',
    armure_amelioration_elementaire_id: 'p#amelioration:armure-elementaire:3', armure_parties: [{ emplacement_id: 'torse', solidite: 0 }],
  };
  assert.equal(deuxArmures(fiche), true);
  const noms = { armure: () => 'Armure Cuir/Peau', armureElementaire: () => 'Garde coeur', emplacement: () => 'Torse' };
  const r = sansPartiesRetirees(fiche, { instant: '2026-10-23T08:00:00Z', noms });
  assert.deepEqual([...ARMURE.map((c) => r[c]), r.armure_parties], [null, null, 'E', 'p#amelioration:armure-elementaire:3', []]);
  assert.equal(r.notes, 'Mes notes\n[23/10/2026] Retrait (règles modifiées) : l’armure « Armure Cuir/Peau » (amélioration +2, solidité Torse 0) est devenue l’armure '
    + 'élémentaire « Garde coeur » (amélioration +3) de la fiche, remise à sa solidité maximum : une armure transformée par une pièce élémentaire n’a plus rien de '
    + 'l’armure d’origine. Adaptez la fiche.', 'le niveau lu dans l’identifiant de l’amélioration faute de nom');
  assert.equal(fiche.armure_id, 'A', 'jamais modifiée en place');
  assert.equal(sansPartiesRetirees(fiche, { instant: '2026-10-23T08:00:00Z', noms, armureDouble: false }), fiche, 'le service : rendue telle quelle');
  const une = { nom: 'B', armure_elementaire_id: 'E' };
  assert.equal(sansPartiesRetirees(une, { instant: '2026-10-23T08:00:00Z' }), une, 'une seule armure : rien à convertir');
  assert.equal(armureTransformee(une), null);
});

// ----------------------------------------------------------------------------------------------------- fiches d'avant, sur une copie de la base
function nouvelleCopie(nomDuFichier) {
  const chemin = join(dossier, nomDuFichier);
  copyFileSync(REGLES, chemin);
  const db = new DatabaseSync(chemin);
  db.exec('PRAGMA foreign_keys = ON');
  return db;
}
function inserer(db, table, ligne) {
  const cols = Object.keys(ligne);
  db.prepare(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`).run(...Object.values(ligne));
}
function fiche(db, id, colonnes = {}, parties = {}) {
  inserer(db, 'personnage', {
    id, nature: 'pretire', proprietaire_id: null, visibilite: 'tous', nom: `Fiche ${id}`, magie_innee_id: FEU, mode_classe: 'mono',
    xp: 0, alignement_loyal: 0, alignement_chaotique: 0, alignement_bon: 0, alignement_mauvais: 0, bourse_pp: 0, bourse_ro: 0, bourse_rf: 0, ambidextrie: 0,
    cree_le: INSTANT, modifie_le: INSTANT, ...colonnes,
  });
  inserer(db, 'personnage_classe', { personnage_id: id, rang: 1, classe_id: CUIRASSE });
  for (const [emplacement_id, solidite] of Object.entries(parties)) inserer(db, 'personnage_armure_partie', { personnage_id: id, emplacement_id, solidite });
}
/** Les fiches d'avant de test/personnages-armure-elementaire.test.mjs, et d'autres. */
function fichesDAvant(db) {
  fiche(db, 'transformee', { armure_id: GRILLE, armure_amelioration_id: amelioration('armure', 2), armure_elementaire_id: EL_FEU,
    armure_amelioration_elementaire_id: amelioration('armure_elementaire', 3), notes: 'Mon texte' }, { casque: 1, torse: 0 });
  fiche(db, 'autre-magie', { armure_id: GRILLE, armure_elementaire_id: EL_VENT });
  fiche(db, 'familier', { armure_id: FAMILIER, notes: 'Ligne\n' }, { 'armure-complete': 1 });
  fiche(db, 'familier-ameliore', { armure_id: FAMILIER, armure_amelioration_id: amelioration('armure', 1) });
  fiche(db, 'sans-magie', { magie_innee_id: null, armure_elementaire_id: EL_FEU, armure_amelioration_elementaire_id: amelioration('armure_elementaire', 1) }, { torse: 2 });
  fiche(db, 'de-base', { armure_id: GRILLE, armure_amelioration_id: amelioration('armure', 1), notes: 'Rien' }, { torse: 2 });
  fiche(db, 'acquise', { magie_acquise_id: VENT, armure_elementaire_id: EL_VENT }, { 'jambe-gauche': 3 });
}
const etat = (db, id) => {
  const p = db.prepare(`SELECT ${ARMURE.join(', ')}, notes, modifie_le FROM personnage WHERE id = ?`).get(id);
  const parties = db.prepare('SELECT emplacement_id, solidite FROM personnage_armure_partie WHERE personnage_id = ? ORDER BY emplacement_id').all(id);
  return { ...p, parties: Object.fromEntries(parties.map((l) => [l.emplacement_id, l.solidite])) };
};
const IDS = ['transformee', 'autre-magie', 'familier', 'familier-ameliore', 'sans-magie', 'de-base', 'acquise'];

test('R165 : retirerLesArmuresHorsRegle fait ce que fait la migration 0080, aux mêmes textes, sur les mêmes fiches', () => {
  // la migration, rejouée sur une copie (comme test/personnages-armure-elementaire.test.mjs : sa constante retirée d'abord)
  const parLaMigration = nouvelleCopie('migration.db');
  fichesDAvant(parLaMigration);
  parLaMigration.prepare("DELETE FROM constante_equipement WHERE id = 'piece_elementaire.solidite_base'").run();
  parLaMigration.exec(readFileSync(join(trouverRacine(), 'data', 'migrations', '0080-armure-elementaire-de-la-fiche.sql'), 'utf8'));
  // le service, sur une autre copie
  const parLeService = nouvelleCopie('service.db');
  fichesDAvant(parLeService);
  const acc = retirerLesArmuresHorsRegle(parLeService, nouveauxRetraitsDeFiches());
  const fiches = noterLesRetraits(parLeService, acc, '2026-10-23T08:00:00Z');
  try {
    for (const id of IDS) {
      const m = etat(parLaMigration, id);
      const s = etat(parLeService, id);
      assert.deepEqual({ ...s, notes: sansDate(s.notes), modifie_le: undefined }, { ...m, notes: sansDate(m.notes), modifie_le: undefined }, id);
    }
    assert.deepEqual(fiches.map((f) => f.fiche).sort(), ['Fiche autre-magie', 'Fiche familier', 'Fiche familier-ameliore', 'Fiche sans-magie', 'Fiche transformee']);
    assert.equal(etat(parLeService, 'de-base').modifie_le, INSTANT, 'une fiche conforme n’est pas touchée');
    // deux cas de plus que test/personnages-armure-elementaire.test.mjs : une armure « Familier » améliorée, une fiche sans magie innée (« posséder la magie »)
    assert.equal(sansDate(etat(parLeService, 'familier-ameliore').notes), `[date] Retrait (règles modifiées) : l’armure « ${nom('armure', FAMILIER)} » (amélioration +1) `
      + 'n’est plus portée : une armure de familier ne se porte pas sur une fiche de personnage. Adaptez la fiche.');
    assert.equal(sansDate(etat(parLeService, 'sans-magie').notes), `[date] Retrait (règles modifiées) : l’armure élémentaire « ${nom('armure_elementaire', EL_FEU)} » `
      + '(amélioration +1, solidité Torse 2) n’est plus portée : le personnage n’a pas la magie de cette armure (Feu). Adaptez la fiche.');
    assert.deepEqual(parLeService.prepare("SELECT personnage_id FROM v_personnage_controle WHERE regle LIKE 'armure%' OR regle = 'amelioration_cible'").all(), []);
    // idempotente : une seconde passe ne fait rien
    assert.equal(retirerLesArmuresHorsRegle(parLeService, nouveauxRetraitsDeFiches()).size, 0);
  } finally {
    parLaMigration.close();
    parLeService.close();
  }
});

test('R165 : étape 4, l’armure trop lourde, seulement avec le poids portable (point d’accroche du moteur) ; un poids inconnu ne retire rien', () => {
  const db = nouvelleCopie('poids.db');
  try {
    fiche(db, 'lourde', { armure_id: LOURDE, armure_amelioration_id: amelioration('armure', 4) }, { torse: 2 });
    fiche(db, 'el-lourde', { armure_elementaire_id: EL_FEU_LOURD });
    fiche(db, 'inconnue', { armure_id: LOURDE });
    fiche(db, 'portable', { armure_elementaire_id: EL_FEU });
    assert.equal(retirerLesArmuresHorsRegle(db, nouveauxRetraitsDeFiches()).size, 0, 'sans poidsPortable : rien');
    const vus = [];
    const poidsPortable = (base, id) => {
      assert.equal(base, db);
      vus.push(id);
      return { lourde: 2, 'el-lourde': -1, inconnue: null, portable: 7 }[id];
    };
    noterLesRetraits(db, retirerLesArmuresHorsRegle(db, nouveauxRetraitsDeFiches(), { poidsPortable }), '2026-10-23T08:00:00Z');
    assert.deepEqual(vus, ['el-lourde', 'inconnue', 'lourde', 'portable']);
    assert.deepEqual(etat(db, 'lourde'), {
      armure_id: null, armure_amelioration_id: null, armure_elementaire_id: null, armure_amelioration_elementaire_id: null, modifie_le: '2026-10-23T08:00:00Z', parties: {},
      notes: `[23/10/2026] Retrait (règles modifiées) : l’armure « ${nom('armure', LOURDE)} » (amélioration +4, solidité Torse 2) n’est plus portée : elle est trop lourde `
        + 'pour le personnage (Lourd, au plus Intermédiaire). Adaptez la fiche.',
    });
    assert.equal(etat(db, 'el-lourde').notes, `[23/10/2026] Retrait (règles modifiées) : l’armure élémentaire « ${nom('armure_elementaire', EL_FEU_LOURD)} » n’est plus portée : `
      + 'elle est trop lourde pour le personnage (Lourd, au plus Vêtement). Adaptez la fiche.', 'un poids sous 0 compte 0');
    assert.equal(etat(db, 'inconnue').armure_id, LOURDE, 'poids portable inconnu : gardée');
    assert.equal(etat(db, 'portable').armure_elementaire_id, EL_FEU, 'au-delà de 3, 3');
  } finally {
    db.close();
  }
});

test('R165 : la reconstruction de la base vivante convertit et retire, note, liste dans /api/etat ; une reconstruction suivante ne refait rien', () => {
  const lieu = join(dossier, 'vivante');
  const { chemin } = preparerBaseVivante({ regles: REGLES, dossier: lieu });
  const ecrire = new DatabaseSync(chemin);
  ecrire.exec('PRAGMA foreign_keys = ON');
  fichesDAvant(ecrire);
  ecrire.close();
  const livraison = (n) => {
    const f = join(dossier, `regles-${n}.db`);
    copyFileSync(REGLES, f);
    const db = new DatabaseSync(f);
    db.prepare("UPDATE metier SET remarque = ? WHERE id = (SELECT min(id) FROM metier)").run(`livraison ${n}`);
    db.close();
    return f;
  };
  const r = preparerBaseVivante({ regles: livraison(1), dossier: lieu, instant: new Date('2026-10-23T08:00:00Z') });
  assert.equal(r.refaite, true);
  assert.deepEqual(r.fiches.map((f) => f.fiche).sort(), ['Fiche autre-magie', 'Fiche familier', 'Fiche familier-ameliore', 'Fiche sans-magie', 'Fiche transformee']);
  assert.deepEqual(r.fiches.find((f) => f.fiche === 'Fiche autre-magie').retraits, [
    `l’armure « ${nom('armure', GRILLE)} »`, `l’armure élémentaire « ${nom('armure_elementaire', EL_VENT)} »`,
  ], 'dans l’ordre des natures : la conversion, puis la magie absente');
  const db = ouvrirBaseVivante(chemin);
  let apres;
  try {
    const t = lireFiche(db, 'transformee');
    assert.deepEqual([...ARMURE.map((c) => t[c]), t.armure_parties], [null, null, EL_FEU, amelioration('armure_elementaire', 3), []]);
    assert.equal(t.notes.split('\n')[0], 'Mon texte');
    assert.equal(t.modifie_le, '2026-10-23T08:00:00Z');
    assert.deepEqual(lireFiche(db, 'acquise').armure_parties, [{ emplacement_id: 'jambe-gauche', solidite: 3 }], 'une fiche conforme garde ses parties');
    assert.deepEqual(db.prepare("SELECT personnage_id, regle FROM v_personnage_controle WHERE regle LIKE 'armure%'").all(), []);
    apres = Object.fromEntries(IDS.map((id) => [id, lireFiche(db, id)]));
  } finally {
    db.close();
  }
  const encore = preparerBaseVivante({ regles: livraison(2), dossier: lieu, instant: new Date('2026-10-24T08:00:00Z') });
  assert.equal(encore.refaite, true);
  assert.deepEqual(encore.fiches, [], 'idempotente : rien de plus');
  const relue = ouvrirBaseVivante(chemin);
  try {
    for (const id of IDS) assert.deepEqual(lireFiche(relue, id), apres[id], id);
  } finally {
    relue.close();
  }
});

test('R165 : l’enregistrement d’une fiche convertit une armure et son « élément », retire une armure « Familier » ou d’une magie absente, ou trop lourde', () => {
  const { chemin } = preparerBaseVivante({ regles: REGLES, dossier: join(dossier, 'service') });
  const db = ouvrirBaseVivante(chemin);
  const maintenant = new Date('2026-10-23T08:00:00Z');
  const ligne = (n) => retraitsDesNotes(n).map((r) => r.texte);
  try {
    // une page d'avant (R95) : l'armure, son élément, une partie abîmée
    const avant = enregistrerFiche(db, {
      nom: 'Page d’avant', magie_innee_id: FEU, classes: CLASSES, notes: 'Ma note', armure_id: GRILLE, armure_amelioration_id: amelioration('armure', 2), armure_elementaire_id: EL_FEU,
      armure_amelioration_elementaire_id: amelioration('armure_elementaire', 3), armure_parties: [{ emplacement_id: 'torse', solidite: 0 }],
    }, { maintenant });
    const p = avant.personnage;
    assert.deepEqual([...ARMURE.map((c) => p[c]), p.armure_parties], [null, null, EL_FEU, amelioration('armure_elementaire', 3), []]);
    assert.equal(p.notes, `Ma note\n[23/10/2026] Retrait (règles modifiées) : l’armure « ${nom('armure', GRILLE)} » (amélioration +2, solidité Torse 0) est devenue l’armure `
      + `élémentaire « ${nom('armure_elementaire', EL_FEU)} » (amélioration +3) de la fiche, remise à sa solidité maximum : une armure transformée par une pièce `
      + 'élémentaire n’a plus rien de l’armure d’origine. Adaptez la fiche.');
    assert.deepEqual(avant.controles.filter((c) => c.regle.startsWith('armure')), []);

    // un envoi partiel qui pose une armure de base sur une fiche qui a une armure élémentaire : la fiche enregistrée porterait les deux, convertie de même
    const partiel = enregistrerFiche(db, { version: p.version, armure_id: GRILLE }, { id: p.id, maintenant });
    assert.deepEqual(ARMURE.map((c) => partiel.personnage[c]), [null, null, EL_FEU, amelioration('armure_elementaire', 3)]);
    assert.equal(ligne(partiel.personnage.notes).length, 2);

    // une armure « Familier », une armure élémentaire d'une magie que le personnage n'a pas : jamais enregistrées
    const familier = enregistrerFiche(db, { nom: 'Familier', magie_innee_id: FEU, classes: CLASSES, armure_id: FAMILIER, armure_parties: [{ emplacement_id: 'armure-complete', solidite: 1 }] }, { maintenant });
    assert.deepEqual([familier.personnage.armure_id, familier.personnage.armure_parties], [null, []]);
    assert.deepEqual(ligne(familier.personnage.notes), [`l’armure « ${nom('armure', FAMILIER)} » (solidité Armure Complète 1) n’est plus portée : une armure de familier ne se porte pas sur une fiche de personnage. Adaptez la fiche.`]);
    const vent = enregistrerFiche(db, { nom: 'Sans le Vent', magie_innee_id: FEU, classes: CLASSES, armure_elementaire_id: EL_VENT }, { maintenant });
    assert.equal(vent.personnage.armure_elementaire_id, null);
    assert.deepEqual(ligne(vent.personnage.notes), [`l’armure élémentaire « ${nom('armure_elementaire', EL_VENT)} » n’est plus portée : le personnage n’a pas la magie de cette armure (Vent). Adaptez la fiche.`]);
    // la magie acquise suffit : rien n'est retiré, rien n'est noté
    const acquise = enregistrerFiche(db, { nom: 'Le Vent acquis', magie_innee_id: FEU, magie_acquise_id: VENT, classes: CLASSES, armure_elementaire_id: EL_VENT }, { maintenant });
    assert.deepEqual([acquise.personnage.armure_elementaire_id, acquise.personnage.notes], [EL_VENT, null]);
    // la magie acquise retirée ensuite : l'armure part avec elle
    const sansAcquise = enregistrerFiche(db, { version: acquise.personnage.version, magie_acquise_id: null }, { id: acquise.personnage.id, maintenant });
    assert.equal(sansAcquise.personnage.armure_elementaire_id, null);
    assert.equal(ligne(sansAcquise.personnage.notes).length, 1);

    // le poids portable : le calcul du moteur de la fiche lu dans la base par défaut (Cuirassé : Lourd ; test/serveur-poids-portable.test.mjs), un autre
    // donné par `poidsPortable`, aucun avec `poidsPortable: null`
    assert.equal(enregistrerFiche(db, { nom: 'Cuirassé', magie_innee_id: FEU, classes: CLASSES, armure_id: LOURDE }, { maintenant }).personnage.armure_id, LOURDE);
    const lourde = enregistrerFiche(db, { nom: 'Trop lourde', magie_innee_id: FEU, classes: CLASSES, armure_id: LOURDE }, { maintenant, poidsPortable: () => 1 });
    assert.deepEqual(ligne(lourde.personnage.notes), [`l’armure « ${nom('armure', LOURDE)} » n’est plus portée : elle est trop lourde pour le personnage (Lourd, au plus Léger). Adaptez la fiche.`]);
    assert.equal(enregistrerFiche(db, { nom: 'Sans calcul', magie_innee_id: FEU, armure_id: LOURDE }, { maintenant, poidsPortable: null }).personnage.armure_id, LOURDE,
      'poidsPortable: null : gardée, même sans classe');
  } finally {
    db.close();
  }
});
