// API du service des personnages (client/serveur/api.mjs, fiches.mjs, service.mjs ; docs/serveur.md) : prétirés créés, lus, modifiés au format
// de src/lib/fiche-format.mjs, contrôles de la base rendus (ils signalent, ils n'empêchent jamais d'enregistrer : plus de statut, migration 0038),
// écritures refusées pour la bonne raison, rien d'écrit en cas de refus ; la liste (portrait : empreinte et cadrage) et l'image d'un portrait ; puis
// le serveur HTTP réel (port au hasard) et sa surveillance des fichiers (nouvelles règles, base remplacée, nouvelle version du service).
import assert from 'node:assert/strict';
import { copyFileSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { after, test } from 'node:test';
import { traiter } from '../serveur/api.mjs';
import { TABLES_VIVANTES, ouvrirBaseVivante, preparerBaseVivante } from '../serveur/base-vivante.mjs';
import { DEPART_DES_COLONNES_AJOUTEES, PAGE_D_AVANT, enregistrerFiche, expliquer, LIGNES_MAX, lireFiche, listerFiches } from '../serveur/fiches.mjs';
import { demarrerService, guetteur } from '../serveur/service.mjs';
import { cheminBase } from '../src/lib/donnees.mjs';
import { COLONNES_DU_SERVICE, COLONNES_RETIREES, HORS_FICHE, PARTIES_DE_FICHE, PARTIES_RETIREES, TABLES_RETIREES, ficheVide, jourDuRetrait } from '../src/lib/fiche-format.mjs';
import { adresseDuPortrait } from '../src/lib/personnages-liste.mjs';
import { empreinte } from '../src/lib/portrait.mjs';

/** Images écrites par Chromium (test/portrait.test.mjs) : WebP, JPEG et PNG de 3 × 2 pixels. */
const IMAGES = JSON.parse(readFileSync(new URL('./fixtures/portraits.json', import.meta.url), 'utf8'));
/** Les octets d'une data URL, décodés à part (pas par lib/portrait.mjs, que le service utilise). */
const octetsDe = (dataUrl) => Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64');

const racine = mkdtempSync(join(tmpdir(), 'maverick-api-'));
after(() => rmSync(racine, { recursive: true, force: true }));
const REGLES = cheminBase({ sansExemples: false });
const VERSION_DU_SCHEMA = new DatabaseSync(REGLES, { readOnly: true }).prepare('PRAGMA user_version').get().user_version;
const { chemin } = preparerBaseVivante({ regles: REGLES, dossier: join(racine, 'db') });
const db = ouvrirBaseVivante(chemin);
const journal = [];
const service = { base: () => db, etat: () => ({ service: 'essai' }), journal: (l) => journal.push(l) };
const JSON_ = { 'content-type': 'application/json' };

/** Appel direct de l'API (sans réseau). */
function appel(methode, chemin_, corps, entetes = JSON_) {
  return traiter({ methode, chemin: chemin_, entetes, corps: corps === undefined ? undefined : typeof corps === 'string' ? corps : JSON.stringify(corps) }, service);
}
const lire = (id) => appel('GET', `/api/personnages/${id}`).corps;

/** Prétiré conforme de niveau 1 (comme test/personnages-db.test.mjs) : Humain central, Guerrier, Feu ; 14 points de caractéristiques, 100 de compétences. */
function ficheConforme(nom = 'Aldric') {
  return {
    ...ficheVide(nom),
    race_id: 'races/humain', ethnie_id: 'races/humain#ethnie:humain-central', magie_innee_id: 'magies/magie-du-feu', bourse_ro: 12,
    classes: [{ rang: 1, classe_id: 'classes/guerrier', specialite_id: null }],
    caracteristiques: Object.entries({ force: 4, volonte: 2, intelligence: 2, perception: 2, social: 2, agilite: 2 })
      .map(([caracteristique_id, base]) => ({ caracteristique_id, base, croix: 0 })),
    competences: ['arc', 'arme-lourde', 'athletisme', 'parade', 'stabilite'].map((competence_id) => ({ competence_id, naturel: 20 })),
  };
}

test('format : chaque table qui cite une fiche est une partie de la fiche ou explicitement hors de la fiche ; une fiche vide n’a que des champs connus', () => {
  const citent = TABLES_VIVANTES.filter((t) => db.prepare(`PRAGMA foreign_key_list("${t}")`).all().some((f) => f.table === 'personnage'));
  assert.deepEqual([...citent].sort(), [...Object.values(PARTIES_DE_FICHE), ...HORS_FICHE].sort());
  const colonnes = db.prepare('PRAGMA table_info(personnage)').all();
  for (const cle of Object.keys(ficheVide())) {
    assert.ok(cle in PARTIES_DE_FICHE || colonnes.some((c) => c.name === cle && !COLONNES_DU_SERVICE.includes(cle)), cle);
  }
  for (const c of colonnes.filter((x) => x.notnull && !COLONNES_DU_SERVICE.includes(x.name))) assert.ok(c.name in ficheVide(), `${c.name} : obligatoire, absent de ficheVide`);
  for (const c of COLONNES_DU_SERVICE) assert.ok(colonnes.some((x) => x.name === c), c);
  // une colonne que les règles ont retirée (le statut, migration 0038) : plus dans sa table, ni dans une fiche vide
  for (const [table, retirees] of Object.entries(COLONNES_RETIREES)) {
    assert.ok(TABLES_VIVANTES.includes(table), table);
    const presentes = db.prepare(`PRAGMA table_info("${table}")`).all().map((c) => c.name);
    for (const c of retirees) assert.ok(!presentes.includes(c), `${table}.${c} : retirée des règles, encore dans la table`);
  }
  for (const c of COLONNES_RETIREES.personnage) assert.ok(!(c in ficheVide()), `${c} : retirée des règles, encore dans ficheVide`);
  // une table que les règles ont retirée (personnage_progression, migration 0045) : plus dans la base ni dans une fiche, sa clé n'est plus une partie
  for (const [table, cle] of Object.entries(TABLES_RETIREES)) {
    assert.equal(PARTIES_RETIREES[cle], table);
    assert.ok(!(cle in PARTIES_DE_FICHE) && !(cle in ficheVide()), cle);
    assert.ok(!TABLES_VIVANTES.includes(table), table);
    assert.equal(db.prepare("SELECT count(*) AS n FROM sqlite_master WHERE type = 'table' AND name = ?").get(table).n, 0, `${table} : encore dans la base`);
  }
});

test('un choix que les règles n’ont plus (don ou spécialité supprimé depuis le site de dev, D11) : message en français, rien n’est écrit', () => {
  assert.equal(expliquer('FOREIGN KEY constraint failed'), 'un choix de la fiche (don, spécialité…) n’existe plus dans les règles : rechargez la page');
  const avant = db.prepare('SELECT count(*) AS n FROM personnage').get().n;
  const r = appel('POST', '/api/personnages', { ...ficheVide('Sans règle'), capacites: [{ capacite_id: 'capacites/don-supprime-d11' }] });
  assert.equal(r.statut, 400);
  assert.ok(r.corps.problemes.some((p) => /capacite_id.*n’existe pas dans les règles/.test(p)), JSON.stringify(r.corps));
  assert.equal(db.prepare('SELECT count(*) AS n FROM personnage').get().n, avant);
});

test('création : un prétiré (à personne, visible de tous), sans statut ; inachevé, il est enregistré et ce qui lui manque signalé ; lu, listé, avec son niveau', () => {
  const r = appel('POST', '/api/personnages', { nom: 'Brune', surnom: '', lieu_origine: 'Valbrume', id: 'ignore', nature: 'joueur', visibilite: 'privee' });
  assert.equal(r.statut, 201, JSON.stringify(r.corps));
  const p = r.corps.personnage;
  assert.equal(r.entetes.Location, `/api/personnages/${p.id}/`);
  assert.match(p.id, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  assert.deepEqual({ nature: p.nature, proprietaire_id: p.proprietaire_id, visibilite: p.visibilite, nom: p.nom, surnom: p.surnom, lieu_origine: p.lieu_origine, mode_classe: p.mode_classe, xp: p.xp },
    { nature: 'pretire', proprietaire_id: null, visibilite: 'tous', nom: 'Brune', surnom: null, lieu_origine: 'Valbrume', mode_classe: 'mono', xp: 0 });
  assert.ok(!('statut' in p), 'plus de statut (migration 0038)');
  assert.match(p.cree_le, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/);
  assert.equal(p.modifie_le, p.cree_le);
  assert.match(p.version, /^[0-9a-f]{16}$/);
  for (const cle of Object.keys(PARTIES_DE_FICHE)) assert.deepEqual(p[cle], [], cle);
  assert.deepEqual(r.corps.niveau, { niveau_global: 1, niveau_classe_1: 2, niveau_classe_2: 0 });
  // toute fiche est contrôlée, même inachevée (avant la migration 0038, un brouillon échappait à ces règles) : ses manques sont signalés, elle est
  // enregistrée quand même ; race et magie innée sont deux contrôles (jusque-là une contrainte de la table, hors brouillon)
  const points = db.prepare('SELECT points_competences_cumul AS n FROM v_niveau WHERE niveau = 1').get().n;
  assert.deepEqual(r.corps.controles, [
    ...db.prepare('SELECT id FROM caracteristique ORDER BY id').all().map((c) => ({ regle: 'caracteristique_manquante', detail: c.id })),
    { regle: 'classe_1_manquante', detail: null },
    { regle: 'competences_total', detail: `0 / ${points}` },
    { regle: 'magie_innee_manquante', detail: null },
    { regle: 'race_manquante', detail: null },
  ]);

  assert.deepEqual(lire(p.id), r.corps, 'relue à l’identique');
  const liste = appel('GET', '/api/personnages/').corps.personnages;
  const resume = liste.find((f) => f.id === p.id);
  assert.deepEqual({ nom: resume.nom, niveau_global: resume.niveau_global, classes: resume.classes, anomalies: resume.anomalies, portrait: resume.portrait },
    { nom: 'Brune', niveau_global: 1, classes: [], anomalies: r.corps.controles.length, portrait: null });
  assert.ok(!('statut' in resume));
  assert.match(journal.at(-1), new RegExp(`création du prétiré ${p.id}`));
});

test('une fiche conforme n’enfreint aucune règle ; le résumé donne les noms des règles', () => {
  const r = appel('POST', '/api/personnages', ficheConforme('Cyrielle'));
  assert.equal(r.statut, 201, JSON.stringify(r.corps));
  assert.deepEqual(r.corps.controles, []);
  assert.equal(r.corps.personnage.caracteristiques.length, 6);
  assert.deepEqual(r.corps.personnage.classes, [{ rang: 1, classe_id: 'classes/guerrier', specialite_id: null }]);
  const resume = appel('GET', '/api/personnages').corps.personnages.find((f) => f.id === r.corps.personnage.id);
  assert.deepEqual({ race: resume.race, ethnie: resume.ethnie, magie_innee: resume.magie_innee, classes: resume.classes.map((c) => c.classe), anomalies: resume.anomalies },
    { race: 'Humain', ethnie: db.prepare("SELECT nom FROM ethnie WHERE id = 'races/humain#ethnie:humain-central'").get().nom, magie_innee: db.prepare("SELECT nom FROM magie WHERE id = 'magies/magie-du-feu'").get().nom, classes: ['Guerrier'], anomalies: 0 });
});

test('modification : avec la version lue ; colonne absente gardée, liste présente remplacée ; version ancienne ou absente refusée (409)', () => {
  const { personnage: p } = appel('POST', '/api/personnages', ficheConforme('Dorian')).corps;
  let r = appel('PUT', `/api/personnages/${p.id}`, { version: p.version, nom: 'Dorian le Juste', sorts: [], inventaire: [{ rang: 1, nom: 'Corde', quantite: 2, ressource_id: null }] });
  assert.equal(r.statut, 200, JSON.stringify(r.corps));
  const q = r.corps.personnage;
  assert.equal(q.nom, 'Dorian le Juste');
  assert.equal(q.race_id, 'races/humain', 'colonne absente : inchangée');
  assert.equal(q.caracteristiques.length, 6, 'liste absente : inchangée');
  assert.deepEqual(q.inventaire, [{ rang: 1, nom: 'Corde', quantite: 2, ressource_id: null }]);
  assert.notEqual(q.version, p.version);
  assert.ok(q.modifie_le >= p.cree_le);

  r = appel('PUT', `/api/personnages/${p.id}`, { version: p.version, nom: 'Écrasé' });
  assert.equal(r.statut, 409);
  assert.equal(r.corps.personnage.nom, 'Dorian le Juste', 'la réponse rend la fiche à jour');
  assert.equal(appel('PUT', `/api/personnages/${p.id}`, { nom: 'Sans version' }).statut, 409);
  assert.deepEqual(lire(p.id).personnage, q, 'rien écrit');

  r = appel('PUT', `/api/personnages/${encodeURIComponent(p.id)}/`, { version: q.version, inventaire: [] });
  assert.equal(r.statut, 200);
  assert.deepEqual(r.corps.personnage.inventaire, []);
});

test('refus d’écrire : bornes, types, références inconnues, champs inconnus ; rien n’est écrit', () => {
  const { personnage: p } = appel('POST', '/api/personnages', { nom: 'Erwan' }).corps;
  const refus = (corps, attendus) => {
    const r = appel('PUT', `/api/personnages/${p.id}`, { version: p.version, ...corps });
    assert.equal(r.statut, 400, JSON.stringify(r.corps));
    assert.equal(r.corps.erreur, 'La fiche n’a pas été enregistrée.');
    assert.deepEqual(r.corps.problemes, attendus);
  };
  refus({ caracteristiques: [{ caracteristique_id: 'force', base: 0, croix: 0 }] }, ['caracteristiques[0] : valeur hors des bornes (base >= 1)']);
  refus({ caracteristiques: [{ caracteristique_id: 'force', base: 2.5, croix: 0 }] }, ['caracteristiques[0] : « base » : un nombre entier est attendu']);
  refus({ xp: -1 }, ['valeur hors des bornes (xp >= 0)']);
  refus({ nom: '' }, ['« nom » est obligatoire']);
  refus({ nom: { x: 1 } }, ['nom : valeur refusée (texte, nombre, booléen ou null attendu)']);
  refus({ race_id: 'races/inconnue', classes: [{ rang: 1, classe_id: 'classes/inconnue' }] }, [
    '« race_id » : « races/inconnue » n’existe pas dans les règles (race)',
    'classes : « classe_id » = « classes/inconnue » n’existe pas dans les règles (classe)',
  ]);
  const autre = db.prepare("SELECT id FROM specialite WHERE classe_id <> 'classes/guerrier' ORDER BY id LIMIT 1").get().id;
  refus({ classes: [{ rang: 1, classe_id: 'classes/guerrier', specialite_id: autre }] }, [
    `classes : « specialite_id, classe_id » = « ${autre} / classes/guerrier » n’existe pas dans les règles (specialite)`,
  ]);
  refus({ sorts: [{ sort_id: 'x', rang: 1, niveau_maitrise: 0, personnage_id: 'autre' }], couleur: 'bleu', inventaire: {} }, [
    'sorts[0] : champ inconnu « personnage_id »', 'champ inconnu « couleur »', 'inventaire : une liste est attendue',
  ]);
  refus({ inventaire: Array.from({ length: LIGNES_MAX + 1 }, (_, i) => ({ rang: i + 1, nom: 'x', quantite: 1 })) }, [`inventaire : ${LIGNES_MAX + 1} lignes, au plus ${LIGNES_MAX}`]);
  refus({ inventaire: [{ rang: 1, nom: 'a', quantite: 1 }, { rang: 1, nom: 'b', quantite: 1 }] }, ['inventaire[1] : en double (rang)']);
  assert.deepEqual(lire(p.id).personnage, p, 'aucun refus n’a rien écrit');

  const r = appel('POST', '/api/personnages', { surnom: 'Sans nom' });
  assert.equal(r.statut, 400);
  assert.deepEqual(r.corps.problemes, ['« nom » est obligatoire']);
  assert.equal(appel('POST', '/api/personnages', [1, 2]).statut, 400);
});

test('gains de niveau en deux totaux (R73), entraînement (R71, en lignes depuis R104), durabilité d’une arme (R74) : enregistrés et relus tels quels, bornés ; une `progression` reçue (page d’avant la migration 0045) devient les deux totaux, vide elle est jetée, non vide avec les totaux refusée (409)', () => {
  const arme = db.prepare('SELECT a.id FROM arme a JOIN arme_famille f ON f.id = a.famille_id WHERE f.maitrisable = 1 ORDER BY a.id LIMIT 1').get().id;
  const r = appel('POST', '/api/personnages', {
    ...ficheConforme('Elouan'), gains_sante: 3, gains_chakra: 2, entrainement: 'Arc +5 % (entraîneur de Valbrume) ; livre de magie lu : Boule de feu',
    armes: [{ rang: 1, arme_id: arme, durabilite: 2 }, { rang: 2, arme_id: arme }],
  });
  assert.equal(r.statut, 201, JSON.stringify(r.corps));
  const p = r.corps.personnage;
  // (l'entraînement en texte d'une page d'avant la migration 0062 : une ligne de texte libre, décision R104)
  assert.deepEqual([p.gains_sante, p.gains_chakra, 'entrainement' in p], [3, 2, false]);
  assert.deepEqual(p.entrainements, [{ rang: 1, competence_id: null, valeur: null, texte: 'Arc +5 % (entraîneur de Valbrume) ; livre de magie lu : Boule de feu' }]);
  assert.deepEqual(p.armes.map((a) => [a.rang, a.durabilite]), [[1, 2], [2, null]], 'NULL : l’arme à son maximum');
  assert.deepEqual(r.corps.controles, [{ regle: 'gains_niveau', detail: '5 / 0' }], 'des gains au niveau 1 : signalés, enregistrés quand même');
  assert.equal('progression' in p, false);
  assert.deepEqual(lire(p.id), r.corps, 'relue à l’identique');

  // bornes : des totaux positifs, toujours écrits ; une durabilité positive
  const refus = (corps, motif) => {
    const avant = lire(p.id);
    const k = appel('PUT', `/api/personnages/${p.id}`, { version: avant.personnage.version, ...corps });
    assert.equal(k.statut, 400, JSON.stringify(k.corps));
    assert.ok(k.corps.problemes.some((x) => motif.test(x)), JSON.stringify(k.corps.problemes));
    assert.deepEqual(lire(p.id), avant, 'rien n’est écrit');
  };
  refus({ gains_sante: -1 }, /valeur hors des bornes/);
  refus({ gains_chakra: null }, /« gains_chakra » est obligatoire/);
  refus({ armes: [{ rang: 1, arme_id: arme, durabilite: -1 }] }, /^armes\[0\] : valeur hors des bornes/);

  // une page restée ouverte envoie encore la progression niveau par niveau : sa somme (« les deux » compte sur chacun), pas « champ inconnu »
  const progression = [
    { niveau: 2, points_sante: 10, points_chakra: 5, de_choix: null, de_resultat: null },
    { niveau: 5, points_sante: 0, points_chakra: 15, de_choix: 'les_deux', de_resultat: 3 },
  ];
  let m = appel('PUT', `/api/personnages/${p.id}`, { version: lire(p.id).personnage.version, progression });
  assert.equal(m.statut, 200, JSON.stringify(m.corps));
  assert.deepEqual([m.corps.personnage.gains_sante, m.corps.personnage.gains_chakra], [13, 23]);
  assert.equal('progression' in m.corps.personnage, false);
  // la même page, après cet enregistrement : elle a repris les deux totaux de la réponse, et sa fiche vide d'avant lui laisse une progression vide,
  // jetée sans rien dire
  m = appel('PUT', `/api/personnages/${p.id}`, { ...m.corps.personnage, progression: [], surnom: 'l’Ancien' });
  assert.equal(m.statut, 200, JSON.stringify(m.corps));
  assert.deepEqual([m.corps.personnage.gains_sante, m.corps.personnage.gains_chakra, m.corps.personnage.surnom], [13, 23, 'l’Ancien']);
  // puis le gain d'un niveau saisi dans son ancienne interface : une progression non vide AVEC les deux totaux ne se concilie pas avec eux (des gains
  // nouveaux, ou les anciens saisis de nouveau ?) : refus 409, rien n'est écrit, la page doit être rechargée (pas de `personnage` : ce n'est pas un
  // conflit de version, que la page proposerait de résoudre en rechargeant la fiche)
  const avant = lire(p.id);
  const niveau3 = [{ niveau: 3, points_sante: 15, points_chakra: 0, de_choix: null, de_resultat: null }];
  const { gains_sante: _gs, gains_chakra: _gc, ...sansTotaux } = m.corps.personnage;
  for (const totaux of [{ gains_sante: 13, gains_chakra: 23 }, { gains_sante: 13 }, { gains_chakra: 0 }]) {
    const k = appel('PUT', `/api/personnages/${p.id}`, { ...sansTotaux, ...totaux, progression: niveau3 });
    assert.deepEqual([k.statut, k.corps], [409, { erreur: PAGE_D_AVANT }], JSON.stringify(totaux));
    assert.deepEqual(lire(p.id), avant, 'rien n’est écrit');
  }
  assert.match(PAGE_D_AVANT, /version précédente du site.*rien n’a été enregistré.*Rechargez-la/);
  const fiches = appel('GET', '/api/personnages/').corps.personnages.length;
  const creation = appel('POST', '/api/personnages', { ...ficheConforme('Gaspard'), progression: niveau3 });
  assert.deepEqual([creation.statut, creation.corps], [409, { erreur: PAGE_D_AVANT }], 'une création aussi');
  assert.equal(appel('GET', '/api/personnages/').corps.personnages.length, fiches, 'aucune fiche créée');
  // une création par une page d'avant : sa fiche vide n'avait pas les deux totaux
  const { gains_sante: _s, gains_chakra: _c, ...davant } = ficheConforme('Fanny');
  const c = appel('POST', '/api/personnages', { ...davant, progression });
  assert.equal(c.statut, 201, JSON.stringify(c.corps));
  assert.deepEqual([c.corps.personnage.gains_sante, c.corps.personnage.gains_chakra], [13, 23]);
});

test('les contrôles signalent sans bloquer : une fiche qui enfreint des règles s’enregistre (plus de 422) ; un « statut » reçu (fichier exporté avant la migration 0038) est ignoré', () => {
  const { personnage: p } = appel('POST', '/api/personnages', { nom: 'Fanny', race_id: 'races/humain', magie_innee_id: 'magies/magie-du-feu' }).corps;
  // l'ancien passage en « valide », refusé (422) tant qu'une règle était enfreinte : la clé est ignorée, le reste du corps enregistré
  const r = appel('PUT', `/api/personnages/${p.id}`, { version: p.version, statut: 'valide', surnom: 'la Rousse' });
  assert.equal(r.statut, 200, JSON.stringify(r.corps));
  const regles = r.corps.controles.map((c) => c.regle);
  assert.ok(regles.includes('ethnie_manquante'), JSON.stringify(r.corps.controles));
  assert.ok(regles.includes('classe_1_manquante'));
  assert.ok(!regles.includes('race_manquante') && !regles.includes('magie_innee_manquante'), 'race et magie innée choisies');
  const relue = lire(p.id);
  assert.equal(relue.personnage.surnom, 'la Rousse');
  assert.ok(!('statut' in relue.personnage), 'la clé reçue n’est ni écrite ni rendue');
  assert.deepEqual(relue.controles, r.corps.controles, 'relue : les mêmes contrôles');

  const b = appel('PUT', `/api/personnages/${p.id}`, { version: r.corps.personnage.version, classes: [{ rang: 1, classe_id: 'classes/guerrier' }, { rang: 2, classe_id: 'classes/archimage' }] });
  assert.equal(b.statut, 200);
  assert.deepEqual(b.corps.controles.map((c) => c.regle).filter((x) => x.startsWith('classe')), ['classe_2_en_trop', 'classe_reservee'],
    'contrôles rendus (dont l’Archimage sans Potentiel Illimité, R23), fiche enregistrée');
  assert.deepEqual(lire(p.id).personnage.classes.map((c) => c.classe_id), ['classes/guerrier', 'classes/archimage']);

  // une fiche exportée avant, quel que soit son ancien statut, se crée comme les autres et reste listée (plus de fiches archivées à part)
  for (const statut of ['brouillon', 'valide', 'archive']) {
    const c = appel('POST', '/api/personnages', { ...ficheConforme(`Importée (${statut})`), statut });
    assert.equal(c.statut, 201, JSON.stringify(c.corps));
    assert.ok(!('statut' in c.corps.personnage), statut);
    assert.deepEqual(c.corps.controles, [], statut);
    assert.ok(appel('GET', '/api/personnages/').corps.personnages.some((f) => f.id === c.corps.personnage.id), statut);
  }
});

test('liste : plus de statut ; du portrait, l’empreinte de l’image et le style de son cadrage, jamais l’image ; null sans image lisible (le logo)', () => {
  const creer = (corps) => {
    const r = appel('POST', '/api/personnages', corps);
    assert.equal(r.statut, 201, JSON.stringify(r.corps));
    return r.corps.personnage;
  };
  const sans = creer({ nom: 'Iseult' });
  const centre = creer({ nom: 'Joris', portrait: IMAGES.webp });
  const cadre = creer({ nom: 'Kalia', portrait: IMAGES.webp, portrait_x: 0.8333, portrait_y: 0.25, portrait_zoom: 2 });
  const jpeg = creer({ nom: 'Lothaire', portrait: IMAGES.jpeg });
  // la base accepte toute data URL « data:image/… » (data/schema.sql) ; la liste n'en montre que ce que la page sait écrire et qui se décode
  const svg = creer({ nom: 'Maëlle', portrait: 'data:image/svg+xml;base64,PHN2Zz4=' });
  const tronquee = creer({ nom: 'Nils', portrait: 'data:image/png;base64,AAAAA' });
  const liste = appel('GET', '/api/personnages/').corps.personnages;
  for (const f of liste) assert.ok(!('statut' in f), f.nom);
  const portrait = (p) => liste.find((f) => f.id === p.id).portrait;
  assert.equal(portrait(sans), null);
  // l'image fait 3 × 2 pixels : sans cadrage, le carré du centre ; cadrée (zoom 2, à droite), son carré à elle (lib/portrait.mjs#styleDuCadrage)
  assert.deepEqual(portrait(centre), { empreinte: empreinte(IMAGES.webp), style: 'width:150%;height:100%;left:-25%;top:0%' });
  assert.deepEqual(portrait(cadre), { empreinte: empreinte(IMAGES.webp), style: 'width:300%;height:200%;left:-199.99%;top:0%' });
  assert.equal(portrait(jpeg).empreinte, empreinte(IMAGES.jpeg));
  assert.equal(portrait(svg), null, 'un SVG n’est pas un portrait');
  assert.equal(portrait(tronquee), null, 'une image qui ne se décode pas non plus');
  assert.ok(!JSON.stringify(liste).includes('base64'), 'la liste ne recopie aucune image');
});

test('GET /api/personnages/<id>/portrait/ : les octets de l’image, son type et son empreinte (ETag) ; 304 si le navigateur l’a déjà ; 404 sans portrait lisible', () => {
  const { personnage: p } = appel('POST', '/api/personnages', { nom: 'Octave', portrait: IMAGES.webp, portrait_x: 0.4, portrait_zoom: 1.5 }).corps;
  const adresse = `/api/personnages/${p.id}/portrait/`;
  let r = appel('GET', adresse, undefined, {});
  assert.equal(r.statut, 200, JSON.stringify(r.corps));
  assert.equal(r.corps, null, 'pas du JSON');
  assert.ok(Buffer.from(r.brut).equals(octetsDe(IMAGES.webp)), 'les octets exacts de l’image');
  const etiquette = `"${empreinte(IMAGES.webp)}"`;
  assert.deepEqual(r.entetes, { ETag: etiquette, 'Cache-Control': 'private, no-cache', 'Content-Type': 'image/webp' });
  const resume = appel('GET', '/api/personnages/').corps.personnages.find((f) => f.id === p.id);
  assert.equal(`"${resume.portrait.empreinte}"`, etiquette, 'l’empreinte de la liste est l’ETag de l’image');
  // l'adresse que la page /personnages/ en tire (lib/personnages-liste.mjs#adresseDuPortrait) mène à cette route, l'empreinte en paramètre
  const deLaPage = new URL(adresseDuPortrait('/api/', resume), 'http://site');
  assert.deepEqual([deLaPage.pathname, deLaPage.searchParams.get('v')], [adresse, resume.portrait.empreinte]);
  assert.ok(Buffer.from(appel('GET', deLaPage.pathname, undefined, {}).brut).equals(octetsDe(IMAGES.webp)), 'l’image, par l’adresse de la page');
  assert.ok(Buffer.from(appel('GET', adresse.slice(0, -1), undefined, {}).brut).equals(octetsDe(IMAGES.webp)), 'sans « / » final aussi');

  // le navigateur la redemande avec l'empreinte qu'il a (aussi en ETag faible, ou dans une liste) : 304, sans corps ; une autre empreinte : l'image
  for (const connue of [etiquette, `W/${etiquette}`, `"0123456789abcdef", ${etiquette}`]) {
    r = appel('GET', adresse, undefined, { 'if-none-match': connue });
    assert.equal(r.statut, 304, connue);
    assert.equal(r.brut.length, 0, connue);
    assert.deepEqual(r.entetes, { ETag: etiquette, 'Cache-Control': 'private, no-cache' }, connue);
  }
  assert.equal(appel('GET', adresse, undefined, { 'if-none-match': '"0123456789abcdef"' }).statut, 200);

  // l'image change : nouvelle empreinte, l'ancienne ne vaut plus 304 ; le type suit l'image
  for (const image of [IMAGES.png, IMAGES.jpeg]) {
    const avant = lire(p.id).personnage.version;
    assert.equal(appel('PUT', `/api/personnages/${p.id}`, { version: avant, portrait: image }).statut, 200);
    r = appel('GET', adresse, undefined, { 'if-none-match': etiquette });
    assert.equal(r.statut, 200);
    assert.ok(Buffer.from(r.brut).equals(octetsDe(image)));
    assert.deepEqual([r.entetes.ETag, r.entetes['Content-Type']], [`"${empreinte(image)}"`, `image/${image === IMAGES.png ? 'png' : 'jpeg'}`]);
  }

  // 404 : sans portrait, portrait qui n'en est pas un (un SVG n'est jamais servi), fiche inconnue, sans id (« /api/personnages/portrait/ » est la
  // fiche « portrait », inconnue) ; la fiche d'un joueur : test suivant
  const sans = appel('POST', '/api/personnages', { nom: 'Pernelle' }).corps.personnage;
  const svg = appel('POST', '/api/personnages', { nom: 'Quentin', portrait: 'data:image/svg+xml;base64,PHN2Zz4=' }).corps.personnage;
  for (const chemin_ of [`/api/personnages/${sans.id}/portrait/`, `/api/personnages/${svg.id}/portrait/`, '/api/personnages/fiche-inconnue/portrait/',
    '/api/personnages//portrait/', '/api/personnages/portrait/', '/api/personnages/%E0%A4%A/portrait/']) {
    assert.equal(appel('GET', chemin_, undefined, {}).statut, 404, chemin_);
  }
  // une autre adresse sous une fiche n'existe pas
  for (const chemin_ of [`/api/personnages/${p.id}/autre/`, `/api/personnages/${p.id}/portrait/x/`]) assert.equal(appel('GET', chemin_, undefined, {}).statut, 404, chemin_);
  // en lecture seule ; base indisponible : 503
  for (const methode of ['POST', 'PUT', 'DELETE']) {
    r = appel(methode, adresse, {});
    assert.deepEqual([r.statut, r.entetes.Allow], [405, 'GET'], methode);
  }
  assert.ok(lire(p.id).personnage.portrait, 'rien n’a été effacé');
  assert.equal(traiter({ methode: 'GET', chemin: adresse, entetes: {} }, { base: () => null, etat: () => ({}) }).statut, 503);
});

test('fiche de joueur : ni listée, ni lue (ni son portrait), ni modifiable sans comptes (avant la 1.0)', () => {
  db.exec("INSERT INTO utilisateur (id, nom_affichage, cree_le) VALUES ('alice', 'Alice', '2026-10-10T00:00:00Z')");
  db.prepare(`INSERT INTO personnage (id, nature, proprietaire_id, visibilite, nom, mode_classe, xp, alignement_loyal, alignement_chaotique, alignement_bon,
      alignement_mauvais, bourse_pp, bourse_ro, bourse_rf, ambidextrie, cree_le, modifie_le, portrait)
    VALUES ('fiche-alice', 'joueur', 'alice', 'privee', 'Secret', 'mono', 0, 0, 0, 0, 0, 0, 0, 0, 0, '2026-10-10T00:00:00Z', '2026-10-10T00:00:00Z', ?)`).run(IMAGES.webp);
  assert.ok(!appel('GET', '/api/personnages').corps.personnages.some((f) => f.id === 'fiche-alice'));
  assert.equal(appel('GET', '/api/personnages/fiche-alice').statut, 404);
  assert.equal(appel('GET', '/api/personnages/fiche-alice/portrait/').statut, 404, 'son portrait, une image lisible, n’est pas servi');
  assert.equal(appel('PUT', '/api/personnages/fiche-alice', { version: 'x', nom: 'Pris' }).statut, 404);
  assert.equal(appel('DELETE', '/api/personnages/fiche-alice', { version: 'x' }).statut, 404);
  assert.equal(db.prepare("SELECT nom FROM personnage WHERE id = 'fiche-alice'").get().nom, 'Secret');
});

test('suppression (demande du propriétaire) : avec la version lue, la fiche et toutes ses lignes disparaissent ; version ancienne refusée (409)', () => {
  const { personnage: p } = appel('POST', '/api/personnages', ficheConforme('À supprimer')).corps;
  const lignes = () => TABLES_VIVANTES.filter((t) => db.prepare(`PRAGMA table_info("${t}")`).all().some((c) => c.name === 'personnage_id') || t === 'personnage')
    .reduce((n, t) => n + db.prepare(`SELECT count(*) AS n FROM "${t}" WHERE ${t === 'personnage' ? 'id' : 'personnage_id'} = ?`).get(p.id).n, 0);
  assert.ok(lignes() > 1);
  assert.equal(appel('DELETE', `/api/personnages/${p.id}/`, { version: 'ancienne' }).statut, 409);
  assert.equal(appel('DELETE', `/api/personnages/${p.id}/`, { version: p.version }, { 'content-type': 'text/plain' }).statut, 415);
  assert.equal(appel('DELETE', `/api/personnages/${p.id}/`, { version: p.version }, { ...JSON_, 'sec-fetch-site': 'cross-site' }).statut, 403);
  assert.ok(lire(p.id).personnage, 'rien n’est supprimé par un refus');
  const r = appel('DELETE', `/api/personnages/${p.id}/`, { version: p.version });
  assert.deepEqual([r.statut, r.corps], [200, { supprime: p.id }]);
  assert.equal(lignes(), 0);
  assert.equal(appel('GET', `/api/personnages/${p.id}`).statut, 404);
  assert.ok(!appel('GET', '/api/personnages').corps.personnages.some((f) => f.id === p.id));
  assert.equal(appel('DELETE', `/api/personnages/${p.id}/`, { version: p.version }).statut, 404);
  assert.ok(journal.includes(`suppression du prétiré ${p.id}`));
});

test('routes, méthodes et garde des écritures : JSON exigé, requête d’un autre site refusée, base indisponible', () => {
  assert.equal(appel('GET', '/api/etat').corps.service, 'essai');
  assert.equal(appel('GET', '/api/inconnu').statut, 404);
  assert.equal(appel('GET', '/api/personnages/a/b').statut, 404);
  assert.equal(appel('GET', '/autre').statut, 404);
  assert.equal(appel('GET', '/api/personnages/%E0%A4%A').statut, 404);
  let r = appel('PATCH', '/api/personnages/x');
  assert.deepEqual([r.statut, r.entetes.Allow], [405, 'GET, PUT, DELETE']);
  r = appel('PUT', '/api/personnages', {});
  assert.deepEqual([r.statut, r.entetes.Allow], [405, 'GET, POST']);
  r = appel('DELETE', '/api/personnages', {});
  assert.deepEqual([r.statut, r.entetes.Allow], [405, 'GET, POST']);
  assert.equal(appel('POST', '/api/etat').statut, 405);
  assert.equal(appel('POST', '/api/personnages', { nom: 'x' }, { 'content-type': 'text/plain' }).statut, 415);
  assert.equal(appel('POST', '/api/personnages', { nom: 'x' }, {}).statut, 415);
  assert.equal(appel('POST', '/api/personnages', { nom: 'x' }, { 'content-type': 'application/x-www-form-urlencoded' }).statut, 415);
  for (const site of ['cross-site', 'same-site']) assert.equal(appel('POST', '/api/personnages', { nom: 'x' }, { ...JSON_, 'sec-fetch-site': site }).statut, 403);
  assert.equal(appel('POST', '/api/personnages', { nom: 'Gaël' }, { 'content-type': 'application/json; charset=utf-8', 'sec-fetch-site': 'same-origin' }).statut, 201);
  assert.equal(appel('POST', '/api/personnages', '{ pas du json').statut, 400);
  const sansBase = traiter({ methode: 'GET', chemin: '/api/personnages', entetes: {} }, { base: () => null, etat: () => ({ base: { disponible: false } }) });
  assert.equal(sansBase.statut, 503);
  assert.deepEqual(sansBase.corps.etat, { base: { disponible: false } });
});

test('guetteur : agit quand une nouvelle valeur est vue deux fois de suite, une seule fois', () => {
  const g = guetteur('a');
  assert.deepEqual(['a', 'b', 'c', 'c', 'c', 'a', 'a', 'a'].map(g), [false, false, false, true, false, false, true, false]);
});

test('serveur HTTP : état, création, corps trop gros ; surveillance : nouvelles règles, base remplacée, nouvelle version du service', async () => {
  const dossier = join(racine, 'instance-db');
  const regles = join(racine, 'regles.db');
  copyFileSync(REGLES, regles);
  const version = join(racine, 'version.json');
  writeFileSync(version, JSON.stringify({ version: '9.9.9', empreinte: 'abcdef0123456789' }));
  const lignes = [];
  let relance = 0;
  const s = await demarrerService({ regles, dossier, port: 0, intervalle: 40, fichierVersion: version, journal: (l) => lignes.push(l), relancer: () => { relance += 1; } });
  const attendre = async (condition, message) => {
    for (let i = 0; i < 200 && !condition(); i += 1) await new Promise((ok) => setTimeout(ok, 25));
    assert.ok(condition(), message);
  };
  try {
    let etat = await (await fetch(`${s.url}/api/etat`)).json();
    assert.deepEqual({ version: etat.version, code: etat.code, disponible: etat.base.disponible, a_jour: etat.base.a_jour, pretires: etat.base.pretires, schema: etat.base.schema },
      { version: '9.9.9', code: 'abcdef0123456789', disponible: true, a_jour: true, pretires: 0, schema: VERSION_DU_SCHEMA });
    // Hugo a un métier (lu dans les règles) que la livraison suivante supprimera
    const lues = new DatabaseSync(REGLES, { readOnly: true });
    const metier = { ...lues.prepare('SELECT id, nom FROM metier ORDER BY id LIMIT 1').get() };
    lues.close();
    const reponse = await fetch(`${s.url}/api/personnages`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nom: 'Hugo', metier_id: metier.id, portrait: IMAGES.jpeg }) });
    assert.equal(reponse.status, 201);
    assert.equal(reponse.headers.get('cache-control'), 'no-store');
    assert.match(reponse.headers.get('content-type'), /^application\/json/);
    const hugo = (await reponse.json()).personnage;
    // son portrait : des octets servis tels quels (`brut`), avec le type de l'image à la place de celui du JSON ; puis 304 sans corps
    let image = await fetch(`${s.url}/api/personnages/${hugo.id}/portrait/`);
    assert.deepEqual([image.status, image.headers.get('content-type'), image.headers.get('cache-control'), image.headers.get('x-content-type-options')],
      [200, 'image/jpeg', 'private, no-cache', 'nosniff']);
    assert.ok(Buffer.from(await image.arrayBuffer()).equals(octetsDe(IMAGES.jpeg)));
    const etiquette = image.headers.get('etag');
    assert.equal(etiquette, `"${empreinte(IMAGES.jpeg)}"`);
    image = await fetch(`${s.url}/api/personnages/${hugo.id}/portrait/`, { headers: { 'If-None-Match': etiquette } });
    assert.equal(image.status, 304);
    assert.equal((await image.arrayBuffer()).byteLength, 0);
    // un 304 n'a pas de corps : ni type (JSON) ni longueur, que le navigateur recopierait sur l'image gardée ; son ETag et son cache, si
    assert.deepEqual([image.headers.get('content-type'), image.headers.get('content-length'), image.headers.get('etag'), image.headers.get('cache-control')],
      [null, null, etiquette, 'private, no-cache']);
    const gros = await fetch(`${s.url}/api/personnages`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: 'x'.repeat(1024 * 1024 + 10) }).catch((e) => e);
    if (!(gros instanceof Error)) assert.equal(gros.status, 413);

    // Une livraison remplace la base des règles : la base vivante est refaite, Hugo reste ; son métier, supprimé, en est retiré avec une note (R42).
    const nouvelles = join(racine, 'regles-neuves.db');
    copyFileSync(REGLES, nouvelles);
    const m = new DatabaseSync(nouvelles, { enableForeignKeyConstraints: false });
    m.exec("UPDATE race SET nom = 'Humain bis' WHERE id = 'races/humain'");
    m.prepare('DELETE FROM metier WHERE id = ?').run(metier.id);
    m.close();
    renameSync(nouvelles, regles);
    await attendre(() => lignes.some((l) => l.startsWith('base vivante faite') && l.includes('archivée')), lignes.join('\n'));
    etat = s.etat();
    assert.equal(etat.base.a_jour, true, etat.base.erreur);
    const liste = await (await fetch(`${s.url}/api/personnages`)).json();
    assert.deepEqual(liste.personnages.map((f) => f.nom), ['Hugo']);
    assert.ok(lignes.some((l) => l.startsWith('fiches adaptées aux nouvelles règles : 1 (Hugo)')), lignes.join('\n'));
    const retrait = `le métier « ${metier.nom} »`;
    assert.deepEqual((await (await fetch(`${s.url}/api/etat`)).json()).base.retraits.fiches, [{ fiche: 'Hugo', retraits: [retrait] }]);
    const adapte = (await (await fetch(`${s.url}/api/personnages/${hugo.id}/`)).json()).personnage;
    assert.equal(adapte.metier_id, null);
    assert.equal(adapte.notes, `[${jourDuRetrait(adapte.modifie_le)}] Retrait (règles modifiées) : ${retrait} n’existe plus dans les règles. Choisissez autre chose ou adaptez la fiche à la nouvelle règle.`);

    // L'installateur du serveur de test remplace la base vivante par une copie de la production : le service la rouvre.
    const production = join(racine, 'production.db');
    copyFileSync(join(dossier, 'vivante.db'), production);
    const p = new DatabaseSync(production);
    p.prepare('UPDATE personnage SET nom = ? WHERE id = ?').run('Hugo (production)', hugo.id);
    p.close();
    renameSync(production, join(dossier, 'vivante.db'));
    await attendre(() => lignes.some((l) => l === 'base vivante remplacée : réouverture'), lignes.join('\n'));
    const relu = await (await fetch(`${s.url}/api/personnages/${hugo.id}`)).json();
    assert.equal(relu.personnage.nom, 'Hugo (production)');

    // Nouvelle version du service livrée : arrêt, puis relance (Docker).
    writeFileSync(version, JSON.stringify({ version: '9.9.10', empreinte: 'fedcba9876543210' }));
    await attendre(() => relance === 1, 'relance demandée');
    assert.ok(lignes.includes('nouvelle version du service livrée : arrêt pour relance'));
    await assert.rejects(fetch(`${s.url}/api/etat`), 'serveur arrêté');
  } finally {
    await s.arreter();
  }
});

