// Les sorts « Fer » (décision R164, migration 0079, sur le modèle de R114 et de la 0067) : le mot-clé « Sort fer » du glossaire étiquette les 13 sorts
// « Fer… » (sort_mot_cle), Fer corrompu compris ; leurs effets sont réécrits tels que le propriétaire les a validés (Q54 ; Fer corrompu : sa correction,
// les dégâts de l'arme restent physiques, et Q56, « Chaque attaque, 3 tours ») ; le mot-clé est balisé dans
// les huit textes qui parlent de ces sorts (« Oui, tous ») — cinq par le service du site de dev (client/scripts/baliser-mot-cle.mjs, entrée
// tools/glossaire/sort-fer.json), trois par la migration (textes que le site ne modifie pas) — et nulle part ailleurs, sauf les pages qui recopient ces
// textes. La fiche (« ... Brutale » : +2 dégâts en posture Focus) et le mot-clé protégé suivent dans le code du site.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { historiqueSite } from '../src/lib/historique-site.mjs';
import { lireBalises, texteSansBalises } from '../src/lib/mots-cles-balises.mjs';
import { textesDeLaBase } from '../src/lib/mots-cles-db.mjs';

const db = ouvrirBase({ sansExemples: false });
const lignes = (sql, ...p) => db.prepare(sql).all(...p).map((l) => ({ ...l }));

/** Les 13 effets de R164, tels que validés (Q54 : « Valider tels quels » ; Fer corrompu : Q56), apostrophe droite. */
const EFFETS = {
  'magies/magie-du-feu#sort:fer-brulant': 'Chauffe le métal à blanc : pendant 3 tours, ses attaques infligent des dégâts de feu.',
  // la balise « 5 points de corruption » du site de dev (R103, R140) reste sur le même mot, sous la forme d'un texte de case ; rien d'autre n'est balisé
  'magies/magie-de-la-corruption#sort:fer-corrompu': "Imprègne l'arme d'une énergie mauvaise : pendant 3 tours, chacune de ses attaques inflige 5 points de {{corruption|corruption}} à la cible.",
  'magies/magie-du-vent#sort:fer-eolien': "L'arme crache du vent : pendant 3 tours, ses attaques infligent des dégâts de vent.",
  'magies/magie-de-la-foudre#sort:fer-foudroyant': "Charge l'arme en électricité : pendant 3 tours, ses attaques infligent des dégâts de foudre.",
  'magies/magie-de-la-glace#sort:fer-froid': "Refroidit l'arme au point de la rendre gelée : pendant 3 tours, ses attaques infligent des dégâts de glace.",
  'magies/magie-de-leau#sort:fer-humide': "L'arme transpire de l'eau : pendant 3 tours, ses attaques infligent des dégâts d'eau.",
  'magies/magie-de-la-lumiere#sort:fer-lumineux': "Rend l'arme parfaitement lumineuse : pendant 3 tours, ses attaques infligent des dégâts de lumière.",
  'magies/magie-de-lombre#sort:fer-obscur': "L'arme se charge d'une énergie sombre : pendant 3 tours, ses attaques infligent des dégâts d'ombre.",
  'magies/magie-de-la-terre#sort:fer-raffine': "Renforce l'arme avec un métal raffiné : pendant 3 tours, ses attaques infligent des dégâts de terre.",
  'magies/magie-du-sang#sort:fer-sanglant': 'Le sang sur la lame ne sèche pas : pendant 3 tours, ses attaques infligent des dégâts de sang.',
  'magies/magie-de-lespace-temps#sort:fer-temporel': "Rend l'arme rose et noire : pendant 3 tours, ses attaques infligent des dégâts d'espace-temps.",
  'magies/magie-de-la-necromancie#sort:fer-toxique': "L'arme suinte une matière toxique : pendant 3 tours, ses attaques infligent des dégâts de nécromancie.",
  'magies/magie-du-vide#sort:fer-vide': "Rend l'arme transparente : pendant 3 tours, ses attaques infligent des dégâts de vide.",
};

