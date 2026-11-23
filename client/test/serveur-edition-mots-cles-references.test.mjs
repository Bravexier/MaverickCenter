// Les références de la base à un mot-clé du glossaire (migration 0125 : type_degats.mot_cle_id pour taille, estoc, frappe ; magie.mot_cle_id), demande du
// propriétaire « lier aux mots-clés du glossaire les liens communs de la base » :
//   - une référence compte comme une mention (lib/mentions-des-mots-cles.mjs, `comment: 'reference'`) ; la page de la magie nomme la sienne ;
//   - la suppression est refusée proprement, simple ou forcée (409 avec `references`, pas l'erreur brute de la clé étrangère), par analogie avec l'étiquette
//     d'un sort (R223 (5) : « le forçage ne lève que le refus des mentions ») ; `refus_du_forcage` le dit d'avance au Glossaire ;
//   - la fusion reporte la référence sur la cible, notée au journal avant la suppression de la source ; deux mots-clés cités chacun par une magie ne se
//     fusionnent pas (un mot-clé par magie) ;
//   - rejeu : un lot ancien qui supprime un mot-clé cité reste en conflit ; une fusion se rejoue avec sa référence reportée.
// Les lignes se choisissent par leur lien (jamais par un nom ni par un id supposé : le site de dev renomme les mots-clés).
//   node --test test/serveur-edition-mots-cles-references.test.mjs
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { test } from 'node:test';
import { traiter } from '../serveur/api.mjs';
import { ouvrirBaseVivante, preparerBaseVivante } from '../serveur/base-vivante.mjs';
import { enregistrer, rejouerLeJournal } from '../serveur/edition.mjs';
import { mentionsDe, referencesDesMotsCles } from '../src/lib/mentions-des-mots-cles.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';
import { reglesAvecDesMotsClesDEssai } from './aide-mots-cles.mjs';

const racine = dossierTemporaire('edition-mots-cles-references');
let compteur = 0;
const regles = reglesAvecDesMotsClesDEssai(join(racine, 'regles'), { sansExemples: false });
const vivante = () => ouvrirBaseVivante(preparerBaseVivante({ regles: regles.base, dossier: join(racine, `b${(compteur += 1)}`) }).chemin);

/** Le service sur une base vivante neuve. */
function nouvelle(db = vivante()) {
  const service = { base: () => db, etat: () => ({}), edition: true };
  const appel = (methode, chemin, corps) => traiter({ methode, chemin, entetes: { 'content-type': 'application/json' }, corps: corps === undefined ? undefined : JSON.stringify(corps) }, service);
  const lot = (operations) => appel('POST', '/api/edition/', { page: 'regles/glossaire/', operations });
  // un lot d'avant R309 : aucune route ne fusionne plus un mot-clé relié à un élément, le journal en garde et le rejeu les repasse (R219 (6))
  const lotAncien = (operations) => enregistrer(db, { page: 'regles/glossaire/', operations }, { gel: false });
  const lire = (sql, ...p) => db.prepare(sql).all(...p).map((l) => ({ ...l }));
  const ligne = (sql, ...p) => lire(sql, ...p)[0];
  /** Un mot-clé créé par le service, sous un libellé que personne ne porte. */
  const creer = (base) => {
    const libre = `${base} ${process.pid} ${(compteur += 1)}`;
    const r = lot([{ op: 'creer', entite: 'mot_cle', valeurs: { libelle: libre } }]);
    assert.equal(r.statut, 200, JSON.stringify(r.corps));
    return r.corps.crees[0].id;
  };
  return { db, appel, lot, lotAncien, lire, ligne, creer };
}

const refuse = (r, quoi) => {
  assert.equal(r.statut, 409, `${quoi} : ${JSON.stringify(r.corps)}`);
  assert.doesNotMatch(r.corps.erreur, /FOREIGN KEY|constraint|SQLITE/i, `${quoi} : un refus lisible, pas l'erreur de la base`);
  return r.corps;
};

