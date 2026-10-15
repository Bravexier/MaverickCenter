// Analyseur et écrivain XML minimal (lib/xml-mini.mjs) : les parties XML du .xlsx et du .ods de la fiche de personnage en tableur.
// Ce que produisent Excel, LibreOffice et Google Sheets (entités, CDATA, commentaires, guillemets simples, « > » et sauts de ligne dans un
// attribut, préfixes), ce qui est refusé (DOCTYPE, entité inconnue, document mal formé), l'écriture (échappements, caractères interdits) et
// l'aller-retour fidèle sur les parties du modèle de la fiche (client/src/modeles/fiche-personnage).
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { analyserXml, enfantNomme, enfantsNommes, nomLocal, serialiserXml, texteDe } from '../src/lib/xml-mini.mjs';

const MODELE = fileURLToPath(new URL('../src/modeles/fiche-personnage/', import.meta.url));
const lireModele = (chemin) => readFileSync(join(MODELE, chemin), 'utf8');
const el = (nom, attrs = {}, enfants = []) => ({ nom, attrs, enfants });
const illisible = (motif) => (e) => e instanceof Error && e.message.startsWith('XML illisible : ') && motif.test(e.message);
const allerRetour = (arbre) => analyserXml(serialiserXml(arbre));

test('arbre : noms préfixés tels qu’écrits, attributs dans l’ordre, éléments et textes mêlés', () => {
  const racine = analyserXml('<a:racine xmlns:a="urn:a" c="3" b="2"><a:enfant x="y">texte</a:enfant><vide/>fin</a:racine>');
  assert.deepEqual(racine, el('a:racine', { 'xmlns:a': 'urn:a', c: '3', b: '2' }, [el('a:enfant', { x: 'y' }, ['texte']), el('vide'), 'fin']));
  assert.deepEqual(Object.keys(racine.attrs), ['xmlns:a', 'c', 'b']);
});

test('espaces jamais retirés ; fins de ligne \\r\\n et \\r → \\n, un &#13; reste', () => {
  assert.deepEqual(analyserXml('<a> <b> x </b>\n</a>'), el('a', {}, [' ', el('b', {}, [' x ']), '\n']));
  assert.deepEqual(analyserXml('<a>un\r\ndeux\rtrois&#13;</a>').enfants, ['un\ndeux\ntrois\r']);
});

test('entités : les 5 prédéfinies, &#N; et &#xH; décodées en une passe', () => {
  const t = analyserXml('<t a="&lt;&gt;&amp;&quot;&apos;&#x41;">&lt;&gt;&amp;&quot;&apos;&#10;&#x41;&#233;&#x1F600;|&amp;lt;|&#38;#38;</t>');
  assert.equal(t.attrs.a, '<>&"\'A');
  assert.deepEqual(t.enfants, ['<>&"\'\nAé😀|&lt;|&#38;']);
});

test('entités refusées : inconnue, « & » isolé, référence hors d’Unicode', () => {
  assert.throws(() => analyserXml('<t>&nbsp;</t>'), illisible(/entité inconnue « &nbsp; »/));
  assert.throws(() => analyserXml('<t a="&eacute;"/>'), illisible(/entité inconnue « &eacute; »/));
  assert.throws(() => analyserXml('<t>Pierre & Paul</t>'), illisible(/« & » qui n’ouvre aucune entité/));
  assert.throws(() => analyserXml('<t>&amp</t>'), illisible(/« & » qui n’ouvre aucune entité/));
  for (const ref of ['&#0;', '&#xD800;', '&#x110000;', '&#99999999999;', '&#X41;', '&#;', '&#x;']) {
    assert.throws(() => analyserXml(`<t>${ref}</t>`), illisible(/./), ref);
  }
});

