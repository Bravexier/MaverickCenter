// Corps et résumé de la page d'un métier recalculés depuis sa ligne de `metier` (lib/corps-metiers.mjs ; défaut D4 de l'édition du site de dev).
// 1. Validation sur toute la base construite depuis data/rows : le rendu complet redonne chaque corps sans ses [[liens]] (et à l'octet près sans lien),
//    remplacer un champ par sa propre valeur redonne le corps à l'octet près, le résumé est celui de la page.
// 2. Cas de modification synthétiques : valeur sur plusieurs paragraphes (l'Herboriste : plus de paragraphe orphelin), champ vidé, ajouté, retiré,
//    Markdown dans une valeur, retours à la ligne Windows, liens reposés, corps en retard, texte hors des champs.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createMarkdownProcessor } from '@astrojs/markdown-remark';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { extractLinks } from '../src/lib/wikilinks.mjs';
import * as corpsMetiers from '../src/lib/corps-metiers.mjs';
import * as metierChamps from '../src/lib/metier-champs.mjs';
import { formesNonCanoniques } from '../src/lib/mots-cles-balises.mjs';

const {
  CHAMPS_DU_CORPS, SOURCE_DES_LIENS, champAJour, champDuCorps, champsDuCorps, corpsApres, corpsDeMetier, markdownDeValeur, pageDuMetier,
  remplacerChampDuCorps, resumeDuMetier, sansLiens,
} = corpsMetiers;

const db = ouvrirBase({ sansExemples: false });
/** Les métiers de la base : { ligne (la ligne de metier), corps (page.corps_md), resume (page.resume) }. */
const metiers = db
  .prepare('SELECT m.*, p.resume AS page_resume, p.corps_md AS page_corps FROM metier m JOIN page p ON p.id = m.id ORDER BY m.id')
  .all()
  .map(({ page_resume, page_corps, ...ligne }) => ({ id: ligne.id, ligne, corps: page_corps, resume: page_resume }));
const LIBELLES = CHAMPS_DU_CORPS.map((c) => c.libelle);
const aDesLiens = (corps) => new RegExp(SOURCE_DES_LIENS).test(corps);
/** Le métier de l'Herboriste (essai réel du défaut), ou à défaut le premier. */
const herboriste = metiers.find((m) => m.id === 'metiers/herboriste') ?? metiers[0];

// ---------------------------------------------------------------------------------------------------------------------------------------------
// 1. Toute la base
// ---------------------------------------------------------------------------------------------------------------------------------------------

test('base : chaque ligne de metier a sa page, et seule « Règles des métiers » est une page de métier sans ligne', () => {
  assert.equal(metiers.length, db.prepare('SELECT count(*) AS n FROM metier').get().n);
  assert.ok(metiers.length > 0);
  const sansLigne = db.prepare("SELECT id FROM page WHERE type = 'metiers' AND id NOT IN (SELECT id FROM metier)").all().map((p) => p.id);
  assert.deepEqual(sansLigne, ['metiers/regles-des-metiers']);
});

test('base : chaque corps a les cinq champs, une fois chacun, dans l’ordre de la page', () => {
  for (const m of metiers) assert.deepEqual(champsDuCorps(m.corps).map((c) => c.libelle), LIBELLES, m.id);
});

test('rendu complet : corpsDeMetier(ligne) === corps_md pour tout métier sans [[lien]], et === le corps sans ses liens pour les autres', () => {
  const avecLiens = [];
  for (const m of metiers) {
    assert.equal(corpsDeMetier(m.ligne), sansLiens(m.corps), m.id);
    if (aDesLiens(m.corps)) avecLiens.push(m.id);
    else assert.equal(corpsDeMetier(m.ligne), m.corps, m.id);
  }
  // les exceptions (Alchimiste et Apothicaire à l'import : lien [[Alchimie primitive|alchimie primitive]] du maillage) sont rares : d'où le
  // remplacement de sections plutôt que le rendu complet, qui perdrait leurs liens
  assert.ok(avecLiens.length < metiers.length / 2, avecLiens.join(', '));
});