test('repli sur une base vivante d’avant la migration 0038 (sa reconstruction a échoué, docs/serveur.md) : le statut, encore là et obligatoire, reçoit sa valeur de départ ; la fiche se crée, se lit, se liste et se modifie', () => {
  // les règles d'aujourd'hui, la table des fiches telle qu'avant 0038 (colonne et contrainte de data/schema.sql d'alors)
  const schema = readFileSync(new URL('../../data/schema.sql', import.meta.url), 'utf8');
  const debut = schema.indexOf('CREATE TABLE personnage (');
  const fin = schema.indexOf(') STRICT;', debut);
  const nom = '\n  nom                   TEXT    NOT NULL CHECK (length(nom) > 0),';
  const table = schema.slice(debut, fin);
  assert.equal(table.split(nom).length, 2, 'la colonne nom de personnage, une fois');
  const ancienne = table
    .replace(nom, `\n  statut                TEXT    NOT NULL CHECK (statut IN ('brouillon', 'valide', 'archive')),${nom}`)
    .replace('  CHECK (magie_acquise_id IS NULL OR magie_acquise_id <> magie_innee_id)\n',
      "  CHECK (magie_acquise_id IS NULL OR magie_acquise_id <> magie_innee_id),\n  CHECK (statut = 'brouillon' OR (race_id IS NOT NULL AND magie_innee_id IS NOT NULL))\n");
  assert.notEqual(ancienne, table);
  const ancien = schema.slice(0, debut) + ancienne + schema.slice(fin);
  const base = new DatabaseSync(':memory:');
  try {
    base.exec(ancien);
    const colonne = base.prepare("SELECT \"notnull\" AS obligatoire, dflt_value AS defaut FROM pragma_table_info('personnage') WHERE name = 'statut'").get();
    assert.deepEqual({ ...colonne }, { obligatoire: 1, defaut: null }, 'la colonne d’avant : obligatoire, sans valeur par défaut');
    const cree = enregistrerFiche(base, { nom: 'Repli' });
    assert.equal(cree.personnage.statut, 'brouillon', 'sa valeur de départ d’avant 0038');
    assert.ok(cree.controles.some((c) => c.regle === 'race_manquante'), 'les contrôles d’aujourd’hui');
    assert.deepEqual(listerFiches(base).map((f) => f.nom), ['Repli']);
    const modifiee = enregistrerFiche(base, { version: cree.personnage.version, surnom: 'de secours' }, { id: cree.personnage.id });
    assert.deepEqual([modifiee.personnage.surnom, lireFiche(base, cree.personnage.id).statut], ['de secours', 'brouillon']);
  } finally {
    base.close();
  }
});

