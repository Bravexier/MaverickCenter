// Le contrôle par mutation (scripts/mutation.mjs, scripts/mutation-variantes.mjs, scripts/mutation-rapporteur.mjs ; docs/serveur.md, « Contrôle par
// mutation ») : ses parties pures. La réécriture d'une prose garde sa structure (liens, balises, ancres figées, code, nombres), le décalage des valeurs
// reste valide, la variante `suppressions` couvre toute entité que le site supprime (une entité nouvelle y entre d'elle-même), les options et le relevé
// des échecs. Le passage complet (copie, service, rapatriement, tests) n'est pas lancé ici : c'est l'outil lui-même, à la main.
//   node --test test/mutation.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { avecBuild, fichierDeTest, lireLesOptions, resume } from '../scripts/mutation.mjs';
import rapporteur, { echecDe } from '../scripts/mutation-rapporteur.mjs';
import {
  adressesRetirees, candidatsDeValeur, entitesASupprimer, generateurDeMots, lireLesOptions as optionsDesVariantes, messageCourt, muterTexte, nombresDecales,
  ORDRE_DES_SUPPRESSIONS, PROSE, VARIANTES,
} from '../scripts/mutation-variantes.mjs';
import { ENTITES, TABLES } from '../src/lib/edition-modele.mjs';
import * as livres from '../src/lib/livres.mjs';

