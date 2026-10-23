// L'extension de l'éditeur pour les annonces (src/scripts/edition/annonces.mjs, migration 0068 ; demande du propriétaire du 2026-10-18 : l'encart « Notre
// prochaine rencontre IRL » sur l'accueil, titre fixe, « annonce modifiable sur le site de dev (mode modification) », « Aucune rencontre annoncée pour
// le moment. » quand elle est vide), exécutée dans un faux navigateur (test/aide-faux-dom.mjs) avec un faux éditeur, sur une zone rendue comme au build
// (components/accueil/LiensEtRencontre.astro, lib/annonces.mjs ; Markdown : test/aide-rendu-du-site.mjs) : l'entrée en mode modification (zone modifiable, barre
// d'outils ; vide, la zone s'ouvre vide), rien quand on ne retouche rien (le Markdown relu au départ fait foi, pas le texte de la base), une modification,
// une annonce vidée (NULL), un conflit (409), l'abandon (le texte d'avant), la surcouche (`ligne` : texte changé → zone refaite, vidée → texte
// d'attente) et la course entre la surcouche et l'entrée en mode modification. Reste hors de ces tests : la sélection et les commandes de mise en forme du
// navigateur (execCommand, barre d'outils de texte-en-place.mjs : test/texte-en-place-mots-cles.test.mjs).
//   node --test test/edition-annonces.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { contenuDeLAnnonce, empreinteDeLAnnonce } from '../src/lib/annonces.mjs';
import { cleDeLigne } from '../src/lib/edition-modele.mjs';
import { arbreDuDom, versMarkdown } from '../src/lib/markdown-edition.mjs';
import { LIENS_ET_RENCONTRE } from '../src/lib/livres.mjs';
import { attendre, el, fauxDocument } from './aide-faux-dom.mjs';
import { rendreCommeLaPage } from './aide-rendu-du-site.mjs';

const ID = LIENS_ET_RENCONTRE.rencontre.annonce;
const VIDE = LIENS_ET_RENCONTRE.rencontre.vide;

/** La zone de l'annonce telle que components/accueil/LiensEtRencontre.astro l'écrit, son texte rendu comme au build. */
async function zoneDeLaPage(texte) {
  const html = texte ? await rendreCommeLaPage(texte, []) : '';
  const zone = el('div', {
    class: 'prose annonce__texte', 'data-annonce': ID, 'data-annonce-texte': '', 'data-annonce-vide': VIDE, 'data-annonce-empreinte': empreinteDeLAnnonce(texte),
  });
  zone.innerHTML = contenuDeLAnnonce(texte, html, VIDE);
  return zone;
}

let numero = 0;
/** La page (l'encart), un faux éditeur et l'extension chargée à neuf ; `texte` : celui de la page construite, `base` : celui de la base vivante. */
async function monter({ texte = null, base = texte } = {}) {
  const zone = await zoneDeLaPage(texte);
  const document = fauxDocument(el('main', {}, el('section', { class: 'annonce' }, el('h2', {}, LIENS_ET_RENCONTRE.rencontre.titre), zone)));
  Object.assign(globalThis, { document });
  const ed = {
    base: '/',
    page: LIENS_ET_RENCONTRE.page,
    enEdition: false,
    lignes: new Map(),
    annonces: [],
    annoncer(message, genre) { this.annonces.push([message, genre]); },
    async appel(_methode, chemin) {
      if (chemin === 'edition/pages/') return { pages: [] };
      return {};
    },
  };
  const { annonces: extension } = await import(`../src/scripts/edition/annonces.mjs?page=${(numero += 1)}`);
  const entrer = () => {
    ed.lignes = new Map([[cleDeLigne('annonce', { id: ID }), { id: ID, texte: base }]]);
    ed.enEdition = true;
    extension.debut(ed);
  };
  const quitter = () => {
    extension.fin(ed);
    ed.enEdition = false;
  };
  const relu = () => versMarkdown(zone.childNodes.map(arbreDuDom).filter(Boolean));
  return { extension, ed, document, zone, entrer, quitter, relu };
}

const operation = (texte, avant) => ({ op: 'modifier', table: 'annonce', cle: { id: ID }, valeurs: { texte }, avant: { texte: avant } });

