// Pages du guide (lib/guide.mjs, lib/guide-db.mjs) : blocs tirés de la base, liens Markdown, pages de référence (demande du propriétaire). Le plan des
// pages (livres, Règles avancées, Guide du MJ) et leurs adresses : test/livres.test.mjs.
//   node --test test/guide.test.mjs
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { adresseDesAnciensLiens, avecPrefixe, BLOCS, pagesDeReference, morceauxDuChapitre, remarkAnciensLiensDuGuide, sansMarqueurs } from '../src/lib/guide.mjs';
import { ACCUEIL_DU_GUIDE, estDansDecouvrirOuLesBases, PAGES_ABSORBEES, pagesDeLaRubrique, RUBRIQUES_DU_GUIDE } from '../src/lib/livres.mjs';
import {
  chargerCompetences,
  chargerEntrainement,
  chargerInitiative,
  chargerMagiesDuGuide,
  chargerNiveaux,
  chargerPostures,
  chargerTypesDeDon,
} from '../src/lib/guide-db.mjs';
import { adresseDePage, cheminDePage } from '../src/lib/metiers.mjs';
import { chargerFilRouge, FIL_ROUGE } from '../src/lib/guide-fil-rouge.mjs';
import { ficheVide } from '../src/lib/fiche-format.mjs';
import { attributsDe } from '../src/lib/fiche-moteur.mjs';
import { chargerReglesDeFiche } from '../src/lib/fiche-regles.mjs';
import { historiqueSite } from '../src/lib/historique-site.mjs';
import { buildIndex, entryUrl, splitFrontmatter } from '../src/lib/wikilinks.mjs';

const PREMIER = 'guide/bienvenue';

test('un chapitre est coupé à ses blocs ; un bloc inconnu est une erreur ; la recherche ne voit pas les marqueurs', () => {
  const corps = 'Intro.\n\n<!-- guide:niveaux -->\n\nSuite.\n<!-- guide:postures -->\n';
  assert.deepEqual(morceauxDuChapitre(corps), [{ markdown: 'Intro.\n\n' }, { bloc: 'niveaux' }, { markdown: '\n\nSuite.\n' }, { bloc: 'postures' }]);
  assert.deepEqual(morceauxDuChapitre('Sans bloc.\n'), [{ markdown: 'Sans bloc.\n' }]);
  assert.throws(() => morceauxDuChapitre('<!-- guide:niveau -->\n'), /bloc inconnu « niveau »/);
  assert.equal(sansMarqueurs(corps), 'Intro.\n\n\n\nSuite.\n\n');
  assert.deepEqual(morceauxDuChapitre('Un `<!-- guide:niveaux -->` dans une phrase reste du texte.\n').length, 1);
});

test('plus rien sous /guide/ : la première page est servie à /decouvrir/, les autres à leur place dans le plan ; les [[liens]] y mènent', () => {
  assert.deepEqual(adresseDePage(PREMIER), { chemin: 'decouvrir/', ancre: '' });
  assert.equal(cheminDePage('guide/le-tour-de-jeu'), 'regles/le-tour-de-jeu/');
  assert.equal(cheminDePage('guide/le-combat'), 'regles/avancees/le-combat/', 'une page hors des livres : les Règles avancées');
  const index = buildIndex([
    { id: PREMIER, type: 'guide', slug: 'bienvenue', title: 'Bienvenue', aliases: [] },
    { id: 'guide/un-maitre-du-jeu', type: 'guide', slug: 'un-maitre-du-jeu', title: 'Un maître du Jeu', aliases: [] },
  ]);
  assert.equal(entryUrl('/MaverickCenter/', index.byId.get(PREMIER)), '/MaverickCenter/decouvrir/');
  assert.equal(entryUrl('/', index.byId.get('guide/un-maitre-du-jeu')), '/mj/un-maitre-du-jeu/');
});

test('les liens Markdown vers une rubrique du site prennent le préfixe de déploiement ; les adresses externes non', () => {
  const md = 'Voir [les races](/races/), [le Discord](https://discord.gg/x) et [[Drakos]].';
  assert.equal(avecPrefixe(md, '/'), md);
  assert.equal(avecPrefixe(md, '/MaverickCenter/'), 'Voir [les races](/MaverickCenter/races/), [le Discord](https://discord.gg/x) et [[Drakos]].');
  assert.equal(avecPrefixe('[a](//cdn.example/x)', '/M/'), '[a](//cdn.example/x)');
});

