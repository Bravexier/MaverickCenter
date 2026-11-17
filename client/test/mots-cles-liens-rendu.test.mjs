// Le rendu des mots-clés à adresse et colorés (migration 0098 ; réponses du propriétaire du 2026-11-06, transmises par le leader-technique) :
//   - « une balise dont le mot-clé a une URL est un lien » (clic = son adresse, préfixée de la base du site) ; sans adresse, pas cliquable ; un mot-clé
//     sans définition : en gras et cliquable, sans bulle (Q11) ;
//   - Q5, Q13 (« La couleur inclue la tuile (quand on a la définition complète {{X:}} ) et l'habillage de l'infobulle ») : la classe de la couleur du
//     mot-clé sur sa balise, sur le bloc du mode complet et sur sa bulle ;
//   - pas de lien dans un lien, un bouton, un résumé, une étiquette, une liste ni une bulle (le gras seul) ; un élément [tabindex] garde le lien ;
//   - la page vers laquelle mène un mot-clé coloré prend sa couleur, sinon la sienne d'avant (lib/couleur-de-la-page.mjs) ;
//   - R232 (4), qui remplace R191 : la race et la classe raciale homonymes s'écrivent toutes deux « Orios » sur toutes les pages (plus de suffixe
//     « (classe) ») ; leurs clés (« orios-race », « orios-classe ») les distinguent dans les balises, `data-mot-cle` et l'id de leur bulle.
// La ligne du Glossaire (lib/mots-cles-balises.mjs#htmlDeLaLigneDuGlossaire, son lien et son liseré de couleur) : test/glossaire-tableau.test.mjs.
//   node --test test/mots-cles-liens-rendu.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { reponseAvecMotsCles } from '../src/middleware.mjs';
import { classeDeLaPage } from '../src/lib/couleur-de-la-page.mjs';
import {
  adresseDuMotCle, htmlAvecMotsCles, htmlDeLaBalise, htmlDeLaBulle, lireUneBalise, pageAvecMotsCles, SANS_LIEN, texteSansBalises, vocabulaireDesMotsCles,
} from '../src/lib/mots-cles-balises.mjs';

// des mots-clés d'essai : un id entier, une clé (celle que citent les balises, R232 (3))
const VOCABULAIRE = [
  { id: 1, cle: 'elfe', libelle: 'Elfe', description: 'Un peuple.', url: '/races/elfe/', couleur: 'race:pure' },
  { id: 2, cle: 'feu', libelle: 'Feu', description: 'Brûle.', url: '/magies/magie-du-feu/#sorts', couleur: '#ff4500' },
  { id: 3, cle: 'nain', libelle: 'Nain', description: null, url: '/races/nain/', couleur: null },
  { id: 4, cle: 'mordhau', libelle: 'Mordhau', description: 'Une prise.', url: null, couleur: 'magie:feu' },
  { id: 5, cle: 'ricken-dor', libelle: 'Ricken d’or', description: '100 RF.', monnaie_id: 'ro', synonymes: ['RO'], url: null, couleur: null },
];
const V = vocabulaireDesMotsCles(VOCABULAIRE);
const ID = Object.fromEntries(VOCABULAIRE.map((m) => [m.cle, m.id]));
const balise = (brut) => lireUneBalise(brut);

test('le vocabulaire garde l’adresse et la couleur (NULL sans elles) ; l’adresse d’un lien est préfixée de la base du site', () => {
  assert.deepEqual([V.parCle.get('elfe').url, V.parCle.get('elfe').couleur], ['/races/elfe/', 'race:pure']);
  assert.deepEqual([V.parCle.get('mordhau').url, V.parCle.get('nain').couleur], [null, null]);
  assert.equal(vocabulaireDesMotsCles([{ id: 9, cle: 'x', libelle: 'X', url: '', couleur: '' }]).parId.get(9).url, null, 'vide : sans adresse');
  assert.equal(adresseDuMotCle(V.parCle.get('elfe')), '/races/elfe/');
  assert.equal(adresseDuMotCle(V.parCle.get('elfe'), '/MaverickCenter/'), '/MaverickCenter/races/elfe/');
  assert.equal(adresseDuMotCle(V.parCle.get('elfe'), '/MaverickCenter'), '/MaverickCenter/races/elfe/');
  assert.equal(adresseDuMotCle(V.parCle.get('mordhau'), '/'), null);
});

