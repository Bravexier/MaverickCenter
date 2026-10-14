// Notes de version (page /mise-a-jour/) : la liste production → dev (lib/notes-de-version.mjs#comparerBases) sur des bases synthétiques, la
// version de la prochaine livraison (même règle que le bot : tools/flux-git/regles.mjs#planifier) et l'affichage (lib/notes-de-version-rendu.mjs :
// tout texte échappé, champ libre réduit à un Markdown simple, marqueur [V: X+1] jamais repris). Le sens (couleur) a son propre fichier :
// notes-de-version-sens.test.mjs.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { planifier } from '../../tools/flux-git/regles.mjs';
import { bilan, comparerBases, DOMAINES, TABLES_DES_NOTES, trierVersions, versionCourte, versionDeLivraison } from '../src/lib/notes-de-version.mjs';
import {
  diffMots, echapper, htmlDeLaListe, htmlDeLaNote, htmlDuTexteLibre, lancementAffiche, markdownDeLaNote, neutraliserMarqueur,
} from '../src/lib/notes-de-version-rendu.mjs';

const magies = [
  { id: 'magies/feu', nom: 'Feu', ordre: 1, description: 'Brûle.' },
  { id: 'magies/ombre', nom: 'Ombre', ordre: 2, description: 'Obscurcit.' },
];
const sort = (id, magie, nom, valeurs = {}) => ({
  id, magie_id: magie, nom, niveau: 1, ordre: 1, type_brut: 'Attaque', cout_brut: '6', portee_brut: '6', zone_brut: null, dsb_brut: '2D6',
  effets: null, remarque: null, texte_niveau5: null, ...valeurs,
});
const race = (id, nom, valeurs = {}) => ({ id, nom, ordre: 1, presentation: null, ...valeurs });

function bases() {
  const ref = {
    tables: {
      magie: magies,
      sort: [
        sort('sorts/flash', 'magies/feu', 'Flash'),
        sort('sorts/javelot', 'magies/ombre', 'Javelot sombre', { dsb_brut: '7D6 + 15 dégâts' }),
        sort('sorts/vieux', 'magies/ombre', 'Vieux sort'),
      ],
      race: [race('races/humain', 'Humain'), race('races/elfe', 'Elfe')],
      race_magie: [{ race_id: 'races/humain', magie_id: 'magies/feu', accessible: 1 }],
      metier: [{ id: 'metiers/forgeron', nom: 'Forgeron', description: 'Forge.', bonus_brut: '+3% Arme lourde' }],
      peuple: [{ id: 'peuples/humain', nom: 'Humains', race_id: 'races/humain', ordre: 1 }, { id: 'peuples/elfe', nom: 'Elfes', race_id: 'races/elfe', ordre: 2 }],
      echelle_relation: [{ id: 'neutre', libelle: 'Neutre' }, { id: 'haine', libelle: 'Haine' }],
      relation_peuple: [{ ligne_peuple_id: 'peuples/humain', colonne_peuple_id: 'peuples/elfe', echelle_id: 'neutre' }],
      page: [
        { id: 'guide/combat', type: 'guide', statut: 'canon', titre: 'Combat', corps_md: 'Un tour dure six secondes.', donnees: '{"chapitre":3}' },
        { id: 'guide/exemple', type: 'guide', statut: 'example', titre: 'Exemple', corps_md: 'a', donnees: null },
        { id: 'races/humain', type: 'races', statut: 'canon', titre: 'Humain', corps_md: 'a', donnees: null },
      ],
    },
  };
  const dev = structuredClone(ref);
  const t = dev.tables;
  t.sort[0] = { ...t.sort[0], cout_brut: '4', portee_brut: '8' };
  t.sort[1] = { ...t.sort[1], dsb_brut: '6D6 + 20 dégâts', effets: 'Inflige brûlure.' };
  t.sort.splice(2, 1); // « Vieux sort » retiré
  t.sort.push(sort('sorts/neuf', 'magies/feu', 'Étincelle', { niveau: 2 }));
  t.race_magie.push({ race_id: 'races/humain', magie_id: 'magies/ombre', accessible: 1 });
  t.race[1] = { ...t.race[1], presentation: 'Peuple des forêts.' };
  t.metier[0] = { ...t.metier[0], bonus_brut: '+4% Arme lourde' };
  t.metier.push({ id: 'metiers/alchimiste', nom: 'Alchimiste', description: null, bonus_brut: null });
  t.relation_peuple[0] = { ...t.relation_peuple[0], echelle_id: 'haine' };
  t.page[0] = { ...t.page[0], corps_md: 'Un tour dure cinq secondes.' };
  t.page[1] = { ...t.page[1], corps_md: 'b' }; // page d'exemple : jamais listée
  t.page[2] = { ...t.page[2], corps_md: 'b' }; // page hors guide : sa race est listée par ses tables, pas par sa page
  return { ref, dev };
}

