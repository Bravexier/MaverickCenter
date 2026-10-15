// Contenu des tables de la base vivante pour le cadre « Schéma de la base » de la page Debug (client/serveur/debug-tables.mjs, api.mjs ; docs/api.md,
// « Page Debug » ; demande du propriétaire du 2026-10-15 : « D'un double clic sur une de ces tables, ça ouvrirait une popup avec le contenu dans un
// tableau (scrollable) ») : site de dev seulement (403 ailleurs, avant 404 et 405), liste des tables et vues (ni internes ni FTS5), 404 pour un nom
// inconnu ou piégé, 400 pour un tri ou une page hors bornes, pagination et total, ordre stable, images et textes longs résumés (jamais un portrait
// entier), vues lisibles, lecture seule (405 avec Allow ; rien que des SELECT et des PRAGMA de lecture), gabarits des métriques
// (serveur/metriques.mjs#routeNormalisee), puis le vrai serveur HTTP (nom encodé).
// Base vivante neuve dans un dossier temporaire.
//   node --test test/serveur-debug-tables.test.mjs
import assert from 'node:assert/strict';
import { copyFileSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { after, test } from 'node:test';
import { traiter } from '../serveur/api.mjs';
import { ouvrirBaseVivante, preparerBaseVivante } from '../serveur/base-vivante.mjs';
import { LIMITE_MAX, LIMITE_PAR_DEFAUT, lireTable, RAISON_FICHES, TABLES_DERIVEES, tablesDesFiches, TEXTE_MAX, valeurResumee } from '../serveur/debug-tables.mjs';
import { TABLES_EDITION } from '../serveur/base-vivante.mjs';
import { TABLES_FICHES } from '../src/lib/fiche-format.mjs';
import { ROUTE_INCONNUE, routeNormalisee } from '../serveur/metriques.mjs';
import { descriptionOpenApi } from '../serveur/openapi.mjs';
import { demarrerService } from '../serveur/service.mjs';
import { cheminBase, trouverRacine } from '../src/lib/donnees.mjs';
import { empreinte } from '../src/lib/portrait.mjs';
import { lireSchema } from '../src/lib/schema-doc.mjs';

/** Images écrites par Chromium (test/portrait.test.mjs) : WebP, JPEG et PNG de 3 × 2 pixels. */
const IMAGES = JSON.parse(readFileSync(new URL('./fixtures/portraits.json', import.meta.url), 'utf8'));
/** Les octets d'une data URL, décodés à part (pas par le module essayé). */
const octetsDe = (dataUrl) => Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64').length;

const racine = mkdtempSync(join(tmpdir(), 'maverick-debug-tables-'));
after(() => rmSync(racine, { recursive: true, force: true }));
const REGLES = cheminBase({ sansExemples: false });
const { chemin } = preparerBaseVivante({ regles: REGLES, dossier: join(racine, 'db') });
const db = ouvrirBaseVivante(chemin);
const service = { base: () => db, etat: () => ({ service: 'essai', version: '0.0.0-essai' }), journal: () => {}, edition: true };
const JSON_ = { 'content-type': 'application/json' };
const appel = (methode, chemin_, { s = service, corps, recherche } = {}) =>
  traiter({ methode, chemin: chemin_, recherche, entetes: JSON_, corps: corps === undefined ? undefined : JSON.stringify(corps) }, s);
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
const OBJETS = lireSchema(readFileSync(join(trouverRacine(), 'data', 'schema.sql'), 'utf8')).flatMap((s) => s.objets);

test('fermé hors du site de dev (décision du propriétaire, 2026-10-15) : 403 sur la liste et le contenu, avant 404 (nom inconnu, adresse en trop) et 405 (écriture)', () => {
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
  assert.equal(tables.filter((t) => t.genre !== 'vue').length, 192, '192 tables STRICT');
  assert.equal(tables.filter((t) => t.genre === 'vue').length, 35, '35 vues');
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
  // les tables des fiches (section 13), du journal (14) et des notes de version (15) en sont (leur nombre de lignes ; le contenu des fiches : 403)
  for (const nom of ['personnage', 'utilisateur', 'modification_lot', 'modification', 'note_version', 'historique_modification']) assert.ok(noms.includes(nom), nom);
});

test('fiches (section 13) : listées, mais leur contenu répond 403 avec la raison, comme /api/v1/ — tables et vues qui les lisent ; le journal (14) se lit', () => {
  // la liste épinglée : avec la connexion Discord (fiches de joueur privées, comptes), une table de plus dans la section 13 doit être revue ici
  const section13 = OBJETS.filter((o) => (o.genre === 'table' || o.genre === 'vue') && lireSchema(readFileSync(join(trouverRacine(), 'data', 'schema.sql'), 'utf8'))
    .find((s) => s.titre.startsWith('13.')).objets.some((x) => x.nom === o.nom)).map((o) => o.nom).sort();
  assert.deepEqual(tablesDesFiches(db), section13, 'exactement la section 13 : ses tables et ses vues');
  assert.deepEqual(tablesDesFiches(db).filter((n) => !n.startsWith('v_')), [...TABLES_FICHES].sort());
  assert.deepEqual(tablesDesFiches(db).filter((n) => n.startsWith('v_')),
    ['v_groupe_controle', 'v_personnage_controle', 'v_personnage_metier_bonus', 'v_personnage_niveau', 'v_personnage_visible']);
  for (const nom of section13) {
    for (const recherche of ['', '?tri=inconnue', '?limite=0']) {
      const r = appel('GET', `/api/debug/tables/${nom}/`, { recherche });
      assert.equal(r.statut, 403, `${nom}${recherche}`);
      assert.equal(r.corps.erreur, RAISON_FICHES);
    }
  }
  assert.match(RAISON_FICHES, /\/api\/personnages\/ et ses règles de visibilité \(v_personnage_visible\)/);
  // le journal de l'édition (section 14) et les notes de version (15) se lisent (GET /api/edition/journal/ exporte déjà le journal sur le site de dev)
  for (const nom of [...TABLES_EDITION, 'note_version', 'historique_modification']) assert.equal(appel('GET', `/api/debug/tables/${nom}/`).statut, 200, nom);
  // le schéma de la page les dessine toujours : ils restent dans la liste, avec leur nombre de lignes
  const { tables } = ok(appel('GET', '/api/debug/tables/'));
  for (const nom of section13) assert.ok(tables.some((t) => t.nom === nom), nom);
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
  // une vue des fiches (section 13) ne se lit pas ici (403 : test « fiches »), une autre vue de la section 12 si
  assert.equal(appel('GET', '/api/debug/tables/v_personnage_controle/').statut, 403);
  assert.equal(ok(appel('GET', '/api/debug/tables/v_niveau/')).genre, 'vue');
  // une table dérivée
  const lien = ok(appel('GET', '/api/debug/tables/lien/', { recherche: '?limite=3' }));
  assert.deepEqual([lien.genre, lien.total], ['derivee', ligne('SELECT count(*) AS n FROM lien').n]);
});

/** Un morceau du base64 d'une image (40 à 120 caractères après la virgule) : jamais dans une réponse. */
const morceauDe = (image) => image.slice(image.indexOf(',') + 41, image.indexOf(',') + 121);

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
  for (const t of ['metier', 'monstre', 'v_niveau', 'lien']) {
    ok(appel('GET', `/api/debug/tables/${t}/`, { s, recherche: `?tri=${lignes(`PRAGMA table_info("${t}")`)[0].name}&ordre=desc` }));
  }
  appel('GET', '/api/debug/tables/inconnue/', { s });
  appel('GET', '/api/debug/tables/metier/', { s, recherche: '?tri=inconnue' });
  assert.ok(preparees.length > 200, `${preparees.length} instructions`);
  for (const sql of preparees) assert.match(sql, /^(SELECT |PRAGMA main\.table_list$|PRAGMA main\.table_info\("[a-z0-9_]+"\)$)/, sql);
  assert.ok(appel('GET', '/api/debug/tables/personnage/', { s }).statut === 403, 'une table des fiches : rien n’est lu');
});

