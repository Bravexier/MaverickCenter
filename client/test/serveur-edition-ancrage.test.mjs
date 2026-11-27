// L'action « Préparer l'ancrage » (décision R309, docs/chantier-ancrage-mots-cles.md, §5 ; serveur/edition-ancrage-lots.mjs) : les lots du plan déposés et
// enchaînés par le vrai service, sur une petite base d'essai (un dépôt coûte un essai complet sur une copie). Un seul enchaînement est
// joué, puis copié pour chaque test qui le prolonge. Noms inventés ; les lignes se prennent par ordre d'id, aucune valeur de règle n'est lue.
//   node --test test/serveur-edition-ancrage.test.mjs
import assert from 'node:assert/strict';
import { copyFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { ouvrirBaseVivante } from '../serveur/base-vivante.mjs';
import { controlerLeContenu } from '../serveur/controles-du-contenu.mjs';
import { traiter } from '../serveur/api.mjs';
import * as tacheDeFond from '../serveur/edition-ancrage-lots.mjs';
import { lignesAnnuleesDeLAncrage, preparerLAncrage } from '../serveur/edition-ancrage-lots.mjs';
import { annuler, annulerUneLigne, appliquer, deposerEtAppliquer, lire } from '../serveur/edition-lots.mjs';
import { adresseDeLaPage, adresseDuSort } from '../src/lib/adresses-db.mjs';
import { FORMAT_DU_LOT } from '../src/lib/lot-de-changements.mjs';
import { messageDeLAncrage } from '../src/lib/lots-rendu.mjs';
import { CATEGORIES_NOUVELLES, TYPE_UNIQUE } from '../src/lib/mots-cles-ancrage.mjs';
import { baseDAncrage, poserMagie, poserMotCle, poserPage, poserSort, recalculerLesCles } from './aide-ancrage.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';

const racine = dossierTemporaire('ancrage-action');
let n = 0;
const OUVERT = { controle: { ouvertHorsEdition: true }, enArrierePlan: false };
const nomInvente = (suffixe) => `Zephyrion ${suffixe} ${process.pid}`;

/**
 * Une petite base d'essai (test/aide-ancrage.mjs), en fichier : deux capacités, une page de guide, une page de race désignée par un mot-clé au nom différent (un
 * renommage), deux sorts d'une magie, et deux mots-clés de la liste du type unique, à plusieurs catégories (`aReclasser`).
 */
function nouvelle({ pageDeMagie = true } = {}) {
  const memoire = baseDAncrage();
  const capacites = ['capacites/zephyrion-a', 'capacites/zephyrion-b'];
  capacites.forEach((id, i) => poserPage(memoire, id, nomInvente(`capacité ${i}`)));
  const guide = poserPage(memoire, 'guide/zephyrion', nomInvente('guide'));
  const race = poserPage(memoire, 'races/zephyrion', nomInvente('race'));
  const motCleRace = poserMotCle(memoire, { libelle: nomInvente('ancien nom'), url: adresseDeLaPage(race), categories: ['Race'] });
  // la magie a sa page, déjà ancrée : l'adresse d'un sort y renvoie (sans elle, le service refuse le lot des sorts)
  const titreMagie = nomInvente('magie');
  const idMagie = 'magies/zephyrion';
  let motCleMagie = null;
  if (pageDeMagie) {
    poserPage(memoire, idMagie, titreMagie);
    motCleMagie = poserMotCle(memoire, { libelle: titreMagie, url: adresseDeLaPage(idMagie), categories: ['Magie'] });
    memoire.prepare('UPDATE page SET mot_cle_id = ? WHERE id = ?').run(motCleMagie, idMagie);
  }
  const magie = poserMagie(memoire, idMagie, titreMagie, { mot_cle_id: motCleMagie });
  const sorts = [0, 1].map((i) => poserSort(memoire, magie, nomInvente(`sort ${i}`)));
  const aReclasser = TYPE_UNIQUE['Équipement'].slice(0, 2);
  aReclasser.forEach((id, i) => poserMotCle(memoire, { id, libelle: nomInvente(`reclassé ${i}`), categories: ['Équipement', 'Combat'] }));
  // la provenance et le type des pages (clés étrangères vers `famille` et `type_page`) : le lot des pages de notion, le dernier, crée des pages du guide
  memoire.exec(`INSERT INTO famille (id, libelle, ordre) VALUES ('docs', 'Famille docs', 1); UPDATE page SET origine = 'docs';
    INSERT INTO type_page (id, libelle, singulier, salon_discord, description, ordre) SELECT type, type, type, '', '', row_number() OVER (ORDER BY type) FROM (SELECT DISTINCT type FROM page)`);
  recalculerLesCles(memoire);
  const dossier = join(racine, `b${(n += 1)}`);
  mkdirSync(dossier, { recursive: true });
  const chemin = join(dossier, 'vivante.db');
  memoire.exec(`VACUUM INTO '${chemin.replaceAll("'", "''")}'`);
  memoire.close();
  const db = ouvrirBaseVivante(chemin);
  return { db, base: () => db, dossier: join(racine, `essais${n}`), chemin, monde: { capacites, guide, race, motCleRace, sorts, aReclasser } };
}

/** L'enchaînement complet, joué une seule fois ; chaque test en prend une copie. */
let chaine = null;
const laChaine = () => (chaine ??= (async () => {
  const m = nouvelle();
  const avant = new Set(controlerLeContenu(m.db).problemes);
  const resultat = await preparerLAncrage(m.base, { par: 'cle_de_depot', dossier: m.dossier, ...OUVERT });
  return { ...m, avant, resultat };
})());

/** Une copie de la base après l'enchaînement. */
async function apresLaChaine() {
  const c = await laChaine();
  const dossier = join(racine, `c${(n += 1)}`);
  mkdirSync(dossier, { recursive: true });
  const chemin = join(dossier, 'vivante.db');
  copyFileSync(c.chemin, chemin);
  const db = ouvrirBaseVivante(chemin);
  return { db, base: () => db, dossier: join(racine, `essais${n}`), monde: c.monde, resultat: c.resultat };
}

const lancer = (m, options = {}) => preparerLAncrage(m.base, { par: 'cle_de_depot', dossier: m.dossier, ...OUVERT, ...options });
const ancre = (m, table, id) => m.db.prepare(`SELECT mot_cle_id AS a FROM "${table}" WHERE id = ?`).get(id).a;
const nomDe = (m, id) => m.db.prepare('SELECT libelle FROM mot_cle WHERE id = ?').get(id)?.libelle;
const lotsR309 = (m) => m.db.prepare("SELECT id, etat, lot_id FROM lot_de_changements WHERE decision = 'R309' ORDER BY rowid").all();
const rangDansLeJournal = (m, lotId, table, cle) => m.db.prepare('SELECT rang, cle FROM modification WHERE lot_id = ? AND table_nom = ? ORDER BY rang').all(lotId, table)
  .find((l) => Object.entries(cle).every(([c, v]) => JSON.parse(l.cle)[c] === v))?.rang;
/** Le lot appliqué qui porte l'écriture de `table` / `cle`, et le numéro de sa ligne. */
function ligneDuLot(m, table, cle) {
  for (const l of lotsR309(m)) {
    const rang = rangDansLeJournal(m, l.lot_id, table, cle);
    if (rang) return { lot: l.id, rang };
  }
  throw new Error(`aucune ligne pour ${table} ${JSON.stringify(cle)}`);
}

test('avec la clé de dépôt : les lots s’enchaînent, chaque élément est ancré, la base passe db:check (R291, R306, R309)', async () => {
  const c = await laChaine();
  const { resultat: r, monde } = c;
  assert.equal(r.arret, null, r.arret?.motif);
  assert.equal(r.suite, false);
  assert.deepEqual(r.lots.map((l) => l.etat), r.lots.map(() => 'applique'));
  assert.equal(r.lots.length, 5, 'noms, sorts, pages, capacités, pages de notion (les reclassés et le type de sort créé n’ont pas d’élément qui ait une page)');
  assert.ok(r.lots.every((l) => l.ecrites > 0));
  assert.ok(r.comptes.crees >= 4, JSON.stringify(r.comptes));
  for (const libelle of CATEGORIES_NOUVELLES) assert.ok(c.db.prepare('SELECT 1 FROM categorie_mot_cle WHERE libelle = ?').get(libelle), libelle);
  for (const id of monde.capacites) assert.notEqual(ancre(c, 'page', id), null, id);
  for (const id of monde.sorts) assert.notEqual(ancre(c, 'sort', id), null, id);
  assert.equal(ancre(c, 'page', monde.race), monde.motCleRace);
  assert.equal(nomDe(c, monde.motCleRace), c.db.prepare('SELECT titre FROM page WHERE id = ?').get(monde.race).titre, 'le mot-clé désigné prend le nom de sa page');
  for (const id of monde.aReclasser) assert.equal(c.db.prepare('SELECT count(*) AS n FROM mot_cle_categorie WHERE mot_cle_id = ?').get(id).n, 1, `type unique de #${id}`);
  const nouveaux = controlerLeContenu(c.db).problemes.filter((p) => !c.avant.has(p));
  assert.deepEqual(nouveaux, []);
  const message = messageDeLAncrage(r);
  assert.ok(message.includes(String(r.lots.length)));
  assert.doesNotMatch(message, /mot_cle|categorie_|type_sort/, 'ni table ni colonne dans le message');
});

test('rejouable : un second lancement ne dépose rien', async () => {
  const m = await apresLaChaine();
  const avant = lotsR309(m).length;
  const r = await lancer(m);
  assert.deepEqual([r.lots, r.arret, r.suite], [[], null, false]);
  assert.equal(lotsR309(m).length, avant);
  assert.match(messageDeLAncrage(r), /Rien à préparer/);
});

test('sans clé : un seul lot en proposition, le contenu n’a pas bougé, `suite` vrai ; relancer ne dépose pas un doublon', async () => {
  const m = nouvelle();
  const categories = m.db.prepare('SELECT count(*) AS n FROM categorie_mot_cle').get().n;
  const r = await preparerLAncrage(m.base, { dossier: m.dossier, ...OUVERT });
  assert.equal(r.lots.length, 1);
  assert.equal(r.lots[0].etat, 'propose');
  assert.equal(r.suite, true);
  assert.equal(r.arret, null, r.arret?.motif);
  assert.equal(m.db.prepare('SELECT count(*) AS n FROM categorie_mot_cle').get().n, categories, 'rien n’entre sans le clic');
  assert.equal(ancre(m, 'page', m.monde.race), null);
  const encore = await preparerLAncrage(m.base, { dossier: m.dossier, ...OUVERT });
  assert.deepEqual(encore.lots, []);
  assert.ok(encore.arret?.motif, 'la proposition en attente est dite');
  assert.equal(lotsR309(m).length, 1, 'pas de doublon');
});

test('un lot refusé n’écrit rien et arrête la suite, avec son motif : le premier refus de l’essai', async () => {
  // la magie n'a pas de page : l'adresse de ses sorts n'existe pas, le service refuse le lot des sorts ; le lot 1 est déjà passé
  const m = nouvelle({ pageDeMagie: false });
  const [sort0, sort1] = m.monde.sorts.map((id) => m.db.prepare('SELECT nom FROM sort WHERE id = ?').get(id).nom);
  const motsCles = () => m.db.prepare('SELECT count(*) AS n FROM mot_cle').get().n;
  const r = await lancer(m);
  assert.equal(r.lots.length, 1, 'le lot 1 reste appliqué');
  assert.ok(r.arret?.titre, 'le lot arrêté est nommé');
  assert.notEqual(r.arret.titre, r.lots[0].titre);
  assert.ok(r.arret.motif.includes(sort0), r.arret.motif);
  assert.ok(!r.arret.motif.includes(sort1), 'un seul motif : le premier refus, sans la cascade');
  assert.doesNotMatch(r.arret.motif, /opération/, 'pas de jargon sur la page (skill zone-mise-a-jour-lots)');
  assert.match(r.arret.motif, /^ligne \d+ du lot : /);
  assert.equal(r.suite, false, 'un lot refusé arrête la suite : relancer redéposerait le même refus');
  for (const id of [...m.monde.sorts, ...m.monde.capacites]) assert.equal(ancre(m, id.includes('#sort:') ? 'sort' : 'page', id), null, `${id} : rien du lot refusé, rien après lui`);
  const refuse = m.db.prepare("SELECT etat FROM lot_de_changements WHERE decision = 'R309' ORDER BY rowid DESC LIMIT 1").get();
  assert.equal(refuse.etat, 'refuse');
  const nombre = motsCles();
  assert.equal((await lancer(m)).lots.length, 0, 'relancé, il s’arrête au même refus');
  assert.equal(motsCles(), nombre);
  assert.ok(messageDeLAncrage(r).includes(r.arret.motif));
});

test('sans clé, une proposition que l’essai refuse : le message dit de la refuser, ni « appliquez-la » ni « Arrêt », et son motif est sans « opération »', async () => {
  const m = nouvelle({ pageDeMagie: false });
  const premier = await preparerLAncrage(m.base, { dossier: m.dossier, ...OUVERT });
  assert.equal(premier.arret, null, premier.arret?.motif);
  appliquer(m.db, premier.lots[0].id, {});
  const r = await preparerLAncrage(m.base, { dossier: m.dossier, ...OUVERT });
  assert.equal(r.lots.length, 1);
  assert.equal(r.lots[0].etat, 'propose');
  assert.equal(r.arret?.titre, r.lots[0].titre, 'l’arrêt est sur la proposition');
  assert.doesNotMatch(r.arret.motif, /opération/);
  const message = messageDeLAncrage(r);
  assert.match(message, /ne peut pas s’appliquer/);
  assert.match(message, /Refusez-la/);
  assert.doesNotMatch(message, /appliquez-la|Arrêt/);
  assert.ok(message.includes(r.arret.motif.trim().replace(/[.!?…]$/, '')), message);
});

test('une ligne annulée reste écartée et listée, avec tout son groupe', async () => {
  const m = await apresLaChaine();
  const [page] = m.monde.capacites;
  const motCle = ancre(m, 'page', page);
  const { lot, rang } = ligneDuLot(m, 'mot_cle', { id: motCle });
  annulerUneLigne(m.db, lot, rang);
  assert.equal(ancre(m, 'page', page), null);
  const cles = lignesAnnuleesDeLAncrage(m.db);
  assert.ok(cles.has(`page:${page}`), [...cles].join(', '));

  const r = await lancer(m);
  assert.deepEqual(r.lots, [], 'rien n’est redéposé');
  assert.ok(r.ecartees.includes(`page:${page}`));
  assert.equal(ancre(m, 'page', page), null);
  assert.match(messageDeLAncrage(r), /Reprendre/);

  // « Reprendre » redépose la ligne ; elle n'est plus écartée ensuite
  const repris = await lancer(m, { reprendre: true });
  assert.equal(repris.lots.length, 1);
  assert.deepEqual(repris.ecartees, []);
  assert.notEqual(ancre(m, 'page', page), null);
  assert.ok(!lignesAnnuleesDeLAncrage(m.db).has(`page:${page}`), 'reprise : la ligne ne compte plus comme annulée');

  // l'ordre des lots est celui du dépôt (`depose_le`), pas l'ordre physique de la table (Fable m2) : la table recopiée à l'envers, la reprise reste la plus récente
  const lots = m.db.prepare('SELECT rowid AS r, * FROM lot_de_changements ORDER BY rowid').all();
  const dernier = lots.at(-1).id;
  m.db.exec('BEGIN');
  m.db.exec('DELETE FROM lot_de_changements');
  for (const { r: _r, ...lot } of lots.reverse()) {
    lot.depose_le = lot.id === dernier ? '2026-01-02T00:00:00Z' : '2026-01-01T00:00:00Z';
    const colonnes = Object.keys(lot);
    m.db.prepare(`INSERT INTO lot_de_changements (${colonnes.join(', ')}) VALUES (${colonnes.map(() => '?').join(', ')})`).run(...Object.values(lot));
  }
  m.db.exec('COMMIT');
  assert.equal(m.db.prepare('SELECT id FROM lot_de_changements ORDER BY rowid LIMIT 1').get().id, dernier, 'la reprise est la première ligne de la table');
  assert.ok(!lignesAnnuleesDeLAncrage(m.db).has(`page:${page}`), 'la reprise, déposée après l’annulation, compte encore');
  assert.deepEqual((await lancer(m)).lots, [], 'rien n’est redéposé');
});

test('un renommage annulé garde l’ancien nom, signalé comme écart', async () => {
  const m = await apresLaChaine();
  const { motCleRace, race } = m.monde;
  const { lot, rang } = ligneDuLot(m, 'mot_cle', { id: motCleRace });
  const nouveau = nomDe(m, motCleRace);
  annulerUneLigne(m.db, lot, rang);
  const ancien = nomDe(m, motCleRace);
  assert.notEqual(ancien, nouveau);
  const r = await lancer(m);
  assert.deepEqual(r.lots, []);
  assert.equal(nomDe(m, motCleRace), ancien, 'il garde son ancien nom');
  assert.ok(r.ecartees.includes(`nom:${motCleRace}`), r.ecartees.join(', '));
  assert.match(messageDeLAncrage(r), /ancien nom/);
  assert.equal(ancre(m, 'page', race), motCleRace, 'l’ancre, elle, reste');
});

test('un lot passé « annulé » par ses lignes : la ligne gardée n’est pas écartée, son mot-clé suit encore un renommage de sa page (R291, R309)', async () => {
  const m = await apresLaChaine();
  const [gardee, annulee] = m.monde.capacites;
  const motGarde = ancre(m, 'page', gardee);
  // le site a changé le mot-clé de la première : son groupe ne s'annule plus, et le lot passe « annulé » quand l'autre groupe part
  m.db.prepare('UPDATE mot_cle SET description = ? WHERE id = ?').run(nomInvente('description corrigée'), motGarde);
  const { lot, rang } = ligneDuLot(m, 'mot_cle', { id: ancre(m, 'page', annulee) });
  annulerUneLigne(m.db, lot, rang);
  const apres = m.db.prepare('SELECT etat, bilan FROM lot_de_changements WHERE id = ?').get(lot);
  assert.equal(apres.etat, 'annule');
  assert.equal(JSON.parse(apres.bilan).annulation, undefined, 'passé « annulé » par ses lignes');
  assert.equal(ancre(m, 'page', gardee), motGarde, 'l’ancre gardée reste');

  const cles = lignesAnnuleesDeLAncrage(m.db);
  assert.ok(!cles.has(`page:${gardee}`), [...cles].join(', '));
  assert.ok(cles.has(`page:${annulee}`), [...cles].join(', '));

  const titre = nomInvente('capacité renommée');
  m.db.prepare('UPDATE page SET titre = ? WHERE id = ?').run(titre, gardee);
  const r = await lancer(m);
  assert.equal(r.arret, null, r.arret?.motif);
  assert.equal(r.lots.length, 1, 'l’alignement du nom est déposé');
  assert.equal(nomDe(m, motGarde), titre);
  assert.ok(!r.ecartees.includes(`page:${gardee}`), r.ecartees.join(', '));
  assert.ok(r.ecartees.includes(`page:${annulee}`), r.ecartees.join(', '));
  assert.equal(ancre(m, 'page', annulee), null, 'la ligne annulée n’est pas refaite');
});

test('un renommage annulé seul, un autre nom donné ensuite, puis le lot entier annulé : la ligne reste écartée, la relance ne dépose rien, le nom choisi reste (R291, R309)', async () => {
  const m = await apresLaChaine();
  const { motCleRace } = m.monde;
  const { lot, rang } = ligneDuLot(m, 'mot_cle', { id: motCleRace });
  annulerUneLigne(m.db, lot, rang);
  const choisi = nomInvente('nom choisi');
  m.db.prepare('UPDATE mot_cle SET libelle = ? WHERE id = ?').run(choisi, motCleRace);
  recalculerLesCles(m.db);
  for (const l of lotsR309(m).reverse()) annuler(m.db, l.id, {});

  const cles = lignesAnnuleesDeLAncrage(m.db);
  assert.ok(cles.has(`nom:${motCleRace}`), [...cles].join(', '));
  const avant = lotsR309(m).length;
  const r = await lancer(m);
  assert.deepEqual(r.lots, [], 'rien n’est redéposé');
  assert.equal(lotsR309(m).length, avant);
  assert.equal(nomDe(m, motCleRace), choisi, 'le nom choisi reste');
  // le lot annulé a aussi retiré l'ancre de la page : le plan s'arrête à cette clé et ne rend que ce qui a retenu quelque chose
  assert.ok(r.ecartees.includes(`page:${m.monde.race}`), r.ecartees.join(', '));
});

test('« Reprendre » redépose les lignes annulées, un lot annulé en entier compris', async () => {
  const m = await apresLaChaine();
  const dernier = lotsR309(m).at(-1);
  annuler(m.db, dernier.id, {});
  const ecartees = await lancer(m);
  assert.deepEqual(ecartees.lots, [], 'un lot annulé en entier n’est pas refait');
  assert.ok(ecartees.ecartees.length > 0);
  const r = await lancer(m, { reprendre: true });
  assert.equal(r.arret, null, r.arret?.motif);
  assert.equal(r.lots.length, 1);
  assert.deepEqual(r.ecartees, []);
  for (const id of m.monde.capacites) assert.notEqual(ancre(m, 'page', id), null, id);
});

test('tout défait, lot par lot : même les catégories créées ne reviennent pas sans « Reprendre »', async () => {
  const m = await apresLaChaine();
  for (const l of lotsR309(m).reverse()) annuler(m.db, l.id, {});
  for (const libelle of CATEGORIES_NOUVELLES) assert.equal(m.db.prepare('SELECT 1 FROM categorie_mot_cle WHERE libelle = ?').get(libelle), undefined, libelle);
  const r = await lancer(m);
  assert.deepEqual(r.lots, []);
  assert.equal(r.suite, false);
  for (const libelle of CATEGORIES_NOUVELLES) assert.ok(r.ecartees.includes(`categorie:${libelle}`), libelle);
  for (const libelle of CATEGORIES_NOUVELLES) assert.equal(m.db.prepare('SELECT 1 FROM categorie_mot_cle WHERE libelle = ?').get(libelle), undefined, libelle);
});

test('le refus d’une reprise par un lot forgé : aligner ne prend aucune valeur', async () => {
  const m = await apresLaChaine();
  const { motCleRace } = m.monde;
  const nom = nomDe(m, motCleRace);
  const force = nomInvente('forgé');
  const forge = {
    format: FORMAT_DU_LOT, titre: 'Lot forgé', nature: 'decision', decision: 'R309', auteur: 'essai',
    operations: [{ table: 'mot_cle', cle: { id: motCleRace }, operation: 'modifier', avant: { libelle: nom }, apres: { libelle: force }, ancrage: { aligner: true } }],
  };
  await assert.rejects(deposerEtAppliquer(m.base, forge, { par: 'cle_de_depot', dossier: m.dossier, ...OUVERT }), (e) => e.statut === 409);
  assert.equal(nomDe(m, motCleRace), nom, 'le nom vient de la page, jamais du lot');
});

test('les adresses gardées pendant un lot sont oubliées dès qu’une opération peut en changer une', async () => {
  const m = nouvelle();
  const { capacites: [capacite], sorts: [sort] } = m.monde;
  const magie = 'magies/zephyrion';
  m.db.prepare("UPDATE page SET statut = 'example' WHERE id = ?").run(magie); // l'adresse du sort n'existe pas encore
  const categorie = (libelle) => m.db.prepare('SELECT id FROM categorie_mot_cle WHERE libelle = ?').get(libelle).id;
  const creation = (jeton, table, id, type) => {
    const element = m.db.prepare(`SELECT ${table === 'page' ? 'titre' : 'nom'} AS nom FROM "${table}" WHERE id = ?`).get(id);
    const url = table === 'page' ? adresseDeLaPage(id) : adresseDuSort(id);
    return { table: 'mot_cle', cle: { id: { $numero: jeton } }, operation: 'inserer', apres: { id: { $numero: jeton }, libelle: element.nom, url }, ancrage: { table, id, type } };
  };
  const lot = {
    format: FORMAT_DU_LOT, titre: 'Adresses', nature: 'decision', decision: 'R309', auteur: 'essai',
    operations: [
      creation('a', 'page', capacite, categorie('Don')),
      { table: 'page', cle: { id: magie }, operation: 'modifier', avant: { statut: 'example' }, apres: { statut: 'draft' } },
      creation('b', 'sort', sort, categorie('Sort')),
    ],
  };
  const fait = await deposerEtAppliquer(m.base, lot, { par: 'cle_de_depot', dossier: m.dossier, ...OUVERT });
  assert.equal(fait.etat, 'applique');
  assert.notEqual(ancre(m, 'sort', sort), null, 'la page rendue visible dans le lot compte pour la création suivante');
});

test('« à trancher » arrive dans le résultat', async () => {
  const m = nouvelle();
  const [page] = m.monde.capacites;
  // deux mots-clés à la même adresse : l'action ne devine pas lequel prend la page
  const [a, b] = m.db.prepare('SELECT id FROM mot_cle WHERE url IS NULL AND verrou = 0 ORDER BY id LIMIT 2').all().map((l) => l.id);
  for (const id of [a, b]) m.db.prepare('UPDATE mot_cle SET url = ? WHERE id = ?').run(adresseDeLaPage(page), id);
  const r = await preparerLAncrage(m.base, { dossier: m.dossier, ...OUVERT });
  const cas = r.a_trancher.find((x) => x.id === page);
  assert.ok(cas, JSON.stringify(r.a_trancher));
  assert.ok(messageDeLAncrage(r).includes(cas.raison));
  assert.equal(ancre(m, 'page', page), null);
});

test('le message suit le résultat, sans jargon', () => {
  const vide = messageDeLAncrage({ lots: [], arret: null, suite: false, a_trancher: [], ecartees: [], comptes: {} });
  assert.match(vide, /Rien à préparer/);
  const propose = messageDeLAncrage({ lots: [{ etat: 'propose', titre: 'A' }], arret: null, suite: true, a_trancher: [], ecartees: [], comptes: {} });
  assert.match(propose, /proposition/);
  const mots = messageDeLAncrage({ lots: [], arret: null, suite: false, a_trancher: [], ecartees: ['page:races/x', 'sort:m#sort:y', 'type_sort:soin', 'nom:12', 'type:13', 'categorie:Guide'], comptes: {} });
  for (const brut of ['page:', 'sort:', 'type_sort', 'nom:', 'type:', 'categorie:']) assert.ok(!mots.includes(brut), brut);
  const beaucoup = messageDeLAncrage({ lots: [], arret: null, suite: false, a_trancher: [], ecartees: Array.from({ length: 30 }, (_, i) => `page:p${i}`), comptes: {} });
  assert.match(beaucoup, /20 de plus/);
  // des lignes annulées laissées de côté : rien n'est « déjà » ancré pour elles (relecture finale, Opus M1)
  for (const message of [mots, beaucoup]) assert.doesNotMatch(message, /l’est déjà/, message);
  assert.match(mots, /Rien d’autre à préparer/);
  // sans clé, la proposition refusée par l'essai : la refuser, pas l'appliquer (relecture finale, réserve T6 M3)
  const refusee = messageDeLAncrage({ lots: [{ etat: 'propose', titre: 'Sorts' }], arret: { titre: 'Sorts', motif: 'ligne 2 du lot : refusée' }, suite: true, a_trancher: [], ecartees: [], comptes: {} });
  assert.match(refusee, /La proposition « Sorts » ne peut pas s’appliquer : ligne 2 du lot : refusée\. Refusez-la/);
  assert.doesNotMatch(refusee, /appliquez-la|Arrêt/);
  // avec la clé, l'arrêt sur un lot refusé reste dit comme un arrêt
  const arret = messageDeLAncrage({ lots: [{ etat: 'applique', titre: 'Noms' }], arret: { titre: 'Sorts', motif: 'refusé.' }, suite: true, a_trancher: [], ecartees: [], comptes: {} });
  assert.match(arret, /Arrêt sur « Sorts »/);
});

test('lire reste possible sur un lot de l’action (le format n’a pas de `famille`)', async () => {
  const c = await laChaine();
  const { contenu } = lire(c.db, lotsR309(c)[0].id);
  assert.equal(contenu.famille, undefined);
});

// --- La tâche de fond (R309) : nginx coupe une requête après 60 s, l'enchaînement en prend plusieurs minutes ---------------------------------------------------

const ADRESSE_ANCRAGE = '/api/edition/lots/ancrage/';
const AU_REPOS = { en_cours: false, resultat: null, erreur: null };
/** La clé de dépôt posée (R291), sur la base source (`mot_cle_categorie` est hors édition : le lot ne s'y ouvre que là) : chaque lot s'applique aussitôt. */
const AVEC_LA_CLE = { source: () => true, acces: { controler: () => null, droit: () => ({ droit: 'depot' }), depot: () => ({ direct: true, par: 'cle_de_depot' }) } };
/** La route ; sur une base déjà ancrée, un lancement ne dépose rien et ne coûte que le calcul du plan. */
function laRoute(base, plus = {}) {
  const journal = [];
  const service = { base, etat: () => ({}), edition: true, journal: (l) => journal.push(l), lots: { enArrierePlan: false }, ...plus };
  const appel = async (methode, corps) => traiter({
    methode, chemin: ADRESSE_ANCRAGE, entetes: { 'content-type': 'application/json' }, corps: corps === undefined ? undefined : JSON.stringify(corps),
  }, service);
  return { appel, journal };
}
/** Le dernier état, une fois l'enchaînement fini. */
async function laFin(route) {
  const limite = Date.now() + 20_000;
  for (;;) {
    const { corps } = await route.appel('GET');
    if (!corps.en_cours) return corps;
    assert.ok(Date.now() < limite, 'l’enchaînement ne finit pas');
    await new Promise(setImmediate);
  }
}

test('tâche de fond (R309) : le POST répond 202 avant la fin, le GET passe de en_cours au résultat, gardé jusqu’au lancement suivant', async () => {
  const m = await apresLaChaine();
  const route = laRoute(m.base);
  const avant = lotsR309(m).length;
  const lance = await route.appel('POST', {});
  assert.equal(lance.statut, 202, JSON.stringify(lance.corps));
  assert.deepEqual(lance.corps, { en_cours: true });
  const pendant = await route.appel('GET');
  assert.equal(pendant.statut, 200);
  assert.deepEqual(pendant.corps, { en_cours: true, resultat: null, erreur: null });

  const fin = await laFin(route);
  assert.equal(fin.erreur, null);
  assert.deepEqual(fin.resultat.lots, [], 'tout est déjà ancré');
  assert.equal(fin.resultat.arret, null);
  assert.equal(lotsR309(m).length, avant);
  assert.deepEqual((await route.appel('GET')).corps, fin, 'le dernier état reste lisible');

  assert.equal((await route.appel('POST', {})).statut, 202);
  assert.deepEqual((await route.appel('GET')).corps, { en_cours: true, resultat: null, erreur: null }, 'un nouveau lancement efface l’ancien résultat');
  await laFin(route);
});

test('tâche de fond : un second lancement pendant l’action reçoit 409 ; les refus de corps et de base restent immédiats', async () => {
  const m = await apresLaChaine();
  const route = laRoute(m.base);
  assert.equal((await route.appel('POST', { reprendre: 'oui' })).statut, 400);
  assert.equal(tacheDeFond.etatDeLAncrage().en_cours, false, 'un corps refusé ne lance rien');
  assert.equal((await laRoute(() => null).appel('POST', {})).statut, 503);
  assert.equal(tacheDeFond.etatDeLAncrage().en_cours, false, 'sans base, rien ne se lance');

  assert.equal((await route.appel('POST', {})).statut, 202);
  const second = await route.appel('POST', {});
  assert.equal(second.statut, 409, JSON.stringify(second.corps));
  assert.equal(typeof second.corps.erreur, 'string');
  assert.equal((await laFin(route)).erreur, null, 'le premier lancement n’a pas été dérangé');
});

test('tâche de fond : une erreur de l’enchaînement se lit dans `erreur` et ne devient jamais un rejet non traité', async () => {
  const rejets = [];
  const surRejet = (e) => rejets.push(e);
  process.on('unhandledRejection', surRejet);
  try {
    // une erreur du service : son statut et son message
    const m = await apresLaChaine();
    let base = m.db;
    const route = laRoute(() => base);
    assert.equal((await route.appel('POST', {})).statut, 202);
    base = null;
    const refus = await laFin(route);
    assert.equal(refus.resultat, null);
    assert.equal(refus.erreur.statut, 503);
    assert.equal(typeof refus.erreur.message, 'string');

    // une erreur imprévue : 500, un message sans détail interne, le détail au journal
    const casse = await apresLaChaine();
    const routeCassee = laRoute(casse.base);
    assert.equal((await routeCassee.appel('POST', {})).statut, 202);
    casse.db.close();
    const panne = await laFin(routeCassee);
    assert.equal(panne.resultat, null);
    assert.equal(panne.erreur.statut, 500);
    assert.doesNotMatch(panne.erreur.message, /database|not open/i);
    assert.ok(routeCassee.journal.some((l) => /not open/i.test(l)), JSON.stringify(routeCassee.journal));

    // un rappel de fin qui lève ne casse rien non plus
    const encore = await apresLaChaine();
    tacheDeFond.lancerLAncrage(encore.base, OUVERT, () => {
      throw new Error('rappel en panne');
    });
    const finale = await laFin(laRoute(encore.base));
    assert.equal(finale.erreur, null);
    await new Promise(setImmediate);
    assert.deepEqual(rejets, []);
  } finally {
    process.off('unhandledRejection', surRejet);
  }
});

test('tâche de fond, avec la clé de dépôt par la route : 202, puis un résultat dont les lots sont appliqués (R291, R309)', async () => {
  const m = nouvelle();
  const route = laRoute(m.base, AVEC_LA_CLE);
  const lance = await route.appel('POST', {});
  assert.equal(lance.statut, 202, JSON.stringify(lance.corps));
  const { resultat, erreur } = await laFin(route);
  assert.equal(erreur, null, JSON.stringify(erreur));
  assert.equal(resultat.arret, null, resultat.arret?.motif);
  assert.equal(resultat.suite, false);
  assert.ok(resultat.lots.length > 1, 'plusieurs lots enchaînés');
  assert.deepEqual(resultat.lots.map((l) => l.etat), resultat.lots.map(() => 'applique'));
  for (const id of m.monde.capacites) assert.notEqual(ancre(m, 'page', id), null, id);
});

test('tâche de fond : le gel posé après un lot arrête la suite sans rien écrire de plus ; relancée une fois le gel levé, l’action reprend ce qui manque (R309)', async () => {
  const m = nouvelle();
  let leve = false;
  const appliques = () => lotsR309(m).filter((l) => l.etat === 'applique').length;
  const gel = { refus: (methode) => (methode === 'POST' && !leve && appliques() >= 1 ? { statut: 503, corps: { erreur: 'écritures gelées' }, entetes: {} } : null) };
  const route = laRoute(m.base, { ...AVEC_LA_CLE, gel });

  assert.equal((await route.appel('POST', {})).statut, 202);
  const arrete = await laFin(route);
  assert.equal(arrete.erreur, null, JSON.stringify(arrete.erreur));
  assert.equal(arrete.resultat.lots.length, 1, 'le lot en cours va au bout');
  assert.equal(lotsR309(m).length, 1, 'le deuxième lot n’est pas déposé');
  assert.ok(tacheDeFond.MOTIF_DU_GEL);
  assert.equal(arrete.resultat.arret.motif, tacheDeFond.MOTIF_DU_GEL);
  assert.equal(typeof arrete.resultat.arret.titre, 'string');
  assert.notEqual(arrete.resultat.arret.titre, arrete.resultat.lots[0].titre, 'l’arrêt nomme le lot qui n’est pas parti');
  assert.equal(arrete.resultat.suite, true);
  assert.equal((await route.appel('POST', {})).statut, 503, 'tant que le gel tient, rien ne se relance');

  leve = true;
  assert.equal((await route.appel('POST', {})).statut, 202);
  const repris = await laFin(route);
  assert.equal(repris.erreur, null, JSON.stringify(repris.erreur));
  assert.equal(repris.resultat.arret, null, repris.resultat.arret?.motif);
  assert.equal(repris.resultat.suite, false);
  assert.ok(repris.resultat.lots.length >= 1, 'ce qui manquait est déposé');
  assert.deepEqual(lotsR309(m).map((l) => l.etat), lotsR309(m).map(() => 'applique'));
  for (const id of m.monde.capacites) assert.notEqual(ancre(m, 'page', id), null, id);
  for (const id of m.monde.sorts) assert.notEqual(ancre(m, 'sort', id), null, id);
});

test('tâche de fond : un service qui redémarre ne connaît aucun état', async () => {
  const neuf = await import('../serveur/edition-ancrage-lots.mjs?redemarrage');
  assert.deepEqual(neuf.etatDeLAncrage(), AU_REPOS);
});
