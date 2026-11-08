// L'extension de l'éditeur pour le Glossaire, /regles/glossaire/ (src/scripts/edition/mots-cles.mjs ; sur /recherche/ jusqu'aux réponses du propriétaire
// du 2026-11-06, Q6 et Q7 ; demande du propriétaire : en mode modification, « supprimer / ajouter / Modifier des mots clés »), exécutée dans un faux
// navigateur avec un faux éditeur : le tableau relu dans la base vivante (une ligne, un <tbody>, par mot-clé : lib/mots-cles-balises.mjs#htmlDeLaLigneDuGlossaire,
// décision R234), le tableau de gestion (R234 (5) : l'édition dans la ligne ; libellé modifiable, synonymes en liste ordonnée, catégories à cocher,
// suppression et fusion en file), la création immédiate, les confirmations et l'ordre des opérations du lot, le retour au tableau de lecture ; la
// définition de chaque mot-clé (saisie commune), sa balise à copier (sa clé, R232 (3)) ; son adresse et sa couleur (migration 0098) ; un mot-clé verrouillé
// (décisions R218, R219 (7)) : un cadenas, ses champs, ses synonymes et ses catégories modifiables (demande du propriétaire : seule sa suppression est
// bloquée), ni suppression ni fusion depuis lui, mais une cible de fusion ; rien de tout cela hors du mode modification ; le menu des endroits qui le mentionnent, « Supprimer » pour une
// liste vide seulement (R196 (2)) ; « Forcer la suppression » pour un mot-clé mentionné, sauf verrouillé ou refus prévu par le service (R223) ; la
// gestion des catégories (R232 (5) : renommer, supprimer une catégorie vide, ajouter). Puis, de bout en bout contre le vrai service (serveur/api.mjs sur
// une copie de la base) : renommages en rotation, en chaîne, noms échangés, homonymes distingués par leurs catégories (R232 (9)), fusions en chaîne,
// fusion dans un mot-clé verrouillé, synonymes et catégories enregistrés — le lot que la page envoie est accepté, ou refusé avant toute question.
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
  categoriesDistinctes, ceQueRemplaceLeForcage, cibleSaisie, ciblesDeFusion, confirmationDesRetraits, ecrituresDesCibles, endroitsDesMentions, erreurDesRetraits,
  examinerLesRenommages, forcageOffert, fusionOfferte, INFOBULLE_DU_VERROU, operationsDesListes, operationsDuVocabulaire, raisonSansForcage,
  suppressionDeCategorieOfferte, suppressionOfferte, synonymesSaisis,
} from '../src/lib/mots-cles-edition.mjs';
import { htmlDePiece } from '../src/lib/monnaies.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';
import { attendre, cliquer, el, Element, fauxDocument } from './aide-faux-dom.mjs';

// GET /api/edition/mots-cles/ : { motsCles: [{ id (entier), libelle, cle, description, url, couleur, pages, verrou, monnaie_id, synonymes, categories,
// anciennes_cles, mentions? }], categories: [{ id, libelle, libelle_cle, mots_cles }], css } (description : NULL tant qu'il n'est pas décrit ; verrou :
// 1 pour un mot-clé verrouillé, migration 0110 ; mentions : absentes ici, le service qui ne les donne pas laisse « Supprimer »)
const v = (id, libelle, pages = 0, verrou = 0, description = null, autres = {}) => ({
  id, libelle, cle: normalize(libelle), description, url: null, couleur: null, pages, verrou, monnaie_id: null, synonymes: [], categories: [], anciennes_cles: [],
  ...autres,
});
const VIVANT = [
  v(1, 'aide', 3),
  v(2, 'Feu', 2, 0, 'Ce qui brûle.', { synonymes: ['Flamme'], categories: [2] }),
  v(3, 'guide', 5),
  v(4, 'Magique', 12, 1, null, { categories: [6] }),
  v(5, 'peuple', 1),
];
const I = Object.fromEntries(VIVANT.map((m) => [m.cle, m.id]));
const CATEGORIES = [
  { id: 1, libelle: 'Règles', libelle_cle: 'regles', mots_cles: 0 },
  { id: 2, libelle: 'Magie', libelle_cle: 'magie', mots_cles: 1 },
  { id: 6, libelle: 'Classe', libelle_cle: 'classe', mots_cles: 1 },
];

let numero = 0;
/**
 * La page /regles/glossaire/ (le tableau construit : un mot-clé), un faux éditeur, et l'extension chargée à neuf. `service` : les appels vont au vrai
 * service (sinon, un faux qui connaît VIVANT et CATEGORIES, et rend la feuille `CSS_DU_SERVICE`).
 */
