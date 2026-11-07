// Maillage automatique (lib/autolink.mjs, npm run autolink) : depuis la migration 0098, un lien est la balise d'un mot-clé à adresse (mot_cle.url ;
// décision du propriétaire : « tous les liens deviendront des mots-clés et tous les mots-clés deviendront des liens ») ; le maillage pose « {{id}} » ou
// « {{id|texte}} », jamais un [[lien]], et ne crée jamais de mot-clé.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { aMailler, autolink, buildTerms, ciblesDuVocabulaire, fold, TYPES_SANS_MAILLAGE } from '../src/lib/autolink.mjs';
import { TYPE_KEYS } from '../src/lib/types.mjs';

// une cible par page (le mot-clé qui y mène, ses écritures : le titre et les alias de la page)
const cible = (id, page, libelle, termes = []) => ({ id, page, libelle, termes });
const cibles = [
  cible('forgeron', 'metiers/forgeron', 'Forgeron'),
  cible('eleveur', 'metiers/eleveur', 'Éleveur (choix animal)', ['Éleveur']),
  cible('philtre-du-puissant', 'ressources/philtre-du-puissant', 'Philtre du Puissant'),
  cible('alchimie', 'ressources/alchimie', 'Alchimie'),
  cible('postures', 'guide/postures', 'Postures'),
  // « Dés » mène à la page « Jet de dés » (migration 0098, « Fusionner dans l'existant ») : son libellé, puis le titre et l'alias de la page
  cible('des', 'guide/jet-de-des', 'Dés', ['Jet de dés', 'Jets de dés']),
  cible('neutre-a', 'guide/neutre-a', 'Neutre'),
  cible('neutre-b', 'lore/neutre-b', 'Neutre'),
  cible('marin', 'metiers/marin', 'Marin'),
  cible('art', 'metiers/art', 'Art'),
];
const { terms, ambiguous } = buildTerms(cibles);
const run = (body, self = 'x', opts) => autolink(body, terms, self, opts);

test('les cibles : chaque mot-clé à adresse ; le titre et les alias de sa page quand il est seul à y mener ; une page sans mot-clé n’est pas une cible (le maillage n’en crée pas)', () => {
  const motsCles = [
    { id: 'humain', libelle: 'Humain', url: '/races/humain/' },
    { id: 'fiche', libelle: 'Fiche', url: '/fiche/' },
    { id: 'feu', libelle: 'Feu', url: '/magies/magie-du-feu/' },
    { id: 'magie-du-feu', libelle: 'Magie du feu', url: '/magies/magie-du-feu/' },
    { id: 'chakra', libelle: 'Chakra', url: null },
  ];
  const pages = [
    { id: 'races/humain', title: 'Humain', aliases: ['Humains'] },
    { id: 'magies/magie-du-feu', title: 'Magie du feu', aliases: ['Feu'] },
    { id: 'guide/sans', title: 'Sans mot-clé', aliases: [] },
  ];
  const pageDuMotCle = new Map([['humain', 'races/humain'], ['fiche', null], ['feu', 'magies/magie-du-feu'], ['magie-du-feu', 'magies/magie-du-feu']]);
  const { cibles: c, sansMotCle } = ciblesDuVocabulaire(motsCles, pages, pageDuMotCle);
  assert.deepEqual(c, [
    { id: 'humain', libelle: 'Humain', page: 'races/humain', termes: ['Humain', 'Humains'] },
    { id: 'fiche', libelle: 'Fiche', page: null, termes: [] },
    { id: 'feu', libelle: 'Feu', page: 'magies/magie-du-feu', termes: [] },
    { id: 'magie-du-feu', libelle: 'Magie du feu', page: 'magies/magie-du-feu', termes: [] },
  ], 'sans adresse (« chakra ») : pas une cible ; deux mots-clés pour une page : leurs libellés seuls');
  assert.deepEqual(sansMotCle, ['guide/sans']);
  const t = buildTerms(c).terms;
  assert.equal(autolink('Un Humains de la Fiche.', t, 'x').body, 'Un {{humain|Humains}} de la {{fiche}}.');
  assert.equal(autolink('Lancer un sort de Magie du feu.', t, 'x').body, 'Lancer un sort de {{magie-du-feu}}.');
});

