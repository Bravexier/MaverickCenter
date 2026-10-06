// Notes de cellule du classeur « Classe Maverick V7 » dans les fiches de capacités (tools/sheets/classes.py).
// Une note (le petit commentaire jaune d'une cellule) précise parfois une règle : elle est citée telle quelle, jamais interprétée, à la
// suite de l'effet de la capacité dont elle commente le bloc, sous la forme « Note de cellule : <texte> » (rendu des 660 fiches, inchangé
// depuis l'import des notes directement dans le .xlsx).
//
// État de la source (contrôlé dans le .xlsx et dans le dump de xlsx_to_json.py) : 43 notes, aucun fil de commentaires, toutes sur la
// cellule en haut à gauche d'un bloc d'effet de capacité d'un onglet de classe : 43 fiches portent donc chacune une note.
//
// Trois familles de tests :
//   - le contenu RÉEL des fiches du dépôt : les 43 notes (page, ligne, texte exact pour les plus significatives), leur nombre total ;
//   - `classes.py --verifier` sur le vrai dump (facultatif : CLASSES_DUMP, le dump n'est pas dans le dépôt) ;
//   - le code de l'extracteur, sur un classeur SYNTHÉTIQUE de même gabarit : les notes sont lues dans le CHAMP `note` DU DUMP (aucun
//     classeur .xlsx), placées, comptées ; refus (cellule vide, onglet non publié, note sans place, fil de commentaires) ; contrôle de
//     couverture ; --verifier et ses cas d'erreur rejoués.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('../../tools/sheets/classes.py', import.meta.url));
const wiki = fileURLToPath(new URL('../src/content/wiki', import.meta.url));
const python = spawnSync('python3', ['-I', '-c', 'pass']);
const sansPython = python.status !== 0 && 'python3 absent';

