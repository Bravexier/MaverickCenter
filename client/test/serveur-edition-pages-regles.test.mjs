// Créer et supprimer une page des Règles sur le site de dev (serveur/edition-plan.mjs, ENTITES.page_des_regles ; lot de l'édition des menus et des
// pages, demande du propriétaire « En mode Edition il faut prévoir aussi de pouvoir ajouter / supprimer une page », réponses « Pages des Règles »,
// « Titre, onglet, résumé », « Oui » pour remplir une entrée « bientôt », « Refus si citée, puis 404 », pages protégées) :
//   - création : titre, onglet et résumé obligatoires ; corps « À compléter. », brouillon, famille docs, provenance « Site de dev › … » ; adresse tirée du
//     titre, figée ; titre déjà pris : 409 ; identifiant déjà employé ou réservé : suffixé ; entrée en fin de menu, ou à la place d'une entrée « bientôt » ;
//   - le résumé d'une page du guide se modifie (pas celui du Codex) ;
//   - suppression : 404, 400, 409 protégée (raisons), 409 citée (citations ; une page d'exemple ne bloque pas) ; l'entrée de menu, puis la page ;
//   - rapatriement : le journal rejoué sur data/rows (npm run db:appliquer-edition), puis db:pages-check (tools/db/pages_md.py) et le plan strict du build
//     (lib/livres.mjs#verifierLePlan).
// Chaque test a sa copie de la base vivante et lit l'état avant d'écrire.
//   node --test test/serveur-edition-pages-regles.test.mjs
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { appliquerJournal } from '../scripts/db-appliquer-edition.mjs';
import { traiter } from '../serveur/api.mjs';
import { ouvrirBaseVivante, preparerBaseVivante } from '../serveur/base-vivante.mjs';
import { A_COMPLETER, ErreurEdition, FAMILLE_DES_PAGES_DU_SITE, supprimerPage } from '../serveur/edition.mjs';
import { journalExporte, nouveauLot, ouvrirLot } from '../serveur/edition-journal.mjs';
import { cheminBase } from '../src/lib/donnees.mjs';
import { ENTITES } from '../src/lib/edition-modele.mjs';
import { installerLePlan, NOMS_RESERVES, PAGES_SUPPRIMEES, verifierLePlan } from '../src/lib/livres.mjs';
import { emettrePage, lirePages } from '../src/lib/pages-db.mjs';
import { cheminDePage } from '../src/lib/metiers.mjs';
import { chargerPlanDesRegles } from '../src/lib/plan-des-regles-db.mjs';
import { normalize } from '../src/lib/text.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';

const RACINE = fileURLToPath(new URL('../../', import.meta.url));
const ROWS = join(RACINE, 'data', 'rows');
const sansPython = spawnSync('python3', ['--version']).error ? 'python3 absent' : false;
const racine = dossierTemporaire('edition-pages-regles');
let compteur = 0;

/** Une base vivante neuve et le service qui l'écrit (instant des lots : une seconde de plus à chacun). */
function nouvelle() {
  const db = ouvrirBaseVivante(preparerBaseVivante({ regles: cheminBase({ sansExemples: false }), dossier: join(racine, `b${(compteur += 1)}`) }).chemin);
  const service = { base: () => db, etat: () => ({}), edition: true };
  const appel = (methode, chemin, corps) => traiter({ methode, chemin, entetes: { 'content-type': 'application/json' }, corps: corps && JSON.stringify(corps) }, service);
  const lot = (operations) => appel('POST', '/api/edition/', { page: 'regles/', operations });
  return { db, appel, lot };
}
const ok = (r) => {
  assert.equal(r.statut, 200, JSON.stringify(r.corps));
  return r.corps;
};
/** Un titre dont aucune page ne porte la clé (titre, slug, alias), ni le journal ou l'historique ne connaît l'identifiant. */
function titreLibre(db, base) {
  for (let i = 1; ; i += 1) {
    const titre = i === 1 ? base : `${base} ${i}`;
    const cle = normalize(titre);
    if (!db.prepare('SELECT 1 FROM cle_page WHERE cle = ?').get(cle)
      && !db.prepare("SELECT 1 FROM historique_modification WHERE table_nom = 'page' AND json_extract(cle, '$.id') LIKE ?").get(`guide/${cle}%`)) return titre;
  }
}
const creer = (lot, valeurs) => lot([{ op: 'creer', entite: 'page_des_regles', valeurs }]);
const entreeDe = (db, id) => db.prepare('SELECT * FROM regles_onglet_entree WHERE page_id = ?').get(id);
const finDuMenu = (db, onglet) => db.prepare('SELECT max(rang) AS m FROM regles_onglet_entree WHERE onglet_id = ?').get(onglet).m;

