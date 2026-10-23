// Notes et fils de commentaires de cellule du classeur « Ressources et Craft » dans les pages `ressources/` des familles « equipement »
// (tools/sheets/equipement.py : 8 onglets) et « divers-craft » (tools/sheets/divers-craft.py : 6 onglets).
//
// État du classeur (lu dans le .xlsx par tools/sheets/xlsx_to_json.py) : 10 cellules commentées, 12 commentaires.
//   - 6 NOTES (le petit commentaire jaune, champ `note`) : Accessoires BK66, CI66 et ED80 ; Pièces élémentaires CW8, X29 et CI64 ;
//   - 6 FILS de commentaires (conversation « Commentaire » de Google Sheets, champ `threads`) sur 4 cellules : Équipement inventaire A1
//     (3 fils), Armes QA6 (cellule fusionnée NON principale de QA5:QL6, rattachée à la cellule « Effet » de la « Bombe perçante »),
//     Maladie H39 et Fiche de tour L12.
// Les notes sont citées « **Note de la cellule « <intitulé> »** : <texte> », les fils « **Commentaire de la cellule « … »** : … »
// (« Commentaire résolu » quand le fil est résolu), sous le tableau (ou le titre) qui porte la cellule, dans la même section.
// Le site de dev est la source de ce qu'il modifie : les pages se lisent dans leur état d'import (historique_modification, lib/historique-site.mjs).
// Décision R91 : le site a retiré de la page des armes le fil de QA6 (la remarque de la Bombe perçante, qui datait des armes à feu) ; l'import le garde.
//
// Deux familles de tests :
//   - le contenu RÉEL des 14 pages : textes exacts, page, section, intitulé de la cellule, nombre total ;
//   - le code des extracteurs, sur des feuilles SYNTHÉTIQUES (les vrais dumps ne font pas partie du dépôt) : lecture des notes et des
//     fils, cellule fusionnée, refus (cellule vide, onglet non publié, note sans place), contrôle de couverture et de placement.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { historiqueSite } from '../src/lib/historique-site.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';

const dossierPages = fileURLToPath(new URL('../src/content/wiki/ressources', import.meta.url));
const equipement = fileURLToPath(new URL('../../tools/sheets/equipement.py', import.meta.url));
const diversCraft = fileURLToPath(new URL('../../tools/sheets/divers-craft.py', import.meta.url));
const python = spawnSync('python3', ['-I', '-c', 'pass']);
const sansPython = python.status !== 0 && 'python3 absent';

const PAGES_EQUIPEMENT = [
  'equipement-inventaire', 'armes', 'armures', 'bouclier', 'baton-magique', 'livre-parchemin', 'accessoires', 'pieces-elementaires',
];
const PAGES_DIVERS = ['familiers', 'maison', 'machine-de-guerresiege', 'fievre-des-marais', 'maladie', 'fiche-de-tour'];

// ---------------------------------------------------------------------------------------------------------------------------------
// Lecture d'une page : les notes et les fils (étiquette, intitulé, texte), la section et le bloc qui précède
// ---------------------------------------------------------------------------------------------------------------------------------

