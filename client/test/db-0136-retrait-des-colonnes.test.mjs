// Migration data/migrations/0136-retrait-des-colonnes-du-mot-cle.sql (chantier 4 des mots-clés, « le retrait des colonnes » : docs/chantier-retrait-des-colonnes.md,
// §1 à §4, §7 et §10) : le mot-clé ne garde que id, cle, verrou et monnaie_id ; son nom, son adresse, sa définition, sa couleur et son icône se lisent sur
// son élément (sa page, sinon son sort, sinon son repère), par lib/mots-cles-db.mjs (motsClesDeLaBase, lireUnMotCle, elementDuMotCle) et la vue v_mot_cle.
// Le test lit la structure sur une base neuve du schéma, la lecture sur des bases d'essai aux noms inventés, et rejoue la migration sur deux contenus figés :
// la copie du dépôt à la structure 135 (lue dans l'historique git : le parent du commit qui ajoute la migration, sinon HEAD) et la copie ancrée
// var/ancree/contenu-ancre.db (structure 134, 1 764 mots-clés, hors dépôt). Pour chaque mot-clé, l'objet lu avant et après est le même, champ par champ :
// aucune valeur n'est perdue. Un contenu absent (historique superficiel, fichier non fabriqué) saute son test avec la raison.
//   node --test test/db-0136-retrait-des-colonnes.test.mjs
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { adresseDeLaPageEnBase, adresseDuSortEnBase } from '../src/lib/adresses-db.mjs';
import { lecteurDesMentions, mentionsDe } from '../src/lib/mentions-des-mots-cles.mjs';
import { definitionDuMotCle } from '../src/lib/mots-cles-balises.mjs';
import { elementDuMotCle, lireUnMotCle, motsClesDeLaBase } from '../src/lib/mots-cles-db.mjs';
import { normalize } from '../src/lib/text.mjs';
import { fichierTemporaire } from './aide-dossier-temporaire.mjs';
import { poserUnMotCle } from './aide-mots-cles.mjs';

const RACINE = fileURLToPath(new URL('../../', import.meta.url));
const NOM_DE_LA_MIGRATION = '0136-retrait-des-colonnes-du-mot-cle.sql';
const SCHEMA = readFileSync(join(RACINE, 'data', 'schema.sql'), 'utf8');
const MIGRATION_0135 = readFileSync(join(RACINE, 'data', 'migrations', '0135-reperes.sql'), 'utf8');
const MIGRATION = readFileSync(join(RACINE, 'data', 'migrations', NOM_DE_LA_MIGRATION), 'utf8');
const ANCREE = join(RACINE, 'var', 'ancree', 'contenu-ancre.db');
const CHAMPS = ['libelle', 'url', 'description', 'couleur', 'icone'];
const VUE = ['id', 'cle', 'libelle', 'description', 'couleur', 'icone', 'verrou', 'monnaie_id', 'nb_pages'];

const sansCommentaires = (sql) => sql.replace(/(^|\s)--[^\n]*/g, '$1'); // un « -- » collé à un caractère est dans un motif GLOB ('*--*'), pas un commentaire
const colonnesDe = (db, table) => db.prepare(`SELECT name FROM pragma_table_info('${table}') ORDER BY cid`).all().map((c) => c.name);

/** Une base neuve du schéma, sans clés étrangères (les noms posés sont inventés). */
function baseNeuve() {
  const essai = new DatabaseSync(':memory:', { enableForeignKeyConstraints: false });
  essai.exec(SCHEMA);
  return essai;
}

const poserUnePage = (db, { slug, titre, motCle, definition = null, couleur = null, icone = null }) => db.prepare(`INSERT INTO page (id, type, slug, titre, titre_cle,
  corps_md, statut, origine, mot_cle_id, definition, couleur, icone) VALUES (?, 'guide', ?, ?, ?, '', 'draft', 'docs', ?, ?, ?, ?)`)
  .run(`guide/${slug}`, slug, titre, normalize(titre), motCle, definition, couleur, icone);
const poserUnSort = (db, { id, nom, motCle }) => db.prepare(`INSERT INTO sort (id, magie_id, nom, nom_cle, niveau, ordre, type_brut, ic_direct, imparable,
  inesquivable, cout_brut, cout_chakra, portee_brut, portee_nature, zone_brut, zone_forme, origine, source_ref, mot_cle_id)
  VALUES (?, 'magies/magie-d-essai', ?, ?, 1, (SELECT count(*) + 1 FROM sort), 'Attaque', 0, 0, 0, '3', 3, 'Vue', 'vue', '1', 'unique', 'magies', 'essai', ?)`)
  .run(id, nom, normalize(nom), motCle);

