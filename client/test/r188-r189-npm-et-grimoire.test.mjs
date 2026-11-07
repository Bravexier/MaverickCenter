// Décisions R188 et R189 dans le moteur de la fiche (lib/fiche-moteur.mjs) :
//   - R188 : le personnage dont la magie innée est le Potentiel Illimité ne choisit ses sorts que jusqu'au plafond de sa magie (`regles.magies[].npm_plafond`,
//     magie_npm_plafond), relevé par un don acquis (`classes[].dons[].npm_plafond`, capacite_npm_plafond : « Semi-complet » de l'Archimage) ; NPM des sorts
//     = min(NPM du niveau, plafond) (npmDesSorts, sortsPossibles). Seul le choix des sorts est plafonné : la Symbiose, les invocations et le multiplicateur
//     des emplacements gardent la puissance du niveau (npmMax, puissanceMagique).
//   - R189 : le don « Grimoire » acquis (`condition_emplacements`, capacite_condition_emplacements) compte comme une condition de plus dans
//     emplacementsDeSorts, exactement comme une magie acquise, sans donner de seconde magie.
// Les plafonds et le marqueur sont des valeurs de la décision écrites par la migration 0097 : ni lib/edition-modele.mjs ni le service ne les écrivent.
// Les niveaux des dons et l'XP des niveaux se modifient sur le site de dev : tout se lit dans les règles de l'état d'import (test/aide-base-d-import.mjs),
// jamais par un nom ; les ids sont figés. Un test final garde les invariants sur la base courante.
//   node --test test/r188-r189-npm-et-grimoire.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { ficheVide } from '../src/lib/fiche-format.mjs';
import * as M from '../src/lib/fiche-moteur.mjs';
import { chargerReglesDeFiche } from '../src/lib/fiche-regles.mjs';
import { POTENTIEL_ILLIMITE } from '../src/lib/potentiel-illimite.mjs';
import { reglesDImport } from './aide-base-d-import.mjs';

const ARCHIMAGE = 'classes/archimage';
const SEMI_COMPLET = 'capacites/archimage-semi-complet';
const GRIMOIRE = 'capacites/archimage-grimoire';
// une seconde classe possible pour un bi-classe Potentiel Illimité (ni réservée ni fermée à sa magie : R23, R25), choisie par id
const SECONDE = 'classes/guerrier';
const NIVEAUX_DU_BRIEF = [3, 10, 11, 12, 16, 20];

const regles = reglesDImport();
const xpDuNiveau = (r, n) => r.niveaux.find((l) => l.niveau === n).xp_min;
const archimage = (r) => r.classes.find((c) => c.id === ARCHIMAGE);
const don = (r, id) => archimage(r).dons.find((d) => d.id === id);
/** Les règles sans les marqueurs de R188 et R189 sur les dons (le moteur d'avant, pour comparer). */
function sansLesDons(r, champ) {
  const copie = structuredClone(r);
  for (const d of archimage(copie).dons) delete d[champ];
  return copie;
}

/** Un Potentiel Illimité Archimage au niveau global `niveau`, mono-classe ou bi-classe (avec SECONDE en classe 2). */
function pi(r, niveau, mode = 'mono', plus = {}) {
  const classes = [{ rang: 1, classe_id: ARCHIMAGE, specialite_id: null }];
  if (mode === 'bi') classes.push({ rang: 2, classe_id: SECONDE, specialite_id: null });
  const f = { ...ficheVide('Essai'), race_id: 'races/humain', magie_innee_id: POTENTIEL_ILLIMITE, mode_classe: mode, classes, xp: xpDuNiveau(r, niveau), ...plus };
  assert.equal(M.niveauGlobal(r, f.xp), niveau);
  return f;
}
/** Le don `id` de l'Archimage est acquis au niveau global `niveau` (niveau de classe de l'Archimage, R2 : niveauxDeClasse ; niveau du don lu en règles). */
const acquis = (r, id, niveau, mode) => M.niveauxDeClasse(r, niveau, mode).classe1 >= don(r, id).niveau;

