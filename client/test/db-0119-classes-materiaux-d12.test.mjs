// Migration data/migrations/0119-classes-materiaux-d12.sql (lot 3 de la mise à jour de Décembre) : classes (R238), effets secondaires des matériaux
// d'armes (R241), limite D12 des montées de dé (R252), coquilles des onglets de classe (R10).
// Le site de dev est la source de ce qu'il modifie : les valeurs précises (ordre, catégorie, textes, effets) se lisent à l'import
// (test/aide-base-d-import.mjs), où une cellule que la migration a réécrite garde sa valeur ; l'état courant ne porte que des invariants (la vue sans
// classe_imposee, les colonnes d'un matériau relues de son effet). Les ids et les textes viennent du registre de la migration (0119-…json), jamais d'un nom.
//   node --test test/db-0119-classes-materiaux-d12.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { analyserEffetDeMateriau } from '../src/lib/arme-champs.mjs';
import { MOT_CLE_DE_CATEGORIE, decouperMaitriseArme } from '../src/lib/classe-champs.mjs';
import { corpsDeDon, resumeDeDon } from '../src/lib/corps-classes.mjs';
import { ligneDeMateriau, PAGE_DES_ARMES } from '../src/lib/corps-armes.mjs';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { historiqueSite } from '../src/lib/historique-site.mjs';
import { sourcesDeLaClasse, sourcesDuDon, famillesDuLecteur } from '../serveur/edition-maitrises.mjs';
import { baseDImport } from './aide-base-d-import.mjs';
import { avecLesClesDe, idDuMotCleNomme } from './aide-mots-cles.mjs';

const NOM = '0119-classes-materiaux-d12';
const lire = (chemin) => readFileSync(new URL(chemin, import.meta.url), 'utf8');
const REGISTRE = JSON.parse(lire(`../../data/migrations/${NOM}.json`));
const MIGRATION = lire(`../../data/migrations/${NOM}.sql`);
const SCHEMA = lire('../../data/schema.sql');
const CORRECTIONS = JSON.parse(lire('../../tools/sheets/corrections.json'));
const db = ouvrirBase({ sansExemples: false });
const imp = () => baseDImport();
const NOUVELLES = Object.keys(REGISTRE.classes.nouvelles);
const PI = 'magies/potentiel-illimite';
const ARCHIMAGE = 'classes/archimage';
const tri = (lignes) => lignes.map((l) => JSON.stringify(Object.fromEntries(Object.keys(l).sort().map((k) => [k, l[k]])))).sort();

test('0119 : schéma 119, aucun mot-clé créé, une garde par instruction qui modifie ou supprime', () => {
  assert.ok(db.prepare('PRAGMA user_version').get().user_version >= 119);
  assert.match(SCHEMA, /PRAGMA user_version = 1(1[89]|[2-9]\d);/);
  assert.doesNotMatch(MIGRATION, /INSERT INTO mot_cle\b/, 'aucun mot-clé créé (demande du lot)');
  const modifs = MIGRATION.match(/^(UPDATE|DELETE) /gm).length;
  assert.equal(MIGRATION.match(/^INSERT INTO garde_0119 /gm).length, modifs);
  assert.equal(REGISTRE.migration, NOM);
});

test('R238 (5), R23, R25 : la vue v_personnage_controle n’impose plus l’Archimage au Potentiel Illimité ; elle la lui réserve et ferme le Mage Bleu', () => {
  for (const sql of [db.prepare("SELECT sql FROM sqlite_master WHERE type = 'view' AND name = 'v_personnage_controle'").get().sql, SCHEMA]) {
    assert.doesNotMatch(sql, /'classe_imposee'/);
    assert.match(sql, /'classe_reservee'/);
    assert.match(sql, /'classe_exclue'/);
  }
  const b = imp();
  // la réserve (R23) reste une donnée : la magie innée de l'Archimage
  assert.equal(b.prepare('SELECT magie_innee_id AS m FROM classe WHERE id = ?').get(ARCHIMAGE).m, PI);
  // la phrase « Classe unique = Archimage. » (R238 (5)) a quitté l'explication et la page du Potentiel Illimité, rien d'autre
  const t = REGISTRE.textes.filter((x) => x.table === 'magie' || x.cle.id === PI);
  assert.deepEqual(t.map((x) => `${x.table}.${x.col}`).sort(), ['magie.explication', 'page.corps_md']);
  for (const x of t) {
    const v = b.prepare(`SELECT ${x.col} AS v FROM ${x.table} WHERE id = ?`).get(PI).v;
    assert.ok(!v.includes(x.avant) && v.includes(x.apres), `${x.table}.${x.col}`);
    assert.ok(x.avant.replace(x.apres, '').startsWith('- '), 'une seule ligne retirée');
  }
  // le « CHOSE A SAVOIR » de l'Archimage reste tel quel
  assert.ok(!REGISTRE.textes.some((x) => x.table === 'classe' && x.col === 'chose_a_savoir'));
});

