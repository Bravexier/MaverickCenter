// Le glossaire des mots-clés dans les textes (migration 0056 ; demande du propriétaire du 2026-10-16 : « Partout où un mot-clé est utilisé, il sera affiché
// en gras. Une infobulle de sa définition sera visible », marquage explicite, « une seconde balise pour le mode complet, à savoir nom et définition séparés
// d'un ':' ») : la syntaxe (lib/mots-cles-balises.mjs), le texte sans balises, la forme canonique, le HTML (exclusions, attributs, une bulle par mot-clé),
// le middleware du site (src/middleware.mjs, avec un faux `next()`), la recherche (mots-clés cités), le contrôle db:check (aucune balise orpheline) ;
// puis le service (serveur/edition.mjs, sur une copie de la base) : forme canonique enregistrée, ref inconnue refusée, définition modifiée (même d'un
// mot-clé protégé), suppression qui retire les balises d'un effet d'arme en gardant sa recharge, fusion qui les recible, pages créées sans mot-clé libre.
//   node --test test/mots-cles-balises.test.mjs
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { traiter } from '../serveur/api.mjs';
import { ouvrirBaseVivante, preparerBaseVivante } from '../serveur/base-vivante.mjs';
import { reponseAvecMotsCles } from '../src/middleware.mjs';
import { analyserEffetDArme } from '../src/lib/arme-champs.mjs';
import { decouperInventaire } from '../src/lib/classe-champs.mjs';
import { RENDUS } from '../src/lib/edition-rendu.mjs';
import { htmlAvecMonnaies, morceauxDeMonnaie } from '../src/lib/monnaies.mjs';
import { avecLesValeurs, emplacements } from '../src/lib/monstre-champs.mjs';
import { cheminBase } from '../src/lib/donnees.mjs';
import {
  ambiguiteDe, avecLeursBalises, formeCanonique, formesNonCanoniques, htmlAvecMotsCles, htmlDeLaBalise, lireBalises, lireUneBalise, motCleDeLaRef,
  motsClesCites, pageAvecMotsCles, reciblerLeMotCle, retirerLeMotCle, texteSansBalises, vocabulaireDesMotsCles, zonesDeCode,
} from '../src/lib/mots-cles-balises.mjs';
import { chargerVocabulaire } from '../src/lib/mots-cles-db.mjs';
import { comptesDesMotsCles, elementsDuMotCle } from '../src/lib/recherche-mots-cles.mjs';
import { normalize } from '../src/lib/text.mjs';

const VOCABULAIRE = [
  { id: 'recharge-longue', libelle: 'Recharge longue', description: 'Doit utiliser son action ou son mouvement pour recharger.' },
  { id: 'non-mort', libelle: 'Non-mort', description: 'Une créature revenue de la mort.' },
  { id: 'mordhau', libelle: 'Mordhau', description: null },
  { id: 'glossaire', libelle: 'Glossaire', description: 'Voir {{non-mort:}} et {{recharge-longue}}.' },
];
const V = vocabulaireDesMotsCles(VOCABULAIRE);

// --- Syntaxe ------------------------------------------------------------------------------------------------------------------------------------

test('syntaxe : {{ref}}, {{ref|texte}} (« \\| » dans une case de tableau), {{ref:}} ; une écriture sans ref n’est pas une balise', () => {
  const b = lireBalises('A {{recharge-longue}} B {{non-mort|non-morts}} C {{mordhau:}} D {{x\\|y}} {{ }} {{:}} {couleur:vert} {3}');
  assert.deepEqual(b.map(({ ref, texte, complet, separateur }) => ({ ref, texte, complet, separateur })), [
    { ref: 'recharge-longue', texte: null, complet: false, separateur: null },
    { ref: 'non-mort', texte: 'non-morts', complet: false, separateur: '|' },
    { ref: 'mordhau', texte: null, complet: true, separateur: null },
    { ref: 'x', texte: 'y', complet: false, separateur: '\\|' },
  ]);
  assert.deepEqual(lireBalises('{N} des capacités, {couleur:x} des cases, {{ }}'), [], 'ni les valeurs des capacités communes, ni les couleurs de case');
  assert.equal(lireUneBalise('{{mordhau:}}').complet, true);
  assert.equal(lireUneBalise('texte {{mordhau}}'), null, 'une balise écrite seule');
  // une ref : l'id, ou l'écriture du libellé (normalize)
  assert.equal(motCleDeLaRef(V, 'recharge-longue').id, 'recharge-longue');
  assert.equal(motCleDeLaRef(V, 'Recharge  LONGUE').id, 'recharge-longue');
  assert.equal(motCleDeLaRef(V, 'inconnu'), null);
});

test('texte sans balises : sans vocabulaire, le texte écrit (sinon la ref) ; avec, le libellé, « Libellé : définition » en mode complet', () => {
  const t = 'Arc, {{recharge-longue|Recharge longue}}, {{non-mort}}, {{mordhau:}}, {{non-mort:}}, {{perdu|ancien}} et {{perdu-sans-texte}}.';
  assert.equal(texteSansBalises(t), 'Arc, Recharge longue, non-mort, mordhau, non-mort, ancien et perdu-sans-texte.');
  assert.equal(texteSansBalises(t, V), 'Arc, Recharge longue, Non-mort, Mordhau, Non-mort : Une créature revenue de la mort., ancien et perdu-sans-texte.');
  // une définition qui cite un mot-clé en mode complet n'en donne que le libellé (pas de boucle)
  assert.equal(texteSansBalises('{{glossaire:}}', V), 'Glossaire : Voir Non-mort et Recharge longue.');
  assert.equal(texteSansBalises('sans balise', V), 'sans balise');
  assert.equal(texteSansBalises(null), null);
});

test('forme canonique d’un texte de case (D2) : « {{id|texte}} » toujours (le texte écrit, sinon le libellé du moment), « | » pour séparateur ; le mode complet relevé ; refs inconnues rendues', () => {
  assert.deepEqual(formeCanonique('{{Recharge longue}}, {{non-mort|non-morts}}, {{Mordhau:}}, {{Absent}}', V), {
    texte: '{{recharge-longue|Recharge longue}}, {{non-mort|non-morts}}, {{mordhau:}}, {{Absent}}', inconnues: ['Absent'], ambigues: [], complets: ['Mordhau'],
  });
  assert.equal(formeCanonique('{{x\\|y}}', vocabulaireDesMotsCles([{ id: 'x', libelle: 'X' }])).texte, '{{x|y}}', 'un « \\| » devient « | » (une case n’est pas du Markdown)');
  const canonique = formeCanonique('a {{non-mort}}', V).texte;
  assert.equal(canonique, 'a {{non-mort|Non-mort}}');
  assert.equal(formeCanonique(canonique, V).texte, canonique, 'stable');
  assert.equal(texteSansBalises(canonique), 'a Non-mort', 'se lit sans le vocabulaire');
  assert.equal(formeCanonique('{{Mordhau :}}', V).complets[0], 'Mordhau', '« {{ref :}} » (une espace avant les deux-points) : le mode complet aussi');
  assert.deepEqual(motsClesCites('{{non-mort}} {{Non mort|x}} {{recharge-longue:}} {{absent}}', V), ['non-mort', 'recharge-longue']);
});

