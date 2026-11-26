// La pagination du Glossaire (décision R309, §9 de docs/chantier-ancrage-mots-cles.md) dans son script de page, exécuté dans un faux navigateur
// (src/scripts/glossaire.mjs) : 50 lignes par page, `?page=` gardé par history.replaceState (les autres paramètres et le fragment aussi), les filtres sur tout le
// registre puis la page, un filtre qui change ramène à la page 1, la navigation (aria-label, aria-current, jamais les 36 numéros), le haut du tableau ramené à
// l'écran à chaque changement de page, `hidden` écrit seulement quand il change, l'évènement de l'éditeur qui réapplique la pagination, l'option
// « Sans catégorie » absente de la liste quand rien n'est à classer, le texte de l'élément cherché (T10). Des lignes inventées.
//   node --test test/glossaire-pagination.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { cliquer, el, fauxDocument } from './aide-faux-dom.mjs';

let essais = 0;

/** Une ligne du tableau (un <tbody>), avec, si `element` est donné, le texte de l'élément dans sa sous-ligne ; `vide` : la sous-ligne « Pas encore de définition. ». */
function ligne(id, libelle, { categories = [1], element = null, vide = false, hidden = false } = {}) {
  const attributs = { 'data-id': String(id), 'data-libelle': libelle, ...(categories.length ? { 'data-categories': JSON.stringify(categories) } : {}), ...(hidden ? { hidden: '' } : {}) };
  const sousLigne = element !== null ? el('td', { class: 'glossaire-mot__definition' }, el('div', { class: 'glossaire-mot__texte' }, el('span', { class: 'glossaire-mot__element' }, element), el('span', { class: 'glossaire-mot__origine' }, 'Texte de la page')))
    : vide ? el('td', { class: 'glossaire-mot__definition glossaire-mot__definition--vide' }, el('div', { class: 'glossaire-mot__texte' }, 'Pas encore de définition.')) : null;
  return el('tbody', attributs, el('tr', {}, el('th', {}, libelle)), ...(sousLigne ? [el('tr', {}, sousLigne)] : []));
}

/** `n` lignes « Mot 001 »…, les 50 premières visibles et les autres cachées comme la page construite. */
const lignes = (n, depart = 1) => Array.from({ length: n }, (_, i) => ligne(depart + i, `Mot ${String(depart + i).padStart(3, '0')}`, { hidden: i >= 50 }));

/**
 * La page et son script (importé à neuf) : le filtre, le choix du type, le tableau dans le cadre du gabarit, le compte, « aucun » ; une adresse et un
 * historique que replaceState tient à jour ; le haut du tableau (`defilements`).
 */
async function monter({ search = '', hash = '', rangees = lignes(120), options = ['', 'sans', '1'] } = {}) {
  const champ = el('input', { id: 'filtre-glossaire' });
  const type = el('select', { id: 'filtre-categorie' }, ...options.map((v) => el('option', { value: v }, v === '' ? 'Tous les types' : v === 'sans' ? 'Sans catégorie' : `Type ${v}`)));
  const tableau = el('table', { id: 'liste-mots-cles' }, el('thead', {}), ...rangees);
  const cadre = el('div', { class: 'tableau' }, el('div', { class: 'tableau__defile' }, tableau));
  const defilements = [];
  cadre.scrollIntoView = (o) => defilements.push(o);
  const document = fauxDocument(el('form', {}, champ, type, el('span', { id: 'glossaire-compte' })), cadre, el('p', { id: 'aucun-mot-cle', hidden: '' }));
  const location = { search, pathname: '/regles/glossaire/', hash };
  const remplacements = [];
  const history = {
    state: { x: 1 },
    replaceState(etat, titre, url) {
      remplacements.push([etat, titre, url]);
      const u = new URL(url, 'http://exemple.test');
      Object.assign(location, { search: u.search, hash: u.hash, pathname: u.pathname });
    },
  };
  Object.assign(globalThis, { document, location, history });
  // `hidden` : chaque écriture comptée
  const ecritures = [];
  for (const r of rangees) {
    let valeur = r.hidden;
    Object.defineProperty(r, 'hidden', { get: () => valeur, set: (v) => { valeur = v; ecritures.push(r.dataset.id); if (v) r.setAttribute('hidden', ''); else r.removeAttribute('hidden'); } });
  }
  await import(`../src/scripts/glossaire.mjs?essai=${(essais += 1)}`);
  const visibles = () => tableau.children.filter((x) => x.tagName === 'TBODY' && !x.hidden).map((x) => Number(x.dataset.id));
  const nav = () => document.querySelector('nav.glossaire-pages');
  const bouton = (nom) => nav().querySelectorAll('button').find((b) => b.dataset.nav === nom || b.dataset.page === String(nom));
  const saisir = (texte) => {
    champ.value = texte;
    champ.dispatchEvent(new Event('input'));
  };
  const intervalle = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
  return { champ, type, tableau, cadre, document, location, remplacements, history, ecritures, defilements, visibles, nav, bouton, saisir, intervalle };
}