const lire = (slug) => readFileSync(join(dossierPages, `${slug}.md`), 'utf8');
const historique = historiqueSite(ouvrirBase({ sansExemples: false }));
/** Le corps d'une page tel que l'import l'a écrit (avant les modifications du site de dev), sous un en-tête vide : la forme que lit `corps`. */
const lireDImport = (slug) => `---\n---\n${historique.valeurDImport('page', { id: `ressources/${slug}` }, 'corps_md')}`;
const corps = (texte) => texte.split('\n---\n').slice(1).join('\n---\n');
const sansEchappement = (s) => s.replace(/\\([\\`*_[\]<~&>#+\-.)])/g, '$1').replace(/<br>/g, ' ').replace(/<(https?:\/\/[^>\s]+)>/g, '$1');
const norme = (s) => s.replace(/\s+/g, ' ').trim();
const ETIQUETTE = /^\*\*(Note|Commentaire résolu|Commentaire) de la cellule « (.+?) »\*\*(?: : ([\s\S]*))?$/;
const DEBUT_AUTRE = /^(#|\||\*\*)/;

/** [{ genre, intitule, texte, section, precedent }] ; `texte` est ramené à une ligne, sans échappements Markdown. */
function commentaires(texte) {
  const blocs = corps(texte).split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  const sortie = [];
  let section = null;
  blocs.forEach((bloc, i) => {
    if (bloc.startsWith('#')) section = norme(sansEchappement(bloc.replace(/^#+\s*/, '')));
    const m = ETIQUETTE.exec(bloc);
    if (!m) return;
    let brut = m[3];
    if (brut === undefined) {
      brut = '';
      for (let j = i + 1; j < blocs.length && !DEBUT_AUTRE.test(blocs[j]); j += 1) brut += `${brut ? '\n\n' : ''}${blocs[j]}`;
    }
    sortie.push({
      genre: m[1],
      intitule: norme(sansEchappement(m[2])),
      texte: norme(sansEchappement(brut)),
      section,
      precedent: blocs[i - 1],
    });
  });
  return sortie;
}

const T = {
  BK66: "Il existe une situation où le changement de posture n'est pas possible, c'est dans le cas où le personnage décide de passer en focus pour utiliser un sort niveau 5 pour après espérer un changement de posture. Si un sort de niveau 5 est lancé, le changement de posture n'est plus possible le reste du tour.",
  CI66: "L'insensibilité est un état où AUCUN sortilège (positif ou négatif) ne peut toucher le lanceur. Prendre un coup physique annule cet état.",
  ED80: "Agib est l'ambassadeur de la richesse et Murge son gardien. Ce sont des marchands qui ont beaucoup de marchandises.",
  CW8: 'Métal : Plus solide, elle ne peut pas perdre de cran de solidité Pierre : Ignore 5 AP Plante : Ignore 50% des AP des boucliers',
  X29: 'Bras = Perd son arme ou bouclier Jambe = Ne peut plus bouger',
  CI64: '* Si le carreau touche à 2 - 4 portée = Surdité 1 Si le carreau touche à 5 - 7 portée = Surdité 2 Si le carreau touche à 8 - 10 portée = Surdité 3',
  A1_1: "L'insensibilité est un état où AUCUN sortilège (positif ou négatif) ne peut toucher le lanceur. Prendre un coup physique annule cet état.",
  A1_2: 'Un téléphone quoi',
  A1_3: '1 fois par combat',
  QA6: "Il faut perdre un bras pour avoir cette arme, ce qui fait que vous perdez une main. Ce n'est pas considéré comme un Canon d'artifice.",
  H39: 'Se traduit par une croix en Force et Agilité et Social.',
  L12: "- Maximum 3 IC par Tour - Déplacement OU Action cramée en cas d'échec critique - Vous pouvez vous déplacer (Ou pas) autant de fois pendant votre tour tant que vous avez encore des points de déplacements (Stat : VITESSE)",
};

// [page, genre, intitulé, section, texte, cellule d'origine]
const ATTENDUS = [
  ['accessoires', 'Note', 'Effet (Jet 12.0)', 'SI ATTAQUE', T.BK66, 'BK66'],
  ['accessoires', 'Note', 'Effet (Jet 12.0)', 'SI DÉFENSE', T.CI66, 'CI66'],
  ['accessoires', 'Note', 'Effet (Jet 19.0)', 'SI AUTRE', T.ED80, 'ED80'],
  ['pieces-elementaires', 'Note', 'Épée de Terre', 'ÉPÉE', T.CW8, 'CW8'],
  ['pieces-elementaires', 'Note', 'Hache de Sang', 'HACHE', T.X29, 'X29'],
  ['pieces-elementaires', 'Note', 'Arbalète de Vent', 'ARBALÈTE', T.CI64, 'CI64'],
  ['equipement-inventaire', 'Commentaire résolu', 'MONNAIE', 'MONNAIE', T.A1_1, 'A1'],
  ['equipement-inventaire', 'Commentaire', 'MONNAIE', 'MONNAIE', T.A1_2, 'A1'],
  ['equipement-inventaire', 'Commentaire', 'MONNAIE', 'MONNAIE', T.A1_3, 'A1'],
  ['armes', 'Commentaire résolu', 'Effet (Bombe perçante)', 'BOMBES - D6 (Disponible en l\'an 150) [Un matériau permet d\'en faire 10]', T.QA6, 'QA6'],
  ['maladie', 'Commentaire', 'Effets', 'Tétanos', T.H39, 'H39'],
  ['fiche-de-tour', 'Commentaire', 'PENDANT LE TOUR (JOUEUR)', null, T.L12, 'L12'],
];

// ---------------------------------------------------------------------------------------------------------------------------------
// Pages réelles
// ---------------------------------------------------------------------------------------------------------------------------------

for (const [page, genre, intitule, section, texte, cellule] of ATTENDUS) {
  test(`page ${page} : ${genre.toLowerCase()} de la cellule ${cellule}, texte exact, sous « ${intitule} », section ${section ?? '(sans titre)'}`, () => {
    const trouves = commentaires(lireDImport(page)).filter((e) => e.texte === texte);
    assert.equal(trouves.length, 1, `${page} : « ${texte.slice(0, 50)}… » doit figurer exactement une fois`);
    const [e] = trouves;
    assert.equal(e.genre, genre);
    assert.equal(e.intitule, intitule);
    assert.equal(e.section, section);
    // placé sous la cellule : juste après le tableau (ou le titre) qui la porte, ou après les commentaires de la même cellule
    assert.match(e.precedent, /^(\||#|\*\*)/, `${page} : le bloc qui précède la note n'est ni un tableau, ni un titre, ni un champ ou une note`);
  });
}