/** Les champs que lireUnMotCle rend, sans l'élément. */
const champsLus = (m) => Object.fromEntries(['id', 'cle', 'verrou', 'monnaie_id', ...CHAMPS].map((c) => [c, m[c]]));

test('0136 : mot_cle ne garde que id, cle, verrou, monnaie_id ; page gagne definition, couleur, icone (en dernier), avec les contraintes du repère', () => {
  const essai = baseNeuve();
  assert.deepEqual(colonnesDe(essai, 'mot_cle'), ['id', 'cle', 'verrou', 'monnaie_id']);
  assert.deepEqual(colonnesDe(essai, 'page').slice(-3), ['definition', 'couleur', 'icone'], 'les colonnes ajoutées vont en dernier');
  assert.deepEqual(colonnesDe(essai, 'v_mot_cle'), VUE, 'la vue, sans l’adresse');
  // mêmes refus que le repère (définition vide, couleur et icône hors de leur forme)
  essai.prepare("INSERT INTO mot_cle (id, cle) VALUES (1, 'essai-1')").run();
  for (const [colonne, valeur] of [['definition', ''], ['couleur', 'Rouge'], ['couleur', '#ABCDEF'], ['icone', 'monnaie'], ['icone', 'Monnaie:rf']]) {
    assert.throws(() => poserUnePage(essai, { slug: 'essai-refus', titre: 'Essai refus', motCle: 1, [colonne]: valeur }), /CHECK/, `page.${colonne} = ${valeur}`);
    assert.throws(() => essai.prepare(`INSERT INTO repere (mot_cle_id, nom, ${colonne}) VALUES (1, 'Essai', ?)`).run(valeur), /CHECK/, `repere.${colonne} = ${valeur}`);
  }
  poserUnePage(essai, { slug: 'essai-admis', titre: 'Essai admis', motCle: 1, definition: 'Texte d’essai.', couleur: 'classe:melee', icone: 'monnaie:rf' });
  essai.close();
});

test('0136 : la migration ne gère ni transaction ni PRAGMA, retire et refait v_mot_cle, et ne réécrit pas mot_cle par DROP COLUMN', () => {
  const sql = sansCommentaires(MIGRATION);
  assert.doesNotMatch(sql, /\b(BEGIN|COMMIT|ROLLBACK|PRAGMA)\b/i);
  assert.match(sql, /^DROP VIEW v_mot_cle;/m, 'la vue part avant que les colonnes ne partent');
  assert.doesNotMatch(sql, /DROP\s+COLUMN/i, 'la table est refaite (SQLite ancien : « error in table mot_cle after drop column »)');
});

