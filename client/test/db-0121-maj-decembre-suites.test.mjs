// Migration data/migrations/0121-maj-decembre-suites.sql (suites de la mise à jour de Décembre) : décisions R254 (3) (Archimage), R255 (7) (graphies du
// Boxeur), R258 (4) et (7) et R268 (sept mots-clés des matériaux d'armes, leurs infobulles et leurs balises), R259 (Anti-barrière, Pré-mythril), R264
// (deux événements de la chronologie), R265 (liens de la page du Fongoïde), R266 (trois graphies du lore, partout, Codex compris), R10 (coquille
// d'« Immatériel ») et la suite de R239 (le nombre de races de guide/l-univers et de guide/choisir-sa-race).
// Le site de dev est la source de ce qu'il modifie : ce que la migration écrit se lit dans la base d'import (test/aide-base-d-import.mjs ; une cellule
// que la migration a réécrite après un lot du site n'est plus défaite). Aucun texte n'est écrit ici : avant, après et ids viennent du registre
// de la migration ; les invariants comparent des tables entre elles.
//   node --test test/db-0121-maj-decembre-suites.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { lireBalises, texteSansBalises } from '../src/lib/mots-cles-balises.mjs';
import { TABLES_DERIVEES, TABLES_HORS_REGLES } from '../src/lib/tables-de-la-base.mjs';
import { normalize } from '../src/lib/text.mjs';
import { baseDImport } from './aide-base-d-import.mjs';

const registre = JSON.parse(readFileSync(new URL('../../data/migrations/0121-maj-decembre-suites.json', import.meta.url), 'utf8'));
const dImport = baseDImport();
const un = (sql, ...p) => dImport.prepare(sql).get(...p);
const tous = (sql, ...p) => dImport.prepare(sql).all(...p);
/** La cellule d'une ligne du registre (table et colonnes lues dans le registre, vérifiées contre le schéma). */
function cellule(table, cle, col) {
  const colonnes = new Set(tous(`SELECT name FROM pragma_table_info(?)`, table).map((c) => c.name));
  for (const k of [...Object.keys(cle), col]) assert.ok(colonnes.has(k), `${table}.${k}`);
  return un(`SELECT "${col}" AS v FROM "${table}" WHERE ${Object.keys(cle).map((k) => `"${k}" = ?`).join(' AND ')}`, ...Object.values(cle))?.v;
}
const cleDuMotCle = (id) => un('SELECT cle FROM mot_cle WHERE id = ?', id)?.cle;
const parDecision = (liste, decision) => registre[liste].filter((e) => e.decision === decision);

test('registre : chaque correction et chaque texte de la 0121 est en place à l’import (le nouveau écrit, l’ancien absent de la cellule)', () => {
  assert.ok(registre.corrections.length > 0 && registre.textes.length > 0);
  for (const e of [...registre.corrections, ...registre.textes]) {
    const v = cellule(e.table, e.cle, e.col);
    const ou = `${e.table}.${e.col} ${JSON.stringify(e.cle)}`;
    assert.equal(typeof v, 'string', `${ou} : la ligne existe (identifiant inchangé)`);
    assert.ok(v.includes(e.apres), `${ou} : « ${e.apres} »`);
    if (!e.apres.includes(e.avant)) assert.ok(!v.includes(e.avant), `${ou} : plus de « ${e.avant} »`);
  }
});

test('R254 (3) : le texte de l’Archimage s’arrête après « si vous n’êtes pas du potentiel illimité » (coupé, aucun mot ajouté)', () => {
  const textes = parDecision('textes', 'R254 (3)');
  assert.deepEqual(textes.map((e) => e.table).sort(), ['classe', 'page']);
  for (const e of textes) {
    assert.ok(e.apres.endsWith('.') && e.avant.startsWith(e.apres.slice(0, -1)) && e.avant.length > e.apres.length, 'la fin est retirée, le début reste');
    assert.ok(cellule(e.table, e.cle, e.col).includes(e.apres));
  }
  const classe = textes.find((e) => e.table === 'classe');
  assert.ok(cellule('classe', classe.cle, 'chose_a_savoir').endsWith(classe.apres), 'le texte s’arrête là');
  assert.equal(cellule('page', classe.cle, 'corps_md').includes(classe.apres), true, 'le corps de la page redit la classe');
});