test('comparerBases : un champ par ligne, entités ajoutées et retirées, domaines dans l’ordre de la page', () => {
  const { ref, dev } = bases();
  const lignes = comparerBases(ref, dev);
  const cle = (l) => `${l.domaine} | ${l.groupe ?? ''} | ${l.entite} | ${l.champ ?? '(entité)'} | ${l.nature}`;
  assert.deepEqual(lignes.map(cle), [
    'sorts | Feu | Flash | Coût | modifie',
    'sorts | Feu | Flash | Portée | modifie',
    'sorts | Feu | Étincelle | (entité) | ajoute',
    'sorts | Ombre | Javelot sombre | D/S/B | modifie',
    'sorts | Ombre | Javelot sombre | Effets secondaires | ajoute',
    'sorts | Ombre | Vieux sort | (entité) | retire',
    'races | Humain | Humain | Magies innées | modifie',
    'races | Humain | Humains voit Elfes | Relation | modifie',
    'races | Elfe | Elfe | Présentation | ajoute',
    'metiers |  | Alchimiste | (entité) | ajoute',
    'metiers |  | Forgeron | Bonus | modifie',
    'guide | Chapitre 3 | Combat | Texte | modifie',
  ]);
  assert.deepEqual(lignes.map((l) => l.rang), lignes.map((_, i) => i + 1));
  const flash = lignes.filter((l) => l.entite === 'Flash');
  assert.deepEqual(flash.map((l) => [l.avant, l.apres, l.sens]), [['6', '4', 'amelioration'], ['6', '8', 'amelioration']]);
  assert.deepEqual(flash[0].cle, { id: 'sorts/flash' });
  assert.equal(flash[0].table_nom, 'sort');
  assert.equal(flash[0].colonne, 'cout_brut');
  const javelot = lignes.find((l) => l.entite === 'Javelot sombre');
  assert.equal(javelot.sens, 'amelioration', '7D6 + 15 (moyenne 39,5) → 6D6 + 20 (moyenne 41)');
  const effet = lignes.find((l) => l.champ === 'Effets secondaires');
  assert.deepEqual([effet.avant, effet.apres, effet.sens], [null, 'Inflige brûlure.', 'amelioration'], 'effet secondaire ajouté (R29)');
  const magiesInnees = lignes.find((l) => l.champ === 'Magies innées');
  assert.deepEqual([magiesInnees.avant, magiesInnees.apres, magiesInnees.sens], ['Feu', 'Feu, Ombre', 'neutre']);
  const relation = lignes.find((l) => l.champ === 'Relation');
  assert.deepEqual([relation.avant, relation.apres], ['Neutre', 'Haine']);
  assert.deepEqual(relation.cle, { colonne_peuple_id: 'peuples/elfe', ligne_peuple_id: 'peuples/humain' }, 'clé aux noms triés');
  const ajoute = lignes.find((l) => l.entite === 'Étincelle');
  assert.deepEqual([ajoute.avant, ajoute.apres, ajoute.sens], [null, 'Étincelle', 'neutre']);
  const b = bilan(lignes);
  assert.equal(b.total, lignes.length);
  assert.equal(b.amelioration + b.affaiblissement + b.neutre, b.total);
  assert.deepEqual(b.parDomaine, { sorts: 6, races: 3, metiers: 2, guide: 1 });
  assert.deepEqual(DOMAINES.map((d) => d.id), ['sorts', 'magies', 'classes', 'races', 'metiers', 'guide', 'codex', 'bestiaire', 'armes', 'composants']);
});

