// L'extension de l'éditeur pour le Glossaire, /regles/glossaire/ (src/scripts/edition/mots-cles.mjs ; sur /recherche/ jusqu'aux réponses du propriétaire
// du 2026-11-06, Q6 et Q7 ; demande du propriétaire : en mode modification, « supprimer / ajouter /
// Modifier des mots clés », une suppression le retirant de tout ce qui le porte), exécutée dans un faux navigateur avec un faux éditeur : la liste relue
// dans la base vivante (des pages seulement : les événements de la chronologie ont des catégories, pas de mot-clé), la liste de gestion (libellé
// modifiable, suppression et fusion en file), la création immédiate, les confirmations et l'ordre des opérations du lot, le retour à la liste de lecture ;
// depuis la migration 0056 (glossaire), la définition de chaque mot-clé (saisie commune), sa balise à copier et la ligne du Glossaire dans la liste de
// lecture ; depuis la migration 0098, son adresse et sa couleur (saisies communes, la feuille des couleurs du service réécrite) ; depuis la migration 0110
// (décisions R218, R219 (7)), un mot-clé verrouillé : un cadenas, ses champs désactivés, la raison en infobulle, ni suppression ni fusion depuis lui, mais
// une cible de fusion ; rien de tout cela hors du mode modification ; le menu des endroits qui le mentionnent, « Supprimer » pour une liste vide seulement
// (R196 (2)) ; « Forcer la suppression » pour un mot-clé mentionné, sauf verrouillé ou refus prévu par le service (R223). Puis, de bout en bout
// contre le vrai service (serveur/api.mjs sur une copie de la base) : renommages en rotation, en chaîne, noms échangés,
// fusions en chaîne, fusion dans un mot-clé verrouillé — le lot que la page envoie est accepté, ou refusé avant toute question ; l'adresse et la couleur
// enregistrées.
//   node --test test/edition-mots-cles.test.mjs
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { test } from 'node:test';
import { traiter } from '../serveur/api.mjs';
import { ouvrirBaseVivante, preparerBaseVivante } from '../serveur/base-vivante.mjs';
import { cheminBase } from '../src/lib/donnees.mjs';
import { cleDeLigne, lireAttributEd } from '../src/lib/edition-modele.mjs';
import { normalize } from '../src/lib/text.mjs';
import { htmlDeLaLigneDuGlossaire } from '../src/lib/mots-cles-balises.mjs';
import { cheminDePage } from '../src/lib/metiers.mjs';
import {
  ceQueRemplaceLeForcage, confirmationDesRetraits, endroitsDesMentions, erreurDesRetraits, forcageOffert, fusionOfferte, INFOBULLE_DU_VERROU,
  operationsDuVocabulaire, raisonSansForcage, suppressionOfferte,
} from '../src/lib/mots-cles-edition.mjs';
import { htmlDePiece } from '../src/lib/monnaies.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';
import { attendre, cliquer, el, Element, fauxDocument } from './aide-faux-dom.mjs';

// GET /api/edition/mots-cles/ : [{ id, libelle, libelle_cle, description, url, couleur, pages, verrou, mentions? }] (description : NULL tant qu'il n'est pas
// décrit ; verrou : 1 pour un mot-clé verrouillé, migration 0110 ; mentions : absentes ici, le service qui ne les donne pas laisse « Supprimer »)
const v = (id, libelle, pages = 0, verrou = 0, description = null) => ({ id, libelle, libelle_cle: normalize(libelle), description, url: null, couleur: null, pages, verrou });
const VIVANT = [
  v('aide', 'aide', 3),
  v('feu', 'Feu', 2, 0, 'Ce qui brûle.'),
  v('guide', 'guide', 5),
  v('magique', 'Magique', 12, 1),
  v('peuple', 'peuple', 1),
];

let numero = 0;
/**
 * La page /regles/glossaire/ (la liste construite : un mot-clé), un faux éditeur, et l'extension chargée à neuf. `service` : les appels vont au vrai
 * service (sinon, un faux qui connaît VIVANT et rend la feuille `CSS_DU_SERVICE`).
 */
const CSS_DU_SERVICE = '.couleur-mot-cle-essai{--couleur:#123456;--couleur-texte:#ffffff}';
async function monter({ confirmations = [], service = null, vocabulaire = VIVANT } = {}) {
  const liste = el('ul', { id: 'liste-mots-cles', class: 'glossaire-liste' },
    el('li', { 'data-id': 'aide', 'data-cle': 'aide', 'data-n': '3', 'data-libelle': 'aide' }, el('a', { href: '/recherche/?mot-cle=aide' })));
  const document = fauxDocument(el('div', { 'data-glossaire': '', 'data-lien-mot-cle': '/recherche/?mot-cle=' }, liste));
  const evenements = [];
  document.addEventListener('glossaire:mots-cles', (e) => evenements.push(e.detail));
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
  let vivant = vocabulaire.map((m) => ({ ...m }));
  const appels = [];
  const formulaires = [];
  const editeurs = new Map();
  const ed = {
    page: 'regles/glossaire/',
    base: '/',
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
      if (chemin === 'edition/mots-cles/') return { motsCles: vivant.map((m) => ({ ...m })), css: CSS_DU_SERVICE };
      const op = corps.operations[0];
      const ligne = { id: normalize(op.valeurs.libelle), libelle: op.valeurs.libelle, libelle_cle: normalize(op.valeurs.libelle) };
      vivant = [...vivant, { ...ligne, pages: 0, verrou: 0 }];
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
  return {
    motsCles, ed, document, liste, evenements, questions, appels, formulaires, editeurs, saisie: (id) => saisieDe(id, 'libelle'), definition: (id) => saisieDe(id, 'description'),
    abreviation: (id) => saisieDe(id, 'abreviation'), adresse: (id) => saisieDe(id, 'url'), couleur: (id) => saisieDe(id, 'couleur'),
  };
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
  // la ligne du Glossaire, le même HTML que la page construite (lib/mots-cles-balises.mjs#htmlDeLaLigneDuGlossaire)
  const attendue = el('ul');
  attendue.innerHTML = htmlDeLaLigneDuGlossaire({ ...VIVANT[1], n: 2 }, { base: '/', lienDesPages: '/recherche/?mot-cle=' });
  assert.equal(feu.outerHTML, attendue.children[0].outerHTML);
  assert.equal(feu.querySelector('.glossaire-mot__pages').href, '/recherche/?mot-cle=feu', 'ses pages : leur liste sur /recherche/');
  assert.equal(feu.querySelector('.glossaire-mot__pages').textContent, '2 pages');
  assert.equal(feu.querySelector('.glossaire-mot__definition').textContent, 'Ce qui brûle.', 'la définition dans la ligne');
  assert.equal(feu.dataset.definition, 'Ce qui brûle.');
  assert.equal(ligne(p.liste, 'aide').dataset.definition, undefined);
  assert.equal(ligne(p.liste, 'aide').querySelector('.glossaire-mot__definition').textContent, 'Pas encore de définition.');
  assert.equal(p.liste.querySelector('li[data-reserve]'), null);
  assert.deepEqual(p.evenements, [{ gestion: false }], 'la page relit la liste');
  // la feuille des couleurs des mots-clés, celle du service (mots-cles-vivants.mjs)
  assert.equal(p.document.querySelector('style[data-couleurs-mots-cles]')?.textContent, CSS_DU_SERVICE);
  // hors du mode modification, un mot-clé verrouillé est une ligne comme les autres (décision R219 (7))
  const magique = ligne(p.liste, 'magique');
  const lue = el('ul');
  lue.innerHTML = htmlDeLaLigneDuGlossaire({ ...VIVANT[3], n: 12 }, { base: '/', lienDesPages: '/recherche/?mot-cle=' });
  assert.equal(magique.outerHTML, lue.children[0].outerHTML, 'le même HTML que la page construite');
  assert.equal(magique.hasAttribute('data-verrou'), false);
  assert.equal(p.liste.querySelector('.ed-mot-cle__verrou'), null, 'pas de cadenas');
});

