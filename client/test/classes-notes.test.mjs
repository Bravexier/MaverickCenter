// Notes de cellule du classeur « Classe Maverick V7 » dans les fiches de capacités (tools/sheets/classes.py).
// Une note (le petit commentaire jaune d'une cellule) précise parfois une règle : elle est citée telle quelle, jamais interprétée, à la
// suite de l'effet de la capacité dont elle commente le bloc, sous la forme « Note de cellule : <texte> » (rendu des 660 fiches, inchangé
// depuis l'import des notes directement dans le .xlsx).
//
// État de la source (contrôlé dans le .xlsx et dans le dump de xlsx_to_json.py) : 43 notes, aucun fil de commentaires, toutes sur la
// cellule en haut à gauche d'un bloc d'effet de capacité d'un onglet de classe : 43 fiches portent donc chacune une note.
//
// Trois familles de tests :
//   - le contenu RÉEL des fiches du dépôt : les 43 notes, chacune avec sa page, sa ligne, son rang, sa spécialité et son texte exact
//     (le texte du classeur ET le rendu Markdown, en dur : c'est ce qui, en CI, voit un mot changé, deux notes échangées entre deux
//     capacités, un échappement perdu ou une phrase ajoutée), leur nombre total ;
//   - `classes.py --verifier` sur le vrai dump (facultatif : CLASSES_DUMP, le dump n'est pas dans le dépôt) ;
//   - le code de l'extracteur, sur un classeur SYNTHÉTIQUE de même gabarit : les notes sont lues dans le CHAMP `note` DU DUMP, placées,
//     comptées ; refus (cellule vide, onglet non publié, note sans place, fil de commentaires) ; contrôle de couverture ; --verifier et
//     ses cas d'erreur rejoués ; recoupement des notes du dump avec un classeur .xlsx synthétique (--xlsx : une note perdue par le dump
//     arrête le script).
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { historiqueSite } from '../src/lib/historique-site.mjs';
import { texteSansBalises } from '../src/lib/mots-cles-balises.mjs';
import { chargerVocabulaire } from '../src/lib/mots-cles-db.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';

const script = fileURLToPath(new URL('../../tools/sheets/classes.py', import.meta.url));
const wiki = fileURLToPath(new URL('../src/content/wiki', import.meta.url));
const python = spawnSync('python3', ['-I', '-c', 'pass']);
const sansPython = python.status !== 0 && 'python3 absent';

const CLASSEUR = 'https://docs.google.com/spreadsheets/d/1Pyg4GSUlFrvNaTg3bi6uXlehg1MuRHmkyfPO6s5K72I/edit';
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
// Le site de dev est la source des dons qu'il modifie (décision du propriétaire ; D11 : il en crée et en supprime) : les notes et les fiches de
// l'import se comptent sur l'import (historique_modification) ; une fiche que le site a supprimée est sautée, sa place (rang, spécialité) se lit
// telle que l'import l'a écrite (le rang d'un don reçu sans choix suit les dons ajoutés au-dessus de lui).
const historique = historiqueSite(ouvrirBase({ sansExemples: false }));
const supprimee = (slug) => historique.supprimee('page', { id: `capacites/${slug}` });
const donneesDImport = (slug) => JSON.parse(historique.valeurDImport('page', { id: `capacites/${slug}` }, 'donnees') ?? 'null');
const supprimeesDImport = historique.lignesDImport('page').filter((p) => p.type === 'capacites' && supprimee(p.slug)).map((p) => p.slug);
const page = (slug) => {
  const trouvee = capacites.find((p) => p.slug === slug);
  assert.ok(trouvee, `page capacites/${slug} absente`);
  return trouvee.texte;
};

