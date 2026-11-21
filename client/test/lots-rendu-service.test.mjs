// Le rendu des lots de changements (src/lib/lots-rendu.mjs) sur ce que rend VRAIMENT le service (serveur/edition-lots.mjs, base vivante d'un essai) : les noms
// de champs que le rendu lit (`essai.operations[].apercu`, `bilan`, aperçu de l'annulation) existent, la ligne et la colonne sont dites par les noms du service
// (jamais par leur nom technique), l'aperçu montre l'avant et l'après de la base, une valeur changée depuis est listée avec la valeur trouvée, l'annulation
// d'une seule ligne (R291 : `lignes` d'un changement appliqué, aperçu et clic par ligne) garde ce que le site a changé depuis. Aucune valeur de règle n'est figée : les lignes se prennent par ordre d'id, les textes écrits sont ceux du test.
//   node --test test/lots-rendu-service.test.mjs
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { test } from 'node:test';
import { traiter } from '../serveur/api.mjs';
import { ouvrirBaseVivante, preparerBaseVivante } from '../serveur/base-vivante.mjs';
import { texteDeValeur } from '../src/lib/conflits-rendu.mjs';
import { FORMAT_DU_LOT } from '../src/lib/lot-de-changements.mjs';
import { htmlDeLaConfirmation, htmlDesLots, messageDeLaLigneAnnulee, messageDErreur, messageDuBilan, peutAnnuler, peutAnnulerLaLigne, peutAppliquer, phraseDeLEssai } from '../src/lib/lots-rendu.mjs';
import { cheminDImport } from './aide-base-d-import.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';
import { el } from './aide-faux-dom.mjs';

const racine = dossierTemporaire('lots-rendu-service');
let n = 0;

/** Une base vivante neuve (règles de l'import) et le service qui l'écrit (sans mot de passe posé : tout est ouvert) ; l'essai tourne dans le fil du service. */
function nouvelle() {
  const chemin = preparerBaseVivante({ regles: cheminDImport(), dossier: join(racine, `b${(n += 1)}`) }).chemin;
  const db = ouvrirBaseVivante(chemin);
  const service = { base: () => db, etat: () => ({}), edition: true, journal: () => {}, lots: { enArrierePlan: false } };
  const appel = async (methode, adresse, corps) =>
    traiter({ methode, chemin: adresse, entetes: { 'content-type': 'application/json' }, corps: corps === undefined ? undefined : JSON.stringify(corps) }, service);
  return { db, appel };
}
const ok = (r, statut = 200) => {
  assert.equal(r.statut, statut, JSON.stringify(r.corps));
  return r.corps;
};
const lire = (html) => {
  const e = el('div', {});
  e.innerHTML = html;
  return e;
};
const metiers = (db, k) => db.prepare('SELECT id, description FROM metier ORDER BY id LIMIT ?').all(k).map((m) => ({ ...m }));
const modifier = (m, texte) => ({ table: 'metier', cle: { id: m.id }, operation: 'modifier', avant: { description: m.description }, apres: { description: texte } });
const adresse = (id, suite = '') => `/api/edition/lots/${id}/${suite}`;

test('le rendu sur un vrai lot : l’aperçu dit la ligne et la colonne par les noms du service, avec l’avant (la base) et l’après (le lot) ; prêt, rien à décider', async () => {
  const m = nouvelle();
  const [a, b] = metiers(m.db, 2);
  const lot = ok(await m.appel('POST', '/api/edition/lots/', { format: FORMAT_DU_LOT, titre: 'Lot du rendu', nature: 'decision', decision: 'R275', operations: [modifier(a, `texte A ${process.pid}`), modifier(b, `texte B ${process.pid}`)] }), 201);
  assert.equal(phraseDeLEssai(lot).niveau, 'pret');
  assert.equal(peutAppliquer(lot).possible, true);
  const article = lire(htmlDesLots({ lots: [lot] })).querySelector(`[data-nv-lot-id="${lot.id}"]`);
  assert.equal(article.querySelector('[data-nv-decision]').textContent, 'R275');
  const lignes = [...article.querySelectorAll('li.nv-lot-ligne')];
  assert.equal(lignes.length, 2);
  lignes.forEach((l, i) => {
    const op = lot.essai.operations[i];
    assert.equal(l.querySelector('strong').textContent, op.apercu.ligne, 'la ligne par son nom');
    assert.equal(l.querySelector('.nv-lot-colonne__nom').textContent, op.apercu.colonnes[0].libelle, 'la colonne par son libellé');
    const [avant, apres] = [...l.querySelectorAll('.nv-version__texte')].map((v) => v.textContent);
    assert.equal(avant, texteDeValeur(op.apercu.colonnes[0].avant));
    assert.equal(apres, texteDeValeur(op.apercu.colonnes[0].apres));
  });
  assert.equal([...article.querySelectorAll('.nv-version__texte')][0].textContent, texteDeValeur([a][0].description), 'l’avant est la valeur de la base');
  // ni nom technique de colonne ni JSON dans ce que le propriétaire lit
  assert.doesNotMatch(article.textContent, /\bdescription\b(?!\s*:)|[{}]/, 'pas de nom technique');
  assert.doesNotMatch(article.textContent, /\bmetier\b/);
});