test('R188 : les plafonds sont des données des règles (magie innée du Potentiel Illimité, don « Semi-complet ») ; R189 : le marqueur de « Grimoire »', () => {
  const plafond = M.trouver(regles.magies, POTENTIEL_ILLIMITE).npm_plafond;
  assert.ok(Number.isInteger(plafond), 'plafond de la magie');
  assert.ok(Number.isInteger(don(regles, SEMI_COMPLET).npm_plafond) && don(regles, SEMI_COMPLET).npm_plafond > plafond, 'le don relève le plafond');
  assert.equal(don(regles, GRIMOIRE).condition_emplacements, true);
  // l'exemple de la décision, à l'import : 3, puis 4 avec le don ; le NPM 5 au niveau 16 (R16)
  assert.deepEqual([plafond, don(regles, SEMI_COMPLET).npm_plafond, M.puissanceMagique(regles, 16)], [3, 4, 5]);
});

test('R188 : NPM des sorts d’un Potentiel Illimité, mono-classe et bi-classe, aux niveaux 3, 10, 11, 12, 16, 20 : min(NPM du niveau, plafond)', () => {
  const plafond = M.trouver(regles.magies, POTENTIEL_ILLIMITE).npm_plafond;
  const plafondDuDon = don(regles, SEMI_COMPLET).npm_plafond;
  for (const mode of ['mono', 'bi']) {
    for (const niveau of NIVEAUX_DU_BRIEF) {
      const f = pi(regles, niveau, mode);
      const avecDon = acquis(regles, SEMI_COMPLET, niveau, mode);
      const attendu = Math.min(M.npmMax(regles, f), avecDon ? plafondDuDon : plafond);
      const ici = `${mode}, niveau ${niveau}`;
      assert.equal(M.npmDesSorts(regles, f), attendu, ici);
      assert.ok(M.npmDesSorts(regles, f) <= (avecDon ? plafondDuDon : plafond), `${ici} : jamais au-dessus du plafond`);
      assert.equal(M.npmMax(regles, f), M.puissanceMagique(regles, niveau), `${ici} : npmMax garde la puissance du niveau`);
      // sortsPossibles : toutes les magies, aucun sort au-dessus du NPM des sorts, jusqu'à lui
      const possibles = M.sortsPossibles(regles, f);
      assert.ok(possibles.every((s) => s.niveau <= attendu), `${ici} : aucun sort au-dessus du plafond`);
      assert.equal(Math.max(...possibles.map((s) => s.niveau)), attendu, ici);
      assert.ok(new Set(possibles.map((s) => s.magie_id)).size > 2, `${ici} : le Potentiel Illimité pioche dans toutes les magies`);
      // les lignes du tableau des sorts proposent la même liste (R27)
      assert.ok(M.lignesDeSorts(regles, f).every((l) => l.choix.every((s) => s.niveau <= attendu)), ici);
    }
  }
  // l'exemple de la décision, à l'import (« Il doit attendre le niveau 12 comme tout le monde ») : mono-classe 3 aux niveaux 10 et 11, don acquis ;
  // 4 aux niveaux 12, 16 et 20 ; bi-classe sans le don au niveau 16 : 3
  assert.ok(acquis(regles, SEMI_COMPLET, 10, 'mono'), 'mono-classe : le don au niveau global 10');
  assert.deepEqual(NIVEAUX_DU_BRIEF.map((n) => M.npmDesSorts(regles, pi(regles, n, 'mono'))), [1, 3, 3, 4, 4, 4]);
  assert.deepEqual(NIVEAUX_DU_BRIEF.map((n) => M.npmDesSorts(regles, pi(regles, n, 'bi'))), [1, 3, 3, 3, 3, 4]);
  // mono-classe au niveau 10 : le NPM du niveau, malgré le don (R188 (1))
  assert.equal(M.npmDesSorts(regles, pi(regles, 10, 'mono')), M.puissanceMagique(regles, 10));
  // sans le marqueur du don (moteur d'avant le don) : le plafond de la magie seul, à tout niveau
  const sansDon = sansLesDons(regles, 'npm_plafond');
  for (const n of NIVEAUX_DU_BRIEF) assert.equal(M.npmDesSorts(sansDon, pi(sansDon, n)), Math.min(M.puissanceMagique(sansDon, n), plafond), `niveau ${n}`);
});