test('un lien Markdown écrit vers une ancienne adresse du guide mène à la nouvelle au rendu, ancre gardée ; le texte de la base ne change pas', () => {
  // les pages chargées : ni la page disparue, ni les pages fusionnées dans une autre (lib/livres.mjs#PAGES_ABSORBEES, retirées de la base)
  const options = { cheminDe: cheminDePage, existe: (id) => id !== 'guide/disparue' && !Object.hasOwn(PAGES_ABSORBEES, id), accueil: ACCUEIL_DU_GUIDE };
  const adresse = (chemin) => adresseDesAnciensLiens(chemin, options);
  assert.equal(adresse('guide/les-postures/'), 'regles/les-postures/');
  assert.equal(adresse('guide/choisir-sa-classe/#une-ou-deux-classes--le-biclassage'), 'decouvrir/creer-son-personnage/#une-ou-deux-classes--le-biclassage',
    'une page fusionnée : la page qui l’absorbe, ancre gardée');
  assert.equal(adresse('guide/le-jeu-de-role/'), 'decouvrir/#le-jeu-de-rôle-comment-ça-marche-', 'une page fusionnée, sans ancre écrite : l’ancre où se lit son contenu');
  assert.equal(adresse('guide/premiers-sorts/?a=1'), 'decouvrir/creer-son-personnage/?a=1#étape-5--choisir-ses-premiers-sorts', '… après la requête');
  assert.equal(adresse('guide/reussir-une-action/'), 'regles/reussir-une-action/');
  assert.equal(adresse('guide/'), 'decouvrir/');
  assert.equal(adresse('guide/disparue/'), 'guide/disparue/', 'une page absente : tel qu’écrit (la page 404 s’en charge)');
  assert.equal(adresse('races/elfe/'), 'races/elfe/', 'les autres adresses ne changent pas');
  assert.equal(adresse('guidesse/'), 'guidesse/');
  // le plugin du rendu (lib/guide-rendu.ts), sur l'arbre d'un Markdown passé par avecPrefixe : l'adresse du plan, l'adresse écrite gardée à côté
  const lien = (url) => ({ type: 'link', url, children: [{ type: 'text', value: 'x' }] });
  const arbre = { type: 'root', children: [{ type: 'paragraph', children: [
    lien('/MaverickCenter/guide/les-postures/'), lien('/MaverickCenter/guide/choisir-sa-classe/#une-ou-deux-classes--le-biclassage'),
    lien('/MaverickCenter/races/'), lien('https://discord.gg/x'), lien('//cdn/x'), { type: 'emphasis', children: [lien('/MaverickCenter/guide/')] },
  ] }] };
  remarkAnciensLiensDuGuide({ base: '/MaverickCenter/', adresse })(arbre);
  const liens = [...arbre.children[0].children.slice(0, 5), arbre.children[0].children[5].children[0]];
  assert.deepEqual(liens.map((l) => [l.url, l.data?.hProperties?.dataLienEcrit ?? null]), [
    ['/MaverickCenter/regles/les-postures/', '/guide/les-postures/'],
    ['/MaverickCenter/decouvrir/creer-son-personnage/#une-ou-deux-classes--le-biclassage', '/guide/choisir-sa-classe/#une-ou-deux-classes--le-biclassage'],
    ['/MaverickCenter/races/', null], ['https://discord.gg/x', null], ['//cdn/x', null], ['/MaverickCenter/decouvrir/', '/guide/'],
  ]);
});

test('les pages de référence du guide sont rangées par document source, sans les pages de Découvrir ni des Bases, ni les exemples, ni la page qui les liste', () => {
  const ref = (id, title, sources, status = 'draft') => ({ id, data: { title, sources, status } });
  const groupes = pagesDeReference([
    ref('guide/postures', 'Postures', ['Google Doc « Règle du jeu/Guide pour MJ - Maverick »', 'https://docs.google.com/document/d/x/edit']),
    ref('guide/meteo', 'Météo', ['Google Sheet « Magie Maverick V8 », onglet « Météo »']),
    ref('guide/fiche-classe', 'Fiche de personnage : Classe', ['Google Doc « Créer sa fiche de personnage »']),
    ref('guide/alignement', 'Alignement', ['Google Doc « Règle du jeu/Guide pour MJ - Maverick »']),
    ref('guide/utiliser-ce-wiki', 'Utiliser ce wiki', ['Page de démonstration'], 'example'),
    ref(PREMIER, 'Bienvenue', ['Google Doc « Règle du jeu/Guide pour MJ - Maverick »']),
    ref('guide/les-documents-des-regles', 'Les documents des règles', ['Google Doc « Règle du jeu/Guide pour MJ - Maverick »']),
    ref('races/elfe', 'Elfe', ['Google Sheet « Les races »']),
  ], 'guide/les-documents-des-regles');
  assert.deepEqual(
    groupes.map((g) => [g.document, g.genre, g.pages.map((p) => p.titre)]),
    [
      ['Créer sa fiche de personnage', 'Doc', ['Fiche de personnage : Classe']],
      ['Règle du jeu/Guide pour MJ - Maverick', 'Doc', ['Alignement', 'Postures']],
      ['Magie Maverick V8', 'Sheet', ['Météo']],
    ],
  );
});

