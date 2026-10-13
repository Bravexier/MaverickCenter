// Pages de magie : mise en forme des cellules (lib/sort-format.mjs) et lecture des magies et de leurs sorts dans la base (lib/magies-db.mjs).
// Le gabarit (components/MagiePage.astro) affiche ces données telles quelles : on teste ici ce qui lui arrive (formes, regroupements, liens),
// sur le contenu RÉEL de la base (data/rows) comme sur des cas limites.
import assert from 'node:assert/strict';
import { copyFileSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { cheminBase, ouvrirBase } from '../src/lib/donnees.mjs';
import { chargerInvocations } from '../src/lib/bestiaire-db.mjs';
import { chargerMagies } from '../src/lib/magies-db.mjs';
import { entriesAvecRelationsDeLaBase, relationMatrix } from '../src/lib/magie-relations.mjs';
import { splitFrontmatter } from '../src/lib/wikilinks.mjs';
import {
  ancreDeTitre,
  blocsDeTexte,
  coutDeSort,
  elementsDeTexte,
  lignes,
  infobulleDEtat,
  marquesDeMode,
  morceauxAvecEtats,
  morceauxAvecLiens,
  nombre,
  segments,
  sortsParNpm,
  couleurDeMagie,
  COULEUR_PAR_DEFAUT,
  texteSurCouleurDeMagie,
  valeurDeSort,
} from '../src/lib/sort-format.mjs';
import { sansBonus } from '../src/lib/sort-maitrise.mjs';
import { normalize } from '../src/lib/text.mjs';

const textes = (segs) => segs.map((s) => (s.modif ? `(${s.texte})` : s.texte)).join(' ');

// ---------------------------------------------------------------------------------------------------------------------------------
// Mise en forme (cas limites)
// ---------------------------------------------------------------------------------------------------------------------------------

test('nombre : « 4.0 » devient « 4 », tout autre texte est rendu tel quel', () => {
  assert.equal(nombre('4.0'), '4');
  assert.equal(nombre('12.00'), '12');
  assert.equal(nombre('-1.0'), '-1');
  for (const intact of ['2.5', '25%', '10 (-1/NM)', 'Variable', '4', '1.05', '']) assert.equal(nombre(intact), intact);
});

test('segments : les précisions entre parenthèses sont marquées, le texte n’est pas réécrit', () => {
  assert.deepEqual(segments('2d6 dégâts (+1d6/NM)'), [
    { texte: '2d6 dégâts', modif: false },
    { texte: '+1d6/NM', modif: true },
  ]);
  assert.deepEqual(segments('Soi même'), [{ texte: 'Soi même', modif: false }]);
  assert.equal(textes(segments('3 cases horizontales devant (ou verticales/3NM)')), '3 cases horizontales devant (ou verticales/3NM)');
  assert.equal(textes(segments('10 (–1/NM)')), '10 (–1/NM)');
  assert.deepEqual(segments('('), [{ texte: '(', modif: false }], 'parenthèse non fermée : conservée');
  assert.deepEqual(segments('Déplace la/les cible(s)'), [{ texte: 'Déplace la/les cible(s)', modif: false }], 'parenthèse collée à un mot : fait partie du texte');
  assert.equal(segments('(+1/NM)')[0].modif, true, 'précision en début de texte');
});

test('valeurDeSort : « / » et NULL sont « sans valeur », plusieurs lignes restent plusieurs lignes', () => {
  assert.deepEqual(valeurDeSort('/'), { vide: true, lignes: [] });
  assert.deepEqual(valeurDeSort(null), { vide: true, lignes: [] });
  assert.deepEqual(valeurDeSort(''), { vide: true, lignes: [] });
  assert.equal(valeurDeSort('6.0').lignes[0][0].texte, '6');
  assert.equal(valeurDeSort('2d6 dégâts\nSi CR : +1d').lignes.length, 2);
  assert.equal(textes(valeurDeSort('3 (+1/NM)').lignes[0]), '3 (+1/NM)');
});

test('valeurDeSort avec liste (D/S/B) : un élément par bonus, jamais de virgule, une virgule parasite en tête ou en queue est écartée', () => {
  const texte = (v) => v.lignes.map(textes);
  assert.deepEqual(texte(valeurDeSort('+8 dégâts, +2AM, +5% a tout les jets', { liste: true })), ['+8 dégâts', '+2AM', '+5% a tout les jets']);
  assert.deepEqual(texte(valeurDeSort(',+8 dégâts', { liste: true })), ['+8 dégâts']);
  assert.deepEqual(texte(valeurDeSort('Soigne une altération d\'état, +5d6 soin', { liste: true })), ["Soigne une altération d'état", '+5d6 soin']);
  assert.deepEqual(texte(valeurDeSort('2d6 dégâts (+1d6/NM)', { liste: true })), ['2d6 dégâts (+1d6/NM)']);
  assert.deepEqual(texte(valeurDeSort('1,5 fois', { liste: true })), ['1,5 fois'], 'virgule décimale');
  assert.equal(valeurDeSort('/', { liste: true }).vide, true);
  assert.deepEqual(texte(valeurDeSort('+8 dégâts, +2AM')), ['+8 dégâts, +2AM'], 'sans l’option, la cellule est rendue telle quelle');
});

test('coutDeSort : un supplément (« + 4 Sang ») est séparé du coût principal, les parenthèses sont des précisions', () => {
  assert.equal(coutDeSort('10 + 4 Sang').parts.length, 2);
  assert.equal(textes(coutDeSort('10 + 4 Sang').parts[1]), '4 Sang');
  assert.equal(textes(coutDeSort('35 (-2/NM) + 10 âmes').parts[0]), '35 (-2/NM)');
  assert.equal(textes(coutDeSort('35 (-2/NM) + 10 âmes').parts[1]), '10 âmes');
  assert.equal(textes(coutDeSort('50 + 20% PV').parts[1]), '20% PV');
  assert.equal(textes(coutDeSort('4.0').parts[0]), '4');
  assert.equal(coutDeSort('1 âmes pour +3 dégâts').parts.length, 1, '« +3 » collé n’est pas un supplément');
  assert.equal(coutDeSort('2=1 dégâts').parts.length, 1);
  assert.equal(coutDeSort('').vide, true);
  assert.equal(coutDeSort('/').vide, true);
});

test('marquesDeMode : IC, imparable, inesquivable lus dans la table des modes, libellé d’origine avec une majuscule', () => {
  assert.deepEqual(marquesDeMode([{ mode: 'imparable', libelle: 'Imparable' }]), [{ texte: 'Imparable', genre: 'imparable' }]);
  assert.deepEqual(
    marquesDeMode([{ mode: 'inesquivable', libelle: 'inesquivable' }, { mode: 'imparable', libelle: 'imparable' }]).map((m) => [m.texte, m.genre]),
    [['Inesquivable', 'inesquivable'], ['Imparable', 'imparable']],
  );
  assert.deepEqual(marquesDeMode([{ mode: 'ic', libelle: 'IC x 2', fois: 2 }]), [{ texte: 'IC x 2', genre: 'ic' }]);
  assert.deepEqual(marquesDeMode([]), []);
});

test('elementsDeTexte : un élément par ligne et par virgule, hors guillemets et parenthèses', () => {
  assert.deepEqual(elementsDeTexte('+6 AP, +8 dégâts, Rés Nécromancie'), ['+6 AP', '+8 dégâts', 'Rés Nécromancie']);
  assert.deepEqual(elementsDeTexte('Res Vent, "Crache spore" chaque tour'), ['Res Vent', '"Crache spore" chaque tour']);
  assert.deepEqual(elementsDeTexte('Pas de coupure, "a, b" ici (x, y)').length, 2, 'virgules entre guillemets / parenthèses conservées');
  assert.deepEqual(elementsDeTexte('Chaque coup physique sera répondu par 5 de C sur l\'agresseur'), ["Chaque coup physique sera répondu par 5 de C sur l'agresseur"]);
  assert.deepEqual(elementsDeTexte('1,5 fois\nautre ligne'), ['1,5 fois', 'autre ligne'], 'virgule décimale : pas de coupure');
});

test('blocsDeTexte : paragraphes, listes à puces, intertitres « ▸ », retours à la ligne simples conservés', () => {
  assert.deepEqual(blocsDeTexte('Un.\n\nDeux.'), [{ liste: false, texte: 'Un.' }, { liste: false, texte: 'Deux.' }]);
  assert.deepEqual(blocsDeTexte('Ligne 1\nLigne 2'), [{ liste: false, texte: 'Ligne 1\nLigne 2' }]);
  assert.deepEqual(blocsDeTexte('Intro\n- a\n- b\nSuite'), [
    { liste: false, texte: 'Intro' },
    { liste: true, items: ['a', 'b'] },
    { liste: false, texte: 'Suite' },
  ]);
  assert.deepEqual(blocsDeTexte('\n\n▸ Titre\n\n- x'), [{ titre: true, texte: 'Titre' }, { liste: true, items: ['x'] }]);
  assert.deepEqual(blocsDeTexte('- a\n\n- b'), [{ liste: true, items: ['a', 'b'] }], 'puces séparées par une ligne vide = une seule liste');
  assert.deepEqual(blocsDeTexte(null), []);
  assert.deepEqual(blocsDeTexte('  \n \n'), []);
  assert.deepEqual(lignes(' a \n\n b '), ['a', 'b']);
});

test('morceauxAvecLiens : l’adresse nue devient un lien, sans ponctuation finale ni parenthèse en trop', () => {
  const liens = (t) => morceauxAvecLiens(t).filter((m) => m.lien).map((m) => m.lien);
  assert.deepEqual(liens('voir https://x.fr/a.'), ['https://x.fr/a']);
  assert.deepEqual(liens('(voir https://x.fr/a.)'), ['https://x.fr/a']);
  assert.deepEqual(liens('https://x.fr/a)).'), ['https://x.fr/a']);
  assert.deepEqual(liens('https://fandom.com/Mort-Vivant_(Invocation)'), ['https://fandom.com/Mort-Vivant_(Invocation)'], 'parenthèses équilibrées conservées');
  assert.deepEqual(liens('deux http://a.fr, et http://b.fr!'), ['http://a.fr', 'http://b.fr']);
  assert.deepEqual(morceauxAvecLiens('aucun lien'), [{ texte: 'aucun lien' }]);
  assert.equal(morceauxAvecLiens('a https://x.fr/b.').map((m) => m.texte ?? m.lien).join(''), 'a https://x.fr/b.', 'aucun caractère perdu');
});

test('morceauxAvecEtats : l’altération d’état devient une pastille placée dans le texte, sur le mot de la source, une seule fois', () => {
  const lignesEtat = () => [
    { etatId: 'brulure', forme: 'brûlure', extrait: 'Inflige brûlure 1.' },
    { etatId: 'gel', forme: 'Gel', extrait: 'Rend « Gel »' },
  ];
  const restantes = lignesEtat();
  const morceaux = morceauxAvecEtats('Une attaque. Inflige brûlure 1. Rend « Gel » aussi', restantes);
  assert.deepEqual(morceaux.map((x) => x.texte), ['Une attaque. Inflige ', 'brûlure', ' 1. Rend « ', 'Gel', ' » aussi']);
  assert.deepEqual(morceaux.filter((x) => x.etat).map((x) => x.etat.etatId), ['brulure', 'gel']);
  assert.equal(morceaux.map((x) => x.texte).join(''), 'Une attaque. Inflige brûlure 1. Rend « Gel » aussi', 'le texte n’est jamais réécrit');
  assert.equal(restantes.length, 0, 'les altérations placées sont retirées de la liste');
  // un texte sans l'extrait laisse la liste intacte (l'altération sera placée dans le texte suivant)
  const autres = lignesEtat();
  assert.deepEqual(morceauxAvecEtats('Rien à voir', autres), [{ texte: 'Rien à voir' }]);
  assert.equal(autres.length, 2);
  // guillemets et espaces insécables varient entre le texte et l'extrait : la pastille est quand même posée, au mot près
  const insecable = [{ etatId: 'enrage', forme: 'Enragé', extrait: 'Rend la cible « Enragé »' }];
  assert.deepEqual(morceauxAvecEtats('Rend la cible\u00a0«\u202fEnragé\u202f»', insecable).map((x) => x.texte), ['Rend la cible\u00a0«\u202f', 'Enragé', '\u202f»']);
  // la forme de la source peut porter des blancs (espaces insécables autour de « Couardise ») : ils restent dans le texte, hors de la pastille
  const blancs = [{ etatId: 'couardise', forme: '\u00a0Couardise\u00a0', extrait: 'État «\u00a0Couardise\u00a0»' }];
  assert.deepEqual(morceauxAvecEtats('État «\u00a0Couardise\u00a0»', blancs).map((x) => x.texte), ['État «\u00a0', 'Couardise', '\u00a0»']);
  // le MOT : « gel » n'est pas cherché dans « dégelé »
  const mot = [{ etatId: 'gel', forme: 'gel', extrait: 'dégelé puis gel 1' }];
  assert.deepEqual(morceauxAvecEtats('dégelé puis gel 1', mot).map((x) => x.texte), ['dégelé puis ', 'gel', ' 1']);
  // deux lignes d'état sur le même mot : deux pastilles, jamais deux fois la même, sans chevauchement, texte intact
  const deux = [{ etatId: 'brulure', forme: 'brûlure', extrait: 'brûlure 1 puis brûlure 2' }, { etatId: 'brulure', forme: 'brûlure', extrait: 'brûlure 1 puis brûlure 2' }];
  const morceauxDeux = morceauxAvecEtats('brûlure 1 puis brûlure 2', deux);
  assert.deepEqual(morceauxDeux.map((x) => x.texte), ['brûlure', ' 1 puis ', 'brûlure', ' 2']);
  assert.deepEqual(morceauxDeux.map((x) => Boolean(x.etat)), [true, false, true, false]);
  assert.equal(deux.length, 0);
  // une seule ligne d'état dont le mot revient deux fois dans son extrait : une seule pastille (la première), et la ligne est retirée une fois
  const double = [{ etatId: 'gel', forme: 'gel', extrait: 'gel puis gel' }, { etatId: 'peur', forme: 'peur', extrait: 'autre' }];
  assert.deepEqual(morceauxAvecEtats('gel puis gel', double).map((x) => [x.texte, Boolean(x.etat)]), [['gel', true], [' puis gel', false]]);
  assert.deepEqual(double.map((x) => x.etatId), ['peur'], 'seule la ligne placée est retirée de la liste');
  // un extrait qui revient mot pour mot mais pas la forme dans la zone : rien n'est placé, la ligne reste à placer
  const absente = [{ etatId: 'poison', forme: 'poison', extrait: 'Inflige stade 1' }];
  assert.deepEqual(morceauxAvecEtats('Inflige stade 1', absente), [{ texte: 'Inflige stade 1' }]);
  assert.equal(absente.length, 1);
});

test('infobulleDEtat : type, magie liée et effet de chaque stade ; le stade cité dans le texte est mis en avant', () => {
  const etat = { nom: 'Brûlure', typeBrut: 'Physique', magiesLiees: [{ nom: 'Feu' }], stades: [{ stade: 1, effet: 'a' }, { stade: 2, effet: 'b' }] };
  const info = infobulleDEtat(etat, 2);
  assert.deepEqual(info.sous, ['Physique', 'Magie liée : Feu']);
  assert.deepEqual(info.stades.map((x) => [x.libelle, x.actif]), [['Stade 1', false], ['Stade 2', true]]);
  assert.equal(infobulleDEtat({ ...etat, magiesLiees: [] }, null).sous.length, 1, 'sans magie liée : pas de ligne « Magie liée »');
  assert.deepEqual(infobulleDEtat({ ...etat, stades: [{ stade: null, effet: 'x' }] }).stades.map((x) => x.libelle), ['Tous les stades']);
});

test('ancreDeTitre : même identifiant que celui qu’Astro pose sur un titre (minuscules, accents conservés)', () => {
  assert.equal(ancreDeTitre('Brûlure'), 'brûlure');
  assert.equal(ancreDeTitre('Sans Défense'), 'sans-défense');
  assert.equal(ancreDeTitre('Surcharge Magique'), 'surcharge-magique');
  assert.equal(ancreDeTitre("Folle de Guerre"), 'folle-de-guerre');
});

test('sortsParNpm range les sorts par niveau croissant sans perdre l’ordre de lecture ; couleurDeMagie connaît les 15 magies', () => {
  const sorts = [{ niveau: 3, n: 'c' }, { niveau: 1, n: 'a' }, { niveau: 1, n: 'b' }, { niveau: 5, n: 'e' }];
  assert.deepEqual(sortsParNpm(sorts).map((g) => [g.niveau, g.sorts.map((s) => s.n)]), [[1, ['a', 'b']], [3, ['c']], [5, ['e']]]);
  assert.deepEqual(sortsParNpm([]), []);
  assert.equal(couleurDeMagie('Inconnue'), COULEUR_PAR_DEFAUT);
  assert.equal(couleurDeMagie(undefined), COULEUR_PAR_DEFAUT);
  assert.equal(couleurDeMagie('Espace/Temps'), couleurDeMagie('espace-temps'));
  const couleursAttendues = {
    feu: '#ff0000', eau: '#0000ff', glace: '#00ffff', terre: '#996600', vent: '#00ff66',
    foudre: '#ffff00', lumiere: '#fff2cc', ombre: '#cc66ff', sang: '#cc0000', vide: '#ffffff',
    arcane: '#b7b7b7', corruption: '#000000', necromancie: '#274e13', 'espace-temps': '#ff66cc',
    'potentiel-illimite': '#ff9900',
  };
  for (const [nom, couleur] of Object.entries(couleursAttendues)) assert.equal(couleurDeMagie(nom), couleur);
  assert.equal(couleurDeMagie('Lumière'), couleursAttendues.lumiere);
  assert.equal(texteSurCouleurDeMagie('Feu'), '#171210');
  assert.equal(texteSurCouleurDeMagie('Eau'), '#ffffff');
});

// ---------------------------------------------------------------------------------------------------------------------------------
// Lecture de la base (contenu réel)
// ---------------------------------------------------------------------------------------------------------------------------------

const db = ouvrirBase({ sansExemples: false });
const m = chargerMagies(db);
const magiesAvecSorts = [...m.magies.values()].filter((x) => x.sorts.length > 0);

test('15 magies : 14 ont 23 sorts (5 par NPM de 1 à 4, 3 au NPM 5), Potentiel Illimité n’en a pas', () => {
  assert.equal(m.magies.size, 15);
  assert.equal(magiesAvecSorts.length, 14);
  assert.equal(m.sorts.size, 322);
  for (const magie of magiesAvecSorts) {
    assert.deepEqual(sortsParNpm(magie.sorts).map((g) => [g.niveau, g.sorts.length]), [[1, 5], [2, 5], [3, 5], [4, 5], [5, 3]], magie.id);
  }
  assert.equal(m.magies.get('magies/potentiel-illimite').sorts.length, 0);
  assert.equal(m.magies.get('magies/potentiel-illimite').banniere, 'MAGIE DIFFICILE À JOUER !!');
});

test('identifiants de sort : « <magie>#sort:<slug> », slug unique dans la magie, deux magies peuvent avoir un sort du même nom', () => {
  for (const magie of magiesAvecSorts) {
    const slugs = magie.sorts.map((s) => s.slug);
    assert.equal(new Set(slugs).size, slugs.length, `${magie.id} : slugs uniques`);
    for (const s of magie.sorts) assert.equal(s.id, `${magie.id}#sort:${s.slug}`);
  }
  const vague = m.sorts.get('magies/magie-de-larcane#sort:vague-deferlante');
  assert.deepEqual(vague.memeNom, ['magies/magie-de-la-corruption#sort:vague-deferlante']);
});

test('chaque sort : nom, au moins un type, effets secondaires ; aucune cellule n’affiche « .0 », et le D/S/B n’a jamais de liste séparée par des virgules', () => {
  for (const s of m.sorts.values()) {
    assert.ok(s.nom.length > 0 && s.types.length > 0 && s.effets.length > 0, s.id);
    for (const t of s.types) assert.ok(normalize(s.typeBrut).includes(normalize(t.libelle)) || normalize(t.libelle) === 'entave' || normalize(s.typeBrut).includes('entave'), `${s.id} : ${t.libelle} dans ${s.typeBrut}`);
    const cellules = [coutDeSort(s.coutBrut).parts.flat(), ...[s.porteeBrut, s.zoneBrut].map((c) => valeurDeSort(c).lignes.flat()), valeurDeSort(s.dsbBrut, { liste: true }).lignes.flat()].flat();
    for (const c of cellules) assert.ok(!/^\d+\.0$/.test(c.texte), `${s.id} : « ${c.texte} »`);
    for (const c of valeurDeSort(s.dsbBrut, { liste: true }).lignes.flat()) assert.ok(!/(^|\s),|,(\s|$)/.test(c.texte), `${s.id} D/S/B : virgule dans « ${c.texte} »`);
  }
});

test('la remarque du sort (note de cellule) vient de sort.remarque : une remarque affichée par sort qui en a une', () => {
  const avec = db.prepare("SELECT id, remarque FROM sort WHERE remarque IS NOT NULL AND remarque <> ''").all();
  assert.equal(avec.length, 97);
  for (const r of avec) {
    const s = m.sorts.get(r.id);
    const affiche = s.remarque.map((b) => (b.liste ? b.items.join(' ') : b.texte)).join(' ');
    // chaque paragraphe de la remarque est affiché (retours à la ligne et espaces compris dans le paragraphe)
    for (const para of r.remarque.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)) {
      for (const ligne of para.split('\n').map((l) => l.replace(/^[-•]\s+/, '').trim()).filter(Boolean)) assert.ok(affiche.includes(ligne), `${r.id} : « ${ligne} »`);
    }
  }
  assert.deepEqual(m.sorts.get('magies/magie-du-feu#sort:rai-solaire').remarque, [{ liste: false, texte: 'Peut prendre un tour de concentration pour donner un bonus de +10 dégâts.' }]);
  assert.equal(m.sorts.get('magies/magie-du-feu#sort:boule-de-feu').remarque.length, 0, 'pas de remarque inventée');
});

