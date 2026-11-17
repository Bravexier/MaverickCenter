// Le mode modification redessine les cellules des armes, des armures et du bestiaire avec `ed.listes` comme contexte (serveur/edition.mjs#listes) : ce contexte
// porte `liens` (lib/mots-cles-des-valeurs.mjs, migration 0125), sinon une cellule modifiée perdrait sa balise jusqu'au rechargement. Les types de dégâts se
// lisent par leur lien en base, jamais par un nom ni un id supposé.
//   node --test test/edition-liens-des-valeurs.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { analyserEffetDArme, LIBELLES_DES_DEGATS, TYPES_DE_DEGATS } from '../src/lib/arme-champs.mjs';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { RENDUS } from '../src/lib/edition-rendu.mjs';
import { lienDuTypeDeDegats, liensDesValeursFermees } from '../src/lib/mots-cles-des-valeurs.mjs';
import { listes } from '../serveur/edition.mjs';

const db = ouvrirBase({ sansExemples: false });
const ctx = listes(db);
const liens = liensDesValeursFermees(db);
const lie = TYPES_DE_DEGATS.find((t) => lienDuTypeDeDegats(liens, t));

test('les listes du mode modification portent les liens des valeurs fermées de la base', () => {
  assert.deepEqual(ctx.liens, liens);
  assert.ok(lie, 'un type de dégâts physique lié à son mot-clé');
});

test('une cellule d’armure redessinée avec les listes garde la balise de son type de dégâts ; sans liens, nue', () => {
  const texte = `x2 ${LIBELLES_DES_DEGATS[lie]}`;
  for (const rendu of ['armure-resistance', 'armure-faiblesse']) {
    assert.ok(RENDUS[rendu](texte, {}, ctx).includes(`{{${lienDuTypeDeDegats(liens, lie).cle}|`), `${rendu} : balise gardée`);
    assert.ok(!RENDUS[rendu](texte, {}, { ...ctx, liens: undefined }).includes('{{'), `${rendu} : sans liens, nue`);
  }
});

test('une cellule d’arme redessinée avec les listes garde la balise des types de dégâts de son effet', () => {
  const effet = db.prepare('SELECT effet FROM arme').all().map((a) => a.effet).find((e) => analyserEffetDArme(e).degats.some((t) => lienDuTypeDeDegats(liens, t)));
  assert.ok(effet, 'une arme dont l’effet nomme un type lié');
  const type = analyserEffetDArme(effet).degats.find((t) => lienDuTypeDeDegats(liens, t));
  assert.ok(RENDUS['arme-types-degats'](effet, {}, ctx).includes(`{{${lienDuTypeDeDegats(liens, type).cle}|`), 'balise gardée');
  assert.ok(!RENDUS['arme-types-degats'](effet, {}, { ...ctx, liens: undefined }).includes('{{'), 'sans liens, nue');
});
