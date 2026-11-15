// Les lots de changements sur la page « Mise à jour » du site de dev (src/scripts/mise-a-jour.mjs, rendu lib/lots-rendu.mjs ; R275, question 4 a : « Chaque lot
// attend votre clic sur le site de dev, avec un aperçu avant et après. »), le script exécuté dans un faux navigateur contre un faux service : la section avant
// les conflits, l'aperçu avant et après, les décisions à ouvrir (« Appliquer » inactif tant que la case n'est pas cochée), la confirmation avant d'appliquer
// (rien n'est envoyé avant elle), le corps du clic, le bilan, l'erreur 409 lisible, « Refuser », « Refaire l'essai », « Annuler ce lot » (l'aperçu d'abord, puis
// la confirmation), « Tout recalculer », et rien en production ni sans le service. Aucun texte figé : la structure et les données.
//   node --test test/mise-a-jour-lots.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
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
const resume = ({ essai: _e, bilan: _b, contenu: _c, verrous_ouverts: _v, ...reste }) => reste;

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

test('après les listes de la note en préparation et avant les conflits, la section des lots ; le détail est lu pour les lots à décider et les appliqués récents', async () => {
  const page = await monter([lot('a'), lot('b', { etat: 'refuse' }), lot('c', { etat: 'applique', decide_le: '2026-11-14T12:00:00Z', lot_id: 'L1', bilan: { ecrites: 1, changees: 0, operations: [{ rang: 1, etat: 'ecrite' }] } })]);
  const dev = page.racine.querySelector('[data-nv-dev]');
  const s = page.section();
  assert.ok(s && !s.hidden, 'la section');
  assert.equal(s.parentElement, dev);
  assert.ok(dev.children.indexOf(dev.querySelector('.nv-dev__liste')) < dev.children.indexOf(s), 'après les listes');
  assert.ok(dev.children.indexOf(s) < dev.children.indexOf(dev.querySelector('[data-nv-conflits]')), 'avant les conflits');
  assert.deepEqual([...s.querySelectorAll('[data-nv-lots-attente] [data-nv-lot-id]')].map((a) => a.dataset.nvLotId), ['a']);
  assert.deepEqual([...s.querySelectorAll('[data-nv-lots-appliques] [data-nv-lot-id]')].map((a) => a.dataset.nvLotId), ['c']);
  assert.deepEqual([...s.querySelectorAll('[data-nv-lots-historique] [data-nv-lot-id]')].map((a) => a.dataset.nvLotId), ['b']);
  const lus = page.envois.map(([k]) => k);
  assert.ok(lus.includes('GET edition/lots/a/') && lus.includes('GET edition/lots/c/'));
  assert.ok(!lus.includes('GET edition/lots/b/'), 'le détail d’un lot refusé n’est pas lu');
  // l'aperçu avant et après du lot à décider
  assert.equal(page.article('a').querySelectorAll('.nv-lot-ligne').length, 1);
  assert.deepEqual([...page.article('a').querySelectorAll('.nv-version__texte')].map((v) => v.textContent), ['avant 1', 'après 1']);
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

test('« Refuser » demande confirmation, puis rien n’est écrit : le lot passe dans l’historique ; « Refaire l’essai » remplace la phrase et l’aperçu', async () => {
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
  assert.equal(page.section().querySelectorAll('[data-nv-lots-attente] [data-nv-lot-id="r"]').length, 0);
  assert.equal(page.section().querySelectorAll('[data-nv-lots-historique] [data-nv-lot-id="r"]').length, 1);
  // refaire l'essai : sans confirmation (rien n'est écrit), la phrase suit le nouvel essai
  assert.equal(page.article('e').querySelector('[data-nv-verdict]').dataset.nvVerdict, 'a_corriger');
  await page.clic(page.article('e').querySelector('[data-nv-essai]'));
  assert.equal(page.dialogue(), null);
  assert.equal(page.article('e').querySelector('[data-nv-verdict]').dataset.nvVerdict, 'applicable');
  assert.equal(page.article('e').querySelector('[data-nv-appliquer]').hasAttribute('disabled'), false);
  assert.deepEqual(page.ecritures().map(([k]) => k), ['POST edition/lots/r/refuser/', 'POST edition/lots/e/essai/']);
});

test('« Annuler ce lot » : l’aperçu de l’annulation d’abord (rien n’est envoyé), puis la confirmation qui l’exécute ; « Renoncer » referme', async () => {
  const applique = lot('z', { etat: 'applique', decide_le: '2026-11-14T12:00:00Z', lot_id: 'L1', bilan: { ecrites: 1, changees: 0, operations: [{ rang: 1, etat: 'ecrite' }] } });
  const apercu = {
    verdict: 'verrous', verrous_a_ouvrir: ['R219'], comptes: { remises: 1, gardees: 1, deja: 0, verrouillees: 0, refusees: 0 },
    operations: [
      { rang: 1, genre: 'modifier', etat: 'remise', apercu: { table: 'Métiers', ligne: 'Remise', colonnes: [colonne('Description', 'maintenant', 'avant')] } },
      { rang: 2, genre: 'modifier', etat: 'gardee', ecarts: [{ colonne: 'c_Description', ecrite: 'écrit', avant: 'avant', trouvee: 'trouvée' }], apercu: { table: 'Métiers', ligne: 'Gardée', colonnes: [colonne('Description', 'trouvée', 'avant')] } },
    ],
  };
  const page = await monter([applique], {
    'GET edition/lots/z/annulation/': apercu,
    'POST edition/lots/z/annuler/': (corps, etat) => {
      etat.lots = etat.lots.map((l) => (l.id === 'z' ? { ...l, etat: 'annule', annule_le: '2026-11-14T13:00:00Z', bilan: { ...l.bilan, annulation: { remises: 1, gardees: 1, deja: 0, operations: [{ rang: 2, etat: 'gardee', ecarts: [{ colonne: 'c_Description', ecrite: 'écrit', avant: 'avant', trouvee: 'trouvée' }] }] } } } : l));
      return etat.lots[0];
    },
  });
  assert.equal(page.article('z').querySelectorAll('[data-nv-annulation]').length, 0);
  await page.clic(page.article('z').querySelector('[data-nv-annuler]'));
  // l'aperçu est montré ; rien n'est envoyé
  assert.ok(page.envois.some(([k]) => k === 'GET edition/lots/z/annulation/'));
  assert.equal(page.ecritures().length, 0);
  const zone = () => page.article('z').querySelector('[data-nv-annulation]');
  assert.deepEqual([...zone().querySelectorAll('li.nv-lot-ligne')].map((l) => l.dataset.nvEtatLigne), ['remise', 'gardee']);
  assert.ok(zone().textContent.includes('trouvée'));
  // « Renoncer » referme, sans rien envoyer ; on rouvre
  await page.clic(zone().querySelector('[data-nv-renoncer]'));
  assert.equal(page.article('z').querySelectorAll('[data-nv-annulation]').length, 0);
  await page.clic(page.article('z').querySelector('[data-nv-annuler]'));
  // la décision à ouvrir : la confirmation est inactive jusqu'à la case
  const confirmation = () => zone().querySelector('[data-nv-confirmer-annulation]');
  assert.equal(confirmation().hasAttribute('disabled'), true);
  await page.clic(confirmation());
  assert.equal(page.ecritures().length, 0, 'un bouton inactif ne part pas');
  const caseACocher = zone().querySelector('[data-nv-verrou="R219"]');
  page.cocher(caseACocher, true);
  assert.equal(confirmation().hasAttribute('disabled'), false);
  await page.clic(confirmation());
  assert.deepEqual(page.ecritures(), [['POST edition/lots/z/annuler/', { verrous_ouverts: ['R219'] }]]);
  // le lot passe dans l'historique, le message nomme la ligne gardée
  assert.equal(page.section().querySelectorAll('[data-nv-lots-appliques] [data-nv-lot-id="z"]').length, 0);
  assert.equal(page.section().querySelectorAll('[data-nv-lots-historique] [data-nv-lot-id="z"]').length, 1);
  const message = page.section().querySelector('[data-nv-lots-message]');
  assert.ok(message.textContent.includes('Gardée') && message.textContent.includes('trouvée'));
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
