// L'extension de l'éditeur pour /recherche/ (src/scripts/edition/mots-cles.mjs ; demande du propriétaire : en mode modification, « supprimer / ajouter /
// Modifier des mots clés », une suppression le retirant de tout ce qui le porte), exécutée dans un faux navigateur avec un faux éditeur : la liste relue
// dans la base vivante (des pages seulement : les événements de la chronologie ont des catégories, pas de mot-clé), la liste de gestion (libellé
// modifiable, protégés sans saisie ni bouton, suppression et fusion en file), la création immédiate, les confirmations et l'ordre des opérations du lot,
// le retour à la liste de lecture ; depuis la migration 0056 (glossaire), la définition de chaque mot-clé (saisie commune, protégés compris), sa balise à
// copier et l'infobulle de sa définition dans la liste de lecture. Puis, de bout en bout contre le vrai service (serveur/api.mjs sur une copie de la base) : renommages en rotation, en
// chaîne, noms échangés, fusions en chaîne — le lot que la page envoie est accepté, ou refusé avant toute question.
//   node --test test/edition-mots-cles.test.mjs
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { traiter } from '../serveur/api.mjs';
import { ouvrirBaseVivante, preparerBaseVivante } from '../serveur/base-vivante.mjs';
import { cheminBase } from '../src/lib/donnees.mjs';
import { cleDeLigne, lireAttributEd } from '../src/lib/edition-modele.mjs';
import { normalize } from '../src/lib/text.mjs';
import { attendre, cliquer, el, Element, fauxDocument } from './aide-faux-dom.mjs';

// GET /api/edition/mots-cles/ : [{ id, libelle, libelle_cle, description, pages, protege }] (description : NULL tant qu'il n'est pas décrit)
const v = (id, libelle, pages = 0, protege = null, description = null) => ({ id, libelle, libelle_cle: normalize(libelle), description, pages, protege });
const VIVANT = [
  v('aide', 'aide', 3),
  v('feu', 'Feu', 2, null, 'Ce qui brûle.'),
  v('guide', 'guide', 5),
  v('magique', 'Magique', 12, 'range les classes dans la colonne « Magiques » de /classes/'),
  v('peuple', 'peuple', 1),
];

let numero = 0;
/**
 * La page /recherche/ (la liste construite : un mot-clé), un faux éditeur, et l'extension chargée à neuf. `service` : les appels vont au vrai service
 * (sinon, un faux qui connaît VIVANT).
 */
