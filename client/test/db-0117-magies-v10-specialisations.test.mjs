// Migration data/migrations/0117-magies-v10-specialisations.sql (lot 1 « Magies V10, données », mise à jour de Décembre) : décisions R236, R237,
// R242, R243, R244 (coûts), R246 (Poupée fulgurante) et R10 (coquilles). Spécialisations magiques (table magie_specialisation, colonne sort.specialisation_id), sorts du classeur
// de Décembre (supprimés, renommés, nouveaux, ordre 1 à 30), bestiaire (R242), textes d'incantation et remarques des sorts (R243).
// Le site de dev est la source de ce qu'il modifie : les comptes, les liens posés par la migration et les remarques se lisent à l'import
// (test/aide-base-d-import.mjs) ; l'état courant ne porte que les invariants (CHECK, aucun sort supprimé cité). Les CHECK se vérifient sur une base
// neuve en mémoire (data/schema.sql), jamais sur la base. Les ids et les listes viennent du registre de la migration (0117-…json), jamais d'un nom.
//   node --test test/db-0117-magies-v10-specialisations.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { historiqueSite } from '../src/lib/historique-site.mjs';
import { analyserCout } from '../src/lib/sort-analyse.mjs';
import { coutEnUneCase } from '../src/lib/sort-cout.mjs';
import { normalize } from '../src/lib/text.mjs';
import { baseDImport } from './aide-base-d-import.mjs';

const lire = (chemin) => readFileSync(new URL(chemin, import.meta.url), 'utf8');
const SCHEMA = lire('../../data/schema.sql');
const REGISTRE = JSON.parse(lire('../../data/migrations/0117-magies-v10-specialisations.json'));
const CORRECTIONS = JSON.parse(lire('../../tools/sheets/corrections.json'));
const CAPACITES = JSON.parse(lire('../../tools/bestiaire/capacites.json'));
const IGNORER_INVOCATION = JSON.parse(lire('../../tools/sources/ignorer/invocation.json'));
const DECISIONS = lire('../../docs/decisions-regles.md');
/** La ligne d'une décision du registre docs/decisions-regles.md (« | R244 | … | »). */
const decision = (numero) => DECISIONS.split('\n').find((l) => l.startsWith(`| ${numero} |`)) ?? '';
/** Un texte où `avant` ne figure plus hors de `apres` (« dégâts sonore » reste dans « dégâts sonores »). */
const sansAvant = (texte, avant, apres) => !String(texte ?? '').split(apres).join('\u0000').includes(avant);
const V10 = 'Nouveauté mise à jour Décembre';
const PREFIXE = '#specialisation:';
const db = ouvrirBase({ sansExemples: false });
const dImport = () => baseDImport();

