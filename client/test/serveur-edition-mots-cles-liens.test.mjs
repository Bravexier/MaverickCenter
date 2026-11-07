// Le lien et la couleur d'un mot-clé au service d'édition (migration 0098 ; réponses du propriétaire du 2026-11-06 : `mot_cle` gagne « couleur » et
// « url », « URL interne seulement » ; les [[…]] et les liens Markdown internes deviennent des balises) :
//   - le modèle : `url` (type « adresse ») et `couleur` (type « couleur ») dans TABLES et ENTITES, hors CHAMPS_DE_TEXTE ; une couleur écrite en minuscules ;
//   - GET /api/edition/mots-cles/ : url, couleur, classe de chaque mot-clé, et la feuille de leurs classes (`css`) ;
//   - création (url et couleur écrites seulement si elles sont données), modification (protégés compris), refus 400 { champ } (jamais 409) : forme,
//     page inexistante, couleur inconnue ; l'existence de la page se lit dans la base vivante, ancre et requête non vérifiées ;
//   - fusion : la cible garde son lien et sa couleur, prend ceux de la source qu'elle n'a pas (noté au journal), et le résumé dit ce qu'elle garde ;
//   - un lien saisi dans un texte (CHAMPS_DE_TEXTE) : `[[…]]` et `[texte](/…)` ajoutés deviennent la balise du seul mot-clé qui mène à leur page, sinon
//     400 { champ, liens } (renvoi au Glossaire) ; un lien externe, un lien dans un code, un lien déjà là, une page d'exemple : rien ; un lien dont le
//     texte affiché porte du Markdown ou une balise (« [**x**](/races/) », « [{{a}}](/x/) ») : refusé de même (choix du leader-technique), avec un
//     message qui demande la balise du mot-clé avec un texte simple, jamais converti en « {{race|**x**}} ».
// Les tests lisent l'état avant d'écrire et prennent des noms absents de la base.
//   node --test test/serveur-edition-mots-cles-liens.test.mjs
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { test } from 'node:test';
import { traiter } from '../serveur/api.mjs';
import { ouvrirBaseVivante, preparerBaseVivante } from '../serveur/base-vivante.mjs';
import { CHAMPS_DE_TEXTE, ENTITES, TABLES, valeurDuChamp } from '../src/lib/edition-modele.mjs';
import { classeDuMotCle, PREFIXE_DE_CLASSE } from '../src/lib/mots-cles-liens.mjs';
import { cssDesMotsCles } from '../src/lib/palette-css.mjs';
import { raisonDeProtection } from '../src/lib/mots-cles.mjs';
import { normalize } from '../src/lib/text.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';
import { cheminDImport } from './aide-base-d-import.mjs';

const racine = dossierTemporaire('edition-mots-cles-liens');
let compteur = 0;

/** Une base vivante neuve (règles avec les pages d'exemple) et le service qui l'écrit. */
function nouvelle() {
  // les règles de l'import (test/aide-base-d-import.mjs) : les mots-clés à adresse que les essais citent (« drakos »…) ne sont pas protégés, le site
  // de dev peut les supprimer
  const db = ouvrirBaseVivante(preparerBaseVivante({ regles: cheminDImport(), dossier: join(racine, `b${(compteur += 1)}`) }).chemin);
  const service = { base: () => db, etat: () => ({}), edition: true };
  const appel = (methode, chemin, corps) => traiter({ methode, chemin, entetes: { 'content-type': 'application/json' }, corps: corps && JSON.stringify(corps) }, service);
  const lot = (operations, page = 'recherche/') => appel('POST', '/api/edition/', { page, operations });
  const motCle = (id) => ({ ...db.prepare('SELECT * FROM mot_cle WHERE id = ?').get(id) });
  const nombre = () => db.prepare('SELECT count(*) AS n FROM modification').get().n;
  /** Un libellé de mot-clé que le vocabulaire n'a pas. */
  const motLibre = (base) => {
    let t = base;
    for (let i = 2; db.prepare('SELECT 1 FROM mot_cle WHERE libelle_cle = ? OR id = ?').get(normalize(t), normalize(t)); i += 1) t = `${base} ${i}`;
    return t;
  };
  return { db, appel, lot, motCle, nombre, motLibre };
}
const ok = (r) => {
  assert.equal(r.statut, 200, JSON.stringify(r.corps));
  return r.corps;
};
const creerMotCle = (lot, valeurs) => lot([{ op: 'creer', entite: 'mot_cle', valeurs }]);

