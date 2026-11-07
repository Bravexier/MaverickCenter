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
import { historiqueSite } from '../src/lib/historique-site.mjs';
import { raisonsDeProtection } from '../src/lib/pages-protegees.mjs';
import { fichierTemporaire } from './aide-dossier-temporaire.mjs';
import { texteSansBalises } from '../src/lib/mots-cles-balises.mjs';
import { chargerVocabulaire } from '../src/lib/mots-cles-db.mjs';
import { baseDImport, lotsAvant } from './aide-base-d-import.mjs';
import { ecrituresDuTexte } from './aide-ecritures-du-lien.mjs';

const MIGRATION = '0091-r184-plan-des-regles.sql';
const lire = (chemin) => readFileSync(new URL(`../../${chemin}`, import.meta.url), 'utf8');
const db = ouvrirBase({ sansExemples: false });
const page = (id) => db.prepare('SELECT * FROM page WHERE id = ?').get(id);
const corps = (id) => page(id).corps_md;
const alias = (id) => db.prepare('SELECT texte FROM alias WHERE page_id = ? ORDER BY ordre').all(id).map((r) => r.texte);
const g = (slugs) => slugs.map((s) => `guide/${s}`);
// Le texte et le titre d'une page sont modifiables sur le site de dev, source de ce qu'il modifie : ce que la 0091 et db:sync-pages ont écrit se lit dans
// l'état d'après la migration (test/aide-base-d-import.mjs : seuls les lots rapatriés après elle se défont ; fixtures/lots-avant-0093.json, la même
// liste qu'avant la 0090, aucun lot rapatrié entre les deux) ; l'état courant, par des invariants (alias gardés, bloc appelé une fois au plus).
const apres0091 = () => baseDImport({ garder: lotsAvant('0093') });
const pageApres0091 = (id) => apres0091().prepare('SELECT * FROM page WHERE id = ?').get(id);
const corpsApres0091 = (id) => pageApres0091(id).corps_md;
const aliasApres0091 = (id) => apres0091().prepare('SELECT texte FROM alias WHERE page_id = ? ORDER BY ordre').all(id).map((r) => r.texte);

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
// Trois pages des combats retirées depuis (2026-11-06, migration 0094, demande du propriétaire : « Postures », « Les boss et leurs postures »,
// « Mode Super ») : le plan et les pages nouvelles de la migration 0091 se lisent sans elles (db-retrait-pages-doublons-des-combats.test.mjs) ;
// de même la « Liste des effets mode hyper » (2026-11-06, migration 0095 : db-retrait-liste-des-effets-mode-hyper.test.mjs) et « Altérations d'états
// et Mode Hyper » (2026-11-06, migration 0096 : db-retrait-alterations-d-etats-et-mode-hyper.test.mjs)
const RETIREES_DEPUIS = g(['postures', 'les-boss-et-leurs-postures', 'le-mode-super', 'liste-des-effets-mode-hyper', 'alterations-d-etats-et-mode-hyper']);
const sansLesRetireesDepuis = (ids) => ids.filter((id) => !RETIREES_DEPUIS.includes(id));
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

// Le site de dev est la source de ce qu'il modifie : l'édition réordonne les entrées des menus, change une page d'onglet, crée ou supprime une page des
// Règles (lot de l'édition des menus). Le plan de la migration 0091 se lit donc dans l'historique (lignesDImport) ; l'état courant, par des invariants.
const historique = historiqueSite(db);
const ENTREES_D_IMPORT = historique.lignesDImport('regles_onglet_entree');
/** Le menu d'un onglet à l'import, dans l'ordre (rang, puis id) : l'id de la page, ou le libellé d'une entrée qui n'est pas une page. */
const menuDImport = (onglet) => ENTREES_D_IMPORT.filter((e) => e.onglet_id === onglet)
  .sort((a, b) => a.rang - b.rang || (a.id < b.id ? -1 : 1)).map((e) => e.page_id ?? e.libelle);