test('une page d’avant la migration 0055 envoie une armure par emplacement (`armures`) : l’armure de la fiche, les autres pièces notées (R95) ; avec les nouvelles clés, refus 409', () => {
  const [a, b] = db.prepare("SELECT id, nom FROM armure WHERE sorte = 'combinaison' ORDER BY ordre LIMIT 2").all().map((x) => ({ ...x }));
  const casque = db.prepare("SELECT nom FROM armure_emplacement WHERE id = 'casque'").get().nom;
  // la fiche vide d'une page d'avant n'a pas les nouvelles clés de l'armure
  const { armure_parties: _parties, ...davant } = ficheConforme('Ancienne armure');
  const c = appel('POST', '/api/personnages', { ...davant, armures: [
    { emplacement_id: 'casque', armure_id: b.id }, { emplacement_id: 'armure-complete', armure_id: a.id },
  ] });
  assert.equal(c.statut, 201, JSON.stringify(c.corps));
  const p = c.corps.personnage;
  assert.deepEqual([p.armure_id, p.armure_amelioration_id, 'armures' in p], [a.id, null, false]);
  assert.match(p.notes, new RegExp(`^\\[\\d{2}/\\d{2}/\\d{4}\\] Retrait \\(règles modifiées\\) : la pièce d’armure « ${b.nom.replace(/[/()]/g, '\\$&')} » \\(${casque}\\) n’est plus portée`));
  // un envoi partiel (sans `notes`) : la ligne s'ajoute aux notes enregistrées, qui ne sont pas effacées
  const partiel = appel('PUT', `/api/personnages/${p.id}`, { version: p.version, armures: [{ emplacement_id: 'armure-complete', armure_id: a.id }, { emplacement_id: 'torse', armure_id: b.id }] });
  assert.equal(partiel.statut, 200, JSON.stringify(partiel.corps));
  const lignes = partiel.corps.personnage.notes.split('\n');
  assert.deepEqual([lignes.length, lignes[0], /\(Torse\) n’est plus portée/.test(lignes[1])], [2, p.notes, true]);
  const avant = lire(p.id);
  const k = appel('PUT', `/api/personnages/${p.id}`, { ...avant.personnage, armures: [{ emplacement_id: 'torse', armure_id: b.id }] });
  assert.deepEqual([k.statut, k.corps], [409, { erreur: PAGE_D_AVANT }]);
  assert.deepEqual(lire(p.id), avant, 'rien n’est écrit');
  assert.match(PAGE_D_AVANT, /l’armure est une seule armure complète/);
});

