// Corps des pages de race recalculé depuis les tables (lib/corps-races.mjs, défaut D4 de l'édition du site de dev) :
//   - rejoué sur TOUTES les races de la base, il redonne chaque corps à l'octet près (les sections de la fiche V15.2.2 sont gardées telles quelles) ;
//   - une valeur modifiée remplace l'ancienne partout où le corps l'écrit, sans rien laisser (hors des citations de la fiche), et rien d'autre ne bouge ;
//   - tools/db/races_onglet.py (le --verifier de test/races-onglet.test.mjs) relit exactement les tables modifiées dans le corps recalculé.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import {
  celluleMd, corpsDeRace, corpsDeRaceCreee, escInline, etatAvecLigne, etatDeRace, magiesInneesDeRace, mdTexte, raceConcernee, resumeDeRace, valeurCanonique,
} from '../src/lib/corps-races.mjs';
import { cheminBase, ouvrirBase, trouverRacine } from '../src/lib/donnees.mjs';
import { TABLES } from '../src/lib/edition-modele.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';

const db = ouvrirBase({ sansExemples: false });
const executer = (sql, ...p) => db.prepare(sql).all(...p).map((l) => ({ ...l }));
const races = executer('SELECT r.id, p.corps_md, p.resume, p.donnees FROM race r JOIN page p ON p.id = r.id ORDER BY r.id');
const etats = new Map(races.map((r) => [r.id, etatDeRace(executer, r.id)]));
const corps = new Map(races.map((r) => [r.id, r.corps_md]));