test('R309 §9 : au chargement, seules les 50 premières lignes sont visibles ; la navigation a son aria-label, la page courante son aria-current', async () => {
  const p = await monter();
  assert.deepEqual(p.visibles(), p.intervalle(1, 50));
  assert.equal(p.nav().getAttribute('aria-label'), 'Pages du glossaire');
  assert.equal(p.nav().hidden, false);
  const courante = p.nav().querySelectorAll('[aria-current="page"]');
  assert.equal(courante.length, 1);
  assert.equal(courante[0].textContent, '1');
  assert.equal(courante[0].getAttribute('aria-label'), 'Page 1');
  assert.equal(p.bouton('precedent').disabled, true, 'pas de page avant la première');
  assert.equal(p.bouton('suivant').disabled, false);
  assert.equal(p.document.getElementById('glossaire-compte').textContent, '120 mots-clés', 'le compteur reste le total');
  assert.equal(p.remplacements.length, 0, 'la page 1 sans « page » : l’adresse ne change pas');
  assert.equal(p.defilements.length, 0, 'rien ne défile au chargement');
  assert.match(p.nav().querySelector('.glossaire-pages__etat').textContent, /^Page 1 sur 3$/);
});

test('R309 §9 : ?page=2 ouvre la page 2 ; une page trop haute est ramenée à la dernière et l’adresse corrigée, une page invalide disparaît de l’adresse', async () => {
  const deux = await monter({ search: '?page=2' });
  assert.deepEqual(deux.visibles(), deux.intervalle(51, 100));
  assert.equal(deux.nav().querySelector('[aria-current="page"]').textContent, '2');
  assert.equal(deux.remplacements.length, 0, 'l’adresse est déjà la bonne');
  const neuf = await monter({ search: '?page=9' });
  assert.deepEqual(neuf.visibles(), neuf.intervalle(101, 120), 'la page 9 est ramenée à 3');
  assert.equal(neuf.location.search, '?page=3');
  const faux = await monter({ search: '?q=&page=abc' });
  assert.deepEqual(faux.visibles(), faux.intervalle(1, 50));
  assert.equal(faux.location.search, '?q=', 'un « page » invalide est retiré, les autres paramètres restent');
});

test('R309 §9 : les commandes — numéros, suivant, précédent ; l’adresse suit sans nouvelle entrée, q et fragment gardés, « page » retiré à la page 1 ; le haut du tableau est ramené à l’écran', async () => {
  const p = await monter({ search: '?q=mot', hash: '#haut' });
  assert.equal(p.champ.value, 'mot');
  cliquer(p.bouton(3), p.nav());
  assert.deepEqual(p.visibles(), p.intervalle(101, 120));
  assert.equal(p.location.search, '?q=mot&page=3');
  assert.equal(p.location.hash, '#haut', 'le fragment est gardé');
  assert.deepEqual(p.remplacements.at(-1)[0], { x: 1 }, 'l’état de l’historique est gardé : replaceState, jamais pushState');
  assert.equal(p.bouton('suivant').disabled, true, 'la dernière page');
  assert.equal(p.defilements.length, 1, 'le haut du tableau ramené à l’écran');
  assert.deepEqual(p.defilements[0], { block: 'start' });
  cliquer(p.bouton('precedent'), p.nav());
  assert.deepEqual(p.visibles(), p.intervalle(51, 100));
  assert.equal(p.location.search, '?q=mot&page=2');
  assert.equal(p.defilements.length, 2);
  cliquer(p.bouton('suivant'), p.nav());
  assert.equal(p.location.search, '?q=mot&page=3');
  cliquer(p.bouton(1), p.nav());
  assert.deepEqual(p.visibles(), p.intervalle(1, 50));
  assert.equal(p.location.search, '?q=mot', 'la page 1 : « page » retiré, q gardé');
  assert.equal(p.location.hash, '#haut');
  // la page courante ne fait rien
  const avant = p.remplacements.length;
  cliquer(p.bouton(1), p.nav());
  assert.equal(p.remplacements.length, avant);
  assert.equal(p.defilements.length, 4);
});