const CLASSEUR = 'https://docs.google.com/spreadsheets/d/1K9IX0z_w-4IJt9oiq1D9AE4NVjTPZIHEHCWBHqOkMOs/edit';
const MARQUEUR = 'Note de cellule : ';
const colonne = (lettres) => [...lettres].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);
const adresse = (ref) => {
  const m = /^([A-Z]+)(\d+)$/.exec(ref);
  return { r: Number(m[2]), c: colonne(m[1]) };
};
const corps = (texte) => texte.split('\n---\n').slice(1).join('\n---\n').replace(/^\n/, '');
const frontmatter = (texte) => texte.split('\n---\n')[0];
const champ = (texte, cle) => new RegExp(`^${cle}: (.*)$`, 'm').exec(frontmatter(texte))?.[1];
/** Nombre de notes rendues dans une page : lignes qui commencent par le libellé. */
const nbNotes = (texte) => (corps(texte).match(/^Note de cellule : /gm) ?? []).length;
const sansEchappement = (s) => s.replace(/\\([\\`*_[\]<~&>#+\-.)])/g, '$1');
/** Texte comparable : échappements Markdown retirés, puces et sauts de ligne ramenés à des espaces. */
const aplatir = (s) => sansEchappement(s).replace(/^- /gm, '').replace(/\s+/g, ' ').trim();

// ---------------------------------------------------------------------------------------------------------------------------------
// Pages réelles
// ---------------------------------------------------------------------------------------------------------------------------------

const dossierCapacites = join(wiki, 'capacites');
const capacites = readdirSync(dossierCapacites)
  .filter((f) => f.endsWith('.md'))
  .map((f) => ({ slug: f.slice(0, -3), texte: readFileSync(join(dossierCapacites, f), 'utf8') }))
  .filter((p) => p.texte.slice(0, 4000).includes(CLASSEUR));
const page = (slug) => {
  const trouvee = capacites.find((p) => p.slug === slug);
  assert.ok(trouvee, `page capacites/${slug} absente`);
  return trouvee.texte;
};

// Les 43 notes du classeur : [onglet, cellule (haut gauche du bloc d'effet), fiche de la capacité]. La ligne de la cellule « Lvl N » (champ
// `ligne`) est celle du dessus : un bloc d'effet commence sur la ligne qui suit sa cellule « Lvl N ».
const NOTES = [
  ['Cuirassé', 'P5', 'cuirasse-defensif'],
  ['Martiale', 'D23', 'martiale-heros'],
  ['Voleur', 'A37', 'voleur-faussaire'],
  ['Tueur', 'AE44', 'tueur-sournefice'],
  ['Pugiliste', 'P50', 'pugiliste-coup-de-paume'],
  ['Parleur', 'P50', 'parleur-negociateur'],
  ['Bimane', 'P12', 'bimane-frappe-fatiguante'],
  ['Bimane', 'A44', 'bimane-poigne-du-titan'],
  ['Bimane', 'H44', 'bimane-bien-sen-servir'],
  ['Archer', 'X37', 'archer-tir-soudain'],
  ['Arbalètrier', 'X37', 'arbaletrier-charger'],
  ['Arbalètrier', 'H44', 'arbaletrier-agressivement'],
  ['Arbalètrier', 'P50', 'arbaletrier-carreau-dacier'],
  ['Mage', 'X30', 'mage-soin-etrange'],
  ['Mage', 'A44', 'mage-toujours-plus'],
  ['Mage', 'X44', 'mage-deux-fois-plus'],
  ['Mage', 'AE44', 'mage-soin-similaire'],
  ['Mage Rouge', 'P5', 'mage-rouge-preparation'],
  ['Mage Rouge', 'P50', 'mage-rouge-double-coup'],
  ['Mage Vert', 'P5', 'mage-vert-chargement'],
  ['Mage Vert', 'H30', 'mage-vert-brutale'],
  ['Mage Vert', 'P50', 'mage-vert-double-coup'],
  ['Mage Bleu', 'P5', 'mage-bleu-mimetisme'],
  ['Maclier', 'X30', 'maclier-frisbee'],
  ['Maclier', 'X44', 'maclier-miroir'],
  ['Maclier', 'AE44', 'maclier-parfait'],
  ['Ocultomancien', 'P5', 'ocultomancien-econome'],
  ['Ocultomancien', 'A30', 'ocultomancien-pilonnage'],
  ['Ocultomancien', 'AE37', 'ocultomancien-climatosceptique'],
  ['Flagelleur', 'X30', 'flagelleur-puni-moi'],
  ['Flagelleur', 'AE30', 'flagelleur-plus-fort'],
  ['Orios', 'H30', 'orios-gigantisme'],
  ['Minotaure', 'H30', 'minotaure-gigantisme'],
  ['Marcass', 'H30', 'marcass-catapulte'],
  ['Marcass', 'AE30', 'marcass-ca-va-plus-vite'],
  ['Marcass', 'X37', 'marcass-totemiste'],
  ['Marcass', 'AE37', 'marcass-cest-plus-dur'],
  ['Marcass', 'H44', 'marcass-lance-totem'],
  ['Marcass', 'AE44', 'marcass-cest-meilleur'],
  ['Anansi', 'P5', 'anansi-coup-dpatte'],
  ['Anansi', 'P12', 'anansi-piege-toile'],
  ['Anansi', 'AE37', 'anansi-pt-fragile'],
  ['Anansi', 'A44', 'anansi-magie-patte'],
];

// Notes choisies pour leur forme : [onglet, cellule, fiche, rang, spécialité, texte de la note dans le classeur, rendu Markdown exact].
const CHOISIES = [
  ['Cuirassé', 'P5', 'cuirasse-defensif', 1, undefined, "Ne marche pas si l'ennemi contre-attaque.",
    "Note de cellule : Ne marche pas si l'ennemi contre-attaque."],
  ['Martiale', 'D23', 'martiale-heros', 1, '"HÉROS"',
    "Il existe une situation où le changement de posture n'est pas possible, c'est dans le cas où le personnage décide de passer en focus pour utiliser un sort niveau 5 pour après espérer un changement de posture. Si un sort de niveau 5 est lancé, le changement de posture n'est plus possible le reste du tour.",
    "Note de cellule : Il existe une situation où le changement de posture n'est pas possible, c'est dans le cas où le personnage décide de passer en focus pour utiliser un sort niveau 5 pour après espérer un changement de posture. Si un sort de niveau 5 est lancé, le changement de posture n'est plus possible le reste du tour."],
  // deux paragraphes
  ['Bimane', 'P12', 'bimane-frappe-fatiguante', 2, undefined,
    "L'état de fatigue ne se cumule pas si le coup est répété sur la même cible.\n\nSi jamais la cible souffre déjà de fatigue 1 pour une autre raison, là c'est fatigue 2 (de même dans le cas de fatigue 2 à fatigue 3)",
    "Note de cellule : L'état de fatigue ne se cumule pas si le coup est répété sur la même cible.\n\nSi jamais la cible souffre déjà de fatigue 1 pour une autre raison, là c'est fatigue 2 (de même dans le cas de fatigue 2 à fatigue 3)"],
  // saut de ligne final dans le classeur : retiré
  ['Arbalètrier', 'H44', 'arbaletrier-agressivement', 2, '"GRAND ARBALETRIER"', "L'arbalète doit être recharger.\n",
    "Note de cellule : L'arbalète doit être recharger."],
  // liste, étoile à protéger
  ['Mage', 'X30', 'mage-soin-etrange', 1, '"MAGE BLANC"',
    "Il est capable de soigner aussi les morts vivants.\n*Sort d'attaque basique lvl 1 :\n- Boule de sang\n- Boule de chakra\n- Boule sombre\n- Coup du sablier\n- Bulle de vide\n- Tir d'âme\n- Boule de feu\n- Bulle d'eau\n- Éclat glacé\n- Lance pierre\n- Lame d'air\n- Éclair\n- Frappe lumineuse\n- Sphère obscure",
    "Note de cellule : Il est capable de soigner aussi les morts vivants.  \n\\*Sort d'attaque basique lvl 1 :\n\n- Boule de sang\n- Boule de chakra\n- Boule sombre\n- Coup du sablier\n- Bulle de vide\n- Tir d'âme\n- Boule de feu\n- Bulle d'eau\n- Éclat glacé\n- Lance pierre\n- Lame d'air\n- Éclair\n- Frappe lumineuse\n- Sphère obscure"],
  // tabulations en fin de ligne dans le classeur : retirées ; trois lignes
  ['Mage', 'A44', 'mage-toujours-plus', 1, '"MAGE NOIR"',
    "Bien entendu qu'on parle des sorts qui sont non IC. Le deuxième sort crame un IC sur les 3 disponible dans le tour donc prudence à en avoir un avant d'utiliser cette capacité.\nPeut lancer deux sorts de soin ou/et d'amplification en 1 seul tour. Il est necessaire de réussir un jet de concentration entre les deux sorts.\t\t\t\t\t\nLes deux sorts doivent être différents.",
    "Note de cellule : Bien entendu qu'on parle des sorts qui sont non IC. Le deuxième sort crame un IC sur les 3 disponible dans le tour donc prudence à en avoir un avant d'utiliser cette capacité.  \nPeut lancer deux sorts de soin ou/et d'amplification en 1 seul tour. Il est necessaire de réussir un jet de concentration entre les deux sorts.  \nLes deux sorts doivent être différents."],
  // même texte (en partie) sur la capacité voisine, note propre à sa cellule
  ['Mage', 'X44', 'mage-deux-fois-plus', 1, '"MAGE BLANC"',
    "Bien entendu qu'on parle des sorts qui sont non IC. Le deuxième sort crame un IC sur les 3 disponible dans le tour donc prudence à en avoir un avant d'utiliser cette capacité.\nLes deux sorts doivent être différents.",
    "Note de cellule : Bien entendu qu'on parle des sorts qui sont non IC. Le deuxième sort crame un IC sur les 3 disponible dans le tour donc prudence à en avoir un avant d'utiliser cette capacité.  \nLes deux sorts doivent être différents."],
  // mêmes textes dans deux classes différentes : une fois chacune
  ['Orios', 'H30', 'orios-gigantisme', 2, '"VA-T-EN GUERRE"',
    "Bien entendu il est nécessaire d'avoir minimum 4 de force pour les porter : \n- Épée temple\n- Claymore (qui devient une arme de force)\n- Broyeur\n- Hache de Bataille\n- Bardiche\n- Tronc\n- Arc de guerre géant (là c'est juste une permision d'utiliser l'arme)\n- Baliste portable (même chose que pour l'arc de guerre géant)",
    "Note de cellule : Bien entendu il est nécessaire d'avoir minimum 4 de force pour les porter :\n\n- Épée temple\n- Claymore (qui devient une arme de force)\n- Broyeur\n- Hache de Bataille\n- Bardiche\n- Tronc\n- Arc de guerre géant (là c'est juste une permision d'utiliser l'arme)\n- Baliste portable (même chose que pour l'arc de guerre géant)"],
  ['Minotaure', 'H30', 'minotaure-gigantisme', 2, '"GLADIATEUR"',
    "Bien entendu il est nécessaire d'avoir minimum 4 de force pour les porter : \n- Épée temple\n- Claymore (qui devient une arme de force)\n- Broyeur\n- Hache de Bataille\n- Bardiche\n- Tronc\n- Arc de guerre géant (là c'est juste une permision d'utiliser l'arme)\n- Baliste portable (même chose que pour l'arc de guerre géant)",
    "Note de cellule : Bien entendu il est nécessaire d'avoir minimum 4 de force pour les porter :\n\n- Épée temple\n- Claymore (qui devient une arme de force)\n- Broyeur\n- Hache de Bataille\n- Bardiche\n- Tronc\n- Arc de guerre géant (là c'est juste une permision d'utiliser l'arme)\n- Baliste portable (même chose que pour l'arc de guerre géant)"],
  // même texte sur deux cellules d'une même ligne : une note par page
  ['Flagelleur', 'X30', 'flagelleur-puni-moi', 1, '"MASOCHISTE"',
    'Dans le cas du potentiel illimité, lancer un D14 pour déterminé une résistance magique aléatoire',
    'Note de cellule : Dans le cas du potentiel illimité, lancer un D14 pour déterminé une résistance magique aléatoire'],
  ['Flagelleur', 'AE30', 'flagelleur-plus-fort', 2, '"MASOCHISTE"',
    'Dans le cas du potentiel illimité, lancer un D14 pour déterminé une résistance magique aléatoire',
    'Note de cellule : Dans le cas du potentiel illimité, lancer un D14 pour déterminé une résistance magique aléatoire'],
  // trois paragraphes
  ['Marcass', 'X37', 'marcass-totemiste', 1, '"DÉVOT"',
    'Terre : Réduit les dégâts encaissés de 4.\n\nFeu : Augmente les dégâts infligés de 4. \n\nNécromancie : Économise 1 chakra à chaque sorts lancés.',
    'Note de cellule : Terre : Réduit les dégâts encaissés de 4.\n\nFeu : Augmente les dégâts infligés de 4.\n\nNécromancie : Économise 1 chakra à chaque sorts lancés.'],
  // guillemets droits
  ['Mage Vert', 'H30', 'mage-vert-brutale', 2, '"MAGE EMERAUDE"', 'Les sorts "fer"', 'Note de cellule : Les sorts "fer"'],
  ['Anansi', 'A44', 'anansi-magie-patte', 1, '"MARIONNETTISTE"',
    'Arcane = Le coup de patte peut prendre en compte l\'AM plutôt que l\'AP\n\nNécromancie = Oblige le jet de vigueur à la cible pour ne pas prendre "poison 1"\n\nOmbre = Impose un malus de 10% au prochain jet de la victime',
    'Note de cellule : Arcane = Le coup de patte peut prendre en compte l\'AM plutôt que l\'AP\n\nNécromancie = Oblige le jet de vigueur à la cible pour ne pas prendre "poison 1"\n\nOmbre = Impose un malus de 10% au prochain jet de la victime'],
];

test('pages réelles : 660 fiches de capacités du classeur, 43 notes rendues au total, une par fiche, aucune ailleurs', () => {
  assert.equal(capacites.length, 660);
  assert.equal(NOTES.length, 43);
  const avecNote = capacites.filter((p) => nbNotes(p.texte) > 0);
  assert.equal(capacites.reduce((somme, p) => somme + nbNotes(p.texte), 0), 43);
  assert.deepEqual(avecNote.map((p) => [p.slug, nbNotes(p.texte)]).sort(), NOTES.map(([, , slug]) => [slug, 1]).sort());
  // ni les pages de classes ni le glossaire ne reçoivent de note de cellule
  const classes = readdirSync(join(wiki, 'classes')).filter((f) => f.endsWith('.md'));
  assert.ok(classes.length >= 39);
  for (const f of classes) assert.equal(nbNotes(readFileSync(join(wiki, 'classes', f), 'utf8')), 0, `classes/${f}`);
  assert.equal(nbNotes(readFileSync(join(wiki, 'ressources', 'objets-de-depart-des-classes.md'), 'utf8')), 0);
});

test('pages réelles : chaque note est sur la fiche de la capacité dont elle commente le bloc (ligne de la cellule « Lvl N » au-dessus)', () => {
  for (const [onglet, cellule, slug] of NOTES) {
    const p = page(slug);
    const { r } = adresse(cellule);
    assert.equal(Number(champ(p, 'ligne')), r - 1, `${onglet} ${cellule} -> ${slug} : ligne ${champ(p, 'ligne')}`);
    assert.ok(p.includes(`onglet « ${onglet} »`), `${slug} : sources de l'onglet « ${onglet} »`);
    assert.equal(nbNotes(p), 1, slug);
  }
});

