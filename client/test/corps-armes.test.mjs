// Corps de la page « Armes » (lib/corps-armes.mjs) : chaque arme, matériau et amélioration de la base retrouve sa ligne Markdown dans la section de son
// tableau, la liste des armes de départ se refait à l'identique, et remplacer une ligne par elle-même redonne le corps à l'octet près (invariants
// rejoués sur toute la base : ils tiennent après une modification depuis le site, que le service et le rejeu du journal suivent avec ces fonctions).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { corpsAvecArmesDeDepart, corpsDesArmesApres, ErreurCorpsArmes, ligneDArme, ligneDuTotal, PAGE_DES_ARMES } from '../src/lib/corps-armes.mjs';

const db = ouvrirBase({ sansExemples: false });
const corps = db.prepare('SELECT corps_md FROM page WHERE id = ?').get(PAGE_DES_ARMES).corps_md;
const familles = db.prepare('SELECT id, nom FROM arme_famille ORDER BY ordre').all();
const armes = db.prepare('SELECT * FROM arme ORDER BY famille_id, ordre').all();
const nomDuMateriau = (id) => db.prepare('SELECT nom FROM ressource WHERE id = ?').get(id).nom;
const contexte = { familles, armes: () => armes, nomDuMateriau };

test('chaque ligne des tables de la page se retrouve dans le corps : la remplacer par elle-même ne change rien', () => {
  for (const a of armes) assert.equal(corpsDesArmesApres(corps, 'arme', a, a, contexte), corps, a.id);
  for (const m of db.prepare('SELECT * FROM materiau_arme').all()) assert.equal(corpsDesArmesApres(corps, 'materiau_arme', m, m, contexte), corps, m.ressource_id);
  for (const a of db.prepare("SELECT * FROM amelioration_equipement WHERE cible = 'arme'").all()) assert.equal(corpsDesArmesApres(corps, 'amelioration_equipement', a, a, contexte), corps, a.id);
  const total = db.prepare("SELECT * FROM amelioration_total WHERE cible = 'arme'").get();
  assert.ok(corps.includes(ligneDuTotal(total.total_brut)));
  assert.equal(corpsDesArmesApres(corps, 'amelioration_total', total, total, contexte), corps);
});

test('la liste des armes de départ (nom sur fond bleu dans la source) se refait à l’identique depuis arme.depart_possible', () => {
  assert.equal(corpsAvecArmesDeDepart(corps, familles, armes), corps);
});

test('une arme modifiée : sa ligne change dans la section de SA famille seulement ; devenue arme de départ, elle entre dans la liste', () => {
  const crochets = armes.filter((a) => a.nom === 'Crochet grappin');
  if (crochets.length === 2 && ligneDArme(crochets[0]) === ligneDArme(crochets[1])) {
    const apres = { ...crochets[0], description: 'Texte neuf.' };
    const nouveau = corpsDesArmesApres(corps, 'arme', crochets[0], apres, contexte);
    assert.equal(nouveau.split('\n').filter((l) => l === ligneDArme(apres)).length, 1, 'une seule des deux lignes identiques change');
  }
  const a = armes.find((x) => x.depart_possible === 0 && x.famille_id !== 'arme-de-monstres');
  const apres = { ...a, depart_possible: 1 };
  const nouveau = corpsDesArmesApres(corps, 'arme', a, apres, { ...contexte, armes: () => armes.map((x) => (x.id === a.id ? apres : x)) });
  const puce = nouveau.split('\n').find((l) => l.startsWith('- Sous « ') && l.includes(a.nom));
  assert.ok(puce, `${a.nom} dans la liste des armes de départ`);
});

test('une ligne qui n’est plus dans le corps : ErreurCorpsArmes (le service refuse le lot plutôt que de laisser le corps en retard)', () => {
  const a = { ...armes[0], effet: 'Effet que le corps ne connaît pas' };
  assert.throws(() => corpsDesArmesApres(corps, 'arme', a, armes[0], contexte), ErreurCorpsArmes);
});
