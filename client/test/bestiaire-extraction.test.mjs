// Monstres du Google Doc « Bestiaire 2.0 » (migration 0029-bestiaire-monstres, section 8 bis de data/schema.sql) : l'extracteur
// tools/bestiaire/extraire.mjs, rejoué sur l'export texte du doc (sources/raw/bestiaire-2-0.txt), redonne exactement les lignes de la base ; et rien n'y
// est inventé : chaque texte se retrouve dans le doc. Les tables des monstres ne sont pas modifiables sur le site de dev (lib/edition-modele.mjs) :
// la base est encore l'import tel quel (si elles le deviennent, ce test lira l'import dans historique_modification, lib/historique-site.mjs).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { compacter, CORRECTIONS, extraireBestiaire, lignesDuDoc, lignesSql } from '../../tools/bestiaire/extraire.mjs';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { TABLES } from '../src/lib/edition-modele.mjs';
import { normalize } from '../src/lib/text.mjs';

const racine = new URL('../../', import.meta.url);
const texte = readFileSync(new URL('sources/raw/bestiaire-2-0.txt', racine), 'utf8');
const b = extraireBestiaire(texte);
const cartes = b.especes.flatMap((e) => e.cartes);
const db = ouvrirBase({ sansExemples: false });
const TABLES_MONSTRES = ['monstre_regle', 'monstre_echelle', 'monstre_butin_objet', 'monstre_espece', 'monstre_espece_lieu', 'monstre_espece_bloc', 'monstre_butin', 'monstre',
  'monstre_rubrique', 'monstre_caracteristique', 'monstre_attaque', 'monstre_capacite', 'monstre_defense'];

test('l’extraction rejouée sur l’export du doc redonne exactement les tables des monstres de la base', () => {
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'monstre%' ORDER BY name").all().map((r) => r.name);
  assert.deepEqual(tables, [...TABLES_MONSTRES].sort(), 'les tables de la section 8 bis');
  const memoire = new DatabaseSync(':memory:', { enableForeignKeyConstraints: false });
  memoire.exec(readFileSync(new URL('data/schema.sql', racine), 'utf8'));
  memoire.exec(lignesSql(b).join('\n'));
  for (const t of TABLES_MONSTRES) {
    const pk = db.prepare(`SELECT name FROM pragma_table_info('${t}') WHERE pk > 0 ORDER BY pk`).all().map((r) => r.name).join(', ');
    const lire = (base) => base.prepare(`SELECT * FROM ${t} ORDER BY ${pk}`).all();
    assert.deepEqual(lire(db), lire(memoire), t);
  }
  assert.ok(!Object.keys(TABLES).some((t) => t.startsWith('monstre')), 'pas encore modifiables sur le site de dev : la base est l’import');
});