test('le chargeur ne dépend pas de la table note_cellule (simple trace, appelée à disparaître)', () => {
  const dossier = mkdtempSync(join(tmpdir(), 'maverick-magies-'));
  try {
    const copie = join(dossier, 'sans-note.db');
    copyFileSync(cheminBase({ sansExemples: false }), copie);
    const w = new DatabaseSync(copie);
    w.exec('PRAGMA foreign_keys = OFF; DROP TABLE note_cellule;');
    w.close();
    const sans = chargerMagies(new DatabaseSync(copie, { readOnly: true }));
    assert.equal(sans.sorts.size, 322);
    assert.deepEqual(sans.sorts.get('magies/magie-du-feu#sort:fer-brulant').remarque, m.sorts.get('magies/magie-du-feu#sort:fer-brulant').remarque);
  } finally {
    rmSync(dossier, { recursive: true, force: true });
  }
});

test('texte du sort de niveau 5 : seuls les sorts qui en ont un le portent', () => {
  const avec = db.prepare("SELECT id FROM sort WHERE texte_niveau5 IS NOT NULL AND texte_niveau5 <> ''").all().map((r) => r.id);
  assert.ok(avec.length >= 15);
  for (const s of m.sorts.values()) assert.equal(s.incantation !== null, avec.includes(s.id), s.id);
  for (const s of m.sorts.values()) if (s.incantation) assert.equal(s.niveau, 5, `${s.id} : un texte de sort est au NPM 5`);
});