test('une page d’avant la migration 0060 envoie des matériaux de bouclier et des accessoires d’avant : la matière du bouclier, les accessoires gardés, le reste noté (R96, R97) ; avec les nouvelles clés du bouclier, refus 409', () => {
  const [m1, m2] = db.prepare('SELECT m.ressource_id AS id, r.nom FROM materiau_bouclier m JOIN ressource r ON r.id = m.ressource_id ORDER BY m.ordre LIMIT 2').all().map((x) => ({ ...x }));
  const effet = db.prepare("SELECT id, libelle FROM accessoire_effet WHERE propriete_id = 'attributs' AND bonus_min IS NULL AND malediction = 0 AND libelle IS NOT NULL ORDER BY id LIMIT 1").get();
  // la fiche vide d'une page d'avant n'a pas les nouvelles clés du bouclier
  const { bouclier_materiau_id: _m, bouclier_amelioration_id: _a, bouclier_solidite: _s, ...davant } = ficheConforme('Ancien bouclier');
  const c = appel('POST', '/api/personnages', {
    ...davant, bouclier_classe_id: 'targe',
    bouclier_materiaux: [{ rang: 1, materiau_id: m1.id, quantite: 1 }, { rang: 2, materiau_id: m2.id, quantite: 1 }],
    accessoires: [
      { emplacement: 'chef', nom: 'Couronne', accessoire_effet_id: effet.id, texte: null, valeur: null, maudit: 0 },
      { emplacement: 'ceinture', nom: null, accessoire_effet_id: effet.id, texte: null, valeur: null, maudit: 0 },
      { emplacement: 'collier', nom: null, accessoire_effet_id: null, texte: 'Brille la nuit', valeur: null, maudit: 0 },
    ],
  });
  assert.equal(c.statut, 201, JSON.stringify(c.corps));
  const p = c.corps.personnage;
  assert.deepEqual([p.bouclier_classe_id, p.bouclier_materiau_id, 'bouclier_materiaux' in p], ['targe', m1.id, false]);
  assert.deepEqual(p.accessoires.map((a) => [a.emplacement, a.accessoire_effet_id, 'nom' in a]), [['chef', effet.id, false]]);
  const notes = p.notes.split('\n');
  assert.equal(notes.length, 4, p.notes);
  assert.ok(notes.every((l) => /^\[\d{2}\/\d{2}\/\d{4}\] Retrait \(règles modifiées\) : /.test(l)), p.notes);
  assert.ok(notes.some((l) => l.includes(`« ${m2.nom} »`) && l.includes(`« ${m1.nom} »`)), 'le matériau qui n’est plus dans le bouclier, et sa matière');
  assert.ok(notes.some((l) => l.includes('« Couronne »')), 'le nom perdu');
  assert.ok(notes.some((l) => l.includes('Ceinture')), 'l’accessoire de la Ceinture');
  assert.ok(notes.some((l) => l.includes('Brille la nuit')), 'l’effet hors table seul');
  const avant = lire(p.id);
  const k = appel('PUT', `/api/personnages/${p.id}`, { ...avant.personnage, bouclier_materiaux: [{ rang: 1, materiau_id: m2.id, quantite: 1 }] });
  assert.deepEqual([k.statut, k.corps], [409, { erreur: PAGE_D_AVANT }]);
  assert.deepEqual(lire(p.id), avant, 'rien n’est écrit');
  assert.match(PAGE_D_AVANT, /le bouclier a une forme et une matière/);
});

