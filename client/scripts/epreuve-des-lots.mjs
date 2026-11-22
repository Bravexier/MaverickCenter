// L'épreuve d'entrée des lots de changements (lot 6 du chantier de la base de dev, R274, R275 ; docs/serveur.md, « Lots de changements (épreuve) »).
//
//   node scripts/epreuve-des-lots.mjs fabriquer [--sortie test/fixtures/lots-0122-0124] [--travail var/epreuve-lots] [0122 0123 0124]
//       UNE fois, avec l'historique git : pour chaque migration de données, la base d'avant (le commit parent de celui qui a ajouté la migration) et la base
//       d'après (ce commit) sont bâties depuis `data/rows` de chaque commit ; la migration rejouée en SQL sur l'avant doit redonner l'après (sinon rien n'est
//       écrit) ; la différence, table de contenu par table de contenu, est écrite en lot `maverick-lot/1` (0122.json…) et son complément (complement.json :
//       lignes que le service retire lui-même avec une entité, numéros de la migration). Les lots sont versionnés : le test ne lit pas l'historique git.
//   node scripts/epreuve-des-lots.mjs refaire [--regles var/maverick.db] [--travail var/epreuve-lots] [--lots test/fixtures/lots-0122-0124] [--json]
//       Refait l'épreuve sur des copies de la base des règles (jamais modifiée) : voir serveur/epreuve-des-lots.mjs ; npm run db:epreuve-lots.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { preparerBaseVivante } from '../serveur/base-vivante.mjs';
import { comparerLesBases, copierLaBase, differences, lireLesLots, lotDeLaDifference, rejouerLaMigration, refaireLEpreuve, TEXTE_DES_RAISONS } from '../serveur/epreuve-des-lots.mjs';
import { extraireDuCommit } from './controler-les-migrations-lib.mjs';

const CLIENT = fileURLToPath(new URL('..', import.meta.url));
const RACINE = resolve(CLIENT, '..');
const args = process.argv.slice(2);
const commande = args[0];
const option = (nom, defaut) => (args.includes(nom) ? args[args.indexOf(nom) + 1] : defaut);
const numeros = args.slice(1).filter((a) => /^\d{4}$/.test(a));
const NUMEROS = numeros.length ? numeros : ['0122', '0123', '0124'];
const travail = resolve(CLIENT, option('--travail', '../var/epreuve-lots'));
const dossierDesLots = resolve(CLIENT, option('--lots', 'test/fixtures/lots-0122-0124'));

/** La nature et la décision de chaque lot : « decision » quand la migration cite la décision qu'elle applique (0124 : R272), « migration » sinon. */
const ENTETES = {
  '0122': { titre: 'Migration 0122 : « La montée de niveau » retirée, doublon d’« Expérience/Niveau global »', nature: 'migration' },
  '0123': { titre: 'Migration 0123 : « Les neuf alignements » fondue dans « Alignement », neuf mots-clés créés', nature: 'migration' },
  '0124': { titre: 'Migration 0124 : « Accessoires et Ceinture » fondue dans « Inventaire/Sac à dos » (R272)', nature: 'decision', decision: 'R272' },
};

const git = (...a) => execFileSync('git', a, { cwd: RACINE, encoding: 'utf8' }).trim();
const fichierDeLaMigration = (n) => readdirSync(join(RACINE, 'data', 'migrations')).find((f) => f.startsWith(`${n}-`) && f.endsWith('.sql'));
/** Le fichier de la migration `n` ; une erreur claire s'il n'est plus dans le dépôt. */
const fichierExige = (n) => {
  const fichier = fichierDeLaMigration(n);
  // l'épreuve compare chaque lot au SQL de sa migration (mixte) : sorti du dépôt avec elle (R296), il n'y a plus rien à éprouver
  if (!fichier) throw new Error(`la migration ${n} n'est pas dans data/migrations (migrations mixtes sorties du dépôt) : l'épreuve des lots ${NUMEROS.join(', ')} sort avec elles`);
  return fichier;
};
const sqlDe = (n) => readFileSync(join(RACINE, 'data', 'migrations', fichierExige(n)), 'utf8');

