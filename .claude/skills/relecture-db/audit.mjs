#!/usr/bin/env node
// Audit automatique de la base (compétence « relecture-db », agent `expert-sql`) : un RELEVÉ de constats à examiner, jamais un verdict ni une correction.
//   node --no-warnings .claude/skills/relecture-db/audit.mjs [--base var/maverick.db] [--json] [--sortie <fichier>] [--exemples 3]   (depuis la racine du dépôt)
// Construire la base d'abord (depuis client/ : `npm run db:build`). Le script travaille sur une COPIE dans un dossier temporaire (contrôle de la recherche
// plein texte, plans d'exécution), effacée à la sortie même en cas d'erreur : la base lue n'est jamais modifiée. Il refuse une base qui contient des fiches
// (section 13 non vide : base vivante d'un serveur). Aucune dépendance : node:sqlite (Node >= 22.13), node:fs.
// Ce que l'audit ne sait pas juger (une valeur conforme à sa source, une modélisation adaptée au besoin) reste à la relecture : voir SKILL.md.
import { DatabaseSync } from 'node:sqlite';
import { copyFileSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = resolve(fileURLToPath(new URL('../../../', import.meta.url)));
const arreter = (message) => { console.error(message); process.exit(2); };
function arg(nom, defaut) {
  const i = process.argv.indexOf(nom);
  if (i < 0) return defaut;
  const v = process.argv[i + 1];
  if (v === undefined || v.startsWith('--')) arreter(`${nom} attend une valeur`);
  return v;
}
const BASE = resolve(arg('--base', join(RACINE, 'var', 'maverick.db')));
const EXEMPLES = Number(arg('--exemples', '3'));
const SORTIE = arg('--sortie', null);
const EN_JSON = process.argv.includes('--json');
if (!Number.isInteger(EXEMPLES) || EXEMPLES < 0) arreter('--exemples attend un entier positif ou nul');
if (!existsSync(BASE)) arreter(`Base introuvable : ${BASE}. Depuis client/ : npm run db:build`);

const dossier = mkdtempSync(join(tmpdir(), 'audit-db-'));
let db = null;
process.on('exit', () => {
  try { db?.close(); } catch { /* déjà fermée */ }
  rmSync(dossier, { recursive: true, force: true });
});
const copie = join(dossier, 'audit.db');
copyFileSync(BASE, copie);
db = new DatabaseSync(copie);
db.exec('PRAGMA foreign_keys = ON');

const q = (nom) => `"${nom.replaceAll('"', '""')}"`;
const echapper = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const tous = (sql, ...p) => db.prepare(sql).all(...p);
const un = (sql, ...p) => db.prepare(sql).get(...p);
const court = (v, n = 80) => { const s = String(v).replace(/\n/g, '⏎'); return s.length > n ? `${s.slice(0, n)}…` : s; };

// ---------------------------------------------------------------------------------------------------------------------------------------------------
// Schéma déclaré (data/schema.sql) : section de chaque table et vue, tables dérivées (`-- @derivee`), pour ranger les constats comme la relecture.
// ---------------------------------------------------------------------------------------------------------------------------------------------------
const schemaSql = readFileSync(join(RACINE, 'data', 'schema.sql'), 'utf8');
const sectionDe = new Map();
const derivees = new Set();
const sections = [];
{
  let section = 'en-tête';
  let derivee = false;
  for (const ligne of schemaSql.split('\n')) {
    const s = /^-- (\d+(?: bis)?)\. (.+)$/.exec(ligne);
    if (s) { section = `${s[1]}. ${s[2].split(/ [:(]/)[0]}`; sections.push(section); continue; }
    if (/^-- @derivee\b/.test(ligne)) { derivee = true; continue; }
    const c = /^CREATE (?:VIRTUAL )?(TABLE|VIEW) (?:IF NOT EXISTS )?(\w+)/.exec(ligne);
    if (c) { sectionDe.set(c[2], section); if (derivee && c[1] === 'TABLE') derivees.add(c[2]); derivee = false; }
  }
}
const numeroDeSection = (nom) => (sectionDe.get(nom) ?? 'hors schema.sql').split('.')[0];
// Tables vides par construction : fiches (13), journal de l'édition (14) ; les dérivées et la section 15 sont pleines ou vides selon la base.
const VIDES_ATTENDUES = new Set(['13', '14']);

// ---------------------------------------------------------------------------------------------------------------------------------------------------
// Objets de la base
// ---------------------------------------------------------------------------------------------------------------------------------------------------
const maitre = tous("SELECT type, name, tbl_name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%'");
const virtuelles = maitre.filter((o) => o.type === 'table' && /^CREATE VIRTUAL/i.test(o.sql ?? '')).map((o) => o.name);
const ombre = new Set(maitre.filter((o) => o.type === 'table' && virtuelles.some((v) => o.name.startsWith(`${v}_`))).map((o) => o.name));
const tables = maitre.filter((o) => o.type === 'table' && !virtuelles.includes(o.name) && !ombre.has(o.name)).map((o) => o.name).sort();
const vues = maitre.filter((o) => o.type === 'view').map((o) => o.name).sort();
const sqlDe = new Map(maitre.map((o) => [o.name, o.sql ?? '']));
const colonnesDe = new Map(tables.map((t) => [t, tous(`PRAGMA table_xinfo(${q(t)})`).filter((c) => c.hidden === 0)]));
const lignesDe = new Map(tables.map((t) => [t, un(`SELECT count(*) AS n FROM ${q(t)}`).n]));
const fiches = tables.filter((t) => numeroDeSection(t) === '13' && lignesDe.get(t) > 0);
if (fiches.length) arreter(`Base refusée : la section 13 n'est pas vide (${fiches.join(', ')}). L'audit ne lit pas de fiches de joueurs : utiliser la base construite (var/maverick.db).`);
const clesEtrangeres = new Map(tables.map((t) => {
  const groupes = new Map();
  for (const fk of tous(`PRAGMA foreign_key_list(${q(t)})`)) {
    if (!groupes.has(fk.id)) groupes.set(fk.id, { parent: fk.table, colonnes: [], cibles: [], suppression: fk.on_delete, maj: fk.on_update });
    groupes.get(fk.id).colonnes.push(fk.from);
    groupes.get(fk.id).cibles.push(fk.to);
  }
  return [t, [...groupes.values()]];
}));
const indexDe = new Map(tables.map((t) => [t, tous(`PRAGMA index_list(${q(t)})`).map((i) => ({
  nom: i.name, unique: i.unique === 1, origine: i.origin, partiel: i.partial === 1,
  colonnes: tous(`PRAGMA index_info(${q(i.name)})`).map((c) => c.name ?? '<expression>'),
}))]));
const clePrimaire = (t) => colonnesDe.get(t).filter((c) => c.pk > 0).sort((a, b) => a.pk - b.pk).map((c) => c.name);
// SQL sans ses commentaires `--` (hors chaînes : '*--*' reste), lignes conservées.
function sansCommentaires(texte) {
  let res = '';
  let chaine = false;
  for (let i = 0; i < texte.length; i += 1) {
    const ch = texte[i];
    if (chaine) { res += ch; if (ch === "'") chaine = false; continue; }   // '' (apostrophe doublée) : fermée puis rouverte, même résultat
    if (ch === "'") { chaine = true; res += ch; continue; }
    if (ch === '-' && texte[i + 1] === '-') {
      while (i < texte.length && texte[i] !== '\n') { res += ' '; i += 1; }
      if (i < texte.length) res += '\n';
      continue;
    }
    res += ch;
  }
  return res;
}
// Expressions CHECK (parenthèses équilibrées, chaînes sautées) avec leur position : une colonne est « contrôlée » si l'une d'elles la nomme.
function expressionsCheck(sql) {
  const res = [];
  for (const m of sql.matchAll(/\bCHECK\s*\(/gi)) {
    let i = m.index + m[0].length, prof = 1, chaine = false;
    while (i < sql.length && prof > 0) {
      const ch = sql[i];
      if (chaine) { if (ch === "'") chaine = false; } else if (ch === "'") chaine = true; else if (ch === '(') prof += 1; else if (ch === ')') prof -= 1;
      i += 1;
    }
    res.push({ debut: m.index, fin: i, texte: sql.slice(m.index, i) });
  }
  return res;
}
const checksDe = (t) => expressionsCheck(sansCommentaires(sqlDe.get(t))).map((c) => c.texte);
const controlee = (t, col) => checksDe(t).some((c) => new RegExp(`\\b${echapper(col)}\\b`).test(c));
const colonnesEtrangeres = (t) => new Set(clesEtrangeres.get(t).flatMap((f) => f.colonnes));

const R = {
  base: { fichier: relative(RACINE, BASE), octets: statSync(BASE).size },
  moteur: {}, tables: {}, cles: {}, index: {}, contraintes: {}, donnees: {}, textes: [], doublons: [], rangs: [], vues: {}, fts: [], portabilite: [], usage: {}, sections: [],
};

// ---------------------------------------------------------------------------------------------------------------------------------------------------
// 1. Moteur
// ---------------------------------------------------------------------------------------------------------------------------------------------------
R.moteur.integrity_check = tous('PRAGMA integrity_check').map((r) => r.integrity_check);
// « foreign key mismatch » (clé étrangère vers une colonne ni primaire ni unique) fait lever le PRAGMA : noté, la section 3 dit laquelle.
try { R.moteur.foreign_key_check = tous('PRAGMA foreign_key_check').slice(0, 50); } catch (e) { R.moteur.foreign_key_check = [{ erreur: e.message }]; }
for (const p of ['user_version', 'page_size', 'page_count', 'freelist_count', 'encoding', 'journal_mode', 'auto_vacuum', 'application_id']) {
  R.moteur[p] = Object.values(un(`PRAGMA ${p}`))[0];
}
R.moteur.sqlite = un('SELECT sqlite_version() AS v').v;
const fichierVersion = join(RACINE, 'data', 'rows', 'VERSION');
const versionRows = existsSync(fichierVersion) ? Number(/\d+/.exec(readFileSync(fichierVersion, 'utf8'))?.[0] ?? NaN) : null;
R.moteur.version_rows = versionRows;

// ---------------------------------------------------------------------------------------------------------------------------------------------------
// 2. Tables
// ---------------------------------------------------------------------------------------------------------------------------------------------------
R.tables.nombre = tables.length;
R.tables.vues = vues.length;
R.tables.virtuelles = virtuelles;
R.tables.lignes = [...lignesDe.values()].reduce((a, b) => a + b, 0);
R.tables.non_strict = tables.filter((t) => !/\)\s*(?:WITHOUT ROWID\s*,\s*)?STRICT\s*(?:,\s*WITHOUT ROWID\s*)?;?\s*$/i.test(sqlDe.get(t)));
R.tables.sans_cle_primaire = tables.filter((t) => clePrimaire(t).length === 0);
R.tables.hors_schema = [...tables, ...vues].filter((n) => !sectionDe.has(n));
R.tables.absentes_de_la_base = [...sectionDe.keys()].filter((n) => !tables.includes(n) && !vues.includes(n) && !virtuelles.includes(n));
R.tables.vides = tables.filter((t) => lignesDe.get(t) === 0).map((t) => ({ table: t, section: numeroDeSection(t), attendue: VIDES_ATTENDUES.has(numeroDeSection(t)) }));
const fichiersRows = new Set(readdirSync(join(RACINE, 'data', 'rows')).filter((f) => f.endsWith('.sql')).map((f) => f.slice(0, -4)));
R.tables.sans_fichier_rows = tables.filter((t) => !derivees.has(t) && !fichiersRows.has(t));
R.tables.fichier_rows_sans_table = [...fichiersRows].filter((f) => !tables.includes(f));
R.tables.derivees_exportees = [...derivees].filter((t) => fichiersRows.has(t));

// ---------------------------------------------------------------------------------------------------------------------------------------------------
// 3. Clés étrangères
// ---------------------------------------------------------------------------------------------------------------------------------------------------
R.cles.total = [...clesEtrangeres.values()].reduce((a, l) => a + l.length, 0);
R.cles.sans_index = [];
R.cles.origine_sans_index = 0;
R.cles.types_differents = [];
R.cles.cible_non_unique = [];
R.cles.colonnes_id_sans_cle = [];
const declare = (t, c) => (colonnesDe.get(t)?.find((x) => x.name === c)?.type ?? '?').toUpperCase();
for (const t of tables) {
  const idx = indexDe.get(t);
  for (const fk of clesEtrangeres.get(t)) {
    // Couverte : un index qui commence par ses colonnes, complet ou partiel « WHERE col IS NOT NULL » (clé clairsemée, convention du schéma).
    const nonNul = (i) => fk.colonnes.length === 1
      && new RegExp(`WHERE\\s+"?${echapper(fk.colonnes[0])}"?\\s+IS\\s+NOT\\s+NULL\\s*;?\\s*$`, 'i').test(sansCommentaires(sqlDe.get(i.nom) ?? '').trim());
    const couvert = idx.some((i) => fk.colonnes.every((c, k) => i.colonnes[k] === c) && (!i.partiel || nonNul(i)));
    if (!couvert) {
      if (fk.colonnes.length === 1 && fk.colonnes[0] === 'origine') R.cles.origine_sans_index += 1;
      else R.cles.sans_index.push({ table: t, section: numeroDeSection(t), colonnes: fk.colonnes.join(', '), parent: fk.parent, suppression: fk.suppression });
    }
    fk.colonnes.forEach((c, k) => {
      const cible = fk.cibles[k] ?? clePrimaire(fk.parent)[k];
      const a = declare(t, c), b = declare(fk.parent, cible);
      if (a !== b) R.cles.types_differents.push({ table: t, colonne: c, type: a, parent: `${fk.parent}.${cible}`, type_parent: b });
    });
    const cibles = fk.cibles.every(Boolean) ? fk.cibles : clePrimaire(fk.parent);
    const pk = clePrimaire(fk.parent);
    const unique = (pk.length === cibles.length && pk.every((c) => cibles.includes(c)))
      || (indexDe.get(fk.parent) ?? []).some((i) => i.unique && !i.partiel && i.colonnes.length === cibles.length && i.colonnes.every((c) => cibles.includes(c)));
    if (!unique) R.cles.cible_non_unique.push({ table: t, colonnes: fk.colonnes.join(', '), parent: `${fk.parent}(${cibles.join(', ')})` });
  }
  // Colonne `x_id` sans clé étrangère : une référence que SQLite ne garde pas (F6 en assume trois : entite_table / entite_id).
  const fkCols = colonnesEtrangeres(t);
  for (const c of colonnesDe.get(t)) {
    if (!/_id$/.test(c.name) || fkCols.has(c.name)) continue;
    const cand = [c.name.replace(/_id$/, ''), ...tables.filter((x) => c.name.replace(/_id$/, '').endsWith(`_${x}`))].find((x) => tables.includes(x));
    let rompues = null;
    if (cand && clePrimaire(cand).length === 1) {
      rompues = un(`SELECT count(*) AS n FROM ${q(t)} WHERE ${q(c.name)} IS NOT NULL AND ${q(c.name)} NOT IN (SELECT ${q(clePrimaire(cand)[0])} FROM ${q(cand)})`).n;
    }
    R.cles.colonnes_id_sans_cle.push({ table: t, colonne: c.name, cible_probable: cand ?? null, valeurs_sans_cible: rompues });
  }
}

// ---------------------------------------------------------------------------------------------------------------------------------------------------
// 4. Index : doublons et index couverts par un autre (préfixe), hors index partiels
// ---------------------------------------------------------------------------------------------------------------------------------------------------
R.index.total = [...indexDe.values()].reduce((a, l) => a + l.length, 0);
R.index.redondants = [];
for (const t of tables) {
  const idx = indexDe.get(t).filter((i) => !i.partiel);
  for (const a of idx) {
    if (a.origine !== 'c') continue;                       // seuls les index créés à la main (CREATE INDEX) se retirent
    if (a.colonnes.includes('<expression>')) continue;     // deux expressions ne se comparent pas : à relire à la main
    const b = idx.find((x) => x !== a && x.colonnes.length >= a.colonnes.length && a.colonnes.every((c, k) => x.colonnes[k] === c)
      && (!a.unique || (x.unique && x.colonnes.length === a.colonnes.length)));
    if (b) R.index.redondants.push({ table: t, index: a.nom, colonnes: a.colonnes.join(', '), couvert_par: `${b.nom} (${b.colonnes.join(', ')})` });
  }
}

// ---------------------------------------------------------------------------------------------------------------------------------------------------
// 5. Contraintes et colonnes : booléens et énumérations sans CHECK, colonnes toujours NULL ou constantes
// ---------------------------------------------------------------------------------------------------------------------------------------------------
const SANS_ENUM = /(^id$|_id$|_cle$|_brut$|_md$|^nom|^titre|texte|^remarque$|description|^source_ref$|^slug$|^alias|resume|^libelle|^intitule|^empreinte|^portrait|^cellule|^valeur)/;
R.contraintes.booleens_sans_check = [];
R.contraintes.enumerations_sans_check = [];
R.donnees.toujours_null = [];
R.donnees.remarques_vides = [];
R.donnees.constantes = [];
for (const t of tables) {
  const n = lignesDe.get(t);
  if (n === 0) continue;
  const fkCols = colonnesEtrangeres(t);
  const pk = new Set(clePrimaire(t));
  for (const c of colonnesDe.get(t)) {
    const col = q(c.name);
    const s = un(`SELECT count(${col}) AS nn, count(DISTINCT ${col}) AS d FROM ${q(t)}`);
    if (s.nn === 0) {
      // `remarque` vide = NULL (convention : notes de cellule, texte libre) : seulement comptée.
      if (c.name === 'remarque') R.donnees.remarques_vides.push(t);
      else R.donnees.toujours_null.push({ table: t, section: numeroDeSection(t), colonne: c.name, lignes: n });
      continue;
    }
    if (n >= 10 && s.d === 1 && s.nn === n && !pk.has(c.name) && c.name !== 'origine') {
      R.donnees.constantes.push({ table: t, colonne: c.name, valeur: court(un(`SELECT ${col} AS v FROM ${q(t)} LIMIT 1`).v, 40), lignes: n });
    }
    if (pk.has(c.name) || fkCols.has(c.name) || controlee(t, c.name)) continue;
    const type = c.type.toUpperCase();
    if (type === 'INTEGER' && s.d === 2) {
      const v = tous(`SELECT DISTINCT ${col} AS v FROM ${q(t)} WHERE ${col} IS NOT NULL ORDER BY 1`).map((r) => r.v);
      if (v[0] === 0 && v[1] === 1) R.contraintes.booleens_sans_check.push({ table: t, colonne: c.name, lignes: n });
    }
    if (type === 'TEXT' && !SANS_ENUM.test(c.name) && n >= 20 && s.d >= 2 && s.d <= 8 && s.nn >= n / 2) {
      const v = tous(`SELECT ${col} AS v, count(*) AS n FROM ${q(t)} WHERE ${col} IS NOT NULL GROUP BY 1 ORDER BY 2 DESC`);
      if (v.every((r) => String(r.v).length <= 40)) R.contraintes.enumerations_sans_check.push({ table: t, colonne: c.name, valeurs: v.map((r) => `${court(r.v, 30)} (${r.n})`).join(' · ') });
    }
  }
}

// ---------------------------------------------------------------------------------------------------------------------------------------------------
// 6. Textes : anomalies par colonne (portraits et images exclus)
// ---------------------------------------------------------------------------------------------------------------------------------------------------
const ANOMALIES = {
  bords: { titre: 'espace ou retour à la ligne en tête ou en fin', test: (v) => /^\s|\s$/u.test(v) },
  double_espace: { titre: 'deux espaces ou plus entre deux mots', test: (v) => /\S {2,}\S/.test(v) },
  retour_chariot: { titre: 'retour chariot (\\r)', test: (v) => v.includes('\r') },
  tabulation: { titre: 'tabulation', test: (v) => v.includes('\t') },
  controle: { titre: 'caractère de contrôle', test: (v) => /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(v) },
  invisible: { titre: 'caractère invisible (largeur nulle, BOM)', test: (v) => /[\u200B-\u200D\u2060\uFEFF]/.test(v) },
  non_nfc: { titre: 'Unicode non normalisé (NFC)', test: (v) => v !== v.normalize('NFC') },
  remplacement: { titre: 'caractère de remplacement U+FFFD', test: (v) => v.includes('\uFFFD') },
  mojibake: { titre: 'encodage cassé (Ã©, Ã‰, â€™…)', test: (v) => /\u00C3[\u0080-\u00BF\u0152\u0153\u0160\u0161\u0178\u017D\u017E\u0192\u02C6\u02DC\u2013\u2014\u2018-\u201E\u2020-\u2022\u2026\u2030\u2039\u203A\u20AC\u2122]|\u00E2\u20AC|\u00C2[\u00A0-\u00BF]/.test(v) },
  chaine_vide: { titre: "chaîne vide là où l'absence s'écrit NULL", test: (v) => v === '' },
};
for (const t of tables) {
  if (lignesDe.get(t) === 0) continue;
  const pk = clePrimaire(t);
  const cle = pk.length ? pk.map(q).join(" || '|' || ") : 'rowid';
  for (const c of colonnesDe.get(t)) {
    if (c.type.toUpperCase() !== 'TEXT') continue;
    const videPermis = c.dflt_value === "''";
    const trouves = {};
    let valeurs = 0;
    for (const r of db.prepare(`SELECT ${cle} AS k, ${q(c.name)} AS v FROM ${q(t)} WHERE ${q(c.name)} IS NOT NULL`).iterate()) {
      if (typeof r.v !== 'string' || r.v.startsWith('data:')) continue;
      valeurs += 1;
      for (const [nom, a] of Object.entries(ANOMALIES)) {
        if (nom === 'chaine_vide' && videPermis) continue;
        if (!a.test(r.v)) continue;
        (trouves[nom] ??= []).push(r.k);
      }
    }
    for (const [nom, cles] of Object.entries(trouves)) {
      R.textes.push({ table: t, section: numeroDeSection(t), colonne: c.name, anomalie: nom, nombre: cles.length, sur: valeurs, exemples: cles.slice(0, EXEMPLES).map((k) => court(k, 60)) });
    }
  }
}

// ---------------------------------------------------------------------------------------------------------------------------------------------------
// 7. Doublons de clés de nom (`*_cle`) et rangs (`rang`) dans un même parent
// ---------------------------------------------------------------------------------------------------------------------------------------------------
for (const t of tables) {
  if (lignesDe.get(t) === 0) continue;
  const parents = clesEtrangeres.get(t).filter((f) => !(f.colonnes.length === 1 && f.colonnes[0] === 'origine')).flatMap((f) => f.colonnes);
  const uniques = indexDe.get(t).filter((i) => i.unique && !i.partiel).map((i) => i.colonnes);
  for (const c of colonnesDe.get(t).filter((x) => /_cle$/.test(x.name))) {
    const groupe = [...new Set([...parents, c.name])];
    if (uniques.some((u) => u.every((x) => groupe.includes(x)))) continue;     // déjà garanti par un index unique
    const d = tous(`SELECT ${groupe.map(q).join(', ')}, count(*) AS n FROM ${q(t)} WHERE ${q(c.name)} IS NOT NULL GROUP BY ${groupe.map(q).join(', ')} HAVING count(*) > 1 ORDER BY n DESC`);
    if (d.length) R.doublons.push({ table: t, groupe: groupe.join(', '), groupes_en_double: d.length, exemples: d.slice(0, EXEMPLES).map((r) => `${court(r[c.name], 40)} ×${r.n}`) });
  }
  if (colonnesDe.get(t).some((x) => x.name === 'rang')) {
    // Le parent d'un rang : les autres colonnes de la clé unique (primaire ou index) qui contient `rang` ; sans clé unique, deux lignes peuvent avoir le même rang.
    const pkCols = clePrimaire(t);
    const candidates = [...(pkCols.includes('rang') ? [pkCols] : []), ...uniques.filter((u) => u.includes('rang'))];
    const cleUnique = candidates.find((u) => !u.includes('<expression>'));
    if (!cleUnique) {
      const partiels = indexDe.get(t).filter((i) => i.unique && i.partiel && i.colonnes.includes('rang')).map((i) => i.nom);
      const remarque = candidates.length ? `rang unique avec une expression (${candidates[0].join(', ')}) : à relire à la main`
        : partiels.length ? `rang unique seulement dans l'index partiel ${partiels.join(', ')} : à relire à la main` : 'aucune clé unique ne contient rang';
      R.rangs.push({ table: t, parent: '—', listes: '', trous_ou_decalages: '', remarque });
      continue;
    }
    const parent = cleUnique.filter((c) => c !== 'rang');
    const g = parent.length ? parent.map(q).join(', ') : "'tout'";
    const pb = tous(`SELECT ${g}, min(rang) AS mi, max(rang) AS ma, count(rang) AS n FROM ${q(t)} WHERE rang IS NOT NULL GROUP BY ${g} HAVING mi <> 1 OR ma <> n`);
    const total = un(`SELECT count(*) AS n FROM (SELECT 1 FROM ${q(t)} WHERE rang IS NOT NULL GROUP BY ${g})`).n;
    if (pb.length) R.rangs.push({ table: t, parent: parent.join(', ') || '(toute la table)', listes: `${pb.length} / ${total}`, trous_ou_decalages: pb.slice(0, EXEMPLES).map((r) => `${r.mi}..${r.ma} pour ${r.n}`).join(' ; ') });
  }
}

// ---------------------------------------------------------------------------------------------------------------------------------------------------
// 8. Vues : exécution, durée, plans d'exécution (parcours complets en boucle interne, index automatiques)
// ---------------------------------------------------------------------------------------------------------------------------------------------------
// Le plan nomme une table par son alias : retrouvé dans le SQL de la vue (« FROM capacite a », « JOIN capacite AS b »). Un alias de sous-requête,
// de CTE ou de vue (résultat intermédiaire : rien à y indexer) reste sans table.
function tableDeLAlias(v, alias) {
  if (lignesDe.has(alias)) return alias;
  for (const m of sansCommentaires(sqlDe.get(v)).matchAll(new RegExp(`\\b(\\w+)\\s+(?:AS\\s+)?${echapper(alias)}\\b`, 'gi'))) if (lignesDe.has(m[1])) return m[1];
  return null;
}
const SEUIL_BOUCLE = 100;   // une boucle interne sur moins de lignes ne coûte rien
R.vues.erreurs = [];
R.vues.durees = [];
R.vues.boucles_internes = [];
R.vues.index_automatiques = [];
R.vues.intermediaires = [];
for (const v of vues) {
  const debut = process.hrtime.bigint();
  try {
    const n = un(`SELECT count(*) AS n FROM ${q(v)}`).n;
    R.vues.durees.push({ vue: v, lignes: n, ms: Number(process.hrtime.bigint() - debut) / 1e6 });
    const plan = tous(`EXPLAIN QUERY PLAN SELECT * FROM ${q(v)}`);
    // Parcourir toute la table de tête est normal ; une boucle qui n'est pas la première de son niveau, ou dans une sous-requête corrélée, tourne
    // une fois par ligne de la boucle externe : un SCAN y est un parcours complet répété.
    const niveauxVus = new Set();
    const correlees = new Set(plan.filter((r) => /^CORRELATED/.test(r.detail)).map((r) => r.id));
    for (const r of plan) {
      const boucle = /^(SCAN|SEARCH) (\S+)/.exec(r.detail);
      if (!boucle || boucle[2].startsWith('(')) continue;
      const interne = niveauxVus.has(r.parent) || correlees.has(r.parent);
      niveauxVus.add(r.parent);
      const table = tableDeLAlias(v, boucle[2]);
      const automatique = /AUTOMATIC/.test(r.detail);
      if (!automatique && !(boucle[1] === 'SCAN' && interne)) continue;
      if (!table) { R.vues.intermediaires.push(`${v} : ${r.detail}`); continue; }
      const lignes = lignesDe.get(table);
      if (automatique) R.vues.index_automatiques.push({ vue: v, table, lignes, detail: r.detail });
      else if (lignes >= SEUIL_BOUCLE) R.vues.boucles_internes.push({ vue: v, table, lignes, detail: r.detail });
    }
  } catch (e) {
    R.vues.erreurs.push({ vue: v, erreur: e.message });
  }
}
R.vues.durees.sort((a, b) => b.ms - a.ms);

// ---------------------------------------------------------------------------------------------------------------------------------------------------
// 9. Recherche plein texte (FTS5)
// ---------------------------------------------------------------------------------------------------------------------------------------------------
for (const v of virtuelles) {
  let etat = 'ok';
  try { db.exec(`INSERT INTO ${q(v)}(${q(v)}) VALUES('integrity-check')`); } catch (e) { etat = e.message; }
  R.fts.push({ table: v, lignes: un(`SELECT count(*) AS n FROM ${q(v)}`).n, integrity_check: etat });
}

// ---------------------------------------------------------------------------------------------------------------------------------------------------
// 10. Portabilité : constructions propres à SQLite hors de la liste admise par l'en-tête de schema.sql
//     (STRICT / WITHOUT ROWID, GLOB dans quelques CHECK, json_valid / json_type, instr, FTS5, group_concat dans une vue, PRAGMA)
// ---------------------------------------------------------------------------------------------------------------------------------------------------
{
  const textes = { 'data/schema.sql': schemaSql, 'data/derive.sql': readFileSync(join(RACINE, 'data', 'derive.sql'), 'utf8') };
  const MOTIFS = {
    'json_* hors json_valid / json_type': /\bjson_(?!valid\b|type\b)\w+\s*\(/gi, 'iif(': /\biif\s*\(/gi, 'printf( / format(': /\b(?:printf|format)\s*\(/gi,
    'typeof(': /\btypeof\s*\(/gi, 'unicode( / char(': /\b(?:unicode|char)\s*\(/gi, 'strftime / datetime / julianday': /\b(?:strftime|datetime|julianday|unixepoch)\s*\(/gi,
    'rowid (hors WITHOUT ROWID)': /(?<!WITHOUT\s+)\browid\b/gi, AUTOINCREMENT: /\bAUTOINCREMENT\b/gi, 'INSERT OR / REPLACE INTO': /\bINSERT\s+OR\s+\w+|\bREPLACE\s+INTO\b/gi,
    'GLOB hors CHECK': /\bGLOB\b/gi, group_concat: /\bgroup_concat\s*\(/gi, 'total(': /\btotal\s*\(/gi,
    'min()/max() à plusieurs arguments': /\b(?:min|max)\s*\([^()]*,[^()]*\)/gi,
  };
  const ADMIS = { group_concat: { 'data/schema.sql': 1 } };   // l'en-tête de schema.sql admet group_concat dans une vue
  for (const [fichier, brut] of Object.entries(textes)) {
    const texte = sansCommentaires(brut);
    const checks = expressionsCheck(texte);
    const ligneDe = (index) => texte.slice(0, index).split('\n').length;
    for (const [motif, re] of Object.entries(MOTIFS)) {
      let positions = [...texte.matchAll(re)].map((m) => m.index);
      if (motif === 'GLOB hors CHECK') positions = positions.filter((i) => !checks.some((c) => c.debut <= i && i < c.fin));
      const lignes = [...new Set(positions.map(ligneDe))];
      if (lignes.length > (ADMIS[motif]?.[fichier] ?? 0)) R.portabilite.push({ motif, fichier, nombre: lignes.length, lignes: lignes.slice(0, 8).join(', ') });
    }
  }
}

// ---------------------------------------------------------------------------------------------------------------------------------------------------
// 11. Usage dans le code : tables et vues que rien ne cite (hors tests, migrations, registre de l'API /api/v1/, schéma et docs)
// ---------------------------------------------------------------------------------------------------------------------------------------------------
{
  const DOSSIERS = ['client/src', 'client/serveur', 'client/scripts', 'tools', 'data/derive.sql', 'deploy'];
  const EXCLUS = /node_modules|(?:^|[\\/])(?:dist|\.astro|modeles)(?:[\\/]|$)|content[\\/]wiki|src[\\/]lib[\\/]ressources(?:[\\/]|$)/;   // testé sur le chemin relatif
  const EXT = /\.(mjs|js|ts|astro|py|sql|sh|json)$/;
  const fichiers = [];
  const parcourir = (p) => {
    const abs = join(RACINE, p);
    if (!existsSync(abs) || EXCLUS.test(p)) return;
    if (statSync(abs).isDirectory()) { for (const f of readdirSync(abs)) parcourir(join(p, f)); return; }
    if (EXT.test(abs) && !/lib[\\/]ressources\.mjs$/.test(abs)) fichiers.push([p, readFileSync(abs, 'utf8')]);
  };
  DOSSIERS.forEach(parcourir);
  const cite = (nom, texte) => new RegExp(`(?<![\\w-])${echapper(nom)}(?![\\w-])`).test(texte);
  const compte = (nom) => fichiers.filter(([, texte]) => cite(nom, texte)).map(([f]) => f);
  // Une vue citée par le code compte ; ce qu'elle cite (tables, autres vues) aussi, de proche en proche.
  const lus = new Set([...tables, ...vues].filter((n) => compte(n).length > 0));
  for (let encore = true; encore;) {
    encore = false;
    for (const v of vues.filter((x) => lus.has(x))) {
      for (const n of [...tables, ...vues]) if (!lus.has(n) && cite(n, sansCommentaires(sqlDe.get(v)))) { lus.add(n); encore = true; }
    }
  }
  R.usage.fichiers_lus = fichiers.length;
  R.usage.tables_jamais_citees = tables.filter((t) => !lus.has(t)).map((t) => ({
    table: t, section: numeroDeSection(t), lignes: lignesDe.get(t), vues_qui_la_citent: vues.filter((v) => cite(t, sqlDe.get(v))).join(', '),
  }));
  R.usage.vues_jamais_citees = vues.filter((v) => !lus.has(v));
  R.usage.vues_citees_une_fois = vues.map((v) => [v, compte(v)]).filter(([, f]) => f.length === 1).map(([v, f]) => `${v} (${f[0]})`);
}

// ---------------------------------------------------------------------------------------------------------------------------------------------------
// 12. Bilan par section du schéma (pour répartir la relecture)
// ---------------------------------------------------------------------------------------------------------------------------------------------------
for (const s of [...sections, 'hors schema.sql']) {
  const num = s.split('.')[0];
  const ts = tables.filter((t) => numeroDeSection(t) === num);
  const vs = vues.filter((v) => numeroDeSection(v) === num);
  if (!ts.length && !vs.length) continue;
  const constats = R.textes.filter((x) => x.section === num).length + R.cles.sans_index.filter((x) => x.section === num).length
    + R.donnees.toujours_null.filter((x) => x.section === num).length;
  R.sections.push({ section: s, tables: ts.length, vues: vs.length, lignes: ts.reduce((a, t) => a + lignesDe.get(t), 0), colonnes: ts.reduce((a, t) => a + colonnesDe.get(t).length, 0), constats_automatiques: constats });
}

// ---------------------------------------------------------------------------------------------------------------------------------------------------
// Rendu
// ---------------------------------------------------------------------------------------------------------------------------------------------------
function tableau(lignes, colonnes) {
  if (!lignes.length) return '_Rien._\n';
  const cell = (v) => String(v ?? '').replaceAll('|', '\\|').replace(/\n/g, ' ');
  return [`| ${colonnes.join(' | ')} |`, `| ${colonnes.map(() => '---').join(' | ')} |`, ...lignes.map((l) => `| ${colonnes.map((c) => cell(Array.isArray(l[c]) ? l[c].join(' ; ') : l[c])).join(' | ')} |`)].join('\n') + '\n';
}
const liste = (l) => (l.length ? `${l.join(', ')}\n` : '_Rien._\n');
function markdown() {
  const m = R.moteur;
  const o = [];
  o.push(`# Audit automatique de la base\n`);
  o.push(`Relevé produit par \`.claude/skills/relecture-db/audit.mjs\` : des **constats à examiner**, pas des verdicts. Chacun se confirme ou s'écarte à la relecture (SKILL.md).\n`);
  o.push(`Base \`${R.base.fichier}\` (${(R.base.octets / 1048576).toFixed(1)} Mio, SQLite ${m.sqlite}, user_version ${m.user_version}, data/rows/VERSION ${m.version_rows}) : ${R.tables.nombre} tables, ${R.tables.vues} vues, ${R.tables.virtuelles.length} tables FTS5, ${R.index.total} index, ${R.cles.total} clés étrangères, ${R.tables.lignes} lignes.\n`);
  o.push('## Répartition par section du schéma\n');
  o.push(tableau(R.sections, ['section', 'tables', 'vues', 'lignes', 'colonnes', 'constats_automatiques']));
  o.push('## 1. Moteur\n');
  o.push(`- integrity_check : ${m.integrity_check.join(' ; ')}`);
  o.push(`- foreign_key_check : ${m.foreign_key_check.length ? JSON.stringify(m.foreign_key_check) : 'aucune violation'}`);
  o.push(`- user_version ${m.user_version} ${m.user_version === m.version_rows ? '= data/rows/VERSION' : `≠ data/rows/VERSION (${m.version_rows})`}`);
  o.push(`- page_size ${m.page_size}, pages ${m.page_count}, pages libres ${m.freelist_count}, encodage ${m.encoding}, journal ${m.journal_mode}, auto_vacuum ${m.auto_vacuum}, application_id ${m.application_id}\n`);
  o.push('## 2. Tables\n');
  o.push(`**Non STRICT** : ${liste(R.tables.non_strict)}`);
  o.push(`**Sans clé primaire déclarée** : ${liste(R.tables.sans_cle_primaire)}`);
  o.push(`**Dans la base mais pas dans schema.sql** : ${liste(R.tables.hors_schema)}`);
  o.push(`**Dans schema.sql mais pas dans la base** : ${liste(R.tables.absentes_de_la_base)}`);
  o.push(`**Sans fichier data/rows (hors dérivées)** : ${liste(R.tables.sans_fichier_rows)}`);
  o.push(`**Fichier data/rows sans table** : ${liste(R.tables.fichier_rows_sans_table)}`);
  o.push(`**Dérivées exportées dans data/rows** : ${liste(R.tables.derivees_exportees)}`);
  o.push(`**Vides** (sections 13 et 14 : vides par construction) :\n`);
  o.push(tableau(R.tables.vides.filter((x) => !x.attendue), ['table', 'section']));
  o.push(`Vides attendues : ${R.tables.vides.filter((x) => x.attendue).map((x) => x.table).join(', ') || '—'}\n`);
  o.push('## 3. Clés étrangères\n');
  o.push(`**Sans index** (convention de schema.sql : « toute clé étrangère se filtre par un index » ; \`origine\` exclue par choix : ${R.cles.origine_sans_index} clés) :\n`);
  o.push(tableau(R.cles.sans_index, ['table', 'section', 'colonnes', 'parent', 'suppression']));
  o.push('**Type déclaré différent de la colonne visée** :\n');
  o.push(tableau(R.cles.types_differents, ['table', 'colonne', 'type', 'parent', 'type_parent']));
  o.push('**Cible ni clé primaire ni unique** (erreur « foreign key mismatch » à la première écriture) :\n');
  o.push(tableau(R.cles.cible_non_unique, ['table', 'colonnes', 'parent']));
  o.push('**Colonnes `*_id` sans clé étrangère** (références que SQLite ne garde pas ; F6 de docs/sql/a-valider.md en assume certaines) :\n');
  o.push(tableau(R.cles.colonnes_id_sans_cle, ['table', 'colonne', 'cible_probable', 'valeurs_sans_cible']));
  o.push('## 4. Index redondants (couverts par un autre index ou par la clé primaire)\n');
  o.push(tableau(R.index.redondants, ['table', 'index', 'colonnes', 'couvert_par']));
  o.push('## 5. Contraintes manquantes probables\n');
  o.push('**Booléens 0/1 sans CHECK** :\n');
  o.push(tableau(R.contraintes.booleens_sans_check, ['table', 'colonne', 'lignes']));
  o.push('**Énumérations probables sans CHECK** (2 à 8 valeurs distinctes, au moins 20 lignes) :\n');
  o.push(tableau(R.contraintes.enumerations_sans_check, ['table', 'colonne', 'valeurs']));
  o.push('## 6. Colonnes\n');
  o.push(`**Toujours NULL** (table non vide ; \`remarque\` à part : vide dans ${R.donnees.remarques_vides.length} tables, ce qui est sa convention) :\n`);
  o.push(tableau(R.donnees.toujours_null, ['table', 'section', 'colonne', 'lignes']));
  o.push('**Constantes** (une seule valeur sur toutes les lignes, au moins 10) :\n');
  o.push(tableau(R.donnees.constantes, ['table', 'colonne', 'valeur', 'lignes']));
  o.push('## 7. Textes\n');
  o.push(`Anomalies cherchées : ${Object.entries(ANOMALIES).map(([k, a]) => `\`${k}\` (${a.titre})`).join(', ')}. La chaîne vide n'est pas comptée dans une colonne dont le défaut déclaré est \`''\`.\n`);
  o.push(tableau(R.textes.sort((a, b) => b.nombre - a.nombre), ['table', 'colonne', 'anomalie', 'nombre', 'sur', 'exemples']));
  o.push('## 8. Doublons et rangs\n');
  o.push('**Même clé de nom (`*_cle`) deux fois dans un même parent**, sans index unique pour l\'interdire :\n');
  o.push(tableau(R.doublons, ['table', 'groupe', 'groupes_en_double', 'exemples']));
  o.push('**Rangs** qui ne vont pas de 1 à n dans leur parent (parent = les autres colonnes de la clé unique qui contient `rang` ; un trou peut être voulu : `monstre_capacite.rang` n\'est jamais renuméroté) :\n');
  o.push(tableau(R.rangs, ['table', 'parent', 'listes', 'trous_ou_decalages', 'remarque']));
  o.push('## 9. Vues\n');
  o.push('**En erreur** :\n');
  o.push(tableau(R.vues.erreurs, ['vue', 'erreur']));
  o.push('**Les plus lentes** (count(*) sur la vue entière) :\n');
  o.push(tableau(R.vues.durees.slice(0, 10).map((d) => ({ ...d, ms: d.ms.toFixed(1) })), ['vue', 'lignes', 'ms']));
  o.push(`**Parcours complets en boucle interne** (une fois par ligne de la boucle externe ; table de ${SEUIL_BOUCLE} lignes ou plus) :\n`);
  o.push(tableau(R.vues.boucles_internes, ['vue', 'table', 'lignes', 'detail']));
  o.push('**Index automatiques** (SQLite construit un index temporaire faute d\'index qui convienne : un index manque peut-être) :\n');
  o.push(tableau(R.vues.index_automatiques, ['vue', 'table', 'lignes', 'detail']));
  o.push(`**Sur un résultat intermédiaire** (sous-requête, CTE ou vue : rien à indexer, à relire si la vue est lente) : ${liste(R.vues.intermediaires)}`);
  o.push('## 10. Recherche plein texte\n');
  o.push(tableau(R.fts, ['table', 'lignes', 'integrity_check']));
  o.push('## 11. Portabilité (hors liste admise par l\'en-tête de schema.sql)\n');
  o.push(tableau(R.portabilite, ['motif', 'fichier', 'nombre', 'lignes']));
  o.push('## 12. Usage dans le code\n');
  o.push(`${R.usage.fichiers_lus} fichiers lus (client/src hors pages fabriquées et registre de l'API, client/serveur, client/scripts, tools, data/derive.sql, deploy ; ni tests, ni migrations).\n`);
  o.push('« Citée » = le nom apparaît dans un de ces fichiers (lecture, écriture ou simple commentaire) ou dans une vue citée. Un nom courant (`page`, `sort`, `lien`…) est donc toujours cité : l\'absence de citation est un signal fort, la présence ne prouve rien. L\'API générique `/api/v1/` et la page Debug listent toutes les tables, citées ou non.\n');
  o.push('**Tables jamais citées** :\n');
  o.push(tableau(R.usage.tables_jamais_citees, ['table', 'section', 'lignes', 'vues_qui_la_citent']));
  o.push(`**Vues jamais citées** : ${liste(R.usage.vues_jamais_citees)}`);
  o.push(`**Vues citées par un seul fichier** : ${liste(R.usage.vues_citees_une_fois)}`);
  return o.join('\n');
}

const texte = EN_JSON ? JSON.stringify(R, null, 2) : markdown();
if (SORTIE) { writeFileSync(SORTIE, texte); console.log(`Audit écrit dans ${SORTIE}`); } else process.stdout.write(`${texte}\n`);
