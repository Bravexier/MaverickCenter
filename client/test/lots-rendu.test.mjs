// Le rendu des modifications de l'équipe sur la page « Mise à jour » (src/lib/lots-rendu.mjs ; R291 : « En gros c'est le patchnote mais où je peux choisir chaque
// ligne que je peux annuler » ; propositions encore en attente : R275, question 4 a ; R276 : le propriétaire s'occupe le moins possible, sans jargon), sans navigateur ni service : le HTML lu par le faux
// DOM, sur des lots à la forme que rend le service (serveur/edition-lots.mjs). Aucun texte figé : la structure (attributs `data-nv-…`), les données montrées
// et leur échappement ; la forme réelle du service est éprouvée dans test/lots-rendu-service.test.mjs.
//   node --test test/lots-rendu.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  PLAFOND_DES_LIGNES, corpsDuClic, htmlDeLApercu, htmlDeLaConfirmation, htmlDesLots, htmlDuLot, messageDeLaLigneAnnulee, messageDErreur, messageDuBilan,
  messageDuRecalcul, motDeLEtat, origineDuLot, peutAnnuler, peutAnnulerLaLigne, peutAppliquer, phraseDeLAnnulation, phraseDeLEssai, verrousDuLot,
} from '../src/lib/lots-rendu.mjs';
import { el } from './aide-faux-dom.mjs';

/** Le HTML posé dans un faux élément : les requêtes se font sur la structure, pas sur le texte. */
const lire = (html) => {
  const e = el('div', {});
  e.innerHTML = html;
  return e;
};
const textes = (liste) => [...liste].map((e) => e.textContent);

const colonne = (libelle, avant, apres, plus = {}) => ({ colonne: `c_${libelle}`, libelle, avant, apres, ...plus });
const apercu = (ligne, colonnes, table = 'Métiers') => ({ table, ligne, colonnes });
const operation = (rang, etat, plus = {}) => ({ rang, table: 'metier', cle: { id: rang }, operation: 'modifier', apercu: apercu(`Ligne ${rang}`, [colonne('Description', `avant ${rang}`, `après ${rang}`)]), etat, ...plus });
const essai = (verdict, operations, plus = {}) => ({
  format: 1, verdict, verrous_a_ouvrir: [], operations, problemes_nouveaux: [], problemes_avant: [], numeros: [],
  comptes: { applicables: operations.filter((o) => o.etat === 'applicable').length, changees: operations.filter((o) => o.etat === 'changee').length, verrouillees: operations.filter((o) => o.etat === 'verrouillee').length, refusees: operations.filter((o) => o.etat === 'refusee').length },
  ...plus,
});
const lot = (id, plus = {}) => ({
  id, depose_le: '2026-11-14T10:00:00Z', titre: `Lot ${id}`, nature: 'decision', decision: 'R275', auteur: 'une session', etat: 'propose', essaye_le: '2026-11-14T10:00:01Z',
  decide_le: null, lot_id: null, annule_le: null, annulation_lot_id: null, operations: 1, verdict: null, essai: essai('applicable', [operation(1, 'applicable')]), bilan: null, ...plus,
});

test('l’essai d’un lot en une phrase : le niveau suit le verdict, les valeurs changées se comptent, chaque chose à corriger a sa ligne (le rang du lot)', () => {
  const prete = phraseDeLEssai(lot('a'));
  assert.deepEqual([prete.niveau, prete.verdict, prete.lignes], ['pret', 'applicable', []]);
  // deux valeurs changées depuis (par colonne), pas deux opérations
  const changees = lot('b', { essai: essai('applicable', [operation(1, 'applicable'), operation(2, 'changee', { ecarts: [{ colonne: 'x', attendue: 1, actuelle: 2 }, { colonne: 'y', attendue: 1, actuelle: 3 }] })]) });
  assert.equal(phraseDeLEssai(changees).valeurs, 2);
  assert.match(phraseDeLEssai(changees).texte, /\b2\b/);
  assert.equal(phraseDeLEssai(changees).niveau, 'pret');
  // à corriger : une ligne par opération refusée, avec son rang et le message du service
  const acorriger = lot('c', { essai: essai('a_corriger', [operation(1, 'applicable'), operation(3, 'refusee', { message: 'colonne inconnue' })], { problemes_nouveaux: ['un contrôle du contenu'] }) });
  const p = phraseDeLEssai(acorriger);
  assert.equal(p.niveau, 'erreur');
  assert.equal(p.lignes.length, 2);
  assert.ok(p.lignes[0].includes('3') && p.lignes[0].includes('colonne inconnue'));
  assert.ok(p.lignes[1].includes('un contrôle du contenu'));
  // avec des décisions à ouvrir : prêt avec accord, chacune citée
  const verrous = lot('d', { essai: essai('verrous', [operation(1, 'verrouillee', { decisions: ['R218', 'R219'] })], { verrous_a_ouvrir: ['R218', 'R219'] }) });
  assert.equal(phraseDeLEssai(verrous).niveau, 'accord');
  assert.ok(phraseDeLEssai(verrous).texte.includes('R218') && phraseDeLEssai(verrous).texte.includes('R219'));
  assert.deepEqual(verrousDuLot(verrous), ['R218', 'R219']);
  // rien à écrire, essai en échec, pas d'essai
  assert.equal(phraseDeLEssai(lot('e', { essai: essai('rien_a_ecrire', []) })).niveau, 'attention');
  assert.deepEqual(phraseDeLEssai(lot('f', { essai: { verdict: 'en_echec', erreur: 'copie impossible', operations: [] } })).lignes, ['copie impossible']);
  assert.equal(phraseDeLEssai(lot('g', { essai: null })).niveau, 'attente');
});

