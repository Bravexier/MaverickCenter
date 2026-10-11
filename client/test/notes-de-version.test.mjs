// Notes de version (page /mise-a-jour/) : la liste production → dev (lib/notes-de-version.mjs#comparerBases) sur des bases synthétiques, la
// version de la prochaine livraison (même règle que le bot : tools/flux-git/regles.mjs#planifier) et l'affichage (lib/notes-de-version-rendu.mjs :
// tout texte échappé, champ libre réduit à un Markdown simple, marqueur [V: X+1] jamais repris). Le sens (couleur) a son propre fichier :
// notes-de-version-sens.test.mjs.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { planifier } from '../../tools/flux-git/regles.mjs';
import { bilan, comparerBases, DOMAINES, trierVersions, versionCourte, versionDeLivraison } from '../src/lib/notes-de-version.mjs';
import {
  diffMots, echapper, htmlDeLaListe, htmlDeLaNote, htmlDuTexteLibre, markdownDeLaNote, neutraliserMarqueur,
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
  assert.deepEqual(DOMAINES.map((d) => d.id), ['sorts', 'magies', 'classes', 'races', 'metiers', 'guide']);
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