test('0136 (C3) : lireUnMotCle et elementDuMotCle lisent la page, sinon le sort, sinon le repère ; la vue et motsClesDeLaBase disent pareil', () => {
  const essai = baseNeuve();
  essai.exec("INSERT INTO mot_cle (id, cle, verrou) VALUES (1, 'essai-de-page', 1), (2, 'essai-de-sort', 0)");
  poserUnePage(essai, { slug: 'essai-de-page', titre: 'Essai de page', motCle: 1, definition: 'Définition d’essai.', couleur: '#123abc', icone: 'monnaie:ro' });
  poserUnSort(essai, { id: 'magies/magie-d-essai#sort:essai-de-sort', nom: 'Essai de sort', motCle: 2 });
  const repere = poserUnMotCle(essai, { libelle: 'Essai de repère', url: '/fiche/', description: 'Autre définition.', couleur: 'classe:melee', icone: 'monnaie:pp' });

  assert.deepEqual(lireUnMotCle(essai, 1), {
    id: 1, cle: 'essai-de-page', verrou: 1, monnaie_id: null, libelle: 'Essai de page', url: adresseDeLaPageEnBase(essai, 'guide/essai-de-page'),
    description: 'Définition d’essai.', couleur: '#123abc', icone: 'monnaie:ro', element: { table: 'page', id: 'guide/essai-de-page' },
  });
  assert.deepEqual(lireUnMotCle(essai, 2), {
    id: 2, cle: 'essai-de-sort', verrou: 0, monnaie_id: null, libelle: 'Essai de sort', url: adresseDuSortEnBase(essai, 'magies/magie-d-essai#sort:essai-de-sort'),
    description: null, couleur: null, icone: null, element: { table: 'sort', id: 'magies/magie-d-essai#sort:essai-de-sort' },
  }, 'un mot-clé de sort n’a ni définition, ni couleur, ni icône');
  assert.deepEqual(lireUnMotCle(essai, repere), {
    id: repere, cle: normalize('Essai de repère'), verrou: 0, monnaie_id: null, libelle: 'Essai de repère', url: '/fiche/', description: 'Autre définition.',
    couleur: 'classe:melee', icone: 'monnaie:pp', element: { table: 'repere', id: repere },
  });
  assert.equal(lireUnMotCle(essai, 99999), null);
  for (const id of [1, 2, repere]) assert.deepEqual(elementDuMotCle(essai, id), lireUnMotCle(essai, id).element);
  assert.equal(elementDuMotCle(essai, 99999), null);

  // la page l'emporte sur le sort (un mot-clé n'a qu'un élément : db:check le contrôle ; la lecture reste déterministe)
  poserUnSort(essai, { id: 'magies/magie-d-essai#sort:essai-double', nom: 'Essai double', motCle: 1 });
  assert.equal(elementDuMotCle(essai, 1).table, 'page');

  const vocabulaire = new Map(motsClesDeLaBase(essai).map((m) => [m.id, m]));
  const vue = new Map(essai.prepare('SELECT * FROM v_mot_cle').all().map((l) => [l.id, l]));
  for (const id of [1, 2, repere]) {
    const lu = lireUnMotCle(essai, id);
    assert.deepEqual(champsLus(vocabulaire.get(id)), champsLus(lu), `motsClesDeLaBase, mot-clé ${id}`);
    const ligne = { ...vue.get(id) };
    assert.deepEqual(VUE.filter((c) => c !== 'nb_pages').map((c) => ligne[c]), VUE.filter((c) => c !== 'nb_pages').map((c) => lu[c]), `v_mot_cle, mot-clé ${id}`);
  }
  assert.equal(vue.size, 3, 'une ligne par mot-clé, même avec deux éléments');
  essai.close();
});

test('0136 (C3) : une base à l’ancienne structure (colonne mot_cle.libelle) se lit dans les colonnes du mot-clé, élément compris', () => {
  const essai = baseNeuve();
  // la structure d'avant la migration, pour ce que la lecture en voit : les cinq colonnes sur la ligne du mot-clé
  essai.exec('DROP VIEW v_mot_cle');
  for (const c of CHAMPS) essai.exec(`ALTER TABLE mot_cle ADD COLUMN ${c} TEXT`);
  const id = poserUnMotCle(essai, { libelle: 'Essai ancien', url: '/fiche/', description: 'Définition ancienne.', couleur: '#00ff00', icone: 'monnaie:rf' });
  assert.equal(essai.prepare('SELECT count(*) n FROM repere').get().n, 0, 'aucun repère posé à l’ancienne structure');
  const page = poserUnMotCle(essai, { libelle: 'Essai ancré', url: '/guide/essai-ancre/', description: 'Écrite sur le mot-clé.' });
  poserUnePage(essai, { slug: 'essai-ancre', titre: 'Titre de la page', motCle: page });

  const lu = lireUnMotCle(essai, id);
  assert.deepEqual(champsLus(lu), { id, cle: normalize('Essai ancien'), verrou: 0, monnaie_id: null, libelle: 'Essai ancien', url: '/fiche/',
    description: 'Définition ancienne.', couleur: '#00ff00', icone: 'monnaie:rf' });
  assert.equal(lu.element, null, 'ni page, ni sort, ni repère');
  const ancre = lireUnMotCle(essai, page);
  assert.equal(ancre.libelle, 'Essai ancré', 'les colonnes font foi à l’ancienne structure');
  assert.equal(ancre.description, 'Écrite sur le mot-clé.');
  assert.deepEqual(ancre.element, { table: 'page', id: 'guide/essai-ancre' });
  assert.deepEqual(elementDuMotCle(essai, page), ancre.element);
  const vocabulaire = new Map(motsClesDeLaBase(essai).map((m) => [m.id, m]));
  for (const k of [id, page]) assert.deepEqual(champsLus(vocabulaire.get(k)), champsLus(lireUnMotCle(essai, k)), `mot-clé ${k}`);
  essai.close();
});

