// Le rendu des mots-clés à adresse et colorés (migration 0098 ; réponses du propriétaire du 2026-11-06, transmises par le leader-technique) :
//   - « une balise dont le mot-clé a une URL est un lien » (clic = son adresse, préfixée de la base du site) ; sans adresse, pas cliquable ; un mot-clé
//     sans définition : en gras et cliquable, sans bulle (Q11) ;
//   - Q5, Q13 (« La couleur inclue la tuile (quand on a la définition complète {{X:}} ) et l'habillage de l'infobulle ») : la classe de la couleur du
//     mot-clé sur sa balise, sur le bloc du mode complet et sur sa bulle ;
//   - pas de lien dans un lien, un bouton, un résumé, une étiquette, une liste ni une bulle (le gras seul) ; un élément [tabindex] garde le lien ;
//   - la page vers laquelle mène un mot-clé coloré prend sa couleur, sinon la sienne d'avant (lib/couleur-de-la-page.mjs) ;
//   - la ligne du Glossaire (lib/mots-cles-balises.mjs#htmlDeLaLigneDuGlossaire).
//   node --test test/mots-cles-liens-rendu.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { reponseAvecMotsCles } from '../src/middleware.mjs';
import { classeDeLaPage } from '../src/lib/couleur-de-la-page.mjs';
import {
  adresseDuMotCle, htmlAvecMotsCles, htmlDeLaBalise, htmlDeLaBulle, htmlDeLaLigneDuGlossaire, lireUneBalise, pageAvecMotsCles, SANS_LIEN,
  vocabulaireDesMotsCles,
} from '../src/lib/mots-cles-balises.mjs';

const VOCABULAIRE = [
  { id: 'elfe', libelle: 'Elfe', description: 'Un peuple.', url: '/races/elfe/', couleur: 'race:pure' },
  { id: 'feu', libelle: 'Feu', description: 'Brûle.', url: '/magies/magie-du-feu/#sorts', couleur: '#ff4500' },
  { id: 'nain', libelle: 'Nain', description: null, url: '/races/nain/', couleur: null },
  { id: 'mordhau', libelle: 'Mordhau', description: 'Une prise.', url: null, couleur: 'magie:feu' },
  { id: 'ro', libelle: 'Ricken d’or', description: '100 RF.', abreviation: 'RO', url: null, couleur: null },
];
const V = vocabulaireDesMotsCles(VOCABULAIRE);
const balise = (brut) => lireUneBalise(brut);

test('le vocabulaire garde l’adresse et la couleur (NULL sans elles) ; l’adresse d’un lien est préfixée de la base du site', () => {
  assert.deepEqual([V.parId.get('elfe').url, V.parId.get('elfe').couleur], ['/races/elfe/', 'race:pure']);
  assert.deepEqual([V.parId.get('mordhau').url, V.parId.get('nain').couleur], [null, null]);
  assert.equal(vocabulaireDesMotsCles([{ id: 'x', libelle: 'X', url: '', couleur: '' }]).parId.get('x').url, null, 'vide : sans adresse');
  assert.equal(adresseDuMotCle(V.parId.get('elfe')), '/races/elfe/');
  assert.equal(adresseDuMotCle(V.parId.get('elfe'), '/MaverickCenter/'), '/MaverickCenter/races/elfe/');
  assert.equal(adresseDuMotCle(V.parId.get('elfe'), '/MaverickCenter'), '/MaverickCenter/races/elfe/');
  assert.equal(adresseDuMotCle(V.parId.get('mordhau'), '/'), null);
});

