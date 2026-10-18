// Lot synthétique d'une « Simulation de mise à jour » : de quoi rejouer, en CI (job simulation-de-mise-a-jour de .github/workflows/ci.yml) et en
// local, ce que fait le job preparer de .github/workflows/mise-a-jour.yml — le lot appliqué à data/rows, puis les contrôles —, pour qu'une PR qui
// rendrait la mise à jour impossible soit rouge avant d'arriver dans dev (run 38151792080 du 2026-10-11 : 14 tests supposaient qu'aucune note de
// version n'attendait sa livraison dans data/rows).
//   node scripts/mise-a-jour-simulation.mjs --lot <lot.json> [--reference origin/master] [--rows <dossier>] [--guide]
//   puis, comme le job preparer : node scripts/mise-a-jour-regles.mjs --lot <lot.json> --reference origin/master, et ses contrôles
//   (scripts/mise-a-jour-github.mjs#CONTROLES : npm run db:build, npm run db:check, npm test, build…)
// Le lot n'est pas écrit à la main : le service du site de dev (serveur/api.mjs, édition ouverte) fait de vraies modifications dans une base vivante
// tirée de data/rows — le texte de deux chapitres du guide, un métier (description et bonus), le coût d'un sort, un don de classe créé et gardé, un
// autre créé puis supprimé —, une par enregistrement (un lot du journal chacune, comme sur le site), écrit le champ libre, puis fige le lot par la
// route de la page Mise à jour (« Simulation de mise à jour » : POST /api/mise-a-jour/lancer/) et le lit comme le workflow le télécharge
// (GET /api/mise-a-jour/lots/<lot>/). `--guide` : les deux chapitres du guide seulement (comme le lot du run 38151792080).
// Rien n'est supposé de l'état des règles : les valeurs changées sont lues avant d'écrire, les noms créés sont libres dans la base lue (le site a pu
// en créer). Quand data/rows porte déjà une note de version qu'aucune livraison n'a apportée à la production (`--reference`) — une PR de mise à
// jour, ou dev avant la livraison —, data/rows est déjà dans l'état d'après une mise à jour et mise-a-jour-regles.mjs refuserait un autre lot
// (code 7) : aucun lot n'est écrit (le job saute le rejeu et contrôle data/rows tel quel).
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { construireReference } from './db-reference.mjs';
import { notesEnAttente } from './mise-a-jour-regles.mjs';
import { traiter } from '../serveur/api.mjs';
import { ouvrirBaseVivante, preparerBaseVivante } from '../serveur/base-vivante.mjs';
import { CONFIRMATION } from '../serveur/notes-de-version.mjs';
import { recomposerCorps, decouperCorps } from '../src/lib/markdown-edition.mjs';
import { LIVRES, pagesDuLivre } from '../src/lib/livres.mjs';
import { normalize } from '../src/lib/text.mjs';

const CLIENT = fileURLToPath(new URL('../', import.meta.url));
const RACINE = fileURLToPath(new URL('../../', import.meta.url));
/** Adresse publique fictive du site de dev (le lot la porte ; mise-a-jour-regles.mjs ne la lit pas). */
const ADRESSE = 'https://dev.exemple.org';
/** Le champ libre de la note de version du lot synthétique. */
export const TEXTE_DE_LA_SIMULATION = 'Simulation de mise à jour (CI) : lot synthétique de scripts/mise-a-jour-simulation.mjs.';
/** La phrase ajoutée au texte des chapitres du guide (Markdown sûr : ni HTML ni lien). */
export const PHRASE_DU_GUIDE = 'Phrase ajoutée par la simulation de mise à jour.';

/** Construit la base des règles (db-build puis db-derive, comme le site) depuis un dossier de lignes. */
function construireRegles(rows, sortie) {
  for (const [script, args] of [['db-build.mjs', ['--out', sortie, '--rows', rows]], ['db-derive.mjs', [sortie]]]) {
    const r = spawnSync(process.execPath, ['--no-warnings', join(CLIENT, 'scripts', script), ...args], { encoding: 'utf8', cwd: RACINE });
    if (r.status !== 0) throw new Error(`${script} a échoué : ${r.stderr || r.stdout}`);
  }
}

/** Le premier nom libre « base », « base 2 »… d'après `pris(nom)`. */
const nomLibre = (base, pris) => {
  for (let i = 1; ; i += 1) {
    const nom = i === 1 ? base : `${base} ${i}`;
    if (!pris(nom)) return nom;
  }
};

/**
 * Les enregistrements du lot synthétique, lus dans la base vivante `db` juste avant chacun (une fonction par enregistrement : elle rend le corps de
 * POST /api/edition/). `guide` : les deux chapitres du guide seulement.
 */
