// Notes de cellule du classeur « Invocation » dans les pages `bestiaire/` (tools/sheets/invocations.py).
// Une note (le petit commentaire jaune d'une cellule) précise parfois une règle : elle est citée telle quelle, jamais interprétée,
// juste sous la cellule qu'elle commente, avec le libellé « **Note de la cellule « <intitulé de la cellule> »** : <texte> ».
//
// État de la source (contrôlé dans le .xlsx et dans le dump) : UNE seule note dans tout le classeur, onglet « Appel aux golems »,
// cellule G127 (plage fusionnée G127:R128 : les dégâts du Golem de rouage). Il n'y a donc qu'une note réelle à vérifier (premier groupe de
// tests) ; le mécanisme (placement sous chaque sorte de cellule, couverture, --verifier, cas d'erreur) est éprouvé sur un classeur
// SYNTHÉTIQUE de même gabarit (les vrais dumps ne font pas partie du dépôt), dont les notes reprennent des textes de notes réelles
// des autres classeurs (Magie V8, Classes V7).
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';

const script = fileURLToPath(new URL('../../tools/sheets/invocations.py', import.meta.url));
const bestiaire = fileURLToPath(new URL('../src/content/wiki/bestiaire', import.meta.url));
const python = spawnSync('python3', ['-I', '-c', 'pass']);
const sansPython = python.status !== 0 && 'python3 absent';

const CLASSEUR = 'https://docs.google.com/spreadsheets/d/1U56C8wQ2hf19ryTA_t9AeUPsORurift8As6dOEgmNgo/edit';
// 0006 (noms à trancher) a corrigé le nom d'une invocation (« Marionette de lombre » -> « Marionnette de l'ombre ») : les sources citent l'onglet sous son nom du classeur
const ONGLET_DU_CLASSEUR = new Map(JSON.parse(readFileSync(fileURLToPath(new URL('../../data/migrations/0006-orthographe-noms.json', import.meta.url)), 'utf8')).corrections
  .filter((c) => c.table === 'invocation' && c.col === 'nom').map((c) => [c.apres, c.avant]));
const MARQUEUR = '**Note de la cellule « ';
const nbNotes = (texte) => texte.split(MARQUEUR).length - 1;
const lire = (dossier, slug) => readFileSync(join(dossier, `${slug}.md`), 'utf8');
const corps = (texte) => texte.split('\n---\n')[1];
const section = (texte, intertitre) => {
  const lignes = texte.split('\n');
  const debut = lignes.indexOf(`## ${intertitre}`);
  assert.ok(debut >= 0, `intertitre « ${intertitre} » absent`);
  let fin = lignes.length;
  for (let i = debut + 1; i < lignes.length; i += 1) if (lignes[i].startsWith('## ')) { fin = i; break; }
  return lignes.slice(debut + 1, fin).join('\n');
};

// ---------------------------------------------------------------------------------------------------------------------------------
// Pages réelles : l'unique note du classeur
// ---------------------------------------------------------------------------------------------------------------------------------

const famille = readdirSync(bestiaire)
  .filter((f) => f.endsWith('.md'))
  .map((f) => ({ slug: f.slice(0, -3), texte: readFileSync(join(bestiaire, f), 'utf8') }))
  .filter((p) => p.texte.slice(0, 4000).includes(CLASSEUR));

const NOTE_ROUAGE =
  "L'arbalécho est une arme étrange dont les bonus de dégâts ne rentrent pas dans la multiplication et la posture offensive met au max seulement le deuxième dé.";
const DEGATS_ROUAGE = "**Dégâts**\n\nArbalécho - (1d4/NPM)x1d4 dégâts d'estoc (portée 2-11)  \nPoing - 1d10/NPM dégâts de frappe";

test('pages réelles : 66 pages de la famille, une seule note rendue (celle de G127, page du Golem de rouage)', () => {
  assert.equal(famille.length, 66);
  const avecNote = famille.filter((p) => nbNotes(p.texte) > 0);
  assert.deepEqual(avecNote.map((p) => [p.slug, nbNotes(p.texte)]), [['golem-de-rouage', 1]]);
  assert.equal(famille.reduce((somme, p) => somme + nbNotes(p.texte), 0), 1);
  for (const p of famille) assert.ok(!p.texte.includes('**Note de cellule**'), `${p.slug} : ancien libellé « Note de cellule »`);
});

test('pages réelles : la note de « Appel aux golems » G127 est citée sous les dégâts du Golem de rouage, texte intégral', () => {
  const page = lire(bestiaire, 'golem-de-rouage');
  // G127 = ligne 1 + 29 × 4 + 10 (bloc 5, ligne « Dégâts »), colonne G (valeur de la carte de gauche) : la créature de gauche du bloc.
  assert.match(page, /^title: "Golem de rouage"$/m);
  assert.match(page, /^\*\*Autre créature du bloc\*\* : Poupée temporelle$/m);
  assert.match(page, /^\*\*Magie\(s\)\*\* : Terre \+ Espace\/Temps$/m);
  const stats = section(page, 'Statistiques');
  const bloc = `**Note de la cellule « Dégâts »** : ${NOTE_ROUAGE}`;
  assert.equal(stats.split(bloc).length - 1, 1);
  assert.ok(stats.includes(`${DEGATS_ROUAGE}\n\n${bloc}\n\n**Défense**`), stats);
  assert.equal(page.split(NOTE_ROUAGE).length - 1, 1, 'le texte de la note n’est écrit qu’une fois dans la page');
  // l'autre créature du bloc (Poupée temporelle) n'hérite pas de la note de la cellule fusionnée de sa voisine
  assert.equal(nbNotes(lire(bestiaire, 'poupee-temporelle')), 0);
});

// Facultatif (le vrai dump n'est pas dans le dépôt) : INVOCATION_DUMP=<invocation.json produit par xlsx_to_json.py> node --test ...
const dumpReel = process.env.INVOCATION_DUMP;
test('invocations.py --verifier : les pages du dépôt sont celles que le vrai dump produit, la note de G127 retrouvée une fois (INVOCATION_DUMP)', {
  skip: sansPython || (!dumpReel && 'INVOCATION_DUMP non défini (dump hors dépôt)'),
}, () => {
  const wikiRacine = fileURLToPath(new URL('../src/content/wiki', import.meta.url));
  const r = spawnSync('python3', ['-I', script, '--dump', dumpReel, '--out', wikiRacine, '--verifier'], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /66 page\(s\) identiques à ce que le dump produit ; 1 note\(s\) de cellule/);
  assert.match(r.stdout, /Appel aux golems G127 -> « Golem de rouage », « Dégâts »/);
});