test('R309 §9 : les filtres portent sur tout le registre, puis la page s’applique ; changer de filtre revient à la page 1 ; le compteur reste le total filtré', async () => {
  const p = await monter({ search: '?page=3' });
  assert.deepEqual(p.visibles(), p.intervalle(101, 120));
  // « Mot 115 » n'est visible que sur la page 3 : le filtre le trouve, et la page 1 l'affiche
  p.saisir('115');
  assert.deepEqual(p.visibles(), [115]);
  assert.equal(p.location.search, '', 'revenu à la page 1');
  assert.equal(p.document.getElementById('glossaire-compte').textContent, '1 sur 120');
  assert.equal(p.nav().hidden, true, 'une seule page : pas de navigation');
  p.saisir('mot 0');
  assert.deepEqual(p.visibles(), p.intervalle(1, 50), '99 correspondances : 50 sur la page 1');
  assert.equal(p.document.getElementById('glossaire-compte').textContent, '99 sur 120');
  cliquer(p.bouton(2), p.nav());
  assert.deepEqual(p.visibles(), p.intervalle(51, 99));
  assert.equal(p.location.search, '?page=2');
  // un autre filtre : la page 1
  p.saisir('mot 00');
  assert.equal(p.location.search, '');
  assert.deepEqual(p.visibles(), p.intervalle(1, 9));
  p.saisir('zzz');
  assert.deepEqual(p.visibles(), []);
  assert.equal(p.document.getElementById('aucun-mot-cle').hidden, false);
  assert.equal(p.nav().hidden, true);
  p.saisir('');
  assert.deepEqual(p.visibles(), p.intervalle(1, 50));
  // le choix du type revient aussi à la page 1
  cliquer(p.bouton(3), p.nav());
  p.type.value = '1';
  p.type.dispatchEvent(new Event('change'));
  assert.equal(p.location.search, '');
  assert.deepEqual(p.visibles(), p.intervalle(1, 50));
});

test('R309 §9 : la navigation ne montre pas 36 numéros (première, dernière, courante et voisines, « … ») et passe à la ligne plutôt que déborder', async () => {
  const p = await monter({ rangees: lignes(1764), search: '?page=18' });
  const numeros = () => p.nav().querySelectorAll('button').filter((b) => b.dataset.page).map((b) => b.dataset.page);
  assert.deepEqual(numeros(), ['1', '17', '18', '19', '36']);
  assert.equal(p.nav().querySelectorAll('.glossaire-pages__trou').length, 2);
  assert.equal(p.nav().querySelector('.glossaire-pages__trou').textContent, '…');
  assert.match(p.nav().querySelector('.glossaire-pages__etat').textContent, /^Page 18 sur 36$/);
  assert.deepEqual(p.visibles(), p.intervalle(851, 900));
  cliquer(p.bouton(36), p.nav());
  assert.deepEqual(numeros(), ['1', '35', '36']);
  assert.deepEqual(p.visibles(), p.intervalle(1751, 1764));
  const css = readFileSync(new URL('../src/styles/glossaire/glossaire.css', import.meta.url), 'utf8');
  assert.match(css, /\.glossaire-pages \{[^}]*flex-wrap: wrap/);
  assert.match(css, /\.glossaire-pages__numeros \{[^}]*flex-wrap: wrap/);
  assert.match(css, /\.glossaire-pages\[hidden\] \{ display: none; \}/);
});

test('R309 §9 : `hidden` n’est écrit sur une ligne que si sa valeur change (1 764 lignes à chaque frappe)', async () => {
  const p = await monter({ rangees: lignes(1764) });
  assert.equal(p.ecritures.length, 0, 'la page construite a déjà caché les lignes d’après la première page : rien à écrire');
  p.saisir('mot 17');
  const apres = p.ecritures.length;
  assert.ok(apres > 0 && apres <= 1764);
  p.saisir('mot 17');
  assert.equal(p.ecritures.length, apres, 'la même saisie : aucune écriture');
  cliquer(p.bouton(2), p.nav());
  assert.ok(p.ecritures.length - apres <= 100, 'une page change : au plus les 50 lignes qui partent et les 50 qui arrivent');
});

