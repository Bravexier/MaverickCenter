// Le rendu des lots de changements (src/lib/lots-rendu.mjs) sur ce que rend VRAIMENT le service (serveur/edition-lots.mjs, base vivante d'un essai) : les noms
// de champs que le rendu lit (`essai.operations[].apercu`, `bilan`, aperçu de l'annulation) existent, la ligne et la colonne sont dites par les noms du service
// (jamais par leur nom technique), l'aperçu montre l'avant et l'après de la base, une valeur changée depuis est listée avec la valeur trouvée, une annulation
// garde ce que le site a changé depuis. Aucune valeur de règle n'est figée : les lignes se prennent par ordre d'id, les textes écrits sont ceux du test.
//   node --test test/lots-rendu-service.test.mjs
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { test } from 'node:test';
import { traiter } from '../serveur/api.mjs';
import { ouvrirBaseVivante, preparerBaseVivante } from '../serveur/base-vivante.mjs';
import { texteDeValeur } from '../src/lib/conflits-rendu.mjs';
import { FORMAT_DU_LOT } from '../src/lib/lot-de-changements.mjs';
import { htmlDesLots, messageDeLAnnulation, messageDErreur, messageDuBilan, peutAnnuler, peutAppliquer, phraseDeLEssai } from '../src/lib/lots-rendu.mjs';
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
  const detail = ok(await m.appel('GET', adresse(lot.id)));
  const appliquee = lire(htmlDesLots({ lots: [detail] })).querySelector(`[data-nv-lot-id="${lot.id}"]`);
  assert.equal(appliquee.querySelectorAll('button[data-nv-annuler]').length, 1);
  assert.equal(appliquee.querySelectorAll('li[data-nv-etat-ligne="changee"]').length, 1, 'le bilan liste la ligne gardée');
  // l'aperçu de l'annulation : la ligne A est remise
  const avant = ok(await m.appel('GET', adresse(lot.id, 'annulation/')));
  assert.equal(peutAnnuler(avant).possible, true);
  const montre = lire(htmlDesLots({ lots: [detail] }, { annulations: new Map([[lot.id, { apercu: avant }]]) })).querySelector('[data-nv-annulation]');
  // (le service peut y ajouter une ligne que le recalcul remet seul : « déjà comme avant »)
  const etats = [...montre.querySelectorAll('li.nv-lot-ligne')].map((l) => l.dataset.nvEtatLigne);
  assert.equal(etats[0], 'remise');
  assert.ok(etats.every((e) => ['remise', 'deja'].includes(e)), etats.join());
  assert.equal(montre.querySelector('li strong').textContent, avant.operations[0].apercu.ligne);
  // le site change la ligne A depuis : l'annulation la garde (valeur trouvée) et dit ce qu'elle remet quand même
  m.db.prepare('UPDATE metier SET description = ? WHERE id = ?').run(`encore changée ${process.pid}`, a.id);
  const apres = ok(await m.appel('GET', adresse(lot.id, 'annulation/')));
  assert.ok(apres.comptes.gardees >= 1);
  const gardeeApres = lire(htmlDesLots({ lots: [detail] }, { annulations: new Map([[lot.id, { apercu: apres }]]) })).querySelector('[data-nv-annulation] li[data-nv-etat-ligne="gardee"]');
  assert.ok(gardeeApres.textContent.includes(`encore changée ${process.pid}`), 'la valeur trouvée');
  assert.equal(gardeeApres.querySelectorAll('.nv-lot-colonne').length, 0);
  // le clic : le message nomme ce qui est gardé, par le nom du service
  const annule = ok(await m.appel('POST', adresse(lot.id, 'annuler/'), {}), 200);
  assert.equal(annule.etat, 'annule');
  const message = messageDeLAnnulation(annule, apres);
  assert.ok(message.lignes.length >= 1);
  assert.ok(message.lignes.some((l) => l.includes(apres.operations.find((o) => o.etat === 'gardee').apercu.ligne) && l.includes(`encore changée ${process.pid}`)));
  // une annulation refusée par le service (le lot n'est plus appliqué) : son texte, tel quel
  const refus = await m.appel('POST', adresse(lot.id, 'annuler/'), {});
  assert.equal(refus.statut, 409);
  assert.equal(messageDErreur({ message: refus.corps.erreur, corps: refus.corps }).texte, refus.corps.erreur);
});
