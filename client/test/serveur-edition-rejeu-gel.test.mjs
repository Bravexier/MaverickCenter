// Décision R205 (3) (« Il faut écrire "Gel" », réponse du propriétaire, 2026-11-07), migration 0103 : l'état « Gelé » des textes de règles s'écrit « Gel ».
// Un lot du journal d'édition noté avant la migration (journal du site de dev en attente quand la livraison arrive, lot figé, journal exporté) a un
// `avant` qui écrit encore « Gelé » : sans adaptateur il tomberait en conflit au rejeu. serveur/edition.mjs#ancienneEcritureDuGel le lit comme la
// migration a réécrit les règles (modèle : serveur/edition-bestiaire.mjs#ancienneEcritureDesResistances).
// Les lignes d'essai se choisissent dans l'état courant parmi celles que la 0103 a réécrites (registre data/migrations/0103-r205-etat-gel.json) et que
// le site de dev n'a pas changées depuis ; les textes écrits par les lots sont tirés de ces lignes.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { ouvrirBaseVivante, preparerBaseVivante } from '../serveur/base-vivante.mjs';
import { ancienneEcritureDuGel, ecritureDuGel, PAGES_DU_GEL, rejouerLeJournal, TEXTES_DU_GEL } from '../serveur/edition.mjs';
import { chargerJournal, nouveauLot } from '../serveur/edition-journal.mjs';
import { cheminBase } from '../src/lib/donnees.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';

const registre = JSON.parse(readFileSync(new URL('../../data/migrations/0103-r205-etat-gel.json', import.meta.url), 'utf8'));
const racine = dossierTemporaire('edition-rejeu-gel');
let compteur = 0;
const vivante = () => ouvrirBaseVivante(preparerBaseVivante({ regles: cheminBase({ sansExemples: false }), dossier: join(racine, `b${(compteur += 1)}`) }).chemin);

test('R205 : l’écriture de l’adaptateur est celle de la 0103 — chaque correction du registre, ses tables et ses pages ; un adjectif ou une gelée restent', () => {
  for (const c of registre.corrections) assert.equal(ecritureDuGel(c.avant), c.apres, `${c.table} ${JSON.stringify(c.cle)}`);
  const colonnes = {};
  for (const c of registre.corrections) (colonnes[c.table] ??= new Set()).add(c.col);
  assert.deepEqual(Object.fromEntries(Object.entries(colonnes).map(([t, s]) => [t, [...s]])), { ...TEXTES_DU_GEL });
  assert.deepEqual([...new Set(registre.corrections.filter((c) => c.table === 'page').map((c) => c.cle.id))], [...PAGES_DU_GEL]);
  assert.deepEqual([registre.derivees.monstre_defense.cible.apres, registre.derivees.monstre_defense.cible_cle.apres],
    [ecritureDuGel(registre.derivees.monstre_defense.cible.avant), 'gel']);
  for (const t of ['un sol gelé', 'Gelée verte', 'os Gelés', 'Cerveau gelé', 'résister au Gel']) assert.equal(ecritureDuGel(t), t, t);
});

/** Une modification notée au journal. */
const modif = (rang, table, cle, operation, avant, apres) => ({ rang, table, cle, operation, avant, apres });
const lot = (modifications) => {
  const { id, instant } = nouveauLot();
  return { id, fait_le: instant, page_id: null, resume: 'ancien lot', modifications };
};
/** Charge les lots dans `db` et rejoue le journal ; l'état de chaque lot ({ etat, detail } de chacune de ses modifications). */
function rejouerLesLots(db, lots) {
  db.exec('PRAGMA foreign_keys = OFF');
  db.exec('BEGIN');
  chargerJournal(db, { format: 'maverick-edition/1', lots });
  rejouerLeJournal(db, {});
  db.exec('COMMIT');
  return (l) => db.prepare('SELECT etat, detail FROM modification WHERE lot_id = ? ORDER BY rang').all(l.id).map((x) => ({ ...x }));
}