test('remplacement de sections : chaque champ remplacé par sa propre valeur redonne le corps à l’octet près (liens reposés compris)', () => {
  for (const m of metiers) {
    for (const c of CHAMPS_DU_CORPS) {
      assert.equal(remplacerChampDuCorps(m.corps, c.libelle, m.ligne[c.colonne]), m.corps, `${m.id} ${c.colonne}`);
      assert.ok(champAJour(m.corps, c.libelle, m.ligne[c.colonne]), `${m.id} ${c.colonne}`);
    }
    assert.equal(corpsApres(m.corps, m.ligne, { ...m.ligne }), m.corps, m.id);
    assert.equal(corpsApres(m.corps, null, m.ligne), m.corps, `${m.id} (sans « avant »)`);
    assert.deepEqual(pageDuMetier(m.corps, m.ligne, m.ligne), { corps_md: m.corps, resume: m.resume }, m.id);
  }
});

test('résumé : la première phrase de la description, égale à page.resume et à resumeDeDescription pour toute la base', () => {
  for (const m of metiers) {
    assert.equal(resumeDuMetier(m.ligne.description) || null, m.resume, m.id);
    assert.equal(resumeDuMetier(m.ligne.description), metierChamps.resumeDeDescription(m.ligne.description), m.id);
  }
});

test('liens : la syntaxe est celle de wikilinks.mjs (mêmes liens trouvés, aucun après sansLiens)', () => {
  const echantillons = [...metiers.map((m) => m.corps), 'a [[B]] c [[D|e f]] [[races/g|h]] [[x|]] [[|y]] [[ i ]]'];
  for (const corps of echantillons) {
    const miens = [...corps.matchAll(new RegExp(SOURCE_DES_LIENS, 'g'))].map((m) => ({ target: m[1].trim(), label: (m[2] ?? m[1]).trim() }));
    assert.deepEqual(miens, extractLinks(corps));
    assert.deepEqual(extractLinks(sansLiens(corps)), []);
  }
});

test('metier-champs réexporte le corps : le service a la correction sans changer ses imports', () => {
  for (const nom of ['CHAMPS_DU_CORPS', 'corpsDeMetier', 'echapperMarkdown', 'remplacerChampDuCorps']) assert.equal(metierChamps[nom], corpsMetiers[nom], nom);
});

// ---------------------------------------------------------------------------------------------------------------------------------------------
// 2. Modifications
// ---------------------------------------------------------------------------------------------------------------------------------------------

test('description sur plusieurs paragraphes (Herboriste) : remplacée en entier, aucun paragraphe orphelin à la modification suivante', () => {
  const { ligne, corps } = herboriste;
  const l1 = { ...ligne, description: 'Premier paragraphe. Avec une suite.\n\nDeuxième paragraphe orphelin ?\n\nTroisième paragraphe.' };
  const c1 = corpsApres(corps, ligne, l1);
  assert.equal(sansLiens(c1), corpsDeMetier(l1));
  assert.match(c1, /^\*\*Description du métier :\*\* Premier paragraphe\. Avec une suite\.\n\nDeuxième paragraphe orphelin \?\n\nTroisième paragraphe\.\n\n\*\*Bonus :\*\*/);
  assert.deepEqual(champsDuCorps(c1).map((c) => c.libelle), LIBELLES);
  assert.equal(pageDuMetier(c1, ligne, l1).resume, 'Premier paragraphe.');
  const l2 = { ...l1, description: 'Une seule ligne.' };
  const c2 = corpsApres(c1, l1, l2);
  assert.doesNotMatch(c2, /paragraphe/);
  assert.equal(sansLiens(c2), corpsDeMetier(l2));
  assert.equal(corpsApres(c2, l2, ligne), corps, 'retour à la description d’origine : le corps d’origine');
  // l'ancien remplacement d'une seule ligne laissait « Deuxième… » et « Troisième… » sous la nouvelle description
  const ancien = c1.replace(/^\*\*Description du métier :\*\*.*$/m, '**Description du métier :** Une seule ligne.');
  assert.match(ancien, /orphelin/);
});

