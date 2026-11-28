// Les entrées du menu résolues d'après la base (lib/menu-db.mjs ; refonte du menu, lot 1 ; réponses du propriétaire du 2026-11-27 : « Tout, libellé
// compris », « Lien direct en attendant », « Nom de l'arborescence », onglets lus dans regles_onglet, R319). Le fonctionnement : le libellé, l'adresse et
// l'habillage suivent le mot-clé ; le repli sans mot-clé ; le titre d'un onglet lu en base ; le lien rendu comme une balise d'un texte. Sur une base en
// mémoire aux tables créées par le texte même de data/schema.sql : aucune valeur de la base du site n'est figée ici.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { adresseDeLOnglet, donneesDuMenu, htmlDeLEntree, lireLeMenu, menuDuSite, resoudreLesEntrees } from '../src/lib/menu-db.mjs';
import { htmlAvecMotsCles, vocabulaireDesMotsCles } from '../src/lib/mots-cles-balises.mjs';
import { motsClesDeLaBase } from '../src/lib/mots-cles-db.mjs';
import { poserUnMotCle } from './aide-mots-cles.mjs';

const SCHEMA = readFileSync(new URL('../../data/schema.sql', import.meta.url), 'utf8');
const creation = (table) => {
  const m = SCHEMA.match(new RegExp(`^CREATE TABLE ${table} \\([\\s\\S]*?^\\) STRICT;`, 'm'));
  assert.ok(m, `${table} : dans data/schema.sql`);
  return m[0];
};

// ids d'essai (aucun rapport avec ceux du site)
const [A, B, SANS_URL, ABSENT] = [9001, 9002, 9003, 9999];

/**
 * Une base en mémoire : mot_cle et son élément, le repère (A : adresse, couleur, définition ; B : adresse seule ; SANS_URL : sans adresse ; depuis la
 * migration 0136, le nom et le reste se lisent sur l'élément), et regles_onglet (deux onglets).
 */
function baseDuMenu({ onglets = true } = {}) {
  const db = new DatabaseSync(':memory:');
  // les clés étrangères vers des tables que le test ne lit pas (monnaie, regles_onglet_entree) ne sont pas contrôlées
  db.exec('PRAGMA foreign_keys = OFF');
  db.exec(creation('mot_cle'));
  db.exec(creation('repere'));
  poserUnMotCle(db, { id: A, libelle: 'Alpha d’essai', cle: 'alpha-d-essai', description: 'La définition d’alpha.', couleur: 'partie:decouvrir', url: '/alpha/page/#ancre' });
  poserUnMotCle(db, { id: B, libelle: 'Bravo d’essai', cle: 'bravo-d-essai', url: '/bravo/' });
  poserUnMotCle(db, { id: SANS_URL, libelle: 'Sans adresse d’essai', cle: 'sans-adresse-d-essai', couleur: 'partie:decouvrir' });
  if (onglets) {
    db.exec(creation('regles_onglet'));
    const o = db.prepare('INSERT INTO regles_onglet (id, titre, ordre, ouverture_page_id) VALUES (?, ?, ?, ?)');
    o.run('premier-onglet', 'Titre du premier', 2, 'guide/a');
    o.run('second-onglet', 'Titre du second', 1, 'guide/b');
  }
  return db;
}

test('le libellé, l’adresse et l’habillage suivent le mot-clé ; `libelleArbo` garde le libellé écrit', () => {
  const db = baseDuMenu();
  const [suit, garde] = lireLeMenu(db, [
    { label: 'Écrit A', path: 'repli/a/', motCle: A },
    { label: 'Écrit B', path: 'repli/b/', motCle: B, libelleArbo: true },
  ]);
  assert.equal(suit.libelle, 'Alpha d’essai');
  assert.equal(suit.href, 'alpha/page/#ancre', 'l’adresse du mot-clé, sans barre initiale ni préfixe, ancre gardée');
  assert.equal(suit.bientot, false);
  assert.equal(suit.motCle.id, A);
  assert.equal(suit.motCle.cle, 'alpha-d-essai');
  assert.equal(suit.motCle.couleur, 'partie:decouvrir');
  assert.equal(suit.motCle.classe, 'couleur-partie-decouvrir');
  assert.equal(suit.motCle.description, 'La définition d’alpha.');
  assert.equal(suit.motCle.bulle, 'mot-cle-alpha-d-essai');
  assert.equal(garde.libelle, 'Écrit B', 'le libellé de l’arborescence l’emporte');
  assert.equal(garde.href, 'bravo/', 'mais l’adresse vient du mot-clé');
  assert.equal(garde.motCle.libelle, 'Bravo d’essai');
  assert.equal(garde.motCle.bulle, null, 'sans définition, pas de bulle');
});

test('renommer le mot-clé renomme l’entrée ; changer son adresse la déplace (lu à chaque appel)', () => {
  const db = baseDuMenu();
  const entrees = [{ label: 'Écrit', path: 'repli/', motCle: B }];
  // le nom et l'adresse se changent sur l'élément du mot-clé (ici son repère)
  db.prepare('UPDATE repere SET nom = ?, adresse = ? WHERE mot_cle_id = ?').run('Autre nom', '/ailleurs/', B);
  const [e] = lireLeMenu(db, entrees);
  assert.equal(e.libelle, 'Autre nom');
  assert.equal(e.href, 'ailleurs/');
});

