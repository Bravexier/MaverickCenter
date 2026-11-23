// Les modifications de l'équipe sur la page « Mise à jour » du site de dev (src/scripts/mise-a-jour.mjs, rendu lib/lots-rendu.mjs ; R291 : « Juste un bout "annuler
// cette modification" sur chaque ligne du patchnote » ; propositions encore en attente : R275, question 4 a), le script exécuté dans un faux navigateur contre un
// faux service : la section avant les conflits, les lignes d'un changement appliqué avec « Annuler cette modification » (l'aperçu d'abord, la confirmation, rien
// n'est envoyé avant elle, le corps du clic, le 409 dit sous la ligne), les propositions en attente (aperçu, décisions à ouvrir, confirmation, « Refuser »,
// « Refaire l'essai »), « Tout recalculer », l'alerte des retraits (R292), et rien en production ni sans le service. Aucun texte figé : la structure et les données.
//   node --test test/mise-a-jour-lots.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as rendu from '../src/lib/lots-rendu.mjs';
import { attendre, cliquer, el, Element, fauxDocument } from './aide-faux-dom.mjs';

const NOTE = { version_cible: '0.4', reference: { disponible: true, version: '0.3.70' }, lignes: [], brouillon: { texte: '' }, lancement: null, occupe: false, liberable: false, confirmation: 'MAJ', en_conflit: { lots: 0, modifications: 0 } };
const fini = async () => {
  for (let i = 0; i < 10; i += 1) await attendre();
};

const colonne = (libelle, avant, apres) => ({ colonne: `c_${libelle}`, libelle, avant, apres });
const operation = (rang, etat, plus = {}) => ({ rang, table: 'metier', cle: { id: rang }, operation: 'modifier', apercu: { table: 'Métiers', ligne: `Ligne ${rang}`, colonnes: [colonne('Description', `avant ${rang}`, `après ${rang}`)] }, etat, ...plus });
const essai = (verdict, operations, plus = {}) => ({ format: 1, verdict, verrous_a_ouvrir: [], operations, problemes_nouveaux: [], numeros: [], comptes: { applicables: operations.length, changees: 0, verrouillees: 0, refusees: 0 }, ...plus });
const lot = (id, plus = {}) => ({
  id, depose_le: '2026-11-14T10:00:00Z', titre: `Lot ${id}`, nature: 'decision', decision: 'R275', auteur: 'une session', etat: 'propose', decide_le: null, lot_id: null, annule_le: null,
  operations: 1, verdict: 'applicable', essai: essai('applicable', [operation(1, 'applicable')]), bilan: null, verrous_ouverts: null, contenu: { operations: [] }, ...plus,
});
const resume = ({ essai: _e, bilan: _b, contenu: _c, verrous_ouverts: _v, lignes: _l, lignes_indisponibles: _i, ...reste }) => reste;
const ligne = (n, plus = {}) => ({
  n, table: 'Métiers', ligne: `Ligne ${n}`, genre: 'modifier', colonnes: [colonne('Description', `avant ${n}`, `après ${n}`)],
  etat: 'en_place', annulable_seule: true, motif: null, depend_de: [], ...plus,
});
/** Un changement appliqué aussitôt (clé de dépôt), avec ses lignes. */
const direct = (id, lignes, plus = {}) => lot(id, { etat: 'applique', decide_le: '2026-11-14T12:00:00Z', lot_id: `L-${id}`, application: { directe: true, par: 'cle_de_depot' }, essai: null, lignes, ...plus });

/**
 * La page construite, le faux service (`routes` : « METHODE chemin » → réponse, ou fonction du corps ; `[statut, corps]` pour une erreur), le script chargé.
 * `etat` : l'état courant des lots que le service rend (la liste et le détail en dérivent).
 */
let numero = 0;
async function monter(lots, extra = {}) {
  const etat = { lots: [...lots] };
  const racine = el('div', { class: 'mise-a-jour', 'data-mise-a-jour': '', 'data-api': '/api/', 'data-maintenance': '/maintenance/' },
    el('section', { class: 'nv-dev', 'data-nv-dev': '', hidden: '' }), el('section', { class: 'nv-production', 'data-nv-production': '' }));
  const envois = [];
  const routes = {
    'GET etat/': { edition: true },
    'GET mise-a-jour/': NOTE,
    'GET edition/lots/': () => ({ lots: etat.lots.map(resume) }),
    ...extra,
  };
  Object.assign(globalThis, {
    document: fauxDocument(el('main', {}, racine)),
    Element,
    alert: () => {},
    fetch: async (url, options = {}) => {
      const cle = `${options.method ?? 'GET'} ${url.replace('/api/', '')}`;
      const corps = options.body ? JSON.parse(options.body) : undefined;
      envois.push([cle, corps]);
      let r = routes[cle];
      if (!r) {
        const detail = cle.match(/^GET edition\/lots\/([^/]+)\/$/);
        if (detail && etat.lots.some((l) => l.id === detail[1])) r = etat.lots.find((l) => l.id === detail[1]);
      }
      if (typeof r === 'function') r = r(corps, etat);
      if (!r) return { ok: false, status: 404, json: async () => ({ erreur: 'inconnue' }) };
      const [statut, contenu] = Array.isArray(r) ? r : [200, r];
      return { ok: statut < 400, status: statut, json: async () => contenu };
    },
  });
  await import(`../src/scripts/mise-a-jour.mjs?page=${(numero += 1)}`);
  await fini();
  const section = () => racine.querySelector('[data-nv-lots]');
  const article = (id) => [...section().querySelectorAll('[data-nv-lot-id]')].find((a) => a.dataset.nvLotId === id);
  const clic = async (cible) => {
    cliquer(cible, section());
    await fini();
  };
  const dialogue = () => racine.querySelector('dialog');
  const confirmer = async () => {
    dialogue().querySelector('form').dispatchEvent(new Event('submit', { cancelable: true }));
    await fini();
  };
  const ecritures = () => envois.filter(([k]) => k.startsWith('POST'));
  /** Coche ou décoche une case (l'évènement `change` remonte jusqu'à la section : délégation). */
  const cocher = (caseACocher, valeur) => {
    caseACocher.checked = valeur;
    const e = new Event('change', { cancelable: true });
    Object.defineProperty(e, 'target', { value: caseACocher });
    section().dispatchEvent(e);
  };
  return { racine, etat, envois, section, article, clic, dialogue, confirmer, ecritures, cocher };
}

