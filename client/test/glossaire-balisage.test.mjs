// La pose des balises d'un mot du glossaire dans un texte (lib/glossaire-balisage.mjs ; demande du propriétaire du 2026-10-17 : « Transforme dans tous les
// textes le mot "Chakra" (ou chakra) en mot clé », puis « Barrière ») : la forme canonique de chaque colonne, le texte affiché inchangé, et ce qui ne se
// balise jamais (mot collé, nom d'une chose, balise déjà écrite, HTML, code, liens, titres de section) ; puis (2026-10-18 : « Seulement là où il est
// pertinent ») les contextes exclus, un mot écrit avec sa casse (« CR ») et le retrait des balises posées autour du mot.
//   node --test test/glossaire-balisage.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { baliserLeMot, ecrituresDuMotDans, sansLesBalisesDuMot } from '../src/lib/glossaire-balisage.mjs';
import { formesNonCanoniques, texteSansBalises } from '../src/lib/mots-cles-balises.mjs';

const CHAKRA = { id: 'chakra', libelle: 'Chakra', motif: 'chakras?' };
const BARRIERE = { id: 'barriere', libelle: 'Barrière', motif: 'barrières?' };
const CORRUPTION = { id: 'corruption', libelle: 'Corruption', motif: 'corruptions?' };
const CR = { id: 'cr', libelle: 'CR', motif: 'CR', casse: true };
const VOCABULAIRE = [
  { id: 'chakra', libelle: 'Chakra', description: 'Énergie consommée lors de l’utilisation de magie.' },
  { id: 'barriere', libelle: 'Barrière', description: 'Une seconde peau invisible.' },
  { id: 'corruption', libelle: 'Corruption', description: 'Poison du chakra.' },
  { id: 'cr', libelle: 'CR', description: 'Sort lancé en utilisant la corruption.' },
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

test('un contexte exclu (expression régulière et raison) laisse le mot là où il n’a pas le sens du mot-clé ; « ^ » et « $ » bornent une ligne', () => {
  const contextes = [
    { motif: '(?:magies?|sorts?|ceux)\\s+de\\s+(?:la\\s+)?corruption', raison: 'la magie de la Corruption' },
    { motif: '^\\|\\s*corruption\\s*\\|', raison: 'le nom d’une magie dans un tableau' },
  ];
  const r = balise('Inflige 3 corruption à ceux de la Corruption. Les sorts de corruption coûtent de la corruption.', CORRUPTION, { contextes });
  assert.equal(r.texte, 'Inflige 3 {{corruption|corruption}} à ceux de la Corruption. Les sorts de corruption coûtent de la {{corruption|corruption}}.');
  assert.deepEqual(r.ignorees, [
    { ecriture: 'Corruption', raison: 'la magie de la Corruption' },
    { ecriture: 'corruption', raison: 'la magie de la Corruption' },
  ]);
  const t = balise('| Magie | Effet |\n| --- | --- |\n| Corruption | Divise par 2 le coût en corruption |', CORRUPTION, { contextes, markdown: true });
  assert.equal(t.texte, '| Magie | Effet |\n| --- | --- |\n| Corruption | Divise par 2 le coût en {{corruption\\|corruption}} |');
  assert.deepEqual(t.ignorees, [{ ecriture: 'Corruption', raison: 'le nom d’une magie dans un tableau' }]);
});

test('un mot écrit avec sa casse (« CR ») : « cr » n’est pas le mot', () => {
  const r = balise('Si CR : +1d de dégâts. 2d6 cr (+1d/NM).', CR);
  assert.equal(r.texte, 'Si {{cr|CR}} : +1d de dégâts. 2d6 cr (+1d/NM).');
  assert.deepEqual(r.balisees, ['CR']);
});

test('sansLesBalisesDuMot retire les balises posées autour du mot, rien d’autre ; rebaliser avec les mêmes règles redonne le texte', () => {
  const markdown = '**{{chakra}}** : le {{chakra|chakra}} du {{barriere|Barrière}}.\n\n| a | b |\n| --- | --- |\n| {{chakra\\|chakra}} | {{chakra\\|énergie}} |\n\n{{chakra:}}';
  const r = sansLesBalisesDuMot(markdown, { ...CHAKRA, markdown: true });
  assert.equal(r.texte, '**Chakra** : le chakra du {{barriere|Barrière}}.\n\n| a | b |\n| --- | --- |\n| chakra | {{chakra\\|énergie}} |\n\n{{chakra:}}');
  assert.equal(r.retirees, 3, 'ni un autre texte (« énergie »), ni le mode complet, ni un autre mot-clé');
  assert.equal(baliserLeMot(r.texte, { ...CHAKRA, markdown: true }).texte, markdown);
  // dans un texte de case, « {{chakra}} » n'est pas une balise posée par l'outil (il y écrit toujours le texte) : elle reste
  assert.deepEqual(sansLesBalisesDuMot('Coûte 4 {{chakra|Chakra}}, {{chakra}}.', CHAKRA), { texte: 'Coûte 4 Chakra, {{chakra}}.', retirees: 1 });
  // avec la casse : « {{cr|cr}} » n'entoure pas le mot « CR »
  assert.deepEqual(sansLesBalisesDuMot('Si {{cr|CR}}, {{cr|cr}}.', CR), { texte: 'Si CR, {{cr|cr}}.', retirees: 1 });
  assert.deepEqual(sansLesBalisesDuMot('Sans balise.', CHAKRA), { texte: 'Sans balise.', retirees: 0 });
});

test('un contexte ne commence jamais au milieu d’un mot : « sources? de chakra » ne prend pas « ressources de chakra »', () => {
  const contextes = [{ motif: 'sources?\\s+de\\s+chakra', raison: 'le chakra du monde' }];
  const r = balise('Des sources de chakra coulent. Les ressources de chakra du lanceur baissent.', CHAKRA, { contextes });
  assert.equal(r.texte, 'Des sources de chakra coulent. Les ressources de {{chakra|chakra}} du lanceur baissent.');
});

test('ecrituresDuMotDans : chaque écriture du mot, dans l’ordre, balisée ou non ; la même suite avant et après un passage', () => {
  const avant = 'Le **{{chakra}}** pur, 3 chakra, {{chakra|énergie}} et {{barriere|chakra}}.';
  assert.deepEqual(ecrituresDuMotDans(avant, { ...CHAKRA, markdown: true }).map(({ ecriture, balisee }) => [ecriture, balisee]),
    [['Chakra', true], ['chakra', false]], 'ni un autre texte du mot-clé, ni le mot dans la balise d’un autre mot-clé');
  const apres = sansLesBalisesDuMot(avant, { ...CHAKRA, markdown: true }).texte;
  assert.deepEqual(ecrituresDuMotDans(apres, { ...CHAKRA, markdown: true }).map(({ ecriture, balisee }) => [ecriture, balisee]), [['Chakra', false], ['chakra', false]]);
  assert.deepEqual(ecrituresDuMotDans('Si {{cr|CR}} ; 2d6 cr ; Si CR.', CR).map(({ ecriture, balisee }) => [ecriture, balisee]), [['CR', true], ['CR', false]]);
});