test('une valeur changée depuis l’essai : l’essai la liste avec la valeur trouvée ; l’application la garde (le site prime), le bilan la nomme ; l’annulation garde ce que le site a changé depuis', async () => {
  const m = nouvelle();
  const [a, b] = metiers(m.db, 2);
  const lot = ok(await m.appel('POST', '/api/edition/lots/', { format: FORMAT_DU_LOT, titre: 'Lot qui change', nature: 'code', operations: [modifier(a, `texte A ${process.pid}`), modifier(b, `texte B ${process.pid}`)] }), 201);
  // le site change la ligne B entre l'essai et le clic : l'essai refait le dit
  m.db.prepare('UPDATE metier SET description = ? WHERE id = ?').run(`valeur du site ${process.pid}`, b.id);
  const refait = ok(await m.appel('POST', adresse(lot.id, 'essai/'), {}));
  const phrase = phraseDeLEssai(refait);
  assert.equal(phrase.niveau, 'pret');
  // la donnée : une valeur changée depuis (celle de la ligne B), lue de l'essai du service et rendue par la phrase
  assert.equal(refait.essai.comptes.changees, 1);
  assert.equal(phrase.valeurs, refait.essai.operations.filter((o) => o.etat === 'changee').reduce((t, o) => t + o.ecarts.length, 0));
  assert.equal(phrase.valeurs, 1);
  const gardee = lire(htmlDesLots({ lots: [refait] })).querySelector('li[data-nv-etat-ligne="changee"]');
  assert.ok(gardee, 'la ligne changée est listée');
  assert.ok(gardee.textContent.includes(`valeur du site ${process.pid}`), 'avec la valeur trouvée');
  assert.equal(gardee.querySelectorAll('.nv-lot-colonne').length, 0);
  // le clic : une ligne écrite, une gardée ; le bilan la nomme par le nom du service
  const applique = ok(await m.appel('POST', adresse(lot.id, 'appliquer/'), {}));
  assert.equal(applique.etat, 'applique');
  const bilan = messageDuBilan(applique);
  assert.equal(bilan.lignes.length, 1);
  assert.ok(bilan.lignes[0].includes(refait.essai.operations[1].apercu.ligne));
  assert.ok(bilan.lignes[0].includes(`valeur du site ${process.pid}`));
  // R291 : le changement appliqué montre ses lignes, chacune avec son bouton « Annuler cette modification »
  const detail = ok(await m.appel('GET', adresse(lot.id)));
  assert.ok(Array.isArray(detail.lignes) && detail.lignes.length >= 1, 'les lignes du journal du changement');
  const ligneA = detail.lignes.find((l) => l.colonnes.some((c) => texteDeValeur(c.apres) === `texte A ${process.pid}`));
  assert.ok(ligneA, 'la ligne A du changement');
  assert.equal(ligneA.etat, 'en_place');
  assert.equal(peutAnnulerLaLigne(ligneA), true);
  const appliquee = lire(htmlDesLots({ lots: [detail] })).querySelector(`[data-nv-lot-id="${lot.id}"]`);
  assert.equal(appliquee.querySelectorAll('li.nv-lot-ligne').length, detail.lignes.length);
  assert.equal(appliquee.querySelectorAll('button[data-nv-annuler-ligne]').length, detail.lignes.filter(peutAnnulerLaLigne).length);
  assert.equal(appliquee.querySelector(`li[data-nv-ligne="${ligneA.n}"] strong`).textContent, ligneA.ligne, 'la ligne par son nom');
  assert.equal(appliquee.querySelector('[data-nv-annuler]'), null, 'plus d’« Annuler ce lot »');
  // l'aperçu de l'annulation de la ligne A : elle est remise ; la confirmation le montre
  const avant = ok(await m.appel('GET', adresse(lot.id, `lignes/${ligneA.n}/annulation/`)));
  assert.equal(peutAnnuler(avant).possible, true);
  const etats = avant.operations.map((o) => o.etat);
  assert.equal(etats[0], 'remise');
  assert.ok(etats.every((e) => ['remise', 'deja'].includes(e)), etats.join()); // (le service peut y ajouter une ligne que le recalcul remet seul : « déjà comme avant »)
  const confirmation = lire(htmlDeLaConfirmation({ action: 'annuler-ligne', lot: detail, ligne: ligneA, apercu: avant }));
  assert.equal(confirmation.querySelectorAll('button[type="submit"][data-nv-confirmer-ligne]').length, 1);
  assert.equal(confirmation.querySelector('li strong').textContent, avant.operations[0].apercu.ligne);
  // le site change la ligne A depuis : l'annulation la garde (valeur trouvée) et le dit
  m.db.prepare('UPDATE metier SET description = ? WHERE id = ?').run(`encore changée ${process.pid}`, a.id);
  const apres = ok(await m.appel('GET', adresse(lot.id, `lignes/${ligneA.n}/annulation/`)));
  const gardees = apres.operations.filter((o) => o.etat === 'gardee' || o.etat === 'refusee' || o.etat === 'deja');
  assert.ok(apres.verdict === 'rien_a_remettre' || apres.comptes.gardees >= 1 || gardees.length >= 1, JSON.stringify(apres.comptes));
  // la page relit le changement : la ligne dit qu'elle a changé depuis (le site prime) et perd son bouton
  const relu = ok(await m.appel('GET', adresse(lot.id)));
  const ligneRelue = relu.lignes.find((l) => l.n === ligneA.n);
  assert.equal(ligneRelue.etat, 'modifiee_depuis');
  assert.equal(peutAnnulerLaLigne(ligneRelue), false);
  const montree = lire(htmlDesLots({ lots: [relu] })).querySelector(`li[data-nv-ligne="${ligneA.n}"]`);
  assert.equal(montree.querySelectorAll('button').length, 0);
  assert.ok(montree.textContent.includes(`encore changée ${process.pid}`), 'la valeur trouvée');
  // le service refuse l'annulation d'une ligne qui ne s'annule plus seule : son texte, tel quel, et le message du clic nomme ce qu'il a fait
  const refus = await m.appel('POST', adresse(lot.id, `lignes/${ligneA.n}/annuler/`), {});
  assert.equal(refus.statut, 409);
  assert.equal(messageDErreur({ message: refus.corps.erreur, corps: refus.corps }).texte, refus.corps.erreur);
  assert.ok(messageDeLaLigneAnnulee(ligneA, avant).texte.includes(ligneA.ligne));
});

