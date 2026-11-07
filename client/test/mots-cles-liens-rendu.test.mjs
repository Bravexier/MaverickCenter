// Le rendu des mots-clés à adresse et colorés (migration 0098 ; réponses du propriétaire du 2026-11-06, transmises par le leader-technique) :
//   - « une balise dont le mot-clé a une URL est un lien » (clic = son adresse, préfixée de la base du site) ; sans adresse, pas cliquable ; un mot-clé
//     sans définition : en gras et cliquable, sans bulle (Q11) ;
//   - Q5, Q13 (« La couleur inclue la tuile (quand on a la définition complète {{X:}} ) et l'habillage de l'infobulle ») : la classe de la couleur du
//     mot-clé sur sa balise, sur le bloc du mode complet et sur sa bulle ;
//   - pas de lien dans un lien, un bouton, un résumé, une étiquette, une liste ni une bulle (le gras seul) ; un élément [tabindex] garde le lien ;
//   - la page vers laquelle mène un mot-clé coloré prend sa couleur, sinon la sienne d'avant (lib/couleur-de-la-page.mjs) ;
//   - la ligne du Glossaire (lib/mots-cles-balises.mjs#htmlDeLaLigneDuGlossaire) ;
//   - R191 : le mot-clé d'une classe raciale s'écrit « Orios (classe) » (Q14), mais hors des pages Glossaire, Recherche et Données il s'affiche sous le
//     nom seul, titre de sa bulle compris (libelleAffiche, libelleEntierSur, option `libelleEntier` du rendu et du middleware).
//   node --test test/mots-cles-liens-rendu.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { optionsDeLaPage, reponseAvecMotsCles } from '../src/middleware.mjs';
import { classeDeLaPage } from '../src/lib/couleur-de-la-page.mjs';
import {
  adresseDuMotCle, htmlAvecMotsCles, htmlDeLaBalise, htmlDeLaBulle, htmlDeLaLigneDuGlossaire, libelleAffiche, libelleEntierSur, lireUneBalise,
  PAGES_AU_LIBELLE_ENTIER, pageAvecMotsCles, SANS_LIEN, texteSansBalises, vocabulaireDesMotsCles,
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

// R191 (seconde réponse du propriétaire : « « Orios » (Recommandé) » — « Hors des trois pages, on affiche le nom sans le suffixe « (classe) », y compris
// dans le titre de l'infobulle, puisque le suffixe y reste interdit. »). Mots-clés d'essai : le libellé se pose ici, il ne se lit pas dans la base.
const CLASSES = vocabulaireDesMotsCles([
  ...VOCABULAIRE,
  { id: 'orios-classe', libelle: 'Orios (classe)', description: 'Classe raciale ; voir {{goleois-classe}}.', url: '/classes/orios/', couleur: 'classe:raciales' },
  { id: 'goleois-classe', libelle: 'Goleois (Classe) ', description: null, url: '/classes/goleois/', couleur: null },
  { id: 'orios', libelle: 'Orios', description: 'Une race.', url: '/races/orios/', couleur: null },
]);

test('R191 : les trois pages au libellé entier (Glossaire, Recherche, Données et ses sous-pages), base du site retirée ; aucune autre', () => {
  assert.deepEqual([...PAGES_AU_LIBELLE_ENTIER], ['/regles/glossaire/', '/recherche/', '/donnees/']);
  for (const chemin of ['/regles/glossaire/', '/regles/glossaire', '/recherche/', '/recherche/?mot-cle=orios-classe', '/recherche/index.html', '/donnees/',
    '/donnees/mot_cle/', '/donnees/v_mot_cle/index.html']) assert.equal(libelleEntierSur(chemin), true, chemin);
  assert.equal(libelleEntierSur('/MaverickCenter/regles/glossaire/', { base: '/MaverickCenter/' }), true, 'la base retirée');
  assert.equal(libelleEntierSur('/MaverickCenter/donnees/mot_cle/', { base: '/MaverickCenter' }), true);
  for (const chemin of ['/', '', '/classes/orios/', '/races/orios/', '/regles/', '/regles/glossaire-bis/', '/regles/lexique/', '/recherches/',
    '/donnees-x/', '/guide/recherche/', '/MaverickCenter/classes/orios/']) assert.equal(libelleEntierSur(chemin, { base: '/MaverickCenter/' }), false, chemin);
  assert.deepEqual(optionsDeLaPage(new URL('http://x/MaverickCenter/recherche/'), '/MaverickCenter/'), { base: '/MaverickCenter/', libelleEntier: true });
  assert.deepEqual(optionsDeLaPage(new URL('http://x/classes/orios/')), { base: '/', libelleEntier: false });
  assert.deepEqual(optionsDeLaPage(undefined), { base: '/', libelleEntier: false }, 'sans adresse : hors des trois pages');
});

test('R191 : libelleAffiche — le suffixe final « (classe) » retiré hors des trois pages, quelle que soit la casse ; rien d’autre ne change', () => {
  assert.equal(libelleAffiche({ libelle: 'Orios (classe)' }), 'Orios');
  assert.equal(libelleAffiche({ libelle: 'Goleois (Classe) ' }), 'Goleois');
  assert.equal(libelleAffiche({ libelle: 'Orios (classe)' }, { entier: true }), 'Orios (classe)');
  for (const libelle of ['Orios', 'Classe', 'Niveau de classe', '(classe) Orios', 'Orios (classes)', 'Orios (classe) bis']) {
    assert.equal(libelleAffiche({ libelle }), libelle, libelle);
  }
  assert.equal(libelleAffiche({ libelle: '(classe)' }), '(classe)', 'un libellé qui ne serait que le suffixe reste tel quel');
});

test('R191 : hors des trois pages, la balise sans texte, le mode complet (tuile), la bulle (titre et définition) et le texte simple montrent le nom seul', () => {
  const sans = htmlDeLaBalise(balise('{{orios-classe}}'), CLASSES);
  assert.match(sans.html, /^<a class="mot-cle couleur-classe-raciales" href="\/classes\/orios\/" data-mot-cle="orios-classe"[^>]* data-balise="\{\{orios-classe\}\}">Orios<\/a>$/);
  assert.match(htmlDeLaBalise(balise('{{orios-classe}}'), CLASSES, { libelleEntier: true }).html, />Orios \(classe\)<\/a>$/, 'sur les trois pages : entier');
  assert.match(htmlDeLaBalise(balise('{{orios-classe|la classe Orios (classe)}}'), CLASSES).html, />la classe Orios \(classe\)<\/a>$/, 'un texte écrit reste tel qu’écrit');
  const complet = htmlDeLaBalise(balise('{{orios-classe:}}'), CLASSES).html;
  assert.match(complet, /<a class="mot-cle-definition__nom" href="\/classes\/orios\/">Orios<\/a> : <span class="mot-cle-definition__texte">Classe raciale ; voir Goleois\.<\/span>/);
  assert.match(htmlDeLaBalise(balise('{{orios-classe:}}'), CLASSES, { libelleEntier: true }).html, />Orios \(classe\)<\/a> : <span class="mot-cle-definition__texte">Classe raciale ; voir Goleois \(Classe\)\.?/);
  assert.match(htmlDeLaBulle('orios-classe', CLASSES), /<strong class="bulle__titre">Orios<\/strong><span class="bulle__texte">Classe raciale ; voir Goleois\.<\/span>/);
  assert.match(htmlDeLaBulle('orios-classe', CLASSES, { libelleEntier: true }), /<strong class="bulle__titre">Orios \(classe\)<\/strong>/);
  // le texte simple : entier par défaut (JSON, recherche, découpages) ; sans le suffixe à la demande
  assert.equal(texteSansBalises('{{orios-classe}} et {{orios}}', CLASSES), 'Orios (classe) et Orios');
  assert.equal(texteSansBalises('{{orios-classe}} et {{orios}}', CLASSES, { libelleEntier: false }), 'Orios et Orios');
});

test('R191 : une page entière hors des trois — ni balise, ni attribut, ni <title>, ni <option>, ni bulle n’écrit « (classe) » ; sur les trois, le libellé entier', async () => {
  const source = '<html><head><title>{{orios-classe}}</title></head><body><p title="{{orios-classe}}">{{orios-classe}} et {{orios-classe:}}</p>'
    + '<select><option>{{orios-classe}}</option></select><button>{{orios-classe}}</button></body></html>';
  const ailleurs = pageAvecMotsCles(source, CLASSES);
  assert.doesNotMatch(ailleurs.replace(/data-balise="[^"]*"/g, ''), /\(classe\)/i, ailleurs);
  assert.match(ailleurs, /<span class="bulle couleur-classe-raciales" role="tooltip" id="mot-cle-orios-classe" hidden><strong class="bulle__titre">Orios<\/strong>/);
  const ici = pageAvecMotsCles(source, CLASSES, { libelleEntier: true });
  assert.equal((ici.replace(/data-balise="[^"]*"/g, '').match(/Orios \(classe\)/g) ?? []).length, 7, 'titre, attribut, balise, tuile, option, bouton, bulle');
  // le middleware : d'après l'adresse de la page (optionsDeLaPage)
  const suite = async () => new Response(source, { headers: { 'content-type': 'text/html' } });
  const lu = async (chemin) => (await reponseAvecMotsCles(suite, CLASSES.liste, optionsDeLaPage(new URL(`http://x${chemin}`)))).text();
  assert.doesNotMatch((await lu('/classes/orios/')).replace(/data-balise="[^"]*"/g, ''), /\(classe\)/i);
  for (const chemin of ['/regles/glossaire/', '/recherche/', '/donnees/mot_cle/']) assert.match(await lu(chemin), /<strong class="bulle__titre">Orios \(classe\)<\/strong>/, chemin);
});