const CSS_DU_SERVICE = '.couleur-mot-cle-9{--couleur:#123456;--couleur-texte:#ffffff}';
async function monter({ confirmations = [], service = null, vocabulaire = VIVANT, categories = CATEGORIES, construit = null } = {}) {
  const liste = el('table', { id: 'liste-mots-cles', class: 'table-donnees glossaire-table' }, el('thead', {}));
  liste.insertAdjacentHTML('beforeend', construit ?? '<tbody class="glossaire-mot" data-id="1" data-cle="aide" data-n="3" data-libelle="aide"><tr><th>aide</th></tr></tbody>');
  const document = fauxDocument(el('div', { 'data-glossaire': '' }, el('div', { class: 'tableau' }, el('div', { class: 'tableau__defile' }, liste))));
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
  let cats = categories.map((c) => ({ ...c }));
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
    marquerModifie() { this.modifie = true; },
    async appel(methode, chemin, corps) {
      appels.push([methode, chemin, corps]);
      if (service) {
        const r = traiter({ methode, chemin: `/api/${chemin}`, entetes: { 'content-type': 'application/json' }, corps: corps && JSON.stringify(corps) }, service);
        if (r.statut !== 200) throw Object.assign(new Error(r.corps?.erreur ?? `HTTP ${r.statut}`), { statut: r.statut, corps: r.corps });
        return r.corps;
      }
      if (chemin === 'edition/mots-cles/') return { motsCles: vivant.map((m) => ({ ...m })), categories: cats.map((c) => ({ ...c })), css: CSS_DU_SERVICE };
      const op = corps.operations[0];
      if (op.entite === 'categorie_mot_cle') {
        const ligne = { id: 100 + cats.length, libelle: op.valeurs.libelle, libelle_cle: normalize(op.valeurs.libelle) };
        cats = [...cats, { ...ligne, mots_cles: 0 }];
        return { lignes: [{ table: 'categorie_mot_cle', cle: { id: ligne.id }, ligne }] };
      }
      const ligne = { id: 100 + vivant.length, libelle: op.valeurs.libelle, cle: normalize(op.valeurs.libelle), description: op.valeurs.description || null, url: null, couleur: null };
      vivant = [...vivant, { ...ligne, pages: 0, verrou: 0, synonymes: op.valeurs.synonymes ?? [], categories: (op.valeurs.categories ?? []).map(Number) }];
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
  // une saisie d'un mot-clé (par son id ou sa clé) ou d'une catégorie (`table`)
  const saisieDe = (x, colonne, table = 'mot_cle') => [...editeurs].find(([c, e]) => e.info.table === table && e.info.colonne === colonne
    && (table === 'mot_cle' ? [String(x), I[x] && String(I[x])].includes(String(e.info.cle.id)) || normalize(e.ligne.libelle) === x : e.info.cle.id === x))?.[1];
  return {
    motsCles, ed, document, liste, evenements, questions, appels, formulaires, editeurs, saisie: (x) => saisieDe(x, 'libelle'), definition: (x) => saisieDe(x, 'description'),
    adresse: (x) => saisieDe(x, 'url'), couleur: (x) => saisieDe(x, 'couleur'), icone: (x) => saisieDe(x, 'icone'), categorie: (id) => saisieDe(id, 'libelle', 'categorie_mot_cle'),
  };
}

/** La ligne (le <tbody>) d'un mot-clé, par son id ou sa clé. */
const ligne = (liste, x) => liste.querySelectorAll('tbody[data-id]').find((t) => t.dataset.id === String(x) || t.dataset.cle === x) ?? null;
const lignes = (liste) => liste.querySelectorAll('tbody[data-id]');
const bouton = (t, classe) => t.querySelector(`.${classe}`);
const synonymes = (t) => t.querySelector('.ed-mot-cle__synonymes-saisie');
const cases = (t) => t.querySelectorAll('.ed-mot-cle__categorie input');
const cocher = (t, id, oui = true) => {
  const c = cases(t).find((x) => x.value === String(id));
  c.checked = oui;
  c.dispatchEvent(new Event('change'));
};

test('au chargement : le tableau relu dans la base vivante (ordre, mentions, catégories), rien d’autre que le vocabulaire', async () => {
  const p = await monter();
  assert.equal(p.motsCles.actif(p.document), true);
  await p.motsCles.surcouche(p.ed, []);
  assert.deepEqual(lignes(p.liste).map((t) => t.dataset.cle), ['aide', 'feu', 'guide', 'magique', 'peuple']);
  const feu = ligne(p.liste, 'feu');
  assert.deepEqual([feu.dataset.id, feu.dataset.cle, feu.dataset.libelle, feu.dataset.synonymes, feu.dataset.categories], ['2', 'feu', 'Feu', '["Flamme"]', '[2]']);
  // la ligne du Glossaire, le même HTML que la page construite (lib/mots-cles-balises.mjs#htmlDeLaLigneDuGlossaire)
  const attendue = el('table');
  attendue.innerHTML = htmlDeLaLigneDuGlossaire(VIVANT[1], { base: '/', categories: CATEGORIES });
  assert.equal(feu.outerHTML, attendue.children[0].outerHTML);
  assert.equal(feu.querySelector('.glossaire-mot__categories').textContent, 'Magie', 'ses catégories, nommées');
  assert.equal(feu.querySelector('.glossaire-mot__synonymes').textContent, 'Aussi appelé : Flamme', 'R233 (8)');
  assert.equal(feu.querySelector('.glossaire-mot__definition').textContent, 'Ce qui brûle.', 'la définition dans sa ligne');
  assert.equal(feu.dataset.definition, 'Ce qui brûle.');
  assert.equal(ligne(p.liste, 'aide').dataset.definition, undefined);
  assert.equal(ligne(p.liste, 'aide').querySelector('.glossaire-mot__definition').textContent, 'Pas encore de définition.');
  assert.deepEqual(p.evenements, [{ gestion: false, categories: CATEGORIES.map(({ id, libelle }) => ({ id, libelle })) }], 'la page relit le tableau et ses catégories');
  // la feuille des couleurs des mots-clés, celle du service (mots-cles-vivants.mjs)
  assert.equal(p.document.querySelector('style[data-couleurs-mots-cles]')?.textContent, CSS_DU_SERVICE);
  // hors du mode modification, un mot-clé verrouillé est une ligne comme les autres (décision R219 (7))
  const magique = ligne(p.liste, 'magique');
  const lue = el('table');
  lue.innerHTML = htmlDeLaLigneDuGlossaire(VIVANT[3], { base: '/', categories: CATEGORIES });
  assert.equal(magique.outerHTML, lue.children[0].outerHTML, 'le même HTML que la page construite');
  assert.equal(magique.hasAttribute('data-verrou'), false);
  assert.equal(p.liste.querySelector('.ed-mot-cle__verrou'), null, 'pas de cadenas');
});

test('R234 (2), réponse T5 : la colonne Lien montre le titre de la page que donne le service (`titre_du_lien`, `page_du_lien`) ; sans page, l’adresse brute', async () => {
  const vocabulaire = [
    { ...VIVANT[0], url: '/races/elfe/', page_du_lien: 'races/elfe', titre_du_lien: 'Les Elfes' },
    { ...VIVANT[1], url: '/fiche/', page_du_lien: null, titre_du_lien: null },
    VIVANT[2],
  ];
  const p = await monter({ vocabulaire });
  await p.motsCles.surcouche(p.ed, []);
  const lien = (cle) => ligne(p.liste, cle).querySelector('.glossaire-mot__lien a');
  assert.equal(lien('aide').textContent, 'Les Elfes', 'le titre de sa page');
  assert.equal(lien('aide').dataset.page, 'races/elfe');
  assert.equal(lien('feu').textContent, '/fiche/', 'une route sans page : l’adresse brute');
  assert.ok(lien('feu').classList.contains('glossaire-mot__adresse'));
  assert.equal(lien('guide'), null, 'sans adresse : pas de lien');
});

test('au crayon : le tableau de gestion ; décisions R218, R219 (7) : un mot-clé verrouillé a son cadenas, ses champs, ses synonymes et ses catégories modifiables, aucun bouton ; « + Ajouter » crée tout de suite', async () => {
  const p = await monter();
  await p.motsCles.surcouche(p.ed, []);
  p.ed.enEdition = true;
  p.motsCles.debut(p.ed);
  await attendre();
  assert.ok(p.liste.hasAttribute('data-gestion'));
  assert.deepEqual(lignes(p.liste).map((t) => t.dataset.cle), ['aide', 'feu', 'guide', 'magique', 'peuple']);
  assert.ok(lignes(p.liste).every((t) => t.classList.contains('ed-mot-cle')));
  assert.deepEqual(p.evenements.at(-1).gestion, true);
  const feu = ligne(p.liste, 'feu');
  // les colonnes du tableau de lecture, la ligne de dessous pleine largeur (R234 (3), (5))
  assert.deepEqual(feu.children.map((tr) => tr.className), ['ed-mot-cle__ligne', 'ed-mot-cle__suite']);
  assert.deepEqual(feu.children[0].children.map((c) => c.className), ['ed-mot-cle__icone-case', 'ed-mot-cle__noms', 'ed-mot-cle__categories', 'ed-mot-cle__lien-case', 'ed-mot-cle__outils'],
    'l’icône en premier (R235 (2))');
  assert.equal(feu.children[1].children[0].getAttribute('colspan'), '5');
  // l'icône : une saisie commune (le choix de la liste des icônes du site, editeur.mjs#controleDe), partie de la base vivante (R235 (1))
  assert.deepEqual(lireAttributEd(feu.querySelector('.ed-mot-cle__icone').dataset.ed), lireAttributEd(JSON.stringify(['mot_cle', { id: I.feu }, 'icone'])));
  assert.equal(p.icone('feu').controle.value, '', 'sans icône : vide');
  assert.equal(p.ed.lignes.get(cleDeLigne('mot_cle', { id: I.feu })).icone, null, 'NULL tel qu’enregistré');
  assert.equal(feu.querySelector('.ed-mot-cle__compte').textContent, '2 pages');
  assert.ok(bouton(feu, 'ed-mot-cle__supprimer') && bouton(feu, 'ed-mot-cle__fusionner'), 'non verrouillé : « Supprimer » et « Fusionner dans… »');
  assert.equal(feu.hasAttribute('data-verrou'), false);
  assert.deepEqual(lireAttributEd(feu.querySelector('.ed-mot-cle__nom').dataset.ed), lireAttributEd(JSON.stringify(['mot_cle', { id: I.feu }, 'libelle'])), 'le champ cite l’id entier');
  assert.equal(p.saisie('feu').controle.value, 'Feu', 'la saisie part de la base vivante');
  assert.equal(feu.querySelector('.ed-mot-cle__balise').textContent, '{{feu}}', 'la balise à copier : la clé');
  assert.match(feu.querySelector('.ed-mot-cle__balise').title, /« \{\{Flamme\}\} » pour un synonyme/);
  assert.equal(p.definition('feu').controle.value, 'Ce qui brûle.', 'la définition, saisie commune');
  assert.equal(p.definition('aide').controle.value, '', 'pas encore décrit');
  assert.equal(synonymes(feu).value, 'Flamme', 'ses synonymes, un par ligne');
  assert.deepEqual(cases(feu).map((c) => [c.value, c.checked]), [['1', false], ['2', true], ['6', false]], 'une case par catégorie, les siennes cochées');
  assert.ok(!p.saisie('feu').controle.disabled && !p.definition('feu').controle.disabled && !synonymes(feu).disabled, 'non verrouillé : ses champs se modifient');
  const magique = ligne(p.liste, 'magique');
  assert.ok(magique.hasAttribute('data-verrou') && magique.classList.contains('ed-mot-cle--verrouille'), 'la ligne verrouillée est marquée');
  const cadenas = magique.querySelector('.ed-mot-cle__verrou');
  assert.ok(cadenas?.querySelector('svg'), 'un cadenas sur la ligne');
  assert.equal(cadenas.getAttribute('aria-label'), INFOBULLE_DU_VERROU);
  assert.equal(cadenas.title, INFOBULLE_DU_VERROU, 'la raison en infobulle');
  const champs = [...p.editeurs].filter(([c]) => c.closest('tbody') === magique);
  assert.deepEqual(champs.map(([, e]) => e.info.colonne).sort(), ['couleur', 'description', 'icone', 'libelle', 'url'], 'tous ses champs, montés');
  // demande du propriétaire : « Seule leur suppression est bloquée » — ses champs, ses synonymes et ses catégories se modifient
  for (const [, e] of champs) assert.equal(e.controle.disabled, false, `${e.info.colonne} : modifiable`);
  assert.equal(synonymes(magique).disabled, false, 'ses synonymes : modifiables');
  assert.ok(cases(magique).every((c) => !c.disabled), 'ses catégories : libres (R232 (11))');
  assert.equal(magique.querySelector('button'), null, 'verrouillé : ni « Supprimer » ni « Fusionner dans… »');
  // création immédiate, à sa place dans le tableau, avec ses catégories (cases) et ses synonymes (un par ligne)
  const ajouter = p.document.querySelector('.ed-outils-mots-cles').querySelector('button');
  assert.equal(ajouter.textContent, '+ Ajouter un mot-clé');
  cliquer(ajouter);
  assert.deepEqual(p.formulaires[0].champs.map((c) => [c.nom, c.type]),
    [['libelle', 'ligne'], ['description', 'texte'], ['url', 'adresse'], ['couleur', 'couleur'], ['icone', 'choix'], ['categories', 'categories'], ['synonymes', 'texte']],
    'créé avec sa définition, son adresse et sa couleur (migration 0098), son icône (R235), ses catégories (R232) et ses synonymes (R233)');
  assert.equal(p.formulaires[0].champs.find((c) => c.nom === 'icone').liste, 'icones', 'le choix lit la liste des icônes du site (ed.listes.icones)');
  assert.deepEqual(p.formulaires[0].champs.find((c) => c.nom === 'categories').choix, CATEGORIES.map(({ id, libelle }) => ({ id, libelle })));
  assert.doesNotMatch(p.formulaires[0].champs.find((c) => c.nom === 'categories').vide, /chronologie/, 'sans catégorie : le texte renvoie au Glossaire');
  await p.formulaires[0].valider({ libelle: 'Bestiaire', description: '', categories: ['6', '1'], synonymes: 'Monstres\n\n  Créatures \nmonstres' });
  const envoi = p.appels.find(([m, c]) => m === 'POST' && c === 'edition/')[2];
  assert.deepEqual(envoi, { page: 'regles/glossaire/', operations: [{ op: 'creer', entite: 'mot_cle', valeurs: { libelle: 'Bestiaire', description: '', categories: ['6', '1'], synonymes: ['Monstres', 'Créatures'] } }] });
  assert.deepEqual(lignes(p.liste).map((t) => t.dataset.cle), ['aide', 'bestiaire', 'feu', 'guide', 'magique', 'peuple']);
  const cree = ligne(p.liste, 'bestiaire');
  assert.ok(cree.classList.contains('ed-nouveau'));
  assert.equal(p.saisie('bestiaire').controle.value, 'Bestiaire');
  assert.deepEqual(cases(cree).filter((c) => c.checked).map((c) => c.value), ['1', '6']);
  assert.equal(synonymes(cree).value, 'Monstres\nCréatures');
});

test('suppression et fusion en file, confirmées une fois avec ce qu’elles retirent ; un renommage vers l’écriture d’un autre, sans catégorie qui les distingue, devient une fusion', async () => {
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
  assert.equal(synonymes(aide).disabled, true, 'un mot-clé qui disparaît : ses saisies désactivées');
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
  // « Feu » (catégorie Magie) renommé « Guide » (aucune catégorie) : rien ne les distingue (R232 (9)), la fusion est proposée, acceptée ; puis la
  // confirmation des retraits
  p.saisie('feu').controle.value = 'Guide';
  assert.equal(p.motsCles.verifier(p.ed, p.editeurs), null);
  assert.equal(p.questions.length, 2);
  assert.match(p.questions[0], /^« Guide » s’écrit comme « guide », sans catégorie qui les distingue : fusionner « Feu » dans « guide » \?\nSes pages \(2 pages\) porteront « guide »/);
  assert.match(p.questions[1], /« aide » sera supprimé\./);
  assert.match(p.questions[1], /« peuple » sera fusionné dans « guide » : ses pages \(1 page\) et les textes qui le citent/);
  const renommages = [{ op: 'modifier', table: 'mot_cle', cle: { id: I.feu }, valeurs: { libelle: 'Guide' }, avant: { libelle: 'Feu' } }];
  assert.deepEqual(p.motsCles.operations(p.ed, renommages, p.editeurs), [
    { op: 'fusionner_mots_cles', mot_cle: I.peuple, dans: I.guide },
    { op: 'fusionner_mots_cles', mot_cle: I.feu, dans: I.guide },
    { op: 'supprimer', entite: 'mot_cle', cle: { id: I.aide } },
  ]);
  // en sortant : le tableau de lecture, la file vidée
  p.ed.enEdition = false;
  p.motsCles.fin(p.ed);
  await attendre();
  assert.ok(!p.liste.hasAttribute('data-gestion'));
  assert.deepEqual(lignes(p.liste).map((t) => t.dataset.cle), ['aide', 'feu', 'guide', 'magique', 'peuple']);
  assert.equal(lignes(p.liste)[0].querySelector('.glossaire-mot__nom').textContent, 'aide', 'le tableau de lecture');
  assert.equal(p.document.querySelector('.ed-outils-mots-cles'), null);
  assert.deepEqual(p.motsCles.operations(p.ed, []), [], 'plus rien en file');
});

test('R232 (9) : un renommage vers l’écriture d’un autre mot-clé, chacun avec une catégorie propre (cochée dans le même lot), fait deux homonymes — aucune fusion proposée ; les catégories partent avant le renommage', async () => {
  const p = await monter();
  await p.motsCles.surcouche(p.ed, []);
  p.ed.enEdition = true;
  p.motsCles.debut(p.ed);
  await attendre();
  // « guide » (sans catégorie) renommé « Feu » (Magie) : il lui faut une catégorie propre, « Règles »
  p.saisie('guide').controle.value = 'Feu';
  cocher(ligne(p.liste, 'guide'), 1);
  assert.equal(p.motsCles.verifier(p.ed, p.editeurs), null);
  assert.deepEqual(p.questions, [], 'aucune fusion proposée');
  const renommage = { op: 'modifier', table: 'mot_cle', cle: { id: I.guide }, valeurs: { libelle: 'Feu' }, avant: { libelle: 'guide' } };
  assert.deepEqual(p.motsCles.operations(p.ed, [renommage], p.editeurs), [
    { op: 'categories_mot_cle', mot_cle: I.guide, categories: [1], avant: [] },
    renommage,
  ], 'les catégories d’abord (le service recalcule la clé à chaque écriture)');
  // la même catégorie que « Feu » : rien ne les distingue, la fusion est proposée ; refusée, rien n'est envoyé
  cocher(ligne(p.liste, 'guide'), 1, false);
  cocher(ligne(p.liste, 'guide'), 2);
  globalThis.confirm = (q) => {
    p.questions.push(q);
    return false;
  };
  assert.match(p.motsCles.verifier(p.ed, p.editeurs), /^Non enregistré : « Feu » s’écrit comme le mot-clé « Feu »\. Donnez à chacun une catégorie qui le distingue de l’autre \(décision R232 \(9\)\)/);
});

test('refus : renommage vers l’écriture d’un autre sans accepter la fusion ; confirmation des retraits annulée', async () => {
  const p = await monter({ confirmations: [false] });
  await p.motsCles.surcouche(p.ed, []);
  p.ed.enEdition = true;
  p.motsCles.debut(p.ed);
  await attendre();
  p.saisie('feu').controle.value = 'aide';
  cocher(ligne(p.liste, 'feu'), 2, false);
  assert.match(p.motsCles.verifier(p.ed, p.editeurs), /^Non enregistré : « aide » s’écrit comme le mot-clé « aide »/);
  cocher(ligne(p.liste, 'feu'), 2);
  // vers l'écriture d'un mot-clé verrouillé, la même catégorie : la fusion dans lui est proposée (R219 (4)), acceptée
  cocher(ligne(p.liste, 'feu'), 6);
  p.saisie('feu').controle.value = 'Magique';
  assert.equal(p.motsCles.verifier(p.ed, p.editeurs), null);
  assert.match(p.questions.at(-1), /fusionner « Feu » dans « Magique »/);
  assert.deepEqual(p.motsCles.operations(p.ed, []), [{ op: 'fusionner_mots_cles', mot_cle: I.feu, dans: I.magique }], 'ni ses catégories ni ses synonymes : il disparaît');
  p.saisie('feu').controle.value = 'Feu';
  cocher(ligne(p.liste, 'feu'), 6, false);
  cliquer(bouton(ligne(p.liste, 'aide'), 'ed-mot-cle__supprimer'));
  globalThis.confirm = () => false;
  assert.equal(p.motsCles.verifier(p.ed, p.editeurs), 'Enregistrement annulé : rien n’a été envoyé.');
});

test('R233, R232 (5), réponse T6 : les synonymes (liste ordonnée, un par ligne) et les catégories (cases) changés partent en opérations, `avant` : la liste lue ; rien pour un mot-clé inchangé ou qui disparaît', async () => {
  const p = await monter();
  await p.motsCles.surcouche(p.ed, []);
  p.ed.enEdition = true;
  p.motsCles.debut(p.ed);
  await attendre();
  const feu = ligne(p.liste, 'feu');
  p.ed.modifie = false;
  synonymes(feu).value = 'Brasier\nFlamme\n  \nflamme';
  synonymes(feu).dispatchEvent(new Event('input'));
  assert.equal(p.ed.modifie, true, 'une saisie marque la page modifiée');
  cocher(feu, 1);
  cocher(ligne(p.liste, 'magique'), 6, false);
  cocher(ligne(p.liste, 'magique'), 1);
  cocher(ligne(p.liste, 'aide'), 2);
  cliquer(bouton(ligne(p.liste, 'aide'), 'ed-mot-cle__supprimer'));
  assert.equal(p.motsCles.verifier(p.ed, p.editeurs), null);
  assert.deepEqual(p.motsCles.operations(p.ed, []), [
    { op: 'supprimer', entite: 'mot_cle', cle: { id: I.aide } },
    { op: 'categories_mot_cle', mot_cle: I.feu, categories: [1, 2], avant: [2] },
    { op: 'categories_mot_cle', mot_cle: I.magique, categories: [1], avant: [6] },
    { op: 'synonymes_mot_cle', mot_cle: I.feu, synonymes: ['Brasier', 'Flamme'], avant: ['Flamme'] },
  ], 'suppressions, catégories (verrouillé compris, R232 (11)), puis synonymes ; rien pour « aide », supprimé');
});

test('R232 (5) : la gestion des catégories — chacune renommable (saisie commune), « Supprimer » pour une catégorie vide (en file, à la fin du lot), « + Ajouter une catégorie » la crée tout de suite et l’ajoute aux cases de chaque mot-clé', async () => {
  const p = await monter();
  await p.motsCles.surcouche(p.ed, []);
  p.ed.enEdition = true;
  p.motsCles.debut(p.ed);
  await attendre();
  const bloc = p.document.querySelector('.ed-categories-mots-cles');
  assert.ok(bloc, 'au-dessus du tableau, avec « + Ajouter un mot-clé »');
  assert.equal(bloc.querySelector('summary').textContent, 'Catégories des mots-clés (3)');
  const items = bloc.querySelectorAll('li.ed-categorie-mot-cle');
  assert.deepEqual(items.map((li) => li.dataset.id), ['1', '2', '6']);
  assert.equal(p.categorie(2).controle.value, 'Magie', 'le libellé, saisie commune');
  assert.deepEqual(lireAttributEd(items[1].querySelector('[data-ed]').dataset.ed), lireAttributEd(JSON.stringify(['categorie_mot_cle', { id: 2 }, 'libelle'])));
  assert.equal(items[1].querySelector('.ed-categorie-mot-cle__compte').textContent, '1 mot-clé');
  assert.ok(items[0].querySelector('.ed-categorie-mot-cle__supprimer'), 'vide : « Supprimer »');
  assert.equal(items[1].querySelector('.ed-categorie-mot-cle__supprimer'), null, 'non vide : pas de « Supprimer »');
  cliquer(items[0].querySelector('.ed-categorie-mot-cle__supprimer'));
  assert.ok(items[0].classList.contains('ed-supprime'));
  assert.equal(items[0].querySelector('.ed-categorie-mot-cle__supprimer').textContent, 'Sera supprimée — annuler');
  const renommage = { op: 'modifier', table: 'categorie_mot_cle', cle: { id: 2 }, valeurs: { libelle: 'Magies' }, avant: { libelle: 'Magie' } };
  assert.deepEqual(p.motsCles.operations(p.ed, [renommage]), [renommage, { op: 'supprimer', entite: 'categorie_mot_cle', cle: { id: 1 } }]);
  cliquer(items[0].querySelector('.ed-categorie-mot-cle__supprimer'));
  assert.deepEqual(p.motsCles.operations(p.ed, []), [], 'annulée');
  // une catégorie créée : tout de suite, dans la liste et dans les cases de chaque mot-clé (rien n'est redessiné : les saisies en cours restent)
  synonymes(ligne(p.liste, 'feu')).value = 'Saisie en cours';
  const ajouter = bloc.querySelectorAll('button').find((b) => b.textContent === '+ Ajouter une catégorie');
  cliquer(ajouter);
  const f = p.formulaires.at(-1);
  assert.deepEqual(f.champs.map((c) => [c.nom, c.type, c.requis]), [['libelle', 'ligne', true]]);
  await f.valider({ libelle: 'Bestiaire' });
  assert.deepEqual(p.appels.at(-1)[2].operations, [{ op: 'creer', entite: 'categorie_mot_cle', valeurs: { libelle: 'Bestiaire' } }]);
  assert.equal(bloc.querySelector('summary').textContent, 'Catégories des mots-clés (4)');
  const nouvelle = bloc.querySelectorAll('li.ed-categorie-mot-cle').at(-1);
  assert.ok(nouvelle.classList.contains('ed-nouveau') && nouvelle.querySelector('.ed-categorie-mot-cle__supprimer'), 'vide : supprimable');
  for (const t of lignes(p.liste)) assert.deepEqual(cases(t).at(-1) && [cases(t).at(-1).value, cases(t).at(-1).checked], [nouvelle.dataset.id, false], t.dataset.cle);
  assert.equal(synonymes(ligne(p.liste, 'feu')).value, 'Saisie en cours');
  assert.deepEqual(p.evenements.at(-1).categories.at(-1), { id: Number(nouvelle.dataset.id), libelle: 'Bestiaire' }, 'la liste du filtre suit');
});

test('fonctions pures : catégories distinctes (R232 (9)), renommages examinés avec les catégories du lot, cible saisie par la clé d’un homonyme, synonymes saisis, opérations des listes', () => {
  assert.equal(categoriesDistinctes([3], [6]), true);
  assert.equal(categoriesDistinctes([3], [3, 6]), false, 'incluses');
  assert.equal(categoriesDistinctes([], [6]), false, 'sans catégorie');
  assert.equal(categoriesDistinctes([1, 3], [1, 6]), true, 'une commune, une propre chacun');
  const vocab = [v(1, 'Orios', 0, 0, null, { cle: 'orios-race', categories: [3] }), v(2, 'Orios', 0, 0, null, { cle: 'orios-classe', categories: [6] }), v(3, 'Elfe')];
  const r = (libelle, categories = new Map()) => examinerLesRenommages(vocab, [{ id: 3, avant: 'Elfe', libelle }], { categories });
  assert.deepEqual(r('Orios').aFusionner.map((x) => x.dans), [1], 'sans catégorie : la fusion se propose');
  assert.deepEqual(r('Orios', new Map([[3, [5]]])).aFusionner, [], 'une catégorie propre face à chacun : homonymes admis');
  assert.deepEqual(r('Orios', new Map([[3, [3]]])).aFusionner.map((x) => x.dans), [1], 'les mêmes catégories que l’un : fusion dans lui');
  assert.match(examinerLesRenommages(vocab, [{ id: 1, avant: 'Orios', libelle: 'Elfe' }, { id: 3, avant: 'Elfe', libelle: 'Orios' }]).erreur ?? '', /^$/, 'deux homonymes distincts échangés : aucune boucle');
  assert.match(examinerLesRenommages([v(1, 'A'), v(2, 'B')], [{ id: 1, avant: 'A', libelle: 'B' }, { id: 2, avant: 'B', libelle: 'A' }]).erreur, /s’échangent leurs noms/);
  assert.match(examinerLesRenommages([v(1, 'A'), v(2, 'B'), v(3, 'C')], [{ id: 1, avant: 'A', libelle: 'X' }, { id: 2, avant: 'B', libelle: 'x' }]).erreur, /sans catégorie qui les distingue/);
  // « Fusionner dans… » : un homonyme se choisit par sa clé (son libellé seul est ambigu, R232 (4))
  const cibles = vocab;
  assert.deepEqual([...ecrituresDesCibles(cibles)], [[1, 'orios-race'], [2, 'orios-classe'], [3, 'Elfe']]);
  assert.equal(cibleSaisie(cibles, 'ORIOS-CLASSE').id, 2);
  assert.equal(cibleSaisie(cibles, 'Orios'), null);
  assert.equal(cibleSaisie(cibles, 'elfe').id, 3);
  assert.deepEqual(synonymesSaisis('  IC \n\nAction  rapide\nic\n'), ['IC', 'Action rapide'], 'une par ligne, espaces réduites, sans doublon (normalize)');
  assert.deepEqual(synonymesSaisis(undefined), []);
  const listes = operationsDesListes([v(1, 'A', 0, 1, null, { synonymes: ['x'], categories: [2] }), v(2, 'B')],
    new Map([[1, { categories: [2], synonymes: ['y'] }], [2, { categories: [3, 1], synonymes: [] }]]));
  assert.deepEqual(listes, {
    categories: [{ op: 'categories_mot_cle', mot_cle: 2, categories: [1, 3], avant: [] }],
    synonymes: [{ op: 'synonymes_mot_cle', mot_cle: 1, synonymes: ['y'], avant: ['x'] }],
  }, 'un verrouillé : ses synonymes aussi (seule sa suppression est bloquée) ; des catégories triées');
  assert.equal(suppressionDeCategorieOfferte({ mots_cles: 0 }), true);
  assert.equal(suppressionDeCategorieOfferte({ mots_cles: 2 }), false);
});

// --- De bout en bout, contre le vrai service ----------------------------------------------------------------------------------------------------
// Le service (serveur/edition-chronologie.mjs, serveur/edition-mots-cles.mjs) refuse un homonyme sans catégorie qui le distingue (409) et une fusion ou
// une suppression d'un mot-clé déjà parti (404) : le lot que la page envoie doit libérer chaque écriture avant de la donner. Une copie de la base par
// test ; des mots-clés créés pour l'essai, à des noms absents de la base (les essais du site de dev peuvent l'avoir modifiée).
const racine = dossierTemporaire('edition-mots-cles');
let copies = 0;

/** Le service sur une copie neuve de la base, la page montée dessus en mode modification, et des mots-clés d'essai créés ({ nom: libellé }). */
async function surLeService(noms, options = {}) {
  const db = ouvrirBaseVivante(preparerBaseVivante({ regles: cheminBase(), dossier: join(racine, `b${(copies += 1)}`) }).chemin);
  const service = { base: () => db, etat: () => ({}), edition: true };
  const prise = (t) => {
    const k = normalize(t);
    return db.prepare('SELECT libelle FROM mot_cle').all().some((m) => normalize(m.libelle) === k)
      || Boolean(db.prepare('SELECT 1 FROM mot_cle WHERE cle = ? UNION ALL SELECT 1 FROM mot_cle_synonyme WHERE libelle_cle = ? UNION ALL SELECT 1 FROM mot_cle_ancienne_cle WHERE cle = ?').get(k, k, k));
  };
  const libre = (base) => {
    let t = base;
    for (let i = 2; prise(t); i += 1) t = `${base} ${i}`;
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
  /** Comme l'éditeur après un enregistrement : la sortie, puis le retour au crayon (les saisies repartent de la base). */
  const relire = async () => {
    p.ed.enEdition = false;
    p.motsCles.fin(p.ed);
    await attendre();
    p.editeurs.clear();
    p.ed.enEdition = true;
    p.motsCles.debut(p.ed);
    await attendre();
  };
  const motCle = (id) => db.prepare('SELECT id, libelle FROM mot_cle WHERE id = ?').get(id);
  return { ...p, db, service, mots, enregistrer, relire, motCle: (id) => (motCle(id) ? { ...motCle(id) } : null) };
}

test('service : rotation de noms (« A » prend un nom libre, « B » l’ancien nom de « A ») — aucune fusion proposée, le lot passe', async () => {
  // « B » est plus haut que « A » dans le tableau : la page doit quand même renommer « A » d'abord
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
  // le même lot, envoyé tel quel : refusé par le service, dans un ordre comme dans l'autre (un homonyme sans catégorie : R232 (9))
  for (const ordre of [[s.mots.A, s.mots.B], [s.mots.B, s.mots.A]]) {
    const [x, y] = ordre;
    const operations = [
      { op: 'modifier', table: 'mot_cle', cle: { id: x.id }, valeurs: { libelle: y.libelle }, avant: { libelle: x.libelle } },
      { op: 'modifier', table: 'mot_cle', cle: { id: y.id }, valeurs: { libelle: x.libelle }, avant: { libelle: y.libelle } },
    ];
    await assert.rejects(s.ed.appel('POST', 'edition/', { page: 'regles/glossaire/', operations }), (e) => e.statut === 409);
  }
});

test('service, R232 (2), (9) : « B » renommé comme « A », chacun sa catégorie cochée dans le même lot — deux homonymes, sans question ; leurs clés portent leur catégorie', async () => {
  const s = await surLeService({ A: 'Essai homonyme aa', B: 'Essai homonyme zz' });
  const { A, B } = s.mots;
  const [c1, c2] = s.db.prepare('SELECT id FROM categorie_mot_cle ORDER BY id LIMIT 2').all().map((c) => c.id);
  cocher(ligne(s.liste, A.id), c1);
  cocher(ligne(s.liste, B.id), c2);
  s.saisie(B.id).controle.value = A.libelle;
  const r = await s.enregistrer();
  assert.equal(r.probleme, undefined, r.probleme);
  assert.deepEqual(s.questions, [], 'aucune fusion proposée');
  assert.equal(r.refus, undefined, r.refus?.message);
  assert.deepEqual(r.operations.map((o) => o.op), ['categories_mot_cle', 'categories_mot_cle', 'modifier'], 'les catégories avant le renommage');
  const cle = (id) => s.db.prepare('SELECT cle FROM mot_cle WHERE id = ?').get(id).cle;
  const libelle = (id) => s.db.prepare('SELECT libelle FROM categorie_mot_cle WHERE id = ?').get(id).libelle;
  assert.equal(cle(A.id), `${normalize(A.libelle)}-${normalize(libelle(c1))}`);
  assert.equal(cle(B.id), `${normalize(A.libelle)}-${normalize(libelle(c2))}`);
  // relu : les deux lignes, au même libellé ; la balise à copier de chacun, sa clé
  await s.relire();
  assert.equal(ligne(s.liste, A.id).querySelector('.ed-mot-cle__balise').textContent, `{{${cle(A.id)}}}`);
  assert.equal(ligne(s.liste, B.id).querySelector('.ed-mot-cle__balise').textContent, `{{${cle(B.id)}}}`);
  // sans catégorie distinctive (« B » prend la catégorie de « A ») : le service refuse (409, `champ: 'categories'`) ; la page le dit
  cocher(ligne(s.liste, B.id), c2, false);
  cocher(ligne(s.liste, B.id), c1);
  const refus = await s.enregistrer();
  assert.equal(refus.refus?.statut, 409, refus.refus?.message);
  assert.equal(refus.refus.corps.champ, 'categories');
});

test('service, R233 : les synonymes saisis sur le Glossaire sont enregistrés dans l’ordre (vidés : aucun) ; le synonyme d’un autre mot-clé est refusé (409, `champ: synonymes`)', async () => {
  const s = await surLeService({ A: 'Essai synonymes', B: 'Essai voisin' });
  const { A, B } = s.mots;
  const lus = (id) => s.db.prepare('SELECT libelle FROM mot_cle_synonyme WHERE mot_cle_id = ? ORDER BY ordre, id').all(id).map((x) => x.libelle);
  const ecrire = (id, texte) => {
    synonymes(ligne(s.liste, id)).value = texte;
  };
  const ecrits = [`ZQX ${process.pid}`, `Ancien nom ${process.pid}`];
  ecrire(A.id, ecrits.join('\n'));
  let r = await s.enregistrer();
  assert.equal(r.refus, undefined, r.refus?.message);
  assert.deepEqual(lus(A.id), ecrits);
  await s.relire();
  assert.equal(synonymes(ligne(s.liste, A.id)).value, ecrits.join('\n'), 'relu : la saisie part de la base');
  // l'ordre changé : le même enregistré dans l'autre ordre
  ecrire(A.id, [...ecrits].reverse().join('\n'));
  r = await s.enregistrer();
  assert.equal(r.refus, undefined, r.refus?.message);
  assert.deepEqual(lus(A.id), [...ecrits].reverse());
  await s.relire();
  ecrire(B.id, ecrits[0].toLowerCase());
  r = await s.enregistrer();
  assert.equal(r.refus?.statut, 409, 'le synonyme d’un autre mot-clé');
  assert.equal(r.refus.corps.champ, 'synonymes');
  assert.deepEqual(lus(B.id), [], 'rien n’est écrit');
  await s.relire();
  ecrire(A.id, '');
  r = await s.enregistrer();
  assert.equal(r.refus, undefined, r.refus?.message);
  assert.deepEqual(lus(A.id), [], 'vidés : aucun');
});

test('service, R232 (5) : une catégorie créée, renommée, puis supprimée vide depuis le Glossaire ; une catégorie posée sur un mot-clé, et retirée', async () => {
  const s = await surLeService({ A: 'Essai catégorie' });
  const { A } = s.mots;
  const bloc = s.document.querySelector('.ed-categories-mots-cles');
  cliquer(bloc.querySelectorAll('button').find((b) => b.textContent === '+ Ajouter une catégorie'));
  const libelle = `Essai catégorie ${process.pid}`;
  await s.formulaires.at(-1).valider({ libelle });
  const c = s.db.prepare('SELECT id FROM categorie_mot_cle WHERE libelle = ?').get(libelle)?.id;
  assert.ok(Number.isInteger(c), 'créée tout de suite');
  cocher(ligne(s.liste, A.id), c);
  let r = await s.enregistrer();
  assert.equal(r.refus, undefined, r.refus?.message);
  assert.deepEqual(s.db.prepare('SELECT categorie_id FROM mot_cle_categorie WHERE mot_cle_id = ?').all(A.id).map((x) => x.categorie_id), [c]);
  await s.relire();
  assert.equal(s.document.querySelector(`li.ed-categorie-mot-cle[data-id="${c}"] .ed-categorie-mot-cle__supprimer`), null, 'non vide : pas de « Supprimer »');
  s.categorie(c).controle.value = `${libelle} bis`;
  cocher(ligne(s.liste, A.id), c, false);
  r = await s.enregistrer();
  assert.equal(r.refus, undefined, r.refus?.message);
  assert.equal(s.db.prepare('SELECT libelle FROM categorie_mot_cle WHERE id = ?').get(c).libelle, `${libelle} bis`);
  assert.equal(s.db.prepare('SELECT count(*) AS n FROM mot_cle_categorie WHERE mot_cle_id = ?').get(A.id).n, 0);
  await s.relire();
  cliquer(s.document.querySelector(`li.ed-categorie-mot-cle[data-id="${c}"] .ed-categorie-mot-cle__supprimer`));
  r = await s.enregistrer();
  assert.equal(r.refus, undefined, r.refus?.message);
  assert.equal(s.db.prepare('SELECT 1 FROM categorie_mot_cle WHERE id = ?').get(c), undefined, 'vide : supprimée');
});

test('service : fusions en chaîne mises en file à rebours (« X » dans « Y », puis « A » dans « X ») — jouées dans l’ordre, le lot passe', async () => {
  const s = await surLeService({ A: 'Essai fusion aa', X: 'Essai fusion mm', Y: 'Essai fusion zz' });
  const { A, X, Y } = s.mots;
  // la page ne permet pas cette file (« X » déjà en file n'est plus une cible) : le lot est fabriqué ici, puis rangé par l'extension
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
  // « X » supprimé d'abord : il n'est plus une cible de fusion
  cliquer(bouton(ligne(s.liste, X.id), 'ed-mot-cle__supprimer'));
  cliquer(bouton(ligne(s.liste, A.id), 'ed-mot-cle__fusionner'));
  let boite = s.document.body.querySelector('dialog');
  boite.querySelector('input').value = X.libelle;
  boite.querySelector('form').dispatchEvent(new Event('submit', { cancelable: true }));
  assert.equal(boite.querySelector('.ed-erreur').hidden, false, '« X » supprimé n’est pas proposé');
  boite.close();
  assert.deepEqual(s.motsCles.operations(s.ed, []).map((o) => o.op), ['supprimer'], 'la file : la suppression seule');
  // « A » fusionné dans « X » d'abord : « X » ne se supprime plus
  cliquer(bouton(ligne(s.liste, X.id), 'ed-mot-cle__supprimer')); // annule la suppression
  cliquer(bouton(ligne(s.liste, A.id), 'ed-mot-cle__fusionner'));
  boite = s.document.body.querySelector('dialog');
  boite.querySelector('input').value = X.libelle;
  boite.querySelector('form').dispatchEvent(new Event('submit', { cancelable: true }));
  cliquer(bouton(ligne(s.liste, X.id), 'ed-mot-cle__supprimer'));
  assert.equal(s.ed.annonces.at(-1)[1], 'erreur');
  assert.match(s.ed.annonces.at(-1)[0], /annulez cette fusion avant de le supprimer/);
  const r = await s.enregistrer();
  assert.equal(r.refus, undefined, r.refus?.message);
  assert.deepEqual(r.operations, [{ op: 'fusionner_mots_cles', mot_cle: A.id, dans: X.id }]);
  assert.equal(s.motCle(A.id), null);
  assert.deepEqual(s.motCle(X.id), { id: X.id, libelle: X.libelle });
});

test('R233 (8), R235 : les synonymes en « Aussi appelé » dans la ligne et en data-synonymes ; l’icône seule en première colonne (le RO, sans son abréviation en « Aussi appelé ») ; la définition en icônes ; au crayon, le choix de l’icône, désactivé sur un verrouillé', async () => {
  const avecSynonymes = [...VIVANT.slice(0, 3), v(20, 'Armure magique', 0, 0, 'Protège des sorts.', { synonymes: ['AM', 'Bouclier de mana'] }),
    v(21, 'Ricken d’or', 0, 1, '1 RO = 100 RF.', { monnaie_id: 'ro', icone: 'monnaie:ro', synonymes: ['RO'] })];
  const p = await monter({ vocabulaire: avecSynonymes });
  await p.motsCles.surcouche(p.ed, []);
  const am = ligne(p.liste, 'armure-magique');
  assert.equal(am.querySelector('.glossaire-mot__nom').textContent, 'Armure magique', 'le libellé seul (R233 (9))');
  assert.equal(am.querySelector('.glossaire-mot__synonymes').textContent, 'Aussi appelé : AM, Bouclier de mana');
  assert.equal(am.dataset.synonymes, '["AM","Bouclier de mana"]', 'la page les lit (filtre)');
  assert.equal(am.querySelector('.glossaire-mot__icone').innerHTML, '', 'sans icône : la case vide');
  assert.equal(ligne(p.liste, 'aide').querySelector('.glossaire-mot__synonymes'), null, 'sans synonyme : rien');
  const ro = ligne(p.liste, 'ricken-dor');
  assert.equal(ro.querySelector('.glossaire-mot__nom').textContent, 'Ricken d’or', 'le nom : le libellé seul (l’icône a sa colonne)');
  assert.equal(ro.querySelector('.glossaire-mot__synonymes'), null, 'l’abréviation de sa monnaie n’est pas un « Aussi appelé » (R234 (8), R235 (4))');
  const piece = el('div');
  piece.innerHTML = htmlDePiece('RO'); // relu comme le navigateur (les entités réécrites)
  assert.equal(ro.children[0].children[0].className, 'glossaire-mot__icone', 'la première colonne');
  assert.equal(ro.querySelector('.glossaire-mot__icone').innerHTML, piece.innerHTML, 'l’icône seule, celle de lib/monnaies.mjs');
  const definition = ro.querySelector('.glossaire-mot__definition');
  assert.ok(definition.querySelector('.piece.piece--ro') && definition.querySelector('.piece.piece--rf'), 'les monnaies en icônes (R63)');
  assert.doesNotMatch(definition.textContent, /R[OF]/, 'plus d’abréviation visible');
  assert.equal(am.querySelector('.glossaire-mot__definition').innerHTML, 'Protège des sorts.');
  p.ed.enEdition = true;
  p.motsCles.debut(p.ed);
  await attendre();
  assert.equal(p.icone('ricken-dor').controle.value, 'monnaie:ro', 'la saisie part de la base vivante');
  assert.equal(p.icone('ricken-dor').controle.disabled, false, 'verrouillé : son icône se change (seule sa suppression est bloquée)');
  assert.equal(p.icone('armure-magique').controle.disabled, false);
});

test('migration 0098 : la lecture (le lien en colonne Lien, le liseré de la couleur) ; au crayon, l’adresse et la couleur de chaque mot-clé, saisies communes (modifiables aussi pour un mot-clé verrouillé), parties de la base vivante', async () => {
  const colores = [{ ...v(30, 'Elfe', 4, 0, 'Un peuple.'), url: '/races/elfe/', couleur: 'race:pure' }, ...VIVANT];
  const p = await monter({ vocabulaire: colores });
  await p.motsCles.surcouche(p.ed, []);
  const elfe = ligne(p.liste, 'elfe');
  assert.deepEqual([elfe.dataset.url, elfe.dataset.couleur], ['/races/elfe/', 'race:pure']);
  assert.equal(elfe.querySelector('.glossaire-mot__lien a').href, '/races/elfe/');
  assert.ok(elfe.children.every((tr) => tr.classList.contains('ligne-couleur') && tr.classList.contains('couleur-race-pure')), 'les deux lignes : le liseré de sa couleur');
  assert.equal(ligne(p.liste, 'feu').querySelector('.glossaire-mot__lien a'), null, 'sans adresse : pas de lien');
  assert.ok(ligne(p.liste, 'feu').children.every((tr) => !tr.classList.contains('ligne-couleur')), 'sans couleur : pas de liseré');
  p.ed.enEdition = true;
  p.motsCles.debut(p.ed);
  await attendre();
  const gestion = ligne(p.liste, 'elfe');
  assert.ok(gestion.querySelector('.ed-mot-cle__lien-case .ed-mot-cle__lien[data-ed]'), 'l’adresse, dans la colonne Lien');
  assert.deepEqual(gestion.querySelector('.ed-mot-cle__suite-case').children.map((c) => c.className), ['ed-mot-cle__couleur', 'ed-mot-cle__definition'], 'dessous : la couleur, puis la définition');
  assert.deepEqual([p.adresse('elfe').controle.value, p.couleur('elfe').controle.value], ['/races/elfe/', 'race:pure'], 'la saisie part de la base vivante');
  assert.deepEqual([p.adresse('feu').controle.value, p.couleur('feu').controle.value], ['', ''], 'sans adresse ni couleur : vides');
  assert.ok(p.adresse('magique') && p.couleur('magique'), 'verrouillé : son adresse et sa couleur montrées…');
  assert.ok(!p.adresse('magique').controle.disabled && !p.couleur('magique').controle.disabled, '… et modifiables (seule sa suppression est bloquée)');
  const lue = p.ed.lignes.get(cleDeLigne('mot_cle', { id: I.feu }));
  assert.deepEqual([lue.url, lue.couleur], [null, null], 'NULL tel qu’enregistré');
});

test('service : l’adresse et la couleur saisies sur le Glossaire sont enregistrées (vidées : NULL) ; une couleur ou une adresse mal écrite est refusée (400, `champ`)', async () => {
  const s = await surLeService({ A: 'Essai couleur' });
  const { A } = s.mots;
  const valeurs = () => ({ ...s.db.prepare('SELECT url, couleur FROM mot_cle WHERE id = ?').get(A.id) });
  const avec = async (saisies) => {
    for (const [colonne, valeur] of Object.entries(saisies)) (colonne === 'url' ? s.adresse(A.id) : s.couleur(A.id)).controle.value = valeur;
    const r = await s.enregistrer();
    await s.relire();
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
const AVEC_MENTIONS = VIVANT.map((m) => (MENTIONS[m.cle] ? { ...m, mentions: MENTIONS[m.cle] } : m));

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

test('R233 (11) : « Fusionner dans… » ne propose pas un mot-clé verrouillé quand la source a au moins un synonyme ; sans synonyme, si (R219 (4))', () => {
  const vocab = [v(1, 'Source', 0, 0, null, { synonymes: ['Src'] }), v(2, 'Sans synonyme'), v(3, 'Verrouillé', 0, 1), v(4, 'Libre')];
  assert.deepEqual(ciblesDeFusion(vocab, 1).map((m) => m.id), [2, 4], 'avec un synonyme : pas le verrouillé');
  assert.deepEqual(ciblesDeFusion(vocab, 2).map((m) => m.id), [1, 3, 4], 'sans synonyme : le verrouillé est une cible');
  assert.deepEqual(ciblesDeFusion(vocab, 2, { retires: new Set([4]) }).map((m) => m.id), [1, 3]);
});

test('décision R196 (2), au crayon : chaque mot-clé a le menu de ses mentions (pages en liens), verrouillé compris ; « Supprimer » seulement pour une liste vide', async () => {
  const p = await monter({ vocabulaire: AVEC_MENTIONS });
  await p.motsCles.surcouche(p.ed, []);
  assert.equal(p.liste.querySelector('.ed-mot-cle__mentions'), null, 'hors du mode modification : pas de menu de gestion');
  assert.deepEqual(ligne(p.liste, 'aide').querySelectorAll('.glossaire-mot__menu li').map((li) => li.textContent), ['Essai', 'Démo'],
    'mais le menu des pages du tableau (R234 (3) : seulement les pages)');
  p.ed.enEdition = true;
  p.motsCles.debut(p.ed);
  await attendre();
  const aide = ligne(p.liste, 'aide');
  const menu = aide.querySelector('details.ed-mot-cle__mentions');
  assert.ok(menu?.querySelector('summary'), 'un menu déroulant');
  const items = menu.querySelectorAll('li');
  assert.equal(items.length, 3, 'un endroit par page ou par texte : en mode modification, toutes les mentions (R196, R223)');
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
  assert.deepEqual(p.motsCles.operations(p.ed, []), [{ op: 'fusionner_mots_cles', mot_cle: I.aide, dans: I.feu }]);
  // un mot-clé créé : non verrouillé (R219 (5)), rien ne le mentionne
  cliquer(p.document.querySelector('.ed-outils-mots-cles').querySelector('button'));
  await p.formulaires[0].valider({ libelle: 'Bestiaire', description: '' });
  const cree = ligne(p.liste, 'bestiaire');
  assert.equal(cree.hasAttribute('data-verrou'), false);
  assert.ok(cree.querySelector('.ed-mot-cle__mentions').hasAttribute('data-vide'));
  assert.ok(bouton(cree, 'ed-mot-cle__supprimer') && !p.saisie('bestiaire').controle.disabled);
});

test('décisions R218, R219 (4), contre le service : un mot-clé verrouillé (verrou = 1 dans la copie) garde ses champs modifiables sur la page (seule sa suppression est bloquée) et reçoit la fusion d’un autre', async () => {
  const s = await surLeService({ A: 'Essai verrou aa', B: 'Essai verrou zz' }, {});
  const { A, B } = s.mots;
  // A verrouillé dans la copie (aucune route n'écrit `verrou` : seule une migration le fait), la page relue au crayon
  s.db.prepare('UPDATE mot_cle SET verrou = 1 WHERE id = ?').run(A.id);
  await s.relire();
  const a = ligne(s.liste, A.id);
  assert.ok(a.hasAttribute('data-verrou'), 'le verrou lu dans GET /api/edition/mots-cles/');
  assert.equal(a.querySelector('button'), null);
  assert.equal(s.saisie(A.id).controle.disabled, false);
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
  const forcages = new Set([I.aide]);
  const ops = operationsDuVocabulaire([renommer(I.aide, 'aide', 'Aide 2'), renommer(I.peuple, 'peuple', 'Peuples')], {
    suppressions: new Set([I.feu]), forcages, fusions: new Map([[I.guide, I.peuple]]), vocabulaire,
  });
  assert.deepEqual(ops.slice(0, 3), [
    { op: 'fusionner_mots_cles', mot_cle: I.guide, dans: I.peuple },
    { op: 'supprimer', entite: 'mot_cle', cle: { id: I.feu } },
    { op: 'supprimer', entite: 'mot_cle', cle: { id: I.aide }, forcer: true },
  ], 'fusions, suppressions, puis les forcées');
  assert.deepEqual(ids(ops.slice(3)), [`${I.peuple}→Peuples`], 'le renommage d’un mot-clé supprimé en forçant est retiré');
  assert.match(erreurDesRetraits(vocabulaire, { forcages: new Set([I.guide]), fusions: new Map([[I.aide, I.guide]]) }), /reçoit « aide » \(fusion\) et serait supprimé/);
  assert.equal(erreurDesRetraits(vocabulaire, { forcages, fusions: new Map([[I.peuple, I.guide]]) }), null);
  const avecMentions = vocabulaire.map((m) => (m.id === I.aide ? { ...m, mentions: MENTIONS.aide } : m));
  const message = confirmationDesRetraits(avecMentions, { forcages });
  const ligneForcee = message.split('\n').find((l) => l.includes('« aide »'));
  assert.ok(ligneForcee.includes('R223'), ligneForcee);
  assert.ok(ligneForcee.includes(ceQueRemplaceLeForcage({ mentions: MENTIONS.aide }).texte), 'le nombre et les endroits des mentions');
  assert.equal(confirmationDesRetraits(avecMentions, { forcages: new Set() }), null);
});

test('décision R223, au crayon : « Forcer la suppression » pour un mot-clé mentionné, jamais pour un verrouillé ; refus prévu : la raison à la place ; la file et le lot', async () => {
  const vocab = AVEC_MENTIONS.map((m) => (m.cle === 'peuple' ? { ...m, mentions: [PAGE_DE_REGLE], refus_du_forcage: RAISON } : m));
  const p = await monter({ vocabulaire: vocab });
  await p.motsCles.surcouche(p.ed, []);
  p.ed.enEdition = true;
  p.motsCles.debut(p.ed);
  await attendre();
  const aide = ligne(p.liste, 'aide');
  const forcer = bouton(aide, 'ed-mot-cle__forcer');
  assert.ok(forcer, 'mentionné : le forçage est proposé');
  assert.equal(bouton(aide, 'ed-mot-cle__supprimer'), null, 'mentionné : pas de « Supprimer » ordinaire');
  assert.ok(forcer.title.includes(ceQueRemplaceLeForcage(vocab.find((m) => m.cle === 'aide')).texte), 'l’infobulle dit ce qui sera remplacé');
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
  assert.ok(p.questions.at(-1).includes(ceQueRemplaceLeForcage(vocab.find((m) => m.cle === 'aide')).texte), 'la confirmation compte les mentions');
  assert.deepEqual(p.motsCles.operations(p.ed, []), [{ op: 'supprimer', entite: 'mot_cle', cle: { id: I.aide }, forcer: true }]);
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
  const cle = (id) => s.db.prepare('SELECT cle FROM mot_cle WHERE id = ?').get(id).cle;
  // B cite A, D cite C (par leur clé), par le chemin normal d'une modification ; puis D verrouillé dans la copie (aucune route n'écrit `verrou`)
  for (const [qui, cite] of [[B, A], [D, C]]) {
    const r = traiter({ methode: 'POST', chemin: '/api/edition/', entetes: { 'content-type': 'application/json' }, corps: JSON.stringify({ page: 'regles/glossaire/',
      operations: [{ op: 'modifier', table: 'mot_cle', cle: { id: qui.id }, valeurs: { description: `Voir {{${cle(cite.id)}|texte affiché d’essai}}.` }, avant: { description: null } }] }) }, s.service);
    assert.equal(r.statut, 200, JSON.stringify(r.corps));
  }
  s.db.prepare('UPDATE mot_cle SET verrou = 1 WHERE id = ?').run(D.id);
  await s.relire();
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
