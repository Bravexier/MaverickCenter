// L'extension de l'éditeur pour les panneaux de règles (src/scripts/edition/panneaux.mjs, migration 0055 ; demande du propriétaire, 2026-10-16 : « Il
// faudrait que ce champ texte soit modifiable sur son titre, et son contenu. Son contenu peut d'ailleurs inclure des tuiles génériques (toujours
// insérables / modifiables en mode édition) »), exécutée dans un faux navigateur (test/aide-faux-dom.mjs) avec un faux éditeur, sur des blocs rendus
// comme au build (test/aide-rendu-du-site.mjs) : l'entrée en mode modification (panneau ouvert, outils, flèches), les opérations du lot après « ↑ » / « ↓ »,
// « Supprimer » (le titre d'une tuile supprimée quitte le lot), une modification de texte, rien quand on ne retouche rien (le Markdown relu au départ
// fait foi, pas le texte de la base : apostrophes, espaces), la création d'un bloc après un autre, l'abandon (textes et ordre d'avant), la surcouche
// (`ligne` : texte changé → bloc refait, ligne nulle → bloc retiré, ordre seul → bloc déplacé), et la course entre la surcouche et l'entrée en mode
// modification. Reste hors de ces tests : la sélection et les commandes de mise en forme du navigateur (execCommand, barre d'outils de texte-en-place.mjs),
// le collage, et la mise en page en colonnes (CSS).
//   node --test test/edition-panneaux.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { avecPhraseDesArmesDeDepart } from '../src/lib/armes-rendu.mjs';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { attributEd, cleDeLigne } from '../src/lib/edition-modele.mjs';
import { arbreDuDom, versMarkdown } from '../src/lib/markdown-edition.mjs';
import { chargerVocabulaire } from '../src/lib/mots-cles-db.mjs';
import { chargerPanneaux } from '../src/lib/panneaux-regles-db.mjs';
import { empreinteDuTexte, htmlDesBlocs } from '../src/lib/panneaux-regles-rendu.mjs';
import { attendre, cliquer, el, fauxDocument } from './aide-faux-dom.mjs';
import { rendreCommeLaPage } from './aide-rendu-du-site.mjs';

const VOCABULAIRE = [{ id: 'recharge-longue', libelle: 'Recharge longue', libelle_cle: 'recharge longue', description: 'Doit utiliser son action pour recharger.' }];
const bloc = (rang, ordre, valeurs = {}) => ({ panneau_id: 'armes', rang, ordre, tuile: 0, titre: null, texte: `Texte du bloc ${rang}.`, ...valeurs });
// dans l'ordre de lecture de la base : rangs 1, 2, 4, 3 (le rang est une clé, l'ordre la place ; un trou après 3)
const BLOCS = [
  bloc(1, 1, { texte: "Toutes les armes ont de base 2 crans de solidité,  les armes l'ont." }),
  bloc(2, 2, { tuile: 1, texte: '{{recharge-longue:}}' }),
  bloc(4, 3, { tuile: 1, titre: 'Dague', texte: '- Divise par 2 le malus.' }),
  bloc(3, 5, { texte: 'Pour **recycler** une arme.' }),
];

/** Le `<details>` d'un panneau tel que components/equipement/PanneauDeRegles.astro l'écrit, ses blocs rendus comme au build. */
async function panneauDeLaPage(id, titre, blocs, { vocabulaire = VOCABULAIRE, retouche = (h) => h } = {}) {
  const rendus = [];
  for (const b of blocs) rendus.push({ ...b, html: retouche(await rendreCommeLaPage(b.texte, vocabulaire)) });
  const corps = el('div', { class: 'prose preg__corps', 'data-preg-corps': '' });
  corps.innerHTML = htmlDesBlocs(rendus);
  return el('details', { class: 'preg', id: `regles-${id}`, 'data-panneau-regles': id },
    el('summary', { class: 'preg__titre' }, el('span', { 'data-ed': attributEd('panneau_regles', { id }, 'titre') }, titre)), corps);
}

