// Le glossaire des mots-clés dans les textes (migration 0056 ; demande du propriétaire du 2026-10-16 : « Partout où un mot-clé est utilisé, il sera affiché
// en gras. Une infobulle de sa définition sera visible », marquage explicite, « une seconde balise pour le mode complet, à savoir nom et définition séparés
// d'un ':' ») : la syntaxe (lib/mots-cles-balises.mjs), le texte sans balises, la forme canonique, le HTML (exclusions, attributs, une bulle par mot-clé),
// le middleware du site (src/middleware.mjs, avec un faux `next()`), la recherche (mots-clés cités), le contrôle db:check (aucune balise orpheline) ;
// puis le service (serveur/edition.mjs, sur une copie de la base) : forme canonique enregistrée, ref inconnue refusée, définition modifiée (même d'un
// mot-clé protégé), suppression qui retire les balises d'un effet d'arme en gardant sa recharge, fusion qui les recible, pages créées sans mot-clé libre.
//   node --test test/mots-cles-balises.test.mjs
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { traiter } from '../serveur/api.mjs';
import { ouvrirBaseVivante, preparerBaseVivante } from '../serveur/base-vivante.mjs';
import { reponseAvecMotsCles } from '../src/middleware.mjs';
import { analyserEffetDArme } from '../src/lib/arme-champs.mjs';
import { decouperInventaire } from '../src/lib/classe-champs.mjs';
import { RENDUS } from '../src/lib/edition-rendu.mjs';
import { htmlAvecMonnaies, htmlDePiece, MONNAIES_DU_JEU, morceauxDeMonnaie } from '../src/lib/monnaies.mjs';
import { avecLesValeurs, emplacements } from '../src/lib/monstre-champs.mjs';
import { cheminBase } from '../src/lib/donnees.mjs';
import {
  ambiguiteDe, avecLeursBalises, formeCanonique, formesNonCanoniques, htmlAvecMotsCles, htmlDeLaBalise, htmlDeLaBulle, htmlDeLaDefinition, htmlDeLaPastille,
  htmlAussiAppele, htmlDeLIcone, htmlDuNomDuMotCle, lireBalises, lireUneBalise, motCleDeLaRef, synonymesAffiches,
  motsClesCites, pageAvecMotsCles, reciblerLeMotCle, retirerLeMotCle, texteSansBalises, vocabulaireDesMotsCles, zonesDeCode,
} from '../src/lib/mots-cles-balises.mjs';
import { chargerVocabulaire } from '../src/lib/mots-cles-db.mjs';
import { IDS_DES_MOTS_CLES_PROTEGES } from '../src/lib/mots-cles-proteges.mjs';
import { comptesDesMotsCles, elementsDuMotCle } from '../src/lib/recherche-mots-cles.mjs';
import { normalize } from '../src/lib/text.mjs';
import { baseDImport } from './aide-base-d-import.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';

// des mots-clés d'essai : un id entier (figé, migration 0113) et une clé (celle que citent les balises, R232 (3)) ; le libellé n'est pas unique
const VOCABULAIRE = [
  { id: 1, cle: 'recharge-longue', libelle: 'Recharge longue', description: 'Doit utiliser son action ou son mouvement pour recharger.' },
  { id: 2, cle: 'non-mort', libelle: 'Non-mort', description: 'Une créature revenue de la mort.' },
  { id: 3, cle: 'mordhau', libelle: 'Mordhau', description: null },
  { id: 4, cle: 'glossaire', libelle: 'Glossaire', description: 'Voir {{non-mort:}} et {{recharge-longue}}.' },
];
const V = vocabulaireDesMotsCles(VOCABULAIRE);
const ID = Object.fromEntries(VOCABULAIRE.map((m) => [m.cle, m.id]));

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
  // une ref : la clé, ou l'écriture du libellé (normalize)
  assert.equal(motCleDeLaRef(V, 'recharge-longue').id, ID['recharge-longue']);
  assert.equal(motCleDeLaRef(V, 'Recharge  LONGUE').id, ID['recharge-longue']);
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
  assert.equal(formeCanonique('{{x\\|y}}', vocabulaireDesMotsCles([{ id: 9, cle: 'x', libelle: 'X' }])).texte, '{{x|y}}', 'un « \\| » devient « | » (une case n’est pas du Markdown)');
  const canonique = formeCanonique('a {{non-mort}}', V).texte;
  assert.equal(canonique, 'a {{non-mort|Non-mort}}');
  assert.equal(formeCanonique(canonique, V).texte, canonique, 'stable');
  assert.equal(texteSansBalises(canonique), 'a Non-mort', 'se lit sans le vocabulaire');
  assert.equal(formeCanonique('{{Mordhau :}}', V).complets[0], 'Mordhau', '« {{ref :}} » (une espace avant les deux-points) : le mode complet aussi');
  assert.deepEqual(motsClesCites('{{non-mort}} {{Non mort|x}} {{recharge-longue:}} {{absent}}', V), [ID['non-mort'], ID['recharge-longue']], 'leurs ids entiers');
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
  assert.deepEqual(motsClesCites('`{{non-mort}}` {{mordhau}}', V, { markdown: true }), [ID.mordhau], 'cité hors des codes seulement');
  assert.equal(texteSansBalises('`{{non-mort}}` {{mordhau}}', V, { markdown: true }), '`{{non-mort}}` Mordhau');
  const stable = md('Voir {{non-mort|morts}} et {{mordhau:}}').texte;
  assert.equal(md(stable).texte, stable, 'stable');
});

test('insensible à la casse : la balise reconnaît le mot-clé quelle que soit la casse et garde la casse écrite (demande du propriétaire, 2026-10-17)', () => {
  // « {{solidité}} » montre « solidité », « {{Solidité}} » « Solidité » ; l'id ou le libellé lui-même : le libellé (il suit les renommages)
  const md = (t) => formeCanonique(t, V, { markdown: true }).texte;
  assert.equal(md('{{recharge longue}}, {{RECHARGE LONGUE}}, {{Recharge longue}}, {{recharge-longue}}'),
    '{{recharge-longue|recharge longue}}, {{recharge-longue|RECHARGE LONGUE}}, {{recharge-longue}}, {{recharge-longue}}');
  assert.equal(md('| a | {{non mort}} |'), '| a | {{non-mort\\|non mort}} |', 'sur une ligne de tableau, « \\| »');
  assert.equal(formeCanonique('{{recharge longue}} et {{Recharge longue}}', V).texte, '{{recharge-longue|recharge longue}} et {{recharge-longue|Recharge longue}}', 'un texte de case');
  assert.equal(texteSansBalises('Un cran de {{non-mort}}, de {{non mort}}, de {{NON-MORT}}.', V), 'Un cran de Non-mort, de non mort, de NON-MORT.');
  const { html } = htmlAvecMotsCles('<p>{{recharge longue}}</p>', V);
  assert.match(html, /<strong class="mot-cle" data-mot-cle="recharge-longue"[^>]*>recharge longue<\/strong>/);
  for (const t of ['{{recharge longue}}', '{{RECHARGE LONGUE}}']) assert.equal(md(md(t)), md(t), `${t} : stable`);
  assert.deepEqual(formesNonCanoniques(md('{{recharge longue}}'), V, { markdown: true }), [], 'ce qu’elle écrit passe db:check');
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
    ['{{non-mort}}', 'un texte de case porte le texte de sa balise (« {{cle|texte}} »)'],
    ['{{mordhau:}}', 'le mode complet ne s’écrit que dans un texte mis en forme'],
  ]);
});

