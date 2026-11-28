// Les lots de changements depuis le retrait des colonnes du mot-clé (chantier 4 des mots-clés, migration 0136 : docs/chantier-retrait-des-colonnes.md) :
// `mot_cle` n'a plus `libelle`, `url`, `description`, `couleur`, `icone` ; ces valeurs se lisent et s'écrivent sur l'élément du mot-clé (sa page, sinon
// son sort, sinon son repère). Le format « maverick-lot/1 » garde ces colonnes LOGIQUES (lib/lot-de-changements.mjs#COLONNES_LOGIQUES_DU_MOT_CLE) :
//   - un lot qui crée un mot-clé nu crée son repère ; un lot qui modifie un champ du mot-clé l'écrit sur son élément, sort compris (R309 (17)) ;
//   - le nom et l'adresse d'un mot-clé ancré suivent son élément : un lot ne les écrit pas ;
//   - une page de notion reprend le repère de son mot-clé, et l'annulation le lui rend ;
//   - une ligne du journal d'avant la migration (colonnes retirées notées sur `mot_cle`) s'annule seule (R291) : ses champs se remettent sur l'élément
//     d'aujourd'hui, comparés sur lui ; ce que l'élément ne reçoit pas n'a rien à remettre, sans refus ; un mot-clé créé par un lot ancien se supprime avec
//     le repère que la migration lui a posé ;
//   - l'écart avec la production compare l'objet du mot-clé des deux côtés, même quand la production a encore l'ancienne structure.
// Les noms et les textes sont ceux du test (absents de la base) ; aucune valeur de règle n'est lue.
//   node --test test/serveur-edition-lots-sans-colonnes.test.mjs
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { ouvrirBaseVivante, preparerBaseVivante } from '../serveur/base-vivante.mjs';
import { ErreurEdition } from '../serveur/edition.mjs';
import { annuler, annulerUneLigne, appliquer, deposer, lire, lister, traduire } from '../serveur/edition-lots.mjs';
import { lireUnMotCle } from '../src/lib/mots-cles-db.mjs';
import { COLONNES_LOGIQUES_DU_MOT_CLE, neResteRienARemettre, sansLesColonnesRetirees } from '../src/lib/lot-de-changements.mjs';
import { reperesAPoser } from '../src/lib/lot-des-reperes.mjs';
import { ancrerUnMotCle } from './aide-ancrage.mjs';
import { cheminDImport } from './aide-base-d-import.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';
import { poserUnMotCle } from './aide-mots-cles.mjs';

const racine = dossierTemporaire('lots-sans-colonnes');
let n = 0;
function nouvelle() {
  const db = ouvrirBaseVivante(preparerBaseVivante({ regles: cheminDImport(), dossier: join(racine, `b${(n += 1)}`) }).chemin);
  return { db, dossier: join(racine, `essais${n}`) };
}
const lot = (operations) => ({ format: 'maverick-lot/1', titre: `Sans colonnes ${(n += 1)}`, nature: 'code', operations });
const nom = (suffixe) => `Zephyr sans colonnes ${suffixe} ${process.pid}`;
const cleDe = (texte) => texte.toLowerCase().replace(/ /g, '-');
const creation = (jeton, apres) => ({ table: 'mot_cle', cle: { id: { $numero: jeton } }, operation: 'inserer', apres: { id: { $numero: jeton }, ...apres } });
const changer = (id, avant, apres) => ({ table: 'mot_cle', cle: { id }, operation: 'modifier', avant, apres });
const repere = (db, id) => db.prepare('SELECT nom, adresse, definition, couleur, icone FROM repere WHERE mot_cle_id = ?').get(id) ?? null;
const sansPrototype = (l) => (l ? { ...l } : l);