// Les 43 notes du classeur, une par fiche : [onglet, cellule (haut gauche du bloc d'effet), fiche de la capacité, rang, spécialité (undefined
// pour une capacité de classe), texte de la note tel que le classeur l'écrit (champ `note` du dump, en dur), rendu Markdown exact dans la fiche].
// Texte et rendu sont en dur pour CHACUNE des 43 : ce test ne dépend ni du dump ni du .xlsx (hors dépôt), c'est donc lui qui, en CI, voit
// un mot changé dans une note, deux notes échangées entre deux capacités, un échappement Markdown perdu ou une phrase ajoutée.
// La ligne de la cellule « Lvl N » (champ `ligne`) est celle du dessus : un bloc d'effet commence sur la ligne qui suit sa cellule « Lvl N ».
const NOTES = [
  ["Cuirassé", "P5", "cuirasse-defensif", 1, undefined,
    "Ne marche pas si l'ennemi contre-attaque.",
    "Note de cellule : Ne marche pas si l'ennemi contre-attaque."],
  ["Martiale", "D23", "martiale-heros", 1, "\"HÉROS\"",
    "Il existe une situation où le changement de posture n'est pas possible, c'est dans le cas où le personnage décide de passer en focus pour utiliser un sort niveau 5 pour après espérer un changement de posture. Si un sort de niveau 5 est lancé, le changement de posture n'est plus possible le reste du tour.",
    "Note de cellule : Il existe une situation où le changement de posture n'est pas possible, c'est dans le cas où le personnage décide de passer en focus pour utiliser un sort niveau 5 pour après espérer un changement de posture. Si un sort de niveau 5 est lancé, le changement de posture n'est plus possible le reste du tour."],
  ["Voleur", "A37", "voleur-faussaire", 1, "\"CAMBRIOLEUR\"",
    "La falsification de document est un jet d'artisanat qui demande Social + Intelligence",
    "Note de cellule : La falsification de document est un jet d'artisanat qui demande Social + Intelligence"],
  ["Tueur", "AE44", "tueur-sournefice", 2, "\"SICAIRE\"",
    "Si bien sûr la cible n'est pas immunisée. Les golems sont immunisés aux altérations d'états qui ne sont pas leur faiblesse",
    "Note de cellule : Si bien sûr la cible n'est pas immunisée. Les golems sont immunisés aux altérations d'états qui ne sont pas leur faiblesse"],
  ["Pugiliste", "P50", "pugiliste-coup-de-paume", 3, undefined,
    "Demande de réussir un jet d'attaque, l'ennemi peut parer ou esquiver.",
    "Note de cellule : Demande de réussir un jet d'attaque, l'ennemi peut parer ou esquiver."],
  ["Parleur", "P50", "parleur-negociateur", 3, undefined,
    "Marche seulement si bien sûr le combat est théoriquement arrêtable. Il est pas impossible que l'ennemi soit impossible à raisonner, dans ce cas soyez prudent et demandez si le combat est arrêtable.",
    "Note de cellule : Marche seulement si bien sûr le combat est théoriquement arrêtable. Il est pas impossible que l'ennemi soit impossible à raisonner, dans ce cas soyez prudent et demandez si le combat est arrêtable."],
  // deux paragraphes
  ["Bimane", "P12", "bimane-frappe-fatiguante", 2, undefined,
    "L'état de fatigue ne se cumule pas si le coup est répété sur la même cible.\n\nSi jamais la cible souffre déjà de fatigue 1 pour une autre raison, là c'est fatigue 2 (de même dans le cas de fatigue 2 à fatigue 3)",
    "Note de cellule : L'état de fatigue ne se cumule pas si le coup est répété sur la même cible.\n\nSi jamais la cible souffre déjà de fatigue 1 pour une autre raison, là c'est fatigue 2 (de même dans le cas de fatigue 2 à fatigue 3)"],
  ["Bimane", "A44", "bimane-poigne-du-titan", 1, "\"RAVAGEUR\"",
    "Vous ne pouvez pas avoir deux armes à deux mains dans chaque main.",
    "Note de cellule : Vous ne pouvez pas avoir deux armes à deux mains dans chaque main."],
  ["Bimane", "H44", "bimane-bien-sen-servir", 2, "\"RAVAGEUR\"",
    "Attention, ce coup a 30% de chance d'abîmer les armes",
    "Note de cellule : Attention, ce coup a 30% de chance d'abîmer les armes"],
  ["Archer", "X37", "archer-tir-soudain", 1, "\"GRAND ARCHER\"",
    "Les attaques d'opportunité s'enclenchent quand l'ennemi sort de la zone d'influence.",
    "Note de cellule : Les attaques d'opportunité s'enclenchent quand l'ennemi sort de la zone d'influence."],
  ["Arbalètrier", "X37", "arbaletrier-charger", 1, "\"BALISTE\"",
    "Ne marche le premier tour de jeu",
    "Note de cellule : Ne marche le premier tour de jeu"],
  // saut de ligne final dans le classeur : retiré
  ["Arbalètrier", "H44", "arbaletrier-agressivement", 2, "\"GRAND ARBALÉTRIER\"",
    "L'arbalète doit être rechargée.\n",
    "Note de cellule : L'arbalète doit être rechargée."],
  ["Arbalètrier", "P50", "arbaletrier-carreau-dacier", 3, undefined,
    "L'obstacle doit être assez fin, les mj seront libres de décider.",
    "Note de cellule : L'obstacle doit être assez fin, les mj seront libres de décider."],
  // liste, étoile à protéger
  ["Mage", "X30", "mage-soin-etrange", 1, "\"MAGE BLANC\"",
    "Il est capable de soigner aussi les morts vivants.\n*Sort d'attaque basique lvl 1 :\n- Boule de sang\n- Boule de chakra\n- Boule sombre\n- Coup du sablier\n- Bulle de vide\n- Tir d'âme\n- Boule de feu\n- Bulle d'eau\n- Éclat glacé\n- Lance-pierre\n- Lame d'air\n- Éclair\n- Frappe lumineuse\n- Sphère obscure",
    "Note de cellule : Il est capable de soigner aussi les morts vivants.  \n\\*Sort d'attaque basique lvl 1 :\n\n- Boule de sang\n- Boule de chakra\n- Boule sombre\n- Coup du sablier\n- Bulle de vide\n- Tir d'âme\n- Boule de feu\n- Bulle d'eau\n- Éclat glacé\n- Lance-pierre\n- Lame d'air\n- Éclair\n- Frappe lumineuse\n- Sphère obscure"],
  // tabulations en fin de ligne dans le classeur : retirées ; trois lignes
  ["Mage", "A44", "mage-toujours-plus", 1, "\"MAGE NOIR\"",
    "Bien entendu qu'on parle des sorts qui sont non IC. Le deuxième sort crame un IC sur les 3 disponibles dans le tour donc prudence à en avoir un avant d'utiliser cette capacité.\nPeut lancer deux sorts de soin ou/et d'amplification en 1 seul tour. Il est nécessaire de réussir un jet de concentration entre les deux sorts.\t\t\t\t\t\nLes deux sorts doivent être différents.",
    "Note de cellule : Bien entendu qu'on parle des sorts qui sont non IC. Le deuxième sort crame un IC sur les 3 disponibles dans le tour donc prudence à en avoir un avant d'utiliser cette capacité.  \nPeut lancer deux sorts de soin ou/et d'amplification en 1 seul tour. Il est nécessaire de réussir un jet de concentration entre les deux sorts.  \nLes deux sorts doivent être différents."],
  // même texte (en partie) que sur la capacité voisine, note propre à sa cellule
  ["Mage", "X44", "mage-deux-fois-plus", 1, "\"MAGE BLANC\"",
    "Bien entendu qu'on parle des sorts qui sont non IC. Le deuxième sort crame un IC sur les 3 disponibles dans le tour donc prudence à en avoir un avant d'utiliser cette capacité.\nLes deux sorts doivent être différents.",
    "Note de cellule : Bien entendu qu'on parle des sorts qui sont non IC. Le deuxième sort crame un IC sur les 3 disponibles dans le tour donc prudence à en avoir un avant d'utiliser cette capacité.  \nLes deux sorts doivent être différents."],
  ["Mage", "AE44", "mage-soin-similaire", 2, "\"MAGE BLANC\"",
    "Si jamais le lanceur est un mort vivant et qu'il soigne via la magie de la lumière, il récupère quand même la santé qu'il soigne.",
    "Note de cellule : Si jamais le lanceur est un mort vivant et qu'il soigne via la magie de la lumière, il récupère quand même la santé qu'il soigne."],
  ["Mage Rouge", "P5", "mage-rouge-preparation", 1, undefined,
    "Le sort prend en compte la posture le moment où il a été chargé pour le calcul des dégâts de ce dernier.\n\nLa posture focus transforme ce don en IC.\n\nLe sort en question ne se met pas sur l'arme mais bien dans la main.",
    "Note de cellule : Le sort prend en compte la posture le moment où il a été chargé pour le calcul des dégâts de ce dernier.\n\nLa posture focus transforme ce don en IC.\n\nLe sort en question ne se met pas sur l'arme mais bien dans la main."],
  ["Mage Rouge", "P50", "mage-rouge-double-coup", 3, undefined,
    "Dans le cas d'un critique, ce sera que pour le premier coup, les prochains c'est fixé à 40 de réussite.\nConsomme le chakra à chaque sort.\n\nPensez bien à noter la réussite du sort pour ne pas le perdre.",
    "Note de cellule : Dans le cas d'un critique, ce sera que pour le premier coup, les prochains c'est fixé à 40 de réussite.  \nConsomme le chakra à chaque sort.\n\nPensez bien à noter la réussite du sort pour ne pas le perdre."],
  ["Mage Vert", "P5", "mage-vert-chargement", 1, undefined,
    "Permet de charger un sort d'attaque lvl1 ou lvl2 le premier tour et de l'utiliser en même temps que l'attaque de distance le tour suivant.\n\nIl est nécessaire que le sort possède la portée pour toucher la cible, si le projectile va plus loin, le sort ne marche pas.\n\nLa posture focus transforme ce don en IC.",
    "Note de cellule : Permet de charger un sort d'attaque lvl1 ou lvl2 le premier tour et de l'utiliser en même temps que l'attaque de distance le tour suivant.\n\nIl est nécessaire que le sort possède la portée pour toucher la cible, si le projectile va plus loin, le sort ne marche pas.\n\nLa posture focus transforme ce don en IC."],
  // guillemets droits
  ["Mage Vert", "H30", "mage-vert-brutale", 2, "\"MAGE ÉMERAUDE\"",
    "Les sorts \"fer\"",
    "Note de cellule : Les sorts \"fer\""],
  ["Mage Vert", "P50", "mage-vert-double-coup", 3, undefined,
    "Dans le cas d'un critique, ce sera que pour le premier coup, les prochains c'est fixé à 40 de réussite.\nConsomme le chakra à chaque sort.\n\nPensez bien à noter la réussite du sort pour ne pas le perdre.",
    "Note de cellule : Dans le cas d'un critique, ce sera que pour le premier coup, les prochains c'est fixé à 40 de réussite.  \nConsomme le chakra à chaque sort.\n\nPensez bien à noter la réussite du sort pour ne pas le perdre."],
  ["Mage Bleu", "P5", "mage-bleu-mimetisme", 1, undefined,
    "Le sort prend en compte la posture le moment où il a été chargé pour le calcul des dégâts de ce dernier.\n\nLa posture focus transforme ce don en IC.",
    "Note de cellule : Le sort prend en compte la posture le moment où il a été chargé pour le calcul des dégâts de ce dernier.\n\nLa posture focus transforme ce don en IC."],
  ["Maclier", "X30", "maclier-frisbee", 1, "\"GRAND MACLIER\"",
    "Si un adversaire fait une parade parfaite. Le bouclier s'arrête dans sa course.",
    "Note de cellule : Si un adversaire fait une parade parfaite. Le bouclier s'arrête dans sa course."],
  ["Maclier", "X44", "maclier-miroir", 1, "\"GRAND MACLIER\"",
    "Un jet de parade doit être réussi",
    "Note de cellule : Un jet de parade doit être réussi"],
  ["Maclier", "AE44", "maclier-parfait", 2, "\"GRAND MACLIER\"",
    "Un jet de parade parfait doit être réussi",
    "Note de cellule : Un jet de parade parfait doit être réussi"],
  ["Ocultomancien", "P5", "ocultomancien-econome", 1, undefined,
    "un sort de puissance 1 coûte 1 Chakra de moins, un sort de puissance 4 coûte 4 Chakra de moins, etc",
    "Note de cellule : un sort de puissance 1 coûte 1 Chakra de moins, un sort de puissance 4 coûte 4 Chakra de moins, etc"],
  ["Ocultomancien", "A30", "ocultomancien-pilonnage", 1, "\"SPÉCIALISTE\"",
    "Ne brise pas l'immunité de la posture symbiose et du mode hyper",
    "Note de cellule : Ne brise pas l'immunité de la posture symbiose et du mode hyper"],
  ["Ocultomancien", "AE37", "ocultomancien-climatosceptique", 2, "\"MÉTÉOROLOGUE\"",
    "Sauf la zone vide",
    "Note de cellule : Sauf la zone vide"],
  // même texte sur deux cellules d'une même ligne : une note par page
  ["Flagelleur", "X30", "flagelleur-puni-moi", 1, "\"MASOCHISTE\"",
    "Dans le cas du potentiel illimité, lancer un D14 pour déterminer une résistance magique aléatoire",
    "Note de cellule : Dans le cas du potentiel illimité, lancer un D14 pour déterminer une résistance magique aléatoire"],
  ["Flagelleur", "AE30", "flagelleur-plus-fort", 2, "\"MASOCHISTE\"",
    "Dans le cas du potentiel illimité, lancer un D14 pour déterminer une résistance magique aléatoire",
    "Note de cellule : Dans le cas du potentiel illimité, lancer un D14 pour déterminer une résistance magique aléatoire"],
  // mêmes textes dans deux classes différentes : une fois chacune
  ["Orios", "H30", "orios-gigantisme", 2, "\"VA-T-EN-GUERRE\"",
    "Bien entendu il est nécessaire d'avoir minimum 4 de force pour les porter : \n- Épée temple\n- Claymore (qui devient une arme de force)\n- Broyeur\n- Hache de Bataille\n- Bardiche\n- Tronc\n- Arc de guerre géant (là c'est juste une permission d'utiliser l'arme)\n- Baliste portable (même chose que pour l'arc de guerre géant)",
    "Note de cellule : Bien entendu il est nécessaire d'avoir minimum 4 de force pour les porter :\n\n- Épée temple\n- Claymore (qui devient une arme de force)\n- Broyeur\n- Hache de Bataille\n- Bardiche\n- Tronc\n- Arc de guerre géant (là c'est juste une permission d'utiliser l'arme)\n- Baliste portable (même chose que pour l'arc de guerre géant)"],
  ["Minotaure", "H30", "minotaure-gigantisme", 2, "\"GLADIATEUR\"",
    "Bien entendu il est nécessaire d'avoir minimum 4 de force pour les porter : \n- Épée temple\n- Claymore (qui devient une arme de force)\n- Broyeur\n- Hache de Bataille\n- Bardiche\n- Tronc\n- Arc de guerre géant (là c'est juste une permission d'utiliser l'arme)\n- Baliste portable (même chose que pour l'arc de guerre géant)",
    "Note de cellule : Bien entendu il est nécessaire d'avoir minimum 4 de force pour les porter :\n\n- Épée temple\n- Claymore (qui devient une arme de force)\n- Broyeur\n- Hache de Bataille\n- Bardiche\n- Tronc\n- Arc de guerre géant (là c'est juste une permission d'utiliser l'arme)\n- Baliste portable (même chose que pour l'arc de guerre géant)"],
  ["Marcass", "H30", "marcass-catapulte", 2, "\"CANAILLE\"",
    "Doit y avoir de la place derrière et en haut pour le faire ! Sinon sprotch...\n\nL'ami doit être assez léger.",
    "Note de cellule : Doit y avoir de la place derrière et en haut pour le faire ! Sinon sprotch...\n\nL'ami doit être assez léger."],
  ["Marcass", "AE30", "marcass-ca-va-plus-vite", 2, "\"DÉVOT\"",
    "Rouge",
    "Note de cellule : Rouge"],
  // trois paragraphes
  ["Marcass", "X37", "marcass-totemiste", 1, "\"DÉVOT\"",
    "Terre : Réduit les dégâts encaissés de 4.\n\nFeu : Augmente les dégâts infligés de 4. \n\nNécromancie : Économise 1 chakra à chaque sort lancé.",
    "Note de cellule : Terre : Réduit les dégâts encaissés de 4.\n\nFeu : Augmente les dégâts infligés de 4.\n\nNécromancie : Économise 1 chakra à chaque sort lancé."],
  ["Marcass", "AE37", "marcass-cest-plus-dur", 2, "\"DÉVOT\"",
    "Brun",
    "Note de cellule : Brun"],
  ["Marcass", "H44", "marcass-lance-totem", 2, "\"CANAILLE\"",
    "Si une cible réussit un jet de défense parfait, l'attaque est stoppée",
    "Note de cellule : Si une cible réussit un jet de défense parfait, l'attaque est stoppée"],
  ["Marcass", "AE44", "marcass-cest-meilleur", 2, "\"DÉVOT\"",
    "Vert foncé",
    "Note de cellule : Vert foncé"],
  ["Anansi", "P5", "anansi-coup-dpatte", 1, undefined,
    "Le coup de pattes n'est compté qu'une fois. Le bimane ne peut faire en sorte que la patte tape deux fois dans le même tour.",
    "Note de cellule : Le coup de pattes n'est compté qu'une fois. Le bimane ne peut faire en sorte que la patte tape deux fois dans le même tour."],
  ["Anansi", "P12", "anansi-piege-toile", 2, undefined,
    "La cible peut réussir un jet d'athlétisme/réflexe pour s'ôter de la toile.",
    "Note de cellule : La cible peut réussir un jet d'athlétisme/réflexe pour s'ôter de la toile."],
  // étoile à protéger en tête de note
  ["Anansi", "AE37", "anansi-pt-fragile", 2, "\"CEMIES\"",
    "*Dans le cas de l'Arcane, ce sera aléatoire parmi les autres magies qui existent.",
    "Note de cellule : \\*Dans le cas de l'Arcane, ce sera aléatoire parmi les autres magies qui existent."],
  ["Anansi", "A44", "anansi-magie-patte", 1, "\"MARIONNETTISTE\"",
    "Arcane = Le coup de patte peut prendre en compte l'AM plutôt que l'AP\n\nNécromancie = Oblige le jet de vigueur à la cible pour ne pas prendre \"poison 1\"\n\nOmbre = Impose un malus de 10% au prochain jet de la victime",
    "Note de cellule : Arcane = Le coup de patte peut prendre en compte l'AM plutôt que l'AP\n\nNécromancie = Oblige le jet de vigueur à la cible pour ne pas prendre \"poison 1\"\n\nOmbre = Impose un malus de 10% au prochain jet de la victime"],
];