test('R309 §9, T10 : le filtre cherche aussi dans le texte de l’élément que la sous-ligne montre ; « Pas encore de définition. » n’en fait pas partie', async () => {
  const p = await monter({
    rangees: [
      ligne(1, 'Zéphyra', { element: 'Une brise du matin, avec {{vent|le vent}}.' }),
      ligne(2, 'Notus', { vide: true }),
      ligne(3, 'Borée', { element: 'Les effets du sort.' }),
      ligne(4, 'Écrit', {}),
    ],
  });
  p.saisir('brise du matin');
  assert.deepEqual(p.visibles(), [1], 'le texte de l’élément');
  p.saisir('le vent');
  assert.deepEqual(p.visibles(), [1], 'les balises lues comme leur texte');
  p.saisir('effets');
  assert.deepEqual(p.visibles(), [3]);
  p.saisir('encore de definition');
  assert.deepEqual(p.visibles(), [], 'la mention d’une sous-ligne vide n’est pas un texte');
  p.saisir('texte de la page');
  assert.deepEqual(p.visibles(), [], 'la mention de l’origine non plus');
  p.saisir('notus');
  assert.deepEqual(p.visibles(), [2]);
});

test('R309 §9 : l’évènement glossaire:mots-cles réapplique la pagination (tableau redessiné, page gardée) et montre la page du mot-clé créé', async () => {
  const p = await monter({ search: '?page=2' });
  assert.deepEqual(p.visibles(), p.intervalle(51, 100));
  // l'éditeur redessine tout le tableau, sans `hidden`, avec 130 lignes
  for (const t of p.tableau.querySelectorAll('tbody')) t.remove();
  for (const r of lignes(130).map((x) => { x.removeAttribute('hidden'); return x; })) p.tableau.append(r);
  p.document.dispatchEvent(new CustomEvent('glossaire:mots-cles', { detail: { gestion: false } }));
  assert.deepEqual(p.visibles(), p.intervalle(51, 100), 'la page 2 est gardée, les autres lignes cachées');
  assert.equal(p.nav().querySelector('.glossaire-pages__etat').textContent, 'Page 2 sur 3');
  // un mot-clé créé, rangé dans la page 3 : sa page s'affiche
  const nouveau = ligne(500, 'Mot 125 bis', { hidden: false });
  p.tableau.insertBefore(nouveau, p.tableau.querySelectorAll('tbody').find((t) => t.dataset.id === '126'));
  p.document.dispatchEvent(new CustomEvent('glossaire:mots-cles', { detail: { gestion: true, voir: 500 } }));
  assert.ok(p.visibles().includes(500));
  assert.equal(p.location.search, '?page=3');
  // le filtre en cours ne montre pas le mot-clé à voir : la page reste celle qu'elle était
  p.saisir('mot 01');
  p.document.dispatchEvent(new CustomEvent('glossaire:mots-cles', { detail: { gestion: true, voir: 500 } }));
  assert.ok(!p.visibles().includes(500));
  assert.equal(p.location.search, '');
});

test('R309 §7 : « Sans catégorie » n’est dans la liste que s’il y a un mot-clé à classer, au build comme après l’évènement ; elle revient quand un mot-clé devient à classer', async () => {
  const classes = [ligne(1, 'Un', { categories: [1] }), ligne(2, 'Deux', { categories: [1] })];
  const p = await monter({ rangees: classes, options: ['', '1'] });
  const valeurs = () => p.type.querySelectorAll('option').map((o) => o.getAttribute('value'));
  assert.deepEqual(valeurs(), ['', '1']);
  p.document.dispatchEvent(new CustomEvent('glossaire:mots-cles', { detail: { gestion: false } }));
  assert.deepEqual(valeurs(), ['', '1'], 'rien à classer : l’option n’est pas dans la liste (Safari ne respecte pas `hidden` sur une option)');
  // un mot-clé créé sans type : l'option revient, à sa place (après « Tous les types », avant les types)
  p.tableau.append(ligne(3, 'Trois', { categories: [] }));
  p.document.dispatchEvent(new CustomEvent('glossaire:mots-cles', { detail: { gestion: true, categories: [{ id: 1, libelle: 'Notion' }, { id: 2, libelle: 'Guide' }] } }));
  assert.deepEqual(valeurs(), ['', 'sans', '1', '2']);
  assert.equal(p.type.querySelectorAll('option').map((o) => o.textContent).join('|'), 'Tous les types|Sans catégorie|Notion|Guide');
  p.type.value = 'sans';
  p.type.dispatchEvent(new Event('change'));
  assert.deepEqual(p.visibles(), [3]);
  // il est classé : l'option part, et le choix « sans » avec elle (tous les mots-clés reviennent)
  const trois = p.tableau.querySelectorAll('tbody').find((t) => t.dataset.id === '3');
  trois.setAttribute('data-categories', '[1]');
  p.document.dispatchEvent(new CustomEvent('glossaire:mots-cles', { detail: { gestion: true } }));
  assert.deepEqual(valeurs(), ['', '1', '2']);
  assert.equal(p.type.value, '');
  assert.deepEqual(p.visibles(), [1, 2, 3]);
});