for (const [onglet, cellule, slug, rang, specialite, source, rendu] of CHOISIES) {
  test(`pages réelles : ${onglet} ${cellule} -> « ${slug} », texte de la note intégral`, () => {
    const p = page(slug);
    assert.equal(Number(champ(p, 'rang')), rang);
    assert.equal(champ(p, 'specialite'), specialite);
    // la note termine la page, juste après l'effet, une seule fois, telle que rendue
    assert.ok(corps(p).endsWith(`\n\n${rendu}\n`), `${slug} : la page ne se termine pas par :\n${rendu}\n---\n${corps(p)}`);
    assert.equal(corps(p).split(rendu).length - 1, 1);
    // texte du classeur = texte de la page, aux échappements Markdown, puces et espaces près
    assert.equal(aplatir(rendu), aplatir(MARQUEUR + source));
  });
}

test('pages réelles : deux notes au texte identique dans deux classes (Orios, Minotaure) ou sur deux cellules voisines (Flagelleur) : une fois par page', () => {
  for (const slug of ['orios-gigantisme', 'minotaure-gigantisme', 'flagelleur-puni-moi', 'flagelleur-plus-fort']) assert.equal(nbNotes(page(slug)), 1, slug);
  // la note de Mage A44 contient une phrase qui est l'effet de X44 : chaque fiche garde la note de SA cellule, pas celle de la voisine
  const phrase = "Peut lancer deux sorts de soin ou/et d'amplification";
  assert.equal(corps(page('mage-toujours-plus')).split(phrase).length - 1, 1, 'dans la note de A44 (son effet parle des sorts d’attaque)');
  assert.equal(corps(page('mage-deux-fois-plus')).split(phrase).length - 1, 1, 'dans l’effet de X44 seulement, sa note ne la répète pas');
});

