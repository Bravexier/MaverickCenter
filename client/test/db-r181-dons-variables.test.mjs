// Décision R181 du propriétaire : les dons « Variable » du Mage Bleu (Mimétisme, Mime, Principale, Secondaire, Ultime raison) obtiennent une entrée
// du tableau du bas de l'onglet Mage Bleu (classe_annexe, A58:AR127), « limité sa magie innée (sauf mention contraire) pour le don "secondaire" » ;
// « Dans le cas où il n'a pas de magie aquise, il ne peut pas choisir le don "secondaire" » ; chaque entrée ne se prend qu'une fois (Q93). Migration
// data/migrations/0088-r181-dons-variables-du-mage-bleu.sql : classe_annexe_entree (les 54 entrées, citées sans rien réécrire, id figés),
// capacite_variable (la magie que vise chaque don), personnage_don_obtenu (le choix d'une fiche) et quatre règles de v_personnage_controle. Q96 (une
// magie à 3 entrées pour 4 dons « Variable ») : la vue n'exige pas un choix impossible. Les écritures se font dans une COPIE de la base construite,
// jamais dans var/maverick.db ni dans data/rows.
import assert from 'node:assert/strict';
import { copyFileSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { cheminBase, ouvrirBase } from '../src/lib/donnees.mjs';
import { normalize } from '../src/lib/text.mjs';
import { fichierTemporaire } from './aide-dossier-temporaire.mjs';

const MAGE_BLEU = 'classes/mage-bleu';
const SAPHIR = 'classes/mage-bleu#specialite:mage-saphir';
const DON = (nom) => `capacites/mage-bleu-${nom}`;
const ENTREE = (magie, nom) => `${MAGE_BLEU}#entree:${magie}:${nom}`;
const INSTANT = '2026-10-30T12:00:00Z';
const lire = (chemin) => readFileSync(new URL(`../../${chemin}`, import.meta.url), 'utf8');

// Les 54 entrées, par ligne du tableau (libelle_cle), dans l'ordre du texte : leurs identifiants sont figés (un nom corrigé garde le sien).
const ENTREES = {
  sang: ['temeraire', 'regeneration', 'attaque-saignante', 'rage-de-sang'],
  arcane: ['rechargement', 'rune-immediate', 'miroir-partiel'],
  corruption: ['science-du-critique', 'eponge-a-corruption', 'pollution', 'petronage'],
  'espace-temps': ['25h', 'couple-extremite', 'double'],
  vide: ['attaque-dissipante', 'maitre-du-silence', 'esprit-solide', 'totem-du-vide'],
  necromancie: ['squelettique', 'attaque-poison', 'chair-de-mort', 'attrape-moi'],
  feu: ['moteur-thermique', 'deflagration', 'eponge-a-soin', 'sang-de-feu'],
  eau: ['gluant', 'reparation', 'aisance-marine', 'mucus'],
  glace: ['attaque-glacante', 'neige-permanente', 'peau-froide', 'pas-de-la-neige'],
  terre: ['racine', 'grimpeur', 'peau-dure', 'sujet-epineux'],
  vent: ['charge-sans-peur', 'crache-spore', 'chute-douce', 'courant-rapide'],
  foudre: ['paratonnerre', 'pied-veloce', 'dynamo', 'predateur-cinetique'],
  lumiere: ['force-solaire', 'lumiere-de-force', 'soin-non-mort', 'lanterne-sur-baton'],
  ombre: ['attaque-maudite', 'vision-nocturne-partielle', 'mantelet-des-tenebres', 'obscurite-avantageuse'],
};
const TYPES = { passif: 'passif', actif: 'actif', action: 'action', reaction: 'reaction' };

test('R181 : les 54 entrées du tableau du Mage Bleu, 3 ou 4 par magie, une ligne par magie hors Potentiel Illimité (R25, R176), identifiants figés', () => {
  const db = ouvrirBase({ sansExemples: false });
  assert.ok(db.prepare('PRAGMA user_version').get().user_version >= 88, 'schéma d’au moins la version de la migration 0088');
  const lignes = db.prepare(`SELECT x.libelle_cle, x.magie_id, e.id FROM classe_annexe_entree e
    JOIN classe_annexe x ON x.classe_id = e.classe_id AND x.rang = e.annexe_rang ORDER BY x.rang, e.rang`).all();
  assert.equal(lignes.length, 54);
  const parMagie = {};
  for (const l of lignes) (parMagie[l.libelle_cle] ??= []).push(l.id);
  assert.deepEqual(parMagie, Object.fromEntries(Object.entries(ENTREES).map(([m, noms]) => [m, noms.map((n) => ENTREE(m, n))])));
  assert.deepEqual(Object.entries(ENTREES).filter(([, n]) => n.length === 3).map(([m]) => m), ['arcane', 'espace-temps'], 'deux magies à 3 entrées (Q96)');
  // une ligne par magie, chacune une fois, toutes sauf le Potentiel Illimité (le Mage Bleu ne l'a jamais : R25, R176)
  const magies = db.prepare('SELECT DISTINCT magie_id FROM classe_annexe WHERE classe_id = ?').all(MAGE_BLEU).map((r) => r.magie_id).sort();
  assert.equal(db.prepare('SELECT count(*) AS n FROM classe_annexe WHERE classe_id = ?').get(MAGE_BLEU).n, magies.length);
  assert.deepEqual(magies, db.prepare("SELECT id FROM magie WHERE id <> 'magies/potentiel-illimite' ORDER BY id").all().map((r) => r.id));
  // l'identifiant commence par la classe et la ligne de sa magie (le nom qui suit est celui de la création, figé)
  for (const l of lignes) assert.ok(l.id.startsWith(`${MAGE_BLEU}#entree:${l.libelle_cle}:`), l.id);
});

test('R181 : chaque entrée est citée telle quelle — la ligne de la source = type_brut, nom, « . », effet ; les lignes redonnent le texte de classe_annexe', () => {
  const db = ouvrirBase({ sansExemples: false });
  for (const x of db.prepare('SELECT classe_id, rang, texte, source_ref FROM classe_annexe').all()) {
    const entrees = db.prepare('SELECT * FROM classe_annexe_entree WHERE classe_id = ? AND annexe_rang = ? ORDER BY rang').all(x.classe_id, x.rang);
    assert.deepEqual(entrees.map((e) => e.rang), entrees.map((_, i) => i + 1), `${x.source_ref} : rangs 1 à n`);
    assert.equal(entrees.map((e) => `${e.type_brut} ${e.nom}. ${e.effet}`).join('\n'), x.texte, x.source_ref);
    for (const e of entrees) {
      assert.equal(e.source_ref, x.source_ref, e.id);
      assert.equal(e.nom_cle, normalize(e.nom), e.id);
      // « (Passif) », « (Actif 2 fois/combat) », « (Réaction 1 fois/tour) », « (Action) » ; « (Passif] » (Terre, Sujet épineux) tel qu'écrit
      const m = /^\((Passif|Actif|Action|Réaction)(?: (.+))?[)\]]$/.exec(e.type_brut);
      assert.ok(m, `${e.id} : en-tête ${e.type_brut}`);
      assert.equal(e.type, TYPES[normalize(m[1])], e.id);
      assert.equal(e.limite_brute, m[2] ?? null, e.id);
      const limite = /^(\d+) fois\/(\w+)$/.exec(m[2] ?? '');
      assert.deepEqual([e.limite_nombre, e.limite_periode], limite ? [Number(limite[1]), limite[2]] : [null, null], e.id);
    }
  }
  const compte = (sql) => db.prepare(sql).all().map((r) => ({ ...r }));
  assert.deepEqual(compte('SELECT type, count(*) AS n FROM classe_annexe_entree GROUP BY type ORDER BY type'),
    [{ type: 'actif', n: 6 }, { type: 'action', n: 2 }, { type: 'passif', n: 44 }, { type: 'reaction', n: 2 }]);
  assert.deepEqual(compte("SELECT type_brut FROM classe_annexe_entree WHERE type_brut NOT LIKE '%)'"), [{ type_brut: '(Passif]' }]);
  // chaque entrée est une sous-entité de la page de sa classe (db:check : complétude de page_entite)
  assert.equal(db.prepare(`SELECT count(*) AS n FROM classe_annexe_entree e JOIN page_entite p ON p.entite_table = 'classe_annexe_entree'
    AND p.entite_id = e.id AND p.page_id = e.classe_id AND p.principale = 0`).get().n, 54);
});