// Les deux défauts relevés à la relecture, rejoués sur le vrai dump et une COPIE des vraies pages (le dépôt n'est jamais touché) :
// un dump produit avant la lecture des notes (même classeur, sans le champ `note`) ne doit pas effacer la note de G127, et une ligne
// de la page sans rapport avec la note, altérée, est vue par --verifier.
test('invocations.py sur le vrai dump et une copie des vraies pages : dump sans notes refusé (G127 conservée), ligne altérée vue par --verifier (INVOCATION_DUMP)', {
  skip: sansPython || (!dumpReel && 'INVOCATION_DUMP non défini (dump hors dépôt)'),
}, (t) => {
  const dir = dossierTemporaire('invocations-reel', { t });
  const out = join(dir, 'wiki');
  cpSync(bestiaire, join(out, 'bestiaire'), { recursive: true });
  const pages = join(out, 'bestiaire');
  const instantane = () => Object.fromEntries(readdirSync(pages).map((f) => [f, readFileSync(join(pages, f), 'utf8')]));
  const avant = instantane();
  // dump périmé = le vrai dump sans le champ `note` ; fabriqué en Python : un aller-retour par JSON de Node écrirait 10.0 « 10 » et
  // changerait les pages (le script reproduit les nombres tels que le dump les donne).
  const retire = `import json, sys
d = json.load(open(sys.argv[1], encoding="utf-8"))
for s in d["sheets"]:
    for c in s["cells"]:
        c.pop("note", None)
json.dump(d, open(sys.argv[2], "w", encoding="utf-8"), ensure_ascii=False)`;
  const fabrique = spawnSync('python3', ['-I', '-c', retire, dumpReel, join(dir, 'perime.json')], { encoding: 'utf8' });
  assert.equal(fabrique.status, 0, fabrique.stderr);

  const refus = spawnSync('python3', ['-I', script, '--dump', join(dir, 'perime.json'), '--out', out], { encoding: 'utf8' });
  assert.notEqual(refus.status, 0, 'un dump sans notes ne doit pas effacer la note de G127');
  assert.match(refus.stderr, /bestiaire\/golem-de-rouage\.md : la page « Golem de rouage » porte 1 note\(s\) de cellule, la sortie du dump en porte 0/);
  assert.deepEqual(instantane(), avant, 'aucune page ne doit être touchée');
  assert.equal(nbNotes(avant['golem-de-rouage.md']), 1);
  const diagnostic = spawnSync('python3', ['-I', script, '--dump', join(dir, 'perime.json'), '--out', out, '--verifier'], { encoding: 'utf8' });
  assert.notEqual(diagnostic.status, 0);
  assert.match(diagnostic.stderr, /dump produit sans les notes/);

  // la même copie avec le bon dump : rien à écrire, le garde ne dit rien
  const bon = spawnSync('python3', ['-I', script, '--dump', dumpReel, '--out', out], { encoding: 'utf8' });
  assert.equal(bon.status, 0, bon.stderr);
  assert.match(bon.stdout, /66 pages \(0 écrites, 66 inchangées\)/);
  assert.deepEqual(instantane(), avant);

  // une ligne sans rapport avec la note : « 4 case nage » -> « 5 case nage »
  const chemin = join(pages, 'golem-de-rouage.md');
  writeFileSync(chemin, avant['golem-de-rouage.md'].replace('4 case nage', '5 case nage'));
  const altere = spawnSync('python3', ['-I', script, '--dump', dumpReel, '--out', out, '--verifier'], { encoding: 'utf8' });
  assert.notEqual(altere.status, 0);
  assert.match(altere.stderr, /golem-de-rouage : la page écrite n'est pas celle que le dump produit/);
});

// ---------------------------------------------------------------------------------------------------------------------------------
// Classeur synthétique de même gabarit (format de tools/sheets/xlsx_to_json.py)
// ---------------------------------------------------------------------------------------------------------------------------------

const BLOC = 29;
const GAUCHE = 4;
const DROITE = 20;
const ONGLETS = {
  G: { nom: 'Appel aux golems', blocs: 15, duo: true, bandeau: 36, titre: 'INVOCATION GOLEM' },
  A: { nom: 'Animation des morts', blocs: 14, duo: true, bandeau: 42, titre: 'INVOCATION NON-MORT' },
  M: { nom: 'Marionette de lombre', blocs: 5, duo: false, bandeau: 26, titre: 'INVOCATION MARIONETTE' },
};
// Pages qui portent un alias dans le script (ALIASES) : le script exige qu'elles existent et que l'alias figure dans la description.
const SPECIAUX = {
  G1g: ['Golem de cristal', 'Un golem translucide. Surnommé aussi le “Chasseur invisible”.'],
  G1d: ['Poupée sacré', 'La Poupée sacrée est une poupée bénie.'],
  G2g: ['Poupée corrompu', 'La Poupée corrompue est une poupée maudite.'],
  G2d: ['Sihouetteur obscur', 'Le Silhouetteur obscur est une créature d’ombre.'],
};
const nom = (code, k, cote) => SPECIAUX[`${code}${k}${cote}`]?.[0] ?? `Créature ${code}${k}${cote}`;
const description = (code, k, cote) => SPECIAUX[`${code}${k}${cote}`]?.[1] ?? `Description de la créature ${code}${k}${cote}. Deuxième phrase.`;
const slugDe = (code, k, cote) => nom(code, k, cote).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const VALEURS = {
  sante: '20/NPM',
  degats: 'Poing - 1d10/NPM dégâts de frappe',
  defense: '3/NPM Armure Physique | 3 Armure Magique',
  vitesse: '4 cases sol / 0 case nage',
  fpvsia: '5/1/10/1/1/1',
};
const capacite = (code, k, cote) => `Capacité ${code}${k}${cote}. Texte de la capacité.`;

function carte(code, k, cote, solo) {
  const r0 = 1 + BLOC * (k - 1);
  const base = cote === 'g' ? GAUCHE : DROITE;
  const cells = [
    [r0, base, nom(code, k, cote)],
    [r0 + 2, base, description(code, k, cote)],
    [r0 + 8, base, 'Santé'], [r0 + 8, base + 3, VALEURS.sante],
  ];
  if (solo) cells.push([r0 + 8, base + 5, 'Barrière'], [r0 + 8, base + 8, '0.0']);
  else cells.push([r0 + 8, base + 5, 'Chakra'], [r0 + 8, base + 8, '0.0'], [r0 + 8, base + 10, 'Barrière'], [r0 + 8, base + 13, '0.0']);
  cells.push(
    [r0 + 10, base, 'Dégâts'], [r0 + 10, base + 3, VALEURS.degats],
    [r0 + 12, base, 'Défense'], [r0 + 12, base + 3, VALEURS.defense],
    [r0 + 14, base, 'Vitesse'], [r0 + 14, base + 3, VALEURS.vitesse],
    [r0 + 16, base, 'FPVSIA'], [r0 + 16, base + 3, VALEURS.fpvsia],
    [r0 + 18, base, 'Capacité(s)'], [r0 + 18, base + 3, capacite(code, k, cote)],
  );
  return cells;
}

function onglet(code) {
  const cfg = ONGLETS[code];
  const cells = [];
  for (let k = 1; k <= cfg.blocs; k += 1) {
    const r0 = 1 + BLOC * (k - 1);
    cells.push([r0 + 12, 1, cfg.duo ? 'Terre\nMono' : `EP${k}`]);
    cells.push(...carte(code, k, 'g', !cfg.duo));
    if (cfg.duo) cells.push(...carte(code, k, 'd', false));
    else cells.push([r0 + 11, 19, 'Effet "Manteau noir"'], [r0 + 12, 19, `Texte de l'effet du palier ${k}.`]);
  }
  cells.push([1, cfg.bandeau, cfg.titre], [3, cfg.bandeau, `Texte général de l'onglet ${cfg.nom}. Deuxième phrase.`]);
  if (code === 'A') {
    cells.push([40, 42, 'AMELIORATION CADAVERIQUE'], [41, 42, 'Sang'], [41, 47, 'Texte du sang'], [42, 42, 'Feu'], [42, 47, 'Texte du feu'], [41, 58, 'Eau'], [41, 63, 'Texte de l’eau']);
  }
  return {
    name: cfg.nom,
    state: 'visible',
    merged: code === 'G' ? ['G127:R128', 'G11:R12'] : [],
    cells: cells.map(([r, c, v]) => ({ r, c, v })),
  };
}
const classeur = () => ({ sheets: [onglet('G'), onglet('A'), onglet('M')] });

/** Pose `note` sur la cellule (ligne, colonne) de l'onglet ; la cellule doit exister. */
function poser(dump, code, r, c, note, champ = 'note') {
  const cellule = dump.sheets.find((s) => s.name === ONGLETS[code].nom).cells.find((x) => x.r === r && x.c === c);
  assert.ok(cellule, `cellule ${code} ${r},${c} absente du classeur synthétique`);
  cellule[champ] = note;
  return dump;
}

// Textes de notes réelles des autres classeurs (Magie V8, Classes V7) ; N3 est celle de G127.
const N = {
  sante: 'Peut prendre un tour de concentration pour donner un bonus de +10 dégâts.',
  chakra: 'Si coup critique avec une arme sous ce sort, oblige un jet de vigueur pour ne pas prendre Peur au stade 1',
  degats: NOTE_ROUAGE,
  defense: "Exemple : \n\nUn caillou c'est taille 1\nUne dague c'est taille 2\n\nLes bombes ne font pas les dégâts de zone.",
  vitesse: "L'ombre reste 3 tours.",
  fpvsia: 'Ne se cumule pas avec "Rune Arcane"',
  capacites: '- Inutile contre les infirmités, la fatigue physique, les croix.\n- Ne marche pas sur les effets magie niveau 3 ou plus',
  degatsDroite: 'Casse la posture si jamais la cible est dans cette dernière.',
  barriere: 'EC = Echec critique',
  capaciteMorts:
    'Un jet de chance est nécessaire pour ne pas prendre la foudre, chaque jet au dessus de 50 se solde par un éclair dans le visage inesquivable et imparable.',
  barriereMarionette: 'Pire ami possède les caractéristiques et compétences de la cible et possède 1/4 de ses PV totaux.',
  capaciteMarionette: "ça n'inclus pas les yeux crevés ou l'aveuglement de naissance.",
};

// Cellules commentées : [onglet, ligne, colonne, texte]. Bloc 3 de « Appel aux golems » = lignes 59 à 87 (r0 = 59), carte de gauche (D) et de droite (T).
const NOTES = [
  ['G', 67, 7, N.sante],            // valeur de Santé (G67)
  ['G', 67, 9, N.chakra],           // libellé Chakra (I67)
  ['G', 69, 7, N.degats],           // valeur de Dégâts
  ['G', 71, 4, N.defense],          // libellé Défense (multi-lignes)
  ['G', 73, 7, N.vitesse],          // valeur de Vitesse
  ['G', 75, 7, N.fpvsia],           // valeur de FPVSIA
  ['G', 77, 7, N.capacites],        // texte de Capacité(s) (liste)
  ['G', 69, 23, N.degatsDroite],    // Dégâts de la carte de droite (W69)
  ['G', 67, 33, N.barriere],        // valeur de Barrière de la carte de droite (AG67)
  ['A', 396, 23, N.capaciteMorts],  // Capacité(s), carte de droite du dernier bloc (r0 = 378)
  ['M', 38, 12, N.barriereMarionette], // Barrière de la marionette du palier 2 (r0 = 30) : pas de ligne Chakra, libellé en I, valeur en L
  ['M', 48, 7, N.capaciteMarionette],  // Capacité(s) de la marionette du palier 2
  ['G', 127, 7, NOTE_ROUAGE],       // la vraie note du classeur, sur la valeur (fusionnée G127:R128) des dégâts de la créature de gauche du bloc 5
];
const avecNotes = (dump = classeur(), notes = NOTES) => {
  for (const [code, r, c, texte] of notes) poser(dump, code, r, c, texte);
  return dump;
};

const note = (intitule, texte) => `**Note de la cellule « ${intitule} »** : ${texte}`;
const BLOC_DEFENSE = `**Note de la cellule « Défense »**\n\nExemple :\n\nUn caillou c'est taille 1  \nUne dague c'est taille 2\n\nLes bombes ne font pas les dégâts de zone.`;
const BLOC_CAPACITES = `**Note de la cellule « Capacité(s) »**\n\n- Inutile contre les infirmités, la fatigue physique, les croix.\n- Ne marche pas sur les effets magie niveau 3 ou plus`;
const LIGNES = {
  degats: `**Dégâts** : ${VALEURS.degats}`,
  defense: `**Défense** : ${VALEURS.defense}`,
  vitesse: `**Vitesse** : ${VALEURS.vitesse}`,
  fpvsia: `**FPVSIA** : ${VALEURS.fpvsia}`,
};

// Chaque entrée : page (slug), section (intertitre `## …`), morceau EXACT de la section : la cellule, puis ses notes dans l'ordre de la page.
const ATTENDUES = [
  [
    slugDe('G', 3, 'g'),
    'Statistiques',
    [
      '| 20/NPM | 0.0 | 0.0 |',
      note('Santé', N.sante),
      note('Chakra', N.chakra),
      LIGNES.degats,
      note('Dégâts', N.degats),
      LIGNES.defense,
      BLOC_DEFENSE,
      LIGNES.vitesse,
      note('Vitesse', N.vitesse),
      LIGNES.fpvsia,
      note('FPVSIA', N.fpvsia),
    ].join('\n\n'),
  ],
  [slugDe('G', 3, 'g'), 'Capacité(s)', [`${capacite('G', 3, 'g')}`, BLOC_CAPACITES].join('\n\n')],
  [
    slugDe('G', 3, 'd'),
    'Statistiques',
    ['| 20/NPM | 0.0 | 0.0 |', note('Barrière', N.barriere), LIGNES.degats, note('Dégâts', N.degatsDroite), LIGNES.defense].join('\n\n'),
  ],
  [slugDe('A', 14, 'd'), 'Capacité(s)', [capacite('A', 14, 'd'), note('Capacité(s)', N.capaciteMorts)].join('\n\n')],
  [slugDe('M', 2, 'g'), 'Statistiques', ['| 20/NPM | 0.0 |', note('Barrière', N.barriereMarionette), LIGNES.degats].join('\n\n')],
  [slugDe('M', 2, 'g'), 'Capacité(s)', [capacite('M', 2, 'g'), note('Capacité(s)', N.capaciteMarionette)].join('\n\n')],
  [slugDe('G', 5, 'g'), 'Statistiques', [LIGNES.degats, note('Dégâts', NOTE_ROUAGE), LIGNES.defense].join('\n\n')],
];
const TOTAL = NOTES.length;
const PAR_PAGE = {
  [slugDe('G', 3, 'g')]: 7,
  [slugDe('G', 3, 'd')]: 2,
  [slugDe('A', 14, 'd')]: 1,
  [slugDe('M', 2, 'g')]: 2,
  [slugDe('G', 5, 'g')]: 1,
};

function preparer(dump = avecNotes()) {
  const dir = dossierTemporaire('invocations-notes');
  writeFileSync(join(dir, 'invocation.json'), JSON.stringify(dump));
  return { dir, out: join(dir, 'wiki'), pages: join(dir, 'wiki', 'bestiaire'), dump: join(dir, 'invocation.json') };
}
function lancer(ctx, args = []) {
  return spawnSync('python3', ['-I', script, '--dump', ctx.dump, '--out', ctx.out, ...args], { encoding: 'utf8' });
}
const fichiers = (ctx) => (existsSync(ctx.pages) ? readdirSync(ctx.pages).filter((f) => f.endsWith('.md')) : []);
/** Contenu de toutes les pages écrites : {fichier: texte}. */
const etat = (ctx) => Object.fromEntries(fichiers(ctx).map((f) => [f, readFileSync(join(ctx.pages, f), 'utf8')]));
/** Même classeur, sans le champ `note` de aucune cellule : un dump produit par un convertisseur antérieur à la lecture des notes. */
const sansNotes = (dump) => {
  for (const feuille of dump.sheets) for (const cellule of feuille.cells) delete cellule.note;
  return dump;
};
function modifierPage(ctx, slug, fn) {
  const chemin = join(ctx.pages, `${slug}.md`);
  const avant = readFileSync(chemin, 'utf8');
  const apres = fn(avant);
  assert.notEqual(apres, avant, `${slug} : la modification de test ne change rien`);
  writeFileSync(chemin, apres);
}

test('synthétique : sans aucune note, 66 pages (63 créatures + 3 introductions), aucun libellé de note', { skip: sansPython }, () => {
  const ctx = preparer(classeur());
  const r = lancer(ctx);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(fichiers(ctx).length, 66);
  assert.equal(fichiers(ctx).reduce((somme, f) => somme + nbNotes(lire(ctx.pages, f.slice(0, -3))), 0), 0);
  assert.equal(lancer(ctx, ['--verifier']).status, 0);
});

test('décision R53 : la marge « EP3 » de l’onglet Marionette (une faute du classeur) s’écrit « NPM 3 » dans les pages ; les autres marges telles quelles', { skip: sansPython }, () => {
  const ctx = preparer(classeur());
  assert.equal(lancer(ctx).status, 0);
  const pages = etat(ctx);
  const texte = Object.values(pages).join('\n');
  assert.doesNotMatch(texte, /\bEP ?\d/, 'aucun « EP » dans les pages');
  const marionnettes = Object.values(pages).filter((t) => t.includes('**Libellé du bloc** : '));
  assert.equal(marionnettes.length, 5);
  assert.deepEqual(marionnettes.map((t) => t.match(/\*\*Libellé du bloc\*\* : (.*)/)[1]).sort(), ['NPM 1', 'NPM 2', 'NPM 3', 'NPM 4', 'NPM 5']);
  const intro = Object.values(pages).find((t) => t.includes('\n- NPM 1 : '));
  assert.ok(intro, 'la page de l’invocation liste ses créatures par NPM');
  assert.ok(texte.includes('**Magie(s)** : Terre Mono'), 'une marge de combinaison reste telle qu’écrite');
});

test('notes : chacune est écrite juste sous sa cellule, « Note de la cellule « intitulé » : texte », texte intégral, une seule fois', { skip: sansPython }, () => {
  const ctx = preparer();
  const r = lancer(ctx);
  assert.equal(r.status, 0, r.stderr);
  for (const [slug, intertitre, morceau] of ATTENDUES) {
    const texte = section(lire(ctx.pages, slug), intertitre);
    assert.equal(texte.split(morceau).length - 1, 1, `${slug} « ${intertitre} » : morceau attendu exactement une fois :\n${morceau}\n---\n${texte}`);
  }
});

test('notes : le nombre de notes rendues est celui du dump, par page et au total, aucune de plus', { skip: sansPython }, () => {
  const ctx = preparer();
  assert.equal(lancer(ctx).status, 0);
  const parPage = {};
  for (const f of fichiers(ctx)) {
    const n = nbNotes(lire(ctx.pages, f.slice(0, -3)));
    if (n) parPage[f.slice(0, -3)] = n;
  }
  assert.deepEqual(parPage, PAR_PAGE);
  assert.equal(Object.values(parPage).reduce((a, b) => a + b, 0), TOTAL);
});

test('notes : seules des lignes de notes sont ajoutées aux pages (le reste est identique à la page sans notes)', { skip: sansPython }, () => {
  const avec = preparer();
  const sans = preparer(classeur());
  assert.equal(lancer(avec).status, 0);
  assert.equal(lancer(sans).status, 0);
  assert.deepEqual(fichiers(avec), fichiers(sans));
  for (const f of fichiers(avec)) {
    let texte = lire(avec.pages, f.slice(0, -3));
    // retire chaque bloc de note (une ligne, ou plusieurs paragraphes) : on retire d'abord ceux à plusieurs paragraphes
    for (const bloc of [BLOC_DEFENSE, BLOC_CAPACITES]) texte = texte.replaceAll(`${bloc}\n\n`, '').replaceAll(`\n\n${bloc}\n`, '\n');
    texte = texte.replace(/^\*\*Note de la cellule « [^»]+ »\*\* : .*\n\n/gm, '').replace(/\n\n\*\*Note de la cellule « [^»]+ »\*\* : .*\n$/, '\n');
    assert.equal(texte, lire(sans.pages, f.slice(0, -3)), `${f} : autre chose que des notes a changé`);
  }
});

test('notes : relancé, le script n’écrit plus rien (idempotent) et affiche toujours son bilan', { skip: sansPython }, () => {
  const ctx = preparer();
  const premier = lancer(ctx);
  assert.equal(premier.status, 0, premier.stderr);
  assert.match(premier.stdout, /66 pages \(66 écrites, 0 inchangées\)/);
  const second = lancer(ctx);
  assert.equal(second.status, 0, second.stderr);
  assert.match(second.stdout, /66 pages \(0 écrites, 66 inchangées\)/);
});

test('notes : aucun classeur .xlsx n’est nécessaire (les notes viennent du dump), les anciennes options sont retirées', { skip: sansPython }, () => {
  const ctx = preparer();
  const r = lancer(ctx);
  assert.equal(r.status, 0, r.stderr);
  assert.doesNotMatch(r.stderr, /xlsx/);
  for (const option of ['--xlsx', '--sans-commentaires']) {
    const refus = lancer(ctx, [option, 'x']);
    assert.notEqual(refus.status, 0, `${option} devrait être refusée`);
  }
});

test('notes : une note blanche (espaces seulement) n’est pas une note ; une note identique sur plusieurs cellules est écrite à chaque fois', { skip: sansPython }, () => {
  const dump = classeur();
  poser(dump, 'G', 69, 7, '  \n ');
  poser(dump, 'G', 73, 7, N.vitesse);
  poser(dump, 'G', 75, 7, N.vitesse);
  const ctx = preparer(dump);
  const r = lancer(ctx);
  assert.equal(r.status, 0, r.stderr);
  const page = lire(ctx.pages, slugDe('G', 3, 'g'));
  assert.equal(nbNotes(page), 2);
  assert.ok(page.includes(`${LIGNES.vitesse}\n\n${note('Vitesse', N.vitesse)}\n\n${LIGNES.fpvsia}\n\n${note('FPVSIA', N.vitesse)}`), page);
  assert.equal(lancer(ctx, ['--verifier']).status, 0);
  // deux notes identiques sur le libellé et la valeur d'une même statistique : deux blocs, et --verifier réclame les deux
  const double = classeur();
  poser(double, 'G', 67, 4, N.chakra);
  poser(double, 'G', 67, 7, N.chakra);
  const ctxDouble = preparer(double);
  assert.equal(lancer(ctxDouble).status, 0);
  const pageDouble = lire(ctxDouble.pages, slugDe('G', 3, 'g'));
  assert.equal(pageDouble.split(note('Santé', N.chakra)).length - 1, 2);
  assert.equal(lancer(ctxDouble, ['--verifier']).status, 0);
  modifierPage(ctxDouble, slugDe('G', 3, 'g'), (t) => t.replace(`${note('Santé', N.chakra)}\n\n`, ''));
  const perdu = lancer(ctxDouble, ['--verifier']);
  assert.notEqual(perdu.status, 0, 'une des deux notes identiques retirée : --verifier doit échouer');
  assert.match(perdu.stderr, /attendue 2 fois, trouvée 1 fois/);
});

test('notes : un début de ligne qui serait du Markdown (« 1. », « # », « > », « - ») est protégé, le texte reste intégral', { skip: sansPython }, () => {
  const texte = 'Règles :\n1. Premier point\n# Pas un titre\n> Pas une citation\n+ Pas une liste\n\nFin avec *étoile*, _tiret_ et a | b.';
  const dump = classeur();
  poser(dump, 'G', 69, 7, texte);
  const ctx = preparer(dump);
  const r = lancer(ctx);
  assert.equal(r.status, 0, r.stderr);
  const page = lire(ctx.pages, slugDe('G', 3, 'g'));
  assert.ok(
    page.includes(
      '**Note de la cellule « Dégâts »**\n\nRègles :  \n1\\. Premier point  \n\\# Pas un titre  \n\\> Pas une citation  \n\\+ Pas une liste\n\nFin avec \\*étoile\\*, \\_tiret\\_ et a | b.',
    ),
    page,
  );
  assert.equal(lancer(ctx, ['--verifier']).status, 0);
});

test('notes : une note qui n’est que le début d’une autre (même page) n’est pas confondue avec elle', { skip: sansPython }, () => {
  const dump = classeur();
  poser(dump, 'G', 69, 7, 'Ne se cumule pas.');
  poser(dump, 'G', 71, 7, 'Ne se cumule pas. Sauf avec le soleil.');
  const ctx = preparer(dump);
  assert.equal(lancer(ctx).status, 0);
  assert.equal(lancer(ctx, ['--verifier']).status, 0);
  modifierPage(ctx, slugDe('G', 3, 'g'), (t) => t.replace(note('Défense', 'Ne se cumule pas. Sauf avec le soleil.'), note('Défense', 'Ne se cumule pas.')));
  assert.notEqual(lancer(ctx, ['--verifier']).status, 0, 'la seconde note tronquée au texte de la première doit être signalée');
});

// ---------------------------------------------------------------------------------------------------------------------------------
// Cas d'erreur à la génération : rien n'est écrit
// ---------------------------------------------------------------------------------------------------------------------------------

function arret(nomDuCas, fabriquer, attendu) {
  test(`erreur : ${nomDuCas}`, { skip: sansPython }, () => {
    const ctx = preparer(fabriquer());
    const r = lancer(ctx);
    assert.notEqual(r.status, 0, `le script doit s'arrêter (${nomDuCas})`);
    assert.match(r.stderr, attendu, r.stderr);
    assert.equal(fichiers(ctx).length, 0, 'aucune page ne doit être écrite quand une note n’a pas de place');
  });
}

arret('note sur une cellule vide', () => {
  const dump = classeur();
  dump.sheets[0].cells.push({ r: 2, c: 10, v: '', note: 'Une note' });
  return dump;
}, /J2 .*est vide mais porte une note/);
arret('note sur une cellule d’une plage fusionnée autre que la cellule principale', () => {
  const dump = classeur();
  dump.sheets[0].cells.push({ r: 12, c: 8, v: '', note: 'Une note' }); // H12 dans G11:R12
  return dump;
}, /H12 .*est vide mais porte une note.*plage fusionnée G11:R12/s);
arret('note dans un onglet que le script ne publie pas', () => {
  const dump = classeur();
  dump.sheets.push({ name: 'Onglet caché', state: 'hidden', merged: [], cells: [{ r: 1, c: 1, v: 'x', note: 'Une note' }] });
  return dump;
}, /« Onglet caché ».*ne publie pas/s);
arret('note sur le nom d’une créature (aucune place prévue)', () => poser(classeur(), 'G', 1, 4, 'Une note'), /sans place prévue/);
arret('note sur la description d’une créature (aucune place prévue)', () => poser(classeur(), 'G', 3, 4, 'Une note'), /sans place prévue/);
arret('note sur la marge d’un bloc (aucune place prévue)', () => poser(classeur(), 'G', 13, 1, 'Une note'), /sans place prévue/);
arret('note sur le bandeau d’un onglet (aucune place prévue)', () => poser(classeur(), 'G', 1, 36, 'Une note'), /sans place prévue/);
arret('note sur le texte général d’un onglet (aucune place prévue)', () => poser(classeur(), 'A', 3, 42, 'Une note'), /sans place prévue/);
arret('note sur une ligne du tableau « AMELIORATION CADAVERIQUE » (aucune place prévue)', () => poser(classeur(), 'A', 41, 47, 'Une note'), /sans place prévue/);
arret('note sur le panneau « Effet » de la marionette (aucune place prévue)', () => poser(classeur(), 'M', 42, 19, 'Une note'), /sans place prévue/);
arret('note qui n’est pas un texte', () => poser(classeur(), 'G', 69, 7, 5), /pas un texte/);
arret('fil de commentaires (aucune place prévue)', () => poser(classeur(), 'G', 69, 7, [{ text: 'Une conversation' }], 'threads'), /fil de commentaires/);

// ---------------------------------------------------------------------------------------------------------------------------------
// Contrôle de couverture du script (check_coverage) : appelé directement, sur des pages altérées en mémoire
// ---------------------------------------------------------------------------------------------------------------------------------

const COUVERTURE = `
import importlib.util, sys
spec = importlib.util.spec_from_file_location("invocations", sys.argv[1])
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
raw = mod.read_dumps([sys.argv[2]])
pages, report, placed = mod.build(raw)
degats = next(n for n in placed if n["page"] == sys.argv[3] and n["label"] == "Dégâts")
block = mod.note_block(degats["label"], degats["text"])

def avec(modif):
    return [(t, a, s, modif(x) if t == degats["page"] else x, o) for t, a, s, x, o in pages]

def essai(nom, pages_, placed_):
    try:
        mod.check_coverage(raw, pages_, placed_)
    except ValueError as err:
        print(nom + " => " + str(err))
    else:
        print(nom + " => aucune erreur")

essai("intact", pages, placed)
essai("retiree", avec(lambda x: x.replace(block + "\\n\\n", "", 1)), placed)
essai("dupliquee", avec(lambda x: x.replace(block + "\\n\\n", block + "\\n\\n" + block + "\\n\\n", 1)), placed)
essai("tronquee", avec(lambda x: x.replace(degats["text"], degats["text"][:30], 1)), placed)
essai("ancien-libelle", avec(lambda x: x.replace(block + "\\n\\n", block + "\\n\\n**Note de cellule** : x\\n\\n", 1)), placed)
essai("non-placee", pages, placed[1:])
`;

test('couverture : une note du dump retirée, dupliquée, tronquée ou non placée, ou un ancien libellé, arrête le script (check_coverage)', { skip: sansPython }, () => {
  const ctx = preparer();
  const r = spawnSync('python3', ['-I', '-c', COUVERTURE, script, ctx.dump, nom('G', 3, 'g')], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const lignes = Object.fromEntries(r.stdout.trim().split('\n').map((l) => l.split(' => ')));
  assert.equal(lignes.intact, 'aucune erreur');
  const prefixe = 'contrôle de couverture des notes de cellule : ';
  assert.ok(lignes.retiree.startsWith(prefixe), lignes.retiree);
  assert.match(lignes.retiree, /page « Créature G3g » : note de la cellule Appel aux golems G69 attendue 1 fois, trouvée 0 fois/);
  assert.match(lignes.retiree, /13 note\(s\) dans le dump, 12 écrite\(s\) dans les pages/);
  assert.match(lignes.dupliquee, /attendue 1 fois, trouvée 2 fois/);
  assert.match(lignes.dupliquee, /13 note\(s\) dans le dump, 14 écrite\(s\)/);
  assert.match(lignes.tronquee, /attendue 1 fois, trouvée 0 fois/);
  assert.match(lignes['ancien-libelle'], /ancien libellé « \*\*Note de cellule » encore écrit/);
  assert.match(lignes['non-placee'], /13 note\(s\) dans le dump, 12 placée\(s\) dans les pages/);
});

// ---------------------------------------------------------------------------------------------------------------------------------
// --verifier : contrôle indépendant, n'écrit rien
// ---------------------------------------------------------------------------------------------------------------------------------

test('--verifier : pages conformes, chaque note retrouvée une fois, cas d’erreur rejoués, rien n’est écrit', { skip: sansPython }, () => {
  const ctx = preparer();
  assert.equal(lancer(ctx).status, 0);
  const avant = Object.fromEntries(fichiers(ctx).map((f) => [f, readFileSync(join(ctx.pages, f), 'utf8')]));
  const r = lancer(ctx, ['--verifier']);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, new RegExp(`--verifier : 66 page\\(s\\) identiques à ce que le dump produit ; ${TOTAL} note\\(s\\) de cellule`));
  assert.match(r.stdout, /cas d'erreur rejoués/);
  const apres = Object.fromEntries(fichiers(ctx).map((f) => [f, readFileSync(join(ctx.pages, f), 'utf8')]));
  assert.deepEqual(apres, avant);
});

test('--verifier : sur un dossier sans pages il signale les pages absentes et n’écrit rien', { skip: sansPython }, () => {
  const ctx = preparer();
  const r = lancer(ctx, ['--verifier']);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /page absente/);
  assert.equal(fichiers(ctx).length, 0);
});

const SLUG = slugDe('G', 3, 'g');
const VARIANTES = {
  'note retirée': (t) => t.replace(`${note('Dégâts', N.degats)}\n\n`, ''),
  'note dupliquée': (t) => t.replace(`${note('Dégâts', N.degats)}\n\n`, `${note('Dégâts', N.degats)}\n\n${note('Dégâts', N.degats)}\n\n`),
  'note tronquée': (t) => t.replace(N.degats, N.degats.slice(0, 40)),
  'note altérée': (t) => t.replace('ne rentrent pas', 'ne rentre pas'),
  'note déplacée sous une autre cellule': (t) =>
    t.replace(`${note('Dégâts', N.degats)}\n\n${LIGNES.defense}`, `${LIGNES.defense}\n\n${note('Dégâts', N.degats)}`),
  'note d’une autre cellule recopiée sous le même intitulé': (t) => t.replace(note('Vitesse', N.vitesse), note('Vitesse', N.degats)),
  'note ajoutée sans cellule commentée': (t) => t.replace(LIGNES.degats, `${LIGNES.degats}\n\n${note('Dégâts', 'Une note inventée.')}`),
  'note de plus (libellé ancien)': (t) => t.replace(`${note('Dégâts', N.degats)}\n\n`, `${note('Dégâts', N.degats)}\n\n**Note de cellule** : ${N.degats}\n\n`),
};
for (const [nomDuCas, variante] of Object.entries(VARIANTES)) {
  test(`--verifier : page modifiée (${nomDuCas}) signalée, fichier inchangé`, { skip: sansPython }, () => {
    const ctx = preparer();
    assert.equal(lancer(ctx).status, 0);
    modifierPage(ctx, SLUG, variante);
    const modifiee = readFileSync(join(ctx.pages, `${SLUG}.md`), 'utf8');
    const r = lancer(ctx, ['--verifier']);
    assert.notEqual(r.status, 0, `--verifier doit signaler : ${nomDuCas}`);
    assert.match(r.stderr, new RegExp(SLUG));
    assert.equal(readFileSync(join(ctx.pages, `${SLUG}.md`), 'utf8'), modifiee, '--verifier ne doit rien écrire');
  });
}

test('--verifier : une note perdue par le dump (dump sans note alors que les pages en ont) est signalée, avec la cause probable', { skip: sansPython }, () => {
  const ctx = preparer();
  assert.equal(lancer(ctx).status, 0);
  writeFileSync(ctx.dump, JSON.stringify(classeur()));
  const r = lancer(ctx, ['--verifier']);
  assert.notEqual(r.status, 0, 'les pages portent 13 notes que le dump n’a plus');
  assert.match(r.stderr, /écart/);
  assert.match(r.stderr, /porte 7 note\(s\) de cellule, la sortie du dump en porte 0/, 'le diagnostic « dump périmé » doit nommer la page et les nombres');
  assert.match(r.stderr, /dump produit sans les notes/);
});

test('--verifier : sur le dump, une note placée sans place prévue est refusée avec le même message qu’à la génération', { skip: sansPython }, () => {
  const ctx = preparer();
  assert.equal(lancer(ctx).status, 0);
  writeFileSync(ctx.dump, JSON.stringify(poser(avecNotes(), 'G', 1, 36, 'Une note')));
  const r = lancer(ctx, ['--verifier']);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /sans place prévue/);
});

