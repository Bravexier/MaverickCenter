// Le tiroir des choix de /fiche/ au clavier (src/scripts/fiche.mjs). « Aller aux choix » (#choix-aller) ouvre l'onglet « Choix » de la zone IV et y met
// le focus (choix du propriétaire, option « A : corriger les deux » : « après « Aller aux choix », le focus va sur l'onglet « Choix » ») ; sans cela, le
// tiroir rangé, le bouton passe en `hidden` et le focus retombe sur le document. Le focus ne fait pas défiler (`preventScroll`) : la descente vers la
// zone IV reste celle de `scrollIntoView`, en douceur, sans animation sous `prefers-reduced-motion`. La fonction `allerAuxChoix`, lue dans le script et
// exécutée dans un faux navigateur réduit à ce qu'elle emploie (le script entier attend la page et ses règles). Le parcours réel (Tab, Entrée, souris)
// est vérifié à la main dans Chromium, sur le site construit (aucun test automatique ne le rejoue).
// La bulle d'un choix du tiroir au clavier (demandes du propriétaire, consignées dans le skill zone-fiche) : le choix que le focus rejoint quand un
// choix fait depuis sa bulle quitte le tiroir (choixSuivant), l'identité d'un choix d'un calcul à l'autre (identitesDesChoix : les points d'une même
// maîtrise sont un même choix en plusieurs parts), la règle de ce qui se parcourt aux flèches dans la bulle, une liste, un groupe de dons ou un champ nombre (regleDuParcours) et la mise à jour en place de
// la bulle (morpher : le champ qui a le focus le garde). Le comportement générique de la bulle à champs (focusout, Échap) : test/infobulles.test.mjs.
//   node --test test/fiche-tiroir-clavier.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';
import { el, Texte } from './aide-faux-dom.mjs';

const script = readFileSync(new URL('../src/scripts/fiche.mjs', import.meta.url), 'utf8');
/** Le texte d'une fonction de premier niveau du script. */
const source = (nom) => script.match(new RegExp(`\\nfunction ${nom}\\([^)]*\\) \\{\\n[\\s\\S]*?\\n\\}\\n`))?.[0];
/** Les fonctions `noms` du script, exécutées dans un contexte à part (`contexte`). */
function fonctions(noms, contexte = {}) {
  for (const nom of noms) assert.ok(source(nom), `${nom} introuvable dans src/scripts/fiche.mjs`);
  vm.runInNewContext(`${noms.map(source).join('\n')}\nglobalThis.f = { ${noms.join(', ')} };`, contexte);
  return contexte.f;
}
const fonction = source('allerAuxChoix');

/** Exécute `allerAuxChoix` ; `reduit` : l'utilisateur demande moins d'animations. Rend le journal des appels et l'élément qui a le focus. */
function allerAuxChoix({ reduit = false } = {}) {
  const journal = [];
  const document = { activeElement: null };
  const element = (id) => ({
    id,
    click() { journal.push(['click', id]); },
    focus(options) { journal.push(['focus', id, options]); document.activeElement = this; },
    scrollIntoView(options) { journal.push(['scrollIntoView', id, options]); },
  });
  const elements = Object.fromEntries(['onglet-choix', 'zone-parametres', 'choix-aller'].map((id) => [id, element(id)]));
  document.getElementById = (id) => elements[id] ?? null;
  const contexte = {
    document,
    matchMedia: (requete) => ({ matches: requete === '(prefers-reduced-motion: reduce)' && reduit }),
  };
  vm.runInNewContext(`const $ = (id) => document.getElementById(id);\n${fonction}\nallerAuxChoix();`, contexte);
  return { journal: JSON.parse(JSON.stringify(journal)), focus: document.activeElement?.id ?? null };
}

