// Notes de cellule de la famille « annexes-magie » (tools/sheets/annexes-magie.py : altérations d'état, météo, mode hyper (magie),
// statistiques, listes des effets des modes hyper et super).
//
// État des sources (contrôlé dans le .xlsx de « Magie Maverick V8 » et dans celui de « Mode hyper et co ») : AUCUN de ces onglets ne porte
// de note (le petit commentaire jaune, champ `note` du dump). Quatre cellules y portent un commentaire, toutes des FILS de commentaires
// (champ `threads`, conversation Google Sheets) et non des notes : Sommaire!A1 (26 fils orphelins), Statistiques!BH27 et AR52 (compteurs),
// Mode Hyper (Magie)!M43 (déjà repris dans la page, section « Commentaire de cellule »). Le classeur « Mode hyper et co » n'a aucun commentaire.
// Il n'existe donc pas de note réelle à citer dans ce périmètre : les pages réelles doivent n'en porter aucune (premier groupe de tests),
// et le mécanisme est éprouvé sur des dumps synthétiques qui reprennent des textes de notes réels de l'autre classeur (second groupe),
// pour le jour où une note apparaîtra dans l'un de ces onglets.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('../../tools/sheets/annexes-magie.py', import.meta.url));
const wikiGuide = fileURLToPath(new URL('../src/content/wiki/guide', import.meta.url));
const python = spawnSync('python3', ['-I', '-c', 'pass']);
const sansPython = python.status !== 0 && 'python3 absent';

const MARQUEUR = '**Note de la cellule « ';
const PAGES = [
  'liste-des-alterations-d-etat',
  'meteo',
  'mode-hyper-magie',
  'statistiques-resistance-faiblesse',
  'liste-des-effets-mode-hyper',
  'liste-des-effets-mode-super',
];
const lire = (dossier, page) => readFileSync(join(dossier, `${page}.md`), 'utf8');
const nbNotes = (texte) => texte.split(MARQUEUR).length - 1;

// ---------------------------------------------------------------------------------------------------------------------------------
// Pages réelles
// ---------------------------------------------------------------------------------------------------------------------------------

test('pages réelles : le périmètre annexes-magie ne porte aucune note de cellule (aucune dans les classeurs), 6 pages présentes', () => {
  for (const page of PAGES) {
    assert.ok(existsSync(join(wikiGuide, `${page}.md`)), `${page} : page absente`);
    assert.equal(nbNotes(lire(wikiGuide, page)), 0, `${page} : une note de cellule est rendue alors que le classeur n'en a pas`);
  }
});