test('l’entité page_des_regles : titre, onglet et résumé obligatoires, une entrée « bientôt » facultative ; suppression permise', () => {
  const e = ENTITES.page_des_regles;
  assert.equal(e.table, 'page');
  assert.equal(e.suppression, true);
  assert.deepEqual(Object.entries(e.champs).filter(([, c]) => c.requis).map(([n]) => n), ['titre', 'onglet_id', 'resume']);
  assert.equal(e.champs.onglet_id.liste, 'onglets');
  assert.equal(FAMILLE_DES_PAGES_DU_SITE.guide, 'docs', 'la famille des pages du guide, comme tools/db/pages_md.py');
});

test('créer une page des Règles : corps « À compléter. », brouillon, famille docs, provenance ; adresse tirée du titre ; en fin du menu ; refus 400 et 409', () => {
  const { db, lot } = nouvelle();
  const titre = titreLibre(db, 'Page d’essai des Règles');
  const fin = finDuMenu(db, 'combats');
  const r = ok(creer(lot, { titre, onglet_id: 'combats', resume: 'Un résumé d’essai.' }));
  const id = `guide/${normalize(titre)}`;
  assert.deepEqual(r.crees, [{ entite: 'page_des_regles', id, operation: 0 }]);
  const page = db.prepare('SELECT * FROM page WHERE id = ?').get(id);
  assert.deepEqual([page.type, page.slug, page.titre, page.titre_cle, page.resume, page.corps_md, page.statut, page.origine],
    ['guide', normalize(titre), titre, normalize(titre), 'Un résumé d’essai.', `${A_COMPLETER}\n`, 'draft', 'docs']);
  assert.match(page.source_ref, /^Site de dev › édition du \d{4}-\d{2}-\d{2}$/);
  assert.equal(db.prepare('SELECT s.texte FROM page_source ps JOIN source s ON s.id = ps.source_id WHERE ps.page_id = ?').get(id).texte, page.source_ref);
  assert.deepEqual({ ...entreeDe(db, id) }, { id: `page:${id}`, onglet_id: 'combats', rang: fin + 1, page_id: id, libelle: null, adresse: null });
  assert.deepEqual(db.prepare('SELECT table_nom, operation FROM modification WHERE lot_id = ? ORDER BY rang').all(r.lot).map((m) => `${m.table_nom} ${m.operation}`).filter((m) => !m.startsWith('source ')),
    ['page inserer', 'page_source inserer', 'regles_onglet_entree inserer'], 'un lot : la page, sa source, son entrée');

  const nombre = db.prepare('SELECT count(*) AS n FROM modification').get().n;
  const refus = [
    [{ onglet_id: 'combats', resume: 'x' }, 400, /« Titre » obligatoire/],
    [{ titre: titreLibre(db, 'Sans onglet'), resume: 'x' }, 400, /« Onglet » obligatoire/],
    [{ titre: titreLibre(db, 'Sans résumé'), onglet_id: 'combats' }, 400, /« Résumé » obligatoire/],
    [{ titre: titreLibre(db, 'Onglet inconnu'), onglet_id: 'inconnu', resume: 'x' }, 400, /onglet inconnu/],
    [{ titre: '« ! »', onglet_id: 'combats', resume: 'x' }, 400, /au moins une lettre/],
    [{ titre, onglet_id: 'exploration', resume: 'x' }, 409, /déjà le nom de la page/],
    // le titre d'une autre page, à la casse et aux accents près (cle_page : titre, slug, alias)
    [{ titre: db.prepare("SELECT titre FROM page WHERE id = 'guide/les-degats'").get().titre.toUpperCase(), onglet_id: 'combats', resume: 'x' }, 409, /guide\/les-degats/],
    [{ titre: titreLibre(db, 'Bientôt inconnu'), onglet_id: 'combats', resume: 'x', bientot: 'bientot:inconnu' }, 404, /introuvable/],
  ];
  for (const [valeurs, statut, message] of refus) {
    const rr = creer(lot, valeurs);
    assert.equal(rr.statut, statut, `${JSON.stringify(valeurs)} : ${JSON.stringify(rr.corps)}`);
    assert.match(rr.corps.erreur, message);
  }
  assert.equal(db.prepare('SELECT count(*) AS n FROM modification').get().n, nombre, 'rien d’écrit');
});