test('forme canonique d’un texte mis en forme (D2) : « {{id}} » (sans texte, ou le libellé pour texte), « {{id|texte}} » pour un autre, « {{id:}} » ; « \\| » sur une ligne de tableau ; un code reste tel quel', () => {
  const md = (t) => formeCanonique(t, V, { markdown: true });
  assert.deepEqual(md('{{Recharge longue}}, {{recharge-longue|Recharge longue}}, {{non-mort|non-morts}}, {{Mordhau :}}, {{Absent}}'), {
    texte: '{{recharge-longue}}, {{recharge-longue}}, {{non-mort|non-morts}}, {{mordhau:}}, {{Absent}}', inconnues: ['Absent'], ambigues: [], complets: [],
  });
  // une ligne de tableau : le séparateur « | » couperait la case, il devient « \\| » ; hors tableau, « | »
  assert.equal(md('| Arme | {{recharge-longue|à recharger}} |\n| --- | --- |\nPuis {{non-mort\\|morts}}.').texte,
    '| Arme | {{recharge-longue\\|à recharger}} |\n| --- | --- |\nPuis {{non-mort|morts}}.');
  assert.equal(md('| a | {{recharge-longue\\|Recharge longue}} |').texte, '| a | {{recharge-longue}} |', 'le libellé (échappements retirés) : l’id seul');
  // une balise dans un code est une écriture littérale : ni mise en forme, ni refusée
  assert.deepEqual(md('Écrire `{{Absent}}` ou\n```\n{{Recharge longue}}\n```\npuis {{Recharge longue}}.'), {
    texte: 'Écrire `{{Absent}}` ou\n```\n{{Recharge longue}}\n```\npuis {{recharge-longue}}.', inconnues: [], ambigues: [], complets: [],
  });
  assert.deepEqual(motsClesCites('`{{non-mort}}` {{mordhau}}', V, { markdown: true }), ['mordhau'], 'cité hors des codes seulement');
  assert.equal(texteSansBalises('`{{non-mort}}` {{mordhau}}', V, { markdown: true }), '`{{non-mort}}` Mordhau');
  const stable = md('Voir {{non-mort|morts}} et {{mordhau:}}').texte;
  assert.equal(md(stable).texte, stable, 'stable');
});

test('forme canonique (relecture SQL) : formesNonCanoniques suit la règle de formeCanonique — ce qu’elle écrit passe, une balise écrite autrement est relevée, sauf le libellé écrit dans un texte mis en forme', () => {
  const textes = [
    'A {{Recharge longue}} B {{non-mort|non-morts}} C {{mordhau :}} D {{ non-mort }} E {{non-mort| les morts }} F {{non-mort|Non-mort}}',
    '| a | {{recharge-longue|à recharger}} |\n| --- | --- |\n| {{Mordhau}} | {{non-mort\\|Non-mort}} |',
    'Voir {{non-mort\\|x}} hors d’un tableau, `{{ Mordhau }}` (un code d’un texte mis en forme : tel quel).',
  ];
  for (const markdown of [false, true]) {
    for (const t of textes) {
      const { texte } = formeCanonique(t, V, { markdown });
      const fautes = formesNonCanoniques(texte, V, { markdown }).filter((f) => !/mode complet/.test(f.raison));
      assert.deepEqual(fautes, [], `${markdown ? 'texte mis en forme' : 'texte de case'} : ${texte}`);
    }
  }
  const relevees = (t, markdown) => formesNonCanoniques(t, V, { markdown }).map((f) => [f.balise, f.raison]);
  assert.deepEqual(relevees('{{ non-mort }} {{mordhau :}} {{non-mort| les morts }} {{non-mort\\|x}} {{non-mort|Non-mort}}', true), [
    ['{{ non-mort }}', 'sa forme canonique est « {{non-mort}} »'],
    ['{{mordhau :}}', 'sa forme canonique est « {{mordhau:}} »'],
    ['{{non-mort| les morts }}', 'sa forme canonique est « {{non-mort|les morts}} »'],
    ['{{non-mort\\|x}}', 'sa forme canonique est « {{non-mort|x}} »'],
  ], 'texte mis en forme : le libellé écrit en texte (dernière balise) est la seule tolérance');
  assert.deepEqual(relevees('| a | {{non-mort|Non-mort}} | {{non-mort\\|Non-mort}} |', true), [['{{non-mort|Non-mort}}', 'sur une ligne de tableau, son séparateur s’écrit « \\| »']]);
  assert.deepEqual(relevees('{{non-mort|x}} {{non-mort\\|x}} {{ non-mort|x}} {{non-mort}} {{mordhau:}}', false), [
    ['{{non-mort\\|x}}', 'sa forme canonique est « {{non-mort|x}} »'],
    ['{{ non-mort|x}}', 'sa forme canonique est « {{non-mort|x}} »'],
    ['{{non-mort}}', 'un texte de case porte le texte de sa balise (« {{id|texte}} »)'],
    ['{{mordhau:}}', 'le mode complet ne s’écrit que dans un texte mis en forme'],
  ]);
});

test('ref ambiguë : l’id d’un mot-clé et l’écriture d’un autre — relevée, lue par l’id ; les zones de code d’un Markdown', () => {
  // « X » renommé « Y » (id « x » gardé), puis un mot-clé « X » créé (id « x-2 ») : « {{x}} » est l’id de l’un et l’écriture de l’autre
  const v = vocabulaireDesMotsCles([{ id: 'x', libelle: 'Y' }, { id: 'x-2', libelle: 'X' }]);
  assert.deepEqual(ambiguiteDe(v, 'x'), { parId: v.parId.get('x'), parEcriture: v.parId.get('x-2') });
  assert.equal(ambiguiteDe(v, 'X-2'), null);
  assert.equal(ambiguiteDe(v, 'y'), null);
  assert.deepEqual(formeCanonique('{{x}} {{x-2}}', v), { texte: '{{x|Y}} {{x-2|X}}', inconnues: [], ambigues: ['x'], complets: [] });
  assert.deepEqual(zonesDeCode('a `b` ``c`d`` \\`e` f\n\n`g\n\nh` ~~~\n~~~x\n{{y}}\n~~~\n'), [[2, 5], [6, 13], [33, 47]],
    'code en ligne (un accent grave échappé n’ouvre rien, une ligne vide ferme le paragraphe), bloc ~~~ (une ligne qui commence par lui)');
});

