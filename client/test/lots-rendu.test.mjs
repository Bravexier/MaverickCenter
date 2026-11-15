// Le rendu des lots de changements sur la page « Mise à jour » (src/lib/lots-rendu.mjs ; R275, question 4 a : « Chaque lot attend votre clic sur le site de
// dev, avec un aperçu avant et après. » ; R276 : le propriétaire s'occupe le moins possible, sans jargon), sans navigateur ni service : le HTML lu par le faux
// DOM, sur des lots à la forme que rend le service (serveur/edition-lots.mjs). Aucun texte figé : la structure (attributs `data-nv-…`), les données montrées
// et leur échappement ; la forme réelle du service est éprouvée dans test/lots-rendu-service.test.mjs.
//   node --test test/lots-rendu.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  APPLIQUES_RECENTS, PLAFOND_DES_LIGNES, corpsDuClic, htmlDeLApercu, htmlDeLaConfirmation, htmlDesLots, htmlDuLot, messageDeLAnnulation, messageDErreur, messageDuBilan,
  messageDuRecalcul, origineDuLot, peutAnnuler, peutAppliquer, phraseDeLAnnulation, phraseDeLEssai, verrousDuLot,
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
  const html = htmlDesLots({ lots: [l, lot('b', { etat: 'refuse', titre: piege, decide_le: '2026-11-14T11:00:00Z' })] }, { message: { texte: piege, lignes: [piege] }, messages: new Map([['esc', { texte: piege, erreur: true, lignes: [piege] }]]) });
  const racine = lire(html);
  assert.equal(racine.querySelectorAll('img, script').length, 0);
  assert.ok(racine.textContent.includes('<img src=x onerror=alert(1)>'), 'le texte reste lisible tel quel');
  for (const message of [messageDErreur({ message: piege, corps: { operations: [piege], problemes: [piege] } }), messageDuBilan({ titre: piege, bilan: { ecrites: 1, changees: 0 } }), messageDuRecalcul({ lot: {}, recalcul: { ecarts: 1 } })]) {
    assert.equal(lire(htmlDesLots({ lots: [] }, { message })).querySelectorAll('img, script').length, 0);
  }
  assert.equal(lire(htmlDeLaConfirmation({ action: 'appliquer', lot: l, verrous: [piege] })).querySelectorAll('img, script').length, 0);
  assert.equal(lire(htmlDeLaConfirmation({ action: 'refuser', lot: l })).querySelectorAll('img, script').length, 0);
});