async function monter({ confirmations = [], service = null } = {}) {
  const liste = el('ul', { id: 'liste-mots-cles', class: 'tags' },
    el('li', { 'data-id': 'aide', 'data-cle': 'aide', 'data-n': '3', 'data-libelle': 'aide' }, el('a', { href: '/recherche/?mot-cle=aide' })));
  const document = fauxDocument(el('div', { 'data-recherche': '', 'data-lien-mot-cle': '/recherche/?mot-cle=' }, el('section', { id: 'mots-cles' }, liste)));
  const evenements = [];
  document.addEventListener('recherche:mots-cles', (e) => evenements.push(e.detail));
  const questions = [];
  Object.assign(globalThis, {
    document,
    CSS: { escape: (s) => s },
    Option: class extends Element {
      constructor(texte, valeur) {
        super('option', { value: valeur });
        this.textContent = texte;
      }
    },
    confirm: (q) => {
      questions.push(q);
      return confirmations.length ? confirmations.shift() : true;
    },
  });
  let vivant = VIVANT.map((m) => ({ ...m }));
  const appels = [];
  const formulaires = [];
  const editeurs = new Map();
  const ed = {
    page: 'recherche/',
    lignes: new Map(),
    enEdition: false,
    annonces: [],
    annoncer(message, genre) { this.annonces.push([message, genre]); },
    marquerModifie() {},
    async appel(methode, chemin, corps) {
      appels.push([methode, chemin, corps]);
      if (service) {
        const r = traiter({ methode, chemin: `/api/${chemin}`, entetes: { 'content-type': 'application/json' }, corps: corps && JSON.stringify(corps) }, service);
        if (r.statut !== 200) throw Object.assign(new Error(r.corps?.erreur ?? `HTTP ${r.statut}`), { statut: r.statut, corps: r.corps });
        return r.corps;
      }
      if (chemin === 'edition/mots-cles/') return { motsCles: vivant.map((m) => ({ ...m })) };
      const op = corps.operations[0];
      const ligne = { id: normalize(op.valeurs.libelle), libelle: op.valeurs.libelle, libelle_cle: normalize(op.valeurs.libelle) };
      vivant = [...vivant, { ...ligne, pages: 0, protege: null }];
      return { lignes: [{ table: 'mot_cle', cle: { id: ligne.id }, ligne }] };
    },
    // comme editeur.mjs#monterChamps : une saisie sur chaque [data-ed] dont la ligne est chargée
    monterChamps(portee) {
      for (const champ of portee.querySelectorAll('[data-ed]')) {
        if (editeurs.has(champ)) continue;
        const info = lireAttributEd(champ.dataset.ed);
        const ligne = ed.lignes.get(cleDeLigne(info.table, info.cle));
        if (!ligne) continue;
        const controle = el('textarea', { class: 'ed-saisie' });
        controle.value = ligne[info.colonne] ?? '';
        editeurs.set(champ, { info, original: String(ligne[info.colonne] ?? ''), controle, ligne });
        champ.replaceChildren(controle);
      }
    },
    formulaire(f) { formulaires.push(f); },
  };
  const { motsCles } = await import(`../src/scripts/edition/mots-cles.mjs?page=${(numero += 1)}`);
  const saisieDe = (id, colonne) => [...editeurs].find(([c, e]) => c.closest('li').dataset.id === id && e.info.colonne === colonne)?.[1];
  return { motsCles, ed, document, liste, evenements, questions, appels, formulaires, editeurs, saisie: (id) => saisieDe(id, 'libelle'), definition: (id) => saisieDe(id, 'description') };
}

const ligne = (liste, id) => liste.querySelector(`li[data-id="${id}"]`);
const bouton = (li, classe) => li.querySelector(`.${classe}`);

test('au chargement : la liste relue dans la base vivante (nombre de pages, ordre), rien d’autre que le vocabulaire', async () => {
  const p = await monter();
  assert.equal(p.motsCles.actif(p.document), true);
  await p.motsCles.surcouche(p.ed, []);
  assert.deepEqual(p.liste.children.map((li) => li.dataset.id), ['aide', 'feu', 'guide', 'magique', 'peuple']);
  const feu = ligne(p.liste, 'feu');
  assert.deepEqual([feu.dataset.cle, feu.dataset.n, feu.dataset.libelle], ['feu', '2', 'Feu']);
  assert.equal(feu.children[0].href, '/recherche/?mot-cle=feu');
  assert.equal(feu.children[0].textContent, 'Feu (2)');
  // le glossaire : la définition dans la ligne, et l'infobulle de la pastille (sa bulle : mots-cles-vivants.mjs) ; un mot-clé sans définition n'en a pas
  assert.equal(feu.dataset.definition, 'Ce qui brûle.');
  assert.equal(feu.children[0].dataset.bulle, 'mot-cle-feu');
  assert.equal(ligne(p.liste, 'aide').dataset.definition, undefined);
  assert.equal(ligne(p.liste, 'aide').children[0].dataset.bulle, undefined);
  assert.equal(p.liste.querySelector('li[data-reserve]'), null);
  assert.deepEqual(p.evenements, [{ gestion: false }], 'la page relit la liste');
});

