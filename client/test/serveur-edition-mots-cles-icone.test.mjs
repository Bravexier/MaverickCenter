// L'icône d'un mot-clé (mot_cle.icone, migration 0116 ; décision R235) : la seule liste des icônes du site (lib/icones.mjs#ICONES : les monnaies du jeu,
// puis les types de dégâts et les magies, test/icones-degats-et-magies.test.mjs), que lisent db:check, le service et le menu du site de dev ; le service la refuse hors de la liste (400, `champ: 'icone'`), la vide
// en NULL, la laisse modifiable sur un mot-clé verrouillé (seule sa suppression est bloquée), la rend avec le vocabulaire (GET /api/edition/mots-cles/ : `icone` et la liste `icones`) et dans les
// listes de l'édition ; une fusion la donne à une cible qui n'en a pas. Mots-clés d'essai (test/aide-mots-cles.mjs) ; un mot-clé verrouillé choisi par
// requête, jamais par son texte.
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { test } from 'node:test';
import { traiter } from '../serveur/api.mjs';
import { ouvrirBaseVivante, preparerBaseVivante } from '../serveur/base-vivante.mjs';
import { fauteDeLIcone, icone, ICONES } from '../src/lib/icones.mjs';
import { MONNAIES_DU_JEU } from '../src/lib/monnaies.mjs';
import { motsClesDeLaBase } from '../src/lib/mots-cles-db.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';
import { MOTS_CLES_D_ESSAI, reglesAvecDesMotsClesDEssai } from './aide-mots-cles.mjs';

const racine = dossierTemporaire('mots-cles-icone');
const regles = reglesAvecDesMotsClesDEssai(join(racine, 'regles'));
const A = MOTS_CLES_D_ESSAI['essai-glossaire-a'];
const C = MOTS_CLES_D_ESSAI['essai-glossaire-c'];
let compteur = 0;
function base() {
  const db = ouvrirBaseVivante(preparerBaseVivante({ regles: regles.base, dossier: join(racine, `b${(compteur += 1)}`) }).chemin);
  const service = { base: () => db, etat: () => ({}), edition: true };
  const appel = (methode, chemin, corps) => traiter({ methode, chemin, entetes: { 'content-type': 'application/json' }, corps: corps && JSON.stringify(corps) }, service);
  const lot = (operations) => appel('POST', '/api/edition/', { page: 'regles/glossaire/', operations });
  const iconeDe = (id) => db.prepare('SELECT icone FROM mot_cle WHERE id = ?').get(id).icone;
  return { db, appel, lot, iconeDe };
}
const ok = (r) => assert.equal(r.statut, 200, JSON.stringify(r.corps));
const modifier = (id, icone_) => [{ op: 'modifier', table: 'mot_cle', cle: { id }, valeurs: { icone: icone_ } }];

test('R235 : une seule liste des icônes (une par monnaie du jeu, « monnaie:<id> », son dessin piece--<id>, puis les dégâts et les magies) ; la règle de db:check et du service', () => {
  const monnaies = ICONES.filter((i) => i.famille === 'monnaie');
  assert.deepEqual(monnaies.map((i) => i.valeur).sort(), Object.values(MONNAIES_DU_JEU).map((m) => `monnaie:${m.id}`).sort());
  for (const i of ICONES) {
    assert.equal(icone(i.valeur), i);
    assert.equal(fauteDeLIcone(i.valeur), null);
    if (i.famille === 'monnaie') assert.match(i.classe, new RegExp(`\\bpiece--${i.id}\\b`));
    else assert.match(i.classe, new RegExp(`\\bicone--${i.famille}-${i.id}\\b`));
  }
  assert.equal(fauteDeLIcone(null), null, 'aucune icône');
  for (const x of ['monnaie:xx', 'classe:melee', 'monnaie', '', 3]) assert.equal(typeof fauteDeLIcone(x), 'string', String(x));
  // la base : chaque icône posée est de la liste (la règle de db:check), et le mot-clé d'une monnaie porte l'icône de sa monnaie (migration 0116) —
  // ces mots-clés sont verrouillés (R219) : le site de dev n'y touche pas
  const { db } = base();
  for (const m of motsClesDeLaBase(db)) {
    assert.equal(fauteDeLIcone(m.icone), null, `mot-clé ${m.id}`);
    if (m.monnaie_id) assert.equal(m.icone, `monnaie:${m.monnaie_id}`, `mot-clé ${m.id}`);
  }
  db.close();
});