test('la note de Pièces élémentaires CI64 garde sa ligne « * » et ses trois paliers de portée, en paragraphes séparés', () => {
  const page = lire('pieces-elementaires');
  assert.ok(page.includes('**Note de la cellule « Arbalète de Vent »**\n\n\\*  \nSi le carreau touche à 2 - 4 portée = Surdité 1\n\nSi le carreau touche à 5 - 7 portée = Surdité 2\n\nSi le carreau touche à 8 - 10 portée = Surdité 3'));
});

test('une note sur une seule ligne tient sur la ligne de son libellé', () => {
  assert.ok(lire('accessoires').includes(`**Note de la cellule « Effet (Jet 19.0) »** : ${T.ED80}`));
  assert.ok(lire('maladie').includes(`**Commentaire de la cellule « Effets »** : ${T.H39}`));
});

test('les 6 fils sont les seuls commentaires « Commentaire » / « Commentaire résolu » des 14 pages, les 6 notes les seules notes', () => {
  const genres = { Note: 0, Commentaire: 0, 'Commentaire résolu': 0 };
  for (const slug of [...PAGES_EQUIPEMENT, ...PAGES_DIVERS]) {
    assert.ok(existsSync(join(dossierPages, `${slug}.md`)), `${slug} : page absente`);
    for (const e of commentaires(lireDImport(slug))) genres[e.genre] += 1;
  }
  assert.deepEqual(genres, { Note: 6, Commentaire: 4, 'Commentaire résolu': 2 });
});