test('retirer un mot-clé (son texte simple, « Libellé : définition » pour le mode complet) et recibler ses balises (fusion), le texte écrit gardé', () => {
  const t = '{{non-mort|morts-vivants}}, {{non-mort}}, {{non-mort:}} et {{recharge-longue}}';
  assert.equal(retirerLeMotCle(t, V, 'non-mort'), 'morts-vivants, Non-mort, Non-mort : Une créature revenue de la mort. et {{recharge-longue}}');
  assert.equal(retirerLeMotCle('| {{non-mort|a*b}} |', V, 'non-mort', { markdown: true }), '| a\\*b |', 'échappé pour du Markdown');
  assert.equal(retirerLeMotCle('`{{non-mort}}` {{non-mort}}', V, 'non-mort', { markdown: true }), '`{{non-mort}}` Non-mort', 'un code garde son écriture');
  // un texte de case garde le texte qu'il montrait (le libellé de la source pour une balise sans texte) ; un texte mis en forme suivra la cible
  assert.equal(reciblerLeMotCle(t, V, 'non-mort', 'mordhau'), '{{mordhau|morts-vivants}}, {{mordhau|Non-mort}}, {{mordhau:}} et {{recharge-longue}}');
  assert.equal(reciblerLeMotCle(t, V, 'non-mort', 'mordhau', { markdown: true }), '{{mordhau|morts-vivants}}, {{mordhau}}, {{mordhau:}} et {{recharge-longue}}');
});

// --- HTML ---------------------------------------------------------------------------------------------------------------------------------------

test('HTML : un mot-clé décrit en gras avec sa bulle (focus clavier, pas dans un lien) ; sans définition, gras seul ; mode complet ; inconnu en texte simple', () => {
  const { html, employes } = htmlAvecMotsCles('<p>Avec {{recharge-longue}}, <a href="/x/">{{non-mort|les non-morts}}</a>, {{mordhau}}, {{non-mort:}} et {{perdu|ancien}}.</p>', V);
  assert.equal(html, '<p>Avec <strong class="mot-cle" data-mot-cle="recharge-longue" data-bulle="mot-cle-recharge-longue" aria-describedby="mot-cle-recharge-longue" tabindex="0" data-balise="{{recharge-longue}}">Recharge longue</strong>, '
    + '<a href="/x/"><strong class="mot-cle" data-mot-cle="non-mort" data-bulle="mot-cle-non-mort" aria-describedby="mot-cle-non-mort" data-balise="{{non-mort|les non-morts}}">les non-morts</strong></a>, '
    + '<strong class="mot-cle" data-mot-cle="mordhau" data-balise="{{mordhau}}">Mordhau</strong>, '
    + '<span class="mot-cle-definition" data-mot-cle="non-mort" data-balise="{{non-mort:}}"><strong class="mot-cle-definition__nom">Non-mort</strong> : <span class="mot-cle-definition__texte">Une créature revenue de la mort.</span></span> '
    + 'et ancien.</p>');
  assert.deepEqual(employes, ['recharge-longue', 'non-mort'], 'les mots-clés décrits, dans l’ordre');
  // le texte d'une balise, échappé (HTML) et relu tel qu'écrit
  assert.match(htmlAvecMotsCles('<p>{{non-mort|l&#39;&quot;un&quot; &amp; l&lt;autre}}</p>', V).html, /data-balise="\{\{non-mort\|l&#39;&quot;un&quot; &amp; l&lt;autre\}\}">l&#39;&quot;un&quot; &amp; l&lt;autre<\/strong>/);
});

test('HTML : ni dans script, style, textarea, template, code, pre, svg, ni sous [data-mots-cles-bruts] ; <title> et attributs de texte en texte simple, data-* JSON compris', () => {
  const page = '<html><head><title>{{Recharge longue}} — Site</title><meta name="description" content="Sur {{non-mort}}"><style>a{content:"{{x}}"}</style></head><body>'
    + '<script>const a = "{{recharge-longue}}";</script><textarea>{{recharge-longue}}</textarea><template><p>{{recharge-longue}}</p></template><code>{{recharge-longue}}</code>'
    + '<pre>{{recharge-longue}}</pre><svg><text>{{recharge-longue}}</text></svg><div data-mots-cles-bruts><p title="{{non-mort}}">{{recharge-longue}}</p></div>'
    + '<img alt="{{non-mort|Un mort}}" src="x.png"><span title="{{mordhau:}}" data-infobulle="{{non-mort}}" aria-label="{{non-mort}}" data-ed=\'["page",{"id":"x"},"corps_md"]\' data-balise="{{non-mort}}" data-liste=\'["{{non-mort|nom \\"cité\\"}}",{"a":"{{mordhau}}"}]\'>t</span>'
    + '</body></html>';
  const sortie = pageAvecMotsCles(page, V);
  assert.match(sortie, /<title>Recharge longue — Site<\/title>/);
  assert.match(sortie, /content="Sur Non-mort"/);
  for (const brut of ['<style>a{content:"{{x}}"}</style>', '<script>const a = "{{recharge-longue}}";</script>', '<textarea>{{recharge-longue}}</textarea>',
    '<template><p>{{recharge-longue}}</p></template>', '<code>{{recharge-longue}}</code>', '<pre>{{recharge-longue}}</pre>', '<text>{{recharge-longue}}</text>',
    '<div data-mots-cles-bruts><p title="{{non-mort}}">{{recharge-longue}}</p></div>']) assert.ok(sortie.includes(brut), brut);
  assert.match(sortie, /alt="Un mort"/);
  assert.equal(htmlAvecMotsCles('<select><option value="a">{{non-mort|Mort &amp; vif}}</option></select>', V).html, '<select><option value="a">Mort &amp; vif</option></select>', 'un choix d’une liste : texte simple');
  assert.match(sortie, /title="Mordhau" data-infobulle="Non-mort" aria-label="Non-mort"/);
  assert.ok(sortie.includes('data-ed=\'["page",{"id":"x"},"corps_md"]\''), 'les champs du mode modification tels quels');
  assert.ok(sortie.includes('data-balise="{{non-mort}}"'), 'la balise d’un mot-clé rendu telle quelle');
  const liste = JSON.parse(/data-liste="([^"]*)"/.exec(sortie)[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&'));
  assert.deepEqual(liste, ['nom "cité"', { a: 'Mordhau' }], 'un attribut data-* en JSON reste du JSON valide');
  assert.ok(!sortie.includes('id="mot-cle-recharge-longue"'), 'aucune balise rendue dans le corps : aucune bulle');
});