test('une balise dont le mot-clé a une adresse est un lien (sans tabindex : un lien a le focus) ; sans adresse, du gras qui n’est pas cliquable', () => {
  assert.equal(htmlDeLaBalise(balise('{{elfe|elfes}}'), V, { base: '/M/' }).html,
    '<a class="mot-cle couleur-race-pure" href="/M/races/elfe/" data-mot-cle="elfe" data-bulle="mot-cle-elfe" aria-describedby="mot-cle-elfe" data-balise="{{elfe|elfes}}">elfes</a>');
  assert.equal(htmlDeLaBalise(balise('{{feu}}'), V).html,
    '<a class="mot-cle couleur-mot-cle-feu" href="/magies/magie-du-feu/#sorts" data-mot-cle="feu" data-bulle="mot-cle-feu" aria-describedby="mot-cle-feu" data-balise="{{feu}}">Feu</a>',
    'une couleur écrite : couleur-mot-cle-<id> ; l’ancre de l’adresse gardée');
  // sans adresse : comme avant, la couleur en plus
  assert.equal(htmlDeLaBalise(balise('{{mordhau}}'), V).html,
    '<strong class="mot-cle couleur-magie-feu" data-mot-cle="mordhau" data-bulle="mot-cle-mordhau" aria-describedby="mot-cle-mordhau" tabindex="0" data-balise="{{mordhau}}">Mordhau</strong>');
  // Q11 : sans définition, en gras et cliquable, sans bulle
  const nain = htmlDeLaBalise(balise('{{nain}}'), V);
  assert.equal(nain.html, '<a class="mot-cle" href="/races/nain/" data-mot-cle="nain" data-balise="{{nain}}">Nain</a>');
  assert.equal(nain.id, null, 'aucune bulle à poser');
  // sansLien : le gras seul, la bulle gardée (sauf dans un bouton)
  assert.match(htmlDeLaBalise(balise('{{elfe}}'), V, { sansLien: true, sansFocus: true }).html, /^<strong class="mot-cle couleur-race-pure" data-mot-cle="elfe" data-bulle="mot-cle-elfe"/);
  assert.doesNotMatch(htmlDeLaBalise(balise('{{elfe}}'), V, { sansLien: true }).html, /href/);
});

test('Q13 : la tuile du mode complet porte la couleur, son nom est le lien ; la bulle d’un mot-clé coloré porte sa classe (habillage)', () => {
  assert.equal(htmlDeLaBalise(balise('{{elfe:}}'), V).html,
    '<span class="mot-cle-definition couleur-race-pure" data-mot-cle="elfe" data-balise="{{elfe:}}"><a class="mot-cle-definition__nom" href="/races/elfe/">Elfe</a> : <span class="mot-cle-definition__texte">Un peuple.</span></span>');
  assert.match(htmlDeLaBalise(balise('{{mordhau:}}'), V).html, /^<span class="mot-cle-definition couleur-magie-feu" data-mot-cle="mordhau" data-balise="\{\{mordhau:\}\}"><strong class="mot-cle-definition__nom">Mordhau<\/strong>/);
  assert.match(htmlDeLaBulle('elfe', V), /^<span class="bulle couleur-race-pure" role="tooltip" id="mot-cle-elfe" hidden>/);
  assert.match(htmlDeLaBulle('feu', V), /^<span class="bulle couleur-mot-cle-feu" role="tooltip"/);
  assert.match(htmlDeLaBulle('ro', V), /^<span class="bulle" role="tooltip" id="mot-cle-ro"/, 'sans couleur : la bulle commune');
});