test('au crayon : la liste de gestion ; un mot-clé protégé n’a ni saisie ni bouton, sa raison est écrite ; « + Ajouter » crée tout de suite', async () => {
  const p = await monter();
  await p.motsCles.surcouche(p.ed, []);
  p.ed.enEdition = true;
  p.motsCles.debut(p.ed);
  await attendre();
  assert.ok(p.liste.hasAttribute('data-gestion') && p.liste.classList.contains('ed-mots-cles'));
  assert.deepEqual(p.liste.children.map((li) => li.dataset.id), ['aide', 'feu', 'guide', 'magique', 'peuple']);
  assert.deepEqual(p.evenements.at(-1), { gestion: true });
  const feu = ligne(p.liste, 'feu');
  assert.equal(feu.querySelector('.ed-mot-cle__compte').textContent, '2 pages');
  assert.equal(bouton(feu, 'ed-mot-cle__supprimer').title, 'Le retirer de toutes les pages qui le portent, puis du vocabulaire (à l’enregistrement)');
  assert.deepEqual(lireAttributEd(feu.querySelector('[data-ed]').dataset.ed), lireAttributEd(JSON.stringify(['mot_cle', { id: 'feu' }, 'libelle'])));
  assert.equal(p.saisie('feu').controle.value, 'Feu', 'la saisie part de la base vivante');
  assert.equal(feu.querySelector('.ed-mot-cle__balise').textContent, '{{feu}}', 'la balise à copier');
  assert.equal(p.definition('feu').controle.value, 'Ce qui brûle.', 'la définition, saisie commune');
  assert.equal(p.definition('aide').controle.value, '', 'pas encore décrit');
  const magique = ligne(p.liste, 'magique');
  assert.equal(magique.querySelector('.ed-mot-cle__nom').hasAttribute('data-ed'), false, 'protégé : pas de saisie du libellé');
  assert.ok(p.definition('magique'), 'protégé : sa définition se modifie');
  assert.equal(magique.querySelector('button'), null, 'protégé : pas de bouton');
  assert.equal(magique.querySelector('.ed-mot-cle__protege').textContent, 'Protégé : il range les classes dans la colonne « Magiques » de /classes/ (sa définition se modifie).');
  // création immédiate, à sa place dans la liste
  const ajouter = p.document.querySelector('.ed-outils-mots-cles').querySelector('button');
  assert.equal(ajouter.textContent, '+ Ajouter un mot-clé');
  cliquer(ajouter);
  assert.doesNotMatch(p.formulaires[0].aide, /événement/, 'un mot-clé ne se pose plus sur un événement');
  assert.deepEqual(p.formulaires[0].champs.map((c) => c.nom), ['libelle', 'description'], 'créé avec sa définition');
  await p.formulaires[0].valider({ libelle: 'Bestiaire', description: '' });
  assert.deepEqual(p.appels.at(-1), ['POST', 'edition/', { page: 'recherche/', operations: [{ op: 'creer', entite: 'mot_cle', valeurs: { libelle: 'Bestiaire', description: '' } }] }]);
  assert.deepEqual(p.liste.children.map((li) => li.dataset.id), ['aide', 'bestiaire', 'feu', 'guide', 'magique', 'peuple']);
  assert.ok(ligne(p.liste, 'bestiaire').classList.contains('ed-nouveau'));
  assert.equal(p.saisie('bestiaire').controle.value, 'Bestiaire');
});

