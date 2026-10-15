// Contenu des tables de la base vivante pour le menu « DB » (le schéma de la base) de la page Debug (client/serveur/debug-tables.mjs, api.mjs ; docs/api.md,
// « Page Debug » ; demandes du propriétaire du 2026-10-15 : « D'un double clic sur une de ces tables, ça ouvrirait une popup avec le contenu dans un
// tableau (scrollable) », puis « Il faut tout rendre ouvert. Ce qui est fermé c'est que la base du serveur de prod. De plus, j'aimerais que ce tableau
// se mette à jour si la table change. ») : site de dev seulement (403 ailleurs, avant 404 et 405), liste des tables et vues (ni internes ni FTS5),
// toutes lisibles, fiches de la section 13 comprises (portrait résumé), 404 pour un nom inconnu ou piégé, 400 pour un tri ou une page hors bornes,
// pagination et total, ordre stable, images et textes longs résumés (jamais un portrait entier), vues lisibles, lecture seule (405 avec Allow ; rien
// que des SELECT et des PRAGMA de lecture), ETag du contenu et 304, version de la base (GET /api/debug/base/ : stable sans écriture, changée par
// toute écriture validée, une réouverture ou un redémarrage ; coût fixe), gabarits des métriques (serveur/metriques.mjs#routeNormalisee) et relève,
// puis le vrai serveur HTTP (nom encodé, ETag, version, journal et mémoire des requêtes sans la relève).
// Base vivante neuve dans un dossier temporaire.
//   node --test test/serveur-debug-tables.test.mjs
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { after, test } from 'node:test';
import { traiter } from '../serveur/api.mjs';
import { ouvrirBaseVivante, preparerBaseVivante } from '../serveur/base-vivante.mjs';
import {
  LIMITE_MAX, LIMITE_PAR_DEFAUT, lireTable, TABLES_DERIVEES, TEXTE_MAX, valeurResumee, versionDeLaBase, versionDuContenu,
} from '../serveur/debug-tables.mjs';
import { estUneReleve as estUneReleveDuJournal } from '../serveur/journal-du-service.mjs';
import { TABLES_EDITION } from '../serveur/base-vivante.mjs';
import { CHAMP_VERSION, TABLES_FICHES } from '../src/lib/fiche-format.mjs';
import { estUnSuivi, estUneReleve, ROUTE_INCONNUE, routeNormalisee } from '../serveur/metriques.mjs';
import { creerMesureSql } from '../serveur/metriques-sql.mjs';
import { descriptionOpenApi } from '../serveur/openapi.mjs';
import { demarrerService } from '../serveur/service.mjs';
import { cheminBase, trouverRacine } from '../src/lib/donnees.mjs';
import { empreinte } from '../src/lib/portrait.mjs';
import { lireSchema } from '../src/lib/schema-doc.mjs';

/** Images écrites par Chromium (test/portrait.test.mjs) : WebP, JPEG et PNG de 3 × 2 pixels. */
const IMAGES = JSON.parse(readFileSync(new URL('./fixtures/portraits.json', import.meta.url), 'utf8'));
/** Les octets d'une data URL, décodés à part (pas par le module essayé). */
const octetsDe = (dataUrl) => Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64').length;
/** Un morceau du base64 d'une image (40 à 120 caractères après la virgule) : jamais dans une réponse. */
const morceauDe = (image) => image.slice(image.indexOf(',') + 41, image.indexOf(',') + 121);

const racine = mkdtempSync(join(tmpdir(), 'maverick-debug-tables-'));
after(() => rmSync(racine, { recursive: true, force: true }));
const REGLES = cheminBase({ sansExemples: false });
const { chemin } = preparerBaseVivante({ regles: REGLES, dossier: join(racine, 'db') });
const db = ouvrirBaseVivante(chemin);
const service = { base: () => db, etat: () => ({ service: 'essai', version: '0.0.0-essai' }), journal: () => {}, edition: true };
const JSON_ = { 'content-type': 'application/json' };
const appel = (methode, chemin_, { s = service, corps, recherche, entetes = {} } = {}) =>
  traiter({ methode, chemin: chemin_, recherche, entetes: { ...JSON_, ...entetes }, corps: corps === undefined ? undefined : JSON.stringify(corps) }, s);
const ok = (r, statut = 200) => {
  assert.equal(r.statut, statut, JSON.stringify(r.corps)?.slice(0, 1200));
  return r.corps;
};
const lignes = (sql, ...p) => db.prepare(sql).all(...p).map((l) => ({ ...l }));
const ligne = (sql, ...p) => lignes(sql, ...p)[0] ?? null;
/** Toutes les lignes d'une table, page après page (`limite` par page), dans l'ordre que rend la route. */
function toutesLesPages(table, limite, extra = {}) {
  const vues = [];
  let total = null;
  for (let decalage = 0; total === null || decalage < total; decalage += limite) {
    const p = ok(appel('GET', `/api/debug/tables/${table}/`, { recherche: `?${new URLSearchParams({ limite: String(limite), decalage: String(decalage), ...extra })}` }));
    total = p.total;
    assert.ok(p.lignes.length <= limite);
    vues.push(...p.lignes);
  }
  return { total, vues };
}
/** Le schéma lu dans data/schema.sql : chaque objet avec sa section. */
const SECTIONS = lireSchema(readFileSync(join(trouverRacine(), 'data', 'schema.sql'), 'utf8'));
const OBJETS = SECTIONS.flatMap((s) => s.objets);
/** Les tables et vues de la section 13 (fiches de personnages, comptes, groupes), dans l'ordre des noms. */
const SECTION_13 = SECTIONS.find((s) => s.titre.startsWith('13.')).objets.filter((o) => o.genre === 'table' || o.genre === 'vue').map((o) => o.nom).sort();

test('fermé hors du site de dev (décision du propriétaire, 2026-10-15 : « Ce qui est fermé c’est que la base du serveur de prod ») : 403 sur la liste, le contenu et la version de la base, avant 404 (nom inconnu, adresse en trop) et 405 (écriture)', () => {
  const ferme = { ...service, edition: false };
  for (const [m, c] of [
    ['GET', '/api/debug/tables/'], ['GET', '/api/debug/tables'], ['GET', '/api/debug/tables/metier/'], ['GET', '/api/debug/tables/personnage/'],
    ['GET', '/api/debug/tables/inconnue/'], ['GET', '/api/debug/tables/sqlite_master/'], ['GET', '/api/debug/tables/metier/en/trop/'],
    ['POST', '/api/debug/tables/'], ['DELETE', '/api/debug/tables/metier/'], ['PUT', '/api/debug/tables/metier/'], ['PATCH', '/api/debug/tables/metier/'],
  ]) {
    const r = appel(m, c, { s: ferme, corps: m === 'GET' ? undefined : {} });
    assert.equal(r.statut, 403, `${m} ${c}`);
    assert.equal(r.corps.erreur, 'Le contenu des tables ne se lit que sur le site de dev (page Debug).', `${m} ${c}`);
  }
  // la version de la base aussi, même avec un ETag connu ou une méthode d'écriture
  for (const [m, c] of [['GET', '/api/debug/base/'], ['GET', '/api/debug/base'], ['GET', '/api/debug/base/x/'], ['POST', '/api/debug/base/'], ['DELETE', '/api/debug/base/']]) {
    const r = appel(m, c, { s: ferme, corps: m === 'GET' ? undefined : {}, entetes: { 'if-none-match': '"0123456789abcdef"' } });
    assert.equal(r.statut, 403, `${m} ${c}`);
    assert.equal(r.corps.erreur, 'La version de la base ne se lit que sur le site de dev (page Debug).', `${m} ${c}`);
  }
  // les autres messages de /api/debug/ ne changent pas
  assert.match(appel('GET', '/api/debug/journal/', { s: ferme }).corps.erreur, /^Le journal du service ne se lit que sur le site de dev/);
  assert.match(appel('GET', '/api/debug/metriques/', { s: ferme }).corps.erreur, /^Les métriques ne se lisent que sur le site de dev/);
});