let numero = 0;
/**
 * La page (des panneaux), un faux éditeur et l'extension chargée à neuf. `lignes` : celles de la base vivante (par défaut, les blocs de la page) ;
 * `reponse(corps)` : ce que POST /api/edition/ rend.
 */
async function monter({ panneaux = null, lignes = null, reponse = () => ({ crees: [], lignes: [] }) } = {}) {
  const details = panneaux ?? [await panneauDeLaPage('armes', 'Règles des armes', BLOCS, { retouche: avecPhraseDesArmesDeDepart })];
  const document = fauxDocument(el('main', {}, ...details));
  const questions = [];
  const confirmations = [];
  Object.assign(globalThis, {
    document,
    confirm: (q) => {
      questions.push(q);
      return confirmations.length ? confirmations.shift() : true;
    },
  });
  const appels = [];
  const formulaires = [];
  const ed = {
    base: '/',
    page: 'ressources/equipement/',
    enEdition: false,
    lignes: new Map(),
    annonces: [],
    modifie: false,
    annoncer(message, genre) { this.annonces.push([message, genre]); },
    marquerModifie() { this.modifie = true; },
    monterChamps() {},
    formulaire(f) { formulaires.push(f); },
    async appel(methode, chemin, corps) {
      appels.push([methode, chemin, corps]);
      if (chemin === 'edition/pages/') return { pages: [] };
      return reponse(corps);
    },
  };
  const { panneaux: extension } = await import(`../src/scripts/edition/panneaux.mjs?page=${(numero += 1)}`);
  const toutes = lignes ?? BLOCS;
  const entrer = () => {
    ed.lignes = new Map(toutes.map((l) => [cleDeLigne('panneau_regles_bloc', { panneau_id: l.panneau_id, rang: l.rang }), { ...l }]));
    ed.enEdition = true;
    extension.debut(ed);
  };
  const quitter = () => {
    extension.fin(ed);
    ed.enEdition = false;
  };
  const corps = (id = 'armes') => document.querySelector(`[data-panneau-regles="${id}"]`).querySelector('[data-preg-corps]');
  const elements = (id) => corps(id).querySelectorAll(':scope > .preg-bloc[data-preg-bloc]');
  const rangs = (id) => elements(id).map((x) => Number(x.dataset.pregBloc));
  const blocDe = (rang, id) => elements(id).find((x) => Number(x.dataset.pregBloc) === rang);
  const zone = (rang, id) => blocDe(rang, id).querySelector(':scope > .preg-bloc__texte');
  const outil = (rang, attribut, id) => blocDe(rang, id).querySelector(`[${attribut}]`);
  const boutonNomme = (rang, texte, id) => blocDe(rang, id).querySelector('.ed-preg-outils').children.find((b) => b.textContent === texte);
  return { extension, ed, document, details, appels, formulaires, questions, confirmations, entrer, quitter, corps, rangs, blocDe, zone, outil, boutonNomme };
}

const ordre = (rang, valeur, avant) => ({ op: 'modifier', table: 'panneau_regles_bloc', cle: { panneau_id: 'armes', rang }, valeurs: { ordre: valeur }, avant: { ordre: avant } });

test('à l’entrée : le panneau s’ouvre, chaque bloc a ses outils, « ↑ » grisé en tête et « ↓ » en fin ; sans retouche, aucune opération (le Markdown relu au départ fait foi, pas le texte de la base)', async () => {
  const p = await monter();
  assert.equal(p.extension.actif(p.document), true);
  assert.deepEqual(p.extension.lignesACharger().map((l) => l.cle), [1, 2, 4, 3].map((rang) => ({ panneau_id: 'armes', rang })));
  assert.equal(p.details[0].open, false);
  p.entrer();
  assert.equal(p.details[0].open, true);
  assert.deepEqual(p.rangs(), [1, 2, 4, 3]);
  for (const r of [1, 2, 4, 3]) assert.ok(p.blocDe(r).querySelector('.ed-preg-outils'), `bloc ${r} : ses outils`);
  assert.deepEqual([1, 2, 4, 3].map((r) => [p.outil(r, 'data-preg-monter').disabled, p.outil(r, 'data-preg-descendre').disabled]),
    [[true, false], [false, false], [false, false], [false, true]]);
  assert.ok(p.document.body.querySelector('.ed-barre-guide'), 'la barre d’outils du texte');
  // le Markdown relu n'est pas le texte de la base (apostrophe typographique, espaces) : le comparer à la base ferait un faux changement
  const relu = versMarkdown(p.zone(1).childNodes.map(arbreDuDom).filter(Boolean));
  assert.notEqual(relu.trim(), BLOCS[0].texte);
  assert.match(relu, /l’ont\./);
  assert.equal(versMarkdown(p.zone(2).childNodes.map(arbreDuDom).filter(Boolean)), '{{recharge-longue:}}\n', 'la tuile du glossaire relue en balise');
  assert.equal(p.extension.verifier(p.ed), null);
  assert.deepEqual(p.extension.operations(p.ed, []), []);
  assert.equal(p.questions.length, 0);
});