// ---------------------------------------------------------------------------------------------------------------------------------
// Dump périmé : un dump sans les notes ne doit pas effacer en silence les notes déjà écrites dans les pages
// ---------------------------------------------------------------------------------------------------------------------------------

const PAGES_AVEC_NOTES = { [slugDe('G', 3, 'g')]: 7, [slugDe('G', 3, 'd')]: 2, [slugDe('A', 14, 'd')]: 1, [slugDe('M', 2, 'g')]: 2, [slugDe('G', 5, 'g')]: 1 };

test('dump périmé : un dump sans aucune note (ancien convertisseur) ne retire pas les notes des pages existantes : refus, rien n’est écrit', { skip: sansPython }, () => {
  const ctx = preparer();
  assert.equal(lancer(ctx).status, 0);
  const avant = etat(ctx);
  writeFileSync(ctx.dump, JSON.stringify(sansNotes(avecNotes())));
  const r = lancer(ctx);
  assert.notEqual(r.status, 0, 'le script doit refuser : 13 notes écrites dans les pages disparaîtraient');
  assert.match(r.stderr, /dump produit sans les notes/);
  assert.match(r.stderr, /--accepter-notes-retirees/, 'le message dit comment accepter une suppression voulue');
  for (const [slug, n] of Object.entries(PAGES_AVEC_NOTES)) {
    assert.ok(r.stderr.includes(`bestiaire/${slug}.md : la page`), `${slug} doit être nommée\n${r.stderr}`);
    assert.match(r.stderr, new RegExp(`${slug}\\.md : la page « [^»]+ » porte ${n} note\\(s\\) de cellule, la sortie du dump en porte 0`));
  }
  assert.deepEqual(etat(ctx), avant, 'aucune page ne doit être touchée');
  assert.equal(Object.values(etat(ctx)).reduce((somme, t) => somme + nbNotes(t), 0), TOTAL);
});

