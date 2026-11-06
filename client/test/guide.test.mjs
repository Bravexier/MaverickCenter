// Pages du guide (lib/guide.mjs, lib/guide-db.mjs) : blocs tirés de la base, liens Markdown et leurs ancres (demande du propriétaire). Le plan des
// pages (Découvrir, onglets des Règles, Guide du MJ) et leurs adresses : test/livres.test.mjs.
//   node --test test/guide.test.mjs
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import GithubSlugger from 'github-slugger';
import { adresseDesAnciensLiens, avecPrefixe, BLOCS, morceauxDuChapitre, remarkAnciensLiensDuGuide, sansMarqueurs } from '../src/lib/guide.mjs';
import { ACCUEIL_DU_GUIDE, DECOUVRIR, installerLePlan, ongletsDesRegles, PAGES_ABSORBEES, PAGES_DE_LA_CREATION, pagesDeLaRubrique } from '../src/lib/livres.mjs';
import { chargerPlanDesRegles } from '../src/lib/plan-des-regles-db.mjs';
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
  assert.equal(cheminDePage('guide/le-combat'), 'regles/le-combat/', 'toute autre page : à plat sous /regles/ (R184)');
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
  assert.equal(adresse('guide/choisir-sa-classe/#une-ou-deux-classes--le-biclassage'), 'regles/choisir-sa-classe/#une-ou-deux-classes--le-biclassage',
    'une étape de la création, redevenue une page (R184) : son adresse, ancre gardée');
  assert.equal(adresse('guide/le-jeu-de-role/'), 'decouvrir/#le-jeu-de-rôle-comment-ça-marche-', 'une page fusionnée, sans ancre écrite : l’ancre où se lit son contenu');
  assert.equal(adresse('guide/le-jeu-de-role/?a=1'), 'decouvrir/?a=1#le-jeu-de-rôle-comment-ça-marche-', '… après la requête');
  assert.equal(adresse('guide/resistance-faiblesse-magie/'), 'regles/resistances-et-faiblesses/', 'une page fusionnée sans intertitre : la page');
  assert.equal(adresse('regles/avancees/meteo/?a=1#x'), 'regles/meteo/?a=1#x', 'une adresse des Règles avancées (R184)');
  assert.equal(adresse('decouvrir/premiers-sorts/'), 'regles/premiers-sorts/', 'une adresse d’étape du 2026-10-16');
  assert.equal(adresse('guide/reussir-une-action/'), 'regles/reussir-une-action/');
  assert.equal(adresse('guide/'), 'decouvrir/');
  assert.equal(adresse('guide/disparue/'), 'guide/disparue/', 'une page absente : tel qu’écrit (la page 404 s’en charge)');
  assert.equal(adresse('races/elfe/'), 'races/elfe/', 'les autres adresses ne changent pas');
  assert.equal(adresse('guidesse/'), 'guidesse/');
  // le plugin du rendu (lib/guide-rendu.ts), sur l'arbre d'un Markdown passé par avecPrefixe : l'adresse du plan, l'adresse écrite gardée à côté
  const lien = (url) => ({ type: 'link', url, children: [{ type: 'text', value: 'x' }] });
  const arbre = { type: 'root', children: [{ type: 'paragraph', children: [
    lien('/MaverickCenter/guide/les-postures/'), lien('/MaverickCenter/regles/avancees/meteo/#la-pluie'),
    lien('/MaverickCenter/races/'), lien('https://discord.gg/x'), lien('//cdn/x'), { type: 'emphasis', children: [lien('/MaverickCenter/guide/')] },
  ] }] };
  remarkAnciensLiensDuGuide({ base: '/MaverickCenter/', adresse })(arbre);
  const liens = [...arbre.children[0].children.slice(0, 5), arbre.children[0].children[5].children[0]];
  assert.deepEqual(liens.map((l) => [l.url, l.data?.hProperties?.dataLienEcrit ?? null]), [
    ['/MaverickCenter/regles/les-postures/', '/guide/les-postures/'],
    ['/MaverickCenter/regles/meteo/#la-pluie', '/regles/avancees/meteo/#la-pluie'],
    ['/MaverickCenter/races/', null], ['https://discord.gg/x', null], ['//cdn/x', null], ['/MaverickCenter/decouvrir/', '/guide/'],
  ]);
});

// Les pages fabriquées depuis data/rows (npm test lance d'abord db:export-pages) : le vrai guide.
const dossier = new URL('../src/content/wiki/guide/', import.meta.url);
const pagesDuGuide = readdirSync(dossier)
  .filter((f) => f.endsWith('.md'))
  .map((f) => {
    const { data, body } = splitFrontmatter(readFileSync(new URL(f, dossier), 'utf8'));
    return { id: `guide/${f.slice(0, -3)}`, data, body };
  });

