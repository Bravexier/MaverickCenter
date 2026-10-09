// Migration 0006-orthographe-noms : les « noms à trancher » de 0003 et 0005, corrigés selon la décision du propriétaire (sens le plus probable ;
// pour un nom propre écrit de plusieurs façons, la graphie majoritaire). Le registre `data/migrations/0006-orthographe-noms.json` donne chaque
// renommage (cellule, avant, après, nombre, nature, raison) et chaque clé de nom recalculée. Ces tests vérifient qu'un nom corrigé l'est partout,
// que sa clé suit, que les identifiants ne bougent pas (une page renommée garde son adresse) et que rien d'autre n'est touché.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { ouvrirBase, trouverRacine } from '../src/lib/donnees.mjs';
import { normalize } from '../src/lib/text.mjs';

const racine = trouverRacine();
const dossier = join(racine, 'data', 'migrations');
const registre = JSON.parse(readFileSync(join(dossier, '0006-orthographe-noms.json'), 'utf8'));
const sql = readFileSync(join(dossier, '0006-orthographe-noms.sql'), 'utf8');
const { corrections, cles } = registre;
const db = ouvrirBase({ sansExemples: false });

const NATURES = ['accent', 'casse', 'frappe', 'grammaire', 'harmonisation', 'orthographe', 'ponctuation', 'phrase'];
// tables de trace ou de clés : jamais réécrites (mêmes que pour 0005)
const INTOUCHABLES = ['source', 'ecart_source', 'alias', 'page_tag', 'page_source', 'page_entite', 'famille', 'type_page', 'correction', 'commentaire_orphelin', 'lien', 'lien_candidat'];
// écriture de la source gardée comme trace (le schéma le dit ; ecart_source documente le rapprochement)
const TRACES = ['accessoire_effet.gemmes_brut', 'accessoire_effet_gemme.nom_source', 'ethnie.race_brut'];
// tables dont l'id était « préfixe || nom_cle » jusqu'à 0006 : l'id garde la clé du nom d'origine
const IDS_GELES = { sort: '#sort:', classe: 'classes/', invocation: 'bestiaire/', invocation_capacite_commune: '#commune:', creature: 'bestiaire/', creature_attaque: '#attaque:', creature_capacite: '#capacite:' };
const REGLE = /[0-9+−×÷/%=<>]|(?<![\p{L}])-|-(?![\p{L}])|\bd\d/giu;
// une barre entre deux mots les sépare (« Livre/Parchemin », « Corne/Os ») : ce n'est pas un signe de règle
const regle = (s) => (s.replace(/(?<=\p{L})\/(?=\p{L})/gu, ' ').match(REGLE) ?? []).join('');

function ligne(table, cle) {
  return db.prepare(`SELECT * FROM "${table}" WHERE ${Object.keys(cle).map((k) => `"${k}" = ?`).join(' AND ')}`).get(...Object.values(cle));
}

test('registre : renommages décrits, de nature connue, hors des tables de trace, des colonnes de clés et de l’écriture de la source', () => {
  assert.equal(registre.migration, '0006-orthographe-noms');
  assert.ok(corrections.length > 400, `entrées du registre : ${corrections.length}`);
  for (const c of corrections) {
    const nom = `${c.table} ${JSON.stringify(c.cle)} ${c.col}`;
    assert.ok(NATURES.includes(c.nature), `${nom} : nature « ${c.nature} »`);
    assert.ok(c.avant && c.apres && c.raison && c.n >= 1, `${nom} : avant, après, nombre et raison sont obligatoires`);
    assert.notEqual(c.avant, c.apres);
    assert.ok(!INTOUCHABLES.includes(c.table), `${nom} : table intouchable`);
    assert.ok(!/(^|_)(id|cle)$|^slug$|^source_ref$|^origine$|^onglet$/.test(c.col), `${nom} : colonne de clé`);
    assert.ok(!TRACES.includes(`${c.table}.${c.col}`), `${nom} : écriture de la source gardée comme trace`);
    assert.equal(regle(c.apres), regle(c.avant), `${nom} : « ${c.avant} » -> « ${c.apres} » change un chiffre, un signe ou un dé`);
    assert.ok(!/https?:|\[\[|\]\]/.test(c.avant + c.apres), `${nom} : adresse ou lien dans le renommage`);
  }
});