test('aucun ancien libellé : ni « Note de cellule : », ni « Commentaires de cellule », ni « Commentaire joint », ni section de secours', () => {
  for (const slug of [...PAGES_EQUIPEMENT, ...PAGES_DIVERS]) {
    const texte = lire(slug);
    assert.doesNotMatch(texte, /Note de cellule :/, slug);
    assert.doesNotMatch(texte, /Commentaire joint/, slug);
    assert.doesNotMatch(texte, /^## Commentaires de cellule/m, slug);
    assert.doesNotMatch(texte, /du classeur d'origine\)/, slug);
  }
});

test('la cellule fusionnée QA5:QL6 : le fil de QA6 est cité une fois, sous l’effet de la Bombe perçante, pas ailleurs', () => {
  const armes = lireDImport('armes');
  assert.equal(armes.split(T.QA6.slice(0, 40)).length - 1, 1);
  const i = armes.indexOf('| Bombe perçante |');
  const j = armes.indexOf('**Commentaire résolu de la cellule « Effet (Bombe perçante) »**');
  assert.ok(i > 0 && j > i, 'le fil doit venir après la ligne de la Bombe perçante');
  assert.doesNotMatch(armes.slice(i, armes.indexOf('\n', i)), /Il faut perdre un bras/, 'le fil n’est plus dans la cellule du tableau');
});

test('décision R91 : le fil de QA6 n’est plus dans la page des armes depuis que le site de dev a retiré la remarque de la Bombe perçante', () => {
  const retiree = historique.modifiee('arme', { id: 'ressources/armes#arme:bombes:bombe-percante' }, 'remarque');
  assert.ok(retiree, 'la remarque modifiée par le site (historique_modification)');
  assert.doesNotMatch(lire('armes'), /Commentaire résolu de la cellule « Effet \(Bombe perçante\) »/, 'la page construite ne cite plus le fil de l’import');
});

test('aucune ligne de tableau ne porte plus de commentaire : ils sont déplacés sous le tableau, les cellules gardent la valeur de la source', () => {
  for (const slug of [...PAGES_EQUIPEMENT, ...PAGES_DIVERS]) {
    for (const ligne of lire(slug).split('\n')) {
      if (ligne.startsWith('|')) assert.doesNotMatch(ligne, /Note de la cellule|Commentaire de la cellule|Commentaire résolu/, slug);
    }
  }
});

// ---------------------------------------------------------------------------------------------------------------------------------
// Extracteurs sur des feuilles synthétiques (python3 -I, bibliothèque standard)
// ---------------------------------------------------------------------------------------------------------------------------------

const HARNAIS = `
import importlib.util, json, sys
req = json.load(sys.stdin)
spec = importlib.util.spec_from_file_location("ext", req["script"])
ext = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ext)
ns = {"ext": ext, "req": req, "json": json}
try:
    exec(req["code"], ns)
    print(json.dumps({"ok": ns.get("result")}, ensure_ascii=False))
except (ValueError, SystemExit) as err:
    print(json.dumps({"erreur": str(err.code if isinstance(err, SystemExit) else err)}, ensure_ascii=False))
`;

/** Exécute `code` (Python) avec le module de `script` chargé (`ext`) et `donnees` (`req`) ; renvoie { ok } ou { erreur }. */
function appel(script, code, donnees = {}) {
  const run = spawnSync('python3', ['-I', '-c', HARNAIS], { input: JSON.stringify({ script, code, ...donnees }), encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  return JSON.parse(run.stdout.trim().split('\n').at(-1));
}

const feuille = (name, cells, merged = []) => ({ name, state: 'visible', max_row: 60, max_col: 500, merged, cells });
const NOTE_A = "Si le carreau touche à 2 - 4 portée = Surdité 1";

for (const [nom, script] of [['equipement.py', equipement], ['divers-craft.py', diversCraft]]) {
  const SHEET = 'ext.Sheet(req["raw"])';
  const COMMENTAIRES = `sh = ${SHEET}\nresult = {ext.coord(*k) if hasattr(ext, "coord") else ext.ref_of(*k): [list(x) for x in v] for k, v in sh.comments.items()}`;

  test(`${nom} : une note, puis les fils de la même cellule, sont lus dans l’ordre du dump (note, fil, fil résolu)`, { skip: sansPython }, () => {
    const raw = feuille('X', [
      { r: 3, c: 2, v: 'Un effet', note: NOTE_A, threads: [{ text: 'Premier fil' }, { text: 'Deuxième fil', done: true, replies: ['Marquée comme fermée', 'Rouverte'] }] },
    ]);
    assert.deepEqual(appel(script, COMMENTAIRES, { raw }).ok, {
      B3: [['note', NOTE_A], ['thread', 'Premier fil'], ['thread_done', 'Deuxième fil']],
    });
  });

  test(`${nom} : une note ou un fil blanc (espaces seuls) est ignoré`, { skip: sansPython }, () => {
    const raw = feuille('X', [{ r: 3, c: 2, v: 'Un effet', note: '  \n ', threads: [{ text: ' ' }] }]);
    assert.deepEqual(appel(script, COMMENTAIRES, { raw }).ok, {});
  });

  test(`${nom} : une note sur une cellule VIDE arrête le script, avec la cellule et le début de la note`, { skip: sansPython }, () => {
    const raw = feuille('X', [{ r: 3, c: 2, v: '', note: NOTE_A }]);
    const { erreur } = appel(script, COMMENTAIRES, { raw });
    assert.match(erreur, /B3/);
    assert.match(erreur, /vide/);
    assert.match(erreur, /une note/);
    assert.ok(erreur.includes('Si le carreau touche'), erreur);
  });

  test(`${nom} : un fil sur une cellule vide arrête le script de la même façon`, { skip: sansPython }, () => {
    const raw = feuille('X', [{ r: 3, c: 2, v: '', threads: [{ text: 'Un fil orphelin' }] }]);
    const { erreur } = appel(script, COMMENTAIRES, { raw });
    assert.match(erreur, /B3/);
    assert.match(erreur, /vide/);
    assert.match(erreur, /un fil/);
  });

  test(`${nom} : le commentaire d'une cellule fusionnée non principale est rattaché à la cellule principale (qui porte la valeur)`, { skip: sansPython }, () => {
    const raw = feuille(
      'X',
      [{ r: 5, c: 3, v: 'Effet de la plage' }, { r: 6, c: 3, v: '', threads: [{ text: 'Fil sur QA6', done: true }] }],
      ['C5:E6'],
    );
    assert.deepEqual(appel(script, COMMENTAIRES, { raw }).ok, { C5: [['thread_done', 'Fil sur QA6']] });
  });

  test(`${nom} : une cellule fusionnée non principale dont la cellule principale est vide arrête le script`, { skip: sansPython }, () => {
    const raw = feuille('X', [{ r: 6, c: 3, v: '', note: NOTE_A }], ['C5:E6']);
    const { erreur } = appel(script, COMMENTAIRES, { raw });
    assert.match(erreur, /C6/);
    assert.match(erreur, /vide/);
  });

  test(`${nom} : une réponse de fil autre que « Marquée comme fermée » / « Rouverte » n’est pas perdue en silence`, { skip: sansPython }, () => {
    const raw = feuille('X', [{ r: 3, c: 2, v: 'Un effet', threads: [{ text: 'Fil', replies: ['Je ne suis pas d’accord'] }] }]);
    const { erreur } = appel(script, COMMENTAIRES, { raw });
    assert.match(erreur, /réponse/);
    assert.match(erreur, /B3/);
  });

  test(`${nom} : le contrôle de couverture accepte une page conforme et nomme l’écart pour une note retirée, dupliquée, tronquée, altérée ou en trop`, { skip: sansPython }, () => {
    const data = {
      sheets: [feuille(script === equipement ? 'Accessoires' : 'Maladie', [
        { r: 3, c: 2, v: 'Un effet', note: 'Texte de la note.\n\nDeuxième paragraphe.', threads: [{ text: 'Un fil', done: true }] },
      ])],
    };
    const slug = script === equipement ? 'accessoires' : 'maladie';
    const entete = '---\ntitle: "X"\n---\n\n';
    const note = '**Note de la cellule « Effet (A) »**\n\nTexte de la note.\n\nDeuxième paragraphe.\n';
    const fil = '**Commentaire résolu de la cellule « Effet (A) »** : Un fil\n';
    const tableau = '| Jet | Effet |\n| --- | --- |\n| A | Un effet |\n\n';
    const code = `
data = req["data"]
texts = {req["slug"]: req["entete"] + req["tableau"] + v for v in [req["variante"]]}
result = ext.note_problems(data, texts)`;
    const verdict = (variante) => appel(script, code, { data, slug, entete, tableau, variante }).ok;
    assert.deepEqual(verdict(`${note}\n${fil}`), []);
    assert.match(verdict(fil).join('\n'), /Texte de la note/);
    assert.match(verdict(`${note}\n${note}\n${fil}`).join('\n'), /2 fois|de plus|plus d'une/);
    assert.match(verdict(`${note.replace('Deuxième paragraphe.', 'Deuxième')}\n${fil}`).join('\n'), /Texte de la note/);
    assert.match(verdict(`${note.replace('Texte de la note.', 'Texte de la nota.')}\n${fil}`).join('\n'), /Texte de la note/);
    assert.match(verdict(`${note}\n${fil.replace('résolu ', '')}`).join('\n'), /Un fil/);
    assert.match(verdict(`${note}\n${fil}\n${fil}`).join('\n'), /Un fil|de plus/);
  });

  test(`${nom} : le contrôle de placement exige la note après sa cellule, dans la même section`, { skip: sansPython }, () => {
    const tab = script === equipement ? 'Accessoires' : 'Maladie';
    const slug = script === equipement ? 'accessoires' : 'maladie';
    const data = { sheets: [feuille(tab, [{ r: 3, c: 2, v: 'Un effet précis', note: 'La note.' }])] };
    const code = `
texts = {req["slug"]: "---\\ntitle: \\"X\\"\\n---\\n\\n" + req["variante"]}
result = ext.place_problems(req["data"], texts)`;
    const verdict = (variante) => appel(script, code, { data, slug, variante }).ok;
    const note = '**Note de la cellule « Effet (A) »** : La note.\n';
    assert.deepEqual(verdict(`## Section\n\n| Jet | Effet |\n| --- | --- |\n| A | Un effet précis |\n\n${note}`), []);
    assert.match(verdict(`## Section\n\n| Jet | Effet |\n| --- | --- |\n| A | Un effet précis |\n\n## Autre section\n\n${note}`).join('\n'), /section/);
    assert.match(verdict(`## Section\n\n${note}\n| Jet | Effet |\n| --- | --- |\n| A | Un effet précis |\n`).join('\n'), /avant|cellule/);
    assert.match(verdict(`## Section\n\n${note}`).join('\n'), /cellule/);
  });
}

// --- equipement.py : tableaux et titres -------------------------------------------------------------------------------------------

test('equipement.py : read_table + Page.table écrivent le commentaire d’une cellule sous le tableau, avec « colonne (ligne) » pour intitulé', { skip: sansPython }, () => {
  const raw = feuille(
    'Armes',
    [
      { r: 2, c: 1, v: 'Nom' }, { r: 2, c: 2, v: 'Coût' }, { r: 2, c: 3, v: 'Effet' },
      { r: 5, c: 1, v: 'Bombe perçante' }, { r: 5, c: 2, v: '1 Ro' }, { r: 5, c: 3, v: "1 - 4 portée, dégâts d'estoc." },
      { r: 6, c: 3, v: '', threads: [{ text: 'Il faut perdre un bras.', done: true }] },
      { r: 8, c: 1, v: 'Dague', note: 'Une note.\n\nSur deux paragraphes.' }, { r: 8, c: 2, v: '2 Ro' }, { r: 8, c: 3, v: 'Perce.' },
    ],
    ['C5:E6'],
  );
  const code = `
sh = ext.Sheet(req["raw"])
headers, rows, notes = ext.read_table(sh, 2, [1, 2, 3], 3, 20)
page = ext.Page(sh, "armes", "Armes", [])
page.table(headers, rows, notes)
result = {"texte": "\\n".join(page.body), "restant": len(sh.comments)}`;
  const { ok } = appel(equipement, code, { raw });
  assert.equal(ok.restant, 0, 'tous les commentaires de la feuille sont placés');
  assert.equal(
    ok.texte,
    [
      '| Nom | Coût | Effet |',
      '| --- | --- | --- |',
      "| Bombe perçante | 1 Ro | 1 - 4 portée, dégâts d'estoc. |",
      '| Dague | 2 Ro | Perce. |',
      '',
      '**Commentaire résolu de la cellule « Effet (Bombe perçante) »** : Il faut perdre un bras.',
      '',
      '**Note de la cellule « Nom (Dague) »**',
      '',
      'Une note.',
      '',
      'Sur deux paragraphes.',
      '',
    ].join('\n'),
  );
});

test('equipement.py : le titre d’une cellule (MONNAIE) est suivi de ses commentaires, dans l’ordre', { skip: sansPython }, () => {
  const raw = feuille('Équipement inventaire', [
    { r: 1, c: 1, v: 'MONNAIE', threads: [{ text: 'Un', done: true }, { text: 'Deux' }] },
  ]);
  const code = `
sh = ext.Sheet(req["raw"])
page = ext.Page(sh, "x", "X", [])
page.heading(2, sh.expect(1, 1, "MONNAIE"), sh.pop_comments(1, 1))
result = "\\n".join(page.body)`;
  assert.equal(
    appel(equipement, code, { raw }).ok,
    ['## MONNAIE', '', '**Commentaire résolu de la cellule « MONNAIE »** : Un', '', '**Commentaire de la cellule « MONNAIE »** : Deux', ''].join('\n'),
  );
});

test('equipement.py : une note sur une cellule que la page reprend sans lui prévoir de place arrête le script (« sans place prévue »)', { skip: sansPython }, () => {
  const raw = feuille('Armes', [{ r: 1, c: 1, v: 'Règles générales', note: 'Une note sur les règles' }]);
  const code = `
sh = ext.Sheet(req["raw"])
sh.take(1, 1)
ext.finish(ext.Page(sh, "armes", "Armes", []))`;
  const { erreur } = appel(equipement, code, { raw });
  assert.match(erreur, /sans place prévue/);
  assert.match(erreur, /A1/);
  assert.match(erreur, /Une note sur les règles/);
});

// --- divers-craft.py : maladies et fiche de tour ----------------------------------------------------------------------------------

test('divers-craft.py : build_maladie écrit le commentaire d’un champ sous ce champ, dans la section de la maladie', { skip: sansPython }, () => {
  const entetes = ['Nom', 'Effets', 'Nature', 'Où le contracter ?', 'Méthode de contraction', "Temps d'Incubation", 'Méthode de soin', 'Temps de soin'];
  const colonnes = [1, 8, 15, 22, 29, 36, 43, 53];
  const cells = entetes.map((v, i) => ({ r: 1, c: colonnes[i], v }));
  cells.push({ r: 3, c: 1, v: 'Tétanos' }, { r: 3, c: 8, v: 'Paralysie des membres.', threads: [{ text: 'Se traduit par une croix en Force.' }] });
  cells.push({ r: 3, c: 15, v: 'Inféction bactérienne', note: 'Une note de nature.' });
  const code = 'sh = ext.Sheet(req["raw"])\np = ext.build_maladie(sh)\nresult = "\\n".join(p["body"])';
  const { ok } = appel(diversCraft, code, { raw: feuille('Maladie', cells) });
  assert.ok(
    ok.includes(
      '## Tétanos\n\n**Effets** : Paralysie des membres.\n\n**Commentaire de la cellule « Effets »** : Se traduit par une croix en Force.\n\n**Nature** : Inféction bactérienne\n\n**Note de la cellule « Nature »** : Une note de nature.',
    ),
    ok,
  );
});

test('divers-craft.py : build_tour écrit le commentaire d’une case du premier tableau sous ce tableau, intitulé « colonne (ligne) »', { skip: sansPython }, () => {
  const cells = [
    { r: 3, c: 2, v: 'AVANT LE TOUR' }, { r: 3, c: 12, v: 'PENDANT LE TOUR' }, { r: 3, c: 27, v: 'FIN DU TOUR' },
    { r: 5, c: 1, v: 'GROUPE' }, { r: 5, c: 2, v: 'a' }, { r: 5, c: 12, v: 'b' }, { r: 5, c: 27, v: 'c' },
    { r: 12, c: 1, v: 'JOUEUR' }, { r: 12, c: 2, v: 'd' }, { r: 12, c: 12, v: 'e', threads: [{ text: '- Maximum 3 IC par Tour\n- Une autre ligne' }] }, { r: 12, c: 27, v: 'f' },
    { r: 40, c: 5, v: "Déroulement d'un tour" }, { r: 41, c: 1, v: 'Tout le monde' }, { r: 41, c: 5, v: 'g' },
  ];
  const code = 'sh = ext.Sheet(req["raw"])\np = ext.build_tour(sh)\nresult = "\\n".join(p["body"])';
  const { ok } = appel(diversCraft, code, { raw: feuille('Fiche de tour', cells) });
  assert.ok(
    ok.includes('| JOUEUR | d | e | f |\n\n**Commentaire de la cellule « PENDANT LE TOUR (JOUEUR) »**\n\n- Maximum 3 IC par Tour\n- Une autre ligne\n'),
    ok,
  );
});

test('divers-craft.py : build_familiers retire la phrase de U3 qui menait au classeur « Familiers », sans son lien (migration 0019)', { skip: sansPython }, () => {
  const cells = [
    { r: 1, c: 1, v: 'Petit familier' }, { r: 1, c: 21, v: 'Gros familier' }, { r: 1, c: 41, v: 'Monture' },
    { r: 3, c: 21, v: 'Les gros familiers sont des entités puissantes.\n\nIci pour les fiches : Familiers' },
    { r: 10, c: 1, v: 'Nom' }, { r: 10, c: 6, v: 'Effet' }, { r: 10, c: 12, v: 'Description' },
    { r: 10, c: 21, v: 'Nom' }, { r: 10, c: 26, v: 'Description' }, { r: 10, c: 41, v: 'Nom' }, { r: 10, c: 46, v: 'Description' },
    { r: 11, c: 21, v: 'Bouleguerre' }, { r: 11, c: 26, v: 'Un chien.' },
  ];
  const code = 'sh = ext.Sheet(req["raw"])\np = ext.build_familiers(sh)\nresult = "\\n".join(p["body"])';
  const { ok } = appel(diversCraft, code, { raw: feuille('Familiers', cells) });
  assert.ok(ok.includes('## Gros familier\n\nLes gros familiers sont des entités puissantes.\n\n| Nom | Description |'), ok);
  assert.doesNotMatch(ok, /Ici pour les fiches|Lien hypertexte|docs\.google\.com/);
  cells[3].v = 'Les gros familiers sont des entités puissantes.';
  const { erreur } = appel(diversCraft, code, { raw: feuille('Familiers', cells) });
  assert.match(erreur, /U3 ne finit plus par « Ici pour les fiches : Familiers »/);
});

// --- main() : refus avant toute écriture ------------------------------------------------------------------------------------------

const ONGLETS_EQUIPEMENT = ['Équipement inventaire', 'Armes', 'Armures', 'Bouclier', 'Bâton magique', 'LivreParchemin', 'Accessoires', 'Pièces élémentaires'];
const ONGLETS_DIVERS = ['Familiers', 'Maison', 'Machine de GuerreSiège', 'Maladie V2', 'Maladie', 'Fiche de tour'];

function lancer(script, feuilles) {
  const dossier = dossierTemporaire('equipement-craft');
  const dump = join(dossier, 'ressources-craft.json');
  const sortie = join(dossier, 'wiki');
  writeFileSync(dump, JSON.stringify({ sheets: feuilles }));
  const run = spawnSync('python3', ['-I', script, '--dump', dump, '--out', sortie], { encoding: 'utf8' });
  const ecrit = existsSync(join(sortie, 'ressources')) ? readdirSync(join(sortie, 'ressources')) : [];
  return { ...run, ecrit };
}

for (const [nom, script, siens, autres] of [
  ['equipement.py', equipement, ONGLETS_EQUIPEMENT, ONGLETS_DIVERS],
  ['divers-craft.py', diversCraft, ONGLETS_DIVERS, ONGLETS_EQUIPEMENT],
]) {
  const vides = (...extra) => [...siens, ...autres].map((n) => feuille(n, [])).concat(extra);

  test(`${nom} : une note dans un onglet que ni lui ni l’autre extracteur ne publie arrête le script, rien n’est écrit`, { skip: sansPython }, () => {
    const run = lancer(script, vides(feuille('Onglet inconnu', [{ r: 1, c: 1, v: 'x', note: 'Une note perdue' }])));
    assert.notEqual(run.status, 0);
    assert.match(run.stderr + run.stdout, /Onglet inconnu/);
    assert.match(run.stderr + run.stdout, /ne publie/);
    assert.deepEqual(run.ecrit, [], 'aucune page écrite');
  });

  test(`${nom} : un fil dans un onglet non publié arrête aussi le script`, { skip: sansPython }, () => {
    const run = lancer(script, vides(feuille('Onglet inconnu', [{ r: 1, c: 1, v: 'x', threads: [{ text: 'Un fil perdu' }] }])));
    assert.notEqual(run.status, 0);
    assert.match(run.stderr + run.stdout, /Onglet inconnu/);
    assert.deepEqual(run.ecrit, []);
  });

  test(`${nom} : une note sur une cellule vide d’un de ses onglets est refusée avec un message qui nomme l’onglet et la cellule`, { skip: sansPython }, () => {
    const feuilles = vides();
    feuilles[0] = feuille(siens[0], [{ r: 4, c: 3, v: '', note: 'Une note orpheline' }]);
    const run = lancer(script, feuilles);
    assert.notEqual(run.status, 0);
    assert.match(run.stderr + run.stdout, new RegExp(siens[0]));
    assert.match(run.stderr + run.stdout, /C4/);
    assert.match(run.stderr + run.stdout, /vide/);
    assert.deepEqual(run.ecrit, []);
  });

  test(`${nom} : l’option --verifier existe (aide) et n’écrit rien`, { skip: sansPython }, () => {
    const run = spawnSync('python3', ['-I', script, '--help'], { encoding: 'utf8' });
    assert.equal(run.status, 0);
    assert.match(run.stdout, /--verifier/);
  });
}

// --- --verifier sur les vrais dumps (facultatif : les dumps ne font pas partie du dépôt) -------------------------------------------

const DUMP = process.env.RESSOURCES_CRAFT_DUMP;
for (const [nom, script] of [['equipement.py', equipement], ['divers-craft.py', diversCraft]]) {
  test(`${nom} --verifier : les pages du dépôt sont celles que le dump produit, chaque commentaire une fois (RESSOURCES_CRAFT_DUMP)`, { skip: !DUMP ? 'RESSOURCES_CRAFT_DUMP non défini (dump hors dépôt)' : sansPython }, () => {
    const wiki = fileURLToPath(new URL('../src/content/wiki', import.meta.url));
    const run = spawnSync('python3', ['-I', script, '--dump', DUMP, '--out', wiki, '--verifier'], { encoding: 'utf8' });
    assert.equal(run.status, 0, run.stderr + run.stdout);
    assert.match(run.stdout, /--verifier/);
  });
}