test('une bulle par mot-clé employé et par page, avant </body> (hors de toute zone modifiable) ; les pastilles du glossaire (data-bulle) comptent ; sans balise, la page telle quelle', () => {
  const page = '<html><body><main><p>{{non-mort}} puis {{Non-mort|non-morts}} et {{recharge-longue}}</p><a class="badge" data-bulle="mot-cle-glossaire">Glossaire</a></main></body></html>';
  const sortie = pageAvecMotsCles(page, V);
  assert.equal((sortie.match(/id="mot-cle-non-mort"/g) ?? []).length, 1);
  assert.equal((sortie.match(/role="tooltip"/g) ?? []).length, 3, 'non-mort, recharge-longue, glossaire');
  assert.ok(sortie.endsWith('</span></body></html>'), 'les bulles juste avant </body>');
  assert.ok(sortie.indexOf('</main>') < sortie.indexOf('class="bulle"'));
  assert.ok(sortie.includes('<span class="bulle" role="tooltip" id="mot-cle-non-mort" hidden><strong class="bulle__titre">Non-mort</strong><span class="bulle__texte">Une créature revenue de la mort.</span></span>'));
  assert.ok(sortie.includes('<span class="bulle__texte">Voir Non-mort et Recharge longue.</span>'), 'une définition en texte simple');
  assert.equal(pageAvecMotsCles(sortie, V), sortie, 'une seconde passe ne change rien (bulle déjà posée)');
  const sans = '<html><body><p>Rien à voir {N} {couleur:vert}</p></body></html>';
  assert.equal(pageAvecMotsCles(sans, V), sans);
  assert.equal(htmlDeLaBalise(lireUneBalise('{{perdu:}}'), V).html, 'perdu', 'mode complet d’un mot-clé inconnu : sa ref');
});

test('HTML : dans une bulle, le gras seul ; dans un élément qui a le focus, sans tabindex ; dans un bouton ou un résumé, sans bulle ; un élément exclu garde ses attributs', () => {
  const rendu = (html) => htmlAvecMotsCles(html, V);
  const bulle = rendu('<span class="bulle bulle--carte" role="tooltip"><span class="bulle__texte">{{recharge-longue}}</span></span><span class="bulle-zone">{{non-mort}}</span>');
  assert.match(bulle.html, /<span class="bulle__texte"><strong class="mot-cle" data-mot-cle="recharge-longue" data-balise="\{\{recharge-longue\}\}">Recharge longue<\/strong>/,
    'dans une bulle : ni bulle ni tabindex');
  assert.match(bulle.html, /<span class="bulle-zone"><strong class="mot-cle" data-mot-cle="non-mort" data-bulle="mot-cle-non-mort"[^>]* tabindex="0"/, '« bulle-zone » n’est pas une bulle');
  assert.deepEqual(bulle.employes, ['non-mort'], 'la bulle d’un mot-clé cité dans une bulle n’est pas posée');
  for (const [html, raison] of [['<label>{{non-mort}}</label>', 'label'], ['<select><optgroup label="x"></optgroup></select><div tabindex="0">{{non-mort}}</div>', '[tabindex]'],
    ['<a href="/x/">{{non-mort}}</a>', 'lien']]) {
    const r = rendu(html).html;
    assert.match(r, /data-bulle="mot-cle-non-mort"/, `${raison} : la bulle`);
    assert.doesNotMatch(r, /tabindex="0" data-balise/, `${raison} : pas de second focus`);
  }
  for (const html of ['<button type="button" class="objet">{{non-mort}}</button>', '<details><summary>{{non-mort}}</summary></details>']) {
    const r = rendu(html);
    assert.match(r.html, /<strong class="mot-cle" data-mot-cle="non-mort" data-balise="\{\{non-mort\}\}">Non-mort<\/strong>/, `${html} : le gras seul`);
    assert.deepEqual(r.employes, []);
  }
  // la liste EXCLUS s'applique aux attributs : ceux de l'élément exclu et de ce qu'il contient restent tels qu'écrits
  const exclus = rendu('<code title="{{non-mort}}">{{non-mort}}</code><pre data-x="{{mordhau}}"><b title="{{mordhau}}">a</b></pre><textarea placeholder="{{non-mort}}"></textarea>'
    + '<p data-mots-cles-bruts title="{{mordhau}}">{{mordhau}}</p><p title="{{mordhau}}">ok</p>').html;
  for (const brut of ['<code title="{{non-mort}}">{{non-mort}}</code>', '<pre data-x="{{mordhau}}"><b title="{{mordhau}}">a</b></pre>', '<textarea placeholder="{{non-mort}}"></textarea>',
    '<p data-mots-cles-bruts title="{{mordhau}}">{{mordhau}}</p>']) assert.ok(exclus.includes(brut), brut);
  assert.ok(exclus.endsWith('<p title="Mordhau">ok</p>'));
});

test('HTML : une entité nommée inconnue d’un attribut, d’une option ou d’un texte qui a une balise n’est pas échappée deux fois', () => {
  const r = htmlAvecMotsCles('<p title="Caf&eacute; {{mordhau}} &amp; th&eacute;">a</p><select><option>{{mordhau}} &eacute;t&eacute;</option></select>'
    + '<p>&laquo; {{non-mort|caf&eacute;}} &raquo;</p><title>{{mordhau}} &rsquo;</title>', V).html;
  assert.ok(r.includes('<p title="Caf&eacute; Mordhau &amp; th&eacute;">'), r);
  assert.ok(r.includes('<option>Mordhau &eacute;t&eacute;</option>'), r);
  assert.match(r, /&laquo; <strong class="mot-cle"[^>]*data-balise="\{\{non-mort\|caf&eacute;\}\}">caf&eacute;<\/strong> &raquo;/);
  assert.ok(r.includes('<title>Mordhau &rsquo;</title>'), r);
  assert.ok(!r.includes('&amp;eacute;') && !r.includes('&amp;rsquo;'));
});

test('découpages affichés (D2, constat 4) : bonus et objets d’un métier, inventaire d’une classe, lieux d’une espèce — découpés sans balise, affichés avec', () => {
  const brut = 'Épée, {{mordhau|Mordhau}}, Arc';
  assert.deepEqual(avecLeursBalises(brut, ['Épée', 'Mordhau', 'Arc']), ['Épée', '{{mordhau|Mordhau}}', 'Arc']);
  assert.deepEqual(avecLeursBalises('A, {{x|un, deux}}', ['A', 'un', 'deux']), ['A', 'un', 'deux'], 'un morceau qui coupe une balise reste tel quel');
  for (const k of ['metier-equipement', 'inventaire', 'monstre-lieux', 'metier-bonus']) {
    const html = RENDUS[k](brut, {}, { objets: [], competences: [] });
    assert.ok(html.includes('{{mordhau|Mordhau}}'), `${k} : ${html}`);
    assert.ok(html.includes('Épée') && html.includes('Arc'), k);
    const rendu = htmlAvecMotsCles(`<div>${html}</div>`, V).html;
    assert.match(rendu, /<strong class="mot-cle" data-mot-cle="mordhau"[^>]*>Mordhau<\/strong>/, `${k} : en gras par le middleware`);
  }
  assert.deepEqual(decouperInventaire(brut, [{ id: 'mordhau-objet', nom_cle: 'mordhau' }]).map((o) => [o.texte, o.objet_depart_id]),
    [['Épée', null], ['Mordhau', 'mordhau-objet'], ['Arc', null]], 'le découpage lit le texte sans balise');
});