test('au crayon : la liste de gestion ; décisions R218, R219 (7) : un mot-clé verrouillé a son cadenas, ses champs désactivés, la raison en infobulle, aucun bouton ; « + Ajouter » crée tout de suite', async () => {
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
  assert.ok(bouton(feu, 'ed-mot-cle__supprimer') && bouton(feu, 'ed-mot-cle__fusionner'), 'non verrouillé : « Supprimer » et « Fusionner dans… »');
  assert.doesNotMatch(bouton(feu, 'ed-mot-cle__supprimer').title, /pages qui le portent/, 'R196 : la suppression ne retire plus rien des pages');
  assert.equal(feu.hasAttribute('data-verrou'), false);
  assert.deepEqual(lireAttributEd(feu.querySelector('[data-ed]').dataset.ed), lireAttributEd(JSON.stringify(['mot_cle', { id: 'feu' }, 'libelle'])));
  assert.equal(p.saisie('feu').controle.value, 'Feu', 'la saisie part de la base vivante');
  assert.equal(feu.querySelector('.ed-mot-cle__balise').textContent, '{{feu}}', 'la balise à copier');
  assert.equal(p.definition('feu').controle.value, 'Ce qui brûle.', 'la définition, saisie commune');
  assert.equal(p.definition('aide').controle.value, '', 'pas encore décrit');
  assert.ok(!p.saisie('feu').controle.disabled && !p.definition('feu').controle.disabled, 'non verrouillé : ses champs se modifient');
  const magique = ligne(p.liste, 'magique');
  assert.ok(magique.hasAttribute('data-verrou') && magique.classList.contains('ed-mot-cle--verrouille'), 'la ligne verrouillée est marquée');
  const cadenas = magique.querySelector('.ed-mot-cle__verrou');
  assert.ok(cadenas?.querySelector('svg'), 'un cadenas sur la ligne');
  assert.equal(cadenas.getAttribute('aria-label'), INFOBULLE_DU_VERROU);
  assert.equal(cadenas.title, INFOBULLE_DU_VERROU, 'la raison en infobulle');
  const champs = [...p.editeurs].filter(([c]) => c.closest('li') === magique);
  assert.deepEqual(champs.map(([, e]) => e.info.colonne).sort(), ['abreviation', 'couleur', 'description', 'libelle', 'url'], 'tous ses champs, montés');
  for (const [c, e] of champs) {
    assert.equal(e.controle.disabled, true, `${e.info.colonne} : désactivé`);
    assert.equal(c.title, INFOBULLE_DU_VERROU, `${e.info.colonne} : la raison en infobulle`);
  }
  assert.equal(magique.querySelector('button'), null, 'verrouillé : ni « Supprimer » ni « Fusionner dans… »');
  // création immédiate, à sa place dans la liste
  const ajouter = p.document.querySelector('.ed-outils-mots-cles').querySelector('button');
  assert.equal(ajouter.textContent, '+ Ajouter un mot-clé');
  cliquer(ajouter);
  assert.doesNotMatch(p.formulaires[0].aide, /événement/, 'un mot-clé ne se pose plus sur un événement');
  assert.deepEqual(p.formulaires[0].champs.map((c) => [c.nom, c.type]), [['libelle', 'ligne'], ['description', 'texte'], ['abreviation', 'ligne'], ['url', 'adresse'], ['couleur', 'couleur']],
    'créé avec sa définition et son abréviation (migration 0090), son adresse et sa couleur (migration 0098)');
  await p.formulaires[0].valider({ libelle: 'Bestiaire', description: '' });
  assert.ok(p.appels.some(([m, c, corps]) => m === 'POST' && c === 'edition/' && JSON.stringify(corps) === JSON.stringify({ page: 'regles/glossaire/', operations: [{ op: 'creer', entite: 'mot_cle', valeurs: { libelle: 'Bestiaire', description: '' } }] })));
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
  assert.deepEqual(boite.querySelector('datalist').children.map((o) => o.getAttribute('value')), ['Feu', 'guide', 'Magique'],
    'ni lui-même, ni un mot-clé supprimé ; un mot-clé verrouillé est une cible (R219 (4))');
  boite.querySelector('input').value = 'peuple';
  boite.querySelector('form').dispatchEvent(new Event('submit', { cancelable: true }));
  assert.equal(boite.querySelector('.ed-erreur').hidden, false, 'pas lui-même');
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
  assert.match(p.questions[1], /« aide » sera supprimé\./);
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
  assert.equal(p.liste.children[0].querySelector('.glossaire-mot__nom').textContent, 'aide', 'la liste de lecture');
  assert.equal(p.liste.children[0].querySelector('.glossaire-mot__pages').textContent, '3 pages');
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
  // vers l'écriture d'un mot-clé verrouillé : la fusion dans lui est proposée (R219 (4)), acceptée
  p.saisie('feu').controle.value = 'Magique';
  assert.equal(p.motsCles.verifier(p.ed, p.editeurs), null);
  assert.match(p.questions.at(-1), /fusionner « Feu » dans « Magique »/);
  assert.deepEqual(p.motsCles.operations(p.ed, []), [{ op: 'fusionner_mots_cles', mot_cle: 'feu', dans: 'magique' }]);
  p.saisie('feu').controle.value = 'Feu';
  cliquer(bouton(ligne(p.liste, 'aide'), 'ed-mot-cle__supprimer'));
  globalThis.confirm = () => false;
  assert.equal(p.motsCles.verifier(p.ed, p.editeurs), 'Enregistrement annulé : rien n’a été envoyé.');
});

