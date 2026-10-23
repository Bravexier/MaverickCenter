// Le registre des noms d'affichage des tables et des colonnes (lib/libelles-de-la-base.mjs ; demande du propriétaire du 2026-10-23 sur la section
// « Lignes en conflit » : « Un vrai nom serai mieux ») : complet contre data/schema.sql pour toute table qu'un lot du journal de l'édition peut porter
// (modification.table_nom), établie d'après le code de l'édition (serveur/edition*.mjs), pour celles qu'elles citent et pour celles qui les citent
// (une rupture les nomme), sans jamais rendre une colonne modifiable.
//   node --test test/libelles-de-la-base.test.mjs
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { ENTITES, TABLES } from '../src/lib/edition-modele.mjs';
import {
  CLES_NORMALISEES, COLONNES_COMMUNES, COLONNES_DE_PROVENANCE, NOMS_DES_COLONNES, NOMS_DES_TABLES, colonneMasquee, colonneSource, nomDeColonne, nomDeTable,
} from '../src/lib/libelles-de-la-base.mjs';
import { TABLES_FICHES } from '../src/lib/fiche-format.mjs';
import { RESSOURCES } from '../src/lib/ressources.mjs';
import { TABLES_HORS_REGLES } from '../src/lib/tables-de-la-base.mjs';

const schema = new DatabaseSync(':memory:');
schema.exec(readFileSync(new URL('../../data/schema.sql', import.meta.url), 'utf8'));
const TOUTES = schema.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all().map((r) => r.name);
const colonnesDe = (t) => schema.prepare(`PRAGMA table_info("${t}")`).all().map((c) => ({ nom: c.name, pk: c.pk }));
const clesEtrangeres = (t) => {
  const groupes = new Map();
  for (const f of schema.prepare(`PRAGMA foreign_key_list("${t}")`).all()) {
    if (!groupes.has(f.id)) groupes.set(f.id, { parent: f.table, de: [] });
    groupes.get(f.id).de.push(f.from);
  }
  return [...groupes.values()];
};
const parentsDe = (t) => [...new Set(clesEtrangeres(t).map((f) => f.parent))];

/**
 * Les tables du schéma citées par le code de l'édition (serveur/edition*.mjs), hors des lectures seules : une citation compte, sauf passée à une
 * fonction qui lit (lireLigne, tableExiste, cleDe, structure, idLibre, ordreSuivant, rangLibre, colonneDerivee, valeurCanonique) ou comparée comme une
 * valeur d'une autre colonne (« ligne.forme === 'ethnie' », une liste qui associe un mot à lui-même : « invocation: 'invocation' ») ; une comparaison à
 * la table d'une modification (« l.table === 'classe_annexe' ») compte. Une citation de forme nouvelle compte donc d'office.
 */