test('pages réelles : le fil de commentaire M43 de « Mode Hyper (Magie) » (résolu) reste cité, tel que le classeur l’écrit', () => {
  const page = lire(wikiGuide, 'mode-hyper-magie');
  assert.match(page, /^## Commentaire de cellule$/m);
  assert.ok(
    page.includes(
      '- **Vide + Nécromancie** (cellule M43) : Sous cette forme, il est impossible de faire des dégâts physiques et seules les armes spectrales sont utilisables ainsi que les sorts.',
    ),
  );
  assert.ok(page.includes('*Commentaire joint à la cellule dans le classeur d\'origine, marqué comme résolu.*'));
});

// ---------------------------------------------------------------------------------------------------------------------------------
// Dumps synthétiques (format de tools/sheets/xlsx_to_json.py ; les textes des notes sont ceux de notes réelles de « Magie V8 »)
// ---------------------------------------------------------------------------------------------------------------------------------

const N = {
  type: 'Peut prendre un tour de concentration pour donner un bonus de +10 dégâts.',
  stade: "Si coup critique avec une arme sous ce sort, oblige un jet de vigueur pour ne pas prendre Saignement au stade 1",
  paire: 'Ne marche pas si c\'est la barrière qui encaisse le coup',
  nom: 'Les ennemis peuvent se défendre contre le coup du sablier.',
  description: "Exemple : \n\nUn caillou c'est taille 1\nUne dague c'est taille 2\n\nLes bombes ne font pas les dégâts de zone.",
  effets: "- Inutile contre les infirmités, la fatigue physique, les croix.\n- Ne marche pas sur les effets magie niveau 3 ou plus",
  meteo: 'Bien entendu on est pas bloqué à vie, il est possible d\'en sortir avec un jet d\'athlétisme/équilibre.',
  seule: "Donne un effet négatif selon la santé restante :\n\n1 : Inflige *saignement 1\n2 : Met une croix en Force pour 1 tour",
  combi: 'Ne peut pas être relancer.',
  avantages: 'Si la cible possède le don "grande créature" : C\'est le lanceur qui est attiré.',
  mono: 'La cible doit saigner. La carapace est fixée au sol.',
  stat: 'Cette arme est considérée comme Spectrale.',
  texteHyper: 'Chaque niveau de puissance de la créature invoqué double de le coût précédent pour l\'invoquer.',
  monoHyper: 'Ne se cumule avec "Rune Arcane multiple"',
  raceHyper: 'Peut être contrer par "Téléportation"',
  texteSuper: 'L\'ombre reste 3 tours.',
  objetSuper: 'Corps de Maverium : Tout les dégâts reçu sont réduit à 0.',
};

const feuille = (name, cells, { merged = [], state = 'visible' } = {}) => ({
  name,
  state,
  merged,
  cells: cells.map(([r, c, v, extra]) => ({ r, c, v, ...extra })),
});
const avecNote = (texte) => ({ note: texte });

// colonnes : A=1 B=2 C=3 D=4 E=5 F=6 G=7 H=8 M=13 N=14 P=16 S=19 T=20 Y=25 AA=27 AI=35
function magieV8({ notes = true, extra = [] } = {}) {
  const n = (texte) => (notes ? avecNote(texte) : undefined);
  return {
    sheets: [
      feuille('Sommaire', [[1, 1, 'Sommaire']]),
      feuille('Sang', [[1, 14, 'Sang'], [13, 62, 'Un effet', n("Note d'un onglet de magie : elle relève de magies.py")]]),
      feuille(
        'Altération détats',
        [
          [1, 1, "Liste des altérations d'état"],
          [2, 1, 'Nom'], [2, 2, 'Magie Liée'], [2, 3, 'Type'], [2, 4, 'Stade 1'], [2, 5, 'Stade 2'], [2, 6, 'Stade 3'], [2, 7, 'Résistances/Vulnérabilités'],
          [3, 1, 'Saignement'], [3, 2, 'Sang'], [3, 3, 'Physique', n(N.type)],
          [3, 4, 'Perd 1 PV'], [3, 5, 'Perd 2 PV', n(N.stade)], [3, 6, 'Perd 3 PV'],
          [3, 7, 'Sensibilité'], [3, 8, 'Dégâts +10%', n(N.paire)],
          [4, 7, 'Résistances'], [4, 8, 'Dégâts -10%'],
          [8, 1, 'Brûlure', n(N.nom)], [8, 2, 'Feu'], [8, 3, 'Magique'], [8, 4, 'Perd 1 PV'], [8, 7, 'Sensibilité'], [8, 8, 'Dégâts +20%'],
        ],
        { merged: ['A3:A7', 'A8:A12'] },
      ),
      feuille('Météo', [
        [1, 2, 'Météo'], [1, 8, 'Description'], [1, 20, 'Effet(s)'],
        [2, 2, 'Pluie'], [2, 8, 'Il pleut.', n(N.description)], [2, 20, '- Effet un\n- Effet deux', n(N.effets)],
        [9, 2, 'Soleil', n(N.meteo)], [9, 8, 'Il fait beau.'], [9, 20, '- Chaud'],
      ]),
      feuille(
        'Mode Hyper (Magie)',
        [
          [1, 8, 'Sang'], [1, 13, 'Effet du sang', n(N.seule)],
          [2, 8, 'Eau'], [2, 13, "Effet de l'eau"],
          [15, 2, 'Sang'], [15, 7, '+'], [15, 8, 'Eau'], [15, 13, 'Effet bi', n(N.combi)],
          [1, 20, 'Avantages de base'], [2, 20, 'Texte général', n(N.avantages)],
          [5, 20, 'Mono magie'], [6, 20, 'Texte mono', n(N.mono)], [5, 24, 'Bi magie'], [6, 24, 'Texte bi'],
        ],
        { state: 'hidden' },
      ),
      feuille('Statistiques', [
        [10, 44, 12],
        [40, 6, 'Résistance Faiblesse'],
        [41, 2, 'Sang'], [41, 7, '+'], [41, 8, 'Eau'], [41, 14, 'D.Résistance'], [41, 19, '='], [41, 20, 'AUCUNE'],
        [42, 14, 'Résistance'], [42, 19, '='], [42, 20, 'Feu'], [42, 25, 'Terre', n(N.stat)],
        [43, 14, 'Faiblesse'], [43, 19, '='], [43, 20, 'Vent'],
        [44, 14, 'D.Faiblesse'], [44, 19, '='], [44, 20, 'AUCUNE'],
        [47, 2, 'Sang'], [47, 7, '+'], [47, 8, 'Feu'], [47, 14, 'D.Résistance'], [47, 19, '='], [47, 20, 'AUCUNE'],
        [48, 14, 'Résistance'], [48, 19, '='], [48, 20, 'Eau'],
        [49, 14, 'Faiblesse'], [49, 19, '='], [49, 20, 'Terre'],
        [50, 14, 'D.Faiblesse'], [50, 19, '='], [50, 20, 'AUCUNE'],
      ]),
      ...extra,
    ],
  };
}

function modeHyper({ notes = true, extra = [] } = {}) {
  const n = (texte) => (notes ? avecNote(texte) : undefined);
  return {
    sheets: [
      feuille('Mode Hyper', [
        [1, 1, 'Liste des effets mode hyper'],
        [1, 27, 'Le Mode Hyper est un état de surpuissance. Texte explicatif.', n(N.texteHyper)],
        [2, 1, 'Magie/Type'], [2, 6, 'Mono magie'], [2, 16, 'Bi magie'],
        [3, 1, 'Sang'], [3, 6, 'Effet mono sang', n(N.monoHyper)], [3, 16, 'Effet bi sang'],
        [6, 1, 'Race'], [6, 6, 'Effet'],
        [7, 1, 'Humain'], [7, 6, 'Effet humain', n(N.raceHyper)],
      ]),
      feuille('Mode Super', [
        [1, 1, 'Liste des effets mode super'],
        [1, 35, "C'est un équivalent du mode hyper mais en moins puissant. Texte explicatif.", n(N.texteSuper)],
        [2, 1, 'Objet'], [2, 6, 'Effets mode super'], [2, 20, 'Description/apparence'],
        [3, 1, 'Épée'], [3, 6, 'Effet épée', n(N.objetSuper)], [3, 20, 'Apparence épée'],
      ]),
      ...extra,
    ],
  };
}

// Chaque entrée : page, section (intertitre `## …` ou null = tout le corps), bloc Markdown exact attendu, texte de la note (dump).
const ATTENDUES = [
  ['liste-des-alterations-d-etat', '## Saignement', `**Note de la cellule « Type »** : ${N.type}`],
  ['liste-des-alterations-d-etat', '## Saignement', `**Note de la cellule « Stade 2 »** : ${N.stade}`],
  ['liste-des-alterations-d-etat', '## Saignement', `**Note de la cellule « Sensibilité »** : ${N.paire}`],
  ['liste-des-alterations-d-etat', '## Brûlure', `**Note de la cellule « Nom »** : ${N.nom}`],
  [
    'meteo',
    '## Pluie',
    "**Note de la cellule « Description »**\n\nExemple :\n\nUn caillou c'est taille 1<br>\nUne dague c'est taille 2\n\nLes bombes ne font pas les dégâts de zone.",
  ],
  [
    'meteo',
    '## Pluie',
    '**Note de la cellule « Effet(s) »**\n\n- Inutile contre les infirmités, la fatigue physique, les croix.\n- Ne marche pas sur les effets magie niveau 3 ou plus',
  ],
  ['meteo', '## Soleil', `**Note de la cellule « Météo »** : ${N.meteo}`],
  [
    'mode-hyper-magie',
    '## Effets par magie seule',
    '**Note de la cellule « Effet (Sang) »**\n\nDonne un effet négatif selon la santé restante :\n\n1 : Inflige \\*saignement 1<br>\n2 : Met une croix en Force pour 1 tour',
  ],
  ['mode-hyper-magie', '## Effets par combinaison de deux magies', `**Note de la cellule « Effet (Sang + Eau) »** : ${N.combi}`],
  ['mode-hyper-magie', '## Avantages de base', `**Note de la cellule « Avantages de base »** : ${N.avantages}`],
  ['mode-hyper-magie', '## Avantages de base', `**Note de la cellule « Mono magie »** : ${N.mono}`],
  ['statistiques-resistance-faiblesse', null, `**Note de la cellule « Résistance (Sang + Eau) : Terre »** : ${N.stat}`],
  ['liste-des-effets-mode-hyper', null, `**Note de la cellule « AA1 »** : ${N.texteHyper}`],
  ['liste-des-effets-mode-hyper', '## Effets selon la magie ou le type', `**Note de la cellule « Mono magie (Sang) »** : ${N.monoHyper}`],
  ['liste-des-effets-mode-hyper', '## Effets selon la race', `**Note de la cellule « Effet (Humain) »** : ${N.raceHyper}`],
  ['liste-des-effets-mode-super', null, `**Note de la cellule « AI1 »** : ${N.texteSuper}`],
  ['liste-des-effets-mode-super', '## Objets', `**Note de la cellule « Effets mode super (Épée) »** : ${N.objetSuper}`],
];
// Notes du dump dans le périmètre (celle de l'onglet « Sang » relève de magies.py : elle n'est pas rendue ici).
const TOTAL = ATTENDUES.length;

function section(texte, intertitre) {
  if (intertitre === null) return texte;
  const lignes = texte.split('\n');
  const debut = lignes.indexOf(intertitre);
  assert.ok(debut >= 0, `intertitre « ${intertitre} » absent`);
  let fin = lignes.length;
  for (let i = debut + 1; i < lignes.length; i += 1) if (lignes[i].startsWith('## ')) { fin = i; break; }
  return lignes.slice(debut, fin).join('\n');
}

function preparer({ v8 = magieV8(), hyper = modeHyper() } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'annexes-notes-'));
  writeFileSync(join(dir, 'magie-v8.json'), JSON.stringify(v8));
  writeFileSync(join(dir, 'mode-hyper.json'), JSON.stringify(hyper));
  return { dir, out: join(dir, 'wiki'), dumps: [join(dir, 'magie-v8.json'), join(dir, 'mode-hyper.json')] };
}
function lancer(ctx, args = []) {
  const r = spawnSync('python3', ['-I', script, ...ctx.dumps.flatMap((d) => ['--dump', d]), '--out', ctx.out, ...args], { encoding: 'utf8' });
  return r;
}
const pagesEcrites = (ctx) => (existsSync(join(ctx.out, 'guide')) ? readdirSync(join(ctx.out, 'guide')) : []);