test('repli sur une base vivante d’avant la migration 0060 (sa reconstruction a échoué) : le bouclier vide et les accessoires d’aujourd’hui s’enregistrent ; une matière, absente de la base, est refusée ; les matériaux d’avant restent', () => {
  const { chemin: avant } = preparerBaseVivante({ regles: REGLES, dossier: join(racine, 'db-avant-0060') });
  const ancienne = new DatabaseSync(avant);
  // les tables d'avant 0060 : trois matériaux de bouclier, huit emplacements d'accessoire avec un nom et un effet hors table ; la vue des contrôles
  // d'aujourd'hui lit les nouvelles colonnes du bouclier : une vue vide la remplace (ce test ne porte pas sur les contrôles)
  ancienne.exec(`DROP VIEW v_personnage_controle;
    ALTER TABLE personnage DROP COLUMN bouclier_materiau_id;
    ALTER TABLE personnage DROP COLUMN bouclier_amelioration_id;
    ALTER TABLE personnage DROP COLUMN bouclier_solidite;
    CREATE TABLE personnage_bouclier_materiau (
      personnage_id TEXT NOT NULL REFERENCES personnage(id) ON DELETE CASCADE, rang INTEGER NOT NULL CHECK (rang BETWEEN 1 AND 3),
      materiau_id TEXT NOT NULL REFERENCES materiau_bouclier(ressource_id), quantite INTEGER NOT NULL CHECK (quantite >= 1),
      PRIMARY KEY (personnage_id, rang)
    ) STRICT, WITHOUT ROWID;
    DROP TABLE personnage_accessoire;
    CREATE TABLE personnage_accessoire (
      personnage_id TEXT NOT NULL REFERENCES personnage(id) ON DELETE CASCADE,
      emplacement TEXT NOT NULL CHECK (emplacement IN ('chef', 'collier', 'bracelet-1', 'bracelet-2', 'bague-1', 'bague-2', 'ceinture', 'autre')),
      nom TEXT, accessoire_effet_id TEXT REFERENCES accessoire_effet(id), texte TEXT, valeur INTEGER, maudit INTEGER NOT NULL DEFAULT 0 CHECK (maudit IN (0, 1)),
      competence_id TEXT REFERENCES competence(id), arme_famille_id TEXT REFERENCES arme_famille(id),
      PRIMARY KEY (personnage_id, emplacement)
    ) STRICT, WITHOUT ROWID;
    CREATE VIEW v_personnage_controle AS SELECT id AS personnage_id, NULL AS regle, NULL AS detail FROM personnage WHERE 0;`);
  ancienne.close();
  const base = ouvrirBaseVivante(avant);
  try {
    const effet = base.prepare("SELECT id FROM accessoire_effet WHERE propriete_id = 'attributs' AND bonus_min IS NULL AND malediction = 0 AND libelle IS NOT NULL ORDER BY id LIMIT 1").get().id;
    // ce qu'envoie la page à jour : les clés du bouclier vides (ficheVide n'en a pas, la page pose la solidité) et les accessoires d'aujourd'hui
    const cree = enregistrerFiche(base, {
      ...ficheConforme('Repli 0060'), bouclier_classe_id: 'targe', bouclier_materiau_id: null, bouclier_amelioration_id: null, bouclier_solidite: null,
      accessoires: [{ emplacement: 'chef', accessoire_effet_id: effet, valeur: null, maudit: 0, competence_id: null, arme_famille_id: null }],
    });
    const p = cree.personnage;
    assert.ok(!('bouclier_materiau_id' in p) && !('bouclier_solidite' in p), 'colonnes absentes de la base : ni écrites ni rendues');
    assert.deepEqual(p.accessoires.map((a) => [a.emplacement, a.accessoire_effet_id]), [['chef', effet]]);
    // les matériaux que cette base garde encore (sa table d'avant 0060) survivent à un enregistrement : le service n'écrit pas une table qu'il ne connaît plus
    const m = base.prepare('SELECT ressource_id FROM materiau_bouclier ORDER BY ordre LIMIT 1').get().ressource_id;
    base.prepare('INSERT INTO personnage_bouclier_materiau VALUES (?, 1, ?, 1)').run(p.id, m);
    const lue = lireFiche(base, p.id);
    assert.equal(enregistrerFiche(base, { ...lue, surnom: 'de secours', bouclier_solidite: null }, { id: p.id }).personnage.surnom, 'de secours');
    assert.equal(base.prepare('SELECT count(*) AS n FROM personnage_bouclier_materiau WHERE personnage_id = ?').get(p.id).n, 1);
    // une matière porte quelque chose que la base perdrait : « champ inconnu », rien n'est écrit
    const avantEnvoi = lireFiche(base, p.id);
    assert.throws(() => enregistrerFiche(base, { version: avantEnvoi.version, bouclier_materiau_id: m }, { id: p.id }), (e) => {
      assert.deepEqual([e.statut, e.details.problemes], [400, ['champ inconnu « bouclier_materiau_id »']]);
      return true;
    });
    assert.deepEqual(lireFiche(base, p.id), avantEnvoi, 'rien n’est écrit');
  } finally {
    base.close();
  }
});

