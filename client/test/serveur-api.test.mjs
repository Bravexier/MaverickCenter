// API du service des personnages (client/serveur/api.mjs, fiches.mjs, service.mjs ; docs/serveur.md) : prétirés créés, lus, modifiés au format
// de src/lib/fiche-format.mjs, contrôles de la base rendus, écritures refusées pour la bonne raison, rien d'écrit en cas de refus ; puis le
// serveur HTTP réel (port au hasard) et sa surveillance des fichiers (nouvelles règles, base remplacée, nouvelle version du service).
import assert from 'node:assert/strict';
import { copyFileSync, mkdtempSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { after, test } from 'node:test';
import { traiter } from '../serveur/api.mjs';
import { TABLES_VIVANTES, ouvrirBaseVivante, preparerBaseVivante } from '../serveur/base-vivante.mjs';
import { expliquer, LIGNES_MAX } from '../serveur/fiches.mjs';
import { demarrerService, guetteur } from '../serveur/service.mjs';
import { cheminBase } from '../src/lib/donnees.mjs';
import { COLONNES_DU_SERVICE, HORS_FICHE, PARTIES_DE_FICHE, ficheVide } from '../src/lib/fiche-format.mjs';

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
    statut: 'valide', race_id: 'races/humain', ethnie_id: 'races/humain#ethnie:humain-central', magie_innee_id: 'magies/magie-du-feu', bourse_ro: 12,
    classes: [{ rang: 1, classe_id: 'classes/guerrier', specialite_id: null }],
    caracteristiques: Object.entries({ force: 4, volonte: 2, intelligence: 2, perception: 2, social: 2, agilite: 2 })
      .map(([caracteristique_id, base]) => ({ caracteristique_id, base, croix: 0 })),
    competences: ['arc', 'arme-lourde', 'athletisme', 'parade', 'stabilite'].map((competence_id) => ({ competence_id, naturel: 20, acquis: 0 })),
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
});

test('un choix que les règles n’ont plus (don ou spécialité supprimé depuis le site de dev, D11) : message en français, rien n’est écrit', () => {
  assert.equal(expliquer('FOREIGN KEY constraint failed'), 'un choix de la fiche (don, spécialité…) n’existe plus dans les règles : rechargez la page');
  const avant = db.prepare('SELECT count(*) AS n FROM personnage').get().n;
  const r = appel('POST', '/api/personnages', { ...ficheVide('Sans règle'), capacites: [{ capacite_id: 'capacites/don-supprime-d11' }] });
  assert.equal(r.statut, 400);
  assert.ok(r.corps.problemes.some((p) => /capacite_id.*n’existe pas dans les règles/.test(p)), JSON.stringify(r.corps));
  assert.equal(db.prepare('SELECT count(*) AS n FROM personnage').get().n, avant);
});