test('R188 (2) : la Symbiose et les invocations d’un Potentiel Illimité au niveau 16 gardent la puissance du niveau, pas le plafond des sorts', () => {
  const symbiose = regles.postures.find((p) => p.chiffres?.some((c) => c?.cible === 'symbiose_sorts'));
  assert.ok(symbiose, 'la posture qui donne les dégâts de la Symbiose');
  const n16 = regles.niveaux.find((l) => M.puissanceMagique(regles, l.niveau) === Math.max(...regles.niveaux.map((x) => x.puissance_magique ?? 0))).niveau;
  for (const mode of ['mono', 'bi']) {
    const f = pi(regles, n16, mode, { posture_id: symbiose.id });
    const npm = M.npmMax(regles, f);
    assert.ok(npm > M.npmDesSorts(regles, f), `${mode} : la puissance du niveau dépasse le plafond des sorts`);
    const p = M.postureDuMoment(regles, f);
    const c = symbiose.chiffres.find((x) => x?.cible === 'symbiose_sorts');
    assert.equal(p.symbiose.degats, c.base + c.pas * Math.max(0, npm - 1), `${mode} : +2 par NPM, à la puissance du niveau (R100, R109)`);
    // une marionnette (une créature par NPM, R53) : à sa portée jusqu'à la puissance du niveau ; le multiplicateur d'un sort qui invoque aussi (R129)
    const inv = regles.invocations.find((i) => i.creatures.length && i.creatures.every((x) => x.npm !== null));
    const sort = regles.sorts.find((s) => s.id === inv.sort_id);
    const r = M.creaturesDuSort(regles, f, sort);
    assert.ok(r.miennes.every((x) => x.npm <= npm) && r.autres.every((x) => x.npm > npm), mode);
    assert.ok(r.miennes.some((x) => x.npm > M.npmDesSorts(regles, f)), `${mode} : une créature au-dessus du plafond des sorts`);
    const bornes = M.bornesDuMultiplicateur(regles, f, sort);
    if (bornes) assert.equal(bornes.max, Math.max(1, npm), mode);
  }
});

test('R189 : « Grimoire » acquis compte comme une magie acquise dans les emplacements de sorts ; le multiplicateur reste la puissance du niveau', () => {
  const sansGrimoire = sansLesDons(regles, 'condition_emplacements');
  // une magie acquise d'essai (une magie sans plafond), pour le personnage de comparaison : seule la condition compte ici
  const acquise = regles.magies.find((m) => m.id !== POTENTIEL_ILLIMITE && !m.npm_plafond).id;
  for (const mode of ['mono', 'bi']) {
    for (const niveau of regles.niveaux.map((l) => l.niveau)) {
      const f = pi(regles, niveau, mode);
      const e = M.emplacementsDeSorts(regles, f);
      const ici = `${mode}, niveau ${niveau}`;
      assert.equal(e.puissance, M.puissanceMagique(regles, niveau), `${ici} : multiplicateur = puissance du niveau`);
      assert.equal(e.total, e.conditions * e.puissance, ici);
      assert.equal(M.lignesDeSorts(regles, f).length, e.total, `${ici} : une ligne par emplacement (R27)`);
      if (acquis(regles, GRIMOIRE, niveau, mode)) {
        // exactement comme une magie acquise : le même personnage avec une magie acquise, sans le marqueur
        assert.deepEqual(e, M.emplacementsDeSorts(sansGrimoire, { ...f, magie_acquise_id: acquise }), ici);
        assert.equal(e.conditions, M.emplacementsDeSorts(sansGrimoire, f).conditions + 1, ici);
      } else {
        assert.deepEqual(e, M.emplacementsDeSorts(sansGrimoire, f), `${ici} : sans le don, inchangé`);
      }
    }
  }
  // mono-classe au niveau global 2 : pas encore le don (niveau d'Archimage < celui du don, à l'import) ; il arrive au niveau 3 en mono-classe, 5 en bi
  assert.ok(!acquis(regles, GRIMOIRE, 2, 'mono') && acquis(regles, GRIMOIRE, 3, 'mono') && !acquis(regles, GRIMOIRE, 4, 'bi') && acquis(regles, GRIMOIRE, 5, 'bi'));
  assert.deepEqual(M.emplacementsDeSorts(regles, pi(regles, 2)), M.emplacementsDeSorts(sansGrimoire, pi(regles, 2)));
});

