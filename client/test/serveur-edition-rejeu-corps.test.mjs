// Rejeu du journal et corps des pages typées (client/serveur/edition.mjs#rejouerLeJournal, edition-journal.mjs#rejouer, colonnes dérivées) : le corps
// d'une page que l'édition tire de ses tables n'est pas une valeur figée du journal. Rejoué sur des règles qui le contiennent déjà (le site de dev après
// la livraison de ses propres modifications), un lot est « intégré » même quand une autre modification ou une création a réécrit la même page ; rejoué
// sur des règles qui ont changé la page autrement (une livraison), il n'est jamais écarté pour cela ; un lot noté avant que l'édition ne suive le corps
// (sans modification de page) voit le corps de ses pages refait au rejeu, dans data/rows comme dans la base vivante.
import assert from 'node:assert/strict';
import { copyFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { FICHIER_BASE, ouvrirBaseVivante, preparerBaseVivante } from '../serveur/base-vivante.mjs';
import { colonneDerivee, enregistrer, rejouerLeJournal } from '../serveur/edition.mjs';
import { chargerJournal, journalExporte, ouvrirLot } from '../serveur/edition-journal.mjs';
import { morceauxDuCorpsDeMagie } from '../src/lib/corps-magies.mjs';
import { corpsDeRace, etatDeRace } from '../src/lib/corps-races.mjs';
import { cheminBase } from '../src/lib/donnees.mjs';
import { normalize } from '../src/lib/text.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';

const racine = dossierTemporaire('rejeu-corps');
const REGLES = cheminBase({ sansExemples: false });
let compteur = 0;
const dossier = () => join(racine, `b${(compteur += 1)}`);
/** Une base vivante neuve (copie des règles) ; `sql` les modifie d'abord (une livraison). */
function base(sql = '') {
  let regles = REGLES;
  if (sql) {
    regles = `${dossier()}.db`;
    copyFileSync(REGLES, regles);
    const db = new DatabaseSync(regles);
    db.exec(sql);
    db.close();
  }
  return ouvrirBaseVivante(preparerBaseVivante({ regles, dossier: dossier() }).chemin);
}
/** Le journal de lots faits sur une base neuve (`lots` : listes d'opérations, une par lot). */
function journalDe(lots) {
  const db = base();
  for (const operations of lots) enregistrer(db, { page: 'essai/', operations });
  const journal = journalExporte(db);
  db.close();
  return journal;
}
/** Rejoue un journal sur `db` comme db:appliquer-edition : { bilan, conflits (détails), pages (réécrites) }. */
function rejouerSur(db, journal) {
  db.exec('PRAGMA foreign_keys = OFF');
  db.exec('BEGIN');
  chargerJournal(db, journal);
  const sortie = {};
  const bilan = rejouerLeJournal(db, sortie);
  const conflits = db.prepare("SELECT DISTINCT detail FROM modification WHERE etat = 'conflit'").all().map((c) => c.detail);
  db.exec('COMMIT');
  db.exec('PRAGMA foreign_keys = ON');
  return { bilan, conflits, pages: sortie.pages };
}
/** Les règles qui contiennent déjà le journal (data/rows après db:appliquer-edition : le journal rejoué, puis vidé). */
function reglesAvec(journal, sql = '') {
  const db = base(sql);
  const r = rejouerSur(db, journal);
  assert.deepEqual(r.conflits, []);
  db.exec('DELETE FROM modification; DELETE FROM modification_lot');
  return db;
}
const corpsDe = (db) => Object.fromEntries(db.prepare('SELECT id, corps_md, resume FROM page').all().map((p) => [p.id, `${p.corps_md}\u0000${p.resume}`]));
const corps = (db, id) => db.prepare('SELECT corps_md FROM page WHERE id = ?').get(id).corps_md;
const executer = (db) => (sql, ...p) => db.prepare(sql).all(...p);
/** Le corps d'une race redit ses tables (recalculé avec elles : inchangé). */
const raceAJour = (db, id) => corpsDeRace(corps(db, id), etatDeRace(executer(db), id)) === corps(db, id);
const nomLibre = (base, table) => `${base} ${process.pid}-${(compteur += 1)} ${table}`;

const FEU = 'magies/magie-du-feu';
const HUMAIN = 'races/humain';
const DRAKOS = 'races/drakos';

test('colonnes dérivées : corps et résumé des pages typées, pas ceux du guide et du Codex ni les autres colonnes', () => {
  assert.equal(colonneDerivee('page', { id: FEU }, 'corps_md'), true);
  assert.equal(colonneDerivee('page', { id: HUMAIN }, 'resume'), true);
  assert.equal(colonneDerivee('page', { id: 'guide/bienvenue' }, 'corps_md'), false);
  // les pages du Codex : leur texte est modifié lui-même (lib/edition-modele.mjs#texteDePageModifiable)
  assert.equal(colonneDerivee('page', { id: 'lore/eaunoire' }, 'corps_md'), false);
  assert.equal(colonneDerivee('page', { id: FEU }, 'titre'), false);
  assert.equal(colonneDerivee('race', { id: HUMAIN }, 'presentation'), false);
  // D11 : `donnees` des fiches de dons (classe, spécialité, choix…) est tiré des tables ; celui des pages de race (magies innées) ne l'est pas
  assert.equal(colonneDerivee('page', { id: 'capacites/guerrier-affute' }, 'donnees'), true);
  assert.equal(colonneDerivee('page', { id: HUMAIN }, 'donnees'), false);
  assert.equal(colonneDerivee('page', { id: 'capacites/guerrier-affute' }, 'titre'), false);
});

test('rejoué sur des règles qui le contiennent déjà : tout est « intégré », même deux lots sur la même page ou une race créée puis réécrite', () => {
  const db = base();
  const [s1, s2] = db.prepare('SELECT id FROM sort WHERE magie_id = ? ORDER BY ordre LIMIT 2').all(FEU).map((s) => s.id);
  db.close();
  const journal = journalDe([
    [{ op: 'modifier', table: 'sort', cle: { id: s1 }, valeurs: { cout_brut: '41' } }],
    [{ op: 'modifier', table: 'sort', cle: { id: s2 }, valeurs: { cout_brut: '42' } }],
    [{ op: 'creer', entite: 'race', valeurs: { nom: nomLibre('Race', 'rejeu'), nature: 'pure', presentation: 'Une race du rejeu.' } }],
    [{ op: 'modifier', table: 'race_onglet', cle: { race_id: DRAKOS }, valeurs: { histoire: 'Histoire du rejeu.' } }],
    [{ op: 'creer', entite: 'classe', valeurs: { nom: nomLibre('Classe', 'rejeu'), categorie_id: 'classe-magique' } }],
  ]);
  const livree = reglesAvec(journal);
  const avant = corpsDe(livree);
  const r = rejouerSur(livree, journal);
  assert.deepEqual(r.conflits, []);
  assert.equal(r.bilan.appliquees, 0, JSON.stringify(r.bilan));
  assert.equal(r.bilan.integrees, journal.lots.reduce((n, l) => n + l.modifications.length, 0));
  assert.deepEqual(r.pages, []);
  assert.deepEqual(corpsDe(livree), avant, 'aucune page réécrite');
  assert.deepEqual(livree.prepare('SELECT DISTINCT etat FROM modification').all().map((m) => m.etat), ['integree']);
  livree.close();
});

test('rejoué sur des règles qui ont changé la page autrement : le lot passe (la création d’une classe n’est plus perdue) et le corps dit les deux', () => {
  const j0 = journalDe([[{ op: 'modifier', table: 'race_onglet', cle: { race_id: HUMAIN }, valeurs: { histoire: 'Une autre histoire des humains.' } }]]);
  const classe = nomLibre('Classe', 'perdue');
  const j1 = journalDe([[{ op: 'creer', entite: 'classe', valeurs: { nom: classe, categorie_id: 'classe-magique' } }]]);
  const livree = reglesAvec(j0);
  const r = rejouerSur(livree, j1);
  assert.deepEqual(r.conflits, []);
  assert.equal(r.bilan.conflits, 0);
  assert.ok(livree.prepare('SELECT 1 FROM classe WHERE nom = ?').get(classe), 'la classe est créée');
  const c = corps(livree, HUMAIN);
  assert.ok(c.includes('Une autre histoire des humains.'), 'l’histoire de la livraison reste');
  const total = livree.prepare('SELECT count(*) AS n FROM classe').get().n;
  assert.match(c, new RegExp(`^Nombre : \\d+ sur ${total}\\.$`, 'm'), 'une colonne de plus dans « Classes accessibles »');
  assert.ok(raceAJour(livree, HUMAIN));
  assert.ok(r.pages.includes(HUMAIN));
  livree.close();
});

test('lot noté avant que l’édition ne suive le corps (aucune modification de page) : le rejeu refait le corps de ses pages', () => {
  const db = base();
  const boule = db.prepare('SELECT id, ordre, cout_brut FROM sort WHERE magie_id = ? ORDER BY ordre LIMIT 1').get(FEU);
  db.close();
  const cout = boule.cout_brut === '9' ? '8' : '9'; // une valeur que la base n'a pas déjà
  const journal = journalDe([[
    { op: 'modifier', table: 'sort', cle: { id: boule.id }, valeurs: { cout_brut: cout } },
    { op: 'modifier', table: 'race_onglet', cle: { race_id: HUMAIN }, valeurs: { histoire: 'Histoire notée avant D4.' } },
  ]]);
  for (const l of journal.lots) l.modifications = l.modifications.filter((m) => m.table !== 'page');
  const cible = base();
  const r = rejouerSur(cible, journal);
  assert.deepEqual(r.conflits, []);
  assert.deepEqual([...r.pages].sort(), [FEU, HUMAIN]);
  assert.equal(morceauxDuCorpsDeMagie(corps(cible, FEU)).sorts[boule.ordre - 1][3], cout);
  assert.ok(corps(cible, HUMAIN).includes('Histoire notée avant D4.'));
  assert.ok(raceAJour(cible, HUMAIN));
  cible.close();
});

test('base vivante refaite par une livraison : un lot en attente noté sans sa page voit le corps de la page refait', () => {
  const premiere = dossier();
  preparerBaseVivante({ regles: REGLES, dossier: premiere });
  const chemin = join(premiere, FICHIER_BASE);
  const db = ouvrirBaseVivante(chemin);
  db.exec('BEGIN');
  const w = ouvrirLot(db, { id: 'lot-ancien', instant: '2026-10-10T12:00:00Z', pageId: `${DRAKOS}/` });
  w.modifier('race_onglet', { race_id: DRAKOS }, { histoire: 'Histoire du service d’avant.' });
  w.terminer('lot noté par le service d’avant D4');
  db.exec('COMMIT');
  db.close();
  const regles = `${dossier()}.db`;
  copyFileSync(REGLES, regles);
  const livraison = new DatabaseSync(regles);
  livraison.exec("UPDATE metier SET description = description || ' (livraison)' WHERE id = 'metiers/acrobate'");
  livraison.close();
  const r = preparerBaseVivante({ regles, dossier: premiere });
  assert.equal(r.refaite, true);
  assert.deepEqual(r.rejeu, { appliquees: 1, integrees: 0, conflits: 0, lots: 1 });
  const vivante = ouvrirBaseVivante(chemin);
  assert.ok(corps(vivante, DRAKOS).includes('Histoire du service d’avant.'));
  assert.ok(raceAJour(vivante, DRAKOS));
  vivante.close();
});

// --- D11 : spécialités et dons créés et supprimés -----------------------------------------------------------------------------------------------
// un don reçu sans choix et un don d'un choix de deux dans une spécialité (Hyper contact et Affûté du Guerrier à l'import), lus dans les règles : le
// site de dev a pu en supprimer ou en ajouter
const lues = new DatabaseSync(REGLES, { readOnly: true });
const RECU = lues.prepare("SELECT id, classe_id FROM capacite WHERE nature = 'classe' ORDER BY id = 'capacites/guerrier-hyper-contact' DESC, id LIMIT 1").get();
const AU_CHOIX = lues.prepare(`SELECT k.id, k.classe_id FROM capacite k WHERE k.nature = 'choix' AND k.specialite_id IS NOT NULL
  AND (SELECT count(*) FROM capacite b WHERE b.classe_id = k.classe_id AND b.ligne = k.ligne AND b.specialite_id = k.specialite_id AND b.nature = 'choix') = 2
  ORDER BY k.id = 'capacites/guerrier-affute' DESC, k.id LIMIT 1`).get();
lues.close();
const HYPER_CONTACT = RECU.id;
const AFFUTE = AU_CHOIX.id;
const donneesDe = (db) => Object.fromEntries(db.prepare("SELECT id, donnees FROM page WHERE type = 'capacites'").all().map((p) => [p.id, p.donnees]));
const donneesDuDon = (db, id) => JSON.parse(db.prepare('SELECT donnees FROM page WHERE id = ?').get(id).donnees);

test('D11 — spécialités et dons créés puis supprimés, rejoués sur des règles qui les contiennent : tout « intégré », aucune page réécrite', () => {
  const nom = nomLibre('Classe', 'd11');
  const id = `classes/${normalize(nom)}`;
  const option = nomLibre('Option', 'd11');
  const journal = journalDe([
    [{ op: 'creer', entite: 'classe', valeurs: { nom, categorie_id: 'classe-magique' } }],
    [
      { op: 'creer', entite: 'specialite', valeurs: { classe_id: id, nom: 'PREMIERE', don_nom: 'Première', don_type: 'Passif', don_effet: 'Effet premier.' } },
      { op: 'creer', entite: 'specialite', valeurs: { classe_id: id, nom: 'SECONDE', don_nom: 'Seconde', don_type: 'Actif' } },
      { op: 'creer', entite: 'capacite', valeurs: { classe_id: id, specialite_id: '@0', niveau: '15', nom: 'Un', type: 'Passif', effet: 'Effet un.' } },
      { op: 'creer', entite: 'capacite', valeurs: { classe_id: id, specialite_id: '@0', avec: '@2', nom: 'Deux', type: 'Passif' } },
    ],
    [{ op: 'supprimer', entite: 'specialite', cle: { id: `${id}#specialite:seconde` } }],
    [{ op: 'creer', entite: 'capacite', valeurs: { classe_id: RECU.classe_id, avec: HYPER_CONTACT, nom: option, type: 'Passif' } }],
    [{ op: 'supprimer', entite: 'capacite', cle: { id: `capacites/${normalize(nom)}-deux` } }],
  ]);
  const livree = reglesAvec(journal);
  assert.equal(livree.prepare('SELECT nature FROM capacite WHERE id = ?').get(HYPER_CONTACT).nature, 'choix', 'le don reçu d’office devenu un choix');
  const avant = { corps: corpsDe(livree), donnees: donneesDe(livree) };
  const r = rejouerSur(livree, journal);
  assert.deepEqual(r.conflits, []);
  assert.equal(r.bilan.appliquees, 0, JSON.stringify(r.bilan));
  assert.equal(r.bilan.integrees, journal.lots.reduce((n, l) => n + l.modifications.length, 0));
  assert.deepEqual(r.pages, []);
  assert.deepEqual({ corps: corpsDe(livree), donnees: donneesDe(livree) }, avant, 'aucune page réécrite');
  livree.close();
});

test('D11 — une option rejouée sur des règles changées ailleurs (spécialité renommée, effet d’un voisin) : le lot passe, `donnees` des voisins recalculé', () => {
  const db = base();
  const affute = db.prepare('SELECT * FROM capacite WHERE id = ?').get(AFFUTE);
  const voisin = db.prepare("SELECT id FROM capacite WHERE classe_id = ? AND ligne = ? AND specialite_id = ? AND nature = 'choix' AND id <> ?").get(affute.classe_id, affute.ligne, affute.specialite_id, AFFUTE).id;
  db.close();
  const option = nomLibre('Option', 'livraison');
  const journal = journalDe([[{ op: 'creer', entite: 'capacite', valeurs: { classe_id: AU_CHOIX.classe_id, avec: AFFUTE, nom: option, type: 'Passif' } }]]);
  const cree = journal.lots[0].modifications.find((m) => m.table === 'capacite' && m.operation === 'inserer').cle.id;
  // la livraison, comme le site l'aurait livrée : la spécialité renommée (et la fiche de ses dons), l'effet du voisin changé (et sa fiche)
  const livree = base(`
    UPDATE specialite SET nom = 'SPÉCIALITÉ LIVRÉE', nom_cle = 'specialite-livree' WHERE id = '${affute.specialite_id}';
    UPDATE page SET donnees = json_set(donnees, '$.specialite', 'SPÉCIALITÉ LIVRÉE') WHERE id IN (SELECT id FROM capacite WHERE specialite_id = '${affute.specialite_id}');
    UPDATE capacite SET effet = 'Effet livré.' WHERE id = '${voisin}';
    UPDATE page SET corps_md = 'Effet livré.' || char(10), resume = 'Effet livré.' WHERE id = '${voisin}';`);
  const r = rejouerSur(livree, journal);
  assert.deepEqual(r.conflits, [], 'avant D11, `donnees` des voisins était une valeur figée du journal : le lot entier était perdu');
  assert.ok(livree.prepare('SELECT 1 FROM capacite WHERE id = ?').get(cree), 'l’option est créée');
  for (const id of [AFFUTE, voisin, cree]) {
    const d = donneesDuDon(livree, id);
    assert.equal(d.specialite, 'SPÉCIALITÉ LIVRÉE', id);
    assert.deepEqual([...d.choix_exclusif_avec].sort(), [AFFUTE, voisin, cree].filter((x) => x !== id).sort(), id);
  }
  assert.equal(corps(livree, voisin), 'Effet livré.\n', 'l’effet de la livraison reste');
  assert.ok(r.pages.includes(AFFUTE) && r.pages.includes(voisin));
  livree.close();
});

test('D11 — le don « au choix avec » supprimé par la livraison : le lot est en conflit, la base reste intacte', () => {
  const option = nomLibre('Option', 'perdue');
  const journal = journalDe([[{ op: 'creer', entite: 'capacite', valeurs: { classe_id: RECU.classe_id, avec: HYPER_CONTACT, nom: option, type: 'Passif' } }]]);
  const H = HYPER_CONTACT;
  const livree = base(`
    DELETE FROM note_cellule WHERE entite_table = 'capacite' AND entite_id = '${H}';
    DELETE FROM capacite WHERE id = '${H}';
    DELETE FROM page_entite WHERE page_id = '${H}';
    DELETE FROM page_tag WHERE page_id = '${H}';
    DELETE FROM page_source WHERE page_id = '${H}';
    DELETE FROM alias WHERE page_id = '${H}';
    DELETE FROM page WHERE id = '${H}';`);
  const compte = (t) => livree.prepare(`SELECT count(*) AS n FROM "${t}"`).get().n;
  const avant = { capacite: compte('capacite'), page: compte('page'), page_tag: compte('page_tag') };
  const r = rejouerSur(livree, journal);
  assert.equal(r.conflits.length, 1, JSON.stringify(r.conflits));
  assert.match(r.conflits[0], /la ligne n’existe plus dans les règles/);
  assert.equal(r.bilan.appliquees, 0);
  assert.deepEqual({ capacite: compte('capacite'), page: compte('page'), page_tag: compte('page_tag') }, avant, 'rien de la création n’est écrit');
  assert.equal(livree.prepare('SELECT 1 FROM capacite WHERE nom = ?').get(option), undefined);
  livree.close();
});