const titres = (c) => [...c.matchAll(/^## (.+)$/gm)].map((m) => m[1]);
const sectionDe = (c, titre) => {
  const i = c.indexOf(`\n## ${titre}\n`);
  if (i < 0) return null;
  const j = c.indexOf('\n## ', i + 1);
  return c.slice(i + 1, j < 0 ? undefined : j + 1);
};
/** Ce que le corps cite de la fiche V15.2.2 (jamais réécrit) : sections de la fiche, « Divers (fiche) », colonne de la fiche et lignes de phrases du tableau des écarts. */
function citationsDeLaFiche(c) {
  const morceaux = ['Sous-races et origines', 'Restrictions'].map((t) => sectionDe(c, t) ?? '');
  morceaux.push(...c.split('\n').filter((l) => l.startsWith('**Divers (fiche)**')));
  for (const l of (sectionDe(c, 'Écarts avec la fiche de personnage V15.2.2') ?? '').split('\n').filter((x) => x.startsWith('| '))) {
    const cases = l.slice(2, -2).split(/(?<!\\)\|/);
    morceaux.push(/^ ?(Restriction|Classes accessibles|Magies accessibles|Divers)/.test(cases[0]) ? l : cases.at(-1));
  }
  return morceaux.join('\n');
}
const occurrences = (texte, morceau) => texte.split(morceau).length - 1;

/** Copie de l'état d'une race où la ligne `cle` de `table` reçoit `valeurs`. */
function modifier(etat, table, cle, valeurs) {
  const copie = structuredClone(etat);
  const ligne = copie[table].find((l) => Object.entries(cle).every(([k, v]) => l[k] === v));
  assert.ok(ligne, `${table} ${JSON.stringify(cle)} introuvable`);
  Object.assign(ligne, valeurs);
  return copie;
}

test('toutes les races de la base : le corps recalculé depuis les tables en place est le corps, octet pour octet ; le résumé est la présentation', () => {
  assert.ok(races.length >= 27);
  const differents = races.filter((r) => corpsDeRace(r.corps_md, etats.get(r.id)) !== r.corps_md).map((r) => r.id);
  assert.deepEqual(differents, []);
  for (const r of races) assert.equal(resumeDeRace(etats.get(r.id)), r.resume, r.id);
  // la liste « Magies accessibles » est celle de page.donnees (R11 : liste de l'onglet si la race en a une, sinon la matrice R8)
  for (const r of races) assert.deepEqual(magiesInneesDeRace(etats.get(r.id)), JSON.parse(r.donnees).magies_innees, r.id);
});

test('valeurs canoniques : chaque valeur des colonnes que le site modifie est déjà sous la forme que races_onglet.py relit', () => {
  const colonnes = Object.entries(TABLES).filter(([t]) => t.startsWith('race_') || t === 'mode_hyper_effet');
  for (const [table, { colonnes: cols }] of colonnes) {
    const lignes = table === 'mode_hyper_effet' ? executer("SELECT * FROM mode_hyper_effet WHERE version = 'onglet_race'") : executer(`SELECT * FROM ${table}`);
    for (const l of lignes) for (const c of Object.keys(cols)) assert.equal(valeurCanonique(table, c, l[c]), l[c], `${table}.${c}`);
  }
  assert.equal(valeurCanonique('race_onglet', 'avantages', '  a\n- b\n-   c  \n\n\nd'), 'a\n\n- b\n- c\n\nd');
  assert.equal(valeurCanonique('race_don', 'etiquette', ' Farfadet  Médian\n(Forêts) '), 'Farfadet Médian (Forêts)');
  assert.equal(valeurCanonique('race_don_tableau_cellule', 'valeur', ' 1AP \n 5% '), '1AP\n5%');
});

test('le Markdown est celui de l’importeur (échappements, listes, retours à la ligne forcés, cases)', () => {
  assert.equal(escInline('- a *b* [c] <d> https://x.y/z 1. e'), '\\- a \\*b\\* \\[c\\] \\<d> <https://x.y/z> 1. e');
  assert.equal(escInline('12. Titre'), '12\\. Titre');
  assert.equal(escInline('# x'), '\\# x');
  assert.deepEqual(mdTexte('a\nb\n\n- c\n- d'), ['a  ', 'b', '', '- c', '- d']);
  assert.equal(celluleMd('a | b\n- c'), 'a \\| b<br>\\- c');
});

// Colonnes que le site modifie (lib/edition-modele.mjs#TABLES) dans les tables de la race : chacune est recalculée dans le corps
const MODIFIABLES = Object.entries(TABLES).filter(([t]) => t === 'race' || t.startsWith('race_') || t === 'mode_hyper_effet');
const CLES = {
  race: ['id'], race_onglet: ['race_id'], race_don: ['id'], race_don_tableau_colonne: ['race_id', 'rang'],
  race_don_tableau_cellule: ['race_id', 'ligne', 'colonne'], mode_hyper_effet: ['id'],
};

test('chaque colonne modifiable, sur chaque race : la valeur modifiée remplace l’ancienne partout où le corps l’écrit, sans rien laisser ; rien d’autre ne bouge', () => {
  assert.deepEqual(MODIFIABLES.map(([t]) => t).sort(), Object.keys(CLES).sort(), 'une table de race ajoutée au modèle de l’édition doit être traitée ici');
  let essais = 0;
  let n = 0;
  for (const r of races) {
    const avant = etats.get(r.id);
    const ancien = corps.get(r.id);
    const fiche = citationsDeLaFiche(ancien);
    for (const [table, { colonnes }] of MODIFIABLES) {
      for (const ligne of avant[table]) {
        for (const [colonne, champ] of Object.entries(colonnes)) {
          // un don unique n'a pas d'étiquette (CHECK) ; on ne pose pas de nom de don sur une ethnie dont l'onglet n'a pas de rubrique « Nom »
          if (table === 'race_don' && colonne === 'etiquette' && ligne.forme !== 'ethnie') continue;
          if (table === 'race_don' && colonne === 'nom' && ligne.nom === null) continue;
          if (ligne[colonne] === null && !['remarque', 'description', 'dons_tableau_titre'].includes(colonne)) continue;
          n += 1;
          const cle = Object.fromEntries(CLES[table].map((k) => [k, ligne[k]]));
          // deux valeurs successives, uniques : la première ne peut venir que de la colonne, elle doit disparaître entièrement au profit de la seconde
          const [v1, v2] = champ.type === 'entier' ? [1000 + n, 2000 + n] : [`Valeur modifiée numéro ${n}.`, `Autre valeur numéro ${n}.`];
          const etat1 = modifier(avant, table, cle, { [colonne]: v1 });
          const etat2 = modifier(avant, table, cle, { [colonne]: v2 });
          const corps1 = corpsDeRace(ancien, etat1, avant);
          const corps2 = corpsDeRace(corps1, etat2, etat1);
          // ce que l'importeur n'écrit pas : la remarque d'un don unique, le titre d'un tableau qui n'existe pas
          if ((table === 'race_don' && colonne === 'remarque' && ligne.forme === 'unique') || (colonne === 'dons_tableau_titre' && !avant.race_don_tableau_colonne.length)) {
            assert.equal(corps2, ancien, `${r.id} ${table}.${colonne} : rien à écrire`);
            continue;
          }
          essais += 1;
          const ici = `${r.id} ${table}.${colonne}`;
          const fois = occurrences(corps1, String(v1));
          assert.ok(fois >= 1, `${ici} : valeur absente du corps`);
          assert.equal(occurrences(corps2, String(v1)), 0, `${ici} : l’ancienne valeur reste`);
          assert.equal(occurrences(corps2, String(v2)), fois, `${ici} : la nouvelle valeur n’est pas partout où était l’ancienne`);
          // la fiche reste citée telle quelle, et revenir à la valeur d'origine redonne le corps d'origine : rien d'autre n'a bougé
          assert.equal(citationsDeLaFiche(corps2), fiche, `${ici} : citations de la fiche touchées`);
          assert.equal(corpsDeRace(corps2, avant, etat2), ancien, `${ici} : retour à l'identique`);
        }
      }
    }
  }
  assert.ok(essais > 600, `${essais} modifications rejouées`);
});

test('valeurs de départ : les quatre cases de l’onglet changent, AP et AM de la fiche restent ; le tableau des écarts suit l’onglet, jamais la fiche', () => {
  const avant = etats.get('races/drakos');
  const o = avant.race_onglet[0];
  const [sante, nage] = [o.sante_depart + 1, o.vitesse_nage + 1];
  const apres = modifier(avant, 'race_onglet', { race_id: 'races/drakos' }, { sante_depart: sante, vitesse_nage: nage });
  const c = corpsDeRace(corps.get('races/drakos'), apres, avant);
  // AP et AM de la fiche (« 0.0 ») restent ; les colonnes de la fiche du tableau des écarts aussi (santé « 10.0 », chakra « 13.0 » à l'import)
  assert.match(sectionDe(c, 'Caractéristiques de départ'), new RegExp(`^\\| ${sante} \\| ${o.chakra_depart} \\| ${o.barriere_bonus} \\| ${o.vitesse_sol} / ${nage} \\| 0\\.0 \\| 0\\.0 \\|$`, 'm'));
  assert.match(c, new RegExp(`^\\| Santé de départ<br>\\(fiche : colonne « Santé »\\) \\| ${sante} \\| 10\\.0 \\|$`, 'm'), 'la fiche reste citée telle quelle (10.0)');
  assert.match(c, new RegExp(`^\\| Chakra de départ<br>\\(fiche : colonne « Chakra départ »\\) \\| ${o.chakra_depart} \\| 13\\.0 \\|$`, 'm'));
});

test('Nain : la liste suit l’onglet (exception gardée), le paragraphe d’écart et la ligne « Magies innées » des écarts suivent la liste et les inconvénients', () => {
  const avant = etats.get('races/nain');
  const apres = structuredClone(avant);
  apres.race_magie_onglet = apres.race_magie_onglet.filter((l) => l.magie_id !== 'magies/magie-de-la-foudre');
  apres.race_onglet[0].inconvenients = 'Magie du Feu, Terre, Arcane, Potentiel illimité en inné uniquement.';
  const c = corpsDeRace(corps.get('races/nain'), apres, avant);
  const magies = sectionDe(c, 'Magies accessibles');
  assert.match(magies, /sauf la liste de cette race, qui suit l'onglet « Nain »/);
  assert.match(magies, /^Nombre : 4 sur 15\.\n\nPotentiel Illimité, Arcane, Feu, Terre\n\nÉcart entre les sources : la matrice « Accessibilité Magie » du Google Sheet « Fiche personnage Maverick Auto V15\.2\.2 » donne 15 sur 15 pour cette race, mais l'onglet « Nain » du Google Sheet « Les races » limite la magie innée à ces 4 magies \(Inconvénient\(s\) : « Magie du Feu, Terre, Arcane, Potentiel illimité en inné uniquement\. »\)\./m);
  assert.match(c, /^\| Magies innées<br>\(fiche : matrice « Accessibilité Magie »\) \| Potentiel Illimité, Arcane, Feu, Terre \(4 sur 15\) \| Potentiel Illimité, Sang, Arcane, Corruption, Espace\/Temps, Vide, Nécromancie, Feu, Eau, Glace, Terre, Vent, Foudre, Lumière, Ombre \(15 sur 15\) \|$/m);
  assert.equal(occurrences(c, 'Foudre, Arcane'), 0);
});

test('magies innées d’une race sans liste d’onglet (matrice, R8) ; la note R22 de la Lamia reste sous sa liste ; une classe ajoutée compte dans la matrice des classes', () => {
  // nombre et liste attendus : ceux de l'état modifié (à l'import, Humain sans l'Ombre : 14 sur 15 ; Lamia sans le Sang : 13 sur 15)
  const liste = (etat) => {
    const noms = magiesInneesDeRace(etat);
    return `Nombre : ${noms.length} sur ${etat.race_magie.length}.\n\n${noms.map(escInline).join(', ')}\n`;
  };
  const humain = etats.get('races/humain');
  const sansOmbre = modifier(humain, 'race_magie', { magie_id: 'magies/magie-de-lombre' }, { accessible: 0, valeur_brut: '0' });
  const c = corpsDeRace(corps.get('races/humain'), sansOmbre, humain);
  assert.ok(!magiesInneesDeRace(sansOmbre).includes('Ombre'));
  assert.ok(sectionDe(c, 'Magies accessibles').endsWith(`\n\n${liste(sansOmbre)}\n`));
  const lamia = etats.get('races/lamia');
  const sansSang = modifier(lamia, 'race_magie', { magie_id: 'magies/magie-du-sang' }, { accessible: 0, valeur_brut: '0' });
  const c2 = corpsDeRace(corps.get('races/lamia'), sansSang, lamia);
  assert.ok(sectionDe(c2, 'Magies accessibles').includes(`\n\n${liste(sansSang)}\nCorruption : à 0 dans la matrice de la fiche, accessible d'après le propriétaire du projet (décision R22).\n`));
  // création d'une classe raciale (client/serveur/edition.mjs, CLASSE.creer) : une colonne de plus dans la matrice, accessible à sa race seulement
  const orios = etats.get('races/orios');
  const avecClasse = structuredClone(orios);
  avecClasse.classe.push({ id: 'classes/essai', nom: 'Essai' });
  avecClasse.race_classe.push({ race_id: 'races/orios', classe_id: 'classes/essai', ordre: Math.max(...orios.race_classe.map((l) => l.ordre)) + 1, accessible: 1, valeur_brut: '1' });
  const c3 = corpsDeRace(corps.get('races/orios'), avecClasse, orios);
  const accessibles = orios.race_classe.filter((l) => l.accessible === 1).length + 1;
  assert.match(sectionDe(c3, 'Classes accessibles'), new RegExp(`^Nombre : ${accessibles} sur ${orios.race_classe.length + 1}\\.\\n\\n.*, Essai\\n$`, 'm'));
});

test('présentation, description, Mode Hyper et ethnies : section ajoutée, retirée ou réécrite ; une ethnie renommée l’est aussi dans le tableau des écarts', () => {
  const nain = etats.get('races/nain');
  const c = corpsDeRace(corps.get('races/nain'), modifier(nain, 'race_onglet', { race_id: 'races/nain' }, { description: null }), nain);
  assert.deepEqual(titres(c), titres(corps.get('races/nain')).filter((t) => t !== 'Description'));
  const sansDescription = modifier(nain, 'race_onglet', { race_id: 'races/nain' }, { description: null });
  const remise = corpsDeRace(c, nain, sansDescription);
  assert.equal(remise, corps.get('races/nain'), 'la description revient à sa place, après « Histoire »');
  const p = corpsDeRace(corps.get('races/nain'), modifier(nain, 'race', { id: 'races/nain' }, { presentation: 'Une race *trapue*.' }), nain);
  assert.ok(p.startsWith('Une race \\*trapue\\*.\n\n## Présentation\n'));
  const goleois = etats.get('races/goleois');
  const h = corpsDeRace(corps.get('races/goleois'), modifier(goleois, 'mode_hyper_effet', { race_id: 'races/goleois' }, { effet: 'Premier effet.\n\n- puce' }), goleois);
  assert.match(sectionDe(h, 'Capacité Mode Hyper'), /^\*\*Digne chef\*\*\n\nPremier effet\.\n\n- puce\n$/m);
  assert.match(h, /^\| Capacité Mode Hyper<br>\(fiche : colonne « Capacité Hyper », sans nom de capacité\) \| Digne chef<br>Premier effet\.<br><br>\\- puce \| Augmente les dégâts de tous l/m);
  assert.doesNotMatch(h, /Digne chef<br>Augmente/, 'la colonne de l’onglet suit, celle de la fiche reste');
  // Elfe noir : l'ethnie « Elfe Charbon » renommée ; la colonne de la fiche (sous-race « Elfe Noir Charbon ») ne bouge pas
  const elfe = etats.get('races/elfe-noir');
  const renomme = modifier(elfe, 'race_don', { id: 'races/elfe-noir#don:elfe-charbon' }, { etiquette: 'Elfe Charbon des cendres', texte: '- Nouveau don.' });
  const e = corpsDeRace(corps.get('races/elfe-noir'), renomme, elfe);
  assert.match(sectionDe(e, 'Ethnies et dons raciaux'), /^### Elfe Charbon des cendres\n\n\*\*Nom\*\* : Sang corrompu\n\n\*\*Don\*\*\n\n- Nouveau don\.\n\n\*\*Fiche de personnage V15\.2\.2\*\* : sous-race « Elfe Noir Charbon »/m);
  assert.match(e, /^\| Don de l'ethnie « Elfe Charbon des cendres »<br>\(fiche : sous-race « Elfe Noir Charbon », colonne « Descriptif »\) \| \\- Nouveau don\. \| /m);
  assert.doesNotMatch(e, /« Elfe Charbon »/);
});

test('tableau en panneaux : en-têtes, cases et titre (Drakos, Mort-vivant)', () => {
  const drakos = etats.get('races/drakos');
  let apres = modifier(drakos, 'race_don_tableau_colonne', { rang: 2 }, { libelle: 'AP / AM' });
  apres = modifier(apres, 'race_don_tableau_cellule', { ligne: 8, colonne: 1 }, { valeur: 'Feu ardent' });
  apres = modifier(apres, 'race_onglet', { race_id: 'races/drakos' }, { dons_tableau_titre: 'Écailles' });
  const c = corpsDeRace(corps.get('races/drakos'), apres, drakos);
  const eth = sectionDe(c, 'Ethnies et dons raciaux');
  assert.match(eth, /^### Écailles\n\nNombre : 15\.\n\n\| Magie innée \| AP \/ AM \| /m);
  assert.match(eth, /^\| Feu ardent \| 4AP\/0AM \| 5% Intimidation \| Brûlure \| Drakos Rouge \|$/m);
  const mort = etats.get('races/mort-vivant');
  const titre = corpsDeRace(corps.get('races/mort-vivant'), modifier(mort, 'race_onglet', { race_id: 'races/mort-vivant' }, { dons_tableau_titre: 'Raisons de la mort' }), mort);
  assert.match(sectionDe(titre, 'Ethnies et dons raciaux'), /^### Raisons de la mort\n\nNombre : 12\.\n/m);
  assert.doesNotMatch(titre, /Tableau de l'onglet « Mort-vivant »/);
});

test('race créée depuis le site : corps complet tiré de ses seules tables, sans section de la fiche', () => {
  const etat = {
    race: [{ id: 'races/lycan', nom: 'Lycan', presentation: 'Une race de la lune.' }],
    race_onglet: [{
      race_id: 'races/lycan', onglet: 'Lycan', description_generale: 'Une race de la lune.', histoire: 'À compléter.', description: null, sante_depart: 0,
      chakra_depart: 0, barriere_bonus: 0, vitesse_sol: 0, vitesse_nage: 0, avantages: 'À compléter.', inconvenients: 'À compléter.', don_base: 'À compléter.',
      dons_rubrique: null, dons_rubrique_nom: null, dons_rubrique_don: null, dons_tableau_titre: null,
    }],
    race_don: [], ethnie: [], race_don_tableau_colonne: [], race_don_tableau_ligne: [], race_don_tableau_cellule: [], mode_hyper_effet: [],
    race_magie: etats.get('races/humain').race_magie.map((l) => ({ ...l, race_id: 'races/lycan', accessible: ['magies/magie-du-feu', 'magies/magie-de-lombre'].includes(l.magie_id) ? 1 : 0 })),
    race_magie_onglet: [],
    race_classe: etats.get('races/humain').race_classe.map((l) => ({ ...l, race_id: 'races/lycan', accessible: 0 })),
    magie: etats.get('races/humain').magie, classe: etats.get('races/humain').classe,
  };
  const c = corpsDeRace('Une race de la lune.\n', etat);
  assert.equal(c, corpsDeRaceCreee(etat));
  assert.deepEqual(titres(c), ['Présentation', 'Histoire', 'Caractéristiques de départ', 'Avantage(s) et inconvénient(s)', 'Don de base', 'Ethnies et dons raciaux', 'Classes accessibles', 'Magies accessibles']);
  assert.ok(c.startsWith('Une race de la lune.\n\n## Présentation\n\nUne race de la lune.\n\n## Histoire\n\nÀ compléter.\n'));
  assert.match(c, /^\| Santé de départ \| Chakra de départ \| Barrière bonus \| Vitesse Sol\/Nage \|\n\| --- \| --- \| --- \| --- \|\n\| 0 \| 0 \| 0 \| 0 \/ 0 \|$/m);
  assert.ok(c.endsWith(`## Classes accessibles\n\nNombre : 0 sur ${etat.race_classe.length}.\n\n## Magies accessibles\n\nNombre : 2 sur ${etat.race_magie.length}.\n\nFeu, Ombre\n`));
  assert.doesNotMatch(c, /fiche/i);
  // une fois créé, le corps se recalcule à l'identique, et suit les modifications suivantes
  assert.equal(corpsDeRace(c, etat), c);
  const histoire = modifier(etat, 'race_onglet', { race_id: 'races/lycan' }, { histoire: 'Née sous la lune.' });
  assert.match(corpsDeRace(c, histoire, etat), /## Histoire\n\nNée sous la lune\.\n\n## Caractéristiques/);
});

test('race concernée par une ligne du journal : celle de la ligne ; toutes pour le nom d’une magie ou d’une classe ; aucune pour le reste', () => {
  assert.equal(raceConcernee('race', { id: 'races/nain' }), 'races/nain');
  for (const t of ['race_onglet', 'race_don', 'race_don_tableau_colonne', 'race_don_tableau_ligne', 'race_don_tableau_cellule', 'race_magie', 'race_magie_onglet', 'race_classe']) {
    assert.equal(raceConcernee(t, { race_id: 'races/orios' }), 'races/orios', t);
  }
  assert.equal(raceConcernee('mode_hyper_effet', { version: 'onglet_race', race_id: 'races/nain' }), 'races/nain');
  assert.equal(raceConcernee('mode_hyper_effet', { version: 'fiche', race_id: 'races/nain' }), null, 'la version de la fiche n’est pas dans le corps');
  assert.equal(raceConcernee('magie', { id: 'magies/magie-du-feu' }, ['description']), null);
  assert.equal(raceConcernee('magie', { id: 'magies/magie-du-feu' }, ['nom']), '*');
  assert.equal(raceConcernee('classe', { id: 'classes/guerrier' }), '*');
  assert.equal(raceConcernee('ethnie', { race_id: 'races/nain' }, ['bonus_pv']), null);
  assert.equal(raceConcernee('sort', { id: 'x' }), null);
});

test('état d’avant refait depuis celui d’après et la ligne d’avant du journal : il retrouve une ethnie renommée dans le tableau des écarts', () => {
  const elfe = etats.get('races/elfe-noir');
  const ligneAvant = elfe.race_don.find((d) => d.id === 'races/elfe-noir#don:elfe-charbon');
  const apres = modifier(elfe, 'race_don', { id: ligneAvant.id }, { etiquette: 'Elfe Charbon des cendres' });
  const avant = etatAvecLigne(apres, 'race_don', ligneAvant);
  assert.equal(corpsDeRace(corps.get('races/elfe-noir'), apres, avant), corpsDeRace(corps.get('races/elfe-noir'), apres, elfe));
  assert.doesNotMatch(corpsDeRace(corps.get('races/elfe-noir'), apres, avant), /« Elfe Charbon »/);
  // une ligne insérée (avant null) est retirée ; une ligne supprimée (après null) revient
  const ajout = { race_id: 'races/orios', classe_id: 'classes/essai', ordre: 40, accessible: 1, valeur_brut: '1' };
  const avecClasse = { ...etats.get('races/orios'), race_classe: [...etats.get('races/orios').race_classe, ajout] };
  assert.deepEqual(etatAvecLigne(avecClasse, 'race_classe', null, ajout).race_classe, etats.get('races/orios').race_classe);
  assert.equal(etatAvecLigne(etats.get('races/orios'), 'race_classe', ajout).race_classe.length, etats.get('races/orios').race_classe.length + 1);
});

// --- relecture par tools/db/races_onglet.py : les tables modifiées se relisent dans les corps recalculés ------------------------------------------
const dossier = dossierTemporaire('corps-races');
const HARNAIS = `
import sys, json, sqlite3
sys.dont_write_bytecode = True
sys.path.insert(0, sys.argv[1])
import races_onglet as RO
db = sqlite3.connect(sys.argv[2])
try:
    t = RO.lignes(RO.extraire(db))
except RO.Arret as e:
    print(json.dumps({'arret': str(e)}, ensure_ascii=False))
    sys.exit(0)
# le même contrôle que la CI (test/races-onglet.test.mjs), note_cellule comprise : le service la tient d'accord avec la remarque du don
print(json.dumps({'ecarts': RO.verifier(db, t)}, ensure_ascii=False))
`;

function relire(modifications, { recalculer = true } = {}) {
  const fichier = join(dossier, `base-${Math.random().toString(36).slice(2)}.db`);
  copyFileSync(cheminBase({ sansExemples: false }), fichier);
  const base = new DatabaseSync(fichier);
  const ex = (sql, ...p) => base.prepare(sql).all(...p).map((l) => ({ ...l }));
  for (const { race, table, cle, valeurs, sql } of modifications) {
    const avant = etatDeRace(ex, race);
    if (sql) base.exec(sql);
    else {
      const ou = Object.keys(cle).map((k) => `"${k}" = ?`).join(' AND ');
      const champs = Object.keys(valeurs).map((k) => `"${k}" = ?`).join(', ');
      base.prepare(`UPDATE "${table}" SET ${champs} WHERE ${ou}`).run(...Object.values(valeurs), ...Object.values(cle));
    }
    const apres = etatDeRace(ex, race);
    const actuel = ex('SELECT corps_md FROM page WHERE id = ?', race)[0].corps_md;
    if (recalculer) base.prepare('UPDATE page SET corps_md = ? WHERE id = ?').run(corpsDeRace(actuel, apres, avant), race);
  }
  base.close();
  const r = spawnSync('python3', ['-I', '-c', HARNAIS, join(trouverRacine(), 'tools', 'db'), fichier], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  return JSON.parse(r.stdout);
}

// renommer une ethnie ou un don unique change l'id que races_onglet.py en tire (race#don:<normalize(nom)>), alors que l'id d'une ligne ne change jamais :
// les renommages ci-dessous gardent la même clé ; une note de cellule n'est relue que sur les trois cases connues du Médusain (CELLULES_NOTES, par le
// rang du don : son étiquette peut changer de graphie) et sa trace (note_cellule) suit la remarque, comme le service l'écrit (serveur/edition.mjs)
const c = (table, colonne, v) => valeurCanonique(table, colonne, v);
const MODIFICATIONS = [
  { race: 'races/nain', table: 'race_onglet', cle: { race_id: 'races/nain' }, valeurs: {
    description_generale: c('race_onglet', 'description_generale', 'Une race petite.\nTrès petite.\n\n- solide\n- têtue'),
    histoire: 'Arrivés tôt [voir plus bas] *en grand nombre* : 3 cités.', description: null, sante_depart: 17, chakra_depart: 3, barriere_bonus: 1,
    vitesse_sol: 2, vitesse_nage: 1, avantages: 'Les armures lourdes ne les ralentissent pas, accès à toutes les classes.\n\nEt une phrase de plus.',
    inconvenients: 'Magie du Feu, Terre, Foudre, Arcane, Potentiel illimité en inné uniquement.\nSans autre magie.', don_base: '1. Méditation (Action 2 fois/jour).',
  } },
  { race: 'races/nain', table: 'race_don', cle: { id: 'races/nain#don:londolor-est' }, valeurs: { etiquette: 'Londolor-Est', texte: 'Un seul paragraphe.' } },
  { race: 'races/nain', table: 'mode_hyper_effet', cle: { race_id: 'races/nain', version: 'onglet_race' }, valeurs: { nom: 'Petit & costaud', effet: 'Effet\nsur deux lignes.' } },
  { race: 'races/medusain', sql: `UPDATE race_don SET remarque = 'Jet de vigueur, puis rien.' WHERE id = 'races/medusain#don:eau-en-innee';
    UPDATE note_cellule SET texte = 'Jet de vigueur, puis rien.' WHERE entite_table = 'race_don' AND entite_id = 'races/medusain#don:eau-en-innee'` },
  { race: 'races/medusain', table: 'race_don', cle: { id: 'races/medusain#don:foudre-en-innee' }, valeurs: { etiquette: 'FOUDRE EN INNÉE' } },
  { race: 'races/elfe-noir', table: 'race_don', cle: { id: 'races/elfe-noir#don:elfe-charbon' }, valeurs: { nom: 'Sang très corrompu', texte: '- Premier.\n- Second.' } },
  { race: 'races/majin', table: 'race_don', cle: { id: 'races/majin#don:renfermement' }, valeurs: { nom: 'RENFERMEMENT', texte: 'Texte du don.\n\nSuite.' } },
  { race: 'races/drakos', table: 'race_don_tableau_colonne', cle: { race_id: 'races/drakos', rang: 3 }, valeurs: { libelle: 'Compétence\nbonus' } },
  { race: 'races/drakos', table: 'race_don_tableau_cellule', cle: { race_id: 'races/drakos', ligne: 2, colonne: 4 }, valeurs: { valeur: 'Gel | froid' } },
  { race: 'races/drakos', table: 'race_onglet', cle: { race_id: 'races/drakos' }, valeurs: { dons_tableau_titre: 'Écaille des dragons', description: 'Nouvelle description.' } },
  { race: 'races/mort-vivant', table: 'race_don_tableau_cellule', cle: { race_id: 'races/mort-vivant', ligne: 1, colonne: 2 }, valeurs: { valeur: 'Don changé' } },
  { race: 'races/humain', table: 'race_onglet', cle: { race_id: 'races/humain' }, valeurs: { don_base: 'Repos (Action 3 fois/jour) (autre texte).' } },
  { race: 'races/rokh', sql: "UPDATE race_onglet SET inconvenients = 'Magie Vent et Foudre en innée.' WHERE race_id = 'races/rokh'; DELETE FROM race_magie_onglet WHERE race_id = 'races/rokh' AND magie_id = 'magies/magie-de-la-lumiere'" },
];

test('races_onglet.py relit dans les corps recalculés exactement les tables modifiées (textes, valeurs, dons, notes, tableau, Mode Hyper, magies citées)', () => {
  assert.deepEqual(relire(MODIFICATIONS), { ecarts: [] });
  // témoin : les mêmes modifications sans recalculer les corps, races_onglet.py y voit les anciennes valeurs
  const temoin = relire(MODIFICATIONS, { recalculer: false });
  assert.deepEqual(temoin.ecarts.map((e) => e.split(' : ')[0]).sort(), [
    'mode_hyper_effet', 'note_cellule', 'race_don', 'race_don_tableau_cellule', 'race_don_tableau_colonne', 'race_magie_onglet', 'race_onglet',
  ]);
});
