// Décision R223 (suppression forcée d'un mot-clé mentionné), ses fonctions pures :
//   - lib/mots-cles-balises.mjs#remplacerParLeTexteAffiche : chaque balise qui cite le mot-clé devient son texte affiché, en texte simple (R223 (2) ;
//     réponse du propriétaire « Le texte affiché » : {{x}} et {{x:}} donnent le libellé, {{x|texte}} le texte écrit ; une ref écrite autrement que l'id
//     montre ce qu'elle montrait ; la règle isolée dans texteQuiRemplaceLaBalise) ; dans un texte mis en forme, le texte est échappé pour que la page
//     rendue le montre tel quel, ligne de tableau comprise ; une balise dans un code reste ; un texte de case reçoit le texte brut ;
//     en tête de ligne, il ne devient ni liste, ni titre, ni citation (echapperDebutDeLigne) ;
//   - serveur/edition.mjs : les marqueurs des suppressions forcées et des fusions en tête du résumé du lot, que le rejeu lit (R223 (6)) — exacts,
//     neutralisés dans un texte saisi, gardés par la résolution d'un conflit.
// Les mots-clés et les textes sont ceux du test (aucun texte de la base n'est lu).
//   node --test test/mots-cles-r223.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { marqueursDuLot, marqueursDuResume, neutraliserLeMarqueur, registreDes0113, separerLeMarqueur, suppressionsForceesDuResume } from '../serveur/edition.mjs';
import { lireBalises, motCleDeLaRef, remplacerParLeTexteAffiche, texteQuiRemplaceLaBalise, vocabulaireDesMotsCles } from '../src/lib/mots-cles-balises.mjs';
import { rendreLeMarkdown } from './aide-rendu-du-site.mjs';
import { texteAffiche } from './aide-texte-affiche.mjs';

// des mots-clés d'essai à id entier et à clé (migration 0113), l'un avec un synonyme (migration 0115 : l'ancienne abréviation en est un)
const essai = (libelle, synonyme = null) => ({ id: 9201, libelle, cle: 'essai-r223', description: 'Définition d’essai.', synonymes: synonyme ? [synonyme] : [] });
const autre = { id: 9202, libelle: 'Autre R223', cle: 'autre-r223', description: '' };
const vocabulaire = (m) => vocabulaireDesMotsCles([m, autre]);
const citeEncore = (texte, m, o) => lireBalises(texte, o).some((b) => motCleDeLaRef(vocabulaire(m), b.ref)?.id === m.id);

test('R223 (2), « Le texte affiché » : texteQuiRemplaceLaBalise rend le libellé pour {{x}} et {{x:}}, le texte écrit pour {{x|texte}}', () => {
  const m = essai('Essai R223', 'ER3');
  const [simple, ecrit, complet, parLibelle, parSynonyme, autreCasse] = lireBalises('{{essai-r223}} {{essai-r223|autre texte}} {{essai-r223:}} {{Essai R223}} {{er3}} {{essai r223}}');
  assert.equal(texteQuiRemplaceLaBalise(simple, m), m.libelle);
  assert.equal(texteQuiRemplaceLaBalise(ecrit, m), 'autre texte');
  assert.equal(texteQuiRemplaceLaBalise(complet, m), m.libelle, 'le mode complet : le libellé seul');
  assert.equal(texteQuiRemplaceLaBalise(parLibelle, m), m.libelle);
  // R233 (10) : « Garder la casse tapée, incluant les synonymes et abréviations » : ce que la balise affichait
  assert.equal(texteQuiRemplaceLaBalise(parSynonyme, m), 'er3', 'un synonyme : tel que tapé');
  assert.equal(texteQuiRemplaceLaBalise(autreCasse, m), 'essai r223', 'une autre écriture : telle que tapée');
});