test('fold garde la longueur du texte (indices valides) et ignore casse, accents, apostrophes', () => {
  for (const text of ['Éleveur d’œufs', 'İstanbul 😀 Forgeron', 'a b']) assert.equal(fold(text).length, text.length);
  assert.equal(fold('Éleveur d’Hôtel'), "eleveur d'hotel");
});

test('un titre à plusieurs mots devient la balise de son mot-clé, avec le texte d’origine s’il n’est pas le libellé', () => {
  assert.equal(run('Boire un philtre du puissant.').body, 'Boire un {{philtre-du-puissant|philtre du puissant}}.');
  assert.equal(run('Le Philtre du Puissant aide.').body, 'Le {{philtre-du-puissant}} aide.', 'le libellé : la balise seule');
  assert.equal(run('Voir jets de dés.').body, 'Voir {{des|jets de dés}}.', 'un alias de la page mène au mot-clé qui y mène, texte gardé');
  assert.equal(run('Un jet de dés.').body, 'Un {{des|jet de dés}}.', 'le titre de la page aussi');
  assert.equal(run('Les Dés roulent.').body, 'Les Dés roulent.', '« Dés » (3 lettres) est trop court pour être lié');
});

test('un terme d’un seul mot n’est lié que s’il commence par une majuscule', () => {
  assert.equal(run('Le forgeron travaille.').body, 'Le forgeron travaille.');
  assert.equal(run('Forgeron : travaille le métal.').body, '{{forgeron}} : travaille le métal.');
  assert.equal(run('Le forgeron voit un Forgeron.').body, 'Le forgeron voit un {{forgeron}}.', 'la première occurrence VALABLE est liée');
});

test('une seule liaison par page cible, jamais vers la page elle-même', () => {
  const r = run('Alchimie et encore Alchimie. Alchimie !');
  assert.equal(r.body, '{{alchimie}} et encore Alchimie. Alchimie !');
  assert.equal(r.links.length, 1);
  assert.equal(run('Alchimie', 'ressources/alchimie').body, 'Alchimie');
});

test('rien dans le code, les titres, les tableaux, les balises, liens et URLs existants', () => {
  const body = [
    '# Alchimie',
    '| Alchimie | Postures |',
    '`Alchimie` et [[Postures]] et [Postures](http://x/Postures) et https://x.fr/Alchimie',
    'Le {{chakra|Chakra de Postures}} et {{x:}}',
    '```',
    'Alchimie',
    '```',
    '<!-- Alchimie -->',
    '<span title="Alchimie">x</span>',
  ].join('\n');
  assert.equal(run(body).body, body);
});

test('les écritures de plusieurs mots-clés sont ignorées, les mots sont comparés entiers, les termes trop courts aussi', () => {
  assert.deepEqual(ambiguous, ['Neutre']);
  assert.equal(run('Un Neutre agit.').body, 'Un Neutre agit.');
  assert.equal(run('Marins et Marinade').body, 'Marins et Marinade', '« Marin » ne doit pas lier « Marins » ni « Marinade »');
  assert.equal(run('Un Marin part.').body, 'Un {{marin}} part.');
  assert.equal(run('Art et Postures').body, 'Art et {{postures}}', '« Art » (3 lettres) est trop court pour être lié');
});

test('le plus long terme gagne et le texte est lié ligne par ligne, avec une limite par page', () => {
  const longTerms = buildTerms([cible('a', 'p/a', 'Philtre'), cible('b', 'p/b', 'Philtre du Puissant')]).terms;
  assert.equal(autolink('Un Philtre du Puissant.', longTerms, 'x').body, 'Un {{b}}.');
  const many = Array.from({ length: 5 }, (_, i) => cible(`p${i}`, `p/p${i}`, `Titre${i}abc`));
  const limited = autolink(many.map((p) => p.libelle).join('\n'), buildTerms(many).terms, 'x', { maxLinks: 3 });
  assert.equal(limited.links.length, 3);
  assert.equal(limited.body.split('\n').filter((l) => l.startsWith('{{')).length, 3);
});

