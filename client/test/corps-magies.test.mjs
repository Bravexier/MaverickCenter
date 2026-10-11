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
import { TABLES } from '../src/lib/edition-modele.mjs';

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
    // rôles et variantes Mode Hyper
    assert.deepEqual(lu.roles, roles.filter((r) => r.magie_id === m.id).map((r) => r.role_brut), m.id);
    assert.deepEqual(lu.hyper.map((h) => h.variante).sort(), hypers.filter((h) => h.magie_id === m.id).map((h) => h.variante_brut).sort(), m.id);
    // Données : santé, chakra, caractéristique une fois chacune ; 4ème barre pour le Sang et la Nécromancie seulement
    const donnees = lu.donnees.map((d) => d.libelle);
    for (const motif of [/^Santé offerte?$/, /^Chakra offert$/, /^Caractéristiques bonus$/]) assert.equal(donnees.filter((d) => motif.test(d)).length, 1, `${m.id} ${motif}`);
    assert.equal(donnees.includes('4ème barre'), m.barre4_texte !== null, m.id);
  }
  assert.equal(entrees, 116, '85 notes et 31 fils (magies.py)');
  assert.equal(textes, 17);
  assert.equal(sorts.filter((s) => s.remarque).length, 97);
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
  // texte de niveau 5 ajouté puis retiré : le bloc entier part, y compris le titre seul que l'importeur gardait pour une cellule de texte vide
  assert.deepEqual(exceptions.filter((e) => e.endsWith(' texte_niveau5')).map((e) => e.split(' ')[0]).sort(), [
    'magies/magie-de-la-foudre#sort:fulguration',
    'magies/magie-de-la-foudre#sort:manteau-de-volt',
    'magies/magie-de-la-foudre#sort:orage-violet',
    'magies/magie-du-sang#sort:sacrifice',
  ]);
  // renommer puis remettre le nom : seuls les écarts de forme que la base ne garde pas (retour à la ligne du nom, casse du titre du texte de niveau 5)
  const noms = exceptions.filter((e) => / nom : /.test(e)).map((e) => e.split(' ')[0]);
  assert.deepEqual(noms.sort(), [
    'magies/magie-de-la-foudre#sort:orage-violet', // titre « Orage violet » (casse du classeur), nom « Orage Violet »
    'magies/magie-de-la-necromancie#sort:amelioration-cadaverique', // case « Amélioration<br>Cadavérique », nom « Amélioration Cadavérique »
    'magies/magie-de-la-necromancie#sort:corruption-dame', // case avec l'espace insécable du classeur, nom avec une espace (identifiant)
    'magies/magie-du-feu#sort:meteore-cramoisi', // titre « Météore Cramoisi »
    'magies/magie-du-feu#sort:pluie-chaude', // titre « Pluie Chaude »
  ]);
  const nombres = exceptions.filter((e) => !/ nom : /.test(e) && !e.endsWith(' texte_niveau5'));
  // les autres écarts sont exactement les cases de nombre « N.0 » des colonnes Coût, Portée et Zone (618 aujourd'hui : 206, 202 et 210)
  const casesDeNombre = magies.flatMap((m) => morceauxDuCorpsDeMagie(corpsDe(m.id)).sorts.flatMap((c) => [c[3], c[4], c[5]])).filter((c) => /^\d+\.0$/.test(c));
  assert.equal(nombres.length, casesDeNombre.length);
  assert.deepEqual(['cout_brut', 'portee_brut', 'zone_brut'].map((c) => nombres.filter((e) => e.includes(` ${c} : `)).length), [206, 202, 210]);
});

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Modifications synthétiques : la nouvelle valeur remplace l'ancienne partout où elle est écrite, sans rien laisser
// ---------------------------------------------------------------------------------------------------------------------------------------------

