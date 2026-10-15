// Règles de la page /fiche/ (lib/fiche-regles.mjs, publiées en /fiche/regles.json) : tout vient de la base, avec les couleurs et l'ordre des autres
// pages ; les dons à choix sont les groupes de v_capacite_exclusive (comme la page de chaque classe), les classes et spécialités magiques celles des
// décisions R6 et R7 (corrections de la fiche auto, docs/fiche-auto.md, point 4).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { couleurDeCaracteristique, couleurDePosture } from '../src/lib/caracteristiques-postures.mjs';
import { CLASS_COLORS } from '../src/lib/class-groups.mjs';
import { typeDeDon } from '../src/lib/classe-dons.mjs';
import { ditClasseMagique } from '../src/lib/classe-magique.mjs';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { chargerReglesDeFiche } from '../src/lib/fiche-regles.mjs';
import { historiqueSite } from '../src/lib/historique-site.mjs';
import { porteeDeLArme } from '../src/lib/arme-champs.mjs';
import { desSelonLaForce, pointsDeMaitriseDArme } from '../src/lib/maitrise-arme.mjs';
import { ORDRE_DES_RACES, RACE_COLORS } from '../src/lib/race-kinds.mjs';

const db = ouvrirBase({ sansExemples: false });
const regles = chargerReglesDeFiche(db);
const historique = historiqueSite(db); // ce que le site de dev a changé depuis l'import (lib/historique-site.mjs)
const compte = (table) => db.prepare(`SELECT count(*) AS n FROM ${table}`).get().n;

test('tout est sérialisable et chaque liste a toutes les lignes de sa table', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(regles)), regles);
  const tables = { races: 'race', ethnies: 'ethnie', magies: 'magie', dieux: 'dieu', metiers: 'metier', classes: 'classe', sorts: 'sort', niveaux: 'niveau_global',
    caracteristiques: 'caracteristique', competences: 'competence', armes: 'arme', familles_armes: 'arme_famille', armures: 'armure', boucliers: 'bouclier_classe',
    accessoires: 'accessoire_effet', ressources: 'ressource', ameliorations: 'amelioration_equipement', armes_elementaires: 'arme_elementaire',
    armures_elementaires: 'armure_elementaire', materiaux_armes: 'materiau_arme', materiaux_bouclier: 'materiau_bouclier', resistance_paliers: 'resistance_palier',
    etats: 'etat' };
  for (const [cle, table] of Object.entries(tables)) assert.equal(regles[cle].length, compte(table), cle);
  assert.equal(regles.emplacements_armure.length, compte('armure_emplacement') - 1, 'le bouclier a sa propre ligne sur la fiche');
  assert.equal(regles.am_classe_magique, 4);
  assert.equal(regles.constantes['caracteristique.bonus_magie_innee'], 1);
});

test('niveaux (décision R73) : bornes du dé bonus de chaque niveau et cumuls de v_niveau, les mêmes que la règle gains_niveau', () => {
  const v = new Map(db.prepare('SELECT * FROM v_niveau').all().map((r) => [r.niveau, r]));
  for (const n of regles.niveaux) {
    const g = db.prepare('SELECT de_attributs_min, de_attributs_max FROM niveau_global WHERE niveau = ?').get(n.niveau);
    assert.deepEqual([n.de_attributs_min, n.de_attributs_max], [g.de_attributs_min, g.de_attributs_max], `niveau ${n.niveau}`);
    for (const c of ['points_attributs_cumul', 'de_attributs_min_cumul', 'de_attributs_max_cumul']) assert.equal(n[c], v.get(n.niveau)[c], `niveau ${n.niveau} : ${c}`);
  }
  assert.deepEqual(regles.niveaux.filter((n) => n.de_attributs_bonus).map((n) => [n.niveau, n.de_attributs_min, n.de_attributs_max]), [[5, 1, 8], [10, 1, 8], [15, 1, 8], [20, 1, 8]]);
});