test('liste : chaque table (sections 0 à 15, dérivées comprises) et chaque vue de la base vivante, triées par nom, avec leur nombre de lignes ; ni tables internes ni FTS5', () => {
  const { tables } = ok(appel('GET', '/api/debug/tables/'));
  const noms = tables.map((t) => t.nom);
  assert.deepEqual(noms, [...noms].sort(), 'ordre des noms');
  assert.equal(new Set(noms).size, noms.length);
  // les mêmes objets que data/schema.sql : toutes les tables et vues, sans les tables de recherche plein texte
  const attendus = OBJETS.filter((o) => o.genre === 'table' || o.genre === 'vue').map((o) => o.nom).sort();
  assert.deepEqual(noms, attendus);
  assert.equal(tables.filter((t) => t.genre !== 'vue').length, 191, '191 tables STRICT');
  assert.equal(tables.filter((t) => t.genre === 'vue').length, 36, '36 vues');
  for (const nom of ['sqlite_schema', 'sqlite_master', 'page_fts', 'entite_fts', 'page_fts_data', 'page_fts_idx', 'entite_fts_content']) assert.ok(!noms.includes(nom), nom);
  // genre : vue, table dérivée (`-- @derivee`, hors FTS5), sinon table
  const derivees = OBJETS.filter((o) => o.genre === 'table' && o.derivee).map((o) => o.nom).sort();
  assert.deepEqual([...TABLES_DERIVEES].sort(), derivees, 'TABLES_DERIVEES suit le schéma');
  for (const t of tables) {
    const objet = OBJETS.find((o) => o.nom === t.nom);
    assert.equal(t.genre, objet.genre === 'vue' ? 'vue' : objet.derivee ? 'derivee' : 'table', t.nom);
    assert.equal(t.lignes, ligne(`SELECT count(*) AS n FROM "${t.nom}"`).n, t.nom);
    assert.deepEqual(Object.keys(t), ['nom', 'genre', 'lignes']);
  }
  // les tables des fiches (section 13), du journal (14) et des notes de version (15) en sont, avec leur nombre de lignes
  for (const nom of ['personnage', 'utilisateur', 'modification_lot', 'modification', 'note_version', 'historique_modification']) assert.ok(noms.includes(nom), nom);
});