test('les lots appliqués : bilan (écrit, gardé), aperçu, « Annuler ce lot » ; l’aperçu de l’annulation dit ce qui est remis, déjà comme avant, gardé avec la valeur trouvée', () => {
  const ops = [operation(1, 'applicable'), operation(2, 'applicable')];
  const applique = lot('ap', {
    etat: 'applique', decide_le: '2026-11-14T12:00:00Z', lot_id: 'L1', essai: essai('applicable', ops),
    bilan: { ecrites: 1, changees: 1, operations: [{ rang: 1, etat: 'ecrite' }, { rang: 2, etat: 'changee', ecarts: [{ colonne: 'c_Description', attendue: 'attendu', actuelle: 'trouvé' }] }], numeros: [], verrous_ouverts: [] },
  });
  const racine = lire(htmlDesLots({ lots: [applique] }));
  const article = racine.querySelector('[data-nv-lot-id="ap"]');
  assert.equal(article.dataset.nvEtat, 'applique');
  assert.equal(article.querySelectorAll('[data-nv-appliquer], [data-nv-refuser]').length, 0, 'un lot appliqué ne se décide plus');
  assert.equal(article.querySelectorAll('button[data-nv-annuler]').length, 1);
  assert.ok(article.querySelector('[data-nv-bilan]'));
  // les lignes gardées sont nommées (le bilan du service n'a pas les noms : ceux de l'essai, par rang)
  assert.equal(article.querySelectorAll('li.nv-lot-ligne[data-nv-etat-ligne="changee"]').length, 1);
  assert.ok(article.textContent.includes('Ligne 2') && article.textContent.includes('trouvé'));
  // l'aperçu de l'annulation, une fois demandé : trois sortes de lignes, le bouton de confirmation, plus de bouton « Annuler ce lot »
  const annulation = {
    verdict: 'applicable', verrous_a_ouvrir: [], comptes: { remises: 1, gardees: 1, deja: 1, verrouillees: 0, refusees: 0 },
    operations: [
      { rang: 1, genre: 'modifier', etat: 'remise', apercu: apercu('Remise', [colonne('Description', 'maintenant', 'avant le lot')]) },
      { rang: 2, genre: 'modifier', etat: 'deja', apercu: apercu('Déjà', [colonne('Description', 'x', 'x')]) },
      { rang: 3, genre: 'modifier', etat: 'gardee', ecarts: [{ colonne: 'c_Description', ecrite: 'écrit par le lot', avant: 'd’avant', trouvee: 'valeur du site' }], apercu: apercu('Gardée', [colonne('Description', 'valeur du site', 'd’avant')]) },
    ],
  };
  const avec = lire(htmlDesLots({ lots: [applique] }, { annulations: new Map([['ap', { apercu: annulation }]]) })).querySelector('[data-nv-lot-id="ap"]');
  assert.equal(avec.querySelectorAll('button[data-nv-annuler]').length, 0);
  assert.deepEqual([...avec.querySelectorAll('[data-nv-annulation] li.nv-lot-ligne')].map((l) => l.dataset.nvEtatLigne), ['remise', 'deja', 'gardee']);
  const gardee = avec.querySelector('[data-nv-annulation] li[data-nv-etat-ligne="gardee"]');
  assert.ok(gardee.textContent.includes('valeur du site') && gardee.textContent.includes('écrit par le lot'));
  assert.equal(gardee.querySelectorAll('.nv-lot-colonne').length, 0);
  assert.equal(avec.querySelector('[data-nv-verdict-annulation]').dataset.nvVerdictAnnulation, 'applicable');
  assert.equal(avec.querySelector('[data-nv-confirmer-annulation]').hasAttribute('disabled'), false);
  assert.equal(avec.querySelectorAll('[data-nv-renoncer]').length, 1);
  // rien à remettre ou annulation refusée : la confirmation est inactive
  for (const verdict of ['rien_a_remettre', 'refusee']) {
    const page = lire(htmlDesLots({ lots: [applique] }, { annulations: new Map([['ap', { apercu: { ...annulation, verdict } }]]) })).querySelector('[data-nv-confirmer-annulation]');
    assert.equal(page.hasAttribute('disabled'), true, verdict);
  }
  // une décision à ouvrir : une case, la confirmation attend qu'elle soit cochée
  const verrou = { ...annulation, verdict: 'verrous', verrous_a_ouvrir: ['R219'] };
  const sans = lire(htmlDesLots({ lots: [applique] }, { annulations: new Map([['ap', { apercu: verrou }]]) })).querySelector('[data-nv-annulation]');
  assert.equal(sans.querySelectorAll('[data-nv-verrou]').length, 1);
  assert.equal(sans.querySelector('[data-nv-confirmer-annulation]').hasAttribute('disabled'), true);
  const cochee = lire(htmlDesLots({ lots: [applique] }, { annulations: new Map([['ap', { apercu: verrou }]]), coches: new Map([['annulation:ap', new Set(['R219'])]]) })).querySelector('[data-nv-annulation]');
  assert.equal(cochee.querySelector('[data-nv-confirmer-annulation]').hasAttribute('disabled'), false);
  // le calcul en cours et l'erreur
  assert.equal(lire(htmlDesLots({ lots: [applique] }, { annulations: new Map([['ap', { chargement: true }]]) })).querySelectorAll('[data-nv-confirmer-annulation]').length, 0);
  assert.equal(lire(htmlDesLots({ lots: [applique] }, { annulations: new Map([['ap', { erreur: 'refusé' }]]) })).querySelectorAll('[data-nv-confirmer-annulation]').length, 0);
  assert.equal(phraseDeLAnnulation(annulation).niveau, 'pret');
  assert.equal(phraseDeLAnnulation({ verdict: 'refusee', operations: [{ rang: 2, etat: 'refusee', message: 'refus' }] }).lignes.length, 1);
});

test('la section : les lots à décider, les appliqués récents seulement, un historique replié des refusés et des annulés ; « Tout recalculer » et « Actualiser » toujours là', () => {
  const vide = lire(htmlDesLots({ lots: [] }));
  assert.equal(vide.querySelectorAll('button[data-nv-recalcul], button[data-nv-lots-actualiser]').length, 2);
  assert.equal(vide.querySelectorAll('[data-nv-lot-id]').length, 0);
  assert.equal(vide.querySelectorAll('[data-nv-lots-historique]').length, 0);
  const appliques = Array.from({ length: APPLIQUES_RECENTS + 3 }, (_, i) => lot(`ap${i}`, { etat: 'applique', decide_le: `2026-11-${String(10 + i).padStart(2, '0')}T10:00:00Z` }));
  const lots = [lot('p1'), lot('p2'), ...appliques, lot('r', { etat: 'refuse' }), lot('a', { etat: 'annule', annule_le: '2026-11-14T13:00:00Z' })];
  const racine = lire(htmlDesLots({ lots }));
  assert.equal(racine.querySelectorAll('[data-nv-lots-attente] [data-nv-lot-id]').length, 2);
  const montres = [...racine.querySelectorAll('[data-nv-lots-appliques] [data-nv-lot-id]')].map((a) => a.dataset.nvLotId);
  assert.equal(montres.length, APPLIQUES_RECENTS);
  assert.equal(montres[0], `ap${APPLIQUES_RECENTS + 2}`, 'le plus récemment appliqué d’abord');
  assert.equal(montres.includes('ap0'), false, 'les plus anciens ne sont pas montrés');
  const historique = racine.querySelector('details[data-nv-lots-historique]');
  assert.equal(historique.hasAttribute('open'), false, 'replié');
  assert.deepEqual([...historique.querySelectorAll('[data-nv-lot-id]')].map((a) => a.dataset.nvEtat).sort(), ['annule', 'refuse']);
  assert.equal(historique.querySelectorAll('button').length, 0);
  // ce que le propriétaire a déplié reste ouvert
  const ouvert = lire(htmlDesLots({ lots }, { ouverts: new Set(['historique', 'p1:apercu']) }));
  assert.equal(ouvert.querySelector('details[data-nv-lots-historique]').hasAttribute('open'), true);
  assert.equal(ouvert.querySelector('[data-nv-lot-id="p1"] details.nv-lot__apercu').hasAttribute('open'), true);
  assert.equal(ouvert.querySelector('[data-nv-lot-id="p2"] details.nv-lot__apercu').hasAttribute('open'), false);
});