test('maîtrise d’arme : 1 dé sans maîtrise (guide, cité mot pour mot), 5 dés au plus (liste « 1d » à « 5d » de la fiche auto), soit 4 points', () => {
  assert.equal(regles.constantes['maitrise_arme.des_sans_maitrise'], 1);
  assert.equal(regles.constantes['maitrise_arme.des_max'], 5);
  const guide = db.prepare("SELECT texte, page_id FROM regle_constante WHERE id = 'maitrise_arme.des_sans_maitrise'").get();
  // citée dans le texte du guide tel que l'import l'a écrit (le site de dev peut le réécrire depuis)
  assert.ok(historique.valeurDImport('page', { id: guide.page_id }, 'corps_md').includes(guide.texte), guide.texte);
  assert.equal(db.prepare("SELECT texte FROM regle_constante WHERE id = 'maitrise_arme.des_max'").get().texte, '1d, 2d, 3d, 4d, 5d');
  assert.match(db.prepare("SELECT sql FROM sqlite_master WHERE name = 'personnage_maitrise_arme'").get().sql, /CHECK \(des BETWEEN 1 AND 5\)/,
    'la base garde des dés, de 1 à 5');
});

test('maîtrises d’armes (décision R32) : celles de chaque classe (classe_maitrise_arme), les points des dons, le dé du Pugilat selon la Force ; seuil d’alignement', () => {
  const parClasse = new Map();
  for (const r of db.prepare('SELECT classe_id, brut, nombre FROM classe_maitrise_arme WHERE nombre IS NOT NULL ORDER BY classe_id, rang').all()) {
    parClasse.set(r.classe_id, [...(parClasse.get(r.classe_id) ?? []), { brut: r.brut, nombre: r.nombre }]);
  }
  for (const c of regles.classes) assert.deepEqual(c.maitrises, parClasse.get(c.id) ?? [], c.id);
  const capacites = new Map(db.prepare('SELECT id, classe_id, effet FROM capacite').all().map((r) => [r.id, r]));
  assert.equal(regles.classes.reduce((n, c) => n + c.dons.length, 0), capacites.size, 'chaque don, une fois');
  for (const c of regles.classes) {
    for (const d of c.dons) {
      assert.equal(capacites.get(d.id).classe_id, c.id, `${d.id} : un don de ${c.id}`);
      assert.equal(d.points_maitrise, pointsDeMaitriseDArme(capacites.get(d.id).effet), d.id);
    }
  }
  assert.ok(regles.classes.some((c) => c.dons.some((d) => d.points_maitrise)), 'des dons donnent des points de maîtrise');
  const notes = new Map(db.prepare('SELECT id, note_brut FROM arme_famille').all().map((r) => [r.id, r.note_brut]));
  for (const f of regles.familles_armes) assert.deepEqual(f.de_selon_force, desSelonLaForce(notes.get(f.id)), `${f.id} : les paliers de sa note`);
  assert.equal(regles.constantes['alignement.ecart_axe'], 5);
});

test('caractéristiques : l’ordre de la fiche et leur couleur (demande du propriétaire), que leurs compétences reprennent ; texte foncé sur ces couleurs claires', () => {
  assert.deepEqual(regles.caracteristiques.map((c) => c.nom), ['Force', 'Volonté', 'Intelligence', 'Perception', 'Social', 'Agilité']);
  for (const c of regles.caracteristiques) assert.deepEqual([c.couleur, c.texte], [couleurDeCaracteristique(c.id), '#171210'], c.id);
  assert.ok(regles.competences.every((k) => regles.caracteristiques.some((c) => c.id === k.caracteristique_id)), 'chaque compétence trouve la couleur de sa caractéristique');
});