test('base : chaque renommage est fait (le nom corrigé est dans sa cellule)', () => {
  for (const c of corrections) {
    const l = ligne(c.table, c.cle);
    assert.ok(l, `${c.table} ${JSON.stringify(c.cle)} : ligne absente`);
    assert.ok(l[c.col].includes(c.apres), `${c.table} ${JSON.stringify(c.cle)} ${c.col} : « ${c.apres} » absent`);
  }
});

test('clés de nom : recalculées (normalize du nom corrigé), identifiants inchangés', () => {
  assert.ok(cles.length > 100, `clés recalculées : ${cles.length}`);
  for (const c of cles) {
    const l = ligne(c.table, c.cle);
    assert.ok(l, `${c.table} ${JSON.stringify(c.cle)} : identifiant disparu`);
    const source = c.col.slice(0, -'_cle'.length);
    assert.equal(l[c.col], c.apres);
    assert.equal(normalize(l[source]), c.apres, `${c.table} ${JSON.stringify(c.cle)} : clé désaccordée de « ${l[source]} »`);
    assert.notEqual(c.avant, c.apres);
    // l'identifiant d'une table qui le dérivait du nom garde la clé d'origine
    if (IDS_GELES[c.table] && c.col === 'nom_cle') assert.ok(c.cle.id.includes(`${IDS_GELES[c.table]}${c.avant}`), `${c.cle.id} : l'id ne garde pas la clé d'origine « ${c.avant} »`);
  }
  // les pages renommées gardent leur id et leur slug (donc leur adresse)
  for (const c of cles.filter((x) => x.table === 'page')) {
    const p = ligne('page', c.cle);
    assert.equal(p.id, `${p.type}/${p.slug}`);
  }
});