const ONGLETS = [
  { id: 'fiche-de-personnage', titre: 'Fiche de personnage', ordre: 1, ouverture_page_id: 'guide/creer-son-personnage' },
  { id: 'mecaniques-generales', titre: 'Mécaniques générales', ordre: 2, ouverture_page_id: 'guide/reussir-une-action' },
  { id: 'combats', titre: 'Les combats', ordre: 3, ouverture_page_id: 'guide/le-tour-de-jeu' },
  { id: 'exploration', titre: 'Exploration', ordre: 4, ouverture_page_id: 'guide/la-montee-de-niveau' },
];

test('R184, R185 : quatre onglets, dans l’ordre de la ligne 2 de la rubrique Règles, chacun avec sa page d’ouverture ; l’édition n’y touche pas', () => {
  const tri = (l) => [...l].sort((a, b) => a.ordre - b.ordre || (a.id < b.id ? -1 : 1));
  assert.deepEqual(tri(historique.lignesDImport('regles_onglet')).map((r) => ({ ...r })), ONGLETS);
  // l'ordre des onglets et leur page d'ouverture sont fixes (choix du propriétaire : « Non, fixe ») : l'état courant est celui de l'import
  assert.deepEqual(db.prepare('SELECT id, titre, ordre, ouverture_page_id FROM regles_onglet ORDER BY ordre, id').all().map((r) => ({ ...r })), ONGLETS);
  assert.equal(historique.tables().includes('regles_onglet'), false, 'aucune modification du site sur regles_onglet');
});

test('R184, R185 : à l’import, chaque menu latéral suit la spécification, une page par entrée, rangs de 1 à n ; « Artisanat » est un lien', () => {
  for (const [onglet, attendu] of Object.entries(PLAN)) {
    assert.deepEqual(menuDImport(onglet), sansLesRetireesDepuis(attendu), onglet);
    const rangs = ENTREES_D_IMPORT.filter((e) => e.onglet_id === onglet).map((e) => e.rang).sort((a, b) => a - b);
    assert.deepEqual(rangs, rangs.map((_, i) => i + 1), `${onglet} : rangs 1 à ${rangs.length}`);
  }
  assert.equal(ENTREES_D_IMPORT.length, sansLesRetireesDepuis(Object.values(PLAN).flat()).length);
  assert.deepEqual(ENTREES_D_IMPORT.filter((e) => e.page_id === null),
    [{ id: 'lien:regles/artisanat', onglet_id: 'exploration', rang: 7, page_id: null, libelle: 'Artisanat', adresse: 'regles/artisanat/' }]);
  // aucune entrée « bientôt » à l'import (spécification, Bilan) ; l'entrée d'une page porte l'id 'page:<id de la page>'
  assert.equal(ENTREES_D_IMPORT.filter((e) => e.id.startsWith('bientot:')).length, 0);
  assert.equal(ENTREES_D_IMPORT.filter((e) => e.page_id !== null && e.id !== `page:${e.page_id}`).length, 0);
});

test('plan courant : ids des trois sortes d’entrées, pages du guide seulement, chaque onglet ouvert sur une page de son menu, « Artisanat » en Exploration', () => {
  const entrees = db.prepare('SELECT * FROM regles_onglet_entree').all();
  for (const e of entrees) {
    if (e.page_id !== null) assert.equal(e.id, `page:${e.page_id}`, e.id);
    else if (e.adresse !== null) assert.equal(e.id, `lien:${e.adresse.replace(/\/$/, '')}`, e.id);
    else assert.match(e.id, /^bientot:[a-z0-9-]+$/, e.id);
  }
  assert.equal(db.prepare("SELECT count(*) AS n FROM regles_onglet_entree e JOIN page p ON p.id = e.page_id WHERE p.type <> 'guide'").get().n, 0);
  for (const { id, ouverture_page_id: ouverture } of ONGLETS) {
    assert.equal(db.prepare('SELECT onglet_id FROM regles_onglet_entree WHERE page_id = ?').get(ouverture)?.onglet_id, id, `${id} : ${ouverture}`);
  }
  // un lien ne change pas d'onglet (seule une page en change)
  assert.equal(db.prepare("SELECT onglet_id FROM regles_onglet_entree WHERE id = 'lien:regles/artisanat'").get()?.onglet_id, 'exploration');
});