test('races : l’ordre et les couleurs de /races/, valeurs de l’onglet de la race (R13), bornes des six caractéristiques', () => {
  // les races de la liste du propriétaire dans son ordre, puis celles créées depuis le site, par nom (lib/race-kinds.mjs#dansLOrdreDesRaces)
  assert.deepEqual(regles.races.slice(0, ORDRE_DES_RACES.length).map((r) => r.id), ORDRE_DES_RACES);
  const autres = regles.races.slice(ORDRE_DES_RACES.length).map((r) => r.nom);
  assert.deepEqual(autres, [...autres].sort((a, b) => a.localeCompare(b, 'fr')));
  for (const r of regles.races) {
    assert.equal(r.couleur, RACE_COLORS[r.nature], r.id);
    assert.equal(Object.keys(r.bornes).length, 6, r.id);
    const onglet = db.prepare('SELECT sante_depart, chakra_depart FROM race_onglet WHERE race_id = ?').get(r.id);
    assert.deepEqual([r.sante, r.chakra], [onglet.sante_depart, onglet.chakra_depart], r.id);
    for (const c of r.classes) assert.ok(regles.classes.some((x) => x.id === c), `${r.id} : ${c}`);
    for (const m of r.magies) assert.ok(regles.magies.some((x) => x.id === m), `${r.id} : ${m}`);
  }
  assert.equal(regles.races.find((r) => r.id === 'races/drassahthac').nature, 'hybride', 'décision R14');
  assert.equal(regles.races.find((r) => r.id === 'races/orios').nature, 'hybride');
  assert.equal(regles.races.find((r) => r.id === 'races/humain').nature, 'pure');
});

test('classes : couleurs de /classes/ ; magiques = catégorie Magique et Archimage (R6) ; spécialités magiques = 13 classes raciales et le Flagelleur (R7) ; Archimage du Potentiel Illimité (R23)', () => {
  assert.ok(regles.classes.every((c) => Object.values(CLASS_COLORS).includes(c.couleur)));
  assert.equal(regles.classes.find((c) => c.id === 'classes/parleur').couleur, CLASS_COLORS.speciales, 'Parleur sous « Spéciales »');
  assert.deepEqual(regles.classes.find((c) => c.id === 'classes/parleur').groupe, { key: 'speciales', label: 'Spéciales', ordre: 4 });
  assert.deepEqual([...new Set([...regles.classes].sort((a, b) => a.groupe.ordre - b.groupe.ordre).map((c) => c.groupe.label))], ['Physiques Mêlée', 'Physiques Distance', 'Magiques', 'Raciales', 'Spéciales']);
  assert.deepEqual([...new Set(regles.classes.map((c) => c.groupe.key))].sort(), Object.keys(CLASS_COLORS).sort(), 'les cinq colonnes de /classes/');
  for (const c of regles.classes) assert.equal(c.couleur, CLASS_COLORS[c.groupe.key], c.id);
  // R6 : magiques = catégorie Magique (la seule qui donne de l'AM) et Archimage ; à l'import, ces neuf classes
  assert.deepEqual(db.prepare('SELECT id FROM categorie_classe WHERE am_base > 0').all().map((k) => k.id), ['classe-magique']);
  const magiquesR6 = (classes) => classes.filter((c) => c.categorie_id === 'classe-magique' || c.id === 'classes/archimage').map((c) => c.nom).sort();
  assert.deepEqual(regles.classes.filter((c) => c.magique).map((c) => c.nom).sort(), magiquesR6(db.prepare('SELECT id, nom, categorie_id FROM classe').all()));
  assert.deepEqual(magiquesR6(historique.lignesDImport('classe')),
    ['Archimage', 'Barde', 'Clerc', 'Maclier', 'Mage', 'Mage Bleu', 'Mage Rouge', 'Mage Vert', 'Ocultomancien']);
  // R7 : une spécialité est magique quand le don de son cartouche le dit ; à l'import, 14 spécialités : celles des 13 classes raciales et du Flagelleur
  const cartouche = db.prepare("SELECT effet FROM capacite WHERE specialite_id = ? AND nature = 'specialite'");
  for (const c of regles.classes) for (const s of c.specialites) assert.equal(s.magique, ditClasseMagique(cartouche.get(s.id)?.effet), s.id);
  const classesDImport = new Map(historique.lignesDImport('classe').map((c) => [c.id, c]));
  const cartouchesMagiques = historique.lignesDImport('capacite').filter((k) => k.nature === 'specialite' && ditClasseMagique(k.effet));
  assert.equal(cartouchesMagiques.length, 14);
  assert.deepEqual(cartouchesMagiques.map((k) => classesDImport.get(k.classe_id)).filter((c) => c.categorie_id !== 'classe-hybride-animal').map((c) => c.id),
    ['classes/flagelleur']);
  // Classe réservée à une magie innée, qui l'impose (classe.magie_innee_id, décision R23) : l'Archimage et le Potentiel Illimité, seulement
  assert.deepEqual(regles.classes.filter((c) => c.magie_innee_id !== null).map((c) => [c.id, c.magie_innee_id]), [['classes/archimage', 'magies/potentiel-illimite']]);
  // et celle qu'une magie innée ferme (classe.magie_innee_exclue_id, décision R25) : le Mage Bleu et le Potentiel Illimité, seulement
  assert.deepEqual(regles.classes.filter((c) => c.magie_innee_exclue_id !== null).map((c) => [c.id, c.magie_innee_exclue_id]), [['classes/mage-bleu', 'magies/potentiel-illimite']]);
});