test('R205 : un lot noté avant la 0103 (une rubrique réordonnée et ses défenses) se rejoue ; il écrit « Gel », et monstre_defense suit sa rubrique', () => {
  const db = vivante();
  const rubrique = (cle) => db.prepare('SELECT * FROM monstre_rubrique WHERE monstre_id = ? AND rang = ?').get(cle.monstre_id, cle.rang);
  const defense = (d) => db.prepare('SELECT * FROM monstre_defense WHERE monstre_id = ? AND sens = ? AND rang = ?').get(d.monstre_id, d.sens, d.rang);
  // une défense « Gel » de la 0103, précédée d'une autre cible, dont la rubrique écrit « …, X, Gel, … » telle que la migration l'a laissée
  let choix = null;
  for (const d of registre.derivees.monstre_defense.lignes) {
    const ici = defense(d);
    const avant = defense({ ...d, rang: d.rang - 1 });
    if (!ici || !avant || ici.cible !== 'Gel' || ici.cible_cle !== 'gel') continue;
    const c = registre.corrections.find((x) => x.table === 'monstre_rubrique' && x.cle.monstre_id === d.monstre_id && rubrique(x.cle)?.texte === x.apres
      && x.apres.includes(`${avant.cible}, Gel`));
    if (c) {
      choix = { d, ici, avant, c };
      break;
    }
  }
  assert.ok(choix, 'une rubrique de la 0103 que le site de dev n’a pas changée');
  const { d, ici, avant, c } = choix;
  const reordonne = (t) => t.replace(`${avant.cible}, Gelé`, `Gelé, ${avant.cible}`);
  const cleDe = (rang) => ({ monstre_id: d.monstre_id, sens: d.sens, rang });
  // la forme d'avant la 0103 : l'avant écrit « Gelé » (cible `gele`), et le lot aussi
  const l1 = lot([
    modif(1, 'monstre_rubrique', c.cle, 'modifier', { texte: c.avant }, { texte: reordonne(c.avant) }),
    modif(2, 'monstre_defense', cleDe(d.rang - 1), 'modifier', { cible: avant.cible, cible_cle: avant.cible_cle }, { cible: 'Gelé', cible_cle: 'gele' }),
    modif(3, 'monstre_defense', cleDe(d.rang), 'modifier', { cible: 'Gelé', cible_cle: 'gele' }, { cible: avant.cible, cible_cle: avant.cible_cle }),
  ]);
  // un lot qui ne lit pas les règles (ni avant ni après la 0103) : toujours en conflit, l'adaptateur ne cache rien
  const autre = registre.corrections.find((x) => x.table === 'monstre_rubrique' && x.cle.monstre_id !== d.monstre_id && rubrique(x.cle)?.texte === x.apres);
  const l2 = lot([modif(1, 'monstre_rubrique', autre.cle, 'modifier', { texte: `${autre.avant} (jamais écrit)` }, { texte: `${autre.avant} (réécrit)` })]);
  const etat = rejouerLesLots(db, [l1, l2]);
  assert.deepEqual(etat(l1).map((x) => x.etat), ['en_attente', 'en_attente', 'en_attente'], JSON.stringify(etat(l1)));
  assert.equal(rubrique(c.cle).texte, ecritureDuGel(reordonne(c.avant)));
  assert.ok(!rubrique(c.cle).texte.includes('Gelé'));
  assert.deepEqual([defense(cleDe(d.rang - 1)).cible, defense(cleDe(d.rang - 1)).cible_cle], ['Gel', 'gel']);
  assert.deepEqual([defense(cleDe(d.rang)).cible, defense(cleDe(d.rang)).cible_cle], [avant.cible, avant.cible_cle]);
  assert.equal(defense(cleDe(d.rang)).source_ref, ici.source_ref);
  assert.equal(etat(l2)[0].etat, 'conflit', JSON.stringify(etat(l2)));
  assert.equal(rubrique(autre.cle).texte, autre.apres, 'rien d’écrit');
  db.close();
});

test('R205 : un lot sans trace de « Gelé » dans ses avant (noté après la 0103, ou hors de ces textes) passe tel quel', () => {
  const db = vivante();
  const m = (table, cle, avant, apres, lotId = 'L') => ({ lot_id: lotId, rang: 1, table_nom: table, cle: JSON.stringify(cle), operation: 'modifier',
    avant: JSON.stringify(avant), apres: JSON.stringify(apres) });
  // sans journal, l'adaptateur ne voit aucun lot d'avant : il rend chaque modification telle quelle
  const adapte = ancienneEcritureDuGel(db);
  const apresLa0103 = m('monstre_rubrique', { monstre_id: 'x', rang: 1 }, { texte: 'Glace, Gel' }, { texte: 'Glace, Gelé' });
  assert.equal(adapte(apresLa0103), apresLa0103);
  const ailleurs = m('page', { id: 'lore/un-codex' }, { corps_md: 'Le Cœur Gelé' }, { corps_md: 'Le Cœur Gelé.' });
  assert.equal(adapte(ailleurs), ailleurs);
  db.close();
});

