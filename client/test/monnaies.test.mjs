// Les monnaies en icônes (lib/monnaies.mjs, lib/markdown-monnaies.mjs ; demande du propriétaire : « partout dans toutes les tables il faudra retirer les
// abréviations RO. Il faudra remplacer par des icônes ») : les trois monnaies sont celles de la table monnaie (nom, abréviation, valeur, que le site de dev
// ne modifie pas), une abréviation seule devient son icône (pas « ROBE »), le plugin ne touche qu'aux cases de tableau, et le mode modification relit une
// icône en son abréviation telle qu'écrite.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { htmlAvecMonnaies, htmlDePiece, infobulleDeMonnaie, MONNAIES_DU_JEU, morceauxDeMonnaie } from '../src/lib/monnaies.mjs';
import { remarkMonnaies } from '../src/lib/markdown-monnaies.mjs';

test('les trois monnaies sont celles de la table monnaie (nom, abréviation, valeur en RF)', () => {
  const db = ouvrirBase({ sansExemples: false });
  for (const [abr, m] of Object.entries(MONNAIES_DU_JEU)) {
    const l = db.prepare('SELECT * FROM monnaie WHERE id = ?').get(m.id);
    assert.deepEqual([l.nom, l.abreviation, l.valeur_rf], [m.nom, abr, m.valeur_rf], abr);
  }
});

test('une abréviation seule devient son icône, avec son nom et sa valeur en infobulle', () => {
  assert.deepEqual(morceauxDeMonnaie('1 000 RF / 10 Ro'), [{ texte: '1 000 ' }, { monnaie: 'RF' }, { texte: ' / 10 ' }, { monnaie: 'Ro' }]);
  assert.deepEqual(morceauxDeMonnaie('ROBE, PRO, Rouge'), [{ texte: 'ROBE, PRO, Rouge' }]);
  assert.equal(infobulleDeMonnaie('PP'), 'Pierre précieuse : 1 000 Ricken d\'or = 100 000 Ricken de fer');
  assert.equal(infobulleDeMonnaie('RF'), 'Ricken de fer');
  assert.match(htmlDePiece('Ro'), /^<span class="piece piece--ro" role="img" aria-label="Ricken d&#39;or" title="[^"]+" data-monnaie="Ro"><\/span>$/);
  assert.equal(htmlAvecMonnaies('<b> 2 PP'), `&lt;b&gt; 2 ${htmlDePiece('PP')}`);
});

test('le plugin remark : seules les cases de tableau changent', () => {
  const arbre = unified().use(remarkParse).use(remarkGfm).parse('Prix en RO.\n\n| Nom | Prix |\n| --- | --- |\n| Corde | 25 RF |\n');
  remarkMonnaies()(arbre);
  const html = JSON.stringify(arbre);
  assert.ok(html.includes('Prix en RO.'), 'le paragraphe garde son abréviation');
  assert.ok(html.includes('piece piece--rf'), 'la case a son icône');
});