test('après les listes de la note en préparation et avant les conflits, la section des modifications ; le détail est lu pour les propositions en attente et les appliqués en écart avec la production', async () => {
  const page = await monter([lot('a'), lot('b', { etat: 'refuse' }), direct('c', [ligne(1)]), { ...direct('l', [ligne(1)]), ecart_production: false }]);
  const dev = page.racine.querySelector('[data-nv-dev]');
  const s = page.section();
  assert.ok(s && !s.hidden, 'la section');
  assert.equal(s.parentElement, dev);
  assert.ok(dev.children.indexOf(dev.querySelector('.nv-dev__liste')) < dev.children.indexOf(s), 'après les listes');
  assert.ok(dev.children.indexOf(s) < dev.children.indexOf(dev.querySelector('[data-nv-conflits]')), 'avant les conflits');
  assert.deepEqual([...s.querySelectorAll('[data-nv-lots-attente] [data-nv-lot-id]')].map((a) => a.dataset.nvLotId), ['a']);
  assert.deepEqual([...s.querySelectorAll('[data-nv-lots-appliques] [data-nv-lot-id]')].map((a) => a.dataset.nvLotId), ['c']);
  for (const absent of ['b', 'l']) assert.equal(s.querySelectorAll(`[data-nv-lot-id="${absent}"]`).length, 0, `${absent} : ne change rien par rapport à la production`);
  const lus = page.envois.map(([k]) => k);
  assert.ok(lus.includes('GET edition/lots/a/') && lus.includes('GET edition/lots/c/'));
  assert.ok(!lus.includes('GET edition/lots/b/'), 'le détail d’un lot refusé n’est pas lu');
  assert.ok(!lus.includes('GET edition/lots/l/'), 'ni celui d’un lot que la production contient déjà');
  // l'aperçu avant et après du lot à décider
  assert.equal(page.article('a').querySelectorAll('.nv-lot-ligne').length, 1);
  assert.deepEqual([...page.article('a').querySelectorAll('.nv-version__texte')].map((v) => v.textContent), ['avant 1', 'après 1']);
  // les lignes du changement appliqué, avec leur bouton
  assert.equal(page.article('c').querySelectorAll('li.nv-lot-ligne').length, 1);
  assert.equal(page.article('c').querySelectorAll('button[data-nv-annuler-ligne]').length, 1);
  // aucune écriture au chargement
  assert.equal(page.ecritures().length, 0);
});

test('hors du site de dev (production) : rien ne se lit ; le service qui refuse (401, 403) ou ne connaît pas les lots (404) laisse la section cachée ; une autre erreur est dite', async () => {
  const prod = await monter([], { 'GET etat/': { edition: false } });
  assert.equal(prod.section(), null);
  assert.deepEqual(prod.envois.map(([k]) => k), ['GET etat/']);
  for (const statut of [401, 403, 404]) {
    const page = await monter([], { 'GET edition/lots/': [statut, { erreur: 'refusé' }] });
    assert.equal(page.section().hidden, true, String(statut));
    assert.equal(page.section().innerHTML, '', String(statut));
  }
  const panne = await monter([], { 'GET edition/lots/': [500, { erreur: 'la base ne répond pas' }] });
  assert.equal(panne.section().hidden, false);
  assert.ok(panne.section().textContent.includes('la base ne répond pas'));
  // le reste de la page ne change pas : la note en préparation s'affiche
  assert.equal(panne.racine.querySelector('[data-nv-dev]').hidden, false);
});

test('les décisions verrouillées : « Appliquer » inactif tant que la case n’est pas cochée ; cochée, le clic demande confirmation et envoie verrous_ouverts', async () => {
  const verrous = lot('v', { essai: essai('verrous', [operation(1, 'verrouillee', { decisions: ['R218'] })], { verrous_a_ouvrir: ['R218'] }) });
  const page = await monter([verrous], {
    'POST edition/lots/v/appliquer/': (corps, etat) => {
      etat.lots = etat.lots.map((l) => (l.id === 'v' ? { ...l, etat: 'applique', decide_le: '2026-11-14T12:00:00Z', lot_id: 'L9', bilan: { ecrites: 1, changees: 0, operations: [{ rang: 1, etat: 'ecrite' }] } } : l));
      return etat.lots[0];
    },
  });
  const bouton = () => page.article('v').querySelector('[data-nv-appliquer]');
  assert.equal(bouton().hasAttribute('disabled'), true);
  // un clic sur le bouton inactif n'ouvre rien
  await page.clic(bouton());
  assert.equal(page.dialogue(), null);
  // la case cochée : le bouton s'active, la raison disparaît ; décochée, il s'éteint
  const caseACocher = page.article('v').querySelector('[data-nv-verrou="R218"]');
  page.cocher(caseACocher, true);
  assert.equal(bouton().hasAttribute('disabled'), false);
  assert.equal(page.article('v').querySelector('[data-nv-raison]').hidden, true);
  page.cocher(caseACocher, false);
  assert.equal(bouton().hasAttribute('disabled'), true);
  page.cocher(caseACocher, true);
  // confirmation : annulée, rien n'est envoyé
  await page.clic(bouton());
  assert.ok(page.dialogue()?.ouvert, 'la confirmation');
  assert.ok(page.dialogue().textContent.includes('R218'), 'elle dit la décision ouverte');
  assert.equal(page.ecritures().length, 0, 'rien n’est envoyé avant la confirmation');
  page.dialogue().querySelector('[value="annuler"]').dispatchEvent(new Event('click'));
  await fini();
  assert.equal(page.dialogue(), null);
  assert.equal(page.ecritures().length, 0);
  // confirmée : le corps porte la décision cochée, le bilan est dit, le lot passe dans les appliqués
  await page.clic(bouton());
  await page.confirmer();
  assert.deepEqual(page.ecritures(), [['POST edition/lots/v/appliquer/', { verrous_ouverts: ['R218'] }]]);
  assert.equal(page.dialogue(), null);
  assert.ok(page.section().querySelector('[data-nv-lots-message]').textContent.includes(verrous.titre), 'le bilan nomme le lot');
  assert.equal(page.section().querySelectorAll('[data-nv-lots-attente] [data-nv-lot-id]').length, 0);
  assert.equal(page.section().querySelectorAll('[data-nv-lots-appliques] [data-nv-lot-id="v"]').length, 1);
  // la note en préparation a été relue (les nouvelles modifications comptent)
  assert.ok(page.envois.filter(([k]) => k === 'GET mise-a-jour/').length >= 2);
});