test('R255 (7) : « Posture inébranlable », identifiant et adresse inchangés, clés recalculées ; les trois phrases des dons du Boxeur', () => {
  const corrections = parDecision('corrections', 'R255 (7)');
  const nom = corrections.find((e) => e.table === 'capacite' && e.col === 'nom');
  const id = nom.cle.id;
  const don = un('SELECT nom, nom_cle FROM capacite WHERE id = ?', id);
  assert.equal(don.nom_cle, normalize(don.nom), 'capacite.nom_cle = normalize(nom)');
  const page = un('SELECT slug, titre, titre_cle FROM page WHERE id = ?', id);
  assert.equal(page.titre_cle, normalize(page.titre), 'page.titre_cle = normalize(titre)');
  assert.equal(`capacites/${page.slug}`, id, 'l’adresse ne change pas');
  for (const c of registre.cles) assert.equal(cellule(c.table, c.cle, c.col), c.apres, `${c.table}.${c.col}`);
  // le don, son résumé et le corps de sa page portent la même phrase
  for (const e of corrections.filter((x) => x.table === 'capacite' && x.col === 'effet')) {
    const effet = cellule('capacite', e.cle, 'effet');
    assert.equal(cellule('page', e.cle, 'resume'), effet, e.cle.id);
    assert.equal(cellule('page', e.cle, 'corps_md'), `${effet}\n`, e.cle.id);
  }
});

test('R10 (R268) : « Immatériel » sans espace avant la virgule, dans la capacité commune et ses copies', () => {
  const corrections = parDecision('corrections', 'R268');
  assert.ok(corrections.some((e) => e.table === 'monstre_capacite_commune'));
  for (const e of corrections) assert.doesNotMatch(cellule(e.table, e.cle, e.col), /\) ,/, `${e.table} ${JSON.stringify(e.cle)}`);
});

test('R266 : plus aucune autre écriture des trois graphies hors des traces d’édition ; identifiants, clés et adresses inchangés', () => {
  const horsDuBalayage = new Set([...TABLES_HORS_REGLES, ...TABLES_DERIVEES]);
  const virtuelles = tous("SELECT name FROM sqlite_master WHERE type = 'table' AND sql LIKE 'CREATE VIRTUAL%'").map((t) => t.name);
  const tables = tous("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").map((t) => t.name)
    .filter((t) => !horsDuBalayage.has(t) && !virtuelles.some((v) => t === v || t.startsWith(`${v}_`)));
  const CLE = /^(id|cle|slug|url|origine|source_ref)$|_id$|_cle$/;
  const formes = [
    [/\bdieu de la terre\b/giu, ['Dieu de la Terre']],
    [/\bsupers?[- ]gemmes?\b/giu, ['Super Gemme', 'Super Gemmes']],
    [/\bmort fertile\b/giu, ['Mort Fertile']],
  ];
  const ecarts = [];
  for (const t of tables) {
    const colonnes = tous('SELECT name, type FROM pragma_table_info(?)', t).filter((c) => /TEXT|ANY|^$/i.test(c.type) && !CLE.test(c.name)).map((c) => c.name);
    for (const col of colonnes) {
      for (const ligne of tous(`SELECT "${col}" AS v FROM "${t}" WHERE "${col}" LIKE '%gemme%' OR "${col}" LIKE '%terre%' OR "${col}" LIKE '%fertile%'`)) {
        if (typeof ligne.v !== 'string') continue;
        for (const [motif, bonnes] of formes) {
          for (const m of ligne.v.matchAll(motif)) {
            // une clé ou une adresse dans un texte (« {{super-gemme}} », « /lore/super-gemme/ », « #objet:super-gemme ») n'est pas une graphie
            if (/[{/:#]$/.test(ligne.v.slice(0, m.index))) continue;
            if (!bonnes.includes(m[0])) ecarts.push(`${t}.${col} : « ${m[0]} » (…${ligne.v.slice(Math.max(0, m.index - 40), m.index + 40)}…)`);
          }
        }
      }
    }
  }
  assert.deepEqual(ecarts, []);
  // les identifiants et adresses que la décision garde
  for (const e of parDecision('corrections', 'R266')) assert.ok(cellule(e.table, e.cle, e.col) !== undefined, JSON.stringify(e.cle));
  assert.ok(un("SELECT 1 FROM page WHERE id = 'lore/super-gemme' AND slug = 'super-gemme'"), 'lore/super-gemme garde son adresse');
  // le renvoi écrit de la page du Gémidien (« cf. Codex|…|<titre> », du texte, pas un lien) nomme la page du Codex par son titre
  const gemidien = parDecision('corrections', 'R266').find((e) => e.table === 'race_onglet' && e.col === 'histoire').cle;
  const renvoi = cellule('race_onglet', gemidien, 'histoire').match(/cf\. Codex\|[^|)]+\|([^)]+)\)/);
  assert.ok(renvoi, 'le renvoi est écrit');
  assert.equal(renvoi[1], un("SELECT titre FROM page WHERE id = 'lore/super-gemme'").titre);
});

