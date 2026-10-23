// Les armes élémentaires de la page des armes (décision R167, migration 0081 ; lib/armes-db.mjs#chargerArmes) : listées dans le tableau de leur famille,
// les 14 de la famille, une par magie, sans Potentiel Illimité, aucune pour ARME DE MONSTRES ; leur type (dé, portée, compétences au choix), la gemme de
// leur magie ; le coût élémentaire tiré des mêmes lignes d'amélioration que le coût matériel, cumulé du 0 au +N (« Chaque cout est cumulatif passer du 0
// au 2 demande 1+2 = 3 gemmes communes ») ; la solidité de base. Tout est lu dans la base : le rendu (tech-front) n'y ajoute rien.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { QUALITES_DES_GEMMES, chargerArmes, coutsElementairesCumules } from '../src/lib/armes-db.mjs';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { historiqueSite } from '../src/lib/historique-site.mjs';

const db = ouvrirBase({ sansExemples: false });
const armes = chargerArmes(db);
const historique = historiqueSite(db);

test('R167 : chaque famille de la page a son type élémentaire et ses 14 armes élémentaires (une par magie, pas de Potentiel Illimité), dans l’ordre de l’onglet', () => {
  const magies = db.prepare("SELECT id FROM magie WHERE id <> 'magies/potentiel-illimite'").all().map((m) => m.id).sort();
  const types = new Map(db.prepare('SELECT id, type_elementaire_id FROM arme_famille').all().map((f) => [f.id, f.type_elementaire_id]));
  assert.ok(armes.familles.length > 0);
  for (const f of armes.familles) {
    assert.equal(f.type_elementaire?.id ?? null, types.get(f.id), `${f.id} : arme_famille.type_elementaire_id`);
    assert.ok(!('type_elementaire_id' in f), 'le type, pas son id seul');
    // une famille créée sur le site de dev (sans type élémentaire, décision R167) : aucune arme élémentaire
    if (!f.type_elementaire) {
      assert.deepEqual(f.armes_elementaires, [], `${f.id} : sans type élémentaire, aucune arme élémentaire`);
      continue;
    }
    assert.equal(f.armes_elementaires.length, 14, `${f.id} : 14 armes élémentaires`);
    assert.deepEqual(f.armes_elementaires.map((e) => e.magie_id).sort(), magies, `${f.id} : une par magie, sans Potentiel Illimité`);
    assert.ok(f.armes_elementaires.every((e) => e.type_id === f.type_elementaire.id), `${f.id} : toutes du type de la famille`);
    const ordre = db.prepare('SELECT id FROM arme_elementaire WHERE type_id = ? ORDER BY ordre').all(f.type_elementaire.id).map((r) => r.id);
    assert.deepEqual(f.armes_elementaires.map((e) => e.id), ordre, `${f.id} : l’ordre de arme_elementaire.ordre`);
  }
  // ARME DE MONSTRES n'est pas sur la page (R45) et n'a aucune arme élémentaire (type NULL)
  assert.ok(!armes.familles.some((f) => f.id === 'arme-de-monstres'));
  assert.equal(types.get('arme-de-monstres'), null);
});

test('R167 : une arme élémentaire porte sa magie, son bonus, sa capacité telle qu’écrite et la gemme de sa magie (table gemme) ; son type, le dé, la portée et les compétences de la base', () => {
  const gemmes = new Map(db.prepare('SELECT g.magie_id, g.ressource_id, r.nom FROM gemme g JOIN ressource r ON r.id = g.ressource_id').all().map((g) => [g.magie_id, { id: g.ressource_id, nom: g.nom }]));
  const lue = (id) => db.prepare('SELECT e.*, m.nom AS magie FROM arme_elementaire e JOIN magie m ON m.id = e.magie_id WHERE e.id = ?').get(id);
  for (const f of armes.familles.filter((x) => x.type_elementaire)) {
    for (const e of f.armes_elementaires) {
      const l = lue(e.id);
      assert.deepEqual(e, {
        id: l.id, nom: l.nom, type_id: l.type_id, magie_id: l.magie_id, magie: l.magie, bonus_degats: l.bonus_degats, capacite_nom: l.capacite_nom,
        capacite_mode: l.capacite_mode, capacite_texte: l.capacite_texte, remarque: l.remarque, gemme: gemmes.get(l.magie_id) ?? null,
      }, e.id);
      assert.ok(e.gemme, `${e.id} : la gemme de sa magie (« les gemmes sont celles de la magie »)`);
    }
    const t = db.prepare(`SELECT e.type_id AS id, t.nom, t.de, t.de_regle, t.portee_min, t.portee_max, e.ignore_ap, e.exemplaire_unique, e.mention, e.type_degats_au_choix
      FROM arme_elementaire_type e JOIN arme_type t ON t.id = e.type_id WHERE e.type_id = ?`).get(f.type_elementaire.id);
    const typesDegats = db.prepare('SELECT type_degats FROM arme_elementaire_type_degats WHERE type_id = ? ORDER BY type_degats').all(t.id).map((r) => r.type_degats);
    const competences = db.prepare(`SELECT c.competence_id FROM arme_elementaire_type_competence c JOIN competence k ON k.id = c.competence_id
      WHERE c.type_id = ? ORDER BY k.ordre`).all(t.id).map((r) => r.competence_id);
    assert.deepEqual(f.type_elementaire, { ...t, exemplaire_unique: t.exemplaire_unique === 1, competences, types_degats: typesDegats, type_degats_au_choix: t.type_degats_au_choix === 1 }, f.id);
    assert.ok(typesDegats.length > 0, `${f.id} : son type physique (R167)`);
  }
  // l'exemple de la décision : la gemme du Sang est le Grenat, celle du Feu le Rubis (table gemme, telle qu'importée)
  const nomDImport = (id) => historique.valeurDImport('ressource', { id }, 'nom');
  const famille = armes.familles.find((f) => f.id === 'arc');
  assert.equal(famille.armes_elementaires.find((e) => e.magie_id === 'magies/magie-du-sang').gemme.id, 'ressources/baton-magique#gemme:grenat');
  assert.equal(nomDImport('ressources/baton-magique#gemme:grenat'), 'Grenat');
  assert.equal(famille.armes_elementaires.find((e) => e.magie_id === 'magies/magie-du-feu').gemme.id, 'ressources/baton-magique#gemme:rubis');
});

