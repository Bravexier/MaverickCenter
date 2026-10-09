// Guide du joueur (lib/guide.mjs, lib/guide-db.mjs) : chapitres dans l'ordre, flèches Précédent / Suivant, blocs tirés de la base (demande du propriétaire).
//   node --test test/guide.test.mjs
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { avecPrefixe, BLOCS, chapitresDuGuide, pagesDeReference, PARTIES, partiesDuGuide, estUnChapitre, morceauxDuChapitre, PREMIER_CHAPITRE, sansMarqueurs, voisins } from '../src/lib/guide.mjs';
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
import { buildIndex, entryUrl, splitFrontmatter } from '../src/lib/wikilinks.mjs';

const page = (id, chapitre, title = id, partie = 'decouvrir') => ({ id, data: { title, chapitre, partie, summary: `Résumé de ${title}` } });

test('les chapitres sont les pages guide numérotées, dans l’ordre ; les autres pages du guide n’en sont pas', () => {
  const entries = [page('guide/c', 3), page(PREMIER_CHAPITRE, 1), page('guide/postures'), page('guide/b', 2), page('races/elfe', 4)];
  assert.equal(estUnChapitre(entries[2]), false);
  assert.equal(estUnChapitre(entries[4]), false, 'seul le type guide a des chapitres');
  assert.deepEqual(chapitresDuGuide(entries).map((c) => [c.numero, c.id]), [[1, PREMIER_CHAPITRE], [2, 'guide/b'], [3, 'guide/c']]);
});

test('une numérotation avec un trou, un doublon ou un mauvais premier chapitre arrête le build', () => {
  assert.throws(() => chapitresDuGuide([page(PREMIER_CHAPITRE, 1), page('guide/c', 3)]), /chapitre 2 attendu/);
  assert.throws(() => chapitresDuGuide([page(PREMIER_CHAPITRE, 1), page('guide/b', 1)]), /chapitre 2 attendu/);
  assert.throws(() => chapitresDuGuide([page('guide/b', 1)]), /doit être guide\/bienvenue/);
});

