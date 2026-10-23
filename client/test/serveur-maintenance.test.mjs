// « Maintenance en cours » pendant une vraie mise à jour (serveur/maintenance.mjs, route /api/maintenance/ ; docs/serveur.md, « Maintenance pendant
// une mise à jour ») : l'annonce tirée du lancement (vraie mise à jour seulement, de son lancement à l'installation), publiée par le site de dev
// dans le dossier partagé et lue par la production ; chaque serveur rouvre dès que SA version atteint la version cible, indépendamment de l'autre ;
// une mise à jour arrêtée avant d'être livrée, « Lever la maintenance » et le plafond de durée rouvrent les deux ; la minuterie du site de dev suit
// la mise à jour sans personne sur la page ; l'adresse de retour de la page de maintenance ne mène jamais hors du site.
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, rmSync, writeFileSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { traiter } from '../serveur/api.mjs';
import { FICHIER_BASE, ouvrirBaseVivante, preparerBaseVivante } from '../serveur/base-vivante.mjs';
import {
  annonceDuLancement, DUREE_MAX_MAINTENANCE, etatDeMaintenance, FICHIER_ANNONCE, FORMAT_ANNONCE, lireAnnonce, publierAnnonce,
} from '../serveur/maintenance.mjs';
import { CONFIRMATION, lireLancement } from '../serveur/notes-de-version.mjs';
import { demarrerService } from '../serveur/service.mjs';
import { cheminBase } from '../src/lib/donnees.mjs';
import { adresseDeRetour } from '../src/lib/maintenance-retour.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';
import { versionLibre } from './aide-mise-a-jour.mjs';

const racine = dossierTemporaire('maintenance');
const regles = cheminBase({ sansExemples: false });

const LOT = '0f6d3c2a-1b2c-4d5e-8f90-123456789abc';
const T0 = Date.parse('2026-10-11T18:00:00Z');
const instantDe = (ms) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');
const lancement = (changement = {}) => ({ lot: LOT, lance_le: instantDe(T0), version_cible: '0.3', etat: 'envoi', simulation: false, run: null, erreur: null, ...changement });
/** L'état du lancement d'un site de dev, tel que l'écrit notes-de-version.mjs (db/mise-a-jour/etat.json). */
const poserLancement = (dossier, l) => {
  mkdirSync(join(dossier, 'mise-a-jour'), { recursive: true });
  writeFileSync(join(dossier, 'mise-a-jour', 'etat.json'), `${JSON.stringify(l, null, 2)}\n`);
};
const JSON_ = { 'content-type': 'application/json' };

test('annonce : une vraie mise à jour, de son lancement à sa livraison ; rien pour une simulation, un échec, un lancement annulé ou à la main', () => {
  const instant = instantDe(T0 + 60_000);
  for (const etat of ['envoi', 'lance', 'en_cours', 'fusionne', 'termine']) {
    assert.deepEqual(annonceDuLancement(lancement({ etat }), { instant }), { format: FORMAT_ANNONCE, lot: LOT, version_cible: '0.3', depuis: instantDe(T0), etat }, etat);
  }
  // « manuel » : sans jeton, le workflow se lance à la main avec les valeurs de la page « Mise à jour » : elle doit rester ouverte
  for (const etat of ['echec', 'echec_livraison', 'erreur', 'manuel', 'annule', 'simulation_reussie', 'simulation_echouee']) {
    assert.equal(annonceDuLancement(lancement({ etat }), { instant }), null, etat);
  }
  assert.equal(annonceDuLancement(lancement({ etat: 'en_cours', simulation: true }), { instant }), null, 'la simulation ne ferme rien');
  assert.equal(annonceDuLancement(lancement({ etat: 'fusionne', maintenance_levee_le: instant }), { instant }), null, 'maintenance levée');
  assert.equal(annonceDuLancement(lancement({ etat: 'termine' }), { instant: instantDe(T0 + DUREE_MAX_MAINTENANCE + 1000) }), null, 'plafond dépassé');
  assert.equal(annonceDuLancement(lancement({ version_cible: '0.3.0' }), { instant }), null, 'version cible X.Y seulement');
  assert.equal(annonceDuLancement(null, { instant }), undefined, 'aucun lancement connu : rien n’est su');
});