test('R238 (1) : Boxeur et Porte-étendard, « Classe Physique Corps à Corps », en fin de colonne ; l’ordre relatif des autres classes est gardé', () => {
  const b = imp();
  const classes = b.prepare('SELECT id, categorie_id, ordre FROM classe ORDER BY ordre').all();
  assert.equal(classes.length, 41);
  const cac = classes.filter((c) => c.categorie_id === 'classe-physique-corps-a-corps').map((c) => c.id);
  assert.deepEqual(cac.slice(-2), NOUVELLES, 'les deux nouvelles classes, dans l’ordre du registre, en fin de colonne');
  for (const id of NOUVELLES) assert.equal(classes.find((c) => c.id === id).ordre, REGISTRE.classes.nouvelles[id].ordre);
  // les ordres se suivent de 1 à 41 ; la colonne « corps à corps » se termine avant la suivante (le Parleur mis à part, qui garde sa place : R238 (3))
  assert.deepEqual(classes.map((c) => c.ordre), Array.from({ length: 41 }, (_, i) => i + 1));
  const finCac = Math.max(...classes.filter((c) => c.categorie_id === 'classe-physique-corps-a-corps').map((c) => c.ordre));
  assert.ok(classes.filter((c) => c.ordre > finCac).every((c) => c.categorie_id !== 'classe-physique-corps-a-corps'));
  // ouvertes aux 27 races de la base (MAJ-R7), colonnes 40 et 41 de la matrice
  const races = b.prepare('SELECT id FROM race').all().map((r) => r.id);
  NOUVELLES.forEach((id, i) => {
    const l = b.prepare('SELECT race_id, ordre, accessible, valeur_brut FROM race_classe WHERE classe_id = ?').all(id);
    assert.deepEqual(l.map((x) => x.race_id).sort(), [...races].sort(), id);
    assert.ok(l.every((x) => x.accessible === 1 && x.valeur_brut === '1' && x.ordre === 40 + i), id);
  });
  // les pages de race comptent les deux colonnes (« Classes accessibles » : « Nombre : N sur 41. »)
  for (const r of races) {
    const corps = b.prepare('SELECT corps_md FROM page WHERE id = ?').get(r).corps_md;
    const n = b.prepare('SELECT count(*) AS n FROM race_classe WHERE race_id = ? AND accessible = 1').get(r).n;
    assert.ok(corps.includes(`Nombre : ${n} sur 41.`), r);
  }
});