test('une balise dont le mot-clé a une adresse est un lien (sans tabindex : un lien a le focus) ; sans adresse, du gras qui n’est pas cliquable', () => {
  assert.equal(htmlDeLaBalise(balise('{{elfe|elfes}}'), V, { base: '/M/' }).html,
    '<a class="mot-cle couleur-race-pure" href="/M/races/elfe/" data-mot-cle="elfe" data-bulle="mot-cle-elfe" aria-describedby="mot-cle-elfe" data-balise="{{elfe|elfes}}">elfes</a>');
  assert.equal(htmlDeLaBalise(balise('{{feu}}'), V).html,
    `<a class="mot-cle couleur-mot-cle-${ID.feu}" href="/magies/magie-du-feu/#sorts" data-mot-cle="feu" data-bulle="mot-cle-feu" aria-describedby="mot-cle-feu" data-balise="{{feu}}">Feu</a>`,
    'une couleur écrite : couleur-mot-cle-<id> (l’id entier) ; la clé dans data-mot-cle et l’id de la bulle ; l’ancre de l’adresse gardée');
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
  assert.match(htmlDeLaBulle(ID.elfe, V), /^<span class="bulle couleur-race-pure" role="tooltip" id="mot-cle-elfe" hidden>/);
  assert.match(htmlDeLaBulle(ID.feu, V), new RegExp(`^<span class="bulle couleur-mot-cle-${ID.feu}" role="tooltip"`));
  assert.match(htmlDeLaBulle(ID['ricken-dor'], V), /^<span class="bulle" role="tooltip" id="mot-cle-ricken-dor"/, 'sans couleur : la bulle commune');
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

test('Q5 et R271 : la couleur d’une page est celle du mot-clé coloré qui y mène sans ancre (base retirée), sinon la sienne d’avant ; sans mot-clé ni couleur d’avant, aucune', () => {
  assert.equal(classeDeLaPage(VOCABULAIRE, '/races/elfe/', 'couleur-race-hybride'), 'couleur-race-pure', 'le mot-clé l’emporte');
  assert.equal(classeDeLaPage(VOCABULAIRE, '/MaverickCenter/magies/magie-du-feu/', 'couleur-magie-feu', { base: '/MaverickCenter/' }), 'couleur-magie-feu', 'R271 : un mot-clé qui mène à une section (#sorts) ne colore pas la page');
  assert.equal(classeDeLaPage(VOCABULAIRE, '/MaverickCenter/races/elfe/', 'couleur-race-hybride', { base: '/MaverickCenter/' }), 'couleur-race-pure', 'la base retirée');
  assert.equal(classeDeLaPage(VOCABULAIRE, '/races/nain/', 'couleur-race-pure'), 'couleur-race-pure', 'un mot-clé sans couleur : la couleur d’avant');
  assert.equal(classeDeLaPage(VOCABULAIRE, '/regles/les-degats/'), null, 'ni l’un ni l’autre : l’accent du site');
  assert.equal(classeDeLaPage(null, '/races/elfe/', 'x'), 'x');
});

// R232 (4), qui remplace R191 : les 13 classes raciales « X (classe) » redeviennent « X », avec la catégorie Classe ; leur race garde le libellé « X ».
// Mots-clés d'essai : le libellé se pose ici, il ne se lit pas dans la base.
const HOMONYMES = vocabulaireDesMotsCles([
  ...VOCABULAIRE,
  { id: 11, cle: 'orios-classe', libelle: 'Orios', categories: [6], description: 'Classe raciale ; voir {{orios-race}}.', url: '/classes/orios/', couleur: 'classe:raciales' },
  { id: 12, cle: 'orios-race', libelle: 'Orios', categories: [3], description: 'Une race.', url: '/races/orios/', couleur: null },
]);

test('R232 (4) : deux homonymes s’affichent sous le même libellé partout (balise, tuile, bulle, texte simple, attributs, <option>) — sans suffixe « (classe) » ; leurs clés les distinguent', () => {
  const classe = htmlDeLaBalise(balise('{{orios-classe}}'), HOMONYMES);
  assert.match(classe.html, /^<a class="mot-cle couleur-classe-raciales" href="\/classes\/orios\/" data-mot-cle="orios-classe"[^>]* data-balise="\{\{orios-classe\}\}">Orios<\/a>$/);
  assert.equal(classe.id, 11);
  assert.match(htmlDeLaBalise(balise('{{orios-race}}'), HOMONYMES).html, /data-mot-cle="orios-race" data-bulle="mot-cle-orios-race"[^>]*>Orios<\/a>$/);
  assert.match(htmlDeLaBalise(balise('{{orios-classe:}}'), HOMONYMES).html, /<a class="mot-cle-definition__nom" href="\/classes\/orios\/">Orios<\/a> : <span class="mot-cle-definition__texte">Classe raciale ; voir Orios\.<\/span>/);
  assert.match(htmlDeLaBulle(11, HOMONYMES), /id="mot-cle-orios-classe" hidden><strong class="bulle__titre">Orios<\/strong><span class="bulle__texte">Classe raciale ; voir Orios\.<\/span>/);
  assert.match(htmlDeLaBulle(12, HOMONYMES), /id="mot-cle-orios-race" hidden><strong class="bulle__titre">Orios<\/strong>/);
  assert.equal(texteSansBalises('{{orios-classe}} et {{orios-race}}', HOMONYMES), 'Orios et Orios');
  // une page entière, quelle que soit son adresse : aucun « (classe) », une bulle par homonyme
  const source = '<html><head><title>{{orios-classe}}</title></head><body><p title="{{orios-classe}}">{{orios-classe}}, {{orios-race}} et {{orios-classe:}}</p>'
    + '<select><option>{{orios-classe}}</option></select><button>{{orios-classe}}</button></body></html>';
  const page = pageAvecMotsCles(source, HOMONYMES);
  assert.doesNotMatch(page, /\(classe\)/i);
  assert.equal((page.match(/role="tooltip"/g) ?? []).length, 2, 'une bulle par homonyme');
  assert.match(page, /<title>Orios<\/title>/);
  assert.match(page, /<option>Orios<\/option>/);
});

test('R232 (4) : le middleware rend toutes les pages de la même façon (plus d’exception pour le Glossaire, la Recherche ni Données)', async () => {
  const source = '<html><body><p>{{orios-classe}}</p></body></html>';
  const suite = async () => new Response(source, { headers: { 'content-type': 'text/html' } });
  const rendu = await (await reponseAvecMotsCles(suite, HOMONYMES.liste)).text();
  assert.match(rendu, /<strong class="bulle__titre">Orios<\/strong>/);
  assert.equal(rendu, pageAvecMotsCles(source, HOMONYMES));
});
