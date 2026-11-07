// Monstres du Google Doc « Bestiaire 2.0 » (migration 0029-bestiaire-monstres, section 8 bis de data/schema.sql) : l'extracteur
// tools/bestiaire/extraire.mjs, rejoué sur l'export texte du doc (sources/raw/bestiaire-2-0.txt), redonne exactement les lignes de la base ; et rien n'y
// est inventé : chaque texte se retrouve dans le doc. Les monstres se modifient sur le site de dev (lib/edition-modele.mjs, serveur/edition-bestiaire.mjs) :
// le site est la source de ce qu'il modifie, l'extraction se compare donc à l'état d'import des tables (historique_modification, lib/historique-site.mjs).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { compacter, CORRECTIONS, CORRECTIONS_D_ESPECE, ecartsDuRegistre, extraireBestiaire, lignesDuDoc, lignesSql, lireRegistre } from '../../tools/bestiaire/extraire.mjs';
import { avecLesValeurs, emplacements, LIGNE_DE_DEFENSE_ANCIENNE } from '../src/lib/monstre-champs.mjs';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { historiqueSite } from '../src/lib/historique-site.mjs';
import { normalize } from '../src/lib/text.mjs';

const racine = new URL('../../', import.meta.url);
const texte = readFileSync(new URL('sources/raw/bestiaire-2-0.txt', racine), 'utf8');
const b = extraireBestiaire(texte);
const cartes = b.especes.flatMap((e) => e.cartes);
const db = ouvrirBase({ sansExemples: false });
const TABLES_MONSTRES = ['monstre_regle', 'monstre_echelle', 'monstre_butin_objet', 'monstre_groupe', 'monstre_capacite_commune', 'monstre_espece', 'monstre_espece_lieu',
  'monstre_espece_bloc', 'monstre_butin', 'monstre', 'monstre_rubrique', 'monstre_caracteristique', 'monstre_attaque', 'monstre_capacite', 'monstre_capacite_valeur', 'monstre_defense'];
const registre = lireRegistre();

test('l’extraction rejouée sur l’export du doc redonne exactement les tables des monstres de la base, telles que l’import les a laissées', () => {
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'monstre%' ORDER BY name").all().map((r) => r.name);
  assert.deepEqual(tables, [...TABLES_MONSTRES].sort(), 'les tables de la section 8 bis');
  const memoire = new DatabaseSync(':memory:', { enableForeignKeyConstraints: false });
  memoire.exec(readFileSync(new URL('data/schema.sql', racine), 'utf8'));
  memoire.exec(lignesSql(b).join('\n'));
  const historique = historiqueSite(db);
  for (const t of TABLES_MONSTRES) {
    const pk = db.prepare(`SELECT name FROM pragma_table_info('${t}') WHERE pk > 0 ORDER BY pk`).all().map((r) => r.name);
    const cle = (l) => JSON.stringify(pk.map((c) => l[c]));
    const trier = (lignes) => lignes.map((l) => ({ ...l })).sort((x, y) => (cle(x) < cle(y) ? -1 : cle(x) > cle(y) ? 1 : 0));
    assert.deepEqual(trier(historique.lignesDImport(t)), trier(memoire.prepare(`SELECT * FROM ${t}`).all()), t);
  }
});