test('chaque colonne de chaque métier : la valeur modifiée remplace l’ancienne partout, sans rien laisser ; les autres champs ne bougent pas', () => {
  for (const m of metiers) {
    const champs = champsDuCorps(m.corps);
    for (const c of CHAMPS_DU_CORPS) {
      const champ = champs.find((x) => x.libelle === c.libelle);
      const texteDuChamp = m.corps.slice(champ.debut, champ.fin);
      const ancienne = `ZQX un *gras* [[Forgeron]] _x_\r\n\r\nZQX deux\n- ZQX puce\n# ZQX titre\n**Bonus :** ZQX faux champ`;
      const l1 = { ...m.ligne, [c.colonne]: ancienne };
      const c1 = corpsApres(m.corps, m.ligne, l1);
      assert.equal(sansLiens(c1), corpsDeMetier(l1), `${m.id} ${c.colonne}`);
      assert.equal(extractLinks(c1).length, extractLinks(m.corps).length - extractLinks(texteDuChamp).length, `${m.id} ${c.colonne} : aucun lien créé`);
      assert.equal(corpsApres(c1, null, l1), c1, `${m.id} ${c.colonne} : un corps à jour ne bouge plus`);
      assert.equal(remplacerChampDuCorps(c1, c.libelle, ancienne), c1, `${m.id} ${c.colonne} : réécrire la même valeur`);
      const l2 = { ...m.ligne, [c.colonne]: 'Nouvelle valeur.' };
      const c2 = corpsApres(c1, l1, l2);
      assert.ok(!c2.includes('ZQX'), `${m.id} ${c.colonne} : il reste « ${c2.slice(c2.indexOf('ZQX') - 20, c2.indexOf('ZQX') + 20)} »`);
      assert.equal(sansLiens(c2), corpsDeMetier(l2), `${m.id} ${c.colonne}`);
      assert.deepEqual(champsDuCorps(c2).map((x) => x.libelle), LIBELLES, `${m.id} ${c.colonne}`);
      for (const autre of champs) if (autre !== champ) assert.ok(c2.includes(m.corps.slice(autre.debut, autre.fin)), `${m.id} ${c.colonne} → ${autre.libelle}`);
      // retour à la valeur d'origine : le corps d'origine, sauf les liens du champ, que les valeurs intermédiaires n'écrivaient plus (ils sont perdus)
      const retour = corpsApres(c2, l2, m.ligne);
      assert.equal(retour, m.corps.slice(0, champ.debut) + sansLiens(texteDuChamp) + m.corps.slice(champ.fin), `${m.id} ${c.colonne} : retour`);
    }
  }
});

test('champ vidé (null, vide, espaces) : « **Libellé :** » seul, le champ reste à sa place ; rempli de nouveau, il redonne le corps', () => {
  const { ligne, corps } = herboriste;
  for (const vide of [null, undefined, '', '   ', ' \r\n \n\t']) {
    const l1 = { ...ligne, bonus_brut: vide };
    const c1 = corpsApres(corps, ligne, l1);
    assert.match(c1, /\n\n\*\*Bonus :\*\*\n\n\*\*Artisanat possible :\*\*/, JSON.stringify(vide));
    assert.deepEqual(champsDuCorps(c1).map((c) => c.libelle), LIBELLES);
    assert.equal(sansLiens(c1), corpsDeMetier(l1));
    assert.equal(corpsApres(c1, l1, ligne), corps);
    assert.equal(champDuCorps('Bonus', vide), '**Bonus :**');
  }
  // l'avantage vide de l'Artisan, écrit « **Avantage possible :** » en fin de corps
  assert.equal(remplacerChampDuCorps('**Bonus :** x\n\n**Avantage possible :** y\n', 'Avantage possible', null), '**Bonus :** x\n\n**Avantage possible :**\n');
  assert.equal(pageDuMetier(corps, ligne, { ...ligne, description: '' }).resume, null);
});

