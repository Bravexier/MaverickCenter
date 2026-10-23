// Lots du journal en conflit, montrés et résolus sur la page « Mise à jour » du site de dev (client/serveur/edition-conflits.mjs ; demande du
// propriétaire du 2026-10-22 : « Après les listes de modifications, montrer les lignes en conflits. 1. Pour chaque conflit, montrer les deux versions
// 2. Laisser le choix entre 1, 2, ou 3 pour saisir à la main ce qui remplace les deux. »). Le cas réel : trois pages du guide (la-magie-en-jeu,
// le-mode-hyper, s-entrainer-et-exercer-un-metier) modifiées sur le site de dev avant leur réécriture par la PR #219, et des pages fusionnées puis
// supprimées. Le site de dev réel n'est pas joignable : tout se prouve ici sur une copie, le journal écrit par le vrai service d'édition, puis une
// livraison (des règles changées) qui refait la base vivante et met ses lots en conflit.
import assert from 'node:assert/strict';
import { copyFileSync, cpSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { after, before, test } from 'node:test';
import { traiter } from '../serveur/api.mjs';
import { FICHIER_BASE, ouvrirBaseVivante, preparerBaseVivante } from '../serveur/base-vivante.mjs';
import { enregistrer } from '../serveur/edition.mjs';
import {
  compterLesConflits, conflitsDuJournal, detailLisible, examinerLeLot, libelleDeLigne, lotsEnConflit, raisonLisible, resoudreLeConflit,
} from '../serveur/edition-conflits.mjs';
import { journalExporte, ouvrirLot } from '../serveur/edition-journal.mjs';
import { routeNormalisee } from '../serveur/metriques.mjs';
import { CONFIRMATION, enregistrerMajeure, figerLot, lireLot, noteEnPreparation } from '../serveur/notes-de-version.mjs';
import { cheminBase } from '../src/lib/donnees.mjs';
import { colonneMasquee, nomDeColonne, nomDeTable } from '../src/lib/libelles-de-la-base.mjs';
import { decouperCorps } from '../src/lib/markdown-edition.mjs';
import { normalize } from '../src/lib/text.mjs';

const racine = mkdtempSync(join(tmpdir(), 'maverick-conflits-'));
const ouvertes = [];
after(() => {
  for (const b of ouvertes) if (b.isOpen) b.close();
  rmSync(racine, { recursive: true, force: true });
});
let compteur = 0;
const chemin = (nom) => join(racine, `${nom}-${(compteur += 1)}`);

const MAGIE = 'guide/la-magie-en-jeu';
const HYPER = 'guide/le-mode-hyper';
const METIER_GUIDE = 'guide/s-entrainer-et-exercer-un-metier';
const FORGERON = 'metiers/forgeron';
const AJOUT = '\nParagraphe ajouté sur le site de dev (essai des conflits).\n';
const REECRITE = (id) => `Page ${id} réécrite par les règles livrées (essai des conflits).\n`;
const BONUS_DU_SITE = '+3% Esquive';
const BONUS_DES_REGLES = '+5% Parade';
const DESCRIPTION_DU_SITE = 'Description du forgeron écrite sur le site de dev (essai des conflits).';
// une étiquette rompue : un mot-clé d'essai (absent de la base) supprimé sur le site de dev, que les règles livrées posent sur un sort (sort_mot_cle)
const ETIQUETTE = { id: 'essai-conflits-etiquette', libelle: 'Essai conflits étiquette' };
const SORT_ETIQUETE = 'magies/magie-de-la-corruption#sort:aiguisage-magique';
// un renommage des deux bords : le site de dev et les règles livrées renomment le même métier (nom et sa clé normalisée nom_cle)
const ACROBATE = 'metiers/acrobate';
const NOM_DU_SITE = 'Acrobate du site (essai des conflits)';
const NOM_DES_REGLES = 'Acrobate des règles (essai des conflits)';

/** Supprime une ligne et tout ce qui la cite (clés coupées), comme une page fusionnée puis retirée des règles. */
function supprimerAvecSesReferences(db, table, id) {
  for (const { name } of db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all()) {
    let liens = [];
    try {
      liens = db.prepare(`PRAGMA foreign_key_list("${name}")`).all();
    } catch {
      continue;
    }
    for (const f of liens) if (f.table === table) db.prepare(`DELETE FROM "${name}" WHERE "${f.from}" = ?`).run(id);
  }
  db.prepare(`DELETE FROM "${table}" WHERE id = ?`).run(id);
}

/**
 * Le scénario, fait une fois : une base vivante, ses lots écrits par le service d'édition (et deux lots notés à la main : une forme ancienne, une
 * référence vers la page que les règles retirent), puis des règles qui changent ces lignes autrement ; la livraison refait la base vivante et met tous
 * les lots en conflit. Chaque test en prend une copie (`copie()`).
 */
const S = {};
before(() => {
  const r0 = `${chemin('regles')}.db`;
  copyFileSync(cheminBase({ sansExemples: false }), r0);
  const r0db = new DatabaseSync(r0);
  r0db.prepare('INSERT INTO mot_cle (id, libelle, libelle_cle, description) VALUES (?, ?, ?, ?)')
    .run(ETIQUETTE.id, ETIQUETTE.libelle, normalize(ETIQUETTE.libelle), 'Mot-clé d’essai des conflits (test/serveur-edition-conflits.test.mjs).');
  r0db.close();
  S.dossier = chemin('scenario');
  const { chemin: vivante } = preparerBaseVivante({ regles: r0, dossier: S.dossier });
  const db = ouvrirBaseVivante(vivante);
  const corps = (id) => db.prepare('SELECT corps_md FROM page WHERE id = ?').get(id).corps_md;
  S.corps = { [MAGIE]: corps(MAGIE), [HYPER]: corps(HYPER), [METIER_GUIDE]: corps(METIER_GUIDE) };
  S.forgeron = { ...db.prepare('SELECT * FROM metier WHERE id = ?').get(FORGERON) };
  S.bonusAvant = db.prepare('SELECT rang, option, texte FROM metier_bonus WHERE metier_id = ? ORDER BY rang, option').all(FORGERON).map((b) => ({ ...b }));
  const lot = (page, operations) => enregistrer(db, { page, operations }).lot;
  // l'aperçu que l'éditeur envoie : un texte HTML par morceau visible du corps (serveur/edition.mjs#apercuDe)
  const apercu = (corpsMd) => decouperCorps(corpsMd).filter((m) => m.visible).map((_m, i) => `<p>aperçu ${i}</p>`);
  const corpsModifie = (id) => ({ op: 'modifier', table: 'page', cle: { id }, valeurs: { corps_md: S.corps[id] + AJOUT }, apercu: apercu(`${S.corps[id] + AJOUT}`) });
  // un lot à deux opérations dont une seule sera en conflit (la page) : la description du forgeron, et sa page dérivée, restent saines
  S.magie = lot(MAGIE, [corpsModifie(MAGIE), { op: 'modifier', table: 'metier', cle: { id: FORGERON }, valeurs: { description: DESCRIPTION_DU_SITE } }]);
  S.hyper = lot(HYPER, [corpsModifie(HYPER)]);
  S.metierGuide = lot(METIER_GUIDE, [corpsModifie(METIER_GUIDE)]);
  // un métier et ses lignes de détail (metier_bonus) : la source et ses dérivées
  S.bonus = lot(FORGERON, [{ op: 'modifier', table: 'metier', cle: { id: FORGERON }, valeurs: { bonus_brut: BONUS_DU_SITE } }]);
  // une référence vers la page que les règles retirent : clé étrangère rompue
  db.exec('BEGIN');
  const w = ouvrirLot(db, { id: '2026-10-21T08:00:00.000Z-000000-essai-alias', instant: '2026-10-21T08:00:00Z', pageId: HYPER });
  w.inserer('alias', { page_id: HYPER, ordre: 900, texte: 'Alias du site de dev (essai des conflits)', cle: 'alias-du-site-de-dev-essai-des-conflits' });
  w.terminer('Alias d’essai');
  db.exec('COMMIT');
  S.alias = '2026-10-21T08:00:00.000Z-000000-essai-alias';
  // une capacité de monstre notée avant la migration 0044 (nom et texte) : une forme ancienne sans équivalent (serveur/edition-bestiaire.mjs)
  const p = db.prepare('SELECT monstre_id, rang FROM monstre_capacite ORDER BY monstre_id, rang LIMIT 1').get();
  S.ancien = '2026-10-21T08:00:01.000Z-000000-essai-ancien';
  db.prepare("INSERT INTO modification_lot (id, fait_le, auteur_id, page_id, resume) VALUES (?, '2026-10-21T08:00:01Z', NULL, 'bestiaire/', 'avant 0044')").run(S.ancien);
  db.prepare(`INSERT INTO modification (lot_id, rang, table_nom, cle, operation, avant, apres, etat) VALUES (?, 1, 'monstre_capacite', ?, 'modifier', ?, ?, 'en_attente')`)
    .run(S.ancien, JSON.stringify({ monstre_id: p.monstre_id, rang: p.rang }), JSON.stringify({ texte: 'vole.' }), JSON.stringify({ texte: 'vole très haut.' }));
  // une suppression sur le site de dev, puis une ligne livrée qui cite la ligne supprimée (une table qui cite : sort_mot_cle)
  S.etiquette = lot('recherche/', [{ op: 'supprimer', entite: 'mot_cle', cle: { id: ETIQUETTE.id } }]);
  // un renommage des deux bords
  S.renommage = lot(ACROBATE, [{ op: 'modifier', table: 'metier', cle: { id: ACROBATE }, valeurs: { nom: NOM_DU_SITE } }]);
  db.close();
  // les règles livrées : deux pages réécrites, une page retirée (avec ce qui la cite), le bonus du forgeron changé
  const r1 = `${chemin('regles')}.db`;
  copyFileSync(r0, r1);
  const regles = new DatabaseSync(r1);
  for (const id of [MAGIE, METIER_GUIDE]) regles.prepare('UPDATE page SET corps_md = ? WHERE id = ?').run(REECRITE(id), id);
  regles.prepare('UPDATE metier SET bonus_brut = ? WHERE id = ?').run(BONUS_DES_REGLES, FORGERON);
  regles.prepare('INSERT INTO sort_mot_cle (sort_id, mot_cle_id) VALUES (?, ?)').run(SORT_ETIQUETE, ETIQUETTE.id);
  regles.prepare('UPDATE metier SET nom = ?, nom_cle = ? WHERE id = ?').run(NOM_DES_REGLES, normalize(NOM_DES_REGLES), ACROBATE);
  regles.prepare('UPDATE page SET titre = ?, titre_cle = ? WHERE id = ?').run(NOM_DES_REGLES, normalize(NOM_DES_REGLES), ACROBATE);
  regles.exec('PRAGMA foreign_keys = OFF');
  supprimerAvecSesReferences(regles, 'page', HYPER);
  assert.deepEqual(regles.prepare('PRAGMA foreign_key_check').all(), [], 'les règles livrées sont saines');
  regles.close();
  S.regles = r1;
  const { rejeu } = preparerBaseVivante({ regles: r1, dossier: S.dossier });
  assert.equal(rejeu.lots, 8);
  assert.equal(rejeu.appliquees, 0, 'tous les lots du scénario sont en conflit');
});

/** Une copie de la base vivante du scénario (et de son dossier) : { dossier, db }. */
function copie() {
  const dossier = chemin('copie');
  cpSync(S.dossier, dossier, { recursive: true });
  const db = ouvrirBaseVivante(join(dossier, FICHIER_BASE));
  ouvertes.push(db);
  return { dossier, db };
}
const diagnostic = (db, lot) => conflitsDuJournal(db).lots.find((l) => l.lot === lot);
const tousLesChoix = (diag, choix, valeur) => Object.fromEntries(diag.conflits.map((c) => [c.id, { choix: c.choix_possibles.includes(choix) ? choix : 2, ...(choix === 3 ? { valeur } : {}) }]));
const lire = (db, sql, ...p) => db.prepare(sql).get(...p);
const bonusDuForgeron = (db) => db.prepare('SELECT rang, option, texte FROM metier_bonus WHERE metier_id = ? ORDER BY rang, option').all(FORGERON).map((b) => ({ ...b }));
const lot = (db, id) => ({ ...lire(db, 'SELECT * FROM modification_lot WHERE id = ?', id) });

test('le journal d’avant la résolution : chaque lot du scénario est en conflit, avec un seul message, et aucun ne part avec la mise à jour', () => {
  const { db } = copie();
  const lots = lotsEnConflit(db).map((l) => l.id);
  assert.deepEqual(lots.sort(), [S.magie, S.hyper, S.metierGuide, S.bonus, S.alias, S.ancien, S.etiquette, S.renommage].sort());
  // un lot en conflit n'est jamais dans le lot figé (journalExporte : en attente et intégrées) ; la note en préparation les compte
  assert.equal(journalExporte(db).lots.length, 0);
  const note = noteEnPreparation(db, { reference: null, versionDev: '0.3.70' });
  assert.equal(note.en_conflit.lots, 8);
});

test('les trois pages du guide réécrites par les règles : version 1 (le site de dev), version 2 (les règles), choix 1, 2 ou 3', () => {
  const { db } = copie();
  for (const [id, page] of [[S.magie, MAGIE], [S.metierGuide, METIER_GUIDE]]) {
    const d = diagnostic(db, id);
    const c = d.conflits.find((x) => x.table === 'page' && x.cle.id === page);
    assert.equal(c.genre, 'champ');
    assert.equal(c.colonne, 'corps_md');
    assert.equal(c.id, `${c.rang}:corps_md`);
    assert.deepEqual(c.version_1, { genre: 'valeur', valeur: S.corps[page] + AJOUT });
    assert.deepEqual(c.version_2, { genre: 'valeur', valeur: REECRITE(page) });
    assert.deepEqual(c.avant, { genre: 'valeur', valeur: S.corps[page] });
    assert.deepEqual(c.choix_possibles, [1, 2, 3]);
    assert.equal(c.saisie.type, 'markdown');
    assert.ok(Array.isArray(c.apercu) && c.apercu.length > 0, 'l’aperçu HTML de la version 1, comme l’éditeur l’a laissé');
    assert.match(d.detail, /les règles ont changé corps_md autrement/);
  }
  // la page du guide que les règles ont retirée (fusionnée puis supprimée) : seul le choix 2, la version 1 reste lisible (et son aperçu)
  const h = diagnostic(db, S.hyper);
  assert.equal(h.conflits.length, 1);
  const [c] = h.conflits;
  assert.equal(c.genre, 'ligne_supprimee');
  assert.equal(c.id, '1');
  assert.deepEqual(c.choix_possibles, [2]);
  assert.match(c.raison, /n’existe plus dans les règles/);
  assert.equal(c.version_1.valeur.corps_md, S.corps[HYPER] + AJOUT);
  assert.deepEqual(c.version_2, { genre: 'absente', valeur: null });
  assert.ok(Array.isArray(c.apercu));
  assert.equal(c.libelle, `Page ${HYPER}`, 'la ligne supprimée, sans nom ni titre : l’id de sa clé, pas du JSON');
  // l'examen n'écrit rien (savepoint annulé)
  assert.equal(lire(db, 'SELECT corps_md FROM page WHERE id = ?', MAGIE).corps_md, REECRITE(MAGIE));
  assert.equal(lire(db, "SELECT count(*) AS n FROM modification WHERE etat = 'en_attente'").n, 0);
  assert.equal(lire(db, 'SELECT count(*) AS n FROM modification_lot').n, 8);
});

test('libellé d’une ligne : son nom ou son titre, sinon l’id de sa clé (ligne supprimée), une clé composée sans id par ce qu’elle désigne, jamais de JSON', () => {
  assert.equal(libelleDeLigne('metier', { nom: 'Forgeron' }, { id: 'metiers/forgeron' }), 'Métier « Forgeron »');
  assert.equal(libelleDeLigne('page', { titre: 'Le jeu de rôle' }, { id: 'guide/le-jeu-de-role' }), 'Page « Le jeu de rôle »');
  // l'essai réel : une page supprimée par les règles, dont la version du site de dev n'a que son corps
  assert.equal(libelleDeLigne('page', { corps_md: 'texte' }, { id: 'guide/le-jeu-de-role' }), 'Page guide/le-jeu-de-role');
  assert.equal(libelleDeLigne('page', null, { id: 'guide/le-jeu-de-role' }), 'Page guide/le-jeu-de-role');
  assert.equal(libelleDeLigne('page', { titre: '' }, { id: 'guide/le-jeu-de-role' }), 'Page guide/le-jeu-de-role');
  // sans la base : les colonnes de la clé par leur nom (lib/libelles-de-la-base.mjs, dans le cours de la phrase), le rang dit « n° N », sans JSON
  assert.equal(libelleDeLigne('metier_bonus', null, { metier_id: 'metiers/forgeron', rang: 1, option: 2 }), 'Bonus du métier métier metiers/forgeron, n° 1, option 2');
  // avec la base : la ligne citée par sa clé étrangère, par son nom quand elle existe (lu dans la base, jamais inventé), sinon par l'id de sa clé
  const { db } = copie();
  const carte = lire(db, 'SELECT m.id, m.nom FROM monstre_capacite c JOIN monstre m ON m.id = c.monstre_id ORDER BY c.monstre_id, c.rang LIMIT 1');
  assert.equal(libelleDeLigne('monstre_capacite', null, { monstre_id: carte.id, rang: 1 }, db), `Capacité de la carte « ${carte.nom} », n° 1`);
  assert.equal(libelleDeLigne('monstre_capacite', null, { monstre_id: 'monstres/absente-essai#carte:absente', rang: 2 }, db),
    'Capacité de la carte (Monstre monstres/absente-essai#carte:absente), n° 2', 'la carte citée n’existe plus : son id');
  const forgeron = lire(db, 'SELECT nom FROM metier WHERE id = ?', FORGERON).nom;
  assert.equal(libelleDeLigne('metier_bonus', null, { metier_id: FORGERON, rang: 1, option: 2 }, db), `Bonus du métier (Métier « ${forgeron} »), n° 1, option 2`,
    'une table hors du modèle : son vrai nom (demande du propriétaire du 2026-10-23), la ligne citée entre parenthèses');
  assert.equal(libelleDeLigne('alias', null, { page_id: HYPER, ordre: 900 }, db), `Autre nom de la page (Page ${HYPER}), ordre 900`, 'la page citée, supprimée par les règles : son id');
  // une clé étrangère composée (monstre_capacite_valeur → monstre_capacite) : la ligne citée dite à son tour
  assert.equal(libelleDeLigne('monstre_capacite_valeur', null, { monstre_id: carte.id, rang: 1, numero: 2 }, db),
    `Valeur d’une capacité (Capacité de la carte « ${carte.nom} », n° 1), numéro de l’emplacement 2`);
  for (const l of conflitsDuJournal(db).lots) for (const x of [...l.conflits, ...l.saines]) assert.doesNotMatch(x.libelle, /[{}]|"/, `${l.lot} : ${x.libelle}`);
});

test('la raison d’un conflit, lisible (raison_lisible) : colonnes et tables par leur libellé, la ligne citée d’une clé rompue, un refus de la base sans nom qualifié ; raison reste la trace', () => {
  const { db } = copie();
  const conflit = (id, table) => diagnostic(db, id).conflits.find((c) => c.table === table);
  assert.equal(conflit(S.magie, 'page').raison, 'les règles ont changé corps_md autrement');
  assert.equal(conflit(S.magie, 'page').raison_lisible, 'les règles ont changé « Texte » autrement');
  assert.equal(conflit(S.bonus, 'metier').raison_lisible, 'les règles ont changé « Bonus » autrement');
  assert.equal(conflit(S.hyper, 'page').raison_lisible, 'la ligne n’existe plus dans les règles', 'une raison sans nom technique : telle quelle');
  assert.equal(conflit(S.alias, 'alias').raison, `alias : clé étrangère rompue vers page (page_id = "${HYPER}")`);
  assert.equal(conflit(S.alias, 'alias').raison_lisible, `Autre nom de la page : clé étrangère rompue vers Page ${HYPER}`);
  assert.equal(conflit(S.ancien, 'monstre_capacite').raison_lisible, conflit(S.ancien, 'monstre_capacite').raison, 'le texte de l’adaptateur : tel quel');
  for (const l of conflitsDuJournal(db).lots) for (const c of l.conflits) assert.doesNotMatch(c.raison_lisible, /corps_md|bonus_brut|page_id|[{}"]/, `${l.lot} ${c.id}`);
  // les formes des raisons (edition-journal.mjs#evaluerUne, #rompuesDuLot ; edition.mjs#messageSqlite), plusieurs jointes par « ; »
  assert.equal(raisonLisible('metier', 'les règles ont changé nom, hors_modele autrement'), 'les règles ont changé « Nom », hors_modele autrement');
  assert.equal(raisonLisible('monstre_capacite_valeur', 'monstre_capacite_valeur : clé étrangère rompue vers monstre_capacite (monstre_id, rang = "monstres/x", 3) ; après le lot : balise inconnue'),
    'Valeur d’une capacité : clé étrangère rompue vers Capacité de la carte (monstre monstres/x, n° 3) ; après le lot : balise inconnue');
  assert.equal(raisonLisible('metier', 'écriture refusée : UNIQUE constraint failed: metier.nom'), 'écriture refusée : valeur déjà utilisée ailleurs (Métier : « Nom »)');
  assert.equal(raisonLisible('sort', 'écriture refusée : NOT NULL constraint failed: sort.nom, sort.hors_modele'), 'écriture refusée : valeur obligatoire (Sort : « Nom », hors_modele)');
  assert.equal(raisonLisible('sort', 'l’édition refuse aujourd’hui cette valeur : valeur refusée par une règle de la base (length(nom) > 0)'),
    'l’édition refuse aujourd’hui cette valeur : valeur refusée par une règle de la base', 'sans l’expression SQL');
  assert.equal(raisonLisible('magie', 'écriture refusée : cannot store TEXT value in INTEGER column magie.sante_offerte'),
    'écriture refusée : valeur d’un type que la colonne refuse (Magie : « Santé offerte » : nombre entier attendu)');
  assert.equal(raisonLisible('metier', 'la ligne existe déjà dans les règles, avec d’autres valeurs'), 'la ligne existe déjà dans les règles, avec d’autres valeurs');
  assert.equal(raisonLisible('metier', null), null);
});

test('une modification saine dont une autre colonne est en conflit : ses colonnes écrites (colonnes) et leurs libellés (colonnes_libelles)', () => {
  const { db } = copie();
  const avant = lire(db, 'SELECT bonus_brut, remarque FROM metier WHERE id = ?', FORGERON);
  // un lot noté sur un bonus qui n'est plus celui des règles (conflit) et une remarque encore telle qu'il l'avait trouvée (saine)
  const id = '2026-10-21T08:00:02.000Z-000000-essai-partiel';
  db.prepare("INSERT INTO modification_lot (id, fait_le, auteur_id, page_id, resume) VALUES (?, '2026-10-21T08:00:02Z', NULL, ?, 'Partiel d’essai')").run(id, FORGERON);
  db.prepare(`INSERT INTO modification (lot_id, rang, table_nom, cle, operation, avant, apres, etat, detail) VALUES (?, 1, 'metier', ?, 'modifier', ?, ?, 'conflit', ?)`).run(
    id, JSON.stringify({ id: FORGERON }), JSON.stringify({ bonus_brut: `${avant.bonus_brut} (autre)`, remarque: avant.remarque }),
    JSON.stringify({ bonus_brut: '+2% Esquive', remarque: 'Remarque du site de dev (essai des conflits).' }), `lot ${id} : metier {"id":"${FORGERON}"} : les règles ont changé bonus_brut autrement`,
  );
  const d = examinerLeLot(db, id);
  assert.deepEqual(d.conflits.map((c) => [c.colonne, c.colonne_libelle, c.raison_lisible]), [['bonus_brut', 'Bonus', 'les règles ont changé « Bonus » autrement']]);
  const saine = d.saines.find((s) => s.table === 'metier');
  assert.deepEqual([saine.issue, saine.colonnes, saine.colonnes_libelles], ['reappliquee', ['remarque'], ['Remarque']]);
  assert.ok(d.saines.filter((s) => !s.colonnes).every((s) => !('colonnes_libelles' in s)), 'sans colonnes, pas de libellés');
});

test('la raison du rejeu d’un lot, lisible (detail_lisible) : la ligne dite comme la légende de son conflit, la colonne par son libellé, sans JSON ni id du lot ; detail reste la trace', () => {
  const { db } = copie();
  const lisible = (id) => diagnostic(db, id).detail_lisible;
  const legende = (id, table) => diagnostic(db, id).conflits.find((c) => c.table === table).libelle;
  assert.equal(lisible(S.bonus), 'Métier « Forgeron » : les règles ont changé « Bonus » autrement');
  assert.equal(lisible(S.bonus), `${legende(S.bonus, 'metier')} : les règles ont changé « Bonus » autrement`);
  assert.equal(lisible(S.magie), `${legende(S.magie, 'page')} : les règles ont changé « Texte » autrement`);
  assert.equal(lisible(S.hyper), `Page ${HYPER} : la ligne n’existe plus dans les règles`);
  assert.equal(lisible(S.alias), 'Autre nom de la page : clé étrangère rompue vers Page', 'une table sans libellé dans le modèle : son nom du registre');
  assert.ok(lisible(S.ancien).startsWith(`${legende(S.ancien, 'monstre_capacite')} : noté avant la migration 0044`));
  for (const l of conflitsDuJournal(db).lots) {
    assert.doesNotMatch(l.detail_lisible, /^lot |\{"id"|corps_md|bonus_brut/, l.lot);
    assert.match(l.detail, new RegExp(`^lot ${l.lot} : `), 'detail : la trace telle quelle');
  }
  // la colonne detail de la base n'a pas changé (trace)
  assert.match(lire(db, 'SELECT detail FROM modification WHERE lot_id = ?', S.bonus).detail, /^lot \S+ : metier \{"id":"metiers\/forgeron"\} : les règles ont changé bonus_brut autrement$/);
  // les formes du rejeu (edition-journal.mjs#rejouerUneFois)
  assert.equal(detailLisible(null), null);
  assert.equal(detailLisible('lot x : après le lot : balise inconnue'), 'après le lot : balise inconnue');
  assert.equal(detailLisible('lot x : metier {"id":"metiers/forgeron"} : écriture refusée : NOT NULL'), 'Métier metiers/forgeron : écriture refusée : NOT NULL', 'sans légende : l’id de la clé');
  assert.equal(detailLisible('lot x : metier {"id":"a} : b"} : les règles ont changé nom, hors_modele autrement'), 'Métier a} : b : les règles ont changé « Nom », hors_modele autrement',
    'une clé qui contient « } : », une colonne sans libellé gardée par son nom');
  assert.equal(detailLisible('lot x : metier {"id":"metiers/forgeron"} : la ligne existe déjà', [{ table: 'metier', cle: { id: 'metiers/forgeron' }, libelle: 'Métier « Forgeron »' }]),
    'Métier « Forgeron » : la ligne existe déjà');
  assert.equal(detailLisible('une forme inconnue'), 'une forme inconnue');
});

test('un lot à deux opérations dont une seule en conflit : la saine est dite telle quelle, et réécrite avec le choix de l’autre', () => {
  const { db } = copie();
  const d = diagnostic(db, S.magie);
  assert.deepEqual(d.conflits.map((c) => c.id), ['1:corps_md']);
  assert.deepEqual(d.saines.map((s) => [s.table, s.issue]), [['metier', 'reappliquee'], ['page', 'derivee']]);
  const r = resoudreLeConflit(db, { lot: S.magie, empreinte: d.empreinte, choix: { '1:corps_md': { choix: 2 } } });
  assert.ok(r.nouveau_lot);
  assert.equal(lire(db, 'SELECT corps_md FROM page WHERE id = ?', MAGIE).corps_md, REECRITE(MAGIE), 'choix 2 : la règle livrée reste');
  assert.equal(lire(db, 'SELECT description FROM metier WHERE id = ?', FORGERON).description, DESCRIPTION_DU_SITE, 'la saine passe');
  assert.match(lire(db, 'SELECT corps_md FROM page WHERE id = ?', FORGERON).corps_md, /écrite sur le site de dev/, 'sa page dérivée suit');
  // le nouveau lot est un lot normal : en attente, dans le journal exporté, avec la page dérivée notée par l'éditeur
  const mods = db.prepare('SELECT table_nom, cle, etat FROM modification WHERE lot_id = ? ORDER BY rang').all(r.nouveau_lot).map((m) => [m.table_nom, JSON.parse(m.cle).id, m.etat]);
  assert.deepEqual(mods, [['metier', FORGERON, 'en_attente'], ['page', FORGERON, 'en_attente']]);
  assert.deepEqual(journalExporte(db).lots.map((l) => l.id), [r.nouveau_lot]);
  assert.match(lot(db, r.nouveau_lot).resume, new RegExp(`^Résolution du conflit du lot ${S.magie}`));
});

test('choix 1 et 3 sur une page du guide : par le chemin de l’éditeur (Markdown sûr, aperçu repris pour le choix 1), l’ancien lot marqué résolu', () => {
  const { db } = copie();
  const d1 = diagnostic(db, S.magie);
  const r1 = resoudreLeConflit(db, { lot: S.magie, empreinte: d1.empreinte, choix: { '1:corps_md': { choix: 1 } } });
  assert.equal(lire(db, 'SELECT corps_md FROM page WHERE id = ?', MAGIE).corps_md, S.corps[MAGIE] + AJOUT);
  const m = lire(db, "SELECT avant, apres, apercu FROM modification WHERE lot_id = ? AND table_nom = 'page' AND json_extract(cle, '$.id') = ?", r1.nouveau_lot, MAGIE);
  assert.deepEqual(JSON.parse(m.avant), { corps_md: REECRITE(MAGIE) }, 'l’avant du nouveau lot : la base vivante (il se rejoue sans conflit sur les règles)');
  assert.ok(JSON.parse(m.apercu).length > 0, 'l’aperçu du choix 1 est repris');
  const ancien = lot(db, S.magie);
  assert.equal(ancien.resolu_par, r1.nouveau_lot);
  assert.match(ancien.resolu_le, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/);
  assert.deepEqual(JSON.parse(ancien.resolution), [{ rang: 1, colonne: 'corps_md', choix: 1 }]);
  // la trace : les lignes de l'ancien lot restent « conflit », avec leur detail
  assert.equal(lire(db, "SELECT count(*) AS n FROM modification WHERE lot_id = ? AND etat = 'conflit' AND detail IS NOT NULL", S.magie).n, 3);
  // un second appel ne rejoue rien
  assert.throws(() => resoudreLeConflit(db, { lot: S.magie, empreinte: d1.empreinte, choix: { '1:corps_md': { choix: 1 } } }), (e) => e.statut === 409 && /déjà résolu/.test(e.message));
  assert.ok(!conflitsDuJournal(db).lots.some((l) => l.lot === S.magie));
  assert.ok(conflitsDuJournal(db).resolus.some((l) => l.lot === S.magie && l.resolu_par === r1.nouveau_lot));

  const d3 = diagnostic(db, S.metierGuide);
  const saisi = 'Texte saisi à la main pour remplacer les deux (essai des conflits).\n';
  // la saisie suit les contrôles de l'éditeur : du HTML brut ajouté est refusé (Markdown sûr), rien n'est écrit
  assert.throws(() => resoudreLeConflit(db, { lot: S.metierGuide, empreinte: d3.empreinte, choix: { [d3.conflits[0].id]: { choix: 3, valeur: '<script>alert(1)</script>' } } }),
    (e) => e.statut === 400);
  assert.equal(lot(db, S.metierGuide).resolu_le, null);
  const r3 = resoudreLeConflit(db, { lot: S.metierGuide, empreinte: d3.empreinte, choix: { [d3.conflits[0].id]: { choix: 3, valeur: saisi } } });
  assert.equal(lire(db, 'SELECT corps_md FROM page WHERE id = ?', METIER_GUIDE).corps_md, saisi);
  assert.equal(lire(db, "SELECT apercu FROM modification WHERE lot_id = ? AND table_nom = 'page'", r3.nouveau_lot).apercu, null, 'un texte saisi n’a pas d’aperçu');
});

test('la page retirée par les règles : seul le choix 2, un lot vide (rien d’écrit, resolu_par NULL), la trace gardée', () => {
  const { db } = copie();
  const d = diagnostic(db, S.hyper);
  assert.throws(() => resoudreLeConflit(db, { lot: S.hyper, empreinte: d.empreinte, choix: { 1: { choix: 1 } } }), (e) => e.statut === 400 && /impossible/.test(e.message));
  const lots = lire(db, 'SELECT count(*) AS n FROM modification_lot').n;
  const r = resoudreLeConflit(db, { lot: S.hyper, empreinte: d.empreinte, choix: { 1: { choix: 2 } } });
  assert.equal(r.nouveau_lot, null);
  assert.equal(r.modifications, 0);
  assert.equal(lire(db, 'SELECT count(*) AS n FROM modification_lot').n, lots, 'pas de lot vide laissé dans le journal');
  const ancien = lot(db, S.hyper);
  assert.equal(ancien.resolu_par, null);
  assert.ok(ancien.resolu_le);
  assert.equal(lire(db, 'SELECT count(*) AS n FROM page WHERE id = ?', HYPER).n, 0);
});

test('un métier et ses lignes de détail : au choix 1, 2 ou 3 sur le bonus, metier_bonus et la page du métier suivent la valeur gardée', () => {
  const valeurs = { 1: BONUS_DU_SITE, 2: BONUS_DES_REGLES, 3: '+4% Esquive' };
  const textes = { 1: ['+3% Esquive'], 2: ['+5% Parade'], 3: ['+4% Esquive'] };
  for (const choix of [1, 2, 3]) {
    const { db } = copie();
    const d = diagnostic(db, S.bonus);
    const c = d.conflits.find((x) => x.colonne === 'bonus_brut');
    assert.deepEqual([c.genre, c.version_1.valeur, c.version_2.valeur], ['champ', BONUS_DU_SITE, BONUS_DES_REGLES]);
    assert.deepEqual(d.conflits.map((x) => x.id), [c.id], 'les lignes de détail ne sont pas des conflits à elles : elles suivent leur source');
    assert.ok(d.saines.some((s) => s.table === 'metier_bonus'));
    const r = resoudreLeConflit(db, { lot: S.bonus, empreinte: d.empreinte, choix: { [c.id]: { choix, ...(choix === 3 ? { valeur: valeurs[3] } : {}) } } });
    assert.equal(lire(db, 'SELECT bonus_brut FROM metier WHERE id = ?', FORGERON).bonus_brut, valeurs[choix], `choix ${choix}`);
    assert.deepEqual(bonusDuForgeron(db).map((b) => b.texte), textes[choix], `choix ${choix} : les lignes de détail suivent la source`);
    assert.match(lire(db, 'SELECT corps_md FROM page WHERE id = ?', FORGERON).corps_md, new RegExp(valeurs[choix].replace(/[+%]/g, (x) => `\\${x}`)), `choix ${choix} : la page suit`);
    assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
    assert.ok(r.nouveau_lot);
  }
});

test('une clé étrangère rompue et une forme ancienne sans équivalent : la raison, et seul le choix 2 (abandonner l’opération)', () => {
  const { db } = copie();
  const a = diagnostic(db, S.alias);
  assert.equal(a.conflits.length, 1);
  assert.equal(a.conflits[0].genre, 'sans_valeur');
  assert.match(a.conflits[0].raison, /alias : clé étrangère rompue vers page/);
  assert.deepEqual(a.conflits[0].choix_possibles, [2]);
  assert.equal(a.conflits[0].version_1.genre, 'ligne');
  const o = diagnostic(db, S.ancien);
  assert.equal(o.conflits[0].genre, 'sans_valeur');
  assert.match(o.conflits[0].raison, /noté avant la migration 0044/);
  assert.deepEqual(o.conflits[0].choix_possibles, [2]);
  const r = resoudreLeConflit(db, { lot: S.alias, empreinte: a.empreinte, choix: tousLesChoix(a, 2) });
  assert.equal(r.nouveau_lot, null);
  assert.equal(lire(db, 'SELECT count(*) AS n FROM alias WHERE page_id = ?', HYPER).n, 0);
  resoudreLeConflit(db, { lot: S.ancien, empreinte: o.empreinte, choix: tousLesChoix(o, 2) });
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
});

test('refus : lot inconnu (404), empreinte changée (409, avec le diagnostic à jour), choix manquant ou inconnu (400)', () => {
  const { db } = copie();
  const d = diagnostic(db, S.magie);
  assert.throws(() => resoudreLeConflit(db, { lot: 'lot-inconnu-essai', empreinte: 'x', choix: {} }), (e) => e.statut === 404);
  assert.throws(() => resoudreLeConflit(db, { lot: S.magie, empreinte: 'perimee', choix: tousLesChoix(d, 1) }), (e) => e.statut === 409 && e.details.lot.empreinte === d.empreinte);
  assert.throws(() => resoudreLeConflit(db, { lot: S.magie, empreinte: d.empreinte, choix: {} }), (e) => e.statut === 400 && /choisissez/.test(e.message));
  assert.throws(() => resoudreLeConflit(db, { lot: S.magie, empreinte: d.empreinte, choix: { ...tousLesChoix(d, 1), 99: { choix: 1 } } }), (e) => e.statut === 400 && /inconnu/.test(e.message));
  assert.throws(() => resoudreLeConflit(db, { lot: S.magie, empreinte: d.empreinte, choix: { '1:corps_md': { choix: 3 } } }), (e) => e.statut === 400 && /valeur saisie manque/.test(e.message));
  // les règles bougent entre l'affichage et le choix : l'empreinte change, rien n'est écrit
  db.prepare('UPDATE page SET corps_md = ? WHERE id = ?').run('Encore changée (essai des conflits).\n', MAGIE);
  assert.throws(() => resoudreLeConflit(db, { lot: S.magie, empreinte: d.empreinte, choix: tousLesChoix(d, 1) }), (e) => e.statut === 409);
  assert.equal(lot(db, S.magie).resolu_le, null);
  assert.equal(examinerLeLot(db, S.magie).conflits[0].version_2.valeur, 'Encore changée (essai des conflits).\n');
});

test('les lots de résolution se rejouent sans conflit à la livraison suivante ; les lots résolus ne sont plus comptés', () => {
  const { dossier, db } = copie();
  for (const id of [S.magie, S.metierGuide, S.bonus]) {
    const d = diagnostic(db, id);
    resoudreLeConflit(db, { lot: id, empreinte: d.empreinte, choix: tousLesChoix(d, 1) });
  }
  // /api/etat et la note en préparation ne comptent plus les lots résolus (leurs lignes « conflit » sont des traces)
  assert.equal(compterLesConflits(db).lots, 5);
  db.close();
  const r2 = `${chemin('regles')}.db`;
  copyFileSync(S.regles, r2);
  const regles = new DatabaseSync(r2);
  regles.prepare("UPDATE metier SET remarque = 'Livraison suivante (essai des conflits).' WHERE id <> ? AND id = (SELECT min(id) FROM metier WHERE id <> ?)").run(FORGERON, FORGERON);
  regles.close();
  const { rejeu } = preparerBaseVivante({ regles: r2, dossier });
  assert.equal(rejeu.conflits, 0, 'aucun conflit nouveau : seules les traces (et les lots pas encore résolus) restent « conflit »');
  assert.ok(rejeu.appliquees > 0);
  const vivante = ouvrirBaseVivante(join(dossier, FICHIER_BASE));
  ouvertes.push(vivante);
  assert.equal(lire(vivante, "SELECT count(*) AS n FROM modification WHERE etat = 'en_attente'").n > 0, true);
  assert.equal(lire(vivante, 'SELECT corps_md FROM page WHERE id = ?', MAGIE).corps_md, S.corps[MAGIE] + AJOUT);
  assert.equal(lire(vivante, 'SELECT bonus_brut FROM metier WHERE id = ?', FORGERON).bonus_brut, BONUS_DU_SITE);
  assert.deepEqual(lotsEnConflit(vivante).map((l) => l.id).sort(), [S.hyper, S.alias, S.ancien, S.etiquette, S.renommage].sort());
});

// « Effectuer la mise à jour », majeure ou non (case « Version majeure », migration 0070) : un lot en conflit à résoudre ne part jamais dans le lot figé
// (journalExporte : en attente et intégrées seulement) et ne bloque rien ; le lot qui résout un conflit, lui, part comme tout lot de l'édition.
test('mise à jour majeure ou non : les lots en conflit à résoudre restent hors du lot figé, le lot de résolution y part comme un lot normal', () => {
  for (const majeure of [false, true]) {
    const { dossier, db } = copie();
    const d = diagnostic(db, S.magie);
    const r = resoudreLeConflit(db, { lot: S.magie, empreinte: d.empreinte, choix: tousLesChoix(d, 1) });
    assert.ok(r.nouveau_lot);
    enregistrerMajeure(db, { majeure });
    const note = noteEnPreparation(db, { reference: null, versionDev: '0.3.70' });
    assert.equal(note.version_cible, majeure ? note.version_majeure : note.version_mineure);
    assert.deepEqual(note.en_conflit, compterLesConflits(db));
    assert.equal(note.en_conflit.lots, 7, 'les sept lots pas encore résolus restent comptés, sans rien bloquer');
    const lancement = figerLot(db, dossier, {
      versionDev: '0.3.70', versionCible: note.version_cible, instant: '2026-10-22T20:00:00Z', confirmation: CONFIRMATION, adresse: 'https://dev.example', aLivrer: null,
    });
    assert.equal(lancement.majeure, majeure);
    const fige = JSON.parse(lireLot(dossier, lancement.lot));
    assert.equal(fige.majeure, majeure);
    assert.equal(fige.version_cible, note.version_cible);
    assert.deepEqual(fige.journal.lots.map((l) => l.id), [r.nouveau_lot], 'seul le lot de résolution part ; ni le lot résolu (sa trace) ni les lots à résoudre');
    assert.equal(lancement.modifications, r.modifications);
    assert.ok(fige.journal.lots[0].modifications.every((m) => m.etat === 'en_attente'));
  }
});

// Le compte des conflits à résoudre est écrit une seule fois (edition-conflits.mjs#compterLesConflits) : la note en préparation et /api/etat le lisent
// tous deux, ils ne peuvent pas se contredire si la règle « à résoudre » change (relecture du 2026-10-22 : notes-de-version.mjs en avait une copie).
test('compte des conflits : la note en préparation et /api/etat lisent le même compte, écrit une seule fois dans le service', () => {
  const { db } = copie();
  const note = () => noteEnPreparation(db, { reference: null, versionDev: '0.3.70' }).en_conflit;
  assert.deepEqual(note(), compterLesConflits(db));
  assert.equal(note().lots, 8);
  const d = diagnostic(db, S.magie);
  resoudreLeConflit(db, { lot: S.magie, empreinte: d.empreinte, choix: tousLesChoix(d, 2) });
  assert.deepEqual(note(), compterLesConflits(db), 'après une résolution : le même compte des deux côtés');
  assert.equal(note().lots, 7);
  // une seule requête du compte dans le service, et la note l'importe
  const dossier = new URL('../serveur/', import.meta.url);
  const avecLeCompte = readdirSync(dossier).filter((f) => f.endsWith('.mjs') && /count\(DISTINCT m\.lot_id\)/.test(readFileSync(new URL(f, dossier), 'utf8')));
  assert.deepEqual(avecLeCompte, ['edition-conflits.mjs']);
  assert.match(readFileSync(new URL('notes-de-version.mjs', dossier), 'utf8'), /import \{ compterLesConflits \} from '\.\/edition-conflits\.mjs'/);
});

test('routes : GET et POST /api/mise-a-jour/conflits/ sur le site de dev seulement, une route des métriques, un lot de l’édition noté', () => {
  const { db } = copie();
  const journal = [];
  const evenements = [];
  const service = { base: () => db, etat: () => ({}), edition: true, journal: (m) => journal.push(m), evenement: (type, o) => evenements.push({ type, ...o }) };
  assert.equal(traiter({ methode: 'GET', chemin: '/api/mise-a-jour/conflits/', entetes: {} }, { ...service, edition: false }).statut, 403);
  assert.equal(traiter({ methode: 'DELETE', chemin: '/api/mise-a-jour/conflits/', entetes: {} }, service).statut, 405);
  const g = traiter({ methode: 'GET', chemin: '/api/mise-a-jour/conflits/', entetes: {} }, service);
  assert.equal(g.statut, 200);
  assert.equal(g.corps.lots.length, 8);
  const d = g.corps.lots.find((l) => l.lot === S.magie);
  const post = (corps, entetes = { 'content-type': 'application/json' }) => traiter({ methode: 'POST', chemin: '/api/mise-a-jour/conflits/', entetes, corps: JSON.stringify(corps) }, service);
  assert.equal(post({ lot: S.magie }, {}).statut, 415);
  assert.equal(post({ lot: S.magie }, { 'content-type': 'application/json', 'sec-fetch-site': 'cross-site' }).statut, 403);
  assert.equal(post({ lot: S.magie, empreinte: 'perimee', choix: tousLesChoix(d, 1) }).statut, 409);
  const r = post({ lot: S.magie, empreinte: d.empreinte, choix: tousLesChoix(d, 1) });
  assert.equal(r.statut, 200, JSON.stringify(r.corps));
  assert.deepEqual(Object.keys(r.corps).sort(), ['fiches', 'lignes', 'lot', 'modifications', 'nouveau_lot', 'resolution']);
  assert.equal(post({ lot: S.magie, empreinte: d.empreinte, choix: tousLesChoix(d, 1) }).statut, 409);
  assert.match(journal.at(-1), /conflit du lot .* résolu par le lot/);
  assert.deepEqual(evenements.map((e) => [e.type, e.detail.resout]), [['lot_edition', S.magie]]);
  assert.equal(routeNormalisee('/api/mise-a-jour/conflits/'), '/api/mise-a-jour/conflits/');
  assert.equal(routeNormalisee('/api/mise-a-jour/conflits/x/'), '/api/{inconnue}');
});

// Un vrai nom pour chaque table et chaque colonne de la section (demande du propriétaire du 2026-10-23 : « Un vrai nom serai mieux », après « metier_bonus »
// et « alias » sous leur nom technique) : le service les tire du registre (lib/libelles-de-la-base.mjs, prouvé complet contre le schéma et le code de
// l'édition par test/libelles-de-la-base.test.mjs) ; une version faite d'une ligne nomme chacune de ses colonnes et ne montre ni clé normalisée
// (X_cle, alias.cle) ni provenance (origine, source_ref).
test('les noms du diagnostic : chaque table et chaque colonne par son vrai nom, aucune colonne masquée dans une version, aucun nom technique', () => {
  const { db } = copie();
  for (const { table_nom: t } of db.prepare('SELECT DISTINCT table_nom FROM modification').all()) assert.ok(nomDeTable(t), `${t} : une table du journal sans nom`);
  const memoire = new DatabaseSync(':memory:');
  memoire.exec(readFileSync(new URL('../../data/schema.sql', import.meta.url), 'utf8'));
  const tables = memoire.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all().map((r) => r.name);
  const noms = new Set([...tables, ...tables.flatMap((t) => memoire.prepare(`PRAGMA table_info("${t}")`).all().map((c) => c.name))].filter((n) => n.includes('_')));
  memoire.close();
  const techniques = (texte) => (String(texte ?? '').match(/[a-z0-9]+(?:_[a-z0-9]+)+/g) ?? []).filter((m) => noms.has(m));
  const { lots } = conflitsDuJournal(db);
  const versions = lots.flatMap((l) => l.conflits.flatMap((c) => [c.version_1, c.version_2].map((v) => [l, c, v]))).filter(([, , v]) => v?.valeur && v.genre !== 'valeur');
  assert.ok(versions.some(([, c]) => c.table === 'alias'), 'la ligne entière d’un autre nom de page, dans le scénario');
  for (const [l, c, v] of versions) {
    assert.deepEqual(Object.keys(v.libelles).sort(), Object.keys(v.valeur).sort(), `${l.lot} ${c.id} : chaque colonne de la version a son nom`);
    for (const [col, nom] of Object.entries(v.libelles)) {
      assert.equal(nom, nomDeColonne(c.table, col), `${c.table}.${col}`);
      assert.ok(!colonneMasquee(c.table, col), `${c.table}.${col} : une colonne masquée ne s'affiche pas`);
    }
  }
  const alias = lots.find((l) => l.lot === S.alias).conflits[0].version_1;
  assert.deepEqual(alias.libelles, { page_id: 'Page', ordre: 'Ordre', texte: 'Autre nom' }, 'ni sa clé normalisée (cle) ni sa provenance');
  for (const l of lots) {
    const textes = [l.detail_lisible, ...l.saines.flatMap((s) => [s.libelle, ...(s.colonnes_libelles ?? [])]),
      ...l.conflits.flatMap((c) => [c.libelle, c.colonne_libelle, c.raison_lisible, ...[c.version_1, c.version_2].flatMap((v) => Object.values(v?.libelles ?? {}))])];
    for (const t of textes) assert.deepEqual([...techniques(t), ...tablesDans(t)], [], `${l.lot} : « ${t} »`);
    for (const x of [...l.saines, ...l.conflits]) assert.ok(x.libelle.startsWith(nomDeTable(x.table)), `${l.lot} : « ${x.libelle} » commence par le nom de sa table`);
  }
  assert.ok(lots.some((l) => l.saines.some((s) => s.libelle.startsWith('Bonus du métier ('))), 'metier_bonus : « Bonus du métier »');
});

// Les deux cas les plus probables d'une section sous des noms techniques (relecture du 2026-10-23) : une suppression faite sur le site de dev, puis une
// ligne livrée qui la cite (la raison nomme la table QUI CITE, hors de TABLES : « sort_mot_cle ») ; un renommage des deux bords (le rejeu compare aussi
// la clé normalisée nom_cle : « les règles ont changé nom, nom_cle autrement »).
/**
 * Les noms de tables du schéma (data/schema.sql) dits comme un mot d'un texte, mots sans « _ » compris (« invocation », « lien », « page ») : comparés à
 * la liste exacte des tables, après avoir retiré du texte les vrais noms du registre (« Étiquette du sort », « Autre nom de la page » : un mot du
 * français n'est pas un nom technique) ; une valeur (entre guillemets : le nom d'une ligne ; un id : « / », « - », « # ») n'en est pas un.
 */
const { TABLES_DU_SCHEMA, NOMS_AFFICHES } = (() => {
  const m = new DatabaseSync(':memory:');
  m.exec(readFileSync(new URL('../../data/schema.sql', import.meta.url), 'utf8'));
  const t = m.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all().map((r) => r.name);
  const noms = new Set(t.flatMap((x) => [nomDeTable(x), ...m.prepare(`PRAGMA table_info("${x}")`).all().map((c) => nomDeColonne(x, c.name))]).filter(Boolean));
  m.close();
  return { TABLES_DU_SCHEMA: new Set(t), NOMS_AFFICHES: [...noms].sort((a, b) => b.length - a.length) };
})();
const tablesDans = (texte) => NOMS_AFFICHES.reduce((x, n) => x.split(n).join(' '), String(texte ?? '')).replace(/«[^«»]*»/g, ' ')
  .split(/[\s,;()«»"]+/).map((m) => m.replace(/[:.]+$/, '')).filter((m) => TABLES_DU_SCHEMA.has(m));

test('une rupture « enfant » : le mot-clé supprimé sur le site de dev, que les règles livrées posent sur un sort, dit par le nom de la table qui le cite', () => {
  const { db } = copie();
  const d = diagnostic(db, S.etiquette);
  assert.equal(d.conflits.length, 1);
  const [c] = d.conflits;
  assert.deepEqual([c.table, c.operation, c.genre, c.choix_possibles], ['mot_cle', 'supprimer', 'sans_valeur', [2]]);
  assert.equal(c.raison, `sort_mot_cle : clé étrangère rompue vers mot_cle (mot_cle_id = "${ETIQUETTE.id}")`, 'la trace');
  assert.equal(c.raison_lisible, `Étiquette du sort : clé étrangère rompue vers Mot-clé ${ETIQUETTE.id}`);
  assert.equal(c.libelle, `Mot-clé « ${ETIQUETTE.libelle} »`);
  assert.match(d.detail, /: sort_mot_cle : clé étrangère rompue vers mot_cle$/, 'la trace du rejeu');
  assert.equal(d.detail_lisible, 'Étiquette du sort : clé étrangère rompue vers Mot-clé');
  // aucun nom de table du schéma, mots sans « _ » compris (comparés à la liste exacte des tables)
  for (const t of [c.libelle, c.raison_lisible, d.detail_lisible]) assert.deepEqual(tablesDans(t), [], `« ${t} »`);
  assert.deepEqual(tablesDans(c.raison), ['sort_mot_cle', 'mot_cle'], 'la garde voit les noms techniques');
  assert.deepEqual(tablesDans('Invocation : clé étrangère rompue vers page'), ['page'], 'un nom d’un seul mot, vu');
  // le choix 2 : la suppression est abandonnée, l'étiquette livrée garde son mot-clé
  const r = resoudreLeConflit(db, { lot: S.etiquette, empreinte: d.empreinte, choix: tousLesChoix(d, 2) });
  assert.equal(r.nouveau_lot, null);
  assert.equal(lire(db, 'SELECT count(*) AS n FROM sort_mot_cle WHERE mot_cle_id = ?', ETIQUETTE.id).n, 1);
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
});

test('un renommage des deux bords : la clé normalisée (nom_cle), comparée par le rejeu, n’est jamais dite ; la colonne par son nom (« Nom »)', () => {
  const { db } = copie();
  const d = diagnostic(db, S.renommage);
  const c = d.conflits.find((x) => x.table === 'metier');
  assert.deepEqual([c.colonne, c.colonne_libelle, c.version_1.valeur, c.version_2.valeur], ['nom', 'Nom', NOM_DU_SITE, NOM_DES_REGLES]);
  assert.deepEqual(d.conflits.filter((x) => x.table === 'metier').map((x) => x.colonne), ['nom'], 'nom_cle suit nom : pas un conflit à elle');
  assert.equal(c.raison_lisible, 'les règles ont changé « Nom » autrement');
  assert.match(d.detail, /metier \{"id":"metiers\/acrobate"\} : les règles ont changé nom, nom_cle autrement$/, 'la trace du rejeu garde nom_cle');
  assert.equal(d.detail_lisible, `Métier « ${NOM_DES_REGLES} » : les règles ont changé « Nom » autrement`);
  // les formes : une clé normalisée dite par sa colonne source, la provenance jamais, sans laisser une liste vide
  assert.equal(detailLisible('lot x : metier {"id":"metiers/forgeron"} : les règles ont changé nom, nom_cle autrement'), 'Métier metiers/forgeron : les règles ont changé « Nom » autrement');
  assert.equal(raisonLisible('metier', 'les règles ont changé nom_cle autrement'), 'les règles ont changé « Nom » autrement');
  assert.equal(raisonLisible('page', 'les règles ont changé titre_cle, corps_md autrement'), 'les règles ont changé « Titre », « Texte » autrement');
  assert.equal(raisonLisible('alias', 'les règles ont changé texte, cle autrement'), 'les règles ont changé « Autre nom » autrement');
  assert.equal(raisonLisible('metier', 'les règles ont changé source_ref autrement'), 'les règles ont changé cette ligne autrement');
  assert.equal(raisonLisible('metier', 'écriture refusée : UNIQUE constraint failed: metier.nom_cle'), 'écriture refusée : valeur déjà utilisée ailleurs (Métier : « Nom »)');
  for (const t of [c.libelle, c.raison_lisible, d.detail_lisible, ...d.saines.flatMap((x) => [x.libelle, ...(x.colonnes_libelles ?? [])])]) assert.doesNotMatch(t, /nom_cle|titre_cle/, t);
});

/** La fixture du rendu (test/fixtures/conflits-diagnostic.json, lue par conflits-rendu et mise-a-jour-conflits) : le diagnostic, ses longs textes raccourcis. */
const FIXTURE = new URL('./fixtures/conflits-diagnostic.json', import.meta.url);
const raccourcir = (v) => {
  if (typeof v === 'string') return v.length > 463 ? `${v.slice(0, 300)}\n…\n${v.slice(-160)}` : v;
  if (Array.isArray(v)) return v.map(raccourcir);
  return v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, raccourcir(x)])) : v;
};
/** Ce que la page lit d'un lot sans en être l'essai lui-même (les ids des lots et leurs dates changent d'un scénario à l'autre). */
const lisibles = (l) => ({
  resume: l.resume, detail_lisible: l.detail_lisible,
  saines: l.saines.map((s) => [s.table, s.operation, s.libelle, s.issue, s.colonnes ?? null, s.colonnes_libelles ?? null]),
  conflits: l.conflits.map((c) => [c.id, c.genre, c.libelle, c.colonne_libelle, c.raison_lisible, c.choix_possibles, c.version_1?.libelles ?? null, c.version_2?.libelles ?? null]),
});

test('la fixture du rendu est le diagnostic du service sur ce scénario, jamais écrite à la main (MAVERICK_ECRIRE_FIXTURE=1 la recalcule)', () => {
  const { db } = copie();
  const diag = raccourcir(conflitsDuJournal(db));
  if (process.env.MAVERICK_ECRIRE_FIXTURE === '1') writeFileSync(FIXTURE, `${JSON.stringify(diag, null, 1)}\n`);
  const fixture = JSON.parse(readFileSync(FIXTURE, 'utf8'));
  const parResume = (d) => Object.fromEntries(d.lots.map((l) => [l.resume, lisibles(l)]));
  assert.deepEqual(parResume(fixture), parResume(diag), 'relancer avec MAVERICK_ECRIRE_FIXTURE=1 node --test test/serveur-edition-conflits.test.mjs');
  assert.deepEqual(fixture.lots.map((l) => Object.keys(l)), diag.lots.map((l) => Object.keys(l)), 'la forme de chaque lot');
});