test('notes : chacune est écrite dans la section de sa cellule, « Note de la cellule « intitulé » : texte », texte intégral', { skip: sansPython }, () => {
  const ctx = preparer();
  const r = lancer(ctx);
  assert.equal(r.status, 0, r.stderr);
  for (const [page, intertitre, bloc] of ATTENDUES) {
    const texte = section(lire(join(ctx.out, 'guide'), page).split('\n---\n')[1], intertitre);
    assert.equal(texte.split(bloc).length - 1, 1, `${page} ${intertitre ?? ''} : bloc attendu exactement une fois :\n${bloc}\n---\n${texte}`);
  }
});

test('notes : le nombre de notes rendues est celui du dump (hors onglets de magie), une par cellule, aucune de plus', { skip: sansPython }, () => {
  const ctx = preparer();
  assert.equal(lancer(ctx).status, 0);
  const total = PAGES.reduce((somme, page) => somme + nbNotes(lire(join(ctx.out, 'guide'), page)), 0);
  assert.equal(total, TOTAL);
  const parPage = Object.fromEntries(PAGES.map((p) => [p, nbNotes(lire(join(ctx.out, 'guide'), p))]));
  assert.deepEqual(parPage, {
    'liste-des-alterations-d-etat': 4,
    meteo: 3,
    'mode-hyper-magie': 4,
    'statistiques-resistance-faiblesse': 1,
    'liste-des-effets-mode-hyper': 3,
    'liste-des-effets-mode-super': 2,
  });
});

