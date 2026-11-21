// Le gel des écritures (lot 11 de la bascule 2, garde-fou 16 ; client/serveur/gel.mjs, api.mjs, service.mjs ; docs/serveur.md, « Gel des écritures »). Un fichier
// db/gel.json, posé par root (deploy/installateur/gel.sh), arrête toute écriture de /api/ (503 : jusqu'à quand, pourquoi, le geste qui le lève) ; les lectures
// restent ouvertes ; il survit à une relance, se lève seul à l'échéance (noté une fois au journal), et un fichier illisible tient le gel au plus 2 h. SANS
// fichier, rien ne change (éteint par défaut).
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { traiter } from '../serveur/api.mjs';
import { ouvrirBaseVivante, preparerBaseVivante } from '../serveur/base-vivante.mjs';
import {
  FICHIER_GEL, FORMAT_DU_GEL, PLAFOND_ILLISIBLE_MS, PLAFOND_MAX_MS, ROUTES_EXEMPTEES, creerGel, ecritureGelee, gesteParDefaut, lireLeGel, messageDuGel,
} from '../serveur/gel.mjs';
import { demarrerService } from '../serveur/service.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';

const JSON_ = { 'content-type': 'application/json' };
const MIN = 60_000;
const SOURCE_API = readFileSync(new URL('../serveur/api.mjs', import.meta.url), 'utf8');
const ENTETE_API = SOURCE_API.split('\n').filter((l) => l.startsWith('//')).join('\n');
const UUID = '00000000-0000-4000-8000-000000000000';
const iso = (ms) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');