/** La base bâtie depuis `data/` du commit `ref` (git archive, db:build sans les tables calculées). */
function baseDuCommit(ref, nom) {
  const dossier = join(travail, nom);
  rmSync(dossier, { recursive: true, force: true });
  mkdirSync(dossier, { recursive: true });
  extraireDuCommit({ racine: RACINE, commit: ref, dossier, chemins: ['data'] });
  const sortie = join(dossier, 'base.db');
  const r = spawnSync('node', ['--no-warnings', join(CLIENT, 'scripts', 'db-build.mjs'), '--out', sortie, '--schema', join(dossier, 'data', 'schema.sql'), '--rows', join(dossier, 'data', 'rows')], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`db:build du commit ${ref} : ${r.stderr || r.stdout}`);
  return sortie;
}

function fabriquer() {
  const sortie = resolve(CLIENT, option('--sortie', 'test/fixtures/lots-0122-0124'));
  mkdirSync(sortie, { recursive: true });
  const complement = {};
  for (const n of NUMEROS) {
    const commit = git('log', '--diff-filter=A', '--format=%H', '--', `data/migrations/${fichierExige(n)}`).split('\n')[0];
    const avant = baseDuCommit(`${commit}^`, `avant-${n}`);
    const apres = baseDuCommit(commit, `apres-${n}`);
    const dAvant = new DatabaseSync(avant);
    const dApres = new DatabaseSync(apres, { readOnly: true });
    // la migration rejouée en SQL sur l'avant doit redonner l'après du commit
    const rejoue = copierLaBase(dAvant, join(travail, `rejoue-${n}.db`));
    rejouerLaMigration(rejoue, sqlDe(n));
    const ecart = comparerLesBases(dApres, rejoue);
    if (ecart.differentes.length) {
      throw new Error(`la migration ${n} rejouée en SQL ne redonne pas la base du commit ${commit.slice(0, 8)} : ${JSON.stringify(ecart.differentes.map((t) => [t.table, t.total, t.ecarts[0]]))}`);
    }
    rejoue.close();
    const diff = differences(dAvant, dApres);
    if (diff.sans_cle) throw new Error(`la migration ${n} change des tables sans clé primaire (${diff.sans_cle}) : un lot ne saurait pas les désigner`);
    const { lot, complement: c } = lotDeLaDifference(diff, dAvant, ENTETES[n]);
    writeFileSync(join(sortie, `${n}.json`), `${JSON.stringify(lot, null, 1)}\n`);
    complement[n] = { commit: commit.slice(0, 8), ...c };
    const parTable = Object.fromEntries(Object.entries(diff).map(([t, d]) => [t, `${d.inserees.length} ins., ${d.supprimees.length} supp., ${d.modifiees.length} modif.`]));
    console.log(`${n} (commit ${commit.slice(0, 8)}) : ${lot.operations.length} opérations, ${c.couvertes.length} retirées par le service avec leur entité ; ${JSON.stringify(parTable)}`);
    dAvant.close();
    dApres.close();
  }
  writeFileSync(join(sortie, 'complement.json'), `${JSON.stringify(complement, null, 1)}\n`);
  rmSync(travail, { recursive: true, force: true });
  console.log(`écrit dans ${sortie}`);
}

async function refaire() {
  const regles = resolve(CLIENT, option('--regles', '../var/maverick.db'));
  if (!existsSync(regles)) throw new Error(`base des règles introuvable : ${regles} (npm run db:build)`);
  const dossier = join(travail, 'refaire');
  rmSync(dossier, { recursive: true, force: true });
  const { chemin } = preparerBaseVivante({ regles, dossier: join(dossier, 'vivante') });
  const migrations = lireLesLots(dossierDesLots, NUMEROS);
  try {
    const bilan = await refaireLEpreuve({ chemin, dossier: join(dossier, 'copies'), migrations, sqlDe });
    if (args.includes('--json')) console.log(JSON.stringify(bilan, null, 1));
    else imprimer(bilan);
    // échec : une table qui diffère sans que (c) l'explique, un problème né d'un lot aux contrôles du contenu, une annulation faite qui ne rend pas la base d'avant
    // (une annulation REFUSÉE par le service est un constat, pas un échec : elle est dite)
    const ok = bilan.migrations.every((m) => m.comparaison.non_expliquees.length === 0 && m.lot_ouvert.essai.problemes_nouveaux.length === 0
      && (!m.annulation.annulee || m.annulation.base_d_avant.differentes.length === 0));
    process.exitCode = ok ? 0 : 1;
  } finally {
    rmSync(dossier, { recursive: true, force: true });
  }
}