test('le guide du site : chaque page de Découvrir, de la création du personnage et d’ouverture d’un onglet a un résumé (cartes de l’accueil, description de la page), chaque bloc est appelé une fois, les blocs sont connus', () => {
  const parId = new Map(pagesDuGuide.map((p) => [p.id, p]));
  installerLePlan(chargerPlanDesRegles(ouvrirBase({ sansExemples: false })));
  // les pages importées telles quelles (Météo, la liste des altérations d'état) n'ont pas toutes un résumé : celles écrites pour le site, si
  const rangees = [...pagesDeLaRubrique(DECOUVRIR).map((p) => p.id), ...PAGES_DE_LA_CREATION.pages, ...ongletsDesRegles().map((o) => o.ouverture)];
  for (const id of rangees) {
    assert.ok(parId.has(id), `${id} : page absente`);
    assert.ok(parId.get(id).data.summary, `${id} : résumé absent`);
  }
  // toutes les pages du guide (Découvrir, onglets, Guide du MJ) : un bloc est appelé une seule fois, chaque bloc déclaré l'est
  const blocs = pagesDuGuide.flatMap((p) => morceauxDuChapitre(p.body).filter((m) => m.bloc).map((m) => m.bloc));
  assert.equal(new Set(blocs).size, blocs.length, 'un bloc est appelé une seule fois dans tout le guide');
  assert.deepEqual([...blocs].sort(), [...BLOCS].sort(), 'chaque bloc déclaré est utilisé, une fois');
  // plus de sommaire dans Bienvenue (demande du propriétaire du 2026-10-18 : « Dans la page de bienvenue, retire le sommaire ») : plus de bloc « sommaire »
  assert.equal(BLOCS.includes('sommaire'), false);
  assert.throws(() => morceauxDuChapitre('<!-- guide:sommaire -->\n'), /bloc inconnu « sommaire »/);
  // plus de liste des 15 magies (refonte de « L’univers », sa seule page : « Pas la peine le lister les 5 magies ici ») : plus de bloc « magies »
  assert.equal(BLOCS.includes('magies'), false);
  assert.throws(() => morceauxDuChapitre('<!-- guide:magies -->\n'), /bloc inconnu « magies »/);
  // plus de liste des pages de référence : « Les documents des règles » est supprimée (R184 (9))
  assert.equal(BLOCS.includes('documents'), false);
  assert.throws(() => morceauxDuChapitre('<!-- guide:documents -->\n'), /bloc inconnu « documents »/);
  // R184 : les blocs ont suivi leur texte dans les pages des étapes ; R185 (4) : le tableau des relations dans « Résistances et faiblesses », juste après
  // son premier paragraphe
  const ouEst = Object.fromEntries(pagesDuGuide.flatMap((p) => morceauxDuChapitre(p.body).filter((m) => m.bloc).map((m) => [m.bloc, p.id])));
  assert.deepEqual(
    Object.fromEntries(['fil-rouge', 'fil-rouge-race', 'magie-bonus', 'fil-rouge-magie', 'fil-rouge-classe', 'competences', 'fil-rouge-sorts', 'initiative',
      'fil-rouge-attributs', 'types-de-don', 'relations-des-magies'].map((b) => [b, ouEst[b]])),
    {
      'fil-rouge': 'guide/creer-son-personnage', 'fil-rouge-race': 'guide/choisir-sa-race', 'magie-bonus': 'guide/choisir-ses-magies',
      'fil-rouge-magie': 'guide/choisir-ses-magies', 'fil-rouge-classe': 'guide/choisir-sa-classe', competences: 'guide/caracteristiques-et-competences',
      'fil-rouge-sorts': 'guide/premiers-sorts', initiative: 'guide/finaliser-son-personnage', 'fil-rouge-attributs': 'guide/finaliser-son-personnage',
      'types-de-don': 'guide/finaliser-son-personnage', 'relations-des-magies': 'guide/resistances-et-faiblesses',
    },
  );
  const relations = morceauxDuChapitre(parId.get('guide/resistances-et-faiblesses').body);
  assert.deepEqual(relations.slice(0, 2).map((m) => ('bloc' in m ? m.bloc : 'texte')), ['texte', 'relations-des-magies']);
  assert.match(relations[0].markdown.trim(), /^[^\n]+$/, 'un seul paragraphe avant le tableau');
});

