// La pose des balises d'un mot du glossaire dans un texte (lib/glossaire-balisage.mjs ; demande du propriétaire du 2026-10-17 : « Transforme dans tous les
// textes le mot "Chakra" (ou chakra) en mot clé », puis « Barrière ») : la forme canonique de chaque colonne, le texte affiché inchangé, et ce qui ne se
// balise jamais (mot collé, nom d'une chose, balise déjà écrite, HTML, code, liens, titres de section).
//   node --test test/glossaire-balisage.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { baliserLeMot } from '../src/lib/glossaire-balisage.mjs';
import { formesNonCanoniques, texteSansBalises } from '../src/lib/mots-cles-balises.mjs';

const CHAKRA = { id: 'chakra', libelle: 'Chakra', motif: 'chakras?' };
const BARRIERE = { id: 'barriere', libelle: 'Barrière', motif: 'barrières?' };
const VOCABULAIRE = [
  { id: 'chakra', libelle: 'Chakra', description: 'Énergie consommée lors de l’utilisation de magie.' },
  { id: 'barriere', libelle: 'Barrière', description: 'Une seconde peau invisible.' },
];

/** Le texte balisé, contrôlé : sa forme est canonique et il s'affiche comme le texte d'origine. */
function balise(texte, mot, options = {}) {
  const r = baliserLeMot(texte, { ...mot, ...options });
  assert.deepEqual(formesNonCanoniques(r.texte, VOCABULAIRE, { markdown: Boolean(options.markdown) }), [], r.texte);
  const affiche = (t) => texteSansBalises(t, VOCABULAIRE, { markdown: Boolean(options.markdown) });
  assert.equal(affiche(r.texte), affiche(texte));
  return r;
}

test('un texte de case porte toujours le texte écrit (« {{id|texte}} »), quelle que soit la casse ou le nombre', () => {
  const r = balise('Coûte 10 chakra. Le Chakra revient ; les chakras aussi. CHAKRA !', CHAKRA);
  assert.equal(r.texte, 'Coûte 10 {{chakra|chakra}}. Le {{chakra|Chakra}} revient ; les {{chakra|chakras}} aussi. {{chakra|CHAKRA}} !');
  assert.deepEqual(r.balisees, ['chakra', 'Chakra', 'chakras', 'CHAKRA']);
  assert.deepEqual(r.ignorees, []);
});

test('un texte mis en forme cite « {{id}} » pour le libellé, « {{id|texte}} » sinon, « {{id\\|texte}} » sur une ligne de tableau', () => {
  const md = 'La Barrière protège.\n\n| Attribut | Effet |\n| --- | --- |\n| Barrière | 5 barrière |\n\nUne barrière.';
  const r = balise(md, BARRIERE, { markdown: true });
  assert.equal(r.texte, 'La {{barriere}} protège.\n\n| Attribut | Effet |\n| --- | --- |\n| {{barriere}} | 5 {{barriere\\|barrière}} |\n\nUne {{barriere|barrière}}.');
});

test('un mot collé à une lettre, un chiffre, un trait d’union ou une accolade n’est pas le mot', () => {
  const r = balise('Nanochakra, Chakram, chakratique, Anti-barrière, chakra-sensible, chakra2, {chakra} ; mais (chakra) et chakra/barrière', CHAKRA);
  assert.equal(r.texte, 'Nanochakra, Chakram, chakratique, Anti-barrière, chakra-sensible, chakra2, {chakra} ; mais ({{chakra|chakra}}) et {{chakra|chakra}}/barrière');
});

test('le nom d’une chose garde son écriture, sans la casse ni la forme des apostrophes', () => {
  const noms = ['Boule de Chakra', 'Barrière d\'eau', 'Super barrière'];
  const r = balise('Lance boule de chakra puis une Barrière d’eau ; la super barrière double la barrière.', BARRIERE, { noms });
  assert.equal(r.texte, 'Lance boule de chakra puis une Barrière d’eau ; la super barrière double la {{barriere|barrière}}.');
  assert.deepEqual(r.ignorees, [{ ecriture: 'Barrière', raison: 'nom « Barrière d\'eau »' }, { ecriture: 'barrière', raison: 'nom « Super barrière »' }]);
  const c = balise('Lance boule de chakra (10 chakra).', CHAKRA, { noms });
  assert.equal(c.texte, 'Lance boule de chakra (10 {{chakra|chakra}}).');
});