async function deposeEtApplique(m, operations, corps = {}) {
  const p = await deposer(() => m.db, lot(operations), { enArrierePlan: false, dossier: m.dossier });
  const essai = lire(m.db, p.id).essai;
  assert.ok(['applicable', 'verrous'].includes(p.verdict), JSON.stringify(essai.operations));
  return { id: p.id, fait: appliquer(m.db, p.id, corps) };
}
async function essaye(m, operations) {
  const p = await deposer(() => m.db, lot(operations), { enArrierePlan: false, dossier: m.dossier });
  return { verdict: p.verdict, essai: lire(m.db, p.id).essai };
}
/** Le premier mot-clé de la base qui n'a qu'un repère (un mot-clé du lore sans page ni sort). */
const unMotCleARepere = (db) => db.prepare('SELECT mot_cle_id AS id FROM repere ORDER BY mot_cle_id LIMIT 1').get().id;
/** Les lignes du journal du lot `lotId`, pour les réécrire comme un lot d'avant la migration 0136. */
const journal = (db, lotId) => db.prepare('SELECT rang, table_nom, cle, operation, avant, apres FROM modification WHERE lot_id = ? ORDER BY rang').all(lotId);
function reecrire(db, lotId, rang, { table_nom, cle, avant, apres }) {
  db.prepare('UPDATE modification SET table_nom = ?, cle = ?, avant = ?, apres = ? WHERE lot_id = ? AND rang = ?')
    .run(table_nom, JSON.stringify(cle), avant === null ? null : JSON.stringify(avant), apres === null ? null : JSON.stringify(apres), lotId, rang);
}

test('format : les colonnes logiques écartées d’une ligne nette ancienne ; une ligne qui n’écrivait qu’elles n’a plus rien à remettre', () => {
  const nets = [
    { rang: 1, table: 'mot_cle', cle: { id: 4 }, genre: 'modifier', origine: { description: 'a', cle: 'x' }, fin: { description: 'b', cle: 'y' } },
    { rang: 2, table: 'mot_cle', cle: { id: 5 }, genre: 'modifier', origine: { libelle: 'A', verrou: 0 }, fin: { libelle: 'B', verrou: 1 } },
    { rang: 3, table: 'metier', cle: { id: 'm' }, genre: 'modifier', origine: { description: 'a' }, fin: { description: 'b' } },
  ];
  const [seules, melee, autre] = sansLesColonnesRetirees(nets, COLONNES_LOGIQUES_DU_MOT_CLE);
  assert.deepEqual(seules.retirees, ['description']);
  assert.deepEqual(seules.fin, { cle: 'y' });
  assert.deepEqual(seules.brut.origine, { description: 'a', cle: 'x' }, 'le journal tel quel reste lisible');
  assert.equal(neResteRienARemettre(seules), true);
  assert.deepEqual(melee.fin, { verrou: 1 });
  assert.equal(neResteRienARemettre(melee), false, 'le verrou reste à remettre');
  assert.equal(autre, nets[2], 'une autre table n’est pas touchée');
  assert.equal(sansLesColonnesRetirees(nets, []), nets, 'une base d’avant la migration garde tout');
});

test('traduire : une création ancrée réduite à son identifiant ne vérifie que lui ; un nom donné est passé et vérifié', () => {
  const ancre = { table: 'mot_cle', cle: { id: 7 }, operation: 'inserer', apres: { id: 7 }, ancrage: { table: 'page', id: 'lore/x' } };
  const reduite = traduire(ancre);
  assert.deepEqual(reduite.ops.map((o) => o.op), ['ancrer_nouveau', 'verifier_ligne']);
  assert.deepEqual(reduite.ops[0], { op: 'ancrer_nouveau', table: 'page', id: 'lore/x', type: undefined });
  assert.deepEqual(reduite.ops[1].attendu, { id: 7 });
  const nommee = traduire({ ...ancre, apres: { id: 7, libelle: 'Lames' }, ancrage: { table: 'type_sort', id: 'lames' } });
  assert.equal(nommee.ops[0].libelle, 'Lames');
  assert.deepEqual(nommee.ops[1].attendu, { id: 7, libelle: 'Lames' });
});

test('un lot crée un mot-clé nu : le service lui crée son repère, que l’annulation retire avec lui', async () => {
  const m = nouvelle();
  const libelle = nom('nu');
  const { id, fait } = await deposeEtApplique(m, [creation('a', { libelle, cle: cleDe(libelle), description: 'Défini par un lot.' })]);
  const motCle = fait.bilan.numeros.find((x) => x.table === 'mot_cle').numero;
  assert.deepEqual(sansPrototype(repere(m.db, motCle)), { nom: libelle, adresse: null, definition: 'Défini par un lot.', couleur: null, icone: null });
  assert.deepEqual(lireUnMotCle(m.db, motCle).element, { table: 'repere', id: motCle });
  annuler(m.db, id, {});
  assert.equal(lireUnMotCle(m.db, motCle), null);
  assert.equal(repere(m.db, motCle), null);
  assert.deepEqual(reperesAPoser(m.db), [], 'sur la nouvelle structure, le lot des repères n’a plus rien à poser');
});