test('chaque lien vers une page du guide qui écrit une ancre ([[guide/…#ancre]], ou un lien Markdown vers son adresse) mène à un intertitre de cette page', () => {
  // pas de script d'ancre sur une page découpée qui garde son adresse (R184 : reussir-une-action, le-tour-de-jeu, les-degats…) : une ancre écrite vers
  // une section partie dans une autre page doit être corrigée dans le texte. Un intertitre se lit comme le rendu le pose (github-slugger, un rendu par
  // morceau de texte entre deux blocs) ; les blocs posent aussi des ids (competences-<id>).
  const parAdresse = new Map(pagesDuGuide.map((p) => [cheminDePage(p.id), p]));
  const parId = new Map(pagesDuGuide.map((p) => [p.id, p]));
  const ancresDe = (p) => p.body.split(/^<!--\s*guide:[a-z-]+\s*-->[ \t]*$/m).flatMap((morceau) => {
    const slugger = new GithubSlugger();
    return [...morceau.replace(/```[\s\S]*?```/g, '').matchAll(/^#{2,6} (.+)$/gm)].map((m) => slugger.slug(m[1].trim()));
  });
  const textes = ouvrirBase({ sansExemples: false }).prepare("SELECT id, corps_md FROM page WHERE corps_md IS NOT NULL").all();
  assert.ok(textes.length > 500, `${textes.length} pages lues`);
  const vus = [];
  for (const { id, corps_md: corps } of textes) {
    for (const m of corps.matchAll(/\[\[(guide\/[a-z0-9-]+)#([^|\]]+)/g)) vus.push([id, parId.get(m[1]), decodeURIComponent(m[2]), m[0]]);
    for (const m of corps.matchAll(/\]\(\/((?:decouvrir|regles|mj)\/[^)#\s]*)#([^)\s]+)\)/g)) vus.push([id, parAdresse.get(m[1]), decodeURIComponent(m[2]), m[0]]);
  }
  for (const [id, cible, ancre, lien] of vus) {
    assert.ok(cible, `${id} : ${lien} mène à une page absente`);
    assert.ok(ancresDe(cible).includes(ancre), `${id} : ${lien} — #${ancre} n’est pas un intertitre de ${cible.id}`);
  }
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

test('décision R149 (G40) : les deux pages du guide et le mot-clé « Maîtrise d’arme » écrivent le plafond de maîtrise d’arme, 4 points, donc 5 dés, sans plus de « et ainsi de suite »', () => {
  // « 4 points au plus par famille, donc 5 dés. Les points de toutes les sources s'additionnent, jusqu'à ce plafond ; au-delà, la fiche le signale,
  // et les points en trop ne donnent pas de dé » (R149) ; les pages disent « catégorie » pour la famille d'armes (R150). Un invariant du texte courant
  // (data/rows), pas la valeur d'import : le site de dev a réécrit trois de ces pages depuis l'import, dont le texte n'écrivait pas le plafond. La
  // quatrième, le Lexique, est devenue des mots-clés (migration 0090) : sa phrase est la définition du mot-clé `maitrise-darme`.
  const maitrise = db.prepare("SELECT description FROM mot_cle WHERE id = 'maitrise-darme'").get()?.description;
  assert.ok(maitrise, 'le mot-clé « Maîtrise d’arme » et sa définition');
  // R184 : la phrase de la création est partie avec l'étape 4 (guide/caracteristiques-et-competences) ; l'Aide-mémoire est supprimée (R184 (9))
  for (const [id, texte] of [...['guide/caracteristiques-et-competences', 'guide/l-equipement'].map((id) => [id, pagesDuGuide.find((p) => p.id === id).body]),
    ['mot_cle maitrise-darme', maitrise]]) {
    const desDeMaitrise = texte.split('\n').filter((ligne) => /point de maîtrise/.test(ligne) && /\bdés?\b/.test(ligne));
    assert.ok(desDeMaitrise.length > 0, `${id} : la phrase des dés de maîtrise`);
    assert.ok(desDeMaitrise.some((ligne) => /\b4 points\b/.test(ligne) && /\b5 dés\b/.test(ligne) && /plafond/.test(ligne)), `${id} : le plafond, 4 points, 5 dés`);
    for (const ligne of desDeMaitrise) assert.doesNotMatch(ligne, /ainsi de suite|etc\./, id);
  }
});

test('R184 (1) : le menu latéral d’un onglet rend une entrée « bientôt » grisée, sans lien, et une entrée lien par son libellé (aucune « bientôt » aujourd’hui : lu dans le composant)', () => {
  const menu = readFileSync(new URL('../src/components/guide/MenuLateral.astro', import.meta.url), 'utf8');
  // une entrée « bientôt » : la classe du menu du site (.nav-soon, grisée), « (bientôt) » comme au menu du site, jamais un <a>
  // (chaque entrée porte en plus les attributs du mode modification, `ed(i)` : lot de l'édition des menus)
  assert.match(menu, /'bientot' in p \? \(\s*<li \{\.\.\.ed\(i\)\}><span class="lateral-menu__bientot nav-soon">\{p\.bientot\} <small>\(bientôt\)<\/small><\/span><\/li>/);
  // un lien : son adresse relative à la racine (url), marqué quand il mène à la page affichée
  assert.match(menu, /<a class="lateral-menu__lien" href=\{url\(p\.adresse\)\} aria-current=\{p\.adresse === `\$\{entry\.id\}\/` \? 'page' : undefined\}>\{p\.libelle\}<\/a>/);
  // les props des pages de race ne changent pas (components/race/MenuDesRaces.astro : rubrique, pages, entry), plus `edition`, facultative
  assert.match(readFileSync(new URL('../src/components/race/MenuDesRaces.astro', import.meta.url), 'utf8'), /<MenuLateral rubrique=\{rubrique\} pages=\{races\} entry=\{entry\} edition=\{edition\}>/);
  assert.match(menu, /edition\?: \{ menu: string; entrees: EntreeModifiable\[\] \};/, '`edition` facultative : les appelants sans elle ne changent pas');
});