test('sans décision à ouvrir, le corps du clic est vide de décisions ; le bilan dit ce qui est gardé parce que la valeur avait changé, par le nom de la ligne', async () => {
  const simple = lot('s', { essai: essai('applicable', [operation(1, 'applicable'), operation(2, 'applicable', { apercu: { table: 'Métiers', ligne: 'Ligne gardée', colonnes: [colonne('Bonus', 'a', 'b')] } })]) });
  const page = await monter([simple], {
    'POST edition/lots/s/appliquer/': (corps, etat) => {
      etat.lots = etat.lots.map((l) => (l.id === 's' ? { ...l, etat: 'applique', decide_le: '2026-11-14T12:00:00Z', bilan: { ecrites: 1, changees: 1, operations: [{ rang: 1, etat: 'ecrite' }, { rang: 2, etat: 'changee', ecarts: [{ colonne: 'c_Bonus', attendue: 'a', actuelle: 'ZZZ' }] }] } } : l));
      return etat.lots[0];
    },
  });
  await page.clic(page.article('s').querySelector('[data-nv-appliquer]'));
  await page.confirmer();
  assert.deepEqual(page.ecritures(), [['POST edition/lots/s/appliquer/', { verrous_ouverts: [] }]]);
  const message = page.section().querySelector('[data-nv-lots-message]');
  assert.ok(message.textContent.includes('Ligne gardée') && message.textContent.includes('ZZZ'));
});

test('un 409 à l’application : le message dit la ligne à corriger, le lot est relu, rien n’est perdu', async () => {
  const l = lot('x');
  const page = await monter([l], {
    'POST edition/lots/x/appliquer/': (corps, etat) => {
      etat.lots = etat.lots.map((m) => (m.id === 'x' ? { ...m, essai: essai('a_corriger', [operation(2, 'refusee', { message: 'colonne refusée' })]) } : m));
      return [409, { erreur: 'L’essai du lot a des refus à corriger : opération 2 : colonne refusée', operations: ['opération 2 : colonne refusée'] }];
    },
  });
  await page.clic(page.article('x').querySelector('[data-nv-appliquer]'));
  await page.confirmer();
  const a = page.article('x');
  assert.ok(a, 'le lot reste proposé');
  const message = a.querySelector('[data-nv-lot-message]');
  assert.equal(message.hidden, false);
  assert.ok(message.textContent.includes('colonne refusée') && message.textContent.includes('2'));
  assert.equal(a.querySelector('[data-nv-verdict]').dataset.nvVerdict, 'a_corriger', 'le lot à jour : l’essai relu');
  assert.equal(a.querySelector('[data-nv-appliquer]').hasAttribute('disabled'), true);
});

test('« Refuser » demande confirmation, puis rien n’est écrit : le lot quitte la section ; « Refaire l’essai » remplace la phrase et l’aperçu', async () => {
  const page = await monter([lot('r'), lot('e', { essai: essai('a_corriger', [operation(1, 'refusee', { message: 'à revoir' })]) })], {
    'POST edition/lots/r/refuser/': (corps, etat) => {
      etat.lots = etat.lots.map((l) => (l.id === 'r' ? { ...l, etat: 'refuse', decide_le: '2026-11-14T12:00:00Z' } : l));
      return etat.lots[0];
    },
    'POST edition/lots/e/essai/': (corps, etat) => {
      etat.lots = etat.lots.map((l) => (l.id === 'e' ? { ...l, essai: essai('applicable', [operation(1, 'applicable')]) } : l));
      return etat.lots.find((l) => l.id === 'e');
    },
  });
  await page.clic(page.article('r').querySelector('[data-nv-refuser]'));
  assert.ok(page.dialogue()?.ouvert);
  assert.equal(page.ecritures().length, 0);
  await page.confirmer();
  assert.deepEqual(page.ecritures(), [['POST edition/lots/r/refuser/', {}]]);
  assert.equal(page.section().querySelectorAll('[data-nv-lot-id="r"]').length, 0);
  // refaire l'essai : sans confirmation (rien n'est écrit), la phrase suit le nouvel essai
  assert.equal(page.article('e').querySelector('[data-nv-verdict]').dataset.nvVerdict, 'a_corriger');
  await page.clic(page.article('e').querySelector('[data-nv-essai]'));
  assert.equal(page.dialogue(), null);
  assert.equal(page.article('e').querySelector('[data-nv-verdict]').dataset.nvVerdict, 'applicable');
  assert.equal(page.article('e').querySelector('[data-nv-appliquer]').hasAttribute('disabled'), false);
  assert.deepEqual(page.ecritures().map(([k]) => k), ['POST edition/lots/r/refuser/', 'POST edition/lots/e/essai/']);
});

test('« Annuler cette modification » : l’aperçu d’abord, la confirmation ensuite (rien n’est envoyé avant) ; « Revenir en arrière » ne change rien ; la ligne annulée est relue', async () => {
  const apercu = {
    verdict: 'applicable', verrous_a_ouvrir: [], ligne: { n: 2 }, comptes: { remises: 1, gardees: 0, deja: 0, verrouillees: 0, refusees: 0 },
    operations: [{ rang: 2, genre: 'modifier', etat: 'remise', apercu: { table: 'Métiers', ligne: 'Ligne 2', colonnes: [colonne('Description', 'maintenant', 'avant le changement')] } }],
  };
  const page = await monter([direct('z', [ligne(1), ligne(2)])], {
    'GET edition/lots/z/lignes/2/annulation/': apercu,
    'POST edition/lots/z/lignes/2/annuler/': (corps, etat) => {
      etat.lots = etat.lots.map((l) => (l.id === 'z' ? { ...l, lignes: l.lignes.map((x) => (x.n === 2 ? { ...x, etat: 'annulee', annulable_seule: false, annulee: { annule_le: '2026-11-15T09:00:00Z', lot_id: 'L2' } } : x)) } : l));
      return etat.lots[0];
    },
  });
  const boutons = () => [...page.article('z').querySelectorAll('button[data-nv-annuler-ligne]')];
  assert.equal(boutons().length, 2);
  // le clic : l'aperçu est lu, la confirmation s'ouvre avec ce que l'annulation remettrait ; rien n'est écrit
  await page.clic(boutons()[1]);
  assert.ok(page.envois.some(([k]) => k === 'GET edition/lots/z/lignes/2/annulation/'));
  assert.ok(page.dialogue()?.ouvert, 'la confirmation');
  assert.equal(page.ecritures().length, 0, 'rien n’est envoyé avant la confirmation');
  assert.deepEqual([...page.dialogue().querySelectorAll('.nv-version__texte')].map((v) => v.textContent), ['maintenant', 'avant le changement']);
  // revenir en arrière : la boîte se ferme, rien n'est envoyé
  page.dialogue().querySelector('[value="annuler"]').dispatchEvent(new Event('click'));
  await fini();
  assert.equal(page.dialogue(), null);
  assert.equal(page.ecritures().length, 0);
  // confirmer : le POST de cette ligne seule, avec la liste (vide) des décisions ouvertes ; la page est relue, la ligne n'a plus de bouton
  await page.clic(boutons()[1]);
  await page.confirmer();
  assert.deepEqual(page.ecritures(), [['POST edition/lots/z/lignes/2/annuler/', { verrous_ouverts: [] }]]);
  assert.equal(page.dialogue(), null);
  assert.ok(page.envois.filter(([k]) => k === 'GET mise-a-jour/').length >= 2, 'la note en préparation est relue');
  assert.deepEqual(boutons().map((b) => b.getAttribute('data-nv-annuler-ligne')), ['1'], 'la ligne annulée n’a plus de bouton');
  assert.equal(page.article('z').querySelector('li[data-nv-ligne="2"]').dataset.nvEtatLigne, 'annulee');
  assert.ok(page.section().querySelector('[data-nv-lots-message]').textContent.includes('Ligne 2'), 'le message nomme la ligne annulée');
});