/** Pose db/gel.json comme gel.sh : `fin` et `pose` en millisecondes ; `mtime` (ms) force la date de modification du fichier. */
function poser(dossier, { fin, pose = Date.now(), motif = 'mise à jour en cours', geste = 'sudo sh /srv/maverick-center-test/gel.sh lever', mtime = null, brut = null } = {}) {
  const chemin = join(dossier, FICHIER_GEL);
  writeFileSync(chemin, brut ?? `${JSON.stringify({ format: FORMAT_DU_GEL, pose_le: iso(pose), jusqu_a: iso(fin), motif, geste })}\n`);
  if (mtime !== null) utimesSync(chemin, mtime / 1000, mtime / 1000);
  return chemin;
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Quelles écritures le gel arrête
// ---------------------------------------------------------------------------------------------------------------------------------------------

test('les lectures ne sont jamais gelées ; toute écriture de l’API l’est, sauf les cinq routes exemptées (chacune avec sa raison)', () => {
  for (const m of ['GET', 'HEAD', 'OPTIONS']) assert.equal(ecritureGelee(m, '/api/personnages/'), false, m);
  assert.equal(ecritureGelee('GET', '/api/edition/lots/'), false);
  assert.equal(ecritureGelee('GET', '/api/mise-a-jour/lots/x/'), false);
  // les écritures de contenu et de fiche, jamais exemptées
  const gelees = [
    ['POST', '/api/personnages/'], ['PUT', '/api/personnages/p/'], ['DELETE', '/api/personnages/p/'], ['POST', '/api/edition/'],
    ['POST', '/api/edition/lots/'], ['POST', `/api/edition/lots/${UUID}/appliquer/`], ['POST', `/api/edition/lots/${UUID}/refuser/`], ['POST', `/api/edition/lots/${UUID}/annuler/`],
    ['POST', `/api/edition/lots/${UUID}/essai/`], ['POST', '/api/edition/lots/recalcul/'], ['POST', `/api/edition/lots/${UUID}/lignes/1/annuler/`],
    ['POST', '/api/mise-a-jour/lancer/'], ['POST', '/api/mise-a-jour/copier/'], ['POST', '/api/mise-a-jour/liberer/'], ['POST', '/api/mise-a-jour/brouillon/'],
    ['POST', '/api/mise-a-jour/majeure/'], ['POST', '/api/mise-a-jour/conflits/'],
    ['POST', '/api/v1/metiers/'], ['PATCH', '/api/v1/metiers/x/'], ['PUT', '/api/v1/metiers/x/'], ['DELETE', '/api/v1/metiers/x/'],
    ['POST', '/api/route-inconnue/'], ['PATCH', '/api/etat/'],
  ];
  for (const [m, c] of gelees) assert.equal(ecritureGelee(m, c), true, `${m} ${c}`);
  // la forme sans « / » finale et la chaîne de requête ne contournent rien
  assert.equal(ecritureGelee('POST', '/api/personnages'), true);
  assert.equal(ecritureGelee('POST', '/api/personnages/?x=1'), true);
  assert.equal(ecritureGelee('post', '/api/personnages/'), true);
  // les exemptions : lectures en POST, session, balise, levée de la maintenance
  const exemptees = [
    ['POST', '/api/acces/'], ['DELETE', '/api/acces/'], ['POST', '/api/classeur/'], ['POST', '/api/metriques/page/'], ['POST', '/api/maintenance/lever/'],
    ...['lignes', 'race', 'classe', 'bestiaire', 'portrait', 'evenement'].map((a) => ['POST', `/api/edition/${a}/`]),
  ];
  for (const [m, c] of exemptees) assert.equal(ecritureGelee(m, c), false, `${m} ${c}`);
  assert.equal(ROUTES_EXEMPTEES.length, 5);
  for (const e of ROUTES_EXEMPTEES) assert.ok(e.raison.length > 20, `${e.motif} : la raison s’écrit`);
});

test('chaque écriture listée dans l’en-tête d’api.mjs est gelée, sauf les exemptions : une route nouvelle l’est d’office', () => {
  const exemple = (c) => c.replace(/\/lots\/<id>/, `/lots/${UUID}`).replace('<n>', '1').replace('<id>', 'essai').replace('<nom>', 'personnage');
  const ecritures = [...ENTETE_API.matchAll(/^\/\/\s+(POST|PUT|PATCH|DELETE)\s+(\/api\/\S*?\/)(?=[\s,]|$)/gm)].map(([, m, c]) => [m, exemple(c)]);
  assert.ok(ecritures.length >= 20, `${ecritures.length} écritures lues`);
  const passent = ecritures.filter(([m, c]) => !ecritureGelee(m, c)).map(([m, c]) => `${m} ${c}`);
  assert.deepEqual(passent.sort(), [
    'DELETE /api/acces/', 'POST /api/acces/', 'POST /api/classeur/', 'POST /api/edition/bestiaire/', 'POST /api/edition/classe/', 'POST /api/edition/evenement/',
    'POST /api/edition/lignes/', 'POST /api/edition/portrait/', 'POST /api/edition/race/', 'POST /api/maintenance/lever/', 'POST /api/metriques/page/',
  ].sort(), 'seules les exemptions justifiées passent le gel');
});

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Le fichier : lecture, échéance, prudence
// ---------------------------------------------------------------------------------------------------------------------------------------------

test('sans fichier : aucun gel, aucune réponse changée ; le service ne crée rien', () => {
  const d = dossierTemporaire('gel-absent');
  assert.deepEqual(lireLeGel(d), { etat: 'absent' });
  const gel = creerGel({ dossier: d });
  assert.equal(gel.etat(), null);
  assert.equal(gel.refus('POST', '/api/personnages/'), null);
  // `traiter` avec et sans l'objet gel : la même réponse
  const service = { base: () => null, etat: () => ({ service: 'essai' }) };
  const sans = traiter({ methode: 'POST', chemin: '/api/personnages/', entetes: JSON_, corps: '{}' }, service);
  const avec = traiter({ methode: 'POST', chemin: '/api/personnages/', entetes: JSON_, corps: '{}' }, { ...service, gel });
  assert.deepEqual(avec, sans);
  assert.equal(avec.statut, 503, 'ici la base manque : un 503 de la base, pas du gel');
  assert.equal(avec.gel, undefined);
  assert.equal(avec.corps.gel, undefined);
});

test('un gel non échu : 503 avec l’échéance, le motif et le geste ; les lectures passent ; relu après une relance (un fichier, pas une mémoire)', () => {
  const d = dossierTemporaire('gel-actif');
  const maintenant = Date.parse('2026-11-20T10:00:00Z');
  const journal = [];
  poser(d, { pose: maintenant, fin: maintenant + 45 * MIN, motif: 'bascule de la production', mtime: maintenant });
  const gel = creerGel({ dossier: d, horloge: () => maintenant, journal: (m, o) => journal.push([m, o?.categorie]) });
  const refus = gel.refus('PUT', '/api/personnages/p/');
  assert.equal(refus.statut, 503);
  assert.equal(refus.gel, true);
  assert.equal(refus.entetes['Retry-After'], '300', 'plafonné à 5 minutes');
  assert.equal(refus.corps.gel.jusqu_a, '2026-11-20T10:45:00Z');
  assert.equal(refus.corps.gel.motif, 'bascule de la production');
  assert.match(refus.corps.erreur, /2026-11-20T10:45:00Z/);
  assert.match(refus.corps.erreur, /45 min/);
  assert.match(refus.corps.erreur, /bascule de la production/);
  assert.match(refus.corps.erreur, /sudo sh \/srv\/maverick-center-test\/gel\.sh lever/);
  assert.equal(gel.refus('GET', '/api/personnages/'), null, 'une lecture passe');
  assert.equal(gel.refus('POST', '/api/classeur/'), null, 'une route exemptée passe');
  assert.deepEqual(journal.map(([m]) => m).filter((m) => m.startsWith('gel :')).length, 1, 'noté une seule fois, pas à chaque requête');
  assert.equal(journal[0][1], 'gel');
  // une relance : un autre objet sur le même dossier voit le même gel
  const apresRelance = creerGel({ dossier: d, horloge: () => maintenant + 10 * MIN });
  assert.equal(apresRelance.refus('POST', '/api/edition/').statut, 503);
  assert.match(apresRelance.refus('POST', '/api/edition/').corps.erreur, /encore 35 min/);
});

test('échu : ignoré tout seul et noté une fois ; retiré : noté levé ; le fichier échu ne gèle plus jamais', () => {
  const d = dossierTemporaire('gel-echu');
  let t = Date.parse('2026-11-20T10:00:00Z');
  const journal = [];
  poser(d, { pose: t, fin: t + 30 * MIN, mtime: t });
  const gel = creerGel({ dossier: d, horloge: () => t, journal: (m) => journal.push(m) });
  assert.ok(gel.etat());
  t += 29 * MIN;
  assert.ok(gel.etat(), 'une minute avant l’échéance : encore gelé');
  t += 2 * MIN;
  assert.equal(gel.etat(), null, 'échu');
  assert.equal(gel.refus('POST', '/api/personnages/'), null);
  gel.verifier();
  gel.etat();
  assert.equal(journal.filter((m) => /échu/.test(m)).length, 1, 'l’échéance est notée une fois');
  // un nouveau gel (fichier réécrit) est un autre gel
  t += MIN;
  poser(d, { pose: t, fin: t + 10 * MIN, mtime: t });
  assert.ok(gel.etat());
  rmSync(join(d, FICHIER_GEL));
  assert.equal(gel.etat(), null);
  assert.equal(journal.filter((m) => /retiré/.test(m)).length, 1, 'le retrait d’un gel actif est noté');
});

test('un fichier illisible ou mal formé tient le gel au plus 2 h après sa date de modification, et le message le dit', () => {
  const t0 = Date.parse('2026-11-20T10:00:00Z');
  for (const [nom, brut] of [['pas du JSON', '{ pas du json'], ['sans échéance', '{"motif":"x"}'], ['échéance invalide', '{"jusqu_a":"demain"}'], ['un tableau', '[1,2]'], ['vide', '']]) {
    const d = dossierTemporaire('gel-illisible');
    poser(d, { brut, fin: 0, mtime: t0 });
    const gel = creerGel({ dossier: d, horloge: () => t0 + 60 * MIN });
    const refus = gel.refus('POST', '/api/personnages/');
    assert.equal(refus?.statut, 503, nom);
    assert.equal(refus.corps.gel.illisible, true, nom);
    assert.equal(refus.corps.gel.jusqu_a, iso(t0 + PLAFOND_ILLISIBLE_MS), `${nom} : plafond de 2 h`);
    assert.match(refus.corps.erreur, /par prudence/, nom);
    assert.match(refus.corps.erreur, /2 h après la date de modification/, nom);
    assert.match(refus.corps.erreur, /sudo sh \/srv\/maverick-center(-test)?\/gel\.sh lever/, `${nom} : le geste par défaut`);
    const tard = creerGel({ dossier: d, horloge: () => t0 + PLAFOND_ILLISIBLE_MS + MIN });
    assert.equal(tard.refus('POST', '/api/personnages/'), null, `${nom} : levé seul après le plafond`);
  }
  // un dossier à la place du fichier est illisible aussi
  const d = dossierTemporaire('gel-dossier');
  mkdirSync(join(d, FICHIER_GEL));
  assert.equal(lireLeGel(d).gel.illisible, true);
  assert.equal(gesteParDefaut('dev'), 'sudo sh /srv/maverick-center-test/gel.sh lever');
  assert.equal(gesteParDefaut('prod'), 'sudo sh /srv/maverick-center/gel.sh lever');
});

test('une échéance trop lointaine est ramenée à 4 h après la date de modification : un gel ne tient jamais indéfiniment', () => {
  const d = dossierTemporaire('gel-plafond');
  const t0 = Date.parse('2026-11-20T10:00:00Z');
  poser(d, { fin: Date.parse('2099-01-01T00:00:00Z'), mtime: t0 });
  const lu = lireLeGel(d, { maintenantMs: t0 + MIN });
  assert.equal(lu.etat, 'actif');
  assert.equal(lu.gel.jusqu_a, iso(t0 + PLAFOND_MAX_MS));
  assert.equal(lu.gel.plafonne, true);
  assert.equal(lireLeGel(d, { maintenantMs: t0 + PLAFOND_MAX_MS + MIN }).etat, 'echu');
  // un motif ou un geste démesurés sont coupés, jamais renvoyés en entier ; un fichier de plus de 8 Kio est illisible (tenu 2 h au plus)
  poser(d, { fin: t0 + 30 * MIN, mtime: t0, motif: 'm'.repeat(2000), geste: 'g'.repeat(2000) });
  const long = lireLeGel(d, { maintenantMs: t0 }).gel;
  assert.ok(long.motif.length <= 300 && long.geste.length <= 200);
  assert.match(messageDuGel(long, { maintenantMs: t0 }), /encore 30 min/);
  poser(d, { fin: t0 + 30 * MIN, mtime: t0, motif: 'm'.repeat(9000) });
  assert.equal(lireLeGel(d, { maintenantMs: t0 }).gel.illisible, true);
});

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Le service HTTP réel (les deux instances : même code)
// ---------------------------------------------------------------------------------------------------------------------------------------------

/** Une base vivante avec un prétiré, et le dossier de la base : { dossier, regles, versionDe(id) }. */
function baseAvecUnPretire() {
  const racine = dossierTemporaire('gel-base');
  const regles = join(racine, 'maverick.db');
  const schema = new DatabaseSync(regles);
  schema.exec(readFileSync(new URL('../../data/schema.sql', import.meta.url), 'utf8'));
  schema.close();
  const dossier = join(racine, 'db');
  const { chemin } = preparerBaseVivante({ regles, dossier });
  const db = ouvrirBaseVivante(chemin);
  db.exec('PRAGMA foreign_keys = OFF');
  const t = '2026-01-01T00:00:00Z';
  db.prepare(`INSERT INTO personnage (id, nature, proprietaire_id, visibilite, nom, mode_classe, xp, alignement_loyal, alignement_chaotique,
    alignement_bon, alignement_mauvais, bourse_pp, bourse_ro, bourse_rf, ambidextrie, cree_le, modifie_le) VALUES ('pretire-gel', 'pretire', NULL, 'tous', 'Prétiré d’essai', 'mono', 0, 0, 0, 0, 0, 0, 0, 0, 0, ?, ?)`).run(t, t);
  db.prepare("INSERT INTO famille (id, libelle, ordre) VALUES ('classes', 'classes', 1) ON CONFLICT DO NOTHING").run();
  db.prepare("INSERT INTO categorie_classe (id, libelle, ordre, origine, source_ref) VALUES ('cat-essai', 'Catégorie d’essai', 1, 'classes', 'essai')").run();
  db.prepare(`INSERT INTO classe (id, nom, nom_cle, categorie_id, ordre, sante_depart, chakra_depart, barriere_depart, origine, source_ref)
    VALUES ('classe-essai', 'Classe d’essai', 'classe-essai', 'cat-essai', 1, 1, 1, 1, 'classes', 'essai')`).run();
  db.prepare("INSERT INTO specialite (id, classe_id, rang, nom, nom_cle, origine, source_ref) VALUES ('classe-essai#specialite:spe-essai', 'classe-essai', 1, 'Spécialité d’essai', 'spe-essai', 'classes', 'essai')").run();
  db.prepare("INSERT INTO personnage_classe (personnage_id, rang, classe_id, specialite_id) VALUES ('pretire-gel', 1, 'classe-essai', 'classe-essai#specialite:spe-essai')").run();
  db.close();
  return { dossier, regles };
}

async function demarrer({ dossier, regles }, { edition = false, intervalle = 0, lignes = [] } = {}) {
  return demarrerService({
    regles, dossier, port: 0, intervalle, edition, metriques: false, tipeee: false, atelier: false, attestation: false, essaiDeStructure: false,
    journal: (m) => lignes.push(String(m)),
  });
}
const appeler = (s, methode, chemin, corps) => fetch(`${s.url}${chemin}`, { method: methode, headers: corps === undefined ? {} : JSON_, ...(corps === undefined ? {} : { body: JSON.stringify(corps) }) });
const nombreDePretires = (dossier) => {
  const db = new DatabaseSync(join(dossier, 'vivante.db'), { readOnly: true });
  try {
    return db.prepare("SELECT count(*) AS n FROM personnage WHERE nature = 'pretire'").get().n;
  } finally {
    db.close();
  }
};

test('service réel : sans fichier rien ne change ; avec lui les écritures sont refusées (fiches, édition, lots, mise à jour, /api/v1/) et la base ne bouge pas ; le lever rouvre', async () => {
  const base = baseAvecUnPretire();
  const lignes = [];
  const s = await demarrer(base, { edition: true, lignes });
  try {
    assert.equal((await (await appeler(s, 'GET', '/api/etat/')).json()).gel, null, 'sans gel : `gel` vaut null dans /api/etat/');
    const fiche = (await (await appeler(s, 'GET', '/api/personnages/pretire-gel/')).json()).personnage;
    // pose du gel : posé par root, sans redémarrage
    poser(base.dossier, { fin: Date.now() + 30 * MIN, motif: 'essai du gel' });
    const etat = await (await appeler(s, 'GET', '/api/etat/')).json();
    assert.equal(etat.gel.motif, 'essai du gel');
    assert.equal(etat.gel.illisible, false);
    assert.equal(etat.gel.geste, 'sudo sh /srv/maverick-center-test/gel.sh lever');
    for (const [m, c, corps] of [
      ['PUT', '/api/personnages/pretire-gel/', { ...fiche, nom: 'Changé' }], ['DELETE', '/api/personnages/pretire-gel/', { version: fiche.version }], ['POST', '/api/personnages/', {}],
      ['POST', '/api/edition/', { page: 'x', operations: [] }], ['POST', '/api/edition/lots/', {}], ['POST', '/api/edition/lots/recalcul/', {}],
      ['POST', '/api/mise-a-jour/lancer/', {}], ['POST', '/api/mise-a-jour/copier/', {}], ['POST', '/api/mise-a-jour/brouillon/', {}], ['POST', '/api/v1/metiers/', {}],
    ]) {
      const r = await appeler(s, m, c, corps);
      assert.equal(r.status, 503, `${m} ${c}`);
      assert.ok(Number(r.headers.get('retry-after')) > 0, `${m} ${c} : Retry-After`);
      const corpsRendu = await r.json();
      assert.match(corpsRendu.erreur, /gelées jusqu’à/);
      assert.match(corpsRendu.erreur, /essai du gel/);
      assert.match(corpsRendu.erreur, /gel\.sh lever/);
      assert.equal(corpsRendu.gel.motif, 'essai du gel');
    }
    assert.equal(nombreDePretires(base.dossier), 1, 'rien n’a été écrit');
    // les lectures restent ouvertes
    for (const c of ['/api/personnages/', '/api/personnages/pretire-gel/', '/api/v1/', '/api/edition/lots/', '/api/mise-a-jour/', '/api/maintenance/']) {
      assert.equal((await appeler(s, 'GET', c)).status, 200, c);
    }
    // une route exemptée n'est pas arrêtée par le gel (ici : pas de mot de passe posé, 409 de la connexion elle-même)
    assert.equal((await appeler(s, 'POST', '/api/acces/', { mot_de_passe: 'x' })).status, 409);
    assert.ok(lignes.some((l) => /^gel : écritures gelées jusqu’à/.test(l)), 'la pose est notée au journal');
    assert.equal(lignes.filter((l) => /^gel : écritures gelées/.test(l)).length, 1, 'une seule fois');
    // le geste de root : retirer le fichier rouvre sans redémarrage
    rmSync(join(base.dossier, FICHIER_GEL));
    assert.equal((await (await appeler(s, 'GET', '/api/etat/')).json()).gel, null);
    assert.equal((await appeler(s, 'DELETE', '/api/personnages/pretire-gel/', { version: fiche.version })).status, 200);
    assert.equal(nombreDePretires(base.dossier), 0);
  } finally {
    await s.arreter();
  }
});

test('service réel de la production : même code ; il survit à une relance ; un refus du gel n’est pas une ligne du journal de la production', async () => {
  const base = baseAvecUnPretire();
  poser(base.dossier, { fin: Date.now() + 30 * MIN, motif: 'bascule', geste: 'sudo sh /srv/maverick-center/gel.sh lever' });
  for (const tour of [1, 2]) { // le deuxième tour est un service neuf sur le même dossier : la relance
    const lignes = [];
    const s = await demarrer(base, { edition: false, lignes });
    try {
      const r = await appeler(s, 'POST', '/api/personnages/', {});
      assert.equal(r.status, 503, `tour ${tour}`);
      const erreur = (await r.json()).erreur;
      assert.match(erreur, /bascule/);
      assert.doesNotMatch(erreur, /gel\.sh|\/srv\//, 'en production, le 503 ne dit pas le chemin de l’hôte');
      assert.equal((await appeler(s, 'GET', '/api/personnages/')).status, 200);
      assert.equal(lignes.filter((l) => /^(GET|POST) \/api\//.test(l)).length, 0, 'la production ne note pas une requête gelée');
      assert.equal((await (await appeler(s, 'GET', '/api/etat/')).json()).gel.motif, 'bascule');
    } finally {
      await s.arreter();
    }
  }
});

test('service réel : l’échéance se note au journal sans requête (minuterie) et ne gèle plus ensuite', async () => {
  const base = baseAvecUnPretire();
  const lignes = [];
  const s = await demarrer(base, { edition: true, intervalle: 25, lignes });
  try {
    // l'échéance s'écrit à la seconde : 2,5 s laissent au moins une seconde de gel
    poser(base.dossier, { fin: Date.now() + 2500, motif: 'court' });
    const attendre = async (condition, quoi) => {
      for (let i = 0; i < 300; i += 1) {
        if (condition()) return;
        await new Promise((ok) => setTimeout(ok, 20));
      }
      assert.fail(`délai dépassé : ${quoi}`);
    };
    await attendre(() => lignes.some((l) => /^gel : écritures gelées/.test(l)), 'la pose notée par la minuterie');
    await attendre(() => lignes.some((l) => /^gel : échu/.test(l)), 'l’échéance notée par la minuterie');
    assert.equal(lignes.filter((l) => /^gel : échu/.test(l)).length, 1);
    assert.equal((await appeler(s, 'POST', '/api/personnages/', {})).status === 503, false, 'plus de gel');
    assert.equal((await (await appeler(s, 'GET', '/api/etat/')).json()).gel, null);
  } finally {
    await s.arreter();
  }
});

test('/api/etat : `geste` (un chemin de l’hôte) n’est montré ni en production ni à un visiteur sans droit de lecture du site de dev', () => {
  const gel = { pose_le: null, jusqu_a: '2099-01-01T00:00:00Z', motif: 'essai', geste: 'sudo sh /srv/maverick-center/gel.sh lever', illisible: false, plafonne: false };
  const etat = (service) => traiter({ methode: 'GET', chemin: '/api/etat/', entetes: {} }, { base: () => null, etat: () => ({ service: 'essai', gel }), ...service }).corps.gel;
  assert.equal(etat({ edition: false }).geste, null, 'production : jamais');
  assert.equal(etat({ edition: true }).geste, gel.geste, 'site de dev sans réglage d’accès : comme avant');
  const acces = (droit) => ({ controler: () => null, droit: () => ({ droit }) });
  assert.equal(etat({ edition: true, acces: acces('aucun') }).geste, null, 'site de dev, sans droit de lecture');
  assert.equal(etat({ edition: true, acces: acces('lecture') }).geste, gel.geste, 'site de dev, avec la clé de lecture');
  assert.equal(etat({ edition: true, acces: acces('ecriture') }).geste, gel.geste);
  assert.equal(etat({ edition: true, acces: acces('aucun') }).motif, 'essai', 'le reste du gel est montré');
  assert.equal(gel.geste, 'sudo sh /srv/maverick-center/gel.sh lever', 'l’objet du service n’est pas modifié');
  // sans gel : null, quel que soit l'appelant
  assert.equal(traiter({ methode: 'GET', chemin: '/api/etat/', entetes: {} }, { base: () => null, etat: () => ({ service: 'essai', gel: null }), edition: false }).corps.gel, null);
});

test('le 503 d’une écriture gelée : sans le chemin de l’hôte en production et pour un visiteur sans droit de lecture (échéance et motif gardés) ; avec lui sinon', () => {
  const d = dossierTemporaire('gel-503-geste');
  const maintenant = Date.parse('2026-11-20T10:00:00Z');
  poser(d, { pose: maintenant, fin: maintenant + 30 * MIN, motif: 'bascule', mtime: maintenant });
  const gel = creerGel({ dossier: d, horloge: () => maintenant });
  const ecrire = (service) => traiter({ methode: 'POST', chemin: '/api/personnages/', entetes: JSON_, corps: '{}' }, { base: () => null, etat: () => ({}), gel, ...service });
  const acces = (droit) => ({ controler: () => null, droit: () => ({ droit }) });
  for (const [nom, service] of [['production', { edition: false }], ['site de dev, sans droit', { edition: true, acces: acces('aucun') }]]) {
    const r = ecrire(service);
    assert.equal(r.statut, 503, nom);
    assert.doesNotMatch(JSON.stringify(r.corps), /gel\.sh|\/srv\//, `${nom} : aucun chemin de l’hôte`);
    assert.equal(r.corps.gel.geste, null, nom);
    assert.match(r.corps.erreur, /2026-11-20T10:30:00Z/, `${nom} : l’échéance reste dite`);
    assert.match(r.corps.erreur, /bascule/, `${nom} : le motif reste dit`);
    assert.doesNotMatch(r.corps.erreur, /Pour lever/, nom);
  }
  for (const [nom, service] of [['site de dev sans réglage', { edition: true }], ['avec la clé', { edition: true, acces: acces('lecture') }]]) {
    const r = ecrire(service);
    assert.equal(r.statut, 503, nom);
    assert.match(r.corps.erreur, /gel\.sh lever/, nom);
    assert.match(r.corps.gel.geste, /gel\.sh lever/, nom);
  }
  // un fichier illisible : même règle
  writeFileSync(join(d, FICHIER_GEL), '{ pas du json');
  utimesSync(join(d, FICHIER_GEL), maintenant / 1000, maintenant / 1000);
  const illisible = ecrire({ edition: false });
  assert.match(illisible.corps.erreur, /par prudence/);
  assert.doesNotMatch(illisible.corps.erreur, /gel\.sh|\/srv\//);
});