test('armes (migration 0034) : une arme sous sa famille, un matériau, une amélioration d’arme ; « Oui/Non », mains et type en toutes lettres', () => {
  const famille = { id: 'epees', nom: 'ÉPÉES', ordre: 1 };
  const types = [{ id: 'epee', nom: 'Épée' }, { id: 'dague', nom: 'Dague' }];
  const arme = (valeurs = {}) => ({ id: 'ressources/armes#arme:epees:katana', famille_id: 'epees', ordre: 11, nom: 'Katana', mains: null, competence_brut: 'Arme Légère',
    type_id: 'epee', cout_brut: '15 Ro', effet: 'Dégâts taille, +3 dégâts', description: 'Une épée.', depart_possible: 0, ...valeurs });
  const ressource = { id: 'ressources/armures#materiau:titane', nom: 'Titane' };
  const materiau = (prix) => ({ ressource_id: ressource.id, ordre: 13, prix_brut: prix, effet_brut: "Dégâts +9 pour l'arme" });
  const amelioration = (cible, cout) => ({ id: `x#amelioration:${cible}:5`, cible, niveau: 5, cout_brut: cout, effet_brut: '+10 dégâts' });
  const base = (a, m, am) => ({ tables: { arme: [a], arme_famille: [famille], arme_type: types, ressource: [ressource], materiau_arme: [m], amelioration_equipement: am } });
  const ref = base(arme(), materiau('200 RO'), [amelioration('arme', '200 RO'), amelioration('armure', '1 RO')]);
  const dev = base(arme({ depart_possible: 1, mains: 'deux', type_id: 'dague', effet: 'Dégâts taille, +4 dégâts' }), materiau('250 RO'),
    [amelioration('arme', '210 RO'), amelioration('armure', '2 RO')]);
  const lignes = comparerBases(ref, dev).filter((l) => l.domaine === 'armes');
  const champ = (c) => lignes.find((l) => l.champ === c);
  assert.deepEqual([champ('Arme de départ').avant, champ('Arme de départ').apres, champ('Arme de départ').groupe], ['Non', 'Oui', 'ÉPÉES']);
  assert.deepEqual([champ('Mains').nature, champ('Mains').apres], ['ajoute', 'deux mains']);
  assert.deepEqual([champ('Type d’arme').avant, champ('Type d’arme').apres], ['Épée', 'Dague']);
  assert.equal(lignes.find((l) => l.table_nom === 'materiau_arme').entite, 'Titane');
  // seule l'amélioration d'arme est listée
  assert.deepEqual(lignes.filter((l) => l.table_nom === 'amelioration_equipement').map((l) => [l.entite, l.apres]), [['Amélioration +5', '210 RO']]);
});

test('composants (migration 0040) : monnaie, objet de l’onglet sous son tableau, prix d’une gemme ; une gemme créée en une ligne ; pas les potions', () => {
  const r = (id, genre, nom, valeurs = {}) => ({ id, genre, section: null, nom, description: null, prix_brut: null, ordre: 1, ...valeurs });
  const gemme = (id, prix) => ({ ressource_id: id, magie_id: 'magies/magie-du-feu', prix_commune_brut: prix, prix_raffinee_brut: null, prix_parfaite_brut: null,
    quart_commune_brut: null, quart_raffinee_brut: null, quart_parfaite_brut: null });
  const ref = { tables: {
    monnaie: [{ id: 'pp', nom: 'Pierre précieuse', abreviation: 'PP', valeur_rf: 100000 }],
    ressource: [r('x#materiel:briquet', 'materiel', 'Briquet', { section: 'MATOS AVENTURES', prix_brut: '10 RO' }), r('x#gemme:rubis', 'gemme', 'Rubis'),
      r('x#potion:petite', 'potion', 'Petite fiole rouge', { prix_brut: '1 RO' })],
    gemme: [gemme('x#gemme:rubis', '40 RO')],
  } };
  const dev = { tables: {
    monnaie: [{ id: 'pp', nom: 'Pierre précieuse', abreviation: 'PP', valeur_rf: 200000 }],
    ressource: [r('x#materiel:briquet', 'materiel', 'Briquet', { section: 'MATOS AVENTURES', prix_brut: '12 RO' }), r('x#gemme:rubis', 'gemme', 'Rubis'),
      r('x#gemme:quartz', 'gemme', 'Quartz'), r('x#potion:petite', 'potion', 'Petite fiole rouge', { prix_brut: '2 RO' })],
    gemme: [gemme('x#gemme:rubis', '45 RO'), gemme('x#gemme:quartz', '1 RO')],
  } };
  const lignes = comparerBases(ref, dev).filter((l) => l.domaine === 'composants');
  const de = (entite, champ = null) => lignes.find((l) => l.entite === entite && l.champ === champ);
  assert.deepEqual([de('Pierre précieuse', 'Valeur en RF').avant, de('Pierre précieuse', 'Valeur en RF').apres], ['100000', '200000']);
  assert.equal(de('Briquet', 'Prix (« 2 RO », « 100 RF / 1 RO »)').groupe, 'Matos › MATOS AVENTURES');
  assert.equal(de('Rubis', 'Prix de la gemme commune (« 50 RO »)').apres, '45 RO');
  assert.equal(lignes.filter((l) => l.entite === 'Quartz').length, 1, 'la gemme créée : une ligne (sa ressource), pas une de plus pour ses prix');
  assert.ok(!lignes.some((l) => l.entite === 'Petite fiole rouge'), 'une potion n’est pas un composant');
});