test('aucun jargon à lire : ni « nature », ni « opération », ni JSON, ni nom technique de colonne, dans la section ni dans la confirmation', () => {
  const l = lot('j', { nature: 'code', decision: null, essai: essai('verrous', [operation(1, 'verrouillee', { decisions: ['R218'] }), operation(2, 'changee', { ecarts: [{ colonne: 'c_Description', attendue: 1, actuelle: 2 }] })], { verrous_a_ouvrir: ['R218'] }) });
  const applique = lot('k', { etat: 'applique', bilan: { ecrites: 1, changees: 0, operations: [{ rang: 1, etat: 'ecrite' }] } });
  const texte = lire(htmlDesLots({ lots: [l, applique, lot('m', { etat: 'annule' })] })).textContent + lire(htmlDeLaConfirmation({ action: 'appliquer', lot: l, verrous: ['R218'] })).textContent;
  assert.doesNotMatch(texte, /JSON|nature|op[ée]ration|\bc_Description\b|[{}]/i);
  assert.equal(origineDuLot(l).includes('code'), true);
  assert.equal(origineDuLot(lot('x', { nature: 'decision', decision: 'R275' })), 'décision R275');
});

test('les messages d’après un clic : bilan (écrit, gardé, nommé), annulation, recalcul, erreur du service (la ligne à corriger, les contrôles, les décisions à cocher)', () => {
  const applique = lot('b', {
    etat: 'applique', essai: essai('applicable', [operation(1, 'applicable'), operation(2, 'applicable', { apercu: apercu('Ligne gardée', [colonne('Bonus', 'a', 'b')]) })]),
    bilan: { ecrites: 1, changees: 1, operations: [{ rang: 1, etat: 'ecrite' }, { rang: 2, etat: 'changee', ecarts: [{ colonne: 'c_Bonus', attendue: 'a', actuelle: 'z' }] }] },
  });
  const bilan = messageDuBilan(applique);
  assert.ok(bilan.texte.includes(applique.titre));
  assert.equal(bilan.lignes.length, 1, 'une ligne gardée');
  assert.ok(bilan.lignes[0].includes('Ligne gardée') && bilan.lignes[0].includes('z') && bilan.lignes[0].includes('Bonus'));
  assert.equal(messageDuBilan(lot('c', { bilan: { ecrites: 2, changees: 0, operations: [] } })).lignes.length, 0);
  // l'annulation : les lignes gardées sont nommées par l'aperçu montré avant
  const annule = lot('d', { etat: 'annule', bilan: { annulation: { remises: 2, gardees: 1, deja: 0, operations: [{ rang: 3, etat: 'gardee', ecarts: [{ colonne: 'c_Bonus', ecrite: 'a', avant: 'b', trouvee: 'z' }] }] } } });
  const apercuAvant = { operations: [{ rang: 3, apercu: apercu('Gardée d’avant', [colonne('Bonus', 'z', 'b')]) }] };
  const m = messageDeLAnnulation(annule, apercuAvant);
  assert.equal(m.lignes.length, 1);
  assert.ok(m.lignes[0].includes('Gardée d’avant') && m.lignes[0].includes('z'));
  assert.equal(messageDeLAnnulation(annule).lignes.length, 1, 'sans l’aperçu, la ligne est dite par son rang');
  // le recalcul
  assert.equal(messageDuRecalcul({ lot: null, recalcul: { ecarts: 0, pages_illisibles: [] } }).erreur, false);
  assert.ok(messageDuRecalcul({ lot: { id: 'x' }, recalcul: { ecarts: 12, pages_illisibles: [] } }).texte.includes('12'));
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

test('l’accord au pluriel : « sa valeur » pour une ligne gardée, « leur valeur » pour plusieurs (bilan, annulation, aperçu de l’annulation) ; sans liste de décisions, aucun numéro inventé', () => {
  const bilan = (n) => messageDuBilan(lot('b', { bilan: { ecrites: 1, changees: n, operations: [] } })).texte;
  const annulation = (n) => messageDeLAnnulation(lot('b', { bilan: { annulation: { remises: 1, gardees: n, deja: 0, operations: [] } } })).texte;
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
