// La section « Activation » de la page Mise à jour du site de dev : où en est la bascule 2 (`bascule_2` de GET /api/mise-a-jour/), en lecture seule.
// Le choix de l'affichage (lib/notes-de-version-rendu.mjs#affichageDeLaBascule2) : cinq interrupteurs à trois états (allumé, éteint, inconnu : jamais deviné,
// avec sa phrase), l'accord de la production jamais « éteint », le dernier résultat d'activation ou « aucune activation connue ». Puis le script en faux
// navigateur : la section existe seulement avec `bascule_2`, ne porte aucun bouton ni lien, et pose tout par textContent. Les phrases ne sont pas figées :
// on vérifie la structure et les états.
//   node --test test/mise-a-jour-bascule-2.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { INTERRUPTEURS_DE_LA_BASCULE_2, affichageDeLaBascule2 } from '../src/lib/notes-de-version-rendu.mjs';
import { attendre, el, fauxDocument } from './aide-faux-dom.mjs';

const CLES = ['gel_des_fusions', 'actif', 'db_bascule_2', 'atelier_servir', 'activation_par_paquet'];
const ETATS_DU_SERVICE = ['en_cours', 'passee', 'refusee', 'retour_automatique', 'retour_incomplet'];

/** Une réponse `bascule_2` : tout éteint, sauf ce que `change` remplace. */
const bascule = (change = {}, activation = null) => ({
  interrupteurs: {
    gel_des_fusions: { etat: false, raison: null, phrase: null, lu_le: '2026-11-19T10:00:00.000Z' },
    actif: { etat: false, raison: null, phrase: null, lu_le: '2026-11-19T10:00:00.000Z' },
    db_bascule_2: { etat: false, raison: null, phrase: null },
    atelier_servir: { etat: false, raison: null, phrase: null },
    activation_par_paquet: { etat: null, raison: 'aucune_activation', phrase: 'Pas encore vu.' },
    ...change,
  },
  activation,
});
const rapport = (surcharge = {}) => ({ etat: 'passee', le: '2026-11-20T10:00:00Z', version: '0.4', depuis: '0.3', lot: 'a', mode: 'paquet', raisons: [], pages: 3, duree_s: 40, gel_leve: true, phrase: 'Terminée.', geste: null, perime: false, ...surcharge });
const interrupteur = (a, cle) => a.interrupteurs.find((i) => i.cle === cle);

test('les cinq interrupteurs sont listés dans l’ordre, chacun avec son nom en clair et son nom technique', () => {
  const a = affichageDeLaBascule2(bascule());
  assert.deepEqual(a.interrupteurs.map((i) => i.cle), CLES);
  assert.deepEqual(INTERRUPTEURS_DE_LA_BASCULE_2.map((i) => i.cle), CLES);
  for (const i of a.interrupteurs) {
    assert.ok(i.nom && i.technique, i.cle);
    assert.notEqual(i.nom, i.technique, `${i.cle} : un nom en clair, pas seulement le nom technique`);
  }
  assert.equal(new Set(a.interrupteurs.map((i) => i.technique)).size, 5);
});

test('trois états : true allumé, false éteint, null inconnu avec la phrase du service', () => {
  const a = affichageDeLaBascule2(bascule({
    gel_des_fusions: { etat: true, raison: null, phrase: null, lu_le: '2026-11-19T10:00:00.000Z' },
    actif: { etat: null, raison: 'pas_encore_lu', phrase: 'Pas encore lu sur GitHub.', lu_le: null },
  }));
  assert.equal(interrupteur(a, 'gel_des_fusions').etat, 'allume');
  assert.equal(interrupteur(a, 'db_bascule_2').etat, 'eteint');
  const inconnu = interrupteur(a, 'actif');
  assert.equal(inconnu.etat, 'inconnu');
  assert.equal(inconnu.phrase, 'Pas encore lu sur GitHub.');
  assert.equal(inconnu.date, '', 'pas de date quand l’état est inconnu');
  assert.equal(new Set(['allume', 'eteint', 'inconnu'].map((e) => a.interrupteurs.find((i) => i.etat === e)?.mot)).size, 3, 'trois mots distincts');
  // seul l'état inconnu porte une phrase
  assert.equal(interrupteur(a, 'gel_des_fusions').phrase, '');
});