test('champ absent du corps : ajouté à sa place dans l’ordre de la page (début, milieu, fin) ; corps vide : le rendu complet', () => {
  for (const m of metiers) {
    const champs = champsDuCorps(m.corps);
    champs.forEach((c, k) => {
      const colonne = CHAMPS_DU_CORPS.find((x) => x.libelle === c.libelle).colonne;
      const sans = k === 0 ? m.corps.slice(champs[1].debut) : m.corps.slice(0, champs[k - 1].fin) + m.corps.slice(c.fin);
      assert.ok(!champsDuCorps(sans).some((x) => x.libelle === c.libelle));
      const attendu = aDesLiens(m.corps.slice(c.debut, c.fin)) ? sansLiens(m.corps.slice(c.debut, c.fin)) : m.corps.slice(c.debut, c.fin);
      const remis = m.corps.slice(0, c.debut) + attendu + m.corps.slice(c.fin);
      assert.equal(remplacerChampDuCorps(sans, c.libelle, m.ligne[colonne]), remis, `${m.id} ${c.libelle}`);
      assert.equal(corpsApres(sans, null, m.ligne), remis, `${m.id} ${c.libelle} (sans « avant »)`);
      assert.equal(corpsApres(sans, m.ligne, { ...m.ligne, [colonne]: `${m.ligne[colonne] ?? ''} modifié` }).includes(`**${c.libelle} :**`), true);
    });
  }
  const { ligne } = herboriste;
  for (const vide of ['', '\n\n', ' \r\n', null]) assert.equal(corpsApres(vide, null, ligne), corpsDeMetier(ligne), JSON.stringify(vide));
  assert.equal(corpsApres('', { ...ligne, bonus_brut: 'a' }, { ...ligne, bonus_brut: '+1 INI' }), '**Bonus :** +1 INI\n');
  // un libellé hors de CHAMPS_DU_CORPS : à la fin
  assert.equal(remplacerChampDuCorps('**Bonus :** x\n', 'Note', 'y'), '**Bonus :** x\n\n**Note :** y\n');
});

