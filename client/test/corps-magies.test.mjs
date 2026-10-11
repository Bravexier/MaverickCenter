// Corps des pages de magie tenu d'accord avec les tables (lib/corps-magies.mjs ; D4 de l'édition du site de dev, docs/serveur.md, « Édition »).
// Stratégie : remplacement de morceaux (le corps porte des écritures que les tables n'ont pas : libellés du bloc Données, nombres « 4.0 », titres des
// textes de niveau 5, libellés des notes, légende…). Trois familles de contrôles, rejouées sur toutes les pages de magie de la base (data/rows) :
//   - invariant : remplacer avec les mêmes valeurs redonne le corps à l'octet près, pour chaque ligne de magie, magie_role, mode_hyper_effet
//     (onglet_magie) et sort ;
//   - lecture : chaque morceau du corps redit sa ligne (tableau des sorts, notes = remarque, textes de niveau 5, rôles, variantes Mode Hyper) ;
//   - aller-retour : une valeur modifiée puis remise redonne le corps (exceptions listées une par une, avec leur cause) ;
// puis des modifications synthétiques : la nouvelle valeur remplace l'ancienne partout où elle est écrite, sans rien laisser.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import {
  assemblerCorpsDeMagie, casesDeLigne, celluleDeTableau, COLONNES_DE_MAGIE, COLONNES_DE_SORT, corpsAvecTitreRenomme, corpsDeMagieApres,
  decouperCorpsDeMagie, echapperLigne, ErreurCorpsMagie, lignesDEntree, lignesDeTexte, morceauxDuCorpsDeMagie, nomDeNote, nomPlie, PAGE_DE_LA_LIGNE, premierePhrase,
  resumeDeMagie, resumeDeMagieApres, SECTIONS,
} from '../src/lib/corps-magies.mjs';
import { ENTITES, TABLES } from '../src/lib/edition-modele.mjs';

const db = ouvrirBase({ sansExemples: false });
const tout = (sql, ...p) => db.prepare(sql).all(...p).map((l) => ({ ...l }));
const magies = tout('SELECT * FROM magie ORDER BY ordre');
const pages = new Map(tout('SELECT p.id, p.corps_md, p.resume FROM page p JOIN magie m ON m.id = p.id').map((p) => [p.id, p]));
const roles = tout('SELECT * FROM magie_role ORDER BY magie_id, rang');
const hypers = tout("SELECT * FROM mode_hyper_effet WHERE version = 'onglet_magie' ORDER BY rang, variante");
const sorts = tout('SELECT * FROM sort ORDER BY magie_id, ordre');
const corpsDe = (id) => pages.get(id).corps_md;
const magie = (id) => magies.find((m) => m.id === id);
const sort = (id) => sorts.find((s) => s.id === id);
const lignesDeTable = () => [
  ...magies.map((l) => ['magie', l]), ...roles.map((l) => ['magie_role', l]), ...hypers.map((l) => ['mode_hyper_effet', l]), ...sorts.map((l) => ['sort', l]),
];
/** Applique une modification : la ligne après = la ligne avant + `valeurs`. */
const modifier = (corps, table, avant, valeurs) => corpsDeMagieApres(corps, table, avant, { ...avant, ...valeurs });
const occurrences = (texte, motif) => texte.split(motif).length - 1;
/** Lignes qui diffèrent entre deux corps (même nombre de lignes attendu). */
const lignesChangees = (a, b) => {
  const la = a.split('\n');
  const lb = b.split('\n');
  return la.length === lb.length ? la.map((l, i) => (l === lb[i] ? null : [l, lb[i]])).filter(Boolean) : null;
};

const FEU = 'magies/magie-du-feu';
const PI = 'magies/potentiel-illimite';

test('15 magies, 42 rôles, 29 variantes Mode Hyper (onglet de magie), 322 sorts : chaque ligne a sa page', () => {
  // effectifs de l'import, que le site ne change pas : il ne crée ni ne supprime de magie, de rôle, de variante ni de sort (edition-modele#ENTITES)
  for (const t of Object.keys(PAGE_DE_LA_LIGNE)) assert.ok(!Object.values(ENTITES).some((e) => e.table === t), `${t} : créé par le site`);
  assert.equal(magies.length, 15);
  assert.equal(roles.length, 42);
  assert.equal(hypers.length, 29);
  assert.equal(sorts.length, 322);
  for (const [table, l] of lignesDeTable()) assert.ok(pages.has(PAGE_DE_LA_LIGNE[table](l)), `${table} ${JSON.stringify(l.id ?? l.rang)}`);
});

test('les colonnes suivies sont celles que le site modifie (lib/edition-modele.mjs#TABLES)', () => {
  assert.deepEqual([...COLONNES_DE_MAGIE].sort(), Object.keys(TABLES.magie.colonnes).sort());
  assert.deepEqual([...COLONNES_DE_SORT].sort(), Object.keys(TABLES.sort.colonnes).sort());
  assert.deepEqual(Object.keys(TABLES.magie_role.colonnes), ['role_brut']);
  // mode_hyper_effet.nom n'est écrit dans aucune page de magie (NULL pour les 29 variantes, et la page ne l'affiche pas) : seul `effet` y a sa place
  assert.ok(hypers.every((h) => h.nom === null));
});

test('chaque page : découpée puis rassemblée à l’identique ; le résumé est la première phrase de la présentation', () => {
  for (const m of magies) {
    const { corps_md: corps, resume } = pages.get(m.id);
    assert.equal(assemblerCorpsDeMagie(decouperCorpsDeMagie(corps)), corps, m.id);
    assert.equal(resumeDeMagie(m), resume, m.id);
    assert.equal(resumeDeMagieApres(resume, m, m), resume, m.id);
  }
});