// Facultatif (le vrai dump n'est pas dans le dépôt) :
//   CLASSES_DUMP=<classes-v7.corrige.json> [CLASSES_XLSX=<classeur.xlsx>] node --test test/classes-notes.test.mjs
const dumpReel = process.env.CLASSES_DUMP;
test('classes.py --verifier : les pages du dépôt sont celles que le vrai dump produit, les 43 notes retrouvées (CLASSES_DUMP)', {
  skip: sansPython || (!dumpReel && 'CLASSES_DUMP non défini (dump hors dépôt)'),
}, () => {
  const options = process.env.CLASSES_XLSX ? ['--xlsx', process.env.CLASSES_XLSX] : [];
  const r = spawnSync('python3', ['-I', script, '--dump', dumpReel, ...options, '--out', wiki, '--verifier'], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /43 notes de cellule dans le dump, 43 rattachées à un bloc d'effet, 43 écrites/);
  assert.match(r.stdout, /VÉRIFICATION RÉUSSIE/);
});

// ---------------------------------------------------------------------------------------------------------------------------------
// Classeur synthétique de même gabarit (format de tools/sheets/xlsx_to_json.py)
// ---------------------------------------------------------------------------------------------------------------------------------

function ongletClasse(nom, { capsP, specialites = false }) {
  const cells = [
    ['N1', nom.toUpperCase()],
    ['A2', 'Don de départ'], ['A3', 'Santé'], ['E3', 10], ['A4', 'Chakra'], ['E4', 0], ['A5', 'Barrière'], ['E5', 0],
    ['G2', 'Inventaire de départ'], ['G3', 'Une fiole rouge'],
    ['A6', 'Maîtrise Arme'], ['A7', '- 1 maîtrise Hast'], ['G6', 'Arme de départ'], ['G7', 'Arme en fer'],
    ['A10', 'Maîtrise Armures'], ['A11', '- Légère à Lourde'], ['G10', 'Armure de départ'], ['G11', 'Armure de fer'],
  ];
  const merged = ['A3:D3', 'A4:D4', 'A5:D5'];
  // capacités de classe, colonne P : « Lvl N » (P:Q), nom (R:U), effet (P:U sur 4 lignes), type (P:U)
  for (const [ligne, [niveau, nomCap, effet, type]] of [[4, capsP[0]], [11, capsP[1]], [49, capsP[2]]]) {
    cells.push([`P${ligne}`, niveau], [`R${ligne}`, nomCap], [`P${ligne + 1}`, effet], [`P${ligne + 5}`, type]);
    merged.push(`P${ligne}:Q${ligne}`, `R${ligne}:U${ligne}`, `P${ligne + 1}:U${ligne + 4}`, `P${ligne + 5}:U${ligne + 5}`);
  }
  if (specialites) {
    cells.push(['A17', 'DANSEUR'], ['X17', 'MÉNESTREL']);
    merged.push('A17:M19', 'X17:AJ19');
    // cartouches de spécialité (ligne 22) : « Lvl 10 » en D / AA, nom 2 colonnes plus loin, effet dessous, type sous l'effet
    cells.push(['D22', 'Lvl 10'], ['F22', 'Danseur'], ['D23', 'Effet de Danseur'], ['D27', 'Passif']);
    cells.push(['AA22', 'Lvl 10'], ['AC22', 'Ménestrel'], ['AA23', 'Effet de Ménestrel'], ['AA27', 'Passif']);
    merged.push('D22:E22', 'F22:J22', 'D23:J26', 'D27:J27', 'AA22:AB22', 'AC22:AG22', 'AA23:AG26', 'AA27:AG27');
    // une ligne de deux capacités par spécialité (ligne 29) : A et H sous DANSEUR, X et AE sous MÉNESTREL
    for (const [col, nomCap] of [['A', 'Perroquet'], ['H', 'Contournement'], ['X', 'Nouvel accord'], ['AE', 'Écho']]) {
      const c = colonne(col);
      const lettre = (n) => { let s = ''; for (let k = n; k > 0; k = Math.floor((k - 1) / 26)) s = String.fromCharCode(65 + ((k - 1) % 26)) + s; return s; };
      cells.push([`${col}29`, 'Lvl 10'], [`${lettre(c + 2)}29`, nomCap], [`${col}30`, `Effet de ${nomCap}`], [`${col}34`, 'Passif']);
      merged.push(`${col}29:${lettre(c + 1)}29`, `${lettre(c + 2)}29:${lettre(c + 5)}29`, `${col}30:${lettre(c + 5)}33`, `${col}34:${lettre(c + 5)}34`);
    }
  }
  return {
    name: nom,
    state: 'visible',
    merged,
    cells: cells.map(([ref, v]) => ({ ...adresse(ref), v })).sort((a, b) => a.r - b.r || a.c - b.c),
  };
}

const sommaire = () => ({
  name: 'Sommaire',
  state: 'visible',
  merged: [],
  cells: [
    ['A1', 'Classe Physique Corps à Corps'], ['E1', 'Classe Magique'], ['A2', 'Guerrier'], ['E2', 'Barde'],
    ['A17', 'Il vous suffit de cliquer sur le nom de la classe.'],
    ['A19', 'OBJETS DES INVENTAIRES DE DEPART'], ['A21', 'Fiole rouge : Une fiole.\n\nTorche : Une torche.'],
  ].map(([ref, v]) => ({ ...adresse(ref), v })),
});

const classeur = () => ({
  sheets: [
    sommaire(),
    ongletClasse('Guerrier', { capsP: [['Lvl 1', 'Défensif', 'Effet de Défensif', 'Passif'], ['Lvl 5', 'Aisance', 'Effet de Aisance', 'Passif'], ['Lvl 20', 'Égide', 'Effet de Égide', 'Réaction']] }),
    ongletClasse('Barde', { capsP: [['Lvl 1', 'Prestation', 'Effet de Prestation', 'Passif'], ['Lvl 5', 'Son perturbant', 'Effet de Son perturbant', 'Actif'], ['Lvl 20', 'Chant double', 'Effet de Chant double', 'Passif']], specialites: true }),
    { name: 'Combo stat', state: 'visible', merged: [], cells: [{ r: 2, c: 2, v: 'Guerrier' }, { r: 2, c: 3, v: 12 }] },
  ],
});

/** Pose `note` (ou un autre champ) sur la cellule `ref` de l'onglet, qui doit exister. */
function poser(dump, onglet, ref, note, nomChamp = 'note') {
  const { r, c } = adresse(ref);
  const cellule = dump.sheets.find((s) => s.name === onglet).cells.find((x) => x.r === r && x.c === c);
  assert.ok(cellule, `cellule ${onglet} ${ref} absente du classeur synthétique`);
  cellule[nomChamp] = note;
  return dump;
}

// Textes de notes réelles du classeur : P5 de Cuirassé, P12 de Bimane (deux paragraphes), H44 de l'Arbalètrier (saut de ligne final),
// X30 du Mage (liste, étoile), D23 de Martiale (cartouche de spécialité).
const N = {
  simple: "Ne marche pas si l'ennemi contre-attaque.",
  deux: "L'état de fatigue ne se cumule pas si le coup est répété sur la même cible.\n\nSi jamais la cible souffre déjà de fatigue 1 pour une autre raison, là c'est fatigue 2 (de même dans le cas de fatigue 2 à fatigue 3)",
  final: "L'arbalète doit être recharger.\n\n",
  liste: "Il est capable de soigner aussi les morts vivants.\n*Sort d'attaque basique lvl 1 :\n- Boule de sang\n- Boule de chakra",
  cartouche: "Il existe une situation où le changement de posture n'est pas possible.",
  identique: 'Dans le cas du potentiel illimité, lancer un D14 pour déterminé une résistance magique aléatoire',
};
const NOTES_SYNTH = [
  ['Guerrier', 'P5', N.simple],
  ['Guerrier', 'P12', N.deux],
  ['Guerrier', 'P50', N.final],
  ['Barde', 'D23', N.cartouche],
  ['Barde', 'A30', N.liste],
  ['Barde', 'H30', N.simple],
  ['Barde', 'X30', N.identique],
  ['Barde', 'AE30', N.identique],
];
const avecNotes = (dump = classeur(), notes = NOTES_SYNTH) => {
  for (const [onglet, ref, texte] of notes) poser(dump, onglet, ref, texte);
  return dump;
};

const md = (texte) => `Note de cellule : ${texte}`;
const RENDU = {
  simple: md(N.simple),
  deux: md(N.deux),
  final: md("L'arbalète doit être recharger."),
  liste: "Note de cellule : Il est capable de soigner aussi les morts vivants.  \n\\*Sort d'attaque basique lvl 1 :\n\n- Boule de sang\n- Boule de chakra",
  cartouche: md(N.cartouche),
  identique: md(N.identique),
};
// [fiche, effet, rendu de la note] pour chaque capacité commentée
const ATTENDUES = [
  ['guerrier-defensif', 'Effet de Défensif', RENDU.simple],
  ['guerrier-aisance', 'Effet de Aisance', RENDU.deux],
  ['guerrier-egide', 'Effet de Égide', RENDU.final],
  ['barde-danseur', 'Effet de Danseur', RENDU.cartouche],
  ['barde-perroquet', 'Effet de Perroquet', RENDU.liste],
  ['barde-contournement', 'Effet de Contournement', RENDU.simple],
  ['barde-nouvel-accord', 'Effet de Nouvel accord', RENDU.identique],
  ['barde-echo', 'Effet de Écho', RENDU.identique],
];
const TOTAL = NOTES_SYNTH.length;
const SANS_NOTE = ['barde-menestrel', 'barde-prestation', 'barde-son-perturbant', 'barde-chant-double'];

function preparer(dump = avecNotes()) {
  const dir = mkdtempSync(join(tmpdir(), 'classes-notes-'));
  const chemin = join(dir, 'classes-v7.json');
  writeFileSync(chemin, JSON.stringify(dump));
  const out = join(dir, 'wiki');
  mkdirSync(out);
  return { dir, out, dump: chemin, capacites: join(out, 'capacites') };
}
// Les notes viennent du dump : aucun classeur .xlsx n'accompagne le dump synthétique, les hyperliens (seul usage du .xlsx) sont écartés.
function lancer(ctx, args = []) {
  return spawnSync('python3', ['-I', script, '--dump', ctx.dump, '--out', ctx.out, '--sans-liens', ...args], { encoding: 'utf8' });
}
const fichiers = (ctx) => (existsSync(ctx.capacites) ? readdirSync(ctx.capacites).filter((f) => f.endsWith('.md')).sort() : []);
const lire = (ctx, slug) => readFileSync(join(ctx.capacites, `${slug}.md`), 'utf8');
function modifierPage(ctx, slug, fn) {
  const chemin = join(ctx.capacites, `${slug}.md`);
  const avant = readFileSync(chemin, 'utf8');
  const apres = fn(avant);
  assert.notEqual(apres, avant, `${slug} : la modification de test ne change rien`);
  writeFileSync(chemin, apres);
}
const toutesLesPages = (ctx) =>
  Object.fromEntries(
    ['classes', 'capacites', 'ressources'].flatMap((sous) =>
      existsSync(join(ctx.out, sous))
        ? readdirSync(join(ctx.out, sous)).filter((f) => f.endsWith('.md')).map((f) => [`${sous}/${f}`, readFileSync(join(ctx.out, sous, f), 'utf8')])
        : [],
    ),
  );

test('synthétique : sans aucune note, 2 classes + 12 capacités + le glossaire, aucun libellé de note', { skip: sansPython }, () => {
  const ctx = preparer(classeur());
  const r = lancer(ctx);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(fichiers(ctx).length, 12);
  assert.equal(Object.values(toutesLesPages(ctx)).reduce((somme, t) => somme + nbNotes(t), 0), 0);
  assert.equal(lancer(ctx, ['--verifier']).status, 0, lancer(ctx, ['--verifier']).stdout);
});

test('notes lues dans le dump : chacune est écrite à la suite de l’effet de sa capacité, texte intégral, une seule fois', { skip: sansPython }, () => {
  const ctx = preparer();
  const r = lancer(ctx);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, new RegExp(`notes de cellule : ${TOTAL} dans le dump, ${TOTAL} placées, ${TOTAL} écrites`));
  for (const [slug, effet, rendu] of ATTENDUES) {
    assert.equal(corps(lire(ctx, slug)), `${effet}\n\n${rendu}\n`, slug);
    assert.equal(nbNotes(lire(ctx, slug)), 1, slug);
  }
  for (const slug of SANS_NOTE) assert.equal(nbNotes(lire(ctx, slug)), 0, slug);
  // ni les pages de classes ni le glossaire n'en reçoivent
  for (const [chemin, texte] of Object.entries(toutesLesPages(ctx))) {
    if (!chemin.startsWith('capacites/')) assert.equal(nbNotes(texte), 0, chemin);
  }
});