test('R232 (4) : un libellé que portent des homonymes est une ref ambiguë (relevée, la balise gardée) ; leur clé les désigne ; les zones de code d’un Markdown', () => {
  // deux homonymes distingués par leurs catégories (R232 (2) : « orios-race », « orios-classe ») ; une clé quittée (« orios ») s'écrit comme leur libellé
  const v = vocabulaireDesMotsCles([
    { id: 11, cle: 'orios-race', libelle: 'Orios', categories: [3], anciennes_cles: ['orios'] },
    { id: 12, cle: 'orios-classe', libelle: 'Orios', categories: [6] },
  ]);
  assert.deepEqual(ambiguiteDe(v, 'Orios')?.homonymes.map((m) => m.id), [11, 12]);
  assert.deepEqual(ambiguiteDe(v, 'orios')?.homonymes.map((m) => m.id), [11, 12], 'le libellé passe avant une clé quittée');
  assert.equal(ambiguiteDe(v, 'orios-classe'), null);
  assert.equal(motCleDeLaRef(v, 'Orios'), null, 'ambiguë : aucun mot-clé');
  assert.equal(motCleDeLaRef(v, 'ORIOS-CLASSE').id, 12, 'la clé, sans égard à la casse');
  assert.deepEqual(formeCanonique('{{Orios}} {{orios-classe}}', v), { texte: '{{Orios}} {{orios-classe|Orios}}', inconnues: [], ambigues: ['Orios'], complets: [] });
  assert.deepEqual(formesNonCanoniques('{{Orios}}', v).map((f) => f.raison), ['sa ref est un libellé que portent plusieurs mots-clés : elle s’écrit par la clé']);
  assert.deepEqual(zonesDeCode('a `b` ``c`d`` \\`e` f\n\n`g\n\nh` ~~~\n~~~x\n{{y}}\n~~~\n'), [[2, 5], [6, 13], [33, 47]],
    'code en ligne (un accent grave échappé n’ouvre rien, une ligne vide ferme le paragraphe), bloc ~~~ (une ligne qui commence par lui)');
});

test('R233 (1), (2), (10) : une balise saisie par un synonyme (l’ancienne abréviation comprise) ou dans une autre casse est reconnue, sans égard à la casse, et enregistrée avec le texte tapé ; la clé ou le libellé exact montrent le libellé ; une clé quittée mène au mot-clé', () => {
  const v = vocabulaireDesMotsCles([
    { id: 10, cle: 'instant-cast', libelle: 'Instant Cast', description: 'Agir vite.', synonymes: ['IC', 'Action rapide'], anciennes_cles: ['ancienne-cle'] },
    ...VOCABULAIRE,
  ]);
  const md = (t) => formeCanonique(t, v, { markdown: true }).texte;
  // « Garder la casse tapée, incluant les synonymes et abréviations » : « {{ic}} » s'enregistre « {{instant-cast|ic}} »
  assert.equal(md('{{ic}} {{IC}} {{Action rapide}} {{action rapide}} {{instant cast}} {{Instant Cast}} {{instant-cast}} {{ancienne-cle}}'),
    '{{instant-cast|ic}} {{instant-cast|IC}} {{instant-cast|Action rapide}} {{instant-cast|action rapide}} {{instant-cast|instant cast}} {{instant-cast}} {{instant-cast}} {{instant-cast}}');
  assert.equal(formeCanonique('{{ic}} et {{instant-cast}}', v).texte, '{{instant-cast|ic}} et {{instant-cast|Instant Cast}}', 'un texte de case porte toujours son texte');
  assert.equal(formeCanonique('{{solidité}}', vocabulaireDesMotsCles([{ id: 5, cle: 'solidite', libelle: 'Solidité' }]), { markdown: true }).texte, '{{solidite|solidité}}');
  for (const t of ['{{ic}}', '{{Action rapide}}', '{{instant cast}}']) {
    assert.equal(md(md(t)), md(t), `${t} : stable`);
    assert.deepEqual(formesNonCanoniques(md(t), v, { markdown: true }), [], `${t} : ce qu’elle écrit passe db:check`);
  }
  assert.deepEqual(motsClesCites('{{IC}} {{action rapide}}', v), [10]);
  assert.equal(texteSansBalises('{{instant-cast|ic}}, {{instant-cast}}', v), 'ic, Instant Cast');
  assert.match(htmlAvecMotsCles('<p>{{instant-cast|IC}}</p>', v).html, /<strong class="mot-cle" data-mot-cle="instant-cast"[^>]*>IC<\/strong>/, 'le synonyme affiché, la clé citée');
});

test('retirer un mot-clé (son texte simple, « Libellé : définition » pour le mode complet) et recibler ses balises (fusion), le texte écrit gardé', () => {
  const t = '{{non-mort|morts-vivants}}, {{non-mort}}, {{non-mort:}} et {{recharge-longue}}';
  assert.equal(retirerLeMotCle(t, V, ID['non-mort']), 'morts-vivants, Non-mort, Non-mort : Une créature revenue de la mort. et {{recharge-longue}}');
  assert.equal(retirerLeMotCle('| {{non-mort|a*b}} |', V, ID['non-mort'], { markdown: true }), '| a\\*b |', 'échappé pour du Markdown');
  assert.equal(retirerLeMotCle('`{{non-mort}}` {{non-mort}}', V, ID['non-mort'], { markdown: true }), '`{{non-mort}}` Non-mort', 'un code garde son écriture');
  // un texte de case garde le texte qu'il montrait (le libellé de la source pour une balise sans texte) ; un texte mis en forme suivra la cible
  assert.equal(reciblerLeMotCle(t, V, ID['non-mort'], ID.mordhau), '{{mordhau|morts-vivants}}, {{mordhau|Non-mort}}, {{mordhau:}} et {{recharge-longue}}');
  assert.equal(reciblerLeMotCle(t, V, ID['non-mort'], ID.mordhau, { markdown: true }), '{{mordhau|morts-vivants}}, {{mordhau}}, {{mordhau:}} et {{recharge-longue}}', 'la clé de la cible');
});

