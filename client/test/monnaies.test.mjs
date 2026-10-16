// Les monnaies en icônes (lib/monnaies.mjs, lib/markdown-monnaies.mjs ; demande du propriétaire : « partout dans toutes les tables il faudra retirer les
// abréviations RO. Il faudra remplacer par des icônes ») : les trois monnaies sont celles de la table monnaie (nom, abréviation, valeur, que le site de dev
// ne modifie pas), une abréviation seule devient son icône (pas « ROBE »), un montant se décompose en PP / RO / RF (« 1245,5 RO » → 1 PP 245 RO 50 RF),
// partout, texte courant compris, et le mode modification relit une icône en son abréviation, un montant tel qu'écrit.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { enRickenDeFer, htmlAvecMonnaies, htmlDePiece, infobulleDeMonnaie, MONNAIES_DU_JEU, montantDecompose, morceauxDeMonnaie } from '../src/lib/monnaies.mjs';
import { remarkMonnaies, uniteDeLEntete } from '../src/lib/markdown-monnaies.mjs';
import { piecesDuMontant } from '../src/lib/arme-forge.mjs';

test('les trois monnaies sont celles de la table monnaie (nom, abréviation, valeur en RF)', () => {
  const db = ouvrirBase({ sansExemples: false });
  for (const [abr, m] of Object.entries(MONNAIES_DU_JEU)) {
    const l = db.prepare('SELECT * FROM monnaie WHERE id = ?').get(m.id);
    assert.deepEqual([l.nom, l.abreviation, l.valeur_rf], [m.nom, abr, m.valeur_rf], abr);
  }
});

test('une abréviation seule devient son icône, avec son nom et sa valeur en infobulle', () => {
  assert.deepEqual(morceauxDeMonnaie('Coût(RO), les montants RF et Ro'), [{ texte: 'Coût(' }, { monnaie: 'RO' }, { texte: '), les montants ' }, { monnaie: 'RF' }, { texte: ' et ' }, { monnaie: 'Ro' }]);
  assert.deepEqual(morceauxDeMonnaie('ROBE, PRO, Rouge'), [{ texte: 'ROBE, PRO, Rouge' }]);
  assert.equal(infobulleDeMonnaie('PP'), 'Pierre précieuse : 1 000 Ricken d\'or = 100 000 Ricken de fer');
  assert.equal(infobulleDeMonnaie('RF'), 'Ricken de fer');
  assert.match(htmlDePiece('Ro'), /^<span class="piece piece--ro" role="img" aria-label="Ricken d&#39;or" title="[^"]+" data-monnaie="Ro"><\/span>$/);
  assert.equal(htmlAvecMonnaies('<b> PP'), `&lt;b&gt; ${htmlDePiece('PP')}`);
});