test('un serveur est en maintenance tant que SA version est plus ancienne que la version cible ; fini dès qu’elle y tourne', () => {
  const annonce = annonceDuLancement(lancement({ etat: 'fusionne' }), { instant: instantDe(T0) });
  const instant = instantDe(T0 + 600_000);
  assert.deepEqual(etatDeMaintenance({ annonce, version: '0.2.0', instant }), { active: true, version_cible: '0.3', depuis: instantDe(T0), etape: 'livraison' });
  // le serveur de test reçoit d'abord la version de dev qui porte le lot (0.2.Z+1), puis la livraison (0.3.0, dev et master)
  assert.equal(etatDeMaintenance({ annonce, version: '0.2.7', instant }).active, true);
  assert.equal(etatDeMaintenance({ annonce, version: '0.3.0', instant }).active, false);
  assert.equal(etatDeMaintenance({ annonce, version: '1.0.0', instant }).active, false);
  const etape = (etat) => etatDeMaintenance({ annonce: { ...annonce, etat }, version: '0.2.0', instant }).etape;
  assert.deepEqual(['envoi', 'lance', 'en_cours', 'fusionne', 'termine'].map(etape), ['preparation', 'preparation', 'preparation', 'livraison', 'installation']);
  assert.equal(etatDeMaintenance({ annonce, version: '0.2.0', instant: instantDe(T0 + DUREE_MAX_MAINTENANCE + 1000) }).active, false, 'plafond');
  for (const douteuse of [null, {}, { ...annonce, format: 'autre' }, { ...annonce, version_cible: '0.3.0' }, { ...annonce, depuis: 'hier' },
    { ...annonce, etat: 'echec' }, { ...annonce, lot: '../x' }]) {
    assert.deepEqual(etatDeMaintenance({ annonce: douteuse, version: '0.2.0', instant }), { active: false }, JSON.stringify(douteuse));
  }
});

test('dossier partagé : l’annonce écrite si elle change, retirée par null, laissée telle quelle sans lancement connu ; une annonce douteuse est ignorée', () => {
  const d = join(racine, 'partage-fichier');
  assert.equal(lireAnnonce(d), null);
  const a = annonceDuLancement(lancement(), { instant: instantDe(T0) });
  assert.equal(publierAnnonce(d, a), true);
  assert.deepEqual(lireAnnonce(d), a);
  assert.equal(publierAnnonce(d, a), false, 'inchangée : pas réécrite');
  assert.equal(publierAnnonce(d, undefined), false);
  assert.deepEqual(lireAnnonce(d), a);
  assert.equal(publierAnnonce(d, null), true);
  assert.equal(existsSync(join(d, FICHIER_ANNONCE)), false);
  assert.equal(publierAnnonce(d, null), false);
  writeFileSync(join(d, FICHIER_ANNONCE), JSON.stringify({ ...a, format: 'autre' }));
  assert.equal(lireAnnonce(d), null);
  writeFileSync(join(d, FICHIER_ANNONCE), 'pas du JSON');
  assert.equal(lireAnnonce(d), null);
  assert.equal(lireAnnonce(null), null);
  assert.equal(publierAnnonce(null, a), false, 'sans dossier partagé : rien');
});

const journal = [];
/** Un service HTTP réel ; `version` : celle qui tourne (version.json du site installé). */
const demarrer = ({ nom, edition, version, partage, intervalle = 0, reference = null }) => demarrerService({
  regles, dossier: join(racine, nom), port: 0, intervalle, edition, reference, maintenance: partage, versionParDefaut: version,
  journal: (l) => journal.push(l), relancer: () => {},
});
const lire = async (s, chemin = '/api/maintenance/', options) => {
  const r = await fetch(`${s.url}${chemin}`, options);
  return { statut: r.status, corps: await r.json() };
};
const lever = (s, lot) => lire(s, '/api/maintenance/lever/', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lot }) });