test('colonnes ajoutées par les migrations 0045, 0055, 0060, 0061 et 0066 (DEPART_DES_COLONNES_AJOUTEES) : dans les tables d’aujourd’hui, leur valeur de départ est leur défaut du schéma et celle d’une fiche vide', () => {
  assert.deepEqual(DEPART_DES_COLONNES_AJOUTEES, {
    personnage: {
      gains_sante: 0, gains_chakra: 0,
      armure_id: null, armure_amelioration_id: null, armure_elementaire_id: null, armure_amelioration_elementaire_id: null,
      bouclier_materiau_id: null, bouclier_amelioration_id: null, bouclier_solidite: null,
      symbiose_magie_id: null,
      nm_mj: 0,
    },
    personnage_arme: { durabilite: null },
  });
  for (const [table, departs] of Object.entries(DEPART_DES_COLONNES_AJOUTEES)) {
    const colonnes = new Map(db.prepare(`PRAGMA table_info("${table}")`).all().map((c) => [c.name, c.dflt_value]));
    for (const [colonne, depart] of Object.entries(departs)) {
      assert.ok(colonnes.has(colonne), `${table}.${colonne}`);
      assert.equal(colonnes.get(colonne), depart === null ? null : String(depart), `${table}.${colonne} : défaut du schéma`);
      if (table === 'personnage') assert.equal(ficheVide()[colonne] ?? null, depart, `${colonne} : fiche vide`);
    }
  }
});

