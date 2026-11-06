// Décision R187 (4) (demande du propriétaire du 2026-11-06 : « Supprime la liste. ») : la page « Liste des effets mode hyper » est retirée (migration
// 0095) ; « La fiche garde les mêmes valeurs et les mêmes textes (niveaux 2 et 10, puces du Mode Hyper 100 %), lus en base et non plus dans une page ».
// lib/fiche-regles.mjs lit les niveaux dans regle_constante (mode_hyper.niveau_deblocage, mode_hyper.niveau_100) et les puces et la phrase « En revanche,
// … » du Mode Hyper 100 % dans son texte d'explication (mode_texte, ids figés « guide/liste-des-effets-mode-hyper#texte:… »), jamais dans une page.
import assert from 'node:assert/strict';
import { cpSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { cheminBase, ouvrirBase } from '../src/lib/donnees.mjs';
import { chargerReglesDeFiche } from '../src/lib/fiche-regles.mjs';
import { historiqueSite } from '../src/lib/historique-site.mjs';
import { texteSansBalises, vocabulaireDesMotsCles } from '../src/lib/mots-cles-balises.mjs';
import { chargerVocabulaire } from '../src/lib/mots-cles-db.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';

const db = ouvrirBase({ sansExemples: false });
const regles = JSON.parse(JSON.stringify(chargerReglesDeFiche(db))); // tel que la page le reçoit
const LISTE = 'guide/liste-des-effets-mode-hyper';
const TEXTE_HYPER = `${LISTE}#texte:ne-plus-faire-quun-avec-soi-meme`;
const TEXTE_CENT = `${LISTE}#texte:mode-hyper-100`;
const texte = (b, id) => b.prepare('SELECT texte FROM mode_texte WHERE id = ?').get(id)?.texte;
const constante = (b, id) => b.prepare('SELECT valeur FROM regle_constante WHERE id = ?').get(id)?.valeur;
const puces = (t) => [...t.matchAll(/^- (.+)$/gm)].map((m) => m[1].trim());

/** Une copie de la base, modifiée par `sql`, clés étrangères actives (dossier supprimé à la fin du test `t`). */
function copie(t, ...sql) {
  const chemin = join(dossierTemporaire('fiche-r187', { t }), 'maverick.db');
  cpSync(cheminBase({ sansExemples: false }), chemin);
  const b = new DatabaseSync(chemin);
  b.exec('PRAGMA foreign_keys = ON');
  for (const [requete, ...parametres] of sql) b.prepare(requete).run(...parametres);
  t.after(() => b.close());
  return b;
}

test('R187 (4) : la page « Liste des effets mode hyper » est retirée, la fiche garde les niveaux 2 et 10 du Mode Hyper, lus en base', () => {
  assert.equal(db.prepare('SELECT count(*) AS n FROM page WHERE id = ?').get(LISTE).n, 0, 'page retirée (migration 0095)');
  assert.equal(regles.mode_hyper.niveau, 2);
  assert.equal(regles.mode_hyper.cent.niveau, 10);
  // la valeur des constantes, telles que les textes du classeur les écrivent
  assert.equal(regles.mode_hyper.niveau, constante(db, 'mode_hyper.niveau_deblocage'));
  assert.equal(regles.mode_hyper.cent.niveau, constante(db, 'mode_hyper.niveau_100'));
  assert.equal(/se d[ée]bloque au niveau (\d+)/.exec(texte(db, TEXTE_HYPER))?.[1], String(regles.mode_hyper.niveau));
  assert.equal(/disponible qu['’]au niveau (\d+)/.exec(texte(db, TEXTE_CENT))?.[1], String(regles.mode_hyper.cent.niveau));
});

test('R187 (4) : les puces du Mode Hyper 100 % et sa phrase « En revanche, … » sont celles de son texte (mode_texte), et celles qu’écrivait la page retirée', () => {
  const t = texte(db, TEXTE_CENT);
  assert.deepEqual(regles.mode_hyper.cent.effets, puces(t));
  assert.equal(regles.mode_hyper.cent.effets.length, 4);
  assert.equal(regles.mode_hyper.cent.suite, /^En revanche, (.+)$/m.exec(t)[1].trim());
  // le texte de l'import, que le site de dev n'a pas touché
  const historique = historiqueSite(db);
  assert.equal(historique.valeurDImport('mode_texte', { id: TEXTE_CENT }, 'texte'), t);
  // la page retirée, lue dans l'historique du site de dev (son texte d'import, puis chaque modification), comme la fiche la lisait avant R187 : la
  // section « ## Mode Hyper 100% » donnait les mêmes puces, la même suite et les mêmes niveaux
  const vocabulaire = vocabulaireDesMotsCles(chargerVocabulaire(db));
  const versions = [historique.valeurDImport('page', { id: LISTE }, 'corps_md'), ...db
    .prepare("SELECT apres FROM historique_modification WHERE table_nom = 'page' AND cle = ? AND operation = 'modifier' ORDER BY fait_le, lot_id, rang")
    .all(JSON.stringify({ id: LISTE }))
    .map((h) => JSON.parse(h.apres).corps_md)
    .filter(Boolean)];
  assert.ok(versions.length >= 1 && versions.every((v) => typeof v === 'string'), 'la page est dans l’historique');
  for (const corps of versions) {
    const page = texteSansBalises(corps, vocabulaire, { definitions: false });
    const section = /## Mode Hyper 100 ?%\s*\n([\s\S]*?)(?=\n## |$)/.exec(page)[1];
    assert.deepEqual(puces(section), regles.mode_hyper.cent.effets);
    assert.equal(/^En revanche, (.+)$/m.exec(section)[1].trim(), regles.mode_hyper.cent.suite);
    assert.equal(/se d[ée]bloque au niveau (\d+)/.exec(page)[1], String(regles.mode_hyper.niveau));
    assert.equal(/disponible qu['’]au niveau (\d+)/.exec(section)[1], String(regles.mode_hyper.cent.niveau));
  }
});

test('R187 (4) : la fiche suit la base (constantes, texte du Mode Hyper 100 %), et s’arrête sur une donnée absente', (t) => {
  const t0 = texte(db, TEXTE_CENT);
  const modifiee = copie(t,
    ["UPDATE regle_constante SET valeur = 3 WHERE id = 'mode_hyper.niveau_deblocage'"],
    ["UPDATE regle_constante SET valeur = 12 WHERE id = 'mode_hyper.niveau_100'"],
    ['UPDATE mode_texte SET texte = ? WHERE id = ?', t0.replace(/^- Le Chakra ne s'évapore plus\.$/m, "- Effet d'essai.").replace(/^En revanche, /m, 'En revanche, essai : '), TEXTE_CENT]);
  const lues = chargerReglesDeFiche(modifiee).mode_hyper;
  assert.equal(lues.niveau, 3);
  assert.equal(lues.cent.niveau, 12);
  assert.equal(lues.cent.effets[0], "Effet d'essai.");
  assert.ok(lues.cent.suite.startsWith('essai : '));
  assert.throws(() => chargerReglesDeFiche(copie(t, ['DELETE FROM mode_texte WHERE id = ?', TEXTE_CENT])),
    /mode_texte « guide\/liste-des-effets-mode-hyper#texte:mode-hyper-100 » absent de la base/);
  assert.throws(() => chargerReglesDeFiche(copie(t, ["DELETE FROM regle_constante WHERE id = 'mode_hyper.niveau_100'"])),
    /regle_constante « mode_hyper\.niveau_100 » absente de la base/);
  assert.throws(() => chargerReglesDeFiche(copie(t, ['UPDATE mode_texte SET texte = ? WHERE id = ?', t0.replace(/^- /gm, '* '), TEXTE_CENT])),
    /aucun effet du Mode Hyper 100 %/);
});