test('« Aller aux choix » : l’onglet « Choix » ouvert et focalisé sans défilement, puis la descente vers la zone IV', () => {
  assert.ok(fonction, 'allerAuxChoix introuvable dans src/scripts/fiche.mjs');
  assert.match(script, /\$\('choix-aller'\)\.addEventListener\('click', allerAuxChoix\);/, 'le bouton « Aller aux choix » appelle allerAuxChoix');
  const { journal, focus } = allerAuxChoix();
  assert.equal(focus, 'onglet-choix', 'le focus sur l’onglet « Choix », pas perdu quand le bouton disparaît avec le tiroir');
  assert.deepEqual(journal, [
    ['click', 'onglet-choix'], // l'onglet s'ouvre (components/Onglets.astro) et devient l'onglet atteint par Tab (tabindex 0)
    ['focus', 'onglet-choix', { preventScroll: true }], // le focus ne gâche pas le défilement en douceur
    ['scrollIntoView', 'zone-parametres', { block: 'start', behavior: 'smooth' }],
  ]);
});

test('« Aller aux choix » sous prefers-reduced-motion : même focus, descente sans animation', () => {
  const { journal, focus } = allerAuxChoix({ reduit: true });
  assert.equal(focus, 'onglet-choix');
  assert.deepEqual(journal.at(-1), ['scrollIntoView', 'zone-parametres', { block: 'start', behavior: 'auto' }]);
});

test('un choix fait depuis sa bulle quitte le tiroir : le focus va au choix suivant, ou au nouveau choix à sa place ; le dernier : au précédent ; plus rien : null', () => {
  const { choixSuivant } = fonctions(['choixSuivant']);
  assert.equal(choixSuivant('b', ['a', 'b', 'c'], ['a', 'c']), 'c', 'le choix suivant');
  assert.equal(choixSuivant('b', ['a', 'b', 'c'], ['a', 'd1', 'd2', 'c']), 'd1', 'les dons de la spécialité choisie, à sa place');
  assert.equal(choixSuivant('c', ['a', 'b', 'c'], ['a', 'b']), 'b', 'il était le dernier : le précédent');
  assert.equal(choixSuivant('a', ['a'], []), null, 'plus de choix : le tiroir disparaît (repli sur la tuile de la page)');
});

test('l’identité d’un choix du tiroir : sa nature et sa clé ; une maîtrise, sa source (ses points, l’un après l’autre) ; numérotée quand elle revient', () => {
  const { identitesDesChoix } = fonctions(['identitesDesChoix']);
  const ids = (attente) => [...identitesDesChoix(attente)];
  const source = 'capacites/guerrier-maitre-darme';
  assert.deepEqual(ids([{ nature: 'specialite', cle: 'specialite:1' }, { nature: 'maitrise', cle: `maitrise:${source}:1` }]),
    ['specialite|specialite:1|1', `maitrise|maitrise:${source}|1`]);
  assert.deepEqual(ids([{ nature: 'maitrise', cle: `maitrise:${source}:2` }]), [`maitrise|maitrise:${source}|1`], 'le point 2 : le même choix que le point 1');
  // une source dont l'identifiant porte « : » (une spécialité), et deux lignes d'une même source (un point à choisir, une part qui suit)
  const s2 = 'classes/guerrier#specialite:maitre-darme';
  assert.deepEqual(ids([{ nature: 'maitrise', cle: `maitrise:${s2}:1` }, { nature: 'maitrise', cle: `maitrise:${s2}:3` }]),
    [`maitrise|maitrise:${s2}|1`, `maitrise|maitrise:${s2}|2`]);
});