test('repli sur une base vivante d’avant la migration 0055 (sa reconstruction a échoué) : sans la table de la solidité des parties, la fiche se lit avec une liste vide, s’enregistre avec une liste vide, et une liste non vide est refusée', () => {
  // la base vivante d'aujourd'hui, ramenée à ses tables d'avant 0055 : une armure par emplacement, pas de solidité des parties
  const { chemin: avant } = preparerBaseVivante({ regles: REGLES, dossier: join(racine, 'db-avant-0055') });
  const ancienne = new DatabaseSync(avant);
  // la vue des contrôles d'avant ne lisait pas la table de la solidité des parties (règle armure_partie_hors_armure, migration 0055)
  const vue = ancienne.prepare("SELECT sql FROM sqlite_master WHERE name = 'v_personnage_controle'").get().sql;
  const vueDAvant = vue.replace(/\n  UNION ALL\n  SELECT ap\.personnage_id, 'armure_partie_hors_armure'[\s\S]*?\(ap\.emplacement_id = 'armure-complete'\)/, '');
  assert.notEqual(vueDAvant, vue);
  ancienne.exec(`DROP VIEW v_personnage_controle; DROP TABLE personnage_armure_partie; ${vueDAvant};
    CREATE TABLE personnage_armure (
      personnage_id TEXT NOT NULL REFERENCES personnage(id) ON DELETE CASCADE, emplacement_id TEXT NOT NULL REFERENCES armure_emplacement(id),
      armure_id TEXT NOT NULL REFERENCES armure(id), amelioration_id TEXT REFERENCES amelioration_equipement(id),
      armure_elementaire_id TEXT REFERENCES armure_elementaire(id), amelioration_elementaire_id TEXT REFERENCES amelioration_equipement(id),
      PRIMARY KEY (personnage_id, emplacement_id)
    ) STRICT, WITHOUT ROWID;`);
  ancienne.close();
  const base = ouvrirBaseVivante(avant);
  try {
    const cree = enregistrerFiche(base, { ...ficheConforme('Repli 0055'), armure_parties: [] });
    assert.deepEqual(cree.personnage.armure_parties, [], 'lue vide');
    const lue = lireFiche(base, cree.personnage.id);
    assert.deepEqual(lue.armure_parties, []);
    // la pièce d'armure que cette base garde encore (sa table d'avant 0055) survit à un enregistrement : le service n'écrit pas une table qu'il ne connaît plus
    const armure = base.prepare('SELECT id FROM armure ORDER BY ordre LIMIT 1').get().id;
    base.prepare("INSERT INTO personnage_armure (personnage_id, emplacement_id, armure_id) VALUES (?, 'torse', ?)").run(lue.id, armure);
    assert.equal(enregistrerFiche(base, { ...lue, surnom: 'de secours' }, { id: lue.id }).personnage.surnom, 'de secours');
    assert.deepEqual({ ...base.prepare('SELECT emplacement_id, armure_id FROM personnage_armure WHERE personnage_id = ?').get(lue.id) }, { emplacement_id: 'torse', armure_id: armure });
    const avantEnvoi = lireFiche(base, lue.id);
    assert.throws(() => enregistrerFiche(base, { version: avantEnvoi.version, armure_parties: [{ emplacement_id: 'torse', solidite: 1 }] }, { id: lue.id }), (e) => {
      assert.deepEqual([e.statut, e.details.problemes], [400, ['armure_parties : pas encore dans cette base, ses lignes seraient perdues']]);
      return true;
    });
    assert.deepEqual(lireFiche(base, lue.id), avantEnvoi, 'rien n’est écrit');
  } finally {
    base.close();
  }
});

test('repli sur une base vivante d’avant la migration 0045 (sa reconstruction a échoué, docs/serveur.md) : gains et durabilité, absents de la base, sont ignorés tant qu’ils ne portent rien, refusés sinon ; la fiche se crée, se lit, se liste et se modifie, ses gains niveau par niveau intacts', () => {
  // les règles d'aujourd'hui, les tables des fiches telles qu'avant 0045 (comme AVANT_0045 de test/serveur-base-vivante.test.mjs), la vue des
  // contrôles d'aujourd'hui lisant les gains dans personnage_progression
  const regles = join(racine, 'regles-avant-0045.db');
  copyFileSync(REGLES, regles);
  const r = new DatabaseSync(regles, { enableForeignKeyConstraints: false });
  try {
    const vue = r.prepare("SELECT sql FROM sqlite_master WHERE type = 'view' AND name = 'v_personnage_controle'").get().sql;
    const totaux = 'p.gains_sante + p.gains_chakra';
    assert.equal(vue.split(totaux).length, 3, 'la règle gains_niveau lit les deux totaux, deux fois');
    r.exec(`DROP VIEW v_personnage_controle;
      ALTER TABLE personnage DROP COLUMN gains_sante;
      ALTER TABLE personnage DROP COLUMN gains_chakra;
      ALTER TABLE personnage_arme DROP COLUMN durabilite;
      CREATE TABLE personnage_progression (
        personnage_id  TEXT    NOT NULL REFERENCES personnage(id) ON DELETE CASCADE,
        niveau         INTEGER NOT NULL REFERENCES niveau_global(niveau) CHECK (niveau >= 2),
        points_sante   INTEGER NOT NULL CHECK (points_sante >= 0),
        points_chakra  INTEGER NOT NULL CHECK (points_chakra >= 0),
        de_choix       TEXT    CHECK (de_choix IN ('sante', 'chakra', 'les_deux')),
        de_resultat    INTEGER CHECK (de_resultat >= 1),
        PRIMARY KEY (personnage_id, niveau),
        CHECK ((de_choix IS NULL) = (de_resultat IS NULL))
      ) STRICT, WITHOUT ROWID;
      ${vue.replaceAll(totaux, '(SELECT coalesce(sum(g.points_sante + g.points_chakra), 0) FROM personnage_progression g WHERE g.personnage_id = p.id)')};`);
  } finally {
    r.close();
  }
  const base = ouvrirBaseVivante(preparerBaseVivante({ regles, dossier: join(racine, 'db-avant-0045') }).chemin);
  try {
    const arme = base.prepare('SELECT a.id FROM arme a JOIN arme_famille f ON f.id = a.famille_id WHERE f.maitrisable = 1 ORDER BY a.id LIMIT 1').get().id;
    // ce qu'envoie la page à jour : une fiche vide (gains à 0), l'entraînement vidé, une arme à son maximum (durabilité NULL)
    const cree = enregistrerFiche(base, { ...ficheConforme('Repli'), entrainement: '', armes: [{ rang: 1, arme_id: arme, durabilite: null }] });
    const p = cree.personnage;
    assert.ok(!('gains_sante' in p) && !('gains_chakra' in p) && !('entrainement' in p), 'colonnes absentes de la base : ni écrites ni rendues');
    assert.deepEqual(p.armes.map((a) => [a.rang, a.arme_id, 'durabilite' in a]), [[1, arme, false]]);
    assert.deepEqual(cree.controles, [], 'les contrôles de la base');
    assert.deepEqual(listerFiches(base).map((f) => f.nom), ['Repli']);
    // ses gains niveau par niveau, tels que le service d'avant les a écrits
    base.prepare('INSERT INTO personnage_progression VALUES (?, 2, 10, 5, NULL, NULL)').run(p.id);

    // la page relit la fiche (sans gains : la base n'a pas les deux totaux) et l'enregistre telle qu'elle la tient : ficheVide, puis la fiche lue
    const lue = lireFiche(base, p.id);
    assert.ok(!('progression' in lue) && !('gains_sante' in lue));
    const page = { ...ficheVide(''), ...lue, surnom: 'de secours' };
    for (const c of COLONNES_DU_SERVICE) delete page[c];
    const modifiee = enregistrerFiche(base, page, { id: p.id });
    assert.equal(modifiee.personnage.surnom, 'de secours');
    assert.deepEqual(base.prepare('SELECT niveau, points_sante, points_chakra FROM personnage_progression WHERE personnage_id = ?').all(p.id).map((l) => ({ ...l })),
      [{ niveau: 2, points_sante: 10, points_chakra: 5 }], 'intacts : la reconstruction suivante les convertira (TABLES_RETIREES)');

    // ce qui porte quelque chose serait perdu : « champ inconnu », rien n'est écrit
    for (const [envoi, probleme] of [
      [{ gains_sante: 3 }, 'champ inconnu « gains_sante »'],
      [{ gains_chakra: 1 }, 'champ inconnu « gains_chakra »'],
      [{ armes: [{ rang: 1, arme_id: arme, durabilite: 2 }] }, 'armes[0] : champ inconnu « durabilite »'],
    ]) {
      const avant = lireFiche(base, p.id);
      assert.throws(() => enregistrerFiche(base, { version: avant.version, ...envoi }, { id: p.id }), (e) => {
        assert.deepEqual([e.statut, e.details.problemes], [400, [probleme]], JSON.stringify(envoi));
        return true;
      });
      assert.deepEqual(lireFiche(base, p.id), avant, 'rien n’est écrit');
    }
  } finally {
    base.close();
  }
});

test('entraînement en lignes et choix d’acquis (décision R104, migration 0062) : enregistrés et relus tels quels ; une page d’avant — texte d’entraînement, acquis saisi — convertie, ce qu’elle perd noté ; texte et lignes ensemble : 409', () => {
  const entrainements = [
    { rang: 1, competence_id: 'arc', valeur: 10, texte: null }, { rang: 2, competence_id: null, valeur: null, texte: 'Béni par la Dame du lac' },
    { rang: 3, competence_id: 'calme', valeur: 0, texte: null },
  ];
  const acquis_choix = [
    { source: 'races/humain#don:humain-central', rang: 1, competence_id: 'arc', valeur: 6 },
    { source: 'races/humain#don:humain-central', rang: 1, competence_id: 'calme', valeur: 4 },
  ];
  const r = appel('POST', '/api/personnages', { ...ficheConforme('Ysaline'), entrainements, acquis_choix });
  assert.equal(r.statut, 201, JSON.stringify(r.corps));
  const p = r.corps.personnage;
  assert.deepEqual([p.entrainements, p.acquis_choix], [entrainements, acquis_choix]);
  assert.ok(p.competences.every((c) => !('acquis' in c)), 'plus d’acquis saisi');
  assert.deepEqual(r.corps.controles, []);
  assert.deepEqual(lire(p.id), r.corps, 'relue à l’identique');
  // bornes : 10 points au plus (une règle de la vue, signalée sans bloquer) ; une compétence deux fois, une ligne vide : refusées
  let m = appel('PUT', `/api/personnages/${p.id}`, { version: lire(p.id).personnage.version, entrainements: [{ rang: 1, competence_id: 'arc', valeur: 11, texte: null }] });
  assert.equal(m.statut, 200, JSON.stringify(m.corps));
  assert.deepEqual(m.corps.controles, [{ regle: 'entrainement_valeur', detail: 'arc = 11' }]);
  for (const [lignes, motif] of [
    [[{ rang: 1, competence_id: 'arc', valeur: 1, texte: null }, { rang: 2, competence_id: 'arc', valeur: 2, texte: null }], /^entrainements\[1\] : en double \(competence_id\)$/],
    [[{ rang: 1, competence_id: null, valeur: null, texte: ' ' }], /^entrainements\[0\] : valeur hors des bornes/],
  ]) {
    const avant = lire(p.id);
    const k = appel('PUT', `/api/personnages/${p.id}`, { version: avant.personnage.version, entrainements: lignes });
    assert.equal(k.statut, 400, JSON.stringify(k.corps));
    assert.ok(k.corps.problemes.some((x) => motif.test(x)), JSON.stringify(k.corps.problemes));
    assert.deepEqual(lire(p.id), avant, 'rien n’est écrit');
  }

  // une page d'avant : le texte libre de l'entraînement devient des lignes de texte, l'acquis saisi n'est plus repris et la fiche le note, daté
  const { entrainements: _e, acquis_choix: _a, ...sansLignes } = lire(p.id).personnage;
  m = appel('PUT', `/api/personnages/${p.id}`, {
    ...sansLignes, entrainement: 'Arc +5 % (entraîneur de Valbrume)\nLivre lu : Boule de feu',
    competences: sansLignes.competences.map((c) => ({ ...c, acquis: c.competence_id === 'arc' ? 7 : 0 })),
  });
  assert.equal(m.statut, 200, JSON.stringify(m.corps));
  const q = m.corps.personnage;
  assert.deepEqual(q.entrainements.map((l) => l.texte), ['Arc +5 % (entraîneur de Valbrume)', 'Livre lu : Boule de feu']);
  assert.ok(q.competences.every((c) => !('acquis' in c)));
  assert.equal(q.notes, `[${jourDuRetrait(q.modifie_le)}] Retrait (règles modifiées) : l’acquis saisi en Arc (7) n’est plus saisi : l’Acquis se calcule (entraînement, dons, métier, accessoires). Notez l’entraînement dans ses lignes.`);
  assert.deepEqual(q.acquis_choix, acquis_choix, 'un envoi sans la liste ne la touche pas');
  // les deux formes à la fois (une page d'avant qui a repris les lignes d'une réponse) : rien ne les concilie
  const avant = lire(p.id);
  const k = appel('PUT', `/api/personnages/${p.id}`, { ...avant.personnage, entrainement: 'Arc +5 %' });
  assert.deepEqual([k.statut, k.corps], [409, { erreur: PAGE_D_AVANT }]);
  assert.deepEqual(lire(p.id), avant, 'rien n’est écrit');
  assert.match(PAGE_D_AVANT, /l’entraînement se note en lignes et l’acquis se calcule/);
});