test('pages réelles : 660 fiches de capacités du classeur, 43 notes rendues au total, une par fiche, aucune ailleurs', () => {
  // à l'import : 660 fiches et 43 notes ; aujourd'hui, sans les fiches que le site a supprimées
  assert.equal(capacites.length + supprimeesDImport.length, 660);
  assert.equal(NOTES.length, 43);
  const presentes = NOTES.filter(([, , slug]) => !supprimee(slug));
  const avecNote = capacites.filter((p) => nbNotes(p.texte) > 0);
  assert.equal(capacites.reduce((somme, p) => somme + nbNotes(p.texte), 0), presentes.length);
  assert.deepEqual(avecNote.map((p) => [p.slug, nbNotes(p.texte)]).sort(), presentes.map(([, , slug]) => [slug, 1]).sort());
  // ni les pages de classes ni le glossaire ne reçoivent de note de cellule
  const classes = readdirSync(join(wiki, 'classes')).filter((f) => f.endsWith('.md'));
  assert.ok(classes.length >= 39);
  for (const f of classes) assert.equal(nbNotes(readFileSync(join(wiki, 'classes', f), 'utf8')), 0, `classes/${f}`);
  assert.equal(nbNotes(readFileSync(join(wiki, 'ressources', 'objets-de-depart-des-classes.md'), 'utf8')), 0);
});