test('deux serveurs, une annonce : le site de dev la publie, la production la lit ; chacun rouvre dès que la nouvelle version y tourne', async () => {
  const partage = join(racine, 'partage-deux');
  const depuis = instantDe(Date.now() - 60_000);
  poserLancement(join(racine, 'dev'), lancement({ etat: 'lance', lance_le: depuis, run: { id: 7, url: 'https://github.com/x/runs/7', statut: 'queued' } }));
  let dev = await demarrer({ nom: 'dev', edition: true, version: '0.2.0', partage });
  let prod = await demarrer({ nom: 'prod', edition: false, version: '0.2.0', partage });
  try {
    assert.deepEqual(await lire(dev), { statut: 200, corps: { active: true, version_cible: '0.3', depuis, etape: 'preparation', lot: LOT, run: 'https://github.com/x/runs/7', levable: true } });
    assert.equal(lireAnnonce(partage)?.lot, LOT, 'publiée par le site de dev');
    assert.deepEqual((await lire(prod)).corps, { active: true, version_cible: '0.3', depuis, etape: 'preparation' }, 'la production : ni lot, ni run, ni bouton');
    // la production s'installe la première : elle rouvre, le site de dev reste en maintenance
    await prod.arreter();
    prod = await demarrer({ nom: 'prod', edition: false, version: '0.3.0', partage });
    assert.equal((await lire(prod)).corps.active, false);
    assert.equal((await lire(dev)).corps.active, true);
    // le site de dev reçoit la version de dev qui porte le lot (0.2.1) : toujours en maintenance, étape « installation » une fois livré ; puis la 0.3.0
    poserLancement(join(racine, 'dev'), { ...lireLancement(join(racine, 'dev')), etat: 'termine' });
    await dev.arreter();
    dev = await demarrer({ nom: 'dev', edition: true, version: '0.2.1', partage });
    assert.equal((await lire(dev)).corps.etape, 'installation');
    await dev.arreter();
    dev = await demarrer({ nom: 'dev', edition: true, version: '0.3.0', partage });
    assert.equal((await lire(dev)).corps.active, false);
    // l'inverse aussi : le site de dev déjà installé, une production restée en 0.2 est toujours en maintenance
    await prod.arreter();
    prod = await demarrer({ nom: 'prod', edition: false, version: '0.2.0', partage });
    assert.equal((await lire(prod)).corps.etape, 'installation');
    // sans dossier partagé (production mal montée) : jamais en maintenance ; le site de dev, lui, l'est d'après son seul lancement
    const seul = await demarrer({ nom: 'prod', edition: false, version: '0.2.0', partage: null });
    try {
      assert.equal((await lire(seul)).corps.active, false);
    } finally {
      await seul.arreter();
    }
  } finally {
    await dev.arreter();
    await prod.arreter();
  }
});