// Les pages fabriquées depuis data/rows (npm test lance d'abord db:export-pages) : le vrai guide.
const dossier = new URL('../src/content/wiki/guide/', import.meta.url);
const pagesDuGuide = readdirSync(dossier)
  .filter((f) => f.endsWith('.md'))
  .map((f) => {
    const { data, body } = splitFrontmatter(readFileSync(new URL(f, dossier), 'utf8'));
    return { id: `guide/${f.slice(0, -3)}`, data, body };
  });

test('le guide du site : chaque page de Découvrir et des Bases a un résumé (cartes de l’accueil, sommaire des Bases), chaque bloc est appelé une fois, les blocs sont connus', () => {
  const parId = new Map(pagesDuGuide.map((p) => [p.id, p]));
  for (const rubrique of RUBRIQUES_DU_GUIDE) {
    for (const { id } of pagesDeLaRubrique(rubrique)) {
      assert.ok(parId.has(id), `${id} : page absente`);
      assert.ok(parId.get(id).data.summary, `${id} : résumé absent`);
    }
  }
  // toutes les pages du guide (livres, Règles avancées, Guide du MJ) : un bloc est appelé une seule fois, chaque bloc déclaré l'est
  const blocs = pagesDuGuide.flatMap((p) => morceauxDuChapitre(p.body).filter((m) => m.bloc).map((m) => m.bloc));
  assert.equal(new Set(blocs).size, blocs.length, 'un bloc est appelé une seule fois dans tout le guide');
  assert.deepEqual([...blocs].sort(), [...BLOCS].sort(), 'chaque bloc déclaré est utilisé, une fois');
  // plus de sommaire dans Bienvenue (demande du propriétaire du 2026-10-18 : « Dans la page de bienvenue, retire le sommaire ») : plus de bloc « sommaire »
  assert.equal(BLOCS.includes('sommaire'), false);
  assert.throws(() => morceauxDuChapitre('<!-- guide:sommaire -->\n'), /bloc inconnu « sommaire »/);
  const documents = pagesDuGuide.find((p) => morceauxDuChapitre(p.body).some((m) => m.bloc === 'documents'));
  assert.equal(documents.id, 'guide/les-documents-des-regles');
  assert.equal(estDansDecouvrirOuLesBases(documents.id), false, 'la liste des pages de référence est une page de référence');
  const ref = pagesDeReference(pagesDuGuide, documents.id).flatMap((g) => g.pages.map((p) => p.id));
  assert.ok(ref.length > 20 && ref.every((id) => !estDansDecouvrirOuLesBases(id) && id !== documents.id), `${ref.length} pages de référence`);
});

const db = ouvrirBase({ sansExemples: false });
const historique = historiqueSite(db); // ce que le site de dev a changé depuis l'import (lib/historique-site.mjs)

test('le tableau de la montée de niveau reprend les 20 niveaux du guide, gains ponctuels compris', () => {
  const niveaux = chargerNiveaux(db);
  assert.deepEqual(niveaux.map((n) => n.niveau), Array.from({ length: 20 }, (_, i) => i + 1));
  assert.deepEqual([niveaux[0].xp, niveaux[1].xp, niveaux[19].xp], [0, 200, 460250]);
  assert.deepEqual([niveaux[0].competences, niveaux[1].competences, niveaux[4].competences], [100, 20, 40]);
  assert.equal(niveaux[0].attributs, null, 'pas de points d’attributs au niveau 1');
  assert.ok(niveaux[1].autres.includes('Mode Hyper débloqué !'));
  assert.deepEqual(niveaux[4].autres.slice(0, 2), ['+1 caractéristique à répartir', '+10 au maximum naturel']);
  assert.ok(niveaux[15].autres.some((a) => a.startsWith('Puissance magique niveau 5 (non disponible')), 'puissance magique 5 au niveau 16 (décision R16)');
});