test('R181 : capacite_variable — les cinq dons « Variable » du Mage Bleu, la magie innée ou acquise lue dans leur texte', () => {
  const db = ouvrirBase({ sansExemples: false });
  const variables = db.prepare(`SELECT c.id, c.effet, v.magie FROM capacite c LEFT JOIN capacite_variable v ON v.capacite_id = c.id
    WHERE c.type = 'variable' ORDER BY c.id`).all();
  assert.deepEqual(variables.map((r) => [r.id, r.magie]), [
    [DON('mime'), 'innee'], [DON('mimetisme'), 'innee'], [DON('principale'), 'innee'], [DON('secondaire'), 'acquise'], [DON('ultime-raison'), 'innee'],
  ]);
  for (const r of variables) {
    const vise = /lié à sa magie (innée|acquise)/.exec(r.effet);
    assert.ok(vise, r.id);
    assert.equal(r.magie, normalize(vise[1]), `${r.id} : « ${vise[0]} »`);
  }
  assert.equal(db.prepare('SELECT count(*) AS n FROM capacite_variable').get().n, variables.length, 'rien d’autre qu’un don « Variable »');
  assert.equal(db.prepare(`SELECT count(*) AS n FROM capacite_variable v JOIN capacite c ON c.id = v.capacite_id
    WHERE NOT EXISTS (SELECT 1 FROM classe_annexe x WHERE x.classe_id = c.classe_id)`).get().n, 0, 'la classe du don a son tableau');
});