test('dump périmé : une seule note de moins dans le dump (7 -> 6 sur une page) est refusée de même, sans rien écrire', { skip: sansPython }, () => {
  const ctx = preparer();
  assert.equal(lancer(ctx).status, 0);
  const avant = etat(ctx);
  const sansSante = avecNotes(classeur(), NOTES.filter(([code, r, c]) => !(code === 'G' && r === 67 && c === 7)));
  writeFileSync(ctx.dump, JSON.stringify(sansSante));
  const r = lancer(ctx);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, new RegExp(`${SLUG}\\.md : la page « [^»]+ » porte 7 note\\(s\\) de cellule, la sortie du dump en porte 6`));
  assert.doesNotMatch(r.stderr, new RegExp(`${slugDe('G', 3, 'd')}\\.md : la page`), 'les pages qui gardent toutes leurs notes ne sont pas citées');
  assert.deepEqual(etat(ctx), avant);
});

test('dump périmé : --accepter-notes-retirees autorise la suppression voulue (note retirée du classeur), le signale et --verifier repasse au vert', { skip: sansPython }, () => {
  const ctx = preparer();
  assert.equal(lancer(ctx).status, 0);
  const sansSante = avecNotes(classeur(), NOTES.filter(([code, r, c]) => !(code === 'G' && r === 67 && c === 7)));
  writeFileSync(ctx.dump, JSON.stringify(sansSante));
  const r = lancer(ctx, ['--accepter-notes-retirees']);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stderr, /AVERTISSEMENT : .*1 note\(s\) de cellule retirée\(s\) des pages/);
  assert.equal(nbNotes(lire(ctx.pages, SLUG)), 6);
  assert.ok(!lire(ctx.pages, SLUG).includes(note('Santé', N.sante)));
  assert.equal(lancer(ctx, ['--verifier']).status, 0);
  // l'option ne change rien quand il n'y a rien à retirer : pas d'avertissement
  const encore = lancer(ctx, ['--accepter-notes-retirees']);
  assert.equal(encore.status, 0, encore.stderr);
  assert.doesNotMatch(encore.stderr, /retirée\(s\) des pages/);
});