function enregistrements(db, { guide = false } = {}) {
  const lire = (sql, ...p) => db.prepare(sql).get(...p);
  // deux chapitres du guide : les deux premières pages du premier livre (lib/livres.mjs : « Bienvenue », « Le jeu de rôle »), une phrase ajoutée à un
  // morceau de texte visible
  const chapitre = (n, dernier) => () => {
    const id = pagesDuLivre(LIVRES[0])[n - 1]?.id;
    const p = id && lire("SELECT id, corps_md FROM page WHERE type = 'guide' AND id = ?", id);
    if (!p) throw new Error(`chapitre ${n} du guide introuvable`);
    const visibles = decouperCorps(p.corps_md).filter((m) => m.visible);
    const rang = dernier ? visibles.length - 1 : 0;
    const nouveaux = visibles.map((m, i) => (i === rang ? `${m.texte.trim()}\n\n${PHRASE_DU_GUIDE}` : null));
    return { page: p.id, operations: [{ op: 'modifier', table: 'page', cle: { id: p.id }, valeurs: { corps_md: recomposerCorps(p.corps_md, nouveaux) }, avant: { corps_md: p.corps_md } }] };
  };
  const liste = [chapitre(1, false), chapitre(2, true)];
  if (guide) return liste;
  liste.push(
    // un métier (le premier) : une phrase de description en plus, et le premier bonus chiffré augmenté de 1 (bonus liés recalculés, décision R33)
    () => {
      const m = lire('SELECT id, description, bonus_brut FROM metier ORDER BY id LIMIT 1');
      const bonus = /\d+/.test(m.bonus_brut ?? '') ? m.bonus_brut.replace(/\d+/, (n) => String(Number(n) + 1)) : '+1% Calme';
      const description = `${(m.description ?? '').trim()} Description complétée par la simulation de mise à jour.`.trim();
      return { page: 'metiers/', operations: [{ op: 'modifier', table: 'metier', cle: { id: m.id }, valeurs: { description, bonus_brut: bonus } }] };
    },
    // un sort au coût seulement chiffré (le premier) : 1 de plus (consommation de chakra recalculée)
    () => {
      const s = lire("SELECT id, magie_id, cout_brut FROM sort WHERE cout_brut GLOB '[0-9]*' AND cout_brut NOT GLOB '*[^0-9]*' ORDER BY id LIMIT 1");
      return { page: s.magie_id, operations: [{ op: 'modifier', table: 'sort', cle: { id: s.id }, valeurs: { cout_brut: String(Number(s.cout_brut) + 1) } }] };
    },
    // un don de classe créé et gardé (Guerrier, niveau 20), au titre « Nom (Guerrier) » libre
    () => {
      const nom = nomLibre('Don de simulation', (n) => lire('SELECT 1 FROM cle_page WHERE cle = ?', normalize(`${n} (Guerrier)`)));
      return { page: 'classes/guerrier', operations: [{ op: 'creer', entite: 'capacite', valeurs: { classe_id: 'classes/guerrier', niveau: '20', nom, type: 'Passif', effet: 'Un effet de *simulation*.' } }] };
    },
    // un autre créé, supprimé par l'enregistrement suivant (D11 : la paire passe dans l'historique, son identifiant n'est pas repris)
    () => {
      const nom = nomLibre('Don éphémère de simulation', (n) => lire('SELECT 1 FROM cle_page WHERE cle = ?', normalize(`${n} (Guerrier)`)));
      return { page: 'classes/guerrier', operations: [{ op: 'creer', entite: 'capacite', valeurs: { classe_id: 'classes/guerrier', niveau: '20', nom, type: 'Passif' } }] };
    },
    (precedent) => ({ page: 'classes/guerrier', operations: [{ op: 'supprimer', entite: 'capacite', cle: { id: precedent.crees.find((c) => c.entite === 'capacite').id } }] }),
  );
  return liste;
}

/**
 * Fabrique le lot synthétique depuis `rows` (data/rows par défaut) : base des règles construite dans `dossier` (temporaire par défaut), base
 * vivante, modifications par le service, champ libre, lot figé en simulation. Rend { octets, lot, enregistrements } (`octets` : le lot tel que le
 * service le sert au workflow).
 */