test('notes : le nombre de notes rendues est celui du dump, par page et au total, aucune de plus', { skip: sansPython }, () => {
  const ctx = preparer();
  assert.equal(lancer(ctx).status, 0);
  const parPage = {};
  for (const f of fichiers(ctx)) {
    const n = nbNotes(lire(ctx, f.slice(0, -3)));
    if (n) parPage[f.slice(0, -3)] = n;
  }
  assert.deepEqual(parPage, Object.fromEntries(ATTENDUES.map(([slug]) => [slug, 1])));
  assert.equal(Object.values(parPage).reduce((a, b) => a + b, 0), TOTAL);
});

test('notes : seules des lignes de notes sont ajoutées aux pages (le reste est identique à la page sans notes)', { skip: sansPython }, () => {
  const avec = preparer();
  const sans = preparer(classeur());
  assert.equal(lancer(avec).status, 0);
  assert.equal(lancer(sans).status, 0);
  assert.deepEqual(fichiers(avec), fichiers(sans));
  const retirer = (texte) => texte.replace(/\n\nNote de cellule : [\s\S]*$/, '\n');
  for (const [chemin, texte] of Object.entries(toutesLesPages(avec))) {
    assert.equal(retirer(texte), toutesLesPages(sans)[chemin], `${chemin} : autre chose que la note a changé`);
  }
});

