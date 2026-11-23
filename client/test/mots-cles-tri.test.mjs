// Le tri des mots-clés par libellé (lib/mots-cles.mjs#parLibelle, décision R309 : « Les postures » se range à P) : un article de tête entier (Le, La, Les, L')
// ne compte pas, ni dans la liste du Glossaire ni dans les pastilles. Des libellés inventés.
//   node --test test/mots-cles-tri.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cleDeTri, parLibelle, sansArticle } from '../src/lib/mots-cles.mjs';

test('sansArticle ne retire qu’un article entier de tête : Le, La, Les, L’ (apostrophe droite ou courbe), sans casse', () => {
  assert.equal(sansArticle('Les postures'), 'postures');
  assert.equal(sansArticle('La garde'), 'garde');
  assert.equal(sansArticle('Le feu'), 'feu');
  assert.equal(sansArticle('L’embuscade'), 'embuscade');
  assert.equal(sansArticle("L'embuscade"), 'embuscade');
  assert.equal(sansArticle('LES POSTURES'), 'POSTURES');
  assert.equal(sansArticle('Le  feu'), 'feu', 'plusieurs espaces');
  // un mot qui commence comme un article n'en est pas un
  for (const t of ['Lame', 'Lesbos', 'Lemme', 'Laine', 'Lune']) assert.equal(sansArticle(t), t, t);
  // un libellé réduit à son article reste entier
  for (const t of ['Le', 'La', 'Les', 'L’', "L'", 'Les ', '  La']) assert.equal(sansArticle(t), t.trim(), JSON.stringify(t));
  assert.equal(sansArticle(null), '');
  assert.equal(sansArticle(undefined), '');
});

test('parLibelle range sur le libellé sans son article : « Les postures » à P, « L’embuscade » à E, « Lame » à L', () => {
  const m = (libelle, id) => ({ id, libelle, cle: libelle.toLowerCase() });
  const tri = ['Lame', 'Les postures', 'Garde', 'L’embuscade', 'Zèbre', 'Armure'].map(m).sort(parLibelle).map((x) => x.libelle);
  assert.deepEqual(tri, ['Armure', 'L’embuscade', 'Garde', 'Lame', 'Les postures', 'Zèbre']);
});

test('parLibelle : à égalité après le retrait de l’article, l’ordre reste déterminé (le libellé complet départage, puis la clé, puis l’id)', () => {
  const m = (libelle, id, cle = libelle) => ({ id, libelle, cle });
  // mêmes lettres après l'article : le libellé complet les range
  const a = [m('Le feu', 3), m('Feu', 1), m('La feu', 2), m('Les feu', 4)];
  const ordre = (l) => [...l].sort(parLibelle).map((x) => x.id);
  assert.deepEqual(ordre(a), [1, 2, 3, 4]);
  assert.deepEqual(ordre([...a].reverse()), [1, 2, 3, 4], 'quel que soit l’ordre de départ');
  // deux libellés identiques : par clé, puis par id
  const h = [m('Garde', 9, 'garde-b'), m('Garde', 8, 'garde-a'), m('Garde', 7, 'garde-a')];
  assert.deepEqual(ordre(h), [7, 8, 9]);
  // un libellé réduit à son article se range sous cet article, sans planter
  assert.deepEqual(ordre([m('Les', 2), m('Armure', 1)]), [1, 2]);
});