test('sorts qui ont leurs propres règles : Animation de mort, Appel aux Golems, Marionnette de l’ombre invoquent des créatures liées', () => {
  const avec = [...m.sorts.values()].filter((s) => s.invoque.length > 0);
  assert.deepEqual(avec.map((s) => s.slug).sort(), ['animation-de-mort', 'appel-aux-golems', 'marionnette-de-lombre']);
  const pages = new Set(db.prepare('SELECT id FROM page').all().map((r) => r.id));
  for (const s of avec) {
    for (const i of s.invoque) {
      assert.ok(pages.has(i.id), `page de l'invocation ${i.id}`);
      assert.equal(i.creatures.length, db.prepare('SELECT count(*) AS n FROM creature WHERE invocation_id = ?').get(i.id).n, i.id);
      assert.ok(i.texte.length > 0, `${i.id} : texte des règles de l'invocation`);
      for (const c of i.creatures) assert.ok(pages.has(c.id), `page de la créature ${c.id}`);
    }
  }
  const mort = m.sorts.get('magies/magie-de-la-necromancie#sort:animation-de-mort').invoque[0];
  assert.equal(mort.tableau.lignes.length, 13, 'tableau AMELIORATION CADAVERIQUE avec l’invocation');
  assert.ok(mort.tableau.lignes.every((a) => a.effets.length >= 1 && a.nom));
  assert.equal(m.sorts.get('magies/magie-de-la-terre#sort:appel-aux-golems').invoque[0].tableau, null);
  const manteau = m.sorts.get('magies/magie-de-lombre#sort:manteau-noir');
  assert.equal(manteau.effetsDeCarte.length, 5, 'un effet « Manteau noir » par marionnette (cartes du bestiaire)');
  assert.equal(new Set(manteau.effetsDeCarte.map((e) => e.id)).size, 5);
  assert.ok(manteau.effetsDeCarte.every((e) => pages.has(e.id) && e.blocs.length > 0));
});

