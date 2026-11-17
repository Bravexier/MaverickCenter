// Le script de la page « Mise à jour » sur le site de dev (src/scripts/mise-a-jour.mjs), exécuté dans un faux navigateur (test/aide-faux-dom.mjs) avec
// un faux service : la case « Version majeure » à côté du titre « Mise à jour en préparation » (demande du propriétaire du 2026-10-22 : cochée avec
// confirmation, la version en préparation passe de X.Y+1 à X+1.0 ; « Effectuer la mise à jour » reste le seul déclencheur). Cocher ouvre une
// confirmation et n'envoie rien avant elle ; confirmée, le service enregistre la case et la page dit la nouvelle version ; décocher se fait sans
// confirmation ; un texte du champ libre en cours de saisie survit au changement ; un lot figé fige la case ; la confirmation de « Effectuer la mise à
// jour » dit la version majeure. Le service lui-même : test/serveur-notes-de-version.test.mjs.
//   node --test test/mise-a-jour-script.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { attendre, el, fauxDocument } from './aide-faux-dom.mjs';

let numero = 0;

/** Un faux service : GET etat/ et mise-a-jour/, POST mise-a-jour/majeure/ ; `appels` : les requêtes reçues (méthode, chemin, corps). */
function fauxService({ lot = null, baseSource = false, lancement = null, refus = null } = {}) {
  const etat = { majeure: false, appels: [] };
  const note = () => ({
    reference: { disponible: true, version: '0.3.0' }, version_dev: '0.3.70', version_cible: etat.majeure ? '1.0' : '0.4', version_mineure: '0.4',
    version_majeure: '1.0', en_attente: 2, brouillon: { texte: 'Texte enregistré', modifie_le: null, lot, majeure: etat.majeure }, lignes: [], bilan: { total: 0 },
  });
  etat.fetch = async (adresse, init = {}) => {
    const chemin = String(adresse).replace(/^\/api\//, '');
    const corps = init.body ? JSON.parse(init.body) : undefined;
    etat.appels.push({ methode: init.method ?? 'GET', chemin, corps });
    const json = (statut, donnees) => new Response(JSON.stringify(donnees), { status: statut, headers: { 'Content-Type': 'application/json' } });
    if (chemin === 'etat/') return json(200, { edition: true });
    if (chemin === 'mise-a-jour/') {
      return json(200, { ...note(), lancement, liberable: false, occupe: false, github: { configure: true }, confirmation: 'METTRE A JOUR',
        ...(baseSource === null ? {} : { base_source: baseSource, ...(baseSource ? { confirmation_copie: 'COPIER VERS LE DEPOT' } : {}) }) });
    }
    // un refus avant l'envoi (lot 8) : 409 avec `refus`, et le message du service (qu'on n'affiche pas quand `refus` se lit)
    if (refus && init.method === 'POST' && ['mise-a-jour/lancer/', 'mise-a-jour/copier/'].includes(chemin)) return json(409, { erreur: 'Refusé avant l’envoi : message du service.', refus });
    if (chemin === 'mise-a-jour/copier/' && init.method === 'POST') {
      if (!baseSource) return json(409, { erreur: 'Pas de base source.' });
      if (corps.confirmation !== 'COPIER VERS LE DEPOT') return json(400, { erreur: 'Confirmation absente.' });
      return json(202, { lancement: { lot: 'c', etat: 'envoi', mode: 'copie', copie: true, version_cible: null }, github: { configure: true } });
    }
    if (chemin === 'maintenance/') return json(200, { active: false });
    if (chemin === 'mise-a-jour/lancer/' && init.method === 'POST') {
      if (corps.version_cible !== note().version_cible) return json(409, { erreur: 'La version en préparation a changé : rechargez la page.' });
      return json(202, { lancement: { lot: 'x', etat: 'envoi', version_cible: corps.version_cible } });
    }
    if (chemin === 'mise-a-jour/majeure/' && init.method === 'POST') {
      if (lot) return json(409, { erreur: 'Une mise à jour est en cours.' });
      etat.majeure = corps.majeure;
      return json(200, note());
    }
    return json(404, { erreur: 'inconnue' });
  };
  return etat;
}

/** La page telle que pages/mise-a-jour.astro l'écrit (réduite à ce que le script lit), le script chargé à neuf, la note du site de dev affichée. */
async function monter(options) {
  const service = fauxService(options);
  const document = fauxDocument(el('main', {}, el('div', { class: 'mise-a-jour', 'data-mise-a-jour': '', 'data-api': '/api/', 'data-maintenance': '/maintenance/' },
    el('section', { class: 'nv-dev', 'data-nv-dev': '', hidden: '' }), el('section', { class: 'nv-production', 'data-nv-production': '' }))));
  const alertes = [];
  Object.assign(globalThis, { document, fetch: service.fetch, alert: (m) => alertes.push(m), window: { confirm: () => true } });
  await import(`../src/scripts/mise-a-jour.mjs?page=${(numero += 1)}`);
  for (let i = 0; i < 50 && document.querySelector('[data-nv-dev]').hidden; i += 1) await attendre();
  const zone = document.querySelector('[data-nv-dev]');
  assert.equal(zone.hidden, false, 'la note du site de dev est affichée');
  const titre = () => zone.querySelector('h2').textContent;
  const caseMajeure = () => zone.querySelector('[data-nv-majeure]');
  const dialogue = () => document.querySelector('dialog');
  const ecritures = () => service.appels.filter((a) => a.methode === 'POST');
  return { service, document, zone, titre, caseMajeure, dialogue, ecritures, alertes };
}

/** Le visiteur coche ou décoche la case (le navigateur change `checked` avant l'évènement). */
const basculer = (c, coche) => {
  c.checked = coche;
  c.dispatchEvent(new Event('change'));
};
/** Jusqu'à ce que les requêtes en cours aient répondu. */
const reponses = async () => {
  for (let i = 0; i < 10; i += 1) await attendre();
};

test('la case « Version majeure » est à côté du titre, décochée : la version en préparation est la X.Y+1', async () => {
  const p = await monter();
  assert.equal(p.titre(), 'Mise à jour en préparation : V0.4');
  const c = p.caseMajeure();
  assert.ok(c, 'la case');
  assert.equal(c.closest('.nv-dev__titre')?.querySelector('h2')?.textContent, p.titre(), 'à côté du titre');
  assert.equal(c.hasAttribute('checked'), false);
  assert.equal(c.hasAttribute('disabled'), false);
  assert.match(c.closest('label').textContent, /Version majeure \(V1\.0\)/);
});

test('cocher ouvre une confirmation et n’envoie rien ; annulée, rien ne change', async () => {
  const p = await monter();
  basculer(p.caseMajeure(), true);
  assert.equal(p.caseMajeure().checked, false, 'la case ne se coche qu’une fois confirmée');
  const d = p.dialogue();
  assert.ok(d?.ouvert, 'la confirmation est ouverte');
  assert.match(d.textContent, /V1\.0/);
  assert.match(d.textContent, /ne lance rien/);
  assert.match(d.textContent, /Effectuer la mise à jour/);
  assert.deepEqual(p.ecritures(), [], 'rien n’est envoyé avant la confirmation');
  d.querySelector('[value="annuler"]').dispatchEvent(new Event('click'));
  assert.equal(p.dialogue(), null, 'fermée et retirée');
  await reponses();
  assert.deepEqual(p.ecritures(), []);
  assert.equal(p.titre(), 'Mise à jour en préparation : V0.4');
});

test('confirmée : la case est enregistrée par le service et la page dit la V X+1.0 ; décochée sans confirmation, elle revient à la X.Y+1', async () => {
  const p = await monter();
  basculer(p.caseMajeure(), true);
  p.dialogue().querySelector('form').dispatchEvent(new Event('submit', { cancelable: true }));
  await reponses();
  assert.deepEqual(p.ecritures(), [{ methode: 'POST', chemin: 'mise-a-jour/majeure/', corps: { majeure: true } }]);
  assert.equal(p.titre(), 'Mise à jour en préparation : V1.0');
  assert.equal(p.caseMajeure().hasAttribute('checked'), true);
  assert.equal(p.dialogue(), null);
  // la confirmation de la simulation la dit au conditionnel (rien n'est poussé), celle de « Effectuer la mise à jour » au présent
  p.zone.querySelector('[data-nv-simuler]').dispatchEvent(new Event('click'));
  assert.match(p.dialogue().textContent, /Version majeure.*porterait.*\[V: X\+1\].*passeraient en V1\.0\.0/s);
  p.dialogue().querySelector('[value="annuler"]').dispatchEvent(new Event('click'));
  p.zone.querySelector('[data-nv-lancer]').dispatchEvent(new Event('click'));
  assert.match(p.dialogue().querySelector('h2').textContent, /Effectuer la mise à jour V1\.0/);
  assert.match(p.dialogue().textContent, /Version majeure.*porte.*\[V: X\+1\].*passent en V1\.0\.0/s);
  p.dialogue().querySelector('[value="annuler"]').dispatchEvent(new Event('click'));
  // décochée : aucune confirmation
  basculer(p.caseMajeure(), false);
  assert.equal(p.dialogue(), null);
  await reponses();
  assert.deepEqual(p.ecritures().at(-1), { methode: 'POST', chemin: 'mise-a-jour/majeure/', corps: { majeure: false } });
  assert.equal(p.titre(), 'Mise à jour en préparation : V0.4');
  assert.equal(p.caseMajeure().hasAttribute('checked'), false);
  p.zone.querySelector('[data-nv-lancer]').dispatchEvent(new Event('click'));
  assert.doesNotMatch(p.dialogue().textContent, /Version majeure/);
});

test('le texte du champ libre en cours de saisie survit au changement de la case', async () => {
  const p = await monter();
  const champ = p.zone.querySelector('[data-nv-texte]');
  champ.value = 'Brouillon pas encore enregistré';
  champ.dispatchEvent(new Event('input'));
  basculer(p.caseMajeure(), true);
  p.dialogue().querySelector('form').dispatchEvent(new Event('submit', { cancelable: true }));
  await reponses();
  assert.equal(p.titre(), 'Mise à jour en préparation : V1.0');
  const nouveau = p.zone.querySelector('[data-nv-texte]');
  assert.notEqual(nouveau, champ, 'la note a été refaite');
  assert.equal(nouveau.value, 'Brouillon pas encore enregistré');
  assert.equal(p.zone.querySelector('[data-nv-etat-texte]').textContent, 'modifié, non enregistré');
  assert.deepEqual(p.ecritures().map((a) => a.chemin), ['mise-a-jour/majeure/'], 'le texte n’est pas enregistré pour autant');
});

test('« Effectuer la mise à jour » envoie la version montrée : le service refuse (409) si une autre partirait', async () => {
  const p = await monter();
  basculer(p.caseMajeure(), true);
  p.dialogue().querySelector('form').dispatchEvent(new Event('submit', { cancelable: true }));
  await reponses();
  p.zone.querySelector('[data-nv-lancer]').dispatchEvent(new Event('click'));
  p.dialogue().querySelector('input').value = 'METTRE A JOUR';
  p.dialogue().querySelector('form').dispatchEvent(new Event('submit', { cancelable: true }));
  await reponses();
  assert.deepEqual(p.ecritures().at(-1), { methode: 'POST', chemin: 'mise-a-jour/lancer/', corps: { confirmation: 'METTRE A JOUR', simulation: false, version_cible: '1.0' } });
  // un onglet resté sur la V1.0 alors que la case a été décochée ailleurs : refusé, l'erreur est dite dans le dialogue
  p.service.majeure = false;
  p.zone.querySelector('[data-nv-lancer]').dispatchEvent(new Event('click'));
  assert.match(p.dialogue().querySelector('h2').textContent, /V1\.0/, 'la page montre encore la V1.0');
  p.dialogue().querySelector('input').value = 'METTRE A JOUR';
  p.dialogue().querySelector('form').dispatchEvent(new Event('submit', { cancelable: true }));
  await reponses();
  const erreur = p.dialogue().querySelector('[data-erreur]');
  assert.equal(erreur.hidden, false);
  assert.match(erreur.textContent, /rechargez la page/);
});

test('un lot figé (mise à jour en cours) fige la case', async () => {
  const p = await monter({ lot: '11111111-2222-3333-4444-555555555555' });
  assert.equal(p.caseMajeure().hasAttribute('disabled'), true);
});

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Base source (lot 8) : « Copier vers le dépôt », refus avant l'envoi, encart d'une copie ou d'un paquet reporté
// ---------------------------------------------------------------------------------------------------------------------------------------------
const soumettre = (d) => d.querySelector('form').dispatchEvent(new Event('submit', { cancelable: true }));
const copier = (p) => p.zone.querySelector('[data-nv-copier]');

test('sans base source, la page est celle d’avant : ni bouton « Copier vers le dépôt », ni phrase', async () => {
  for (const baseSource of [false, null]) {
    const p = await monter({ baseSource });
    assert.equal(copier(p), null);
    assert.equal(p.zone.querySelector('[data-nv-copie-aide]'), null);
    assert.doesNotMatch(p.zone.textContent, /Copier vers le dépôt/);
    assert.ok(p.zone.querySelector('[data-nv-simuler]') && p.zone.querySelector('[data-nv-lancer]'));
  }
});

test('avec une base source : le bouton est à côté des deux autres, avec sa phrase ; un lancement en cours le grise', async () => {
  const p = await monter({ baseSource: true });
  const bouton = copier(p);
  assert.ok(bouton, 'le bouton');
  assert.equal(bouton.textContent, 'Copier vers le dépôt');
  assert.equal(bouton.parentNode, p.zone.querySelector('[data-nv-lancer]').parentNode, 'à côté de « Effectuer la mise à jour »');
  assert.equal(bouton.hasAttribute('disabled'), false);
  assert.match(p.zone.querySelector('[data-nv-copie-aide]').textContent, /Refait les pages du site de dev avec le contenu du jour, sans rien livrer en production/i);
  const occupe = await monter({ baseSource: true, lot: '11111111-2222-3333-4444-555555555555' });
  assert.equal(copier(occupe).hasAttribute('disabled'), true, 'un lot figé occupe la place');
});

test('« Copier vers le dépôt » : le mot à taper est celui du service ; un autre mot n’envoie rien ; le bon envoie { confirmation } à copier/ sans version ni maintenance', async () => {
  const p = await monter({ baseSource: true });
  copier(p).dispatchEvent(new Event('click'));
  const d = p.dialogue();
  assert.ok(d?.ouvert);
  assert.match(d.textContent, /COPIER VERS LE DEPOT/);
  assert.match(d.textContent, /sans rien livrer en production/);
  d.querySelector('input').value = 'METTRE A JOUR';
  soumettre(d);
  await reponses();
  assert.deepEqual(p.ecritures(), [], 'un mauvais mot n’envoie rien');
  assert.equal(d.querySelector('[data-erreur]').hidden, false);
  assert.match(d.querySelector('[data-erreur]').textContent, /COPIER VERS LE DEPOT/);
  d.querySelector('input').value = ' COPIER VERS LE DEPOT ';
  soumettre(d);
  await reponses();
  assert.deepEqual(p.ecritures(), [{ methode: 'POST', chemin: 'mise-a-jour/copier/', corps: { confirmation: 'COPIER VERS LE DEPOT' } }]);
  assert.equal(p.dialogue(), null, 'confirmation fermée');
  assert.equal(p.service.appels.some((a) => a.chemin === 'maintenance/'), false, 'une copie ne passe pas par la maintenance');
  assert.ok(p.service.appels.filter((a) => a.chemin === 'mise-a-jour/').length >= 2, 'la page est relue');
});

test('« Annuler » dans la confirmation de la copie : rien n’est envoyé', async () => {
  const p = await monter({ baseSource: true });
  copier(p).dispatchEvent(new Event('click'));
  p.dialogue().querySelector('[value="annuler"]').dispatchEvent(new Event('click'));
  await reponses();
  assert.equal(p.dialogue(), null);
  assert.deepEqual(p.ecritures(), []);
});

test('un refus d’attestation dit le message de la production ; la Simulation le dit aussi ; une erreur sans refus garde le message du service', async () => {
  const refus = { raison: 'attestation', etat: 'pas_appliquee', raison_production: 'x', message: 'Refusé avant l’envoi : la production n’a pas appliqué sa dernière mise à jour.' };
  const p = await monter({ baseSource: true, refus });
  p.zone.querySelector('[data-nv-simuler]').dispatchEvent(new Event('click'));
  soumettre(p.dialogue());
  await reponses();
  assert.equal(p.dialogue().querySelector('[data-erreur]').textContent, refus.message);
  // sans `refus` lisible, le message du service est dit tel quel
  const q = await monter({ baseSource: true, refus: { raison: 'autre' } });
  copier(q).dispatchEvent(new Event('click'));
  q.dialogue().querySelector('input').value = 'COPIER VERS LE DEPOT';
  soumettre(q.dialogue());
  await reponses();
  assert.match(q.dialogue().querySelector('[data-erreur]').textContent, /message du service/);
});

test('l’encart d’une copie dit « Dernière copie » sans version cible, et sa fin ne parle pas de livraison', async () => {
  const p = await monter({ baseSource: true, lancement: { lot: 'c', etat: 'termine', mode: 'copie', copie: true, version_cible: null, lance_le: '2026-11-15T10:00:00Z' } });
  const encart = p.zone.querySelector('.nv-lancement');
  assert.ok(encart, 'la copie terminée reste affichée');
  assert.match(encart.textContent, /Dernière copie/);
  assert.match(encart.textContent, /2026-11-15T10:00:00Z/);
  assert.doesNotMatch(encart.textContent, /V\?|V\d|Dernier lancement/);
  assert.match(encart.textContent, /Copie terminée/);
  assert.match(encart.textContent, /Rien n’a été livré en production/);
});

test('l’encart d’une mise à jour reportée dit « reportée le … » ; une erreur de report est dite', async () => {
  const lancement = { lot: 'm', etat: 'termine', mode: 'mise-a-jour', paquet: true, version_cible: '0.4', lance_le: '2026-11-14T10:00:00Z',
    reporte_le: '2026-11-15T08:15:00Z', report: { historique: 3, integrees: 2, deja: false } };
  const p = await monter({ baseSource: true, lancement });
  const texte = p.zone.querySelector('.nv-lancement').textContent;
  assert.match(texte, /Dernier lancement \(V0\.4/);
  assert.match(texte, /reportée le 15 novembre 2026/);
  assert.match(texte, /3 traces d’historique, 2 modifications livrées/);
  const q = await monter({ baseSource: true, lancement: { ...lancement, reporte_le: null, report: undefined, erreur_report: 'base occupée' } });
  const encart = q.zone.querySelector('.nv-lancement');
  assert.match(encart.textContent, /sera reportée/);
  assert.match(encart.textContent, /report .*a échoué.*base occupée/);
  // sans base source, un lancement ordinaire garde son texte d'avant
  const r = await monter({ baseSource: false, lancement: { lot: 'o', etat: 'termine', version_cible: '0.4', lance_le: '2026-11-14T10:00:00Z' } });
  assert.match(r.zone.querySelector('.nv-lancement').textContent, /Le site de dev se met à jour de lui-même/);
});