test('« Lien direct en attendant » : sans mot-clé, le chemin écrit ; sans chemin, « bientôt »', () => {
  const [lien, bientot] = lireLeMenu(baseDuMenu(), [{ label: 'Direct', path: 'direct/' }, { label: 'Pas encore' }]);
  assert.deepEqual([lien.href, lien.libelle, lien.bientot, lien.motCle], ['direct/', 'Direct', false, null]);
  assert.deepEqual([bientot.href, bientot.libelle, bientot.bientot, bientot.motCle], [null, 'Pas encore', true, null]);
});

test('un mot-clé absent ou sans adresse ne lève rien : repli sur le chemin, ou « bientôt »', () => {
  const [absent, absentSansChemin, sansUrl, sansUrlSansChemin] = lireLeMenu(baseDuMenu(), [
    { label: 'Absent', path: 'repli/absent/', motCle: ABSENT },
    { label: 'Absent sans chemin', motCle: ABSENT },
    { label: 'Écrit', path: 'repli/sans-url/', motCle: SANS_URL },
    { label: 'Écrit seul', motCle: SANS_URL },
  ]);
  assert.deepEqual([absent.href, absent.libelle, absent.motCle], ['repli/absent/', 'Absent', null]);
  assert.deepEqual([absentSansChemin.href, absentSansChemin.bientot, absentSansChemin.motCle], [null, true, null]);
  // le mot-clé existe sans adresse : l’adresse se replie sur le chemin, le libellé et l’habillage restent ceux du mot-clé
  assert.deepEqual([sansUrl.href, sansUrl.bientot, sansUrl.libelle, sansUrl.motCle?.id], ['repli/sans-url/', false, 'Sans adresse d’essai', SANS_URL]);
  assert.equal(sansUrl.motCle.url, null);
  assert.equal(sansUrlSansChemin.href, null);
  assert.equal(sansUrlSansChemin.bientot, true);
  // un id qui n’en est pas un
  const [mal] = lireLeMenu(baseDuMenu(), [{ label: 'Mal écrit', path: 'repli/', motCle: '9001' }]);
  assert.deepEqual([mal.motCle, mal.href], [null, 'repli/']);
});

test('R319 : le libellé d’un onglet est lu dans regles_onglet.titre, son adresse composée une seule fois', () => {
  const db = baseDuMenu();
  const entrees = [{ label: 'Écrit', onglet: 'premier-onglet' }, { label: 'Autre écrit', onglet: 'second-onglet', path: 'repli/' }];
  const [premier, second] = lireLeMenu(db, entrees);
  assert.equal(premier.libelle, 'Titre du premier');
  assert.equal(premier.href, adresseDeLOnglet({ id: 'premier-onglet' }));
  assert.equal(second.libelle, 'Titre du second');
  assert.equal(second.href, adresseDeLOnglet({ id: 'second-onglet' }));
  // le titre modifié sur le site de dev : le libellé suit, l’adresse reste
  db.prepare('UPDATE regles_onglet SET titre = ? WHERE id = ?').run('Nouveau titre', 'premier-onglet');
  const [renomme] = lireLeMenu(db, entrees);
  assert.equal(renomme.libelle, 'Nouveau titre');
  assert.equal(renomme.href, premier.href);
  // une adresse propre à l’onglet (un lot à part) est lue telle quelle, jamais recopiée
  assert.equal(adresseDeLOnglet({ id: 'premier-onglet', adresse: 'regles/nouveau-titre/' }), 'regles/nouveau-titre/');
  const [propre] = resoudreLesEntrees(entrees, { onglets: [{ id: 'premier-onglet', titre: 'T', adresse: 'regles/t/' }] });
  assert.equal(propre.href, 'regles/t/');
  // un onglet inconnu : le libellé et le chemin écrits (jamais d’erreur) ; une base sans la table : de même
  const [inconnu] = lireLeMenu(db, [{ label: 'Écrit', path: 'repli/', onglet: 'absent' }]);
  assert.deepEqual([inconnu.libelle, inconnu.href], ['Écrit', 'repli/']);
  const sansTable = lireLeMenu(baseDuMenu({ onglets: false }), [{ label: 'Écrit', onglet: 'premier-onglet' }]);
  assert.deepEqual([sansTable[0].libelle, sansTable[0].bientot], ['Écrit', true]);
  assert.deepEqual(donneesDuMenu(baseDuMenu({ onglets: false })).onglets, []);
});

