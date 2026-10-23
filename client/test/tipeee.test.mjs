// La partie « Bienvenue » de Tipeee (réponses du propriétaire du 2026-10-22 : « autant en faire un hook pour que ça reprenne directement le texte au
// cas où il change sur Tipee » ; « La partie « Bienvenue » ») : l'extraction pure de lib/tipeee.mjs, d'une réponse de l'API à des paragraphes de
// texte seul — sur une réponse d'exemple (test/fixtures/tipeee-projet.json : la réponse lue le 2026-10-22, réduite au premier titre et à la partie
// « Bienvenue ») et sur les cas de refus : repère absent, HTML vide, réponse invalide, texte trop long.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  CARACTERES_MAX, CHEMIN_INSTANTANE, PARAGRAPHES_MAX, RAISONS, REPERE, URL_API, URL_PAGE, bienvenueDeTipeee, decoderEntites, depuisLeRepere, instantaneDe,
  instantaneValide, memesParagraphes, paragraphesDuHtml,
} from '../src/lib/tipeee.mjs';

const EXEMPLE = readFileSync(new URL('./fixtures/tipeee-projet.json', import.meta.url), 'utf8');
const avecHtml = (html) => ({ contentv2: { translations: { fr: { html } } } });

/** La partie « Bienvenue » telle que Tipeee l'écrit (réponse du 2026-10-22). */
const BIENVENUE = [
  'Bienvenue sur le Tipeee de MaverickJDR !',
  'Je suis heureux de vous ouvrir les coulisses de mon univers.\nIci, vous pourrez découvrir des informations inédites sur Maverick, rejoindre directement le Discord pour partager la passion du jeu de rôle et même participer à l’évolution de l’univers. Vous y trouverez aussi des aperçus exclusifs… ainsi que quelques conseils pour les MJ en herbe que vous êtes peut être, sous la forme de petites fiches.',
  'Ce Tipeee fonctionne comme un chapeau virtuel : si vous souhaitez et pouvez soutenir le projet, votre nom sera inscrit dans le marbre des futurs livres consacrés à MaverickJDR, ainsi que sur le tableau des donateurs du serveur Discord officiel.',
];

test('adresses et repère fixes : l’API publique du projet, la page, le début de la partie reprise, l’instantané dans sources/', () => {
  assert.equal(URL_API, 'https://api.tipeee.com/v2.0/projects/maverickjdr');
  assert.equal(URL_PAGE, 'https://fr.tipeee.com/maverickjdr');
  assert.equal(REPERE, 'Bienvenue sur le Tipeee de MaverickJDR !');
  assert.equal(CHEMIN_INSTANTANE, 'sources/tipeee/bienvenue.json');
});