function imprimer(b) {
  console.log(`la base d'avant : celle des règles, les migrations défaites (en plus, retiré parce que posé sur leurs lignes après elles — saisie du site, migration suivante : ${JSON.stringify(b.avant.posterieur_retire)})`);
  for (const m of b.migrations) {
    console.log(`\n${m.migration} : ${m.operations} opérations (+ ${m.couvertes} retirées par le service avec leur entité)`);
    const r = m.repartition;
    console.log(`  partage : (a) ${Object.values(r.a).reduce((x, y) => x + y, 0)} passent aujourd'hui, (b) ${Object.values(r.b).reduce((x, y) => x + Object.values(y).reduce((u, v) => u + v, 0), 0)} refusées (table hors édition, entité), (c) ${r.c.length} refusée(s) par le service même ouvert ; le lot entier au dépôt : ${m.depot_refuse.valide ? 'accepté' : `refusé (${m.depot_refuse.erreurs} erreurs)`}`);
    for (const [t, n] of Object.entries(r.a)) console.log(`    (a) ${t} : ${n}`);
    for (const [t, raisons] of Object.entries(r.b)) for (const [raison, n] of Object.entries(raisons)) console.log(`    (b) ${t} : ${n} — ${TEXTE_DES_RAISONS[raison]}`);
    const a = m.partie_a;
    if (a) console.log(`  partie (a) seule : essai ${a.essai.verdict}${a.ecartees.length ? `, refusées par le service lui-même (c) : ${a.ecartees.map((e) => `${e.table} ${JSON.stringify(e.cle)} : ${e.message}`).join(' ; ')}` : ''}${a.tables ? ` ; tables : ${JSON.stringify(a.tables)}` : ''}`);
    console.log(`  lot ouvert (test) : ${m.lot_ouvert.operations} opérations jouées, ${m.ecrites} écrites, ${m.changees} changées ; verrous ouverts : ${JSON.stringify(m.verrous_ouverts)}`);
    if (m.refusees_une_fois_ouvert.length) console.log(`  (c) refusées par le service même ouvert : ${m.refusees_une_fois_ouvert.map((e) => `${e.table} ${JSON.stringify(e.cle)} : ${e.message}`).join(' ; ')}`);
    console.log(`  numéros : ${m.numeros.length ? `${m.numeros.length} donnés (${m.numeros[0].migration} → ${m.numeros[0].service}…), ${m.memes_numeros ? 'les mêmes que ceux de la migration' : 'différents de ceux de la migration : comparés modulo ces numéros'}` : 'aucun'}`);
    const c = m.comparaison;
    console.log(`  base migrée : ${c.egales}/${c.tables} tables égales ; écarts expliqués par les refus (c) : ${JSON.stringify(c.expliquees_par_les_refus)} ; NON expliqués : ${JSON.stringify(c.non_expliquees)}`);
    const an = m.annulation;
    console.log(`  annulation : ${an.annulee ? `faite (${an.remises} remises, ${an.gardees} gardées) ; base d'avant : ${an.base_d_avant.egales}/${an.base_d_avant.tables} tables égales${an.base_d_avant.differentes.length ? ` ; DIFFÈRENT : ${JSON.stringify(an.base_d_avant.differentes)}` : ''}` : `REFUSÉE par le service : ${an.refus.slice(0, 260)}`}`);
  }
  console.log(`\ndurée : ${b.duree_ms} ms`);
}

try {
  if (commande === 'fabriquer') fabriquer();
  else if (commande === 'refaire') await refaire();
  else {
    console.error('usage : epreuve-des-lots.mjs fabriquer|refaire [options] [0122 0123 0124]');
    process.exit(2);
  }
} catch (e) {
  console.error(e.message);
  if (e.bilan) console.error(JSON.stringify(e.bilan, null, 1));
  process.exit(1);
}