test('un lot modifie définition, couleur et icône sur l’élément : le repère, la page, le sort (R309 (17)), ligne annulable', async () => {
  const m = nouvelle();
  const aRepere = unMotCleARepere(m.db);
  const avant = lireUnMotCle(m.db, aRepere);
  await deposeEtApplique(m, [changer(aRepere, { description: avant.description }, { description: 'Définition d’essai.' })]);
  assert.equal(repere(m.db, aRepere).definition, 'Définition d’essai.');

  const page = m.db.prepare('SELECT id FROM page WHERE mot_cle_id IS NULL AND id LIKE ? ORDER BY id LIMIT 1').get('lore/%').id;
  const deLaPage = ancrerUnMotCle(m.db, 'page', page);
  await deposeEtApplique(m, [changer(deLaPage, { description: null }, { description: 'Sur la page.' })]);
  assert.equal(m.db.prepare('SELECT definition FROM page WHERE id = ?').get(page).definition, 'Sur la page.');
  assert.equal(repere(m.db, deLaPage), null, 'un mot-clé de page n’a pas de repère');

  // R309 (17) : le mot-clé d'un sort reçoit sa définition, sa couleur et son icône sur son sort ; la ligne s'annule seule
  const sort = m.db.prepare('SELECT id, mot_cle_id FROM sort WHERE mot_cle_id IS NOT NULL ORDER BY id LIMIT 1').get()
    ?? (() => {
      const s = m.db.prepare('SELECT id FROM sort ORDER BY id LIMIT 1').get();
      return { id: s.id, mot_cle_id: ancrerUnMotCle(m.db, 'sort', s.id) };
    })();
  const duSort = sort.mot_cle_id;
  const avantDuSort = lireUnMotCle(m.db, duSort);
  const champsDuSort = () => sansPrototype(m.db.prepare('SELECT definition, couleur, icone FROM sort WHERE id = ?').get(sort.id));
  const departDuSort = champsDuSort();
  const surLeSort = await deposeEtApplique(m, [changer(duSort, { description: avantDuSort.description }, { description: 'Sur le sort.' })]);
  assert.equal(champsDuSort().definition, 'Sur le sort.');
  assert.equal(lireUnMotCle(m.db, duSort).description, 'Sur le sort.', 'le mot-clé lit sa définition sur son sort');
  assert.equal(repere(m.db, duSort), null, 'un mot-clé de sort n’a pas de repère');
  const rangDuSort = journal(m.db, surLeSort.fait.lot_id).find((l) => l.table_nom === 'sort').rang;
  const ligneDuSort = lire(m.db, surLeSort.id).lignes.find((l) => l.n === rangDuSort);
  assert.equal(ligneDuSort.annulable_seule, true, ligneDuSort.motif);
  annulerUneLigne(m.db, surLeSort.id, ligneDuSort.n, {});
  assert.deepEqual(champsDuSort(), departDuSort);
});

test('le nom et l’adresse d’un mot-clé ancré suivent sa page : un lot ne les écrit pas', async () => {
  const m = nouvelle();
  const page = m.db.prepare('SELECT id, titre FROM page WHERE mot_cle_id IS NULL AND id LIKE ? ORDER BY id LIMIT 1').get('lore/%');
  const ancre = ancrerUnMotCle(m.db, 'page', page.id);
  const objet = lireUnMotCle(m.db, ancre);
  for (const [colonne, valeur] of [['libelle', nom('renomme')], ['url', '/lore/ailleurs/']]) {
    const r = await essaye(m, [changer(ancre, { [colonne]: objet[colonne] }, { [colonne]: valeur })]);
    assert.equal(r.verdict, 'a_corriger', `${colonne} : ${JSON.stringify(r.essai.operations)}`);
  }
  assert.equal(m.db.prepare('SELECT titre FROM page WHERE id = ?').get(page.id).titre, page.titre);
});