test('les blocs de règles relisent la base dans l’ordre de la fiche', () => {
  const postures = chargerPostures(db);
  assert.deepEqual(postures.map((p) => p.nom), ['Offensif', 'Défensif', 'Neutre', 'Focus', 'Vigilance', 'Symbiose']);
  assert.ok(postures.every((p) => p.effets.length >= 2 && p.description));
  const competences = chargerCompetences(db);
  assert.deepEqual(competences.map((c) => c.nom), ['Force', 'Volonté', 'Intelligence', 'Perception', 'Social', 'Agilité']);
  assert.ok(competences.every((c) => c.competences.length === 5));
  assert.ok(competences[1].competences.some((k) => k.nom === 'Calme'), 'Calme et non Prouesse (décision R4)');
  const magies = chargerMagiesDuGuide(db);
  assert.equal(magies.length, db.prepare('SELECT count(*) AS n FROM magie').get().n);
  // ce que la base dit du Feu (le site de dev peut changer ce qu'il offre) ; à l'import, la fiche auto : Social, 5 chakra, 0 santé
  const feu = db.prepare("SELECT m.chakra_offert, m.sante_offerte, m.caracteristique_id, c.nom FROM magie m LEFT JOIN caracteristique c ON c.id = m.caracteristique_id WHERE m.id = 'magies/magie-du-feu'").get();
  assert.deepEqual(magies.find((m) => m.nom === 'Feu'),
    { id: 'magies/magie-du-feu', nom: 'Feu', caracteristique: feu.nom, caracteristique_id: feu.caracteristique_id, chakra: feu.chakra_offert, sante: feu.sante_offerte, dieux: ['Séraphin'] });
  assert.deepEqual(['caracteristique_id', 'chakra_offert', 'sante_offerte'].map((c) => historique.valeurDImport('magie', { id: 'magies/magie-du-feu' }, c)), ['social', 5, 0]);
  if (!historique.touchee('magie', { id: 'magies/potentiel-illimite' }, 'caracteristique_brut')) {
    assert.equal(magies.find((m) => m.nom === 'Potentiel Illimité').caracteristique, 'au choix ou aléatoire');
  }
  assert.deepEqual(chargerInitiative(db).map((i) => i.bonus_brut), ['-2 initiative', '+0 initiative', '+2 initiative', '+4 initiative', '+6 initiative']);
  assert.deepEqual(chargerEntrainement(db).map((e) => e.rate), [false, false, false, false, false, true]);
  assert.deepEqual(chargerTypesDeDon(db).map((t) => t.nom), ['Passif', 'Actif', 'Action', 'Réaction']);
});