test('modèle : url (« adresse ») et couleur (« couleur ») dans TABLES et ENTITES, hors des textes à balises ; une ligne, une couleur écrite en minuscules', () => {
  for (const champs of [TABLES.mot_cle.colonnes, ENTITES.mot_cle.champs]) {
    assert.equal(champs.url.type, 'adresse');
    assert.equal(champs.couleur.type, 'couleur');
    assert.ok(!champs.url.requis && !champs.couleur.requis);
  }
  assert.ok(!CHAMPS_DE_TEXTE.includes('adresse') && !CHAMPS_DE_TEXTE.includes('couleur'));
  assert.equal(valeurDuChamp(TABLES.mot_cle.colonnes.url, '  /races/\nnain/ '), '/races/ nain/', 'une ligne (la forme se juge au service)');
  assert.equal(valeurDuChamp(TABLES.mot_cle.colonnes.url, '  '), null);
  assert.equal(valeurDuChamp(TABLES.mot_cle.colonnes.couleur, ' #12ABef '), '#12abef');
  assert.equal(valeurDuChamp(TABLES.mot_cle.colonnes.couleur, 'race:pure'), 'race:pure');
  assert.equal(valeurDuChamp(TABLES.mot_cle.colonnes.couleur, ''), null);
});

test('GET /api/edition/mots-cles/ : url, couleur et classe de chaque mot-clé, et la feuille de leurs classes', () => {
  const { appel } = nouvelle();
  const r = appel('GET', '/api/edition/mots-cles/');
  assert.equal(r.statut, 200);
  const { motsCles, css } = r.corps;
  const drakos = motsCles.find((m) => m.id === 'drakos');
  assert.deepEqual([drakos.url, drakos.couleur, drakos.classe], ['/races/drakos/', 'race:pure', 'couleur-race-pure']);
  for (const m of motsCles) {
    assert.ok('url' in m && 'couleur' in m && 'classe' in m, m.id);
    assert.equal(m.classe, classeDuMotCle(m), m.id);
  }
  assert.equal(css, cssDesMotsCles(motsCles));
  assert.match(css, /\.couleur-race-pure\{--couleur:#[0-9a-f]{6};--couleur-texte:#[0-9a-f]{6}\}/);
  assert.doesNotMatch(css, /\.couleur-magie-/, 'la famille des magies est déjà sur chaque page');
});

test('créer un mot-clé avec un lien et une couleur ; sans eux, rien n’est écrit ni noté ; refus 400 { champ } avant toute écriture', () => {
  const { db, lot, motCle, nombre, motLibre } = nouvelle();
  const libelle = motLibre('Essai lien coloré');
  const r = ok(creerMotCle(lot, { libelle, url: '/races/drakos/#peuples?x=1', couleur: '#12ABEF' }));
  const id = r.crees[0].id;
  assert.deepEqual([motCle(id).url, motCle(id).couleur], ['/races/drakos/#peuples?x=1', '#12abef'], 'ancre et requête non vérifiées ; minuscules');
  assert.equal(classeDuMotCle(motCle(id)), `${PREFIXE_DE_CLASSE}${id}`);
  assert.ok(ok(creerMotCle(lot, { libelle: motLibre('Essai route') , url: '/fiche/', couleur: 'classe:melee' })).crees[0].id);
  // sans lien ni couleur : NULL
  const sans = ok(creerMotCle(lot, { libelle: motLibre('Essai sans lien') }));
  assert.deepEqual([motCle(sans.crees[0].id).url, motCle(sans.crees[0].id).couleur], [null, null]);
  // les refus
  const avant = nombre();
  for (const [valeurs, champ, motif] of [
    [{ url: 'https://exemple.org/' }, 'url', /interne/],
    [{ url: '//hote/races/' }, 'url', /interne/],
    [{ url: '/races/pas-une-page-d-essai/' }, 'url', /aucune page/],
    [{ url: '/races/drakos' }, 'url', /barre finale/],
    [{ url: '/races/dra kos/' }, 'url', /ASCII|aucune page/],
    [{ couleur: 'rouge' }, 'couleur', /#rrggbb/],
    [{ couleur: 'race:inconnue' }, 'couleur', /pas de couleur/],
    [{ couleur: 'teinte:rouge' }, 'couleur', /pas une famille/],
  ]) {
    const refus = creerMotCle(lot, { libelle: motLibre('Essai refusé'), ...valeurs });
    assert.equal(refus.statut, 400, JSON.stringify(valeurs));
    assert.equal(refus.corps.champ, champ, JSON.stringify(refus.corps));
    assert.match(refus.corps.erreur, motif);
  }
  // une page d'exemple n'est pas une adresse du site
  const exemple = db.prepare("SELECT id FROM page WHERE statut = 'example' AND type = 'races' ORDER BY id").get().id;
  assert.equal(creerMotCle(lot, { libelle: motLibre('Essai exemple'), url: `/${exemple}/` }).statut, 400);
  assert.equal(nombre(), avant, 'rien d’écrit');
});

test('modifier le lien et la couleur : vidés (NULL), changés, protégés compris ; 400 { champ } jamais 409 ; inchangés, pas contrôlés', () => {
  const { lot, motCle, nombre } = nouvelle();
  const modifier = (id, valeurs) => lot([{ op: 'modifier', table: 'mot_cle', cle: { id }, valeurs }]);
  ok(modifier('drakos', { url: '', couleur: '' }));
  assert.deepEqual([motCle('drakos').url, motCle('drakos').couleur], [null, null]);
  ok(modifier('drakos', { url: '/races/drakos/', couleur: 'race:hybride' }));
  assert.deepEqual([motCle('drakos').url, motCle('drakos').couleur], ['/races/drakos/', 'race:hybride']);
  // un mot-clé dont le site se sert (MOTS_CLES_PROTEGES) : son lien et sa couleur se modifient
  assert.ok(raisonDeProtection('codex'), '« codex » est protégé');
  ok(modifier('codex', { url: '/lore/', couleur: '#00aa00' }));
  assert.deepEqual([motCle('codex').url, motCle('codex').couleur], ['/lore/', '#00aa00']);
  ok(modifier('codex', { url: '/lore/codex/', couleur: null }));
  const avant = nombre();
  for (const [valeurs, champ] of [[{ url: '/lore/pas-de-page-d-essai/' }, 'url'], [{ url: 'lore/codex/' }, 'url'], [{ couleur: '#abc' }, 'couleur']]) {
    const r = modifier('codex', valeurs);
    assert.equal(r.statut, 400, JSON.stringify(r.corps));
    assert.equal(r.corps.champ, champ);
  }
  assert.equal(nombre(), avant);
  // une adresse en place, que la règle refuserait, ne bloque pas une autre modification (elle n'est contrôlée que si elle change)
  ok(modifier('codex', { description: `${motCle('codex').description ?? ''} (essai)`.trim(), url: '/lore/codex/' }));
});

test('fusion : la cible garde son lien et sa couleur, prend ceux de la source qu’elle n’a pas (noté au journal) ; le résumé dit ce qu’elle garde', () => {
  const { db, lot, motCle, motLibre } = nouvelle();
  const creer = (valeurs) => ok(creerMotCle(lot, { libelle: motLibre(valeurs.libelle), ...valeurs })).crees[0].id;
  const fusionner = (source, cible) => ok(lot([{ op: 'fusionner_mots_cles', mot_cle: source, dans: cible }]));
  // la cible n'a rien : elle prend le lien et la couleur de la source
  const s1 = creer({ libelle: 'Essai source lien', url: '/races/drakos/', couleur: 'race:pure' });
  const c1 = creer({ libelle: 'Essai cible nue' });
  const r1 = fusionner(s1, c1);
  assert.deepEqual([motCle(c1).url, motCle(c1).couleur], ['/races/drakos/', 'race:pure']);
  const notees = db.prepare('SELECT table_nom, operation, cle, apres FROM modification WHERE lot_id = ? ORDER BY rang').all(r1.lot)
    .map((m) => ({ table: m.table_nom, operation: m.operation, cle: JSON.parse(m.cle), apres: m.apres && JSON.parse(m.apres) }));
  assert.ok(notees.some((m) => m.table === 'mot_cle' && m.operation === 'modifier' && m.cle.id === c1 && m.apres.url === '/races/drakos/' && m.apres.couleur === 'race:pure'),
    JSON.stringify(notees));
  assert.equal(db.prepare('SELECT 1 FROM mot_cle WHERE id = ?').get(s1), undefined);
  assert.match(db.prepare('SELECT resume FROM modification_lot WHERE id = ?').get(r1.lot).resume, /il en prend le lien et la couleur/);
  // les deux en ont : la cible garde les siens ; une seule reprise (la couleur qui lui manque)
  const s2 = creer({ libelle: 'Essai source deux', url: '/races/drakos/', couleur: '#112233' });
  const c2 = creer({ libelle: 'Essai cible deux', url: '/races/nain/' });
  const r2 = fusionner(s2, c2);
  assert.deepEqual([motCle(c2).url, motCle(c2).couleur], ['/races/nain/', '#112233']);
  const resume = db.prepare('SELECT resume FROM modification_lot WHERE id = ?').get(r2.lot).resume;
  assert.match(resume, /il en prend la couleur/);
  assert.match(resume, /garde le lien/);
  // ni lien ni couleur à la source : rien de modifié sur la cible
  const s3 = creer({ libelle: 'Essai source trois' });
  const r3 = fusionner(s3, c2);
  assert.equal(db.prepare("SELECT count(*) AS n FROM modification WHERE lot_id = ? AND table_nom = 'mot_cle' AND operation = 'modifier'").get(r3.lot).n, 0);
  assert.doesNotMatch(db.prepare('SELECT resume FROM modification_lot WHERE id = ?').get(r3.lot).resume, /prend|garde/);
});

test('un lien saisi devient la balise du seul mot-clé qui mène à sa page ; externe, dans un code, déjà là : gardé ; sinon 400 { champ, liens } qui renvoie au Glossaire', () => {
  const { db, lot, nombre, motLibre } = nouvelle();
  const page = db.prepare("SELECT id, corps_md FROM page WHERE type = 'guide' AND statut <> 'example' AND instr(corps_md, '[[') = 0 AND instr(corps_md, '](/') = 0 ORDER BY id").get();
  const modifier = (corps) => lot([{ op: 'modifier', table: 'page', cle: { id: page.id }, valeurs: { corps_md: corps } }], `${page.id}/`);
  const ajout = '\n\nEssai : [[Drakos]], [[races/nain|les nains]], [le peuple](/races/drakos/#peuples), [la fiche](/fiche/), '
    + '[relations](/magies/#relations), [un mineur](/metiers/#metier-mineur), [Discord](/#lien-discord), [ailleurs](https://exemple.org/), `[[Drakos]]`.\n\n'
    + '| a | b |\n| --- | --- |\n| x | [[Drakos|d]] |\n';
  ok(modifier(`${page.corps_md}${ajout}`));
  const attendu = '\n\nEssai : {{drakos}}, {{nain|les nains}}, {{drakos|le peuple}}, {{fiche-de-personnage|la fiche}}, {{magies|relations}}, '
    + '{{mineur|un mineur}}, [Discord](/#lien-discord), [ailleurs](https://exemple.org/), `[[Drakos]]`.\n\n| a | b |\n| --- | --- |\n| x | {{drakos\\|d}} |\n';
  assert.equal(db.prepare('SELECT corps_md FROM page WHERE id = ?').get(page.id).corps_md, `${page.corps_md}${attendu}`);
  // un texte de case : « {{id|texte}} » toujours
  const metier = db.prepare('SELECT id, description FROM metier ORDER BY id').get();
  ok(lot([{ op: 'modifier', table: 'metier', cle: { id: metier.id }, valeurs: { description: `${metier.description} Voir [[Drakos]].` } }], 'metiers/'));
  assert.equal(db.prepare('SELECT description FROM metier WHERE id = ?').get(metier.id).description, `${metier.description} Voir {{drakos|Drakos}}.`);
  // les refus : cible introuvable, adresse sans mot-clé, deux mots-clés vers la même page, texte qu'une balise n'écrit pas
  ok(creerMotCle(lot, { libelle: motLibre('Essai deuxième vers le Nain'), url: '/races/nain/' }));
  const avant = nombre();
  for (const lien of ['[[Une page qui n’existe pas d’essai]]', '[x](/regles/pas-de-page-d-essai/)', '[[Nain]]', '[a{b](/races/drakos/)']) {
    const r = modifier(`${page.corps_md}\n\n${lien}\n`);
    assert.equal(r.statut, 400, lien);
    assert.equal(r.corps.champ, 'corps_md');
    assert.deepEqual(r.corps.liens, [lien]);
    assert.match(r.corps.erreur, /Glossaire \(\/regles\/glossaire\/\)/);
  }
  assert.equal(nombre(), avant, 'rien d’écrit');
  // une création (événement de la chronologie : sa description) suit la même règle
  const ev = lot([{ op: 'creer', entite: 'evenement', valeurs: { titre: motLibre('Essai événement lié'), epoque: 'inconnue', description: 'Voir [[Drakos]].' } }], 'chronologie/');
  if (ev.statut === 200) {
    const id = ev.corps.crees[0].id;
    assert.match(JSON.stringify(db.prepare('SELECT * FROM evenement_extrait WHERE evenement_id = ?').all(id)), /\{\{drakos(\|Drakos)?\}\}/);
  } else {
    assert.doesNotMatch(JSON.stringify(ev.corps), /liens/, `un autre refus que celui des liens : ${JSON.stringify(ev.corps)}`);
  }
});

test('un lien saisi au texte mis en forme ou balisé : 400 { champ, liens } qui demande la balise avec un texte simple, rien d’écrit, même vers un mot-clé unique', () => {
  const { db, lot, nombre } = nouvelle();
  const page = db.prepare("SELECT id, corps_md FROM page WHERE type = 'guide' AND statut <> 'example' AND instr(corps_md, '[[') = 0 AND instr(corps_md, '](/') = 0 ORDER BY id").get();
  const modifier = (corps) => lot([{ op: 'modifier', table: 'page', cle: { id: page.id }, valeurs: { corps_md: corps } }], `${page.id}/`);
  // une adresse où mène un seul mot-clé (lue dans la base vivante, jamais supposée) : sans le refus, le lien deviendrait sa balise
  const adresse = db.prepare("SELECT url FROM mot_cle WHERE url IS NOT NULL AND url NOT LIKE '%#%' AND url NOT LIKE '%?%' GROUP BY url HAVING count(*) = 1 ORDER BY url").get().url;
  ok(modifier(`${page.corps_md}\n\n[texte simple d’essai](${adresse})\n`));
  assert.match(db.prepare('SELECT corps_md FROM page WHERE id = ?').get(page.id).corps_md, /\{\{[^{}|]+\|texte simple d’essai\}\}/, 'le témoin : un texte simple passe');
  const corps = db.prepare('SELECT corps_md FROM page WHERE id = ?').get(page.id).corps_md;
  const avant = nombre();
  const nonSimples = [`[**x**](${adresse})`, `[*x*](${adresse})`, `[_x_](${adresse})`, `[~~x~~](${adresse})`,
    `[<b>x</b>](${adresse})`, `[{{a}}](${adresse})`, `[a\\*b](${adresse})`, `[](${adresse})`, '[[Drakos|**d**]]', '[[Drakos|{{a}}]]'];
  for (const lien of nonSimples) {
    const r = modifier(`${corps}\n\nVoir ${lien}.\n`);
    assert.equal(r.statut, 400, `${lien} : ${JSON.stringify(r.corps)}`);
    assert.equal(r.corps.champ, 'corps_md');
    assert.deepEqual(r.corps.liens, [lien]);
    assert.match(r.corps.erreur, /texte simple/, lien);
    assert.match(r.corps.erreur, /Glossaire \(\/regles\/glossaire\/\)/);
    assert.doesNotMatch(r.corps.erreur, /aucun mot-clé ne mène/, `${lien} : le refus dit la vraie raison`);
  }
  // un texte de case suit la même règle
  const metier = db.prepare('SELECT id, description FROM metier ORDER BY id').get();
  const r = lot([{ op: 'modifier', table: 'metier', cle: { id: metier.id }, valeurs: { description: `${metier.description} Voir [**x**](${adresse}).` } }], 'metiers/');
  assert.equal(r.statut, 400, JSON.stringify(r.corps));
  assert.deepEqual(r.corps, { ...r.corps, champ: 'description', liens: [`[**x**](${adresse})`] });
  // les deux raisons dans un même texte : chaque lien refusé est listé, et le message les dit toutes deux
  const deux = modifier(`${corps}\n\n[**x**](${adresse}) et [y](/regles/pas-de-page-d-essai/).\n`);
  assert.equal(deux.statut, 400);
  assert.deepEqual(deux.corps.liens, [`[**x**](${adresse})`, '[y](/regles/pas-de-page-d-essai/)']);
  assert.match(deux.corps.erreur, /texte simple/);
  assert.match(deux.corps.erreur, /aucun mot-clé ne mène/);
  assert.equal(nombre(), avant, 'rien d’écrit');
  assert.equal(db.prepare('SELECT corps_md FROM page WHERE id = ?').get(page.id).corps_md, corps);
});

test('une page d’exemple garde ses liens ; un lien déjà là n’est pas jugé', () => {
  const { db, lot } = nouvelle();
  const exemple = db.prepare("SELECT id, corps_md FROM page WHERE statut = 'example' AND type = 'guide' ORDER BY id").get();
  const corps = `${exemple.corps_md}\n\nVoir [[Drakos]] et [[Une page qui n’existe pas d’essai]].\n`;
  ok(lot([{ op: 'modifier', table: 'page', cle: { id: exemple.id }, valeurs: { corps_md: corps } }], `${exemple.id}/`));
  assert.equal(db.prepare('SELECT corps_md FROM page WHERE id = ?').get(exemple.id).corps_md, corps);
  // la page d'accueil de Découvrir garde son « /#lien-discord » ; le texte se modifie sans y toucher
  const bienvenue = db.prepare("SELECT corps_md FROM page WHERE id = 'guide/bienvenue'").get()?.corps_md;
  if (bienvenue?.includes('](/#lien-discord)')) {
    ok(lot([{ op: 'modifier', table: 'page', cle: { id: 'guide/bienvenue' }, valeurs: { corps_md: `${bienvenue}\nUne ligne d’essai.\n` } }], 'decouvrir/'));
  }
});