test('création : un prétiré (à personne, visible de tous), brouillon par défaut ; lu, listé, avec son niveau et ses contrôles', () => {
  const r = appel('POST', '/api/personnages', { nom: 'Brune', surnom: '', lieu_origine: 'Valbrume', id: 'ignore', nature: 'joueur', visibilite: 'privee' });
  assert.equal(r.statut, 201, JSON.stringify(r.corps));
  const p = r.corps.personnage;
  assert.equal(r.entetes.Location, `/api/personnages/${p.id}/`);
  assert.match(p.id, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  assert.deepEqual({ nature: p.nature, proprietaire_id: p.proprietaire_id, visibilite: p.visibilite, statut: p.statut, nom: p.nom, surnom: p.surnom, lieu_origine: p.lieu_origine, mode_classe: p.mode_classe, xp: p.xp },
    { nature: 'pretire', proprietaire_id: null, visibilite: 'tous', statut: 'brouillon', nom: 'Brune', surnom: null, lieu_origine: 'Valbrume', mode_classe: 'mono', xp: 0 });
  assert.match(p.cree_le, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/);
  assert.equal(p.modifie_le, p.cree_le);
  assert.match(p.version, /^[0-9a-f]{16}$/);
  for (const cle of Object.keys(PARTIES_DE_FICHE)) assert.deepEqual(p[cle], [], cle);
  assert.deepEqual(r.corps.niveau, { niveau_global: 1, niveau_classe_1: 2, niveau_classe_2: 0 });
  assert.deepEqual(r.corps.controles, [], 'un brouillon vide n’enfreint rien de ce que la base contrôle');

  assert.deepEqual(lire(p.id), r.corps, 'relue à l’identique');
  const liste = appel('GET', '/api/personnages/').corps.personnages;
  const resume = liste.find((f) => f.id === p.id);
  assert.deepEqual({ nom: resume.nom, statut: resume.statut, niveau_global: resume.niveau_global, classes: resume.classes, anomalies: resume.anomalies },
    { nom: 'Brune', statut: 'brouillon', niveau_global: 1, classes: [], anomalies: 0 });
  assert.match(journal.at(-1), new RegExp(`création du prétiré ${p.id}`));
});

test('une fiche conforme se crée « valide » ; le résumé donne les noms des règles', () => {
  const r = appel('POST', '/api/personnages', ficheConforme('Cyrielle'));
  assert.equal(r.statut, 201, JSON.stringify(r.corps));
  assert.deepEqual(r.corps.controles, []);
  assert.equal(r.corps.personnage.statut, 'valide');
  assert.equal(r.corps.personnage.caracteristiques.length, 6);
  assert.deepEqual(r.corps.personnage.classes, [{ rang: 1, classe_id: 'classes/guerrier', specialite_id: null }]);
  const resume = appel('GET', '/api/personnages').corps.personnages.find((f) => f.id === r.corps.personnage.id);
  assert.deepEqual({ race: resume.race, ethnie: resume.ethnie, magie_innee: resume.magie_innee, classes: resume.classes.map((c) => c.classe) },
    { race: 'Humain', ethnie: db.prepare("SELECT nom FROM ethnie WHERE id = 'races/humain#ethnie:humain-central'").get().nom, magie_innee: db.prepare("SELECT nom FROM magie WHERE id = 'magies/magie-du-feu'").get().nom, classes: ['Guerrier'] });
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

test('« valide » refusé tant que la fiche enfreint une règle de la base (422), avec la liste ; un brouillon les montre sans bloquer', () => {
  const { personnage: p } = appel('POST', '/api/personnages', { nom: 'Fanny', race_id: 'races/humain', magie_innee_id: 'magies/magie-du-feu' }).corps;
  const r = appel('PUT', `/api/personnages/${p.id}`, { version: p.version, statut: 'valide' });
  assert.equal(r.statut, 422);
  assert.ok(r.corps.controles.some((c) => c.regle === 'ethnie_manquante'), JSON.stringify(r.corps.controles));
  assert.ok(r.corps.controles.some((c) => c.regle === 'classe_1_manquante'));
  assert.equal(lire(p.id).personnage.statut, 'brouillon');
  const b = appel('PUT', `/api/personnages/${p.id}`, { version: p.version, classes: [{ rang: 1, classe_id: 'classes/guerrier' }, { rang: 2, classe_id: 'classes/archimage' }] });
  assert.equal(b.statut, 200);
  assert.deepEqual(b.corps.controles.map((c) => c.regle).filter((x) => x.startsWith('classe')), ['classe_2_en_trop', 'classe_reservee'],
    'brouillon : contrôles rendus (dont l’Archimage sans Potentiel Illimité, R23), fiche enregistrée');
});

test('fiche de joueur : ni listée, ni lue, ni modifiable sans comptes (avant la 1.0)', () => {
  db.exec(`INSERT INTO utilisateur (id, nom_affichage, cree_le) VALUES ('alice', 'Alice', '2026-10-10T00:00:00Z');
    INSERT INTO personnage (id, nature, proprietaire_id, visibilite, statut, nom, mode_classe, xp, alignement_loyal, alignement_chaotique, alignement_bon,
      alignement_mauvais, bourse_pp, bourse_ro, bourse_rf, ambidextrie, cree_le, modifie_le)
    VALUES ('fiche-alice', 'joueur', 'alice', 'privee', 'brouillon', 'Secret', 'mono', 0, 0, 0, 0, 0, 0, 0, 0, 0, '2026-10-10T00:00:00Z', '2026-10-10T00:00:00Z');`);
  assert.ok(!appel('GET', '/api/personnages').corps.personnages.some((f) => f.id === 'fiche-alice'));
  assert.equal(appel('GET', '/api/personnages/fiche-alice').statut, 404);
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
    const reponse = await fetch(`${s.url}/api/personnages`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nom: 'Hugo' }) });
    assert.equal(reponse.status, 201);
    assert.equal(reponse.headers.get('cache-control'), 'no-store');
    assert.match(reponse.headers.get('content-type'), /^application\/json/);
    const hugo = (await reponse.json()).personnage;
    const gros = await fetch(`${s.url}/api/personnages`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: 'x'.repeat(1024 * 1024 + 10) }).catch((e) => e);
    if (!(gros instanceof Error)) assert.equal(gros.status, 413);

    // Une livraison remplace la base des règles : la base vivante est refaite, Hugo reste.
    const nouvelles = join(racine, 'regles-neuves.db');
    copyFileSync(REGLES, nouvelles);
    const m = new DatabaseSync(nouvelles);
    m.exec("UPDATE race SET nom = 'Humain bis' WHERE id = 'races/humain'");
    m.close();
    renameSync(nouvelles, regles);
    await attendre(() => lignes.some((l) => l.startsWith('base vivante faite') && l.includes('archivée')), lignes.join('\n'));
    etat = s.etat();
    assert.equal(etat.base.a_jour, true);
    const liste = await (await fetch(`${s.url}/api/personnages`)).json();
    assert.deepEqual(liste.personnages.map((f) => f.nom), ['Hugo']);

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
