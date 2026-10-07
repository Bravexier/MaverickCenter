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
import { chargerMagies } from '../src/lib/magies-db.mjs';
import { entriesAvecRelationsDeLaBase, relationMatrix } from '../src/lib/magie-relations.mjs';
import { splitFrontmatter } from '../src/lib/wikilinks.mjs';
import {
  ancreDeTitre,
  blocsDeTexte,
  coutDeSort,
  elementsDeTexte,
  lignes,
  marquesDeType,
  morceauxAvecLiens,
  nombre,
  segments,
  sortsParNpm,
  teinteDeMagie,
  TEINTE_PAR_DEFAUT,
  valeurDeSort,
} from '../src/lib/sort-format.mjs';
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

test('marquesDeType : IC, imparable, inesquivable ; une barre sépare deux marques après une lettre seulement', () => {
  assert.deepEqual(marquesDeType('Attaque/ Entrave\n(Imparable)'), [{ texte: 'Imparable', genre: 'imparable' }]);
  assert.deepEqual(
    marquesDeType('Attaque (inesquivable/ imparable)').map((m) => [m.texte, m.genre]),
    [['Inesquivable', 'inesquivable'], ['Imparable', 'imparable']],
  );
  assert.deepEqual(marquesDeType('Amplification\n(IC x 1/NM)'), [{ texte: 'IC x 1/NM', genre: 'ic' }], '« 1/NM » n’est pas coupé');
  assert.deepEqual(marquesDeType('Placement (IC) (IC x 2 si 3NM)').map((m) => m.texte), ['IC', 'IC x 2 si 3NM']);
  assert.deepEqual(marquesDeType('Entrave (IC pour 3 NM)'), [{ texte: 'IC pour 3 NM', genre: 'ic' }]);
  assert.deepEqual(marquesDeType('Soin'), []);
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

test('ancreDeTitre : même identifiant que celui qu’Astro pose sur un titre (minuscules, accents conservés)', () => {
  assert.equal(ancreDeTitre('Brûlure'), 'brûlure');
  assert.equal(ancreDeTitre('Sans Défense'), 'sans-défense');
  assert.equal(ancreDeTitre('Surcharge Magique'), 'surcharge-magique');
  assert.equal(ancreDeTitre("Folle de Guerre"), 'folle-de-guerre');
});

test('sortsParNpm range les sorts par niveau croissant sans perdre l’ordre de lecture ; teinteDeMagie connaît les 15 magies', () => {
  const sorts = [{ niveau: 3, n: 'c' }, { niveau: 1, n: 'a' }, { niveau: 1, n: 'b' }, { niveau: 5, n: 'e' }];
  assert.deepEqual(sortsParNpm(sorts).map((g) => [g.niveau, g.sorts.map((s) => s.n)]), [[1, ['a', 'b']], [3, ['c']], [5, ['e']]]);
  assert.deepEqual(sortsParNpm([]), []);
  assert.equal(teinteDeMagie('Inconnue'), TEINTE_PAR_DEFAUT);
  assert.equal(teinteDeMagie(undefined), TEINTE_PAR_DEFAUT);
  assert.equal(teinteDeMagie('Espace/Temps'), teinteDeMagie('espace-temps'));
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

test('incompatibilités symétriques ; la phrase libre de la Corruption est gardée telle quelle', () => {
  for (const magie of m.magies.values()) {
    for (const autre of magie.incompatibles) assert.ok(m.magies.get(autre).incompatibles.includes(magie.id), `${magie.id} <-> ${autre}`);
    assert.ok(!magie.incompatibles.includes(magie.id));
  }
  const corruption = m.magies.get('magies/magie-de-la-corruption');
  assert.match(corruption.incompatibiliteNote, /mono-magie uniquement/);
  assert.deepEqual(corruption.ethniesSecondaires.map((e) => e.nom), ['Elfe Noir Charbon', 'Elfe Noir Salé', 'Felfe Noir']);
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

test('créatures qui lancent un sort : exactement les lignes résolues de v_creature_sort', () => {
  const attendu = db.prepare('SELECT count(*) AS n FROM v_creature_sort WHERE sort_id IS NOT NULL').get().n;
  assert.equal([...m.sorts.values()].reduce((n, s) => n + s.lanceePar.length, 0), attendu);
  assert.deepEqual(m.sorts.get('magies/magie-de-la-corruption#sort:boule-sombre').lanceePar.map((c) => [c.id, c.capacite]), [['bestiaire/poupee-corrompu', 'Lanceur de sorts']]);
  const pages = new Set(db.prepare('SELECT id FROM page').all().map((r) => r.id));
  for (const s of m.sorts.values()) for (const c of s.lanceePar) assert.ok(pages.has(c.id), `${s.id} : page ${c.id}`);
});

test('légende des sorts et règle du NPM 5 : lues dans la base', () => {
  assert.deepEqual(m.legende.map((l) => l.code).sort(), ['C', 'IC', 'L', 'N', 'NM']);
  assert.equal(m.legende.find((l) => l.code === 'IC').libelle, 'Instant Cast');
  const regle = m.regles.find((r) => r.niveau_sort === 5);
  assert.ok(regle && regle.texte.startsWith(`${regle.titre} : `), 'le titre est le début du texte (le gabarit le retire du corps)');
});

test('une seule source pour les relations entre magies : la matrice de /wiki/races-et-magies/ lit la base comme les pages de magie', () => {
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