test('R238 (1) : spécialités, dons, fiches de dons et sources de maîtrise des deux classes suivent leurs tables (à l’import)', () => {
  const b = imp();
  const familles = famillesDuLecteur(b);
  const tag = (page) => b.prepare('SELECT tag_id FROM page_tag WHERE page_id = ? ORDER BY ordre').all(page).map((r) => r.tag_id);
  const [motCleClasse, motCleCac, motCleDon] = ['classe', MOT_CLE_DE_CATEGORIE['classe-physique-corps-a-corps'], 'capacite-de-classe'].map(idDuMotCleNomme);
  for (const id of NOUVELLES) {
    const attendu = REGISTRE.classes.nouvelles[id];
    assert.deepEqual(tag(id), [motCleClasse, motCleCac], id);
    assert.deepEqual(b.prepare('SELECT id FROM specialite WHERE classe_id = ? ORDER BY rang').all(id).map((r) => r.id), attendu.specialites);
    const dons = b.prepare('SELECT * FROM capacite WHERE classe_id = ?').all(id);
    assert.deepEqual(dons.map((d) => d.id).sort(), [...attendu.dons].sort());
    for (const d of dons) {
      const p = b.prepare('SELECT corps_md, resume FROM page WHERE id = ?').get(d.id);
      assert.equal(p.corps_md, corpsDeDon(d), d.id);
      assert.equal(p.resume, resumeDeDon(d), d.id);
      assert.deepEqual(tag(d.id), [motCleDon], d.id);
      assert.ok(b.prepare("SELECT 1 FROM page_entite WHERE entite_table = 'capacite' AND entite_id = ? AND page_id = ?").get(d.id, d.id), d.id);
    }
    const lignes = b.prepare('SELECT rang, brut, forme, nombre, arme, arme_cle, categorie, sauf, sauf_cle FROM classe_maitrise_arme WHERE classe_id = ? ORDER BY rang').all(id);
    assert.deepEqual(tri(lignes), tri(decouperMaitriseArme(b.prepare('SELECT maitrise_arme AS m FROM classe WHERE id = ?').get(id).m)), id);
    const voulues = sourcesDeLaClasse(id, lignes, familles);
    for (const d of dons) { const s = sourcesDuDon(d.id, d.effet, familles); voulues.parts.push(...s.parts); voulues.options.push(...s.options); }
    const ids = [...new Set(voulues.parts.map((p) => p.source_id))];
    const enBase = (table) => b.prepare(`SELECT * FROM ${table} WHERE source_id IN (${ids.map(() => '?').join(', ')})`).all(...ids);
    assert.deepEqual(tri(enBase('maitrise_arme_part')), tri(voulues.parts), `${id} : parts`);
    assert.deepEqual(tri(enBase('maitrise_arme_part_famille')), tri(voulues.options), `${id} : options`);
  }
});

test('R238 (2), R42 : Cuirassé V2 — Large supprimé, Appui à Protecteur niveau 20 (même id), Écrasant à Vindicatif niveau 15 ; choix exclusifs', () => {
  const b = imp();
  const { supprime, deplace, cree } = REGISTRE.cuirasse;
  for (const t of ['capacite', 'page']) assert.equal(b.prepare(`SELECT count(*) AS n FROM ${t} WHERE id = ?`).get(supprime).n, 0, t);
  const don = (id) => b.prepare('SELECT * FROM capacite WHERE id = ?').get(id);
  const appui = don(deplace.id);
  const ecrasant = don(cree);
  assert.deepEqual([appui.specialite_id, appui.niveau, appui.ligne, appui.rang, appui.type], ['classes/cuirasse#specialite:protecteur', 20, 43, 2, 'reaction']);
  assert.deepEqual([ecrasant.specialite_id, ecrasant.niveau, ecrasant.ligne, ecrasant.rang, ecrasant.type], ['classes/cuirasse#specialite:vindicatif', 15, 36, 1, 'passif']);
  const autres = (id) => b.prepare('SELECT autre_id FROM v_capacite_exclusive WHERE capacite_id = ?').all(id).map((r) => r.autre_id);
  assert.deepEqual(autres(deplace.id), ['capacites/cuirasse-muraille']);
  assert.deepEqual(autres(cree), ['capacites/cuirasse-aucune-fuite']);
  for (const id of [deplace.id, cree, 'capacites/cuirasse-muraille', 'capacites/cuirasse-aucune-fuite']) {
    const donnees = JSON.parse(b.prepare('SELECT donnees FROM page WHERE id = ?').get(id).donnees);
    assert.deepEqual(donnees.choix_exclusif_avec, autres(id), id);
  }
  assert.equal(b.prepare("SELECT armure_depart AS a FROM classe WHERE id = 'classes/cuirasse'").get().a, REGISTRE.cuirasse.armure_depart.apres);
});