test('NM du MJ (décision R118, migration 0066) : enregistrés pour la fiche et relus ; une page d’avant qui les note sort par sort donne leur somme ; les deux à la fois : 409', () => {
  const bdf = 'magies/magie-du-feu#sort:boule-de-feu';
  const cau = 'magies/magie-du-feu#sort:cauterisation';
  const r = appel('POST', '/api/personnages', { ...ficheConforme('Ombeline'), nm_mj: 2, sorts: [{ sort_id: bdf, rang: 1, niveau_maitrise: 2, nm_livre: 1 }] });
  assert.equal(r.statut, 201, JSON.stringify(r.corps));
  const p = r.corps.personnage;
  assert.deepEqual([p.nm_mj, p.sorts], [2, [{ sort_id: bdf, rang: 1, niveau_maitrise: 2, nm_livre: 1 }]]);
  assert.deepEqual(r.corps.controles, [], 'niveau 1 : le NM compté vient du MJ, celui du livre ne compte pas');
  // une page d'avant : les NM du MJ de chaque sort (nm_cadeau), sans nm_mj
  const { nm_mj: _n, ...sansNmMj } = lire(p.id).personnage;
  let m = appel('PUT', `/api/personnages/${p.id}`, {
    ...sansNmMj, sorts: [{ sort_id: bdf, rang: 1, niveau_maitrise: 2, nm_livre: 1, nm_cadeau: 1 }, { sort_id: cau, rang: 2, niveau_maitrise: 1, nm_livre: 0, nm_cadeau: 1 }],
  });
  assert.equal(m.statut, 200, JSON.stringify(m.corps));
  assert.equal(m.corps.personnage.nm_mj, 2, 'leur somme');
  assert.deepEqual(m.corps.personnage.sorts.map((x) => [x.sort_id, x.niveau_maitrise, x.nm_livre]), [[bdf, 2, 1], [cau, 1, 0]]);
  assert.ok(m.corps.personnage.sorts.every((x) => !('nm_cadeau' in x)));
  // les deux formes à la fois (une page d'avant qui a repris nm_mj d'une réponse, puis noté un NM du MJ sur un sort) : rien ne les concilie
  const avant = lire(p.id);
  const k = appel('PUT', `/api/personnages/${p.id}`, { ...avant.personnage, sorts: avant.personnage.sorts.map((x) => ({ ...x, nm_cadeau: 1 })) });
  assert.deepEqual([k.statut, k.corps], [409, { erreur: PAGE_D_AVANT }]);
  assert.deepEqual(lire(p.id), avant, 'rien n’est écrit');
  assert.match(PAGE_D_AVANT, /les NM du MJ se notent pour toute la fiche/);
  // nm_cadeau à 0 avec nm_mj : une page d'avant qui n'a rien noté du MJ sur un sort, ses NM du MJ gardés
  m = appel('PUT', `/api/personnages/${p.id}`, { ...avant.personnage, sorts: avant.personnage.sorts.map((x) => ({ ...x, nm_cadeau: 0 })) });
  assert.equal(m.statut, 200, JSON.stringify(m.corps));
  assert.equal(m.corps.personnage.nm_mj, 2);
});

test('repli sur une base vivante d’avant la migration 0062 (sa reconstruction a échoué) : sans les tables de l’entraînement et des choix d’acquis, la fiche se lit avec des listes vides, s’enregistre (l’acquis d’avant à 0), et une liste non vide est refusée', () => {
  const { chemin: avant } = preparerBaseVivante({ regles: REGLES, dossier: join(racine, 'db-avant-0062') });
  const ancienne = new DatabaseSync(avant);
  // la vue des contrôles d'avant ne lisait pas l'entraînement (règles entrainement_competences et entrainement_valeur, migration 0062)
  const vue = ancienne.prepare("SELECT sql FROM sqlite_master WHERE name = 'v_personnage_controle'").get().sql;
  const vueDAvant = vue.replace(/\n  UNION ALL\n  -- Entraînement \(décision R104\)[\s\S]*?'entrainement\.bonus_max_pct'\)/, '');
  assert.notEqual(vueDAvant, vue);
  ancienne.exec(`DROP VIEW v_personnage_controle; ${vueDAvant};
    DROP TABLE personnage_entrainement; DROP TABLE personnage_acquis_choix;
    ALTER TABLE personnage ADD COLUMN entrainement TEXT;
    ALTER TABLE personnage_competence ADD COLUMN acquis INTEGER NOT NULL DEFAULT 0 CHECK (acquis >= 0);`);
  ancienne.close();
  const base = ouvrirBaseVivante(avant);
  try {
    const cree = enregistrerFiche(base, { ...ficheConforme('Repli 0062'), entrainements: [], acquis_choix: [] });
    assert.deepEqual([cree.personnage.entrainements, cree.personnage.acquis_choix], [[], []], 'lues vides');
    assert.deepEqual(base.prepare('SELECT DISTINCT acquis FROM personnage_competence WHERE personnage_id = ?').all(cree.personnage.id).map((l) => l.acquis), [0]);
    const lue = lireFiche(base, cree.personnage.id);
    for (const [cle, liste] of [['entrainements', [{ rang: 1, competence_id: 'arc', valeur: 2, texte: null }]], ['acquis_choix', [{ source: 'x', rang: 1, competence_id: 'arc', valeur: null }]]]) {
      assert.throws(() => enregistrerFiche(base, { version: lue.version, [cle]: liste }, { id: lue.id }), (e) => {
        assert.deepEqual([e.statut, e.details.problemes], [400, [`${cle} : pas encore dans cette base, ses lignes seraient perdues`]]);
        return true;
      });
    }
    assert.deepEqual(lireFiche(base, lue.id), lue, 'rien n’est écrit');
  } finally {
    base.close();
  }
});

test('repli sur une base vivante d’avant la migration 0066 (sa reconstruction a échoué) : sans `nm_mj`, une fiche à 0 NM du MJ s’enregistre (les sorts à 0 NM du MJ chacun) ; des NM du MJ sont refusés, rien n’est perdu sans le dire', () => {
  const { chemin: avant } = preparerBaseVivante({ regles: REGLES, dossier: join(racine, 'db-avant-0066') });
  const ancienne = new DatabaseSync(avant);
  // la vue et la table d'avant (décision R26 : les NM du MJ sort par sort, personnage_sort.nm_cadeau)
  const vue = ancienne.prepare("SELECT sql FROM sqlite_master WHERE name = 'v_personnage_controle'").get().sql;
  const vueDAvant = vue.replaceAll(" || CASE WHEN p.nm_mj > 0 THEN ' + ' || p.nm_mj || ' du MJ' ELSE '' END", '').replaceAll(' + p.nm_mj', '')
    .replaceAll('ps.niveau_maitrise - ps.nm_livre', 'ps.niveau_maitrise - ps.nm_livre - ps.nm_cadeau');
  assert.ok(!vueDAvant.includes('p.nm_mj'));
  ancienne.exec(`DROP VIEW v_personnage_controle;
    ALTER TABLE personnage DROP COLUMN nm_mj;
    ALTER TABLE personnage_sort ADD COLUMN nm_cadeau INTEGER NOT NULL DEFAULT 0 CHECK (nm_cadeau >= 0);
    ${vueDAvant};`);
  ancienne.close();
  const base = ouvrirBaseVivante(avant);
  try {
    const bdf = 'magies/magie-du-feu#sort:boule-de-feu';
    const cree = enregistrerFiche(base, { ...ficheConforme('Repli 0066'), sorts: [{ sort_id: bdf, rang: 1, niveau_maitrise: 1, nm_livre: 1 }] });
    assert.ok(!('nm_mj' in cree.personnage), 'la colonne n’est pas dans cette base');
    assert.deepEqual(base.prepare('SELECT niveau_maitrise, nm_livre, nm_cadeau FROM personnage_sort WHERE personnage_id = ?').all(cree.personnage.id).map((l) => ({ ...l })),
      [{ niveau_maitrise: 1, nm_livre: 1, nm_cadeau: 0 }]);
    const lue = lireFiche(base, cree.personnage.id);
    assert.throws(() => enregistrerFiche(base, { version: lue.version, nm_mj: 2 }, { id: lue.id }), (e) => {
      assert.deepEqual([e.statut, e.details.problemes], [400, ['champ inconnu « nm_mj »']]);
      return true;
    });
    assert.deepEqual(lireFiche(base, lue.id), lue, 'rien n’est écrit');
  } finally {
    base.close();
  }
});