test('dump périmé : pas de fausse alerte quand une note change de texte ou qu’une note est ajoutée (le nombre de notes ne baisse pas)', { skip: sansPython }, () => {
  const ctx = preparer();
  assert.equal(lancer(ctx).status, 0);
  const modifie = avecNotes();
  poser(modifie, 'G', 73, 7, "L'ombre reste 4 tours.");                       // texte changé
  poser(modifie, 'G', 77, 4, 'Une note de plus, sur le libellé de Capacité(s).'); // note ajoutée
  writeFileSync(ctx.dump, JSON.stringify(modifie));
  const r = lancer(ctx);
  assert.equal(r.status, 0, r.stderr);
  assert.doesNotMatch(r.stderr, /dump produit sans les notes/);
  assert.equal(nbNotes(lire(ctx.pages, SLUG)), 8);
  assert.ok(lire(ctx.pages, SLUG).includes(note('Vitesse', "L'ombre reste 4 tours.")));
  assert.equal(lancer(ctx, ['--verifier']).status, 0);
});

test('dump périmé : une page à l’ancien libellé « Note de cellule » migre vers le nouveau libellé sans refus (le nombre de notes ne baisse pas)', { skip: sansPython }, () => {
  const ctx = preparer();
  assert.equal(lancer(ctx).status, 0);
  const rouage = slugDe('G', 5, 'g');
  modifierPage(ctx, rouage, (t) => t.replace(`**Note de la cellule « Dégâts »** : ${NOTE_ROUAGE}`, `**Note de cellule** : ${NOTE_ROUAGE}`));
  assert.equal(nbNotes(lire(ctx.pages, rouage)), 0, 'la page est dans l’ancien format');
  const r = lancer(ctx);
  assert.equal(r.status, 0, r.stderr);
  assert.doesNotMatch(r.stderr, /dump produit sans les notes/);
  assert.equal(nbNotes(lire(ctx.pages, rouage)), 1);
  assert.ok(!lire(ctx.pages, rouage).includes('**Note de cellule**'));
  assert.equal(lancer(ctx, ['--verifier']).status, 0);
});