test('R205 : un lot noté après la 0103 dont l’avant écrit « Gelé » parce qu’un lot précédent l’a retapé n’est pas réécrit (pas de faux conflit) ; deux lots d’avant se suivent', () => {
  const db = vivante();
  // des textes que la 0103 a réécrits et que le site de dev n'a pas changés depuis (état courant), pris tels qu'en place : une maladie (le cas relevé),
  // sinon un autre texte, et une rubrique de monstre
  const texte = (x) => db.prepare(`SELECT "${x.col}" AS t FROM "${x.table}" WHERE ${Object.keys(x.cle).map((k) => `"${k}" = ?`).join(' AND ')}`)
    .get(...Object.values(x.cle))?.t;
  const intactes = registre.corrections.filter((x) => x.table !== 'page' && texte(x) === x.apres);
  const c = intactes.find((x) => x.table === 'maladie') ?? intactes.find((x) => x.table !== 'monstre_rubrique');
  const c2 = intactes.find((x) => x.table === 'monstre_rubrique' && x !== c);
  assert.ok(c && c2, 'deux textes de la 0103 que le site de dev n’a pas changés');
  const effets = (x) => texte(x);
  // après la 0103 : un lot retape « Gelé » (avant : la ligne en place, « Gel »), puis un autre modifie de nouveau la ligne (avant : « Gelé »)
  const retape = `${c.apres} (retapé)`.replace(/(?<!\p{L})Gel(?!\p{L})/u, 'Gelé');
  assert.notEqual(retape, ecritureDuGel(retape), 'le texte retapé écrit l’état « Gelé »');
  const ecrit = (x, t) => ({ [x.col]: t });
  const a = lot([modif(1, c.table, c.cle, 'modifier', ecrit(c, c.apres), ecrit(c, retape))]);
  const b = lot([modif(1, c.table, c.cle, 'modifier', ecrit(c, retape), ecrit(c, `${retape} (encore)`))]);
  // avant la 0103 : deux lots qui se suivent sur la même ligne, le second part de ce que le premier a écrit (« Gelé » des deux côtés)
  const d1 = lot([modif(1, c2.table, c2.cle, 'modifier', ecrit(c2, c2.avant), ecrit(c2, `${c2.avant} (1)`))]);
  const d2 = lot([modif(1, c2.table, c2.cle, 'modifier', ecrit(c2, `${c2.avant} (1)`), ecrit(c2, `${c2.avant} (2)`))]);
  const etat = rejouerLesLots(db, [a, b, d1, d2]);
  for (const l of [a, b, d1, d2]) assert.deepEqual(etat(l).map((x) => x.etat), ['en_attente'], JSON.stringify(etat(l)));
  assert.equal(effets(c), `${retape} (encore)`, 'écrit tel que le site de dev l’a noté, « Gelé » compris');
  assert.equal(effets(c2), ecritureDuGel(`${c2.avant} (2)`), 'les lots d’avant la 0103 écrivent « Gel »');

  // l'adaptateur seul, sur le journal de ces deux lots (sans rejeu) : dans l'ordre du rejeu, le second passe tel quel ; sans le lot qui a retapé
  // « Gelé » avant lui, son avant n'est pas la ligne en place et il est lu comme d'avant la 0103
  const neuve = vivante();
  chargerJournal(neuve, { format: 'maverick-edition/1', lots: [a, b] });
  const noteDu = (l) => ({ ...neuve.prepare('SELECT * FROM modification WHERE lot_id = ?').get(l.id) });
  const [premier, second] = [noteDu(a), noteDu(b)];
  const adapte = ancienneEcritureDuGel(neuve);
  assert.equal(adapte(premier), premier);
  assert.equal(adapte(second), second);
  assert.equal(JSON.parse(ancienneEcritureDuGel(neuve)(second).avant)[c.col], ecritureDuGel(retape));
  neuve.close();
  db.close();
});