test('monnaies (constat 3) : une balise reste entière, aucun montant n’y est lu ; un emplacement « {N} » n’est jamais une balise « {{N}} » (constat 7)', () => {
  assert.equal(htmlAvecMonnaies('{{mordhau|10 RO}}'), '{{mordhau|10 RO}}');
  const html = htmlAvecMonnaies('Le {{mordhau|10 RO}} coûte 5 RO');
  assert.ok(html.startsWith('Le {{mordhau|10 RO}} coûte <span class="montant" data-montant="5 RO"'), html);
  assert.deepEqual(morceauxDeMonnaie('{{a}}12', { unite: 'RO' }), [{ texte: '{{a}}' }, { montant: { nombre: '12', abr: 'RO', ecrit: '12' } }]);
  assert.deepEqual(emplacements('Inflige {3} et {{12}}, puis {4}%.'), [3, 4]);
  assert.equal(avecLesValeurs('Inflige {3} et {{12}}, puis {4}.', { 2: 9 }), 'Inflige 3 et {{12}}, puis 9.');
});

// --- Middleware ---------------------------------------------------------------------------------------------------------------------------------

test('middleware : une réponse HTML rendue avec le vocabulaire (statut, en-têtes gardés, longueur retirée) ; JSON et autres passent sans être lus', async () => {
  let lectures = 0;
  const vocabulaire = () => {
    lectures += 1;
    return VOCABULAIRE;
  };
  const page = (corps, type = 'text/html') => async () => new Response(corps, { status: 404, headers: { 'content-type': type, 'content-length': '12', 'x-essai': 'oui' } });
  const r = await reponseAvecMotsCles(page('<html><body><p>{{non-mort}}</p></body></html>', 'text/html; charset=utf-8'), vocabulaire);
  assert.equal(r.status, 404);
  assert.equal(r.headers.get('x-essai'), 'oui');
  assert.equal(r.headers.get('content-length'), null);
  const html = await r.text();
  assert.match(html, /<strong class="mot-cle" data-mot-cle="non-mort"[^>]*>Non-mort<\/strong>/);
  assert.match(html, /id="mot-cle-non-mort"/);
  assert.equal(lectures, 1);
  const sans = await reponseAvecMotsCles(page('<p>rien</p>'), vocabulaire);
  assert.equal(await sans.text(), '<p>rien</p>');
  assert.equal(lectures, 1, 'sans balise : le vocabulaire n’est pas lu');
  const json = new Response('{"a":"{{non-mort}}"}', { headers: { 'content-type': 'application/json' } });
  assert.equal(await reponseAvecMotsCles(async () => json, vocabulaire), json, 'un JSON : la même réponse, non lue');
  assert.equal(json.bodyUsed, false);
});

test('middleware : le vocabulaire de la base construite (lu une fois), sur une vraie réponse', async () => {
  const r = await reponseAvecMotsCles(async () => new Response('<html><body>{{mordhau}}</body></html>', { headers: { 'content-type': 'text/html' } }));
  const db = new DatabaseSync(cheminBase(), { readOnly: true });
  const mordhau = db.prepare("SELECT libelle, description FROM mot_cle WHERE id = 'mordhau'").get();
  db.close();
  const html = await r.text();
  if (mordhau) assert.match(html, new RegExp(`data-mot-cle="mordhau"[^>]*>${mordhau.libelle}</strong>`));
  else assert.match(html, /<body>mordhau<\/body>/, 'mot-clé absent de la base : texte simple');
});

// --- Recherche ----------------------------------------------------------------------------------------------------------------------------------

test('recherche : une page cite un mot-clé du glossaire par ses balises (lib/recherche-index.ts) : il compte, et sa vue la liste', () => {
  const corps = 'Arbalète : {{recharge-longue|Recharge longue}}. Voir {{non-mort:}}.';
  const index = [
    { title: 'Armes', motsCles: [...new Set(['metier', ...motsClesCites(corps, V)])], text: texteSansBalises(corps, V) },
    { title: 'Autre', motsCles: [] },
  ];
  assert.deepEqual(index[0].motsCles, ['metier', 'recharge-longue', 'non-mort']);
  assert.equal(index[0].text, 'Arbalète : Recharge longue. Voir Non-mort : Une créature revenue de la mort..');
  assert.deepEqual([...comptesDesMotsCles(index)], [['metier', 1], ['recharge-longue', 1], ['non-mort', 1]]);
  assert.deepEqual(elementsDuMotCle(index, 'non-mort').map((e) => e.title), ['Armes']);
});

// --- Découpages ---------------------------------------------------------------------------------------------------------------------------------

test('découpage d’un effet d’arme : une balise ne change rien (« Recharge longue » donne la recharge longue), elle reste écrite dans les effets supplémentaires', () => {
  const nu = analyserEffetDArme('Dégâts de Taille, Recharge longue, Portée 2-8');
  const balise = analyserEffetDArme('Dégâts de Taille, {{recharge-longue|Recharge longue}}, Portée 2-8, {{non-mort|un, deux}}');
  assert.equal(balise.recharge, 'longue');
  assert.deepEqual({ ...balise, autres: null }, { ...nu, autres: null });
  assert.equal(balise.autres, '{{recharge-longue|Recharge longue}}, {{non-mort|un, deux}}', 'la virgule d’une balise ne coupe pas la clause');
  assert.equal(analyserEffetDArme('{{recharge-tres-longue|Recharge très longue}}').recharge, 'tres_longue');
});

// --- db:check -----------------------------------------------------------------------------------------------------------------------------------

const RACINE = fileURLToPath(new URL('../../', import.meta.url));
const dossier = mkdtempSync(join(tmpdir(), 'maverick-mots-cles-balises-'));
after(() => rmSync(dossier, { recursive: true, force: true }));