test('pages réelles : chaque note est sur la fiche de la capacité dont elle commente le bloc (ligne de la cellule « Lvl N » au-dessus)', () => {
  for (const [onglet, cellule, slug] of NOTES.filter(([, , s]) => !supprimee(s))) {
    const p = page(slug);
    const { r } = adresse(cellule);
    assert.equal(Number(champ(p, 'ligne')), r - 1, `${onglet} ${cellule} -> ${slug} : ligne ${champ(p, 'ligne')}`);
    assert.ok(p.includes(`onglet « ${onglet} »`), `${slug} : sources de l'onglet « ${onglet} »`);
    assert.equal(nbNotes(p), 1, slug);
  }
});

// une balise du glossaire posée depuis par le site de dev (« {{chakra|chakra}} ») ne change pas le texte de la note : la page se lit sans elles
const vocabulaire = chargerVocabulaire(ouvrirBase({ sansExemples: false }));
const corpsAffiche = (p) => texteSansBalises(corps(p), vocabulaire, { markdown: true });
for (const [onglet, cellule, slug, rang, specialite, source, rendu] of NOTES) {
  test(`pages réelles : ${onglet} ${cellule} -> « ${slug} », texte de la note intégral`, { skip: supprimee(slug) && 'fiche supprimée par le site de dev' }, () => {
    const p = page(slug);
    // sa place telle que l'import l'a écrite (le site peut ajouter un don reçu sans choix au-dessus, renommer une spécialité)
    const d = donneesDImport(slug);
    assert.equal(d.rang, rang);
    assert.equal(d.specialite === undefined ? undefined : JSON.stringify(d.specialite), specialite);
    // la note termine la page, juste après l'effet, une seule fois, telle que rendue
    assert.ok(corpsAffiche(p).endsWith(`\n\n${rendu}\n`), `${slug} : la page ne se termine pas par :\n${rendu}\n---\n${corps(p)}`);
    assert.equal(corpsAffiche(p).split(rendu).length - 1, 1);
    // texte du classeur = texte de la page, aux échappements Markdown, puces et espaces près
    assert.equal(aplatir(rendu), aplatir(MARQUEUR + source));
  });
}