test('« Annuler cette modification » avec une décision à ouvrir : la boîte porte la case, rien ne part tant qu’elle n’est pas cochée, puis le corps porte la décision cochée', async () => {
  const apercu = { verdict: 'verrous', verrous_a_ouvrir: ['R219'], comptes: { remises: 1 }, operations: [{ rang: 1, genre: 'modifier', etat: 'remise', apercu: { table: 'Métiers', ligne: 'Ligne 1', colonnes: [colonne('Description', 'a', 'b')] } }] };
  const page = await monter([direct('v', [ligne(1)])], {
    'GET edition/lots/v/lignes/1/annulation/': apercu,
    'POST edition/lots/v/lignes/1/annuler/': (corps, etat) => etat.lots[0],
  });
  await page.clic(page.article('v').querySelector('button[data-nv-annuler-ligne]'));
  const confirmation = () => page.dialogue().querySelector('[data-nv-confirmer-ligne]');
  assert.equal(confirmation().hasAttribute('disabled'), true);
  // une confirmation sans la case : rien ne part, la boîte reste ouverte
  await page.confirmer();
  assert.equal(page.ecritures().length, 0);
  assert.ok(page.dialogue()?.ouvert);
  const caseACocher = page.dialogue().querySelector('[data-nv-verrou="R219"]');
  const cocherDansLaBoite = (valeur) => {
    caseACocher.checked = valeur;
    const e = new Event('change', { cancelable: true });
    Object.defineProperty(e, 'target', { value: caseACocher });
    page.dialogue().dispatchEvent(e);
  };
  cocherDansLaBoite(true);
  assert.equal(confirmation().hasAttribute('disabled'), false);
  cocherDansLaBoite(false);
  assert.equal(confirmation().hasAttribute('disabled'), true);
  cocherDansLaBoite(true);
  await page.confirmer();
  assert.deepEqual(page.ecritures(), [['POST edition/lots/v/lignes/1/annuler/', { verrous_ouverts: ['R219'] }]]);
});

test('une ligne qui ne s’annule pas seule : son motif, pas de bouton, aucune lecture ni écriture ; un aperçu refusé ou un 409 se dit sous la ligne, rien n’est annulé', async () => {
  const lignes = [ligne(1, { annulable_seule: false, motif: 'Cette ligne ne s’annule pas seule : tenue par une autre.', depend_de: [2] }), ligne(2), ligne(3)];
  const page = await monter([direct('m', lignes)], {
    'GET edition/lots/m/lignes/2/annulation/': [409, { erreur: 'Refusé par le service pour l’aperçu' }],
    'GET edition/lots/m/lignes/3/annulation/': { verdict: 'applicable', verrous_a_ouvrir: [], comptes: { remises: 1 }, operations: [] },
    'POST edition/lots/m/lignes/3/annuler/': [409, { erreur: 'Ligne 3 refusée : une autre ligne du changement la tient', depend_de: [1] }],
  });
  const li = (n) => page.article('m').querySelector(`li[data-nv-ligne="${n}"]`);
  assert.equal(li(1).querySelectorAll('button').length, 0);
  assert.ok(li(1).querySelector('[data-nv-motif]').textContent.includes('ne s’annule pas seule'));
  // l'aperçu refusé : le message est sous la ligne, aucune boîte
  await page.clic(li(2).querySelector('button[data-nv-annuler-ligne]'));
  assert.equal(page.dialogue(), null);
  assert.ok(li(2).querySelector('[data-nv-ligne-message]').textContent.includes('Refusé par le service pour l’aperçu'));
  assert.equal(page.ecritures().length, 0);
  // un 409 au clic : son message sous la ligne, le changement relu, la ligne garde son bouton
  await page.clic(li(3).querySelector('button[data-nv-annuler-ligne]'));
  await page.confirmer();
  assert.equal(page.ecritures().length, 1);
  assert.ok(li(3).querySelector('[data-nv-ligne-message]').textContent.includes('une autre ligne du changement la tient'));
  assert.equal(li(3).querySelectorAll('button[data-nv-annuler-ligne]').length, 1);
  assert.equal(li(3).querySelector('[data-nv-ligne-message]').classList.contains('nv-message--erreur'), true);
});