test('R238 (3) : le Parleur en « Classe spéciale », à sa place ; le mot-clé de catégorie de sa page suit', () => {
  const b = imp();
  const p = b.prepare("SELECT categorie_id, ordre FROM classe WHERE id = 'classes/parleur'").get();
  assert.equal(p.categorie_id, REGISTRE.parleur.categorie_id.apres);
  const bimane = b.prepare("SELECT ordre FROM classe WHERE id = 'classes/bimane'").get().ordre;
  assert.equal(p.ordre, bimane - 1, 'sa place relative ne change pas (juste avant le Bimane)');
  const tags = b.prepare("SELECT tag_id FROM page_tag WHERE page_id = 'classes/parleur'").all().map((r) => r.tag_id);
  assert.ok(tags.includes(idDuMotCleNomme(MOT_CLE_DE_CATEGORIE['classe-speciale'])));
  assert.ok(!tags.includes(idDuMotCleNomme(MOT_CLE_DE_CATEGORIE['classe-physique-corps-a-corps'])));
});

test('R238 (4), R127, R148 : l’Archimage choisit sa maîtrise d’arme de contact (7 familles, Bâton de combat compris) ; la source garde son id', () => {
  const b = imp();
  const { source_id: source } = REGISTRE.archimage;
  const rang = Number(source.split(':').at(-1));
  const ligne = b.prepare('SELECT * FROM classe_maitrise_arme WHERE classe_id = ? AND rang = ?').get(ARCHIMAGE, rang);
  assert.deepEqual([ligne.forme, ligne.nombre, ligne.categorie, ligne.sauf, ligne.arme], ['au_choix', 1, 'contact', null, null]);
  const part = b.prepare('SELECT * FROM maitrise_arme_part WHERE source_id = ?').all(source);
  assert.deepEqual(part.map((p) => [p.genre, p.points, p.arme_famille_id]), [['choix', 1, null]]);
  const contact = b.prepare("SELECT id FROM arme_famille WHERE categorie = 'contact' ORDER BY ordre").all().map((r) => r.id);
  assert.equal(contact.length, 7);
  assert.ok(contact.includes('baton-de-combat'));
  assert.deepEqual(b.prepare('SELECT arme_famille_id AS f FROM maitrise_arme_part_famille WHERE source_id = ?').all(source).map((r) => r.f).sort(), [...contact].sort());
  // le lecteur de la fiche lit la même chose dans la ligne
  const lu = sourcesDeLaClasse(ARCHIMAGE, [ligne], famillesDuLecteur(b));
  assert.deepEqual(lu.options.map((o) => o.arme_famille_id).sort(), [...contact].sort());
});

test('R241 : effets secondaires des matériaux d’armes du registre ; bonus de dégâts gardés ; Titane sans cran ; colonnes relues de l’effet (à l’import)', () => {
  const b = imp();
  for (const m of REGISTRE.materiaux) {
    const l = b.prepare('SELECT * FROM materiau_arme WHERE ressource_id = ?').get(m.ressource_id);
    assert.equal(l.effet_brut, avecLesClesDe(b, m.effet_brut.apres), m.ressource_id);
    const lu = analyserEffetDeMateriau(l.effet_brut);
    assert.deepEqual([l.effet_secondaire, l.cran_solidite], [lu.effet_secondaire, lu.cran_solidite], m.ressource_id);
    assert.equal(l.bonus_degats, analyserEffetDeMateriau(m.effet_brut.avant).bonus_degats, `${m.ressource_id} : bonus de dégâts inchangé`);
    // ni cran perdu (hors Titane, R241 (2)) ni cran écrit deux fois
    if (m.ressource_id.endsWith(':titane')) assert.equal(l.cran_solidite, null);
    else assert.equal(l.cran_solidite, m.cran_solidite.avant, m.ressource_id);
    assert.doesNotMatch(l.effet_secondaire ?? '', /cran/i, m.ressource_id);
    // la ligne du tableau des matériaux de la page des armes
    const nom = b.prepare('SELECT nom FROM ressource WHERE id = ?').get(m.ressource_id).nom;
    assert.ok(b.prepare('SELECT corps_md FROM page WHERE id = ?').get(PAGE_DES_ARMES).corps_md.includes(ligneDeMateriau(nom, l)), nom);
  }
  // Fer, Fonte et Bronze : la migration n'y touche pas (crans de R51 dans leur colonne)
  for (const cle of ['fer', 'fonte', 'bronze']) assert.ok(!REGISTRE.materiaux.some((m) => m.ressource_id.endsWith(`#materiau:${cle}`)), cle);
});