test('Markdown dans une valeur : ni lien, ni mise en forme, ni balise, ni champ, ni bloc (intertitre, filet, liste, citation, code, tableau)', async () => {
  const piege = [
    'Texte *gras* _it_ `code` <b>balise</b> [[Forgeron]] [lien](x) ~~barré~~ a | b &amp; &#33; AT&T \\n',
    '**Bonus :** faux champ',
    '# intertitre',
    '---',
    '===',
    '- - -',
    '+ puce plus',
    '1. liste',
    '2) liste',
    '> citation',
    '    code indenté',
    '```',
    '~~~',
    '-',
    '- vraie puce',
    '-     # intertitre dans une puce',
    '| a | b |',
    '|---|---|',
    '12 pièces. 3) non',
  ].join('\n');
  assert.deepEqual(markdownDeValeur(piege).split('\n'), [
    'Texte \\*gras\\* \\_it\\_ \\`code\\` \\<b\\>balise\\</b\\> \\[\\[Forgeron\\]\\] \\[lien\\](x) \\~\\~barré\\~\\~ a \\| b \\&amp; \\&#33; AT&T \\\\n',
    '\\*\\*Bonus :\\*\\* faux champ',
    '\\# intertitre',
    '\\---',
    '\\===',
    '\\- - -',
    '\\+ puce plus',
    '1\\. liste',
    '2\\) liste',
    '\\> citation',
    'code indenté',
    '\\`\\`\\`',
    '\\~\\~\\~',
    '\\-',
    '- vraie puce',
    '- \\# intertitre dans une puce',
    '\\| a \\| b \\|',
    '\\|---\\|---\\|',
    '12 pièces. 3) non',
  ]);
  const { ligne, corps } = herboriste;
  const l1 = { ...ligne, description: piege, avantage_brut: piege };
  const c1 = corpsApres(corps, ligne, l1);
  assert.deepEqual(champsDuCorps(c1).map((c) => c.libelle), LIBELLES, 'aucun faux champ');
  assert.deepEqual(extractLinks(c1), extractLinks(corps), 'aucun lien');
  // rendu par le processeur Markdown du site : des paragraphes, les cinq libellés en gras, la seule liste des puces « - »
  const processeur = await createMarkdownProcessor({ syntaxHighlight: false });
  const { code: html } = await processeur.render(c1);
  assert.equal((html.match(/<strong>/g) ?? []).length, 5, html);
  for (const balise of ['<h1', '<h2', '<h3', '<hr', '<ol', '<table', '<a ', '<del', '<code', '<pre', '<blockquote', '<b>', '<em']) assert.ok(!html.includes(balise), `${balise} dans ${html}`);
  assert.equal((html.match(/<ul>/g) ?? []).length, 2, 'une liste par champ (la description, l’avantage)');
  assert.equal((html.match(/<li>/g) ?? []).length, 4);
  assert.match(html, /&#x26;amp;|&amp;amp;/, '« &amp; » reste écrit tel quel');
  // et la valeur suivante efface tout
  const c2 = corpsApres(c1, l1, ligne);
  assert.equal(c2, corps);
});

test('retours à la ligne Windows : une valeur en \\r\\n s’écrit en \\n ; un corps en \\r\\n le reste, champs réécrits compris', () => {
  assert.equal(markdownDeValeur('a\r\nb\r\n\r\nc\rd'), 'a\nb\n\nc\nd');
  assert.equal(markdownDeValeur('a\r\nb', '\r\n'), 'a\r\nb');
  const { ligne, corps } = herboriste;
  const l1 = { ...ligne, description: 'Un.\r\n\r\nDeux.\r\nTrois.' };
  const c1 = corpsApres(corps, ligne, l1);
  assert.ok(!c1.includes('\r'));
  assert.equal(c1, corpsApres(corps, ligne, { ...ligne, description: 'Un.\n\nDeux.\nTrois.' }));
  assert.match(c1, /^\*\*Description du métier :\*\* Un\.\n\nDeux\.\nTrois\.\n\n\*\*Bonus :\*\*/);
  assert.equal(pageDuMetier(corps, ligne, l1).resume, 'Un.');
  // corps écrit sous Windows
  for (const m of metiers) {
    const crlf = m.corps.replace(/\n/g, '\r\n');
    for (const c of CHAMPS_DU_CORPS) assert.equal(remplacerChampDuCorps(crlf, c.libelle, m.ligne[c.colonne]), crlf, `${m.id} ${c.colonne}`);
    assert.equal(corpsApres(crlf, null, m.ligne), crlf, m.id);
    const l2 = { ...m.ligne, description: 'Un.\n\nDeux.', avantage_brut: null };
    const c2 = corpsApres(crlf, m.ligne, l2);
    assert.ok(!/[^\r]\n/.test(c2), `${m.id} : que des \\r\\n`);
    assert.equal(c2.replace(/\r\n/g, '\n'), corpsApres(m.corps, m.ligne, l2), m.id);
  }
});

test('liens [[…]] de l’ancienne valeur : reposés tant que leur texte est écrit (mots entiers, dans l’ordre), perdus sinon', () => {
  const corps = '**Description du métier :** Un [[Forgeron|forgeron]] et un [[Mineur]].\n\n**Bonus :** x\n';
  const desc = (valeur) => remplacerChampDuCorps(corps, 'Description du métier', valeur);
  assert.equal(desc('Un forgeron, un mineur et un Mineur.'), '**Description du métier :** Un [[Forgeron|forgeron]], un mineur et un [[Mineur]].\n\n**Bonus :** x\n');
  assert.equal(desc('Des forgerons et un Mineur.'), '**Description du métier :** Des forgerons et un [[Mineur]].\n\n**Bonus :** x\n');
  assert.equal(desc('Un Mineur puis un forgeron.'), '**Description du métier :** Un Mineur puis un [[Forgeron|forgeron]].\n\n**Bonus :** x\n');
  assert.equal(desc('Rien de lié.'), '**Description du métier :** Rien de lié.\n\n**Bonus :** x\n');
  assert.equal(desc('Un forgeron et un forgeron, un Mineur.'), '**Description du métier :** Un [[Forgeron|forgeron]] et un forgeron, un [[Mineur]].\n\n**Bonus :** x\n');
  // un lien d'un autre champ ne bouge pas
  assert.equal(remplacerChampDuCorps(corps, 'Bonus', 'forgeron'), '**Description du métier :** Un [[Forgeron|forgeron]] et un [[Mineur]].\n\n**Bonus :** forgeron\n');
  // un vrai cas : le lien de l'artisanat de l'Alchimiste reste quand le test de fabrication change
  for (const m of metiers.filter((x) => /\[\[Alchimie primitive\|alchimie primitive\]\]/.test(x.corps))) {
    const l1 = { ...m.ligne, artisanat_brut: m.ligne.artisanat_brut.replace(/\[[^\]]*\]$/, '[FORCE + AGILITÉ]') };
    const c1 = corpsApres(m.corps, m.ligne, l1);
    assert.match(c1, /l’\[\[Alchimie primitive\|alchimie primitive\]\] \\\[FORCE \+ AGILITÉ\\\]/, m.id);
    assert.equal(sansLiens(c1), corpsDeMetier(l1));
  }
});