test('R167 : un seul tableau d’amélioration pour les deux armes ; le coût élémentaire sort des mêmes lignes, cumulé du 0 au +N par qualité, jusqu’au total de l’onglet ; la solidité de base', () => {
  assert.deepEqual(armes.ameliorations.map((a) => a.niveau), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.ok(armes.ameliorations.every((a) => a.cible === 'arme' && a.cout_elementaire_brut), 'chaque niveau a son coût élémentaire');
  // le cumul, recalculé ici ligne à ligne
  assert.equal(armes.couts_elementaires.length, armes.ameliorations.length);
  for (const [i, c] of armes.couts_elementaires.entries()) {
    const faites = armes.ameliorations.slice(0, i + 1);
    const somme = (f) => faites.reduce((n, a) => n + f(a), 0);
    assert.deepEqual(c, {
      niveau: i + 1,
      gemmes: Object.fromEntries(QUALITES_DES_GEMMES.map((q) => [q, somme((a) => (a.cout_gemmes_qualite === q ? a.cout_gemmes : 0))])),
      pieces_elementaires: somme((a) => a.cout_pieces_elementaires ?? 0),
    }, `+${i + 1}`);
  }
  // l'exemple de la décision, sur les lignes telles qu'importées : « passer du 0 au 2 demande 1+2 = 3 gemmes communes »
  const importee = (n) => ({ niveau: n, ...Object.fromEntries(['cout_gemmes', 'cout_gemmes_qualite', 'cout_pieces_elementaires']
    .map((c) => [c, historique.valeurDImport('amelioration_equipement', { id: `ressources/armes#amelioration:arme:${n}` }, c)])) });
  assert.deepEqual(coutsElementairesCumules([importee(1), importee(2)])[1].gemmes, { commune: 3, raffinee: 0, parfaite: 0 });
  // le +10 cumule tout le tableau : le contrôle de la ligne TOTAL de l'onglet (amelioration_total « arme_elementaire », Pièces élémentaires › B80:F80)
  const total = db.prepare("SELECT total_brut FROM amelioration_total WHERE cible = 'arme_elementaire'").get().total_brut;
  const lu = (mot) => Number(new RegExp(`(\\d+)\\s+${mot}`).exec(total)?.[1] ?? 0);
  assert.deepEqual(armes.couts_elementaires.at(-1), { niveau: 10, gemmes: { commune: lu('communes'), raffinee: lu('raffinées'), parfaite: lu('parfaites') }, pieces_elementaires: lu('pièces? élémentaires?') });
  // la solidité de base d'une arme élémentaire (« 4 crans + les crans de la ligne d'amélioration choisie »)
  assert.equal(armes.solidite_elementaire, db.prepare("SELECT valeur FROM constante_equipement WHERE id = 'piece_elementaire.solidite_base'").get().valeur);
  // une liste dans le désordre se cumule dans l'ordre des niveaux ; une ligne sans gemme ni pièce n'ajoute rien
  assert.deepEqual(coutsElementairesCumules([{ niveau: 2, cout_gemmes: 2, cout_gemmes_qualite: 'raffinee' }, { niveau: 1, cout_gemmes: null, cout_gemmes_qualite: null }]),
    [{ niveau: 1, gemmes: { commune: 0, raffinee: 0, parfaite: 0 }, pieces_elementaires: 0 }, { niveau: 2, gemmes: { commune: 0, raffinee: 2, parfaite: 0 }, pieces_elementaires: 0 }]);
});
