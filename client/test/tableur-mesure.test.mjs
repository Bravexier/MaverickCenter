// Ce qu'une case de tableur montre d'un texte (lib/tableur-mesure.mjs) et la taille des cases du modèle (lib/tableur-ecriture.mjs#zonesDuClasseur) :
// la fiche exportée ne laisse pas un texte rogné par sa case (demande du propriétaire, 2026-10-15 : « Toute info supplémentaire peut être notée dans
// les « Notes » ») ; elle en garde le début, la suite de sa part relue va dans la note, et l'import recolle les deux (fiche-tableur-aller-retour.test.mjs :
// la chaîne entière). Ici : chasses, lignes, tient / ne tient pas, coupure et recollage exacts (essais tirés au sort, graine fixe), part relue (`lu`),
// ajustement (retour à la ligne, réduction au besoin), et les zones lues dans le modèle stocké.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { modeleXlsx } from '../src/lib/fiche-modele.mjs';
import { pointsDeLaColonne, zonesDuClasseur } from '../src/lib/tableur-ecriture.mjs';
import {
  ajusterLeTexte, couperLeTexte, ECHELLE_MIN, encoderLaSuite, FIN_COUPEE, FIN_COUPEE_DANS_UN_MOT, largeurDuTexte, lignesDuTexte, recollerLeTexte,
  SAUT_DANS_LA_SUITE, sansLaCoupure, tientDans,
} from '../src/lib/tableur-mesure.mjs';

const zone = (z = {}) => ({ colonnes: 10, lignes: 1, largeur: 150, hauteur: 15, police: 'Calibri', taille: 10, gras: false, retour: true, reduire: false, ...z });

test('chasses : celles de Carlito (Calibri) et de Liberation Sans (Arial), lettres accentuées comme leur base, signes inconnus larges', () => {
  // relevées sur les polices (Pillow) : « Construction » en Calibri 8 = 41,8 points ; « Emprisonne » en Arial 10 = 53,4
  assert.ok(Math.abs(largeurDuTexte('Construction', 8) - 41.8) < 0.3);
  assert.ok(Math.abs(largeurDuTexte('Emprisonne', 10, false, 'Arial') - 53.4) < 0.3);
  assert.ok(Math.abs(largeurDuTexte('@', 10, false, 'Arial') - 9.9) < 0.01, '« @ » d’Arial (1,015 cadratin) : la table reste alignée');
  assert.ok(largeurDuTexte('Mm', 10, true) > largeurDuTexte('Mm', 10), 'le gras est plus large');
  assert.equal(largeurDuTexte('é', 10), largeurDuTexte('e', 10));
  assert.equal(largeurDuTexte('Liberation', 10, false, 'Liberation Sans'), largeurDuTexte('Liberation', 10, false, 'Arial'));
  assert.ok(Math.abs(largeurDuTexte('→', 10) - 9.1) < 0.01, 'la flèche de Carlito (0,905 cadratin)');
  assert.equal(largeurDuTexte('→', 10, false, 'Arial'), 10);
  assert.equal(largeurDuTexte('★', 10), 10, 'un signe absent de la police : un cadratin');
  assert.equal(largeurDuTexte('abc', 20), 2 * largeurDuTexte('abc', 10));
  assert.equal(largeurDuTexte('', 10), 0);
});

test('lignes : coupure aux espaces, paragraphes, mot plus long qu’une ligne', () => {
  const l = largeurDuTexte('aaaa', 10);
  assert.equal(lignesDuTexte('aaaa', l, 10), 1);
  assert.equal(lignesDuTexte('aaaa aaaa', l, 10), 2);
  assert.equal(lignesDuTexte('aaaa aaaa', 3 * l, 10), 1);
  assert.equal(lignesDuTexte('aaaa\naaaa', 3 * l, 10), 2);
  assert.equal(lignesDuTexte('aaaa\n\naaaa', 3 * l, 10), 3, 'une ligne vide compte');
  assert.equal(lignesDuTexte('aaaaaaaaaa', l, 10), 3, 'un mot de 2,5 lignes en prend 3');
  assert.equal(lignesDuTexte('aa aaaaaaaaaa', l, 10), 4);
  assert.equal(lignesDuTexte('a', 0, 10), Infinity);
});