test('réponse d’exemple : depuis « Bienvenue sur le Tipeee de MaverickJDR ! » jusqu’à la fin, trois paragraphes de texte, sans image, sans style, sans le titre d’avant', () => {
  for (const reponse of [EXEMPLE, JSON.parse(EXEMPLE)]) {
    const r = bienvenueDeTipeee(reponse);
    assert.deepEqual(r, { paragraphes: BIENVENUE });
  }
  const texte = BIENVENUE.join('\n');
  assert.ok(!/[<>]|emojione|style|rgb\(|https?:/.test(texte), texte);
  assert.ok(!texte.includes('Bien le bonjour'), 'le titre d’avant le repère n’est pas repris');
  // l'insécable de fin (« MaverickJDR !  ») rogné ; les autres espaces réduits comme dans un navigateur
  assert.ok(BIENVENUE.every((p) => p === p.trim() && !/ {2}/.test(p)));
  assert.ok(texte.length > 550 && texte.length < 750, `environ 600 caractères : ${texte.length}`);
});

test('paragraphes : un bloc par paragraphe ; un <br> seul, un retour à la ligne ; deux <br> de suite, deux paragraphes ; lignes et paragraphes vides retirés', () => {
  assert.deepEqual(paragraphesDuHtml('<p>un<br>deux</p><p> </p><div><br/></div><div>trois<br /> <br/>quatre</div>cinq<h2>six</h2><li>sept</li>'),
    ['un\ndeux', 'trois', 'quatre', 'cinq', 'six', 'sept']);
  assert.deepEqual(paragraphesDuHtml('<span>a</span><b> b </b>\n\t<i>c</i><br>'), ['a b c']);
  assert.deepEqual(paragraphesDuHtml('<P>Majuscules<BR>aussi</P>'), ['Majuscules\naussi']);
  assert.deepEqual(paragraphesDuHtml(''), []);
  assert.deepEqual(paragraphesDuHtml(null), []);
});

test('rien que du texte : images, styles, scripts, cadres et commentaires retirés ; un attribut qui contient « > » ne coupe pas la balise', () => {
  const html = '<style>p { color: red }</style><script>alert("x")</script><!-- note --><iframe src="https://x"><p>dedans</p></iframe>'
    + '<p style="a>b" title=\'c>d\'>Texte <img src="x.png" alt="😀" onerror="alert(1)"> gardé<svg><text>dessin</text></svg></p><script>non fermé';
  assert.deepEqual(paragraphesDuHtml(html), ['Texte gardé']);
  // ce qui ressemble à une balise sans en être une reste du texte (la page le pose en textContent)
  assert.deepEqual(paragraphesDuHtml('<p>a < b et c > d</p>'), ['a < b et c > d']);
});

test('entités HTML décodées en une passe ; une entité inconnue reste telle qu’écrite ; l’insécable reste', () => {
  assert.equal(decoderEntites('&eacute;t&eacute; &#233;&#xE9; l&rsquo;&eacute;l&egrave;ve &laquo;&nbsp;oui&nbsp;&raquo; &hellip;'), 'été éé l’élève « oui » …');
  assert.equal(decoderEntites('&amp;lt; &lt;b&gt; &inconnue; &#0; &#xD800;'), '&lt; <b> &inconnue; � �');
  assert.deepEqual(paragraphesDuHtml('<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>'), ['<script>alert(1)</script>'], 'du texte, jamais une balise');
  assert.deepEqual(paragraphesDuHtml('<p>a&nbsp;!&#10;b</p>'), ['a ! b']);
});

test('repère retrouvé sans tenir compte de la casse ni des espaces, même au milieu d’un paragraphe (coupé juste avant lui)', () => {
  const r = bienvenueDeTipeee(avecHtml('<p>Avant.</p><p>Fin du texte d’avant. <b>BIENVENUE   sur le<br>Tipeee de maverickJDR&nbsp;!</b> Suite</p><p>Après</p>'));
  assert.deepEqual(r, { paragraphes: ['BIENVENUE sur le\nTipeee de maverickJDR ! Suite', 'Après'] });
  assert.deepEqual(depuisLeRepere(['x', 'BienvenueSurLeTipeeeDeMaverickJDR!']), ['BienvenueSurLeTipeeeDeMaverickJDR!']);
  assert.equal(depuisLeRepere(['Bienvenue sur le Tipeee', 'de MaverickJDR !']), null, 'un repère coupé entre deux paragraphes n’est pas retrouvé');
});

test('refus : repère absent, HTML vide, réponse invalide, texte au-delà des bornes — chacun avec sa raison', () => {
  const raison = (reponse) => {
    const r = bienvenueDeTipeee(reponse);
    assert.equal(r.paragraphes, undefined);
    assert.equal(r.message, RAISONS[r.raison]);
    return r.raison;
  };
  assert.equal(raison(avecHtml('<p>Bien le bonjour !</p><p>Bienvenue sur Tipeee</p>')), 'repere-absent');
  for (const html of ['', '<div><br /></div><p> </p>', '<img src="x.png">']) assert.equal(raison(avecHtml(html)), 'html-vide', html);
  for (const r of ['pas du JSON', '{"contentv2": {}}', '', null, undefined, 3, [], {}, avecHtml(3), { contentv2: { translations: { en: { html: '<p>x</p>' } } } }]) {
    assert.equal(raison(r), 'reponse-invalide', JSON.stringify(r));
  }
  const long = `<p>${REPERE}</p><p>${'a'.repeat(CARACTERES_MAX)}</p>`;
  assert.equal(raison(avecHtml(long)), 'texte-trop-long');
  assert.equal(raison(avecHtml(`<p>${REPERE}</p>${'<p>x</p>'.repeat(PARAGRAPHES_MAX)}`)), 'texte-trop-long');
  assert.deepEqual(bienvenueDeTipeee(avecHtml(`<p>${REPERE}</p>${'<p>x</p>'.repeat(PARAGRAPHES_MAX - 1)}`)).paragraphes.length, PARAGRAPHES_MAX);
});

test('instantané : { url, lu_le, paragraphes } validé ; fait d’une réponse ; comparaison des paragraphes', () => {
  const ok = { url: URL_API, lu_le: '2026-10-22T12:00:00Z', paragraphes: BIENVENUE };
  assert.deepEqual(instantaneValide(ok), ok);
  assert.deepEqual(instantaneValide({ ...ok, autre: 1 }), ok, 'une clé de plus est ignorée');
  for (const mauvais of [null, [], 'x', { ...ok, url: '' }, { ...ok, lu_le: 'hier' }, { ...ok, lu_le: undefined }, { ...ok, paragraphes: [] }, { ...ok, paragraphes: ['a', ' '] },
    { ...ok, paragraphes: ['a', 3] }, { ...ok, paragraphes: 'a' }, { ...ok, paragraphes: ['a'.repeat(CARACTERES_MAX + 1)] }]) {
    assert.equal(instantaneValide(mauvais), null, JSON.stringify(mauvais)?.slice(0, 80));
  }
  assert.deepEqual(instantaneDe(EXEMPLE, '2026-10-22T12:00:00Z'), ok);
  assert.equal(instantaneDe(avecHtml('<p>rien</p>'), '2026-10-22T12:00:00Z').raison, 'repere-absent');
  assert.ok(memesParagraphes(BIENVENUE, [...BIENVENUE]));
  assert.ok(!memesParagraphes(BIENVENUE, BIENVENUE.slice(1)));
  assert.ok(!memesParagraphes(BIENVENUE, [...BIENVENUE.slice(0, 2), 'autre']));
  assert.ok(!memesParagraphes(null, BIENVENUE));
});