test('une page de notion reprend le repère de son mot-clé ; l’annuler lui rend son repère', async () => {
  const m = nouvelle();
  const libelle = nom('notion');
  const motCle = poserUnMotCle(m.db, { libelle, description: 'Défini sur le repère.' }); // sans adresse : la page de notion la lui donne
  const pageId = `guide/${cleDe(libelle)}`;
  const { id } = await deposeEtApplique(m, [{ table: 'page', cle: { id: pageId }, operation: 'inserer', apres: { id: pageId, titre: libelle, mot_cle_id: motCle }, ancrage: { notion: true } }]);
  assert.equal(repere(m.db, motCle), null, 'la page a pris la place du repère');
  assert.equal(m.db.prepare('SELECT definition FROM page WHERE id = ?').get(pageId).definition, 'Défini sur le repère.');
  annuler(m.db, id, {});
  assert.equal(m.db.prepare('SELECT 1 FROM page WHERE id = ?').get(pageId), undefined);
  assert.deepEqual(sansPrototype(repere(m.db, motCle)), { nom: libelle, adresse: null, definition: 'Défini sur le repère.', couleur: null, icone: null });
});

test('la suppression d’une page écrite avant la 0136 (sans définition, couleur ni icône dans « avant ») est contrôlée, appliquée, puis annulée', async () => {
  const m = nouvelle();
  const libelle = nom('page ancienne');
  const motCle = poserUnMotCle(m.db, { libelle }); // sans définition : la page de notion n'en reçoit pas
  const pageId = `guide/${cleDe(libelle)}`;
  await deposeEtApplique(m, [{ table: 'page', cle: { id: pageId }, operation: 'inserer', apres: { id: pageId, titre: libelle, mot_cle_id: motCle }, ancrage: { notion: true } }]);
  const ligne = sansPrototype(m.db.prepare('SELECT * FROM page WHERE id = ?').get(pageId));
  assert.equal(ligne.definition, null);
  const { definition: _d, couleur: _c, icone: _i, ...avant } = ligne; // l'avant tel qu'un lot d'avant la 0136 l'écrivait
  const { id } = await deposeEtApplique(m, [{ table: 'page', cle: { id: pageId }, operation: 'supprimer', avant }]);
  assert.equal(m.db.prepare('SELECT 1 FROM page WHERE id = ?').get(pageId), undefined, 'la page est retirée');
  annuler(m.db, id, {});
  assert.deepEqual(sansPrototype(m.db.prepare('SELECT * FROM page WHERE id = ?').get(pageId)), ligne, 'la page revient telle qu’elle était');
});

test('annuler une création d’un lot ancien : le mot-clé part avec le repère que la migration lui a posé', async () => {
  const m = nouvelle();
  const libelle = nom('ancien');
  const { id, fait } = await deposeEtApplique(m, [creation('a', { libelle, cle: cleDe(libelle) })]);
  const motCle = fait.bilan.numeros.find((x) => x.table === 'mot_cle').numero;
  // le journal tel qu'un lot d'avant la migration 0136 le notait : le mot-clé et ses colonnes, sans ligne de repère (la migration l'a posé)
  const lignes = journal(m.db, fait.lot_id);
  const duMotCle = lignes.find((l) => l.table_nom === 'mot_cle');
  reecrire(m.db, fait.lot_id, duMotCle.rang, { table_nom: 'mot_cle', cle: { id: motCle }, avant: null,
    apres: { ...JSON.parse(duMotCle.apres), libelle, url: null, description: null, couleur: null, icone: null } });
  m.db.prepare("DELETE FROM modification WHERE lot_id = ? AND table_nom = 'repere'").run(fait.lot_id);
  annuler(m.db, id, {});
  assert.equal(lireUnMotCle(m.db, motCle), null);
  assert.equal(repere(m.db, motCle), null);
});