test('notes : seules des lignes de notes sont ajoutées aux pages (le reste est identique à la page sans notes)', { skip: sansPython }, () => {
  const avec = preparer();
  const sans = preparer({ v8: magieV8({ notes: false }), hyper: modeHyper({ notes: false }) });
  assert.equal(lancer(avec).status, 0);
  assert.equal(lancer(sans).status, 0);
  for (const page of PAGES) {
    let texte = lire(join(avec.out, 'guide'), page);
    for (const [p, , bloc] of ATTENDUES) if (p === page) texte = texte.replace(`${bloc}\n\n`, '').replace(`\n\n${bloc}\n`, '\n');
    assert.equal(texte, lire(join(sans.out, 'guide'), page), `${page} : autre chose que des notes a changé`);
  }
});

test('notes : relancé, le script n’écrit plus rien (idempotent) ; une note identique sur deux cellules est écrite deux fois', { skip: sansPython }, () => {
  const ctx = preparer();
  assert.equal(lancer(ctx).status, 0);
  const second = lancer(ctx);
  assert.equal(second.status, 0, second.stderr);
  assert.equal(second.stdout.split('\n').filter((l) => l.startsWith('écrit')).length, 0, second.stdout);
  assert.equal(second.stdout.split('\n').filter((l) => l.startsWith('inchangé')).length, 6);
  const v8 = magieV8();
  const meteo = v8.sheets.find((s) => s.name === 'Météo');
  meteo.cells.find((c) => c.r === 9 && c.c === 8).note = N.meteo; // même texte que la note de B9
  const double = preparer({ v8 });
  assert.equal(lancer(double).status, 0);
  const meteoPage = lire(join(double.out, 'guide'), 'meteo');
  assert.equal(meteoPage.split(`« Description »** : ${N.meteo}`).length - 1, 1);
  assert.equal(meteoPage.split(`« Météo »** : ${N.meteo}`).length - 1, 1);
  assert.equal(meteoPage.split(N.meteo).length - 1, 2);
  assert.equal(lancer(double, ['--verifier']).status, 0);
  modifierPage(double, 'meteo', (t) => t.replace(`« Météo »** : ${N.meteo}\n\n`, ''));
  const perdu = lancer(double, ['--verifier']);
  assert.notEqual(perdu.status, 0, 'une des deux notes identiques retirée : --verifier doit échouer (autant d’occurrences que de notes)');
  assert.match(perdu.stderr, /meteo.*2 fois.*1 fois/s);
});