test('une liste de la bulle parcourue au clavier : prise à Entrée ou à Tab, annulée en la quittant autrement ; à la souris, aussitôt (demande du propriétaire)', () => {
  const { regleDuParcours } = fonctions(['regleDuParcours'], { PARCOURS: { majTabValide: true, ailleursAnnule: true } });
  const r = (evenement, enAttente) => regleDuParcours(evenement, enAttente, 'liste');
  assert.equal(r({ type: 'change', apresUneTouche: true }, false), 'attendre', 'une flèche sur la liste fermée : la valeur attend');
  assert.equal(r({ type: 'change', apresUneTouche: false }, false), 'relayer', 'une valeur prise dans la liste ouverte (souris) : aussitôt');
  for (const touche of ['Enter', 'Tab']) assert.equal(r({ type: 'touche', touche }, true), 'relayer', `${touche} prend la valeur parcourue`);
  for (const touche of ['ArrowDown', 'ArrowUp', 'Home', 'End', 'a', 'Escape', ' ']) assert.equal(r({ type: 'touche', touche }, true), null, `« ${touche} »`);
  assert.equal(r({ type: 'touche', touche: 'Enter' }, false), null, 'rien qui attende : Entrée ne relaie rien');
  assert.equal(r({ type: 'quitte', vers: 'ailleurs' }, true), 'annuler', 'un clic ailleurs : la valeur de la page revient');
  assert.equal(r({ type: 'quitte' }, false), null, 'quitter une liste inchangée : aucun relais');
});

test('un groupe de dons (boutons radio) de la bulle parcouru au clavier : pris à Entrée, Espace ou Tab, Échap annule ; un clic, aussitôt (demande du propriétaire : « Comme la liste »)', () => {
  const { regleDuParcours } = fonctions(['regleDuParcours'], { PARCOURS: { majTabValide: true, ailleursAnnule: true } });
  const r = (evenement, enAttente) => regleDuParcours(evenement, enAttente, 'radios');
  assert.equal(r({ type: 'clic', apresUneTouche: true }, false), 'attendre', 'une flèche coche le don suivant sans le prendre');
  assert.equal(r({ type: 'change', apresUneTouche: true }, false), 'attendre');
  assert.equal(r({ type: 'clic', apresUneTouche: false }, false), 'relayer', 'un clic sur un rond : aussitôt');
  for (const touche of ['Enter', ' ', 'Tab']) assert.equal(r({ type: 'touche', touche }, true), 'relayer', `« ${touche} » prend le don parcouru`);
  for (const touche of ['ArrowDown', 'ArrowRight', 'Escape']) assert.equal(r({ type: 'touche', touche }, true), null, touche);
  assert.equal(r({ type: 'quitte', vers: 'choix' }, true), 'annuler', 'Échap : la case cochée de la page revient');
  assert.equal(r({ type: 'quitte' }, false), null);
});

test('un champ nombre de la bulle (les points d’une répartition) : flèches et chiffres tapés pris seulement à Entrée ou à Tab, Échap annule (demande du propriétaire)', () => {
  const { regleDuParcours } = fonctions(['regleDuParcours'], { PARCOURS: { majTabValide: true, ailleursAnnule: true } });
  const r = (evenement, enAttente) => regleDuParcours(evenement, enAttente, 'nombre');
  assert.equal(r({ type: 'saisie' }, false), 'attendre', 'une flèche ou un chiffre tapé : rien n’est relayé');
  for (const apresUneTouche of [true, false]) assert.equal(r({ type: 'change', apresUneTouche }, false), 'attendre', 'son `change` (quand il perd le focus) non plus');
  for (const touche of ['Enter', 'Tab']) assert.equal(r({ type: 'touche', touche }, true), 'relayer', touche);
  for (const touche of [' ', 'ArrowUp', '7', 'Escape']) assert.equal(r({ type: 'touche', touche }, true), null, `« ${touche} »`);
  assert.equal(r({ type: 'quitte', vers: 'choix' }, true), 'annuler', 'Échap : la bulle se ferme, le focus revient au choix');
});