// --- De bout en bout, contre le vrai service ----------------------------------------------------------------------------------------------------
// Le service (serveur/edition-chronologie.mjs) refuse un renommage vers une écriture encore prise (409) et une fusion ou une suppression d'un mot-clé déjà
// parti (404) : le lot que la page envoie doit libérer chaque écriture avant de la donner. Une copie de la base par test ; des mots-clés créés pour
// l'essai, à des noms absents de la base (les essais du site de dev peuvent l'avoir modifiée).
const racine = dossierTemporaire('edition-mots-cles');
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
    const r = traiter({ methode: 'POST', chemin: '/api/edition/', entetes: { 'content-type': 'application/json' }, corps: JSON.stringify({ page: 'regles/glossaire/', operations: [{ op: 'creer', entite: 'mot_cle', valeurs: { libelle } }] }) }, service);
    assert.equal(r.statut, 200, JSON.stringify(r.corps));
    mots[cle] = { id: r.corps.crees[0].id, libelle };
  }
  const p = await monter({ ...options, service });
  await p.motsCles.surcouche(p.ed, []);
  p.ed.enEdition = true;
  p.motsCles.debut(p.ed);
  await attendre();
  assert.ok(p.liste.hasAttribute('data-gestion'));
  /** Comme editeur.mjs#enregistrer : verifier, puis les opérations des saisies changées (avant : la valeur de la ligne, NULL compris, comme
   * editeur.mjs#operationsDesChamps) passées par l'extension, puis l'envoi. */
  const enregistrer = async () => {
    const probleme = p.motsCles.verifier(p.ed, p.editeurs);
    if (probleme) return { probleme };
    const champs = [...p.editeurs.values()].filter((e) => e.controle.value !== e.original)
      .map((e) => ({ op: 'modifier', table: e.info.table, cle: e.info.cle, valeurs: { [e.info.colonne]: e.controle.value }, avant: { [e.info.colonne]: e.ligne[e.info.colonne] ?? null } }));
    const operations = p.motsCles.operations(p.ed, champs, p.editeurs);
    try {
      return { operations, reponse: await p.ed.appel('POST', 'edition/', { page: 'regles/glossaire/', operations }) };
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
    await assert.rejects(s.ed.appel('POST', 'edition/', { page: 'regles/glossaire/', operations }), (e) => e.statut === 409);
  }
});