test('arrêtée avant d’être livrée (échec, annulation), la mise à jour retire l’annonce : les deux rouvrent ; relancée, elles se referment ; « Lever la maintenance »', async () => {
  const partage = join(racine, 'partage-fin');
  const dossierDev = join(racine, 'dev-fin');
  const depuis = instantDe(Date.now() - 60_000);
  poserLancement(dossierDev, lancement({ etat: 'en_cours', lance_le: depuis }));
  const dev = await demarrer({ nom: 'dev-fin', edition: true, version: '0.2.0', partage });
  const prod = await demarrer({ nom: 'prod-fin', edition: false, version: '0.2.0', partage });
  try {
    assert.equal((await lire(dev)).corps.active, true);
    assert.equal((await lire(prod)).corps.active, true);
    poserLancement(dossierDev, { ...lireLancement(dossierDev), etat: 'echec' });
    assert.equal((await lire(dev)).corps.active, false);
    assert.equal(existsSync(join(partage, FICHIER_ANNONCE)), false, 'annonce retirée');
    assert.equal((await lire(prod)).corps.active, false);
    // « Re-run » sur GitHub d'une livraison échouée : le suivi repasse le lancement « fusionne », les deux se referment
    poserLancement(dossierDev, { ...lireLancement(dossierDev), etat: 'fusionne' });
    assert.equal((await lire(dev)).corps.etape, 'livraison');
    assert.equal((await lire(prod)).corps.etape, 'livraison');
    // « Lever la maintenance » : le lot affiché seulement, sur le site de dev seulement ; la mise à jour continue
    assert.equal((await lever(dev, '00000000-0000-0000-0000-000000000000')).statut, 409, 'onglet périmé');
    assert.equal((await lever(prod, LOT)).statut, 403, 'la production ne tient pas le lancement');
    assert.deepEqual(await lever(dev, LOT), { statut: 200, corps: { active: false } });
    assert.equal((await lire(prod)).corps.active, false);
    const l = lireLancement(dossierDev);
    assert.equal(l.etat, 'fusionne', 'le lancement lui-même ne change pas');
    assert.match(l.maintenance_levee_le, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/);
    assert.equal((await lever(dev, LOT)).statut, 200, 'déjà levée : sans effet');
    // plafond : un lancement sans fin plus vieux que DUREE_MAX_MAINTENANCE ne ferme plus rien
    poserLancement(dossierDev, lancement({ etat: 'fusionne', lance_le: instantDe(Date.now() - DUREE_MAX_MAINTENANCE - 60_000) }));
    assert.equal((await lire(dev)).corps.active, false);
    assert.equal((await lire(prod)).corps.active, false);
    // base de test remplacée (plus de lancement connu) : l'annonce publiée reste, la production reste en maintenance jusqu'au plafond
    poserLancement(dossierDev, lancement({ etat: 'fusionne', lance_le: depuis }));
    assert.equal((await lire(dev)).corps.active, true);
    rmSync(join(dossierDev, 'mise-a-jour'), { recursive: true });
    assert.equal((await lire(dev)).corps.active, true, 'le site de dev lit alors l’annonce comme la production');
    assert.equal((await lire(prod)).corps.active, true);
  } finally {
    await dev.arreter();
    await prod.arreter();
  }
});

test('site de dev : la minuterie suit la mise à jour sans personne sur la page — note arrivée (livraison), version livrée sur master (installation)', async () => {
  const partage = join(racine, 'partage-minuterie');
  const dossierDev = join(racine, 'dev-minuterie');
  // la référence (production) : une copie des règles et sa version, comme site/donnees/reference.db et reference.json
  const reference = join(racine, 'reference.db');
  copyFileSync(regles, reference);
  writeFileSync(join(racine, 'reference.json'), `${JSON.stringify({ version: '0.2.0' })}\n`);
  poserLancement(dossierDev, lancement({ etat: 'lance', lance_le: instantDe(Date.now() - 60_000) }));
  const dev = await demarrer({ nom: 'dev-minuterie', edition: true, version: '0.2.0', partage, intervalle: 30, reference });
  const attendre = async (etat) => {
    for (let i = 0; i < 200 && lireAnnonce(partage)?.etat !== etat; i++) await new Promise((ok) => setTimeout(ok, 15));
    assert.equal(lireAnnonce(partage)?.etat, etat);
  };
  try {
    await attendre('lance');
    // la nouvelle version de dev (le lot fusionné) arrive : sa note est dans les règles de la base vivante
    const db = new DatabaseSync(join(dossierDev, FICHIER_BASE));
    const version = versionLibre(db);
    db.prepare("INSERT INTO note_version (version, publiee_le, depuis, texte, lot, exemple) VALUES (?, '2026-10-11', '0.2', NULL, ?, 0)").run(version, LOT);
    db.close();
    await attendre('fusionne');
    // la livraison faite, master porte la version de la note : la référence du site de dev le dit
    writeFileSync(join(racine, 'reference.json'), `${JSON.stringify({ version: `${version}.0` })}\n`);
    await attendre('termine');
    assert.equal(lireLancement(dossierDev).etat, 'termine');
  } finally {
    await dev.arreter();
  }
});