test('à l’entrée : la zone se modifie en place, la barre d’outils est posée ; sans retouche, aucune opération', async () => {
  const p = await monter({ texte: 'Retrouvez-nous à la **convention**, l’an prochain.' });
  assert.equal(p.extension.actif(p.document), true);
  assert.deepEqual(p.extension.lignesACharger(), [{ table: 'annonce', cle: { id: ID } }]);
  p.entrer();
  assert.equal(p.zone.getAttribute('contenteditable'), 'true');
  assert.ok(p.document.body.querySelector('.ed-barre-guide'), 'la barre d’outils du texte');
  assert.match(p.relu(), /\*\*convention\*\*/);
  assert.deepEqual(p.extension.operations(p.ed, []), []);
  const autre = { op: 'modifier', table: 'metier', cle: { id: 'x' }, valeurs: { nom: 'Y' } };
  assert.deepEqual(p.extension.operations(p.ed, [autre]), [autre], 'les opérations des autres extensions passent');
});

test('une annonce vide s’ouvre vide (le texte d’attente n’est pas son texte) ; écrite, elle part ; `avant` = NULL', async () => {
  const p = await monter();
  assert.match(p.zone.textContent, /Aucune rencontre annoncée pour le moment\./);
  p.entrer();
  assert.doesNotMatch(p.zone.textContent, /Aucune rencontre/);
  assert.equal(p.relu().trim(), '');
  assert.deepEqual(p.extension.operations(p.ed, []), [], 'vide, rien à écrire');
  p.zone.innerHTML = '<p>Nous serons à la convention de <strong>printemps</strong>.</p>';
  assert.deepEqual(p.extension.operations(p.ed, []), [operation('Nous serons à la convention de **printemps**.\n', null)]);
});

test('une annonce vidée part vide (NULL : le texte d’attente revient) ; un conflit (409) prend la ligne actuelle pour référence', async () => {
  const texte = 'Une annonce.';
  const p = await monter({ texte });
  p.entrer();
  p.zone.innerHTML = '<p><br></p>';
  assert.deepEqual(p.extension.operations(p.ed, []), [operation(null, texte)]);
  const message = p.extension.conflit(p.ed, { corps: { table: 'annonce', cle: { id: ID }, ligne: { id: ID, texte: 'Changée ailleurs.' } } });
  assert.match(message, /a changé entre-temps/);
  assert.deepEqual(p.extension.operations(p.ed, [])[0].avant, { texte: 'Changée ailleurs.' }, 'la saisie reste, la référence suit');
  assert.equal(p.extension.conflit(p.ed, { corps: { table: 'metier', cle: { id: 'x' }, ligne: {} } }), null, 'un autre conflit ne la regarde pas');
});

test('abandon : le texte d’avant revient, la barre part, la zone n’est plus modifiable', async () => {
  const p = await monter();
  const avant = p.zone.innerHTML;
  p.entrer();
  p.zone.innerHTML = '<p>Tout autre chose.</p>';
  p.quitter();
  assert.equal(p.zone.innerHTML, avant);
  assert.equal(p.zone.getAttribute('contenteditable'), null);
  assert.equal(p.document.body.querySelector('.ed-barre-guide'), null);
});

test('surcouche hors mode modification (`ligne`) : texte changé → zone refaite ; vidée → texte d’attente ; même texte → rien ; en mode modification → plus tard', async () => {
  const p = await monter({ texte: 'Ancienne annonce.' });
  p.extension.ligne(p.ed, 'annonce', { id: ID }, { id: ID, texte: 'Nouvelle **annonce**.' });
  await attendre();
  assert.equal(p.zone.innerHTML, '<p>Nouvelle <strong>annonce</strong>.</p>');
  assert.equal(p.zone.dataset.annonceEmpreinte, empreinteDeLAnnonce('Nouvelle **annonce**.'));
  p.extension.ligne(p.ed, 'annonce', { id: ID }, { id: ID, texte: null });
  await attendre();
  assert.equal(p.zone.innerHTML, contenuDeLAnnonce(null, '', VIDE));
  const garde = p.zone.innerHTML;
  p.extension.ligne(p.ed, 'annonce', { id: ID }, { id: ID, texte: null });
  await attendre();
  assert.equal(p.zone.innerHTML, garde, 'même empreinte : rien');
  p.extension.ligne(p.ed, 'metier', { id: 'x' }, null);
  p.extension.ligne(p.ed, 'annonce', { id: 'autre' }, { id: 'autre', texte: 'x' });
  assert.equal(p.zone.innerHTML, garde, 'une autre table, une autre annonce : rien');
  // course : la surcouche commencée, puis le mode modification : la zone montée pour la saisie reste, refaite à la sortie
  p.extension.ligne(p.ed, 'annonce', { id: ID }, { id: ID, texte: 'Pendant l’entrée.' });
  p.entrer();
  await attendre();
  assert.equal(p.zone.getAttribute('contenteditable'), 'true');
  assert.doesNotMatch(p.zone.textContent, /Pendant l’entrée/);
  p.quitter();
  await attendre();
  await attendre();
  assert.match(p.zone.textContent, /Pendant l’entrée\./);
});