test('chaque chapitre a une partie connue ; les parties se suivent dans l’ordre, chacune avec sa couleur', () => {
  assert.deepEqual(PARTIES.map((p) => p.id), ['decouvrir', 'creer', 'jouer', 'progresser', 'plus-loin']);
  assert.ok(PARTIES.every((p) => /^#[0-9a-f]{6}$/.test(p.couleur)));
  const chapitres = chapitresDuGuide([page(PREMIER_CHAPITRE, 1), page('guide/b', 2, 'b', 'creer'), page('guide/c', 3, 'c', 'creer'), page('guide/d', 4, 'd', 'plus-loin')]);
  assert.deepEqual(partiesDuGuide(chapitres).map((g) => [g.partie.id, g.chapitres.map((c) => c.numero)]), [['decouvrir', [1]], ['creer', [2, 3]], ['plus-loin', [4]]]);
  assert.throws(() => chapitresDuGuide([page(PREMIER_CHAPITRE, 1), page('guide/b', 2, 'b', 'inconnue')]), /pas de partie connue/);
  assert.throws(() => chapitresDuGuide([page(PREMIER_CHAPITRE, 1, 'a', 'creer'), page('guide/b', 2, 'b', 'decouvrir')]), /vient après un chapitre de la partie creer/);
});

test('précédent et suivant : rien avant le premier chapitre ni après le dernier (flèches grisées)', () => {
  const chapitres = chapitresDuGuide([page(PREMIER_CHAPITRE, 1), page('guide/b', 2), page('guide/c', 3)]);
  assert.deepEqual(Object.values(voisins(chapitres, PREMIER_CHAPITRE)).map((c) => c?.id ?? null), [PREMIER_CHAPITRE, null, 'guide/b']);
  assert.deepEqual(Object.values(voisins(chapitres, 'guide/b')).map((c) => c?.id ?? null), ['guide/b', PREMIER_CHAPITRE, 'guide/c']);
  assert.deepEqual(Object.values(voisins(chapitres, 'guide/c')).map((c) => c?.id ?? null), ['guide/c', 'guide/b', null]);
  assert.throws(() => voisins(chapitres, 'guide/postures'), /n'est pas un chapitre/);
});

test('un chapitre est coupé à ses blocs ; un bloc inconnu est une erreur ; la recherche ne voit pas les marqueurs', () => {
  const corps = 'Intro.\n\n<!-- guide:niveaux -->\n\nSuite.\n<!-- guide:postures -->\n';
  assert.deepEqual(morceauxDuChapitre(corps), [{ markdown: 'Intro.\n\n' }, { bloc: 'niveaux' }, { markdown: '\n\nSuite.\n' }, { bloc: 'postures' }]);
  assert.deepEqual(morceauxDuChapitre('Sans bloc.\n'), [{ markdown: 'Sans bloc.\n' }]);
  assert.throws(() => morceauxDuChapitre('<!-- guide:niveau -->\n'), /bloc inconnu « niveau »/);
  assert.equal(sansMarqueurs(corps), 'Intro.\n\n\n\nSuite.\n\n');
  assert.deepEqual(morceauxDuChapitre('Un `<!-- guide:niveaux -->` dans une phrase reste du texte.\n').length, 1);
});

test('le premier chapitre est servi à /guide/ : ses liens y mènent, les autres pages gardent leur adresse', () => {
  assert.deepEqual(adresseDePage(PREMIER_CHAPITRE), { chemin: 'guide/', ancre: '' });
  assert.equal(cheminDePage('guide/le-combat'), 'guide/le-combat/');
  const index = buildIndex([{ id: PREMIER_CHAPITRE, type: 'guide', slug: 'bienvenue', title: 'Bienvenue', aliases: [] }]);
  assert.equal(entryUrl('/MaverickCenter/', index.byId.get(PREMIER_CHAPITRE)), '/MaverickCenter/guide/');
});

test('les liens Markdown vers une rubrique du site prennent le préfixe de déploiement ; les adresses externes non', () => {
  const md = 'Voir [les races](/races/), [le Discord](https://discord.gg/x) et [[Drakos]].';
  assert.equal(avecPrefixe(md, '/'), md);
  assert.equal(avecPrefixe(md, '/MaverickCenter/'), 'Voir [les races](/MaverickCenter/races/), [le Discord](https://discord.gg/x) et [[Drakos]].');
  assert.equal(avecPrefixe('[a](//cdn.example/x)', '/M/'), '[a](//cdn.example/x)');
});

test('les pages de référence du guide sont rangées par document source, sans les chapitres ni les exemples', () => {
  const ref = (id, title, sources, status = 'draft') => ({ id, data: { title, sources, status } });
  const groupes = pagesDeReference([
    ref('guide/postures', 'Postures', ['Google Doc « Règle du jeu/Guide pour MJ - Maverick »', 'https://docs.google.com/document/d/x/edit']),
    ref('guide/meteo', 'Météo', ['Google Sheet « Magie Maverick V8 », onglet « Météo »']),
    ref('guide/fiche-classe', 'Fiche de personnage : Classe', ['Google Doc « Créer sa fiche de personnage »']),
    ref('guide/alignement', 'Alignement', ['Google Doc « Règle du jeu/Guide pour MJ - Maverick »']),
    ref('guide/utiliser-ce-wiki', 'Utiliser ce wiki', ['Page de démonstration'], 'example'),
    { id: PREMIER_CHAPITRE, data: { title: 'Bienvenue', chapitre: 1, sources: ['Google Doc « Règle du jeu/Guide pour MJ - Maverick »'] } },
    ref('races/elfe', 'Elfe', ['Google Sheet « Les races »']),
  ]);
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

test('le guide du site : chapitres numérotés sans trou, chacun avec un résumé (infobulle de la pagination), blocs connus', () => {
  const chapitres = chapitresDuGuide(pagesDuGuide);
  assert.ok(chapitres.length >= 5, `${chapitres.length} chapitres`);
  assert.deepEqual(
    chapitres.filter((c) => c.partie.id === 'decouvrir').map((c) => c.id),
    [PREMIER_CHAPITRE, 'guide/le-jeu-de-role', 'guide/l-univers', 'guide/reussir-une-action'],
    'découvrir le jeu, puis la règle du D100, avant la création',
  );
  assert.deepEqual(
    chapitres.filter((c) => c.partie.id === 'creer').map((c) => c.id),
    ['guide/creer-son-personnage', 'guide/choisir-sa-race', 'guide/choisir-ses-magies', 'guide/choisir-sa-classe', 'guide/caracteristiques-et-competences', 'guide/premiers-sorts', 'guide/finaliser-son-personnage'],
    'la création dans l’ordre où l’on remplit la fiche ; les attributs, qui se calculent, à la fin',
  );
  assert.deepEqual(
    partiesDuGuide(chapitres).map((g) => [g.partie.id, g.chapitres.length]),
    [['decouvrir', 4], ['creer', 7], ['jouer', 7], ['progresser', 3], ['plus-loin', 3]],
    'le plan validé par le propriétaire : 24 pages en cinq parties',
  );
  const jouer = chapitres.filter((c) => c.partie.id === 'jouer').map((c) => c.id);
  assert.ok(jouer.indexOf('guide/l-equipement') < jouer.indexOf('guide/les-degats'), 'l’armure (AP/AM) avant la formule des dégâts');
  for (const c of chapitres) assert.ok(c.resume, `${c.id} : résumé absent`);
  const blocs = pagesDuGuide.filter(estUnChapitre).flatMap((p) => morceauxDuChapitre(p.body).filter((m) => m.bloc).map((m) => m.bloc));
  assert.equal(new Set(blocs).size, blocs.length, 'un bloc est appelé une seule fois dans tout le guide');
  assert.deepEqual([...blocs].sort(), [...BLOCS].sort(), 'chaque bloc déclaré est utilisé, une fois');
  assert.equal(chapitres.at(-1).id, 'guide/les-documents-des-regles', 'le dernier chapitre mène aux pages de référence');
  assert.ok(blocs.includes('documents'));
  assert.equal(pagesDuGuide.find((p) => p.id === PREMIER_CHAPITRE).body.includes('<!-- guide:sommaire -->'), true, 'sommaire en page 1');
});

const db = ouvrirBase({ sansExemples: false });

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
  assert.equal(magies.length, 15);
  assert.deepEqual(magies.find((m) => m.nom === 'Feu'), { id: 'magies/magie-du-feu', nom: 'Feu', caracteristique: 'Social', chakra: 5, sante: 0, dieux: ['Séraphin'] });
  assert.equal(magies.find((m) => m.nom === 'Potentiel Illimité').caracteristique, 'au choix ou aléatoire');
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
  const guerrier = fil.find((p) => p.id === 'guerrier');
  // Orios (20 santé, 1 chakra) + Guerrier (9 santé, 0 chakra, 1 barrière) + Sang (10 santé, 0 chakra)
  assert.deepEqual([guerrier.attributs.sante, guerrier.attributs.chakra, guerrier.attributs.barriere], [39, 1, 1]);
  assert.deepEqual(guerrier.attributs.quatriemeBarre, { ressource: 'Sang', max: 10 });
  const barde = fil.find((p) => p.id === 'barde');
  // Kitsune (8, 12) + Barde (2, 6, barrière 2) + Vent (0, 5) : chakra 23, barrière 11 + 2
  assert.deepEqual([barde.attributs.sante, barde.attributs.chakra, barde.attributs.barriere, barde.attributs.am], [10, 23, 13, 4]);
  assert.equal(barde.emplacements, 2, 'magie innée + classe magique, puissance 1');
  assert.equal(fil.find((p) => p.id === 'archer').emplacements, 1, 'archer : la magie innée seule');
  const mage = fil.find((p) => p.id === 'mage');
  // Majin (8, 10) + Mage Rouge (0, 9, barrière 1) + Feu (0, 5) : chakra 24, barrière 12 + 1
  assert.deepEqual([mage.magie.nom, mage.attributs.sante, mage.attributs.chakra, mage.attributs.barriere, mage.emplacements], ['Feu', 8, 24, 13, 2]);
});