test('DOCTYPE refusé (pas d’entités déclarées : « milliard de rires »)', () => {
  const rires = '<?xml version="1.0"?><!DOCTYPE lol [<!ENTITY lol "lol"><!ENTITY lol2 "&lol;&lol;">]><lolz>&lol2;</lolz>';
  assert.throws(() => analyserXml(rires), illisible(/DOCTYPE refusé/));
  assert.throws(() => analyserXml('<!DOCTYPE html><html/>'), illisible(/DOCTYPE refusé/));
  assert.throws(() => analyserXml('<a><!ENTITY x "y"></a>'), illisible(/déclaration « <!ENTITY x… » refusée/));
});

test('CDATA rendu en texte (tel quel, réuni aux textes voisins) ; commentaires, instructions, déclaration et BOM ignorés', () => {
  assert.deepEqual(analyserXml('<a>x<![CDATA[<b>&amp;</b> ]]>y</a>').enfants, ['x<b>&amp;</b> y']);
  assert.deepEqual(analyserXml('<a>x<!-- <b>&nbsp; --->y<?pi données?>z</a>').enfants, ['xyz']);
  assert.deepEqual(analyserXml('﻿<?xml version="1.0" encoding="UTF-8"?>\r\n<!-- avant -->\n<a/>\n<!-- après -->\n<?fin?>\n'), el('a'));
});

test('attributs : guillemets simples, « > » dans une valeur, tabulation et saut de ligne littéraux → espace, &#10; &#9; &#13; gardés', () => {
  const a = analyserXml(`<a v='il dit "oui"' w="l'a" f="x>y" g='1>0' n="un\ndeux\ttrois\r\nquatre\rcinq" e="&#10;&#9;&#13;" vide=""   espaces = "ok" >t</a>`);
  assert.deepEqual(a.attrs, { v: 'il dit "oui"', w: "l'a", f: 'x>y', g: '1>0', n: 'un deux trois quatre cinq', e: '\n\t\r', vide: '', espaces: 'ok' });
  assert.deepEqual(a.enfants, ['t']);
  // la formule d'une cellule .ods, telle que LibreOffice l'écrit
  const formule = analyserXml('<table:table-cell table:formula="of:=IF([.A1]&lt;&gt;&quot;&quot;;&quot;a &amp; b&quot;;1)" office:value-type="float"/>');
  assert.equal(formule.attrs['table:formula'], 'of:=IF([.A1]<>"";"a & b";1)');
  // un nom d'attribut « __proto__ » est un attribut comme un autre
  const proto = analyserXml('<a __proto__="x" b="y"/>');
  assert.deepEqual(Object.keys(proto.attrs), ['__proto__', 'b']);
  assert.equal(Object.getPrototypeOf(proto.attrs), Object.prototype);
});

test('préfixes et outils : nomLocal, enfantsNommes, enfantNomme, texteDe', () => {
  assert.equal(nomLocal('x:c'), 'c');
  assert.equal(nomLocal('r:id'), 'id');
  assert.equal(nomLocal('c'), 'c');
  assert.equal(nomLocal(undefined), '');
  const donnees = analyserXml(`<x:sheetData xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
    <x:row r="1"><x:c r="A1"><x:v>1</x:v></x:c><x:c r="B1" t="inlineStr"><x:is><x:t>a</x:t><x:r><x:t xml:space="preserve"> b</x:t></x:r></x:is></x:c></x:row>
    <row r="2"/><!-- ligne --><autre/>
  </x:sheetData>`);
  assert.deepEqual(enfantsNommes(donnees, 'row').map((r) => r.attrs.r), ['1', '2']);
  assert.deepEqual(enfantsNommes(donnees).map((e) => e.nom), ['x:row', 'row', 'autre'], 'sans nom : tous les éléments enfants, sans les textes');
  const ligne = enfantNomme(donnees, 'row');
  assert.equal(enfantNomme(ligne, 'c').attrs.r, 'A1');
  assert.equal(enfantNomme(ligne, 'absent'), null);
  assert.deepEqual(enfantsNommes(enfantNomme(ligne, 'c'), 't'), [], 'enfants directs seulement');
  assert.equal(texteDe(enfantsNommes(ligne, 'c')[1]), 'a b');
  assert.equal(texteDe(ligne), '1a b');
  assert.equal(texteDe('déjà du texte'), 'déjà du texte');
  assert.equal(texteDe(null), '');
  assert.deepEqual(enfantsNommes(null, 'row'), []);
  assert.equal(enfantNomme(undefined, 'row'), null);
});