test('sans « avant » : un corps en retard (paragraphes orphelins de l’ancien remplacement) est remis d’accord ; avec « avant », seuls les champs modifiés', () => {
  const { ligne, corps } = herboriste;
  const enRetard = corps.replace(/^(\*\*Description du métier :\*\*.*)$/m, '$1\n\nZQX orphelin.\n\nZQX autre.');
  assert.notEqual(enRetard, corps);
  assert.ok(!champAJour(enRetard, 'Description du métier', ligne.description));
  assert.equal(corpsApres(enRetard, null, ligne), corps);
  assert.equal(corpsApres(enRetard, ligne, ligne), enRetard, 'rien de modifié : rien de réécrit');
  assert.ok(!corpsApres(enRetard, ligne, { ...ligne, description: 'Nouvelle.' }).includes('ZQX'));
  assert.ok(corpsApres(enRetard, ligne, { ...ligne, bonus_brut: '+1 INI' }).includes('ZQX'), 'avec « avant », un autre champ ne touche pas la description');
});

test('texte hors des cinq champs (introduction, champ inconnu) : laissé tel quel ; un champ écrit deux fois est remplacé partout ; une ligne partielle ne touche que ses colonnes', () => {
  const { ligne, corps } = herboriste;
  const note = `Introduction libre.\n\n${corps}\n**Note :** à garder.\n`;
  const l1 = { ...ligne, description: 'Autre.', avantage_brut: 'Un avantage\n\nsur deux paragraphes.' };
  const c1 = corpsApres(note, ligne, l1);
  assert.ok(c1.startsWith('Introduction libre.\n\n**Description du métier :** Autre.\n\n'));
  assert.ok(c1.endsWith('**Avantage possible :** Un avantage\n\nsur deux paragraphes.\n\n**Note :** à garder.\n'), c1);
  assert.equal(corpsApres(c1, l1, ligne), note);
  // un champ écrit deux fois
  const double = `${corps}\n**Bonus :** ${ligne.bonus_brut}\n`;
  const c2 = remplacerChampDuCorps(double, 'Bonus', 'ZQY');
  assert.equal(c2.split('**Bonus :** ZQY').length, 3);
  assert.ok(!champsDuCorps(c2).some((c) => c.libelle === 'Bonus' && !c2.slice(c.debut, c.fin).endsWith('ZQY')));
  // une ligne partielle (sans les autres colonnes) ne touche que la description, même sans « avant »
  const partielle = { description: 'Seule.' };
  const c3 = corpsApres(corps, null, partielle);
  assert.equal(c3, remplacerChampDuCorps(corps, 'Description du métier', 'Seule.'));
  assert.equal(corpsApres(corps, null, {}), corps);
  assert.equal(corpsApres(corps, null, null), corps);
});