test('créer : un identifiant déjà employé (journal, page supprimée par le plan, nom réservé, id d’onglet) est suffixé -2, -3 ; l’adresse reste figée au renommage', () => {
  const { db, lot } = nouvelle();
  const cas = [
    // une page supprimée sans renvoi (R184 (9)) : son adresse donne la 404, elle ne resservira pas
    PAGES_SUPPRIMEES.map((id) => id.slice('guide/'.length)).find((slug) => !db.prepare('SELECT 1 FROM cle_page WHERE cle = ?').get(slug)),
    // un nom réservé (/regles/artisanat/) et l'id d'un onglet (/regles/combats/)
    NOMS_RESERVES.find((slug) => !db.prepare('SELECT 1 FROM cle_page WHERE cle = ?').get(slug)),
    db.prepare('SELECT id FROM regles_onglet ORDER BY ordre').all().map((o) => o.id).find((slug) => !db.prepare('SELECT 1 FROM cle_page WHERE cle = ?').get(slug)),
  ];
  assert.ok(cas.every(Boolean), JSON.stringify(cas));
  for (const slug of cas) {
    const titre = slug.split('-').map((m, i) => (i ? m : m[0].toUpperCase() + m.slice(1))).join(' ');
    assert.equal(normalize(titre), slug);
    const id = ok(creer(lot, { titre, onglet_id: 'exploration', resume: 'Essai.' })).crees[0].id;
    assert.match(id, new RegExp(`^guide/${slug}-\\d+$`), titre);
    // retirée, la page laisse son identifiant au journal : la recréer prend le suffixe suivant
    ok(lot([{ op: 'supprimer', entite: 'page_des_regles', cle: { id } }]));
    const deNouveau = ok(creer(lot, { titre, onglet_id: 'exploration', resume: 'Essai.' })).crees[0].id;
    assert.notEqual(deNouveau, id, `${titre} : un identifiant jamais redonné`);
  }
  // renommée, la page garde son adresse ; l'ancien titre, qui est son slug, la nomme toujours (cle_page)
  const titre = titreLibre(db, 'Page renommée d’essai');
  const id = ok(creer(lot, { titre, onglet_id: 'exploration', resume: 'Essai.' })).crees[0].id;
  ok(lot([{ op: 'modifier', table: 'page', cle: { id }, valeurs: { titre: `${titre} bis` } }]));
  assert.equal(db.prepare('SELECT slug FROM page WHERE id = ?').get(id).slug, normalize(titre));
  assert.equal(db.prepare('SELECT page_id FROM cle_page WHERE cle = ?').get(normalize(titre)).page_id, id);
});