test('la date utile suit l’interrupteur : lu_le, depuis, vu_le ; une date illisible ne casse rien', () => {
  const a = affichageDeLaBascule2(bascule({
    atelier_servir: { etat: true, raison: null, phrase: null, depuis: '2026-11-18T08:00:00Z' },
    activation_par_paquet: { etat: true, raison: null, phrase: null, vu_le: '2026-11-20T10:00:00Z' },
    actif: { etat: true, raison: null, phrase: null, lu_le: 'pas une date' },
  }));
  assert.match(interrupteur(a, 'gel_des_fusions').date, /19/);
  assert.match(interrupteur(a, 'atelier_servir').date, /18/);
  assert.match(interrupteur(a, 'activation_par_paquet').date, /20/);
  assert.equal(interrupteur(a, 'actif').date, '');
  assert.equal(interrupteur(a, 'db_bascule_2').date, '', 'le marqueur n’a pas de date');
});

test('l’accord de la production n’est jamais éteint : vu posé, ou inconnu, même si la réponse dit false', () => {
  const vu = interrupteur(affichageDeLaBascule2(bascule({ activation_par_paquet: { etat: true, raison: null, phrase: null, vu_le: '2026-11-20T10:00:00Z' } })), 'activation_par_paquet');
  assert.equal(vu.etat, 'allume');
  assert.notEqual(vu.mot, interrupteur(affichageDeLaBascule2(bascule({ gel_des_fusions: { etat: true } })), 'gel_des_fusions').mot, 'un mot honnête, pas « allumé »');
  assert.match(vu.date, /20/);
  const inconnu = interrupteur(affichageDeLaBascule2(bascule()), 'activation_par_paquet');
  assert.equal(inconnu.etat, 'inconnu');
  assert.equal(inconnu.phrase, 'Pas encore vu.');
  for (const brut of [{ etat: false }, { etat: false, phrase: 'x' }, {}, null, 'x']) {
    const i = interrupteur(affichageDeLaBascule2(bascule({ activation_par_paquet: brut })), 'activation_par_paquet');
    assert.notEqual(i.etat, 'eteint', JSON.stringify(brut));
  }
});

test('activation : aucune connue, présente, périmée, chaque état du rapport', () => {
  for (const sans of [null, undefined, {}, { etat: 'inventé' }, 'x']) {
    const a = affichageDeLaBascule2({ ...bascule(), activation: sans }).activation;
    assert.equal(a.aucune, true, JSON.stringify(sans));
    assert.ok(a.texte);
  }
  const passee = affichageDeLaBascule2(bascule({}, rapport())).activation;
  assert.equal(passee.aucune, false);
  assert.equal(passee.etat, 'passee');
  assert.equal(passee.attention, false);
  assert.equal(passee.perime, false);
  for (const morceau of ['0.4', '2026', 'Terminée.']) assert.ok(passee.texte.includes(morceau), morceau);
  // un geste est dit quand il est présent, et lui seul
  const avecGeste = affichageDeLaBascule2(bascule({}, rapport({ etat: 'retour_incomplet', geste: 'Relancer le retour à la main.' }))).activation;
  assert.ok(avecGeste.texte.includes('Relancer le retour à la main.'));
  assert.equal(avecGeste.attention, true);
  assert.ok(!passee.texte.includes('Relancer'));
  // périmée : le rapport en cours que root n'a pas fini ; le mot « périmée » apparaît, et seulement alors
  const perimee = affichageDeLaBascule2(bascule({}, rapport({ etat: 'en_cours', perime: true }))).activation;
  assert.equal(perimee.perime, true);
  assert.ok(perimee.texte.includes('périmée'));
  assert.ok(!passee.texte.includes('périmée'));
  // les cinq états du service se lisent, avec un mot chacun
  const mots = ETATS_DU_SERVICE.map((etat) => affichageDeLaBascule2(bascule({}, rapport({ etat }))).activation);
  assert.ok(mots.every((m, i) => m.aucune === false && m.etat === ETATS_DU_SERVICE[i]));
  assert.equal(new Set(mots.map((m) => m.mot)).size, 5);
  assert.deepEqual(mots.map((m) => m.attention), [false, false, true, true, true]);
});

test('une réponse sans bascule_2 ne montre rien ; des interrupteurs absents ou mal formés restent cinq lignes inconnues', () => {
  for (const v of [undefined, null, 'x', 3]) assert.equal(affichageDeLaBascule2(v), null, JSON.stringify(v));
  for (const mauvais of [undefined, null, 'x', []]) {
    const a = affichageDeLaBascule2({ interrupteurs: mauvais, activation: null });
    assert.deepEqual(a.interrupteurs.map((i) => i.etat), Array(5).fill('inconnu'));
  }
});

// ----- le script de la page, en faux navigateur -----

let numero = 0;