test('R184 (P7) : toute page guide/… a sa place : dans un onglet des Règles, ou hors sujet (Découvrir, L’univers, Guide du MJ), ou fixture', () => {
  const HORS_PLAN = ['guide/bienvenue draft', 'guide/campagne-ou-scenario-one-shot draft', 'guide/guide-pour-mj-maverick draft',
    'guide/l-univers draft', 'guide/un-maitre-du-jeu draft', 'guide/utiliser-ce-wiki example'];
  // à l'import
  const dansLePlan = new Set(ENTREES_D_IMPORT.map((e) => e.page_id).filter(Boolean));
  const horsPlanDImport = historique.lignesDImport('page').filter((p) => p.type === 'guide' && !dansLePlan.has(p.id)).map((p) => `${p.id} ${p.statut}`).sort();
  assert.deepEqual(horsPlanDImport, HORS_PLAN);
  // aujourd'hui : une page créée sur le site entre dans un onglet ; une page hors plan ne peut qu'avoir été retirée
  const horsPlan = db.prepare(`SELECT id, statut FROM page WHERE type = 'guide'
    AND id NOT IN (SELECT page_id FROM regles_onglet_entree WHERE page_id IS NOT NULL) ORDER BY id`).all().map((r) => `${r.id} ${r.statut}`);
  assert.deepEqual(horsPlan.filter((p) => !HORS_PLAN.includes(p)), []);
});

test('regles_onglet_entree : une page, un lien ou une entrée « bientôt », exactement ; une page n’est que dans un onglet', (t) => {
  const base = copie(t);
  const inserer = (id, onglet, pageId, libelle, adresse) => base.prepare(`INSERT INTO regles_onglet_entree (id, onglet_id, rang, page_id, libelle,
    adresse) VALUES (?, ?, 99, ?, ?, ?)`).run(id, onglet, pageId, libelle, adresse);
  // une page déjà dans un onglet (Météo), dans un autre onglet que le sien (le site de dev change une page d'onglet)
  const ongletDeMeteo = base.prepare("SELECT onglet_id FROM regles_onglet_entree WHERE page_id = 'guide/meteo'").get().onglet_id;
  const ailleurs = ONGLETS.map((o) => o.id).find((o) => o !== ongletDeMeteo);
  assert.throws(() => inserer('page:guide/meteo', ailleurs, 'guide/meteo', null, null), /UNIQUE constraint failed: regles_onglet_entree.page_id/);
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
  // les pages du plan courant (le site de dev change une page d'onglet, sauf une page d'ouverture) : une page hors des Combats, une autre page de la Fiche
  const ouvertures = new Set(ONGLETS.map((o) => o.ouverture_page_id));
  const pageDe = (condition, onglet) => base.prepare(`SELECT page_id FROM regles_onglet_entree WHERE page_id IS NOT NULL AND onglet_id ${condition} ?
    ORDER BY rang, id`).all(onglet).map((e) => e.page_id).find((p) => !ouvertures.has(p) && p !== 'guide/initiative');
  const horsDesCombats = pageDe('<>', 'combats');
  const autreDeLaFiche = pageDe('=', 'fiche-de-personnage');
  assert.ok(horsDesCombats && autreDeLaFiche);
  // la page retirée à la fin : l'Initiative, ou, si le site de dev l'a supprimée, une autre page des menus que rien ne protège (rien ne la cite)
  const aRetirer = base.prepare("SELECT 1 FROM regles_onglet_entree WHERE page_id = 'guide/initiative'").get() ? 'guide/initiative'
    : base.prepare('SELECT page_id FROM regles_onglet_entree WHERE page_id IS NOT NULL ORDER BY rang, id').all().map((e) => e.page_id)
      .find((p) => !ouvertures.has(p) && p !== autreDeLaFiche && p !== horsDesCombats && !raisonsDeProtection(base, p).length);
  assert.ok(aRetirer, 'une page des menus à retirer');
  const ongletDeLInitiative = base.prepare('SELECT onglet_id FROM regles_onglet_entree WHERE page_id = ?').get(aRetirer)?.onglet_id;
  assert.throws(transaction("UPDATE regles_onglet_entree SET onglet_id = 'combats' WHERE page_id = 'guide/creer-son-personnage'"), /FOREIGN KEY constraint failed/);
  assert.throws(transaction(`UPDATE regles_onglet SET ouverture_page_id = '${horsDesCombats}' WHERE id = 'combats'`), /FOREIGN KEY constraint failed/);
  // retirer une page : ses lignes qui la citent d'abord (liens, sources, mots-clés, alias), la page ensuite
  const retirer = (id) => ['lien WHERE page_id = ? OR cible_page_id = ?', 'page_source WHERE page_id = ?', 'page_tag WHERE page_id = ?',
    'alias WHERE page_id = ?', 'page WHERE id = ?'].map((d) => `DELETE FROM ${d.replaceAll('?', `'${id}'`)};`).join('\n');
  assert.throws(transaction(retirer('guide/la-montee-de-niveau')), /FOREIGN KEY constraint failed/);
  // une autre page du même onglet peut l'ouvrir, dans la même transaction que le déplacement de l'ancienne
  transaction(`UPDATE regles_onglet SET ouverture_page_id = '${autreDeLaFiche}' WHERE id = 'fiche-de-personnage';
    UPDATE regles_onglet_entree SET onglet_id = 'exploration' WHERE page_id = 'guide/creer-son-personnage'`)();
  assert.equal(menu(base, 'exploration').includes('guide/creer-son-personnage'), true);
  // une page qui n'ouvre aucun onglet se retire avec son entrée (ON DELETE CASCADE)
  transaction(retirer(aRetirer))();
  assert.equal(menu(base, ongletDeLInitiative).includes(aRetirer), false);
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
  // E7 : la liste des effets ne renvoyait plus à la page retirée ; la liste est elle-même retirée depuis (migration 0095) : aucune page n'y renvoie.
  // La phrase sur l'autre liste de l'onglet masqué, que la 0091 gardait dans guide/le-mode-hyper (P9), est retirée depuis par la 0104 (R200 (5),
  // « P9. Oui ») : migration postérieure, l'une ou l'autre écriture. Textes tels que les migrations les ont écrits (le site de dev peut les réécrire)
  assert.equal(page('guide/liste-des-effets-mode-hyper'), undefined);
  assert.equal(apres0091().prepare("SELECT count(*) AS n FROM page WHERE instr(corps_md, 'Mode Hyper (Magie)') > 0").get().n, 0);
  const hyper = corpsApres0091('guide/le-mode-hyper');
  assert.ok(hyper.includes('une autre liste des effets du Mode Hyper, aux valeurs différentes : cette liste ne compte pas') || !hyper.includes('onglet masqué'));
  // la migration ne fait que retirer : l'historique du site garde ce qui les citait
  assert.match(lire(`data/migrations/${MIGRATION}`), /historique_modification et de note_version_ligne qui les citent restent/);
});