test('R258 (7), R268 : sept mots-clés sans adresse, non verrouillés, leur catégorie ; quatre infobulles, trois sans (NULL)', () => {
  assert.equal(registre.mots_cles.length, 7);
  for (const m of registre.mots_cles) {
    const l = un('SELECT * FROM mot_cle WHERE id = ?', m.id);
    assert.ok(l, `mot-clé ${m.id}`);
    assert.equal(l.cle, normalize(l.libelle), `${m.id} : sa clé (aucun homonyme)`);
    assert.equal(l.url, null, `${m.id} : sans adresse`);
    assert.equal(l.verrou, 0, `${m.id} : non verrouillé (R219 (5))`);
    assert.deepEqual(tous('SELECT categorie_id FROM mot_cle_categorie WHERE mot_cle_id = ?', m.id).map((c) => c.categorie_id), [m.categorie_id]);
    if (m.description_de) {
      const source = cellule(m.description_de.table, { id: m.description_de.id }, m.description_de.col);
      assert.equal(l.description, source, `${m.id} : le texte de la capacité commune`);
    } else {
      assert.equal(l.description, m.description, `${m.id} : ${m.description === null ? 'pas d’infobulle' : 'le texte de R268'}`);
    }
  }
  assert.deepEqual(registre.mots_cles.filter((m) => m.description === null).length, 3);
  // Immatériel : la balise « Sort fer » de sa capacité comprise
  const immateriel = registre.mots_cles.find((m) => m.description_de?.id === 'immateriel');
  const sortFer = registre.constats.sort_fer.mot_cle_id;
  assert.ok(lireBalises(un('SELECT description FROM mot_cle WHERE id = ?', immateriel.id).description).some((b) => b.ref === cleDuMotCle(sortFer)));
});

test('R258 (7) : balises posées sur les mots des effets des matériaux et du tableau de ressources/armes, sans réécrire le texte', () => {
  const textes = parDecision('textes', 'R258 (7)');
  const nouveaux = new Set(registre.mots_cles.map((m) => cleDuMotCle(m.id)));
  assert.ok(textes.some((e) => e.table === 'materiau_arme') && textes.some((e) => e.table === 'page'));
  for (const e of textes) {
    assert.equal(texteSansBalises(e.apres), texteSansBalises(e.avant), `${JSON.stringify(e.cle)} : le texte affiché ne change pas`);
    const posees = lireBalises(e.apres).filter((b) => !lireBalises(e.avant).some((a) => a.brut === b.brut));
    assert.ok(posees.length > 0 && posees.every((b) => nouveaux.has(b.ref)), `${JSON.stringify(e.cle)} : les balises des sept mots-clés`);
  }
  // l'effet secondaire et la cellule entière d'un matériau portent les mêmes balises
  for (const m of tous('SELECT effet_brut, effet_secondaire FROM materiau_arme WHERE effet_secondaire IS NOT NULL')) {
    assert.ok(m.effet_brut.endsWith(m.effet_secondaire), m.effet_secondaire);
  }
});

test('R258 (7) : le don « Avantage » du Porte-étendard n’est pas capté par le mot-clé « Avantage » (sans adresse, ni étiquette, ni lien)', () => {
  const avantage = registre.mots_cles.find((m) => m.homonyme_non_capte);
  const page = avantage.homonyme_non_capte;
  assert.ok(un('SELECT 1 FROM page WHERE id = ?', page), page);
  assert.equal(un('SELECT url FROM mot_cle WHERE id = ?', avantage.id).url, null);
  assert.equal(un('SELECT count(*) AS n FROM page_tag WHERE tag_id = ?', avantage.id).n, 0, 'aucune page ne le porte en étiquette');
  assert.equal(un('SELECT count(*) AS n FROM lien WHERE cible = ? OR cible_page_id = ?', cleDuMotCle(avantage.id), page).n, 0, 'aucun lien vers le don ni par la balise');
  const corps = un('SELECT corps_md FROM page WHERE id = ?', page).corps_md;
  assert.ok(!lireBalises(corps, { markdown: true }).some((b) => b.ref === cleDuMotCle(avantage.id)), 'la page du don ne cite pas le mot-clé');
});

test('R258 (4) : le mot-clé « Sort fer » n’écrit aucun nombre de sorts ; 14 sorts le portent à l’import', () => {
  const id = registre.constats.sort_fer.mot_cle_id;
  assert.doesNotMatch(un('SELECT description FROM mot_cle WHERE id = ?', id).description ?? '', /\d/);
  assert.equal(un('SELECT count(*) AS n FROM sort_mot_cle WHERE mot_cle_id = ?', id).n, 14);
});