test('Codex et bestiaire : champs modifiés, carte ajoutée ou retirée (pas ses rubriques), contenu entièrement nouveau en une ligne', () => {
  const page = (id, titre, corps, origine = 'docs') => ({ id, type: 'lore', statut: 'draft', origine, titre, corps_md: corps, donnees: null });
  const espece = (id, nom, ordre, valeurs = {}) => ({ id, nom, ordre, ep_brut: 'EP2', description: null, lieu_brut: 'Marais', complement: null, ...valeurs });
  const monstre = (id, espece_id, rang, nom, valeurs = {}) => ({ id, espece_id, rang, nom, echelle_brut: '2', categorie: 'ennemi_simple', type_brut: 'Bête', alignement_brut: null, variable: 0, ...valeurs });
  const rubrique = (monstre_id, rang, titre, texte) => ({ monstre_id, rang, rubrique: 'degats', titre, texte });
  const ref = {
    tables: {
      page: [page('lore/eaunoire', 'Eaunoire', 'Déesse.'), page('lore/relations-entre-les-races', 'Relations', 'a', 'races')],
      monstre_espece: [espece('monstres/blob', 'Blob', 1), espece('monstres/zombi', 'Zombi', 2)],
      monstre: [monstre('monstres/blob#carte:blob', 'monstres/blob', 1, 'Blob'), monstre('monstres/zombi#carte:zombi', 'monstres/zombi', 1, 'Zombi')],
      monstre_rubrique: [rubrique('monstres/blob#carte:blob', 1, 'Dégâts', 'Gifle - 1d4'), rubrique('monstres/zombi#carte:zombi', 1, 'Dégâts', 'Morsure - 1d6')],
      monstre_butin: [{ espece_id: 'monstres/blob', rang: 1, categorie: 'boss', score_brut: '3-15', texte: 'Gelée x 1' }],
    },
  };
  const dev = structuredClone(ref);
  const t = dev.tables;
  t.page[0] = { ...t.page[0], corps_md: 'Déesse de la Corruption.' };
  t.page[1] = { ...t.page[1], corps_md: 'b' }; // tirée du classeur des races : pas une page du Codex
  t.monstre_espece[0] = { ...t.monstre_espece[0], lieu_brut: 'Marais, Grotte' };
  t.monstre[0] = { ...t.monstre[0], categorie: 'boss', variable: 1 };
  t.monstre_rubrique[0] = { ...t.monstre_rubrique[0], texte: 'Gifle - 2d4' };
  t.monstre_butin[0] = { ...t.monstre_butin[0], texte: 'Gelée x 2' };
  t.monstre.splice(1, 1); // le zombi retiré, avec sa rubrique
  t.monstre_rubrique.splice(1, 1);
  t.monstre.push(monstre('monstres/blob#carte:roi-blob', 'monstres/blob', 2, 'Roi blob', { categorie: 'boss' }));
  t.monstre_rubrique.push(rubrique('monstres/blob#carte:roi-blob', 1, 'Dégâts', 'Écrasement - 2d10'));
  const cle = (l) => `${l.domaine} | ${l.groupe ?? ''} | ${l.entite} | ${l.champ ?? '(entité)'} | ${l.nature} | ${l.avant ?? ''} → ${l.apres ?? ''}`;
  assert.deepEqual(comparerBases(ref, dev).map(cle), [
    'codex |  | Eaunoire | Texte | modifie | Déesse. → Déesse de la Corruption.',
    'bestiaire | Blob | Blob | Lieu de rencontre (lieux séparés par des virgules) | modifie | Marais → Marais, Grotte',
    'bestiaire | Blob | Blob | Catégorie | modifie | Ennemi simple → Boss',
    'bestiaire | Blob | Blob | Stats selon l’échelle de puissance | modifie | Non → Oui : « Ses stats varient selon son échelle de puissance. »',
    'bestiaire | Blob | Blob › Dégâts | Texte de la rubrique | modifie | Gifle - 1d4 → Gifle - 2d4',
    'bestiaire | Blob | Roi blob | (entité) | ajoute |  → Roi blob',
    'bestiaire | Blob | Blob › butin 3-15 (Boss) | Butin possible | modifie | Gelée x 1 → Gelée x 2',
    'bestiaire | Zombi | Zombi | (entité) | retire | Zombi → ',
  ]);
  // à leur première livraison (rien en production), le Codex et le bestiaire tiennent en une ligne chacun ; leurs rubriques ne sont pas listées
  const vide = { tables: { page: ref.tables.page.filter((p) => p.origine !== 'docs') } };
  assert.deepEqual(comparerBases(vide, ref).map(cle), [
    'codex |  | Eaunoire | (entité) | ajoute |  → Eaunoire',
    'bestiaire |  | 2 espèces | (entité) | ajoute |  → 2 espèces',
    'bestiaire |  | 2 monstres | (entité) | ajoute |  → 2 monstres',
  ]);
});