test('notes : relancé, le script n’écrit plus rien (idempotent) et affiche toujours son bilan', { skip: sansPython }, () => {
  const ctx = preparer();
  const premier = lancer(ctx);
  assert.equal(premier.status, 0, premier.stderr);
  assert.match(premier.stdout, /bilan capacites : 12 pages \(12 écrites, 0 inchangées\)/);
  const second = lancer(ctx);
  assert.equal(second.status, 0, second.stderr);
  assert.match(second.stdout, /bilan capacites : 12 pages \(0 écrites, 12 inchangées\)/);
  assert.match(second.stdout, new RegExp(`notes de cellule : ${TOTAL} dans le dump`));
});

test('options : le classeur .xlsx ne sert plus qu’aux hyperliens ; --sans-commentaires est retirée ; sans classeur ni --sans-liens le script le réclame', { skip: sansPython }, () => {
  const ctx = preparer();
  const retiree = spawnSync('python3', ['-I', script, '--dump', ctx.dump, '--out', ctx.out, '--sans-commentaires'], { encoding: 'utf8' });
  assert.notEqual(retiree.status, 0, '--sans-commentaires devrait être refusée');
  assert.match(retiree.stderr, /unrecognized arguments: --sans-commentaires/);
  const sansClasseur = spawnSync('python3', ['-I', script, '--dump', ctx.dump, '--out', ctx.out], { encoding: 'utf8' });
  assert.notEqual(sansClasseur.status, 0);
  assert.match(sansClasseur.stderr, /classeur \.xlsx introuvable.*hyperliens.*--sans-liens/s);
  assert.equal(fichiers(ctx).length, 0, 'rien n’est écrit sans classeur ni --sans-liens');
});

test('notes : une note blanche (espaces seulement) n’est pas une note, même sur une cellule vide', { skip: sansPython }, () => {
  const dump = classeur();
  poser(dump, 'Guerrier', 'P5', '  \n ');
  dump.sheets.find((s) => s.name === 'Guerrier').cells.push({ r: 60, c: 3, v: '', note: ' ' });
  const ctx = preparer(dump);
  const r = lancer(ctx);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(nbNotes(lire(ctx, 'guerrier-defensif')), 0);
  assert.match(r.stdout, /notes de cellule : 0 dans le dump, 0 placées, 0 écrites/);
});

test('notes : un début de ligne qui serait du Markdown (« 1. », « # », « > », « - ») est protégé, le texte reste intégral', { skip: sansPython }, () => {
  const texte = 'Règles :\n1. Premier point\n# Pas un titre\n> Pas une citation\n+ Pas une liste\n\nFin avec *étoile*, _tiret_ et a | b.';
  const ctx = preparer(poser(classeur(), 'Guerrier', 'P5', texte));
  const r = lancer(ctx);
  assert.equal(r.status, 0, r.stderr);
  assert.ok(
    lire(ctx, 'guerrier-defensif').includes(
      'Note de cellule : Règles :  \n1\\. Premier point  \n\\# Pas un titre  \n\\> Pas une citation  \n\\+ Pas une liste\n\nFin avec \\*étoile\\*, \\_tiret\\_ et a | b.',
    ),
    lire(ctx, 'guerrier-defensif'),
  );
  assert.equal(lancer(ctx, ['--verifier']).status, 0);
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
    assert.equal(existsSync(join(ctx.out, 'classes')), false);
  });
}
const ajouter = (dump, onglet, cellule) => {
  dump.sheets.find((s) => s.name === onglet).cells.push(cellule);
  return dump;
};