test('un montant est décomposé dans les trois monnaies (« 1245,5 RO » → 1 PP 245 RO 50 RF)', () => {
  assert.equal(enRickenDeFer('1245,5', 'RO'), 124550);
  assert.equal(enRickenDeFer('1 000', 'RF'), 1000);
  assert.equal(enRickenDeFer('0,005', 'RO'), null, 'un demi Ricken de fer ne se décompose pas');
  assert.deepEqual(montantDecompose(124550), [{ nombre: 1, abr: 'PP' }, { nombre: 245, abr: 'RO' }, { nombre: 50, abr: 'RF' }]);
  assert.deepEqual(montantDecompose(60), [{ nombre: 60, abr: 'RF' }]);
  const texte = (html) => html.replace(/<span class="piece piece--(\w+)[^>]*><\/span>/g, '[$1]').replace(/<[^>]+>/g, '').replace(/&#8239;/g, '');
  assert.equal(texte(htmlAvecMonnaies('Prix : 1245,5 RO.')), 'Prix : 1[pp] 245[ro] 50[rf].');
  assert.equal(texte(htmlAvecMonnaies('0,6 Ro')), '60[rf]');
  assert.equal(texte(htmlAvecMonnaies('0 RO')), '0[ro]');
  assert.equal(texte(htmlAvecMonnaies('1 000 RF / 10 Ro')), '10[ro]', 'deux écritures de la même somme n’en font qu’une');
  assert.equal(texte(htmlAvecMonnaies('100 RF / 10 RO')), '1[ro] / 10[ro]', 'deux écritures qui ne s’accordent pas restent deux');
  assert.equal(texte(htmlAvecMonnaies('40 000 - 50 000 Ro')), '40[pp] - 50[pp]');
  assert.equal(texte(htmlAvecMonnaies('1 PP = 1 000 RO = 100 000 RF')), '1[pp] = 1 000[ro] = 100 000[rf]', 'une conversion ne se décompose pas');
  assert.equal(texte(htmlAvecMonnaies('250 RF / Classe')), '2[ro] 50[rf] / Classe');
  // l'écriture d'origine reste dans data-montant (relue par le mode modification)
  assert.match(htmlAvecMonnaies('1245,5 RO'), /^<span class="montant" data-montant="1245,5 RO" title="1245,5 Ricken d&#39;or = 124 550 Ricken de fer">/);
});

test('une colonne dont l’en-tête écrit l’unité lit ses nombres seuls comme des montants', () => {
  assert.equal(uniteDeLEntete('Coût(RO)'), 'RO');
  assert.equal(uniteDeLEntete('Prix'), null);
  assert.deepEqual(morceauxDeMonnaie('100 + 1 Matériau', { unite: 'RO' }), [{ montant: { nombre: '100', abr: 'RO', ecrit: '100' } }, { texte: ' + 1 Matériau' }]);
  assert.deepEqual(morceauxDeMonnaie('100 + 1 Matériau'), [{ texte: '100 + 1 Matériau' }], 'sans unité, un nombre reste un nombre');
});

test('le plugin remark : texte courant et cases, nombres seuls d’une colonne « (RO) », jamais un lien ni un code', () => {
  const md = 'Prix en RO : 1245,5 RO, `10 RO`.\n\n| Niveau | Coût(RO) | Prix |\n| --- | --- | --- |\n| +1 | 1245.5 | 3 |\n| +2 | 100 + 1 Matériau | 25 RF |\n';
  const arbre = unified().use(remarkParse).use(remarkGfm).parse(md);
  remarkMonnaies()(arbre);
  const html = JSON.stringify(arbre);
  assert.ok(!/"value":"[^"]*\bRO\b/.test(html.replace(/data-monnaie=\\"R[OoFf]\\"|data-montant=\\"[^\\]*\\"/g, '').replace(/"type":"inlineCode","value":"[^"]*"/g, '')), 'plus d’abréviation hors code');
  assert.ok(html.includes('"type":"inlineCode","value":"10 RO"'), 'le code reste tel quel');
  assert.ok(html.includes('data-montant=\\"1245.5\\"'), 'nombre seul de la colonne « Coût(RO) »');
  assert.ok(html.includes('data-montant=\\"100\\"'), '« 100 + 1 Matériau » : 100 RO');
  assert.ok(html.includes('"value":"3"'), 'la colonne « Prix » n’écrit pas d’unité : le nombre reste un nombre');
});

test('le plugin remark : une balise du glossaire des mots-clés reste entière, aucun montant n’y est lu (texte courant comme colonne « (RO) », « \\| » d’une case compris)', () => {
  const md = 'Le {{prix-fixe|10 RO}} coûte 5 RO.\n\n| Objet | Coût(RO) |\n| --- | --- |\n| Arc | {{prix-fixe\\|12}} |\n| Épée | 12 |\n';
  const arbre = unified().use(remarkParse).use(remarkGfm).parse(md);
  remarkMonnaies()(arbre);
  const json = JSON.stringify(arbre);
  assert.ok(json.includes('"value":"{{prix-fixe|10 RO}}"'), 'la balise du texte courant : un morceau de texte entier, tel qu’écrit');
  assert.ok(json.includes('data-montant=\\"5 RO\\"'), 'le montant hors de la balise');
  assert.ok(json.includes('"value":"{{prix-fixe|12}}"'), 'la balise d’une case de la colonne « Coût(RO) » : pas un montant');
  assert.ok(json.includes('data-montant=\\"12\\"'), 'le nombre seul de l’autre ligne en est un');
  assert.ok(!/data-montant=\\"10 RO\\"/.test(json));
});

test('la page des armes décompose ses montants comme lib/monnaies.mjs (lib/arme-forge.mjs#piecesDuMontant)', () => {
  for (const ro of [0, 0.5, 1, 7, 99.99, 100, 999, 1000, 1245.5, 1220, 123456.78]) {
    const attendu = Math.round(ro * 100) ? montantDecompose(Math.round(ro * 100)) : [{ nombre: 0, abr: 'RO' }];
    assert.deepEqual(piecesDuMontant(ro), attendu, String(ro));
  }
  const valeurs = Object.fromEntries(Object.entries(MONNAIES_DU_JEU).map(([a, m]) => [a, m.valeur_rf]));
  assert.deepEqual(valeurs, { RF: 1, RO: 100, PP: 100000 }, 'piecesDuMontant écrit ces valeurs');
});
