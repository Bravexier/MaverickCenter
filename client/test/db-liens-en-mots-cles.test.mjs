// Migration data/migrations/0098-liens-en-mots-cles.sql (générée par scripts/liens-en-mots-cles.mjs ; réponses du propriétaire du 2026-11-06 : `mot_cle`
// gagne `couleur` et `url`, « NULL par défaut, ajoutées en dernier », « URL interne seulement » ; les [[…]] et les liens Markdown internes [texte](/…)
// deviennent des balises, un mot-clé par page visée, libellé = titre de la page, sans définition ; « il ne faut pas de changement par rapport à avant en
// terme de résultat. Tu feras donc en sorte que le mot clé reprenne la couleur de la page d'avant » ; « Un mot-clé par page colorée » ; une route sans
// page a le libellé de son menu ; un mot-clé existant de même écriture : « Le mot-clé existant prend l'URL » ; homonymes race/classe : « La race garde
// le nom » ; « Fusionner dans l'existant » : « Pour chaque paire, le mot-clé existant prend l'URL de la page, comme Bouclier et Ceinture, et les liens
// convertis le visent. Le texte affiché reste le même, et le mot-clé nouveau n'est pas créé. ») et la conversion pure lib/liens-en-mots-cles.mjs.
// Lecture seule de la base construite ; les contraintes se vérifient sur une base en mémoire faite de data/schema.sql. Le site de dev est la source de
// ce qu'il modifie (tests-conventions) : ce que la migration a écrit ne se compare qu'aux lignes qu'aucun lot rapatrié après elle (absent de
// fixtures/lots-avant-0098.json) n'a retouchées ; l'état courant se contrôle par des invariants (aucun lien hors exemples et codes, formes canoniques,
// couleurs de la palette).
//   node --test test/db-liens-en-mots-cles.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { corpsDeMetier } from '../src/lib/corps-metiers.mjs';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { historiqueSite } from '../src/lib/historique-site.mjs';
import { convertirLesLiens, liensDuTexte, tableDeConversion } from '../src/lib/liens-en-mots-cles.mjs';
import { cheminDePage } from '../src/lib/metiers.mjs';
import { formesNonCanoniques } from '../src/lib/mots-cles-balises.mjs';
import { motsClesDeLaBase, textesDeLaBase } from '../src/lib/mots-cles-db.mjs';
import { FUSIONS_DANS_L_EXISTANT, MOTS_CLES_EXISTANTS_REPRIS } from '../scripts/liens-en-mots-cles.mjs';
import { baseDImport, lotsAvant } from './aide-base-d-import.mjs';
import { FAMILLES_DE_LA_PALETTE, classeDeMagie, idDeCouleur } from '../src/lib/palette-css.mjs';
import { normalize } from '../src/lib/text.mjs';