test('R223 (2) : chaque balise du mot-clé devient son texte affiché, dans un texte mis en forme comme dans un texte de case ; les autres balises restent', () => {
  const m = essai('Essai R223', 'ER3');
  const texte = 'A {{essai-r223}}, B {{essai-r223|autre texte}}, C {{essai-r223:}}, D {{Essai R223}}, E {{essai r223|x}}, F {{ER3}}, G {{autre-r223}}.';
  const attendu = 'A Essai R223, B autre texte, C Essai R223, D Essai R223, E x, F ER3, G {{autre-r223}}.';
  assert.equal(remplacerParLeTexteAffiche(texte, vocabulaire(m), m.id, { markdown: true }), attendu);
  const caseDeTexte = 'Coût : {{essai-r223|Essai}} et {{ER3|ER3}} ; {{autre-r223|Autre}}';
  assert.equal(remplacerParLeTexteAffiche(caseDeTexte, vocabulaire(m), m.id), 'Coût : Essai et ER3 ; {{autre-r223|Autre}}');
  assert.equal(remplacerParLeTexteAffiche('sans balise', vocabulaire(m), m.id), 'sans balise');
});

test('R223 (2) : une balise dans un code d’un texte mis en forme reste écrite (ce n’est pas une mention)', () => {
  const m = essai('Essai R223');
  const texte = 'Voir {{essai-r223}} ; `{{essai-r223}}` reste.\n\n```\n{{essai-r223}}\n```\n';
  assert.equal(remplacerParLeTexteAffiche(texte, vocabulaire(m), m.id, { markdown: true }), 'Voir Essai R223 ; `{{essai-r223}}` reste.\n\n```\n{{essai-r223}}\n```\n');
});