test('R189 : « Grimoire » ne donne pas de seconde magie : ni palier NPM 5 fermé, ni Mode Hyper, ni Symbiose changés', () => {
  const sansGrimoire = sansLesDons(regles, 'condition_emplacements');
  const symbiose = regles.postures.find((p) => p.chiffres?.some((c) => c?.cible === 'symbiose_sorts'));
  const n16 = regles.niveaux.find((l) => l.puissance_magique_note).niveau; // le palier réservé aux personnages sans magie acquise (R16)
  const f = pi(regles, n16, 'mono', { posture_id: symbiose.id, mode_hyper: 1 });
  assert.ok(acquis(regles, GRIMOIRE, n16, 'mono'));
  assert.equal(M.npmMax(regles, f), M.puissanceMagique(regles, n16), 'le palier reste ouvert');
  assert.deepEqual(M.modeHyperDe(regles, f), M.modeHyperDe(sansGrimoire, f));
  assert.deepEqual(M.postureDuMoment(regles, f), M.postureDuMoment(sansGrimoire, f));
});

test('R188 : un personnage sans plafond de magie innée garde npmMax, même avec une magie acquise ou les classes de l’Archimage', () => {
  const sans = regles.magies.filter((m) => !Number.isInteger(m.npm_plafond));
  assert.ok(sans.length > 0);
  for (const m of sans) {
    for (const niveau of NIVEAUX_DU_BRIEF) {
      const f = { ...ficheVide('Essai'), race_id: 'races/humain', magie_innee_id: m.id, xp: xpDuNiveau(regles, niveau) };
      assert.equal(M.npmDesSorts(regles, f), M.npmMax(regles, f), `${m.id}, niveau ${niveau}`);
      const autre = sans.find((x) => x.id !== m.id);
      const bi = { ...f, magie_acquise_id: autre.id };
      assert.equal(M.npmDesSorts(regles, bi), M.npmMax(regles, bi), `${m.id} + ${autre.id}, niveau ${niveau}`);
      // les classes de l'Archimage (fiche signalée par classe_reservee) : le don ne crée pas de plafond
      const archi = { ...f, classes: [{ rang: 1, classe_id: ARCHIMAGE, specialite_id: null }] };
      assert.equal(M.npmDesSorts(regles, archi), M.npmMax(regles, archi), `${m.id} Archimage, niveau ${niveau}`);
    }
  }
  // fiche vide : 0 partout
  assert.equal(M.npmDesSorts(regles, ficheVide()), M.npmMax(regles, ficheVide()));
});

test('aujourd’hui : la fiche suit les plafonds et le marqueur de la base courante', () => {
  const courantes = JSON.parse(JSON.stringify(chargerReglesDeFiche(ouvrirBase({ sansExemples: false }))));
  const db = ouvrirBase({ sansExemples: false });
  const plafonds = new Map(db.prepare('SELECT magie_id, npm FROM magie_npm_plafond').all().map((r) => [r.magie_id, r.npm]));
  for (const m of courantes.magies) assert.equal(m.npm_plafond, plafonds.get(m.id) ?? null, m.id);
  const dons = courantes.classes.flatMap((c) => c.dons);
  const plafondsDesDons = new Map(db.prepare('SELECT capacite_id, npm FROM capacite_npm_plafond').all().map((r) => [r.capacite_id, r.npm]));
  const marques = new Set(db.prepare('SELECT capacite_id FROM capacite_condition_emplacements').all().map((r) => r.capacite_id));
  for (const d of dons) {
    assert.equal(d.npm_plafond, plafondsDesDons.get(d.id), d.id);
    assert.equal(d.condition_emplacements, marques.has(d.id) ? true : undefined, d.id);
  }
  // le NPM des sorts du Potentiel Illimité ne dépasse jamais ni la puissance du niveau ni le plus haut plafond
  const plafondMax = Math.max(plafonds.get(POTENTIEL_ILLIMITE) ?? 0, ...plafondsDesDons.values());
  for (const { niveau } of courantes.niveaux) {
    for (const mode of ['mono', 'bi']) {
      const f = pi(courantes, niveau, mode);
      assert.ok(M.npmDesSorts(courantes, f) <= Math.min(M.npmMax(courantes, f), plafonds.has(POTENTIEL_ILLIMITE) ? plafondMax : Infinity), `${mode} ${niveau}`);
    }
  }
});