test('R241 (1), état courant : les colonnes de chaque matériau d’arme sont celles que le site relit dans son effet', () => {
  for (const l of db.prepare('SELECT * FROM materiau_arme').all()) {
    const lu = analyserEffetDeMateriau(l.effet_brut);
    assert.deepEqual([l.bonus_degats, l.cran_solidite, l.effet_secondaire], [lu.bonus_degats, lu.cran_solidite, lu.effet_secondaire], l.ressource_id);
  }
});

test('R238, R241 (3), R252 : chaque fragment du registre est remplacé (à l’import), et chaque remplacement est gardé dans la migration', () => {
  const b = imp();
  const decisions = new Set(REGISTRE.decisions);
  for (const t of REGISTRE.textes) {
    for (const d of t.decision.match(/R\d+/g)) assert.ok(decisions.has(d), `${d} listée`);
    const ou = Object.keys(t.cle).map((k) => `${k} = ?`).join(' AND ');
    const v = b.prepare(`SELECT "${t.col}" AS v FROM "${t.table}" WHERE ${ou}`).get(...Object.values(t.cle))?.v;
    // une ligne que le site de dev a créée (le mot-clé « Barrière ») n'existe pas à l'import : la migration l'a réécrite dans la base courante
    if (v === undefined && historiqueSite(db).creee(t.table, t.cle)) continue;
    assert.equal(typeof v, 'string', JSON.stringify(t.cle));
    assert.ok(v.includes(avecLesClesDe(b, t.apres)), `${JSON.stringify(t.cle)} ${t.col} : « ${t.apres.slice(0, 60)}… »`);
    if (!t.apres.includes(t.avant)) assert.ok(!v.includes(avecLesClesDe(b, t.avant)), `${JSON.stringify(t.cle)} ${t.col} : l’ancien fragment reste`);
    assert.ok(MIGRATION.includes(`UPDATE ${t.table} SET ${t.col} = replace(${t.col}, `), `${t.table}.${t.col}`);
  }
  // R252 : plus de D20 comme plafond d'une montée, ni dans la copie de Focus ni dans les pages du guide qui le disaient
  const d12 = REGISTRE.textes.filter((t) => t.decision.startsWith('R252'));
  assert.ok(d12.some((t) => t.table === 'posture_effet' && t.cle.version === 'guide_fiche') && d12.some((t) => t.cle.version === 'guide_mj'));
  for (const t of d12) assert.ok(/D20/.test(t.avant) && !/D20/.test(t.apres) && /D12/.test(t.apres), JSON.stringify(t.cle));
  // R241 (3) : aucun fragment réécrit ne prête plus au Mythril, au Maverium ou au Laiton leurs anciens effets de barrière
  for (const t of REGISTRE.textes.filter((x) => x.decision.startsWith('R241'))) {
    assert.doesNotMatch(t.apres, /passe à travers|la brise|la traverse|doublés contre la \{\{barriere|\(Mythril|\(Maverium\)|\(Laiton\)/i, JSON.stringify(t.cle));
  }
});

test('R10 : les 26 coquilles des onglets de classe de corrections.json (section magie-v10) sont dans la table correction', () => {
  const section = CORRECTIONS.dumps['magie-v10'].corrections;
  assert.equal(REGISTRE.coquilles_r10.length, 26);
  for (const c of REGISTRE.coquilles_r10) {
    assert.ok(section.some((x) => x.onglet === c.onglet && x.cellule === c.cellule && x.avant === c.avant && x.apres === c.apres), `${c.onglet} ${c.cellule}`);
    assert.ok(db.prepare("SELECT 1 FROM correction WHERE dump = 'magie-v10' AND onglet = ? AND cellule = ? AND avant = ? AND apres = ? AND origine = 'classes'")
      .get(c.onglet, c.cellule, c.avant, c.apres), `${c.onglet} ${c.cellule}`);
  }
});