test('R292 : une alerte avant « Effectuer la mise à jour » quand des éléments retirés sont cités par des fiches de la production ; rien si l’attestation n’est pas lue ou si rien ne bloque ; le texte venu du service ne s’exécute pas', async () => {
  const piege = '<img src=x onerror=alert(1)>';
  const retraits = (plus) => ({ 'GET mise-a-jour/': { ...NOTE, retraits_bloquants: { connu: true, attestee_le: '2026-11-17T10:00:00Z', fiches_au_moins: 3, fiches_au_plus: 4, message: 'Un message du service.', elements: [{ table: 'race', id: 'r1', nom: piege, libelle: `Race « ${piege} »`, fiches: 3 }, { table: 'magie', id: 'm1', nom: 'M', libelle: 'Magie « M »', fiches: 1 }], ...plus } } });
  const page = await monter([], retraits({}));
  const place = page.racine.querySelector('[data-nv-retraits]');
  const alerte = place.querySelector('[role="alert"]');
  assert.ok(alerte, 'l’alerte');
  assert.equal(alerte.querySelectorAll('li').length, 2, 'un élément par ligne');
  assert.ok(alerte.textContent.includes('Un message du service.') && alerte.textContent.includes('3') && alerte.textContent.includes(piege), 'le message, le nombre de fiches, le nom tel quel');
  assert.equal(alerte.querySelectorAll('img').length, 0);
  // avant le bouton qui lance
  const dev = page.racine.querySelector('[data-nv-dev]');
  assert.ok(dev.children.indexOf(place) < dev.children.indexOf(dev.querySelector('[data-nv-lancer]').parentElement), 'avant « Effectuer la mise à jour »');
  // rien : attestation non lue, aucun élément, champ absent
  for (const extra of [retraits({ connu: false }), retraits({ elements: [] }), { 'GET mise-a-jour/': NOTE }]) {
    const sans = await monter([], extra);
    assert.equal(sans.racine.querySelector('[data-nv-retraits]').children.length, 0);
  }
});

test('« Tout recalculer » : rien à recalculer est dit sans lot ; un lot déposé s’affiche parmi ceux à décider', async () => {
  let rien = true;
  const page = await monter([], {
    'POST edition/lots/recalcul/': (corps, etat) => {
      if (rien) return [200, { lot: null, recalcul: { pages_examinees: 4, ecarts: 0, pages_illisibles: [] } }];
      etat.lots = [lot('rc', { nature: 'code', decision: null, auteur: 'tout recalculer' })];
      return [201, { lot: etat.lots[0], recalcul: { pages_examinees: 4, ecarts: 1, pages_illisibles: [] } }];
    },
  });
  assert.equal(page.section().hidden, false, 'la section existe sans lot : « Tout recalculer » y est');
  await page.clic(page.section().querySelector('[data-nv-recalcul]'));
  assert.deepEqual(page.ecritures(), [['POST edition/lots/recalcul/', {}]]);
  assert.equal(page.section().querySelectorAll('[data-nv-lot-id]').length, 0);
  assert.ok(page.section().querySelector('[data-nv-lots-message]'));
  rien = false;
  await page.clic(page.section().querySelector('[data-nv-recalcul]'));
  assert.equal(page.section().querySelectorAll('[data-nv-lots-attente] [data-nv-lot-id="rc"]').length, 1);
  assert.ok(page.section().querySelector('[data-nv-lots-message]').textContent.includes('1'));
  // une erreur du service est dite
  const echec = await monter([], { 'POST edition/lots/recalcul/': [409, { erreur: 'trop de pages pour un lot' }] });
  await echec.clic(echec.section().querySelector('[data-nv-recalcul]'));
  assert.ok(echec.section().querySelector('[data-nv-lots-message]').textContent.includes('trop de pages pour un lot'));
});

/** Les attentes longues du suivi ne s'écoulent qu'à la demande (`ecouler`) ; les autres minuteries du test restent vraies. */
function horloge(t) {
  const vraie = globalThis.setTimeout;
  const attentes = [];
  globalThis.setTimeout = (f, ms, ...reste) => {
    if (ms < 1000) return vraie(f, ms, ...reste);
    attentes.push({ f, ms });
    return 0;
  };
  t.after(() => {
    globalThis.setTimeout = vraie;
  });
  return { attentes, ecouler: async () => {
    attentes.shift().f();
    await fini();
  } };
}
const ROUTE_ANCRAGE = 'edition/lots/ancrage/';
const EN_COURS = { en_cours: true, resultat: null, erreur: null };
const AU_REPOS = { en_cours: false, resultat: null, erreur: null };
const resultatDeLAncrage = (ecartees = []) => ({ lots: [], arret: null, suite: false, a_trancher: [], ecartees, comptes: {} });
const etatFini = (resultat) => ({ en_cours: false, resultat, erreur: null });
const leMessage = (page) => page.section().querySelector('[data-nv-lots-message]')?.textContent ?? '';
const lecturesDeLAncrage = (page) => page.envois.filter(([k]) => k === `GET ${ROUTE_ANCRAGE}`).length;
/** Une page dont le faux service rend `service.lecture()` à chaque lecture de l'état ; le POST répond 202. */
async function pageDeLAncrage(extra = {}) {
  const service = { lecture: () => AU_REPOS };
  const page = await monter([], { [`POST ${ROUTE_ANCRAGE}`]: () => [202, { en_cours: true }], [`GET ${ROUTE_ANCRAGE}`]: () => service.lecture(), ...extra });
  return { page, service, bouton: () => page.section().querySelector('[data-nv-ancrage]'), reprendre: () => page.section().querySelector('[data-nv-ancrage-reprendre]') };
}

test('« Préparer l’ancrage » (R309) : le clic lance, la page relit l’état toutes les 5 s, une lecture après l’autre, tolère une panne passagère, puis dit le résultat', async (t) => {
  const h = horloge(t);
  const { page, service, bouton, reprendre } = await pageDeLAncrage();
  assert.equal(reprendre(), null, 'rien à reprendre tant que l’action n’a rien dit');
  const avant = lecturesDeLAncrage(page);
  await page.clic(bouton());
  assert.deepEqual(page.ecritures(), [[`POST ${ROUTE_ANCRAGE}`, {}]]);
  assert.deepEqual(h.attentes.map((a) => a.ms), [5000], 'la première lecture attend 5 s');
  assert.equal(lecturesDeLAncrage(page), avant);

  // le service met du temps à répondre : aucune autre lecture ne part en attendant
  const lente = Promise.withResolvers();
  service.lecture = () => [200, lente.promise];
  await h.ecouler();
  assert.equal(lecturesDeLAncrage(page), avant + 1);
  assert.equal(h.attentes.length, 0, 'pas de nouvelle attente tant que la lecture n’a pas répondu');
  lente.resolve(EN_COURS);
  await fini();
  assert.equal(h.attentes.length, 1);

  // une panne réseau, puis une erreur du mandataire : le suivi continue
  service.lecture = () => {
    throw new TypeError('réseau coupé');
  };
  await h.ecouler();
  service.lecture = () => [502, { erreur: 'mandataire' }];
  await h.ecouler();
  assert.equal(h.attentes.length, 1, 'le suivi continue après une erreur passagère');

  const relectures = page.envois.filter(([k]) => k === 'GET edition/lots/').length;
  service.lecture = () => etatFini(resultatDeLAncrage(['page:races/zephyrion']));
  await h.ecouler();
  assert.equal(h.attentes.length, 0, 'fini : plus de lecture');
  assert.ok(leMessage(page).includes('races/zephyrion'));
  assert.ok(page.envois.filter(([k]) => k === 'GET edition/lots/').length > relectures, 'la page est relue');

  // le bouton « Reprendre » ne vient qu'avec des lignes écartées, et lui seul demande de les reprendre
  await page.clic(reprendre());
  assert.deepEqual(page.ecritures().at(-1), [`POST ${ROUTE_ANCRAGE}`, { reprendre: true }]);
  service.lecture = () => etatFini(resultatDeLAncrage());
  await h.ecouler();
  assert.equal(reprendre(), null, 'plus rien à reprendre');
});

