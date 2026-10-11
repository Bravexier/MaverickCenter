import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { aMailler, autolink, buildTerms, fold, TYPES_SANS_MAILLAGE } from '../src/lib/autolink.mjs';
import { TYPE_KEYS } from '../src/lib/types.mjs';

const pages = [
  { id: 'metiers/forgeron', title: 'Forgeron', aliases: [] },
  { id: 'metiers/eleveur', title: 'Éleveur (choix animal)', aliases: ['Éleveur'] },
  { id: 'ressources/philtre-du-puissant', title: 'Philtre du Puissant', aliases: [] },
  { id: 'ressources/alchimie', title: 'Alchimie', aliases: [] },
  { id: 'guide/postures', title: 'Postures', aliases: [] },
  { id: 'guide/jet-de-des', title: 'Jet de dés', aliases: ['Jets de dés'] },
  { id: 'guide/neutre-a', title: 'Neutre', aliases: [] },
  { id: 'lore/neutre-b', title: 'Neutre', aliases: [] },
  { id: 'metiers/marin', title: 'Marin', aliases: [] },
  { id: 'metiers/art', title: 'Art', aliases: [] },
];
const { terms, ambiguous } = buildTerms(pages);
const run = (body, self = 'x', opts) => autolink(body, terms, self, opts);

test('fold garde la longueur du texte (indices valides) et ignore casse, accents, apostrophes', () => {
  for (const text of ['Éleveur d’œufs', 'İstanbul 😀 Forgeron', 'a b']) assert.equal(fold(text).length, text.length);
  assert.equal(fold('Éleveur d’Hôtel'), "eleveur d'hotel");
});

test('un titre à plusieurs mots est lié, avec le texte d’origine si l’écriture diffère', () => {
  assert.equal(run('Boire un philtre du puissant.').body, 'Boire un [[Philtre du Puissant|philtre du puissant]].');
  assert.equal(run('Le Philtre du Puissant aide.').body, 'Le [[Philtre du Puissant]] aide.');
  assert.equal(run('Voir jets de dés.').body, 'Voir [[Jet de dés|jets de dés]].', 'un alias renvoie au titre de la page');
});

test('un terme d’un seul mot n’est lié que s’il commence par une majuscule', () => {
  assert.equal(run('Le forgeron travaille.').body, 'Le forgeron travaille.');
  assert.equal(run('Forgeron : travaille le métal.').body, '[[Forgeron]] : travaille le métal.');
  assert.equal(run('Le forgeron voit un Forgeron.').body, 'Le forgeron voit un [[Forgeron]].', 'la première occurrence VALABLE est liée');
});

test('une seule liaison par page cible, jamais vers la page elle-même', () => {
  const r = run('Alchimie et encore Alchimie. Alchimie !');
  assert.equal(r.body, '[[Alchimie]] et encore Alchimie. Alchimie !');
  assert.equal(r.links.length, 1);
  assert.equal(run('Alchimie', 'ressources/alchimie').body, 'Alchimie');
});

test('rien dans le code, les titres, les tableaux, les liens et URLs existants', () => {
  const body = [
    '# Alchimie',
    '| Alchimie | Postures |',
    '`Alchimie` et [[Postures]] et [Postures](http://x/Postures) et https://x.fr/Alchimie',
    '```',
    'Alchimie',
    '```',
    '<!-- Alchimie -->',
    '<span title="Alchimie">x</span>',
  ].join('\n');
  assert.equal(run(body).body, body);
});

test('les titres ambigus sont ignorés, les mots sont comparés entiers, les termes trop courts aussi', () => {
  assert.deepEqual(ambiguous, ['Neutre']);
  assert.equal(run('Un Neutre agit.').body, 'Un Neutre agit.');
  assert.equal(run('Marins et Marinade').body, 'Marins et Marinade', '« Marin » ne doit pas lier « Marins » ni « Marinade »');
  assert.equal(run('Un Marin part.').body, 'Un [[Marin]] part.');
  assert.equal(run('Art et Postures').body, 'Art et [[Postures]]', '« Art » (3 lettres) est trop court pour être lié');
});

test('le plus long terme gagne et le texte est lié ligne par ligne, avec une limite par page', () => {
  const longTerms = buildTerms([
    { id: 'a', title: 'Philtre', aliases: [] },
    { id: 'b', title: 'Philtre du Puissant', aliases: [] },
  ]).terms;
  assert.equal(autolink('Un Philtre du Puissant.', longTerms, 'x').body, 'Un [[Philtre du Puissant]].');
  const many = Array.from({ length: 5 }, (_, i) => ({ id: `p${i}`, title: `Titre${i}abc`, aliases: [] }));
  const limited = autolink(many.map((p) => p.title).join('\n'), buildTerms(many).terms, 'x', { maxLinks: 3 });
  assert.equal(limited.links.length, 3);
  assert.equal(limited.body.split('\n').filter((l) => l.startsWith('[[')).length, 3);
});

test('idempotent : relancer ne change plus rien', () => {
  const once = run('Le Forgeron boit un philtre du puissant. Voir Postures et Alchimie.');
  const twice = run(once.body);
  assert.equal(twice.body, once.body);
  assert.equal(twice.links.length, 0);
});

test('ce qui figure dans le nom de la page elle-même n’est pas lié', () => {
  const t = buildTerms([
    { id: 'metiers/savant', title: 'Savant', aliases: [] },
    { id: 'ressources/philtre-du-savant', title: 'Philtre du Savant', aliases: [] },
  ]).terms;
  const self = { id: 'ressources/philtre-du-savant', title: 'Philtre du Savant', aliases: [] };
  assert.equal(autolink('Le Philtre du Savant rend Savant.', t, self).body, 'Le Philtre du Savant rend [[Savant]].');
  assert.equal(autolink('Le Philtre du Savant rend Savant.', t, 'autre/page').body, 'Le [[Philtre du Savant]] rend Savant.');
});

test('la liste d’exclusion écarte une locution courante', () => {
  const guide = [{ id: 'guide/resume', title: 'En résumé', aliases: [] }];
  assert.equal(autolink('Voici en résumé le tour.', buildTerms(guide).terms, 'x').body, 'Voici [[En résumé|en résumé]] le tour.');
  assert.equal(autolink('Voici en résumé le tour.', buildTerms(guide, { ignore: ['en résumé'] }).terms, 'x').body, 'Voici en résumé le tour.');
});

test('les pages que l’édition refait depuis les tables (races, classes, dons, magies) ne reçoivent pas de liens ; elles restent des cibles', () => {
  // un lien posé dans leur corps serait perdu à la première modification (lib/corps-races.mjs, corps-classes.mjs, corps-magies.mjs)
  for (const id of ['races/drakos', 'classes/guerrier', 'capacites/guerrier-brave', 'magies/magie-du-feu']) {
    assert.equal(aMailler({ id, type: id.split('/')[0] }), false, id);
    assert.equal(aMailler({ id }), false, `${id} (sans type)`);
  }
  for (const id of ['metiers/forgeron', 'guide/postures', 'lore/histoire', 'bestiaire/loup']) assert.equal(aMailler({ id, type: id.split('/')[0] }), true, id);
  for (const t of TYPES_SANS_MAILLAGE) assert.ok(TYPE_KEYS.includes(t), `type ${t} connu`);
  // le script ne maille que ces pages ; les titres de toutes les pages restent des termes
  const script = readFileSync(fileURLToPath(new URL('../scripts/autolink.mjs', import.meta.url)), 'utf8');
  assert.match(script, /for \(const page of pages\.filter\(aMailler\)\)/);
  assert.match(script, /buildTerms\(pages,/);
});