test('db:check (D1, D2) : toute balise de toutes les colonnes de texte vise un mot-clé par son id, sous la forme canonique de sa colonne ; un code est ignoré', () => {
  const copie = join(dossier, 'check.db');
  cpSync(cheminBase(), copie);
  const d = new DatabaseSync(copie);
  const page = d.prepare("SELECT id FROM page WHERE type = 'guide' ORDER BY id LIMIT 1").get().id;
  const cite = d.prepare('SELECT id, libelle FROM mot_cle ORDER BY id LIMIT 1').get();
  const arme = d.prepare("SELECT id FROM arme WHERE effet IS NOT NULL AND effet NOT LIKE '%{{%' ORDER BY id LIMIT 1").get().id;
  // un texte mis en forme (le corps d'une page) : l'id seul, un autre texte, le mode complet, « \\| » dans une case ; un code : une écriture littérale
  d.prepare('UPDATE page SET corps_md = corps_md || ? WHERE id = ?')
    .run(`\n{{${cite.id}}}, {{${cite.id}|un texte}} et {{${cite.id}:}} ; \`{{Écriture libre}}\`\n\n| a | {{${cite.id}\\|b}} |\n| --- | --- |\n`, page);
  // des textes de case : une colonne de TABLES (l'effet d'une arme) et une autre (le résumé d'une page), le texte toujours écrit
  d.prepare('UPDATE arme SET effet = effet || ? WHERE id = ?').run(`, {{${cite.id}|Texte}}`, arme);
  d.prepare("UPDATE page SET resume = coalesce(resume, '') || ? WHERE id = ?").run(` {{${cite.id}|résumé}}`, page);
  d.close();
  const check = () => spawnSync(process.execPath, ['--no-warnings', join(RACINE, 'client', 'scripts', 'db-check.mjs'), copie], { encoding: 'utf8' });
  const ok = check();
  assert.equal(ok.status, 0, ok.stdout);
  assert.ok(JSON.parse(ok.stdout).bilan.balises_mots_cles >= 6, 'les balises hors code, de toutes les colonnes');
  const d2 = new DatabaseSync(copie);
  d2.prepare('UPDATE page SET corps_md = corps_md || ? WHERE id = ?').run(`\n{{${cite.libelle}|écrit}} {{balise-orpheline-d-essai|texte}}\n\n| x | {{${cite.id}|y}} |\n`, page);
  d2.prepare('UPDATE arme SET effet = effet || ? WHERE id = ?').run(`, {{${cite.id}}} et {{${cite.id}:}}`, arme);
  d2.close();
  const ko = check();
  assert.equal(ko.status, 1);
  const problemes = JSON.parse(ko.stdout).problemes.filter((p) => /balise/.test(p));
  const echapper = (t) => t.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&');
  const attendu = (table, cle, balise, raison) => assert.ok(problemes.some((p) => p.startsWith(`${table} ${cle} : la balise « ${balise} »`) && new RegExp(raison).test(p)),
    `${table} ${balise} : ${problemes.join(' / ')}`);
  if (cite.libelle !== cite.id) attendu('page.corps_md', page, `{{${cite.libelle}|écrit}}`, 'une écriture, pas l’id');
  attendu('page.corps_md', page, '{{balise-orpheline-d-essai|texte}}', 'ne vise aucun mot-clé');
  attendu('page.corps_md', page, `{{${cite.id}|y}}`, echapper('« \\| »'));
  attendu('arme.effet', arme, `{{${cite.id}}}`, 'porte le texte de sa balise');
  attendu('arme.effet', arme, `{{${cite.id}:}}`, 'mode complet');
  assert.equal(problemes.length, cite.libelle !== cite.id ? 5 : 4, problemes.join('\n'));
});

// --- Service ------------------------------------------------------------------------------------------------------------------------------------

let n = 0;
const vivante = () => ouvrirBaseVivante(preparerBaseVivante({ regles: cheminBase(), dossier: join(dossier, `b${(n += 1)}`) }).chemin);

/** Le service sur une copie neuve de la base : `lot(operations)` → { statut, corps } ; `ligne(sql)`. */
function service() {
  const db = vivante();
  const s = { base: () => db, etat: () => ({}), edition: true };
  const lot = (operations, page = 'recherche/') => traiter({ methode: 'POST', chemin: '/api/edition/', entetes: { 'content-type': 'application/json' }, corps: JSON.stringify({ page, operations }) }, s);
  const ok = (operations, page) => {
    const r = lot(operations, page);
    assert.equal(r.statut, 200, JSON.stringify(r.corps));
    return r.corps;
  };
  const libre = (base) => {
    let t = base;
    for (let i = 2; db.prepare('SELECT 1 FROM mot_cle WHERE libelle_cle = ? OR id = ?').get(normalize(t), normalize(t)); i += 1) t = `${base} ${i}`;
    return t;
  };
  const creerMotCle = (libelle, description = null) => ok([{ op: 'creer', entite: 'mot_cle', valeurs: { libelle, ...(description === null ? {} : { description }) } }]).crees[0].id;
  return { db, lot, ok, libre, creerMotCle, ligne: (sql, ...p) => db.prepare(sql).get(...p), appel: (methode, chemin) => traiter({ methode, chemin, entetes: {} }, s) };
}

/** Une arme du tableau dont l'effet n'écrit pas de recharge (lue dans l'état courant). */
const armeSansRecharge = (s) => s.ligne(`SELECT a.* FROM arme a JOIN arme_famille f ON f.id = a.famille_id WHERE f.maitrisable = 1 AND a.recharge IS NULL
  AND a.effet IS NOT NULL AND a.effet NOT LIKE '%{{%' ORDER BY a.id LIMIT 1`);