test('« Préparer l’ancrage » : l’erreur de l’action est dite ; un état vide dit que le service a redémarré ; une panne qui dure arrête le suivi ; un refus du lancement ne suit rien', async (t) => {
  const h = horloge(t);
  const { page, service, bouton } = await pageDeLAncrage();
  await page.clic(bouton());
  service.lecture = () => ({ en_cours: false, resultat: null, erreur: { statut: 500, message: 'le plan a échoué' } });
  await h.ecouler();
  assert.ok(leMessage(page).includes('le plan a échoué'));
  assert.equal(h.attentes.length, 0);

  await page.clic(bouton());
  service.lecture = () => AU_REPOS;
  await h.ecouler();
  assert.ok(rendu.MESSAGE_ANCRAGE_INTERROMPU && leMessage(page).includes(rendu.MESSAGE_ANCRAGE_INTERROMPU), leMessage(page));
  assert.equal(h.attentes.length, 0);

  await page.clic(bouton());
  service.lecture = () => {
    throw new TypeError('réseau coupé');
  };
  for (let i = 0; i < 100 && h.attentes.length; i += 1) await h.ecouler();
  assert.equal(h.attentes.length, 0, 'une panne qui dure finit par arrêter le suivi');
  assert.ok(rendu.MESSAGE_ANCRAGE_INJOIGNABLE && leMessage(page).includes(rendu.MESSAGE_ANCRAGE_INJOIGNABLE), leMessage(page));

  await page.clic(bouton());
  service.lecture = () => [403, { erreur: 'accès fermé' }];
  await h.ecouler();
  assert.equal(h.attentes.length, 0, 'un refus ne se retente pas');
  assert.ok(leMessage(page).includes('accès fermé'));

  const refuse = await pageDeLAncrage({ [`POST ${ROUTE_ANCRAGE}`]: [409, { erreur: 'déjà lancée' }] });
  await refuse.page.clic(refuse.bouton());
  assert.ok(leMessage(refuse.page).includes('déjà lancée'));
  assert.equal(h.attentes.length, 0, 'rien à suivre');
});

test('une page rechargée pendant l’action reprend le suivi ; quand rien ne tourne, elle n’affiche rien de plus', async (t) => {
  const h = horloge(t);
  const repos = await pageDeLAncrage();
  assert.equal(lecturesDeLAncrage(repos.page), 1);
  assert.equal(h.attentes.length, 0);
  assert.equal(leMessage(repos.page), '');

  const dejaFini = await monter([], { [`GET ${ROUTE_ANCRAGE}`]: etatFini(resultatDeLAncrage(['page:races/zephyrion'])) });
  assert.equal(h.attentes.length, 0);
  assert.equal(leMessage(dejaFini), '', 'un ancien résultat ne se répète pas au chargement');

  const absent = await monter([]); // service d'avant cette route : 404 silencieux
  assert.equal(absent.section().hidden, false);
  assert.equal(leMessage(absent), '');

  const lots401 = await monter([], { 'GET edition/lots/': [401, { erreur: 'refusé' }], [`GET ${ROUTE_ANCRAGE}`]: EN_COURS });
  assert.equal(lecturesDeLAncrage(lots401), 0, 'les lots ne se lisent pas : l’état non plus');

  let etat = EN_COURS;
  const reprise = await monter([], { [`GET ${ROUTE_ANCRAGE}`]: () => etat, [`POST ${ROUTE_ANCRAGE}`]: () => [202, { en_cours: true }] });
  assert.equal(h.attentes.length, 1, 'le suivi a repris');
  assert.notEqual(leMessage(reprise), '');
  await reprise.clic(reprise.section().querySelector('[data-nv-ancrage]'));
  assert.deepEqual(reprise.ecritures(), [], 'pas de second lancement pendant le suivi');
  etat = etatFini(resultatDeLAncrage(['page:races/zephyrion']));
  await h.ecouler();
  assert.equal(h.attentes.length, 0);
  assert.ok(leMessage(reprise).includes('races/zephyrion'));
  await reprise.clic(reprise.section().querySelector('[data-nv-ancrage]'));
  assert.equal(reprise.ecritures().length, 1, 'le suivi fini, le bouton remarche');
});

test('le HTML venu de la base ne s’exécute pas dans la page ; « Voir la page de production » cache la section, la décocher la remet', async () => {
  const piege = '<img src=x onerror=alert(1)>';
  const page = await monter([lot('p', { titre: piege })]);
  assert.equal(page.section().querySelectorAll('img').length, 0);
  assert.ok(page.section().textContent.includes(piege));
  const bouton = page.racine.querySelector('[data-nv-voir-prod]');
  bouton.checked = true;
  bouton.dispatchEvent(new Event('change'));
  assert.equal(page.section().hidden, true);
  bouton.checked = false;
  bouton.dispatchEvent(new Event('change'));
  assert.equal(page.section().hidden, false);
  assert.equal(page.article('p') !== undefined, true);
});