test('résistances et vulnérabilités : listes de la base, dans l’ordre de la source, magies et altérations d’état', () => {
  const feu = m.magies.get('magies/magie-du-feu');
  assert.deepEqual(feu.resistances.resistance.magies.map((r) => r.id), ['magies/magie-du-feu', 'magies/magie-de-la-glace', 'magies/magie-de-la-terre']);
  assert.deepEqual(feu.resistances.vulnerabilite.magies.map((r) => r.id), ['magies/magie-de-leau', 'magies/magie-du-vent']);
  assert.deepEqual(feu.resistances.resistance.etats.map((r) => m.etats.get(r.id).nom), ['Brûlure', 'Gel', 'Pétrifié']);
  assert.deepEqual(feu.resistances.resistance.etats.map((r) => r.brut), ['Brûlure', 'Gelé', 'Pétrification'], 'écriture de la source gardée (le nom de l’état est dans l’infobulle)');
  assert.deepEqual(m.magies.get('magies/potentiel-illimite').resistances.resistance, { magies: [], etats: [] }, '« Aucune » = aucune ligne');
  for (const magie of m.magies.values()) {
    for (const sens of ['resistance', 'vulnerabilite']) {
      for (const r of magie.resistances[sens].magies) assert.ok(m.magies.has(r.id), `${magie.id} : ${r.id}`);
      for (const r of magie.resistances[sens].etats) assert.ok(m.etats.has(r.id), `${magie.id} : ${r.id}`);
    }
  }
});