test('dons à choix : chaque don « choix » qui a une alternative est dans un seul groupe de sa classe, avec toutes ses alternatives', () => {
  const alternatives = new Map();
  for (const r of db.prepare('SELECT capacite_id, autre_id FROM v_capacite_exclusive').all()) {
    if (!alternatives.has(r.capacite_id)) alternatives.set(r.capacite_id, new Set());
    alternatives.get(r.capacite_id).add(r.autre_id);
  }
  const vus = new Map();
  for (const c of regles.classes) {
    for (const g of c.choix) {
      assert.ok(g.options.length >= 2);
      const ids = new Set(g.options.map((o) => o.id));
      for (const o of g.options) {
        assert.ok(!vus.has(o.id), `${o.id} dans deux groupes`);
        vus.set(o.id, c.id);
        const ligne = db.prepare('SELECT classe_id, specialite_id, nature FROM capacite WHERE id = ?').get(o.id);
        assert.deepEqual([ligne.classe_id, ligne.specialite_id, ligne.nature], [c.id, g.specialite_id, 'choix'], o.id);
        for (const a of alternatives.get(o.id) ?? []) assert.ok(ids.has(a), `${o.id} : alternative ${a} hors du groupe`);
      }
    }
  }
  const choixAvecAlternative = db.prepare("SELECT count(*) AS n FROM capacite c WHERE nature = 'choix' AND EXISTS (SELECT 1 FROM v_capacite_exclusive x WHERE x.capacite_id = c.id)").get().n;
  assert.equal(vus.size, choixAvecAlternative);
});

test('dons de classe : la précision de la cellule de type (limite d’usage « N fois/période »…), telle qu’écrite, comme la page de la classe', () => {
  const dons = new Map(regles.classes.flatMap((c) => c.dons.map((d) => [d.id, d])));
  const lignes = db.prepare('SELECT id, type_brut, limite_nombre, limite_periode FROM capacite').all();
  assert.ok(lignes.some((k) => k.limite_nombre !== null), 'des dons ont un nombre d’usages limité');
  for (const k of lignes) {
    const d = dons.get(k.id);
    assert.equal(d.precision, typeDeDon(k.type_brut).precision, k.id);
    if (k.limite_nombre !== null) {
      assert.ok(d.precision?.includes(String(k.limite_nombre)), `${k.id} : ${d.precision}`);
      assert.ok(d.precision.toLowerCase().includes(k.limite_periode), `${k.id} : ${d.precision}`);
    }
  }
});

