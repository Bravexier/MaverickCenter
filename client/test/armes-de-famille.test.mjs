// L'infobulle de la pastille du dé d'une famille d'armes (lib/armes-de-famille.mjs ; onglet Armes de /ressources/equipement/) : les paliers selon la
// Force que la note écrit (PUGILAT ; demande du propriétaire, 2026-10-23 : « Juste l'indiquer suffit (en tooltip de la catégorie) »), sinon
// « Dé de la famille, sauf indication contraire ». La note du Pugilat se lit dans son état d'import (lib/historique-site.mjs) ; l'état courant de
// chaque famille, par un invariant. Le rendu construit : test/armes-html.test.mjs.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { INFOBULLE_DU_DE_DE_FAMILLE, infobulleDuDeDeFamille, texteDesDesSelonLaForce } from '../src/lib/armes-de-famille.mjs';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { historiqueSite } from '../src/lib/historique-site.mjs';
import { desSelonLaForce } from '../src/lib/maitrise-arme.mjs';

const db = ouvrirBase({ sansExemples: false });
const historique = historiqueSite(db);

test('paliers selon la Force écrits comme la note : « Dn a-b Force », une seule valeur sans tiret, joints par « , » ; null sans palier', () => {
  assert.equal(texteDesDesSelonLaForce([{ de: 'D4', min: 1, max: 3 }, { de: 'D12', min: 4, max: 4 }]), 'D4 1-3 Force, D12 4 Force');
  assert.equal(texteDesDesSelonLaForce([]), null);
  assert.equal(texteDesDesSelonLaForce(null), null);
  assert.equal(texteDesDesSelonLaForce(undefined), null);
});

test('infobulle du dé : « Dé selon la Force : … » quand la note écrit des paliers, sinon celle de toute famille', () => {
  assert.equal(INFOBULLE_DU_DE_DE_FAMILLE, 'Dé de la famille, sauf indication contraire');
  assert.equal(infobulleDuDeDeFamille('D4 1-3 Force, D12 4 Force'), 'Dé selon la Force : D4 1-3 Force, D12 4 Force');
  assert.equal(infobulleDuDeDeFamille('Un matériau permet d’en faire 10 sauf pour la fronde qui elle est unique'), INFOBULLE_DU_DE_DE_FAMILLE);
  assert.equal(infobulleDuDeDeFamille(''), INFOBULLE_DU_DE_DE_FAMILLE);
  assert.equal(infobulleDuDeDeFamille(null), INFOBULLE_DU_DE_DE_FAMILLE);
  // la note du Pugilat telle que l'import l'a écrite (Ressources et Craft › Armes) : ses paliers cités tels qu'écrits
  const note = historique.valeurDImport('arme_famille', { id: 'pugilat' }, 'note_brut');
  assert.ok(desSelonLaForce(note), 'PUGILAT : des paliers dans sa note d’import');
  assert.equal(infobulleDuDeDeFamille(note), 'Dé selon la Force : D6 1-2 Force, D8 3-4 Force, D10 5 Force');
});

test('chaque famille de la base : les paliers de sa note en infobulle quand elle en écrit, sinon l’infobulle de toute famille', () => {
  const familles = db.prepare('SELECT id, note_brut FROM arme_famille').all();
  assert.ok(familles.some((f) => desSelonLaForce(f.note_brut)) && familles.some((f) => !desSelonLaForce(f.note_brut)));
  for (const f of familles) {
    const paliers = desSelonLaForce(f.note_brut);
    const infobulle = infobulleDuDeDeFamille(f.note_brut);
    assert.equal(infobulle, paliers ? `Dé selon la Force : ${texteDesDesSelonLaForce(paliers)}` : INFOBULLE_DU_DE_DE_FAMILLE, f.id);
  }
});