test('« ↑ » et « ↓ » : le bloc change de place avec son voisin, les ordres de la base redistribués à l’enregistrement ; revenir à l’ordre de départ n’envoie rien', async () => {
  const p = await monter();
  p.entrer();
  cliquer(p.outil(1, 'data-preg-descendre'));
  assert.deepEqual(p.rangs(), [2, 1, 4, 3]);
  assert.equal(p.ed.modifie, true);
  assert.deepEqual([p.outil(2, 'data-preg-monter').disabled, p.outil(1, 'data-preg-monter').disabled], [true, false], 'les flèches suivent');
  assert.deepEqual(p.extension.operations(p.ed, []), [ordre(2, 1, 2), ordre(1, 2, 1)]);
  cliquer(p.outil(1, 'data-preg-monter'));
  assert.deepEqual(p.rangs(), [1, 2, 4, 3]);
  assert.deepEqual(p.extension.operations(p.ed, []), [], 'l’ordre de départ : rien à écrire');
  // la Dague (ordre 3) descend sous le bloc 3 (ordre 5) : ils échangent leurs ordres, le trou reste
  cliquer(p.outil(4, 'data-preg-descendre'));
  assert.deepEqual(p.rangs(), [1, 2, 3, 4]);
  assert.deepEqual(p.extension.operations(p.ed, []), [ordre(3, 3, 5), ordre(4, 5, 3)]);
  // le dernier ne descend pas plus bas, le premier ne monte pas plus haut
  cliquer(p.outil(4, 'data-preg-descendre'));
  cliquer(p.outil(1, 'data-preg-monter'));
  assert.deepEqual(p.rangs(), [1, 2, 3, 4]);
});

test('« Supprimer » : à l’enregistrement, après confirmation ; le titre de la tuile supprimée quitte le lot ; un second clic l’annule ; pas tous les blocs', async () => {
  const p = await monter();
  p.entrer();
  const supprimer = p.boutonNomme(4, 'Supprimer');
  cliquer(supprimer);
  assert.ok(p.zone(4).classList.contains('ed-supprime'));
  assert.equal(supprimer.getAttribute('aria-pressed'), 'true');
  assert.equal(supprimer.textContent, 'Sera supprimé — annuler');
  // les champs communs du lot : le titre de la Dague (le bloc supprimé) et celui du panneau
  const titreDague = { op: 'modifier', table: 'panneau_regles_bloc', cle: { panneau_id: 'armes', rang: 4 }, valeurs: { titre: 'Dague courte' }, avant: { titre: 'Dague' } };
  const titrePanneau = { op: 'modifier', table: 'panneau_regles', cle: { id: 'armes' }, valeurs: { titre: 'Autre titre' }, avant: { titre: 'Règles des armes' } };
  assert.deepEqual(p.extension.operations(p.ed, [titreDague, titrePanneau]), [
    titrePanneau,
    { op: 'supprimer', entite: 'panneau_regles_bloc', cle: { panneau_id: 'armes', rang: 4 } },
  ], 'ni le titre du bloc supprimé, ni d’ordre à changer : les autres blocs se lisent dans le même ordre');
  p.confirmations.push(false);
  assert.match(p.extension.verifier(p.ed), /Suppression annulée/);
  assert.equal(p.questions.at(-1), 'Supprimer ce bloc des règles ?');
  assert.equal(p.extension.verifier(p.ed), null, 'confirmé');
  cliquer(supprimer);
  assert.equal(supprimer.textContent, 'Supprimer');
  assert.ok(!p.zone(4).classList.contains('ed-supprime'));
  assert.deepEqual(p.extension.operations(p.ed, [titreDague]), [titreDague], 'suppression annulée : le titre repart');
  for (const r of [1, 2, 4, 3]) cliquer(p.boutonNomme(r, 'Supprimer'));
  assert.match(p.extension.verifier(p.ed), /garde au moins un bloc/);
});