test('idempotent : relancer ne change plus rien ; un mot-clé déjà balisé dans la page ne l’est pas une seconde fois', () => {
  const once = run('Le Forgeron boit un philtre du puissant. Voir Postures et Alchimie.');
  const twice = run(once.body);
  assert.equal(twice.body, once.body);
  assert.equal(twice.links.length, 0);
  const deux = run('Alchimie, puis Alchimie.');
  assert.equal(deux.body, '{{alchimie}}, puis Alchimie.');
  assert.equal(run(deux.body).body, deux.body, 'la seconde mention n’est pas balisée à la relance');
  assert.equal(run('{{alchimie|L’art}} et Alchimie.').body, '{{alchimie|L’art}} et Alchimie.', 'balise écrite à la main');
});

test('jamais un [[lien]] : la sortie n’a que des balises de la forme canonique', () => {
  const r = run('Le Forgeron, un philtre du puissant, Postures, Alchimie, jets de dés, un Marin.');
  assert.doesNotMatch(r.body, /\[\[|\]\(/);
  for (const [b] of r.body.matchAll(/\{\{[^{}]*\}\}/g)) assert.match(b, /^\{\{[a-z0-9-]+(\|[^{}|]+)?\}\}$/, b);
  assert.equal(r.links.length, 6);
});

test('ce qui figure dans le nom de la page elle-même n’est pas lié', () => {
  const t = buildTerms([cible('savant', 'metiers/savant', 'Savant'), cible('philtre-du-savant', 'ressources/philtre-du-savant', 'Philtre du Savant')]).terms;
  const self = { id: 'ressources/philtre-du-savant', title: 'Philtre du Savant', aliases: [] };
  assert.equal(autolink('Le Philtre du Savant rend Savant.', t, self).body, 'Le Philtre du Savant rend {{savant}}.');
  assert.equal(autolink('Le Philtre du Savant rend Savant.', t, 'autre/page').body, 'Le {{philtre-du-savant}} rend Savant.');
  assert.equal(autolink('Le Philtre du Savant.', t.filter((x) => x.id === 'philtre-du-savant'), 'ressources/philtre-du-savant').body, 'Le Philtre du Savant.',
    'jamais vers la page elle-même');
});

test('la liste d’exclusion écarte une locution courante', () => {
  const guide = [cible('en-resume', 'guide/resume', 'En résumé')];
  assert.equal(autolink('Voici en résumé le tour.', buildTerms(guide).terms, 'x').body, 'Voici {{en-resume|en résumé}} le tour.');
  assert.equal(autolink('Voici en résumé le tour.', buildTerms(guide, { ignore: ['en résumé'] }).terms, 'x').body, 'Voici en résumé le tour.');
});

test('les pages que l’édition refait depuis les tables (races, classes, dons, magies, métiers) ou que leur importeur réécrit (lore : le Codex) ne reçoivent pas de balises ; leurs mots-clés restent des cibles', () => {
  // une balise posée dans leur corps serait perdue à la première modification (lib/corps-races.mjs, corps-classes.mjs, corps-magies.mjs ; le corps d'un
  // métier est exactement corpsDeMetier(ligne) depuis la 0098) ou au prochain import (tools/docs/codex.py --verifier : chaque page à l'octet près)
  for (const id of ['races/drakos', 'classes/guerrier', 'capacites/guerrier-brave', 'magies/magie-du-feu', 'metiers/forgeron', 'lore/erisia']) {
    assert.equal(aMailler({ id, type: id.split('/')[0] }), false, id);
    assert.equal(aMailler({ id }), false, `${id} (sans type)`);
  }
  for (const id of ['guide/postures', 'ressources/alchimie', 'bestiaire/loup']) assert.equal(aMailler({ id, type: id.split('/')[0] }), true, id);
  for (const t of TYPES_SANS_MAILLAGE) assert.ok(TYPE_KEYS.includes(t), `type ${t} connu`);
  // le script ne maille que ces pages ; les titres de toutes les pages restent des termes
  const script = readFileSync(fileURLToPath(new URL('../scripts/autolink.mjs', import.meta.url)), 'utf8');
  assert.match(script, /for \(const page of pages\.filter\(aMailler\)\)/);
  assert.match(script, /ciblesDuVocabulaire\(motsCles, pages, pageDuMotCle\)/);
  assert.match(script, /buildTerms\(cibles,/);
});