/** Un mot-clé non verrouillé cité par un type de dégâts : { type, mot }. */
const typeCite = (s) => s.ligne('SELECT t.id AS type, t.mot_cle_id AS mot FROM type_degats t JOIN mot_cle m ON m.id = t.mot_cle_id WHERE m.verrou = 0 ORDER BY t.id');

test('migration 0125 : un type de dégâts cite un mot-clé ou une magie (jamais les deux), une magie cite au plus un mot-clé, chacun qui existe', () => {
  const s = nouvelle();
  assert.ok(typeCite(s), 'au moins un type de dégâts lié à un mot-clé non verrouillé');
  assert.deepEqual(s.lire('SELECT id FROM type_degats WHERE mot_cle_id IS NOT NULL AND magie_id IS NOT NULL'), []);
  assert.deepEqual(s.lire('PRAGMA foreign_key_check'), []);
  assert.ok(s.ligne('SELECT 1 FROM magie WHERE mot_cle_id IS NOT NULL'), 'des magies liées à leur mot-clé');
  s.db.close();
});

test('mentions : chaque référence de la base est une mention du mot-clé (`reference`), nommée par la page de la magie quand c’est une magie', () => {
  const s = nouvelle();
  const types = s.lire('SELECT id, mot_cle_id FROM type_degats WHERE mot_cle_id IS NOT NULL');
  const magies = s.lire('SELECT id, mot_cle_id FROM magie WHERE mot_cle_id IS NOT NULL');
  assert.ok(types.length && magies.length);
  for (const t of types) {
    const m = mentionsDe(s.db, t.mot_cle_id).filter((x) => x.comment === 'reference' && x.table === 'type_degats');
    assert.deepEqual(m.map((x) => x.cle), [{ id: t.id }], `le type de dégâts ${t.id} mentionne son mot-clé`);
    assert.equal(m[0].page, null, 'un type de dégâts n’a pas de page');
  }
  for (const g of magies) {
    const m = mentionsDe(s.db, g.mot_cle_id).filter((x) => x.comment === 'reference' && x.table === 'magie');
    assert.deepEqual(m.map((x) => x.cle), [{ id: g.id }]);
    assert.equal(m[0].page?.id, g.id, 'la page de la magie nomme la mention');
  }
  // la liste des références est celle des mentions, sans écart (sur un contenu ancré, ces mots-clés sont aussi référencés par leurs pages : R309)
  const ids = [...new Set([...types, ...magies].map((x) => x.mot_cle_id))];
  assert.equal(referencesDesMotsCles(s.db, ids).filter((r) => r.table === 'type_degats' || r.table === 'magie').length, types.length + magies.length);
  assert.deepEqual(referencesDesMotsCles(s.db, []), []);
  s.db.close();
});

test('suppression, simple ou forcée : refusée proprement (409, `references`), rien d’écrit ; `refus_du_forcage` le dit au Glossaire (par analogie avec R223 (5))', () => {
  const s = nouvelle();
  const { type, mot } = typeCite(s);
  const avant = { mots: s.lire('SELECT * FROM mot_cle ORDER BY id'), types: s.lire('SELECT * FROM type_degats ORDER BY id'), lots: s.ligne('SELECT count(*) AS n FROM modification_lot').n };
  for (const [quoi, forcer] of [['simple', undefined], ['forcée', true]]) {
    const corps = refuse(s.lot([{ op: 'supprimer', entite: 'mot_cle', cle: { id: mot }, ...(forcer ? { forcer } : {}) }]), quoi);
    assert.deepEqual(corps.references?.map((r) => [r.table, r.id]), [['type_degats', type]], `${quoi} : la référence est nommée`);
  }
  refuse(s.appel('DELETE', `/api/v1/mots-cles/${mot}/?forcer=1`), 'API v1, forcée');
  assert.deepEqual({ mots: s.lire('SELECT * FROM mot_cle ORDER BY id'), types: s.lire('SELECT * FROM type_degats ORDER BY id'), lots: s.ligne('SELECT count(*) AS n FROM modification_lot').n }, avant, 'rien n’est écrit');
  const liste = s.appel('GET', '/api/edition/mots-cles/');
  assert.equal(liste.statut, 200);
  const cite = liste.corps.motsCles.find((m) => m.id === mot);
  assert.ok(cite.mentions.some((x) => x.comment === 'reference' && x.table === 'type_degats'), 'le Glossaire voit la référence parmi les mentions');
  assert.equal(typeof cite.refus_du_forcage, 'string', 'le forçage n’est pas offert : la raison est donnée');
  s.db.close();
});

