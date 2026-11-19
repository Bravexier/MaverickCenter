// La répétition complète du jour J de la bascule 2, sur des copies (lot 11, PR 3a ; docs/serveur.md, « Répétition complète du jour J ») : scripts/repetition-bascule-2.mjs, l'étape A
// (le paquet comme la simulation de mise à jour, le contrôle du contenu, l'activation, la base de la production refaite avec ses fiches). Le shell qui la lance est éprouvé par
// test/deploy-repetition-bascule-2.test.mjs. Des comptes seulement : les fiches, le compte et le groupe sentinelles (aide-fiches-sentinelles.mjs) ne sortent jamais.
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { RepetitionImpossible, texteDeLaBascule2 } from '../scripts/repetition-bascule-2.mjs';
import { ACTIVATION, FICHIERS_JOINTS, modulesDuServeur, REPETITION_BASCULE_2, REPETITION_PROD } from '../serveur/livraison.mjs';
import {
  CIBLE, creerMonde, DEV, lancerLaRepetition, ligneOrpheline, metierRetire, raceAbsente, sansMarque, sha, STRUCTURE,
} from './aide-repetition-bascule-2.mjs';

test('livré avec le service : le script et le garde-fou 17 sont joints à _serveur/ et n’importent que des modules livrés', () => {
  for (const f of [REPETITION_BASCULE_2, ACTIVATION]) assert.ok(FICHIERS_JOINTS.some((j) => j.source === f && j.cible === f), f);
  const livres = new Set([...modulesDuServeur(), ...FICHIERS_JOINTS.map((j) => j.cible)]);
  assert.deepEqual(modulesDuServeur(undefined, REPETITION_BASCULE_2).filter((m) => !livres.has(m)), []);
  assert.ok(modulesDuServeur(undefined, REPETITION_BASCULE_2).includes(REPETITION_PROD), 'elle réutilise repetition-prod.mjs (livré aussi)');
});

test('PASSERAIT : paquet de simulation, contrôle du contenu, activation, base refaite avec ses fiches adaptées (R42) ; aucun nom de fiche ; la base du site de dev n’est ni écrite ni suivie de db/mise-a-jour', (t) => {
  const m = creerMonde(t, () => {}, metierRetire);
  const avantDev = sha(m.dev);
  const avantProd = sha(m.copie);
  const x = lancerLaRepetition(m);
  assert.equal(x.verdict, 'passera', JSON.stringify(x.refus));
  assert.equal(x.version_cible, CIBLE);
  assert.equal(x.depuis, '9.0');
  // le paquet est un fichier de contenu neuf, lisible par tous (le conteneur sans privilège l'ouvre), sans fiche ni compte
  const paquet = join(m.travail, 'contenu', 'paquet.db');
  assert.ok(existsSync(paquet));
  const lu = new DatabaseSync(paquet, { readOnly: true });
  try {
    const meta = lu.prepare('SELECT mode, version, depuis, schema FROM paquet_meta').get();
    assert.deepEqual({ ...meta }, { mode: 'simulation', version: CIBLE, depuis: '9.0', schema: STRUCTURE });
    assert.equal(lu.prepare('SELECT count(*) AS n FROM personnage').get().n, 0, 'aucune fiche dans le paquet');
    assert.equal(lu.prepare('SELECT count(*) AS n FROM utilisateur').get().n, 0, 'aucun compte dans le paquet');
    assert.equal(lu.prepare('SELECT count(*) AS n FROM note_version WHERE version = ? AND exemple = 0').get(CIBLE).n, 1, 'la note de la prochaine version');
  } finally {
    lu.close();
  }
  assert.equal(x.contenu.problemes, 0);
  assert.ok(x.contenu.tables_controlees > 0);
  assert.equal(x.activation.ok, true);
  assert.equal(x.base.verdict, 'passera');
  assert.equal(x.base.base.fiches_avant, 2);
  assert.equal(x.base.base.fiches_apres, 2, 'aucune fiche perdue');
  assert.deepEqual(x.base.fiches_adaptees, { fiches: 2, par_nature: { metier: { fiches: 2, elements: 2 } } });
  assert.equal(x.base.controle.integrite, 'ok');
  assert.equal(x.base.controle.cles_rompues_fiches, 0);
  assert.equal(sha(m.dev), avantDev, 'la base du site de dev n’est pas écrite');
  assert.equal(existsSync(m.d('dev', 'db', 'mise-a-jour')), false, 'rien dans db/mise-a-jour/');
  assert.notEqual(sha(m.copie), avantProd, 'seule la copie est refaite');
  const texte = texteDeLaBascule2(x);
  assert.match(texte, /^étape A PASSERAIT : /);
  assert.match(texte, /contrôle du contenu : \d+ table\(s\) contrôlée\(s\), 0 problème\(s\)/);
  assert.match(texte, /activation \(garde-fou 17\) : acceptée/);
  assert.match(texte, /adaptées \(metier\) : 2 fiche\(s\), 2 élément\(s\)/);
  assert.match(texte, new RegExp(`\\n@@version-paquet=${CIBLE.replace('.', '\\.')}$`), 'la dernière ligne donne la version du paquet au .sh');
  sansMarque(texte, m.marques);
  sansMarque(JSON.stringify(x), m.marques);
});