test('R235 : l’icône se choisit dans la liste (400 hors de la liste, champ icone), se vide en NULL, se pose à la création ; celle d’un mot-clé verrouillé se change aussi (seule sa suppression est bloquée)', () => {
  const { db, appel, lot, iconeDe } = base();
  const [premiere, seconde] = ICONES.map((i) => i.valeur);
  ok(lot(modifier(A.id, premiere)));
  assert.equal(iconeDe(A.id), premiere);
  const refus = lot(modifier(A.id, 'monnaie:inconnue'));
  assert.equal(refus.statut, 400, JSON.stringify(refus.corps));
  assert.equal(refus.corps.champ, 'icone');
  assert.equal(iconeDe(A.id), premiere, 'rien d’écrit');
  ok(lot(modifier(A.id, '')));
  assert.equal(iconeDe(A.id), null);
  const cree = lot([{ op: 'creer', entite: 'mot_cle', valeurs: { libelle: 'Essai icône zq', icone: seconde } }]);
  ok(cree);
  assert.equal(iconeDe(cree.corps.crees[0].id), seconde);
  assert.equal(lot([{ op: 'creer', entite: 'mot_cle', valeurs: { libelle: 'Essai icône zq bis', icone: 'x:y' } }]).corps.champ, 'icone');
  // un mot-clé verrouillé (R218, R219) : son icône se change (demande du propriétaire : seule sa suppression est bloquée)
  const verrouille = db.prepare('SELECT id, icone FROM mot_cle WHERE verrou = 1 ORDER BY id').get();
  const autre = ICONES.map((i) => i.valeur).find((v) => v !== verrouille.icone);
  ok(lot(modifier(verrouille.id, autre)));
  assert.equal(iconeDe(verrouille.id), autre);
  // GET /api/edition/mots-cles/ : l'icône de chaque mot-clé et la liste proposée ; GET /api/edition/listes/ : la même liste, pour le menu
  const vocabulaire = appel('GET', '/api/edition/mots-cles/');
  ok(vocabulaire);
  assert.deepEqual(vocabulaire.corps.icones.map((i) => i.valeur), ICONES.map((i) => i.valeur));
  for (const m of vocabulaire.corps.motsCles) assert.equal(m.icone, iconeDe(m.id), `mot-clé ${m.id}`);
  const listes = appel('GET', '/api/edition/listes/');
  ok(listes);
  assert.deepEqual(listes.corps.icones.map((i) => i.valeur), ICONES.map((i) => i.valeur));
  db.close();
});

test('R235 : une fusion donne l’icône de la source à une cible qui n’en a pas, et la cible garde la sienne', () => {
  const { db, lot, iconeDe } = base();
  const [premiere, seconde] = ICONES.map((i) => i.valeur);
  ok(lot(modifier(A.id, premiere)));
  ok(lot([{ op: 'fusionner_mots_cles', mot_cle: A.id, dans: C.id }]));
  assert.equal(iconeDe(C.id), premiere);
  const D = MOTS_CLES_D_ESSAI['essai-glossaire-d'];
  ok(lot(modifier(D.id, seconde)));
  ok(lot([{ op: 'fusionner_mots_cles', mot_cle: D.id, dans: C.id }]));
  assert.equal(iconeDe(C.id), premiere);
  db.close();
});