test('pas de lien dans un lien, un bouton, un résumé, une étiquette, une liste ni une bulle ; un élément [tabindex] garde le lien ; la base passée', () => {
  assert.deepEqual([...SANS_LIEN], ['a', 'button', 'summary', 'label', 'select']);
  const rendu = (html) => htmlAvecMotsCles(html, V, { base: '/M/' }).html;
  for (const [ouvre, ferme] of [['<a href="/x/">', '</a>'], ['<button>', '</button>'], ['<details><summary>', '</summary></details>'], ['<label>', '</label>'],
    ['<span class="bulle" id="b">', '</span>']]) {
    const html = rendu(`<p>${ouvre}{{elfe}}${ferme}</p>`);
    assert.match(html, /<strong class="mot-cle couleur-race-pure" data-mot-cle="elfe"/, ouvre);
    assert.doesNotMatch(html, /href="\/M\/races/, ouvre);
  }
  assert.match(rendu('<p><span tabindex="0">{{elfe}}</span></p>'), /<a class="mot-cle couleur-race-pure" href="\/M\/races\/elfe\/" data-mot-cle="elfe" data-bulle="mot-cle-elfe" aria-describedby="mot-cle-elfe" data-balise/);
  assert.match(rendu('<p>{{elfe}} puis <a href="/y/">x</a> {{elfe}}</p>'), /<a class="mot-cle[^>]*>Elfe<\/a> puis <a href="\/y\/">x<\/a> <a class="mot-cle/, 'hors du lien : de nouveau un lien');
  // la page entière : la bulle posée avant </body>, avec la couleur
  const page = pageAvecMotsCles('<html><body><p>{{elfe}}</p></body></html>', V, { base: '/M/' });
  assert.match(page, /href="\/M\/races\/elfe\/"/);
  assert.match(page, /<span class="bulle couleur-race-pure" role="tooltip" id="mot-cle-elfe" hidden>.*<\/span><\/body>/);
});

test('le middleware passe la base du site aux liens des mots-clés', async () => {
  const suite = async () => new Response('<html><body><p>{{elfe}}</p></body></html>', { headers: { 'content-type': 'text/html' } });
  const r = await reponseAvecMotsCles(suite, VOCABULAIRE, { base: '/MaverickCenter/' });
  assert.match(await r.text(), /<a class="mot-cle couleur-race-pure" href="\/MaverickCenter\/races\/elfe\/"/);
  const sansBase = await reponseAvecMotsCles(suite, VOCABULAIRE);
  assert.match(await sansBase.text(), /href="\/races\/elfe\/"/, 'sans base : la racine');
});

test('Q5 : la couleur d’une page est celle du mot-clé coloré qui y mène (ancre ignorée, base retirée), sinon la sienne d’avant ; sans mot-clé ni couleur d’avant, aucune', () => {
  assert.equal(classeDeLaPage(VOCABULAIRE, '/races/elfe/', 'couleur-race-hybride'), 'couleur-race-pure', 'le mot-clé l’emporte');
  assert.equal(classeDeLaPage(VOCABULAIRE, '/MaverickCenter/magies/magie-du-feu/', 'couleur-magie-feu', { base: '/MaverickCenter/' }), 'couleur-mot-cle-feu');
  assert.equal(classeDeLaPage(VOCABULAIRE, '/races/nain/', 'couleur-race-pure'), 'couleur-race-pure', 'un mot-clé sans couleur : la couleur d’avant');
  assert.equal(classeDeLaPage(VOCABULAIRE, '/regles/les-degats/'), null, 'ni l’un ni l’autre : l’accent du site');
  assert.equal(classeDeLaPage(null, '/races/elfe/', 'x'), 'x');
});

test('Q6, Q7 : la ligne du Glossaire — libellé (lien s’il a une adresse), abréviation (pas d’une monnaie, R63), pastille de sa couleur, définition, pages', () => {
  const options = { base: '/M/', lienDesPages: '/M/recherche/?mot-cle=' };
  const elfe = htmlDeLaLigneDuGlossaire({ ...V.parId.get('elfe'), abreviation: 'EL', n: 3 }, options);
  assert.equal(elfe, '<li class="glossaire-mot" data-id="elfe" data-cle="elfe" data-n="3" data-libelle="Elfe" data-abreviation="EL" data-definition="Un peuple." data-url="/races/elfe/" data-couleur="race:pure">'
    + '<span class="glossaire-mot__pastille couleur-race-pure" aria-hidden="true"></span>'
    + '<span class="glossaire-mot__tete"><a class="glossaire-mot__nom" href="/M/races/elfe/">Elfe</a> <span class="glossaire-mot__abreviation">EL</span>'
    + ' <a class="glossaire-mot__pages" href="/M/recherche/?mot-cle=elfe">3 pages</a></span>'
    + '<span class="glossaire-mot__definition">Un peuple.</span></li>');
  // sans adresse ni définition ni couleur : le libellé en gras, « Pas encore de définition. », aucune page
  const sans = htmlDeLaLigneDuGlossaire({ id: 'x', libelle: 'X <b>', libelle_cle: 'x-b', description: null, n: 0 }, options);
  assert.match(sans, /^<li class="glossaire-mot" data-id="x" data-cle="x-b" data-n="0" data-libelle="X &lt;b&gt;">/);
  assert.match(sans, /<span class="glossaire-mot__pastille" aria-hidden="true"><\/span><span class="glossaire-mot__tete"><strong class="glossaire-mot__nom">X &lt;b&gt;<\/strong> <a class="glossaire-mot__pages" href="\/M\/recherche\/\?mot-cle=x">aucune page<\/a>/);
  assert.match(sans, /glossaire-mot__definition--vide">Pas encore de définition\.<\/span><\/li>$/);
  assert.match(htmlDeLaLigneDuGlossaire({ id: 'y', libelle: 'Y', pages: 1 }, options), />1 page<\/a>/, '`pages` (le service) vaut `n`');
  // une monnaie : son icône, aucune abréviation visible ; sa définition, monnaies en icônes ; ses balises gardées pour le middleware
  const ro = htmlDeLaLigneDuGlossaire({ ...V.parId.get('ro'), description: 'Vaut 5 RF, voir {{elfe}}.', n: 1 }, options);
  assert.ok(ro.includes('piece--ro') && !ro.includes('glossaire-mot__abreviation'), ro);
  assert.ok(ro.includes('{{elfe}}') && ro.includes('piece--rf'), ro);
});
