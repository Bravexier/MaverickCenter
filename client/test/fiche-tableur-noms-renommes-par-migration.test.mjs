// Une fiche en tableur qui cite un sort sous le nom qu'il portait avant la mise à jour de Décembre (R237 (4) : « Répar'Os » devenu « Répar Os »… ; R237 (11) :
// « Armure d'os » devenu « Armure osseuse »…) retrouve le même sort, avec le même identifiant : l'ancien nom est lu dans la référence tirée du registre
// de la migration (data/references/noms-d-avant-des-migrations.json, lib/noms-d-avant-des-migrations.mjs ; égalité au registre de la 0117 épinglée par
// test/references-des-migrations-mixtes.test.mjs) et rendu en `noms_d_avant` par les règles de la fiche (lib/fiche-regles.mjs), comme celui d'un
// renommage fait sur le site de dev. Les noms se lisent dans la référence, aucun n'est écrit ici ; aucune ligne n'est fabriquée dans historique_modification.
//   node --test test/fiche-tableur-noms-renommes-par-migration.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { ouvrirBase, trouverRacine } from '../src/lib/donnees.mjs';
import { ficheVide } from '../src/lib/fiche-format.mjs';
import { modeleXlsx } from '../src/lib/fiche-modele.mjs';
import * as M from '../src/lib/fiche-moteur.mjs';
import { chargerReglesDeFiche } from '../src/lib/fiche-regles.mjs';
import { cellulesDeLaFiche } from '../src/lib/fiche-tableur-export.mjs';
import { ficheDuClasseur } from '../src/lib/fiche-tableur-import.mjs';
import { nomsDAvantDesMigrations } from '../src/lib/noms-d-avant-des-migrations.mjs';
import { REFERENCES } from '../src/lib/references-des-migrations.mjs';
import { ecrireXlsx } from '../src/lib/tableur-ecriture.mjs';
import { lireClasseur } from '../src/lib/tableur-lecture.mjs';

/** Les sorts renommés par une migration (la 0117 : R237 (4) et (11)), { id, avant } dans l'ordre de la référence. */
const RENOMMES = [...nomsDAvantDesMigrations().get('sort')].flatMap(([id, noms]) => noms.map((avant) => ({ id, avant })));
const DATE = '07/11/2026';
const MODELE = await modeleXlsx();
const db = ouvrirBase({ sansExemples: false });
const regles = JSON.parse(JSON.stringify(chargerReglesDeFiche(db)));

/** La fiche d'un personnage de niveau 20 de la magie du sort, avec ce seul sort. */
function ficheAvec(sort) {
  const f = { ...ficheVide('Essai'), race_id: 'races/humain', magie_innee_id: sort.magie_id, xp: regles.niveaux.find((l) => l.niveau === 20).xp_min,
    caracteristiques: regles.caracteristiques.map((k) => ({ caracteristique_id: k.id, base: 3, croix: 0 })) };
  f.sorts = [{ sort_id: sort.id, rang: 1, niveau_maitrise: 0 }];
  return f;
}

test('les sorts renommés par la 0117 (R237 (4) et (11)), lus dans la référence : chacun présent sous son identifiant ; autant de sorts portent noms_d_avant que la référence en nomme', () => {
  // l'effectif se lit dans le fichier de référence lui-même (data/references/, sans valeur écrite ici) : chaque sort qu'il nomme, et lui seul parmi
  // les renommés, est lu par la fiche
  const reference = JSON.parse(readFileSync(join(trouverRacine(), REFERENCES.nomsDAvant), 'utf8')).sort;
  const ids = Object.keys(reference);
  assert.ok(ids.length > 0);
  assert.deepEqual([...new Set(RENOMMES.map((r) => r.id))].sort(), [...ids].sort());
  for (const r of RENOMMES) assert.ok(M.trouver(regles.sorts, r.id), `${r.id} existe toujours`);
  // un sort dont le nom courant n'est aucun de ses anciens noms (le site peut lui avoir rendu l'un d'eux) porte noms_d_avant
  const attendus = ids.filter((id) => reference[id].some((n) => n !== M.trouver(regles.sorts, id).nom));
  const portes = regles.sorts.filter((x) => Object.hasOwn(reference, x.id) && reference[x.id].some((n) => x.noms_d_avant?.includes(n))).map((x) => x.id);
  assert.deepEqual(portes.sort(), attendus.sort());
});

test('noms_d_avant des règles : chaque ancien nom du registre est celui du sort de même identifiant ; un sort jamais renommé n’en a pas ; la lecture ne touche pas l’historique', () => {
  const lus = nomsDAvantDesMigrations().get('sort');
  for (const r of RENOMMES) {
    assert.ok(lus.get(r.id).includes(r.avant), `${r.id} : lu dans la référence`);
    const sort = M.trouver(regles.sorts, r.id);
    if (r.avant !== sort.nom) assert.ok(sort.noms_d_avant.includes(r.avant), `${r.id} : noms_d_avant`);
    assert.ok(!(sort.noms_d_avant ?? []).includes(sort.nom), 'jamais le nom actuel');
  }
  const renommes = new Set(RENOMMES.map((r) => r.id));
  const sans = regles.sorts.find((s) => !renommes.has(s.id) && !lus.has(s.id));
  assert.ok(sans);
  // aucun nom d'avant d'un sort qu'aucun registre ni le site n'a renommé n'est inventé
  for (const s of regles.sorts.filter((x) => !lus.has(x.id))) {
    const historique = db.prepare("SELECT count(*) AS n FROM historique_modification WHERE table_nom = 'sort' AND cle = ?").get(JSON.stringify({ id: s.id })).n;
    if (!historique) assert.equal(s.noms_d_avant, undefined, s.id);
  }
});

test('R237 (4) et (11) : une fiche du tableur écrite sous l’ancien nom d’un sort renommé le retrouve, avec le même identifiant (jamais « perdu »)', async () => {
  for (const r of RENOMMES) {
    const sort = M.trouver(regles.sorts, r.id);
    const f = ficheAvec(sort);
    assert.ok(M.sortsPossibles(regles, f).some((s) => s.id === sort.id), `${r.id} : au choix du personnage d'essai`);
    // les règles d'avant : le sort s'appelle comme avant la mise à jour
    const avant = { ...regles, sorts: regles.sorts.map((s) => (s.id === r.id ? { ...s, nom: r.avant, noms_d_avant: undefined } : s)) };
    const sortie = cellulesDeLaFiche(avant, f, { date: DATE });
    const octets = await ecrireXlsx(MODELE, { cellules: sortie.cellules, remplis: sortie.remplis, alignements: sortie.alignements, descriptionImage: 'logo', titre: f.nom });
    const classeur = await lireClasseur(octets, { nom: 'essai.xlsx' });
    const lu = ficheDuClasseur(regles, classeur.feuille('Personnage'), { nomFichier: 'essai.xlsx', date: DATE });
    assert.deepEqual(lu.fiche.sorts.map((s) => s.sort_id), [r.id], `${r.id} : « ${r.avant} » retrouvé`);
    assert.equal(lu.nonRepris.some((x) => String(x).includes(r.avant)), false, `${r.id} : pas dans les perdus`);
  }
});