// --- HTML ---------------------------------------------------------------------------------------------------------------------------------------

test('HTML : un mot-clé décrit en gras avec sa bulle (focus clavier, pas dans un lien) ; sans définition, gras seul ; mode complet ; inconnu en texte simple', () => {
  const { html, employes } = htmlAvecMotsCles('<p>Avec {{recharge-longue}}, <a href="/x/">{{non-mort|les non-morts}}</a>, {{mordhau}}, {{non-mort:}} et {{perdu|ancien}}.</p>', V);
  assert.equal(html, '<p>Avec <strong class="mot-cle" data-mot-cle="recharge-longue" data-bulle="mot-cle-recharge-longue" aria-describedby="mot-cle-recharge-longue" tabindex="0" data-balise="{{recharge-longue}}">Recharge longue</strong>, '
    + '<a href="/x/"><strong class="mot-cle" data-mot-cle="non-mort" data-bulle="mot-cle-non-mort" aria-describedby="mot-cle-non-mort" data-balise="{{non-mort|les non-morts}}">les non-morts</strong></a>, '
    + '<strong class="mot-cle" data-mot-cle="mordhau" data-balise="{{mordhau}}">Mordhau</strong>, '
    + '<span class="mot-cle-definition" data-mot-cle="non-mort" data-balise="{{non-mort:}}"><strong class="mot-cle-definition__nom">Non-mort</strong> : <span class="mot-cle-definition__texte">Une créature revenue de la mort.</span></span> '
    + 'et ancien.</p>');
  assert.deepEqual(employes, [ID['recharge-longue'], ID['non-mort']], 'les mots-clés décrits (leurs ids), dans l’ordre');
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

test('R233 (8), (9) : le titre de la bulle est le libellé seul, ses synonymes (l’ancienne abréviation comprise) en « Aussi appelé » ; sans synonyme, rien de plus', () => {
  const vocabulaire = [...VOCABULAIRE, { id: 20, cle: 'armure-magique', libelle: 'Armure magique', description: 'Protège des sorts.', synonymes: ['AM', 'Bouclier de mana'] }];
  assert.equal(htmlDeLaBulle(20, vocabulaire),
    '<span class="bulle" role="tooltip" id="mot-cle-armure-magique" hidden><strong class="bulle__titre">Armure magique</strong>'
    + '<span class="bulle__aussi">Aussi appelé : AM, Bouclier de mana</span><span class="bulle__texte">Protège des sorts.</span></span>');
  assert.doesNotMatch(htmlDeLaBulle(ID['non-mort'], vocabulaire), /bulle__aussi/, 'sans synonyme : le titre et la définition');
  assert.match(htmlDeLaBulle(ID['non-mort'], vocabulaire), /<strong class="bulle__titre">Non-mort<\/strong><span class="bulle__texte">/);
  assert.equal(synonymesAffiches({ synonymes: ['A & <b>'] })[0], 'A & <b>');
  assert.match(htmlAussiAppele({ synonymes: ['A & <b>', 'c'] }, 'x'), /^<span class="x">Aussi appelé : A &amp; &lt;b&gt;, c<\/span>$/, 'échappé');
  // la balise « {{AM}} » montre le synonyme écrit ; sa bulle, ce qu'il désigne
  const page = pageAvecMotsCles('<html><body><p>{{AM}} et {{armure-magique}}</p></body></html>', vocabulaireDesMotsCles(vocabulaire));
  assert.match(page, /<strong class="mot-cle" data-mot-cle="armure-magique"[^>]*>AM<\/strong> et <strong class="mot-cle" data-mot-cle="armure-magique"[^>]*>Armure magique<\/strong>/);
  assert.equal((page.match(/<strong class="bulle__titre">Armure magique<\/strong>/g) ?? []).length, 1, 'une bulle par mot-clé et par page');
});

test('R233 (9), R235 (3) : le nom d’un mot-clé est son libellé seul, suivi de son icône quand il en a une (une monnaie « Libellé + icône », R63) ; la pastille de /recherche/ « Armure magique · 3 »', () => {
  assert.equal(htmlDuNomDuMotCle({ libelle: 'Armure magique', synonymes: ['AM'] }), 'Armure magique');
  assert.equal(htmlDuNomDuMotCle({ libelle: 'Feu' }), 'Feu');
  assert.equal(htmlDuNomDuMotCle({ libelle: 'A & <b>' }), 'A &amp; &lt;b&gt;', 'échappé');
  // l'icône (mot_cle.icone, migration 0116 ; R235 : le RF, le RO et la PP l'ont reçue) : son libellé, puis le dessin de lib/monnaies.mjs, jamais « (RO) »
  for (const [monnaie, libelle, abr] of [['rf', 'Ricken de fer', 'RF'], ['ro', 'Ricken d’or', 'RO'], ['pp', 'Pierre précieuse', 'PP']]) {
    assert.equal(htmlDeLIcone(`monnaie:${monnaie}`), htmlDePiece(abr), `${abr} : le même dessin que dans le texte`);
    assert.equal(htmlDuNomDuMotCle({ libelle, icone: `monnaie:${monnaie}` }), `${libelle} ${htmlDePiece(abr)}`, abr);
    assert.doesNotMatch(htmlDuNomDuMotCle({ libelle, icone: `monnaie:${monnaie}` }).replace(/<[^>]+>/g, ''), new RegExp(`\\b${abr}\\b`), `${abr} : pas d’abréviation visible`);
  }
  assert.equal(htmlDuNomDuMotCle({ libelle: 'Ricken d’or', monnaie_id: 'ro' }), 'Ricken d’or', 'l’affichage passe par `icone`, plus par `monnaie_id`');
  assert.equal(htmlDeLIcone('monnaie:inconnue'), '', 'une icône que la liste n’a pas : rien');
  assert.equal(htmlDeLIcone(null), '');
  assert.equal(htmlDeLaPastille({ libelle: 'Armure magique', n: 3 }), '<span class="recherche-nom">Armure magique</span> · 3');
  assert.equal(htmlDeLaPastille({ libelle: 'Armure magique', n: 0 }), '<span class="recherche-nom">Armure magique</span>', 'sans page : pas de nombre');
  assert.equal(htmlDeLaPastille({ libelle: 'Ricken d’or', icone: 'monnaie:ro', n: 1 }), `<span class="recherche-nom">Ricken d’or ${htmlDePiece('RO')}</span> · 1`);
  // la bulle : le même nom en titre ; l'abréviation de sa propre monnaie n'est pas un « Aussi appelé » (R63 : son icône est déjà là)
  const bulle = htmlDeLaBulle(30, [{ id: 30, cle: 'ricken-dor', libelle: 'Ricken d’or', monnaie_id: 'ro', icone: 'monnaie:ro', synonymes: ['RO', 'Ro d’or'], description: '1 RO = 100 RF.' }]);
  assert.ok(bulle.includes(`<strong class="bulle__titre">Ricken d’or ${htmlDePiece('RO')}</strong><span class="bulle__aussi">Aussi appelé : Ro d’or</span>`), bulle);
  assert.deepEqual(synonymesAffiches({ monnaie_id: 'ro', synonymes: ['ro'] }), []);
  // la définition de la vue : monnaies en icônes, balises gardées (le middleware les rend ensuite)
  assert.equal(htmlDeLaDefinition('Voir {{non-mort}} : 10 RO.'), htmlAvecMonnaies('Voir {{non-mort}} : 10 RO.'));
  assert.match(htmlDeLaDefinition('Voir {{non-mort}} : 10 RO.'), /^Voir \{\{non-mort\}\} : <span class="montant"/);
  assert.equal(htmlDeLaDefinition(null), '');
});

test('R4 (relecture), migrations 0113 et 0116 : le mot-clé d’une monnaie se reconnaît à `monnaie_id` (l’id de la table `monnaie`, figé), son icône à `icone` (R235) — ni à son id, ni à un synonyme, qui se modifient', () => {
  for (const synonymes of [['RO'], ['R.O.'], []]) {
    assert.equal(htmlDuNomDuMotCle({ id: 7, libelle: 'Ricken d’or', monnaie_id: 'ro', icone: 'monnaie:ro', synonymes }), `Ricken d’or ${htmlDePiece('RO')}`, String(synonymes));
  }
  // un synonyme « RO » sur un autre mot-clé : un synonyme comme un autre
  assert.equal(htmlDuNomDuMotCle({ id: 8, libelle: 'Rouge', synonymes: ['RO'] }), 'Rouge');
  assert.deepEqual(synonymesAffiches({ id: 8, libelle: 'Rouge', synonymes: ['RO'] }), ['RO']);
  // la correspondance, à l'import (le libellé d'un mot-clé se modifie sur le site de dev, le nom d'une monnaie est figé : R193) : les ids de
  // MONNAIES_DU_JEU sont ceux de la table `monnaie`, et chacun a son mot-clé (R183), du même nom, par `monnaie_id`
  const importee = baseDImport();
  const monnaies = importee.prepare('SELECT id, nom, abreviation FROM monnaie ORDER BY id').all();
  assert.deepEqual(monnaies.map((m) => [m.id, m.abreviation]), Object.entries(MONNAIES_DU_JEU).map(([abr, m]) => [m.id, abr]).sort());
  for (const m of monnaies) {
    const motCle = importee.prepare('SELECT libelle, icone FROM mot_cle WHERE monnaie_id = ?').get(m.id);
    assert.ok(motCle, `${m.id} : le mot-clé de sa monnaie`);
    assert.equal(motCle.icone, `monnaie:${m.id}`, `${m.id} : son icône, dès la migration 0116 (R235 (1))`);
    assert.equal(normalize(motCle.libelle), normalize(m.nom), `${m.id} : le nom de sa monnaie`);
  }
  // aujourd'hui : l'abréviation d'une monnaie, celles du RF, du RO et de la PP comprises, se modifie sur le site de dev (décision R195 (2) : elle ne
  // change pas dans les règles, R61, mais le site ne l'empêche pas ; serveur/edition-composants.mjs#MONNAIE) ; restent une seule unité, que le site ne
  // supprime pas, et deux monnaies qui ne s'écrivent pas de la même façon, sans égard à la casse ; chaque monnaie a au plus un mot-clé
  const db = new DatabaseSync(cheminBase(), { readOnly: true });
  try {
    const abreviations = db.prepare('SELECT abreviation FROM monnaie').all().map((m) => m.abreviation.toLowerCase());
    assert.equal(new Set(abreviations).size, abreviations.length, 'des abréviations distinctes');
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM monnaie WHERE valeur_rf = 1').get().n, 1, 'une seule unité, que le site ne supprime pas');
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM (SELECT monnaie_id FROM mot_cle WHERE monnaie_id IS NOT NULL GROUP BY monnaie_id HAVING count(*) > 1)').get().n, 0);
  } finally {
    db.close();
  }
});

test('décisions R63, R183 (9) (« R63 est respectée partout ») et R183 (12) (« Décomposer comme ailleurs ») : le texte d’une balise et la définition du mode complet montrent les monnaies en icônes ; un montant écrit dans une balise se décompose', () => {
  const v = vocabulaireDesMotsCles([
    ...VOCABULAIRE,
    { id: 40, cle: 'ricken-dor', libelle: 'Ricken d’or', monnaie_id: 'ro', icone: 'monnaie:ro', synonymes: ['RO'], description: 'Le Ricken d’or (RO). 1 RO = 100 RF.' },
    { id: 41, cle: 'prix-fixe', libelle: 'Prix fixe', description: 'Un prix qui ne se marchande pas.' },
  ]);
  const html = (t) => htmlAvecMotsCles(t, v).html;
  const visible = (h) => h.replace(/<span class="bulle"[\s\S]*$/, '').replace(/<[^>]+>/g, '');
  // « {{RO}} » (forme canonique : « {{ricken-dor|RO}} ») : l'icône, pas « RO »
  const ro = html('Payer en {{ricken-dor|RO}}.');
  assert.match(ro, /<strong class="mot-cle" data-mot-cle="ricken-dor"[^>]*data-balise="\{\{ricken-dor\|RO\}\}"><span class="piece piece--ro"[^>]*><\/span><\/strong>/);
  assert.doesNotMatch(visible(ro), /\bRO\b/);
  // le mode complet : « Ricken d’or : » puis la définition, ses monnaies en icônes (comme sa bulle)
  const complet = html('{{ricken-dor:}}');
  assert.match(complet, /<span class="mot-cle-definition__texte">Le Ricken d’or \(<span class="piece piece--ro"/);
  assert.doesNotMatch(visible(complet), /\bR[OF]\b/);
  // un montant écrit dans la balise (R183 (12), « Décomposer comme ailleurs ») : décomposé comme dans le texte courant, « 1 [PP] 245 [RO] 50 [RF] »,
  // l'écriture d'origine en data-montant ; la balise garde son texte tel qu'écrit (data-balise)
  const prix = html('{{prix-fixe|1245,5 RO}}');
  assert.ok(prix.includes(`data-balise="{{prix-fixe|1245,5 RO}}">${htmlAvecMonnaies('1245,5 RO')}</strong>`), prix);
  assert.deepEqual([...prix.matchAll(/<span class="montant__part">([\d ]+)&#8239;<span class="piece piece--(\w+)"/g)].map((m) => [m[1], m[2]]),
    [['1', 'pp'], ['245', 'ro'], ['50', 'rf']], '1 PP 245 RO 50 RF');
  assert.match(prix, /data-montant="1245,5 RO"/);
  assert.doesNotMatch(visible(prix), /\bRO\b/);
  // une conversion écrite dans une balise ne se décompose pas, comme ailleurs
  assert.equal(htmlDeLaBalise(lireUneBalise('{{prix-fixe|1 RO = 100 RF}}'), v, { sansBulle: true }).html,
    `<strong class="mot-cle" data-mot-cle="prix-fixe" data-balise="{{prix-fixe|1 RO = 100 RF}}">${htmlAvecMonnaies('1 RO = 100 RF')}</strong>`);
  // dans un attribut de texte ou une <option> : le texte simple, comme le texte courant dans un attribut
  assert.match(html('<p title="Le {{prix-fixe|1245,5 RO}}">x</p>'), /title="Le 1245,5 RO"/);
  // sans monnaie : rien ne change
  assert.equal(html('{{non-mort}} et {{non-mort|non-morts}}').replace(/<span class="bulle"[\s\S]*$/, ''),
    '<strong class="mot-cle" data-mot-cle="non-mort" data-bulle="mot-cle-non-mort" aria-describedby="mot-cle-non-mort" tabindex="0" data-balise="{{non-mort}}">Non-mort</strong> et '
    + '<strong class="mot-cle" data-mot-cle="non-mort" data-bulle="mot-cle-non-mort" aria-describedby="mot-cle-non-mort" tabindex="0" data-balise="{{non-mort|non-morts}}">non-morts</strong>');
  assert.equal(htmlDeLaBalise(lireUneBalise('{{mordhau|l’épée & <la> « garde »}}'), v).html,
    '<strong class="mot-cle" data-mot-cle="mordhau" data-balise="{{mordhau|l’épée &amp; &lt;la&gt; « garde »}}">l’épée &amp; &lt;la&gt; « garde »</strong>', 'échappé comme avant');
  assert.match(html('{{glossaire:}}'), /<span class="mot-cle-definition__texte">Voir Non-mort et Recharge longue\.<\/span>/, 'une définition sans monnaie : telle qu’avant');
});

test('R235 (3) : l’icône d’un mot-clé s’affiche partout où il apparaît dans un texte — après son texte affiché (sauf s’il montre déjà ce dessin), après le nom du mode complet, dans le titre de sa bulle ; un attribut garde le texte simple', () => {
  const v = vocabulaireDesMotsCles([...VOCABULAIRE,
    { id: 60, cle: 'ricken-dor', libelle: 'Ricken d’or', icone: 'monnaie:ro', synonymes: ['RO'], description: 'Une pièce.' },
    { id: 61, cle: 'sans-icone', libelle: 'Sans icône', description: 'Rien.' }]);
  const piece = htmlDePiece('RO');
  const html = (t) => htmlAvecMotsCles(t, v).html;
  assert.match(html('<p>{{ricken-dor}}</p>'), new RegExp(`data-balise="\\{\\{ricken-dor\\}\\}">Ricken d’or ${piece.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}</strong>`), 'le libellé, puis l’icône');
  assert.match(html('<p>{{ricken-dor|la pièce}}</p>'), /data-balise="\{\{ricken-dor\|la pièce\}\}">la pièce <span class="piece piece--ro"/, 'un texte écrit, puis l’icône');
  assert.equal((html('<p>{{ricken-dor|RO}}</p>').match(/piece--ro/g) ?? []).length, 1, 'le texte est déjà l’icône : une seule fois');
  assert.match(html('<p>{{ricken-dor:}}</p>'), /<strong class="mot-cle-definition__nom">Ricken d’or <span class="piece piece--ro"[^>]*><\/span><\/strong> : /, 'le mode complet');
  assert.ok(htmlDeLaBulle(60, v).includes(`<strong class="bulle__titre">Ricken d’or ${piece}</strong>`), 'le titre de la bulle');
  assert.match(html('<p title="{{ricken-dor}}">x</p>'), /title="Ricken d’or"/, 'un attribut : le texte simple');
  assert.match(html('<p>{{sans-icone}}</p>'), />Sans icône<\/strong>/, 'sans icône : rien de plus');
});

test('décision R63 : les monnaies d’une définition s’affichent en icônes dans la bulle de son mot-clé, comme dans tout texte courant (« Monnaies », migration 0090)', () => {
  const vocabulaire = [{ id: 50, cle: 'monnaies', libelle: 'Monnaies', description: 'le Ricken de fer (RF) et le Ricken d’or (RO). 1 RO = 100 RF.' }];
  const bulle = htmlDeLaBulle(50, vocabulaire);
  const texte = bulle.match(/<span class="bulle__texte">([\s\S]*)<\/span><\/span>$/)[1];
  assert.equal(texte, htmlAvecMonnaies('le Ricken de fer (RF) et le Ricken d’or (RO). 1 RO = 100 RF.'));
  assert.match(texte, /class="piece piece--rf"/);
  assert.doesNotMatch(texte.replace(/<[^>]+>/g, ''), /(?<![\p{L}\p{N}])R[OF](?![\p{L}\p{N}])/u, 'plus d’abréviation visible');
  assert.match(htmlDeLaBulle(ID['non-mort'], VOCABULAIRE), /<span class="bulle__texte">Une créature revenue de la mort\.<\/span>/, 'sans monnaie : le texte tel quel');
});

test('HTML : dans une bulle, le gras seul ; dans un élément qui a le focus, sans tabindex ; dans un bouton ou un résumé, sans bulle ; un élément exclu garde ses attributs', () => {
  const rendu = (html) => htmlAvecMotsCles(html, V);
  const bulle = rendu('<span class="bulle bulle--carte" role="tooltip"><span class="bulle__texte">{{recharge-longue}}</span></span><span class="bulle-zone">{{non-mort}}</span>');
  assert.match(bulle.html, /<span class="bulle__texte"><strong class="mot-cle" data-mot-cle="recharge-longue" data-balise="\{\{recharge-longue\}\}">Recharge longue<\/strong>/,
    'dans une bulle : ni bulle ni tabindex');
  assert.match(bulle.html, /<span class="bulle-zone"><strong class="mot-cle" data-mot-cle="non-mort" data-bulle="mot-cle-non-mort"[^>]* tabindex="0"/, '« bulle-zone » n’est pas une bulle');
  assert.deepEqual(bulle.employes, [ID['non-mort']], 'la bulle d’un mot-clé cité dans une bulle n’est pas posée');
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
  const mordhau = db.prepare("SELECT libelle, description FROM mot_cle WHERE cle = 'mordhau'").get();
  db.close();
  const html = await r.text();
  if (mordhau) assert.match(html, new RegExp(`data-mot-cle="mordhau"[^>]*>${mordhau.libelle}</strong>`));
  else assert.match(html, /<body>mordhau<\/body>/, 'mot-clé absent de la base : texte simple');
});

// --- Recherche ----------------------------------------------------------------------------------------------------------------------------------

test('recherche : une page cite un mot-clé du glossaire par ses balises (lib/recherche-index.ts) : il compte, et sa vue la liste', () => {
  const corps = 'Arbalète : {{recharge-longue|Recharge longue}}. Voir {{non-mort:}}.';
  const index = [
    { title: 'Armes', motsCles: [...new Set([99, ...motsClesCites(corps, V)])], text: texteSansBalises(corps, V) },
    { title: 'Autre', motsCles: [] },
  ];
  assert.deepEqual(index[0].motsCles, [99, ID['recharge-longue'], ID['non-mort']], 'l’étiquette (un id entier), puis les mots-clés cités');
  assert.equal(index[0].text, 'Arbalète : Recharge longue. Voir Non-mort : Une créature revenue de la mort..');
  assert.deepEqual([...comptesDesMotsCles(index)], [[99, 1], [ID['recharge-longue'], 1], [ID['non-mort'], 1]]);
  assert.deepEqual(elementsDuMotCle(index, ID['non-mort']).map((e) => e.title), ['Armes']);
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
const dossier = dossierTemporaire('mots-cles-balises');

test('db:check (D1, D2) : toute balise de toutes les colonnes de texte vise un mot-clé par sa clé (R232 (3)), sous la forme canonique de sa colonne ; un code est ignoré', () => {
  const copie = join(dossier, 'check.db');
  cpSync(cheminBase(), copie);
  const d = new DatabaseSync(copie);
  const page = d.prepare("SELECT id FROM page WHERE type = 'guide' ORDER BY id LIMIT 1").get().id;
  const { cle, libelle } = d.prepare('SELECT cle, libelle FROM mot_cle ORDER BY id LIMIT 1').get();
  const cite = { id: cle, libelle };
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
  if (cite.libelle !== cite.id) attendu('page.corps_md', page, `{{${cite.libelle}|écrit}}`, 'sa ref n’est pas la clé du mot-clé|libellé que portent plusieurs mots-clés');
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
  // une écriture qu'aucun mot-clé ne prend (ni libellé, ni clé, ni synonyme, ni clé quittée : R232, R233 (4))
  const prise = (t) => {
    const k = normalize(t);
    return db.prepare('SELECT libelle FROM mot_cle').all().some((m) => normalize(m.libelle) === k)
      || Boolean(db.prepare('SELECT 1 FROM mot_cle WHERE cle = ? UNION ALL SELECT 1 FROM mot_cle_synonyme WHERE libelle_cle = ? UNION ALL SELECT 1 FROM mot_cle_ancienne_cle WHERE cle = ?').get(k, k, k));
  };
  const libre = (base) => {
    let t = base;
    for (let i = 2; prise(t); i += 1) t = `${base} ${i}`;
    return t;
  };
  const creerMotCle = (libelle, description = null, autres = {}) => ok([{ op: 'creer', entite: 'mot_cle', valeurs: { libelle, ...(description === null ? {} : { description }), ...autres } }]).crees[0].id;
  /** La clé du mot-clé `id`, telle que la base la porte maintenant (elle suit le libellé et les homonymes : R232 (2)). */
  const cle = (id) => db.prepare('SELECT cle FROM mot_cle WHERE id = ?').get(id)?.cle;
  return { db, lot, ok, libre, creerMotCle, cle, ligne: (sql, ...p) => db.prepare(sql).get(...p), appel: (methode, chemin) => traiter({ methode, chemin, entetes: {} }, s) };
}

/** Une arme du tableau dont l'effet n'écrit pas de recharge (lue dans l'état courant). */
const armeSansRecharge = (s) => s.ligne(`SELECT a.* FROM arme a JOIN arme_famille f ON f.id = a.famille_id WHERE f.maitrisable = 1 AND a.recharge IS NULL
  AND a.effet IS NOT NULL AND a.effet NOT LIKE '%{{%' ORDER BY a.id LIMIT 1`);

test('service : un texte enregistré sous sa forme canonique (journal compris), une ref inconnue refusée (400, citée), sauf déjà là ; la recharge suit la balise', () => {
  const s = service();
  const libelle = s.libre('Essai recharge');
  const id = s.creerMotCle(libelle, 'Définition d’essai.');
  assert.ok(Number.isInteger(id), 'un id entier (migration 0113)');
  const cle = s.cle(id);
  assert.equal(cle, normalize(libelle), 'sans homonyme, la clé est le slug du libellé (R232 (2))');
  const arme = armeSansRecharge(s);
  const effet = `${arme.effet}, {{${libelle}|Recharge longue}}`;
  s.ok([{ op: 'modifier', table: 'arme', cle: { id: arme.id }, valeurs: { effet }, avant: { effet: arme.effet } }], 'ressources/armes/');
  const apres = s.ligne('SELECT effet, recharge FROM arme WHERE id = ?', arme.id);
  assert.equal(apres.effet, `${arme.effet}, {{${cle}|Recharge longue}}`, 'la forme canonique : la clé');
  assert.equal(apres.recharge, 'longue', 'le découpage lit le texte sans balise');
  const note = s.ligne("SELECT apres FROM modification WHERE table_nom = 'arme' AND json_extract(cle, '$.id') = ? ORDER BY lot_id DESC, rang DESC LIMIT 1", arme.id);
  assert.equal(JSON.parse(note.apres).effet, apres.effet, 'le journal note la forme canonique');
  // une ref inconnue : refusée, avec la ref
  const inconnue = s.lot([{ op: 'modifier', table: 'arme', cle: { id: arme.id }, valeurs: { effet: `${apres.effet} {{aucun-mot-cle-de-ce-nom}}` } }], 'ressources/armes/');
  assert.equal(inconnue.statut, 400);
  assert.match(inconnue.corps.erreur, /« \{\{aucun-mot-cle-de-ce-nom\}\} » ne cite aucun mot-clé/);
  // déjà dans le texte (d'avant la suppression de son mot-clé) : le texte se modifie quand même
  s.db.prepare('UPDATE mot_cle SET description = ? WHERE id = ?').run('Ancien {{mot-cle-disparu-d-essai|texte}}.', id);
  s.ok([{ op: 'modifier', table: 'mot_cle', cle: { id }, valeurs: { description: 'Ancien {{mot-cle-disparu-d-essai|texte}}, modifié.' } }]);
  assert.equal(s.lot([{ op: 'modifier', table: 'mot_cle', cle: { id }, valeurs: { description: '{{mot-cle-disparu-d-essai}} et {{autre-disparu}}' } }]).statut, 400,
    'une ref inconnue ajoutée reste refusée');
  // une création : la description d'un événement (un texte mis en forme) : l'id seul quand le texte est le libellé, un autre texte gardé
  const titre = `Essai glossaire ${process.pid}`;
  const description = `Le {{${libelle}}} du jour, {{${cle}|${libelle}}}, {{${cle}|un autre}} et {{${libelle}:}} ; \`{{absent-d-essai}}\` en code.`;
  const evenement = s.ok([{ op: 'creer', entite: 'evenement', valeurs: { epoque: 'inconnue', titre, description } }], 'chronologie/').crees[0].id;
  assert.equal(s.ligne('SELECT texte FROM evenement_extrait WHERE evenement_id = ?', evenement).texte,
    `Le {{${cle}}} du jour, {{${cle}}}, {{${cle}|un autre}} et {{${cle}:}} ; \`{{absent-d-essai}}\` en code.`, 'le code reste tel quel, sans refus');
  assert.equal(s.lot([{ op: 'creer', entite: 'evenement', valeurs: { epoque: 'inconnue', titre: `${titre} bis`, description: '{{absent-d-essai}}' } }], 'chronologie/').statut, 400);
});

test('service (D2) : le mode complet refusé dans un texte de case (message clair), accepté dans un texte mis en forme ; R232 (4) : le libellé de deux homonymes, une ref ambiguë refusée (refs, homonymes), sauf déjà là', () => {
  const s = service();
  const libelle = s.libre('Essai complet');
  const id = s.creerMotCle(libelle, 'Sa définition.');
  const cle = s.cle(id);
  const arme = armeSansRecharge(s);
  const refus = s.lot([{ op: 'modifier', table: 'arme', cle: { id: arme.id }, valeurs: { effet: `${arme.effet}, {{${cle}:}}` } }], 'ressources/armes/');
  assert.equal(refus.statut, 400);
  assert.match(refus.corps.erreur, /le mode complet ne s’écrit que dans un texte mis en forme \(guide, Codex, chronologie, panneaux de règles\)/);
  assert.equal(s.lot([{ op: 'creer', entite: 'mot_cle', valeurs: { libelle: s.libre('Essai complet bis'), description: `Voir {{${cle}:}}.` } }]).statut, 400, 'une définition est un texte de case');
  const ok = s.ok([{ op: 'creer', entite: 'evenement', valeurs: { epoque: 'inconnue', titre: `Essai complet ${process.pid}`, description: `{{${cle}:}}` } }], 'chronologie/');
  assert.equal(s.ligne('SELECT texte FROM evenement_extrait WHERE evenement_id = ?', ok.crees[0].id).texte, `{{${cle}:}}`);
  // deux homonymes, distingués par une catégorie chacun (R232 (9)) : leur libellé, écrit seul, est ambigu ; leurs clés les désignent
  const [c1, c2] = s.db.prepare('SELECT id FROM categorie_mot_cle ORDER BY id LIMIT 2').all().map((c) => c.id);
  const homonyme = s.libre('Essai ambigu');
  const a = s.creerMotCle(homonyme, 'Le premier.', { categories: [c1] });
  const effet = `${arme.effet}, {{${s.cle(a)}|cité avant}}`;
  s.ok([{ op: 'modifier', table: 'arme', cle: { id: arme.id }, valeurs: { effet } }], 'ressources/armes/');
  const b = s.creerMotCle(homonyme, 'Le second.', { categories: [c2] });
  assert.notEqual(s.cle(a), s.cle(b));
  const recrit = s.ligne('SELECT effet FROM arme WHERE id = ?', arme.id).effet;
  assert.equal(recrit, `${arme.effet}, {{${s.cle(a)}|cité avant}}`, 'la clé du premier a changé (un homonyme est apparu) : sa balise suit (R232 (3))');
  const douteux = s.lot([{ op: 'modifier', table: 'mot_cle', cle: { id }, valeurs: { description: `Voir {{${homonyme}|lequel}}.` } }]);
  assert.equal(douteux.statut, 400);
  assert.deepEqual(douteux.corps.refs, [homonyme]);
  assert.deepEqual([...douteux.corps.homonymes[0]].sort(), [s.cle(a), s.cle(b)].sort());
  assert.match(douteux.corps.erreur, /R232 \(4\)/);
  // déjà dans le texte : il se modifie encore ; la clé de l'un ou de l'autre passe
  s.db.prepare('UPDATE mot_cle SET description = ? WHERE id = ?').run(`Voir {{${homonyme}|lequel}}.`, id);
  s.ok([{ op: 'modifier', table: 'mot_cle', cle: { id }, valeurs: { description: `Voir {{${homonyme}|lequel}}, modifié.` } }]);
  s.ok([{ op: 'modifier', table: 'mot_cle', cle: { id }, valeurs: { description: `Voir {{${s.cle(b)}|celui-ci}}.` } }]);
});

test('service : la définition d’un mot-clé non verrouillé se modifie, son libellé aussi (R195) ; vidée : pas encore décrit ; celle d’un mot-clé verrouillé, non (R218, R219) ; GET /api/edition/mots-cles/ la rend', () => {
  const s = service();
  // un mot-clé des règles non verrouillé, décrit (le site de dev a pu le vider : on en prend un qui l'est)
  const libre = s.ligne('SELECT * FROM mot_cle WHERE verrou = 0 AND description IS NOT NULL ORDER BY id LIMIT 1');
  s.ok([{ op: 'modifier', table: 'mot_cle', cle: { id: libre.id }, valeurs: { description: 'Une définition d’essai.' }, avant: { description: libre.description } }]);
  assert.equal(s.ligne('SELECT description FROM mot_cle WHERE id = ?', libre.id).description, 'Une définition d’essai.');
  // décision R195 : « Un mot clé peut toujours être changé [dans] tous les champs (sauf l'id technique clé primaire) », s'il n'est pas verrouillé
  const renomme = s.libre('Essai renommé R195');
  s.ok([{ op: 'modifier', table: 'mot_cle', cle: { id: libre.id }, valeurs: { libelle: renomme } }]);
  assert.equal(s.ligne('SELECT libelle FROM mot_cle WHERE id = ?', libre.id).libelle, renomme, 'le libellé se modifie (R195)');
  s.ok([{ op: 'modifier', table: 'mot_cle', cle: { id: libre.id }, valeurs: { description: '' } }]);
  assert.equal(s.ligne('SELECT description FROM mot_cle WHERE id = ?', libre.id).description, null, 'NULL : pas encore décrit');
  // un mot-clé dont le site se sert est verrouillé (R219 (2)) : ni sa définition ni son libellé ne se modifient
  const magique = s.ligne('SELECT * FROM mot_cle WHERE id = ?', IDS_DES_MOTS_CLES_PROTEGES.magique);
  for (const valeurs of [{ description: 'Une classe magique.' }, { libelle: s.libre('Magie') }]) {
    const r = s.lot([{ op: 'modifier', table: 'mot_cle', cle: { id: magique.id }, valeurs }]);
    assert.equal(r.statut, 409, JSON.stringify(r.corps));
  }
  assert.deepEqual(s.ligne('SELECT * FROM mot_cle WHERE id = ?', magique.id), magique);
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

test('service (R196) : un mot-clé cité par une balise ne se supprime pas (409, la liste : l’effet d’une arme, une définition, un événement), rien n’est réécrit ; fusionner recible ; ses balises retirées, il se supprime', () => {
  const s = service();
  const libelleA = s.libre('Essai suppression');
  const libelleB = s.libre('Essai fusion source');
  const idA = s.creerMotCle(libelleA, 'A.');
  const idB = s.creerMotCle(libelleB, 'B.');
  const idC = s.creerMotCle(s.libre('Essai fusion cible'), 'C.');
  // les balises citent les clés (R232 (3))
  const [a, b, c] = [idA, idB, idC].map(s.cle);
  const temoin = s.creerMotCle(s.libre('Essai témoin'), `Voir {{${a}|le A}}, {{${b}|la source}} et {{${b}}}.`);
  // un texte mis en forme : le mode complet et une balise sans texte
  const evenement = s.ok([{ op: 'creer', entite: 'evenement', valeurs: { epoque: 'inconnue', titre: `Essai témoin ${process.pid}`, description: `Le {{${a}:}}, {{${a}}} et {{${b}}}.` } }], 'chronologie/').crees[0].id;
  const description = () => s.ligne('SELECT texte FROM evenement_extrait WHERE evenement_id = ?', evenement).texte;
  const arme = armeSansRecharge(s);
  s.ok([{ op: 'modifier', table: 'arme', cle: { id: arme.id }, valeurs: { effet: `${arme.effet}, {{${a}|Recharge longue}}` } }], 'ressources/armes/');
  assert.equal(s.ligne('SELECT recharge FROM arme WHERE id = ?', arme.id).recharge, 'longue');
  const pageDesArmes = () => s.ligne("SELECT corps_md FROM page WHERE id = 'ressources/armes'").corps_md;
  assert.ok(pageDesArmes().includes(`{{${a}\\|Recharge longue}}`), 'le corps de la page des armes suit (case de tableau : « \\| »)');
  const definitionDuTemoin = s.ligne('SELECT description FROM mot_cle WHERE id = ?', temoin).description;
  assert.equal(definitionDuTemoin, `Voir {{${a}|le A}}, {{${b}|la source}} et {{${b}|${libelleB}}}.`, 'forme canonique d’un texte de case');
  // suppression refusée : la liste des endroits, rien d'écrit (la cascade d'avant R196 est abandonnée)
  const refus = s.lot([{ op: 'supprimer', entite: 'mot_cle', cle: { id: idA } }]);
  assert.equal(refus.statut, 409, JSON.stringify(refus.corps));
  assert.match(refus.corps.erreur, /R196/);
  const endroits = new Set(refus.corps.mentions.map((m) => `${m.table}.${m.colonne}`));
  for (const e of ['arme.effet', 'mot_cle.description', 'evenement_extrait.texte']) assert.ok(endroits.has(e), `${e} dans ${[...endroits]}`);
  assert.ok(refus.corps.mentions.some((m) => m.table === 'mot_cle' && m.cle.id === temoin), 'la définition qui le cite');
  assert.ok(s.ligne('SELECT 1 FROM mot_cle WHERE id = ?', idA));
  assert.deepEqual({ ...s.ligne('SELECT effet, recharge FROM arme WHERE id = ?', arme.id) }, { effet: `${arme.effet}, {{${a}|Recharge longue}}`, recharge: 'longue' });
  assert.equal(s.ligne('SELECT description FROM mot_cle WHERE id = ?', temoin).description, definitionDuTemoin);
  assert.equal(description(), `Le {{${a}:}}, {{${a}}} et {{${b}}}.`);
  // fusion : les balises de la source citent la cible, leur texte gardé
  s.ok([{ op: 'fusionner_mots_cles', mot_cle: idB, dans: idC }]);
  assert.equal(s.ligne('SELECT description FROM mot_cle WHERE id = ?', temoin).description, `Voir {{${a}|le A}}, {{${c}|la source}} et {{${c}|${libelleB}}}.`,
    'un texte de case garde le texte qu’il montrait');
  assert.equal(description(), `Le {{${a}:}}, {{${a}}} et {{${c}}}.`, 'un texte mis en forme suit la cible');
  assert.equal(s.ligne('SELECT 1 FROM mot_cle WHERE id = ?', idB), undefined);
  // ses balises retirées par la personne (la définition réécrite, l'effet remis, l'événement supprimé) : la liste est vide, il se supprime
  s.ok([{ op: 'modifier', table: 'mot_cle', cle: { id: temoin }, valeurs: { description: `Voir {{${c}|la source}}.` } }]);
  s.ok([{ op: 'modifier', table: 'arme', cle: { id: arme.id }, valeurs: { effet: arme.effet } }], 'ressources/armes/');
  s.ok([{ op: 'supprimer', entite: 'evenement', cle: { id: evenement } }], 'chronologie/');
  s.ok([{ op: 'supprimer', entite: 'mot_cle', cle: { id: idA } }]);
  assert.equal(s.ligne('SELECT 1 FROM mot_cle WHERE id = ?', idA), undefined);
  assert.ok(!pageDesArmes().includes(`{{${a}`), 'ni dans le corps de la page des armes');
  // plus aucune balise orpheline dans la base
  const orphelines = [];
  const vocabulaire = vocabulaireDesMotsCles(chargerVocabulaire(s.db));
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
  // par leur id : leur libellé se modifie sur le site de dev (R183 (8) : « Classe » ; décision R195)
  const tags = (page) => s.db.prepare('SELECT tag_id FROM page_tag WHERE page_id = ? ORDER BY ordre').all(page).map((m) => m.tag_id);
  const P = IDS_DES_MOTS_CLES_PROTEGES;
  assert.deepEqual(tags(don), [P['capacite-de-classe']]);
  assert.deepEqual(tags(classe).sort((x, y) => x - y), [P.classe, P.magique].sort((x, y) => x - y));
  assert.deepEqual(s.db.prepare('SELECT id FROM mot_cle ORDER BY id').all().map((m) => m.id), avant);
});