test('remplir une entrée « bientôt » : dans le même lot, l’entrée retirée et la page à sa place (même onglet, même rang) ; son libellé pour titre', () => {
  const { db, lot } = nouvelle();
  const libelle = titreLibre(db, 'Une puce à venir');
  // une entrée « bientôt » d'essai, posée dans la copie (aucune aujourd'hui : R184 (1)), au milieu du menu
  db.prepare("INSERT INTO regles_onglet_entree (id, onglet_id, rang, page_id, libelle, adresse) VALUES ('bientot:essai', 'mecaniques-generales', 2, NULL, ?, NULL)").run(libelle);
  const refus = [
    [{ titre: `${libelle} autre`, onglet_id: 'mecaniques-generales', resume: 'x', bientot: 'bientot:essai' }, 400, /prend son libellé pour titre/],
    [{ titre: libelle, onglet_id: 'combats', resume: 'x', bientot: 'bientot:essai' }, 400, /dans un autre onglet/],
    [{ titre: libelle, onglet_id: 'mecaniques-generales', resume: 'x', bientot: 'lien:regles/artisanat' }, 404, /« bientôt » introuvable/],
  ];
  for (const [valeurs, statut, message] of refus) {
    const rr = creer(lot, valeurs);
    assert.equal(rr.statut, statut, JSON.stringify(rr.corps));
    assert.match(rr.corps.erreur, message);
  }
  const r = ok(creer(lot, { titre: libelle, onglet_id: 'mecaniques-generales', resume: 'Elle remplit la puce.', bientot: 'bientot:essai' }));
  const id = r.crees[0].id;
  assert.equal(db.prepare("SELECT count(*) AS n FROM regles_onglet_entree WHERE id = 'bientot:essai'").get().n, 0);
  assert.deepEqual([entreeDe(db, id).onglet_id, entreeDe(db, id).rang], ['mecaniques-generales', 2]);
  const notees = db.prepare("SELECT cle, operation FROM modification WHERE lot_id = ? AND table_nom = 'regles_onglet_entree' ORDER BY rang").all(r.lot);
  assert.deepEqual(notees.map((m) => [JSON.parse(m.cle).id, m.operation]), [['bientot:essai', 'supprimer'], [`page:${id}`, 'inserer']]);
});

test('le résumé d’une page du guide se modifie ; pas celui d’une page du Codex', () => {
  const { db, lot } = nouvelle();
  const guide = db.prepare("SELECT id, resume FROM page WHERE type = 'guide' AND statut <> 'example' ORDER BY id").get();
  ok(lot([{ op: 'modifier', table: 'page', cle: { id: guide.id }, valeurs: { resume: 'Un autre résumé.' } }]));
  assert.equal(db.prepare('SELECT resume FROM page WHERE id = ?').get(guide.id).resume, 'Un autre résumé.');
  assert.equal(lot([{ op: 'modifier', table: 'page', cle: { id: guide.id }, valeurs: { resume: '' } }]).statut, 400, 'obligatoire');
  const codex = db.prepare("SELECT p.id FROM page p JOIN page_source ps ON ps.page_id = p.id AND ps.ordre = 0 JOIN source s ON s.id = ps.source_id WHERE p.type = 'lore' AND s.texte = 'Google Doc « CODEX Maverick »' ORDER BY p.id").get();
  const r = lot([{ op: 'modifier', table: 'page', cle: { id: codex.id }, valeurs: { resume: 'Non.' } }]);
  assert.equal(r.statut, 400);
  assert.match(r.corps.erreur, /le résumé ne se modifie que pour une page du guide/);
});