/** Les huit textes balisés (R164) : table, clé, colonne, et l'écriture balisée (l'expression entière, guillemets compris). */
const BALISES = [
  { table: 'capacite', cle: { id: 'capacites/mage-vert-brutale' }, colonne: 'remarque', ecrit: 'sorts "fer"', site: true },
  { table: 'specialite', cle: { id: 'classes/mage-vert#specialite:mage-emeraude' }, colonne: 'description', ecrit: 'sorts "fer"', site: true },
  { table: 'capacite', cle: { id: 'capacites/lanceur-jongleur-magique' }, colonne: 'effet', ecrit: 'sorts de Fer Élémentaire', site: true },
  { table: 'page', cle: { id: 'ressources/pieces-elementaires' }, colonne: 'corps_md', ecrit: 'sorts "fer"', site: false },
  { table: 'monstre_capacite_commune', cle: { id: 'immateriel' }, colonne: 'description', ecrit: 'sort “fer”', site: true },
  { table: 'creature_capacite', cle: { id: 'bestiaire/fantome#capacite:immateriel' }, colonne: 'texte', ecrit: 'sort “fer”', site: false },
  { table: 'creature_capacite', cle: { id: 'bestiaire/golem-darcane#capacite:immateriel' }, colonne: 'texte', ecrit: 'sort “fer”', site: false },
  { table: 'monstre_rubrique', cle: { monstre_id: 'monstres/golem-darcane#carte:golem-darcane-i', rang: 9 }, colonne: 'texte', ecrit: 'sort “fer”', site: true },
];
/** Les pages qui recopient l'un de ces textes (fiche du don, page de la classe, page de la créature : refaites depuis leurs tables). */
const COPIES = [
  { table: 'page', cle: { id: 'capacites/mage-vert-brutale' }, colonne: 'corps_md' },
  { table: 'page', cle: { id: 'classes/mage-vert' }, colonne: 'corps_md' },
  { table: 'page', cle: { id: 'capacites/lanceur-jongleur-magique' }, colonne: 'corps_md' },
  { table: 'page', cle: { id: 'capacites/lanceur-jongleur-magique' }, colonne: 'resume' },
  { table: 'page', cle: { id: 'bestiaire/fantome' }, colonne: 'corps_md' },
  { table: 'page', cle: { id: 'bestiaire/golem-darcane' }, colonne: 'corps_md' },
];
const cleDe = ({ table, cle, colonne }) => `${table}|${JSON.stringify(cle)}|${colonne}`;
const valeur = ({ table, cle, colonne }) => {
  const ou = Object.keys(cle).map((k) => `"${k}" = ?`).join(' AND ');
  const l = db.prepare(`SELECT "${colonne}" AS v FROM "${table}" WHERE ${ou}`).get(...Object.values(cle));
  assert.ok(l, `${table} ${JSON.stringify(cle)} : ligne absente`);
  return l.v;
};

test('R164 : « Sort fer » étiquette les 13 sorts « Fer… » (sort_mot_cle, migration 0079), Fer corrompu compris, et aucun autre sort', () => {
  assert.deepEqual(lignes("SELECT id, libelle, libelle_cle, description FROM mot_cle WHERE id = 'sort-fer'"),
    [{ id: 'sort-fer', libelle: 'Sort fer', libelle_cle: 'sort-fer', description: "Type de sort d'amélioration qui s'applique sur une arme." }]);
  const etiquetes = lignes("SELECT sort_id FROM sort_mot_cle WHERE mot_cle_id = 'sort-fer' ORDER BY sort_id").map((l) => l.sort_id);
  assert.deepEqual(etiquetes, Object.keys(EFFETS).sort());
  // les sorts « Fer… » de la base, un par magie sauf l'Arcane et le Potentiel Illimité
  assert.deepEqual(lignes("SELECT id FROM sort WHERE nom LIKE 'Fer %' ORDER BY id").map((l) => l.id), etiquetes);
  const magies = lignes("SELECT DISTINCT s.magie_id FROM sort_mot_cle e JOIN sort s ON s.id = e.sort_id WHERE e.mot_cle_id = 'sort-fer'").map((l) => l.magie_id);
  assert.equal(magies.length, 13, 'un par magie');
  assert.ok(!magies.includes('magies/magie-de-larcane') && !magies.includes('magies/potentiel-illimite'));
});