test('routes : GET seul pour l’état (sans la base), POST JSON du même site pour lever ; « Effectuer la mise à jour » et « Annuler » republient tout de suite', () => {
  const dossier = join(racine, 'api');
  const { chemin } = preparerBaseVivante({ regles, dossier });
  const db = ouvrirBaseVivante(chemin);
  try {
    let appels = 0;
    const github = { configure: () => true, declencher: async () => {}, suivre: async () => {}, annulerRun: async () => true };
    const service = {
      base: () => db, etat: () => ({ version: '0.2.0' }), edition: true, dossier, reference: null, depot: 'x/y', adresse: 'https://dev.exemple.org',
      github, limites: { delai: 0, parJour: Infinity }, maintenance: () => { appels += 1; return { active: false }; },
    };
    const appel = (methode, c, corps, entetes = JSON_, s = service) => traiter({ methode, chemin: c, entetes, corps: corps === undefined ? undefined : JSON.stringify(corps) }, s);
    assert.deepEqual(appel('GET', '/api/maintenance/', undefined, {}, { ...service, base: () => null }).corps, { active: false }, 'répond sans la base');
    assert.deepEqual(appel('GET', '/api/maintenance', undefined, {}, { etat: () => ({}) }).corps, { active: false }, 'service sans maintenance');
    assert.equal(appel('POST', '/api/maintenance/', {}).statut, 405);
    assert.equal(appel('GET', '/api/maintenance/lever/').statut, 405);
    assert.equal(appel('GET', '/api/maintenance/autre/').statut, 404);
    assert.equal(appel('POST', '/api/maintenance/lever/', { lot: LOT }, { 'content-type': 'text/plain' }).statut, 415);
    assert.equal(appel('POST', '/api/maintenance/lever/', { lot: LOT }, { ...JSON_, 'sec-fetch-site': 'cross-site' }).statut, 403);
    appels = 0;
    const r = appel('POST', '/api/mise-a-jour/lancer/', { confirmation: CONFIRMATION });
    assert.equal(r.statut, 202, JSON.stringify(r.corps));
    assert.equal(r.corps.lancement.etat, 'envoi');
    assert.ok(appels >= 1, 'l’annonce part avec le lancement, sans attendre la minuterie');
    appels = 0;
    assert.equal(appel('POST', '/api/mise-a-jour/liberer/', { lot: r.corps.lancement.lot }).corps.lancement.etat, 'annule');
    assert.equal(appels, 1, 'annulé : l’annonce est retirée tout de suite');
  } finally {
    db.close();
  }
});

test('page de maintenance : on revient à la page d’où l’on venait, jamais sur un autre site ni sur la page de maintenance', () => {
  const o = { origine: 'https://maverick-jdr.com', accueil: '/' };
  assert.equal(adresseDeRetour('?retour=%2Fraces%2Felfe%2F%3Fa%3D1%23don', o), '/races/elfe/?a=1#don');
  assert.equal(adresseDeRetour('', o), '/');
  for (const autre of ['//exemple.org/', 'https://exemple.org/', '/\\exemple.org', 'javascript:alert(1)', 'races/', '/maintenance/', '/maintenance/?retour=/x/']) {
    assert.equal(adresseDeRetour(`?retour=${encodeURIComponent(autre)}`, o), '/', autre);
  }
  // déploiement sous un sous-chemin : seules les pages du site
  const sous = { origine: 'https://exemple.org', accueil: '/MaverickCenter/' };
  assert.equal(adresseDeRetour('?retour=/MaverickCenter/fiche/', sous), '/MaverickCenter/fiche/');
  assert.equal(adresseDeRetour('?retour=/autre/', sous), '/MaverickCenter/');
});