test('R259 : Anti-barrière et Pré-mythril prennent le texte retenu ; le don, son résumé et le corps de sa page s’accordent', () => {
  const textes = parDecision('textes', 'R259');
  assert.deepEqual([...new Set(textes.map((e) => e.table))].sort(), ['capacite', 'monstre_capacite_commune', 'page']);
  for (const e of textes) {
    assert.notEqual(e.apres, e.avant);
    assert.ok(cellule(e.table, e.cle, e.col).includes(e.apres));
  }
  const don = textes.find((e) => e.table === 'capacite').cle;
  const effet = cellule('capacite', don, 'effet');
  assert.equal(cellule('page', don, 'resume'), effet);
  assert.equal(cellule('page', don, 'corps_md'), `${effet}\n`);
});

test('R264 : apparition des Gémidiens et des Fongoïdes, aux rangs suivants, sans catégorie ni portée, extrait copié de la Présentation de la race', () => {
  assert.equal(registre.evenements.length, 2);
  const autres = un(`SELECT max(rang) AS m FROM evenement WHERE id NOT IN (${registre.evenements.map(() => '?').join(', ')})`, ...registre.evenements.map((e) => e.id)).m;
  registre.evenements.forEach((r, i) => {
    const e = un('SELECT * FROM evenement WHERE id = ?', r.id);
    assert.ok(e, r.id);
    assert.deepEqual({ epoque: e.epoque, annee: e.annee, portee: e.portee, rang: e.rang, titre_cle: e.titre_cle },
      { epoque: 'datee', annee: r.annee, portee: null, rang: registre.evenements[0].rang + i, titre_cle: normalize(e.titre) }, r.id);
    // un événement ajouté prend le rang suivant (règle du site) : après tous ceux de l'import
    assert.ok(e.rang > autres, `${r.id} : rang ${e.rang} après ${autres}`);
    assert.equal(un('SELECT count(*) AS n FROM evenement_categorie WHERE evenement_id = ?', r.id).n, 0, `${r.id} : aucune catégorie`);
    const x = tous('SELECT * FROM evenement_extrait WHERE evenement_id = ?', r.id);
    assert.equal(x.length, 1);
    assert.equal(x[0].page_id, r.page_id);
    assert.ok(x[0].texte.includes(x[0].date_brut) && x[0].date_brut.includes(String(e.annee)), `${r.id} : la date dans le texte`);
    const corps = un('SELECT corps_md FROM page WHERE id = ?', r.page_id).corps_md;
    const presentation = corps.slice(corps.indexOf(`## ${x[0].section}\n`)).split('\n## ')[0];
    assert.ok(corps.includes(`## ${x[0].section}\n`) && presentation.includes(x[0].texte), `${r.id} : copié de la section ${x[0].section}`);
    const onglet = un('SELECT description_generale FROM race_onglet WHERE race_id = ?', r.page_id).description_generale;
    assert.ok(texteSansBalises(onglet).includes(x[0].texte), `${r.id} : le texte de l’onglet`);
  });
});

test('R265 : la page du Fongoïde mène à Dimitri et au Champicer par des balises posées sur ses mots, sans un mot changé', () => {
  const textes = parDecision('textes', 'R265');
  assert.equal(new Set(textes.map((e) => e.mot_cle_id)).size, 2);
  const race = textes.find((e) => e.table === 'race_onglet').cle.race_id;
  const cibles = new Set(tous('SELECT cible_page_id FROM lien WHERE page_id = ?', race).map((l) => l.cible_page_id));
  for (const e of textes) {
    assert.equal(texteSansBalises(e.apres), texteSansBalises(e.avant), 'aucun mot changé');
    const [b] = lireBalises(e.apres);
    assert.equal(b.ref, cleDuMotCle(e.mot_cle_id), `${e.col} : la balise du mot-clé ${e.mot_cle_id}`);
    const url = un('SELECT url FROM mot_cle WHERE id = ?', e.mot_cle_id).url;
    assert.ok(cibles.has(url.replace(/^\/|\/$/g, '')), `${race} -> ${url}`);
  }
});

test('suite de R239 : guide/l-univers et guide/choisir-sa-race comptent les races de la base', () => {
  const textes = parDecision('textes', 'R239');
  assert.equal(textes.length, 2);
  const races = un('SELECT count(*) AS n FROM race').n;
  for (const e of textes) {
    // le nombre écrit à la place de celui du registre (« **N races** », « {{race|N races}} ») : seul le nombre change
    assert.equal(e.apres.replace(/\d+/, ''), e.avant.replace(/\d+/, ''), `${e.cle.id} : seul le nombre change`);
    const motif = new RegExp(e.apres.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\d+/, '(\\d+)'));
    const n = Number(cellule(e.table, e.cle, e.col).match(motif)?.[1]);
    assert.equal(n, races, e.cle.id);
  }
});