test('effectifs : 4 règles, 10 échelles, 144 espèces (« Golem de corail » écrit deux fois), 311 cartes, 102 objets au glossaire', () => {
  assert.equal(b.regles.length, 4);
  assert.deepEqual(b.echelles.map((e) => e.ep), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.deepEqual(b.echelles.map((e) => [e.niveau_min, e.niveau_max]), [[1, 2], [3, 4], [5, 6], [7, 8], [9, 10], [11, 12], [13, 14], [15, 16], [17, 18], [19, 20]]);
  assert.deepEqual([b.echelles[0].attributs_ennemi_simple, b.echelles[0].attributs_mini_boss, b.echelles[0].attributs_boss, b.echelles[9].xp_boss], [35, 70, 140, 51200]);
  assert.equal(b.especes.length, 144);
  assert.deepEqual(b.especes.filter((e) => /-\d+$/.test(e.id)).map((e) => e.id), ['monstres/golem-de-corail-2']);
  assert.equal(cartes.length, 311, 'les 316 « Créature échelle » du doc, moins le modèle de l’introduction et les 4 cartes des brouillons (décision R58)');
  assert.equal(texte.split('Créature échelle').length - 1, 316);
  // décision R58 : les deux brouillons du doc ne sont pas repris, ni rattachés à l'espèce qui les précède
  for (const titre of ['Réanimé (EP5) (a continuer)', 'Vouivre squelette (EP8) (a refaire)']) assert.ok(lignesDuDoc(texte).includes(titre), titre);
  assert.deepEqual(cartes.filter((c) => /RÉANIMÉ|VOUIVRE/.test(c.nom_brut)).map((c) => c.nom_brut), []);
  const textes = b.especes.flatMap((e) => [e.description, e.complement, ...e.butin.map((x) => x.texte), ...e.cartes.flatMap((c) => c.rubriques.map((r) => r.texte))]);
  assert.ok(!textes.some((t) => /\((?:a|à) (?:refaire|continuer)\)|^\*Parmi|\n\*Parmi/.test(t ?? '')), 'ni brouillon ni note du butin dans un texte gardé');
  assert.equal(b.glossaire.length, 102);
  assert.equal(new Set(b.glossaire.map((g) => g.id)).size, 102);
  assert.equal(b.especes.filter((e) => !e.cartes.length).length, 20, 'espèces décrites sans carte (la plupart des Ottar)');
  assert.deepEqual(
    b.especes.filter((e) => e.blocs.length).map((e) => [e.nom, e.blocs.length]),
    [['“Presque-Ottar”', 15]],
    'les tableaux par magie du Presque-Ottar',
  );
  // décision R64 : un groupe « Ottar » (titre « Ottar (explication) »), les 22 espèces qui le suivent et dont le nom contient « Ottar », pas une de plus
  assert.deepEqual(b.groupes.map((g) => [g.id, g.nom, g.source_ref]), [['monstres/ottar', 'Ottar', 'Bestiaire 2.0 › lignes 22728-22738']]);
  const ottar = b.especes.filter((e) => e.groupe_id === 'monstres/ottar');
  assert.deepEqual(ottar.map((e) => e.ordre), Array.from({ length: 22 }, (_, k) => 100 + k), 'à la suite, dans l’ordre du doc');
  assert.deepEqual([ottar[0].id, ottar[21].id], ['monstres/presque-ottar', 'monstres/ottar-tour']);
  assert.ok(ottar.every((e) => e.nom_cle.includes('ottar')));
  assert.equal(b.especes.find((e) => e.ordre === 122).groupe_id, null, 'l’Ours-garou, qui suit, n’en est pas');
  assert.match(b.groupes[0].description, /^Les Ottars ont été des êtres humanoïdes /);
  assert.match(b.groupes[0].description, /si jamais il y a doute sur le concept de l'Ottar visé\)$/);
});

test('chaque carte : une catégorie, des rubriques, un nom remis en minuscules qui garde ses lettres', () => {
  const categories = new Map();
  for (const c of cartes) {
    categories.set(c.categorie, (categories.get(c.categorie) ?? 0) + 1);
    assert.ok(c.rubriques.length >= 5, `${c.id} : ${c.rubriques.length} rubriques`);
    assert.equal(normalize(c.nom), normalize(c.nom_brut), c.id);
    assert.equal(c.nom_brut, c.nom_brut.toUpperCase(), `${c.id} : écrit en capitales dans le doc`);
    assert.ok(c.rubriques.some((r) => r.rubrique === 'capacites'), `${c.id} : rubrique Capacité(s)`);
    assert.ok(c.capacites.length >= 1, `${c.id} : au moins une capacité`);
  }
  assert.deepEqual(Object.fromEntries(categories), { ennemi_simple: 113, mini_boss: 90, boss: 108 });
  const nom = (brut) => cartes.find((c) => c.nom_brut === brut)?.nom;
  assert.equal(nom('AMBLYPYGE DE BRAI'), 'Amblypyge de brai');
  assert.equal(nom('GOLEM DE FER II'), 'Golem de fer II', 'chiffres romains');
  assert.equal(new Set(cartes.map((c) => c.id)).size, cartes.length);
});

test('rien n’est inventé : chaque ligne de texte gardée (rubriques, capacités, butin, descriptions, glossaire) est écrite dans le doc', () => {
  // les lignes du doc, aux corrections déjà décidées pour toute la base près (CORRECTIONS : test suivant) ; une ligne corrigée pour une seule espèce
  // (CORRECTIONS_D_ESPECE, décision R209) ne se lit que dans la rubrique de cette espèce, et sa ligne d'avant est une ligne du doc
  const doc = new Set(lignesDuDoc(texte).map((l) => compacter(l.replace(/\t/g, ' '))).filter(Boolean));
  const verifier = (t, ou, admises = []) => {
    for (const l of String(t ?? '').split('\n').filter(Boolean)) assert.ok(doc.has(l) || admises.includes(l), `${ou} : « ${l} » n’est pas une ligne du doc`);
  };
  const corrigees = (carte, rubrique) => CORRECTIONS_D_ESPECE.filter(([e, q]) => e === carte.espece_id && q === rubrique).map(([, , avant, apres]) => {
    assert.ok(doc.has(avant), `${carte.id} : « ${avant} » est une ligne du doc`);
    return apres;
  });
  for (const g of b.groupes) verifier(g.description, g.id);
  for (const e of b.especes) {
    verifier(e.description, e.id);
    for (const x of e.blocs) verifier(x.texte, `${e.id} bloc ${x.titre}`);
    for (const x of e.butin) verifier(x.texte, `${e.id} butin ${x.score_brut}`);
  }
  for (const c of cartes) for (const r of c.rubriques) verifier(r.texte, `${c.id} ${r.rubrique}`, corrigees(c, r.rubrique));
  // les capacités telles que le doc les écrit (la rubrique « Capacité(s) » n'est plus en base qu'un repère vide : décision R66)
  for (const c of cartes) verifier(c.texteDesCapacites, `${c.id} capacités`);
  for (const g of b.glossaire) assert.ok(doc.has(`${g.nom}. ${g.texte}`), g.nom);
  for (const r of b.regles) assert.ok(doc.has(`* ${r.texte}`), r.texte);
});

test('corrections : seulement les graphies que la base a déjà corrigées partout, les multiplicateurs de R155, l’état « Gel » (R205) et les anciens noms de l’AP et de l’AM (R209), chacune présente dans le doc', () => {
  assert.deepEqual(CORRECTIONS.map(([, , origine]) => origine.match(/\d{4}-[a-z0-9-]+/)[0]), [
    '0012-eaunoire', '0006-orthographe-noms', '0006-orthographe-noms', '0005-orthographe-base',
    ...Array(4).fill('0039-bestiaire-reponses'),
    ...Array(4).fill('0075-r155-titres-du-bestiaire'),
    ...Array(2).fill('0103-r205-etat-gel'),
    '0106-r209-bestiaire',
  ]);
  // décision R57 : les fautes du butin, à leur seule place dans le doc (une case, une ligne de trois cases, un nom du glossaire) ; le nom corrigé du
  // glossaire garde son identifiant. Décision R155 : les lignes entières des titres (Grande résistance ÷4 : 15 ; Grande vulnérabilité x4 : 22 ; Double
  // résistance ÷4 : 10) et la sensibilité x8 des golems de verre I à III (3) ; les motifs sont ancrés sur la ligne (drapeau m ici). Décision R205 :
  // « Gelé » dans 83 listes de cibles et « gelé 1 » dans les capacités Élément Glace ; décision R209 (5) : les lignes de défense à l'ancienne (export
  // brut ici, blancs non réduits : le test suivant compte les lignes compactées).
  assert.deepEqual(CORRECTIONS.slice(4).map(([motif]) => texte.match(new RegExp(motif.source, 'gm')).length), [1, 1, 1, 3, 15, 22, 10, 3, 83, 6, 112]);
  assert.deepEqual(b.glossaire.filter((g) => g.id === 'peau-du-radrak').map((g) => g.nom), ['Peau de radrak']);
  for (const [motif] of CORRECTIONS) assert.match(texte, new RegExp(motif.source, motif.flags.replace('g', '') + 'm'), `${motif} : écrit dans le doc`);
  assert.ok(b.especes.some((e) => /Eaunoire a sauvé les exilés/.test(e.description ?? '')), 'la déesse de la Corruption s’appelle Eaunoire (R21)');
  assert.equal(compacter('Brouillard,  ect'), 'Brouillard, etc');
});

test('R155 : les titres des cartes en ÷3 / x3, la Double résistance rangée en Grande résistance, la sensibilité des golems de verre en x4', () => {
  const rubriques = cartes.flatMap((c) => c.rubriques.map((r) => ({ ...r, carte: c.id })));
  const titres = (cle) => [...new Set(rubriques.filter((r) => r.rubrique === cle).map((r) => r.titre))].sort();
  assert.deepEqual(titres('grande_resistance'), [
    'Grande(s) Résistance(s) Dégâts ÷3', 'Grande(s) Résistance(s) Dégâts/Effets ÷3', 'Grande(s) résistance(s) Dégâts ÷3',
  ]);
  assert.equal(rubriques.filter((r) => r.rubrique === 'grande_resistance').length, 25, '15 titres de Grande résistance et 10 de Double résistance');
  assert.deepEqual(titres('grande_vulnerabilite'), [
    'Grande(s )Vulnérabilité(s) Dégâts x3', 'Grande(s) Vulnérabilité(s) Dégâts x3', 'Grande(s) faiblesse(s) Dégâts x3', 'Grande(s) vulnérabilité(s) Dégâts x3',
  ]);
  assert.equal(rubriques.filter((r) => r.rubrique === 'grande_vulnerabilite').length, 25, '22 titres corrigés et 3 déjà écrits « x3 » dans le doc');
  assert.deepEqual(rubriques.filter((r) => r.rubrique === 'double_resistance'), [], 'plus aucune rubrique double_resistance');
  assert.deepEqual(cartes.flatMap((c) => c.defenses).filter((x) => x.sens === 'double_resistance'), [], 'ni cible');
  // les 10 cartes dont le doc écrit « Double(s) Résistance(s) … ÷4 » (ligne du titre, source_ref) : rangées en grande_resistance, leurs 16 cibles avec elles
  const L = lignesDuDoc(texte);
  const doubles = rubriques.filter((r) => /^Double\(s\) Résistance\(s\)/.test(L[Number(r.source_ref.match(/ligne (\d+)$/)[1]) - 1]));
  assert.deepEqual(doubles.map((r) => [r.rubrique, r.titre.replace(/Dégâts\/Effets/, 'Dégâts')]), Array(10).fill(['grande_resistance', 'Grande(s) Résistance(s) Dégâts ÷3']));
  assert.deepEqual([...new Set(doubles.map((r) => r.carte.split('#')[0]))].sort(),
    ['monstres/collecteur', 'monstres/irapullum', 'monstres/masse-empoisonneuse', 'monstres/ogre']);
  assert.equal(cartes.filter((c) => doubles.some((r) => r.carte === c.id)).flatMap((c) => c.defenses).filter((x) => x.sens === 'grande_resistance').length, 16);
  assert.ok(!rubriques.some((r) => /÷4|x4/.test(r.titre ?? '')), 'plus aucun titre en ÷4 ni en x4');
  assert.ok(!rubriques.some((r) => /Dégâts x8/.test(`${r.titre ?? ''}\n${r.texte}`)), 'plus aucune sensibilité x8');
  assert.deepEqual(rubriques.filter((r) => /Sensibilité\(s\) Dégâts x4/.test(r.texte)).map((r) => `${r.carte}@${r.rang}:${r.rubrique}`), [
    'monstres/golem-de-verre#carte:golem-de-verre-i@6:competences', 'monstres/golem-de-verre#carte:golem-de-verre-ii@6:competences',
    'monstres/golem-de-verre#carte:golem-de-verre-iii@6:competences',
  ]);
  // la « Double(s) Vulnérabilité(s) Dégâts x2 » (une ligne du doc, gardée dans le texte de la rubrique qui la précède) n'est pas touchée
  assert.equal(rubriques.filter((r) => r.texte.split('\n').includes('Double(s) Vulnérabilité(s) Dégâts x2')).length, 1);
});

test('R205 et R209 : l’état « Gel », les Momies, la carte de la Hallebarde amochée, les anciens noms de l’AP et de l’AM, rejoués par l’extracteur', () => {
  // les lignes du doc (blancs réduits) que touche chaque correction : 83 listes de cibles et 8 capacités « gelé 1 » (R205), 115 lignes de défense (R209)
  const L = lignesDuDoc(texte).map((l) => l.replace(/\t/g, ' ').replace(/[  ]+/g, ' ').trim());
  const touchees = (origine) => CORRECTIONS.filter(([, , o]) => o.includes(origine)).map(([motif]) => L.filter((l) => new RegExp(motif.source).test(l)).length);
  assert.deepEqual(touchees('0103-r205-etat-gel'), [83, 8]);
  assert.deepEqual(touchees('0106-r209-bestiaire'), [115]);
  // R205 (3) : plus aucun « Gelé » d'état dans une rubrique ni une capacité ; l'adjectif d'une description reste (« piège gelé »)
  const rubriques = cartes.flatMap((c) => c.rubriques.map((r) => ({ ...r, carte: c })));
  assert.deepEqual(rubriques.filter((r) => /\bGelé(?![\p{L}])|gelé \d/u.test(r.texte)).map((r) => r.carte.id), []);
  assert.deepEqual(cartes.flatMap((c) => c.capacitesEcrites).filter((x) => /[Gg]elé/.test(x.texte)), []);
  assert.ok(cartes.flatMap((c) => c.defenses).some((x) => x.cible === 'Gel'), 'l’état « Gel » est une cible des défenses');
  assert.ok(b.especes.some((e) => /piège gelé/.test(e.description ?? '')), 'un adjectif n’est pas l’état');
  // R209 (3) : l'immunité des trois Momies n'a plus « Enragé », qui reste leur vulnérabilité ; une autre immunité qui l'écrit ne change pas
  const momies = cartes.filter((c) => c.espece_id === 'monstres/momie');
  assert.equal(momies.length, 3);
  for (const c of momies) {
    assert.deepEqual(c.defenses.filter((x) => /^Enrag/.test(x.cible)).map((x) => x.sens), ['vulnerabilite'], c.id);
    assert.deepEqual(c.defenses.filter((x) => x.sens === 'immunite').map((x) => x.rang), [1, 2, 3, 4], `${c.id} : immunités renumérotées`);
  }
  assert.ok(rubriques.some((r) => r.carte.espece_id !== 'monstres/momie' && r.rubrique === 'immunite' && /\bEnragé\b/.test(r.texte)), 'les autres cartes gardent leur immunité');
  // R209 (4) : la carte « CUIRASSE ABÎMÉ » de la Hallebarde amochée prend le nom de son espèce, son identifiant figé ; celle de la Cuirasse abîmée garde le sien
  const hallebarde = cartes.filter((c) => c.espece_id === 'monstres/hallebarde-amochee');
  assert.deepEqual(hallebarde.map((c) => [c.id, c.nom, c.nom_brut, c.nom_cle]), [
    ['monstres/hallebarde-amochee#carte:cuirasse-abime', 'Hallebarde amochée', 'HALLEBARDE AMOCHÉE', 'hallebarde-amochee'],
  ]);
  assert.deepEqual(cartes.filter((c) => c.espece_id === 'monstres/cuirasse-abimee').map((c) => [c.id, c.nom_brut]), [['monstres/cuirasse-abimee#carte:cuirasse-abime', 'CUIRASSE ABÎMÉ']]);
  assert.equal(L.filter((l) => /^CUIRASSE ABÎMÉ Créature échelle/.test(l)).length, 2, 'le doc écrit les deux cartes sous ce nom');
});

test('valeurs typées : seulement quand l’écriture est sans ambiguïté, et conformes au texte de la carte', () => {
  for (const c of cartes) {
    const de = (cle) => c.rubriques.filter((r) => r.rubrique === cle).map((r) => r.texte).join('\n');
    if (c.sante !== null) assert.equal(de('attributs'), `Santé : ${c.sante} Chakra : ${c.chakra} Barrière : ${c.barriere}`, c.id);
    if (c.vitesse_sol !== null) assert.match(de('vitesse'), new RegExp(`^${c.vitesse_sol} cases? sol / ${c.vitesse_nage} cases? nage$`), c.id);
    if (c.armure_physique !== null) assert.match(de('defense'), new RegExp(`^${c.armure_physique} (armure physique|AP) ?/ ?${c.armure_magique} (armure magique|AM)`, 'i'), c.id);
    if (c.caracteristiques.length) assert.equal(de('caracteristiques'), c.caracteristiques.map((x, k) => `${'FPVSIA'[k]} : ${x.valeur}`).join(' / '), c.id);
    for (const a of c.attaques) assert.ok(de('degats').includes(`${a.nom}`) && de('degats').includes(a.texte), `${c.id} : ${a.nom}`);
    for (const x of c.defenses) assert.ok(de(x.sens).includes(x.cible), `${c.id} : ${x.sens} ${x.cible}`);
  }
  // décision R209 (5) : « points d'armure » et « résistance magique » sont les anciens noms de l'AP et de l'AM ; plus aucune carte ne les écrit, les
  // 93 cartes qui les écrivaient ont leurs valeurs (lues comme l'AP et l'AM), sauf les 6 sans nombre (« ? », « ∞ », une valeur par EP), qui restent sans valeur
  const L = lignesDuDoc(texte);
  const ligneDe = (r) => Number(r.source_ref.match(/ligne (\d+)$/)[1]);
  const blancsReduits = (l) => l.replace(/\t/g, ' ').replace(/[ \u00a0]+/g, ' ').trim();
  const anciennes = cartes.filter((c) => {
    const k = c.rubriques.findIndex((r) => r.rubrique === 'defense');
    if (k < 0) return false;
    // les lignes du doc de la rubrique : de son titre (exclu) au titre de la rubrique suivante
    const lignes = L.slice(ligneDe(c.rubriques[k]), c.rubriques[k + 1] ? ligneDe(c.rubriques[k + 1]) - 1 : undefined);
    assert.ok(!/points d.armure|résistance magique/.test(c.rubriques[k].texte), `${c.id} : plus de défense à l’ancienne`);
    return lignes.some((l) => LIGNE_DE_DEFENSE_ANCIENNE.test(blancsReduits(l)));
  });
  assert.equal(anciennes.length, 93);
  assert.deepEqual(anciennes.filter((c) => c.armure_physique === null).map((c) => c.id).sort(), [
    'monstres/blob-transparent#carte:blob-du-vide', 'monstres/ottar-chariot#carte:ottar-chariot', 'monstres/presque-ottar#carte:presque-ottar',
    'monstres/voromorphe#carte:voromorphe-adulte', 'monstres/voromorphe#carte:voromorphe-apex', 'monstres/voromorphe#carte:voromorphe-jeune',
  ]);
});

test('le manifeste des sources cite la copie du doc, l’original en second', () => {
  const manifeste = JSON.parse(readFileSync(new URL('sources/sources.json', racine), 'utf8'));
  const doc = manifeste.google.find((g) => g.title === 'Bestiaire 2.0');
  assert.equal(doc.id, '1WWCmI4nwkBnLcvkEsQEd-Cd_P5rb22NDJllCTO5yhsE');
  assert.match(doc.original, /\/d\/1vn5Tq11U6LG2T3X9Yobu5E_3DCKrg2jFoPFisvLYXK8\//);
  assert.equal(db.prepare("SELECT importeur FROM famille WHERE id = 'monstres'").get().importeur, 'tools/bestiaire/extraire.mjs');
});

// ---------------------------------------------------------------- capacités communes (décisions R66 à R69)
const parId = new Map(registre.capacites.map((x) => [x.id, x]));
const parEcriture = new Map(registre.ecritures.map((e) => [`${e.nom}\u0000${e.texte}`, e]));
/** Une capacité placée, telle que la carte l'affiche : nom, description aux valeurs de la carte, liste de sorts. */
const affichee = (p) => {
  const x = parId.get(p.capacite_commune_id);
  return { nom: x.nom, texte: [avecLesValeurs(x.description, Object.fromEntries(p.valeurs.map((v) => [v.numero, v.valeur]))), p.sorts].filter(Boolean).join(' ') };
};

test('registre des capacités : cohérent, et chaque capacité écrite sur une carte du doc y est rangée une fois', () => {
  assert.deepEqual(ecartsDuRegistre(registre), []);
  const ecrites = cartes.flatMap((c) => c.capacitesEcrites.map((x) => `${x.nom}\u0000${x.texte}`));
  assert.deepEqual([...new Set(ecrites)].sort(), [...parEcriture.keys()].sort(), 'les écritures du registre sont exactement celles du doc');
  assert.equal(new Set(registre.capacites.map((x) => x.id)).size, registre.capacites.length);
  for (const x of registre.capacites) assert.match(x.id, /^[a-z0-9]+(-[a-z0-9]+)*$/, x.id);
});

test('capacités : une carte affiche le texte du doc, sauf décision écrite au registre (fautes, texte retenu, découpage)', () => {
  let exactes = 0;
  for (const c of cartes) {
    let k = 0;
    for (const x of c.capacitesEcrites) {
      const e = parEcriture.get(`${x.nom}\u0000${x.texte}`);
      const places = c.capacites.slice(k, k + e.placements.length);
      k += e.placements.length;
      assert.equal(places[0].prefixe, x.prefixe, `${c.id} : préfixe de « ${x.nom} »`);
      assert.equal(places[0].ep_min, x.ep_min, `${c.id} : échelle de « ${x.nom} »`);
      const a = affichee(places[0]);
      if (e.decision) assert.match(e.decision, /^(R6[6-9]|découpage|nom et texte)/, `${x.nom} : décision citée`);
      else {
        assert.deepEqual([a.nom, a.texte], [x.nom, x.texte], `${c.id} : « ${x.nom} » affiche le texte du doc`);
        exactes++;
      }
    }
    assert.equal(k, c.capacites.length, c.id);
    assert.deepEqual(c.capacites.map((p) => p.rang), c.capacites.map((_, i) => i + 1), `${c.id} : rangs à la suite`);
  }
  assert.equal(exactes, 1416, `capacités qui affichent exactement le texte du doc (les 345 autres : une décision du registre)`);
});

test('capacités : les textes retenus par le chef (R68), les gabarits à curseur (R69), « Lanceur de sorts » (R66)', () => {
  const de = (id) => cartes.find((c) => c.id === id);
  const capacite = (carte, nom) => de(carte).capacites.map(affichee).find((a) => a.nom === nom);
  // Minus : la rédaction du texte 4, la valeur de chaque carte gardée
  assert.equal(parId.get('minus').description, 'Cette créature est petite, elle impose un malus de {10}% aux jets des adversaires qui tentent de la toucher.');
  assert.deepEqual(['nouveau-ne', 'demi-vie', 'obsolete'].map((n) => capacite(`monstres/gobelin#carte:gobelin-${n}`, 'Minus').texte.match(/(\d+)%/)[1]), ['10', '15', '20']);
  // Haine mutuelle : le texte écrit par le propriétaire, pour ses 18 cartes
  const haine = cartes.flatMap((c) => c.capacites).filter((p) => p.capacite_commune_id === 'haine-mutuelle');
  assert.equal(haine.length, 18);
  assert.match(parId.get('haine-mutuelle').description, /contre la race dont elle est issue/);
  // « Charge sans peur+ » renommée « Initiative extrême », +10 à l'initiative
  assert.ok(!registre.capacites.some((x) => x.nom === 'Charge sans peur+'));
  for (const n of ['demi-vie', 'obsolete']) assert.equal(capacite(`monstres/gobelin#carte:gobelin-${n}`, 'Initiative extrême').texte, "Permet d'avoir un bonus de +10 au jet d'initiative.");
  // Vraiment sournois (texte 2), Crache spore (texte 3), Fragilité tranchante (texte 2)
  assert.match(capacite('monstres/orc#carte:orc', 'Vraiment sournois').texte, /bonus de 4d4 dégâts en plus des dégâts de l'arme/);
  // gabarits : seuls les nombres diffèrent, chaque carte garde le sien
  assert.equal(registre.capacites.filter((x) => emplacements(x.description).length).length, 10);
  assert.deepEqual(['i', 'ii', 'iii'].map((n) => capacite(`monstres/golem-de-chair#carte:golem-de-chair-${n}`, 'Forme changeante').texte.match(/Régénère (\d+)/)?.[1]), ['20', '40', '60']);
  // Lanceur de sorts : une description commune, une liste par carte ; le Jeune Amphilactrus au maximum, comme les autres
  const lanceur = parId.get('lanceur-de-sorts');
  assert.equal(lanceur.liste_de_sorts, true);
  assert.equal(capacite('monstres/amphilactrus#carte:jeune-amphilactrus', 'Lanceur de sorts').texte,
    'Cette créature peut lancer les sorts, avec les niveaux de maîtrise maximum : Éclair, Bulle d’eau, Nerveux, Eau soignante.');
  assert.equal(cartes.flatMap((c) => c.capacites).filter((p) => p.sorts).length, 21);
  // sa provenance : la première carte qui écrit son texte (à une faute près), pas le Jeune Amphilactrus, dont le chef a fait remplacer le texte (R66)
  const capacitesDe = (carte) => de(carte).rubriques.find((r) => r.rubrique === 'capacites').source_ref;
  const source = b.capacites.find((c) => c.id === 'lanceur-de-sorts').source_ref;
  assert.notEqual(source, capacitesDe('monstres/amphilactrus#carte:jeune-amphilactrus'));
  assert.equal(source, capacitesDe('monstres/charcabe#carte:charcabe-brule'));
  // le Gobelin mage obsolète : « Tome de la corruption niv.1. », collé dans le doc à la capacité qui le précède, est une capacité à part
  assert.deepEqual(de('monstres/gobelin-mage#carte:gobelin-mage-obsolete').capacites.map(affichee).map((a) => a.nom).filter((n) => /^Tome de l/.test(n)),
    ['Tome de l’ombre niv. 1', 'Tome de la corruption niv. 1']);
});