test('dump périmé : sans option, la page à l’ancien libellé « Note de cellule » n’est pas effacée par un dump sans notes', { skip: sansPython }, () => {
  const ctx = preparer();
  assert.equal(lancer(ctx).status, 0);
  const rouage = slugDe('G', 5, 'g');
  modifierPage(ctx, rouage, (t) => t.replace(`**Note de la cellule « Dégâts »** : ${NOTE_ROUAGE}`, `**Note de cellule** : ${NOTE_ROUAGE}`));
  const avant = etat(ctx);
  writeFileSync(ctx.dump, JSON.stringify(sansNotes(avecNotes())));
  const r = lancer(ctx);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, new RegExp(`${rouage}\\.md : la page « [^»]+ » porte 1 note\\(s\\) de cellule, la sortie du dump en porte 0`));
  assert.deepEqual(etat(ctx), avant);
});

test('dump périmé : sur un dossier sans pages (premier import), un dump sans note passe mais avertit que le champ `note` manque partout', { skip: sansPython }, () => {
  const sans = preparer(classeur());
  const r = lancer(sans);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stderr, /AVERTISSEMENT : aucune cellule du dump ne porte de champ `note`/);
  // un dump qui porte des notes n'avertit pas ; un dump dont les cellules ont un champ `note` (même blanc) n'avertit pas non plus
  const avec = lancer(preparer());
  assert.equal(avec.status, 0, avec.stderr);
  assert.doesNotMatch(avec.stderr, /champ `note`/);
  const blanc = lancer(preparer(poser(classeur(), 'G', 69, 7, '  ')));
  assert.equal(blanc.status, 0, blanc.stderr);
  assert.doesNotMatch(blanc.stderr, /champ `note`/);
});

const GARDE = `
import importlib.util, sys
spec = importlib.util.spec_from_file_location("invocations", sys.argv[1])
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
raw = mod.read_dumps([sys.argv[2]])
out = sys.argv[3]
if sys.argv[4] == "neutralisee":
    mod.lost_notes = lambda pages, out_root: []
count, failures = mod.replay_errors(raw, out)
print("cas=%d" % count)
for f in failures:
    print("ECART " + f)
`;

test('--verifier rejoue le cas « dump périmé » : si la garde est neutralisée, le rejeu le signale (replay_errors)', { skip: sansPython }, () => {
  const ctx = preparer();
  assert.equal(lancer(ctx).status, 0);
  const sain = spawnSync('python3', ['-I', '-c', GARDE, script, ctx.dump, ctx.out, 'normale'], { encoding: 'utf8' });
  assert.equal(sain.status, 0, sain.stderr);
  assert.doesNotMatch(sain.stdout, /ECART/, sain.stdout);
  const casSains = Number(sain.stdout.match(/cas=(\d+)/)[1]);
  const casse = spawnSync('python3', ['-I', '-c', GARDE, script, ctx.dump, ctx.out, 'neutralisee'], { encoding: 'utf8' });
  assert.equal(casse.status, 0, casse.stderr);
  assert.match(casse.stdout, /ECART rejeu « dump périmé »/, casse.stdout);
  assert.equal(Number(casse.stdout.match(/cas=(\d+)/)[1]), casSains);
});

// ---------------------------------------------------------------------------------------------------------------------------------
// Le reste de la page : la suite sans dump ne regarde que les notes ; c'est --verifier (avec le dump) qui garde chaque autre ligne
// ---------------------------------------------------------------------------------------------------------------------------------
// Les pages réelles sont écrites par le script et le dump n'est pas dans le dépôt (docs/sources.md : les JSON et .xlsx se régénèrent) ;
// une empreinte des pages dans le dépôt interdirait les retouches voulues (statut `verified`) et le maillage `npm run autolink`.
// Ces tests épinglent donc l'outil qui fait ce contrôle quand le dump est là : --verifier voit toute ligne qui change, disparaît ou s'ajoute.