test('supprimer une page des Règles : 404, 400 hors des onglets, 409 protégée (raisons) ou citée (citations) avant écriture ; une citation d’exemple ne bloque pas', () => {
  const { db, lot } = nouvelle();
  const supprimer = (id) => lot([{ op: 'supprimer', entite: 'page_des_regles', cle: { id } }]);
  const nombre = () => db.prepare('SELECT count(*) AS n FROM modification').get().n;
  const avant = nombre();
  assert.equal(supprimer('guide/inconnue').statut, 404);
  assert.equal(supprimer('guide/bienvenue').statut, 400, 'Découvrir');
  assert.equal(supprimer('races/humain').statut, 400);
  const ouverture = db.prepare('SELECT ouverture_page_id FROM regles_onglet ORDER BY ordre').get().ouverture_page_id;
  const protegee = supprimer(ouverture);
  assert.equal(protegee.statut, 409);
  assert.ok(protegee.corps.raisons.some((r) => r.raison === 'ouverture'), JSON.stringify(protegee.corps));
  assert.equal(nombre(), avant, 'rien d’écrit');

  // une page créée, citée par une autre page créée : refusée tant que le lien reste. Depuis la migration 0096, un lien est la balise d'un mot-clé qui
  // mène à la page : le mot-clé (son adresse) et la balise la citent tous les deux
  const cible = ok(creer(lot, { titre: titreLibre(db, 'Page citée d’essai'), onglet_id: 'combats', resume: 'Citée.' })).crees[0].id;
  const titreCible = db.prepare('SELECT titre FROM page WHERE id = ?').get(cible).titre;
  const citante = ok(creer(lot, { titre: titreLibre(db, 'Page qui cite d’essai'), onglet_id: 'combats', resume: 'Cite.' })).crees[0].id;
  assert.equal(lot([{ op: 'modifier', table: 'page', cle: { id: citante }, valeurs: { corps_md: `Voir [[${titreCible}]].` } }]).statut, 400, 'aucun mot-clé ne mène à la page');
  const motCle = ok(lot([{ op: 'creer', entite: 'mot_cle', valeurs: { libelle: titreLibre(db, 'Mot-clé de la page citée'), url: `/${cheminDePage(cible)}` } }])).crees[0].id;
  ok(lot([{ op: 'modifier', table: 'page', cle: { id: citante }, valeurs: { corps_md: `Voir [[${titreCible}]].` } }]));
  assert.equal(db.prepare('SELECT corps_md FROM page WHERE id = ?').get(citante).corps_md, `Voir {{${motCle}|${titreCible}}}.\n`, 'le lien devenu la balise du mot-clé');
  const avantRefus = nombre();
  const citee = supprimer(cible);
  assert.equal(citee.statut, 409, JSON.stringify(citee.corps));
  assert.deepEqual(citee.corps.citations.map((c) => [c.table, c.cle.id, c.comment]).sort(), [['mot_cle', motCle, 'mot-cle'], ['page', citante, 'balise']]);
  assert.match(citee.corps.erreur, /citée par 2 textes \(Mot-clé « .* » \(son lien\), /);
  assert.equal(nombre(), avantRefus);
  // la balise retirée, le mot-clé mène encore à la page : refusée ; son lien retiré, seule une page d'exemple la cite encore : elle se supprime
  ok(lot([{ op: 'modifier', table: 'page', cle: { id: citante }, valeurs: { corps_md: 'Plus de lien.' } }]));
  assert.deepEqual(supprimer(cible).corps.citations.map((c) => [c.table, c.comment]), [['mot_cle', 'mot-cle']]);
  ok(lot([{ op: 'modifier', table: 'mot_cle', cle: { id: motCle }, valeurs: { url: null } }]));
  const exemple = db.prepare("SELECT id, corps_md FROM page WHERE type = 'guide' AND statut = 'example' ORDER BY id").get();
  ok(lot([{ op: 'modifier', table: 'page', cle: { id: exemple.id }, valeurs: { corps_md: `${exemple.corps_md}\nVoir [[${titreCible}]].` } }]));
  const r = ok(supprimer(cible));
  assert.equal(db.prepare('SELECT count(*) AS n FROM page WHERE id = ?').get(cible).n, 0);
  assert.equal(entreeDe(db, cible), undefined);
  const notees = db.prepare('SELECT table_nom, operation FROM modification WHERE lot_id = ? ORDER BY rang').all(r.lot).map((m) => `${m.table_nom} ${m.operation}`);
  assert.equal(notees[0], 'regles_onglet_entree supprimer', 'l’entrée de menu d’abord, notée au journal');
  assert.ok(notees.includes('page supprimer') && notees.includes('page_source supprimer'), notees.join(', '));
});

test('supprimerPage ne contourne pas la protection : une page `guide/…` protégée est refusée (409) même appelée seule ; rien d’écrit', () => {
  const { db } = nouvelle();
  const protegee = db.prepare('SELECT ouverture_page_id AS id FROM regles_onglet ORDER BY ordre').get().id;
  db.exec('BEGIN IMMEDIATE');
  try {
    const w = ouvrirLot(db, nouveauLot());
    assert.throws(() => supprimerPage({ db, w }, protegee), (e) => e instanceof ErreurEdition && e.statut === 409 && e.details.raisons.some((r) => r.raison === 'ouverture'));
    assert.equal(w.nombre, 0);
  } finally {
    db.exec('ROLLBACK');
  }
  assert.ok(db.prepare('SELECT 1 FROM page WHERE id = ?').get(protegee));
});

test('rapatriement : le journal rejoué sur data/rows (db:appliquer-edition), puis db:pages-check et le plan strict du build (verifierLePlan)', { skip: sansPython }, () => {
  const { db, lot } = nouvelle();
  const gardee = ok(creer(lot, { titre: titreLibre(db, 'Page rapatriée d’essai'), onglet_id: 'combats', resume: 'Rapatriée.' })).crees[0].id;
  const retiree = ok(creer(lot, { titre: titreLibre(db, 'Page retirée d’essai'), onglet_id: 'exploration', resume: 'Retirée.' })).crees[0].id;
  ok(lot([{ op: 'modifier', table: 'regles_onglet_entree', cle: { id: `page:${gardee}` }, valeurs: { onglet_id: 'exploration' } }]));
  const ordre = db.prepare("SELECT id FROM regles_onglet_entree WHERE onglet_id = 'exploration' ORDER BY rang, id").all().map((e) => e.id).reverse();
  ok(lot([{ op: 'ordonner', onglet: 'exploration', ids: ordre }]));
  ok(lot([{ op: 'supprimer', entite: 'page_des_regles', cle: { id: retiree } }]));
  const journal = journalExporte(db);
  db.close();

  const rows = join(racine, 'rapatriement', 'rows');
  cpSync(ROWS, rows, { recursive: true });
  const r = appliquerJournal(journal, { rows });
  assert.deepEqual(r.conflits, []);
  assert.equal(r.ecrit, true);
  const sortie = join(racine, 'rapatriement', 'maverick.db');
  const b = spawnSync(process.execPath, ['--no-warnings', join(RACINE, 'client', 'scripts', 'db-build.mjs'), '--out', sortie, '--rows', rows], { encoding: 'utf8' });
  assert.equal(b.status, 0, b.stderr);
  const base = new DatabaseSync(sortie, { readOnly: true });
  try {
    assert.equal(base.prepare('SELECT origine FROM page WHERE id = ?').get(gardee).origine, 'docs');
    assert.equal(base.prepare('SELECT count(*) AS n FROM page WHERE id = ?').get(retiree).n, 0);
    const ids = base.prepare("SELECT id FROM regles_onglet_entree WHERE onglet_id = 'exploration' ORDER BY rang, id").all().map((e) => e.id);
    assert.deepEqual(ids, ordre.filter((id) => id !== `page:${retiree}`), 'le menu tel que le site de dev l’a laissé');
    // le plan strict du build : chaque page du guide rangée, la page créée comprise
    installerLePlan(chargerPlanDesRegles(base));
    const entries = base.prepare('SELECT id, statut FROM page').all().map((p) => ({ id: p.id, data: { status: p.statut } }));
    assert.doesNotThrow(() => verifierLePlan(entries));
    // db:pages-check : les .md tels que db:export-pages les fabrique, relus par tools/db/pages_md.py (une page du guide créée sur le site : famille docs)
    const wiki = join(racine, 'rapatriement', 'wiki');
    for (const p of lirePages(base)) {
      mkdirSync(join(wiki, p.type), { recursive: true });
      writeFileSync(join(wiki, p.type, `${p.slug}.md`), emettrePage(p));
    }
    const check = spawnSync('python3', ['-I', join(RACINE, 'tools', 'db', 'pages_md.py'), 'check', '--rows', rows, '--wiki', wiki], { encoding: 'utf8' });
    assert.equal(check.status, 0, check.stdout + check.stderr);
    assert.match(check.stdout, /est à jour/);
  } finally {
    base.close();
  }
});