test('suppression d’un mot-clé de magie : refusée (verrou ou référence), la magie garde son mot-clé', () => {
  const s = nouvelle();
  const g = s.ligne('SELECT id, mot_cle_id FROM magie WHERE mot_cle_id IS NOT NULL ORDER BY id');
  refuse(s.lot([{ op: 'supprimer', entite: 'mot_cle', cle: { id: g.mot_cle_id }, forcer: true }]), 'forcée');
  // un mot-clé de magie déverrouillé dans la copie est refusé pour sa référence, par un message qui nomme la magie (l'ancre de sa page, R309, retirée pour ne lire que celle-là)
  s.db.prepare('UPDATE mot_cle SET verrou = 0 WHERE id = ?').run(g.mot_cle_id);
  s.db.prepare('UPDATE page SET mot_cle_id = NULL WHERE mot_cle_id = ?').run(g.mot_cle_id);
  const corps = refuse(s.lot([{ op: 'supprimer', entite: 'mot_cle', cle: { id: g.mot_cle_id } }]), 'sans verrou');
  assert.deepEqual(corps.references.map((r) => [r.table, r.id]), [['magie', g.id]]);
  assert.equal(s.ligne('SELECT mot_cle_id FROM magie WHERE id = ?', g.id).mot_cle_id, g.mot_cle_id);
  s.db.close();
});

test('fusion : la référence suit le mot-clé cible, notée au journal avant la suppression de la source ; la cible déjà citée reçoit un autre mot-clé sans rien changer', () => {
  const s = nouvelle();
  const { type, mot } = typeCite(s);
  const cible = s.creer('Essai référence cible');
  refuse(s.lot([{ op: 'fusionner_mots_cles', mot_cle: mot, dans: cible }]), 'une source reliée à un élément ne se fusionne plus à la main (R309)');
  const r = s.lotAncien([{ op: 'fusionner_mots_cles', mot_cle: mot, dans: cible }]);
  assert.equal(s.ligne('SELECT mot_cle_id FROM type_degats WHERE id = ?', type).mot_cle_id, cible, 'la référence passe à la cible');
  assert.equal(s.ligne('SELECT 1 AS x FROM mot_cle WHERE id = ?', mot), undefined, 'la source a quitté le vocabulaire');
  assert.deepEqual(s.lire('PRAGMA foreign_key_check'), []);
  const ops = s.lire('SELECT table_nom, operation, cle FROM modification WHERE lot_id = ? ORDER BY rang', r.lot);
  const rang = (t, o) => ops.findIndex((m) => m.table_nom === t && m.operation === o);
  assert.ok(rang('type_degats', 'modifier') >= 0 && rang('type_degats', 'modifier') < rang('mot_cle', 'supprimer'), 'la référence est reportée avant la suppression de la source');
  assert.deepEqual(JSON.parse(ops[rang('type_degats', 'modifier')].cle), { id: type });
  assert.match(s.ligne('SELECT resume FROM modification_lot WHERE id = ?', r.lot).resume, /type_degats/, 'le résumé dit que la référence passe à la cible');
  // un mot-clé sans référence se fusionne dans un mot-clé cité : la référence reste
  const autre = s.creer('Essai référence reçue');
  const ok = s.lot([{ op: 'fusionner_mots_cles', mot_cle: autre, dans: cible }]);
  assert.equal(ok.statut, 200, JSON.stringify(ok.corps));
  assert.equal(s.ligne('SELECT mot_cle_id FROM type_degats WHERE id = ?', type).mot_cle_id, cible);
  s.db.close();
});

