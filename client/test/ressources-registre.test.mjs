// Registre des ressources de l'API REST (lib/ressources.mjs, docs/api.md) : chaque table de data/schema.sql est rangée une fois et une seule (dans
// une ressource ou hors ressource, avec sa raison ; une dérivée d'une table partagée, dans chacune de ses ressources), chaque colonne citée existe,
// chaque ligne d'une table partagée appartient à une seule ressource, chaque ligne d'un enfant, d'une dérivée ou d'une extension a son parent dans une
// ressource (condition comprise), et tout ce que le site de dev sait déjà écrire (TABLES, ENTITES, opérations du lot de serveur/edition.mjs#OPERATIONS)
// est joignable par l'API. Option RESSOURCES_MODULE=<module> : ne regarde que les tables et les ressources de ce module (pour le construire module par
// module).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { lireSchema } from '../src/lib/schema-doc.mjs';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { ENTITES, TABLES } from '../src/lib/edition-modele.mjs';
import { capacitesDe, defautsDuRegistre, HORS_RESSOURCE, MODULES, OPERATIONS_DU_LOT, RESSOURCES, tablesDe, tablesModifiables } from '../src/lib/ressources.mjs';
import { domainesDeLaChronologie } from '../serveur/edition-chronologie.mjs';
import { operationsDuBestiaire } from '../serveur/edition-bestiaire.mjs';

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
  const liees = new Map(); // table → [{ r, parent }] : ses places d'extension, d'enfant ou de dérivée
  const noter = (t, ou) => (places.get(t) ?? places.set(t, []).get(t)).push(ou);
  const lier = (t, r, parent) => (liees.get(t) ?? liees.set(t, []).get(t)).push({ r, parent });
  for (const r of RESSOURCES) {
    noter(r.table, `${r.module}/${r.cle} (principale)`);
    for (const e of r.extensions ?? []) { noter(e.table, `${r.module}/${r.cle} (extension)`); lier(e.table, r, e.parent); }
    for (const e of r.enfants ?? []) { noter(e.table, `${r.module}/${r.cle}/${e.cle} (enfant)`); lier(e.table, r, e.parent); }
    for (const d of r.derivees ?? []) { noter(d.table, `${r.module}/${r.cle} (dérivée)`); lier(d.table, r, d.parent); }
  }
  // une table liée répétée n'est permise que dans les ressources qui se partagent une même table principale par condition, au même lien : chacune n'en
  // voit que les lignes de ses éléments (amelioration_total, ligne TOTAL de chaque cible d'amélioration)
  const partageeParCondition = (t) => {
    const l = liees.get(t) ?? [];
    return l.length > 1 && l.every((x) => x.r.table === l[0].r.table && x.r.condition && JSON.stringify(x.parent) === JSON.stringify(l[0].parent));
  };
  for (const m of MODULES) for (const t of Object.keys(m.horsRessource)) noter(t, `${m.cle} (hors ressource)`);
  const defauts = [];
  for (const t of TABLES_DU_SCHEMA) {
    const ou = places.get(t) ?? [];
    if (!ou.length) { defauts.push(`${t} : rangée nulle part`); continue; }
    // une table partagée n'est la table principale de plusieurs ressources que si chacune la restreint (condition) ; rien d'autre ne se répète
    const principales = RESSOURCES.filter((r) => r.table === t);
    const autres = ou.filter((o) => !o.endsWith('(principale)'));
    if (principales.length > 1 && principales.some((r) => !r.condition)) defauts.push(`${t} : table principale de ${principales.length} ressources, dont une sans condition`);
    if ((autres.length > 1 && !partageeParCondition(t)) || (autres.length && principales.length)) defauts.push(`${t} : rangée plusieurs fois (${ou.join(' ; ')})`);
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

test('registre : chaque ligne d’un enfant, d’une dérivée ou d’une extension a son parent dans une ressource, condition comprise (rien n’est hors d’atteinte)', () => {
  const satisfait = (r, l) => Object.entries(r.condition ?? {}).every(([c, v]) => (Array.isArray(v) ? v.includes(l[c]) : !v.sauf.includes(l[c])));
  const liens = new Map();
  for (const r of ressourcesVues) {
    for (const x of [...(r.extensions ?? []), ...(r.enfants ?? []), ...(r.derivees ?? [])]) (liens.get(x.table) ?? liens.set(x.table, []).get(x.table)).push({ r, parent: x.parent });
  }
  // toutes les ressources d'une table liée (un module seul : celles des autres modules comptent aussi)
  for (const r of RESSOURCES) {
    for (const x of [...(r.extensions ?? []), ...(r.enfants ?? []), ...(r.derivees ?? [])]) {
      const l = liens.get(x.table);
      if (l && !l.some((y) => y.r === r && y.parent === x.parent)) l.push({ r, parent: x.parent });
    }
  }
  const orphelines = [];
  for (const [table, l] of liens) {
    const parents = l.map(({ r, parent }) => {
      const cles = new Set(db.prepare(`SELECT * FROM "${r.table}"`).all().filter((p) => satisfait(r, p)).map((p) => JSON.stringify(Object.values(parent).map((c) => p[c]))));
      return { parent, cles };
    });
    const sans = db.prepare(`SELECT * FROM "${table}"`).all().filter((ligne) => !parents.some(({ parent, cles }) => cles.has(JSON.stringify(Object.keys(parent).map((c) => ligne[c])))));
    if (sans.length) orphelines.push(`${table} : ${sans.length} ligne(s) sans parent servi (${sans.slice(0, 4).map((x) => JSON.stringify(Object.values(x).slice(0, 2))).join(', ')})`);
  }
  assert.deepEqual(orphelines, []);
});

test('registre : tout ce que le site de dev sait déjà écrire est joignable par l’API (TABLES modifiables, ENTITES créées et supprimées, opérations du lot)', { skip: Boolean(seulModule) }, () => {
  const modifiables = new Set(RESSOURCES.flatMap((r) => [...tablesModifiables(r), ...(r.enfants ?? []).flatMap(tablesModifiables)]));
  assert.deepEqual(Object.keys(TABLES).filter((t) => !modifiables.has(t)), [], 'tables de TABLES sans ressource qui les modifie');
  const ecritures = RESSOURCES.flatMap((r) => [r, ...(r.enfants ?? [])]).map((r) => r.ecriture ?? {});
  const creees = new Set(ecritures.map((e) => e.creer).filter(Boolean));
  const supprimees = new Set(ecritures.map((e) => e.supprimer).filter(Boolean));
  assert.deepEqual(Object.keys(ENTITES).filter((e) => !creees.has(e)), [], 'entités créables sans ressource');
  assert.deepEqual(Object.keys(ENTITES).filter((e) => ENTITES[e].suppression && !supprimees.has(e)), [], 'entités supprimables sans ressource');
  for (const r of RESSOURCES) {
    const c = capacitesDe(r);
    if (c.creer && r.ecriture?.creer) assert.ok(tablesDe(r).includes(ENTITES[r.ecriture.creer].table), `${r.cle} : l'entité ${r.ecriture.creer} écrit ${ENTITES[r.ecriture.creer].table}, hors de la ressource`);
  }
  // les opérations du lot du service d'édition (serveur/edition.mjs#OPERATIONS), lues dans sa source : modifier, creer et supprimer passent par
  // TABLES et ENTITES (plus haut) ; chacune des autres est nommée par une ressource (`operations`) ou une action
  const source = readFileSync(new URL('../serveur/edition.mjs', import.meta.url), 'utf8');
  const declaration = /^const OPERATIONS = \{(.*)\};$/m.exec(source)?.[1];
  assert.ok(declaration, 'const OPERATIONS = { … }; sur une ligne de serveur/edition.mjs');
  const morceaux = declaration.split(/,(?![^(]*\))/).map((m) => m.trim()).filter(Boolean);
  const etalees = morceaux.filter((m) => m.startsWith('...'));
  assert.deepEqual(etalees, ['...CHRONOLOGIE.operations', '...operationsDuBestiaire({ refus, ErreurEdition, provenance })'], 'une autre source d’opérations : à lire ici');
  const outils = { refus: () => {}, ErreurEdition: Error, provenance: () => '', idDejaEmploye: () => false, motCleDe: () => null };
  const operations = [
    ...morceaux.filter((m) => !m.startsWith('...')).map((m) => m.split(':')[0].trim()),
    ...Object.keys(domainesDeLaChronologie(outils).operations),
    ...Object.keys(operationsDuBestiaire(outils)),
  ];
  assert.deepEqual(operations.filter((o) => !['modifier', 'creer', 'supprimer'].includes(o)).sort(), [...OPERATIONS_DU_LOT].sort(), 'OPERATIONS_DU_LOT = les opérations du service hors TABLES et ENTITES');
  const nommees = new Set(RESSOURCES.flatMap((r) => [r, ...(r.enfants ?? [])])
    .filter((o) => !o.lectureSeule).flatMap((o) => [...Object.values(o.operations ?? {}), ...(o.actions ?? []).map((a) => a.op)]));
  assert.deepEqual(OPERATIONS_DU_LOT.filter((o) => !nommees.has(o)), [], 'opérations du lot qu’aucune ressource ne sert');
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

test('registre : les descriptions citent la base telle qu’écrite (noms, décisions), sans rien ajouter', () => {
  const r = (cle) => RESSOURCES.find((x) => x.cle === cle);
  // les emplacements d'armure, chacun tel qu'écrit (« Jambe Droit », coquille de la source comprise)
  const emplacements = db.prepare('SELECT nom FROM armure_emplacement ORDER BY ordre').all().map((x) => x.nom);
  assert.ok(emplacements.length >= 8);
  for (const nom of emplacements) assert.ok(r('emplacements-d-armure').description.includes(`« ${nom} »`), nom);
  // le sort qui invoque les non-morts et son invocation, sous leurs noms de la base
  const cadaverique = r('ameliorations-cadaveriques').description;
  const sort = /le sort « ([^»]+) »/.exec(cadaverique)?.[1];
  const invocation = /l’invocation s’appelle « ([^»]+) »/.exec(cadaverique)?.[1];
  assert.ok(db.prepare("SELECT 1 FROM sort WHERE nom = ? AND magie_id = 'magies/magie-de-la-necromancie'").get(sort), `sort « ${sort} »`);
  assert.ok(db.prepare('SELECT 1 FROM invocation WHERE nom = ?').get(invocation), `invocation « ${invocation} »`);
  // R67 : les capacités des créatures invoquées et les bonus du Mage Bleu restent à part ; elle ne parle pas des dons de classe
  const r67 = readFileSync(new URL('../../docs/decisions-regles.md', import.meta.url), 'utf8').split('\n').find((l) => l.startsWith('| R67 |'));
  assert.match(r67, /Mage Bleu/);
  assert.doesNotMatch(r67, /dons? de classe/);
  assert.doesNotMatch(r('capacites-de-creatures-invoquees').description, /dons de classe/);
  assert.match(r('capacites-de-creatures-invoquees').description, /Mage Bleu \(décision R67\)/);
  // une race créée reçoit son peuple et sa case « Même peuple » (serveur/edition.mjs#creerPeuple) : la description le dit
  assert.match(r('races').description, /son peuple du même nom/);
  assert.match(r('races').description, /« Même peuple »/);
  assert.match(readFileSync(new URL('../serveur/edition.mjs', import.meta.url), 'utf8'), /creerPeuple\(ctx, \{ nom[^}]*race_id/);
  // la page d'exemple du guide est dans pages-du-guide (modifiable), pas dans « pages »
  assert.match(r('pages').description, /pages d’exemple hors du guide/);
  // la remarque d'un don racial : seulement sur un don dont l'onglet porte une note de cellule (le service refuse ailleurs)
  assert.match(r('races').enfants.find((e) => e.cle === 'dons').description, /la remarque ne se modifie que sur un don dont l’onglet porte une note de cellule/);
});