test('suppression et fusion en file, confirmées une fois avec ce qu’elles retirent ; un renommage vers l’écriture d’un autre devient une fusion', async () => {
  const p = await monter();
  await p.motsCles.surcouche(p.ed, []);
  p.ed.enEdition = true;
  p.motsCles.debut(p.ed);
  await attendre();
  // « aide » : supprimé (bascule) ; « peuple » : fusionné dans « guide » par la petite boîte
  const aide = ligne(p.liste, 'aide');
  cliquer(bouton(aide, 'ed-mot-cle__supprimer'));
  assert.ok(aide.classList.contains('ed-supprime'));
  assert.equal(bouton(aide, 'ed-mot-cle__supprimer').textContent, 'Sera supprimé — annuler');
  assert.equal(bouton(aide, 'ed-mot-cle__fusionner').disabled, true);
  cliquer(bouton(ligne(p.liste, 'peuple'), 'ed-mot-cle__fusionner'));
  const boite = p.document.body.querySelector('dialog');
  assert.deepEqual(boite.querySelector('datalist').children.map((o) => o.getAttribute('value')), ['Feu', 'guide'], 'ni lui-même, ni un protégé, ni un mot-clé supprimé');
  boite.querySelector('input').value = 'Magique';
  boite.querySelector('form').dispatchEvent(new Event('submit', { cancelable: true }));
  assert.equal(boite.querySelector('.ed-erreur').hidden, false, 'un protégé ne se choisit pas');
  boite.querySelector('input').value = 'GUIDE';
  boite.querySelector('form').dispatchEvent(new Event('submit', { cancelable: true }));
  assert.equal(p.document.body.querySelector('dialog'), null, 'la boîte se ferme');
  assert.equal(bouton(ligne(p.liste, 'peuple'), 'ed-mot-cle__fusionner').textContent, 'Sera fusionné dans « guide » — annuler');
  // « guide » reçoit une fusion : il ne se supprime pas
  cliquer(bouton(ligne(p.liste, 'guide'), 'ed-mot-cle__supprimer'));
  assert.equal(p.ed.annonces.at(-1)[1], 'erreur');
  assert.ok(!ligne(p.liste, 'guide').classList.contains('ed-supprime'));
  // « Feu » renommé « Guide » : la fusion est proposée, acceptée ; puis la confirmation des retraits
  p.saisie('feu').controle.value = 'Guide';
  assert.equal(p.motsCles.verifier(p.ed, p.editeurs), null);
  assert.equal(p.questions.length, 2);
  assert.match(p.questions[0], /^« Guide » s’écrit comme « guide » : fusionner « Feu » dans « guide » \?\nSes pages \(2 pages\) porteront « guide »/);
  assert.match(p.questions[1], /« aide » sera retiré de 3 pages et des textes qui le citent \(sa balise y devient son texte\), puis supprimé\./);
  assert.match(p.questions[1], /« peuple » sera fusionné dans « guide » : ses pages \(1 page\) et les textes qui le citent/);
  assert.ok(p.questions.every((q) => !/événement/.test(q)), 'plus d’événement dans les confirmations');
  const renommages = [{ op: 'modifier', table: 'mot_cle', cle: { id: 'feu' }, valeurs: { libelle: 'Guide' }, avant: { libelle: 'Feu' } }];
  assert.deepEqual(p.motsCles.operations(p.ed, renommages, p.editeurs), [
    { op: 'fusionner_mots_cles', mot_cle: 'peuple', dans: 'guide' },
    { op: 'fusionner_mots_cles', mot_cle: 'feu', dans: 'guide' },
    { op: 'supprimer', entite: 'mot_cle', cle: { id: 'aide' } },
  ]);
  // en sortant : la liste de lecture, la file vidée
  p.ed.enEdition = false;
  p.motsCles.fin(p.ed);
  await attendre();
  assert.ok(!p.liste.hasAttribute('data-gestion'));
  assert.deepEqual(p.liste.children.map((li) => li.dataset.id), ['aide', 'feu', 'guide', 'magique', 'peuple']);
  assert.equal(p.liste.children[0].children[0].textContent, 'aide (3)', 'la liste de lecture');
  assert.equal(p.document.querySelector('.ed-outils-mots-cles'), null);
  assert.deepEqual(p.motsCles.operations(p.ed, []), [], 'plus rien en file');
});

