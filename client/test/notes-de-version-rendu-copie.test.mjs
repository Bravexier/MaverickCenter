// Le rendu pur de la base source (lot 8) dans lib/notes-de-version-rendu.mjs : le bouton « Copier vers le dépôt » (seulement avec `base_source`), l'encart
// du dernier lancement d'une copie ou d'une mise à jour reportée, et la phrase d'un refus avant l'envoi (attestation, citations). Rien d'un texte de règle
// ni d'un nom de fiche : des formes fabriquées ici ; le format du service est celui de serveur/paquet.mjs (`refus`, `reporte_le`, `report`).
//   node --test test/notes-de-version-rendu-copie.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  ETATS_DE_LA_COPIE, PHRASE_DE_LA_COPIE, enteteDuLancement, erreurDuReport, lancementAffiche, messageDuRefus, modeDuLancement, motDeLaCopie, phraseDuReport, texteDeLEtat,
} from '../src/lib/notes-de-version-rendu.mjs';
import { CONFIRMATION_COPIE } from '../serveur/paquet.mjs';

const ETATS = { termine: 'texte ordinaire de la fin', en_cours: 'texte ordinaire en cours', echec_livraison: 'texte ordinaire de livraison' };

test('« Copier vers le dépôt » : seulement quand le service dit base_source et donne le mot ; sans eux, la page reste comme avant', () => {
  assert.equal(motDeLaCopie({ base_source: true, confirmation_copie: 'COPIER VERS LE DEPOT' }), 'COPIER VERS LE DEPOT');
  for (const d of [null, undefined, {}, { base_source: false, confirmation_copie: 'x' }, { base_source: true }, { base_source: true, confirmation_copie: '' },
    { base_source: true, confirmation_copie: 3 }, { base_source: 'true', confirmation_copie: 'x' }]) assert.equal(motDeLaCopie(d), null);
  // le mot que le service demande est celui qu'il donne (la page n'en écrit aucun)
  assert.equal(motDeLaCopie({ base_source: true, confirmation_copie: CONFIRMATION_COPIE }), CONFIRMATION_COPIE);
  assert.match(PHRASE_DE_LA_COPIE, /pages du site de dev/);
  assert.match(PHRASE_DE_LA_COPIE, /sans rien livrer en production/);
});

test('le mode d’un lancement : le champ du service, sinon ses drapeaux (un lancement d’avant n’a pas de mode)', () => {
  assert.equal(modeDuLancement({ mode: 'copie' }), 'copie');
  assert.equal(modeDuLancement({ mode: 'simulation' }), 'simulation');
  assert.equal(modeDuLancement({ mode: 'mise-a-jour' }), 'mise-a-jour');
  assert.equal(modeDuLancement({ copie: true }), 'copie');
  assert.equal(modeDuLancement({ simulation: true }), 'simulation');
  assert.equal(modeDuLancement({}), 'mise-a-jour');
  assert.equal(modeDuLancement(null), 'mise-a-jour');
  assert.equal(modeDuLancement({ mode: 'autre' }), 'mise-a-jour');
});

test('l’encart d’un lancement : « Copie » sans version cible ; les autres lancements disent ce qu’ils disaient', () => {
  assert.deepEqual(enteteDuLancement({ mode: 'copie', version_cible: null, lance_le: '2026-11-15T10:00:00Z' }), { titre: 'Dernière copie', precision: '2026-11-15T10:00:00Z' });
  assert.deepEqual(enteteDuLancement({ version_cible: '0.4', lance_le: 'hier' }), { titre: 'Dernier lancement', precision: 'V0.4, hier' });
  assert.deepEqual(enteteDuLancement({ simulation: true, version_cible: '0.4', lance_le: 'hier' }), { titre: 'Dernière simulation', precision: 'V0.4, hier' });
  assert.deepEqual(enteteDuLancement({ mode: 'mise-a-jour', version_cible: undefined, lance_le: undefined }), { titre: 'Dernier lancement', precision: 'V?, ' });
});

test('une copie reste affichée (aucune version ne la périme) ; un lancement d’une autre version suit la règle d’avant', () => {
  const copie = { mode: 'copie', copie: true, version_cible: null, lot: 'c', etat: 'termine' };
  assert.equal(lancementAffiche({ lancement: copie, version_cible: '0.4' }), copie);
  const autre = { version_cible: '0.3', lot: 'a', etat: 'termine' };
  assert.equal(lancementAffiche({ lancement: autre, version_cible: '0.4' }), null);
  assert.equal(lancementAffiche({ lancement: { ...autre, version_cible: '0.4' }, version_cible: '0.4' })?.lot, 'a');
  assert.equal(lancementAffiche({ lancement: null, version_cible: '0.4' }), null);
});

