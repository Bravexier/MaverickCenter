// La chronologie (/chronologie/, docs/chronologie.md) : le registre tools/chronologie/evenements.json (un événement par entrée, dans l'ordre de lecture ;
// chaque extrait repéré par son début et sa fin dans une page du wiki) résolu contre le texte des pages de la base -> les lignes des tables `evenement`
// et `evenement_extrait` (data/schema.sql, section 5 bis ; migration 0035). Le texte d'un extrait est COPIÉ de page.corps_md, jamais réécrit.
//
//   node tools/chronologie/chronologie.mjs --sql         -> les INSERT de la migration (sortie standard), résolus contre la base de data/rows
//   node tools/chronologie/chronologie.mjs --verifier    -> le registre relu contre la base : extraits introuvables, lignes différentes
//
// Fonctions pures (resoudre, lignesSql) ; seul le lancement en ligne de commande ouvre la base (client/src/lib/donnees.mjs). Le test
// client/test/chronologie-db.test.mjs rejoue la résolution sur les pages telles que l'import les a laissées et la compare aux lignes de la base.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { normalize } from '../../client/src/lib/text.mjs';
import { EPOQUES, PORTEES } from '../../client/src/lib/chronologie.mjs';

export const FICHIER_REGISTRE = fileURLToPath(new URL('./evenements.json', import.meta.url));

/** Le registre (evenements.json) lu. */
export const lireRegistre = () => JSON.parse(readFileSync(FICHIER_REGISTRE, 'utf8'));

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const TITRE = /^#{1,6}\s+(.*?)\s*#*\s*$/;

/** Le titre de la section où commence `index` : le dernier titre Markdown (« ## … ») avant lui, sans les dièses ; null au début de la page. */
export function sectionA(corps, index) {
  let section = null;
  let position = 0;
  for (const ligne of corps.split('\n')) {
    if (position > index) break;
    const m = ligne.match(TITRE);
    if (m) section = m[1];
    position += ligne.length + 1;
  }
  return section;
}

/** Nombre d'occurrences de `motif` dans `texte`. */
const occurrences = (texte, motif) => {
  let n = 0;
  for (let i = texte.indexOf(motif); i >= 0; i = texte.indexOf(motif, i + 1)) n += 1;
  return n;
};

/**
 * Provenance lisible d'un extrait : « CODEX Maverick › <page> › <section> » pour une page du Codex, « Les races › <onglet> › <section> » pour une page
 * de race (l'onglet du classeur « Les races » d'où vient son texte).
 */
export function provenance(page, section) {
  const debut = page.onglet ? `Les races › ${page.onglet}` : `CODEX Maverick › ${page.titre}`;
  return section ? `${debut} › ${section}` : debut;
}

/**
 * Le registre résolu : { evenements, extraits, erreurs }. `pages` : Map(id de page -> { titre, corps, onglet? }) — le corps est page.corps_md, `onglet`
 * le nom de l'onglet d'une page de race (race_onglet.onglet). Un extrait est le texte de la page de son début à la fin de `fin` (ou `debut` seul s'il
 * n'a pas de fin) ; `debut` doit y être écrit une seule fois, sauf si `occurrence` (1, 2…) dit laquelle prendre. Les lignes ont les colonnes des tables,
 * dans leur ordre.
 */
export function resoudre(registre, pages) {
  const erreurs = [];
  const evenements = [];
  const extraits = [];
  const vus = new Set();
  let precedent = null;
  registre.evenements.forEach((e, i) => {
    const ou = `${e.id ?? `événement ${i + 1}`}`;
    const erreur = (texte) => erreurs.push(`${ou} : ${texte}`);
    if (!SLUG.test(e.id ?? '')) erreur('id invalide (minuscules ASCII et tirets)');
    if (vus.has(e.id)) erreur('id en double');
    vus.add(e.id);
    if (!e.titre?.trim()) erreur('titre vide');
    const epoque = EPOQUES.findIndex((x) => x.id === e.epoque);
    if (epoque < 0) erreur(`époque inconnue (${e.epoque})`);
    const datee = e.epoque === 'datee';
    if (datee !== Number.isInteger(e.annee)) erreur('une année pour les événements datés, et pour eux seuls');
    if (e.annee_fin !== undefined && !(datee && Number.isInteger(e.annee_fin) && e.annee_fin > e.annee)) erreur('annee_fin doit suivre annee');
    if (e.portee !== undefined && !(e.portee in PORTEES)) erreur(`portée inconnue (${e.portee})`);
    if (e.lieu !== undefined && (e.portee === undefined || !e.lieu.trim())) erreur('un lieu seulement pour un événement de la liste des Impacts');
    if (precedent) {
      const avant = EPOQUES.findIndex((x) => x.id === precedent.epoque);
      if (epoque < avant) erreur(`époque ${e.epoque} après ${precedent.epoque}`);
      if (datee && precedent.epoque === 'datee' && e.annee < precedent.annee) erreur(`an ${e.annee} après l'an ${precedent.annee} (${precedent.id})`);
    }
    precedent = e;
    if (!e.extraits?.length) erreur('aucun extrait');
    const lignesExtraits = (e.extraits ?? []).flatMap((x, j) => {
      const page = pages.get(x.page);
      const lequel = `extrait ${j + 1} (${x.page})`;
      if (!page) return erreur(`${lequel} : page introuvable`), [];
      const n = occurrences(page.corps, x.debut);
      const rang = x.occurrence ?? 1;
      if (n === 0 || (x.occurrence === undefined ? n > 1 : rang > n)) {
        return erreur(`${lequel} : début ${n ? 'écrit plusieurs fois (préciser « occurrence »)' : 'introuvable'} : ${JSON.stringify(x.debut.slice(0, 60))}`), [];
      }
      let debut = -1;
      for (let k = 0; k < rang; k += 1) debut = page.corps.indexOf(x.debut, debut + 1);
      let fin = debut + x.debut.length;
      if (x.fin !== undefined) {
        const f = page.corps.indexOf(x.fin, debut);
        if (f < 0) return erreur(`${lequel} : fin introuvable après le début : ${JSON.stringify(x.fin.slice(0, 60))}`), [];
        fin = Math.max(fin, f + x.fin.length);
      }
      const texte = page.corps.slice(debut, fin);
      if (x.date !== undefined && !texte.includes(x.date)) return erreur(`${lequel} : date ${JSON.stringify(x.date)} absente de l'extrait`), [];
      const section = sectionA(page.corps, debut);
      return [{
        evenement_id: e.id,
        rang: j + 1,
        page_id: x.page,
        section,
        texte,
        date_brut: x.date ?? null,
        origine: 'chronologie',
        source_ref: provenance(page, section),
      }];
    });
    extraits.push(...lignesExtraits);
    evenements.push({
      id: e.id,
      rang: i + 1,
      titre: e.titre,
      titre_cle: normalize(e.titre ?? ''),
      epoque: e.epoque,
      annee: datee ? e.annee : null,
      annee_fin: e.annee_fin ?? null,
      portee: e.portee ?? null,
      lieu: e.lieu ?? null,
      origine: 'chronologie',
      source_ref: lignesExtraits[0]?.source_ref ?? 'CODEX Maverick',
    });
  });
  return { evenements, extraits, erreurs };
}