test('schéma : plus aucune table ne dérive son id du nom (identifiants gelés), et toutes les cibles [[…]] se résolvent', () => {
  for (const t of Object.keys(IDS_GELES)) {
    const def = db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?").get(t).sql.replace(/--[^\n]*/g, '');
    assert.doesNotMatch(def, /CHECK\s*\(\s*id\s*=.*nom_cle/s, `${t} : l'id est encore contraint par le nom`);
  }
  assert.deepEqual(db.prepare("SELECT etat, count(*) AS n FROM lien GROUP BY etat").all().map((r) => r.etat), ['resolu']);
});

test('migration SQL : une ligne de commentaire par renommage, les sept tables reconstruites, aucune autre table créée ni supprimée', () => {
  const lignes = sql.split('\n').filter((l) => /^-- [a-z_]+ .+ \[[a-zé]+\] ×\d+ : « /.test(l));
  assert.equal(lignes.length, corrections.length);
  const crees = [...sql.matchAll(/^CREATE TABLE (\w+)__0006 \(/gm)].map((m) => m[1]);
  assert.deepEqual(crees.sort(), Object.keys(IDS_GELES).sort());
  assert.deepEqual([...sql.matchAll(/^DROP TABLE "(\w+)";/gm)].map((m) => m[1]).sort(), Object.keys(IDS_GELES).sort());
  assert.doesNotMatch(sql, /\b(BEGIN|COMMIT|PRAGMA)\b/i, 'le migrateur gère la transaction');
});

test('anciennes graphies disparues des textes (hors traces de la source et citations « telles quelles » de la fiche)', () => {
  const fautes = [/Supprémaciste/, /Marcass Ubain/, /\bOccultomancien/, /Sihouetteur/, /Marionette de lombre/, /MARIONETTE/, /Foudre argenté(?!\p{L})/u, /Touché du Vide/,
    /Verrouille Visible/, /Résurrection Noir\b/, /Brume mental\b/, /Estoc hurlante/, /[Vv]ague de cadavre\b/, /Onde Confusion/, /Colonne tesla/, /\bPavoi\b/, /\bOnix\b/,
    /\bDiament\b/, /\bEmmeraude\b/, /\bGyspe\b/, /\b[Bb]revage\b/, /cyante/, /\bSouffre\b/, /\bJacklope\b/, /\bFrappeud\b/, /\bMithril\b/, /\bowlmans?\b/, /Drassah'Thac/,
    /\bkistunes?\b/, /\b[Pp]anacée (mineur|majeur|parfait)\b/, /\bArmure [^|\n<]{0,30} complet\b/, /[Pp]ara-tonnerre/, /\bVeilliessement\b/, /[Pp]urée de poix/, /\bRocks?\b/];
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE '%fts%' AND name NOT LIKE 'sqlite_%'").all()
    .map((t) => t.name).filter((t) => !INTOUCHABLES.includes(t));
  for (const t of tables) {
    const cols = db.prepare(`PRAGMA table_info("${t}")`).all()
      .filter((c) => c.type === 'TEXT' && !/(_id|^id|_cle|^cle|^slug|^source_ref|^origine|^onglet)$/.test(c.name) && !TRACES.includes(`${t}.${c.name}`));
    for (const col of cols) {
      for (const { v } of db.prepare(`SELECT "${col.name}" AS v FROM "${t}" WHERE "${col.name}" IS NOT NULL`).all()) {
        // les tableaux d'écarts des races citent la fiche telle quelle ; « Veilliessement » reste le nom écrit dans la liste de la momie (sort_nom_brut, non rapproché)
        const texte = t === 'page' && col.name === 'corps_md' ? v.split('\n').filter((l) => !/^\| .*\| .*\| .*\|$/.test(l) || !/V15\.2\.2|fiche :/.test(l)).join('\n') : v;
        for (const f of fautes) {
          if (t === 'creature_capacite_sort' && col.name === 'sort_nom_brut' && texte === 'Veilliessement') continue;
          assert.doesNotMatch(texte, f, `${t}.${col.name} : ${f} est revenu`);
        }
      }
    }
  }
});

test('noms gardés tels quels, par décision : graphie majoritaire, mot existant ou trace de la source', () => {
  assert.equal(db.prepare("SELECT nom FROM classe WHERE id = 'classes/ocultomancien'").get().nom, 'Ocultomancien', 'graphie majoritaire (48 contre 3)');
  assert.ok(db.prepare("SELECT 1 FROM sort WHERE nom = 'Renfermement'").get(), '« renfermement » existe : nom gardé');
  assert.ok(db.prepare("SELECT 1 FROM sort WHERE nom = 'Explosion glorifique'").get(), '« glorifique » existe (vieilli) : nom gardé');
  assert.deepEqual(db.prepare("SELECT nom FROM dieu WHERE id IN ('seraphe', 'seraphin') ORDER BY id").all().map((d) => d.nom), ['Séraphe', 'Séraphin'], 'deux dieux distincts');
  assert.equal(db.prepare("SELECT count(*) AS n FROM ethnie WHERE race_brut = 'Felfle'").get().n, 3, 'colonne « Race » de l’onglet citée telle quelle');
  assert.equal(db.prepare("SELECT sort_nom_brut FROM creature_capacite_sort WHERE capacite_id = 'bestiaire/momie#capacite:sort-supplementaire:npm5' AND rang = 2").get().sort_nom_brut, 'Veilliessement');
  // le nom de l'invocation est corrigé, l'onglet du classeur garde le sien dans les sources
  assert.equal(db.prepare("SELECT nom FROM invocation WHERE id = 'bestiaire/marionette-de-lombre'").get().nom, "Marionnette de l'ombre");
  assert.ok(db.prepare("SELECT 1 FROM source WHERE texte LIKE '%onglet « Marionette de lombre »%'").get());
});
