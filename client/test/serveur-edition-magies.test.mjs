// Édition des magies et des sorts depuis le site de dev (client/serveur/edition.mjs) : les colonnes typées, types, modes et bonus de NM suivent le texte
// des cases (lib/sort-analyse.mjs) ; une ligne peut avoir un effet dû aux NM dans plusieurs colonnes (demande du propriétaire) ;
// la table des relations entre magies ne se modifie pas.
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { traiter } from '../serveur/api.mjs';
import { ouvrirBaseVivante, preparerBaseVivante } from '../serveur/base-vivante.mjs';
import { cheminBase } from '../src/lib/donnees.mjs';

const racine = mkdtempSync(join(tmpdir(), 'maverick-edition-magies-'));
after(() => rmSync(racine, { recursive: true, force: true }));
const { chemin } = preparerBaseVivante({ regles: cheminBase({ sansExemples: false }), dossier: join(racine, 'db') });
const db = ouvrirBaseVivante(chemin);
const service = { base: () => db, etat: () => ({}), edition: true };
const enregistrer = (operations) =>
  traiter({ methode: 'POST', chemin: '/api/edition/', entetes: { 'content-type': 'application/json' }, corps: JSON.stringify({ page: 'magies/x', operations }) }, service);
const ligne = (sql, ...p) => db.prepare(sql).get(...p);
const lignes = (sql, ...p) => db.prepare(sql).all(...p);
const modifier = (table, cle, valeurs) => enregistrer([{ op: 'modifier', table, cle, valeurs }]);

// un sort dont seul le coût a un bonus de NM, un autre dont seuls les effets en ont
const SEUL_COUT = ligne("SELECT sort_id AS id FROM sort_bonus_maitrise GROUP BY sort_id HAVING count(DISTINCT champ) = 1 AND max(champ) = 'cout' ORDER BY sort_id LIMIT 1").id;
const AVEC_ETAT = ligne("SELECT e.sort_id AS id, e.extrait FROM sort_etat e WHERE e.champ = 'effets' ORDER BY e.sort_id LIMIT 1");

test('coût modifié : consommation de chakra, bonus de NM et colonne « Bonus Maîtrise » suivent', () => {
  const r = modifier('sort', { id: SEUL_COUT }, { cout_brut: '40 (-4/NM)' });
  assert.equal(r.statut, 200, JSON.stringify(r.corps));
  const s = ligne('SELECT cout_chakra, bonus_maitrise FROM sort WHERE id = ?', SEUL_COUT);
  assert.equal(s.cout_chakra, 40);
  assert.equal(s.bonus_maitrise, 'Coût : -4/NM');
  assert.deepEqual(lignes("SELECT texte_brut, increment_entier FROM sort_bonus_maitrise WHERE sort_id = ? AND champ = 'cout'", SEUL_COUT).map((b) => ({ ...b })), [{ texte_brut: '-4/NM', increment_entier: -4 }]);
});

test('plusieurs colonnes avec un effet dû aux NM sur une même ligne : permis (demande du propriétaire), chaque bonus est noté', () => {
  const r = modifier('sort', { id: SEUL_COUT }, { dsb_brut: '3d6 dégâts (+1d6/NM)' });
  assert.equal(r.statut, 200, JSON.stringify(r.corps));
  assert.equal(ligne('SELECT bonus_maitrise FROM sort WHERE id = ?', SEUL_COUT).bonus_maitrise, 'Coût : -4/NM\nD/S/B : +1d6/NM');
  assert.deepEqual(lignes('SELECT champ FROM sort_bonus_maitrise WHERE sort_id = ? ORDER BY champ', SEUL_COUT).map((b) => b.champ), ['cout', 'dsb']);
  const ok = modifier('sort', { id: SEUL_COUT }, { cout_brut: '40' });
  assert.equal(ok.statut, 200, JSON.stringify(ok.corps));
  assert.equal(ligne('SELECT bonus_maitrise FROM sort WHERE id = ?', SEUL_COUT).bonus_maitrise, 'D/S/B : +1d6/NM');
  assert.equal(modifier('sort', { id: SEUL_COUT }, { dsb_brut: '/' }).statut, 200);
  assert.equal(ligne('SELECT dsb_brut FROM sort WHERE id = ?', SEUL_COUT).dsb_brut, null, '« / » : case vide');
});