test('un échec de relecture de la page après un clic réussi ne se dit pas comme un refus du lot : le message du clic reste, l’échec s’y ajoute', async () => {
  let panne = false;
  const page = await monter([lot('s')], {
    'GET mise-a-jour/': () => (panne ? [500, { erreur: 'relecture impossible' }] : NOTE),
    'POST edition/lots/s/appliquer/': (corps, etat) => {
      etat.lots = etat.lots.map((l) => (l.id === 's' ? { ...l, etat: 'applique', decide_le: '2026-11-14T12:00:00Z', bilan: { ecrites: 1, changees: 0, operations: [{ rang: 1, etat: 'ecrite' }] } } : l));
      panne = true;
      return etat.lots[0];
    },
  });
  await page.clic(page.article('s').querySelector('[data-nv-appliquer]'));
  await page.confirmer();
  const message = page.section().querySelector('[data-nv-lots-message]');
  assert.ok(message.textContent.includes('Lot s'), 'le bilan du clic reste');
  assert.ok(message.textContent.includes('relecture impossible'), 'l’échec de la relecture est ajouté');
  assert.equal(message.classList.contains('nv-message--erreur'), false, 'ce n’est pas un refus du lot');
  assert.equal(page.section().querySelectorAll('[data-nv-lot-message].nv-message--erreur').length, 0);
});

test('R309 : le détail d’un changement d’ancrage se lit à l’ouverture de son repli, une seule fois ; ses lignes restent branchées (annulation, « Tout montrer »), et seuls les replis ouverts sont relus après un clic', async () => {
  const lignes = Array.from({ length: 35 }, (_, i) => ligne(i + 1));
  const apercu = { verdict: 'applicable', verrous_a_ouvrir: [], ligne: { n: 2 }, comptes: { remises: 1, gardees: 0, deja: 0, verrouillees: 0, refusees: 0 }, operations: [] };
  let liberer;
  const attente = new Promise((r) => { liberer = r; });
  const page = await monter([
    direct('anc', lignes, { decision: 'R309', titre: 'Ancrage d’essai', lignes_nettes: 36, lignes_annulees: 1 }),
    direct('aut', [ligne(1)], { decision: 'R309', titre: 'Autre ancrage', lignes_nettes: 7, lignes_annulees: 0 }),
    direct('ord', [ligne(1)], { decision: 'R275', titre: 'Changement ordinaire' }),
  ], {
    'GET edition/lots/anc/': async (_corps, etat) => {
      await attente;
      return etat.lots.find((l) => l.id === 'anc');
    },
    'GET edition/lots/anc/lignes/2/annulation/': apercu,
    'POST edition/lots/anc/lignes/2/annuler/': (corps, etat) => {
      etat.lots = etat.lots.map((l) => (l.id === 'anc' ? { ...l, lignes: l.lignes.map((x) => (x.n === 2 ? { ...x, etat: 'annulee', annulable_seule: false, annulee: { annule_le: '2026-11-15T09:00:00Z', lot_id: 'L2' } } : x)) } : l));
      return etat.lots.find((l) => l.id === 'anc');
    },
  });
  const lectures = (id) => page.envois.filter(([k]) => k === `GET edition/lots/${id}/`).length;
  const repli = (id) => page.article(id).querySelector('details.nv-lot__repli');
  const compte = (id) => repli(id).querySelector('.nv-lot__compte').textContent;
  const ouvrir = (id, oui = true) => {
    repli(id).open = oui;
    const e = new Event('toggle');
    Object.defineProperty(e, 'target', { value: repli(id) });
    page.section().dispatchEvent(e);
  };
  // au chargement : aucune lecture du détail d'un changement d'ancrage replié ; le nombre vient de la liste (36 lignes nettes moins 1 annulée) ; l'autre changement est lu
  assert.equal(lectures('anc'), 0);
  assert.equal(lectures('aut'), 0);
  assert.equal(lectures('ord'), 1, 'un changement ordinaire se lit comme avant');
  assert.equal(compte('anc'), '35 lignes');
  assert.equal(compte('aut'), '7 lignes');
  assert.equal(repli('anc').querySelectorAll('li.nv-lot-ligne, [data-nv-bilan-indisponible]').length, 0);
  // l'ouverture : « Lecture des lignes… » dans le repli, une seule requête même ouvert deux fois de suite
  ouvrir('anc');
  await fini();
  ouvrir('anc');
  await fini();
  assert.equal(lectures('anc'), 1);
  assert.match(repli('anc').querySelector('[data-nv-lecture]').textContent, /Lecture des lignes/);
  assert.equal(repli('anc').hasAttribute('open'), true);
  liberer();
  await fini();
  assert.equal(lectures('anc'), 1);
  assert.equal(repli('anc').querySelectorAll('li.nv-lot-ligne').length, 30, 'les trente premières lignes');
  assert.equal(repli('anc').querySelectorAll('[data-nv-lecture]').length, 0);
  assert.equal(compte('anc'), '35 lignes', 'le nombre exact des lignes en écart, une fois le détail lu');
  // fermer puis rouvrir ne relit pas, et le rendu qui repose le repli ouvert (le navigateur refait `toggle`) non plus
  ouvrir('anc', false);
  ouvrir('anc');
  ouvrir('anc');
  await fini();
  assert.equal(lectures('anc'), 1);
  assert.equal(repli('anc').querySelectorAll('li.nv-lot-ligne').length, 30);
  // « Annuler cette modification » d'une ligne du repli : l'aperçu, la confirmation, le POST de cette ligne seule
  await page.clic(repli('anc').querySelector('button[data-nv-annuler-ligne="2"]'));
  assert.ok(page.dialogue()?.ouvert, 'la confirmation');
  assert.equal(page.ecritures().length, 0, 'rien n’est envoyé avant la confirmation');
  await page.confirmer();
  assert.deepEqual(page.ecritures(), [['POST edition/lots/anc/lignes/2/annuler/', { verrous_ouverts: [] }]]);
  assert.equal(repli('anc').querySelector('li[data-nv-ligne="2"]').dataset.nvEtatLigne, 'annulee');
  assert.equal(repli('anc').hasAttribute('open'), true, 'le repli ouvert le reste');
  // après le clic : seul le repli ouvert est relu ; l'autre changement d'ancrage jamais ouvert ne l'est pas
  assert.equal(lectures('anc'), 2, 'le repli ouvert est relu');
  assert.equal(lectures('aut'), 0, 'un repli fermé ne se lit pas');
  // « Tout montrer » : les cinq dernières lignes s'ajoutent, annulables elles aussi, sans nouvelle lecture
  await page.clic(repli('anc').querySelector('button[data-nv-toutes="anc:lignes"]'));
  assert.equal(repli('anc').querySelectorAll('li.nv-lot-ligne').length, 35);
  assert.equal(repli('anc').querySelectorAll('li[data-nv-ligne="35"] button[data-nv-annuler-ligne]').length, 1);
  assert.equal(lectures('anc'), 2);
  // un repli lu puis fermé : la liste relue (« Actualiser ») ne le relit pas, il oublie ses lignes (états et boutons périmés) et son titre reprend le nombre de la liste ;
  // sa réouverture relit une fois et montre l'état neuf ; l'autre changement d'ancrage, jamais ouvert, n'a rien lu
  ouvrir('anc', false);
  page.etat.lots = page.etat.lots.map((l) => (l.id === 'anc' ? { ...l, lignes_nettes: 30, lignes_annulees: 4, lignes: l.lignes.slice(0, 30).map((x) => (x.n === 5 ? { ...x, etat: 'annulee', annulable_seule: false } : x)) } : l));
  await page.clic(page.section().querySelector('button[data-nv-lots-actualiser]'));
  assert.equal(lectures('anc'), 2, 'la liste relue ne lit pas un repli fermé');
  assert.equal(lectures('aut'), 0);
  assert.equal(repli('anc').querySelectorAll('li.nv-lot-ligne').length, 0, 'il a oublié ses lignes');
  assert.equal(compte('anc'), '26 lignes', 'le titre reprend le nombre de la liste (30 nettes moins 4 annulées)');
  ouvrir('anc');
  await fini();
  assert.equal(lectures('anc'), 3, 'rouvert : une lecture');
  assert.equal(repli('anc').querySelectorAll('li.nv-lot-ligne').length, 30);
  assert.equal(repli('anc').querySelector('li[data-nv-ligne="5"]').dataset.nvEtatLigne, 'annulee', 'l’état neuf');
  ouvrir('anc', false);
  ouvrir('anc');
  await fini();
  assert.equal(lectures('anc'), 3, 'entre deux relectures de la liste, rouvrir ne relit pas');
});