test('comparerBases : bases identiques → rien ; espaces et fins de ligne ne comptent pas', () => {
  const { ref } = bases();
  assert.deepEqual(comparerBases(ref, structuredClone(ref)), []);
  const dev = structuredClone(ref);
  dev.tables.metier[0].description = '  Forge.\r\n';
  assert.deepEqual(comparerBases(ref, dev), []);
});

test('comparerBases : schéma plus ancien en production (table ou colonne absente) toléré', () => {
  const { ref, dev } = bases();
  // colonne absente de la production : la valeur de dev est « ajoutée »
  for (const s of ref.tables.sort) delete s.texte_niveau5;
  dev.tables.sort[0].texte_niveau5 = 'Texte du sort.';
  // table absente de la production : son contenu est dit ajouté, champ = le genre de la ligne
  dev.tables.race_onglet = [{ race_id: 'races/elfe', sante_depart: 10 }];
  const lignes = comparerBases(ref, dev);
  const texte = lignes.find((l) => l.colonne === 'texte_niveau5');
  assert.deepEqual([texte.nature, texte.avant, texte.apres], ['ajoute', null, 'Texte du sort.']);
  const onglet = lignes.find((l) => l.table_nom === 'race_onglet');
  assert.deepEqual([onglet.nature, onglet.champ, onglet.entite, onglet.groupe], ['ajoute', 'Onglet de la race', 'Elfe', 'Elfe']);
  // et une base de dev sans une table de la production : pas d'erreur, les lignes sont dites retirées
  delete dev.tables.metier;
  assert.ok(comparerBases(ref, dev).some((l) => l.table_nom === 'metier' && l.nature === 'retire' && l.champ === 'Métier'));
});

test('comparerBases : capacité Mode Hyper (onglets seulement) et dons de classe nommés d’après leur spécialité', () => {
  const ref = {
    tables: {
      magie: magies,
      race: [race('races/humain', 'Humain')],
      categorie_classe: [{ id: 'magiques', libelle: 'Magiques', ordre: 3 }],
      classe: [{ id: 'classes/mage-bleu', nom: 'Mage bleu', categorie_id: 'magiques', ordre: 1, sante_depart: 10 }],
      specialite: [{ id: 'specialites/saphir', classe_id: 'classes/mage-bleu', nom: 'Mage saphir', rang: 1 }],
      capacite: [{ id: 'capacites/conteste', classe_id: 'classes/mage-bleu', specialite_id: 'specialites/saphir', nom: 'Contesté !', niveau: 5,
        type_brut: 'Réaction (3 fois/combat)', effet: 'Annule un sort.' }],
      mode_hyper_effet: [
        { id: 1, version: 'onglet_magie', magie_id: 'magies/feu', race_id: null, nom: 'Embrasement', effet: 'a', rang: 1 },
        { id: 2, version: 'fiche', magie_id: 'magies/feu', race_id: null, nom: 'Embrasement', effet: 'a', rang: 1 },
        { id: 3, version: 'onglet_race', magie_id: null, race_id: 'races/humain', nom: 'Volonté', effet: 'a', rang: 1 },
      ],
    },
  };
  const dev = structuredClone(ref);
  dev.tables.capacite[0].type_brut = 'Réaction (2 fois/combat)';
  dev.tables.classe[0].sante_depart = 12;
  for (const m of dev.tables.mode_hyper_effet) m.effet = 'b';
  const lignes = comparerBases(ref, dev);
  const cle = (l) => `${l.domaine} | ${l.groupe} | ${l.entite} | ${l.champ} | ${l.sens}`;
  assert.deepEqual(lignes.map(cle), [
    'magies | Feu | Capacité Mode Hyper | Effet | neutre',
    'classes | Mage bleu | Mage bleu | Santé de départ | amelioration',
    'classes | Mage bleu | Don Mage saphir › Contesté ! | Type (« Actif (1 fois/combat) ») | affaiblissement',
    'races | Humain | Capacité Mode Hyper | Effet | neutre',
  ]);
});