test('refus : renommage vers l’écriture d’un autre sans accepter la fusion ; confirmation des retraits annulée', async () => {
  const p = await monter({ confirmations: [false] });
  await p.motsCles.surcouche(p.ed, []);
  p.ed.enEdition = true;
  p.motsCles.debut(p.ed);
  await attendre();
  p.saisie('feu').controle.value = 'aide';
  assert.match(p.motsCles.verifier(p.ed, p.editeurs), /^Non enregistré : « aide » s’écrit comme le mot-clé « aide »/);
  p.saisie('feu').controle.value = 'Magique';
  assert.match(p.motsCles.verifier(p.ed, p.editeurs), /dont le site se sert/, 'jamais fusionné dans un mot-clé protégé');
  p.saisie('feu').controle.value = 'Feu';
  cliquer(bouton(ligne(p.liste, 'aide'), 'ed-mot-cle__supprimer'));
  globalThis.confirm = () => false;
  assert.equal(p.motsCles.verifier(p.ed, p.editeurs), 'Enregistrement annulé : rien n’a été envoyé.');
});

// --- De bout en bout, contre le vrai service ----------------------------------------------------------------------------------------------------
// Le service (serveur/edition-chronologie.mjs) refuse un renommage vers une écriture encore prise (409) et une fusion ou une suppression d'un mot-clé déjà
// parti (404) : le lot que la page envoie doit libérer chaque écriture avant de la donner. Une copie de la base par test ; des mots-clés créés pour
// l'essai, à des noms absents de la base (les essais du site de dev peuvent l'avoir modifiée).
const racine = mkdtempSync(join(tmpdir(), 'maverick-edition-mots-cles-'));
after(() => rmSync(racine, { recursive: true, force: true }));
let copies = 0;

/** Le service sur une copie neuve de la base, la page montée dessus en mode modification, et des mots-clés d'essai créés ({ nom: libellé }). */
async function surLeService(noms, options = {}) {
  const db = ouvrirBaseVivante(preparerBaseVivante({ regles: cheminBase(), dossier: join(racine, `b${(copies += 1)}`) }).chemin);
  const service = { base: () => db, etat: () => ({}), edition: true };
  const libre = (base) => {
    let t = base;
    for (let i = 2; db.prepare('SELECT 1 FROM mot_cle WHERE libelle_cle = ?').get(normalize(t)); i += 1) t = `${base} ${i}`;
    return t;
  };
  const mots = {};
  for (const [cle, base] of Object.entries(noms)) {
    const libelle = libre(base);
    const r = traiter({ methode: 'POST', chemin: '/api/edition/', entetes: { 'content-type': 'application/json' }, corps: JSON.stringify({ page: 'recherche/', operations: [{ op: 'creer', entite: 'mot_cle', valeurs: { libelle } }] }) }, service);
    assert.equal(r.statut, 200, JSON.stringify(r.corps));
    mots[cle] = { id: r.corps.crees[0].id, libelle };
  }
  const p = await monter({ ...options, service });
  await p.motsCles.surcouche(p.ed, []);
  p.ed.enEdition = true;
  p.motsCles.debut(p.ed);
  await attendre();
  assert.ok(p.liste.hasAttribute('data-gestion'));
  /** Comme editeur.mjs#enregistrer : verifier, puis les opérations des saisies changées passées par l'extension, puis l'envoi. */
  const enregistrer = async () => {
    const probleme = p.motsCles.verifier(p.ed, p.editeurs);
    if (probleme) return { probleme };
    const champs = [...p.editeurs.values()].filter((e) => e.controle.value !== e.original)
      .map((e) => ({ op: 'modifier', table: e.info.table, cle: e.info.cle, valeurs: { [e.info.colonne]: e.controle.value }, avant: { [e.info.colonne]: e.original } }));
    const operations = p.motsCles.operations(p.ed, champs, p.editeurs);
    try {
      return { operations, reponse: await p.ed.appel('POST', 'edition/', { page: 'recherche/', operations }) };
    } catch (e) {
      return { operations, refus: e };
    }
  };
  const motCle = (id) => db.prepare('SELECT id, libelle FROM mot_cle WHERE id = ?').get(id);
  return { ...p, db, service, mots, enregistrer, motCle: (id) => (motCle(id) ? { ...motCle(id) } : null) };
}