test('REFUSEE (garde-fou 18) : le contenu a un problème, nommé par table, identifiant et règle, sans texte', (t) => {
  const m = creerMonde(t, ligneOrpheline);
  const x = lancerLaRepetition(m);
  assert.equal(x.verdict, 'refusee');
  assert.ok(x.contenu, JSON.stringify(x.refus));
  assert.ok(x.contenu.problemes >= 1);
  const nomme = x.contenu.nommes.find((p) => p.table === 'ecart_source');
  assert.deepEqual(nomme, { table: 'ecart_source', id: 'metier:zz-absent', regle: 'entite_adressee' });
  assert.ok(x.refus.some((r) => r.etape === 'contenu'));
  const texte = texteDeLaBascule2(x);
  assert.match(texte, /^étape A REFUSEE : /);
  assert.match(texte, /problème du contenu : ecart_source metier:zz-absent \(règle entite_adressee\)/);
  assert.equal(texte.includes('essai'), false, 'le texte de la ligne ne sort pas');
});

test('REFUSEE (garde-fou 17) : une autre structure, une note de version que la production a déjà et que le paquet n’a pas ; la base est refaite quand même (tout se dit d’un coup)', (t) => {
  const m = creerMonde(t, () => {}, (db) => db.prepare("INSERT INTO note_version (version, publiee_le, depuis, texte, lot, exemple) VALUES ('8.8', '2026-01-01', NULL, NULL, NULL, 0)").run());
  const x = lancerLaRepetition(m, { kit: { version: DEV, structure: STRUCTURE + 1 } });
  assert.equal(x.verdict, 'refusee');
  assert.deepEqual(x.activation.refus.map((r) => r.raison).sort(), ['note_manquante', 'structure']);
  const texte = texteDeLaBascule2(x);
  assert.match(texte, /activation \(garde-fou 17\) : refusée \(2 raison\(s\)\)/);
  assert.match(texte, /activation : Activation refusée \(structure\) : le paquet est de structure \d+, le kit v9\.1\.4 est de structure \d+/);
  assert.match(texte, /activation : Activation refusée \(note_manquante\) : .*V8\.8/);
});

test('REFUSEE : les fiches ne passent pas dans le contenu à livrer (une race absente n’est pas un retrait de R42) ; la production garderait sa base', (t) => {
  const m = creerMonde(t, () => {}, raceAbsente);
  const x = lancerLaRepetition(m);
  assert.equal(x.verdict, 'refusee');
  assert.ok(x.refus.some((r) => r.etape === 'base'));
  assert.equal(x.base.verdict, 'refusee');
  const texte = texteDeLaBascule2(x);
  assert.match(texte, /base de la production : NON refaite/);
  assert.match(texte, /problème : personnage\.race_id = « … » absent de race/);
  sansMarque(texte, m.marques);
  sansMarque(JSON.stringify(x), m.marques);
});

test('impossible : ce que la production publie est illisible, ou la copie absente ; une version déjà notée refuse sans planter (garde-fou de fabriquerPaquet)', (t) => {
  const m = creerMonde(t);
  assert.throws(() => lancerLaRepetition(m, { production: m.d('absent') }), (e) => e instanceof RepetitionImpossible && /publie n'est pas lisible/.test(e.message));
  assert.throws(() => lancerLaRepetition(m, { travail: m.d('vide') }), (e) => e instanceof RepetitionImpossible && /copie de la base de la production absente/.test(e.message));
  // la version de la prochaine livraison existe déjà dans le site de dev : le bouton refuserait (« a déjà une note »), c'est un refus et non une erreur
  const m2 = creerMonde(t, (db) => db.prepare("INSERT INTO note_version (version, publiee_le, depuis, texte, lot, exemple) VALUES (?, '2026-01-01', NULL, NULL, NULL, 0)").run(CIBLE));
  const x = lancerLaRepetition(m2);
  assert.equal(x.verdict, 'refusee');
  assert.equal(x.paquet, null);
  assert.match(texteDeLaBascule2(x), /paquet : le paquet ne se fabrique pas : La V9\.2 a déjà une note de version/);
});