test('service : un texte enregistré sous sa forme canonique (journal compris), une ref inconnue refusée (400, citée), sauf déjà là ; la recharge suit la balise', () => {
  const s = service();
  const libelle = s.libre('Essai recharge');
  const id = s.creerMotCle(libelle, 'Définition d’essai.');
  const arme = armeSansRecharge(s);
  const effet = `${arme.effet}, {{${libelle}|Recharge longue}}`;
  s.ok([{ op: 'modifier', table: 'arme', cle: { id: arme.id }, valeurs: { effet }, avant: { effet: arme.effet } }], 'ressources/equipement/');
  const apres = s.ligne('SELECT effet, recharge FROM arme WHERE id = ?', arme.id);
  assert.equal(apres.effet, `${arme.effet}, {{${id}|Recharge longue}}`, 'la forme canonique : l’id');
  assert.equal(apres.recharge, 'longue', 'le découpage lit le texte sans balise');
  const note = s.ligne("SELECT apres FROM modification WHERE table_nom = 'arme' AND json_extract(cle, '$.id') = ? ORDER BY lot_id DESC, rang DESC LIMIT 1", arme.id);
  assert.equal(JSON.parse(note.apres).effet, apres.effet, 'le journal note la forme canonique');
  // une ref inconnue : refusée, avec la ref
  const inconnue = s.lot([{ op: 'modifier', table: 'arme', cle: { id: arme.id }, valeurs: { effet: `${apres.effet} {{aucun-mot-cle-de-ce-nom}}` } }], 'ressources/equipement/');
  assert.equal(inconnue.statut, 400);
  assert.match(inconnue.corps.erreur, /« \{\{aucun-mot-cle-de-ce-nom\}\} » ne cite aucun mot-clé/);
  // déjà dans le texte (d'avant la suppression de son mot-clé) : le texte se modifie quand même
  s.db.prepare('UPDATE mot_cle SET description = ? WHERE id = ?').run('Ancien {{mot-cle-disparu-d-essai|texte}}.', id);
  s.ok([{ op: 'modifier', table: 'mot_cle', cle: { id }, valeurs: { description: 'Ancien {{mot-cle-disparu-d-essai|texte}}, modifié.' } }]);
  assert.equal(s.lot([{ op: 'modifier', table: 'mot_cle', cle: { id }, valeurs: { description: '{{mot-cle-disparu-d-essai}} et {{autre-disparu}}' } }]).statut, 400,
    'une ref inconnue ajoutée reste refusée');
  // une création : la description d'un événement (un texte mis en forme) : l'id seul quand le texte est le libellé, un autre texte gardé
  const titre = `Essai glossaire ${process.pid}`;
  const description = `Le {{${libelle}}} du jour, {{${id}|${libelle}}}, {{${id}|un autre}} et {{${libelle}:}} ; \`{{absent-d-essai}}\` en code.`;
  const evenement = s.ok([{ op: 'creer', entite: 'evenement', valeurs: { epoque: 'inconnue', titre, description } }], 'chronologie/').crees[0].id;
  assert.equal(s.ligne('SELECT texte FROM evenement_extrait WHERE evenement_id = ?', evenement).texte,
    `Le {{${id}}} du jour, {{${id}}}, {{${id}|un autre}} et {{${id}:}} ; \`{{absent-d-essai}}\` en code.`, 'le code reste tel quel, sans refus');
  assert.equal(s.lot([{ op: 'creer', entite: 'evenement', valeurs: { epoque: 'inconnue', titre: `${titre} bis`, description: '{{absent-d-essai}}' } }], 'chronologie/').statut, 400);
});

test('service (D2) : le mode complet refusé dans un texte de case (message clair), accepté dans un texte mis en forme ; une ref ambiguë refusée, sauf déjà là', () => {
  const s = service();
  const libelle = s.libre('Essai complet');
  const id = s.creerMotCle(libelle, 'Sa définition.');
  const arme = armeSansRecharge(s);
  const refus = s.lot([{ op: 'modifier', table: 'arme', cle: { id: arme.id }, valeurs: { effet: `${arme.effet}, {{${id}:}}` } }], 'ressources/equipement/');
  assert.equal(refus.statut, 400);
  assert.match(refus.corps.erreur, /le mode complet ne s’écrit que dans un texte mis en forme \(guide, Codex, chronologie, panneaux de règles\)/);
  assert.equal(s.lot([{ op: 'creer', entite: 'mot_cle', valeurs: { libelle: s.libre('Essai complet bis'), description: `Voir {{${id}:}}.` } }]).statut, 400, 'une définition est un texte de case');
  const ok = s.ok([{ op: 'creer', entite: 'evenement', valeurs: { epoque: 'inconnue', titre: `Essai complet ${process.pid}`, description: `{{${id}:}}` } }], 'chronologie/');
  assert.equal(s.ligne('SELECT texte FROM evenement_extrait WHERE evenement_id = ?', ok.crees[0].id).texte, `{{${id}:}}`);
  // ambiguïté : le mot-clé renommé garde son id, un autre prend l'ancienne écriture (son id : « -2 »)
  const ancien = s.creerMotCle(s.libre('Essai ambigu'), 'L’ancien.');
  const effet = `${arme.effet}, {{${ancien}|cité avant}}`;
  s.ok([{ op: 'modifier', table: 'arme', cle: { id: arme.id }, valeurs: { effet } }], 'ressources/equipement/');
  s.ok([{ op: 'modifier', table: 'mot_cle', cle: { id: ancien }, valeurs: { libelle: s.libre('Essai renommé') } }]);
  const nouveau = s.creerMotCle(s.ligne('SELECT libelle FROM mot_cle WHERE id = ?', ancien) ? ancien.replace(/-/g, ' ') : ancien, 'Le nouveau.');
  assert.notEqual(nouveau, ancien);
  const douteux = s.lot([{ op: 'modifier', table: 'mot_cle', cle: { id }, valeurs: { description: `Voir {{${ancien}|lequel}}.` } }]);
  assert.equal(douteux.statut, 400);
  assert.match(douteux.corps.erreur, new RegExp(`« \\{\\{${ancien}\\}\\} » est l’identifiant du mot-clé .* et l’écriture du mot-clé .*\\{\\{${nouveau}\\}\\}.*précisez l’identifiant`));
  // déjà dans le texte avant l'ambiguïté : il se modifie encore (la balise reste lue par l'id)
  s.ok([{ op: 'modifier', table: 'arme', cle: { id: arme.id }, valeurs: { effet: `${effet} (modifié)` } }], 'ressources/equipement/');
  assert.equal(s.ligne('SELECT effet FROM arme WHERE id = ?', arme.id).effet, `${effet} (modifié)`);
  s.ok([{ op: 'modifier', table: 'mot_cle', cle: { id }, valeurs: { description: `Voir {{${nouveau}|celui-ci}}.` } }]);
});

test('service : la définition se modifie (même d’un mot-clé protégé, dont le libellé ne change pas) ; vidée : pas encore décrit ; GET /api/edition/mots-cles/ la rend', () => {
  const s = service();
  const magique = s.ligne("SELECT * FROM mot_cle WHERE libelle_cle = 'magique'");
  s.ok([{ op: 'modifier', table: 'mot_cle', cle: { id: magique.id }, valeurs: { description: 'Une classe magique.' }, avant: { description: magique.description } }]);
  assert.equal(s.ligne('SELECT description FROM mot_cle WHERE id = ?', magique.id).description, 'Une classe magique.');
  assert.equal(s.lot([{ op: 'modifier', table: 'mot_cle', cle: { id: magique.id }, valeurs: { libelle: 'Magie' } }]).statut, 409, 'le libellé d’un protégé ne change pas');
  s.ok([{ op: 'modifier', table: 'mot_cle', cle: { id: magique.id }, valeurs: { description: '' } }]);
  assert.equal(s.ligne('SELECT description FROM mot_cle WHERE id = ?', magique.id).description, null, 'NULL : pas encore décrit');
  const id = s.creerMotCle(s.libre('Essai décrit'), 'Ce qu’il veut dire.');
  const sans = s.creerMotCle(s.libre('Essai sans définition'));
  const v = s.appel('GET', '/api/edition/mots-cles/');
  assert.equal(v.statut, 200);
  assert.equal(v.corps.motsCles.find((m) => m.id === id).description, 'Ce qu’il veut dire.');
  assert.equal(v.corps.motsCles.find((m) => m.id === sans).description, null, 'un seul contrat : NULL tant qu’il n’est pas décrit');
  assert.equal(s.ligne('SELECT description FROM mot_cle WHERE id = ?', sans).description, null);
  const listes = s.appel('GET', '/api/edition/listes/');
  assert.equal(listes.corps.motsCles.find((m) => m.id === id).description, 'Ce qu’il veut dire.', 'la liste de l’éditeur (outils « Mot-clé », « Définition »)');
  assert.equal(listes.corps.motsCles.find((m) => m.id === sans).description, null);
  assert.equal(chargerVocabulaire(s.db).find((m) => m.id === sans).description, null, 'lib/mots-cles-db.mjs : NULL aussi');
});