test('documents mal formés refusés, avec la ligne', () => {
  const cas = {
    '<a><b></a></b>': /<\/a> ferme <b>/,
    '<a>': /balise <a> non fermée/,
    '<a><b>': /balise <b> non fermée/,
    'texte<a/>': /texte hors de l’élément racine/,
    '<a/>reste': /texte hors de l’élément racine/,
    '<a/><b/>': /second élément racine <b>/,
    '<![CDATA[x]]><a/>': /CDATA hors de l’élément racine/,
    '<a x="1" x="2"/>': /attribut x en double/,
    '<a x=1/>': /valeur de l’attribut x sans guillemets/,
    '<a x="1/>': /valeur de l’attribut x non fermée|balise <a> non fermée/,
    '<a x/>': /« = » attendu après l’attribut x/,
    '<a x="1"y="2"/>': /caractère inattendu « y »/,
    '<a / >': /« \/ » inattendu/,
    '</a>': /balise fermante <\/a> sans ouverture/,
    '<a></ a>': /balise fermante sans nom/,
    '<a><!-- </a>': /commentaire non fermé/,
    '<a><![CDATA[ </a>': /CDATA non fermé/,
    '< a/>': /balise sans nom/,
    '': /aucun élément/,
    '  <!-- rien -->  ': /aucun élément/,
  };
  for (const [xml, motif] of Object.entries(cas)) assert.throws(() => analyserXml(xml), illisible(motif), xml);
  assert.throws(() => analyserXml('<a>\n\n<b>\n</c></a>'), illisible(/<\/c> ferme <b> \(ligne 4\)\.$/));
  assert.throws(() => analyserXml('<a>'.repeat(1001) + '</a>'.repeat(1001)), illisible(/trop profondément/));
  assert.equal(analyserXml('<a>'.repeat(1000) + '</a>'.repeat(1000)).nom, 'a');
});

test('écriture : déclaration, <x/> sans enfant, textes et attributs échappés', () => {
  assert.equal(serialiserXml(el('a')), '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<a/>');
  assert.equal(serialiserXml(el('a'), { declaration: false }), '<a/>');
  assert.equal(serialiserXml(el('x:t', { 'xml:space': 'preserve' }, ['a & b < c > d ]]> e\r\nf\t"g\'']), { declaration: false }),
    '<x:t xml:space="preserve">a &amp; b &lt; c &gt; d ]]&gt; e&#13;\nf\t"g\'</x:t>');
  assert.equal(serialiserXml(el('a', { v: 'a&b<c"d\'e>f\ng\rh\ti' }), { declaration: false }), '<a v="a&amp;b&lt;c&quot;d\'e>f&#10;g&#13;h&#9;i"/>');
  // un attribut null ou undefined n'est pas écrit ; un nombre s'écrit en texte ; un texte vide ne compte pas comme enfant
  assert.equal(serialiserXml(el('c', { r: 'A1', s: null, t: undefined, n: 3 }, [el('v', {}, [42])]), { declaration: false }), '<c r="A1" n="3"><v>42</v></c>');
  assert.equal(serialiserXml(el('t', {}, ['']), { declaration: false }), '<t/>');
  assert.equal(serialiserXml({ nom: 'nu' }, { declaration: false }), '<nu/>');
});

test('écriture : caractères interdits en XML 1.0 retirés (paires de substitution gardées)', () => {
  const sale = 'a\u0000b\u0001\u0008\u000B\u000C\u000E\u001Fc\tok\n￾￿d \uD800x y\uDC00 😀 􏿿';
  const propre = 'abc\tok\nd x y 😀 􏿿';
  assert.equal(serialiserXml(el('t', {}, [sale]), { declaration: false }), `<t>${propre}</t>`);
  assert.equal(allerRetour(el('t', { v: sale }, [sale])).attrs.v, propre);
  assert.deepEqual(allerRetour(el('t', { v: sale }, [sale])).enfants, [propre]);
  // ce que les tableurs mettent dans une cellule (_x0001_ d'Excel) n'est pas touché : c'est du texte ordinaire
  assert.equal(serialiserXml(el('t', {}, ['_x0001_']), { declaration: false }), '<t>_x0001_</t>');
});