test('les personnages fil rouge : des choix permis par la base, et des attributs calculés comme la fiche automatique', () => {
  const fil = chargerFilRouge(db);
  assert.deepEqual(fil.map((p) => p.id), FIL_ROUGE.map((p) => p.id));
  for (const p of FIL_ROUGE) {
    const magieOk = !p.magie || db.prepare('SELECT 1 FROM v_race_magie_accessible WHERE race_id = ? AND magie_id = ?').get(p.race, p.magie);
    assert.ok(magieOk, `${p.id} : magie innée non accessible à sa race`);
    assert.ok(db.prepare('SELECT 1 FROM v_race_classe_accessible WHERE race_id = ? AND classe_id = ?').get(p.race, p.classe), `${p.id} : classe non accessible`);
    assert.equal(db.prepare('SELECT race_id FROM ethnie WHERE id = ?').get(p.ethnie)?.race_id, p.race, `${p.id} : ethnie d’une autre race`);
  }
  // (a) le guide et la fiche disent la même chose : les attributs du moteur de la fiche (lib/fiche-moteur.mjs), calculés par un autre chemin
  const regles = chargerReglesDeFiche(db);
  for (const p of FIL_ROUGE) {
    const g = fil.find((x) => x.id === p.id);
    const a = attributsDe(regles, { ...ficheVide(p.id), race_id: p.race, ethnie_id: p.ethnie, magie_innee_id: p.magie, classes: [{ rang: 1, classe_id: p.classe, specialite_id: null }] });
    assert.deepEqual([g.attributs.sante, g.attributs.chakra, g.attributs.barriere, g.attributs.am], [a.sante, a.chakra, a.barriere, a.am], p.id);
  }
  // (b) les chiffres de la fiche auto V15.2.2, tant que le site de dev (source des données qu'il modifie) n'a changé aucune des cellules en jeu
  const intact = (id) => {
    const p = FIL_ROUGE.find((x) => x.id === id);
    return ![
      ['race_onglet', { race_id: p.race }, ['sante_depart', 'chakra_depart', 'barriere_bonus']],
      ['classe', { id: p.classe }, ['sante_depart', 'chakra_depart', 'barriere_depart']],
      ['magie', { id: p.magie }, ['sante_offerte', 'chakra_offert', 'barre4_ressource', 'barre4_max']],
      ['ethnie', { id: p.ethnie }, ['bonus_pv', 'bonus_chakra', 'bonus_barriere', 'bonus_am']],
      ['race', { id: p.race }, ['am']],
    ].some(([table, cle, colonnes]) => colonnes.some((c) => historique.touchee(table, cle, c)));
  };
  const guerrier = fil.find((p) => p.id === 'guerrier');
  if (intact('guerrier')) {
    // Orios (20 santé, 1 chakra) + Guerrier (9 santé, 0 chakra, 1 barrière) + Sang (10 santé, 0 chakra)
    assert.deepEqual([guerrier.attributs.sante, guerrier.attributs.chakra, guerrier.attributs.barriere], [39, 1, 1]);
    assert.deepEqual(guerrier.attributs.quatriemeBarre, { ressource: 'Sang', max: 10 });
  }
  const barde = fil.find((p) => p.id === 'barde');
  // Kitsune (8, 12) + Barde (2, 6, barrière 2) + Vent (0, 5) : chakra 23, barrière 11 + 2
  if (intact('barde')) assert.deepEqual([barde.attributs.sante, barde.attributs.chakra, barde.attributs.barriere, barde.attributs.am], [10, 23, 13, 4]);
  assert.equal(barde.emplacements, 2, 'magie innée + classe magique, puissance 1');
  assert.equal(fil.find((p) => p.id === 'archer').emplacements, 1, 'archer : la magie innée seule');
  const mage = fil.find((p) => p.id === 'mage');
  assert.deepEqual([mage.magie.nom, mage.emplacements], ['Feu', 2]);
  // Majin (8, 10) + Mage Rouge (0, 9, barrière 1) + Feu (0, 5) : chakra 24, barrière 12 + 1
  if (intact('mage')) assert.deepEqual([mage.attributs.sante, mage.attributs.chakra, mage.attributs.barriere], [8, 24, 13]);
});

test('décisions R17 et R18 : l’exemple 2 des dégâts donne 18 ; à court de chakra, toujours 2 santé pour 1 chakra', () => {
  // le texte tel que l'import l'a écrit (corrigé selon les décisions) : le site de dev, source des données qu'il modifie, peut le réécrire depuis
  const corps = (id) => historique.valeurDImport('page', { id }, 'corps_md', pagesDuGuide.find((p) => p.id === id).body);
  assert.match(corps('guide/formule-des-degats'), /total de 18\.5 dégâts[\s\S]*donc 18 dégâts[\s\S]*J'ai pris 18 points de dégâts/);
  assert.doesNotMatch(corps('guide/formule-des-degats'), /16\.5/);
  assert.match(corps('guide/les-degats'), /37 ÷ 2 = 18,5, arrondi à \*\*18 dégâts\*\*/);
  for (const id of ['guide/la-magie-en-jeu', 'guide/le-mode-hyper']) assert.match(corps(id), /2 points de santé pour 1 point de chakra/, id);
  assert.match(corps('guide/le-mode-hyper'), /\| Coût des sorts en chakra \| 0 \| 0 \|/);
  assert.match(corps('guide/le-mode-hyper'), /10 % du maximum par tour/);
  // « la règle des 2 points de santé pour chaque point de chakra en dessous de zéro c'est tout le temps » : sortie du Mode Hyper 100 % comprise
  assert.match(corps('guide/le-mode-hyper'), /75 % de son chakra maximum\*\* ; s’il ne les a pas, il paie ce qui manque avec sa santé, comme toujours : \*\*2 points de santé pour 1 point de chakra\*\*/);
  assert.match(corps('guide/la-magie-en-jeu'), /tarif de tout chakra dépensé sans l’avoir/);
});
