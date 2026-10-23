// Décision R165 (6), (7) côté service : le poids portable d'une fiche lu dans la base (lib/poids-portable-db.mjs) est celui du moteur de la fiche
// (lib/fiche-moteur.mjs#poidsPortableDe, sur les règles de la page), comparé sur toute la base (chaque classe, chaque race, des ethnies, des niveaux, des
// spécialités et des dons à choix, chaque magie innée) ; il est branché à la reconstruction de la base vivante (toutes les fiches, joueurs compris) et
// à chaque enregistrement : une armure trop lourde est retirée et notée, au texte du moteur (retraitsDeLArmureHorsListe + ligneDeRetrait), une fiche
// dans sa liste n'est pas touchée, une seconde passe ne fait rien. Tout s'écrit dans des copies de la base construite depuis data/rows.
import assert from 'node:assert/strict';
import { copyFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { after, test } from 'node:test';
import { ouvrirBaseVivante, preparerBaseVivante } from '../serveur/base-vivante.mjs';
import { enregistrerFiche, lireFiche } from '../serveur/fiches.mjs';
import { cheminBase } from '../src/lib/donnees.mjs';
import { ficheVide, ligneDeRetrait, PREFIXE_DE_RETRAIT } from '../src/lib/fiche-format.mjs';
import * as M from '../src/lib/fiche-moteur.mjs';
import { chargerReglesDeFiche } from '../src/lib/fiche-regles.mjs';
import { COLONNES_LUES, lecteurDuPoidsPortable, poidsPortableDeLaBase } from '../src/lib/poids-portable-db.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';

const dossier = dossierTemporaire('poids-portable');
const REGLES = cheminBase({ sansExemples: false });
const INSTANT = '2026-10-23T08:00:00Z';
const lecture = new DatabaseSync(REGLES, { readOnly: true });
after(() => lecture.close());
const tout = (sql, ...p) => lecture.prepare(sql).all(...p).map((r) => ({ ...r }));
const un = (sql, ...p) => lecture.prepare(sql).get(...p);
const regles = JSON.parse(JSON.stringify(chargerReglesDeFiche(lecture))); // tel que la page le reçoit
const XP_MAX = un('SELECT max(xp_min) AS x FROM niveau_global').x;
const FEU = 'magies/magie-du-feu';
const MAGE = 'classes/mage';
const CUIRASSE = 'classes/cuirasse';
const HUMAIN = { race_id: 'races/humain', ethnie_id: 'races/humain#ethnie:humain-central' };
const LEGERE = un("SELECT id FROM armure WHERE type = 'Léger' AND solidite_uni IS NULL ORDER BY ordre LIMIT 1").id;
const LOURDE = un("SELECT id FROM armure WHERE type = 'Lourd' AND solidite_uni IS NULL ORDER BY ordre LIMIT 1").id;
const VETEMENT = un("SELECT id FROM armure WHERE type = 'Vêtement' ORDER BY ordre LIMIT 1").id;
const EL_FEU_LEGER = un("SELECT id FROM armure_elementaire WHERE magie_id = ? AND categorie = 'Léger'", FEU).id;

function nouvelleCopie(nom) {
  const chemin = join(dossier, nom);
  copyFileSync(REGLES, chemin);
  const db = new DatabaseSync(chemin);
  db.exec('PRAGMA foreign_keys = ON');
  return db;
}
function inserer(db, table, ligne) {
  const cols = Object.keys(ligne);
  db.prepare(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`).run(...Object.values(ligne));
}
/** Une fiche posée en SQL (prétiré par défaut), ses classes `[[classe, spécialité], …]` et ses dons à choix. */
function poser(db, id, { classes = [], choix = [], ...colonnes } = {}) {
  inserer(db, 'personnage', {
    id, nature: 'pretire', proprietaire_id: null, visibilite: 'tous', nom: `Fiche ${id}`, magie_innee_id: FEU, mode_classe: 'mono', xp: 0,
    alignement_loyal: 0, alignement_chaotique: 0, alignement_bon: 0, alignement_mauvais: 0, bourse_pp: 0, bourse_ro: 0, bourse_rf: 0, ambidextrie: 0,
    cree_le: INSTANT, modifie_le: INSTANT, ...colonnes,
  });
  classes.forEach(([classe_id, specialite_id = null], i) => inserer(db, 'personnage_classe', { personnage_id: id, rang: i + 1, classe_id, specialite_id }));
  for (const capacite_id of choix) inserer(db, 'personnage_capacite', { personnage_id: id, capacite_id });
}
const lignesDeRetrait = (notes) => (notes ?? '').split('\n').filter((l) => l.includes(PREFIXE_DE_RETRAIT));

test('R165 (6) : le poids portable lu dans la base est celui du moteur de la fiche, sur chaque classe, race, ethnie, magie innée, niveau, spécialité, don à choix', () => {
  const db = nouvelleCopie('equivalence.db');
  try {
    const classes = tout('SELECT id FROM classe ORDER BY ordre').map((c) => c.id);
    const specialites = new Map(tout('SELECT classe_id, id FROM specialite ORDER BY classe_id, rang').map((s) => [s.classe_id, s.id]));
    const choixDe = (classe) => tout("SELECT id FROM capacite WHERE classe_id = ? AND nature = 'choix'", classe).map((c) => c.id);
    const races = [...tout('SELECT race_id AS id FROM race_onglet ORDER BY race_id').map((r) => r.id), null];
    const ethnies = new Map(races.map((r) => [r, tout('SELECT id FROM ethnie WHERE race_id = ? ORDER BY id', r).map((e) => e.id)]));
    const magies = [...tout('SELECT id FROM magie ORDER BY ordre').map((m) => m.id), null];
    const ids = [];
    let n = 0;
    db.exec('BEGIN');
    classes.forEach((classe, i) => races.forEach((race, j) => {
      const k = i * races.length + j;
      const ethniesDeLaRace = ethnies.get(race) ?? [];
      const seconde = classes[(i + 1 + j) % classes.length];
      const bi = k % 4 === 3;
      const avecSpecialite = k % 2 === 0 && specialites.has(classe);
      const id = `eq-${n++}`;
      poser(db, id, {
        race_id: race, ethnie_id: ethniesDeLaRace.length ? ethniesDeLaRace[k % (ethniesDeLaRace.length + 1)] ?? null : null,
        magie_innee_id: magies[k % magies.length], mode_classe: bi ? 'bi' : 'mono', xp: [0, XP_MAX, Math.floor(XP_MAX / 3)][Math.floor(k / 3) % 3],
        classes: [[classe, avecSpecialite ? specialites.get(classe) : null], ...(k % 3 === 0 ? [] : [[seconde]])],
        choix: k % 5 === 0 ? [] : choixDe(classe),
      });
      ids.push(id);
    }));
    poser(db, 'eq-sans-classe', { race_id: null, magie_innee_id: null });
    ids.push('eq-sans-classe');
    // tout Nain, ethnie choisie ou non (« Oui, tout Nain (Recommandé) ») : Mage 1, Cuirassé 3
    poser(db, 'eq-nain-sans-ethnie-mage', { race_id: 'races/nain', ethnie_id: null, classes: [[MAGE]] });
    poser(db, 'eq-nain-sans-ethnie-cuirasse', { race_id: 'races/nain', ethnie_id: null, classes: [[CUIRASSE]] });
    ids.push('eq-nain-sans-ethnie-mage', 'eq-nain-sans-ethnie-cuirasse');
    db.exec('COMMIT');
    const lire = lecteurDuPoidsPortable(db);
    const vus = new Set();
    for (const id of ids) {
      const attendu = M.poidsPortableDe(regles, lireFiche(db, id));
      assert.deepEqual(lire(id), attendu, id);
      vus.add(attendu.valeur);
      for (const e of attendu.etapes) vus.add(e.texte.replace(/^.* : /, ''));
    }
    // chaque valeur et chaque étape du calcul est passée par la comparaison (Nain +1, Lamia, Potentiel Illimité, un don qui écrit un poids)
    for (const v of [0, 1, 2, 3, 'une catégorie supérieure (+1)', 'au moins Léger', 'Intermédiaire au plus (pas d’armure lourde)']) assert.ok(vus.has(v), String(v));
    assert.ok([...vus].some((t) => typeof t === 'string' && /^(Léger|Intermédiaire|Lourd)$/.test(t)), 'un don qui écrit un poids');
    assert.equal(lire('eq-nain-sans-ethnie-mage').valeur, 1, 'Nain sans ethnie Mage');
    assert.equal(lire('eq-nain-sans-ethnie-cuirasse').valeur, 3, 'Nain sans ethnie Cuirassé');
    assert.ok(vus.has('une catégorie supérieure (+1)'));
    assert.ok(lire('eq-nain-sans-ethnie-mage').etapes.some((e) => e.texte === 'Nain (toutes les ethnies) : une catégorie supérieure (+1)'));
    assert.equal(lire('absente'), null, 'une fiche absente : on ne sait pas');
    assert.equal(poidsPortableDeLaBase(db)(db, ids[0]), M.poidsPortable(regles, lireFiche(db, ids[0])));
  } finally {
    db.close();
  }
});

test('R165 (6) : une base qui n’a pas ce que lit le calcul (base vivante d’avant, en repli) ne sait pas dire le poids : rien n’est retiré', () => {
  for (const [table, colonnes] of Object.entries(COLONNES_LUES)) {
    const reelles = tout('SELECT name FROM pragma_table_info(?)', table).map((c) => c.name);
    for (const c of colonnes) assert.ok(reelles.includes(c), `${table}.${c}`);
  }
  const db = nouvelleCopie('repli.db');
  try {
    poser(db, 'repli', { classes: [[MAGE]], armure_id: LOURDE });
    assert.equal(lecteurDuPoidsPortable(db)('repli').valeur, 0);
    db.exec('DROP VIEW v_personnage_controle; DROP VIEW v_personnage_don_acquis');
    assert.equal(lecteurDuPoidsPortable(db)('repli'), null);
    assert.equal(poidsPortableDeLaBase(db)(db, 'repli'), null);
  } finally {
    db.close();
  }
});

test('R165 (7) : la reconstruction retire l’armure trop lourde de chaque fiche (joueurs compris), note au texte du moteur ; une fiche dans sa liste n’est pas touchée ; idempotente', () => {
  const lieu = join(dossier, 'vivante');
  const { chemin } = preparerBaseVivante({ regles: REGLES, dossier: lieu });
  const ecrire = new DatabaseSync(chemin);
  ecrire.exec('PRAGMA foreign_keys = ON');
  inserer(ecrire, 'utilisateur', { id: 'u-poids', discord_id: null, nom_affichage: 'Joueur', cree_le: INSTANT });
  poser(ecrire, 'mage-legere', { ...HUMAIN, classes: [[MAGE]], armure_id: LEGERE, armure_amelioration_id: un("SELECT id FROM amelioration_equipement WHERE cible = 'armure' AND niveau = 2").id, notes: 'Ma note' });
  poser(ecrire, 'mage-vetement', { ...HUMAIN, classes: [[MAGE]], armure_id: VETEMENT, notes: 'Rien' });
  poser(ecrire, 'cuirasse-lourde', { ...HUMAIN, classes: [[CUIRASSE]], armure_id: LOURDE });
  poser(ecrire, 'mage-element', { ...HUMAIN, classes: [[MAGE]], armure_elementaire_id: EL_FEU_LEGER });
  poser(ecrire, 'joueur-mage', { ...HUMAIN, nature: 'joueur', proprietaire_id: 'u-poids', visibilite: 'privee', classes: [[MAGE]], armure_id: LOURDE });
  // le jumeau prétiré de la fiche de joueur : lireFiche (donc le moteur) ne lit que les prétirés
  poser(ecrire, 'jumeau-joueur', { ...HUMAIN, classes: [[MAGE]], armure_id: LOURDE });
  ecrire.close();
  // les lignes que le moteur écrirait pour chacune, sur les fiches d'avant la reconstruction (à leur date)
  const avant = new DatabaseSync(chemin, { readOnly: true });
  const attendues = Object.fromEntries(['mage-legere', 'mage-vetement', 'cuirasse-lourde', 'mage-element', 'jumeau-joueur'].map((id) => {
    const r = M.retraitsDeLArmureHorsListe(regles, lireFiche(avant, id));
    return [id, r ? r.retraits.map((d) => ligneDeRetrait(d, INSTANT)) : []];
  }));
  avant.close();
  assert.equal(attendues['mage-legere'].length, 1);
  assert.match(attendues['mage-legere'][0], /\(amélioration \+2\) n’est plus portée : elle est trop lourde pour le personnage \(Léger, au plus Vêtement\)/);
  const livraison = (n) => {
    const f = join(dossier, `regles-${n}.db`);
    copyFileSync(REGLES, f);
    const db = new DatabaseSync(f);
    db.prepare('UPDATE metier SET remarque = ? WHERE id = (SELECT min(id) FROM metier)').run(`livraison ${n}`);
    db.close();
    return f;
  };
  const r = preparerBaseVivante({ regles: livraison(1), dossier: lieu, instant: new Date(INSTANT) });
  assert.equal(r.refaite, true);
  assert.deepEqual(r.fiches.map((f) => f.fiche).sort(), ['Fiche jumeau-joueur', 'Fiche mage-element', 'Fiche mage-legere', 'fiche de joueur n° 1']);
  const db = ouvrirBaseVivante(chemin);
  let apres;
  try {
    const legere = db.prepare('SELECT armure_id, armure_amelioration_id, notes, modifie_le FROM personnage WHERE id = ?').get('mage-legere');
    assert.deepEqual({ ...legere }, { armure_id: null, armure_amelioration_id: null, notes: `Ma note\n${attendues['mage-legere'][0]}`, modifie_le: INSTANT });
    assert.deepEqual(lignesDeRetrait(lireFiche(db, 'mage-element').notes), attendues['mage-element']);
    assert.equal(lireFiche(db, 'mage-element').armure_elementaire_id, null);
    const joueur = db.prepare('SELECT armure_id, notes FROM personnage WHERE id = ?').get('joueur-mage');
    assert.deepEqual([joueur.armure_id, lignesDeRetrait(joueur.notes)], [null, attendues['jumeau-joueur']], 'une fiche de joueur, au texte du moteur');
    // dans sa liste : rien ne change, ni la date
    for (const id of ['mage-vetement', 'cuirasse-lourde']) {
      assert.deepEqual(attendues[id], [], id);
      const f = lireFiche(db, id);
      assert.equal(f.modifie_le, INSTANT, id);
      assert.equal(lignesDeRetrait(f.notes).length, 0, id);
    }
    assert.equal(lireFiche(db, 'cuirasse-lourde').armure_id, LOURDE);
    apres = Object.fromEntries(['mage-legere', 'mage-vetement', 'cuirasse-lourde', 'mage-element', 'jumeau-joueur'].map((id) => [id, lireFiche(db, id)]));
  } finally {
    db.close();
  }
  const encore = preparerBaseVivante({ regles: livraison(2), dossier: lieu, instant: new Date('2026-10-24T08:00:00Z') });
  assert.equal(encore.refaite, true);
  assert.deepEqual(encore.fiches, [], 'idempotente : rien de plus');
  const relue = ouvrirBaseVivante(chemin);
  try {
    for (const [id, f] of Object.entries(apres)) assert.deepEqual(lireFiche(relue, id), f, id);
  } finally {
    relue.close();
  }
});

test('R165 (7) : chaque enregistrement juge le poids de la fiche enregistrée — une classe changée qui baisse le poids retire l’armure et la note, au texte du moteur', () => {
  const db = ouvrirBaseVivante(preparerBaseVivante({ regles: REGLES, dossier: join(dossier, 'service') }).chemin);
  const maintenant = new Date(INSTANT);
  try {
    const envoi = { ...ficheVide('Essai R165 poids portable'), ...HUMAIN, magie_innee_id: FEU, classes: [{ rang: 1, classe_id: CUIRASSE, specialite_id: null }], armure_id: LOURDE };
    const cuirasse = enregistrerFiche(db, envoi, { maintenant });
    assert.deepEqual([cuirasse.personnage.armure_id, cuirasse.personnage.notes], [LOURDE, null], 'dans sa liste : gardée, rien de noté');
    // la classe changée (envoi partiel) : Mage, aucune armure dans sa « Maîtrise Armures »
    const attendu = M.retraitsDeLArmureHorsListe(regles, { ...cuirasse.personnage, classes: [{ rang: 1, classe_id: MAGE, specialite_id: null }] })
      .retraits.map((d) => ligneDeRetrait(d, INSTANT));
    assert.equal(attendu.length, 1);
    const mage = enregistrerFiche(db, { version: cuirasse.personnage.version, classes: [{ rang: 1, classe_id: MAGE, specialite_id: null }] }, { id: cuirasse.personnage.id, maintenant });
    assert.equal(mage.personnage.armure_id, null);
    assert.deepEqual(lignesDeRetrait(mage.personnage.notes), attendu);
    assert.match(attendu[0], /elle est trop lourde pour le personnage \(Lourd, au plus Vêtement\)/);
    assert.equal(M.retraitsDeLArmureHorsListe(regles, mage.personnage), null, 'relue, la fiche n’a plus rien à retirer');
    // enregistrée de nouveau telle quelle : rien de plus (idempotent)
    const encore = enregistrerFiche(db, { version: mage.personnage.version, nom: 'Essai R165 poids portable, encore' }, { id: mage.personnage.id, maintenant });
    assert.equal(lignesDeRetrait(encore.personnage.notes).length, 1);
    // `poidsPortable: null` : pas d'étape du poids (le point d'accroche reste)
    const sans = enregistrerFiche(db, { ...envoi, nom: 'Essai R165 sans poids', classes: [{ rang: 1, classe_id: MAGE, specialite_id: null }] }, { maintenant, poidsPortable: null });
    assert.equal(sans.personnage.armure_id, LOURDE);
  } finally {
    db.close();
  }
});
