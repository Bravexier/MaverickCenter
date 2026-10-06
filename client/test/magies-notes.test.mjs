// Notes de cellule du classeur « Magie Maverick V8 » dans les pages `magies/` (tools/sheets/magies.py).
// Une note (le petit commentaire jaune d'une cellule) précise parfois une règle : elle est citée telle quelle, jamais interprétée,
// sous la table des sorts, avec le libellé « **Note de la cellule « <colonne> » du sort « <sort> »** : <texte> ».
// Les fils de commentaires (conversations « Commentaire » de Google Sheets) suivent le même modèle, après la note de leur cellule.
//
// Deux familles de tests :
//   - le contenu RÉEL des 15 pages (nombre de notes, textes exacts, ordre) ;
//   - l'extracteur lui-même, sur des classeurs SYNTHÉTIQUES (les vrais dumps ne font pas partie du dépôt) : couverture des notes,
//     --verifier, et les cas d'erreur (note sur une cellule vide, dans un onglet non publié, non placée, dupliquée, absente).
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const dossierPages = fileURLToPath(new URL('../src/content/wiki/magies', import.meta.url));
const script = fileURLToPath(new URL('../../tools/sheets/magies.py', import.meta.url));
const SECTION = 'Notes et commentaires des sorts';

// ---------------------------------------------------------------------------------------------------------------------------------
// Lecture d'une page : les entrées de la section des notes
// ---------------------------------------------------------------------------------------------------------------------------------