test('invariant (toute la base) : remplacer avec les mêmes valeurs redonne le corps à l’octet près', () => {
  let n = 0;
  for (const [table, l] of lignesDeTable()) {
    const id = PAGE_DE_LA_LIGNE[table](l);
    assert.equal(corpsDeMagieApres(corpsDe(id), table, l, l), corpsDe(id), `${table} ${l.id ?? `${l.magie_id} rang ${l.rang}`}`);
    // sans la ligne avant (création, rejeu) : même résultat
    assert.equal(corpsDeMagieApres(corpsDe(id), table, null, l), corpsDe(id), `${table} ${l.id ?? l.rang} (sans avant)`);
    n++;
  }
  assert.equal(n, 15 + 42 + 29 + 322);
});

test('lecture (toute la base) : chaque morceau du corps redit sa ligne', () => {
  let entrees = 0;
  let textes = 0;
  let notesDesSorts = 0;
  for (const m of magies) {
    const lu = morceauxDuCorpsDeMagie(corpsDe(m.id));
    const siens = sorts.filter((s) => s.magie_id === m.id);
    // tableau des sorts : une ligne par sort, dans l'ordre, le nom en deuxième case
    assert.equal(lu.sorts.length, siens.length, m.id);
    siens.forEach((s, i) => {
      assert.equal(lu.sorts[i].length, 8, s.id);
      assert.equal(lu.sorts[i][1].replace(/<br>/g, ' ').replace(/ /g, ' '), celluleDeTableau(s.nom), s.id);
    });
    // notes : chaque entrée appartient à un sort de la page qui a une remarque ; chaque remarque a ses entrées
    const noms = new Map(siens.map((s) => [nomDeNote(s.nom), s]));
    for (const e of lu.notes) assert.ok(noms.get(e.sort)?.remarque, `${m.id} : entrée orpheline « ${e.libelle} »`);
    for (const s of siens) assert.equal(lu.notes.some((e) => e.sort === nomDeNote(s.nom)), s.remarque !== null, s.id);
    entrees += lu.notes.length;
    // textes de niveau 5 : chaque titre est celui d'un sort de niveau 5 (sans accents ni casse) ; une citation <=> texte_niveau5
    for (const b of lu.niveau5) {
      const s = siens.find((x) => x.niveau === 5 && nomPlie(x.nom) === nomPlie(b.titre));
      assert.ok(s, `${m.id} : titre « ${b.titre} » sans sort`);
      assert.equal(b.citation.length > 0, s.texte_niveau5 !== null, s.id);
      if (s.texte_niveau5) assert.deepEqual(b.citation, lignesDeTexte(s.texte_niveau5, '> '), s.id);
    }
    for (const s of siens.filter((x) => x.texte_niveau5)) assert.ok(lu.niveau5.some((b) => nomPlie(b.titre) === nomPlie(s.nom)), s.id);
    textes += lu.niveau5.filter((b) => b.citation.length).length;
    notesDesSorts += new Set(lu.notes.map((e) => e.sort)).size;
    // rôles et variantes Mode Hyper
    assert.deepEqual(lu.roles, roles.filter((r) => r.magie_id === m.id).map((r) => r.role_brut), m.id);
    assert.deepEqual(lu.hyper.map((h) => h.variante).sort(), hypers.filter((h) => h.magie_id === m.id).map((h) => h.variante_brut).sort(), m.id);
    // Données : santé, chakra, caractéristique une fois chacune quand la magie en a une ; 4ème barre pour le Sang et la Nécromancie seulement
    const donnees = lu.donnees.map((d) => d.libelle);
    for (const [motif, colonne] of [[/^Santé offerte?$/, 'sante_offerte'], [/^Chakra offert$/, 'chakra_offert'], [/^Caractéristiques bonus$/, 'caracteristique_brut']]) {
      assert.equal(donnees.filter((d) => motif.test(d)).length, m[colonne] === null || m[colonne] === '' ? 0 : 1, `${m.id} ${motif}`);
    }
    assert.equal(donnees.includes('4ème barre'), m.barre4_texte !== null, m.id);
  }
  // effectifs tirés de la base (une remarque ajoutée ou retirée par le site les change) ; ceux de l'import (85 notes et 31 fils du classeur) sont
  // épinglés contre la copie de contrôle par test/magies-notes.test.mjs
  assert.equal(notesDesSorts, sorts.filter((s) => s.remarque).length, 'chaque sort à remarque a ses entrées');
  assert.ok(entrees >= notesDesSorts);
  assert.equal(textes, sorts.filter((s) => s.texte_niveau5).length);
});

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Aller-retour : une valeur modifiée puis remise redonne le corps
// ---------------------------------------------------------------------------------------------------------------------------------------------

const TEMOIN = 'Valeur témoin du test';

/** Aller-retour d'une colonne : la valeur témoin apparaît (et le corps change), puis la valeur d'origine redonne le corps ; renvoie le corps final. */
function allerRetour(table, l, colonne, temoin = TEMOIN) {
  const id = PAGE_DE_LA_LIGNE[table](l);
  const aller = modifier(corpsDe(id), table, l, { [colonne]: temoin });
  assert.notEqual(aller, corpsDe(id), `${table} ${l.id ?? l.rang} ${colonne} : rien n'a changé`);
  assert.ok(aller.includes(temoin.split('\n')[0]), `${table} ${l.id ?? l.rang} ${colonne} : valeur témoin absente`);
  assert.equal(corpsDeMagieApres(aller, table, { ...l, [colonne]: temoin }, { ...l, [colonne]: temoin }), aller, 'stable');
  return corpsDeMagieApres(aller, table, { ...l, [colonne]: temoin }, l);
}

test('aller-retour : textes de magie, rôles, effets Mode Hyper', () => {
  for (const m of magies) {
    for (const colonne of ['banniere', 'description', 'description_physique', 'explication', 'caracteristique_brut', 'remarque']) {
      assert.equal(allerRetour('magie', m, colonne), corpsDe(m.id), `${m.id} ${colonne}`);
    }
    if (m.barre4_texte) assert.equal(allerRetour('magie', m, 'barre4_texte', `${TEMOIN}\n\nSecond paragraphe`), corpsDe(m.id), `${m.id} barre4_texte`);
    // un texte de plusieurs paragraphes avec une liste
    assert.equal(allerRetour('magie', m, 'description', `${TEMOIN}.\nLigne 2\n\n- un\n- deux`), corpsDe(m.id), `${m.id} description`);
  }
  for (const r of roles) assert.equal(allerRetour('magie_role', r, 'role_brut'), corpsDe(r.magie_id), `${r.magie_id} ${r.rang}`);
  for (const h of hypers) assert.equal(allerRetour('mode_hyper_effet', h, 'effet', `${TEMOIN}\n(IC) seconde ligne`), corpsDe(h.magie_id), h.id);
});

