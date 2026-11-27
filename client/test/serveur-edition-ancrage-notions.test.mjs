// « Préparer l'ancrage » et sa cinquième famille, les pages de notion (docs/chantier-pages-de-notion.md, §3 ; décisions R309 (7), R291, R268) : le lot des
// notions déposé par le vrai service après les quatre autres, sur une petite base d'essai (test/aide-ancrage.mjs) en fichier. Un seul enchaînement est joué,
// puis copié pour chaque test qui le prolonge (modèle : test/serveur-edition-ancrage.test.mjs). Noms inventés, aucune valeur de règle lue.
//   node --test test/serveur-edition-ancrage-notions.test.mjs
import assert from 'node:assert/strict';
import { copyFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { ouvrirBaseVivante } from '../serveur/base-vivante.mjs';
import { controlerLeContenu } from '../serveur/controles-du-contenu.mjs';
import { lignesAnnuleesDeLAncrage, preparerLAncrage } from '../serveur/edition-ancrage-lots.mjs';
import { annulerUneLigne, appliquer } from '../serveur/edition-lots.mjs';
import { adresseDeLaPage } from '../src/lib/adresses-db.mjs';
import { messageDeLAncrage } from '../src/lib/lots-rendu.mjs';
import { definitionDuMotCle, htmlDeLaBalise, lireUneBalise } from '../src/lib/mots-cles-balises.mjs';
import { motsClesDeLaBase } from '../src/lib/mots-cles-db.mjs';
import { ancrerUnMotCle, baseDAncrage, poserMotCle, poserPageLisible, recalculerLesCles } from './aide-ancrage.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';

const racine = dossierTemporaire('ancrage-notions');
let n = 0;
const OUVERT = { controle: { ouvertHorsEdition: true }, enArrierePlan: false };
const nomInvente = (suffixe) => `Zephyrion ${suffixe} ${process.pid}`;

/**
 * La base d'essai, en fichier : une page des Règles déjà ancrée, deux mots-clés sans élément (l'un décrit, avec un synonyme ; l'autre sans définition), un
 * mot-clé sans élément qui a déjà une adresse, et le mot-clé d'un type de sort, sans page. Les quatre catégories nouvelles manquent : le lot 1 les crée.
 */
function nouvelle() {
  const memoire = baseDAncrage();
  memoire.exec('BEGIN');
  const ancree = poserPageLisible(memoire, 'guide/zephyrion-ancre', nomInvente('ancre'));
  ancrerUnMotCle(memoire, 'page', ancree, { categories: ['Règles'] });
  const decrite = poserMotCle(memoire, { libelle: nomInvente('notion décrite'), categories: ['Règles'], synonymes: [nomInvente('autre écriture')] });
  memoire.prepare('UPDATE mot_cle SET description = ? WHERE id = ?').run('Définition d’essai.', decrite);
  const sansDefinition = poserMotCle(memoire, { libelle: nomInvente('notion nue'), categories: ['Règles'] });
  const aAdresse = poserMotCle(memoire, { libelle: nomInvente('rubrique'), url: `${adresseDeLaPage(ancree, null)}#zephyrion`, categories: ['Règles'] });
  const duType = poserMotCle(memoire, { libelle: nomInvente('type'), categories: ['Règles'] });
  memoire.prepare("UPDATE type_sort SET mot_cle_id = ? WHERE id = 'soin'").run(duType);
  // la provenance et le type des pages (clés étrangères vers `famille` et `type_page`, que le rejeu contrôle lot par lot)
  memoire.exec(`INSERT INTO famille (id, libelle, ordre) VALUES ('docs', 'Famille docs', 1); UPDATE page SET origine = 'docs';
    INSERT INTO type_page (id, libelle, singulier, salon_discord, description, ordre) SELECT type, type, type, '', '', row_number() OVER (ORDER BY type) FROM (SELECT DISTINCT type FROM page)`);
  recalculerLesCles(memoire);
  memoire.exec('COMMIT');
  const dossier = join(racine, `b${(n += 1)}`);
  mkdirSync(dossier, { recursive: true });
  const chemin = join(dossier, 'vivante.db');
  memoire.exec(`VACUUM INTO '${chemin.replaceAll("'", "''")}'`);
  memoire.close();
  const db = ouvrirBaseVivante(chemin);
  return { db, base: () => db, dossier: join(racine, `essais${n}`), chemin, monde: { decrite, sansDefinition, aAdresse, duType, notions: [decrite, sansDefinition, duType] } };
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
const pageDe = (m, motCle) => m.db.prepare('SELECT id, titre, resume FROM page WHERE mot_cle_id = ?').get(motCle);
const motCle = (m, id) => m.db.prepare('SELECT * FROM mot_cle WHERE id = ?').get(id);
/** Les opérations déposées du lot `id` (son contenu, `maverick-lot/1`). */
const operationsDuLot = (m, id) => JSON.parse(m.db.prepare('SELECT contenu FROM lot_de_changements WHERE id = ?').get(id).contenu).operations;
const lotsR309 = (m) => m.db.prepare("SELECT id, etat, lot_id, titre FROM lot_de_changements WHERE decision = 'R309' ORDER BY rowid").all();

/** Le lot appliqué qui porte l'écriture de la page `id`, et le numéro de sa ligne. */
function ligneDeLaPage(m, id) {
  for (const l of lotsR309(m)) {
    const rang = m.db.prepare("SELECT rang, cle FROM modification WHERE lot_id = ? AND table_nom = 'page' ORDER BY rang").all(l.lot_id).find((x) => JSON.parse(x.cle).id === id)?.rang;
    if (rang) return { lot: l.id, rang };
  }
  throw new Error(`aucune ligne pour la page ${id}`);
}

test('avec la clé de dépôt : le lot des notions vient en dernier, chaque page attendue existe, le reste est à trancher (R309 (7), R291)', async () => {
  const c = await laChaine();
  const { resultat: r, monde } = c;
  assert.equal(r.arret, null, r.arret?.motif);
  assert.equal(r.suite, false);
  assert.deepEqual(r.lots.map((l) => l.etat), r.lots.map(() => 'applique'));
  assert.equal(r.comptes.notions, monde.notions.length, 'les comptes décrivent tout l’ancrage, dès le premier calcul');
  const dernier = operationsDuLot(c, r.lots.at(-1).id);
  assert.ok(dernier.every((o) => o.ancrage?.notion === true), 'le dernier lot appliqué est celui des notions');
  assert.deepEqual(dernier.map((o) => o.apres.mot_cle_id).sort((a, b) => a - b), [...monde.notions].sort((a, b) => a - b));
  assert.ok(r.lots.slice(0, -1).every((l) => operationsDuLot(c, l.id).every((o) => !o.ancrage?.notion)), 'les pages de notion viennent après les autres lots');
  for (const id of monde.notions) {
    const page = pageDe(c, id);
    const m = motCle(c, id);
    assert.ok(page, `#${id}`);
    assert.equal(page.titre, m.libelle);
    assert.equal(page.resume, null);
    assert.equal(m.url, adresseDeLaPage(page.id, null), 'l’adresse du mot-clé est celle de sa page');
  }
  assert.equal(pageDe(c, monde.aAdresse), undefined);
  assert.ok(r.a_trancher.some((x) => x.table === 'mot_cle' && x.id === monde.aAdresse), JSON.stringify(r.a_trancher));
  assert.deepEqual(controlerLeContenu(c.db).problemes.filter((p) => !c.avant.has(p)), []);
});

test('rejouable : un second lancement ne dépose rien', async () => {
  const m = await apresLaChaine();
  const avant = lotsR309(m).length;
  const r = await lancer(m);
  assert.deepEqual([r.lots, r.arret, r.suite], [[], null, false]);
  assert.equal(lotsR309(m).length, avant);
});

test('une page de notion annulée : `notion:<id>` écartée, pas `nom:<id>` ; le lancement suivant la liste sans la refaire ; « Reprendre » la redépose', async () => {
  const m = await apresLaChaine();
  const k = m.monde.sansDefinition;
  const { id } = pageDe(m, k);
  const { lot, rang } = ligneDeLaPage(m, id);
  annulerUneLigne(m.db, lot, rang);
  assert.equal(pageDe(m, k), undefined);
  assert.equal(motCle(m, k).url, null, 'le mot-clé redevient sans adresse');
  const cles = lignesAnnuleesDeLAncrage(m.db);
  assert.ok(cles.has(`notion:${k}`), [...cles].join(', '));
  assert.ok(!cles.has(`nom:${k}`), [...cles].join(', '));

  const r = await lancer(m);
  assert.deepEqual(r.lots, [], 'rien n’est redéposé');
  assert.ok(r.ecartees.includes(`notion:${k}`));
  assert.equal(pageDe(m, k), undefined);
  const message = messageDeLAncrage(r);
  assert.ok(!message.includes('notion:'), message);
  assert.ok(message.includes(String(k)), message);

  const repris = await lancer(m, { reprendre: true });
  assert.equal(repris.lots.length, 1);
  assert.deepEqual(repris.ecartees, []);
  assert.ok(pageDe(m, k));
  assert.ok(!lignesAnnuleesDeLAncrage(m.db).has(`notion:${k}`));
});

test('sans clé de dépôt : le lot des notions est une proposition, rien n’est écrit', async () => {
  const m = nouvelle();
  const premier = await preparerLAncrage(m.base, { dossier: m.dossier, ...OUVERT });
  assert.equal(premier.arret, null, premier.arret?.motif);
  appliquer(m.db, premier.lots[0].id, {});
  const r = await preparerLAncrage(m.base, { dossier: m.dossier, ...OUVERT });
  assert.equal(r.arret, null, r.arret?.motif);
  assert.equal(r.lots.length, 1);
  assert.equal(r.lots[0].etat, 'propose');
  assert.ok(operationsDuLot(m, r.lots[0].id).every((o) => o.ancrage?.notion === true));
  for (const id of m.monde.notions) assert.equal(pageDe(m, id), undefined, `#${id} : rien n’entre sans le clic`);
});

test('une catégorie nouvelle annulée au lot 1 : l’enchaînement s’arrête en disant pourquoi, avant les pages de notion', async () => {
  const m = nouvelle();
  const premier = await preparerLAncrage(m.base, { dossier: m.dossier, ...OUVERT });
  appliquer(m.db, premier.lots[0].id, {});
  const [lot] = lotsR309(m);
  const ligne = m.db.prepare("SELECT rang, cle FROM modification WHERE lot_id = ? AND table_nom = 'categorie_mot_cle' ORDER BY rang LIMIT 1").get(lot.lot_id);
  const { libelle } = m.db.prepare('SELECT libelle FROM categorie_mot_cle WHERE id = ?').get(JSON.parse(ligne.cle).id);
  annulerUneLigne(m.db, lot.id, ligne.rang);
  assert.ok(lignesAnnuleesDeLAncrage(m.db).has(`categorie:${libelle}`));

  const r = await lancer(m);
  assert.deepEqual(r.lots, []);
  assert.ok(r.comptes.notions > 0, 'des pages de notion restent à faire');
  assert.ok(r.arret, 'l’arrêt est dit');
  assert.ok(r.arret.titre);
  assert.ok(r.arret.motif.includes(libelle), r.arret.motif);
  assert.equal(r.suite, false, 'relancer seul n’y change rien');
  assert.ok(r.ecartees.includes(`categorie:${libelle}`));
  for (const id of m.monde.notions) assert.equal(pageDe(m, id), undefined, `#${id}`);
  // « Reprendre » recrée la catégorie et va jusqu'aux pages de notion
  const repris = await lancer(m, { reprendre: true });
  assert.equal(repris.arret, null, repris.arret?.motif);
  for (const id of m.monde.notions) assert.ok(pageDe(m, id), `#${id}`);
});

test('R268 : après la mise en place, le mot-clé sans définition dont la page n’a pas de résumé n’a pas d’infobulle', async () => {
  const m = await apresLaChaine();
  const vocabulaire = motsClesDeLaBase(m.db);
  const nu = vocabulaire.find((x) => x.id === m.monde.sansDefinition);
  assert.equal(definitionDuMotCle(nu), null);
  const rendu = htmlDeLaBalise(lireUneBalise(`{{${nu.cle}}}`), vocabulaire);
  assert.equal(rendu.id, null);
  assert.doesNotMatch(rendu.html, /data-bulle/);
  assert.match(rendu.html, /href=/, 'sa balise mène à sa page');
  // le mot-clé décrit garde la sienne
  const decrit = vocabulaire.find((x) => x.id === m.monde.decrite);
  assert.equal(htmlDeLaBalise(lireUneBalise(`{{${decrit.cle}}}`), vocabulaire).id, decrit.id);
});