test('annuler une seule ligne de bout en bout : le clic remet la valeur d’avant, la ligne se lit « annulée » sans bouton, une seconde annulation est refusée', async () => {
  const m = nouvelle();
  const [a] = metiers(m.db, 1);
  const lot = ok(await m.appel('POST', '/api/edition/lots/', { format: FORMAT_DU_LOT, titre: 'Lot à annuler', nature: 'code', operations: [modifier(a, `texte A ${process.pid}`)] }), 201);
  ok(await m.appel('POST', adresse(lot.id, 'appliquer/'), {}));
  const detail = ok(await m.appel('GET', adresse(lot.id)));
  const ligne = detail.lignes.find((l) => peutAnnulerLaLigne(l));
  assert.ok(ligne, 'une ligne annulable seule');
  const apercu = ok(await m.appel('GET', adresse(lot.id, `lignes/${ligne.n}/annulation/`)));
  const annule = ok(await m.appel('POST', adresse(lot.id, `lignes/${ligne.n}/annuler/`), {}));
  assert.ok(annule.bilan?.lignes_annulees?.[ligne.n], 'le service garde l’état de la ligne');
  assert.equal(m.db.prepare('SELECT description FROM metier WHERE id = ?').get(a.id).description, a.description, 'la valeur d’avant est remise');
  const relu = ok(await m.appel('GET', adresse(lot.id)));
  const ligneRelue = relu.lignes.find((l) => l.n === ligne.n);
  assert.equal(ligneRelue.etat, 'annulee');
  assert.equal(peutAnnulerLaLigne(ligneRelue), false);
  assert.ok(messageDeLaLigneAnnulee(ligne, apercu).texte.includes(ligne.ligne));
  // (le changement reste dans « appliqués » tant qu'une ligne est en place, quitte la section sinon : dans les deux cas, aucun bouton pour cette ligne)
  assert.equal(lire(htmlDesLots({ lots: [relu] })).querySelectorAll(`li[data-nv-ligne="${ligne.n}"] button`).length, 0);
  const encore = await m.appel('POST', adresse(lot.id, `lignes/${ligne.n}/annuler/`), {});
  assert.equal(encore.statut, 409);
});