test('pages réelles : deux notes au texte identique dans deux classes (Orios, Minotaure) ou sur deux cellules voisines (Flagelleur) : une fois par page', () => {
  for (const slug of ['orios-gigantisme', 'minotaure-gigantisme', 'flagelleur-puni-moi', 'flagelleur-plus-fort'].filter((s) => !supprimee(s))) assert.equal(nbNotes(page(slug)), 1, slug);
  // la note de Mage A44 contient une phrase qui est l'effet de X44 : chaque fiche garde la note de SA cellule, pas celle de la voisine
  const phrase = "Peut lancer deux sorts de soin ou/et d'amplification";
  if (!supprimee('mage-toujours-plus')) assert.equal(corps(page('mage-toujours-plus')).split(phrase).length - 1, 1, 'dans la note de A44 (son effet parle des sorts d’attaque)');
  if (!supprimee('mage-deux-fois-plus')) assert.equal(corps(page('mage-deux-fois-plus')).split(phrase).length - 1, 1, 'dans l’effet de X44 seulement, sa note ne la répète pas');
});

// Facultatif (le vrai dump n'est pas dans le dépôt) :
//   CLASSES_DUMP=<classes-v7.corrige.json> [CLASSES_XLSX=<classeur.xlsx>] node --test test/classes-notes.test.mjs
// Avec CLASSES_XLSX, les 43 notes du dump sont aussi recoupées avec celles du classeur (adresse par adresse).
// Le site de dev est la source : dès qu'il a créé ou supprimé un don ou une spécialité (D11), les pages ne sont plus celles du dump, la vérification se saute.
const dumpReel = process.env.CLASSES_DUMP;
const remanieParLeSite = historique.lignesRemaniees('capacite').length + historique.lignesRemaniees('specialite').length > 0
  && 'le site de dev a créé ou supprimé des dons ou des spécialités : les pages ne sont plus celles du dump (le site est la source)';
test('classes.py --verifier : les pages du dépôt sont celles que le vrai dump produit, les 43 notes retrouvées (CLASSES_DUMP)', {
  skip: sansPython || (!dumpReel && 'CLASSES_DUMP non défini (dump hors dépôt)') || remanieParLeSite,
}, () => {
  const options = process.env.CLASSES_XLSX ? ['--xlsx', process.env.CLASSES_XLSX] : [];
  const r = spawnSync('python3', ['-I', script, '--dump', dumpReel, ...options, '--out', wiki, '--verifier'], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /43 notes de cellule dans le dump, 43 rattachées à un bloc d'effet, 43 écrites/);
  if (process.env.CLASSES_XLSX) assert.match(r.stdout, /OK +\(2 ter\) .*43 notes dans le classeur, mêmes adresses dans le dump/);
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
    ['A1', 'Classe Physique Corps à Corps'], ['E1', 'Classe Magique'], ['A2', 'Guerrier'], ['E2', 'Troubadour'],
    ['A17', 'Il vous suffit de cliquer sur le nom de la classe.'],
    ['A19', 'OBJETS DES INVENTAIRES DE DEPART'], ['A21', 'Fiole rouge : Une fiole.\n\nTorche : Une torche.'],
  ].map(([ref, v]) => ({ ...adresse(ref), v })),
});