test('R164 : les 13 effets valent les textes validés ; le D/S/B « +8 dégâts » ne change pas, et l’effet ne donne ni bonus de maîtrise ni altération d’état', () => {
  for (const [id, effets] of Object.entries(EFFETS)) {
    const s = lignes('SELECT effets, dsb_brut, type_brut, cout_brut, portee_brut FROM sort WHERE id = ?', id)[0];
    assert.equal(s.effets, effets, id);
    assert.deepEqual([s.dsb_brut, s.type_brut, s.cout_brut, s.portee_brut], ['+8 dégâts', 'Amplification (IC pour 3 NM)', '5', '1'], id);
  }
  const ids = Object.keys(EFFETS);
  const marques = ids.map(() => '?').join(', ');
  assert.equal(db.prepare(`SELECT count(*) AS n FROM sort_bonus_maitrise WHERE champ = 'effets' AND sort_id IN (${marques})`).get(...ids).n, 0);
  assert.equal(db.prepare(`SELECT count(*) AS n FROM sort_etat WHERE champ = 'effets' AND sort_id IN (${marques})`).get(...ids).n, 0);
  // la page de chaque magie écrit le nouvel effet dans son tableau des sorts (« \| » dans une balise sur une ligne de tableau)
  for (const id of ids) {
    const { magie_id: magie, nom } = lignes('SELECT magie_id, nom FROM sort WHERE id = ?', id)[0];
    assert.ok(valeur({ table: 'page', cle: { id: magie }, colonne: 'corps_md' }).includes(`| ${nom} | Amplification (IC pour 3 NM) | 5.0 | 1.0 | 1.0 | +8 dégâts | ${EFFETS[id].replaceAll('|', '\\|')} |`), id);
  }
});

test('R164 : la balise « Sort fer » est posée dans les huit textes qui parlent des sorts fer, sur l’expression écrite, et nulle part ailleurs', () => {
  const historique = historiqueSite(db);
  for (const b of BALISES) {
    const texte = valeur(b);
    const balises = lireBalises(texte, { markdown: b.table === 'page' }).filter((x) => x.ref === 'sort-fer');
    assert.deepEqual(balises.map((x) => x.texte), [b.ecrit], cleDe(b));
    // les mots écrits restent tels quels : le texte affiché est celui d'avant la balise
    if (b.site) assert.equal(texteSansBalises(texte), texteSansBalises(historique.valeurDImport(b.table, b.cle, b.colonne)), cleDe(b));
    else assert.ok(!historique.modifiee(b.table, b.cle, b.colonne), `${cleDe(b)} : balisé par la migration, pas par le site`);
  }
  const permis = new Set([...BALISES, ...COPIES].map(cleDe));
  const ailleurs = [];
  for (const { table, colonne, cle } of textesDeLaBase(db)) {
    const champs = cle.map((c) => `"${c}"`).join(', ');
    for (const l of db.prepare(`SELECT ${champs}, "${colonne}" AS v FROM "${table}" WHERE instr("${colonne}", '{{sort-fer') > 0`).all()) {
      const ici = cleDe({ table, cle: Object.fromEntries(cle.map((c) => [c, l[c]])), colonne });
      if (!permis.has(ici)) ailleurs.push(ici);
    }
  }
  assert.deepEqual(ailleurs, []);
  // les noms des 13 sorts ne sont jamais balisés
  assert.equal(db.prepare("SELECT count(*) AS n FROM sort WHERE nom LIKE 'Fer %' AND instr(nom, '{{') > 0").get().n, 0);
});
