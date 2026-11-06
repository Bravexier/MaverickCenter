// Décisions R184 et R185 du propriétaire (2026-11-06) : le nouveau plan des pages de règles. Les rubriques « Créer son personnage », « Les bases » et
// « Règles avancées » font place à quatre onglets sous la rubrique Règles (Fiche de personnage, Mécaniques générales, Les combats, Exploration), chacun
// avec son menu latéral ; les pages sont découpées par sujet en déplaçant le texte tel quel (spécification de game-design et son delta R185).
// Migration data/migrations/0091-r184-plan-des-regles.sql : le plan (regles_onglet, regles_onglet_entree), six pages retirées (quatre supprimées,
// deux absorbées), la note E7 de la liste des effets du Mode Hyper, la page des deux constantes du critique. Les pages découpées et les retouches
// E1 à E12 sont passées par db:sync-pages. Lecture de la base construite ; les écritures se font dans une COPIE, jamais dans var/maverick.db ni
// dans data/rows.
import assert from 'node:assert/strict';
import { copyFileSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { cheminBase, ouvrirBase } from '../src/lib/donnees.mjs';
import { fichierTemporaire } from './aide-dossier-temporaire.mjs';

const MIGRATION = '0091-r184-plan-des-regles.sql';
const lire = (chemin) => readFileSync(new URL(`../../${chemin}`, import.meta.url), 'utf8');
const db = ouvrirBase({ sansExemples: false });
const page = (id) => db.prepare('SELECT * FROM page WHERE id = ?').get(id);
const corps = (id) => page(id).corps_md;
const alias = (id) => db.prepare('SELECT texte FROM alias WHERE page_id = ? ORDER BY ordre').all(id).map((r) => r.texte);
const g = (slugs) => slugs.map((s) => `guide/${s}`);

const FICHE = g(['personnage', 'classe', 'experience-niveau-global', 'attributs', 'caracteristiques', 'competences', 'capacites-dons',
  'maitrise-darme-et-armes', 'armure-defense-bouclier', 'accessoires-et-ceinture', 'inventaire-sac-a-dos', 'tableau-magie',
  'tableau-resistances-faiblesses', 'tableau-posture'].map((s) => `fiche-${s}`));
const ETAPES = g(['choisir-sa-race', 'choisir-ses-magies', 'choisir-sa-classe', 'caracteristiques-et-competences', 'premiers-sorts',
  'finaliser-son-personnage']);
// R184 (4) : les 14 fiches, la création (7 pages), les alignements ; § 1 B et D de la spécification, le delta R185 § 2 pour les combats et pour les
// deux pages tirées de « Les situations avancées » (rater-ses-sortileges, mordhau-ou-demi-epee) ; « Artisanat » juste après « Exercer un métier »
const PLAN = {
  'fiche-de-personnage': [...FICHE, 'guide/creer-son-personnage', ...ETAPES, 'guide/alignement', 'guide/les-neuf-alignements'],
  'mecaniques-generales': g(['reussir-une-action', 'jet-de-des', 'reussites-echecs-et-critiques', 'la-magie-en-jeu', 'rater-ses-sortileges',
    'resistances-et-faiblesses', 'alterations-d-etats', 'liste-des-alterations-d-etat', 'alterations-d-etats-et-mode-hyper', 'meteo']),
  combats: g(['le-tour-de-jeu', 'initiative', 'attaquer-et-se-defendre', 'attaque-et-defense', 'les-attaques-d-opportunite', 'les-attaques-discretes',
    'l-embuscade', 'vitesse-deplacement-et-portee', 'actions-et-mouvements', 'vitesse-et-portee', 'prise-en-tenaille-et-zone-d-influence',
    'deplacement-ou-sortie-de-la-zone-d-influence', 'les-degats', 'formule-des-degats', 'les-postures', 'postures', 'les-boss-et-leurs-postures',
    'le-mode-hyper', 'liste-des-effets-mode-hyper', 'le-mode-hyper-100', 'le-mode-super', 'liste-des-effets-mode-super', 'blessures-et-etats']),
  exploration: [...g(['la-montee-de-niveau', 's-entrainer-et-exercer-un-metier', 'equipement-et-butin', 'l-equipement', 'mordhau-ou-demi-epee',
    'exercer-un-metier']), 'Artisanat', ...g(['les-pieges', 'donjon-pas-bon', 'les-portes', 'distance-et-voyage'])],
};
const RETIREES = g(['les-documents-des-regles', 'en-resume-deroulement-d-un-tour', 'mode-hyper-magie', 'aide-memoire', 'resistance-faiblesse-magie',
  'situations-avancees']);
const NOUVELLES = [...ETAPES, ...g(['equipement-et-butin', 'exercer-un-metier', 'reussites-echecs-et-critiques', 'resistances-et-faiblesses',
  'alterations-d-etats', 'initiative', 'vitesse-deplacement-et-portee', 'prise-en-tenaille-et-zone-d-influence', 'le-mode-hyper-100', 'le-mode-super',
  'deplacement-ou-sortie-de-la-zone-d-influence', 'les-attaques-discretes', 'les-attaques-d-opportunite', 'l-embuscade', 'les-boss-et-leurs-postures',
  'rater-ses-sortileges', 'mordhau-ou-demi-epee'])];

/** Le menu d'un onglet, dans l'ordre : l'id de la page, ou le libellé d'une entrée qui n'est pas une page. */
const menu = (base, onglet) => base.prepare('SELECT page_id, libelle FROM regles_onglet_entree WHERE onglet_id = ? ORDER BY rang, id').all(onglet)
  .map((e) => e.page_id ?? e.libelle);

/** Une copie de la base construite, ouverte en écriture (clés étrangères contrôlées), fermée à la fin du test `t`. */
function copie(t) {
  const chemin = fichierTemporaire('maverick.db', 'r184-plan', { t });
  copyFileSync(cheminBase({ sansExemples: false }), chemin);
  const base = new DatabaseSync(chemin);
  base.exec('PRAGMA foreign_keys = ON');
  t.after(() => base.close());
  return base;
}

test('R184, R185 : quatre onglets, dans l’ordre de la ligne 2 de la rubrique Règles, chacun avec sa page d’ouverture', () => {
  assert.deepEqual(db.prepare('SELECT id, titre, ordre, ouverture_page_id FROM regles_onglet ORDER BY ordre, id').all().map((r) => ({ ...r })), [
    { id: 'fiche-de-personnage', titre: 'Fiche de personnage', ordre: 1, ouverture_page_id: 'guide/creer-son-personnage' },
    { id: 'mecaniques-generales', titre: 'Mécaniques générales', ordre: 2, ouverture_page_id: 'guide/reussir-une-action' },
    { id: 'combats', titre: 'Les combats', ordre: 3, ouverture_page_id: 'guide/le-tour-de-jeu' },
    { id: 'exploration', titre: 'Exploration', ordre: 4, ouverture_page_id: 'guide/la-montee-de-niveau' },
  ]);
});

test('R184, R185 : chaque menu latéral suit la spécification, une page par entrée, sans rang en double ; « Artisanat » est un lien', () => {
  for (const [onglet, attendu] of Object.entries(PLAN)) {
    assert.deepEqual(menu(db, onglet), attendu, onglet);
    const rangs = db.prepare('SELECT rang FROM regles_onglet_entree WHERE onglet_id = ? ORDER BY rang').all(onglet).map((r) => r.rang);
    assert.deepEqual(rangs, rangs.map((_, i) => i + 1), `${onglet} : rangs 1 à ${rangs.length}`);
  }
  assert.deepEqual({ ...db.prepare("SELECT * FROM regles_onglet_entree WHERE page_id IS NULL").get() },
    { id: 'lien:regles/artisanat', onglet_id: 'exploration', rang: 7, page_id: null, libelle: 'Artisanat', adresse: 'regles/artisanat/' });
  // aucune entrée « bientôt » (spécification, Bilan) ; l'entrée d'une page porte l'id 'page:<id de la page>'
  assert.equal(db.prepare("SELECT count(*) AS n FROM regles_onglet_entree WHERE id GLOB 'bientot:*'").get().n, 0);
  assert.equal(db.prepare("SELECT count(*) AS n FROM regles_onglet_entree WHERE page_id IS NOT NULL AND id <> 'page:' || page_id").get().n, 0);
});

test('R184 (P7) : toute page guide/… a sa place : dans un onglet des Règles, ou hors sujet (Découvrir, L’univers, Guide du MJ), ou fixture', () => {
  const horsPlan = db.prepare(`SELECT id, statut FROM page WHERE type = 'guide'
    AND id NOT IN (SELECT page_id FROM regles_onglet_entree WHERE page_id IS NOT NULL) ORDER BY id`).all().map((r) => `${r.id} ${r.statut}`);
  assert.deepEqual(horsPlan, ['guide/bienvenue draft', 'guide/campagne-ou-scenario-one-shot draft', 'guide/guide-pour-mj-maverick draft',
    'guide/l-univers draft', 'guide/un-maitre-du-jeu draft', 'guide/utiliser-ce-wiki example']);
  assert.equal(db.prepare("SELECT count(*) AS n FROM regles_onglet_entree e JOIN page p ON p.id = e.page_id WHERE p.type <> 'guide'").get().n, 0);
});

test('regles_onglet_entree : une page, un lien ou une entrée « bientôt », exactement ; une page n’est que dans un onglet', (t) => {
  const base = copie(t);
  const inserer = (id, onglet, pageId, libelle, adresse) => base.prepare(`INSERT INTO regles_onglet_entree (id, onglet_id, rang, page_id, libelle,
    adresse) VALUES (?, ?, 99, ?, ?, ?)`).run(id, onglet, pageId, libelle, adresse);
  assert.throws(() => inserer('page:guide/meteo', 'combats', 'guide/meteo', null, null), /UNIQUE constraint failed: regles_onglet_entree.page_id/);
  assert.throws(() => inserer('page:guide/bienvenue', 'combats', 'guide/bienvenue', 'Bienvenue', null), /CHECK constraint failed/);
  assert.throws(() => inserer('guide/bienvenue', 'combats', 'guide/bienvenue', null, null), /CHECK constraint failed/);
  assert.throws(() => inserer('page:guide/x', 'combats', null, 'Sans page', null), /CHECK constraint failed/);
  assert.throws(() => inserer('lien:sans-adresse', 'combats', null, 'Lien', null), /CHECK constraint failed/);
  assert.throws(() => inserer('lien:x', 'combats', null, 'Lien', '/regles/x/'), /CHECK constraint failed/);
  assert.throws(() => inserer('bientot:x', 'combats', null, 'Bientôt', 'regles/x/'), /CHECK constraint failed/);
  assert.throws(() => inserer('bientot:x', 'autre', null, 'Bientôt', null), /FOREIGN KEY constraint failed/);
  inserer('bientot:les-donjons', 'exploration', null, 'Les donjons', null);
  inserer('page:guide/bienvenue', 'exploration', 'guide/bienvenue', null, null);
  assert.equal(menu(base, 'exploration').at(-1), 'guide/bienvenue', 'à rang égal, l’id départage');
});

test('regles_onglet : la page d’ouverture est une page de l’onglet ; la retirer ou la déplacer est refusé, une autre page se retire avec son entrée', (t) => {
  const base = copie(t);
  const transaction = (sql) => () => {
    base.exec('BEGIN');
    try { base.exec(sql); base.exec('COMMIT'); } catch (e) { if (base.isTransaction) base.exec('ROLLBACK'); throw e; }
  };
  assert.throws(transaction("UPDATE regles_onglet_entree SET onglet_id = 'combats' WHERE page_id = 'guide/creer-son-personnage'"), /FOREIGN KEY constraint failed/);
  assert.throws(transaction("UPDATE regles_onglet SET ouverture_page_id = 'guide/meteo' WHERE id = 'combats'"), /FOREIGN KEY constraint failed/);
  // retirer une page : ses lignes qui la citent d'abord (liens, sources, mots-clés, alias), la page ensuite
  const retirer = (id) => ['lien WHERE page_id = ? OR cible_page_id = ?', 'page_source WHERE page_id = ?', 'page_tag WHERE page_id = ?',
    'alias WHERE page_id = ?', 'page WHERE id = ?'].map((d) => `DELETE FROM ${d.replaceAll('?', `'${id}'`)};`).join('\n');
  assert.throws(transaction(retirer('guide/la-montee-de-niveau')), /FOREIGN KEY constraint failed/);
  // une autre page du même onglet peut l'ouvrir, dans la même transaction que le déplacement de l'ancienne
  transaction(`UPDATE regles_onglet SET ouverture_page_id = 'guide/choisir-sa-race' WHERE id = 'fiche-de-personnage';
    UPDATE regles_onglet_entree SET onglet_id = 'exploration' WHERE page_id = 'guide/creer-son-personnage'`)();
  assert.equal(menu(base, 'exploration').includes('guide/creer-son-personnage'), true);
  // une page qui n'ouvre aucun onglet se retire avec son entrée (ON DELETE CASCADE)
  transaction(retirer('guide/initiative'))();
  assert.equal(menu(base, 'combats').includes('guide/initiative'), false);
});

test('R184 (9), R185 (3) : six pages retirées, avec leurs alias, leurs mots-clés, leurs renvois, leur écart d’import et les sources qu’elles seules citaient', () => {
  for (const id of RETIREES) {
    assert.equal(page(id), undefined, id);
    for (const [table, colonne] of [['alias', 'page_id'], ['page_tag', 'page_id'], ['page_source', 'page_id'], ['page_entite', 'page_id'],
      ['regles_onglet_entree', 'page_id'], ['lien', 'cible_page_id']]) {
      assert.equal(db.prepare(`SELECT count(*) AS n FROM ${table} WHERE ${colonne} = ?`).get(id).n, 0, `${table} ${id}`);
    }
    assert.equal(db.prepare("SELECT count(*) AS n FROM ecart_source WHERE entite_table = 'page' AND entite_id = ?").get(id).n, 0, id);
    // plus aucun lien écrit vers elles dans le texte d'une page
    assert.equal(db.prepare('SELECT count(*) AS n FROM page WHERE instr(corps_md, ?) > 0').get(`[[${id}`).n, 0, `[[${id}`);
  }
  assert.equal(db.prepare("SELECT count(*) AS n FROM source WHERE id = 'ref:google-sheet-magie-maverick-v8-onglet-mode-hyper-magie'").get().n, 0);
  assert.equal(db.prepare('SELECT count(*) AS n FROM source WHERE id NOT IN (SELECT source_id FROM page_source)').get().n, 0, 'aucune source orpheline');
  // « la page seule » (R184 (9)) : les lignes de l'onglet masqué restent
  assert.ok(db.prepare("SELECT count(*) AS n FROM mode_hyper_effet WHERE version = 'magie_masque'").get().n > 0);
  // E7 : la liste des effets ne renvoie plus à la page retirée
  const liste = corps('guide/liste-des-effets-mode-hyper');
  assert.ok(liste.includes('une autre liste des effets du mode hyper ; les deux listes ne donnent pas toujours les mêmes valeurs.'));
  assert.ok(!liste.includes('Mode Hyper (Magie)'));
  // la migration ne fait que retirer : l'historique du site garde ce qui les citait
  assert.match(lire(`data/migrations/${MIGRATION}`), /historique_modification et de note_version_ligne qui les citent restent/);
});

test('R184, R185 : les pages absorbées et les pages retitrées gardent leurs anciens noms en alias', () => {
  assert.deepEqual(alias('guide/resistances-et-faiblesses'), ['Résistance/Faiblesse Magie', 'Résistance/Faiblesses magique']);
  assert.deepEqual(alias('guide/prise-en-tenaille-et-zone-d-influence'), ['La prise en tenaille', 'Les situations avancées']);
  for (const [id, titre, ancien] of [['guide/le-mode-hyper', 'Le Mode Hyper', 'Le Mode Hyper et le Mode Super'],
    ['guide/blessures-et-etats', 'Blessure et mort', 'Blessures et états'], ['guide/s-entrainer-et-exercer-un-metier', 'S’entraîner', 'S’entraîner et exercer un métier']]) {
    assert.equal(page(id).titre, titre, id);
    assert.deepEqual(alias(id), [ancien], id);
  }
  assert.deepEqual(alias('guide/mordhau-ou-demi-epee'), ['Mordhau ou Demi épée']);
  assert.deepEqual(db.prepare("SELECT tag_id FROM page_tag WHERE page_id = 'guide/mordhau-ou-demi-epee'").all().map((r) => r.tag_id), ['mordhau']);
});

test('R184 : les pages nouvelles, famille docs, résumées par la première phrase de leur texte (réponse du propriétaire), et les blocs suivent leur texte', () => {
  const affiche = (s) => s.replace(/\[\[[^\]|]*\|([^\]]*)\]\]/g, '$1').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/\{\{[^}|]*\|([^}]*)\}\}/g, '$1')
    .replace(/\*\*/g, '').replace(/^- /, '');
  for (const id of NOUVELLES) {
    const p = page(id);
    assert.ok(p, id);
    assert.deepEqual([p.origine, p.statut], ['docs', 'draft'], id);
    const premier = p.corps_md.split('\n').find((l) => l && !l.startsWith('#') && !l.startsWith('<!--') && !l.startsWith('> «'));
    assert.ok(affiche(premier).startsWith(p.resume), `${id} : « ${p.resume} »`);
    const source = db.prepare('SELECT s.texte FROM page_source ps JOIN source s ON s.id = ps.source_id WHERE ps.page_id = ? AND ps.ordre = 0').get(id).texte;
    assert.match(source, /^Google Doc « /, id);
  }
  // les blocs de « Créer son personnage » : chacun une fois, dans la page qui porte son texte (guide:initiative dans l'étape 6)
  const blocs = (id) => corps(id).match(/<!-- guide:[a-z-]+ -->/g) ?? [];
  assert.deepEqual(blocs('guide/creer-son-personnage'), ['<!-- guide:fil-rouge -->']);
  assert.deepEqual(ETAPES.map(blocs), [
    ['<!-- guide:fil-rouge-race -->'], ['<!-- guide:magie-bonus -->', '<!-- guide:fil-rouge-magie -->'], ['<!-- guide:fil-rouge-classe -->'],
    ['<!-- guide:competences -->'], ['<!-- guide:fil-rouge-sorts -->'],
    ['<!-- guide:initiative -->', '<!-- guide:fil-rouge-attributs -->', '<!-- guide:types-de-don -->']]);
  assert.deepEqual(blocs('guide/s-entrainer-et-exercer-un-metier'), ['<!-- guide:entrainement -->']);
  // R185 (4) : le tableau des relations entre magies, juste après le premier paragraphe (le bloc est écrit par le site)
  const rf = corps('guide/resistances-et-faiblesses').split('\n\n');
  assert.equal(rf[1], '<!-- guide:relations-des-magies -->');
  assert.match(rf[0], /^Chaque magie résiste à certaines magies et craint certaines autres/);
});