test('textes : la prose est réécrite, sa structure gardée (liens, balises, commentaires, HTML, code, nombres, intertitres, tableaux)', () => {
  const texte = [
    '## Les dégâts {#degats}', '', 'Un {{feu|brasier}} inflige 3 dégâts, voir [[guide/meteo|la météo]] et [lien](https://exemple.fr).',
    '<!-- guide:postures -->', '`code tel quel` <span class="x">Mot</span>', '| A | B |', '| --- | --- |', '| Épée | 2 |',
  ].join('\n');
  const v1 = muterTexte(texte);
  for (const garde of ['## Les dégâts {#degats}', '{{feu|brasier}}', '[[guide/meteo|la météo]]', '[lien](https://exemple.fr)', '<!-- guide:postures -->', '`code tel quel`', '<span class="x">', '| --- | --- |', ' 3 ', ' 2 |']) {
    assert.ok(v1.includes(garde), garde);
  }
  assert.ok(!/\bUn\b|\binflige\b|Épée/.test(v1), 'la prose réécrite');
  assert.match(v1, /^Plif \{\{feu\|brasier\}\} plif 3 plif/m, 'la casse gardée');
  // noms : l'intertitre renommé, son ancre figée gardée (un identifiant : le service refuse un texte qui la retire ou la renomme), prose raccourcie
  const v2 = muterTexte(texte, { intertitres: true, raccourcir: true });
  assert.match(v2, /^## Plouf plouf \{#degats\}$/m);
  assert.equal(muterTexte('Un deux trois quatre cinq.', { raccourcir: true }), 'Plif plif plif .', 'prose raccourcie à trois mots');
  for (const vide of [null, undefined, '', '   ']) assert.equal(muterTexte(vide), vide);
  const mot = generateurDeMots();
  assert.deepEqual([mot(), mot(), mot()], ['Zua', 'Zub', 'Zuc']);
});

test('valeurs : chaque nombre décalé (un dé au dé standard voisin), liens et balises intacts ; candidats valides et différents de la valeur en place', () => {
  assert.equal(nombresDecales('D6 + 3, voir [[guide/x-2]] et {{d4}}', +1), 'D8 + 4, voir [[guide/x-2]] et {{d4}}');
  assert.equal(nombresDecales('D4 et 1', -1), 'D3 et 0');
  assert.equal(nombresDecales('aucun nombre', +1), null);
  assert.deepEqual(candidatsDeValeur('cout', { type: 'entier', min: 0 }, 0), [1, 2]);
  assert.deepEqual(candidatsDeValeur('cout', { type: 'entier' }, null), [1, 2]);
  assert.deepEqual(candidatsDeValeur('poids', { type: 'reel' }, 1.5), [1.51, 1.49]);
  assert.deepEqual(candidatsDeValeur('type', { type: 'choix', requis: true }, 'b', { options: ['a', 'b', 'c'] }), ['c', 'a']);
  assert.deepEqual(candidatsDeValeur('type', { type: 'choix' }, 'b', { options: ['a', 'b'] }), ['a', '']);
  assert.deepEqual(candidatsDeValeur('degats_brut', { type: 'ligne' }, 'D6', { autres: ['2D4', 'D6'] }), ['D8', 'D4', '2D4']);
  for (const [col, def, v] of [['n', { type: 'entier' }, 3], ['t', { type: 'choix' }, 'a'], ['x_brut', { type: 'ligne' }, '5']]) {
    assert.ok(candidatsDeValeur(col, def, v, { options: ['a', 'b'], autres: ['5'] }).every((x) => String(x) !== String(v)), `${col} : jamais la valeur en place`);
  }
  // la prose des deux variantes de texte ne vise que des colonnes du modèle
  for (const [table, colonnes] of Object.entries(PROSE)) for (const c of colonnes) assert.ok(TABLES[table]?.colonnes?.[c], `${table}.${c}`);
});

test('suppressions : toute entité que le site supprime, les plus dépendantes d’abord ; une entité nouvelle y entre d’elle-même', () => {
  const avecSuppression = Object.keys(ENTITES).filter((e) => ENTITES[e].suppression);
  const ordre = entitesASupprimer(ENTITES);
  assert.deepEqual([...ordre].sort(), [...avecSuppression].sort(), 'chaque entité à suppression, une fois');
  for (const e of ORDRE_DES_SUPPRESSIONS) assert.ok(avecSuppression.includes(e), `${e} : l’ordre ne cite qu’une entité à suppression`);
  const avant = (a, b) => assert.ok(ordre.indexOf(a) < ordre.indexOf(b), `${a} avant ${b}`);
  avant('monstre_capacite', 'monstre');
  avant('monstre', 'monstre_espece');
  avant('evenement_extrait', 'evenement');
  avant('capacite', 'specialite');
  avant('mot_cle', 'page_des_regles');
  const nouvelle = { ...ENTITES, essai: { table: 'essai', suppression: true }, sans: { table: 'sans' } };
  assert.equal(entitesASupprimer(nouvelle).at(-1), 'essai');
  assert.ok(!entitesASupprimer(nouvelle).includes('sans'));
  assert.deepEqual(entitesASupprimer(ENTITES, ['page_des_regles', 'metier']), ['metier', 'page_des_regles'], '--entites : dans l’ordre d’essai');
  assert.throws(() => entitesASupprimer(ENTITES, ['race']), /sans suppression depuis le site/);
});

test('adresses : chaque page supprimée, absorbée ou retirée, et l’ancien plan', () => {
  const texte = adressesRetirees(livres);
  for (const id of [...livres.PAGES_SUPPRIMEES, ...Object.keys(livres.PAGES_ABSORBEES), ...Object.keys(livres.PAGES_RETIREES)]) {
    assert.ok(texte.includes(` ${id},`) || texte.includes(` ${id} ;`), id);
    assert.ok(texte.includes(`/regles/${id.slice('guide/'.length)}/`), `${id} : son chemin`);
  }
  for (const chemin of Object.keys(livres.ADRESSES_DU_PLAN_PRECEDENT)) assert.ok(texte.includes(`/${chemin}`), chemin);
  // en texte seulement : le service refuse un `[[…]]` ou un lien Markdown vers une page du site (migration 0098)
  assert.doesNotMatch(texte, /\[\[|\]\(/);
});

test('options : variante, dossier, sélection des tests, build seulement pour un test du site construit', () => {
  assert.throws(() => lireLesOptions([]), /usage/);
  assert.throws(() => lireLesOptions(['inconnue']), /usage/);
  assert.throws(() => lireLesOptions(['textes', '--inconnue']), /option inconnue/);
  const o = lireLesOptions(['suppressions', '--une-sur', '2', '--entites', 'metier', '--garder', '--', 'metiers-html', 'test/guide.test.mjs']);
  assert.deepEqual([o.variante, o.uneSur, o.entites, o.garder, o.fichiers], ['suppressions', '2', 'metier', true, ['metiers-html', 'test/guide.test.mjs']]);
  assert.deepEqual(['x', 'x.test.mjs', 'test/x.test.mjs', './client/test/x.test.mjs'].map(fichierDeTest), Array(4).fill('test/x.test.mjs'));
  assert.equal(avecBuild(lireLesOptions(['textes'])), true, 'toute la suite : avec le site construit');
  assert.equal(avecBuild(lireLesOptions(['textes', 'guide'])), false);
  assert.equal(avecBuild(lireLesOptions(['textes', 'guide', 'metiers-html'])), true);
  assert.equal(avecBuild(lireLesOptions(['textes', '--sans-build', 'metiers-html'])), false);
  assert.equal(avecBuild(lireLesOptions(['textes', '--sans-tests'])), false);
  for (const v of VARIANTES) assert.equal(lireLesOptions([v]).variante, v);
  assert.deepEqual(optionsDesVariantes(['valeurs', '--journal', 'j.json', '--exclure', 'sort,arme.prix_brut']).exclure, ['sort', 'arme.prix_brut']);
  assert.throws(() => optionsDesVariantes(['suppressions', '--journal', 'j.json', '--une-sur', '0']), /entier/);
  assert.equal(messageCourt({ statut: 409, message: 'operations[0] : « X » ne se supprime pas' }), '409 « X » ne se supprime pas');
});

test('relevé des échecs : le test en échec et son assertion, jamais deux fois une suite ou un parent', async () => {
  const cause = new Error('Expected values to be strictly equal:\n\n1 !== 2');
  const echec = (name, extra = {}) => ({ type: 'test:fail', data: { name, file: '/d/client/test/x.test.mjs', line: 3, details: { error: { cause, failureType: 'testCodeFailure' } }, ...extra } });
  const evenements = [
    { type: 'test:pass', data: { name: 'a', details: { type: 'test' } } },
    { type: 'test:pass', data: { name: 'b', skip: 'site non construit', details: { type: 'test' } } },
    echec('c'),
    { type: 'test:fail', data: { name: 'parent', details: { error: { failureType: 'subtestsFailed' } } } },
    { type: 'test:fail', data: { name: 'suite', details: { type: 'suite', error: {} } } },
  ];
  assert.deepEqual(echecDe(echec('c').data, '/d/client/'), { fichier: 'test/x.test.mjs', ligne: 3, nom: 'c', message: 'Expected values to be strictly equal: 1 !== 2' });
  const sortie = [];
  for await (const ligne of rapporteur((async function* () { yield* evenements; })())) sortie.push(ligne);
  const bilan = JSON.parse(sortie.join(''));
  assert.deepEqual([bilan.total, bilan.reussis, bilan.sautes, bilan.echoues, bilan.echecs.map((e) => e.nom)], [3, 1, 1, 1, ['c']]);
  const texte = resume({ variante: 'suppressions', dossier: '/d', mutations: { lots: 2, parTable: { metier: { faites: 2, refusees: 1 } }, passes: [{ faites: 2 }] }, tests: bilan });
  assert.match(texte, /2 faites, 1 refusées/);
  assert.match(texte, /1 en échec/);
});