test('R184, R185 : les pages absorbées et les pages retitrées gardent leurs anciens noms en alias', () => {
  // après la 0091 : ces alias, exactement, et les nouveaux titres ; aujourd'hui, les anciens noms restent des alias (un titre changé sur le site de dev
  // ajoute le sien, serveur/edition.mjs : les [[liens]] qui l'écrivent mènent toujours à la page)
  const ANCIENS = {
    'guide/resistances-et-faiblesses': ['Résistance/Faiblesse Magie', 'Résistance/Faiblesses magique'],
    'guide/prise-en-tenaille-et-zone-d-influence': ['La prise en tenaille', 'Les situations avancées'],
    'guide/le-mode-hyper': ['Le Mode Hyper et le Mode Super'], 'guide/blessures-et-etats': ['Blessures et états'],
    'guide/s-entrainer-et-exercer-un-metier': ['S’entraîner et exercer un métier'], 'guide/mordhau-ou-demi-epee': ['Mordhau ou Demi épée'],
  };
  for (const [id, anciens] of Object.entries(ANCIENS)) {
    assert.deepEqual(aliasApres0091(id), anciens, `${id} (après la 0091)`);
    // une page supprimée par le site de dev part avec ses alias (cas admis, vérifié)
    if (!page(id)) assert.ok(historique.supprimee('page', { id }), `${id} absente sans que le site de dev l’ait supprimée`);
    else assert.deepEqual(anciens.filter((a) => !alias(id).includes(a)), [], `${id} : ancien nom perdu`);
  }
  for (const [id, titre] of [['guide/le-mode-hyper', 'Le Mode Hyper'], ['guide/blessures-et-etats', 'Blessure et mort'],
    ['guide/s-entrainer-et-exercer-un-metier', 'S’entraîner']]) {
    assert.equal(pageApres0091(id).titre, titre, id);
  }
  // le mot-clé de la page (après la 0091 ; aujourd'hui, sauf si le site de dev a supprimé la page ou le mot-clé, qui n'est pas protégé)
  const tagsDe = (base) => base.prepare("SELECT tag_id FROM page_tag WHERE page_id = 'guide/mordhau-ou-demi-epee'").all().map((r) => r.tag_id);
  assert.deepEqual(tagsDe(apres0091()), ['mordhau']);
  if (page('guide/mordhau-ou-demi-epee') && db.prepare("SELECT 1 FROM mot_cle WHERE id = 'mordhau'").get()) assert.deepEqual(tagsDe(db), ['mordhau']);
  else assert.ok(historique.supprimee('page', { id: 'guide/mordhau-ou-demi-epee' }) || historique.supprimee('mot_cle', { id: 'mordhau' }), 'mordhau : ni page ni mot-clé supprimés par le site');
});