test('type modifié : sort_type, sort_mode et colonnes IC / imparable suivent ; type inconnu refusé', () => {
  const r = modifier('sort', { id: SEUL_COUT }, { type_brut: 'Attaque/ Entrave (Imparable)' });
  assert.equal(r.statut, 200, JSON.stringify(r.corps));
  assert.deepEqual(lignes('SELECT type, libelle FROM sort_type WHERE sort_id = ? ORDER BY rang', SEUL_COUT).map((t) => t.type), ['attaque', 'entrave']);
  assert.deepEqual(lignes('SELECT mode FROM sort_mode WHERE sort_id = ?', SEUL_COUT).map((m) => m.mode), ['imparable']);
  const s = ligne('SELECT imparable, ic_direct, mode_brut FROM sort WHERE id = ?', SEUL_COUT);
  assert.deepEqual([s.imparable, s.ic_direct, s.mode_brut], [1, 0, 'Imparable']);
  const refus = modifier('sort', { id: SEUL_COUT }, { type_brut: 'Destruction' });
  assert.equal(refus.statut, 400);
  assert.match(refus.corps.erreur, /Type « Destruction » inconnu/);
});

test('effets modifiés : une altération d’état dont l’extrait n’est plus écrit sort de l’index sort_etat', () => {
  const n = ligne("SELECT count(*) AS n FROM sort_etat WHERE sort_id = ? AND champ = 'effets'", AVEC_ETAT.id).n;
  const r = modifier('sort', { id: AVEC_ETAT.id }, { effets: 'Texte entièrement réécrit sur le site de dev.' });
  assert.equal(r.statut, 200, JSON.stringify(r.corps));
  assert.ok(n > 0);
  assert.equal(ligne("SELECT count(*) AS n FROM sort_etat WHERE sort_id = ? AND champ = 'effets'", AVEC_ETAT.id).n, 0);
});

test('texte du sort de niveau 5 : refusé pour un autre niveau ; nom unique dans sa magie', () => {
  const niveau1 = ligne('SELECT id, magie_id FROM sort WHERE niveau = 1 ORDER BY id LIMIT 1');
  assert.match(modifier('sort', { id: niveau1.id }, { texte_niveau5: 'Incantation' }).corps.erreur, /niveau 5/);
  const autre = ligne('SELECT nom FROM sort WHERE magie_id = ? AND id <> ? LIMIT 1', niveau1.magie_id, niveau1.id).nom;
  assert.equal(modifier('sort', { id: niveau1.id }, { nom: autre }).statut, 422);
  assert.equal(modifier('sort', { id: niveau1.id }, { nom: 'Nouveau nom du sort' }).statut, 200);
  assert.equal(ligne('SELECT nom_cle FROM sort WHERE id = ?', niveau1.id).nom_cle, 'nouveau-nom-du-sort');
});