test('R223 (2) : un libellé ou un texte écrit à caractères spéciaux s’affiche tel quel dans la page rendue, paragraphe et case de tableau (le « | » ne coupe pas la case)', async () => {
  const m = essai('Essai *R223* _x_ [y] `z` <b> {a} | fin');
  const md = remplacerParLeTexteAffiche('Avant {{essai-r223}} après.\n\n| Col 1 | Col 2 | Col 3 |\n| --- | --- | --- |\n| {{essai-r223:}} | {{essai-r223\\|des [essais]}} | trois |\n',
    vocabulaire(m), m.id, { markdown: true });
  assert.equal(citeEncore(md, m, { markdown: true }), false, md);
  const html = await rendreLeMarkdown(md);
  const paragraphe = /<p>([\s\S]*?)<\/p>/.exec(html)[1];
  assert.equal(texteAffiche(paragraphe).trim(), `Avant ${m.libelle} après.`, html);
  const cases = [...html.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((c) => texteAffiche(c[1]).trim());
  assert.deepEqual(cases, [m.libelle, 'des [essais]', 'trois'], html);
  assert.ok(!/<(em|strong|a|code|b)\b/.test(paragraphe), `aucune mise en forme : ${paragraphe}`);
  // un texte de case : le texte brut (il se lit sans Markdown ; une page qui le met dans un tableau l'échappe : lib/corps-*.mjs)
  assert.equal(remplacerParLeTexteAffiche('{{essai-r223|t}} et {{essai-r223}}', vocabulaire(m), m.id), `t et ${m.libelle}`);
});

test('R223 : un texte affiché en tête de ligne ne devient ni liste, ni titre, ni citation ; ailleurs dans la ligne, il reste tel quel', async () => {
  for (const libelle of ['1. Essai', '- Essai', '# Essai', '> Essai', '+ Essai']) {
    const m = essai(libelle);
    const md = remplacerParLeTexteAffiche('Avant.\n\n{{essai-r223}} suite.\n\n  {{essai-r223}}\n\nEn ligne : {{essai-r223}}.\n', vocabulaire(m), m.id, { markdown: true });
    const html = await rendreLeMarkdown(md);
    assert.ok(!/<(ol|ul|li|h\d|blockquote)\b/.test(html), `${libelle} : ${html}`);
    const paragraphes = [...html.matchAll(/<p>([\s\S]*?)<\/p>/g)].map((x) => texteAffiche(x[1]).trim());
    assert.deepEqual(paragraphes, ['Avant.', `${libelle} suite.`, libelle, `En ligne : ${libelle}.`], html);
    assert.ok(md.includes(`En ligne : ${libelle}.`), 'au milieu d’une ligne : rien à échapper');
  }
});

test('R223 (6) : les marqueurs des suppressions forcées et des fusions, en tête du résumé du lot — exacts (ids), neutralisés dans un texte saisi, gardés par la résolution', () => {
  const marqueur = marqueursDuLot({ forcees: ['essai-r223', 'autre-r223', 'essai-r223'] });
  assert.equal(marqueur, '[suppression forcée R223 : essai-r223, autre-r223] ');
  assert.deepEqual([...suppressionsForceesDuResume(`${marqueur}Mot-clé supprimé en forçant (décision R223) : Essai`)], ['essai-r223', 'autre-r223']);
  assert.deepEqual([...suppressionsForceesDuResume('Mot-clé supprimé : Essai ; Mot-clé « A » fusionné dans « B »')], [], 'sans marqueur : ni forcée ni fusion');
  assert.equal(marqueursDuLot({}), '');
  // une fusion : sa cible, lue au marqueur (même quand le lot n'a rien reporté sur elle) ; ni l'une ni l'autre n'est une suppression forcée
  const avecFusion = marqueursDuLot({ forcees: ['essai-r223'], fusions: [['source-r223', 'cible-r223']] });
  const lus = marqueursDuResume(`${avecFusion}Mot-clé « S » fusionné dans « C »`);
  assert.deepEqual([[...lus.forcees], [...lus.fusions]], [['essai-r223'], [['source-r223', 'cible-r223']]]);
  assert.deepEqual([...marqueursDuResume(neutraliserLeMarqueur('[fusion des mots-clés : a > b] saisi')).fusions], [], 'neutralisé');
  assert.deepEqual([...suppressionsForceesDuResume(`Résolution : ${marqueur}`)], [], 'seulement en tête du résumé');
  // un nom saisi qui écrirait le motif ne marque rien : enregistrer neutralise le résumé de chaque opération
  const saisi = neutraliserLeMarqueur('Mot-clé créé : [suppression forcée R223 : essai-r223]');
  assert.deepEqual([...suppressionsForceesDuResume(saisi)], []);
  // la résolution d'un conflit garde le marqueur en tête
  const { entete, reste } = separerLeMarqueur(`${marqueur}Mot-clé supprimé en forçant (décision R223) : Essai`);
  assert.equal(entete, marqueur);
  assert.equal(reste, 'Mot-clé supprimé en forçant (décision R223) : Essai');
  assert.deepEqual([...suppressionsForceesDuResume(`${entete}Résolution du conflit du lot x : ${reste}`)], ['essai-r223', 'autre-r223']);
  assert.deepEqual(separerLeMarqueur('Sans marqueur'), { entete: '', reste: 'Sans marqueur' });
});

test('R223 (6), migration 0113 : le marqueur d’un lot d’avant se traduit par la correspondance de la migration, même un ancien id fait de chiffres', () => {
  const registre = registreDes0113();
  assert.ok(registre, 'la correspondance de la 0113');
  // un ancien id fait de chiffres, dont l'id entier n'est pas lui-même (s'il en existe un dans la correspondance), et un ancien id quelconque
  const [chiffres, entierDesChiffres] = [...registre].find(([ancien, id]) => /^\d+$/.test(ancien) && String(id) !== ancien) ?? [];
  const [lettres, entierDesLettres] = [...registre].find(([ancien]) => !/^\d+$/.test(ancien));
  const marqueur = marqueursDuLot({ forcees: [lettres, ...(chiffres ? [chiffres] : [])], fusions: [[lettres, 'cree-par-le-journal']] });
  const avant = marqueursDuResume(marqueur, { avant0113: true });
  assert.deepEqual([...avant.forcees], [entierDesLettres, ...(chiffres ? [entierDesChiffres] : [])]);
  assert.deepEqual([...avant.fusions], [[entierDesLettres, 'cree-par-le-journal']], 'un id absent de la correspondance reste texte');
  // un lot d'après : des ids entiers, relus en nombres
  assert.deepEqual([...marqueursDuResume(marqueursDuLot({ forcees: [400], fusions: [[12, 34]] })).forcees], [400]);
  assert.deepEqual([...marqueursDuResume(marqueursDuLot({ fusions: [[12, 34]] })).fusions], [[12, 34]]);
});