test('T10-ponctuation-de-tete : parLibelle range sans la ponctuation de tête, puis sans l’article — « ... la destruction » à D, « « Campagne » ou… » à C', () => {
  assert.equal(cleDeTri('... la destruction (Arbalétrier)'), 'destruction (Arbalétrier)');
  assert.equal(cleDeTri('« Campagne » ou « Scénario one shot » ?'), 'Campagne » ou « Scénario one shot » ?');
  assert.equal(cleDeTri('. de coquelicot (Goleois)'), 'de coquelicot (Goleois)');
  assert.equal(cleDeTri('… Toi ! (Moine)'), 'Toi ! (Moine)');
  assert.equal(cleDeTri('...'), '...', 'un libellé fait seulement de ponctuation garde sa place');
  assert.equal(cleDeTri('« »'), '« »');
  assert.equal(cleDeTri(''), '');
  assert.equal(cleDeTri('L’embuscade'), 'embuscade', 'sans ponctuation de tête : comme sansArticle');
  assert.equal(cleDeTri('Les'), 'Les');
  assert.equal(sansArticle('... la destruction'), '... la destruction', 'sansArticle garde son contrat : un article de tête, rien d’autre');
  const m = (libelle, id) => ({ id, libelle, cle: libelle.toLowerCase() });
  const noms = ['Zèbre', '... la destruction (Arbalétrier)', '« Campagne » ou « Scénario one shot » ?', '. de coquelicot (Goleois)', '... Brutale (Mage Vert)', 'Armure', '… Toi ! (Moine)', 'Les postures'];
  assert.deepEqual(noms.map(m).sort(parLibelle).map((x) => x.libelle), [
    'Armure', '... Brutale (Mage Vert)', '« Campagne » ou « Scénario one shot » ?', '. de coquelicot (Goleois)', '... la destruction (Arbalétrier)', 'Les postures', '… Toi ! (Moine)', 'Zèbre',
  ]);
  // le départage ne change pas : à clé égale, le libellé complet, puis la clé, puis l'id
  const egaux = [m('... Feu', 3), m('Feu', 1), m('. Feu', 2)];
  const ordre = [...egaux].sort(parLibelle).map((x) => x.id);
  assert.deepEqual([...egaux].reverse().sort(parLibelle).map((x) => x.id), ordre, 'même clé de tri : l’ordre reste déterminé');
  assert.equal(new Set(ordre).size, 3);
  // un libellé de ponctuation seule se range comme avant (sa propre écriture), sans lever
  assert.doesNotThrow(() => [m('...', 1), m('Armure', 2)].sort(parLibelle));
});

// T13 (R309) : le site de dev trie tout le vocabulaire à chaque GET edition/listes/ (serveur/edition.mjs) ; à 1 764 mots-clés, un `localeCompare` avec options par
// comparaison coûtait ~100 ms au chargement de chaque page (mesuré dans Chrome : +143 ms avant que le vocabulaire arrive). Un seul `Intl.Collator`, même ordre.
test('T13 : parLibelle garde l’ordre de localeCompare sur 1 764 libellés inventés, et en coûte au plus un tiers', () => {
  const syllabes = ['ba', 'dé', 'fi', 'gor', 'hé', 'ju', 'ka', 'lo', 'mi', 'nu', 'ou', 'pé', 'qui', 'ré', 'sa', 'tou', 'vi', 'ze'];
  const articles = ['', '', '', 'Le ', 'La ', 'Les ', 'L’', '... ', '« '];
  let graine = 7;
  const alea = (n) => { graine = (graine * 1103515245 + 12345) % 2147483648; return graine % n; };
  const mots = Array.from({ length: 1764 }, (_, id) => {
    const nom = Array.from({ length: 2 + alea(3) }, () => syllabes[alea(syllabes.length)]).join('');
    return { id: id + 1, libelle: `${articles[alea(articles.length)]}${alea(2) ? nom : nom[0].toUpperCase() + nom.slice(1)}${alea(4) ? '' : ` (${alea(50)})`}`, cle: `cle-${id + 1}` };
  });
  // la référence : le comparateur d'avant, `localeCompare` avec ses options à chaque appel
  const comparer = (a, b) => String(a ?? '').localeCompare(String(b ?? ''), 'fr', { sensitivity: 'base' });
  const avant = (a, b) => comparer(cleDeTri(a.libelle), cleDeTri(b.libelle)) || comparer(a.libelle, b.libelle)
    || String(a.cle ?? '').localeCompare(String(b.cle ?? '')) || (typeof a.id === 'number' && typeof b.id === 'number' ? a.id - b.id : String(a.id).localeCompare(String(b.id)));
  const duree = (tri) => Math.min(...[1, 2].map(() => { const t0 = performance.now(); [...mots].sort(tri); return performance.now() - t0; }));
  assert.deepEqual([...mots].sort(parLibelle).map((m) => m.id), [...mots].sort(avant).map((m) => m.id));
  const [maintenant, anciennement] = [duree(parLibelle), duree(avant)];
  assert.ok(maintenant * 3 < anciennement, `${maintenant.toFixed(1)} ms contre ${anciennement.toFixed(1)} ms`);
});