test('fusion : deux mots-clés cités chacun par une magie ne se fusionnent pas (un mot-clé par magie), rien d’écrit', () => {
  const s = nouvelle();
  const [a, b] = s.lire('SELECT mot_cle_id AS id FROM magie WHERE mot_cle_id IS NOT NULL ORDER BY id LIMIT 2');
  // à la main, la source reliée à une magie est refusée d'abord (R309) ; un lot ancien, qui passe ce verrou, bute sur l'unicité de la magie
  assert.equal(s.lot([{ op: 'fusionner_mots_cles', mot_cle: a.id, dans: b.id }]).statut, 409);
  s.db.prepare('UPDATE mot_cle SET verrou = 0 WHERE id = ?').run(a.id);
  const avant = s.lire('SELECT id, mot_cle_id FROM magie ORDER BY id');
  refuse(s.lot([{ op: 'fusionner_mots_cles', mot_cle: a.id, dans: b.id }]), 'source reliée à une magie');
  assert.throws(() => s.lotAncien([{ op: 'fusionner_mots_cles', mot_cle: a.id, dans: b.id }]), (e) => {
    assert.equal(e.statut, 409);
    assert.equal(e.details.references.length, 2);
    return true;
  });
  assert.deepEqual(s.lire('SELECT id, mot_cle_id FROM magie ORDER BY id'), avant);
  assert.ok(s.ligne('SELECT 1 AS x FROM mot_cle WHERE id = ?', a.id), 'la source reste');
  s.db.close();
});