const classeur = () => ({
  sheets: [
    sommaire(),
    ongletClasse('Guerrier', { capsP: [['Lvl 1', 'Défensif', 'Effet de Défensif', 'Passif'], ['Lvl 5', 'Aisance', 'Effet de Aisance', 'Passif'], ['Lvl 20', 'Égide', 'Effet de Égide', 'Réaction']] }),
    ongletClasse('Troubadour', { capsP: [['Lvl 1', 'Prestation', 'Effet de Prestation', 'Passif'], ['Lvl 5', 'Son perturbant', 'Effet de Son perturbant', 'Actif'], ['Lvl 20', 'Chant double', 'Effet de Chant double', 'Passif']], specialites: true }),
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
  identique: 'Dans le cas du potentiel illimité, lancer un D14 pour déterminer une résistance magique aléatoire',
};
const NOTES_SYNTH = [
  ['Guerrier', 'P5', N.simple],
  ['Guerrier', 'P12', N.deux],
  ['Guerrier', 'P50', N.final],
  ['Troubadour', 'D23', N.cartouche],
  ['Troubadour', 'A30', N.liste],
  ['Troubadour', 'H30', N.simple],
  ['Troubadour', 'X30', N.identique],
  ['Troubadour', 'AE30', N.identique],
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
  ['troubadour-danseur', 'Effet de Danseur', RENDU.cartouche],
  ['troubadour-perroquet', 'Effet de Perroquet', RENDU.liste],
  ['troubadour-contournement', 'Effet de Contournement', RENDU.simple],
  ['troubadour-nouvel-accord', 'Effet de Nouvel accord', RENDU.identique],
  ['troubadour-echo', 'Effet de Écho', RENDU.identique],
];
const TOTAL = NOTES_SYNTH.length;
const SANS_NOTE = ['troubadour-menestrel', 'troubadour-prestation', 'troubadour-son-perturbant', 'troubadour-chant-double'];

function preparer(dump = avecNotes()) {
  const dir = dossierTemporaire('classes-notes');
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

test('notes : un dump sans aucune note (ancien xlsx_to_json.py) n’efface pas les notes déjà écrites : le script s’arrête', { skip: sansPython }, () => {
  const ctx = preparer();
  assert.equal(lancer(ctx).status, 0);
  const avant = toutesLesPages(ctx);
  writeFileSync(ctx.dump, JSON.stringify(classeur()));
  const r = lancer(ctx);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /le dump ne contient aucune note de cellule alors que 8 fiche\(s\) en portent déjà/);
  assert.deepEqual(toutesLesPages(ctx), avant, 'aucune page ne doit être modifiée');
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
pages = {c + "/" + s: body for c, s, t, body, n in built["jobs"]}
placed = built["notes"]
dump = built["notes_dump"]
cible = "capacites/" + sys.argv[3]
block = "\\n".join(mod.md_text("Note de cellule : " + next(n["text"] for n in placed if n["page"] == cible)))

def avec(modif):
    return dict(pages, **{cible: modif(pages[cible])})

def essai(nom, pages_, placed_, dump_=dump):
    problems = mod.check_note_coverage(dump_, placed_, pages_)
    print(nom + " => " + (" ; ".join(problems) if problems else "aucune erreur"))

essai("intact", pages, placed)
essai("retiree", avec(lambda x: x.replace(block + "\\n", "", 1)), placed)
essai("dupliquee", avec(lambda x: x.replace(block + "\\n", block + "\\n\\n" + block + "\\n", 1)), placed)
essai("tronquee", avec(lambda x: x.replace(block, block[:30], 1)), placed)
essai("ajoutee", avec(lambda x: x + "\\nNote de cellule : Une note inventée.\\n"), placed)
essai("non-placee", pages, [n for n in placed if n["page"] != cible])
essai("autre-page", dict(pages, **{"capacites/troubadour-echo": pages["capacites/troubadour-echo"] + "\\n" + block + "\\n"}), placed)
essai("dump-plus-grand", pages, placed, dict(dump, Guerrier=dict(dump["Guerrier"], P7="Une note de plus")))
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
  assert.match(lignes['autre-page'], /page « capacites\/troubadour-echo » : note de cellule inattendue/);
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
  modifierPage(ctx, 'troubadour-menestrel', (t) => `${t.trimEnd()}\n\n${RENDU.simple}\n`);
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

// ---------------------------------------------------------------------------------------------------------------------------------
// Recoupement des notes du dump avec le classeur .xlsx (--xlsx) : une note perdue par le dump ne passe pas en silence
// ---------------------------------------------------------------------------------------------------------------------------------
// Les notes viennent du dump ; le .xlsx, lui, n'est lu que pour les hyperliens. Mais quand il est fourni, il porte les mêmes notes : un
// dump qui en a perdu une seule (ancien xlsx_to_json.py, dump copié d'un autre classeur) réécrirait la fiche sans elle et le contrôle de
// couverture, qui compare les pages au dump, passerait. Le recoupement compare donc, onglet par onglet, les adresses des notes et des
// fils de commentaires du dump à celles du .xlsx (lecture de tools/sheets/xlsx_comments.py, comme xlsx_to_json.py), et arrête le script
// sans rien écrire en cas d'écart. Les textes ne sont comparés qu'à titre d'avertissement : le registre des corrections peut en retoucher.

const LIEN = 'https://example.org/familiers';
const fixtureXlsx = fileURLToPath(new URL('./fixtures/make-xlsx-notes.py', import.meta.url));
const refA1 = (r, c) => {
  let lettres = '';
  for (let k = c; k > 0; k = Math.floor((k - 1) / 26)) lettres = String.fromCharCode(65 + ((k - 1) % 26)) + lettres;
  return `${lettres}${r}`;
};

// Fabrique un .xlsx minimal (zipfile, comme client/test/fixtures/make-xlsx-notes.py dont il reprend les briques) : un onglet par onglet
// de la spécification, ses notes (comments*.xml), ses fils (threadedComments) et ses hyperliens externes.
const FABRIQUE_XLSX = `
import importlib.util, json, sys, zipfile
from xml.sax.saxutils import escape
spec_ = importlib.util.spec_from_file_location("fx", sys.argv[1])
fx = importlib.util.module_from_spec(spec_)
spec_.loader.exec_module(fx)
spec = json.load(open(sys.argv[2], encoding="utf-8"))
HEAD = fx.HEAD
parts, sheets, wb_rels = {}, [], []
for i, sh in enumerate(spec["onglets"], 1):
    sheets.append('<sheet name="%s" sheetId="%d" r:id="rId%d"/>' % (escape(sh["name"], {'"': "&quot;"}), i, i))
    wb_rels.append(fx.rel("rId%d" % i, "worksheet", "worksheets/sheet%d.xml" % i))
    rel_items, extra = [], ""
    if sh.get("links"):
        hyperlinks = ""
        for j, (ref, url) in enumerate(sh["links"].items(), 1):
            hyperlinks += '<hyperlink ref="%s" r:id="rIdL%d"/>' % (ref, j)
            rel_items.append('<Relationship Id="rIdL%d" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" '
                             'Target="%s" TargetMode="External"/>' % (j, escape(url)))
        extra += "<hyperlinks>%s</hyperlinks>" % hyperlinks
    notes, threads = sh.get("notes", {}), sh.get("threads", {})
    if notes or threads:
        items = [("{00000000-0000-0000-0000-%012d}" % k, ref, text, 0, None) for k, (ref, text) in enumerate(threads.items(), 1)]
        authors = [""] + ["tc=" + t[0] for t in items]
        listed = [(ref, 0, fx.plain(text)) for ref, text in notes.items()]
        listed += [(t[1], k, fx.plain(fx.SHADOW % t[2])) for k, t in enumerate(items, 1)]
        parts["xl/comments%d.xml" % i] = fx.comments_xml(authors, listed)
        rel_items.append(fx.rel("rIdC", "comments", "../comments%d.xml" % i))
        if items:
            parts["xl/threadedComments/threadedComment%d.xml" % i] = fx.threads_xml(items)
            rel_items.append(fx.rel("rIdT", "threadedComment", "../threadedComments/threadedComment%d.xml" % i,
                                    "http://schemas.microsoft.com/office/2017/10/relationships"))
    if rel_items:
        parts["xl/worksheets/_rels/sheet%d.xml.rels" % i] = fx.rels(*rel_items)
    parts["xl/worksheets/sheet%d.xml" % i] = HEAD + '<worksheet xmlns="%s" xmlns:r="%s"><sheetData/>%s</worksheet>' % (fx.NS_MAIN, fx.NS_R, extra)
parts["xl/workbook.xml"] = HEAD + '<workbook xmlns="%s" xmlns:r="%s"><sheets>%s</sheets></workbook>' % (fx.NS_MAIN, fx.NS_R, "".join(sheets))
parts["xl/_rels/workbook.xml.rels"] = fx.rels(*wb_rels)
parts["_rels/.rels"] = fx.rels(fx.rel("rId1", "officeDocument", "xl/workbook.xml"))
parts["[Content_Types].xml"] = (HEAD + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
    '<Default Extension="xml" ContentType="application/xml"/></Types>')
with zipfile.ZipFile(sys.argv[3], "w", zipfile.ZIP_DEFLATED) as zf:
    for name, data in parts.items():
        zf.writestr(name, data)
`;

/** Contenu du classeur .xlsx qui correspond à \`dump\` : mêmes onglets, mêmes notes, et (sauf \`avecLien\` faux) un hyperlien externe en
 * Troubadour!P5. */
const specXlsx = (dump, avecLien = true) => ({
  onglets: dump.sheets.map((s) => ({
    name: s.name,
    notes: Object.fromEntries(s.cells.filter((c) => typeof c.note === 'string' && c.note.trim()).map((c) => [refA1(c.r, c.c), c.note])),
    threads: {},
    links: avecLien && s.name === 'Troubadour' ? { P5: LIEN } : {},
  })),
});
const onglet = (spec, nom) => spec.onglets.find((o) => o.name === nom);

function ecrireXlsx(ctx, spec) {
  const chemin = join(ctx.dir, 'classeur.xlsx');
  const specification = join(ctx.dir, 'xlsx-spec.json');
  writeFileSync(specification, JSON.stringify(spec));
  const r = spawnSync('python3', ['-I', '-c', FABRIQUE_XLSX, fixtureXlsx, specification, chemin], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  return chemin;
}
function lancerAvecClasseur(ctx, xlsx, args = []) {
  return spawnSync('python3', ['-I', script, '--dump', ctx.dump, '--xlsx', xlsx, '--out', ctx.out, ...args], { encoding: 'utf8' });
}
/** Un dump auquel il manque la note de Guerrier!P12 (« deux paragraphes ») : le classeur, lui, la porte encore. */
const sansNoteP12 = () => {
  const dump = avecNotes();
  delete dump.sheets.find((s) => s.name === 'Guerrier').cells.find((c) => c.r === 12 && c.c === 16).note;
  return dump;
};

test('recoupement : un classeur .xlsx qui porte les mêmes notes que le dump passe, l’hyperlien est rendu, le reste des pages est inchangé', { skip: sansPython }, () => {
  const ctx = preparer();
  const xlsx = ecrireXlsx(ctx, specXlsx(avecNotes()));
  const r = lancerAvecClasseur(ctx, xlsx);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, new RegExp(`recoupement des notes avec le classeur : ${TOTAL} notes de cellule, mêmes adresses que dans le dump`));
  assert.doesNotMatch(r.stderr, /AVERTISSEMENT|ERREUR/);
  const reference = preparer();
  assert.equal(lancer(reference).status, 0);
  const pages = toutesLesPages(ctx);
  const sansLiens = toutesLesPages(reference);
  assert.deepEqual(Object.keys(pages), Object.keys(sansLiens));
  const lien = `*Lien hypertexte attaché à la cellule P5 dans le classeur d'origine :* <${LIEN}>`;
  for (const [chemin, texte] of Object.entries(pages)) {
    if (chemin === 'capacites/troubadour-prestation.md') {
      assert.equal(texte, `${sansLiens[chemin].trimEnd()}\n\n${lien}\n`);
    } else {
      assert.equal(texte, sansLiens[chemin], chemin);
    }
  }
});

test('recoupement : un dump qui a perdu UNE note que le classeur porte arrête le script, aucune page n’est réécrite', { skip: sansPython }, () => {
  const ctx = preparer();
  const xlsx = ecrireXlsx(ctx, specXlsx(avecNotes()));
  assert.equal(lancerAvecClasseur(ctx, xlsx).status, 0);
  const avant = toutesLesPages(ctx);
  assert.equal(nbNotes(avant['capacites/guerrier-aisance.md']), 1);
  writeFileSync(ctx.dump, JSON.stringify(sansNoteP12()));
  const r = lancerAvecClasseur(ctx, xlsx);
  assert.notEqual(r.status, 0, 'le script devait s’arrêter : le dump a perdu une note');
  assert.match(r.stderr, /onglet « Guerrier » : .*classeur.*P12/s);
  assert.match(r.stderr, /xlsx_to_json\.py/);
  assert.deepEqual(toutesLesPages(ctx), avant, 'la fiche ne doit pas être réécrite sans sa note');
  assert.equal(nbNotes(lire(ctx, 'guerrier-aisance')), 1);
});

test('recoupement : sur un dossier vide, un dump qui a perdu une note n’écrit aucune page', { skip: sansPython }, () => {
  const ctx = preparer(sansNoteP12());
  const r = lancerAvecClasseur(ctx, ecrireXlsx(ctx, specXlsx(avecNotes())));
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /Guerrier.*P12/s);
  assert.equal(fichiers(ctx).length, 0);
  assert.equal(existsSync(join(ctx.out, 'classes')), false);
});

test('recoupement : le dump a une note que le classeur n’a pas (dump d’un autre classeur) : arrêt', { skip: sansPython }, () => {
  const ctx = preparer();
  const spec = specXlsx(avecNotes());
  delete onglet(spec, 'Troubadour').notes.A30;
  const r = lancerAvecClasseur(ctx, ecrireXlsx(ctx, spec));
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /onglet « Troubadour » : .*dump.*absentes? du classeur.*A30/s);
  assert.equal(fichiers(ctx).length, 0);
});

test('recoupement : une note du classeur dans un onglet non publié que le dump a perdue est détectée aussi (Combo stat)', { skip: sansPython }, () => {
  const ctx = preparer();
  const spec = specXlsx(avecNotes());
  onglet(spec, 'Combo stat').notes.B2 = 'Une note que le dump a perdue';
  const r = lancerAvecClasseur(ctx, ecrireXlsx(ctx, spec));
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /onglet « Combo stat » : .*B2/s);
  assert.equal(fichiers(ctx).length, 0);
});

test('recoupement : un fil de commentaires du classeur que le dump a perdu est détecté (le script n’en publie aucun)', { skip: sansPython }, () => {
  const ctx = preparer();
  const spec = specXlsx(avecNotes());
  onglet(spec, 'Guerrier').threads.P5 = 'Une conversation';
  const r = lancerAvecClasseur(ctx, ecrireXlsx(ctx, spec));
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /onglet « Guerrier » : .*fils?.*P5/s);
  assert.equal(fichiers(ctx).length, 0);
});