test('écriture : nom d’élément ou d’attribut invalide refusé', () => {
  for (const arbre of [el(''), el('a b'), el('a>'), el('<a'), { nom: 3 }, null, 'texte', el('a', {}, [el('b"')]), el('a', { 'x"': '1' }), el('a', { 'x y': '1' }), el('a', {}, [true])]) {
    assert.throws(() => serialiserXml(arbre), /^Error: XML impossible à écrire : /, JSON.stringify(arbre));
  }
});

test('aller-retour : un arbre relu après écriture est identique (caractères spéciaux, préfixes, contenu mêlé)', () => {
  const arbre = el('x:racine', { 'xmlns:x': 'urn:x', a: '<&>"\'', b: ' \n\t\r ', c: '' }, [
    'début & <suite> ]]>\r\n',
    el('x:vide'),
    el('t', { 'xml:space': 'preserve' }, ['  espaces  ', el('b', {}, ['gras']), '\ttab']),
    'fin « » — 😀',
  ]);
  assert.deepEqual(allerRetour(arbre), arbre);
  const relu = analyserXml(`<a v='simple "x"' w="x>y">t<![CDATA[<c>]]>&#13;</a>`);
  assert.deepEqual(allerRetour(relu), relu);
});

test('aller-retour du modèle : toutes ses parties XML, dont sheet1.xml et styles.xml, relues puis réécrites donnent un arbre identique', () => {
  const parties = readdirSync(MODELE, { recursive: true })
    .map((chemin) => String(chemin).replaceAll('\\', '/'))
    .filter((chemin) => /\.(xml|rels)$/.test(chemin) && statSync(join(MODELE, chemin)).isFile());
  assert.ok(parties.includes('xl/worksheets/sheet1.xml') && parties.includes('xl/styles.xml'));
  for (const partie of parties) {
    const arbre = analyserXml(lireModele(partie));
    const ecrit = serialiserXml(arbre);
    assert.ok(ecrit.startsWith('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<'), partie);
    assert.deepEqual(analyserXml(ecrit), arbre, partie);
    assert.equal(serialiserXml(analyserXml(ecrit)), ecrit, `${partie} : une seconde écriture ne change plus rien`);
  }

  const feuille = analyserXml(lireModele('xl/worksheets/sheet1.xml'));
  assert.equal(feuille.nom, 'worksheet');
  const fusions = enfantNomme(feuille, 'mergeCells');
  assert.equal(enfantsNommes(fusions, 'mergeCell').length, 544);
  assert.equal(fusions.attrs.count, '544');
  assert.equal(enfantNomme(feuille, 'dimension').attrs.ref, 'A1:BZ75');
  assert.equal(enfantNomme(feuille, 'drawing').attrs['r:id'], 'rId1');

  const styles = analyserXml(lireModele('xl/styles.xml'));
  for (const liste of ['fonts', 'fills', 'borders', 'cellXfs']) {
    const e = enfantNomme(styles, liste);
    assert.equal(Number(e.attrs.count), enfantsNommes(e).length, liste);
  }

  const chaines = analyserXml(lireModele('xl/sharedStrings.xml'));
  assert.deepEqual(enfantsNommes(chaines, 'si').slice(0, 3).map(texteDe), ['NOM', 'Surnom', 'Maîtrise d\'armes']);
  const dessin = analyserXml(lireModele('xl/drawings/drawing1.xml'));
  const ancre = enfantNomme(dessin, 'twoCellAnchor');
  assert.equal(enfantNomme(enfantNomme(enfantNomme(ancre, 'pic'), 'nvPicPr'), 'cNvPr').attrs.name, 'Images 2');
});