test('une modification de texte : le Markdown de la zone, `avant` = le texte de la base ; un bloc vidé est refusé ; un conflit (409) prend la ligne actuelle pour référence', async () => {
  const p = await monter();
  p.entrer();
  p.zone(3).innerHTML = '<p>Pour <strong>recycler</strong> une arme, il faut un forgeron.</p>';
  const attendue = { op: 'modifier', table: 'panneau_regles_bloc', cle: { panneau_id: 'armes', rang: 3 }, valeurs: { texte: 'Pour **recycler** une arme, il faut un forgeron.\n' }, avant: { texte: 'Pour **recycler** une arme.' } };
  assert.deepEqual(p.extension.operations(p.ed, []), [attendue], 'seul le bloc modifié ; la tuile du glossaire, intacte, ne part pas');
  const message = p.extension.conflit(p.ed, { corps: { table: 'panneau_regles_bloc', cle: { panneau_id: 'armes', rang: 3 }, ligne: { ...BLOCS[3], texte: 'Changé ailleurs.' } } });
  assert.match(message, /a changé entre-temps/);
  assert.deepEqual(p.extension.operations(p.ed, [])[0].avant, { texte: 'Changé ailleurs.' }, 'la saisie reste, la référence suit');
  assert.equal(p.extension.conflit(p.ed, { corps: { table: 'metier', cle: { id: 'x' }, ligne: {} } }), null, 'un autre conflit ne la regarde pas');
  p.zone(1).innerHTML = '<p><br></p>';
  assert.match(p.extension.verifier(p.ed), /bloc de règles est vide/);
});

test('abandon : les textes et l’ordre d’avant reviennent, les outils et la barre partent, le panneau se referme', async () => {
  const p = await monter();
  const avant = [1, 2, 4, 3].map((r) => p.zone(r).innerHTML);
  p.entrer();
  cliquer(p.outil(1, 'data-preg-descendre'));
  cliquer(p.outil(3, 'data-preg-monter'));
  p.zone(1).innerHTML = '<p>Tout autre chose.</p>';
  cliquer(p.boutonNomme(2, 'Supprimer'));
  assert.deepEqual(p.rangs(), [2, 1, 3, 4]);
  p.quitter();
  assert.deepEqual(p.rangs(), [1, 2, 4, 3], 'l’ordre de lecture de la base');
  assert.deepEqual([1, 2, 4, 3].map((r) => p.zone(r).innerHTML), avant, 'les textes d’avant');
  assert.equal(p.corps().querySelector('.ed-preg-outils'), null);
  assert.equal(p.document.body.querySelector('.ed-barre-guide'), null);
  assert.ok([1, 2, 4, 3].every((r) => !p.zone(r).classList.contains('ed-supprime') && !p.zone(r).classList.contains('ed-texte-guide')));
  assert.equal(p.details[0].open, false, 'replié comme avant');
});