test('tient dans la zone : retour à la ligne (lignes de l’interligne), une ligne sans retour, toujours si réduite', () => {
  const ligne = largeurDuTexte('Un texte de test', 10);
  // 15 points de haut en Calibri 10 : une ligne (interligne 1,222) ; 30 : deux
  assert.equal(tientDans('Un texte de test', zone({ largeur: ligne + 2 })), true);
  assert.equal(tientDans('Un texte de test', zone({ largeur: ligne + 1 })), false);
  assert.equal(tientDans('Un texte\nde test', zone({ largeur: ligne + 2 })), false);
  assert.equal(tientDans('Un texte\nde test', zone({ largeur: ligne + 2, hauteur: 30 })), true);
  assert.equal(tientDans('Un texte\nde test\nencore', zone({ largeur: ligne + 2, hauteur: 30 })), false);
  assert.equal(tientDans('Un texte\nde test', zone({ largeur: ligne + 2, hauteur: 300, retour: false })), false, 'sans retour : pas de saut de ligne');
  assert.equal(tientDans('Un texte de test', zone({ largeur: ligne + 2, retour: false })), true);
  assert.equal(tientDans('x'.repeat(5000), zone({ reduire: true, retour: false })), true);
  // Arial : interligne 1,15 ; deux lignes en 24 points de haut
  assert.equal(tientDans('a\nb', zone({ police: 'Arial', hauteur: 24 })), true);
  assert.equal(tientDans('a\nb', zone({ hauteur: 24 })), false);
});