test('une balise déjà écrite, une balise HTML ou un commentaire ne changent pas ; le balisage se refait sans rien ajouter', () => {
  const r = balise('{{chakra|Chakra}} et chakra<br>chakra <span title="chakra">x</span>', CHAKRA);
  assert.equal(r.texte, '{{chakra|Chakra}} et {{chakra|chakra}}<br>{{chakra|chakra}} <span title="chakra">x</span>');
  assert.equal(baliserLeMot(r.texte, CHAKRA).texte, r.texte);
  const md = balise('<!-- guide:chakra -->\nLe chakra.', CHAKRA, { markdown: true });
  assert.equal(md.texte, '<!-- guide:chakra -->\nLe {{chakra|chakra}}.');
});

test('dans un texte mis en forme : ni code, ni lien du wiki, ni lien, ni titre de section', () => {
  const md = [
    '## Le chakra',
    '',
    'Le `chakra` écrit en code, [[Chakra]], [[Mur de chakra|le mur de chakra]], [le chakra](/guide/chakra/) et ![chakra](/chakra.png).',
    '',
    '```',
    'chakra',
    '```',
    '',
    'Le chakra, enfin.',
  ].join('\n');
  const r = balise(md, CHAKRA, { markdown: true });
  assert.equal(r.texte, md.replace('Le chakra, enfin.', 'Le {{chakra|chakra}}, enfin.'));
  assert.deepEqual([...new Set(r.ignorees.map((i) => i.raison))].sort(), ['code', 'lien', 'lien du wiki', 'titre de section']);
});

test('un texte sans le mot, vide ou absent est rendu tel quel', () => {
  for (const t of ['Santé seule.', '', null]) assert.deepEqual(baliserLeMot(t, CHAKRA), { texte: t, balisees: [], ignorees: [] });
});

test('un intitulé en gras seul sur sa ligne (le nom d’un lieu du Codex) est un titre ; une ligne qui commence en gras puis continue ne l’est pas', () => {
  const md = '**Barrière**\\\nLa troisième grosse ville.\n\n**Forteresse de Chakra** :\n\n**Chakra** : le nombre de points de magie, pas de **sorts** sans chakra.';
  const r = balise(md, CHAKRA, { markdown: true });
  assert.equal(r.texte, '**Barrière**\\\nLa troisième grosse ville.\n\n**Forteresse de Chakra** :\n\n**{{chakra}}** : le nombre de points de magie, pas de **sorts** sans {{chakra|chakra}}.');
  assert.deepEqual(r.ignorees, [{ ecriture: 'Chakra', raison: 'intitulé en gras' }]);
  assert.equal(balise(md, BARRIERE, { markdown: true }).texte, md, 'la ville de Barrière garde son nom');
});

test('une écriture exclue à la demande (nom propre que la base ne range pas, autre sens du mot) reste telle quelle', () => {
  const exclus = ['Académie de Chakra', 'barrière naturelle', 'barrières qu’elle génère'];
  const r = balise('L’Académie de chakra forme au chakra ; une Barrière naturelle ; les barrières qu\'elle génère ; la barrière.', BARRIERE, { exclus });
  assert.equal(r.texte, 'L’Académie de chakra forme au chakra ; une Barrière naturelle ; les barrières qu\'elle génère ; la {{barriere|barrière}}.');
  assert.deepEqual(r.ignorees.map((i) => i.raison), ['écriture exclue « barrière naturelle »', 'écriture exclue « barrières qu’elle génère »']);
  assert.equal(balise('L’Académie de chakra forme au chakra.', CHAKRA, { exclus }).texte, 'L’Académie de chakra forme au {{chakra|chakra}}.');
});

test('ni une adresse, ni une définition de lien, ni un titre souligné ; « _chakra_ » (une mise en forme) se balise, « {chakra} » non', () => {
  const md = 'Voir https://exemple.fr/chakra/ et www.chakra.fr.\n\n[ref]: /guide/chakra/\n\nLe chakra\n=========\n\nUn _chakra_ et {chakra}.';
  const r = balise(md, CHAKRA, { markdown: true });
  assert.equal(r.texte, md.replace('Un _chakra_', 'Un _{{chakra|chakra}}_'));
  assert.deepEqual([...new Set(r.ignorees.map((i) => i.raison))].sort(), ['adresse', 'lien', 'titre de section']);
  assert.equal(balise('Coût : 5 chakra, https://ex.fr/chakra', CHAKRA).texte, 'Coût : 5 {{chakra|chakra}}, https://ex.fr/chakra', 'aussi dans un texte de case');
});