test('R309 : une lecture du détail en échec le dit dans le repli avec « Réessayer » ; ni un rendu, ni un nouveau `toggle`, ni « Actualiser » ne la relancent, seul le bouton', async () => {
  let tentatives = 0;
  const page = await monter([direct('anc', [ligne(1), ligne(2)], { decision: 'R309', titre: 'Ancrage d’essai', lignes_nettes: 2, lignes_annulees: 0 })], {
    'GET edition/lots/anc/': (_corps, etat) => {
      tentatives += 1;
      return tentatives < 3 ? [503, { erreur: 'Service occupé' }] : etat.lots.find((l) => l.id === 'anc');
    },
  });
  const repli = () => page.article('anc').querySelector('details.nv-lot__repli');
  const ouvrir = () => {
    repli().open = true;
    const e = new Event('toggle');
    Object.defineProperty(e, 'target', { value: repli() });
    page.section().dispatchEvent(e);
  };
  assert.equal(tentatives, 0, 'rien au chargement');
  ouvrir();
  await fini();
  assert.equal(tentatives, 1);
  assert.ok(repli().querySelector('[data-nv-lecture-erreur]').textContent.includes('Service occupé'));
  assert.equal(repli().querySelectorAll('button[data-nv-relire]').length, 1);
  assert.equal(repli().querySelectorAll('[data-nv-bilan-indisponible], [data-nv-lecture]').length, 0, 'l’échec n’est pas dit « indisponible »');
  assert.equal(repli().querySelector('.nv-lot__compte').textContent, '2 lignes', 'le nombre de la liste reste');
  // le rendu repose le repli ouvert, le navigateur refait `toggle` (plusieurs fois) : aucune requête de plus ; « Actualiser » non plus
  ouvrir();
  ouvrir();
  await fini();
  await page.clic(page.section().querySelector('button[data-nv-lots-actualiser]'));
  ouvrir();
  await fini();
  assert.equal(tentatives, 1, 'pas de boucle de requêtes');
  assert.equal(repli().querySelectorAll('button[data-nv-relire]').length, 1);
  // « Réessayer » : une lecture, qui échoue encore (le message reste), puis une qui réussit
  await page.clic(repli().querySelector('button[data-nv-relire]'));
  assert.equal(tentatives, 2);
  assert.ok(repli().querySelector('[data-nv-lecture-erreur]'));
  await page.clic(repli().querySelector('button[data-nv-relire]'));
  assert.equal(tentatives, 3);
  assert.equal(repli().querySelectorAll('[data-nv-lecture-erreur], button[data-nv-relire]').length, 0);
  assert.equal(repli().querySelectorAll('li.nv-lot-ligne').length, 2);
  assert.equal(page.ecritures().length, 0);
});

test('R309 : une proposition d’ancrage dont la lecture échoue ne laisse aucun échec en mémoire : appliquée, son repli se lit normalement', async () => {
  let lectures = 0;
  const page = await monter([lot('prop', { decision: 'R309', titre: 'Ancrage proposé', lignes_nettes: 3, lignes_annulees: 0 })], {
    'GET edition/lots/prop/': (_corps, etat) => {
      lectures += 1;
      // la première lecture (la proposition, au chargement) échoue ; ensuite le changement est appliqué et se lit
      return lectures === 1 ? [503, { erreur: 'Service occupé' }] : etat.lots.find((l) => l.id === 'prop');
    },
  });
  assert.equal(lectures, 1, 'la proposition est lue au chargement, comme avant');
  assert.equal(page.section().querySelectorAll('[data-nv-lecture-erreur], button[data-nv-relire]').length, 0, 'une proposition ne dit pas d’échec de lecture du détail');
  // la proposition est appliquée (sa ligne passe à « applique ») : la page est relue, son repli est replié et se lit à l'ouverture, sans l'échec d'avant
  page.etat.lots = [direct('prop', [ligne(1), ligne(2), ligne(3)], { decision: 'R309', titre: 'Ancrage proposé', lignes_nettes: 3, lignes_annulees: 0 })];
  await page.clic(page.section().querySelector('button[data-nv-lots-actualiser]'));
  assert.equal(lectures, 1, 'le repli fermé de l’ancrage appliqué ne se lit pas à la relecture de la liste');
  const repli = () => page.article('prop').querySelector('details.nv-lot__repli');
  assert.equal(repli().querySelectorAll('[data-nv-lecture-erreur], button[data-nv-relire]').length, 0);
  repli().open = true;
  const e = new Event('toggle');
  Object.defineProperty(e, 'target', { value: repli() });
  page.section().dispatchEvent(e);
  await fini();
  assert.equal(lectures, 2, 'une lecture à l’ouverture');
  assert.equal(repli().querySelectorAll('li.nv-lot-ligne').length, 3);
  assert.equal(repli().querySelectorAll('[data-nv-lecture-erreur], button[data-nv-relire]').length, 0);
});
