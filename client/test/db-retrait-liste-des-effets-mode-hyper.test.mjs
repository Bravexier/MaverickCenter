// Migration data/migrations/0095-retrait-liste-des-effets-mode-hyper.sql (demande du propriétaire du 2026-11-06 : « En fait …/regles/le-mode-hyper/ Fait
// doublon avec …/regles/liste-des-effets-mode-hyper/ Supprime la liste. Dans le mode hyper rajoute un tableau qui liste les diffents bonus des magie et
// des races en récupérant directement l'information depuis la DB. » ; décision R187) : la page « Liste des effets mode hyper » retirée (adresse en 404,
// R185 (6)) ; ses textes (mode_texte) et ses constantes (regle_constante) rattachés à guide/le-mode-hyper, inchangés, les textes sous leurs ids figés ;
// le corps de guide/le-mode-hyper perd le renvoi devenu faux (R184 (5)) et reçoit le marqueur du tableau tiré de la base.
// Lecture de la base construite ; les écritures se font dans une COPIE, jamais dans var/maverick.db ni dans data/rows.
import assert from 'node:assert/strict';
import { copyFileSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { cheminBase, ouvrirBase } from '../src/lib/donnees.mjs';
import { historiqueSite } from '../src/lib/historique-site.mjs';
import { TABLES_DES_NOTES } from '../src/lib/notes-de-version.mjs';
import { fichierTemporaire } from './aide-dossier-temporaire.mjs';

const MIGRATION = '0095-retrait-liste-des-effets-mode-hyper.sql';
const LISTE = 'guide/liste-des-effets-mode-hyper';
const HYPER = 'guide/le-mode-hyper';
const lire = (chemin) => readFileSync(new URL(`../../${chemin}`, import.meta.url), 'utf8');
const db = ouvrirBase({ sansExemples: false });
const h = historiqueSite(db);
const page = (id) => db.prepare('SELECT * FROM page WHERE id = ?').get(id);
const corps = (id) => page(id).corps_md;
const IDS_DES_TEXTES = ['ne-plus-faire-quun-avec-soi-meme', 'au-dela-des-limites', 'mode-hyper-100'].map((s) => `${LISTE}#texte:${s}`);
// Les douze constantes du classeur « Mode hyper et co » (valeurs inchangées par la migration)
const CONSTANTES = {
  'mode_hyper.conso_chakra_pct_max_par_tour': [10, '%'], 'mode_hyper.degats_magie_bi': [7, 'points'], 'mode_hyper.degats_magie_mono': [15, 'points'],
  'mode_hyper.degats_physique': [15, 'points'], 'mode_hyper.duree_diviseur_niveau': [2, 'diviseur'], 'mode_hyper.niveau_100': [10, 'niveau'],
  'mode_hyper.niveau_deblocage': [2, 'niveau'], 'mode_hyper.soin_magique': [15, 'points'], 'mode_hyper.usage_par_semaine': [1, 'fois'],
  'mode_hyper_100.cout_chakra_pct_max': [75, '%'], 'mode_hyper_100.degats_bonus': [10, 'points'], 'mode_hyper_100.duree_tours': [3, 'tours'],
};
const PHRASE = 'La page de chaque magie et de chaque race donne l’effet écrit dans son onglet.';

test('0095 : la Liste retirée, avec ses lignes d’import, son entrée de menu, ses liens ; aucune source orpheline', () => {
  assert.equal(page(LISTE), undefined);
  for (const [table, colonne] of [['alias', 'page_id'], ['page_tag', 'page_id'], ['page_source', 'page_id'], ['page_entite', 'page_id'],
    ['regles_onglet_entree', 'page_id'], ['lien', 'page_id'], ['lien', 'cible_page_id'], ['lien_candidat', 'candidat_page_id'],
    ['panneau_regles', 'page_id'], ['regle_constante', 'page_id'], ['mode_texte', 'page_id'], ['evenement_extrait', 'page_id']]) {
    assert.equal(db.prepare(`SELECT count(*) AS n FROM ${table} WHERE ${colonne} = ?`).get(LISTE).n, 0, `${table}.${colonne}`);
  }
  assert.equal(db.prepare("SELECT count(*) AS n FROM ecart_source WHERE entite_table = 'page' AND entite_id = ?").get(LISTE).n, 0);
  assert.equal(db.prepare('SELECT count(*) AS n FROM source WHERE id NOT IN (SELECT source_id FROM page_source)').get().n, 0, 'aucune source orpheline');
  // la source du classeur reste citée par guide/le-mode-hyper
  assert.ok(db.prepare("SELECT 1 FROM page_source WHERE page_id = ? AND source_id = 'ref:google-sheet-mode-hyper-et-co-onglet-mode-hyper'").get(HYPER));
  assert.deepEqual(db.prepare("SELECT page_id, cible, etat FROM lien WHERE page_id = ? AND etat <> 'resolu'").all(HYPER), []);
  assert.match(lire(`data/migrations/${MIGRATION}`), /historique_modification et de note_version_ligne qui citent la page restent/);
});

test('0095 : plus rien dans la base ne cite la Liste, hors des ids figés de ses textes, de l’historique du site et des notes de version', () => {
  const sautees = new Set(TABLES_DES_NOTES);
  const occurrences = [];
  for (const { name } of db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE '%fts%'").all()) {
    if (sautees.has(name)) continue;
    for (const { name: col } of db.prepare(`PRAGMA table_info("${name}")`).all()) {
      const n = db.prepare(`SELECT count(*) AS n FROM "${name}" WHERE instr(CAST("${col}" AS TEXT), 'liste-des-effets-mode-hyper') > 0`).get().n;
      if (n) occurrences.push(`${name}.${col}:${n}`);
    }
  }
  assert.deepEqual(occurrences.sort(), ['mode_texte.id:3', 'page_entite.entite_id:3']);
  assert.equal(db.prepare("SELECT count(*) AS n FROM page WHERE instr(corps_md, 'Liste des effets mode hyper') > 0").get().n, 0);
});

test('0095 : les trois textes du Mode Hyper gardent leurs ids, rattachés à guide/le-mode-hyper ; ce que la fiche en lit est mot pour mot celui de la Liste', () => {
  const textes = db.prepare("SELECT id, mode, rang, page_id, source_ref FROM mode_texte WHERE mode = 'hyper' ORDER BY rang").all().map((r) => ({ ...r }));
  assert.deepEqual(textes, IDS_DES_TEXTES.map((id, i) => ({ id, mode: 'hyper', rang: i + 1, page_id: HYPER,
    source_ref: `Mode hyper et co › Mode Hyper › ${['AA1:BL12', 'AA14:BL28', 'AA30:BL43'][i]}` })));
  assert.deepEqual(db.prepare("SELECT entite_id, page_id, principale FROM page_entite WHERE entite_table = 'mode_texte' AND page_id = ? ORDER BY entite_id")
    .all(HYPER).map((r) => ({ ...r })), [...IDS_DES_TEXTES].sort().map((entite_id) => ({ entite_id, page_id: HYPER, principale: 0 })));
  // le Mode Super ne bouge pas
  assert.equal(db.prepare("SELECT page_id FROM mode_texte WHERE mode = 'super'").get().page_id, 'guide/liste-des-effets-mode-super');
  // ce que lib/fiche-regles.mjs lisait dans le corps de la Liste (sans balises) : niveaux 2 et 10, puces du Mode Hyper 100 %, phrase « En revanche, … »
  const texte = (id) => db.prepare('SELECT texte FROM mode_texte WHERE id = ?').get(id).texte;
  assert.equal(/se d[ée]bloque au niveau (\d+)/.exec(texte(IDS_DES_TEXTES[0]))?.[1], '2');
  const cent = texte(IDS_DES_TEXTES[2]);
  assert.equal(/disponible qu['’]au niveau (\d+)/.exec(cent)?.[1], '10');
  assert.deepEqual([...cent.matchAll(/^- (.+)$/gm)].map((m) => m[1].trim()), [
    'Le Chakra ne s\'évapore plus.',
    'Toutes les postures sont activées et ne possèdent plus d\'inconvénients.',
    'Tous les sorts peuvent être surchargés (leur donnant 1d de dégâts en plus)',
    'Toutes les attaques physiques et magiques infligent +10 dégâts en plus du mode hyper d\'avant.',
  ]);
  assert.equal(/^En revanche, (.+)$/m.exec(cent)?.[1]?.trim(), 'l\'état 100% ne peut pas être conservé éternellement, il ne dure que 3 tours et après le '
    + 'lanceur revient dans le Mode Hyper normal, consommant au passage 75% de son Chakra Max (Prudence, si vous n\'avez pas 75% de Chakra courant en '
    + 'réserve, le manque sera pris dans les PV).');
});

test('0095 : le CHECK de mode_texte n’admet le préfixe de la page retirée que pour guide/le-mode-hyper', (t) => {
  const chemin = fichierTemporaire('maverick.db', 'retrait-liste-hyper', { t });
  copyFileSync(cheminBase({ sansExemples: false }), chemin);
  const base = new DatabaseSync(chemin);
  t.after(() => base.close());
  base.exec('PRAGMA foreign_keys = ON');
  const inserer = (id, pageId, rang) => base.prepare(`INSERT INTO mode_texte (id, mode, rang, intitule, texte, page_id, origine, source_ref)
    VALUES (?, 'hyper', ?, 'Essai', 'Essai', ?, 'annexes', 'essai')`).run(id, rang, pageId);
  assert.throws(() => inserer(`${LISTE}#texte:essai`, 'guide/liste-des-effets-mode-super', 98), /CHECK constraint failed/);
  assert.throws(() => inserer(`guide/le-mode-hyper-100#texte:essai`, HYPER, 98), /CHECK constraint failed/);
  // la règle générale (id = page_id#texte:…) et l'exception sont admises
  inserer(`${LISTE}#texte:essai`, HYPER, 98);
  inserer(`${HYPER}#texte:essai`, HYPER, 99);
});

test('0095 : les douze constantes du Mode Hyper, rattachées à guide/le-mode-hyper, aux mêmes valeurs', () => {
  const lignes = db.prepare("SELECT id, valeur, unite, nature, page_id FROM regle_constante WHERE id LIKE 'mode\\_hyper%' ESCAPE '\\' ORDER BY id").all();
  assert.deepEqual(lignes.map((r) => ({ ...r })), Object.entries(CONSTANTES).sort()
    .map(([id, [valeur, unite]]) => ({ id, valeur, unite, nature: 'texte', page_id: HYPER })));
});

test('0095 : guide/le-mode-hyper garde la première phrase, suivie du marqueur du tableau (une fois) ; le reste de la page ne change pas', () => {
  const hyper = corps(HYPER);
  assert.ok(hyper.includes(`${PHRASE}\n\n<!-- guide:mode-hyper -->\n\n## Ce qu’il coûte\n`));
  assert.equal(hyper.match(/^<!--\s*guide:mode-hyper\s*-->$/gm)?.length, 1);
  assert.equal(hyper.match(/<!--\s*guide:/g)?.length, 1);
  assert.ok(!hyper.includes('ne disent pas toujours la même chose'));
  assert.ok(!hyper.includes('liste-des-effets-mode-hyper'));
  // la section « Sur la fiche du site » et sa phrase sur l'onglet masqué restent (P9 de docs/sql/a-valider.md)
  assert.ok(hyper.endsWith('Le classeur des magies garde, dans un onglet masqué, une autre liste des effets du Mode Hyper, aux valeurs différentes : '
    + 'cette liste ne compte pas, ce sont les valeurs données plus haut (+15, et +7 avec deux magies) qui valent.\n'));
  assert.ok(hyper.includes('## Sur la fiche du site\n'));
});

test('0095 : le menu « Les combats » sans la Liste, rangs de 1 à 19 (état d’import) ; le menu courant suit les éditions du site', () => {
  // l'état d'import : le menu tel que les migrations l'ont laissé, les éditions du site défaites
  const entree = (e) => ({ id: e.id, page_id: e.page_id });
  const parRang = (a, b) => a.rang - b.rang || (a.id < b.id ? -1 : 1);
  const importees = h.lignesDImport('regles_onglet_entree').filter((e) => e.onglet_id === 'combats').sort(parRang);
  assert.deepEqual(importees.map((e) => e.page_id), ['le-tour-de-jeu', 'initiative', 'attaquer-et-se-defendre', 'attaque-et-defense',
    'les-attaques-d-opportunite', 'les-attaques-discretes', 'l-embuscade', 'vitesse-deplacement-et-portee', 'actions-et-mouvements', 'vitesse-et-portee',
    'prise-en-tenaille-et-zone-d-influence', 'deplacement-ou-sortie-de-la-zone-d-influence', 'les-degats', 'formule-des-degats', 'les-postures',
    'le-mode-hyper', 'le-mode-hyper-100', 'liste-des-effets-mode-super', 'blessures-et-etats'].map((s) => `guide/${s}`));
  assert.deepEqual(importees.map((e) => e.rang), importees.map((_, i) => i + 1));
  // le menu courant : les mêmes entrées, moins celles que le site a supprimées, plus celles qu'il a créées
  const actuelles = db.prepare("SELECT id, page_id FROM regles_onglet_entree WHERE onglet_id = 'combats'").all().map(entree);
  const attendues = importees.filter((e) => !h.supprimee('regles_onglet_entree', { id: e.id })).map(entree)
    .concat(actuelles.filter((e) => h.creee('regles_onglet_entree', { id: e.id })));
  const tri = (l) => l.map((e) => JSON.stringify(e)).sort();
  assert.deepEqual(tri(actuelles), tri(attendues));
});

test('0095 rejouée sur son propre résultat : rien ne change (table reconstruite à l’identique, UPDATE gardés)', (t) => {
  const chemin = fichierTemporaire('maverick.db', 'retrait-liste-hyper', { t });
  copyFileSync(cheminBase({ sansExemples: false }), chemin);
  const base = new DatabaseSync(chemin);
  t.after(() => base.close());
  const etat = () => [
    ...['page', 'alias', 'page_entite', 'page_source', 'regles_onglet_entree', 'source', 'mode_texte', 'regle_constante']
      .map((table) => base.prepare(`SELECT * FROM ${table} ORDER BY 1, 2`).all().map((r) => JSON.stringify(r)).join('\n')),
    // la définition de mode_texte, sans commentaires ni guillemets d'identifiants (ALTER TABLE … RENAME écrit « "mode_texte" »)
    base.prepare("SELECT sql FROM sqlite_master WHERE tbl_name = 'mode_texte' AND sql IS NOT NULL ORDER BY name").all()
      .map((r) => r.sql.replace(/--[^\n]*/g, '').replace(/"/g, '').replace(/\s+/g, ' ')).join('\n'),
    JSON.stringify(base.prepare("PRAGMA table_xinfo('mode_texte')").all()),
  ];
  const avant = etat();
  base.exec('PRAGMA foreign_keys = ON');
  base.exec('BEGIN');
  base.exec(lire(`data/migrations/${MIGRATION}`));
  base.exec('COMMIT');
  assert.deepEqual(etat(), avant);
});