test('recoupement : un fil de commentaires que le dump porte et que le classeur n’a pas est signalé par le recoupement lui-même', { skip: sansPython }, () => {
  const ctx = preparer(poser(avecNotes(), 'Guerrier', 'P5', [{ text: 'Une conversation' }], 'threads'));
  const r = lancerAvecClasseur(ctx, ecrireXlsx(ctx, specXlsx(avecNotes())));
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /onglet « Guerrier » : .*fils de commentaires du dump absents du classeur : P5/s);
  assert.equal(fichiers(ctx).length, 0);
});

test('recoupement : une note blanche (espaces seulement) d’un seul côté n’est pas un écart : ce n’est pas une note', { skip: sansPython }, () => {
  const dump = avecNotes();
  dump.sheets.find((s) => s.name === 'Guerrier').cells.push({ r: 60, c: 3, v: '', note: ' ' });
  const ctx = preparer(dump);
  const spec = specXlsx(avecNotes());
  onglet(spec, 'Troubadour').notes.C61 = '  \n ';
  const r = lancerAvecClasseur(ctx, ecrireXlsx(ctx, spec));
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, new RegExp(`recoupement des notes avec le classeur : ${TOTAL} notes de cellule`));
});

test('recoupement : seul le texte d’une note diffère du classeur : avertissement, la note du dump est citée (registre de corrections)', { skip: sansPython }, () => {
  const ctx = preparer();
  const spec = specXlsx(avecNotes());
  onglet(spec, 'Guerrier').notes.P5 = "Ne marche pas si l'ennemi contre attaque.";
  const r = lancerAvecClasseur(ctx, ecrireXlsx(ctx, spec));
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stderr, /AVERTISSEMENT : .*Guerrier.*P5/s);
  assert.equal(corps(lire(ctx, 'guerrier-defensif')), `Effet de Défensif\n\n${RENDU.simple}\n`);
});