test('incompatibilités symétriques ; la phrase libre de la Corruption est gardée telle quelle (trace) ; mono-magie et ethnies d’exception (décision R15)', () => {
  for (const magie of m.magies.values()) {
    for (const autre of magie.incompatibles) assert.ok(m.magies.get(autre).incompatibles.includes(magie.id), `${magie.id} <-> ${autre}`);
    assert.ok(!magie.incompatibles.includes(magie.id));
  }
  const corruption = m.magies.get('magies/magie-de-la-corruption');
  assert.match(corruption.incompatibiliteNote, /mono-magie uniquement/);
  // « excepté pour Elfe Noir Charbon et Felfe Noir (l'ajout de l'elfe noir salé est une erreur) » : migration 0010
  assert.deepEqual(corruption.ethniesSecondaires.map((e) => e.nom), ['Elfe Noir Charbon', 'Felfe Noir']);
  assert.deepEqual(corruption.ethniesSecondaires.map((e) => e.pageId), ['races/elfe-noir', 'races/felfe']);
  assert.deepEqual([...m.magies.values()].filter((x) => x.monoMagie).map((x) => x.id), ['magies/potentiel-illimite', 'magies/magie-de-la-corruption']);
  // la relation reste dans la base : le Potentiel Illimité est incompatible avec les 14 autres magies (seul l'affichage la tait, lib/magie-non-compatible.mjs)
  assert.equal(m.magies.get('magies/potentiel-illimite').incompatibles.length, 14);
});