test('0136 (C7) : le repère et la définition d’une page sont des textes qui mentionnent ; la sienne ne compte pas, ni son adresse, sa couleur, son icône', () => {
  const essai = baseNeuve();
  const a = poserUnMotCle(essai, { libelle: 'Essai a', url: '/fiche/', couleur: 'classe:melee', description: 'Voir {{essai-b}} et {{essai-a}}.' });
  essai.prepare("INSERT INTO mot_cle (id, cle) VALUES (?, 'essai-b')").run(a + 1);
  poserUnePage(essai, { slug: 'essai-b', titre: 'Essai b', motCle: a + 1, definition: 'Lui-même : {{essai-b}} ; l’autre : {{essai-a}}.' });
  const vues = (id) => mentionsDe(essai, id).map((m) => `${m.table} ${JSON.stringify(m.cle)} ${m.colonne} ${m.libelle}`);
  assert.deepEqual(vues(a), ['page {"id":"guide/essai-b"} definition Mot-clé « Essai b »'], 'la définition d’une autre page ; pas la sienne');
  assert.deepEqual(vues(a + 1), [`repere {"mot_cle_id":${a}} definition Mot-clé « Essai a »`], 'la définition d’un autre repère ; pas la sienne');
  // un mot-clé retiré depuis la lecture : la définition de son repère ne mentionne plus (lecteurDesMentions)
  const lecteur = lecteurDesMentions(essai);
  assert.equal(lecteur.de(a + 1).length, 1);
  essai.prepare('DELETE FROM mot_cle WHERE id = ?').run(a);
  assert.deepEqual(lecteur.de(a + 1), []);
  essai.close();
});

// ---------------------------------------------------------------------------------------------------------------------------------------------------
// La migration rejouée sur deux contenus figés : rien ne se perd.

/** Le commit dont data/rows est à la structure 135 : le parent de celui qui ajoute la migration (HEAD tant qu'elle n'est pas commitée), ou une raison. */
function commitA135() {
  const git = (args, input) => spawnSync('git', args, { cwd: RACINE, input, maxBuffer: 1 << 30 });
  const ajout = git(['log', '--diff-filter=A', '--format=%H', '-1', '--', `data/migrations/${NOM_DE_LA_MIGRATION}`]);
  if (ajout.status !== 0) return { raison: `historique git illisible : ${ajout.stderr}` };
  const sha = ajout.stdout.toString().trim();
  const rev = sha ? `${sha}^` : 'HEAD';
  const version = git(['show', `${rev}:data/rows/VERSION`]);
  if (version.status !== 0 || !/schema_version=135\b/.test(version.stdout.toString())) return { raison: `${rev} : data/rows n’est pas à la structure 135 (historique superficiel ?)` };
  return { git, rev };
}

/** La copie du dépôt à la structure 135 (schéma et data/rows du commit `rev`), construite dans `fichier`. */
function depotA135(fichier, { git, rev }) {
  const noms = git(['ls-tree', '--name-only', rev, 'data/rows/']).stdout.toString().split('\n').filter((n) => n.endsWith('.sql'));
  const lot = git(['cat-file', '--batch'], [`${rev}:data/schema.sql`, ...noms.map((n) => `${rev}:${n}`)].join('\n') + '\n');
  assert.equal(lot.status, 0, String(lot.stderr));
  const contenus = [];
  for (let i = 0; i < lot.stdout.length;) {
    const fin = lot.stdout.indexOf(0x0a, i);
    const taille = Number(lot.stdout.subarray(i, fin).toString().split(' ')[2]);
    contenus.push(lot.stdout.subarray(fin + 1, fin + 1 + taille).toString('utf8'));
    i = fin + 1 + taille + 1;
  }
  const db = new DatabaseSync(fichier, { enableForeignKeyConstraints: false });
  db.exec(contenus[0]);
  db.exec('BEGIN');
  for (const sql of contenus.slice(1)) db.exec(sql);
  db.exec('COMMIT');
  return db;
}