test('l’état d’une copie a ses mots ; pas une mention de livraison sur master comme faite, ni de version', () => {
  const copie = { mode: 'copie', etat: 'termine' };
  assert.equal(texteDeLEtat(copie, ETATS), ETATS_DE_LA_COPIE.termine);
  assert.match(ETATS_DE_LA_COPIE.termine, /Copie terminée/);
  assert.match(ETATS_DE_LA_COPIE.termine, /Rien n’a été livré en production/);
  assert.doesNotMatch(Object.values(ETATS_DE_LA_COPIE).join(' '), /mise à jour terminée|V\d/i);
  // un état que la copie ne redit pas se lit comme celui des autres lancements
  assert.equal(texteDeLEtat({ mode: 'copie', etat: 'echec_livraison' }, ETATS), ETATS.echec_livraison);
  assert.equal(texteDeLEtat({ mode: 'copie', etat: 'inconnu' }, ETATS), 'inconnu');
  assert.equal(texteDeLEtat({ etat: 'en_cours' }, ETATS), ETATS.en_cours, 'une mise à jour ordinaire : le texte de la page');
});

test('« reporté le … » : une mise à jour faite depuis la base source dit ce qui a été reporté dans la base ; avant le report, qu’il attend', () => {
  const termine = { paquet: true, mode: 'mise-a-jour', etat: 'termine' };
  const attente = phraseDuReport(termine);
  assert.match(attente, /sera reportée/);
  assert.doesNotMatch(attente, /reportée le/);
  const fait = phraseDuReport({ ...termine, reporte_le: '2026-11-15T08:15:00Z', report: { historique: 3, integrees: 1, deja: false } });
  assert.match(fait, /reportée le 15 novembre 2026/);
  assert.match(fait, /3 traces d’historique, 1 modification livrée/);
  // sans comptes lisibles : la date seule ; un nombre faux n'est pas dit
  const sans = phraseDuReport({ ...termine, reporte_le: '2026-11-15T08:15:00Z', report: { historique: 'x', integrees: -1 } });
  assert.match(sans, /reportée le 15 novembre 2026/);
  assert.doesNotMatch(sans, /trace|modification livrée/);
  assert.match(phraseDuReport({ ...termine, reporte_le: 'pas une date' }), /reportée dans la base/);
  // texteDeLEtat la choisit pour ce lancement, et jamais pour un autre
  assert.equal(texteDeLEtat({ ...termine, reporte_le: '2026-11-15T08:15:00Z' }, ETATS), phraseDuReport({ ...termine, reporte_le: '2026-11-15T08:15:00Z' }));
  assert.equal(phraseDuReport({ paquet: true, mode: 'mise-a-jour', etat: 'en_cours' }), '');
  assert.equal(phraseDuReport({ paquet: false, etat: 'termine', reporte_le: '2026-11-15T08:15:00Z' }), '', 'un lot figé du journal : rien de nouveau');
  assert.equal(phraseDuReport({ paquet: true, mode: 'simulation', etat: 'termine' }), '');
  assert.equal(phraseDuReport({ paquet: true, mode: 'copie', etat: 'termine' }), '');
  assert.equal(phraseDuReport(null), '');
  assert.equal(texteDeLEtat({ etat: 'termine' }, ETATS), ETATS.termine, 'sans base source, la fin dit ce qu’elle disait');
});

test('l’erreur du report est dite ; sans erreur, rien', () => {
  assert.match(erreurDuReport({ erreur_report: 'base verrouillée' }), /report .* a échoué.*base verrouillée/);
  assert.equal(erreurDuReport({ erreur_report: null }), '');
  assert.equal(erreurDuReport({ erreur_report: '  ' }), '');
  assert.equal(erreurDuReport(undefined), '');
});

test('un refus d’attestation se dit par le message du service', () => {
  const r = messageDuRefus({ raison: 'attestation', etat: 'pas_appliquee', raison_production: 'x', message: 'Refusé avant l’envoi : la production n’a pas appliqué sa dernière mise à jour.' });
  assert.deepEqual(r, { texte: 'Refusé avant l’envoi : la production n’a pas appliqué sa dernière mise à jour.' });
  assert.equal(messageDuRefus({ raison: 'attestation' }), null, 'sans message, la page dit celui de l’erreur');
});

test('un refus illisible ou d’une autre raison (des éléments cités ne font plus refuser, R280) : null, la page garde le message du service', () => {
  for (const r of [undefined, null, 'x', 3, {}, { raison: 'autre' }, { raison: 'citations' }, { raison: 'citations', elements: 2, fiches: 4, tables: [{ table: 'don', elements: 2, fiches: 4 }] }]) {
    assert.equal(messageDuRefus(r), null);
  }
});

test('le module reste pur : aucune dépendance, aucun accès au navigateur', () => {
  const code = readFileSync(new URL('../src/lib/notes-de-version-rendu.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(code, /^import /m);
  assert.doesNotMatch(code, /\bdocument\.|\bwindow\.|\bfetch\(/);
});