/** `cible` reçoit le journal de `source` tel quel, puis le rejoue (comme une livraison) : les modifications en conflit. */
function rejouerSur(cible, source) {
  for (const l of source.prepare('SELECT * FROM modification_lot').all()) {
    cible.prepare('INSERT INTO modification_lot (id, fait_le, auteur_id, page_id, resume) VALUES (?, ?, ?, ?, ?)').run(l.id, l.fait_le, l.auteur_id, l.page_id, l.resume);
  }
  for (const m of source.prepare('SELECT * FROM modification').all()) {
    cible.prepare('INSERT INTO modification (lot_id, rang, table_nom, cle, operation, avant, apres, etat, detail, apercu) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(m.lot_id, m.rang, m.table_nom, m.cle, m.operation, m.avant, m.apres, m.etat, m.detail, m.apercu);
  }
  cible.exec('PRAGMA foreign_keys = OFF');
  cible.exec('BEGIN');
  rejouerLeJournal(cible, {});
  cible.exec('COMMIT');
  cible.exec('PRAGMA foreign_keys = ON');
  return cible.prepare("SELECT table_nom, cle, detail FROM modification WHERE etat = 'conflit'").all().map((c) => ({ ...c }));
}

test('rejeu : une fusion se rejoue avec sa référence reportée ; un lot ancien qui supprime un mot-clé cité reste en conflit (rien n’est rompu)', () => {
  const site = nouvelle();
  const livraison = nouvelle();
  const { type, mot } = typeCite(site);
  const cible = site.creer('Essai rejeu référence');
  assert.ok(site.lotAncien([{ op: 'fusionner_mots_cles', mot_cle: mot, dans: cible }]).lot, 'la fusion est au journal');
  // un lot ancien (noté avant que le service ne refuse) qui supprime un mot-clé cité par une magie ou un autre type de dégâts, que les règles livrées citent
  const autre = site.ligne('SELECT t.id AS type, t.mot_cle_id AS mot FROM type_degats t JOIN mot_cle m ON m.id = t.mot_cle_id WHERE m.verrou = 0 AND t.id <> ? ORDER BY t.id', type);
  assert.ok(autre, 'un second type de dégâts lié à un mot-clé non verrouillé');
  const ligneAutre = site.ligne('SELECT * FROM mot_cle WHERE id = ?', autre.mot);
  const lotAncien = '2026-11-01T09:00:01.000Z-000000-essai-references';
  site.db.prepare("INSERT INTO modification_lot (id, fait_le, auteur_id, page_id, resume) VALUES (?, '2026-11-01T09:00:01Z', NULL, 'regles/glossaire/', 'Mot-clé supprimé : lot d’avant la migration 0125')").run(lotAncien);
  site.db.prepare("INSERT INTO modification (lot_id, rang, table_nom, cle, operation, avant, apres, etat) VALUES (?, 1, 'mot_cle', ?, 'supprimer', ?, NULL, 'en_attente')")
    .run(lotAncien, JSON.stringify({ id: autre.mot }), JSON.stringify(ligneAutre));
  // le même, noté comme une suppression forcée (R223 (6) : marqueur en tête du résumé) : le rejeu ne la remplace pas non plus, la référence la met en conflit
  const forcee = site.ligne('SELECT t.id AS type, t.mot_cle_id AS mot FROM type_degats t JOIN mot_cle m ON m.id = t.mot_cle_id WHERE m.verrou = 0 AND t.id NOT IN (?, ?) ORDER BY t.id', type, autre.type);
  const lotForce = '2026-11-01T09:00:02.000Z-000000-essai-references-forcee';
  assert.ok(forcee, 'un troisième type de dégâts lié à un mot-clé non verrouillé');
  site.db.prepare("INSERT INTO modification_lot (id, fait_le, auteur_id, page_id, resume) VALUES (?, '2026-11-01T09:00:02Z', NULL, 'regles/glossaire/', ?)")
    .run(lotForce, `[suppression forcée R223 : ${forcee.mot}]Mot-clé supprimé en forçant`);
  site.db.prepare("INSERT INTO modification (lot_id, rang, table_nom, cle, operation, avant, apres, etat) VALUES (?, 1, 'mot_cle', ?, 'supprimer', ?, NULL, 'en_attente')")
    .run(lotForce, JSON.stringify({ id: forcee.mot }), JSON.stringify(site.ligne('SELECT * FROM mot_cle WHERE id = ?', forcee.mot)));
  const conflits = rejouerSur(livraison.db, site.db);
  assert.equal(livraison.ligne('SELECT mot_cle_id FROM type_degats WHERE id = ?', type).mot_cle_id, cible, 'la fusion rejouée a reporté la référence');
  assert.equal(livraison.ligne('SELECT 1 AS x FROM mot_cle WHERE id = ?', mot), undefined, 'la source fusionnée est partie');
  const enConflit = conflits.filter((c) => c.detail.includes(lotAncien));
  assert.ok(enConflit.length, `la suppression du mot-clé cité est en conflit : ${JSON.stringify(conflits)}`);
  assert.ok(conflits.every((c) => c.detail.includes(lotAncien) || c.detail.includes(lotForce)), 'la fusion, elle, passe sans conflit');
  assert.ok(conflits.some((c) => c.detail.includes(lotForce)), 'la suppression forcée d’un mot-clé cité est en conflit aussi');
  assert.ok(livraison.ligne('SELECT 1 AS x FROM mot_cle WHERE id = ?', forcee.mot), 'le mot-clé cité reste');
  assert.ok(livraison.ligne('SELECT 1 AS x FROM mot_cle WHERE id = ?', autre.mot), 'le mot-clé cité reste');
  assert.equal(livraison.ligne('SELECT mot_cle_id FROM type_degats WHERE id = ?', autre.type).mot_cle_id, autre.mot);
  assert.deepEqual(livraison.lire('PRAGMA foreign_key_check'), []);
  site.db.close();
  livraison.db.close();
});

test('un mot-clé que la base ne cite pas reste supprimable : la référence ne change pas les autres cas', () => {
  const s = nouvelle();
  const libre = s.creer('Essai supprimable');
  assert.deepEqual(mentionsDe(s.db, libre), []);
  const r = s.lot([{ op: 'supprimer', entite: 'mot_cle', cle: { id: libre } }]);
  assert.equal(r.statut, 200, JSON.stringify(r.corps));
  s.db.close();
});