test('Maj+Tab prend la valeur comme Tab ; un clic ailleurs l’annule (réponses du propriétaire), pour tout ce qui se parcourt', () => {
  assert.match(script, /\nconst PARCOURS = \{ majTabValide: true, ailleursAnnule: true \};\n/, 'les deux réponses, en un seul endroit');
  const contexte = { PARCOURS: { majTabValide: true, ailleursAnnule: true } };
  const f = fonctions(['regleDuParcours'], contexte).regleDuParcours;
  for (const genre of ['liste', 'radios', 'nombre']) {
    assert.equal(f({ type: 'touche', touche: 'Tab', maj: true }, true, genre), 'relayer', `${genre} : Maj+Tab`);
    assert.equal(f({ type: 'quitte', vers: 'ailleurs' }, true, genre), 'annuler', `${genre} : un clic ailleurs`);
    assert.equal(f({ type: 'quitte', vers: 'choix' }, true, genre), 'annuler', `${genre} : Échap`);
  }
  // les deux réponses lues dans PARCOURS : l'autre réglage change la règle, et elle seule
  const g = fonctions(['regleDuParcours'], { PARCOURS: { majTabValide: false, ailleursAnnule: false } }).regleDuParcours;
  assert.equal(g({ type: 'touche', touche: 'Tab', maj: true }, true, 'liste'), null);
  assert.equal(g({ type: 'touche', touche: 'Tab', maj: false }, true, 'liste'), 'relayer');
  assert.equal(g({ type: 'quitte', vers: 'ailleurs' }, true, 'liste'), 'relayer');
  assert.equal(g({ type: 'quitte', vers: 'choix' }, true, 'liste'), 'annuler', 'Échap annule toujours');
});

test('entré dans la bulle à la souris (pas par Entrée) : un champ se relaie à son `change`, un rond à son clic, comme avant le lot (« la souris ne change pas »)', () => {
  const { regleDuParcours } = fonctions(['regleDuParcours'], { PARCOURS: { majTabValide: true, ailleursAnnule: true } });
  for (const genre of ['liste', 'nombre']) {
    assert.equal(regleDuParcours({ type: 'change', apresUneTouche: true }, false, genre, false), 'relayer', `${genre} : son change`);
    assert.equal(regleDuParcours({ type: 'saisie' }, false, genre, false), null, `${genre} : rien n’attend`);
  }
  assert.equal(regleDuParcours({ type: 'clic', apresUneTouche: true }, false, 'radios', false), 'relayer', 'un rond : son clic');
  assert.equal(regleDuParcours({ type: 'saisie' }, false, 'nombre', true), 'attendre', 'au clavier, le nombre attend');
});

test('la bulle du même choix, mise à jour en place : le champ qui a le focus garde son élément, attributs et textes suivent', () => {
  const { morpher } = fonctions(['morpher']);
  const liste = el('select', { 'aria-label': 'Point 1' }, el('option', { value: '' }, 'Choisir…'), el('option', { value: 'epee' }, 'Épée'));
  const actuel = el('li', { class: 'maitrise-part', 'data-a-choisir': '' }, el('span', {}, '1 point'), liste);
  const voulu = el('li', { class: 'maitrise-part' }, el('span', {}, '1 point'), el('select', { 'aria-label': 'Point 1' },
    el('option', { value: '' }, 'Choisir…'), el('option', { value: 'epee' }, 'Épée'), el('option', { value: 'hache' }, 'Hache')), el('p', { role: 'alert' }, 'Limite'));
  assert.equal(morpher(actuel, voulu), actuel, 'le même élément');
  assert.equal(actuel.children[1], liste, 'la liste (le focus) reste la même');
  assert.equal(actuel.hasAttribute('data-a-choisir'), false, 'un attribut retiré');
  assert.deepEqual(liste.children.map((o) => o.getAttribute('value')), ['', 'epee', 'hache'], 'une option ajoutée');
  assert.equal(actuel.children[2].tagName, 'P', 'un élément ajouté');
  // une balise différente : remplacée
  const ancien = el('div', {}, el('span', {}, 'a'));
  const nouveau = el('div', {}, el('strong', {}, 'b'));
  morpher(ancien, nouveau);
  assert.equal(ancien.children[0].tagName, 'STRONG');
  const texte = new Texte('4 points');
  const parent = el('span', {}, texte);
  morpher(parent, el('span', {}, '3 points'));
  assert.equal(parent.childNodes[0], texte, 'un texte garde son nœud');
  assert.equal(texte.nodeValue, '3 points');
});