test('magies : couleur des pages de magie, mono-magie (R15) et ses exceptions (R20), caractéristique au choix du Potentiel Illimité', () => {
  const pi = regles.magies.find((m) => m.id === 'magies/potentiel-illimite');
  assert.equal(pi.mono_magie, true);
  assert.equal(pi.caracteristique_id, null);
  assert.match(pi.caracteristique_brut, /AU CHOIX/);
  assert.equal(pi.couleur, '#ff9900');
  assert.deepEqual(regles.magies.find((m) => m.id === 'magies/magie-de-la-corruption').ethnies_secondaires.sort(),
    ['races/elfe-noir#ethnie:elfe-noir-charbon', 'races/felfe#ethnie:felfe-noir']);
  assert.ok(regles.magies.every((m) => /^#[0-9a-f]{6}$/i.test(m.couleur) && m.dieux.length >= 1), 'chaque magie a son dieu inné');
});

test('métiers (décisions R33 à R35) : bonus par rang avec leur compétence ou l’initiative, artisanat et ses deux caractéristiques, objets de départ par rang', () => {
  const compter = (sql) => db.prepare(sql).get().n;
  assert.equal(regles.metiers.reduce((t, m) => t + m.bonus.reduce((u, b) => u + b.options.length, 0), 0), compte('metier_bonus'), 'chaque option de metier_bonus');
  assert.equal(regles.metiers.reduce((t, m) => t + m.objets.reduce((u, o) => u + o.options.length, 0), 0), compte('metier_objet_depart'), 'chaque objet de départ');
  assert.equal(regles.metiers.filter((m) => m.artisanat).length, compter('SELECT count(*) AS n FROM metier WHERE artisanat_texte IS NOT NULL'));
  const competences = new Set(regles.competences.map((c) => c.id));
  for (const m of regles.metiers) {
    for (const b of m.bonus) for (const o of b.options) assert.ok(!o.competence_id || competences.has(o.competence_id), `${m.id} : ${o.competence_id}`);
    if (m.artisanat?.caracteristiques.length) assert.ok(m.artisanat.caracteristiques.every((c) => regles.caracteristiques.some((k) => k.id === c)), m.id);
  }
  assert.ok(regles.metiers.some((m) => m.bonus.some((b) => b.options.some((o) => o.attribut === 'initiative'))), '« +X INI » vers l’initiative');
});

test('postures (sélecteur de la page, demande du propriétaire) : les six de la base dans leur ordre, leur couleur, leurs effets du tableau de la fiche', () => {
  assert.deepEqual(regles.postures.map((p) => p.id), db.prepare('SELECT id FROM posture ORDER BY ordre').all().map((r) => r.id));
  for (const p of regles.postures) {
    assert.equal(p.couleur, couleurDePosture(p.id));
    assert.deepEqual(p.effets, db.prepare("SELECT texte FROM posture_effet WHERE posture_id = ? AND version = 'fiche' ORDER BY rang").all(p.id).map((r) => r.texte));
  }
  assert.match(db.prepare("SELECT sql FROM sqlite_master WHERE name = 'personnage'").get().sql, /posture_id\s+TEXT\s+REFERENCES posture\(id\)/, 'la fiche garde sa posture (migration 0027)');
});

test('sorts : type, coût, portée, zone, D/S/B, effets et remarque tels qu’écrits, leurs modes (IC…), avec leurs expressions de NM de ces colonnes et du type (sort_bonus_maitrise)', () => {
  const ligne = (id) => db.prepare('SELECT type_brut, cout_brut, portee_brut, zone_brut, dsb_brut, effets, remarque FROM sort WHERE id = ?').get(id);
  for (const s of regles.sorts) {
    const l = ligne(s.id);
    assert.deepEqual([s.type, s.cout, s.portee, s.zone, s.dsb, s.effets, s.remarque], [l.type_brut, l.cout_brut, l.portee_brut, l.zone_brut, l.dsb_brut, l.effets, l.remarque], s.id);
    const attendus = db.prepare("SELECT champ, texte_brut FROM sort_bonus_maitrise WHERE sort_id = ? AND champ IN ('type', 'cout', 'portee', 'zone', 'dsb', 'effets') ORDER BY champ, rang").all(s.id);
    assert.deepEqual(s.bonus.map((b) => [b.champ, b.texteBrut]), attendus.map((b) => [b.champ, b.texte_brut]), s.id);
    assert.deepEqual(s.modes.map((m) => m.libelle), db.prepare('SELECT libelle FROM sort_mode WHERE sort_id = ? ORDER BY rang').all(s.id).map((m) => m.libelle), s.id);
  }
  assert.ok(regles.sorts.some((s) => s.modes.some((m) => m.mode === 'ic')) && regles.sorts.some((s) => s.bonus.some((b) => b.champ === 'type')));
});

// Ce que la fiche en tableur écrit en plus de la page (lib/fiche-tableur-export.mjs) : le type d'un sort (colonne « Type » de la liste de sorts, au NM du
// sort), l'effet et la portée d'une arme (sous son nom), le nom de la propriété d'un accessoire (« Attributs : +25 Santé »). Tels que la base les écrit :
// l'état courant contre les tables, les exemples par leur valeur d'import (le site de dev peut réécrire sorts et armes : lib/historique-site.mjs).
test('fiche en tableur : type d’un sort, effet et portée d’une arme, nom de la propriété d’un accessoire, tels que la base les écrit', () => {
  // sorts : sort.type_brut tel quel (saut de ligne compris), qui porte les expressions de NM du type (valeurAuNm(type, bonus, 'type', nm) les y trouve)
  const types = new Map(db.prepare('SELECT id, type_brut FROM sort').all().map((r) => [r.id, r.type_brut]));
  for (const s of regles.sorts) {
    assert.equal(s.type, types.get(s.id), s.id);
    for (const b of s.bonus.filter((x) => x.champ === 'type')) assert.ok(s.type.includes(b.texteBrut), `${s.id} : « ${b.texteBrut} » dans « ${s.type} »`);
  }
  const typeDImport = (id) => historique.valeurDImport('sort', { id }, 'type_brut');
  assert.equal(typeDImport('magies/magie-de-la-corruption#sort:aiguisage-magique'), 'Amplification (IC pour 3 NM)');
  assert.equal(typeDImport('magies/magie-de-la-foudre#sort:affutage'), 'Amplification\n(IC)');

  // armes : arme.effet tel quel ; la portée de la page « Armes » (décision R50 : la portée écrite, portee_min / portee_max, « N » ou « N - M » ; 1 par défaut,
  // lib/arme-champs.mjs#porteeDeLArme) ; rien d'autre de déduit (ni la portée du type)
  const armes = new Map(db.prepare('SELECT id, effet, portee_min, portee_max FROM arme').all().map((r) => [r.id, r]));
  for (const a of regles.armes) {
    const l = armes.get(a.id);
    assert.equal(a.effet, l.effet, a.id);
    assert.ok(!('portee_min' in a) && !('portee_max' in a), `${a.id} : la portée seulement`);
    assert.equal(a.portee, porteeDeLArme(l).replace('-', ' - '), a.id);
    if (l.portee_min === null) {
      assert.equal(a.portee, '1', `${a.id} : 1 par défaut (R50)`);
      continue;
    }
    const m = /^(\d+)(?: - (\d+))?$/.exec(a.portee);
    assert.ok(m, `${a.id} : « ${a.portee} »`);
    assert.deepEqual([Number(m[1]), Number(m[2] ?? m[1])], [l.portee_min, l.portee_max], a.id);
    assert.equal(m[2] === undefined, l.portee_min === l.portee_max, `${a.id} : « N » pour une portée d’une seule valeur`);
  }
  assert.ok(regles.armes.some((a) => a.portee.includes(' - ')) && regles.armes.some((a) => a.portee !== '1' && !a.portee.includes(' - ')));
  assert.ok([...armes.values()].some((l) => l.portee_min === null), 'des armes sans portée écrite : 1 par défaut');
  // armures élémentaires : leur magie (armure_elementaire.magie_id), par laquelle l'import d'une fiche auto les retrouve
  const magiesDesArmures = new Map(db.prepare('SELECT id, magie_id FROM armure_elementaire').all().map((r) => [r.id, r.magie_id]));
  for (const x of regles.armures_elementaires) assert.equal(x.magie_id, magiesDesArmures.get(x.id), x.id);
  assert.ok(regles.armures_elementaires.every((x) => regles.magies.some((m) => m.id === x.magie_id)), 'chaque armure élémentaire a sa magie');
  const armeDImport = (id) => ['effet', 'portee_min', 'portee_max'].map((c) => historique.valeurDImport('arme', { id }, c));
  const [effetBras, ...porteeBras] = armeDImport('ressources/armes#arme:arbalete:arbalete-a-bras');
  assert.match(effetBras, /1 - 7 portée/);
  assert.deepEqual(porteeBras, [1, 7], 'Arbalète à bras : « 1 - 7 »');
  assert.deepEqual(armeDImport('ressources/armes#arme:hache:hache-darmes-a-pointe').slice(1), [2, 2], 'Hache d’armes à pointe : « portée 2 » (migration 0034), « 2 »');
  assert.deepEqual(armeDImport('ressources/armes#arme:epees:espadon').slice(1), [null, null], 'Espadon : pas de portée écrite');
  assert.deepEqual(armeDImport('ressources/armes#arme:arme-de-monstres:aiguille-de-vitrail'), [null, null, null], 'une arme de monstre n’a pas d’effet');

  // accessoires (non modifiables sur le site de dev) : accessoire_propriete.nom de l'effet
  const proprietes = new Map(db.prepare('SELECT e.id, p.nom FROM accessoire_effet e JOIN accessoire_propriete p ON p.id = e.propriete_id').all().map((r) => [r.id, r.nom]));
  for (const a of regles.accessoires) assert.equal(a.propriete_nom, proprietes.get(a.id), a.id);
  const sante = regles.accessoires.find((a) => a.id === 'ressources/accessoires#effet:attributs:1');
  assert.deepEqual([sante.libelle, sante.propriete, sante.propriete_nom], ['+25 Santé', 'attributs', 'Attributs']);
  assert.deepEqual([...new Set(regles.accessoires.map((a) => a.propriete_nom))].sort((a, b) => a.localeCompare(b, 'fr')),
    ['Attaque', 'Attributs', 'Autre', 'Caractéristique', 'Compétence', 'Défense', 'Jet de dé']);
});

test('résistances (tableau « Résistance / Faiblesse » de la fiche) : les six paliers, les listes de chaque magie et l’altération qui lui est liée, ce que les dons écrivent', () => {
  assert.deepEqual(regles.resistance_paliers.map((p) => p.id), db.prepare('SELECT id FROM resistance_palier ORDER BY ordre').all().map((r) => r.id));
  // décision R70 : ÷2, ÷4, x2, x4, x8, ceux de la fiche auto (le modèle ordinateur écrit ÷3, x3 et x4 : « C'est bien 2 4 8 »)
  assert.deepEqual(regles.resistance_paliers.map((p) => p.effet),
    ['dégâts subis =0', 'dégâts subis ÷4', 'dégâts subis ÷2', 'dégâts subis x2', 'dégâts subis x4', 'dégâts subis x8']);
  assert.deepEqual(regles.etats.map((e) => e.id), db.prepare('SELECT id FROM etat ORDER BY ordre').all().map((r) => r.id));
  assert.equal(regles.magies.reduce((n, m) => n + m.resistances.length, 0), compte('magie_resistance'));
  for (const m of regles.magies) {
    for (const r of m.resistances) assert.ok([1, -1].includes(r.crans) && (r.type === 'magie' ? regles.magies : regles.etats).some((x) => x.id === r.id), `${m.nom} : ${r.id}`);
    const lie = db.prepare('SELECT etat_id FROM etat_magie WHERE magie_id = ?').get(m.id)?.etat_id ?? null;
    assert.equal(m.etat_id, lie, m.nom);
  }
  // un don qui n'écrit rien de tel n'a pas de champ (regles.json reste léger)
  const dons = [...regles.races.flatMap((r) => r.dons), ...regles.classes.flatMap((c) => c.dons)];
  assert.ok(dons.some((d) => d.resistances?.effets.length) && dons.some((d) => d.resistances?.choix));
  for (const d of dons.filter((x) => x.resistances)) assert.ok(d.resistances.effets.length || d.resistances.choix);
  assert.ok(regles.races.find((r) => r.id === 'races/drakos').dons_tableau.lignes.every((l) => l.resistances), 'chaque ligne du Drakos : son cran, ou au choix');
});