/** Applique la migration (clés étrangères suspendues, comme tools/db/maverick.py#migrer et le service) et rend { avant, apres } : motsClesDeLaBase. */
function rejouer(db) {
  db.exec('PRAGMA foreign_keys = OFF');
  const avant = motsClesDeLaBase(db);
  assert.ok(colonnesDe(db, 'mot_cle').includes('libelle'), 'la base part de l’ancienne structure');
  db.exec('BEGIN');
  db.exec(MIGRATION);
  db.exec('COMMIT');
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), [], 'aucune référence rompue');
  assert.deepEqual(colonnesDe(db, 'mot_cle'), ['id', 'cle', 'verrou', 'monnaie_id']);
  return { avant, apres: motsClesDeLaBase(db) };
}

/** Aucune valeur perdue ; un repère pour chaque mot-clé sans page ni sort, aucun autre ; lireUnMotCle et la vue disent comme motsClesDeLaBase. */
function verifierSansPerte(db, { avant, apres }) {
  assert.ok(avant.length > 0, 'des mots-clés');
  assert.deepEqual(apres.map((m) => m.id), avant.map((m) => m.id), 'les mêmes mots-clés');
  const parId = new Map(apres.map((m) => [m.id, m]));
  for (const m of avant) assert.deepEqual(parId.get(m.id), m, `mot-clé ${m.id} (${m.cle}) : le même objet avant et après`);

  const ancres = new Set(db.prepare('SELECT mot_cle_id AS id FROM page WHERE mot_cle_id IS NOT NULL UNION SELECT mot_cle_id FROM sort WHERE mot_cle_id IS NOT NULL').all().map((r) => r.id));
  const reperes = db.prepare('SELECT mot_cle_id AS id FROM repere ORDER BY mot_cle_id').all().map((r) => r.id);
  assert.deepEqual(reperes, avant.map((m) => m.id).filter((id) => !ancres.has(id)), 'un repère si et seulement si ni page ni sort (C0)');

  const vue = new Map(db.prepare('SELECT * FROM v_mot_cle').all().map((l) => [l.id, { ...l }]));
  assert.equal(vue.size, avant.length, 'une ligne de la vue par mot-clé');
  for (const m of apres) {
    const lu = lireUnMotCle(db, m.id);
    assert.deepEqual(champsLus(lu), champsLus(m), `lireUnMotCle ${m.id}`);
    assert.ok(lu.element, `mot-clé ${m.id} : un élément`);
    for (const c of ['libelle', 'description', 'couleur', 'icone']) assert.equal(vue.get(m.id)[c], m[c], `v_mot_cle ${m.id}.${c}`);
  }
}

/** R268 : Bête, Mécanique et Démon (retrouvés par leur clé, dans un contenu figé) n'ont pas d'infobulle, avant comme après. */
function verifierR268({ avant, apres }) {
  for (const nom of ['Bête', 'Mécanique', 'Démon']) {
    const cle = normalize(nom);
    const a = avant.find((m) => m.cle === cle);
    const b = apres.find((m) => m.cle === cle);
    assert.ok(a && b, `${nom} : présent`);
    assert.equal(definitionDuMotCle(a), null, `${nom} : sans infobulle avant (R268)`);
    assert.equal(definitionDuMotCle(b), null, `${nom} : sans infobulle après (R268)`);
  }
}

const depot = commitA135();
test('0136 : rejouée sur la copie du dépôt à la structure 135, aucune valeur perdue ; R268', { skip: depot.raison ?? false }, () => {
  const db = depotA135(fichierTemporaire('depot-135.db', 'db-0136-'), depot);
  const lu = rejouer(db);
  verifierSansPerte(db, lu);
  verifierR268(lu);
  db.close();
});

test('0136 : rejouée sur la copie ancrée (structure 134, puis 0135), aucune valeur perdue ; R268', { skip: existsSync(ANCREE) ? false : `${ANCREE} absente (var/ancree/fabriquer.mjs)` }, () => {
  const fichier = fichierTemporaire('ancree.db', 'db-0136-');
  copyFileSync(ANCREE, fichier);
  const db = new DatabaseSync(fichier, { enableForeignKeyConstraints: false });
  db.exec('BEGIN');
  db.exec(MIGRATION_0135);
  db.exec('COMMIT');
  const lu = rejouer(db);
  assert.ok(lu.avant.some((m) => m.element?.table === 'page'), 'des mots-clés ancrés à une page');
  verifierSansPerte(db, lu);
  verifierR268(lu);
  db.close();
});