test('« Appliquer » n’est possible que si l’essai le permet et que chaque décision à ouvrir est cochée ; le clic n’envoie que ce qui est coché et demandé', () => {
  assert.equal(peutAppliquer(lot('a')).possible, true);
  for (const verdict of ['a_corriger', 'rien_a_ecrire', 'en_echec']) assert.equal(peutAppliquer(lot('b', { essai: essai(verdict, []) })).possible, false, verdict);
  assert.equal(peutAppliquer(lot('c', { essai: null })).possible, false);
  assert.equal(peutAppliquer(lot('d', { etat: 'applique' })).possible, false, 'un lot décidé n’attend plus de clic');
  const verrous = lot('e', { essai: essai('verrous', [operation(1, 'verrouillee')], { verrous_a_ouvrir: ['R218', 'R219'] }) });
  assert.equal(peutAppliquer(verrous).possible, false);
  assert.equal(peutAppliquer(verrous, new Set(['R218'])).possible, false, 'une décision sur deux');
  assert.ok(peutAppliquer(verrous, new Set(['R218'])).raison);
  assert.equal(peutAppliquer(verrous, new Set(['R218', 'R219'])).possible, true);
  assert.deepEqual(corpsDuClic(['R218', 'R219'], new Set(['R219', 'R105'])), { verrous_ouverts: ['R219'] }, 'jamais une décision que le service ne demande pas');
  assert.deepEqual(corpsDuClic([], new Set(['R105'])), { verrous_ouverts: [] });
  // l'annulation : même règle sur son aperçu
  assert.equal(peutAnnuler({ verdict: 'applicable' }).possible, true);
  assert.equal(peutAnnuler({ verdict: 'verrous', verrous_a_ouvrir: ['R218'] }).possible, false);
  assert.equal(peutAnnuler({ verdict: 'verrous', verrous_a_ouvrir: ['R218'] }, new Set(['R218'])).possible, true);
  for (const verdict of ['refusee', 'rien_a_remettre', null]) assert.equal(peutAnnuler({ verdict }).possible, false, String(verdict));
});

/** Une ligne d'un changement appliqué, comme le service la rend (`lignes` de GET …/lots/<id>/ : R291). */
const ligne = (n, plus = {}) => ({
  n, table: 'Métiers', ligne: `Ligne ${n}`, genre: 'modifier', colonnes: [colonne('Description', `avant ${n}`, `après ${n}`)],
  etat: 'en_place', annulable_seule: true, motif: null, depend_de: [], ...plus,
});
const applique = (id, lignes, plus = {}) => lot(id, {
  etat: 'applique', decide_le: '2026-11-14T12:00:00Z', lot_id: `L-${id}`, application: { directe: true, par: 'cle_de_depot' }, lignes, essai: null, ...plus,
});

test('un lot qui attend le clic : titre, origine, décision citée, phrase de l’essai, aperçu dépliable, trois boutons ; une case par décision et « Appliquer » inactif tant qu’elles ne sont pas cochées', () => {
  const l = lot('abc', { essai: essai('verrous', [operation(1, 'verrouillee', { decisions: ['R218'], message: 'le message du service' })], { verrous_a_ouvrir: ['R218'] }) });
  const racine = lire(htmlDesLots({ lots: [l] }));
  const article = racine.querySelector('[data-nv-lot-id="abc"]');
  assert.equal(article.dataset.nvEtat, 'propose');
  assert.equal(article.querySelector('.nv-lot__titre').textContent.includes('Lot abc'), true);
  assert.equal(article.querySelector('[data-nv-decision]').textContent, 'R275');
  assert.ok(article.querySelector('.nv-lot__meta').textContent.includes('une session'));
  assert.equal(article.querySelector('[data-nv-verdict]').dataset.nvVerdict, 'verrous');
  assert.equal(article.querySelectorAll('details.nv-lot__apercu').length, 1);
  assert.equal(article.querySelectorAll('[data-nv-verrou]').length, 1);
  assert.equal(article.querySelector('[data-nv-verrou]').getAttribute('data-nv-verrou'), 'R218');
  assert.ok(article.querySelector('.nv-lot__verrou').textContent.includes('R218'));
  for (const b of ['data-nv-appliquer', 'data-nv-refuser', 'data-nv-essai']) assert.equal(article.querySelectorAll(`button[${b}]`).length, 1, b);
  assert.equal(article.querySelector('[data-nv-appliquer]').hasAttribute('disabled'), true, 'inactif tant que la case n’est pas cochée');
  assert.equal(article.querySelector('[data-nv-raison]').hasAttribute('hidden'), false, 'la raison est dite');
  // cochée (l'état de la page), le bouton s'active et la case reste cochée au rendu suivant
  const coche = lire(htmlDesLots({ lots: [l] }, { coches: new Map([['abc', new Set(['R218'])]]) })).querySelector('[data-nv-lot-id="abc"]');
  assert.equal(coche.querySelector('[data-nv-appliquer]').hasAttribute('disabled'), false);
  assert.equal(coche.querySelector('[data-nv-verrou]').hasAttribute('checked'), true);
  assert.equal(coche.querySelector('[data-nv-raison]').hasAttribute('hidden'), true);
  // sans décision à ouvrir : aucune case, le bouton est actif
  const simple = lire(htmlDuLot(lot('simple'))).querySelector('article');
  assert.equal(simple.querySelectorAll('[data-nv-verrou]').length, 0);
  assert.equal(simple.querySelector('[data-nv-appliquer]').hasAttribute('disabled'), false);
  // à corriger : le bouton est inactif, les lignes à corriger sont listées
  const mauvais = lire(htmlDuLot(lot('mauvais', { essai: essai('a_corriger', [operation(4, 'refusee', { message: 'à revoir' })]) }))).querySelector('article');
  assert.equal(mauvais.querySelector('[data-nv-appliquer]').hasAttribute('disabled'), true);
  assert.ok(textes(mauvais.querySelectorAll('.nv-lot__problemes li')).some((t) => t.includes('4') && t.includes('à revoir')));
});