test('R184 (5) : les retouches E1 à E12 ; plus aucune phrase ne renvoie « plus haut », « plus bas » ou « sur cette page » vers un texte parti', () => {
  assert.ok(corps('guide/creer-son-personnage').includes('en six étapes : chaque étape'));                                         // E1
  assert.ok(corps('guide/exercer-un-metier').includes('(voir « Ses limites » dans [[guide/s-entrainer-et-exercer-un-metier|S’entraîner]])')); // E2
  assert.ok(corps('guide/reussites-echecs-et-critiques').includes('(voir « Le score » dans [[guide/reussir-une-action|Réussir une action]])')); // E3
  assert.ok(corps('guide/les-degats').includes('(voir [[guide/resistances-et-faiblesses|Résistances et faiblesses]])'));            // E4
  assert.ok(corps('guide/le-tour-de-jeu').includes('[[guide/actions-et-mouvements|Les actions et mouvements]] et [[guide/vitesse-et-portee|La vitesse et la portée]] ; sa page')); // E5
  assert.ok(corps('guide/le-mode-hyper').includes('aux valeurs différentes : cette liste ne compte pas'));                            // E6
  assert.ok(corps('guide/alignement').includes('(voir [[guide/les-neuf-alignements|Les neuf alignements]])'));                       // E9
  assert.ok(corps('guide/choisir-ses-magies').includes('## Résistances et faiblesses\n\nVoir [[guide/resistances-et-faiblesses|Résistances et faiblesses]].\n')); // E10
  assert.ok(corps('guide/la-magie-en-jeu').includes('leur page le dit. Voir [[guide/resistances-et-faiblesses|Résistances et faiblesses]].\n')); // E11
  const fiche = corps('guide/fiche-tableau-resistances-faiblesses');                                                                 // E12
  assert.ok(fiche.includes('tout est indiqué [[guide/resistances-et-faiblesses|ici]].') && !fiche.includes('communiquent ensemble'));
  for (const id of ['guide/creer-son-personnage', ...ETAPES, 'guide/exercer-un-metier', 'guide/reussites-echecs-et-critiques']) {
    assert.ok(!/sur cette page|, plus haut\)|« Le score » plus haut/.test(corps(id)), id);
  }
});