test('service : rotation de noms (« A » prend un nom libre, « B » l’ancien nom de « A ») — aucune fusion proposée, le lot passe', async () => {
  // « B » est plus haut que « A » dans la liste : la page doit quand même renommer « A » d'abord
  const s = await surLeService({ A: 'Essai rotation zz', B: 'Essai rotation aa' });
  const nouveau = `${s.mots.A.libelle} bis`;
  s.saisie(s.mots.A.id).controle.value = nouveau;
  s.saisie(s.mots.B.id).controle.value = s.mots.A.libelle;
  const r = await s.enregistrer();
  assert.equal(r.probleme, undefined, r.probleme);
  assert.deepEqual(s.questions, [], 'aucune fusion proposée : l’écriture de « A » est libérée par le lot');
  assert.equal(r.refus, undefined, r.refus?.message);
  assert.deepEqual(s.motCle(s.mots.A.id), { id: s.mots.A.id, libelle: nouveau });
  assert.deepEqual(s.motCle(s.mots.B.id), { id: s.mots.B.id, libelle: s.mots.A.libelle });
});

test('service : renommages en chaîne (« A » prend le nom de « B », « B » celui de « C ») — « B » fusionné dans « C », puis « A » renommé', async () => {
  const s = await surLeService({ A: 'Essai chaine zz', B: 'Essai chaine aa', C: 'Essai chaine mm' });
  s.saisie(s.mots.A.id).controle.value = s.mots.B.libelle;
  s.saisie(s.mots.B.id).controle.value = s.mots.C.libelle;
  const r = await s.enregistrer();
  assert.equal(r.probleme, undefined, r.probleme);
  assert.equal(s.questions.length, 1, 'une seule fusion proposée : « B » dans « C »');
  assert.match(s.questions[0], new RegExp(`fusionner « ${s.mots.B.libelle} » dans « ${s.mots.C.libelle} »`));
  assert.equal(r.refus, undefined, r.refus?.message);
  assert.equal(s.motCle(s.mots.B.id), null, '« B » fusionné');
  assert.deepEqual(s.motCle(s.mots.A.id), { id: s.mots.A.id, libelle: s.mots.B.libelle });
  assert.deepEqual(s.motCle(s.mots.C.id), { id: s.mots.C.id, libelle: s.mots.C.libelle });
});

test('service : noms échangés (A ↔ B) — refusés avant toute question, rien n’est envoyé ; le service les aurait refusés', async () => {
  const s = await surLeService({ A: 'Essai echange zz', B: 'Essai echange aa' });
  s.saisie(s.mots.A.id).controle.value = s.mots.B.libelle;
  s.saisie(s.mots.B.id).controle.value = s.mots.A.libelle;
  const envois = s.appels.length;
  const r = await s.enregistrer();
  assert.match(r.probleme, /s’échangent leurs noms.*Enregistrez d’abord « .+ » sous un nom provisoire/);
  assert.deepEqual(s.questions, [], 'aucune question posée');
  assert.equal(s.appels.length, envois, 'rien n’est envoyé');
  // le même lot, envoyé tel quel : refusé par le service, dans un ordre comme dans l'autre
  for (const ordre of [[s.mots.A, s.mots.B], [s.mots.B, s.mots.A]]) {
    const [x, y] = ordre;
    const operations = [
      { op: 'modifier', table: 'mot_cle', cle: { id: x.id }, valeurs: { libelle: y.libelle }, avant: { libelle: x.libelle } },
      { op: 'modifier', table: 'mot_cle', cle: { id: y.id }, valeurs: { libelle: x.libelle }, avant: { libelle: y.libelle } },
    ];
    await assert.rejects(s.ed.appel('POST', 'edition/', { page: 'recherche/', operations }), (e) => e.statut === 409);
  }
});