test('recoupement : des espaces, tabulations ou retours à la ligne en plus ou en moins ne sont pas un écart de texte', { skip: sansPython }, () => {
  const ctx = preparer();
  const spec = specXlsx(avecNotes());
  onglet(spec, 'Guerrier').notes.P12 = `${N.deux.replace('\n\n', '\r\n\r\n')}  \t`;
  onglet(spec, 'Troubadour').notes.A30 = `\n${N.liste}`;
  const r = lancerAvecClasseur(ctx, ecrireXlsx(ctx, spec));
  assert.equal(r.status, 0, r.stderr);
  assert.doesNotMatch(r.stderr, /AVERTISSEMENT/);
});

test('recoupement : --verifier compare lui aussi le dump au classeur, n’écrit rien', { skip: sansPython }, () => {
  const ctx = preparer();
  const xlsx = ecrireXlsx(ctx, specXlsx(avecNotes(), false));
  assert.equal(lancerAvecClasseur(ctx, xlsx).status, 0);
  const bon = lancerAvecClasseur(ctx, xlsx, ['--verifier']);
  assert.equal(bon.status, 0, bon.stdout + bon.stderr);
  assert.match(bon.stdout, new RegExp(`OK +\\(2 ter\\) notes et fils du dump = ceux du classeur .*${TOTAL} notes`));
  // les cas d'erreur rejoués comprennent la note perdue par le dump et le fil perdu (refusés par le recoupement)
  assert.match(bon.stdout, /OK +cas d'erreur rejoué : note du classeur perdue par le dump/);
  assert.match(bon.stdout, /OK +cas d'erreur rejoué : fil de commentaires du classeur perdu par le dump/);
  writeFileSync(ctx.dump, JSON.stringify(sansNoteP12()));
  const avant = toutesLesPages(ctx);
  const mauvais = lancerAvecClasseur(ctx, xlsx, ['--verifier']);
  assert.notEqual(mauvais.status, 0, '--verifier doit signaler la note perdue par le dump');
  assert.match(mauvais.stdout, /ÉCHEC +\(2 ter\)/);
  assert.match(mauvais.stdout, /Guerrier.*P12/s);
  assert.match(mauvais.stdout, /VÉRIFICATION ÉCHOUÉE/);
  assert.deepEqual(toutesLesPages(ctx), avant, '--verifier ne doit rien écrire');
});

test('recoupement : --sans-liens écarte le classeur (avertissement : notes non recoupées) et ne se cumule pas avec --xlsx', { skip: sansPython }, () => {
  const ctx = preparer();
  const sans = lancer(ctx);
  assert.equal(sans.status, 0, sans.stderr);
  assert.match(sans.stderr, /AVERTISSEMENT : --sans-liens .*recoupées/s);
  const xlsx = ecrireXlsx(ctx, specXlsx(avecNotes()));
  const les2 = lancerAvecClasseur(ctx, xlsx, ['--sans-liens']);
  assert.notEqual(les2.status, 0);
  assert.match(les2.stderr, /not allowed with argument/);
});

test('recoupement : un fichier qui n’est pas un classeur .xlsx est refusé avec un message, sans trace d’appel', { skip: sansPython }, () => {
  const ctx = preparer();
  const faux = join(ctx.dir, 'faux.xlsx');
  writeFileSync(faux, 'ceci n’est pas un zip');
  const r = lancerAvecClasseur(ctx, faux);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /ERREUR : .*faux\.xlsx/);
  assert.doesNotMatch(r.stderr, /Traceback/);
  assert.equal(fichiers(ctx).length, 0);
});