test('aller-retour : santé et chakra offerts (nombre en cache « 5.0 » du classeur : remis, il s’écrit 5)', () => {
  for (const m of magies) {
    for (const colonne of ['sante_offerte', 'chakra_offert']) {
      const final = allerRetour('magie', m, colonne, '77');
      const changees = lignesChangees(corpsDe(m.id), final);
      assert.equal(changees.length, 1, `${m.id} ${colonne} : seule la ligne du nombre`);
      const [ecrite, remise] = changees[0];
      assert.equal(ecrite, `${remise}.0`, `${m.id} ${colonne}`);
      assert.ok(remise.endsWith(` : ${m[colonne]}`), `${m.id} ${colonne}`);
    }
  }
});

test('aller-retour : chaque case de chaque sort, remarque et texte de niveau 5 (exceptions listées)', () => {
  const exceptions = [];
  for (const s of sorts) {
    const corps = corpsDe(s.magie_id);
    const ligne = morceauxDuCorpsDeMagie(corps).sorts[s.ordre - 1];
    for (const colonne of ['nom', 'type_brut', 'cout_brut', 'portee_brut', 'zone_brut', 'dsb_brut', 'effets']) {
      const final = allerRetour('sort', s, colonne, colonne === 'effets' ? `${TEMOIN}\nà la ligne | barre` : TEMOIN);
      if (final === corps) continue;
      const changees = lignesChangees(corps, final);
      exceptions.push(`${s.id} ${colonne} : ${changees.map(([a, b]) => `${a.slice(0, 50)} -> ${b.slice(0, 50)}`).join(' ; ')}`);
      // seule cause admise d'écart sur une case : le nombre en cache du classeur (« 4.0 » remis en « 4 »), une seule ligne changée, celle du sort
      if (colonne !== 'nom') {
        assert.equal(changees.length, 1, `${s.id} ${colonne}`);
        assert.match(ligne[{ cout_brut: 3, portee_brut: 4, zone_brut: 5 }[colonne]] ?? '', /^\d+\.0$/, `${s.id} ${colonne}`);
      }
    }
    if (s.remarque === null) assert.equal(allerRetour('sort', s, 'remarque', `${TEMOIN}\n\n- puce`), corps, `${s.id} remarque`);
    if (s.niveau === 5) {
      const final = allerRetour('sort', s, 'texte_niveau5', `${TEMOIN},\nseconde ligne…\n\nCRI !`);
      if (final !== corps) {
        exceptions.push(`${s.id} texte_niveau5`);
        // seule cause admise : le titre seul du classeur (cellule de texte vide) part avec le texte retiré ; rien d'autre ne change
        const titre = morceauxDuCorpsDeMagie(corps).niveau5.find((b) => nomPlie(b.titre) === nomPlie(s.nom));
        assert.equal(titre?.citation.length, 0, s.id);
        assert.equal(final, corps.replace(`### ${echapperLigne(titre.titre)}\n\n`, ''), s.id);
      }
    }
  }
  // Les exceptions attendues se lisent dans les corps (une modification du site en retire, aucune n'en ajoute : la forme de l'importeur que la base
  // ne garde pas disparaît quand le site réécrit le morceau). À l'import : 4 titres seuls (Foudre : Fulguration, Manteau de volt, Orage violet ; Sang :
  // Sacrifice), 5 noms (Orage violet et Météore Cramoisi, Pluie Chaude : casse du titre ; Amélioration<br>Cadavérique ; Corruption d'âme avec
  // l'insécable du classeur), 618 cases de nombre « N.0 » (206, 202 et 210).
  const morceaux = new Map(magies.map((m) => [m.id, morceauxDuCorpsDeMagie(corpsDe(m.id))]));
  const titreDuSort = (s) => morceaux.get(s.magie_id).niveau5.find((b) => nomPlie(b.titre) === nomPlie(s.nom));
  // texte de niveau 5 ajouté puis retiré : le bloc entier part, y compris le titre seul que l'importeur gardait pour une cellule de texte vide
  const titresSeuls = sorts.filter((s) => s.niveau === 5 && titreDuSort(s)?.citation.length === 0).map((s) => s.id);
  assert.deepEqual(exceptions.filter((e) => e.endsWith(' texte_niveau5')).map((e) => e.split(' ')[0]).sort(), titresSeuls.sort());
  // renommer puis remettre le nom : seuls les écarts de forme que la base ne garde pas (retour à la ligne ou insécable dans la case, casse du titre
  // du texte de niveau 5)
  const formeGardee = sorts.filter((s) => morceaux.get(s.magie_id).sorts[s.ordre - 1][1] !== celluleDeTableau(s.nom) || (titreDuSort(s) && titreDuSort(s).titre !== s.nom));
  const noms = exceptions.filter((e) => / nom : /.test(e)).map((e) => e.split(' ')[0]);
  assert.deepEqual(noms.sort(), formeGardee.map((s) => s.id).sort());
  const nombres = exceptions.filter((e) => !/ nom : /.test(e) && !e.endsWith(' texte_niveau5'));
  // les autres écarts sont exactement les cases de nombre « N.0 » des colonnes Coût, Portée et Zone
  const casesDeNombre = (k) => magies.flatMap((m) => morceaux.get(m.id).sorts.map((c) => c[3 + k])).filter((c) => /^\d+\.0$/.test(c)).length;
  assert.deepEqual(['cout_brut', 'portee_brut', 'zone_brut'].map((c) => nombres.filter((e) => e.includes(` ${c} : `)).length), [0, 1, 2].map(casesDeNombre));
});

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Modifications synthétiques : la nouvelle valeur remplace l'ancienne partout où elle est écrite, sans rien laisser
// ---------------------------------------------------------------------------------------------------------------------------------------------