test('R184 : les pages nouvelles, famille docs, résumées par la première phrase de leur texte (réponse du propriétaire), et les blocs suivent leur texte', () => {
  // le texte affiché : la migration 0098 a fait des [[…]] des balises de mots-clés, dont « {{id}} » affiche le libellé (celui de la base courante, ou
  // de l'état d'après la migration si le site l'a changé depuis)
  const vocabulaires = [db, apres0091()].map(chargerVocabulaire);
  const affiche = (s, v) => texteSansBalises(s, v, { definitions: false }).replace(/\[\[[^\]|]*\|([^\]]*)\]\]/g, '$1').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/\{\{[^}|]*\|([^}]*)\}\}/g, '$1')
    .replace(/\*\*/g, '').replace(/^- /, '');
  for (const id of sansLesRetireesDepuis(NOUVELLES)) {
    const p = page(id);
    if (!p) {
      // supprimée par le site de dev (une page des Règles non protégée) : cas admis, vérifié
      assert.ok(historique.supprimee('page', { id }), `${id} absente sans que le site de dev l’ait supprimée`);
      continue;
    }
    assert.deepEqual([p.origine, p.statut], ['docs', 'draft'], id);
    // le site de dev, source de ce qu'il modifie, peut réécrire le texte sans le résumé (réponse du propriétaire du 2026-11-06 : « Initiative » garde son
    // ancien résumé quand le site réécrit l'ouverture de son texte) : le résumé est la première phrase du texte courant, ou de l'un des textes que le
    // site a remplacés ; un résumé écrit par le site est le sien. Pas valeurDImport : des lots rapatriés avant la 0091 la ramèneraient avant elle.
    const premiers = (texte) => vocabulaires.map((v) => affiche(texte.split('\n').find((l) => l && !l.startsWith('#') && !l.startsWith('<!--') && !l.startsWith('> «')), v));
    const remplaces = historique.operations('page', { id }).filter((o) => o.operation === 'modifier' && 'corps_md' in o.avant).map((o) => o.avant.corps_md);
    if (!historique.modifiee('page', { id }, 'resume')) assert.ok([p.corps_md, ...remplaces].flatMap(premiers).some((t) => t.startsWith(p.resume)), `${id} : « ${p.resume} »`);
    const source = db.prepare('SELECT s.texte FROM page_source ps JOIN source s ON s.id = ps.source_id WHERE ps.page_id = ? AND ps.ordre = 0').get(id).texte;
    assert.match(source, /^Google Doc « /, id);
  }
  // les blocs de « Créer son personnage » : chacun une fois, dans la page qui porte son texte (guide:initiative dans l'étape 6), après la 0091 ;
  // aujourd'hui, un bloc de ces pages y est appelé une fois au plus (test/guide.test.mjs : dans tout le guide)
  const blocsDe = (texte) => texte.match(/<!-- guide:[a-z-]+ -->/g) ?? [];
  const pages = ['guide/creer-son-personnage', ...ETAPES, 'guide/s-entrainer-et-exercer-un-metier'];
  assert.deepEqual(pages.map((id) => blocsDe(corpsApres0091(id))), [['<!-- guide:fil-rouge -->'],
    ['<!-- guide:fil-rouge-race -->'], ['<!-- guide:magie-bonus -->', '<!-- guide:fil-rouge-magie -->'], ['<!-- guide:fil-rouge-classe -->'],
    ['<!-- guide:competences -->'], ['<!-- guide:fil-rouge-sorts -->'],
    ['<!-- guide:initiative -->', '<!-- guide:fil-rouge-attributs -->', '<!-- guide:types-de-don -->'], ['<!-- guide:entrainement -->']]);
  const blocsCourants = pages.flatMap((id) => blocsDe(corps(id)));
  assert.equal(new Set(blocsCourants).size, blocsCourants.length, 'un bloc appelé une fois au plus');
  // R185 (4) : le tableau des relations entre magies, juste après le premier paragraphe (le bloc est écrit par le site), après la 0091
  const rf = corpsApres0091('guide/resistances-et-faiblesses').split('\n\n');
  assert.equal(rf[1], '<!-- guide:relations-des-magies -->');
  assert.match(rf[0], /^Chaque magie résiste à certaines magies et craint certaines autres/);
});