const db = ouvrirBase({ sansExemples: false });
const REGISTRE = JSON.parse(readFileSync(new URL('../../data/migrations/0098-liens-en-mots-cles.json', import.meta.url), 'utf8'));
const MIGRATION = readFileSync(new URL('../../data/migrations/0098-liens-en-mots-cles.sql', import.meta.url), 'utf8');
const SCHEMA = readFileSync(new URL('../../data/schema.sql', import.meta.url), 'utf8');
const LOTS_AVANT_0098 = new Set(JSON.parse(readFileSync(new URL('./fixtures/lots-avant-0098.json', import.meta.url), 'utf8')).lots);
// les lignes retouchées par un lot rapatrié après la 0098 : « table|clé JSON »
const retouchees = new Set(historiqueSite(db).entrees.filter((e) => !LOTS_AVANT_0098.has(e.lot)).map((e) => `${e.table}|${e.texte}`));
const intacte = (table, cle) => !retouchees.has(`${table}|${JSON.stringify(cle)}`);
const motCle = (id) => db.prepare('SELECT * FROM mot_cle WHERE id = ?').get(id);
const texte = (table, colonne, id) => db.prepare(`SELECT "${colonne}" AS v FROM "${table}" WHERE id = ?`).get(id)?.v;
const pageExemple = new Set(db.prepare("SELECT id FROM page WHERE statut = 'example'").all().map((p) => p.id));
const LIENS_GARDES = ['/#lien-discord'];
/** La base telle que la 0098 l'a laissée : seuls les lots rapatriés après elle (absents de fixtures/lots-avant-0098.json) sont défaits. */
const apres0098 = () => baseDImport({ garder: lotsAvant('0098') });
const texteApres0098 = (table, colonne, id) => apres0098().prepare(`SELECT "${colonne}" AS v FROM "${table}" WHERE id = ?`).get(id)?.v;
// Les fragments qu'une migration postérieure à la 0098 a réécrits dans ses textes (registres `textes` : une entrée par remplacement, `avant` présent une
// fois dans la valeur d'avant). R198 retire l'attribution au Doc « Guide pour MJ » : la 0104 ôte la balise {{guide-pour-mj-maverick|Doc « Guide pour MJ »}}
// que la 0098 avait posée dans guide/attaquer-et-se-defendre et guide/les-postures ; la 0107 en est la suite. La 0111 (relecture des Règles contre les
// décisions) donne à des liens le titre de leur page (R184 (2), (5), (11), R187 (1)) et renvoie aux pages de la rubrique Équipement au lieu de
// {{armes|Équipement}}. La 0112 (R231) réécrit les pages « Attaquer » et « Se défendre » en entier et les renvois des autres pages vers elles.
// `intacte` ne voit que les lots du site.
const textesDe = (...noms) => noms.flatMap((nom) => JSON.parse(readFileSync(new URL(`../../data/migrations/${nom}.json`, import.meta.url), 'utf8')).textes);
const REECRITURES_R198 = textesDe('0104-r198-r208-textes-du-guide', '0107-r198-r200-posture-et-mode-hyper');
const REECRITURES_APRES_0098 = [...REECRITURES_R198, ...textesDe('0111-relecture-des-regles-contre-les-decisions', '0112-r231-attaquer-et-se-defendre')];
/** Les réécritures postérieures (de `parmi`) qui retirent la balise `r.balise` de sa cellule (leur `avant` la contient, pas leur `apres`). */
const retiresPar = (r, parmi = REECRITURES_APRES_0098) => parmi.filter((t) => t.table === r.table && t.col === r.colonne
  && JSON.stringify(t.cle) === JSON.stringify(r.cle) && t.avant.includes(r.balise) && !t.apres.includes(r.balise));
/** `fragment` (de la cellule de `r`) est dans `v`, ou une réécriture postérieure l'a remplacé et son `apres` y est, de proche en proche (la 0112
 * réécrit en entier une page dont la 0104 ou la 0111 avait déjà réécrit un fragment). */
const ecritOuReecrit = (r, fragment, v, vues = new Set()) => v.includes(fragment) || retiresPar({ ...r, balise: fragment })
  .filter((t) => !vues.has(t)).some((t) => ecritOuReecrit(r, t.apres, v, new Set([...vues, t])));
/** La balise de la 0098 est dans `v`, ou une migration postérieure l'a retirée et son `apres` est dans `v` : l'une ou l'autre écriture. */
const baliseOuReecriture = (r, v) => ecritOuReecrit(r, r.balise, v);

test('0098 : couleur et url en dernier dans mot_cle et dans v_mot_cle', () => {
  // les colonnes ajoutées après la 0098 viennent ensuite (`verrou`, 0110 : décisions R218, R219)
  const AJOUTEES_APRES_0098 = new Set(['verrou']);
  assert.deepEqual(db.prepare('PRAGMA table_info(mot_cle)').all().map((c) => c.name).filter((c) => !AJOUTEES_APRES_0098.has(c)).slice(-3), ['abreviation', 'couleur', 'url']);
  assert.deepEqual(db.prepare('PRAGMA table_info(v_mot_cle)').all().map((c) => c.name).slice(-3), ['abreviation', 'couleur', 'url']);
  assert.equal(db.prepare('PRAGMA user_version').get().user_version >= 98, true);
});

test('0098 : la base refuse une couleur qui n’est ni « famille:id » ni « #rrggbb », et une adresse externe', () => {
  const m = new DatabaseSync(':memory:');
  m.exec(SCHEMA);
  const poser = (couleur, url) => m.prepare("INSERT INTO mot_cle (id, libelle, libelle_cle, couleur, url) VALUES ('x', 'X', 'x', ?, ?)").run(couleur, url);
  for (const [couleur, url] of [['magie:sang', '/magies/magie-du-sang/'], ['#a1b2c3', null], ['magie:espace-temps', '/metiers/#metier-mineur'], [null, null]]) {
    poser(couleur, url);
    m.exec("DELETE FROM mot_cle WHERE id = 'x'");
  }
  for (const couleur of ['Magie:sang', 'magie:', 'ma-gie:x', 'magie:x:y', 'magie:x-', '#A1B2C3', '#abc', 'rouge']) assert.throws(() => poser(couleur, null), /CHECK/, couleur);
  for (const url of ['//hote/', 'https://exemple.org/', 'magies/', '/a b/', '/\\hote', '/é/']) assert.throws(() => poser(null, url), /CHECK/, url);
  m.close();
});