/** Une copie de la base construite, ouverte en écriture, fermée à la fin du test `t`. */
function copie(t) {
  const chemin = fichierTemporaire('maverick.db', 'r181', { t });
  copyFileSync(cheminBase({ sansExemples: false }), chemin);
  const db = new DatabaseSync(chemin);
  db.exec('PRAGMA foreign_keys = ON');
  t.after(() => db.close());
  return db;
}
function inserer(db, table, ligne) {
  const cols = Object.keys(ligne);
  db.prepare(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`).run(...Object.values(ligne));
}
/** Un prétiré Mage Bleu mono-classe (niveau de classe = 2 × niveau global), de magie innée `innee`, sa spécialité et ses dons à choix. */
function mageBleu(db, id, { xp = 0, innee = 'magies/magie-du-feu', acquise = null, specialite = null, dons = [] } = {}) {
  inserer(db, 'personnage', {
    id, nature: 'pretire', visibilite: 'tous', nom: `Essai ${id}`, magie_innee_id: innee, magie_acquise_id: acquise, mode_classe: 'mono', xp,
    alignement_loyal: 0, alignement_chaotique: 0, alignement_bon: 0, alignement_mauvais: 0, bourse_pp: 0, bourse_ro: 0, bourse_rf: 0, ambidextrie: 0,
    cree_le: INSTANT, modifie_le: INSTANT,
  });
  inserer(db, 'personnage_classe', { personnage_id: id, rang: 1, classe_id: MAGE_BLEU, specialite_id: specialite });
  for (const d of dons) inserer(db, 'personnage_capacite', { personnage_id: id, capacite_id: DON(d) });
}
const obtenir = (db, id, don, entree) => inserer(db, 'personnage_don_obtenu', { personnage_id: id, source: DON(don), entree_id: entree });
const reglesDonObtenu = (db, id) => db.prepare("SELECT regle, detail FROM v_personnage_controle WHERE personnage_id = ? AND regle LIKE 'don_obtenu%' ORDER BY regle, detail")
  .all(id).map((r) => ({ ...r }));

test('R181 : personnage_don_obtenu — clé (fiche, don), une entrée une seule fois par fiche, supprimée avec la fiche, vide dans data/rows', (t) => {
  const lecture = ouvrirBase({ sansExemples: false });
  assert.deepEqual(lecture.prepare('PRAGMA table_xinfo(personnage_don_obtenu)').all().map(({ name, type, notnull, pk }) => ({ name, type, notnull, pk })), [
    { name: 'personnage_id', type: 'TEXT', notnull: 1, pk: 1 },
    { name: 'source', type: 'TEXT', notnull: 1, pk: 2 },
    { name: 'entree_id', type: 'TEXT', notnull: 1, pk: 0 },
  ]);
  assert.deepEqual({ ...lecture.prepare('SELECT strict, wr FROM pragma_table_list WHERE name = ?').get('personnage_don_obtenu') }, { strict: 1, wr: 1 });
  assert.deepEqual(lecture.prepare('PRAGMA foreign_key_list(personnage_don_obtenu)').all().map(({ table, from, to, on_delete }) => ({ table, from, to, on_delete }))
    .sort((a, b) => a.from.localeCompare(b.from)), [
    { table: 'classe_annexe_entree', from: 'entree_id', to: 'id', on_delete: 'NO ACTION' },
    { table: 'personnage', from: 'personnage_id', to: 'id', on_delete: 'CASCADE' },
    { table: 'capacite', from: 'source', to: 'id', on_delete: 'NO ACTION' },
  ]);
  assert.equal(lecture.prepare('SELECT count(*) AS n FROM personnage_don_obtenu').get().n, 0);
  assert.equal(lire('data/rows/personnage_don_obtenu.sql').trim().split('\n').length, 1, 'data/rows : en-tête seul');

  const db = copie(t);
  mageBleu(db, 'r181-cles', { xp: 11450, specialite: SAPHIR, dons: ['mime'] });
  obtenir(db, 'r181-cles', 'mimetisme', ENTREE('feu', 'moteur-thermique'));
  assert.throws(() => obtenir(db, 'r181-cles', 'mimetisme', ENTREE('feu', 'deflagration')), /UNIQUE constraint failed: personnage_don_obtenu\.personnage_id, personnage_don_obtenu\.source/, 'un choix par don');
  assert.throws(() => obtenir(db, 'r181-cles', 'mime', ENTREE('feu', 'moteur-thermique')), /UNIQUE constraint failed: personnage_don_obtenu\.personnage_id, personnage_don_obtenu\.entree_id/, 'une entrée une seule fois (Q93)');
  assert.throws(() => obtenir(db, 'r181-cles', 'mime', ENTREE('feu', 'inconnue')), /FOREIGN KEY constraint failed/);
  assert.throws(() => inserer(db, 'personnage_don_obtenu', { personnage_id: 'r181-cles', source: 'capacites/inconnue', entree_id: ENTREE('feu', 'deflagration') }), /FOREIGN KEY constraint failed/);
  obtenir(db, 'r181-cles', 'mime', ENTREE('feu', 'deflagration'));
  // le choix d'une autre fiche ne gêne pas : l'entrée est unique par fiche
  mageBleu(db, 'r181-autre');
  obtenir(db, 'r181-autre', 'mimetisme', ENTREE('feu', 'moteur-thermique'));
  db.prepare("DELETE FROM personnage WHERE id = 'r181-cles'").run();
  assert.deepEqual(db.prepare('SELECT personnage_id, source FROM personnage_don_obtenu ORDER BY personnage_id').all().map((r) => ({ ...r })),
    [{ personnage_id: 'r181-autre', source: DON('mimetisme') }], 'les choix partent avec la fiche');
});

test('R181 : don_obtenu_a_choisir, don_obtenu_hors_liste (magie innée), don_obtenu_source_perdue (gardé sans effet, signalé)', (t) => {
  const db = copie(t);
  mageBleu(db, 'r181-feu');
  assert.deepEqual(reglesDonObtenu(db, 'r181-feu'), [{ regle: 'don_obtenu_a_choisir', detail: DON('mimetisme') }], 'Mimétisme, niveau 1, acquis sans choix');
  obtenir(db, 'r181-feu', 'mimetisme', ENTREE('eau', 'gluant'));
  assert.deepEqual(reglesDonObtenu(db, 'r181-feu'), [{ regle: 'don_obtenu_hors_liste', detail: `${DON('mimetisme')} = ${ENTREE('eau', 'gluant')}` }], 'Eau : pas sa magie innée');
  db.prepare("UPDATE personnage_don_obtenu SET entree_id = ? WHERE personnage_id = 'r181-feu'").run(ENTREE('feu', 'sang-de-feu'));
  assert.deepEqual(reglesDonObtenu(db, 'r181-feu'), [], 'une entrée de sa magie innée');
  // la magie innée change : le choix reste, hors de la nouvelle liste
  db.prepare("UPDATE personnage SET magie_innee_id = 'magies/magie-de-leau' WHERE id = 'r181-feu'").run();
  assert.deepEqual(reglesDonObtenu(db, 'r181-feu'), [{ regle: 'don_obtenu_hors_liste', detail: `${DON('mimetisme')} = ${ENTREE('feu', 'sang-de-feu')}` }]);
  // le don n'est plus acquis (classe changée) : choix gardé, signalé une seule fois (source perdue, pas hors liste)
  db.prepare("UPDATE personnage_classe SET classe_id = 'classes/guerrier' WHERE personnage_id = 'r181-feu'").run();
  assert.deepEqual(reglesDonObtenu(db, 'r181-feu'), [{ regle: 'don_obtenu_source_perdue', detail: `${DON('mimetisme')} = ${ENTREE('feu', 'sang-de-feu')}` }]);
  // un don qui n'est pas « Variable » n'obtient rien : source perdue
  mageBleu(db, 'r181-pas-variable', { xp: 1650 });
  obtenir(db, 'r181-pas-variable', 'mimetisme', ENTREE('feu', 'deflagration'));
  obtenir(db, 'r181-pas-variable', 'vision-dacier', ENTREE('feu', 'moteur-thermique'));
  assert.deepEqual(reglesDonObtenu(db, 'r181-pas-variable'), [{ regle: 'don_obtenu_source_perdue', detail: `${DON('vision-dacier')} = ${ENTREE('feu', 'moteur-thermique')}` }]);
  // Mime (niveau 10, Mage saphir) choisi d'avance : rien d'exigé avant son niveau ; son choix fait d'avance est une source perdue (sans effet)
  mageBleu(db, 'r181-mime', { xp: 950, specialite: SAPHIR, dons: ['mime'] });
  obtenir(db, 'r181-mime', 'mimetisme', ENTREE('feu', 'moteur-thermique'));
  assert.deepEqual(reglesDonObtenu(db, 'r181-mime'), [], 'niveau global 4 : niveau de classe 8, Mime pas encore acquis');
  obtenir(db, 'r181-mime', 'mime', ENTREE('feu', 'deflagration'));
  assert.deepEqual(reglesDonObtenu(db, 'r181-mime'), [{ regle: 'don_obtenu_source_perdue', detail: `${DON('mime')} = ${ENTREE('feu', 'deflagration')}` }]);
  db.prepare("DELETE FROM personnage_don_obtenu WHERE personnage_id = 'r181-mime' AND source = ?").run(DON('mime'));
  db.prepare("UPDATE personnage SET xp = 2450 WHERE id = 'r181-mime'").run();
  assert.deepEqual(reglesDonObtenu(db, 'r181-mime'), [{ regle: 'don_obtenu_a_choisir', detail: DON('mime') }], 'niveau global 6 : niveau de classe 12, Mime acquis');
});

test('R181 : Secondaire vise la magie acquise ; sans magie acquise, il ne se choisit pas (don_obtenu_sans_magie_acquise)', (t) => {
  const db = copie(t);
  // niveau global 8 : niveau de classe 16, Mage saphir, Mime et Secondaire choisis
  mageBleu(db, 'r181-sec', { xp: 5450, specialite: SAPHIR, dons: ['mime', 'secondaire'] });
  obtenir(db, 'r181-sec', 'mimetisme', ENTREE('feu', 'moteur-thermique'));
  obtenir(db, 'r181-sec', 'mime', ENTREE('feu', 'deflagration'));
  assert.deepEqual(reglesDonObtenu(db, 'r181-sec'), [{ regle: 'don_obtenu_sans_magie_acquise', detail: DON('secondaire') }], 'rien à choisir sans liste');
  obtenir(db, 'r181-sec', 'secondaire', ENTREE('feu', 'eponge-a-soin'));
  assert.deepEqual(reglesDonObtenu(db, 'r181-sec'), [
    { regle: 'don_obtenu_hors_liste', detail: `${DON('secondaire')} = ${ENTREE('feu', 'eponge-a-soin')}` },
    { regle: 'don_obtenu_sans_magie_acquise', detail: DON('secondaire') },
  ]);
  db.prepare("DELETE FROM personnage_don_obtenu WHERE personnage_id = 'r181-sec' AND source = ?").run(DON('secondaire'));
  db.prepare("UPDATE personnage SET magie_acquise_id = 'magies/magie-de-la-glace' WHERE id = 'r181-sec'").run();
  assert.deepEqual(reglesDonObtenu(db, 'r181-sec'), [{ regle: 'don_obtenu_a_choisir', detail: DON('secondaire') }]);
  obtenir(db, 'r181-sec', 'secondaire', ENTREE('feu', 'eponge-a-soin'));
  assert.deepEqual(reglesDonObtenu(db, 'r181-sec'), [{ regle: 'don_obtenu_hors_liste', detail: `${DON('secondaire')} = ${ENTREE('feu', 'eponge-a-soin')}` }], 'Feu : la magie innée, pas l’acquise');
  db.prepare("UPDATE personnage_don_obtenu SET entree_id = ? WHERE personnage_id = 'r181-sec' AND source = ?").run(ENTREE('glace', 'peau-froide'), DON('secondaire'));
  assert.deepEqual(reglesDonObtenu(db, 'r181-sec'), []);
  // Mimétisme ne prend pas dans la magie acquise
  db.prepare("UPDATE personnage_don_obtenu SET entree_id = ? WHERE personnage_id = 'r181-sec' AND source = ?").run(ENTREE('glace', 'neige-permanente'), DON('mimetisme'));
  assert.deepEqual(reglesDonObtenu(db, 'r181-sec'), [{ regle: 'don_obtenu_hors_liste', detail: `${DON('mimetisme')} = ${ENTREE('glace', 'neige-permanente')}` }]);
});

test('R181, Q96 : quatre dons « Variable » de magie innée sur une magie à 3 entrées — le 4ᵉ n’est pas exigé ; une magie sans ligne non plus', (t) => {
  const db = copie(t);
  // niveau global 10 : niveau de classe 20, Mage saphir : Mimétisme, Mime, Principale, Ultime raison, tous de la magie innée (Arcane : 3 entrées)
  mageBleu(db, 'r181-q96', { xp: 11450, innee: 'magies/magie-de-larcane', specialite: SAPHIR, dons: ['mime', 'principale'] });
  const aChoisir = (...dons) => dons.map((d) => ({ regle: 'don_obtenu_a_choisir', detail: DON(d) }));
  assert.deepEqual(reglesDonObtenu(db, 'r181-q96'), aChoisir('mime', 'mimetisme', 'principale', 'ultime-raison'));
  obtenir(db, 'r181-q96', 'mimetisme', ENTREE('arcane', 'rechargement'));
  obtenir(db, 'r181-q96', 'mime', ENTREE('arcane', 'rune-immediate'));
  assert.deepEqual(reglesDonObtenu(db, 'r181-q96'), aChoisir('principale', 'ultime-raison'), 'une entrée libre : chacun des deux peut la prendre');
  obtenir(db, 'r181-q96', 'principale', ENTREE('arcane', 'miroir-partiel'));
  assert.deepEqual(reglesDonObtenu(db, 'r181-q96'), [], 'plus d’entrée libre : Ultime raison ne donne rien, la vue ne l’exige pas (Q96)');
  // Feu (4 entrées) : le 4ᵉ don garde une entrée libre, il est exigé
  mageBleu(db, 'r181-q96-feu', { xp: 11450, specialite: SAPHIR, dons: ['mime', 'principale'] });
  for (const [don, nom] of [['mimetisme', 'moteur-thermique'], ['mime', 'deflagration'], ['principale', 'eponge-a-soin']]) obtenir(db, 'r181-q96-feu', don, ENTREE('feu', nom));
  assert.deepEqual(reglesDonObtenu(db, 'r181-q96-feu'), aChoisir('ultime-raison'));
  // une magie innée sans ligne du tableau (le Potentiel Illimité, que le Mage Bleu n'a jamais : R25, règle classe_exclue) : rien n'est exigé
  mageBleu(db, 'r181-pi', { innee: 'magies/potentiel-illimite' });
  assert.deepEqual(reglesDonObtenu(db, 'r181-pi'), []);
});