test('fiches (section 13) : tout se lit sur le site de dev (décision du propriétaire, 2026-10-15 : « Il faut tout rendre ouvert ») — tables et vues, fiche avec portrait (résumé, jamais entier), comptes ; le journal (14) aussi', () => {
  // la section 13 : les tables des fiches (TABLES_FICHES) et les vues qui les lisent
  assert.deepEqual(SECTION_13.filter((n) => !n.startsWith('v_')), [...TABLES_FICHES].sort());
  assert.deepEqual(SECTION_13.filter((n) => n.startsWith('v_')),
    ['v_groupe_controle', 'v_personnage_controle', 'v_personnage_metier_bonus', 'v_personnage_niveau', 'v_personnage_visible']);
  // une fiche avec portrait (écrite par le service, dans la copie de la base qu'est la base vivante d'essai) et un compte
  const fiche = ok(appel('POST', '/api/personnages/', { corps: { nom: `Fiche du test debug-tables ${process.pid}`, portrait: IMAGES.png } }), 201).personnage.id;
  const compte = `compte-debug-tables-${process.pid}`;
  db.prepare('INSERT INTO utilisateur (id, nom_affichage, cree_le) VALUES (?, ?, ?)').run(compte, 'Compte du test', '2026-10-15T12:00:00Z');
  try {
    for (const nom of SECTION_13) {
      const r = appel('GET', `/api/debug/tables/${nom}/`, { recherche: `?limite=${LIMITE_MAX}` });
      assert.equal(r.statut, 200, `${nom} : ${JSON.stringify(r.corps)?.slice(0, 300)}`);
      assert.equal(r.corps.genre, nom.startsWith('v_') ? 'vue' : 'table', nom);
      assert.equal(r.corps.total, ligne(`SELECT count(*) AS n FROM "${nom}"`).n, nom);
      assert.match(r.entetes.ETag, /^"[0-9a-f]{16}"$/, nom);
      // les autres paramètres aussi (rien n'est refusé avant eux : tri inconnu = 400)
      assert.equal(appel('GET', `/api/debug/tables/${nom}/`, { recherche: '?tri=inconnue' }).statut, 400, nom);
    }
    // la fiche : son portrait résumé (type, octets, empreinte), jamais un morceau de l'image, trié par sa taille ou non
    const personnages = ok(appel('GET', '/api/debug/tables/personnage/', { recherche: `?limite=${LIMITE_MAX}` }));
    const lue = personnages.lignes.find((l) => l.id === fiche);
    assert.ok(lue, 'la fiche écrite est lue');
    assert.deepEqual(lue.portrait, { image: true, type: 'image/png', octets: octetsDe(IMAGES.png), empreinte: empreinte(IMAGES.png) });
    const parTaille = ok(appel('GET', '/api/debug/tables/personnage/', { recherche: '?tri=portrait&ordre=desc&limite=1' }));
    assert.deepEqual(parTaille.lignes[0].portrait, lue.portrait);
    for (const corps of [personnages, parTaille]) assert.ok(!JSON.stringify(corps).includes(morceauDe(IMAGES.png)), 'aucun morceau du base64 de l’image');
    // ses contrôles (vue), son compte et sa visibilité : lus comme toute vue
    const controles = ok(appel('GET', '/api/debug/tables/v_personnage_controle/', { recherche: `?limite=${LIMITE_MAX}` }));
    assert.ok(controles.lignes.some((l) => l.personnage_id === fiche), 'les contrôles de la fiche (race manquante…)');
    assert.ok(ok(appel('GET', '/api/debug/tables/utilisateur/')).lignes.some((l) => l.id === compte && l.nom_affichage === 'Compte du test'));
    const visibles = ok(appel('GET', '/api/debug/tables/v_personnage_visible/', { recherche: `?limite=${LIMITE_MAX}` }));
    assert.deepEqual(visibles.lignes.filter((l) => l.personnage_id === fiche && l.utilisateur_id === compte).length,
      ligne('SELECT count(*) AS n FROM v_personnage_visible WHERE personnage_id = ? AND utilisateur_id = ?', fiche, compte).n);
  } finally {
    db.prepare('DELETE FROM personnage WHERE id = ?').run(fiche);
    db.prepare('DELETE FROM utilisateur WHERE id = ?').run(compte);
  }
  // le journal de l'édition (section 14) et les notes de version (15) se lisent aussi
  for (const nom of [...TABLES_EDITION, 'note_version', 'historique_modification']) assert.equal(appel('GET', `/api/debug/tables/${nom}/`).statut, 200, nom);
  // à revoir à la 1.0 (relecture du 2026-10-15 ; un rappel, le code suit la décision) : la base vivante du serveur de test est copiée de celle de
  // production à sa première installation, et dev.maverick-jdr.com est ouvert sans mot de passe avant la connexion Discord — dit dans l'en-tête du
  // module, dans docs/api.md (« Contenu des tables ») et docs/serveur.md, et posé parmi les questions ouvertes de la feuille de route
  const racine = trouverRacine();
  const aplatir = (texte) => texte.replace(/^\s*\/\/ ?/gm, '').replace(/\s+/g, ' ');
  const section = (texte, titre) => texte.slice(texte.indexOf(titre), texte.indexOf('\n### ', texte.indexOf(titre) + titre.length) >>> 0);
  const entete = aplatir(readFileSync(new URL('../serveur/debug-tables.mjs', import.meta.url), 'utf8').split('\nimport ')[0]);
  const doc = aplatir(section(readFileSync(join(racine, 'docs', 'api.md'), 'utf8'), '### Contenu des tables'));
  const questions = aplatir(section(readFileSync(join(racine, 'docs', 'feuille-de-route.md'), 'utf8'), '### Questions encore ouvertes'));
  const serveur = aplatir(readFileSync(join(racine, 'docs', 'serveur.md'), 'utf8'));
  for (const [ou, texte, motifs] of [
    ['en-tête de debug-tables.mjs', entete, [/À revoir à la 1\.0/, /copiée de celle de production/, /sans mot de passe avant la connexion Discord/]],
    ['docs/api.md', doc, [/\*\*À revoir à la 1\.0\*\*/, /copie de celle de production\*\*/, /MAVERICK_BASE_TEST=conservee/, /\*\*sans mot de passe\*\* avant la connexion Discord/, /à reconsidérer avec le propriétaire/]],
    ['docs/feuille-de-route.md', questions, [/\*\*Base du site de dev à la connexion Discord\*\* \(E7, E8/, /copiée de celle de production/]],
    ['docs/serveur.md', serveur, [/ni listée ni lisible par l'API des personnages/, /point à revoir à la 1\.0/]],
  ]) for (const motif of motifs) assert.match(texte, motif, ou);
});

test('fiches, repli sur une base d’avant la migration 0045 : la table retirée (personnage_progression, TABLES_RETIREES) et la vue qui la lit se lisent comme les autres (tout est ouvert sur le site de dev)', () => {
  // un service à jour sur une base vivante dont la reconstruction a échoué : la table n'est plus dans TABLES_FICHES, mais elle a encore des lignes ;
  // décision du propriétaire du 2026-10-15 (« Il faut tout rendre ouvert ») : rien n'est refusé, ni elle ni la vue qui la lit
  const ancienne = new DatabaseSync(':memory:');
  ancienne.exec(`CREATE TABLE personnage_progression (personnage_id TEXT NOT NULL, niveau INTEGER NOT NULL, points_sante INTEGER NOT NULL,
    points_chakra INTEGER NOT NULL, PRIMARY KEY (personnage_id, niveau)) STRICT;
    INSERT INTO personnage_progression VALUES ('p1', 2, 10, 5);
    CREATE VIEW v_gains AS SELECT personnage_id, sum(points_sante) AS sante FROM personnage_progression GROUP BY personnage_id;
    CREATE TABLE niveau_global (niveau INTEGER PRIMARY KEY) STRICT;`);
  try {
    assert.deepEqual(lireTable(ancienne, 'personnage_progression').lignes, [{ personnage_id: 'p1', niveau: 2, points_sante: 10, points_chakra: 5 }]);
    assert.deepEqual(lireTable(ancienne, 'v_gains').lignes, [{ personnage_id: 'p1', sante: 10 }]);
    assert.equal(lireTable(ancienne, 'niveau_global').total, 0, 'les autres tables se lisent');
  } finally {
    ancienne.close();
  }
});

test('nom inconnu ou piégé : 404 (interne, FTS5 et ses tables de shadow, casse, guillemets, « ; », « / » encodé, encodage illisible, segment vide) ; adresse en trop : 404 ; la base ne change pas', () => {
  const avant = ligne('SELECT count(*) AS n FROM metier').n;
  for (const segment of [
    'inconnue', 'sqlite_master', 'sqlite_schema', 'sqlite_sequence', 'page_fts', 'page_fts_data', 'page_fts_idx', 'page_fts_content', 'page_fts_docsize',
    'page_fts_config', 'entite_fts', 'entite_fts_data', 'METIER', 'Metier', ' metier', 'metier ', encodeURIComponent('x;DROP TABLE metier'),
    encodeURIComponent('metier;DROP TABLE metier'), encodeURIComponent('metier"'), encodeURIComponent('"metier"'), encodeURIComponent("metier'"),
    encodeURIComponent('metier" WHERE 1 --'), 'x%2Fy', 'metier%2F', '%2Fmetier', 'main.metier', '%E0%A4%A', '%', '',
  ]) {
    const r = appel('GET', `/api/debug/tables/${segment}/`);
    assert.equal(r.statut, 404, `« ${segment} » : ${JSON.stringify(r.corps)}`);
    assert.match(r.corps.erreur, /^Table introuvable/, segment);
  }
  for (const c of ['/api/debug/tables/metier/lignes/', '/api/debug/tables/metier/1/2/', '/api/debug/inconnue/']) assert.equal(appel('GET', c).statut, 404, c);
  assert.equal(ligne('SELECT count(*) AS n FROM metier').n, avant);
  assert.ok(ligne("SELECT 1 AS n FROM sqlite_schema WHERE name = 'metier'"));
});

test('paramètres refusés : 400 pour un tri qui n’est pas une colonne, un ordre inconnu, une limite hors de 1..500 ou un décalage qui n’est pas un entier positif', () => {
  for (const recherche of [
    '?tri=inconnue', '?tri=rowid', '?tri=NOM', `?tri=${encodeURIComponent('nom; DROP TABLE metier')}`, `?tri=${encodeURIComponent('"nom"')}`,
    '?ordre=haut', '?ordre=asc;', '?limite=0', `?limite=${LIMITE_MAX + 1}`, '?limite=-1', '?limite=abc', '?limite=1.5', '?limite=1e2',
    '?decalage=-1', '?decalage=x', '?decalage=2.5',
  ]) {
    const r = appel('GET', '/api/debug/tables/metier/', { recherche });
    assert.equal(r.statut, 400, `${recherche} : ${JSON.stringify(r.corps)}`);
  }
  assert.deepEqual(appel('GET', '/api/debug/tables/metier/', { recherche: '?tri=inconnue' }).corps.colonnes, lignes('PRAGMA table_info(metier)').map((c) => c.name),
    'le refus dit les colonnes');
  // la chaîne de requête collée au chemin vaut la même chose
  assert.equal(appel('GET', '/api/debug/tables/metier/?limite=0').statut, 400);
  // bornes acceptées ; vide = défaut
  assert.equal(ok(appel('GET', '/api/debug/tables/metier/', { recherche: `?limite=${LIMITE_MAX}` })).limite, LIMITE_MAX);
  assert.equal(ok(appel('GET', '/api/debug/tables/metier/', { recherche: '?limite=1' })).lignes.length, 1);
  const vide = ok(appel('GET', '/api/debug/tables/metier/', { recherche: '?limite=&decalage=&tri=&ordre=' }));
  assert.deepEqual([vide.limite, vide.decalage, vide.tri, vide.ordre], [LIMITE_PAR_DEFAUT, 0, null, 'asc']);
  assert.equal(ok(appel('GET', '/api/debug/tables/metier/', { recherche: '?ordre=DESC' })).ordre, 'desc');
});

test('contenu : colonnes (nom, type, rang dans la clé), total, page par défaut de 100, pagination complète et sans doublon dans l’ordre de la clé primaire', () => {
  const p = ok(appel('GET', '/api/debug/tables/metier/'));
  assert.deepEqual(Object.keys(p), ['table', 'genre', 'colonnes', 'total', 'limite', 'decalage', 'tri', 'ordre', 'lignes']);
  assert.deepEqual([p.table, p.genre, p.limite, p.decalage, p.tri, p.ordre], ['metier', 'table', LIMITE_PAR_DEFAUT, 0, null, 'asc']);
  assert.deepEqual(p.colonnes, lignes('PRAGMA table_info(metier)').map((c) => ({ nom: c.name, type: c.type, pk: c.pk })));
  assert.equal(p.total, ligne('SELECT count(*) AS n FROM metier').n);
  const attendues = lignes('SELECT * FROM metier ORDER BY id');
  assert.deepEqual(p.lignes, attendues.slice(0, LIMITE_PAR_DEFAUT), 'les lignes telles quelles (aucun texte long ici)');
  // une table de plus de 100 lignes : la page par défaut en a 100
  const grande = ok(appel('GET', '/api/debug/tables/monstre_capacite/'));
  assert.ok(grande.total > LIMITE_PAR_DEFAUT, 'plus d’une page');
  assert.equal(grande.lignes.length, LIMITE_PAR_DEFAUT);
  // page après page (7 par page) : chaque ligne une fois, dans l'ordre de la clé
  const { total, vues } = toutesLesPages('metier', 7);
  assert.equal(total, attendues.length);
  assert.deepEqual(vues.map((l) => l.id), attendues.map((l) => l.id));
  // au-delà de la fin : une page vide, le total reste
  const fin = ok(appel('GET', '/api/debug/tables/metier/', { recherche: `?decalage=${total + 5}` }));
  assert.deepEqual([fin.total, fin.lignes.length], [total, 0]);
  // clé primaire de plusieurs colonnes : son ordre (pk 1, puis 2…), stable d'une page à l'autre
  const cle = lignes('PRAGMA table_info(monstre_capacite)').filter((c) => c.pk).sort((a, b) => a.pk - b.pk).map((c) => c.name);
  assert.ok(cle.length >= 2, cle.join(', '));
  const parCle = lignes(`SELECT ${cle.map((c) => `"${c}"`).join(', ')} FROM monstre_capacite ORDER BY ${cle.map((c) => `"${c}"`).join(', ')}`);
  const pages = toutesLesPages('monstre_capacite', 500);
  assert.deepEqual(pages.vues.map((l) => cle.map((c) => l[c])), parCle.map((l) => cle.map((c) => l[c])));
});

test('tri : une colonne, puis la clé primaire (ordre stable entre les pages, même avec des valeurs égales) ; « desc » renverse tout l’ordre', () => {
  // une colonne aux valeurs répétées : la clé départage
  const colonne = 'test_carac_1_id';
  const croissant = lignes(`SELECT id FROM metier ORDER BY "${colonne}" ASC, id ASC`).map((l) => l.id);
  const decroissant = lignes(`SELECT id FROM metier ORDER BY "${colonne}" DESC, id DESC`).map((l) => l.id);
  assert.ok(ligne(`SELECT count(*) - count(DISTINCT "${colonne}") AS n FROM metier`).n > 0, 'des valeurs répétées');
  for (const limite of [3, 11, 500]) {
    assert.deepEqual(toutesLesPages('metier', limite, { tri: colonne }).vues.map((l) => l.id), croissant, `asc, ${limite} par page`);
    assert.deepEqual(toutesLesPages('metier', limite, { tri: colonne, ordre: 'desc' }).vues.map((l) => l.id), decroissant, `desc, ${limite} par page`);
  }
  const p = ok(appel('GET', '/api/debug/tables/metier/', { recherche: `?tri=${colonne}&ordre=desc&limite=2` }));
  assert.deepEqual([p.tri, p.ordre], [colonne, 'desc']);
  // sans tri, « desc » renverse l'ordre de la clé
  assert.deepEqual(toutesLesPages('metier', 50, { ordre: 'desc' }).vues.map((l) => l.id), lignes('SELECT id FROM metier ORDER BY id DESC').map((l) => l.id));
});

test('vue : lisible (genre « vue », aucune colonne de clé), total juste, ordre stable par toutes ses colonnes', () => {
  const vue = 'v_regard_peuple';
  const p = ok(appel('GET', `/api/debug/tables/${vue}/`, { recherche: '?limite=5' }));
  assert.equal(p.genre, 'vue');
  assert.ok(p.colonnes.length && p.colonnes.every((c) => c.pk === 0));
  assert.equal(p.total, ligne(`SELECT count(*) AS n FROM "${vue}"`).n);
  const colonnes = p.colonnes.map((c) => `"${c.nom}"`).join(', ');
  const attendues = lignes(`SELECT ${colonnes} FROM "${vue}" ORDER BY ${colonnes}`);
  const { vues } = toutesLesPages(vue, 500);
  assert.deepEqual(vues, attendues);
  // une vue des fiches (section 13) se lit comme une autre (décision du propriétaire, 2026-10-15 : « Il faut tout rendre ouvert »)
  assert.equal(ok(appel('GET', '/api/debug/tables/v_personnage_controle/')).genre, 'vue');
  assert.equal(ok(appel('GET', '/api/debug/tables/v_niveau/')).genre, 'vue');
  // une table dérivée
  const lien = ok(appel('GET', '/api/debug/tables/lien/', { recherche: '?limite=3' }));
  assert.deepEqual([lien.genre, lien.total], ['derivee', ligne('SELECT count(*) AS n FROM lien').n]);
});

test('images et textes longs résumés : le portrait d’une carte de monstre n’est jamais rendu entier ; un texte de plus de 2 000 caractères est coupé', () => {
  // un portrait de carte de monstre (écrit ici dans la base d'essai), trié par sa colonne : résumé
  const monstre = ligne('SELECT id FROM monstre ORDER BY id LIMIT 1').id;
  db.prepare('UPDATE monstre SET portrait = ? WHERE id = ?').run(IMAGES.png, monstre);
  try {
    const cartes = ok(appel('GET', '/api/debug/tables/monstre/', { recherche: '?tri=portrait&ordre=desc&limite=1' }));
    assert.deepEqual(cartes.lignes[0].portrait, { image: true, type: 'image/png', octets: octetsDe(IMAGES.png), empreinte: empreinte(IMAGES.png) });
    const page = ok(appel('GET', '/api/debug/tables/monstre/', { recherche: `?limite=${LIMITE_MAX}` }));
    assert.deepEqual(page.lignes.find((l) => l.id === monstre).portrait, cartes.lignes[0].portrait);
    for (const corps of [JSON.stringify(cartes), JSON.stringify(page)]) assert.ok(!corps.includes(morceauDe(IMAGES.png)), 'aucun morceau du base64 de l’image');
  } finally {
    db.prepare('UPDATE monstre SET portrait = NULL WHERE id = ?').run(monstre);
  }
  // un texte long : le corps d'une page de plus de 2 000 caractères
  const longue = ligne('SELECT id, corps_md FROM page WHERE length(corps_md) > ? ORDER BY length(corps_md) DESC LIMIT 1', TEXTE_MAX * 2);
  assert.ok(longue, 'une page longue');
  const pages = ok(appel('GET', '/api/debug/tables/page/', { recherche: `?tri=id&limite=${LIMITE_MAX}&decalage=${ligne('SELECT count(*) AS n FROM page WHERE id < ?', longue.id).n}` }));
  const lue = pages.lignes[0];
  assert.equal(lue.id, longue.id);
  const points = Array.from(longue.corps_md);
  assert.equal(lue.corps_md, `${points.slice(0, TEXTE_MAX).join('')} … (${points.length} caractères)`);
  // un texte de 2 000 caractères tout juste reste entier
  assert.equal(valeurResumee('é'.repeat(TEXTE_MAX)), 'é'.repeat(TEXTE_MAX));
  assert.equal(valeurResumee('😀'.repeat(TEXTE_MAX)), '😀'.repeat(TEXTE_MAX), 'un emoji compte pour un caractère');
  assert.equal(valeurResumee('😀'.repeat(TEXTE_MAX + 1)), `${'😀'.repeat(TEXTE_MAX)} … (${TEXTE_MAX + 1} caractères)`, 'jamais une moitié d’emoji');
});

test('image DANS un texte (le JSON du journal : portrait modifié par POST /api/edition/) : résumée, jamais un morceau du base64, même au-delà de 2 000 caractères', () => {
  const enregistrer = (...operations) => ok(appel('POST', '/api/edition/', { corps: { page: 'bestiaire/', operations } }));
  const espece = enregistrer({ op: 'creer', entite: 'monstre_espece', valeurs: { nom: `Espèce du test debug-tables ${process.pid}`, ep_brut: 'EP1' } }).crees[0].id;
  const carte = enregistrer({ op: 'creer', entite: 'monstre', valeurs: { espece_id: espece, nom: `Carte du test debug-tables ${process.pid}`, echelle_brut: 'EP1', categorie: 'boss' } }).crees[0].id;
  // une petite image (le JSON tient sous 2 000 caractères) puis une grande (le JSON dépasse : il était coupé, base64 compris)
  const png = Buffer.from(IMAGES.png.slice(IMAGES.png.indexOf(',') + 1), 'base64');
  const grande = `data:image/png;base64,${Buffer.concat([png, Buffer.alloc(3000, 0x41)]).toString('base64')}`;
  enregistrer({ op: 'modifier', table: 'monstre', cle: { id: carte }, valeurs: { portrait: IMAGES.webp }, avant: { portrait: null } });
  enregistrer({ op: 'modifier', table: 'monstre', cle: { id: carte }, valeurs: { portrait: grande }, avant: { portrait: { empreinte: empreinte(IMAGES.webp) } } });
  const brut = lignes("SELECT avant, apres FROM modification WHERE table_nom = 'monstre' AND apres LIKE '%data:image/%'");
  assert.equal(brut.length, 2, 'le journal garde les images entières (en base)');
  const page = ok(appel('GET', '/api/debug/tables/modification/', { recherche: `?limite=${LIMITE_MAX}&tri=apres&ordre=desc` }));
  const texte = JSON.stringify(page);
  for (const image of [IMAGES.webp, grande]) assert.ok(!texte.includes(morceauDe(image)), 'aucun morceau du base64');
  assert.ok(!texte.includes(grande.slice(grande.length - 200, grande.length - 120)), 'ni de la fin d’une grande image');
  const resume = (image) => {
    const v = valeurResumee(image);
    return `[image ${v.type}, ${v.octets} octets, empreinte ${v.empreinte}]`;
  };
  const avecImages = page.lignes.filter((l) => typeof l.apres === 'string' && l.apres.includes('[image '));
  assert.equal(avecImages.length, 2);
  assert.ok(avecImages.some((l) => l.apres.includes(resume(IMAGES.webp))), 'petite image : son résumé (type, octets, empreinte)');
  assert.ok(avecImages.some((l) => l.apres.includes(resume(grande)) && l.avant.includes(resume(IMAGES.webp))), 'grande image : son résumé, même empreinte qu’en colonne');
  // le résumé dans le texte : celui de la colonne (même empreinte que ligneSansImage)
  assert.equal(valeurResumee(`{"portrait":"${IMAGES.webp}","x":1}`), `{"portrait":"${resume(IMAGES.webp)}","x":1}`);
  assert.equal(valeurResumee(`voir ${IMAGES.png} puis ${IMAGES.webp}.`), `voir ${resume(IMAGES.png)} puis ${resume(IMAGES.webp)}.`);
  assert.equal(valeurResumee('data:text/plain,bonjour data:image/'), 'data:text/plain,bonjour data:image/', 'une marque sans image : rien à résumer');
});

test('lecture bornée : le SQL ne rend d’un texte long que son début et sa longueur, d’un BLOB que sa taille ; une colonne d’image se trie par sa taille, en deux temps', () => {
  const preparees = [];
  const espion = new Proxy(db, {
    get(cible, nom) {
      if (nom === 'prepare') return (sql) => { preparees.push(sql); return cible.prepare(sql); };
      const v = Reflect.get(cible, nom, cible);
      return typeof v === 'function' ? v.bind(cible) : v;
    },
  });
  const s = { ...service, base: () => espion };
  // un texte long : coupé PAR LE SQL (substr, length), le même résultat qu'avant
  const page = ok(appel('GET', '/api/debug/tables/page/', { s, recherche: '?limite=5&tri=corps_md&ordre=desc' }));
  const lecture = preparees.find((q) => q.includes('FROM "page" WHERE'));
  assert.match(lecture, new RegExp(`substr\\("corps_md", 1, ${TEXTE_MAX}\\)`));
  assert.match(lecture, /length\("corps_md"\)/);
  assert.doesNotMatch(lecture, /SELECT "id", /, 'aucune colonne lue telle quelle (hors images)');
  const attendues = lignes(`SELECT id, corps_md FROM page ORDER BY corps_md DESC, id DESC LIMIT 5`);
  assert.deepEqual(page.lignes.map((l) => l.id), attendues.map((l) => l.id));
  for (const [i, l] of page.lignes.entries()) assert.equal(l.corps_md, valeurResumee(attendues[i].corps_md), 'coupé comme avant, à l’identique');
  // une colonne d'image (CHECK … GLOB 'data:image/*') : triée par sa taille ; la page de clés d'abord, puis chaque ligne par sa clé
  preparees.length = 0;
  const monstres = lignes('SELECT id FROM monstre ORDER BY id LIMIT 3').map((l) => l.id);
  const images = [IMAGES.png, IMAGES.webp, IMAGES.jpeg ?? IMAGES.png];
  monstres.forEach((id, i) => db.prepare('UPDATE monstre SET portrait = ? WHERE id = ?').run(images[i], id));
  try {
    const p = ok(appel('GET', '/api/debug/tables/monstre/', { s, recherche: '?tri=portrait&ordre=desc&limite=3' }));
    const parTaille = lignes('SELECT id FROM monstre ORDER BY length(portrait) DESC, id DESC LIMIT 3').map((l) => l.id);
    assert.deepEqual(p.lignes.map((l) => l.id), parTaille, 'par la taille de l’image');
    const tri = preparees.find((q) => /ORDER BY length\("portrait"\) DESC/.test(q));
    assert.ok(tri, 'trié par length(portrait)');
    assert.match(tri, /^SELECT rowid AS "k0" FROM "monstre" ORDER BY /, 'le tri ne porte que la clé');
    assert.ok(preparees.some((q) => /^SELECT .* FROM "monstre" WHERE rowid = \?$/.test(q)), 'puis chaque ligne par son rowid');
    assert.ok(!JSON.stringify(p).includes(morceauDe(IMAGES.png)));
    // sans tri : une seule requête, dans l'ordre de la clé (l'index : pas de tri)
    preparees.length = 0;
    ok(appel('GET', '/api/debug/tables/monstre/', { s, recherche: '?limite=3' }));
    assert.equal(preparees.filter((q) => q.includes('FROM "monstre"') && !q.startsWith('SELECT count')).length, 1);
  } finally {
    for (const id of monstres) db.prepare('UPDATE monstre SET portrait = NULL WHERE id = ?').run(id);
  }
  // une table sans rowid (WITHOUT ROWID) triée : la page de clés par sa clé primaire
  preparees.length = 0;
  const cle = lignes('PRAGMA table_info(monstre_capacite)').filter((c) => c.pk).sort((a, b) => a.pk - b.pk).map((c) => c.name);
  const p = ok(appel('GET', '/api/debug/tables/monstre_capacite/', { s, recherche: `?tri=${cle.at(-1)}&limite=7&decalage=3` }));
  const ordre = cle.map((c) => `"${c}"`).join(' ASC, ');
  assert.deepEqual(p.lignes.map((l) => cle.map((c) => l[c])), lignes(`SELECT ${cle.map((c) => `"${c}"`).join(', ')} FROM monstre_capacite ORDER BY "${cle.at(-1)}" ASC, ${ordre} ASC LIMIT 7 OFFSET 3`).map((l) => cle.map((c) => l[c])));
  assert.ok(preparees.some((q) => q.includes(`WHERE ${cle.map((c) => `"${c}" = ?`).join(' AND ')}`)));
});

test('valeurs : nombres, null, BLOB ({ octets }), entiers hors de la plage sûre (en texte), images de tout format (même courtes, même hors de la limite des portraits)', () => {
  assert.equal(valeurResumee(null), null);
  assert.equal(valeurResumee(undefined), null);
  assert.equal(valeurResumee(3.25), 3.25);
  assert.equal(valeurResumee(42n), 42);
  assert.equal(valeurResumee(-(2n ** 60n)), '-1152921504606846976');
  assert.deepEqual(valeurResumee(new Uint8Array(1234)), { octets: 1234 });
  assert.equal(valeurResumee(''), '');
  for (const [nom, image] of Object.entries(IMAGES).filter(([k]) => k !== '_note')) {
    const v = valeurResumee(image);
    assert.deepEqual(v, { image: true, type: /^data:([^;]+);/.exec(image)[1], octets: octetsDe(image), empreinte: empreinte(image) }, nom);
  }
  assert.deepEqual(valeurResumee('data:image/svg+xml;base64,PHN2Zz4='), { image: true, type: 'image/svg+xml', octets: 5, empreinte: empreinte('data:image/svg+xml;base64,PHN2Zz4=') });
  assert.deepEqual(valeurResumee('data:image/svg+xml,<svg/>'), { image: true, type: 'image/svg+xml', octets: 6, empreinte: empreinte('data:image/svg+xml,<svg/>') });
  // un texte qui n'est pas une data URL d'image reste un texte ; une image dans un texte y est résumée
  assert.equal(valeurResumee('data:text/plain,bonjour'), 'data:text/plain,bonjour');
  assert.equal(valeurResumee('voir data:image/png;base64,AAAA'), `voir [image image/png, 3 octets, empreinte ${empreinte('data:image/png;base64,AAAA')}]`);
});

test('table sans clé primaire (rowid), colonne nommée « rowid », BLOB : ordre stable par le rowid, BLOB résumé (base en mémoire)', () => {
  const m = new DatabaseSync(':memory:');
  m.exec(`CREATE TABLE sans_cle (nom TEXT, donnees BLOB);
    CREATE TABLE avec_rowid (rowid TEXT, valeur INTEGER);
    CREATE TABLE entiers (id INTEGER PRIMARY KEY, grand INTEGER) STRICT;
    CREATE VIRTUAL TABLE recherche USING fts5(texte);`);
  const insere = m.prepare('INSERT INTO sans_cle VALUES (?, ?)');
  for (let i = 0; i < 25; i += 1) insere.run(`même nom ${i % 2}`, new Uint8Array(i));
  for (let i = 0; i < 5; i += 1) m.prepare('INSERT INTO avec_rowid VALUES (?, ?)').run('a', i);
  m.prepare('INSERT INTO entiers VALUES (1, ?)').run(2n ** 62n);
  const pages = [];
  for (let decalage = 0; decalage < 25; decalage += 4) pages.push(...lireTable(m, 'sans_cle', new URLSearchParams({ tri: 'nom', limite: '4', decalage: String(decalage) })).lignes);
  assert.deepEqual(pages.map((l) => l.donnees.octets), [...Array.from({ length: 13 }, (_, i) => i * 2), ...Array.from({ length: 12 }, (_, i) => i * 2 + 1)],
    'trié par nom, le rowid départage');
  assert.deepEqual(lireTable(m, 'avec_rowid', new URLSearchParams({ ordre: 'desc' })).lignes.map((l) => l.valeur), [4, 3, 2, 1, 0], '« _rowid_ » quand « rowid » est une colonne');
  assert.deepEqual(lireTable(m, 'entiers').lignes, [{ id: 1, grand: String(2n ** 62n) }]);
  assert.throws(() => lireTable(m, 'recherche'), (e) => e.statut === 404);
  assert.throws(() => lireTable(m, 'recherche_data'), (e) => e.statut === 404);
});

test('lecture seule : toute autre méthode que GET répond 405 (Allow: GET) sur la liste et le contenu ; la route n’exécute que des SELECT et des PRAGMA de lecture', () => {
  for (const c of ['/api/debug/tables/', '/api/debug/tables/metier/', '/api/debug/tables/inconnue/']) {
    for (const m of ['POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']) {
      const r = appel(m, c, { corps: m === 'HEAD' || m === 'OPTIONS' ? undefined : { nom: 'x' } });
      assert.equal(r.statut, 405, `${m} ${c}`);
      assert.equal(r.entetes.Allow, 'GET', `${m} ${c}`);
    }
  }
  // chaque instruction préparée par les deux routes, relevée sur une enveloppe de la base
  const preparees = [];
  const espion = new Proxy(db, {
    get(cible, nom) {
      if (nom === 'prepare') return (sql) => { preparees.push(sql); return cible.prepare(sql); };
      if (nom === 'exec') return () => assert.fail('exec appelé');
      const v = Reflect.get(cible, nom, cible);
      return typeof v === 'function' ? v.bind(cible) : v;
    },
  });
  const s = { ...service, base: () => espion };
  ok(appel('GET', '/api/debug/tables/', { s }));
  for (const t of ['metier', 'monstre', 'v_niveau', 'lien', 'personnage', 'v_personnage_controle']) {
    ok(appel('GET', `/api/debug/tables/${t}/`, { s, recherche: `?tri=${lignes(`PRAGMA table_info("${t}")`)[0].name}&ordre=desc` }));
  }
  appel('GET', '/api/debug/tables/inconnue/', { s });
  appel('GET', '/api/debug/tables/metier/', { s, recherche: '?tri=inconnue' });
  assert.ok(preparees.length > 200, `${preparees.length} instructions`);
  for (const sql of preparees) assert.match(sql, /^(SELECT |PRAGMA main\.table_list$|PRAGMA main\.table_info\("[a-z0-9_]+"\)$)/, sql);
});

test('version de la base (versionDeLaBase) : stable sans écriture ; changée par une écriture validée de la même connexion (INSERT, UPDATE, DELETE, transaction), d’une autre connexion sur le même fichier, un changement du schéma, une réouverture, un redémarrage du service ; une instruction préparée une fois, aucune table lue', () => {
  const fichier = join(racine, 'version.db');
  const a = new DatabaseSync(fichier);
  a.exec('CREATE TABLE t (id INTEGER PRIMARY KEY, x TEXT)');
  const vues = new Set();
  const nouvelle = (connexion, quoi) => {
    const v = versionDeLaBase(connexion);
    assert.equal(typeof v, 'string');
    assert.ok(!vues.has(v), `${quoi} : une version jamais vue (${v})`);
    vues.add(v);
    return v;
  };
  let v = nouvelle(a, 'départ');
  // stable : relevée plusieurs fois, des lectures entre-temps
  a.prepare('SELECT count(*) AS n FROM t').get();
  assert.equal(versionDeLaBase(a), v);
  assert.equal(versionDeLaBase(a), v);
  a.prepare('INSERT INTO t (x) VALUES (?)').run('un');
  v = nouvelle(a, 'INSERT');
  a.prepare('UPDATE t SET x = ? WHERE id = 1').run('deux');
  v = nouvelle(a, 'UPDATE');
  assert.equal(versionDeLaBase(a), v, 'stable après l’écriture');
  a.prepare('DELETE FROM t WHERE id = 1').run();
  v = nouvelle(a, 'DELETE');
  a.exec("BEGIN; INSERT INTO t (x) VALUES ('a'); INSERT INTO t (x) VALUES ('b'); COMMIT");
  v = nouvelle(a, 'transaction validée');
  // une autre connexion sur le même fichier (un script, une autre instance) : PRAGMA data_version
  const b = new DatabaseSync(fichier);
  b.prepare('INSERT INTO t (x) VALUES (?)').run('d’ailleurs');
  v = nouvelle(a, 'écriture d’une autre connexion');
  assert.equal(versionDeLaBase(a), v);
  b.exec('CREATE INDEX t_x ON t (x)');
  v = nouvelle(a, 'schéma changé par une autre connexion');
  a.exec('CREATE TABLE u (y)');
  v = nouvelle(a, 'schéma changé par la connexion');
  // une réouverture (base remplacée puis rouverte par le service) : une autre connexion, une autre version, même sans écriture
  a.close();
  const a2 = new DatabaseSync(fichier);
  v = nouvelle(a2, 'réouverture');
  // l'enveloppe de serveur/metriques-sql.mjs (ce que donne service.base()) : la même pour une même connexion, donc la même version d'une requête à l'autre
  const mesure = creerMesureSql();
  const enveloppe = mesure.envelopper(a2);
  assert.equal(mesure.envelopper(a2), enveloppe, 'une enveloppe par connexion (WeakMap)');
  const ve = versionDeLaBase(enveloppe);
  mesure.debuter();
  assert.equal(versionDeLaBase(mesure.envelopper(a2)), ve, 'pendant une requête mesurée aussi');
  mesure.terminer();
  a2.prepare('INSERT INTO t (x) VALUES (?)').run('par la connexion elle-même');
  assert.notEqual(versionDeLaBase(enveloppe), ve, 'une écriture par la connexion, enveloppée ou non');
  // coût fixe : une seule instruction, préparée une fois par connexion, qui ne lit que des PRAGMA et total_changes()
  const preparees = [];
  const espion = new Proxy(a2, {
    get(cible, nom) {
      if (nom === 'prepare') return (sql) => { preparees.push(sql); return cible.prepare(sql); };
      const x = Reflect.get(cible, nom, cible);
      return typeof x === 'function' ? x.bind(cible) : x;
    },
  });
  for (let i = 0; i < 5; i++) versionDeLaBase(espion);
  assert.equal(preparees.length, 1, 'préparée une fois');
  assert.match(preparees[0], /^SELECT .*total_changes\(\)/);
  assert.deepEqual([...preparees[0].matchAll(/\bFROM\s+"?(\w+)/gi)].map((m) => m[1]), ['pragma_schema_version', 'pragma_data_version'], 'aucune table lue');
  a2.close();
  b.close();
  // un service redémarré : un autre processus, un autre jeton (même fichier, mêmes compteurs : seul le jeton change)
  const code = `import { DatabaseSync } from 'node:sqlite'; import { versionDeLaBase } from ${JSON.stringify(new URL('../serveur/debug-tables.mjs', import.meta.url).href)};`
    + ` process.stdout.write(versionDeLaBase(new DatabaseSync(${JSON.stringify(fichier)}, { readOnly: true })));`;
  const processus = () => execFileSync(process.execPath, ['--no-warnings', '--input-type=module', '-e', code], { encoding: 'utf8' });
  const [p1, p2] = [processus(), processus()];
  assert.notEqual(p1, p2, 'deux démarrages, deux versions');
  assert.equal(p1.slice(p1.indexOf('.')), p2.slice(p2.indexOf('.')), 'la même base lue de la même façon : seul le jeton du processus diffère');
});

test('GET /api/debug/base/ : { version }, Cache-Control: no-store ; stable sans écriture (lectures comprises), changée par chaque écriture (service ou SQL) ; 405 (Allow: GET), 404 (adresse en trop), 503 sans base', () => {
  const r = appel('GET', '/api/debug/base/');
  assert.equal(r.statut, 200);
  assert.deepEqual(Object.keys(r.corps), ['version']);
  assert.equal(r.corps.version, versionDeLaBase(db));
  assert.equal(r.entetes['Cache-Control'], 'no-store');
  assert.equal(ok(appel('GET', '/api/debug/base')).version, r.corps.version, 'sans « / » finale');
  assert.equal(ok(appel('GET', '/api/debug/base/', { recherche: '?x=1' })).version, r.corps.version, 'la chaîne de requête n’y fait rien');
  // des lectures (liste, contenu, fiches, état) ne la changent pas
  for (const c of ['/api/debug/tables/', '/api/debug/tables/metier/', '/api/debug/tables/personnage/', '/api/personnages/', '/api/etat/']) ok(appel('GET', c));
  assert.equal(ok(appel('GET', '/api/debug/base/')).version, r.corps.version);
  // chaque écriture : une autre version (le service : un prétiré créé puis supprimé ; du SQL : une ligne changée puis rendue)
  const vues = new Set([r.corps.version]);
  const nouvelle = (quoi) => {
    const v = ok(appel('GET', '/api/debug/base/')).version;
    assert.ok(!vues.has(v), quoi);
    vues.add(v);
    assert.equal(ok(appel('GET', '/api/debug/base/')).version, v, `${quoi} : stable ensuite`);
  };
  const cree = ok(appel('POST', '/api/personnages/', { corps: { nom: `Version du test debug-tables ${process.pid}` } }), 201).personnage;
  nouvelle('création d’un prétiré');
  ok(appel('DELETE', `/api/personnages/${encodeURIComponent(cree.id)}/`, { corps: { [CHAMP_VERSION]: cree[CHAMP_VERSION] } }));
  nouvelle('suppression d’un prétiré');
  const metier = ligne('SELECT id, remarque FROM metier ORDER BY id LIMIT 1');
  db.prepare('UPDATE metier SET remarque = ? WHERE id = ?').run('essai de la version', metier.id);
  nouvelle('une ligne changée');
  db.prepare('UPDATE metier SET remarque = ? WHERE id = ?').run(metier.remarque, metier.id);
  nouvelle('la ligne rendue');
  // méthodes, adresses en trop, base indisponible
  for (const m of ['POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']) {
    const refus = appel(m, '/api/debug/base/', { corps: m === 'HEAD' || m === 'OPTIONS' ? undefined : {} });
    assert.equal(refus.statut, 405, m);
    assert.equal(refus.entetes.Allow, 'GET', m);
  }
  for (const c of ['/api/debug/base/x/', '/api/debug/base/x/y/', '/api/debug/base/metier/']) {
    assert.equal(appel('GET', c).statut, 404, c);
    assert.equal(appel('POST', c, { corps: {} }).statut, 404, `POST ${c} : 404 avant 405`);
  }
  const sansBase = { ...service, base: () => null };
  assert.equal(appel('GET', '/api/debug/base/', { s: sansBase }).statut, 503);
  assert.equal(appel('POST', '/api/debug/base/', { s: sansBase, corps: {} }).statut, 405, '405 avant 503');
});

test('contenu d’une table : ETag = 16 caractères hex d’un sha256 du JSON du corps, Cache-Control: no-cache ; If-None-Match qui la contient (liste, W/) : 304 sans corps ; une autre page, un autre tri, la page changée : un autre ETag ; rien d’autre ne le change', () => {
  const adresse = '/api/debug/tables/metier/';
  const lire = (recherche = '?limite=5', inm) => appel('GET', adresse, { recherche, entetes: inm === undefined ? {} : { 'if-none-match': inm } });
  const r = lire();
  assert.equal(r.statut, 200);
  const etag = r.entetes.ETag;
  assert.match(etag, /^"[0-9a-f]{16}"$/);
  assert.equal(etag, `"${createHash('sha256').update(JSON.stringify(r.corps)).digest('hex').slice(0, 16)}"`, 'un sha256 du JSON du corps');
  assert.equal(etag, `"${versionDuContenu(JSON.stringify(r.corps))}"`);
  assert.equal(r.brut, JSON.stringify(r.corps), 'le texte servi est celui de l’empreinte');
  assert.equal(r.entetes['Cache-Control'], 'no-cache');
  // le corps ne porte rien qui change sans la table (ni heure, ni version de la base) : le même ETag plus tard, après une écriture ailleurs
  const compte = `compte-etag-${process.pid}`;
  db.prepare('INSERT INTO utilisateur (id, nom_affichage, cree_le) VALUES (?, ?, ?)').run(compte, 'Compte ETag', '2026-10-15T12:00:00Z');
  try {
    assert.equal(lire().entetes.ETag, etag, 'une autre table écrite');
  } finally {
    db.prepare('DELETE FROM utilisateur WHERE id = ?').run(compte);
  }
  // If-None-Match : l'étiquette seule, dans une liste, faible (W/), avec des blancs
  for (const inm of [etag, `W/${etag}`, `"0000000000000000", ${etag}`, `  ${etag} , "x"`]) {
    const n = lire('?limite=5', inm);
    assert.equal(n.statut, 304, inm);
    assert.equal(n.corps, null);
    assert.equal(n.brut, '');
    assert.deepEqual(n.entetes, { ETag: etag, 'Cache-Control': 'no-cache' }, inm);
  }
  for (const inm of ['"0000000000000000"', etag.slice(1, -1), '', `${etag.slice(0, -2)}"`]) assert.equal(lire('?limite=5', inm).statut, 200, `« ${inm} »`);
  // une autre page, une autre taille, un autre tri : d'autres corps, d'autres ETag (l'ancien n'y vaut pas)
  for (const recherche of ['?limite=5&decalage=5', '?limite=6', '?limite=5&tri=nom', '?limite=5&ordre=desc']) {
    const autre = lire(recherche, etag);
    assert.equal(autre.statut, 200, recherche);
    assert.notEqual(autre.entetes.ETag, etag, recherche);
    assert.equal(lire(recherche, autre.entetes.ETag).statut, 304, `${recherche} : sa propre étiquette`);
  }
  // une ligne de la page changée : 200 et un autre ETag ; rendue telle quelle : l'ETag d'avant (il ne dépend que du contenu)
  const premiere = r.corps.lignes[0];
  const loin = ligne('SELECT id, remarque FROM metier ORDER BY id LIMIT 1 OFFSET 20');
  db.prepare('UPDATE metier SET remarque = ? WHERE id = ?').run('changée par le test', premiere.id);
  try {
    const changee = lire('?limite=5', etag);
    assert.equal(changee.statut, 200);
    assert.notEqual(changee.entetes.ETag, etag);
    assert.equal(changee.corps.lignes[0].remarque, 'changée par le test');
  } finally {
    db.prepare('UPDATE metier SET remarque = ? WHERE id = ?').run(premiere.remarque, premiere.id);
  }
  assert.equal(lire('?limite=5', etag).statut, 304, 'rendue telle quelle');
  // une ligne hors de la page : la page ne change pas (la page redemande chaque page affichée : chacune a son ETag)
  db.prepare('UPDATE metier SET remarque = ? WHERE id = ?').run('loin de la page', loin.id);
  try {
    assert.equal(lire('?limite=5', etag).statut, 304);
    assert.equal(lire('?limite=5&decalage=20', etag).statut, 200);
  } finally {
    db.prepare('UPDATE metier SET remarque = ? WHERE id = ?').run(loin.remarque, loin.id);
  }
  // une ligne ajoutée, même hors de la page : le total change, donc la page aussi (« Charger plus » le suit)
  const vide = appel('GET', '/api/debug/tables/utilisateur/');
  db.prepare('INSERT INTO utilisateur (id, nom_affichage, cree_le) VALUES (?, ?, ?)').run(compte, 'Compte ETag', '2026-10-15T12:00:00Z');
  try {
    const plein = appel('GET', '/api/debug/tables/utilisateur/', { entetes: { 'if-none-match': vide.entetes.ETag } });
    assert.deepEqual([plein.statut, plein.corps.total], [200, vide.corps.total + 1]);
  } finally {
    db.prepare('DELETE FROM utilisateur WHERE id = ?').run(compte);
  }
  assert.equal(appel('GET', '/api/debug/tables/utilisateur/', { entetes: { 'if-none-match': vide.entetes.ETag } }).statut, 304, 'supprimée : la page d’avant');
  // une vue aussi ; une erreur n'a pas d'ETag et ne devient jamais 304
  assert.match(appel('GET', '/api/debug/tables/v_niveau/').entetes.ETag, /^"[0-9a-f]{16}"$/);
  for (const [c, recherche, statut] of [['/api/debug/tables/inconnue/', '', 404], [adresse, '?tri=inconnue', 400]]) {
    const e = appel('GET', c, { recherche, entetes: { 'if-none-match': etag } });
    assert.equal(e.statut, statut, c);
    assert.equal(e.entetes?.ETag, undefined, c);
  }
});

test('métriques et journal : les trois routes ont leur gabarit, jamais le nom demandé ; la version de la base est une relève (comptée dans sa ligne, ni au journal ni dans la mémoire des requêtes, hors du global), pas le contenu d’une table', () => {
  for (const [adresse, route] of [
    ['/api/debug/tables/', '/api/debug/tables/'], ['/api/debug/tables', '/api/debug/tables/'], ['/api/debug/tables/metier/?limite=3', '/api/debug/tables/{table}/'],
    ['/api/debug/tables/x%2Fy/', '/api/debug/tables/{table}/'], ['/api/debug/tables/nom-fabrique-123/', '/api/debug/tables/{table}/'],
    ['/api/debug/tables/metier/lignes/', ROUTE_INCONNUE], ['/api/debug/tables//', ROUTE_INCONNUE],
    ['/api/debug/base/', '/api/debug/base/'], ['/api/debug/base', '/api/debug/base/'], ['/api/debug/base/?x=1', '/api/debug/base/'],
    ['/api/debug/base/x/', ROUTE_INCONNUE], ['/api/debug/base//', ROUTE_INCONNUE],
  ]) assert.equal(routeNormalisee(adresse), route, adresse);
  // métriques (serveur/metriques.mjs) : relève en GET ; réussie (2xx, 304), elle n'est pas gardée une à une
  assert.equal(estUneReleve('GET', '/api/debug/base/'), true);
  assert.equal(estUneReleve('POST', '/api/debug/base/'), false);
  assert.equal(estUneReleve('GET', '/api/debug/tables/{table}/'), false, 'le contenu ne se relit que quand la version change');
  assert.equal(estUneReleve('GET', '/api/debug/tables/'), false);
  assert.equal(estUnSuivi('GET', '/api/debug/base/', 200), true);
  assert.equal(estUnSuivi('GET', '/api/debug/base/', 304), true);
  for (const statut of [403, 404, 405, 500, 503]) assert.equal(estUnSuivi('GET', '/api/debug/base/', statut), false, `${statut} : gardée`);
  assert.equal(estUnSuivi('GET', '/api/debug/tables/{table}/', 304), false);
  // journal du service (serveur/journal-du-service.mjs) : la ligne d'une relève réussie n'est notée nulle part ; ses échecs, si
  for (const l of ['GET /api/debug/base/ 200 0 ms', 'GET /api/debug/base 200 1 ms', 'GET /api/debug/base/?t=1 200 1 ms', 'GET /MaverickCenter/api/debug/base/ 304 0 ms']) {
    assert.equal(estUneReleveDuJournal(l), true, l);
  }
  for (const l of ['GET /api/debug/base/ 403 0 ms', 'GET /api/debug/base/ 503 1 ms', 'POST /api/debug/base/ 405 0 ms', 'GET /api/debug/base/x/ 404 0 ms',
    'GET /api/debug/tables/metier/?limite=100 200 3 ms', 'GET /api/debug/tables/metier/ 304 1 ms', 'GET /api/debug/tables/ 200 9 ms',
    'GET /api/v1/metiers/?q=/api/debug/base/ 200 1 ms']) {
    assert.equal(estUneReleveDuJournal(l), false, l);
  }
});

test('base indisponible : 503 ; description OpenAPI : les trois routes, en lecture seulement (Service) ; le contenu avec son ETag et 304, plus de refus des fiches', () => {
  const sansBase = { ...service, base: () => null };
  assert.equal(appel('GET', '/api/debug/tables/', { s: sansBase }).statut, 503);
  assert.equal(appel('GET', '/api/debug/tables/metier/', { s: sansBase }).statut, 503);
  const spec = descriptionOpenApi({ modules: [], ressources: [], version: 'essai' });
  for (const c of ['/debug/tables/', '/debug/tables/{table}/', '/debug/base/']) {
    assert.deepEqual(Object.keys(spec.paths[c]).filter((m) => m !== 'parameters'), ['get'], c);
    assert.equal(spec.paths[c].get.tags[0], 'Service', c);
    assert.ok(spec.paths[c].get.responses[403] && spec.paths[c].get.responses[503], `${c} : 403 (production) et 503`);
  }
  const chemins = Object.keys(spec.paths);
  assert.equal(chemins.indexOf('/debug/base/'), chemins.indexOf('/debug/tables/{table}/') + 1, 'à côté des tables');
  assert.match(spec.paths['/debug/base/'].get.description, /\{ version \}/);
  assert.match(spec.paths['/debug/base/'].get.description, /no-store/);
  const contenu = spec.paths['/debug/tables/{table}/'];
  assert.equal(contenu.parameters[0].name, 'table');
  assert.ok(ligne('SELECT 1 AS n FROM sqlite_schema WHERE name = ?', contenu.parameters[0].example), 'l’exemple est une vraie table');
  assert.deepEqual(contenu.get.parameters.map((p) => `${p.in}:${p.name}`), ['query:limite', 'query:decalage', 'query:tri', 'query:ordre', 'header:If-None-Match']);
  assert.equal(contenu.get.parameters.find((p) => p.name === 'limite').schema.maximum, LIMITE_MAX);
  assert.ok(contenu.get.responses[200].headers.ETag, 'ETag');
  assert.ok(contenu.get.responses[304], '304');
  assert.doesNotMatch(contenu.get.description, /comme \/api\/v1\/ \(ils passent par/, 'plus de refus des fiches');
  assert.match(contenu.get.description, /section 13\) compris/);
});

test('serveur HTTP : un nom de table encodé est relu (« %6Detier », « monstre%5Fespece ») ; « / » encodé, shadow FTS5 : 404 ; écriture : 405 ; sans édition : 403', async () => {
  const regles = join(racine, 'regles-http.db');
  copyFileSync(REGLES, regles);
  const s = await demarrerService({ regles, dossier: join(racine, 'instance-http'), port: 0, intervalle: 0, edition: true, journal: () => {} });
  try {
    let r = await fetch(`${s.url}/api/debug/tables/`);
    assert.equal(r.status, 200);
    assert.ok((await r.json()).tables.some((t) => t.nom === 'monstre_espece'));
    r = await fetch(`${s.url}/api/debug/tables/%6Detier/?limite=3&tri=nom&ordre=desc`);
    assert.equal(r.status, 200);
    const metier = await r.json();
    assert.deepEqual([metier.table, metier.limite, metier.tri, metier.ordre, metier.lignes.length], ['metier', 3, 'nom', 'desc', 3]);
    assert.deepEqual(metier.lignes.map((l) => l.id), lignes('SELECT id FROM metier ORDER BY nom DESC, id DESC LIMIT 3').map((l) => l.id));
    r = await fetch(`${s.url}/api/debug/tables/monstre%5Fespece/`);
    assert.equal(r.status, 200);
    assert.equal((await r.json()).table, 'monstre_espece');
    for (const c of ['x%2Fy', 'metier%2Fx', 'page_fts_data', 'sqlite_schema', encodeURIComponent('metier";--')]) {
      assert.equal((await fetch(`${s.url}/api/debug/tables/${c}/`)).status, 404, c);
    }
    r = await fetch(`${s.url}/api/debug/tables/metier/`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    assert.equal(r.status, 405);
    assert.equal(r.headers.get('allow'), 'GET');
    assert.equal((await fetch(`${s.url}/api/debug/tables/metier/?limite=501`)).status, 400);
  } finally {
    await s.arreter();
  }
  const prod = await demarrerService({ regles, dossier: join(racine, 'instance-prod'), port: 0, intervalle: 0, edition: false, journal: () => {} });
  try {
    for (const c of ['/api/debug/tables/', '/api/debug/tables/metier/', '/api/debug/tables/inconnue/', '/api/debug/tables/personnage/', '/api/debug/base/', '/api/debug/base/x/']) {
      assert.equal((await fetch(`${prod.url}${c}`)).status, 403, c);
    }
  } finally {
    await prod.arreter();
  }
});

test('serveur HTTP : version de la base (no-store ; stable d’une requête à l’autre, l’enveloppe de la connexion étant la même ; changée par une écriture), contenu avec ETag et 304 sans corps, fiche lisible (portrait résumé) ; la relève n’est ni au journal ni dans la mémoire des requêtes, mais comptée dans sa ligne', async () => {
  const regles = join(racine, 'regles-http-version.db');
  copyFileSync(REGLES, regles);
  const sortie = [];
  const s = await demarrerService({
    regles, dossier: join(racine, 'instance-http-version'), port: 0, intervalle: 0, edition: true, journal: (l) => sortie.push(l),
    metriques: { dossier: join(racine, 'metriques-http-version'), intervalle: 0 },
  });
  const JSON_HTTP = { 'Content-Type': 'application/json' };
  try {
    const version = async () => {
      const r = await fetch(`${s.url}/api/debug/base/`);
      assert.equal(r.status, 200);
      assert.equal(r.headers.get('cache-control'), 'no-store');
      return (await r.json()).version;
    };
    const v1 = await version();
    assert.equal(await version(), v1, 'stable d’une requête à l’autre');
    assert.equal((await fetch(`${s.url}/api/debug/tables/metier/?limite=3`)).status, 200);
    assert.equal(await version(), v1, 'une lecture ne la change pas');
    // une écriture : un prétiré avec portrait
    let r = await fetch(`${s.url}/api/personnages/`, { method: 'POST', headers: JSON_HTTP, body: JSON.stringify({ nom: 'Fiche du test HTTP', portrait: IMAGES.png }) });
    assert.equal(r.status, 201);
    const fiche = (await r.json()).personnage.id;
    const v2 = await version();
    assert.notEqual(v2, v1, 'changée par l’écriture');
    assert.equal(await version(), v2);
    // le contenu des fiches : lisible, portrait résumé ; ETag = empreinte du texte reçu, puis 304 sans corps ni type
    const adresse = `${s.url}/api/debug/tables/personnage/?limite=500`;
    r = await fetch(adresse);
    assert.equal(r.status, 200);
    const etag = r.headers.get('etag');
    assert.match(etag, /^"[0-9a-f]{16}"$/);
    assert.equal(r.headers.get('cache-control'), 'no-cache');
    const texte = await r.text();
    assert.equal(etag, `"${versionDuContenu(texte)}"`, 'l’empreinte du texte reçu');
    assert.deepEqual(JSON.parse(texte).lignes.find((l) => l.id === fiche).portrait,
      { image: true, type: 'image/png', octets: octetsDe(IMAGES.png), empreinte: empreinte(IMAGES.png) });
    assert.ok(!texte.includes(morceauDe(IMAGES.png)), 'jamais l’image');
    for (const inm of [etag, `W/${etag}`, `"0000000000000000", ${etag}`]) {
      r = await fetch(adresse, { headers: { 'If-None-Match': inm } });
      assert.equal(r.status, 304, inm);
      assert.equal(r.headers.get('etag'), etag);
      assert.equal(r.headers.get('cache-control'), 'no-cache');
      assert.equal(r.headers.get('content-type'), null, 'un 304 n’a pas de type');
      assert.equal(await r.text(), '');
    }
    r = await fetch(adresse, { headers: { 'If-None-Match': '"0000000000000000"' } });
    assert.equal(r.status, 200);
    await r.arrayBuffer();
    // la version : adresse en trop, écriture
    assert.equal((await fetch(`${s.url}/api/debug/base/x/`)).status, 404);
    r = await fetch(`${s.url}/api/debug/base/`, { method: 'POST', headers: JSON_HTTP, body: '{}' });
    assert.equal(r.status, 405);
    assert.equal(r.headers.get('allow'), 'GET');
    for (let i = 0; i < 3; i++) await version();
    // journal du service : la relève réussie n'y est pas (ni sur la sortie) ; ses échecs et le contenu, si
    const journal = await (await fetch(`${s.url}/api/debug/journal/?categorie=http`)).json();
    assert.ok(!journal.entrees.some((e) => /^GET \/api\/debug\/base\/ 200 /.test(e.message)), 'relève absente du journal');
    assert.ok(!sortie.some((l) => /^GET \/api\/debug\/base\/ 200 /.test(l)), 'ni sur la sortie');
    assert.ok(journal.entrees.some((e) => /^POST \/api\/debug\/base\/ 405 /.test(e.message)), 'un échec y est');
    assert.ok(journal.entrees.some((e) => e.route === '/api/debug/tables/{table}/' && e.statut === 304), 'la relecture d’un contenu (304) y est');
    // métriques : pas dans la mémoire des requêtes ; comptée dans sa ligne, nommée parmi les relèves (hors du global)
    const requetes = (await (await fetch(`${s.url}/api/debug/metriques/requetes/?limite=2000`)).json()).requetes;
    assert.ok(!requetes.some((q) => q.route === '/api/debug/base/' && q.statut === 200), 'relève absente de la mémoire des requêtes');
    assert.ok(requetes.some((q) => q.route === '/api/debug/tables/{table}/' && q.statut === 304), 'le contenu y est');
    const m = await (await fetch(`${s.url}/api/debug/metriques/?periode=1h`)).json();
    const ligneDeLaRoute = m.routes.find((x) => x.route === '/api/debug/base/' && x.methode === 'GET');
    assert.ok(ligneDeLaRoute && ligneDeLaRoute.n >= 8, JSON.stringify(m.routes.map((x) => [x.methode, x.route, x.n])));
    assert.ok(m.releves.routes.includes('GET /api/debug/base/'), 'une relève, hors du global');
  } finally {
    await s.arreter();
  }
});