test('nom d’un autre sort de la magie à la casse, aux accents ou aux espaces près : refusé (409), le corps garde les notes et le texte de niveau 5 de l’autre', () => {
  // l'autre sort a un texte de niveau 5 (titre comparé sans casse ni accents) ; un second a une remarque (libellés comparés espaces regroupés)
  const cinq = ligne('SELECT id, magie_id, nom FROM sort WHERE texte_niveau5 IS NOT NULL ORDER BY magie_id, ordre LIMIT 1');
  const note = ligne('SELECT id, magie_id, nom FROM sort WHERE remarque IS NOT NULL AND magie_id = ? ORDER BY ordre LIMIT 1', cinq.magie_id)
    ?? ligne("SELECT id, magie_id, nom FROM sort WHERE remarque IS NOT NULL AND nom LIKE '% %' ORDER BY magie_id, ordre LIMIT 1");
  for (const [autre, nom] of [[cinq, cinq.nom.toUpperCase()], [note, note.nom.replace(' ', '  ')], [cinq, cinq.nom.normalize('NFD').replace(/\p{M}/gu, '')]]) {
    const victime = ligne('SELECT id FROM sort WHERE magie_id = ? AND id <> ? AND niveau < 5 AND remarque IS NULL ORDER BY ordre LIMIT 1', autre.magie_id, autre.id).id;
    const corps = ligne('SELECT corps_md FROM page WHERE id = ?', autre.magie_id).corps_md;
    const r = modifier('sort', { id: victime }, { nom });
    if (nom === autre.nom) continue; // sans accent à retirer : le même nom, refusé par la base (ci-dessus)
    assert.equal(r.statut, 409, `${nom} : ${JSON.stringify(r.corps)}`);
    assert.match(r.corps.erreur, new RegExp(`« ${autre.nom} »`));
    assert.equal(ligne('SELECT corps_md FROM page WHERE id = ?', autre.magie_id).corps_md, corps, 'rien n’est écrit');
  }
});

test('magie : présentation, caractéristique bonus (reconnue ou non), rôles, 4ème barre réservée au Sang et à la Nécromancie', () => {
  const feu = { id: 'magies/magie-du-feu' };
  assert.equal(modifier('magie', feu, { description: 'Nouvelle présentation.\n\nDeux paragraphes.', caracteristique_brut: 'FORCE' }).statut, 200);
  assert.deepEqual({ ...ligne('SELECT description, caracteristique_id FROM magie WHERE id = ?', feu.id) }, { description: 'Nouvelle présentation.\n\nDeux paragraphes.', caracteristique_id: 'force' });
  assert.equal(modifier('magie', feu, { caracteristique_brut: 'Au choix' }).statut, 200);
  assert.equal(ligne('SELECT caracteristique_id FROM magie WHERE id = ?', feu.id).caracteristique_id, null);
  assert.match(modifier('magie', feu, { barre4_texte: 'Une 4ème barre' }).corps.erreur, /n’en a pas/);
  assert.equal(modifier('magie', { id: 'magies/magie-du-sang' }, { barre4_texte: 'Elle possède un maximum de 12 Sang et la régénère de 2 par tour.' }).statut, 200);
  assert.deepEqual({ ...ligne("SELECT barre4_max, barre4_regen FROM magie WHERE id = 'magies/magie-du-sang'") }, { barre4_max: 12, barre4_regen: 2 });
  assert.equal(modifier('magie_role', { magie_id: feu.id, rang: 1 }, { role_brut: 'SOIN' }).statut, 200);
  assert.match(modifier('magie_role', { magie_id: feu.id, rang: 1 }, { role_brut: 'MAGIE' }).corps.erreur, /Rôle « MAGIE »/);
  assert.equal(modifier('magie_resistance', { magie_id: feu.id }, { cible_brut: 'x' }).statut, 400, 'relations entre magies : pas modifiables');
});

test('corps d’une page de magie qui n’a pas la forme de l’importeur : le lot est refusé (500), rien n’est écrit, plutôt qu’un corps en retard', () => {
  const vent = 'magies/magie-du-vent';
  const sort = ligne('SELECT id, cout_brut FROM sort WHERE magie_id = ? ORDER BY ordre LIMIT 1', vent);
  const corps = ligne('SELECT corps_md FROM page WHERE id = ?', vent).corps_md;
  db.prepare('UPDATE page SET corps_md = ? WHERE id = ?').run('Un corps écrit à la main, sans tableau des sorts.\n', vent);
  try {
    const r = modifier('sort', { id: sort.id }, { cout_brut: '99' });
    assert.equal(r.statut, 500, JSON.stringify(r.corps));
    assert.match(r.corps.erreur, /magies\/magie-du-vent : corps illisible/);
    assert.equal(ligne('SELECT cout_brut FROM sort WHERE id = ?', sort.id).cout_brut, sort.cout_brut, 'lot annulé');
  } finally {
    db.prepare('UPDATE page SET corps_md = ? WHERE id = ?').run(corps, vent);
  }
});