test('0098 : les mots-clés du registre (Q1, Q8, Q10) — comptes, libellés, adresses, sans définition', () => {
  const par = (o) => REGISTRE.motsCles.filter((m) => m.origine === o);
  assert.equal(par('couleur').length + par('lien').length + par('existant').length, REGISTRE.motsCles.length);
  assert.equal(REGISTRE.motsCles.filter((m) => m.couleur).length, 90, 'Q8 : un mot-clé coloré par page colorée (15 magies, 39 classes, 27 races, 9 pages du guide)');
  // une route sans page : le libellé de son menu (Q10) ; celles qu'un mot-clé existant reprend gardent le sien (« Classe → /classes/, Métier →
  // /metiers/, race → /races/ » ; artisanat et ceinture, de même écriture)
  assert.deepEqual(REGISTRE.motsCles.filter((m) => m.route).map((m) => [m.route, m.id, m.libelle, m.origine]).sort(), [
    ['/bestiaire/', 'bestiaire', 'Bestiaire', 'lien'], ['/chronologie/', 'chronologie', 'Chronologie', 'lien'], ['/classes/', 'classe', 'Classe', 'existant'],
    ['/fiche/', 'fiche-de-personnage', 'Fiche de personnage', 'lien'], ['/magies/', 'magies', 'Magies', 'lien'], ['/metiers/', 'metier', 'Métier', 'existant'],
    ['/races/', 'race', 'race', 'existant'], ['/regles/artisanat/', 'artisanat', 'Artisanat', 'existant'],
    ['/ressources/composants/', 'composants', 'Composants', 'lien'], ['/ressources/objets-a-la-ceinture/', 'ceinture', 'Ceinture', 'existant'],
  ]);
  const crees = new Set(MIGRATION.slice(MIGRATION.indexOf('-- 3. '), MIGRATION.indexOf('-- 4. ')).match(/^ {2}\('[^']+'/gm).map((l) => l.slice(4, -1)));
  for (const r of REGISTRE.motsCles) {
    assert.equal(r.origine === 'existant', !crees.has(r.id), r.id);
    if (r.page) {
      assert.equal(r.url, `/${cheminDePage(r.page)}`, r.id);
      assert.ok(!pageExemple.has(r.page), `${r.id} : aucun mot-clé vers une page d'exemple`);
    }
    if (!intacte('mot_cle', { id: r.id })) continue;
    const m = motCle(r.id);
    assert.ok(m, r.id);
    assert.equal(m.url, r.url, r.id);
    assert.equal(m.couleur, r.couleur, r.id);
    if (r.origine !== 'existant') {
      // le libellé de la 0098, ou celui qu'une migration postérieure a écrit (R231, 0112 : le mot-clé d'une page retitrée suit son titre)
      const libelles = [r.libelle, ...REECRITURES_APRES_0098.filter((t) => t.table === 'mot_cle' && t.col === 'libelle' && t.cle.id === r.id && t.avant === r.libelle)
        .map((t) => t.apres)];
      assert.ok(libelles.includes(m.libelle), `${r.id} : ${m.libelle} (attendu : ${libelles.join(' ou ')})`);
      assert.equal(m.id, normalize(r.libelle), `${r.id} : id = normalize(libellé)`);
      assert.equal(m.description, null, `${r.id} : aucune définition inventée`);
      assert.equal(m.abreviation, null, r.id);
    }
  }
  assert.ok(!REGISTRE.motsCles.some((m) => m.id === 'cr'), 'un id retiré n’est jamais réutilisé');
});

test('0098 : un mot-clé existant, de même écriture ou fusionné, garde id, libellé et définition et ne reçoit que l’url (« Le mot-clé existant prend l’URL »)', () => {
  const repris = REGISTRE.motsCles.filter((m) => m.origine === 'existant');
  assert.deepEqual(repris.map((m) => [m.id, m.url]), [
    ['alignement', '/regles/alignement/'], ['alteration-detat', '/regles/alterations-d-etats/'], ['artisanat', '/regles/artisanat/'],
    ['attaque-discrete', '/regles/les-attaques-discretes/'], ['attaque-dopportunite', '/regles/les-attaques-d-opportunite/'],
    ['bouclier', '/ressources/bouclier/'], ['ceinture', '/ressources/objets-a-la-ceinture/'], ['classe', '/classes/'], ['codex', '/lore/codex/'],
    ['degats', '/regles/les-degats/'], ['des', '/regles/jet-de-des/'], ['embuscade', '/regles/l-embuscade/'], ['metier', '/metiers/'],
    ['mode-hyper', '/regles/le-mode-hyper/'], ['piece-elementaire', '/ressources/armes/#pieces-elementaires'], ['posture', '/regles/les-postures/'],
    ['race', '/races/'], ['tenaille', '/regles/prise-en-tenaille-et-zone-d-influence/'],
  ]);
  assert.deepEqual(repris.map((m) => m.id), [...MOTS_CLES_EXISTANTS_REPRIS, ...Object.values(FUSIONS_DANS_L_EXISTANT)].sort());
  assert.equal(repris.filter((m) => m.couleur).length, 0, 'aucune page reprise n’est colorée (sinon l’existant en prendrait la couleur)');
  const section2 = MIGRATION.slice(MIGRATION.indexOf('-- 2. '), MIGRATION.indexOf('-- 3. ')).split('\n').filter((l) => l.startsWith('UPDATE'));
  assert.deepEqual(section2, repris.map((m) => `UPDATE mot_cle SET url = '${m.url}', couleur = ${m.couleur ? `'${m.couleur}'` : 'NULL'} WHERE id = '${m.id}';`),
    'ni le libellé ni la définition ne changent');
});

test('0098 : « Fusionner dans l’existant » — le mot-clé existant prend l’URL, les liens le visent avec leur texte affiché, aucun mot-clé nouveau', () => {
  // 13 paires : la page ou la route, le mot-clé existant (« Résistance » : « Aucun, garder le nouveau »)
  assert.deepEqual(Object.entries(FUSIONS_DANS_L_EXISTANT).sort(), [
    ['/classes/', 'classe'], ['/metiers/', 'metier'], ['/races/', 'race'], ['guide/alterations-d-etats', 'alteration-detat'],
    ['guide/jet-de-des', 'des'], ['guide/l-embuscade', 'embuscade'], ['guide/le-mode-hyper', 'mode-hyper'],
    ['guide/les-attaques-d-opportunite', 'attaque-dopportunite'], ['guide/les-attaques-discretes', 'attaque-discrete'], ['guide/les-degats', 'degats'],
    ['guide/les-postures', 'posture'], ['guide/prise-en-tenaille-et-zone-d-influence', 'tenaille'], ['ressources/pieces-elementaires', 'piece-elementaire'],
  ]);
  const crees = new Set(MIGRATION.slice(MIGRATION.indexOf('-- 3. '), MIGRATION.indexOf('-- 4. ')).match(/^ {2}\('[^']+'/gm).map((l) => l.slice(4, -1)));
  for (const [cible, id] of Object.entries(FUSIONS_DANS_L_EXISTANT)) {
    const menent = REGISTRE.motsCles.filter((m) => (m.page ?? m.route) === cible);
    assert.deepEqual(menent.map((m) => [m.id, m.origine]), [[id, 'existant']], `${cible} : seul l’existant y mène`);
    assert.ok(!crees.has(id), `${id} n’est pas créé`);
  }
  // les mots-clés que la page aurait eus (normalize de son titre ou du libellé du menu) ne sont pas créés
  for (const id of ['les-postures', 'le-mode-hyper', 'alterations-detats', 'classes', 'races', 'metiers', 'les-degats', 'lembuscade',
    'les-attaques-dopportunite', 'pieces-elementaires', 'les-attaques-discretes', 'la-prise-en-tenaille-et-zone-dinfluence', 'jet-de-des']) {
    assert.ok(!crees.has(id) && !REGISTRE.motsCles.some((m) => m.id === id), id);
  }
  // « Résistances et faiblesses » et « Liste des altérations d'état » gardent le mot-clé créé
  assert.deepEqual(['guide/resistances-et-faiblesses', 'guide/liste-des-alterations-d-etat'].map((p) => REGISTRE.motsCles.find((m) => m.page === p)).map((m) => [m.id, m.origine]),
    [['resistances-et-faiblesses', 'lien'], ['liste-des-alterations-detat', 'lien']]);
  assert.ok(!REGISTRE.motsCles.some((m) => m.id === 'resistance'));
  // le texte affiché est gardé : « {{id}} » seulement quand il est le libellé de l'existant
  const fondus = new Map(REGISTRE.motsCles.filter((m) => Object.values(FUSIONS_DANS_L_EXISTANT).includes(m.id)).map((m) => [m.id, m]));
  const sur = REGISTRE.remplacements.filter((r) => fondus.has(/^\{\{([a-z0-9-]+)/.exec(r.balise)[1]));
  assert.ok(sur.length >= 40, `${sur.length} liens convertis vers un existant`);
  for (const r of sur) {
    const [lien] = liensDuTexte(r.lien);
    const m = fondus.get(/^\{\{([a-z0-9-]+)/.exec(r.balise)[1]);
    const attendue = r.table === 'page' && lien.texte === m.libelle ? `{{${m.id}}}` : `{{${m.id}|${lien.texte}}}`;
    assert.equal(r.balise.replace('\\|', '|'), attendue, `${r.table} ${r.cle.id} ${r.lien}`);
  }
  const remplacement = (id, lien) => REGISTRE.remplacements.find((r) => r.cle.id === id && r.lien === lien)?.balise;
  assert.equal(remplacement('guide/attaquer-et-se-defendre', '[[guide/les-postures|Les postures]]'), '{{posture|Les postures}}');
  assert.equal(remplacement('guide/reussir-une-action', '[[guide/jet-de-des|Jet de dés]]'), '{{des|Jet de dés}}');
  assert.equal(remplacement('guide/choisir-sa-classe', '[classes](/classes/)'), '{{classe|classes}}');
  assert.equal(remplacement('guide/le-mode-hyper', '[race](/races/)'), '{{race}}', 'le texte est le libellé de l’existant');
  assert.equal(remplacement('guide/attaquer-et-se-defendre', '[[guide/prise-en-tenaille-et-zone-d-influence|La prise en tenaille et zone d’influence]]'),
    '{{tenaille|La prise en tenaille et zone d’influence}}');
});

test('0098 : homonymes race/classe — « La race garde le nom », la classe prend « (classe) »', () => {
  const de = (page) => REGISTRE.motsCles.find((m) => m.page === page);
  assert.deepEqual([de('races/orios').id, de('races/orios').libelle], ['orios', 'Orios']);
  assert.deepEqual([de('classes/orios').id, de('classes/orios').libelle], ['orios-classe', 'Orios (classe)']);
  assert.equal(de('classes/medusain').libelle, 'Médusain (classe)');
  assert.deepEqual([de('classes/goleois').id, de('classes/goleois').libelle], ['goleois-classe', 'Goleois (classe)'], 'le titre de la page, tel qu’écrit');
  assert.equal(REGISTRE.motsCles.filter((m) => m.page?.startsWith('classes/') && m.libelle.endsWith(' (classe)')).length, 13);
});

test('0098 : chaque mot-clé coloré reprend la couleur de sa page (Q5, Q9), une couleur de la palette', () => {
  const de = (page) => REGISTRE.motsCles.find((m) => m.page === page);
  assert.equal(de('magies/magie-du-sang').couleur, 'magie:sang');
  assert.equal(de('magies/magie-du-sang').couleur, `magie:${classeDeMagie('Sang').slice('couleur-magie-'.length)}`);
  assert.equal(de('magies/potentiel-illimite').couleur, 'magie:potentiel-illimite');
  assert.equal(de('classes/guerrier').couleur, 'classe:melee');
  assert.equal(de('classes/orios').couleur, 'classe:raciales');
  assert.equal(de('races/humain').couleur, 'race:pure');
  assert.equal(de('races/orios').couleur, 'race:hybride');
  assert.equal(de('guide/creer-son-personnage').couleur, 'partie:creer');
  assert.equal(de('guide/bienvenue').couleur, 'partie:decouvrir');
  for (const m of motsClesDeLaBase(db).filter((x) => x.couleur && !x.couleur.startsWith('#'))) {
    const [famille, id] = m.couleur.split(':');
    assert.ok(Object.keys(FAMILLES_DE_LA_PALETTE[famille] ?? {}).some((cle) => idDeCouleur(cle) === id), `${m.id} : ${m.couleur} est une couleur de la palette`);
  }
});

test('0098 : quelques liens convertis, leur texte affiché gardé', () => {
  const remplacement = (table, id, lien) => REGISTRE.remplacements.find((r) => r.table === table && r.cle.id === id && r.lien === lien);
  assert.equal(remplacement('page', 'guide/actions-et-mouvements', '[[La Vitesse et la Portée|la vitesse]]').balise, '{{la-vitesse-et-la-portee|la vitesse}}');
  assert.equal(remplacement('page', 'metiers/regles-des-metiers', '[[Mineur]]').balise, '{{mineur}}');
  assert.equal(REGISTRE.motsCles.find((m) => m.id === 'mineur').url, '/metiers/#metier-mineur');
  assert.equal(remplacement('page', 'guide/creer-son-personnage', '[fiche de personnage](/fiche/)').balise, '{{fiche-de-personnage|fiche de personnage}}');
  assert.equal(remplacement('page', 'guide/l-equipement', '[Armures](/ressources/equipement/#armures)').balise, '{{armures}}', 'renvoyé à la page Armures');
  assert.equal(remplacement('page', 'guide/la-magie-en-jeu', '[Bâtons magiques](/ressources/equipement/#batons-magiques)').balise.startsWith('{{baton-magique|'), true);
  assert.equal(remplacement('page', 'guide/resistances-et-faiblesses', '[Relations entre magies](/magies/#relations)').balise, '{{magies|Relations entre magies}}');
  assert.equal(REGISTRE.anciennesAncres.length, 3, 'ancres perdues : #ceinture-consommables, #materiaux, #relations');
  // la compétence Vigueur : le lien que la 0096 (retrait de « Altérations d'états et Mode Hyper ») a écrit vers « Altérations d'états » vise le mot-clé
  // existant « Altération d'état » (« Fusionner dans l'existant »)
  assert.equal(remplacement('competence', 'vigueur', "[[guide/alterations-d-etats|altérations d'états]]").balise, "{{alteration-detat|altérations d'états}}");
  assert.match(texteApres0098('competence', 'description', 'vigueur'), /^Mieux résister aux \{\{alteration-detat\|altérations d'états\}\} physiques/);
  assert.match(texteApres0098('page', 'corps_md', 'guide/bienvenue'), /\[sur la page d’accueil\]\(\/#lien-discord\)/, 'Q10 : le lien vers l’accueil reste');
});

test('0098 : les métiers Alchimiste et Apothicaire — la balise à la source, le corps rendu de la ligne', () => {
  for (const id of ['metiers/alchimiste', 'metiers/apothicaire']) {
    const ligne = db.prepare('SELECT * FROM metier WHERE id = ?').get(id);
    if (!ligne) {
      // supprimé par le site de dev (cas admis, vérifié) : la balise à la source se lit à l'import (test précédent, registre)
      assert.ok(historiqueSite(db).supprimee('metier', { id }), `${id} absent sans que le site de dev l’ait supprimé`);
      continue;
    }
    if (intacte('metier', { id })) assert.match(ligne.artisanat_texte, /l’\{\{alchimie-primitive\|alchimie primitive\}\}$/, id);
    assert.ok(ligne.artisanat_brut.startsWith(`${ligne.artisanat_texte} [`), `${id} : artisanat_brut recopie artisanat_texte`);
    assert.equal(texte('page', 'corps_md', id), corpsDeMetier(ligne), `${id} : corps = corpsDeMetier(ligne)`);
  }
});

test('0098 : plus aucun lien interne hors pages d’exemple, codes et section 15 ; formes canoniques', () => {
  const vocabulaire = motsClesDeLaBase(db);
  const restes = [];
  for (const col of textesDeLaBase(db)) {
    const cols = db.prepare(`PRAGMA table_info("${col.table}")`).all().map((c) => c.name);
    const page = col.table === 'page' ? 'id' : cols.includes('page_id') ? 'page_id' : null;
    const lignes = db.prepare(`SELECT ${page ? `"${page}" AS p, ` : ''}"${col.colonne}" AS v FROM "${col.table}" WHERE instr("${col.colonne}", '[[') > 0 OR instr("${col.colonne}", '](/') > 0`).all();
    for (const l of lignes) {
      if (page && pageExemple.has(l.p)) continue;
      for (const lien of liensDuTexte(l.v, { markdown: col.markdown })) if (!LIENS_GARDES.includes(lien.cible)) restes.push(`${col.table}.${col.colonne} ${lien.brut}`);
    }
  }
  assert.deepEqual(restes, []);
  // R198 : les deux balises du Doc « Guide pour MJ » que la 0104 a retirées sont bien dans son registre (l'écriture d'avant ou d'après est admise)
  assert.deepEqual(REGISTRE.remplacements.filter((r) => retiresPar(r, REECRITURES_R198).length).map((r) => r.cle.id).sort(), ['guide/attaquer-et-se-defendre', 'guide/les-postures']);
  for (const r of REGISTRE.remplacements) {
    if (!intacte(r.table, r.cle)) continue;
    const v = texte(r.table, r.colonne, r.cle.id);
    assert.ok(baliseOuReecriture(r, v), `${r.table} ${r.cle.id} : ${r.balise} (ou le fragment qu'une migration postérieure a réécrit, R198)`);
    assert.deepEqual(formesNonCanoniques(v, vocabulaire, { markdown: r.table === 'page' && r.colonne === 'corps_md' }), [], `${r.table} ${r.cle.id}`);
  }
  // les pages d'exemple gardent leurs liens, la page « Utiliser ce wiki » ses liens en code
  assert.ok(db.prepare("SELECT count(*) AS n FROM page WHERE statut = 'example' AND instr(corps_md, '[[') > 0").get().n > 0);
  assert.ok(texte('page', 'corps_md', 'guide/utiliser-ce-wiki').includes('[[Titre|texte affiché]]'));
});

test('convertirLesLiens : la conversion pure, avec la table du registre', () => {
  const table = tableDeConversion([
    { id: 'la-vitesse', libelle: 'La vitesse', cles: ['id:guide/vitesse', 'la-vitesse', 'vitesse'], adresses: ['/regles/vitesse/'] },
    { id: 'magies', libelle: 'Magies', cles: [], adresses: ['/magies/', '/magies/#relations'] },
  ]);
  const md = (t) => convertirLesLiens(t, table, { markdown: true });
  assert.equal(md('Voir [[La Vitesse]].').texte, 'Voir {{la-vitesse|La Vitesse}}.', 'casse écrite gardée');
  assert.equal(md('Voir [[la vitesse|La vitesse]] et [[guide/vitesse]].').texte, 'Voir {{la-vitesse}} et {{la-vitesse|guide/vitesse}}.');
  assert.equal(md('[les magies](/magies/#relations), [Magies](/magies/)').texte, '{{magies|les magies}}, {{magies}}');
  assert.equal(md('| a | [[vitesse|v]] |').texte, '| a | {{la-vitesse\\|v}} |', 'ligne de tableau : « \\| »');
  assert.equal(md('`[[vitesse]]` et\n```\n[[vitesse]]\n```\n').texte, '`[[vitesse]]` et\n```\n[[vitesse]]\n```\n', 'code gardé');
  const inconnu = md('[[Ailleurs]] et [accueil](/#lien-discord) et ![image](/a.png)');
  assert.equal(inconnu.texte, '[[Ailleurs]] et [accueil](/#lien-discord) et ![image](/a.png)');
  assert.deepEqual(inconnu.restes, ['[[Ailleurs]]', '[accueil](/#lien-discord)']);
  assert.equal(convertirLesLiens('Aux [[La vitesse]].', table).texte, 'Aux {{la-vitesse|La vitesse}}.', 'texte de case : toujours le texte');
  assert.deepEqual(md('[[vitesse|v]]').convertis, [{ brut: '[[vitesse|v]]', balise: '{{la-vitesse|v}}', id: 'la-vitesse' }]);
  assert.throws(() => tableDeConversion([{ id: 'a', libelle: 'A', cles: ['x'] }, { id: 'b', libelle: 'B', cles: ['x'] }]), /deux mots-clés/);
  // le registre de la migration en fait une table, et redonne chaque balise
  const t = tableDeConversion(REGISTRE.motsCles);
  for (const r of REGISTRE.remplacements.filter((x) => x.table === 'page')) {
    const { texte: converti } = convertirLesLiens(r.lien, t, { markdown: true });
    if (!r.balise.includes('\\|')) assert.equal(converti, r.balise, r.lien);
  }
});
