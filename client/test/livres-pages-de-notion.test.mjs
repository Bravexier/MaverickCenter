// Une page des Règles hors du plan est une page de notion (chantier 3 des mots-clés ; R309 (7) : la notion a sa page, R185 (7) : aucun onglet créé) :
// verifierLePlan l'admet, le fil d'Ariane la rattache au Glossaire, elle n'a pas de menu latéral. Le plan est celui de l'état d'import (comme livres.test.mjs) ;
// la page de notion est inventée.
//   node --test test/livres-pages-de-notion.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  DECOUVRIR, estDesOnglets, estDansDecouvrir, estDuGuideDuMj, estHorsDuPlan, estUnePageDeNotion, filDAriane, GLOSSAIRE, GUIDE_DU_MJ,
  installerLePlan, menuLateralDe, pagesDeLaRubrique, placeDansLeGuide, verifierLePlan,
} from '../src/lib/livres.mjs';
import { chargerPlanDesRegles } from '../src/lib/plan-des-regles-db.mjs';
import { baseDImport } from './aide-base-d-import.mjs';

const db = baseDImport();
const PLAN = installerLePlan(chargerPlanDesRegles(db));
const pagesDuGuide = db.prepare("SELECT id, titre, resume, statut FROM page WHERE type = 'guide' ORDER BY id").all()
  .map((p) => ({ id: p.id, data: { title: p.titre, summary: p.resume ?? undefined, status: p.statut } }));
const PAGE_HORS_PLAN = 'guide/zephyrion-notion';
const page = (id, status = 'draft') => ({ id, data: { title: id, status } });
const avec = (id, status) => [...pagesDuGuide, page(id, status)];
const idDeLaPageDOnglet = PLAN[0].entrees.find((e) => e.page).page;

test('une page hors menu n’arrête plus le build : c’est une page de notion', () => {
  const entries = avec(PAGE_HORS_PLAN);
  assert.equal(verifierLePlan(entries), entries);
});

test('une page hors plan qui prend un nom réservé ou l’id d’un onglet arrête le build, nommée', () => {
  for (const id of ['guide/glossaire', 'guide/artisanat', 'guide/avancees', `guide/${PLAN[0].id}`]) {
    assert.throws(() => verifierLePlan(avec(id)), new RegExp(`${id} \\(page de notion, hors du plan\\) prend un nom réservé`), id);
  }
});

test('une page d’exemple hors plan ne lève rien, même sous un nom réservé ; une page supprimée revenue arrête toujours le build', () => {
  assert.doesNotThrow(() => verifierLePlan(avec('guide/glossaire', 'example')));
  assert.throws(() => verifierLePlan(avec('guide/aide-memoire')), /guide\/aide-memoire, supprimée \(R184\), est revenue sans place dans le plan/);
});

test('estHorsDuPlan : faux pour Découvrir, un onglet, le Guide du MJ et un id hors du guide', () => {
  assert.equal(estHorsDuPlan(PAGE_HORS_PLAN), true);
  const decouvrir = pagesDeLaRubrique(DECOUVRIR)[0].id;
  assert.ok(estDansDecouvrir(decouvrir));
  assert.equal(estHorsDuPlan(decouvrir), false);
  assert.ok(estDesOnglets(idDeLaPageDOnglet));
  assert.equal(estHorsDuPlan(idDeLaPageDOnglet), false);
  assert.ok(estDuGuideDuMj(GUIDE_DU_MJ.pages[0]));
  assert.equal(estHorsDuPlan(GUIDE_DU_MJ.pages[0]), false);
  assert.equal(estHorsDuPlan('magies/zephyrion'), false);
  assert.equal(estHorsDuPlan('regles/zephyrion'), false);
});

test('estUnePageDeNotion : faux pour une page d’exemple hors plan et pour une page rangée', () => {
  assert.equal(estUnePageDeNotion(page(PAGE_HORS_PLAN)), true);
  assert.equal(estUnePageDeNotion({ id: PAGE_HORS_PLAN }), true);
  assert.equal(estUnePageDeNotion(page(PAGE_HORS_PLAN, 'example')), false);
  assert.equal(estUnePageDeNotion(page(idDeLaPageDOnglet)), false);
});

test('le fil d’Ariane et la place d’une page de notion mènent au Glossaire ; une page rangée ne change pas', () => {
  assert.equal(GLOSSAIRE.chemin, 'regles/glossaire/');
  assert.deepEqual(filDAriane(PAGE_HORS_PLAN, { notion: true }), [{ titre: GLOSSAIRE.titre, chemin: 'regles/glossaire/' }]);
  assert.deepEqual(filDAriane(PAGE_HORS_PLAN), []);
  const place = placeDansLeGuide(PAGE_HORS_PLAN, { notion: true });
  assert.equal(place.rubrique, GLOSSAIRE.titre);
  assert.ok(place.rang > placeDansLeGuide(GUIDE_DU_MJ.pages[0]).rang, 'après le Guide du MJ');
  assert.equal(place.ordre, null);
  assert.deepEqual(placeDansLeGuide(PAGE_HORS_PLAN), { rubrique: null, rang: null, ordre: null });
  // une page d'onglet : ni fil ni place ne dépendent de l'option
  assert.deepEqual(filDAriane(idDeLaPageDOnglet, { notion: true }), filDAriane(idDeLaPageDOnglet));
  assert.deepEqual(placeDansLeGuide(idDeLaPageDOnglet, { notion: true }), placeDansLeGuide(idDeLaPageDOnglet));
  assert.equal(filDAriane(idDeLaPageDOnglet)[0].titre, PLAN[0].titre);
});

test('une page hors plan n’a pas de menu latéral', () => {
  assert.equal(menuLateralDe(PAGE_HORS_PLAN, pagesDuGuide), null);
});