test('notes : une note blanche (espaces seulement) n’est pas une note ; une note d’un onglet de magie relève de magies.py', { skip: sansPython }, () => {
  const v8 = magieV8({ notes: false });
  v8.sheets.find((s) => s.name === 'Météo').cells.find((c) => c.r === 2 && c.c === 8).note = '  \n ';
  v8.sheets.find((s) => s.name === 'Sang').cells[1].note = 'Une note de magie';
  const ctx = preparer({ v8, hyper: modeHyper({ notes: false }) });
  const r = lancer(ctx);
  assert.equal(r.status, 0, r.stderr);
  for (const page of PAGES) assert.equal(nbNotes(lire(join(ctx.out, 'guide'), page)), 0, page);
});

test('notes : un début de ligne qui serait du Markdown (« 1. », « # », « > », « + ») est protégé par UNE barre oblique, le texte reste intégral', { skip: sansPython }, () => {
  const texte = 'Règles :\n1. Premier point\n# Pas un titre\n> Pas une citation\n+ Pas une liste\n\nFin avec *étoile*, _tiret_ et a | b.';
  const v8 = magieV8({ notes: false });
  v8.sheets.find((s) => s.name === 'Météo').cells.find((c) => c.r === 2 && c.c === 8).note = texte;
  const ctx = preparer({ v8, hyper: modeHyper({ notes: false }) });
  const r = lancer(ctx);
  assert.equal(r.status, 0, r.stderr);
  const page = lire(join(ctx.out, 'guide'), 'meteo');
  assert.ok(
    page.includes(
      '**Note de la cellule « Description »**\n\nRègles :<br>\n\\1. Premier point<br>\n\\# Pas un titre<br>\n\\> Pas une citation<br>\n\\+ Pas une liste\n\nFin avec \\*étoile\\*, \\_tiret\\_ et a \\| b.',
    ),
    page,
  );
  assert.equal(lancer(ctx, ['--verifier']).status, 0);
});