test('résumé : première phrase du premier paragraphe, retours à la ligne repliés', () => {
  const cas = [
    ['Une phrase. Une autre.', 'Une phrase.'],
    ['Sans point\n\nSuite. Fin.', 'Sans point'],
    ['Ligne un\nligne deux. Reste.', 'Ligne un ligne deux.'],
    ['Question ? Oui.', 'Question ?'],
    ['Phrase seule.', 'Phrase seule.'],
    ['Suspension… et suite', 'Suspension…'],
    ['  Bords.  ', 'Bords.'],
    ['Un.\r\n\r\nDeux.', 'Un.'],
    ['', ''],
    [null, ''],
    ['  \n ', ''],
  ];
  for (const [description, attendu] of cas) assert.equal(resumeDuMetier(description), attendu, JSON.stringify(description));
  assert.equal(pageDuMetier('', null, { description: '   ' }).resume, null);
});

test('métier créé depuis le site : corpsDeMetier écrit les cinq champs dans l’ordre, vides compris', () => {
  const ligne = { nom: 'Essai', description: '', bonus_brut: '', artisanat_brut: 'Rien', equipement_brut: 'Rien', avantage_brut: null };
  const corps = corpsDeMetier(ligne);
  assert.equal(corps, '**Description du métier :**\n\n**Bonus :**\n\n**Artisanat possible :** Rien\n\n**Équipement supplémentaire possible :** Rien\n\n**Avantage possible :**\n');
  for (const c of CHAMPS_DU_CORPS) assert.equal(remplacerChampDuCorps(corps, c.libelle, ligne[c.colonne]), corps);
  const l1 = { ...ligne, description: 'Un essai.\n\nSur deux paragraphes.', avantage_brut: 'Un avantage\n- en puce' };
  assert.equal(corpsApres(corps, ligne, l1), corpsDeMetier(l1));
  // le service crée la page avec corpsDeMetier puis réécrit chaque champ (avant = null) : les paragraphes ne sont pas recopiés deux fois
  const cree = corpsDeMetier(l1);
  let reecrit = cree;
  for (const c of CHAMPS_DU_CORPS) reecrit = remplacerChampDuCorps(reecrit, c.libelle, l1[c.colonne]);
  assert.equal(reecrit, cree);
  assert.deepEqual(CHAMPS_DU_CORPS.map((c) => c.colonne), ['description', 'bonus_brut', 'artisanat_brut', 'equipement_brut', 'avantage_brut']);
});

test('balise du glossaire dans un champ : son séparateur reste « | » (la ligne n’est pas une ligne de tableau), le reste est échappé', () => {
  const ligne = { nom: 'Essai', description: '', bonus_brut: '', artisanat_brut: 'Redonne 5 {{chakra|chakra}} si [bu] | *vite*', equipement_brut: 'Rien', avantage_brut: null };
  const corps = corpsDeMetier(ligne);
  assert.match(corps, /\*\*Artisanat possible :\*\* Redonne 5 \{\{chakra\|chakra\}\} si \\\[bu\\\] \\\| \\\*vite\\\*\n/);
  assert.deepEqual(formesNonCanoniques(corps, [{ id: 'chakra', libelle: 'Chakra' }], { markdown: true }), []);
  assert.equal(remplacerChampDuCorps(corps, 'Artisanat possible', ligne.artisanat_brut), corps);
});