test('magie : présentation (et résumé), description physique, explication ajoutée, bannière, remarque', () => {
  const feu = magie(FEU);
  const corps = corpsDe(FEU);
  const presentation = 'La magie du feu brûle tout. Seconde phrase.\n\nUn autre paragraphe.';
  const apres = modifier(corps, 'magie', feu, { description: presentation });
  assert.ok(apres.startsWith('La magie du feu brûle tout. Seconde phrase.\n\nUn autre paragraphe.\n\n## Description physique\n'));
  for (const p of feu.description.split('\n\n')) assert.ok(!apres.includes(p), 'ancien paragraphe parti');
  assert.equal(apres.slice(apres.indexOf('## Description physique')), corps.slice(corps.indexOf('## Description physique')));
  assert.equal(resumeDeMagieApres(pages.get(FEU).resume, feu, { ...feu, description: presentation }), 'La magie du feu brûle tout.');
  assert.equal(resumeDeMagieApres('Résumé écrit à la main.', feu, { ...feu, description: presentation }), 'Résumé écrit à la main.', 'résumé qui ne dérive pas');

  const physique = modifier(corps, 'magie', feu, { description_physique: 'Des yeux rouges.\nDes mains brûlées.' });
  assert.match(physique, /## Description physique\n\nDes yeux rouges\. {2}\nDes mains brûlées\.\n\n## Données/);
  assert.ok(!physique.includes(feu.description_physique));
  assert.ok(!modifier(corps, 'magie', feu, { description_physique: null }).includes('## Description physique'));

  const explication = modifier(corps, 'magie', feu, { explication: 'Une explication.' });
  assert.match(explication, /\n## Description physique\n\n[^#]+\n\n## Explication\n\nUne explication\.\n\n## Données\n/);

  const banniere = modifier(corps, 'magie', feu, { banniere: 'Attention *magie*' });
  assert.ok(banniere.startsWith('**Attention \\*magie\\***\n\nLa magie du feu'));
  const pi = magie(PI);
  const sansBanniere = modifier(corpsDe(PI), 'magie', pi, { banniere: null });
  assert.equal(sansBanniere, corpsDe(PI).replace('**MAGIE DIFFICILE À JOUER !!**\n\n', ''));
  assert.ok(modifier(corpsDe(PI), 'magie', pi, { banniere: 'NOUVELLE BANNIÈRE' }).startsWith('**NOUVELLE BANNIÈRE**\n\nLe Potentiel'));

  const remarque = modifier(corps, 'magie', feu, { remarque: 'Remarque du MJ.' });
  assert.ok(remarque.endsWith('- **C** : Par Cadeau du MJ\n\n## Remarque\n\nRemarque du MJ.\n'));
  assert.equal(modifier(remarque, 'magie', { ...feu, remarque: 'Remarque du MJ.' }, { remarque: 'Autre.' }), remarque.replace('Remarque du MJ.\n', 'Autre.\n'));
});

test('magie : santé, chakra, caractéristique et 4ème barre dans « Données » (libellé tel qu’écrit gardé)', () => {
  const feu = magie(FEU);
  const corps = corpsDe(FEU);
  const apres = modifier(corps, 'magie', feu, { sante_offerte: 3, chakra_offert: 12, caracteristique_brut: 'FORCE' });
  assert.deepEqual(lignesChangees(corps, apres), [
    ['- **Santé offerte** : 0.0', '- **Santé offerte** : 3'],
    ['- **Chakra offert** : 5.0', '- **Chakra offert** : 12'],
    ['- **Caractéristiques bonus** : SOCIAL', '- **Caractéristiques bonus** : FORCE'],
  ]);
  // la Nécromancie écrit « Santé offert » : le libellé reste
  const necro = magie('magies/magie-de-la-necromancie');
  assert.match(modifier(corpsDe(necro.id), 'magie', necro, { sante_offerte: 7 }), /^- \*\*Santé offert\*\* : 7$/m);
  // une valeur vidée retire la ligne ; remise, elle revient à sa place
  const vide = modifier(corps, 'magie', feu, { caracteristique_brut: null });
  assert.ok(!vide.includes('Caractéristiques bonus'));
  assert.match(modifier(vide, 'magie', { ...feu, caracteristique_brut: null }, { caracteristique_brut: 'SOCIAL' }), /- \*\*Chakra offert\*\* : 5\.0\n- \*\*Caractéristiques bonus\*\* : SOCIAL\n- \*\*Résistance magique\*\*/);
  // 4ème barre sur deux paragraphes : lignes suivantes en retrait de deux espaces
  const sang = magie('magies/magie-du-sang');
  const barre = modifier(corpsDe(sang.id), 'magie', sang, { barre4_texte: 'Maximum de 12 Sang.\nRégénère 2.\n\n- en combat' });
  assert.match(barre, /^- \*\*4ème barre\*\* : Maximum de 12 Sang\. {2}\n {2}Régénère 2\.\n\n {2}- en combat\n- \*\*Résistance magique\*\*/m);
  assert.ok(!barre.includes(sang.barre4_texte));
});

test('rôles et capacité Mode Hyper (tableau et liste)', () => {
  const role = roles.find((r) => r.magie_id === FEU && r.rang === 1);
  const apres = modifier(corpsDe(FEU), 'magie_role', role, { role_brut: 'SOIN' });
  assert.deepEqual(lignesChangees(corpsDe(FEU), apres), [['- DÉGÂTS', '- SOIN']]);

  const mono = hypers.find((h) => h.id === `onglet_magie:${FEU}:mono`);
  const hyper = modifier(corpsDe(FEU), 'mode_hyper_effet', mono, { effet: 'Nouvel effet | avec barre\nsur deux lignes' });
  assert.deepEqual(lignesChangees(corpsDe(FEU), hyper), [[`| Mono-Magie | ${celluleDeTableau(mono.effet)} |`, '| Mono-Magie | Nouvel effet \\| avec barre<br>sur deux lignes |']]);

  const complete = hypers.find((h) => h.magie_id === PI);
  const liste = modifier(corpsDe(PI), 'mode_hyper_effet', complete, { effet: 'Neutre.\nEt plus.' });
  assert.ok(liste.endsWith('## Capacité Mode Hyper\n\n- **Forme Complète** : Neutre.  \n  Et plus.\n'));
  assert.ok(!liste.includes(complete.effet));
});

test('sort : une case modifiée ne change que sa ligne ; « / » pour D/S/B vide', () => {
  const boule = sort(`${FEU}#sort:boule-de-feu`);
  const corps = corpsDe(FEU);
  const apres = modifier(corps, 'sort', boule, { cout_brut: '5 (-1/NM)', dsb_brut: null, effets: 'Brûle.' });
  assert.deepEqual(lignesChangees(corps, apres), [[
    '| 1.0 | Boule de feu | Attaque | 4.0 | 6.0 | 1.0 | 2d6 dégâts (+1d6/NM) | Une simple attaque de Feu. 3NM = Sur un coup critique, force le jet de vigueur pour ne pas prendre brûlure 1. |',
    '| 1.0 | Boule de feu | Attaque | 5 (-1/NM) | 6.0 | 1.0 | / | Brûle. |',
  ]]);
  assert.ok(!apres.includes('Une simple attaque de Feu.'));
  const type = modifier(corps, 'sort', boule, { type_brut: 'Attaque/ Entrave\n(Imparable)' });
  assert.match(type, /^\| 1\.0 \| Boule de feu \| Attaque\/ Entrave<br>\(Imparable\) \| 4\.0 \|/m);
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

test('sort renommé : la case, les libellés de ses notes et le titre de son texte de niveau 5 suivent ; rien de l’ancien nom ne reste', () => {
  const corps = corpsDe(FEU);
  const fer = sort(`${FEU}#sort:fer-brulant`);
  assert.equal(occurrences(corps, 'Fer brûlant'), 3, 'case + deux entrées de notes');
  const apres = modifier(corps, 'sort', fer, { nom: 'Fer ardent' });
  assert.equal(occurrences(apres, 'Fer brûlant'), 0);
  assert.equal(occurrences(apres, 'Fer ardent'), 3);
  assert.match(apres, /^\*\*Note de la cellule « Effets secondaires » du sort « Fer ardent »\*\* : Si coup critique/m);
  assert.match(apres, /^\*\*Commentaire résolu de la cellule « Effets secondaires » du sort « Fer ardent »\*\* : Si 5 ou moins/m);
  assert.equal(lignesChangees(corps, apres).length, 3);

  const pluie = sort(`${FEU}#sort:pluie-chaude`);
  const renomme = modifier(corps, 'sort', pluie, { nom: 'Pluie ardente' });
  assert.match(renomme, /^\| 5\.0 \| Pluie ardente \|/m);
  assert.match(renomme, /^### Pluie ardente\n\n> Ô cieux/m);
  assert.ok(!/^### Pluie Chaude$/m.test(renomme) && !/\| Pluie chaude \|/.test(renomme));
  // un changement de casse seul garde le titre du classeur
  assert.match(modifier(corps, 'sort', pluie, { nom: 'Pluie Chaude' }), /^### Pluie Chaude$/m);
});

test('sort : remarque modifiée, ajoutée, retirée (section des notes)', () => {
  const corps = corpsDe(FEU);
  const fer = sort(`${FEU}#sort:fer-brulant`);
  const rai = sort(`${FEU}#sort:rai-solaire`);
  const boule = sort(`${FEU}#sort:boule-de-feu`);
  // modifiée : les deux entrées du sort deviennent une seule ; aucun de leurs textes ne reste
  const modifiee = modifier(corps, 'sort', fer, { remarque: 'Critique : brûlure 2.\n\nSur 5 ou moins : brûlure 1.' });
  assert.match(modifiee, /## Notes et commentaires des sorts\n\n\*\*Remarque du sort « Fer brûlant »\*\*\n\nCritique : brûlure 2\.\n\nSur 5 ou moins : brûlure 1\.\n\n\*\*Note de la cellule « Effets secondaires » du sort « Rai solaire »\*\*/);
  assert.ok(!modifiee.includes('Si coup critique avec une arme') && !modifiee.includes('Si 5 ou moins avec une arme'));
  assert.equal(modifier(modifiee, 'sort', { ...fer, remarque: 'X' }, { ...fer, remarque: 'Critique : brûlure 2.\n\nSur 5 ou moins : brûlure 1.' }), modifiee, 'stable');
  // la dernière entrée de la section modifiée : pas de ligne vide en trop
  assert.match(modifier(corps, 'sort', rai, { remarque: 'R.' }), /brûlure au stade 1\n\n\*\*Remarque du sort « Rai solaire »\*\* : R\.\n\n## Textes des sorts de niveau 5/);
  // ajoutée à un sort qui n'en avait pas : à sa place dans l'ordre des sorts (Boule de feu, 1er, avant Fer brûlant)
  const ajoutee = modifier(corps, 'sort', boule, { remarque: 'Une remarque.' });
  assert.match(ajoutee, /## Notes et commentaires des sorts\n\n\*\*Remarque du sort « Boule de feu »\*\* : Une remarque\.\n\n\*\*Note de la cellule « Effets secondaires » du sort « Fer brûlant »\*\*/);
  const zenith = sort(`${FEU}#sort:zenith`);
  assert.match(modifier(corps, 'sort', zenith, { remarque: 'Z' }), /du sort « Fer brûlant »\*\* : Si 5[^\n]*\n\n\*\*Remarque du sort « Zénith »\*\* : Z\n\n\*\*Note de la cellule « Effets secondaires » du sort « Rai solaire »/);
  const derniere = modifier(corps, 'sort', sort(`${FEU}#sort:bucher-purifiant`), { remarque: 'B' });
  assert.match(derniere, /de \+10 dégâts\.\n\n\*\*Remarque du sort « Bûcher purifiant »\*\* : B\n\n## Textes des sorts de niveau 5/);
  // retirée : l'entrée part ; la dernière partie, la section aussi
  const sansRai = modifier(corps, 'sort', rai, { remarque: null });
  assert.ok(!sansRai.includes('Rai solaire »') && sansRai.includes('du sort « Fer brûlant »'));
  assert.match(sansRai, /brûlure au stade 1\n\n## Textes des sorts de niveau 5/);
  const aucune = modifier(sansRai, 'sort', fer, { remarque: null });
  assert.ok(!aucune.includes(SECTIONS.notes));
  assert.match(aucune, /\| Bûcher purifiant \|[^\n]*\n\n## Textes des sorts de niveau 5/);
  // et revient, section recréée sous le tableau des sorts
  assert.match(modifier(aucune, 'sort', { ...rai, remarque: null }, rai), /\| Bûcher purifiant \|[^\n]*\n\n## Notes et commentaires des sorts\n\n\*\*Remarque du sort « Rai solaire »\*\* : Peut prendre un tour de concentration pour donner un bonus de \+10 dégâts\.\n\n## Textes/);
});

test('sort : texte de niveau 5 modifié, retiré, ajouté (bloc titré seul, section absente)', () => {
  const corps = corpsDe(FEU);
  const pluie = sort(`${FEU}#sort:pluie-chaude`);
  const modifie = modifier(corps, 'sort', pluie, { texte_niveau5: 'Ô flammes,\nvenez…\n\nPLUIE !' });
  assert.match(modifie, /### Pluie Chaude\n\n> Ô flammes, {2}\n> venez…\n>\n> PLUIE !\n\n### Météore Cramoisi/);
  assert.ok(!modifie.includes('Que les nuages se fissurent'));
  const retire = modifier(corps, 'sort', sort(`${FEU}#sort:bucher-purifiant`), { texte_niveau5: null });
  assert.ok(!retire.includes('### Bûcher purifiant') && !retire.includes('BÛCHER PURIFIANT'));
  assert.match(retire, /> MÉTÉORE CRAMOISI !\n\n## Légende/);
  // Foudre : titre seul (cellule vide du classeur) ; le texte s'y ajoute
  const orage = sort('magies/magie-de-la-foudre#sort:orage-violet');
  assert.match(modifier(corpsDe(orage.magie_id), 'sort', orage, { texte_niveau5: 'GRONDE !' }), /### Orage violet\n\n> GRONDE !\n\n### Fulguration\n/);
  // Arcane : pas de section ; elle est créée avant la légende, le titre est le nom du sort
  const drain = sort('magies/magie-de-larcane#sort:drain-denergie');
  const cree = modifier(corpsDe(drain.magie_id), 'sort', drain, { texte_niveau5: 'DRAIN !' });
  assert.match(cree, /\n\n## Textes des sorts de niveau 5\n\n### Drain d'énergie\n\n> DRAIN !\n\n## Légende\n/);
  const planete = sort('magies/magie-de-larcane#sort:planete-chakratique');
  const deux = modifier(cree, 'sort', planete, { texte_niveau5: 'PLANÈTE !' });
  assert.match(deux, /### Drain d'énergie\n\n> DRAIN !\n\n### Planète Chakratique\n\n> PLANÈTE !\n\n## Légende/);
  assert.equal(modifier(modifier(deux, 'sort', { ...planete, texte_niveau5: 'PLANÈTE !' }, planete), 'sort', { ...drain, texte_niveau5: 'DRAIN !' }, drain), corpsDe(drain.magie_id));
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