test('notes : une note qui n’est que le début d’une autre (même page) n’est pas confondue avec elle', { skip: sansPython }, () => {
  const v8 = magieV8({ notes: false });
  const meteo = v8.sheets.find((s) => s.name === 'Météo');
  meteo.cells.find((c) => c.r === 2 && c.c === 2).note = 'Ne se cumule pas.';
  meteo.cells.find((c) => c.r === 2 && c.c === 8).note = 'Ne se cumule pas. Sauf avec le soleil.';
  const ctx = preparer({ v8, hyper: modeHyper({ notes: false }) });
  assert.equal(lancer(ctx).status, 0);
  assert.equal(lancer(ctx, ['--verifier']).status, 0);
  modifierPage(ctx, 'meteo', (t) => t.replace('« Description »** : Ne se cumule pas. Sauf avec le soleil.', '« Description »** : Ne se cumule pas.'));
  assert.notEqual(lancer(ctx, ['--verifier']).status, 0, 'la seconde note tronquée au texte de la première doit être signalée');
});

test('notes : la note du nom d’une altération, écrite juste sous l’intertitre, est retrouvée par --verifier (et signalée si elle disparaît)', { skip: sansPython }, () => {
  const v8 = magieV8({ notes: false });
  v8.sheets.find((s) => s.name === 'Altération détats').cells.find((c) => c.r === 3 && c.c === 1).note = 'Note sur le nom, juste sous le premier intertitre';
  const ctx = preparer({ v8, hyper: modeHyper({ notes: false }) });
  assert.equal(lancer(ctx).status, 0);
  modifierPage(ctx, 'liste-des-alterations-d-etat', (t) => t.replace(/\n\*\*Note de la cellule « Nom »\*\* : .*\n/, '\n'));
  assert.notEqual(lancer(ctx, ['--verifier']).status, 0);
});

// ---------------------------------------------------------------------------------------------------------------------------------
// Refus : rien n'est perdu en silence, rien n'est écrit
// ---------------------------------------------------------------------------------------------------------------------------------