test('« + Tuile » : créée tout de suite après ce bloc, montée pour la saisie ; les blocs repoussés gardent leur place de la base pour les déplacements suivants', async () => {
  const nouvelle = bloc(10, 3, { tuile: 1, titre: 'Nouvelle tuile', texte: 'Texte de la tuile.' });
  const p = await monter({
    reponse: () => ({
      crees: [{ entite: 'panneau_regles_bloc', id: 'armes#10' }],
      lignes: [
        { table: 'panneau_regles_bloc', cle: { panneau_id: 'armes', rang: 4 }, ligne: { ...BLOCS[2], ordre: 4 } },
        { table: 'panneau_regles_bloc', cle: { panneau_id: 'armes', rang: 10 }, ligne: nouvelle },
      ],
    }),
  });
  p.entrer();
  cliquer(p.boutonNomme(2, '+ Tuile'));
  assert.equal(p.formulaires.length, 1);
  assert.deepEqual(p.formulaires[0].champs.map((c) => c.nom), ['titre', 'texte']);
  await p.formulaires[0].valider({ titre: 'Nouvelle tuile', texte: 'Texte de la tuile.' });
  const [, chemin, corps] = p.appels.find(([m]) => m === 'POST');
  assert.equal(chemin, 'edition/');
  assert.deepEqual(corps.operations, [{ op: 'creer', entite: 'panneau_regles_bloc', valeurs: { panneau_id: 'armes', tuile: '1', titre: 'Nouvelle tuile', texte: 'Texte de la tuile.', apres: 2 } }]);
  assert.deepEqual(p.rangs(), [1, 2, 10, 4, 3], 'juste après le bloc 2');
  const cree = p.blocDe(10);
  assert.ok(cree.classList.contains('ed-nouveau'));
  assert.ok(cree.querySelector('.ed-preg-outils'), 'avec ses outils');
  assert.equal(cree.querySelector('.preg-bloc__titre').hidden, false);
  assert.equal(p.blocDe(4).dataset.pregOrdre, '4', 'la Dague repoussée');
  assert.equal(p.ed.annonces.at(-1)[0], 'Tuile ajoutée.');
  assert.deepEqual(p.extension.operations(p.ed, []), [], 'rien de plus à écrire');
  // la nouvelle tuile descend sous la Dague : leurs ordres dans la base (3 et 4) s'échangent
  cliquer(p.outil(10, 'data-preg-descendre'));
  assert.deepEqual(p.extension.operations(p.ed, []), [ordre(4, 3, 4), ordre(10, 4, 3)]);
});

test('surcouche hors mode modification (`ligne`) : texte changé → bloc refait ; ligne nulle → bloc retiré ; ordre seul → le même bloc déplacé ; bloc nouveau → à sa place', async () => {
  const p = await monter();
  const un = p.blocDe(1);
  p.extension.ligne(p.ed, 'panneau_regles_bloc', { panneau_id: 'armes', rang: 1 }, { ...BLOCS[0], ordre: 4 });
  assert.equal(p.blocDe(1), un, 'le même élément');
  assert.equal(un.dataset.pregOrdre, '4');
  assert.deepEqual(p.rangs(), [2, 4, 1, 3]);
  const trois = p.blocDe(3);
  p.extension.ligne(p.ed, 'panneau_regles_bloc', { panneau_id: 'armes', rang: 3 }, { ...BLOCS[3], texte: '**Les armes en bleu sont les armes de départ.**' });
  await attendre();
  assert.notEqual(p.blocDe(3), trois, 'refait');
  assert.equal(p.blocDe(3).dataset.pregEmpreinte, empreinteDuTexte('**Les armes en bleu sont les armes de départ.**'));
  assert.equal(p.zone(3).innerHTML, '<p class="armes__phrase-depart"><strong>Les armes en bleu sont les armes de départ.</strong></p>', 'la retouche du panneau des armes, comme au build');
  p.extension.ligne(p.ed, 'panneau_regles_bloc', { panneau_id: 'armes', rang: 2 }, null);
  assert.equal(p.blocDe(2), undefined, 'retiré');
  p.extension.ligne(p.ed, 'panneau_regles_bloc', { panneau_id: 'armes', rang: 9 }, bloc(9, 1, { tuile: 1, titre: 'Créée ailleurs', texte: 'Une tuile.' }));
  await attendre();
  assert.deepEqual(p.rangs(), [9, 4, 1, 3], 'à sa place de lecture (ordre 1, avant la Dague à l’ordre 3)');
  assert.ok(p.blocDe(9).classList.contains('preg-bloc--tuile'));
  // une autre table, un panneau absent : rien
  p.extension.ligne(p.ed, 'metier', { id: 'x' }, null);
  p.extension.ligne(p.ed, 'panneau_regles_bloc', { panneau_id: 'accessoires', rang: 1 }, null);
  assert.deepEqual(p.rangs(), [9, 4, 1, 3]);
  // en mode modification, la surcouche ne touche à rien (les blocs sont montés pour la saisie)
  p.entrer();
  p.extension.ligne(p.ed, 'panneau_regles_bloc', { panneau_id: 'armes', rang: 4 }, null);
  assert.ok(p.blocDe(4));
});