const page = (slug) => readFileSync(join(dossierPages, `${slug}.md`), 'utf8');
const section = (texte) => texte.split(new RegExp(`^## ${SECTION}\\s*$`, 'm'))[1]?.split(/^## /m)[0] ?? null;
const ETIQUETTE = /^\*\*(Note|Commentaire résolu|Commentaire) de la cellule « (.+?) » du sort « (.+?) »\*\*(?: : (.*))?$/;
const sansEchappement = (s) => s.replace(/\\([\\`*_[\]<~&>#+\-.)])/g, '$1').replace(/<(https?:\/\/[^>\s]+)>/g, '$1');
const norme = (s) => s.replace(/\s+/g, ' ').trim();

/** [{ genre, colonne, sort, texte }] : le texte est ramené à une ligne, sans échappements Markdown. */
function entrees(texte) {
  const corps = section(texte);
  if (corps === null) return [];
  const sortie = [];
  for (const ligne of corps.split('\n')) {
    const m = ETIQUETTE.exec(ligne);
    if (m) sortie.push({ genre: m[1], colonne: m[2], sort: m[3], brut: m[4] ?? '' });
    else if (sortie.length) sortie.at(-1).brut += `\n${ligne}`;
  }
  return sortie.map(({ brut, ...e }) => ({ ...e, texte: norme(sansEchappement(brut)) }));
}

const SLUGS = {
  'potentiel-illimite': 0, 'magie-du-sang': 8, 'magie-de-larcane': 6, 'magie-de-la-corruption': 7, 'magie-de-lespace-temps': 11,
  'magie-du-vide': 9, 'magie-de-la-necromancie': 6, 'magie-du-feu': 2, 'magie-de-leau': 3, 'magie-de-la-glace': 5,
  'magie-de-la-terre': 7, 'magie-du-vent': 4, 'magie-de-la-foudre': 4, 'magie-de-la-lumiere': 4, 'magie-de-lombre': 9,
};

// ---------------------------------------------------------------------------------------------------------------------------------
// Contenu réel des pages
// ---------------------------------------------------------------------------------------------------------------------------------

test('les 85 notes de cellule du classeur « Magie V8 » sont dans les pages, réparties comme dans le classeur', () => {
  let total = 0;
  for (const [slug, attendu] of Object.entries(SLUGS)) {
    const notes = entrees(page(slug)).filter((e) => e.genre === 'Note');
    assert.equal(notes.length, attendu, `${slug} : nombre de notes`);
    total += notes.length;
  }
  assert.equal(total, 85);
});

test('chaque note est citée avec son texte intégral, sous le sort dont la cellule « Effets secondaires » la porte', () => {
  // [page, cellule d'origine, sort, texte de la note tel que le classeur l'écrit]
  const reelles = [
    ['magie-du-sang', 'BJ13', 'Annulation', "- Inutile contre les infirmités, la fatigue physique, les croix.\n- Ne marche pas sur les effets magie niveau 3 ou plus\n- Soigne d'un cran les altérations d'états."],
    ['magie-du-sang', 'BJ16', 'Attirance', 'Si la cible possède le don "grande créature" ou est logiquement trop grosse ou lourde : C\'est le lanceur qui est attiré.'],
    ['magie-de-larcane', 'BJ16', 'Forge-Magie', "Exemple : \n\nUn caillou c'est taille 1\nUne dague c'est taille 2\n\nLes bombes ne font pas les dégâts de zone."],
    ['magie-de-lespace-temps', 'BJ7', 'Téléportation', "Ne provoque pas d'attaque d'opportunité.\n\nCe sort permet également de contrer les ennemis qui voudraient se téléporter, pour que ça marche : il est nécessaire d’avoir le sort, de sacrifier une parade/esquive, de réussir un meilleur jet et que l’ennemi soit dans la portée du sort.\n\nSi la case d'arrivée est occupée par une autre créature, le lanceur échange immédiatement sa position avec celle-ci (si elle est de la même taille approximativement que lui)"],
    ['magie-de-la-glace', 'BJ28', 'Lien de gel', "3NM = Inflige 4 dégâts perce AM lors du lien de gel.\n\nLe lien gel touche la cible et lui bloque les mains pendant 1 tour, le tour suivant le lien de gel se propage vers autant d'adversaires disponible. La cible est ainsi libérer mais peut se reprendre le lien de gel si jamais il est à côté d'un autre qui a le lien de gel et ainsi de suite..."],
    ['magie-de-la-glace', 'BJ43', 'Gel profond', " l'allié sera aussi dispensé de jet de survie pendant cet état."],
    ['magie-de-la-lumiere', 'BJ25', 'Énergie Solaire', '10% lors de neutre\n20% lors de grand soleil.\n25% lors de canicule.'],
    ['magie-de-la-foudre', 'BJ43', 'Dysfonctionnement', 'C\'est un équivalent de "Confusion 3" pour les créature mécaniques.'],
    ['magie-de-la-terre', 'BJ70', 'Corps de Maverium', 'Corps de Maverium : Tout les dégâts reçu sont réduit à 0 et les effets négatifs sur les protections ne fonctionne pas.'],
    ['magie-de-lombre', 'BJ40', 'Amplification sombre', 'EC = Echec critique'],
  ];
  assert.ok(reelles.length >= 5);
  for (const [slug, cellule, sort, texte] of reelles) {
    const trouvees = entrees(page(slug)).filter((e) => e.genre === 'Note' && e.sort === sort);
    assert.equal(trouvees.length, 1, `${slug} ${cellule} (${sort}) : une note attendue`);
    assert.equal(trouvees[0].colonne, 'Effets secondaires', `${slug} ${cellule}`);
    assert.equal(trouvees[0].texte, norme(texte), `${slug} ${cellule} (${sort}) : texte`);
  }
});

test('le libellé est « Note de la cellule « … » du sort « … » », sur la ligne ou au-dessus du texte (comme les pages de races)', () => {
  const sang = page('magie-du-sang');
  assert.ok(sang.includes('**Note de la cellule « Effets secondaires » du sort « Attirance »** : Si la cible possède le don "grande créature" ou est logiquement trop grosse ou lourde : C\'est le lanceur qui est attiré.\n'));
  assert.ok(sang.includes([
    '**Note de la cellule « Effets secondaires » du sort « Annulation »**',
    '',
    '- Inutile contre les infirmités, la fatigue physique, les croix.',
    '- Ne marche pas sur les effets magie niveau 3 ou plus',
    "- Soigne d'un cran les altérations d'états.",
    '',
    '**Commentaire résolu de la cellule « Effets secondaires » du sort « Annulation »**',
    '',
    "Inutile contre les infirmités, la fatigue, les croix, les altérations d'états.  ",
    'Ne marche pas sur les effets magie niveau 3 ou plus',
    '',
  ].join('\n')));
  assert.doesNotMatch(sang, /^\*Note :\*$/m, 'plus de « *Note :* » : un seul libellé pour toutes les familles');
});

test('les notes suivent la table des sorts (même ordre qu\'elle), avant les textes de niveau 5 et la légende', () => {
  for (const slug of Object.keys(SLUGS).filter((s) => SLUGS[s] > 0)) {
    const texte = page(slug);
    const titres = [...texte.matchAll(/^## (.+?)\s*$/gm)].map((m) => m[1]);
    assert.ok(titres.indexOf(SECTION) > titres.indexOf('Sorts'), `${slug} : la section des notes suit « Sorts »`);
    for (const suivant of ['Textes des sorts de niveau 5', 'Légende']) {
      if (titres.includes(suivant)) assert.ok(titres.indexOf(suivant) > titres.indexOf(SECTION), `${slug} : « ${suivant} » après les notes`);
    }
    const noms = texte.split(/^## Sorts\s*$/m)[1].split(/^## /m)[0].split('\n').filter((l) => /^\| \d/.test(l)).map((l) => l.split(' | ')[1]);
    const ordre = entrees(texte).map((e) => noms.indexOf(e.sort));
    assert.ok(ordre.length >= SLUGS[slug], `${slug} : les notes sont dans la section`);
    assert.ok(ordre.every((i) => i >= 0), `${slug} : un sort de la table pour chaque note (${ordre})`);
    assert.deepEqual([...ordre].sort((a, b) => a - b), ordre, `${slug} : ordre de la table des sorts`);
  }
});

test('les quatre « Verrouillage » de la Corruption portent la même note, citée quatre fois', () => {
  const identiques = entrees(page('magie-de-la-corruption')).filter((e) => e.texte.startsWith('Si la cible est dans la posture indiquée'));
  assert.deepEqual(identiques.map((e) => e.sort), ['Verrouillage Simple', 'Verrouille Visible', 'Verrouillage Magique', 'Verrouillage Physique']);
  assert.equal(new Set(identiques.map((e) => e.texte)).size, 1);
});

test('les fils de commentaires : un fil identique à la note de sa cellule n\'est pas répété, les autres sont cités', () => {
  const total = Object.keys(SLUGS).flatMap((slug) => entrees(page(slug))).filter((e) => e.genre !== 'Note');
  assert.equal(total.length, 31, 'fils rendus : 61 fils des onglets de magie − 29 identiques à la note de leur cellule − 1 message écarté');
  assert.ok(total.every((e) => e.genre === 'Commentaire résolu'));
  const vide = entrees(page('magie-du-vide')).filter((e) => e.sort === 'Dissipation');
  assert.deepEqual(vide.map((e) => e.genre), ['Note', 'Commentaire résolu']);
  assert.equal(vide[1].texte, 'Les buff niveau 5 ne peuvent pas être annulé par ce sort.');
  // la note de Fer Sanglant a un fil identique : une seule entrée
  assert.deepEqual(entrees(page('magie-du-sang')).filter((e) => e.sort === 'Fer Sanglant').map((e) => e.genre), ['Note']);
  // Corps de Maverium : trois fils, le troisième est identique à la note
  assert.deepEqual(entrees(page('magie-de-la-terre')).filter((e) => e.sort === 'Corps de Maverium').map((e) => e.genre), ['Note', 'Commentaire résolu', 'Commentaire résolu']);
});

test('le message de conversation sans rapport avec les règles (Eau, AN46) est écarté, et déclaré comme tel dans l\'extracteur', () => {
  assert.doesNotMatch(page('magie-de-leau'), /salut viens en vocal/);
  assert.match(readFileSync(script, 'utf8'), /salut viens en vocal stp/);
});

// ---------------------------------------------------------------------------------------------------------------------------------
// L'extracteur sur des classeurs synthétiques
// ---------------------------------------------------------------------------------------------------------------------------------

const MAGIES = [
  ['Potentiel illimité (magie diffi', 'Potentiel illimité', 'Potentiel Illimité', 'potentiel-illimite'],
  ['Sang', 'Magie du Sang', 'Sang', 'magie-du-sang'],
  ['Arcane', "Magie de l'Arcane", 'Arcane', 'magie-de-larcane'],
  ['Corruption', 'Magie de la Corruption', 'Corruption', 'magie-de-la-corruption'],
  ['TempsEspace', "Magie de l'Espace/Temps", 'Espace/Temps', 'magie-de-lespace-temps'],
  ['Vide', 'Magie du Vide', 'Vide', 'magie-du-vide'],
  ['Nécromancie', 'Magie de la Nécromancie', 'Nécromancie', 'magie-de-la-necromancie'],
  ['Feu', 'Magie du Feu', 'Feu', 'magie-du-feu'],
  ['Eau', "Magie de l'Eau", 'Eau', 'magie-de-leau'],
  ['Glace', 'Magie de la Glace', 'Glace', 'magie-de-la-glace'],
  ['Terre', 'Magie de la Terre', 'Terre', 'magie-de-la-terre'],
  ['Vent', 'Magie du Vent', 'Vent', 'magie-du-vent'],
  ['Foudre', 'Magie de la Foudre', 'Foudre', 'magie-de-la-foudre'],
  ['Lumière', 'Magie de la Lumière', 'Lumière', 'magie-de-la-lumiere'],
  ['Ombre', "Magie de l'Ombre", 'Ombre', 'magie-de-lombre'],
];

/** Un onglet minimal : bannière, description, deux sorts (Éclair en ligne 4, Bouclier en ligne 7), cellule « Effets secondaires » en BJ. */
const onglet = ([name, titre]) => ({
  name, state: 'visible', max_row: 9, max_col: 62, validations: [],
  merged: ['A4:AJ4', 'AL4:AM6', 'AL7:AM9'],
  cells: [
    { r: 1, c: 14, v: titre },
    ...[[38, 'Niveau'], [40, 'Nom'], [46, 'Type'], [50, 'Coût'], [53, 'Portée'], [56, 'Zone'], [59, 'D/S/B'], [62, 'Effets secondaires']].map(([c, v]) => ({ r: 3, c, v })),
    { r: 4, c: 1, v: 'Une description.' },
    { r: 4, c: 38, v: 1 }, { r: 4, c: 40, v: 'Éclair' }, { r: 4, c: 62, v: 'Un effet.' },
    { r: 7, c: 38, v: 2 }, { r: 7, c: 40, v: 'Bouclier' }, { r: 7, c: 62, v: 'Un autre effet.' },
  ],
});
const classeur = () => ({ sheets: MAGIES.map(onglet) });
const fiche = () => ({ sheets: [{ name: 'Accessibilité Magie', cells: MAGIES.map((m, i) => ({ r: 1, c: 2 + i, v: m[2] })) }] });
const BJ4 = { r: 4, c: 62 }; // « Effets secondaires » d'Éclair
const BJ7 = { r: 7, c: 62 }; // « Effets secondaires » de Bouclier
const cellule = (dump, nom, { r, c }) => dump.sheets.find((s) => s.name === nom).cells.find((x) => x.r === r && x.c === c);
const ajoute = (dump, nom, cell) => { dump.sheets.find((s) => s.name === nom).cells.push(cell); return dump; };

function lancer({ dump = classeur(), args = ['--sans-formats'], sortie, verifier = false } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'magies-notes-'));
  const out = sortie ?? join(dir, 'wiki');
  mkdirSync(out, { recursive: true });
  writeFileSync(join(dir, 'magie-v8.json'), JSON.stringify(dump));
  writeFileSync(join(dir, 'fiche-auto-v15.json'), JSON.stringify(fiche()));
  const r = spawnSync('python3', ['-I', script, '--dump', join(dir, 'magie-v8.json'), '--fiche', join(dir, 'fiche-auto-v15.json'), '--out', out, ...args, ...(verifier ? ['--verifier'] : [])], { encoding: 'utf8' });
  return { ...r, dir, out, page: (slug) => { const f = join(out, 'magies', `${slug}.md`); return existsSync(f) ? readFileSync(f, 'utf8') : null; } };
}
const verifie = (r, dump, extra = {}) => lancer({ dump, sortie: r.out, verifier: true, ...extra });
const compte = (texte, motif) => texte.split(motif).length - 1;

test('synthétique : une note est écrite sous son sort, le contrôle de couverture et --verifier sont au vert', () => {
  const dump = classeur();
  cellule(dump, 'Sang', BJ4).note = 'Une règle précisée.\n\nEn deux paragraphes.';
  const r = lancer({ dump });
  assert.equal(r.status, 0, r.stderr);
  const sang = r.page('magie-du-sang');
  assert.ok(sang.includes('**Note de la cellule « Effets secondaires » du sort « Éclair »**\n\nUne règle précisée.\n\nEn deux paragraphes.\n'), sang);
  assert.equal(entrees(sang).length, 1);
  assert.match(r.stdout, /1 note/);
  const v = verifie(r, dump);
  assert.equal(v.status, 0, v.stderr);
  assert.match(v.stdout, /vérification : OK/);
});

/** Un classeur dont Sang porte une note sur Éclair et une autre sur Bouclier. */
function avecNotes() {
  const dump = classeur();
  cellule(dump, 'Sang', BJ4).note = 'Première note.';
  cellule(dump, 'Sang', BJ7).note = 'Seconde note, avec *étoiles*, _tirets bas_ et [crochets].';
  return dump;
}

test('synthétique : le texte est cité tel quel, les caractères Markdown sont échappés mais restent lisibles', () => {
  const r = lancer({ dump: avecNotes() });
  assert.equal(r.status, 0, r.stderr);
  const sang = r.page('magie-du-sang');
  assert.ok(sang.includes('**Note de la cellule « Effets secondaires » du sort « Bouclier »** : Seconde note, avec \\*étoiles\\*, \\_tirets bas\\_ et \\[crochets\\].'), sang);
  assert.deepEqual(entrees(sang).map((e) => [e.sort, e.texte]), [['Éclair', 'Première note.'], ['Bouclier', 'Seconde note, avec *étoiles*, _tirets bas_ et [crochets].']]);
});

test('synthétique : deux notes identiques sur deux cellules sont citées deux fois', () => {
  const dump = classeur();
  cellule(dump, 'Sang', BJ4).note = 'Même texte.';
  cellule(dump, 'Sang', BJ7).note = 'Même texte.';
  const r = lancer({ dump });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(entrees(r.page('magie-du-sang')).length, 2);
  assert.equal(verifie(r, dump).status, 0);
});

test('synthétique : un fil identique à la note de sa cellule n\'est pas répété, un autre fil est cité, les réponses d\'état sont ignorées', () => {
  const dump = classeur();
  const c = cellule(dump, 'Sang', BJ4);
  c.note = 'Règle   précisée.';
  c.threads = [
    { text: 'Règle précisée.', done: true, replies: ['Marquée comme fermée', 'Rouverte'] },
    { text: 'Autre précision.' },
    { text: 'Fil résolu.', done: true },
  ];
  const r = lancer({ dump });
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(entrees(r.page('magie-du-sang')).map((e) => [e.genre, e.texte]), [['Note', 'Règle précisée.'], ['Commentaire', 'Autre précision.'], ['Commentaire résolu', 'Fil résolu.']]);
  assert.equal(verifie(r, dump).status, 0);
});

test('synthétique : une vraie réponse dans un fil arrête le script (rien n\'est perdu en silence)', () => {
  const dump = classeur();
  cellule(dump, 'Sang', BJ4).threads = [{ text: 'Question ?', replies: ['Voici la réponse, une règle.'] }];
  const r = lancer({ dump });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /réponse/);
  assert.equal(r.page('magie-du-sang'), null, 'la page n\'est pas écrite');
});

test('synthétique : le message de conversation de l\'Eau (AN46) est écarté, et le reste de la cellule est cité', () => {
  const dump = classeur();
  const eau = dump.sheets.find((s) => s.name === 'Eau');
  eau.merged.push('AL46:AM48');
  eau.cells.push({ r: 46, c: 38, v: 3 }, { r: 46, c: 40, v: 'Eau Parfaite', threads: [{ text: 'salut viens en vocal stp', done: true }, { text: 'Une vraie précision.' }] });
  const r = lancer({ dump });
  assert.equal(r.status, 0, r.stderr);
  const texte = r.page('magie-de-leau');
  assert.doesNotMatch(texte, /salut viens en vocal/);
  assert.deepEqual(entrees(texte).map((e) => [e.colonne, e.sort, e.texte]), [['Nom', 'Eau Parfaite', 'Une vraie précision.']]);
  assert.match(r.stdout, /écarté/);
  assert.equal(verifie(r, dump).status, 0);
});

test('synthétique : l\'exclusion tient à l\'adresse ET au texte : un message modifié, ou le même ailleurs, est cité', () => {
  const dump = classeur();
  const eau = dump.sheets.find((s) => s.name === 'Eau');
  eau.merged.push('AL46:AM48');
  eau.cells.push({ r: 46, c: 38, v: 3 }, { r: 46, c: 40, v: 'Eau Parfaite', threads: [{ text: 'salut viens en vocal stp, vite' }] });
  cellule(dump, 'Sang', BJ4).threads = [{ text: 'salut viens en vocal stp' }];
  const r = lancer({ dump });
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(entrees(r.page('magie-de-leau')).map((e) => e.texte), ['salut viens en vocal stp, vite']);
  assert.deepEqual(entrees(r.page('magie-du-sang')).map((e) => e.texte), ['salut viens en vocal stp']);
  assert.doesNotMatch(r.stdout, /écarté : /);
});

test('synthétique : une note sur une cellule VIDE arrête le script avec un message clair, et la page n\'est pas écrite', () => {
  const dump = classeur();
  ajoute(dump, 'Sang', { r: 5, c: 62, v: '', note: 'Une note sans texte à côté' });
  const r = lancer({ dump });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /Sang/);
  assert.match(r.stderr, /BJ5/);
  assert.match(r.stderr, /vide/);
  assert.equal(r.page('magie-du-sang'), null);
});

test('synthétique : une note dans un onglet NON PUBLIÉ est refusée, un fil y est seulement signalé', () => {
  const dump = classeur();
  dump.sheets.push({ name: 'Sommaire', state: 'visible', merged: [], validations: [], cells: [{ r: 31, c: 1, v: 'Règle spéciale', note: 'Une note de plus' }] });
  const r = lancer({ dump });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /Sommaire/);
  assert.match(r.stderr, /non publié/);
  assert.match(r.stderr, /A31/);
  assert.equal(r.page('magie-du-sang'), null, 'rien n\'est écrit');

  const fils = classeur();
  fils.sheets.push({ name: 'Statistiques', state: 'visible', merged: [], validations: [], cells: [{ r: 27, c: 60, v: 50.0, threads: [{ text: 'augmentation a 39', done: true }] }] });
  const ok = lancer({ dump: fils });
  assert.equal(ok.status, 0, ok.stderr);
  assert.match(ok.stdout, /Statistiques/);
  assert.match(ok.stdout, /BH27/);
});

test('synthétique : une note hors de la table des sorts n\'a pas de place prévue : le script s\'arrête', () => {
  const dump = classeur();
  cellule(dump, 'Sang', { r: 4, c: 1 }).note = 'Une note sur la description';
  const r = lancer({ dump });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /A4/);
  assert.match(r.stderr, /hors de la table des sorts/);
  assert.equal(r.page('magie-du-sang'), null);
});

test('--verifier : une note absente de la page, altérée ou citée deux fois est un écart (code 1, message clair)', () => {
  const dump = avecNotes();
  const r = lancer({ dump });
  assert.equal(r.status, 0, r.stderr);
  const f = join(r.out, 'magies', 'magie-du-sang.md');
  const original = readFileSync(f, 'utf8');
  const ligne = '**Note de la cellule « Effets secondaires » du sort « Éclair »** : Première note.';
  assert.ok(original.includes(ligne));

  writeFileSync(f, original.replace(`${ligne}\n\n`, ''));
  let v = verifie(r, dump);
  assert.equal(v.status, 1);
  assert.match(v.stderr, /ÉCART/);
  assert.match(v.stderr, /Éclair/);
  assert.match(v.stderr, /absente/);

  writeFileSync(f, original.replace('Première note.', 'Première note, retouchée.'));
  v = verifie(r, dump);
  assert.equal(v.status, 1);
  assert.match(v.stderr, /Première note\./);

  writeFileSync(f, original.replace(`${ligne}\n\n`, `${ligne}\n\n${ligne}\n\n`));
  v = verifie(r, dump);
  assert.equal(v.status, 1);
  assert.match(v.stderr, /2 fois/);

  writeFileSync(f, original);
  assert.equal(verifie(r, dump).status, 0, 'la page d\'origine est de nouveau conforme');
});

test('--verifier : une note ajoutée au dump après l\'écriture des pages (page périmée) est signalée', () => {
  const r = lancer({ dump: avecNotes() });
  const plus = avecNotes();
  cellule(plus, 'Sang', BJ4).threads = [{ text: 'Nouveau fil.' }];
  const v = verifie(r, plus);
  assert.equal(v.status, 1);
  assert.match(v.stderr, /Nouveau fil\./);
  assert.match(v.stderr, /absente/);
});

test('--verifier : une note vide, hors table ou dans un onglet non publié est refusée aussi (le dump seul suffit)', () => {
  const r = lancer({ dump: avecNotes() });
  for (const [nom, modif, motif] of [
    ['cellule vide', (d) => ajoute(d, 'Sang', { r: 5, c: 62, v: '', note: 'x' }), /vide/],
    ['hors de la table', (d) => { cellule(d, 'Sang', { r: 4, c: 1 }).note = 'x'; return d; }, /hors de la table des sorts/],
    ['onglet non publié', (d) => { d.sheets.push({ name: 'Météo', merged: [], cells: [{ r: 1, c: 1, v: 'a', note: 'x' }] }); return d; }, /non publié/],
  ]) {
    const v = verifie(r, modif(avecNotes()));
    assert.equal(v.status, 1, nom);
    assert.match(v.stderr, motif, nom);
  }
});

test('les pages écrites sont identiques à la seconde exécution (idempotence)', () => {
  const dump = avecNotes();
  cellule(dump, 'Sang', BJ4).threads = [{ text: 'Un fil.', done: true }];
  const a = lancer({ dump });
  const avant = readFileSync(join(a.out, 'magies', 'magie-du-sang.md'), 'utf8');
  const b = lancer({ dump, sortie: a.out });
  assert.equal(b.status, 0, b.stderr);
  assert.equal(readFileSync(join(a.out, 'magies', 'magie-du-sang.md'), 'utf8'), avant);
  assert.equal(compte(avant, '**Note de la cellule'), 2);
});