test('l’aperçu : par ligne de la base son nom, son état, et pour chaque colonne le libellé, l’avant et l’après ; une valeur objet ou liste se lit sans JSON', () => {
  const ops = [
    operation(1, 'applicable', { apercu: apercu('Forgeron', [colonne('Bonus', 'ancien', 'nouveau'), colonne('Autre', null, { a: 1, b: ['x', 'y'] })]) }),
    operation(2, 'changee', { ecarts: [{ colonne: 'c_Bonus', attendue: 'attendu', actuelle: 'trouvé' }], apercu: apercu('Maçon', [colonne('Bonus', 'a', 'b')]) }),
    operation(3, 'refusee', { message: 'refus du service' }),
  ];
  const racine = lire(htmlDeLApercu(ops, { contexte: 'essai' }));
  const lignes = racine.querySelectorAll('li.nv-lot-ligne');
  assert.deepEqual([...lignes].map((l) => l.dataset.nvEtatLigne), ['applicable', 'changee', 'refusee']);
  const premiere = lignes[0];
  assert.equal(premiere.querySelector('strong').textContent, 'Forgeron');
  assert.deepEqual(textes(premiere.querySelectorAll('.nv-lot-colonne__nom')), ['Bonus', 'Autre']);
  const versions = textes(premiere.querySelectorAll('.nv-version__texte'));
  assert.deepEqual(versions.slice(0, 2), ['ancien', 'nouveau']);
  assert.deepEqual(versions.slice(2, 4), ['(vide)', 'a : 1, b : x, y'], 'une valeur objet : « clé : valeur », jamais en JSON');
  assert.doesNotMatch(racine.textContent, /[{}"]/);
  // une ligne qui ne s'écrit pas ne montre pas ses colonnes : la valeur que le site porte et celle que le lot attendait
  assert.equal(lignes[1].querySelectorAll('.nv-lot-colonne').length, 0);
  assert.ok(lignes[1].querySelector('.nv-lot-ligne__ecarts').textContent.includes('trouvé') && lignes[1].querySelector('.nv-lot-ligne__ecarts').textContent.includes('attendu'));
  assert.ok(lignes[1].querySelector('.nv-lot-ligne__ecarts').textContent.includes('Bonus'), 'la colonne par son libellé');
  assert.ok(lignes[2].textContent.includes('refus du service'));
  // deux longs textes : seulement leurs différences, les deux en entier à la demande
  const long = 'mot '.repeat(120);
  const diff = lire(htmlDeLApercu([operation(1, 'applicable', { apercu: apercu('X', [colonne('Texte', `${long}ancien fin`, `${long}nouveau fin`)]) })]));
  assert.equal(diff.querySelectorAll('.nv-diff ins').length > 0 && diff.querySelectorAll('.nv-diff del').length > 0, true);
  assert.equal(diff.querySelectorAll('details.nv-conflit__entieres').length, 1);
});

test('un aperçu long est coupé, un bouton montre le reste ; une ligne n’est jamais perdue', () => {
  const ops = Array.from({ length: PLAFOND_DES_LIGNES + 7 }, (_, i) => operation(i + 1, 'applicable'));
  const coupe = lire(htmlDeLApercu(ops, { cle: 'abc:apercu' }));
  assert.equal(coupe.querySelectorAll('li.nv-lot-ligne').length, PLAFOND_DES_LIGNES);
  assert.equal(coupe.querySelector('[data-nv-toutes]').getAttribute('data-nv-toutes'), 'abc:apercu');
  const toutes = lire(htmlDeLApercu(ops, { cle: 'abc:apercu', toutes: true }));
  assert.equal(toutes.querySelectorAll('li.nv-lot-ligne').length, ops.length);
  assert.equal(toutes.querySelectorAll('[data-nv-toutes]').length, 0);
});

test('le HTML venu de la base s’échappe : un titre, un nom de ligne, une valeur ou un message n’ouvrent aucune balise', () => {
  const piege = '<img src=x onerror=alert(1)><script>alert(2)</script>';
  const l = lot('esc', {
    titre: piege, auteur: piege,
    essai: essai('a_corriger', [operation(1, 'refusee', { message: piege, apercu: apercu(piege, [colonne(piege, piege, `"${piege}"`)], piege) })], { problemes_nouveaux: [piege] }),
  });
  const fait = applique('fait', [ligne(1, { ligne: piege, table: piege, colonnes: [colonne(piege, piege, `"${piege}"`)], annulable_seule: false, motif: piege, etat: 'modifiee_depuis', depend_de: [9], colonnes_modifiees: [{ colonne: 'x', libelle: piege, ecrite: piege, trouvee: piege }] })], { titre: piege, auteur: piege, lignes_indisponibles: piege });
  const depot = lot('depot', { etat: 'refuse', titre: piege, refus: { motifs: [piege] } });
  const html = htmlDesLots({ lots: [l, fait, depot, lot('b', { etat: 'refuse', titre: piege, decide_le: '2026-11-14T11:00:00Z' })] }, { message: { texte: piege, lignes: [piege] }, messages: new Map([['esc', { texte: piege, erreur: true, lignes: [piege] }], ['fait#1', { texte: piege, erreur: true, lignes: [piege] }]]) });
  const racine = lire(html);
  assert.equal(racine.querySelectorAll('img, script').length, 0);
  assert.ok(racine.textContent.includes('<img src=x onerror=alert(1)>'), 'le texte reste lisible tel quel');
  for (const message of [messageDErreur({ message: piege, corps: { operations: [piege], problemes: [piege] } }), messageDuBilan({ titre: piege, bilan: { ecrites: 1, changees: 0 } }), messageDuRecalcul({ lot: {}, recalcul: { ecarts: 1 } })]) {
    assert.equal(lire(htmlDesLots({ lots: [] }, { message })).querySelectorAll('img, script').length, 0);
  }
  assert.equal(lire(htmlDeLaConfirmation({ action: 'appliquer', lot: l, verrous: [piege] })).querySelectorAll('img, script').length, 0);
  assert.equal(lire(htmlDeLaConfirmation({ action: 'refuser', lot: l })).querySelectorAll('img, script').length, 0);
  const apercuPiege = { verdict: 'verrous', verrous_a_ouvrir: [piege], comptes: { remises: 1 }, operations: [{ rang: 1, etat: 'gardee', message: piege, ecarts: [{ colonne: 'x', ecrite: piege, trouvee: piege }], apercu: apercu(piege, [colonne(piege, piege, piege)], piege) }] };
  assert.equal(lire(htmlDeLaConfirmation({ action: 'annuler-ligne', lot: fait, ligne: fait.lignes[0], apercu: apercuPiege })).querySelectorAll('img, script').length, 0);
  assert.equal(lire(htmlDesLots({ lots: [] }, { message: messageDeLaLigneAnnulee(fait.lignes[0], apercuPiege) })).querySelectorAll('img, script').length, 0);
});

test('un changement appliqué : ses lignes une à une (nom, table, avant, après), « Annuler cette modification » sur chaque ligne qui s’annule seule, plus aucun « Appliquer » ni « Annuler ce lot » (R291)', () => {
  const l = applique('ap', [
    ligne(1),
    ligne(2, { genre: 'inserer', colonnes: [colonne('Nom', null, 'Nouveau')] }),
    ligne(3, { genre: 'supprimer', colonnes: [colonne('Nom', 'Retiré', null)] }),
  ]);
  const article = lire(htmlDesLots({ lots: [l] })).querySelector('[data-nv-lot-id="ap"]');
  assert.equal(article.dataset.nvEtat, 'applique');
  assert.equal(article.querySelectorAll('[data-nv-appliquer], [data-nv-refuser], [data-nv-essai], [data-nv-annuler], [data-nv-confirmer-annulation]').length, 0, 'ni décision ni annulation du lot entier');
  const lignes = [...article.querySelectorAll('li.nv-lot-ligne')];
  assert.deepEqual(lignes.map((x) => x.dataset.nvLigne), ['1', '2', '3']);
  assert.deepEqual(lignes.map((x) => x.dataset.nvEtatLigne), ['en_place', 'en_place', 'en_place']);
  // le nom de la ligne et de sa table, comme le service les rend ; l'avant et l'après de la colonne
  assert.equal(lignes[0].querySelector('strong').textContent, 'Ligne 1');
  assert.ok(lignes[0].querySelector('.nv-lot-ligne__table').textContent.includes('Métiers'));
  assert.deepEqual(textes(lignes[0].querySelectorAll('.nv-version__texte')), ['avant 1', 'après 1']);
  assert.deepEqual(textes(lignes[1].querySelectorAll('.nv-version__texte')), ['(vide)', 'Nouveau'], 'une ligne créée : rien avant');
  assert.deepEqual(textes(lignes[2].querySelectorAll('.nv-version__texte')), ['Retiré', '(vide)'], 'une ligne retirée : rien après');
  // un bouton par ligne annulable, qui porte son numéro ; aucun motif à côté
  assert.deepEqual([...article.querySelectorAll('button[data-nv-annuler-ligne]')].map((b) => b.getAttribute('data-nv-annuler-ligne')), ['1', '2', '3']);
  assert.equal(article.querySelectorAll('[data-nv-motif]').length, 0);
  assert.equal(article.querySelector('[data-nv-bilan]').textContent.includes('3'), true, 'le nombre de modifications');
  // appliqué aussitôt : la date du dépôt n'est pas répétée
  assert.equal(lire(htmlDuLot(l)).querySelector('.nv-lot__meta').textContent.includes('Déposé'), false);
  assert.equal(lire(htmlDuLot({ ...l, application: null })).querySelector('.nv-lot__meta').textContent.includes('Déposé'), true, 'un lot appliqué par le clic garde sa date de dépôt');
});

test('une ligne qui ne s’annule pas seule dit pourquoi, avec les lignes dont elle dépend, et n’a pas de bouton ; une ligne annulée, changée depuis ou déjà comme avant dit son état', () => {
  const l = applique('ap', [
    ligne(1, { annulable_seule: false, motif: 'Cette ligne ne s’annule pas seule : tenue par une autre.', depend_de: [2] }),
    ligne(2, { genre: 'inserer' }),
    ligne(3, { etat: 'annulee', annulable_seule: false, motif: 'Cette ligne est déjà annulée.', annulee: { annule_le: '2026-11-15T09:00:00Z', lot_id: 'L2' } }),
    ligne(4, { etat: 'modifiee_depuis', annulable_seule: false, motif: 'Toutes ses valeurs ont changé depuis : le site prime, rien n’est remis.', colonnes_modifiees: [{ colonne: 'c_Description', libelle: 'Description', ecrite: 'écrit', trouvee: 'trouvé depuis' }] }),
    ligne(5, { etat: 'comme_avant', annulable_seule: false, motif: 'Rien à remettre.' }),
    ligne(6, { etat: 'modifiee_depuis', annulable_seule: true }),
  ]);
  const article = lire(htmlDesLots({ lots: [l] })).querySelector('[data-nv-lot-id="ap"]');
  const parN = (n) => article.querySelector(`li[data-nv-ligne="${n}"]`);
  // le bouton seulement pour une ligne en place que le service dit annulable seule
  assert.deepEqual([...article.querySelectorAll('button[data-nv-annuler-ligne]')].map((b) => b.getAttribute('data-nv-annuler-ligne')), ['2']);
  assert.deepEqual(['1', '2', '3', '4', '5', '6'].map((n) => parN(n).dataset.nvAnnulable), ['non', 'oui', 'non', 'non', 'non', 'non']);
  // le motif du service et le nom de la ligne dont elle dépend (par son nom, pas par son numéro)
  assert.ok(parN('1').querySelector('[data-nv-motif]').textContent.includes('ne s’annule pas seule'));
  assert.ok(parN('1').querySelector('[data-nv-motif]').textContent.includes('Ligne 2'));
  // l'état : annulée à sa date ; changée depuis avec la valeur trouvée ; déjà comme avant ; ces états ne répètent pas un motif redondant
  assert.ok(parN('3').querySelector('.nv-lot-ligne__etat').textContent.includes(motDeLEtat(l.lignes[2])));
  assert.ok(motDeLEtat(l.lignes[2]).startsWith('annulée'));
  assert.equal(parN('3').querySelectorAll('[data-nv-motif]').length, 0);
  assert.ok(parN('4').querySelector('.nv-lot-ligne__ecarts').textContent.includes('trouvé depuis'));
  assert.ok(parN('4').querySelector('.nv-lot-ligne__ecarts').textContent.includes('Description'));
  assert.ok(parN('4').querySelector('[data-nv-motif]'));
  assert.ok(motDeLEtat(l.lignes[4]));
  assert.equal(parN('5').querySelectorAll('[data-nv-motif], button').length, 0);
  assert.equal(motDeLEtat(ligne(7)), '', 'une ligne en place ne dit rien de plus');
  // le compte des annulées
  assert.ok(article.querySelector('[data-nv-bilan]').textContent.includes('6') && article.querySelector('[data-nv-bilan]').textContent.includes('1'));
  // la règle du bouton, seule
  assert.equal(peutAnnulerLaLigne(ligne(1)), true);
  assert.equal(peutAnnulerLaLigne(ligne(1, { annulable_seule: false })), false);
  assert.equal(peutAnnulerLaLigne(ligne(1, { etat: 'modifiee_depuis' })), false);
  assert.equal(peutAnnulerLaLigne(null), false);
});

test('un message sous la ligne (409 : une autre ligne la tient…) ; un changement sans détail dit qu’il ne s’annule pas d’ici ; une longue liste est coupée, « Tout montrer » donne le reste', () => {
  const l = applique('ap', [ligne(1), ligne(2)]);
  const html = htmlDesLots({ lots: [l] }, { messages: new Map([['ap#2', { texte: 'refus du service', erreur: true, lignes: ['une ligne la tient'] }]]) });
  const racine = lire(html);
  assert.equal(racine.querySelector('li[data-nv-ligne="1"] [data-nv-ligne-message]').hasAttribute('hidden'), true);
  const m = racine.querySelector('li[data-nv-ligne="2"] [data-nv-ligne-message]');
  assert.ok(m.textContent.includes('refus du service') && m.textContent.includes('une ligne la tient'));
  // journal indisponible (`lignes: null`) ou détail non lu : aucun bouton, la page le dit
  for (const sans of [applique('n', null, { lignes_indisponibles: 'le journal manque' }), applique('u', undefined)]) {
    const article = lire(htmlDesLots({ lots: [sans] })).querySelector(`[data-nv-lot-id="${sans.id}"]`);
    assert.equal(article.querySelectorAll('button').length, 0);
    assert.ok(article.querySelector('[data-nv-bilan-indisponible]'));
  }
  // une liste longue
  const longue = applique('lg', Array.from({ length: PLAFOND_DES_LIGNES + 4 }, (_, i) => ligne(i + 1)));
  const coupee = lire(htmlDesLots({ lots: [longue] }));
  assert.equal(coupee.querySelectorAll('li.nv-lot-ligne').length, PLAFOND_DES_LIGNES);
  assert.equal(coupee.querySelector('[data-nv-toutes]').getAttribute('data-nv-toutes'), 'lg:lignes');
  const toutes = lire(htmlDesLots({ lots: [longue] }, { toutes: new Set(['lg:lignes']) }));
  assert.equal(toutes.querySelectorAll('li.nv-lot-ligne').length, PLAFOND_DES_LIGNES + 4);
  assert.equal(toutes.querySelectorAll('[data-nv-toutes]').length, 0);
  // un lot sans ligne
  assert.ok(lire(htmlDesLots({ lots: [applique('v', [])] })).querySelector('[data-nv-lot-id="v"]').textContent.includes('0'));
});

test('la confirmation d’« Annuler cette modification » : la ligne, ce que l’annulation remettrait, une case par décision à ouvrir ; un aperçu refusé ou sans rien à remettre ne laisse que « Fermer » ; le bouton principal est inactif tant qu’une décision n’est pas cochée', () => {
  const l = applique('ap', [ligne(1)]);
  const op = (rang, etat, plus = {}) => ({ rang, genre: 'modifier', etat, apercu: apercu(`Ligne ${rang}`, [colonne('Description', 'maintenant', 'avant le lot')]), ...plus });
  const ok = { verdict: 'applicable', verrous_a_ouvrir: [], comptes: { remises: 1, gardees: 0, deja: 0, verrouillees: 0, refusees: 0 }, operations: [op(1, 'remise')] };
  const f = lire(htmlDeLaConfirmation({ action: 'annuler-ligne', lot: l, ligne: l.lignes[0], apercu: ok }));
  assert.equal(f.querySelectorAll('form').length, 1);
  assert.ok(f.querySelector('h2'));
  assert.ok(f.textContent.includes('Ligne 1') && f.textContent.includes(l.titre));
  assert.deepEqual(textes(f.querySelectorAll('.nv-version__texte')), ['maintenant', 'avant le lot'], 'l’aperçu : ce que la ligne porte, ce qu’elle redeviendrait');
  assert.equal(f.querySelectorAll('button[value="annuler"]').length, 1);
  assert.equal(f.querySelectorAll('button[type="submit"].nv-principal[data-nv-confirmer-ligne]').length, 1);
  assert.equal(f.querySelector('[data-nv-confirmer-ligne]').hasAttribute('disabled'), false);
  // une valeur gardée parce que le site l'a changée depuis : dite avec la valeur trouvée
  const gardee = { ...ok, comptes: { remises: 0, gardees: 1 }, operations: [op(1, 'gardee', { ecarts: [{ colonne: 'c_Description', ecrite: 'écrit', avant: 'avant', trouvee: 'trouvé depuis' }] })] };
  assert.ok(lire(htmlDeLaConfirmation({ action: 'annuler-ligne', lot: l, ligne: l.lignes[0], apercu: gardee })).textContent.includes('trouvé depuis'));
  // une décision à ouvrir : une case, le bouton attend qu'elle soit cochée
  const verrou = { ...ok, verdict: 'verrous', verrous_a_ouvrir: ['R219'] };
  const sans = lire(htmlDeLaConfirmation({ action: 'annuler-ligne', lot: l, ligne: l.lignes[0], apercu: verrou }));
  assert.equal(sans.querySelectorAll('[data-nv-verrou="R219"]').length, 1);
  assert.equal(sans.querySelector('[data-nv-confirmer-ligne]').hasAttribute('disabled'), true);
  assert.equal(sans.querySelector('[data-nv-raison]').hasAttribute('hidden'), false);
  const cochee = lire(htmlDeLaConfirmation({ action: 'annuler-ligne', lot: l, ligne: l.lignes[0], apercu: verrou, verrous: ['R219'] }));
  assert.equal(cochee.querySelector('[data-nv-confirmer-ligne]').hasAttribute('disabled'), false);
  assert.equal(cochee.querySelector('[data-nv-verrou]').hasAttribute('checked'), true);
  // refusée ou rien à remettre : pas de bouton qui annule
  for (const verdict of ['refusee', 'rien_a_remettre']) {
    const refusee = lire(htmlDeLaConfirmation({ action: 'annuler-ligne', lot: l, ligne: l.lignes[0], apercu: { ...ok, verdict, operations: [op(1, 'refusee', { message: 'un contrôle refuse' })] } }));
    assert.equal(refusee.querySelectorAll('[data-nv-confirmer-ligne]').length, 0, verdict);
    assert.equal(refusee.querySelectorAll('button[value="annuler"]').length, 1, verdict);
  }
  assert.equal(phraseDeLAnnulation(ok).niveau, 'pret');
  assert.equal(phraseDeLAnnulation({ verdict: 'refusee', operations: [{ rang: 2, etat: 'refusee', message: 'refus' }] }).lignes.length, 1);
  assert.equal(peutAnnuler(verrou).possible, false);
  assert.equal(peutAnnuler(verrou, new Set(['R219'])).possible, true);
  assert.deepEqual(corpsDuClic(['R219'], new Set(['R219', 'R1'])), { verrous_ouverts: ['R219'] });
});

test('la section ne montre que ce qui change par rapport à la production : les propositions en attente s’il en reste et tous les changements en écart, ni les livrés, ni les refusés, ni les annulés ; « Tout recalculer » et « Actualiser » toujours là', () => {
  const vide = lire(htmlDesLots({ lots: [] }));
  assert.equal(vide.querySelectorAll('button[data-nv-recalcul], button[data-nv-lots-actualiser]').length, 2);
  assert.equal(vide.querySelectorAll('[data-nv-lot-id]').length, 0);
  assert.equal(vide.querySelectorAll('[data-nv-lots-attente]').length, 0, 'rien d’en attente : pas de bloc');
  assert.equal(vide.querySelectorAll('[data-nv-lots-appliques]').length, 1);
  // aucune limite : la liste sert au patch note, elle est complète
  const appliques = Array.from({ length: 13 }, (_, i) => applique(`ap${i}`, [ligne(1)], { ecart_production: true, decide_le: `2026-11-${String(10 + i).padStart(2, '0')}T10:00:00Z` }));
  const depot = lot('d', { etat: 'refuse', titre: 'Dépôt refusé', depose_le: '2026-11-14T10:00:00Z', refus: { motifs: ['une ligne refusée'], par: 'cle_de_depot' } });
  const livre = applique('livre', [ligne(1)], { ecart_production: false, decide_le: '2026-11-30T10:00:00Z' });
  const lots = [lot('p1'), lot('p2'), ...appliques, livre, depot, lot('r', { etat: 'refuse' }), lot('a', { etat: 'annule', annule_le: '2026-11-14T13:00:00Z' })];
  const racine = lire(htmlDesLots({ lots }));
  assert.equal(racine.querySelectorAll('[data-nv-lots-attente] [data-nv-lot-id]').length, 2, 'les propositions gardent leur bloc');
  assert.equal(racine.querySelectorAll('[data-nv-lots-attente] button[data-nv-appliquer]').length, 2);
  const montres = [...racine.querySelectorAll('[data-nv-lots-appliques] [data-nv-lot-id]')].map((a) => a.dataset.nvLotId);
  assert.equal(montres.length, 13);
  assert.equal(montres[0], 'ap12', 'le plus récemment appliqué d’abord');
  assert.equal(montres.includes('ap0'), true, 'les plus anciens aussi');
  for (const absent of ['livre', 'd', 'r', 'a']) assert.equal(racine.querySelectorAll(`[data-nv-lot-id="${absent}"]`).length, 0, absent);
  // la référence manque (`ecart_production` absent ou null) : on ne peut pas dire, le changement reste montré
  assert.equal(lire(htmlDesLots({ lots: [applique('s', [ligne(1)]), applique('n', [ligne(1)], { ecart_production: null })] })).querySelectorAll('[data-nv-lots-appliques] [data-nv-lot-id]').length, 2);
  // dans un changement, seules les lignes en écart se lisent et se comptent
  const partiel = lire(htmlDuLot(applique('m', [ligne(1, { ecart_production: false }), ligne(2, { ecart_production: true })], { ecart_production: true })));
  assert.deepEqual([...partiel.querySelectorAll('[data-nv-ligne]')].map((l) => l.getAttribute('data-nv-ligne')), ['2']);
  assert.match(partiel.querySelector('[data-nv-bilan]').textContent, /^1 /);
  // la section entière se replie sous son titre : repliée au départ, ouverte tant qu'une proposition attend son clic ; le message reste au-dessus
  const repli = (html) => lire(html).querySelector('details[data-nv-lots-repli]');
  assert.equal(repli(htmlDesLots({ lots: [] })).hasAttribute('open'), false, 'rien à montrer : repliée');
  assert.equal(repli(htmlDesLots({ lots: appliques })).hasAttribute('open'), false, 'des changements appliqués seulement : repliée');
  assert.equal(repli(htmlDesLots({ lots: appliques }, { ouverts: new Set(['section']) })).hasAttribute('open'), true, 'dépliée par le propriétaire : elle le reste');
  assert.equal(repli(htmlDesLots({ lots })).hasAttribute('open'), true, 'une proposition attend : ouverte');
  assert.equal(repli(htmlDesLots({ lots })).getAttribute('data-nv-ouvert'), 'section');
  const tout = repli(htmlDesLots({ lots }));
  assert.equal(tout.querySelectorAll('summary h3').length, 1, 'le titre est ce qui déplie');
  assert.equal(tout.querySelectorAll('[data-nv-lots-attente], [data-nv-lots-appliques], button[data-nv-recalcul]').length, 3, 'tout le reste est dedans');
  const avecMessage = lire(htmlDesLots({ lots: appliques }, { message: { texte: 'fait' } }));
  assert.equal(avecMessage.querySelectorAll('[data-nv-lots-message]').length, 1);
  assert.equal(avecMessage.querySelectorAll('details[data-nv-lots-repli] [data-nv-lots-message]').length, 0, 'le message se lit même section repliée');
  // ce que le propriétaire a déplié reste ouvert
  const ouvert = lire(htmlDesLots({ lots }, { ouverts: new Set(['p1:apercu']) }));
  assert.equal(ouvert.querySelector('[data-nv-lot-id="p1"] details.nv-lot__apercu').hasAttribute('open'), true);
  assert.equal(ouvert.querySelector('[data-nv-lot-id="p2"] details.nv-lot__apercu').hasAttribute('open'), false);
});

test('aucun jargon à lire : ni « nature », ni « opération », ni JSON, ni nom technique de colonne, dans la section ni dans la confirmation', () => {
  const l = lot('j', { nature: 'code', decision: null, essai: essai('verrous', [operation(1, 'verrouillee', { decisions: ['R218'] }), operation(2, 'changee', { ecarts: [{ colonne: 'c_Description', attendue: 1, actuelle: 2 }] })], { verrous_a_ouvrir: ['R218'] }) });
  const fait = applique('k', [ligne(1, { colonnes_modifiees: [{ colonne: 'c_Description', libelle: 'Description', ecrite: 1, trouvee: 2 }], etat: 'modifiee_depuis', annulable_seule: false, motif: 'Toutes ses valeurs ont changé depuis.' }), ligne(2)]);
  const confirmation = htmlDeLaConfirmation({ action: 'annuler-ligne', lot: fait, ligne: fait.lignes[1], apercu: { verdict: 'applicable', verrous_a_ouvrir: [], comptes: { remises: 1 }, operations: [{ rang: 2, genre: 'modifier', etat: 'remise', apercu: apercu('Ligne 2', [colonne('Description', 'a', 'b')]) }] } });
  const texte = lire(htmlDesLots({ lots: [l, fait, lot('m', { etat: 'annule' })] })).textContent + lire(htmlDeLaConfirmation({ action: 'appliquer', lot: l, verrous: ['R218'] })).textContent + lire(confirmation).textContent;
  assert.doesNotMatch(texte, /JSON|nature|op[ée]ration|\bc_Description\b|[{}]/i);
  // et « lot » ne se lit pas dans ce que montre un changement appliqué ni dans la confirmation d'annulation (le titre du changement mis à part)
  const sansTitre = (html) => lire(html).textContent.replaceAll(fait.titre, '');
  assert.doesNotMatch(sansTitre(htmlDuLot(fait)), /\blots?\b/i);
  assert.doesNotMatch(sansTitre(confirmation), /\blots?\b/i);
  assert.equal(origineDuLot(l).includes('code'), true);
  assert.equal(origineDuLot(lot('x', { nature: 'decision', decision: 'R275' })), 'décision R275');
});

test('les messages d’après un clic : bilan d’une proposition (écrit, gardé, nommé), annulation d’une modification, recalcul, erreur du service (la ligne à corriger, les contrôles, les décisions à cocher)', () => {
  const applique = lot('b', {
    etat: 'applique', essai: essai('applicable', [operation(1, 'applicable'), operation(2, 'applicable', { apercu: apercu('Ligne gardée', [colonne('Bonus', 'a', 'b')]) })]),
    bilan: { ecrites: 1, changees: 1, operations: [{ rang: 1, etat: 'ecrite' }, { rang: 2, etat: 'changee', ecarts: [{ colonne: 'c_Bonus', attendue: 'a', actuelle: 'z' }] }] },
  });
  const bilan = messageDuBilan(applique);
  assert.ok(bilan.texte.includes(applique.titre));
  assert.equal(bilan.lignes.length, 1, 'une ligne gardée');
  assert.ok(bilan.lignes[0].includes('Ligne gardée') && bilan.lignes[0].includes('z') && bilan.lignes[0].includes('Bonus'));
  assert.equal(messageDuBilan(lot('c', { bilan: { ecrites: 2, changees: 0, operations: [] } })).lignes.length, 0);
  // l'annulation d'une modification : la ligne est nommée, les valeurs gardées sont dites par l'aperçu montré avant
  const apercuAvant = { comptes: { remises: 1, gardees: 1, deja: 0 }, operations: [{ rang: 3, etat: 'gardee', ecarts: [{ colonne: 'c_Bonus', ecrite: 'a', avant: 'b', trouvee: 'z' }], apercu: apercu('Gardée d’avant', [colonne('Bonus', 'z', 'b')]) }] };
  const m = messageDeLaLigneAnnulee(ligne(3, { ligne: 'Ligne annulée' }), apercuAvant);
  assert.ok(m.texte.includes('Ligne annulée') && m.texte.includes('Métiers'));
  assert.equal(m.lignes.length, 1);
  assert.ok(m.lignes[0].includes('Gardée d’avant') && m.lignes[0].includes('z') && m.lignes[0].includes('Bonus'));
  assert.deepEqual(messageDeLaLigneAnnulee(ligne(3), null).lignes, [], 'sans aperçu, rien d’inventé');
  // le recalcul
  assert.equal(messageDuRecalcul({ lot: null, recalcul: { ecarts: 0, pages_illisibles: [] } }).erreur, false);
  assert.ok(messageDuRecalcul({ lot: { id: 'x' }, recalcul: { ecarts: 12, pages_illisibles: [] } }).texte.includes('12'));
  // appliqué aussitôt (clé de dépôt posée) ou proposé : le message ne promet pas de clic quand le recalcul est déjà appliqué
  const direct = messageDuRecalcul({ lot: { id: 'x', etat: 'applique' }, recalcul: { ecarts: 3, pages_illisibles: [] } }).texte;
  const propose = messageDuRecalcul({ lot: { id: 'x', etat: 'propose' }, recalcul: { ecarts: 3, pages_illisibles: [] } }).texte;
  assert.notEqual(direct, propose);
  assert.doesNotMatch(direct, /appliquez/i);
  assert.match(propose, /appliquez/i);
  assert.ok(messageDuRecalcul({ lot: null, recalcul: { ecarts: 0, pages_illisibles: [{ page: 'p', raison: 'r' }] } }).texte.includes('1'));
  // une erreur 409 du service : son texte, la ligne à corriger, les contrôles, les décisions
  const e = messageDErreur({ message: 'Opération 3 refusée : x', corps: { operations: ['opération 3 : x', { rang: 4, message: 'y' }], problemes: ['un problème'], verrous: ['R218', 'R219'] } });
  assert.equal(e.erreur, true);
  assert.equal(e.texte, 'Opération 3 refusée : x');
  assert.equal(e.lignes.length, 4);
  assert.ok(e.lignes[1].includes('4') && e.lignes[1].includes('y'));
  assert.ok(e.lignes[3].includes('R218') && e.lignes[3].includes('R219'));
  assert.deepEqual(messageDErreur({}).lignes, []);
});

test('la confirmation : le titre du lot, ce que le clic fait, les décisions ouvertes ; « Revenir en arrière » et le bouton principal', () => {
  const l = lot('c', { essai: essai('applicable', [operation(1, 'applicable'), operation(2, 'changee', { ecarts: [{ colonne: 'x', attendue: 1, actuelle: 2 }] })]) });
  const f = lire(htmlDeLaConfirmation({ action: 'appliquer', lot: l, verrous: ['R218'] }));
  assert.equal(f.querySelectorAll('form').length, 1);
  assert.ok(f.querySelector('h2').textContent.includes(l.titre));
  assert.ok(f.textContent.includes('R218'));
  assert.equal(f.querySelectorAll('button[value="annuler"]').length, 1);
  assert.equal(f.querySelectorAll('button[type="submit"].nv-principal').length, 1);
  const refus = lire(htmlDeLaConfirmation({ action: 'refuser', lot: l }));
  assert.ok(refus.querySelector('h2').textContent.includes(l.titre));
  assert.equal(refus.textContent.includes('R218'), false);
});

test('l’accord au pluriel : « sa valeur » pour une ligne gardée, « leur valeur » pour plusieurs (bilan, modification annulée, aperçu de l’annulation) ; sans liste de décisions, aucun numéro inventé', () => {
  const bilan = (n) => messageDuBilan(lot('b', { bilan: { ecrites: 1, changees: n, operations: [] } })).texte;
  const annulation = (n) => messageDeLaLigneAnnulee(ligne(1), { comptes: { remises: 1, gardees: n, deja: 0 }, operations: [] }).texte;
  const apercu = (n) => phraseDeLAnnulation({ verdict: 'applicable', comptes: { remises: 1, gardees: n } }).texte;
  for (const [f, un, deux] of [[bilan, /sa valeur/, /leur valeur/], [annulation, /sa valeur/, /leur valeur/], [apercu, /sa valeur/, /leur valeur/]]) {
    assert.match(f(1), un);
    assert.doesNotMatch(f(1), /leur valeur/);
    assert.match(f(2), deux);
    assert.doesNotMatch(f(2), /sa valeur/);
  }
  // un verdict « verrous » sans liste de décisions : la phrase ne cite ni « ? » ni numéro
  const sans = phraseDeLEssai(lot('v', { essai: essai('verrous', [operation(1, 'verrouillee')], { verrous_a_ouvrir: [] }) }));
  assert.equal(sans.niveau, 'accord');
  assert.doesNotMatch(sans.texte, /\?|\bR\d+\b/);
});

test('R309 : un lot d’ancrage est replié derrière son titre et son nombre de lignes ; ses lignes restent consultables et annulables une à une, les autres lots ne sont pas repliés', () => {
  const lignes = [ligne(1), ligne(2), ligne(3, { annulable_seule: false, motif: 'Une autre ligne la tient.', depend_de: [1] }), ligne(4, { ecart_production: false }), ligne(5, { etat: 'annulee', annulable_seule: false })];
  const ancrage = applique('anc', lignes, { decision: 'R309', titre: 'Ancrage d’essai', auteur: 'préparer l’ancrage' });
  const article = lire(htmlDesLots({ lots: [ancrage] })).querySelector('[data-nv-lots-appliques] [data-nv-lot-id="anc"]');
  const repli = article.querySelector('details.nv-lot__repli');
  assert.ok(repli, 'le lot est dans un bloc dépliant');
  assert.equal(repli.hasAttribute('open'), false, 'replié au départ');
  assert.equal(repli.getAttribute('data-nv-ouvert'), 'anc:lot', 'la page garde ce que le propriétaire déplie');
  // le titre et le nombre de lignes (celles en écart avec la production : 4 sur 5) sont ce qui déplie
  const resume = repli.querySelector('summary');
  assert.ok(resume.textContent.includes('Ancrage d’essai') && resume.textContent.includes('R309'));
  assert.equal(resume.querySelectorAll('h4.nv-lot__titre').length, 1);
  assert.match(resume.querySelector('.nv-lot__compte').textContent, /^4 lignes$/);
  // les lignes restent consultables (valeurs avant et après) et chacune garde son geste d'annulation, ou la raison pour laquelle elle n'en a pas
  assert.deepEqual([...repli.querySelectorAll('li.nv-lot-ligne')].map((l) => l.getAttribute('data-nv-ligne')), ['1', '2', '3', '5']);
  assert.deepEqual([...repli.querySelectorAll('button[data-nv-annuler-ligne]')].map((b) => b.getAttribute('data-nv-annuler-ligne')), ['1', '2']);
  assert.ok(repli.querySelector('li[data-nv-ligne="3"] [data-nv-motif]').textContent.includes('Une autre ligne la tient.'));
  assert.deepEqual(textes(repli.querySelectorAll('li[data-nv-ligne="1"] .nv-version__texte')), ['avant 1', 'après 1']);
  assert.match(repli.querySelector('[data-nv-bilan]').textContent, /^4 modifications, dont 1 annulée\.$/);
  // « Tout montrer » et le message d'une ligne restent dans le bloc ; le message du changement reste visible replié
  const long = applique('long', Array.from({ length: PLAFOND_DES_LIGNES + 5 }, (_, i) => ligne(i + 1)), { decision: 'R309' });
  const vueLongue = lire(htmlDuLot(long, { messages: new Map([['long', { texte: 'Dit au clic', erreur: false }]]) })).querySelector('article');
  assert.equal(vueLongue.querySelectorAll('details.nv-lot__repli li.nv-lot-ligne').length, PLAFOND_DES_LIGNES);
  assert.equal(vueLongue.querySelectorAll('details.nv-lot__repli button[data-nv-toutes="long:lignes"]').length, 1);
  assert.equal(vueLongue.querySelectorAll('details.nv-lot__repli [data-nv-lot-message]').length, 0, 'le message du changement n’est pas dans le bloc replié');
  assert.equal(vueLongue.querySelector('[data-nv-lot-message]').textContent.includes('Dit au clic'), true);
  assert.equal(lire(htmlDuLot(long, { toutes: new Set(['long:lignes']) })).querySelectorAll('details.nv-lot__repli button[data-nv-annuler-ligne]').length, PLAFOND_DES_LIGNES + 5, 'toutes les lignes, chacune annulable');
  // déplié par le propriétaire : il le reste d'un rendu à l'autre
  assert.equal(lire(htmlDuLot(ancrage, { ouverts: new Set(['anc:lot']) })).querySelector('details.nv-lot__repli').hasAttribute('open'), true);
  // une proposition d'ancrage qui attend son clic reste ouverte : ses boutons ne se cachent pas
  const attente = lire(htmlDuLot(lot('att', { decision: 'R309' }))).querySelector('article');
  assert.equal(attente.querySelector('details.nv-lot__repli').hasAttribute('open'), true);
  assert.equal(attente.querySelectorAll('details.nv-lot__repli button[data-nv-appliquer]').length, 1);
  // un autre changement n'est pas replié ; un changement d'ancrage dont le détail manque n'a ni bloc ni nombre inventé
  assert.equal(lire(htmlDuLot(applique('autre', [ligne(1)], { decision: 'R275' }))).querySelectorAll('details.nv-lot__repli').length, 0);
  assert.equal(lire(htmlDuLot(applique('autre', [ligne(1)], { decision: null }))).querySelectorAll('details.nv-lot__repli').length, 0);
  const sansDetail = lire(htmlDuLot({ ...ancrage, lignes: null })).querySelector('article');
  assert.equal(sansDetail.querySelectorAll('[data-nv-bilan-indisponible]').length, 1);
  assert.equal(sansDetail.querySelectorAll('.nv-lot__compte').length, 0, 'sans le détail, aucun nombre inventé');
});