test('course : le mode modification commencé pendant le rendu d’un bloc ne le remplace pas sous la saisie ; il est refait à la sortie, sauf si une ligne plus récente l’a été', async () => {
  const p = await monter();
  const cle = { panneau_id: 'armes', rang: 3 };
  p.extension.ligne(p.ed, 'panneau_regles_bloc', cle, { ...BLOCS[3], texte: 'Refait pendant l’entrée.' });
  p.entrer(); // pendant que la surcouche rend le bloc (la liste des pages du wiki se lit sur le réseau)
  const monte = p.blocDe(3);
  await attendre();
  assert.equal(p.blocDe(3), monte, 'le bloc monté pour la saisie reste');
  assert.ok(monte.querySelector('.ed-preg-outils'));
  assert.deepEqual(p.extension.operations(p.ed, []), [], 'rien à écrire');
  p.quitter();
  await attendre();
  await attendre();
  assert.notEqual(p.blocDe(3), monte, 'refait à la sortie');
  assert.match(p.zone(3).textContent, /Refait pendant l’entrée\./);
  // remis à plus tard, puis une ligne plus récente (celle d'un enregistrement) : la plus récente gagne
  p.extension.ligne(p.ed, 'panneau_regles_bloc', cle, { ...BLOCS[3], texte: 'Ancienne.' });
  p.entrer();
  await attendre();
  p.quitter();
  p.extension.ligne(p.ed, 'panneau_regles_bloc', cle, { ...BLOCS[3], texte: 'Plus récente.' });
  await attendre();
  await attendre();
  assert.match(p.zone(3).textContent, /Plus récente\./);
});

test('les cinq panneaux de la base, rendus comme au build : entrer en mode modification puis enregistrer sans rien retoucher n’envoie aucune opération', async () => {
  const db = ouvrirBase({ sansExemples: false });
  const vocabulaire = chargerVocabulaire(db);
  const panneaux = chargerPanneaux(db);
  const details = [];
  for (const x of panneaux) details.push(await panneauDeLaPage(x.id, x.titre, x.blocs, { vocabulaire, retouche: x.id === 'armes' ? avecPhraseDesArmesDeDepart : undefined }));
  const p = await monter({ panneaux: details, lignes: panneaux.flatMap((x) => x.blocs) });
  p.entrer();
  const zones = panneaux.flatMap((x) => x.blocs.map((b) => [b, p.zone(b.rang, x.id)]));
  assert.ok(zones.every(([, z]) => z), 'chaque bloc a sa zone');
  const differents = zones.filter(([b, z]) => versMarkdown(z.childNodes.map(arbreDuDom).filter(Boolean)).trim() !== b.texte.trim());
  assert.ok(differents.length > 0, 'des blocs dont le Markdown relu n’est pas le texte de la base');
  assert.equal(p.extension.verifier(p.ed), null);
  assert.deepEqual(p.extension.operations(p.ed, []), []);
  p.quitter();
  assert.ok(details.every((d) => !d.open || d.dataset.panneauRegles === 'accessoires'));
});

test('CSS du mode modification : un bloc de texte se coupe entre deux colonnes comme hors mode modification ; ses outils, jamais coupés, restent avec sa fin', () => {
  const css = readFileSync(new URL('../src/styles/edition/edition.css', import.meta.url), 'utf8');
  assert.ok(!/\.preg-bloc--texte\s*\{[^}]*break-inside/.test(css), 'pas de bloc de texte insécable');
  assert.match(css, /\.ed-preg-outils \{[^}]*break-inside: avoid; break-before: avoid; \}/);
});