test('service : fusions en chaîne mises en file à rebours (« X » dans « Y », puis « A » dans « X ») — jouées dans l’ordre, le lot passe', async () => {
  const s = await surLeService({ A: 'Essai fusion aa', X: 'Essai fusion mm', Y: 'Essai fusion zz' });
  const { A, X, Y } = s.mots;
  // la page ne permet pas cette file (« X » déjà en file n'est plus une cible) : le lot est fabriqué ici, puis rangé par l'extension
  const { operationsDuVocabulaire } = await import('../src/lib/mots-cles-edition.mjs');
  const operations = operationsDuVocabulaire([], { fusions: new Map([[X.id, Y.id], [A.id, X.id]]) });
  assert.deepEqual(operations.map((o) => o.mot_cle), [A.id, X.id]);
  await s.ed.appel('POST', 'edition/', { page: 'recherche/', operations });
  assert.equal(s.motCle(A.id), null);
  assert.equal(s.motCle(X.id), null);
  assert.deepEqual(s.motCle(Y.id), { id: Y.id, libelle: Y.libelle });
  // à rebours, le service l'aurait refusé : « X » parti avant de recevoir « A »
  const s2 = await surLeService({ A: 'Essai fusion aa', X: 'Essai fusion mm', Y: 'Essai fusion zz' });
  const rebours = [{ op: 'fusionner_mots_cles', mot_cle: s2.mots.X.id, dans: s2.mots.Y.id }, { op: 'fusionner_mots_cles', mot_cle: s2.mots.A.id, dans: s2.mots.X.id }];
  await assert.rejects(s2.ed.appel('POST', 'edition/', { page: 'recherche/', operations: rebours }), (e) => e.statut === 404);
});

test('service : un mot-clé qui reçoit une fusion n’est pas supprimé dans le même lot — la page l’empêche dans les deux ordres', async () => {
  const s = await surLeService({ A: 'Essai cible aa', X: 'Essai cible mm' });
  const { A, X } = s.mots;
  const ligneDe = (id) => s.liste.querySelector(`li[data-id="${id}"]`);
  // « X » supprimé d'abord : il n'est plus une cible de fusion
  cliquer(bouton(ligneDe(X.id), 'ed-mot-cle__supprimer'));
  cliquer(bouton(ligneDe(A.id), 'ed-mot-cle__fusionner'));
  let boite = s.document.body.querySelector('dialog');
  boite.querySelector('input').value = X.libelle;
  boite.querySelector('form').dispatchEvent(new Event('submit', { cancelable: true }));
  assert.equal(boite.querySelector('.ed-erreur').hidden, false, '« X » supprimé n’est pas proposé');
  boite.close();
  assert.deepEqual(s.motsCles.operations(s.ed, []).map((o) => o.op), ['supprimer'], 'la file : la suppression seule');
  // « A » fusionné dans « X » d'abord : « X » ne se supprime plus
  cliquer(bouton(ligneDe(X.id), 'ed-mot-cle__supprimer')); // annule la suppression
  cliquer(bouton(ligneDe(A.id), 'ed-mot-cle__fusionner'));
  boite = s.document.body.querySelector('dialog');
  boite.querySelector('input').value = X.libelle;
  boite.querySelector('form').dispatchEvent(new Event('submit', { cancelable: true }));
  cliquer(bouton(ligneDe(X.id), 'ed-mot-cle__supprimer'));
  assert.equal(s.ed.annonces.at(-1)[1], 'erreur');
  assert.match(s.ed.annonces.at(-1)[0], /annulez cette fusion avant de le supprimer/);
  const r = await s.enregistrer();
  assert.equal(r.refus, undefined, r.refus?.message);
  assert.deepEqual(r.operations, [{ op: 'fusionner_mots_cles', mot_cle: A.id, dans: X.id }]);
  assert.equal(s.motCle(A.id), null);
  assert.deepEqual(s.motCle(X.id), { id: X.id, libelle: X.libelle });
});