test('comparerBases : un don ajouté, une spécialité retirée avec son don (D11) : listés, en neutre (R29 : une entité ajoutée ou retirée n’a pas de sens)', () => {
  const ref = {
    tables: {
      categorie_classe: [{ id: 'magiques', libelle: 'Magiques', ordre: 3 }],
      classe: [{ id: 'classes/mage-bleu', nom: 'Mage bleu', categorie_id: 'magiques', ordre: 1, sante_depart: 10 }],
      specialite: [
        { id: 'specialites/saphir', classe_id: 'classes/mage-bleu', nom: 'Mage saphir', rang: 1 },
        { id: 'specialites/rubis', classe_id: 'classes/mage-bleu', nom: 'Mage rubis', rang: 2 },
      ],
      capacite: [
        { id: 'capacites/conteste', classe_id: 'classes/mage-bleu', specialite_id: 'specialites/saphir', nom: 'Contesté !', niveau: 10, ligne: 22, rang: 1, type_brut: 'Passif', effet: 'a' },
        { id: 'capacites/rubis', classe_id: 'classes/mage-bleu', specialite_id: 'specialites/rubis', nom: 'Rubis', niveau: 10, ligne: 22, rang: 1, type_brut: 'Passif', effet: 'b' },
      ],
    },
  };
  const dev = structuredClone(ref);
  dev.tables.specialite.splice(1, 1);
  dev.tables.capacite.splice(1, 1);
  dev.tables.capacite.push({ id: 'capacites/eclat', classe_id: 'classes/mage-bleu', specialite_id: 'specialites/saphir', nom: 'Éclat', niveau: 15, ligne: 37, rang: 1, type_brut: 'Actif', effet: 'c' });
  const lignes = comparerBases(ref, dev);
  assert.deepEqual(lignes.map((l) => `${l.groupe} | ${l.entite} | ${l.nature} | ${l.sens}`), [
    'Mage bleu | Spécialité Mage rubis | retire | neutre',
    'Mage bleu | Don Mage rubis › Rubis | retire | neutre',
    'Mage bleu | Don Mage saphir › Éclat | ajoute | neutre',
  ], 'les dons dans l’ordre de la page (niveau, ligne)');
});

test('versionDeLivraison : la version que le bot donnera à la livraison dev → master (X.Y)', () => {
  const cas = [['0.1.76', '0.1.0'], ['0.1.76', null], ['0.2.5', '0.2.0'], ['1.4.2', '1.4.0'], ['0.9.3', '0.10.0'], ['0.1.3', '0.2.0']];
  for (const [dev, master] of cas) {
    const attendu = versionCourte(planifier({ type: 'livraison', versionMaster: master ?? '0.0.0', versionDev: dev }).master.version);
    assert.equal(versionDeLivraison(dev, master), attendu, `${dev} / ${master}`);
  }
  assert.equal(versionDeLivraison('0.4.2', '0.4.0', { majeure: true }), versionCourte(planifier({ type: 'livraison', versionMaster: '0.4.0', versionDev: '0.4.2', majeure: true }).master.version));
  assert.equal(versionDeLivraison('0.1.76', '0.1.0'), '0.2');
  assert.equal(versionCourte('0.2.0'), '0.2');
  assert.deepEqual(trierVersions(['0.2', '0.10', '0.9', '1.0']), ['1.0', '0.10', '0.9', '0.2']);
});

test('rendu : ancienne valeur barrée, nouvelle à côté, couleur du sens ; tout texte échappé', () => {
  const { ref, dev } = bases();
  dev.tables.metier[0].nom = 'Forgeron <script>alert(1)</script>';
  const lignes = comparerBases(ref, dev);
  const html = htmlDeLaListe(lignes, { niveau: 3 });
  assert.ok(!html.includes('<script>'), 'aucune balise venue des données');
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /<span class="nv-sens nv-sens--amelioration" title="amélioration"><del>6<\/del> <span class="nv-fleche" aria-hidden="true">→<\/span> <ins>4<\/ins><\/span>/);
  assert.match(html, /<span class="nv-entite__nom">Vieux sort<\/span> <span class="nv-badge nv-badge--retrait">retiré<\/span>/);
  assert.match(html, /<span class="nv-entite__nom">Étincelle<\/span> <span class="nv-badge nv-badge--ajout">ajouté<\/span>/);
  assert.match(html, /<details class="nv-domaine" data-domaine="sorts" open>/);
  assert.match(htmlDeLaListe(lignes, { plafond: 1 }), /<details class="nv-domaine" data-domaine="sorts">/, 'replié au-delà du plafond');
  assert.equal(htmlDeLaListe([]), '<p class="nv-aucune">Aucune modification des règles.</p>');
  const note = htmlDeLaNote({ version: '0.1', publiee_le: '2026-10-01', depuis: '0.0', texte: 'Bonjour **à tous**', exemple: 1 }, lignes);
  assert.match(note, /<article class="nv-note" id="v0-1">/);
  assert.match(note, /Version 0\.1 <span class="nv-date">1 octobre 2026<\/span> <span class="nv-depuis">depuis la V0\.0<\/span>/);
  assert.match(note, /class="nv-exemple"/);
  assert.match(note, /<p>Bonjour <strong>à tous<\/strong><\/p>/);
  // sans liste : « Aucune modification des règles » si la note n'a pas de texte ; avec un texte (V0.2, migration 0028), le texte seul
  const vide = { version: '0.2', publiee_le: '2026-10-11', depuis: '0.1', texte: null, exemple: 0 };
  assert.match(htmlDeLaNote(vide, []), /Aucune modification des règles\./);
  const importInitial = htmlDeLaNote({ ...vide, texte: 'Import initial depuis les sources historiques.' }, []);
  assert.match(importInitial, /<p>Import initial depuis les sources historiques\.<\/p>/);
  assert.doesNotMatch(importInitial, /nv-aucune/);
});