/** Un faux service : l'état, la note (avec ou sans `bascule_2`) ; les lots de changements répondent 404 (section cachée). */
function fauxService(donnees) {
  return async (adresse) => {
    const chemin = String(adresse).replace(/^\/api\//, '');
    const json = (statut, corps) => new Response(JSON.stringify(corps), { status: statut, headers: { 'Content-Type': 'application/json' } });
    if (chemin === 'etat/') return json(200, { edition: true });
    if (chemin === 'maintenance/') return json(200, { active: false });
    if (chemin === 'mise-a-jour/') {
      return json(200, { reference: { disponible: true, version: '0.3.0' }, version_dev: '0.3.70', version_cible: '0.4', version_mineure: '0.4', version_majeure: '1.0',
        en_attente: 0, brouillon: { texte: '', modifie_le: null, lot: null, majeure: false }, lignes: [], bilan: { total: 0 }, lancement: null, liberable: false, occupe: false,
        github: { configure: true }, confirmation: 'X', ...donnees });
    }
    return json(404, { erreur: 'inconnue' });
  };
}

async function monter(donnees) {
  const document = fauxDocument(el('main', {}, el('div', { class: 'mise-a-jour', 'data-mise-a-jour': '', 'data-api': '/api/', 'data-maintenance': '/maintenance/' },
    el('section', { class: 'nv-dev', 'data-nv-dev': '', hidden: '' }), el('section', { class: 'nv-production', 'data-nv-production': '' }))));
  Object.assign(globalThis, { document, fetch: fauxService(donnees), alert() {}, window: { confirm: () => true } });
  await import(`../src/scripts/mise-a-jour.mjs?bascule2=${(numero += 1)}`);
  for (let i = 0; i < 50 && document.querySelector('[data-nv-dev]').hidden; i += 1) await attendre();
  const zone = document.querySelector('[data-nv-dev]');
  assert.equal(zone.hidden, false, 'la note du site de dev est affichée');
  return { zone, section: zone.querySelector('[data-nv-bascule-2]') };
}

test('sans bascule_2 (production, ancien service) : aucune section', async () => {
  const { zone, section } = await monter({});
  assert.equal(section, null);
  assert.equal(zone.querySelectorAll('[data-nv-bascule-2]').length, 0);
});

test('avec bascule_2 : une section en lecture seule, cinq lignes dont l’état se lit, le dernier résultat dessous, aucun bouton ni lien', async () => {
  const { zone, section } = await monter({ bascule_2: bascule({ gel_des_fusions: { etat: true, raison: null, phrase: null, lu_le: '2026-11-19T10:00:00.000Z' } }, rapport({ etat: 'refusee' })) });
  assert.ok(section, 'la section est là');
  assert.ok(zone.contains(section));
  assert.equal(section.querySelector('h3')?.textContent.length > 0, true, 'un titre');
  const lignes = section.querySelectorAll('[data-interrupteur]');
  assert.deepEqual(lignes.map((l) => l.getAttribute('data-interrupteur')), CLES);
  const etats = Object.fromEntries(lignes.map((l) => [l.getAttribute('data-interrupteur'), l.className]));
  assert.match(etats.gel_des_fusions, /--allume/);
  assert.match(etats.db_bascule_2, /--eteint/);
  assert.match(etats.activation_par_paquet, /--inconnu/);
  for (const l of lignes) assert.ok(l.textContent.includes(INTERRUPTEURS_DE_LA_BASCULE_2.find((i) => i.cle === l.getAttribute('data-interrupteur')).technique), 'nom technique dit');
  assert.ok(lignes.at(-1).textContent.includes('Pas encore vu.'), 'la phrase d’un état inconnu est dite');
  assert.equal(section.querySelector('[data-activation]').getAttribute('data-activation'), 'refusee');
  // lecture seule : rien à cliquer
  for (const balise of ['button', 'a', 'input', 'select', 'textarea', 'form']) assert.equal(section.querySelectorAll(balise).length, 0, `aucun ${balise}`);
  // près de l'état de la production, avant la note
  assert.equal(zone.querySelector('[data-nv-production]').nextElementSibling, section);
});

test('sans rapport : « aucune activation connue » ; une valeur du service n’est jamais lue comme du HTML', async () => {
  const piege = '<img src=x onerror=alert(1)>';
  const { section } = await monter({ bascule_2: bascule({ actif: { etat: null, raison: 'sans_jeton', phrase: piege, lu_le: null } }, null) });
  assert.equal(section.querySelector('[data-activation]').getAttribute('data-activation'), 'aucune');
  assert.equal(section.querySelectorAll('img').length, 0);
  assert.ok(section.textContent.includes(piege), 'le texte est posé tel quel, par textContent');
});