test('les onglets sont lus dans l’ordre de `ordre` ; les enfants sont résolus de même et les champs inconnus recopiés', () => {
  const db = baseDuMenu();
  assert.deepEqual(donneesDuMenu(db).onglets.map((o) => o.id), ['second-onglet', 'premier-onglet']);
  const [rubrique] = lireLeMenu(db, [{
    key: 'rubrique', label: 'Rubrique', niveau: 'mj', devSeulement: true,
    enfants: [{ label: 'Fils', motCle: A, prodSeulement: true, enfants: [{ label: 'Petit-fils', path: 'petit/' }] }, { label: 'Sans chemin' }],
  }]);
  assert.equal(rubrique.key, 'rubrique');
  assert.equal(rubrique.niveau, 'mj');
  assert.equal(rubrique.devSeulement, true);
  assert.equal(rubrique.href, null);
  assert.equal(rubrique.bientot, true);
  assert.deepEqual(rubrique.enfants.map((e) => e.libelle), ['Alpha d’essai', 'Sans chemin']);
  assert.equal(rubrique.enfants[0].prodSeulement, true);
  assert.deepEqual(rubrique.enfants[0].enfants.map((e) => [e.libelle, e.href]), [['Petit-fils', 'petit/']]);
  assert.deepEqual(rubrique.enfants[1].enfants, []);
  // les champs d'entrée du contrat ne sont pas recopiés tels quels
  for (const champ of ['label', 'path', 'libelleArbo']) assert.ok(!(champ in rubrique), champ);
  assert.equal(rubrique.motCle, null);
  // sans entrée
  assert.deepEqual(resoudreLesEntrees(undefined), []);
});

test('le lien d’une entrée est rendu comme la balise du mot-clé dans un texte (htmlDeLaBalise)', () => {
  const db = baseDuMenu();
  const vocabulaire = vocabulaireDesMotsCles(motsClesDeLaBase(db));
  const [suit, garde, sansUrl] = lireLeMenu(db, [{ label: 'x', motCle: A }, { label: 'Écrit A', motCle: A, libelleArbo: true }, { label: 'x', path: 'repli/', motCle: SANS_URL }]);
  for (const base of ['/', '/MaverickCenter/']) {
    // qui suit le libellé : la balise `{{clé}}`, rendue par le même code que le middleware
    const dansUnTexte = htmlAvecMotsCles('{{alpha-d-essai}}', vocabulaire, { base }).html;
    const { html, id } = htmlDeLEntree(suit, { base });
    assert.equal(html, dansUnTexte);
    assert.equal(id, A, 'sa bulle est à poser');
    assert.match(html, /^<a class="mot-cle couleur-partie-decouvrir"/);
    assert.ok(html.includes(`href="${base.replace(/\/+$/, '')}/alpha/page/#ancre"`));
    // qui garde son libellé : `{{clé|libellé}}`
    assert.equal(htmlDeLEntree(garde, { base }).html, htmlAvecMotsCles('{{alpha-d-essai|Écrit A}}', vocabulaire, { base }).html);
  }
  // le lien d’un menu est déjà un lien : `sansLien` donne le gras seul ; sans adresse, pas de lien non plus
  assert.match(htmlDeLEntree(suit, { sansLien: true }).html, /^<strong class="mot-cle /);
  assert.match(htmlDeLEntree(sansUrl).html, /^<a class="mot-cle couleur-partie-decouvrir" href="\/repli\/"/, 'l’adresse de repli (le chemin écrit) fait le lien');
  const [bientot] = lireLeMenu(db, [{ label: 'x', motCle: SANS_URL }]);
  assert.match(htmlDeLEntree(bientot).html, /^<strong class="mot-cle /);
  // sans mot-clé : rien (l’appelant dessine un lien direct)
  assert.equal(htmlDeLEntree(lireLeMenu(db, [{ label: 'Direct', path: 'direct/' }])[0]), null);
  // un libellé écrit qui casserait une balise reste un texte simple
  const [casse] = lireLeMenu(db, [{ label: 'a {{b}} | c', motCle: A, libelleArbo: true }]);
  assert.ok(!htmlDeLEntree(casse).html.includes('{{b'));
});

test('sur la base construite : menuDuSite lit la base du build, une fois par liste d’entrées', () => {
  const db = ouvrirBase({ sansExemples: false });
  // les lignes d’essai se choisissent dans l’état courant (jamais par un id supposé)
  const mot = motsClesDeLaBase(db, { elements: false }).find((m) => m.url !== null); // le premier par id, l'adresse lue sur son élément
  const onglet = db.prepare('SELECT id, titre FROM regles_onglet ORDER BY ordre, id LIMIT 1').get();
  assert.ok(mot && onglet, 'la base du site a un mot-clé à adresse et un onglet');
  const entrees = [{ label: 'x', motCle: mot.id, enfants: [{ label: 'y', onglet: onglet.id }] }, { label: 'z', motCle: -1, path: 'repli/' }];
  const menu = menuDuSite(entrees);
  assert.equal(menuDuSite(entrees), menu, 'lu une fois');
  assert.equal(menu[0].libelle, mot.libelle);
  assert.equal(menu[0].href, mot.url.replace(/^\//, ''));
  assert.equal(menu[0].enfants[0].libelle, onglet.titre);
  assert.equal(menu[0].enfants[0].href, adresseDeLOnglet({ id: onglet.id }));
  assert.deepEqual([menu[1].href, menu[1].motCle], ['repli/', null]);
});