test('annuler une ligne ancienne (R291) : une ligne mêlée remet le reste ; une ligne qui n’écrivait que la définition d’un mot-clé à repère la remet sur le repère', async () => {
  const m = nouvelle();
  const [a, b] = m.db.prepare('SELECT r.mot_cle_id AS id, r.definition FROM repere r JOIN mot_cle m ON m.id = r.mot_cle_id WHERE m.verrou = 0 ORDER BY r.mot_cle_id LIMIT 2').all();
  // une ligne mêlée : le verrou (encore une colonne) et la définition (retirée)
  const melee = await deposeEtApplique(m, [changer(a.id, { verrou: 0 }, { verrou: 1 })], { verrous_ouverts: ['R218'] });
  const ligneMelee = journal(m.db, melee.fait.lot_id).find((l) => l.table_nom === 'mot_cle');
  reecrire(m.db, melee.fait.lot_id, ligneMelee.rang, { table_nom: 'mot_cle', cle: { id: a.id }, avant: { verrou: 0, description: a.definition }, apres: { verrou: 1, description: 'Écrite par un lot ancien.' } });
  annulerUneLigne(m.db, melee.id, ligneMelee.rang, { verrous_ouverts: ['R218'] });
  assert.equal(lireUnMotCle(m.db, a.id).verrou, 0, 'le verrou est remis');
  assert.equal(repere(m.db, a.id).definition, a.definition, 'la définition n’est pas touchée');

  // un lot de deux lignes ; la première réécrite comme une ligne d'avant la migration qui n'écrivait que la définition
  const deux = await deposeEtApplique(m, [changer(a.id, { description: a.definition }, { description: 'Première.' }), changer(b.id, { description: b.definition }, { description: 'Seconde.' })]);
  const [premiere] = journal(m.db, deux.fait.lot_id).filter((l) => l.table_nom === 'repere');
  reecrire(m.db, deux.fait.lot_id, premiere.rang, { table_nom: 'mot_cle', cle: { id: a.id }, avant: { description: a.definition }, apres: { description: 'Première.' } });
  const vue = lire(m.db, deux.id).lignes.find((l) => l.n === premiere.rang);
  assert.equal(vue.annulable_seule, true, vue.motif);
  assert.equal(vue.etat, 'en_place');
  annulerUneLigne(m.db, deux.id, premiere.rang, {});
  assert.equal(repere(m.db, a.id).definition, a.definition, 'la définition d’avant revient sur le repère');
  assert.equal(repere(m.db, b.id).definition, 'Seconde.', 'l’autre ligne reste en place');
  // le lot entier : la seconde ligne est remise, la première n'a plus rien à remettre
  annuler(m.db, deux.id, {});
  assert.equal(repere(m.db, b.id).definition, b.definition);
  assert.equal(repere(m.db, a.id).definition, a.definition);
});