arret('note sur une cellule vide', () => ajouter(classeur(), 'Guerrier', { r: 60, c: 3, v: '', note: 'Une note' }),
  /onglet « Guerrier » : la cellule C60 est vide mais porte une note/);
arret('note sur une cellule d’une plage fusionnée autre que la cellule principale', () => ajouter(classeur(), 'Guerrier', { r: 6, c: 17, v: '', note: 'Une note' }),
  /Q6 est vide mais porte une note.*plage fusionnée P5:U8/s);
arret('note dans un onglet que le script ne publie pas (Combo stat)', () => poser(classeur(), 'Combo stat', 'B2', 'Une note'),
  /onglet « Combo stat » : .*note.*ne publie pas/s);
arret('note dans le Sommaire (aucune place prévue)', () => poser(classeur(), 'Sommaire', 'A2', 'Une note'),
  /onglet « Sommaire » : .*note.*aucune place prévue/s);
arret('note sur la bannière de la classe (aucune place prévue)', () => poser(classeur(), 'Guerrier', 'N1', 'Une note'),
  /Guerrier : note de cellule en N1 sans place prévue \(hors d'un bloc d'effet d'aptitude\)/);
arret('note sur le nom d’une capacité (aucune place prévue)', () => poser(classeur(), 'Guerrier', 'R4', 'Une note'), /note de cellule en R4 sans place prévue/);
arret('note sur le type d’une capacité (aucune place prévue)', () => poser(classeur(), 'Guerrier', 'P9', 'Une note'), /note de cellule en P9 sans place prévue/);
arret('note sur le don de départ (aucune place prévue)', () => poser(classeur(), 'Guerrier', 'E3', 'Une note'), /note de cellule en E3 sans place prévue/);
arret('note qui n’est pas un texte', () => poser(classeur(), 'Guerrier', 'P5', 5), /pas un texte/);
arret('fil de commentaires (aucune place prévue)', () => poser(classeur(), 'Guerrier', 'P5', [{ text: 'Une conversation' }], 'threads'),
  /fil de commentaires/);

// ---------------------------------------------------------------------------------------------------------------------------------
// Contrôle de couverture du script (check_note_coverage) : appelé directement, sur des pages altérées en mémoire
// ---------------------------------------------------------------------------------------------------------------------------------

const COUVERTURE = `
import importlib.util, json, sys
spec = importlib.util.spec_from_file_location("classes", sys.argv[1])
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
sheets, order, _ = mod.load_dumps([sys.argv[2]])
names = [n for n in order if n != mod.SUMMARY_SHEET and n not in mod.IGNORED_SHEETS]
built = mod.build(sheets, names, {})
assert not built["problems"], built["problems"]
pages = {c + "/" + s: body for c, s, t, body, n in built["jobs"] if c == mod.CAP_CATEGORY}
placed = built["notes"]
total = built["notes_dump"]
cible = "capacites/" + sys.argv[3]
block = "\\n".join(mod.md_text("Note de cellule : " + next(n["text"] for n in placed if n["page"] == cible)))

def avec(modif):
    return dict(pages, **{cible: modif(pages[cible])})

def essai(nom, pages_, placed_, total_=total):
    problems = mod.check_note_coverage(placed_, pages_, total_)
    print(nom + " => " + (" ; ".join(problems) if problems else "aucune erreur"))

essai("intact", pages, placed)
essai("retiree", avec(lambda x: x.replace(block + "\\n", "", 1)), placed)
essai("dupliquee", avec(lambda x: x.replace(block + "\\n", block + "\\n\\n" + block + "\\n", 1)), placed)
essai("tronquee", avec(lambda x: x.replace(block, block[:30], 1)), placed)
essai("ajoutee", avec(lambda x: x + "\\nNote de cellule : Une note inventée.\\n"), placed)
essai("non-placee", pages, [n for n in placed if n["page"] != cible])
essai("autre-page", dict(pages, **{"capacites/barde-echo": pages["capacites/barde-echo"] + "\\n" + block + "\\n"}), placed)
essai("dump-plus-grand", pages, placed, total + 1)
`;

test('couverture : une note du dump retirée, dupliquée, tronquée, ajoutée, non placée ou écrite sur une autre fiche arrête le script (check_note_coverage)', { skip: sansPython }, () => {
  const ctx = preparer();
  const r = spawnSync('python3', ['-I', '-c', COUVERTURE, script, ctx.dump, 'guerrier-defensif'], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const lignes = Object.fromEntries(r.stdout.trim().split('\n').map((l) => l.split(' => ')));
  assert.equal(lignes.intact, 'aucune erreur');
  assert.match(lignes.retiree, /page « capacites\/guerrier-defensif » : note de la cellule Guerrier P5 attendue 1 fois, trouvée 0 fois/);
  assert.match(lignes.retiree, /8 note\(s\) dans le dump, 7 écrite\(s\) dans les pages/);
  assert.match(lignes.dupliquee, /note de la cellule Guerrier P5 attendue 1 fois, trouvée 2 fois/);
  assert.match(lignes.dupliquee, /8 note\(s\) dans le dump, 9 écrite\(s\)/);
  assert.match(lignes.tronquee, /note de la cellule Guerrier P5 attendue 1 fois, trouvée 0 fois/);
  assert.match(lignes.ajoutee, /page « capacites\/guerrier-defensif » : note de cellule inattendue/);
  assert.match(lignes['non-placee'], /note de la cellule Guerrier P5 : aucune fiche ne la reçoit/);
  assert.match(lignes['non-placee'], /8 note\(s\) dans le dump, 7 placée\(s\)/);
  assert.match(lignes['autre-page'], /page « capacites\/barde-echo » : note de cellule inattendue/);
  assert.match(lignes['dump-plus-grand'], /9 note\(s\) dans le dump, 8 placée\(s\)/);
});

// ---------------------------------------------------------------------------------------------------------------------------------
// --verifier : relecture indépendante, n'écrit rien
// ---------------------------------------------------------------------------------------------------------------------------------

test('--verifier : pages conformes, chaque note retrouvée une fois, cas d’erreur rejoués, rien n’est écrit', { skip: sansPython }, () => {
  const ctx = preparer();
  assert.equal(lancer(ctx).status, 0);
  const avant = toutesLesPages(ctx);
  const r = lancer(ctx, ['--verifier']);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, new RegExp(`${TOTAL} notes de cellule dans le dump, ${TOTAL} rattachées à un bloc d'effet, ${TOTAL} écrites`));
  assert.match(r.stdout, /cas d'erreur rejoués : \d+\/\d+ refusés avec un message/);
  assert.match(r.stdout, /VÉRIFICATION RÉUSSIE/);
  assert.deepEqual(toutesLesPages(ctx), avant);
});

test('--verifier : les cas d’erreur rejoués couvrent cellule vide, onglet non publié, note non placée, fil, note retirée, dupliquée, tronquée', { skip: sansPython }, () => {
  const ctx = preparer();
  assert.equal(lancer(ctx).status, 0);
  const r = lancer(ctx, ['--verifier']);
  assert.equal(r.status, 0, r.stdout);
  for (const cas of [
    'note sur une cellule vide',
    'note dans un onglet non publié',
    'note dans le Sommaire',
    'note non placée',
    'fil de commentaires',
    'note qui n\'est pas un texte',
    'note retirée d\'une page',
    'note dupliquée dans une page',
    'note tronquée dans une page',
    'note écrite sur une autre fiche',
  ]) {
    assert.match(r.stdout, new RegExp(`OK +.*${cas}`), `cas d'erreur rejoué absent : ${cas}`);
  }
});

test('--verifier : sur un dossier sans pages il signale les pages absentes et n’écrit rien', { skip: sansPython }, () => {
  const ctx = preparer();
  const r = lancer(ctx, ['--verifier']);
  assert.notEqual(r.status, 0);
  assert.match(r.stdout, /ÉCHEC/);
  assert.equal(fichiers(ctx).length, 0);
});

const SLUG = 'guerrier-aisance';
const VARIANTES = {
  'note retirée': (t) => t.replace(`\n\n${RENDU.deux}`, ''),
  'note dupliquée': (t) => t.replace(RENDU.deux, `${RENDU.deux}\n\n${RENDU.deux}`),
  'note tronquée': (t) => t.replace('là c\'est fatigue 2 (de même dans le cas de fatigue 2 à fatigue 3)', 'là c\'est fatigue 2'),
  'note altérée': (t) => t.replace('ne se cumule pas', 'se cumule'),
  'note d’une autre fiche collée à la place': (t) => t.replace(RENDU.deux, RENDU.liste),
  'note ajoutée sans cellule commentée': (t) => `${t.trimEnd()}\n\nNote de cellule : Une note inventée.\n`,
};
for (const [nomDuCas, variante] of Object.entries(VARIANTES)) {
  test(`--verifier : page modifiée (${nomDuCas}) signalée, fichier inchangé`, { skip: sansPython }, () => {
    const ctx = preparer();
    assert.equal(lancer(ctx).status, 0);
    modifierPage(ctx, SLUG, variante);
    const modifiee = readFileSync(join(ctx.capacites, `${SLUG}.md`), 'utf8');
    const r = lancer(ctx, ['--verifier']);
    assert.notEqual(r.status, 0, `--verifier doit signaler : ${nomDuCas}`);
    assert.match(r.stdout, new RegExp(`ÉCHEC[\\s\\S]*${SLUG.replace('-', '[- ]')}|ÉCHEC[\\s\\S]*Guerrier`));
    assert.equal(readFileSync(join(ctx.capacites, `${SLUG}.md`), 'utf8'), modifiee, '--verifier ne doit rien écrire');
  });
}

test('--verifier : une note de la même page recopiée sur une page sans note est signalée', { skip: sansPython }, () => {
  const ctx = preparer();
  assert.equal(lancer(ctx).status, 0);
  modifierPage(ctx, 'barde-menestrel', (t) => `${t.trimEnd()}\n\n${RENDU.simple}\n`);
  const r = lancer(ctx, ['--verifier']);
  assert.notEqual(r.status, 0);
  assert.match(r.stdout, /ÉCHEC/);
});

test('--verifier : une note perdue par le dump (dump sans note alors que les pages en ont) est signalée', { skip: sansPython }, () => {
  const ctx = preparer();
  assert.equal(lancer(ctx).status, 0);
  writeFileSync(ctx.dump, JSON.stringify(classeur()));
  const r = lancer(ctx, ['--verifier']);
  assert.notEqual(r.status, 0, `les pages portent ${TOTAL} notes que le dump n’a plus`);
  assert.match(r.stdout, /ÉCHEC/);
});

test('--verifier : sur le dump, une note sans place prévue est refusée avec le même message qu’à la génération', { skip: sansPython }, () => {
  const ctx = preparer();
  assert.equal(lancer(ctx).status, 0);
  writeFileSync(ctx.dump, JSON.stringify(poser(avecNotes(), 'Guerrier', 'N1', 'Une note')));
  const r = lancer(ctx, ['--verifier']);
  assert.notEqual(r.status, 0);
  assert.match(r.stdout, /sans place prévue/);
});

test('--verifier : sur le dump, une note sur une cellule vide ou dans un onglet non publié est refusée', { skip: sansPython }, () => {
  const ctx = preparer();
  assert.equal(lancer(ctx).status, 0);
  writeFileSync(ctx.dump, JSON.stringify(ajouter(avecNotes(), 'Guerrier', { r: 60, c: 3, v: '', note: 'Une note' })));
  const vide = lancer(ctx, ['--verifier']);
  assert.notEqual(vide.status, 0);
  assert.match(vide.stdout, /C60 est vide mais porte une note/);
  writeFileSync(ctx.dump, JSON.stringify(poser(avecNotes(), 'Combo stat', 'B2', 'Une note')));
  const nonPublie = lancer(ctx, ['--verifier']);
  assert.notEqual(nonPublie.status, 0);
  assert.match(nonPublie.stdout, /Combo stat.*ne publie pas/s);
});