function refus(nom, { v8, hyper, message }) {
  test(`refus : ${nom}`, { skip: sansPython }, () => {
    const ctx = preparer({ v8: v8 ?? magieV8({ notes: false }), hyper: hyper ?? modeHyper({ notes: false }) });
    const r = lancer(ctx);
    assert.notEqual(r.status, 0, 'le script aurait dû s’arrêter');
    assert.match(r.stderr, message, r.stderr);
    assert.deepEqual(pagesEcrites(ctx), [], 'aucune page ne doit être écrite quand une note est refusée');
  });
}
const avec = (builder, nomOnglet, cellule) => {
  const d = builder({ notes: false });
  const f = d.sheets.find((s) => s.name === nomOnglet) ?? d.sheets[d.sheets.push(feuille(nomOnglet, [])) - 1];
  f.cells.push(cellule);
  return d;
};
refus('note sur une cellule vide', {
  v8: avec(magieV8, 'Météo', { r: 30, c: 3, v: '', note: 'Une note sans cellule' }),
  message: /Météo.*C30.*vide.*note/s,
});
refus('note sur une cellule fusionnée non principale (vide) : message qui le dit', {
  v8: (() => {
    const d = avec(magieV8, 'Altération détats', { r: 4, c: 1, v: '', note: 'Note sur une cellule fusionnée' });
    return d;
  })(),
  message: /A4.*vide.*fusionn/s,
});
refus('note dans un onglet que le script ne publie pas (Sommaire)', {
  v8: avec(magieV8, 'Sommaire', { r: 1, c: 1, v: '', note: 'Une note du sommaire' }),
  message: /Sommaire.*ne publie pas/s,
});
refus('note dans un onglet inconnu', {
  hyper: avec(modeHyper, 'Onglet inconnu', { r: 1, c: 1, v: 'x', note: 'Une note' }),
  message: /Onglet inconnu.*ne publie pas/s,
});
refus('note sur une cellule qui n’est reprise par aucune page (sans place prévue)', {
  v8: avec(magieV8, 'Météo', { r: 40, c: 40, v: 'Texte hors tableau', note: 'Une note sans place' }),
  message: /Météo.*sans place.*AN40/s,
});
refus('note sur un compteur de « Statistiques » (hors du tableau publié) : non publié, avec la raison', {
  v8: avec(magieV8, 'Statistiques', { r: 10, c: 44, v: 12, note: 'Une note de compteur', f: undefined }),
  message: /Statistiques.*AR10|Statistiques.*AR/s,
});
refus('note sur la cellule « = » du tableau de Statistiques (cellule non reprise)', {
  v8: avec(magieV8, 'Statistiques', { r: 41, c: 19, v: '=', note: 'Une note sur le signe égal' }),
  message: /Statistiques.*sans place.*S41/s,
});
refus('note sur un texte de mode super non repris', {
  hyper: avec(modeHyper, 'Mode Super', { r: 60, c: 3, v: 'Orphelin', note: 'Une note' }),
  message: /Mode Super.*sans place.*C60/s,
});

// ---------------------------------------------------------------------------------------------------------------------------------
// --verifier : recalcule les notes depuis le dump et les compare aux pages écrites ; rejoue des cas d'erreur
// ---------------------------------------------------------------------------------------------------------------------------------

function verifier(ctx) {
  return lancer(ctx, ['--verifier']);
}
const modifierPage = (ctx, page, fn) => {
  const chemin = join(ctx.out, 'guide', `${page}.md`);
  writeFileSync(chemin, fn(readFileSync(chemin, 'utf8')));
};

