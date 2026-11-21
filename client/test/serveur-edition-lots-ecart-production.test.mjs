// La section « Modifications de l'équipe » ne montre que ce qui change par rapport à la production (demande du propriétaire du 2026-11-21 : « Je ne dois voir ici QUE
// la liste de ce qui change par rapport à la prod, car sert pour le patch note. ») : `ecart_production` de GET /api/edition/lots/ et de chaque ligne du détail
// (serveur/edition-lots.mjs#differeDeLaProduction). Le cas réel : un lot livré, annulé puis redéposé à l'identique n'est pas dans l'historique et ne change rien.
// Aucune valeur de règle figée : les lignes se prennent par ordre d'id, les textes écrits sont ceux du test.
//   node --test test/serveur-edition-lots-ecart-production.test.mjs
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { after, test } from 'node:test';
import { traiter } from '../serveur/api.mjs';
import { ouvrirBaseVivante, preparerBaseVivante } from '../serveur/base-vivante.mjs';
import { cheminDImport } from './aide-base-d-import.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';

const racine = dossierTemporaire('edition-lots-ecart-production');
const JSON_ = { 'content-type': 'application/json' };
let n = 0;

function nouvelle() {
  const chemin = preparerBaseVivante({ regles: cheminDImport(), dossier: join(racine, `b${(n += 1)}`) }).chemin;
  const db = ouvrirBaseVivante(chemin);
  const service = { base: () => db, etat: () => ({}), edition: true, journal: () => {}, lots: { enArrierePlan: false }, reference: null };
  const appel = async (methode, adresse, corps) => {
    const r = await traiter({ methode, chemin: adresse, entetes: JSON_, corps: corps === undefined ? undefined : JSON.stringify(corps) }, service);
    assert.ok(r.statut < 300, JSON.stringify(r.corps));
    return r.corps;
  };
  return { db, service, appel };
}

// une seule base (la préparer est lent) : chaque test prend ses propres métiers
const m = nouvelle();
after(() => m.db.close());

/** Une copie de la base telle qu'elle est maintenant : la production qui vient de recevoir tout ce qu'elle contient. */
function livrer() {
  const chemin = join(racine, `production-${(n += 1)}.db`);
  m.db.exec(`VACUUM INTO '${chemin.replaceAll("'", "''")}'`);
  m.service.reference = chemin;
  return chemin;
}

/** Une écriture dans la copie de la production, sans ses clés étrangères (une ligne s'y retire seule). */
function dansLaProduction(chemin, sql, ...valeurs) {
  const production = new DatabaseSync(chemin, { enableForeignKeyConstraints: false });
  try {
    production.prepare(sql).run(...valeurs);
  } finally {
    production.close();
  }
}

const lesMetiers = m.db.prepare('SELECT id, nom, description FROM metier ORDER BY id LIMIT 4').all().map((l) => ({ ...l }));
const modifier = (metier, texte) => ({ table: 'metier', cle: { id: metier.id }, operation: 'modifier', avant: { description: metier.description }, apres: { description: texte } });

async function appliquer(operations) {
  const lot = await m.appel('POST', '/api/edition/lots/', { format: 'maverick-lot/1', titre: `Lot ${(n += 1)}`, nature: 'code', operations });
  return m.appel('POST', `/api/edition/lots/${lot.id}/appliquer/`, {});
}
const resume = async (id) => (await m.appel('GET', '/api/edition/lots/')).lots.find((l) => l.id === id);
const lignes = async (id) => (await m.appel('GET', `/api/edition/lots/${id}/`)).lignes;
const duMetier = (liste, metier) => liste.find((l) => l.table !== 'Page' && l.ligne.includes(metier.nom));

test('un lot absent de la production est en écart ; une ligne reçue par la production ne l’est plus, ligne par ligne', async () => {
  const production = livrer();
  const [a, b] = lesMetiers;
  const texteA = `Texte a ${process.pid}`;
  const lot = await appliquer([modifier(a, texteA), modifier(b, `Texte b ${process.pid}`)]);
  assert.equal((await resume(lot.id)).ecart_production, true);
  let detail = await lignes(lot.id);
  assert.deepEqual([duMetier(detail, a).ecart_production, duMetier(detail, b).ecart_production], [true, true]);

  dansLaProduction(production, 'UPDATE metier SET description = ? WHERE id = ?', texteA, a.id);
  assert.equal((await resume(lot.id)).ecart_production, true, 'il reste la ligne b');
  detail = await lignes(lot.id);
  assert.deepEqual([duMetier(detail, a).ecart_production, duMetier(detail, b).ecart_production], [false, true]);
});

test('le cas du R10 : un lot que la production contient déjà n’est plus en écart, même absent de l’historique des livraisons', async () => {
  const c = lesMetiers[2];
  const lot = await appliquer([modifier(c, `Déjà livré ${process.pid}`)]);
  const production = livrer();
  assert.equal(m.db.prepare('SELECT count(*) AS n FROM historique_modification WHERE lot_id = ?').get(lot.lot_id).n, 0, 'le lot n’est pas dans l’historique');
  assert.equal((await resume(lot.id)).ecart_production, false);
  assert.ok((await lignes(lot.id)).every((l) => l.ecart_production === false));

  // une ligne absente d'un seul côté est un écart
  dansLaProduction(production, 'DELETE FROM metier WHERE id = ?', c.id);
  assert.equal((await resume(lot.id)).ecart_production, true);
});

test('sans référence, rien n’est dit : aucun champ, donc rien n’est retiré de la liste', async () => {
  m.service.reference = null;
  const lot = await appliquer([modifier(lesMetiers[3], `Sans référence ${process.pid}`)]);
  assert.equal('ecart_production' in (await resume(lot.id)), false);
  assert.ok((await lignes(lot.id)).every((l) => !('ecart_production' in l)));
  m.service.reference = join(racine, 'absente.db');
  assert.equal('ecart_production' in (await resume(lot.id)), false);
});