test('annuler une ligne ancienne (R291) : le « changé depuis » se compare sur l’élément ; la définition d’un mot-clé de page revient sur la page', async () => {
  const m = nouvelle();
  const a = unMotCleARepere(m.db);
  const avantA = lireUnMotCle(m.db, a);
  const surLeRepere = await deposeEtApplique(m, [changer(a, { description: avantA.description }, { description: 'Écrite par un lot ancien.' })]);
  const ligneA = journal(m.db, surLeRepere.fait.lot_id).find((l) => l.table_nom === 'repere');
  reecrire(m.db, surLeRepere.fait.lot_id, ligneA.rang, { table_nom: 'mot_cle', cle: { id: a }, avant: { description: avantA.description }, apres: { description: 'Écrite par un lot ancien.' } });
  // le site a changé la définition depuis, sur le repère : le site prime, rien n'est remis, sans refus
  m.db.prepare('UPDATE repere SET definition = ? WHERE mot_cle_id = ?').run('Changée depuis.', a);
  const changee = lire(m.db, surLeRepere.id).lignes.find((l) => l.n === ligneA.rang);
  assert.equal(changee.etat, 'modifiee_depuis');
  assert.equal(changee.annulable_seule, false);
  assert.throws(() => annulerUneLigne(m.db, surLeRepere.id, ligneA.rang, {}), (e) => e instanceof ErreurEdition && e.statut === 409 && /Rien à remettre/.test(e.message));
  assert.equal(repere(m.db, a).definition, 'Changée depuis.');

  // un mot-clé de page : la ligne ancienne ne nommait que le mot-clé, sa définition se remet sur la page
  const page = m.db.prepare('SELECT id, definition FROM page WHERE mot_cle_id IS NULL AND id LIKE ? ORDER BY id LIMIT 1').get('lore/%');
  const deLaPage = ancrerUnMotCle(m.db, 'page', page.id);
  const avantPage = m.db.prepare('SELECT definition FROM page WHERE id = ?').get(page.id).definition;
  const surLaPage = await deposeEtApplique(m, [changer(deLaPage, { description: avantPage }, { description: 'Sur la page, par un lot ancien.' })]);
  const lignePage = journal(m.db, surLaPage.fait.lot_id).find((l) => l.table_nom === 'page' && Object.hasOwn(JSON.parse(l.apres ?? '{}'), 'definition'));
  reecrire(m.db, surLaPage.fait.lot_id, lignePage.rang, { table_nom: 'mot_cle', cle: { id: deLaPage }, avant: { description: avantPage }, apres: { description: 'Sur la page, par un lot ancien.' } });
  const vue = lire(m.db, surLaPage.id).lignes.find((l) => l.n === lignePage.rang);
  assert.equal(vue.annulable_seule, true, vue.motif);
  annulerUneLigne(m.db, surLaPage.id, lignePage.rang, {});
  assert.equal(m.db.prepare('SELECT definition FROM page WHERE id = ?').get(page.id).definition, avantPage);

  // le nom seul d'un mot-clé de page se lit sur la page, qui a son propre historique : rien à remettre, pas un refus
  const renomme = await deposeEtApplique(m, [changer(deLaPage, { description: avantPage }, { description: 'Encore sur la page.' })]);
  const ligneNom = journal(m.db, renomme.fait.lot_id).find((l) => l.table_nom === 'page' && Object.hasOwn(JSON.parse(l.apres ?? '{}'), 'definition'));
  reecrire(m.db, renomme.fait.lot_id, ligneNom.rang, { table_nom: 'mot_cle', cle: { id: deLaPage }, avant: { libelle: 'Ancien nom' }, apres: { libelle: 'Nom d’un lot ancien' } });
  const vueNom = lire(m.db, renomme.id).lignes.find((l) => l.n === ligneNom.rang);
  assert.equal(vueNom.annulable_seule, false);
  assert.match(vueNom.motif, /Rien à remettre/);
  assert.throws(() => annulerUneLigne(m.db, renomme.id, ligneNom.rang, {}), (e) => e instanceof ErreurEdition && e.statut === 409 && /Rien à remettre/.test(e.message));
});

test('écart avec la production : l’objet du mot-clé est comparé, même quand la production a encore l’ancienne structure', async () => {
  const m = nouvelle();
  const id = unMotCleARepere(m.db);
  const avant = lireUnMotCle(m.db, id);
  // la production : une copie d'avant le lot, ramenée à la structure d'avant la migration 0136 (les champs dans les colonnes du mot-clé)
  const production = join(racine, `production-${(n += 1)}.db`);
  m.db.exec(`VACUUM INTO '${production.replaceAll("'", "''")}'`);
  const prod = new DatabaseSync(production, { enableForeignKeyConstraints: false });
  for (const c of COLONNES_LOGIQUES_DU_MOT_CLE) prod.exec(`ALTER TABLE mot_cle ADD COLUMN ${c} TEXT`);
  prod.exec(`UPDATE mot_cle SET libelle = r.nom, url = r.adresse, description = r.definition, couleur = r.couleur, icone = r.icone
    FROM repere r WHERE r.mot_cle_id = mot_cle.id`);
  prod.close();
  const { id: lotId } = await deposeEtApplique(m, [changer(id, { description: avant.description }, { description: 'Changée depuis la production.' })]);
  const ecart = () => lister(m.db, { production }).find((l) => l.id === lotId).ecart_production;
  assert.equal(ecart(), true);
  const enProd = new DatabaseSync(production, { enableForeignKeyConstraints: false });
  enProd.prepare('UPDATE mot_cle SET description = ? WHERE id = ?').run('Changée depuis la production.', id);
  enProd.close();
  assert.equal(ecart(), false, 'la même définition, lue dans la colonne d’un côté et sur le repère de l’autre : pas d’écart');
  assert.ok(lire(m.db, lotId, { production }).lignes.every((l) => l.ecart_production === false));
});