test('--verifier : au vert sur les pages générées, n’écrit rien, annonce le décompte des notes et les cas d’erreur rejoués', { skip: sansPython }, () => {
  const ctx = preparer();
  assert.equal(lancer(ctx).status, 0);
  const avant = PAGES.map((p) => lire(join(ctx.out, 'guide'), p));
  const r = verifier(ctx);
  assert.equal(r.status, 0, r.stderr + r.stdout);
  assert.match(r.stdout, new RegExp(`${TOTAL} note\\(s\\)`));
  // 6 onglets publiés x 7 rejeux (cellule vide, sans place, note de contrôle acceptée, 4 altérations de page) + onglet inconnu dans
  // chacun des 2 dumps + onglet Sommaire du classeur V8 : un rejeu qui disparaît change ce nombre.
  assert.match(r.stdout, /45 cas d'erreur rejoués/);
  assert.deepEqual(PAGES.map((p) => lire(join(ctx.out, 'guide'), p)), avant, '--verifier ne doit rien écrire');
});

test('--verifier : une note retirée, dupliquée, tronquée ou altérée dans une page est signalée', { skip: sansPython }, () => {
  const bloc = `**Note de la cellule « Type »** : ${N.type}`;
  const cas = {
    retirée: (t) => t.replace(`${bloc}\n\n`, ''),
    dupliquée: (t) => t.replace(bloc, `${bloc}\n\n${bloc}`),
    tronquée: (t) => t.replace(N.type, N.type.slice(0, 30)),
    altérée: (t) => t.replace('bonus de +10', 'bonus de +11'),
    'en trop': (t) => `${t.trimEnd()}\n\n**Note de la cellule « Type »** : Une note qui n'est pas dans le dump\n`,
  };
  for (const [nom, fn] of Object.entries(cas)) {
    const ctx = preparer();
    assert.equal(lancer(ctx).status, 0);
    modifierPage(ctx, 'liste-des-alterations-d-etat', fn);
    const r = verifier(ctx);
    assert.notEqual(r.status, 0, `note ${nom} : --verifier aurait dû échouer`);
    assert.match(r.stderr, /liste-des-alterations-d-etat/, `note ${nom} : ${r.stderr}`);
    if (nom === 'en trop') assert.match(r.stderr, /la page porte 5 note\(s\) de cellule, le dump en compte 4/);
    if (nom === 'dupliquée') assert.match(r.stderr, /devrait figurer 1 fois.*elle y figure 2 fois/s);
  }
});

test('--verifier : une page dont autre chose qu’une note a changé (une cellule de tableau) est signalée, notes intactes', { skip: sansPython }, () => {
  const ctx = preparer();
  assert.equal(lancer(ctx).status, 0);
  modifierPage(ctx, 'liste-des-alterations-d-etat', (t) => t.replace('Perd 1 PV | Perd 2 PV', 'Perd 9 PV | Perd 2 PV'));
  const r = verifier(ctx);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /liste-des-alterations-d-etat : la page écrite n'est pas celle que le dump produit/);
  assert.doesNotMatch(r.stderr, /devrait figurer/, 'les notes de la page sont intactes');
});

test('--verifier : une page absente est signalée', { skip: sansPython }, () => {
  const ctx = preparer();
  assert.equal(lancer(ctx).status, 0);
  const r = spawnSync('python3', ['-I', script, ...ctx.dumps.flatMap((d) => ['--dump', d]), '--out', join(ctx.dir, 'ailleurs'), '--verifier'], { encoding: 'utf8' });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /meteo : page absente/);
});

test('--verifier : une page qui n’est plus celle que le dump produit (une note de plus dans le dump) est signalée', { skip: sansPython }, () => {
  const ctx = preparer();
  assert.equal(lancer(ctx).status, 0);
  const v8 = magieV8();
  v8.sheets.find((s) => s.name === 'Météo').cells.find((c) => c.r === 9 && c.c === 20).note = 'Une note de plus';
  writeFileSync(ctx.dumps[0], JSON.stringify(v8));
  const r = verifier(ctx);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /meteo/);
});

test('--verifier : sur un dump sans note, passe aussi (0 note), et rejoue les cas d’erreur', { skip: sansPython }, () => {
  const ctx = preparer({ v8: magieV8({ notes: false }), hyper: modeHyper({ notes: false }) });
  assert.equal(lancer(ctx).status, 0);
  const r = verifier(ctx);
  assert.equal(r.status, 0, r.stderr + r.stdout);
  assert.match(r.stdout, /0 note\(s\)/);
  assert.match(r.stdout, /cas d'erreur rejoués/);
});

test('fils de commentaires (champ `threads`) : ils ne sont pas des notes ; ceux des onglets non publiés sont signalés sur la sortie, jamais perdus en silence', { skip: sansPython }, () => {
  const v8 = magieV8({ notes: false });
  v8.sheets.find((s) => s.name === 'Sommaire').cells[0].threads = [{ text: 'Un fil orphelin', done: true }];
  v8.sheets.find((s) => s.name === 'Statistiques').cells.find((c) => c.r === 10 && c.c === 44).threads = [{ text: 'Un fil de compteur', done: true }];
  const ctx = preparer({ v8, hyper: modeHyper({ notes: false }) });
  const r = lancer(ctx);
  assert.equal(r.status, 0, r.stderr);
  for (const page of PAGES) assert.equal(nbNotes(lire(join(ctx.out, 'guide'), page)), 0, page);
  assert.match(r.stdout, /Sommaire.*A1.*1 fil.*non publi/s);
  assert.match(r.stdout, /Statistiques.*AR10.*compteur/s);
});