test('effectifs : 4 règles, 10 échelles, 144 espèces (« Golem de corail » écrit deux fois), 315 cartes, 102 objets au glossaire', () => {
  assert.equal(b.regles.length, 4);
  assert.deepEqual(b.echelles.map((e) => e.ep), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.deepEqual(b.echelles.map((e) => [e.niveau_min, e.niveau_max]), [[1, 2], [3, 4], [5, 6], [7, 8], [9, 10], [11, 12], [13, 14], [15, 16], [17, 18], [19, 20]]);
  assert.deepEqual([b.echelles[0].attributs_ennemi_simple, b.echelles[0].attributs_mini_boss, b.echelles[0].attributs_boss, b.echelles[9].xp_boss], [35, 70, 140, 51200]);
  assert.equal(b.especes.length, 144);
  assert.deepEqual(b.especes.filter((e) => /-\d+$/.test(e.id)).map((e) => e.id), ['monstres/golem-de-corail-2']);
  assert.equal(cartes.length, 315, 'les 316 « Créature échelle » du doc, moins le modèle de l’introduction');
  assert.equal(texte.split('Créature échelle').length - 1, 316);
  assert.equal(b.glossaire.length, 102);
  assert.equal(new Set(b.glossaire.map((g) => g.id)).size, 102);
  assert.equal(b.especes.filter((e) => !e.cartes.length).length, 20, 'espèces décrites sans carte (la plupart des Ottar)');
  assert.deepEqual(
    b.especes.filter((e) => e.blocs.length).map((e) => [e.nom, e.blocs.length]),
    [['“Presque-Ottar”', 15]],
    'les tableaux par magie du Presque-Ottar',
  );
});

test('chaque carte : une catégorie, des rubriques, un nom remis en minuscules qui garde ses lettres', () => {
  const categories = new Map();
  for (const c of cartes) {
    categories.set(c.categorie, (categories.get(c.categorie) ?? 0) + 1);
    assert.ok(c.rubriques.length >= 5, `${c.id} : ${c.rubriques.length} rubriques`);
    assert.equal(normalize(c.nom), normalize(c.nom_brut), c.id);
    assert.equal(c.nom_brut, c.nom_brut.toUpperCase(), `${c.id} : écrit en capitales dans le doc`);
    assert.ok(c.rubriques.some((r) => r.rubrique === 'capacites'), `${c.id} : rubrique Capacité(s)`);
  }
  assert.deepEqual(Object.fromEntries(categories), { ennemi_simple: 115, mini_boss: 91, boss: 109 });
  const nom = (brut) => cartes.find((c) => c.nom_brut === brut)?.nom;
  assert.equal(nom('AMBLYPYGE DE BRAI'), 'Amblypyge de brai');
  assert.equal(nom('GOLEM DE FER II'), 'Golem de fer II', 'chiffres romains');
  assert.equal(new Set(cartes.map((c) => c.id)).size, cartes.length);
});

test('rien n’est inventé : chaque ligne de texte gardée (rubriques, capacités, butin, descriptions, glossaire) est écrite dans le doc', () => {
  // les lignes du doc, aux corrections déjà décidées pour toute la base près (CORRECTIONS : test suivant)
  const doc = new Set(lignesDuDoc(texte).map((l) => compacter(l.replace(/\t/g, ' '))).filter(Boolean));
  const verifier = (t, ou) => {
    for (const l of String(t ?? '').split('\n').filter(Boolean)) assert.ok(doc.has(l), `${ou} : « ${l} » n’est pas une ligne du doc`);
  };
  for (const e of b.especes) {
    verifier(e.description, e.id);
    for (const x of e.blocs) verifier(x.texte, `${e.id} bloc ${x.titre}`);
    for (const x of e.butin) verifier(x.texte, `${e.id} butin ${x.score_brut}`);
  }
  for (const c of cartes) for (const r of c.rubriques) verifier(r.texte, `${c.id} ${r.rubrique}`);
  for (const g of b.glossaire) assert.ok(doc.has(`${g.nom}. ${g.texte}`), g.nom);
  for (const r of b.regles) assert.ok(doc.has(`* ${r.texte}`), r.texte);
});

test('corrections : seulement les graphies que la base a déjà corrigées partout, chacune présente dans le doc', () => {
  assert.deepEqual(CORRECTIONS.map(([, , origine]) => origine.match(/\d{4}-[a-z-]+/)[0]), ['0012-eaunoire', '0006-orthographe-noms', '0006-orthographe-noms', '0005-orthographe-base']);
  for (const [motif] of CORRECTIONS) assert.match(texte, new RegExp(motif.source, motif.flags.replace('g', '')), `${motif} : écrit dans le doc`);
  assert.ok(b.especes.some((e) => /Eaunoire a sauvé les exilés/.test(e.description ?? '')), 'la déesse de la Corruption s’appelle Eaunoire (R21)');
  assert.equal(compacter('Brouillard,  ect'), 'Brouillard, etc');
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
  // « points d'armure / résistance magique » : PAS rapproché de l'armure physique et magique (question au propriétaire, docs/bestiaire.md)
  assert.ok(cartes.some((c) => c.armure_physique === null && /points d'armure/.test(c.rubriques.find((r) => r.rubrique === 'defense')?.texte ?? '')));
});

test('le manifeste des sources cite la copie du doc, l’original en second', () => {
  const manifeste = JSON.parse(readFileSync(new URL('sources/sources.json', racine), 'utf8'));
  const doc = manifeste.google.find((g) => g.title === 'Bestiaire 2.0');
  assert.equal(doc.id, '1WWCmI4nwkBnLcvkEsQEd-Cd_P5rb22NDJllCTO5yhsE');
  assert.match(doc.original, /\/d\/1vn5Tq11U6LG2T3X9Yobu5E_3DCKrg2jFoPFisvLYXK8\//);
  assert.equal(db.prepare("SELECT importeur FROM famille WHERE id = 'monstres'").get().importeur, 'tools/bestiaire/extraire.mjs');
});