test('service : supprimer un mot-clé retire ses balises de tous les textes (l’effet d’une arme garde sa recharge, une définition qui le citait aussi) ; fusionner les recible', () => {
  const s = service();
  const libelleA = s.libre('Essai suppression');
  const libelleB = s.libre('Essai fusion source');
  const a = s.creerMotCle(libelleA, 'A.');
  const b = s.creerMotCle(libelleB, 'B.');
  const c = s.creerMotCle(s.libre('Essai fusion cible'), 'C.');
  const temoin = s.creerMotCle(s.libre('Essai témoin'), `Voir {{${a}|le A}}, {{${b}|la source}} et {{${b}}}.`);
  // un texte mis en forme : le mode complet et une balise sans texte
  const evenement = s.ok([{ op: 'creer', entite: 'evenement', valeurs: { epoque: 'inconnue', titre: `Essai témoin ${process.pid}`, description: `Le {{${a}:}}, {{${a}}} et {{${b}}}.` } }], 'chronologie/').crees[0].id;
  const description = () => s.ligne('SELECT texte FROM evenement_extrait WHERE evenement_id = ?', evenement).texte;
  const arme = armeSansRecharge(s);
  s.ok([{ op: 'modifier', table: 'arme', cle: { id: arme.id }, valeurs: { effet: `${arme.effet}, {{${a}|Recharge longue}}` } }], 'ressources/equipement/');
  assert.equal(s.ligne('SELECT recharge FROM arme WHERE id = ?', arme.id).recharge, 'longue');
  const pageDesArmes = () => s.ligne("SELECT corps_md FROM page WHERE id = 'ressources/armes'").corps_md;
  assert.ok(pageDesArmes().includes(`{{${a}\\|Recharge longue}}`), 'le corps de la page des armes suit (case de tableau : « \\| »)');
  // suppression
  const r = s.ok([{ op: 'supprimer', entite: 'mot_cle', cle: { id: a } }]);
  assert.equal(s.ligne('SELECT 1 FROM mot_cle WHERE id = ?', a), undefined);
  const apres = s.ligne('SELECT effet, recharge FROM arme WHERE id = ?', arme.id);
  assert.equal(apres.effet, `${arme.effet}, Recharge longue`, 'la balise devient son texte');
  assert.equal(apres.recharge, 'longue', 'la recharge reste');
  assert.ok(!pageDesArmes().includes(`{{${a}`), 'ni dans le corps de la page des armes');
  assert.equal(s.ligne('SELECT description FROM mot_cle WHERE id = ?', temoin).description, `Voir le A, {{${b}|la source}} et {{${b}|${libelleB}}}.`,
    'une balise devient son texte, les autres restent (forme canonique d’un texte de case)');
  assert.equal(description(), `Le ${libelleA} : A., ${libelleA} et {{${b}}}.`, 'un texte mis en forme : le mode complet devient « Libellé : définition »');
  assert.ok(r.lignes.some((l) => l.table === 'arme' && l.cle.id === arme.id), 'chaque texte réécrit est une ligne du lot (journal)');
  // fusion : les balises de la source citent la cible, leur texte gardé
  s.ok([{ op: 'fusionner_mots_cles', mot_cle: b, dans: c }]);
  assert.equal(s.ligne('SELECT description FROM mot_cle WHERE id = ?', temoin).description, `Voir le A, {{${c}|la source}} et {{${c}|${libelleB}}}.`,
    'un texte de case garde le texte qu’il montrait');
  assert.equal(description(), `Le ${libelleA} : A., ${libelleA} et {{${c}}}.`, 'un texte mis en forme suit la cible');
  assert.equal(s.ligne('SELECT 1 FROM mot_cle WHERE id = ?', b), undefined);
  // plus aucune balise orpheline dans la base
  const orphelines = [];
  const vocabulaire = vocabulaireDesMotsCles(s.db.prepare('SELECT id, libelle FROM mot_cle').all());
  for (const t of ['arme', 'mot_cle', 'page', 'evenement_extrait']) {
    for (const l of s.db.prepare(`SELECT * FROM "${t}"`).all()) {
      for (const v of Object.values(l)) if (typeof v === 'string') for (const x of lireBalises(v)) if (!motCleDeLaRef(vocabulaire, x.ref)) orphelines.push(`${t} ${x.brut}`);
    }
  }
  assert.deepEqual(orphelines, []);
});

test('service : une page créée depuis le site ne porte que les mots-clés dont le site se sert ; aucun mot-clé libre n’est créé', () => {
  const s = service();
  const avant = s.db.prepare('SELECT id FROM mot_cle ORDER BY id').all().map((m) => m.id);
  let nom = 'Classe du glossaire';
  for (let i = 2; s.ligne('SELECT 1 FROM classe WHERE nom = ?', nom); i += 1) nom = `Classe du glossaire ${i}`;
  const classe = s.ok([{ op: 'creer', entite: 'classe', valeurs: { categorie_id: 'classe-magique', nom } }], 'classes/').crees[0].id;
  const don = s.ok([{ op: 'creer', entite: 'capacite', valeurs: { classe_id: classe, niveau: '1', nom: 'Don du glossaire', type: 'Passif' } }], classe).crees[0].id;
  const tags = (page) => s.db.prepare('SELECT m.libelle FROM page_tag t JOIN mot_cle m ON m.id = t.tag_id WHERE t.page_id = ? ORDER BY t.ordre').all(page).map((m) => m.libelle);
  assert.deepEqual(tags(don), ['capacité de classe']);
  assert.deepEqual(tags(classe).sort(), ['classe', 'magique']);
  assert.deepEqual(s.db.prepare('SELECT id FROM mot_cle ORDER BY id').all().map((m) => m.id), avant);
});
