// Registre des ressources de l'API REST (lib/ressources.mjs, docs/api.md) : chaque table de data/schema.sql est rangée une fois et une seule (dans
// une ressource ou hors ressource, avec sa raison), chaque colonne citée existe, chaque ligne d'une table partagée appartient à une seule ressource,
// et tout ce que le site de dev sait déjà écrire (TABLES, ENTITES) est joignable par l'API. Option RESSOURCES_MODULE=<module> : ne regarde que les
// tables et les ressources de ce module (pour le construire module par module).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { lireSchema } from '../src/lib/schema-doc.mjs';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { ENTITES, TABLES } from '../src/lib/edition-modele.mjs';
import { capacitesDe, defautsDuRegistre, HORS_RESSOURCE, MODULES, RESSOURCES, tablesDe, tablesModifiables } from '../src/lib/ressources.mjs';

const schema = lireSchema(readFileSync(new URL('../../data/schema.sql', import.meta.url), 'utf8'));
const TABLES_DU_SCHEMA = schema.flatMap((s) => s.objets.filter((o) => o.genre === 'table').map((o) => o.nom));
const db = ouvrirBase({ sansExemples: false });
const colonnesDe = (t) => db.prepare(`PRAGMA table_info("${t}")`).all().map((c) => c.name);
const seulModule = process.env.RESSOURCES_MODULE || null;
const ressourcesVues = seulModule ? RESSOURCES.filter((r) => r.module === seulModule) : RESSOURCES;

test('registre : clés, libellés, modules et entités d’écriture cohérents', () => {
  assert.deepEqual(defautsDuRegistre(), []);
  assert.deepEqual(MODULES.map((m) => m.cle), ['creation', 'regles', 'magie', 'equipement', 'artisanat', 'univers', 'bestiaire', 'wiki']);
});

test('registre : chaque table du schéma est rangée une fois et une seule (ressource ou hors ressource)', () => {
  const places = new Map();
  const noter = (t, ou) => (places.get(t) ?? places.set(t, []).get(t)).push(ou);
  for (const r of RESSOURCES) {
    noter(r.table, `${r.module}/${r.cle} (principale)`);
    for (const e of r.extensions ?? []) noter(e.table, `${r.module}/${r.cle} (extension)`);
    for (const e of r.enfants ?? []) noter(e.table, `${r.module}/${r.cle}/${e.cle} (enfant)`);
    for (const d of r.derivees ?? []) noter(d.table, `${r.module}/${r.cle} (dérivée)`);
  }
  for (const m of MODULES) for (const t of Object.keys(m.horsRessource)) noter(t, `${m.cle} (hors ressource)`);
  const defauts = [];
  for (const t of TABLES_DU_SCHEMA) {
    const ou = places.get(t) ?? [];
    if (!ou.length) { defauts.push(`${t} : rangée nulle part`); continue; }
    // une table partagée n'est la table principale de plusieurs ressources que si chacune la restreint (condition) ; rien d'autre ne se répète
    const principales = RESSOURCES.filter((r) => r.table === t);
    const autres = ou.filter((o) => !o.endsWith('(principale)'));
    if (principales.length > 1 && principales.some((r) => !r.condition)) defauts.push(`${t} : table principale de ${principales.length} ressources, dont une sans condition`);
    if (autres.length > 1 || (autres.length && principales.length)) defauts.push(`${t} : rangée plusieurs fois (${ou.join(' ; ')})`);
  }
  for (const t of places.keys()) if (!TABLES_DU_SCHEMA.includes(t)) defauts.push(`${t} : n'est pas une table du schéma (${places.get(t).join(' ; ')})`);
  for (const [t, raison] of Object.entries(HORS_RESSOURCE)) if (typeof raison !== 'string' || raison.length < 10) defauts.push(`${t} : raison hors ressource manquante`);
  const vus = seulModule ? defauts.filter((d) => [...MODULES.find((m) => m.cle === seulModule).ressources.flatMap(tablesDe), ...Object.keys(MODULES.find((m) => m.cle === seulModule).horsRessource)].some((t) => d.startsWith(`${t} :`))) : defauts;
  assert.deepEqual(vus, []);
});