test('service : fusions en chaîne mises en file à rebours (« X » dans « Y », puis « A » dans « X ») — jouées dans l’ordre, le lot passe', async () => {
  const s = await surLeService({ A: 'Essai fusion aa', X: 'Essai fusion mm', Y: 'Essai fusion zz' });
  const { A, X, Y } = s.mots;
  // la page ne permet pas cette file (« X » déjà en file n'est plus une cible) : le lot est fabriqué ici, puis rangé par l'extension
  const { operationsDuVocabulaire } = await import('../src/lib/mots-cles-edition.mjs');
  const operations = operationsDuVocabulaire([], { fusions: new Map([[X.id, Y.id], [A.id, X.id]]) });
  assert.deepEqual(operations.map((o) => o.mot_cle), [A.id, X.id]);
  await s.ed.appel('POST', 'edition/', { page: 'regles/glossaire/', operations });
  assert.equal(s.motCle(A.id), null);
  assert.equal(s.motCle(X.id), null);
  assert.deepEqual(s.motCle(Y.id), { id: Y.id, libelle: Y.libelle });
  // à rebours, le service l'aurait refusé : « X » parti avant de recevoir « A »
  const s2 = await surLeService({ A: 'Essai fusion aa', X: 'Essai fusion mm', Y: 'Essai fusion zz' });
  const rebours = [{ op: 'fusionner_mots_cles', mot_cle: s2.mots.X.id, dans: s2.mots.Y.id }, { op: 'fusionner_mots_cles', mot_cle: s2.mots.A.id, dans: s2.mots.X.id }];
  await assert.rejects(s2.ed.appel('POST', 'edition/', { page: 'regles/glossaire/', operations: rebours }), (e) => e.statut === 404);
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

test('décision du propriétaire (2026-11-05, « Modifiable et affichée ») : l’abréviation à côté du libellé, en data-abreviation ; au crayon, saisie commune, désactivée pour un mot-clé verrouillé', async () => {
  const abreges = [...VIVANT.slice(0, 3), { ...v('magique', 'Magique', 12, 1), abreviation: 'Mag.' },
    { ...v('armure-magique', 'Armure magique', 0, 0, 'Protège des sorts.'), abreviation: 'AM' }, { ...v('ro', 'Ricken d’or', 0, 1, '1 RO = 100 RF.'), abreviation: 'RO' }];
  const p = await monter({ vocabulaire: abreges });
  await p.motsCles.surcouche(p.ed, []);
  const am = ligne(p.liste, 'armure-magique');
  assert.equal(am.querySelector('.glossaire-mot__nom').textContent, 'Armure magique');
  assert.equal(am.querySelector('.glossaire-mot__abreviation').textContent, 'AM', 'l’abréviation à côté du libellé');
  assert.equal(ligne(p.liste, 'magique').querySelector('.glossaire-mot__abreviation').textContent, 'Mag.');
  assert.equal(ligne(p.liste, 'feu').querySelector('.glossaire-mot__abreviation'), null, 'sans abréviation : rien');
  // une monnaie : « Libellé + icône » (réponse du propriétaire : R63), jamais « RO »
  const ro = ligne(p.liste, 'ro');
  assert.equal(ro.querySelector('.glossaire-mot__nom').textContent, 'Ricken d’or ', 'le libellé, puis l’icône (sans texte)');
  assert.equal(ro.querySelector('.glossaire-mot__abreviation'), null, 'aucune abréviation de monnaie visible');
  const piece = el('div');
  piece.innerHTML = htmlDePiece('RO'); // relu comme le navigateur (les entités réécrites)
  assert.equal(ro.querySelector('.glossaire-mot__nom .piece').outerHTML, piece.innerHTML, 'l’icône de lib/monnaies.mjs');
  // la définition dans la ligne : monnaies en icônes (R63), balises gardées (mots-cles-vivants.mjs les rend)
  const definition = ro.querySelector('.glossaire-mot__definition');
  assert.ok(definition.querySelector('.piece.piece--ro') && definition.querySelector('.piece.piece--rf'), 'les monnaies en icônes (R63)');
  assert.doesNotMatch(definition.textContent, /R[OF]/, 'plus d’abréviation visible');
  assert.equal(am.querySelector('.glossaire-mot__definition').innerHTML, 'Protège des sorts.');
  assert.equal(am.dataset.abreviation, 'AM', 'la page la lit (filtre par l’abréviation)');
  assert.equal(ligne(p.liste, 'feu').dataset.abreviation, undefined);
  p.ed.enEdition = true;
  p.motsCles.debut(p.ed);
  await attendre();
  const gestion = ligne(p.liste, 'armure-magique');
  assert.deepEqual(lireAttributEd(gestion.querySelector('.ed-mot-cle__abreviation').dataset.ed), lireAttributEd(JSON.stringify(['mot_cle', { id: 'armure-magique' }, 'abreviation'])));
  assert.deepEqual([...gestion.children].map((c) => c.className).slice(0, 3), ['ed-mot-cle__balise', 'ed-mot-cle__nom', 'ed-mot-cle__abreviation'], 'à côté du libellé');
  assert.equal(p.abreviation('armure-magique').controle.value, 'AM', 'la saisie part de la base vivante');
  assert.equal(p.abreviation('feu').controle.value, '', 'sans abréviation : vide');
  assert.equal(p.abreviation('magique').controle.value, 'Mag.', 'verrouillé : son abréviation montrée…');
  assert.equal(p.abreviation('magique').controle.disabled, true, '… et désactivée (R218 (3))');
  assert.equal(p.abreviation('ro').controle.disabled, true, 'une monnaie verrouillée : son abréviation ne se modifie pas');
  assert.equal(p.abreviation('armure-magique').controle.disabled, false);
  assert.match(gestion.querySelector('.ed-mot-cle__balise').title, /« \{\{AM\}\} » pour son abréviation/);
  assert.equal(p.ed.lignes.get(cleDeLigne('mot_cle', { id: 'feu' })).abreviation, null, 'NULL tel qu’enregistré');
});

test('service : l’abréviation modifiée sur le Glossaire est enregistrée, vidée elle redevient NULL ; celle d’un autre mot-clé est refusée (409) avec le message du service', async () => {
  const s = await surLeService({ A: 'Essai abrégé', B: 'Essai voisin' });
  const { A, B } = s.mots;
  const avec = async (id, valeur) => {
    s.abreviation(id).controle.value = valeur;
    const r = await s.enregistrer();
    s.abreviation(id).controle.value = s.abreviation(id).original;
    return r;
  };
  const abreviation = (id) => s.db.prepare('SELECT abreviation FROM mot_cle WHERE id = ?').get(id).abreviation;
  let r = await avec(A.id, 'ZQX');
  assert.equal(r.refus, undefined, r.refus?.message);
  assert.equal(abreviation(A.id), 'ZQX');
  // relu comme après un enregistrement (fin puis crayon) : la saisie part de la nouvelle valeur
  s.ed.enEdition = false;
  s.motsCles.fin(s.ed);
  await attendre();
  assert.equal(ligne(s.liste, A.id).querySelector('.glossaire-mot__abreviation').textContent, 'ZQX', 'la ligne relue montre l’abréviation');
  s.editeurs.clear(); // comme l'éditeur en sortant du mode modification : les saisies d'avant sont démontées
  s.ed.enEdition = true;
  s.motsCles.debut(s.ed);
  await attendre();
  r = await avec(B.id, 'zqx');
  assert.equal(r.refus?.statut, 409, 'l’abréviation d’un autre mot-clé');
  assert.equal(r.refus.corps.champ, 'abreviation');
  assert.equal(r.refus.corps.mot_cle, A.id);
  assert.equal(abreviation(B.id), null, 'rien n’est écrit');
  r = await avec(A.id, '');
  assert.equal(r.refus, undefined, r.refus?.message);
  assert.equal(abreviation(A.id), null, 'vidée : NULL');
});

test('migration 0098 : au crayon, l’adresse et la couleur de chaque mot-clé, saisies communes (désactivées pour un mot-clé verrouillé), parties de la base vivante', async () => {
  const colores = [{ ...v('elfe', 'Elfe', 4, 0, 'Un peuple.'), url: '/races/elfe/', couleur: 'race:pure' }, ...VIVANT];
  const p = await monter({ vocabulaire: colores });
  await p.motsCles.surcouche(p.ed, []);
  // la lecture : le libellé est un lien vers son adresse, la pastille porte sa couleur
  const elfe = ligne(p.liste, 'elfe');
  assert.deepEqual([elfe.dataset.url, elfe.dataset.couleur], ['/races/elfe/', 'race:pure']);
  assert.equal(elfe.querySelector('a.glossaire-mot__nom').href, '/races/elfe/');
  assert.ok(elfe.querySelector('.glossaire-mot__pastille').classList.contains('couleur-race-pure'));
  assert.equal(ligne(p.liste, 'feu').querySelector('a.glossaire-mot__nom'), null, 'sans adresse : pas de lien');
  p.ed.enEdition = true;
  p.motsCles.debut(p.ed);
  await attendre();
  const gestion = ligne(p.liste, 'elfe');
  assert.deepEqual([...gestion.children].map((c) => c.className).slice(0, 7),
    ['ed-mot-cle__balise', 'ed-mot-cle__nom', 'ed-mot-cle__abreviation', 'ed-mot-cle__compte', 'ed-mot-cle__lien', 'ed-mot-cle__couleur', 'ed-mot-cle__definition']);
  assert.deepEqual([p.adresse('elfe').controle.value, p.couleur('elfe').controle.value], ['/races/elfe/', 'race:pure'], 'la saisie part de la base vivante');
  assert.deepEqual([p.adresse('feu').controle.value, p.couleur('feu').controle.value], ['', ''], 'sans adresse ni couleur : vides');
  assert.ok(p.adresse('magique') && p.couleur('magique'), 'verrouillé : son adresse et sa couleur montrées…');
  assert.ok(p.adresse('magique').controle.disabled && p.couleur('magique').controle.disabled, '… et désactivées (R218 (3))');
  const lue = p.ed.lignes.get(cleDeLigne('mot_cle', { id: 'feu' }));
  assert.deepEqual([lue.url, lue.couleur], [null, null], 'NULL tel qu’enregistré');
  assert.deepEqual(gestion.dataset.couleur, 'race:pure');
});

test('service : l’adresse et la couleur saisies sur le Glossaire sont enregistrées (vidées : NULL) ; une couleur ou une adresse mal écrite est refusée (400, `champ`)', async () => {
  const s = await surLeService({ A: 'Essai couleur' });
  const { A } = s.mots;
  const valeurs = () => ({ ...s.db.prepare('SELECT url, couleur FROM mot_cle WHERE id = ?').get(A.id) });
  // une saisie, l'enregistrement, puis (comme l'éditeur après un enregistrement) la sortie et le retour au crayon : les saisies repartent de la base
  const avec = async (saisies) => {
    for (const [colonne, valeur] of Object.entries(saisies)) (colonne === 'url' ? s.adresse(A.id) : s.couleur(A.id)).controle.value = valeur;
    const r = await s.enregistrer();
    s.ed.enEdition = false;
    s.motsCles.fin(s.ed);
    await attendre();
    s.editeurs.clear();
    s.ed.enEdition = true;
    s.motsCles.debut(s.ed);
    await attendre();
    return r;
  };
  let r = await avec({ url: '/races/humain/', couleur: 'magie:feu' });
  assert.equal(r.refus, undefined, r.refus?.message);
  assert.deepEqual(valeurs(), { url: '/races/humain/', couleur: 'magie:feu' });
  r = await avec({ couleur: '#12AB9f' });
  assert.equal(r.refus, undefined, r.refus?.message);
  assert.equal(valeurs().couleur, '#12ab9f', 'une couleur écrite, en minuscules');
  r = await avec({ couleur: 'magie:inconnue' });
  assert.equal(r.refus?.statut, 400);
  assert.equal(r.refus.corps.champ, 'couleur');
  r = await avec({ url: 'https://example.org/' });
  assert.equal(r.refus?.statut, 400);
  assert.equal(r.refus.corps.champ, 'url');
  r = await avec({ url: '', couleur: '' });
  assert.equal(r.refus, undefined, r.refus?.message);
  assert.deepEqual(valeurs(), { url: null, couleur: null }, 'vidées : NULL');
});

// --- Décision R196 (2) : le menu des endroits qui mentionnent un mot-clé ; « Supprimer » pour une liste vide seulement ----------------------------------
// `mentions` : celles du service (lib/mentions-des-mots-cles.mjs#mentionsDesMotsCles : { table, cle, colonne, comment, page, libelle, exemple }).
const PAGE_DE_REGLE = { table: 'page_tag', cle: { page_id: 'regles/essai', ordre: 1 }, colonne: 'tag_id', comment: 'etiquette', page: { id: 'regles/essai', titre: 'Essai' }, libelle: 'Essai', exemple: false };
const MENTIONS = {
  aide: [
    PAGE_DE_REGLE,
    { ...PAGE_DE_REGLE, table: 'page', cle: { id: 'regles/essai' }, colonne: 'corps', comment: 'balise' }, // la même page, par une balise : un seul endroit
    { table: 'competence', cle: { id: 'x' }, colonne: 'description', comment: 'balise', page: null, libelle: 'Compétence › x', exemple: false },
    { ...PAGE_DE_REGLE, page: { id: 'exemples/demo', titre: 'Démo' }, libelle: 'Démo', exemple: true },
  ],
  feu: [],
  magique: [PAGE_DE_REGLE],
};
const AVEC_MENTIONS = VIVANT.map((m) => (MENTIONS[m.id] ? { ...m, mentions: MENTIONS[m.id] } : m));

test('décision R196 (2), fonctions pures : les endroits nommés une fois ; « Supprimer » ni pour un mot-clé mentionné ni pour un verrouillé (R218), « Fusionner dans… » sauf depuis un verrouillé', () => {
  assert.deepEqual(endroitsDesMentions({ mentions: MENTIONS.aide }), [
    { libelle: 'Essai', page: 'regles/essai', exemple: false },
    { libelle: 'Compétence › x', page: null, exemple: false },
    { libelle: 'Démo', page: 'exemples/demo', exemple: true },
  ]);
  assert.deepEqual(endroitsDesMentions({ mentions: [] }), []);
  assert.equal(endroitsDesMentions({}), null, 'le service ne les donne pas');
  assert.equal(suppressionOfferte({ mentions: [] }), true, 'liste vide : supprimable');
  assert.equal(suppressionOfferte({ mentions: MENTIONS.aide }), false, 'mentionné : non');
  assert.equal(suppressionOfferte({}), true, 'sans la liste, le service juge');
  assert.equal(suppressionOfferte({ verrou: 1, mentions: [] }), false, 'verrouillé : jamais, même sans mention');
  assert.equal(fusionOfferte({ verrou: 0 }), true);
  assert.equal(fusionOfferte({ verrou: 1 }), false);
  assert.equal(fusionOfferte({}), true, 'une base d’avant la migration 0110 : rien n’est verrouillé');
});

test('décision R196 (2), au crayon : chaque mot-clé a le menu de ses mentions (pages en liens), verrouillé compris ; « Supprimer » seulement pour une liste vide', async () => {
  const p = await monter({ vocabulaire: AVEC_MENTIONS });
  await p.motsCles.surcouche(p.ed, []);
  assert.equal(p.liste.querySelector('.ed-mot-cle__mentions'), null, 'hors du mode modification : pas de menu');
  p.ed.enEdition = true;
  p.motsCles.debut(p.ed);
  await attendre();
  const aide = ligne(p.liste, 'aide');
  const menu = aide.querySelector('details.ed-mot-cle__mentions');
  assert.ok(menu?.querySelector('summary'), 'un menu déroulant');
  const items = menu.querySelectorAll('li');
  assert.equal(items.length, 3, 'un endroit par page ou par texte');
  assert.equal(items[0].querySelector('a').href, `/${cheminDePage('regles/essai')}`, 'une page : un lien vers elle');
  assert.equal(items[1].querySelector('a'), null, 'un texte qu’aucune page ne montre : nommé, sans lien');
  assert.ok(items[2].hasAttribute('data-exemple'), 'une page d’exemple compte, marquée');
  assert.equal(bouton(aide, 'ed-mot-cle__supprimer'), null, 'mentionné : pas de « Supprimer »');
  assert.ok(bouton(aide, 'ed-mot-cle__fusionner'), 'mentionné : la fusion reste (elle reporte ses mentions)');
  const feu = ligne(p.liste, 'feu');
  assert.ok(feu.querySelector('details.ed-mot-cle__mentions').hasAttribute('data-vide'));
  assert.equal(feu.querySelectorAll('.ed-mot-cle__mentions li').length, 0);
  assert.ok(bouton(feu, 'ed-mot-cle__supprimer'), 'liste vide : « Supprimer »');
  const magique = ligne(p.liste, 'magique');
  assert.equal(magique.querySelectorAll('.ed-mot-cle__mentions li').length, 1, 'verrouillé : son menu des mentions aussi');
  assert.equal(magique.querySelector('button'), null);
  // un mot-clé que le service ne décrit pas (sans `mentions`) : pas de menu, « Supprimer » reste (le service juge, 409 avec `mentions`)
  assert.equal(ligne(p.liste, 'guide').querySelector('.ed-mot-cle__mentions'), null);
  assert.ok(bouton(ligne(p.liste, 'guide'), 'ed-mot-cle__supprimer'));
  // « aide » dans « feu » : la file marche sans « Supprimer » sur la ligne
  cliquer(bouton(aide, 'ed-mot-cle__fusionner'));
  const boite = p.document.body.querySelector('dialog');
  boite.querySelector('input').value = 'Feu';
  boite.querySelector('form').dispatchEvent(new Event('submit', { cancelable: true }));
  assert.ok(aide.classList.contains('ed-fusionne'));
  assert.deepEqual(p.motsCles.operations(p.ed, []), [{ op: 'fusionner_mots_cles', mot_cle: 'aide', dans: 'feu' }]);
  // un mot-clé créé : non verrouillé (R219 (5)), rien ne le mentionne
  cliquer(p.document.querySelector('.ed-outils-mots-cles').querySelector('button'));
  await p.formulaires[0].valider({ libelle: 'Bestiaire', description: '' });
  const cree = ligne(p.liste, 'bestiaire');
  assert.equal(cree.hasAttribute('data-verrou'), false);
  assert.ok(cree.querySelector('.ed-mot-cle__mentions').hasAttribute('data-vide'));
  assert.ok(bouton(cree, 'ed-mot-cle__supprimer') && !p.saisie('bestiaire').controle.disabled);
});

test('décisions R218, R219 (4), contre le service : un mot-clé verrouillé (verrou = 1 dans la copie) est désactivé sur la page et reçoit la fusion d’un autre', async () => {
  const s = await surLeService({ A: 'Essai verrou aa', B: 'Essai verrou zz' }, {});
  const { A, B } = s.mots;
  // A verrouillé dans la copie (aucune route n'écrit `verrou` : seule une migration le fait), la page relue au crayon
  s.db.prepare('UPDATE mot_cle SET verrou = 1 WHERE id = ?').run(A.id);
  s.ed.enEdition = false;
  s.motsCles.fin(s.ed);
  await attendre();
  s.editeurs.clear();
  s.ed.enEdition = true;
  s.motsCles.debut(s.ed);
  await attendre();
  const a = ligne(s.liste, A.id);
  assert.ok(a.hasAttribute('data-verrou'), 'le verrou lu dans GET /api/edition/mots-cles/');
  assert.equal(a.querySelector('button'), null);
  assert.equal(s.saisie(A.id).controle.disabled, true);
  // B fusionné dans A : A est proposé, le lot passe, A garde son id et son libellé
  cliquer(bouton(ligne(s.liste, B.id), 'ed-mot-cle__fusionner'));
  const boite = s.document.body.querySelector('dialog');
  assert.ok(boite.querySelector('datalist').children.some((o) => o.getAttribute('value') === A.libelle), 'le verrouillé est une cible');
  boite.querySelector('input').value = A.libelle;
  boite.querySelector('form').dispatchEvent(new Event('submit', { cancelable: true }));
  const r = await s.enregistrer();
  assert.equal(r.refus, undefined, r.refus?.message);
  assert.deepEqual(r.operations, [{ op: 'fusionner_mots_cles', mot_cle: B.id, dans: A.id }]);
  assert.equal(s.motCle(B.id), null, 'B fusionné');
  assert.deepEqual(s.motCle(A.id), { id: A.id, libelle: A.libelle });
});

// --- Décision R223 : forcer la suppression d'un mot-clé mentionné ---------------------------------------------------------------------------------
// Le Glossaire propose de forcer quand le menu des mentions n'est pas vide, jamais pour un mot-clé verrouillé, et pas quand le service prévoit de refuser
// le forçage (`refus_du_forcage` non null : la raison est dite à la place du bouton) ; la suppression forcée part dans la même file, avec `forcer: true`,
// confirmée avec le nombre et les endroits des mentions qu'elle remplace.
const RAISON = 'Raison de refus rendue par le service.';
const vocabulaire = VIVANT;
const renommer = (id, avant, libelle) => ({ op: 'modifier', table: 'mot_cle', cle: { id }, valeurs: { libelle }, avant: { libelle: avant } });
const ids = (ops) => ops.map((o) => (o.op === 'modifier' ? `${o.cle.id}→${o.valeurs.libelle}` : o.op === 'supprimer' ? `-${o.cle.id}` : `${o.mot_cle}⇒${o.dans}`));

test('décision R223, fonctions pures : forçage offert si la liste des mentions n’est pas vide, le mot-clé non verrouillé et `refus_du_forcage` null', () => {
  assert.equal(forcageOffert({ mentions: MENTIONS.aide }), true, 'mentionné, service muet sur le refus : il juge à l’enregistrement');
  assert.equal(forcageOffert({ mentions: MENTIONS.aide, refus_du_forcage: null }), true);
  assert.equal(forcageOffert({ mentions: [] }), false, 'liste vide : « Supprimer », tel quel');
  assert.equal(suppressionOfferte({ mentions: [] }), true);
  assert.equal(forcageOffert({}), false, 'sans la liste : « Supprimer » reste, rien à forcer');
  assert.equal(forcageOffert({ verrou: 1, mentions: MENTIONS.aide }), false, 'verrouillé : jamais (R218 (3), R223 (4))');
  assert.equal(forcageOffert({ verrou: 1, mentions: MENTIONS.aide, refus_du_forcage: null }), false, 'verrouillé : jamais, quoi que dise le service');
  assert.equal(forcageOffert({ mentions: MENTIONS.aide, refus_du_forcage: RAISON }), false, 'refus prévu : pas de bouton');
  assert.equal(raisonSansForcage({ mentions: MENTIONS.aide, refus_du_forcage: RAISON }), RAISON, 'la raison, dite à la place du bouton');
  assert.equal(raisonSansForcage({ mentions: MENTIONS.aide, refus_du_forcage: null }), null);
  assert.equal(raisonSansForcage({ verrou: 1, mentions: MENTIONS.aide, refus_du_forcage: RAISON }), null, 'verrouillé : le cadenas dit tout');
  assert.equal(raisonSansForcage({ mentions: [], refus_du_forcage: RAISON }), null, 'liste vide : « Supprimer »');
  // ce que remplace le forçage : chaque mention comptée (une par texte qui cite, une par étiquette), les endroits nommés une fois
  const r = ceQueRemplaceLeForcage({ mentions: MENTIONS.aide });
  const etiquettes = MENTIONS.aide.filter((x) => x.comment === 'etiquette').length;
  assert.deepEqual([r.mentions, r.citations, r.etiquettes], [MENTIONS.aide.length, MENTIONS.aide.length - etiquettes, etiquettes]);
  assert.equal(r.endroits.length, endroitsDesMentions({ mentions: MENTIONS.aide }).length);
  assert.ok(r.texte.startsWith(`${MENTIONS.aide.length} mentions`), r.texte);
  for (const x of endroitsDesMentions({ mentions: MENTIONS.aide })) assert.ok(r.texte.includes(x.libelle), x.libelle);
  // au-delà de huit endroits : les autres comptés
  const beaucoup = Array.from({ length: 11 }, (_, i) => ({ ...PAGE_DE_REGLE, page: { id: `regles/p${i}`, titre: `P${i}` }, libelle: `P${i}` }));
  const b = ceQueRemplaceLeForcage({ mentions: beaucoup });
  assert.ok(b.texte.includes('P7') && !b.texte.includes('P8') && b.texte.includes('3 autres'), b.texte);
});

test('décision R223, fonctions pures : la suppression forcée dans la file (même ordre, `forcer: true`), refusée si le mot-clé reçoit une fusion, confirmée avec ses mentions', () => {
  const forcages = new Set(['aide']);
  const ops = operationsDuVocabulaire([renommer('aide', 'aide', 'Aide 2'), renommer('peuple', 'peuple', 'Peuples')], {
    suppressions: new Set(['feu']), forcages, fusions: new Map([['guide', 'peuple']]), vocabulaire,
  });
  assert.deepEqual(ops.slice(0, 3), [
    { op: 'fusionner_mots_cles', mot_cle: 'guide', dans: 'peuple' },
    { op: 'supprimer', entite: 'mot_cle', cle: { id: 'feu' } },
    { op: 'supprimer', entite: 'mot_cle', cle: { id: 'aide' }, forcer: true },
  ], 'fusions, suppressions, puis les forcées');
  assert.deepEqual(ids(ops.slice(3)), ['peuple→Peuples'], 'le renommage d’un mot-clé supprimé en forçant est retiré');
  assert.match(erreurDesRetraits(vocabulaire, { forcages: new Set(['guide']), fusions: new Map([['aide', 'guide']]) }), /reçoit « aide » \(fusion\) et serait supprimé/);
  assert.equal(erreurDesRetraits(vocabulaire, { forcages, fusions: new Map([['peuple', 'guide']]) }), null);
  const avecMentions = vocabulaire.map((m) => (m.id === 'aide' ? { ...m, mentions: MENTIONS.aide } : m));
  const message = confirmationDesRetraits(avecMentions, { forcages });
  const ligneForcee = message.split('\n').find((l) => l.includes('« aide »'));
  assert.ok(ligneForcee.includes('R223'), ligneForcee);
  assert.ok(ligneForcee.includes(ceQueRemplaceLeForcage({ mentions: MENTIONS.aide }).texte), 'le nombre et les endroits des mentions');
  assert.equal(confirmationDesRetraits(avecMentions, { forcages: new Set() }), null);
});

test('décision R223, au crayon : « Forcer la suppression » pour un mot-clé mentionné, jamais pour un verrouillé ; refus prévu : la raison à la place ; la file et le lot', async () => {
  const vocab = AVEC_MENTIONS.map((m) => (m.id === 'peuple' ? { ...m, mentions: [PAGE_DE_REGLE], refus_du_forcage: RAISON } : m));
  const p = await monter({ vocabulaire: vocab });
  await p.motsCles.surcouche(p.ed, []);
  p.ed.enEdition = true;
  p.motsCles.debut(p.ed);
  await attendre();
  const aide = ligne(p.liste, 'aide');
  const forcer = bouton(aide, 'ed-mot-cle__forcer');
  assert.ok(forcer, 'mentionné : le forçage est proposé');
  assert.equal(bouton(aide, 'ed-mot-cle__supprimer'), null, 'mentionné : pas de « Supprimer » ordinaire');
  assert.ok(forcer.title.includes(ceQueRemplaceLeForcage(vocab.find((m) => m.id === 'aide')).texte), 'l’infobulle dit ce qui sera remplacé');
  assert.equal(bouton(ligne(p.liste, 'feu'), 'ed-mot-cle__forcer'), null, 'liste vide : « Supprimer » seul');
  assert.ok(bouton(ligne(p.liste, 'feu'), 'ed-mot-cle__supprimer'));
  assert.equal(ligne(p.liste, 'magique').querySelector('button'), null, 'verrouillé et mentionné : aucun bouton');
  assert.equal(ligne(p.liste, 'magique').querySelector('.ed-mot-cle__sans-forcage'), null);
  const peuple = ligne(p.liste, 'peuple');
  assert.equal(bouton(peuple, 'ed-mot-cle__forcer'), null, 'refus prévu : pas de bouton');
  assert.equal(peuple.querySelector('.ed-mot-cle__sans-forcage').title, RAISON, 'la raison en infobulle');
  assert.ok(peuple.querySelector('.ed-mot-cle__sans-forcage-raison').textContent.includes(RAISON), 'et au bas du menu des mentions (toucher)');
  assert.ok(bouton(peuple, 'ed-mot-cle__fusionner'), 'la fusion reste');
  // la file : basculer, annuler, rebasculer ; la fusion de la ligne désactivée
  cliquer(forcer);
  assert.ok(aide.classList.contains('ed-supprime'));
  assert.equal(forcer.getAttribute('aria-pressed'), 'true');
  assert.equal(bouton(aide, 'ed-mot-cle__fusionner').disabled, true);
  cliquer(forcer);
  assert.ok(!aide.classList.contains('ed-supprime'));
  assert.deepEqual(p.motsCles.operations(p.ed, []), []);
  cliquer(forcer);
  assert.equal(p.motsCles.verifier(p.ed, p.editeurs), null);
  assert.ok(p.questions.at(-1).includes(ceQueRemplaceLeForcage(vocab.find((m) => m.id === 'aide')).texte), 'la confirmation compte les mentions');
  assert.deepEqual(p.motsCles.operations(p.ed, []), [{ op: 'supprimer', entite: 'mot_cle', cle: { id: 'aide' }, forcer: true }]);
  // un mot-clé qui reçoit une fusion en attente ne se force pas
  cliquer(forcer);
  cliquer(bouton(ligne(p.liste, 'guide'), 'ed-mot-cle__fusionner'));
  const boite = p.document.body.querySelector('dialog');
  boite.querySelector('input').value = 'aide';
  boite.querySelector('form').dispatchEvent(new Event('submit', { cancelable: true }));
  cliquer(forcer);
  assert.equal(p.ed.annonces.at(-1)[1], 'erreur');
  assert.ok(!aide.classList.contains('ed-supprime'));
  // en sortant : la file vidée
  p.ed.enEdition = false;
  p.motsCles.fin(p.ed);
  await attendre();
  assert.deepEqual(p.motsCles.operations(p.ed, []), []);
});

test('décision R223, contre le service : un mot-clé cité se supprime en forçant (sa balise devient son texte affiché) ; cité par une définition verrouillée, le forçage n’est pas offert', async () => {
  const s = await surLeService({ A: 'Essai forçage aa', B: 'Essai forçage bb', C: 'Essai forçage cc', D: 'Essai forçage dd' }, {});
  const { A, B, C, D } = s.mots;
  // B cite A, D cite C, par le chemin normal d'une modification ; puis D verrouillé dans la copie (aucune route n'écrit `verrou`)
  for (const [qui, cite] of [[B, A], [D, C]]) {
    const r = traiter({ methode: 'POST', chemin: '/api/edition/', entetes: { 'content-type': 'application/json' }, corps: JSON.stringify({ page: 'regles/glossaire/',
      operations: [{ op: 'modifier', table: 'mot_cle', cle: { id: qui.id }, valeurs: { description: `Voir {{${cite.id}|texte affiché d’essai}}.` }, avant: { description: null } }] }) }, s.service);
    assert.equal(r.statut, 200, JSON.stringify(r.corps));
  }
  s.db.prepare('UPDATE mot_cle SET verrou = 1 WHERE id = ?').run(D.id);
  s.ed.enEdition = false;
  s.motsCles.fin(s.ed);
  await attendre();
  s.editeurs.clear();
  s.ed.enEdition = true;
  s.motsCles.debut(s.ed);
  await attendre();
  const c = ligne(s.liste, C.id);
  assert.equal(bouton(c, 'ed-mot-cle__forcer'), null, 'cité par la définition d’un verrouillé : le service refuserait, pas de bouton');
  assert.ok(c.querySelector('.ed-mot-cle__sans-forcage').title, 'la raison du service');
  assert.equal(ligne(s.liste, D.id).querySelector('button'), null);
  const a = ligne(s.liste, A.id);
  assert.equal(bouton(a, 'ed-mot-cle__supprimer'), null);
  cliquer(bouton(a, 'ed-mot-cle__forcer'));
  const r = await s.enregistrer();
  assert.equal(r.refus, undefined, r.refus?.message);
  assert.deepEqual(r.operations, [{ op: 'supprimer', entite: 'mot_cle', cle: { id: A.id }, forcer: true }]);
  assert.match(s.questions.at(-1), /^- .* sera supprimé en forçant \(décision R223\) : 1 mention sera remplacée/m);
  assert.equal(s.motCle(A.id), null, 'A supprimé');
  const definition = s.db.prepare('SELECT description FROM mot_cle WHERE id = ?').get(B.id).description;
  assert.ok(!definition.includes('{{') && definition.includes('texte affiché d’essai'), `la balise devient son texte affiché : ${definition}`);
});