test('altération d’état liée à chaque magie (etat_magie) : une pour les 14 magies, Surcharge Magique partagée par l’Arcane et la Corruption, aucune pour le Potentiel Illimité', () => {
  const nomDe = (magie) => magie.etats.map((id) => m.etats.get(id).nom);
  assert.deepEqual(nomDe(m.magies.get('magies/potentiel-illimite')), []);
  assert.deepEqual(nomDe(m.magies.get('magies/magie-du-feu')), ['Brûlure']);
  assert.deepEqual(nomDe(m.magies.get('magies/magie-de-larcane')), ['Surcharge Magique']);
  assert.deepEqual(nomDe(m.magies.get('magies/magie-de-la-corruption')), ['Surcharge Magique']);
  for (const magie of m.magies.values()) {
    if (magie.id === 'magies/potentiel-illimite') continue;
    assert.equal(magie.etats.length, 1, magie.id);
    assert.ok(m.etats.get(magie.etats[0]).magiesLiees.some((l) => l.id === magie.id), magie.id);
  }
});

test('altérations d’état : chaque état a sa section sur la page « Liste des altérations d’état » (l’ancre du lien existe)', () => {
  const racine = fileURLToPath(new URL('../src/content/wiki/', import.meta.url));
  const page = readFileSync(join(racine, 'guide', 'liste-des-alterations-d-etat.md'), 'utf8');
  const titres = new Set([...page.matchAll(/^## (.+?)\s*$/gm)].map((t) => t[1]));
  assert.equal(m.etats.size, 20);
  for (const e of m.etats.values()) {
    assert.equal(e.pageId, 'guide/liste-des-alterations-d-etat');
    assert.ok(titres.has(e.nom), `titre « ${e.nom} » sur la page`);
  }
  for (const s of m.sorts.values()) for (const e of s.etats) assert.ok(m.etats.has(e.etatId), `${s.id} : ${e.etatId}`);
});

test('mode hyper de chaque magie (onglet de la magie) : mono et bi-magie, ou forme complète pour Potentiel Illimité', () => {
  for (const magie of magiesAvecSorts) assert.deepEqual(magie.modeHyper.map((v) => v.variante), ['mono', 'bi'], magie.id);
  assert.deepEqual(m.magies.get('magies/potentiel-illimite').modeHyper.map((v) => v.variante), ['forme_complete']);
});

test('ressources offertes, rôles et 4ème barre', () => {
  const sang = m.magies.get('magies/magie-du-sang');
  assert.equal(sang.sante, 10);
  assert.equal(sang.chakra, 0);
  assert.equal(sang.barre4.ressource, 'sang');
  assert.equal(m.magies.get('magies/magie-du-feu').barre4, null);
  assert.deepEqual(m.magies.get('magies/magie-du-feu').roles.map((r) => r.brut), ['DÉGÂTS', 'ENTRAVE', 'RENFORCEMENT']);
  assert.equal(m.magies.get('magies/potentiel-illimite').caracteristique.brut, 'AU CHOIX ou ALÉATOIRE');
  assert.equal(m.magies.get('magies/magie-du-feu').caracteristique.brut, 'SOCIAL');
});

test('règle spéciale du NPM 5 : lue dans la base, pour l’infobulle du titre du tableau ; la liste des lanceurs, la légende et la source n’y sont plus', () => {
  const regle = m.regles.find((r) => r.niveau_sort === 5);
  assert.ok(regle && regle.texte.startsWith(`${regle.titre} : `), 'le titre est le début du texte (le gabarit le retire du corps)');
  assert.equal(m.regles.filter((r) => r.niveau_sort).length, 1, 'une seule règle par niveau : une infobulle');
  for (const s of m.sorts.values()) {
    assert.ok(!('lanceePar' in s) && !('sourceRef' in s), `${s.id} : ni lanceurs ni source`);
  }
  assert.ok(!('legende' in m));
});

test('altérations d’état : de quoi remplir l’infobulle (type, magie liée, effet par stade) pour les 20 états', () => {
  for (const e of m.etats.values()) {
    assert.ok(['Physique', 'Mental'].includes(e.typeBrut), `${e.nom} : type`);
    assert.ok(e.stades.length >= 1, `${e.nom} : au moins un effet de stade`);
    for (const st of e.stades) assert.ok(st.effet.length > 0);
  }
  const brulure = m.etats.get('guide/liste-des-alterations-d-etat#etat:brulure');
  assert.deepEqual(brulure.magiesLiees.map((x) => x.nom), ['Feu']);
  assert.deepEqual(brulure.stades.map((x) => x.stade), [1, 2, 3]);
  assert.equal(m.etats.get('guide/liste-des-alterations-d-etat#etat:surcharge-magique').magiesLiees.length, 2, 'Surcharge magique : deux magies liées');
});

test('altérations d’état dans le texte : sur le chemin réel du gabarit (blocs des effets et de la remarque, segments du D/S/B), toutes les altérations repérées trouvent leur place', () => {
  let placees = 0;
  for (const s of m.sorts.values()) {
    const brut = db.prepare('SELECT dsb_brut, effets, remarque FROM sort WHERE id = ?').get(s.id);
    // panneau « Effets » : les blocs de texte des effets, puis ceux de la remarque, avec la même liste consommée
    const effets = s.etats.filter((e) => e.champ === 'effets');
    const textesEffets = [...s.effets, ...s.remarque].flatMap((b) => ('items' in b ? b.items : [b.texte]));
    for (const t of textesEffets) placees += morceauxAvecEtats(t, effets).filter((x) => x.etat).length;
    assert.equal(effets.length, 0, `${s.id} : altération(s) non placée(s) dans les effets : ${effets.map((r) => r.forme)}`);
    // cellule D/S/B : les segments de chaque ligne, comme le tableau
    const dsb = s.etats.filter((e) => e.champ === 'dsb');
    const valeur = valeurDeSort(sansBonus(brut.dsb_brut, s.bonus, 'dsb'), { liste: true });
    for (const ligne of valeur.lignes) for (const seg of ligne) placees += morceauxAvecEtats(seg.texte, dsb).filter((x) => x.etat).length;
    assert.equal(dsb.length, 0, `${s.id} : altération(s) non placée(s) dans le D/S/B`);
    assert.ok(s.etats.every((e) => ['effets', 'dsb'].includes(e.champ)), `${s.id} : champ d'une altération`);
    // la mise en pastilles ne réécrit jamais le texte
    for (const t of textesEffets) assert.equal(morceauxAvecEtats(t, s.etats.filter((e) => e.champ === 'effets')).map((x) => x.texte).join(''), t);
  }
  assert.equal(placees, db.prepare('SELECT count(*) AS n FROM sort_etat').get().n);
});

test('créatures invoquées : chacune a sa carte du bestiaire (l’infobulle de son nom sur la page de magie), lue dans la base', () => {
  // la carte qu'une page de magie montre en infobulle est celle du bestiaire (lib/magies.ts#carteDeCreature : lib/bestiaire-db.mjs#chargerInvocations)
  const cartes = new Map(chargerInvocations(db).lignes.map((l) => [l.id, l]));
  let n = 0;
  for (const s of m.sorts.values()) for (const i of s.invoque) for (const c of i.creatures) {
    n += 1;
    const carte = cartes.get(c.id);
    assert.ok(carte, `${c.id} : sa carte`);
    assert.equal(carte.nom, c.nom);
    assert.equal(carte.bloc, c.bloc);
    // les six caractéristiques, dans l'ordre F.P.V.S.I.A., avec leur valeur de la base (absente : null)
    const caracs = new Map(db.prepare('SELECT caracteristique_id AS k, valeur FROM creature_caracteristique WHERE creature_id = ?').all(c.id).map((r) => [r.k, r.valeur]));
    assert.deepEqual(carte.fpvsia, ['force', 'perception', 'volonte', 'social', 'intelligence', 'agilite'].map((k) => caracs.get(k) ?? null), `${c.id} : F.P.V.S.I.A.`);
    // les capacités, dans l'ordre, avec leur NPM minimum et leur qualificatif (« [Non enflammé] » : il change leur sens)
    assert.deepEqual(
      carte.capacites.map((k) => [k.nom, k.npm, k.etiquette]),
      db.prepare('SELECT nom, npm_min, etiquette FROM creature_capacite WHERE creature_id = ? ORDER BY rang').all(c.id).map((k) => [k.nom, k.npm_min, k.etiquette]),
      `${c.id} : capacités`,
    );
    assert.deepEqual(carte.attaques.map((a) => a.brut), db.prepare('SELECT brut FROM creature_attaque WHERE creature_id = ? ORDER BY rang').all(c.id).map((a) => a.brut), `${c.id} : dégâts`);
  }
  assert.equal(n, db.prepare('SELECT count(*) AS n FROM creature').get().n, 'toutes les créatures sont invoquées par un des trois sorts');
  // la carte porte bien des caractéristiques, des NPM minimum et des qualificatifs (sinon les comparaisons ci-dessus le seraient à vide)
  const toutes = [...cartes.values()];
  assert.ok(toutes.some((l) => l.fpvsia.every((v) => v !== null)), 'des caractéristiques');
  assert.ok(toutes.some((l) => l.capacites.some((k) => k.npm !== null)), 'des NPM minimum');
  assert.ok(toutes.some((l) => l.capacites.some((k) => k.etiquette)), 'des qualificatifs');
  // l'ordre des créatures d'un sort : celui du classeur (bloc, puis carte de gauche et de droite)
  const golems = m.sorts.get('magies/magie-de-la-terre#sort:appel-aux-golems').invoque[0].creatures;
  const ordre = db.prepare(
    "SELECT c.id FROM creature c JOIN invocation_bloc b ON b.id = c.bloc_id WHERE c.invocation_id = 'bestiaire/appel-aux-golems' ORDER BY b.rang, c.rang",
  ).all().map((r) => r.id);
  assert.deepEqual(golems.map((c) => c.id), ordre);
  // effets de carte (« Manteau noir ») : dans l'ordre des paliers EP1 à EP5, comme les cartes du classeur
  const manteau = m.sorts.get('magies/magie-de-lombre#sort:manteau-noir').effetsDeCarte;
  const paliers = db.prepare('SELECT c.id FROM creature c JOIN invocation_bloc b ON b.id = c.bloc_id WHERE c.id IN (SELECT creature_id FROM creature_effet WHERE sort_id IS NOT NULL) ORDER BY b.rang, c.rang')
    .all().map((r) => r.id);
  assert.deepEqual(manteau.map((e) => e.id), paliers);
});

test('une seule source pour les relations entre magies : le tableau de /magies/ lit la base comme les pages de magie', () => {
  const racine = fileURLToPath(new URL('../src/content/wiki/magies/', import.meta.url));
  const entries = [...m.magies.values()].map((x) => {
    const { data } = splitFrontmatter(readFileSync(join(racine, `${x.slug}.md`), 'utf8'));
    return { id: x.id, data };
  });
  // les listes du front matter (V8) et celles de la base sont les mêmes pour les résistances et vulnérabilités
  for (const e of entries) {
    const x = m.magies.get(e.id);
    assert.deepEqual(e.data.resiste_a, x.resistances.resistance.magies.map((r) => m.magies.get(r.id).nom), `${e.id} résiste`);
    assert.deepEqual(e.data.vulnerable_a, x.resistances.vulnerabilite.magies.map((r) => m.magies.get(r.id).nom), `${e.id} vulnérable`);
  }
  const { magies, cells } = relationMatrix(entriesAvecRelationsDeLaBase(entries, m));
  const col = (nom) => magies.findIndex((x) => x.data.nom_court === nom);
  const feu = magies.findIndex((x) => x.data.nom_court === 'Feu');
  assert.equal(cells[feu][col('Potentiel Illimité')].incompatible, true, 'incompatibilité de la base (fiche) visible dans la matrice');
  assert.equal(cells[feu][col('Glace')].fort, true);
  assert.equal(cells[feu][col('Eau')].faible, true);
  // pour chaque magie, les incompatibles de la matrice = ceux de la base
  magies.forEach((row, i) => {
    const attendu = m.magies.get(row.id).incompatibles.map((id) => m.magies.get(id).nom).sort();
    const obtenu = magies.filter((c, j) => cells[i][j]?.incompatible).map((c) => c.data.nom_court).sort();
    assert.deepEqual(obtenu, attendu, row.id);
  });
});