/** Un générateur pseudo-aléatoire à graine fixe (mulberry32) : les essais sont les mêmes d'un passage à l'autre. */
function hasard(graine) {
  let a = graine >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test('coupure : le début tient et finit par « … », la suite sur une ligne ; recollés, ils redonnent le texte (600 essais)', () => {
  const tirer = hasard(20261015);
  const choisir = (liste) => liste[Math.floor(tirer() * liste.length)];
  const mots = ['Le', 'chakra', 'ne', 's’évapore', 'plus', '+10', 'dégâts', '(IC', 'pour', '3', 'NM)', 'Œuvre', 'à', 'l’ennemi', 'Anticonstitutionnellement',
    '…suite', 'x', '→', 'Magie', 'Dure', '3', 'tours.', '★'];
  let coupes = 0;
  let dansUnMot = 0;
  let sansCoupure = 0;
  for (let essai = 0; essai < 600; essai += 1) {
    // des mots séparés d'une ou deux espaces, d'un saut de ligne (des blancs autour) ou d'une ligne vide ; parfois un seul très long mot
    const t = tirer() < 0.1
      ? 'Z'.repeat(20 + Math.floor(tirer() * 200))
      : Array.from({ length: 1 + Math.floor(tirer() * 60) }, () => choisir(mots)).reduce((acc, m) => (acc ? acc + choisir([' ', ' ', ' ', '  ', '\n', '\n\n', ' \n', '\n ']) + m : m), '');
    const z = zone({ largeur: 30 + tirer() * 200, hauteur: 15 * (1 + Math.floor(tirer() * 4)), taille: choisir([8, 10, 12]), police: choisir(['Calibri', 'Arial']), gras: tirer() < 0.3 });
    const c = couperLeTexte(t, z);
    if (tientDans(t, z)) {
      assert.equal(c, null, 'un texte qui tient ne se coupe pas');
      continue;
    }
    if (!c) {
      sansCoupure += 1; // aucun début ne tient (un premier mot d'une lettre suivi d'un saut de ligne dans une case d'une ligne…)
      continue;
    }
    coupes += 1;
    assert.equal(tientDans(c.debut, z), true, 'le début tient');
    assert.ok(c.debut.endsWith(FIN_COUPEE) || c.debut.endsWith(FIN_COUPEE_DANS_UN_MOT));
    if (!c.debut.endsWith(FIN_COUPEE)) dansUnMot += 1;
    assert.ok(!c.suite.includes('\n') && c.suite === c.suite.trim() && c.suite.length > 0, 'la suite tient sur une ligne');
    assert.equal(recollerLeTexte(c.debut, c.suite), t, JSON.stringify({ t, c }));
  }
  assert.ok(coupes > 200 && dansUnMot > 10 && sansCoupure < coupes / 20, `${coupes} coupés, dont ${dansUnMot} dans un mot ; ${sansCoupure} sans coupure possible`);
});

test('coupure : au dernier blanc qui tient ; suite encodée, blancs gardés ; recollage refusé si la case a été réécrite', () => {
  const t = 'Permet d’invoquer des non-morts (voir invocation)\nIC\n\nNiveau 1 : 3 CK';
  const z = zone({ largeur: largeurDuTexte('Permet d’invoquer des …', 10) + 2.5 });
  const c = couperLeTexte(t, z);
  assert.deepEqual(c, { debut: 'Permet d’invoquer des …', suite: 'non-morts (voir invocation) ⏎ IC ⏎  ⏎ Niveau 1 : 3 CK' });
  assert.equal(recollerLeTexte(c.debut, c.suite), t);
  // coupé devant un saut de ligne : la suite commence par ⏎
  const d = couperLeTexte('Première ligne\nseconde', zone({ largeur: largeurDuTexte('Première ligne …', 10) + 2.5 }));
  assert.deepEqual(d, { debut: 'Première ligne …', suite: '⏎ seconde' });
  assert.equal(recollerLeTexte(d.debut, d.suite), 'Première ligne\nseconde');
  // un « … » écrit dans le texte ne gêne pas ; entre deux espaces, on coupe à la seconde (la suite relue perdrait l'autre)
  const e = couperLeTexte('aaaa …bbbb cccc', zone({ largeur: largeurDuTexte('aaaa …', 10) + 2.5 }));
  assert.deepEqual(e, { debut: 'aaaa …', suite: '…bbbb cccc' });
  const f = couperLeTexte('aa bb  cc dd', zone({ largeur: largeurDuTexte('aa bb  …', 10) + 2.5 }));
  assert.deepEqual(f, { debut: 'aa bb  …', suite: 'cc dd' });
  // les blancs autour d'un saut de ligne sont gardés
  const g = couperLeTexte('un deux \n  trois\n', zone({ largeur: largeurDuTexte('un …', 10) + 2.5 }));
  assert.deepEqual(g, { debut: 'un …', suite: 'deux  ⏎   trois ⏎' });
  assert.equal(recollerLeTexte(g.debut, g.suite), 'un deux \n  trois\n');
  for (const [x, t] of [[e, 'aaaa …bbbb cccc'], [f, 'aa bb  cc dd']]) assert.equal(recollerLeTexte(x.debut, x.suite), t);
  assert.equal(couperLeTexte(`a ${SAUT_DANS_LA_SUITE} b`.repeat(40), zone()), null, 'un texte qui contient déjà ⏎ ne se coupe pas');
  assert.equal(couperLeTexte('abcdef', zone({ largeur: 1 })), null, 'même « … » ne tient pas');
  assert.equal(encoderLaSuite(' a \nb\t\n c '), 'a  ⏎ b\t ⏎  c');
  assert.equal(recollerLeTexte('Texte réécrit', 'la suite'), null);
  assert.equal(recollerLeTexte('Mot coupé…', 'suite fin'), 'Mot coupésuite fin');
});

test('suite relue : « ⏎ » tolère les espaces repliées autour de lui (un tableur qui replie les blancs d’une case)', () => {
  // une ligne vide dans la part coupée : « ⏎  ⏎ » à l'écriture, « ⏎ ⏎ » une fois les deux espaces repliées
  const t = 'Forge de ses mains une lame\n\nPuis la trempe\n\n\ndans le sang';
  const c = couperLeTexte(t, zone({ largeur: largeurDuTexte('Forge de ses …', 10) + 2.5 }));
  assert.equal(c.suite, 'mains une lame ⏎  ⏎ Puis la trempe ⏎  ⏎  ⏎ dans le sang');
  assert.equal(recollerLeTexte(c.debut, c.suite), t);
  assert.equal(recollerLeTexte(c.debut, c.suite.replace(/ {2,}/g, ' ')), t, 'espaces repliées');
  // « ⏎ » sans espace, en tête, en fin : un saut de ligne chacun
  assert.equal(recollerLeTexte('a …', 'b⏎c ⏎d⏎ e'), 'a b\nc\nd\ne');
  assert.equal(recollerLeTexte('a …', '⏎ ⏎ b'), 'a\n\nb');
  assert.equal(recollerLeTexte('a …', 'b ⏎'), 'a b\n');
  // les blancs voisins d'un saut de ligne restent exacts quand rien n'est replié
  for (const x of ['un deux \n  trois\n', 'a \n\n b', 'x\n \ny']) {
    const d = couperLeTexte(x, zone({ largeur: largeurDuTexte('un …', 10) + 2.5 }));
    if (d) assert.equal(recollerLeTexte(d.debut, d.suite), x, JSON.stringify(x));
  }
});

test('part relue (`lu`) : seule sa fin non montrée fait une suite, qui se recolle en elle seule ; une coupure au-delà n’en a pas', () => {
  const relu = 'Composition : Acier\nEffet en plus : Gravée au nom de sa mère';
  const t = `${relu}\nUn effet du catalogue, assez long pour déborder de la case, que le site refait`;
  const deux = zone({ largeur: 400, hauteur: 30 });
  // la case montre les deux lignes relues : coupée juste après, ou dans la part affichée, sans suite
  const c = couperLeTexte(t, deux, { lu: relu.length });
  assert.deepEqual(c, { debut: `${relu} …`, suite: null });
  assert.notEqual(couperLeTexte(t, deux).suite, null, 'sans `lu`, tout le texte est relu');
  const large = couperLeTexte(t, zone({ largeur: largeurDuTexte('Effet en plus : Gravée au nom de sa mère', 10) + 3, hauteur: 45 }), { lu: relu.length });
  assert.equal(large.suite, null);
  assert.ok(large.debut.startsWith(`${relu}\nUn effet`), large.debut);
  // une ligne seulement : la suite ne porte que le reste de la part relue ; recollée, elle redonne cette part
  const une = couperLeTexte(t, zone({ largeur: 400 }), { lu: relu.length });
  assert.deepEqual(une, { debut: 'Composition : Acier …', suite: '⏎ Effet en plus : Gravée au nom de sa mère' });
  assert.equal(recollerLeTexte(une.debut, une.suite), relu);
  // rien de relu : jamais de suite
  assert.deepEqual(ajusterLeTexte(t, zone({ largeur: 400 }), { lu: 0 }).suite, null);
  assert.equal(ajusterLeTexte(t, zone({ largeur: 400 }), { lu: 0 }).texte, 'Composition : Acier …');
  assert.equal(ajusterLeTexte(t, zone({ largeur: 400, hauteur: 30, lignes: 2 }), { lu: relu.length }).suite, null);
  // le début d'un texte coupé, sans sa fin
  assert.equal(sansLaCoupure('Composition : Acier …'), 'Composition : Acier');
  assert.equal(sansLaCoupure('Anticonstitution…'), 'Anticonstitution');
  assert.equal(sansLaCoupure('Rien de coupé'), null);
});

test('ajuster : retour à la ligne d’une case de plusieurs rangées, réduction au besoin d’une case d’une rangée (jusqu’à ECHELLE_MIN), puis coupure', () => {
  const texte = 'Un texte assez long pour deux lignes';
  const largeur = largeurDuTexte(texte, 10) / 1.6;
  // plusieurs rangées sans retour : le retour suffit
  assert.deepEqual(ajusterLeTexte(texte, zone({ largeur, hauteur: 30, lignes: 2, retour: false })), { texte, alignement: { retour: true }, suite: null });
  // plusieurs rangées avec retour, trop court : coupé, sans changer l'alignement
  const long = `${texte} ${texte} ${texte}`;
  const r = ajusterLeTexte(long, zone({ largeur, hauteur: 30, lignes: 2 }));
  assert.equal(r.alignement, null);
  assert.equal(recollerLeTexte(r.texte, r.suite), long);
  // une rangée : réduit tant qu'il garde ECHELLE_MIN de sa taille
  const juste = largeurDuTexte(texte, 10) * ECHELLE_MIN + 2.5;
  assert.deepEqual(ajusterLeTexte(texte, zone({ largeur: juste })), { texte, alignement: { retour: false, reduire: true }, suite: null });
  // au-delà : la police à ECHELLE_MIN de sa taille (la réduction minimale), puis coupé à cette taille
  const c = ajusterLeTexte(texte, zone({ largeur: juste / 1.5 }));
  assert.deepEqual(c.alignement, { retour: false, reduire: true, echelle: ECHELLE_MIN });
  assert.ok(c.suite && recollerLeTexte(c.texte, c.suite) === texte);
  assert.ok(tientDans(c.texte, zone({ largeur: (juste / 1.5) / ECHELLE_MIN, retour: false })), 'le début tient à cette taille');
  // un saut de ligne dans une rangée : coupé au saut (la case n'en montre qu'une ligne) ; ce début tiendrait à la taille entière, il prend
  // quand même la réduction minimale (une colonne de sorts garde une taille de texte homogène)
  const s = ajusterLeTexte('+5AP\nAugmente les AP', zone({ largeur: 400 }));
  assert.deepEqual(s, { texte: '+5AP …', alignement: { retour: false, reduire: true, echelle: ECHELLE_MIN }, suite: '⏎ Augmente les AP' });
  const affichee = ajusterLeTexte('+5AP\nAugmente les AP', zone({ largeur: 400 }), { lu: 0 });
  assert.deepEqual(affichee, { ...s, suite: null }, 'une case affichée (rien de relu) : même taille, sans suite');
  // ce qui tient ne bouge pas ; une case réduite par le modèle non plus
  assert.deepEqual(ajusterLeTexte('court', zone()), { texte: 'court', alignement: null, suite: null });
  assert.deepEqual(ajusterLeTexte(long, zone({ reduire: true, retour: false, largeur: 10 })), { texte: long, alignement: null, suite: null });
});

test('zones du modèle stocké : fusion entière en points, police, retour à la ligne, réduction ; les cases couvertes n’en ont pas', async () => {
  const zones = await zonesDuClasseur(await modeleXlsx());
  const colonne = pointsDeLaColonne(2.86);
  assert.equal(colonne, 15, 'la colonne de 2,86 caractères : 20 pixels, 15 points (règle d’Excel)');
  const pick = (a) => {
    const z = zones.get(a);
    return z && { colonnes: z.colonnes, lignes: z.lignes, largeur: z.largeur, hauteur: z.hauteur, police: z.police, taille: z.taille, gras: z.gras, retour: z.retour, reduire: z.reduire };
  };
  assert.deepEqual(pick('I4'), { colonnes: 3, lignes: 2, largeur: 3 * colonne, hauteur: 30, police: 'Calibri', taille: 10, gras: false, retour: false, reduire: false });
  assert.deepEqual(pick('L43'), { colonnes: 14, lignes: 2, largeur: 14 * colonne, hauteur: 30, police: 'Calibri', taille: 8, gras: false, retour: false, reduire: false });
  assert.deepEqual(pick('C43'), { colonnes: 6, lignes: 2, largeur: 6 * colonne, hauteur: 30, police: 'Calibri', taille: 12, gras: false, retour: false, reduire: true });
  assert.deepEqual(pick('AM55'), { colonnes: 12, lignes: 1, largeur: 12 * colonne, hauteur: 15, police: 'Arial', taille: 10, gras: false, retour: true, reduire: false });
  assert.deepEqual(pick('AQ21'), { colonnes: 9, lignes: 4, largeur: 9 * colonne, hauteur: 60, police: 'Calibri', taille: 10, gras: true, retour: true, reduire: false });
  assert.deepEqual(pick('BA54'), { colonnes: 25, lignes: 20, largeur: 25 * colonne, hauteur: 300, police: 'Calibri', taille: 10, gras: false, retour: true, reduire: false });
  for (const couverte of ['J4', 'I5', 'AN55', 'BY73', 'AR30']) assert.equal(zones.get(couverte), undefined, couverte);
  assert.equal(zones.get('AY55')?.colonnes, 1);
});
