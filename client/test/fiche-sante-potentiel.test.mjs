// Décision R225 (réponses du propriétaire du 2026-11-08 : « Oui, 5 santé max/niveau » ; V5 bis : « Non, le dé en plus ») : un personnage dont la
// magie innée est le Potentiel Illimité met au plus N santé par niveau sur ses points d'attributs, le dé bonus des niveaux qui en donnent un en plus.
// Le moteur de la fiche (lib/fiche-moteur.mjs#santeDuPotentiel, rendu par gainsDeNiveau().potentiel) et la règle gains_sante_potentiel de
// v_personnage_controle (data/schema.sql, migration 0111) disent la même chose : mêmes fiches, enregistrées par le service dans une base vivante
// temporaire. N est la donnée regle_constante `potentiel_illimite.sante_max_par_niveau`, lue par lib/fiche-regles.mjs (regles.constantes) : aucune valeur
// n'est écrite ici, le plafond et les cas viennent de test/aide-sante-potentiel.mjs, qui les lit dans la base.
// La base, les règles et la base vivante sont dans le même état, celui d'import (test/aide-base-d-import.mjs).
//   node --test test/fiche-sante-potentiel.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ouvrirBaseVivante, preparerBaseVivante } from '../serveur/base-vivante.mjs';
import { enregistrerFiche } from '../serveur/fiches.mjs';
import { ficheVide } from '../src/lib/fiche-format.mjs';
import { gainsDeNiveau, santeDuPotentiel } from '../src/lib/fiche-moteur.mjs';
import { baseDImport, cheminDImport, reglesDImport } from './aide-base-d-import.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';
import { casDeSantePotentiel, CONSTANTE_SANTE_POTENTIEL, MAGIE_POTENTIEL, plafondDeSantePotentiel } from './aide-sante-potentiel.mjs';

const db = baseDImport();
const regles = reglesDImport();
const vivante = ouvrirBaseVivante(preparerBaseVivante({ regles: cheminDImport(), dossier: dossierTemporaire('sante-potentiel') }).chemin);
const REGLE = 'gains_sante_potentiel';
const signalementsDeLaBase = (fiche) => enregistrerFiche(vivante, fiche).controles.filter((c) => c.regle === REGLE).map((c) => c.detail);
const fiche = (nom, magie, xp, gains_sante) => ({ ...ficheVide(nom), magie_innee_id: magie, xp, gains_sante, gains_chakra: 0 });

test('R225 : la donnée arrive au moteur par regles.constantes, telle qu’en base', () => {
  const n = db.prepare('SELECT valeur FROM regle_constante WHERE id = ?').get(CONSTANTE_SANTE_POTENTIEL);
  assert.ok(n && n.valeur > 0, 'la donnée de R225');
  assert.equal(regles.constantes[CONSTANTE_SANTE_POTENTIEL], n.valeur);
  assert.equal(santeDuPotentiel(regles, fiche('pi', MAGIE_POTENTIEL, 0, 0)).parNiveau, n.valeur);
});

test('R225 : un Potentiel Illimité inné, sous son plafond, à sa limite et au-dessus, niveaux 1, 4 et 5 : le moteur et la règle gains_sante_potentiel de la base disent la même chose', () => {
  const cas = casDeSantePotentiel(db);
  assert.deepEqual([...new Set(cas.map((c) => c.niveau))], [1, 4, 5]);
  for (const [i, c] of cas.entries()) {
    const f = fiche(`PI ${i}`, MAGIE_POTENTIEL, c.xp, c.gains_sante);
    const moteur = gainsDeNiveau(regles, f);
    const quoi = `niveau ${c.niveau}, ${c.gains_sante} santé`;
    assert.equal(moteur.niveau, c.niveau, quoi);
    assert.equal(moteur.potentiel.plafond, c.plafond, `${quoi} : le plafond de l’aide (lu dans la base)`);
    assert.equal(moteur.potentiel.depasse, c.signale, quoi);
    assert.deepEqual(signalementsDeLaBase(f), moteur.potentiel.depasse ? [`${c.gains_sante} / ${moteur.potentiel.plafond}`] : [], `${quoi} : la base`);
  }
  // au niveau 1, rien à répartir : tout point de santé dépasse ; au niveau 5, le dé bonus s'ajoute au plafond (V5 bis)
  assert.equal(plafondDeSantePotentiel(db, 1), 0);
  const p4 = santeDuPotentiel(regles, fiche('PI 4', MAGIE_POTENTIEL, cas.find((c) => c.niveau === 4).xp, 0));
  const p5 = santeDuPotentiel(regles, fiche('PI 5', MAGIE_POTENTIEL, cas.find((c) => c.niveau === 5).xp, 0));
  assert.equal(p4.de, 0, 'pas de dé atteint au niveau 4');
  assert.ok(p5.de > 0 && p5.plafond === p4.plafond + p5.parNiveau + p5.de, 'au niveau 5 : un niveau de points de plus, et le dé en plus');
});

test('R225 : le contrôle s’ajoute à la somme (R73) sans la changer, et le plafond suit la donnée, jamais une valeur du code', () => {
  const c = casDeSantePotentiel(db, [5]).find((x) => x.signale);
  const pi = gainsDeNiveau(regles, fiche('PI', MAGIE_POTENTIEL, c.xp, c.gains_sante));
  const autreMagie = regles.magies.find((m) => m.id !== MAGIE_POTENTIEL).id;
  const autre = gainsDeNiveau(regles, fiche('Autre', autreMagie, c.xp, c.gains_sante));
  assert.deepEqual([pi.min, pi.max, pi.hors], [autre.min, autre.max, autre.hors], 'la plage de gains_niveau ne dépend pas de la magie');
  const n = regles.constantes[CONSTANTE_SANTE_POTENTIEL];
  const autreDonnee = { ...regles, constantes: { ...regles.constantes, [CONSTANTE_SANTE_POTENTIEL]: n + 1 } };
  const releve = santeDuPotentiel(autreDonnee, fiche('PI', MAGIE_POTENTIEL, c.xp, c.gains_sante));
  assert.equal(releve.plafond, pi.potentiel.plafond + pi.potentiel.niveaux, 'un de plus par niveau qui donne des points');
});

test('R225 : une autre magie innée au-dessus du plafond n’est jamais signalée, ni par le moteur ni par la base', () => {
  const autres = db.prepare('SELECT id FROM magie WHERE id <> ? ORDER BY id').all(MAGIE_POTENTIEL).map((m) => m.id);
  assert.ok(autres.length > 0);
  for (const c of casDeSantePotentiel(db).filter((x) => x.signale)) {
    for (const magie of [autres[0], autres.at(-1), null]) {
      const f = fiche(`Autre ${magie} ${c.niveau}`, magie, c.xp, c.gains_sante);
      assert.equal(gainsDeNiveau(regles, f).potentiel, null, `${magie}, niveau ${c.niveau}`);
      assert.deepEqual(signalementsDeLaBase(f), [], `${magie}, niveau ${c.niveau} : la base`);
    }
  }
});