test('lancementAffiche : l’encart « Dernier lancement » ne parle que de la version en préparation, sauf s’il pèse encore sur la page', () => {
  const termine = { lot: 'a', version_cible: '0.2', etat: 'termine' };
  // demande du propriétaire : la livraison précédente, terminée, ne s'affiche plus pendant la préparation de la suivante
  assert.equal(lancementAffiche({ lancement: termine, version_cible: '0.3', occupe: false, liberable: false, brouillon: { lot: null } }), null);
  assert.equal(lancementAffiche({ lancement: { ...termine, etat: 'simulation_reussie' }, version_cible: '0.3' }), null);
  assert.equal(lancementAffiche({ lancement: null, version_cible: '0.3' }), null);
  // la version en préparation : toujours montré (simulation, échec, terminé…)
  for (const etat of ['simulation_reussie', 'simulation_echouee', 'echec', 'annule', 'termine', 'en_cours']) {
    const l = { lot: 'b', version_cible: '0.3', etat };
    assert.equal(lancementAffiche({ lancement: l, version_cible: '0.3' }), l, etat);
  }
  // une autre version, mais il bloque, tient le texte figé ou son lot s'annule encore : la page doit dire pourquoi
  assert.equal(lancementAffiche({ lancement: termine, version_cible: '0.3', occupe: true }), termine);
  assert.equal(lancementAffiche({ lancement: termine, version_cible: '0.3', brouillon: { lot: 'a' } }), termine);
  assert.equal(lancementAffiche({ lancement: termine, version_cible: '0.3', brouillon: { lot: 'autre' } }), null);
  for (const etat of ['envoi', 'manuel', 'erreur', 'echec', 'lance', 'en_cours']) {
    const l = { lot: 'c', version_cible: '0.2', etat };
    assert.equal(lancementAffiche({ lancement: l, version_cible: '0.3', liberable: true }), l, `${etat} annulable`);
  }
  // un lot déjà dans dev ou livré, resté sans nouvelles 3 h, est « liberable » pour toujours (estLiberable) : sans texte à rendre, il disparaît
  for (const etat of ['fusionne', 'echec_livraison', 'termine']) {
    assert.equal(lancementAffiche({ lancement: { ...termine, etat }, version_cible: '0.3', liberable: true, brouillon: { lot: null } }), null, etat);
  }
});

test('rendu : un long texte montre ce qui a changé mot à mot', () => {
  assert.deepEqual(diffMots('Dure 3 tours (+1/NM).', 'Dure 4 tours (+1/NM).'), [
    { type: 'egal', texte: 'Dure ' }, { type: 'retire', texte: '3' }, { type: 'ajoute', texte: '4' }, { type: 'egal', texte: ' tours (+1/NM).' },
  ]);
  const d = diffMots('a\nb\nc', 'a\nB\nc');
  assert.equal(d.filter((x) => x.type !== 'ajoute').map((x) => x.texte).join(''), 'a\nb\nc');
  assert.equal(d.filter((x) => x.type !== 'retire').map((x) => x.texte).join(''), 'a\nB\nc');
  const long = `${'mot '.repeat(60)}fin.`;
  const html = htmlDeLaListe([{ domaine: 'guide', groupe: 'Chapitre 1', entite: 'Bienvenue', champ: 'Texte', nature: 'modifie', avant: long, apres: long.replace('fin', '<b>fin</b>'), sens: 'neutre' }]);
  assert.match(html, /<details class="nv-champ nv-champ--long nv-sens nv-sens--neutre"><summary><span class="nv-champ__nom">Texte<\/span> <span class="nv-etat">modifié<\/span><\/summary>/);
  assert.match(html, /<ins>&lt;b&gt;fin&lt;\/b&gt;\.<\/ins>/);
});