const AUTRES_LIGNES = {
  'valeur de Vitesse changée': [SLUG, (t) => t.replace(LIGNES.vitesse, '**Vitesse** : 5 cases sol / 0 case nage')],
  'ligne Défense supprimée': [SLUG, (t) => t.replace(`${LIGNES.defense}\n\n`, '')],
  'ligne ajoutée en fin de page': [SLUG, (t) => `${t}\nUne ligne ajoutée à la main.\n`],
  'description altérée': [SLUG, (t) => t.replace('Deuxième phrase.', 'Deuxième phrases.')],
  'tableau des statistiques altéré': [SLUG, (t) => t.replace('| 20/NPM | 0.0 | 0.0 |', '| 21/NPM | 0.0 | 0.0 |')],
  'en-tête (summary) altéré': [SLUG, (t) => t.replace(/^summary: .*$/m, 'summary: "Autre résumé."')],
  'page d’une autre créature (sans note) altérée': [slugDe('A', 3, 'g'), (t) => t.replace(LIGNES.fpvsia, '**FPVSIA** : 9/9/9/9/9/9')],
  'page d’introduction altérée': ['appel-aux-golems', (t) => t.replace('Texte général', 'Texte généra1')],
};
for (const [nomDuCas, [slug, variante]] of Object.entries(AUTRES_LIGNES)) {
  test(`--verifier : ligne sans rapport avec les notes (${nomDuCas}) signalée, fichier inchangé`, { skip: sansPython }, () => {
    const ctx = preparer();
    assert.equal(lancer(ctx).status, 0);
    modifierPage(ctx, slug, variante);
    const modifiee = readFileSync(join(ctx.pages, `${slug}.md`), 'utf8');
    const r = lancer(ctx, ['--verifier']);
    assert.notEqual(r.status, 0, `--verifier doit signaler : ${nomDuCas}`);
    assert.match(r.stderr, new RegExp(`${slug} : la page écrite n'est pas celle que le dump produit`));
    assert.equal(readFileSync(join(ctx.pages, `${slug}.md`), 'utf8'), modifiee, '--verifier ne doit rien écrire');
  });
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Pages réelles SANS dump : la forme des 66 pages et leur cohérence entre elles
// ---------------------------------------------------------------------------------------------------------------------------------
// `npm test` et la CI n'ont pas le dump (il se régénère depuis le classeur, il n'est pas dans le dépôt) : la VALEUR d'une ligne de page
// (une Vitesse, un chiffre du tableau, un mot de la description) ne se compare qu'à lui, par --verifier (tests INVOCATION_DUMP plus
// haut) ; sans dump, rien ne peut la contrôler. Une empreinte des pages dans le dépôt n'est pas la réponse : elle interdirait les
// retouches voulues (statut `verified`, docs/sources.md) et `npm run autolink`. Ce qui se contrôle sans dump, pour toute page encore au
// statut `draft` (donc telle que le script l'a écrite) : sa FORME (ordre et présence des lignes étiquetées, des sections, du tableau,
// en-tête) et la COHÉRENCE entre pages (chaque créature listée par l'introduction de son onglet, une seule fois, avec la bonne marge et
// la bonne « autre créature du bloc », réciproque). Une ligne supprimée, dupliquée, déplacée, renommée ou une page qui manque est donc
// vue par `npm test` et la CI ; seule une valeur changée en gardant la forme exige le dump.

const ETIQUETTES = {
  Invocation: 'I', 'Magie(s)': 'M', 'Libellé du bloc': 'B', 'Autre créature du bloc': 'A',
  Dégâts: 'G', Défense: 'F', Vitesse: 'V', FPVSIA: 'P', "En-tête de l'onglet": 'H',
};
const SECTIONS = { Description: 'd', Statistiques: 'S', 'Capacité(s)': 'C', 'Texte général': 'g', Créatures: 'c' };
// Forme d'une page, une lettre par bloc (les paragraphes de texte qui se suivent comptent pour un : 't'), notes de cellule exclues
// (leur place est vérifiée par les tests de notes). I : « Invocation », M / B : marge, A : autre créature, d : Description,
// S : Statistiques, T : tableau, G F V P : Dégâts, Défense, Vitesse, FPVSIA, C : Capacité(s), E : section d'effet,
// H : en-tête d'onglet, g : Texte général, c : Créatures.
const FORMES = {
  duo: /^IMAdtSTGt?Ft?Vt?Pt?Ct$/,
  solo: /^IBdtSTGt?Ft?Vt?Pt?CtEt$/,
  introduction: /^Hgtct(ET)?$/,
};
const CLES_ENTETE = ['title', 'aliases', 'tags', 'summary', 'sources', 'status'];

const sansLiens = (s) => s.replace(/\[\[[^\]|]*\|([^\]]*)\]\]/g, '$1').replace(/\[\[([^\]]*)\]\]/g, '$1');
const sansEchappement = (s) => s.replace(/\\(.)/g, '$1');

function decouper(texte) {
  const i = texte.indexOf('\n---\n', 4);
  return { entete: texte.slice(4, i), corps: texte.slice(i + 5).replace(/^\n+/, '') };
}
const statutDe = (texte) => decouper(texte).entete.match(/^status: (.*)$/m)?.[1];
const titreDe = (texte) => JSON.parse(decouper(texte).entete.match(/^title: (.*)$/m)[1]);

function formeDe(corps) {
  let forme = '';
  for (const p of sansLiens(corps).trim().split(/\n\n+/)) {
    const tete = p.split('\n')[0];
    let lettre = 't';
    if (p.startsWith('| ')) lettre = 'T';
    else if (tete.startsWith('## ')) lettre = SECTIONS[tete.slice(3)] ?? 'E';
    else {
      const m = tete.match(/^\*\*([^*]+)\*\*/);
      if (m && m[1].startsWith('Note de la cellule')) continue;
      if (m) lettre = ETIQUETTES[m[1]] ?? 'x';
    }
    if (lettre === 't' && forme.endsWith('t')) continue;
    forme += lettre;
  }
  return forme;
}

const ligneEtiquetee = (corps, etiquette) => sansLiens(corps).match(new RegExp(`^\\*\\*${etiquette.replace(/[()]/g, '\\$&')}\\*\\* : (.*)$`, 'm'))?.[1];