function tablesCiteesParLEdition() {
  const connues = new Set(TOUTES);
  const lecture = /(?:lireLigne|tableExiste|cleDe|structure|idLibre|ordreSuivant|rangLibre|colonneDerivee|valeurCanonique)\(\s*(?:(?:ctx\.)?db,\s*)?$/;
  const dossier = new URL('../serveur/', import.meta.url);
  const citees = new Set();
  for (const f of readdirSync(dossier).filter((n) => /^edition.*\.mjs$/.test(n))) {
    const code = readFileSync(new URL(f, dossier), 'utf8');
    for (const m of code.matchAll(/'([a-z_][a-z0-9_]*)'/g)) {
      if (!connues.has(m[1])) continue;
      const avant = code.slice(Math.max(0, m.index - 60), m.index);
      if (lecture.test(avant)) continue;
      const comparaison = /([\w.]+)\s*[!=]==\s*$/.exec(avant);
      if (comparaison && !/table(?:_nom)?$/i.test(comparaison[1])) continue;
      if (new RegExp(`\\b${m[1]}:\\s*$`).test(avant)) continue;
      citees.add(m[1]);
    }
  }
  return citees;
}

/** Les tables qu'un lot du journal peut porter : celles du modèle, des créations et suppressions, et celles que le code de l'édition écrit. */
const ECRITES = [...new Set([...Object.keys(TABLES), ...Object.values(ENTITES).map((e) => e.table), ...tablesCiteesParLEdition()])]
  .filter((t) => !TABLES_HORS_REGLES.includes(t)).sort();
/** Les tables qu'elles citent par une clé étrangère (une rupture les nomme, une clé composée dit la ligne citée par sa clé). */
const CITEES = [...new Set(ECRITES.flatMap(parentsDe))].filter((t) => !ECRITES.includes(t)).sort();
/**
 * Les tables qui citent une table écrite (PRAGMA foreign_key_list lu dans l'autre sens), sans être écrites elles-mêmes : une suppression du lot peut y
 * rompre une référence, et edition-journal.mjs#rompuesDuLot (comme le rejeu) commence sa raison par leur nom (« sort_mot_cle : clé étrangère rompue
 * vers mot_cle ») ; les fiches de personnage (section 13) comprises, que le diagnostic des conflits contrôle aussi.
 */
const ENFANTS = TOUTES.filter((t) => !ECRITES.includes(t) && parentsDe(t).some((p) => ECRITES.includes(p))).sort();

test('le périmètre : les tables du modèle, des créations, et celles que l’édition écrit par dérivation (relevé du code, jamais les sections 13 à 15)', () => {
  for (const t of ECRITES) assert.ok(TOUTES.includes(t), `${t} : une table du schéma`);
  // celles que les tests du service ont vu passer au journal (tables de détail, pages, étiquettes, relations, traces) : dans le relevé
  for (const t of ['metier_bonus', 'metier_objet_depart', 'metier_recette_famille', 'alias', 'page_entite', 'page_tag', 'page_source', 'source', 'race_classe',
    'race_magie', 'race_magie_onglet', 'relation_peuple', 'peuple', 'evenement_categorie', 'note_cellule', 'ecart_source', 'classe_maitrise_arme',
    'classe_maitrise_armure', 'classe_objet_depart', 'sort_etat', 'sort_type', 'sort_mode', 'sort_bonus_maitrise', 'arme_degats', 'arme_prerequis',
    'armure_degats', 'materiau_armure', 'amelioration_total', 'affinite', 'bois', 'potion_etat', 'creature_effet', 'monstre_caracteristique',
    'monstre_attaque', 'monstre_defense', 'monstre_espece_lieu', 'classe_annexe',
    // les sources de maîtrise d'arme (migration 0076), refaites par le lecteur et notées au journal (serveur/edition-maitrises.mjs#partsAEcrire)
    'maitrise_arme_part', 'maitrise_arme_part_famille', 'capacite_nm_gagne']) {
    assert.ok(ECRITES.includes(t), `${t} : écrite par l’édition`);
  }
  for (const t of ['arme_famille', 'arme_type', 'categorie_classe', 'niveau_alchimie', 'ethnie', 'invocation', 'sort_mot_cle']) {
    assert.ok(!ECRITES.includes(t), `${t} : seulement lue (ou une valeur), jamais écrite par l’édition`);
  }
  for (const t of TABLES_HORS_REGLES) assert.ok(!ECRITES.includes(t), `${t} : jamais modifiée par l’édition`);
});

test('chaque table que l’édition peut écrire a un vrai nom, et chaque colonne qui peut s’afficher aussi (data/schema.sql)', () => {
  const manquent = [];
  for (const t of ECRITES) {
    if (!nomDeTable(t)) manquent.push(t);
    for (const { nom } of colonnesDe(t)) if (!colonneMasquee(t, nom) && !nomDeColonne(t, nom)) manquent.push(`${t}.${nom}`);
  }
  assert.deepEqual(manquent, [], 'à nommer dans lib/libelles-de-la-base.mjs');
});

test('les tables qui citent une table écrite ont un nom, et les colonnes de leurs clés composées vers elle aussi (une rupture les nomme)', () => {
  for (const t of ['sort_mot_cle', 'invocation', 'lien', 'recette', 'recette_ingredient', 'kit_alchimie', 'race_restriction_carac', 'magie_resistance', 'personnage',
    'personnage_classe']) {
    assert.ok(ENFANTS.includes(t), `${t} : cite une table écrite`);
  }
  for (const t of TABLES_FICHES) if (parentsDe(t).some((p) => ECRITES.includes(p))) assert.ok(ENFANTS.includes(t), `${t} : une fiche comprise`);
  const manquent = [];
  for (const t of ENFANTS) {
    if (!nomDeTable(t)) manquent.push(t);
    // une seule colonne : la rupture dit la ligne citée (« Mot-clé barriere ») ; une clé composée : chacune de ses colonnes par son nom
    for (const { parent, de } of clesEtrangeres(t)) if (ECRITES.includes(parent) && de.length > 1) for (const c of de) if (!nomDeColonne(t, c)) manquent.push(`${t}.${c}`);
  }
  assert.deepEqual(manquent, [], 'à nommer dans lib/libelles-de-la-base.mjs');
});

test('les tables citées par une clé étrangère ont un nom, et les colonnes de leur clé aussi', () => {
  assert.ok(CITEES.includes('competence') && CITEES.includes('objet_depart'), 'les tables citées (metier_bonus, classe_objet_depart…)');
  const manquent = [];
  for (const t of CITEES) {
    if (!nomDeTable(t)) manquent.push(t);
    for (const { nom, pk } of colonnesDe(t)) if (pk && !nomDeColonne(t, nom)) manquent.push(`${t}.${nom}`);
  }
  assert.deepEqual(manquent, []);
});

test('le registre reprend les libellés de TABLES, sans les doubler, et ne nomme que des tables et colonnes du schéma', () => {
  for (const [t, d] of Object.entries(TABLES)) {
    assert.equal(nomDeTable(t), d.libelle, t);
    for (const [c, champ] of Object.entries(d.colonnes)) assert.equal(nomDeColonne(t, c), champ.libelle, `${t}.${c}`);
  }
  for (const t of Object.keys(NOMS_DES_TABLES)) {
    assert.ok(!TABLES[t], `${t} : son nom est le libellé de TABLES`);
    assert.ok(TOUTES.includes(t), `${t} : une table du schéma`);
    assert.ok(ECRITES.includes(t) || CITEES.includes(t) || ENFANTS.includes(t), `${t} : hors du périmètre`);
  }
  for (const [t, cs] of Object.entries(NOMS_DES_COLONNES)) {
    assert.ok(TOUTES.includes(t), `${t} : une table du schéma`);
    const enPlace = colonnesDe(t).map((c) => c.nom);
    for (const c of Object.keys(cs)) {
      assert.ok(enPlace.includes(c), `${t}.${c} : une colonne du schéma`);
      assert.ok(!TABLES[t]?.colonnes[c]?.libelle, `${t}.${c} : son nom est le libellé de TABLES`);
      assert.ok(!colonneMasquee(t, c), `${t}.${c} : une colonne masquée n’a pas de nom à elle`);
    }
  }
  const colonnes = new Set(TOUTES.flatMap((t) => colonnesDe(t).map((c) => c.nom)));
  for (const c of Object.keys(COLONNES_COMMUNES)) assert.ok(colonnes.has(c), `${c} : une colonne du schéma`);
});

test('les noms : en français, sans nom technique, distincts dans une table ; seuls les noms changent (une table inconnue : null)', () => {
  const tous = [...Object.values(NOMS_DES_TABLES), ...Object.values(COLONNES_COMMUNES), ...Object.values(NOMS_DES_COLONNES).flatMap(Object.values)];
  for (const n of tous) {
    assert.match(n, /^[\p{Lu}\d]/u, `« ${n} » : commence par une majuscule`);
    assert.ok(!n.includes('_') && n.length <= 45 && n === n.trim(), `« ${n} » : court, sans « _ »`);
  }
  for (const t of ECRITES) {
    const vus = new Map();
    for (const { nom } of colonnesDe(t)) {
      if (colonneMasquee(t, nom)) continue;
      const n = nomDeColonne(t, nom);
      assert.notEqual(n, nom, `${t}.${nom} : un nom, pas le nom technique`);
      assert.ok(!vus.has(n), `${t} : « ${n} » pour ${vus.get(n)} et ${nom}`);
      vus.set(n, nom);
    }
  }
  const tables = new Map();
  for (const t of new Set([...ECRITES, ...CITEES, ...ENFANTS])) {
    assert.ok(!tables.has(nomDeTable(t)), `« ${nomDeTable(t)} » pour ${tables.get(nomDeTable(t))} et ${t}`);
    tables.set(nomDeTable(t), t);
  }
  assert.equal(nomDeTable('metier_bonus'), 'Bonus du métier');
  assert.equal(nomDeTable('alias'), 'Autre nom de la page');
  assert.equal(nomDeTable('maitrise_arme_part'), 'Part de maîtrise d’arme');
  assert.equal(nomDeColonne('maitrise_arme_part_famille', 'arme_famille_id'), 'Famille d’armes');
  assert.equal(nomDeTable('table_inconnue'), null);
  assert.equal(nomDeColonne('metier', 'colonne_inconnue'), null);
  assert.equal(nomDeTable('constructor'), null, 'une propriété d’Object n’est pas un nom');
  assert.equal(nomDeColonne('alias', 'toString'), null);
});

test('colonnes masquées : les clés normalisées tirées d’une autre colonne et la provenance (retirée à la 1.0), rien d’autre', () => {
  for (const [t, c] of [['metier', 'nom_cle'], ['page', 'titre_cle'], ['mot_cle', 'libelle_cle'], ['metier_bonus', 'cible_cle'], ['alias', 'cle'], ['sort', 'origine'],
    ['metier', 'source_ref']]) {
    assert.ok(colonneMasquee(t, c), `${t}.${c}`);
  }
  for (const [t, c] of [['metier', 'nom'], ['alias', 'texte'], ['page', 'corps_md'], ['metier_bonus', 'cible'], ['mot_cle', 'id']]) assert.ok(!colonneMasquee(t, c), `${t}.${c}`);
  assert.deepEqual([...COLONNES_DE_PROVENANCE], ['origine', 'source_ref']);
  // une clé normalisée sans « _cle » : la forme normalisée d'une autre colonne, d'après le schéma
  for (const [t, cs] of Object.entries(CLES_NORMALISEES)) {
    for (const [c, source] of Object.entries(cs)) {
      assert.ok(colonnesDe(t).some((x) => x.nom === c) && colonnesDe(t).some((x) => x.nom === source), `${t}.${c} (tirée de ${source})`);
    }
  }
  // toute colonne en « _cle » du périmètre est une clé normalisée (normalize d'une autre, sa source, qui a un nom : jamais une clé étrangère)
  for (const t of ECRITES) {
    const fks = schema.prepare(`PRAGMA foreign_key_list("${t}")`).all().map((f) => f.from);
    for (const { nom } of colonnesDe(t)) {
      if (!colonneMasquee(t, nom) || COLONNES_DE_PROVENANCE.includes(nom)) continue;
      assert.ok(!fks.includes(nom), `${t}.${nom}`);
      const source = colonneSource(t, nom);
      assert.ok(colonnesDe(t).some((x) => x.nom === source) && nomDeColonne(t, source), `${t}.${nom} : tirée de ${source}, une colonne nommée`);
    }
  }
  assert.equal(colonneSource('metier', 'nom_cle'), 'nom');
  assert.equal(colonneSource('alias', 'cle'), 'texte');
  assert.equal(colonneSource('metier', 'origine'), null, 'la provenance n’a pas de source : elle ne se dit pas');
  assert.equal(colonneSource('metier', 'nom'), null);
});

/**
 * Les écarts voulus avec le nom du registre de l'API REST (lib/ressources/*.mjs : `nom` d'une ressource, d'un enfant ou d'une dérivée), pour une table
 * hors de TABLES : chacun avec sa raison. Toute autre table que l'API nomme porte ici le même nom (constat de relecture du 2026-10-23 : « État » au lieu
 * d'« Altération d’état », le vocabulaire du site).
 */
const ECARTS_AVEC_L_API = Object.freeze({
  alias: 'le nom proposé au propriétaire (« Autre nom de la page »), qui l’a accepté (« Un vrai nom serai mieux ») ; l’API dit « Alias d’une page »',
  page_source: 'l’API la nomme du côté de la source (« Page qui cite la source ») ; ici, la ligne d’une page',
  page_tag: 'l’API la nomme du côté du mot-clé (« Page du mot-clé ») ; ici, la ligne d’une page',
  classe_annexe: 'l’API dit « Ligne du tableau de l’onglet », hors de sa ressource on ne sait pas de quelle classe',
  race_classe: 'R8 : « Accessibilité de Classe » (scripts/edition/races.mjs), le mot du site',
  race_magie: 'R8 : le même mot que race_classe',
  race_magie_onglet: 'l’API dit « Magie innée de l’onglet », hors de sa ressource on ne sait pas de quelle race',
  creature_attaque_type: 'l’API dit « Type de dégâts », qui se confondrait avec celui d’une arme',
  creature_capacite_resistance: 'l’API dit « Résistance d’une capacité », hors de sa ressource on ne sait pas de quelle capacité',
  creature_capacite_sort: 'l’API dit « Sort cité », hors de sa ressource on ne sait pas par quoi',
  etat_magie: 'l’API dit « Magie liée », hors de sa ressource on ne sait pas à quoi',
  invocation_bloc_magie: 'l’API dit « Magie du bloc », hors de sa ressource on ne sait pas de quel bloc',
});

test('les noms des tables hors de TABLES sont ceux du registre de l’API REST quand il en a un, sauf les écarts épinglés avec leur raison', () => {
  const api = new Map();
  const visiter = (o) => {
    if (!o || typeof o !== 'object') return;
    if (typeof o.table === 'string' && typeof o.nom === 'string') api.set(o.table, [...(api.get(o.table) ?? []), o.nom]);
    for (const v of Object.values(o)) visiter(v);
  };
  visiter(RESSOURCES);
  const ecarts = [];
  for (const [t, nom] of Object.entries(NOMS_DES_TABLES)) {
    const noms = api.get(t);
    if (!noms) continue;
    if (Object.hasOwn(ECARTS_AVEC_L_API, t)) assert.ok(!noms.includes(nom), `${t} : « ${nom} » est le nom de l’API, l’écart n’a plus lieu d’être`);
    else if (!noms.includes(nom)) ecarts.push(`${t} : « ${nom} », l’API dit ${noms.map((n) => `« ${n} »`).join(' ou ')}`);
  }
  assert.deepEqual(ecarts, []);
  for (const t of Object.keys(ECARTS_AVEC_L_API)) assert.ok(Object.hasOwn(NOMS_DES_TABLES, t) && api.has(t), `${t} : un écart avec un nom de l’API`);
  // le vocabulaire du site : les altérations d'état (data/schema.sql « ALTÉRATIONS D'ÉTAT », SortDetail.astro), jamais « État » seul
  assert.equal(nomDeTable('etat'), 'Altération d’état');
  assert.equal(nomDeTable('sort_etat'), 'Altération d’état citée par le sort');
  assert.equal(nomDeTable('potion_etat'), 'Altération d’état de la potion');
  assert.equal(nomDeColonne('sort_etat', 'etat_id'), 'Altération d’état');
  const tous = [...Object.values(NOMS_DES_TABLES), ...Object.values(COLONNES_COMMUNES), ...Object.values(NOMS_DES_COLONNES).flatMap(Object.values)];
  assert.ok(!tous.some((n) => /^État\b/u.test(n)), 'aucun nom ne dit « État » pour une altération');
});

test('le registre ne rend jamais une colonne modifiable : TABLES reste la seule liste de l’édition, qui ne l’importe pas', () => {
  for (const f of ['../src/lib/edition-modele.mjs', '../serveur/edition.mjs', '../serveur/edition-journal.mjs']) {
    assert.doesNotMatch(readFileSync(new URL(f, import.meta.url), 'utf8'), /libelles-de-la-base/, `${f} n’importe pas le registre`);
  }
  for (const o of [NOMS_DES_TABLES, COLONNES_COMMUNES, NOMS_DES_COLONNES, ...Object.values(NOMS_DES_COLONNES), CLES_NORMALISEES, COLONNES_DE_PROVENANCE]) assert.ok(Object.isFrozen(o));
  // une colonne nommée hors de TABLES n'y entre pas
  assert.equal(TABLES.metier.colonnes.peut_fabriquer, undefined);
  assert.equal(TABLES.alias, undefined);
});