test('magie : présentation (et résumé), description physique, explication ajoutée, bannière, remarque', () => {
  const feu = magie(FEU);
  const corps = corpsDe(FEU);
  const sections = (c) => c.slice(c.indexOf('\n## ') + 1);
  const banniereDe = (m) => (m.banniere ? `**${echapperLigne(m.banniere)}**\n\n` : '');
  const presentation = 'La magie du feu brûle tout. Seconde phrase.\n\nUn autre paragraphe.';
  const apres = modifier(corps, 'magie', feu, { description: presentation });
  assert.ok(apres.startsWith(`${banniereDe(feu)}${presentation}\n\n## `));
  for (const p of (feu.description ?? '').split('\n\n').filter(Boolean)) assert.ok(!apres.includes(p), 'ancien paragraphe parti');
  assert.equal(sections(apres), sections(corps), 'les sections ne bougent pas');
  assert.equal(resumeDeMagieApres(pages.get(FEU).resume, feu, { ...feu, description: presentation }), 'La magie du feu brûle tout.');
  assert.equal(resumeDeMagieApres('Résumé écrit à la main.', feu, { ...feu, description: presentation }), 'Résumé écrit à la main.', 'résumé qui ne dérive pas');

  const physique = modifier(corps, 'magie', feu, { description_physique: 'Des yeux rouges.\nDes mains brûlées.' });
  assert.match(physique, /## Description physique\n\nDes yeux rouges\. {2}\nDes mains brûlées\.\n\n## /);
  if (feu.description_physique) assert.ok(!physique.includes(feu.description_physique));
  assert.ok(!modifier(corps, 'magie', feu, { description_physique: null }).includes('## Description physique'));

  const explication = modifier(modifier(corps, 'magie', feu, { explication: null }), 'magie', { ...feu, explication: null }, { explication: 'Une explication.' });
  const titres = morceauxDuCorpsDeMagie(explication).titres;
  assert.equal(titres[titres.indexOf(SECTIONS.explication) + 1], SECTIONS.donnees, 'avant « Données »');
  if (titres.includes(SECTIONS.physique)) assert.equal(titres[titres.indexOf(SECTIONS.explication) - 1], SECTIONS.physique, 'après la description physique');
  assert.match(explication, /\n## Explication\n\nUne explication\.\n\n## /);

  const sansBanniere = (m) => corpsDe(m.id).slice(banniereDe(m).length);
  assert.equal(modifier(corps, 'magie', feu, { banniere: 'Attention *magie*' }), `**Attention \\*magie\\***\n\n${sansBanniere(feu)}`);
  const pi = magie(PI); // à l'import : « MAGIE DIFFICILE À JOUER !! »
  assert.equal(modifier(corpsDe(PI), 'magie', pi, { banniere: null }), sansBanniere(pi));
  assert.equal(modifier(corpsDe(PI), 'magie', pi, { banniere: 'NOUVELLE BANNIÈRE' }), `**NOUVELLE BANNIÈRE**\n\n${sansBanniere(pi)}`);

  // remarque ajoutée à la fin de la page, puis changée
  const sans = feu.remarque ? modifier(corps, 'magie', feu, { remarque: null }) : corps;
  const remarque = modifier(sans, 'magie', { ...feu, remarque: null }, { remarque: 'Remarque du MJ.' });
  assert.equal(remarque, `${sans.trimEnd()}\n\n## Remarque\n\nRemarque du MJ.\n`);
  assert.equal(modifier(remarque, 'magie', { ...feu, remarque: 'Remarque du MJ.' }, { remarque: 'Autre.' }), remarque.replace('Remarque du MJ.\n', 'Autre.\n'));
});

test('magie : santé, chakra, caractéristique et 4ème barre dans « Données » (libellé tel qu’écrit gardé)', () => {
  const feu = magie(FEU);
  const corps = corpsDe(FEU);
  // les lignes telles que le corps les écrit (à l'import : « 0.0 », « 5.0 », « SOCIAL ») : seule la valeur change, le libellé reste
  const ligne = (motif) => corps.split('\n').find((l) => motif.test(l));
  const valeurs = { sante_offerte: (feu.sante_offerte ?? 0) + 3, chakra_offert: (feu.chakra_offert ?? 0) + 7, caracteristique_brut: feu.caracteristique_brut === 'FORCE' ? 'SOCIAL' : 'FORCE' };
  const apres = modifier(corps, 'magie', feu, valeurs);
  assert.deepEqual(lignesChangees(corps, apres), [
    [/^- \*\*Santé offerte?\*\* : /, valeurs.sante_offerte], [/^- \*\*Chakra offert\*\* : /, valeurs.chakra_offert], [/^- \*\*Caractéristiques bonus\*\* : /, valeurs.caracteristique_brut],
  ].map(([motif, v]) => [ligne(motif), ligne(motif).replace(/ : .*$/, ` : ${v}`)]));
  // la Nécromancie écrit « Santé offert » : le libellé reste
  const necro = magie('magies/magie-de-la-necromancie');
  assert.match(modifier(corpsDe(necro.id), 'magie', necro, { sante_offerte: 7 }), /^- \*\*Santé offert\*\* : 7$/m);
  // une valeur vidée retire la ligne ; remise, elle revient à sa place
  const vide = modifier(corps, 'magie', feu, { caracteristique_brut: null });
  assert.ok(!vide.includes('Caractéristiques bonus'));
  assert.equal(modifier(vide, 'magie', { ...feu, caracteristique_brut: null }, { caracteristique_brut: feu.caracteristique_brut }), corps);
  // 4ème barre sur deux paragraphes : lignes suivantes en retrait de deux espaces
  const sang = magie('magies/magie-du-sang');
  const barre = modifier(corpsDe(sang.id), 'magie', sang, { barre4_texte: 'Maximum de 12 Sang.\nRégénère 2.\n\n- en combat' });
  assert.match(barre, /^- \*\*4ème barre\*\* : Maximum de 12 Sang\. {2}\n {2}Régénère 2\.\n\n {2}- en combat\n- \*\*Résistance magique\*\*/m);
  assert.ok(!barre.includes(sang.barre4_texte));
});

test('rôles et capacité Mode Hyper (tableau et liste)', () => {
  const role = roles.find((r) => r.magie_id === FEU && r.rang === 1);
  const apres = modifier(corpsDe(FEU), 'magie_role', role, { role_brut: 'SOIN TÉMOIN' });
  assert.deepEqual(lignesChangees(corpsDe(FEU), apres), [[`- ${echapperLigne(role.role_brut)}`, '- SOIN TÉMOIN']]);

  const mono = hypers.find((h) => h.id === `onglet_magie:${FEU}:mono`);
  const hyper = modifier(corpsDe(FEU), 'mode_hyper_effet', mono, { effet: 'Nouvel effet | avec barre\nsur deux lignes' });
  assert.deepEqual(lignesChangees(corpsDe(FEU), hyper), [[`| Mono-Magie | ${celluleDeTableau(mono.effet)} |`, '| Mono-Magie | Nouvel effet \\| avec barre<br>sur deux lignes |']]);

  const complete = hypers.find((h) => h.magie_id === PI);
  const liste = modifier(corpsDe(PI), 'mode_hyper_effet', complete, { effet: 'Neutre.\nEt plus.' });
  assert.ok(liste.includes(`## Capacité Mode Hyper\n\n- **${echapperLigne(complete.variante_brut)}** : Neutre.  \n  Et plus.\n`));
  assert.ok(!liste.includes(complete.effet));
});

test('sort : une case modifiée ne change que sa ligne ; « / » pour D/S/B vide', () => {
  // la ligne telle que le corps l'écrit aujourd'hui (valeurs de la base, nombres « N.0 » du classeur) ; seules les cases modifiées changent
  const boule = sort(`${FEU}#sort:boule-de-feu`);
  const corps = corpsDe(FEU);
  const cases = morceauxDuCorpsDeMagie(corps).sorts[boule.ordre - 1];
  const ligne = (c) => `| ${c.join(' | ')} |`;
  const apres = modifier(corps, 'sort', boule, { cout_brut: '5 (-1/NM) témoin', dsb_brut: null, effets: 'Brûle | témoin.' });
  assert.deepEqual(lignesChangees(corps, apres), [[ligne(cases), ligne(cases.map((c, i) => ({ 3: '5 (-1/NM) témoin', 6: '/', 7: 'Brûle \\| témoin.' })[i] ?? c))]]);
  assert.ok(!apres.includes(`| ${celluleDeTableau(boule.effets)} |`));
  const type = modifier(corps, 'sort', boule, { type_brut: 'Attaque/ Entrave\n(Imparable)' });
  assert.deepEqual(lignesChangees(corps, type), [[ligne(cases), ligne(cases.map((c, i) => (i === 2 ? 'Attaque/ Entrave<br>(Imparable)' : c)))]]);
});

test('sort : sa ligne est celle qui porte son nom, même quand le tableau ne suit plus l’ordre des sorts ; jamais la ligne d’un autre sort', () => {
  const corps = corpsDe(FEU);
  const [premier, second] = sorts.filter((s) => s.magie_id === FEU && s.ordre <= 2);
  const lignes = corps.split('\n');
  const i = lignes.findIndex((l) => casesDeLigne(l)?.[1] === celluleDeTableau(premier.nom));
  assert.equal(casesDeLigne(lignes[i + 1])?.[1], celluleDeTableau(second.nom), 'les deux premières lignes du tableau');
  [lignes[i], lignes[i + 1]] = [lignes[i + 1], lignes[i]];
  const desordre = lignes.join('\n');
  const apres = modifier(desordre, 'sort', premier, { cout_brut: '99' });
  assert.deepEqual(lignesChangees(desordre, apres).map(([a, b]) => [casesDeLigne(a)[1], casesDeLigne(b)[1], casesDeLigne(b)[3]]), [
    [celluleDeTableau(premier.nom), celluleDeTableau(premier.nom), '99'],
  ], 'seule sa ligne (la deuxième) change');
  // renommé : retrouvé par son ancien nom
  assert.match(corpsDeMagieApres(desordre, 'sort', premier, { ...premier, nom: 'Nom tout neuf' }), /^\| [^|]+ \| Nom tout neuf \|/m);
  // son nom nulle part (la ligne de son rang est celle d'un autre sort) : refus plutôt qu'écraser l'autre
  const sansLui = desordre.split('\n').filter((l) => casesDeLigne(l)?.[1] !== celluleDeTableau(premier.nom)).join('\n');
  assert.throws(() => modifier(sansLui, 'sort', premier, { cout_brut: '99' }), ErreurCorpsMagie);
});

// Les tests suivants partent du corps tel que la base l'écrit aujourd'hui (le site a pu le modifier) : les formes attendues (entrées de notes,
// titres des textes de niveau 5) y sont lues, jamais recopiées de l'import.
const entreesDe = (c) => morceauxDuCorpsDeMagie(c).notes;
const niveau5De = (c) => morceauxDuCorpsDeMagie(c).niveau5;
/** Les lignes d'un commentaire telles que l'entrée de note les cite (comment_lines de l'importeur). */
const lignesCitees = (texte) => {
  const l = String(texte).replace(/\r\n?/g, '\n').split('\n').map((x) => x.replace(/^[ \t]+|[ \t]+$/g, ''));
  while (l.length && !l[0]) l.shift();
  while (l.length && !l.at(-1)) l.pop();
  return l;
};

test('sort renommé : la case, les libellés de ses notes et le titre de son texte de niveau 5 suivent ; rien de l’ancien nom ne reste', () => {
  const corps = corpsDe(FEU);
  // Fer brûlant (à l'import : la case et deux entrées de notes, une note et un commentaire résolu)
  const fer = sort(`${FEU}#sort:fer-brulant`);
  const siennes = entreesDe(corps).filter((e) => e.sort === nomDeNote(fer.nom));
  assert.equal(occurrences(corps, fer.nom), 1 + siennes.length, 'la case et ses entrées de notes');
  const apres = modifier(corps, 'sort', fer, { nom: 'Fer témoin' });
  assert.equal(occurrences(apres, fer.nom), 0);
  assert.equal(occurrences(apres, 'Fer témoin'), 1 + siennes.length);
  // les mêmes entrées, dans le même ordre, seul le nom du sort change dans leur libellé
  const renommees = entreesDe(apres).filter((e) => e.sort === 'Fer témoin');
  assert.deepEqual(renommees.map((e) => [e.libelle.replace(/« Fer témoin »$/, `« ${nomDeNote(fer.nom)} »`), e.lignes]), siennes.map((e) => [e.libelle, e.lignes]));
  assert.equal(lignesChangees(corps, apres).length, 1 + siennes.length);

  // Pluie chaude (à l'import : titre « Pluie Chaude » de son texte de niveau 5, casse du classeur)
  const pluie = sort(`${FEU}#sort:pluie-chaude`);
  const titre = niveau5De(corps).find((b) => nomPlie(b.titre) === nomPlie(pluie.nom));
  const renomme = modifier(corps, 'sort', pluie, { nom: 'Pluie témoin' });
  assert.equal(morceauxDuCorpsDeMagie(renomme).sorts[pluie.ordre - 1][1], 'Pluie témoin');
  if (titre) assert.deepEqual(niveau5De(renomme).find((b) => b.titre === 'Pluie témoin')?.citation, titre.citation, 'le texte garde sa citation');
  assert.ok(!niveau5De(renomme).some((b) => nomPlie(b.titre) === nomPlie(pluie.nom)) && !renomme.includes(`| ${celluleDeTableau(pluie.nom)} |`));
  // un changement de casse seul garde le titre tel qu'il est écrit (celui du classeur)
  if (titre) assert.ok(niveau5De(modifier(corps, 'sort', pluie, { nom: pluie.nom.toUpperCase() })).some((b) => b.titre === titre.titre));
});

test('sort : remarque modifiée, ajoutée, retirée (section des notes)', () => {
  const corps = corpsDe(FEU);
  const avant = entreesDe(corps);
  const siens = sorts.filter((s) => s.magie_id === FEU);
  const rang = (e) => siens.find((s) => nomDeNote(s.nom) === e.sort).ordre;
  const autres = (c, s) => entreesDe(c).filter((e) => e.sort !== nomDeNote(s.nom));
  const avecRemarque = siens.filter((s) => s.remarque);
  const sansRemarque = siens.filter((s) => !s.remarque);
  assert.ok(avecRemarque.length && sansRemarque.length >= 3);
  // modifiée : les entrées du sort (Fer brûlant à l'import : deux) deviennent une seule, à la place de la première ; les autres ne bougent pas
  const fer = sort(`${FEU}#sort:fer-brulant`).remarque ? sort(`${FEU}#sort:fer-brulant`) : avecRemarque[0];
  const texte = 'Critique témoin : brûlure 2.\n\nSur 5 ou moins témoin : brûlure 1.';
  const modifiee = modifier(corps, 'sort', fer, { remarque: texte });
  const lues = entreesDe(modifiee);
  assert.deepEqual(lues.filter((e) => e.sort === nomDeNote(fer.nom)).map((e) => [e.libelle, e.lignes]), [[`Remarque du sort « ${nomDeNote(fer.nom)} »`, texte.split('\n')]]);
  assert.equal(lues.findIndex((e) => e.sort === nomDeNote(fer.nom)), avant.findIndex((e) => e.sort === nomDeNote(fer.nom)), 'à la place de la première');
  assert.deepEqual(autres(modifiee, fer), autres(corps, fer));
  assert.equal(modifier(modifiee, 'sort', { ...fer, remarque: 'X' }, { ...fer, remarque: texte }), modifiee, 'stable');
  // ajoutée à un sort qui n'en avait pas (le premier, un du milieu, le dernier) : à sa place dans l'ordre des sorts, sans ligne vide en trop
  for (const s of [sansRemarque[0], sansRemarque[Math.floor(sansRemarque.length / 2)], sansRemarque.at(-1)]) {
    const ajoutee = modifier(corps, 'sort', s, { remarque: 'Une remarque témoin.' });
    const e = entreesDe(ajoutee);
    const k = e.findIndex((x) => x.sort === nomDeNote(s.nom));
    assert.deepEqual([e[k].libelle, e[k].lignes], [`Remarque du sort « ${nomDeNote(s.nom)} »`, ['Une remarque témoin.']], s.id);
    assert.deepEqual(e.filter((_, j) => j !== k), avant, `${s.id} : les autres entrées restent, dans leur ordre`);
    assert.ok(e.slice(0, k).every((x) => rang(x) < s.ordre) && e.slice(k + 1).every((x) => rang(x) > s.ordre), `${s.id} : dans l'ordre des sorts`);
    assert.ok(!ajoutee.includes('\n\n\n'), `${s.id} : ligne vide en trop`);
  }
  // retirées une à une : chaque entrée part, les autres restent ; la dernière partie, la section aussi
  let c = corps;
  for (const s of avecRemarque) {
    const suivant = modifier(c, 'sort', s, { remarque: null });
    assert.deepEqual(entreesDe(suivant), autres(c, s), s.id);
    assert.ok(!suivant.includes('\n\n\n'), `${s.id} : ligne vide en trop`);
    c = suivant;
  }
  assert.ok(!c.includes(SECTIONS.notes));
  // et revient : section recréée sous le tableau des sorts
  const s = avecRemarque[0];
  const revenue = corpsDeMagieApres(c, 'sort', { ...s, remarque: null }, s);
  const titres = morceauxDuCorpsDeMagie(revenue).titres;
  assert.equal(titres[titres.indexOf(SECTIONS.sorts) + 1], SECTIONS.notes);
  assert.deepEqual(entreesDe(revenue).map((e) => [e.libelle, e.lignes]), [[`Remarque du sort « ${nomDeNote(s.nom)} »`, lignesCitees(s.remarque)]]);
});

test('sort : texte de niveau 5 modifié, retiré, ajouté (bloc titré seul, section absente)', () => {
  const corps = corpsDe(FEU);
  const blocs = niveau5De(corps);
  const avecTexte = sorts.filter((s) => s.magie_id === FEU && s.texte_niveau5);
  assert.ok(avecTexte.length >= 2);
  // modifié (Pluie chaude à l'import) : le titre reste tel qu'il est écrit, la citation est remplacée, les autres blocs ne bougent pas
  const pluie = sort(`${FEU}#sort:pluie-chaude`).texte_niveau5 ? sort(`${FEU}#sort:pluie-chaude`) : avecTexte[0];
  const modifie = modifier(corps, 'sort', pluie, { texte_niveau5: 'Ô flammes,\nvenez…\n\nPLUIE !' });
  const apres = niveau5De(modifie);
  const k = blocs.findIndex((b) => nomPlie(b.titre) === nomPlie(pluie.nom));
  assert.deepEqual(apres[k], { titre: blocs[k].titre, citation: ['> Ô flammes,  ', '> venez…', '>', '> PLUIE !'] });
  assert.deepEqual(apres.filter((_, j) => j !== k), blocs.filter((_, j) => j !== k));
  // retiré (Bûcher purifiant à l'import, le dernier) : le bloc entier part, la section suivante suit le bloc précédent
  const dernier = avecTexte.at(-1);
  const retire = modifier(corps, 'sort', dernier, { texte_niveau5: null });
  assert.deepEqual(niveau5De(retire), blocs.filter((b) => nomPlie(b.titre) !== nomPlie(dernier.nom)));
  assert.ok(!retire.includes('\n\n\n'));
  // titre seul (Foudre, à l'import : cellule de texte vide du classeur) : le texte s'y ajoute, sous le titre tel qu'il est écrit
  const seul = sorts.map((s) => [s, niveau5De(corpsDe(s.magie_id)).find((b) => !b.citation.length && nomPlie(b.titre) === nomPlie(s.nom))]).find(([, b]) => b);
  if (seul) {
    const [s, b] = seul;
    assert.ok(niveau5De(modifier(corpsDe(s.magie_id), 'sort', s, { texte_niveau5: 'GRONDE !' })).some((x) => x.titre === b.titre && x.citation.join() === '> GRONDE !'), s.id);
  }
  // une magie sans texte de niveau 5 (Arcane à l'import) : la section est créée avant la légende, les blocs dans l'ordre des sorts ; retirés, le corps revient
  const sans = magies.find((m) => !morceauxDuCorpsDeMagie(corpsDe(m.id)).titres.includes(SECTIONS.niveau5) && sorts.filter((s) => s.magie_id === m.id && s.niveau === 5).length >= 2);
  if (sans) {
    const [a, b] = sorts.filter((s) => s.magie_id === sans.id && s.niveau === 5).slice(-2);
    const un = modifier(corpsDe(sans.id), 'sort', b, { texte_niveau5: 'SECOND !' });
    const deux = modifier(un, 'sort', a, { texte_niveau5: 'PREMIER !' });
    const titres = morceauxDuCorpsDeMagie(deux).titres;
    if (titres.includes(SECTIONS.legende)) assert.equal(titres[titres.indexOf(SECTIONS.legende) - 1], SECTIONS.niveau5);
    assert.deepEqual(niveau5De(deux).map((x) => [x.titre, x.citation]), [[a.nom, ['> PREMIER !']], [b.nom, ['> SECOND !']]]);
    assert.equal(modifier(modifier(deux, 'sort', { ...a, texte_niveau5: 'PREMIER !' }, { texte_niveau5: null }), 'sort', { ...b, texte_niveau5: 'SECOND !' }, { texte_niveau5: null }), corpsDe(sans.id));
  }
});

test('modifications enchaînées puis annulées : le corps d’origine revient (textes)', () => {
  const feu = magie(FEU);
  const fer = sort(`${FEU}#sort:fer-brulant`);
  const role = roles.find((r) => r.magie_id === FEU && r.rang === 2);
  let c = corpsDe(FEU);
  c = modifier(c, 'magie', feu, { description: 'Autre.', explication: 'Ajoutée.' });
  c = modifier(c, 'sort', fer, { nom: 'Fer neuf', effets: 'Chauffe.' });
  c = modifier(c, 'magie_role', role, { role_brut: 'PLACEMENT' });
  c = modifier(c, 'magie_role', { ...role, role_brut: 'PLACEMENT' }, role);
  c = corpsDeMagieApres(c, 'sort', { ...fer, nom: 'Fer neuf', effets: 'Chauffe.' }, fer);
  c = corpsDeMagieApres(c, 'magie', { ...feu, description: 'Autre.', explication: 'Ajoutée.' }, feu);
  assert.equal(c, corpsDe(FEU));
});

test('erreurs : morceau introuvable, version Mode Hyper d’une race, table sans morceau', () => {
  const boule = sort(`${FEU}#sort:boule-de-feu`);
  assert.throws(() => corpsDeMagieApres(corpsDe(FEU), 'sort', null, { ...boule, nom: 'Sort absent du tableau', ordre: 99 }), ErreurCorpsMagie);
  assert.throws(() => corpsDeMagieApres('Texte sans tableau.\n', 'sort', boule, boule), ErreurCorpsMagie);
  const course = { ...hypers[0], version: 'onglet_race' };
  assert.throws(() => corpsDeMagieApres(corpsDe(FEU), 'mode_hyper_effet', course, course), /onglet_race/);
  assert.throws(() => corpsDeMagieApres(corpsDe(FEU), 'race', {}, {}), ErreurCorpsMagie);
  assert.throws(() => corpsDeMagieApres(corpsDe(FEU), 'magie_role', roles[0], { ...roles[0], magie_id: FEU, rang: 3 + 2 }), ErreurCorpsMagie);
});

test('pages qui citent un sort : le titre « ## Effet "Nom" » du bestiaire suit le renommage', () => {
  const effets = tout('SELECT ce.*, p.corps_md FROM creature_effet ce JOIN page p ON p.id = ce.creature_id WHERE ce.sort_id IS NOT NULL');
  assert.equal(effets.length, 5);
  for (const e of effets) {
    const libelle = e.libelle.replace(`"${e.nom}"`, '"Manteau sombre"');
    const apres = corpsAvecTitreRenomme(e.corps_md, e.libelle, libelle);
    assert.deepEqual(lignesChangees(e.corps_md, apres), [['## Effet "Manteau noir"', '## Effet "Manteau sombre"']], e.creature_id);
    assert.equal(corpsAvecTitreRenomme(e.corps_md, e.libelle, e.libelle), e.corps_md);
  }
});

test('rendu de l’importeur (magies.py : esc_inline, md_text, cell_md, first_sentence) porté à l’identique', () => {
  assert.equal(echapperLigne('# titre'), '\\# titre');
  assert.equal(echapperLigne('- tiret seul'), '\\- tiret seul');
  assert.equal(echapperLigne('1. un'), '1\\. un');
  assert.equal(echapperLigne('> cite'), '\\> cite');
  assert.equal(echapperLigne('a*b_c[d]`e<f~g\\h &amp; i'), 'a\\*b\\_c\\[d\\]\\`e\\<f\\~g\\\\h \\&amp; i');
  assert.equal(echapperLigne('voir https://exemple.fr/a_b ici'), 'voir <https://exemple.fr/a_b> ici');
  assert.equal(echapperLigne('a | b'), 'a | b');
  assert.equal(echapperLigne('a | b', true), 'a \\| b');
  assert.deepEqual(lignesDeTexte('  Un\ndeux  \n\n- a\n-   b\ntrois'), ['Un  ', 'deux', '', '- a', '- b', '', 'trois']);
  assert.deepEqual(lignesDeTexte('Un\n\nDeux', '> '), ['> Un', '>', '> Deux']);
  assert.equal(celluleDeTableau('a|b\n c '), 'a\\|b<br>c');
  assert.deepEqual(casesDeLigne('| a \\| b | c |'), ['a \\| b', 'c']);
  assert.deepEqual(casesDeLigne('| a |  |'), ['a', '']);
  assert.equal(premierePhrase('Phrase un. Phrase deux.\nAutre ligne.'), 'Phrase un.');
  assert.equal(premierePhrase('Sans point'), 'Sans point');
  assert.equal(premierePhrase('3.5 dégâts ! Ensuite.'), '3.5 dégâts !');
});

test('rendu porté contre l’importeur lui-même (tools/sheets/magies.py, chargé par python3) sur des textes difficiles', () => {
  const textes = [
    '# titre', '## x', '#hashtag', '#', '- a', '+ b', '-', '- ', '1. un', '2) deux', '12. douze', '1.5 point', '\u0661. chiffre arabe', '> cite', '>> double',
    'a*b_c[d]`e<f~g\\h', '&amp; &#123; &x; &é;', 'voir https://ex.fr/a_b?c=1&d=2 ici <https://deja.fr>', 'a | b || c', '  espaces  internes  ',
    'Ligne\nautre\n\n- puce\n-   puce2\ntexte\n\n\n\nfin', '\u00a0insécable\u00a0au bord', 'tab\tici', '--', '===', '***', '___', '```', '~~~',
    '3.5 dégâts ! Ensuite.', 'Phrase. Autre', 'Fin?', 'a\r\nb\rc', 'x<y>z', '_début', 'fin_', '\\', 'Entrée : - pas une puce', '- - double',
  ];
  const script = `
import importlib.util, json, sys
spec = importlib.util.spec_from_file_location('magies', sys.argv[1])
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
textes = json.loads(sys.stdin.read())
out = []
for t in textes:
    lignes = list(m.comment_lines(t))
    out.append({
        'esc': m.esc_inline(t.split('\\n')[0]), 'escPipe': m.esc_inline(t.split('\\n')[0], pipe=True),
        'text': m.md_text(t) if t.strip() else [], 'quote': m.md_quote(t) if t.strip() else [],
        'cell': m.cell_md(t), 'phrase': m.first_sentence(t),
        'entry': m.entry_lines('Note du sort « *X* »', lignes) if lignes else None,
    })
print(json.dumps(out, ensure_ascii=False))
`;
  const importeur = fileURLToPath(new URL('../../tools/sheets/magies.py', import.meta.url));
  const r = spawnSync('python3', ['-I', '-c', script, importeur], { input: JSON.stringify(textes), encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const attendus = JSON.parse(r.stdout);
  textes.forEach((t, i) => {
    const a = attendus[i];
    assert.equal(echapperLigne(t.split('\n')[0]), a.esc, `esc_inline ${JSON.stringify(t)}`);
    assert.equal(echapperLigne(t.split('\n')[0], true), a.escPipe, `esc_inline pipe ${JSON.stringify(t)}`);
    assert.deepEqual(lignesDeTexte(t), a.text, `md_text ${JSON.stringify(t)}`);
    assert.deepEqual(lignesDeTexte(t, '> '), a.quote, `md_quote ${JSON.stringify(t)}`);
    assert.equal(celluleDeTableau(t), a.cell, `cell_md ${JSON.stringify(t)}`);
    assert.equal(premierePhrase(t), a.phrase, `first_sentence ${JSON.stringify(t)}`);
    if (a.entry) assert.deepEqual(lignesDEntree('Note du sort « *X* »', t.replace(/\r\n?/g, '\n').split('\n').map((l) => l.replace(/^[ \t]+|[ \t]+$/g, '')).join('\n').replace(/^\n+|\n+$/g, '').split('\n')), a.entry, `entry_lines ${JSON.stringify(t)}`);
  });
});