test('structure : magie_specialisation, et sort.specialisation_id ajoutée en dernier ; amelioration_cadaverique retirée (R237 (7))', () => {
  const colonnes = db.prepare('PRAGMA table_info(sort)').all();
  assert.equal(colonnes.at(-1).name, 'specialisation_id');
  assert.ok(db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'magie_specialisation'").get());
  assert.equal(db.prepare("SELECT count(*) AS n FROM sqlite_master WHERE name = 'amelioration_cadaverique'").get().n, 0);
  const cle = db.prepare('PRAGMA foreign_key_list(sort)').all().find((f) => f.from === 'specialisation_id');
  assert.deepEqual([cle?.table, cle?.to], ['magie_specialisation', 'id']);
});

test('CHECK (base neuve) : la spécialisation d’un sort est de sa magie (préfixe de son id) et ne porte que des sorts de NPM 3 à 5', () => {
  const essai = new DatabaseSync(':memory:', { enableForeignKeyConstraints: false });
  essai.exec(SCHEMA);
  const spe = essai.prepare('INSERT INTO magie_specialisation (id, magie_id, ordre, nom, nom_cle, origine, source_ref) VALUES (?, ?, ?, ?, ?, \'magies\', \'essai\')');
  spe.run(`magies/a${PREFIXE}x`, 'magies/a', 1, 'X', 'x');
  spe.run(`magies/ab${PREFIXE}y`, 'magies/ab', 1, 'Y', 'y');
  assert.throws(() => spe.run(`magies/ab${PREFIXE}z`, 'magies/a', 2, 'Z', 'z'), /CHECK/, 'id d’une autre magie');
  assert.throws(() => spe.run(`magies/a${PREFIXE}w`, 'magies/a', 3, 'W', 'w'), /CHECK/, 'ordre 1 ou 2');
  const sort = essai.prepare(`INSERT INTO sort (id, magie_id, nom, nom_cle, niveau, ordre, type_brut, ic_direct, imparable, inesquivable, cout_brut, cout_chakra,
    portee_brut, portee_nature, zone_brut, zone_forme, origine, source_ref, specialisation_id)
    VALUES (?, 'magies/a', ?, ?, ?, ?, 'Attaque', 0, 0, 0, '3', 3, 'Vue', 'vue', '1', 'unique', 'magies', 'essai', ?)`);
  let n = 0;
  const poser = (niveau, specialisation) => { n += 1; sort.run(`magies/a#sort:s${n}`, `S${n}`, `s${n}`, niveau, n, specialisation); };
  poser(3, `magies/a${PREFIXE}x`);
  poser(5, `magies/a${PREFIXE}x`);
  poser(1, null);
  poser(4, null); // « chaque sort de NPM 3 à 5 a sa spécialisation » n'est pas un CHECK (db:check)
  assert.throws(() => poser(3, `magies/ab${PREFIXE}y`), /CHECK/, 'spécialisation d’une autre magie (préfixe plus long)');
  assert.throws(() => poser(2, `magies/a${PREFIXE}x`), /CHECK/, 'sort de NPM 2 dans une spécialisation');
  essai.close();
});

test('état courant : chaque spécialisation est d’une magie et a sa ligne page_entite ; chaque sort de spécialisation est de la même magie', () => {
  for (const s of db.prepare('SELECT id, magie_id FROM magie_specialisation').all()) {
    assert.ok(s.id.startsWith(`${s.magie_id}${PREFIXE}`), s.id);
    const e = db.prepare("SELECT page_id, principale FROM page_entite WHERE entite_table = 'magie_specialisation' AND entite_id = ?").get(s.id);
    assert.deepEqual({ ...e }, { page_id: s.magie_id, principale: 0 }, s.id);
  }
  const autres = db.prepare('SELECT s.id FROM sort s JOIN magie_specialisation m ON m.id = s.specialisation_id WHERE m.magie_id <> s.magie_id OR s.niveau < 3').all();
  assert.deepEqual(autres, []);
});

test('import (R236 (1)) : deux spécialisations par magie sauf le Potentiel Illimité ; 30 sorts par magie, 1-10 communs (NPM 1-2), 11-20 et 21-30 par spécialisation (NPM 3-5)', () => {
  const b = dImport();
  const ids = b.prepare('SELECT id FROM magie_specialisation ORDER BY id').all().map((r) => r.id);
  assert.deepEqual(ids, [...REGISTRE.specialisations].sort());
  const magies = b.prepare('SELECT id FROM magie').all().map((r) => r.id);
  for (const m of magies) {
    const spe = b.prepare('SELECT id, ordre FROM magie_specialisation WHERE magie_id = ? ORDER BY ordre').all(m);
    const sorts = b.prepare('SELECT s.ordre, s.niveau, s.specialisation_id, m.ordre AS cote FROM sort s LEFT JOIN magie_specialisation m ON m.id = s.specialisation_id WHERE s.magie_id = ? ORDER BY s.ordre').all(m);
    if (!sorts.length) { assert.equal(spe.length, 0, `${m} : une magie sans sorts (Potentiel Illimité) n'a pas de spécialisation`); continue; }
    assert.deepEqual(spe.map((s) => s.ordre), [1, 2], m);
    assert.deepEqual(sorts.map((s) => s.ordre), Array.from({ length: 30 }, (_, i) => i + 1), m);
    for (const s of sorts) {
      const attendu = s.ordre <= 10 ? null : s.ordre <= 20 ? 1 : 2;
      assert.equal(s.cote ?? null, attendu, `${m} ordre ${s.ordre}`);
      assert.equal(s.specialisation_id === null, s.niveau <= 2, `${m} ordre ${s.ordre} niveau ${s.niveau}`);
    }
  }
});

test('R237 : les sorts supprimés ne sont plus nulle part (hors traces), les renommés gardent leur id, les nouveaux suivent leur nom', () => {
  const b = dImport();
  const supprimes = REGISTRE.sorts.supprimes;
  assert.equal(supprimes.length, 21);
  const present = b.prepare(`SELECT id FROM sort WHERE id IN (${supprimes.map(() => '?').join(', ')})`).all(...supprimes);
  assert.deepEqual(present, []);
  // aucune colonne de texte de la base ne cite un id supprimé, hors des traces (journal du site, notes de version publiées) et de la recherche
  const traces = new Set(['historique_modification', 'note_version_ligne']);
  const tables = b.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '%fts%'").all().map((r) => r.name)
    .filter((t) => !traces.has(t));
  const citations = [];
  for (const t of tables) {
    for (const c of b.prepare(`PRAGMA table_info("${t}")`).all().filter((x) => /TEXT/i.test(x.type))) {
      const n = b.prepare(`SELECT count(*) AS n FROM "${t}" WHERE ${supprimes.map(() => `instr("${c.name}", ?) > 0`).join(' OR ')}`).get(...supprimes).n;
      if (n) citations.push(`${t}.${c.name} : ${n}`);
    }
  }
  assert.deepEqual(citations, []);
  for (const r of [...REGISTRE.sorts.renommes_r237_4, ...REGISTRE.sorts.renommes_r237_11]) {
    assert.ok(b.prepare('SELECT 1 FROM sort WHERE id = ?').get(r.id), r.id);
  }
  for (const id of REGISTRE.sorts.nouveaux) {
    const s = b.prepare('SELECT magie_id, nom_cle FROM sort WHERE id = ?').get(id);
    assert.equal(id, `${s.magie_id}#sort:${s.nom_cle}`, id);
  }
});

test('état courant : aucune ligne ne cite un sort supprimé ; l’invocation n’a plus de tableau de sort (R237 (7))', () => {
  const supprimes = new Set(REGISTRE.sorts.supprimes);
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((r) => r.name);
  for (const t of tables) {
    for (const f of db.prepare(`PRAGMA foreign_key_list("${t}")`).all().filter((x) => x.table === 'sort')) {
      const cites = db.prepare(`SELECT DISTINCT "${f.from}" AS id FROM "${t}" WHERE "${f.from}" IS NOT NULL`).all().filter((r) => supprimes.has(r.id));
      assert.deepEqual(cites, [], `${t}.${f.from}`);
    }
  }
  for (const t of ['page_entite', 'note_cellule']) {
    const cites = db.prepare(`SELECT entite_id FROM ${t} WHERE entite_table = 'sort'`).all().filter((r) => supprimes.has(r.entite_id));
    assert.deepEqual(cites, [], t);
  }
  assert.equal(db.prepare('SELECT count(*) AS n FROM invocation WHERE tableau_sort_id IS NOT NULL').get().n, 0);
});

test('R10 : « Torrant colérique » corrigé ; le sort nouveau a l’id du nom corrigé, et la correction est au registre et dans la table correction', () => {
  const { id } = REGISTRE.sorts.torrent;
  const b = dImport();
  const s = b.prepare('SELECT magie_id, nom, nom_cle FROM sort WHERE id = ?').get(id);
  assert.ok(s, id);
  assert.equal(normalize(s.nom), s.nom_cle);
  assert.equal(id, `${s.magie_id}#sort:${s.nom_cle}`);
  const [, ref] = REGISTRE.sorts.torrent.decision.match(/(\w+ G\d+)/) ?? [];
  const [onglet, cellule] = ref.split(' ');
  const c = CORRECTIONS.dumps['magie-v10'].corrections.find((x) => x.onglet === onglet && x.cellule === cellule);
  assert.ok(c && /R10/.test(c.note), 'corrections.json');
  assert.ok(db.prepare("SELECT 1 FROM correction WHERE dump = 'magie-v10' AND onglet = ? AND cellule = ? AND avant = ?").get(onglet, cellule, c.avant));
  assert.ok(!s.nom.includes(c.avant) && s.nom.includes(c.apres));
  // la table correction est le miroir de la section magie-v10 du registre
  // un même ordre des deux côtés (une cellule peut porter deux corrections : Boxeur AE30)
  const ordre = (x, y) => x.onglet.localeCompare(y.onglet) || x.cellule.localeCompare(y.cellule) || x.avant.localeCompare(y.avant);
  const lignes = db.prepare("SELECT onglet, cellule, avant, apres FROM correction WHERE dump = 'magie-v10'").all().map((r) => ({ ...r })).sort(ordre);
  const registre = CORRECTIONS.dumps['magie-v10'].corrections.map(({ onglet: o, cellule: k, avant, apres }) => ({ onglet: o, cellule: k, avant, apres })).sort(ordre);
  assert.deepEqual(lignes, registre);
});

test('R242 (1) : les cartes du bestiaire écrivent le nom (à l’import) des sorts renommés, et le lien vers le sort est gardé', () => {
  const b = dImport();
  const renommes = REGISTRE.sorts.renommes_r237_11;
  const ancienDe = new Map(renommes.map((r) => [r.id, r.avant]));
  // les capacités des créatures invoquées : la ligne de la liste suit le nom du sort qu'elle vise, le texte le contient
  for (const c of REGISTRE.bestiaire.creature_capacite_sort) {
    const l = b.prepare('SELECT sort_nom_brut, sort_id FROM creature_capacite_sort WHERE capacite_id = ? AND rang = ?').get(c.capacite_id, c.rang);
    assert.equal(l.sort_id, c.sort_id, 'lien gardé');
    const nom = b.prepare('SELECT nom FROM sort WHERE id = ?').get(c.sort_id).nom;
    assert.equal(normalize(l.sort_nom_brut), normalize(nom));
    const texte = b.prepare('SELECT texte FROM creature_capacite WHERE id = ?').get(c.capacite_id).texte;
    assert.ok(normalize(texte).includes(normalize(nom)), c.capacite_id);
    assert.ok(!normalize(texte).includes(normalize(ancienDe.get(c.sort_id))), `${c.capacite_id} : ancien nom`);
  }
  // les cartes de monstres (« Lanceur de sorts ») : plus aucun ancien nom des sorts renommés
  for (const m of REGISTRE.bestiaire.monstre_capacite) {
    const sorts = normalize(b.prepare('SELECT sorts FROM monstre_capacite WHERE monstre_id = ? AND rang = ?').get(m.monstre_id, m.rang).sorts);
    for (const r of renommes) assert.ok(!sorts.includes(normalize(r.avant)) || sorts.includes(normalize(r.apres)), `${m.monstre_id} : ${r.avant}`);
  }
  // chaque écart à la source cite R242 dans son registre
  for (const e of CAPACITES.ecritures.filter((x) => x.placements.some((p) => renommes.some((r) => normalize(p.sorts ?? '').includes(normalize(r.apres)))))) {
    assert.match(e.decision, /R242/, e.texte);
  }
  for (const v of IGNORER_INVOCATION.voulus.filter((x) => ['creature_capacite', 'creature_capacite_sort'].includes(x.table))) assert.match(v.raison, /R242/);
});

test('R242 (2), (3) : les sorts supprimés restent écrits sans lien ; la Poupée fulgurante est rattachée à Boules plasmiques (id gardé)', () => {
  const b = dImport();
  for (const c of REGISTRE.creature_capacite_sort_sans_lien) {
    const l = b.prepare('SELECT sort_nom_brut, sort_id FROM creature_capacite_sort WHERE capacite_id = ? AND rang = ?').get(c.capacite_id, c.rang);
    assert.equal(l.sort_id, null, c.capacite_id);
    assert.equal(l.sort_nom_brut, c.sort_nom_brut);
  }
  const boules = REGISTRE.sorts.renommes_r237_11.find((r) => r.id.endsWith('#sort:boules-de-foudre'));
  const lien = b.prepare("SELECT sort_id FROM creature_capacite_sort WHERE capacite_id = 'bestiaire/poupee-fulgurante#capacite:sort-supplementaire:npm3' AND sort_id = ?").get(boules.id);
  assert.ok(lien, 'Poupée fulgurante -> Boules plasmiques');
});

test('R243 (1) : les six textes d’incantation de Glace et de Terre restent, avec leur provenance dans le classeur V8', () => {
  const b = dImport();
  const ids = REGISTRE.sorts.r243_textes_gardes;
  assert.equal(ids.length, 6);
  for (const id of ids) {
    const s = b.prepare('SELECT niveau, texte_niveau5, source_ref FROM sort WHERE id = ?').get(id);
    assert.equal(s.niveau, 5, id);
    assert.ok(s.texte_niveau5?.trim(), id);
    assert.ok(s.source_ref.startsWith(`${V10} › `) && s.source_ref.includes('; Magie Maverick V8 › '), s.source_ref);
  }
});

test('R243 (2) : les fils de commentaires du V8 sont retirés ; une remarque est ses notes du classeur de Décembre, sauf une remarque modifiée par le site', () => {
  assert.equal(REGISTRE.remarques.fils_v8_retires.length, 31);
  // état courant : note_cellule ne garde que des notes, toutes du classeur de Décembre
  const natures = db.prepare("SELECT DISTINCT nature FROM note_cellule WHERE entite_table = 'sort'").all().map((r) => r.nature);
  assert.deepEqual(natures, ['note']);
  assert.equal(db.prepare("SELECT count(*) AS n FROM note_cellule WHERE entite_table = 'sort' AND source_ref NOT LIKE ?").get(`${V10} › %`).n, 0);
  // à l'import : la remarque d'un sort est le texte de ses notes (séparées par une ligne vide), rien d'autre ; une remarque que le site a modifiée reste
  const b = dImport();
  const site = historiqueSite(db);
  const gardees = new Set(REGISTRE.remarques.remarques_du_site_gardees.map((r) => r.id));
  for (const s of b.prepare('SELECT id, remarque FROM sort').all()) {
    if (gardees.has(s.id) || site.modifiee('sort', { id: s.id }, 'remarque')) continue;
    const notes = b.prepare("SELECT texte FROM note_cellule WHERE entite_table = 'sort' AND entite_id = ? ORDER BY rang").all(s.id).map((n) => n.texte.trim());
    assert.equal(s.remarque ?? null, notes.length ? notes.join('\n\n') : null, s.id);
  }
});

test('R10 : les coquilles candidates retenues sont au registre des dumps (magie-v10) et corrigées à l’import ; celles écartées n’y sont pas', () => {
  const sec = CORRECTIONS.dumps['magie-v10'].corrections;
  const b = dImport();
  assert.ok(REGISTRE.coquilles_r10.length > 0);
  for (const c of REGISTRE.coquilles_r10) {
    const ou = `${c.onglet} ${c.cellule} (${c.id}, ${c.colonne})`;
    const e = sec.find((x) => x.onglet === c.onglet && x.cellule === c.cellule && (x.champ ?? 'v') === c.champ && x.avant === c.avant);
    assert.ok(e, `${ou} : absente de corrections.json`);
    assert.equal(e.apres, c.apres, ou);
    assert.equal(e.occurrences ?? 1, c.occurrences, ou);
    assert.match(e.note, /R10/, ou);
    // la colonne du sort (ou ses notes de cellule pour une note) est lue corrigée : « apres » y est, « avant » n'y est plus qu'à l'intérieur de « apres »
    const sort = b.prepare('SELECT * FROM sort WHERE id = ?').get(c.id);
    assert.ok(sort, `${ou} : sort absent à l'import`);
    const textes = c.champ === 'note'
      ? [sort.remarque, ...b.prepare("SELECT texte FROM note_cellule WHERE entite_table = 'sort' AND entite_id = ?").all(c.id).map((n) => n.texte)]
      : [sort[c.colonne]];
    assert.ok(textes.some((t) => String(t ?? '').includes(c.apres)), `${ou} : « ${c.apres} » absent`);
    for (const t of textes) assert.ok(sansAvant(t, c.avant, c.apres), `${ou} : « ${c.avant} » encore écrit`);
  }
  for (const c of REGISTRE.coquilles_ecartees) {
    assert.ok(!sec.some((x) => x.avant === c.avant && x.apres === c.apres), `${c.id} : candidate écartée présente dans corrections.json`);
  }
});

test('R244 : les coûts du classeur de Décembre non répartis par le service suivent la décision (chakra dans « Coût », précision dans « Coût secondaire ») ; Projectile arcanique reste tel qu’écrit (MAJ-K7)', () => {
  const ligne = decision('R244');
  assert.ok(ligne, 'R244 au registre des décisions');
  const b = dImport();
  assert.ok(REGISTRE.sorts.couts_r244.length > 0);
  for (const c of REGISTRE.sorts.couts_r244) {
    const [, alinea] = /^R244 \((\d)\)$/.exec(c.decision) ?? [];
    assert.ok(alinea && ligne.includes(`(${alinea})`), `${c.id} : ${c.decision}`);
    // le coût secondaire est écrit comme la décision le dit
    assert.ok(ligne.includes(c.cout_secondaire), `${c.id} : « ${c.cout_secondaire} » n'est pas dans R244`);
    if (c.cout_brut === 'N/A') {
      // (5) pas de coût chiffré : la case n'affiche que le coût secondaire
      assert.equal(coutEnUneCase(c.cout_brut, c.cout_secondaire), c.cout_secondaire, c.id);
    } else {
      // le chiffre est celui de la décision et celui de la cellule du classeur
      assert.match(c.cout_brut, /^\d+$/, c.id);
      assert.ok(new RegExp(`(?<!\\d)${c.cout_brut}(?!\\d)`).test(ligne), `${c.id} : ${c.cout_brut} n'est pas dans R244`);
      assert.ok(c.cellule.startsWith(c.cout_brut) && !/^\d/.test(c.cellule.slice(c.cout_brut.length)), `${c.id} : cellule « ${c.cellule} »`);
    }
    const s = b.prepare('SELECT cout_brut, cout_secondaire, cout_chakra, cout_ressource, cout_ressource_valeur FROM sort WHERE id = ?').get(c.id);
    assert.ok(s, c.id);
    assert.deepEqual([s.cout_brut, s.cout_secondaire], [c.cout_brut, c.cout_secondaire], c.id);
    const lu = analyserCout(c.cout_brut, c.cout_secondaire);
    assert.deepEqual({ cout_chakra: s.cout_chakra, cout_ressource: s.cout_ressource, cout_ressource_valeur: s.cout_ressource_valeur }, lu, c.id);
    assert.equal(s.cout_chakra, c.cout_brut === 'N/A' ? null : Number(c.cout_brut), c.id);
  }
  // les autres coûts non répartis (Projectile arcanique, MAJ-K7) : la 0117 garde la cellule telle qu'écrite, rien de typé ; la 0118 (R251) les
  // réécrit ensuite, chaque colonne de son registre partant de la valeur que la 0117 a laissée
  assert.ok(REGISTRE.sorts.couts_non_repartis.every((c) => /MAJ-K7/.test(c.decision)));
  const par0118 = JSON.parse(lire('../../data/migrations/0118-r236-specialisation-de-la-fiche.json')).valeurs;
  for (const c of REGISTRE.sorts.couts_non_repartis) {
    const s = b.prepare('SELECT cout_brut, cout_secondaire, cout_chakra FROM sort WHERE id = ?').get(c.id);
    const laissees = { cout_brut: c.cout_brut, cout_secondaire: null, cout_chakra: null };
    for (const v of par0118.filter((x) => x.table === 'sort' && x.cle.id === c.id)) {
      assert.equal(v.avant, laissees[v.col], `${c.id} : ${v.col} d'avant la 0118`);
      laissees[v.col] = v.apres;
    }
    assert.deepEqual([s.cout_brut, s.cout_secondaire, s.cout_chakra], [laissees.cout_brut, laissees.cout_secondaire, laissees.cout_chakra], c.id);
  }
});

test('R246 : la capacité de la Poupée fulgurante affiche le nom (à l’import) du sort Boules plasmiques, lien gardé (R242 (3)) ; l’écart au classeur Invocation cite R246', () => {
  assert.ok(decision('R246'), 'R246 au registre des décisions');
  const b = dImport();
  const capacites = REGISTRE.bestiaire.creature_capacite.filter((c) => c.decision === 'R246');
  const sorts = REGISTRE.bestiaire.creature_capacite_sort.filter((c) => /R246/.test(c.decision ?? ''));
  assert.equal(capacites.length, 1);
  assert.equal(sorts.length, 1);
  const [l] = sorts;
  assert.equal(l.capacite_id, capacites[0].id);
  const nom = b.prepare('SELECT nom FROM sort WHERE id = ?').get(l.sort_id)?.nom;
  assert.ok(nom, l.sort_id);
  const ligne = b.prepare('SELECT sort_nom_brut, sort_id FROM creature_capacite_sort WHERE capacite_id = ? AND rang = ?').get(l.capacite_id, l.rang);
  assert.deepEqual([ligne.sort_nom_brut, ligne.sort_id], [nom, l.sort_id]);
  const texte = b.prepare('SELECT texte FROM creature_capacite WHERE id = ?').get(l.capacite_id).texte;
  assert.equal(texte, capacites[0].apres);
  assert.ok(texte.includes(nom) && !texte.includes(l.avant), texte);
  // le corps de la page de la créature (recherche) écrit le même texte
  const corps = b.prepare('SELECT corps_md FROM page WHERE id = ?').get(l.capacite_id.split('#')[0]).corps_md;
  assert.ok(corps.includes(capacites[0].apres) && !corps.includes(capacites[0].avant));
  // les écarts voulus au classeur Invocation : texte et nom de la ligne, chacun cite R246
  const voulus = IGNORER_INVOCATION.voulus.filter((v) => /R246/.test(v.raison));
  assert.deepEqual(voulus.map((v) => `${v.table}.${v.colonne}`).sort(), ['creature_capacite.texte', 'creature_capacite_sort.sort_nom_brut']);
  for (const v of voulus) assert.deepEqual([v.avant, v.apres], [l.avant, l.apres]);
});