test('registre : chaque colonne citée existe dans la base (clé, libellé, liste, recherche, tri, condition, liens parent)', () => {
  const defauts = [];
  const verifier = (table, colonnes, quoi) => {
    const connues = colonnesDe(table);
    if (!connues.length) { defauts.push(`${quoi} : table ${table} absente de la base`); return; }
    for (const c of colonnes) if (c && !connues.includes(c)) defauts.push(`${quoi} : colonne ${table}.${c} inconnue`);
  };
  for (const r of ressourcesVues) {
    const ou = `${r.module}/${r.cle}`;
    verifier(r.table, [r.libelle, ...(r.liste ?? []), ...(r.recherche ?? []), r.tri?.replace(/^-/, ''), ...Object.keys(r.condition ?? {})], ou);
    for (const e of r.extensions ?? []) { verifier(e.table, Object.keys(e.parent), `${ou} extension ${e.table}`); verifier(r.table, Object.values(e.parent), `${ou} extension ${e.table}`); }
    for (const e of [...(r.enfants ?? []), ...(r.derivees ?? [])]) {
      verifier(e.table, [...Object.keys(e.parent), e.tri?.replace(/^-/, '')], `${ou} enfant ${e.table}`);
      verifier(r.table, Object.values(e.parent), `${ou} enfant ${e.table}`);
    }
  }
  assert.deepEqual(defauts, []);
});

test('registre : chaque ligne d’une table partagée appartient à une ressource et une seule (conditions disjointes et complètes)', () => {
  const defauts = [];
  const partagees = new Map();
  for (const r of RESSOURCES) if (r.condition) (partagees.get(r.table) ?? partagees.set(r.table, []).get(r.table)).push(r);
  for (const [table, rs] of partagees) {
    if (seulModule && !rs.some((r) => r.module === seulModule)) continue;
    const cle = db.prepare(`PRAGMA table_info("${table}")`).all().filter((c) => c.pk).map((c) => c.name);
    const lignes = db.prepare(`SELECT * FROM "${table}"`).all();
    for (const l of lignes) {
      const a = rs.filter((r) => Object.entries(r.condition).every(([c, v]) => (Array.isArray(v) ? v.includes(l[c]) : !v.sauf.includes(l[c]))));
      if (a.length !== 1) defauts.push(`${table} ${cle.map((c) => l[c]).join(',')} : ${a.length ? a.map((r) => r.cle).join(', ') : 'aucune ressource'}`);
    }
  }
  assert.deepEqual(defauts.slice(0, 30), []);
});

test('registre : tout ce que le site de dev sait déjà écrire est joignable par l’API (TABLES modifiables, ENTITES créées et supprimées)', { skip: Boolean(seulModule) }, () => {
  const modifiables = new Set(RESSOURCES.flatMap((r) => [...tablesModifiables(r), ...(r.enfants ?? []).flatMap(tablesModifiables)]));
  assert.deepEqual(Object.keys(TABLES).filter((t) => !modifiables.has(t)), [], 'tables de TABLES sans ressource qui les modifie');
  const ecritures = RESSOURCES.flatMap((r) => [r, ...(r.enfants ?? [])]).map((r) => r.ecriture ?? {});
  const creees = new Set(ecritures.map((e) => e.creer).filter(Boolean));
  const supprimees = new Set(ecritures.map((e) => e.supprimer).filter(Boolean));
  assert.deepEqual(Object.keys(ENTITES).filter((e) => !creees.has(e)), [], 'entités créables sans ressource');
  assert.deepEqual(Object.keys(ENTITES).filter((e) => ENTITES[e].suppression && !supprimees.has(e)), [], 'entités supprimables sans ressource');
  for (const r of RESSOURCES) {
    const c = capacitesDe(r);
    if (c.creer) assert.ok(tablesDe(r).includes(ENTITES[r.ecriture.creer].table), `${r.cle} : l'entité ${r.ecriture.creer} écrit ${ENTITES[r.ecriture.creer].table}, hors de la ressource`);
  }
});

test('registre : jamais une table des fiches, du journal ni des notes de version en écriture', () => {
  const interdites = schema.filter((s) => /^1[345]\./.test(s.titre)).flatMap((s) => s.objets.map((o) => o.nom));
  for (const r of RESSOURCES) {
    for (const o of [r, ...(r.enfants ?? [])]) {
      const ecrit = tablesModifiables(o).length || o.ecriture?.creer || o.ecriture?.supprimer;
      if (ecrit) assert.ok(!tablesDe(o).some((t) => interdites.includes(t)), `${r.cle} écrirait une table des sections 13 à 15`);
    }
  }
  assert.ok(!RESSOURCES.some((r) => [r.table, ...(r.extensions ?? []).map((e) => e.table), ...(r.enfants ?? []).map((e) => e.table)].some((t) => t.startsWith('personnage') || ['utilisateur', 'utilisateur_role', 'groupe', 'groupe_membre', 'modification', 'modification_lot', 'note_version_brouillon'].includes(t))),
    'fiches, comptes, groupes et journal : jamais exposés par /api/v1/ (fiches : /api/personnages/ ; journal : /api/edition/journal/)');
});