test('métriques : les deux routes ont leur gabarit, jamais le nom demandé (le nombre de routes reste borné, même pour un nom fabriqué)', () => {
  for (const [adresse, route] of [
    ['/api/debug/tables/', '/api/debug/tables/'], ['/api/debug/tables', '/api/debug/tables/'], ['/api/debug/tables/metier/?limite=3', '/api/debug/tables/{table}/'],
    ['/api/debug/tables/x%2Fy/', '/api/debug/tables/{table}/'], ['/api/debug/tables/nom-fabrique-123/', '/api/debug/tables/{table}/'],
    ['/api/debug/tables/metier/lignes/', ROUTE_INCONNUE], ['/api/debug/tables//', ROUTE_INCONNUE],
  ]) assert.equal(routeNormalisee(adresse), route, adresse);
});

test('base indisponible : 503 ; description OpenAPI : les deux routes, en lecture seulement (Service)', () => {
  const sansBase = { ...service, base: () => null };
  assert.equal(appel('GET', '/api/debug/tables/', { s: sansBase }).statut, 503);
  assert.equal(appel('GET', '/api/debug/tables/metier/', { s: sansBase }).statut, 503);
  const spec = descriptionOpenApi({ modules: [], ressources: [], version: 'essai' });
  for (const c of ['/debug/tables/', '/debug/tables/{table}/']) {
    assert.deepEqual(Object.keys(spec.paths[c]).filter((m) => m !== 'parameters'), ['get'], c);
    assert.equal(spec.paths[c].get.tags[0], 'Service', c);
  }
  const contenu = spec.paths['/debug/tables/{table}/'];
  assert.equal(contenu.parameters[0].name, 'table');
  assert.ok(ligne('SELECT 1 AS n FROM sqlite_schema WHERE name = ?', contenu.parameters[0].example), 'l’exemple est une vraie table');
  assert.deepEqual(contenu.get.parameters.map((p) => p.name), ['limite', 'decalage', 'tri', 'ordre']);
  assert.equal(contenu.get.parameters.find((p) => p.name === 'limite').schema.maximum, LIMITE_MAX);
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
    for (const c of ['/api/debug/tables/', '/api/debug/tables/metier/', '/api/debug/tables/inconnue/']) assert.equal((await fetch(`${prod.url}${c}`)).status, 403, c);
  } finally {
    await prod.arreter();
  }
});