const sql = (v) => (v === null || v === undefined ? 'NULL' : typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "''")}'`);
const insert = (table, ligne) => `INSERT INTO ${table} (${Object.keys(ligne).join(', ')}) VALUES (${Object.values(ligne).map(sql).join(', ')});`;

/** Les INSERT d'un registre résolu : les événements dans l'ordre, puis leurs extraits. */
export const lignesSql = ({ evenements, extraits }) => [...evenements.map((e) => insert('evenement', e)), ...extraits.map((x) => insert('evenement_extrait', x))];

/** Les pages que cite le registre, lues dans une base node:sqlite : Map(id -> { titre, corps, onglet }). `corpsDe(id, corps)` peut remplacer le corps. */
export function pagesDeLaBase(db, registre, corpsDe = (id, corps) => corps) {
  const ids = [...new Set(registre.evenements.flatMap((e) => (e.extraits ?? []).map((x) => x.page)))];
  const page = db.prepare('SELECT p.titre, p.corps_md, o.onglet FROM page p LEFT JOIN race_onglet o ON o.race_id = p.id WHERE p.id = ?');
  return new Map(ids.flatMap((id) => {
    const p = page.get(id);
    return p ? [[id, { titre: p.titre, corps: corpsDe(id, p.corps_md), onglet: p.onglet ?? undefined }]] : [];
  }));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { ouvrirBase } = await import('../../client/src/lib/donnees.mjs');
  const db = ouvrirBase({ sansExemples: false });
  const registre = lireRegistre();
  const resultat = resoudre(registre, pagesDeLaBase(db, registre));
  if (resultat.erreurs.length) {
    process.stderr.write(`${resultat.erreurs.length} erreur(s) dans le registre :\n${resultat.erreurs.map((e) => `- ${e}`).join('\n')}\n`);
    process.exit(1);
  }
  if (process.argv.includes('--sql')) {
    process.stdout.write(lignesSql(resultat).join('\n') + '\n');
  } else if (process.argv.includes('--verifier')) {
    const existe = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'evenement'").get();
    if (!existe) {
      console.log(`registre résolu : ${resultat.evenements.length} événements, ${resultat.extraits.length} extraits (la base n'a pas encore la table evenement)`);
    } else {
      const texte = (lignes) => lignes.map((l) => JSON.stringify(l)).sort();
      const comparer = (table, attendues) => {
        const base = new Set(texte(db.prepare(`SELECT * FROM ${table}`).all().map((l) => ({ ...l }))));
        const registreTxt = new Set(texte(attendues));
        const manque = [...registreTxt].filter((l) => !base.has(l));
        const enTrop = [...base].filter((l) => !registreTxt.has(l));
        for (const l of manque) console.log(`${table} : absent de la base ou différent : ${l.slice(0, 160)}`);
        for (const l of enTrop) console.log(`${table} : dans la base, pas dans le registre : ${l.slice(0, 160)}`);
        return manque.length + enTrop.length;
      };
      const ecarts = comparer('evenement', resultat.evenements) + comparer('evenement_extrait', resultat.extraits);
      console.log(ecarts ? `${ecarts} écart(s)` : `ok : ${resultat.evenements.length} événements, ${resultat.extraits.length} extraits`);
      process.exit(ecarts ? 1 : 0);
    }
  } else {
    console.log('usage : node tools/chronologie/chronologie.mjs --sql | --verifier');
  }
}