test('R184 (5) : les retouches E1 à E12 ; plus aucune phrase ne renvoie « plus haut », « plus bas » ou « sur cette page » vers un texte parti (après la 0091)', () => {
  const corps = corpsApres0091; // le texte tel que la 0091 et db:sync-pages l'ont laissé (le site de dev peut le réécrire depuis)
  // un passage qui contient un lien : écrit tel que la 0091 l'a laissé, ou avec la balise que la migration 0098 en a faite (ecrituresDuTexte)
  const contient = (id, modele) => ecrituresDuTexte(apres0091(), modele).some((f) => corps(id).includes(f));
  assert.ok(corps('guide/creer-son-personnage').includes('en six étapes : chaque étape'));                                         // E1
  assert.ok(contient('guide/exercer-un-metier', '(voir « Ses limites » dans [[guide/s-entrainer-et-exercer-un-metier|S’entraîner]])')); // E2
  assert.ok(contient('guide/reussites-echecs-et-critiques', '(voir « Le score » dans [[guide/reussir-une-action|Réussir une action]])')); // E3
  assert.ok(contient('guide/les-degats', '(voir [[guide/resistances-et-faiblesses|Résistances et faiblesses]])'));            // E4
  assert.ok(contient('guide/le-tour-de-jeu', '[[guide/actions-et-mouvements|Les actions et mouvements]] et [[guide/vitesse-et-portee|La vitesse et la portée]] ; sa page')); // E5
  // E6 : phrase retirée depuis par la 0104 (R200 (5), P9) : l'une ou l'autre écriture
  assert.ok(corps('guide/le-mode-hyper').includes('aux valeurs différentes : cette liste ne compte pas') || !corps('guide/le-mode-hyper').includes('onglet masqué')); // E6
  assert.ok(contient('guide/alignement', '(voir [[guide/les-neuf-alignements|Les neuf alignements]])'));                       // E9
  assert.ok(contient('guide/choisir-ses-magies', '## Résistances et faiblesses\n\nVoir [[guide/resistances-et-faiblesses|Résistances et faiblesses]].\n')); // E10
  assert.ok(contient('guide/la-magie-en-jeu', 'leur page le dit. Voir [[guide/resistances-et-faiblesses|Résistances et faiblesses]].\n')); // E11
  const fiche = corps('guide/fiche-tableau-resistances-faiblesses');                                                                 // E12
  assert.ok(contient('guide/fiche-tableau-resistances-faiblesses', 'tout est indiqué [[guide/resistances-et-faiblesses|ici]].') && !fiche.includes('communiquent ensemble'));
  for (const id of ['guide/creer-son-personnage', ...ETAPES, 'guide/exercer-un-metier', 'guide/reussites-echecs-et-critiques']) {
    assert.ok(!/sur cette page|, plus haut\)|« Le score » plus haut/.test(corps(id)), id);
  }
});