export function fabriquerLot({ rows = join(RACINE, 'data', 'rows'), dossier = null, guide = false, versionDev = null } = {}) {
  const tmp = dossier ?? mkdtempSync(join(tmpdir(), 'maverick-simulation-'));
  try {
    const regles = join(tmp, 'regles.db');
    construireRegles(rows, regles);
    const vivante = join(tmp, 'db');
    const db = ouvrirBaseVivante(preparerBaseVivante({ regles, dossier: vivante }).chemin);
    try {
      const version = versionDev ?? JSON.parse(readFileSync(join(CLIENT, 'package.json'), 'utf8')).version;
      const service = {
        base: () => db, etat: () => ({ version }), edition: true, dossier: vivante, reference: null, adresse: ADRESSE, github: null,
        limites: { delai: 0, parJour: Infinity }, journal: () => {},
      };
      const appel = (methode, chemin, corps) => traiter({ methode, chemin, entetes: { 'content-type': 'application/json' }, corps: corps === undefined ? undefined : JSON.stringify(corps) }, service);
      const faits = [];
      for (const enregistrement of enregistrements(db, { guide })) {
        const corps = enregistrement(faits.at(-1)?.reponse);
        const r = appel('POST', '/api/edition/', corps);
        if (r.statut !== 200) throw new Error(`le service refuse un enregistrement (${r.statut}) : ${JSON.stringify(r.corps)} — ${JSON.stringify(corps).slice(0, 300)}`);
        faits.push({ corps, reponse: r.corps });
      }
      const brouillon = appel('POST', '/api/mise-a-jour/brouillon/', { texte: TEXTE_DE_LA_SIMULATION });
      if (brouillon.statut !== 200) throw new Error(`champ libre refusé (${brouillon.statut}) : ${JSON.stringify(brouillon.corps)}`);
      const lance = appel('POST', '/api/mise-a-jour/lancer/', { confirmation: CONFIRMATION, simulation: true });
      if (lance.statut !== 202) throw new Error(`lot refusé (${lance.statut}) : ${JSON.stringify(lance.corps)}`);
      const servi = appel('GET', `/api/mise-a-jour/lots/${lance.corps.lancement.lot}/`);
      if (servi.statut !== 200) throw new Error(`lot non servi (${servi.statut}) : ${JSON.stringify(servi.corps)}`);
      return { octets: servi.brut, lot: JSON.parse(servi.brut), enregistrements: faits.map((f) => f.corps) };
    } finally {
      db.close();
    }
  } finally {
    if (!dossier) rmSync(tmp, { recursive: true, force: true });
  }
}

/**
 * Les notes de version de `rows` qu'aucune livraison n'a apportées à la production (`reference` : révision git, scripts/db-reference.mjs) —
 * celles qui font refuser un autre lot (mise-a-jour-regles.mjs, code 7). Rend { notes: [{ version, lot }], production } ou lève une erreur si la
 * production est introuvable.
 */
export function notesEnAttenteDans({ rows = join(RACINE, 'data', 'rows'), reference = 'origin/master' } = {}) {
  const tmp = mkdtempSync(join(tmpdir(), 'maverick-simulation-attente-'));
  try {
    const ref = construireReference({ sortie: join(tmp, 'reference.db'), ref: reference });
    if (!ref.chemin) throw new Error(`base de production introuvable : ${ref.raison}`);
    const base = join(tmp, 'dev.db');
    const b = spawnSync(process.execPath, ['--no-warnings', join(CLIENT, 'scripts', 'db-build.mjs'), '--out', base, '--rows', rows], { encoding: 'utf8' });
    if (b.status !== 0) throw new Error(`data/rows ne se reconstruit pas : ${b.stderr || b.stdout}`);
    return { notes: notesEnAttente(base, { versionProduction: ref.version }), production: ref.version };
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const option = (nom, defaut) => (args.includes(nom) ? args[args.indexOf(nom) + 1] : defaut);
  const sortie = option('--lot');
  if (!sortie) {
    console.error('usage : node scripts/mise-a-jour-simulation.mjs --lot <lot.json> [--reference origin/master] [--rows <dossier>] [--guide]');
    process.exit(2);
  }
  const rows = option('--rows') ? resolve(option('--rows')) : undefined;
  rmSync(resolve(sortie), { force: true });
  const attente = notesEnAttenteDans({ rows, reference: option('--reference', 'origin/master') });
  if (attente.notes.length) {
    const n = attente.notes[0];
    console.log(`data/rows porte déjà la note V${n.version} du lot ${n.lot}, pas encore livrée sur la production (V${attente.production}) : c'est l'état `
      + 'd\'après une mise à jour, qu\'un autre lot ne peut pas suivre (mise-a-jour-regles.mjs, code 7). Aucun lot n\'est écrit : data/rows est contrôlé tel quel.');
    process.exit(0);
  }
  const { octets, lot, enregistrements: faits } = fabriquerLot({ rows, guide: args.includes('--guide') });
  writeFileSync(resolve(sortie), octets);
  const tables = [...new Set(lot.journal.lots.flatMap((l) => l.modifications.map((m) => m.table)))].sort();
  const modifications = lot.journal.lots.reduce((s, l) => s + l.modifications.length, 0);
  console.log(`lot ${lot.id} (simulation) : ${faits.length} enregistrement(s), ${modifications} modification(s) en ${lot.journal.lots.length} lot(s) ; tables : ${tables.join(', ')}`);
  if (!existsSync(resolve(sortie))) process.exit(1);
}