test('champ libre : paragraphes, listes, gras, italique, liens http(s) ; rien d’autre ne passe', () => {
  assert.equal(htmlDuTexteLibre('Ligne 1\nLigne 2\n\n- un\n- *deux*'), '<p>Ligne 1<br>Ligne 2</p><ul><li>un</li><li><em>deux</em></li></ul>');
  assert.equal(htmlDuTexteLibre('[Discord](https://discord.gg/abc)'), '<p><a href="https://discord.gg/abc" rel="noopener noreferrer">Discord</a></p>');
  const piege = htmlDuTexteLibre('<img src=x onerror=alert(1)> [x](javascript:alert(1)) [y](https://a.b/"onmouseover="alert(1))');
  assert.ok(!/<img|<a href="javascript|onmouseover="/.test(piege), piege);
  assert.equal(htmlDuTexteLibre('   \n\n  '), '');
  assert.equal(echapper(`<a href="x">'&'</a>`), '&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;');
});

test('Markdown de la PR : ~~ancien~~ → **nouveau**, 🟢 / 🔴, marqueur [V: X+1] neutralisé, longueur bornée', () => {
  const { ref, dev } = bases();
  const lignes = comparerBases(ref, dev);
  const md = markdownDeLaNote({ version: '0.2', depuis: '0.1', texte: 'Passage en [V: X+1] ? Non.' }, lignes);
  assert.match(md, /^## Version 0\.2 \(depuis la V0\.1\)$/m);
  assert.ok(!/\[\s*V\s*:\s*X\s*\+\s*1\s*\]/i.test(md), 'jamais le marqueur du bot');
  assert.match(md, /Passage en \(V: X\+1\) \? Non\./);
  assert.match(md, /^- Flash : 🟢 Coût : ~~6~~ → \*\*4\*\* ; 🟢 Portée : ~~6~~ → \*\*8\*\*$/m);
  assert.match(md, /^- Vieux sort : retiré$/m);
  assert.match(md, /^### Métiers$/m);
  assert.equal(neutraliserMarqueur('[ v : x + 1 ]'), '(V: X+1)');
  const enorme = Array.from({ length: 2000 }, (_, i) => ({ domaine: 'sorts', groupe: 'Feu', entite: `Sort ${i}`, champ: 'Coût', nature: 'modifie', avant: '6', apres: '4', sens: 'amelioration' }));
  const coupe = markdownDeLaNote({ version: '0.2', depuis: '0.1', texte: null }, enorme, { max: 5000 });
  assert.ok(coupe.length <= 5000);
  assert.match(coupe, /liste coupée/);
});

test('métiers : une caractéristique d’artisanat changée (décision R34) se lit par son nom, pas par son identifiant', () => {
  const caracteristique = [{ id: 'force', nom: 'Force' }, { id: 'agilite', nom: 'Agilité' }, { id: 'volonte', nom: 'Volonté' }];
  const metier = { id: 'metiers/forgeron', nom: 'Forgeron', artisanat_texte: 'Des armes', test_carac_1_id: 'force', test_carac_2_id: 'volonte' };
  const ref = { tables: { metier: [metier], caracteristique } };
  const dev = { tables: { metier: [{ ...metier, test_carac_2_id: 'agilite' }], caracteristique } };
  const lignes = comparerBases(ref, dev).filter((l) => l.table_nom === 'metier');
  assert.deepEqual(lignes.map((l) => [l.champ, l.avant, l.apres, l.sens]), [['Caractéristique d’artisanat 2', 'Volonté', 'Agilité', 'neutre']]);
});

test('TABLES_DES_NOTES : exactement les tables de la section 15 de data/schema.sql (les traces que les balayages de la base sautent)', () => {
  const schema = readFileSync(new URL('../../data/schema.sql', import.meta.url), 'utf8');
  const debut = schema.indexOf('-- 15. NOTES DE VERSION');
  assert.ok(debut > 0, 'section 15 trouvée');
  const suite = schema.slice(debut + 1).search(/^-- 1[6-9]\. /m);
  const section = suite < 0 ? schema.slice(debut) : schema.slice(debut, debut + 1 + suite);
  assert.deepEqual([...TABLES_DES_NOTES], [...section.matchAll(/^CREATE TABLE (\w+)/gm)].map((m) => m[1]));
});