/** Écarts de forme et de cohérence d'un ensemble de pages {slug, texte} de la famille : liste de textes (vide si tout va bien). */
function problemesStructure(pages) {
  const problemes = [];
  const fiches = pages.map((p) => {
    const { entete, corps } = decouper(p.texte);
    const nette = sansLiens(corps);
    return { slug: p.slug, entete, corps, titre: titreDe(p.texte), brouillon: statutDe(p.texte) === 'draft', introduction: nette.startsWith("**En-tête de l'onglet**") };
  });
  const parTitre = new Map();
  for (const f of fiches) parTitre.set(f.titre, [...(parTitre.get(f.titre) ?? []), f]);
  for (const [titre, memes] of parTitre) if (memes.length > 1) problemes.push(`titre « ${titre} » porté par ${memes.length} pages (${memes.map((f) => f.slug).join(', ')})`);

  // 1. forme de chaque page encore au statut `draft`
  for (const f of fiches.filter((x) => x.brouillon)) {
    const forme = formeDe(f.corps);
    const genre = f.introduction ? 'introduction' : forme.startsWith('IB') ? 'solo' : 'duo';
    if (!FORMES[genre].test(forme)) problemes.push(`${f.slug} : forme « ${forme} » inattendue pour une page « ${genre} »`);
    const cles = [...f.entete.matchAll(/^([a-z]+): /gm)].map((m) => m[1]);
    if (cles.join() !== CLES_ENTETE.filter((c) => c !== 'summary' || cles.includes('summary')).join()) problemes.push(`${f.slug} : clés d'en-tête ${cles.join(', ')}`);
    const onglet = f.introduction ? f.titre : ligneEtiquetee(f.corps, 'Invocation')?.match(/^(.*) \(onglet du classeur « Invocation »\)$/)?.[1];
    const sources = f.entete.match(/^sources: (.*)$/m)?.[1] ?? '';
    if (!onglet || !sources.includes(CLASSEUR) || !sources.includes(`onglet « ${ONGLET_DU_CLASSEUR.get(onglet) ?? onglet} »`)) problemes.push(`${f.slug} : sources ${sources || '(absentes)'} ne désignent pas le classeur et l'onglet « ${onglet} »`);
    if (!f.introduction) {
      const tableau = sansLiens(f.corps).split(/\n\n+/).find((p) => p.startsWith('| '));
      const lignes = (tableau ?? '').split('\n');
      const cellules = lignes.map((l) => l.split(/(?<!\\)\|/).length - 2);
      if (lignes.length !== 3 || new Set(cellules).size !== 1) problemes.push(`${f.slug} : tableau des statistiques de ${lignes.length} ligne(s), cellules ${cellules.join('/')}`);
    }
  }

  // 2. cohérence : chaque introduction liste les créatures de son onglet, chaque créature est listée une seule fois
  const listees = new Map();
  for (const intro of fiches.filter((x) => x.introduction)) {
    const liste = sansLiens(intro.corps).split(/\n## /).find((b) => b.startsWith('Créatures\n'));
    for (const ligne of (liste ?? '').split('\n').filter((l) => l.startsWith('- '))) {
      const [, marge, noms] = ligne.match(/^- (.*) : (.*)$/) ?? [];
      const creatures = (noms ?? '').split(', ').map(sansEchappement);
      if (!noms || creatures.length > 2) { problemes.push(`introduction « ${intro.titre} » : ligne de bloc illisible « ${ligne} »`); continue; }
      creatures.forEach((nom, i) => {
        const trouvees = parTitre.get(nom) ?? [];
        if (!trouvees.length) { problemes.push(`introduction « ${intro.titre} » : la créature « ${nom} » n'a pas de page`); return; }
        for (const page of trouvees) {
          listees.set(page.slug, [...(listees.get(page.slug) ?? []), intro.titre]);
          if (!page.brouillon) continue;
          const onglet = ligneEtiquetee(page.corps, 'Invocation')?.replace(/ \(onglet du classeur « Invocation »\)$/, '');
          if (onglet !== intro.titre) problemes.push(`${page.slug} : « ${nom} » est listée par l'introduction « ${intro.titre} » mais la page dit « ${onglet} »`);
          const sienne = ligneEtiquetee(page.corps, 'Magie(s)') ?? ligneEtiquetee(page.corps, 'Libellé du bloc');
          if (sienne !== marge) problemes.push(`${page.slug} : marge « ${sienne} » de la page, « ${marge} » dans l'introduction « ${intro.titre} »`);
          const autre = ligneEtiquetee(page.corps, 'Autre créature du bloc');
          const attendue = creatures.length === 2 ? creatures[1 - i] : undefined;
          if (autre === undefined ? attendue !== undefined : sansEchappement(autre) !== attendue) problemes.push(`${page.slug} : « autre créature du bloc » ${autre === undefined ? 'absente' : `« ${sansEchappement(autre)} »`}, l'introduction « ${intro.titre} » liste ${attendue ?? 'aucune autre créature'} avec « ${nom} »`);
        }
      });
    }
  }
  for (const f of fiches.filter((x) => !x.introduction)) {
    const intros = listees.get(f.slug) ?? [];
    if (intros.length !== 1) problemes.push(`page « ${f.titre} » (${f.slug}, onglet « ${ligneEtiquetee(f.corps, 'Invocation')?.replace(/ \(onglet du classeur « Invocation »\)$/, '')} ») listée ${intros.length} fois par les introductions${intros.length ? ` (${intros.join(', ')})` : ' (aucune)'}, une seule attendue`);
  }
  return problemes;
}

test('pages réelles, sans dump : les 66 pages ont la forme que le script écrit et sont cohérentes entre elles', () => {
  assert.deepEqual(problemesStructure(famille), []);
});

const tel = (slug, fn) => famille.map((p) => (p.slug === slug ? { ...p, texte: fn(p.texte) } : p));
const DEFENSE_ROUAGE = '**Défense** : 2/NPM Armure Physique | 2 Armure Magique';
const VITESSE_ROUAGE = '**Vitesse** : 4 cases sol / 4 cases nage';
const ALTERATIONS = {
  'ligne Défense supprimée': [() => tel('golem-de-rouage', (t) => t.replace(`${DEFENSE_ROUAGE}\n\n`, '')), /golem-de-rouage/],
  'lignes Défense et Vitesse échangées': [() => tel('golem-de-rouage', (t) => t.replace(`${DEFENSE_ROUAGE}\n\n${VITESSE_ROUAGE}`, `${VITESSE_ROUAGE}\n\n${DEFENSE_ROUAGE}`)), /golem-de-rouage/],
  'ligne FPVSIA dupliquée': [() => tel('golem-de-rouage', (t) => t.replace(/^\*\*FPVSIA\*\* : .*$/m, (l) => `${l}\n\n${l}`)), /golem-de-rouage/],
  'libellé « Vitesse » renommé': [() => tel('golem-de-rouage', (t) => t.replace('**Vitesse** :', '**Vitesses** :')), /golem-de-rouage/],
  'section « Description » renommée': [() => tel('golem-de-rouage', (t) => t.replace('## Description', '## Résumé')), /golem-de-rouage/],
  'section « Capacité(s) » supprimée': [() => tel('golem-de-rouage', (t) => t.slice(0, t.indexOf('## Capacité(s)')).trimEnd() + '\n'), /golem-de-rouage/],
  'tableau des statistiques privé d’une cellule': [() => tel('golem-de-rouage', (t) => t.replace('| 20/NPM | 0.0 | 0.0 |', '| 20/NPM | 0.0 |')), /golem-de-rouage/],
  'tableau des statistiques privé de sa ligne': [() => tel('golem-de-rouage', (t) => t.replace('\n| 20/NPM | 0.0 | 0.0 |', '')), /golem-de-rouage/],
  'en-tête privé de « sources »': [() => tel('golem-de-rouage', (t) => t.replace(/^sources: .*\n/m, '')), /golem-de-rouage/],
  'en-tête qui n’annonce plus le classeur': [() => tel('golem-de-rouage', (t) => t.replace(CLASSEUR, 'https://exemple.invalid/')), /golem-de-rouage/],
  'onglet de la page changé': [() => tel('golem-de-rouage', (t) => t.replace('**Invocation** : Appel aux golems', '**Invocation** : Animation des morts')), /golem-de-rouage/],
  'marge changée': [() => tel('golem-de-rouage', (t) => t.replace('**Magie(s)** : Terre + Espace/Temps', '**Magie(s)** : Terre')), /golem-de-rouage/],
  '« autre créature du bloc » qui n’est pas réciproque': [() => tel('golem-de-rouage', (t) => t.replace('Poupée temporelle', 'Poupée sanglante')), /golem-de-rouage/],
  'créature retirée de la liste de son introduction': [() => tel('appel-aux-golems', (t) => t.replace(', Poupée temporelle', '')), /Poupée temporelle/],
  'ligne de l’introduction effacée': [() => tel('appel-aux-golems', (t) => t.replace(/^- Terre \+ Espace\/Temps : .*\n/m, '')), /Golem de rouage/],
  'page de créature manquante': [() => famille.filter((p) => p.slug !== 'poupee-temporelle'), /Poupée temporelle/],
  'page de créature en double': [() => [...famille, { slug: 'poupee-temporelle-bis', texte: lire(bestiaire, 'poupee-temporelle') }], /Poupée temporelle/],
  'page d’introduction retirée': [() => famille.filter((p) => p.slug !== 'animation-des-morts'), /Animation des morts/],
  'page d’une créature qu’aucune introduction ne liste': [() => [...famille, { slug: 'intruse', texte: lire(bestiaire, 'golem-de-rouage').replace('title: "Golem de rouage"', 'title: "Intruse"') }], /Intruse/],
};
for (const [nomDuCas, [alterer, attendu]] of Object.entries(ALTERATIONS)) {
  test(`pages réelles, sans dump : ${nomDuCas} est vue`, () => {
    const ecarts = problemesStructure(alterer());
    assert.ok(ecarts.length > 0, 'aucun écart signalé');
    assert.match(ecarts.join('\n'), attendu);
  });
}

test('pages réelles, sans dump : liens `[[…]]` posés par `npm run autolink` et page retouchée (statut verified) ne sont pas des écarts', () => {
  const lie = (t) => t.replace('Terre + Espace/Temps', '[[Terre]] + [[Espace/Temps|Espace/Temps]]').replace('Poupée temporelle', '[[Poupée temporelle]]');
  assert.deepEqual(problemesStructure(tel('golem-de-rouage', lie)), []);
  assert.deepEqual(problemesStructure(tel('appel-aux-golems', (t) => t.replace('Golem de rouage', '[[Golem de rouage|Golem de rouage]]'))), []);
  // une page passée à `verified` est une page relue et retouchée à la main : sa forme n'est plus imposée
  const retouchee = tel('golem-de-rouage', (t) => t.replace('status: draft', 'status: verified').replace(`${DEFENSE_ROUAGE}\n\n`, ''));
  assert.deepEqual(problemesStructure(retouchee), []);
});
